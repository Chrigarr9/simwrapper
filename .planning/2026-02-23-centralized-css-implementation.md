# Centralized CSS Theme System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract duplicated CSS from 21 HTML slides into a shared `theme.css` file with CSS custom properties, extend html2pptx to support `<sub>`/`<sup>`, convert code-style variables to math notation, and enforce text conventions.

**Architecture:** A single `theme.css` file at `outputs/slides/theme.css` defines all colors, typography, spacing, and shared components (logo-bar, progress-bar, footer, etc.) via CSS custom properties. Each slide HTML replaces its duplicated `<style>` boilerplate with `<link rel="stylesheet" href="theme.css">` and keeps only slide-specific CSS. The html2pptx converter (Playwright-based) resolves `<link>` tags natively via `file://` protocol.

**Tech Stack:** HTML/CSS (CSS custom properties), Node.js (html2pptx.cjs, build.cjs, PptxGenJS), Playwright (rendering engine for html2pptx)

**Design doc:** `docs/plans/2026-02-23-centralized-css-theme-design.md`

**Working directory:** `presentations/doc_sem/doc_sem_ws_2026/`

---

## Slide Inventory

21 HTML slide files to migrate in `outputs/slides/`:

| Group | Slides | Notes |
|-------|--------|-------|
| Title & Agenda | 00-title, 01-agenda | Dark background on 00; 01 has unique layout |
| Situation | 02-commuter-traffic, 03-problem-statement | Standard content slides |
| Previous | 04-previous-methodology, 05-limitations | Standard content slides |
| Methodology overview | 06-integrated-methodology-overview | Morph chain start (has `id=` attrs) |
| DRT extraction | 07-drt-demand, 07b/c/d-budget-bar | 07 has morph IDs; 07b-d are animation steps |
| Optimization pipeline | 08-optimization-pipeline | Complex flowchart |
| Service area chain | 09-anchor, 10-gate, 11-force, 12-pax | Detail card pattern, morph sensitive |
| Pricing chain | 13-overview, 14-ride-selection, 15-co-optimization | Math notation needed, morph chain |
| Conclusion | 16-methodology-synthesis, 18-framework-status | Standard content |

---

### Task 1: Set Up Git Worktree

**Files:**
- None (git operations only)

**Step 1: Create the worktree and branch**

```bash
cd /mnt/Shared/Code/projects/Dissertation
git worktree add ../Dissertation-theme-refactor -b feature/centralized-css
```

Expected: New worktree at `../Dissertation-theme-refactor` on branch `feature/centralized-css`

**Step 2: Verify the worktree**

```bash
cd /mnt/Shared/Code/projects/Dissertation-theme-refactor
git branch --show-current
ls presentations/doc_sem/doc_sem_ws_2026/outputs/slides/slide-03-problem-statement.html
```

Expected: Branch is `feature/centralized-css`, slide file exists.

> **IMPORTANT:** All subsequent tasks run inside the worktree at `/mnt/Shared/Code/projects/Dissertation-theme-refactor`. Always `cd` there first.

---

### Task 2: Create `theme.css`

**Files:**
- Create: `presentations/doc_sem/doc_sem_ws_2026/outputs/slides/theme.css`

**Step 1: Create the theme file**

Write the full `theme.css` file as specified in the design doc (Section 1: "theme.css — Central Stylesheet"). The complete CSS is in the design doc at `docs/plans/2026-02-23-centralized-css-theme-design.md`, lines 35-207.

Copy the CSS verbatim from the design doc's code block. The file includes:
- `:root` block with all CSS custom properties (colors, typography, spacing)
- Text conventions comment block
- Base styles (html, body)
- Logo bar (`.logo-bar`, `.logo-tum`, `.logo-vw`)
- Progress bar (`.progress-bar`, `.pb-section`, `.pb-icon`, `.pb-label.*`, `.pb-chev.*`)
- Section label & title (`.section-label`, `h1`)
- Footer (`.footer`, `.footer-text`, `.footer-refs`, `.page-num`)
- Statement bar (`.statement-bar`)
- Shared text utilities (`.accent`, `.key-term`, `.math-var`, `.mono-key`)
- Panel components (`.panel-header`, `.hdr-matsim`, `.hdr-python`, `.hdr-simwrap`, `.panel-narrow`)
- Export wall (`.export-wall`, `.wall-line`, `.wall-label`)

