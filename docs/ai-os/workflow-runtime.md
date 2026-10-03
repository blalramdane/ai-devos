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

## Verification evidence adapters

The verification layer can collect evidence beyond unit tests and Git state:

- HTTP verification checks a local HTTP endpoint by default, records status, headers, and a bounded body excerpt.
- Browser verification uses Playwright and can assert that a selector exists or that page text contains an expected value.
- External URLs are blocked by default for both adapters; enabling external verification must be an explicit caller decision.
- Evidence is persisted under `.aidevos/<projectId>/workflows/<workflowId>/evidence.json`.

CLI examples:

```bash
aidevos workflow verify-http my-project wf-123 http://127.0.0.1:3000/health 200 "ok"
aidevos workflow verify-browser my-project wf-123 http://127.0.0.1:3000 "#app" "Dashboard"
aidevos workflow evidence my-project wf-123
```

Browser verification requires a Playwright browser binary to be installed in the execution environment. The adapter records a failed evidence item instead of hiding launch/navigation errors.


### Project-context verification

A project's `verificationRequirements` can drive the Verify stage automatically. Requirements use a deterministic pipe-delimited format:

- `http|URL|expectedStatus|contains`
- `browser|URL|selector|contains`
- `service|command|readyUrl|browserUrl|selector|contains`

Only the fields required by the selected verifier are needed. Local HTTP/browser verification is the default; external URLs remain blocked unless explicitly enabled by the verifier API. Service startup also passes through the command risk policy, so high/critical startup commands require explicit approval.

The workflow Verify stage runs these configured checks before the final Git evidence check. A failed verification is persisted as evidence and causes the workflow stage to fail rather than claiming completion.
