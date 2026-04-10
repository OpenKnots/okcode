import { Schema } from "effect";
import { DeviceId, IsoDateTime, PairingId, TrimmedNonEmptyString } from "./baseSchemas";
import { BuildMetadata } from "./buildInfo";
import { KeybindingRule, ResolvedKeybindingsConfig } from "./keybindings";
import { EditorId } from "./editor";
import { ProviderKind } from "./orchestration";

const KeybindingsMalformedConfigIssue = Schema.Struct({
  kind: Schema.Literal("keybindings.malformed-config"),
  message: TrimmedNonEmptyString,
});

const KeybindingsInvalidEntryIssue = Schema.Struct({
  kind: Schema.Literal("keybindings.invalid-entry"),
  message: TrimmedNonEmptyString,
  index: Schema.Number,
});

export const ServerConfigIssue = Schema.Union([
  KeybindingsMalformedConfigIssue,
  KeybindingsInvalidEntryIssue,
]);
export type ServerConfigIssue = typeof ServerConfigIssue.Type;

const ServerConfigIssues = Schema.Array(ServerConfigIssue);

export const ServerProviderStatusState = Schema.Literals(["ready", "warning", "error"]);
export type ServerProviderStatusState = typeof ServerProviderStatusState.Type;

export const ServerProviderAuthStatus = Schema.Literals([
  "authenticated",
  "unauthenticated",
  "unknown",
]);
export type ServerProviderAuthStatus = typeof ServerProviderAuthStatus.Type;

export const ServerProviderStatus = Schema.Struct({
  provider: ProviderKind,
  status: ServerProviderStatusState,
  available: Schema.Boolean,
  authStatus: ServerProviderAuthStatus,
  checkedAt: IsoDateTime,
  message: Schema.optional(TrimmedNonEmptyString),
});
export type ServerProviderStatus = typeof ServerProviderStatus.Type;

const ServerProviderStatuses = Schema.Array(ServerProviderStatus);

export const ServerConfig = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  keybindingsConfigPath: TrimmedNonEmptyString,
  keybindings: ResolvedKeybindingsConfig,
  issues: ServerConfigIssues,
  providers: ServerProviderStatuses,
  availableEditors: Schema.Array(EditorId),
  buildInfo: Schema.optional(BuildMetadata),
});
export type ServerConfig = typeof ServerConfig.Type;

export const ServerUpsertKeybindingInput = KeybindingRule;
export type ServerUpsertKeybindingInput = typeof ServerUpsertKeybindingInput.Type;

export const ServerUpsertKeybindingResult = Schema.Struct({
  keybindings: ResolvedKeybindingsConfig,
  issues: ServerConfigIssues,
});
export type ServerUpsertKeybindingResult = typeof ServerUpsertKeybindingResult.Type;

export const ServerConfigUpdatedPayload = Schema.Struct({
  issues: ServerConfigIssues,
  providers: ServerProviderStatuses,
});
export type ServerConfigUpdatedPayload = typeof ServerConfigUpdatedPayload.Type;

export const ServerUpdateInfo = Schema.Struct({
  currentVersion: Schema.String,
  latestVersion: Schema.NullOr(Schema.String),
  updateAvailable: Schema.Boolean,
});
export type ServerUpdateInfo = typeof ServerUpdateInfo.Type;

// ── Token Management ────────────────────────────────────────────────

export const PairingTokenKind = Schema.Literals(["long-lived", "short-lived"]);
export type PairingTokenKind = typeof PairingTokenKind.Type;

export const PairingTokenInfo = Schema.Struct({
  tokenId: TrimmedNonEmptyString,
  kind: PairingTokenKind,
  createdAt: IsoDateTime,
  expiresAt: Schema.NullOr(IsoDateTime),
  revoked: Schema.Boolean,
  label: Schema.optional(TrimmedNonEmptyString),
});
export type PairingTokenInfo = typeof PairingTokenInfo.Type;

export const GeneratePairingLinkInput = Schema.Struct({
  /**
   * Lifetime in seconds for the short-lived pairing token.
   * Defaults to 300 (5 minutes) on the server when omitted.
   */
  ttlSeconds: Schema.optional(Schema.Number),
  label: Schema.optional(TrimmedNonEmptyString),
});
export type GeneratePairingLinkInput = typeof GeneratePairingLinkInput.Type;

