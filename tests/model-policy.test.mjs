import test from "node:test";
import assert from "node:assert/strict";

test("local privacy selects Ollama", async () => {
  const { resolveModelPolicy } = await import("../dist/model-policy.js");
  const result = resolveModelPolicy("Fix this private local bug", { mode:"strict", privacy:"local", budget:"standard" }, [
    { id:"cloud", provider:"experiential", baseUrl:"x", apiKey:"x", model:"cloud", priority:1, tags:["engineering"] },
    { id:"local", provider:"ollama", baseUrl:"x", apiKey:"x", model:"qwen3:4b", priority:2, tags:["local","engineering"] }
  ]);
  assert.equal(result.route.id, "local");
});

test("engineering rejects models without tools", async () => {
  const { resolveModelPolicy } = await import("../dist/model-policy.js");
  const result = resolveModelPolicy("Fix the API bug", { mode:"strict", privacy:"cloud-ok", budget:"standard" }, [
    { id:"no-tools", provider:"experiential", baseUrl:"x", apiKey:"x", model:"no-tools", priority:1, tags:["engineering"] },
    { id:"tools", provider:"experiential", baseUrl:"x", apiKey:"x", model:"tools", priority:2, tags:["engineering"] }
  ], [{ id:"no-tools", supportsTools:false, raw:{} }, { id:"tools", supportsTools:true, raw:{} }]);
  assert.equal(result.route.id, "tools");
});

test("strict context requirement rejects small models", async () => {
  const { resolveModelPolicy } = await import("../dist/model-policy.js");
  const result = resolveModelPolicy("Research this complex topic", { mode:"strict", privacy:"cloud-ok", budget:"standard", maxContext:100000 }, [
    { id:"small", provider:"experiential", baseUrl:"x", apiKey:"x", model:"small", priority:1, tags:["research"] },
    { id:"large", provider:"experiential", baseUrl:"x", apiKey:"x", model:"large", priority:2, tags:["research"] }
  ], [{ id:"small", contextWindow:32000, raw:{} }, { id:"large", contextWindow:128000, raw:{} }]);
  assert.equal(result.route.id, "large");
});
