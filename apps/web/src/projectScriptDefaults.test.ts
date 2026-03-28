import { describe, expect, it } from "vitest";

import {
  buildProjectScriptDraftsFromPackageScripts,
  materializeProjectScripts,
  parsePackageScriptInventory,
  resolvePackageManagerResolution,
} from "./projectScriptDefaults";

describe("projectScriptDefaults", () => {
  it("parses package scripts and prefers the lockfile package manager", () => {
    const inventory = parsePackageScriptInventory(
      JSON.stringify({
        name: "demo-app",
        packageManager: "npm@10.0.0",
        scripts: {
          dev: "vite",
          lint: "eslint .",
          "test:e2e": "playwright test",
        },
      }),
      [
        { path: "package.json", kind: "file" },
        { path: "bun.lock", kind: "file" },
      ],
    );

    expect(inventory.packageName).toBe("demo-app");
    expect(inventory.scriptNames).toEqual(["dev", "lint", "test:e2e"]);
    expect(resolvePackageManagerResolution(inventory)).toEqual({
      preferredPackageManager: "bun",
      requiresManualSelection: false,
      warning: null,
    });
  });

  it("warns when multiple lockfiles are present", () => {
    const inventory = parsePackageScriptInventory(
      JSON.stringify({
        scripts: {
          dev: "vite",
        },
      }),
      [
        { path: "package.json", kind: "file" },
        { path: "bun.lock", kind: "file" },
        { path: "pnpm-lock.yaml", kind: "file" },
      ],
    );

    const resolution = resolvePackageManagerResolution(inventory);
    expect(resolution.preferredPackageManager).toBeNull();
    expect(resolution.requiresManualSelection).toBe(true);
    expect(resolution.warning).toContain("Multiple package manager lockfiles");
  });

  it("builds project script drafts for package scripts", () => {
    expect(
      buildProjectScriptDraftsFromPackageScripts({
        scriptNames: ["dev", "lint", "test:e2e", "build"],
        packageManager: "pnpm",
      }),
    ).toEqual([
      {
        name: "Dev",
        command: "pnpm run dev",
        icon: "play",
        runOnWorktreeCreate: false,
      },
      {
        name: "Lint",
        command: "pnpm run lint",
        icon: "lint",
        runOnWorktreeCreate: false,
      },
      {
        name: "Test E2e",
        command: "pnpm run test:e2e",
        icon: "test",
        runOnWorktreeCreate: false,
      },
      {
        name: "Build",
        command: "pnpm run build",
        icon: "build",
        runOnWorktreeCreate: false,
      },
    ]);
  });

  it("upserts matching actions when materializing defaults", () => {
    const nextScripts = materializeProjectScripts(
      [
        {
          name: "Lint",
          command: "bun run lint",
          icon: "lint",
          runOnWorktreeCreate: false,
        },
        {
          name: "Build",
          command: "bun run build",
          icon: "build",
          runOnWorktreeCreate: false,
        },
      ],
      [
        {
          id: "lint",
          name: "Lint",
          command: "npm run lint",
          icon: "play",
          runOnWorktreeCreate: false,
        },
      ],
    );

    expect(nextScripts).toEqual([
      {
        id: "lint",
        name: "Lint",
        command: "bun run lint",
        icon: "lint",
        runOnWorktreeCreate: false,
      },
      {
        id: "build",
        name: "Build",
        command: "bun run build",
        icon: "build",
        runOnWorktreeCreate: false,
      },
    ]);
  });
});
