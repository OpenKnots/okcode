import { Effect } from "effect";

export interface LocalBackendProbeResult {
  readonly reachable: boolean;
  readonly modelCount?: number;
  readonly error?: string;
}

export interface LocalBackendProbes {
  readonly ollama: LocalBackendProbeResult;
  readonly lmstudio: LocalBackendProbeResult;
}

const DEFAULT_PROBE_TIMEOUT_MS = 1_500;

const OLLAMA_TAGS_URL = "http://localhost:11434/api/tags";
const LM_STUDIO_MODELS_URL = "http://localhost:1234/v1/models";

function isSuppressedByEnv(): boolean {
  const env = process.env;
  return env.OKCODE_DISABLE_LOCAL_BACKEND_PROBES === "1" || env.VITEST === "true";
}

function toErrorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof Error && cause.message.trim().length > 0) {
    if (cause.name === "AbortError") {
      return "timeout";
    }
    return cause.message;
  }
  if (typeof cause === "string" && cause.trim().length > 0) {
    return cause;
  }
  return fallback;
}

function readModelCount(data: unknown, key: "models" | "data"): number | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }
  const value = (data as Record<string, unknown>)[key];
  if (Array.isArray(value)) {
    return value.length;
  }
  return undefined;
}

async function probeHttp(input: {
  readonly url: string;
  readonly modelsKey: "models" | "data";
  readonly timeoutMs: number;
}): Promise<LocalBackendProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await fetch(input.url, {
      method: "GET",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      return {
        reachable: false,
        error: `HTTP ${response.status}`,
      };
    }
    try {
      const body: unknown = await response.json();
      const modelCount = readModelCount(body, input.modelsKey);
      return modelCount !== undefined ? { reachable: true, modelCount } : { reachable: true };
    } catch (cause) {
      // Server responded 2xx but body wasn't JSON — still counts as reachable.
      return {
        reachable: true,
        error: toErrorMessage(cause, "Non-JSON response"),
      };
    }
  } catch (cause) {
    return {
      reachable: false,
      error: toErrorMessage(cause, "Network error"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export interface ProbeLocalBackendOptions {
  readonly timeoutMs?: number | undefined;
}

const UNREACHABLE_STUB: LocalBackendProbeResult = { reachable: false };

export const probeOllama = (
  options: ProbeLocalBackendOptions = {},
): Effect.Effect<LocalBackendProbeResult> => {
  if (isSuppressedByEnv()) {
    return Effect.succeed(UNREACHABLE_STUB);
  }
  return Effect.promise(() =>
    probeHttp({
      url: OLLAMA_TAGS_URL,
      modelsKey: "models",
      timeoutMs: options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS,
    }),
  );
};

export const probeLmStudio = (
  options: ProbeLocalBackendOptions = {},
): Effect.Effect<LocalBackendProbeResult> => {
  if (isSuppressedByEnv()) {
    return Effect.succeed(UNREACHABLE_STUB);
  }
  return Effect.promise(() =>
    probeHttp({
      url: LM_STUDIO_MODELS_URL,
      modelsKey: "data",
      timeoutMs: options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS,
    }),
  );
};

export const probeCodexLocalBackends = (
  options: ProbeLocalBackendOptions = {},
): Effect.Effect<LocalBackendProbes> =>
  Effect.all(
    {
      ollama: probeOllama(options),
      lmstudio: probeLmStudio(options),
    },
    { concurrency: "unbounded" },
  );
