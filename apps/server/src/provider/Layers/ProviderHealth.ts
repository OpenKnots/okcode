/**
 * ProviderHealthLive - Startup-time provider health checks.
 *
 * Performs one-time provider readiness probes when the server starts and
 * keeps the resulting snapshot in memory for `server.getConfig`.
 *
 * Uses effect's ChildProcessSpawner to run CLI probes natively.
 *
 * @module ProviderHealthLive
 */
import * as OS from "node:os";
import { CopilotClient } from "@github/copilot-sdk";
import type {
  ServerProviderAuthStatus,
  ServerProviderStatus,
  ServerProviderStatusState,
} from "@okcode/contracts";
import {
  Array,
  Data,
  Effect,
  Fiber,
  FileSystem,
  Layer,
  Option,
  Path,
  Result,
  Stream,
} from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import {
  formatCodexCliUpgradeMessage,
  isCodexCliVersionSupported,
  parseCodexCliVersion,
} from "../codexCliVersion";
import { ProviderHealth, type ProviderHealthShape } from "../Services/ProviderHealth";

const DEFAULT_TIMEOUT_MS = 4_000;
const CODEX_PROVIDER = "codex" as const;
const CLAUDE_AGENT_PROVIDER = "claudeAgent" as const;
const COPILOT_PROVIDER = "copilot" as const;

class OpenClawHealthProbeError extends Data.TaggedError("OpenClawHealthProbeError")<{
  cause: unknown;
}> {}

class CopilotHealthProbeError extends Data.TaggedError("CopilotHealthProbeError")<{
  cause: unknown;
}> {}

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

// ── Codex CLI config detection ──────────────────────────────────────

/**
 * Providers that use OpenAI-native authentication via `codex login`.
 * When the configured `model_provider` is one of these, the `codex login
 * status` probe still runs. For any other provider value the auth probe
 * is skipped because authentication is handled externally (e.g. via
 * environment variables like `PORTKEY_API_KEY` or `AZURE_API_KEY`).
 */
const OPENAI_AUTH_PROVIDERS = new Set(["openai"]);

/**
 * Read the `model_provider` value from the Codex CLI config file.
 *
 * Looks for the file at `$CODEX_HOME/config.toml` (falls back to
 * `~/.codex/config.toml`). Uses a simple line-by-line scan rather than
 * a full TOML parser to avoid adding a dependency for a single key.
 *
 * Returns `undefined` when the file does not exist or does not set
 * `model_provider`.
 */
export const readCodexConfigModelProvider = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const codexHome = process.env.CODEX_HOME || path.join(OS.homedir(), ".codex");
  const configPath = path.join(codexHome, "config.toml");

  const content = yield* fileSystem
    .readFileString(configPath)
    .pipe(Effect.orElseSucceed(() => undefined));
  if (content === undefined) {
    return undefined;
  }

  // We need to find `model_provider = "..."` at the top level of the
  // TOML file (i.e. before any `[section]` header). Lines inside
  // `[profiles.*]`, `[model_providers.*]`, etc. are ignored.
  let inTopLevel = true;
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    // Skip comments and empty lines.
    if (!trimmed || trimmed.startsWith("#")) continue;
    // Detect section headers — once we leave the top level, stop.
    if (trimmed.startsWith("[")) {
      inTopLevel = false;
      continue;
    }
    if (!inTopLevel) continue;

    const match = trimmed.match(/^model_provider\s*=\s*["']([^"']+)["']/);
    if (match) return match[1];
  }
  return undefined;
});

/**
 * Returns `true` when the Codex CLI is configured with a custom
 * (non-OpenAI) model provider, meaning `codex login` auth is not
 * required because authentication is handled through provider-specific
 * environment variables.
 */
