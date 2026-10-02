import type { Evidence, Project, Task, TaskStatus, VerificationReport } from "./domain.js";
import { buildVerificationReport } from "./verification.js";
import type { SandboxExecutor } from "./sandbox/types.js";
import { FileMemoryStore } from "./memory.js";
import { RecoveryEngine } from "./recovery.js";
import type { TaskStore } from "./store.js";

export interface MissionRequest {
  taskId: string;
  project: Project;
  prompt: string;
  verificationCommands?: string[];
  maxRecoveryAttempts?: number;
}

export interface MissionResult {
  task: Task;
  report: VerificationReport;
  agentOutput?: string;
  recoveryAttempts: number;
  repairOutputs: string[];
}

export interface MissionRunnerOptions {
  runAgent: (prompt: string) => Promise<{ finalOutput?: string }>;
  executor: SandboxExecutor;
  memory: FileMemoryStore;
  tasks?: TaskStore;
}

function status(task: Task, value: TaskStatus): Task {
  return { ...task, status: value, updatedAt: new Date().toISOString() };
}

export class MissionRunner {
  constructor(private readonly options: MissionRunnerOptions) {}

  async execute(request: MissionRequest): Promise<MissionResult> {
    let task: Task = {
      id: request.taskId,
      projectId: request.project.id,
      prompt: request.prompt,
      status: "queued",
      risk: "low",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const persist = async () => {
      if (this.options.tasks) await this.options.tasks.upsert(task);
    };

    task = status(task, "planning");
    await persist();

    const agentPrompt = [
      "Execute this AI DevOS mission inside the provided project workspace.",
      "Do not claim completion without verification evidence.",
      `Project: ${request.project.name}`,
      `Workspace: ${request.project.rootPath}`,
      "",
      request.prompt,
      "",
      "Inspect before changing files. Use the workspace tools for all changes.",
    ].join("\n");

    task = status(task, "executing");
    await persist();
    const result = await this.options.runAgent(agentPrompt);

    task = status(task, "testing");
    await persist();

    const commands = request.verificationCommands ?? [];
    let evidence: Evidence[] = [];
    let recoveryAttempts = 0;
    let repairOutputs: string[] = [];

    if (commands.length > 0) {
      const recovery = new RecoveryEngine({
        executor: this.options.executor,
        maxAttempts: request.maxRecoveryAttempts ?? 3,
        repair: async (failed, attempt) => {
          const failureContext = failed.map((item) => `${item.title}: ${item.summary}`).join("\n");
          const repair = await this.options.runAgent([
            `Verification failed on recovery attempt ${attempt}.`,
            "Diagnose the failure and make the smallest safe fix.",
            "Do not bypass execution policy.",
            "",
            failureContext,
          ].join("\n"));
          return repair.finalOutput ?? "Agent applied a recovery attempt.";
        },
      });

      const recovered = await recovery.verifyAndRecover(request.taskId, request.project.rootPath, commands);
      evidence = recovered.evidence;
      recoveryAttempts = recovered.attempts;
      repairOutputs = recovered.repairOutputs;
    }

    task = status(task, "verifying");
    await persist();

    const report = buildVerificationReport(request.taskId, evidence);
    task = status(task, report.verified ? "completed" : "failed");
    await persist();

    await this.options.memory.add({
      id: `${request.taskId}-mission`,
      projectId: request.project.id,
      category: report.verified ? "lesson" : "bug",
      content: report.verified
        ? `Mission verified after ${recoveryAttempts || 1} verification attempt(s).`
        : `Mission failed verification after ${recoveryAttempts || 1} attempt(s).`,
      createdAt: new Date().toISOString(),
      sourceTaskId: request.taskId,
    });

    return {
      task,
      report,
      agentOutput: result.finalOutput,
      recoveryAttempts,
      repairOutputs,
    };
  }
}
