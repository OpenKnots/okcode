/**
 * prepare-release.ts — Automates the full release preparation workflow.
 *
 * This script handles everything needed before pushing a release tag:
 *
 *   1. Validates the target version string.
 *   2. Resolves the previous version from git tags.
 *   3. Collects commit messages since the last release.
 *   4. Generates release documentation (CHANGELOG, release notes, asset manifest, index update).
 *   5. Runs all quality gates (format, lint, typecheck, test, smoke).
 *   6. Optionally commits, tags, pushes, and triggers the release workflow.
 *
 * Usage:
 *
 *   node scripts/prepare-release.ts <version> [flags]
 *
 * Flags:
 *
 *   --dry-run         Show what would be done without writing files or running commands.
 *   --skip-checks     Skip quality gate checks (format, lint, typecheck, test).
 *   --skip-commit     Generate documentation but do not commit, tag, or push.
 *   --full-matrix     Trigger the release with all platforms (not just macOS arm64).
 *   --summary <text>  One-sentence summary for the release notes (prompted if omitted and TTY).
 *   --root <path>     Repository root directory (defaults to cwd).
 *   --help            Show this help message and exit.
 *
 * Examples:
 *
 *   # Prepare, commit, tag, and push a release:
 *   node scripts/prepare-release.ts 0.0.4
 *
 *   # Generate docs only (no commit/tag/push):
 *   node scripts/prepare-release.ts 0.0.4 --skip-commit
 *
 *   # Dry run to see what would happen:
 *   node scripts/prepare-release.ts 0.0.4 --dry-run
 *
 *   # Full multi-platform release:
 *   node scripts/prepare-release.ts 0.0.4 --full-matrix
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEMVER_RE = /^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$/;
const STABLE_SEMVER_RE = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const REPO_URL = "https://github.com/OpenKnots/okcode";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function run(cmd: string, args: string[], opts?: { cwd?: string; silent?: boolean }): string {
  try {
    return execFileSync(cmd, args, {
      cwd: opts?.cwd,
      encoding: "utf8",
      stdio: opts?.silent ? ["pipe", "pipe", "pipe"] : ["pipe", "pipe", "inherit"],
    }).trim();
  } catch {
    return "";
  }
}

function log(emoji: string, message: string): void {
  console.log(`${emoji}  ${message}`);
}

function fatal(message: string): never {
  console.error(`\n  ERROR: ${message}\n`);
  process.exit(1);
}

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

function gitPreviousTag(rootDir: string): string | undefined {
  const tags = run("git", ["tag", "-l", "--sort=-v:refname", "v*.*.*"], {
    cwd: rootDir,
    silent: true,
  });
  if (!tags) return undefined;
  return tags.split("\n")[0];
}

function gitCommitsSince(rootDir: string, sinceRef: string | undefined): string[] {
  const args = ["log", "--pretty=format:%s"];
  if (sinceRef) {
    args.push(`${sinceRef}..HEAD`);
  }
  const output = run("git", args, { cwd: rootDir, silent: true });
  if (!output) return [];
  return output.split("\n").filter(Boolean);
}

function isOnMain(rootDir: string): boolean {
  const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: rootDir, silent: true });
  return branch === "main";
}

// ---------------------------------------------------------------------------
// Commit categorization
// ---------------------------------------------------------------------------

interface CategorizedCommits {
  added: string[];
  changed: string[];
  fixed: string[];
  removed: string[];
  other: string[];
}

function categorizeCommits(messages: string[]): CategorizedCommits {
  const result: CategorizedCommits = { added: [], changed: [], fixed: [], removed: [], other: [] };

  for (const raw of messages) {
    // Strip conventional-commit prefix for the changelog entry
    const msg = raw
      .replace(
        /^(feat|fix|chore|refactor|docs|style|test|perf|ci|build|revert)(\([^)]*\))?:\s*/i,
        "",
      )
      .replace(/\s*\(#\d+\)\s*$/, ""); // strip PR number suffix

    const lower = raw.toLowerCase();

    if (/^(feat|add)/i.test(lower) || lower.includes("add ") || lower.includes("introduce")) {
      result.added.push(msg);
    } else if (
      /^fix/i.test(lower) ||
      lower.includes("fix ") ||
      lower.includes("repair") ||
      lower.includes("resolve")
    ) {
      result.fixed.push(msg);
    } else if (
      /^(remove|delete|drop)/i.test(lower) ||
      lower.includes("remove ") ||
      lower.includes("delete ")
    ) {
      result.removed.push(msg);
    } else if (/^(refactor|chore|docs|style|perf|ci|build)/i.test(lower)) {
      result.changed.push(msg);
    } else {
      result.other.push(msg);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Document generators
// ---------------------------------------------------------------------------

function generateChangelogSection(version: string, commits: CategorizedCommits): string {
  const lines: string[] = [];
  const changedEntries = [...commits.changed, ...commits.other];
  lines.push(`## [${version}] - ${today()}`);
  lines.push("");
  lines.push(
    `See [docs/releases/v${version}.md](docs/releases/v${version}.md) for full notes and [docs/releases/v${version}/assets.md](docs/releases/v${version}/assets.md) for release asset inventory.`,
  );

  if (commits.added.length > 0) {
    lines.push("");
    lines.push("### Added");
    lines.push("");
    for (const entry of commits.added) {
      lines.push(`- ${capitalize(entry)}.`);
    }
  }

  if (changedEntries.length > 0) {
    lines.push("");
    lines.push("### Changed");
    lines.push("");
    for (const entry of changedEntries) {
      lines.push(`- ${capitalize(entry)}.`);
    }
  }

  if (commits.fixed.length > 0) {
    lines.push("");
    lines.push("### Fixed");
    lines.push("");
    for (const entry of commits.fixed) {
      lines.push(`- ${capitalize(entry)}.`);
    }
  }

  if (commits.removed.length > 0) {
    lines.push("");
    lines.push("### Removed");
    lines.push("");
    for (const entry of commits.removed) {
      lines.push(`- ${capitalize(entry)}.`);
    }
  }

  return lines.join("\n");
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/\.$/, "");
}

function generateReleaseNotes(
  version: string,
  summary: string,
  commits: CategorizedCommits,
): string {
  const highlights = [...commits.added, ...commits.fixed, ...commits.changed, ...commits.other]
    .slice(0, 8)
    .map((entry) => `- **${capitalize(entry)}.**`)
    .join("\n");

  return `# OK Code v${version}

**Date:** ${today()}
**Tag:** [\`v${version}\`](${REPO_URL}/releases/tag/v${version})

## Summary

${summary}

## Highlights

${highlights || "- See changelog for detailed changes."}

## Breaking changes

- None.

## Upgrade and install

- **CLI:** \`npm install -g okcodes@${version}\` (after the package is published to npm manually).
- **Desktop:** Download from [GitHub Releases](${REPO_URL}/releases/tag/v${version}). Filenames are listed in [assets.md](v${version}/assets.md).
- **iOS:** Available via TestFlight (uploaded automatically by the Release iOS workflow).

## Known limitations

OK Code remains early work in progress. Expect rough edges around session recovery, streaming edge cases, and platform-specific desktop behavior. Report issues on GitHub.
`;
}

function generateAssetManifest(version: string): string {
  return `# v${version} — Release assets (manifest)

Binaries are **not** stored in this git repository; they are attached to the [GitHub Release for \`v${version}\`](${REPO_URL}/releases/tag/v${version}) by the [Release Desktop workflow](../../.github/workflows/release.yml).

The GitHub Release also includes **documentation attachments** (same content as in-repo, stable filenames for download):

| File                        | Source in repo                        |
| --------------------------- | ------------------------------------- |
| \`okcode-CHANGELOG.md\`       | [CHANGELOG.md](../../../CHANGELOG.md) |
| \`okcode-RELEASE-NOTES.md\`   | [v${version}.md](../v${version}.md)             |
| \`okcode-ASSETS-MANIFEST.md\` | This file                             |

After the workflow completes, expect **installer and updater** artifacts similar to the following (exact names may include the product name \`OK Code\` and version \`${version}\`).

## Desktop installers and payloads

| Platform            | Kind           | Typical pattern |
| ------------------- | -------------- | --------------- |
| macOS Apple Silicon | DMG            | \`*.dmg\` (arm64) |
| macOS               | ZIP (updater)  | \`*.zip\`         |
| Linux x64           | AppImage       | \`*.AppImage\`    |
| Windows x64         | NSIS installer | \`*.exe\`         |

## Electron updater metadata

| File               | Purpose                                                   |
| ------------------ | --------------------------------------------------------- |
| \`latest-mac.yml\`   | macOS update manifest                                      |
| \`latest-linux.yml\` | Linux update manifest                                     |
| \`latest.yml\`       | Windows update manifest                                   |
| \`*.blockmap\`       | Differential download block maps                          |

## iOS (TestFlight)

The iOS build is uploaded directly to App Store Connect / TestFlight by the [Release iOS workflow](../../.github/workflows/release-ios.yml). No IPA artifact is attached to the GitHub Release.

| Detail            | Value                                    |
| ----------------- | ---------------------------------------- |
| Bundle ID         | \`com.openknots.okcode.mobile\`            |
| Marketing version | \`${version}\`                              |
| Build number      | Set from \`GITHUB_RUN_NUMBER\` at build time |

## Checksums

SHA-256 checksums are not committed here; verify downloads via GitHub's release UI or \`gh release download\` if you use the GitHub CLI.
`;
}

// ---------------------------------------------------------------------------
// File mutation helpers
// ---------------------------------------------------------------------------

function updateChangelog(rootDir: string, version: string, section: string): void {
  const changelogPath = resolve(rootDir, "CHANGELOG.md");
  let content = readFileSync(changelogPath, "utf8");

  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionRe = new RegExp(
    `\\n## \\[${escapedVersion}\\][^\\n]*\\n[\\s\\S]*?(?=\\n## \\[|\\n\\[|$)`,
    "g",
  );
  content = content.replace(sectionRe, "\n");

  const linkRe = new RegExp(`\\n\\[${escapedVersion}\\]: .*`, "g");
  content = content.replace(linkRe, "");

  // Insert new section after ## [Unreleased] block
  const unreleasedIndex = content.indexOf("## [Unreleased]");
  if (unreleasedIndex === -1) {
    fatal("Could not find '## [Unreleased]' section in CHANGELOG.md");
  }

  // Find the next section header after [Unreleased]
  const afterUnreleased = content.indexOf("\n## [", unreleasedIndex + 1);
  const insertAt = afterUnreleased !== -1 ? afterUnreleased : content.length;

  content = content.slice(0, insertAt) + section + "\n" + content.slice(insertAt);

  // Add the version comparison link at the bottom
  const versionLink = `[${version}]: ${REPO_URL}/releases/tag/v${version}`;
  // Insert before the first existing version link, or at the end
  const firstLinkIndex = content.lastIndexOf("\n[");
  if (firstLinkIndex !== -1) {
    const lineEnd = content.indexOf("\n", firstLinkIndex + 1);
    content = content.slice(0, lineEnd + 1) + versionLink + "\n" + content.slice(lineEnd + 1);
  } else {
    content = content.trimEnd() + "\n\n" + versionLink + "\n";
  }

  writeFileSync(changelogPath, content);
}

function updateReleasesReadme(rootDir: string, version: string, shortDescription: string): boolean {
  const readmePath = resolve(rootDir, "docs/releases/README.md");
  let content = readFileSync(readmePath, "utf8");

  // Remove any pre-existing row for this version to keep release notes index idempotent.
  const existingVersionRow = new RegExp(
    `^\\| \\[${version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\(v${version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.md\\) \\| .*?\\|$\\n?`,
    "gm",
  );
  content = content.replace(existingVersionRow, "");

  // Find the table header separator line (| --- | --- | --- |)
  const separatorRe = /^\|[ -]+\|[ -]+\|[ -]+\|$/m;
  const match = content.match(separatorRe);
  if (!match || match.index === undefined) {
    // No release index table found — skip gracefully
    return false;
  }

  const insertAfter = content.indexOf("\n", match.index);
  const newRow = `| [${version}](v${version}.md) | ${shortDescription} | [manifest](v${version}/assets.md) |`;

  content = content.slice(0, insertAfter + 1) + newRow + "\n" + content.slice(insertAfter + 1);

  writeFileSync(readmePath, content);
  return true;
}

// ---------------------------------------------------------------------------
// Quality gate runner
// ---------------------------------------------------------------------------

function runQualityGates(rootDir: string): void {
  const checks = [
    { name: "Format check", cmd: "bun", args: ["run", "fmt:check"] },
    { name: "Lint", cmd: "bun", args: ["run", "lint"] },
    { name: "Typecheck", cmd: "bun", args: ["run", "typecheck"] },
    { name: "Test", cmd: "bun", args: ["run", "test"] },
    { name: "Release smoke", cmd: "bun", args: ["run", "release:smoke"] },
  ];

  for (const check of checks) {
    log(">>", `Running: ${check.name}...`);
    try {
      execFileSync(check.cmd, check.args, { cwd: rootDir, stdio: "inherit" });
      log("OK", `${check.name} passed.`);
    } catch {
      fatal(`${check.name} failed. Fix the issues before releasing.`);
    }
  }
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface PrepareReleaseOptions {
  version: string;
  rootDir: string;
  dryRun: boolean;
  skipChecks: boolean;
  skipCommit: boolean;
  fullMatrix: boolean;
  summary: string | undefined;
}

function printHelp(): void {
  const helpText = `
  prepare-release — Automate the full OK Code release preparation workflow.

  Usage:
    node scripts/prepare-release.ts <version> [flags]

  Arguments:
    <version>           SemVer version to release (e.g. 0.0.4, 1.0.0-beta.1)

  Flags:
    --dry-run           Show what would be done without writing files or running commands
    --skip-checks       Skip quality gate checks (format, lint, typecheck, test)
    --skip-commit       Generate documentation but do not commit, tag, or push
    --full-matrix       Trigger the release with all platforms (not just macOS arm64)
    --summary <text>    One-sentence summary for the release notes
    --root <path>       Repository root directory (defaults to parent of scripts/)
    --help              Show this help message and exit

  Examples:
    node scripts/prepare-release.ts 0.0.4
    node scripts/prepare-release.ts 0.0.4 --skip-commit
    node scripts/prepare-release.ts 0.0.4 --dry-run
    node scripts/prepare-release.ts 0.0.4 --full-matrix --summary "Performance release with 2x faster indexing"
`;
  console.log(helpText);
}

function parseArgs(argv: ReadonlyArray<string>): PrepareReleaseOptions {
  let version: string | undefined;
  let rootDir: string | undefined;
  let dryRun = false;
  let skipChecks = false;
  let skipCommit = false;
  let fullMatrix = false;
  let summary: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) continue;

    switch (arg) {
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break; // unreachable but keeps the linter happy
      case "--dry-run":
        dryRun = true;
        break;
      case "--skip-checks":
        skipChecks = true;
        break;
      case "--skip-commit":
        skipCommit = true;
        break;
      case "--full-matrix":
        fullMatrix = true;
        break;
      case "--summary":
        summary = argv[i + 1];
        if (!summary) fatal("Missing value for --summary.");
        i += 1;
        break;
      case "--root":
        rootDir = argv[i + 1];
        if (!rootDir) fatal("Missing value for --root.");
        i += 1;
        break;
      default:
        if (arg.startsWith("--")) fatal(`Unknown flag: ${arg}`);
        if (version !== undefined) fatal("Only one version argument is allowed.");
        version = arg.replace(/^v/, "");
        break;
    }
  }

  if (!version) {
    printHelp();
    fatal("A version argument is required.");
  }

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const resolvedRoot = resolve(rootDir ?? resolve(scriptDir, ".."));

  return { version, rootDir: resolvedRoot, dryRun, skipChecks, skipCommit, fullMatrix, summary };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const { version, rootDir, dryRun, skipChecks, skipCommit, fullMatrix } = opts;

  // --- Validate version --------------------------------------------------
  if (!SEMVER_RE.test(version)) {
    fatal(`Invalid SemVer version: "${version}". Expected format: X.Y.Z or X.Y.Z-label.N`);
  }
  const isPrerelease = !STABLE_SEMVER_RE.test(version);
  const tag = `v${version}`;

  console.log("");
  log("==>", `Preparing release ${tag}${isPrerelease ? " (prerelease)" : ""}`);
  console.log(`    Root: ${rootDir}`);
  console.log(`    Dry run: ${dryRun}`);
  console.log(`    Skip checks: ${skipChecks}`);
  console.log(`    Skip commit: ${skipCommit}`);
  console.log(`    Full matrix: ${fullMatrix}`);
  console.log("");

  // --- Validate git state ------------------------------------------------
  if (!skipCommit && !dryRun) {
    if (!isOnMain(rootDir)) {
      fatal("You must be on the 'main' branch to cut a release. Run: git checkout main");
    }
  }

  // --- Resolve previous tag and collect commits --------------------------
  const prevTag = gitPreviousTag(rootDir);
  log("==>", `Previous tag: ${prevTag ?? "(none)"}`);

  const commits = gitCommitsSince(rootDir, prevTag);
  log("==>", `${commits.length} commit(s) since ${prevTag ?? "beginning"}`);

  const categorized = categorizeCommits(commits);
  log(
    "   ",
    `  Added: ${categorized.added.length}, Changed: ${categorized.changed.length}, Fixed: ${categorized.fixed.length}, Removed: ${categorized.removed.length}, Other: ${categorized.other.length}`,
  );
  console.log("");

  // --- Resolve summary ---------------------------------------------------
  let summary = opts.summary;
  if (!summary) {
    const autoSummary = [
      categorized.added.length > 0 ? `${categorized.added.length} new feature(s)` : "",
      categorized.fixed.length > 0 ? `${categorized.fixed.length} fix(es)` : "",
      categorized.changed.length + categorized.other.length > 0
        ? `${categorized.changed.length + categorized.other.length} improvement(s)`
        : "",
    ]
      .filter(Boolean)
      .join(", ");

    const defaultSummary = autoSummary ? `Release with ${autoSummary}.` : `Release ${tag}.`;

    if (process.stdin.isTTY && !dryRun) {
      const input = await prompt(`  Release summary [${defaultSummary}]: `);
      summary = input || defaultSummary;
    } else {
      summary = defaultSummary;
    }
  }

  log("==>", `Summary: ${summary}`);
  console.log("");

  // --- Generate release documentation ------------------------------------
  const notesPath = resolve(rootDir, `docs/releases/v${version}.md`);
  const assetsDirPath = resolve(rootDir, `docs/releases/v${version}`);
  const assetsPath = resolve(rootDir, `docs/releases/v${version}/assets.md`);

  // Check if docs already exist
  if (existsSync(notesPath)) {
    log("--", `Release notes already exist: docs/releases/v${version}.md (skipping)`);
  } else {
    const notes = generateReleaseNotes(version, summary, categorized);
    if (dryRun) {
      log("--", `Would create: docs/releases/v${version}.md`);
    } else {
      writeFileSync(notesPath, notes);
      log("OK", `Created: docs/releases/v${version}.md`);
    }
  }

  if (existsSync(assetsPath)) {
    log("--", `Asset manifest already exists: docs/releases/v${version}/assets.md (skipping)`);
  } else {
    const manifest = generateAssetManifest(version);
    if (dryRun) {
      log("--", `Would create: docs/releases/v${version}/assets.md`);
    } else {
      mkdirSync(assetsDirPath, { recursive: true });
      writeFileSync(assetsPath, manifest);
      log("OK", `Created: docs/releases/v${version}/assets.md`);
    }
  }

  // Update CHANGELOG.md
  const changelogSection = generateChangelogSection(version, categorized);
  if (dryRun) {
    log("--", "Would update: CHANGELOG.md");
    console.log("");
    console.log("--- CHANGELOG section preview ---");
    console.log(changelogSection);
    console.log("--- end preview ---");
    console.log("");
  } else {
    updateChangelog(rootDir, version, changelogSection);
    log("OK", "Updated: CHANGELOG.md");
  }

  // Update docs/releases/README.md (if it has a release index table)
  const shortDescription = summary.replace(/\.$/, "").slice(0, 60);
  if (dryRun) {
    log("--", "Would update: docs/releases/README.md (if table exists)");
  } else {
    const updated = updateReleasesReadme(rootDir, version, shortDescription);
    if (updated) {
      log("OK", "Updated: docs/releases/README.md");
    } else {
      log("--", "No release index table in docs/releases/README.md (skipped).");
    }
  }
  console.log("");

  // --- Quality gates -----------------------------------------------------
  if (skipChecks || dryRun) {
    log("--", "Skipping quality gates.");
  } else {
    log("==>", "Running quality gates...");
    console.log("");
    runQualityGates(rootDir);
    console.log("");
  }

  // --- Commit, tag, push -------------------------------------------------
  if (skipCommit || dryRun) {
    if (dryRun) {
      log("--", "Would commit release documentation.");
      log("--", `Would create tag: ${tag}`);
      log("--", `Would push tag: ${tag}`);
      if (fullMatrix) {
        log(
          "--",
          `Would trigger full-matrix release via: gh workflow run release.yml -f version=${version} -f mac_arm64_only=false`,
        );
      }
    } else {
      log("--", "Skipping commit/tag/push (--skip-commit).");
    }
  } else {
    // Stage and commit the release documentation
    const filesToStage = [
      "CHANGELOG.md",
      "docs/releases/README.md",
      `docs/releases/v${version}.md`,
      `docs/releases/v${version}/assets.md`,
    ];

    log("==>", "Staging release documentation...");
    execFileSync("git", ["add", ...filesToStage], { cwd: rootDir, stdio: "inherit" });

    log("==>", "Committing...");
    execFileSync("git", ["commit", "-m", `docs(release): prepare release notes for v${version}`], {
      cwd: rootDir,
      stdio: "inherit",
    });
    log("OK", "Committed release documentation.");

    // Push the commit to main
    log("==>", "Pushing to origin/main...");
    execFileSync("git", ["push", "origin", "main"], { cwd: rootDir, stdio: "inherit" });
    log("OK", "Pushed to origin/main.");

    // Create and push the tag
    log("==>", `Creating tag ${tag}...`);
    execFileSync("git", ["tag", tag], { cwd: rootDir, stdio: "inherit" });

    if (fullMatrix) {
      // For full matrix, use workflow_dispatch so we can set mac_arm64_only=false
      log("==>", `Pushing tag ${tag} and triggering full-matrix release...`);
      execFileSync("git", ["push", "origin", tag], { cwd: rootDir, stdio: "inherit" });

      // Also trigger via workflow_dispatch for full matrix
      log("==>", "Triggering full-matrix workflow via gh...");
      try {
        execFileSync(
          "gh",
          [
            "workflow",
            "run",
            "release.yml",
            "-f",
            `version=${version}`,
            "-f",
            "mac_arm64_only=false",
          ],
          { cwd: rootDir, stdio: "inherit" },
        );
        log("OK", "Full-matrix release workflow triggered.");
      } catch {
        log(
          "!!",
          "Could not trigger workflow_dispatch via gh CLI. The tag push will still trigger an arm64-only build.",
        );
        log(
          "!!",
          `To manually trigger full matrix: gh workflow run release.yml -f version=${version} -f mac_arm64_only=false`,
        );
      }
    } else {
      log("==>", `Pushing tag ${tag} (arm64-only release)...`);
      execFileSync("git", ["push", "origin", tag], { cwd: rootDir, stdio: "inherit" });
      log("OK", `Tag ${tag} pushed. Release workflow will run automatically.`);
    }
  }

  // --- Summary -----------------------------------------------------------
  console.log("");
  console.log("=".repeat(60));
  log("==>", `Release ${tag} preparation complete!`);
  console.log("=".repeat(60));
  console.log("");

  if (!skipCommit && !dryRun) {
    console.log("  Next steps:");
    console.log(
      `    1. Monitor the desktop release workflow: ${REPO_URL}/actions/workflows/release.yml`,
    );
    console.log(
      `    2. Monitor the iOS TestFlight workflow:  ${REPO_URL}/actions/workflows/release-ios.yml`,
    );
    console.log(`    3. Verify the GitHub Release:            ${REPO_URL}/releases/tag/${tag}`);
    console.log("    4. Test downloaded installers on each platform.");
    console.log("    5. Verify auto-update from the previous version.");
    console.log("    6. Verify TestFlight build in App Store Connect.");
    console.log(`    7. Confirm version bump commit on main: git log origin/main --oneline -5`);
    console.log("");
  } else if (skipCommit) {
    console.log("  Documentation generated. To finish the release manually:");
    console.log(`    1. Review the generated files.`);
    console.log(`    2. git add CHANGELOG.md docs/releases/`);
    console.log(`    3. git commit -m "docs(release): prepare release notes for v${version}"`);
    console.log(`    4. git push origin main`);
    console.log(`    5. git tag ${tag} && git push origin ${tag}`);
    if (fullMatrix) {
      console.log(
        `    6. gh workflow run release.yml -f version=${version} -f mac_arm64_only=false`,
      );
    }
    console.log("");
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const isMain =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
