import type { Evidence } from "./domain.js";
import { buildVerificationReport } from "./verification.js";
import type { SandboxExecutor } from "./sandbox/types.js";

export interface RecoveryOptions {
  executor: SandboxExecutor;
  repair: (failure: Evidence[], attempt: number) => Promise<string>;
  maxAttempts?: number;
}

export interface RecoveryResult {
  verified: boolean;
  attempts: number;
  evidence: Evidence[];
  repairOutputs: string[];
}

export class RecoveryEngine {
  constructor(private readonly options: RecoveryOptions) {}

  async verifyAndRecover(
    taskId: string,
    workspace: string,
    verificationCommands: string[],
  ): Promise<RecoveryResult> {
    const maxAttempts = this.options.maxAttempts ?? 3;
    const repairOutputs: string[] = [];
    const allEvidence: Evidence[] = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const evidence: Evidence[] = [];

      for (const command of verificationCommands) {
        const result = await this.options.executor.run(command, workspace);
        evidence.push({
          id: `${taskId}-attempt-${attempt}-${evidence.length + 1}`,
          kind: "command",
          title: `Attempt ${attempt}: ${command}`,
          passed: !result.blocked && result.exitCode === 0,
          summary: result.blocked
            ? "Blocked by execution policy."
            : result.exitCode === 0
              ? result.stdout.trim() || "Command completed successfully."
              : result.stderr.trim() || `Command exited with code ${result.exitCode}.`,
          command,
          exitCode: result.exitCode,
          metadata: { attempt, sandboxed: result.sandboxed, timedOut: result.timedOut },
        });
      }

      allEvidence.push(...evidence);
      if (buildVerificationReport(taskId, evidence).verified) {
        return { verified: true, attempts: attempt, evidence: allEvidence, repairOutputs };
      }

      if (attempt < maxAttempts) {
        const failed = evidence.filter((item) => !item.passed);
        repairOutputs.push(await this.options.repair(failed, attempt));
      }
    }

    return { verified: false, attempts: maxAttempts, evidence: allEvidence, repairOutputs };
  }
}
