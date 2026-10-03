import test from "node:test";
import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
import { ServiceRunner } from "../dist/service-runner.js";

test("service runner starts a local service and waits for readiness", async () => {
  const port = 18765;
  await writeFile("service-fixture.mjs", [
    'import { createServer } from "node:http";',
    'const server = createServer((_req,res)=>{res.writeHead(200,{"content-type":"text/plain"});res.end("ready");});',
    `server.listen(${port},"127.0.0.1");`,
  ].join("\n"));
  const runner = new ServiceRunner();
  const handle = await runner.start(
    { id:"p", name:"fixture", rootPath:process.cwd() },
    { command:"node service-fixture.mjs", readyUrl:\`http://127.0.0.1:\${port}\` },
  );
  assert.ok(handle.pid > 0);
  await handle.stop();
  await rm("service-fixture.mjs", { force:true });
});
