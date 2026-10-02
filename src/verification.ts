import type { Evidence, VerificationReport } from "./domain.js";

export function buildVerificationReport(taskId: string, evidence: Evidence[]): VerificationReport {
  return {
    taskId,
    verified: evidence.length > 0 && evidence.every((item) => item.passed),
    evidence,
    generatedAt: new Date().toISOString(),
  };
}
