# Export Skill System - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a `/export` Claude Code skill for generating export YAML configs, integrate export creation into the existing `/dashboard` skill, and write the export YAML schema reference guide.

**Architecture:** Three files: a standalone export skill (`.claude/commands/export.md`), modifications to the dashboard skill (`.claude/commands/dashboard.md`), and a schema reference doc (`docs/EXPORT_YAML_GUIDE.md`). The export skill mirrors the dashboard skill's questionnaire-driven approach but focuses on batch figure generation with filter states and comparison modes.

**Tech Stack:** Claude Code skills (markdown with frontmatter), AskUserQuestion tool, YAML generation, existing export system (`src/plugins/interactive-dashboard/export/`).

---

## Task 1: Export YAML Reference Guide

**Files:**
- Create: `docs/EXPORT_YAML_GUIDE.md`

This is the schema reference that both skills load. Write it first so the skills can reference it.

**Step 1: Write the reference guide**

The guide must mirror the structure of `docs/INTERACTIVE_DASHBOARD_GUIDE.md` (the dashboard reference). Source all types from `src/plugins/interactive-dashboard/types/exportConfig.ts`.

Structure:
1. Introduction (what export configs are, how they work, relationship to dashboards)
2. Complete annotated YAML schema with every key, type, default, and required/optional status
3. Filter syntax reference (3 filter types: string, string[], {min, max})
4. State design patterns section:
   - Filter-based states (one-per-category, numeric thresholds)
   - Comparison states (baseline + filtered overlay with `comparison: true`)
5. Output naming patterns (`{state}-{plot}` substitution)
6. Format presets table:

| Target | format | width | height | scale | scientific |
|--------|--------|-------|--------|-------|------------|
| Dissertation (300 DPI) | png | 1200 | 800 | 2 | true |
| Dissertation (vector) | svg | 1200 | 800 | 1 | true |
| Presentation (16:9) | png | 1600 | 900 | 1.5 | false |
| Web/screen | png | 800 | 600 | 1 | false |

7. Three complete worked examples:

**Example A: Minimal** (1 plot, 1 state)
```yaml
table:
  file: data.csv
  idColumn: id
plots:
  dist-hist:
    type: histogram
    column: distance
    binSize: 5000
states:
  all:
    export: [dist-hist]
```

**Example B: Multi-state with filters** (2 plots, 4 states)
```yaml
table:
  file: requests.csv
  idColumn: request_id
defaults:
  format: png
  width: 1200
  height: 800
  scale: 2
  scientific: true
plots:
  mode-pie:
    type: pie-chart
    column: base_mode
    title: "Mode Share"
  dist-hist:
    type: histogram
    column: distance
    binSize: 5000
    autoTrim: true
    title: "Distance Distribution"
states:
  all:
    export: [mode-pie, dist-hist]
  car-only:
    filters:
      base_mode: car
    export: [dist-hist]
  pt-only:
    filters:
      base_mode: pt
    export: [dist-hist]
  long-trips:
    filters:
      distance: { min: 15000 }
    export: [mode-pie, dist-hist]
output:
  naming: "{state}-{plot}"
```

**Example C: Comparison mode**
```yaml
table:
  file: trips.csv
  idColumn: trip_id
defaults:
  format: png
  width: 1200
  height: 800
  scale: 2
  scientific: true
plots:
  time-hist:
    type: histogram
    column: travel_time
    binSize: 600
    title: "Travel Time Distribution"
  budget-scatter:
    type: scatter-plot
    xColumn: distance
    yColumn: travel_time
    title: "Distance vs Travel Time"
states:
  all:
    export: [time-hist, budget-scatter]
  compare-car:
    filters:
      mode: car
    comparison: true
    export: [time-hist, budget-scatter]
  compare-pt:
    filters:
      mode: pt
    comparison: true
    export: [time-hist, budget-scatter]
```

