/**
 * ProviderHealthLive - Startup-time provider health checks.
 *
 * Performs provider readiness probes on demand for `server.getConfig`.
 *
 * Uses effect's ChildProcessSpawner to run CLI probes natively.
 *
 * @module ProviderHealthLive
 */
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { CopilotClient } from "@github/copilot-sdk";
import type {
  ServerProvider,
  ServerProviderAuthStatus,
  ServerProviderStatus,
  ServerProviderStatusState,
} from "@okcode/contracts";
import { Array, Data, Effect, FileSystem, Layer, Option, Result, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { serverBuildInfo } from "../../buildInfo.ts";
import { buildCodexInitializeParams } from "../../codexAppServerManager.ts";
import { OpenclawGatewayClient, OpenclawGatewayClientError } from "../../openclaw/GatewayClient.ts";
import { OpenclawGatewayConfig } from "../../persistence/Services/OpenclawGatewayConfig.ts";
import {
  formatCodexCliUpgradeMessage,
  isCodexCliVersionSupported,
  parseCodexCliVersion,
} from "../codexCliVersion";
import { readCodexConfigSummary, usesOpenAiLoginForSelectedCodexBackend } from "../codexConfig";
import { withServerProviderModels } from "../providerCatalog.ts";
import { ProviderHealth, type ProviderHealthShape } from "../Services/ProviderHealth";

const DEFAULT_TIMEOUT_MS = 4_000;
const CODEX_PROVIDER = "codex" as const;
const CLAUDE_AGENT_PROVIDER = "claudeAgent" as const;
const COPILOT_PROVIDER = "copilot" as const;
const GEMINI_PROVIDER = "gemini" as const;

class OpenClawHealthProbeError extends Data.TaggedError("OpenClawHealthProbeError")<{
  cause: unknown;
}> {}

class CopilotHealthProbeError extends Data.TaggedError("CopilotHealthProbeError")<{
  cause: unknown;
}> {}

function formatHealthProbeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function createServerProviderStatus(
  input: Omit<ServerProvider, "models" | "available" | "authStatus">,
): ServerProviderStatus {
  return withServerProviderModels({
    ...input,
    available: (input.installed ?? false) && (input.enabled ?? true),
    authStatus: input.auth?.status ?? "unknown",
  });
}

function nonEmptyVersion(stdout: string, stderr: string): string | null {
  const version = nonEmptyTrimmed(stdout) ?? nonEmptyTrimmed(stderr);
  return version ?? null;
}

const OPENCLAW_HEALTH_REQUIRED_METHODS = [
  "sessions.create",
  "sessions.get",
  "sessions.send",
  "sessions.abort",
  "sessions.messages.subscribe",
] as const;

export function isOpenClawGatewayUnauthenticatedDetailCode(
  detailCode: string | undefined,
): boolean {
  return (
    detailCode === "PAIRING_REQUIRED" ||
    detailCode === "AUTH_TOKEN_MISSING" ||
    detailCode === "AUTH_PASSWORD_MISSING" ||
    detailCode === "AUTH_TOKEN_MISMATCH" ||
    detailCode === "AUTH_PASSWORD_MISMATCH" ||
    detailCode === "AUTH_DEVICE_TOKEN_MISMATCH" ||
    detailCode?.startsWith("DEVICE_AUTH_") === true
  );
}

// ── Pure helpers ────────────────────────────────────────────────────

export interface CommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
}

