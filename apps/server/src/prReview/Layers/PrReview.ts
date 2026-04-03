import { Effect, Layer } from "effect";
import type {
  PrConflictAnalysis,
  GitHubUserPreview,
  PrReviewAddThreadInput,
  PrReviewComment,
  PrReviewConfig,
  PrReviewDashboardInput,
  PrReviewDashboardResult,
  PrReviewFile,
  PrReviewPatchInput,
  PrReviewParticipant,
  PrReviewReplyToThreadInput,
  PrReviewResolveThreadInput,
  PrReviewSearchUsersInput,
  PrReviewSearchUsersResult,
  PrReviewSummary,
  PrReviewUserPreviewInput,
  PrSubmitReviewInput,
  PrSubmitReviewResult,
  PrWorkflowStepRunResult,
} from "@okcode/contracts";
import { GitHubCli } from "../../git/Services/GitHubCli.ts";
import { RepoReviewConfig } from "../Services/RepoReviewConfig.ts";
import { PrReviewProjection } from "../Services/PrReviewProjection.ts";
import { WorkflowEngine } from "../Services/WorkflowEngine.ts";
import { MergeConflictResolver } from "../Services/MergeConflictResolver.ts";
import { PrReview, type PrReviewShape } from "../Services/PrReview.ts";
import { PrReviewError, type PrReviewServiceError } from "../Errors.ts";

type RepoRef = {
  owner: string;
  name: string;
  nameWithOwner: string;
};

type DashboardBase = {
  repo: RepoRef;
  pullRequest: PrReviewSummary;
  threads: PrReviewDashboardResult["threads"];
  files: PrReviewFile[];
};

const DASHBOARD_QUERY = `
query PullRequestReviewDashboard($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      id
      number
      title
      body
      url
      state
      isDraft
      mergeable
      mergeStateStatus
      reviewDecision
      baseRefName
      headRefName
      baseRefOid
      headRefOid
      labels(first: 20) {
        nodes { name color }
      }
      author {
        login
        avatarUrl
        url
        ... on User {
          name
          bio
          company
          location
        }
      }
      participants(first: 20) {
        nodes {
          login
          avatarUrl
          url
          ... on User {
            name
            bio
            company
            location
          }
        }
      }
      reviewRequests(first: 20) {
        nodes {
          requestedReviewer {
            ... on User {
              login
              avatarUrl
              url
              name
              bio
              company
              location
            }
          }
        }
      }
      commits(last: 1) {
        nodes {
          commit {
            statusCheckRollup {
              contexts(first: 100) {
                nodes {
                  ... on CheckRun {
                    name
                    status
                    conclusion
                    detailsUrl
                  }
                  ... on StatusContext {
                    context
                    state
                    targetUrl
                  }
                }
              }
            }
          }
        }
      }
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          originalLine
          startLine
          diffSide
          startDiffSide
          comments(first: 100) {
            nodes {
              id
              databaseId
              body
              createdAt
              updatedAt
              url
              path
              line
              originalLine
              startLine
              diffHunk
              replyTo { id }
              author {
                login
                avatarUrl
                url
                ... on User {
                  name
                  bio
                  company
                  location
                }
              }
            }
          }
        }
      }
    }
  }
}`;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asPositiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function normalizeUser(raw: unknown): GitHubUserPreview | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const login = asString(record.login);
  const avatarUrl = asString(record.avatarUrl);
  const url = asString(record.url);
  if (!login || !avatarUrl || !url) return null;
  return {
    login,
    avatarUrl,
    url,
    name: asString(record.name),
    bio: asString(record.bio),
    company: asString(record.company),
    location: asString(record.location),
  };
}