**Step 2: Validate the file is syntactically valid CSS**

Open `theme.css` in a browser dev tools or use a quick Node.js test:

```bash
cd /mnt/Shared/Code/projects/Dissertation-theme-refactor/presentations/doc_sem/doc_sem_ws_2026/outputs/slides
node -e "
const fs = require('fs');
const css = fs.readFileSync('theme.css', 'utf8');
console.log('File size:', css.length, 'bytes');
console.log('Has :root:', css.includes(':root'));
console.log('Has --c-teal:', css.includes('--c-teal'));
console.log('Has .footer:', css.includes('.footer'));
console.log('Braces balanced:', (css.match(/\{/g)||[]).length === (css.match(/\}/g)||[]).length);
"
```

Expected: All checks pass, braces balanced.

**Step 3: Commit**

```bash
git add presentations/doc_sem/doc_sem_ws_2026/outputs/slides/theme.css
git commit -m "feat(slides): add centralized theme.css with CSS custom properties"
```

---

### Task 3: Extend html2pptx.cjs for `<sub>`/`<sup>` Support

**Files:**
- Modify: `presentations/doc_sem/doc_sem_ws_2026/outputs/slides/html2pptx.cjs`

There are three changes needed in this file:

**Step 1: Add `<sub>`/`<sup>` tag handling to `parseInlineFormatting`**

In the `parseInlineFormatting` function, after the bold/italic/underline tag checks (line ~436), add:

```javascript
            if (node.tagName === 'SUB') options.subscript = true;
            if (node.tagName === 'SUP') options.superscript = true;
```

Insert these two lines right after line 436 (`if (node.tagName === 'U') options.underline = true;`).

**Step 2: Add `SUB`/`SUP` to the inline element CSS extraction condition**

On line 439, add `SUB` and `SUP` to the tag check:

Change:
```javascript
if (node.tagName === 'SPAN' || node.tagName === 'B' || node.tagName === 'STRONG' || node.tagName === 'I' || node.tagName === 'EM' || node.tagName === 'U') {
```

To:
```javascript
if (node.tagName === 'SPAN' || node.tagName === 'B' || node.tagName === 'STRONG' || node.tagName === 'I' || node.tagName === 'EM' || node.tagName === 'U' || node.tagName === 'SUB' || node.tagName === 'SUP') {
```

**Step 3: Add `sub, sup` to the `hasFormatting` detection selectors**

There are two `hasFormatting` checks that detect whether a text element needs multi-run parsing. Both must include `sub, sup`:

Line 762 (inside the list processing):
```javascript
const hasFormatting = li.querySelector('b, i, u, strong, em, span, sub, sup');
```

Line 858 (inside the text element processing):
```javascript
const hasFormatting = el.querySelector('b, i, u, strong, em, span, sub, sup');
```

**Step 4: Validate the changes with a test HTML file**

Create a temporary test file:

```bash
cat > /tmp/test-subsup.html << 'HTMLEOF'
<!DOCTYPE html>
<html>
<head>
<style>
body { width: 720pt; height: 405pt; margin: 0; padding: 0; font-family: Arial, sans-serif; display: flex; flex-direction: column; position: relative; }
</style>
</head>
<body>
<p>The price<sub>c</sub> variable measures cost per cluster</p>
<p>E = mc<sup>2</sup> is a famous equation</p>
</body>
</html>
HTMLEOF
```

Run the build on just this test file:

```bash
cd /mnt/Shared/Code/projects/Dissertation-theme-refactor/presentations/doc_sem/doc_sem_ws_2026/outputs/slides
NODE_PATH=~/.local/share/claude-office-skills/node_modules node -e "
const pptxgen = require('pptxgenjs');
const html2pptx = require('./html2pptx.cjs');
(async () => {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';
  await html2pptx('/tmp/test-subsup.html', pptx);
  await pptx.writeFile({ fileName: '/tmp/test-subsup.pptx' });
  console.log('SUCCESS: PPTX created at /tmp/test-subsup.pptx');
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
"
```