function nonEmptyTrimmed(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isCommandMissingCause(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const lower = error.message.toLowerCase();
  return lower.includes("enoent") || lower.includes("notfound");
}

function detailFromResult(
  result: CommandResult & { readonly timedOut?: boolean },
): string | undefined {
  if (result.timedOut) return "Timed out while running command.";
  const stderr = nonEmptyTrimmed(result.stderr);
  if (stderr) return stderr;
  const stdout = nonEmptyTrimmed(result.stdout);
  if (stdout) return stdout;
  if (result.code !== 0) {
    return `Command exited with code ${result.code}.`;
  }
  return undefined;
}

function extractAuthBoolean(value: unknown): boolean | undefined {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = extractAuthBoolean(entry);
      if (nested !== undefined) return nested;
    }
    return undefined;
  }

  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  for (const key of ["authenticated", "isAuthenticated", "loggedIn", "isLoggedIn"] as const) {
    if (typeof record[key] === "boolean") return record[key];
  }
  for (const key of ["auth", "status", "session", "account"] as const) {
    const nested = extractAuthBoolean(record[key]);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

function extractAuthString(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = extractAuthString(entry);
      if (nested !== undefined) return nested;
    }
    return undefined;
  }

  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  for (const key of ["authMethod", "auth_method", "method"] as const) {
    if (typeof record[key] === "string") return record[key];
  }
  for (const key of ["auth", "session", "account"] as const) {
    const nested = extractAuthString(record[key]);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

function hasGeminiHeadlessAuthEnv(): boolean {
  if (nonEmptyTrimmed(process.env.GEMINI_API_KEY) || nonEmptyTrimmed(process.env.GOOGLE_API_KEY)) {
    return true;
  }
  return Boolean(
    nonEmptyTrimmed(process.env.GOOGLE_APPLICATION_CREDENTIALS) &&
    nonEmptyTrimmed(process.env.GOOGLE_CLOUD_PROJECT) &&
    nonEmptyTrimmed(process.env.GOOGLE_CLOUD_LOCATION),
  );
}

const CLAUDE_CLI_AUTH_METHODS = new Set(["claude.ai", "oauth"]);
const CLAUDE_AUTH_GUIDANCE =
  "Run `claude auth login` and try again. API key and auth token credentials are not supported.";

export function parseAuthStatusFromOutput(result: CommandResult): {
  readonly status: ServerProviderStatusState;
  readonly authStatus: ServerProviderAuthStatus;
  readonly message?: string;
} {
  const lowerOutput = `${result.stdout}\n${result.stderr}`.toLowerCase();

  if (
    lowerOutput.includes("unknown command") ||
    lowerOutput.includes("unrecognized command") ||
    lowerOutput.includes("unexpected argument")
  ) {
    return {
      status: "warning",
      authStatus: "unknown",
      message: "Codex CLI authentication status command is unavailable in this Codex version.",
    };
  }

  if (
    lowerOutput.includes("not logged in") ||
    lowerOutput.includes("login required") ||
    lowerOutput.includes("authentication required") ||
    lowerOutput.includes("run `codex login`") ||
    lowerOutput.includes("run codex login")
  ) {
    return {
      status: "error",
      authStatus: "unauthenticated",
      message: "Codex CLI is not authenticated. Run `codex login` and try again.",
    };
  }

  const parsedAuth = (() => {
    const trimmed = result.stdout.trim();
    if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) {
      return { attemptedJsonParse: false as const, auth: undefined as boolean | undefined };
    }
    try {
      return {
        attemptedJsonParse: true as const,
        auth: extractAuthBoolean(JSON.parse(trimmed)),
      };
    } catch {
      return { attemptedJsonParse: false as const, auth: undefined as boolean | undefined };
    }
  })();

  if (parsedAuth.auth === true) {
    return { status: "ready", authStatus: "authenticated" };
  }
  if (parsedAuth.auth === false) {
    return {
      status: "error",
      authStatus: "unauthenticated",
      message: "Codex CLI is not authenticated. Run `codex login` and try again.",
    };
  }
  if (parsedAuth.attemptedJsonParse) {
    return {
      status: "warning",
      authStatus: "unknown",
      message:
        "Could not verify Codex authentication status from JSON output (missing auth marker).",
    };
  }
  if (result.code === 0) {
    return { status: "ready", authStatus: "authenticated" };
  }

  const detail = detailFromResult(result);
  return {
    status: "warning",
    authStatus: "unknown",
    message: detail
      ? `Could not verify Codex authentication status. ${detail}`
      : "Could not verify Codex authentication status.",
  };
}

// ── Effect-native command execution ─────────────────────────────────

const collectStreamAsString = <E>(stream: Stream.Stream<Uint8Array, E>): Effect.Effect<string, E> =>
  Stream.runFold(
    stream,
    () => "",
    (acc, chunk) => acc + new TextDecoder().decode(chunk),
  );

const runCodexCommand = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const command = ChildProcess.make("codex", [...args], {
      shell: process.platform === "win32",
      env: process.env,
    });

    const child = yield* spawner.spawn(command);

    const [stdout, stderr, exitCode] = yield* Effect.all(
      [
        collectStreamAsString(child.stdout),
        collectStreamAsString(child.stderr),
        child.exitCode.pipe(Effect.map(Number)),
      ],
      { concurrency: "unbounded" },
    );

    return { stdout, stderr, code: exitCode } satisfies CommandResult;
  }).pipe(Effect.scoped);

