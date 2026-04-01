import { existsSync } from "node:fs";
import * as OS from "node:os";
import { Effect, Path } from "effect";
import { readPathFromLoginShell } from "@okcode/shared/shell";

/**
 * Well-known macOS binary directories that may not be inherited by GUI apps
 * or non-login server processes. Homebrew (Apple Silicon) installs to
 * `/opt/homebrew/bin`; the Intel / legacy location is `/usr/local/bin`.
 */
const EXTRA_PATHS_DARWIN = [
  "/opt/homebrew/bin",
  "/opt/homebrew/sbin",
  "/usr/local/bin",
  "/usr/local/sbin",
] as const;

/**
 * Prepend any of the given paths that (a) exist on disk and (b) are not
 * already present in `process.env.PATH`.
 */
export function ensureExtraPaths(
  paths: ReadonlyArray<string>,
  fsExistsSync: (p: string) => boolean = existsSync,
): void {
  const current = process.env.PATH ?? "";
  const parts = new Set(current.split(":"));
  const toAdd = paths.filter((p) => !parts.has(p) && fsExistsSync(p));
  if (toAdd.length > 0) {
    process.env.PATH = [...toAdd, current].filter(Boolean).join(":");
  }
}

export function fixPath(): void {
  if (process.platform !== "darwin") return;

  try {
    const shell = process.env.SHELL ?? "/bin/zsh";
    const result = readPathFromLoginShell(shell);
    if (result) {
      process.env.PATH = result;
    }
  } catch {
    // Silently ignore — keep default PATH
  }

  // Ensure common Homebrew/system paths are present regardless of whether the
  // login-shell probe succeeded.  macOS GUI apps and some server processes do
  // not inherit the full interactive-shell PATH, so binaries installed at
  // the standard Homebrew locations may be missing.
  ensureExtraPaths(EXTRA_PATHS_DARWIN);
}

export const expandHomePath = Effect.fn(function* (input: string) {
  const { join } = yield* Path.Path;
  if (input === "~") {
    return OS.homedir();
  }
  if (input.startsWith("~/") || input.startsWith("~\\")) {
    return join(OS.homedir(), input.slice(2));
  }
  return input;
});

export const resolveBaseDir = Effect.fn(function* (raw: string | undefined) {
  const { join, resolve } = yield* Path.Path;
  if (!raw || raw.trim().length === 0) {
    return join(OS.homedir(), ".okcode");
  }
  return resolve(yield* expandHomePath(raw.trim()));
});