Expected: `SUCCESS: PPTX created` — no errors. Open the PPTX to verify subscript/superscript render correctly.

**Step 5: Clean up test file and commit**

```bash
rm /tmp/test-subsup.html /tmp/test-subsup.pptx
git add presentations/doc_sem/doc_sem_ws_2026/outputs/slides/html2pptx.cjs
git commit -m "feat(html2pptx): add <sub>/<sup> support for subscript/superscript in PowerPoint"
```

---

### Task 4: Migrate Pilot Slide (slide-03) — Validate Approach

**Files:**
- Modify: `presentations/doc_sem/doc_sem_ws_2026/outputs/slides/slide-03-problem-statement.html`

This is the pilot migration. We do one slide carefully to validate the `<link>` approach works end-to-end before batch-migrating the rest.

**Step 1: Take a "before" screenshot**

Use Playwright MCP to open `slide-03-problem-statement.html` and take a screenshot for visual comparison:

```
Navigate to: file:///mnt/Shared/Code/projects/Dissertation-theme-refactor/presentations/doc_sem/doc_sem_ws_2026/outputs/slides/slide-03-problem-statement.html
Take screenshot → save as slide-03-before.png
```

**Step 2: Replace the slide's boilerplate CSS with `<link>`**

In `slide-03-problem-statement.html`:

1. Add `<link rel="stylesheet" href="theme.css">` in the `<head>`, before the `<style>` block
2. Remove from the `<style>` block all CSS rules that are now in `theme.css`:
   - `html { background: ... }` — covered by theme.css
   - `body { ... }` — covered by theme.css
   - `.logo-bar`, `.logo-tum`, `.logo-vw` — covered
   - `.progress-bar`, `.pb-section`, `.pb-icon`, `.pb-label.*`, `.pb-chev.*` — covered
   - `.section-label` — covered
   - `h1` — covered
   - `.accent` — covered
   - `.statement-bar`, `.statement-bar p` — covered
   - `.footer`, `.footer-text`, `.page-num` — covered
3. Keep ONLY slide-specific CSS: `.challenge`, `.challenge-title`, `.challenge ul`, `.challenge li`, `.diagram-area`, `.diagram-inner`, `.diagram-bg`, `.diagram-title`, `.node-card`, `.card-header`, `.card-body`, etc.
4. In the kept CSS, replace hardcoded color values with CSS variables where they match the palette:
   - `#002733` → `var(--c-deep-blue)`
   - `#008C82` → `var(--c-teal)`
   - `#F8FAFB` → `var(--c-bg-gray)`
   - etc.

**Step 3: Validate the migrated slide renders identically**

Take an "after" screenshot and compare:

```
Navigate to: file:///mnt/Shared/Code/projects/Dissertation-theme-refactor/presentations/doc_sem/doc_sem_ws_2026/outputs/slides/slide-03-problem-statement.html
Take screenshot → save as slide-03-after.png
```

Visually compare before/after. They should be pixel-identical (same colors, same fonts, same positions).

**Step 4: Validate PPTX build**

```bash
cd /mnt/Shared/Code/projects/Dissertation-theme-refactor/presentations/doc_sem/doc_sem_ws_2026/outputs/slides
NODE_PATH=~/.local/share/claude-office-skills/node_modules node -e "
const pptxgen = require('pptxgenjs');
const html2pptx = require('./html2pptx.cjs');
(async () => {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';
  await html2pptx('slide-03-problem-statement.html', pptx);
  await pptx.writeFile({ fileName: '/tmp/test-theme-slide03.pptx' });
  console.log('SUCCESS');
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
"
```

Expected: `SUCCESS` — no validation errors.

**Step 5: Test viewer.html**

Open the viewer to confirm the `<iframe>` resolves `theme.css` correctly:

```
Navigate to: file:///mnt/Shared/Code/projects/Dissertation-theme-refactor/presentations/doc_sem/doc_sem_ws_2026/outputs/slides/viewer.html#3
```

Navigate to slide 03 and verify it looks correct.