export const hasCustomModelProvider = Effect.map(
  readCodexConfigModelProvider,
  (provider) => provider !== undefined && !OPENAI_AUTH_PROVIDERS.has(provider),
);

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
      return {
        provider: COPILOT_PROVIDER,
        status: "error" as const,
        available: false,
        authStatus: "unknown" as const,
        checkedAt,
        message:
          error instanceof CopilotHealthProbeError
            ? `Failed to start GitHub Copilot CLI: ${String(error.cause)}.`
            : "Failed to start GitHub Copilot CLI.",
      } satisfies ServerProviderStatus;
    }

    if (Option.isNone(started.success)) {
      yield* Effect.promise(() =>
        client
          .forceStop()
          .then(() => undefined)
          .catch(() => undefined),
      );
      return {
        provider: COPILOT_PROVIDER,
        status: "error" as const,
        available: false,
        authStatus: "unknown" as const,
        checkedAt,
        message: "GitHub Copilot CLI timed out while starting.",
      } satisfies ServerProviderStatus;
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
      return {
        provider: COPILOT_PROVIDER,
        status: "warning" as const,
        available: true,
        authStatus: "unknown" as const,
        checkedAt,
        message:
          error instanceof CopilotHealthProbeError
            ? `Could not verify GitHub Copilot authentication status: ${String(error.cause)}.`
            : "Could not verify GitHub Copilot authentication status.",
      } satisfies ServerProviderStatus;
    }

    if (Option.isNone(authResult.success)) {
      return {
        provider: COPILOT_PROVIDER,
        status: "warning" as const,
        available: true,
        authStatus: "unknown" as const,
        checkedAt,
        message: "Could not verify GitHub Copilot authentication status. Timed out while checking.",
      } satisfies ServerProviderStatus;
    }

    const authStatus = authResult.success.value;
    return {
      provider: COPILOT_PROVIDER,
      status: authStatus.isAuthenticated ? ("ready" as const) : ("error" as const),
      available: true,
      authStatus: authStatus.isAuthenticated
        ? ("authenticated" as const)
        : ("unauthenticated" as const),
      checkedAt,
      ...(authStatus.statusMessage ? { message: authStatus.statusMessage } : {}),
    } satisfies ServerProviderStatus;
  });

// ── Health check ────────────────────────────────────────────────────

