# AI DevOS Tooling Strategy

## Adopted

### OpenAI Agents SDK
Initial agent-loop primitive for TypeScript. AI DevOS retains ownership of project state, policies, memory, evidence, and orchestration.

### Docker
Default sandbox for autonomous code execution. Host execution is reserved for explicitly approved operations.

### Playwright
Browser E2E verification, assertions, screenshots, traces, and future agent browser workflows.

### LiteLLM
Optional model gateway providing one OpenAI-compatible surface across providers, routing, retries/fallbacks, budgets, and MCP access control.

### Ollama
Supported local model provider. Model choice stays configurable; no single local model is hard-coded.

## Deferred

### Qdrant
Not required for V1. Start with structured project memory and local full-text indexing. Qdrant remains a future hybrid semantic/lexical retrieval option.

### Langfuse
Add during observability phase. It can self-host and provides traces for generations, agents, tools, retrieval, and evaluation. AI DevOS should expose an OpenTelemetry-compatible event contract so observability stays replaceable.

### OpenHands
Use as a reference/integration target, not as the control-plane foundation. OpenHands already provides agent servers, tools, and Docker workspaces, while AI DevOS needs its own memory, policy, project, and evidence layers.

## Model strategy

AI DevOS uses a ModelRouter:

AI DevOS -> ModelRouter -> OpenAI / Anthropic / Gemini / Ollama / OpenAI-compatible gateways

Routing is task-aware:
- planning
- coding
- debugging
- summarization
- cheap classification
- browser reasoning

Projects and missions can override the default route.

## V1 stack

- TypeScript / Node.js
- OpenAI Agents SDK
- Docker
- Playwright
- LiteLLM-compatible provider interface
- Ollama-compatible provider
- structured project memory
- OpenTelemetry-compatible telemetry contract
