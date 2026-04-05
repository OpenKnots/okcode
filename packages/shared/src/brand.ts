/**
 * Canonical brand constants for the OK Code product.
 *
 * Import from `@okcode/shared/brand` in any workspace package.
 * The web app's `branding.ts` re-exports these with Vite-specific additions
 * (stage labels, build-time version injection).
 */

/** Base product name — use for display text that should not include a stage label. */
export const APP_BASE_NAME = "OK Code";

/** Git committer identity used by OK Code's internal operations (checkpoints, etc.). */
export const GIT_IDENTITY_NAME = APP_BASE_NAME;
