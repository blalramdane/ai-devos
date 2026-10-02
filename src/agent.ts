import { Agent, Runner, run } from "@openai/agents";
import { createModelRouterFromEnv } from "./ai/router.js";
import { createToolGateway } from "./tools/gateway.js";
import type { SandboxExecutor } from "./sandbox/types.js";

export interface DevOSAgentOptions {
  workspace: string;
  executor: SandboxExecutor;
  model?: string;
  maxTurns?: number;
}

export function createDevOSAgent(options: DevOSAgentOptions) {
  const modelRouter = createModelRouterFromEnv();
  const tools = createToolGateway({
    workspace: options.workspace,
    executor: options.executor,
  });

  const agent = new Agent({
    name: "AI DevOS Software Engineer",
    model: options.model ?? "openai/gpt-5.6-luna",
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
      return run(agent, prompt, { maxTurns: options.maxTurns ?? 20, context: undefined });
    },
    async close() {
      await modelRouter.close();
    },
  };
}
