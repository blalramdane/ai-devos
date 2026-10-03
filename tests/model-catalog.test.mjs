import test from "node:test";
import assert from "node:assert/strict";

test("normalizes model capability fields", async () => {
  const { normalizeModelCatalogEntry } = await import("../dist/model-catalog.js");

  const model = normalizeModelCatalogEntry({
    id: "demo",
    display_name: "Demo",
    context_window: 128000,
    max_output_tokens: 8192,
    supported_params: { tools: true, reasoning: true },
  });

  assert.equal(model.id, "demo");
  assert.equal(model.contextWindow, 128000);
  assert.equal(model.maxOutputTokens, 8192);
  assert.equal(model.supportsTools, true);
  assert.equal(model.supportsReasoning, true);
});

test("router can exclude an Experiential model that does not support tools", async () => {
  const { ModelRouter } = await import("../dist/model-router.js");

  const router = new ModelRouter(
    [
      {
        id: "bad",
        provider: "experiential",
        baseUrl: "https://api.experientiallabs.ai/v1",
        apiKey: "test",
        model: "no-tools",
        priority: 1,
        tags: ["engineering"],
      },
      {
        id: "good",
        provider: "experiential",
        baseUrl: "https://api.experientiallabs.ai/v1",
        apiKey: "test",
        model: "tools-model",
        priority: 2,
        tags: ["engineering"],
      },
    ],
    [
      { id: "no-tools", supportsTools: false, raw: {} },
      { id: "tools-model", supportsTools: true, raw: {} },
    ],
  );

  assert.equal(router.primary("Fix the API bug").model, "tools-model");
});