export const checkCodexProviderStatus: Effect.Effect<
  ServerProviderStatus,
  never,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> = Effect.gen(function* () {
  const checkedAt = new Date().toISOString();

  // Probe 1: `codex --version` — is the CLI reachable?
  const versionProbe = yield* runCodexCommand(["--version"]).pipe(
    Effect.timeoutOption(DEFAULT_TIMEOUT_MS),
    Effect.result,
  );

  if (Result.isFailure(versionProbe)) {
    const error = versionProbe.failure;
    return {
      provider: CODEX_PROVIDER,
      status: "error" as const,
      available: false,
      authStatus: "unknown" as const,
      checkedAt,
      message: isCommandMissingCause(error)
        ? "Codex CLI (`codex`) is not installed or not on PATH."
        : `Failed to execute Codex CLI health check: ${error instanceof Error ? error.message : String(error)}.`,
    };
  }

  if (Option.isNone(versionProbe.success)) {
    return {
      provider: CODEX_PROVIDER,
      status: "error" as const,
      available: false,
      authStatus: "unknown" as const,
      checkedAt,
      message: "Codex CLI is installed but failed to run. Timed out while running command.",
    };
  }

  const version = versionProbe.success.value;
  if (version.code !== 0) {
    const detail = detailFromResult(version);
    return {
      provider: CODEX_PROVIDER,
      status: "error" as const,
      available: false,
      authStatus: "unknown" as const,
      checkedAt,
      message: detail
        ? `Codex CLI is installed but failed to run. ${detail}`
        : "Codex CLI is installed but failed to run.",
    };
  }

  const parsedVersion = parseCodexCliVersion(`${version.stdout}\n${version.stderr}`);
  if (parsedVersion && !isCodexCliVersionSupported(parsedVersion)) {
    return {
      provider: CODEX_PROVIDER,
      status: "error" as const,
      available: false,
      authStatus: "unknown" as const,
      checkedAt,
      message: formatCodexCliUpgradeMessage(parsedVersion),
    };
  }

  // Probe 2: `codex login status` — is the user authenticated?
  //
  // Custom model providers (e.g. Portkey, Azure OpenAI proxy) handle
  // authentication through their own environment variables, so `codex
  // login status` will report "not logged in" even when the CLI works
  // fine.  Skip the auth probe entirely for non-OpenAI providers.
  if (yield* hasCustomModelProvider) {
    return {
      provider: CODEX_PROVIDER,
      status: "ready" as const,
      available: true,
      authStatus: "unknown" as const,
      checkedAt,
      message: "Using a custom Codex model provider; OpenAI login check skipped.",
    } satisfies ServerProviderStatus;
  }

  const authProbe = yield* runCodexCommand(["login", "status"]).pipe(
    Effect.timeoutOption(DEFAULT_TIMEOUT_MS),
    Effect.result,
  );

  if (Result.isFailure(authProbe)) {
    const error = authProbe.failure;
    return {
      provider: CODEX_PROVIDER,
      status: "warning" as const,
      available: true,
      authStatus: "unknown" as const,
      checkedAt,
      message:
        error instanceof Error
          ? `Could not verify Codex authentication status: ${error.message}.`
          : "Could not verify Codex authentication status.",
    };
  }

  if (Option.isNone(authProbe.success)) {
    return {
      provider: CODEX_PROVIDER,
      status: "warning" as const,
      available: true,
      authStatus: "unknown" as const,
      checkedAt,
      message: "Could not verify Codex authentication status. Timed out while running command.",
    };
  }

  const parsed = parseAuthStatusFromOutput(authProbe.success.value);
  return {
    provider: CODEX_PROVIDER,
    status: parsed.status,
    available: true,
    authStatus: parsed.authStatus,
    checkedAt,
    ...(parsed.message ? { message: parsed.message } : {}),
  } satisfies ServerProviderStatus;
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
    lowerOutput.includes("run claude login")
  ) {
    return {
      status: "error",
      authStatus: "unauthenticated",
      message: "Claude is not authenticated. Run `claude auth login` and try again.",
    };
  }

  // `claude auth status` returns JSON with a `loggedIn` boolean.
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
      message: "Claude is not authenticated. Run `claude auth login` and try again.",
    };
  }
  if (parsedAuth.attemptedJsonParse) {
    return {
      status: "warning",
      authStatus: "unknown",
      message:
        "Could not verify Claude authentication status from JSON output (missing auth marker).",
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
    return {
      provider: CLAUDE_AGENT_PROVIDER,
      status: "error" as const,
      available: false,
      authStatus: "unknown" as const,
      checkedAt,
      message: isCommandMissingCause(error)
        ? "Claude Agent CLI (`claude`) is not installed or not on PATH."
        : `Failed to execute Claude Agent CLI health check: ${error instanceof Error ? error.message : String(error)}.`,
    };
  }

  if (Option.isNone(versionProbe.success)) {
    return {
      provider: CLAUDE_AGENT_PROVIDER,
      status: "error" as const,
      available: false,
      authStatus: "unknown" as const,
      checkedAt,
      message: "Claude Agent CLI is installed but failed to run. Timed out while running command.",
    };
  }

  const version = versionProbe.success.value;
  if (version.code !== 0) {
    const detail = detailFromResult(version);
    return {
      provider: CLAUDE_AGENT_PROVIDER,
      status: "error" as const,
      available: false,
      authStatus: "unknown" as const,
      checkedAt,
      message: detail
        ? `Claude Agent CLI is installed but failed to run. ${detail}`
        : "Claude Agent CLI is installed but failed to run.",
    };
  }

  // Probe 2: `claude auth status` — is the user authenticated?
  const authProbe = yield* runClaudeCommand(["auth", "status"]).pipe(
    Effect.timeoutOption(DEFAULT_TIMEOUT_MS),
    Effect.result,
  );

  if (Result.isFailure(authProbe)) {
    const error = authProbe.failure;
    return {
      provider: CLAUDE_AGENT_PROVIDER,
      status: "warning" as const,
      available: true,
      authStatus: "unknown" as const,
      checkedAt,
      message:
        error instanceof Error
          ? `Could not verify Claude authentication status: ${error.message}.`
          : "Could not verify Claude authentication status.",
    };
  }

  if (Option.isNone(authProbe.success)) {
    return {
      provider: CLAUDE_AGENT_PROVIDER,
      status: "warning" as const,
      available: true,
      authStatus: "unknown" as const,
      checkedAt,
      message: "Could not verify Claude authentication status. Timed out while running command.",
    };
  }

  const parsed = parseClaudeAuthStatusFromOutput(authProbe.success.value);
  return {
    provider: CLAUDE_AGENT_PROVIDER,
    status: parsed.status,
    available: true,
    authStatus: parsed.authStatus,
    checkedAt,
    ...(parsed.message ? { message: parsed.message } : {}),
  } satisfies ServerProviderStatus;
});

