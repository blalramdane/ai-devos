import { spawn } from "node:child_process";
import { classifyCommand, requiresApproval } from "../policy.js";
import type { SandboxCommandResult, SandboxExecutor } from "./types.js";

export interface DockerSandboxOptions {
  image?: string;
  network?: "none" | "host";
  memory?: string;
  cpus?: string;
  pidsLimit?: number;
  timeoutMs?: number;
}

export class DockerSandboxExecutor implements SandboxExecutor {
  private readonly options: Required<DockerSandboxOptions>;

  constructor(options: DockerSandboxOptions = {}) {
    this.options = {
      image: options.image ?? "node:22-bookworm-slim",
      network: options.network ?? "none",
      memory: options.memory ?? "2g",
      cpus: options.cpus ?? "2",
      pidsLimit: options.pidsLimit ?? 256,
      timeoutMs: options.timeoutMs ?? 120_000,
    };
  }

  async run(
    command: string,
    cwd: string,
    options: { approveRisky?: boolean } = {},
  ): Promise<SandboxCommandResult> {
    const risk = classifyCommand(command);
    if (requiresApproval(risk) && !options.approveRisky) {
      return {
        command,
        cwd,
        stdout: "",
        stderr: "Command blocked by execution policy; explicit approval is required.",
        exitCode: 126,
        timedOut: false,
        blocked: true,
        sandboxed: true,
      };
    }

    const args = [
      "run",
      "--rm",
      "--network", this.options.network,
      "--memory", this.options.memory,
      "--cpus", this.options.cpus,
      "--pids-limit", String(this.options.pidsLimit),
      "--mount", `type=bind,src=${cwd},dst=/workspace`,
      "--workdir", "/workspace",
      this.options.image,
      "sh",
      "-lc",
      command,
    ];

    return new Promise((resolve) => {
      const child = spawn("docker", args, { windowsHide: true });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let settled = false;

      const finish = (exitCode: number) => {
        if (settled) return;
        settled = true;
        resolve({
          command,
          cwd,
          stdout,
          stderr,
          exitCode,
          timedOut,
          blocked: false,
          sandboxed: true,
        });
      };

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
        finish(124);
      }, this.options.timeoutMs);

      child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
      child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
      child.on("error", (error) => {
        clearTimeout(timer);
        stderr += error.message;
        finish(127);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        finish(code ?? 1);
      });
    });
  }
}
