import { computeAllLayerRoles } from '../plugins/interactive-dashboard/managers/LayerColoringManager'
import type { LegendData } from './types'

export interface MapSemanticLayer extends Record<string, any> {
  name: string
  type: string
  geojsonData: GeoJSON.FeatureCollection
  zIndex?: number
}

export interface ResolveMapSemanticsArgs {
  layers: MapSemanticLayer[]
  filteredData: any[]
  colorByAttribute?: string
  colorByOptions?: Array<Record<string, any>>
  layerStrategy?: string
  geometryType?: string
}

export interface ResolvedMapSemantics {
  layers: MapSemanticLayer[]
  legend?: LegendData
}

export function resolveMapSemantics(args: ResolveMapSemanticsArgs): ResolvedMapSemantics {
  const colorByOptions = args.colorByOptions ?? []
  const visible = filterVisibleLayers(args.layers, args.geometryType)
  const sorted = sortLayerConfigs(visible)
  const roles = computeAllLayerRoles(sorted as any[], args.layerStrategy as any)

  let resolvedLayers = sorted.map(layer => {
    const colorBy = normalizeColorBy(layer.colorBy)
    return {
      ...layer,
      ...(colorBy ? { colorBy } : {}),
      resolvedRole: roles.get(layer.name),
      resolvedDimWhen: layer.dimWhen,
      resolvedOpacity: layer.opacity ?? layer.fillOpacity,
    }
  })

  resolvedLayers = applyDashboardColorBy(
    resolvedLayers,
    args.filteredData ?? [],
    args.colorByAttribute,
    colorByOptions
  )

  resolvedLayers = resolvedLayers.map(layer => {
    if (!layer.resolvedDimWhen?.attribute) return layer
    return enrichLayerWithJoinedAttribute(
      layer,
      args.filteredData ?? [],
      layer.resolvedDimWhen.attribute,
      colorByOptions
    )
  })

  return {
    layers: resolvedLayers,
    legend: buildFirstLegend(resolvedLayers),
  }
}

function filterVisibleLayers(layers: MapSemanticLayer[], geometryType?: string): MapSemanticLayer[] {
  return layers.filter(layer => {
    if (layer.visible === false) return false
    if (layer.geometryType && geometryType && geometryType !== 'all') {
      return layer.geometryType === geometryType
    }
    return true
  })
}

function sortLayerConfigs(layers: MapSemanticLayer[]): MapSemanticLayer[] {
  return layers
    .map((layer, index) => ({ layer, index }))
    .sort((a, b) => {
      const az = a.layer.zIndex
      const bz = b.layer.zIndex
      if (az !== undefined && bz !== undefined) return az - bz
      if (az !== undefined) return -1
      if (bz !== undefined) return 1
      return a.index - b.index
    })
    .map(item => item.layer)
}

function applyDashboardColorBy(
  layers: MapSemanticLayer[],
  filteredData: any[],
  colorByAttribute?: string,
  colorByOptions: Array<Record<string, any>> = []
): MapSemanticLayer[] {
  if (!colorByAttribute) return layers

  const option = colorByOptions.find(opt => opt.attribute === colorByAttribute) ?? {
    attribute: colorByAttribute,
    type: 'categorical',
  }

  return layers.map(layer => {
    const role = layer.resolvedRole?.role
    if (role === 'neutral') return layer

    const enriched = enrichLayerWithJoinedAttribute(layer, filteredData, colorByAttribute, colorByOptions)
    return {
      ...enriched,
      resolvedColorBy: {
        attribute: colorByAttribute,
        type: option.type ?? 'categorical',
        label: option.label,
        colors: option.colors,
        scale: option.scale,
        minColor: option.minColor,
        maxColor: option.maxColor,
      },
    }
  })
}

