# Release Ship And OTA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single release command that prepares and ships a release end-to-end, then verifies the published desktop OTA assets before reporting success.

**Architecture:** Keep existing release preparation and validation scripts as building blocks, then add a thin orchestration script that runs preflight, drives the tag push path, waits for the GitHub Actions release workflow, and verifies the live GitHub Release contents through `gh`. Tighten the GitHub Actions release workflow so stable desktop publishing always includes both macOS architectures and a merged updater manifest, with asset validation failing closed if OTA coverage is incomplete.

**Tech Stack:** Node.js scripts, GitHub CLI, GitHub Actions YAML, Vitest, Bun workspace scripts

---

### Task 1: Add the release shipping orchestrator

**Files:**

- Create: `scripts/release-ship.ts`
- Modify: `package.json`
- Test: `scripts/release-ship.test.ts`

- [ ] **Step 1: Write the failing tests for release shipping orchestration**

```ts
describe("release-ship", () => {
  it("runs validation, preparation, waits for release workflow, and verifies OTA assets", () => {
    // Assert the command order and that the verifier checks the live release.
  });

  it("fails when the published release is missing required OTA coverage", () => {
    // Assert missing x64 mac assets or merged manifest causes a throw.
  });
});
```

- [ ] **Step 2: Run the script tests to verify the new cases fail**

Run: `bun run --cwd scripts test`
Expected: FAIL with missing `scripts/release-ship.ts` exports or missing test expectations.

- [ ] **Step 3: Implement `scripts/release-ship.ts` with explicit phases**

```ts
run("node", ["scripts/pre-release-validate.ts", version, "--ci"]);
run("node", ["scripts/prepare-release.ts", version, "--skip-checks"]);
const runId = await waitForWorkflowRun({ workflow: "release.yml", tag: `v${version}` });
await watchWorkflowRun(runId);
await verifyPublishedReleaseAssets({ tag: `v${version}` });
```

- [ ] **Step 4: Add a single package entry point**

```json
"release:ship": "node scripts/release-ship.ts"
```

- [ ] **Step 5: Re-run the script tests**

Run: `bun run --cwd scripts test`
Expected: PASS for the new `release-ship` tests.

### Task 2: Make stable desktop publishing fail closed on OTA completeness

**Files:**

- Modify: `.github/workflows/release.yml`
- Modify: `scripts/validate-release-assets.ts`
- Test: `scripts/validate-release-assets.test.ts`
- Test: `scripts/release-smoke.ts`

- [ ] **Step 1: Write the failing asset validation tests**

```ts
it("requires both macOS arm64 and x64 desktop payloads for coordinated releases", () => {
  assert.throws(() => validateReleaseAssets([...missingX64]), /macOS x64 DMG/);
});

it("requires a merged latest-mac.yml manifest alongside the dual-arch payloads", () => {
  assert.throws(() => validateReleaseAssets([...missingManifest]), /macOS updater manifest/);
});
```

- [ ] **Step 2: Run the script tests to verify the new asset expectations fail**

Run: `bun run --cwd scripts test`
Expected: FAIL because `validateReleaseAssets` does not yet require dual-arch mac assets.

- [ ] **Step 3: Tighten release asset validation**

```ts
{
  label: "macOS arm64 DMG",
  matches: (assetName) => assetName.endsWith("-arm64.dmg"),
}
```

- [ ] **Step 4: Update `release.yml` to build both macOS architectures and merge manifests before publish**

```yml
- label: macOS arm64
  runner: macos-14
  platform: mac
  arch: arm64
- label: macOS x64
  runner: macos-13
  platform: mac
  arch: x64
```

```yml
- name: Merge macOS update manifests
  run: node scripts/merge-mac-update-manifests.ts release-assets/latest-mac.yml release-assets/latest-mac-x64.yml release-assets/latest-mac.yml
```

- [ ] **Step 5: Update release smoke fixtures to model the new dual-arch mac release contract**

```ts
writeReleaseAssetFixtures([
  "OK-Code-9.9.9-smoke.0-arm64.dmg",
  "OK-Code-9.9.9-smoke.0-x64.dmg",
  "OK-Code-9.9.9-smoke.0-arm64.zip",
  "OK-Code-9.9.9-smoke.0-x64.zip",
]);
```

- [ ] **Step 6: Re-run the script tests**

Run: `bun run --cwd scripts test`
Expected: PASS for updated asset validation and smoke coverage.

### Task 3: Verify the live published release contract

**Files:**

- Modify: `scripts/release-ship.ts`
- Test: `scripts/release-ship.test.ts`
- Modify: `docs/release.md`

- [ ] **Step 1: Add failing tests for published release inspection**

```ts
it("checks GitHub Release assets for dual-arch mac OTA payloads after workflow success", () => {
  // Assert `gh release view` or `gh api` output is parsed and validated.
});
```

- [ ] **Step 2: Run the script tests to verify the published-release checks fail**

Run: `bun run --cwd scripts test`
Expected: FAIL until `release-ship.ts` validates live release assets.

- [ ] **Step 3: Implement release verification and operator-facing docs**

```ts
const assets = await listReleaseAssets(tag);
validateReleaseAssets(assets);
validateMergedMacManifest(await downloadReleaseAsset(tag, "latest-mac.yml"));
```

```md
Run `bun run release:ship <version>` to perform local preflight, push the tag, wait for `release.yml`, and verify OTA assets on the published GitHub Release.
```

- [ ] **Step 4: Re-run script tests**

Run: `bun run --cwd scripts test`
Expected: PASS for release shipping orchestration and live-release verification logic.

### Task 4: Workspace verification

**Files:**

- Modify: `package.json`
- Modify: `scripts/package.json`
- Modify: `.github/workflows/release.yml`
- Modify: `docs/release.md`
- Modify: `scripts/release-smoke.ts`
- Modify: `scripts/validate-release-assets.ts`
- Modify: `scripts/validate-release-assets.test.ts`
- Create: `scripts/release-ship.ts`
- Create: `scripts/release-ship.test.ts`

- [ ] **Step 1: Run formatting**

Run: `bun run fmt`
Expected: exit 0

- [ ] **Step 2: Run lint**

Run: `bun run lint`
Expected: exit 0

- [ ] **Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: exit 0

- [ ] **Step 4: Run focused script tests and release smoke**

Run: `bun run --cwd scripts test`
Expected: PASS

Run: `bun run release:smoke`
Expected: PASS

- [ ] **Step 5: Run the full required workspace verification**

Run: `bun run fmt && bun run lint && bun run typecheck`
Expected: all exit 0
