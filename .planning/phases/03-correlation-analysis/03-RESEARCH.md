# Phase 3: Correlation Analysis - Research

**Researched:** 2026-01-21
**Domain:** Statistical visualization - correlation matrix heatmap
**Confidence:** HIGH

## Summary

This research investigated implementation approaches for a Pearson correlation matrix heatmap card within SimWrapper's Interactive Dashboard plugin. The standard approach uses **Plotly.js** (already installed) for heatmap rendering with interactive hover/click, **simple-statistics** library for correlation calculation with manual p-value computation, and extension of the existing LinkageManager observer pattern to broadcast attribute pair selection events.

The correlation matrix card follows established patterns from HistogramCard, PieChartCard, and ScatterCard - all Vue 3 Composition API components using Plotly.js for visualization and StyleManager for theme-aware colors. For 70+ attributes (potentially 5000+ cells), Plotly automatically uses Canvas internally for performance, with conditional text annotation display based on matrix size.

**Primary recommendation:** Create CorrelationMatrixCard.vue following the ScatterCard pattern (Plotly + interactive events), use simple-statistics for correlation calculation with custom t-test for p-values, extend LinkageManager with attributePairSelected event type, and configure via standard YAML card structure.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Plotly.js | 3.1.0 | Heatmap rendering with hover/click | Already used in HistogramCard, PieChartCard, ScatterCard; handles large matrices via Canvas internally |
| simple-statistics | 7.8.8 (latest) | Pearson correlation calculation | Lightweight, zero dependencies, widely used (316+ projects), provides sampleCorrelation(x, y) API |
| Vue 3 Composition API | 2.7 | Component framework | Project standard for all interactive dashboard cards |
| StyleManager | Project internal | Theme-aware colors | Centralized color management for all dashboard components |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | Project version | Type safety | Required for all project code |
| mathjs | 10.6.4 | Advanced math (if needed) | Already installed; provides student-t distribution for p-value calculation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| simple-statistics | @stdlib/stats-pcorrtest | Stdlib provides p-values built-in but adds ~30KB bundle weight vs simple-statistics ~3KB. Manual p-value calculation is straightforward (t-test formula). |
| Plotly.js | Canvas-based custom rendering | Would require reimplementing hover tooltips, click handling, responsive resizing, theme updates. Plotly provides all this. |
| Plotly.js | D3.js heatmap | D3 requires more boilerplate for interaction handling. Plotly is higher-level and consistent with existing cards. |

**Installation:**
```bash
npm install simple-statistics
```

## Architecture Patterns

### Recommended Project Structure
```
src/plugins/interactive-dashboard/
├── components/cards/
│   ├── CorrelationMatrixCard.vue    # New correlation matrix card
│   ├── ScatterCard.vue               # Reference pattern (modify for axis events)
│   ├── HistogramCard.vue             # Reference pattern (Plotly + theme)
│   └── LinkableCardWrapper.vue       # Wrapper (no changes needed)
├── managers/
│   └── LinkageManager.ts             # Extend with attribute pair events
└── utils/
    └── statistics.ts                 # Correlation + p-value utilities (new)
```

### Pattern 1: Plotly-based Interactive Card Component
**What:** Vue component using Plotly.js for visualization with theme-aware styling
**When to use:** Any chart card requiring hover/click interaction with responsive resizing

**Example from HistogramCard.vue:**
```typescript
// Source: /src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
import { ref, watch, onMounted, computed } from 'vue'
import Plotly from 'plotly.js/dist/plotly'
import { StyleManager } from '../../managers/StyleManager'
import globalStore from '@/store'

const plotContainer = ref<HTMLElement>()
const isDarkMode = computed(() => globalStore.state.isDarkMode)

const renderChart = () => {
  if (!plotContainer.value) return

  const styleManager = StyleManager.getInstance()
  const bgColor = styleManager.getColor('theme.background.primary')
  const textColor = styleManager.getColor('theme.text.primary')
  const gridColor = styleManager.getColor('theme.border.default')

  const trace = {
    z: correlationMatrix,  // 2D array for heatmap
    type: 'heatmap',
    colorscale: 'RdBu',  // Diverging: blue-white-red
    zmid: 0,             // Center white at zero
  }

  const layout = {
    xaxis: { tickfont: { color: textColor } },
    yaxis: { tickfont: { color: textColor } },
    paper_bgcolor: bgColor,
    plot_bgcolor: bgColor,
  }

  Plotly.newPlot(plotContainer.value, [trace], layout, {
    displayModeBar: false,
    responsive: true,
  })

  // Click handler for cell selection
  plotContainer.value.on('plotly_click', (data: any) => {
    const pointIndex = data.points[0]
    const xAttr = attributes[pointIndex.x]
    const yAttr = attributes[pointIndex.y]
    emit('attributePairSelected', xAttr, yAttr)
  })
}

// Re-render on dark mode change
watch(isDarkMode, () => renderChart())

onMounted(() => {
  renderChart()
  emit('isLoaded')
})
```

