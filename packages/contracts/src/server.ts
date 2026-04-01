import { Schema } from "effect";
import { IsoDateTime, TrimmedNonEmptyString } from "./baseSchemas";
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
