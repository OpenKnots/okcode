import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { CliConfig, okcodeCli } from "./main";
import { OpenLive } from "./open";
import { Command } from "effect/unstable/cli";
import { version } from "../package.json" with { type: "json" };
import { ServerLive } from "./wsServer";
import { NetService } from "@okcode/shared/Net";
import { FetchHttpClient } from "effect/unstable/http";
import { OpenclawGatewayConfig } from "./persistence/Services/OpenclawGatewayConfig";

const RuntimeLayer = Layer.empty.pipe(
  Layer.provideMerge(CliConfig.layer),
  Layer.provideMerge(ServerLive),
  Layer.provideMerge(OpenLive),
  Layer.provideMerge(
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
  ),
  Layer.provideMerge(NetService.layer),
  Layer.provideMerge(NodeServices.layer),
  Layer.provideMerge(FetchHttpClient.layer),
);

Command.run(okcodeCli, { version }).pipe(Effect.provide(RuntimeLayer), NodeRuntime.runMain);
