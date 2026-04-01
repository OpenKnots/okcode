# Marketing Page Improvement Recommendations

Comprehensive audit and recommendations to bring the OK Code marketing site to production-level quality comparable to OpenAI, Vercel, and Linear marketing pages.

---

## Table of Contents

1. [Critical Issues](#1-critical-issues)
2. [Accessibility](#2-accessibility)
3. [Visual Design & Polish](#3-visual-design--polish)
4. [Animation & Interaction](#4-animation--interaction)
5. [Layout & Spacing](#5-layout--spacing)
6. [Responsive Design](#6-responsive-design)
7. [Performance](#7-performance)
8. [SEO & Meta](#8-seo--meta)
9. [Content & Copy](#9-content--copy)
10. [Architecture & Code Quality](#10-architecture--code-quality)
11. [New Sections & Features](#11-new-sections--features)
12. [Reference Benchmarks](#12-reference-benchmarks)

---

## 1. Critical Issues

These must be fixed before considering the page production-ready.

### 1.1 Missing Focus Indicators (WCAG 2.1 AA Failure)

**Problem:** Zero `:focus-visible` styles exist on any interactive element -- buttons, links, tabs, FAQ triggers, nav links, or form elements. This is a WCAG 2.1 Level AA violation and makes the site unusable for keyboard-only users.

**Affected elements:**

- `.hero-button`, `.secondary-button`
- `.kn-nav-link`, `.kn-nav-signin`
- `.tab-chip`, `.spotlight-item`
- `.faq-trigger`
- `.kn-pill` (hero badge link)
- All footer links
- Logo cloud items (if made focusable)

**Fix:** Add a global focus-visible rule in Layout.astro:

```css
:focus-visible {
  outline: 2px solid var(--kn-landing-accent-bright);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* Subtle ring for buttons/interactive elements */
.hero-button:focus-visible,
.secondary-button:focus-visible,
.tab-chip:focus-visible,
.spotlight-item:focus-visible,
.faq-trigger:focus-visible {
  outline: 2px solid var(--kn-landing-accent-bright);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(255, 78, 65, 0.15);
}
```

### 1.2 Duplicate / Conflicting Style Definitions

**Problem:** Animation and component styles are defined in both `Layout.astro` and `index.astro` with conflicting values. Whichever loads last wins, creating unpredictable behavior.

**Specific conflicts:**
| Style | Layout.astro | index.astro | Delta |
|-------|-------------|-------------|-------|
| `[data-reveal]` transition | `0.8s` | `0.7s` | 0.1s mismatch |
| `.hero-button` styles | Full definition | Full redefinition | Competing specificity |
| `.hero-button-shine` | Defined | Redefined | Duplicate |
| `.section-title` | Defined | Redefined | Duplicate |
| Card shared styles | Defined in Layout | Overridden in index | Cascading conflicts |

**Fix:** Establish a single source of truth:

- Layout.astro owns: CSS variables, base resets, nav, footer, card base, reveal system, utility classes
- index.astro owns: page-specific layout (hero layout, grid arrangements, section spacing)
- Components own: their scoped hover/interaction styles

### 1.3 Hardcoded FAQ Max-Height

**Problem:** The first FAQ panel has `style="max-height: 220px"` hardcoded inline. If content exceeds 220px (e.g., longer answers, larger font size, narrow viewport), it will be clipped with no scroll.

**Fix:** Use `scrollHeight` calculation on mount, or switch to CSS `grid-template-rows: 0fr / 1fr` animation pattern which naturally sizes to content:

```css
.faq-panel {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.35s ease;
}
.faq-item[data-open="true"] .faq-panel {
  grid-template-rows: 1fr;
}
.faq-panel > div {
  overflow: hidden;
}
```

---

## 2. Accessibility

### 2.1 Mobile Menu Focus Trap

**Problem:** When the mobile hamburger menu opens, keyboard focus is not trapped inside the overlay. Users can Tab into content behind the menu.

**Fix:** Implement a focus trap that cycles between the first and last focusable element in the menu. Close on Escape (already implemented) and restore focus to the trigger button on close.

### 2.2 Icon-Only Elements Missing Labels

**Problem:** Several SVG icons serve as the sole content of interactive or informational elements but lack `aria-label`:

- Trust strip icons (decorative only -- acceptable since text follows)
- Logo cloud items -- SVGs have no accessible name
- Mobile hamburger button -- check that `aria-label="Menu"` is present
- Feature grid icons -- decorative, but `kn-ico-wrap` has no role

**Fix for LogoCloud:**

```html
<div class="logo-cloud-item" role="img" aria-label="GitHub">
  <svg aria-hidden="true">...</svg>
  <span>GitHub</span>
</div>
```

### 2.3 Color-Only Differentiation

**Problem:** Feature grid cards use different icon colors (red, cyan, yellow) as the only visual differentiator between cards. This fails WCAG 1.4.1 (Use of Color).

**Fix:** The eyebrow text already differentiates semantically. Add a subtle visual indicator beyond color -- e.g., different icon backgrounds or border accents that also vary in lightness/shape.

### 2.4 Stats Bar Semantic Structure

**Problem:** Stats values/labels use plain `<span>` elements with no semantic meaning. Screen readers won't understand the relationship between "100%" and "Open Source".

**Fix:** Use a description list:

```html
<dl class="stats-bar">
  <div class="stat-item">
    <dt class="stat-label">Open Source</dt>
    <dd class="stat-value">100%</dd>
  </div>
</dl>
```

### 2.5 Reduced Motion Coverage

**Problem:** `prefers-reduced-motion` rules exist in Layout.astro and index.astro but don't cover:

- Background.astro mesh orb animations
- Hero mesh blob floating
- Final CTA orb animations
- Button shimmer effects
- Star twinkling (partially covered)

**Fix:** Add a global catch-all in Layout.astro and specific overrides in components:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 3. Visual Design & Polish

### 3.1 Add a Video or Animated Product Demo

**What OpenAI/Vercel do:** Both feature prominent hero-area product demos -- either a looping video, an interactive demo, or an animated screenshot walkthrough. The current OK Code hero has text + icon only with no product visual.

**Recommendation:** Add an autoplay muted video or animated sequence below the hero tagline showing the actual product:

- A 10-15 second loop showing: opening a thread, seeing a diff, previewing, and reviewing
- Wrapped in the existing `glass-stage` chrome (already styled in index.astro but unused)
- Lazy-loaded below the fold with a poster frame
- Fallback to a static screenshot for `prefers-reduced-motion`

### 3.2 Typography Refinement

**Current gaps vs. premium benchmarks:**

- Tagline size maxes at `6.2rem` -- Vercel uses `5.5rem` but with tighter tracking and bolder weight. Consider testing `font-weight: 700` (currently not set, inherits `400`)
- Section titles at `clamp(2rem, 3vw, 3.15rem)` -- could push to `clamp(2.2rem, 3.5vw, 3.75rem)` for more dramatic hierarchy
- Body text line-height at `1.7` is generous -- OpenAI uses `1.6`. Test reducing slightly for density
- Missing font-weight variation: headings don't declare `font-weight` explicitly, relying on `<strong>` or browser defaults

**Recommendations:**

```css
.tagline {
  font-weight: 700;
}
.section-title {
  font-weight: 650;
  font-size: clamp(2.2rem, 3.5vw, 3.75rem);
}
.section-body {
  line-height: 1.6;
}
```

### 3.3 Card Glass Effect Refinement

**Current:** Cards use `backdrop-filter: blur(18px)` uniformly. Premium sites vary the glass intensity by section importance.

**Recommendation:**

- Hero card/CTA: `blur(24px) saturate(180%)`
- Feature/workflow cards: `blur(12px) saturate(140%)`
- FAQ/minor cards: `blur(8px)`
- Add `box-shadow: inset 0 0 0 1px rgba(255,255,255,0.03)` for an inner light edge

### 3.4 Gradient Border Effects on Key Cards

**What Linear/Vercel do:** Animated gradient borders on featured cards using `@property` for animatable CSS custom properties.

**Recommendation:** Add gradient borders to the hero mark, feature cards, and CTA section:

```css
@property --border-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

.feature-card {
  border: 1px solid transparent;
  background-origin: border-box;
  background-clip: padding-box, border-box;
  background-image:
    linear-gradient(var(--kn-landing-card-bg), var(--kn-landing-card-bg)),
    conic-gradient(
      from var(--border-angle),
      transparent 60%,
      var(--kn-landing-accent) 80%,
      transparent 100%
    );
  animation: rotate-border 6s linear infinite;
}

@keyframes rotate-border {
  to {
    --border-angle: 360deg;
  }
}
```

### 3.5 Noise Texture Refinement

**Current:** Single noise overlay at `0.03` opacity. Barely visible.

**Recommendation:** Add a second finer-grain noise layer with `mix-blend-mode: overlay` for more natural integration:

```css
body::after {
  /* existing noise */
  mix-blend-mode: soft-light;
  opacity: 0.04;
}
body::before {
  /* second layer: finer grain */
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0.02;
  background-image: url("data:image/svg+xml,..."); /* higher baseFrequency */
  mix-blend-mode: overlay;
  z-index: 1;
}
```

### 3.6 Button Polish

**Current gaps:**

- Primary button uses accent red gradient but lacks "depth" compared to Vercel's buttons
- No active/pressed state (`:active`)
- Shimmer runs continuously -- should only trigger on hover or on a slow interval

**Recommendations:**

```css
.hero-button:active {
  transform: translateY(0) scale(0.98);
  box-shadow: 0 6px 24px rgba(202, 58, 41, 0.15);
}

/* Shimmer only on hover, not continuous */
.hero-button-shimmer {
  animation: none;
}
.hero-button:hover .hero-button-shimmer {
  animation: shimmer 0.6s ease forwards;
}
```

---

## 4. Animation & Interaction

### 4.1 Scroll-Linked Progress Indicator

**What Vercel does:** A thin progress bar at the very top of the viewport that fills as users scroll.

**Implementation:**

```css
.scroll-progress {
  position: fixed;
  top: 0;
  left: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--kn-landing-accent), var(--kn-landing-accent-bright));
  z-index: 100;
  transform-origin: left;
  transition: none;
}
```

```js
window.addEventListener(
  "scroll",
  () => {
    const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight);
    bar.style.transform = `scaleX(${pct})`;
  },
  { passive: true },
);
```

### 4.2 Section Entrance Animations Should Be More Varied

**Current:** Every section uses the same `translateY(16px) + opacity` fade-in-up. This becomes monotonous.

**Recommendation:** Vary the entrance animation by section type:

- Hero: `scale(0.96)` + fade (expand in)
- Trust strip: Stagger left-to-right with `translateX(-20px)` per item
- Feature grid: Each card fades from its own direction (left, bottom, right)
- Workflow: Sequential slide-in from left
- Spotlight: Split entrance -- copy slides from left, panels from right
- Theme: Tabs fade in then preview scales up
- FAQ: Gentle fade only (no transform) since it's a reading section
- CTA: `scale(0.98)` + fade (subtle zoom)

### 4.3 Parallax-Light Effect on Hero

**What OpenAI does:** Subtle parallax on background elements as the user scrolls the hero section.

**Recommendation:** Apply `transform: translateY(calc(var(--scroll) * -0.3))` to the hero mesh blobs, driven by scroll position. Use `requestAnimationFrame` for performance:

```js
let ticking = false;
window.addEventListener(
  "scroll",
  () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        document.documentElement.style.setProperty("--scroll", window.scrollY);
        ticking = false;
      });
      ticking = true;
    }
  },
  { passive: true },
);
```

### 4.4 Cursor-Follow Glow Effect

**What Linear does:** A subtle glow that follows the mouse cursor on card hover.

**Recommendation:** Add to feature cards and workflow cards:

```js
card.addEventListener("mousemove", (e) => {
  const rect = card.getBoundingClientRect();
  card.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
  card.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
});
```

```css
.feature-card::after {
  content: "";
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.3s;
  background: radial-gradient(
    400px circle at var(--mouse-x) var(--mouse-y),
    rgba(255, 255, 255, 0.04),
    transparent 40%
  );
}
.feature-card:hover::after {
  opacity: 1;
}
```

### 4.5 Tab Transition Enhancement

**Current:** Tab panels use a simple `opacity + translateY(6px)` crossfade. Feels basic.

**Recommendation:** Add a subtle scale and blur transition:

```css
[data-tab-panel] {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
  filter: blur(2px);
  transition:
    opacity 0.4s ease,
    transform 0.4s ease,
    filter 0.4s ease;
}
[data-tab-panel][data-active="true"] {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}
```

### 4.6 Nav Link Hover Underline

**What Vercel/Linear do:** Nav links get a subtle animated underline on hover.

```css
.kn-nav-link::after {
  content: "";
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 0;
  height: 1px;
  background: var(--kn-landing-accent);
  transition: width 0.3s ease;
}
.kn-nav-link:hover::after {
  width: 100%;
}
```

---

## 5. Layout & Spacing

### 5.1 Increase Section Vertical Spacing

**Current:** Most sections use `4rem` margin-bottom (some now upgraded to `var(--kn-landing-section-gap)`).

**Recommendation:** Ensure ALL sections use the CSS variable, and increase the clamp:

```css
--kn-landing-section-gap: clamp(6rem, 10vw, 10rem);
```

Premium sites like Vercel use 120-160px between major sections. Current 4rem = 64px is too tight.

### 5.2 Content Width Constraints

**Current:** `--marketing-content-max: 1680px` -- this is very wide. On ultra-wide monitors, text lines become too long for comfortable reading.

**Recommendation:**

- Max content width: `1280px` (matches Vercel)
- Text content max: `680px` for paragraphs (optimal reading width)
- Full-bleed sections: background extends to edges, content stays constrained

```css
--marketing-content-max: 1280px;
--marketing-text-max: 680px;

.section-body,
.subtagline,
.final-cta p {
  max-width: var(--marketing-text-max);
}
```

### 5.3 Card Padding Increase

**Current:** Cards use `1.35rem` padding. This feels cramped compared to premium sites.

**Recommendation:** Increase to `1.75rem` on desktop, `1.35rem` on mobile:

```css
.feature-card,
.workflow-card,
.spotlight-panel {
  padding: clamp(1.35rem, 2vw, 1.75rem);
}
```

### 5.4 Hero Vertical Rhythm

**Current:** Hero padding-top is `clamp(3rem, 8vw, 6rem)` and margin-bottom is `clamp(4rem, 8vw, 7rem)`.

**Recommendation:** Push further for dramatic impact:

```css
.hero {
  padding-top: clamp(4rem, 12vw, 8rem);
  margin-bottom: clamp(5rem, 10vw, 9rem);
}
```

---

## 6. Responsive Design

### 6.1 Standardize Breakpoints

**Current inconsistency:**

- Layout.astro: `720px`, `480px`
- index.astro: `1100px`, `720px`
- download.astro: `640px`

**Recommendation:** Adopt a consistent breakpoint system:

```css
/* Breakpoints (add as CSS custom media when Astro supports it) */
/* sm: 480px   -- small mobile */
/* md: 768px   -- tablet portrait */
/* lg: 1024px  -- tablet landscape / small desktop */
/* xl: 1280px  -- desktop */
/* 2xl: 1536px -- large desktop */
```

### 6.2 Tablet-Specific Layouts

**Problem:** The site jumps from desktop (3-4 columns) directly to mobile (1 column) at 1100px with no intermediate state. Tablets get a broken layout.

**Recommendation:**

```css
/* Tablet: 2-column layouts */
@media (max-width: 1024px) and (min-width: 769px) {
  .feature-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .workflow-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .spotlight,
  .theme-section {
    grid-template-columns: 1fr;
  }
}
```

### 6.3 Mobile Typography Scale

**Problem:** Large headings on mobile could be tighter. The `clamp()` functions work but haven't been tuned for the smallest screens.

**Recommendation:**

```css
@media (max-width: 480px) {
  .tagline {
    font-size: 2.6rem;
    letter-spacing: -0.05em;
  }
  .section-title {
    font-size: 1.75rem;
  }
  .final-cta h2 {
    font-size: 1.85rem;
  }
}
```

### 6.4 Touch Target Sizes

**Problem:** Some interactive elements may be smaller than the 44x44px minimum recommended touch target.

**Recommendation:** Audit and ensure:

- Nav links: `min-height: 44px; padding: 0.75rem 1rem;`
- Tab chips: `min-height: 44px;`
- FAQ triggers: Already 44px+ (good)
- Footer links: Add padding for touch

---

## 7. Performance

### 7.1 Background SVG Optimization

**Problem:** Background.astro renders 220 SVG circles + 13 path elements in a fixed-position container that scrolls with the page. This causes paint thrashing on every scroll event.

**Recommendations:**

- Add `will-change: transform` to `.kn-stars` and `.kn-threads`
- Use `contain: strict` on the background container
- Consider converting star field to a static PNG/WebP with CSS animation for the twinkle subset
- Reduce star count to 150 (many are invisible at `opacity: 0.12`)

### 7.2 Image Optimization

**Problem:** `icon.png` is loaded unoptimized in multiple sizes (88x88 hero, 28x28 nav, 14x14 footer) without srcset, lazy loading, or format optimization.

**Recommendation:**

- Install `@astrojs/image` or use Astro's built-in `<Image>` component
- Generate WebP/AVIF variants
- Add `loading="lazy"` to all images below the fold
- Use `fetchpriority="high"` on the hero icon
- Create properly sized variants (no serving 88px image at 14px)

### 7.3 Font Loading Strategy

**Problem:** DM Sans Variable is imported but no font-display strategy is set. This may cause FOIT (Flash of Invisible Text).

**Recommendation:**

```css
@font-face {
  font-family: "DM Sans Variable";
  font-display: swap;
  /* ... */
}
```

Or preload the font in the `<head>`:

```html
<link rel="preload" href="/fonts/dm-sans-variable.woff2" as="font" type="font/woff2" crossorigin />
```

### 7.4 CSS Containment

**Current:** `content-visibility: auto` applied to some below-fold sections but not consistently.

**Recommendation:** Apply to all below-fold sections and add proper `contain-intrinsic-size`:

```css
.trust-strip,
.feature-grid,
.workflow-section,
.spotlight,
.theme-section,
.faq-section,
.final-cta,
.logo-cloud,
.stats-bar {
  content-visibility: auto;
  contain-intrinsic-block-size: auto 500px;
}
```

### 7.5 Reduce Animation Overhead

**Problem:** Multiple `blur(60-100px)` filters on animated elements (mesh orbs, hero blobs, CTA orbs) are GPU-intensive and may cause frame drops on low-end devices.

**Recommendation:**

- Use `@media (prefers-reduced-motion: no-preference)` to only show blobs when motion is OK
- Reduce blur radius: 100px -> 60px on background mesh, 80px -> 50px on hero blobs
- Add `will-change: transform` to animated blob elements
- Consider using CSS `background-image` radial gradients instead of blurred elements

---

## 8. SEO & Meta

### 8.1 Structured Data (JSON-LD)

**Problem:** No structured data markup. Search engines can't understand the product type or organization.

**Recommendation:** Add to Layout.astro `<head>`:

```html
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "OK Code",
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "macOS, Windows, Linux",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "description": "A premium workspace for AI coding flows.",
    "url": "https://okcode.dev",
    "author": {
      "@type": "Organization",
      "name": "OpenKnots"
    }
  }
</script>
```

### 8.2 Open Graph Enhancements

**Current:** OG image defaults to `/icon.png` (a small app icon). Not ideal for social sharing.

**Recommendation:**

- Create a dedicated 1200x630px OG image showing the product UI
- Add `og:site_name`, `og:locale`
- Add Twitter-specific card size (`twitter:card: summary_large_image` -- already present, good)

### 8.3 Sitemap

**Problem:** No sitemap generated.

**Recommendation:** Install `@astrojs/sitemap`:

```js
// astro.config.mjs
import sitemap from "@astrojs/sitemap";
export default defineConfig({
  integrations: [sitemap()],
  site: process.env.PUBLIC_SITE_URL,
});
```

### 8.4 Canonical URLs

**Current:** Canonical URL only set when `Astro.site` is available (requires `PUBLIC_SITE_URL` env var). In development, no canonical is set.

**Recommendation:** Always set a canonical, even in dev:

```js
const canonical = Astro.site
  ? new URL(Astro.url.pathname, Astro.site).href
  : `https://okcode.dev${Astro.url.pathname}`;
```

### 8.5 Heading Hierarchy

**Problem:** Multiple pages may have inconsistent heading levels since components define their own `<h2>`, `<h3>` tags independently.

**Recommendation:** Audit heading hierarchy per page:

- `<h1>`: Only the hero tagline (one per page)
- `<h2>`: Section titles (Features, Workflow, Surfaces, Themes, FAQ, CTA)
- `<h3>`: Within sections (feature card titles, workflow step titles, FAQ questions)

---

## 9. Content & Copy

### 9.1 Hero Tagline A/B Testing Opportunities

**Current:** "The beautiful workspace for shipping with AI."

**Alternative test candidates:**

- "Ship with AI. Stay in flow." (shorter, more action-oriented)
- "One workspace for the entire AI coding loop." (benefit-focused)
- "Chat. Diff. Preview. Ship." (feature-list cadence, like Vercel's style)

### 9.2 Social Proof

**Current:** LogoCloud shows "Works with the tools you already use" with generic tool icons. This is weak social proof compared to what premium sites show.

**Stronger alternatives:**

- GitHub star count (dynamic, auto-updating)
- "Used by X developers" (if metrics available)
- Testimonial quotes from real users
- "Featured in" press/blog logos
- Community size (Discord member count)

### 9.3 Comparison Section

**What competitors show:** A "Why OK Code vs. X" comparison table is a high-conversion element.

**Recommendation:** Add a comparison section after the workflow section:

```
| Feature              | OK Code | Terminal AI | IDE Plugins |
|---------------------|---------|-------------|-------------|
| Persistent threads  | Yes     | No          | Partial     |
| Built-in diffs      | Yes     | No          | No          |
| Local preview       | Yes     | No          | Partial     |
| PR review surface   | Yes     | No          | No          |
| Open source         | Yes     | Varies      | No          |
```

### 9.4 CTA Copy Refinement

**Current CTAs:** "Download OK Code" / "View on GitHub" / "Explore on GitHub"

**Recommendations:**

- Primary: "Get OK Code Free" (emphasizes free, reduces friction)
- Secondary: "Star on GitHub" (more specific action)
- Bottom CTA: "Start shipping calmer" (emotional, benefit-oriented)

### 9.5 FAQ Expansion

**Current:** 4 FAQ items. Premium sites typically show 6-10.

**Suggested additions:**

- "How does it compare to Cursor / Windsurf / Copilot?"
- "What AI models does it support?"
- "Can I self-host it?"
- "Is my code sent to a server?"
- "How does the desktop app work offline?"
- "What's on the roadmap?"

---

## 10. Architecture & Code Quality

### 10.1 Style Architecture Consolidation

**Problem:** Styles are split across Layout.astro (global), index.astro (global via `:global()`), and component scoped `<style>` blocks. This creates three competing layers.

**Recommendation:** Adopt a clear layering:

1. **Layout.astro** -- Design tokens (CSS variables), resets, base typography, nav, footer
2. **Components** -- Scoped styles for component-specific layout and interactions
3. **Page files** -- Only page-level composition styles (grid arrangements between sections)

Specifically, move all hero/card/button visual styles from index.astro into either Layout.astro (if shared) or the relevant component.

### 10.2 CSS Custom Property Naming

**Current:** Variables are prefixed `--kn-landing-*` (legacy from "Knots"?). Some newer additions use fallback values like `var(--kn-landing-accent, #ca3a29)`.

**Recommendation:** Standardize naming and ensure all variables are defined centrally:

```
--ok-bg
--ok-text
--ok-text-secondary
--ok-text-muted
--ok-accent
--ok-accent-bright
--ok-border
--ok-card-bg
--ok-section-gap
```

### 10.3 Remove Unused Styles

**Potentially unused styles found in index.astro:**

- `.hero-visual`, `.hero-glow--violet`, `.hero-glow--cyan` -- these appear to be from an earlier hero design with floating orbs, now replaced by the gradient mesh approach
- `.orb--one`, `.orb--two` -- same, unused
- `.glass-stage`, `.glass-toolbar`, `.glass-body`, `.glass-badge`, `.glass-label` -- comprehensive glass mockup styles that aren't referenced in any current component
- `.rail`, `.rail--sidebar`, `.rail--meta`, `.center-stack` -- same
- `.message`, `.message--large`, `.message--short` -- same
- `.code-line`, `.code-line--add`, `.code-line--remove` -- same
- `.preview-window`, `.preview-nav`, `.preview-card` -- same
- `.chrome-label`, `.panel-status`, `.floating-card-kicker` -- same

**Recommendation:** Audit and remove ~150+ lines of dead CSS from index.astro. This will reduce file size and eliminate confusion.

### 10.4 Component Prop Validation

**Problem:** Some components accept inline data arrays (TrustStrip) while others accept props (FeatureGrid, WorkflowSection, FaqSection). Inconsistent pattern.

**Recommendation:** Standardize on props for all data-driven components, with the data defined in the page file. This allows reuse across pages.

### 10.5 TypeScript Strictness

**Problem:** The `tsconfig.json` strictness level and TypeScript coverage haven't been audited. Component interfaces exist but may not be comprehensive.

**Recommendation:** Enable `strict: true` in tsconfig and add proper typing to all component props and script variables.

---

## 11. New Sections & Features

### 11.1 Product Screenshot / Demo Section

**Priority: HIGH**

The single biggest gap vs. OpenAI/Vercel is the absence of any product visual. Users need to see the product before downloading.

**Options (in order of impact):**

1. **Embedded video** -- 15-second autoplay muted loop showing the product in use
2. **Animated screenshot carousel** -- 3-4 screenshots with auto-rotation
3. **Interactive demo** -- Embedded iframe or WebGL recreation of the product
4. **Static hero screenshot** -- Single high-quality product screenshot in the hero area

### 11.2 Changelog / What's New Section

**What Vercel/Linear show:** A "What's new" or "Changelog" teaser showing recent updates. Builds trust that the product is actively maintained.

**Recommendation:** Add a compact changelog strip below the theme showcase:

```html
<section class="changelog-teaser">
  <h2>What's new</h2>
  <div class="changelog-items">
    <article>
      <time>Mar 2026</time>
      <h3>v1.2 -- Theme engine</h3>
      <p>Three premium themes with full customization.</p>
    </article>
    <!-- 2-3 more items -->
  </div>
  <a href="/changelog">View full changelog</a>
</section>
```

### 11.3 Testimonials / Quotes Section

**What premium sites show:** 2-3 rotating testimonial quotes with attribution (name, company, avatar).

**Recommendation:** Add between the workflow section and core surfaces:

```html
<section class="testimonials">
  <blockquote>
    <p>"OK Code is the first AI coding tool that doesn't feel disposable."</p>
    <cite>-- Developer Name, Company</cite>
  </blockquote>
</section>
```

### 11.4 "Built With" / Tech Stack Section

**Recommendation:** A compact section showing the tech stack (Tauri, React, TanStack Router) to build developer credibility.

### 11.5 Email Capture / Newsletter

**What Vercel does:** A subtle email capture at the bottom for product updates.

**Recommendation:** Add above the footer:

```html
<section class="newsletter">
  <h2>Stay in the loop</h2>
  <p>Get notified about new releases and features.</p>
  <form>
    <input type="email" placeholder="you@example.com" />
    <button type="submit">Subscribe</button>
  </form>
</section>
```

### 11.6 Dark/Light Mode Toggle

**Current:** Exclusively dark theme. Most premium sites offer both.

**Recommendation:** While the dark aesthetic is core to the brand, consider:

- A subtle toggle in the nav for users who prefer light mode
- At minimum, respect `prefers-color-scheme` for accessibility
- Start with just the marketing page; the app itself can stay dark-only

---

## 12. Reference Benchmarks

### Sites to Study

| Site                                 | Strength to Emulate                                                   |
| ------------------------------------ | --------------------------------------------------------------------- |
| [vercel.com](https://vercel.com)     | Section spacing, typography scale, product demo, gradient borders     |
| [openai.com](https://openai.com)     | Hero impact, social proof, stats bar, video demo                      |
| [linear.app](https://linear.app)     | Card interactions (cursor glow), animation variety, dark theme polish |
| [raycast.com](https://raycast.com)   | Product screenshots, feature deep-dives, keyboard shortcut showcase   |
| [warp.dev](https://warp.dev)         | Terminal product marketing, developer-focused copy, comparison tables |
| [cursor.com](https://cursor.com)     | AI coding tool positioning, hero messaging, social proof              |
| [arc.net](https://arc.net)           | Emotional copy, typography choices, minimalist design                 |
| [supabase.com](https://supabase.com) | Dark theme execution, code examples, community section                |

### Quality Checklist

Before considering the marketing page production-ready, verify:

- [ ] Lighthouse Performance score > 90
- [ ] Lighthouse Accessibility score = 100
- [ ] Lighthouse SEO score = 100
- [ ] All interactive elements have visible focus states
- [ ] `prefers-reduced-motion` fully respected
- [ ] Mobile navigation focus trap implemented
- [ ] No duplicate style definitions between files
- [ ] All dead CSS removed
- [ ] Product demo/screenshot visible above the fold
- [ ] OG image is 1200x630 and shows product
- [ ] Structured data (JSON-LD) present
- [ ] Sitemap generated
- [ ] Font loading optimized (no FOIT)
- [ ] All images have width/height attributes (CLS prevention)
- [ ] Touch targets are minimum 44x44px
- [ ] Color contrast ratios meet WCAG AA
- [ ] Page loads in < 2s on 3G (simulated)
- [ ] No layout shift after initial paint (CLS < 0.1)

---

_Generated from a full audit of the OK Code marketing codebase on 2026-03-31._
