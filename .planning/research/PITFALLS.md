# Domain Pitfalls: SimWrapper Interactive Dashboard Enhancements

**Project:** SimWrapper Interactive Dashboard - Styling and Analysis Features
**Researched:** 2026-01-20
**Confidence:** MEDIUM-HIGH (codebase analysis + web research verified)

---

## Critical Pitfalls

Mistakes that cause significant rework or architectural problems.

---

### Pitfall 1: Theming Migration Without Centralized Color Registry

**What goes wrong:**
Starting to refactor hardcoded colors without first creating a centralized color system leads to inconsistent results and incomplete migration. Developers replace colors one-by-one, missing colors in computed properties, inline styles, and external libraries (Plotly, deck.gl), resulting in a "half-themed" application that looks broken in one or both modes.

**Evidence from SimWrapper codebase:**
- 1,034 hardcoded hex color occurrences across 152 files
- Colors exist in multiple contexts: CSS `<style>` blocks, TypeScript computed properties, deck.gl layer factories, Plotly chart configs
- `colorSchemes.ts` exists but isn't used consistently across components
- MapCard.vue alone has 24 hex color references
- Dark mode state (`isDarkMode`) accessed inconsistently via different patterns

**Why it happens:**
- "Just fix what I see" approach instead of systematic audit
- Different contexts require different refactoring techniques (CSS variables vs. JS theme tokens)
- Deck.gl colors are RGBA arrays [r,g,b,a], not CSS-compatible
- Third-party libs (Plotly) have their own theming APIs

**Consequences:**
- Visual inconsistency between components
- Dark mode renders partially light, light mode renders partially dark
- Technical debt compounds (future features inherit inconsistent patterns)
- Maintenance burden increases (bugs in one theme not visible in the other)

**Warning signs:**
- Colors changing in some components but not others after toggle
- New components using different color patterns than existing ones
- Theme toggle not affecting chart backgrounds or map layers
- Inconsistent hover/selected state colors across card types

**Prevention:**

1. **Phase 1: Create Color Registry First**
   ```typescript
   // src/theme/colors.ts
   export const colors = {
     interaction: {
       hover: { css: '#fb923c', rgb: [251, 146, 60] as const },
       selected: { css: '#3b82f6', rgb: [59, 130, 246] as const },
       filtered: { css: '#b4b4b4', rgb: [180, 180, 180] as const },
     },
     // ... semantic categories
   }
   ```

2. **Phase 2: Audit all color usage patterns**
   - CSS styles (use CSS variables)
   - TypeScript constants (use registry)
   - Plotly configs (use theme helper function)
   - Deck.gl layers (use RGB array from registry)

3. **Phase 3: Migrate in waves by context type, not by component**
   - All CSS first, then all TypeScript, then all library configs

**Phase mapping:** Address in dedicated "Theming Foundation" phase before any styling work.

---

### Pitfall 2: Dual-Map Synchronization via Polling Instead of Events

**What goes wrong:**
Implementing map synchronization by polling camera state or setting up bidirectional watchers creates infinite update loops, janky animations, or race conditions. Maps either fight each other during pan/zoom or one map lags noticeably behind.

**Evidence from research:**
- MapLibre provides `syncMove` event pattern via plugin `@mapbox/mapbox-gl-sync-move`
- Deck.gl documentation explicitly warns about multi-map limitations: "There is only one MapView that can synchronize with the base map"
- Browsers limit WebGL contexts (typically 8-16), making multiple deck.gl instances risky

**SimWrapper context:**
- Current viewState management is through Vuex store mutations
- No existing dual-map coordination mechanism
- MapCard creates separate maplibregl.Map instances per card

**Why it happens:**
- Naive implementation: "just watch map1 and update map2"
- Deck.gl + MapLibre integration complexity not understood upfront
- Memory/context limits not considered

**Consequences:**
- Infinite loops where map1 updates map2 updates map1
- Stuttering during synchronized pan/zoom
- Memory leaks from multiple WebGL contexts
- Browser crashes with too many map instances

