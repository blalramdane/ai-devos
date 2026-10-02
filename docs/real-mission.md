# Running a real AI DevOS mission

The repository includes a Windows PowerShell launcher for the first real end-to-end mission.

## Prerequisites

- Node.js 22+
- npm
- Docker Desktop running
- An AI provider:
  - OpenAI: set `OPENAI_API_KEY`
  - Ollama: set `AIDEVOS_DEFAULT_PROVIDER=ollama`
  - LiteLLM: set `AIDEVOS_DEFAULT_PROVIDER=litellm`

## Run

From the repository root:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.scriptsun-real-mission.ps1
```

The launcher:

1. installs dependencies;
2. runs AI DevOS's own check/build/tests;
3. prepares the Docker sandbox image;
4. registers the current repository as a project;
5. launches a real AI agent mission;
6. asks the agent to implement `GET /api/health`;
7. runs check, build, and tests as verification evidence;
8. exits with code 0 only when the mission is verified.

The mission is intentionally small so the first end-to-end run tests the complete execution loop without introducing a large product change.
