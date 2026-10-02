import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

test("runs a safe command and returns evidence", async () => {
  const { runCommand } = await import("../dist/runner.js");
  const cwd = await mkdtemp(tmpdir() + "/aidevos-");
  const result = await runCommand("node -e \"console.log('aidevos-ok')\"", cwd);

  assert.equal(result.blocked, false);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /aidevos-ok/);
});

test("blocks risky command without approval", async () => {
  const { runCommand } = await import("../dist/runner.js");
  const cwd = await mkdtemp(tmpdir() + "/aidevos-");
  const result = await runCommand("git push origin main", cwd);

  assert.equal(result.blocked, true);
  assert.equal(result.exitCode, 126);
});
