import test from "node:test";
import assert from "node:assert/strict";

test("verification runner persists passing test evidence", async () => {
  const { EvidenceStore } = await import("../dist/evidence-store.js");
  const { VerificationRunner } = await import("../dist/verification-runner.js");
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const root = await fs.mkdtemp(os.tmpdir() + "/evidence-");
  await fs.writeFile(root + "/package.json", JSON.stringify({ scripts: { check: "node -e \"process.exit(0)\"" } }));
  const project = { id: "p", name: "Test", rootPath: root };
  const store = new EvidenceStore(root);
  const runner = new VerificationRunner(store);
  const items = await runner.runTests(project, "wf-1");
  assert.equal(items.length, 1);
  assert.equal(items[0].passed, true);
  assert.equal(items[0].status, "passed");
  assert.equal((await store.list("p", "wf-1")).length, 1);
});

test("non-git projects mark git evidence as not applicable", async () => {
  const { EvidenceStore } = await import("../dist/evidence-store.js");
  const { VerificationRunner } = await import("../dist/verification-runner.js");
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const root = await fs.mkdtemp(os.tmpdir() + "/evidence-git-");
  const project = { id: "p", name: "Test", rootPath: root };
  const store = new EvidenceStore(root);
  const runner = new VerificationRunner(store);
  const items = await runner.verifyGit(project, "wf-1");
  assert.equal(items.length, 2);
  assert.equal(items[0].status, "not_applicable");
  assert.equal(items[1].status, "not_applicable");
  assert.equal(items[0].passed, false);
  assert.equal(items[1].passed, false);
  const report = await runner.report("p", "wf-1");
  assert.equal(report.verified, false);
  assert.equal(report.notApplicable, 2);
  assert.equal(report.requiredFailures, 0);
});

test("verification report ignores not-applicable evidence but requires applicable evidence", async () => {
  const { buildVerificationReport } = await import("../dist/verification.js");
  const report = buildVerificationReport("wf-1", [
    { id: "na", kind: "git", title: "Git", passed: false, status: "not_applicable", summary: "n/a" },
    { id: "ok", kind: "test", title: "Test", passed: true, status: "passed", summary: "ok" },
  ]);
  assert.equal(report.verified, true);
  assert.equal(report.requiredFailures, 0);
  assert.equal(report.notApplicable, 1);
});
