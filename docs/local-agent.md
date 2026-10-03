# AI DevOS Local Agent

## Purpose

AI DevOS is the local execution layer for the user's AI Operating System. It owns project context, tool access, safety policy, verification evidence, and task execution while keeping the model provider replaceable.

## Runtime

The V1 local agent uses the OpenAI Agents SDK for the agent loop and function tools. The model provider is configured through an OpenAI-compatible endpoint, which allows the same runtime to target local Ollama or a cloud-compatible provider.

Ollama exposes an OpenAI-compatible API at `http://127.0.0.1:11434/v1`.

## Configuration

Copy `.env.example` to `.env` and configure:

```text
AIDEVOS_PROVIDER=ollama
AIDEVOS_BASE_URL=http://127.0.0.1:11434/v1
AIDEVOS_API_KEY=ollama
AIDEVOS_MODEL=qwen3:4b
AIDEVOS_DATA_DIR=.aidevos
AIDEVOS_MAX_TURNS=30
```

For OpenAI-compatible cloud providers, change `AIDEVOS_PROVIDER`, `AIDEVOS_BASE_URL`, `AIDEVOS_API_KEY`, and `AIDEVOS_MODEL`.

## Project lifecycle

1. Register a project.
2. Start a mission.
3. The agent inspects the project with local tools.
4. It edits only task-relevant files.
5. It runs tests/builds/checks.
6. It inspects Git state/diff.
7. It reports evidence and remaining issues.

## Safety boundary

High-risk and destructive shell commands are blocked by the policy layer. Git push, deployment, publishing, destructive filesystem operations, database destructive commands, and similar actions require an explicit approval mechanism before they are enabled.

## Planned next layers

- persistent task/event store
- structured project audit
- skill registry and routing
- approval UI
- streaming event UI
- Docker sandbox execution
- Playwright browser verification
- GitHub PR workflow
- richer memory retrieval
- model-aware routing and budgets