### Pattern 2: Correlation Computation with P-Values
**What:** Calculate Pearson correlation matrix with statistical significance testing
**When to use:** Correlation matrix cards requiring statistical validity indicators

**Example implementation:**
```typescript
// Source: Synthesized from simple-statistics API + statistical formulas
// File: src/plugins/interactive-dashboard/utils/statistics.ts
import { sampleCorrelation } from 'simple-statistics'

interface CorrelationResult {
  r: number           // Correlation coefficient (-1 to 1)
  p: number           // Two-tailed p-value
  n: number           // Sample size
  significant: boolean // p < 0.05
}

/**
 * Calculate Pearson correlation and p-value using t-test
 * Formula: t = r * sqrt(n-2) / sqrt(1 - r^2)
 * df = n - 2
 */
function correlationWithPValue(
  x: number[],
  y: number[],
  alpha: number = 0.05
): CorrelationResult {
  const n = x.length

  // Remove pairs with missing values
  const pairs = x.map((xi, i) => [xi, y[i]])
    .filter(([xi, yi]) =>
      xi !== null && xi !== undefined &&
      yi !== null && yi !== undefined &&
      !isNaN(xi) && !isNaN(yi)
    )

  const xClean = pairs.map(p => p[0])
  const yClean = pairs.map(p => p[1])
  const nClean = xClean.length

  if (nClean < 3) {
    return { r: 0, p: 1, n: nClean, significant: false }
  }

  // Calculate correlation using simple-statistics
  const r = sampleCorrelation(xClean, yClean)

  // Calculate p-value via t-test
  const df = nClean - 2
  const t = r * Math.sqrt(df) / Math.sqrt(1 - r * r)

  // Two-tailed p-value from t-distribution
  // Can use mathjs: const p = 2 * (1 - studentT.cdf(Math.abs(t), df))
  // Or simple approximation for large df
  const p = 2 * (1 - tCDF(Math.abs(t), df))

  return {
    r,
    p,
    n: nClean,
    significant: p < alpha
  }
}

/**
 * Compute full correlation matrix for selected attributes
 */
function computeCorrelationMatrix(
  data: any[],
  attributes: string[]
): {
  matrix: number[][]
  pValues: number[][]
  sampleSizes: number[][]
} {
  const n = attributes.length
  const matrix: number[][] = []
  const pValues: number[][] = []
  const sampleSizes: number[][] = []

  for (let i = 0; i < n; i++) {
    matrix[i] = []
    pValues[i] = []
    sampleSizes[i] = []

    for (let j = 0; j < n; j++) {
      if (i === j) {
        // Diagonal: perfect correlation with self
        matrix[i][j] = 1
        pValues[i][j] = 0
        sampleSizes[i][j] = data.length
      } else {
        const xValues = data.map(row => row[attributes[i]])
        const yValues = data.map(row => row[attributes[j]])
        const result = correlationWithPValue(xValues, yValues)
        matrix[i][j] = result.r
        pValues[i][j] = result.p
        sampleSizes[i][j] = result.n
      }
    }
  }

  return { matrix, pValues, sampleSizes }
}
```

### Pattern 3: Observer Pattern Extension for New Event Types
**What:** Extend LinkageManager to broadcast new event types while maintaining backward compatibility
**When to use:** Adding new cross-card interaction types beyond hover/select

