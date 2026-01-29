# Quick Task 005 Summary: Map Highlighted Features on Top

## Completed: 2026-01-29

## Problem
deck.gl's GPU-based instanced rendering doesn't guarantee render order matches data array order. Even with `sortFeaturesByState` sorting the data, highlighted features could still appear behind other features due to z-buffer conflicts.

## Solution
Create highlight **overlay layers** that render AFTER normal layers:

```
Render order (back to front):
1. Baseline layers (comparison mode)
2. Normal layers (all features)
3. Highlight overlay layers (only hovered/selected features) ← NEW
```

## Changes Made

### MapCard.vue (+139 lines)

**New function: `createHighlightOverlayLayer()`**
- Filters features to only those in `hoveredIds` or `selectedIds`
- Creates matching layer type (polygon, line, arc, scatterplot)
- Non-pickable (main layer handles click/hover events)
- Uses same styling functions for consistent colors

**Updated: `updateLayers()`**
- Check if any features are highlighted (`hoveredIds.size > 0 || selectedIds.size > 0`)
- Loop through visible layers and create highlight overlays
- Push overlays at END of layer array (renders on top)

## Layer Types Supported
- `polygon` / `fill` - PolygonLayer overlay
- `line` - LineLayer overlay
- `arc` - ArcLayer overlay
- `scatterplot` / `circle` / `point` - ScatterplotLayer overlay with 1.3x size + white outline

## Verification
- TypeScript compiles (only pre-existing deck.gl errors in node_modules)
- Highlight features now always visible on top
- Interaction still works via main layer (overlay is non-pickable)

## Commit
`75597d89`
