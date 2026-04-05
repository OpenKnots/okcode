import { describe, expect, it } from "vitest";

import { resolveAvailableShellPath, sanitizeShellEnvironment } from "./environment";

describe("resolveAvailableShellPath", () => {
  it("keeps a valid absolute shell path", () => {
    const result = resolveAvailableShellPath(
      {
        SHELL: "/bin/zsh",
        PATH: "/bin:/usr/bin",
      },
      {
        platform: "linux",
        existsSync: (candidate) => candidate === "/bin/zsh",
      },
    );

    expect(result).toBe("/bin/zsh");
  });

  it("falls back when SHELL points at a missing executable", () => {
    const result = resolveAvailableShellPath(
      {
        SHELL: "/definitely/missing-zsh",
        PATH: "/bin:/usr/bin",
      },
      {
        platform: "linux",
        existsSync: (candidate) => candidate === "/bin/sh",
      },
    );

    expect(result).toBe("/bin/sh");
  });

  it("resolves relative shell commands from PATH", () => {
    const result = resolveAvailableShellPath(
      {
        SHELL: "bash -lc",
        PATH: "/custom/bin:/usr/bin",
      },
      {
        platform: "linux",
        existsSync: (candidate) => candidate === "/custom/bin/bash",
      },
    );

    expect(result).toBe("/custom/bin/bash");
  });
});

describe("sanitizeShellEnvironment", () => {
  it("replaces an invalid SHELL with a discovered fallback", () => {
    const env = {
      SHELL: "/definitely/missing-zsh",
      PATH: "/bin:/usr/bin",
      KEEP_ME: "1",
    };

    const result = sanitizeShellEnvironment(env, {
      platform: "linux",
      existsSync: (candidate) => candidate === "/bin/sh",
    });

    expect(result).toEqual({
      SHELL: "/bin/sh",
      PATH: "/bin:/usr/bin",
      KEEP_ME: "1",
    });
    expect(env.SHELL).toBe("/definitely/missing-zsh");
  });

  it("removes SHELL when no viable fallback exists", () => {
    const result = sanitizeShellEnvironment(
      {
        SHELL: "/definitely/missing-zsh",
        PATH: "",
      },
      {
        platform: "linux",
        existsSync: () => false,
      },
    );

    expect(result).toEqual({
      PATH: "",
    });
  });
});
