# Interactive Card Types Reference

This document describes the new interactive card types that can be used in SimWrapper dashboards.

## Overview

Interactive card types are special dashboard cards that can act as filters. When users click on elements (bins, slices), they emit filter events that are coordinated by the FilterManager to update other cards.

## Card Types

### histogram

Interactive histogram that acts as a clickable filter.

**Usage in YAML:**
```yaml
- type: histogram
  title: "Value Distribution"
  column: value
  binSize: 10
  width: 1
  height: 4
  linkage:
    type: filter
    column: value
    behavior: toggle
```

**Props:**
- `title` (optional, string) - Card title
- `column` (required, string) - Column name to bin
- `binSize` (optional, number) - Width of each bin (default: 1)
- `filteredData` (provided by wrapper, array) - Data to visualize
- `linkage` (optional, object) - Linkage configuration

**Linkage Configuration:**
- `type: 'filter'` - Emit filter events on click
- `column` - Column to filter (usually same as display column)
- `behavior: 'toggle'` - Click toggles bin selection

**Behavior:**
- Click a bin to toggle selection
- Multiple bins can be selected (OR logic)
- Selected bins shown in red (#ff6b6b)
- Unselected bins shown in blue (#4dabf7)
- Emits filter event with all selected bin values

**Example:**
```yaml
# Filter by travel time in 15-minute bins
- type: histogram
  title: "Travel Time Distribution"
  column: travel_time
  binSize: 900  # 15 minutes in seconds
  linkage:
    type: filter
    column: travel_time
    behavior: toggle
```

---

### pie-chart

Interactive pie chart that acts as a clickable filter.

**Usage in YAML:**
```yaml
- type: pie-chart
  title: "Category Distribution"
  column: category
  width: 1
  height: 4
  linkage:
    type: filter
    column: category
    behavior: toggle
```

**Props:**
- `title` (optional, string) - Card title
- `column` (required, string) - Categorical column name
- `filteredData` (provided by wrapper, array) - Data to visualize
- `linkage` (optional, object) - Linkage configuration

**Linkage Configuration:**
- `type: 'filter'` - Emit filter events on click
- `column` - Column to filter (usually same as display column)
- `behavior: 'toggle'` - Click toggles category selection

**Behavior:**
- Click a slice to toggle selection
- Multiple slices can be selected (OR logic)
- Selected slices shown in red (#ff6b6b)
- Unselected slices shown in blue (#4dabf7)
- Emits filter event with all selected categories

**Example:**
```yaml
# Filter by transportation mode
- type: pie-chart
  title: "Mode Share"
  column: main_mode
  linkage:
    type: filter
    column: main_mode
    behavior: toggle
```

---

## Coordination with Other Cards

Interactive cards work in coordination with other dashboard elements:

**Filter Logic:**
- **Within a card (OR)**: Selecting multiple bins/categories shows data matching ANY selection
- **Between cards (AND)**: Filters from different cards combine - data must match ALL active filters

**Example Scenario:**
1. User selects bins 20-40 and 60-80 in histogram
2. User selects "Category A" and "Category B" in pie chart
3. Result: Shows data where (value is 20-40 OR 60-80) AND (category is A OR B)

**Linked Map:**
Maps with `linkage` configuration will:
- Highlight features when hovered
- Filter to show only features matching active filters
- Update in real-time as filters change

**Linked Table:**
Tables with `source: table` will:
- Show only rows matching active filters
- Update counts and statistics
- Highlight selected rows

---

## Requirements for Interactive Mode

For interactive cards to work, the dashboard must have a `table` configuration:

```yaml
# Required: Centralized data table
table:
  name: "My Data"
  dataset: data.csv
  idColumn: id
  visible: true

# Then interactive cards can be used
layout:
  row1:
    - type: histogram
      column: value
      linkage:
        type: filter
        column: value
        behavior: toggle
```

Without a `table` section, the dashboard uses standard (non-interactive) mode.

---

## Technical Details

**Components:**
- `HistogramCard.vue` - Located at `src/components/interactive/HistogramCard.vue`
- `PieChartCard.vue` - Located at `src/components/interactive/PieChartCard.vue`

**Dependencies:**
- Plotly.js for chart rendering
- FilterManager for coordination
- LinkableCardWrapper for integration

**Events:**
- `filter` - Emitted on selection change: `(filterId: string, column: string, values: Set<any>)`

---

## Best Practices

1. **Bin Size Selection**: Choose bin sizes that make sense for your data distribution
2. **Category Naming**: Use clear, concise category names for better readability
3. **Card Sizing**: Histogram works well with width: 1-2, height: 4-6
4. **Pie Chart Sizing**: Pie chart works well with width: 1, height: 4-6
5. **Too Many Categories**: Pie charts work best with 3-8 categories; use histogram or bar chart for more
6. **Column Names**: Ensure column names in `column` and `linkage.column` match exactly

---

## Troubleshooting

**Cards not filtering:**
- Verify `table` section exists in dashboard YAML
- Check that `linkage.column` matches a column in the table dataset
- Ensure `column` prop matches a column name exactly

**Empty charts:**
- Verify `column` exists in the data
- Check for null/undefined values in the column
- Verify `filteredData` prop is being passed correctly

**Build errors:**
- Ensure card types are registered in `src/dash-panels/_allPanels.ts`
- Verify imports are correct: `@/components/interactive/HistogramCard.vue`
