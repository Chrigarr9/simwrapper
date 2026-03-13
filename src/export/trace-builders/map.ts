/**
 * Map config builder for the export system.
 *
 * Translates dashboard-style layer configurations (deck.gl-oriented) into
 * MapLibre GL style layers + GeoJSON sources, producing a MapRenderConfig
 * that can be rendered headlessly via maplibre-gl / @maplibre/maplibre-gl-native.
 */
import type { MapRenderConfig, MapExportLayer, ChartStyle, LegendData } from '../types'
import { MAP_STYLES } from '../defaults'

// ---------------------------------------------------------------------------
// Public input types
// ---------------------------------------------------------------------------

export interface MapInput {
  layers: MapLayerInput[]
  center?: [number, number]
  zoom?: number
  mapStyle?: string
  width?: number
  height?: number
  scale?: number
}

export interface MapLayerInput {
  name: string
  type: 'polygon' | 'fill' | 'line' | 'arc' | 'scatterplot'
  geojsonData: GeoJSON.FeatureCollection
  fillColor?: string
  fillOpacity?: number
  lineColor?: string
  lineWidth?: number
  color?: string
  opacity?: number
  radius?: number
  colorBy?: ColorByConfig
  widthBy?: SizeByConfig
  radiusBy?: SizeByConfig
  arcHeight?: number
  arcTilt?: number
}

export interface ColorByConfig {
  attribute: string
  type: 'categorical' | 'numeric'
  colors?: Record<string, string>
  scale?: [number, number]
}

