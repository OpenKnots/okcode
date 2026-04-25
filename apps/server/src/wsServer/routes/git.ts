import { WS_CHANNELS, WS_METHODS } from "@okcode/contracts";
import { Effect } from "effect";

import { RuntimeEnv } from "../../runtimeEnvironment.ts";
import type { WebSocketRouteRegistry } from "./shared";
import { stripTaggedBody } from "./shared";

export function createGitRouteHandlers(input: {
  projectionReadModelQuery: {
    getSnapshot: () => Effect.Effect<any, unknown, unknown>;
  };
  resolveRuntimeEnvironment: (input: {
    cwd: string;
    readModel: unknown;
  }) => Effect.Effect<any, unknown, unknown>;
  git: {
    syncCurrentBranch: (cwd: string) => Effect.Effect<unknown, unknown, unknown>;
    execute: (input: {
      operation: string;
      cwd: string;
      args: readonly string[];
      timeoutMs: number;
      allowNonZeroExit?: boolean;
    }) => Effect.Effect<{ stdout: string }, unknown, unknown>;
    listBranches: (input: unknown) => Effect.Effect<unknown, unknown, unknown>;
    createWorktree: (input: unknown) => Effect.Effect<unknown, unknown, unknown>;
    removeWorktree: (input: unknown) => Effect.Effect<unknown, unknown, unknown>;
    createBranch: (input: unknown) => Effect.Effect<unknown, unknown, unknown>;
    checkoutBranch: (input: unknown) => Effect.Effect<unknown, unknown, unknown>;
    initRepo: (input: unknown) => Effect.Effect<unknown, unknown, unknown>;
    cloneRepository: (input: unknown) => Effect.Effect<unknown, unknown, unknown>;
  };
  gitManagerLoader: Effect.Effect<any, unknown, unknown>;
  runTrackedGitRequest: (
    ws: any,
    handle: { kind: "pull" | "stacked_action"; cwd: string; actionId?: string },
    effect: Effect.Effect<unknown, unknown, unknown>,
    interruptedMessage: string,
  ) => Effect.Effect<unknown, unknown, unknown>;
  stopActiveGitRequest: (ws: any, body: unknown) => Effect.Effect<void, unknown, unknown>;
  pushBus: {
    publishClient: (
      ws: any,
      channel: string,
      payload: unknown,
    ) => Effect.Effect<unknown, unknown, unknown>;
  };
  collectMergedWorktreeCleanupCandidates: (input: {
    cwd: string;
    worktreeListStdout: string;
    mergedPullRequests: ReadonlyArray<{
      number: number;
      title: string;
      url: string;
      headBranch: string;
      mergedAt: string | null;
    }>;
  }) => unknown;
}): WebSocketRouteRegistry {
  const withGitEnv = (
    body: { cwd: string },
    effect: (gitEnv: any) => Effect.Effect<unknown, unknown, unknown>,
  ) =>
    Effect.gen(function* () {
      const snapshot = yield* input.projectionReadModelQuery.getSnapshot();
      const gitEnv = yield* input.resolveRuntimeEnvironment({ cwd: body.cwd, readModel: snapshot });
      return yield* effect(gitEnv);
    });

  return {
    [WS_METHODS.gitStatus]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        return yield* withGitEnv(body, (gitEnv) =>
          Effect.gen(function* () {
            const gitManager = yield* input.gitManagerLoader;
            return yield* gitManager.status(body).pipe(Effect.provideService(RuntimeEnv, gitEnv));
          }),
        );
      }),

    [WS_METHODS.gitPull]: (ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        return yield* withGitEnv(body, (gitEnv) =>
          input.runTrackedGitRequest(
            ws,
            { kind: "pull", cwd: body.cwd },
            input.git.syncCurrentBranch(body.cwd).pipe(Effect.provideService(RuntimeEnv, gitEnv)),
            "Git pull stopped.",
          ),
        );
      }),

    [WS_METHODS.gitStopAction]: (ws, request) =>
      Effect.gen(function* () {
        yield* input.stopActiveGitRequest(ws, stripTaggedBody(request.body as any) as any);
        return {};
      }),

    [WS_METHODS.gitRunStackedAction]: (ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        return yield* withGitEnv(body, (gitEnv) =>
          Effect.gen(function* () {
            const gitManager = yield* input.gitManagerLoader;
            return yield* input.runTrackedGitRequest(
              ws,
              { kind: "stacked_action", cwd: body.cwd, actionId: body.actionId },
              gitManager
                .runStackedAction(body, {
                  actionId: body.actionId,
                  progressReporter: {
                    publish: (event: unknown) =>
                      input.pushBus
                        .publishClient(ws, WS_CHANNELS.gitActionProgress, event)
                        .pipe(Effect.asVoid),
                  },
                })
                .pipe(Effect.provideService(RuntimeEnv, gitEnv)),
              "Git action stopped.",
            );
          }),
        );
      }),

    [WS_METHODS.gitResolvePullRequest]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        return yield* withGitEnv(body, (gitEnv) =>
          Effect.gen(function* () {
            const gitManager = yield* input.gitManagerLoader;
            return yield* gitManager
              .resolvePullRequest(body)
              .pipe(Effect.provideService(RuntimeEnv, gitEnv));
          }),
        );
      }),

    [WS_METHODS.gitPreparePullRequestThread]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        return yield* withGitEnv(body, (gitEnv) =>
          Effect.gen(function* () {
            const gitManager = yield* input.gitManagerLoader;
            return yield* gitManager
              .preparePullRequestThread(body)
              .pipe(Effect.provideService(RuntimeEnv, gitEnv));
          }),
        );
      }),

    [WS_METHODS.gitListPullRequests]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        return yield* withGitEnv(body, (gitEnv) =>
          Effect.gen(function* () {
            const gitManager = yield* input.gitManagerLoader;
            return yield* gitManager
              .listPullRequests(body)
              .pipe(Effect.provideService(RuntimeEnv, gitEnv));
          }),
        );
      }),

    [WS_METHODS.gitListMergedWorktreeCleanupCandidates]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        return yield* withGitEnv(body, (gitEnv) =>
          Effect.gen(function* () {
            const gitManager = yield* input.gitManagerLoader;
            const mergedPullRequests = yield* gitManager
              .listPullRequests({
                cwd: body.cwd,
                state: "merged",
                limit: 500,
              })
              .pipe(Effect.provideService(RuntimeEnv, gitEnv));
            const worktreeList = yield* input.git
              .execute({
                operation: "GitCore.listMergedWorktreeCleanupCandidates.worktreeList",
                cwd: body.cwd,
                args: ["worktree", "list", "--porcelain"],
                timeoutMs: 5_000,
                allowNonZeroExit: true,
              })
              .pipe(Effect.provideService(RuntimeEnv, gitEnv));

            return input.collectMergedWorktreeCleanupCandidates({
              cwd: body.cwd,
              worktreeListStdout: worktreeList.stdout,
              mergedPullRequests: mergedPullRequests.pullRequests.map((pr: any) => ({
                number: pr.number,
                title: pr.title,
                url: pr.url,
                headBranch: pr.headBranch,
                mergedAt: pr.updatedAt,
              })),
            });
          }),
        );
      }),

    [WS_METHODS.gitListBranches]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        return yield* withGitEnv(body, (gitEnv) =>
          input.git.listBranches(body).pipe(Effect.provideService(RuntimeEnv, gitEnv)),
        );
      }),

    [WS_METHODS.gitCreateWorktree]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        return yield* withGitEnv(body, (gitEnv) =>
          input.git.createWorktree(body).pipe(Effect.provideService(RuntimeEnv, gitEnv)),
        );
      }),

    [WS_METHODS.gitRemoveWorktree]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        return yield* withGitEnv(body, (gitEnv) =>
          input.git.removeWorktree(body).pipe(Effect.provideService(RuntimeEnv, gitEnv)),
        );
      }),

    [WS_METHODS.gitPruneWorktrees]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        return yield* withGitEnv(body, (gitEnv) =>
          input.git
            .execute({
              operation: "GitCore.pruneWorktrees",
              cwd: body.cwd,
              args: ["worktree", "prune", "--expire", "now"],
              timeoutMs: 15_000,
            })
            .pipe(Effect.provideService(RuntimeEnv, gitEnv), Effect.asVoid),
        );
      }),

    [WS_METHODS.gitCreateBranch]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        return yield* withGitEnv(body, (gitEnv) =>
          Effect.scoped(input.git.createBranch(body)).pipe(
            Effect.provideService(RuntimeEnv, gitEnv),
          ),
        );
      }),

    [WS_METHODS.gitCheckout]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        return yield* withGitEnv(body, (gitEnv) =>
          Effect.scoped(input.git.checkoutBranch(body)).pipe(
            Effect.provideService(RuntimeEnv, gitEnv),
          ),
        );
      }),

    [WS_METHODS.gitInit]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        return yield* withGitEnv(body, (gitEnv) =>
          input.git.initRepo(body).pipe(Effect.provideService(RuntimeEnv, gitEnv)),
        );
      }),

    [WS_METHODS.gitCloneRepository]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any);
        const snapshot = yield* input.projectionReadModelQuery.getSnapshot();
        const gitEnv = yield* input.resolveRuntimeEnvironment({
          cwd: body.targetDir,
          readModel: snapshot,
        });
        return yield* input.git
          .cloneRepository(body)
          .pipe(Effect.provideService(RuntimeEnv, gitEnv));
      }),
  };
}
