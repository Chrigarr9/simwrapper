# SimWrapper Design Refactor - Summary

## Changes Made

### 1. Replaced Custom Charts with Plotly Components ✅

**Created:**
- `ActiveTimeHistogramPlotly.vue` - Uses Plotly bar charts instead of custom SVG
- `MainModePieChartPlotly.vue` - Uses Plotly pie charts instead of custom SVG

**Benefits:**
- Consistent with SimWrapper's charting approach (uses VuePlotly component)
- Better interactivity (zoom, pan, hover tooltips)
- Automatic responsive sizing
- Dark mode support built-in
- Reduced custom code maintenance

**Key Features:**
- Click bars to filter by timebin (preserved)
- Comparison mode shows baseline vs filtered (preserved)
- Proper dark mode theming
- Hover tooltips with detailed info

### 2. Added Visual Panel Boxes with Borders ✅

**Changes:**
- Map section: Added border, border-radius, box-shadow
- Stats panels: Each chart/stat in its own `.panel-item` box
- Table panel: Proper border and shadow
- Controls bar: Enhanced with shadow and visual separation

**Result:**
- Clear visual hierarchy
- Distinct sections similar to SimWrapper's aggregate-od plugin
- Professional appearance with subtle shadows

### 3. Fixed Scrolling Layout ✅

**Changes:**
- Plugin container: Changed from `overflow-y: scroll` to `overflow-y: auto`
- Removed fixed `175vh` height constraints
- Top panel: Fixed at `60vh` with `min-height: 400px`
- Table panel: Flexible `flex: 1` with `min-height: 400px`
- Stats section: Proper `overflow-y: auto` for independent scrolling

**Result:**
- Page scrolls properly now
- Each section has appropriate sizing
- No overlapping content
- Stats panel scrolls independently when needed

### 4. Improved Control Visibility ✅

**Enhanced all control components:**
- `ClusterTypeSelector.vue` - Better contrast, hover states
- `FilterResetButton.vue` - Visible button styling, active/disabled states
- `ComparisonToggle.vue` - Button-like appearance with border

**Styling improvements:**
- Background: `var(--bgCream)` for better visibility
- Borders: `var(--borderStrong)` for clear definition
- Shadows: Subtle `box-shadow` for depth
- Hover: Clear visual feedback with `--bgHover` and border color change
- Active: Slight transform on click for tactile feedback

**Stats summary badge:**
- Highlighted background (`--bgCream`)
- Rounded corners
- Better visibility for request count

## Files Modified

1. **New Plotly Components:**
   - `/components/stats/ActiveTimeHistogramPlotly.vue` (new)
   - `/components/stats/MainModePieChartPlotly.vue` (new)

2. **Updated Components:**
   - `/components/stats/StatsPanel.vue` - Switched to Plotly components
   - `/CommuterRequests.vue` - Layout and styling fixes
   - `/components/controls/ClusterTypeSelector.vue` - Enhanced styling
   - `/components/controls/FilterResetButton.vue` - Enhanced styling
   - `/components/controls/ComparisonToggle.vue` - Enhanced styling

## Design Principles Applied

### SimWrapper Patterns

1. **Plotly for Charts** - Uses VuePlotly component (standard in SimWrapper)
2. **Panel Boxes** - Individual bordered sections with shadows
3. **CSS Variables** - All colors use SimWrapper's theme variables
4. **Responsive Design** - Flexbox layout that adapts to viewport
5. **Visual Hierarchy** - Clear separation between sections

### Layout Structure

```
┌─────────────────────────────────────────────────┐
│ Controls Bar (sticky, shadowed)                │
├─────────────────────┬───────────────────────────┤
│ Map Section (70%)   │ Stats Section (30%)      │
│ - Bordered box      │ - Scrollable panels      │
│ - Cluster polygons  │ - Histogram (Plotly)     │
│ - Request lines     │ - Pie chart (Plotly)     │
│                     │ - Summary stats          │
├─────────────────────────────────────────────────┤
│ Table Panel (flexible height, bordered)        │
│ - Sortable columns                             │
│ - Export CSV                                   │
└─────────────────────────────────────────────────┘
```

## Testing Checklist

After refreshing the page, verify:

- [ ] Page scrolls smoothly
- [ ] All sections have clear visual borders
- [ ] Controls are visible with good contrast
- [ ] Histogram uses Plotly (interactive bars)
- [ ] Pie chart uses Plotly (interactive slices)
- [ ] Click histogram bars → filters requests
- [ ] Click cluster polygons → filters requests
- [ ] Reset button is clearly visible
- [ ] Comparison mode works with both charts
- [ ] Dark mode adapts all colors properly
- [ ] Stats panel scrolls independently if needed

## Next Steps (Optional)

1. **Performance:**
   - Add virtualized scrolling for 1000+ requests in table
   - Debounce filter operations for large datasets

2. **Features:**
   - Map highlighting when table row selected
   - Additional Plotly charts (travel time distribution, etc.)
   - Export filtered data as GeoJSON

3. **Polish:**
   - Add loading spinners for data operations
   - Add tooltips for controls explaining functionality
   - Add keyboard shortcuts for common operations