export interface SizeByConfig {
  attribute: string
  scale: [number, number]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CENTER: [number, number] = [13.4, 52.52]
const DEFAULT_ZOOM = 10
const DEFAULT_WIDTH = 1200
const DEFAULT_HEIGHT = 800
const DEFAULT_SCALE = 2
const ARC_SEGMENTS = 20
const DEFAULT_ARC_HEIGHT = 0.2
const DEFAULT_ARC_TILT = 25

// Default sequential ramp for numeric colorBy (viridis-ish two-stop)
const NUMERIC_COLOR_RAMP: [string, string] = ['#440154', '#fde725']

// Fallback categorical palette (colorblind-safe, Okabe-Ito inspired)
const CATEGORICAL_PALETTE = [
  '#0072B2', '#E69F00', '#009E73', '#CC79A7',
  '#56B4E9', '#D55E00', '#F0E442', '#000000',
]

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildMapRenderConfig(input: MapInput, style: ChartStyle): MapRenderConfig {
  const sources: Record<string, { type: 'geojson'; data: any }> = {}
  const layers: MapExportLayer[] = []
  let legend: LegendData | undefined

  for (const layerInput of input.layers) {
    const result = translateLayer(layerInput, style)
    // Merge sources
    for (const [key, value] of Object.entries(result.sources)) {
      sources[key] = value
    }
    layers.push(...result.layers)

    // Use the first layer that produces legend data
    if (!legend && result.legend) {
      legend = result.legend
    }
  }

  const styleUrl = resolveStyleUrl(input.mapStyle, style)
  const center = input.center ?? computeCenter(input.layers)
  const zoom = input.zoom ?? DEFAULT_ZOOM

  return {
    center,
    zoom,
    width: input.width ?? DEFAULT_WIDTH,
    height: input.height ?? DEFAULT_HEIGHT,
    scale: input.scale ?? DEFAULT_SCALE,
    styleUrl,
    layers,
    sources,
    legend,
  }
}

// ---------------------------------------------------------------------------
// Layer translation
// ---------------------------------------------------------------------------

interface TranslationResult {
  sources: Record<string, { type: 'geojson'; data: any }>
  layers: MapExportLayer[]
  legend?: LegendData
}

function translateLayer(input: MapLayerInput, _style: ChartStyle): TranslationResult {
  switch (input.type) {
    case 'polygon':
    case 'fill':
      return translatePolygonLayer(input)
    case 'line':
      return translateLineLayer(input)
    case 'arc':
      return translateArcLayer(input)
    case 'scatterplot':
      return translateScatterplotLayer(input)
    default:
      return { sources: {}, layers: [] }
  }
}

// ---- Polygon / Fill -------------------------------------------------------

function translatePolygonLayer(input: MapLayerInput): TranslationResult {
  const sourceId = `source-${input.name}`
  const sources: Record<string, { type: 'geojson'; data: any }> = {
    [sourceId]: { type: 'geojson', data: input.geojsonData },
  }
  const layers: MapExportLayer[] = []
  let legend: LegendData | undefined

  // Fill layer
  const fillPaint: Record<string, any> = {}

  if (input.colorBy) {
    const { expression, legendData } = buildColorExpression(input)
    fillPaint['fill-color'] = expression
    legend = legendData
  } else {
    fillPaint['fill-color'] = input.fillColor ?? '#0072B2'
  }
  fillPaint['fill-opacity'] = input.fillOpacity ?? 0.6

  layers.push({
    id: `${input.name}-fill`,
    type: 'fill',
    source: sourceId,
    paint: fillPaint,
  })

  // Outline (line) layer
  const linePaint: Record<string, any> = {
    'line-color': input.lineColor ?? '#333333',
    'line-width': input.lineWidth ?? 1,
  }

  layers.push({
    id: `${input.name}-outline`,
    type: 'line',
    source: sourceId,
    paint: linePaint,
  })

  return { sources, layers, legend }
}

// ---- Line -----------------------------------------------------------------

function translateLineLayer(input: MapLayerInput): TranslationResult {
  const sourceId = `source-${input.name}`
  const sources: Record<string, { type: 'geojson'; data: any }> = {
    [sourceId]: { type: 'geojson', data: input.geojsonData },
  }
  const layers: MapExportLayer[] = []
  let legend: LegendData | undefined

  const paint: Record<string, any> = {}

  if (input.colorBy) {
    const { expression, legendData } = buildColorExpression(input)
    paint['line-color'] = expression
    legend = legendData
  } else {
    paint['line-color'] = input.color ?? input.lineColor ?? '#0072B2'
  }

  if (input.widthBy) {
    paint['line-width'] = buildSizeExpression(input.widthBy, input.geojsonData)
  } else {
    paint['line-width'] = input.lineWidth ?? input.lineWidth ?? 2
  }

  paint['line-opacity'] = input.opacity ?? 1

  layers.push({
    id: `${input.name}-line`,
    type: 'line',
    source: sourceId,
    paint,
  })

  return { sources, layers, legend }
}

// ---- Arc (bezier → LineString) -------------------------------------------

function translateArcLayer(input: MapLayerInput): TranslationResult {
  const arcHeight = input.arcHeight ?? DEFAULT_ARC_HEIGHT
  const arcTilt = input.arcTilt ?? DEFAULT_ARC_TILT

  // Convert each 2-point feature into a multi-segment LineString
  const convertedFeatures = (input.geojsonData.features || []).map(feature => {
    const coords = feature.geometry?.coordinates
    if (!coords || coords.length < 2) return feature

    const src: [number, number] = [coords[0][0], coords[0][1]]
    const dst: [number, number] = [coords[coords.length - 1][0], coords[coords.length - 1][1]]
    const bezierCoords = generateBezierArc(src, dst, arcHeight, arcTilt, ARC_SEGMENTS)

    return {
      ...feature,
      geometry: {
        type: 'LineString' as const,
        coordinates: bezierCoords,
      },
    }
  })

  const convertedCollection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: convertedFeatures as GeoJSON.Feature[],
  }

  const sourceId = `source-${input.name}`
  const sources: Record<string, { type: 'geojson'; data: any }> = {
    [sourceId]: { type: 'geojson', data: convertedCollection },
  }
  const layers: MapExportLayer[] = []
  let legend: LegendData | undefined

  const paint: Record<string, any> = {}

  if (input.colorBy) {
    const { expression, legendData } = buildColorExpression(input)
    paint['line-color'] = expression
    legend = legendData
  } else {
    paint['line-color'] = input.color ?? '#0072B2'
  }

  if (input.widthBy) {
    paint['line-width'] = buildSizeExpression(input.widthBy, input.geojsonData)
  } else {
    paint['line-width'] = input.lineWidth ?? 2
  }

  paint['line-opacity'] = input.opacity ?? 0.8

  layers.push({
    id: `${input.name}-arc`,
    type: 'line',
    source: sourceId,
    paint,
  })

  return { sources, layers, legend }
}

// ---- Scatterplot → circle -------------------------------------------------

