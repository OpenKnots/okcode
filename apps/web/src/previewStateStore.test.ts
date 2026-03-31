import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "okcode:desktop-preview:v3";

let usePreviewStateStore: typeof import("./previewStateStore").usePreviewStateStore;
let storage: Map<string, string>;

describe("previewStateStore", () => {
  beforeEach(async () => {
    vi.resetModules();
    storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
        clear: () => {
          storage.clear();
        },
      },
    } as Window);

    ({ usePreviewStateStore } = await import("./previewStateStore"));
    usePreviewStateStore.setState({
      globalOpen: false,
      dockByThreadId: {},
      sizeByThreadId: {},
      presetByThreadId: {},
      favoriteUrls: [],
    });
    storage.clear();
  });

  it("persists and clears favorite URLs", () => {
    const store = usePreviewStateStore.getState();

    store.addFavoriteUrl("http://localhost:3000/");
    expect(usePreviewStateStore.getState().favoriteUrls).toContain("http://localhost:3000/");
    expect(storage.get(STORAGE_KEY)).toContain('"favoriteUrls"');

    store.toggleFavoriteUrl("http://localhost:3000/");
    expect(usePreviewStateStore.getState().favoriteUrls).not.toContain("http://localhost:3000/");
  });

  it("toggles globalOpen", () => {
    const store = usePreviewStateStore.getState();

    store.setGlobalOpen(true);
    expect(usePreviewStateStore.getState().globalOpen).toBe(true);
    expect(storage.get(STORAGE_KEY)).toContain('"globalOpen":true');

    store.toggleGlobalOpen();
    expect(usePreviewStateStore.getState().globalOpen).toBe(false);
  });
});
