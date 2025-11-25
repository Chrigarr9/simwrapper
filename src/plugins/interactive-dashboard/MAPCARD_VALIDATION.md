# MapCard Validation Checklist

**Date**: TBD
**Validator**: TBD
**MapCard Version**: 1.0

---

## Core Functionality

### Layer Rendering
- [ ] PolygonLayer renders Polygon geometries correctly
- [ ] PolygonLayer renders MultiPolygon geometries correctly
- [ ] LineLayer renders LineString geometries correctly
- [ ] ArcLayer renders arc flows correctly
- [ ] ScatterplotLayer renders Point geometries correctly
- [ ] Automatic destination markers appear for LineLayer
- [ ] Automatic arrow tips appear for ArcLayer
- [ ] All layers visible and positioned correctly

### Map Initialization
- [ ] MapLibre initializes without errors
- [ ] Map centers at configured location
- [ ] Map zoom level correct
- [ ] Light theme loads correctly
- [ ] Dark theme loads correctly
- [ ] Auto theme switching works
- [ ] Loading state displays during initialization
- [ ] Loading state clears after map loads

### Data Loading
- [ ] GeoJSON files load successfully
- [ ] CSV data loaded via DataTableManager
- [ ] Property filters applied correctly
- [ ] Deep cloning prevents Vue reactivity issues
- [ ] Failed loads don't crash component
- [ ] Empty layer data handled gracefully

---

## Interaction System

### Hover Behavior
- [ ] Hover highlights features (orange color)
- [ ] Hover emits to LinkageManager
- [ ] Coordinated hover updates other cards
- [ ] Hover clears when moving away
- [ ] Multi-object detection works (2px radius)
- [ ] Tooltip displays on hover
- [ ] Tooltip follows cursor

### Click/Selection Behavior
- [ ] Click selects features (blue color)
- [ ] Multi-select works (multiple features)
- [ ] Toggle behavior works (click again to deselect)
- [ ] Selection emits to LinkageManager
- [ ] Click on empty space clears selection
- [ ] Selection persists across other interactions
- [ ] Selected features render on top

### Filtering
- [ ] External filters (histogram, pie chart) affect map
- [ ] Filtered features highlighted correctly
- [ ] Unfiltered features dimmed when filters active
- [ ] Filter state updates in real-time
- [ ] Clear filters restores all features
- [ ] AND logic between different filters
- [ ] OR logic within same filter

---

## Visual Styling

### State-Based Styling
- [ ] Selected: Blue #3B82F6
- [ ] Hovered: Orange #FB923C
- [ ] Filtered: Normal colors
- [ ] Unfiltered (when filters active): Dimmed gray
- [ ] State priority: Selected > Hovered > Filtered > Dimmed

### Automatic Dimming
- [ ] Unfiltered features desaturated (avg with gray)
- [ ] Unfiltered line opacity: 60
- [ ] Unfiltered marker opacity: 80
- [ ] Unfiltered line width: 1px
- [ ] Unfiltered marker radius: 2px
- [ ] Dimming clears when all filters removed

### Color Management
- [ ] Categorical colors from config work
- [ ] Default mode colors applied
- [ ] Hash-based colors for unknown categories
- [ ] Numeric Viridis gradient displays correctly
- [ ] Color transitions smooth across gradient
- [ ] Manual scale override works
- [ ] Auto-calculated scale correct

### Attribute-Based Sizing
- [ ] Line width scales by attribute
- [ ] Point radius scales by attribute
- [ ] Width scale range respected
- [ ] Radius scale range respected
- [ ] Min/max auto-calculated correctly
- [ ] State multipliers applied on top of base size
- [ ] Invalid attributes fall back to base size

### Layer Ordering
- [ ] Explicit zIndex respected
- [ ] Layers without zIndex use array order
- [ ] Higher zIndex renders on top
- [ ] Automatic markers respect parent zIndex
- [ ] Layer order consistent across updates

---

## Advanced Features

### Tooltips
- [ ] Tooltips enabled/disabled by config
- [ ] Custom template substitution works
- [ ] Property values formatted correctly
- [ ] Missing properties show "N/A"
- [ ] HTML escaped (no XSS vulnerability)
- [ ] Theme-aware styling (dark/light)
- [ ] Tooltip max-width prevents overflow
- [ ] Default tooltip shows all properties

