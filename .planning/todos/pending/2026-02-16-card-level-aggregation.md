---
created: 2026-02-16T14:30
title: Add card-level aggregation for multi-level analysis dashboards
area: interactive-dashboard
files:
  - src/plugins/interactive-dashboard/FilterManager.ts
  - src/plugins/interactive-dashboard/cards/MapCard.vue
  - src/plugins/interactive-dashboard/cards/ScatterPlotCard.vue
  - src/plugins/interactive-dashboard/cards/HistogramCard.vue
  - src/plugins/interactive-dashboard/cards/DataTableCard.vue
---

## Problem

The interactive dashboard can only display individual rows from the dataset. There is no way to aggregate filtered data (group-by + compute stats) before rendering. This forces pre-aggregation in external pipelines, which:

- Creates rigid groupings that can't respond to arbitrary filter combinations
- Multiplies CSV files for each aggregation level
- Breaks the "single dataset" linkage model
- Prevents multi-level analysis on one dashboard (e.g., trial-level scatter plots + cluster-level maps from the same granular dataset)

**Concrete use case:** Service area optimization dashboard needs to show:
- **Map**: cluster activation frequency (group by cluster, compute rate of `is_activated`) -- updates when filtering by subsidy level
- **Scatter plots**: trial-level KPIs (group by trial_id, take first value of profit/PKM) -- same filter
- **Pie charts**: filter controls on raw rows (no aggregation needed)

Currently this requires 2-3 pre-computed CSVs instead of one granular dataset.

## Solution

Add an optional `aggregate` config to card definitions. Each card independently aggregates the filtered data before rendering.

### YAML Schema

```yaml
- type: map
  aggregate:
    groupBy: cluster_uid              # string or string[] for multi-key
    metrics:
      - column: is_activated
        function: rate                # count(truthy) / count(*)
        as: activation_rate
      - column: service_rate
        function: mean
        as: avg_service_rate
      - column: requests_served
        function: sum
        as: total_requests_served

- type: scatter-plot
  aggregate:
    groupBy: trial_id
    metrics:
      - column: operational_profit
        function: first               # all rows have same value in group
        as: operational_profit
      - column: total_passenger_km
        function: first
        as: total_passenger_km
  xColumn: subsidy_per_km
  yColumn: total_passenger_km
```

### Aggregation Functions

| Function | Behavior | Use Case |
|---|---|---|
| `count` | Count rows in group | Number of trials per cluster |
| `count_true` | Count where value is truthy/True/"True" | Activation count |
| `rate` | count_true / count | Activation rate (0.0-1.0) |
| `sum` | Sum numeric values | Total demand served |
| `mean` | Average | Avg service rate |
| `min` / `max` | Extremes | Best/worst case |
| `first` | First value in group | Repeated values (trial KPIs on per-cluster rows) |
| `median` | Median value | Robust central tendency |

### Architecture

```
FilterManager emits filteredData
        │
        ▼
AggregationEngine.ts (new, ~150 lines)
  - Takes: filteredData rows + AggregateConfig
  - Returns: aggregated rows (one per group)
  - Memoized: only recomputes when filteredData or config changes
        │
        ▼
Card receives aggregated data instead of raw filteredData
  - Map: one row per geo feature → direct colorBy lookup
  - Scatter: one row per group → one point per group
  - Histogram: binned on aggregated values
  - Table: shows aggregated summary rows
```

### Implementation Steps

1. **`AggregationEngine.ts`** (~150 lines)
   - `interface AggregateConfig { groupBy: string | string[]; metrics: MetricDef[] }`
   - `function aggregate(rows: DataRow[], config: AggregateConfig): DataRow[]`
   - Handle edge cases: empty groups, NaN values, boolean string parsing
   - Memoize with WeakMap on filteredData reference

2. **Card integration** (~30 lines per card)
   - In each card's reactive data pipeline, check for `aggregate` config
   - If present, pipe filteredData through AggregationEngine before rendering
   - Aggregated columns available for colorBy, xColumn, yColumn, etc.

3. **Schema validation** (~20 lines)
   - Validate `aggregate.groupBy` column exists in dataset
   - Validate `aggregate.metrics[].column` exists
   - Validate `function` is one of the allowed values
   - Warn if `as` name conflicts with existing column

4. **Map-specific: aggregated colorBy** (~50 lines)
   - After aggregation, lookup geo feature by groupBy column → geoProperty match
   - Color by the aggregated metric column
   - Features not in aggregated result: gray/hidden

### Performance Considerations

- 18,000 rows with simple groupBy: <5ms (JavaScript Map-based grouping)
- Memoize on filteredData identity to avoid recomputation on unrelated state changes
- For very large datasets (>100k rows), consider Web Worker offloading

### Testing

- Unit test AggregationEngine with known inputs
- Integration test: filter pie chart → verify aggregated map colors update
- Edge cases: empty filtered set, single-row groups, all-same-value groups