**Warning signs:**
- Console shows rapid state updates during map interaction
- CPU spikes when interacting with one map
- Maps drift slightly out of sync
- Application slows after opening multiple tabs with maps

**Prevention:**

1. **Use single-leader pattern:** One map is "leader," others follow
   ```typescript
   // Leader map emits events
   leaderMap.on('move', (e) => {
     followerMaps.forEach(map => {
       if (map !== e.target) {
         map.jumpTo(leaderMap.getCenter(), { animate: false })
       }
     })
   })
   ```

2. **Consider deck.gl multi-view over multiple instances:**
   ```typescript
   // Single deck instance, multiple views
   new Deck({
     views: [
       new MapView({ id: 'main', controller: true }),
       new MapView({ id: 'comparison', controller: false }),
     ],
   })
   ```

3. **Debounce/throttle sync events** to prevent cascading updates

4. **Track WebGL context count** and warn user before creating too many maps

**Phase mapping:** Deep research required before "Comparison Mode" or "Side-by-Side" features.

---

### Pitfall 3: Correlation Matrix Performance with O(n^2) Attribute Combinations

**What goes wrong:**
With 70+ attributes available for correlation analysis, computing and rendering an n*n matrix (4,900 cells) on every data change causes UI freeze. Users experience multi-second delays when switching datasets or applying filters.

**Evidence from research:**
- SVG-based heatmaps struggle with >1000 cells
- Canvas-based rendering performs better but loses interactivity
- Correlation computation itself is O(n * m^2) where n=rows, m=attributes

**SimWrapper context:**
- ScatterCard already uses Plotly (SVG-based)
- Data updates trigger full chart re-renders via watchers
- 70+ attributes mentioned in project context
- FilterManager notifies all observers synchronously

**Why it happens:**
- "It works with 10 attributes" doesn't scale to 70
- Re-computing correlations on every filter change
- Rendering full matrix instead of visible portion

**Consequences:**
- 2-5 second freeze on filter change
- Browser "page unresponsive" warnings
- Users avoid using feature
- Workarounds (limiting attributes) reduce usefulness

**Warning signs:**
- UI freezes when selecting correlation view
- Filter changes take longer with correlation card visible
- Memory usage spikes with correlation matrix open
- Performance varies dramatically based on attribute count

**Prevention:**

1. **Compute correlations in Web Worker:**
   ```typescript
   // Move heavy computation off main thread
   correlationWorker.postMessage({ data, attributes })
   correlationWorker.onmessage = (result) => updateMatrix(result)
   ```

2. **Implement progressive/lazy computation:**
   - Compute visible cells first
   - Compute off-screen cells on scroll
   - Cache computed correlations until data changes

3. **Limit default attribute count with user expansion:**
   ```yaml
   correlation:
     defaultAttributes: 10  # Show top 10 by variance
     maxAttributes: 30      # User can expand up to 30
   ```

4. **Use canvas rendering for large matrices:**
   - D3 + canvas for cells
   - SVG overlay for interactivity (tooltips, selection)

5. **Debounce data changes for correlation updates:**
   - Don't recompute on every hover
   - Recompute only on filter commit

**Phase mapping:** Address during "Analysis Visualizations" phase. Research phase should determine feasible attribute limits.

---

### Pitfall 4: CSS Containment Blocking Card Enlargement/Fullscreen

**What goes wrong:**
SubDashboard.vue uses `contain: layout` CSS property to improve performance and isolate nested dashboards. However, this creates a containing block that prevents child cards from using `position: fixed` for fullscreen mode or enlarging beyond their container bounds.

**Evidence from SimWrapper codebase:**
```css
// SubDashboard.vue:165
.sub-dashboard-wrapper {
  contain: layout;
  position: relative;
}
```

```css
// DataTableCard.vue:410-415
.fullscreen {
  position: fixed;  // Won't work inside contain: layout parent
  top: 0;
  z-index: 9999;
}
```

