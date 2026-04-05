#!/usr/bin/env node

import { readdirSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const DEFAULT_TIMEOUT_MS = 120_000;
const BROWSER_TEST_SUFFIX = ".browser.tsx";

function listBrowserTests(rootDir) {
  const files = [];
  const visit = (currentDir) => {
    for (const entry of readdirSync(currentDir)) {
      const absolutePath = path.join(currentDir, entry);
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (stats.isFile() && absolutePath.endsWith(BROWSER_TEST_SUFFIX)) {
        files.push(absolutePath);
      }
    }
  };

  visit(rootDir);
  return files.toSorted();
}

function runTestFile({ configPath, filePath, cwd, timeoutMs }) {
  return new Promise((resolve) => {
    const vitestBin = path.join(cwd, "node_modules", "vitest", "vitest.mjs");
    const args = [vitestBin, "run", "--config", configPath, filePath];
    const relativeFile = path.relative(cwd, filePath);

    console.log(`\n[browser] Running ${relativeFile}`);

    const child = spawn(process.execPath, args, {
      cwd,
      stdio: "inherit",
      env: process.env,
    });

    const timeout = setTimeout(() => {
      console.error(`[browser] Timed out after ${timeoutMs}ms: ${relativeFile}`);
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
      resolve({
        ok: false,
        filePath,
        code: null,
        signal: "SIGTERM",
        timedOut: true,
      });
    }, timeoutMs);

    child.on("exit", (code, signal) => {
      clearTimeout(timeout);
      resolve({
        ok: code === 0,
        filePath,
        code,
        signal,
        timedOut: false,
      });
    });
  });
}

async function main() {
  const cwd = process.cwd();
  const configArg = process.argv[2] ?? "apps/web/vitest.browser.config.ts";
  const timeoutArg = process.argv[3];
  const timeoutMs =
    timeoutArg && Number.isFinite(Number(timeoutArg)) ? Number(timeoutArg) : DEFAULT_TIMEOUT_MS;

  const configPath = path.resolve(cwd, configArg);
  const browserTestRoot = path.resolve(path.dirname(configPath), "src", "components");
  const browserTests = listBrowserTests(browserTestRoot);

  if (browserTests.length === 0) {
    console.log("[browser] No browser test files found.");
    return;
  }

  console.log(`[browser] Found ${browserTests.length} browser test files.`);

  for (const filePath of browserTests) {
    const result = await runTestFile({
      configPath,
      filePath,
      cwd,
      timeoutMs,
    });

    if (!result.ok) {
      const relativeFile = path.relative(cwd, result.filePath);
      if (result.timedOut) {
        process.exitCode = 1;
        throw new Error(`Browser test timed out: ${relativeFile}`);
      }
      process.exitCode = result.code ?? 1;
      throw new Error(
        `Browser test failed: ${relativeFile} (code=${String(result.code)}, signal=${String(result.signal)})`,
      );
    }
  }

  console.log("\n[browser] All browser test files passed.");
}

await main();
