import { describe, it, expect } from 'vitest'
import { resolveMapSemantics } from '../mapSemantics'

const fc = (features: any[]) => ({ type: 'FeatureCollection' as const, features })
const polygon = (id: string, props = {}) => ({
  type: 'Feature' as const,
  properties: { id, ...props },
  geometry: {
    type: 'Polygon' as const,
    coordinates: [[
      [0, 0], [1, 0], [1, 1], [0, 1], [0, 0],
    ]],
  },
})

describe('resolveMapSemantics', () => {
  it('sorts layers by zIndex before original order', () => {
    const result = resolveMapSemantics({
      layers: [
        { name: 'top', type: 'fill', zIndex: 10, geojsonData: fc([polygon('a')]) },
        { name: 'bottom', type: 'fill', zIndex: 1, geojsonData: fc([polygon('b')]) },
      ],
      filteredData: [],
      colorByAttribute: '',
      colorByOptions: [],
      layerStrategy: 'auto',
    })
    expect(result.layers.map(l => l.name)).toEqual(['bottom', 'top'])
  })

  it('excludes invisible layers before sorting and role computation', () => {
    const result = resolveMapSemantics({
      layers: [
        { name: 'hidden-arc', type: 'arc', visible: false, linkage: { geoProperty: 'id', tableColumn: 'cluster_id' }, geojsonData: fc([polygon('a')]) },
        { name: 'visible-fill', type: 'fill', linkage: { geoProperty: 'id', tableColumn: 'cluster_id' }, geojsonData: fc([polygon('b')]) },
      ],
      filteredData: [],
      layerStrategy: 'auto',
    })
    expect(result.layers.map(l => l.name)).toEqual(['visible-fill'])
    expect(result.layers[0].resolvedRole?.role).toBe('primary')
  })

  it('returns a categorical legend for per-layer colorBy colors', () => {
    const result = resolveMapSemantics({
      layers: [{
        name: 'clusters',
        type: 'fill',
        geojsonData: fc([polygon('a', { activated: 1 }), polygon('b', { activated: 0 })]),
        colorBy: { attribute: 'activated', type: 'categorical', colors: { '0': '#888888', '1': '#27ae60' } },
      }],
      filteredData: [],
      colorByAttribute: '',
      colorByOptions: [],
      layerStrategy: 'auto',
    })
    expect(result.legend?.type).toBe('categorical')
    expect(result.legend?.items).toContainEqual({ label: '1', color: '#27ae60' })
  })

  it('normalizes per-layer string colorBy for map translation', () => {
    const result = resolveMapSemantics({
      layers: [{
        name: 'clusters',
        type: 'fill',
        geojsonData: fc([polygon('a', { activated: 1 })]),
        colorBy: 'activated',
      }],
      filteredData: [],
    })
    expect(result.layers[0].colorBy).toEqual({
      attribute: 'activated',
      type: 'categorical',
    })
  })

  it('builds dashboard-level categorical colors from filtered table rows via linkage', () => {
    const result = resolveMapSemantics({
      layers: [{
        name: 'clusters',
        type: 'fill',
        geojsonData: fc([polygon('c1'), polygon('c2')]),
        linkage: { geoProperty: 'id', tableColumn: 'cluster_id' },
        colorByRole: 'primary',
      }],
      filteredData: [
        { cluster_id: 'c1', activated: 1 },
        { cluster_id: 'c2', activated: 0 },
      ],
      colorByAttribute: 'activated',
      colorByOptions: [{
        attribute: 'activated',
        type: 'categorical',
        label: 'Activated',
        colors: { '0': '#888888', '1': '#27ae60' },
      }],
      layerStrategy: 'explicit',
    })

    expect(result.legend?.title).toBe('Activated')
    expect(result.legend?.items).toContainEqual({ label: '1', color: '#27ae60' })
    expect(result.layers[0].resolvedColorBy?.attribute).toBe('activated')
    expect(result.layers[0].geojsonData.features[0].properties?.activated).toBe(1)
    expect(result.layers[0].geojsonData.features[1].properties?.activated).toBe(0)
  })

  it('records dimWhen styling for MapLibre translation', () => {
    const result = resolveMapSemantics({
      layers: [{
        name: 'clusters',
        type: 'fill',
        geojsonData: fc([polygon('c1', { active: 0 }), polygon('c2', { active: 1 })]),
        dimWhen: { attribute: 'active', equals: 0, opacity: 0.15, widthMultiplier: 0.5 },
        opacity: 0.9,
      }],
      filteredData: [],
    })
    expect(result.layers[0].resolvedDimWhen).toEqual({
      attribute: 'active',
      equals: 0,
      opacity: 0.15,
      widthMultiplier: 0.5,
    })
  })

  it('enriches linked features for dimWhen attributes from filtered rows', () => {
    const result = resolveMapSemantics({
      layers: [{
        name: 'clusters',
        type: 'fill',
        geojsonData: fc([polygon('c1'), polygon('c2')]),
        linkage: { geoProperty: 'id', tableColumn: 'cluster_id' },
        dimWhen: { attribute: 'active', equals: 0, opacity: 0.15 },
      }],
      filteredData: [
        { cluster_id: 'c1', active: 0 },
        { cluster_id: 'c2', active: 1 },
      ],
    })
    expect(result.layers[0].geojsonData.features[0].properties?.active).toBe(0)
    expect(result.layers[0].resolvedDimWhen.attribute).toBe('active')
  })
})