### ColorLegend
- [ ] Legend displays when enabled
- [ ] Categorical legend shows swatches
- [ ] Numeric legend shows gradient
- [ ] Legend positioned bottom-right
- [ ] Legend clickable when configured
- [ ] Click-to-filter emits correct filter
- [ ] Legend styling matches theme
- [ ] Legend hidden when disabled

### Comparison Mode
- [ ] Baseline layers render when enabled
- [ ] Baseline color: Gray 30% opacity
- [ ] Baseline layers not interactive
- [ ] Filtered layers render on top of baseline
- [ ] Toggle updates layers correctly
- [ ] All layer types support comparison
- [ ] Performance acceptable with doubled layers

---

## Integration

### InteractiveDashboard
- [ ] MapCard registered in _allPanels.ts
- [ ] Props passed correctly from dashboard
- [ ] filteredData prop updates map
- [ ] hoveredIds prop highlights features
- [ ] selectedIds prop selects features
- [ ] Event emits reach dashboard
- [ ] Filter events update FilterManager
- [ ] Hover events update LinkageManager
- [ ] Select events toggle in LinkageManager

### Coordination Managers
- [ ] FilterManager applies filters correctly
- [ ] LinkageManager coordinates hover state
- [ ] LinkageManager coordinates selection state
- [ ] DataTableManager provides data correctly
- [ ] LinkableCardWrapper passes slot props
- [ ] Observer pattern updates map reactively

---

## Performance

### Benchmarks
- [ ] <5,000 features: 60 FPS ✓
- [ ] 5,000-10,000 features: 30+ FPS ✓
- [ ] Map loads in <2 seconds
- [ ] Layer updates smooth (<100ms)
- [ ] No frame drops during interaction
- [ ] Memory usage stable (no leaks)

### Optimization
- [ ] UpdateTriggers specified for all accessors
- [ ] Deep cloning only at data load
- [ ] Computed properties cached
- [ ] Conditional layer rendering works
- [ ] Feature sorting efficient

---

## Error Handling

### Graceful Failures
- [ ] Missing GeoJSON file logged, not crashed
- [ ] Invalid geometry types handled
- [ ] Missing properties don't crash accessors
- [ ] Invalid colors fall back to defaults
- [ ] Network errors caught and logged
- [ ] Cleanup on component unmount

### Console Output
- [ ] No unhandled errors
- [ ] No unhandled warnings (except expected)
- [ ] Debug logs helpful
- [ ] Error messages clear and actionable

---

## Example YAML

### Comprehensive Example
- [ ] All layer types demonstrated
- [ ] Categorical coloring works
- [ ] Numeric coloring works
- [ ] Attribute-based sizing works
- [ ] Tooltip template works
- [ ] Legend displays correctly
- [ ] Filters coordinate with histogram/pie chart
- [ ] No console errors

### Minimal Example
- [ ] Minimal config works
- [ ] Defaults applied correctly
- [ ] Single layer renders
- [ ] Basic interaction functional

---

## Cross-Browser Testing

- [ ] Chrome/Chromium: All features work
- [ ] Firefox: All features work
- [ ] Safari: All features work
- [ ] Edge: All features work
- [ ] Mobile Chrome: Basic functionality works
- [ ] Mobile Safari: Basic functionality works

---

## Success Metrics

**All 10 criteria from INTERACTIVE_MAP_IMPLEMENTATION.md:**

1. [ ] All 5 layer types render correctly
2. [ ] Automatic destination markers work for lines/arcs
3. [ ] Multi-select and dimming function as expected
4. [ ] Coordinated hover via shared linkage works
5. [ ] ColorLegend displays and filters correctly
6. [ ] Comparison mode renders baseline geometries
7. [ ] Example dashboard replicates commuter-requests functionality
8. [ ] No console errors or warnings
9. [ ] Performance meets targets (<5k features at 60fps)
10. [ ] Documentation complete and accurate

---

## Known Issues

Document any issues found during validation:

1. Issue: [Description]
   - Severity: Critical / High / Medium / Low
   - Workaround: [If any]
   - Fix status: [Planned / In Progress / Fixed]

---

## Sign-Off

- [ ] All critical features validated
- [ ] Performance acceptable
- [ ] Documentation complete
- [ ] Ready for production use

**Validator Signature**: ___________________
**Date**: ___________________
