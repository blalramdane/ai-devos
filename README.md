# AI DevOS

Local-first AI Software Engineering Operating System.

AI DevOS is an execution-oriented development environment that combines project context, memory, agent orchestration, tool execution, testing, and verification.

## Core principles

- Understand the project before changing it.
- Execute real development tasks, not just generate suggestions.
- Treat tests and runtime evidence as part of completion.
- Keep project knowledge separate from global knowledge.
- Make execution boundaries explicit and auditable.

## V1

V1 focuses on the foundation:

- Workspace and project model
- Persistent project memory
- Agent task state
- Tool gateway abstractions
- Command execution with safety boundaries
- Test/verification result model
- Git-aware task history
- CLI-first runtime with an API/UI layer ready to follow

See [docs/architecture.md](docs/architecture.md) for the initial architecture.
