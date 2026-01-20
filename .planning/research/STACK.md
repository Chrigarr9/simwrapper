# Technology Stack Recommendations

**Project:** SimWrapper Interactive Dashboard Enhancements
**Researched:** 2026-01-20
**Overall Confidence:** HIGH (existing stack well-established, additions verified)

## Executive Summary

SimWrapper already has a mature Vue 2.7 + TypeScript + deck.gl stack with Plotly.js for charts and Vuex for state management. The recommended approach for new features leverages existing dependencies where possible, minimizing new libraries while maintaining consistency with the established architecture.

## Current Stack (Verified from package.json)

| Technology | Version | Purpose |
|------------|---------|---------|
| Vue | 2.7.16 | Component framework |
| TypeScript | ^4.2.0 | Type safety |
| Vuex | ^3.1.3 | State management |
| deck.gl | ^9.1.14 | WebGL visualization layers |
| MapLibre GL | ^5.6.2 | Base map rendering |
| Plotly.js | ^3.1.0 | Charting library |
| Vite | ^6.4.1 | Build tool |
| Bulma/Buefy | ^1.0.0/^0.9.29 | CSS framework |

---

## 1. Global Theming/Styling Configuration

### Recommendation: CSS Custom Properties + Vuex (Current Pattern)

**Confidence:** HIGH - Already implemented in codebase

SimWrapper already has a robust theming system that should be extended rather than replaced:

**Existing Pattern (from `src/styles.scss`):**
```scss
:root {
  --bg: #edebe4;
  --bgBold: #ffffff;
  --text: #363636;
  --link: #196096;
  // ... 50+ CSS variables
}

.dark-mode {
  --bg: #2d3133;
  --bgBold: #000414;
  // ... dark mode overrides
}
```

**Existing State Management (from `src/store.ts`):**
```typescript
state: {
  isDarkMode: true,
  colorScheme: ColorScheme.DarkMode,
}

mutations: {
  setTheme(state, value: string) {
    state.colorScheme = value == 'light' ? ColorScheme.LightMode : ColorScheme.DarkMode
    state.isDarkMode = state.colorScheme === ColorScheme.DarkMode
    document.body.style.backgroundColor = state.colorScheme === ColorScheme.LightMode ? '#edebe4' : '#2d3133'
  }
}
```

### Recommended Extension Pattern

For dashboard-level theming configuration (per-dashboard color schemes), extend the existing system:

**Option A: Extend CSS Variables (Recommended)**
```yaml
# dashboard.yaml
header:
  title: My Dashboard
  theme:
    primary: '#3b82f6'
    secondary: '#10b981'
    chartColors: ['#e74c3c', '#3498db', '#2ecc71']
```

**Implementation:**
- Add `--dashboard-primary`, `--dashboard-secondary` variables
- Apply via scoped style injection in InteractiveDashboard.vue
- No new dependencies required

**Option B: provide/inject (Vue 2.7 Composition API)**
```typescript
// In InteractiveDashboard.vue
import { provide, reactive } from 'vue'

const theme = reactive({
  primary: '#3b82f6',
  chartColors: ['#e74c3c', '#3498db']
})
provide('dashboardTheme', theme)

// In card components
const theme = inject('dashboardTheme')
```

### What NOT to Use

| Library | Why Not |
|---------|---------|
| Vuetify | Vue 3 focused, incompatible with Buefy/Bulma |
| Tailwind CSS | Would conflict with existing Bulma/SCSS architecture |
| CSS-in-JS (Emotion, styled-components) | Not idiomatic Vue, adds complexity |

---

## 2. Correlation Matrix Visualization

### Recommendation: Plotly.js Heatmap (Extend Existing)

**Confidence:** HIGH - Plotly.js already in codebase at v3.1.0

The project already uses Plotly.js extensively. A correlation matrix is a standard heatmap use case.

**Implementation Approach:**