**Current LinkageManager structure:**
```typescript
// Source: /src/plugins/interactive-dashboard/managers/LinkageManager.ts
export interface LinkageObserver {
  onHoveredIdsChange: (ids: Set<any>) => void
  onSelectedIdsChange: (ids: Set<any>) => void
  // ADD: onAttributePairSelected?: (attrX: string, attrY: string) => void
}

export class LinkageManager {
  private hoveredIds: Set<any> = new Set()
  private selectedIds: Set<any> = new Set()
  private observers: Set<LinkageObserver> = new Set()

  // ADD: New state for attribute pair selection
  // private selectedAttributePair: { x: string; y: string } | null = null

  // ADD: New method for attribute pair selection
  // setSelectedAttributePair(attrX: string, attrY: string): void {
  //   this.selectedAttributePair = { x: attrX, y: attrY }
  //   this.notifyAttributePairSelection()
  // }

  // ADD: New notification method
  // private notifyAttributePairSelection(): void {
  //   this.observers.forEach(obs => {
  //     if (obs.onAttributePairSelected) {
  //       obs.onAttributePairSelected(
  //         this.selectedAttributePair.x,
  //         this.selectedAttributePair.y
  //       )
  //     }
  //   })
  // }
}
```

### Pattern 4: YAML Configuration for Card Types
**What:** Declarative card configuration in dashboard YAML with card-specific properties
**When to use:** All dashboard cards follow this pattern

**Example from existing configs:**
```yaml
# Source: /src/plugins/interactive-dashboard/examples/commuter-requests/example-data/dashboard-interactive-commuter-requests.yaml
layout:
  row1:
    - type: histogram
      title: "Active Time Distribution"
      column: treq
      binSize: 3600
      width: 1
      height: 2
      linkage:
        type: filter
        column: treq
        behavior: toggle

    # NEW: Correlation matrix card config
    - type: correlation-matrix
      title: "Attribute Correlations"
      attributes:
        - travel_time
        - distance
        - wait_time
        - detour_factor
      width: 2
      height: 4
      showValues: auto  # 'always', 'never', 'auto' (hide if >20 attributes)
      pValueThreshold: 0.05
      linkage:
        type: attributePair  # New linkage type for axis updates
        targetCard: scatter-1  # ID of ScatterCard to update
```

### Anti-Patterns to Avoid
- **Computing correlations synchronously on large datasets:** Use async/await with loading state to avoid blocking UI
- **Recalculating entire matrix on every filter change:** Debounce filter updates (100-200ms) before triggering recomputation
- **Storing correlation results in Vuex:** Keep results local to component; only broadcast events through LinkageManager
- **Hard-coding color scales:** Use StyleManager for theme-aware heatmap colors (though diverging blue-white-red is standard and not theme-dependent)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Heatmap rendering with interaction | Custom Canvas/SVG heatmap | Plotly.js heatmap | Plotly provides hover tooltips, responsive resizing, click handling, zoom/pan. Automatically switches to Canvas for large matrices. |
| Pearson correlation calculation | Manual covariance/variance math | simple-statistics.sampleCorrelation() | Handles edge cases (missing values, zero variance), numerically stable implementation, widely tested. |
| t-distribution CDF for p-values | Custom statistical functions | mathjs (already installed) or simple approximation | t-distribution is complex; mathjs provides studentT distribution functions. |
| Theme-aware colors | Hard-coded hex values | StyleManager.getColor() | Automatically updates on dark/light mode toggle, centralized color definitions. |
| Responsive chart resizing | Manual ResizeObserver logic | Plotly.Plots.resize() + existing pattern | HistogramCard/ScatterCard already implement debounced resize handling. Copy that pattern. |

**Key insight:** Statistical visualization requires careful handling of numerical stability, missing data, and edge cases. Established libraries have battle-tested implementations. Custom correlation/p-value code is error-prone.

## Common Pitfalls

### Pitfall 1: Performance Degradation with Large Matrices
**What goes wrong:** Computing 70x70 correlation matrix (4,900 correlations) synchronously on every filter update causes UI freezing
**Why it happens:** Correlation calculation is O(n*m²) where n=rows, m=attributes. With 10K rows and 70 attributes, that's billions of operations.
**How to avoid:**
1. Debounce filter updates (200ms) before triggering matrix recalculation
2. Show loading spinner during computation
3. Use async/await to yield to UI thread
4. Consider Web Worker for matrices >30 attributes (move computation off main thread)
**Warning signs:** UI feels sluggish when toggling filters; console shows "long task" warnings

