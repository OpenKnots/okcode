/**
 * SkillService - Effect service for skill CRUD and search operations.
 *
 * Wraps the shared skill utilities from `@okcode/shared/skill` as an Effect
 * service using the project's `ServiceMap.Service` pattern.
 *
 * @module SkillService
 */
import type {
  SkillCatalogResult,
  SkillCreateResult,
  SkillImportResult,
  SkillInstallResult,
  SkillListResult,
  SkillReadResult,
  SkillSearchResult,
} from "@okcode/contracts";
import { Effect, Layer, Schema, ServiceMap } from "effect";
import {
  ensureSystemSkillsInstalled,
  importSkill,
  installBundledSkill,
  listSkills,
  readSkill,
  searchSkills,
  createSkill,
  deleteSkill,
} from "@okcode/shared/skill";
import { listBundledSkills } from "@okcode/shared/skillCatalog";

/**
 * SkillServiceError - Tagged error for skill service failures.
 */
export class SkillServiceError extends Schema.TaggedErrorClass<SkillServiceError>()(
  "SkillServiceError",
  {
    operation: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {
  override get message(): string {
    return `Skill service error (${this.operation}): ${this.detail}`;
  }
}

/**
 * SkillServiceShape - Service API for skill CRUD and search operations.
 */
export interface SkillServiceShape {
  readonly catalog: (input: {
    readonly cwd?: string | undefined;
  }) => Effect.Effect<SkillCatalogResult, SkillServiceError>;

  /**
   * List all installed skills.
   */
  readonly list: (input: {
    readonly cwd?: string | undefined;
  }) => Effect.Effect<SkillListResult, SkillServiceError>;

  /**
   * Read a skill by name.
   */
  readonly read: (input: {
    readonly name: string;
    readonly cwd?: string | undefined;
  }) => Effect.Effect<SkillReadResult, SkillServiceError>;

  /**
   * Create a new skill with scaffold template.
   */
  readonly create: (input: {
    readonly name: string;
    readonly description: string;
    readonly scope: "global" | "project";
    readonly cwd?: string | undefined;
    readonly tags?: readonly string[] | undefined;
    readonly template?: "blank" | "docs-helper" | "automation-helper" | "review-helper" | undefined;
  }) => Effect.Effect<SkillCreateResult, SkillServiceError>;

  /**
   * Delete a skill.
   */
  readonly delete: (input: {
    readonly name: string;
    readonly scope: "global" | "project";
    readonly cwd?: string | undefined;
  }) => Effect.Effect<void, SkillServiceError>;

  readonly install: (input: {
    readonly id:
      | "pdf"
      | "spreadsheet"
      | "doc"
      | "playwright"
      | "github"
      | "skill-creator"
      | "image-gen"
      | "plugin-creator"
      | "skill-installer"
      | "openclaw-docs"
      | "openai-docs"
      | "anthropic-docs";
    readonly scope: "global" | "project";
    readonly cwd?: string | undefined;
  }) => Effect.Effect<SkillInstallResult, SkillServiceError>;

  readonly uninstall: (input: {
    readonly name: string;
    readonly scope: "global" | "project";
    readonly cwd?: string | undefined;
  }) => Effect.Effect<void, SkillServiceError>;

  readonly importSkill: (input: {
    readonly path: string;
    readonly scope: "global" | "project";
    readonly cwd?: string | undefined;
  }) => Effect.Effect<SkillImportResult, SkillServiceError>;

  /**
   * Search skills by query.
   */
  readonly search: (input: {
    readonly query: string;
    readonly cwd?: string | undefined;
  }) => Effect.Effect<SkillSearchResult, SkillServiceError>;
}

/**
 * SkillService - Service tag for skill CRUD and search operations.
 */
export class SkillService extends ServiceMap.Service<SkillService, SkillServiceShape>()(
  "okcode/skills/SkillService",
) {}

function toSkillEntry(entry: ReturnType<typeof listSkills>[number]) {
  return {
    name: entry.name,
    scope: entry.scope,
    description: entry.description,
    tags: entry.tags,
    path: entry.path,
    catalogId: entry.catalogId,
    origin: entry.origin,
    system: entry.system,
    mutable: entry.mutable,
    supplementaryFiles: entry.supplementaryFiles,
  };
}

const catalogEntries = listBundledSkills();
ensureSystemSkillsInstalled();

export const SkillServiceLive = Layer.succeed(SkillService, {
  catalog: (input) =>
    Effect.try({
      try: () => {
        const installed = listSkills(input.cwd);
        return {
          skills: catalogEntries.map((catalogSkill) => {
            const installedEntry = installed.find(
              (entry) =>
                entry.catalogId === catalogSkill.entry.id || entry.name === catalogSkill.skillName,
            );
            return Object.assign({}, catalogSkill.entry, {
              installed: Boolean(installedEntry),
              installedScope: installedEntry?.scope ?? null,
              path: installedEntry?.path ?? null,
              catalogId: installedEntry?.catalogId ?? catalogSkill.entry.id,
              origin: installedEntry?.origin ?? null,
              drifted: false,
            });
          }),
        };
      },
      catch: (cause) =>
        new SkillServiceError({
          operation: "catalog",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause: cause instanceof Error ? cause : undefined,
        }),
    }),

  list: (input) =>
    Effect.try({
      try: () => {
        const entries = listSkills(input.cwd);
        return {
          skills: entries.map(toSkillEntry),
        };
      },
      catch: (cause) =>
        new SkillServiceError({
          operation: "list",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause: cause instanceof Error ? cause : undefined,
        }),
    }),

  read: (input) =>
    Effect.try({
      try: () => {
        const result = readSkill(input.name, input.cwd);
        if (!result) {
          throw new Error(`Skill "${input.name}" not found`);
        }
        return {
          name: result.name,
          scope: result.scope,
          description: result.description,
          content: result.content.raw,
          path: result.path,
          tags: result.tags,
          catalogId: result.catalogId,
          origin: result.origin,
          system: result.system,
          mutable: result.mutable,
          supplementaryFiles: result.supplementaryFiles,
        };
      },
      catch: (cause) =>
        new SkillServiceError({
          operation: "read",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause: cause instanceof Error ? cause : undefined,
        }),
    }),

  create: (input) =>
    Effect.try({
      try: () =>
        createSkill(
          input.name,
          input.description,
          input.scope,
          {
            ...(input.tags ? { tags: input.tags } : {}),
            ...(input.template ? { template: input.template } : {}),
          },
          input.cwd,
        ),
      catch: (cause) =>
        new SkillServiceError({
          operation: "create",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause: cause instanceof Error ? cause : undefined,
        }),
    }),

  install: (input) =>
    Effect.try({
      try: () => installBundledSkill(input.id, input.scope, input.cwd),
      catch: (cause) =>
        new SkillServiceError({
          operation: "install",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause: cause instanceof Error ? cause : undefined,
        }),
    }),

  uninstall: (input) =>
    Effect.try({
      try: () => deleteSkill(input.name, input.scope, input.cwd),
      catch: (cause) =>
        new SkillServiceError({
          operation: "uninstall",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause: cause instanceof Error ? cause : undefined,
        }),
    }),

  importSkill: (input) =>
    Effect.try({
      try: () => importSkill(input.path, input.scope, input.cwd),
      catch: (cause) =>
        new SkillServiceError({
          operation: "import",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause: cause instanceof Error ? cause : undefined,
        }),
    }),

  delete: (input) =>
    Effect.try({
      try: () => deleteSkill(input.name, input.scope, input.cwd),
      catch: (cause) =>
        new SkillServiceError({
          operation: "delete",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause: cause instanceof Error ? cause : undefined,
        }),
    }),

  search: (input) =>
    Effect.try({
      try: () => {
        const entries = searchSkills(input.query, input.cwd);
        return {
          skills: entries.map(toSkillEntry),
        };
      },
      catch: (cause) =>
        new SkillServiceError({
          operation: "search",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause: cause instanceof Error ? cause : undefined,
        }),
    }),
} satisfies SkillServiceShape);
