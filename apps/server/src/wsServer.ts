/**
 * Server - HTTP/WebSocket server service interface.
 *
 * Owns startup and shutdown lifecycle of the HTTP server, static asset serving,
 * and WebSocket request routing.
 *
 * @module Server
 */
import fs from "node:fs";
import http, { type IncomingMessage } from "node:http";
import path from "node:path";
import type { Duplex } from "node:stream";

import Mime from "@effect/platform-node/Mime";
import {
  CommandId,
  DEFAULT_CHAT_FILE_MIME_TYPE,
  DEFAULT_PROVIDER_INTERACTION_MODE,
  type ClientOrchestrationCommand,
  type OrchestrationCommand,
  ORCHESTRATION_WS_CHANNELS,
  PROVIDER_SEND_TURN_MAX_FILE_BYTES,
  PROVIDER_SEND_TURN_MAX_IMAGE_BYTES,
  ProjectId,
  ThreadId,
  WS_CHANNELS,
  WS_METHODS,
  type WebSocketError,
  WebSocketRequest,
  type WsResponse as WsResponseMessage,
  WsResponse,
  type WsPushEnvelopeBase,
} from "@okcode/contracts";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { ChildProcessSpawner } from "effect/unstable/process";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import {
  Cause,
  Effect,
  Exit,
  FileSystem,
  Fiber,
  Layer,
  Path,
  Ref,
  Result,
  Schema,
  Scope,
  ServiceMap,
  Stream,
} from "effect";
import { WebSocketServer, type WebSocket } from "ws";

import { createLogger } from "./logger";
import { pickFolderNative } from "./nativeFolderPicker.ts";
import { TerminalManager } from "./terminal/Services/Manager.ts";
import { Keybindings } from "./keybindings";
import {
  clearWorkspaceIndexCache,
  listWorkspaceDirectory,
  searchWorkspaceEntries,
} from "./workspaceEntries";
import { OrchestrationEngineService } from "./orchestration/Services/OrchestrationEngine";
import { ProjectionSnapshotQuery } from "./orchestration/Services/ProjectionSnapshotQuery";
import { OrchestrationReactor } from "./orchestration/Services/OrchestrationReactor";
import { ProviderService } from "./provider/Services/ProviderService";
import { ProviderHealth } from "./provider/Services/ProviderHealth";
import { CheckpointDiffQuery } from "./checkpointing/Services/CheckpointDiffQuery";
import { Open, resolveAvailableEditors } from "./open";
import { ServerConfig } from "./config";
import { GitCore } from "./git/Services/GitCore.ts";
import { GitManager } from "./git/Services/GitManager.ts";
import { collectMergedWorktreeCleanupCandidates } from "./git/worktreeCleanup.ts";
import {
  ATTACHMENTS_ROUTE_PREFIX,
  normalizeAttachmentRelativePath,
  resolveAttachmentRelativePath,
} from "./attachmentPaths";
import { buildPreviewDataUrl, containsBinaryBytes, resolveFilePreview } from "./filePreview";

import {
  createAttachmentId,
  resolveAttachmentPath,
  resolveAttachmentPathById,
} from "./attachmentStore.ts";
import { parseBase64DataUrl } from "./imageMime.ts";
import { extractTextAttachmentContents } from "./attachmentText.ts";
import { expandHomePath } from "./os-jank.ts";
import { makeServerPushBus } from "./wsServer/pushBus.ts";
import { makeServerReadiness } from "./wsServer/readiness.ts";
import { createGitRouteHandlers } from "./wsServer/routes/git.ts";
import { createGitHubRouteHandlers } from "./wsServer/routes/github.ts";
import { createOrchestrationRouteHandlers } from "./wsServer/routes/orchestration.ts";
import { createPrReviewRouteHandlers } from "./wsServer/routes/prReview.ts";
import { createServerRouteHandlers } from "./wsServer/routes/server.ts";
import { createShellRouteHandlers } from "./wsServer/routes/shell.ts";
import { createSkillRouteHandlers } from "./wsServer/routes/skills.ts";
import { createTerminalRouteHandlers } from "./wsServer/routes/terminal.ts";
import { createWorkspaceRouteHandlers } from "./wsServer/routes/workspace.ts";
import { decodeJsonResult, formatSchemaError } from "@okcode/shared/schemaJson";
import { redactSensitiveText, redactSensitiveValue } from "@okcode/shared/redaction";
import { PrReview } from "./prReview/Services/PrReview.ts";
import { GitHub } from "./github/Services/GitHub.ts";
import { GitActionExecutionError } from "./git/Errors.ts";
import { EnvironmentVariables } from "./persistence/Services/EnvironmentVariables.ts";
import { OpenclawGatewayConfig } from "./persistence/Services/OpenclawGatewayConfig.ts";
import { SkillService } from "./skills/SkillService.ts";
import { TokenManager } from "./tokenManager.ts";
import { resolveRuntimeEnvironment } from "./runtimeEnvironment.ts";
import { readCodexConfigSummary } from "./provider/codexConfig";
import { TerminalRuntimeEnvResolver } from "./terminal/Services/RuntimeEnvResolver.ts";
import {
  makeOptionalGitHubLayer,
  makeOptionalGitManagerLayer,
  makeOptionalPrReviewLayer,
  makeOptionalSkillServiceLayer,
  makeOptionalTerminalManagerLayer,
  makeOptionalTerminalRuntimeEnvResolverLayer,
} from "./serverLayers.ts";
import { version as serverVersion } from "../package.json" with { type: "json" };
import { serverBuildInfo } from "./buildInfo";
import { runOpenclawGatewayTest } from "./openclawGatewayTest.ts";
import { createApiRouter } from "./api/router.ts";

