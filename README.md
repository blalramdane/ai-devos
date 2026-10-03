# AI DevOS

> **A local-first AI Software Engineering Operating System**

AI DevOS turns a natural-language development mission into a controlled, resumable, evidence-backed workflow.

It is designed around one rule:

**An agent saying “done” is not verification. Evidence is verification.**

## What it does

```text
Mission
  ↓
Project Context + Memory
  ↓
Skill Routing
  ↓
Model Routing + Policy
  ↓
Agent Execution + Tools
  ↓
Test
  ↓
Recovery on Failure
  ↓
Verify
  ↓
Evidence
  ↓
Persist Knowledge
```

### Core capabilities

| Layer | Capability |
| --- | --- |
| **Context** | Project identity, stack, decisions, constraints, open issues, verification requirements |
| **Memory** | Project-scoped decisions, lessons, bugs, and context |
| **Skills** | Engineering, product, research, design, data, operations, marketing, sales, finance, HR, legal, productivity |
| **Models** | Task-aware routing with primary/fallback routes and policy controls |
| **Agent** | OpenAI Agents SDK with explicit project tools |
| **Tools** | Files, search, write, shell commands, Git status/diff |
| **Workflow** | Persistent stages, checkpoints, retries, pause/resume, approvals |
| **Recovery** | AI-assisted recovery hooks for failed test/verify stages |
| **Verification** | npm checks/tests, Git evidence, HTTP, browser, service readiness |
| **Auditability** | Append-only workflow events and persisted evidence |
| **Safety** | Risk-aware command policy and explicit approval boundaries |
| **Worker** | Queued background execution with per-workflow file locks |

## Operating model

AI DevOS follows the AI OS execution contracts:

1. **Understand** — inspect the project and existing decisions.
2. **Plan** — route skills, select the model, define the execution path.
3. **Execute** — make the smallest task-relevant changes through controlled tools.
4. **Test** — run the project's checks/tests.
5. **Recover** — diagnose and repair supported test/verification failures.
6. **Verify** — collect runtime and repository evidence.
7. **Finalize** — persist state, knowledge, and the final result.

For bugs, the execution pattern is:

`Reproduce → Evidence → Root Cause → Fix → Test → Verify`

For features:

`Requirement → Architecture → Implementation → Test → Build → Verify`

## Quick start

### 1. Install

```bash
npm install
npm run build
```

### 2. Configure

```bash
cp .env.example .env
```

Default configuration is local-first through Ollama:

```text
AIDEVOS_PROVIDER=ollama
AIDEVOS_BASE_URL=http://127.0.0.1:11434/v1
AIDEVOS_MODEL=qwen3:4b
```

Cloud/OpenAI-compatible routes can be configured without changing the agent runtime.

### 3. Register a project

```bash
aidevos register my-project "My Project" ./my-project
aidevos projects
aidevos audit my-project
```

### 4. Run a mission

```bash
aidevos run my-project "Fix the failing authentication tests"
```

### 5. Run a persistent workflow

```bash
aidevos workflow start my-project "Add and verify the customer export endpoint"
```

For background execution:

```bash
aidevos workflow enqueue my-project "Add and verify the customer export endpoint"
aidevos worker once
```

Use `aidevos worker start` for continuous queued-work processing.

## Workflow control

```bash
aidevos workflow status <projectId> <workflowId>
aidevos workflow resume <projectId> <workflowId>
aidevos workflow pause <projectId> <workflowId>
aidevos workflow approve <projectId> <approvalId>
aidevos workflow events <projectId> <workflowId>
aidevos workflow evidence <projectId> <workflowId>
```

### Verification

Local verification is the default trust boundary.

```bash
# HTTP
aidevos workflow verify-http my-project wf-123 http://127.0.0.1:3000/health 200 "ok"

# Browser
aidevos workflow verify-browser my-project wf-123 http://127.0.0.1:3000 "#app" "Dashboard"

# Service lifecycle + readiness + optional browser verification
aidevos workflow verify-service my-project wf-123 "npm run dev" http://127.0.0.1:3000 http://127.0.0.1:3000 "#app" "Dashboard"

# Inspect persisted evidence
aidevos workflow evidence my-project wf-123
```

External HTTP/browser verification is blocked by default and must be explicitly enabled through the verifier API.

## Model routing

The runtime separates **what the mission needs** from **which model happens to provide it**.

Supported route families include:

- **Ollama** for local execution.
- **Experiential Labs** through its OpenAI-compatible gateway.
- **OpenAI**.
- **Generic OpenAI-compatible endpoints**.

The policy engine considers mission type, tool capability, privacy mode, budget tier, context/output limits, route tags, and priority.

Inspect routing without executing a mission:

```bash
aidevos models
aidevos policy "Debug the checkout API and run the tests"
```

## Project state

Runtime state is kept under:

```text
.aidevos/
├── projects.json
├── <projectId>/
│   ├── context.json
│   ├── memory.json
│   ├── tasks.json
│   ├── approvals.json
│   ├── events.jsonl
│   └── workflows/
│       └── <workflowId>/
│           └── evidence.json
└── locks/
    └── <workflowId>.lock
```

This keeps project knowledge isolated and makes workflow execution inspectable.

## Safety model

AI DevOS does not treat shell access as unrestricted.

High-risk and critical operations are classified by policy and can require explicit approval. The same boundary applies to service startup commands.

The runtime is designed so that destructive, irreversible, production, publishing, financial, or externally consequential actions do not silently become autonomous actions.

## Architecture

```text
┌──────────────────────────────────────────────┐
│                AI DevOS CLI                  │
├──────────────────────────────────────────────┤
│ Control Plane                                │
│ Projects • Tasks • Approvals • Events        │
├──────────────────────────────────────────────┤
│ Intelligence Plane                           │
│ Context • Memory • Skills • Model Policy     │
├──────────────────────────────────────────────┤
│ Agent / Tool Plane                           │
│ Agent • Files • Search • Shell • Git         │
├──────────────────────────────────────────────┤
│ Workflow Plane                               │
│ Checkpoints • Retry • Recovery • Worker      │
├──────────────────────────────────────────────┤
│ Verification Plane                           │
│ Tests • Git • HTTP • Browser • Services      │
└──────────────────────────────────────────────┘
```

See:

- `docs/architecture.md`
- `docs/local-agent.md`
- `docs/ai-os/agent-execution-protocol.md`
- `docs/ai-os/tool-orchestration.md`
- `docs/ai-os/project-context-model.md`
- `docs/ai-os/skill-execution-model.md`
- `docs/ai-os/workflow-runtime.md`

## Current scope

V1 intentionally uses local JSON/JSONL persistence and a local workflow worker. The runtime contracts are structured so persistence, execution, verification, and UI can evolve independently.

### Next engineering layers

- Docker sandbox execution
- richer memory/retrieval
- approval/event UI
- GitHub PR workflow
- model evaluation and budgets
- richer observability

## Development

```bash
npm run check
npm test
```

CI runs the TypeScript check and test suite on Node 24.

## Project status

This repository is being developed as the execution core of a broader AI OS. The current branch contains the local agent runtime, model policy/routing, AI OS contracts, persistent workflows, verification adapters, service lifecycle, recovery hooks, safety boundaries, and CI coverage.

**Design goal:** small explicit contracts, replaceable providers, controlled execution, and evidence-backed completion.
