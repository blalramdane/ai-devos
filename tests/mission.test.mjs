import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

test("mission becomes verified when verification commands pass", async () => {
  const { MissionRunner } = await import("../dist/mission.js");
  const { FileMemoryStore } = await import("../dist/memory.js");

  const root = await mkdtemp(tmpdir() + "/aidevos-mission-");
  const calls = [];
  const executor = {
    async run(command, cwd) {
      calls.push({ command, cwd });
      return {
        command,
        cwd,
        stdout: "verification-ok",
        stderr: "",
        exitCode: 0,
        timedOut: false,
        blocked: false,
        sandboxed: true
      };
    }
  };

  const runner = new MissionRunner({
    runAgent: async (prompt) => ({ finalOutput: `agent completed: ${prompt.slice(0, 20)}` }),
    executor,
    memory: new FileMemoryStore(root)
  });

  const result = await runner.execute({
    taskId: "task-1",
    project: { id: "demo", name: "Demo", rootPath: root },
    prompt: "Implement the feature.",
    verificationCommands: ["node --version"]
  });

  assert.equal(result.task.status, "completed");
  assert.equal(result.report.verified, true);
  assert.equal(result.report.evidence.length, 1);
  assert.equal(calls.length, 1);
  assert.match(result.agentOutput, /agent completed/);

  const memory = await new FileMemoryStore(root).list("demo");
  assert.equal(memory.length, 1);
  assert.equal(memory[0].category, "lesson");
});

test("mission fails verification when a check fails", async () => {
  const { MissionRunner } = await import("../dist/mission.js");
  const { FileMemoryStore } = await import("../dist/memory.js");

  const root = await mkdtemp(tmpdir() + "/aidevos-mission-fail-");
  const executor = {
    async run(command, cwd) {
      return {
        command,
        cwd,
        stdout: "",
        stderr: "test failed",
        exitCode: 1,
        timedOut: false,
        blocked: false,
        sandboxed: true
      };
    }
  };

  const result = await new MissionRunner({
    runAgent: async () => ({ finalOutput: "implemented" }),
    executor,
    memory: new FileMemoryStore(root)
  }).execute({
    taskId: "task-2",
    project: { id: "demo", name: "Demo", rootPath: root },
    prompt: "Implement the feature.",
    verificationCommands: ["npm test"]
  });

  assert.equal(result.task.status, "failed");
  assert.equal(result.report.verified, false);
});
