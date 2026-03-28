import { ProjectId } from "@okcode/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "okcode:desktop-preview:v2";

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
      dockByThreadId: {},
      sizeByThreadId: {},
      urlByProjectId: {},
      favoriteUrlByProjectId: {},
    });
    storage.clear();
  });

  it("persists and clears the project favorite URL", () => {
    const projectId = ProjectId.makeUnsafe("project-1");
    const store = usePreviewStateStore.getState();

    store.setProjectFavoriteUrl(projectId, "http://localhost:3000/");
    expect(usePreviewStateStore.getState().favoriteUrlByProjectId[projectId]).toBe(
      "http://localhost:3000/",
    );
    expect(storage.get(STORAGE_KEY)).toContain('"favoriteUrlByProjectId"');

    store.toggleProjectFavorite(projectId, "http://localhost:3000/");
    expect(usePreviewStateStore.getState().favoriteUrlByProjectId[projectId]).toBeUndefined();
    expect(storage.get(STORAGE_KEY)).toContain('"favoriteUrlByProjectId":{}');
  });
});
