import test from "node:test";
import assert from "node:assert/strict";

test("recovery retries failed verification and stops after success", async () => {
  const { RecoveryEngine } = await import("../dist/recovery.js");
  let runs = 0;
  let repairs = 0;

  const engine = new RecoveryEngine({
    executor: {
      async run(command, cwd) {
        runs++;
        const passed = runs >= 2;
        return {
          command, cwd,
          stdout: passed ? "ok" : "",
          stderr: passed ? "" : "failure",
          exitCode: passed ? 0 : 1,
          timedOut: false,
          blocked: false,
          sandboxed: true
        };
      }
    },
    repair: async () => {
      repairs++;
      return "repair applied";
    },
    maxAttempts: 3
  });

  const result = await engine.verifyAndRecover("t1", "/workspace", ["npm test"]);
  assert.equal(result.verified, true);
  assert.equal(result.attempts, 2);
  assert.equal(result.evidence.length, 2);
  assert.equal(repairs, 1);
});
