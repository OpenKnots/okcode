#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseMacUpdateManifest } from "./merge-mac-update-manifests.ts";
import { validateReleaseAssets } from "./validate-release-assets.ts";

const DEFAULT_GH_REPO = process.env.OKCODE_RELEASE_GH_REPO?.trim() || "OpenKnots/okcode";
const DEFAULT_WORKFLOW_ID = "release.yml";
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 5_000;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export interface WorkflowRunSummary {
  readonly id: number;
  readonly headBranch: string | null;
  readonly status: string;
  readonly conclusion: string | null;
  readonly createdAt: string;
}

export interface ReleaseAssetSummary {
  readonly name: string;
  readonly apiUrl?: string | undefined;
}

export interface ReleaseShipOptions {
  readonly version: string;
  readonly timeoutMs?: number;
  readonly pollIntervalMs?: number;
}

export interface ReleaseShipDeps {
  readonly log: (message: string) => void;
  readonly sleep: (ms: number) => Promise<void>;
  readonly releaseSteps: {
    readonly ensureGitHubAuth: () => Promise<void>;
    readonly runPreReleaseValidate: (version: string) => Promise<void>;
    readonly runPrepareRelease: (version: string) => Promise<void>;
  };
  readonly github: {
    readonly listReleaseWorkflowRuns: () => Promise<readonly WorkflowRunSummary[]>;
    readonly watchWorkflowRun: (runId: number) => Promise<void>;
    readonly getReleaseAssets: (tag: string) => Promise<readonly ReleaseAssetSummary[]>;
    readonly downloadReleaseAssetText: (tag: string, assetName: string) => Promise<string>;
  };
}

