/**
 * Parses a GitHub repository URL into its components.
 *
 * Supports:
 * - `https://github.com/owner/repo`
 * - `https://github.com/owner/repo.git`
 * - `https://github.com/owner/repo/tree/branch`
 * - `https://github.com/owner/repo/tree/branch/path/to/dir`
 * - `git@github.com:owner/repo.git`
 * - `owner/repo` (shorthand)
 */

export interface ParsedGitHubUrl {
  /** Full HTTPS clone URL */
  cloneUrl: string;
  /** Repository owner (user or org) */
  owner: string;
  /** Repository name (without .git suffix) */
  repo: string;
  /** Branch name if specified in the URL */
  branch: string | null;
}

const GITHUB_HTTPS_URL_PATTERN =
  /^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^?\s]+?))?(?:[?#].*)?$/i;

const GITHUB_SSH_URL_PATTERN = /^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i;

const GITHUB_SHORTHAND_PATTERN = /^([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)$/;

export function parseGitHubRepositoryUrl(input: string): ParsedGitHubUrl | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }

  // Try HTTPS URL
  const httpsMatch = GITHUB_HTTPS_URL_PATTERN.exec(trimmed);
  if (httpsMatch) {
    const owner = httpsMatch[1]!;
    const repo = httpsMatch[2]!;
    const branchAndPath = httpsMatch[3]?.trim() ?? null;
    // The branch is the first segment of the tree/blob path
    const branch = branchAndPath?.split("/")[0] ?? null;
    return {
      cloneUrl: `https://github.com/${owner}/${repo}.git`,
      owner,
      repo,
      branch: branch && branch.length > 0 ? branch : null,
    };
  }

  // Try SSH URL
  const sshMatch = GITHUB_SSH_URL_PATTERN.exec(trimmed);
  if (sshMatch) {
    const owner = sshMatch[1]!;
    const repo = sshMatch[2]!;
    return {
      cloneUrl: `https://github.com/${owner}/${repo}.git`,
      owner,
      repo,
      branch: null,
    };
  }

  // Try shorthand (owner/repo)
  const shorthandMatch = GITHUB_SHORTHAND_PATTERN.exec(trimmed);
  if (shorthandMatch) {
    const owner = shorthandMatch[1]!;
    const repo = shorthandMatch[2]!;
    return {
      cloneUrl: `https://github.com/${owner}/${repo}.git`,
      owner,
      repo,
      branch: null,
    };
  }

  return null;
}