function enrichLayerWithJoinedAttribute(
  layer: MapSemanticLayer,
  rows: any[],
  attribute: string,
  colorByOptions: Array<Record<string, any>>
): MapSemanticLayer {
  const linkage = layer.linkage
  if (!linkage?.geoProperty || !linkage?.tableColumn) return layer

  const option = colorByOptions.find(opt => opt.attribute === attribute)
  const grouped = new Map<string, any[]>()
  for (const row of rows) {
    const key = row[linkage.tableColumn]
    if (key === undefined || key === null) continue
    const group = grouped.get(String(key)) ?? []
    group.push(row)
    grouped.set(String(key), group)
  }

  return {
    ...layer,
    geojsonData: {
      ...layer.geojsonData,
      features: (layer.geojsonData.features ?? []).map(feature => {
        const key = feature.properties?.[linkage.geoProperty]
        const matchingRows = key === undefined || key === null
          ? []
          : grouped.get(String(key)) ?? []
        const value = aggregateJoinedAttribute(matchingRows, attribute, option?.aggregation)
        if (value === undefined) return feature
        return {
          ...feature,
          properties: {
            ...(feature.properties ?? {}),
            [attribute]: value,
          },
        }
      }),
    },
  }
}

function aggregateJoinedAttribute(rows: any[], attribute: string, aggregation?: string): any {
  const rawValues = rows
    .map(row => row[attribute])
    .filter(value => value !== undefined && value !== null)
  if (rawValues.length === 0) return undefined

  const numericValues = rawValues.map(Number).filter(Number.isFinite)
  if (numericValues.length === rawValues.length) {
    const method = aggregation ?? (attribute.toLowerCase().includes('count') ? 'sum' : 'mean')
    if (method === 'sum') return numericValues.reduce((sum, value) => sum + value, 0)
    if (method === 'min') return Math.min(...numericValues)
    if (method === 'max') return Math.max(...numericValues)
    if (method === 'first') return numericValues[0]
    return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length
  }

  return rawValues[0]
}

function buildFirstLegend(layers: MapSemanticLayer[]): LegendData | undefined {
  for (const layer of layers) {
    const colorBy = getEffectiveColorBy(layer)
    if (!colorBy) continue
    if (colorBy.type === 'numeric') return buildNumericLegend(layer, colorBy)
    return buildCategoricalLegend(layer, colorBy)
  }
  return undefined
}

function getEffectiveColorBy(layer: MapSemanticLayer): Record<string, any> | undefined {
  const colorBy = normalizeColorBy(layer.resolvedColorBy ?? layer.colorBy)
  if (!colorBy) return undefined
  return colorBy
}

function normalizeColorBy(colorBy: any): Record<string, any> | undefined {
  if (!colorBy) return undefined
  if (typeof colorBy === 'string') {
    return { attribute: colorBy, type: 'categorical' }
  }
  return colorBy
}

function buildCategoricalLegend(
  layer: MapSemanticLayer,
  colorBy: Record<string, any>
): LegendData {
  const values = new Set<string>()
  for (const feature of layer.geojsonData.features ?? []) {
    const value = feature.properties?.[colorBy.attribute]
    if (value !== undefined && value !== null) values.add(String(value))
  }

  const sortedValues = Array.from(values).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  )

  return {
    type: 'categorical',
    title: colorBy.label ?? colorBy.attribute,
    items: sortedValues.map((value, index) => ({
      label: value,
      color: colorBy.colors?.[value] ?? fallbackColor(index),
    })),
  }
}

function buildNumericLegend(
  layer: MapSemanticLayer,
  colorBy: Record<string, any>
): LegendData {
  const values = (layer.geojsonData.features ?? [])
    .map(feature => Number(feature.properties?.[colorBy.attribute]))
    .filter(Number.isFinite)

  const minValue = colorBy.scale?.[0] ?? (values.length ? Math.min(...values) : 0)
  const maxRaw = colorBy.scale?.[1] ?? (values.length ? Math.max(...values) : 1)
  const maxValue = minValue === maxRaw ? minValue + 1 : maxRaw

  return {
    type: 'numeric',
    title: colorBy.label ?? colorBy.attribute,
    minValue,
    maxValue,
    minColor: colorBy.minColor,
    maxColor: colorBy.maxColor,
  }
}

function fallbackColor(index: number): string {
  const palette = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00']
  return palette[index % palette.length]
}