function translateScatterplotLayer(input: MapLayerInput): TranslationResult {
  const sourceId = `source-${input.name}`
  const sources: Record<string, { type: 'geojson'; data: any }> = {
    [sourceId]: { type: 'geojson', data: input.geojsonData },
  }
  const layers: MapExportLayer[] = []
  let legend: LegendData | undefined

  const paint: Record<string, any> = {}

  if (input.colorBy) {
    const { expression, legendData } = buildColorExpression(input)
    paint['circle-color'] = expression
    legend = legendData
  } else {
    paint['circle-color'] = input.color ?? input.fillColor ?? '#0072B2'
  }

  if (input.radiusBy) {
    paint['circle-radius'] = buildSizeExpression(input.radiusBy, input.geojsonData)
  } else {
    paint['circle-radius'] = input.radius ?? 5
  }

  paint['circle-opacity'] = input.opacity ?? 0.8
  paint['circle-stroke-color'] = '#ffffff'
  paint['circle-stroke-width'] = 1

  layers.push({
    id: `${input.name}-circle`,
    type: 'circle',
    source: sourceId,
    paint,
  })

  return { sources, layers, legend }
}

// ---------------------------------------------------------------------------
// Color expression builders
// ---------------------------------------------------------------------------

interface ColorExpressionResult {
  expression: any
  legendData?: LegendData
}

function buildColorExpression(input: MapLayerInput): ColorExpressionResult {
  const colorBy = input.colorBy!

  if (colorBy.type === 'categorical') {
    return buildCategoricalColorExpression(colorBy, input.geojsonData)
  } else {
    return buildNumericColorExpression(colorBy, input.geojsonData)
  }
}

function buildCategoricalColorExpression(
  colorBy: ColorByConfig,
  data: GeoJSON.FeatureCollection,
): ColorExpressionResult {
  // Gather unique values from features
  const uniqueValues = new Set<string>()
  for (const feature of data.features) {
    const val = feature.properties?.[colorBy.attribute]
    if (val !== null && val !== undefined) {
      uniqueValues.add(String(val))
    }
  }
  const sortedValues = Array.from(uniqueValues).sort()

  // Build MapLibre match expression: ["match", ["get", attr], val1, color1, ..., fallback]
  const matchExpr: any[] = ['match', ['get', colorBy.attribute]]
  const legendItems: Array<{ label: string; color: string }> = []

  sortedValues.forEach((value, index) => {
    const color = colorBy.colors?.[value] ?? CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length]
    matchExpr.push(value)
    matchExpr.push(color)
    legendItems.push({ label: value, color })
  })

  // Fallback color
  matchExpr.push('#808080')

  const legendData: LegendData = {
    type: 'categorical',
    title: colorBy.attribute,
    items: legendItems,
  }

  return { expression: matchExpr, legendData }
}

function buildNumericColorExpression(
  colorBy: ColorByConfig,
  data: GeoJSON.FeatureCollection,
): ColorExpressionResult {
  // Determine scale from config or data
  let min: number
  let max: number

  if (colorBy.scale) {
    ;[min, max] = colorBy.scale
  } else {
    // Calculate from data
    let dataMin = Infinity
    let dataMax = -Infinity
    for (const feature of data.features) {
      const val = feature.properties?.[colorBy.attribute]
      if (typeof val === 'number') {
        dataMin = Math.min(dataMin, val)
        dataMax = Math.max(dataMax, val)
      }
    }
    min = isFinite(dataMin) ? dataMin : 0
    max = isFinite(dataMax) ? dataMax : 100
  }

  // Guard against zero-range
  if (min === max) {
    max = min + 1
  }

  // MapLibre interpolate expression
  const expression = [
    'interpolate',
    ['linear'],
    ['get', colorBy.attribute],
    min,
    NUMERIC_COLOR_RAMP[0],
    max,
    NUMERIC_COLOR_RAMP[1],
  ]

  const legendData: LegendData = {
    type: 'numeric',
    title: colorBy.attribute,
    minValue: min,
    maxValue: max,
    minColor: NUMERIC_COLOR_RAMP[0],
    maxColor: NUMERIC_COLOR_RAMP[1],
  }

  return { expression, legendData }
}

// ---------------------------------------------------------------------------
// Size expression builders (data-driven width / radius)
// ---------------------------------------------------------------------------

