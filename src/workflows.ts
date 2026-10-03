import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type WorkflowStatus = "queued" | "running" | "waiting_approval" | "paused" | "completed" | "failed";
export type StageStatus = "queued" | "running" | "completed" | "failed" | "skipped";

export interface WorkflowStage {
  id: string;
  name: string;
  status: StageStatus;
  attempts: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  checkpoint?: string;
}

export interface WorkflowRun {
  id: string;
  projectId: string;
  mission: string;
  status: WorkflowStatus;
  currentStage: number;
  stages: WorkflowStage[];
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

export const DEFAULT_WORKFLOW_STAGES = [
  ["understand", "Understand context"],
  ["plan", "Plan execution"],
  ["execute", "Execute changes"],
  ["test", "Run tests"],
  ["verify", "Verify evidence"],
  ["finalize", "Persist and summarize"],
] as const;

export class WorkflowStore {
  constructor(private readonly rootDir: string) {}
  private file(projectId: string) { return join(this.rootDir, projectId, "workflows.json"); }

  async list(projectId: string): Promise<WorkflowRun[]> {
    try { return JSON.parse(await readFile(this.file(projectId), "utf8")) as WorkflowRun[]; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async projects(): Promise<string[]> {
    const { readdir } = await import("node:fs/promises");
    try { return await readdir(this.rootDir); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  }

  async get(projectId: string, workflowId: string) {
    const item = (await this.list(projectId)).find((workflow) => workflow.id === workflowId);
    if (!item) throw new Error("Unknown workflow: " + workflowId);
    return item;
  }

  async create(projectId: string, mission: string, stages = DEFAULT_WORKFLOW_STAGES) {
    const now = new Date().toISOString();
    const workflow: WorkflowRun = {
      id: "wf-" + Date.now().toString(36),
      projectId,
      mission,
      status: "queued",
      currentStage: 0,
      stages: stages.map(([id, name]) => ({ id, name, status: "queued", attempts: 0 })),
      createdAt: now,
      updatedAt: now,
    };
    await this.save(projectId, [...await this.list(projectId), workflow]);
    return workflow;
  }

  async update(projectId: string, workflowId: string, patch: Partial<WorkflowRun>) {
    const items = await this.list(projectId);
    const index = items.findIndex((workflow) => workflow.id === workflowId);
    if (index < 0) throw new Error("Unknown workflow: " + workflowId);
    items[index] = { ...items[index], ...patch, updatedAt: new Date().toISOString() };
    await this.save(projectId, items);
    return items[index];
  }

  private async save(projectId: string, items: WorkflowRun[]) {
    await mkdir(join(this.rootDir, projectId), { recursive: true });
    await writeFile(this.file(projectId), JSON.stringify(items, null, 2), "utf8");
  }
}
