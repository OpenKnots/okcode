import { Schema } from "effect";

export class DecisionWorkspaceError extends Schema.TaggedErrorClass<DecisionWorkspaceError>()(
  "DecisionWorkspaceError",
  {
    operation: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {
  override get message(): string {
    return `Decision workspace failed in ${this.operation}: ${this.detail}`;
  }
}

export type DecisionWorkspaceServiceError = DecisionWorkspaceError;
