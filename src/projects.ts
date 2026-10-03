import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Project } from "./domain.js";

export class ProjectRegistry {
  private readonly filePath: string;

  constructor(private readonly dataDir: string) {
    this.filePath = resolve(dataDir, "projects.json");
  }

  async list(): Promise<Project[]> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as Project[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async register(project: Project): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    const projects = await this.list();
    const existing = projects.findIndex((item) => item.id === project.id);
    if (existing >= 0) projects[existing] = project;
    else projects.push(project);
    await writeFile(this.filePath, JSON.stringify(projects, null, 2), "utf8");
  }

  async get(id: string): Promise<Project> {
    const project = (await this.list()).find((item) => item.id === id);
    if (!project) throw new Error(`Unknown project: ${id}`);
    return project;
  }
}