8. Common patterns & gotchas:
   - Filter values must match CSV data exactly (case-sensitive)
   - `comparison: true` renders baseline (all data, gray) behind filtered data (colored)
   - Plot IDs in `states.*.export` must match keys in `plots`
   - `{state}-{plot}` produces filenames like `all-dist-hist.png`
   - Numeric range filters: `{ min: 5000 }` = ">=5000", `{ max: 10000 }` = "<=10000", `{ min: 5000, max: 10000 }` = "between"
   - `scientific: true` enables grayscale-safe patterns and academic styling
   - Settings cascade: EXPORT_DEFAULTS → `defaults` → state-level → plot-level (most specific wins)

**Step 2: Verify the guide is self-consistent**

Read back the file and check:
- All YAML examples parse correctly (validate with a quick mental/manual check)
- All type names match `exportConfig.ts`
- All defaults match `EXPORT_DEFAULTS` constant

**Step 3: Commit**

```bash
git add docs/EXPORT_YAML_GUIDE.md
git commit -m "docs: add export YAML schema reference guide"
```

---

## Task 2: Create the `/export` Skill

**Files:**
- Create: `.claude/commands/export.md`

**Step 1: Write the skill file**

The skill needs a YAML frontmatter section (same as `dashboard.md`) and the full process instructions. Use this structure:

```markdown
---
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

# SimWrapper Export Config Generator
```

The body follows the 7-step process from the design doc. Here are the key sections with their exact content:

**Introduction paragraph:**
```
You are an expert SimWrapper export config builder. Your job is to analyze the user's data and/or existing dashboard, understand what figures they need, and generate export YAML configurations that produce publication-ready images via the headless export system.

**You are the export schema expert AND the data analyst.** The user knows what figures they need for their dissertation or presentation; you know how to structure the export config with the right states, filters, and format settings.
```

**Reference loading:**
```
## Reference

Load and internalize the complete export YAML schema reference before starting:

@docs/EXPORT_YAML_GUIDE.md

This guide contains every valid key, type, default, and constraint. All export YAML you generate MUST conform to this schema.
```

**Step 1: Detect Mode**

Use Glob to search for `**/*dashboard*.yaml` in the working directory. If any are found:
- Read them and identify which ones are Interactive Dashboards (have a `table:` key)
- Present them to the user with `AskUserQuestion`:
  - "Derive from existing dashboard" (list which dashboard, pre-populate plots/table from it)
  - "Start fresh from data files"

If no dashboards found, proceed directly to fresh mode.

In derive mode:
- Read the dashboard YAML
- Extract: `table.dataset` as `table.file`, `table.idColumn`, all card configs from `layout` rows
- Map dashboard card types to export plot types: `histogram`→`histogram`, `pie-chart`→`pie-chart`, `scatter-plot`→`scatter-plot`, `correlation-matrix`→`correlation-matrix`
- Extract `colorSchemes`, `colorBy` config, `controls` config
- Build a plot list from the dashboard cards

**Step 2: Data Discovery**

In fresh mode: same profiling as the dashboard skill (Step 1a-1d). Profile CSV columns (numeric stats, categorical unique values), find GeoJSON files, compute coordinate ranges.

In derive mode: the dashboard already identified the data file and key columns. Supplement with:
- Unique value lists for categorical columns (needed to propose filter-based states)
- Min/max/mean for numeric columns (needed to propose threshold-based states)
- Use a single python3 one-liner to get all needed stats

**Step 3: Understand the Goal**

Ask with `AskUserQuestion`:
- header: "Export goal"
- question: "What are these exported figures for?"
- options: Generate 3-4 data-driven options. Examples:
  - "Dissertation figures — publication-quality charts showing [story from data]"
  - "Conference presentation — clear visuals for slides about [story]"
  - "Report appendix — systematic export of all analyses"
  - "Comparison study — filtered vs unfiltered views of key metrics"
- The user can also type their own goal

**Step 4: Target Format**

Ask with `AskUserQuestion`:
- header: "Output format"
- question: "What's the primary output target for these figures?"
- options:
  - "Dissertation / thesis (LaTeX)" → defaults: png, 1200x800, scale 2, scientific true
  - "Presentation (PowerPoint/Keynote)" → defaults: png, 1600x900, scale 1.5, scientific false
  - "Both (generate presets for each)" → generate two `defaults` sections, user picks per-run
  - "Custom" → ask follow-up for each parameter

**Step 5: Plot Selection**

