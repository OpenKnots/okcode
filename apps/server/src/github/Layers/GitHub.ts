/**
 * GitHub Layer - Implementation of the GitHub issue service using the `gh` CLI.
 *
 * Delegates all GitHub CLI interactions to the existing GitHubCli service.
 */
import { Effect, Layer, Schema } from "effect";
import type {
  GitHubGetIssueResult,
  GitHubIssueComment,
  GitHubIssueDetail,
  GitHubIssueSummary,
  GitHubListIssuesResult,
  GitHubPostCommentResult,
} from "@okcode/contracts";
import { GitHubCli } from "../../git/Services/GitHubCli.ts";
import { GitHubServiceError } from "../Errors.ts";
import { GitHub, type GitHubShape } from "../Services/GitHub.ts";

// ── Raw CLI output schemas ──────────────────────────────────────────

const RawIssueLabel = Schema.Struct({
  name: Schema.String,
  color: Schema.optional(Schema.String),
});

const RawIssueAuthor = Schema.Struct({
  login: Schema.String,
  avatarUrl: Schema.optional(Schema.String),
  url: Schema.optional(Schema.String),
  name: Schema.optional(Schema.NullOr(Schema.String)),
});

const RawIssueSummary = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  state: Schema.String,
  labels: Schema.Array(RawIssueLabel),
  author: Schema.NullOr(RawIssueAuthor),
  url: Schema.String,
  updatedAt: Schema.String,
});

const RawIssueComment = Schema.Struct({
  id: Schema.String,
  body: Schema.String,
  author: Schema.NullOr(RawIssueAuthor),
  createdAt: Schema.String,
  url: Schema.optional(Schema.NullOr(Schema.String)),
});

const RawIssueDetail = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  state: Schema.String,
  body: Schema.String,
  labels: Schema.Array(RawIssueLabel),
  author: Schema.NullOr(RawIssueAuthor),
  assignees: Schema.Array(RawIssueAuthor),
  comments: Schema.Array(RawIssueComment),
  milestone: Schema.optional(Schema.NullOr(Schema.Struct({ title: Schema.String }))),
  url: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

// ── Normalization helpers ───────────────────────────────────────────

function normalizeAuthor(
  raw: Schema.Schema.Type<typeof RawIssueAuthor> | null,
): GitHubIssueSummary["author"] {
  if (!raw) return null;
  return {
    login: raw.login as any,
    avatarUrl: raw.avatarUrl ?? "",
    url: raw.url ?? `https://github.com/${raw.login}`,
    name: raw.name ?? null,
    bio: null,
    company: null,
    location: null,
  };
}

function normalizeIssueSummary(
  raw: Schema.Schema.Type<typeof RawIssueSummary>,
): GitHubIssueSummary {
  return {
    number: raw.number as any,
    title: raw.title as any,
    state: raw.state.toLowerCase() === "closed" ? "closed" : ("open" as any),
    labels: raw.labels.map((l) => ({ name: l.name as any, color: l.color ?? "" })),
    author: normalizeAuthor(raw.author),
    url: raw.url,
    updatedAt: raw.updatedAt,
  };
}

function normalizeIssueComment(
  raw: Schema.Schema.Type<typeof RawIssueComment>,
): GitHubIssueComment {
  return {
    id: raw.id as any,
    body: raw.body,
    author: normalizeAuthor(raw.author),
    createdAt: raw.createdAt,
    url: raw.url ?? null,
  };
}

function normalizeIssueDetail(raw: Schema.Schema.Type<typeof RawIssueDetail>): GitHubIssueDetail {
  return {
    number: raw.number as any,
    title: raw.title as any,
    state: raw.state.toLowerCase() === "closed" ? "closed" : ("open" as any),
    body: raw.body,
    labels: raw.labels.map((l) => ({ name: l.name as any, color: l.color ?? "" })),
    author: normalizeAuthor(raw.author),
    assignees: raw.assignees.map((a) => normalizeAuthor(a)!).filter(Boolean) as any,
    comments: raw.comments.map(normalizeIssueComment),
    milestone: raw.milestone?.title ?? null,
    url: raw.url,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    commentsCount: raw.comments.length as any,
  };
}

// ── Helper: parse JSON from gh CLI output ───────────────────────────

function decodeGhJson<S extends Schema.Top>(
  raw: string,
  schema: S,
  operation: string,
  invalidDetail: string,
): Effect.Effect<S["Type"], GitHubServiceError, S["DecodingServices"]> {
  return Schema.decodeEffect(Schema.fromJsonString(schema))(raw).pipe(
    Effect.mapError(
      (error) =>
        new GitHubServiceError({
          operation,
          detail: error instanceof Error ? `${invalidDetail}: ${error.message}` : invalidDetail,
          cause: error,
        }),
    ),
  );
}

// ── Layer implementation ────────────────────────────────────────────

const makeGitHub = Effect.gen(function* () {
  const gitHubCli = yield* GitHubCli;

  const listIssues: GitHubShape["listIssues"] = (input) =>
    Effect.gen(function* () {
      const args: string[] = [
        "issue",
        "list",
        "--json",
        "number,title,state,labels,author,url,updatedAt",
        "--limit",
        String(input.limit ?? 10),
      ];
      if (input.assignee) {
        args.push("--assignee", input.assignee);
      }
      if (input.state) {
        args.push("--state", input.state);
      }
      if (input.labels) {
        args.push("--label", input.labels);
      }

      const result = yield* gitHubCli.execute({ cwd: input.cwd, args });
      const raw = yield* decodeGhJson(
        result.stdout,
        Schema.Array(RawIssueSummary),
        "listIssues",
        "Failed to parse issue list output",
      );
      return { issues: raw.map(normalizeIssueSummary) } satisfies GitHubListIssuesResult;
    });

  const getIssue: GitHubShape["getIssue"] = (input) =>
    Effect.gen(function* () {
      const result = yield* gitHubCli.execute({
        cwd: input.cwd,
        args: [
          "issue",
          "view",
          String(input.number),
          "--json",
          "number,title,state,body,labels,author,assignees,comments,milestone,url,createdAt,updatedAt",
        ],
      });
      const raw = yield* decodeGhJson(
        result.stdout,
        RawIssueDetail,
        "getIssue",
        "Failed to parse issue detail output",
      );
      return { issue: normalizeIssueDetail(raw) } satisfies GitHubGetIssueResult;
    });

  const postComment: GitHubShape["postComment"] = (input) =>
    Effect.gen(function* () {
      const result = yield* gitHubCli.execute({
        cwd: input.cwd,
        args: ["issue", "comment", String(input.issueNumber), "--body", input.body],
      });
      // gh issue comment outputs the comment URL on success
      const url = result.stdout.trim() || "";
      return { url } satisfies GitHubPostCommentResult;
    });

  const service = { listIssues, getIssue, postComment } satisfies GitHubShape;
  return service;
});

export const GitHubLive = Layer.effect(GitHub, makeGitHub);
