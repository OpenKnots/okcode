export interface TurnDiffFileSummary {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
}

interface MutableTurnDiffFileSummary {
  path: string;
  additions: number;
  deletions: number;
}

function normalizeDiffPath(path: string): string {
  return path.replace(/^a\//, "").replace(/^b\//, "");
}

function createFileSummary(path: string): MutableTurnDiffFileSummary {
  return { path, additions: 0, deletions: 0 };
}

export function parseTurnDiffFilesFromUnifiedDiff(
  diff: string,
): ReadonlyArray<TurnDiffFileSummary> {
  const normalized = diff.replace(/\r\n/g, "\n").trim();
  if (normalized.length === 0) {
    return [];
  }

  const files: MutableTurnDiffFileSummary[] = [];
  let currentFile: MutableTurnDiffFileSummary | null = null;
  let inHunk = false;

  for (const line of normalized.split("\n")) {
    if (line.startsWith("diff --git ")) {
      if (currentFile) files.push(currentFile);

      const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
      currentFile = createFileSummary(normalizeDiffPath(match?.[2] ?? match?.[1] ?? line));
      inHunk = false;
      continue;
    }

    if (!currentFile) {
      continue;
    }

    if (line.startsWith("@@")) {
      inHunk = true;
      continue;
    }

    if (!inHunk) {
      continue;
    }

    if (line.startsWith("+++ ") || line.startsWith("--- ")) {
      continue;
    }

    if (line.startsWith("+")) {
      currentFile.additions += 1;
      continue;
    }

    if (line.startsWith("-")) {
      currentFile.deletions += 1;
    }
  }

  if (currentFile) files.push(currentFile);

  return files.toSorted((left, right) => left.path.localeCompare(right.path));
}
