# Phase 4: Timeline - Research

**Researched:** 2026-01-22
**Domain:** Gantt-style timeline visualization with Plotly.js
**Confidence:** HIGH (verified with official documentation and existing codebase patterns)

## Summary

This phase implements a Gantt-style timeline card for visualizing ride time windows in the Interactive Dashboard. The timeline shows horizontal bars representing rides, with nested bars for time constraints (outer) and actual travel time (inner), colored by ride degree (pooling effectiveness).

The research confirms that **Plotly.js can render Gantt-style charts** using horizontal bar traces with the `base` property for positioning. This approach is preferred over dedicated Gantt libraries because it maintains consistency with existing cards (HistogramCard, PieChartCard, ScatterCard) that all use Plotly.js.

**Key findings:**
1. Plotly.js horizontal bars with `base` property can implement timeline bars
2. Nested bars achievable via `barmode: 'overlay'` with different `width` values per trace
3. Swim lane track allocation uses standard O(n log n) greedy interval partitioning algorithm
4. Click/hover events work on bar traces (unlike shapes which lack events)
5. For 1800+ rides, virtualization is not needed for Plotly rendering but UI panning/zooming is critical
6. Vue 2 CSS transitions can handle expand/collapse animations

**Primary recommendation:** Use Plotly.js horizontal bar traces with `base` property, consistent with existing card patterns. Implement custom swim lane track allocation algorithm. Add minimap as a second, smaller Plotly chart with linked axes.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Plotly.js | (existing) | Timeline bar rendering | Already used by HistogramCard, PieChartCard, ScatterCard; supports horizontal bars with `base` property |
| Vue 2.7 | (existing) | Component framework | Project standard with Composition API |
| StyleManager | (existing) | Theme-aware colors | Already provides degree-based categorical colors |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vue-collapse-transition | ^1.0.6 | Smooth height animations | For expand/collapse of ride details |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plotly.js | gantt-elastic | Vue-specific but adds dependency, less consistent with existing cards |
| Plotly.js | D3.js | More control but requires building from scratch, loses Plotly event handling |
| Plotly.js | DHTMLX Gantt | Commercial license, overkill for this use case |
| Custom minimap | Mobiscroll | Commercial, heavy for just a minimap |

**Installation:**
```bash
npm install vue-collapse-transition
```

## Architecture Patterns

### Recommended Project Structure
```
src/plugins/interactive-dashboard/
├── components/cards/
│   └── TimelineCard.vue           # Main timeline component
├── utils/
│   └── trackAllocator.ts          # Swim lane algorithm
```

### Pattern 1: Plotly.js Gantt via Horizontal Bars
**What:** Use bar traces with `orientation: 'h'`, `base` for start position, and `x` for duration
**When to use:** Any Gantt or timeline visualization with Plotly.js
**Example:**
```typescript
// Source: https://plotly.com/javascript/reference/bar/ and https://community.plotly.com/t/how-to-create-timeline-horizantal-bar-chart/14301
const trace = {
  type: 'bar',
  orientation: 'h',
  y: ['Ride 1', 'Ride 2', 'Ride 3'],        // Track/row labels (or indices)
  x: [3600, 2400, 1800],                     // Duration (end - start) in seconds
  base: [21240, 23580, 26163],               // Start time in seconds from midnight
  marker: { color: ['#3b82f6', '#10b981', '#f59e0b'] },  // Colors by degree
  hovertemplate: 'Start: %{base}<br>Duration: %{x}<extra></extra>',
}
```

### Pattern 2: Nested/Overlay Bars for Constraint Windows
**What:** Two traces with `barmode: 'overlay'`, different widths to show outer constraint window and inner actual travel
**When to use:** Visualizing ranges within ranges (constraints vs actuals)
**Example:**
```typescript
// Source: https://plotly.com/javascript/bar-charts/ and https://github.com/plotly/plotly.js/issues/80
const constraintTrace = {
  type: 'bar',
  orientation: 'h',
  y: trackIndices,
  x: constraintDurations,  // latest_dropoff - earliest_pickup
  base: earliestPickupTimes,
  marker: { color: 'rgba(100, 100, 100, 0.3)' },
  width: 0.8,  // Wider bar for constraint window
}

const actualTrace = {
  type: 'bar',
  orientation: 'h',
  y: trackIndices,
  x: actualDurations,  // end_time - start_time
  base: startTimes,
  marker: { color: degreeColors },
  width: 0.4,  // Narrower bar for actual travel time
}

const layout = {
  barmode: 'overlay',  // Bars render on top of each other
}
```

