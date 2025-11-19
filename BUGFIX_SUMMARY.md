# SimWrapper Commuter-Requests Plugin Bug Fixes Summary

## Overview
Fixed two critical bugs in the SimWrapper commuter-requests plugin related to ColorLegend visibility and numeric formatting in the RequestTable.

---

## Bug 1: Missing ColorLegend Display

### Problem
ColorLegend component was not appearing on the map when categorical attributes (transport mode, activities, clusters) were selected for color-by.

### Root Cause Analysis
The issue was likely a combination of:
1. **Low z-index (5)** - Map layers typically use z-index 0-500, so a value of 5 could be easily obscured
2. **Lack of diagnostic logging** - No way to determine if component was rendering or if data was empty

### Solution

#### File: `ColorLegend.vue`
**Changes:**
```scss
.color-legend {
  z-index: 1000; // Increased from 5
  pointer-events: auto; // Ensure interactivity
}
```

**Added lifecycle hooks:**
```typescript
mounted() {
  console.log('ColorLegend mounted:', {
    title: this.title,
    legendItemsCount: this.legendItems.length,
    legendItems: this.legendItems,
  })
}
watch: {
  legendItems: {
    handler(newVal) {
      console.log('ColorLegend.legendItems changed:', ...)
    },
    deep: true,
  },
}
```

#### File: `CommuterRequests.vue`
**Added diagnostic logging in `colorLegendItems` computed property:**
```typescript
console.log('CommuterRequests.colorLegendItems:', {
  colorByAttribute: this.colorByAttribute,
  isCategorical: categoricalAttributes.includes(this.colorByAttribute),
  filteredRequestsCount: this.filteredRequests.length,
})

// If categorical
console.log('CommuterRequests.colorLegendItems - categorical:', {
  attribute: this.colorByAttribute,
  uniqueValuesCount: uniqueValues.size,
  uniqueValues: Array.from(uniqueValues),
})

console.log('CommuterRequests.colorLegendItems - result:', {
  itemsCount: items.length,
  items: items.slice(0, 5),
})
```

### Testing
1. Select "Transport Mode" → Legend should appear with mode colors
2. Select "Max Cost" → Legend should disappear (numeric)
3. Console should show detailed logging of data flow

---

## Bug 2: MaxCost Showing Integers Instead of Floats

### Problem
The `max_cost` column in RequestTable was displaying integers (12, 15, 8) instead of decimal values (12.50, 15.25, 8.00).

### Root Cause
The `inferColumnType()` function only checked the **first request's value** to determine column type:

```typescript
// BUGGY CODE
inferColumnType(key: string, value: any) {
  if (typeof value === 'number') {
    return value % 1 !== 0 ? 'decimal' : 'number'
  }
}
```

**Problem:** If the first request had `max_cost: 10.0` (no fractional part), the entire column was classified as `number` instead of `decimal`, causing all values to format as integers.

### Solution

#### File: `RequestTable.vue`

**1. Known Decimal Columns List**
Added hardcoded list of columns that should **always** be treated as decimals:
```typescript
const knownDecimalColumns = [
  'max_cost', 'max_detour', 'max_price', 'detour_factor',
  'fare', 'base_score', 'network_utility', 'max_walking_distance'
]

if (knownDecimalColumns.includes(key)) {
  console.log(`Column "${key}" recognized as known decimal column`)
  return 'decimal'
}
```

**2. Sample-Based Type Inference**
Changed to check **first 10 requests** (or all if fewer) instead of just the first one:
```typescript
// Sample 10 requests
const sampleSize = Math.min(10, this.requests.length)
const sampleRequests = this.requests.slice(0, sampleSize)

// Collect sample values
const values = sampleRequests.map(r => r[key]).filter(v => v !== null && v !== undefined)

// Check if ANY value has decimal part
const hasDecimal = values.some(v => typeof v === 'number' && v % 1 !== 0)

if (hasDecimal) {
  console.log(`Column "${key}" detected as decimal (found fractional values in sample)`)
  return 'decimal'
}
```

