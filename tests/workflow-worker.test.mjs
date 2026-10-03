import test from "node:test";
import assert from "node:assert/strict";

test("workflow worker executes queued workflows and leaves paused workflows alone", async () => {
  const { WorkflowStore } = await import("../dist/workflows.js");
  const { EventStore } = await import("../dist/events.js");
  const { ApprovalStore } = await import("../dist/approvals.js");
  const { WorkflowWorker } = await import("../dist/workflow-worker.js");
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const root = await fs.mkdtemp(os.tmpdir() + "/worker-");
  const workflows = new WorkflowStore(root);
  const events = new EventStore(root);
  const approvals = new ApprovalStore(root);
  let started = 0;
  const runner = {
    async start(_project, workflow) { started += 1; return workflows.update(workflow.projectId, workflow.id, { status: "completed", currentStage: workflow.stages.length }); },
    async resume() { throw new Error("worker must not resume"); },
  };
  const queued = await workflows.create("p", "queued");
  const paused = await workflows.create("p", "paused");
  await workflows.update("p", paused.id, { status: "paused" });
  const worker = new WorkflowWorker(workflows, runner, async () => ({ id: "p", name: "P", rootPath: root }));
  const results = await worker.runOnce();
  assert.equal(started, 1);
  assert.equal(results.length, 1);
  assert.equal(results[0].id, queued.id);
});
