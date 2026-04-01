/**
 * Per-project color system.
 *
 * Each project is deterministically assigned a color from a curated palette
 * based on a simple hash of its `id`. The palette is designed to be visually
 * distinct, accessible in both light and dark modes, and subtle enough to not
 * overwhelm the UI — inspired by Notion's database tag colors and Apple's
 * system tints.
 *
 * Colors are used for:
 * - Sidebar project header tint
 * - Sidebar thread left-accent bar
 * - ChatHeader project badge
 */

import { useMemo } from "react";
import type { ProjectId } from "@okcode/contracts";

// ── Palette ─────────────────────────────────────────────────────────────
// Each entry contains a hue used to derive contextual CSS colors via
// `oklch()`. Using a single hue per slot keeps things cohesive while
// allowing the rendering site to pick lightness/chroma for the context
// (e.g. subtle bg tint vs. badge text).

export interface ProjectColor {
  /** Human-readable label (for potential settings UI). */
  label: string;
  /** Base hue in oklch color space (0-360). */
  hue: number;
  /** Light-mode text color (oklch string). */
  text: string;
  /** Dark-mode text color (oklch string). */
  textDark: string;
  /** Light-mode subtle background (oklch with alpha). */
  bg: string;
  /** Dark-mode subtle background (oklch with alpha). */
  bgDark: string;
  /** Solid accent for dots / left-bar indicators. */
  dot: string;
}

export const PROJECT_COLOR_PALETTE: readonly ProjectColor[] = [
  {
    label: "Blue",
    hue: 250,
    text: "oklch(0.55 0.16 250)",
    textDark: "oklch(0.78 0.12 250)",
    bg: "oklch(0.55 0.16 250 / 0.08)",
    bgDark: "oklch(0.55 0.16 250 / 0.12)",
    dot: "oklch(0.62 0.18 250)",
  },
  {
    label: "Violet",
    hue: 290,
    text: "oklch(0.52 0.17 290)",
    textDark: "oklch(0.76 0.13 290)",
    bg: "oklch(0.52 0.17 290 / 0.08)",
    bgDark: "oklch(0.52 0.17 290 / 0.12)",
    dot: "oklch(0.60 0.19 290)",
  },
  {
    label: "Rose",
    hue: 355,
    text: "oklch(0.55 0.17 355)",
    textDark: "oklch(0.78 0.12 355)",
    bg: "oklch(0.55 0.17 355 / 0.08)",
    bgDark: "oklch(0.55 0.17 355 / 0.12)",
    dot: "oklch(0.62 0.18 355)",
  },
  {
    label: "Orange",
    hue: 50,
    text: "oklch(0.55 0.14 50)",
    textDark: "oklch(0.78 0.11 50)",
    bg: "oklch(0.55 0.14 50 / 0.08)",
    bgDark: "oklch(0.55 0.14 50 / 0.12)",
    dot: "oklch(0.65 0.16 50)",
  },
  {
    label: "Teal",
    hue: 180,
    text: "oklch(0.50 0.10 180)",
    textDark: "oklch(0.76 0.08 180)",
    bg: "oklch(0.50 0.10 180 / 0.08)",
    bgDark: "oklch(0.50 0.10 180 / 0.12)",
    dot: "oklch(0.58 0.12 180)",
  },
  {
    label: "Green",
    hue: 150,
    text: "oklch(0.50 0.12 150)",
    textDark: "oklch(0.76 0.10 150)",
    bg: "oklch(0.50 0.12 150 / 0.08)",
    bgDark: "oklch(0.50 0.12 150 / 0.12)",
    dot: "oklch(0.58 0.14 150)",
  },
  {
    label: "Amber",
    hue: 75,
    text: "oklch(0.52 0.12 75)",
    textDark: "oklch(0.78 0.10 75)",
    bg: "oklch(0.52 0.12 75 / 0.08)",
    bgDark: "oklch(0.52 0.12 75 / 0.12)",
    dot: "oklch(0.62 0.14 75)",
  },
  {
    label: "Indigo",
    hue: 270,
    text: "oklch(0.50 0.18 270)",
    textDark: "oklch(0.75 0.14 270)",
    bg: "oklch(0.50 0.18 270 / 0.08)",
    bgDark: "oklch(0.50 0.18 270 / 0.12)",
    dot: "oklch(0.58 0.20 270)",
  },
  {
    label: "Pink",
    hue: 330,
    text: "oklch(0.55 0.16 330)",
    textDark: "oklch(0.78 0.12 330)",
    bg: "oklch(0.55 0.16 330 / 0.08)",
    bgDark: "oklch(0.55 0.16 330 / 0.12)",
    dot: "oklch(0.62 0.17 330)",
  },
  {
    label: "Cyan",
    hue: 210,
    text: "oklch(0.52 0.12 210)",
    textDark: "oklch(0.78 0.10 210)",
    bg: "oklch(0.52 0.12 210 / 0.08)",
    bgDark: "oklch(0.52 0.12 210 / 0.12)",
    dot: "oklch(0.60 0.14 210)",
  },
] as const;

// ── Hash ────────────────────────────────────────────────────────────────
// Simple djb2-style hash to deterministically map a project ID to a
// palette index. Stable across sessions.

function hashProjectId(id: string): number {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) + hash + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getProjectColorIndex(projectId: ProjectId): number {
  return hashProjectId(projectId) % PROJECT_COLOR_PALETTE.length;
}

export function getProjectColor(projectId: ProjectId): ProjectColor {
  return PROJECT_COLOR_PALETTE[getProjectColorIndex(projectId)]!;
}

// ── React hook ──────────────────────────────────────────────────────────

export function useProjectColor(projectId: ProjectId | null | undefined): ProjectColor | null {
  return useMemo(() => {
    if (!projectId) return null;
    return getProjectColor(projectId);
  }, [projectId]);
}
