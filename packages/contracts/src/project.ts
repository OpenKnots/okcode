import { Schema } from "effect";
import { PositiveInt, TrimmedNonEmptyString, TrimmedString } from "./baseSchemas";

const PROJECT_SEARCH_ENTRIES_MAX_LIMIT = 200;
const PROJECT_SEARCH_FILTER_MAX_LENGTH = 512;
const PROJECT_WRITE_FILE_PATH_MAX_LENGTH = 512;
const PROJECT_DIRECTORY_PATH_MAX_LENGTH = 1024;

export const ProjectSearchEntriesInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  query: TrimmedString.check(Schema.isMaxLength(256)),
  limit: PositiveInt.check(Schema.isLessThanOrEqualTo(PROJECT_SEARCH_ENTRIES_MAX_LIMIT)),
  includePattern: Schema.optional(
    TrimmedString.check(Schema.isMaxLength(PROJECT_SEARCH_FILTER_MAX_LENGTH)),
  ),
  excludePattern: Schema.optional(
    TrimmedString.check(Schema.isMaxLength(PROJECT_SEARCH_FILTER_MAX_LENGTH)),
  ),
});
export type ProjectSearchEntriesInput = typeof ProjectSearchEntriesInput.Type;

const ProjectEntryKind = Schema.Literals(["file", "directory"]);

export const ProjectEntry = Schema.Struct({
  path: TrimmedNonEmptyString,
  kind: ProjectEntryKind,
  parentPath: Schema.optional(TrimmedNonEmptyString),
});
export type ProjectEntry = typeof ProjectEntry.Type;

export const ProjectDirectoryEntry = Schema.Struct({
  path: TrimmedNonEmptyString,
  kind: ProjectEntryKind,
  parentPath: Schema.optional(TrimmedNonEmptyString),
  hasChildren: Schema.Boolean,
});
export type ProjectDirectoryEntry = typeof ProjectDirectoryEntry.Type;

export const ProjectSearchEntriesResult = Schema.Struct({
  entries: Schema.Array(ProjectEntry),
  truncated: Schema.Boolean,
});
export type ProjectSearchEntriesResult = typeof ProjectSearchEntriesResult.Type;

export const ProjectListDirectoryInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  directoryPath: Schema.optional(
    TrimmedNonEmptyString.check(Schema.isMaxLength(PROJECT_DIRECTORY_PATH_MAX_LENGTH)),
  ),
});
export type ProjectListDirectoryInput = typeof ProjectListDirectoryInput.Type;

export const ProjectListDirectoryResult = Schema.Struct({
  entries: Schema.Array(ProjectDirectoryEntry),
  truncated: Schema.Boolean,
});
export type ProjectListDirectoryResult = typeof ProjectListDirectoryResult.Type;

export const ProjectWriteFileInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString.check(Schema.isMaxLength(PROJECT_WRITE_FILE_PATH_MAX_LENGTH)),
  contents: Schema.String,
});
export type ProjectWriteFileInput = typeof ProjectWriteFileInput.Type;

export const ProjectWriteFileResult = Schema.Struct({
  relativePath: TrimmedNonEmptyString,
});
export type ProjectWriteFileResult = typeof ProjectWriteFileResult.Type;

export const ProjectReadFileInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString.check(Schema.isMaxLength(PROJECT_WRITE_FILE_PATH_MAX_LENGTH)),
});
export type ProjectReadFileInput = typeof ProjectReadFileInput.Type;

export const ProjectReadFileResult = Schema.Struct({
  relativePath: TrimmedNonEmptyString,
  contents: Schema.String,
  sizeBytes: Schema.Number,
  truncated: Schema.Boolean,
});
export type ProjectReadFileResult = typeof ProjectReadFileResult.Type;
