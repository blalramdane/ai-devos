#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { ProjectRegistry } from "./projects.js";
import { runMission } from "./agent.js";

const config = loadConfig();
const registry = new ProjectRegistry(config.dataDir);
const [command, ...args] = process.argv.slice(2);

function usage(): never {
  console.log(`
AI DevOS

Commands:
  register <id> <name> <rootPath> [description]
  projects
  run <projectId> <mission>
`);
  process.exit(1);
}

async function main() {
  if (!command) usage();

  if (command === "register") {
    const [id, name, rootPath, ...description] = args;
    if (!id || !name || !rootPath) usage();
    await registry.register({
      id,
      name,
      rootPath: resolve(rootPath),
      description: description.join(" ") || undefined,
    });
    console.log(`Registered project: ${id}`);
    return;
  }

  if (command === "projects") {
    console.table(await registry.list());
    return;
  }

  if (command === "run") {
    const [projectId, ...missionParts] = args;
    if (!projectId || missionParts.length === 0) usage();
    const project = await registry.get(projectId);
    console.log(`\n[AI DevOS] ${project.name}\n[Model] ${config.provider} / ${config.model}\n`);
    const output = await runMission(project, missionParts.join(" "), config);
    console.log(output);
    return;
  }

  usage();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
