/**
 * Custom theme support — parse, apply, and persist themes from tweakcn.com
 *
 * Supports three input formats:
 *   1. Raw CSS (from tweakcn "Copy CSS" or any shadcn-compatible CSS)
 *   2. JSON (shadcn registry format from tweakcn API)
 *   3. tweakcn.com URLs (fetched via their CORS-enabled API)
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** CSS variable names we map from imported themes into our theme system. */
const SUPPORTED_COLOR_VARS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "info",
  "info-foreground",
  "success",
  "success-foreground",
  "warning",
  "warning-foreground",
] as const;

const SUPPORTED_DESIGN_VARS = ["radius"] as const;

const SUPPORTED_FONT_VARS = ["font-sans", "font-serif", "font-mono"] as const;

const SUPPORTED_SHADOW_VARS = [
  "shadow-2xs",
  "shadow-xs",
  "shadow-sm",
  "shadow",
  "shadow-md",
  "shadow-lg",
  "shadow-xl",
  "shadow-2xl",
] as const;

const ALL_SUPPORTED_VARS = new Set<string>([
  ...SUPPORTED_COLOR_VARS,
  ...SUPPORTED_DESIGN_VARS,
  ...SUPPORTED_FONT_VARS,
  ...SUPPORTED_SHADOW_VARS,
]);

const CUSTOM_THEME_STORAGE_KEY = "okcode:custom-theme";
const CUSTOM_THEME_STYLE_ID = "okcode-custom-theme-style";
const CUSTOM_THEME_FONT_LINK_ID = "okcode-custom-theme-fonts";
const RADIUS_OVERRIDE_KEY = "okcode:radius-override";
const FONT_OVERRIDE_KEY = "okcode:font-override";
const BACKGROUND_IMAGE_KEY = "okcode:background-image";
const BACKGROUND_OPACITY_KEY = "okcode:background-opacity";
const BACKGROUND_STYLE_ID = "okcode-background-image-style";

/** System-bundled fonts that don't need to be loaded from Google Fonts. */
const SYSTEM_FONTS = new Set([
  "system-ui",
  "-apple-system",
  "blinkmacsystemfont",
  "segoe ui",
  "roboto",
  "helvetica neue",
  "arial",
  "sans-serif",
  "serif",
  "monospace",
  "sf mono",
  "sfmono-regular",
  "consolas",
  "liberation mono",
  "menlo",
  "courier new",
  "dm sans",
  "georgia",
  "times new roman",
  "times",
  "ui-monospace",
  "ui-sans-serif",
  "ui-serif",
]);

// ---------------------------------------------------------------------------
// Environment Guard
// ---------------------------------------------------------------------------

/** Returns true when a full browser DOM is available (not a Node/test stub). */
function hasDom(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.getElementById === "function" &&
    typeof document.createElement === "function"
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CustomThemeData {
  name?: string | undefined;
  light: Record<string, string>;
  dark: Record<string, string>;
}

// ---------------------------------------------------------------------------
// CSS Parsing
// ---------------------------------------------------------------------------

/** Extract content between matched braces starting after an opening `{`. */
function extractBraceContent(css: string, startAfterBrace: number): string {
  let depth = 1;
  let i = startAfterBrace;
  while (i < css.length && depth > 0) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
    i++;
  }
  return css.substring(startAfterBrace, i - 1);
}

/** Pull all `--name: value;` declarations out of a CSS block. */
function extractVariables(block: string): Record<string, string> {
  const vars: Record<string, string> = {};
  // Match CSS custom property declarations, handling values that can contain
  // parentheses (like oklch(...), hsl(...), calc(...), rgba(...))
  const regex = /--([\w-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(block)) !== null) {
    const name = match[1]?.trim();
    const value = match[2]?.trim();
    if (!name || !value) continue;
    if (ALL_SUPPORTED_VARS.has(name)) {
      vars[name] = value;
    }
  }
  return vars;
}

