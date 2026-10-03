import test from "node:test";
import assert from "node:assert/strict";

test("workflow engine checkpoints stages and persists completion", async () => {
  const { WorkflowStore } = await import("../dist/workflows.js");
  const { EventStore } = await import("../dist/events.js");
  const { ApprovalStore } = await import("../dist/approvals.js");
  const { WorkflowRunner } = await import("../dist/workflow-runner.js");
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const root = await fs.mkdtemp(os.tmpdir() + "/wf-");
  const project = { id: "p", name: "Test", rootPath: root };
  const workflows = new WorkflowStore(root);
  const events = new EventStore(root);
  const approvals = new ApprovalStore(root);
  const calls = [];
  const runner = new WorkflowRunner(workflows, events, approvals, {
    handlers: {
      one: async () => { calls.push("one"); return "checkpoint-1"; },
      two: async () => { calls.push("two"); return "checkpoint-2"; },
    },
  });
  const workflow = await workflows.create("p", "ship feature", [["one","One"],["two","Two"]]);
  const result = await runner.start(project, workflow);
  assert.equal(result.status, "completed");
  assert.deepEqual(calls, ["one","two"]);
  assert.equal(result.stages[0].checkpoint, "checkpoint-1");
  assert.equal((await events.list("p", workflow.id)).filter((e) => e.type === "workflow.stage.completed").length, 2);
});

test("workflow retries a failed stage and resumes from its checkpoint", async () => {
  const { WorkflowStore } = await import("../dist/workflows.js");
  const { EventStore } = await import("../dist/events.js");
  const { ApprovalStore } = await import("../dist/approvals.js");
  const { WorkflowRunner } = await import("../dist/workflow-runner.js");
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const root = await fs.mkdtemp(os.tmpdir() + "/wf-retry-");
  const project = { id: "p", name: "Test", rootPath: root };
  const workflows = new WorkflowStore(root);
  const events = new EventStore(root);
  const approvals = new ApprovalStore(root);
  let attempts = 0;
  const runner = new WorkflowRunner(workflows, events, approvals, {
    maxAttempts: 2,
    handlers: {
      one: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("transient");
        return "ok";
      },
      two: async () => "done",
    },
  });
  const workflow = await workflows.create("p", "recover", [["one","One"],["two","Two"]]);
  const result = await runner.start(project, workflow);
  assert.equal(result.status, "completed");
  assert.equal(result.stages[0].attempts, 2);
  assert.equal(result.currentStage, 2);
});

test("approval requests pause a workflow until explicitly approved", async () => {
  const { WorkflowStore } = await import("../dist/workflows.js");
  const { EventStore } = await import("../dist/events.js");
  const { ApprovalStore } = await import("../dist/approvals.js");
  const { WorkflowRunner } = await import("../dist/workflow-runner.js");
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const root = await fs.mkdtemp(os.tmpdir() + "/wf-approval-");
  const project = { id: "p", name: "Test", rootPath: root };
  const workflows = new WorkflowStore(root);
  const events = new EventStore(root);
  const approvals = new ApprovalStore(root);
  const runner = new WorkflowRunner(workflows, events, approvals, { handlers: {} });
  const workflow = await workflows.create("p", "deploy", [["one","One"]]);
  const approval = await runner.requestApproval(project, workflow.id, "external deployment", "high");
  assert.equal(approval.status, "pending");
  assert.equal((await workflows.get("p", workflow.id)).status, "waiting_approval");
  assert.equal((await events.list("p", workflow.id)).at(-1).type, "workflow.approval.requested");
  await approvals.update("p", approval.id, "approved");
  assert.equal((await approvals.list("p"))[0].status, "approved");
});


