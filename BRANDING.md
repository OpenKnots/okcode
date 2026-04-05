# OK Code — Branding & Design System

> **Document Status:** Living reference for OK Code's visual identity and design language.
> Items marked with `[TBD]` require input from the team.

---

## 1. Brand Identity

| Property                  | Value                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **App Name**              | OK Code                                                                                                            |
| **Stage Label**           | Dev (development only)                                                                                             |
| **Display Name**          | OK Code                                                                                                            |
| **Version**               | 0.0.1                                                                                                              |
| **Tagline**               | A Minimal Web GUI for Coding Agents                                                                                |
| **One-liner Description** | Chat with Codex and Claude in a modern web UI. Git worktree isolation, diff review, integrated terminal, and more. |
| **Parent Organization**   | OpenKnots                                                                                                          |
| **Website URL**           | `[TBD]`                                                                                                            |
| **Repository**            | `OpenKnots/okcode`                                                                                                 |

### Brand Voice & Tone

| Attribute                    | Description                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| **Personality**              | Professional, direct, minimal — a tool built by developers, for developers                      |
| **Tone**                     | Confident but not arrogant; technical but accessible                                            |
| **Copy Style**               | Action-oriented imperatives ("New Thread", "Terminal", "Settings"); no unnecessary filler words |
| **Audience**                 | Software engineers and technical users                                                          |
| **Emoji Usage**              | None in UI copy; reserved for user-generated content only                                       |
| **Error/Empty States Voice** | Concise and helpful; state what happened and what to do next, no blame or humor                 |

---

## 2. Logo & App Icons

### Files

| Asset            | Path                                         | Size      |
| ---------------- | -------------------------------------------- | --------- |
| Logo (SVG)       | `assets/prod/logo.svg`                       | 1024×1024 |
| Mark             | `assets/prod/okcode-mark-1024.png`           | 1024×1024 |
| macOS Icon       | `assets/prod/okcode-macos-1024.png`          | 1024×1024 |
| iOS Icon         | `assets/prod/okcode-ios-1024.png`            | 1024×1024 |
| Linux Icon       | `assets/prod/okcode-linux-1024.png`          | 1024×1024 |
| Windows Icon     | `assets/prod/okcode-windows.ico`             | —         |
| Favicon (ICO)    | `assets/prod/okcode-web-favicon.ico`         | 48×48     |
| Favicon 32px     | `assets/prod/okcode-web-favicon-32x32.png`   | 32×32     |
| Favicon 16px     | `assets/prod/okcode-web-favicon-16x16.png`   | 16×16     |
| Apple Touch Icon | `assets/prod/okcode-web-apple-touch-180.png` | 180×180   |

### Logo Construction

