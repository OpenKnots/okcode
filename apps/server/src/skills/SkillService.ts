/**
 * SkillService - Effect service for skill CRUD and search operations.
 *
 * Wraps the shared skill utilities from `@okcode/shared/skill` as an Effect
 * service using the project's `ServiceMap.Service` pattern.
 *
 * @module SkillService
 */
import type {
  SkillCreateResult,
  SkillListResult,
  SkillReadResult,
  SkillSearchResult,
} from "@okcode/contracts";
import { Effect, Layer, Schema, ServiceMap } from "effect";
import {
  listSkills,
  readSkill,
  searchSkills,
  createSkill,
  deleteSkill,
} from "@okcode/shared/skill";

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
  }) => Effect.Effect<SkillCreateResult, SkillServiceError>;

  /**
   * Delete a skill.
   */
  readonly delete: (input: {
    readonly name: string;
    readonly scope: "global" | "project";
    readonly cwd?: string | undefined;
  }) => Effect.Effect<void, SkillServiceError>;

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

export const SkillServiceLive = Layer.succeed(SkillService, {
  list: (input) =>
    Effect.try({
      try: () => {
        const entries = listSkills(input.cwd);
        return {
          skills: entries.map((e) => ({
            name: e.name,
            scope: e.scope,
            description: e.description,
            tags: e.tags,
            path: e.path,
          })),
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
      try: () => createSkill(input.name, input.description, input.scope, input.cwd),
      catch: (cause) =>
        new SkillServiceError({
          operation: "create",
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
          skills: entries.map((e) => ({
            name: e.name,
            scope: e.scope,
            description: e.description,
            tags: e.tags,
            path: e.path,
          })),
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
