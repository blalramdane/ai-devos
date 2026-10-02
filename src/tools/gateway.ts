import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { tool } from "@openai/agents";
import { z } from "zod";
import type { SandboxExecutor } from "../sandbox/types.js";

export interface ToolGatewayOptions {
  workspace: string;
  executor: SandboxExecutor;
}

function safePath(workspace: string, requestedPath: string): string {
  const root = resolve(workspace);
  const candidate = resolve(root, requestedPath);
  const rel = relative(root, candidate);
  if (isAbsolute(rel) || rel.startsWith("..")) {
    throw new Error("Path escapes the project workspace.");
  }
  return candidate;
}

export function createToolGateway(options: ToolGatewayOptions) {
  const readWorkspaceFile = tool({
    name: "read_workspace_file",
    description: "Read a UTF-8 text file inside the current project workspace.",
    parameters: z.object({ path: z.string() }),
    execute: async ({ path }) => readFile(safePath(options.workspace, path), "utf8"),
  });

  const writeWorkspaceFile = tool({
    name: "write_workspace_file",
    description: "Write a UTF-8 text file inside the current project workspace. Parent directories are created automatically.",
    parameters: z.object({ path: z.string(), content: z.string() }),
    execute: async ({ path, content }) => {
      const target = safePath(options.workspace, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content, "utf8");
      return `Wrote ${path}`;
    },
  });

  const runWorkspaceCommand = tool({
    name: "run_workspace_command",
    description: "Run a shell command in the project workspace through the configured execution policy and sandbox.",
    parameters: z.object({
      command: z.string(),
      approveRisky: z.boolean().default(false),
    }),
    execute: async ({ command, approveRisky }) =>
      JSON.stringify(await options.executor.run(command, options.workspace, { approveRisky })),
  });

  return [readWorkspaceFile, writeWorkspaceFile, runWorkspaceCommand];
}
