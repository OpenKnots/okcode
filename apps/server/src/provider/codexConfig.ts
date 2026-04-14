import { homedir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

import type { ServerCodexConfigSummary, ServerCodexModelProviderEntry } from "@okcode/contracts";
import {
  getCodexModelProviderPreset,
  isCodexBuiltInModelProvider,
  requiresOpenAiLoginForCodexModelProvider,
} from "@okcode/shared/codexModelProviders";
import { Effect, FileSystem, Result } from "effect";
import { parse as parseToml } from "toml";

export interface CodexConfigReadOptions {
  readonly homePath?: string | null | undefined;
  readonly env?: NodeJS.ProcessEnv | undefined;
}

function emptyCodexConfigSummary(): ServerCodexConfigSummary {
  return {
    selectedModelProviderId: null,
    entries: [],
    parseError: null,
  };
}

function trimToNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function createSummaryEntry(input: {
  readonly id: string;
  readonly selected: boolean;
  readonly definedInConfig: boolean;
}): ServerCodexModelProviderEntry {
  return {
    id: input.id,
    selected: input.selected,
    definedInConfig: input.definedInConfig,
    isBuiltIn: isCodexBuiltInModelProvider(input.id),
    isKnownPreset: getCodexModelProviderPreset(input.id) !== undefined,
    requiresOpenAiLogin: requiresOpenAiLoginForCodexModelProvider(input.id),
  };
}

function getSelectedModelProviderId(parsed: Record<string, unknown>): string | null {
  return trimToNull(parsed["model_provider"] as string | null | undefined);
}

function getDefinedModelProviderIds(parsed: Record<string, unknown>): string[] {
  const providers = parsed["model_providers"];
  if (!providers || typeof providers !== "object" || Array.isArray(providers)) {
    return [];
  }

  const ids: string[] = [];
  for (const key of Object.keys(providers)) {
    const trimmed = trimToNull(key);
    if (trimmed !== null) {
      ids.push(trimmed);
    }
  }
  return ids;
}

function getParseErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isMissingFileError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }
  return (error as { code?: unknown }).code === "ENOENT";
}

export function resolveCodexHomePath(options: CodexConfigReadOptions = {}): string {
  const env = options.env ?? process.env;
  return trimToNull(options.homePath) ?? trimToNull(env.CODEX_HOME) ?? join(homedir(), ".codex");
}

export function resolveCodexConfigPath(options: CodexConfigReadOptions = {}): string {
  return join(resolveCodexHomePath(options), "config.toml");
}

export function fallbackScanTopLevelModelProvider(content: string): string | null {
  let inTopLevel = true;

  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    if (trimmed.startsWith("[")) {
      inTopLevel = false;
      continue;
    }
    if (!inTopLevel) {
      continue;
    }
    const match = trimmed.match(/^model_provider\s*=\s*["']([^"']+)["']/u);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

export function summarizeCodexConfigToml(content: string): ServerCodexConfigSummary {
  try {
    const parsed = parseToml(content) as Record<string, unknown>;
    const selectedModelProviderId = getSelectedModelProviderId(parsed);
    const definedModelProviderIds = getDefinedModelProviderIds(parsed);
    const definedModelProviderIdSet = new Set(definedModelProviderIds);

    const entryIds: string[] = [];
    if (selectedModelProviderId !== null) {
      entryIds.push(selectedModelProviderId);
    }
    for (const id of definedModelProviderIds) {
      if (!entryIds.includes(id)) {
        entryIds.push(id);
      }
    }

    return {
      selectedModelProviderId,
      entries: entryIds.map((id) =>
        createSummaryEntry({
          id,
          selected: selectedModelProviderId === id,
          definedInConfig: definedModelProviderIdSet.has(id) || selectedModelProviderId === id,
        }),
      ),
      parseError: null,
    };
  } catch (error) {
    const selectedModelProviderId = fallbackScanTopLevelModelProvider(content);
    return {
      selectedModelProviderId,
      entries:
        selectedModelProviderId === null
          ? []
          : [
              createSummaryEntry({
                id: selectedModelProviderId,
                selected: true,
                definedInConfig: true,
              }),
            ],
      parseError: getParseErrorMessage(error),
    };
  }
}

export async function readCodexConfigSummaryFromFile(
  options: CodexConfigReadOptions = {},
): Promise<ServerCodexConfigSummary> {
  const configPath = resolveCodexConfigPath(options);

  try {
    const content = await readFile(configPath, "utf-8");
    return summarizeCodexConfigToml(content);
  } catch (error) {
    if (isMissingFileError(error)) {
      return emptyCodexConfigSummary();
    }
    return {
      ...emptyCodexConfigSummary(),
      parseError: getParseErrorMessage(error),
    };
  }
}

export const readCodexConfigSummary = (options: CodexConfigReadOptions = {}) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const configPath = resolveCodexConfigPath(options);
    const exists = yield* fileSystem.exists(configPath).pipe(Effect.orElseSucceed(() => false));
    if (!exists) {
      return emptyCodexConfigSummary();
    }

    const content = yield* fileSystem.readFileString(configPath).pipe(Effect.result);
    if (Result.isFailure(content)) {
      return {
        ...emptyCodexConfigSummary(),
        parseError: getParseErrorMessage(content.failure),
      };
    }

    return summarizeCodexConfigToml(content.success);
  });

export function usesOpenAiLoginForSelectedCodexBackend(summary: ServerCodexConfigSummary): boolean {
  return (
    summary.selectedModelProviderId === null ||
    requiresOpenAiLoginForCodexModelProvider(summary.selectedModelProviderId)
  );
}
