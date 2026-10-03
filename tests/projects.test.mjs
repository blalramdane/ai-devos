import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";

test("project registry persists projects", async () => {
  const { ProjectRegistry } = await import("../dist/projects.js");
  const root = await mkdtemp(tmpdir() + "/aidevos-registry-");
  const registry = new ProjectRegistry(root);

  await registry.register({
    id: "demo",
    name: "Demo",
    rootPath: root,
    description: "Test project",
  });

  const projects = await registry.list();
  assert.equal(projects.length, 1);
  assert.equal(projects[0].id, "demo");
  assert.match(await readFile(root + "/projects.json", "utf8"), /Demo/);
});
