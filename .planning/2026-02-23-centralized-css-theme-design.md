# Design: Centralized CSS Theme System for Slide Pipeline

> **Date**: 2026-02-23
> **Scope**: `presentations/doc_sem/doc_sem_ws_2026/outputs/slides/`
> **Branch**: `feature/centralized-css` (via git worktree)

## Problem

Every HTML slide in the presentation pipeline duplicates 80-100 lines of identical CSS for shared components (logo-bar, progress-bar, section-label, h1, footer, statement-bar). This makes it impossible to tune typography, colors, or spacing globally. Additionally:

- Text is too small on many slides (some card text at 7-7.5pt)
- Code-style variable names (price_c, distance_km) appear instead of proper math notation
- No consistent bullet point conventions (capitalization, punctuation)
- Color values are hardcoded per-slide with no central palette

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CSS strategy | External file + `<link>` tag | Simplest; Playwright resolves file:// links natively |
| Variable system | CSS custom properties (`:root`) | Single-place tunability for colors/sizes |
| Math notation | Extend html2pptx for `<sub>`/`<sup>` | PptxGenJS supports subscript; just need converter wiring |
| Bullet style | Sentence case, no trailing period | Standard academic presentation convention |
| Min text size | 8pt (content); 5.5-7pt allowed for decorative context | Conservative bump that avoids major layout rework |
| Isolation | Git worktree on feature branch | Parallel slide development continues on master |

## Architecture

### 1. `theme.css` — Central Stylesheet

**Location**: `outputs/slides/theme.css`

**Contents** (in order):

