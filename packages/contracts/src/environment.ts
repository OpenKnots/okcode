import { Schema } from "effect";

import { ProjectId } from "./baseSchemas";

export const ENVIRONMENT_VARIABLE_KEY_MAX_LENGTH = 128;
export const ENVIRONMENT_VARIABLE_VALUE_MAX_LENGTH = 65_536;
export const ENVIRONMENT_VARIABLE_MAX_COUNT = 128;
export const RUNTIME_ENV_MAX_PROPERTIES = 256;

export const EnvironmentVariableKey = Schema.String.check(
  Schema.isPattern(/^[A-Za-z_][A-Za-z0-9_]*$/),
).check(Schema.isMaxLength(ENVIRONMENT_VARIABLE_KEY_MAX_LENGTH));
export type EnvironmentVariableKey = typeof EnvironmentVariableKey.Type;

export const EnvironmentVariableValue = Schema.String.check(
  Schema.isMaxLength(ENVIRONMENT_VARIABLE_VALUE_MAX_LENGTH),
);
export type EnvironmentVariableValue = typeof EnvironmentVariableValue.Type;

export const EnvironmentVariableEntry = Schema.Struct({
  key: EnvironmentVariableKey,
  value: EnvironmentVariableValue,
});
export type EnvironmentVariableEntry = typeof EnvironmentVariableEntry.Type;

export const EnvironmentVariableEntries = Schema.Array(EnvironmentVariableEntry).check(
  Schema.isMaxLength(ENVIRONMENT_VARIABLE_MAX_COUNT),
);
export type EnvironmentVariableEntries = typeof EnvironmentVariableEntries.Type;

export const RuntimeEnvironmentVariables = Schema.Record(
  EnvironmentVariableKey,
  EnvironmentVariableValue,
).check(Schema.isMaxProperties(RUNTIME_ENV_MAX_PROPERTIES));
export type RuntimeEnvironmentVariables = typeof RuntimeEnvironmentVariables.Type;

export const GlobalEnvironmentVariablesResult = Schema.Struct({
  entries: EnvironmentVariableEntries,
});
export type GlobalEnvironmentVariablesResult = typeof GlobalEnvironmentVariablesResult.Type;

export const ProjectEnvironmentVariablesInput = Schema.Struct({
  projectId: ProjectId,
});
export type ProjectEnvironmentVariablesInput = typeof ProjectEnvironmentVariablesInput.Type;

export const ProjectEnvironmentVariablesResult = Schema.Struct({
  projectId: ProjectId,
  entries: EnvironmentVariableEntries,
});
export type ProjectEnvironmentVariablesResult = typeof ProjectEnvironmentVariablesResult.Type;

export const SaveGlobalEnvironmentVariablesInput = Schema.Struct({
  entries: EnvironmentVariableEntries,
});
export type SaveGlobalEnvironmentVariablesInput = typeof SaveGlobalEnvironmentVariablesInput.Type;

export const SaveProjectEnvironmentVariablesInput = Schema.Struct({
  projectId: ProjectId,
  entries: EnvironmentVariableEntries,
});
export type SaveProjectEnvironmentVariablesInput = typeof SaveProjectEnvironmentVariablesInput.Type;
