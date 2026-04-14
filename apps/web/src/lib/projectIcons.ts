import type { NativeApi } from "@okcode/contracts";
import {
  PROJECT_ICON_DISCOVERY_QUERIES,
  PROJECT_ICON_FALLBACK_CANDIDATES,
} from "@okcode/shared/projectIcons";

export function resolveProjectIconUrl(input: {
  cwd: string;
  iconPath?: string | null | undefined;
}): string {
  const searchParams = new URLSearchParams({ cwd: input.cwd });
  const iconPath = input.iconPath?.trim();
  if (iconPath) {
    searchParams.set("icon", iconPath);
  }
  return `/api/project-favicon?${searchParams.toString()}`;
}

export function normalizeProjectIconPath(input: string | null | undefined): string | null {
  const trimmed = input?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export async function resolveSuggestedProjectIconPath(
  api: Pick<NativeApi, "projects">,
  cwd: string,
): Promise<string | null> {
  for (const query of PROJECT_ICON_DISCOVERY_QUERIES) {
    const result = await api.projects.searchEntries({
      cwd,
      query,
      limit: 80,
    });
    const candidatePaths = new Set(
      result.entries.filter((entry) => entry.kind === "file").map((entry) => entry.path),
    );
    for (const candidate of PROJECT_ICON_FALLBACK_CANDIDATES) {
      if (candidatePaths.has(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}
