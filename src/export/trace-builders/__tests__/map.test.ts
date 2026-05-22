import { describe, it, expect } from 'vitest'
import {
  buildMapRenderConfig,
  generateBezierArc,
  type MapInput,
  type MapLayerInput,
} from '../map'
import type { ChartStyle } from '../../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LIGHT_STYLE: ChartStyle = {
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

function makeFeatureCollection(
  features: GeoJSON.Feature[] = [],
): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features }
}

function makePolygonFeature(
  coords: number[][][],
  props: Record<string, any> = {},
): GeoJSON.Feature {
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: coords },
    properties: props,
  }
}

function makePointFeature(
  lon: number,
  lat: number,
  props: Record<string, any> = {},
): GeoJSON.Feature {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: props,
  }
}

function makeLineFeature(
  coords: number[][],
  props: Record<string, any> = {},
): GeoJSON.Feature {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: props,
  }
}

function makeArcFeature(
  src: [number, number],
  dst: [number, number],
  props: Record<string, any> = {},
): GeoJSON.Feature {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [src, dst] },
    properties: props,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildMapRenderConfig', () => {
  describe('basic structure', () => {
    it('returns config with all required fields', () => {
      const input: MapInput = {
        layers: [],
        center: [11.5, 48.8],
        zoom: 12,
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)

      expect(result.center).toEqual([11.5, 48.8])
      expect(result.zoom).toBe(12)
      expect(result.width).toBe(1200)
      expect(result.height).toBe(800)
      expect(result.scale).toBe(2)
      expect(result.styleUrl).toContain('positron')
      expect(result.layers).toEqual([])
      expect(result.sources).toEqual({})
    })

    it('uses defaults when center/zoom not provided', () => {
      const input: MapInput = {
        layers: [
          {
            name: 'pts',
            type: 'scatterplot',
            geojsonData: makeFeatureCollection([
              makePointFeature(10, 48),
              makePointFeature(12, 50),
            ]),
          },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)

      // center should be computed from data
      expect(result.center[0]).toBeCloseTo(11, 0)
      expect(result.center[1]).toBeCloseTo(49, 0)
      // zoom is auto-computed to fit the data bbox (not the DEFAULT_ZOOM=10 fallback)
      expect(result.zoom).toBeGreaterThan(7)
      expect(result.zoom).toBeLessThan(12)
    })

    it('uses custom width/height/scale when provided', () => {
      const input: MapInput = {
        layers: [],
        width: 800,
        height: 600,
        scale: 3,
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)
      expect(result.width).toBe(800)
      expect(result.height).toBe(600)
      expect(result.scale).toBe(3)
    })
  })

  describe('map style resolution', () => {
    it('resolves positron for light background', () => {
      const result = buildMapRenderConfig({ layers: [] }, LIGHT_STYLE)
      expect(result.styleUrl).toContain('positron')
    })

    it('resolves dark-matter for dark background', () => {
      const darkStyle = { ...LIGHT_STYLE, backgroundColor: '#1a1a1a' }
      const result = buildMapRenderConfig({ layers: [] }, darkStyle)
      expect(result.styleUrl).toContain('dark-matter')
    })

    it('resolves named style from MAP_STYLES', () => {
      const input: MapInput = { layers: [], mapStyle: 'dark' }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)
      expect(result.styleUrl).toContain('dark-matter')
    })

    it('passes through unknown style as-is (custom URL)', () => {
      const customUrl = 'https://example.com/my-style.json'
      const input: MapInput = { layers: [], mapStyle: customUrl }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)
      expect(result.styleUrl).toBe(customUrl)
    })
  })

  describe('polygon layer translation', () => {
    const polygonFeatures = makeFeatureCollection([
      makePolygonFeature(
        [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        { zone: 'A' },
      ),
    ])

    it('produces fill + outline layers for polygon type', () => {
      const input: MapInput = {
        layers: [
          {
            name: 'zones',
            type: 'polygon',
            geojsonData: polygonFeatures,
            fillColor: '#ff0000',
            fillOpacity: 0.4,
            lineColor: '#000000',
            lineWidth: 2,
          },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)

      expect(result.layers).toHaveLength(2)

      const fill = result.layers[0]
      expect(fill.id).toBe('zones-fill')
      expect(fill.type).toBe('fill')
      expect(fill.source).toBe('source-zones')
      expect(fill.paint['fill-color']).toBe('#ff0000')
      expect(fill.paint['fill-opacity']).toBe(0.4)

      const outline = result.layers[1]
      expect(outline.id).toBe('zones-outline')
      expect(outline.type).toBe('line')
      expect(outline.source).toBe('source-zones')
      expect(outline.paint['line-color']).toBe('#000000')
      expect(outline.paint['line-width']).toBe(2)
    })

    it('uses defaults when no explicit styling', () => {
      const input: MapInput = {
        layers: [
          { name: 'zones', type: 'polygon', geojsonData: polygonFeatures },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)

      const fill = result.layers[0]
      expect(fill.paint['fill-color']).toBe('#0072B2')
      expect(fill.paint['fill-opacity']).toBe(0.6)

      const outline = result.layers[1]
      expect(outline.paint['line-color']).toBe('#333333')
      expect(outline.paint['line-width']).toBe(1)
    })

    it('also works with "fill" type alias', () => {
      const input: MapInput = {
        layers: [
          { name: 'zones', type: 'fill', geojsonData: polygonFeatures },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)
      expect(result.layers).toHaveLength(2)
      expect(result.layers[0].type).toBe('fill')
    })
  })

  describe('line layer translation', () => {
    const lineFeatures = makeFeatureCollection([
      makeLineFeature([[0, 0], [1, 1]], { flow: 100 }),
      makeLineFeature([[2, 2], [3, 3]], { flow: 200 }),
    ])

    it('produces a single line layer', () => {
      const input: MapInput = {
        layers: [
          {
            name: 'routes',
            type: 'line',
            geojsonData: lineFeatures,
            color: '#00ff00',
            lineWidth: 3,
          },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)

      expect(result.layers).toHaveLength(1)
      const line = result.layers[0]
      expect(line.id).toBe('routes-line')
      expect(line.type).toBe('line')
      expect(line.paint['line-color']).toBe('#00ff00')
      expect(line.paint['line-width']).toBe(3)
      expect(line.paint['line-opacity']).toBe(1)
    })

    it('applies widthBy as interpolate expression', () => {
      const input: MapInput = {
        layers: [
          {
            name: 'routes',
            type: 'line',
            geojsonData: lineFeatures,
            widthBy: { attribute: 'flow', scale: [1, 10] },
          },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)
      const lineWidth = result.layers[0].paint['line-width']

      expect(lineWidth[0]).toBe('interpolate')
      expect(lineWidth[1]).toEqual(['linear'])
      expect(lineWidth[2]).toEqual(['get', 'flow'])
      // min value -> minSize, max value -> maxSize
      expect(lineWidth[3]).toBe(100)   // min data value
      expect(lineWidth[4]).toBe(1)     // min size
      expect(lineWidth[5]).toBe(200)   // max data value
      expect(lineWidth[6]).toBe(10)    // max size
    })
  })

  describe('scatterplot layer translation', () => {
    const pointFeatures = makeFeatureCollection([
      makePointFeature(10, 48, { pop: 1000, city: 'A' }),
      makePointFeature(11, 49, { pop: 5000, city: 'B' }),
      makePointFeature(12, 50, { pop: 3000, city: 'C' }),
    ])

    it('produces a circle layer', () => {
      const input: MapInput = {
        layers: [
          {
            name: 'cities',
            type: 'scatterplot',
            geojsonData: pointFeatures,
            radius: 8,
            color: '#ff6600',
          },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)

      expect(result.layers).toHaveLength(1)
      const circle = result.layers[0]
      expect(circle.id).toBe('cities-circle')
      expect(circle.type).toBe('circle')
      expect(circle.paint['circle-color']).toBe('#ff6600')
      expect(circle.paint['circle-radius']).toBe(8)
      expect(circle.paint['circle-opacity']).toBe(0.8)
      expect(circle.paint['circle-stroke-color']).toBe('#ffffff')
      expect(circle.paint['circle-stroke-width']).toBe(1)
    })

    it('applies radiusBy as interpolate expression', () => {
      const input: MapInput = {
        layers: [
          {
            name: 'cities',
            type: 'scatterplot',
            geojsonData: pointFeatures,
            radiusBy: { attribute: 'pop', scale: [3, 20] },
          },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)
      const radius = result.layers[0].paint['circle-radius']

      expect(radius[0]).toBe('interpolate')
      expect(radius[2]).toEqual(['get', 'pop'])
      expect(radius[3]).toBe(1000) // min data value
      expect(radius[4]).toBe(3)    // min size
      expect(radius[5]).toBe(5000) // max data value
      expect(radius[6]).toBe(20)   // max size
    })
  })

  describe('arc layer translation', () => {
    const arcFeatures = makeFeatureCollection([
      makeArcFeature([10, 48], [12, 50], { trips: 100 }),
      makeArcFeature([11, 49], [13, 51], { trips: 200 }),
    ])

    it('converts arcs to bezier LineString geometries', () => {
      const input: MapInput = {
        layers: [
          {
            name: 'flows',
            type: 'arc',
            geojsonData: arcFeatures,
            color: '#ff0000',
          },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)

      expect(result.layers).toHaveLength(1)
      const arcLine = result.layers[0]
      expect(arcLine.id).toBe('flows-arc')
      expect(arcLine.type).toBe('line')

      // The source should contain converted LineString features with > 2 coordinates
      const sourceData = result.sources['source-flows'].data as GeoJSON.FeatureCollection
      expect(sourceData.features).toHaveLength(2)
      const firstGeom = sourceData.features[0].geometry as GeoJSON.LineString
      expect(firstGeom.type).toBe('LineString')
      expect(firstGeom.coordinates.length).toBe(21) // 20 segments + 1
    })

    it('preserves feature properties through arc conversion', () => {
      const input: MapInput = {
        layers: [
          {
            name: 'flows',
            type: 'arc',
            geojsonData: arcFeatures,
          },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)
      const sourceData = result.sources['source-flows'].data as GeoJSON.FeatureCollection
      expect(sourceData.features[0].properties).toEqual({ trips: 100 })
      expect(sourceData.features[1].properties).toEqual({ trips: 200 })
    })

    it('uses custom arcHeight and arcTilt', () => {
      const input: MapInput = {
        layers: [
          {
            name: 'flows',
            type: 'arc',
            geojsonData: arcFeatures,
            arcHeight: 0.5,
            arcTilt: 45,
          },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)
      const sourceData = result.sources['source-flows'].data as GeoJSON.FeatureCollection
      const coords = (sourceData.features[0].geometry as GeoJSON.LineString).coordinates

      // With height=0.5 and tilt=45, the curve should deviate significantly from straight line
      // Check that the midpoint is NOT on the straight line
      const midIdx = Math.floor(coords.length / 2)
      const straightMidLon = (10 + 12) / 2
      const straightMidLat = (48 + 50) / 2

      // At least one of lon/lat should differ from straight line by > 0.01
      const lonDiff = Math.abs(coords[midIdx][0] - straightMidLon)
      const latDiff = Math.abs(coords[midIdx][1] - straightMidLat)
      expect(lonDiff + latDiff).toBeGreaterThan(0.01)
    })
  })

  describe('colorBy: categorical', () => {
    const categoricalFeatures = makeFeatureCollection([
      makePointFeature(10, 48, { mode: 'car' }),
      makePointFeature(11, 49, { mode: 'bike' }),
      makePointFeature(12, 50, { mode: 'car' }),
      makePointFeature(13, 51, { mode: 'walk' }),
    ])

    it('builds match expression for categorical colorBy', () => {
      const input: MapInput = {
        layers: [
          {
            name: 'trips',
            type: 'scatterplot',
            geojsonData: categoricalFeatures,
            colorBy: {
              attribute: 'mode',
              type: 'categorical',
            },
          },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)
      const color = result.layers[0].paint['circle-color']

      expect(color[0]).toBe('match')
      expect(color[1]).toEqual(['get', 'mode'])
      // Should have entries for bike, car, walk (sorted)
      // Format: [match, getter, val1, color1, val2, color2, val3, color3, fallback]
      expect(color).toContain('bike')
      expect(color).toContain('car')
      expect(color).toContain('walk')
      // Last element is fallback
      expect(color[color.length - 1]).toBe('#808080')
    })

    it('uses custom colors when provided', () => {
      const input: MapInput = {
        layers: [
          {
            name: 'trips',
            type: 'scatterplot',
            geojsonData: categoricalFeatures,
            colorBy: {
              attribute: 'mode',
              type: 'categorical',
              colors: { car: '#ff0000', bike: '#00ff00', walk: '#0000ff' },
            },
          },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)
      const color = result.layers[0].paint['circle-color']

      // Find the color after 'car'
      const carIdx = color.indexOf('car')
      expect(color[carIdx + 1]).toBe('#ff0000')

      const bikeIdx = color.indexOf('bike')
      expect(color[bikeIdx + 1]).toBe('#00ff00')

      const walkIdx = color.indexOf('walk')
      expect(color[walkIdx + 1]).toBe('#0000ff')
    })

    it('produces categorical legend data', () => {
      const input: MapInput = {
        layers: [
          {
            name: 'trips',
            type: 'scatterplot',
            geojsonData: categoricalFeatures,
            colorBy: {
              attribute: 'mode',
              type: 'categorical',
            },
          },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)

      expect(result.legend).toBeDefined()
      expect(result.legend!.type).toBe('categorical')
      expect(result.legend!.title).toBe('mode')
      expect(result.legend!.items).toHaveLength(3)
      expect(result.legend!.items!.map(i => i.label)).toEqual(['bike', 'car', 'walk'])
    })
  })

  describe('colorBy: numeric', () => {
    const numericFeatures = makeFeatureCollection([
      makePolygonFeature(
        [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        { population: 1000 },
      ),
      makePolygonFeature(
        [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]],
        { population: 5000 },
      ),
    ])

    it('builds interpolate expression for numeric colorBy', () => {
      const input: MapInput = {
        layers: [
          {
            name: 'zones',
            type: 'polygon',
            geojsonData: numericFeatures,
            colorBy: {
              attribute: 'population',
              type: 'numeric',
            },
          },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)
      const fillColor = result.layers[0].paint['fill-color']

      expect(fillColor[0]).toBe('interpolate')
      expect(fillColor[1]).toEqual(['linear'])
      expect(fillColor[2]).toEqual(['get', 'population'])
      // min value → min color
      expect(fillColor[3]).toBe(1000)
      expect(typeof fillColor[4]).toBe('string')
      // max value → max color
      expect(fillColor[5]).toBe(5000)
      expect(typeof fillColor[6]).toBe('string')
    })

    it('uses explicit scale when provided', () => {
      const input: MapInput = {
        layers: [
          {
            name: 'zones',
            type: 'polygon',
            geojsonData: numericFeatures,
            colorBy: {
              attribute: 'population',
              type: 'numeric',
              scale: [0, 10000],
            },
          },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)
      const fillColor = result.layers[0].paint['fill-color']

      expect(fillColor[3]).toBe(0)
      expect(fillColor[5]).toBe(10000)
    })

    it('produces numeric legend data', () => {
      const input: MapInput = {
        layers: [
          {
            name: 'zones',
            type: 'polygon',
            geojsonData: numericFeatures,
            colorBy: {
              attribute: 'population',
              type: 'numeric',
            },
          },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)

      expect(result.legend).toBeDefined()
      expect(result.legend!.type).toBe('numeric')
      expect(result.legend!.title).toBe('population')
      expect(result.legend!.minValue).toBe(1000)
      expect(result.legend!.maxValue).toBe(5000)
      expect(result.legend!.minColor).toBeDefined()
      expect(result.legend!.maxColor).toBeDefined()
    })

    it('uses explicit minColor and maxColor for numeric colorBy', () => {
      const input: MapInput = {
        layers: [
          {
            name: 'zones',
            type: 'polygon',
            geojsonData: numericFeatures,
            colorBy: {
              attribute: 'population',
              type: 'numeric',
              minColor: '#d1d5db',
              maxColor: '#b91c1c',
            } as any,
          },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)
      const fillColor = result.layers[0].paint['fill-color']

      expect(fillColor[4]).toBe('#d1d5db')
      expect(fillColor[6]).toBe('#b91c1c')
      expect(result.legend!.minColor).toBe('#d1d5db')
      expect(result.legend!.maxColor).toBe('#b91c1c')
    })

    it('applies numeric colorBy to polygon outlines as well as fills', () => {
      const input: MapInput = {
        layers: [
          {
            name: 'zones',
            type: 'polygon',
            geojsonData: numericFeatures,
            fillOpacity: 0,
            colorBy: {
              attribute: 'population',
              type: 'numeric',
            },
          },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)
      const fillColor = result.layers[0].paint['fill-color']
      const outlineColor = result.layers[1].paint['line-color']

      expect(outlineColor).toEqual(fillColor)
    })
  })

  describe('multiple layers', () => {
    it('creates separate sources for each layer', () => {
      const input: MapInput = {
        layers: [
          {
            name: 'polygons',
            type: 'polygon',
            geojsonData: makeFeatureCollection([
              makePolygonFeature([[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]),
            ]),
          },
          {
            name: 'points',
            type: 'scatterplot',
            geojsonData: makeFeatureCollection([
              makePointFeature(0.5, 0.5),
            ]),
          },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)

      expect(Object.keys(result.sources)).toEqual(['source-polygons', 'source-points'])
      // polygon (fill + outline) + scatterplot (circle) = 3 layers
      expect(result.layers).toHaveLength(3)
    })

    it('uses legend from first layer that has colorBy', () => {
      const input: MapInput = {
        layers: [
          {
            name: 'plain',
            type: 'polygon',
            geojsonData: makeFeatureCollection([
              makePolygonFeature([[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]),
            ]),
            // no colorBy
          },
          {
            name: 'colored',
            type: 'scatterplot',
            geojsonData: makeFeatureCollection([
              makePointFeature(10, 48, { mode: 'car' }),
              makePointFeature(11, 49, { mode: 'bike' }),
            ]),
            colorBy: { attribute: 'mode', type: 'categorical' },
          },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)

      expect(result.legend).toBeDefined()
      expect(result.legend!.title).toBe('mode')
    })

    it('prefers input legend over layer-generated legend', () => {
      const input: MapInput = {
        layers: [
          {
            name: 'colored',
            type: 'scatterplot',
            geojsonData: makeFeatureCollection([
              makePointFeature(10, 48, { mode: 'car' }),
            ]),
            colorBy: { attribute: 'mode', type: 'categorical' },
          },
        ],
        legend: {
          type: 'categorical',
          title: 'Resolved legend',
          items: [{ label: 'car', color: '#ff0000' }],
        },
      } as any
      const result = buildMapRenderConfig(input, LIGHT_STYLE)
      expect(result.legend!.title).toBe('Resolved legend')
    })
  })

  describe('GeoJSON sources', () => {
    it('stores geojson data in sources keyed by source-{name}', () => {
      const features = makeFeatureCollection([makePointFeature(10, 48)])
      const input: MapInput = {
        layers: [
          { name: 'pts', type: 'scatterplot', geojsonData: features },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)

      expect(result.sources['source-pts']).toBeDefined()
      expect(result.sources['source-pts'].type).toBe('geojson')
      expect(result.sources['source-pts'].data).toBe(features)
    })
  })

  describe('edge cases', () => {
    it('handles empty layers array', () => {
      const result = buildMapRenderConfig({ layers: [] }, LIGHT_STYLE)
      expect(result.layers).toEqual([])
      expect(result.sources).toEqual({})
    })

    it('handles empty feature collections', () => {
      const input: MapInput = {
        layers: [
          {
            name: 'empty',
            type: 'scatterplot',
            geojsonData: makeFeatureCollection([]),
          },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)
      expect(result.layers).toHaveLength(1)
      expect(result.sources['source-empty']).toBeDefined()
    })

    it('handles numeric colorBy with single-value data (zero range)', () => {
      const features = makeFeatureCollection([
        makePointFeature(10, 48, { val: 5 }),
        makePointFeature(11, 49, { val: 5 }),
      ])
      const input: MapInput = {
        layers: [
          {
            name: 'pts',
            type: 'scatterplot',
            geojsonData: features,
            colorBy: { attribute: 'val', type: 'numeric' },
          },
        ],
      }
      // Should not throw - guards against zero-range division
      const result = buildMapRenderConfig(input, LIGHT_STYLE)
      const color = result.layers[0].paint['circle-color']
      expect(color[0]).toBe('interpolate')
      // min=5, max=6 (guarded)
      expect(color[3]).toBe(5)
      expect(color[5]).toBe(6)
    })

    it('handles widthBy with single-value data (zero range)', () => {
      const features = makeFeatureCollection([
        makeLineFeature([[0, 0], [1, 1]], { flow: 42 }),
        makeLineFeature([[2, 2], [3, 3]], { flow: 42 }),
      ])
      const input: MapInput = {
        layers: [
          {
            name: 'routes',
            type: 'line',
            geojsonData: features,
            widthBy: { attribute: 'flow', scale: [1, 10] },
          },
        ],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)
      const width = result.layers[0].paint['line-width']
      expect(width[0]).toBe('interpolate')
      // min=42, max=43 (guarded)
      expect(width[3]).toBe(42)
      expect(width[5]).toBe(43)
    })

    it('uses resolvedColorBy before raw layer colorBy', () => {
      const features = makeFeatureCollection([
        makePolygonFeature([[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]], { activated: 1 }),
      ])
      const input: MapInput = {
        layers: [{
          name: 'zones',
          type: 'fill',
          geojsonData: features,
          colorBy: { attribute: 'other', type: 'categorical' },
          resolvedColorBy: {
            attribute: 'activated',
            type: 'categorical',
            colors: { '1': '#27ae60' },
          },
        } as any],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)
      const fillColor = result.layers[0].paint['fill-color']
      expect(fillColor[1]).toEqual(['get', 'activated'])
      expect(fillColor).toContain('#27ae60')
    })

    it('translates resolvedDimWhen into opacity expressions', () => {
      const features = makeFeatureCollection([
        makePolygonFeature([[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]], { active: 0 }),
      ])
      const input: MapInput = {
        layers: [{
          name: 'zones',
          type: 'fill',
          geojsonData: features,
          opacity: 0.9,
          resolvedDimWhen: { attribute: 'active', equals: 0, opacity: 0.15 },
        } as any],
      }
      const result = buildMapRenderConfig(input, LIGHT_STYLE)
      expect(result.layers[0].paint['fill-opacity']).toEqual([
        'case',
        ['==', ['to-string', ['get', 'active']], '0'],
        0.15,
        0.9,
      ])
    })
  })
})

describe('generateBezierArc', () => {
  it('starts at source and ends at destination', () => {
    const src: [number, number] = [10, 48]
    const dst: [number, number] = [12, 50]
    const coords = generateBezierArc(src, dst, 0.2, 25, 20)

    expect(coords[0]).toEqual(src)
    expect(coords[coords.length - 1][0]).toBeCloseTo(dst[0], 10)
    expect(coords[coords.length - 1][1]).toBeCloseTo(dst[1], 10)
  })

  it('produces the requested number of segments + 1 points', () => {
    const coords = generateBezierArc([0, 0], [10, 10], 0.3, 0, 15)
    expect(coords).toHaveLength(16) // 15 segments = 16 points
  })

  it('produces a curved path (not straight)', () => {
    const src: [number, number] = [0, 0]
    const dst: [number, number] = [10, 0]
    const coords = generateBezierArc(src, dst, 0.5, 0, 20)

    // The midpoint of a straight line would be at [5, 0]
    // With height=0.5 and tilt=0, the curve should deviate in y
    const midIdx = 10 // midpoint index
    expect(Math.abs(coords[midIdx][1])).toBeGreaterThan(0.1)
  })

  it('handles degenerate case (same source and destination)', () => {
    const coords = generateBezierArc([5, 5], [5, 5], 0.3, 25, 20)
    // Intra-zone arcs render as a small circle loop (not a zero-length line)
    expect(coords.length).toBe(21) // segments + 1
    // All points within the loop radius (~0.008°) of the center
    const loopRadius = 0.008
    for (const [lon, lat] of coords) {
      const d = Math.sqrt((lon - 5) ** 2 + (lat - 5) ** 2)
      expect(d).toBeCloseTo(loopRadius, 4)
    }
    // Closed loop: first point equals last
    expect(coords[0][0]).toBeCloseTo(coords[coords.length - 1][0], 10)
    expect(coords[0][1]).toBeCloseTo(coords[coords.length - 1][1], 10)
  })

  it('tilt rotates the arc in a different direction', () => {
    const src: [number, number] = [0, 0]
    const dst: [number, number] = [10, 0]

    const arcTilt0 = generateBezierArc(src, dst, 0.5, 0, 20)
    const arcTilt90 = generateBezierArc(src, dst, 0.5, 90, 20)

    // The midpoints should be different
    const mid0 = arcTilt0[10]
    const mid90 = arcTilt90[10]

    const dist = Math.sqrt(
      (mid0[0] - mid90[0]) ** 2 + (mid0[1] - mid90[1]) ** 2,
    )
    expect(dist).toBeGreaterThan(0.1)
  })
})
