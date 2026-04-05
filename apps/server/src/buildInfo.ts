import type { BuildChannel, BuildMetadata, BuildSurface } from "@okcode/contracts";
import { version as serverVersion } from "../package.json" with { type: "json" };

const COMMIT_HASH_PATTERN = /^[0-9a-f]{7,40}$/i;
const COMMIT_HASH_DISPLAY_LENGTH = 12;

function normalizeCommitHash(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!COMMIT_HASH_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed.slice(0, COMMIT_HASH_DISPLAY_LENGTH).toLowerCase();
}

export function resolveBuildChannel(version: string): BuildChannel {
  return version.includes("-") ? "prerelease" : "stable";
}

function resolveBuildTimestamp(): string {
  const timestamp = process.env.OKCODE_BUILD_TIMESTAMP?.trim();
  return timestamp && timestamp.length > 0 ? timestamp : new Date().toISOString();
}

export function createBuildInfo(input: {
  readonly version: string;
  readonly surface: BuildSurface;
  readonly platform: string;
  readonly arch: string;
}): BuildMetadata {
  return {
    version: input.version,
    commitHash: normalizeCommitHash(process.env.OKCODE_COMMIT_HASH ?? process.env.GITHUB_SHA),
    platform: input.platform,
    arch: input.arch,
    channel: resolveBuildChannel(input.version),
    buildTimestamp: resolveBuildTimestamp(),
    surface: input.surface,
  };
}

export const serverBuildInfo = createBuildInfo({
  version: serverVersion,
  surface: "server",
  platform: process.platform,
  arch: process.arch,
});