In derive mode:
- List all plots extracted from the dashboard with their types and key properties
- Present as multiSelect `AskUserQuestion`: "Which plots should be included in the export?"
- Pre-select all by default

In fresh mode:
- Use the same chart selection logic as the dashboard skill:
  - Categorical columns (2-8 unique values) → pie-chart
  - Numeric columns with interesting distribution (std > 0.1 * mean) → histogram
  - Correlated numeric pairs → scatter-plot
- Show data rationale for each proposed plot
- Ask user to confirm/adjust

For each selected plot, compute and set:
- `binSize` from data range (same algorithm as dashboard skill: range/12, round to nice number)
- `autoTrim: true` for histograms (unless naturally bounded)
- Descriptive `title` based on column name

**Step 6: State Design**

Always include an `all` state (unfiltered, exports all selected plots).

**Filter-based states:**
For each categorical column found during data discovery with 2-8 unique values:
- Propose one state per unique value: `{column}-{value}` with `filters: { column: value }`
- Present as multiSelect `AskUserQuestion`
- Group by column: "Mode states: car-only, pt-only, bike-only, walk-only"
For numeric columns with meaningful ranges:
- Propose threshold states based on quartiles or domain knowledge
- E.g., `short-trips` (distance < Q1), `medium-trips` (Q1 < distance < Q3), `long-trips` (distance > Q3)

**Comparison states:**
For the 1-2 most important categorical columns:
- Propose comparison states: `compare-{value}` with `filters: { column: value }, comparison: true`
- Explain: "These render all data as a gray baseline with the filtered subset overlaid in color"
- Present as multiSelect

After user selects states, ask:
- "Want to add any custom states with specific filter combinations?" (free text option)

**Step 7: Generate & Validate**

1. Build the export YAML from all gathered information
2. Pre-write validation checklist:
   - [ ] `table.file` points to an existing CSV file
   - [ ] `table.idColumn` exists in the CSV headers
   - [ ] All plot `column`, `xColumn`, `yColumn` values exist in CSV headers
   - [ ] All plot `type` values are valid (`histogram`, `pie-chart`, `scatter-plot`, `map`, `correlation-matrix`, `timeline`)
   - [ ] All state `export` arrays reference valid plot IDs from `plots`
   - [ ] All filter column names exist in CSV headers
   - [ ] Filter values match actual data values (case-sensitive check for categoricals)
   - [ ] `defaults` settings are appropriate for the target format
   - [ ] Naming pattern produces unique filenames across all state-plot combinations
3. Write the export YAML file
4. If a dashboard YAML exists, read it and append an `export:` section:
   ```yaml
   export:
     - file: export-<name>.yaml
       label: "Export Figures"
   ```
   This makes the export config appear in the ExportButton dropdown in the UI.
5. Present summary:
   - Total export count (states × plots per state)
   - File location
   - How to run: "Use the Export button in the dashboard, or run `npm run export -- path/to/export-config.yaml`"
6. Offer refinements: "Want to add more plots, adjust states, change format settings, or add another export config?"

**Key Rules section** (at the end of the skill):
1. Always profile data before proposing states — filter values must match actual data
2. States should serve the user's goal — don't propose 50 states when 5 tell the story
3. Comparison mode requires at least one filter — `comparison: true` without filters is meaningless
4. Filter values are case-sensitive — verify against actual CSV data
5. Use descriptive plot IDs — `mode-pie` not `plot1`
6. Use descriptive state IDs — `car-only` not `state1`
7. scientific mode defaults to true for dissertation, false for presentation
8. Always include an `all` (unfiltered) state as baseline
9. Validate every column reference against actual CSV headers before writing
10. If deriving from a dashboard, reuse its exact column names and plot configurations

**Step 2: Verify the skill file**

Read back `.claude/commands/export.md` and verify:
- Frontmatter has `allowed-tools` matching the dashboard skill
- All 7 steps are present
- `@docs/EXPORT_YAML_GUIDE.md` reference is included
- AskUserQuestion patterns match the design

**Step 3: Commit**

```bash
git add .claude/commands/export.md
git commit -m "feat: add /export skill for generating export YAML configs"
```

---

## Task 3: Modify the Dashboard Skill