async function probeCodexAppServerThreadStart(): Promise<void> {
  const child = spawn("codex", ["app-server"], {
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
    detached: process.platform !== "win32",
    shell: process.platform === "win32",
  });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let nextId = 1;
    const pending = new Map<
      number,
      { resolve: (value: unknown) => void; reject: (error: Error) => void }
    >();
    const stdout = createInterface({ input: child.stdout });
    const stderrLines: string[] = [];
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while probing codex app-server thread/start readiness."));
    }, DEFAULT_TIMEOUT_MS);

    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      stdout.close();
      killCodexProbeChildTree(child);
    };

    child.stderr.on("data", (chunk) => {
      stderrLines.push(chunk.toString("utf-8"));
    });

    child.on("error", (error) => {
      cleanup();
      reject(error);
    });

    child.on("exit", (code) => {
      if (settled) return;
      cleanup();
      reject(
        new Error(
          `Codex app-server exited before thread/start completed (code ${code ?? "unknown"}). ${stderrLines.join("").trim()}`,
        ),
      );
    });

    stdout.on("line", (line) => {
      let parsed: { id?: number; result?: unknown; error?: { message?: string } };
      try {
        parsed = JSON.parse(line);
      } catch {
        return;
      }
      if (typeof parsed.id !== "number") {
        return;
      }
      const request = pending.get(parsed.id);
      if (!request) {
        return;
      }
      pending.delete(parsed.id);
      if (parsed.error) {
        request.reject(new Error(parsed.error.message ?? "JSON-RPC request failed."));
        return;
      }
      request.resolve(parsed.result);
    });

    const sendRequest = (method: string, params?: unknown) =>
      new Promise<unknown>((requestResolve, requestReject) => {
        const id = nextId++;
        pending.set(id, { resolve: requestResolve, reject: requestReject });
        child.stdin.write(
          `${JSON.stringify({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) })}\n`,
        );
      });

    void (async () => {
      try {
        await sendRequest("initialize", buildCodexInitializeParams());
        child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "initialized" })}\n`);
        await sendRequest("thread/start", {});
        cleanup();
        resolve();
      } catch (error) {
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    })();
  });
}

function killCodexProbeChildTree(child: ChildProcessWithoutNullStreams): void {
  if (child.killed) {
    return;
  }

  try {
    if (process.platform === "win32") {
      if (typeof child.pid === "number") {
        const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true,
        });
        killer.unref();
      }
      return;
    }

    if (typeof child.pid === "number") {
      process.kill(-child.pid, "SIGKILL");
      return;
    }

    child.kill("SIGKILL");
  } catch {
    // Best-effort cleanup only.
  }
}

let codexAppServerThreadStartProbe: () => Promise<void> = probeCodexAppServerThreadStart;

export function setCodexAppServerThreadStartProbeForTest(
  probe: (() => Promise<void>) | null,
): () => void {
  const previous = codexAppServerThreadStartProbe;
  codexAppServerThreadStartProbe = probe ?? probeCodexAppServerThreadStart;
  return () => {
    codexAppServerThreadStartProbe = previous;
  };
}

const runClaudeCommand = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const command = ChildProcess.make("claude", [...args], {
      shell: process.platform === "win32",
      env: process.env,
    });

    const child = yield* spawner.spawn(command);

    const [stdout, stderr, exitCode] = yield* Effect.all(
      [
        collectStreamAsString(child.stdout),
        collectStreamAsString(child.stderr),
        child.exitCode.pipe(Effect.map(Number)),
      ],
      { concurrency: "unbounded" },
    );

    return { stdout, stderr, code: exitCode } satisfies CommandResult;
  }).pipe(Effect.scoped);

const runGeminiCommand = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const command = ChildProcess.make("gemini", [...args], {
      shell: process.platform === "win32",
      env: process.env,
    });

    const child = yield* spawner.spawn(command);

    const [stdout, stderr, exitCode] = yield* Effect.all(
      [
        collectStreamAsString(child.stdout),
        collectStreamAsString(child.stderr),
        child.exitCode.pipe(Effect.map(Number)),
      ],
      { concurrency: "unbounded" },
    );

    return { stdout, stderr, code: exitCode } satisfies CommandResult;
  }).pipe(Effect.scoped);

export const checkCopilotProviderStatus: Effect.Effect<ServerProviderStatus, never, never> =
  Effect.gen(function* () {
    const checkedAt = new Date().toISOString();
    const client = new CopilotClient({ logLevel: "error" });

    const started = yield* Effect.tryPromise({
      try: () => client.start(),
      catch: (cause) => new CopilotHealthProbeError({ cause }),
    }).pipe(Effect.timeoutOption(DEFAULT_TIMEOUT_MS), Effect.result);

    if (Result.isFailure(started)) {
      const error = started.failure;
      return createServerProviderStatus({
        provider: COPILOT_PROVIDER,
        enabled: true,
        installed: false,
        version: null,
        status: "error" as const,
        auth: { status: "unknown" as const },
        checkedAt,
        message:
          error instanceof CopilotHealthProbeError
            ? `Failed to start GitHub Copilot CLI: ${formatHealthProbeCause(error.cause)}.`
            : "Failed to start GitHub Copilot CLI.",
      });
    }

    if (Option.isNone(started.success)) {
      yield* Effect.promise(() =>
        client
          .forceStop()
          .then(() => undefined)
          .catch(() => undefined),
      );
      return createServerProviderStatus({
        provider: COPILOT_PROVIDER,
        enabled: true,
        installed: false,
        version: null,
        status: "error" as const,
        auth: { status: "unknown" as const },
        checkedAt,
        message: "GitHub Copilot CLI timed out while starting.",
      });
    }

    const authResult = yield* Effect.tryPromise({
      try: () => client.getAuthStatus(),
      catch: (cause) => new CopilotHealthProbeError({ cause }),
    }).pipe(Effect.timeoutOption(DEFAULT_TIMEOUT_MS), Effect.result);
    yield* Effect.promise(() =>
      client
        .stop()
        .then(() => undefined)
        .catch(() => undefined),
    );

    if (Result.isFailure(authResult)) {
      const error = authResult.failure;
      return createServerProviderStatus({
        provider: COPILOT_PROVIDER,
        enabled: true,
        installed: true,
        version: null,
        status: "warning" as const,
        auth: { status: "unknown" as const },
        checkedAt,
        message:
          error instanceof CopilotHealthProbeError
            ? `Could not verify GitHub Copilot authentication status: ${formatHealthProbeCause(error.cause)}.`
            : "Could not verify GitHub Copilot authentication status.",
      });
    }

    if (Option.isNone(authResult.success)) {
      return createServerProviderStatus({
        provider: COPILOT_PROVIDER,
        enabled: true,
        installed: true,
        version: null,
        status: "warning" as const,
        auth: { status: "unknown" as const },
        checkedAt,
        message: "Could not verify GitHub Copilot authentication status. Timed out while checking.",
      });
    }

    const authStatus = authResult.success.value as {
      readonly isAuthenticated: boolean;
      readonly statusMessage?: string;
    };
    return createServerProviderStatus({
      provider: COPILOT_PROVIDER,
      enabled: true,
      installed: true,
      version: null,
      status: authStatus.isAuthenticated ? ("ready" as const) : ("error" as const),
      auth: {
        status: authStatus.isAuthenticated
          ? ("authenticated" as const)
          : ("unauthenticated" as const),
      },
      checkedAt,
      ...(authStatus.statusMessage ? { message: authStatus.statusMessage } : {}),
    });
  });

// ── Health check ────────────────────────────────────────────────────

export const checkCodexProviderStatus: Effect.Effect<
  ServerProviderStatus,
  never,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem
> = Effect.gen(function* () {
  const checkedAt = new Date().toISOString();

  // Probe 1: `codex --version` — is the CLI reachable?
  const versionProbe = yield* runCodexCommand(["--version"]).pipe(
    Effect.timeoutOption(DEFAULT_TIMEOUT_MS),
    Effect.result,
  );

  if (Result.isFailure(versionProbe)) {
    const error = versionProbe.failure;
    return createServerProviderStatus({
      provider: CODEX_PROVIDER,
      enabled: true,
      installed: false,
      version: null,
      status: "error" as const,
      auth: { status: "unknown" as const },
      checkedAt,
      message: isCommandMissingCause(error)
        ? "Codex CLI (`codex`) is not installed or not on PATH."
        : `Failed to execute Codex CLI health check: ${error instanceof Error ? error.message : String(error)}.`,
    });
  }

  if (Option.isNone(versionProbe.success)) {
    return createServerProviderStatus({
      provider: CODEX_PROVIDER,
      enabled: true,
      installed: false,
      version: null,
      status: "error" as const,
      auth: { status: "unknown" as const },
      checkedAt,
      message: "Codex CLI is installed but failed to run. Timed out while running command.",
    });
  }

  const version = versionProbe.success.value;
  if (version.code !== 0) {
    const detail = detailFromResult(version);
    return createServerProviderStatus({
      provider: CODEX_PROVIDER,
      enabled: true,
      installed: false,
      version: nonEmptyVersion(version.stdout, version.stderr),
      status: "error" as const,
      auth: { status: "unknown" as const },
      checkedAt,
      message: detail
        ? `Codex CLI is installed but failed to run. ${detail}`
        : "Codex CLI is installed but failed to run.",
    });
  }

  const parsedVersion = parseCodexCliVersion(`${version.stdout}\n${version.stderr}`);
  if (parsedVersion && !isCodexCliVersionSupported(parsedVersion)) {
    return createServerProviderStatus({
      provider: CODEX_PROVIDER,
      enabled: true,
      installed: true,
      version: nonEmptyVersion(version.stdout, version.stderr),
      status: "error" as const,
      auth: { status: "unknown" as const },
      checkedAt,
      message: formatCodexCliUpgradeMessage(parsedVersion),
    });
  }

  const codexConfig = yield* readCodexConfigSummary();

  // Probe 2: `codex login status` — is the user authenticated?
  //
  // Non-OpenAI backends handle authentication externally, so `codex
  // login status` is only meaningful for the default OpenAI backend.
  if (!usesOpenAiLoginForSelectedCodexBackend(codexConfig)) {
    return createServerProviderStatus({
      provider: CODEX_PROVIDER,
      enabled: true,
      installed: true,
      version: nonEmptyVersion(version.stdout, version.stderr),
      status: "ready" as const,
      auth: { status: "unknown" as const },
      checkedAt,
      message: `Codex is configured to use backend '${codexConfig.selectedModelProviderId}'; OpenAI login check skipped.`,
    });
  }

  const authProbe = yield* runCodexCommand(["login", "status"]).pipe(
    Effect.timeoutOption(DEFAULT_TIMEOUT_MS),
    Effect.result,
  );

  if (Result.isFailure(authProbe)) {
    const error = authProbe.failure;
    return createServerProviderStatus({
      provider: CODEX_PROVIDER,
      enabled: true,
      installed: true,
      version: nonEmptyVersion(version.stdout, version.stderr),
      status: "warning" as const,
      auth: { status: "unknown" as const },
      checkedAt,
      message:
        error instanceof Error
          ? `Could not verify Codex authentication status: ${error.message}.`
          : "Could not verify Codex authentication status.",
    });
  }

  if (Option.isNone(authProbe.success)) {
    return createServerProviderStatus({
      provider: CODEX_PROVIDER,
      enabled: true,
      installed: true,
      version: nonEmptyVersion(version.stdout, version.stderr),
      status: "warning" as const,
      auth: { status: "unknown" as const },
      checkedAt,
      message: "Could not verify Codex authentication status. Timed out while running command.",
    });
  }

  const parsed = parseAuthStatusFromOutput(authProbe.success.value);
  if (parsed.authStatus === "unauthenticated") {
    const runtimeProbe = yield* Effect.tryPromise({
      try: () => codexAppServerThreadStartProbe(),
      catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
    }).pipe(Effect.result);

    if (Result.isSuccess(runtimeProbe)) {
      return createServerProviderStatus({
        provider: CODEX_PROVIDER,
        enabled: true,
        installed: true,
        version: nonEmptyVersion(version.stdout, version.stderr),
        status: "ready" as const,
        auth: { status: "unknown" as const },
        checkedAt,
        message:
          "Codex app-server can start turns with the current configuration even though `codex login status` did not report an authenticated account.",
      });
    }
  }

  return createServerProviderStatus({
    provider: CODEX_PROVIDER,
    enabled: true,
    installed: true,
    version: nonEmptyVersion(version.stdout, version.stderr),
    status: parsed.status,
    auth: { status: parsed.authStatus },
    checkedAt,
    ...(parsed.message ? { message: parsed.message } : {}),
  });
});

