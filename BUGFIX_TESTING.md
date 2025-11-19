# SimWrapper Commuter-Requests Plugin Bug Fixes

## Testing Checklist

### Bug 1: ColorLegend Not Displaying

**Files Changed:**
- `/mnt/Shared/Code/projects/simwrapper/src/plugins/commuter-requests/components/ColorLegend.vue`
- `/mnt/Shared/Code/projects/simwrapper/src/plugins/commuter-requests/CommuterRequests.vue`

**Changes Made:**
1. Increased z-index from 5 to 1000 to ensure legend appears above map layers
2. Added `pointer-events: auto` to ensure legend is interactive
3. Added comprehensive console logging to trace data flow:
   - `CommuterRequests.colorLegendItems` - logs attribute type, filtered request count
   - `ColorLegend` component - logs on mount and when items change

**Test Steps:**

1. **Open Browser Console** (F12) before loading the plugin

2. **Load the Commuter Requests Plugin**
   - URL: `http://localhost:8080/...` (your SimWrapper instance)

3. **Test with Categorical Attribute (should show legend):**
   - Select "Transport Mode" from color-by dropdown
   - **Expected Console Output:**
     ```
     CommuterRequests.colorLegendItems: {
       colorByAttribute: "main_mode",
       isCategorical: true,
       filteredRequestsCount: <number>
     }
     CommuterRequests.colorLegendItems - categorical: {
       attribute: "main_mode",
       uniqueValuesCount: <number>,
       uniqueValues: ["car", "pt", "bike", "walk", ...]
     }
     CommuterRequests.colorLegendItems - result: {
       itemsCount: <number>,
       items: [{ label: "car", color: "#e74c3c" }, ...]
     }
     ColorLegend mounted: {
       title: "Transport Mode",
       legendItemsCount: <number>,
       legendItems: [...]
     }
     ```
   - **Expected Visual Result:**
     - Legend appears in **bottom-right corner** of map
     - Shows color swatches for each mode (car=red, pt=blue, bike=green, walk=orange)
     - Legend title: "Transport Mode"

4. **Test with Numeric Attribute (should hide legend):**
   - Select "Max Cost" from color-by dropdown
   - **Expected Console Output:**
     ```
     CommuterRequests.colorLegendItems: {
       colorByAttribute: "max_cost",
       isCategorical: false,
       filteredRequestsCount: <number>
     }
     CommuterRequests.colorLegendItems - numeric attribute, returning empty
     ```
   - **Expected Visual Result:**
     - Legend **disappears** (v-if condition not met)

5. **Test with Cluster Attribute:**
   - Select cluster type: "Origin Clusters"
   - Select color-by: "Origin Cluster"
   - **Expected Visual Result:**
     - Legend appears with cluster IDs (0, 1, 2, ...) and hash-based colors

**Debugging If Legend Still Missing:**

If legend doesn't appear, check console for:
- `colorLegendItems.length > 0` - should be true for categorical attributes
- `ColorLegend mounted` - if missing, component not rendering
- CSS z-index conflicts - inspect element to verify positioning
- Check if `filteredRequests` is empty - legend won't show if no requests

---

### Bug 2: MaxCost Showing Integers Instead of Decimals

**File Changed:**
- `/mnt/Shared/Code/projects/simwrapper/src/plugins/commuter-requests/components/RequestTable.vue`

**Root Cause:**
The `inferColumnType()` function was only checking the **first request's value**. If the first request had `max_cost: 10.0` (no fractional part), it was classified as `number` instead of `decimal`, causing all values to display without decimal places.

**Solution Implemented:**
1. **Known Decimal Columns List:** Added hardcoded list of columns that should always be treated as decimals:
   - `max_cost`, `max_detour`, `max_price`, `detour_factor`, `fare`, `base_score`, `network_utility`, `max_walking_distance`

2. **Sample-Based Type Inference:** Check **first 10 requests** (or all if fewer) to detect if ANY value has a decimal part

3. **Debug Logging:** Added console logs to trace column type inference:
   ```javascript
   console.log('RequestTable.generateColumns:', {
     totalRequests: this.requests.length,
     sampleSize,
     columnsGenerated: this.allColumns.length,
     decimalColumns: ['max_cost', 'max_detour', ...],
   })
   ```

**Test Steps:**

1. **Open Browser Console** (F12)

