import type { Evidence, Project, Task, TaskStatus, VerificationReport } from "./domain.js";
import { buildVerificationReport } from "./verification.js";
import type { SandboxExecutor } from "./sandbox/types.js";
import { FileMemoryStore } from "./memory.js";
import { RecoveryEngine } from "./recovery.js";
import type { TaskStore } from "./store.js";
import type { BrowserCheck, BrowserVerifier } from "./browser.js";
import type { MissionEvent } from "./events.js";

export interface MissionRequest { taskId: string; project: Project; prompt: string; verificationCommands?: string[]; browserChecks?: BrowserCheck[]; maxRecoveryAttempts?: number; }
export interface MissionResult { task: Task; report: VerificationReport; agentOutput?: string; recoveryAttempts: number; repairOutputs: string[]; }
export interface MissionRunnerOptions { runAgent: (prompt: string) => Promise<{ finalOutput?: string }>; executor: SandboxExecutor; memory: FileMemoryStore; tasks?: TaskStore; browserVerifier?: BrowserVerifier; onEvent?: (event: MissionEvent) => void | Promise<void>; }
function status(task: Task, value: TaskStatus): Task { return { ...task, status: value, updatedAt: new Date().toISOString() }; }

export class MissionRunner {
  constructor(private readonly options: MissionRunnerOptions) {}
  private async emit(event: MissionEvent): Promise<void> { await this.options.onEvent?.(event); }
  async execute(request: MissionRequest): Promise<MissionResult> {
    let task: Task = { id: request.taskId, projectId: request.project.id, prompt: request.prompt, status: "queued", risk: "low", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const persist = async () => { if (this.options.tasks) await this.options.tasks.upsert(task); };
    const setStatus = async (value: TaskStatus) => { task = status(task, value); await persist(); await this.emit({ id: crypto.randomUUID(), taskId: task.id, type: "status", timestamp: new Date().toISOString(), message: value, data: { status: value } }); };
    await setStatus("planning");
    const agentPrompt = ["Execute this AI DevOS mission inside the provided project workspace.", "Do not claim completion without verification evidence.", `Project: ${request.project.name}`, `Workspace: ${request.project.rootPath}`, "", request.prompt, "", "Inspect before changing files. Use the workspace tools for all changes."].join("\n");
    await setStatus("executing");
    await this.emit({ id: crypto.randomUUID(), taskId: task.id, type: "agent.started", timestamp: new Date().toISOString(), message: "Agent execution started" });
    let result: { finalOutput?: string };
    try {
      result = await this.options.runAgent(agentPrompt);
      await this.emit({ id: crypto.randomUUID(), taskId: task.id, type: "agent.completed", timestamp: new Date().toISOString(), message: "Agent execution completed" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      const failure: Evidence = {
        id: `${request.taskId}-agent-error`,
        kind: "command",
        title: "Agent execution",
        passed: false,
        summary: message,
      };
      task = status(task, "failed");
      await persist();
      await this.emit({
        id: crypto.randomUUID(),
        taskId: task.id,
        type: "verification",
        timestamp: new Date().toISOString(),
        message: "Agent execution failed",
        data: { error: message, stack },
      });
      await this.options.memory.add({
        id: `${request.taskId}-agent-error`,
        projectId: request.project.id,
        category: "bug",
        content: `Agent execution failed: ${message}`,
        createdAt: new Date().toISOString(),
        sourceTaskId: request.taskId,
      });
      const report = buildVerificationReport(request.taskId, [failure]);
      return {
        task,
        report,
        recoveryAttempts: 0,
        repairOutputs: [],
      };
    }
    await setStatus("testing");
    const commands = request.verificationCommands ?? [];
    let evidence: Evidence[] = []; let recoveryAttempts = 0; let repairOutputs: string[] = [];
    if (commands.length > 0) {
      const recovery = new RecoveryEngine({ executor: this.options.executor, maxAttempts: request.maxRecoveryAttempts ?? 3, repair: async (failed, attempt) => {
        await this.emit({ id: crypto.randomUUID(), taskId: task.id, type: "recovery", timestamp: new Date().toISOString(), message: `Recovery attempt ${attempt}`, data: { attempt, failures: failed.map(item => item.title) } });
        const failureContext = failed.map(item => `${item.title}: ${item.summary}`).join("\n");
        const repair = await this.options.runAgent([`Verification failed on recovery attempt ${attempt}.`, "Diagnose the failure and make the smallest safe fix.", "Do not bypass execution policy.", "", failureContext].join("\n"));
        return repair.finalOutput ?? "Agent applied a recovery attempt.";
      }});
      const recovered = await recovery.verifyAndRecover(request.taskId, request.project.rootPath, commands);
      evidence = recovered.evidence; recoveryAttempts = recovered.attempts; repairOutputs = recovered.repairOutputs;
      for (const item of evidence) await this.emit({ id: crypto.randomUUID(), taskId: task.id, type: "verification", timestamp: new Date().toISOString(), message: item.passed ? `Passed: ${item.title}` : `Failed: ${item.title}`, data: { evidenceId: item.id, passed: item.passed, command: item.command, exitCode: item.exitCode } });
    }
    if (request.browserChecks?.length) {
      if (!this.options.browserVerifier) evidence.push({ id: `${request.taskId}-browser`, kind: "browser", title: "Browser verification", passed: false, summary: "Browser checks were requested but no BrowserVerifier is configured." });
      else for (const check of request.browserChecks) {
        const browserResult = await this.options.browserVerifier.verify(check); evidence.push(browserResult.evidence);
        await this.emit({ id: crypto.randomUUID(), taskId: task.id, type: "verification", timestamp: new Date().toISOString(), message: browserResult.evidence.passed ? `Browser passed: ${check.id}` : `Browser failed: ${check.id}`, data: { evidenceId: browserResult.evidence.id, passed: browserResult.evidence.passed } });
      }
    }
    await setStatus("verifying");
    const report = buildVerificationReport(request.taskId, evidence);
    task = status(task, report.verified ? "completed" : "failed"); await persist();
    await this.emit({ id: crypto.randomUUID(), taskId: task.id, type: "status", timestamp: new Date().toISOString(), message: report.verified ? "Mission verified" : "Mission failed verification", data: { status: task.status, verified: report.verified } });
    await this.options.memory.add({ id: `${request.taskId}-mission`, projectId: request.project.id, category: report.verified ? "lesson" : "bug", content: report.verified ? `Mission verified after ${recoveryAttempts || 1} verification attempt(s).` : `Mission failed verification after ${recoveryAttempts || 1} attempt(s).`, createdAt: new Date().toISOString(), sourceTaskId: request.taskId });
    return { task, report, agentOutput: result.finalOutput, recoveryAttempts, repairOutputs };
  }
}
