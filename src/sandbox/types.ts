export interface SandboxCommandResult {
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  blocked: boolean;
  sandboxed: boolean;
}

export interface SandboxExecutor {
  run(command: string, cwd: string, options?: { approveRisky?: boolean }): Promise<SandboxCommandResult>;
}
