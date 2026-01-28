# Quick Task 003: Dashboard Visualization Polish - Summary

**Plan:** 003
**Type:** Quick task
**Completed:** 2026-01-28

---

## One-Liner

Scientific axis labels with units, multi-select histograms, relative density comparison mode, z-ordered map selections, and formatted numeric legends.

---

## What Was Built

### Task 1: Scientific Axis Labels with Units

Added `formatAxisLabel()` helper to HistogramCard and ScatterCard that reads column format from `tableConfig.columns.formats` and generates labels like "Distance [km]", "Duration [min]".

**Supported formats:**
- `time` -> "[hh:mm]"
- `duration` -> "[min]" or "[s]"
- `distance` -> "[km]" or "[m]"
- `percent` -> "[%]"
- `decimal` with unit field -> "[{unit}]"

### Task 2: Multi-Select Histogram Bins

Fixed histogram bin selection to support selecting multiple bins with OR logic within the same dimension.

**Root cause:** The `filteredData` watcher was clearing selections when data size grew, which happens during multi-select (OR filter broadens results).

**Solution:** Added `justEmittedFilter` ref to track self-originated filter changes and only clear selections on external filter changes.

### Task 3: Relative Density Mode for Comparison Histograms

When comparison mode is active, histograms now show relative frequency (percentages) instead of absolute counts:

- Added `histogramDataDensity` and `baselineHistogramDataDensity` computed properties
- Y-axis changes from "Count" to "Percentage [%]"
- Hover template shows "X%" format
- Enables meaningful shape comparison between filtered and baseline distributions

### Task 4: Z-Order Selected Map Features

When features are selected on the map, non-selected features are now dimmed:

- `getFeatureFillColor`: 30% opacity for non-selected polygons
- `getFeatureColor`: 30% opacity for non-selected lines/arcs
- `getFeatureWidth`: 50% width for non-selected lines
- `getFeatureRadius`: 70% radius for non-selected points

Creates visual hierarchy where selected features pop and others fade.

### Task 5: Formatted Numeric Legend Values

Improved `formatNumber()` in ColorLegend to handle various magnitudes:

- Very small (<0.01): Scientific notation (2.9e-3)
- Very large (>=10000): Locale formatting with commas (10,000)
- Appropriate decimal places based on magnitude

---

## Key Files Modified

| File | Changes |
|------|---------|
| `src/plugins/interactive-dashboard/components/cards/HistogramCard.vue` | formatAxisLabel, justEmittedFilter, density mode |
| `src/plugins/interactive-dashboard/components/cards/ScatterCard.vue` | formatAxisLabel for x/y axes |
| `src/plugins/interactive-dashboard/components/cards/MapCard.vue` | Selection dimming in getFeature* functions |
| `src/plugins/interactive-dashboard/components/cards/ColorLegend.vue` | Improved formatNumber() |

---

## Commits

| Hash | Message |
|------|---------|
| bf9ca5a2 | feat(003): add scientific axis labels with units to charts |
| 37c26dd5 | fix(003): enable multi-select histogram bins with OR logic |
| 94f16a4d | feat(003): add relative density mode for comparison histograms |
| 2bdea4f6 | feat(003): z-order selected map features with dimmed background |
| 128d087f | feat(003): format numeric legend values for readability |

---

## Deviations from Plan

None - plan executed exactly as written.

---

## Test Verification

All changes are visual/behavioral. To verify:

1. **Axis labels**: Load a dashboard with tableConfig column formats configured
2. **Multi-select**: Click multiple histogram bins, verify OR filtering
3. **Density mode**: Enable comparison toggle, verify percentages
4. **Z-ordering**: Select a map feature, verify others dim
5. **Legend format**: Configure numeric colorBy, verify formatted values

---

## Duration

~6 minutes
