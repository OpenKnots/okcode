import { Schema } from "effect";
import { IsoDateTime, TrimmedNonEmptyString } from "./baseSchemas";

export const BuildSurface = Schema.Literals(["web", "desktop", "mobile", "server", "cli"]);
export type BuildSurface = typeof BuildSurface.Type;

export const BuildChannel = Schema.Literals(["stable", "prerelease", "development"]);
export type BuildChannel = typeof BuildChannel.Type;

export const BuildMetadata = Schema.Struct({
  version: TrimmedNonEmptyString,
  commitHash: Schema.NullOr(TrimmedNonEmptyString),
  platform: TrimmedNonEmptyString,
  arch: TrimmedNonEmptyString,
  channel: BuildChannel,
  buildTimestamp: IsoDateTime,
  surface: BuildSurface,
});
export type BuildMetadata = typeof BuildMetadata.Type;
