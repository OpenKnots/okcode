const GITHUB_PULL_REQUEST_URL_PATTERN =
  /^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)(?:[/?#].*)?$/i;
const PULL_REQUEST_NUMBER_PATTERN = /^#?(\d+)$/;

export interface ParsedPullRequestReference {
  kind: "url" | "number";
  reference: string;
  number: string;
  owner: string | null;
  repo: string | null;
}

export function parsePullRequestReferenceParts(input: string): ParsedPullRequestReference | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const urlMatch = GITHUB_PULL_REQUEST_URL_PATTERN.exec(trimmed);
  if (urlMatch?.[3]) {
    return {
      kind: "url",
      reference: trimmed,
      number: urlMatch[3],
      owner: urlMatch[1] ?? null,
      repo: urlMatch[2] ?? null,
    };
  }

  const numberMatch = PULL_REQUEST_NUMBER_PATTERN.exec(trimmed);
  if (numberMatch?.[1]) {
    return {
      kind: "number",
      reference: trimmed.startsWith("#") ? trimmed : numberMatch[1],
      number: numberMatch[1],
      owner: null,
      repo: null,
    };
  }

  return null;
}

export function parsePullRequestReference(input: string): string | null {
  return parsePullRequestReferenceParts(input)?.reference ?? null;
}