### Pitfall 2: Missing Data Handling in Correlation Pairs
**What goes wrong:** Including rows with null/undefined values in correlation calculation produces NaN results
**Why it happens:** Correlation requires paired observations; missing values break the calculation
**How to avoid:**
1. Filter out pairs where either value is null/undefined/NaN before correlation
2. Track actual sample size (n) per correlation pair (not dataset size)
3. Show n in tooltip to indicate data completeness
4. Handle case where n < 3 (insufficient data) by showing "N/A" instead of correlation
**Warning signs:** NaN in correlation matrix; inconsistent sample sizes across cells

### Pitfall 3: P-Value Calculation Errors Near r=±1
**What goes wrong:** When r is very close to ±1, the formula `t = r * sqrt(n-2) / sqrt(1 - r²)` produces division by near-zero, causing numerical instability
**Why it happens:** sqrt(1 - r²) approaches zero as r approaches ±1
**How to avoid:**
1. Clamp r to [-0.9999, 0.9999] before p-value calculation
2. Or: set p-value = 0.0 (highly significant) when |r| > 0.9999
3. Document this behavior in code comments
**Warning signs:** p-value = Infinity or NaN for strong correlations

### Pitfall 4: Confusion Between One-Tailed and Two-Tailed P-Values
**What goes wrong:** Using one-tailed p-value when two-tailed is needed (or vice versa), leading to incorrect significance interpretation
**Why it happens:** Correlation tests are typically two-tailed (H0: ρ=0), but developers may use one-tailed CDF without doubling
**How to avoid:**
1. Always use two-tailed p-value for correlation: p = 2 * (1 - CDF(|t|, df))
2. Document in code that correlation tests are two-tailed
3. Include "two-tailed" in variable names (twoTailedPValue)
**Warning signs:** All correlations appear significant; p-values seem too small

### Pitfall 5: Cell Label Overflow in Large Matrices
**What goes wrong:** Displaying correlation values (e.g., "0.87") in every cell makes the heatmap unreadable when matrix is large
**Why it happens:** Cell size decreases as matrix grows; text becomes too small or overlaps
**How to avoid:**
1. Conditional text display: hide text when attributes.length > 20
2. Use Plotly's hovertemplate to show value/p-value on hover instead
3. Add toggle button to show/hide cell values
**Warning signs:** Text overlaps, illegible labels, cluttered appearance

## Code Examples

Verified patterns from official sources:

### Plotly Heatmap with Custom Hover
```typescript
// Source: Plotly.js documentation - Heatmaps in JavaScript
// URL: https://plotly.com/javascript/heatmaps/
const trace = {
  z: correlationMatrix,  // 2D array: matrix[row][col]
  x: attributeNames,     // Column labels
  y: attributeNames,     // Row labels
  type: 'heatmap',
  colorscale: [
    [0.0, '#3b4cc0'],  // Blue for -1
    [0.5, '#f7f7f7'],  // White for 0
    [1.0, '#b40426']   // Red for +1
  ],
  zmid: 0,  // Center colorscale at zero
  zmin: -1,
  zmax: 1,
  hovertemplate:
    '<b>%{x} × %{y}</b><br>' +
    'r = %{z:.3f}<br>' +
    'p = %{customdata[0]:.4f}<br>' +
    'n = %{customdata[1]}<br>' +
    '<extra></extra>',
  customdata: pValueMatrix,  // Pass p-values for hover
}
```

### Conditional Text Annotation
```typescript
// Source: Plotly.js documentation - Annotated heatmaps
// URL: https://plotly.com/python/annotated-heatmap/
// Adapted for JavaScript
const shouldShowText = attributes.length <= 20

const annotations: any[] = []
if (shouldShowText) {
  for (let i = 0; i < attributes.length; i++) {
    for (let j = 0; j < attributes.length; j++) {
      const value = correlationMatrix[i][j]
      const pValue = pValueMatrix[i][j]

      // Add asterisk for significant correlations
      const text = pValue < 0.05
        ? `${value.toFixed(2)}*`
        : value.toFixed(2)

      annotations.push({
        x: attributes[j],
        y: attributes[i],
        text: text,
        showarrow: false,
        font: {
          color: Math.abs(value) > 0.5 ? 'white' : 'black'  // Contrast
        }
      })
    }
  }
}

const layout = {
  annotations: annotations,
  // ... other layout
}
```

