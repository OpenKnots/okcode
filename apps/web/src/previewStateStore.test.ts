import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "okcode:desktop-preview:v5";

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
      openByProjectId: {},
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

  it("toggles project open state", () => {
    const store = usePreviewStateStore.getState();
    const projectId = "test-project-id" as any;

    store.setProjectOpen(projectId, true);
    expect(usePreviewStateStore.getState().openByProjectId[projectId]).toBe(true);
    expect(storage.get(STORAGE_KEY)).toContain('"openByProjectId"');

    store.toggleProjectOpen(projectId);
    expect(usePreviewStateStore.getState().openByProjectId[projectId]).toBe(false);
  });

  it("scopes open state per project", () => {
    const store = usePreviewStateStore.getState();
    const projectA = "project-a" as any;
    const projectB = "project-b" as any;

    store.setProjectOpen(projectA, true);
    expect(usePreviewStateStore.getState().openByProjectId[projectA]).toBe(true);
    expect(usePreviewStateStore.getState().openByProjectId[projectB]).toBeUndefined();

    store.setProjectOpen(projectB, false);
    expect(usePreviewStateStore.getState().openByProjectId[projectA]).toBe(true);
    expect(usePreviewStateStore.getState().openByProjectId[projectB]).toBe(false);
  });
});
