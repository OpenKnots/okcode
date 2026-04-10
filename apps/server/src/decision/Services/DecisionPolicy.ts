import type { DecisionConflictKind } from "@okcode/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type { DecisionWorkspaceServiceError } from "../Errors.ts";

export interface DecisionPolicyDefinition {
  readonly version: string;
  readonly principles: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly blocking: boolean;
  }>;
  readonly executionThresholds: {
    readonly autoExecuteScore: number;
    readonly minimumContextCompleteness: number;
    readonly minimumPolicyAlignment: number;
  };
  readonly requiredContextByKind: Readonly<Record<DecisionConflictKind, ReadonlyArray<string>>>;
  readonly consultationDefaults: {
    readonly orchestratorMinScore: number;
    readonly operatorMaxScore: number;
  };
}

export interface DecisionPolicyShape {
  readonly getPolicy: (input: {
    readonly cwd: string;
  }) => Effect.Effect<DecisionPolicyDefinition, DecisionWorkspaceServiceError>;
}

export class DecisionPolicy extends ServiceMap.Service<DecisionPolicy, DecisionPolicyShape>()(
  "okcode/decision/Services/DecisionPolicy",
) {}
