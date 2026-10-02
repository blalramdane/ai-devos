# ADR-001: Runtime Stack

## Status
Accepted

## Context

AI DevOS must execute real software-engineering missions while remaining local-first, provider-agnostic, testable, and safe.

## Decision

Use TypeScript/Node.js for the control plane, OpenAI Agents SDK as the initial agent-loop primitive, Docker as the default execution sandbox, Playwright for browser verification, a provider interface compatible with LiteLLM/OpenAI-compatible APIs, Ollama as a local provider, and structured project memory before adding a vector database.

## Consequences

Positive:
- Fast path to a real agent loop.
- Strong TypeScript integration.
- Local execution remains possible.
- Multiple model providers remain possible.
- Browser verification is first-class.
- Core tests can run without a specific model.

Trade-offs:
- Docker becomes a local prerequisite for autonomous missions.
- Provider routing adds a service when LiteLLM is enabled.
- External runtimes must be versioned and tested.

## Non-goals

We are not building a replacement for VS Code, a new LLM, a new container runtime, a vector database, or a browser engine.
