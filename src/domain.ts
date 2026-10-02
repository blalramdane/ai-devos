export type TaskStatus =
  | "queued" | "planning" | "executing" | "testing" | "verifying" | "completed" | "failed";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export interface Project { id: string; name: string; rootPath: string; description?: string; }
export interface Task { id: string; projectId: string; prompt: string; status: TaskStatus; risk: RiskLevel; createdAt: string; updatedAt: string; }
export type EvidenceKind = "test" | "build" | "lint" | "http" | "browser" | "git" | "command";
export interface Evidence { id: string; kind: EvidenceKind; title: string; passed: boolean; summary: string; command?: string; exitCode?: number; metadata?: Record<string, unknown>; }
export interface VerificationReport { taskId: string; verified: boolean; evidence: Evidence[]; generatedAt: string; }
export type MissionEventType = "status" | "tool.started" | "tool.completed" | "verification" | "recovery" | "agent.started" | "agent.completed";
export interface MissionEvent { id: string; taskId: string; type: MissionEventType; timestamp: string; message: string; data?: Record<string, unknown>; }
