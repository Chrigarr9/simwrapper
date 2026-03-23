# Feature Landscape: Interactive Dashboard Enhancements

**Domain:** Data Analysis Dashboard for Transportation Research (Cluster Analysis)
**Researched:** 2026-01-20
**Confidence:** MEDIUM-HIGH (based on WebSearch verified against multiple industry sources)

## Context

SimWrapper is a transportation visualization tool. The Interactive Dashboard plugin enables coordinated visualizations with:
- Central data table (70+ attributes per cluster)
- Map visualizations with deck.gl layers
- Histogram and pie chart filtering
- Cross-card linkage for highlight/filter behaviors

Users need to:
- Analyze attribute distributions across clusters
- Discover correlations between demographics, travel behavior, and accessibility
- Compare clusters spatially
- Visualize ride time windows and request groupings

---

## 1. Global Theming System

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Dark/Light Mode Toggle** | Users working extended hours expect dark mode for reduced eye strain; 2025 standard | Low | SimWrapper already has `isDarkMode` in Vuex store |
| **System Preference Detection** | Respect `prefers-color-scheme` media query | Low | Use `window.matchMedia('(prefers-color-scheme: dark)')` |
| **Persistence** | Remember user's theme choice via localStorage | Low | Already partially implemented |
| **WCAG Contrast Compliance** | Accessibility requirement; 4.5:1 minimum contrast ratio | Medium | Critical for research/academic use |
| **Consistent Color Semantics** | Same meaning for colors across cards (e.g., red=warning, blue=info) | Medium | Prevents cognitive load |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **CSS Variable Architecture** | Enable nested themes, per-card theme overrides | Medium | Enables future card-level theming |
| **Data-Aware Color Modes** | Charts auto-adjust saturation for dark/light backgrounds | Medium | Improves readability of visualizations |
| **Theme Profiles for Export** | Switch to print-optimized theme for reports/publications | Medium | Valuable for academic researchers |
| **Adaptive UI (Time/Context)** | Auto-switch based on time of day or ambient light | High | 2025 trend but not essential |
| **Component-Level Theming** | Cards can override dashboard theme when needed | Medium | Useful for emphasis |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Pure black (#000) backgrounds | Causes eye strain and harsh contrast | Use dark grays (#121212, #1a1a1a) |
| Rainbow color palettes | Causes confusion, not colorblind-safe | Limit to 8-12 distinct hues |
| Per-card theme pickers | Cognitive overload, visual chaos | Global theme with semantic overrides |
| Auto-switching without user control | Frustrating for users with preferences | Default to system, allow override |

**Sources:**
- [Smashing Magazine - Inclusive Dark Mode](https://www.smashingmagazine.com/2025/04/inclusive-dark-mode-designing-accessible-dark-themes/)
- [InterWorks - Light Mode vs Dark Mode Dashboards](https://interworks.com/blog/2025/01/07/how-to-decide-between-light-mode-versus-dark-mode-dashboards-in-tableau/)
- [DataCamp - Dashboard Design Tutorial](https://www.datacamp.com/tutorial/dashboard-design-tutorial)

---

## 2. Correlation Analysis Tools

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Correlation Matrix Heatmap** | Standard tool for understanding variable relationships | Medium | Essential for 70+ attributes |
| **Interactive Tooltips** | Show exact correlation values on hover | Low | Standard expectation |
| **Clickable Cells** | Click correlation cell to drill into scatter plot | Medium | Enables exploration |
| **Diverging Color Scale** | Blue-white-red for negative-zero-positive correlations | Low | Industry standard |
| **Sortable/Clusterable Matrix** | Group correlated variables together | High | Reveals patterns in many-attribute data |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Scatter Plot Matrix (SPLOM)** | Pairwise relationships with histograms on diagonal | High | Powerful for multi-attribute exploration |
| **Attribute Selector Panel** | Choose subset of 70+ attributes to correlate | Medium | Essential for large attribute sets |
| **Filter-Aware Correlations** | Recalculate correlations based on active filters | Medium | Shows correlations within selected subset |
| **Correlation Significance Indicators** | Show p-values or confidence intervals | Medium | Important for research validity |
| **Dendrograms for Clustering** | Show hierarchical relationships between variables | High | Reveals attribute groupings |
| **Highlighted Rows/Columns** | Highlight one attribute's relationships across all others | Low | Quick exploration aid |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| 70x70 matrix without filtering | Unreadable, overwhelming | Provide attribute selector, max 15-20 visible |
| Pearson-only correlation | May miss non-linear relationships | Offer Spearman option for ordinal/non-linear |
| Static correlation display | Doesn't integrate with filter workflow | Make correlations respond to filters |
| No minimum sample size warning | Invalid statistics with small filtered samples | Show warning when n < threshold |

**Sources:**
- [Analytics Yogi - Correlation Heatmap with Seaborn](https://vitalflux.com/correlation-heatmap-with-seaborn-pandas/)
- [ML Pills - Correlation Heatmaps](https://mlpills.substack.com/p/issue-96-correlation-heatmaps)
- [GeeksforGeeks - Pair Plots Using Scatter Matrix](https://www.geeksforgeeks.org/data-science/pair-plots-using-scatter-matrix-in-pandas/)

---

## 3. Multi-View Map Comparisons

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Synchronized Pan/Zoom** | Compare same location across views | Medium | Standard in GIS tools (ArcGIS, QGIS) |
| **Side-by-Side Layout** | Compare two scenarios/attributes simultaneously | Medium | Core comparison capability |
| **Shared Legend** | Consistent color interpretation across views | Low | Prevents confusion |
| **Linked Hover** | Hover on one map highlights same feature on other | Medium | Essential for comparison |
| **Toggle Sync On/Off** | Allow independent exploration when needed | Low | User control |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Swipe Comparison** | Slider reveals different attribute on same map | Medium | Popular for before/after |
| **Difference Map** | Show computed difference between two scenarios | High | Valuable for scenario analysis |
| **Up to 4 Synchronized Views** | Compare multiple cluster types/attributes | High | ArcGIS supports up to 4 |
| **Stacked vs Side-by-Side Toggle** | Layout flexibility for different analyses | Low | User preference |
| **Map-Specific Filters** | Each map can have independent filter state | High | Advanced comparison capability |
| **Snapshot for Comparison** | Save current view state, compare to live | Medium | Useful for iterative analysis |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| More than 4 simultaneous maps | Visual overload, performance issues | Limit to 4, provide tabs for more |
| Always-synced with no override | Frustrating when exploring different areas | Default sync with toggle off option |
| Different base maps per view | Creates confusion about location | Shared base map, different data layers |
| No clear visual indicator of sync state | Users confused about behavior | Show sync icon/indicator |

**Sources:**
- [ArcGIS - Compare Configurable App](https://www.esri.com/arcgis-blog/products/arcgis-online/announcements/introducing-compare-the-newest-template-from-instant-apps)
- [QGIS Dual Viewer Plugin](https://plugins.qgis.org/plugins/QGISDualViewer/)
- [ArcGIS GeoPlanner - Side by Side](https://doc.arcgis.com/en/geoplanner/latest/documentation/side-by-side-comparison-of-scenarios.htm)

---

## 4. Timeline Visualizations

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Time Range Slider** | Filter data by time window | Medium | Essential for temporal data |
| **Animated Playback** | Step through time periods automatically | Medium | Reveals temporal patterns |
| **Time-of-Day Distribution** | Histogram of request counts by hour | Low | Already have histogram card |
| **Day-of-Week Patterns** | Show weekday vs weekend variations | Low | Common analysis need |
| **Zoom Levels** | Hour, day, week, month granularity | Medium | Different analysis scales |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Gantt-Style Time Windows** | Visualize ride request time windows and groupings | High | Specific to commuter request analysis |
| **State Timeline** | Show state changes over time as colored bands | Medium | Grafana-style visualization |
| **Dual Axis Time Series** | Compare two metrics over same time period | Medium | ArcGIS 2025 feature |
| **Brushable Time Selection** | Select time range by brushing on timeline | Medium | Integrates with filter system |
| **Aggregation Toggle** | Switch between individual events and aggregated bins | Medium | Flexibility for analysis |
| **Semantic Zoom** | Show more detail as user zooms in | High | Handles large time ranges gracefully |
| **Annotations** | Mark significant events/periods on timeline | Medium | Research documentation |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Overwhelming detail at overview zoom | Unreadable, slow | Aggregate at high zoom, detail on zoom-in |
| Linear-only time scale | Hides patterns at different scales | Support log scale or multiple views |
| Animation without controls | Frustrating user experience | Provide play/pause/speed/step controls |
| Fixed time granularity | Doesn't fit all data patterns | Allow user-selectable granularity |

**Sources:**
- [ArcGIS Dashboards 2025 Review](https://www.esri.com/arcgis-blog/products/ops-dashboard/data-management/arcgis-dashboards-2025-year-in-review/)
- [Grafana - State Timeline](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/state-timeline/)
- [Cambridge Intelligence - KronoGraph](https://cambridge-intelligence.com/kronograph/)

---

## 5. Graph/Network Visualizations

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Node-Link Diagram** | Basic network representation | High | Requires graph library integration |
| **Pan/Zoom on Graph** | Navigate large networks | Medium | Standard interaction |
| **Node Sizing by Attribute** | Show importance/frequency via node size | Medium | Common encoding |
| **Edge Thickness by Weight** | Show flow volume/strength | Medium | Common encoding |
| **Hover Details** | Show node/edge attributes on hover | Low | Standard expectation |
| **Basic Layout Algorithms** | Force-directed, hierarchical options | High | Different layouts suit different data |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **OD Flow Visualization** | Origin-destination flows as arcs/chords | High | Critical for transportation analysis |
| **Chord Diagram** | Show flows between zones elegantly | High | Compact OD representation |
| **Graph-Table Linkage** | Click node to filter table to related records | Medium | Integrates with existing linkage system |
| **Cluster Grouping** | Visual grouping of related nodes | High | Shows community structure |
| **Filtering by Graph Properties** | Filter by degree, centrality, etc. | High | Advanced network analysis |
| **Animated Flow** | Show direction of movement with animation | Medium | Clarifies flow direction |
| **Spider/Radial Layout** | Show all flows from one origin | Medium | Snap4City approach |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Dense hairball graphs | Unreadable, no insight | Provide filtering, aggregation, or focus+context |
| Unadjustable layouts | May not suit specific data | Offer multiple layout algorithms |
| No edge bundling for OD | Visual clutter for many flows | Implement edge bundling or aggregation |
| Real-time layout on large graphs | Performance issues, distracting motion | Allow layout to stabilize, then fix positions |

**Sources:**
- [Selector.ai - Network Visualization Tools 2025](https://www.selector.ai/learning-center/network-visualization-tools-key-features-and-top-6-tools-in-2025/)
- [Cambridge Intelligence - Visual Network Analysis Dashboards](https://cambridge-intelligence.com/visual-network-analysis-dashboards/)
- [LinkedIn - Transportation OD Flow Visualization](https://www.linkedin.com/pulse/transportation-data-visualization-1-migration-flow-jason-li)

---

## Feature Dependencies

```
Theme System
    |
    +-- All other features depend on consistent theming

Correlation Analysis
    |
    +-- Attribute Selector --> Correlation Matrix
    |                              |
    +-- Filter System -----------> Filter-Aware Correlations
    |
    +-- Scatter Plot Matrix (SPLOM) depends on Correlation Matrix

Multi-View Maps
    |
    +-- Single Map (existing) --> Synchronized Maps
    |                                |
    +-- Filter System -----------> Map-Specific Filters
    |
    +-- Difference Map depends on Synchronized Maps

Timeline Visualizations
    |
    +-- Time Range Slider --> Brushable Selection
    |                              |
    +-- Filter System -----------> Time-Based Filtering
    |
    +-- Animation depends on Time Range Controls

Network Visualizations
    |
    +-- Node-Link Diagram --> OD Flow / Chord Diagram
    |                              |
    +-- Linkage System ---------> Graph-Table Linkage
    |
    +-- Edge Bundling depends on basic flow visualization
```

---

## MVP Recommendation

For MVP, prioritize these features that deliver immediate value with manageable complexity:

### Phase 1: Foundation
1. **CSS Variable Theme Architecture** - Enable proper dark/light mode with semantic colors
2. **Theme Toggle with Persistence** - User-controllable, respects system preference
3. **Time Range Slider** - Filter data by time window (builds on existing filter system)

### Phase 2: Correlation Discovery
4. **Attribute Selector Panel** - Choose which of 70+ attributes to analyze
5. **Correlation Matrix Heatmap** - Core correlation visualization
6. **Click-to-Scatter-Plot** - Drill into specific correlations

### Phase 3: Spatial Comparison
7. **Side-by-Side Synchronized Maps** - Compare two cluster types
8. **Swipe Comparison** - Alternative comparison mode

### Phase 4: Advanced Analysis
9. **Scatter Plot Matrix (SPLOM)** - Multi-attribute correlation exploration
10. **OD Flow Visualization** - Origin-destination arcs (builds on existing map layers)

### Defer to Post-MVP
- Gantt-style time windows (high complexity, specific use case)
- Full network/graph visualization (requires new library integration)
- Adaptive UI themes (nice-to-have, not essential)
- Difference maps (requires computational layer)
- Dendrograms and hierarchical clustering visualization

---

## Complexity Estimates Summary

| Feature Area | Table Stakes | Differentiators | Total Effort |
|--------------|--------------|-----------------|--------------|
| Theming | Low-Medium | Medium-High | 2-3 weeks |
| Correlation | Medium-High | Medium-High | 3-4 weeks |
| Multi-View Maps | Medium | Medium-High | 3-4 weeks |
| Timeline | Low-Medium | Medium-High | 2-3 weeks |
| Network/Graph | High | High | 4-6 weeks |

**Total estimated effort for MVP (Phases 1-3):** 8-12 weeks
**Total estimated effort for full feature set:** 16-22 weeks

---

## Sources Summary

### Dashboard Design
- [Julius AI - BI Dashboard Best Practices](https://julius.ai/articles/business-intelligence-dashboard-design-best-practices)
- [UXPin - Dashboard Design Principles 2025](https://www.uxpin.com/studio/blog/dashboard-design-principles/)
- [DataCamp - Dashboard Design Tutorial](https://www.datacamp.com/tutorial/dashboard-design-tutorial)

### Theming and Accessibility
- [Smashing Magazine - Inclusive Dark Mode](https://www.smashingmagazine.com/2025/04/inclusive-dark-mode-designing-accessible-dark-themes/)
- [UIVerse - Adaptive UI Themes 2025](https://uiverse.io/blog/dark-mode-light-mode-whats-next-adaptive-ui-themes-for-2025)
- [MakeUseOf - Vue Dark Theme CSS Variables](https://www.makeuseof.com/vue-dark-theme-css-variables-localstorage/)

### Correlation Analysis
- [Analytics Yogi - Correlation Heatmap](https://vitalflux.com/correlation-heatmap-with-seaborn-pandas/)
- [DataScienceBase - Pairplots and Heatmaps](https://www.datasciencebase.com/fundamentals/data-science/seaborn/pairplots-and-heatmaps/)
- [CanvasXpress - SPLOM Guide](https://www.canvasxpress.org/examples/splom-1.html)

### Multi-View Maps
- [ArcGIS Dashboards 2025 Review](https://www.esri.com/arcgis-blog/products/ops-dashboard/data-management/arcgis-dashboards-2025-year-in-review/)
- [ArcGIS - Compare App](https://www.esri.com/arcgis-blog/products/arcgis-online/announcements/introducing-compare-the-newest-template-from-instant-apps)
- [CARTO - Best Maps 2024](https://carto.com/blog/2024-best-maps-dataviz)

### Timeline Visualization
- [Grafana - State Timeline](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/state-timeline/)
- [Cambridge Intelligence - KronoGraph](https://cambridge-intelligence.com/kronograph/)
- [Office Timeline - Data Visualization Strategies](https://www.officetimeline.com/blog/from-data-to-decisions-visualization-strategies-for-project-managers)

### Network/Graph Visualization
- [Selector.ai - Network Visualization Tools 2025](https://www.selector.ai/learning-center/network-visualization-tools-key-features-and-top-6-tools-in-2025/)
- [Cambridge Intelligence - Visual Network Analysis](https://cambridge-intelligence.com/visual-network-analysis-dashboards/)
- [Flourish - Network Charts](https://flourish.studio/visualisations/network-charts/)
- [LinkedIn - Transportation OD Visualization](https://www.linkedin.com/pulse/transportation-data-visualization-1-migration-flow-jason-li)

### Transportation-Specific
- [Findings Press - Transit Accessibility Dashboard](https://findingspress.org/article/25224-a-comprehensive-transit-accessibility-and-equity-dashboard)
- [US DOT - Transportation Analysis Tools](https://www.transportation.gov/grants/dot-navigator/transportation-analysis-tools)
- [MIT Senseable City Lab - PubraVis](https://senseable.mit.edu/papers/pdf/20200320_Prommaharaj-etal_VisualizingTransit_Helyon.pdf)

### Cluster Analysis
- [InetSoft - Cluster Analysis Dashboard](https://www.inetsoft.com/info/create-a-cluster-analysis-dashboard/)
- [Kanaries - Clustering Visualization Guide](https://docs.kanaries.net/articles/clustering-visualization)
- [Displayr - Cluster Analysis Guide](https://www.displayr.com/understanding-cluster-analysis-a-comprehensive-guide/)
