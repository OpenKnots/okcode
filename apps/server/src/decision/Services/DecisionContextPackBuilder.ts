import type {
  DecisionCase,
  DecisionContextPack,
  DecisionPrincipleResult,
  DecisionRecommendation,
} from "@okcode/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type { DecisionPolicyDefinition } from "./DecisionPolicy.ts";
import type { DecisionWorkspaceServiceError } from "../Errors.ts";

export interface DecisionContextPackBuilderShape {
  readonly listAutoCases: (input: {
    readonly cwd: string;
  }) => Effect.Effect<ReadonlyArray<DecisionCase>, DecisionWorkspaceServiceError>;
  readonly buildCaseArtifacts: (input: {
    readonly decisionCase: DecisionCase;
    readonly policy: DecisionPolicyDefinition;
  }) => Effect.Effect<
    {
      readonly contextPack: DecisionContextPack;
      readonly principles: ReadonlyArray<DecisionPrincipleResult>;
      readonly recommendations: ReadonlyArray<DecisionRecommendation>;
    },
    DecisionWorkspaceServiceError
  >;
}

export class DecisionContextPackBuilder extends ServiceMap.Service<
  DecisionContextPackBuilder,
  DecisionContextPackBuilderShape
>()("okcode/decision/Services/DecisionContextPackBuilder") {}
