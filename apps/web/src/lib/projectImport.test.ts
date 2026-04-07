import { describe, expect, it, vi } from "vitest";

import { resolveImportedProjectScripts } from "./projectImport";

describe("resolveImportedProjectScripts", () => {
  it("imports scripts when the package manager can be resolved automatically", async () => {
    const api = {
      projects: {
        readFile: vi.fn().mockResolvedValue({
          relativePath: "package.json",
          contents: JSON.stringify({
            scripts: {
              lint: "eslint .",
              build: "vite build",
            },
          }),
          sizeBytes: 64,
          truncated: false,
        }),
        listDirectory: vi.fn().mockResolvedValue({
          entries: [{ path: "bun.lock", kind: "file" }],
          truncated: false,
        }),
      },
    } as const;

    await expect(resolveImportedProjectScripts(api as never, "/tmp/repo")).resolves.toEqual({
      scripts: [
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
      ],
      warning: null,
    });
  });

  it("returns a warning without importing scripts when package manager choice is ambiguous", async () => {
    const api = {
      projects: {
        readFile: vi.fn().mockResolvedValue({
          relativePath: "package.json",
          contents: JSON.stringify({
            scripts: {
              dev: "vite",
            },
          }),
          sizeBytes: 32,
          truncated: false,
        }),
        listDirectory: vi.fn().mockResolvedValue({
          entries: [
            { path: "bun.lock", kind: "file" },
            { path: "pnpm-lock.yaml", kind: "file" },
          ],
          truncated: false,
        }),
      },
    } as const;

    await expect(resolveImportedProjectScripts(api as never, "/tmp/repo")).resolves.toEqual({
      scripts: undefined,
      warning:
        "Multiple package manager lockfiles were detected (bun, pnpm). Select the package manager to use for imported actions.",
    });
  });
});
