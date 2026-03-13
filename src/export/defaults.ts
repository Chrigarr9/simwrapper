import type { ExportDefaults, ChartStyle } from './types'

export const EXPORT_DEFAULTS: ExportDefaults = {
  format: 'png',
  width: 1200,
  height: 800,
  scale: 2,
  axisTitleFontSize: 14,
  axisTickFontSize: 12,
  legendTitleFontSize: 13,
  legendFontSize: 12,
  lineWidth: 2.4,
  markerSizeMultiplier: 1.35,
}

export const PRINT_CHART_STYLE: ChartStyle = {
  axisTitleFontSize: 14,
  axisTickFontSize: 12,
  legendTitleFontSize: 13,
  legendFontSize: 12,
  lineWidth: 2.4,
  markerSizeMultiplier: 1.35,
  fontFamily: 'Arial, Helvetica, sans-serif',
  backgroundColor: '#ffffff',
  textColor: '#000000',
  gridColor: '#cccccc',
  barColor: '#0072B2',
  selectedColor: '#666666',
  isScientific: true,
}

export const MAP_STYLES: Record<string, string> = {
  positron: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  'dark-matter': 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
}