**Step 6: Commit**

```bash
git add presentations/doc_sem/doc_sem_ws_2026/outputs/slides/slide-03-problem-statement.html
git commit -m "refactor(slide-03): migrate to centralized theme.css"
```

---

### Task 5: Migrate Title & Agenda Slides (00, 01)

**Files:**
- Modify: `outputs/slides/slide-00-title.html`
- Modify: `outputs/slides/slide-01-agenda.html`

**Important:** Slide 00 has a **dark background** (`#002733`) and white text. It must override the theme's white background. The `<link>` tag still provides the logo-bar and footer classes, but body/h1/footer colors need local overrides.

**Step 1: Migrate slide-00-title.html**

1. Add `<link rel="stylesheet" href="theme.css">`
2. Remove duplicated `.logo-bar`, `.logo-tum`, `.logo-vw`, `.footer`, `.footer-text`, `.page-num`
3. Keep (and override) in `<style>`:
   ```css
   html { background: var(--c-deep-blue); }
   body { background: var(--c-deep-blue); }
   h1 { color: #FFFFFF; font-size: 28pt; font-weight: 700; margin: 0 0 12pt 0; ... }
   .footer { border-top: none; }
   ```
4. Keep all slide-unique classes: `.content`, `.subtitle`, `.date`

**Step 2: Migrate slide-01-agenda.html**

Read the file first, then:
1. Add `<link rel="stylesheet" href="theme.css">`
2. Remove all shared CSS classes now in `theme.css`
3. Keep slide-specific layout classes
4. Replace hardcoded colors with CSS variables

**Step 3: Screenshot validate both slides**

Open each in Playwright, compare before/after visually.

**Step 4: Commit**

```bash
git add outputs/slides/slide-00-title.html outputs/slides/slide-01-agenda.html
git commit -m "refactor(slides-00-01): migrate title and agenda to theme.css"
```

---

### Task 6: Migrate Situation Slides (02, 03-already-done)

**Files:**
- Modify: `outputs/slides/slide-02-commuter-traffic.html`

(Slide 03 was already done in Task 4.)

**Step 1: Read and migrate slide-02**

Same pattern as Task 4: add `<link>`, remove shared CSS, keep slide-specific CSS, replace hardcoded colors with variables.

**Step 2: Screenshot validate**

**Step 3: Commit**

```bash
git add outputs/slides/slide-02-commuter-traffic.html
git commit -m "refactor(slide-02): migrate commuter traffic to theme.css"
```

---

### Task 7: Migrate Previous Methodology Slides (04, 05)

**Files:**
- Modify: `outputs/slides/slide-04-previous-methodology.html`
- Modify: `outputs/slides/slide-05-limitations.html`

**Step 1: Read and migrate both slides**

Same pattern. Note slide-04 uses the "detail card" pattern (`.detail-card`, `.detail-hdr`, `.detail-body`) — keep those styles local since they're used on only a few slides.

**Step 2: Screenshot validate both**

**Step 3: Commit**

```bash
git add outputs/slides/slide-04-previous-methodology.html outputs/slides/slide-05-limitations.html
git commit -m "refactor(slides-04-05): migrate previous methodology slides to theme.css"
```

---

### Task 8: Migrate Methodology Overview (06) — Morph Chain Start

**Files:**
- Modify: `outputs/slides/slide-06-integrated-methodology-overview.html`

**CRITICAL:** This slide begins the morph animation chain (slides 06-10). It contains `id=` attributes (`panels-row`, `panel-matsim`, `export-wall`, `right-zone`, `panel-python`, `panel-simwrapper`) that MUST be preserved exactly.

**Step 1: Read the slide and identify shared vs unique CSS**

Shared (remove): body, logo-bar, progress-bar, section-label, h1, footer, panel-header, hdr-*, panel-narrow, export-wall, wall-line, wall-label

Unique (keep): `.panels-row` positioning, `.panel-left`/`.panel-python`/`.panel-simwrapper` sizing, `.panel-inner`, any slide-specific layout

**Step 2: Migrate, preserving all `id=` attributes**

