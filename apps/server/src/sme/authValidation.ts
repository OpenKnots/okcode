import {
  type SmeAuthMethod,
  type SmeValidateSetupResult,
  type ProviderKind,
  type ServerProviderStatus,
  type ProviderStartOptions,
} from "@okcode/contracts";

import { resolveAnthropicClientOptions } from "./backends/anthropic.ts";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

import {
  buildCodexInitializeParams,
  readCodexAccountSnapshot,
  type CodexAppServerStartSessionInput,
} from "../codexAppServerManager.ts";

const OPENAI_MODEL_PROVIDERS = new Set(["openai"]);
const CLAUDE_SME_MISSING_CREDENTIALS_MESSAGE =
  "Claude SME Chat uses direct Anthropic credentials, not the Claude CLI login. Set ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN, or configure `authTokenHelperCommand` in Settings.";

export function getAllowedSmeAuthMethods(provider: ProviderKind): readonly SmeAuthMethod[] {
  switch (provider) {
    case "claudeAgent":
      return ["auto", "apiKey", "authToken"];
    case "copilot":
      return ["auto"];
    case "codex":
      return ["auto", "chatgpt", "apiKey", "customProvider"];
    case "gemini":
      return ["auto", "apiKey"];
    case "openclaw":
      return ["auto", "password", "none"];
  }
}

export function getDefaultSmeAuthMethod(provider: ProviderKind): SmeAuthMethod {
  switch (provider) {
    case "claudeAgent":
      return "auto";
    case "copilot":
      return "auto";
    case "codex":
      return "chatgpt";
    case "gemini":
      return "apiKey";
    case "openclaw":
      return "password";
  }
}

export function isValidSmeAuthMethod(provider: ProviderKind, authMethod: SmeAuthMethod): boolean {
  return getAllowedSmeAuthMethods(provider).includes(authMethod);
}

export function resolveClaudeSmeSetup(input: {
  readonly authMethod: Extract<SmeAuthMethod, "auto" | "apiKey" | "authToken">;
  readonly providerOptions?: ProviderStartOptions["claudeAgent"];
  readonly env?: NodeJS.ProcessEnv;
}): {
  readonly validation: SmeValidateSetupResult;
  readonly clientOptions: {
    readonly apiKey: string | null;
    readonly authToken: string | null;
    readonly baseURL?: string;
  } | null;
} {
  const resolved = resolveAnthropicClientOptions({
    ...(input.providerOptions ? { providerOptions: input.providerOptions } : {}),
    ...(input.env ? { env: input.env } : {}),
  });

  const withBaseUrl = (clientOptions: {
    readonly apiKey: string | null;
    readonly authToken: string | null;
  }) => ({
    ...clientOptions,
    ...(resolved.baseURL ? { baseURL: resolved.baseURL } : {}),
  });

  if (input.authMethod === "apiKey") {
    if (!resolved.apiKey) {
      return {
        validation: {
          ok: false,
          severity: "error",
          message:
            "Claude SME Chat is set to Anthropic API Key, but no ANTHROPIC_API_KEY is configured.",
          resolvedAuthMethod: "apiKey",
          resolvedAccountType: "unknown",
        },
        clientOptions: null,
      };
    }

    return {
      validation: {
        ok: true,
        severity: "ready",
        message: "Claude SME Chat can use the configured Anthropic API key.",
        resolvedAuthMethod: "apiKey",
        resolvedAccountType: "apiKey",
      },
      clientOptions: withBaseUrl({ apiKey: resolved.apiKey, authToken: null }),
    };
  }

  if (input.authMethod === "authToken") {
    if (!resolved.authToken) {
      return {
        validation: {
          ok: false,
          severity: "error",
          message:
            "Claude SME Chat is set to Auth Token, but no ANTHROPIC_AUTH_TOKEN or auth token helper command is configured.",
          resolvedAuthMethod: "authToken",
          resolvedAccountType: "unknown",
        },
        clientOptions: null,
      };
    }

    return {
      validation: {
        ok: true,
        severity: "ready",
        message: "Claude SME Chat can use the configured Anthropic auth token.",
        resolvedAuthMethod: "authToken",
        resolvedAccountType: "unknown",
      },
      clientOptions: withBaseUrl({ apiKey: null, authToken: resolved.authToken }),
    };
  }

  if (resolved.authToken) {
    return {
      validation: {
        ok: true,
        severity: "ready",
        message: "Claude SME Chat can use the configured Anthropic auth token.",
        resolvedAuthMethod: "authToken",
        resolvedAccountType: "unknown",
      },
      clientOptions: withBaseUrl({ apiKey: null, authToken: resolved.authToken }),
    };
  }

  if (resolved.apiKey) {
    return {
      validation: {
        ok: true,
        severity: "ready",
        message: "Claude SME Chat can use the configured Anthropic API key.",
        resolvedAuthMethod: "apiKey",
        resolvedAccountType: "apiKey",
      },
      clientOptions: withBaseUrl({ apiKey: resolved.apiKey, authToken: null }),
    };
  }

  return {
    validation: {
      ok: false,
      severity: "error",
      message: CLAUDE_SME_MISSING_CREDENTIALS_MESSAGE,
      resolvedAuthMethod: input.authMethod,
      resolvedAccountType: "unknown",
    },
    clientOptions: null,
  };
}

