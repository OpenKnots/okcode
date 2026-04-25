import { WS_METHODS } from "@okcode/contracts";
import { Effect } from "effect";

import type { WebSocketRouteRegistry } from "./shared";
import { stripTaggedBody } from "./shared";

export function createServerRouteHandlers(input: {
  cwd: string;
  host: string | undefined;
  port: number;
  keybindingsConfigPath: string;
  availableEditors: ReadonlyArray<unknown>;
  serverBuildInfo: unknown;
  serverVersion: string;
  keybindingsManager: {
    loadConfigState: Effect.Effect<{ keybindings: unknown; issues: unknown }, unknown, never>;
    upsertKeybindingRule: (body: unknown) => Effect.Effect<unknown, unknown, never>;
    replaceKeybindingRules: (
      command: unknown,
      rules: unknown,
    ) => Effect.Effect<unknown, unknown, never>;
  };
  getProviderStatuses: () => Effect.Effect<unknown, unknown, never>;
  getCodexConfigSummary: () => Effect.Effect<unknown, unknown, never>;
  environmentVariables: {
    getGlobal: () => Effect.Effect<unknown, unknown, never>;
    saveGlobal: (body: unknown) => Effect.Effect<unknown, unknown, never>;
    getProject: (body: unknown) => Effect.Effect<unknown, unknown, never>;
    saveProject: (body: unknown) => Effect.Effect<unknown, unknown, never>;
  };
  isLocalWebSocketClient: (ws: unknown) => boolean;
  pickFolder: () => string | null;
  tokenManager: {
    generatePairingToken: (input: { ttlSeconds: number; label?: string | null | undefined }) => {
      tokenValue: string;
      expiresAt: string | number | Date;
    };
    rotate: () => {
      previousTokenId: string;
      newRecord: {
        tokenValue: string;
        tokenId: string;
        createdAt: string;
      };
    };
    revoke: (tokenId: string) => boolean;
    list: () => unknown;
  };
  openclawGatewayConfig: {
    getSummary: () => Effect.Effect<unknown, unknown, never>;
    save: (body: unknown) => Effect.Effect<unknown, unknown, never>;
    resetDeviceState: (body: unknown) => Effect.Effect<unknown, unknown, never>;
    resolveForConnect: (body: unknown) => Effect.Effect<any, unknown, never>;
  };
  publishServerConfigUpdated: () => Effect.Effect<void, unknown, never>;
  testOpenclawGateway: (body: unknown) => Effect.Effect<unknown, unknown, never>;
  isNewerSemver: (a: string, b: string) => boolean;
  createRouteRequestError: (message: string) => unknown;
}): WebSocketRouteRegistry {
  return {
    [WS_METHODS.serverGetConfig]: () =>
      Effect.gen(function* () {
        const keybindingsConfig = yield* input.keybindingsManager.loadConfigState;
        const providers = yield* input.getProviderStatuses();
        const codexConfig = yield* input.getCodexConfigSummary();
        return {
          cwd: input.cwd,
          keybindingsConfigPath: input.keybindingsConfigPath,
          keybindings: keybindingsConfig.keybindings,
          issues: keybindingsConfig.issues,
          providers,
          codexConfig,
          availableEditors: input.availableEditors,
          buildInfo: input.serverBuildInfo,
        };
      }),

    [WS_METHODS.serverCheckUpdate]: () =>
      Effect.gen(function* () {
        const latestVersion = yield* Effect.tryPromise(async () => {
          const res = await fetch("https://registry.npmjs.org/okcodes/latest", {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(10_000),
          });
          if (!res.ok) return null;
          const data = (await res.json()) as Record<string, unknown>;
          return typeof data["version"] === "string" ? data["version"] : null;
        }).pipe(Effect.orElseSucceed(() => null as string | null));
        const updateAvailable =
          latestVersion !== null && input.isNewerSemver(latestVersion, input.serverVersion);
        return {
          currentVersion: input.serverVersion,
          latestVersion,
          updateAvailable,
        };
      }),

    [WS_METHODS.serverUpsertKeybinding]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any);
        const keybindingsConfig = yield* input.keybindingsManager.upsertKeybindingRule(body);
        return { keybindings: keybindingsConfig, issues: [] };
      }),

    [WS_METHODS.serverReplaceKeybindingRules]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any);
        const keybindingsConfig = yield* input.keybindingsManager.replaceKeybindingRules(
          body.command,
          body.rules,
        );
        return { keybindings: keybindingsConfig, issues: [] };
      }),

    [WS_METHODS.serverGetGlobalEnvironmentVariables]: () => input.environmentVariables.getGlobal(),

    [WS_METHODS.serverSaveGlobalEnvironmentVariables]: (_ws, request) =>
      input.environmentVariables.saveGlobal(stripTaggedBody(request.body as any)),

    [WS_METHODS.serverGetProjectEnvironmentVariables]: (_ws, request) =>
      input.environmentVariables.getProject(stripTaggedBody(request.body as any)),

    [WS_METHODS.serverSaveProjectEnvironmentVariables]: (_ws, request) =>
      input.environmentVariables.saveProject(stripTaggedBody(request.body as any)),

    [WS_METHODS.serverPickFolder]: (ws) =>
      Effect.gen(function* () {
        if (!input.isLocalWebSocketClient(ws)) {
          return { path: null };
        }
        const pickedPath = yield* Effect.sync(() => input.pickFolder());
        return { path: pickedPath };
      }),

    [WS_METHODS.serverGeneratePairingLink]: (_ws, request) =>
      Effect.succeed(
        (() => {
          const body = stripTaggedBody(request.body as any);
          const record = input.tokenManager.generatePairingToken({
            ttlSeconds: body.ttlSeconds,
            label: body.label,
          });
          const serverUrl = `http://${input.host ?? "localhost"}:${input.port}`;
          const pairingUrl = `okcode://pair?server=${encodeURIComponent(serverUrl)}&token=${encodeURIComponent(record.tokenValue)}`;
          return {
            pairingUrl,
            token: record.tokenValue,
            expiresAt: record.expiresAt,
          };
        })(),
      ),

    [WS_METHODS.serverRotateToken]: () => {
      const { previousTokenId, newRecord } = input.tokenManager.rotate();
      return Effect.succeed({
        previousTokenId,
        newToken: newRecord.tokenValue,
        newTokenId: newRecord.tokenId,
        issuedAt: newRecord.createdAt,
      });
    },

    [WS_METHODS.serverRevokeToken]: (_ws, request) => {
      const body = stripTaggedBody(request.body as any);
      const revoked = input.tokenManager.revoke(body.tokenId);
      return Effect.succeed({ tokenId: body.tokenId, revoked });
    },

    [WS_METHODS.serverListTokens]: () => Effect.succeed({ tokens: input.tokenManager.list() }),

    [WS_METHODS.serverGetOpenclawGatewayConfig]: () => input.openclawGatewayConfig.getSummary(),

    [WS_METHODS.serverSaveOpenclawGatewayConfig]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any);
        const summary = yield* input.openclawGatewayConfig.save(body);
        yield* input.publishServerConfigUpdated();
        return summary;
      }),

    [WS_METHODS.serverResetOpenclawGatewayDeviceState]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any);
        const summary = yield* input.openclawGatewayConfig.resetDeviceState(body);
        yield* input.publishServerConfigUpdated();
        return summary;
      }),

    [WS_METHODS.serverTestOpenclawGateway]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any);
        const resolvedConfig = yield* input.openclawGatewayConfig.resolveForConnect({
          ...(body.gatewayUrl ? { gatewayUrl: body.gatewayUrl } : {}),
          ...(body.password ? { sharedSecret: body.password } : {}),
          allowEphemeralIdentity: body.gatewayUrl !== undefined,
        });
        if (!resolvedConfig) {
          return yield* Effect.fail(
            input.createRouteRequestError(
              "OpenClaw gateway URL is not configured. Save it in Settings or provide a test override.",
            ),
          );
        }
        const result = yield* input.testOpenclawGateway({
          gatewayUrl: resolvedConfig.gatewayUrl,
          password: body.password ?? resolvedConfig.sharedSecret,
        });
        yield* input.publishServerConfigUpdated();
        return result;
      }),

    [WS_METHODS.serverPing]: () =>
      Effect.succeed({
        pong: true,
        serverTime: Date.now(),
      }),
  };
}