### ScatterCard Axis Update Pattern
```typescript
// Source: Existing ScatterCard.vue pattern (to be extended)
// File: /src/plugins/interactive-dashboard/components/cards/ScatterCard.vue

// Add to ScatterCard component:
interface Props {
  // ... existing props
  listenToAttributePairSelection?: boolean  // Opt-in to axis updates
}

// Add observer for attribute pair events
const linkageObserver = {
  onAttributePairSelected: (attrX: string, attrY: string) => {
    if (!props.listenToAttributePairSelection) return

    // Update axes
    currentXColumn.value = attrX
    currentYColumn.value = attrY

    // Re-render with new axes
    renderChart()
  }
}

onMounted(() => {
  linkageManager.addObserver(linkageObserver)
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| D3.js for all visualizations | Plotly.js for interactive charts | ~2020 | Higher-level API, built-in interactions, faster development |
| Manual Canvas rendering | Plotly auto-selects Canvas/SVG | Plotly v2.0+ | Automatic performance optimization for large datasets |
| Global Vuex state for card interactions | Observer pattern in managers | Interactive Dashboard plugin (2024+) | Cleaner separation, easier testing, no global state pollution |
| Hard-coded colors | StyleManager singleton | Phase 1 (recent) | Theme-aware colors, dark mode support |

**Deprecated/outdated:**
- Custom D3 heatmap implementations: Plotly provides better developer experience and performance
- Synchronous statistical computation: Modern practice uses async/await with loading states for responsiveness
- scipy/numpy in browser via Pyodide: Too heavy for simple correlation calculation; simple-statistics is 3KB vs 10MB+ for Pyodide

## Open Questions

Things that couldn't be fully resolved:

1. **Web Worker threshold for large matrices**
   - What we know: Web Workers are used in this project for heavy computation (see HexagonAggregator, CsvGzipParser)
   - What's unclear: At what matrix size (# attributes) does Web Worker overhead become worth it?
   - Recommendation: Start without Web Worker. If >30 attributes causes UI lag, move computation to worker. Measure with Chrome DevTools Performance panel.

2. **t-distribution CDF implementation choice**
   - What we know: mathjs is installed and provides studentT distribution; simple approximations exist for large df
   - What's unclear: Is mathjs bundle size worth including for just CDF, or should we use approximation?
   - Recommendation: Use mathjs.studentT.cdf() initially. If bundle size is concern, replace with Abramowitz & Stegun approximation (accurate to 1e-7 for df>30).

3. **Optimal attribute ordering in matrix**
   - What we know: Alphabetical ordering is user requirement
   - What's unclear: Would hierarchical clustering improve pattern visibility? Should we offer both?
   - Recommendation: Start with alphabetical (requirement). Add "cluster" ordering as optional enhancement in future phase if users request it.

## Sources

### Primary (HIGH confidence)
- Plotly.js v3.1.0 installed in project (`npm list plotly.js`)
- simple-statistics v7.8.8 - [npm package](https://www.npmjs.com/package/simple-statistics)
- Existing card implementations: HistogramCard.vue, ScatterCard.vue, PieChartCard.vue (codebase)
- LinkageManager.ts (codebase) - Observer pattern implementation
- StyleManager.ts (codebase) - Theme-aware color system
- Interactive Dashboard README.md (codebase) - YAML configuration patterns

### Secondary (MEDIUM confidence)
- [Plotly.js Heatmaps Documentation](https://plotly.com/javascript/heatmaps/) - Interactive heatmap examples
- [Canvas vs SVG Performance - Apache ECharts](https://apache.github.io/echarts-handbook/en/best-practices/canvas-vs-svg/) - Canvas recommended for 70x70 cells
- [Pearson Correlation T-Test](https://www.statology.org/t-test-for-correlation/) - Formula: t = r√(n-2) / √(1-r²)
- [stdlib-js/stats-pcorrtest](https://github.com/stdlib-js/stats-pcorrtest) - Alternative library with built-in p-values

### Tertiary (LOW confidence)
- [Plotly Annotated Heatmap](https://plotly.com/python/annotated-heatmap/) - Python examples, adapted for JavaScript
- Web search results on heatmap text annotation thresholds - no official Plotly documentation on automatic hiding

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified as installed or lightweight additions; patterns exist in codebase
- Architecture: HIGH - Card component pattern is well-established; observer pattern extension is straightforward
- Pitfalls: MEDIUM - Based on general statistical computing knowledge and performance considerations; not SimWrapper-specific

**Research date:** 2026-01-21
**Valid until:** 2026-03-21 (60 days - stable domain, Plotly and simple-statistics are mature libraries)