export function validateAnthropicSetup(input: {
  readonly authMethod: Extract<SmeAuthMethod, "auto" | "apiKey" | "authToken">;
  readonly providerOptions?: ProviderStartOptions["claudeAgent"];
  readonly env?: NodeJS.ProcessEnv;
  readonly providerStatus?: ServerProviderStatus | null | undefined;
}): SmeValidateSetupResult {
  return resolveClaudeSmeSetup({
    authMethod: input.authMethod,
    ...(input.providerOptions ? { providerOptions: input.providerOptions } : {}),
    ...(input.env ? { env: input.env } : {}),
  }).validation;
}

export const validateClaudeSetup = validateAnthropicSetup;

async function readCodexConfigModelProvider(
  providerOptions?: CodexAppServerStartSessionInput["providerOptions"],
): Promise<string | undefined> {
  const homePath =
    providerOptions?.codex?.homePath?.trim() || process.env.CODEX_HOME || join(homedir(), ".codex");
  try {
    const content = await readFile(join(homePath, "config.toml"), "utf-8");
    let inTopLevel = true;
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      if (trimmed.startsWith("[")) {
        inTopLevel = false;
        continue;
      }
      if (!inTopLevel) continue;
      const match = trimmed.match(/^model_provider\s*=\s*["']([^"']+)["']/);
      if (match) return match[1];
    }
    return undefined;
  } catch {
    return undefined;
  }
}

