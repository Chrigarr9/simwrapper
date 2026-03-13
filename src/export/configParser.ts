import YAML from 'yaml'
import { EXPORT_DEFAULTS, PRINT_CHART_STYLE } from './defaults'
import type {
  DashboardConfig, ExportSection, LinkedExportConfig,
  ExportItem, ChartStyle, ExportDefaults
} from './types'

export interface ParsedExportConfig {
  table: { file: string; idColumn?: string; columns?: any }
  cards: Record<string, Record<string, any>>
  exportSection: ExportSection
  outputNaming: string
}

/**
 * Parse export config from YAML string.
 * Handles three formats:
 * 1. Inline: dashboard YAML with `layout` + `export:` section
 * 2. Linked: export YAML with `dashboard:` field referencing a dashboard file
 * 3. Standalone: export YAML with `plots` defined directly (no layout/dashboard)
 */
export function parseExportConfig(
  yamlText: string,
  dashboardYamlText?: string
): ParsedExportConfig {
  const parsed = YAML.parse(yamlText)

  // Detect mode: linked (has `dashboard` field) or inline (has `layout` + `export`) or standalone
  if (parsed.dashboard && dashboardYamlText) {
    return parseLinkedConfig(parsed as LinkedExportConfig, dashboardYamlText)
  }

  if (parsed.layout && parsed.export) {
    return parseInlineConfig(parsed as DashboardConfig)
  }

  // Standalone: has `plots` (as dict of plot definitions) + `states` at top level
  if (parsed.plots && parsed.states) {
    return parseStandaloneConfig(parsed)
  }

  throw new Error(
    'Unrecognized export YAML format. Expected one of: ' +
    '(1) dashboard with layout+export sections, ' +
    '(2) linked config with dashboard field, or ' +
    '(3) standalone config with plots+states fields'
  )
}

function parseInlineConfig(dashboard: DashboardConfig): ParsedExportConfig {
  if (!dashboard.export) throw new Error('Dashboard YAML has no export: section')
  if (!dashboard.layout) throw new Error('Dashboard YAML has no layout: section')
  if (!dashboard.table?.file) throw new Error('Dashboard YAML has no table.file')

  const cards = resolveCardsFromLayout(dashboard.layout)
  validateCardReferences(cards, dashboard.export)

  return {
    table: dashboard.table,
    cards,
    exportSection: dashboard.export,
    outputNaming: dashboard.export.output?.naming ?? '{state}-{plot}',
  }
}

function parseLinkedConfig(
  exportConfig: LinkedExportConfig,
  dashboardYamlText: string
): ParsedExportConfig {
  const dashboard = YAML.parse(dashboardYamlText) as DashboardConfig
  if (!dashboard.layout) throw new Error('Referenced dashboard has no layout: section')
  if (!dashboard.table?.file) throw new Error('Referenced dashboard has no table.file')

  const cards = resolveCardsFromLayout(dashboard.layout)
  const exportSection: ExportSection = {
    defaults: exportConfig.defaults,
    plots: exportConfig.plots,
    states: exportConfig.states,
    output: exportConfig.output,
  }
  validateCardReferences(cards, exportSection)

  return {
    table: dashboard.table,
    cards,
    exportSection,
    outputNaming: exportConfig.output?.naming ?? '{state}-{plot}',
  }
}

/**
 * Standalone format: plots defined directly at top level (not from a dashboard layout).
 * Format:
 *   table: { file: ... }
 *   defaults: { format, width, ... }
 *   plots: { plot-name: { type, xColumn, yColumn, ... }, ... }
 *   states: { state-name: { export: [...], filters: ... }, ... }
 *   output: { naming, directory }
 */
function parseStandaloneConfig(config: any): ParsedExportConfig {
  if (!config.table?.file) throw new Error('Standalone export YAML has no table.file')

  // In standalone format, each plot in `plots` is a card definition keyed by name
  const cards: Record<string, Record<string, any>> = {}
  for (const [name, plotDef] of Object.entries(config.plots as Record<string, any>)) {
    cards[name] = { ...plotDef, name }
  }

  const exportSection: ExportSection = {
    defaults: config.defaults,
    plots: config.plots,
    states: config.states,
    output: config.output,
  }
  validateCardReferences(cards, exportSection)

  return {
    table: config.table,
    cards,
    exportSection,
    outputNaming: config.output?.naming ?? '{state}-{plot}',
  }
}

