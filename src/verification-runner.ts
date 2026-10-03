import { readFile } from "node:fs/promises";
import { runCommand } from "./runner.js";
import type { Evidence, Project } from "./domain.js";
import { EvidenceStore } from "./evidence-store.js";
import { buildVerificationReport } from "./verification.js";

async function packageJson(project: Project): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(project.rootPath + "/package.json", "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function hasScript(pkg: Record<string, unknown> | null, name: string) {
  const scripts = pkg?.scripts;
  return !!scripts && typeof scripts === "object" && scripts !== null && name in scripts;
}

export class VerificationRunner {
  constructor(private readonly evidence: EvidenceStore) {}

  async runTests(project: Project, workflowId: string): Promise<Evidence[]> {
    const pkg = await packageJson(project);
    const commands = ["check", "test"].filter((name) => hasScript(pkg, name));
    const results: Evidence[] = [];

    for (const name of commands) {
      const command = "npm run " + name;
      const result = await runCommand(command, project.rootPath);
      const item: Evidence = {
        id: "evidence-" + Date.now().toString(36) + "-" + name,
        kind: name === "test" ? "test" : "lint",
        title: "npm run " + name,
        passed: !result.blocked && result.exitCode === 0,
        summary: (result.stderr || result.stdout).slice(-4000),
        command,
        exitCode: result.exitCode,
        metadata: { blocked: result.blocked, risk: result.risk },
      };
      await this.evidence.add(project.id, workflowId, item);
      results.push(item);
      if (!item.passed) break;
    }

    if (!results.length) {
      const item: Evidence = {
        id: "evidence-" + Date.now().toString(36) + "-no-tests",
        kind: "command",
        title: "Verification discovery",
        passed: false,
        summary: "No npm check/test scripts were discovered in package.json.",
      };
      await this.evidence.add(project.id, workflowId, item);
      results.push(item);
    }

    return results;
  }

  async verifyGit(project: Project, workflowId: string): Promise<Evidence[]> {
    const status = await runCommand("git status --short --branch", project.rootPath);
    const diff = await runCommand("git diff --stat", project.rootPath);
    const items: Evidence[] = [
      {
        id: "evidence-" + Date.now().toString(36) + "-git-status",
        kind: "git",
        title: "Git status",
        passed: !status.blocked && status.exitCode === 0,
        summary: status.stdout.slice(-4000),
        command: status.command,
        exitCode: status.exitCode,
      },
      {
        id: "evidence-" + Date.now().toString(36) + "-git-diff",
        kind: "git",
        title: "Git diff summary",
        passed: !diff.blocked && diff.exitCode === 0,
        summary: diff.stdout.slice(-4000),
        command: diff.command,
        exitCode: diff.exitCode,
      },
    ];
    for (const item of items) await this.evidence.add(project.id, workflowId, item);
    return items;
  }

  async report(projectId: string, workflowId: string) {
    return buildVerificationReport(workflowId, await this.evidence.list(projectId, workflowId));
  }
}
