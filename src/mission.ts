import type { Evidence, Project, Task, TaskStatus, VerificationReport } from "./domain.js";
import { buildVerificationReport } from "./verification.js";
import type { SandboxExecutor } from "./sandbox/types.js";
import { FileMemoryStore } from "./memory.js";
import { run } from "@openai/agents";
import type { Agent } from "@openai/agents";

export interface MissionRequest {
  taskId: string;
  project: Project;
  prompt: string;
  verificationCommands?: string[];
}

export interface MissionResult {
  task: Task;
  report: VerificationReport;
  agentOutput?: string;
}

export interface MissionRunnerOptions {
  agent: Agent;
  executor: SandboxExecutor;
  memory: FileMemoryStore;
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

    task = status(task, "planning");

    const agentPrompt = [
      "Execute this AI DevOS mission inside the provided project workspace.",
      "Do not claim completion without verification evidence.",
      `Project: ${request.project.name}`,
      `Workspace: ${request.project.rootPath}`,
      "",
      request.prompt,
      "",
      "When implementation is complete, run the most relevant tests or checks available.",
    ].join("\n");

    task = status(task, "executing");
    const result = await run(this.options.agent, agentPrompt, { maxTurns: 30 });
    task = status(task, "testing");

    const evidence: Evidence[] = [];
    for (const command of request.verificationCommands ?? []) {
      const result = await this.options.executor.run(command, request.project.rootPath);
      evidence.push({
        id: `${request.taskId}-${evidence.length + 1}`,
        kind: "command",
        title: `Verification: ${command}`,
        passed: !result.blocked && result.exitCode === 0,
        summary: result.blocked
          ? "Blocked by execution policy."
          : result.exitCode === 0
            ? result.stdout.trim() || "Command completed successfully."
            : result.stderr.trim() || `Command exited with code ${result.exitCode}.`,
        command,
        exitCode: result.exitCode,
        metadata: { sandboxed: result.sandboxed, timedOut: result.timedOut },
      });
    }

    task = status(task, "verifying");
    const report = buildVerificationReport(request.taskId, evidence);

    task = status(task, report.verified ? "completed" : "failed");

    await this.options.memory.add({
      id: `${request.taskId}-mission`,
      projectId: request.project.id,
      category: report.verified ? "lesson" : "bug",
      content: report.verified
        ? `Mission verified. Evidence: ${evidence.map((item) => item.title).join(", ")}`
        : `Mission failed verification. Evidence: ${evidence.map((item) => item.summary).join(" | ")}`,
      createdAt: new Date().toISOString(),
      sourceTaskId: request.taskId,
    });

    return {
      task,
      report,
      agentOutput: result.finalOutput,
    };
  }
}
