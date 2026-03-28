import { describe, expect, it } from "vitest";

import {
  commandForProjectScript,
  interpolateProjectScriptCommand,
  nextProjectScriptId,
  primaryProjectScript,
  projectScriptCwd,
  projectScriptTemplateInputLabel,
  projectScriptTemplateInputs,
  projectScriptRuntimeEnv,
  projectScriptIdFromCommand,
  setupProjectScript,
} from "./projectScripts";

describe("projectScripts helpers", () => {
  it("builds and parses script run commands", () => {
    const command = commandForProjectScript("lint");
    expect(command).toBe("script.lint.run");
    expect(projectScriptIdFromCommand(command)).toBe("lint");
    expect(projectScriptIdFromCommand("terminal.toggle")).toBeNull();
  });

  it("slugifies and dedupes project script ids", () => {
    expect(nextProjectScriptId("Run Tests", [])).toBe("run-tests");
    expect(nextProjectScriptId("Run Tests", ["run-tests"])).toBe("run-tests-2");
    expect(nextProjectScriptId("!!!", [])).toBe("script");
  });

  it("resolves primary and setup scripts", () => {
    const scripts = [
      {
        id: "setup",
        name: "Setup",
        command: "bun install",
        icon: "configure" as const,
        runOnWorktreeCreate: true,
      },
      {
        id: "test",
        name: "Test",
        command: "bun test",
        icon: "test" as const,
        runOnWorktreeCreate: false,
      },
    ];

    expect(primaryProjectScript(scripts)?.id).toBe("test");
    expect(setupProjectScript(scripts)?.id).toBe("setup");
  });

  it("builds default runtime env for scripts", () => {
    const env = projectScriptRuntimeEnv({
      project: { cwd: "/repo" },
      worktreePath: "/repo/worktree-a",
    });

    expect(env).toMatchObject({
      OKCODE_PROJECT_ROOT: "/repo",
      OKCODE_WORKTREE_PATH: "/repo/worktree-a",
    });
  });

  it("allows overriding runtime env values", () => {
    const env = projectScriptRuntimeEnv({
      project: { cwd: "/repo" },
      extraEnv: {
        OKCODE_PROJECT_ROOT: "/custom-root",
        CUSTOM_FLAG: "1",
      },
    });

    expect(env.OKCODE_PROJECT_ROOT).toBe("/custom-root");
    expect(env.CUSTOM_FLAG).toBe("1");
    expect(env.OKCODE_WORKTREE_PATH).toBeUndefined();
  });

  it("prefers the worktree path for script cwd resolution", () => {
    expect(
      projectScriptCwd({
        project: { cwd: "/repo" },
        worktreePath: "/repo/worktree-a",
      }),
    ).toBe("/repo/worktree-a");
    expect(
      projectScriptCwd({
        project: { cwd: "/repo" },
        worktreePath: null,
      }),
    ).toBe("/repo");
  });

  it("extracts and formats dynamic command inputs", () => {
    expect(
      projectScriptTemplateInputs("gh pr checkout {{pr_number}} --repo {{repo_name}}"),
    ).toEqual(["pr_number", "repo_name"]);
    expect(projectScriptTemplateInputLabel("repo_name")).toBe("Repo Name");
  });

  it("interpolates dynamic command inputs", () => {
    expect(
      interpolateProjectScriptCommand("gh pr checkout {{pr_number}}", {
        pr_number: "42",
      }),
    ).toBe("gh pr checkout 42");
    expect(() =>
      interpolateProjectScriptCommand("gh pr checkout {{pr_number}}", {
        pr_number: "",
      }),
    ).toThrow('Missing a value for "pr_number".');
  });
});
