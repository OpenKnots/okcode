export type Theme = "light" | "dark" | "system";
export type ColorTheme =
  | "default"
  | "iridescent-void"
  | "carbon"
  | "purple-stuff"
  | "hot-tamale"
  | "custom";

/**
 * Font used for chat messages and most UI text (prose). Applied via the
 * `--font-ui` CSS variable on `:root`. Selection is persisted separately from
 * {@link CodeFont}.
 */
export type MessageFont =
  | "inter"
  | "dm-sans"
  | "plus-jakarta-sans"
  | "playfair-display"
  | "cormorant-garamond"
  | "dm-serif-display"
  | "italiana"
  | "cinzel"
  | "bodoni-moda";

/**
 * Font used for code blocks, diff viewer, terminal, and CodeMirror editors.
 * Applied via the `--font-code` CSS variable on `:root`.
 */
export type CodeFont =
  | "jetbrains-mono"
  | "fira-code"
  | "victor-mono"
  | "cascadia-code"
  | "monaspace-radon"
  | "recursive-mono"
  | "ibm-plex-mono"
  | "source-code-pro";

export interface FontOption<Id extends string> {
  readonly id: Id;
  readonly label: string;
  /** Full CSS `font-family` stack (already quote-escaped). */
  readonly stack: string;
  /** Google Fonts family name to request, or `null` if self-/system-hosted. */
  readonly googleFont: string | null;
}

const SANS_FALLBACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const SERIF_FALLBACK = 'Georgia, "Times New Roman", Didot, serif';
const MONO_FALLBACK =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

export const MESSAGE_FONTS: ReadonlyArray<FontOption<MessageFont>> = [
  {
    id: "inter",
    label: "Inter",
    stack: `"Inter", ${SANS_FALLBACK}`,
    googleFont: "Inter",
  },
  {
    id: "dm-sans",
    label: "DM Sans",
    stack: `"DM Sans", ${SANS_FALLBACK}`,
    googleFont: "DM Sans",
  },
  {
    id: "plus-jakarta-sans",
    label: "Plus Jakarta Sans",
    stack: `"Plus Jakarta Sans", ${SANS_FALLBACK}`,
    googleFont: "Plus Jakarta Sans",
  },
  {
    id: "playfair-display",
    label: "Playfair Display",
    stack: `"Playfair Display", ${SERIF_FALLBACK}`,
    googleFont: "Playfair Display",
  },
  {
    id: "cormorant-garamond",
    label: "Cormorant Garamond",
    stack: `"Cormorant Garamond", Garamond, ${SERIF_FALLBACK}`,
    googleFont: "Cormorant Garamond",
  },
  {
    id: "dm-serif-display",
    label: "DM Serif Display",
    stack: `"DM Serif Display", "Playfair Display", ${SERIF_FALLBACK}`,
    googleFont: "DM Serif Display",
  },
  {
    id: "italiana",
    label: "Italiana",
    stack: `"Italiana", Didot, ${SERIF_FALLBACK}`,
    googleFont: "Italiana",
  },
  {
    id: "cinzel",
    label: "Cinzel",
    stack: `"Cinzel", "Trajan Pro", ${SERIF_FALLBACK}`,
    googleFont: "Cinzel",
  },
  {
    id: "bodoni-moda",
    label: "Bodoni Moda",
    stack: `"Bodoni Moda", Didot, ${SERIF_FALLBACK}`,
    googleFont: "Bodoni Moda",
  },
];

export const CODE_FONTS: ReadonlyArray<FontOption<CodeFont>> = [
  {
    id: "jetbrains-mono",
    label: "JetBrains Mono",
    stack: `"JetBrains Mono", ${MONO_FALLBACK}`,
    googleFont: "JetBrains Mono",
  },
  {
    id: "fira-code",
    label: "Fira Code",
    stack: `"Fira Code", ${MONO_FALLBACK}`,
    googleFont: "Fira Code",
  },
  {
    id: "victor-mono",
    label: "Victor Mono",
    stack: `"Victor Mono", ${MONO_FALLBACK}`,
    googleFont: "Victor Mono",
  },
  {
    id: "cascadia-code",
    label: "Cascadia Code",
    stack: `"Cascadia Code", "Cascadia Mono", ${MONO_FALLBACK}`,
    googleFont: null,
  },
  {
    id: "monaspace-radon",
    label: "Monaspace Radon",
    stack: `"Monaspace Radon", "Monaspace Neon", ${MONO_FALLBACK}`,
    googleFont: null,
  },
  {
    id: "recursive-mono",
    label: "Recursive Mono",
    stack: `"Recursive Mono Casual Static", "Recursive Mono", ${MONO_FALLBACK}`,
    googleFont: "Recursive",
  },
  {
    id: "ibm-plex-mono",
    label: "IBM Plex Mono",
    stack: `"IBM Plex Mono", ${MONO_FALLBACK}`,
    googleFont: "IBM Plex Mono",
  },
  {
    id: "source-code-pro",
    label: "Source Code Pro",
    stack: `"Source Code Pro", ${MONO_FALLBACK}`,
    googleFont: "Source Code Pro",
  },
];

export const COLOR_THEMES: { id: ColorTheme; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "iridescent-void", label: "Iridescent Void" },
  { id: "carbon", label: "Carbon" },
  { id: "purple-stuff", label: "Deep Purple" },
  { id: "hot-tamale", label: "Hot Tamale" },
  { id: "custom", label: "Custom" },
];

export const DEFAULT_COLOR_THEME: ColorTheme = "carbon";
export const DEFAULT_MESSAGE_FONT: MessageFont = "inter";
export const DEFAULT_CODE_FONT: CodeFont = "jetbrains-mono";

const MESSAGE_FONT_IDS: ReadonlySet<string> = new Set(MESSAGE_FONTS.map((f) => f.id));
const CODE_FONT_IDS: ReadonlySet<string> = new Set(CODE_FONTS.map((f) => f.id));

export function isMessageFont(value: unknown): value is MessageFont {
  return typeof value === "string" && MESSAGE_FONT_IDS.has(value);
}

export function isCodeFont(value: unknown): value is CodeFont {
  return typeof value === "string" && CODE_FONT_IDS.has(value);
}

// TypeScript under `noUncheckedIndexedAccess` types MESSAGE_FONTS[0] as
// possibly undefined even though the array literal guarantees otherwise.
// Pull the fallback out into a named constant whose type we enforce so the
// resolver can return `string` without a non-null assertion.
const MESSAGE_FONT_FALLBACK_STACK: string = MESSAGE_FONTS[0]?.stack ?? "system-ui, sans-serif";
const CODE_FONT_FALLBACK_STACK: string =
  CODE_FONTS[0]?.stack ?? "ui-monospace, Menlo, Consolas, monospace";

export function getMessageFontStack(id: MessageFont): string {
  return MESSAGE_FONTS.find((f) => f.id === id)?.stack ?? MESSAGE_FONT_FALLBACK_STACK;
}

export function getCodeFontStack(id: CodeFont): string {
  return CODE_FONTS.find((f) => f.id === id)?.stack ?? CODE_FONT_FALLBACK_STACK;
}
