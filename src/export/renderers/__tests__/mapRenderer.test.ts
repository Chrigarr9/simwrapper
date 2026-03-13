import { describe, it, expect } from 'vitest'
import { renderMap } from '../mapRenderer'
import type { MapRenderConfig } from '../../types'

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
})
