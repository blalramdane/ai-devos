export type TaskStatus =
  | "queued"
  | "planning"
  | "executing"
  | "testing"
  | "verifying"
  | "completed"
  | "failed";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface Project {
  id: string;
  name: string;
  rootPath: string;
  description?: string;
}

export interface Task {
  id: string;
  projectId: string;
  prompt: string;
  status: TaskStatus;
  risk: RiskLevel;
  createdAt: string;
  updatedAt: string;
}

export type EvidenceKind =
  | "test"
  | "build"
  | "lint"
  | "http"
  | "browser"
  | "git"
  | "command";

export type EvidenceStatus = "passed" | "failed" | "not_applicable";

export interface Evidence {
  id: string;
  kind: EvidenceKind;
  title: string;
  passed: boolean;
  status?: EvidenceStatus;
  summary: string;
  command?: string;
  exitCode?: number;
  metadata?: Record<string, unknown>;
}

export interface VerificationReport {
  taskId: string;
  verified: boolean;
  evidence: Evidence[];
  requiredFailures: number;
  notApplicable: number;
  generatedAt: string;
}
