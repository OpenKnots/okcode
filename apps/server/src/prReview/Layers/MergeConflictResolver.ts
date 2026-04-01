import path from "node:path";
import { promises as fsPromises } from "node:fs";

import { Effect, Layer } from "effect";
import type { PrConflictCandidateResolution, PrReviewSummary } from "@okcode/contracts";
import { GitCore, type GitCoreShape } from "../../git/Services/GitCore.ts";
import {
  MergeConflictResolver,
  type MergeConflictResolverShape,
} from "../Services/MergeConflictResolver.ts";
import { PrReviewError } from "../Errors.ts";

interface ParsedConflictBlock {
  before: string;
  ours: string;
  theirs: string;
  after: string;
}

function parseFirstConflictBlock(contents: string): ParsedConflictBlock | null {
  const start = contents.indexOf("<<<<<<< ");
  if (start === -1) return null;
  const middle = contents.indexOf("\n=======\n", start);
  if (middle === -1) return null;
  const end = contents.indexOf("\n>>>>>>> ", middle);
  if (end === -1) return null;

  const before = contents.slice(0, start);
  const ours = contents.slice(start, middle).split("\n").slice(1).join("\n") + "\n";
  const theirs = contents.slice(middle + "\n=======\n".length, end) + "\n";
  const afterStart = contents.indexOf("\n", end + 1);
  const after = afterStart === -1 ? "" : contents.slice(afterStart + 1);
  return { before, ours, theirs, after };
}

function buildCandidate(input: {
  id: string;
  path: string;
  title: string;
  description: string;
  confidence: "safe" | "review";
  replacement: string;
}): PrConflictCandidateResolution {
  return {
    id: input.id,
    path: input.path,
    title: input.title,
    description: input.description,
    confidence: input.confidence,
    previewPatch: input.replacement,
  };
}

function buildCandidatesForFile(input: {
  relativePath: string;
  contents: string;
}): PrConflictCandidateResolution[] {
  const parsed = parseFirstConflictBlock(input.contents);
  if (!parsed) return [];

  const normalizedOurs = parsed.ours.trim();
  const normalizedTheirs = parsed.theirs.trim();
  if (normalizedOurs.length === 0 && normalizedTheirs.length === 0) {
    return [];
  }

  const safeChoice =
    normalizedOurs.length === 0
      ? "theirs"
      : normalizedTheirs.length === 0
        ? "ours"
        : normalizedOurs === normalizedTheirs
          ? "ours"
          : null;

  const candidates: PrConflictCandidateResolution[] = [];
  if (safeChoice) {
    const replacement = safeChoice === "ours" ? parsed.ours : parsed.theirs;
    candidates.push(
      buildCandidate({
        id: `${input.relativePath}:${safeChoice}`,
        path: input.relativePath,
        title: `Take ${safeChoice}`,
        description:
          safeChoice === "ours"
            ? "Safe resolution derived from the current local side."
            : "Safe resolution derived from the incoming side.",
        confidence: "safe",
        replacement,
      }),
    );
    return candidates;
  }

  candidates.push(
    buildCandidate({
      id: `${input.relativePath}:ours`,
      path: input.relativePath,
      title: "Prefer current side",
      description: "Review-required candidate using the current local side.",
      confidence: "review",
      replacement: parsed.ours,
    }),
    buildCandidate({
      id: `${input.relativePath}:theirs`,
      path: input.relativePath,
      title: "Prefer incoming side",
      description: "Review-required candidate using the incoming side.",
      confidence: "review",
      replacement: parsed.theirs,
    }),
  );

  return candidates;
}

/**
 * Read the "ours" (stage 2) and "theirs" (stage 3) versions of a conflicted
 * file directly from the git index.  This works even when the working-tree
 * copy has no parseable conflict markers (e.g. binary files, diff3 style,
 * already-partially-resolved markers, or multiple conflict blocks).
 */
async function buildFallbackCandidatesFromIndex(
  gitCore: GitCoreShape,
  cwd: string,
  relativePath: string,
): Promise<PrConflictCandidateResolution[]> {
  const candidates: PrConflictCandidateResolution[] = [];
  const tryStage = async (
    stage: "2" | "3",
    label: "ours" | "theirs",
    title: string,
    description: string,
  ) => {
    try {
      const result = await Effect.runPromise(
        gitCore.execute({
          operation: "showConflictStage",
          cwd,
          args: ["show", `:${stage}:${relativePath}`],
          allowNonZeroExit: true,
        }),
      );
      if (result.code === 0) {
        candidates.push(
          buildCandidate({
            id: `${relativePath}:${label}`,
            path: relativePath,
            title,
            description,
            confidence: "review",
            replacement: result.stdout,
          }),
        );
      }
    } catch {
      // Stage does not exist in the index; skip this side.
    }
  };

  await tryStage(
    "2",
    "ours",
    "Prefer current side (full file)",
    "Review-required candidate using the full current-branch version from the git index.",
  );
  await tryStage(
    "3",
    "theirs",
    "Prefer incoming side (full file)",
    "Review-required candidate using the full incoming-branch version from the git index.",
  );

  return candidates;
}

