import type { MobileConnectionState } from "@okcode/contracts";
import { useEffect, useState } from "react";

import { readMobileBridge } from "../lib/runtimeBridge";

/**
 * React hook that tracks the mobile companion connection state.
 * Returns null when not running in the mobile shell.
 */
export function useMobileConnectionState(): MobileConnectionState | null {
  const mobileBridge = readMobileBridge();
  const [state, setState] = useState<MobileConnectionState | null>(null);

  useEffect(() => {
    if (!mobileBridge) {
      setState(null);
      return;
    }

    const unsubscribe = mobileBridge.onConnectionState((nextState) => {
      setState(nextState);
    });

    return () => {
      unsubscribe();
    };
  }, [mobileBridge]);

  return mobileBridge ? state : null;
}
