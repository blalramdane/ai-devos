import { mkdir, open, unlink } from "node:fs/promises";
import { join } from "node:path";

export class WorkflowLock {
  constructor(private readonly rootDir: string) {}

  async acquire(workflowId: string): Promise<() => Promise<void>> {
    const dir = join(this.rootDir, "locks");
    await mkdir(dir, { recursive: true });
    const path = join(dir, workflowId + ".lock");
    try {
      const handle = await open(path, "wx");
      await handle.writeFile(String(process.pid));
      await handle.close();
    } catch {
      throw new Error("Workflow is already locked: " + workflowId);
    }
    return async () => {
      try { await unlink(path); } catch { /* lock already removed */ }
    };
  }
}
