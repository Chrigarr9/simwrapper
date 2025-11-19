# Interactive Dashboard Plugin - Implementation Tasks

This is a simplified task checklist for implementing the Interactive Dashboard plugin. See [INTERACTIVE_DASHBOARD_PLANNING.md](./INTERACTIVE_DASHBOARD_PLANNING.md) for full details.

## Phase 1: Core Infrastructure (Week 1-2)

### Setup
- [ ] Create `/src/plugins/interactive-dashboard` directory structure
- [ ] Create component subdirectories (components/, map-layers/, stats/)
- [ ] Register plugin in `/src/plugins/pluginRegistry.ts`
- [ ] Add file pattern: `**/viz-interactive-*.y?(a)ml`

### TypeScript Types
- [ ] Create `InteractiveDashboardConfig.ts` with all config interfaces
- [ ] Define `FilterDefinition` interface
- [ ] Define `LinkageConfig` interface
- [ ] Define `StatConfig` interface
- [ ] Define `GeometryLayerConfig` interface

### Core Classes
- [ ] Implement `FilterManager.ts`
  - [ ] addFilter(), removeFilter(), clearFilters()
  - [ ] applyFilters() with AND logic
  - [ ] Subscribe/unsubscribe pattern
  - [ ] Write unit tests
- [ ] Implement `LinkageManager.ts`
  - [ ] registerLinkage()
  - [ ] ID mapping methods (table ↔ geometry)
  - [ ] One-to-many relationship support
  - [ ] Write unit tests

### Main Component
- [ ] Create `InteractiveDashboard.vue` skeleton
- [ ] Implement YAML config loading
- [ ] Implement config validation with error messages
- [ ] Initialize DashboardDataManager
- [ ] Initialize FilterManager and LinkageManager
- [ ] Set up reactive state (filters, hover, selection)

---

## Phase 2: Table Component (Week 2)

- [ ] Create `components/DashboardTable.vue`
- [ ] Choose table library (vue-good-table or vue3-easy-data-table)
- [ ] Implement basic table rendering
- [ ] Implement row highlighting for `hoveredIds`
- [ ] Implement row highlighting for `selectedIds`
- [ ] Implement row click handler → emit `@row-select`
- [ ] Implement row hover handler → emit `@row-hover`
- [ ] Add pagination
- [ ] Implement visibility modes (visible/hidden/minimized)
- [ ] Style for light/dark mode
- [ ] Test with 10k+ row dataset

---

## Phase 3: Statistics Framework (Week 3-4)

### Framework
- [ ] Create `stats/BaseStat.ts` abstract class
- [ ] Create `stats/_statCatalog.ts` registry
- [ ] Create `components/StatPanel.vue` wrapper

### Stat Components
- [ ] **BarChartStat.vue**
  - [ ] Implement data grouping (by column)
  - [ ] Create Plotly bar chart
  - [ ] Handle click → emit filter
  - [ ] Implement comparison mode overlay
  - [ ] Test with various column types

- [ ] **PieChartStat.vue**
  - [ ] Implement data grouping
  - [ ] Create Plotly pie chart
  - [ ] Handle click → emit filter
  - [ ] Implement comparison mode

- [ ] **HistogramStat.vue**
  - [ ] Implement binning logic
  - [ ] Support auto/fixed bin sizes
  - [ ] Create Plotly histogram
  - [ ] Handle bin click → emit filter
  - [ ] Support time-based binning
  - [ ] Implement comparison mode

- [ ] **SummaryCardStat.vue**
  - [ ] Calculate aggregations (count, sum, avg, min, max)
  - [ ] Design card UI
  - [ ] Show filtered vs. unfiltered comparison

- [ ] **TimeSeriesStat.vue** (optional, Phase 3b)
  - [ ] Time-based aggregation
  - [ ] Plotly line chart
  - [ ] Brush selection for time ranges

### Integration
- [ ] Connect stats to FilterManager
- [ ] Test stat click → filter → other stats update
- [ ] Implement comparison mode toggle
- [ ] Style stats for dashboard layout

---

## Phase 4: Map Component (Week 5-6)

### Base Map
- [ ] Create `components/DashboardMap.vue`
- [ ] Integrate deck.gl
- [ ] Add background map (Mapbox or OSM tiles)
- [ ] Implement zoom controls
- [ ] Implement map camera state management

### Geometry Layer Framework
- [ ] Create `map-layers/BaseGeometryLayer.ts` interface
- [ ] Create `map-layers/_layerCatalog.ts` registry
- [ ] Implement layer loading mechanism in DashboardMap

### Layer Implementations
- [ ] **PointLayer.ts**
  - [ ] Load GeoJSON file
  - [ ] Create deck.gl ScatterplotLayer
  - [ ] Implement linkage to table via LinkageManager
  - [ ] Implement color styling (discrete color map)
  - [ ] Implement radius/opacity styling
  - [ ] Handle hover → emit `@feature-hover`
  - [ ] Handle click → emit `@feature-select`
  - [ ] Highlight features based on selection state

