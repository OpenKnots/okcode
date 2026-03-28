import type {
  GitResolvedPullRequest,
  PrConflictAnalysis,
  PrConflictCandidateResolution,
} from "@okcode/contracts";

export type MergeConflictFeedbackDisposition = "accept" | "review" | "escalate" | "blocked";

export interface MergeConflictCandidateGroup {
  path: string;
  candidates: PrConflictCandidateResolution[];
  recommendedCandidate: PrConflictCandidateResolution | null;
}

export type MergeConflictRecommendedAction =
  | "prepare-local"
  | "prepare-worktree"
  | "review-candidate"
  | "capture-note"
  | null;

export interface MergeConflictRecommendation {
  candidateId: string | null;
  recommendedAction: MergeConflictRecommendedAction;
  tone: "neutral" | "success" | "warning";
  title: string;
  detail: string;
}

function candidatePriority(candidate: PrConflictCandidateResolution): number {
  return candidate.confidence === "safe" ? 0 : 1;
}

export function sortConflictCandidates(
  candidates: readonly PrConflictCandidateResolution[],
): PrConflictCandidateResolution[] {
  return [...candidates].toSorted((left, right) => {
    const priorityDiff = candidatePriority(left) - candidatePriority(right);
    if (priorityDiff !== 0) return priorityDiff;
    return left.title.localeCompare(right.title);
  });
}

export function pickRecommendedConflictCandidate(
  analysis: Pick<PrConflictAnalysis, "candidates"> | null | undefined,
): PrConflictCandidateResolution | null {
  const sorted = sortConflictCandidates(analysis?.candidates ?? []);
  return sorted[0] ?? null;
}

