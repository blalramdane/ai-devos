import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RiskLevel } from "./domain.js";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalRequest {
  id: string;
  workflowId: string;
  projectId: string;
  reason: string;
  risk: RiskLevel;
  status: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
}

export class ApprovalStore {
  constructor(private readonly rootDir: string) {}

  private file(projectId: string) { return join(this.rootDir, projectId, "approvals.json"); }

  async list(projectId: string): Promise<ApprovalRequest[]> {
    try { return JSON.parse(await readFile(this.file(projectId), "utf8")) as ApprovalRequest[]; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async create(input: Omit<ApprovalRequest, "id" | "createdAt" | "updatedAt" | "status">) {
    const now = new Date().toISOString();
    const item: ApprovalRequest = { ...input, id: "approval-" + Date.now().toString(36), status: "pending", createdAt: now, updatedAt: now };
    await this.save(input.projectId, [...await this.list(input.projectId), item]);
    return item;
  }

  async update(projectId: string, id: string, status: ApprovalStatus) {
    const items = await this.list(projectId);
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("Unknown approval: " + id);
    items[index] = { ...items[index], status, updatedAt: new Date().toISOString() };
    await this.save(projectId, items);
    return items[index];
  }

  async pendingForWorkflow(projectId: string, workflowId: string) {
    return (await this.list(projectId)).filter((item) => item.workflowId === workflowId && item.status === "pending");
  }

  private async save(projectId: string, items: ApprovalRequest[]) {
    await mkdir(join(this.rootDir, projectId), { recursive: true });
    await writeFile(this.file(projectId), JSON.stringify(items, null, 2), "utf8");
  }
}
