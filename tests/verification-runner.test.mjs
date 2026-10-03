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


test("nested project inside a Git repository is not treated as a Git project root", async () => {
  const { EvidenceStore } = await import("../dist/evidence-store.js");
  const { VerificationRunner } = await import("../dist/verification-runner.js");
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const root = await fs.mkdtemp(os.tmpdir() + "/evidence-nested-git-");
  const projectRoot = root + "/project";
  await fs.mkdir(projectRoot);
  await promisify(execFile)("git", ["init", root]);
  const project = { id: "p", name: "Nested", rootPath: projectRoot };
  const store = new EvidenceStore(root + "/data");
  const runner = new VerificationRunner(store);
  const items = await runner.verifyGit(project, "wf-1");
  assert.equal(items[0].status, "not_applicable");
  assert.equal(items[1].status, "not_applicable");
});


test("verification report uses the latest result when a workflow retries the same check", async () => {
  const { buildVerificationReport } = await import("../dist/verification.js");
  const evidence = [
    { id: "failed", kind: "test", title: "npm run test", passed: false, status: "failed", command: "npm run test" },
    { id: "passed", kind: "test", title: "npm run test", passed: true, status: "passed", command: "npm run test" },
    { id: "na", kind: "git", title: "Git status", passed: false, status: "not_applicable", command: "git status --short --branch" },
  ];
  const report = buildVerificationReport("wf-retry-report", evidence);
  assert.equal(report.verified, true);
  assert.equal(report.requiredFailures, 0);
  assert.equal(report.evidence.length, 2);
  assert.equal(report.evidence.find((item) => item.kind === "test")?.status, "passed");
});
