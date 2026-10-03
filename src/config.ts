import { resolve } from "node:path";

export type ProviderKind = "ollama" | "openai" | "compatible" | "experiential";

export interface ModelRoute {
  id: string;
  provider: ProviderKind;
  baseUrl: string;
  apiKey: string;
  model: string;
  priority: number;
  tags: string[];
}

export interface DevOSConfig {
  provider: ProviderKind;
  baseUrl: string;
  apiKey: string;
  model: string;
  primaryRoute: ModelRoute;
  fallbackRoutes: ModelRoute[];
  dataDir: string;
  maxTurns: number;
}

function providerDefaults(provider: ProviderKind, env: NodeJS.ProcessEnv) {
  switch (provider) {
    case "ollama":
      return { baseUrl: "http://127.0.0.1:11434/v1", apiKey: "ollama", model: "qwen3:4b" };
    case "experiential":
      return {
        baseUrl: "https://api.experientiallabs.ai/v1",
        apiKey: env.EXPLABS_API_KEY ?? "",
        model: "qwen3.8-27b",
      };
    case "openai":
      return {
        baseUrl: "https://api.openai.com/v1",
        apiKey: env.OPENAI_API_KEY ?? "",
        model: "gpt-5.6-luna",
      };
    case "compatible":
      return {
        baseUrl: env.AIDEVOS_COMPATIBLE_BASE_URL ?? "",
        apiKey: env.AIDEVOS_COMPATIBLE_API_KEY ?? "",
        model: env.AIDEVOS_COMPATIBLE_MODEL ?? "default",
      };
  }
}

function routeFromProvider(
  provider: ProviderKind,
  env: NodeJS.ProcessEnv,
  overrides: Partial<Pick<ModelRoute, "baseUrl" | "apiKey" | "model">> = {},
): ModelRoute {
  const defaults = providerDefaults(provider, env);
  const baseUrl = overrides.baseUrl ?? defaults.baseUrl;
  if (!baseUrl) throw new Error(`Missing base URL for ${provider} model route.`);

  return {
    id: provider,
    provider,
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey: overrides.apiKey ?? defaults.apiKey,
    model: overrides.model ?? defaults.model,
    priority: 100,
    tags: [],
  };
}

function parseTags(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

function parseFallbackRoutes(value: string | undefined, env: NodeJS.ProcessEnv): ModelRoute[] {
  if (!value?.trim()) return [];

  return value.split(",").map((entry, index) => {
    const [providerName, ...modelParts] = entry.trim().split(":");
    const provider = providerName as ProviderKind;
    if (!["ollama", "openai", "compatible", "experiential"].includes(provider)) {
      throw new Error(`Unsupported fallback provider: ${providerName}`);
    }

    const model = modelParts.join(":").trim();
    if (!model) throw new Error(`Fallback route ${index + 1} is missing a model.`);

    const route = routeFromProvider(provider, env, { model });
    route.id = `fallback-${index + 1}-${provider}`;
    route.priority = index + 2;
    route.tags = parseTags(env[`AIDEVOS_FALLBACK_${index + 1}_TAGS`]);
    return route;
  });
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): DevOSConfig {
  const provider = (env.AIDEVOS_PROVIDER ?? "ollama") as ProviderKind;
  if (!["ollama", "openai", "compatible", "experiential"].includes(provider)) {
    throw new Error(`Unsupported AIDEVOS_PROVIDER: ${provider}`);
  }

  const primary = routeFromProvider(provider, env, {
    baseUrl: env.AIDEVOS_BASE_URL,
    apiKey: env.AIDEVOS_API_KEY,
    model: env.AIDEVOS_MODEL,
  });
  primary.id = "primary";
  primary.priority = 1;
  primary.tags = parseTags(env.AIDEVOS_ROUTE_TAGS);

  const fallbackRoutes = parseFallbackRoutes(env.AIDEVOS_FALLBACKS, env);

  return {
    provider,
    baseUrl: primary.baseUrl,
    apiKey: primary.apiKey,
    model: primary.model,
    primaryRoute: primary,
    fallbackRoutes,
    dataDir: resolve(env.AIDEVOS_DATA_DIR ?? ".aidevos"),
    maxTurns: Number(env.AIDEVOS_MAX_TURNS ?? 30),
  };
}
