/**
 * pre-release-validate.ts — Comprehensive pre-release validation gate.
 *
 * Runs every check that must pass before cutting an RC or promoting to stable.
 * Unlike prepare-release.ts (which generates docs and tags), this script is
 * read-only: it inspects current state and reports pass/fail for each gate.
 *
 * Usage:
 *
 *   node scripts/pre-release-validate.ts <version> [flags]
 *
 * Flags:
 *
 *   --root <path>   Repository root directory (defaults to parent of scripts/).
 *   --ci            Exit with non-zero on first failure (for CI pipelines).
 *   --skip-quality  Skip quality gates (format, lint, typecheck, test) — docs only.
 *   --help          Show this help message and exit.
 *
 * Exit codes:
 *
 *   0  All checks passed.
 *   1  One or more checks failed.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

interface ValidateOptions {
  version: string;
  rootDir: string;
  ci: boolean;
  skipQuality: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEMVER_RE = /^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$/;
const STABLE_SEMVER_RE = /^[0-9]+\.[0-9]+\.[0-9]+$/;

const RELEASE_PACKAGES = [
  "apps/server/package.json",
  "apps/desktop/package.json",
  "apps/web/package.json",
  "apps/mobile/package.json",
  "packages/contracts/package.json",
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(
  cmd: string,
  args: string[],
  opts?: { cwd?: string },
): { ok: boolean; stdout: string } {
  try {
    const stdout = execFileSync(cmd, args, {
      cwd: opts?.cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return { ok: true, stdout };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, stdout: message };
  }
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Validation checks
// ---------------------------------------------------------------------------

function checkSemver(version: string): CheckResult {
  const passed = SEMVER_RE.test(version);
  return {
    name: "Valid SemVer version",
    passed,
    detail: passed ? `${version} is valid` : `"${version}" is not valid SemVer`,
  };
}

function checkVersionAlignment(rootDir: string, version: string): CheckResult {
  const mismatched: string[] = [];
  for (const relativePath of RELEASE_PACKAGES) {
    const filePath = resolve(rootDir, relativePath);
    if (!existsSync(filePath)) {
      mismatched.push(`${relativePath} (missing)`);
      continue;
    }
    const pkg = readJson(filePath);
    if (pkg.version !== version) {
      mismatched.push(`${relativePath} (${pkg.version})`);
    }
  }

  if (mismatched.length === 0) {
    return {
      name: "Package version alignment",
      passed: true,
      detail: `All packages at ${version}`,
    };
  }
  return {
    name: "Package version alignment",
    passed: false,
    detail: `Mismatched: ${mismatched.join(", ")}`,
  };
}

function checkChangelogEntry(rootDir: string, version: string): CheckResult {
  const changelogPath = resolve(rootDir, "CHANGELOG.md");
  if (!existsSync(changelogPath)) {
    return { name: "CHANGELOG.md entry", passed: false, detail: "CHANGELOG.md not found" };
  }

  const content = readFileSync(changelogPath, "utf8");
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hasEntry = new RegExp(`## \\[${escaped}\\]`).test(content);

  return {
    name: "CHANGELOG.md entry",
    passed: hasEntry,
    detail: hasEntry ? `Found entry for [${version}]` : `No entry for [${version}] in CHANGELOG.md`,
  };
}

function checkReleaseNotes(rootDir: string, version: string): CheckResult {
  const notesPath = resolve(rootDir, `docs/releases/v${version}.md`);
  const exists = existsSync(notesPath);
  return {
    name: "Release notes",
    passed: exists,
    detail: exists ? `docs/releases/v${version}.md exists` : `docs/releases/v${version}.md missing`,
  };
}

function checkAssetManifest(rootDir: string, version: string): CheckResult {
  const manifestPath = resolve(rootDir, `docs/releases/v${version}/assets.md`);
  const exists = existsSync(manifestPath);
  return {
    name: "Asset manifest",
    passed: exists,
    detail: exists
      ? `docs/releases/v${version}/assets.md exists`
      : `docs/releases/v${version}/assets.md missing`,
  };
}

function checkRolloutChecklist(rootDir: string, version: string): CheckResult {
  const checklistPath = resolve(rootDir, `docs/releases/v${version}/rollout-checklist.md`);
  const exists = existsSync(checklistPath);
  return {
    name: "Rollout checklist",
    passed: exists,
    detail: exists
      ? `docs/releases/v${version}/rollout-checklist.md exists`
      : `docs/releases/v${version}/rollout-checklist.md missing`,
  };
}

function checkSoakTestPlan(rootDir: string, version: string): CheckResult {
  const soakPath = resolve(rootDir, `docs/releases/v${version}/soak-test-plan.md`);
  const exists = existsSync(soakPath);
  return {
    name: "Soak test plan",
    passed: exists,
    detail: exists
      ? `docs/releases/v${version}/soak-test-plan.md exists`
      : `docs/releases/v${version}/soak-test-plan.md missing`,
  };
}

function checkReleasesReadmeEntry(rootDir: string, version: string): CheckResult {
  const readmePath = resolve(rootDir, "docs/releases/README.md");
  if (!existsSync(readmePath)) {
    return {
      name: "Releases index entry",
      passed: false,
      detail: "docs/releases/README.md missing",
    };
  }

  const content = readFileSync(readmePath, "utf8");
  const hasEntry = content.includes(`[${version}]`);
  return {
    name: "Releases index entry",
    passed: hasEntry,
    detail: hasEntry
      ? `Found [${version}] in docs/releases/README.md`
      : `No entry for [${version}] in docs/releases/README.md`,
  };
}

function checkNoExistingTag(rootDir: string, version: string): CheckResult {
  const tag = `v${version}`;
  const { stdout } = run("git", ["tag", "-l", tag], { cwd: rootDir });
  const exists = stdout === tag;
  return {
    name: "Tag not yet created",
    passed: !exists,
    detail: exists
      ? `Tag ${tag} already exists — promote or cut a new RC instead`
      : `Tag ${tag} does not exist yet`,
  };
}

function checkCleanWorktree(rootDir: string): CheckResult {
  const { stdout } = run("git", ["status", "--porcelain"], { cwd: rootDir });
  const isClean = stdout === "";
  return {
    name: "Clean working tree",
    passed: isClean,
    detail: isClean ? "No uncommitted changes" : `Uncommitted changes:\n${stdout}`,
  };
}

function checkOnMain(rootDir: string): CheckResult {
  const { stdout } = run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: rootDir });
  const isMain = stdout === "main";
  return {
    name: "On main branch",
    passed: isMain,
    detail: isMain
      ? "Currently on main"
      : `Currently on "${stdout}" — release tags should be cut from main`,
  };
}

function checkReleaseReadyDocs(rootDir: string, version: string): CheckResult {
  // Validate the same conditions the release-ready.yml workflow checks
  const requiredFiles = [
    `docs/releases/v${version}.md`,
    `docs/releases/v${version}/assets.md`,
    `docs/releases/v${version}/rollout-checklist.md`,
    `docs/releases/v${version}/soak-test-plan.md`,
  ];
  const missing = requiredFiles.filter((f) => !existsSync(resolve(rootDir, f)));

  if (missing.length === 0) {
    return {
      name: "release-ready.yml gate",
      passed: true,
      detail: "All required release documentation present",
    };
  }
  return {
    name: "release-ready.yml gate",
    passed: false,
    detail: `Missing: ${missing.join(", ")}`,
  };
}

function checkReleaseNotesContent(rootDir: string, version: string): CheckResult {
  const notesPath = resolve(rootDir, `docs/releases/v${version}.md`);
  if (!existsSync(notesPath)) {
    return { name: "Release notes content", passed: false, detail: "File missing" };
  }

  const content = readFileSync(notesPath, "utf8");
  const issues: string[] = [];

  if (!content.includes(`v${version}`)) issues.push("version not mentioned in body");
  if (!content.includes("## Summary")) issues.push("missing Summary section");
  if (!content.includes("## Highlights")) issues.push("missing Highlights section");
  if (!content.includes("## Upgrade and install"))
    issues.push("missing Upgrade and install section");
  if (!content.includes("rollout-checklist.md")) issues.push("missing rollout checklist link");
  if (!content.includes("soak-test-plan.md")) issues.push("missing soak test plan link");

  if (issues.length === 0) {
    return { name: "Release notes content", passed: true, detail: "All expected sections present" };
  }
  return {
    name: "Release notes content",
    passed: false,
    detail: `Issues: ${issues.join("; ")}`,
  };
}

function checkAssetManifestContent(rootDir: string, version: string): CheckResult {
  const manifestPath = resolve(rootDir, `docs/releases/v${version}/assets.md`);
  if (!existsSync(manifestPath)) {
    return { name: "Asset manifest content", passed: false, detail: "File missing" };
  }

  const content = readFileSync(manifestPath, "utf8");
  const issues: string[] = [];

  if (!content.includes("Desktop installers")) issues.push("missing Desktop installers section");
  if (!content.includes("Electron updater metadata"))
    issues.push("missing updater metadata section");
  if (!content.includes("iOS (TestFlight)")) issues.push("missing iOS section");
  if (!content.includes("Checksums")) issues.push("missing Checksums section");
  if (!content.includes("rollout-checklist.md")) issues.push("missing rollout checklist reference");
  if (!content.includes("soak-test-plan.md")) issues.push("missing soak test plan reference");
  if (!content.includes(version)) issues.push("version not mentioned in body");

  if (issues.length === 0) {
    return {
      name: "Asset manifest content",
      passed: true,
      detail: "All expected sections present",
    };
  }
  return {
    name: "Asset manifest content",
    passed: false,
    detail: `Issues: ${issues.join("; ")}`,
  };
}

function checkIosProjectVersion(rootDir: string, version: string): CheckResult {
  const pbxprojPath = resolve(rootDir, "apps/mobile/ios/App/App.xcodeproj/project.pbxproj");
  if (!existsSync(pbxprojPath)) {
    return { name: "iOS MARKETING_VERSION", passed: true, detail: "No Xcode project (skipped)" };
  }

  const content = readFileSync(pbxprojPath, "utf8");
  const versionPattern = new RegExp(
    `MARKETING_VERSION\\s*=\\s*${version.replace(/\./g, "\\.")}\\s*;`,
  );
  const matches = content.match(versionPattern);

  if (matches) {
    return { name: "iOS MARKETING_VERSION", passed: true, detail: `Set to ${version}` };
  }

  // Extract what it's currently set to
  const current = content.match(/MARKETING_VERSION\s*=\s*([^;]+);/);
  return {
    name: "iOS MARKETING_VERSION",
    passed: false,
    detail: current
      ? `Currently ${current[1]?.trim()} — expected ${version}`
      : "MARKETING_VERSION not found in project.pbxproj",
  };
}

// ---------------------------------------------------------------------------
// Quality gate checks (run external commands)
// ---------------------------------------------------------------------------

interface QualityGate {
  name: string;
  cmd: string;
  args: string[];
}

const QUALITY_GATES: QualityGate[] = [
  { name: "Format check", cmd: "bun", args: ["run", "fmt:check"] },
  { name: "Lint (zero-warning)", cmd: "bun", args: ["run", "lint"] },
  { name: "Typecheck", cmd: "bun", args: ["run", "typecheck"] },
  { name: "Unit tests", cmd: "bun", args: ["run", "test"] },
  { name: "Browser tests", cmd: "bun", args: ["run", "--cwd", "apps/web", "test:browser"] },
  { name: "Desktop smoke", cmd: "bun", args: ["run", "test:desktop-smoke"] },
  { name: "Release smoke", cmd: "bun", args: ["run", "release:smoke"] },
];

function runQualityGates(rootDir: string): CheckResult[] {
  const results: CheckResult[] = [];
  for (const gate of QUALITY_GATES) {
    const { ok } = run(gate.cmd, gate.args, { cwd: rootDir });
    results.push({
      name: gate.name,
      passed: ok,
      detail: ok ? "Passed" : `Failed — run \`${gate.cmd} ${gate.args.join(" ")}\` to reproduce`,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printHelp(): void {
  console.log(`
  pre-release-validate — Comprehensive pre-release validation gate.

  Usage:
    node scripts/pre-release-validate.ts <version> [flags]

  Arguments:
    <version>         SemVer version to validate (e.g. 0.16.0, 0.17.0-rc.1)

  Flags:
    --root <path>     Repository root directory (defaults to parent of scripts/)
    --ci              Exit with non-zero on first failure
    --skip-quality    Skip quality gates (format, lint, typecheck, test)
    --help            Show this help message and exit

  Examples:
    node scripts/pre-release-validate.ts 0.16.0
    node scripts/pre-release-validate.ts 0.16.0 --ci
    node scripts/pre-release-validate.ts 0.16.0 --skip-quality
`);
}

function parseArgs(argv: ReadonlyArray<string>): ValidateOptions {
  let version: string | undefined;
  let rootDir: string | undefined;
  let ci = false;
  let skipQuality = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) continue;

    switch (arg) {
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      case "--ci":
        ci = true;
        break;
      case "--skip-quality":
        skipQuality = true;
        break;
      case "--root":
        rootDir = argv[i + 1];
        if (!rootDir) {
          console.error("Missing value for --root.");
          process.exit(1);
        }
        i += 1;
        break;
      default:
        if (arg.startsWith("--")) {
          console.error(`Unknown flag: ${arg}`);
          process.exit(1);
        }
        if (version !== undefined) {
          console.error("Only one version argument is allowed.");
          process.exit(1);
        }
        version = arg.replace(/^v/, "");
        break;
    }
  }

  if (!version) {
    printHelp();
    process.exit(1);
  }

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const resolvedRoot = resolve(rootDir ?? resolve(scriptDir, ".."));

  return { version, rootDir: resolvedRoot, ci, skipQuality };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  const { version, rootDir, ci, skipQuality } = opts;
  const isPrerelease = !STABLE_SEMVER_RE.test(version);

  console.log("");
  console.log(`  Pre-release validation: v${version}${isPrerelease ? " (prerelease)" : ""}`);
  console.log(`  Root: ${rootDir}`);
  console.log("");

  // -----------------------------------------------------------------------
  // Documentation & state checks (always run)
  // -----------------------------------------------------------------------

  const docChecks: CheckResult[] = [
    checkSemver(version),
    checkVersionAlignment(rootDir, version),
    checkChangelogEntry(rootDir, version),
    checkReleaseNotes(rootDir, version),
    checkAssetManifest(rootDir, version),
    checkRolloutChecklist(rootDir, version),
    checkSoakTestPlan(rootDir, version),
    checkReleasesReadmeEntry(rootDir, version),
    checkReleaseReadyDocs(rootDir, version),
    checkReleaseNotesContent(rootDir, version),
    checkAssetManifestContent(rootDir, version),
    checkAndroidVersion(rootDir, version),
    checkIosProjectVersion(rootDir, version),
    checkNoExistingTag(rootDir, version),
    checkCleanWorktree(rootDir),
    checkOnMain(rootDir),
  ];

  // -----------------------------------------------------------------------
  // Quality gate checks (optional)
  // -----------------------------------------------------------------------

  let qualityChecks: CheckResult[] = [];
  if (skipQuality) {
    console.log("  Skipping quality gates (--skip-quality).\n");
  } else {
    qualityChecks = runQualityGates(rootDir);
  }

  // -----------------------------------------------------------------------
  // Report
  // -----------------------------------------------------------------------

  const allChecks = [...docChecks, ...qualityChecks];
  const passed = allChecks.filter((c) => c.passed);
  const failed = allChecks.filter((c) => !c.passed);

  const maxNameLen = Math.max(...allChecks.map((c) => c.name.length));

  for (const check of allChecks) {
    const icon = check.passed ? "PASS" : "FAIL";
    const pad = " ".repeat(maxNameLen - check.name.length);
    console.log(`  [${icon}] ${check.name}${pad}  ${check.detail}`);
  }

  console.log("");
  console.log(
    `  ${passed.length} passed, ${failed.length} failed out of ${allChecks.length} checks.`,
  );

  if (failed.length > 0) {
    console.log("");
    console.log("  Failed checks:");
    for (const check of failed) {
      console.log(`    - ${check.name}: ${check.detail}`);
    }
    console.log("");

    if (ci) {
      process.exit(1);
    } else {
      console.log("  Fix the above issues before cutting the release.");
      console.log("");
      process.exit(1);
    }
  } else {
    console.log("");
    console.log(`  All checks passed. Ready to cut v${version}.`);
    console.log("");

    if (isPrerelease) {
      console.log("  Next step:");
      console.log(`    node scripts/prepare-release.ts ${version} --full-matrix`);
    } else {
      console.log("  Next steps:");
      console.log(
        `    1. Cut RC first: node scripts/prepare-release.ts ${version}-rc.1 --full-matrix`,
      );
      console.log("    2. Soak RC for 48 hours.");
      console.log(`    3. Promote: node scripts/prepare-release.ts ${version} --full-matrix`);
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
  main();
}
function checkAndroidVersion(rootDir: string, version: string): CheckResult {
  const buildGradlePath = resolve(rootDir, "apps/mobile/android/app/build.gradle");
  if (!existsSync(buildGradlePath)) {
    return { name: "Android versionName", passed: true, detail: "No Android project (skipped)" };
  }

  const content = readFileSync(buildGradlePath, "utf8");
  const versionPattern = new RegExp(`versionName\\s+"${version.replace(/\./g, "\\.")}"`);
  const matches = content.match(versionPattern);

  if (matches) {
    return { name: "Android versionName", passed: true, detail: `Set to ${version}` };
  }

  const current = content.match(/versionName\s+"([^"]+)"/);
  return {
    name: "Android versionName",
    passed: false,
    detail: current ? `Currently ${current[1]} — expected ${version}` : "versionName not found",
  };
}
