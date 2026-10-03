# AI DevOS CLI

The CLI is the operational surface of the V1 runtime.

## Command groups

### Project

```bash
aidevos register <id> <name> <rootPath> [description]
aidevos projects
aidevos audit <projectId>
aidevos context <projectId>
```

### Intelligence

```bash
aidevos skills <mission>
aidevos models
aidevos policy <mission>
aidevos memory <projectId> [query]
aidevos remember <projectId> <category> <content>
```

### Direct execution

```bash
aidevos run <projectId> <mission>
```

Use this when the mission should execute immediately without a persisted workflow lifecycle.

### Persistent workflow

```bash
aidevos workflow start <projectId> <mission>
aidevos workflow enqueue <projectId> <mission>
aidevos workflow status <projectId> <workflowId>
aidevos workflow resume <projectId> <workflowId>
aidevos workflow pause <projectId> <workflowId>
aidevos workflow approve <projectId> <approvalId>
aidevos workflow events <projectId> <workflowId>
aidevos workflow evidence <projectId> <workflowId>
```

### Verification

```bash
aidevos workflow verify-http <projectId> <workflowId> <url> [expectedStatus] [contains]

aidevos workflow verify-browser <projectId> <workflowId> <url> [selector] [contains]

aidevos workflow verify-service <projectId> <workflowId> <command> <readyUrl> [browserUrl] [selector] [contains]
```

Verification evidence is persisted with the workflow.

### Worker

```bash
aidevos worker once
aidevos worker start
```

The worker executes queued workflows and uses a per-workflow lock to prevent concurrent claims.

## Choosing between `run` and `workflow`

Use `run` for a direct interactive mission.

Use `workflow` when you need:

- persisted stage state
- retries
- recovery
- approvals
- pause/resume
- event history
- verification evidence
- background execution

## Operational sequence

A typical engineering mission looks like:

```text
register
  ↓
audit
  ↓
workflow start / enqueue
  ↓
Understand
  ↓
Plan
  ↓
Execute
  ↓
Test
  ↓
Recover if needed
  ↓
Verify
  ↓
Evidence
  ↓
Finalize
```

## Safety

The CLI is not an authorization bypass.

High-risk and critical commands can require explicit approval. External verification is not the default trust boundary.

## Output contract

For operational commands, prefer machine-readable JSON where the command already exposes structured state. Human-oriented discovery commands use tables for quick inspection.

When reporting completion, use:

```text
Done
Changed
Tested
Verified
Remaining Issues
Next Step
```
