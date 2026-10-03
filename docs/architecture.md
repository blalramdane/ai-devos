# AI DevOS Architecture

## Goal

AI DevOS is a local-first software engineering runtime where a user gives a development mission and the system can inspect the project, select the appropriate execution path, operate through controlled tools, recover from supported failures, and produce verifiable evidence.

The architecture separates **decision-making**, **execution**, and **verification** so that a model provider can change without changing the operating model.

## System layers

### 1. Control Plane

Owns the state of execution:

- projects and project registration
- tasks
- workflows
- approvals
- append-only events
- workflow locks
- audit information

The control plane answers: **What are we doing, where are we doing it, and what state are we in?**

### 2. Intelligence Plane

Owns the reasoning inputs and routing contracts:

- project context
- project-scoped memory
- skill registry and skill routing
- model routing
- model policy
- agent orchestration

The intelligence plane answers: **What does this mission require, what context matters, and which capabilities should execute it?**

### 3. Tool / Execution Plane

Exposes explicit project-scoped capabilities:

- list/search project files
- read/write project files
- shell commands
- Git status/diff
- service/process lifecycle

Tools operate inside the registered project boundary and pass through the relevant safety policy.

The execution plane answers: **How do we safely perform the selected action?**

### 4. Workflow Plane

Turns a mission into a persistent state machine:

`Understand → Plan → Execute → Test → Verify → Finalize`

The runtime persists:

- current stage
- stage attempts
- stage checkpoints
- status
- errors
- approvals
- recovery events

Failed test/verification stages can invoke a recovery handler before the bounded retry.

### 5. Verification Plane

Verification is independent from the agent's final message.

Evidence can come from:

- npm check/test discovery and execution
- Git status and diff
- local HTTP endpoints
- Playwright browser checks
- service readiness checks

A verification failure is persisted as evidence and causes the corresponding workflow stage to fail.

### 6. Persistence Plane

V1 uses project-local JSON/JSONL storage:

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

This is deliberately simple for V1. The contracts can later be backed by SQLite/Postgres without changing the workflow semantics.

## Execution lifecycle

At the operating-model level:

`request → understand → plan → execute → observe → test → recover → verify → summarize → persist knowledge`

### Bug workflow

`Reproduce → Evidence → Root Cause → Fix → Test → Verify`

### Feature workflow

`Requirement → Architecture → Implementation → Test → Build → Verify`

The runtime does not require every mission to expose all of these as separate public stages; they are execution rules applied by the relevant handlers and skills.

## Model routing

The model provider is replaceable.

The ModelRouter receives the mission and configured policy, then considers:

- mission category
- explicit route tags
- tool capability
- privacy mode
- budget tier
- context limits
- output limits
- reasoning capability
- route priority

Current route families include Ollama, Experiential Labs, OpenAI, and generic OpenAI-compatible endpoints.

This keeps provider selection outside the agent's core execution logic.

## Skill routing

Skills are executable contracts, not only documentation.

Each skill defines:

- triggers
- workflow
- preferred tools
- verification criteria
- escalation conditions
- output format
- operating instructions

The Skill Router selects the smallest useful set of skills for the mission while preserving project context and safety rules.

## Safety boundary

The safety model is explicit:

- command risk is classified before execution
- high/critical operations can require approval
- service startup uses the same command-risk boundary
- local HTTP/browser verification is the default
- external verification is opt-in
- project filesystem access is scoped to the registered project
- verification is required before a workflow can be considered complete

Safety and authorization rules cannot be silently overridden by project context or a skill.

## Recovery model

Recovery is a bounded hook around failed workflow stages.

For supported stages:

1. Stage fails.
2. Failure and evidence are persisted.
3. A recovery handler is invoked.
4. Recovery receives the actual stage error and latest verification evidence.
5. The recovery agent investigates and applies the smallest safe fix.
6. The original stage is retried.
7. Recovery success/failure is recorded as an explicit event.

Current recovery hooks cover the **test** and **verify** stages.

## Verification trust model

The trust hierarchy is:

`Agent output < persisted execution evidence < successful verification`

The final answer is a report of what the runtime can substantiate.

For browser verification, Playwright launch/navigation/assertion errors are recorded as failed evidence rather than being hidden.

## Worker model

The V1 worker is local and file-backed:

- queued workflows are eligible for execution
- paused workflows remain paused
- approval-gated workflows wait for approval
- a per-workflow lock prevents concurrent execution
- `worker once` processes available work once
- `worker start` continuously polls

A distributed queue is intentionally outside the current V1 boundary.

## Architectural boundaries

The current design keeps these contracts independent:

```text
Project
  ↓
Context / Memory
  ↓
Skill Router
  ↓
Model Router + Policy
  ↓
Agent
  ↓
Tools
  ↓
Workflow / Worker
  ↓
Verification
  ↓
Evidence / Events
```

This allows future UI, API, database, sandbox, and external-integration layers to sit on top of the same execution contracts.

## Current limitations

V1 does not yet provide:

- a graphical control plane
- distributed workflow execution
- containerized sandbox isolation
- rich semantic memory retrieval
- first-class GitHub PR automation
- full observability/telemetry
- model evaluation infrastructure

These are extension points, not prerequisites for the current local execution core.