**Why it happens:**
- `contain: layout` was added for performance/isolation
- Impact on `position: fixed` not understood
- Cards designed for top-level dashboard, not nested context

**Consequences:**
- Fullscreen button does nothing in sub-dashboards
- Enlarged cards clipped to sub-dashboard bounds
- Confusing UX (button works in some contexts, not others)
- Users report feature "broken"

**Warning signs:**
- Fullscreen works in main dashboard, fails in sub-dashboard
- Card expands but is partially hidden
- Z-index battles where expanded content appears behind other elements

**Prevention:**

1. **Use portal pattern for fullscreen content:**
   ```typescript
   // Teleport to document body for true fullscreen
   <teleport to="body" v-if="isFullscreen">
     <div class="fullscreen-overlay">
       <CardContent />
     </div>
   </teleport>
   ```

2. **Audit containment hierarchy before adding new modes:**
   ```javascript
   // Helper to check containment
   function canUseFixedPosition(element) {
     let parent = element.parentElement
     while (parent) {
       const style = getComputedStyle(parent)
       if (style.contain.includes('layout') ||
           style.transform !== 'none') {
         console.warn('Fixed position will be relative to:', parent)
         return false
       }
       parent = parent.parentElement
     }
     return true
   }
   ```

3. **Document containment context in card props:**
   ```typescript
   interface CardProps {
     nestedLevel: number  // 0 = top-level, 1 = sub-dashboard
     canFullscreen: boolean  // Computed based on containment
   }
   ```

4. **Consider removing `contain: layout` or using `contain: paint` only:**
   - `contain: paint` clips but doesn't affect positioning

**Phase mapping:** Must address before any card enlargement or modal features in sub-dashboards.

---

## Moderate Pitfalls

Mistakes that cause delays, rework, or significant technical debt.

---

### Pitfall 5: Graph/Network Visualization DOM Conflicts with Vue Reactivity

**What goes wrong:**
D3.js and similar libraries manipulate the DOM directly, conflicting with Vue's virtual DOM reconciliation. Adding a D3-based network graph causes mysterious re-renders, lost interactivity, or elements appearing/disappearing unexpectedly.

**Evidence from research:**
- "D3.js direct access to the DOM may introduce compatibility issues when integrated with modern front-end frameworks like React or Vue"
- Existing Plotly integration in ScatterCard/HistogramCard uses similar approach but is isolated

**SimWrapper context:**
- Vue 2.7 uses virtual DOM
- Existing charts use Plotly (has Vue wrapper patterns)
- No current D3 direct DOM manipulation in interactive-dashboard

**Why it happens:**
- D3 selects elements and modifies them directly
- Vue re-renders and overwrites D3's changes
- Event handlers attached by D3 get lost on Vue update

**Consequences:**
- Graph interactivity works initially, breaks after Vue re-render
- Zoom/pan state resets unexpectedly
- Click handlers stop working
- Memory leaks from orphaned event listeners

**Prevention:**

1. **Isolate D3 rendering in dedicated canvas/SVG element:**
   ```vue
   <template>
     <div ref="container">
       <!-- Vue owns this div -->
       <svg ref="d3Container" />
       <!-- D3 owns everything inside svg -->
     </div>
   </template>
   ```

2. **Use refs, not selectors:**
   ```typescript
   // BAD: D3 selects from document
   d3.select('#my-graph')

   // GOOD: Use Vue ref
   const svg = d3.select(this.$refs.d3Container)
   ```

3. **Manage D3 lifecycle explicitly:**
   ```typescript
   onMounted(() => {
     initializeGraph()
   })

   onBeforeUnmount(() => {
     cleanupGraph()  // Remove event listeners, etc.
   })

   watch(data, () => {
     updateGraphData()  // Don't recreate, update
   })
   ```

4. **Consider vis.js or other canvas-based alternatives:**
   - Less DOM conflict than SVG-based D3
   - vis-network specifically designed for graphs

**Phase mapping:** Establish integration pattern in research phase before "Graph Visualization" feature.

---