Add `<link>`, remove shared CSS, keep unique CSS. Double-check all `id=` attributes are still present in the HTML body.

**Step 3: Screenshot validate**

**Step 4: Commit**

```bash
git add outputs/slides/slide-06-integrated-methodology-overview.html
git commit -m "refactor(slide-06): migrate methodology overview to theme.css (morph IDs preserved)"
```

---

### Task 9: Migrate DRT Demand Extraction (07, 07b, 07c, 07d)

**Files:**
- Modify: `outputs/slides/slide-07-drt-demand-extraction.html`
- Modify: `outputs/slides/slide-07b-budget-bar.html`
- Modify: `outputs/slides/slide-07c-budget-bar.html`
- Modify: `outputs/slides/slide-07d-budget-bar.html`

**Step 1: Read all four slides**

Slides 07b/c/d are budget-bar animation steps — they likely share most of 07's structure with incremental changes.

**Step 2: Migrate all four**

Same pattern. Slide-07 has morph IDs — preserve them.

**Step 3: Screenshot validate all four**

**Step 4: Commit**

```bash
git add outputs/slides/slide-07-drt-demand-extraction.html outputs/slides/slide-07b-budget-bar.html outputs/slides/slide-07c-budget-bar.html outputs/slides/slide-07d-budget-bar.html
git commit -m "refactor(slides-07): migrate DRT demand extraction + budget bar animations to theme.css"
```

---

### Task 10: Migrate Optimization Pipeline (08)

**Files:**
- Modify: `outputs/slides/slide-08-optimization-pipeline.html`

This slide uses the "flow-boxes" pipeline pattern with color accents. Keep all `.flow-*`, `.trial-runner`, `.ts-*`, `.dispatch-*` classes local. The accent colors should reference CSS variables where they match the palette.

**Step 1: Read and migrate**

**Step 2: Screenshot validate**

**Step 3: Commit**

```bash
git add outputs/slides/slide-08-optimization-pipeline.html
git commit -m "refactor(slide-08): migrate optimization pipeline to theme.css"
```

---

### Task 11: Migrate Service Area Chain (09, 10, 11, 12)

**Files:**
- Modify: `outputs/slides/slide-09-service-area-anchor.html`
- Modify: `outputs/slides/slide-10-service-area-gate.html`
- Modify: `outputs/slides/slide-11-service-area-force.html`
- Modify: `outputs/slides/slide-12-service-area-pax.html`

These use the "Context Strip + Detail Card" pattern. Keep `.pipeline-row`, `.pr-*`, `.detail-card`, `.detail-hdr`, `.detail-body` classes local.

**Step 1: Read and migrate all four**

**Step 2: Screenshot validate all four**

**Step 3: Commit**

```bash
git add outputs/slides/slide-09-service-area-anchor.html outputs/slides/slide-10-service-area-gate.html outputs/slides/slide-11-service-area-force.html outputs/slides/slide-12-service-area-pax.html
git commit -m "refactor(slides-09-12): migrate service area chain to theme.css"
```

---

### Task 12: Migrate Pricing Slides (13, 14, 15) + Math Notation

**Files:**
- Modify: `outputs/slides/slide-13-pricing-overview.html`
- Modify: `outputs/slides/slide-14-pricing-ride-selection.html`
- Modify: `outputs/slides/slide-15-pricing-co-optimization.html`

These slides need BOTH the CSS migration AND the code-variable-to-math conversion.

**Step 1: Read all three slides**

**Step 2: Migrate CSS (same pattern as other tasks)**

**Step 3: Convert code variables to math notation**

Apply these conversions in the HTML body text:

| Find | Replace with |
|------|-------------|
| `price_c` | `<span class="math-var">price<sub>c</sub></span>` |
| `price_A` | `<span class="math-var">price<sub>A</sub></span>` |
| `distance_km` | `<span class="math-var">distance<sub>km</sub></span>` |
| `ride_selected_r` | `<span class="math-var">ride<sub>selected,r</sub></span>` |
| `&#931;_c` | `&#931;<sub>c</sub>` |
| `&#931;_r` | `&#931;<sub>r</sub>` |

