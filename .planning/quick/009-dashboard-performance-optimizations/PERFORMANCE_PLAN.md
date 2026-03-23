# Interactive Dashboard Performance Optimization Plan

**Created:** 2026-02-12
**Status:** Planning
**Target:** 10,000+ row datasets performing smoothly

---

## Problem Statement

The interactive dashboard experiences performance degradation with large datasets (10k+ rows). A single user interaction (e.g., clicking a histogram bin) triggers a cascade of full dataset scans, DOM updates, and chart re-renders that compounds across all cards.

**Root cause analysis identified these multiplicative factors:**
- N cards × O(n) filter scan per interaction = N×n operations
- Deep Vue watchers walking entire 10k-row arrays
- Full DOM rendering of all table rows (no virtualization)
- Undebounced Plotly chart re-renders

---

## Tier 1: High Impact, Moderate Effort (IMPLEMENT NOW)

### 1. Centralized Filtered Data

**Problem:** `FilterManager.applyFilters()` is called independently by each card via `LinkableCardWrapper`. With 6 cards and 10k rows, one filter click = 6 × 10k = 60k row evaluations.

**Solution:** Filter ONCE in `FilterManager`, store result as a reactive `filteredData` array and `filteredIds` Set. Cards consume the shared result instead of recomputing.

**Files:** `FilterManager.ts`, `LinkableCardWrapper.vue`, `InteractiveDashboard.vue`

**Expected impact:** Eliminate N× multiplier. Single largest win.

### 2. Column Indexes for Filtering

**Problem:** `applyFilters()` does O(n) linear scan with nested loops and string type coercion per row.

**Solution:** On data load, build `Map<column, Map<normalizedValue, Set<rowIndex>>>`. Filter lookup becomes O(k) where k = number of filter values, not O(n) where n = dataset size.

**Files:** `FilterManager.ts` (new `buildIndex()` method)

**Expected impact:** 10-100× faster filter application for categorical columns.

### 3. Virtual Scrolling for DataTableCard

**Problem:** `v-for` renders ALL rows as DOM nodes. 10k rows = 10k+ `<tr>` elements.

**Solution:** Implement windowed rendering — only render visible rows (~50) plus buffer. Use CSS `transform` or padding to maintain scroll position. No new dependency needed (simple offset-based approach).

**Files:** `DataTableCard.vue`

**Expected impact:** DOM nodes 10k → ~80. Immediate scroll responsiveness.

### 4. Debounce HistogramCard Rendering

**Problem:** HistogramCard calls `Plotly.newPlot()` immediately on every `filteredData` change with no debouncing. ScatterCard already debounces at 50ms.

**Solution:** Add same 50ms debounce pattern to HistogramCard. Also switch from `newPlot()` to `react()` for updates (preserving event handlers).

**Files:** `HistogramCard.vue`

**Expected impact:** Prevents rapid Plotly re-renders during filter cascades.

### 5. Shallow Watchers on All Cards

**Problem:** `watch(() => props.filteredData, ..., { deep: true })` walks entire 10k-row object tree on every array reference change. Since filtering already creates new array references, deep watching is unnecessary.

**Solution:** Remove `{ deep: true }` from filteredData watchers. Watch array reference only. For Sets (hoveredIds, selectedIds), watch both reference and `.size`.

**Files:** `HistogramCard.vue`, `ScatterCard.vue`, `PieChartCard.vue`, `CorrelationMatrixCard.vue`, `TimelineCard.vue`, `MapCard.vue`

**Expected impact:** Eliminates O(n) deep comparison per watch trigger per card.

---

## Tier 2: Medium Impact, Lower Effort (NEXT)

### 6. Pre-indexed Set for Loose Comparison

**Problem:** `setHasLoose()` in InteractiveDashboard falls back to O(n) linear iteration through Sets for type-coerced comparison. Called 3× per row in table rendering = 30k+ linear scans.

**Solution:** On data load, build normalized ID lookup `Map<string, originalValue>`. Replace linear fallback with O(1) hash lookup.

**Files:** `InteractiveDashboard.vue`, `DataTableCard.vue`

### 7. Single-Pass Min/Max

**Problem:** `Math.min(...array)` + `Math.max(...array)` = 4 passes over 10k elements in ScatterCard.

**Solution:** Single loop computing xMin, xMax, yMin, yMax simultaneously.

**Files:** `ScatterCard.vue`

### 8. Memoize Category Colors

**Problem:** `generateCategoryColors()` recreated on every `buildChartData()` call.

**Solution:** Cache result keyed on sorted category list.

**Files:** `ScatterCard.vue`

---

## Tier 3: Architectural (HIGH impact, HIGH effort — FUTURE)

### 9. Web Worker for Filtering

Move `applyFilters()` + index building to a Web Worker. Main thread never blocks on filter computation. Async result updates UI.

### 10. Incremental Filtering with BitSets

Maintain a `BitSet` per active filter. Adding/removing a filter only recomputes that filter's bitset, then AND all bitsets together. Filter updates become O(changed filter) not O(all data).

### 11. Deck.gl Layer Update Pattern

Use deck.gl's `updateTriggers` instead of recreating layers. Pass data changes through props to avoid GC pressure.

### 12. structuredClone for GeoJSON

Replace `JSON.parse(JSON.stringify(geojson))` with `structuredClone()` — ~2-3× faster for large GeoJSON objects.

---

## Implementation Priority

| Priority | Item | Impact | Effort | Status |
|----------|------|--------|--------|--------|
| 1 | Centralized filtered data | Very High | Medium | TODO |
| 2 | Column indexes | High | Medium | TODO |
| 3 | Virtual scrolling | High | Medium | TODO |
| 4 | Debounce HistogramCard | Medium | Low | TODO |
| 5 | Shallow watchers | Medium | Low | TODO |
| 6 | Pre-indexed loose comparison | Medium | Low | Future |
| 7 | Single-pass min/max | Low | Low | Future |
| 8 | Memoize category colors | Low | Low | Future |
| 9 | Web Worker filtering | Very High | High | Future |
| 10 | Incremental BitSet filtering | High | High | Future |
| 11 | Deck.gl update triggers | Medium | High | Future |
| 12 | structuredClone | Low | Low | Future |

---

## Success Metrics

After implementing Tier 1 (items 1-5):

- **Filter click response:** < 100ms for 10k rows (currently ~500ms+)
- **Table scroll:** Smooth 60fps (currently janky with 10k+ rows)
- **Chart re-render:** Single debounced render per interaction (currently N renders)
- **Memory:** No increase (virtual scroll reduces DOM memory)
- **Backward compatibility:** All existing dashboards work unchanged
