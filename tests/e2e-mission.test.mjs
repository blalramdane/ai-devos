import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";

test("E2E mission pipeline emits lifecycle and verification evidence", async () => {
  const { MissionRunner } = await import("../dist/mission.js");
  const { FileMemoryStore } = await import("../dist/memory.js");

  const workspace = await mkdtemp(tmpdir() + "/aidevos-e2e-");
  const events = [];
  const executor = {
    async run(command, cwd) {
      return {
        command, cwd, stdout: "fixture-ok", stderr: "", exitCode: 0,
        timedOut: false, blocked: false, sandboxed: true
      };
    }
  };

  const result = await new MissionRunner({
    runAgent: async () => ({ finalOutput: "Fixture agent completed." }),
    executor,
    memory: new FileMemoryStore(workspace),
    onEvent: async (event) => events.push(event),
  }).execute({
    taskId: "e2e-1",
    project: { id: "fixture", name: "E2E Fixture", rootPath: workspace },
    prompt: "Inspect the fixture and verify it.",
    verificationCommands: ["node --version"],
  });

  assert.equal(result.task.status, "completed");
  assert.equal(result.report.verified, true);
  assert.ok(events.some((event) => event.type === "status" && event.message === "planning"));
  assert.ok(events.some((event) => event.type === "status" && event.message === "executing"));
  assert.ok(events.some((event) => event.type === "verification" && event.data?.passed === true));
  assert.ok(events.some((event) => event.type === "status" && event.data?.verified === true));

  const memory = await new FileMemoryStore(workspace).list("fixture");
  assert.equal(memory[0].category, "lesson");
});