```css
/* ═══════════════════════════════════════════
   theme.css — DocSem WS 2026 Shared Styles
   ═══════════════════════════════════════════ */

/* ── TEXT CONVENTIONS ──────────────────────────
   Bullet points:
   - Sentence case (capitalize first word only)
   - No trailing period
   - No trailing comma on last item

   Math variables:
   - Use <span class="math-var"> wrapper
   - Subscripts via <sub> tags
   - E.g. price<sub>c</sub>, not price_c

   Key terms:
   - Use <span class="key-term"> for emphasized domain terms
   - Use <span class="accent"> for teal-highlighted terms
   ────────────────────────────────────────────── */

:root {
  /* ── Color Palette ── */
  --c-deep-blue:    #002733;   /* Title text, body text, MATSim */
  --c-teal:         #008C82;   /* Highlights, active states */
  --c-light-teal:   #33A89E;   /* ExMAS components */
  --c-cyan:         #19C9FF;   /* Optimization components */
  --c-blue:         #0EA5D3;   /* Trial Runner border */
  --c-deep-cyan:    #0099BB;   /* Demand card, SimWrapper */
  --c-gray:         #809399;   /* Section labels, done state */
  --c-light-gray:   #CCD3D6;   /* Upcoming state, borders */
  --c-coral:        #E67364;   /* Accent, warnings */
  --c-dark-coral:   #C4584A;   /* MIP Solver header */
  --c-bg-gray:      #F8FAFB;   /* Diagram backgrounds */
  --c-footer-text:  #5C6B72;   /* Footer, secondary text */
  --c-border:       #E8ECEE;   /* Light divider lines */
  --c-accent-bg:    #F0FAF9;   /* Teal tinted backgrounds */
  --c-trial-bg:     #F0F9FD;   /* Blue tinted backgrounds */
  --c-white:        #ffffff;

  /* ── Typography Scale ── */
  --font-section:   14pt;      /* section labels */
  --font-h1:        27pt;      /* slide titles */
  --font-body:      11pt;      /* standard body text */
  --font-card-hdr:  10pt;      /* card/panel headers */
  --font-small:     9pt;       /* secondary text, small cards */
  --font-min:       8pt;       /* smallest content text */
  --font-footer:    8pt;       /* footer text */
  --font-refs:      6.5pt;     /* inline references */
  --font-pb:        7pt;       /* progress bar labels */
  /* Decorative context (pipeline row, dispatch chips): 5.5-7pt allowed */

  /* ── Spacing ── */
  --margin-side:    34pt;
  --margin-dense:   20pt;
  --content-top:    78pt;
  --content-top-dense: 68pt;
  --bottom-no-bar:  20pt;
  --bottom-with-bar: 72pt;
}

/* ── Base ── */
html { background: var(--c-white); }
body {
  width: 720pt; height: 405pt; margin: 0; padding: 0;
  background: var(--c-white); font-family: Arial, sans-serif;
  display: flex; flex-direction: column;
  position: relative;
}

/* ── Logo Bar ── */
.logo-bar {
  position: absolute; top: 13pt; right: 16pt;
  display: flex; align-items: center; gap: 8pt;
}
.logo-tum { height: 28pt; width: auto; }
.logo-vw  { height: 30pt; width: auto; }

/* ── Progress Bar ── */
.progress-bar {
  position: absolute; top: 52pt; right: 16pt;
  display: flex; align-items: center; gap: 3pt;
}
.pb-section { display: flex; align-items: center; gap: 2pt; }
.pb-icon    { height: 10pt; width: auto; }
.pb-label   { font-size: var(--font-pb); margin: 0; padding: 0; }
.pb-label.done     { color: var(--c-gray); }
.pb-label.active   { color: var(--c-teal); font-weight: 700; }
.pb-label.upcoming { color: var(--c-light-gray); }
.pb-chev { font-size: var(--font-pb); margin: 0; padding: 0; }
.pb-chev.done     { color: var(--c-gray); }
.pb-chev.upcoming { color: var(--c-light-gray); }

/* ── Section Label & Title ── */
.section-label {
  color: var(--c-gray); font-size: var(--font-section); font-weight: 300;
  margin: 14pt 0 0 var(--margin-side);
}
h1 {
  color: var(--c-deep-blue); font-size: var(--font-h1); font-weight: 300;
  margin: 2pt 0 0 var(--margin-side); line-height: 1.1;
}

/* ── Footer ── */
.footer {
  display: flex; justify-content: space-between;
  position: absolute; bottom: 0pt; left: 0; right: 0;
  margin: 0 var(--margin-side);
  padding-bottom: 2pt; padding-top: 2pt;
  border-top: 1pt solid var(--c-border);
}
.footer-text { color: var(--c-footer-text); font-size: var(--font-footer); font-weight: 400; margin: 0; }
.footer-refs {
  color: var(--c-gray); font-size: var(--font-refs); font-weight: 400;
  text-align: right; flex: 1; margin: 0 10pt; line-height: 1.3;
}
.page-num { color: var(--c-footer-text); font-size: var(--font-footer); font-weight: 400; margin: 0; }

/* ── Statement Bar ── */
.statement-bar {
  position: absolute; bottom: 28pt; left: var(--margin-side); right: var(--margin-side);
  background: var(--c-accent-bg);
  border-left: 3pt solid var(--c-teal);
  padding: 5pt 14pt;
}
.statement-bar p {
  color: var(--c-teal); font-size: 9pt; font-weight: 700;
  margin: 0; line-height: 1.3;
}

/* ── Shared text utilities ── */
.accent     { color: var(--c-teal); font-weight: 700; }
.key-term   { font-weight: 700; color: var(--c-teal); }
.math-var   { font-style: italic; }
.math-var sub { font-size: 0.75em; }
.mono-key   { font-family: monospace; font-weight: 700; color: #005E56; font-size: inherit; }

/* ── Panel components (methodology slides 06-15) ── */
.panel-header { padding: 5pt 12pt; flex-shrink: 0; }
.panel-header p {
  font-size: 8.5pt; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.5pt; color: var(--c-white); margin: 0;
}
.hdr-matsim  { background: var(--c-deep-blue); }
.hdr-python  { background: var(--c-teal); }
.hdr-simwrap { background: var(--c-deep-cyan); }

.panel-narrow .panel-header {
  flex: 1;
  display: flex; align-items: center; justify-content: center;
  padding: 5pt 0;
}
.panel-narrow .panel-header p {
  writing-mode: vertical-rl; text-orientation: mixed;
  transform: rotate(180deg); white-space: nowrap;
  font-size: var(--font-pb); font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.5pt; color: var(--c-white); margin: 0;
}

/* ── Export wall (methodology slides) ── */
.export-wall {
  flex-shrink: 0; width: 30pt;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 20pt 0; gap: 4pt;
}
.wall-line  { width: 0; flex: 1; border-left: 3pt dashed var(--c-coral); }
.wall-label {
  color: var(--c-coral); font-size: 8.5pt; font-weight: 700;
  writing-mode: vertical-rl; text-orientation: mixed;
  transform: rotate(180deg); white-space: nowrap; letter-spacing: 0.5pt;
}
```

