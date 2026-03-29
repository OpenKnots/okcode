import { Schema } from "effect";
import { TrimmedNonEmptyString } from "./baseSchemas";

// ── Skill Manifest (parsed from SKILL.md frontmatter) ───────────────

export const SkillScope = Schema.Literals(["global", "project"]);
export type SkillScope = typeof SkillScope.Type;

export const SkillManifest = Schema.Struct({
  name: TrimmedNonEmptyString,
  description: Schema.String,
  version: Schema.optional(TrimmedNonEmptyString),
  scope: Schema.optional(SkillScope),
  triggers: Schema.optional(Schema.Array(Schema.String)),
  tags: Schema.optional(Schema.Array(Schema.String)),
  tools: Schema.optional(Schema.Array(Schema.String)),
  author: Schema.optional(TrimmedNonEmptyString),
});
export type SkillManifest = typeof SkillManifest.Type;

// ── Skill Entry (lightweight listing item) ───────────────────────────

export const SkillEntry = Schema.Struct({
  name: TrimmedNonEmptyString,
  scope: SkillScope,
  description: Schema.String,
  tags: Schema.Array(Schema.String),
  path: TrimmedNonEmptyString,
});
export type SkillEntry = typeof SkillEntry.Type;

// ── Skill Subcommand (for hierarchical slash commands) ───────────────

export const SkillSubcommand = Schema.Struct({
  name: TrimmedNonEmptyString,
  description: Schema.String,
  usage: Schema.optional(Schema.String),
});
export type SkillSubcommand = typeof SkillSubcommand.Type;

// ── WS API Input/Result Schemas ──────────────────────────────────────

export const SkillListInput = Schema.Struct({
  cwd: Schema.optional(TrimmedNonEmptyString),
});
export type SkillListInput = typeof SkillListInput.Type;

export const SkillListResult = Schema.Struct({
  skills: Schema.Array(SkillEntry),
});
export type SkillListResult = typeof SkillListResult.Type;

export const SkillReadInput = Schema.Struct({
  name: TrimmedNonEmptyString,
  cwd: Schema.optional(TrimmedNonEmptyString),
});
export type SkillReadInput = typeof SkillReadInput.Type;

export const SkillReadResult = Schema.Struct({
  name: TrimmedNonEmptyString,
  scope: SkillScope,
  description: Schema.String,
  content: Schema.String,
  path: TrimmedNonEmptyString,
  tags: Schema.Array(Schema.String),
});
export type SkillReadResult = typeof SkillReadResult.Type;

export const SkillCreateInput = Schema.Struct({
  name: TrimmedNonEmptyString,
  description: Schema.String,
  scope: SkillScope,
  cwd: Schema.optional(TrimmedNonEmptyString),
});
export type SkillCreateInput = typeof SkillCreateInput.Type;

export const SkillCreateResult = Schema.Struct({
  path: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
});
export type SkillCreateResult = typeof SkillCreateResult.Type;

export const SkillDeleteInput = Schema.Struct({
  name: TrimmedNonEmptyString,
  scope: SkillScope,
  cwd: Schema.optional(TrimmedNonEmptyString),
});
export type SkillDeleteInput = typeof SkillDeleteInput.Type;

export const SkillSearchInput = Schema.Struct({
  query: TrimmedNonEmptyString,
  cwd: Schema.optional(TrimmedNonEmptyString),
});
export type SkillSearchInput = typeof SkillSearchInput.Type;

export const SkillSearchResult = Schema.Struct({
  skills: Schema.Array(SkillEntry),
});
export type SkillSearchResult = typeof SkillSearchResult.Type;
