import type { ProviderRuntimeEvent } from "@okcode/contracts";
import { ServiceMap } from "effect";
import type { Effect, Stream } from "effect";

export interface ProviderRuntimeEventFeedShape {
  readonly publish: (event: ProviderRuntimeEvent) => Effect.Effect<void>;
  readonly subscribeWithReplay: () => Stream.Stream<ProviderRuntimeEvent>;
}

export class ProviderRuntimeEventFeed extends ServiceMap.Service<
  ProviderRuntimeEventFeed,
  ProviderRuntimeEventFeedShape
>()("okcode/provider/Services/ProviderRuntimeEventFeed") {}