export function groupConflictCandidatesByFile(
  candidates: readonly PrConflictCandidateResolution[],
): MergeConflictCandidateGroup[] {
  const groups = new Map<string, PrConflictCandidateResolution[]>();
  for (const candidate of sortConflictCandidates(candidates)) {
    const nextGroup = groups.get(candidate.path) ?? [];
    nextGroup.push(candidate);
    groups.set(candidate.path, nextGroup);
  }

  return [...groups.entries()]
    .toSorted(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
    .map(([path, groupedCandidates]) => ({
      path,
      candidates: groupedCandidates,
      recommendedCandidate: groupedCandidates[0] ?? null,
    }));
}

export function buildConflictRecommendation(input: {
  analysis: PrConflictAnalysis | undefined;
  hasPreparedWorkspace: boolean;
}): MergeConflictRecommendation {
  if (!input.analysis || input.analysis.status === "unavailable") {
    return {
      candidateId: null,
      recommendedAction: null,
      tone: "neutral",
      title: "Resolve a pull request link to start.",
      detail:
        "Paste a GitHub pull request URL to inspect mergeability, pull candidate resolutions, and stage a human-readable handoff note.",
    };
  }

  if (input.analysis.status === "clean") {
    return {
      candidateId: null,
      recommendedAction: null,
      tone: "success",
      title: "No merge conflicts are active.",
      detail: input.analysis.summary,
    };
  }

  const recommendedCandidate = pickRecommendedConflictCandidate(input.analysis);
  if (recommendedCandidate?.confidence === "safe") {
    return {
      candidateId: recommendedCandidate.id,
      recommendedAction: "review-candidate",
      tone: "success",
      title: "Recommended resolution is ready.",
      detail:
        "OK Code found a deterministic candidate. Review the patch, capture the operator note, and then apply the recommendation.",
    };
  }

  if (recommendedCandidate) {
    return {
      candidateId: recommendedCandidate.id,
      recommendedAction: "review-candidate",
      tone: "warning",
      title: "Review-required options are available.",
      detail:
        "OK Code found possible resolutions, but none are deterministic. Compare both sides, leave a readable decision note, and only then apply one.",
    };
  }

  if (input.hasPreparedWorkspace) {
    return {
      candidateId: null,
      recommendedAction: "capture-note",
      tone: "warning",
      title: "Manual merge work is still required.",
      detail:
        "The workspace is prepared, but no candidate patch was safe to generate. Resolve the markers manually and keep the handoff note explicit.",
    };
  }

  return {
    candidateId: null,
    recommendedAction: "prepare-worktree",
    tone: "warning",
    title: "Prepare a local workspace to continue.",
    detail:
      "GitHub reports merge conflicts, but file-level candidates need a checked-out pull request branch or worktree before OK Code can inspect markers locally.",
  };
}

function feedbackDispositionSentence(disposition: MergeConflictFeedbackDisposition): string {
  switch (disposition) {
    case "accept":
      return "Accept the proposed resolution after reviewing the resulting diff.";
    case "review":
      return "Keep this in review until a human confirms the chosen side.";
    case "escalate":
      return "Escalate this conflict to the PR author or code owner for direction.";
    case "blocked":
      return "Treat this conflict as blocked until the workspace or intent is clarified.";
  }
}

export function buildConflictFeedbackPreview(input: {
  disposition: MergeConflictFeedbackDisposition;
  note: string;
  pullRequest: GitResolvedPullRequest | null;
  selectedCandidate: PrConflictCandidateResolution | null;
  workspaceLabel: string;
}): string {
  const lines = [
    input.pullRequest
      ? `Merge conflict brief for PR #${input.pullRequest.number}: ${input.pullRequest.title}`
      : "Merge conflict brief",
    `Workspace: ${input.workspaceLabel}`,
    input.selectedCandidate
      ? `Candidate: ${input.selectedCandidate.title} on ${input.selectedCandidate.path} (${input.selectedCandidate.confidence} confidence).`
      : "Candidate: No deterministic candidate is selected yet.",
    input.selectedCandidate
      ? `Rationale: ${input.selectedCandidate.description}`
      : "Rationale: Keep the branch prepared and inspect the conflict manually.",
    `Disposition: ${feedbackDispositionSentence(input.disposition)}`,
  ];

  const trimmedNote = input.note.trim();
  if (trimmedNote.length > 0) {
    lines.push(`Operator note: ${trimmedNote}`);
  }

  return lines.join("\n");
}

const KNOWN_ERROR_PATTERNS: ReadonlyArray<{
  pattern: string;
  summary: string;
  detail: string;
}> = [
  {
    pattern: "already checked out",
    summary: "Branch already checked out",
    detail:
      "The PR branch is already active in another worktree or the main repo. Close the other checkout or use \u201cPrepare worktree\u201d to create an isolated copy.",
  },
  {
    pattern: "not a git repository",
    summary: "Not a git repository",
    detail:
      "The selected project directory is not a valid git repository. Check the project path in the intake panel.",
  },
];

const ERROR_PREFIX_RE = /^[A-Za-z ]+(?:failed|error) in [A-Za-z]+:\s*/i;

export function humanizeConflictError(rawMessage: string): {
  summary: string;
  detail: string;
} {
  const lower = rawMessage.toLowerCase();
  for (const known of KNOWN_ERROR_PATTERNS) {
    if (lower.includes(known.pattern)) {
      return { summary: known.summary, detail: known.detail };
    }
  }

  const stripped = rawMessage.replace(ERROR_PREFIX_RE, "");
  const firstSentenceEnd = stripped.search(/[.!]\s|[.!]$/);
  const summary =
    firstSentenceEnd > 0 ? stripped.slice(0, firstSentenceEnd + 1) : stripped.slice(0, 80);

  return { summary, detail: rawMessage };
}

export function computeActiveStepIndex(
  steps: ReadonlyArray<{ status: "done" | "active" | "todo" | "blocked" }>,
): number {
  const index = steps.findIndex((step) => step.status !== "done");
  return index === -1 ? steps.length : index;
}
