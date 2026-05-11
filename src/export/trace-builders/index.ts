import { buildHistogramFigure } from './histogram'
import { buildScatterFigure } from './scatter'
import { buildPieFigure } from './pie'
import { buildCorrelationFigure } from './correlation'
import { buildTimelineFigure } from './timeline'
import { buildMapRenderConfig } from './map'
import { buildBarFigure } from './bar'
import type { PlotlyFigure, ChartStyle, MapRenderConfig } from '../types'

export type ChartBuilder = (input: any, style: ChartStyle) => PlotlyFigure

export const CHART_BUILDERS: Record<string, ChartBuilder> = {
  histogram: buildHistogramFigure,
  'scatter-plot': buildScatterFigure,
  'pie-chart': buildPieFigure,
  'correlation-matrix': buildCorrelationFigure,
  timeline: buildTimelineFigure,
  bar: buildBarFigure,
}

export const MAP_BUILDER = buildMapRenderConfig

export function isMapType(type: string): boolean {
  return type === 'map'
}

export { buildHistogramFigure, buildScatterFigure, buildPieFigure }
export { buildCorrelationFigure, buildTimelineFigure, buildMapRenderConfig }
export { buildBarFigure }