```typescript
// CorrelationMatrixCard.vue - extend existing VuePlotly component
const trace = {
  type: 'heatmap',
  z: correlationMatrix,        // 2D array of correlation values
  x: columnNames,              // Column labels
  y: columnNames,              // Row labels
  colorscale: 'RdBu',          // Red-Blue diverging scale
  zmin: -1,
  zmax: 1,
  hoverongaps: false,
}

// Add annotations for cell values
const annotations = []
for (let i = 0; i < correlationMatrix.length; i++) {
  for (let j = 0; j < correlationMatrix[i].length; j++) {
    annotations.push({
      x: columnNames[j],
      y: columnNames[i],
      text: correlationMatrix[i][j].toFixed(2),
      font: { color: Math.abs(correlationMatrix[i][j]) > 0.5 ? 'white' : 'black' },
      showarrow: false,
    })
  }
}

const layout = {
  annotations,
  xaxis: { side: 'top' },
  yaxis: { autorange: 'reversed' },
}
```

**Correlation Calculation:**
Use existing `mathjs` dependency (v10.0.0 in package.json) for Pearson correlation:

```typescript
import { mean, std, sum, dotMultiply, subtract, divide } from 'mathjs'

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length
  const xMean = mean(x)
  const yMean = mean(y)
  const xStd = std(x)
  const yStd = std(y)

  const covariance = sum(dotMultiply(
    subtract(x, xMean),
    subtract(y, yMean)
  )) / n

  return covariance / (xStd * yStd)
}
```

### Alternatives Considered

| Library | Verdict | Reason |
|---------|---------|--------|
| D3.js | NOT RECOMMENDED | Would add complexity; Plotly already handles heatmaps well |
| Chart.js | NOT RECOMMENDED | Not in codebase; weaker heatmap support than Plotly |
| ECharts | NOT RECOMMENDED | Would be a parallel charting system; redundant |
| Danfo.js | OPTIONAL | Only if heavy dataframe operations needed beyond mathjs |

---

## 3. Synchronized Dual-Map Views

### Recommendation: deck.gl Multi-View System

**Confidence:** MEDIUM - deck.gl supports this but requires careful MapboxOverlay handling

deck.gl natively supports multiple synchronized views, but there are constraints when using MapboxOverlay with MapLibre.

**Approach 1: Side-by-Side deck.gl Views (Preferred)**

```typescript
import { Deck, MapView } from '@deck.gl/core'

const deck = new Deck({
  views: [
    new MapView({
      id: 'left',
      x: '0%',
      width: '50%',
      controller: true,
    }),
    new MapView({
      id: 'right',
      x: '50%',
      width: '50%',
      controller: true,
    }),
  ],
  viewState: {
    // Shared viewState synchronizes both maps
    longitude: -122.4,
    latitude: 37.8,
    zoom: 11,
    pitch: 0,
    bearing: 0,
  },
  layers: [
    // Layers can target specific views
    new GeoJsonLayer({
      id: 'layer-1',
      // ...
    }),
  ],
})
```

**Approach 2: Two MapLibre Instances with Manual Sync**

```typescript
// For cases where MapboxOverlay limitations apply
const map1 = new maplibregl.Map({ container: 'map1', ... })
const map2 = new maplibregl.Map({ container: 'map2', ... })

// Sync camera movements
function syncMaps(source: maplibregl.Map, target: maplibregl.Map) {
  ['move', 'zoom', 'rotate', 'pitch'].forEach(event => {
    source.on(event, () => {
      target.jumpTo({
        center: source.getCenter(),
        zoom: source.getZoom(),
        bearing: source.getBearing(),
        pitch: source.getPitch(),
      })
    })
  })
}
```

**Key Constraints (from deck.gl docs):**
- WebGL context limit: Browser/hardware limits how many contexts can exist
- MapboxOverlay: Only supports single MapView synchronized with base map
- For dual maps, may need two separate MapLibre+deck instances

### YAML Configuration Pattern

```yaml
# DualMapCard
type: dual-map
layout: side-by-side  # or 'overlay', 'split-slider'
sync: true            # Synchronize camera movements
maps:
  left:
    title: "Baseline"
    layers:
      - name: zones
        file: zones_baseline.geojson
  right:
    title: "Scenario"
    layers:
      - name: zones
        file: zones_scenario.geojson
```

### What NOT to Use

