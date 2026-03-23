---
status: resolved
trigger: "timeline-xy-zoom"
created: 2026-01-22T00:00:00Z
updated: 2026-01-22T00:20:00Z
symptoms_prefilled: true
goal: find_and_fix
---

## Current Focus

hypothesis: Y-axis zoom can be implemented by (1) adding viewportTopTrack/viewportBottomTrack state, (2) modifying handleWheel() to zoom Y-axis using yaxis.p2d() for cursor position, (3) updating renderChart() to use Y viewport for range
test: Implement Y-axis viewport state and modify handleWheel() to also zoom Y centered on cursor
expecting: Mouse wheel will zoom both X and Y axes, making swim lanes taller when zoomed in
next_action: Implement the fix in TimelineCard.vue

## Symptoms

expected: When user zooms in with mouse wheel, both X (time) and Y (swim lanes) should zoom, making individual ride bars taller and easier to distinguish/hover
actual: Mouse wheel zoom only affects X-axis (time range). Y-axis swim lanes stay the same height regardless of zoom level, making overlapping rides hard to differentiate
errors: None - this is a feature enhancement to existing zoom behavior
reproduction: 1) Open dashboard with TimelineCard showing many rides, 2) Use mouse wheel to zoom in, 3) Observe only time range changes, swim lanes remain same height
started: This was just implemented in plan 04.1-01 but only X-axis zoom was implemented

## Eliminated

## Evidence

- timestamp: 2026-01-22T00:05:00Z
  checked: TimelineCard.vue complete file (1197 lines)
  found: |
    Current zoom implementation:
    - X-axis viewport: viewportStart/viewportEnd (lines 128-131)
    - handleWheel() only modifies X-axis viewport (lines 635-686)
    - renderChart() sets y-axis range based on totalTracks: [-0.5, totalTracks - 0.5] (line 897)
    - No Y-axis viewport state variables exist
    - Minimap viewport indicator only shows X-axis range (lines 583-594)
  implication: Need to add Y-axis viewport state and modify handleWheel() to zoom both axes

- timestamp: 2026-01-22T00:06:00Z
  checked: handleWheel() function (lines 635-686)
  found: |
    - Gets mouse X position and converts to time coordinate using xaxis.p2d()
    - Calculates zoom factor from deltaY (1.1 for zoom out, 0.9 for zoom in)
    - Computes new viewport preserving cursor position ratio
    - Only updates viewportStart/viewportEnd for X-axis
    - No access to Y-axis (yaxis object) for cursor Y position
  implication: Similar pattern needed for Y-axis with yaxis.p2d() for mouse Y position

- timestamp: 2026-01-22T00:07:00Z
  checked: renderChart() Y-axis configuration (lines 896-954)
  found: |
    - yRange calculated as [-0.5, totalTracks - 0.5] (line 897)
    - This range is static, always showing ALL tracks regardless of zoom
    - No Y viewport variables to restrict visible track range
  implication: Need viewportTopTrack and viewportBottomTrack to limit visible Y range

## Resolution

root_cause: Y-axis zoom was not implemented. Only X-axis (time) viewport state existed (viewportStart/viewportEnd). handleWheel() only modified X viewport. renderChart() always showed all tracks with static range [-0.5, totalTracks - 0.5].

fix: |
  1. Added Y-axis viewport state (lines 133-137):
     - viewportTopTrack, viewportBottomTrack refs
     - minTrackRange=5, maxTrackRange=dynamic (updated based on totalTracks)

  2. Modified handleWheel() to zoom both axes (lines 674-748):
     - Added mouseY position capture and yaxis.p2d() conversion
     - Compute Y-axis zoom with same cursor-centered logic as X
     - Apply both xaxis.range and yaxis.range in Plotly.relayout

  3. Updated zoom controls (lines 537-595):
     - zoomIn/zoomOut now zoom both X and Y axes
     - resetZoom resets both axes
     - updateMainChartRange relayouts both axes

  4. Synced Y viewport state (lines 647-667):
     - handlePlotlyRelayout now syncs both X and Y viewport state

  5. Applied Y viewport to rendering (lines 856-970):
     - maxTrackRange dynamically set based on totalTracks
     - yRange uses viewport for rides view, full range for requests view

verification: |
  Code verified through:
  - Complete read-through of modified sections
  - Logic review: Y-axis zoom mirrors X-axis pattern with inverted coordinates
  - Coordinate system: Y-axis inverted (track 0 at top), handled correctly with [bottom-0.5, top-0.5] range
  - Edge cases handled: min/max track range clamping, bounds checking
  - Mode awareness: Full Y range for request detail view, viewport for rides view
  - State consistency: handlePlotlyRelayout syncs viewport when user pans/zooms via Plotly controls

files_changed: [src/plugins/interactive-dashboard/components/cards/TimelineCard.vue]