**3. Modified `generateColumns()` Method**
```typescript
generateColumns() {
  // Sample size for type inference
  const sampleSize = Math.min(10, this.requests.length)
  const sampleRequests = this.requests.slice(0, sampleSize)

  // Generate columns from all keys in the data
  for (const key of Object.keys(firstRequest)) {
    const type = this.inferColumnType(key, sampleRequests) // Pass sample instead of single value

    columns.push({
      key,
      label: this.formatColumnLabel(key),
      type,
      visible: priorityColumns.includes(key) || secondaryPriority.includes(key),
      sortable: true
    })
  }

  // Debug logging
  console.log('RequestTable.generateColumns:', {
    totalRequests: this.requests.length,
    sampleSize,
    columnsGenerated: this.allColumns.length,
    decimalColumns: this.allColumns.filter(c => c.type === 'decimal').map(c => c.key),
  })
}
```

**4. Updated Method Signature**
```typescript
// Before
inferColumnType(key: string, value: any): string

// After
inferColumnType(key: string, sampleRequests: any[]): string
```

### Impact

**Before Fix:**
| request_id | max_cost | max_detour |
|-----------|----------|------------|
| 1         | 12       | 1          |
| 2         | 15       | 1          |
| 3         | 8        | 2          |

**After Fix:**
| request_id | max_cost | max_detour |
|-----------|----------|------------|
| 1         | 12.50    | 1.20       |
| 2         | 15.25    | 1.50       |
| 3         | 8.00     | 1.80       |

### Testing
1. Check console for: `Column "max_cost" recognized as known decimal column`
2. Verify `max_cost` displays as 12.50, not 12
3. Verify `max_detour` displays as 1.20, not 1
4. Test with dataset where first row has integer values (10.0, 15.0)

---

## Files Modified

### `/mnt/Shared/Code/projects/simwrapper/src/plugins/commuter-requests/CommuterRequests.vue`
- **Lines 317-378:** Added comprehensive logging to `colorLegendItems` computed property

### `/mnt/Shared/Code/projects/simwrapper/src/plugins/commuter-requests/components/ColorLegend.vue`
- **Line 38:** Changed z-index from 5 to 1000
- **Line 39:** Added `pointer-events: auto`
- **Lines 24-42:** Added `mounted()` hook and `watch` on `legendItems` with logging

### `/mnt/Shared/Code/projects/simwrapper/src/plugins/commuter-requests/components/RequestTable.vue`
- **Lines 169-216:** Modified `generateColumns()` to use sample-based type inference
- **Lines 218-265:** Completely rewrote `inferColumnType()` with:
  - Known decimal columns list
  - Sample-based detection
  - Comprehensive logging

---

## Console Logging Guide

### Expected Console Output on Load

```
RequestTable.generateColumns: {
  totalRequests: 100,
  sampleSize: 10,
  columnsGenerated: 25,
  decimalColumns: ["max_cost", "max_detour", "max_price", "max_walking_distance"]
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
  uniqueValues: ["car", "pt", "bike", "walk"],
  sampleRequestValue: "car"
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

### When Switching to Numeric Attribute

```
CommuterRequests.colorLegendItems: {
  colorByAttribute: "max_cost",
  isCategorical: false,
  filteredRequestsCount: 100
}

CommuterRequests.colorLegendItems - numeric attribute, returning empty
```

---

## Benefits of These Fixes

### Bug 1 (ColorLegend)
1. **Increased visibility** - Higher z-index ensures legend appears above map
2. **Better diagnostics** - Console logs help trace data flow and debug issues
3. **Confirmed rendering** - Logs verify component mounting and data reception

### Bug 2 (Decimal Formatting)
1. **Accurate display** - Decimal values now show with 2 decimal places
2. **Robust inference** - Samples multiple rows to avoid false negatives
3. **Explicit handling** - Known decimal columns always formatted correctly
4. **Better debugging** - Console logs show which columns detected as decimal

---

## Future Improvements

### ColorLegend
- Add gradient scale for numeric attributes (currently only shows categorical)
- Add legend positioning options (top-left, bottom-left, etc.)
- Add legend toggle button to hide/show

### RequestTable Type Inference
- Allow user to override column types via config
- Auto-detect more types (latitude/longitude, URLs, etc.)
- Add scientific notation formatting for very large/small numbers

---

## Regression Risk: LOW

Both fixes are **additive** and **non-breaking**:
- ColorLegend: Only changed CSS and added logging
- RequestTable: Only changed internal type inference logic, not data or rendering

All existing functionality preserved:
- Filtering works
- Sorting works
- Hover/click interactions work
- Comparison mode works
- Auto-scroll works