test("workflow recovery handler fixes a failed stage before retry", async () => {
  const { WorkflowStore } = await import("../dist/workflows.js");
  const { EventStore } = await import("../dist/events.js");
  const { ApprovalStore } = await import("../dist/approvals.js");
  const { WorkflowRunner } = await import("../dist/workflow-runner.js");
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const root = await fs.mkdtemp(os.tmpdir() + "/wf-recovery-");
  const project = { id: "p", name: "Test", rootPath: root };
  const workflows = new WorkflowStore(root);
  const events = new EventStore(root);
  const approvals = new ApprovalStore(root);
  let fixed = false;
  const runner = new WorkflowRunner(workflows, events, approvals, {
    maxAttempts: 2,
    handlers: {
      verify: async () => {
        if (!fixed) throw new Error("verification failed");
        return "verified";
      },
    },
    recoveryHandlers: {
      verify: async ({ stage }) => {
        assert.equal(stage.error, "verification failed");
        fixed = true;
        return "fix-applied";
      },
    },
  });
  const workflow = await workflows.create("p", "recover verification", [["verify","Verify"]]);
  const result = await runner.start(project, workflow);
  assert.equal(result.status, "completed");
  assert.equal(result.stages[0].attempts, 2);
  assert.equal((await events.list("p", workflow.id)).some((e) => e.type === "workflow.recovery.completed"), true);
});


test("workflow recovery can fix a failed test stage before retry", async () => {
  const { WorkflowStore } = await import("../dist/workflows.js");
  const { EventStore } = await import("../dist/events.js");
  const { ApprovalStore } = await import("../dist/approvals.js");
  const { WorkflowRunner } = await import("../dist/workflow-runner.js");
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const root = await fs.mkdtemp(os.tmpdir() + "/wf-test-recovery-");
  const project = { id: "p", name: "Test", rootPath: root };
  const workflows = new WorkflowStore(root);
  const events = new EventStore(root);
  const approvals = new ApprovalStore(root);
  let fixed = false;
  const runner = new WorkflowRunner(workflows, events, approvals, {
    maxAttempts: 2,
    handlers: {
      test: async () => {
        if (!fixed) throw new Error("test failed: expected AIDEVOS_TEST_OK");
        return "test-passed";
      },
    },
    recoveryHandlers: {
      test: async ({ stage }) => {
        assert.equal(stage.error, "test failed: expected AIDEVOS_TEST_OK");
        fixed = true;
        return "test-fixture-fixed";
      },
    },
  });
  const workflow = await workflows.create("p", "recover test", [["test","Run tests"]]);
  const result = await runner.start(project, workflow);
  assert.equal(result.status, "completed");
  assert.equal(result.stages[0].attempts, 2);
  const eventTypes = (await events.list("p", workflow.id)).map((event) => event.type);
  assert.equal(eventTypes.includes("workflow.recovery.started"), true);
  assert.equal(eventTypes.includes("workflow.recovery.completed"), true);
  assert.equal(eventTypes.includes("workflow.completed"), true);
});

test("workflow fails permanently when recovery itself fails", async () => {
  const { WorkflowStore } = await import("../dist/workflows.js");
  const { EventStore } = await import("../dist/events.js");
  const { ApprovalStore } = await import("../dist/approvals.js");
  const { WorkflowRunner } = await import("../dist/workflow-runner.js");
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const root = await fs.mkdtemp(os.tmpdir() + "/wf-recovery-fail-");
  const project = { id: "p", name: "Test", rootPath: root };
  const workflows = new WorkflowStore(root);
  const events = new EventStore(root);
  const approvals = new ApprovalStore(root);
  const runner = new WorkflowRunner(workflows, events, approvals, {
    maxAttempts: 2,
    handlers: {
      verify: async () => { throw new Error("verification failed"); },
    },
    recoveryHandlers: {
      verify: async () => { throw new Error("recovery could not fix verification"); },
    },
  });
  const workflow = await workflows.create("p", "unrecoverable verification", [["verify","Verify"]]);
  const result = await runner.start(project, workflow);
  assert.equal(result.status, "failed");
  assert.equal(result.lastError, "recovery could not fix verification");
  const eventTypes = (await events.list("p", workflow.id)).map((event) => event.type);
  assert.equal(eventTypes.includes("workflow.recovery.started"), true);
  assert.equal(eventTypes.includes("workflow.recovery.failed"), true);
  assert.equal(eventTypes.includes("workflow.completed"), false);
});
