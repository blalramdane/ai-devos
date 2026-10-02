# Mission Lifecycle

A mission is the primary unit of work in AI DevOS.

## Lifecycle

`queued -> planning -> executing -> testing -> verifying -> completed|failed`

The agent may modify the workspace, but it cannot make the final verification decision.

## Verification

Verification evidence is produced by explicit commands and normalized into the shared `Evidence` model.

A mission is verified only when:
- at least one evidence item exists, and
- every evidence item passes.

## Memory

Every completed or failed mission writes a project-scoped memory entry:
- `lesson` for verified missions
- `bug` for failed verification

This keeps operational knowledge attached to the project that generated it.

## Future recovery loop

The next runtime phase will add structured recovery:
1. inspect failed evidence
2. give the failure to the agent
3. apply a bounded fix
4. rerun verification
5. stop after a configurable retry budget
