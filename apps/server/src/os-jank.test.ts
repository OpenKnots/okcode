import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ensureExtraPaths } from "./os-jank";

describe("ensureExtraPaths", () => {
  let originalPath: string | undefined;

  beforeEach(() => {
    originalPath = process.env.PATH;
  });

  afterEach(() => {
    process.env.PATH = originalPath;
  });

  it("prepends existing paths that are missing from PATH", () => {
    process.env.PATH = "/usr/bin:/bin";
    const fsExistsSync = vi.fn((p: string) => p === "/opt/homebrew/bin");

    ensureExtraPaths(["/opt/homebrew/bin", "/usr/local/bin"], fsExistsSync);

    expect(process.env.PATH).toBe("/opt/homebrew/bin:/usr/bin:/bin");
    expect(fsExistsSync).toHaveBeenCalledWith("/opt/homebrew/bin");
    expect(fsExistsSync).toHaveBeenCalledWith("/usr/local/bin");
  });

  it("does not add paths that do not exist on disk", () => {
    process.env.PATH = "/usr/bin:/bin";
    const fsExistsSync = vi.fn(() => false);

    ensureExtraPaths(["/opt/homebrew/bin", "/usr/local/bin"], fsExistsSync);

    expect(process.env.PATH).toBe("/usr/bin:/bin");
  });

  it("does not add paths already present in PATH", () => {
    process.env.PATH = "/opt/homebrew/bin:/usr/bin";
    const fsExistsSync = vi.fn(() => true);

    ensureExtraPaths(["/opt/homebrew/bin"], fsExistsSync);

    // PATH is unchanged — no duplicate prepend
    expect(process.env.PATH).toBe("/opt/homebrew/bin:/usr/bin");
    // existsSync should not be called for a path already in PATH
    expect(fsExistsSync).not.toHaveBeenCalled();
  });

  it("prepends multiple missing paths preserving their order", () => {
    process.env.PATH = "/usr/bin";
    const fsExistsSync = vi.fn(() => true);

    ensureExtraPaths(["/opt/homebrew/bin", "/opt/homebrew/sbin", "/usr/local/bin"], fsExistsSync);

    expect(process.env.PATH).toBe("/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin");
  });

  it("handles an empty PATH gracefully", () => {
    process.env.PATH = "";
    const fsExistsSync = vi.fn((p: string) => p === "/opt/homebrew/bin");

    ensureExtraPaths(["/opt/homebrew/bin"], fsExistsSync);

    expect(process.env.PATH).toBe("/opt/homebrew/bin");
  });
});
