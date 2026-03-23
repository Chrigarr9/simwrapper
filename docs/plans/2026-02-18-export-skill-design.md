# Export Skill System Design

**Goal:** Create a Claude Code skill (`/export`) for generating export YAML configs, plus integrate export creation into the existing `/dashboard` skill as an optional follow-up step.

**Architecture:** Two separate skills + a hook. The `/export` skill works standalone (from raw data or derived from an existing dashboard). The `/dashboard` skill gets a new Step 6b that offers to generate a companion export config after dashboard creation. Both reference a new `docs/EXPORT_YAML_GUIDE.md` schema document.

---

## 1. `/export` Skill (`.claude/commands/export.md`)

Standalone skill for generating export YAML configs. Mirrors the dashboard skill's questionnaire-driven approach but focused on batch figure generation.

### Process (7 steps)

**Step 1: Detect Mode**
- Glob for `*dashboard*.yaml` in working directory
- If found, offer two modes via `AskUserQuestion`:
  - "Derive from dashboard" — read dashboard YAML, extract table config, plot definitions, color schemes as starting points
  - "Start fresh" — full data profiling from CSV files
- In derive mode, pre-populate plot list and column knowledge from the dashboard

**Step 2: Data Discovery**
- Same deep profiling as the dashboard skill: find CSVs, count rows, profile numeric columns (min/max/mean/std), profile categorical columns (unique values, frequencies), find GeoJSON files
- In derive mode, this is lighter — supplement dashboard knowledge with any missing stats needed for state proposals (e.g., numeric range boundaries for filter-based states)
- Compute: column types, value ranges, categorical breakdowns

**Step 3: Understand the Goal**
- Ask purpose: "What's the goal of these exports?"
  - Generate 3-4 data-driven story options (same pattern as dashboard skill)
  - User can provide their own goal
- This frames which plots and states to propose

**Step 4: Target Format**
- Ask via `AskUserQuestion`:
  - Output target: Dissertation (LaTeX) / Presentation (PowerPoint/Keynote)
  - Based on answer, set defaults:
    - Dissertation: PNG 1200x800 scale 2 (300 DPI), scientific mode on, SVG option
    - Presentation: PNG 1600x900 scale 1.5, scientific mode off, bolder colors
  - User can override any default

**Step 5: Plot Selection**
- In derive mode: list all plots from the dashboard YAML, pre-select all, let user deselect
- In fresh mode: use the same chart selection logic as dashboard skill (pie for 2-8 categorical values, histogram for numeric, scatter for correlation pairs)
- For each plot, show data rationale: "distance histogram (range 0.5-45km, binSize 5km, ~9 bins)"
- Include bin size computation, autoTrim recommendations, axis range logic

**Step 6: State Design**
- Always include an `all` state (unfiltered baseline)
- Propose filter-based states by analyzing the data:
  - For each categorical column with 2-8 unique values: propose one state per value (e.g., `mode-car: filters: { base_mode: car }`)
  - For numeric columns: propose meaningful thresholds (e.g., `short-trips: filters: { distance: { max: 5000 } }`)
  - Present proposals via `AskUserQuestion` with multiSelect, user picks which to include
- Propose comparison states:
  - For key categorical filters, propose "all data vs filtered" with `comparison: true`
  - E.g., `compare-car: { filters: { base_mode: car }, comparison: true }` renders baseline + filtered overlay
- User can add custom states by providing filter definitions

**Step 7: Generate & Validate**
- Generate export YAML following `docs/EXPORT_YAML_GUIDE.md` schema
- Validate: all column names exist in CSV, all plot types valid, states reference valid plot IDs
- Write the export YAML file (e.g., `export-<name>.yaml`)
- If a dashboard YAML exists, add an `export:` section pointing to the export config:
  ```yaml
  export:
    - file: export-<name>.yaml
      label: "Export Figures"
  ```
  This makes it appear in the ExportButton dropdown.
- Present summary and offer refinements

---

## 2. Dashboard Skill Integration (Step 6b in `/dashboard`)

After Step 6 (YAML generation), add:

**Step 6b: Export Config Offer**

1. Ask: "Would you like to create an export config for batch figure generation?"
2. If yes:
   - Read back the just-written dashboard YAML
   - Ask target format (dissertation/presentation)
   - Auto-extract all plots from the dashboard layout
   - Propose filter-based states from the dashboard's categorical columns (same logic as export skill Step 6)
   - Propose 2-3 comparison states
   - User picks states via multiSelect
   - Generate `export-<dashboard-name>.yaml`
   - Add `export:` section to the dashboard YAML
3. If no: skip, proceed to Step 7 (validation)

This is deliberately lighter than standalone `/export` — it piggybacks on all decisions already made during dashboard creation.

---

## 3. Export YAML Reference Guide (`docs/EXPORT_YAML_GUIDE.md`)

Schema reference document loaded by both skills via `@docs/EXPORT_YAML_GUIDE.md`.

Contents:
- Complete annotated YAML schema (matching `src/plugins/interactive-dashboard/types/exportConfig.ts`)
- Every key with type, default, required/optional status
- Filter syntax: string (single categorical), string[] (multi categorical), `{min, max}` (numeric range)
- State design patterns: filter-based, comparison, cross-product
- Naming patterns: `{state}-{plot}` substitution
- Format/dimension presets: dissertation vs presentation defaults
- 3 worked examples: minimal, multi-state with filters, comparison mode
- Common patterns & gotchas

---

## File Deliverables

| File | Action | Purpose |
|------|--------|---------|
| `.claude/commands/export.md` | Create | Standalone export skill |
| `.claude/commands/dashboard.md` | Modify | Add Step 6b export offer after YAML generation |
| `docs/EXPORT_YAML_GUIDE.md` | Create | Export YAML schema reference |

## Design Decisions

1. **Two skills, not one** — Export and dashboard are distinct workflows. Merging would create an 800+ line monolith.
2. **Derive mode auto-detection** — If a dashboard YAML exists, offer to derive from it. This avoids redundant data profiling and keeps consistency.
3. **Filter-based + comparison states** — These cover the two main export use cases: "show me just X" and "compare X vs everything."
4. **Format target as a question** — Dissertation vs presentation have very different defaults (DPI, dimensions, scientific mode). Asking upfront prevents rework.
5. **Dashboard hook after Step 6** — The dashboard is fully designed and generated, so we have complete context to derive an export config. Earlier would interrupt the dashboard flow.
6. **`export:` section in dashboard YAML** — Connects the export config to the ExportButton dropdown in the UI, making it discoverable without CLI.
