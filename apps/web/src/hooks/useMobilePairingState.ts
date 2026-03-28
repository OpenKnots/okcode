import type { MobilePairingState } from "@okcode/contracts";
import { useEffect, useState } from "react";

import { readMobileBridge } from "../lib/runtimeBridge";

export function useMobilePairingState() {
  const mobileBridge = readMobileBridge();
  const [state, setState] = useState<MobilePairingState | null>(null);

  useEffect(() => {
    if (!mobileBridge) {
      setState(null);
      return;
    }

    let disposed = false;
    void mobileBridge.getPairingState().then((nextState) => {
      if (!disposed) {
        setState(nextState);
      }
    });
    const unsubscribe = mobileBridge.onPairingState((nextState) => {
      if (!disposed) {
        setState(nextState);
      }
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [mobileBridge]);

  return {
    isMobileShell: mobileBridge !== undefined,
    isLoading: mobileBridge !== undefined && state === null,
    pairingState: state,
  } as const;
}
