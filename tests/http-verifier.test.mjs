import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { rm } from "node:fs/promises";
import { EvidenceStore } from "../dist/evidence-store.js";
import { HttpVerifier } from "../dist/http-verifier.js";

test("http verifier records passing evidence for localhost", async () => {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("AI DevOS health ok");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const root = ".tmp-http-verifier";
  await rm(root, { recursive: true, force: true });
  const evidence = new EvidenceStore(root);
  const verifier = new HttpVerifier(evidence);
  const item = await verifier.verify(
    { id: "p", name: "fixture", rootPath: process.cwd() },
    "wf-http",
    `http://127.0.0.1:${address.port}`,
    { expectedStatus: 200, contains: "health ok" },
  );
  server.close();
  assert.equal(item.passed, true);
  assert.equal((await evidence.list("p", "wf-http")).length, 1);
  await rm(root, { recursive: true, force: true });
});

test("http verifier blocks external URLs unless explicitly allowed", async () => {
  const root = ".tmp-http-verifier-policy";
  await rm(root, { recursive: true, force: true });
  const verifier = new HttpVerifier(new EvidenceStore(root));
  await assert.rejects(
    () => verifier.verify({ id: "p", name: "fixture", rootPath: process.cwd() }, "wf-http", "https://example.com"),
    /External URL verification is blocked/,
  );
  await rm(root, { recursive: true, force: true });
});
