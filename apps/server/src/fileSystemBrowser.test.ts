import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, assert, describe, expect, it } from "vitest";

import { browseFileSystemDirectory } from "./fileSystemBrowser";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  // On macOS /tmp resolves through a symlink to /private/tmp. The handler
  // resolves symlinks in the returned path, so normalize expectations.
  const resolved = fs.realpathSync(dir);
  tempDirs.push(resolved);
  return resolved;
}

describe("browseFileSystemDirectory", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lists directories first, then files, each group alphabetically", async () => {
    const root = makeTempDir("okcode-fsbrowse-sort-");
    fs.mkdirSync(path.join(root, "zeta-dir"));
    fs.mkdirSync(path.join(root, "alpha-dir"));
    fs.writeFileSync(path.join(root, "b.txt"), "");
    fs.writeFileSync(path.join(root, "a.txt"), "");

    const result = await browseFileSystemDirectory({ path: root });

    assert.deepEqual(
      result.entries.map((e) => ({ name: e.name, kind: e.kind })),
      [
        { name: "alpha-dir", kind: "directory" },
        { name: "zeta-dir", kind: "directory" },
        { name: "a.txt", kind: "file" },
        { name: "b.txt", kind: "file" },
      ],
    );
    assert.equal(result.path, root);
    assert.equal(result.parentPath, path.dirname(root));
    assert.equal(result.partial, false);
  });

  it("filters dot-prefixed entries by default", async () => {
    const root = makeTempDir("okcode-fsbrowse-hidden-");
    fs.writeFileSync(path.join(root, "visible.txt"), "");
    fs.writeFileSync(path.join(root, ".secret"), "");
    fs.mkdirSync(path.join(root, ".hidden-dir"));

    const result = await browseFileSystemDirectory({ path: root });
    const names = result.entries.map((e) => e.name);

    assert.deepEqual(names, ["visible.txt"]);
  });

  it("includes dot-prefixed entries when includeHidden is true", async () => {
    const root = makeTempDir("okcode-fsbrowse-hidden-on-");
    fs.writeFileSync(path.join(root, "visible.txt"), "");
    fs.writeFileSync(path.join(root, ".secret"), "");
    fs.mkdirSync(path.join(root, ".hidden-dir"));

    const result = await browseFileSystemDirectory({ path: root, includeHidden: true });
    const names = result.entries.map((e) => e.name).toSorted();

    assert.deepEqual(names, [".hidden-dir", ".secret", "visible.txt"]);
  });

  it("rejects non-absolute paths", async () => {
    await expect(browseFileSystemDirectory({ path: "relative/path" })).rejects.toThrow(
      /must be absolute/,
    );
  });

  it("rejects paths that are not directories", async () => {
    const root = makeTempDir("okcode-fsbrowse-notdir-");
    const file = path.join(root, "plain.txt");
    fs.writeFileSync(file, "");

    await expect(browseFileSystemDirectory({ path: file })).rejects.toThrow(/not a directory/);
  });

  it("flags partial and reports as file when a symlink target is unreadable", async () => {
    const root = makeTempDir("okcode-fsbrowse-brokenlink-");
    const missingTarget = path.join(root, "does-not-exist");
    const link = path.join(root, "broken-link");
    fs.symlinkSync(missingTarget, link);

    const result = await browseFileSystemDirectory({ path: root });

    assert.equal(result.partial, true);
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0]?.name, "broken-link");
    assert.equal(result.entries[0]?.kind, "file");
    assert.equal(result.entries[0]?.isSymlink, true);
  });

  it("resolves symlinks to directories as directory-kind entries", async () => {
    const root = makeTempDir("okcode-fsbrowse-dirlink-");
    const target = path.join(root, "real-dir");
    fs.mkdirSync(target);
    fs.symlinkSync(target, path.join(root, "alias-dir"));

    const result = await browseFileSystemDirectory({ path: root });

    const alias = result.entries.find((e) => e.name === "alias-dir");
    assert.ok(alias, "expected alias-dir entry");
    assert.equal(alias.kind, "directory");
    assert.equal(alias.isSymlink, true);
    assert.equal(result.partial, false);
  });

  it("omits parentPath at the filesystem root", async () => {
    const result = await browseFileSystemDirectory({ path: "/" });
    assert.equal(result.path, "/");
    assert.equal(result.parentPath, undefined);
  });

  it("defaults to the service user's home directory when path is omitted", async () => {
    const result = await browseFileSystemDirectory({});
    assert.equal(result.path, os.homedir());
  });
});
