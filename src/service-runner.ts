import { spawn, type ChildProcess } from "node:child_process";
import type { Project } from "./domain.js";
import { runCommand } from "./runner.js";
import { classifyCommand, requiresApproval } from "./policy.js";

export interface ServiceStartOptions {
  command: string;
  readyUrl?: string;
  timeoutMs?: number;
  pollMs?: number;
}

export interface ServiceHandle {
  pid: number;
  command: string;
  stop(): Promise<void>;
}

export class ServiceRunner {
  async start(project: Project, options: ServiceStartOptions): Promise<ServiceHandle> {
    const risk = classifyCommand(options.command);
    if (requiresApproval(risk)) {
      throw new Error(`Service command requires explicit approval (risk: ${risk}): ${options.command}`);
    }
    const [program, ...args] = this.shellArgs(options.command);
    const child = spawn(program, args, {
      cwd: project.rootPath,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      detached: process.platform !== "win32",
    });
    if (!child.pid) throw new Error("Failed to start service.");

    const logs: string[] = [];
    child.stdout?.on("data", (chunk) => logs.push(String(chunk).slice(-2000)));
    child.stderr?.on("data", (chunk) => logs.push(String(chunk).slice(-2000)));

    if (options.readyUrl) {
      const started = Date.now();
      let lastError = "";
      while (Date.now() - started < (options.timeoutMs ?? 30000)) {
        const check = await runCommand(
          "node -e " + JSON.stringify("fetch(" + JSON.stringify(options.readyUrl) + ").then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"),
          project.rootPath,
        );
        if (!check.blocked && check.exitCode === 0) return this.handle(child, options.command);
        lastError = check.stderr || check.stdout;
        if (child.exitCode !== null) break;
        await new Promise((resolve) => setTimeout(resolve, options.pollMs ?? 500));
      }
      await this.stopProcess(child);
      throw new Error("Service did not become ready: " + (lastError || "process exited or timed out") + "\n" + logs.join("\n").slice(-6000));
    }

    return this.handle(child, options.command);
  }

  async runAndVerify(project: Project, options: ServiceStartOptions, verify: (handle: ServiceHandle) => Promise<void>) {
    const handle = await this.start(project, options);
    try {
      await verify(handle);
    } finally {
      await handle.stop();
    }
  }

  private handle(child: ChildProcess, command: string) {
    return { pid: child.pid!, command, stop: async () => this.stopProcess(child) };
  }

  private async stopProcess(child: ChildProcess) {
    if (child.exitCode !== null) return;
    this.killTree(child, "SIGTERM");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (child.exitCode === null) this.killTree(child, "SIGKILL");
        resolve();
      }, 3000);
      child.once("exit", () => { clearTimeout(timer); resolve(); });
    });
  }

  private killTree(child: ChildProcess, signal: NodeJS.Signals) {
    if (!child.pid) return;
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true, stdio: "ignore" });
      return;
    }
    try { process.kill(-child.pid, signal); } catch { child.kill(signal); }
  }

  private shellArgs(command: string): string[] {
    if (process.platform === "win32") return ["cmd.exe", "/d", "/s", "/c", command];
    return ["/bin/sh", "-lc", command];
  }
}
