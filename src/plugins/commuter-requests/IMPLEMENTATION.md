# Commuter Requests Plugin - Implementation Plan

## Status: Phase 3 COMPLETE - All core features implemented!

## Architecture

### Data Flow
```
CSV (requests_od_flows.csv) → All attributes → Table + Stats
GeoJSON (requests_od_lines.geojson) → Geometries + minimal props → Map
GeoJSON (cluster_boundaries_*.geojson) → Cluster polygons → Map
```

### State Management (Vue 3 Reactive)
```typescript
state = {
  allRequests: Request[],          // From CSV
  requestGeometries: GeoJSON[],    // From GeoJSON
  clusterBoundaries: {             // From cluster GeoJSON
    origin: Polygon[],
    destination: Polygon[],
    spatial: Polygon[]
  },

  // Filters (AND between types, OR within type)
  selectedClusters: Set<number>(), // Multi-select
  selectedTimebins: Set<string>(), // Multi-select
  clusterType: 'origin',           // Which cluster type to show

  // UI
  showComparison: false,
  colorBy: 'mode',
}

filteredRequests = computed(() =>
  allRequests
    .filter(clusterFilter)  // OR within selected clusters
    .filter(timebinFilter)  // OR within selected timebins
)
```

### Layout (175vh total)
```
[Controls] [ClusterType▼] [Reset] [Compare☐]
┌─────────────────────┬──────────┐ 75vh
│ RequestsMap (70%)   │ Stats    │
│ - LineLayer         │ (30%)    │
│ - PolygonLayer      │          │
└─────────────────────┴──────────┘
┌─────────────────────────────────┐ 100vh
│ RequestTable (virtualized)      │
│ - Internal scroll               │
└─────────────────────────────────┘
```

## Files Structure

```
commuter-requests/
├── CommuterRequests.vue              # Main (state + layout)
├── CommuterRequestsConfig.ts         # TypeScript interfaces
├── IMPLEMENTATION.md                 # This file
├── components/
│   ├── RequestsMap.vue               # Deck.gl map
│   ├── RequestTable.vue              # Virtualized table
│   ├── StatsPanel.vue                # Stats container
│   ├── stats/
│   │   ├── ActiveTimeHistogram.vue   # Timebin bars
│   │   └── MainModePieChart.vue      # Mode donut
│   └── controls/
│       ├── ClusterTypeSelector.vue   # Dropdown
│       ├── FilterResetButton.vue     # Button
│       └── ComparisonToggle.vue      # Checkbox
└── utils/
    ├── dataLoader.ts                 # Load CSV + GeoJSON
    ├── filters.ts                    # Filter logic
    └── colorSchemes.ts               # Mode colors
```

## Config YAML

```yaml
type: commuter-requests
title: Request Analysis Dashboard

files:
  requestsTable: requests_od_flows.csv
  requestsGeometry: requests_od_lines.geojson
  clusterBoundariesOrigin: cluster_boundaries_origin.geojson
  clusterBoundariesDest: cluster_boundaries_destination.geojson
  clusterBoundariesOD: cluster_boundaries_od.geojson

display:
  colorBy: mode
  defaultClusterType: origin
  showComparison: false

stats:
  - type: active-time-histogram
    binSize: 15
  - type: main-mode-pie
```

## Implementation Phases

### Phase 0: Data Export ✅ DONE
- [x] Optimize `_export_request_od_lines()` (86% size reduction)
- [x] Fix cluster filename (`cluster_summary.csv`)
- [x] Test export (17.2 KB GeoJSON vs 121 KB original)

### Phase 1: Scaffolding ✅ DONE
- [x] Create directory structure
- [x] CommuterRequestsConfig.ts (interfaces)
- [x] dataLoader.ts (CSV + GeoJSON loading)
- [x] filters.ts (filter logic)
- [x] colorSchemes.ts (mode colors)
- [x] CommuterRequests.vue (Options API, defensive config parsing)
- [x] Register in pluginRegistry.ts
- [x] Test: Plugin loads and displays data counts

### Phase 2: Map + Clusters ✅ DONE
- [x] RequestsMap.vue (Deck.gl + MapLibre)
  - [x] LineLayer (request O-D flows, colored by mode)
  - [x] PolygonLayer (cluster boundaries, filter Points)
  - [x] Click handlers (emit events)
  - [x] Enhanced tooltips (requests + clusters with dark mode support)
  - [x] Auto fit bounds
  - [x] Fixed cluster ID matching (string "origin_55" → numeric 55)
  - [x] Dark mode support (dynamic map style switching)
  - [x] Increased cluster visibility (higher opacity, thicker borders)
