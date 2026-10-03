#!/usr/bin/env node
import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { ProjectRegistry } from "./projects.js";
import { runMission } from "./agent.js";
import { auditProject } from "./audit.js";
import { routeSkills } from "./skills.js";
import { createModelRouter } from "./model-router.js";

const config = loadConfig();
const registry = new ProjectRegistry(config.dataDir);
const [command, ...args] = process.argv.slice(2);

function usage(): never {
  console.log(`
AI DevOS

Commands:
  register <id> <name> <rootPath> [description]
  projects
  audit <projectId>
  skills <mission>
  models
  policy <mission>
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

  if (command === "audit") {
    const [projectId] = args;
    if (!projectId) usage();
    const project = await registry.get(projectId);
    console.log(JSON.stringify(await auditProject(project), null, 2));
    return;
  }

  if (command === "skills") {
    const mission = args.join(" ");
    if (!mission) usage();
    console.table(routeSkills(mission).map((skill) => ({ name: skill.name })));
    return;
  }

  if (command === "models") {
    const router = await createModelRouter(config);
    console.table(
      router.list().map((route) => ({
        id: route.id,
        provider: route.provider,
        model: route.model,
        priority: route.priority,
        tags: route.tags.join(", "),
        baseUrl: route.baseUrl,
        tools: router.catalog().find((model) => model.id === route.model)?.supportsTools ?? "unknown",
        context: router.catalog().find((model) => model.id === route.model)?.contextWindow ?? "unknown",
      })),
    );
    return;
  }

  if (command === "policy") {
    const mission = args.join(" ");
    if (!mission) usage();
    const router = await createModelRouter(config);
    const decision = router.policy(mission, config.modelPolicy);
    console.log(JSON.stringify({ mission, policy: config.modelPolicy, selected: { id: decision.route.id, provider: decision.route.provider, model: decision.route.model }, reason: decision.reason, rejected: decision.rejected.map((item) => ({ id: item.route.id, model: item.route.model, reasons: item.reasons })) }, null, 2));
    return;
  }

  if (command === "run") {
    const [projectId, ...missionParts] = args;
    if (!projectId || missionParts.length === 0) usage();
    const project = await registry.get(projectId);
    const router = await createModelRouter(config);
    const decision = router.policy(missionParts.join(" "), config.modelPolicy);
    const route = decision.route;
    console.log(`\n[AI DevOS] ${project.name}\n[Route] ${route.provider} / ${route.model}\n`);
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
