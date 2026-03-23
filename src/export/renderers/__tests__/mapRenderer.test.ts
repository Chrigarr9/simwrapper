import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { renderMap } from '../mapRenderer'
import type { MapRenderConfig, LegendData } from '../../types'

describe('mapRenderer', () => {
  it('renders a simple map to PNG with valid header', async () => {
    const config: MapRenderConfig = {
      center: [11.87, 48.90], // Kelheim area
      zoom: 10,
      width: 400,
      height: 300,
      scale: 1,
      styleUrl: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      layers: [],
      sources: {},
    }

    const result = await renderMap(config, 'test-map')
    expect(result.filename).toBe('test-map')
    expect(result.format).toBe('png')
    expect(result.data).toBeInstanceOf(Buffer)
    expect(result.data.length).toBeGreaterThan(100)
    // PNG magic bytes
    expect(result.data[0]).toBe(0x89)
    expect(result.data[1]).toBe(0x50) // P
    expect(result.data[2]).toBe(0x4e) // N
    expect(result.data[3]).toBe(0x47) // G
  }, 60000) // Network-dependent, generous timeout

  it('renders map with a GeoJSON source and layer', async () => {
    const geojson = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: { name: 'test' },
          geometry: {
            type: 'Point' as const,
            coordinates: [11.87, 48.90],
          },
        },
      ],
    }

    const config: MapRenderConfig = {
      center: [11.87, 48.90],
      zoom: 10,
      width: 400,
      height: 300,
      scale: 1,
      styleUrl: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      sources: {
        'test-source': { type: 'geojson', data: geojson },
      },
      layers: [
        {
          id: 'test-points',
          type: 'circle',
          source: 'test-source',
          paint: { 'circle-radius': 6, 'circle-color': '#ff0000' },
        },
      ],
    }

    const result = await renderMap(config, 'test-geojson-map')
    expect(result.data[0]).toBe(0x89) // Valid PNG
  }, 60000)

  it('renders filled GeoJSON polygons into the output image', async () => {
    const style = {
      version: 8,
      name: 'test-style',
      sources: {},
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: { 'background-color': '#ffffff' },
        },
      ],
    }

    const geojson = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: { name: 'test-polygon' },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [[
              [11.82, 48.85],
              [11.92, 48.85],
              [11.92, 48.95],
              [11.82, 48.95],
              [11.82, 48.85],
            ]],
          },
        },
      ],
    }

    const config: MapRenderConfig = {
      center: [11.87, 48.9],
      zoom: 10,
      width: 256,
      height: 256,
      scale: 1,
      styleUrl: `data:application/json,${encodeURIComponent(JSON.stringify(style))}`,
      sources: {
        'polygon-source': { type: 'geojson', data: geojson },
      },
      layers: [
        {
          id: 'polygon-fill',
          type: 'fill',
          source: 'polygon-source',
          paint: {
            'fill-color': '#ff0000',
            'fill-opacity': 1,
          },
        },
      ],
    }

    const result = await renderMap(config, 'test-polygon-map')
    const { data, info } = await sharp(result.data)
      .raw()
      .toBuffer({ resolveWithObject: true })

    const centerOffset = ((Math.floor(info.height / 2) * info.width) + Math.floor(info.width / 2)) * info.channels
    const centerPixel = data.subarray(centerOffset, centerOffset + info.channels)

    expect(centerPixel[0]).toBeGreaterThan(200)
    expect(centerPixel[1]).toBeLessThan(80)
    expect(centerPixel[2]).toBeLessThan(80)
  }, 60000)

  it('renders GeoJSON overlays on top of a remote basemap style at high export scale', async () => {
    const geojson = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: { name: 'remote-style-test' },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [[
              [11.82, 48.85],
              [11.92, 48.85],
              [11.92, 48.95],
              [11.82, 48.95],
              [11.82, 48.85],
            ]],
          },
        },
      ],
    }

    const config: MapRenderConfig = {
      center: [11.87, 48.9],
      zoom: 10,
      width: 400,
      height: 300,
      scale: 2,
      styleUrl: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      sources: {
        'remote-polygon-source': { type: 'geojson', data: geojson },
      },
      layers: [
        {
          id: 'remote-polygon-fill',
          type: 'fill',
          source: 'remote-polygon-source',
          paint: {
            'fill-color': '#ff0000',
            'fill-opacity': 1,
          },
        },
      ],
    }

    const result = await renderMap(config, 'test-remote-style-map')
    const { data, info } = await sharp(result.data)
      .raw()
      .toBuffer({ resolveWithObject: true })

    let redPixels = 0
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      if (r > 200 && g < 80 && b < 80) redPixels++
    }

    expect(redPixels).toBeGreaterThan(1000)
  }, 60000)

  it('composites a map legend into the exported image', async () => {
    const style = {
      version: 8,
      name: 'legend-test-style',
      sources: {},
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: { 'background-color': '#ffffff' },
        },
      ],
    }

    const legend: LegendData = {
      type: 'numeric',
      title: 'activation_rate',
      minValue: 0,
      maxValue: 1,
      minColor: '#440154',
      maxColor: '#fde725',
    }

    const config: MapRenderConfig = {
      center: [11.87, 48.9],
      zoom: 10,
      width: 320,
      height: 240,
      scale: 1,
      styleUrl: `data:application/json,${encodeURIComponent(JSON.stringify(style))}`,
      sources: {},
      layers: [],
      legend,
    }

    const result = await renderMap(config, 'test-legend-map')
    const { data, info } = await sharp(result.data)
      .raw()
      .toBuffer({ resolveWithObject: true })

    let nonWhiteBottomRight = 0
    const startX = Math.floor(info.width * 0.65)
    const startY = Math.floor(info.height * 0.6)
    for (let y = startY; y < info.height; y++) {
      for (let x = startX; x < info.width; x++) {
        const offset = (y * info.width + x) * info.channels
        const r = data[offset]
        const g = data[offset + 1]
        const b = data[offset + 2]
        if (!(r > 245 && g > 245 && b > 245)) {
          nonWhiteBottomRight++
        }
      }
    }

    expect(nonWhiteBottomRight).toBeGreaterThan(100)
  }, 60000)
})
