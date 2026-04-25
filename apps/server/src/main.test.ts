import { mkdtempSync } from "node:fs";
import * as Http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it, vi } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Command from "effect/unstable/cli/Command";
import { FetchHttpClient } from "effect/unstable/http";
import { beforeEach } from "vitest";
import { NetService } from "@okcode/shared/Net";

import { CliConfig, okcodeCli, type CliConfigShape } from "./main";
import { ServerConfig, type ServerConfigShape } from "./config";
import { Open, type OpenShape } from "./open";
import { OpenclawGatewayConfig } from "./persistence/Services/OpenclawGatewayConfig";
import { Server, type ServerShape } from "./wsServer";

const start = vi.fn(() => undefined);
const stop = vi.fn(() => undefined);
let resolvedConfig: ServerConfigShape | null = null;
let testWorkspaceRoot = "";
const CLI_TEST_TIMEOUT_MS = 30_000;
const serverStart = Effect.acquireRelease(
  Effect.gen(function* () {
    resolvedConfig = yield* ServerConfig;
    start();
    return {} as unknown as Http.Server;
  }),
  () => Effect.sync(() => stop()),
);
const findAvailablePort = vi.fn((preferred: number) => Effect.succeed(preferred));

// Shared service layer used by this CLI test suite.
const testLayer = Layer.mergeAll(
  Layer.effect(
    CliConfig,
    Effect.sync(
      () =>
        ({
          cwd: testWorkspaceRoot,
          fixPath: Effect.void,
          resolveStaticDir: Effect.undefined,
        }) satisfies CliConfigShape,
    ),
  ),
  Layer.succeed(NetService, {
    canListenOnHost: () => Effect.succeed(true),
    isPortAvailableOnLoopback: () => Effect.succeed(true),
    reserveLoopbackPort: () => Effect.succeed(0),
    findAvailablePort,
  }),
  Layer.succeed(Server, {
    start: serverStart,
    stopSignal: Effect.void,
  } satisfies ServerShape),
  Layer.succeed(OpenclawGatewayConfig, {
    getSummary: () =>
      Effect.succeed({
        gatewayUrl: null,
        hasSharedSecret: false,
        deviceId: null,
        devicePublicKey: null,
        deviceFingerprint: null,
        hasDeviceToken: false,
        deviceTokenRole: null,
        deviceTokenScopes: [],
        updatedAt: null,
      }),
    getStored: () => Effect.succeed(null),
    save: () => Effect.die("unexpected openclaw save"),
    resolveForConnect: () => Effect.succeed(null),
    saveDeviceToken: () => Effect.void,
    clearDeviceToken: () => Effect.void,
    resetDeviceState: () =>
      Effect.succeed({
        gatewayUrl: null,
        hasSharedSecret: false,
        deviceId: null,
        devicePublicKey: null,
        deviceFingerprint: null,
        hasDeviceToken: false,
        deviceTokenRole: null,
        deviceTokenScopes: [],
        updatedAt: null,
      }),
  }),
  Layer.succeed(Open, {
    openBrowser: (_target: string) => Effect.void,
    openInEditor: () => Effect.void,
    openInFileManager: () => Effect.void,
    revealInFileManager: () => Effect.void,
  } satisfies OpenShape),
  FetchHttpClient.layer,
  NodeServices.layer,
);

const runCli = (
  args: ReadonlyArray<string>,
  env: Record<string, string> = { OKCODE_NO_BROWSER: "true" },
) => {
  return Command.runWith(okcodeCli, { version: "0.0.0-test" })(args).pipe(
    Effect.provide(
      ConfigProvider.layer(
        ConfigProvider.fromEnv({
          env: {
            ...env,
          },
        }),
      ),
    ),
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  resolvedConfig = null;
  testWorkspaceRoot = mkdtempSync(join(tmpdir(), "okcode-main-test-"));
  start.mockImplementation(() => undefined);
  stop.mockImplementation(() => undefined);
  findAvailablePort.mockImplementation((preferred: number) => Effect.succeed(preferred));
});

