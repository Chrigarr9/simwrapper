---
created: 2026-01-22T15:24
title: Fix card viewport scaling issues
area: ui
files:
  - src/plugins/interactive-dashboard/components/DashboardCard.vue
  - src/plugins/interactive-dashboard/components/cards/MapCard.vue
  - src/plugins/interactive-dashboard/components/cards/DataTableCard.vue
  - src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
  - src/plugins/interactive-dashboard/components/cards/ScatterCard.vue
  - src/plugins/interactive-dashboard/components/cards/PieChartCard.vue
  - src/plugins/interactive-dashboard/components/cards/CorrelationMatrixCard.vue
  - src/plugins/interactive-dashboard/components/cards/TimelineCard.vue
---

## Problem

Dashboard cards do not scale well to smaller viewports. Two distinct issues:

1. **Content overflow**: Plots and stats are sometimes larger than their containing cards, causing content to overflow and become partially invisible or clipped.

2. **Loading failure on small viewports**: MapCard and DataTableCard fail to complete loading when the viewport is too small. As the viewport shrinks, the card dimensions become smaller, which triggers the components to get stuck in a loading state and never finish initializing.

This affects overall usability on smaller screens, tablets, and when the browser window is resized to a narrow width.

## Solution

TBD - Potential approaches:

1. Set minimum dimensions on cards to prevent them from becoming too small to function
2. Implement responsive breakpoints that switch to a simplified view when space is constrained
3. Add overflow handling (scroll, truncate, or auto-fit) for chart content
4. Investigate MapCard/DataTableCard initialization logic to understand why small dimensions prevent loading completion
5. Consider mobile-first responsive design patterns for card layout
