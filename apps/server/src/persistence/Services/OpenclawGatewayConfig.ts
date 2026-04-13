import type {
  OpenclawGatewayConfigSummary,
  ResetOpenclawGatewayDeviceStateInput,
  SaveOpenclawGatewayConfigInput,
} from "@okcode/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

import type {
  PersistenceCryptoError,
  PersistenceDecodeError,
  PersistenceSqlError,
} from "../Errors.ts";

export type OpenclawGatewayConfigError =
  | PersistenceSqlError
  | PersistenceDecodeError
  | PersistenceCryptoError;

export interface OpenclawGatewayStoredConfig {
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
}

export interface ResolveOpenclawGatewayConfigInput {
  readonly gatewayUrl?: string;
  readonly sharedSecret?: string;
  readonly allowEphemeralIdentity?: boolean;
}

export interface SaveOpenclawDeviceTokenInput {
  readonly deviceToken: string;
  readonly role?: string;
  readonly scopes?: ReadonlyArray<string>;
}

export interface OpenclawGatewayConfigShape {
  readonly getSummary: () => Effect.Effect<
    OpenclawGatewayConfigSummary,
    OpenclawGatewayConfigError
  >;
  readonly getStored: () => Effect.Effect<
    OpenclawGatewayStoredConfig | null,
    OpenclawGatewayConfigError
  >;
  readonly save: (
    input: SaveOpenclawGatewayConfigInput,
  ) => Effect.Effect<OpenclawGatewayConfigSummary, OpenclawGatewayConfigError>;
  readonly resolveForConnect: (
    input?: ResolveOpenclawGatewayConfigInput,
  ) => Effect.Effect<OpenclawGatewayStoredConfig | null, OpenclawGatewayConfigError>;
  readonly saveDeviceToken: (
    input: SaveOpenclawDeviceTokenInput,
  ) => Effect.Effect<void, OpenclawGatewayConfigError>;
  readonly clearDeviceToken: () => Effect.Effect<void, OpenclawGatewayConfigError>;
  readonly resetDeviceState: (
    input?: ResetOpenclawGatewayDeviceStateInput,
  ) => Effect.Effect<OpenclawGatewayConfigSummary, OpenclawGatewayConfigError>;
}

export class OpenclawGatewayConfig extends ServiceMap.Service<
  OpenclawGatewayConfig,
  OpenclawGatewayConfigShape
>()("okcode/persistence/Services/OpenclawGatewayConfig") {}
