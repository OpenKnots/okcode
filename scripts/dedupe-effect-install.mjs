import { lstat, mkdir, rm, symlink } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const rootEffectDir = path.join(rootDir, "node_modules", "effect");

const nestedEffectDirs = [
  path.join(rootDir, "node_modules", "@effect", "platform-node", "node_modules", "effect"),
  path.join(rootDir, "node_modules", "@effect", "platform-node-shared", "node_modules", "effect"),
  path.join(rootDir, "node_modules", "@effect", "sql-sqlite-bun", "node_modules", "effect"),
  path.join(rootDir, "node_modules", "@effect", "vitest", "node_modules", "effect"),
];

async function pathExists(target) {
  try {
    await lstat(target);
    return true;
  } catch {
    return false;
  }
}

async function dedupeNestedEffectDir(target) {
  const parentDir = path.dirname(target);
  await mkdir(parentDir, { recursive: true });

  if (await pathExists(target)) {
    const stat = await lstat(target);
    if (stat.isSymbolicLink()) {
      return;
    }
    await rm(target, { recursive: true, force: true });
  }

  const relativeTarget = path.relative(parentDir, rootEffectDir);
  await symlink(relativeTarget, target, process.platform === "win32" ? "junction" : "dir");
}

await Promise.all(nestedEffectDirs.map(dedupeNestedEffectDir));
