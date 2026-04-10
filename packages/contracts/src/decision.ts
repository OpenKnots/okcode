import { Schema } from "effect";
import {
  IsoDateTime,
  NonNegativeInt,
  ProjectId,
  ThreadId,
  TrimmedNonEmptyString,
} from "./baseSchemas";
import { OrchestrationThread, ProviderUserInputAnswers } from "./orchestration";
import {
  PrConflictAnalysis,
  PrConflictApplyResult,
  PrReviewConfig,
  PrReviewDashboardResult,
  PrReviewPatchResult,
  PrReviewSummary,
  PrWorkflowStepResolution,
} from "./prReview";

export const DECISION_WS_METHODS = {
  listCases: "decision.listCases",
  getWorkspace: "decision.getWorkspace",
  reanalyze: "decision.reanalyze",
  requestConsultation: "decision.requestConsultation",
  respondConsultation: "decision.respondConsultation",
  executeRecommendation: "decision.executeRecommendation",
} as const;

export const DECISION_WS_CHANNELS = {
  updated: "decision.updated",
} as const;

export const DecisionCaseId = TrimmedNonEmptyString;
export type DecisionCaseId = typeof DecisionCaseId.Type;

export const DecisionConsultationId = TrimmedNonEmptyString;
export type DecisionConsultationId = typeof DecisionConsultationId.Type;

export const DecisionRecommendationId = TrimmedNonEmptyString;
export type DecisionRecommendationId = typeof DecisionRecommendationId.Type;

export const DecisionSource = Schema.Literals(["pr", "thread", "manual_brief"]);
export type DecisionSource = typeof DecisionSource.Type;

export const DecisionConflictKind = Schema.Literals([
  "merge_conflict",
  "workflow_blocker",
  "review_conflict",
  "intent_ambiguity",
  "policy_conflict",
]);
export type DecisionConflictKind = typeof DecisionConflictKind.Type;

export const DecisionConsultationTarget = Schema.Literals(["operator", "orchestrator"]);
export type DecisionConsultationTarget = typeof DecisionConsultationTarget.Type;

export const DecisionConsultationStatus = Schema.Literals([
  "not_requested",
  "awaiting_operator",
  "awaiting_orchestrator",
  "resolved",
  "superseded",
]);
export type DecisionConsultationStatus = typeof DecisionConsultationStatus.Type;

export const DecisionRiskTier = Schema.Literals(["low", "medium", "high"]);
export type DecisionRiskTier = typeof DecisionRiskTier.Type;

export const DecisionFactorId = Schema.Literals([
  "contextCompleteness",
  "evidenceQuality",
  "sourceAgreement",
  "policyAlignment",
  "safetyAndReversibility",
  "executionReadiness",
]);
export type DecisionFactorId = typeof DecisionFactorId.Type;

export const DecisionEvidenceSource = Schema.Struct({
  id: TrimmedNonEmptyString,
  label: TrimmedNonEmptyString,
  source: DecisionSource,
  kind: TrimmedNonEmptyString,
  capturedAt: IsoDateTime,
  freshness: Schema.Literals(["fresh", "stale", "derived"]),
  usedInDecision: Schema.Boolean,
});
export type DecisionEvidenceSource = typeof DecisionEvidenceSource.Type;

export const DecisionContextRequirement = Schema.Struct({
  id: TrimmedNonEmptyString,
  label: TrimmedNonEmptyString,
  satisfied: Schema.Boolean,
  whyItMatters: TrimmedNonEmptyString,
  howToProvideIt: TrimmedNonEmptyString,
  evidenceIds: Schema.Array(TrimmedNonEmptyString),
});
export type DecisionContextRequirement = typeof DecisionContextRequirement.Type;

export const DecisionPrincipleResult = Schema.Struct({
  id: TrimmedNonEmptyString,
  label: TrimmedNonEmptyString,
  passed: Schema.Boolean,
  blocking: Schema.Boolean,
  rationale: TrimmedNonEmptyString,
  evidenceIds: Schema.Array(TrimmedNonEmptyString),
});
export type DecisionPrincipleResult = typeof DecisionPrincipleResult.Type;