function normalizeParticipants(input: {
  author: GitHubUserPreview | null;
  participants: unknown[];
  reviewRequests: unknown[];
}): PrReviewParticipant[] {
  const entries: PrReviewParticipant[] = [];
  const seen = new Set<string>();

  const add = (user: GitHubUserPreview | null, role: PrReviewParticipant["role"]) => {
    if (!user) return;
    const key = `${user.login}:${role}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ user, role });
  };

  add(input.author, "author");
  for (const participant of input.participants) {
    add(normalizeUser(participant), "participant");
  }
  for (const participant of input.reviewRequests) {
    add(normalizeUser(participant), "requestedReviewer");
  }

  return entries;
}

function normalizeComment(raw: unknown): PrReviewComment | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const id = asString(record.id);
  const body = typeof record.body === "string" ? record.body : "";
  const createdAt = asString(record.createdAt);
  const updatedAt = asString(record.updatedAt);
  if (!id || !createdAt || !updatedAt) return null;
  const replyTo =
    record.replyTo && typeof record.replyTo === "object"
      ? asString((record.replyTo as Record<string, unknown>).id)
      : null;
  return {
    id,
    databaseId: asPositiveInt(record.databaseId),
    body,
    createdAt,
    updatedAt,
    url: asString(record.url),
    author: normalizeUser(record.author),
    replyToId: replyTo,
    path: asString(record.path),
    line: asPositiveInt(record.line),
    originalLine: asPositiveInt(record.originalLine),
    startLine: asPositiveInt(record.startLine),
    side: null,
    startSide: null,
    diffHunk: asString(record.diffHunk),
  };
}

function buildSyntheticPatch(file: {
  path: string;
  previousPath: string | null;
  status: string;
  patch: string | null;
}): string | null {
  if (!file.patch) return null;
  const currentPath = file.path.replaceAll("\\", "/");
  const previousPath = (file.previousPath ?? file.path).replaceAll("\\", "/");

  // The diff --git header MUST always use a/ and b/ prefixes for the parser
  // (@pierre/diffs ALTERNATE_FILE_NAMES_GIT regex requires this format).
  // /dev/null is only valid in the --- and +++ lines.
  const gitHeaderA = `a/${previousPath}`;
  const gitHeaderB = `b/${currentPath}`;

  const headerOld = file.status === "added" ? "/dev/null" : `a/${previousPath}`;
  const headerNew = file.status === "removed" ? "/dev/null" : `b/${currentPath}`;

  const lines = [`diff --git ${gitHeaderA} ${gitHeaderB}`];
  if (file.status === "added") lines.push("new file mode 100644");
  if (file.status === "removed") lines.push("deleted file mode 100644");
  lines.push(`--- ${headerOld}`, `+++ ${headerNew}`, file.patch);

  return lines.join("\n");
}

function normalizeStatusChecks(raw: unknown): PrReviewSummary["statusChecks"] {
  if (!Array.isArray(raw)) return [];
  const statusChecks: PrReviewSummary["statusChecks"][number][] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const name = asString(record.name) ?? asString(record.context);
    const status = asString(record.status) ?? asString(record.state);
    if (!name || !status) continue;
    statusChecks.push({
      name,
      status,
      conclusion: asString(record.conclusion),
      detailsUrl: asString(record.detailsUrl) ?? asString(record.targetUrl),
    });
  }
  return statusChecks;
}

function normalizeDashboardResponse(
  raw: unknown,
): Pick<PrReviewDashboardResult, "pullRequest" | "threads"> {
  const root = raw as {
    data?: {
      repository?: {
        pullRequest?: Record<string, unknown>;
      };
    };
  };
  const pullRequest = root.data?.repository?.pullRequest;
  if (!pullRequest) {
    throw new Error("Pull request dashboard payload was empty.");
  }

  const author = normalizeUser(pullRequest.author);
  const participants = Array.isArray((pullRequest.participants as any)?.nodes)
    ? ((pullRequest.participants as any).nodes as unknown[])
    : [];
  const reviewRequests = Array.isArray((pullRequest.reviewRequests as any)?.nodes)
    ? ((pullRequest.reviewRequests as any).nodes as unknown[])
        .map((entry) =>
          entry && typeof entry === "object"
            ? (entry as Record<string, unknown>).requestedReviewer
            : null,
        )
        .filter((entry) => entry !== null)
    : [];
  const labels = Array.isArray((pullRequest.labels as any)?.nodes)
    ? ((pullRequest.labels as any).nodes as unknown[])
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const record = entry as Record<string, unknown>;
          const name = asString(record.name);
          if (!name) return null;
          return { name, color: typeof record.color === "string" ? record.color : "" };
        })
        .filter((entry): entry is { name: string; color: string } => entry !== null)
    : [];
  const statusChecks = normalizeStatusChecks(
    ((pullRequest.commits as any)?.nodes?.[0] as any)?.commit?.statusCheckRollup?.contexts?.nodes ??
      [],
  );

  const threads = Array.isArray((pullRequest.reviewThreads as any)?.nodes)
    ? ((pullRequest.reviewThreads as any).nodes as unknown[])
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const record = entry as Record<string, unknown>;
          const id = asString(record.id);
          if (!id) return null;
          const comments = Array.isArray((record.comments as any)?.nodes)
            ? ((record.comments as any).nodes as unknown[])
                .map(normalizeComment)
                .filter((comment): comment is PrReviewComment => comment !== null)
            : [];
          return {
            id,
            path: asString(record.path),
            line: asPositiveInt(record.line),
            originalLine: asPositiveInt(record.originalLine),
            startLine: asPositiveInt(record.startLine),
            side: asString(record.diffSide),
            startSide: asString(record.startDiffSide),
            isResolved: Boolean(record.isResolved),
            isOutdated: Boolean(record.isOutdated),
            state: record.isResolved ? "resolved" : record.isOutdated ? "outdated" : "open",
            comments,
          } as PrReviewDashboardResult["threads"][number];
        })
        .filter((thread): thread is PrReviewDashboardResult["threads"][number] => thread !== null)
    : [];

  const summary: PrReviewSummary = {
    id: asString(pullRequest.id) ?? `pr-${pullRequest.number}`,
    number: asPositiveInt(pullRequest.number) ?? 1,
    title: asString(pullRequest.title) ?? "Untitled pull request",
    body: typeof pullRequest.body === "string" ? pullRequest.body : "",
    url: asString(pullRequest.url) ?? "",
    state: asString(pullRequest.state) ?? "OPEN",
    isDraft: Boolean(pullRequest.isDraft),
    mergeable: asString(pullRequest.mergeable),
    mergeStateStatus: asString(pullRequest.mergeStateStatus),
    reviewDecision: asString(pullRequest.reviewDecision),
    baseBranch: asString(pullRequest.baseRefName) ?? "main",
    headBranch: asString(pullRequest.headRefName) ?? "HEAD",
    author,
    labels,
    statusChecks,
    participants: normalizeParticipants({ author, participants, reviewRequests }),
    reviewRequests: reviewRequests
      .map((entry) => normalizeUser(entry))
      .filter((entry): entry is GitHubUserPreview => entry !== null)
      .map((user) => ({ user, role: "requestedReviewer" as const })),
    totalThreadCount: threads.length,
    unresolvedThreadCount: threads.filter((thread) => !thread.isResolved).length,
    headSha: asString(pullRequest.headRefOid),
    baseSha: asString(pullRequest.baseRefOid),
  };

  return { pullRequest: summary, threads };
}

function normalizeFilesResponse(raw: unknown): PrReviewFile[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const pathValue = asString(record.filename);
      if (!pathValue) return null;
      return {
        path: pathValue,
        additions:
          typeof record.additions === "number" && record.additions >= 0 ? record.additions : 0,
        deletions:
          typeof record.deletions === "number" && record.deletions >= 0 ? record.deletions : 0,
        changeType: asString(record.status)?.toUpperCase() ?? "MODIFIED",
        patch: buildSyntheticPatch({
          path: pathValue,
          previousPath: asString(record.previous_filename),
          status: asString(record.status) ?? "modified",
          patch: typeof record.patch === "string" ? record.patch : null,
        }),
      } satisfies PrReviewFile;
    })
    .filter((entry): entry is PrReviewFile => entry !== null);
}

const makePrReview = Effect.gen(function* () {
  const gitHubCli = yield* GitHubCli;
  const repoReviewConfig = yield* RepoReviewConfig;
  const projection = yield* PrReviewProjection;
  const workflowEngine = yield* WorkflowEngine;
  const mergeConflictResolver = yield* MergeConflictResolver;

  const executeJson = <T>(input: {
    cwd: string;
    args: readonly string[];
    operation: string;
  }): Effect.Effect<T, PrReviewServiceError> =>
    gitHubCli
      .execute({
        cwd: input.cwd,
        args: input.args,
        timeoutMs: 30_000,
      })
      .pipe(
        Effect.flatMap((result) =>
          Effect.try({
            try: () => JSON.parse(result.stdout) as T,
            catch: (cause) =>
              new PrReviewError({
                operation: input.operation,
                detail: "GitHub returned invalid JSON.",
                cause,
              }),
          }),
        ),
      );

  const getRepoNameWithOwner = (cwd: string): Effect.Effect<string, PrReviewServiceError> =>
    executeJson<{ nameWithOwner?: string }>({
      cwd,
      args: ["repo", "view", "--json", "nameWithOwner"],
      operation: "getRepoNameWithOwner",
    }).pipe(
      Effect.flatMap((result) => {
        const nameWithOwner = asString(result.nameWithOwner);
        if (!nameWithOwner || !nameWithOwner.includes("/")) {
          return Effect.fail(
            new PrReviewError({
              operation: "getRepoNameWithOwner",
              detail: "Could not determine the current GitHub repository.",
            }),
          );
        }
        return Effect.succeed(nameWithOwner);
      }),
    );

  const getRepoOwnerAndName = (cwd: string): Effect.Effect<RepoRef, PrReviewServiceError> =>
    getRepoNameWithOwner(cwd).pipe(
      Effect.flatMap((nameWithOwner) => {
        const [owner, name] = nameWithOwner.split("/");
        if (!owner || !name) {
          return Effect.fail(
            new PrReviewError({
              operation: "getRepoOwnerAndName",
              detail: `Invalid GitHub repository name: ${nameWithOwner}`,
            }),
          );
        }
        return Effect.succeed({ owner, name, nameWithOwner });
      }),
    );

  const fetchDashboardBase = (
    input: PrReviewDashboardInput,
  ): Effect.Effect<DashboardBase, PrReviewServiceError> =>
    Effect.gen(function* () {
      const repo = yield* getRepoOwnerAndName(input.cwd);
      const dashboardRaw = yield* executeJson<unknown>({
        cwd: input.cwd,
        args: [
          "api",
          "graphql",
          "-f",
          `owner=${repo.owner}`,
          "-f",
          `name=${repo.name}`,
          "-F",
          `number=${input.prNumber}`,
          "-f",
          `query=${DASHBOARD_QUERY}`,
        ],
        operation: "getDashboard",
      });
      const dashboard = normalizeDashboardResponse(dashboardRaw);
      const filesRaw = yield* executeJson<unknown>({
        cwd: input.cwd,
        args: ["api", `repos/${repo.nameWithOwner}/pulls/${input.prNumber}/files?per_page=100`],
        operation: "getPatchFiles",
      });
      return {
        repo,
        pullRequest: dashboard.pullRequest,
        threads: dashboard.threads,
        files: normalizeFilesResponse(filesRaw),
      };
    });

  const resolveWorkflowSteps = (input: {
    cwd: string;
    prNumber: number;
    config: PrReviewConfig;
    pullRequest: PrReviewSummary;
    conflicts: PrConflictAnalysis;
  }): Effect.Effect<PrReviewDashboardResult["workflowSteps"], PrReviewServiceError> =>
    Effect.gen(function* () {
      const overrides = yield* projection.listWorkflowStatuses({
        cwd: input.cwd,
        prNumber: input.prNumber,
      });
      return yield* workflowEngine.resolveSteps({
        config: input.config,
        dashboard: { pullRequest: input.pullRequest },
        conflicts: input.conflicts,
        overrides,
      });
    });

  const refreshDashboard = (
    input: PrReviewDashboardInput,
  ): Effect.Effect<PrReviewDashboardResult, PrReviewServiceError> =>
    Effect.gen(function* () {
      const config = yield* repoReviewConfig.getConfig({ cwd: input.cwd });
      const base = yield* fetchDashboardBase(input);
      const conflicts = yield* mergeConflictResolver.analyze({
        cwd: input.cwd,
        pullRequest: base.pullRequest,
      });
      const workflowSteps = yield* resolveWorkflowSteps({
        cwd: input.cwd,
        prNumber: input.prNumber,
        config,
        pullRequest: base.pullRequest,
        conflicts,
      });

      return {
        pullRequest: base.pullRequest,
        files: base.files,
        threads: base.threads,
        workflowSteps,
        readOnlyReason: null,
      } satisfies PrReviewDashboardResult;
    });

  const createDashboardMutationResult = (
    cwd: string,
    prNumber: number,
  ): Effect.Effect<PrReviewDashboardResult, PrReviewServiceError> =>
    refreshDashboard({ cwd, prNumber });

  const withRepo = <A>(
    cwd: string,
    f: (repo: {
      owner: string;
      name: string;
      nameWithOwner: string;
    }) => Effect.Effect<A, PrReviewServiceError>,
  ): Effect.Effect<A, PrReviewServiceError> => getRepoOwnerAndName(cwd).pipe(Effect.flatMap(f));

  const service: PrReviewShape = {
    getConfig: ({ cwd }) => repoReviewConfig.getConfig({ cwd }),
    watchRepoConfig: ({ cwd, onChange }) => repoReviewConfig.watchRepo({ cwd, onChange }),
    getDashboard: refreshDashboard,
    getPatch: (input: PrReviewPatchInput) =>
      fetchDashboardBase({ cwd: input.cwd, prNumber: input.prNumber }).pipe(
        Effect.map(({ files }) => ({
          pullRequestNumber: input.prNumber,
          combinedPatch: files
            .map((file) => file.patch)
            .filter((patch): patch is string => patch !== null && patch.length > 0)
            .join("\n\n"),
          files,
        })),
      ),
    addThread: (input: PrReviewAddThreadInput) =>
      Effect.gen(function* () {
        const base = yield* fetchDashboardBase({ cwd: input.cwd, prNumber: input.prNumber });
        if (!base.pullRequest.headSha) {
          return yield* new PrReviewError({
            operation: "addThread",
            detail: "Cannot create a review thread because the PR head SHA is unavailable.",
          });
        }
        yield* withRepo(input.cwd, (repo) =>
          executeJson({
            cwd: input.cwd,
            args: [
              "api",
              "-X",
              "POST",
              `repos/${repo.nameWithOwner}/pulls/${input.prNumber}/comments`,
              "-f",
              `body=${input.body}`,
              "-f",
              `path=${input.path}`,
              "-F",
              `line=${input.line}`,
              "-f",
              `side=${input.side ?? "RIGHT"}`,
              "-f",
              `commit_id=${base.pullRequest.headSha}`,
              ...(input.startLine ? ["-F", `start_line=${input.startLine}`] : []),
              ...(input.startSide ? ["-f", `start_side=${input.startSide}`] : []),
            ],
            operation: "addThread",
          }).pipe(Effect.asVoid),
        );
        return yield* createDashboardMutationResult(input.cwd, input.prNumber);
      }),
    replyToThread: (input: PrReviewReplyToThreadInput) =>
      Effect.gen(function* () {
        const dashboard = yield* refreshDashboard({ cwd: input.cwd, prNumber: input.prNumber });
        const thread = dashboard.threads.find((entry) => entry.id === input.threadId);
        const targetCommentId = [...(thread?.comments ?? [])]
          .toReversed()
          .find((comment) => comment.databaseId !== null)?.databaseId;
        if (!thread || targetCommentId === undefined || targetCommentId === null) {
          return yield* new PrReviewError({
            operation: "replyToThread",
            detail: `Review thread not found: ${input.threadId}`,
          });
        }
        yield* withRepo(input.cwd, (repo) =>
          executeJson({
            cwd: input.cwd,
            args: [
              "api",
              "-X",
              "POST",
              `repos/${repo.nameWithOwner}/pulls/comments/${targetCommentId}/replies`,
              "-f",
              `body=${input.body}`,
            ],
            operation: "replyToThread",
          }).pipe(Effect.asVoid),
        );
        return yield* createDashboardMutationResult(input.cwd, input.prNumber);
      }),
    resolveThread: (input: PrReviewResolveThreadInput) =>
      Effect.gen(function* () {
        yield* executeJson({
          cwd: input.cwd,
          args: [
            "api",
            "graphql",
            "-f",
            `threadId=${input.threadId}`,
            "-f",
            "query=mutation ResolveReviewThread($threadId: ID!) { resolveReviewThread(input: { threadId: $threadId }) { thread { id isResolved } } }",
          ],
          operation: "resolveThread",
        }).pipe(Effect.asVoid);
        return yield* createDashboardMutationResult(input.cwd, input.prNumber);
      }),
    unresolveThread: (input: PrReviewResolveThreadInput) =>
      Effect.gen(function* () {
        yield* executeJson({
          cwd: input.cwd,
          args: [
            "api",
            "graphql",
            "-f",
            `threadId=${input.threadId}`,
            "-f",
            "query=mutation UnresolveReviewThread($threadId: ID!) { unresolveReviewThread(input: { threadId: $threadId }) { thread { id isResolved } } }",
          ],
          operation: "unresolveThread",
        }).pipe(Effect.asVoid);
        return yield* createDashboardMutationResult(input.cwd, input.prNumber);
      }),
    searchUsers: (input: PrReviewSearchUsersInput) =>
      withRepo(input.cwd, (repo) =>
        executeJson<{ items?: unknown[] }>({
          cwd: input.cwd,
          args: [
            "api",
            "search/users",
            "-f",
            `q=${input.query} repo:${repo.nameWithOwner}`,
            "-F",
            `per_page=${input.limit ?? 10}`,
          ],
          operation: "searchUsers",
        }).pipe(
          Effect.map((raw) => {
            const users: GitHubUserPreview[] = [];
            for (const entry of raw.items ?? []) {
              if (!entry || typeof entry !== "object") continue;
              const record = entry as Record<string, unknown>;
              const login = asString(record.login);
              const avatarUrl = asString(record.avatar_url);
              const url = asString(record.html_url);
              if (!login || !avatarUrl || !url) continue;
              users.push({
                login,
                avatarUrl,
                url,
                name: null,
                bio: null,
                company: null,
                location: null,
              });
            }
            return { users } satisfies PrReviewSearchUsersResult;
          }),
        ),
      ),
    getUserPreview: (input: PrReviewUserPreviewInput) =>
      executeJson<Record<string, unknown>>({
        cwd: input.cwd,
        args: ["api", `users/${input.login}`],
        operation: "getUserPreview",
      }).pipe(
        Effect.map((raw) => ({
          login: asString(raw.login) ?? input.login,
          avatarUrl: asString(raw.avatar_url) ?? "",
          url: asString(raw.html_url) ?? "",
          name: asString(raw.name),
          bio: asString(raw.bio),
          company: asString(raw.company),
          location: asString(raw.location),
        })),
      ),
    analyzeConflicts: (input: PrReviewDashboardInput) =>
      fetchDashboardBase(input).pipe(
        Effect.flatMap(({ pullRequest }) =>
          mergeConflictResolver.analyze({
            cwd: input.cwd,
            pullRequest,
          }),
        ),
      ),
    applyConflictResolution: (input) =>
      fetchDashboardBase({ cwd: input.cwd, prNumber: input.prNumber }).pipe(
        Effect.flatMap(({ pullRequest }) =>
          mergeConflictResolver.apply({
            cwd: input.cwd,
            pullRequest,
            candidateId: input.candidateId,
          }),
        ),
      ),
    runWorkflowStep: (input) =>
      Effect.gen(function* () {
        const config = yield* repoReviewConfig.getConfig({ cwd: input.cwd });
        const workflow =
          config.workflows.find((entry) => entry.id === config.defaultWorkflowId) ??
          config.workflows[0];
        const step = workflow?.steps.find((entry) => entry.id === input.stepId);
        if (!step) {
          return yield* new PrReviewError({
            operation: "runWorkflowStep",
            detail: `Workflow step not found: ${input.stepId}`,
          });
        }

        let status: PrWorkflowStepRunResult["status"] = "done";
        let summary = step.successMessage ?? `${step.title} completed.`;

        if (step.kind === "conflictAnalysis") {
          const conflicts = yield* service.analyzeConflicts({
            cwd: input.cwd,
            prNumber: input.prNumber,
          });
          status =
            conflicts.status === "clean"
              ? "done"
              : conflicts.status === "conflicted"
                ? "blocked"
                : "todo";
          summary = conflicts.summary;
        } else if (step.kind === "reviewAction") {
          status = "blocked";
          summary = "Submit a review from the action rail to complete this step.";
        } else if (step.kind === "skillSet" && step.skillSet) {
          summary = `Skill set ${step.skillSet} is ready to run.`;
        }

        const result: PrWorkflowStepRunResult = {
          stepId: step.id,
          status,
          summary,
          requiresConfirmation: step.requiresConfirmation,
        };
        yield* projection.upsertWorkflowStatus({
          cwd: input.cwd,
          prNumber: input.prNumber,
          status: result,
        });
        return result;
      }),
    submitReview: (input: PrSubmitReviewInput) =>
      withRepo(input.cwd, (repo) =>
        executeJson({
          cwd: input.cwd,
          args: [
            "api",
            "-X",
            "POST",
            `repos/${repo.nameWithOwner}/pulls/${input.prNumber}/reviews`,
            "-f",
            `event=${input.event}`,
            "-f",
            `body=${input.body}`,
          ],
          operation: "submitReview",
        }).pipe(
          Effect.map(
            () =>
              ({
                submitted: true,
                event: input.event,
                summary: `Submitted ${input.event.toLowerCase().replaceAll("_", " ")} review.`,
              }) satisfies PrSubmitReviewResult,
          ),
        ),
      ),
  };

  return service;
});

export const PrReviewLive = Layer.effect(PrReview, makePrReview);