### Pitfall 6: Timeline Scrubbing Without Data Windowing

**What goes wrong:**
Implementing timeline visualization by loading all temporal data upfront and rendering all points causes memory exhaustion and sluggish scrubbing. Dragging the timeline scrubber triggers expensive re-renders of the entire dataset.

**Evidence from research:**
- "TimelineJS recommends not having more than 20 slides"
- "Handling overlapping events - height of resource row increases to fit"
- vis-timeline supports lazy loading but requires explicit configuration

**SimWrapper context:**
- Transport simulations can have millions of timestamped events
- Vehicle animation already handles temporal data but uses different patterns
- No existing data windowing infrastructure in interactive-dashboard

**Why it happens:**
- "Load everything, filter in browser" works for small datasets
- Timeline scrubbing is high-frequency interaction (many events per second)
- No consideration for data volume during initial implementation

**Consequences:**
- Timeline scrubber stutters or freezes
- Browser runs out of memory with large simulations
- Only small datasets are usable
- Feature appears "broken" for real-world use cases

**Prevention:**

1. **Implement time-window data fetching:**
   ```typescript
   interface TimeWindowRequest {
     startTime: number
     endTime: number
     aggregationLevel: 'minute' | 'hour' | 'day'
   }

   async function fetchTimeWindow(request: TimeWindowRequest) {
     // Server returns only data in window
     // At coarser aggregations for overview
   }
   ```

2. **Pre-aggregate data at multiple temporal resolutions:**
   ```yaml
   # Store/compute aggregations
   trips_by_minute.csv  # Detail view
   trips_by_hour.csv    # Medium zoom
   trips_by_day.csv     # Overview
   ```

3. **Debounce scrubber interactions:**
   ```typescript
   const debouncedUpdateTimeline = useDebounceFn((time) => {
     updateVisualization(time)
   }, 50)  // Max 20 updates/second
   ```

4. **Use canvas instead of SVG for timeline elements:**
   - Individual events as canvas draws, not DOM elements

**Phase mapping:** Research data volume expectations before "Timeline Visualization" phase.

---

### Pitfall 7: Magic Numbers for Interaction States

**What goes wrong:**
Hover/selected/filtered states use hardcoded numeric values (line widths, opacities, size multipliers) scattered across components. When adjusting visual feedback, developers must find and update values in multiple files, often missing some occurrences.

**Evidence from SimWrapper codebase:**
```typescript
// MapCard.vue
if (isSelected) return 4           // Line width
if (isHovered) return 3            // Line width
if (isHovered) return baseWidth * 3    // Width multiplier
if (isSelected) return baseWidth * 2   // Width multiplier
if (isSelected) return baseRadius * 1.2 // Radius multiplier
// ... more scattered across getFeatureFillColor, getFeatureLineColor, etc.
```

**Similar patterns in:**
- HistogramCard.vue (bar opacity for selection)
- PieChartCard.vue (slice opacity)
- ScatterCard.vue (marker size adjustments)
- LinkedTableCard.vue (row background opacity)

**Why it happens:**
- Each component implemented interaction states independently
- No central "interaction design tokens" system
- "I'll just use 0.5 opacity here" approach

**Consequences:**
- Inconsistent interaction feedback across card types
- Changing interaction style requires multi-file changes
- Easy to miss one component when updating
- Visual language becomes inconsistent over time

**Prevention:**

1. **Create interaction state tokens:**
   ```typescript
   // src/theme/interactions.ts
   export const interactionTokens = {
     hover: {
       opacity: 0.8,
       lineWidthMultiplier: 1.5,
       radiusMultiplier: 1.3,
       fillOpacity: 0.6,
     },
     selected: {
       opacity: 1.0,
       lineWidthMultiplier: 2.0,
       radiusMultiplier: 1.5,
       fillOpacity: 0.8,
     },
     filtered: {
       opacity: 0.3,
       lineWidthMultiplier: 0.5,
     },
   }
   ```

