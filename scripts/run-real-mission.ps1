$ErrorActionPreference = "Stop"

Write-Host "=== AI DevOS Real Mission Runner ===" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is required." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm is required." }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker Desktop is required and must be running." }

$provider = $env:AIDEVOS_DEFAULT_PROVIDER
if (-not $env:OPENAI_API_KEY -and $provider -ne "ollama" -and $provider -ne "litellm" -and $provider -ne "nvidia") {
  throw "Set OPENAI_API_KEY, or explicitly set AIDEVOS_DEFAULT_PROVIDER to ollama/litellm/nvidia."
}

Write-Host "[1/5] Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host "[2/5] Validating AI DevOS itself..." -ForegroundColor Yellow
npm run check
npm run build
npm test

Write-Host "[3/5] Preparing Docker sandbox image..." -ForegroundColor Yellow
docker image inspect node:22-bookworm-slim *> $null
if ($LASTEXITCODE -ne 0) {
  docker pull node:22-bookworm-slim
}

$projectRoot = (Get-Location).Path
$projectId = "ai-devos"
$projectName = "AI DevOS"

Write-Host "[4/5] Registering the current repository..." -ForegroundColor Yellow
node dist/cli.js project add $projectId $projectName $projectRoot

$prompt = @"
This is a REAL development task on the AI DevOS repository.

Implement a small production-quality health endpoint for the control plane:
- Add GET /api/health to the native control-plane HTTP server.
- Return HTTP 200 with JSON containing status: "ok".
- Include a simple service identifier such as "ai-devos-control-plane".
- Add an automated test that proves the endpoint returns HTTP 200 and the expected JSON.
- Follow the existing TypeScript style and architecture.
- Do not change unrelated behavior.
- Inspect the existing implementation before editing.
- Run the relevant tests, then run the full verification commands.
- If a verification command fails, diagnose and repair the issue within the bounded recovery budget.
- Do not claim VERIFIED without passing evidence.
"@

Write-Host "[5/5] Launching the REAL AI DevOS mission..." -ForegroundColor Yellow
node dist/cli.js mission $projectId $prompt "npm run check" "npm run build" "npm test"

$exitCode = $LASTEXITCODE
if ($exitCode -eq 0) {
  Write-Host "=== MISSION VERIFIED ===" -ForegroundColor Green
} else {
  Write-Host "=== MISSION FAILED: inspect the evidence above ===" -ForegroundColor Red
}
exit $exitCode
