import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

test("persists project memory", async () => {
  const { FileMemoryStore } = await import("../dist/memory.js");
  const root = await mkdtemp(tmpdir() + "/aidevos-memory-");
  const store = new FileMemoryStore(root);

  await store.add({
    id: "m1",
    projectId: "demo",
    category: "lesson",
    content: "Run verification before completion.",
    createdAt: new Date().toISOString()
  });

  const entries = await store.list("demo");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].content, "Run verification before completion.");
});
