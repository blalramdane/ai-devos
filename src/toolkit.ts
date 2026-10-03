import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { tool, type RunContext } from "@openai/agents";
import { z } from "zod";
import { classifyCommand } from "./policy.js";

const execAsync = promisify(exec);

export interface AgentContext {
  projectRoot: string;
}

function safePath(root: string, input: string): string {
  const candidate = resolve(root, input);
  const rel = relative(root, candidate);
  if (rel.startsWith("..") || isAbsolute(rel) || rel.split(sep).includes("..")) {
    throw new Error("Path escapes the project root.");
  }
  return candidate;
}

async function walk(root: string, current: string, output: string[], depth: number): Promise<void> {
  if (depth > 5 || output.length >= 400) return;
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if ([".git", "node_modules", "dist", "build", ".aidevos"].includes(entry.name)) continue;
    const full = resolve(current, entry.name);
    output.push(relative(root, full) || ".");
    if (entry.isDirectory()) await walk(root, full, output, depth + 1);
    if (output.length >= 400) return;
  }
}

export function createProjectTools() {
  const listFiles = tool({
    name: "list_project_files",
    description: "List relevant files and directories inside the active project. Use this before broad changes.",
    parameters: z.object({}),
    execute: async (_args, context?: RunContext<AgentContext>) => {
      const root = context?.context.projectRoot;
      if (!root) throw new Error("Project root is missing.");
      const output: string[] = [];
      await walk(root, root, output, 0);
      return output.join("\n");
    },
  });

  const readProjectFile = tool({
    name: "read_project_file",
    description: "Read a text file inside the active project. Use targeted reads rather than dumping the whole repository.",
    parameters: z.object({ path: z.string() }),
    execute: async ({ path }, context?: RunContext<AgentContext>) => {
      const root = context?.context.projectRoot;
      if (!root) throw new Error("Project root is missing.");
      const full = safePath(root, path);
      const info = await stat(full);
      if (!info.isFile()) throw new Error("Path is not a file.");
      const text = await readFile(full, "utf8");
      return text.length > 30000 ? text.slice(0, 30000) + "\n[truncated]" : text;
    },
  });

  const searchProject = tool({
    name: "search_project",
    description: "Search text in relevant project files using a literal string. Skips dependencies and generated files.",
    parameters: z.object({
      query: z.string().min(1),
      maxResults: z.number().int().min(1).max(100).default(30),
    }),
    execute: async ({ query, maxResults }, context?: RunContext<AgentContext>) => {
      const root = context?.context.projectRoot;
      if (!root) throw new Error("Project root is missing.");
      const files: string[] = [];
      await walk(root, root, files, 0);
      const matches: string[] = [];
      for (const file of files) {
        if (matches.length >= maxResults) break;
        const full = safePath(root, file);
        try {
          const info = await stat(full);
          if (!info.isFile() || info.size > 1024 * 1024) continue;
          const text = await readFile(full, "utf8");
          text.split(/\r?\n/).forEach((line, index) => {
            if (matches.length < maxResults && line.toLowerCase().includes(query.toLowerCase())) {
              matches.push(`${file}:${index + 1}: ${line.slice(0, 240)}`);
            }
          });
        } catch {
          // Ignore binary/unreadable files.
        }
      }
      return matches.length ? matches.join("\n") : "No matches found.";
    },
  });

  const writeProjectFile = tool({
    name: "write_project_file",
    description: "Create or replace a text file inside the active project. Use only for task-relevant changes.",
    parameters: z.object({
      path: z.string(),
      content: z.string(),
    }),
    execute: async ({ path, content }, context?: RunContext<AgentContext>) => {
      const root = context?.context.projectRoot;
      if (!root) throw new Error("Project root is missing.");
      const full = safePath(root, path);
      await writeFile(full, content, "utf8");
      return `Wrote ${path}`;
    },
  });

  const runProjectCommand = tool({
    name: "run_project_command",
    description: "Run a project-local command. Destructive and external commands are blocked unless the application policy is changed explicitly.",
    parameters: z.object({
      command: z.string().min(1),
    }),
    execute: async ({ command }, context?: RunContext<AgentContext>) => {
      const root = context?.context.projectRoot;
      if (!root) throw new Error("Project root is missing.");
      const risk = classifyCommand(command);
      if (risk === "high" || risk === "critical") {
        return JSON.stringify({ blocked: true, risk, message: "Blocked by AI DevOS safety policy. Explicit approval is required." });
      }
      try {
        const result = await execAsync(command, {
          cwd: root,
          windowsHide: true,
          maxBuffer: 4 * 1024 * 1024,
        });
        return JSON.stringify({
          blocked: false,
          risk,
          exitCode: 0,
          stdout: result.stdout.slice(-12000),
          stderr: result.stderr.slice(-12000),
        });
      } catch (error) {
        const e = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number };
        return JSON.stringify({
          blocked: false,
          risk,
          exitCode: typeof e.code === "number" ? e.code : 1,
          stdout: e.stdout?.slice(-12000) ?? "",
          stderr: (e.stderr ?? e.message ?? "Command failed").slice(-12000),
        });
      }
    },
  });

  const gitStatus = tool({
    name: "git_status",
    description: "Inspect the current Git status of the active project.",
    parameters: z.object({}),
    execute: async (_args, context?: RunContext<AgentContext>) => {
      const root = context?.context.projectRoot;
      if (!root) throw new Error("Project root is missing.");
      const result = await execAsync("git status --short --branch", { cwd: root, windowsHide: true });
      return result.stdout;
    },
  });

  const gitDiff = tool({
    name: "git_diff",
    description: "Inspect the current Git diff to verify the changes made by the agent.",
    parameters: z.object({ staged: z.boolean().default(false) }),
    execute: async ({ staged }, context?: RunContext<AgentContext>) => {
      const root = context?.context.projectRoot;
      if (!root) throw new Error("Project root is missing.");
      const command = staged ? "git diff --cached" : "git diff";
      const result = await execAsync(command, { cwd: root, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
      return result.stdout.slice(-30000) || "No diff.";
    },
  });

  return [listFiles, readProjectFile, searchProject, writeProjectFile, runProjectCommand, gitStatus, gitDiff];
}
