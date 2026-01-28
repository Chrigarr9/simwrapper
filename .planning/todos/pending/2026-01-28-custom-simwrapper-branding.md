---
created: 2026-01-28T11:22
title: Create custom SimWrapper branding/styling for dissertation use case
area: ui
files: []
---

## Problem

SimWrapper has existing support for custom branding and styling of the overall application UI (menu, logo, header, website header, etc.) — separate from dashboard/visualization styling. This is documented somewhere in the SimWrapper documentation.

For the dissertation use case, we want a polished, custom-branded appearance that:
- Looks professional and cohesive
- Matches the visual identity of the research project
- Differentiates from the default SimWrapper appearance

Currently using default SimWrapper styling which may not be ideal for presentations, screenshots in papers, or when showing the tool to others.

## Solution

**Research phase:**
1. Check SimWrapper documentation at https://docs.simwrapper.app/docs for custom styling/branding options
2. Identify configuration files and methods for:
   - Custom logo
   - Header/title bar styling
   - Menu appearance
   - Color scheme for app chrome (not visualizations)
   - Footer or attribution text

**Implementation phase:**
1. Design a clean, professional theme for the dissertation use case
2. Configure custom branding via SimWrapper's built-in mechanisms
3. Test across different views (folder browser, dashboard, fullscreen)

**Relationship to scientific styling todo:**
- This todo: App-level branding (menu, header, logo)
- Scientific styling todo: Visualization/chart styling for paper figures
- Both contribute to a polished, professional appearance