// ── Claude Agent health check ───────────────────────────────────────

export function parseClaudeAuthStatusFromOutput(result: CommandResult): {
  readonly status: ServerProviderStatusState;
  readonly authStatus: ServerProviderAuthStatus;
  readonly message?: string;
} {
  const lowerOutput = `${result.stdout}\n${result.stderr}`.toLowerCase();

  if (
    lowerOutput.includes("unknown command") ||
    lowerOutput.includes("unrecognized command") ||
    lowerOutput.includes("unexpected argument")
  ) {
    return {
      status: "warning",
      authStatus: "unknown",
      message:
        "Claude Agent authentication status command is unavailable in this version of Claude.",
    };
  }

  if (
    lowerOutput.includes("not logged in") ||
    lowerOutput.includes("login required") ||
    lowerOutput.includes("authentication required") ||
    lowerOutput.includes("run `claude login`") ||
    lowerOutput.includes("run claude login") ||
    lowerOutput.includes("api key and auth token credentials are not supported")
  ) {
    return {
      status: "error",
      authStatus: "unauthenticated",
      message: `Claude Code must be authenticated with \`claude auth login\` before starting a session. ${CLAUDE_AUTH_GUIDANCE}`,
    };
  }

  // `claude auth status` returns JSON with a `loggedIn` boolean.
  const parsedAuth = (() => {
    const trimmed = result.stdout.trim();
    if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) {
      return {
        attemptedJsonParse: false as const,
        auth: undefined as boolean | undefined,
        authMethod: undefined as string | undefined,
      };
    }
    try {
      const parsed = JSON.parse(trimmed);
      return {
        attemptedJsonParse: true as const,
        auth: extractAuthBoolean(parsed),
        authMethod: extractAuthString(parsed),
      };
    } catch {
      return {
        attemptedJsonParse: false as const,
        auth: undefined as boolean | undefined,
        authMethod: undefined as string | undefined,
      };
    }
  })();

  const authMethod = parsedAuth.authMethod?.trim();
  const normalizedAuthMethod = authMethod?.toLowerCase();
  if (parsedAuth.auth === true) {
    if (normalizedAuthMethod && !CLAUDE_CLI_AUTH_METHODS.has(normalizedAuthMethod)) {
      return {
        status: "error",
        authStatus: "unauthenticated",
        message: `Claude authentication status reported unsupported credential type '${authMethod}'. ${CLAUDE_AUTH_GUIDANCE}`,
      };
    }
    if (normalizedAuthMethod && CLAUDE_CLI_AUTH_METHODS.has(normalizedAuthMethod)) {
      return {
        status: "ready",
        authStatus: "authenticated",
        message: "Claude Code CLI is ready via `claude auth login`.",
      };
    }
    return {
      status: "warning",
      authStatus: "unknown",
      message: "Could not verify Claude CLI authentication method from status output.",
    };
  }
  if (parsedAuth.auth === false) {
    return {
      status: "error",
      authStatus: "unauthenticated",
      message: `Claude Code must be authenticated with \`claude auth login\` before starting a session. ${CLAUDE_AUTH_GUIDANCE}`,
    };
  }
  if (parsedAuth.attemptedJsonParse) {
    if (normalizedAuthMethod && !CLAUDE_CLI_AUTH_METHODS.has(normalizedAuthMethod)) {
      return {
        status: "error",
        authStatus: "unauthenticated",
        message: `Claude authentication status reported unsupported credential type '${authMethod}'. ${CLAUDE_AUTH_GUIDANCE}`,
      };
    }
    return {
      status: "warning",
      authStatus: "unknown",
      message:
        "Could not verify Claude authentication status from JSON output (missing auth marker).",
    };
  }
  const detail = detailFromResult(result);
  return {
    status: "warning",
    authStatus: "unknown",
    message: detail
      ? `Could not verify Claude authentication status. ${detail}`
      : "Could not verify Claude authentication status.",
  };
}