/** Filter to only include variables we support. */
function filterSupported(vars: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    if (ALL_SUPPORTED_VARS.has(k)) {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Parse CSS text that contains `:root` and `.dark` blocks.
 * Handles both bare selectors and selectors nested inside `@layer base { }`.
 */
export function parseThemeCSS(css: string): CustomThemeData {
  // Strip comments
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, "");

  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};

  // Find :root blocks (may or may not be inside @layer base)
  const rootRegex = /:root\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = rootRegex.exec(cleaned)) !== null) {
    const start = match.index + match[0].length;
    const content = extractBraceContent(cleaned, start);
    Object.assign(light, extractVariables(content));
  }

  // Find .dark blocks
  const darkRegex = /\.dark\s*\{/g;
  while ((match = darkRegex.exec(cleaned)) !== null) {
    const start = match.index + match[0].length;
    const content = extractBraceContent(cleaned, start);
    Object.assign(dark, extractVariables(content));
  }

  // Fallback: if no blocks found, try parsing the whole thing as a list of vars
  // (user may have just pasted the variable declarations)
  if (Object.keys(light).length === 0 && Object.keys(dark).length === 0) {
    const vars = extractVariables(cleaned);
    Object.assign(light, vars);
    // Copy light vars to dark as a reasonable default
    Object.assign(dark, vars);
  }

  return { light, dark };
}

// ---------------------------------------------------------------------------
// tweakcn JSON Parsing
// ---------------------------------------------------------------------------

/**
 * Parse the JSON format returned by tweakcn's `/r/themes/[id]` API endpoint
 * (shadcn registry format).
 */
export function parseTweakcnJSON(json: unknown): CustomThemeData {
  if (!json || typeof json !== "object") {
    throw new Error("Invalid theme JSON");
  }

  const obj = json as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name : undefined;

  const cssVars = obj.cssVars as Record<string, Record<string, string>> | undefined;
  if (!cssVars || typeof cssVars !== "object") {
    throw new Error('Theme JSON missing "cssVars" object');
  }

  const light = filterSupported({
    ...cssVars.theme,
    ...cssVars.light,
  });

  const dark = filterSupported({
    ...cssVars.theme,
    ...cssVars.dark,
  });

  if (Object.keys(light).length === 0 && Object.keys(dark).length === 0) {
    throw new Error("No supported theme variables found in JSON");
  }

  return { name, light, dark };
}

// ---------------------------------------------------------------------------
// URL Handling
// ---------------------------------------------------------------------------

