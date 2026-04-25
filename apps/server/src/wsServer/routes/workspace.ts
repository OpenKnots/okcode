import { WS_METHODS } from "@okcode/contracts";
import { Effect } from "effect";

import type { WebSocketRouteRegistry } from "./shared";
import { stripTaggedBody } from "./shared";

export function createWorkspaceRouteHandlers(input: {
  searchWorkspaceEntries: (body: unknown) => Promise<unknown>;
  listWorkspaceDirectory: (body: unknown) => Promise<unknown>;
  browseFileSystemDirectory: (body: unknown) => Promise<unknown>;
  resolveCheckPath: (path: string) => Effect.Effect<string, unknown, never>;
  fileSystem: {
    stat: (path: string) => Effect.Effect<{ type: string; size?: bigint | number }, unknown, never>;
    makeDirectory: (
      path: string,
      options?: { recursive?: boolean },
    ) => Effect.Effect<void, unknown, never>;
    writeFile: (path: string, bytes: Uint8Array) => Effect.Effect<void, unknown, never>;
    writeFileString: (path: string, contents: string) => Effect.Effect<void, unknown, never>;
    readFile: (path: string) => Effect.Effect<Uint8Array, unknown, never>;
    remove: (
      path: string,
      options?: { recursive?: boolean },
    ) => Effect.Effect<void, unknown, never>;
  };
  path: {
    dirname: (path: string) => string;
  };
  resolveWorkspaceWritePath: (input: {
    workspaceRoot: string;
    relativePath: string;
    path: unknown;
  }) => Effect.Effect<{ absolutePath: string; relativePath: string }, unknown, never>;
  resolveFilePreview: (path: string) => {
    maxReadSizeBytes: number;
    mimeType: string;
    previewable: boolean;
    textLike: boolean;
  };
  containsBinaryBytes: (bytes: Uint8Array) => boolean;
  buildPreviewDataUrl: (input: {
    mimeType: string;
    rawBytes: Uint8Array;
    containsBinaryData: boolean;
    previewableByMime: boolean;
  }) => string | undefined;
  createRouteRequestError: (message: string) => unknown;
}): WebSocketRouteRegistry {
  return {
    [WS_METHODS.projectsSearchEntries]: (_ws, request) => {
      const body = stripTaggedBody(request.body as any);
      return Effect.tryPromise({
        try: () => input.searchWorkspaceEntries(body),
        catch: (cause) =>
          input.createRouteRequestError(`Failed to search workspace entries: ${String(cause)}`),
      });
    },

    [WS_METHODS.projectsListDirectory]: (_ws, request) => {
      const body = stripTaggedBody(request.body as any);
      return Effect.tryPromise({
        try: () => input.listWorkspaceDirectory(body),
        catch: (cause) =>
          input.createRouteRequestError(`Failed to list workspace directory: ${String(cause)}`),
      });
    },

    [WS_METHODS.projectsBrowseDirectory]: (_ws, request) => {
      const body = stripTaggedBody(request.body as any);
      return Effect.tryPromise({
        try: () => input.browseFileSystemDirectory(body),
        catch: (cause) =>
          input.createRouteRequestError(`Failed to browse directory: ${String(cause)}`),
      });
    },

    [WS_METHODS.projectsPathExists]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any);
        const resolvedPath = yield* input.resolveCheckPath(body.path);
        const fileInfo = yield* input.fileSystem
          .stat(resolvedPath)
          .pipe(Effect.catch(() => Effect.succeed(null)));
        return {
          exists: fileInfo !== null,
        };
      }),

    [WS_METHODS.projectsWriteFile]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any);
        const target = yield* input.resolveWorkspaceWritePath({
          workspaceRoot: body.cwd,
          relativePath: body.relativePath,
          path: input.path,
        });
        yield* input.fileSystem
          .makeDirectory(input.path.dirname(target.absolutePath), { recursive: true })
          .pipe(
            Effect.mapError((cause) =>
              input.createRouteRequestError(`Failed to prepare workspace path: ${String(cause)}`),
            ),
          );
        const writeEffect =
          body.encoding === "base64"
            ? input.fileSystem.writeFile(
                target.absolutePath,
                new Uint8Array(Buffer.from(body.contents, "base64")),
              )
            : input.fileSystem.writeFileString(target.absolutePath, body.contents);
        yield* writeEffect.pipe(
          Effect.mapError((cause) =>
            input.createRouteRequestError(`Failed to write workspace file: ${String(cause)}`),
          ),
        );
        return { relativePath: target.relativePath };
      }),

    [WS_METHODS.projectsReadFile]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any);
        const target = yield* input.resolveWorkspaceWritePath({
          workspaceRoot: body.cwd,
          relativePath: body.relativePath,
          path: input.path,
        });
        const filePreview = input.resolveFilePreview(target.absolutePath);
        const fileStat = yield* input.fileSystem
          .stat(target.absolutePath)
          .pipe(
            Effect.mapError((cause) =>
              input.createRouteRequestError(`Failed to read file: ${String(cause)}`),
            ),
          );
        if (fileStat.type !== "File") {
          return yield* Effect.fail(
            input.createRouteRequestError(`Path is not a file: ${target.relativePath}`),
          );
        }
        const sizeBytes = Number(fileStat.size);
        if (sizeBytes > filePreview.maxReadSizeBytes) {
          return yield* Effect.fail(
            input.createRouteRequestError(
              `File is too large to display (${(sizeBytes / 1024 / 1024).toFixed(1)}MB). Maximum supported size is ${(filePreview.maxReadSizeBytes / 1024 / 1024).toFixed(0)}MB.`,
            ),
          );
        }
        const rawBytes = yield* input.fileSystem
          .readFile(target.absolutePath)
          .pipe(
            Effect.mapError((cause) =>
              input.createRouteRequestError(`Failed to read file: ${String(cause)}`),
            ),
          );
        const hasBinaryData = input.containsBinaryBytes(rawBytes);
        const previewDataUrl = input.buildPreviewDataUrl({
          mimeType: filePreview.mimeType,
          rawBytes,
          containsBinaryData: hasBinaryData,
          previewableByMime: filePreview.previewable,
        });
        const hasTextContents = !hasBinaryData || filePreview.textLike;
        const contents = hasTextContents ? new TextDecoder().decode(rawBytes) : "";
        return {
          relativePath: target.relativePath,
          contents,
          hasTextContents,
          sizeBytes,
          truncated: false,
          ...(previewDataUrl
            ? {
                previewDataUrl,
                previewMimeType: filePreview.mimeType,
              }
            : {}),
        };
      }),

    [WS_METHODS.projectsDeleteEntry]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any);
        const target = yield* input.resolveWorkspaceWritePath({
          workspaceRoot: body.cwd,
          relativePath: body.relativePath,
          path: input.path,
        });
        yield* input.fileSystem
          .remove(target.absolutePath, { recursive: true })
          .pipe(
            Effect.mapError((cause) =>
              input.createRouteRequestError(`Failed to delete entry: ${String(cause)}`),
            ),
          );
        return {};
      }),
  };
}