/** Flatten layout rows into a name→cardDef map */
function resolveCardsFromLayout(
  layout: Record<string, any[]>
): Record<string, Record<string, any>> {
  const cards: Record<string, Record<string, any>> = {}
  for (const rowCards of Object.values(layout)) {
    if (!Array.isArray(rowCards)) continue
    for (const card of rowCards) {
      if (card && typeof card === 'object' && card.name && card.type) {
        cards[card.name] = card
      }
    }
  }
  return cards
}

/** Validate all card references in export states exist */
function validateCardReferences(
  cards: Record<string, Record<string, any>>,
  exportSection: ExportSection
): void {
  for (const [stateId, state] of Object.entries(exportSection.states)) {
    for (const plotId of state.export) {
      if (!cards[plotId]) {
        throw new Error(
          `Export state "${stateId}" references card "${plotId}" which is not defined in layout. ` +
          `Available cards: ${Object.keys(cards).join(', ')}`
        )
      }
    }
  }
}

/**
 * Resolve the full export plan: one ExportItem per state+plot combination.
 * Applies 3-level override cascade: defaults → per-plot → per-state per-plot.
 */
export function resolveExportPlan(config: ParsedExportConfig): ExportItem[] {
  const plan: ExportItem[] = []
  const globalDefaults = { ...EXPORT_DEFAULTS, ...config.exportSection.defaults }

  for (const [stateId, stateDef] of Object.entries(config.exportSection.states)) {
    for (const plotId of stateDef.export) {
      const cardDef = { ...config.cards[plotId] }
      const plotOverrides = config.exportSection.plots?.[plotId] ?? {}
      const stateOverrides = stateDef.plots?.[plotId] ?? {}

      // Cascade: globalDefaults → plotOverrides → stateOverrides
      const format = (stateOverrides.format ?? plotOverrides.format ?? globalDefaults.format) as 'png' | 'svg'
      const width = stateOverrides.width ?? plotOverrides.width ?? globalDefaults.width
      const height = stateOverrides.height ?? plotOverrides.height ?? globalDefaults.height
      const scale = stateOverrides.scale ?? plotOverrides.scale ?? globalDefaults.scale

      // Style cascade
      const style: ChartStyle = {
        ...PRINT_CHART_STYLE,
        axisTitleFontSize: stateOverrides.axisTitleFontSize ?? plotOverrides.axisTitleFontSize ?? globalDefaults.axisTitleFontSize,
        axisTickFontSize: stateOverrides.axisTickFontSize ?? plotOverrides.axisTickFontSize ?? globalDefaults.axisTickFontSize,
        legendTitleFontSize: stateOverrides.legendTitleFontSize ?? plotOverrides.legendTitleFontSize ?? globalDefaults.legendTitleFontSize,
        legendFontSize: stateOverrides.legendFontSize ?? plotOverrides.legendFontSize ?? globalDefaults.legendFontSize,
        lineWidth: stateOverrides.lineWidth ?? plotOverrides.lineWidth ?? globalDefaults.lineWidth,
        markerSizeMultiplier: stateOverrides.markerSizeMultiplier ?? plotOverrides.markerSizeMultiplier ?? globalDefaults.markerSizeMultiplier,
      }

      // Plot def: card base → plot overrides → state overrides (for title, binSize, etc.)
      const plotDef = { ...cardDef, ...plotOverrides, ...stateOverrides }
      // Remove export-only keys from plotDef
      delete plotDef.format
      delete plotDef.width
      delete plotDef.height
      delete plotDef.scale

      const filename = config.outputNaming
        .replace('{state}', stateId)
        .replace('{plot}', plotId)

      plan.push({
        plotId,
        stateId,
        filename,
        format,
        width,
        height,
        scale,
        style,
        plotDef,
        filters: stateDef.filters ?? {},
        comparison: stateDef.comparison ?? false,
      })
    }
  }

  return plan
}
