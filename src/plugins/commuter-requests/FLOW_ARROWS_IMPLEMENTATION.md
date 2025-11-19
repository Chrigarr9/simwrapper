# Cluster Flow Arrows Implementation

## Overview
Added a new Deck.gl LineLayer to display cluster flow arrows in the RequestsMap component. Flow arrows visualize origin-destination relationships between spatial clusters.

## Files Modified

### 1. `/mnt/Shared/Code/projects/simwrapper/src/plugins/commuter-requests/components/RequestsMap.vue`

#### Imports
- Added `PathStyleExtension` from `@deck.gl/extensions` for enhanced line styling

#### Data Properties
- Added `hoveredFlowId: string | null` to track hovered flow for highlighting

#### Computed Properties
- **`clusterFlows()`**: Extracts flow features from `clusterBoundaries` prop
  - Filters for features with `geometry_type="flow"`, `cluster_type="od"`, and `geometry.type="LineString"`
  - Returns deep-cloned array to avoid Vue reactivity issues with Deck.gl

- **`filteredClusterFlows()`**: Filters flows based on selected clusters
  - Returns all flows when no clusters selected
  - Returns only flows matching selected cluster IDs when clusters are selected

#### Watchers
- Added watcher for `hoveredFlowId` to trigger layer updates on hover state changes

#### Tooltip Enhancement
- Updated `getTooltip` function to handle flow features
- Flow tooltips display:
  - Cluster ID
  - Number of requests
  - Average travel time (converted to minutes)
  - Average distance (converted to kilometers)

#### New Layer: Cluster Flow Arrows
- **Layer ID**: `cluster-flows`
- **Visibility**: Only shown when `clusterType === 'spatial'` (which represents OD clusters)
- **Data Source**: `filteredClusterFlows` computed property

**Styling Features**:
1. **Width**: Scales based on `num_requests` (min 4px, max 14px)
   - Wider lines indicate more requests
   - Hover increases width by 50%

2. **Color**: State-based coloring
   - Hovered: Orange `[251, 146, 60, 255]`
   - Selected cluster: Blue `[59, 130, 246, 200]`
   - Default: Gray `[156, 163, 175, 180]`

3. **Opacity**: 0.7 for subtle appearance

4. **Extensions**: Uses `PathStyleExtension` for enhanced line rendering
   - Non-rounded caps and joints for cleaner arrow appearance

**Interactions**:
- **Hover**: Highlights flow and shows tooltip
- **Click**: Selects/deselects the associated cluster (emits `cluster-clicked` event)

**Update Triggers**:
- `hoveredFlowId` changes
- `selectedClusters` changes
- `filteredClusterFlows` changes (cluster selection filtering)

### 2. `/mnt/Shared/Code/projects/simwrapper/src/plugins/commuter-requests/CommuterRequestsConfig.ts`

#### Updated `ClusterBoundary` Interface
Enhanced the type definition to support flow features:

```typescript
export interface ClusterBoundary {
  type: 'Feature'
  geometry: any
  properties: {
    cluster_id: number | string
    cluster_type: 'origin' | 'destination' | 'od' | 'spatial' | 'temporal'
    geometry_type?: 'boundary' | 'centroid' | 'flow'  // NEW
    num_requests: number
    hull_type?: 'origin' | 'destination'
    boundary_part?: 'origin' | 'destination'
    centroid_type?: 'origin' | 'destination' | 'od'
    mean_travel_time?: number  // NEW - for flow features (seconds)
    mean_distance?: number     // NEW - for flow features (meters)
  }
}
```

## Data Structure

Flow features in `cluster_geometries.geojson` have the following structure:

```json
{
  "type": "Feature",
  "properties": {
    "cluster_type": "od",
    "cluster_id": "0",
    "geometry_type": "flow",
    "num_requests": 1,
    "hull_type": null,
    "centroid_type": null,
    "mean_travel_time": 3615.0,
    "mean_distance": 56428.6
  },
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [11.997460000026814, 47.878130042215616],  // Origin centroid
      [11.574240000012022, 48.18802004207482]     // Destination centroid
    ]
  }
}
```

## User Experience

### When Flow Arrows Appear
- Only visible when viewing **Spatial (OD) clusters** (clusterType === 'spatial')
- Automatically filtered based on cluster selection

### Visual Feedback
1. **No Selection**: All flows displayed in gray
2. **Cluster Selected**:
   - Flows for selected clusters shown in blue
   - Other flows hidden
3. **Hover**: Flow turns orange, width increases, tooltip appears

### Information Display
Hovering over a flow arrow shows:
- Cluster ID
- Total number of requests in this OD pair
- Average travel time (formatted as minutes)
- Average distance (formatted as kilometers)

## Implementation Details

### Performance Considerations
- Flow data is computed only once per `clusterBoundaries` change
- Deep cloning prevents Vue reactivity overhead in Deck.gl
- Filtering happens in computed property for optimal reactivity

### Integration with Existing Features
- Flows respect cluster selection state
- Clicking a flow selects the associated cluster (same behavior as cluster polygons)
- Hover states are independent (flow hover doesn't affect cluster hover)
- Dark mode styling applied to tooltips

### Layer Ordering
Layers are rendered in this order (bottom to top):
1. Cluster boundary polygons
2. **Cluster flow arrows** ← NEW
3. Request lines

This ensures flows are visible above cluster boundaries but below individual request lines.

## Future Enhancements

Potential improvements for consideration:
1. **Animated Arrows**: Add animation along the flow direction using Deck.gl's `PathStyleExtension` with dash animation
2. **Curved Flows**: Use arc layers for curved flow lines (better for dense networks)
3. **Bidirectional Flows**: Show reverse flows with different colors
4. **Flow Aggregation**: Combine multiple small flows into thicker aggregated flows
5. **Toggle Control**: Add UI toggle to show/hide flow arrows independently

## Testing Checklist

- [x] Flow arrows appear when clusterType is 'spatial'
- [x] Flow arrows hidden when clusterType is 'origin' or 'destination'
- [x] Width scales correctly with num_requests
- [x] Colors change on hover (orange) and selection (blue)
- [x] Tooltips display correct information
- [x] Clicking flow selects/deselects cluster
- [x] Flows filter when clusters are selected
- [x] No errors in console
- [x] Dark mode styling works
- [x] TypeScript types are correct
