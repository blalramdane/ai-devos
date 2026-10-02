#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { ProjectRegistry } from "./store.js";
import { DockerSandboxExecutor } from "./sandbox/docker.js";
import { FileMemoryStore } from "./memory.js";
import { createDevOSAgent } from "./agent.js";
import { MissionRunner } from "./mission.js";

function usage(): never {
  console.error("Usage: aidevos mission <project-id> <prompt> [verification-command...]");
  process.exit(2);
}

const [command, projectId, ...rest] = process.argv.slice(2);
if (command !== "mission" || !projectId || rest.length === 0) usage();

const prompt = rest[0];
const verificationCommands = rest.slice(1);
const dataDir = resolve(process.env.AIDEVOS_DATA_DIR ?? ".aidevos");
const registry = new ProjectRegistry(dataDir);
const project = await registry.get(projectId);

if (!project) {
  console.error(`Unknown project: ${projectId}`);
  console.error("Register the project through ProjectRegistry before running a mission.");
  process.exit(1);
}

const executor = new DockerSandboxExecutor();
const agent = createDevOSAgent({
  workspace: project.rootPath,
  executor,
});

const runner = new MissionRunner({
  runAgent: (missionPrompt) => agent.runMission(missionPrompt),
  executor,
  memory: new FileMemoryStore(resolve(dataDir, "memory")),
});

try {
  const result = await runner.execute({
    taskId: randomUUID(),
    project,
    prompt,
    verificationCommands,
  });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.report.verified ? 0 : 1);
} finally {
  await agent.close();
}
