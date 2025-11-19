# SimWrapper Commuter-Requests Plugin - Debugging Quick Reference

## Open Browser Console First!
**Press F12** before loading the plugin to see all diagnostic logs.

---

## ColorLegend Not Showing?

### Check These Console Logs (in order):

#### 1. Is data loading?
```
✓ Commuter Requests plugin loaded: {
    requests: 100,
    geometries: 100,
    clusters: {...}
  }
```
**If missing:** Plugin failed to load data. Check network tab for 404s.

#### 2. Is attribute categorical?
```
✓ CommuterRequests.colorLegendItems: {
    colorByAttribute: "main_mode",
    isCategorical: true,           <-- Must be true!
    filteredRequestsCount: 100
  }
```
**If `isCategorical: false`:** You selected a numeric attribute (max_cost, distance, etc.)
Legend only shows for: `main_mode`, `start_activity_type`, `end_activity_type`, cluster columns

#### 3. Are there unique values?
```
✓ CommuterRequests.colorLegendItems - categorical: {
    attribute: "main_mode",
    uniqueValuesCount: 4,          <-- Must be > 0!
    uniqueValues: ["car", "pt", "bike", "walk"]
  }
```
**If `uniqueValuesCount: 0`:** No requests have this attribute. Check data schema.

#### 4. Are legend items generated?
```
✓ CommuterRequests.colorLegendItems - result: {
    itemsCount: 4,                 <-- Must be > 0!
    items: [
      { label: "car", color: "#e74c3c" },
      ...
    ]
  }
```
**If `itemsCount: 0`:** Bug in `getColorForValue()` or mapping logic.

#### 5. Is component mounting?
```
✓ ColorLegend mounted: {
    title: "Transport Mode",
    legendItemsCount: 4,
    legendItems: [...]
  }
```
**If missing:** Component not rendering. Check `v-if="colorLegendItems.length > 0"` in template.

### Visual Debugging

1. **Inspect Element** on map area
2. Look for `.color-legend` div
3. Check computed styles:
   - `z-index: 1000` ✓
   - `position: absolute` ✓
   - `bottom: 2rem; right: 2rem` ✓
4. If element exists but invisible, check parent `overflow: hidden`

---

## Decimal Values Showing as Integers?

### Check These Console Logs:

#### 1. Are columns being generated?
```
✓ RequestTable.generateColumns: {
    totalRequests: 100,
    sampleSize: 10,
    columnsGenerated: 25,
    decimalColumns: ["max_cost", "max_detour", ...]
  }
```
**If missing:** Table not initializing. Check `this.requests.length > 0`.

#### 2. Are decimal columns recognized?
```
✓ Column "max_cost" recognized as known decimal column
✓ Column "max_detour" recognized as known decimal column
```
**If missing for your column:** Column name not in `knownDecimalColumns` list.

#### 3. Inspect `allColumns` array
Open Vue DevTools → Component → RequestTable → Data → `allColumns`

Find your column (e.g., `max_cost`):
```javascript
{
  key: "max_cost",
  label: "Max Cost",
  type: "decimal",     <-- Must be "decimal", not "number"!
  visible: true,
  sortable: true
}
```

**If `type: "number"`:**
- Column not in known list
- No fractional values in first 10 rows
- Add to `knownDecimalColumns` or add fractional values to data

### Visual Verification

Check table values:
- **Correct:** 12.50, 15.25, 8.00
- **Wrong:** 12, 15, 8

---

## Common Issues & Solutions

### Issue: "Legend shows for wrong attributes"

**Symptom:** Legend appears for numeric attributes or disappears for categorical ones

**Solution:** Check `categoricalAttributes` array in `CommuterRequests.vue` line 319-328
```typescript
const categoricalAttributes = [
  'main_mode',
  'start_activity_type',
  'end_activity_type',
  'origin_cluster',
  'destination_cluster',
  'od_cluster',
  'temporal_cluster',
  'cluster',
]
```

Add your custom categorical column to this list.

---

### Issue: "Decimal column shows integers even after fix"

**Symptom:** `max_cost` still shows 12 instead of 12.50

**Diagnostic Steps:**

1. Check console for type recognition:
   ```
   Column "max_cost" recognized as known decimal column
   ```

2. If missing, check spelling in `knownDecimalColumns`:
   ```typescript
   const knownDecimalColumns = [
     'max_cost',  // Make sure spelling matches exactly!
     'max_detour',
     ...
   ]
   ```

3. If column has different name (e.g., `maxCost`, `max_price`), add to list:
   ```typescript
   const knownDecimalColumns = [
     'max_cost',
     'maxCost',      // Add alternative spellings
     'max_price',    // Add related columns
     ...
   ]
   ```

4. Clear browser cache and hard reload (Ctrl+Shift+R)

---

### Issue: "Legend appears but colors are all gray"

**Symptom:** Legend renders but all swatches are `#999999` or `#808080`

**Solution:** Check `getColorForValue()` method in `CommuterRequests.vue`

1. Console log color assignment:
   ```typescript
   getColorForValue(attribute: string, value: any): string {
     console.log('Getting color for:', { attribute, value })
     // ...
   }
   ```

2. Verify attribute name matches color scheme:
   - `main_mode` → `modeColors` object
   - `start_activity_type` / `end_activity_type` → `activityColors` object
   - Cluster columns → `getClusterColorHex()` function

---

### Issue: "Table doesn't show my custom column"

**Symptom:** Column exists in data but not visible in table

**Solution:**

1. Check `generateColumns()` - it reads from `Object.keys(firstRequest)`
2. Verify data schema: `console.log('First request:', this.requests[0])`
3. Add to `secondaryPriority` to make visible by default:
   ```typescript
   const secondaryPriority = [
     'main_mode', 'travel_time', 'distance',
     'my_custom_column',  // Add here
     ...
   ]
   ```

---

## Quick Console Commands

### Check if ColorLegend is in DOM
```javascript
document.querySelector('.color-legend')
// Should return: <div class="color-legend">...</div>
// If null, component not rendered
```

### Check z-index of legend
```javascript
getComputedStyle(document.querySelector('.color-legend')).zIndex
// Should return: "1000"
```

### Check column types
```javascript
// In Vue DevTools console
$vm.allColumns.filter(c => c.type === 'decimal')
// Should return array of decimal columns
```

### Force regenerate columns
```javascript
// In Vue DevTools console
$vm.generateColumns()
// Check console for new logs
```

---

## Before Reporting a Bug

Provide these diagnostic outputs:

1. **Console logs** (copy full output)
2. **Vue DevTools screenshot** of:
   - `CommuterRequests` component data
   - `RequestTable.allColumns` array
3. **Sample data** (first 3 rows of CSV)
4. **Browser info** (Chrome/Firefox + version)
5. **Steps to reproduce**

---

## Testing Checklist

- [ ] Console open (F12)
- [ ] Plugin loads without errors
- [ ] Select "Transport Mode" → Legend appears
- [ ] Select "Max Cost" → Legend disappears
- [ ] Table shows `max_cost` as 12.50 (not 12)
- [ ] Console shows "Column 'max_cost' recognized as known decimal column"
- [ ] No JavaScript errors in console