| Approach | Why Not |
|----------|---------|
| Leaflet | Already using MapLibre/deck.gl; would be redundant |
| OpenLayers | Same as above |
| iframe embedding | Poor performance, no proper state sync |

---

## 4. Timeline Visualization

### Recommendation: Plotly.js Timeline Traces OR vis-timeline

**Confidence:** HIGH for Plotly approach, MEDIUM for vis-timeline

**Option A: Plotly.js (Recommended - Already Available)**

Plotly supports multiple timeline-style visualizations:

```typescript
// Gantt-style timeline with bar chart
const trace = {
  type: 'bar',
  orientation: 'h',
  x: durations,        // Duration of each event
  y: categories,       // Event categories/labels
  base: startTimes,    // Start time offset
  marker: { color: colors },
  hovertemplate: '%{y}: %{base} - %{x}<extra></extra>',
}

// Range slider for time window
const layout = {
  xaxis: {
    type: 'date',
    rangeslider: { visible: true },
    rangeselector: {
      buttons: [
        { count: 1, label: '1h', step: 'hour' },
        { count: 6, label: '6h', step: 'hour' },
        { count: 1, label: '1d', step: 'day' },
        { step: 'all' },
      ],
    },
  },
}
```

**Option B: vis-timeline (For Complex Scheduling UI)**

Only if Plotly is insufficient for complex timeline interactions:

| Package | Version | Vue 2 Support |
|---------|---------|---------------|
| vis-timeline | ^7.7.3 | Yes |
| @vue2vis/timeline | ^1.0.x | Yes (wrapper) |

```bash
npm install vis-timeline @vue2vis/timeline vis-data moment
```

**Note:** vis-timeline adds ~150KB gzipped. Use only if:
- Need drag-and-drop event editing
- Need nested groups/subgroups
- Need complex time range selection beyond rangeslider

### Integration Pattern for Time-Window Data

```yaml
# TimelineCard configuration
type: timeline
timeColumn: timestamp        # Column with time data
categoryColumn: event_type   # Grouping column
durationColumn: duration     # Optional: for range events
timeFormat: seconds_from_midnight
```

```typescript
// Convert seconds-from-midnight to time display
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}
```

---

## 5. Graph/Network Visualization

### Recommendation: Cytoscape.js with vue-cytoscape Wrapper

**Confidence:** HIGH - Industry standard for graph viz in browsers

**Primary Choice:**

| Package | Version | Purpose |
|---------|---------|---------|
| cytoscape | ^3.30.x | Core graph library |
| vue-cytoscape | ^1.0.x | Vue 2 wrapper |

```bash
npm install vue-cytoscape
# Note: cytoscape is included as dependency
```

**Why Cytoscape.js:**
- MIT licensed
- Excellent performance (tested to 10k nodes)
- Built-in layout algorithms (force-directed, hierarchical, circular)
- Rich styling via CSS-like selectors
- Well-maintained with Oxford Bioinformatics backing
- Good Vue 2 wrapper available

**Implementation Pattern:**

```vue
<template lang="pug">
.graph-card
  cytoscape(
    ref="cy"
    :config="cyConfig"
    :preConfig="preConfig"
    @ready="onCyReady"
  )
</template>

<script lang="ts">
import VueCytoscape from 'vue-cytoscape'

export default defineComponent({
  components: { cytoscape: VueCytoscape },

  computed: {
    cyConfig() {
      return {
        elements: this.graphData,
        style: [
          {
            selector: 'node',
            style: {
              'background-color': (node) => this.getNodeColor(node),
              'label': 'data(label)',
            },
          },
          {
            selector: 'edge',
            style: {
              'width': 'data(weight)',
              'line-color': '#888',
              'target-arrow-shape': 'triangle',
            },
          },
        ],
        layout: { name: 'cose' }, // Force-directed
      }
    },
  },
})
</script>
```

**YAML Configuration:**

```yaml
type: graph
nodes:
  file: nodes.csv
  idColumn: id
  labelColumn: name
  colorBy:
    attribute: category
    type: categorical
edges:
  file: edges.csv
  sourceColumn: from
  targetColumn: to
  weightColumn: flow
layout: force-directed  # or: hierarchical, circular, grid
linkage:
  tableColumn: node_id
  onHover: highlight
  onSelect: filter
```

