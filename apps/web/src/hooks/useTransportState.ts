import { useSyncExternalStore } from "react";

import { createWsNativeApi, onTransportStateChange } from "../wsNativeApi";
import type { TransportState } from "../wsTransport";

function getServerSnapshot(): TransportState {
  return "connecting";
}

export function useTransportState(): TransportState {
  return useSyncExternalStore(
    (callback) => {
      createWsNativeApi();
      return onTransportStateChange(() => callback());
    },
    () => {
      let state: TransportState = "connecting";
      const unsubscribe = onTransportStateChange((nextState) => {
        state = nextState;
      });
      unsubscribe();
      return state;
    },
    getServerSnapshot,
  );
}
