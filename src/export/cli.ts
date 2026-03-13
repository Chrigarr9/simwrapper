import { resolve, dirname, basename } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import YAML from 'yaml'
import Papa from 'papaparse'

import { parseExportConfig, resolveExportPlan } from './configParser'
import { CHART_BUILDERS, MAP_BUILDER, isMapType } from './trace-builders'
import { renderChart } from './renderers/chartRenderer'
import { renderMap } from './renderers/mapRenderer'
import { FilterManager } from '../plugins/interactive-dashboard/managers/FilterManager'
import type { ExportResult } from './types'

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: simwrapper export <config.yaml> [--output <dir>] [--states <s1,s2>] [--format png|svg] [--scale N]')
    process.exit(0)
  }

  // Parse CLI args
  const configPath = resolve(args[0])
  if (!existsSync(configPath)) {
    console.error(`Error: Config file not found: ${configPath}`)
    process.exit(1)
  }

  let outputDir = resolve(dirname(configPath), 'export')
  let statesFilter: string[] | null = null
  let formatOverride: 'png' | 'svg' | null = null
  let scaleOverride: number | null = null

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) { outputDir = resolve(args[++i]); continue }
    if (args[i] === '--states' && args[i + 1]) { statesFilter = args[++i].split(','); continue }
    if (args[i] === '--format' && args[i + 1]) { formatOverride = args[++i] as any; continue }
    if (args[i] === '--scale' && args[i + 1]) { scaleOverride = Number(args[++i]); continue }
  }

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

  // Parse config
  const yamlText = readFileSync(configPath, 'utf-8')
  const parsed = YAML.parse(yamlText)

  let dashboardYaml: string | undefined
  if (parsed.dashboard) {
    const dashboardPath = resolve(dirname(configPath), parsed.dashboard)
    if (!existsSync(dashboardPath)) {
      console.error(`Error: Referenced dashboard not found: ${dashboardPath}`)
      process.exit(1)
    }
    dashboardYaml = readFileSync(dashboardPath, 'utf-8')
  }

  const config = parseExportConfig(yamlText, dashboardYaml)
  let plan = resolveExportPlan(config)

  // Apply CLI overrides
  if (statesFilter) plan = plan.filter(p => statesFilter!.includes(p.stateId))
  if (formatOverride) plan.forEach(p => { p.format = formatOverride! })
  if (scaleOverride) plan.forEach(p => { p.scale = scaleOverride! })

  console.log(`simwrapper export`)
  console.log(`Config: ${basename(configPath)} (${plan.length} exports)`)
  console.log(`Output: ${outputDir}\n`)

  // Load CSV data
  const csvPath = resolve(dirname(configPath), config.table.file)
  const csvText = readFileSync(csvPath, 'utf-8')
  const allData: any[] = Papa.parse(csvText, { header: true, dynamicTyping: true, skipEmptyLines: true }).data as any[]

  // Build filter manager
  const filterManager = new FilterManager()
  filterManager.buildIndex(allData)

  // Group by state
  const stateGroups = new Map<string, typeof plan>()
  for (const item of plan) {
    const group = stateGroups.get(item.stateId) || []
    group.push(item)
    stateGroups.set(item.stateId, group)
  }

  // Process each state
  const results: ExportResult[] = []
  let completed = 0
  const startTime = Date.now()

  for (const [stateId, items] of stateGroups) {
    // Apply filters for this state
    filterManager.clearAllFilters()
    const filters = items[0].filters
    for (const [column, filterDef] of Object.entries(filters)) {
      if (typeof filterDef === 'string' || typeof filterDef === 'number') {
        filterManager.setFilter(`export-${column}`, column, new Set([filterDef]), 'categorical')
      } else if (Array.isArray(filterDef)) {
        filterManager.setFilter(`export-${column}`, column, new Set(filterDef), 'categorical')
      } else if (typeof filterDef === 'object' && filterDef !== null) {
        const { min, max } = filterDef as { min?: number; max?: number }
        const matching = new Set(allData.filter(r => {
          const v = r[column]; if (v == null) return false
          if (min !== undefined && v < min) return false
          if (max !== undefined && v > max) return false
          return true
        }).map(r => r[column]))
        if (matching.size > 0) filterManager.setFilter(`export-${column}`, column, matching, 'range')
      }
    }

    const idColumn = config.table.idColumn || 'id'
    const filteredData = filterManager.hasActiveFilters()
      ? filterManager.getFilteredData(allData, idColumn)
      : allData

    // Render each plot
    for (const item of items) {
      const itemStart = Date.now()
      completed++

      try {
        let result: ExportResult

        if (isMapType(item.plotDef.type)) {
          const mapLayers = await loadMapLayers(item.plotDef, dirname(configPath))
          const mapConfig = MAP_BUILDER(
            { ...item.plotDef, layers: mapLayers },
            item.style as any
          )
          result = await renderMap(
            { ...mapConfig, width: item.width, height: item.height, scale: item.scale },
            item.filename
          )
        } else {
          const builder = CHART_BUILDERS[item.plotDef.type]
          if (!builder) throw new Error(`No trace builder for type: ${item.plotDef.type}`)

          const figure = builder(
            { ...item.plotDef, filteredData, baselineData: allData, showComparison: item.comparison },
            item.style
          )
          result = await renderChart(figure, item.filename, item.format, item.width, item.height, item.scale)
        }

        // Write output
        const ext = result.format
        const outPath = resolve(outputDir, `${result.filename}.${ext}`)
        writeFileSync(outPath, result.data)

        const elapsed = ((Date.now() - itemStart) / 1000).toFixed(1)
        const pad = `[${completed}/${plan.length}]`.padEnd(8)
        console.log(`${pad} ${stateId}/${item.plotId} ${'·'.repeat(30)} ${ext} ${item.width}x${item.height}  ${elapsed}s`)

        results.push(result)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[${completed}/${plan.length}] ${stateId}/${item.plotId} FAILED: ${msg}`)
      }
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nDone! ${results.length} files written to ${outputDir} (${totalTime}s)`)
}

async function loadMapLayers(plotDef: any, baseDir: string): Promise<any[]> {
  const layers = []
  for (const layerDef of (plotDef.layers || [])) {
    const geojsonPath = resolve(baseDir, layerDef.file)
    if (existsSync(geojsonPath)) {
      const geojson = JSON.parse(readFileSync(geojsonPath, 'utf-8'))
      layers.push({ ...layerDef, geojsonData: geojson })
    } else {
      console.warn(`Warning: GeoJSON file not found: ${geojsonPath}`)
    }
  }
  return layers
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
