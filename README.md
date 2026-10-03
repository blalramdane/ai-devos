# AI DevOS

Local-first AI Software Engineering Operating System.

AI DevOS is an execution-oriented development environment that combines project context, memory, agent orchestration, tool execution, testing, and verification.

## Core principles

- Understand the project before changing it.
- Execute real development tasks, not just generate suggestions.
- Treat tests and runtime evidence as part of completion.
- Keep project knowledge separate from global knowledge.
- Make execution boundaries explicit and auditable.
- Keep the model provider replaceable.

## Current V1 foundation

- Workspace/project registry
- Persistent project memory primitives
- Agent task state model
- Safety-aware command policy
- Local filesystem/search/edit tools
- Git status/diff verification tools
- OpenAI-compatible model routing
- Task-aware ModelRouter with ordered fallback routes
- Ollama-first local configuration with Experiential Labs support
- CLI-first execution runtime
- Persistent workflow engine with stage checkpoints, retries, pause/resume, append-only events, and approval gates

## Quick start

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Run `npm run build`.
4. Register a project with `node dist/cli.js register <id> <name> <rootPath> [description]`.
5. List projects with `node dist/cli.js projects`.
6. Inspect configured model routes with `node dist/cli.js models`.
7. Run a mission with `node dist/cli.js run <projectId> <mission>`.

For Experiential Labs, set `AIDEVOS_PROVIDER=experiential`, `AIDEVOS_BASE_URL=https://api.experientiallabs.ai/v1`, `AIDEVOS_API_KEY` to your gateway key, and `AIDEVOS_MODEL` to a callable model slug. You can also keep Ollama as primary and add Experiential as a tagged fallback through `AIDEVOS_FALLBACKS`.

See `docs/architecture.md` and `docs/local-agent.md`.

## Roadmap

1. Local execution MVP
2. Project audit and skill router
3. Approval and event UI
4. Docker sandbox
5. Browser verification
6. GitHub PR workflow
7. Rich memory/retrieval
8. Budgets, routing policies, and model evaluation