Also convert the `.mono-key` spans where appropriate:
- `<span class="mono-key">price_c</span>` → `<span class="math-var">price<sub>c</sub></span>`

Keep `.mono-key` for text that genuinely represents code (e.g., "WTP Database" labels) but convert mathematical variables.

**Step 4: Screenshot validate all three**

Pay special attention to the subscript rendering — characters should appear below the baseline and smaller.

**Step 5: Test PPTX build for these three slides**

```bash
cd /mnt/Shared/Code/projects/Dissertation-theme-refactor/presentations/doc_sem/doc_sem_ws_2026/outputs/slides
NODE_PATH=~/.local/share/claude-office-skills/node_modules node -e "
const pptxgen = require('pptxgenjs');
const html2pptx = require('./html2pptx.cjs');
(async () => {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';
  for (const f of ['slide-13-pricing-overview.html','slide-14-pricing-ride-selection.html','slide-15-pricing-co-optimization.html']) {
    console.log('Processing:', f);
    await html2pptx(f, pptx);
  }
  await pptx.writeFile({ fileName: '/tmp/test-pricing.pptx' });
  console.log('SUCCESS');
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
"
```

Expected: `SUCCESS` — subscripts should render in the PPTX.

**Step 6: Commit**

```bash
git add outputs/slides/slide-13-pricing-overview.html outputs/slides/slide-14-pricing-ride-selection.html outputs/slides/slide-15-pricing-co-optimization.html
git commit -m "refactor(slides-13-15): migrate pricing slides to theme.css + convert code vars to math notation"
```

---

### Task 13: Migrate Conclusion Slides (16, 18)

**Files:**
- Modify: `outputs/slides/slide-16-methodology-synthesis.html`
- Modify: `outputs/slides/slide-18-framework-status.html`

**Step 1: Read and migrate both**

**Step 2: Screenshot validate both**

**Step 3: Commit**

```bash
git add outputs/slides/slide-16-methodology-synthesis.html outputs/slides/slide-18-framework-status.html
git commit -m "refactor(slides-16-18): migrate conclusion slides to theme.css"
```

---

### Task 14: Audit & Fix Text Conventions

**Files:**
- Modify: All 21 slide HTML files (as needed)

**Step 1: Audit trailing periods on bullet points**

Search all slides for `<li>` content ending in a period:

```bash
cd /mnt/Shared/Code/projects/Dissertation-theme-refactor/presentations/doc_sem/doc_sem_ws_2026/outputs/slides
grep -n '\.</li>' slide-*.html
```

Remove trailing periods from bullet text (but keep periods inside sentences, e.g., "e.g." or "Dr.").

**Step 2: Audit capitalization patterns**

Scan `<li>` content for Title Case patterns (multiple capitalized words where not proper nouns):

```bash
grep -oP '<li>.*?</li>' slide-*.html | head -40
```

Convert Title Case bullets to sentence case, but preserve:
- Proper nouns (MATSim, ExMAS, Kelheim, Shapley, PowerPoint)
- Acronyms (DRT, MIP, WTP, PT)
- First word of bullet

**Step 3: Audit remaining code-style underscores**

```bash
grep -nP '[a-z]_[a-z]' slide-*.html | grep -v 'class=' | grep -v 'src=' | grep -v 'id=' | grep -v '\.css' | grep -v '\.html'
```

Convert any remaining code-style variables in visible text to subscript notation.

**Step 4: Commit**

```bash
git add outputs/slides/slide-*.html
git commit -m "style(slides): enforce text conventions — sentence case, no trailing periods, math notation"
```

---

### Task 15: Full PPTX Build & Validation

**Files:**
- Read: `outputs/slides/build.cjs`

**Step 1: Run the full PPTX build**

```bash
cd /mnt/Shared/Code/projects/Dissertation-theme-refactor/presentations/doc_sem/doc_sem_ws_2026/outputs/slides
NODE_PATH=~/.local/share/claude-office-skills/node_modules node build.cjs
```

Expected: All slides process without errors. Output: `Presentation saved to .../DocSemWS2026.pptx`

**Step 2: If any slides fail, fix the reported errors**