2. **Create composable for interaction styling:**
   ```typescript
   function useInteractionStyle(state: 'hover' | 'selected' | 'filtered' | 'normal') {
     return computed(() => interactionTokens[state])
   }
   ```

3. **Apply as part of theming phase:**
   - Extract magic numbers alongside color extraction
   - Document interaction design system

**Phase mapping:** Address alongside "Theming Foundation" phase.

---

### Pitfall 8: Observer Memory Leaks in FilterManager

**What goes wrong:**
Components register as FilterManager observers on mount but fail to unregister on unmount. As users navigate between dashboard tabs or load different dashboards, orphaned observers accumulate, causing memory leaks and ghost updates to unmounted components.

**Evidence from SimWrapper codebase:**
```typescript
// FilterManager.ts uses observer pattern
// Cards call addObserver() but must call removeObserver() on unmount
```

**Similar patterns seen in:**
- LinkageManager.ts
- DataTableManager.ts

**Why it happens:**
- Vue 2 `beforeDestroy` hook sometimes not called (rapid navigation)
- Developers forget to add cleanup code
- No automated cleanup mechanism

**Consequences:**
- Memory usage grows over time
- Console errors about updating unmounted components
- Callbacks fire for components that no longer exist
- Performance degrades during extended sessions

**Prevention:**

1. **Use WeakMap or WeakRef for observers where possible:**
   ```typescript
   // WeakRef allows garbage collection of unmounted components
   private observers = new Set<WeakRef<Observer>>()

   addObserver(observer: Observer) {
     this.observers.add(new WeakRef(observer))
   }

   notify() {
     this.observers.forEach(ref => {
       const observer = ref.deref()
       if (observer) observer.update()
     })
   }
   ```

2. **Provide cleanup hook in manager:**
   ```typescript
   // Return unsubscribe function like RxJS
   function addObserver(callback) {
     observers.add(callback)
     return () => observers.delete(callback)  // Cleanup function
   }

   // In component
   const unsubscribe = filterManager.addObserver(handleChange)
   onBeforeUnmount(() => unsubscribe())
   ```

3. **Add observer count monitoring in development:**
   ```typescript
   if (process.env.NODE_ENV === 'development') {
     console.log(`FilterManager observers: ${observers.size}`)
   }
   ```

**Phase mapping:** Review during any phase that adds new observer relationships.

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

---

### Pitfall 9: Plotly Trace Updates Causing Full Re-renders

**What goes wrong:**
Updating chart data by replacing the entire `data` array causes Plotly to destroy and recreate the chart, losing zoom state, selection, and causing visible flicker.

**Evidence from SimWrapper codebase:**
```typescript
// ScatterCard.vue pattern
const scatterData = computed(() => {
  // Returns entirely new object on every change
  return { x: [], y: [], colors: [], ... }
})
```

**Why it happens:**
- Computed properties return new objects
- Plotly detects object identity change, assumes full update needed

**Prevention:**
- Use `Plotly.react()` for updates instead of recreating
- Use `Plotly.restyle()` for data-only changes
- Preserve trace references where possible

**Phase mapping:** Consider during any chart enhancement work.

---

### Pitfall 10: Missing Loading States for Async Operations

**What goes wrong:**
Correlation computation, data fetching, or layer loading happens asynchronously but the UI doesn't indicate loading state. Users click repeatedly, queue duplicate requests, or assume the feature is broken.

**Evidence from SimWrapper codebase:**
- MapCard.vue has loading state (`isLoading`) - good pattern
- Not consistently applied across all async operations

**Prevention:**
- Standard loading indicator component
- Request deduplication for data fetching
- Disable interaction during async operations

**Phase mapping:** Part of UX polish in each feature phase.

---

### Pitfall 11: Unbounded Legend Items for High-Cardinality Attributes

**What goes wrong:**
Coloring by an attribute with many unique values (e.g., zone_id with 500 zones) generates a legend with 500 items, breaking the layout and making the legend unusable.

**Evidence from research:**
- ColorLegend.vue renders all categorical items
- No limit on legend item count

