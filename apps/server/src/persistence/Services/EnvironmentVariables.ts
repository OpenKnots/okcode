/**
 * EnvironmentVariablesRepository - Encrypted environment variable persistence.
 *
 * Stores project-scoped and global env vars encrypted at rest and exposes
 * plaintext lists for the UI plus merged runtime env snapshots for process
 * launchers.
 *
 * @module EnvironmentVariablesRepository
 */
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type {
  EnvironmentVariableEntry,
  GlobalEnvironmentVariablesResult,
  ProjectEnvironmentVariablesInput,
  ProjectEnvironmentVariablesResult,
  SaveGlobalEnvironmentVariablesInput,
  SaveProjectEnvironmentVariablesInput,
} from "@okcode/contracts";
import { Option, Schema, ServiceMap } from "effect";
import type { Effect } from "effect";

import type { EnvironmentVariablesError } from "../Errors.ts";

export interface EnvironmentVariablesShape {
  /**
   * Read globally scoped environment variables.
   */
  readonly getGlobal: () => Effect.Effect<
    GlobalEnvironmentVariablesResult,
    EnvironmentVariablesError
  >;

  /**
   * Replace all globally scoped environment variables.
   */
  readonly saveGlobal: (
    input: SaveGlobalEnvironmentVariablesInput,
  ) => Effect.Effect<GlobalEnvironmentVariablesResult, EnvironmentVariablesError>;

  /**
   * Read environment variables attached to a project.
   */
  readonly getProject: (
    input: ProjectEnvironmentVariablesInput,
  ) => Effect.Effect<ProjectEnvironmentVariablesResult, EnvironmentVariablesError>;

  /**
   * Replace all environment variables attached to a project.
   */
  readonly saveProject: (
    input: SaveProjectEnvironmentVariablesInput,
  ) => Effect.Effect<ProjectEnvironmentVariablesResult, EnvironmentVariablesError>;

  /**
   * Resolve the merged runtime environment for a project.
   *
   * Project-scoped values override global values.
   */
  readonly resolveEnvironment: (
    input?: ProjectEnvironmentVariablesInput,
  ) => Effect.Effect<Record<string, string>, EnvironmentVariablesError>;
}

export class EnvironmentVariables extends ServiceMap.Service<
  EnvironmentVariables,
  EnvironmentVariablesShape
>()("okcode/persistence/Services/EnvironmentVariables/EnvironmentVariables") {}

export const GLOBAL_ENVIRONMENT_SCOPE = "global" as const;
export const PROJECT_ENVIRONMENT_SCOPE = "project" as const;

