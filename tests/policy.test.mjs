import test from "node:test";
import assert from "node:assert/strict";

const { classifyCommand } = await import("../dist/policy.js");

test("safe command is low risk", () => {
  assert.equal(classifyCommand("npm test"), "low");
});

test("external command is high risk", () => {
  assert.equal(classifyCommand("git push origin main"), "high");
});

test("destructive command is critical", () => {
  assert.equal(classifyCommand("rm -rf ./tmp"), "critical");
});
