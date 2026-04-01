import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import type {
  MobileBridge,
  MobileConnectionState,
  MobileNotificationEvent,
  MobilePairingState,
} from "@okcode/contracts";
import { SecureStoragePlugin } from "capacitor-secure-storage-plugin";

import { parseMobilePairingInput } from "./mobilePairing";
import {
  fireNotification as fireLocalNotification,
  registerNotifications as registerLocalNotifications,
  setupNotificationTapHandler,
} from "./notifications";

const STORAGE_KEYS = {
  serverUrl: "okcode.mobile.serverUrl",
  token: "okcode.mobile.authToken",
} as const;

// ── Pairing state ────────────────────────────────────────────────────

const pairingListeners = new Set<(state: MobilePairingState) => void>();

let pairingState: MobilePairingState = {
  paired: false,
  serverUrl: null,
  tokenPresent: false,
  lastError: null,
};
let websocketUrl: string | null = null;
let initializationPromise: Promise<void> | null = null;

async function readSecureValue(key: string): Promise<string | null> {
  try {
    const result = await SecureStoragePlugin.get({ key });
    return typeof result.value === "string" && result.value.length > 0 ? result.value : null;
  } catch {
    return null;
  }
}

async function removeSecureValue(key: string): Promise<void> {
  try {
    await SecureStoragePlugin.remove({ key });
  } catch {
    // Ignore missing values.
  }
}

function emitPairingState(): void {
  for (const listener of pairingListeners) {
    try {
      listener(pairingState);
    } catch {
      // Swallow listener errors.
    }
  }
}

function setPairingState(
  nextState: MobilePairingState,
  nextWsUrl: string | null,
): MobilePairingState {
  pairingState = nextState;
  websocketUrl = nextWsUrl;
  emitPairingState();
  return pairingState;
}

async function loadPersistedPairingState(): Promise<void> {
  const [serverUrl, token] = await Promise.all([
    readSecureValue(STORAGE_KEYS.serverUrl),
    readSecureValue(STORAGE_KEYS.token),
  ]);

  if (!serverUrl || !token) {
    await Promise.all([
      removeSecureValue(STORAGE_KEYS.serverUrl),
      removeSecureValue(STORAGE_KEYS.token),
    ]);
    setPairingState(
      {
        paired: false,
        serverUrl: null,
        tokenPresent: false,
        lastError: null,
      },
      null,
    );
    return;
  }

  try {
    const parsed = parseMobilePairingInput(`${serverUrl}?token=${encodeURIComponent(token)}`);
    setPairingState(
      {
        paired: true,
        serverUrl: parsed.serverUrl,
        tokenPresent: true,
        lastError: null,
      },
      parsed.wsUrl,
    );
  } catch (error) {
    await Promise.all([
      removeSecureValue(STORAGE_KEYS.serverUrl),
      removeSecureValue(STORAGE_KEYS.token),
    ]);
    setPairingState(
      {
        paired: false,
        serverUrl: null,
        tokenPresent: false,
        lastError: error instanceof Error ? error.message : "Saved pairing is invalid.",
      },
      null,
    );
  }
}

function ensureInitialized(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = loadPersistedPairingState();
  }
  return initializationPromise;
}

async function applyPairingUrl(input: string): Promise<MobilePairingState> {
  try {
    const parsed = parseMobilePairingInput(input);
    await Promise.all([
      SecureStoragePlugin.set({ key: STORAGE_KEYS.serverUrl, value: parsed.serverUrl }),
      SecureStoragePlugin.set({ key: STORAGE_KEYS.token, value: parsed.token }),
    ]);
    return setPairingState(
      {
        paired: true,
        serverUrl: parsed.serverUrl,
        tokenPresent: true,
        lastError: null,
      },
      parsed.wsUrl,
    );
  } catch (error) {
    return setPairingState(
      {
        paired: false,
        serverUrl: null,
        tokenPresent: false,
        lastError: error instanceof Error ? error.message : "Could not pair this device.",
      },
      null,
    );
  }
}

async function clearPairing(): Promise<MobilePairingState> {
  await Promise.all([
    removeSecureValue(STORAGE_KEYS.serverUrl),
    removeSecureValue(STORAGE_KEYS.token),
  ]);
  return setPairingState(
    {
      paired: false,
      serverUrl: null,
      tokenPresent: false,
      lastError: null,
    },
    null,
  );
}

// ── Connection state ─────────────────────────────────────────────────

const connectionListeners = new Set<(state: MobileConnectionState) => void>();
let connectionState: MobileConnectionState = "disconnected";

function setConnectionState(nextState: MobileConnectionState): void {
  if (connectionState === nextState) return;
  connectionState = nextState;
  for (const listener of connectionListeners) {
    try {
      listener(connectionState);
    } catch {
      // Swallow listener errors.
    }
  }
}

// The web app's WsTransport emits state changes. The bridge listens to a
// custom event that the web layer fires so the native side can track it.
if (typeof window !== "undefined") {
  window.addEventListener("okcode:transport-state", ((event: CustomEvent<string>) => {
    const state = event.detail;
    switch (state) {
      case "open":
        setConnectionState("connected");
        break;
      case "connecting":
        setConnectionState("connecting");
        break;
      case "reconnecting":
        setConnectionState("reconnecting");
        break;
      case "closed":
      case "disposed":
        setConnectionState("disconnected");
        break;
    }
  }) as EventListener);
}

// ── Notification tap handler ─────────────────────────────────────────

setupNotificationTapHandler((threadId) => {
  if (threadId && typeof window !== "undefined") {
    // Navigate to the thread when a notification is tapped.
    // The web app listens for this custom event and handles navigation.
    window.dispatchEvent(new CustomEvent("okcode:notification-tap", { detail: { threadId } }));
  }
});

// ── Bridge export ────────────────────────────────────────────────────

const mobileBridge: MobileBridge = {
  getWsUrl: () => websocketUrl,
  getPairingState: async () => {
    await ensureInitialized();
    return pairingState;
  },
  applyPairingUrl: async (input) => {
    await ensureInitialized();
    return applyPairingUrl(input);
  },
  clearPairing: async () => {
    await ensureInitialized();
    return clearPairing();
  },
  openExternal: async (url) => {
    try {
      await Browser.open({ url });
      return true;
    } catch {
      return false;
    }
  },
  onPairingState: (listener) => {
    pairingListeners.add(listener);
    listener(pairingState);
    return () => {
      pairingListeners.delete(listener);
    };
  },

  // ── Phase 3 additions ──────────────────────────────────────────

  getConnectionState: () => connectionState,

  onConnectionState: (listener) => {
    connectionListeners.add(listener);
    listener(connectionState);
    return () => {
      connectionListeners.delete(listener);
    };
  },

  registerNotifications: async () => {
    return registerLocalNotifications();
  },

  fireNotification: async (event: MobileNotificationEvent) => {
    return fireLocalNotification(event);
  },
};

Object.defineProperty(window, "mobileBridge", {
  configurable: true,
  writable: false,
  value: mobileBridge,
});

void ensureInitialized();

void App.addListener("appUrlOpen", ({ url }) => {
  if (typeof url !== "string" || url.length === 0) {
    return;
  }

  void applyPairingUrl(url).then((nextState) => {
    if (nextState.paired) {
      window.location.reload();
    }
  });
});
