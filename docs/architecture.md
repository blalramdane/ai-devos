# AI DevOS Architecture

## Goal

Build a local-first software engineering runtime where a user can give an implementation mission and the system can inspect a project, execute tools, run tests, recover from failures, and produce verifiable evidence.

## Layers

### 1. Control Plane

Owns projects, workspaces, tasks, policies, sessions, and audit records.

### 2. Intelligence Plane

Owns model providers, context assembly, memory retrieval, planning, and agent orchestration.

### 3. Tool Plane

Exposes capabilities through explicit tools:

- filesystem
- shell
- git
- process/service lifecycle
- test runners
- browser automation (future)
- external integrations (future)

### 4. Verification Plane

Normalizes evidence from:

- unit/integration tests
- lint/type checks
- builds
- HTTP checks
- browser checks
- git diff/status

A task is not considered verified merely because an agent says it is complete.

## Execution lifecycle

`request -> understand -> plan -> execute -> observe -> test -> recover -> verify -> summarize -> persist knowledge`

## Safety

Commands and filesystem access should be policy controlled. Destructive operations, production actions, secret changes, and external pushes require explicit approval by default.

## Project isolation

Global memory must never implicitly become project-private memory. Each project receives its own context, conventions, architecture notes, decisions, and lessons.
