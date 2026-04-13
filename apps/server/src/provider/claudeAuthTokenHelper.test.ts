import { describe, expect, it, vi } from "vitest";

import { readClaudeAuthTokenFromHelperCommand } from "./claudeAuthTokenHelper";

describe("readClaudeAuthTokenFromHelperCommand", () => {
  it("runs the helper command through a shell and trims the token", () => {
    const spawnSync = vi.fn(() => ({
      pid: 123,
      output: ["", "  token-from-helper  \n", ""],
      error: undefined,
      status: 0,
      signal: null,
      stdout: "  token-from-helper  \n",
      stderr: "",
    })) as unknown as typeof import("node:child_process").spawnSync;

    const token = readClaudeAuthTokenFromHelperCommand("op read op://shared/anthropic/token", {
      cwd: "/tmp/project",
      env: { PATH: "/usr/bin" },
      platform: "linux",
      spawnSync,
      timeoutMs: 1234,
      maxBuffer: 2048,
    });

    expect(token).toBe("token-from-helper");
    expect(spawnSync).toHaveBeenCalledWith(
      "/bin/sh",
      ["-lc", "op read op://shared/anthropic/token"],
      expect.objectContaining({
        cwd: "/tmp/project",
        encoding: "utf8",
        env: { PATH: "/usr/bin" },
        maxBuffer: 2048,
        timeout: 1234,
      }),
    );
  });

  it("fails when the helper command exits non-zero", () => {
    const spawnSync = vi.fn(() => ({
      pid: 123,
      output: ["", "ignored-token\n", ""],
      error: undefined,
      status: 1,
      signal: null,
      stdout: "ignored-token\n",
      stderr: "secret manager unavailable",
    })) as unknown as typeof import("node:child_process").spawnSync;

    expect(() =>
      readClaudeAuthTokenFromHelperCommand("pass show anthropic/token", {
        spawnSync,
        platform: "linux",
      }),
    ).toThrow("secret manager unavailable");
  });
});
