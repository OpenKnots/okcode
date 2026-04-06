export interface PrReviewLocalCommandAction {
  readonly kind: "localCommand";
  readonly cwd: string;
  readonly args: readonly string[];
  readonly label: string;
}

const LOCAL_COMMAND_PREFIX = "okcode:local-command:";

export function encodePrReviewLocalCommandAction(input: PrReviewLocalCommandAction): string {
  return `${LOCAL_COMMAND_PREFIX}${Buffer.from(JSON.stringify(input), "utf8").toString("base64url")}`;
}

export function decodePrReviewLocalCommandAction(
  value: string | null | undefined,
): PrReviewLocalCommandAction | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed.startsWith(LOCAL_COMMAND_PREFIX)) {
    return null;
  }

  try {
    const raw = trimmed.slice(LOCAL_COMMAND_PREFIX.length);
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      kind?: unknown;
      cwd?: unknown;
      args?: unknown;
      label?: unknown;
    };
    if (
      parsed.kind !== "localCommand" ||
      typeof parsed.cwd !== "string" ||
      parsed.cwd.trim().length === 0 ||
      !Array.isArray(parsed.args) ||
      parsed.args.some((entry) => typeof entry !== "string") ||
      typeof parsed.label !== "string" ||
      parsed.label.trim().length === 0
    ) {
      return null;
    }
    return {
      kind: "localCommand",
      cwd: parsed.cwd.trim(),
      args: parsed.args.map((entry) => entry.trim()).filter((entry) => entry.length > 0),
      label: parsed.label.trim(),
    };
  } catch {
    return null;
  }
}

export function parseGitHubRepositoryNameWithOwnerFromRemoteUrl(url: string | null): string | null {
  const trimmed = url?.trim() ?? "";
  if (trimmed.length === 0) {
    return null;
  }

  const match =
    /^(?:git@github\.com:|ssh:\/\/git@github\.com\/|https:\/\/github\.com\/|git:\/\/github\.com\/)([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/i.exec(
      trimmed,
    );
  const repositoryNameWithOwner = match?.[1]?.trim() ?? "";
  return repositoryNameWithOwner.length > 0 ? repositoryNameWithOwner : null;
}