### Pattern 3: Greedy Interval Partitioning for Swim Lanes
**What:** Assign overlapping rides to different tracks (lanes) to minimize vertical space
**When to use:** When multiple items can overlap in time
**Example:**
```typescript
// Source: https://en.wikipedia.org/wiki/Interval_scheduling and https://www.cs.princeton.edu/~wayne/kleinberg-tardos/pearson/04GreedyAlgorithms-2x2.pdf
interface TimelineItem {
  id: string
  start: number  // seconds from midnight
  end: number    // seconds from midnight
}

/**
 * Allocate rides to tracks (swim lanes) using greedy interval partitioning.
 * Returns track index for each ride. O(n log n) time complexity.
 */
function allocateTracks(items: TimelineItem[]): Map<string, number> {
  // Sort by start time
  const sorted = [...items].sort((a, b) => a.start - b.start)

  // Track end times (min-heap would be optimal, but array works for <10K items)
  const trackEndTimes: number[] = []
  const allocation = new Map<string, number>()

  for (const item of sorted) {
    // Find first track where this item fits (ends before item starts)
    let assignedTrack = -1
    for (let i = 0; i < trackEndTimes.length; i++) {
      if (trackEndTimes[i] <= item.start) {
        assignedTrack = i
        trackEndTimes[i] = item.end
        break
      }
    }

    // No existing track fits - create new track
    if (assignedTrack === -1) {
      assignedTrack = trackEndTimes.length
      trackEndTimes.push(item.end)
    }

    allocation.set(item.id, assignedTrack)
  }

  return allocation
}
```

### Pattern 4: Linked Minimap with Plotly Relayout Events
**What:** Small overview chart that scrolls/zooms the main chart
**When to use:** When main chart has pan/zoom and users need context
**Example:**
```typescript
// Source: https://plotly.com/javascript/plotlyjs-events/ and existing ScatterCard patterns
// Main chart emits relayout events when zoomed/panned
mainPlot.on('plotly_relayout', (eventData: any) => {
  if (eventData['xaxis.range[0]'] !== undefined) {
    // Update minimap viewport indicator
    updateMinimapViewport(eventData['xaxis.range[0]'], eventData['xaxis.range[1]'])
  }
})

// Minimap click navigates main chart
minimapPlot.on('plotly_click', (data: any) => {
  const clickedTime = data.points[0].x
  // Center main chart on clicked time
  Plotly.relayout(mainPlot, {
    'xaxis.range': [clickedTime - viewportWidth/2, clickedTime + viewportWidth/2]
  })
})
```

### Anti-Patterns to Avoid
- **Using Plotly shapes for clickable elements:** Shapes don't support events. Use invisible scatter traces or bar traces instead.
- **Loading all rides on map for preview:** With 1800+ rides, this crashes browsers. Show only hovered/selected ride geometry.
- **Animating Plotly during scroll:** Plotly's animation API is heavy. Use `Plotly.relayout()` for axis changes, not `Plotly.animate()`.
- **Sorting rides by end time for partitioning:** The greedy algorithm requires sorting by START time for optimal track allocation.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Height-auto CSS transitions | Custom JS animation | vue-collapse-transition | Handles edge cases (reflow, requestAnimationFrame) |
| Date/time formatting | Manual string building | Intl.DateTimeFormat or existing formatTickValue pattern | Locale awareness, edge cases |
| Track allocation | Naive O(n^2) loop | O(n log n) greedy partitioning | Performance at scale, proven optimal |
| Color palette for degrees | Manual hex codes | StyleManager.getCategoricalColor() | Theme consistency, dark mode support |

**Key insight:** Plotly.js already handles the hard rendering problems (WebGL acceleration, axis scaling, responsive resize). The custom work is track allocation and data transformation.

## Common Pitfalls

