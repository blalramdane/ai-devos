import { Agent, Runner } from "@openai/agents";
import { createModelRouterFromEnv } from "./ai/router.js";
import { createToolGateway } from "./tools/gateway.js";
import type { SandboxExecutor } from "./sandbox/types.js";

export interface DevOSAgentOptions {
  workspace: string;
  executor: SandboxExecutor;
  model?: string;
  defaultModel?: string;
  maxTurns?: number;
  telemetry?: (event: { phase: "started" | "completed"; tool: string; message: string; data?: Record<string, unknown> }) => void | Promise<void>;
}

export function createDevOSAgent(options: DevOSAgentOptions) {
  const modelRouter = createModelRouterFromEnv();
  const tools = createToolGateway({
    workspace: options.workspace,
    executor: options.executor,
    onEvent: options.telemetry,
  });

  const agent = new Agent({
    name: "AI DevOS Software Engineer",
    model: options.model ?? options.defaultModel ?? `${process.env.AIDEVOS_DEFAULT_PROVIDER ?? "openai"}/${process.env.AIDEVOS_DEFAULT_PROVIDER === "nvidia" ? (process.env.AIDEVOS_NVIDIA_MODEL ?? "openai/gpt-oss-20b") : process.env.AIDEVOS_DEFAULT_PROVIDER === "ollama" ? (process.env.AIDEVOS_OLLAMA_MODEL ?? "qwen3:4b") : process.env.AIDEVOS_DEFAULT_PROVIDER === "litellm" ? (process.env.AIDEVOS_LITELLM_MODEL ?? "gpt-5.6-luna") : (process.env.AIDEVOS_OPENAI_MODEL ?? "gpt-5.6-luna")}`,
    instructions: [
      "You are the execution agent inside AI DevOS.",
      "Inspect before changing files.",
      "Use workspace tools for all project changes and commands.",
      "Prefer small, reversible changes.",
      "Never claim a task is verified without concrete command/test evidence.",
      "If a command is blocked by policy, stop and request approval rather than bypassing the policy.",
      "At the end, summarize changes, tests run, failures, and remaining risks.",
    ].join("\n"),
    tools,
  });

  const runner = new Runner({
    modelProvider: modelRouter,
    tracingDisabled: process.env.NODE_ENV === "test",
  });

  return {
    agent,
    runner,
    async runMission(prompt: string) {
      return runner.run(agent, prompt, { maxTurns: options.maxTurns ?? 20, context: undefined });
    },
    async close() {
      await modelRouter.close();
    },
  };
}
