import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { runProcess } from "./processRunner";

import {
  ProjectDirectoryEntry,
  ProjectEntry,
  ProjectListDirectoryInput,
  ProjectListDirectoryResult,
  ProjectSearchEntriesInput,
  ProjectSearchEntriesResult,
} from "@okcode/contracts";

const WORKSPACE_CACHE_TTL_MS = 15_000;
const WORKSPACE_CACHE_MAX_KEYS = 4;
const WORKSPACE_INDEX_MAX_ENTRIES = 25_000;
const WORKSPACE_SCAN_READDIR_CONCURRENCY = 32;
const GIT_CHECK_IGNORE_MAX_STDIN_BYTES = 256 * 1024;
const IGNORED_DIRECTORY_NAMES = new Set([
  ".git",
  ".convex",
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "build",
  "out",
  ".cache",
]);

interface WorkspaceIndex {
  scannedAt: number;
  entries: SearchableWorkspaceEntry[];
  entriesByParent: Map<string, SearchableWorkspaceEntry[]>;
  childEntryCountByDirectory: Map<string, number>;
  truncated: boolean;
}

interface SearchableWorkspaceEntry extends ProjectEntry {
  name: string;
  normalizedPath: string;
  normalizedName: string;
}

interface RankedWorkspaceEntry {
  entry: SearchableWorkspaceEntry;
  score: number;
}

interface QueryTokenMatch {
  score: number;
  lastMatchIndex: number;
}

interface CompiledWorkspaceGlob {
  matches: (relativePath: string) => boolean;
}

interface CompiledWorkspaceGlobExpression {
  positive: CompiledWorkspaceGlob[];
  negative: CompiledWorkspaceGlob[];
}

const workspaceIndexCache = new Map<string, WorkspaceIndex>();
const inFlightWorkspaceIndexBuilds = new Map<string, Promise<WorkspaceIndex>>();
const ROOT_PARENT_KEY = "\u0000";

function toPosixPath(input: string): string {
  return input.split(path.sep).join("/");
}

function parentPathOf(input: string): string | undefined {
  const separatorIndex = input.lastIndexOf("/");
  if (separatorIndex === -1) {
    return undefined;
  }
  return input.slice(0, separatorIndex);
}

function basenameOf(input: string): string {
  const separatorIndex = input.lastIndexOf("/");
  if (separatorIndex === -1) {
    return input;
  }
  return input.slice(separatorIndex + 1);
}

function toSearchableWorkspaceEntry(entry: ProjectEntry): SearchableWorkspaceEntry {
  const name = basenameOf(entry.path);
  const normalizedPath = entry.path.toLowerCase();
  return {
    ...entry,
    name,
    normalizedPath,
    normalizedName: name.toLowerCase(),
  };
}

function normalizeQuery(input: string): string {
  return input.trim().replace(/^[@./]+/, "");
}

function splitQueryTokens(input: string): string[] {
  const normalizedQuery = normalizeQuery(input);
  if (!normalizedQuery) return [];
  return normalizedQuery.split(/\s+/).filter((token) => token.length > 0);
}

function splitGlobPatternList(input?: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,]+/)
    .map((part) => part.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, ""))
    .filter((part) => part.length > 0);
}

