import { Schema } from "effect";
import { GitHubCliError } from "../git/Errors.ts";

/**
 * GitHubServiceError - GitHub issue/notification service error.
 */
export class GitHubServiceError extends Schema.TaggedErrorClass<GitHubServiceError>()(
  "GitHubServiceError",
  {
    operation: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {
  override get message(): string {
    return `GitHub service failed in ${this.operation}: ${this.detail}`;
  }
}

export type GitHubIssueServiceError = GitHubServiceError | GitHubCliError;
