/**
 * EnvironmentVariables - Encrypted environment variable persistence.
 *
 * Owns encrypted storage for global environment variables and project-scoped
 * overrides. Decryption is only exposed through this service so callers never
 * need to know the on-disk representation.
 *
 * @module EnvironmentVariables
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  type EnvironmentVariableEntry,
  type GlobalEnvironmentVariablesResult,
  type ProjectEnvironmentVariablesInput,
  type ProjectEnvironmentVariablesResult,
  type SaveGlobalEnvironmentVariablesInput,
  type SaveProjectEnvironmentVariablesInput,
} from "@okcode/contracts";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import { Effect, Layer, Schema, ServiceMap } from "effect";

import { ServerConfig } from "../../config.ts";
import {
  PersistenceCryptoError,
  PersistenceDecodeError,
  PersistenceSqlError,
  toPersistenceCryptoError,
  toPersistenceDecodeError,
  toPersistenceSqlError,
} from "../Errors.ts";

export interface EnvironmentVariablesShape {
  readonly getGlobal: () => Effect.Effect<
    GlobalEnvironmentVariablesResult,
    EnvironmentVariablesError
  >;
  readonly saveGlobal: (
    input: SaveGlobalEnvironmentVariablesInput,
  ) => Effect.Effect<GlobalEnvironmentVariablesResult, EnvironmentVariablesError>;
  readonly getProject: (
    input: ProjectEnvironmentVariablesInput,
  ) => Effect.Effect<ProjectEnvironmentVariablesResult, EnvironmentVariablesError>;
  readonly saveProject: (
    input: SaveProjectEnvironmentVariablesInput,
  ) => Effect.Effect<ProjectEnvironmentVariablesResult, EnvironmentVariablesError>;
  readonly resolveEnvironment: (
    input?: ProjectEnvironmentVariablesInput,
  ) => Effect.Effect<Record<string, string>, EnvironmentVariablesError>;
}

export class EnvironmentVariables extends ServiceMap.Service<
  EnvironmentVariables,
  EnvironmentVariablesShape
>()("okcode/persistence/Services/EnvironmentVariables/EnvironmentVariables") {}

export type EnvironmentVariablesError =
  | PersistenceSqlError
  | PersistenceDecodeError
  | PersistenceCryptoError;

const SECRET_PAYLOAD_VERSION = "v1";
const SECRET_KEY_BYTES = 32;
const SECRET_IV_BYTES = 12;

const GlobalEnvironmentVariableRow = Schema.Struct({
  key: Schema.String,
  encryptedValue: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

const ProjectEnvironmentVariableRow = Schema.Struct({
  projectId: Schema.String,
  key: Schema.String,
  encryptedValue: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

function normalizeEnvironmentEntries(
  entries: ReadonlyArray<EnvironmentVariableEntry>,
): ReadonlyArray<EnvironmentVariableEntry> {
  const byKey = new Map<string, string>();
  for (const entry of entries) {
    const key = entry.key.trim();
    if (key.length === 0) continue;
    byKey.set(key, entry.value);
  }

  return [...byKey.entries()]
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

function encodeSecretPayload(input: {
  readonly key: Buffer;
  readonly scope: "global" | "project";
  readonly projectId?: string;
  readonly envKey: string;
  readonly value: string;
}): string {
  const iv = randomBytes(SECRET_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", input.key, iv);
  cipher.setAAD(Buffer.from([input.scope, input.projectId ?? "", input.envKey].join("\0"), "utf8"));

  const ciphertext = Buffer.concat([cipher.update(input.value, "utf8"), cipher.final()]);
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
  readonly scope: "global" | "project";
  readonly projectId?: string;
  readonly envKey: string;
  readonly encryptedValue: string;
}): string {
  const parts = input.encryptedValue.split(":");
  if (parts.length !== 4 || parts[0] !== SECRET_PAYLOAD_VERSION) {
    throw new Error("Unsupported secret payload version.");
  }

  const [, ivRaw, authTagRaw, ciphertextRaw] = parts;
  const iv = Buffer.from(ivRaw ?? "", "base64");
  const authTag = Buffer.from(authTagRaw ?? "", "base64");
  const ciphertext = Buffer.from(ciphertextRaw ?? "", "base64");
  if (iv.byteLength !== SECRET_IV_BYTES || authTag.byteLength !== 16) {
    throw new Error("Invalid encrypted payload.");
  }

  const decipher = createDecipheriv("aes-256-gcm", input.key, iv);
  decipher.setAAD(
    Buffer.from([input.scope, input.projectId ?? "", input.envKey].join("\0"), "utf8"),
  );
  decipher.setAuthTag(authTag);
  return `${decipher.update(ciphertext, undefined, "utf8")}${decipher.final("utf8")}`;
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
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code !== "ENOENT") {
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
      return key;
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
  }
}

function toEnvironmentError(operation: string, error: unknown): EnvironmentVariablesError {
  if (Schema.is(PersistenceCryptoError)(error)) {
    return error;
  }
  if (Schema.is(PersistenceSqlError)(error)) {
    return error;
  }
  if (Schema.is(PersistenceDecodeError)(error)) {
    return error;
  }
  if (error instanceof Error) {
    return new PersistenceCryptoError({
      operation,
      detail: error.message.length > 0 ? error.message : `Failed to execute ${operation}`,
      cause: error,
    });
  }
  return toPersistenceCryptoError(operation)(error);
}

export const EnvironmentVariablesLive = Layer.effect(
  EnvironmentVariables,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
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

    const listGlobalRows = SqlSchema.findAll({
      Request: Schema.Void,
      Result: GlobalEnvironmentVariableRow,
      execute: () =>
        sql`
          SELECT
            env_key AS "key",
            encrypted_value AS "encryptedValue",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM global_environment_variables
          ORDER BY env_key ASC
        `,
    });

    const listProjectRows = SqlSchema.findAll({
      Request: ProjectEnvironmentVariablesInput,
      Result: ProjectEnvironmentVariableRow,
      execute: ({ projectId }) =>
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
        `,
    });

    const readGlobalEntries = Effect.fnUntraced(function* () {
      const rows = yield* listGlobalRows().pipe(
        Effect.mapError((cause) =>
          Schema.isSchemaError(cause)
            ? toPersistenceDecodeError("EnvironmentVariables.getGlobal:decodeRows")(cause)
            : toPersistenceSqlError("EnvironmentVariables.getGlobal:query")(cause),
        ),
      );
      const secretKey = yield* Effect.tryPromise({
        try: getSecretKey,
        catch: (cause) =>
          toPersistenceCryptoError("EnvironmentVariables.getGlobal:secretKey")(cause),
      });
      return yield* Effect.try({
        try: () =>
          rows.map((row) => ({
            key: row.key,
            value: decodeSecretPayload({
              key: secretKey,
              scope: "global",
              envKey: row.key,
              encryptedValue: row.encryptedValue,
            }),
          })),
        catch: (cause) => toEnvironmentError("EnvironmentVariables.getGlobal:decryptRows", cause),
      });
    });

    const readProjectEntries = Effect.fnUntraced(function* (projectId: string) {
      const rows = yield* listProjectRows({ projectId }).pipe(
        Effect.mapError((cause) =>
          Schema.isSchemaError(cause)
            ? toPersistenceDecodeError("EnvironmentVariables.getProject:decodeRows")(cause)
            : toPersistenceSqlError("EnvironmentVariables.getProject:query")(cause),
        ),
      );
      const secretKey = yield* Effect.tryPromise({
        try: getSecretKey,
        catch: (cause) =>
          toPersistenceCryptoError("EnvironmentVariables.getProject:secretKey")(cause),
      });
      return yield* Effect.try({
        try: () =>
          rows.map((row) => ({
            key: row.key,
            value: decodeSecretPayload({
              key: secretKey,
              scope: "project",
              projectId,
              envKey: row.key,
              encryptedValue: row.encryptedValue,
            }),
          })),
        catch: (cause) => toEnvironmentError("EnvironmentVariables.getProject:decryptRows", cause),
      });
    });

    const persistEntries = Effect.fnUntraced(function* (input: {
      readonly scope: "global" | "project";
      readonly projectId?: string;
      readonly entries: ReadonlyArray<EnvironmentVariableEntry>;
    }) {
      const normalizedEntries = normalizeEnvironmentEntries(input.entries);
      const secretKey = yield* Effect.tryPromise({
        try: getSecretKey,
        catch: (cause) => toPersistenceCryptoError("EnvironmentVariables.save:secretKey")(cause),
      });
      const now = new Date().toISOString();
      const encryptedRows = yield* Effect.try({
        try: () =>
          normalizedEntries.map((entry) => ({
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
          })),
        catch: (cause) => toEnvironmentError("EnvironmentVariables.save:encryptRows", cause),
      });

      yield* sql
        .withTransaction(
          Effect.gen(function* () {
            if (input.scope === "global") {
              yield* sql`DELETE FROM global_environment_variables`;
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
              return;
            }

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
        )
        .pipe(
          Effect.mapError((cause) =>
            toPersistenceSqlError("EnvironmentVariables.save:query")(cause),
          ),
        );

      return normalizedEntries;
    });

    const getGlobal: EnvironmentVariablesShape["getGlobal"] = () =>
      readGlobalEntries().pipe(Effect.map((entries) => ({ entries })));

    const saveGlobal: EnvironmentVariablesShape["saveGlobal"] = (input) =>
      persistEntries({
        scope: "global",
        entries: input.entries,
      }).pipe(Effect.map((entries) => ({ entries })));

    const getProject: EnvironmentVariablesShape["getProject"] = (input) =>
      readProjectEntries(input.projectId).pipe(
        Effect.map((entries) => ({ projectId: input.projectId, entries })),
      );

    const saveProject: EnvironmentVariablesShape["saveProject"] = (input) =>
      persistEntries({
        scope: "project",
        projectId: input.projectId,
        entries: input.entries,
      }).pipe(Effect.map((entries) => ({ projectId: input.projectId, entries })));

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
  }),
);
