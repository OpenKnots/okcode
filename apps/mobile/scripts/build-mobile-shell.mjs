import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(mobileDir, "../..");
const webDir = path.join(repoRoot, "apps/web");
const mobileDistDir = path.join(mobileDir, "dist");
const webDistDir = path.join(webDir, "dist");
const mobileBridgeEntry = path.join(mobileDir, "src/mobile-bridge.ts");

await Bun.$`bun run --cwd ${webDir} build`;

await rm(mobileDistDir, { force: true, recursive: true });
await mkdir(mobileDistDir, { recursive: true });
await cp(webDistDir, mobileDistDir, { recursive: true });

const buildResult = await Bun.build({
  entrypoints: [mobileBridgeEntry],
  outdir: mobileDistDir,
  naming: "mobile-bridge.js",
  target: "browser",
  sourcemap: "linked",
});

if (!buildResult.success) {
  const messages = buildResult.logs.map((entry) => entry.message).join("\n");
  throw new Error(`Failed to build mobile bridge:\n${messages}`);
}

const indexHtmlPath = path.join(mobileDistDir, "index.html");
const mobileBridgeTag = '    <script type="module" src="/mobile-bridge.js"></script>\n';
const indexHtml = await readFile(indexHtmlPath, "utf8");
const nextIndexHtml = indexHtml.includes('src="/mobile-bridge.js"')
  ? indexHtml
  : indexHtml.replace('<script type="module"', `${mobileBridgeTag}    <script type="module"`);

await writeFile(indexHtmlPath, nextIndexHtml);