async function readCandidatesForConflicts(
  cwd: string,
  conflictedFiles: readonly string[],
  gitCore: GitCoreShape,
) {
  const candidates: PrConflictCandidateResolution[] = [];
  for (const relativePath of conflictedFiles) {
    try {
      const absolutePath = path.join(cwd, relativePath);
      const contents = await fsPromises.readFile(absolutePath, "utf8");
      const fileCandidates = buildCandidatesForFile({ relativePath, contents });
      if (fileCandidates.length > 0) {
        candidates.push(...fileCandidates);
      } else {
        // Marker parsing failed (diff3 style, multiple blocks, etc.) – fall
        // back to full-file ours/theirs from the git index.
        candidates.push(
          ...(await buildFallbackCandidatesFromIndex(gitCore, cwd, relativePath)),
        );
      }
    } catch {
      // File unreadable from disk – still try index-based fallback.
      candidates.push(
        ...(await buildFallbackCandidatesFromIndex(gitCore, cwd, relativePath)),
      );
    }
  }
  return candidates;
}

const makeMergeConflictResolver = Effect.gen(function* () {
  const gitCore = yield* GitCore;

  const resolveAnalysis = (cwd: string, pullRequest: PrReviewSummary) =>
    Effect.tryPromise({
      try: async () => {
        const status = await Effect.runPromise(gitCore.statusDetails(cwd));
        if (status.hasConflicts) {
          const candidates = await readCandidatesForConflicts(cwd, status.conflictedFiles, gitCore);
          return {
            status: "conflicted" as const,
            mergeableState: pullRequest.mergeable,
            summary:
              candidates.length > 0
                ? `${status.conflictedFiles.length} conflicted file(s) detected locally. Review candidate resolutions before applying.`
                : `${status.conflictedFiles.length} conflicted file(s) detected locally. No deterministic candidate resolutions were found.`,
            candidates,
          };
        }

        if (pullRequest.mergeable === "CONFLICTING" || pullRequest.mergeStateStatus === "DIRTY") {
          return {
            status: "conflicted" as const,
            mergeableState: pullRequest.mergeable,
            summary:
              "GitHub reports merge conflicts. Check out the PR locally to generate file-level candidate resolutions.",
            candidates: [],
          };
        }

        return {
          status: "clean" as const,
          mergeableState: pullRequest.mergeable,
          summary: "No merge conflicts detected.",
          candidates: [],
        };
      },
      catch: (cause) =>
        new PrReviewError({
          operation: "analyzeConflicts",
          detail: `Failed to inspect merge conflicts in ${cwd}`,
          cause,
        }),
    });

  const service: MergeConflictResolverShape = {
    analyze: ({ cwd, pullRequest }) => resolveAnalysis(cwd, pullRequest),
    apply: ({ cwd, pullRequest, candidateId }) =>
      resolveAnalysis(cwd, pullRequest).pipe(
        Effect.flatMap((analysis) => {
          const candidate = analysis.candidates.find((entry) => entry.id === candidateId);
          if (!candidate) {
            return Effect.fail(
              new PrReviewError({
                operation: "applyConflictResolution",
                detail: `Conflict candidate not found: ${candidateId}`,
              }),
            );
          }

          return Effect.tryPromise({
            try: async () => {
              const absolutePath = path.join(cwd, candidate.path);
              const contents = await fsPromises.readFile(absolutePath, "utf8");
              const parsed = parseFirstConflictBlock(contents);
              // When markers are parseable, splice the candidate into the
              // surrounding context.  Otherwise the candidate contains the
              // full file content (index-based fallback) – write it directly.
              const nextContents = parsed
                ? `${parsed.before}${candidate.previewPatch}${parsed.after}`
                : candidate.previewPatch;
              await fsPromises.writeFile(absolutePath, nextContents, "utf8");
              return {
                candidateId,
                applied: true,
                summary: `Applied candidate resolution for ${candidate.path}. Review the diff before committing.`,
              };
            },
            catch: (cause) =>
              new PrReviewError({
                operation: "applyConflictResolution",
                detail: `Failed to apply conflict candidate ${candidateId}`,
                cause,
              }),
          });
        }),
      ),
  };

  return service;
});

export const MergeConflictResolverLive = Layer.effect(
  MergeConflictResolver,
  makeMergeConflictResolver,
);
