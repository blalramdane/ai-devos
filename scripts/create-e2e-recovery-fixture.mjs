import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const target = resolve(process.argv[2] ?? ".aidevos-e2e-recovery");
await mkdir(target, { recursive: true });
await writeFile(resolve(target, "package.json"), JSON.stringify({ name: "aidevos-e2e-recovery", version: "1.0.0", scripts: { test: "node test.js" } }, null, 2) + "\n");
await writeFile(resolve(target, "test.js"), [
  'const message = "BROKEN";',
  'if (message !== "AIDEVOS_TEST_OK") {',
  '  throw new Error("Expected AIDEVOS_TEST_OK but received " + message);',
  '}',
  'console.log(message);',
  '',
].join("\n"));
await writeFile(resolve(target, "README.md"), "# AI DevOS Recovery Fixture\n\nThis project intentionally starts with a failing test. The AI DevOS workflow should discover the failure during its test stage, inspect the evidence, fix the smallest safe issue, retry the test, and verify the result.\n");
console.log(target);