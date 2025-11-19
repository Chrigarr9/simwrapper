# Testing Guide for Recent Fixes

## Fixes Applied

### 1. parseTimeBin Error Fix
**File:** `utils/dataLoader.ts:69-93`

**Problem:**
- Plotly click events emit single time format "08:00"
- Function expected range format "08:00-08:15"
- Resulted in `TypeError: can't access property "trim", timeStr is undefined`

**Solution:**
- Added conditional logic to detect format
- If label contains '-': parse as range
- If label is single time: calculate end using binSize (default 15min)

**Testing:**
1. Open browser console (F12)
2. Click on any histogram bar
3. Should NOT see `parseTimeBin` error
4. Should see console log: "Timebin clicked: 08:00, Selected: Array ['08:00']"
5. Requests should filter correctly based on timebin

### 2. Scrolling Fix
**File:** `CommuterRequests.vue:314-342`

**Problem:**
- Dashboard content exceeded viewport height
- Page wouldn't scroll to view bottom content (table)

**Solution:**
- Parent `.commuter-requests-plugin`: `overflow: hidden` (doesn't scroll)
- Child `.dashboard-container`: `overflow-y: auto` + `min-height: 0` (scrolls)
- This is the correct flex scrolling pattern

**Testing:**
1. Load the page
2. Verify controls bar is visible at top
3. Verify map and stats panels are visible
4. **Scroll down** - page should scroll smoothly
5. Table should be visible when scrolled to bottom
6. All three sections (controls, top-panel, table) should be accessible

## Manual Testing Checklist

### Visual Design
- [ ] Controls bar has clear buttons with borders and hover effects
- [ ] Each section (map, stats, table) has its own panel box with borders
- [ ] Stats panels have proper spacing and borders
- [ ] Histogram uses Plotly bar chart (matches SimWrapper style)
- [ ] Pie chart uses Plotly donut chart
- [ ] Dark mode works correctly (toggle in SimWrapper settings)

### Functionality
- [ ] Click histogram bars → filters requests by timebin
- [ ] Click cluster polygons → filters requests by cluster
- [ ] Click "Reset Filters" → clears all selections
- [ ] Toggle "Show Comparison" → shows baseline data
- [ ] Change cluster type dropdown → switches cluster boundaries
- [ ] Table shows filtered requests correctly
- [ ] Request count updates: "X / Y requests"

### Console Errors
- [ ] No `parseTimeBin` errors when clicking histogram
- [ ] No duplicate Vue key warnings
- [ ] No SVG transform NaN errors
- [ ] No other JavaScript errors

### Performance
- [ ] Page loads in reasonable time (<5 seconds)
- [ ] Scrolling is smooth
- [ ] Map interactions are responsive
- [ ] Filter updates happen quickly

## Known Issues

None currently - all reported issues have been addressed.

## Browser Testing

Recommended browsers:
- Chrome/Chromium (latest)
- Firefox (latest)
- Safari (latest)

Test URL:
```
http://localhost:5173/local/outputs/test-export-optimized/simwrapper/viz-commuter-requests.yaml
```

## Additional Notes

- Chromium installation for Playwright MCP requires sudo access
- Manual browser testing recommended as alternative
- All fixes follow Vue 2 Options API and SimWrapper patterns
- Uses SimWrapper's VuePlotly component for charts
- CSS variables ensure theme consistency
