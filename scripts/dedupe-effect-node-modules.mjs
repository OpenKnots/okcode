import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const effectRoot = path.join(repoRoot, "node_modules", "effect");
const effectScopeDir = path.join(repoRoot, "node_modules", "@effect");

async function exists(targetPath) {
  try {
    await fs.lstat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function dedupeNestedEffect(packageDir) {
  const nestedEffectDir = path.join(packageDir, "node_modules", "effect");
  if (!(await exists(nestedEffectDir))) {
    return false;
  }

  const nestedStat = await fs.lstat(nestedEffectDir);
  if (nestedStat.isSymbolicLink()) {
    const linkTarget = await fs.readlink(nestedEffectDir);
    const resolvedTarget = path.resolve(path.dirname(nestedEffectDir), linkTarget);
    if (resolvedTarget === effectRoot) {
      return false;
    }
  }

  await fs.rm(nestedEffectDir, { recursive: true, force: true });
  const relativeTarget = path.relative(path.dirname(nestedEffectDir), effectRoot);
  await fs.symlink(relativeTarget, nestedEffectDir, "dir");
  return true;
}

async function main() {
  if (!(await exists(effectRoot)) || !(await exists(effectScopeDir))) {
    return;
  }

  const entries = await fs.readdir(effectScopeDir, { withFileTypes: true });
  let dedupedCount = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const changed = await dedupeNestedEffect(path.join(effectScopeDir, entry.name));
    if (changed) {
      dedupedCount += 1;
    }
  }

  if (dedupedCount > 0) {
    console.log(`[dedupe-effect-node-modules] linked root effect into ${dedupedCount} package(s)`);
  }
}

await main();