export const DecisionConfidenceFactor = Schema.Struct({
  id: DecisionFactorId,
  label: TrimmedNonEmptyString,
  score: NonNegativeInt.pipe(Schema.clamp(0, 100)),
  weight: Schema.Number,
  weightedPoints: Schema.Number,
  why: TrimmedNonEmptyString,
  missingInputs: Schema.Array(TrimmedNonEmptyString),
  evidenceIds: Schema.Array(TrimmedNonEmptyString),
});
export type DecisionConfidenceFactor = typeof DecisionConfidenceFactor.Type;

export const DecisionNextContextHint = Schema.Struct({
  label: TrimmedNonEmptyString,
  whyItMatters: TrimmedNonEmptyString,
  howToProvideIt: TrimmedNonEmptyString,
  estimatedScoreGain: NonNegativeInt,
  appliesTo: Schema.Array(DecisionFactorId),
});
export type DecisionNextContextHint = typeof DecisionNextContextHint.Type;

export const DecisionConfidenceAnalysis = Schema.Struct({
  score: NonNegativeInt.pipe(Schema.clamp(0, 100)),
  riskTier: DecisionRiskTier,
  autoExecuteEligible: Schema.Boolean,
  scoreDelta: Schema.Int,
  contextCoverageNumerator: NonNegativeInt,
  contextCoverageDenominator: NonNegativeInt,
  sourceAgreementNumerator: NonNegativeInt,
  sourceAgreementDenominator: NonNegativeInt,
  policyPassNumerator: NonNegativeInt,
  policyPassDenominator: NonNegativeInt,
  factors: Schema.Array(DecisionConfidenceFactor),
  nextContextHints: Schema.Array(DecisionNextContextHint),
});
export type DecisionConfidenceAnalysis = typeof DecisionConfidenceAnalysis.Type;

export const DecisionRecommendation = Schema.Struct({
  id: DecisionRecommendationId,
  label: TrimmedNonEmptyString,
  rationale: TrimmedNonEmptyString,
  executable: Schema.Boolean,
  blockedReason: Schema.NullOr(TrimmedNonEmptyString),
  preview: Schema.String,
  source: DecisionSource,
});
export type DecisionRecommendation = typeof DecisionRecommendation.Type;

export const DecisionConsultationQuestionOption = Schema.Struct({
  label: TrimmedNonEmptyString,
  description: TrimmedNonEmptyString,
});
export type DecisionConsultationQuestionOption = typeof DecisionConsultationQuestionOption.Type;

export const DecisionConsultationQuestion = Schema.Struct({
  id: TrimmedNonEmptyString,
  header: TrimmedNonEmptyString,
  question: TrimmedNonEmptyString,
  options: Schema.Array(DecisionConsultationQuestionOption),
});
export type DecisionConsultationQuestion = typeof DecisionConsultationQuestion.Type;

export const DecisionConsultation = Schema.Struct({
  id: DecisionConsultationId,
  caseId: DecisionCaseId,
  target: DecisionConsultationTarget,
  status: DecisionConsultationStatus,
  reason: TrimmedNonEmptyString,
  questions: Schema.Array(DecisionConsultationQuestion),
  responseSummary: Schema.NullOr(Schema.String),
  linkedThreadId: Schema.NullOr(ThreadId),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  resolvedAt: Schema.NullOr(IsoDateTime),
});
export type DecisionConsultation = typeof DecisionConsultation.Type;

export const DecisionCaseSummary = Schema.Struct({
  id: DecisionCaseId,
  projectId: ProjectId,
  cwd: TrimmedNonEmptyString,
  sourceKind: DecisionSource,
  sourceId: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  subtitle: Schema.String,
  conflictKind: DecisionConflictKind,
  score: NonNegativeInt.pipe(Schema.clamp(0, 100)),
  riskTier: DecisionRiskTier,
  consultationStatus: DecisionConsultationStatus,
  updatedAt: IsoDateTime,
});
export type DecisionCaseSummary = typeof DecisionCaseSummary.Type;

