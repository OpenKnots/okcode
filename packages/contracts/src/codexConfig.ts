import { Schema } from "effect";

import { TrimmedNonEmptyString } from "./baseSchemas";

export const ServerCodexModelProviderEntry = Schema.Struct({
  id: TrimmedNonEmptyString,
  selected: Schema.Boolean,
  definedInConfig: Schema.Boolean,
  isBuiltIn: Schema.Boolean,
  isKnownPreset: Schema.Boolean,
  requiresOpenAiLogin: Schema.Boolean,
});
export type ServerCodexModelProviderEntry = typeof ServerCodexModelProviderEntry.Type;

export const ServerCodexConfigSummary = Schema.Struct({
  selectedModelProviderId: Schema.NullOr(TrimmedNonEmptyString),
  entries: Schema.Array(ServerCodexModelProviderEntry),
  parseError: Schema.NullOr(Schema.String),
});
export type ServerCodexConfigSummary = typeof ServerCodexConfigSummary.Type;
