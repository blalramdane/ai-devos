import type { ModelRoute } from "./config.js";
import type { ModelCatalogEntry } from "./model-catalog.js";

export type PolicyMode = "strict" | "balanced";
export type PrivacyMode = "local" | "cloud-ok";
export type BudgetTier = "low" | "standard" | "premium";

export interface ModelPolicyConfig {
  mode: PolicyMode;
  privacy: PrivacyMode;
  budget: BudgetTier;
  maxContext?: number;
  maxOutput?: number;
}

export interface ModelPolicyDecision {
  route: ModelRoute;
  reason: string[];
  rejected: Array<{ route: ModelRoute; reasons: string[] }>;
}

const ENGINEERING = ["code", "bug", "fix", "api", "architecture", "test", "build", "debug", "refactor", "deploy", "implement"];
const RESEARCH = ["research", "latest", "current", "compare", "verify", "documentation", "investigate"];
const PRODUCT = ["prd", "roadmap", "requirement", "spec", "feature", "product"];
const LOCAL = ["local", "offline", "private", "on-device", "no cloud"];

function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

export function classifyMission(mission: string): "engineering" | "research" | "product" | "local" | "general" {
  const text = mission.toLowerCase();
  if (hasAny(text, LOCAL)) return "local";
  if (hasAny(text, ENGINEERING)) return "engineering";
  if (hasAny(text, RESEARCH)) return "research";
  if (hasAny(text, PRODUCT)) return "product";
  return "general";
}

function catalogFor(route: ModelRoute, catalog: ModelCatalogEntry[]): ModelCatalogEntry | undefined {
  return catalog.find((entry) => entry.id === route.model);
}

function score(route: ModelRoute, model: ModelCatalogEntry | undefined, mission: string, policy: ModelPolicyConfig): { value: number; reason: string[] } {
  const text = mission.toLowerCase();
  const kind = classifyMission(mission);
  let value = 0;
  const reason: string[] = [];

  if (route.tags.includes(kind)) { value += 12; reason.push("tag:" + kind); }
  if (kind === "local" && route.provider === "ollama") { value += 100; reason.push("privacy:local"); }
  if (kind !== "local" && route.provider === "ollama" && policy.privacy === "cloud-ok") value += 2;

  const cloud = route.provider !== "ollama";
  if (policy.privacy === "local" && cloud) return { value: Number.NEGATIVE_INFINITY, reason: ["privacy policy requires local execution"] };

  if (kind === "engineering") {
    if (model?.supportsTools === false) return { value: Number.NEGATIVE_INFINITY, reason: ["engineering tasks require tool-capable models"] };
    if (model?.supportsTools === true) { value += 8; reason.push("tools:required"); }
  }

  if (kind === "research" && model?.supportsReasoning === true) { value += 6; reason.push("reasoning-capable"); }

  if (policy.maxContext && model?.contextWindow && model.contextWindow < policy.maxContext) {
    return { value: Number.NEGATIVE_INFINITY, reason: ["context window " + model.contextWindow + " < required " + policy.maxContext] };
  }
  if (policy.maxOutput && model?.maxOutputTokens && model.maxOutputTokens < policy.maxOutput) {
    return { value: Number.NEGATIVE_INFINITY, reason: ["max output " + model.maxOutputTokens + " < required " + policy.maxOutput] };
  }

  const input = model?.inputCostPerMillion;
  const output = model?.outputCostPerMillion;
  if (input !== undefined || output !== undefined) {
    const estimated = (input ?? 0) + (output ?? 0);
    if (policy.budget === "low") { value += Math.max(-20, 20 - estimated); reason.push("budget:low"); }
    else if (policy.budget === "premium") { value += Math.min(20, estimated); reason.push("budget:premium"); }
    else { value += 5; reason.push("budget:standard"); }
  }

  if (text.includes("heavy") || text.includes("complex")) {
    if (model?.supportsReasoning) { value += 8; reason.push("complex-task:reasoning"); }
    if ((model?.contextWindow ?? 0) >= 100_000) { value += 4; reason.push("complex-task:large-context"); }
  }

  value += Math.max(0, 5 - route.priority);
  return { value, reason };
}

export function resolveModelPolicy(mission: string, config: ModelPolicyConfig, routes: ModelRoute[], catalog: ModelCatalogEntry[] = []): ModelPolicyDecision {
  const ranked = routes.map((route) => {
    const result = score(route, catalogFor(route, catalog), mission, config);
    return { route, ...result };
  });
  const eligible = ranked.filter((item) => Number.isFinite(item.value))
    .sort((a, b) => b.value - a.value || a.route.priority - b.route.priority);

  if (eligible.length === 0) {
    if (config.mode === "balanced" && ranked.length > 0) {
      const fallback = [...ranked].sort((a, b) => a.route.priority - b.route.priority)[0];
      return { route: fallback.route, reason: ["balanced policy fallback"], rejected: ranked.filter((x) => x.route.id !== fallback.route.id).map((x) => ({ route: x.route, reasons: x.reason })) };
    }
    throw new Error("Model Policy rejected every configured route for this mission.");
  }

  const winner = eligible[0];
  return {
    route: winner.route,
    reason: winner.reason.length ? winner.reason : ["priority/default"],
    rejected: ranked.filter((x) => x.route.id !== winner.route.id).map((x) => ({ route: x.route, reasons: x.reason })),
  };
}

export function loadModelPolicy(env: NodeJS.ProcessEnv = process.env): ModelPolicyConfig {
  return {
    mode: env.AIDEVOS_POLICY_MODE === "strict" ? "strict" : "balanced",
    privacy: env.AIDEVOS_PRIVACY === "local" ? "local" : "cloud-ok",
    budget: ["low", "standard", "premium"].includes(env.AIDEVOS_BUDGET_TIER ?? "") ? env.AIDEVOS_BUDGET_TIER as BudgetTier : "standard",
    maxContext: env.AIDEVOS_MAX_CONTEXT ? Number(env.AIDEVOS_MAX_CONTEXT) : undefined,
    maxOutput: env.AIDEVOS_MAX_OUTPUT ? Number(env.AIDEVOS_MAX_OUTPUT) : undefined,
  };
}