- [ ] **LineLayer.ts**
  - [ ] Load GeoJSON file
  - [ ] Create deck.gl PathLayer (or ArcLayer for arcs)
  - [ ] Implement styling (color, width)
  - [ ] Implement linkage and interactions

- [ ] **PolygonLayer.ts**
  - [ ] Load GeoJSON file
  - [ ] Create deck.gl PolygonLayer
  - [ ] Implement fill and stroke styling
  - [ ] Implement linkage and interactions

### Map Integration
- [ ] Connect map to LinkageManager
- [ ] Connect map to FilterManager (update on filter changes)
- [ ] Implement hover → highlight table rows
- [ ] Implement click → filter table
- [ ] Test with multiple layers simultaneously

---

## Phase 5: Integration & Polish (Week 7)

### UI Components
- [ ] Create `components/FilterSummary.vue`
  - [ ] Display active filters as tags
  - [ ] Add remove button per filter
  - [ ] Add "Clear All" button

- [ ] Create `components/ComparisonToggle.vue`
  - [ ] Toggle button UI
  - [ ] Update global comparison state

### Layout System
- [ ] Implement row/column layout from YAML
- [ ] Support flex-based sizing
- [ ] Support height specifications
- [ ] Make layout responsive
- [ ] Add fullscreen mode for map

### Coordination
- [ ] Wire table → FilterManager → stats/map update
- [ ] Wire stats → FilterManager → table/other stats/map update
- [ ] Wire map → LinkageManager → FilterManager → everything updates
- [ ] Test full interaction loop:
  - [ ] Click stat bar → table filters → map highlights
  - [ ] Click map feature → table filters → stats update
  - [ ] Hover map → table highlights
  - [ ] Click table row → map highlights

### Polish
- [ ] Add loading indicators for data/geometries
- [ ] Add error handling with user-friendly messages
- [ ] Improve styling (margins, colors, fonts)
- [ ] Add keyboard shortcuts (Escape = clear filters)
- [ ] Test and fix any UI glitches

---

## Phase 6: Testing & Documentation (Week 8)

### Testing
- [ ] Write unit tests for FilterManager
- [ ] Write unit tests for LinkageManager
- [ ] Write integration tests for filtering flow
- [ ] Create example datasets for testing:
  - [ ] Commuter requests (requests + clusters)
  - [ ] Rides (rides + routes)
  - [ ] Generic trips
- [ ] Test edge cases:
  - [ ] Empty dataset
  - [ ] Single row dataset
  - [ ] Large dataset (100k+ rows)
  - [ ] Missing GeoJSON files
  - [ ] Invalid YAML configs
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Performance testing and optimization

### Documentation
- [ ] Write user guide:
  - [ ] Introduction and overview
  - [ ] YAML configuration reference
  - [ ] Example configs with explanations
  - [ ] Troubleshooting guide

- [ ] Write developer guide:
  - [ ] Architecture overview
  - [ ] How to add new stat types
  - [ ] How to add new geometry layer types
  - [ ] API reference

- [ ] Create example YAML files:
  - [ ] `example-commuter-requests.yaml`
  - [ ] `example-rides.yaml`
  - [ ] `example-trips.yaml`

- [ ] Add inline code comments
- [ ] Create `README.md` in plugin directory

---

## Phase 7: Deployment & Feedback

- [ ] Code review
- [ ] Merge to main branch
- [ ] Update main SimWrapper documentation
- [ ] Create tutorial video/screencast (optional)
- [ ] Announce to users
- [ ] Collect feedback for improvements
- [ ] Plan v2 features based on feedback

---

## Open Questions to Resolve Before Implementation

> These questions from the planning doc should be answered before starting:

1. **Cluster ID ambiguity**: Use separate GeoJSON files or conditional linkage?
2. **One-to-many selection**: Filter all or highlight only?
3. **Time range filtering**: Support `columnEnd` for overlap logic?
4. **Color scales**: Start with discrete maps or also support continuous?
5. **Stat multi-select**: Single select only or add Ctrl+Click for multi?
6. **Map legend**: Auto-generate or require manual config?

---

## Quick Start Checklist

Before diving into implementation:

- [ ] Review [INTERACTIVE_DASHBOARD_PLANNING.md](./INTERACTIVE_DASHBOARD_PLANNING.md) in full
- [ ] Discuss open questions with team
- [ ] Set up development environment
- [ ] Create feature branch: `feature/interactive-dashboard`
- [ ] Set up issue tracking for tasks
- [ ] Schedule weekly progress reviews

---

## Progress Tracking

- **Phase 1**: ⬜ Not Started / 🔄 In Progress / ✅ Complete
- **Phase 2**: ⬜ Not Started / 🔄 In Progress / ✅ Complete
- **Phase 3**: ⬜ Not Started / 🔄 In Progress / ✅ Complete
- **Phase 4**: ⬜ Not Started / 🔄 In Progress / ✅ Complete
- **Phase 5**: ⬜ Not Started / 🔄 In Progress / ✅ Complete
- **Phase 6**: ⬜ Not Started / 🔄 In Progress / ✅ Complete
- **Phase 7**: ⬜ Not Started / 🔄 In Progress / ✅ Complete

---

Last Updated: 2025-11-19