### Alternatives Considered

| Library | Verdict | Reason |
|---------|---------|--------|
| D3.js force layout | NOT RECOMMENDED | More work to integrate; Cytoscape handles everything |
| Sigma.js | CONSIDER for >50k nodes | Better large-scale performance, but harder to integrate |
| vis-network | ACCEPTABLE | Part of vis.js family; slightly less feature-rich than Cytoscape |
| Ogma | NOT RECOMMENDED | Commercial license |
| arbor.js | NOT RECOMMENDED | Unmaintained since 2016 |

---

## Installation Summary

**New Dependencies (if all features implemented):**

```bash
# Required for graph visualization
npm install vue-cytoscape

# Optional: Only if vis-timeline needed for complex timelines
npm install vis-timeline @vue2vis/timeline vis-data moment
```

**Estimated Bundle Impact:**
- cytoscape + vue-cytoscape: ~400KB gzipped
- vis-timeline (optional): ~150KB gzipped

**No new dependencies needed for:**
- Global theming (use existing CSS variables + Vuex)
- Correlation matrix (use existing Plotly.js)
- Dual maps (use existing deck.gl + MapLibre)
- Basic timelines (use existing Plotly.js)

---

## Integration with Existing Architecture

### LinkageManager Integration

All new card types should integrate with the existing coordination system:

```typescript
// GraphCard.vue
props: {
  filteredData: Array,    // From LinkableCardWrapper
  hoveredIds: Set,        // IDs to highlight
  selectedIds: Set,       // IDs to filter
  linkage: Object,        // Linkage config
}

// Emit events for coordination
emit('hover', new Set([nodeId]))
emit('select', new Set([nodeId]))
emit('filter', filterId, column, values)
```

### DataTableManager Integration

Cards can access centralized data:

```typescript
// Access filtered data from central table
const filteredNodeIds = props.filteredData.map(row => row[props.linkage.tableColumn])

// Update node highlighting based on table state
watch(() => props.hoveredIds, (ids) => {
  cy.nodes().removeClass('highlighted')
  cy.nodes().filter(n => ids.has(n.id())).addClass('highlighted')
})
```

---

## Sources

### Global Theming
- [Vue SFC CSS Features](https://vuejs.org/api/sfc-css-features.html)
- [Theming using CSS Custom Properties in Vue.js](https://vuedose.tips/theming-using-custom-properties-in-vuejs-components/)

### Correlation Matrix / Heatmaps
- [Plotly.js Heatmaps Documentation](https://plotly.com/javascript/heatmaps/)
- [Plotly Correlation Matrix Example](https://chart-studio.plotly.com/~plotly.js/11/correlation-matrix/)
- [Annotated Heatmap CodePen](https://codepen.io/mafar/pen/RXBpXO)
- [D3 Correlogram Gallery](https://d3-graph-gallery.com/correlogram)

### Dual Maps / deck.gl
- [deck.gl Views and Projections](https://deck.gl/docs/developer-guide/views)
- [deck.gl Multi-View Discussion](https://github.com/visgl/deck.gl/discussions/6525)
- [MapboxOverlay Documentation](https://deck.gl/docs/api-reference/mapbox/mapbox-overlay)

### Timeline Visualization
- [vis-timeline Documentation](https://visjs.github.io/vis-timeline/docs/timeline/)
- [vis-timeline GitHub](https://github.com/visjs/vis-timeline)
- [@vue2vis/timeline npm](https://www.npmjs.com/package/@vue2vis/timeline)

### Graph Visualization
- [Cytoscape.js Official](https://js.cytoscape.org/)
- [vue-cytoscape GitHub](https://github.com/rcarcasses/vue-cytoscape)
- [vue-cytoscape Documentation](https://rcarcasses.github.io/vue-cytoscape/)
- [JavaScript Graph Visualization Comparison](https://www.cylynx.io/blog/a-comparison-of-javascript-graph-network-visualisation-libraries/)