const TWEAKCN_URL_PATTERNS = [
  /^https?:\/\/(?:www\.)?tweakcn\.com\/r\/themes\/([^/?#]+)/,
  /^https?:\/\/(?:www\.)?tweakcn\.com\/themes\/([^/?#]+)/,
];

/** Check if a string looks like a tweakcn.com URL. */
export function isTweakcnURL(input: string): boolean {
  const trimmed = input.trim();
  return TWEAKCN_URL_PATTERNS.some((re) => re.test(trimmed));
}

/** Extract the theme ID from a tweakcn URL. */
function extractTweakcnThemeId(url: string): string | null {
  const trimmed = url.trim();
  for (const re of TWEAKCN_URL_PATTERNS) {
    const m = trimmed.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** Fetch a theme from tweakcn's API (has `Access-Control-Allow-Origin: *`). */
export async function fetchTweakcnTheme(url: string): Promise<CustomThemeData> {
  const themeId = extractTweakcnThemeId(url);
  if (!themeId) {
    throw new Error("Could not extract theme ID from URL");
  }

  const apiUrl = `https://tweakcn.com/r/themes/${encodeURIComponent(themeId)}`;
  const res = await fetch(apiUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch theme: ${res.status} ${res.statusText}`);
  }

  const json: unknown = await res.json();
  return parseTweakcnJSON(json);
}

// ---------------------------------------------------------------------------
// Smart Input Parser
// ---------------------------------------------------------------------------

/**
 * Parse any user input — CSS text, JSON, or a tweakcn URL — and return a
 * `CustomThemeData` object.
 */
export async function parseThemeInput(input: string): Promise<CustomThemeData> {
  const trimmed = input.trim();

  // 1. tweakcn URL
  if (isTweakcnURL(trimmed)) {
    return fetchTweakcnTheme(trimmed);
  }

  // 2. JSON (starts with { or [)
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const json: unknown = JSON.parse(trimmed);
      return parseTweakcnJSON(json);
    } catch {
      // Fall through to CSS parsing
    }
  }

  // 3. CSS
  const parsed = parseThemeCSS(trimmed);
  if (Object.keys(parsed.light).length === 0 && Object.keys(parsed.dark).length === 0) {
    throw new Error("No theme variables found. Paste CSS from tweakcn.com or a tweakcn theme URL.");
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Google Font Loading
// ---------------------------------------------------------------------------

/** Extract font family names that need to be loaded from Google Fonts. */
function extractGoogleFonts(theme: CustomThemeData): string[] {
  const fonts = new Set<string>();

  for (const mode of [theme.light, theme.dark]) {
    for (const key of SUPPORTED_FONT_VARS) {
      const value = mode[key];
      if (!value) continue;

      // Parse font stack: "Plus Jakarta Sans, sans-serif" → ["Plus Jakarta Sans"]
      const families = value.split(",").map((f) => f.trim().replace(/^["']|["']$/g, ""));
      for (const family of families) {
        if (family && !SYSTEM_FONTS.has(family.toLowerCase())) {
          fonts.add(family);
        }
      }
    }
  }

  return Array.from(fonts);
}

/** Inject a <link> tag to load Google Fonts for the custom theme. */
function loadGoogleFonts(fonts: string[]): void {
  if (!hasDom()) return;
  // Remove existing link
  document.getElementById(CUSTOM_THEME_FONT_LINK_ID)?.remove();

  if (fonts.length === 0) return;

  const families = fonts.map((f) => `family=${f.replace(/\s+/g, "+")}:wght@300..800`).join("&");
  const url = `https://fonts.googleapis.com/css2?${families}&display=swap`;

  const link = document.createElement("link");
  link.id = CUSTOM_THEME_FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

/** Remove the Google Fonts <link> tag. */
function unloadGoogleFonts(): void {
  if (!hasDom()) return;
  document.getElementById(CUSTOM_THEME_FONT_LINK_ID)?.remove();
}

// ---------------------------------------------------------------------------
// Theme Application
// ---------------------------------------------------------------------------

/** Build the CSS text for the custom theme `<style>` tag. */
function buildCustomThemeCSS(theme: CustomThemeData): string {
  const lines: string[] = [];

  // Light mode
  lines.push(":root.theme-custom {");
  lines.push("  color-scheme: light;");
  for (const [key, value] of Object.entries(theme.light)) {
    // Font variables also need to be applied to body/code elements, but the
    // CSS variables themselves are set here so components can reference them.
    lines.push(`  --${key}: ${value};`);
  }
  lines.push("}");
  lines.push("");

  // Dark mode
  lines.push(":root.theme-custom.dark {");
  lines.push("  color-scheme: dark;");
  for (const [key, value] of Object.entries(theme.dark)) {
    lines.push(`  --${key}: ${value};`);
  }
  lines.push("}");

  // Font overrides (applied via higher-specificity selectors)
  const lightSans = theme.light["font-sans"];
  const lightMono = theme.light["font-mono"];
  if (lightSans) {
    lines.push("");
    lines.push(`.theme-custom body { font-family: ${lightSans}; }`);
  }
  if (lightMono) {
    lines.push(
      `.theme-custom pre, .theme-custom code, .theme-custom textarea, .theme-custom input { font-family: ${lightMono}; }`,
    );
  }

  return lines.join("\n");
}

/** Inject or update the custom theme `<style>` element. */
export function applyCustomTheme(theme: CustomThemeData): void {
  if (!hasDom()) return;
  let styleEl = document.getElementById(CUSTOM_THEME_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = CUSTOM_THEME_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = buildCustomThemeCSS(theme);

  // Load any non-system fonts
  const googleFonts = extractGoogleFonts(theme);
  loadGoogleFonts(googleFonts);
}

/** Remove the custom theme style element and fonts. */
export function removeCustomTheme(): void {
  if (!hasDom()) return;
  document.getElementById(CUSTOM_THEME_STYLE_ID)?.remove();
  unloadGoogleFonts();
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export function getStoredCustomTheme(): CustomThemeData | null {
  try {
    const raw = localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CustomThemeData;
    if (data && typeof data.light === "object" && typeof data.dark === "object") {
      return data;
    }
  } catch {
    // ignore
  }
  return null;
}

export function setStoredCustomTheme(theme: CustomThemeData): void {
  localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(theme));
}

export function clearStoredCustomTheme(): void {
  localStorage.removeItem(CUSTOM_THEME_STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Radius Override
// ---------------------------------------------------------------------------

export function getStoredRadiusOverride(): number | null {
  const raw = localStorage.getItem(RADIUS_OVERRIDE_KEY);
  if (raw === null) return null;
  const num = Number.parseFloat(raw);
  return Number.isFinite(num) ? num : null;
}

export function setStoredRadiusOverride(rem: number): void {
  localStorage.setItem(RADIUS_OVERRIDE_KEY, String(rem));
  if (hasDom()) {
    document.documentElement.style.setProperty("--radius", `${rem}rem`);
  }
}

export function clearRadiusOverride(): void {
  localStorage.removeItem(RADIUS_OVERRIDE_KEY);
  if (hasDom()) {
    document.documentElement.style.removeProperty("--radius");
  }
}

export function applyRadiusOverride(): void {
  if (!hasDom()) return;
  const val = getStoredRadiusOverride();
  if (val !== null) {
    document.documentElement.style.setProperty("--radius", `${val}rem`);
  }
}

// ---------------------------------------------------------------------------
// Font Override (applies on top of any theme)
// ---------------------------------------------------------------------------

export function getStoredFontOverride(): string | null {
  return localStorage.getItem(FONT_OVERRIDE_KEY) || null;
}

export function setStoredFontOverride(fontFamily: string): void {
  localStorage.setItem(FONT_OVERRIDE_KEY, fontFamily);
  applyFontOverride();
}

export function clearFontOverride(): void {
  localStorage.removeItem(FONT_OVERRIDE_KEY);
  if (hasDom()) {
    document.documentElement.style.removeProperty("--font-override");
    document.getElementById("okcode-font-override-style")?.remove();
  }
}

export function applyFontOverride(): void {
  if (!hasDom()) return;
  const font = getStoredFontOverride();
  if (!font) return;

  let styleEl = document.getElementById("okcode-font-override-style") as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "okcode-font-override-style";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `body { font-family: ${font} !important; }`;

  // Load from Google Fonts if it's not a system font
  const families = font.split(",").map((f) => f.trim().replace(/^["']|["']$/g, ""));
  const googleFonts = families.filter((f) => f && !SYSTEM_FONTS.has(f.toLowerCase()));
  if (googleFonts.length > 0) {
    let linkEl = document.getElementById("okcode-font-override-link") as HTMLLinkElement | null;
    if (!linkEl) {
      linkEl = document.createElement("link");
      linkEl.id = "okcode-font-override-link";
      linkEl.rel = "stylesheet";
      document.head.appendChild(linkEl);
    }
    const familyParams = googleFonts
      .map((f) => `family=${f.replace(/\s+/g, "+")}:wght@300..800`)
      .join("&");
    linkEl.href = `https://fonts.googleapis.com/css2?${familyParams}&display=swap`;
  }
}

// ---------------------------------------------------------------------------
// Background Image Override
// ---------------------------------------------------------------------------

export function getStoredBackgroundImage(): string | null {
  return localStorage.getItem(BACKGROUND_IMAGE_KEY) || null;
}

export function getStoredBackgroundOpacity(): number | null {
  const raw = localStorage.getItem(BACKGROUND_OPACITY_KEY);
  if (raw === null) return null;
  const num = Number.parseFloat(raw);
  return Number.isFinite(num) ? num : null;
}

export function setStoredBackgroundImage(url: string): void {
  localStorage.setItem(BACKGROUND_IMAGE_KEY, url);
  applyBackgroundImage();
}

export function setStoredBackgroundOpacity(opacity: number): void {
  localStorage.setItem(BACKGROUND_OPACITY_KEY, String(opacity));
  applyBackgroundImage();
}

export function clearBackgroundImage(): void {
  localStorage.removeItem(BACKGROUND_IMAGE_KEY);
  localStorage.removeItem(BACKGROUND_OPACITY_KEY);
  if (hasDom()) {
    document.getElementById(BACKGROUND_STYLE_ID)?.remove();
  }
}

export function applyBackgroundImage(): void {
  if (!hasDom()) return;
  const url = getStoredBackgroundImage();
  if (!url) {
    document.getElementById(BACKGROUND_STYLE_ID)?.remove();
    return;
  }

  const opacity = getStoredBackgroundOpacity() ?? 0.15;

  let styleEl = document.getElementById(BACKGROUND_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = BACKGROUND_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  // Use a ::before pseudo-element on #root so it layers behind content but
  // above the body background color, with controllable opacity.
  const escapedUrl = url.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  styleEl.textContent = `
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      background-image: url("${escapedUrl}");
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      opacity: ${opacity};
    }
    #root {
      position: relative;
      z-index: 1;
    }
  `;
}

// ---------------------------------------------------------------------------
// Initialization (called on module load)
// ---------------------------------------------------------------------------

/** Restore persisted custom theme + overrides on app boot. */
export function initCustomTheme(): void {
  if (!hasDom() || typeof localStorage === "undefined") return;
  // If a custom theme is stored and selected, apply it
  const colorTheme = localStorage.getItem("okcode:color-theme");
  if (colorTheme === "custom") {
    const theme = getStoredCustomTheme();
    if (theme) {
      applyCustomTheme(theme);
    }
  }

  // Always apply radius override if set
  applyRadiusOverride();

  // Always apply font override if set
  applyFontOverride();

  // Always apply background image if set
  applyBackgroundImage();
}
