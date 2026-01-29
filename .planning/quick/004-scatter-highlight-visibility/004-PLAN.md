# Quick Task 004: Scatter Plot Highlight/Selection Visibility

## Objective
Make highlighted and selected points more visible on the scatter plot.

## Tasks

### Task 1: Enhance Visual Distinction for Highlighted/Selected Points
**Files:** `src/plugins/interactive-dashboard/components/cards/ScatterCard.vue`

Current state:
- Highlighted/selected points only differ by color and line width (0.5 → 2)
- Very subtle, hard to see in dense plots

Changes needed:
- **Size**: 1.5x larger for highlighted/selected points
- **Border**: Thicker (2.5-3px) with white color for maximum contrast
- **Opacity**: Full opacity (1.0) for highlighted/selected vs reduced (0.7) for normal

Apply to both:
- Category-based traces (lines 329-394)
- Single trace mode (lines 396-428)