function runCommand(command: string, args: readonly string[]): string {
  return execFileSync(command, [...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function getReleaseAssets(repo: string, tag: string): ReleaseAssetSummary[] {
  const payload = parseJson<{ assets: Array<Record<string, unknown>> }>(
    runCommand("gh", ["release", "view", tag, "--repo", repo, "--json", "assets"]),
    "release assets",
  );

  return payload.assets.map((asset) => ({
    name: String(asset.name),
    apiUrl: typeof asset.apiUrl === "string" ? asset.apiUrl : undefined,
  }));
}

function parseJson<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse ${label}: ${error instanceof Error ? error.message : String(error)}`,
      {
        cause: error,
      },
    );
  }
}

export function findWorkflowRunForTag(
  runs: readonly WorkflowRunSummary[],
  tag: string,
): WorkflowRunSummary | null {
  return (
    [...runs]
      .filter((run) => run.headBranch === tag)
      .toSorted((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ??
    null
  );
}

export function validatePublishedRelease(
  assets: readonly ReleaseAssetSummary[],
  latestMacManifest: string,
): void {
  validateReleaseAssets(assets.map((asset) => asset.name));

  const manifest = parseMacUpdateManifest(latestMacManifest, "latest-mac.yml");
  const fileUrls = new Set(manifest.files.map((file) => file.url));
  const requiredFilePatterns = [/-arm64\.zip$/, /-arm64\.dmg$/, /-x64\.zip$/, /-x64\.dmg$/];

  const missing = requiredFilePatterns.filter(
    (pattern) => ![...fileUrls].some((url) => pattern.test(url)),
  );

  if (missing.length > 0) {
    throw new Error(
      `Published release has an incomplete merged macOS updater manifest: missing ${missing.map((pattern) => pattern.source).join(", ")}.`,
    );
  }
}

async function waitForReleaseWorkflowRun(
  tag: string,
  options: Required<Pick<ReleaseShipOptions, "timeoutMs" | "pollIntervalMs">>,
  deps: ReleaseShipDeps,
): Promise<WorkflowRunSummary> {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= options.timeoutMs) {
    const run = findWorkflowRunForTag(await deps.github.listReleaseWorkflowRuns(), tag);
    if (run) {
      return run;
    }
    await deps.sleep(options.pollIntervalMs);
  }

  throw new Error(
    `Timed out after ${options.timeoutMs}ms waiting for ${DEFAULT_WORKFLOW_ID} to start for ${tag}.`,
  );
}

export async function runReleaseShip(
  options: ReleaseShipOptions,
  deps: ReleaseShipDeps,
): Promise<void> {
  const tag = `v${options.version.replace(/^v/, "")}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  deps.log(`[release-ship] Authenticating GitHub CLI...`);
  await deps.releaseSteps.ensureGitHubAuth();

  deps.log(`[release-ship] Running local preflight for ${tag}...`);
  await deps.releaseSteps.runPreReleaseValidate(options.version);

  deps.log(`[release-ship] Preparing and pushing ${tag}...`);
  await deps.releaseSteps.runPrepareRelease(options.version);

  deps.log(`[release-ship] Waiting for ${DEFAULT_WORKFLOW_ID} to start for ${tag}...`);
  const workflowRun = await waitForReleaseWorkflowRun(tag, { timeoutMs, pollIntervalMs }, deps);

  deps.log(`[release-ship] Watching workflow run ${workflowRun.id}...`);
  await deps.github.watchWorkflowRun(workflowRun.id);

  deps.log(`[release-ship] Verifying published release assets for ${tag}...`);
  const assets = await deps.github.getReleaseAssets(tag);
  const latestMacManifest = await deps.github.downloadReleaseAssetText(tag, "latest-mac.yml");
  validatePublishedRelease(assets, latestMacManifest);
}

function createReleaseShipDeps(repo: string): ReleaseShipDeps {
  return {
    log: (message) => {
      console.log(message);
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    releaseSteps: {
      ensureGitHubAuth: async () => {
        runCommand("gh", ["auth", "status"]);
      },
      runPreReleaseValidate: async (version) => {
        execFileSync(
          process.execPath,
          [resolve(repoRoot, "scripts/pre-release-validate.ts"), version, "--ci"],
          { stdio: "inherit", cwd: repoRoot },
        );
      },
      runPrepareRelease: async (version) => {
        execFileSync(
          process.execPath,
          [resolve(repoRoot, "scripts/prepare-release.ts"), version, "--skip-checks"],
          { stdio: "inherit", cwd: repoRoot },
        );
      },
    },
    github: {
      listReleaseWorkflowRuns: async () => {
        const payload = parseJson<{ workflow_runs: Array<Record<string, unknown>> }>(
          runCommand("gh", [
            "api",
            `repos/${repo}/actions/workflows/${DEFAULT_WORKFLOW_ID}/runs?per_page=20`,
          ]),
          "release workflow runs",
        );

        return payload.workflow_runs.map((run) => ({
          id: Number(run.id),
          headBranch: typeof run.head_branch === "string" ? run.head_branch : null,
          status: typeof run.status === "string" ? run.status : "unknown",
          conclusion: typeof run.conclusion === "string" ? run.conclusion : null,
          createdAt:
            typeof run.created_at === "string" ? run.created_at : new Date(0).toISOString(),
        }));
      },
      watchWorkflowRun: async (runId) => {
        execFileSync("gh", ["run", "watch", String(runId), "--repo", repo, "--exit-status"], {
          stdio: "inherit",
        });
      },
      getReleaseAssets: async (tag) => getReleaseAssets(repo, tag),
      downloadReleaseAssetText: async (tag, assetName) => {
        const assets = getReleaseAssets(repo, tag);
        const asset = assets.find((entry) => entry.name === assetName);
        if (!asset?.apiUrl) {
          throw new Error(
            `Could not resolve GitHub API URL for release asset '${assetName}' on ${tag}.`,
          );
        }

        return runCommand("gh", [
          "api",
          "-H",
          "Accept: application/octet-stream",
          asset.apiUrl.replace("https://api.github.com/", ""),
        ]);
      },
    },
  };
}

function printHelp(): void {
  console.log(`release-ship — run release preflight, ship the tag, wait for GitHub Actions, and verify OTA assets.

Usage:
  node scripts/release-ship.ts <version> [flags]

Flags:
  --repo <owner/name>        GitHub repository to inspect (default: ${DEFAULT_GH_REPO})
  --timeout-ms <number>      Max time to wait for release workflow discovery
  --poll-interval-ms <num>   Poll interval while waiting for workflow discovery
  --help                     Show this message
`);
}

function parseArgs(argv: readonly string[]): {
  version: string;
  repo: string;
  timeoutMs: number;
  pollIntervalMs: number;
} {
  let version: string | undefined;
  let repo = DEFAULT_GH_REPO;
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  let pollIntervalMs = DEFAULT_POLL_INTERVAL_MS;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument) continue;

    switch (argument) {
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      case "--repo":
        repo = argv[index + 1] ?? repo;
        index += 1;
        break;
      case "--timeout-ms": {
        const rawTimeout = argv[index + 1];
        const parsed = Number(rawTimeout);
        if (!rawTimeout || !Number.isFinite(parsed) || parsed <= 0) {
          throw new Error(
            `--timeout-ms requires a positive finite number (got: ${rawTimeout ?? "<missing>"}).`,
          );
        }
        timeoutMs = parsed;
        index += 1;
        break;
      }
      case "--poll-interval-ms": {
        const rawInterval = argv[index + 1];
        const parsed = Number(rawInterval);
        if (!rawInterval || !Number.isFinite(parsed) || parsed <= 0) {
          throw new Error(
            `--poll-interval-ms requires a positive finite number (got: ${rawInterval ?? "<missing>"}).`,
          );
        }
        pollIntervalMs = parsed;
        index += 1;
        break;
      }
      default:
        if (argument.startsWith("--")) {
          throw new Error(`Unknown argument: ${argument}`);
        }
        if (version !== undefined) {
          throw new Error("Only one release version may be provided.");
        }
        version = argument.replace(/^v/, "");
        break;
    }
  }

  if (!version) {
    throw new Error(
      "Usage: node scripts/release-ship.ts <version> [--repo <owner/name>] [--timeout-ms <number>] [--poll-interval-ms <number>]",
    );
  }

  return { version, repo, timeoutMs, pollIntervalMs };
}

const isMain =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const parsed = parseArgs(process.argv.slice(2));
  runReleaseShip(
    {
      version: parsed.version,
      timeoutMs: parsed.timeoutMs,
      pollIntervalMs: parsed.pollIntervalMs,
    },
    createReleaseShipDeps(parsed.repo),
  ).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
