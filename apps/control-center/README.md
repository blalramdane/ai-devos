# AI DevOS Control Center

The first operator UI for AI DevOS.

## What it shows

- Active project and Git branch
- Mission lifecycle: Understand → Plan → Execute → Test → Browser → Verify
- Machine-readable verification evidence
- Live agent activity
- Execution terminal
- Explicit "not verified" state until browser evidence is present

## Run locally

```bash
cd apps/control-center
npm install
npm run dev
```

The current UI uses deterministic fixture data. The next integration connects the panels to the AI DevOS control-plane API and streams real mission events.

## Architecture

`Control Center UI → Control Plane API → MissionRunner → Agent/Tools → Evidence/Verification`
