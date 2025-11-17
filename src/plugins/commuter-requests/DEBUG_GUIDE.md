# Debug Guide - Map Filtering & Comparison Toggle

## Issues Reported

1. **Map not showing filtered requests** - When any filter is active, no request lines appear on the map
2. **Comparison toggle not clickable** - The "Show Comparison" checkbox appears to not work

## Debug Logging Added

I've added comprehensive console logging to help diagnose the map issue. When you load the page and activate filters, you should see:

### In Browser Console

**When filtering occurs:**
```
Filtering geometries: {
  totalGeometries: 48,
  filteredRequests: 15,
  filteredRequestIds: [0, 1, 2, 3, 4],
  sampleGeomId: 0,
  filteredGeometries: 15
}
```

**When map updates:**
```
RequestsMap.updateLayers called: {
  geometriesCount: 15,
  requestsCount: 15,
  clusterBoundariesCount: 5
}
```

**When creating line layer:**
```
Creating LineLayer with geometries: {
  count: 15,
  sample: { type: "Feature", geometry: {...}, properties: {...} }
}
```

**If no geometries:**
```
No geometries to display on map
```

## Diagnostic Steps

### 1. Check if Filtering is Working

1. Open browser DevTools (F12)
2. Go to Console tab
3. Clear console
4. Click on a cluster polygon or histogram bar or mode slice
5. Look for the "Filtering geometries" log

**Expected behavior:**
- `filteredRequests` should be less than `totalGeometries`
- `filteredGeometries` should match `filteredRequests`
- `filteredRequestIds` and `sampleGeomId` should have matching types (both numbers or both strings)

**Possible issues:**
- If `filteredGeometries: 0` but `filteredRequests > 0`, the issue is ID mismatch
  - Check if `filteredRequestIds` contains numbers but `sampleGeomId` is a string (or vice versa)
  - This means `request.request_id` and `geom.properties.request_id` have different types

### 2. Check if Map is Receiving Updates

1. After clicking a filter, look for "RequestsMap.updateLayers called"
2. Check if `geometriesCount` matches the filtered count

**Expected behavior:**
- `geometriesCount` should match the number of filtered requests
- This log should appear every time you click a filter

**Possible issues:**
- If this log doesn't appear, the watcher isn't triggering
- If `geometriesCount: 0`, the geometries array is empty

### 3. Check LineLayer Creation

1. Look for "Creating LineLayer with geometries" or "No geometries to display on map"

**Expected behavior:**
- Should see "Creating LineLayer with geometries" with count > 0
- The `sample` object should show a valid GeoJSON Feature

**Possible issues:**
- If you see "No geometries to display on map", the filtered geometries array is empty
- If the LineLayer is created but lines don't appear, it's a rendering issue

## Known Potential Issues

### ID Type Mismatch
**Problem:** Request IDs in the CSV might be numbers (0, 1, 2) but GeoJSON properties might store them as strings ("0", "1", "2"), or vice versa.

**Solution:** Update the filtering logic to handle both types:
```typescript
const filteredRequestIds = new Set(
  this.filteredRequests.map((r) => String(r.request_id))
)
return this.requestGeometries.filter((geom) =>
  filteredRequestIds.has(String(geom.properties.request_id))
)
```

### Watcher Not Triggering
**Problem:** Vue might not detect changes to the computed `currentGeometries` if the array reference doesn't change.

**Solution:** Already added watcher for `geometries` prop in RequestsMap.vue

### GeoJSON Structure
**Problem:** The GeoJSON might not have `request_id` in properties, or it might be named differently.

**Solution:** Check the first geometry's properties structure and update the filter accordingly.

## Comparison Toggle

The comparison toggle should work fine - it's a standard checkbox with label.

**To test:**
1. Click anywhere on the "Show Comparison" button (the entire button is clickable)
2. The checkbox should toggle on/off
3. When on, you should see:
   - Histogram shows baseline (gray) and filtered (blue) bars
   - Pie chart shows outer ring for baseline
   - Stats show "Filtered / Baseline" row

**If it doesn't work:**
- Check browser console for JavaScript errors
- Check if there's a z-index issue (unlikely with z-index: 10 on controls-bar)
- Try clicking directly on the checkbox square

## Next Steps Based on Console Output

### If you see "filteredGeometries: 0" but "filteredRequests > 0":
→ ID type mismatch issue
→ Look at the sample data in console and share the output

### If you don't see "RequestsMap.updateLayers called":
→ Watcher not firing
→ Check if Vue reactivity is working

### If you see "Creating LineLayer" but no lines on map:
→ Rendering issue
→ Check if coordinates are valid
→ Check if map bounds include the line coordinates

## How to Share Debug Info

Please:
1. Open the plugin page
2. Open browser console (F12)
3. Clear console
4. Click on a filter (cluster/timebin/mode)
5. Copy ALL console output
6. Share it so I can diagnose the issue

Look specifically for:
- The "Filtering geometries" object
- The "RequestsMap.updateLayers called" object
- The "Creating LineLayer" or "No geometries" message
- Any error messages in red
