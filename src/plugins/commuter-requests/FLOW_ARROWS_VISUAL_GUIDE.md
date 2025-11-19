# Flow Arrows Visual Guide

## What Are Flow Arrows?

Flow arrows are visual representations of origin-destination (OD) relationships between spatial clusters. They show:
- **Direction**: From origin cluster centroid → destination cluster centroid
- **Volume**: Line thickness indicates number of requests
- **Attributes**: Hover to see travel time and distance statistics

## Visual States

### 1. Default State (No Selection)
```
┌─────────────────────────────────────────┐
│                                         │
│   ⬤ Origin      ────────►    ⬤ Dest    │
│   Cluster 1      gray line   Cluster 2  │
│                  (width: 4-14px)        │
│                  opacity: 0.7           │
└─────────────────────────────────────────┘
```
- All flows visible in **gray** color
- Width proportional to `num_requests`
- Subtle appearance (70% opacity)

### 2. Cluster Selected
```
┌─────────────────────────────────────────┐
│                                         │
│   ⬤ Selected    ══════►    ⬤ Selected  │
│   Cluster 1     blue line  Cluster 2   │
│                 (thicker)               │
│                                         │
│   ⬤ Other      (hidden)    ⬤ Other     │
│   Cluster 3                Cluster 4   │
└─────────────────────────────────────────┘
```
- Only flows for **selected clusters** shown
- **Blue** color `[59, 130, 246]`
- Other flows filtered out

### 3. Flow Hovered
```
┌─────────────────────────────────────────┐
│   ┌──────────────────────┐              │
│   │ Cluster Flow 1       │              │
│   │ Requests: 42         │              │
│   │ Avg Time: 23 min     │──────┐       │
│   │ Avg Distance: 15.3km │      │       │
│   └──────────────────────┘      ▼       │
│   ⬤ Origin   ═══════════►    ⬤ Dest    │
│            orange (wider)                │
│            width × 1.5                   │
└─────────────────────────────────────────┘
```
- Flow turns **orange** `[251, 146, 60]`
- Width increases by **50%**
- Tooltip displays statistics

## Color Palette

| State | Color | RGB | Opacity |
|-------|-------|-----|---------|
| Default | Gray | `[156, 163, 175]` | 180/255 |
| Selected | Blue | `[59, 130, 246]` | 200/255 |
| Hovered | Orange | `[251, 146, 60]` | 255/255 |

## Width Scaling

Flow width is calculated based on `num_requests`:

```javascript
// Base calculation
const maxRequests = max(all flows' num_requests)
const normalizedWidth = (num_requests / maxRequests) * 10 + 4

// Result: min 4px, max 14px
// Hover: multiply by 1.5
```

Examples:
- 1 request: ~4px width (minimum)
- 50% of max: ~9px width (medium)
- Max requests: 14px width (maximum)
- Hovered max: 21px width (maximum × 1.5)

## Tooltip Format

```
┌──────────────────────┐
│ Cluster Flow 5       │  ← "Cluster Flow {cluster_id}"
│ Requests: 128        │  ← Number of requests in OD pair
│ Avg Travel Time: 45  │  ← mean_travel_time (seconds → minutes)
│ Avg Distance: 23.7km │  ← mean_distance (meters → km, 1 decimal)
└──────────────────────┘
```

## When Flows Appear

Flow arrows are **only visible** when:
1. `clusterType === 'spatial'` (viewing OD/spatial clusters)
2. Flow data exists in `cluster_geometries.geojson`
3. Features have `geometry_type="flow"` and `cluster_type="od"`

They are **hidden** when:
- Viewing origin clusters (`clusterType === 'origin'`)
- Viewing destination clusters (`clusterType === 'destination'`)
- No flow data available

## Interaction Flow

```
User Action                  → System Response
──────────────────────────────────────────────────────
1. Load spatial clusters     → Flows appear (gray)
2. Hover over flow           → Flow turns orange + tooltip
3. Move mouse away           → Flow returns to original state
4. Click cluster polygon     → Related flows turn blue
5. Click another cluster     → Only new cluster flows shown
6. Click flow line           → Selects associated cluster
7. Switch to origin clusters → Flows disappear
8. Switch back to spatial    → Flows reappear
```

## Data Flow

```
cluster_geometries.geojson
         ↓
   clusterBoundaries prop
         ↓
   clusterFlows computed property
   (filter: geometry_type="flow")
         ↓
   filteredClusterFlows computed
   (filter: selectedClusters)
         ↓
   LineLayer with PathStyleExtension
         ↓
   Rendered on map
```

## Layer Stack (Bottom → Top)

```
   ┌─────────────────────────────┐
5. │ Request Lines (individual)  │ ← Top (most interactive)
   ├─────────────────────────────┤
4. │ Flow Arrows (aggregated)    │ ← NEW LAYER
   ├─────────────────────────────┤
3. │ Cluster Polygons            │
   ├─────────────────────────────┤
2. │ Base Map (CartoDB)          │
   └─────────────────────────────┘
```

## Example Scenarios

### Scenario 1: Exploring All Flows
**User Action**: Opens dashboard with spatial clusters
**Result**:
- All cluster polygons visible (gray)
- All flow arrows visible (gray)
- Can see overall origin-destination patterns

### Scenario 2: Focusing on One Cluster
**User Action**: Clicks cluster polygon for Cluster 3
**Result**:
- Cluster 3 polygon turns blue
- Only flows with cluster_id="3" remain visible (blue)
- Other flows hidden
- Can see all destinations from Cluster 3

### Scenario 3: Investigating Flow Details
**User Action**: Hovers over a thick flow arrow
**Result**:
- Flow turns orange and widens
- Tooltip shows: "Cluster Flow 3, Requests: 234, Avg Time: 32 min, Avg Distance: 18.4km"
- User understands this is a major OD pair

### Scenario 4: Switching Views
**User Action**: Changes cluster type from "Spatial" to "Origin"
**Result**:
- Flow arrows disappear (not relevant for origin-only view)
- Only origin cluster polygons remain
- Clean, uncluttered view

## Technical Implementation Notes

### Performance
- Flows computed once per data update
- Deep cloning prevents Vue reactivity overhead
- Efficient filtering using computed properties

### Compatibility
- Works with existing cluster selection logic
- Independent hover states (flows don't interfere with polygons)
- Dark mode support in tooltips

### Edge Cases Handled
- Empty flow data (no errors)
- Missing properties (graceful degradation)
- String vs number cluster IDs (normalized comparison)
- No cluster selection (show all flows)

## Future Enhancement Ideas

1. **Arrow Heads**: Add actual arrow markers at destination
2. **Animation**: Animate particles along flow direction
3. **Bidirectional**: Show reverse flows with different styling
4. **Arc Paths**: Curved lines for better visibility in dense areas
5. **Clustering**: Aggregate small flows into bundles
6. **Toggle**: UI control to show/hide flows independently
7. **Color by Attribute**: Color flows by mean_travel_time or mean_distance
8. **Flow Width Legend**: Visual legend explaining width scale
