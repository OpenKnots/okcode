import { assert, describe, it } from "vitest";

import {
  CLIENT_MODE_STORAGE_KEY,
  persistClientMode,
  readClientModeFromSearch,
  readClientModeFromStorage,
  resolveClientMode,
} from "./clientMode";

describe("clientMode", () => {
  it("reads a client mode override from the query string", () => {
    assert.strictEqual(readClientModeFromSearch("?client=mobile"), "mobile");
    assert.strictEqual(readClientModeFromSearch("?client=desktop"), "desktop");
  });

  it("ignores invalid client mode overrides", () => {
    assert.isNull(readClientModeFromSearch("?client=tablet"));
  });

  it("reads a persisted client mode", () => {
    assert.strictEqual(
      readClientModeFromStorage({
        getItem: (key) => (key === CLIENT_MODE_STORAGE_KEY ? "mobile" : null),
      }),
      "mobile",
    );
  });

  it("persists and clears a client mode", () => {
    const writes: string[] = [];
    persistClientMode(
      {
        removeItem: (key) => writes.push(`remove:${key}`),
        setItem: (key, value) => writes.push(`set:${key}:${value}`),
      },
      "desktop",
    );
    persistClientMode(
      {
        removeItem: (key) => writes.push(`remove:${key}`),
        setItem: (key, value) => writes.push(`set:${key}:${value}`),
      },
      null,
    );

    assert.deepEqual(writes, [
      `set:${CLIENT_MODE_STORAGE_KEY}:desktop`,
      `remove:${CLIENT_MODE_STORAGE_KEY}`,
    ]);
  });

  it("resolves search override before storage and viewport heuristics", () => {
    assert.strictEqual(
      resolveClientMode({
        search: "?client=desktop",
        storedMode: "mobile",
        prefersMobileViewport: true,
      }),
      "desktop",
    );
  });

  it("falls back to storage and then viewport heuristics", () => {
    assert.strictEqual(
      resolveClientMode({
        search: "",
        storedMode: "mobile",
        prefersMobileViewport: false,
      }),
      "mobile",
    );
    assert.strictEqual(
      resolveClientMode({
        search: "",
        storedMode: null,
        prefersMobileViewport: true,
      }),
      "mobile",
    );
  });
});
