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
  assert.equal((await store.list("p", "wf-1")).length, 1);
});