function findBraceClosingIndex(input: string, openIndex: number): number {
  let depth = 0;
  for (let index = openIndex; index < input.length; index += 1) {
    if (input[index] === "{") {
      depth += 1;
      continue;
    }
    if (input[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function splitBraceAlternatives(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth = Math.max(0, depth - 1);
    }
    current += character;
  }

  parts.push(current);
  return parts;
}

function escapeRegExp(input: string): string {
  return input.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function globToRegExpSource(pattern: string): string {
  let source = "";

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "*") {
      if (pattern[index + 1] === "*") {
        const followedBySlash = pattern[index + 2] === "/";
        source += followedBySlash ? "(?:.*\\/)?" : ".*";
        index += followedBySlash ? 2 : 1;
        continue;
      }
      source += "[^/]*";
      continue;
    }
    if (character === "?") {
      source += "[^/]";
      continue;
    }
    if (character === "{") {
      const closingIndex = findBraceClosingIndex(pattern, index);
      if (closingIndex > index) {
        const alternatives = splitBraceAlternatives(pattern.slice(index + 1, closingIndex)).filter(
          (part) => part.length > 0,
        );
        if (alternatives.length > 0) {
          source += `(?:${alternatives.map(globToRegExpSource).join("|")})`;
          index = closingIndex;
          continue;
        }
      }
    }
    source += escapeRegExp(character ?? "");
  }

  return source;
}

function hasGlobMagic(pattern: string): boolean {
  return /[*?{]/.test(pattern);
}

function compileWorkspaceGlob(pattern: string): CompiledWorkspaceGlob {
  const normalizedPattern = pattern.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (!normalizedPattern || normalizedPattern === "**") {
    return { matches: () => true };
  }

  if (normalizedPattern.endsWith("/**")) {
    const prefix = normalizedPattern.slice(0, -3);
    return {
      matches: (relativePath) => relativePath === prefix || relativePath.startsWith(`${prefix}/`),
    };
  }

  const includesSlash = normalizedPattern.includes("/");
  const magic = hasGlobMagic(normalizedPattern);

  if (!includesSlash && !magic) {
    return {
      matches: (relativePath) =>
        relativePath === normalizedPattern || relativePath.split("/").includes(normalizedPattern),
    };
  }

  if (!includesSlash) {
    const segmentExpression = new RegExp(`^${globToRegExpSource(normalizedPattern)}$`, "i");
    return {
      matches: (relativePath) =>
        relativePath.split("/").some((segment) => segmentExpression.test(segment)),
    };
  }

  if (!magic) {
    return {
      matches: (relativePath) =>
        relativePath === normalizedPattern || relativePath.startsWith(`${normalizedPattern}/`),
    };
  }

  const pathExpression = new RegExp(`^${globToRegExpSource(normalizedPattern)}$`, "i");
  return {
    matches: (relativePath) => pathExpression.test(relativePath),
  };
}

function compileWorkspaceGlobExpression(input?: string): CompiledWorkspaceGlobExpression {
  const expression: CompiledWorkspaceGlobExpression = {
    positive: [],
    negative: [],
  };

  for (const pattern of splitGlobPatternList(input)) {
    const isNegative = pattern.startsWith("!");
    const normalizedPattern = isNegative ? pattern.slice(1).trim() : pattern;
    if (!normalizedPattern) continue;
    const target = isNegative ? expression.negative : expression.positive;
    target.push(compileWorkspaceGlob(normalizedPattern));
  }

  return expression;
}

function matchesWorkspaceGlobExpression(
  relativePath: string,
  expression: CompiledWorkspaceGlobExpression,
): boolean {
  if (
    expression.positive.length > 0 &&
    !expression.positive.some((glob) => glob.matches(relativePath))
  ) {
    return false;
  }
  if (expression.negative.some((glob) => glob.matches(relativePath))) {
    return false;
  }
  return true;
}

function shouldIncludeSearchableEntry(
  entry: SearchableWorkspaceEntry,
  includeExpression: CompiledWorkspaceGlobExpression,
  excludeExpression: CompiledWorkspaceGlobExpression,
): boolean {
  if (!matchesWorkspaceGlobExpression(entry.path, includeExpression)) {
    return false;
  }
  if (excludeExpression.positive.some((glob) => glob.matches(entry.path))) {
    return false;
  }
  return true;
}

function isWordSeparator(character: string | undefined): boolean {
  return (
    character === "/" ||
    character === "\\" ||
    character === "-" ||
    character === "_" ||
    character === "." ||
    character === " "
  );
}

function isUppercaseAscii(character: string | undefined): boolean {
  return Boolean(character && character >= "A" && character <= "Z");
}

function isLowercaseAscii(character: string | undefined): boolean {
  return Boolean(character && character >= "a" && character <= "z");
}

function isDigit(character: string | undefined): boolean {
  return Boolean(character && character >= "0" && character <= "9");
}

function isWordStart(value: string, index: number): boolean {
  if (index <= 0) return true;
  const current = value[index];
  const previous = value[index - 1];
  if (isWordSeparator(previous)) {
    return true;
  }
  if (isLowercaseAscii(previous) && isUppercaseAscii(current)) {
    return true;
  }
  return isDigit(previous) !== isDigit(current);
}

function countExactCaseMatches(value: string, queryToken: string, startIndex: number): number {
  let exactCaseMatches = 0;
  for (let index = 0; index < queryToken.length; index += 1) {
    if (value[startIndex + index] === queryToken[index]) {
      exactCaseMatches += 1;
    }
  }
  return exactCaseMatches;
}

function countUppercaseQueryCharacters(queryToken: string): number {
  let uppercaseCharacters = 0;
  for (let index = 0; index < queryToken.length; index += 1) {
    if (isUppercaseAscii(queryToken[index])) {
      uppercaseCharacters += 1;
    }
  }
  return uppercaseCharacters;
}

function findTightSubsequencePositions(
  valueLower: string,
  queryLower: string,
  startIndex: number,
): number[] | null {
  if (!queryLower) return [];

  const forwardPositions: number[] = [];
  let queryIndex = 0;

  for (
    let valueIndex = Math.max(0, startIndex);
    valueIndex < valueLower.length && queryIndex < queryLower.length;
    valueIndex += 1
  ) {
    if (valueLower[valueIndex] !== queryLower[queryIndex]) {
      continue;
    }
    forwardPositions[queryIndex] = valueIndex;
    queryIndex += 1;
  }

  if (queryIndex !== queryLower.length) {
    return null;
  }

  const positions = Array<number>(queryLower.length);
  let valueIndex = forwardPositions[forwardPositions.length - 1] ?? startIndex;
  for (
    let reverseQueryIndex = queryLower.length - 1;
    reverseQueryIndex >= 0;
    reverseQueryIndex -= 1
  ) {
    while (valueIndex >= startIndex && valueLower[valueIndex] !== queryLower[reverseQueryIndex]) {
      valueIndex -= 1;
    }
    if (valueIndex < startIndex) {
      return null;
    }
    positions[reverseQueryIndex] = valueIndex;
    valueIndex -= 1;
  }

  return positions;
}

function scoreExactTokenMatch(
  value: string,
  queryToken: string,
  startIndex: number,
): QueryTokenMatch {
  const exactCaseMatches = countExactCaseMatches(value, queryToken, startIndex);
  const uppercaseCaseMismatches = Math.max(
    0,
    countUppercaseQueryCharacters(queryToken) - exactCaseMatches,
  );
  let score = 1_450;
  if (startIndex === 0) {
    score += 140;
  }
  if (isWordStart(value, startIndex)) {
    score += 140;
  }
  score += exactCaseMatches * 70;
  score -= uppercaseCaseMismatches * 120;
  score -= startIndex * 8;
  score -= Math.max(0, value.length - queryToken.length);
  return {
    score,
    lastMatchIndex: startIndex + queryToken.length - 1,
  };
}

function scoreFuzzyTokenMatch(
  value: string,
  queryToken: string,
  positions: readonly number[],
): QueryTokenMatch {
  const firstMatchIndex = positions[0] ?? 0;
  const lastMatchIndex = positions[positions.length - 1] ?? firstMatchIndex;
  let score = 1_150;
  score -= firstMatchIndex * 8;
  score -= (lastMatchIndex - firstMatchIndex + 1 - queryToken.length) * 12;
  score -= Math.max(0, value.length - queryToken.length);

  for (let index = 0; index < positions.length; index += 1) {
    const position = positions[index] ?? 0;
    if (isWordStart(value, position)) {
      score += 90;
    }
    if (value[position] === queryToken[index]) {
      score += 50;
    }
    if (index > 0 && position === (positions[index - 1] ?? -2) + 1) {
      score += 60;
    }
  }

  return {
    score,
    lastMatchIndex,
  };
}

function scoreQueryTokenMatch(
  value: string,
  valueLower: string,
  queryToken: string,
  startIndex: number,
): QueryTokenMatch | null {
  if (!queryToken) {
    return {
      score: 0,
      lastMatchIndex: Math.max(0, startIndex - 1),
    };
  }

  const queryLower = queryToken.toLowerCase();
  const exactIndex = valueLower.indexOf(queryLower, startIndex);
  const exactMatch = exactIndex === -1 ? null : scoreExactTokenMatch(value, queryToken, exactIndex);

  const positions = findTightSubsequencePositions(valueLower, queryLower, startIndex);
  const fuzzyMatch = positions ? scoreFuzzyTokenMatch(value, queryToken, positions) : null;

  if (!exactMatch) {
    return fuzzyMatch;
  }
  if (!fuzzyMatch) {
    return exactMatch;
  }
  return exactMatch.score >= fuzzyMatch.score ? exactMatch : fuzzyMatch;
}

function scoreQueryTokensOnValue(value: string, queryTokens: readonly string[]): number | null {
  const valueLower = value.toLowerCase();
  let score = 0;
  let nextStartIndex = 0;

  for (const queryToken of queryTokens) {
    const tokenMatch = scoreQueryTokenMatch(value, valueLower, queryToken, nextStartIndex);
    if (!tokenMatch) {
      return null;
    }
    score += tokenMatch.score;
    nextStartIndex = tokenMatch.lastMatchIndex + 1;
  }

  return score;
}

function scoreEntry(
  entry: SearchableWorkspaceEntry,
  queryTokens: readonly string[],
): number | null {
  if (queryTokens.length === 0) {
    return entry.kind === "file" ? 250 : 200;
  }

  const nameScore = scoreQueryTokensOnValue(entry.name, queryTokens);
  const pathScore = scoreQueryTokensOnValue(entry.path, queryTokens);
  if (nameScore === null && pathScore === null) {
    return null;
  }

  const bestScore = Math.max(
    nameScore ?? Number.NEGATIVE_INFINITY,
    pathScore ?? Number.NEGATIVE_INFINITY,
  );
  let score = bestScore;
  if (nameScore !== null) {
    score += 220;
  }
  if (pathScore !== null && nameScore !== null) {
    score += 20;
  }
  if (entry.kind === "file") {
    score += 30;
  }
  return score;
}

function compareRankedWorkspaceEntries(
  left: RankedWorkspaceEntry,
  right: RankedWorkspaceEntry,
): number {
  const scoreDelta = right.score - left.score;
  if (scoreDelta !== 0) return scoreDelta;
  if (left.entry.kind !== right.entry.kind) {
    return left.entry.kind === "file" ? -1 : 1;
  }
  return left.entry.path.localeCompare(right.entry.path);
}

function compareTreeEntries(left: ProjectEntry, right: ProjectEntry): number {
  if (left.kind !== right.kind) {
    return left.kind === "directory" ? -1 : 1;
  }
  return left.path.localeCompare(right.path);
}

function createWorkspaceIndex(
  entries: SearchableWorkspaceEntry[],
  truncated: boolean,
): WorkspaceIndex {
  const entriesByParent = new Map<string, SearchableWorkspaceEntry[]>();
  const childEntryCountByDirectory = new Map<string, number>();

  for (const entry of entries) {
    const parentKey = entry.parentPath ?? ROOT_PARENT_KEY;
    const existingEntries = entriesByParent.get(parentKey);
    if (existingEntries) {
      existingEntries.push(entry);
    } else {
      entriesByParent.set(parentKey, [entry]);
    }

    if (entry.parentPath) {
      childEntryCountByDirectory.set(
        entry.parentPath,
        (childEntryCountByDirectory.get(entry.parentPath) ?? 0) + 1,
      );
    }
  }

  for (const bucket of entriesByParent.values()) {
    bucket.sort(compareTreeEntries);
  }

  return {
    scannedAt: Date.now(),
    entries,
    entriesByParent,
    childEntryCountByDirectory,
    truncated,
  };
}

function findInsertionIndex(
  rankedEntries: RankedWorkspaceEntry[],
  candidate: RankedWorkspaceEntry,
): number {
  let low = 0;
  let high = rankedEntries.length;

  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    const current = rankedEntries[middle];
    if (!current) {
      break;
    }

    if (compareRankedWorkspaceEntries(candidate, current) < 0) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }

  return low;
}

function insertRankedEntry(
  rankedEntries: RankedWorkspaceEntry[],
  candidate: RankedWorkspaceEntry,
  limit: number,
): void {
  if (limit <= 0) {
    return;
  }

  const insertionIndex = findInsertionIndex(rankedEntries, candidate);
  if (rankedEntries.length < limit) {
    rankedEntries.splice(insertionIndex, 0, candidate);
    return;
  }

  if (insertionIndex >= limit) {
    return;
  }

  rankedEntries.splice(insertionIndex, 0, candidate);
  rankedEntries.pop();
}

function isPathInIgnoredDirectory(relativePath: string): boolean {
  const firstSegment = relativePath.split("/")[0];
  if (!firstSegment) return false;
  return IGNORED_DIRECTORY_NAMES.has(firstSegment);
}

function splitNullSeparatedPaths(input: string, truncated: boolean): string[] {
  const parts = input.split("\0");
  if (parts.length === 0) return [];

  // If output was truncated, the final token can be partial.
  if (truncated && parts[parts.length - 1]?.length) {
    parts.pop();
  }

  return parts.filter((value) => value.length > 0);
}

function directoryAncestorsOf(relativePath: string): string[] {
  const segments = relativePath.split("/").filter((segment) => segment.length > 0);
  if (segments.length <= 1) return [];
  const directories: string[] = [];
  for (let index = 1; index < segments.length; index += 1) {
    directories.push(segments.slice(0, index).join("/"));
  }
  return directories;
}

async function mapWithConcurrency<TInput, TOutput>(
  items: readonly TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  if (items.length === 0) {
    return [];
  }

  const boundedConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results = Array.from({ length: items.length }) as TOutput[];
  let nextIndex = 0;

  const workers = Array.from({ length: boundedConcurrency }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex] as TInput, currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

const ENV_FILE_PATTERN = /^\.env(\..+)?$/;

/**
 * Discover .env* files at the workspace root so they appear in the file tree
 * even when gitignored. Only root-level env files are included.
 */
async function discoverEnvFiles(cwd: string): Promise<string[]> {
  try {
    const dirEntries = await fs.readdir(cwd, { withFileTypes: true });
    return dirEntries
      .filter((entry) => entry.isFile() && ENV_FILE_PATTERN.test(entry.name))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function isInsideGitWorkTree(cwd: string): Promise<boolean> {
  const insideWorkTree = await runProcess("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd,
    allowNonZeroExit: true,
    timeoutMs: 5_000,
    maxBufferBytes: 4_096,
  }).catch(() => null);
  return Boolean(
    insideWorkTree && insideWorkTree.code === 0 && insideWorkTree.stdout.trim() === "true",
  );
}

async function filterGitIgnoredPaths(cwd: string, relativePaths: string[]): Promise<string[]> {
  if (relativePaths.length === 0) {
    return relativePaths;
  }

  const ignoredPaths = new Set<string>();
  let chunk: string[] = [];
  let chunkBytes = 0;

  const flushChunk = async (): Promise<boolean> => {
    if (chunk.length === 0) {
      return true;
    }

    const checkIgnore = await runProcess("git", ["check-ignore", "--no-index", "-z", "--stdin"], {
      cwd,
      allowNonZeroExit: true,
      timeoutMs: 20_000,
      maxBufferBytes: 16 * 1024 * 1024,
      outputMode: "truncate",
      stdin: `${chunk.join("\0")}\0`,
    }).catch(() => null);
    chunk = [];
    chunkBytes = 0;

    if (!checkIgnore) {
      return false;
    }

    // git-check-ignore exits with 1 when no paths match.
    if (checkIgnore.code !== 0 && checkIgnore.code !== 1) {
      return false;
    }

    const matchedIgnoredPaths = splitNullSeparatedPaths(
      checkIgnore.stdout,
      Boolean(checkIgnore.stdoutTruncated),
    );
    for (const ignoredPath of matchedIgnoredPaths) {
      ignoredPaths.add(ignoredPath);
    }
    return true;
  };

  for (const relativePath of relativePaths) {
    const relativePathBytes = Buffer.byteLength(relativePath) + 1;
    if (
      chunk.length > 0 &&
      chunkBytes + relativePathBytes > GIT_CHECK_IGNORE_MAX_STDIN_BYTES &&
      !(await flushChunk())
    ) {
      return relativePaths;
    }

    chunk.push(relativePath);
    chunkBytes += relativePathBytes;

    if (chunkBytes >= GIT_CHECK_IGNORE_MAX_STDIN_BYTES && !(await flushChunk())) {
      return relativePaths;
    }
  }

  if (!(await flushChunk())) {
    return relativePaths;
  }

  if (ignoredPaths.size === 0) {
    return relativePaths;
  }

  return relativePaths.filter((relativePath) => !ignoredPaths.has(relativePath));
}

async function buildWorkspaceIndexFromGit(cwd: string): Promise<WorkspaceIndex | null> {
  if (!(await isInsideGitWorkTree(cwd))) {
    return null;
  }

  const listedFiles = await runProcess(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      cwd,
      allowNonZeroExit: true,
      timeoutMs: 20_000,
      maxBufferBytes: 16 * 1024 * 1024,
      outputMode: "truncate",
    },
  ).catch(() => null);
  if (!listedFiles || listedFiles.code !== 0) {
    return null;
  }

  const listedPaths = splitNullSeparatedPaths(
    listedFiles.stdout,
    Boolean(listedFiles.stdoutTruncated),
  )
    .map((entry) => toPosixPath(entry))
    .filter((entry) => entry.length > 0 && !isPathInIgnoredDirectory(entry));
  const filePaths = await filterGitIgnoredPaths(cwd, listedPaths);

  // Include .env* files that may be gitignored so they appear in the file tree
  const envFiles = await discoverEnvFiles(cwd);
  for (const envPath of envFiles) {
    if (!filePaths.includes(envPath)) {
      filePaths.push(envPath);
    }
  }

  const directorySet = new Set<string>();
  for (const filePath of filePaths) {
    for (const directoryPath of directoryAncestorsOf(filePath)) {
      if (!isPathInIgnoredDirectory(directoryPath)) {
        directorySet.add(directoryPath);
      }
    }
  }

  const directoryEntries = [...directorySet]
    .toSorted((left, right) => left.localeCompare(right))
    .map(
      (directoryPath): ProjectEntry => ({
        path: directoryPath,
        kind: "directory",
        parentPath: parentPathOf(directoryPath),
      }),
    )
    .map(toSearchableWorkspaceEntry);
  const fileEntries = [...new Set(filePaths)]
    .toSorted((left, right) => left.localeCompare(right))
    .map(
      (filePath): ProjectEntry => ({
        path: filePath,
        kind: "file",
        parentPath: parentPathOf(filePath),
      }),
    )
    .map(toSearchableWorkspaceEntry);

  const entries = [...directoryEntries, ...fileEntries].slice(0, WORKSPACE_INDEX_MAX_ENTRIES);
  return createWorkspaceIndex(
    entries,
    Boolean(listedFiles.stdoutTruncated) ||
      directoryEntries.length + fileEntries.length > WORKSPACE_INDEX_MAX_ENTRIES,
  );
}

async function buildWorkspaceIndex(cwd: string): Promise<WorkspaceIndex> {
  const gitIndexed = await buildWorkspaceIndexFromGit(cwd);
  if (gitIndexed) {
    return gitIndexed;
  }
  const shouldFilterWithGitIgnore = await isInsideGitWorkTree(cwd);

  let pendingDirectories: string[] = [""];
  const entries: SearchableWorkspaceEntry[] = [];
  let truncated = false;

  while (pendingDirectories.length > 0 && !truncated) {
    const currentDirectories = pendingDirectories;
    pendingDirectories = [];
    const directoryEntries = await mapWithConcurrency(
      currentDirectories,
      WORKSPACE_SCAN_READDIR_CONCURRENCY,
      async (relativeDir) => {
        const absoluteDir = relativeDir ? path.join(cwd, relativeDir) : cwd;
        try {
          const dirents = await fs.readdir(absoluteDir, { withFileTypes: true });
          return { relativeDir, dirents };
        } catch (error) {
          if (!relativeDir) {
            throw new Error(
              `Unable to scan workspace entries at '${cwd}': ${error instanceof Error ? error.message : "unknown error"}`,
              { cause: error },
            );
          }
          return { relativeDir, dirents: null };
        }
      },
    );

    const candidateEntriesByDirectory = directoryEntries.map((directoryEntry) => {
      const { relativeDir, dirents } = directoryEntry;
      if (!dirents) return [] as Array<{ dirent: Dirent; relativePath: string }>;

      dirents.sort((left, right) => left.name.localeCompare(right.name));
      const candidates: Array<{ dirent: Dirent; relativePath: string }> = [];
      for (const dirent of dirents) {
        if (!dirent.name || dirent.name === "." || dirent.name === "..") {
          continue;
        }
        if (dirent.isDirectory() && IGNORED_DIRECTORY_NAMES.has(dirent.name)) {
          continue;
        }
        if (!dirent.isDirectory() && !dirent.isFile()) {
          continue;
        }

        const relativePath = toPosixPath(
          relativeDir ? path.join(relativeDir, dirent.name) : dirent.name,
        );
        if (isPathInIgnoredDirectory(relativePath)) {
          continue;
        }
        candidates.push({ dirent, relativePath });
      }
      return candidates;
    });

    const candidatePaths = candidateEntriesByDirectory.flatMap((candidateEntries) =>
      candidateEntries.map((entry) => entry.relativePath),
    );
    const allowedPathSet = shouldFilterWithGitIgnore
      ? new Set(await filterGitIgnoredPaths(cwd, candidatePaths))
      : null;

    for (const candidateEntries of candidateEntriesByDirectory) {
      for (const candidate of candidateEntries) {
        if (allowedPathSet && !allowedPathSet.has(candidate.relativePath)) {
          continue;
        }

        const entry = toSearchableWorkspaceEntry({
          path: candidate.relativePath,
          kind: candidate.dirent.isDirectory() ? "directory" : "file",
          parentPath: parentPathOf(candidate.relativePath),
        });
        entries.push(entry);

        if (candidate.dirent.isDirectory()) {
          pendingDirectories.push(candidate.relativePath);
        }

        if (entries.length >= WORKSPACE_INDEX_MAX_ENTRIES) {
          truncated = true;
          break;
        }
      }

      if (truncated) {
        break;
      }
    }
  }

  return createWorkspaceIndex(entries, truncated);
}

async function getWorkspaceIndex(cwd: string): Promise<WorkspaceIndex> {
  const cached = workspaceIndexCache.get(cwd);
  if (cached && Date.now() - cached.scannedAt < WORKSPACE_CACHE_TTL_MS) {
    return cached;
  }

  const inFlight = inFlightWorkspaceIndexBuilds.get(cwd);
  if (inFlight) {
    return inFlight;
  }

  const nextPromise = buildWorkspaceIndex(cwd)
    .then((next) => {
      workspaceIndexCache.set(cwd, next);
      while (workspaceIndexCache.size > WORKSPACE_CACHE_MAX_KEYS) {
        const oldestKey = workspaceIndexCache.keys().next().value;
        if (!oldestKey) break;
        workspaceIndexCache.delete(oldestKey);
      }
      return next;
    })
    .finally(() => {
      inFlightWorkspaceIndexBuilds.delete(cwd);
    });
  inFlightWorkspaceIndexBuilds.set(cwd, nextPromise);
  return nextPromise;
}

export function clearWorkspaceIndexCache(cwd: string): void {
  workspaceIndexCache.delete(cwd);
  inFlightWorkspaceIndexBuilds.delete(cwd);
}

export async function listWorkspaceDirectory(
  input: ProjectListDirectoryInput,
): Promise<ProjectListDirectoryResult> {
  const index = await getWorkspaceIndex(input.cwd);
  const parentKey = input.directoryPath ?? ROOT_PARENT_KEY;
  const entries = index.entriesByParent.get(parentKey) ?? [];

  return {
    entries: entries.map((entry): ProjectDirectoryEntry => {
      const hasChildren =
        entry.kind === "directory" && (index.childEntryCountByDirectory.get(entry.path) ?? 0) > 0;
      if (entry.parentPath) {
        return {
          path: entry.path,
          kind: entry.kind,
          parentPath: entry.parentPath,
          hasChildren,
        };
      }
      return {
        path: entry.path,
        kind: entry.kind,
        hasChildren,
      };
    }),
    truncated: index.truncated,
  };
}

export async function searchWorkspaceEntries(
  input: ProjectSearchEntriesInput,
): Promise<ProjectSearchEntriesResult> {
  const index = await getWorkspaceIndex(input.cwd);
  const queryTokens = splitQueryTokens(input.query);
  const includeExpression = compileWorkspaceGlobExpression(input.includePattern);
  const excludeExpression = compileWorkspaceGlobExpression(input.excludePattern);
  const limit = Math.max(0, Math.floor(input.limit));
  const rankedEntries: RankedWorkspaceEntry[] = [];
  let matchedEntryCount = 0;

  for (const entry of index.entries) {
    if (!shouldIncludeSearchableEntry(entry, includeExpression, excludeExpression)) {
      continue;
    }

    const score = scoreEntry(entry, queryTokens);
    if (score === null) {
      continue;
    }

    matchedEntryCount += 1;
    insertRankedEntry(rankedEntries, { entry, score }, limit);
  }

  return {
    entries: rankedEntries.map((candidate) => candidate.entry),
    truncated: index.truncated || matchedEntryCount > limit,
  };
}
