import type { Project } from "./domain.js";
import { EventStore } from "./events.js";
import { ApprovalStore } from "./approvals.js";
import { WorkflowStore, type WorkflowRun, type WorkflowStage } from "./workflows.js";

export interface WorkflowStageContext {
  project: Project;
  workflow: WorkflowRun;
  stage: WorkflowStage;
}

export type WorkflowStageHandler = (context: WorkflowStageContext) => Promise<string | void>;

export interface WorkflowRunnerOptions {
  maxAttempts?: number;
  handlers: Record<string, WorkflowStageHandler>;
}

export class WorkflowRunner {
  private readonly maxAttempts: number;
  constructor(
    private readonly workflows: WorkflowStore,
    private readonly events: EventStore,
    private readonly approvals: ApprovalStore,
    options: WorkflowRunnerOptions,
  ) {
    this.maxAttempts = options.maxAttempts ?? 2;
    this.handlers = options.handlers;
  }
  private readonly handlers: Record<string, WorkflowStageHandler>;

  async start(project: Project, workflow: WorkflowRun) {
    await this.workflows.update(project.id, workflow.id, { status: "running" });
    await this.events.append({ type: "workflow.started", workflowId: workflow.id, projectId: project.id, payload: {} });
    return this.run(project, workflow.id);
  }

  async resume(project: Project, workflowId: string) {
    const workflow = await this.workflows.get(project.id, workflowId);
    if (workflow.status !== "paused" && workflow.status !== "waiting_approval" && workflow.status !== "failed") {
      return workflow;
    }
    const pending = await this.approvals.pendingForWorkflow(project.id, workflowId);
    if (pending.length) {
      throw new Error("Workflow is waiting for approval: " + pending.map((item) => item.id).join(", "));
    }
    await this.workflows.update(project.id, workflowId, { status: "running", lastError: undefined });
    await this.events.append({ type: "workflow.resumed", workflowId, projectId: project.id, payload: {} });
    return this.run(project, workflowId);
  }

  async run(project: Project, workflowId: string) {
    let workflow = await this.workflows.get(project.id, workflowId);
    while (workflow.currentStage < workflow.stages.length) {
      const stage = workflow.stages[workflow.currentStage];
      if (stage.status === "completed" || stage.status === "skipped") {
        workflow = await this.workflows.update(project.id, workflow.id, { currentStage: workflow.currentStage + 1 });
        continue;
      }

      const handler = this.handlers[stage.id];
      if (!handler) throw new Error("No handler for workflow stage: " + stage.id);

      stage.status = "running";
      stage.attempts += 1;
      stage.startedAt = new Date().toISOString();
      workflow = await this.workflows.update(project.id, workflow.id, { stages: [...workflow.stages], status: "running" });
      await this.events.append({ type: "workflow.stage.started", workflowId: workflow.id, projectId: project.id, payload: { stage: stage.id, attempt: stage.attempts } });

      try {
        const checkpoint = await handler({ project, workflow, stage });
        stage.status = "completed";
        stage.completedAt = new Date().toISOString();
        stage.checkpoint = checkpoint === undefined ? undefined : checkpoint;
        stage.error = undefined;
        workflow = await this.workflows.update(project.id, workflow.id, { stages: [...workflow.stages], currentStage: workflow.currentStage + 1, status: "running" });
        await this.events.append({ type: "workflow.stage.completed", workflowId: workflow.id, projectId: project.id, payload: { stage: stage.id, checkpoint } });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        stage.status = "failed";
        stage.error = message;
        workflow = await this.workflows.update(project.id, workflow.id, { stages: [...workflow.stages], status: stage.attempts < this.maxAttempts ? "running" : "failed", lastError: message });
        await this.events.append({ type: "workflow.stage.failed", workflowId: workflow.id, projectId: project.id, payload: { stage: stage.id, attempt: stage.attempts, error: message } });
        if (stage.attempts >= this.maxAttempts) {
          await this.events.append({ type: "workflow.failed", workflowId: workflow.id, projectId: project.id, payload: { stage: stage.id, error: message } });
          return workflow;
        }
      }
    }

    workflow = await this.workflows.update(project.id, workflow.id, { status: "completed", currentStage: workflow.stages.length });
    await this.events.append({ type: "workflow.completed", workflowId: workflow.id, projectId: project.id, payload: {} });
    return workflow;
  }

  async requestApproval(project: Project, workflowId: string, reason: string, risk: "high" | "critical") {
    const approval = await this.approvals.create({ workflowId, projectId: project.id, reason, risk });
    await this.workflows.update(project.id, workflowId, { status: "waiting_approval" });
    await this.events.append({ type: "workflow.approval.requested", workflowId, projectId: project.id, payload: { approvalId: approval.id, reason, risk } });
    return approval;
  }
}
