# Quick Task 005: Map Highlighted/Selected Features on Top

## Objective
Ensure that highlighted (hovered) and selected features on the map always render on top of other features.

## Problem
deck.gl uses GPU-based instanced rendering which doesn't guarantee features render in data array order. While `sortFeaturesByState` sorted the data, overlapping features might still render in unpredictable order.

## Solution
Create highlight overlay layers that render AFTER all normal layers:
1. Filter features to only those in `hoveredIds` or `selectedIds`
2. Create duplicate layers (polygon, line, arc, scatterplot) for these features
3. Add overlay layers at the END of the layer stack
4. Mark overlay layers as `pickable: false` (main layer handles interaction)

## Tasks

### Task 1: Add createHighlightOverlayLayer Function
**File:** `src/plugins/interactive-dashboard/components/cards/MapCard.vue`

Create factory function that:
- Takes layerConfig and features
- Filters to only highlighted/selected features using getFeatureId + setHasLoose
- Creates appropriate layer type with matching styling
- Returns null if no highlighted features

### Task 2: Integrate into updateLayers
**File:** `src/plugins/interactive-dashboard/components/cards/MapCard.vue`

After normal layer creation loop:
- Check if hoveredIds or selectedIds have any entries
- Loop through visible layers and create highlight overlays
- Push overlay layers to the end of the layers array
