#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { ProjectRegistry, TaskStore } from "./store.js";
import { DockerSandboxExecutor } from "./sandbox/docker.js";
import { FileMemoryStore } from "./memory.js";
import { createDevOSAgent } from "./agent.js";
import { MissionRunner } from "./mission.js";

const dataDir = resolve(process.env.AIDEVOS_DATA_DIR ?? ".aidevos");
const registry = new ProjectRegistry(dataDir);

function usage(): never {
  console.error([
    "Usage:",
    "  aidevos project add <id> <name> <root-path>",
    "  aidevos project list",
    "  aidevos mission <project-id> <prompt> [verification-command...]",
  ].join("\n"));
  process.exit(2);
}

const [command, subcommand, ...args] = process.argv.slice(2);

if (command === "project" && subcommand === "add") {
  const [id, name, rootPath] = args;
  if (!id || !name || !rootPath) usage();
  await registry.upsert({ id, name, rootPath: resolve(rootPath) });
  console.log(`Registered project ${id} -> ${resolve(rootPath)}`);
  process.exit(0);
}

if (command === "project" && subcommand === "list") {
  console.log(JSON.stringify(await registry.list(), null, 2));
  process.exit(0);
}

if (command !== "mission" || !subcommand || args.length < 1) usage();

const projectId = subcommand;
const prompt = args[0];
const verificationCommands = args.slice(1);
const project = await registry.get(projectId);

if (!project) {
  console.error(`Unknown project: ${projectId}`);
  console.error("Register it first with: aidevos project add <id> <name> <root-path>");
  process.exit(1);
}

const executor = new DockerSandboxExecutor();
const agent = createDevOSAgent({ workspace: project.rootPath, executor });

const runner = new MissionRunner({
  runAgent: (missionPrompt) => agent.runMission(missionPrompt),
  executor,
  memory: new FileMemoryStore(resolve(dataDir, "memory")),
  tasks: new TaskStore(dataDir),
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
