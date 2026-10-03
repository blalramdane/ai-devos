#!/usr/bin/env node
import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { ProjectRegistry } from "./projects.js";
import { runMission } from "./agent.js";
import { auditProject } from "./audit.js";
import { routeSkills } from "./skills.js";
import { createModelRouter } from "./model-router.js";
import { EventStore } from "./events.js";
import { ApprovalStore } from "./approvals.js";
import { WorkflowStore } from "./workflows.js";
import { WorkflowRunner } from "./workflow-runner.js";
import { EvidenceStore } from "./evidence-store.js";
import { VerificationRunner } from "./verification-runner.js";

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
  context <projectId>
  memory <projectId> [query]
  remember <projectId> <category> <content>
  tasks <projectId>
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

  if (command === "context") { const [id]=args;if(!id)usage();const {ProjectContextStore}=await import("./project-context.js");console.log(JSON.stringify(await new ProjectContextStore(config.dataDir).get(id),null,2));return; }
  if (command === "memory") { const [id,...q]=args;if(!id)usage();const {FileMemoryStore}=await import("./memory.js");const s=new FileMemoryStore(config.dataDir);console.log(JSON.stringify(q.length?await s.search(id,q.join(" ")):await s.latest(id),null,2));return; }
  if (command === "remember") { const [id,category,...cc]=args;if(!id||!category||!cc.length)usage();const {FileMemoryStore}=await import("./memory.js");await new FileMemoryStore(config.dataDir).add({id:"memory-"+Date.now().toString(36),projectId:id,category:category as any,content:cc.join(" "),createdAt:new Date().toISOString()});return; }
  if (command === "tasks") { const [id]=args;if(!id)usage();const {TaskStore}=await import("./tasks.js");console.table(await new TaskStore(config.dataDir).list(id));return; }
  if (command === "approvals") {
    const [id] = args; if (!id) usage();
    console.table(await new ApprovalStore(config.dataDir).list(id));
    return;
  }

  if (command === "workflow") {
    const [action, projectId, ...rest] = args;
    if (!action || !projectId) usage();
    const project = await registry.get(projectId);
    const workflows = new WorkflowStore(config.dataDir);
    const events = new EventStore(config.dataDir);
    const approvals = new ApprovalStore(config.dataDir);
    const evidence = new EvidenceStore(config.dataDir);
    const verification = new VerificationRunner(evidence);
    const runner = new WorkflowRunner(workflows, events, approvals, {
      handlers: {
        understand: async ({ project }) => JSON.stringify(await auditProject(project)),
        plan: async ({ workflow }) => {
          const router = await createModelRouter(config);
          const decision = router.policy(workflow.mission, config.modelPolicy);
          return JSON.stringify({ route: decision.route.id, reason: decision.reason, skills: routeSkills(workflow.mission).map((skill) => skill.name) });
        },
        execute: async ({ project, workflow }) => runMission(project, workflow.mission, config),
        test: async ({ project, workflow }) => JSON.stringify(await verification.runTests(project, workflow.id)),
        verify: async ({ project, workflow }) => JSON.stringify(await verification.verifyGit(project, workflow.id)),

        finalize: async ({ workflow }) => "Workflow " + workflow.id + " completed and state persisted.",
      },
    });

    if (action === "start") {
      const mission = rest.join(" "); if (!mission) usage();
      const workflow = await workflows.create(projectId, mission);
      console.log(JSON.stringify(await runner.start(project, workflow), null, 2));
      return;
    }
    if (action === "status") {
      const [workflowId] = rest; if (!workflowId) usage();
      console.log(JSON.stringify(await workflows.get(projectId, workflowId), null, 2)); return;
    }
    if (action === "resume") {
      const [workflowId] = rest; if (!workflowId) usage();
      console.log(JSON.stringify(await runner.resume(project, workflowId), null, 2)); return;
    }
    if (action === "pause") {
      const [workflowId] = rest; if (!workflowId) usage();
      console.log(JSON.stringify(await workflows.update(projectId, workflowId, { status: "paused" }), null, 2)); return;
    }
    if (action === "approve") {
      const [approvalId] = rest; if (!approvalId) usage();
      const approval = await approvals.update(projectId, approvalId, "approved");
      await events.append({ type: "workflow.approval.granted", workflowId: approval.workflowId, projectId, payload: { approvalId } });
      console.log(JSON.stringify(approval, null, 2)); return;
    }
    if (action === "evidence") {
      const [workflowId] = rest; if (!workflowId) usage();
      console.log(JSON.stringify(await verification.report(projectId, workflowId), null, 2)); return;
    }
    if (action === "events") {
      const [workflowId] = rest; if (!workflowId) usage();
      console.log(JSON.stringify(await events.list(projectId, workflowId), null, 2)); return;
    }
    usage();
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
