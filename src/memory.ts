import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface MemoryEntry {
  id: string;
  projectId: string;
  category: "context" | "decision" | "lesson" | "bug";
  content: string;
  createdAt: string;
  sourceTaskId?: string;
}

export class FileMemoryStore {
  constructor(private readonly rootDir: string) {}

  async add(entry: MemoryEntry): Promise<void> {
    const projectDir = join(this.rootDir, entry.projectId);
    await mkdir(projectDir, { recursive: true });
    const entries = await this.read(projectDir);
    entries.push(entry);
    await writeFile(join(projectDir, "memory.json"), JSON.stringify(entries, null, 2), "utf8");
  }

  async list(projectId: string): Promise<MemoryEntry[]> {
    return this.read(join(this.rootDir, projectId));
  }

  private async read(projectDir: string): Promise<MemoryEntry[]> {
    try {
      const raw = await readFile(join(projectDir, "memory.json"), "utf8");
      return JSON.parse(raw) as MemoryEntry[];
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return [];
      throw error;
    }
  }
}
