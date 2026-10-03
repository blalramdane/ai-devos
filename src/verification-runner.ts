import { readFile } from "node:fs/promises";
import { runCommand } from "./runner.js";
import type { Evidence, Project } from "./domain.js";
import { EvidenceStore } from "./evidence-store.js";
import { buildVerificationReport } from "./verification.js";
import { HttpVerifier, type HttpVerificationOptions } from "./http-verifier.js";
import { BrowserVerifier, type BrowserVerificationOptions } from "./browser-verifier.js";
import { ServiceRunner, type ServiceStartOptions } from "./service-runner.js";
import { ProjectContextStore } from "./project-context.js";

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

function isGitWorkingTreeFailure(result: { exitCode: number; stdout: string; stderr: string }) {
  if (result.exitCode !== 128 && result.exitCode !== 129) return false;
  const text = (result.stderr + "\n" + result.stdout).toLowerCase();
  return text.includes("not a git repository") || text.includes("not a git working tree");
}

export class VerificationRunner {
  constructor(private readonly evidence: EvidenceStore, private readonly dataDir?: string) {}

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
        status: !result.blocked && result.exitCode === 0 ? "passed" : "failed",
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
        status: "not_applicable",
        summary: "No npm check/test scripts were discovered in package.json.",
        metadata: { reason: "no-test-scripts" },
      };
      await this.evidence.add(project.id, workflowId, item);
      results.push(item);
    }

    return results;
  }

  async verifyGit(project: Project, workflowId: string): Promise<Evidence[]> {
    const status = await runCommand("git status --short --branch", project.rootPath);
    const diff = await runCommand("git diff --stat", project.rootPath);
    const notGit = isGitWorkingTreeFailure(status) || isGitWorkingTreeFailure(diff);
    const statusApplicable = !isGitWorkingTreeFailure(status);
    const diffApplicable = !isGitWorkingTreeFailure(diff);

    const items: Evidence[] = [
      {
        id: "evidence-" + Date.now().toString(36) + "-git-status",
        kind: "git",
        title: "Git status",
        passed: statusApplicable && !status.blocked && status.exitCode === 0,
        status: !statusApplicable ? "not_applicable" : status.blocked || status.exitCode !== 0 ? "failed" : "passed",
        summary: status.stdout.slice(-4000) || (notGit ? "Project is not a Git working tree." : status.stderr.slice(-4000)),
        command: status.command,
        exitCode: status.exitCode,
        metadata: notGit ? { reason: "not-git-working-tree" } : undefined,
      },
      {
        id: "evidence-" + Date.now().toString(36) + "-git-diff",
        kind: "git",
        title: "Git diff summary",
        passed: diffApplicable && !diff.blocked && diff.exitCode === 0,
        status: !diffApplicable ? "not_applicable" : diff.blocked || diff.exitCode !== 0 ? "failed" : "passed",
        summary: diff.stdout.slice(-4000) || (notGit ? "Project is not a Git working tree." : diff.stderr.slice(-4000)),
        command: diff.command,
        exitCode: diff.exitCode,
        metadata: notGit ? { reason: "not-git-working-tree" } : undefined,
      },
    ];
    for (const item of items) await this.evidence.add(project.id, workflowId, item);
    return items;
  }

  async verifyHttp(project: Project, workflowId: string, url: string, options: HttpVerificationOptions = {}) {
    return new HttpVerifier(this.evidence).verify(project, workflowId, url, options);
  }

  async verifyBrowser(project: Project, workflowId: string, url: string, options: BrowserVerificationOptions = {}) {
    return new BrowserVerifier(this.evidence).verify(project, workflowId, url, options);
  }

  async verifyConfigured(project: Project, workflowId: string): Promise<Evidence[]> {
    if (!this.dataDir) return [];
    const context = await new ProjectContextStore(this.dataDir).get(project.id);
    const requirements = context.verificationRequirements ?? [];
    const results: Evidence[] = [];

    for (const requirement of requirements) {
      const parts = requirement.split("|");
      const kind = parts[0]?.trim().toLowerCase();
      if (kind === "http") {
        const url = parts[1]?.trim();
        if (!url) throw new Error("Invalid http verification requirement: " + requirement);
        const expectedStatus = parts[2] ? Number(parts[2]) : 200;
        results.push(await this.verifyHttp(project, workflowId, url, {
          expectedStatus: Number.isInteger(expectedStatus) ? expectedStatus : 200,
          contains: parts[3]?.trim() || undefined,
        }));
        continue;
      }
      if (kind === "browser") {
        const url = parts[1]?.trim();
        if (!url) throw new Error("Invalid browser verification requirement: " + requirement);
        results.push(await this.verifyBrowser(project, workflowId, url, {
          selector: parts[2]?.trim() || undefined,
          contains: parts[3]?.trim() || undefined,
        }));
        continue;
      }
      if (kind === "service") {
        const command = parts[1]?.trim();
        const readyUrl = parts[2]?.trim();
        if (!command || !readyUrl) throw new Error("Invalid service verification requirement: " + requirement);
        results.push(...await this.verifyService(
          project,
          workflowId,
          { command, readyUrl },
          parts[3]?.trim() || undefined,
          {
            selector: parts[4]?.trim() || undefined,
            contains: parts[5]?.trim() || undefined,
          },
        ));
        continue;
      }
      throw new Error("Unknown verification requirement: " + requirement);
    }

    return results;
  }

  async verifyService(
    project: Project,
    workflowId: string,
    service: ServiceStartOptions,
    browserUrl?: string,
    browser?: BrowserVerificationOptions,
  ) {
    const runner = new ServiceRunner();
    const results: Evidence[] = [];
    await runner.runAndVerify(project, service, async () => {
      if (service.readyUrl) {
        results.push(await this.verifyHttp(project, workflowId, service.readyUrl));
      }
      if (browserUrl) {
        results.push(await this.verifyBrowser(project, workflowId, browserUrl, browser));
      }
      if (results.some((item) => item.status !== "not_applicable" && !item.passed)) {
        throw new Error("Service verification failed.");
      }
    });
    return results;
  }

  async report(projectId: string, workflowId: string) {
    return buildVerificationReport(workflowId, await this.evidence.list(projectId, workflowId));
  }
}