**Files:**
- Modify: `.claude/commands/dashboard.md`

**Step 1: Add Step 6b between Step 6 and Step 7**

Insert the following section after "Write the YAML file using the Write tool." (end of Step 6, line 443) and before "### Step 7: Validate & Present" (line 445):

```markdown
### Step 6b: Export Config Offer

After writing the dashboard YAML, offer to create a companion export config for batch figure generation.

**Ask with `AskUserQuestion`:**
- header: "Export config"
- question: "Would you like to create an export config for batch figure generation? This enables exporting publication-ready figures via the Export button or the CLI."
- options:
  - "Yes — create export config" (description: "I'll propose states and generate an export YAML alongside the dashboard")
  - "No — skip for now" (description: "You can always create one later with the /export skill")

**If yes:**

1. **Ask target format** with `AskUserQuestion`:
   - header: "Export target"
   - question: "What's the primary target for exported figures?"
   - options:
     - "Dissertation / thesis (LaTeX)" → png, 1200x800, scale 2, scientific true
     - "Presentation (PowerPoint/Keynote)" → png, 1600x900, scale 1.5, scientific false

2. **Auto-extract plots** from the dashboard YAML just written:
   - Walk through all `layout` rows and collect cards with exportable types (histogram, pie-chart, scatter-plot, correlation-matrix)
   - Map each card to an export plot definition, preserving column, binSize, xColumn, yColumn, colorBy, title, autoTrim, etc.
   - Assign a descriptive plot ID from the card type + column (e.g., `mode-pie`, `distance-hist`, `time-vs-distance-scatter`)

3. **Propose filter-based states** using data from Step 1:
   - For each categorical column with 2-8 unique values used in the dashboard: propose per-value states
   - For key numeric columns: propose threshold states (e.g., short/medium/long trips)
   - Present as multiSelect `AskUserQuestion`: "Which filter states should be included?"
   - Always include `all` (unfiltered baseline)

4. **Propose comparison states** for the 1-2 most central categorical columns:
   - Present as multiSelect: "Which comparison states? (renders filtered data overlaid on baseline)"

5. **Generate the export YAML**:
   - Write to `export-<dashboard-filename>.yaml` in the same directory as the dashboard
   - Use the dashboard's `table.dataset` as `table.file` and `table.idColumn`
   - Apply format defaults from step 1 above

6. **Link to dashboard**: Read back the dashboard YAML and append:
   ```yaml
   export:
     - file: export-<name>.yaml
       label: "Export Figures"
   ```

7. **Present summary**: "Created export config with X plots × Y states = Z total exports. Run via the Export button or `npm run export -- path/to/config.yaml`."

**If no:** Proceed to Step 7.
```

**Step 2: Update Step 7 to mention export**

In Step 7's "Offer refinements" bullet (line 454), update to include export:

Change:
```
6. **Offer refinements**: "Want to add more charts, adjust bin sizes, change colors, restructure the layout, or add another tab?"
```
To:
```
6. **Offer refinements**: "Want to add more charts, adjust bin sizes, change colors, restructure the layout, add another tab, or create/modify an export config?"
```

**Step 3: Verify the modification**

Read back `.claude/commands/dashboard.md` and verify:
- Step 6b is correctly placed between Step 6 and Step 7
- Step numbering is consistent (6, 6b, 7)
- The `AskUserQuestion` patterns are consistent with the rest of the skill
- The export YAML generation reuses dashboard data correctly

**Step 4: Commit**

```bash
git add .claude/commands/dashboard.md
git commit -m "feat(dashboard): add Step 6b export config offer after dashboard generation"
```

---

## Summary of Files

| Action | File | Purpose |
|--------|------|---------|
| Create | `docs/EXPORT_YAML_GUIDE.md` | Export YAML schema reference (loaded by both skills) |
| Create | `.claude/commands/export.md` | Standalone `/export` skill |
| Modify | `.claude/commands/dashboard.md` | Add Step 6b export config offer |

## Dependency Order

```
Task 1 (EXPORT_YAML_GUIDE.md)
  ├─→ Task 2 (/export skill — references the guide)
  └─→ Task 3 (dashboard modification — references export patterns)
```
