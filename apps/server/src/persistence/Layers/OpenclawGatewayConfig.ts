import type {
  OpenclawGatewayConfigSummary,
  ResetOpenclawGatewayDeviceStateInput,
  SaveOpenclawGatewayConfigInput,
} from "@okcode/contracts";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import { Effect, Layer, Option, Schema } from "effect";
import path from "node:path";

import { ServerConfig } from "../../config.ts";
import { generateOpenclawDeviceIdentity } from "../../openclaw/deviceAuth.ts";
import {
  PersistenceCryptoError,
  toPersistenceCryptoError,
  toPersistenceDecodeError,
  toPersistenceSqlError,
} from "../Errors.ts";
import {
  OpenclawGatewayConfig,
  type OpenclawGatewayConfigError,
  type OpenclawGatewayStoredConfig,
  type ResolveOpenclawGatewayConfigInput,
  type SaveOpenclawDeviceTokenInput,
} from "../Services/OpenclawGatewayConfig.ts";
import { decodeVaultPayload, encodeVaultPayload, readOrCreateVaultKey } from "../vault.ts";

const OPENCLAW_CONFIG_ID = "default";

const OpenclawGatewayConfigRow = Schema.Struct({
  configId: Schema.String,
  gatewayUrl: Schema.String,
  encryptedSharedSecret: Schema.NullOr(Schema.String),
  deviceId: Schema.String,
  devicePublicKey: Schema.String,
  deviceFingerprint: Schema.String,
  encryptedDevicePrivateKey: Schema.String,
  encryptedDeviceToken: Schema.NullOr(Schema.String),
  deviceTokenRole: Schema.NullOr(Schema.String),
  deviceTokenScopesJson: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

const GetOpenclawGatewayConfigRequest = Schema.Struct({
  configId: Schema.String,
});

function emptySummary(): OpenclawGatewayConfigSummary {
  return {
    gatewayUrl: null,
    hasSharedSecret: false,
    deviceId: null,
    devicePublicKey: null,
    deviceFingerprint: null,
    hasDeviceToken: false,
    deviceTokenRole: null,
    deviceTokenScopes: [],
    updatedAt: null,
  };
}

function normalizeScopes(scopes: ReadonlyArray<string> | undefined): string[] {
  const unique = new Set<string>();
  for (const scope of scopes ?? []) {
    const trimmed = scope.trim();
    if (trimmed.length > 0) {
      unique.add(trimmed);
    }
  }
  return [...unique].sort((left, right) => left.localeCompare(right));
}

function fromGeneratedIdentity(identity: ReturnType<typeof generateOpenclawDeviceIdentity>) {
  return {
    deviceId: identity.deviceId,
    devicePublicKey: identity.publicKey,
    deviceFingerprint: identity.deviceFingerprint,
    devicePrivateKeyPem: identity.privateKeyPem,
  };
}

function makeStoredConfig(input: {
  readonly gatewayUrl: string;
  readonly sharedSecret: string | undefined;
  readonly deviceId: string;
  readonly devicePublicKey: string;
  readonly deviceFingerprint: string;
  readonly devicePrivateKeyPem: string;
  readonly deviceToken: string | undefined;
  readonly deviceTokenRole: string | undefined;
  readonly deviceTokenScopes: ReadonlyArray<string>;
  readonly updatedAt: string;
}): OpenclawGatewayStoredConfig {
  return {
    gatewayUrl: input.gatewayUrl,
    sharedSecret: input.sharedSecret,
    deviceId: input.deviceId,
    devicePublicKey: input.devicePublicKey,
    deviceFingerprint: input.deviceFingerprint,
    devicePrivateKeyPem: input.devicePrivateKeyPem,
    deviceToken: input.deviceToken,
    deviceTokenRole: input.deviceTokenRole,
    deviceTokenScopes: normalizeScopes(input.deviceTokenScopes),
    updatedAt: input.updatedAt,
  };
}

function toSummary(config: OpenclawGatewayStoredConfig | null): OpenclawGatewayConfigSummary {
  if (!config) {
    return emptySummary();
  }
  return {
    gatewayUrl: config.gatewayUrl,
    hasSharedSecret: Boolean(config.sharedSecret),
    deviceId: config.deviceId,
    devicePublicKey: config.devicePublicKey,
    deviceFingerprint: config.deviceFingerprint,
    hasDeviceToken: Boolean(config.deviceToken),
    deviceTokenRole: config.deviceTokenRole ?? null,
    deviceTokenScopes: [...config.deviceTokenScopes],
    updatedAt: config.updatedAt,
  };
}

function toOpenclawGatewayConfigError(
  operation: string,
  cause: unknown,
): OpenclawGatewayConfigError {
  if (Schema.is(PersistenceCryptoError)(cause)) {
    return cause;
  }
  if (Schema.isSchemaError(cause)) {
    return toPersistenceDecodeError(operation)(cause);
  }
  if (cause instanceof Error) {
    return new PersistenceCryptoError({
      operation,
      detail: cause.message.length > 0 ? cause.message : `Failed to execute ${operation}`,
      cause,
    });
  }
  return toPersistenceCryptoError(operation)(cause);
}

export const OpenclawGatewayConfigLive = Layer.effect(
  OpenclawGatewayConfig,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const { stateDir } = yield* ServerConfig;
    const secretKeyPath = path.join(stateDir, "openclaw-vault.key");
    let secretKeyPromise: Promise<Buffer> | null = null;

    const getSecretKey = () => {
      if (!secretKeyPromise) {
        secretKeyPromise = readOrCreateVaultKey(secretKeyPath).catch((error) => {
          secretKeyPromise = null;
          throw error;
        });
      }
      return secretKeyPromise;
    };

    const findRow = SqlSchema.findOneOption({
      Request: GetOpenclawGatewayConfigRequest,
      Result: OpenclawGatewayConfigRow,
      execute: ({ configId }) =>
        sql`
          SELECT
            config_id AS "configId",
            gateway_url AS "gatewayUrl",
            encrypted_shared_secret AS "encryptedSharedSecret",
            device_id AS "deviceId",
            device_public_key AS "devicePublicKey",
            device_fingerprint AS "deviceFingerprint",
            encrypted_device_private_key AS "encryptedDevicePrivateKey",
            encrypted_device_token AS "encryptedDeviceToken",
            device_token_role AS "deviceTokenRole",
            device_token_scopes_json AS "deviceTokenScopesJson",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM openclaw_gateway_config
          WHERE config_id = ${configId}
        `,
    });

    const upsertRow = SqlSchema.void({
      Request: OpenclawGatewayConfigRow,
      execute: (row) =>
        sql`
          INSERT INTO openclaw_gateway_config (
            config_id,
            gateway_url,
            encrypted_shared_secret,
            device_id,
            device_public_key,
            device_fingerprint,
            encrypted_device_private_key,
            encrypted_device_token,
            device_token_role,
            device_token_scopes_json,
            created_at,
            updated_at
          ) VALUES (
            ${row.configId},
            ${row.gatewayUrl},
            ${row.encryptedSharedSecret},
            ${row.deviceId},
            ${row.devicePublicKey},
            ${row.deviceFingerprint},
            ${row.encryptedDevicePrivateKey},
            ${row.encryptedDeviceToken},
            ${row.deviceTokenRole},
            ${row.deviceTokenScopesJson},
            ${row.createdAt},
            ${row.updatedAt}
          )
          ON CONFLICT (config_id)
          DO UPDATE SET
            gateway_url = excluded.gateway_url,
            encrypted_shared_secret = excluded.encrypted_shared_secret,
            device_id = excluded.device_id,
            device_public_key = excluded.device_public_key,
            device_fingerprint = excluded.device_fingerprint,
            encrypted_device_private_key = excluded.encrypted_device_private_key,
            encrypted_device_token = excluded.encrypted_device_token,
            device_token_role = excluded.device_token_role,
            device_token_scopes_json = excluded.device_token_scopes_json,
            updated_at = excluded.updated_at
        `,
    });

    const decodeRow = (row: typeof OpenclawGatewayConfigRow.Type) =>
      Effect.tryPromise({
        try: async () => {
          const key = await getSecretKey();
          const deviceTokenScopes = normalizeScopes(
            JSON.parse(row.deviceTokenScopesJson) as ReadonlyArray<string>,
          );
          const sharedSecret =
            row.encryptedSharedSecret !== null
              ? decodeVaultPayload({
                  key,
                  aad: ["openclaw", "shared-secret", row.gatewayUrl],
                  encryptedValue: row.encryptedSharedSecret,
                })
              : undefined;
          const devicePrivateKeyPem = decodeVaultPayload({
            key,
            aad: ["openclaw", "device-private-key", row.deviceId],
            encryptedValue: row.encryptedDevicePrivateKey,
          });
          const deviceToken =
            row.encryptedDeviceToken !== null
              ? decodeVaultPayload({
                  key,
                  aad: ["openclaw", "device-token", row.deviceId, row.deviceTokenRole ?? ""],
                  encryptedValue: row.encryptedDeviceToken,
                })
              : undefined;

          return {
            gatewayUrl: row.gatewayUrl,
            sharedSecret,
            deviceId: row.deviceId,
            devicePublicKey: row.devicePublicKey,
            deviceFingerprint: row.deviceFingerprint,
            devicePrivateKeyPem,
            deviceToken,
            deviceTokenRole: row.deviceTokenRole ?? undefined,
            deviceTokenScopes,
            updatedAt: row.updatedAt,
          } satisfies OpenclawGatewayStoredConfig;
        },
        catch: (cause) => toOpenclawGatewayConfigError("OpenclawGatewayConfig.decodeRow", cause),
      });

    const writeConfig = (config: OpenclawGatewayStoredConfig) =>
      Effect.gen(function* () {
        const key = yield* Effect.tryPromise({
          try: () => getSecretKey(),
          catch: (cause) =>
            toOpenclawGatewayConfigError("OpenclawGatewayConfig.writeConfig:key", cause),
        });
        const now = new Date().toISOString();
        const row = {
          configId: OPENCLAW_CONFIG_ID,
          gatewayUrl: config.gatewayUrl,
          encryptedSharedSecret:
            config.sharedSecret !== undefined
              ? encodeVaultPayload({
                  key,
                  aad: ["openclaw", "shared-secret", config.gatewayUrl],
                  value: config.sharedSecret,
                })
              : null,
          deviceId: config.deviceId,
          devicePublicKey: config.devicePublicKey,
          deviceFingerprint: config.deviceFingerprint,
          encryptedDevicePrivateKey: encodeVaultPayload({
            key,
            aad: ["openclaw", "device-private-key", config.deviceId],
            value: config.devicePrivateKeyPem,
          }),
          encryptedDeviceToken:
            config.deviceToken !== undefined
              ? encodeVaultPayload({
                  key,
                  aad: ["openclaw", "device-token", config.deviceId, config.deviceTokenRole ?? ""],
                  value: config.deviceToken,
                })
              : null,
          deviceTokenRole: config.deviceTokenRole ?? null,
          deviceTokenScopesJson: JSON.stringify(normalizeScopes(config.deviceTokenScopes)),
          createdAt: now,
          updatedAt: now,
        };
        yield* upsertRow(row).pipe(
          Effect.mapError(toPersistenceSqlError("OpenclawGatewayConfig.writeConfig:query")),
        );
      });

    const getStored = () =>
      findRow({ configId: OPENCLAW_CONFIG_ID }).pipe(
        Effect.mapError(toPersistenceSqlError("OpenclawGatewayConfig.getStored:query")),
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.succeed(null),
            onSome: (row) => decodeRow(row),
          }),
        ),
      );

    const save = (input: SaveOpenclawGatewayConfigInput) =>
      Effect.gen(function* () {
        const existing = yield* getStored();
        const sharedSecret = input.clearSharedSecret
          ? undefined
          : input.sharedSecret?.trim() !== undefined && input.sharedSecret.trim().length > 0
            ? input.sharedSecret.trim()
            : existing?.sharedSecret;
        const identity =
          existing ??
          (() => {
            const generatedIdentity = fromGeneratedIdentity(generateOpenclawDeviceIdentity());
            return {
              ...generatedIdentity,
              deviceToken: undefined,
              deviceTokenRole: undefined,
              deviceTokenScopes: [],
              updatedAt: new Date().toISOString(),
              gatewayUrl: input.gatewayUrl,
              sharedSecret,
            };
          })();
        const nextConfig = makeStoredConfig({
          gatewayUrl: input.gatewayUrl,
          sharedSecret,
          deviceId: identity.deviceId,
          devicePublicKey: identity.devicePublicKey,
          deviceFingerprint: identity.deviceFingerprint,
          devicePrivateKeyPem: identity.devicePrivateKeyPem,
          deviceToken: identity.deviceToken,
          deviceTokenRole: identity.deviceTokenRole,
          deviceTokenScopes: identity.deviceTokenScopes,
          updatedAt: new Date().toISOString(),
        });
        yield* writeConfig(nextConfig);
        return toSummary(nextConfig);
      });

    const saveDeviceToken = (input: SaveOpenclawDeviceTokenInput) =>
      Effect.gen(function* () {
        const existing = yield* getStored();
        if (!existing) {
          return;
        }
        yield* writeConfig(
          makeStoredConfig({
            ...existing,
            deviceToken: input.deviceToken,
            deviceTokenRole: input.role ?? existing.deviceTokenRole,
            deviceTokenScopes: input.scopes ?? existing.deviceTokenScopes,
            updatedAt: new Date().toISOString(),
          }),
        );
      });

    const clearDeviceToken = () =>
      Effect.gen(function* () {
        const existing = yield* getStored();
        if (!existing) {
          return;
        }
        yield* writeConfig(
          makeStoredConfig({
            ...existing,
            deviceToken: undefined,
            deviceTokenRole: undefined,
            deviceTokenScopes: [],
            updatedAt: new Date().toISOString(),
          }),
        );
      });

    const resetDeviceState = (input?: ResetOpenclawGatewayDeviceStateInput) =>
      Effect.gen(function* () {
        const existing = yield* getStored();
        if (!existing) {
          return emptySummary();
        }
        const regenerateIdentity = input?.regenerateIdentity ?? true;
        const nextIdentity = regenerateIdentity
          ? fromGeneratedIdentity(generateOpenclawDeviceIdentity())
          : existing;
        const nextConfig = makeStoredConfig({
          gatewayUrl: existing.gatewayUrl,
          sharedSecret: existing.sharedSecret,
          deviceId: nextIdentity.deviceId,
          devicePublicKey: nextIdentity.devicePublicKey,
          deviceFingerprint: nextIdentity.deviceFingerprint,
          devicePrivateKeyPem: nextIdentity.devicePrivateKeyPem,
          deviceToken: undefined,
          deviceTokenRole: undefined,
          deviceTokenScopes: [],
          updatedAt: new Date().toISOString(),
        });
        yield* writeConfig(nextConfig);
        return toSummary(nextConfig);
      });

    const resolveForConnect = (input?: ResolveOpenclawGatewayConfigInput) =>
      Effect.gen(function* () {
        const existing = yield* getStored();
        if (!existing) {
          const gatewayUrl = input?.gatewayUrl?.trim();
          if (!gatewayUrl) {
            return null;
          }
          if (!input?.allowEphemeralIdentity) {
            return null;
          }
          const identity = fromGeneratedIdentity(generateOpenclawDeviceIdentity());
          const sharedSecret =
            input.sharedSecret?.trim() && input.sharedSecret.trim().length > 0
              ? input.sharedSecret.trim()
              : undefined;
          return makeStoredConfig({
            gatewayUrl,
            sharedSecret,
            deviceId: identity.deviceId,
            devicePublicKey: identity.devicePublicKey,
            deviceFingerprint: identity.deviceFingerprint,
            devicePrivateKeyPem: identity.devicePrivateKeyPem,
            deviceToken: undefined,
            deviceTokenRole: undefined,
            deviceTokenScopes: [],
            updatedAt: new Date().toISOString(),
          });
        }

        const gatewayUrl = input?.gatewayUrl?.trim() || existing.gatewayUrl;
        const sharedSecret =
          input?.sharedSecret?.trim() && input.sharedSecret.trim().length > 0
            ? input.sharedSecret.trim()
            : existing.sharedSecret;
        return makeStoredConfig({
          ...existing,
          gatewayUrl,
          sharedSecret,
        });
      });

    const getSummary = () => getStored().pipe(Effect.map(toSummary));

    return {
      getSummary,
      getStored,
      save,
      resolveForConnect,
      saveDeviceToken,
      clearDeviceToken,
      resetDeviceState,
    };
  }),
);
