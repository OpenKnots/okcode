import { spawnSync, type SpawnSyncReturns } from "node:child_process";

const DEFAULT_HELPER_TIMEOUT_MS = 5_000;
const DEFAULT_HELPER_MAX_BUFFER_BYTES = 64 * 1024;

export interface ClaudeAuthTokenHelperExecutionOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly maxBuffer?: number;
  readonly platform?: NodeJS.Platform;
  readonly spawnSync?: (
    command: string,
    args: ReadonlyArray<string>,
    options: {
      readonly cwd?: string;
      readonly encoding: "utf8";
      readonly env?: NodeJS.ProcessEnv;
      readonly maxBuffer: number;
      readonly timeout: number;
    },
  ) => SpawnSyncReturns<string>;
  readonly timeoutMs?: number;
}

function trimSingleLineOutput(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }
  if (trimmed.includes("\n") || trimmed.includes("\r")) {
    throw new Error("Claude auth token helper command must print a single-line token.");
  }
  return trimmed;
}

function shellCommandForPlatform(platform: NodeJS.Platform): {
  readonly command: string;
  readonly args: readonly string[];
} {
  if (platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c"],
    };
  }

  return {
    command: "/bin/sh",
    args: ["-lc"],
  };
}

function formatHelperFailureMessage(result: SpawnSyncReturns<string>): string {
  if (result.error instanceof Error) {
    return result.error.message;
  }

  const stderr = result.stderr.trim();
  if (stderr.length > 0) {
    return stderr;
  }

  if (result.status === null) {
    return "Timed out while running Claude auth token helper command.";
  }

  return `Claude auth token helper command exited with code ${result.status}.`;
}

export function readClaudeAuthTokenFromHelperCommand(
  helperCommand: string,
  options?: ClaudeAuthTokenHelperExecutionOptions,
): string {
  const command = helperCommand.trim();
  if (command.length === 0) {
    throw new Error("Claude auth token helper command is empty.");
  }

  const platform = options?.platform ?? process.platform;
  const shell = shellCommandForPlatform(platform);
  const spawn = options?.spawnSync ?? spawnSync;
  const result = spawn(shell.command, [...shell.args, command], {
    encoding: "utf8",
    maxBuffer: options?.maxBuffer ?? DEFAULT_HELPER_MAX_BUFFER_BYTES,
    timeout: options?.timeoutMs ?? DEFAULT_HELPER_TIMEOUT_MS,
    ...(options?.cwd ? { cwd: options.cwd } : {}),
    ...(options?.env ? { env: options.env } : {}),
  }) as SpawnSyncReturns<string>;

  if (result.error || result.status !== 0) {
    throw new Error(formatHelperFailureMessage(result));
  }

  const token = trimSingleLineOutput(result.stdout);
  if (token.length === 0) {
    throw new Error("Claude auth token helper command returned no output.");
  }

  return token;
}
