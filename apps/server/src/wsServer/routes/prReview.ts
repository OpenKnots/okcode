import { WS_CHANNELS, WS_METHODS } from "@okcode/contracts";
import { Effect } from "effect";

import type { WebSocketRouteRegistry } from "./shared";
import { stripTaggedBody } from "./shared";

export function createPrReviewRouteHandlers(input: {
  prReviewLoader: Effect.Effect<any, unknown, never>;
  pushBus: {
    publishAll: (channel: string, payload: unknown) => Effect.Effect<unknown, unknown, never>;
  };
}): WebSocketRouteRegistry {
  const publishSyncUpdated = (body: { cwd: string; prNumber: number }) =>
    input.pushBus.publishAll(WS_CHANNELS.prReviewSyncUpdated, {
      cwd: body.cwd,
      prNumber: body.prNumber,
    });

  const watchRepoConfig = (prReview: any, cwd: string) =>
    prReview
      .watchRepoConfig({
        cwd,
        onChange: (payload: unknown) => {
          void Effect.runPromise(
            input.pushBus.publishAll(WS_CHANNELS.prReviewRepoConfigUpdated, payload),
          );
        },
      })
      .pipe(Effect.ignoreCause({ log: true }));

  return {
    [WS_METHODS.prReviewGetConfig]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        const prReview = yield* input.prReviewLoader;
        yield* watchRepoConfig(prReview, body.cwd);
        return yield* prReview.getConfig(body);
      }),

    [WS_METHODS.prReviewGetDashboard]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        const prReview = yield* input.prReviewLoader;
        yield* watchRepoConfig(prReview, body.cwd);
        return yield* prReview.getDashboard(body);
      }),

    [WS_METHODS.prReviewGetPatch]: (_ws, request) =>
      Effect.gen(function* () {
        const prReview = yield* input.prReviewLoader;
        return yield* prReview.getPatch(stripTaggedBody(request.body as any) as any);
      }),

    [WS_METHODS.prReviewAddThread]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        const prReview = yield* input.prReviewLoader;
        const result = yield* prReview.addThread(body);
        yield* publishSyncUpdated(body);
        return result;
      }),

    [WS_METHODS.prReviewReplyToThread]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        const prReview = yield* input.prReviewLoader;
        const result = yield* prReview.replyToThread(body);
        yield* publishSyncUpdated(body);
        return result;
      }),

    [WS_METHODS.prReviewResolveThread]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        const prReview = yield* input.prReviewLoader;
        const result = yield* prReview.resolveThread(body);
        yield* publishSyncUpdated(body);
        return result;
      }),

    [WS_METHODS.prReviewUnresolveThread]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        const prReview = yield* input.prReviewLoader;
        const result = yield* prReview.unresolveThread(body);
        yield* publishSyncUpdated(body);
        return result;
      }),

    [WS_METHODS.prReviewSearchUsers]: (_ws, request) =>
      Effect.gen(function* () {
        const prReview = yield* input.prReviewLoader;
        return yield* prReview.searchUsers(stripTaggedBody(request.body as any) as any);
      }),

    [WS_METHODS.prReviewGetUserPreview]: (_ws, request) =>
      Effect.gen(function* () {
        const prReview = yield* input.prReviewLoader;
        return yield* prReview.getUserPreview(stripTaggedBody(request.body as any) as any);
      }),

    [WS_METHODS.prReviewAnalyzeConflicts]: (_ws, request) =>
      Effect.gen(function* () {
        const prReview = yield* input.prReviewLoader;
        return yield* prReview.analyzeConflicts(stripTaggedBody(request.body as any) as any);
      }),

    [WS_METHODS.prReviewApplyConflictResolution]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        const prReview = yield* input.prReviewLoader;
        const result = yield* prReview.applyConflictResolution(body);
        yield* publishSyncUpdated(body);
        return result;
      }),

    [WS_METHODS.prReviewRunWorkflowStep]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        const prReview = yield* input.prReviewLoader;
        const result = yield* prReview.runWorkflowStep(body);
        yield* publishSyncUpdated(body);
        return result;
      }),

    [WS_METHODS.prReviewSubmitReview]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        const prReview = yield* input.prReviewLoader;
        const result = yield* prReview.submitReview(body);
        yield* publishSyncUpdated(body);
        return result;
      }),
  };
}
