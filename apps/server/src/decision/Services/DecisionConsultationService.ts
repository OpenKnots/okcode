import type {
  DecisionCase,
  DecisionConsultation,
  DecisionConsultationQuestion,
  DecisionContextPack,
} from "@okcode/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type { DecisionPolicyDefinition } from "./DecisionPolicy.ts";
import type { DecisionWorkspaceServiceError } from "../Errors.ts";

export interface DecisionConsultationServiceShape {
  readonly request: (input: {
    readonly decisionCase: DecisionCase;
    readonly target: "operator" | "orchestrator";
    readonly reason: string;
    readonly questions: ReadonlyArray<DecisionConsultationQuestion>;
    readonly contextPack: DecisionContextPack;
    readonly policy: DecisionPolicyDefinition;
  }) => Effect.Effect<DecisionConsultation, DecisionWorkspaceServiceError>;
  readonly respond: (input: {
    readonly consultationId: string;
    readonly resolution: string;
  }) => Effect.Effect<DecisionConsultation, DecisionWorkspaceServiceError>;
}

export class DecisionConsultationService extends ServiceMap.Service<
  DecisionConsultationService,
  DecisionConsultationServiceShape
>()("okcode/decision/Services/DecisionConsultationService") {}
