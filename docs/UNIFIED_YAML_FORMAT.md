# Unified Dashboard YAML Format

This document shows how interactive dashboards use SimWrapper's existing dashboard structure with optional enhancements.

## Legacy Dashboard (Still Works)

```yaml
title: "Traffic Analysis"
description: "Basic traffic dashboard"

layout:
  row1:
    - type: map
      title: "Traffic Map"
      width: 2
      height: 8
      file: traffic.geojson
      props:
        center: [13.4, 52.5]
        zoom: 10

    - type: vega
      title: "Volume Chart"
      width: 1
      height: 8
      file: chart-spec.vega
      data: traffic-volumes.csv
```

**Behavior**: Each card loads its own data independently. No coordination.

---

## Interactive Dashboard (Enhanced)

```yaml
title: "Traffic Analysis (Interactive)"
description: "Interactive traffic dashboard with linked views"

# NEW: Centralized data table (triggers interactive mode)
table:
  name: "Traffic Data"
  dataset: traffic-data.csv
  idColumn: segment_id
  visible: true
  columns:
    hide: [internal_id, temp_field]
    formats:
      volume: { type: number, decimals: 0 }
      timestamp: { type: time, unit: "HH:mm" }

# NEW: Statistics components (clickable filters)
stats:
  - type: histogram
    title: "Volume Distribution"
    column: volume
    binSize: 100
    clickable: true

  - type: categorical
    title: "Road Type"
    column: road_type
    clickable: true

# SAME: Layout structure as before
layout:
  row1:
    - type: map
      title: "Traffic Map"
      width: 2
      height: 8
      center: [13.4, 52.5]
      zoom: 10

      # NEW: Linkage to centralized table
      layers:
        - name: segments
          file: segments.geojson
          type: line
          visible: true
          linkage:
            tableColumn: segment_id
            geoProperty: id
            onHover: highlight
            onSelect: filter

    - type: table
      title: "Traffic Data"
      width: 1
      height: 4
      source: table  # References centralized table

    - type: stats
      width: 1
      height: 4
```

**Behavior**:
- Centralized data loading from `table.dataset`
- Stats clicks filter the table and map
- Map selections filter table and update stats
- All views stay synchronized

---

## Key Differences

| Feature | Legacy Dashboard | Interactive Dashboard |
|---------|-----------------|---------------------|
| Data loading | Per-card (independent) | Centralized table + per-card |
| `table` section | ❌ Not present | ✅ Required |
| Filtering | ❌ None | ✅ Coordinated via FilterManager |
| Linkage | ❌ None | ✅ Map ↔ Table via LinkageManager |
| Stats | Static vega charts | Clickable filter controls |
| Layout | Row/card structure | Same row/card structure |
| Card types | map, vega, links, etc. | Same types + new options |

---

## Migration Path

**Step 1**: Existing dashboard works as-is
```yaml
title: "My Dashboard"
layout:
  row1:
    - type: map
      file: data.geojson
```

**Step 2**: Add centralized table (enables interactive mode)
```yaml
title: "My Dashboard"
table:
  dataset: data.csv
  idColumn: id

layout:
  row1:
    - type: map
      file: data.geojson
```

**Step 3**: Add linkages
```yaml
title: "My Dashboard"
table:
  dataset: data.csv
  idColumn: id

layout:
  row1:
    - type: map
      layers:
        - file: data.geojson
          linkage:
            tableColumn: id
            geoProperty: feature_id
```

**Step 4**: Add interactive stats
```yaml
title: "My Dashboard"
table:
  dataset: data.csv
  idColumn: id

stats:
  - type: histogram
    column: value
    clickable: true

layout:
  row1:
    - type: map
      layers:
        - file: data.geojson
          linkage:
            tableColumn: id
            geoProperty: feature_id
    - type: stats
```

---

## Technical Implementation

### Parser Logic

```typescript
interface DashboardConfig {
  title: string
  description?: string
  table?: TableConfig        // Optional - triggers interactive mode
  stats?: StatConfig[]      // Optional - only for interactive mode
  layout: LayoutConfig      // Same structure as SimWrapper
}

function loadDashboard(config: DashboardConfig) {
  if (config.table) {
    // Interactive mode
    const filterManager = new FilterManager()
    const linkageManager = new LinkageManager()
    const dataTable = await loadDataTable(config.table.dataset)

    return new InteractiveDashboard({
      config,
      dataTable,
      filterManager,
      linkageManager,
    })
  } else {
    // Legacy mode - use standard SimWrapper dashboard
    return new StandardDashboard(config)
  }
}
```

### Card Rendering

```typescript
// In interactive mode, wrap cards with coordination logic
function renderCard(cardConfig: any, isInteractive: boolean) {
  const CardComponent = getCardComponent(cardConfig.type)

  if (isInteractive && cardConfig.linkage) {
    return (
      <LinkableCard
        card={cardConfig}
        filterManager={filterManager}
        linkageManager={linkageManager}
      >
        <CardComponent {...cardConfig.props} />
      </LinkableCard>
    )
  } else {
    // Standard card rendering
    return <CardComponent {...cardConfig.props} />
  }
}
```

---

## Benefits of Unified Format

1. **True Backward Compatibility**: All existing dashboards work without changes
2. **Progressive Enhancement**: Add interactive features incrementally
3. **Familiar Structure**: No new layout system to learn
4. **Code Reuse**: Leverage existing SimWrapper card components
5. **Gradual Migration**: Users upgrade when ready
6. **No Breaking Changes**: Legacy dashboards are unaffected
