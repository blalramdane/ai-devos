import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Project, Task } from "./domain.js";

export class JsonStore<T extends { id: string }> {
  constructor(private readonly filePath: string) {}

  async list(): Promise<T[]> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as T[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async get(id: string): Promise<T | undefined> {
    return (await this.list()).find((item) => item.id === id);
  }

  async upsert(value: T): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const items = await this.list();
    const index = items.findIndex((item) => item.id === value.id);
    if (index === -1) items.push(value);
    else items[index] = value;
    await writeFile(this.filePath, JSON.stringify(items, null, 2), "utf8");
  }
}

export class ProjectRegistry {
  private readonly store: JsonStore<Project>;

  constructor(dataDir: string) {
    this.store = new JsonStore<Project>(join(dataDir, "projects.json"));
  }

  list(): Promise<Project[]> {
    return this.store.list();
  }

  get(id: string): Promise<Project | undefined> {
    return this.store.get(id);
  }

  upsert(project: Project): Promise<void> {
    return this.store.upsert(project);
  }
}

export class TaskStore {
  private readonly store: JsonStore<Task>;

  constructor(dataDir: string) {
    this.store = new JsonStore<Task>(join(dataDir, "tasks.json"));
  }

  list(): Promise<Task[]> {
    return this.store.list();
  }

  get(id: string): Promise<Task | undefined> {
    return this.store.get(id);
  }

  upsert(task: Task): Promise<void> {
    return this.store.upsert(task);
  }
}
