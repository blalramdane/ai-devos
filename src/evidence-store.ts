import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Evidence } from "./domain.js";

export class EvidenceStore {
  constructor(private readonly rootDir: string) {}

  private file(projectId: string, workflowId: string) {
    return join(this.rootDir, projectId, "workflows", workflowId, "evidence.json");
  }

  async list(projectId: string, workflowId: string): Promise<Evidence[]> {
    try {
      return JSON.parse(await readFile(this.file(projectId, workflowId), "utf8")) as Evidence[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async add(projectId: string, workflowId: string, evidence: Evidence) {
    const file = this.file(projectId, workflowId);
    await mkdir(join(this.rootDir, projectId, "workflows", workflowId), { recursive: true });
    const items = await this.list(projectId, workflowId);
    items.push(evidence);
    await writeFile(file, JSON.stringify(items, null, 2), "utf8");
    return evidence;
  }
}