// ── OpenClaw Gateway Connection Test ──────────────────────────────────

function testOpenclawGateway(input: import("@okcode/contracts").TestOpenclawGatewayInput) {
  return Effect.tryPromise({
    try: () => runOpenclawGatewayTest(input),
    catch: (cause) =>
      new RouteRequestError({
        message: `OpenClaw gateway test failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      }),
  });
}

const resolveCheckPath = Effect.fn(function* (input: string) {
  return path.resolve(yield* expandHomePath(input.trim()));
});

/**
 * Returns true if `a` is a strictly higher semver than `b`.
 * Only handles `major.minor.patch` numeric segments; pre-release suffixes
 * (e.g. `-beta.1`) are ignored. The `okcodes` npm package uses plain
 * `x.y.z` releases so this is sufficient for update-check purposes.
 */
function isNewerSemver(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va > vb) return true;
    if (va < vb) return false;
  }
  return false;
}

function inferAttachmentContentType(filePath: string): string {
  const mimeType = Mime.getType(filePath);
  if (mimeType) {
    return mimeType;
  }

  const normalizedPath = filePath.toLowerCase();
  if (normalizedPath.endsWith(".patch") || normalizedPath.endsWith(".diff")) {
    return "text/x-diff; charset=utf-8";
  }
  if (normalizedPath.endsWith(".md")) {
    return "text/markdown; charset=utf-8";
  }
  if (normalizedPath.endsWith(".txt")) {
    return "text/plain; charset=utf-8";
  }

  return "application/octet-stream";
}

/**
 * Remote address from the HTTP upgrade (`request.socket`). The `ws` library often does not
 * expose a reliable `socket.remoteAddress` when handling messages, so we capture it here.
 */
const remoteAddressByWebSocket = new WeakMap<WebSocket, string>();

function captureWebSocketRemoteAddress(ws: WebSocket, request: IncomingMessage): void {
  const addr = request.socket?.remoteAddress;
  if (typeof addr === "string" && addr.length > 0) {
    remoteAddressByWebSocket.set(ws, addr);
  }
}

function getWebSocketRemoteAddress(ws: WebSocket): string | undefined {
  const fromUpgrade = remoteAddressByWebSocket.get(ws);
  if (fromUpgrade !== undefined) {
    return fromUpgrade;
  }
  const raw = ws as WebSocket & {
    socket?: { remoteAddress?: string | undefined };
    _socket?: { remoteAddress?: string | undefined };
  };
  return raw.socket?.remoteAddress ?? raw._socket?.remoteAddress;
}

function isLoopbackRemoteAddress(addr: string): boolean {
  if (addr === "::1" || addr === "127.0.0.1" || addr === "::ffff:127.0.0.1") {
    return true;
  }
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(addr);
}

function isLocalWebSocketClient(ws: WebSocket): boolean {
  const addr = getWebSocketRemoteAddress(ws);
  if (addr === undefined || addr.length === 0) {
    return true;
  }
  return isLoopbackRemoteAddress(addr);
}

/**
 * ServerShape - Service API for server lifecycle control.
 */
export interface ServerShape {
  /**
   * Start HTTP and WebSocket listeners.
   */
  readonly start: Effect.Effect<
    http.Server,
    ServerLifecycleError,
    | Scope.Scope
    | ServerRuntimeServices
    | ServerConfig
    | FileSystem.FileSystem
    | Path.Path
    | ChildProcessSpawner.ChildProcessSpawner
    | SqlClient.SqlClient
  >;

  /**
   * Wait for process shutdown signals.
   */
  readonly stopSignal: Effect.Effect<void, never>;
}

/**
 * Server - Service tag for HTTP/WebSocket lifecycle management.
 */
export class Server extends ServiceMap.Service<Server, ServerShape>()("okcode/wsServer/Server") {}

const isServerNotRunningError = (error: Error): boolean => {
  const maybeCode = (error as NodeJS.ErrnoException).code;
  return (
    maybeCode === "ERR_SERVER_NOT_RUNNING" || error.message.toLowerCase().includes("not running")
  );
};

function rejectUpgrade(socket: Duplex, statusCode: number, message: string): void {
  socket.end(
    `HTTP/1.1 ${statusCode} ${statusCode === 401 ? "Unauthorized" : "Bad Request"}\r\n` +
      "Connection: close\r\n" +
      "Content-Type: text/plain\r\n" +
      `Content-Length: ${Buffer.byteLength(message)}\r\n` +
      "\r\n" +
      message,
  );
}

function websocketRawToString(raw: unknown): string | null {
  if (typeof raw === "string") {
    return raw;
  }
  if (raw instanceof Uint8Array) {
    return Buffer.from(raw).toString("utf8");
  }
  if (raw instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(raw)).toString("utf8");
  }
  if (Array.isArray(raw)) {
    const chunks: string[] = [];
    for (const chunk of raw) {
      if (typeof chunk === "string") {
        chunks.push(chunk);
        continue;
      }
      if (chunk instanceof Uint8Array) {
        chunks.push(Buffer.from(chunk).toString("utf8"));
        continue;
      }
      if (chunk instanceof ArrayBuffer) {
        chunks.push(Buffer.from(new Uint8Array(chunk)).toString("utf8"));
        continue;
      }
      return null;
    }
    return chunks.join("");
  }
  return null;
}

function toPosixRelativePath(input: string): string {
  return input.replaceAll("\\", "/");
}

function resolveWorkspaceWritePath(params: {
  workspaceRoot: string;
  relativePath: string;
  path: Path.Path;
}): Effect.Effect<{ absolutePath: string; relativePath: string }, RouteRequestError> {
  const normalizedInputPath = params.relativePath.trim();
  if (params.path.isAbsolute(normalizedInputPath)) {
    return Effect.fail(
      new RouteRequestError({
        message: "Workspace file path must be relative to the project root.",
      }),
    );
  }

  const absolutePath = params.path.resolve(params.workspaceRoot, normalizedInputPath);
  const relativeToRoot = toPosixRelativePath(
    params.path.relative(params.workspaceRoot, absolutePath),
  );
  if (
    relativeToRoot.length === 0 ||
    relativeToRoot === "." ||
    relativeToRoot.startsWith("../") ||
    relativeToRoot === ".." ||
    params.path.isAbsolute(relativeToRoot)
  ) {
    return Effect.fail(
      new RouteRequestError({
        message: "Workspace file path must stay within the project root.",
      }),
    );
  }

  return Effect.succeed({
    absolutePath,
    relativePath: relativeToRoot,
  });
}

const encodeWsResponse = Schema.encodeEffect(Schema.fromJsonString(WsResponse));
const decodeWebSocketRequest = decodeJsonResult(WebSocketRequest);

export type ServerCoreRuntimeServices =
  | OrchestrationEngineService
  | ProjectionSnapshotQuery
  | CheckpointDiffQuery
  | OrchestrationReactor
  | ProviderService
  | ProviderHealth;

export type ServerRuntimeServices =
  | ServerCoreRuntimeServices
  | GitCore
  | Keybindings
  | Open
  | EnvironmentVariables
  | OpenclawGatewayConfig;

export class ServerLifecycleError extends Schema.TaggedErrorClass<ServerLifecycleError>()(
  "ServerLifecycleError",
  {
    operation: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

class RouteRequestError extends Schema.TaggedErrorClass<RouteRequestError>()("RouteRequestError", {
  message: Schema.String,
}) {}

class GitActionStoppedError extends Schema.TaggedErrorClass<GitActionStoppedError>()(
  "GitActionStoppedError",
  {
    message: Schema.String,
  },
) {}

export const createServer = Effect.fn(function* (): Effect.fn.Return<
  http.Server,
  ServerLifecycleError,
  | Scope.Scope
  | ServerRuntimeServices
  | ServerConfig
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | SqlClient.SqlClient
> {
  const serverConfig = yield* ServerConfig;
  const {
    port,
    cwd,
    keybindingsConfigPath,
    staticDir,
    devUrl,
    authToken,
    host,
    logWebSocketEvents,
    autoBootstrapProjectFromCwd,
  } = serverConfig;
  const availableEditors = resolveAvailableEditors();
  const tokenManager = new TokenManager(authToken);
  const tryHandleApiRequest = createApiRouter({
    authToken,
    host,
    port,
    tokenManager,
  });

  const keybindingsManager = yield* Keybindings;
  const providerHealth = yield* ProviderHealth;
  const openclawGatewayConfig = yield* OpenclawGatewayConfig;
  const git = yield* GitCore;
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* keybindingsManager.syncDefaultKeybindingsOnStartup.pipe(
    Effect.catch((error) =>
      Effect.logWarning("failed to sync keybindings defaults on startup", {
        path: error.configPath,
        detail: error.detail,
        cause: error.cause,
      }),
    ),
  );

  let lastKnownProviderStatuses = yield* providerHealth.getStatuses;

  const clients = yield* Ref.make(new Set<WebSocket>());
  const logger = createLogger("ws");
  const readiness = yield* makeServerReadiness;
  type ActiveGitRequestKind = "pull" | "stacked_action";
  type ActiveGitRequestHandle = {
    readonly kind: ActiveGitRequestKind;
    readonly cwd: string;
    readonly actionId: string | null;
    readonly fiber: Fiber.Fiber<unknown, unknown>;
  };
  const activeGitRequests = new WeakMap<WebSocket, Set<ActiveGitRequestHandle>>();

  const registerActiveGitRequest = (ws: WebSocket, handle: ActiveGitRequestHandle) =>
    Effect.sync(() => {
      const handles = activeGitRequests.get(ws) ?? new Set<ActiveGitRequestHandle>();
      handles.add(handle);
      activeGitRequests.set(ws, handles);
    });

  const unregisterActiveGitRequest = (ws: WebSocket, handle: ActiveGitRequestHandle) =>
    Effect.sync(() => {
      const handles = activeGitRequests.get(ws);
      if (!handles) {
        return;
      }
      handles.delete(handle);
      if (handles.size === 0) {
        activeGitRequests.delete(ws);
      }
    });

  const interruptActiveGitRequests = (ws: WebSocket) =>
    Effect.gen(function* () {
      const handles = Array.from(activeGitRequests.get(ws) ?? []);
      activeGitRequests.delete(ws);
      for (const handle of handles) {
        yield* Fiber.interrupt(handle.fiber).pipe(Effect.ignore);
      }
    });

  const stopActiveGitRequest = (
    ws: WebSocket,
    input: { cwd: string; actionId?: string | undefined },
  ) =>
    Effect.gen(function* () {
      const handles = Array.from(activeGitRequests.get(ws) ?? []);
      const handle =
        input.actionId != null
          ? handles.find(
              (candidate) => candidate.cwd === input.cwd && candidate.actionId === input.actionId,
            )
          : handles.find((candidate) => candidate.cwd === input.cwd);

      if (!handle) {
        return;
      }

      yield* Fiber.interrupt(handle.fiber);
    });

  const runTrackedGitRequest = <A, E>(
    ws: WebSocket,
    meta: { kind: ActiveGitRequestKind; cwd: string; actionId?: string | undefined },
    effect: Effect.Effect<A, E, never>,
    interruptedMessage: string,
  ): Effect.Effect<A, E | GitActionStoppedError> =>
    Effect.gen(function* () {
      const fiber = yield* Effect.forkScoped(effect);
      const handle: ActiveGitRequestHandle = {
        kind: meta.kind,
        cwd: meta.cwd,
        actionId: meta.actionId ?? null,
        fiber,
      };
      yield* registerActiveGitRequest(ws, handle);
      const exit = yield* Fiber.await(fiber).pipe(
        Effect.ensuring(unregisterActiveGitRequest(ws, handle)),
      );
      if (Exit.isSuccess(exit)) {
        return exit.value;
      }
      if (Cause.hasInterruptsOnly(exit.cause)) {
        return yield* new GitActionStoppedError({ message: interruptedMessage });
      }
      return yield* Effect.failCause(exit.cause as Cause.Cause<E>);
    }) as Effect.Effect<A, E | GitActionStoppedError, never>;

  function logOutgoingPush(push: WsPushEnvelopeBase, recipients: number) {
    if (!logWebSocketEvents) return;
    logger.event("outgoing push", {
      channel: push.channel,
      sequence: push.sequence,
      recipients,
      payload: push.data,
    });
  }

  const pushBus = yield* makeServerPushBus({
    clients,
    logOutgoingPush,
    logDeliveryFailure: (input) => {
      logger.warn("failed to deliver websocket push", input);
    },
  });
  const getProviderStatuses = () =>
    providerHealth.getStatuses.pipe(
      Effect.tap((statuses) =>
        Effect.sync(() => {
          lastKnownProviderStatuses = statuses;
        }),
      ),
      Effect.catch((cause) =>
        Effect.logWarning("failed to refresh provider statuses", {
          cause,
        }).pipe(Effect.as(lastKnownProviderStatuses)),
      ),
    );
  yield* readiness.markPushBusReady;
  yield* keybindingsManager.start.pipe(
    Effect.mapError(
      (cause) => new ServerLifecycleError({ operation: "keybindingsRuntimeStart", cause }),
    ),
  );
  yield* readiness.markKeybindingsReady;

  const normalizeDispatchCommand = Effect.fnUntraced(function* (input: {
    readonly command: ClientOrchestrationCommand;
  }) {
    const normalizeProjectWorkspaceRoot = Effect.fnUntraced(function* (workspaceRoot: string) {
      const normalizedWorkspaceRoot = path.resolve(yield* expandHomePath(workspaceRoot.trim()));
      const workspaceStat = yield* fileSystem
        .stat(normalizedWorkspaceRoot)
        .pipe(Effect.catch(() => Effect.succeed(null)));
      if (!workspaceStat) {
        return yield* new RouteRequestError({
          message: `Project directory does not exist: ${normalizedWorkspaceRoot}`,
        });
      }
      if (workspaceStat.type !== "Directory") {
        return yield* new RouteRequestError({
          message: `Project path is not a directory: ${normalizedWorkspaceRoot}`,
        });
      }
      return normalizedWorkspaceRoot;
    });

    if (input.command.type === "project.create") {
      return {
        ...input.command,
        workspaceRoot: yield* normalizeProjectWorkspaceRoot(input.command.workspaceRoot),
      } satisfies OrchestrationCommand;
    }

    if (input.command.type === "project.meta.update" && input.command.workspaceRoot !== undefined) {
      return {
        ...input.command,
        workspaceRoot: yield* normalizeProjectWorkspaceRoot(input.command.workspaceRoot),
      } satisfies OrchestrationCommand;
    }

    if (input.command.type !== "thread.turn.start") {
      return input.command as OrchestrationCommand;
    }
    const turnStartCommand = input.command;

    const normalizedAttachments = yield* Effect.forEach(
      turnStartCommand.message.attachments,
      (attachment) =>
        Effect.gen(function* () {
          const parsed = parseBase64DataUrl(attachment.dataUrl);
          if (!parsed) {
            return yield* new RouteRequestError({
              message: `Invalid attachment payload for '${attachment.name}'.`,
            });
          }

          const bytes = Buffer.from(parsed.base64, "base64");
          const normalizedMimeType =
            parsed.mimeType.trim().toLowerCase() || DEFAULT_CHAT_FILE_MIME_TYPE;

          if (attachment.type === "image") {
            if (!normalizedMimeType.startsWith("image/")) {
              return yield* new RouteRequestError({
                message: `Invalid image attachment payload for '${attachment.name}'.`,
              });
            }
            if (bytes.byteLength === 0 || bytes.byteLength > PROVIDER_SEND_TURN_MAX_IMAGE_BYTES) {
              return yield* new RouteRequestError({
                message: `Image attachment '${attachment.name}' is empty or too large.`,
              });
            }
          } else {
            if (bytes.byteLength === 0 || bytes.byteLength > PROVIDER_SEND_TURN_MAX_FILE_BYTES) {
              return yield* new RouteRequestError({
                message: `File attachment '${attachment.name}' is empty or too large.`,
              });
            }
            const extractedText = extractTextAttachmentContents({
              mimeType: normalizedMimeType,
              fileName: attachment.name,
              bytes,
            });
            if (extractedText === null) {
              return yield* new RouteRequestError({
                message: `Unsupported file attachment '${attachment.name}'. Attach UTF-8 text files or images.`,
              });
            }
          }

          const attachmentId = createAttachmentId(turnStartCommand.threadId);
          if (!attachmentId) {
            return yield* new RouteRequestError({
              message: "Failed to create a safe attachment id.",
            });
          }

          const persistedAttachment =
            attachment.type === "image"
              ? {
                  type: "image" as const,
                  id: attachmentId,
                  name: attachment.name,
                  mimeType: normalizedMimeType,
                  sizeBytes: bytes.byteLength,
                }
              : {
                  type: "file" as const,
                  id: attachmentId,
                  name: attachment.name,
                  mimeType: normalizedMimeType,
                  sizeBytes: bytes.byteLength,
                };

          const attachmentPath = resolveAttachmentPath({
            attachmentsDir: serverConfig.attachmentsDir,
            attachment: persistedAttachment,
          });
          if (!attachmentPath) {
            return yield* new RouteRequestError({
              message: `Failed to resolve persisted path for '${attachment.name}'.`,
            });
          }

          yield* fileSystem.makeDirectory(path.dirname(attachmentPath), { recursive: true }).pipe(
            Effect.mapError(
              () =>
                new RouteRequestError({
                  message: `Failed to create attachment directory for '${attachment.name}'.`,
                }),
            ),
          );
          yield* fileSystem.writeFile(attachmentPath, bytes).pipe(
            Effect.mapError(
              () =>
                new RouteRequestError({
                  message: `Failed to persist attachment '${attachment.name}'.`,
                }),
            ),
          );

          return persistedAttachment;
        }),
      { concurrency: 1 },
    );

    return {
      ...turnStartCommand,
      message: {
        ...turnStartCommand.message,
        attachments: normalizedAttachments,
      },
    } satisfies OrchestrationCommand;
  });

  // HTTP server — serves static files or redirects to Vite dev server
  const httpServer = http.createServer(async (req, res) => {
    const respond = (
      statusCode: number,
      headers: Record<string, string>,
      body?: string | Uint8Array,
    ) => {
      res.writeHead(statusCode, headers);
      res.end(body);
    };

    void Effect.runPromise(
      Effect.gen(function* () {
        const url = new URL(req.url ?? "/", `http://localhost:${port}`);
        if (yield* Effect.promise(() => tryHandleApiRequest(req, res, url))) {
          return;
        }

        if (url.pathname.startsWith(ATTACHMENTS_ROUTE_PREFIX)) {
          const rawRelativePath = url.pathname.slice(ATTACHMENTS_ROUTE_PREFIX.length);
          const normalizedRelativePath = normalizeAttachmentRelativePath(rawRelativePath);
          if (!normalizedRelativePath) {
            respond(400, { "Content-Type": "text/plain" }, "Invalid attachment path");
            return;
          }

          const isIdLookup =
            !normalizedRelativePath.includes("/") && !normalizedRelativePath.includes(".");
          const filePath = isIdLookup
            ? resolveAttachmentPathById({
                attachmentsDir: serverConfig.attachmentsDir,
                attachmentId: normalizedRelativePath,
              })
            : resolveAttachmentRelativePath({
                attachmentsDir: serverConfig.attachmentsDir,
                relativePath: normalizedRelativePath,
              });
          if (!filePath) {
            respond(
              isIdLookup ? 404 : 400,
              { "Content-Type": "text/plain" },
              isIdLookup ? "Not Found" : "Invalid attachment path",
            );
            return;
          }

          const fileInfo = yield* fileSystem
            .stat(filePath)
            .pipe(Effect.catch(() => Effect.succeed(null)));
          if (!fileInfo || fileInfo.type !== "File") {
            respond(404, { "Content-Type": "text/plain" }, "Not Found");
            return;
          }

          const contentType = inferAttachmentContentType(filePath);
          res.writeHead(200, {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
          });
          const streamExit = yield* Stream.runForEach(fileSystem.stream(filePath), (chunk) =>
            Effect.sync(() => {
              if (!res.destroyed) {
                res.write(chunk);
              }
            }),
          ).pipe(Effect.exit);
          if (Exit.isFailure(streamExit)) {
            if (!res.destroyed) {
              res.destroy();
            }
            return;
          }
          if (!res.writableEnded) {
            res.end();
          }
          return;
        }

        // In dev mode, redirect to Vite dev server
        if (devUrl) {
          respond(302, { Location: devUrl.href });
          return;
        }

        // Serve static files from the web app build
        if (!staticDir) {
          respond(
            503,
            { "Content-Type": "text/plain" },
            "No static directory configured and no dev URL set.",
          );
          return;
        }

        const staticRoot = path.resolve(staticDir);
        const staticRequestPath = url.pathname === "/" ? "/index.html" : url.pathname;
        const rawStaticRelativePath = staticRequestPath.replace(/^[/\\]+/, "");
        const hasRawLeadingParentSegment = rawStaticRelativePath.startsWith("..");
        const staticRelativePath = path.normalize(rawStaticRelativePath).replace(/^[/\\]+/, "");
        const hasPathTraversalSegment = staticRelativePath.startsWith("..");
        if (
          staticRelativePath.length === 0 ||
          hasRawLeadingParentSegment ||
          hasPathTraversalSegment ||
          staticRelativePath.includes("\0")
        ) {
          respond(400, { "Content-Type": "text/plain" }, "Invalid static file path");
          return;
        }

        const isWithinStaticRoot = (candidate: string) =>
          candidate === staticRoot ||
          candidate.startsWith(
            staticRoot.endsWith(path.sep) ? staticRoot : `${staticRoot}${path.sep}`,
          );

        let filePath = path.resolve(staticRoot, staticRelativePath);
        if (!isWithinStaticRoot(filePath)) {
          respond(400, { "Content-Type": "text/plain" }, "Invalid static file path");
          return;
        }

        const ext = path.extname(filePath);
        if (!ext) {
          filePath = path.resolve(filePath, "index.html");
          if (!isWithinStaticRoot(filePath)) {
            respond(400, { "Content-Type": "text/plain" }, "Invalid static file path");
            return;
          }
        }

        const fileInfo = yield* fileSystem
          .stat(filePath)
          .pipe(Effect.catch(() => Effect.succeed(null)));
        if (!fileInfo || fileInfo.type !== "File") {
          const indexPath = path.resolve(staticRoot, "index.html");
          const indexData = yield* fileSystem
            .readFile(indexPath)
            .pipe(Effect.catch(() => Effect.succeed(null)));
          if (!indexData) {
            respond(404, { "Content-Type": "text/plain" }, "Not Found");
            return;
          }
          respond(200, { "Content-Type": "text/html; charset=utf-8" }, indexData);
          return;
        }

        const contentType = Mime.getType(filePath) ?? "application/octet-stream";
        const data = yield* fileSystem
          .readFile(filePath)
          .pipe(Effect.catch(() => Effect.succeed(null)));
        if (!data) {
          respond(500, { "Content-Type": "text/plain" }, "Internal Server Error");
          return;
        }
        respond(200, { "Content-Type": contentType }, data);
      }),
    ).catch(() => {
      if (!res.headersSent) {
        respond(500, { "Content-Type": "text/plain" }, "Internal Server Error");
      }
    });
  });

  // WebSocket server — upgrades from the HTTP server
  const wss = new WebSocketServer({ noServer: true });

  const closeWebSocketServer = Effect.callback<void, ServerLifecycleError>((resume) => {
    wss.close((error) => {
      if (error && !isServerNotRunningError(error)) {
        resume(
          Effect.fail(
            new ServerLifecycleError({ operation: "closeWebSocketServer", cause: error }),
          ),
        );
      } else {
        resume(Effect.void);
      }
    });
  });

  const closeAllClients = Ref.get(clients).pipe(
    Effect.flatMap(Effect.forEach((client) => Effect.sync(() => client.close()))),
    Effect.flatMap(() => Ref.set(clients, new Set())),
  );

  const listenOptions = host ? { host, port } : { port };

  const orchestrationEngine = yield* OrchestrationEngineService;
  const projectionReadModelQuery = yield* ProjectionSnapshotQuery;
  const checkpointDiffQuery = yield* CheckpointDiffQuery;
  const orchestrationReactor = yield* OrchestrationReactor;
  const { openInEditor, openInFileManager, revealInFileManager } = yield* Open;
  const environmentVariables = yield* EnvironmentVariables;

  const subscriptionsScope = yield* Scope.make("sequential");
  yield* Effect.addFinalizer(() => Scope.close(subscriptionsScope, Exit.void));

  yield* Stream.runForEach(orchestrationEngine.streamDomainEvents, (event) =>
    pushBus.publishAll(ORCHESTRATION_WS_CHANNELS.domainEvent, event),
  ).pipe(Effect.forkIn(subscriptionsScope));

  yield* Stream.runForEach(keybindingsManager.streamChanges, (event) =>
    getProviderStatuses().pipe(
      Effect.flatMap((providers) =>
        pushBus.publishAll(WS_CHANNELS.serverConfigUpdated, {
          issues: event.issues,
          providers,
        }),
      ),
    ),
  ).pipe(Effect.forkIn(subscriptionsScope));

  const publishServerConfigUpdated = () =>
    Effect.gen(function* () {
      const keybindingsConfig = yield* keybindingsManager.loadConfigState;
      const providers = yield* getProviderStatuses();
      yield* pushBus.publishAll(WS_CHANNELS.serverConfigUpdated, {
        issues: keybindingsConfig.issues,
        providers,
      });
    });

  yield* Scope.provide(orchestrationReactor.start, subscriptionsScope);
  yield* readiness.markOrchestrationSubscriptionsReady;

  let welcomeBootstrapProjectId: ProjectId | undefined;
  let welcomeBootstrapThreadId: ThreadId | undefined;

  if (autoBootstrapProjectFromCwd) {
    yield* Effect.gen(function* () {
      const snapshot = yield* projectionReadModelQuery.getSnapshot();
      const existingProject = snapshot.projects.find(
        (project) => project.workspaceRoot === cwd && project.deletedAt === null,
      );
      let bootstrapProjectId: ProjectId;
      let bootstrapProjectDefaultModel: string;

      if (!existingProject) {
        const createdAt = new Date().toISOString();
        bootstrapProjectId = ProjectId.makeUnsafe(crypto.randomUUID());
        const bootstrapProjectTitle = path.basename(cwd) || "project";
        bootstrapProjectDefaultModel = "gpt-5-codex";
        yield* orchestrationEngine.dispatch({
          type: "project.create",
          commandId: CommandId.makeUnsafe(crypto.randomUUID()),
          projectId: bootstrapProjectId,
          title: bootstrapProjectTitle,
          workspaceRoot: cwd,
          defaultModel: bootstrapProjectDefaultModel,
          createdAt,
        });
      } else {
        bootstrapProjectId = existingProject.id;
        bootstrapProjectDefaultModel = existingProject.defaultModel ?? "gpt-5-codex";
      }

      const existingThread = snapshot.threads.find(
        (thread) => thread.projectId === bootstrapProjectId && thread.deletedAt === null,
      );
      if (!existingThread) {
        const createdAt = new Date().toISOString();
        const threadId = ThreadId.makeUnsafe(crypto.randomUUID());
        yield* orchestrationEngine.dispatch({
          type: "thread.create",
          commandId: CommandId.makeUnsafe(crypto.randomUUID()),
          threadId,
          projectId: bootstrapProjectId,
          title: "New thread",
          model: bootstrapProjectDefaultModel,
          interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
          runtimeMode: "full-access",
          branch: null,
          worktreePath: null,
          createdAt,
        });
        welcomeBootstrapProjectId = bootstrapProjectId;
        welcomeBootstrapThreadId = threadId;
      } else {
        welcomeBootstrapProjectId = bootstrapProjectId;
        welcomeBootstrapThreadId = existingThread.id;
      }
    }).pipe(
      Effect.mapError(
        (cause) => new ServerLifecycleError({ operation: "autoBootstrapProject", cause }),
      ),
    );
  }

  const serverContext = yield* Effect.services<
    | Scope.Scope
    | ServerRuntimeServices
    | ServerConfig
    | FileSystem.FileSystem
    | Path.Path
    | ChildProcessSpawner.ChildProcessSpawner
    | SqlClient.SqlClient
  >();
  const runPromise = Effect.runPromiseWith(serverContext);
  const gitManagerLoader = yield* Effect.cached(
    GitManager.asEffect().pipe(
      Effect.provide(makeOptionalGitManagerLayer()),
      Effect.provide(serverContext),
    ),
  );
  const prReviewLoader = yield* Effect.cached(
    PrReview.asEffect().pipe(
      Effect.provide(makeOptionalPrReviewLayer()),
      Effect.provide(serverContext),
    ),
  );
  const githubLoader = yield* Effect.cached(
    GitHub.asEffect().pipe(
      Effect.provide(makeOptionalGitHubLayer()),
      Effect.provide(serverContext),
    ),
  );
  const skillServiceLoader = yield* Effect.cached(
    SkillService.asEffect().pipe(
      Effect.provide(makeOptionalSkillServiceLayer()),
      Effect.provide(serverContext),
    ),
  );
  const terminalRuntimeEnvResolverLoader = yield* Effect.cached(
    TerminalRuntimeEnvResolver.asEffect().pipe(
      Effect.provide(makeOptionalTerminalRuntimeEnvResolverLayer()),
      Effect.provide(serverContext),
    ),
  );
  const terminalManagerWithSubscription = yield* Effect.cached(
    Effect.gen(function* () {
      const terminalManager = yield* TerminalManager.asEffect().pipe(
        Effect.provide(makeOptionalTerminalManagerLayer()),
        Effect.provide(serverContext),
      );
      const unsubscribeTerminalEvents = yield* terminalManager.subscribe(
        (event) => void Effect.runPromise(pushBus.publishAll(WS_CHANNELS.terminalEvent, event)),
      );
      yield* Effect.addFinalizer(() => Effect.sync(() => unsubscribeTerminalEvents()));
      yield* readiness.markTerminalSubscriptionsReady;
      return terminalManager;
    }),
  );

  // ── File tree watcher ──────────────────────────────────────────────
  // Watch the workspace directory for file system changes and push
  // notifications so the client can refresh the file tree automatically.
  const FILE_TREE_DEBOUNCE_MS = 300;
  const IGNORED_WATCHER_DIRS = new Set([
    ".git",
    "node_modules",
    ".next",
    ".turbo",
    "dist",
    "build",
    "out",
    ".cache",
  ]);

  let fileTreeDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // fs.watch throws ENOENT when the directory does not exist (e.g. in tests
  // or when a workspace path has been removed).  Guard against this so the
  // server can still start up.
  const fileTreeWatcher = yield* Effect.sync(() => {
    try {
      return fs.watch(cwd, { recursive: true }, (_eventType, filename) => {
        if (!filename) return;

        // Ignore changes inside noisy directories
        const normalized = String(filename).replaceAll("\\", "/");
        const firstSegment = normalized.split("/")[0];
        if (firstSegment && IGNORED_WATCHER_DIRS.has(firstSegment)) return;

        // Debounce rapid consecutive changes into a single push
        if (fileTreeDebounceTimer) clearTimeout(fileTreeDebounceTimer);
        fileTreeDebounceTimer = setTimeout(() => {
          fileTreeDebounceTimer = null;
          clearWorkspaceIndexCache(cwd);
          void Effect.runPromise(pushBus.publishAll(WS_CHANNELS.projectFileTreeChanged, { cwd }));
        }, FILE_TREE_DEBOUNCE_MS);
      });
    } catch {
      return undefined;
    }
  });

  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      fileTreeWatcher?.close();
      if (fileTreeDebounceTimer) clearTimeout(fileTreeDebounceTimer);
    }),
  );

  yield* NodeHttpServer.make(() => httpServer, listenOptions).pipe(
    Effect.mapError((cause) => new ServerLifecycleError({ operation: "httpServerListen", cause })),
  );
  yield* readiness.markHttpListening;

  yield* Effect.addFinalizer(() =>
    Effect.all([closeAllClients, closeWebSocketServer.pipe(Effect.ignoreCause({ log: true }))]),
  );

  const domainRouteHandlers = {
    ...createOrchestrationRouteHandlers({
      projectionReadModelQuery,
      normalizeDispatchCommand,
      orchestrationEngine,
      checkpointDiffQuery,
    } as any),
    ...createGitRouteHandlers({
      projectionReadModelQuery,
      resolveRuntimeEnvironment,
      git,
      gitManagerLoader,
      runTrackedGitRequest,
      stopActiveGitRequest,
      pushBus,
      collectMergedWorktreeCleanupCandidates,
    } as any),
    ...createPrReviewRouteHandlers({
      prReviewLoader,
      pushBus,
    } as any),
    ...createGitHubRouteHandlers({
      githubLoader,
    } as any),
    ...createTerminalRouteHandlers({
      terminalRuntimeEnvResolverLoader,
      terminalManagerWithSubscription,
      logger,
    } as any),
    ...createSkillRouteHandlers({
      skillServiceLoader,
    } as any),
    ...createWorkspaceRouteHandlers({
      searchWorkspaceEntries,
      listWorkspaceDirectory,
      resolveCheckPath,
      fileSystem,
      path,
      resolveWorkspaceWritePath,
      resolveFilePreview,
      containsBinaryBytes,
      buildPreviewDataUrl,
      createRouteRequestError: (message: string) => new RouteRequestError({ message }),
    } as any),
    ...createShellRouteHandlers({
      openInEditor,
      openInFileManager,
      revealInFileManager,
    } as any),
    ...createServerRouteHandlers({
      cwd,
      host,
      port,
      keybindingsConfigPath,
      availableEditors,
      serverBuildInfo,
      serverVersion,
      keybindingsManager,
      getProviderStatuses,
      getCodexConfigSummary: readCodexConfigSummary,
      environmentVariables,
      isLocalWebSocketClient,
      pickFolder: pickFolderNative,
      tokenManager,
      openclawGatewayConfig,
      publishServerConfigUpdated,
      testOpenclawGateway,
      isNewerSemver,
      createRouteRequestError: (message: string) => new RouteRequestError({ message }),
    } as any),
  };

  const routeRequest = Effect.fnUntraced(function* (ws: WebSocket, request: WebSocketRequest) {
    const domainHandler = domainRouteHandlers[request.body._tag];
    if (domainHandler) {
      return yield* domainHandler(ws, request);
    }

    return yield* new RouteRequestError({
      message: `Unknown method: ${String(request.body._tag)}`,
    });
  });

  const serializeWebSocketError = (
    request: WebSocketRequest,
    cause: Cause.Cause<unknown>,
  ): WebSocketError => {
    const squashed = Cause.squash(cause);
    if (
      request.body._tag === WS_METHODS.gitRunStackedAction &&
      squashed instanceof GitActionExecutionError
    ) {
      return {
        message: redactSensitiveText(squashed.failure.summary),
        code: "git_action_failed",
        data: redactSensitiveValue(squashed.failure),
      };
    }

    if (
      (request.body._tag === WS_METHODS.gitRunStackedAction ||
        request.body._tag === WS_METHODS.gitPull) &&
      Schema.is(GitActionStoppedError)(squashed)
    ) {
      return {
        message: redactSensitiveText(squashed.message),
        code: "git_action_stopped",
      };
    }

    if (squashed instanceof Error) {
      return { message: redactSensitiveText(squashed.message) };
    }

    return { message: redactSensitiveText(Cause.pretty(cause)) };
  };

  const handleMessage = Effect.fnUntraced(function* (ws: WebSocket, raw: unknown) {
    const sendWsResponse = (response: WsResponseMessage) =>
      encodeWsResponse(response).pipe(
        Effect.tap((encodedResponse) => Effect.sync(() => ws.send(encodedResponse))),
        Effect.asVoid,
      );

    const messageText = websocketRawToString(raw);
    if (messageText === null) {
      return yield* sendWsResponse({
        id: "unknown",
        error: { message: "Invalid request format: Failed to read message" },
      });
    }

    const request = decodeWebSocketRequest(messageText);
    if (Result.isFailure(request)) {
      return yield* sendWsResponse({
        id: "unknown",
        error: { message: `Invalid request format: ${formatSchemaError(request.failure)}` },
      });
    }

    const result = yield* Effect.exit(routeRequest(ws, request.success) as Effect.Effect<unknown>);
    if (Exit.isFailure(result)) {
      return yield* sendWsResponse({
        id: request.success.id,
        error: serializeWebSocketError(request.success, result.cause),
      });
    }

    return yield* sendWsResponse({
      id: request.success.id,
      result: result.value,
    });
  });

  httpServer.on("upgrade", (request, socket, head) => {
    socket.on("error", () => {}); // Prevent unhandled `EPIPE`/`ECONNRESET` from crashing the process if the client disconnects mid-handshake

    if (authToken) {
      let providedToken: string | null = null;
      try {
        const url = new URL(request.url ?? "/", `http://localhost:${port}`);
        providedToken = url.searchParams.get("token");
      } catch {
        rejectUpgrade(socket, 400, "Invalid WebSocket URL");
        return;
      }

      if (!tokenManager.validate(providedToken)) {
        rejectUpgrade(socket, 401, "Unauthorized WebSocket connection");
        return;
      }
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws, request) => {
    captureWebSocketRemoteAddress(ws, request);
    const segments = cwd.split(/[/\\]/).filter(Boolean);
    const projectName = segments[segments.length - 1] ?? "project";

    const welcomeData = {
      cwd,
      projectName,
      ...(welcomeBootstrapProjectId ? { bootstrapProjectId: welcomeBootstrapProjectId } : {}),
      ...(welcomeBootstrapThreadId ? { bootstrapThreadId: welcomeBootstrapThreadId } : {}),
    };
    // Send welcome before adding to broadcast set so publishAll calls
    // cannot reach this client before the welcome arrives.
    void runPromise(
      readiness.awaitServerReady.pipe(
        Effect.flatMap(() => pushBus.publishClient(ws, WS_CHANNELS.serverWelcome, welcomeData)),
        Effect.flatMap((delivered) =>
          delivered ? Ref.update(clients, (clients) => clients.add(ws)) : Effect.void,
        ),
      ),
    );

    ws.on("message", (raw) => {
      void runPromise(handleMessage(ws, raw).pipe(Effect.ignoreCause({ log: true })));
    });

    ws.on("close", () => {
      void runPromise(
        Effect.all([
          interruptActiveGitRequests(ws),
          Ref.update(clients, (clients) => {
            clients.delete(ws);
            return clients;
          }),
        ]).pipe(Effect.asVoid),
      );
    });

    ws.on("error", () => {
      void runPromise(
        Effect.all([
          interruptActiveGitRequests(ws),
          Ref.update(clients, (clients) => {
            clients.delete(ws);
            return clients;
          }),
        ]).pipe(Effect.asVoid),
      );
    });
  });

  return httpServer;
});

export const ServerLive = Layer.succeed(Server, {
  start: createServer(),
  stopSignal: Effect.never,
} satisfies ServerShape);