The logo SVG is a **mark on a black (#000000) background**, rendered at 1024×1024.

| Property                  | Value                                                                            |
| ------------------------- | -------------------------------------------------------------------------------- |
| **Logo Mark Description** | Interlaced white knot mark on a black square background                          |
| **Logo Colors**           | Black background (#000000) + white mark (#FFFFFF)                                |
| **Minimum Size**          | 24px for the mark alone                                                          |
| **Clear Space**           | At least one mark width on all sides                                             |
| **Usage Guidelines**      | Use the mark asset for brand surfaces; avoid generic icons or placeholder glyphs |

---

## 3. Color Palette

The design system uses **OKLCh** color space for the primary brand color and **Tailwind CSS 4** semantic tokens with alpha-blended neutrals.

### Primary Brand Color

| Token                      | Light Mode                                    | Dark Mode                                        |
| -------------------------- | --------------------------------------------- | ------------------------------------------------ |
| **`--primary`**            | `oklch(0.488 0.217 264)` — deep indigo/purple | `oklch(0.588 0.217 264)` — lighter indigo/purple |
| **`--primary-foreground`** | White                                         | White                                            |
| **`--ring`**               | Same as primary                               | Same as primary                                  |

> **Note:** Hue 264 in OKLCh maps to a vivid blue-violet/indigo.

### Semantic Color Tokens

#### Surfaces & Text

| Token                  | Light Mode  | Dark Mode                        |
| ---------------------- | ----------- | -------------------------------- |
| `--background`         | White       | neutral-950 (95% mix with white) |
| `--foreground`         | neutral-800 | neutral-100                      |
| `--card`               | White       | background (98% mix with white)  |
| `--card-foreground`    | neutral-800 | neutral-100                      |
| `--popover`            | White       | background (98% mix with white)  |
| `--popover-foreground` | neutral-800 | neutral-100                      |

#### Secondary & Muted

| Token                    | Light Mode                       | Dark Mode                        |
| ------------------------ | -------------------------------- | -------------------------------- |
| `--secondary`            | black / 4% alpha                 | white / 4% alpha                 |
| `--secondary-foreground` | neutral-800                      | neutral-100                      |
| `--muted`                | black / 4% alpha                 | white / 4% alpha                 |
| `--muted-foreground`     | neutral-500 (90% mix with black) | neutral-500 (90% mix with white) |
| `--accent`               | black / 4% alpha                 | white / 4% alpha                 |
| `--accent-foreground`    | neutral-800                      | neutral-100                      |

#### Borders & Inputs

| Token      | Light Mode        | Dark Mode        |
| ---------- | ----------------- | ---------------- |
| `--border` | black / 8% alpha  | white / 6% alpha |
| `--input`  | black / 10% alpha | white / 8% alpha |

#### Status Colors

| Status          | Base        | Foreground (Light) | Foreground (Dark) |
| --------------- | ----------- | ------------------ | ----------------- |
| **Destructive** | red-500     | red-700            | red-400           |
| **Info**        | blue-500    | blue-700           | blue-400          |
| **Success**     | emerald-500 | emerald-700        | emerald-400       |
| **Warning**     | amber-500   | amber-700          | amber-400         |

#### Special: Ultrathink Rainbow Gradient

Used for the extended-thinking loading indicator:

```
linear-gradient(120deg,
  #ff6b6b  0%,   /* Red */
  #f59e0b  18%,  /* Amber */
  #22c55e  36%,  /* Emerald */
  #14b8a6  54%,  /* Teal */
  #3b82f6  72%,  /* Blue */
  #ec4899  90%,  /* Pink */
  #ff6b6b  100%  /* Red — loops */
)
```

---

## 4. Typography

### Font Families

| Role                 | Font Stack                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------- |
| **UI / Body**        | `"DM Sans"`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `system-ui`, `sans-serif` |
| **Monospace / Code** | `"SF Mono"`, `"SFMono-Regular"`, `Consolas`, `"Liberation Mono"`, `Menlo`, `monospace`      |

**DM Sans** is loaded from Google Fonts as a variable font (weight axis: 300–800, with italic support).

### Type Scale

| Usage                | Size               | Weight                | Notes                      |
| -------------------- | ------------------ | --------------------- | -------------------------- |
| Button (default)     | `text-base` (16px) | `font-medium` (500)   |                            |
| Button (small)       | `text-sm` (14px)   | `font-medium` (500)   |                            |
| Card Title           | `text-lg` (18px)   | `font-semibold` (600) |                            |
| Card Title (compact) | `text-sm` (14px)   | `font-semibold` (600) | Frame variant              |
| Card Description     | `text-sm` (14px)   | Normal (400)          | `muted-foreground`         |
| Input Text           | `text-base` (16px) | Normal (400)          |                            |
| Inline Code          | 0.75rem (12px)     | —                     | Monospace                  |
| Code Block           | 0.875rem (14px)    | —                     | Monospace, 1.5 line-height |
| Heading Scale        | `[TBD]`            | `[TBD]`               |                            |

---

## 5. Spacing & Layout

### Border Radius Scale

Base radius: **0.625rem (10px)**

| Token          | Value       |
| -------------- | ----------- |
| `--radius-sm`  | 6px         |
| `--radius-md`  | 8px         |
| `--radius-lg`  | 10px (base) |
| `--radius-xl`  | 14px        |
| `--radius-2xl` | 18px        |
| `--radius-3xl` | 22px        |
| `--radius-4xl` | 26px        |

**Common component radii:**

- Cards: `rounded-2xl` (18px)
- Inputs: `rounded-lg` (10px)
- Code blocks: `rounded-[0.75rem]` (12px)
- Inline code: `rounded-[0.375rem]` (6px)

### Sidebar

| Property            | Value                |
| ------------------- | -------------------- |
| Desktop width       | `16rem` (256px)      |
| Icon-only width     | `3rem` (48px)        |
| Mobile width        | `calc(100vw - 12px)` |
| Min resizable width | 256px                |

### Responsive Breakpoints

| Name  | Min-width |
| ----- | --------- |
| `sm`  | 640px     |
| `md`  | 768px     |
| `lg`  | 1024px    |
| `xl`  | 1280px    |
| `2xl` | 1536px    |
| `3xl` | 1600px    |
| `4xl` | 2000px    |

Mobile breakpoint: `< 768px` (max-md)

### Common Spacing Patterns

| Context                | Padding/Gap                     |
| ---------------------- | ------------------------------- |
| Card content           | `p-6` (24px)                    |
| Chat area              | `px-3 py-3` → `sm:px-5 sm:py-4` |
| Markdown block spacing | `0.65rem` vertical margin       |
| List item spacing      | `0.25rem` between items         |

---

## 6. Shadows & Depth

| Usage                   | Shadow                                          |
| ----------------------- | ----------------------------------------------- |
| Cards                   | `shadow-xs/5` (extra-small at 5% opacity)       |
| Inputs                  | `shadow-xs/5`                                   |
| Primary buttons         | `shadow-primary/24` (primary color glow at 24%) |
| Card inner edge (light) | `0 1px black/4%` (inset, via `::before`)        |
| Card inner edge (dark)  | `0 -1px white/6%` (inset, via `::before`)       |

### Scrollbar

| Property      | Light              | Dark                     |
| ------------- | ------------------ | ------------------------ |
| Width         | 6px                | 6px                      |
| Thumb         | `rgba(0,0,0,0.15)` | `rgba(255,255,255,0.1)`  |
| Thumb (hover) | `rgba(0,0,0,0.25)` | `rgba(255,255,255,0.18)` |
| Track         | Transparent        | Transparent              |
| Border radius | 3px                | 3px                      |

### Background Texture

A subtle **fractal noise SVG overlay** is applied to `body::after` at **3.5% opacity** (`opacity: 0.035`), giving the UI a very faint grain/paper texture. Tile size: 256×256px.

---

## 7. Focus & Accessibility

| Property             | Value                               |
| -------------------- | ----------------------------------- |
| Focus ring color     | `ring/24` (primary at 24% opacity)  |
| Focus ring width     | `3px` (focus-visible)               |
| Focus ring offset    | `1` (4px), color matches background |
| Outline              | `outline-ring/50` on all elements   |
| Disabled opacity     | `opacity-64`                        |
| Disabled interaction | `pointer-events: none`              |
| Placeholder text     | `muted-foreground/72` (72% opacity) |
| Contrast standard    | WCAG 2.1 AA minimum                 |

---

## 8. Iconography

| Property            | Value                                        |
| ------------------- | -------------------------------------------- |
| **Library**         | [Lucide React](https://lucide.dev/) v0.564.0 |
| **Default size**    | `size-4.5` (18px)                            |
| **Responsive size** | `size-4` (16px) at `sm` breakpoint           |
| **Color**           | `currentColor` (inherits from parent)        |
| **Opacity**         | `opacity-80` (default for icon children)     |
| **Stroke width**    | `[TBD — Lucide default is 2]`                |

### Custom Icons

The app includes bespoke SVG icons for:

- GitHub logo
- Cursor logo
- Visual Studio Code logo (with gradient + filter effects)

---

## 9. Dark / Light Mode

| Property                | Value                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Mechanism**           | `.dark` class on `<html>` element                                                                                    |
| **Storage key**         | `okcode:theme` (localStorage)                                                                                        |
| **Options**             | `"light"` · `"dark"` · `"system"`                                                                                    |
| **Default**             | `"system"` (follows OS preference)                                                                                   |
| **OS detection**        | `prefers-color-scheme: dark` media query                                                                             |
| **Desktop sync**        | Theme synced to Electron main process via `window.desktopBridge.setTheme()`                                          |
| **Transition handling** | `.no-transitions` class suppresses all transitions during theme switch, removed after `requestAnimationFrame` reflow |

---

## 10. Animation & Motion

### Keyframe Animations

| Name                      | Duration       | Easing | Purpose                                        |
| ------------------------- | -------------- | ------ | ---------------------------------------------- |
| `skeleton`                | 2s (infinite)  | Linear | Loading skeleton shimmer                       |
| `ultrathink-rainbow`      | 10s (infinite) | Linear | Rainbow gradient scroll for thinking indicator |
| `ultrathink-chroma-shift` | 10s (infinite) | Linear | Hue rotation + saturation boost                |

### Transition Patterns

| Context      | Duration | Easing  | Properties                   |
| ------------ | -------- | ------- | ---------------------------- |
| Copy button  | 120ms    | ease    | opacity, color, border-color |
| Input focus  | default  | default | box-shadow                   |
| Hover states | default  | default | opacity, color               |

### Layout Animation

[**@formkit/auto-animate**](https://auto-animate.formkit.com/) v0.9.0 is used in the Sidebar component for automatic FLIP (First, Last, Invert, Play) layout transitions when DOM elements are added/removed/reordered.

### Motion Preference

| Property                         | Value                                              |
| -------------------------------- | -------------------------------------------------- |
| `prefers-reduced-motion` support | Respect; disable non-essential animations when set |
| Global animation toggle          | `[TBD]`                                            |

---

## 11. Component Library

Built with:

| Dependency                   | Purpose                                          |
| ---------------------------- | ------------------------------------------------ |
| **Tailwind CSS 4**           | Utility-first CSS framework                      |
| **@base-ui/react**           | Headless UI primitives (dialogs, popovers, etc.) |
| **class-variance-authority** | Type-safe component variant definitions          |
| **tailwind-merge**           | Intelligent class deduplication                  |
| **@formkit/auto-animate**    | Automatic layout animations                      |
| **@pierre/diffs**            | Diff rendering with theme integration            |

### Button Variants

**Styles:**
| Variant | Appearance |
|---|---|
| `default` | Solid primary (indigo) fill, white text, primary shadow glow |
| `secondary` | Subtle fill (4% black/white), neutral text |
| `outline` | Bordered, popover background |
| `ghost` | Transparent, accent fill on hover |
| `destructive` | Solid red fill, white text |
| `destructive-outline` | Transparent, red text |
| `link` | Text-only, underline on hover |

**Sizes:**
| Size | Height | Notes |
|---|---|---|
| `default` | 36px → 32px (sm) | Standard |
| `sm` | 32px → 28px (sm) | Compact |
| `lg` | 40px → 36px (sm) | Prominent |
| `xl` | 44px → 40px (sm) | Hero/CTA |
| `icon` | 36×36 → 32×32 (sm) | Square icon |
| `icon-sm` | 32×32 → 28×28 (sm) | Small square icon |
| `icon-xs` | 28×28 → 24×24 (sm) | Tiny square icon |
| `icon-lg` | 40×40 → 36×36 (sm) | Large square icon |
| `icon-xl` | 44×44 → 40×40 (sm) | XL square icon |

> Sizes shrink by one step at the `sm` breakpoint for tighter density on larger screens.

---

## 12. Platform-Specific

| Property                  | Value                                            |
| ------------------------- | ------------------------------------------------ |
| **Electron product name** | "OK Code"                                        |
| **Frameless titlebar**    | Yes — `.drag-region` CSS for window drag         |
| **Desktop platforms**     | macOS, Windows, Linux (dedicated icons for each) |
| **Web deployment**        | `[TBD]`                                          |
| **App Store presence**    | `[TBD]`                                          |

---

## 13. Open Items [TBD]

The following need to be provided/decided:

- [x] **Tagline** — "A Minimal Web GUI for Coding Agents"
- [x] **One-liner description** — see Brand Identity table above
- [x] **WCAG contrast target** — AA minimum
- [x] **Reduced motion support** — respect `prefers-reduced-motion`
- [x] **Emoji policy** — none in UI copy
- [x] **Error/empty state voice** — concise and helpful
- [ ] **Logo mark description** — what does the mark depict?
- [ ] **Logo usage guidelines** — minimum size, clear space, do's and don'ts
- [ ] **Heading type scale** — H1–H6 sizes and weights
- [ ] **Website URL**
- [ ] **Social media handles / links**
- [ ] **App store descriptions**
- [ ] **Open Graph / social card image**
- [ ] **Brand color as hex** — the primary `oklch(0.488 0.217 264)` converts to approximately **#2b4acb** (a deep blue-violet); confirm this is the intended brand hex
- [ ] **Secondary brand color** — is there a distinct secondary brand color beyond the neutral system?
- [ ] **Icon stroke width** — confirm Lucide default (2) or custom
