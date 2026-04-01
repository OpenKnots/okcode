# CapApp-SPM (Capacitor Swift Package)

This directory is a generated Swift Package integration point for the native mobile
shell. It is managed by Capacitor tooling and should be treated as a reproducible
native dependency boundary.

## 1) What this package is

- Package name: `CapApp-SPM`
- Product: `CapApp-SPM`
- Target(s): `CapApp-SPM`
- Platforms: iOS 15+

Primary goals:

- provide a stable dependency entrypoint into the native layer,
- keep native package metadata separate from app JS source trees,
- avoid hand-editing generated package internals.

## 2) Files here

- `Package.swift`
- `Sources/` (package targets/source)

The current `Package.swift` includes local package links into Bun-managed `node_modules`
paths, which is why it is intentionally generated rather than hand-maintained.

## 3) Install and wire into an Xcode project

1. In Xcode, open your `.xcworkspace` / `.xcodeproj`.
2. Go to **File → Add Packages…**.
3. Add by local path:
   - `apps/mobile/ios/App/CapApp-SPM`
4. Add the `CapApp-SPM` product to the appropriate app target.

### Target mapping quick reference

- Package: `CapApp-SPM`
- Product: `CapApp-SPM`
- Usually added to the main app target and the extensions that depend on Capacitor modules.

## 4) Regenerating after dependency changes

When web/native dependency versions change in `apps/mobile`, regenerate this package
using your normal Capacitor sync workflow (outside this folder) and commit generated
updates if required.

Recommended sequence:

```bash
cd apps/mobile
bun run sync
cd ios/App
# regenerate native project references through your normal mobile tooling
```

Then reopen Xcode and run package resolve.

## 5) Build and debug checks

### Before a build

- Open the workspace cleanly.
- Remove stale derived data if dependency resolution changed.
- Validate package resolve on local machine first.

### Common failure states

- **Package not found / cannot resolve product**
  - verify path points to `CapApp-SPM/` and Xcode selected the correct package product.
- **Build fails with module resolution issues**
  - clean build folder and re-resolve package dependencies.
- **Code signing breaks after package edits**
  - re-check provisioning profile and signing identity for native targets.

## 6) CI/release implications

For release and package integrity:

- keep native package updates deterministic,
- avoid ad-hoc local path edits that are not reflected in source control,
- verify any package-manager-driven changes are generated and committed with the
  corresponding release or mobile update.

## 7) Reference

This package is separate from release docs in [`docs/releases/README.md`](/Users/buns/.okcode/worktrees/okcode/okcode-ddc899c0/docs/releases/README.md),
which controls desktop artifact publication and GitHub release behavior.