export const GeneratePairingLinkResult = Schema.Struct({
  pairingUrl: TrimmedNonEmptyString,
  token: TrimmedNonEmptyString,
  expiresAt: IsoDateTime,
});
export type GeneratePairingLinkResult = typeof GeneratePairingLinkResult.Type;

export const RotateTokenResult = Schema.Struct({
  previousTokenId: Schema.NullOr(TrimmedNonEmptyString),
  newToken: TrimmedNonEmptyString,
  newTokenId: TrimmedNonEmptyString,
  issuedAt: IsoDateTime,
});
export type RotateTokenResult = typeof RotateTokenResult.Type;

export const RevokeTokenInput = Schema.Struct({
  tokenId: TrimmedNonEmptyString,
});
export type RevokeTokenInput = typeof RevokeTokenInput.Type;

export const RevokeTokenResult = Schema.Struct({
  tokenId: TrimmedNonEmptyString,
  revoked: Schema.Boolean,
});
export type RevokeTokenResult = typeof RevokeTokenResult.Type;

export const ListTokensResult = Schema.Struct({
  tokens: Schema.Array(PairingTokenInfo),
});
export type ListTokensResult = typeof ListTokensResult.Type;

// ── Companion Pairing (new model) ──────────────────────────────────
// The companion pairing model replaces the single-token deep-link flow
// with endpoint-aware bundles and device-scoped sessions. The legacy
// `GeneratePairingLinkInput`/`GeneratePairingLinkResult` contracts above
// remain supported during rollout.

export const CompanionEndpointKind = Schema.Literals(["tailscale", "lan", "manual"]);
export type CompanionEndpointKind = typeof CompanionEndpointKind.Type;

export const CompanionEndpoint = Schema.Struct({
  kind: CompanionEndpointKind,
  url: TrimmedNonEmptyString,
  label: Schema.optional(TrimmedNonEmptyString),
  reachable: Schema.Boolean,
});
export type CompanionEndpoint = typeof CompanionEndpoint.Type;

export const CompanionPairingBundle = Schema.Struct({
  pairingId: PairingId,
  expiresAt: IsoDateTime,
  endpoints: Schema.Array(CompanionEndpoint),
  bootstrapToken: TrimmedNonEmptyString,
  passwordRequired: Schema.Boolean,
  passwordHint: Schema.optional(TrimmedNonEmptyString),
});
export type CompanionPairingBundle = typeof CompanionPairingBundle.Type;

export const PairedDeviceSession = Schema.Struct({
  deviceId: DeviceId,
  deviceName: TrimmedNonEmptyString,
  serverUrl: TrimmedNonEmptyString,
  sessionToken: TrimmedNonEmptyString,
  issuedAt: IsoDateTime,
  expiresAt: Schema.NullOr(IsoDateTime),
  lastSeenAt: Schema.NullOr(IsoDateTime),
});
export type PairedDeviceSession = typeof PairedDeviceSession.Type;

// ── Companion RPC Inputs/Outputs ───────────────────────────────────

export const GenerateCompanionPairingBundleInput = Schema.Struct({
  /** Lifetime in seconds for the bootstrap token. Defaults to 300 (5 min). */
  ttlSeconds: Schema.optional(Schema.Number),
  /** Desktop-advertised endpoints to include in the bundle. */
  advertisedEndpoints: Schema.optional(Schema.Array(CompanionEndpoint)),
});
export type GenerateCompanionPairingBundleInput = typeof GenerateCompanionPairingBundleInput.Type;

export const GenerateCompanionPairingBundleResult = CompanionPairingBundle;
export type GenerateCompanionPairingBundleResult = typeof GenerateCompanionPairingBundleResult.Type;

export const ExchangeCompanionBootstrapInput = Schema.Struct({
  bootstrapToken: TrimmedNonEmptyString,
  endpointUrl: TrimmedNonEmptyString,
  password: Schema.optional(Schema.String),
  deviceName: TrimmedNonEmptyString,
});
export type ExchangeCompanionBootstrapInput = typeof ExchangeCompanionBootstrapInput.Type;

