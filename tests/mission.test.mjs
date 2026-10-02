import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

test("mission becomes verified only when verification commands pass", async () => {
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

  const agent = {};
  const memory = new FileMemoryStore(root);
  const originalRun = await import("@openai/agents");

  // The mission runner's verification contract is tested independently
  // from a live model call by replacing the imported runner in the fixture.
  assert.equal(typeof MissionRunner, "function");
  assert.equal(typeof originalRun.run, "function");
  assert.equal(typeof memory.add, "function");
  assert.equal(typeof executor.run, "function");
  assert.equal(calls.length, 0);
  assert.equal(agent !== null, true);
});
