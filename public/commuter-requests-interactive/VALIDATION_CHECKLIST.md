# Commuter Requests Dashboard - Feature Parity Validation

Compare the new interactive dashboard YAML against the original commuter-requests plugin.

## 20-Point Validation Checklist

### Data & Display (5 points)

- [ ] **1. Dashboard loads without errors**
  - Navigate to the interactive dashboard folder
  - Verify no console errors or loading failures
  - All data files load successfully

- [ ] **2. Map displays all layer types**
  - Cluster boundaries (polygons) are visible
  - Request flows (arcs) are visible
  - Request destinations (points) are visible
  - Cluster flows (arcs) appear when spatial/OD cluster type is selected

- [ ] **3. Histogram shows time distribution with 15-min bins**
  - Active time histogram displays with proper binning
  - X-axis shows time labels (HH:mm format)
  - Y-axis shows request counts
  - Bins are exactly 15 minutes (900 seconds) wide

- [ ] **4. Pie chart shows mode share with correct categories**
  - All transport modes are displayed (car, pt, bike, walk, drt, ride, etc.)
  - Percentages sum to 100%
  - Colors match the original plugin (car=red, pt=blue, bike=green, etc.)
  - Center shows total request count

- [ ] **5. Table displays all requests with formatted columns**
  - All expected columns are visible (except hidden ones: pax_id, origin, destination)
  - Time columns formatted as HH:mm:ss
  - Travel time formatted as minutes with 1 decimal
  - Distance formatted as km with 2 decimals
  - Table supports sorting by clicking column headers

### Histogram Filtering (3 points)

- [ ] **6. Clicking histogram bin filters table and map**
  - Click a histogram bin
  - Verify table shows only requests active during that time bin
  - Verify map highlights only matching requests
  - Verify other visualizations update accordingly

- [ ] **7. Multiple histogram bins can be selected (OR logic)**
  - Click multiple histogram bins
  - Verify table shows requests from ANY selected bin (OR logic)
  - Click a selected bin again to deselect it
  - Verify toggle behavior works correctly

- [ ] **8. Histogram selection affects pie chart display**
  - Select one or more histogram bins
  - Verify pie chart updates to show mode distribution of filtered requests
  - Verify comparison mode shows baseline vs filtered if enabled

### Pie Chart Filtering (3 points)

- [ ] **9. Clicking pie slice filters table and map**
  - Click a pie chart slice (e.g., "car")
  - Verify table shows only requests with that mode
  - Verify map highlights only matching requests
  - Verify histogram updates to show time distribution of that mode

- [ ] **10. Multiple pie slices can be selected (OR logic)**
  - Click multiple pie slices
  - Verify table shows requests from ANY selected mode (OR logic)
  - Click a selected slice again to deselect it
  - Verify toggle behavior works correctly

- [ ] **11. Pie chart selection affects histogram display**
  - Select one or more modes
  - Verify histogram updates to show time distribution of filtered requests
  - Verify comparison mode shows baseline vs filtered if enabled

### Map Interaction (4 points)

- [ ] **12. Clicking map feature filters table**
  - Click a request line/arc on the map
  - Verify table shows and highlights that request
  - Click a cluster boundary
  - Verify table shows only requests belonging to that cluster

- [ ] **13. Multi-select on map works (overlapping geometries)**
  - Click on an area where multiple clusters overlap
  - Verify all overlapping clusters are selected
  - Verify table shows requests from ALL selected clusters (OR logic)

- [ ] **14. Hover on map highlights table rows**
  - Hover over a request line on the map
  - Verify corresponding table row is highlighted
  - Verify table auto-scrolls to highlighted row (if scroll toggle is ON)
  - Hover over a cluster boundary
  - Verify requests in that cluster are highlighted in table

- [ ] **15. Map layer visibility can be toggled**
  - Change cluster type selector (origin → destination → spatial)
  - Verify cluster boundaries update accordingly
  - Verify cluster flow arrows appear only for spatial/OD type
  - Verify linkage updates correctly for each cluster type

### Combined Filtering (3 points)

- [ ] **16. Filters combine with AND logic between types**
  - Select a histogram bin (e.g., "06:00-06:15")
  - Select a mode (e.g., "car")
  - Select a cluster
  - Verify table shows ONLY requests that match ALL three conditions (AND logic)
  - Verify count decreases as more filters are added

- [ ] **17. Hover on table highlights map features**
  - Hover over a table row
  - Verify corresponding request line on map is highlighted
  - Verify hover highlighting is visually distinct (brighter color, thicker line)

- [ ] **18. Clear all filters button works**
  - Apply multiple filters (histogram + pie + map)
  - Click "Clear Filters" button
  - Verify ALL filters are cleared
  - Verify table shows all requests again
  - Verify visualizations return to full dataset view

### Performance & Polish (2 points)

- [ ] **19. Visual appearance similar to original**
  - Color schemes match original plugin
  - Layout proportions are similar (map 2/3 width, stats 1/3 width)
  - Card styling matches SimWrapper style
  - Typography and spacing are consistent
  - Dark mode support works correctly

- [ ] **20. Performance comparable (no lag)**
  - Dashboard loads within 3 seconds
  - Filtering operations are instantaneous (<100ms)
  - Hover highlighting is smooth (no flicker)
  - No memory leaks or console warnings
  - Map rendering is smooth when zooming/panning

## Testing Procedure

### 1. Load both versions

**Original:**
- Navigate to the folder containing the original commuter-requests plugin
- Note the URL structure and data files used

**New Interactive:**
- Navigate to `commuter-requests-interactive/` folder
- Verify `dashboard-commuter-requests-interactive.yaml` loads
- Ensure same data files are available (requests.csv, requests_geometries.geojson, cluster_geometries.geojson)

### 2. Side-by-side comparison

- Open both implementations in separate browser tabs/windows
- Arrange windows side-by-side on screen
- Perform identical interactions in both versions
- Compare visual appearance, behavior, and results

### 3. Record results

For each validation point:
- **PASS**: Feature works exactly as in original plugin
- **PARTIAL**: Feature works but with minor differences
- **FAIL**: Feature is broken or significantly different
- **N/A**: Feature cannot be tested (e.g., missing data)

Document any differences in behavior or appearance.

### 4. Performance testing

Use browser DevTools to measure:
- Initial load time (Network tab)
- Filter operation time (Performance tab)
- Memory usage (Memory profiler)
- Console warnings/errors (Console tab)

## Expected Outcome

**All 20 validation points should PASS**, demonstrating full feature parity between the original specialized plugin and the new generic InteractiveDashboard implementation.

Any failures indicate gaps in the InteractiveDashboard architecture that need to be addressed.

## Notes

- This validation serves as the PRIMARY acceptance test for the InteractiveDashboard approach
- Any features that cannot be replicated indicate architectural limitations
- Document all edge cases and special behaviors discovered during testing
- Consider this a living document - update as new features are added
