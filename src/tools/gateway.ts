import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { tool } from "@openai/agents";
import { z } from "zod";
import type { SandboxExecutor } from "../sandbox/types.js";

export interface ToolGatewayEvent {
  phase: "started" | "completed";
  tool: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface ToolGatewayOptions {
  workspace: string;
  executor: SandboxExecutor;
  onEvent?: (event: ToolGatewayEvent) => void | Promise<void>;
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

async function emit(options: ToolGatewayOptions, event: ToolGatewayEvent) {
  await options.onEvent?.(event);
}

export function createToolGateway(options: ToolGatewayOptions) {
  const readWorkspaceFile = tool({
    name: "read_workspace_file",
    description: "Read a UTF-8 text file inside the current project workspace.",
    parameters: z.object({ path: z.string() }),
    execute: async ({ path }) => {
      await emit(options, { phase: "started", tool: "read_workspace_file", message: `Reading ${path}`, data: { path } });
      try {
        const value = await readFile(safePath(options.workspace, path), "utf8");
        await emit(options, { phase: "completed", tool: "read_workspace_file", message: `Read ${path}`, data: { path, bytes: value.length } });
        return value;
      } catch (error) {
        await emit(options, { phase: "completed", tool: "read_workspace_file", message: `Read failed: ${path}`, data: { path, error: String(error) } });
        throw error;
      }
    },
  });

  const writeWorkspaceFile = tool({
    name: "write_workspace_file",
    description: "Write a UTF-8 text file inside the current project workspace. Parent directories are created automatically.",
    parameters: z.object({ path: z.string(), content: z.string() }),
    execute: async ({ path, content }) => {
      await emit(options, { phase: "started", tool: "write_workspace_file", message: `Writing ${path}`, data: { path } });
      try {
        const target = safePath(options.workspace, path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content, "utf8");
        await emit(options, { phase: "completed", tool: "write_workspace_file", message: `Wrote ${path}`, data: { path, bytes: content.length } });
        return `Wrote ${path}`;
      } catch (error) {
        await emit(options, { phase: "completed", tool: "write_workspace_file", message: `Write failed: ${path}`, data: { path, error: String(error) } });
        throw error;
      }
    },
  });

  const runWorkspaceCommand = tool({
    name: "run_workspace_command",
    description: "Run a shell command in the project workspace through the configured execution policy and sandbox.",
    parameters: z.object({
      command: z.string(),
      approveRisky: z.boolean().default(false),
    }),
    execute: async ({ command, approveRisky }) => {
      await emit(options, { phase: "started", tool: "run_workspace_command", message: `Running: ${command}`, data: { command } });
      try {
        const result = await options.executor.run(command, options.workspace, { approveRisky });
        await emit(options, { phase: "completed", tool: "run_workspace_command", message: result.exitCode === 0 ? `Command passed: ${command}` : `Command failed: ${command}`, data: { command, exitCode: result.exitCode, blocked: result.blocked, timedOut: result.timedOut } });
        return JSON.stringify(result);
      } catch (error) {
        await emit(options, { phase: "completed", tool: "run_workspace_command", message: `Command error: ${command}`, data: { command, error: String(error) } });
        throw error;
      }
    },
  });

  return [readWorkspaceFile, writeWorkspaceFile, runWorkspaceCommand];
}
