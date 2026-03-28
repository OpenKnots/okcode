import { describe, expect, it } from "vitest";

import {
  buildConflictFeedbackPreview,
  buildConflictRecommendation,
  groupConflictCandidatesByFile,
  pickRecommendedConflictCandidate,
} from "./MergeConflictShell.logic";

describe("pickRecommendedConflictCandidate", () => {
  it("prefers deterministic candidates", () => {
    expect(
      pickRecommendedConflictCandidate({
        candidates: [
          {
            id: "src/demo.ts:review",
            path: "src/demo.ts",
            title: "Prefer current side",
            description: "Review candidate",
            confidence: "review",
            previewPatch: "const review = true;\n",
          },
          {
            id: "src/demo.ts:safe",
            path: "src/demo.ts",
            title: "Take theirs",
            description: "Safe candidate",
            confidence: "safe",
            previewPatch: "const safe = true;\n",
          },
        ],
      })?.id,
    ).toBe("src/demo.ts:safe");
  });
});

describe("groupConflictCandidatesByFile", () => {
  it("keeps deterministic candidates first within a file group", () => {
    const groups = groupConflictCandidatesByFile([
      {
        id: "src/b.ts:review",
        path: "src/b.ts",
        title: "Prefer incoming side",
        description: "Review candidate",
        confidence: "review",
        previewPatch: "incoming\n",
      },
      {
        id: "src/b.ts:safe",
        path: "src/b.ts",
        title: "Take ours",
        description: "Safe candidate",
        confidence: "safe",
        previewPatch: "ours\n",
      },
      {
        id: "src/a.ts:review",
        path: "src/a.ts",
        title: "Prefer current side",
        description: "Review candidate",
        confidence: "review",
        previewPatch: "current\n",
      },
    ]);

    expect(groups.map((group) => group.path)).toEqual(["src/a.ts", "src/b.ts"]);
    expect(groups[1]?.candidates.map((candidate) => candidate.id)).toEqual([
      "src/b.ts:safe",
      "src/b.ts:review",
    ]);
  });
});

describe("buildConflictRecommendation", () => {
  it("guides the user to prepare a local workspace when GitHub is conflicting but no candidates exist", () => {
    expect(
      buildConflictRecommendation({
        analysis: {
          status: "conflicted",
          mergeableState: "CONFLICTING",
          summary: "GitHub reports merge conflicts.",
          candidates: [],
        },
        hasPreparedWorkspace: false,
      }),
    ).toMatchObject({
      tone: "warning",
      title: "Prepare a local workspace to continue.",
    });
  });
});

describe("buildConflictFeedbackPreview", () => {
  it("builds a human-readable brief", () => {
    expect(
      buildConflictFeedbackPreview({
        disposition: "review",
        note: "Keep the API signature from the incoming branch.",
        pullRequest: {
          number: 42,
          title: "Unify auth boundary",
          url: "https://github.com/acme/app/pull/42",
          baseBranch: "main",
          headBranch: "feature/auth",
          state: "open",
        },
        selectedCandidate: {
          id: "src/auth.ts:theirs",
          path: "src/auth.ts",
          title: "Prefer incoming side",
          description: "Review-required candidate using the incoming side.",
          confidence: "review",
          previewPatch: "export const auth = true;\n",
        },
        workspaceLabel: "Dedicated worktree",
      }),
    ).toContain("Operator note: Keep the API signature from the incoming branch.");
  });
});
