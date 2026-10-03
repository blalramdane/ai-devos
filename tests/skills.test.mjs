import test from "node:test";
import assert from "node:assert/strict";

test("routes engineering tasks to engineering", async () => {
  const { routeSkills } = await import("../dist/skills.js");
  const names = routeSkills("Fix the API bug and run tests").map((skill) => skill.name);
  assert.ok(names.includes("engineering"));
});

test("routes research tasks to research", async () => {
  const { routeSkills } = await import("../dist/skills.js");
  const names = routeSkills("Research and verify the latest official documentation").map((skill) => skill.name);
  assert.ok(names.includes("research"));
});
