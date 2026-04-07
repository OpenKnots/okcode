import type {
  ProjectListDirectoryResult,
  ProjectReadFileResult,
  ProjectSearchEntriesResult,
} from "@okcode/contracts";
import { queryOptions } from "@tanstack/react-query";
import { ensureNativeApi } from "~/nativeApi";

export const projectQueryKeys = {
  all: ["projects"] as const,
  searchEntries: (
    cwd: string | null,
    query: string,
    includePattern: string,
    excludePattern: string,
    limit: number,
  ) => ["projects", "search-entries", cwd, query, includePattern, excludePattern, limit] as const,
  listDirectory: (cwd: string | null, directoryPath: string | null) =>
    ["projects", "list-directory", cwd, directoryPath] as const,
  readFile: (cwd: string | null, relativePath: string | null) =>
    ["projects", "read-file", cwd, relativePath] as const,
};

const DEFAULT_SEARCH_ENTRIES_LIMIT = 80;
const DEFAULT_PROJECT_STALE_TIME = 15_000;
const EMPTY_SEARCH_ENTRIES_RESULT: ProjectSearchEntriesResult = {
  entries: [],
  truncated: false,
};
const EMPTY_LIST_DIRECTORY_RESULT: ProjectListDirectoryResult = {
  entries: [],
  truncated: false,
};

export function projectSearchEntriesQueryOptions(input: {
  cwd: string | null;
  query: string;
  includePattern?: string;
  excludePattern?: string;
  enabled?: boolean;
  limit?: number;
  staleTime?: number;
}) {
  const limit = input.limit ?? DEFAULT_SEARCH_ENTRIES_LIMIT;
  const includePattern = input.includePattern?.trim() ?? "";
  const excludePattern = input.excludePattern?.trim() ?? "";
  const hasSearchFilters =
    input.query.trim().length > 0 || includePattern.length > 0 || excludePattern.length > 0;
  return queryOptions({
    queryKey: projectQueryKeys.searchEntries(
      input.cwd,
      input.query,
      includePattern,
      excludePattern,
      limit,
    ),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd) {
        throw new Error("Workspace entry search is unavailable.");
      }
      return api.projects.searchEntries({
        cwd: input.cwd,
        query: input.query,
        limit,
        ...(includePattern ? { includePattern } : {}),
        ...(excludePattern ? { excludePattern } : {}),
      });
    },
    enabled: (input.enabled ?? true) && input.cwd !== null && hasSearchFilters,
    staleTime: input.staleTime ?? DEFAULT_PROJECT_STALE_TIME,
    placeholderData: (previous) => previous ?? EMPTY_SEARCH_ENTRIES_RESULT,
  });
}

const EMPTY_READ_FILE_RESULT: ProjectReadFileResult = {
  relativePath: "" as ProjectReadFileResult["relativePath"],
  contents: "",
  hasTextContents: false,
  sizeBytes: 0,
  truncated: false,
};

export function projectReadFileQueryOptions(input: {
  cwd: string | null;
  relativePath: string | null;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: projectQueryKeys.readFile(input.cwd, input.relativePath),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd || !input.relativePath) {
        throw new Error("File reading is unavailable.");
      }
      return api.projects.readFile({
        cwd: input.cwd,
        relativePath: input.relativePath,
      });
    },
    enabled: (input.enabled ?? true) && input.cwd !== null && input.relativePath !== null,
    staleTime: 5_000,
    placeholderData: (previous) => previous ?? EMPTY_READ_FILE_RESULT,
  });
}

export function projectListDirectoryQueryOptions(input: {
  cwd: string | null;
  directoryPath?: string;
  enabled?: boolean;
  staleTime?: number;
}) {
  return queryOptions({
    queryKey: projectQueryKeys.listDirectory(input.cwd, input.directoryPath ?? null),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd) {
        throw new Error("Workspace directory listing is unavailable.");
      }
      return api.projects.listDirectory({
        cwd: input.cwd,
        ...(input.directoryPath ? { directoryPath: input.directoryPath } : {}),
      });
    },
    enabled: (input.enabled ?? true) && input.cwd !== null,
    staleTime: input.staleTime ?? DEFAULT_PROJECT_STALE_TIME,
    placeholderData: (previous) => previous ?? EMPTY_LIST_DIRECTORY_RESULT,
  });
}
