import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const rootEffectDir = path.join(rootDir, "node_modules", "effect");

const nestedEffectDirs = [
  path.join(rootDir, "node_modules", "@effect", "platform-node", "node_modules", "effect"),
  path.join(rootDir, "node_modules", "@effect", "platform-node-shared", "node_modules", "effect"),
  path.join(rootDir, "node_modules", "@effect", "sql-sqlite-bun", "node_modules", "effect"),
  path.join(rootDir, "node_modules", "@effect", "vitest", "node_modules", "effect"),
];

async function pathExists(targetPath) {
  try {
    await fsp.lstat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function isSymlinkToRootEffect(targetPath) {
  try {
    const stat = await fsp.lstat(targetPath);
    if (!stat.isSymbolicLink()) {
      return false;
    }
    const realTarget = await fsp.realpath(targetPath);
    const realRootEffect = await fsp.realpath(rootEffectDir);
    return realTarget === realRootEffect;
  } catch {
    return false;
  }
}

async function patchNestedEffectInstall(targetPath) {
  const parentDir = path.dirname(targetPath);
  await fsp.mkdir(parentDir, { recursive: true });

  if (await isSymlinkToRootEffect(targetPath)) {
    return;
  }

  if (await pathExists(targetPath)) {
    await fsp.rm(targetPath, { recursive: true, force: true });
  }

  const symlinkType = process.platform === "win32" ? "junction" : "dir";
  await fsp.symlink(rootEffectDir, targetPath, symlinkType);
  console.log(`patched nested effect install: ${path.relative(rootDir, targetPath)}`);
}

async function main() {
  if (!fs.existsSync(rootEffectDir)) {
    console.warn("skipping nested effect patch because root effect install is missing");
    return;
  }

  await Promise.all(nestedEffectDirs.map((targetPath) => patchNestedEffectInstall(targetPath)));
}

await main();
