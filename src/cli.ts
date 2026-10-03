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
import { WorkflowWorker } from "./workflow-worker.js";
import { WorkflowLock } from "./workflow-lock.js";

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
  workflow start <projectId> <mission>
  workflow enqueue <projectId> <mission>
  workflow status <projectId> <workflowId>
  workflow resume <projectId> <workflowId>
  workflow pause <projectId> <workflowId>
  workflow approve <projectId> <approvalId>
  workflow events <projectId> <workflowId>
  workflow evidence <projectId> <workflowId>
  workflow verify-http <projectId> <workflowId> <url> [expectedStatus] [contains]
  workflow verify-browser <projectId> <workflowId> <url> [selector] [contains]
  workflow verify-service <projectId> <workflowId> <command> <readyUrl> [browserUrl] [selector] [contains]
  worker once
  worker start
`);
  process.exit(1);
}

function createWorkflowRunner(
  workflows: WorkflowStore,
  events: EventStore,
  approvals: ApprovalStore,
  verification: VerificationRunner,
) {
  return new WorkflowRunner(workflows, events, approvals, {
    handlers: {
      understand: async ({ project }) => JSON.stringify(await auditProject(project)),
      plan: async ({ workflow }) => {
        const router = await createModelRouter(config);
        const decision = router.policy(workflow.mission, config.modelPolicy);
        return JSON.stringify({
          route: decision.route.id,
          reason: decision.reason,
          skills: routeSkills(workflow.mission).map((skill) => skill.name),
        });
      },
      execute: async ({ project, workflow }) => runMission(project, workflow.mission, config),
      test: async ({ project, workflow }) => JSON.stringify(await verification.runTests(project, workflow.id)),
      verify: async ({ project, workflow }) => JSON.stringify([
        ...(await verification.verifyConfigured(project, workflow.id)),
        ...(await verification.verifyGit(project, workflow.id)),
      ]),
      finalize: async ({ workflow }) => "Workflow " + workflow.id + " completed and state persisted.",
    },
    recoveryHandlers: {
      test: async ({ project, workflow, stage }) => {
        const evidence = await verification.report(project.id, workflow.id);
        return runMission(
          project,
          `A workflow test stage failed for mission: "${workflow.mission}". Inspect the repository and latest evidence, identify the root cause, make the smallest safe fix, and test it. Failure: ${stage.error ?? "unknown"} Evidence: ${JSON.stringify(evidence)}`,
          config,
        );
      },
      verify: async ({ project, workflow, stage }) => {
        const evidence = await verification.report(project.id, workflow.id);
        return runMission(
          project,
          `A workflow verification stage failed for mission: "${workflow.mission}". Reproduce the failure, inspect the evidence, determine the root cause, make the smallest safe fix, and leave the project verifiable. Failure: ${stage.error ?? "unknown"} Evidence: ${JSON.stringify(evidence)}`,
          config,
        );
      },
    },
  });
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
        tools: router.getCatalog().find((model) => model.id === route.model)?.supportsTools ?? "unknown",
        context: router.getCatalog().find((model) => model.id === route.model)?.contextWindow ?? "unknown",
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

  if (command === "worker") {
    const [action] = args;
    if (!action || !["once", "start"].includes(action)) usage();
    const workflows = new WorkflowStore(config.dataDir);
    const events = new EventStore(config.dataDir);
    const approvals = new ApprovalStore(config.dataDir);
    const evidence = new EvidenceStore(config.dataDir);
    const verification = new VerificationRunner(evidence, config.dataDir);
    const lock = new WorkflowLock(config.dataDir);
    const workerRunner = createWorkflowRunner(workflows, events, approvals, verification);
    const worker = new WorkflowWorker(workflows, {
      async start(project, workflow) { const release = await lock.acquire(workflow.id); try { return await workerRunner.start(project, workflow); } finally { await release(); } },
      async resume(project, workflowId) { const release = await lock.acquire(workflowId); try { return await workerRunner.resume(project, workflowId); } finally { await release(); } },
    }, async (projectId) => registry.get(projectId));
    if (action === "once") { console.log(JSON.stringify(await worker.runOnce(), null, 2)); return; }
    await worker.start();
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
    const verification = new VerificationRunner(evidence, config.dataDir);
    const runner = createWorkflowRunner(workflows, events, approvals, verification);

    if (action === "enqueue") {
      const mission = rest.join(" "); if (!mission) usage();
      console.log(JSON.stringify(await workflows.create(projectId, mission), null, 2)); return;
    }
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
    if (action === "verify-service") {
      const [workflowId, serviceCommand, readyUrl, browserUrl, selector, ...containsParts] = rest;
      if (!workflowId || !serviceCommand || !readyUrl) usage();
      const items = await verification.verifyService(
        project,
        workflowId,
        { command: serviceCommand, readyUrl },
        browserUrl,
        { selector, contains: containsParts.length ? containsParts.join(" ") : undefined },
      );
      console.log(JSON.stringify(items, null, 2));
      return;
    }
    if (action === "verify-http") {
      const [workflowId, url, expectedStatusRaw, ...containsParts] = rest;
      if (!workflowId || !url) usage();
      const expectedStatus = expectedStatusRaw ? Number(expectedStatusRaw) : 200;
      if (!Number.isInteger(expectedStatus) || expectedStatus < 100 || expectedStatus > 599) usage();
      const item = await verification.verifyHttp(project, workflowId, url, {
        expectedStatus,
        contains: containsParts.length ? containsParts.join(" ") : undefined,
      });
      console.log(JSON.stringify(item, null, 2));
      return;
    }
    if (action === "verify-browser") {
      const [workflowId, url, selector, ...containsParts] = rest;
      if (!workflowId || !url) usage();
      const item = await verification.verifyBrowser(project, workflowId, url, {
        selector,
        contains: containsParts.length ? containsParts.join(" ") : undefined,
      });
      console.log(JSON.stringify(item, null, 2));
      return;
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
    console.log(`
[AI DevOS] ${project.name}
[Route] ${route.provider} / ${route.model}
`);
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