export const checkClaudeProviderStatus: Effect.Effect<
  ServerProviderStatus,
  never,
  ChildProcessSpawner.ChildProcessSpawner
> = Effect.gen(function* () {
  const checkedAt = new Date().toISOString();

  // Probe 1: `claude --version` — is the CLI reachable?
  const versionProbe = yield* runClaudeCommand(["--version"]).pipe(
    Effect.timeoutOption(DEFAULT_TIMEOUT_MS),
    Effect.result,
  );

  if (Result.isFailure(versionProbe)) {
    const error = versionProbe.failure;
    return createServerProviderStatus({
      provider: CLAUDE_AGENT_PROVIDER,
      enabled: true,
      installed: false,
      version: null,
      status: "error" as const,
      auth: { status: "unknown" as const },
      checkedAt,
      message: isCommandMissingCause(error)
        ? "Claude Agent CLI (`claude`) is not installed or not on PATH."
        : `Failed to execute Claude Agent CLI health check: ${error instanceof Error ? error.message : String(error)}.`,
    });
  }

  if (Option.isNone(versionProbe.success)) {
    return createServerProviderStatus({
      provider: CLAUDE_AGENT_PROVIDER,
      enabled: true,
      installed: false,
      version: null,
      status: "error" as const,
      auth: { status: "unknown" as const },
      checkedAt,
      message: "Claude Agent CLI is installed but failed to run. Timed out while running command.",
    });
  }

  const version = versionProbe.success.value;
  if (version.code !== 0) {
    const detail = detailFromResult(version);
    return createServerProviderStatus({
      provider: CLAUDE_AGENT_PROVIDER,
      enabled: true,
      installed: false,
      version: nonEmptyVersion(version.stdout, version.stderr),
      status: "error" as const,
      auth: { status: "unknown" as const },
      checkedAt,
      message: detail
        ? `Claude Agent CLI is installed but failed to run. ${detail}`
        : "Claude Agent CLI is installed but failed to run.",
    });
  }

  // Probe 2: `claude auth status` — is the user authenticated?
  const authProbe = yield* runClaudeCommand(["auth", "status"]).pipe(
    Effect.timeoutOption(DEFAULT_TIMEOUT_MS),
    Effect.result,
  );

  if (Result.isFailure(authProbe)) {
    const error = authProbe.failure;
    return createServerProviderStatus({
      provider: CLAUDE_AGENT_PROVIDER,
      enabled: true,
      installed: true,
      version: nonEmptyVersion(version.stdout, version.stderr),
      status: "warning" as const,
      auth: { status: "unknown" as const },
      checkedAt,
      message:
        error instanceof Error
          ? `Could not verify Claude authentication status: ${error.message}.`
          : "Could not verify Claude authentication status.",
    });
  }

  if (Option.isNone(authProbe.success)) {
    return createServerProviderStatus({
      provider: CLAUDE_AGENT_PROVIDER,
      enabled: true,
      installed: true,
      version: nonEmptyVersion(version.stdout, version.stderr),
      status: "warning" as const,
      auth: { status: "unknown" as const },
      checkedAt,
      message: "Could not verify Claude authentication status. Timed out while running command.",
    });
  }

  const parsed = parseClaudeAuthStatusFromOutput(authProbe.success.value);
  return createServerProviderStatus({
    provider: CLAUDE_AGENT_PROVIDER,
    enabled: true,
    installed: true,
    version: nonEmptyVersion(version.stdout, version.stderr),
    status: parsed.status,
    auth: { status: parsed.authStatus },
    checkedAt,
    ...(parsed.message ? { message: parsed.message } : {}),
  });
});