2. **Load Plugin and Check Console:**
   - **Expected Output:**
     ```
     RequestTable.generateColumns: {
       totalRequests: 100,
       sampleSize: 10,
       columnsGenerated: 25,
       decimalColumns: ["max_cost", "max_detour", "max_price", ...]
     }
     Column "max_cost" recognized as known decimal column
     Column "max_detour" recognized as known decimal column
     ```

3. **Inspect Table Columns:**

   **Max Cost Column:**
   - **Before Fix:** 12, 15, 8, 10 (integers)
   - **After Fix:** 12.50, 15.25, 8.00, 10.00 (2 decimal places)

   **Max Detour Column:**
   - **Before Fix:** 1, 1, 2 (integers)
   - **After Fix:** 1.20, 1.50, 1.80 (2 decimal places)

4. **Test Edge Cases:**

   a. **Dataset with all integer values:**
      - If `max_cost` values are [10, 15, 20] (all integers)
      - Should still display as: 10.00, 15.00, 20.00 (known decimal column)

   b. **Dataset with mixed values:**
      - If `max_cost` values are [10, 12.5, 15.25]
      - Should display as: 10.00, 12.50, 15.25

   c. **Unknown numeric column:**
      - If column `my_custom_metric` has values [5, 10, 15]
      - Will display as: 5, 10, 15 (integer, not in known list)
      - If ANY value is 5.5, all will display as: 5.00, 10.00, 15.00, 5.50

**Debugging If Still Showing Integers:**

1. Check console for `Column "max_cost" recognized as known decimal column`
   - If missing, column name doesn't match known list

2. Check `allColumns` array in Vue DevTools:
   - Find `max_cost` column
   - Verify `type: "decimal"` (not `type: "number"`)

3. Check `formatValue()` method is being called with correct type:
   - Should call: `value.toFixed(2)` for decimals
   - Should call: `value.toFixed(0)` for integers

---

## Summary of Changes

### CommuterRequests.vue
- Added debug logging to `colorLegendItems` computed property
- Logs attribute type, unique values, and generated legend items

### ColorLegend.vue
- Increased z-index: 5 → 1000
- Added `pointer-events: auto`
- Added `mounted()` hook with logging
- Added `watch` on `legendItems` with logging

### RequestTable.vue
- Modified `generateColumns()` to sample 10 requests for type inference
- Modified `inferColumnType()` to:
  1. Check known decimal columns list first
  2. Sample multiple requests instead of just first one
  3. Detect if ANY sample value has decimal part
- Added comprehensive debug logging

---

## Expected Console Output (Full Flow)

When plugin loads successfully:

```
Commuter Requests plugin loaded: {
  requests: 100,
  geometries: 100,
  clusters: { origin: 5, destination: 8, spatial: 12 }
}

RequestTable.generateColumns: {
  totalRequests: 100,
  sampleSize: 10,
  columnsGenerated: 25,
  decimalColumns: ["max_cost", "max_detour", "max_price", ...]
}

Column "max_cost" recognized as known decimal column
Column "max_detour" recognized as known decimal column
Column "max_walking_distance" recognized as known decimal column

CommuterRequests.colorLegendItems: {
  colorByAttribute: "main_mode",
  isCategorical: true,
  filteredRequestsCount: 100
}

CommuterRequests.colorLegendItems - categorical: {
  attribute: "main_mode",
  uniqueValuesCount: 4,
  uniqueValues: ["car", "pt", "bike", "walk"]
}

CommuterRequests.colorLegendItems - result: {
  itemsCount: 4,
  items: [
    { label: "car", color: "#e74c3c" },
    { label: "pt", color: "#3498db" },
    { label: "bike", color: "#2ecc71" },
    { label: "walk", color: "#f39c12" }
  ]
}

ColorLegend mounted: {
  title: "Transport Mode",
  legendItemsCount: 4,
  legendItems: [...]
}
```

---

## Regression Testing

After fixes, verify these features still work:

1. **Filtering:**
   - Click on cluster boundaries → requests filter
   - Click on timebin in histogram → requests filter
   - Click on mode in pie chart → requests filter

2. **Table Sorting:**
   - Click column headers → sorts ascending/descending
   - Filtered requests stay on top

3. **Map Interactions:**
   - Hover over request → highlights in table
   - Click request → adds to selection
   - Cluster boundaries visible

4. **Comparison Mode:**
   - Toggle comparison → baseline shown as gray
   - Filtered requests shown in color

5. **Auto-scroll:**
   - Toggle auto-scroll
   - Hover on map → table scrolls to request
   - Hover on table → doesn't trigger scroll loop
