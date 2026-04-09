import type { NativeApi } from "@okcode/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createWsNativeApiMock, hasRuntimeConnectionTargetMock } = vi.hoisted(() => ({
  createWsNativeApiMock: vi.fn<() => NativeApi>(),
  hasRuntimeConnectionTargetMock: vi.fn<() => boolean>(),
}));

vi.mock("./lib/runtimeBridge", () => ({
  hasRuntimeConnectionTarget: hasRuntimeConnectionTargetMock,
}));

vi.mock("./wsNativeApi", () => ({
  createWsNativeApi: createWsNativeApiMock,
}));

function createTestApi(label: string): NativeApi {
  return { label } as unknown as NativeApi;
}

function stubWindow(value: { nativeApi?: NativeApi } = {}) {
  vi.stubGlobal("window", value as Window & typeof globalThis);
}

describe("nativeApi", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    createWsNativeApiMock.mockReset();
    hasRuntimeConnectionTargetMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns undefined when window is unavailable", async () => {
    const { readNativeApi } = await import("./nativeApi");

    expect(readNativeApi()).toBeUndefined();
    expect(hasRuntimeConnectionTargetMock).not.toHaveBeenCalled();
    expect(createWsNativeApiMock).not.toHaveBeenCalled();
  });

  it("prefers window.nativeApi over the websocket-backed native api", async () => {
    const windowApi = createTestApi("window");
    stubWindow({ nativeApi: windowApi });
    hasRuntimeConnectionTargetMock.mockReturnValue(true);

    const { readNativeApi } = await import("./nativeApi");

    expect(readNativeApi()).toBe(windowApi);
    expect(hasRuntimeConnectionTargetMock).not.toHaveBeenCalled();
    expect(createWsNativeApiMock).not.toHaveBeenCalled();
  });

  it("creates and caches the websocket-backed api when a runtime target is available", async () => {
    const wsApi = createTestApi("ws");
    stubWindow();
    hasRuntimeConnectionTargetMock.mockReturnValue(true);
    createWsNativeApiMock.mockReturnValue(wsApi);

    const { readNativeApi } = await import("./nativeApi");

    expect(readNativeApi()).toBe(wsApi);
    expect(readNativeApi()).toBe(wsApi);
    expect(hasRuntimeConnectionTargetMock).toHaveBeenCalledTimes(1);
    expect(createWsNativeApiMock).toHaveBeenCalledTimes(1);
  });

  it("returns undefined when no runtime connection target is available", async () => {
    stubWindow();
    hasRuntimeConnectionTargetMock.mockReturnValue(false);

    const { readNativeApi } = await import("./nativeApi");

    expect(readNativeApi()).toBeUndefined();
    expect(hasRuntimeConnectionTargetMock).toHaveBeenCalledTimes(1);
    expect(createWsNativeApiMock).not.toHaveBeenCalled();
  });

  it("ensureNativeApi returns the resolved api", async () => {
    const windowApi = createTestApi("window");
    stubWindow({ nativeApi: windowApi });

    const { ensureNativeApi } = await import("./nativeApi");

    expect(ensureNativeApi()).toBe(windowApi);
  });

  it("ensureNativeApi throws when no native api can be resolved", async () => {
    stubWindow();
    hasRuntimeConnectionTargetMock.mockReturnValue(false);

    const { ensureNativeApi } = await import("./nativeApi");

    expect(() => ensureNativeApi()).toThrowError("Native API not found");
  });
});