**Prevention:**
- Limit legend items with "and N more..." text
- Use gradient legend for high-cardinality categoricals
- Allow legend collapsing/scrolling

**Phase mapping:** Address in "Styling Enhancements" phase.

---

## Phase-Specific Warning Matrix

| Phase Topic | Primary Pitfall Risk | Secondary Risks | Mitigation |
|------------|---------------------|-----------------|------------|
| Theming Foundation | #1 Incomplete migration | #7 Magic numbers | Audit first, registry second, migrate third |
| Comparison/Dual Maps | #2 Sync loops | #8 Observer leaks | Single-leader pattern, context limits |
| Correlation Analysis | #3 O(n^2) performance | #9 Plotly re-renders | Web Worker, attribute limits |
| Timeline Visualization | #6 Data volume | #10 Loading states | Time windowing, aggregation |
| Graph/Network | #5 DOM conflicts | #8 Observer leaks | Isolated rendering, cleanup hooks |
| Sub-dashboard Features | #4 CSS containment | #1 Theme inconsistency | Portal pattern for enlargement |

---

## Confidence Assessment

| Pitfall | Confidence | Basis |
|---------|------------|-------|
| #1 Theming migration | HIGH | Direct codebase evidence (1,034 colors, 152 files) |
| #2 Dual-map sync | HIGH | Official deck.gl docs + MapLibre examples |
| #3 Correlation performance | MEDIUM | Web research + codebase pattern analysis |
| #4 CSS containment | HIGH | Direct code evidence (SubDashboard.vue:165) |
| #5 D3/Vue conflicts | MEDIUM | General web research, pattern analysis |
| #6 Timeline data volume | MEDIUM | Domain knowledge + research |
| #7 Magic numbers | HIGH | Direct codebase evidence (MapCard.vue patterns) |
| #8 Observer leaks | MEDIUM | Pattern analysis, common Vue pitfall |
| #9-11 Minor | LOW-MEDIUM | General patterns |

---

## Sources

### Codebase Analysis
- `/mnt/Shared/Code/projects/Dissertation/simwrapper/src/plugins/interactive-dashboard/components/cards/MapCard.vue`
- `/mnt/Shared/Code/projects/Dissertation/simwrapper/src/plugins/interactive-dashboard/components/cards/SubDashboard.vue`
- `/mnt/Shared/Code/projects/Dissertation/simwrapper/src/store.ts`
- `/mnt/Shared/Code/projects/Dissertation/simwrapper/src/plugins/interactive-dashboard/utils/colorSchemes.ts`

### Web Research (with confidence markers)

**Theming/CSS:**
- [CSS contain property guide](https://design-code.tips/blog/2025-08-02-mastering-the-css-contain-property-a-performance-game-changer/) - MEDIUM
- [VueUse useDark](https://vueuse.org/core/usedark/) - HIGH
- [Vue 2 to Vue 3 Migration Guide](https://v3-migration.vuejs.org/) - HIGH

**Map Synchronization:**
- [deck.gl MapLibre Integration](https://deck.gl/docs/developer-guide/base-maps/using-with-maplibre) - HIGH
- [MapLibre Sync Movement Example](https://maplibre.org/maplibre-gl-js/docs/examples/sync-movement-of-multiple-maps/) - HIGH
- [deck.gl Multi-View Discussion](https://github.com/visgl/deck.gl/discussions/7412) - HIGH

**Performance:**
- [MapLibre Memory Leak Issues](https://github.com/maplibre/maplibre-gl-js/issues/4650) - HIGH
- [Correlogram with React](https://www.react-graph-gallery.com/correlogram) - MEDIUM
- [D3.js Graph Visualization](https://blog.tomsawyer.com/exploring-d3js-graph-visualization-from-graphs-to-maps) - MEDIUM

**Timeline:**
- [vis.js Timeline Documentation](https://visjs.github.io/vis-timeline/docs/timeline/) - HIGH
- [TimelineJS](https://timeline.knightlab.com/) - MEDIUM
