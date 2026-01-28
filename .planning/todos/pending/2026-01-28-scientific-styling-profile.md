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
4. **Export**: Potentially add SVG export option for vector graphics

**Scope considerations:**
- Could be Interactive Dashboard specific (StyleManager extension)
- Could be SimWrapper-wide feature affecting all visualization plugins
- May need configuration via YAML or global settings

**Implementation hints:**
- Extend StyleManager with a `scientificMode` theme alongside dark/light
- Add print-friendly CSS media queries
- Consider "export mode" that strips interactive elements