export const GlobalEnvironmentVariableRow = Schema.Struct({
  key: Schema.String,
  encryptedValue: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

export const ProjectEnvironmentVariableRow = Schema.Struct({
  projectId: Schema.String,
  key: Schema.String,
  encryptedValue: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

const SECRET_PAYLOAD_VERSION = "v1";
const SECRET_KEY_BYTES = 32;
const SECRET_IV_BYTES = 12;

type EnvironmentVariableScope = typeof GLOBAL_ENVIRONMENT_SCOPE | typeof PROJECT_ENVIRONMENT_SCOPE;

type NormalizedEnvironmentVariableEntry = EnvironmentVariableEntry;

function toEnvironmentVariableScopePrefix(scope: EnvironmentVariableScope): string {
  return scope === GLOBAL_ENVIRONMENT_SCOPE ? "global" : "project";
}

function encodeSecretPayload(input: {
  readonly key: Buffer;
  readonly scope: EnvironmentVariableScope;
  readonly projectId?: string | undefined;
  readonly envKey: string;
  readonly value: string;
}): string {
  const iv = randomBytes(SECRET_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", input.key, iv);
  cipher.setAAD(
    Buffer.from(
      [
        toEnvironmentVariableScopePrefix(input.scope),
        input.projectId ?? "",
        input.envKey,
      ].join("\0"),
      "utf8",
    ),
  );

  const ciphertext = Buffer.concat([
    cipher.update(input.value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    SECRET_PAYLOAD_VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

function decodeSecretPayload(input: {
  readonly key: Buffer;
  readonly scope: EnvironmentVariableScope;
  readonly projectId?: string | undefined;
  readonly envKey: string;
  readonly encryptedValue: string;
}): string {
  const parts = input.encryptedValue.split(":");
  if (parts.length !== 4 || parts[0] !== SECRET_PAYLOAD_VERSION) {
    throw new Error("Unsupported secret payload version.");
  }

  const [, ivRaw, authTagRaw, ciphertextRaw] = parts;
  if (!ivRaw || !authTagRaw || !ciphertextRaw) {
    throw new Error("Invalid encrypted payload.");
  }

  const iv = Buffer.from(ivRaw, "base64");
  const authTag = Buffer.from(authTagRaw, "base64");
  const ciphertext = Buffer.from(ciphertextRaw, "base64");
  const decipher = createDecipheriv("aes-256-gcm", input.key, iv);
  decipher.setAAD(
    Buffer.from(
      [
        toEnvironmentVariableScopePrefix(input.scope),
        input.projectId ?? "",
        input.envKey,
      ].join("\0"),
      "utf8",
    ),
  );
  decipher.setAuthTag(authTag);
  return `${decipher.update(ciphertext, undefined, "utf8")}${decipher.final("utf8")}`;
}

function normalizeEnvironmentEntries(
  entries: ReadonlyArray<EnvironmentVariableEntry>,
): ReadonlyArray<NormalizedEnvironmentVariableEntry> {
  const byKey = new Map<string, string>();
  for (const entry of entries) {
    byKey.set(entry.key.trim(), entry.value);
  }
  return Array.from(byKey.entries())
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({ key, value }));
}

function entriesToRecord(entries: ReadonlyArray<EnvironmentVariableEntry>): Record<string, string> {
  const record: Record<string, string> = {};
  for (const entry of entries) {
    record[entry.key] = entry.value;
  }
  return record;
}

async function readOrCreateSecretKey(secretKeyPath: string): Promise<Buffer> {
  try {
    const existing = await fs.readFile(secretKeyPath, "utf8");
    const decoded = Buffer.from(existing.trim(), "base64");
    if (decoded.byteLength !== SECRET_KEY_BYTES) {
      throw new Error("Invalid vault key length.");
    }
    return decoded;
  } catch (error) {
    const maybeCode = (error as NodeJS.ErrnoException | undefined)?.code;
    if (maybeCode !== "ENOENT") {
      throw error;
    }

    await fs.mkdir(path.dirname(secretKeyPath), { recursive: true });
    const key = randomBytes(SECRET_KEY_BYTES);
    try {
      await fs.writeFile(secretKeyPath, `${key.toString("base64")}\n`, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
    } catch (writeError) {
      const writeCode = (writeError as NodeJS.ErrnoException | undefined)?.code;
      if (writeCode === "EEXIST") {
        const existing = await fs.readFile(secretKeyPath, "utf8");
        const decoded = Buffer.from(existing.trim(), "base64");
        if (decoded.byteLength !== SECRET_KEY_BYTES) {
          throw new Error("Invalid vault key length.");
        }
        return decoded;
      }
      throw writeError;
    }
    return key;
  }
}

function toPersistenceCryptoError(operation: string): EnvironmentVariablesError {
  return new Error(`Crypto error in ${operation}.`);
}

function toPersistenceSqlError(operation: string): EnvironmentVariablesError {
  return new Error(`SQL error in ${operation}.`);
}

function toPersistenceDecodeError(operation: string): EnvironmentVariablesError {
  return new Error(`Decode error in ${operation}.`);
}

const makeEnvironmentVariables = Effect.gen(function* () {
  const sql = yield* (await import("effect/unstable/sql/SqlClient")).SqlClient;
  const { ServerConfig } = await import("../../config.ts");

  const { stateDir } = yield* ServerConfig;
  const secretKeyPath = path.join(stateDir, "environment-vault.key");
  let secretKeyPromise: Promise<Buffer> | null = null;

  const getSecretKey = () => {
    if (!secretKeyPromise) {
      secretKeyPromise = readOrCreateSecretKey(secretKeyPath).catch((error) => {
        secretKeyPromise = null;
        throw error;
      });
    }
    return secretKeyPromise;
  };

  const globalRows = Schema.Array(GlobalEnvironmentVariableRow);
  const projectRows = Schema.Array(ProjectEnvironmentVariableRow);

  const listGlobalRows = async () =>
    sql`
      SELECT
        env_key AS "key",
        encrypted_value AS "encryptedValue",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM global_environment_variables
      ORDER BY env_key ASC
    `;

  const listProjectRows = async (projectId: string) =>
    sql`
      SELECT
        project_id AS "projectId",
        env_key AS "key",
        encrypted_value AS "encryptedValue",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM project_environment_variables
      WHERE project_id = ${projectId}
      ORDER BY env_key ASC
    `;

  const decodeRows = async <S extends Schema.Top>(rows: unknown, schema: S) =>
    Schema.decodeUnknownEffect(schema)(rows);

  const readGlobalEntries = Effect.fnUntraced(function* () {
    const rows = yield* Effect.tryPromise({
      try: listGlobalRows,
      catch: (cause) => toPersistenceSqlError("EnvironmentVariables.getGlobal:query"),
    });
    const parsedRows = yield* decodeRows(rows, globalRows).pipe(
      Effect.mapError(() => toPersistenceDecodeError("EnvironmentVariables.getGlobal:decodeRows")),
    );
    const key = yield* Effect.tryPromise({
      try: getSecretKey,
      catch: (cause) => toPersistenceCryptoError("EnvironmentVariables.getGlobal:secretKey"),
    });
    return parsedRows.map((row) => ({
      key: row.key,
      value: decodeSecretPayload({
        key,
        scope: GLOBAL_ENVIRONMENT_SCOPE,
        envKey: row.key,
        encryptedValue: row.encryptedValue,
      }),
    }));
  });

  const readProjectEntries = Effect.fnUntraced(function* (projectId: string) {
    const rows = yield* Effect.tryPromise({
      try: () => listProjectRows(projectId),
      catch: () => toPersistenceSqlError("EnvironmentVariables.getProject:query"),
    });
    const parsedRows = yield* decodeRows(rows, projectRows).pipe(
      Effect.mapError(() => toPersistenceDecodeError("EnvironmentVariables.getProject:decodeRows")),
    );
    const key = yield* Effect.tryPromise({
      try: getSecretKey,
      catch: () => toPersistenceCryptoError("EnvironmentVariables.getProject:secretKey"),
    });
    return parsedRows.map((row) => ({
      key: row.key,
      value: decodeSecretPayload({
        key,
        scope: PROJECT_ENVIRONMENT_SCOPE,
        projectId,
        envKey: row.key,
        encryptedValue: row.encryptedValue,
      }),
    }));
  });

  const writeEntries = Effect.fnUntraced(function* (input: {
    readonly scope: EnvironmentVariableScope;
    readonly projectId?: string | undefined;
    readonly entries: ReadonlyArray<EnvironmentVariableEntry>;
  }) {
    const normalizedEntries = normalizeEnvironmentEntries(input.entries);
    const secretKey = yield* Effect.tryPromise({
      try: getSecretKey,
      catch: () => toPersistenceCryptoError("EnvironmentVariables.save:secretKey"),
    });
    const now = new Date().toISOString();
    const encryptedRows = normalizedEntries.map((entry) => ({
      key: entry.key,
      encryptedValue: encodeSecretPayload({
        key: secretKey,
        scope: input.scope,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        envKey: entry.key,
        value: entry.value,
      }),
      createdAt: now,
      updatedAt: now,
      ...(input.projectId ? { projectId: input.projectId } : {}),
    }));

    const query = input.scope === GLOBAL_ENVIRONMENT_SCOPE
      ? sql.withTransaction(
          Effect.gen(function* () {
            yield* sql`
              DELETE FROM global_environment_variables
            `;
            for (const row of encryptedRows) {
              yield* sql`
                INSERT INTO global_environment_variables (
                  env_key,
                  encrypted_value,
                  created_at,
                  updated_at
                )
                VALUES (
                  ${row.key},
                  ${row.encryptedValue},
                  ${row.createdAt},
                  ${row.updatedAt}
                )
              `;
            }
          }),
        )
      : sql.withTransaction(
          Effect.gen(function* () {
            yield* sql`
              DELETE FROM project_environment_variables
              WHERE project_id = ${input.projectId}
            `;
            for (const row of encryptedRows) {
              yield* sql`
                INSERT INTO project_environment_variables (
                  project_id,
                  env_key,
                  encrypted_value,
                  created_at,
                  updated_at
                )
                VALUES (
                  ${input.projectId},
                  ${row.key},
                  ${row.encryptedValue},
                  ${row.createdAt},
                  ${row.updatedAt}
                )
              `;
            }
          }),
        );

    yield* query.pipe(
      Effect.mapError(() => toPersistenceSqlError("EnvironmentVariables.save:query")),
    );
    return normalizedEntries;
  });

  const getGlobal: EnvironmentVariablesShape["getGlobal"] = () =>
    readGlobalEntries().pipe(
      Effect.map((entries) => ({ entries })),
    );

  const saveGlobal: EnvironmentVariablesShape["saveGlobal"] = (input) =>
    writeEntries({
      scope: GLOBAL_ENVIRONMENT_SCOPE,
      entries: input.entries,
    }).pipe(
      Effect.map((entries) => ({ entries })),
    );

  const getProject: EnvironmentVariablesShape["getProject"] = (input) =>
    readProjectEntries(input.projectId).pipe(
      Effect.map((entries) => ({ projectId: input.projectId, entries })),
    );

  const saveProject: EnvironmentVariablesShape["saveProject"] = (input) =>
    writeEntries({
      scope: PROJECT_ENVIRONMENT_SCOPE,
      projectId: input.projectId,
      entries: input.entries,
    }).pipe(
      Effect.map((entries) => ({ projectId: input.projectId, entries })),
    );

  const resolveEnvironment: EnvironmentVariablesShape["resolveEnvironment"] = (input) =>
    Effect.gen(function* () {
      const globalEntries = yield* readGlobalEntries();
      const projectEntries = input ? yield* readProjectEntries(input.projectId) : [];
      return entriesToRecord([...globalEntries, ...projectEntries]);
    });

  return {
    getGlobal,
    saveGlobal,
    getProject,
    saveProject,
    resolveEnvironment,
  } satisfies EnvironmentVariablesShape;
});

export const EnvironmentVariablesLive = Effect.gen(function* () {
  const env = yield* makeEnvironmentVariables;
  return env;
});

