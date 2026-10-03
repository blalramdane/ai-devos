import test from "node:test";
import assert from "node:assert/strict";

test("loads Experiential as a primary route", async () => {
  const { loadConfig } = await import("../dist/config.js");

  const config = loadConfig({
    AIDEVOS_PROVIDER: "experiential",
    EXPLABS_API_KEY: "xpl_test",
    AIDEVOS_MODEL: "qwen3.8-27b",
    AIDEVOS_ROUTE_TAGS: "research,cloud",
    AIDEVOS_DATA_DIR: ".aidevos",
    AIDEVOS_MAX_TURNS: "20",
  });

  assert.equal(config.primaryRoute.provider, "experiential");
  assert.equal(config.primaryRoute.baseUrl, "https://api.experientiallabs.ai/v1");
  assert.equal(config.primaryRoute.model, "qwen3.8-27b");
  assert.equal(config.primaryRoute.tags.join(","), "research,cloud");
});

test("parses ordered fallbacks and colon-containing model names", async () => {
  const { loadConfig } = await import("../dist/config.js");

  const config = loadConfig({
    AIDEVOS_PROVIDER: "ollama",
    AIDEVOS_FALLBACKS: "experiential:qwen3.8-27b,ollama:qwen3:4b",
    AIDEVOS_FALLBACK_1_TAGS: "research",
    AIDEVOS_FALLBACK_2_TAGS: "local",
  });

  assert.equal(config.fallbackRoutes[0].model, "qwen3.8-27b");
  assert.equal(config.fallbackRoutes[0].tags[0], "research");
  assert.equal(config.fallbackRoutes[1].model, "qwen3:4b");
});
