# Release Playbook (Desktop + site assets)

This document defines how to produce, validate, and publish official releases from
`main` with the current GitHub Actions pipeline.

## 1) Trigger modes

### 1.1 Tag-driven release

- Push a tag in the form `v<semver>` (for example `v0.0.10`).
- `preflight` resolves `version` from the tag and runs required checks.

### 1.2 Manual dispatch

- Uses `workflow_dispatch` inputs:
  - `version` (required; examples: `0.0.10` or `0.0.10-rc.1`)
  - `mac_arm64_only` (default: `true`)
- Useful for controlled smoke/release dry-runs.

## 2) Current CI stages

### 2.1 `configure`

- Selects release matrix.
- macOS default is Apple Silicon only when `mac_arm64_only=true`:
  - `macos-14` + `mac` + `dmg` + `arm64`
- Full matrix (default for manual off switch) includes:
  - `macos-14` + `arm64`
  - `ubuntu-24.04` + `x64` AppImage
  - `windows-2022` + `x64` NSIS

### 2.2 `preflight`

Executed on Ubuntu and includes:

- dependency install (`bun install --frozen-lockfile`)
- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run release:smoke`

Any failure here blocks build and publish jobs.

### 2.3 `build` (matrixed)

For each target:

1. Checkout release ref.
2. Install dependencies.
3. Align package versions (`scripts/update-release-package-versions.ts`).
4. Build desktop artifact with `bun run dist:desktop:artifact`.
5. Collect release outputs (`release/*.dmg`, `release/*.AppImage`, `release/*.exe`, blockmaps, `latest*.yml`).
6. Upload per-platform artifact bundle.

### 2.4 `release`

- downloads all uploaded build artifacts,
- requires release docs to exist:
  - `docs/releases/v<version>.md`
  - `docs/releases/v<version>/assets.md`
- stages these as release body artifacts, then publishes release via `softprops/action-gh-release`.

### 2.5 `finalize`

- validates `RELEASE_APP_ID` / `RELEASE_APP_PRIVATE_KEY`,
- creates GitHub App token and bot identity,
- re-runs version bump flow and updates lockfile if needed,
- pushes version updates back to `main`.

## 2.6 Operational matrix (release commands)

| Trigger                    | Command/target                                                                     | Expected output                                                                 | Failure signal                              | Recovery                                                   |
| -------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| Tag-driven release         | push `v<version>`                                                                  | `configure` → `preflight` → matrix `build` → `release` → `finalize` all succeed | missing/failed preflight gate               | fix local violations, update commit, re-tag if needed      |
| Manual release             | workflow_dispatch with `version`                                                   | same stages as tag-driven                                                       | matrix wrong for architecture targets       | set `mac_arm64_only` explicitly                            |
| Format regression          | `bun run fmt`                                                                      | files rewritten                                                                 | `bun run fmt:check` fails in `preflight`    | commit formatter output                                    |
| Type/contract regressions  | `bun run typecheck`                                                                | clean compile output                                                            | `TS` errors in preflight                    | update contracts and both producer/consumer sides together |
| Release content regression | `git show` on `docs/releases/v<version>.md` + `docs/releases/v<version>/assets.md` | both files present and committed                                                | `release` job fails missing files           | add both files and rerun release                           |
| Asset mismatch             | build logs / upload-artifact                                                       | expected platform assets in `release-publish`                                   | `if-no-files-found: error` or missing files | verify `release/` output names and rerun build             |

## 3) Required release assets

For each release version `X.Y.Z`, commit:

- `docs/releases/vX.Y.Z.md` (release notes body)
- `docs/releases/vX.Y.Z/assets.md` (asset manifest used in release publish step)

The publish step copies both into `release-assets` and uses them for release artifacts.

## 4) Standard release checklist

1. Start from `main`:

   ```bash
   git checkout main
   git pull --ff-only
   ```

2. Ensure current format/lint/type/test gates are green locally:

   ```bash
   bun run fmt
   bun run fmt:check
   bun run lint
   bun run typecheck
   bun run test
   ```

3. Prepare release notes and asset manifest:

   ```bash
   mkdir -p docs/releases/v0.0.10
   touch docs/releases/v0.0.10.md
   touch docs/releases/v0.0.10/assets.md
   ```

4. Commit release notes updates.

5. Cut and push tag:

   ```bash
   git tag -a v0.0.10 -m "Release 0.0.10"
   git push origin v0.0.10
   ```

6. Watch workflow progress:
   - `Release Desktop / preflight`
   - `Release Desktop / build (...)`
   - `Release Desktop / release`
   - `Release Desktop / finalize`

7. Verify final output includes:
   - expected platform artifacts,
   - release body and assets manifest,
   - optional signing/ notarization status,
   - version bumps committed by finalize job (if any).

## 5) Failure triage

### 5.1 Preflight failures

- **Lint/typecheck/test failure**
  - reproduce locally with the same command from section 4.
  - fix at source, rerun gate, then re-run tag/release path.

- **Release smoke failure**
  - inspect `bun run release:smoke` logs and confirm expected runtime prerequisites.

### 5.2 Build failures

- **Wrong architecture in matrix**
  - confirm intended architecture matrix by checking `configure` job output.
  - for Apple Silicon-only runs, ensure `mac_arm64_only` is true.
- **Signing/notarization failure**
  - confirm required GitHub secrets are present in repository settings.
- **No files found during upload**
  - check artifact output paths (`release/*.dmg`, `release/*.AppImage`, etc.)
  - verify build command produced files in `release/`.

### 5.3 Release staging failures

- **Missing `docs/releases/vX.md` or `docs/releases/vX/assets.md`**
  - create both files before triggering release.
- **`softprops` failures (`fail_on_unmatched_files`)**
  - ensure all build artifacts + docs copies exist in `release-assets`.

## 6) Release policy and best practices

- Prefer single-purpose PRs for release content vs release infra changes.
- Keep release notes and manifest content deterministic for reproducibility.
- Prefer appending bugfixes/notes to the current patch version before bumping major/minor.
- Keep signing certificates and identity changes centralized in CI secrets.
- Use the changelog + release notes as a single source for user-visible changes.

## 7) Optional manual triggers

- For staging-only release runs, use `workflow_dispatch` with explicit version and
  `mac_arm64_only` preference.
- For normal full desktop releases, set `mac_arm64_only=false` only when x64 macOS,
  Linux, and Windows artifacts are all required.