- [x] ClusterTypeSelector.vue (origin/dest/spatial)
- [x] FilterResetButton.vue (disabled when no filters)
- [x] ComparisonToggle.vue
- [x] 175vh scrollable layout (75vh top + 100vh table)
- [x] Cluster click → toggle selection → filter → update map
- [x] Cluster type switch → update boundaries (fixed!)
- [x] Reactive filtering (Vue Sets with manual reactivity)
- [x] All components use SimWrapper theme CSS variables

### Phase 3: Table + Stats ✅ DONE
- [x] RequestTable.vue
  - [x] Sortable columns (click header to sort)
  - [x] Row selection (click row)
  - [x] Export to CSV button
  - [x] Formatted values (time, duration, numbers)
  - [x] Themed styling
- [x] ActiveTimeHistogram.vue
  - [x] Calculate active counts per 15-min bin
  - [x] Click bin → toggle timebin filter
  - [x] Comparison mode (baseline vs filtered)
  - [x] Responsive width
  - [x] Tooltips
- [x] MainModePieChart.vue
  - [x] Donut chart with percentages
  - [x] Hover to show absolute counts
  - [x] Legend with mode colors
  - [x] Comparison mode (outer ring for baseline)
- [x] StatsPanel.vue
  - [x] Container for all stats components
  - [x] Summary statistics (total, unique modes, active clusters)
  - [x] Comparison support
- [x] Wire: Combined filters (clusters AND timebins)
- [x] All stats update reactively with filters

### Phase 4: Polish (Optional enhancements)
- [x] Comparison mode fully functional
- [ ] Map highlighting for selected table row
- [ ] Virtualized table scrolling (for very large datasets)
- [ ] Additional stats (travel time distribution, cluster size, etc.)
- [ ] Performance optimization for 1000+ requests

## Key Decisions

1. **Files**: CSV + 1 GeoJSON (not 3 GeoJSON)
2. **Layout**: 175vh scrollable (75vh top + 100vh table)
3. **Filters**: Multi-select with OR within type, AND between types
4. **Cluster deselect**: Click same cluster again
5. **Timebin deselect**: Click same bin again
6. **Stats**: Config-driven modular components
7. **Colors**: Consistent mode scheme (auto-generated)

## What's Working

✅ **Interactive Map**
- Cluster boundaries visible and clickable
- Cluster type switching (origin/destination/spatial)
- Request O-D lines color-coded by mode
- Tooltips on hover
- Dark mode support

✅ **Filtering System**
- Click cluster polygons to filter requests
- Click histogram bins to filter by time
- Multiple selections use OR logic within type
- Different filter types use AND logic
- Reset button clears all filters
- Request count updates: "15 / 48 requests"

✅ **Statistics Dashboard**
- Active time histogram (15-min bins, clickable)
- Mode share pie chart (percentages + counts on hover)
- Summary stats (total, unique modes, active clusters)
- Comparison mode (toggle to show filtered vs baseline)

✅ **Request Table**
- Sortable columns (click headers)
- Shows filtered requests
- Export to CSV
- Formatted values (time, duration)

✅ **Theme Integration**
- Adapts to SimWrapper light/dark mode
- All components use CSS variables
- Map style switches automatically

## Testing Checklist

Refresh the page and test:

1. **Cluster filtering**
   - Switch cluster type (origin/destination/spatial)
   - Click cluster polygons → should highlight blue and filter table
   - Click again → should deselect
   - Request count should update in controls bar

2. **Time filtering**
   - Click histogram bars → should filter requests
   - Multiple bars → OR logic
   - Click again → should deselect

3. **Combined filters**
   - Select clusters AND timebins → should use AND logic
   - Reset button → should clear all

4. **Comparison mode**
   - Toggle "Show Comparison"
   - Histogram should show baseline (gray) + filtered (blue)
   - Pie chart should show outer ring for baseline

5. **Table**
   - Click column headers → should sort
   - Click rows → should select
   - Export CSV → should download

6. **Dark mode**
   - Toggle SimWrapper theme
   - Map should switch to dark style
   - All panels should adapt colors