// ── OpenClaw health check ─────────────────────────────────────────

const OPENCLAW_PROVIDER = "openclaw" as const;

const checkOpenClawProviderStatus: Effect.Effect<
  ServerProviderStatus,
  never,
  OpenclawGatewayConfig
> = Effect.gen(function* () {
  const checkedAt = new Date().toISOString();
  const gatewayConfig = yield* OpenclawGatewayConfig;
  const resolvedConfigResult = yield* gatewayConfig.resolveForConnect().pipe(
    Effect.match({
      onSuccess: (resolvedConfig) => ({ ok: true as const, resolvedConfig }),
      onFailure: (cause) => ({ ok: false as const, cause }),
    }),
  );

  if (!resolvedConfigResult.ok) {
    const reason =
      resolvedConfigResult.cause instanceof Error
        ? resolvedConfigResult.cause.message
        : String(resolvedConfigResult.cause);

    return createServerProviderStatus({
      provider: OPENCLAW_PROVIDER,
      enabled: true,
      installed: false,
      version: null,
      status: "error" as const,
      auth: { status: "unknown" as const },
      checkedAt,
      message: `OpenClaw gateway configuration could not be read. ${reason}`,
    });
  }

  const resolvedConfig = resolvedConfigResult.resolvedConfig;

  if (!resolvedConfig) {
    return createServerProviderStatus({
      provider: OPENCLAW_PROVIDER,
      enabled: true,
      installed: false,
      version: null,
      status: "error" as const,
      auth: { status: "unauthenticated" as const },
      checkedAt,
      message: "OpenClaw gateway URL is not configured. Save it in Settings to enable OpenClaw.",
    });
  }

  const connectResult = yield* Effect.tryPromise({
    try: async () => {
      const connection = await OpenclawGatewayClient.connect({
        url: resolvedConfig.gatewayUrl,
        identity: {
          deviceId: resolvedConfig.deviceId,
          deviceFingerprint: resolvedConfig.deviceFingerprint,
          publicKey: resolvedConfig.devicePublicKey,
          privateKeyPem: resolvedConfig.devicePrivateKeyPem,
        },
        ...(resolvedConfig.sharedSecret ? { sharedSecret: resolvedConfig.sharedSecret } : {}),
        ...(resolvedConfig.deviceToken ? { deviceToken: resolvedConfig.deviceToken } : {}),
        ...(resolvedConfig.deviceTokenRole
          ? { deviceTokenRole: resolvedConfig.deviceTokenRole }
          : {}),
        ...(resolvedConfig.deviceTokenScopes.length > 0
          ? { deviceTokenScopes: resolvedConfig.deviceTokenScopes }
          : {}),
        clientId: "okcode",
        clientVersion: serverBuildInfo.version,
        clientPlatform:
          process.platform === "darwin"
            ? "macos"
            : process.platform === "win32"
              ? "windows"
              : process.platform,
        clientMode: "operator",
        locale: Intl.DateTimeFormat().resolvedOptions().locale || "en-US",
        userAgent: `okcode/${serverBuildInfo.version}`,
        role: "operator",
        scopes: ["operator.read", "operator.write"],
        requiredMethods: OPENCLAW_HEALTH_REQUIRED_METHODS,
      });
      try {
        const deviceToken = connection.connect.auth?.deviceToken;
        if (deviceToken && deviceToken !== resolvedConfig.deviceToken) {
          await Effect.runPromise(
            gatewayConfig.saveDeviceToken({
              deviceToken,
              ...(connection.connect.auth?.role ? { role: connection.connect.auth.role } : {}),
              ...(connection.connect.auth?.scopes.length
                ? { scopes: connection.connect.auth.scopes }
                : {}),
            }),
          );
        }
      } finally {
        await connection.client.close();
      }
      return connection.connect;
    },
    catch: (cause) => new OpenClawHealthProbeError({ cause }),
  }).pipe(Effect.result);

  if (Result.isSuccess(connectResult)) {
    return createServerProviderStatus({
      provider: OPENCLAW_PROVIDER,
      enabled: true,
      installed: true,
      version: null,
      status: "ready" as const,
      auth: { status: "authenticated" as const },
      checkedAt,
    });
  }

  const cause = connectResult.failure.cause;
  if (cause instanceof OpenClawHealthProbeError) {
    const error = cause.cause;
    if (error instanceof OpenclawGatewayClientError) {
      const detailCode = error.gatewayError?.detailCode;
      const gatewayMessage = error.gatewayError?.message ?? error.message;
      if (isOpenClawGatewayUnauthenticatedDetailCode(detailCode)) {
        return createServerProviderStatus({
          provider: OPENCLAW_PROVIDER,
          enabled: true,
          installed: true,
          version: null,
          status: "error" as const,
          auth: { status: "unauthenticated" as const },
          checkedAt,
          message: gatewayMessage,
        });
      }
    }
  }

  return createServerProviderStatus({
    provider: OPENCLAW_PROVIDER,
    enabled: true,
    installed: true,
    version: null,
    status: "warning" as const,
    auth: { status: "unknown" as const },
    checkedAt,
    message: `Cannot complete the OpenClaw gateway handshake at ${resolvedConfig.gatewayUrl}. Check connectivity, proxying, and pairing/device auth state.`,
  });
});