Common issues:
- Content overflow → adjust layout or reduce text
- Missing CSS class → add it to slide-specific `<style>` or `theme.css`
- Broken `<link>` path → ensure `theme.css` is in the same directory

**Step 3: Generate thumbnails for visual validation**

```bash
cd /mnt/Shared/Code/projects/Dissertation-theme-refactor/presentations/doc_sem/doc_sem_ws_2026/outputs
~/.local/share/claude-office-skills/venv/bin/python ~/.local/share/claude-office-skills/public/pptx/scripts/thumbnail.py DocSemWS2026.pptx
```

Review the thumbnail image to verify all slides look correct.

**Step 4: Commit the PPTX**

```bash
git add presentations/doc_sem/doc_sem_ws_2026/outputs/DocSemWS2026.pptx
git commit -m "build: rebuild PPTX with centralized theme.css"
```

---

### Task 16: Update CLAUDE.md & Implementation Plan

**Files:**
- Modify: `presentations/CLAUDE.md`
- Modify: `presentations/doc_sem/doc_sem_ws_2026/agent_workflow/implementation-plan.md`

**Step 1: Update CLAUDE.md**

Add a section about the centralized theme system:

```markdown
### Centralized Theme System
- All slides link `theme.css` via `<link rel="stylesheet" href="theme.css">`
- Colors, typography, and spacing are defined as CSS custom properties in `:root`
- Slide-specific CSS goes in a `<style>` block AFTER the `<link>` tag
- Use `var(--c-teal)` not `#008C82` for palette colors in slide CSS
- Math variables: wrap in `<span class="math-var">` with `<sub>` for subscripts
- Bullet text: sentence case, no trailing period
```

**Step 2: Update implementation-plan.md Section 5**

Add the CSS variable names to the color and typography tables so future agents use them.

**Step 3: Commit**

```bash
git add presentations/CLAUDE.md presentations/doc_sem/doc_sem_ws_2026/agent_workflow/implementation-plan.md
git commit -m "docs: update CLAUDE.md and implementation plan with centralized theme instructions"
```

---

### Task 17: Merge Back to Master

**Files:**
- None (git operations only)

**Step 1: Verify all changes are committed in the worktree**

```bash
cd /mnt/Shared/Code/projects/Dissertation-theme-refactor
git status
git log --oneline master..HEAD
```

Expected: Clean working tree, multiple commits visible.

**Step 2: Switch to main repo and merge**

```bash
cd /mnt/Shared/Code/projects/Dissertation
git checkout master
git merge feature/centralized-css --no-ff -m "merge: centralized CSS theme system for slide pipeline"
```

**Step 3: Remove the worktree**

```bash
git worktree remove ../Dissertation-theme-refactor
git branch -d feature/centralized-css
```

**Step 4: Verify**

```bash
git log --oneline -5
ls presentations/doc_sem/doc_sem_ws_2026/outputs/slides/theme.css
```

Expected: Merge commit visible, `theme.css` exists on master.

---

## Summary

| Task | Description | Slides affected |
|------|------------|-----------------|
| 1 | Git worktree setup | — |
| 2 | Create `theme.css` | — |
| 3 | Extend html2pptx `<sub>`/`<sup>` | html2pptx.cjs |
| 4 | Pilot migration (slide-03) | 1 slide |
| 5 | Title & Agenda (00, 01) | 2 slides |
| 6 | Situation (02) | 1 slide |
| 7 | Previous (04, 05) | 2 slides |
| 8 | Methodology overview (06) | 1 slide (morph chain) |
| 9 | DRT extraction (07, 07b-d) | 4 slides |
| 10 | Optimization pipeline (08) | 1 slide |
| 11 | Service area chain (09-12) | 4 slides |
| 12 | Pricing + math notation (13-15) | 3 slides |
| 13 | Conclusion (16, 18) | 2 slides |
| 14 | Text convention audit | All slides |
| 15 | Full PPTX build & validation | All slides |
| 16 | Update docs (CLAUDE.md, impl plan) | 2 docs |
| 17 | Merge back to master | — |

**Total:** 17 tasks, 21 slides migrated, 1 converter extension, 1 new file created.