async function readCodexAccountType(
  providerOptions?: CodexAppServerStartSessionInput["providerOptions"],
): Promise<"apiKey" | "chatgpt" | "unknown"> {
  const binaryPath = providerOptions?.codex?.binaryPath?.trim() || "codex";
  const env = {
    ...process.env,
    ...(providerOptions?.codex?.homePath?.trim()
      ? { CODEX_HOME: providerOptions.codex.homePath.trim() }
      : {}),
  };

  const child = spawn(binaryPath, ["app-server"], {
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  return await new Promise((resolve, reject) => {
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
      reject(new Error("Timed out while reading Codex account state."));
    }, 4_000);

    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      stdout.close();
      child.kill();
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
          `Codex app-server exited before account/read completed (code ${code ?? "unknown"}). ${stderrLines.join("").trim()}`,
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
      new Promise<unknown>((resolveRequest, rejectRequest) => {
        const id = nextId++;
        pending.set(id, { resolve: resolveRequest, reject: rejectRequest });
        child.stdin.write(
          `${JSON.stringify({ jsonrpc: "2.0", id, method, ...(params !== undefined ? { params } : {}) })}\n`,
        );
      });

    const sendNotification = (method: string, params?: unknown) => {
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: "2.0", method, ...(params !== undefined ? { params } : {}) })}\n`,
      );
    };

    void (async () => {
      try {
        await sendRequest("initialize", buildCodexInitializeParams());
        sendNotification("initialized");
        const account = await sendRequest("account/read", {});
        const snapshot = readCodexAccountSnapshot(account);
        cleanup();
        resolve(snapshot.type);
      } catch (error) {
        cleanup();
        reject(error);
      }
    })();
  });
}

export async function validateCodexSetup(input: {
  readonly authMethod: Extract<SmeAuthMethod, "auto" | "apiKey" | "chatgpt" | "customProvider">;
  readonly providerOptions?: CodexAppServerStartSessionInput["providerOptions"];
}): Promise<SmeValidateSetupResult> {
  const modelProvider = await readCodexConfigModelProvider(input.providerOptions);
  const customProviderConfigured =
    modelProvider !== undefined && !OPENAI_MODEL_PROVIDERS.has(modelProvider);

  if (input.authMethod === "customProvider") {
    if (!customProviderConfigured) {
      return {
        ok: false,
        severity: "error",
        message:
          "Codex custom provider mode requires a non-OpenAI `model_provider` in the Codex config.",
        resolvedAuthMethod: "customProvider",
      };
    }
    return {
      ok: true,
      severity: "ready",
      message: `Codex is configured to use custom model provider '${modelProvider}'.`,
      resolvedAuthMethod: "customProvider",
      resolvedAccountType: "unknown",
    };
  }

  if (input.authMethod === "auto" && customProviderConfigured) {
    return {
      ok: true,
      severity: "ready",
      message: `Codex auto mode resolved to custom provider '${modelProvider}'.`,
      resolvedAuthMethod: "customProvider",
      resolvedAccountType: "unknown",
    };
  }

  const accountType = await readCodexAccountType(input.providerOptions).catch(
    () => "unknown" as const,
  );
  const desiredAuthMethod =
    input.authMethod === "auto"
      ? accountType === "chatgpt"
        ? "chatgpt"
        : accountType === "apiKey"
          ? "apiKey"
          : "auto"
      : input.authMethod;

  if (input.authMethod === "auto" && accountType === "unknown") {
    return {
      ok: false,
      severity: "error",
      message:
        "Codex account state could not be verified. Check the Codex CLI installation and login state.",
      resolvedAuthMethod: "auto",
      resolvedAccountType: "unknown",
    };
  }

  if (desiredAuthMethod === "chatgpt" && accountType !== "chatgpt") {
    return {
      ok: false,
      severity: "error",
      message: "Codex is not authenticated with a ChatGPT account.",
      resolvedAuthMethod: "chatgpt",
      resolvedAccountType: accountType,
    };
  }

  if (desiredAuthMethod === "apiKey" && accountType !== "apiKey") {
    return {
      ok: false,
      severity: "error",
      message: "Codex is not configured to use API key authentication.",
      resolvedAuthMethod: "apiKey",
      resolvedAccountType: accountType,
    };
  }

  return {
    ok: true,
    severity: "ready",
    message:
      desiredAuthMethod === "chatgpt"
        ? "Codex ChatGPT authentication is configured."
        : "Codex API key authentication is configured.",
    resolvedAuthMethod: desiredAuthMethod === "auto" ? input.authMethod : desiredAuthMethod,
    resolvedAccountType: accountType,
  };
}

export function validateOpenClawSetup(input: {
  readonly authMethod: Extract<SmeAuthMethod, "auto" | "password" | "none">;
  readonly gatewayUrl: string | null;
  readonly hasSharedSecret: boolean;
  readonly hasDeviceToken: boolean;
  readonly providerStatus?: ServerProviderStatus;
}): SmeValidateSetupResult {
  if (!input.gatewayUrl) {
    return {
      ok: false,
      severity: "error",
      message: "OpenClaw gateway URL is missing. Add it in Settings.",
      resolvedAuthMethod: input.authMethod,
    };
  }

  const resolvedAuthMethod =
    input.authMethod === "auto" ? (input.hasSharedSecret ? "password" : "none") : input.authMethod;

  if (resolvedAuthMethod === "password" && !input.hasSharedSecret) {
    return {
      ok: false,
      severity: "error",
      message: "OpenClaw shared-secret auth is selected, but no shared secret is configured.",
      resolvedAuthMethod,
    };
  }

  if (input.providerStatus?.authStatus === "unauthenticated") {
    return {
      ok: false,
      severity: "error",
      message:
        input.providerStatus.message ??
        "OpenClaw is configured, but pairing or device authentication is not complete.",
      resolvedAuthMethod,
    };
  }

  if (input.providerStatus?.status === "warning") {
    return {
      ok: false,
      severity: "warning",
      message:
        input.providerStatus.message ??
        "OpenClaw gateway health could not be verified. Test the gateway in Settings.",
      resolvedAuthMethod,
    };
  }

  if (!input.hasDeviceToken && resolvedAuthMethod === "none") {
    return {
      ok: false,
      severity: "warning",
      message:
        "OpenClaw gateway settings are saved, but no device token is cached yet. Test the gateway in Settings and approve the device if prompted.",
      resolvedAuthMethod,
    };
  }

  return {
    ok: true,
    severity: "ready",
    message:
      resolvedAuthMethod === "password"
        ? "OpenClaw gateway and shared secret are configured. Device pairing is optional when token auth succeeds."
        : input.hasDeviceToken
          ? "OpenClaw gateway and device pairing are configured."
          : "OpenClaw gateway is configured.",
    resolvedAuthMethod,
  };
}
