import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export type DevOSEventType =
  | "workflow.created"
  | "workflow.started"
  | "workflow.stage.started"
  | "workflow.stage.completed"
  | "workflow.stage.failed"
  | "workflow.paused"
  | "workflow.approval.requested"
  | "workflow.approval.granted"
  | "workflow.resumed"
  | "workflow.completed"
  | "workflow.failed";

export interface DevOSEvent<T = Record<string, unknown>> {
  id: string;
  type: DevOSEventType;
  workflowId: string;
  projectId: string;
  timestamp: string;
  payload: T;
}

export class EventStore {
  constructor(private readonly rootDir: string) {}

  private file(projectId: string) {
    return join(this.rootDir, projectId, "events.jsonl");
  }

  async append<T extends Record<string, unknown>>(event: Omit<DevOSEvent<T>, "id" | "timestamp">) {
    const full: DevOSEvent<T> = {
      ...event,
      id: "evt-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
      timestamp: new Date().toISOString(),
    };
    await mkdir(join(this.rootDir, event.projectId), { recursive: true });
    await appendFile(this.file(event.projectId), JSON.stringify(full) + "\n", "utf8");
    return full;
  }

  async list(projectId: string, workflowId?: string): Promise<DevOSEvent[]> {
    try {
      const raw = await readFile(this.file(projectId), "utf8");
      return raw.split("\n").filter(Boolean).map((line) => JSON.parse(line) as DevOSEvent)
        .filter((event) => !workflowId || event.workflowId === workflowId);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}
