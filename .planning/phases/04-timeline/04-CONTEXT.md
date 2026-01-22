# Phase 4: Timeline - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Visualize temporal patterns in candidate rides (from ride generation phase) as an interactive Gantt-style timeline. Users can see ride time windows, explore individual ride details, and link to other dashboard cards. This phase does NOT cover vehicle schedules or optimization results (those would use different data with vehicle assignments).

**Data source:** `rides_sample.csv` containing candidate rides with temporal fields (`start_time`, `end_time` in seconds from midnight). Additional detail data may need to be joined from `selected_rides.csv` which includes per-request timing (`treq`, `delay`).

</domain>

<decisions>
## Implementation Decisions

### Bar Visualization
- **Nested window design**: Outer bar shows time constraint window (earliest pickup to latest dropoff), inner bar shows actual travel time within it
- **Colored by degree**: Single rides (degree=1), 2-passenger, 3+ passenger rides each get distinct colors to show pooling effectiveness
- **Pickup markers**: Small diamond markers on the bar showing each passenger's pickup time (`treq`)
- **Standard tooltips**: Show ride ID, start/end times, degree, distance, delay on hover

### Expanded Detail View
- **Inline expansion**: Clicking a ride expands the bar in place within the timeline, pushing other bars down
- **Stacked mini-Gantt for requests**: Each request shown as a row with its own bar displaying earliest→latest constraint window and actual service time marked
- **Per-request metrics**: Show delay, waiting time, detour for each passenger request within the expanded view
- **Linked map (on-demand)**: Option to link a MapCard that shows ONLY the hovered/selected ride geometry (not all rides - data volume concern)

### Swim Lane Layout
- **Flat list, no grouping**: All rides shown without vehicle/cluster grouping (rides are candidates, not yet assigned to vehicles)
- **Automatic track allocation**: Overlapping rides get assigned to different rows (tracks); when a ride ends, that track becomes available for the next ride
- **Track reuse**: Minimize vertical space by reusing tracks efficiently
- **Anonymous tracks**: No row labels needed, just visual lanes for concurrent rides
- **Hide non-matching**: When filters are active, hide rides that don't match (don't fade/gray them)

### Time Axis Design
- **Full 24-hour range**: Always show 00:00-24:00, rides positioned within
- **Adaptive labels**: Show more labels (half-hour) when zoomed in, fewer (hour marks) when zoomed out
- **No peak hour markers**: Clean axis without shaded background bands
- **Zoom controls**: Plus/minus buttons + minimap at bottom for navigation
- **Minimap navigation**: Bottom minimap shows full day with current viewport indicated; scrolling on minimap scrolls the main view

### Card Interactions
- **Hover linkage**: Hovering timeline bar highlights corresponding row in table and geometry on linked map
- **Click to filter**: Clicking a ride filters other cards (table, map) to show that ride
- **Toggle multi-select**: Click to add/remove rides from selection (OR filtering, like histogram/pie toggle behavior)
- **Single expansion**: When multiple rides are selected, only the most recently clicked one shows expanded detail view

### Claude's Discretion
- Exact color palette for degree-based coloring (coordinate with existing StyleManager)
- Track allocation algorithm efficiency
- Minimap styling and interaction details
- Keyboard shortcuts (e.g., Escape to clear selection)
- Animation timing for expansion/collapse

</decisions>

<specifics>
## Specific Ideas

- "Like a Gantt chart where overlapping rides get their own row, and rows are reused when rides end"
- "Small diamonds for each passenger's pickup time on the ride bar"
- "Horizontal scroll for time axis, vertical scroll for swim lanes"
- Map linkage should show ONLY hovered/selected ride geometry (not all rides - would crash browser with 1800+ rides)
- Selection behavior should match existing dashboard patterns (toggle to add/remove, OR filtering)

</specifics>

<deferred>
## Deferred Ideas

- **Vehicle schedule visualization**: Showing rides grouped by vehicle would be a separate feature for the optimization dashboard where vehicle assignments exist
- **Peak hour shading**: Background bands for commute hours - could be added later if useful
- **Brush selection**: Click-drag to select all rides in a time range - toggle selection sufficient for now

</deferred>

---

*Phase: 04-timeline*
*Context gathered: 2026-01-22*
