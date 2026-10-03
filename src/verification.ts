import type { Evidence, VerificationReport } from "./domain.js";

function latestEvidence(evidence: Evidence[]) {
  const latest = new Map<string, Evidence>();
  for (const item of evidence) {
    const key = [item.kind, item.title, item.command ?? ""].join("|");
    latest.set(key, item);
  }
  return [...latest.values()];
}

export function buildVerificationReport(taskId: string, evidence: Evidence[]): VerificationReport {
  const normalized = latestEvidence(evidence).map((item) => ({
    ...item,
    status: item.status ?? (item.passed ? "passed" : "failed"),
  }));
  const applicable = normalized.filter((item) => item.status !== "not_applicable");
  const requiredFailures = applicable.filter((item) => item.status === "failed").length;
  const notApplicable = normalized.filter((item) => item.status === "not_applicable").length;

  return {
    taskId,
    verified: applicable.length > 0 && requiredFailures === 0,
    evidence: normalized,
    requiredFailures,
    notApplicable,
    generatedAt: new Date().toISOString(),
  };
}