### 2. Per-Slide HTML Structure (After Migration)

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="theme.css">
<style>
  /* ── Slide-specific layout only ── */
  .challenge { position: absolute; top: 78pt; left: 34pt; right: 34pt; }
  .challenge-title { font-size: var(--font-body); font-weight: 700; ... }
  /* ... diagram-specific CSS ... */
</style>
</head>
<body>
  <!-- shared structure unchanged -->
</body>
</html>
```

### 3. html2pptx Extension for `<sub>`/`<sup>`

**File**: `outputs/slides/html2pptx.cjs`

**Change**: In the `parseInlineFormatting` function (~line 419), add `SUB` and `SUP` to the recognized tags:

```javascript
// Inside parseInlineFormatting, after the SPAN/B/STRONG/I/EM/U handling:
if (node.tagName === 'SUB') options.subscript = true;
if (node.tagName === 'SUP') options.superscript = true;
```

And add `SUB`/`SUP` to the tag check condition on line 439:
```javascript
if (node.tagName === 'SPAN' || node.tagName === 'B' || ... ||
    node.tagName === 'SUB' || node.tagName === 'SUP') {
```

### 4. Code Variable → Math Notation Conversions

Specific conversions needed across pricing slides 13-15:

| Current (code-style) | Target (math notation) |
|----------------------|----------------------|
| `price_c` | `<span class="math-var">price<sub>c</sub></span>` |
| `price_A` | `<span class="math-var">price<sub>A</sub></span>` |
| `distance_km` | `<span class="math-var">distance<sub>km</sub></span>` |
| `ride_selected_r` | `<span class="math-var">ride<sub>selected,r</sub></span>` |
| `∑_c` | `∑<sub>c</sub>` |
| `∑_r` | `∑<sub>r</sub>` |

### 5. Text Convention Enforcement

After migration, audit all `<li>` elements across slides for:
- Trailing periods → remove
- Title Case → convert to sentence case
- Code-style underscores in visible text → convert to subscripts
- Inconsistent capitalization patterns

### 6. Git Worktree Strategy

```bash
# Create isolated worktree for this refactoring
git worktree add ../Dissertation-theme-refactor -b feature/centralized-css

# Work happens in the worktree
cd ../Dissertation-theme-refactor

# When complete, merge back
git checkout master
git merge feature/centralized-css
git worktree remove ../Dissertation-theme-refactor
```

## Migration Order

1. Create `theme.css` with all shared styles using CSS custom properties
2. Extend `html2pptx.cjs` with `<sub>`/`<sup>` support
3. Migrate slides one-by-one (extract shared CSS, add `<link>`, keep slide-specific CSS)
4. Convert code variables to math notation on pricing slides
5. Audit and fix bullet point conventions across all slides
6. Rebuild PPTX and validate with thumbnails
7. Merge branch back to master

## Risks

| Risk | Mitigation |
|------|-----------|
| Slide layout breaks after CSS extraction | Visual diff: screenshot before/after each slide migration |
| Text overflow from 8pt minimum bump | Fix overflows as encountered; some card layouts may need adjustment |
| Viewer.html breaks | `<iframe>` resolves `<link>` relative to iframe document — should work. Test early. |
| Morph chain breaks (slides 06-10) | Preserve all `id=` attributes exactly. Run morph test in PowerPoint after build. |
