# Workflow Runtime

AI DevOS workflows turn a mission into a persistent, resumable execution state machine.

## Lifecycle

queued -> running -> stage checkpoints -> completed

A failed stage is retried up to the configured attempt limit. The workflow keeps completed stages and checkpoints, so manual resume continues from the current stage instead of restarting the workflow.

## Default stages

1. Understand — inspect project context and audit.
2. Plan — select the model route and skills.
3. Execute — perform the mission through the agent runtime.
4. Test — record the testing checkpoint.
5. Verify — record the verification checkpoint.
6. Finalize — persist completion state.

Stage handlers are injectable so future runtimes can replace the current CLI handlers with dedicated test, browser, HTTP, Git, or sandbox executors.

## Event log

Events are appended to .aidevos/<projectId>/events.jsonl. V1 keeps this local and append-only.

Verification evidence is persisted under .aidevos/<projectId>/workflows/<workflowId>/evidence.json. The verification runner discovers npm check/test scripts, records exit codes and output, and records Git status/diff evidence.

## Approval gates

High/critical actions can create an approval request. The workflow moves to waiting_approval until the request is explicitly approved. Approval state is persisted in .aidevos/<projectId>/approvals.json.

## CLI

    aidevos workflow start <projectId> <mission>
    aidevos workflow status <projectId> <workflowId>
    aidevos workflow resume <projectId> <workflowId>
    aidevos workflow pause <projectId> <workflowId>
    aidevos workflow approve <projectId> <approvalId>
    aidevos workflow events <projectId> <workflowId>
    aidevos workflow evidence <projectId> <workflowId>
    aidevos approvals <projectId>

## Design boundary

V1 deliberately uses local JSON/JSONL persistence instead of a distributed queue. The next upgrade can move the same contracts to SQLite/Postgres, add background workers, richer evidence objects, and real-time UI without changing the workflow concepts.