export const DecisionContextPack = Schema.Struct({
  sourceKind: DecisionSource,
  sourceId: TrimmedNonEmptyString,
  prSummary: Schema.optional(PrReviewSummary),
  prDashboard: Schema.optional(PrReviewDashboardResult),
  prPatch: Schema.optional(PrReviewPatchResult),
  prConfig: Schema.optional(PrReviewConfig),
  prConflicts: Schema.optional(PrConflictAnalysis),
  workflowSteps: Schema.optional(Schema.Array(PrWorkflowStepResolution)),
  thread: Schema.optional(OrchestrationThread),
  manualBrief: Schema.optional(Schema.String),
  evidence: Schema.Array(DecisionEvidenceSource),
  contextRequirements: Schema.Array(DecisionContextRequirement),
  linkedThreadId: Schema.NullOr(ThreadId),
});
export type DecisionContextPack = typeof DecisionContextPack.Type;

export const DecisionCase = Schema.Struct({
  id: DecisionCaseId,
  projectId: ProjectId,
  cwd: TrimmedNonEmptyString,
  sourceKind: DecisionSource,
  sourceId: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  conflictKind: DecisionConflictKind,
  linkedThreadId: Schema.NullOr(ThreadId),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type DecisionCase = typeof DecisionCase.Type;

export const DecisionWorkspace = Schema.Struct({
  case: DecisionCase,
  summary: DecisionCaseSummary,
  contextPack: DecisionContextPack,
  principles: Schema.Array(DecisionPrincipleResult),
  confidence: DecisionConfidenceAnalysis,
  recommendations: Schema.Array(DecisionRecommendation),
  consultations: Schema.Array(DecisionConsultation),
});
export type DecisionWorkspace = typeof DecisionWorkspace.Type;

export const DecisionExecutionResult = Schema.Struct({
  caseId: DecisionCaseId,
  recommendationId: DecisionRecommendationId,
  executed: Schema.Boolean,
  summary: TrimmedNonEmptyString,
  appliedConflictResult: Schema.optional(PrConflictApplyResult),
  updatedAt: IsoDateTime,
});
export type DecisionExecutionResult = typeof DecisionExecutionResult.Type;

export const DecisionListCasesInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  sourceKind: Schema.optional(DecisionSource),
  sourceId: Schema.optional(TrimmedNonEmptyString),
});
export type DecisionListCasesInput = typeof DecisionListCasesInput.Type;

export const DecisionGetWorkspaceInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  caseId: DecisionCaseId,
});
export type DecisionGetWorkspaceInput = typeof DecisionGetWorkspaceInput.Type;

export const DecisionReanalyzeInput = DecisionGetWorkspaceInput;
export type DecisionReanalyzeInput = typeof DecisionReanalyzeInput.Type;

export const DecisionRequestConsultationInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  caseId: DecisionCaseId,
  target: DecisionConsultationTarget,
  reason: TrimmedNonEmptyString,
  questions: Schema.optional(Schema.Array(DecisionConsultationQuestion)),
});
export type DecisionRequestConsultationInput = typeof DecisionRequestConsultationInput.Type;

export const DecisionRespondConsultationInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  consultationId: DecisionConsultationId,
  answers: ProviderUserInputAnswers,
  resolution: TrimmedNonEmptyString,
});
export type DecisionRespondConsultationInput = typeof DecisionRespondConsultationInput.Type;

export const DecisionExecuteRecommendationInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  caseId: DecisionCaseId,
  recommendationId: DecisionRecommendationId,
});
export type DecisionExecuteRecommendationInput = typeof DecisionExecuteRecommendationInput.Type;

export const DecisionUpdatedPayload = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  caseId: DecisionCaseId,
  updatedAt: IsoDateTime,
});
export type DecisionUpdatedPayload = typeof DecisionUpdatedPayload.Type;
