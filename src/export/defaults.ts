import type { ExportDefaults, ChartStyle } from './types'

// Baseline canvas the defaults below are tuned for: one interactive dashboard
// card (~600px wide). Larger export canvases get fonts/markers/lines scaled
// proportionally by `scaleStyleForWidth` so the visual density stays the same.
export const BASELINE_WIDTH = 600

// PRINT_CHART_STYLE colors are kept in sync with StyleManager's scientific
// palette (src/plugins/interactive-dashboard/managers/StyleManager.ts) — the
// background/text/grid/bar colors here mirror its `scientific` mode entries.
// Font sizes and line widths are sized for BASELINE_WIDTH; use
// scaleStyleForWidth when rendering to a larger canvas.
export const EXPORT_DEFAULTS: ExportDefaults = {
  format: 'png',
  width: BASELINE_WIDTH,
  height: 400,
  scale: 2,
  axisTitleFontSize: 11,
  axisTickFontSize: 10,
  legendTitleFontSize: 11,
  legendFontSize: 10,
  lineWidth: 2.5,
  markerSizeMultiplier: 1.0,
}

export const PRINT_CHART_STYLE: ChartStyle = {
  axisTitleFontSize: 11,
  axisTickFontSize: 10,
  legendTitleFontSize: 11,
  legendFontSize: 10,
  // titleFontSize / annotationFontSize: omit so builders fall back to defaults
  // (axisTitleFontSize + 4 for chart titles, annotationFontSize undefined → 12
  // for ref-line labels). The dashboard doesn't render chart titles inside the
  // plot at all; export does because there's no card frame to caption.
  lineWidth: 2.5,
  markerSizeMultiplier: 1.0,
  fontFamily: 'Arial, Helvetica, sans-serif',
  backgroundColor: '#ffffff',
  textColor: '#000000',
  gridColor: '#cccccc',
  barColor: '#0072B2',          // colorblind-safe blue, matches dashboard scientific mode
  selectedColor: '#666666',
  isScientific: true,
}

/**
 * Scale font sizes, line widths, and marker multipliers proportionally to the
 * actual export width. The baseline values are tuned for ~600px (one dashboard
 * card); a 1400px paper-figure canvas needs ~2.3× larger fonts to keep text
 * legible relative to the chart area. Clamped to [1.0, 3.0] so very wide
 * canvases don't blow up and undersized canvases keep readable defaults.
 *
 * Returns a new object — only numeric size fields are scaled. Callers that
 * want absolute sizes pass them as explicit overrides; this only inflates the
 * fallbacks.
 */
export function scaleStyleForWidth(base: ExportDefaults, width: number): ExportDefaults {
  const factor = Math.max(1.0, Math.min(3.0, width / BASELINE_WIDTH))
  if (factor === 1.0) return base
  const round = (n: number) => Math.round(n * 10) / 10
  return {
    ...base,
    axisTitleFontSize: round(base.axisTitleFontSize * factor),
    axisTickFontSize: round(base.axisTickFontSize * factor),
    legendTitleFontSize: round(base.legendTitleFontSize * factor),
    legendFontSize: round(base.legendFontSize * factor),
    lineWidth: round(base.lineWidth * factor),
    markerSizeMultiplier: round(base.markerSizeMultiplier * factor),
  }
}

export const MAP_STYLES: Record<string, string> = {
  positron: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  'dark-matter': 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
}
