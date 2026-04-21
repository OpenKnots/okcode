import { useSyncExternalStore } from "react";

import {
  createWsNativeApi,
  getTransportStateSnapshot,
  onTransportStateChange,
} from "../wsNativeApi";
import type { TransportState } from "../wsTransport";

function subscribe(callback: () => void): () => void {
  createWsNativeApi();
  return onTransportStateChange(() => callback());
}

function getServerSnapshot(): TransportState {
  return "connecting";
}

export function useTransportState(): TransportState {
  return useSyncExternalStore(subscribe, getTransportStateSnapshot, getServerSnapshot);
}
