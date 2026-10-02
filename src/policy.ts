import type { RiskLevel } from "./domain.js";

const destructivePatterns = [
  /(^|\\s)rm\\s+-rf\\b/i,
  /git\\s+reset\\s+--hard/i,
  /git\\s+clean\\s+-fd/i,
  /drop\\s+database/i,
  /drop\\s+table/i,
  /truncate\\s+table/i,
];

const externalPatterns = [
  /git\\s+push/i,
  /vercel\\s+deploy/i,
  /npm\\s+publish/i,
  /docker\\s+push/i,
];

export function classifyCommand(command: string): RiskLevel {
  if (destructivePatterns.some((pattern) => pattern.test(command))) return "critical";
  if (externalPatterns.some((pattern) => pattern.test(command))) return "high";
  if (/(sudo|chmod|chown)\\b/i.test(command)) return "medium";
  return "low";
}

export function requiresApproval(risk: RiskLevel): boolean {
  return risk === "high" || risk === "critical";
}
