import test from "node:test";
import assert from "node:assert/strict";

test("prefers a route whose tags match the mission", async () => {
  const { ModelRouter } = await import("../dist/model-router.js");

  const router = new ModelRouter([
    {
      id: "local",
      provider: "ollama",
      baseUrl: "http://127.0.0.1:11434/v1",
      apiKey: "ollama",
      model: "qwen3:4b",
      priority: 1,
      tags: ["local", "offline"],
    },
    {
      id: "cloud",
      provider: "experiential",
      baseUrl: "https://api.experientiallabs.ai/v1",
      apiKey: "test",
      model: "qwen3.8-27b",
      priority: 2,
      tags: ["research", "cloud"],
    },
  ]);

  assert.equal(router.primary("Research and verify the latest documentation").id, "cloud");
  assert.equal(router.primary("Run the tests locally and fix the bug").id, "local");
});

test("keeps priority as the tie breaker", async () => {
  const { ModelRouter } = await import("../dist/model-router.js");

  const router = new ModelRouter([
    {
      id: "first",
      provider: "ollama",
      baseUrl: "http://127.0.0.1:11434/v1",
      apiKey: "ollama",
      model: "qwen3:4b",
      priority: 1,
      tags: [],
    },
    {
      id: "second",
      provider: "experiential",
      baseUrl: "https://api.experientiallabs.ai/v1",
      apiKey: "test",
      model: "qwen3.8-27b",
      priority: 2,
      tags: [],
    },
  ]);

  assert.equal(router.primary("Do the task").id, "first");
});