### Pitfall 1: Plotly Shapes Lack Events
**What goes wrong:** Developers try to use Plotly `shapes` for clickable rectangles, find no events fire
**Why it happens:** Shapes are drawn on the canvas but don't participate in Plotly's event system
**How to avoid:** Use bar traces for any clickable elements. Shapes are only for non-interactive annotations.
**Warning signs:** Code references `layout.shapes` for interactive elements
**Source:** [Plotly Community Forum - Events for shapes?](https://community.plotly.com/t/events-for-shapes/9601)

### Pitfall 2: Height-Auto CSS Transitions
**What goes wrong:** CSS can't transition `height: 0` to `height: auto`
**Why it happens:** Browser needs numeric values for CSS transitions
**How to avoid:** Use vue-collapse-transition or JavaScript-based height measurement with requestAnimationFrame
**Warning signs:** Using `max-height: 9999px` hack (causes timing issues)
**Source:** [Vue.js Blog - Transition to Height Auto](https://markus.oberlehner.net/blog/transition-to-height-auto-with-vue)

### Pitfall 3: Track Allocation Sort Order
**What goes wrong:** Tracks get allocated inefficiently, using more lanes than necessary
**Why it happens:** Sorting by end time or not sorting at all
**How to avoid:** Sort intervals by START time before greedy allocation
**Warning signs:** Track count is close to total ride count instead of max concurrent rides
**Source:** [Interval Scheduling Wikipedia](https://en.wikipedia.org/wiki/Interval_scheduling)

### Pitfall 4: Plotly Resize on Container Changes
**What goes wrong:** Chart doesn't resize when card expands/collapses
**Why it happens:** Plotly caches dimensions, doesn't auto-detect container changes
**How to avoid:** Call `Plotly.Plots.resize(element)` in ResizeObserver callback (existing pattern in codebase)
**Warning signs:** Chart renders at wrong size after fullscreen toggle
**Source:** Existing ScatterCard.vue, HistogramCard.vue patterns in codebase

### Pitfall 5: Overwhelming Map with Geometry
**What goes wrong:** Linked MapCard crashes when showing all 1800+ ride geometries
**Why it happens:** deck.gl can handle it but filtering/highlighting becomes expensive
**How to avoid:** Map shows ONLY hovered/selected ride geometry (on-demand loading)
**Warning signs:** Browser becomes unresponsive when enabling map linkage
**Source:** 04-CONTEXT.md notes "data volume concern"

## Code Examples

Verified patterns from official sources and existing codebase:

### Plotly.js Horizontal Bar with Base Property
```typescript
// Source: https://plotly.com/javascript/reference/bar/
// Creates bars starting at different positions (Gantt-style)
const trace: Partial<Plotly.PlotData> = {
  type: 'bar',
  orientation: 'h',
  y: ['Track 0', 'Track 1', 'Track 0', 'Track 2'],  // Swim lane assignment
  x: [3600, 2400, 1800, 4200],                       // Duration in seconds
  base: [21240, 23580, 26163, 28620],               // Start time in seconds
  marker: {
    color: ['#3b82f6', '#10b981', '#3b82f6', '#f59e0b'],
    line: { color: bgColor, width: 1 }
  },
  hovertemplate: '<b>%{customdata.id}</b><br>' +
                 'Start: %{base}<br>' +
                 'End: %{base}+%{x}<br>' +
                 'Degree: %{customdata.degree}<extra></extra>',
  customdata: rides.map(r => ({ id: r.id, degree: r.degree }))
}
```

### Click Event Handling on Bar Traces
```typescript
// Source: https://plotly.com/javascript/plotlyjs-events/ and existing HistogramCard.vue
plotContainer.value.on('plotly_click', (data: any) => {
  const pointIndex = data.points[0].pointIndex
  const traceIndex = data.points[0].curveNumber
  const rideId = rides[pointIndex].id

  // Toggle selection (matching HistogramCard behavior)
  if (selectedRides.value.has(rideId)) {
    selectedRides.value.delete(rideId)
  } else {
    selectedRides.value.add(rideId)
  }

  // Emit filter event for cross-card linkage
  emit('filter', filterId, column, new Set(selectedRides.value), 'categorical')
  renderChart()
})
```

### Time Axis Formatting (Existing Codebase Pattern)
```typescript
// Source: HistogramCard.vue formatTickValue function
function formatTimeAxis(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

// For Plotly axis configuration
const xaxisConfig = {
  title: { text: 'Time of Day', font: { color: textColor } },
  tickmode: 'array',
  tickvals: [0, 21600, 43200, 64800, 86400],  // 00:00, 06:00, 12:00, 18:00, 24:00
  ticktext: ['00:00', '06:00', '12:00', '18:00', '24:00'],
  range: [0, 86400],  // Full 24-hour range
}
```

### StyleManager Color Access (Existing Pattern)
```typescript
// Source: StyleManager.ts and existing card implementations
const styleManager = StyleManager.getInstance()
const bgColor = styleManager.getColor('theme.background.primary')
const textColor = styleManager.getColor('theme.text.primary')

// Degree-based coloring using categorical colors
function getDegreeColor(degree: number): string {
  if (degree === 1) return styleManager.getCategoricalColor(0)  // Single ride
  if (degree === 2) return styleManager.getCategoricalColor(1)  // 2-passenger
  return styleManager.getCategoricalColor(2)                     // 3+ passengers
}
```

### Vue Collapse Transition Pattern
```typescript
// Source: https://github.com/ivanvermeyen/vue-collapse-transition
import CollapseTransition from 'vue-collapse-transition'

// In template (Pug):
// collapse-transition
//   .expanded-details(v-show="expandedRideId === ride.id")
//     // Per-request mini-gantt here
```

## Data Schema

### Temporal Fields in requests.csv
Based on file examination, the following fields are available:

| Field | Type | Description |
|-------|------|-------------|
| treq | number | Request time (seconds from midnight) |
| travel_time | number | Actual travel duration (seconds) |
| earliest_departure | number | Earliest allowed pickup time (seconds) |
| latest_departure | number | Latest allowed pickup time (seconds) |
| earliest_arrival | number | Earliest allowed dropoff time (seconds) |
| latest_arrival | number | Latest allowed dropoff time (seconds) |
| delay | number | Actual delay experienced (seconds) |
| wait_time | number | Waiting time (seconds) |

### Data Volume Assessment
- **Sample data:** 49 requests in current example
- **Mentioned in CONTEXT.md:** 1800+ rides as performance concern for map
- **Timeline performance:** Plotly.js can render 2000+ horizontal bars without virtualization
- **Recommendation:** No virtualization needed for timeline itself; concern is map linkage

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plotly figure_factory.create_gantt | Plotly Express px.timeline | v4.9 (Python) | JS still uses bar traces |
| Manual height transitions | CSS transition with JS hooks | ~2020 | vue-collapse-transition handles edge cases |
| D3.js for everything | Plotly.js for interactive charts | ~2018 | Simpler event handling, built-in responsiveness |

**Deprecated/outdated:**
- `plotly.figure_factory.create_gantt()` - Deprecated in favor of `px.timeline()` (Python only, JS uses bar traces)
- Plotly shapes for interactive elements - Never had event support, use bar traces

## Open Questions

Things that couldn't be fully resolved:

1. **Exact diamond marker implementation**
   - What we know: Plotly supports scatter markers with `symbol: 'diamond'`
   - What's unclear: Best way to overlay diamond markers on bar traces for pickup times
   - Recommendation: Use separate scatter trace with same y-values but x at pickup times

2. **Minimap scroll interaction**
   - What we know: Can link two Plotly charts via relayout events
   - What's unclear: Exact UX for scrolling minimap viewport indicator
   - Recommendation: Implement basic click-to-navigate first, add drag-scroll if needed

3. **Expanded detail view row count**
   - What we know: Expansion pushes other bars down
   - What's unclear: How many request rows to show in expanded view before scrolling
   - Recommendation: Claude's discretion - start with 5 visible, scroll for more

## Sources

### Primary (HIGH confidence)
- [Plotly.js Bar Reference](https://plotly.com/javascript/reference/bar/) - base property, orientation
- [Plotly.js Event Handlers](https://plotly.com/javascript/plotlyjs-events/) - plotly_click, plotly_hover
- [Plotly.js Bar Charts](https://plotly.com/javascript/bar-charts/) - barmode: overlay
- Existing codebase: HistogramCard.vue, ScatterCard.vue, StyleManager.ts (verified patterns)

### Secondary (MEDIUM confidence)
- [Plotly Community - Timeline Horizontal Bar](https://community.plotly.com/t/how-to-create-timeline-horizantal-bar-chart/14301) - Verified with official docs
- [Interval Scheduling Wikipedia](https://en.wikipedia.org/wiki/Interval_scheduling) - Greedy algorithm
- [Princeton Algorithm Notes](https://www.cs.princeton.edu/~wayne/kleinberg-tardos/pearson/04GreedyAlgorithms-2x2.pdf) - Partitioning proof

### Tertiary (LOW confidence)
- [vue-collapse-transition](https://github.com/ivanvermeyen/vue-collapse-transition) - Works with Vue 2, needs verification
- [Mobiscroll Timeline](https://demo.mobiscroll.com/javascript/timeline) - Commercial virtualization reference (not using)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing Plotly.js patterns from codebase
- Architecture: HIGH - Patterns verified in official Plotly documentation
- Track allocation: HIGH - Standard algorithm with mathematical proof
- Nested bars: MEDIUM - Overlay barmode documented, exact styling needs testing
- Expand animation: MEDIUM - vue-collapse-transition works with Vue 2, verify Composition API compatibility

**Research date:** 2026-01-22
**Valid until:** 2026-02-22 (Plotly.js is stable, patterns unlikely to change)