export const ExchangeCompanionBootstrapResult = PairedDeviceSession;
export type ExchangeCompanionBootstrapResult = typeof ExchangeCompanionBootstrapResult.Type;

export const ListPairedDevicesResult = Schema.Struct({
  devices: Schema.Array(
    Schema.Struct({
      deviceId: DeviceId,
      deviceName: TrimmedNonEmptyString,
      issuedAt: IsoDateTime,
      lastSeenAt: Schema.NullOr(IsoDateTime),
      endpointKind: Schema.optional(CompanionEndpointKind),
      revoked: Schema.Boolean,
    }),
  ),
});
export type ListPairedDevicesResult = typeof ListPairedDevicesResult.Type;

export const RevokePairedDeviceInput = Schema.Struct({
  deviceId: DeviceId,
});
export type RevokePairedDeviceInput = typeof RevokePairedDeviceInput.Type;

export const RevokePairedDeviceResult = Schema.Struct({
  deviceId: DeviceId,
  revoked: Schema.Boolean,
});
export type RevokePairedDeviceResult = typeof RevokePairedDeviceResult.Type;

// ── OpenClaw Gateway Test ───────────────────────────────────────────

export const TestOpenclawGatewayInput = Schema.Struct({
  gatewayUrl: Schema.String,
  password: Schema.optional(Schema.String),
});
export type TestOpenclawGatewayInput = typeof TestOpenclawGatewayInput.Type;

export const TestOpenclawGatewayStepStatus = Schema.Literals(["pass", "fail", "skip"]);
export type TestOpenclawGatewayStepStatus = typeof TestOpenclawGatewayStepStatus.Type;

/** Individual step result in the gateway connection test. */
export const TestOpenclawGatewayStep = Schema.Struct({
  name: Schema.String,
  status: TestOpenclawGatewayStepStatus,
  durationMs: Schema.Number,
  detail: Schema.optional(Schema.String),
});
export type TestOpenclawGatewayStep = typeof TestOpenclawGatewayStep.Type;

export const TestOpenclawGatewayHostKind = Schema.Literals([
  "loopback",
  "tailscale",
  "private",
  "public",
  "unknown",
]);
export type TestOpenclawGatewayHostKind = typeof TestOpenclawGatewayHostKind.Type;

export const TestOpenclawGatewayDiagnostics = Schema.Struct({
  normalizedUrl: Schema.optional(Schema.String),
  host: Schema.optional(Schema.String),
  pathname: Schema.optional(Schema.String),
  hostKind: Schema.optional(TestOpenclawGatewayHostKind),
  resolvedAddresses: Schema.Array(Schema.String),
  healthUrl: Schema.optional(Schema.String),
  healthStatus: TestOpenclawGatewayStepStatus,
  healthDetail: Schema.optional(Schema.String),
  socketCloseCode: Schema.optional(Schema.Number),
  socketCloseReason: Schema.optional(Schema.String),
  socketError: Schema.optional(Schema.String),
  gatewayErrorCode: Schema.optional(Schema.String),
  gatewayErrorDetailCode: Schema.optional(Schema.String),
  gatewayErrorDetailReason: Schema.optional(Schema.String),
  gatewayRecommendedNextStep: Schema.optional(Schema.String),
  gatewayCanRetryWithDeviceToken: Schema.optional(Schema.Boolean),
  observedNotifications: Schema.Array(Schema.String),
  hints: Schema.Array(Schema.String),
});
export type TestOpenclawGatewayDiagnostics = typeof TestOpenclawGatewayDiagnostics.Type;

export const TestOpenclawGatewayResult = Schema.Struct({
  success: Schema.Boolean,
  steps: Schema.Array(TestOpenclawGatewayStep),
  /** Total wall-clock time for the entire test sequence. */
  totalDurationMs: Schema.Number,
  /** Gateway-reported server info, if available. */
  serverInfo: Schema.optional(
    Schema.Struct({
      version: Schema.optional(Schema.String),
      sessionId: Schema.optional(Schema.String),
    }),
  ),
  diagnostics: Schema.optional(TestOpenclawGatewayDiagnostics),
  error: Schema.optional(Schema.String),
});
export type TestOpenclawGatewayResult = typeof TestOpenclawGatewayResult.Type;
