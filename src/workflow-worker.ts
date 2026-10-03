import type { Project } from "./domain.js";
import { WorkflowRunner } from "./workflow-runner.js";
import { WorkflowStore, type WorkflowRun } from "./workflows.js";

export interface WorkflowWorkerOptions {
  pollMs?: number;
  idleSleepMs?: number;
}

export type ProjectResolver = (projectId: string) => Promise<Project>;

export class WorkflowWorker {
  private readonly pollMs: number;
  private running = false;

  constructor(
    private readonly workflows: WorkflowStore,
    private readonly runner: WorkflowRunner,
    private readonly resolveProject: ProjectResolver,
    options: WorkflowWorkerOptions = {},
  ) {
    this.pollMs = options.pollMs ?? 1000;
  }

  async tick(): Promise<WorkflowRun[]> {
    const processed: WorkflowRun[] = [];
    const projectIds = await this.projectIds();
    for (const projectId of projectIds) {
      const items = await this.workflows.list(projectId);
      for (const workflow of items) {
        if (workflow.status !== "queued" && workflow.status !== "paused" && workflow.status !== "failed") continue;
        const project = await this.resolveProject(projectId);
        try {
          const result = workflow.status === "queued"
            ? await this.runner.start(project, workflow)
            : await this.runner.resume(project, workflow.id);
          processed.push(result);
        } catch {
          // Approval waits and transient failures remain persisted for the next tick.
        }
      }
    }
    return processed;
  }

  async runOnce() {
    return this.tick();
  }

  async start() {
    if (this.running) return;
    this.running = true;
    while (this.running) {
      await this.tick();
      await new Promise((resolve) => setTimeout(resolve, this.pollMs));
    }
  }

  stop() {
    this.running = false;
  }

  private async projectIds(): Promise<string[]> {
    // The workflow store is intentionally local; projects are discovered from its persisted workflow files.
    return this.workflows.projects();
  }
}
