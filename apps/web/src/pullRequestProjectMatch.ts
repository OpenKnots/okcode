import type { Project } from "./types";
import { parsePullRequestReferenceParts } from "./pullRequestReference";

function lastPathSegment(input: string): string {
  const segments = input.split(/[\\/]/).filter((segment) => segment.length > 0);
  return segments.at(-1) ?? "";
}

function normalizeRepositorySlug(input: string): string {
  return input
    .trim()
    .replace(/\.git$/i, "")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function projectRepositoryCandidates(project: Project): string[] {
  const candidates = [project.name, lastPathSegment(project.cwd)]
    .map(normalizeRepositorySlug)
    .filter((candidate) => candidate.length > 0);

  return [...new Set(candidates)];
}

export function findProjectMatchingPullRequestReference(
  projects: readonly Project[],
  reference: string,
): Project | null {
  const parsed = parsePullRequestReferenceParts(reference);
  if (parsed?.kind !== "url" || !parsed.repo) {
    return null;
  }

  const targetRepository = normalizeRepositorySlug(parsed.repo);
  if (targetRepository.length === 0) {
    return null;
  }

  return (
    projects.find((project) => projectRepositoryCandidates(project).includes(targetRepository)) ??
    null
  );
}
