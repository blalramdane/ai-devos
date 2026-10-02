import { exec } from "node:child_process";
import { promisify } from "node:util";
import { classifyCommand, requiresApproval } from "./policy.js";

const execAsync = promisify(exec);

export interface CommandResult {
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  risk: ReturnType<typeof classifyCommand>;
  blocked: boolean;
}

export async function runCommand(
  command: string,
  cwd: string,
  options: { approveRisky?: boolean } = {},
): Promise<CommandResult> {
  const risk = classifyCommand(command);
  const blocked = requiresApproval(risk) && !options.approveRisky;

  if (blocked) {
    return {
      command,
      cwd,
      stdout: "",
      stderr: "Command blocked by execution policy; explicit approval is required.",
      exitCode: 126,
      risk,
      blocked: true,
    };
  }

  try {
    const result = await execAsync(command, {
      cwd,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    });

    return {
      command,
      cwd,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
      risk,
      blocked: false,
    };
  } catch (error) {
    const e = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: number;
    };

    return {
      command,
      cwd,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? e.message ?? "Command failed.",
      exitCode: typeof e.code === "number" ? e.code : 1,
      risk,
      blocked: false,
    };
  }
}