function buildSizeExpression(
  sizeBy: SizeByConfig,
  data: GeoJSON.FeatureCollection,
): any {
  // Calculate min/max from data
  let dataMin = Infinity
  let dataMax = -Infinity
  for (const feature of data.features) {
    const val = feature.properties?.[sizeBy.attribute]
    if (typeof val === 'number') {
      dataMin = Math.min(dataMin, val)
      dataMax = Math.max(dataMax, val)
    }
  }

  const min = isFinite(dataMin) ? dataMin : 0
  const max = isFinite(dataMax) ? dataMax : 100

  // Guard against zero-range
  const effectiveMax = min === max ? min + 1 : max

  const [minSize, maxSize] = sizeBy.scale

  return [
    'interpolate',
    ['linear'],
    ['get', sizeBy.attribute],
    min,
    minSize,
    effectiveMax,
    maxSize,
  ]
}

// ---------------------------------------------------------------------------
// Arc geometry: quadratic bezier in projected space
// ---------------------------------------------------------------------------

/**
 * Generate a quadratic bezier arc between two lon/lat points.
 *
 * The control point is placed at the midpoint, offset perpendicular to the
 * source-destination line by `height` (fraction of the distance), and
 * rotated by `tiltDeg` degrees.
 *
 * Returns an array of [lon, lat] coordinate pairs.
 */
export function generateBezierArc(
  src: [number, number],
  dst: [number, number],
  height: number,
  tiltDeg: number,
  segments: number,
): [number, number][] {
  // Midpoint
  const mx = (src[0] + dst[0]) / 2
  const my = (src[1] + dst[1]) / 2

  // Direction vector from src to dst
  const dx = dst[0] - src[0]
  const dy = dst[1] - src[1]
  const dist = Math.sqrt(dx * dx + dy * dy)

  if (dist < 1e-10) {
    // Degenerate: source and destination are the same point
    return [src, dst]
  }

  // Perpendicular (rotate 90 degrees CCW), then apply tilt
  const tiltRad = (tiltDeg * Math.PI) / 180
  const perpX = -dy / dist
  const perpY = dx / dist

  // Rotate perpendicular by tilt around the midpoint direction
  const cosT = Math.cos(tiltRad)
  const sinT = Math.sin(tiltRad)
  const offsetX = perpX * cosT - perpY * sinT
  const offsetY = perpX * sinT + perpY * cosT

  // Control point: midpoint + offset scaled by height * distance
  const cpx = mx + offsetX * height * dist
  const cpy = my + offsetY * height * dist

  // Generate bezier curve points
  const coords: [number, number][] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const invT = 1 - t
    const x = invT * invT * src[0] + 2 * invT * t * cpx + t * t * dst[0]
    const y = invT * invT * src[1] + 2 * invT * t * cpy + t * t * dst[1]
    coords.push([x, y])
  }

  return coords
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveStyleUrl(mapStyle: string | undefined, style: ChartStyle): string {
  if (!mapStyle) {
    // Light background → positron; dark → dark-matter
    return style.backgroundColor === '#ffffff' || !style.backgroundColor
      ? MAP_STYLES['positron'] ?? MAP_STYLES['light']
      : MAP_STYLES['dark-matter'] ?? MAP_STYLES['dark']
  }
  return MAP_STYLES[mapStyle] ?? mapStyle
}

function computeCenter(layers: MapLayerInput[]): [number, number] {
  let sumLon = 0
  let sumLat = 0
  let count = 0

  for (const layer of layers) {
    for (const feature of layer.geojsonData.features) {
      const coords = extractAllCoordinates(feature.geometry)
      for (const [lon, lat] of coords) {
        sumLon += lon
        sumLat += lat
        count++
      }
    }
  }

  if (count === 0) return DEFAULT_CENTER

  return [sumLon / count, sumLat / count]
}

function extractAllCoordinates(geometry: any): [number, number][] {
  const result: [number, number][] = []

  function walk(coords: any) {
    if (!coords) return
    if (Array.isArray(coords) && coords.length >= 2 && typeof coords[0] === 'number') {
      result.push([coords[0] as number, coords[1] as number])
    } else if (Array.isArray(coords)) {
      for (const c of coords) walk(c)
    }
  }

  walk(geometry?.coordinates)
  return result
}
