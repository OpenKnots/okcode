import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ZOOM_CHANGE_EVENT,
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  clampZoom,
  clearZoom,
  getStoredZoom,
  setStoredZoom,
} from "./customTheme";

// ---------------------------------------------------------------------------
// Pure `clampZoom` — runs without any DOM fixtures.
// ---------------------------------------------------------------------------

describe("clampZoom", () => {
  it("accepts a value inside the allowed range", () => {
    expect(clampZoom(1.25)).toBe(1.25);
    expect(clampZoom(ZOOM_MIN)).toBe(ZOOM_MIN);
    expect(clampZoom(ZOOM_MAX)).toBe(ZOOM_MAX);
  });

  it("clamps below-floor inputs to ZOOM_MIN", () => {
    expect(clampZoom(0.1)).toBe(ZOOM_MIN);
    expect(clampZoom(-5)).toBe(ZOOM_MIN);
  });

  it("clamps above-ceiling inputs to ZOOM_MAX", () => {
    expect(clampZoom(5)).toBe(ZOOM_MAX);
    expect(clampZoom(999)).toBe(ZOOM_MAX);
  });

  it("falls back to default on non-finite input (edge — corrupt storage)", () => {
    expect(clampZoom(Number.NaN)).toBe(ZOOM_DEFAULT);
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(ZOOM_DEFAULT);
    expect(clampZoom(Number.NEGATIVE_INFINITY)).toBe(ZOOM_DEFAULT);
  });

  it("rounds to two decimals so successive ZOOM_STEP additions don't drift", () => {
    // 1.0 + 0.05*3 yields 1.1500000000000001 in float — verify rounding.
    const drift = 1.0 + ZOOM_STEP * 3;
    expect(clampZoom(drift)).toBe(1.15);
  });
});

// ---------------------------------------------------------------------------
// DOM-interacting helpers — exercised against a minimal fake window/document.
// The zoom code only touches `document.documentElement.style`,
// `localStorage`, and `window.dispatchEvent`, so a small shim is enough.
// ---------------------------------------------------------------------------

type StyleBag = Record<string, string>;

function createFakeDom() {
  const style: StyleBag = {};
  const store = new Map<string, string>();
  const listeners: Array<(event: Event) => void> = [];

  const documentElement = {
    style: {
      setProperty(name: string, value: string) {
        style[name] = value;
      },
      getPropertyValue(name: string) {
        return style[name] ?? "";
      },
      removeProperty(name: string) {
        delete style[name];
      },
    },
  };

  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };

  const win = {
    dispatchEvent: (event: Event) => {
      for (const listener of listeners) listener(event);
      return true;
    },
    addEventListener: (_type: string, listener: (event: Event) => void) => {
      listeners.push(listener);
    },
    removeEventListener: (_type: string, listener: (event: Event) => void) => {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    },
  };

  return {
    style,
    store,
    listeners,
    document: {
      documentElement,
      // The `hasDom()` guard also checks for getElementById + createElement.
      getElementById: () => null,
      createElement: () => ({}),
    },
    localStorage,
    window: win,
  };
}

const ZOOM_STORAGE_KEY = "okcode:app-zoom";

describe("zoom storage + apply (with DOM shim)", () => {
  let fake: ReturnType<typeof createFakeDom>;
  const originals: Record<string, PropertyDescriptor | undefined> = {};

  beforeEach(() => {
    fake = createFakeDom();
    // Stash originals so the shim doesn't leak into neighboring tests.
    originals.document = Object.getOwnPropertyDescriptor(globalThis, "document");
    originals.localStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    originals.window = Object.getOwnPropertyDescriptor(globalThis, "window");

    Object.defineProperty(globalThis, "document", { configurable: true, value: fake.document });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: fake.localStorage,
    });
    Object.defineProperty(globalThis, "window", { configurable: true, value: fake.window });
  });

  afterEach(() => {
    const restore = (key: string) => {
      const descriptor = originals[key];
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        // biome-ignore lint/performance/noDelete: restoring original globals
        delete (globalThis as Record<string, unknown>)[key];
      }
    };
    restore("document");
    restore("localStorage");
    restore("window");
  });

  it("getStoredZoom returns the default when storage is empty", () => {
    expect(getStoredZoom()).toBe(ZOOM_DEFAULT);
  });

  it("getStoredZoom falls back to default when storage value is garbage", () => {
    fake.localStorage.setItem(ZOOM_STORAGE_KEY, "not-a-number");
    expect(getStoredZoom()).toBe(ZOOM_DEFAULT);
  });

  it("setStoredZoom persists a clamped value and applies it to the root style", () => {
    setStoredZoom(1.25);
    expect(fake.localStorage.getItem(ZOOM_STORAGE_KEY)).toBe("1.25");
    expect(fake.style["zoom"]).toBe("1.25");
  });

  it("setStoredZoom clamps above-ceiling input at storage time (edge)", () => {
    setStoredZoom(9);
    // Storage must not hold an out-of-range value even if the caller sends one.
    expect(fake.localStorage.getItem(ZOOM_STORAGE_KEY)).toBe(String(ZOOM_MAX));
    expect(fake.style["zoom"]).toBe(String(ZOOM_MAX));
  });

  it("clearZoom removes the stored value and resets applied zoom to 1", () => {
    setStoredZoom(1.5);
    clearZoom();
    expect(fake.localStorage.getItem(ZOOM_STORAGE_KEY)).toBe(null);
    expect(fake.style["zoom"]).toBe(String(ZOOM_DEFAULT));
  });

  it("applyZoom (via setStoredZoom) dispatches a same-window change event", () => {
    const received: number[] = [];
    fake.window.addEventListener(ZOOM_CHANGE_EVENT, (event: Event) => {
      const detail = (event as CustomEvent<number>).detail;
      received.push(detail);
    });

    setStoredZoom(1.1);
    setStoredZoom(1.2);

    // Both writes fire the event so UI subscribed via the event can re-read.
    expect(received).toEqual([1.1, 1.2]);
  });
});
