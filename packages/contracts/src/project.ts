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
  /** When set, the entry matched via file-content search. Shows the matching line. */
  contentMatch: Schema.optional(Schema.String),
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
  shallow: Schema.optional(Schema.Boolean),
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
  /** When set to "base64", `contents` is decoded from base64 before writing as binary. */
  encoding: Schema.optional(Schema.Literal("base64")),
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
  hasTextContents: Schema.Boolean,
  sizeBytes: Schema.Number,
  truncated: Schema.Boolean,
  /** Base64 data URL for previewable files (e.g. "data:image/png;base64,...") */
  previewDataUrl: Schema.optional(Schema.String),
  /** MIME type associated with `previewDataUrl`. */
  previewMimeType: Schema.optional(Schema.String),
});
export type ProjectReadFileResult = typeof ProjectReadFileResult.Type;

export const ProjectDeleteEntryInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString.check(Schema.isMaxLength(PROJECT_DIRECTORY_PATH_MAX_LENGTH)),
});
export type ProjectDeleteEntryInput = typeof ProjectDeleteEntryInput.Type;

export const ProjectFileTreeChangedPayload = Schema.Struct({
  cwd: TrimmedNonEmptyString,
});
export type ProjectFileTreeChangedPayload = typeof ProjectFileTreeChangedPayload.Type;
