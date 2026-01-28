---
created: 2026-01-28T11:15
title: Add scientific styling profile for paper-ready visualizations
area: ui
files: []
---

## Problem

Current visualization styling is optimized for interactive web use with dark/light mode themes. When creating figures for academic papers, researchers need to manually adjust screenshots or recreate visualizations to match publication standards.

Scientific papers typically require:
- High contrast black-on-white color schemes
- Serif or specific sans-serif fonts (Times New Roman, Arial)
- Clean axis labels with proper scientific notation
- No UI chrome or interactive elements visible
- Vector-ready output quality
- Consistent styling across all chart types

Currently, taking a screenshot of a SimWrapper visualization doesn't produce publication-quality figures.

## Solution

Create a "scientific" styling profile that:

1. **Color scheme**: Pure white background, black text/axes, grayscale or colorblind-safe palettes
2. **Typography**: Paper-appropriate fonts, larger axis labels, proper tick formatting
3. **Layout**: Remove interactive UI elements (zoom controls, tooltips), maximize plot area
4. **Export system**: Per-plot and bulk export functionality (see below)

### Export Workflow

When in scientific styling mode, enable a streamlined export workflow for academic writing:

**Per-plot export:**
- Each plot card shows an export/download button (only visible in scientific mode)
- Clicking downloads the plot as an image file
- Resolution configurable per-plot in YAML config (e.g., `exportWidth: 1200`, `exportHeight: 800`)
- Default resolution sensible for papers (e.g., 300 DPI equivalent)
- Filename derived from card title or configurable

**Bulk export ("Download All"):**
- Dashboard-level button to export all plots at once
- Downloads as ZIP or individual files to a folder
- Consistent naming convention for easy organization

**Target workflow:**
1. Configure dashboard with scientific styling
2. Generate/filter visualizations as needed
3. Click "Download All" (or individual exports)
4. Copy exported files to LaTeX `figures/` or dissertation graphics folder
5. Re-run export when data changes → files update → LaTeX recompiles with new figures

**Export format considerations:**
- PNG for raster (wide compatibility)
- SVG for vector (scalable, editable, smaller file size)
- PDF for direct LaTeX inclusion
- Let user choose format, or configure default in YAML

**Scope considerations:**
- Could be Interactive Dashboard specific (StyleManager extension)
- Could be SimWrapper-wide feature affecting all visualization plugins
- May need configuration via YAML or global settings

**Implementation hints:**
- Extend StyleManager with a `scientificMode` theme alongside dark/light
- Add print-friendly CSS media queries
- Use Plotly's `Plotly.downloadImage()` for chart exports
- Use deck.gl's `deck.canvas.toDataURL()` for map exports
- DashboardCard wrapper could handle export button rendering consistently
- Consider headless/batch export mode for automation
