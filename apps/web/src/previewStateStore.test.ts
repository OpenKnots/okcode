import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "okcode:desktop-preview:v6";

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
      openByThreadId: {},
      dockByProjectId: {},
      sizeByProjectId: {},
      presetByProjectId: {},
      orientationByProjectId: {},
      customViewportByProjectId: {},
      favoriteUrls: [],
      layoutModeByProjectId: {},
      previousLayoutModeByProjectId: {},
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

  it("toggles thread open state", () => {
    const store = usePreviewStateStore.getState();
    const threadId = "test-thread-id" as any;

    store.setThreadOpen(threadId, true);
    expect(usePreviewStateStore.getState().openByThreadId[threadId]).toBe(true);
    expect(storage.get(STORAGE_KEY)).toContain('"openByThreadId"');

    store.toggleThreadOpen(threadId);
    expect(usePreviewStateStore.getState().openByThreadId[threadId]).toBe(false);
  });

  it("scopes open state per thread", () => {
    const store = usePreviewStateStore.getState();
    const threadA = "thread-a" as any;
    const threadB = "thread-b" as any;

    store.setThreadOpen(threadA, true);
    expect(usePreviewStateStore.getState().openByThreadId[threadA]).toBe(true);
    expect(usePreviewStateStore.getState().openByThreadId[threadB]).toBeUndefined();

    store.setThreadOpen(threadB, false);
    expect(usePreviewStateStore.getState().openByThreadId[threadA]).toBe(true);
    expect(usePreviewStateStore.getState().openByThreadId[threadB]).toBe(false);
  });

  it("does not migrate old project-scoped open state into the new thread-scoped field", async () => {
    storage.set(
      "okcode:desktop-preview:v5",
      JSON.stringify({
        openByProjectId: { "project-a": true },
        dockByProjectId: { "project-a": "top" },
        sizeByProjectId: { "project-a": 420 },
      }),
    );

    vi.resetModules();
    ({ usePreviewStateStore } = await import("./previewStateStore"));

    expect(usePreviewStateStore.getState().openByThreadId).toEqual({});
    expect(usePreviewStateStore.getState().dockByProjectId["project-a"]).toBe("top");
    expect(usePreviewStateStore.getState().sizeByProjectId["project-a"]).toBe(420);
  });
});
