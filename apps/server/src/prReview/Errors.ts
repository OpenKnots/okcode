import { Schema } from "effect";
import { GitCommandError, GitHubCliError } from "../git/Errors.ts";

export class PrReviewConfigError extends Schema.TaggedErrorClass<PrReviewConfigError>()(
  "PrReviewConfigError",
  {
    operation: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {
  override get message(): string {
    return `PR review config failed in ${this.operation}: ${this.detail}`;
  }
}

export class PrReviewError extends Schema.TaggedErrorClass<PrReviewError>()("PrReviewError", {
  operation: Schema.String,
  detail: Schema.String,
  cause: Schema.optional(Schema.Defect),
}) {
  override get message(): string {
    return `PR review failed in ${this.operation}: ${this.detail}`;
  }
}

export type PrReviewServiceError =
  | PrReviewError
  | PrReviewConfigError
  | GitHubCliError
  | GitCommandError;