it.layer(testLayer)("server CLI command", (it) => {
  it.effect(
    "parses all CLI flags and wires scoped start/stop",
    () =>
      Effect.gen(function* () {
        yield* runCli([
          "--mode",
          "desktop",
          "--port",
          "4010",
          "--host",
          "0.0.0.0",
          "--home-dir",
          "/tmp/t3-cli-home",
          "--dev-url",
          "http://127.0.0.1:5173",
          "--no-browser",
          "--auth-token",
          "auth-secret",
        ]);

        assert.equal(start.mock.calls.length, 1);
        assert.equal(resolvedConfig?.mode, "desktop");
        assert.equal(resolvedConfig?.port, 4010);
        assert.equal(resolvedConfig?.host, "0.0.0.0");
        assert.equal(resolvedConfig?.baseDir, "/tmp/t3-cli-home");
        assert.equal(resolvedConfig?.stateDir, "/tmp/t3-cli-home/dev");
        assert.equal(resolvedConfig?.devUrl?.toString(), "http://127.0.0.1:5173/");
        assert.equal(resolvedConfig?.noBrowser, true);
        assert.equal(resolvedConfig?.authToken, "auth-secret");
        assert.equal(resolvedConfig?.autoBootstrapProjectFromCwd, false);
        assert.equal(resolvedConfig?.logWebSocketEvents, true);
        assert.equal(stop.mock.calls.length, 1);
      }),
    CLI_TEST_TIMEOUT_MS,
  );

  it.effect(
    "supports --token as an alias for --auth-token",
    () =>
      Effect.gen(function* () {
        yield* runCli(["--token", "token-secret"]);

        assert.equal(start.mock.calls.length, 1);
        assert.equal(resolvedConfig?.authToken, "token-secret");
      }),
    CLI_TEST_TIMEOUT_MS,
  );

  it.effect(
    "uses env fallbacks when flags are not provided",
    () =>
      Effect.gen(function* () {
        yield* runCli([], {
          OKCODE_MODE: "desktop",
          OKCODE_PORT: "4999",
          OKCODE_HOST: "100.88.10.4",
          OKCODE_HOME: "/tmp/t3-env-home",
          VITE_DEV_SERVER_URL: "http://localhost:5173",
          OKCODE_NO_BROWSER: "true",
          OKCODE_AUTH_TOKEN: "env-token",
        });

        assert.equal(start.mock.calls.length, 1);
        assert.equal(resolvedConfig?.mode, "desktop");
        assert.equal(resolvedConfig?.port, 4999);
        assert.equal(resolvedConfig?.host, "100.88.10.4");
        assert.equal(resolvedConfig?.baseDir, "/tmp/t3-env-home");
        assert.equal(resolvedConfig?.stateDir, "/tmp/t3-env-home/dev");
        assert.equal(resolvedConfig?.devUrl?.toString(), "http://localhost:5173/");
        assert.equal(resolvedConfig?.noBrowser, true);
        assert.equal(resolvedConfig?.authToken, "env-token");
        assert.equal(resolvedConfig?.autoBootstrapProjectFromCwd, false);
        assert.equal(resolvedConfig?.logWebSocketEvents, true);
        assert.equal(findAvailablePort.mock.calls.length, 0);
      }),
    CLI_TEST_TIMEOUT_MS,
  );

  it.effect(
    "prefers --mode over OKCODE_MODE",
    () =>
      Effect.gen(function* () {
        findAvailablePort.mockImplementation((_preferred: number) => Effect.succeed(4666));
        yield* runCli(["--mode", "web"], {
          OKCODE_MODE: "desktop",
          OKCODE_NO_BROWSER: "true",
        });

        assert.deepStrictEqual(findAvailablePort.mock.calls, [[3773]]);
        assert.equal(start.mock.calls.length, 1);
        assert.equal(resolvedConfig?.mode, "web");
        assert.equal(resolvedConfig?.port, 4666);
        assert.equal(resolvedConfig?.host, undefined);
      }),
    CLI_TEST_TIMEOUT_MS,
  );

  it.effect(
    "prefers --no-browser over OKCODE_NO_BROWSER",
    () =>
      Effect.gen(function* () {
        yield* runCli(["--no-browser"], {
          OKCODE_NO_BROWSER: "false",
        });

        assert.equal(start.mock.calls.length, 1);
        assert.equal(resolvedConfig?.noBrowser, true);
      }),
    CLI_TEST_TIMEOUT_MS,
  );

  it.effect(
    "uses dynamic port discovery in web mode when port is omitted",
    () =>
      Effect.gen(function* () {
        findAvailablePort.mockImplementation((_preferred: number) => Effect.succeed(5444));
        yield* runCli([]);

        assert.deepStrictEqual(findAvailablePort.mock.calls, [[3773]]);
        assert.equal(start.mock.calls.length, 1);
        assert.equal(resolvedConfig?.port, 5444);
        assert.equal(resolvedConfig?.mode, "web");
      }),
    CLI_TEST_TIMEOUT_MS,
  );

  it.effect(
    "uses fixed localhost defaults in desktop mode",
    () =>
      Effect.gen(function* () {
        yield* runCli([], {
          OKCODE_MODE: "desktop",
          OKCODE_NO_BROWSER: "true",
        });

        assert.equal(findAvailablePort.mock.calls.length, 0);
        assert.equal(start.mock.calls.length, 1);
        assert.equal(resolvedConfig?.port, 3773);
        assert.equal(resolvedConfig?.host, "127.0.0.1");
        assert.equal(resolvedConfig?.mode, "desktop");
      }),
    CLI_TEST_TIMEOUT_MS,
  );

  it.effect(
    "allows overriding desktop host with --host",
    () =>
      Effect.gen(function* () {
        yield* runCli(["--host", "0.0.0.0"], {
          OKCODE_MODE: "desktop",
          OKCODE_NO_BROWSER: "true",
        });

        assert.equal(start.mock.calls.length, 1);
        assert.equal(resolvedConfig?.mode, "desktop");
        assert.equal(resolvedConfig?.host, "0.0.0.0");
      }),
    CLI_TEST_TIMEOUT_MS,
  );

  it.effect(
    "supports CLI and env for bootstrap/log websocket toggles",
    () =>
      Effect.gen(function* () {
        yield* runCli(["--auto-bootstrap-project-from-cwd"], {
          OKCODE_MODE: "desktop",
          OKCODE_LOG_WS_EVENTS: "false",
          OKCODE_AUTO_BOOTSTRAP_PROJECT_FROM_CWD: "false",
          OKCODE_NO_BROWSER: "true",
        });

        assert.equal(start.mock.calls.length, 1);
        assert.equal(resolvedConfig?.autoBootstrapProjectFromCwd, true);
        assert.equal(resolvedConfig?.logWebSocketEvents, false);
      }),
    CLI_TEST_TIMEOUT_MS,
  );

  it.effect("does not start server for invalid --mode values", () =>
    Effect.gen(function* () {
      yield* runCli(["--mode", "invalid"]);

      assert.equal(start.mock.calls.length, 0);
      assert.equal(stop.mock.calls.length, 0);
    }),
  );

  it.effect("does not start server for invalid --dev-url values", () =>
    Effect.gen(function* () {
      yield* runCli(["--dev-url", "not-a-url"]).pipe(Effect.catch(() => Effect.void));

      assert.equal(start.mock.calls.length, 0);
      assert.equal(stop.mock.calls.length, 0);
    }),
  );

  it.effect("does not start server for out-of-range --port values", () =>
    Effect.gen(function* () {
      yield* runCli(["--port", "70000"]);

      // effect/unstable/cli renders help/errors for parse failures and returns success.
      assert.equal(start.mock.calls.length, 0);
      assert.equal(stop.mock.calls.length, 0);
    }),
  );
});
