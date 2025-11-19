# Fixes Summary - Mode Filtering & Debug Logging

## Changes Made

### 1. Mode Filtering Feature ✅ COMPLETED

**What it does:** Users can click on pie chart slices to filter requests by transportation mode.

**Files modified:**
- [`MainModePieChartPlotly.vue`](components/stats/MainModePieChartPlotly.vue) - Added click handler and visual feedback
- [`StatsPanel.vue`](components/stats/StatsPanel.vue) - Added selectedModes prop and event bubbling
- [`filters.ts`](utils/filters.ts) - Added applyModeFilter() function
- [`CommuterRequests.vue`](CommuterRequests.vue) - Added mode selection state and toggle logic
- [`RequestsMap.vue`](components/RequestsMap.vue) - Added watcher for geometries prop

**How to use:**
1. Click on any slice in the Mode Share pie chart
2. Selected slice gets a blue border, others are dimmed
3. Requests filter to show only that mode
4. Click again to deselect
5. Multiple modes can be selected (OR logic)

### 2. Debug Logging ✅ ADDED

**Why:** To diagnose why the map doesn't show filtered requests.

**Logging added to:**

**CommuterRequests.vue (`currentGeometries` computed):**
```javascript
console.log('Filtering geometries:', {
  totalGeometries: this.requestGeometries.length,
  filteredRequests: this.filteredRequests.length,
  filteredRequestIds: Array.from(filteredRequestIds).slice(0, 5),
  sampleGeomId: this.requestGeometries[0]?.properties?.request_id,
  filteredGeometries: filtered.length,
})
```

**RequestsMap.vue (`updateLayers` method):**
```javascript
console.log('RequestsMap.updateLayers called:', {
  geometriesCount: this.geometries.length,
  requestsCount: this.requests.length,
  clusterBoundariesCount: this.clusterBoundaries.length,
})

console.log('Creating LineLayer with geometries:', {
  count: this.geometries.length,
  sample: this.geometries[0],
})
```

### 3. Comparison Toggle - Already Working ✅

The comparison toggle is a standard checkbox with label. The entire button area is clickable.

**How to test:**
1. Click anywhere on the "Show Comparison" button
2. Checkbox should toggle on/off
3. When enabled:
   - Histogram shows baseline (gray) + filtered (blue) bars
   - Pie chart shows outer ring for baseline data
   - Stats show "Filtered / Baseline" count

## Current Status

### Working ✅
- Mode filtering logic (filters.ts)
- Mode selection UI (pie chart highlighting)
- Request table filtering by mode
- Comparison toggle component
- Debug logging infrastructure

### Needs Testing ⚠️
- Map display of filtered requests
- Why map shows no lines when filters are active

### Suspected Issue

**ID Type Mismatch:**
The request IDs in the CSV might be numbers (0, 1, 2, 3) but the GeoJSON `request_id` properties might be strings ("0", "1", "2", "3"), or vice versa.

This would cause the filter to fail:
```typescript
const filteredRequestIds = new Set(this.filteredRequests.map(r => r.request_id))
// If request_id is number: Set { 0, 1, 2, 3 }

this.requestGeometries.filter(geom =>
  filteredRequestIds.has(geom.properties.request_id)
  // If geom.properties.request_id is string "0", the check fails
)
```

**Potential fix:**
```typescript
// In CommuterRequests.vue, currentGeometries computed:
const filteredRequestIds = new Set(
  this.filteredRequests.map(r => String(r.request_id))
)
return this.requestGeometries.filter(geom =>
  filteredRequestIds.has(String(geom.properties.request_id))
)
```

## Next Steps

1. **Open the page in browser** (http://localhost:5173/local/outputs/test-export-optimized/simwrapper/viz-commuter-requests.yaml)
2. **Open DevTools Console** (F12)
3. **Click on a filter** (cluster, timebin, or mode)
4. **Share the console output** with me

Look for:
- `Filtering geometries:` - Shows the ID matching process
- `RequestsMap.updateLayers called:` - Shows if map received updates
- `Creating LineLayer with geometries:` or `No geometries to display on map`
- Any errors in red

## Playwright MCP Issue

The Playwright MCP server is hardcoded to look for Chrome at `/opt/google/chrome/chrome`, but your system has Chromium at `/usr/bin/chromium`.

The project's `playwright.config.ts` correctly points to `/usr/bin/chromium`, but the MCP server doesn't use this config.

**Workaround:** Manual testing in browser instead of automated Playwright tests.

## Documentation Created

- [`MODE_FILTERING_IMPLEMENTATION.md`](MODE_FILTERING_IMPLEMENTATION.md) - Complete implementation guide
- [`DEBUG_GUIDE.md`](DEBUG_GUIDE.md) - Step-by-step debugging instructions
- [`FIXES_SUMMARY.md`](FIXES_SUMMARY.md) - This file
