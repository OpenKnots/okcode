import { Schema } from "effect";
import { TrimmedNonEmptyString } from "./baseSchemas";

export const SkillCatalogCategory = Schema.Literals([
  "recommended",
  "system",
  "docs",
  "automation",
  "devtools",
  "custom",
]);
export type SkillCatalogCategory = typeof SkillCatalogCategory.Type;

export const BundledSkillId = Schema.Literals([
  "pdf",
  "spreadsheet",
  "doc",
  "playwright",
  "github",
  "skill-creator",
  "image-gen",
  "plugin-creator",
  "skill-installer",
  "openclaw-docs",
  "openai-docs",
  "anthropic-docs",
]);
export type BundledSkillId = typeof BundledSkillId.Type;

export const SkillOrigin = Schema.Literals(["bundled", "custom", "imported"]);
export type SkillOrigin = typeof SkillOrigin.Type;

export const SkillCatalogInstallScope = Schema.Literals(["global", "project"]);
export type SkillCatalogInstallScope = typeof SkillCatalogInstallScope.Type;

export const SkillCatalogEntry = Schema.Struct({
  id: BundledSkillId,
  name: TrimmedNonEmptyString,
  description: Schema.String,
  category: SkillCatalogCategory,
  tags: Schema.Array(Schema.String),
  icon: TrimmedNonEmptyString,
  installScopeDefault: SkillCatalogInstallScope,
  system: Schema.Boolean,
  recommended: Schema.Boolean,
  immutable: Schema.Boolean,
  sourceType: Schema.Literal("bundled"),
  sourceRef: TrimmedNonEmptyString,
});
export type SkillCatalogEntry = typeof SkillCatalogEntry.Type;

export const SkillCatalogAnnotatedEntry = Schema.Struct({
  id: BundledSkillId,
  name: TrimmedNonEmptyString,
  description: Schema.String,
  category: SkillCatalogCategory,
  tags: Schema.Array(Schema.String),
  icon: TrimmedNonEmptyString,
  installScopeDefault: SkillCatalogInstallScope,
  system: Schema.Boolean,
  recommended: Schema.Boolean,
  immutable: Schema.Boolean,
  sourceType: Schema.Literal("bundled"),
  sourceRef: TrimmedNonEmptyString,
  installed: Schema.Boolean,
  installedScope: Schema.NullOr(SkillCatalogInstallScope),
  path: Schema.NullOr(Schema.String),
  catalogId: Schema.NullOr(TrimmedNonEmptyString),
  origin: Schema.NullOr(SkillOrigin),
  drifted: Schema.Boolean,
});
export type SkillCatalogAnnotatedEntry = typeof SkillCatalogAnnotatedEntry.Type;