// ── OpenClaw health check ─────────────────────────────────────────

const OPENCLAW_PROVIDER = "openclaw" as const;

const checkOpenClawProviderStatus: Effect.Effect<ServerProviderStatus, never, never> = Effect.gen(
  function* () {
    const checkedAt = new Date().toISOString();
    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL;

    if (!gatewayUrl) {
      return {
        provider: OPENCLAW_PROVIDER,
        status: "warning" as const,
        available: false,
        authStatus: "unknown" as const,
        checkedAt,
        message:
          "OpenClaw gateway URL is not configured. Set OPENCLAW_GATEWAY_URL or configure in settings.",
      } satisfies ServerProviderStatus;
    }

    // Derive HTTP health URL from the gateway URL (replace ws:// with http://).
    const healthUrl = gatewayUrl
      .replace(/^ws:\/\//, "http://")
      .replace(/^wss:\/\//, "https://")
      .replace(/\/$/, "")
      .concat("/health");

    const probeResult = yield* Effect.tryPromise({
      try: async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
        try {
          const response = await fetch(healthUrl, {
            signal: controller.signal,
          });
          return { ok: response.ok, status: response.status };
        } finally {
          clearTimeout(timeout);
        }
      },
      catch: (cause) => new OpenClawHealthProbeError({ cause }),
    }).pipe(Effect.result);

    if (Result.isFailure(probeResult)) {
      return {
        provider: OPENCLAW_PROVIDER,
        status: "warning" as const,
        available: false,
        authStatus: "unknown" as const,
        checkedAt,
        message: `Cannot reach OpenClaw gateway at ${gatewayUrl}. Check the URL and ensure the gateway is running.`,
      } satisfies ServerProviderStatus;
    }

    const probe = probeResult.success;
    if (!probe.ok) {
      return {
        provider: OPENCLAW_PROVIDER,
        status: "warning" as const,
        available: false,
        authStatus: "unknown" as const,
        checkedAt,
        message: `OpenClaw gateway at ${gatewayUrl} returned HTTP ${probe.status}.`,
      } satisfies ServerProviderStatus;
    }

    return {
      provider: OPENCLAW_PROVIDER,
      status: "ready" as const,
      available: true,
      authStatus: "unknown" as const,
      checkedAt,
    } satisfies ServerProviderStatus;
  },
);

// ── Layer ───────────────────────────────────────────────────────────

export const ProviderHealthLive = Layer.effect(
  ProviderHealth,
  Effect.gen(function* () {
    const statusesFiber = yield* Effect.all(
      [
        checkCodexProviderStatus,
        checkClaudeProviderStatus,
        checkCopilotProviderStatus,
        checkOpenClawProviderStatus,
      ],
      {
        concurrency: "unbounded",
      },
    ).pipe(Effect.forkScoped);

    return {
      getStatuses: Fiber.join(statusesFiber),
    } satisfies ProviderHealthShape;
  }),
);