export const checkGeminiProviderStatus: Effect.Effect<
  ServerProviderStatus,
  never,
  ChildProcessSpawner.ChildProcessSpawner
> = Effect.gen(function* () {
  const checkedAt = new Date().toISOString();
  const versionProbe = yield* runGeminiCommand(["--version"]).pipe(
    Effect.timeoutOption(DEFAULT_TIMEOUT_MS),
    Effect.result,
  );

  if (Result.isFailure(versionProbe)) {
    const error = versionProbe.failure;
    return createServerProviderStatus({
      provider: GEMINI_PROVIDER,
      enabled: true,
      installed: false,
      version: null,
      status: "error",
      auth: { status: "unknown" },
      checkedAt,
      message: isCommandMissingCause(error)
        ? "Gemini CLI (`gemini`) is not installed or not on PATH."
        : `Failed to execute Gemini CLI health check: ${error instanceof Error ? error.message : String(error)}.`,
    });
  }

  if (Option.isNone(versionProbe.success)) {
    return createServerProviderStatus({
      provider: GEMINI_PROVIDER,
      enabled: true,
      installed: false,
      version: null,
      status: "error",
      auth: { status: "unknown" },
      checkedAt,
      message: "Gemini CLI is installed but failed to run. Timed out while running command.",
    });
  }

  const version = versionProbe.success.value;
  if (version.code !== 0) {
    return createServerProviderStatus({
      provider: GEMINI_PROVIDER,
      enabled: true,
      installed: false,
      version: nonEmptyVersion(version.stdout, version.stderr),
      status: "error",
      auth: { status: "unknown" },
      checkedAt,
      message: detailFromResult(version) ?? "Gemini CLI is installed but failed to run.",
    });
  }

  if (hasGeminiHeadlessAuthEnv()) {
    return createServerProviderStatus({
      provider: GEMINI_PROVIDER,
      enabled: true,
      installed: true,
      version: nonEmptyVersion(version.stdout, version.stderr),
      status: "ready",
      auth: { status: "authenticated", type: "headless", label: "Environment credentials" },
      checkedAt,
    });
  }

  return createServerProviderStatus({
    provider: GEMINI_PROVIDER,
    enabled: true,
    installed: true,
    version: nonEmptyVersion(version.stdout, version.stderr),
    status: "warning",
    auth: { status: "unknown" },
    checkedAt,
    message:
      "Gemini CLI is installed. Headless auth was not prevalidated; cached OAuth may still work locally, or configure GEMINI_API_KEY / Vertex credentials for non-interactive use.",
  });
});

// ── Layer ───────────────────────────────────────────────────────────

export const ProviderHealthLive = Layer.effect(
  ProviderHealth,
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const openclawGatewayConfig = yield* OpenclawGatewayConfig;

    return {
      getStatuses: Effect.all(
        [
          checkCodexProviderStatus,
          checkClaudeProviderStatus,
          checkCopilotProviderStatus,
          checkOpenClawProviderStatus,
          checkGeminiProviderStatus,
        ],
        {
          concurrency: "unbounded",
        },
      ).pipe(
        Effect.provideService(FileSystem.FileSystem, fileSystem),
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
        Effect.provideService(OpenclawGatewayConfig, openclawGatewayConfig),
      ),
    } satisfies ProviderHealthShape;
  }),
);
