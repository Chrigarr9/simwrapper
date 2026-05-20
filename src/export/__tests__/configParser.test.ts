import { describe, it, expect } from 'vitest'
import { parseExportConfig, resolveExportPlan } from '../configParser'

const DASHBOARD_YAML = `
table:
  file: trips.csv
  idColumn: trip_id
layout:
  row1:
    - type: histogram
      name: dist-hist
      column: distance
      binSize: 5000
      title: Distance
    - type: pie-chart
      name: mode-pie
      column: mode
export:
  defaults:
    format: png
    width: 1000
    axisTitleFontSize: 16
  plots:
    dist-hist:
      width: 800
      height: 500
  states:
    all:
      export: [dist-hist, mode-pie]
    car-only:
      filters:
        mode: car
      export: [dist-hist]
      plots:
        dist-hist:
          title: Car Distance
  output:
    naming: "{state}-{plot}"
`

describe('parseExportConfig', () => {
  it('parses inline export section', () => {
    const config = parseExportConfig(DASHBOARD_YAML)
    expect(config.table.file).toBe('trips.csv')
    expect(config.cards).toHaveProperty('dist-hist')
    expect(config.cards['dist-hist'].type).toBe('histogram')
    expect(config.exportSection.states).toHaveProperty('all')
  })

  it('resolves cards from layout by name', () => {
    const config = parseExportConfig(DASHBOARD_YAML)
    expect(config.cards['dist-hist'].column).toBe('distance')
    expect(config.cards['mode-pie'].column).toBe('mode')
  })

  it('errors on unknown card reference', () => {
    const yaml = DASHBOARD_YAML.replace('dist-hist, mode-pie', 'dist-hist, nonexistent')
    expect(() => parseExportConfig(yaml)).toThrow(/nonexistent/)
  })

  it('handles missing optional fields with defaults', () => {
    const minimalYaml = `
table:
  file: data.csv
layout:
  row1:
    - type: histogram
      name: h1
      column: x
export:
  states:
    default:
      export: [h1]
`
    const config = parseExportConfig(minimalYaml)
    expect(config.outputNaming).toBe('{state}-{plot}')
  })

  it('errors when no export section', () => {
    const yaml = `
table:
  file: data.csv
layout:
  row1: []
`
    expect(() => parseExportConfig(yaml)).toThrow(/export/)
  })

  it('parses linked export YAML with dashboard reference', () => {
    const exportYaml = `
dashboard: dashboard.yaml
defaults:
  format: svg
states:
  all:
    export: [dist-hist]
`
    const dashboardYaml = `
table:
  file: trips.csv
layout:
  row1:
    - type: histogram
      name: dist-hist
      column: distance
`
    const config = parseExportConfig(exportYaml, dashboardYaml)
    expect(config.table.file).toBe('trips.csv')
    expect(config.cards['dist-hist'].type).toBe('histogram')
    expect(config.exportSection.defaults?.format).toBe('svg')
  })

  it('normalizes inline table.dataset to table.file', () => {
    const yaml = `
table:
  dataset: trips.csv
  idColumn: trip_id
layout:
  row1:
    - type: histogram
      name: h1
      column: distance
export:
  states:
    default:
      export: [h1]
`
    const config = parseExportConfig(yaml)
    expect(config.table.file).toBe('trips.csv')
    expect((config.table as any).dataset).toBe('trips.csv')
  })

  it('normalizes linked dashboard table.dataset to table.file', () => {
    const exportYaml = `
dashboard: dashboard.yaml
states:
  all:
    export: [h1]
`
    const dashboardYaml = `
table:
  dataset: trips.csv
layout:
  row1:
    - type: histogram
      name: h1
      column: distance
`
    const config = parseExportConfig(exportYaml, dashboardYaml)
    expect(config.table.file).toBe('trips.csv')
  })

  it('preserves table column formats for export label resolution', () => {
    const yaml = `
table:
  dataset: data.csv
  columns:
    formats:
      served_requests:
        label: Daily commutes replaced
layout:
  row1:
    - type: scatter-plot
      name: s1
      xColumn: fleet
      yColumn: served_requests
export:
  states:
    default:
      export: [s1]
`
    const config = parseExportConfig(yaml)
    expect(config.table.columns.formats.served_requests.label).toBe('Daily commutes replaced')
  })
})

describe('resolveExportPlan', () => {
  it('applies 3-level override cascade', () => {
    const config = parseExportConfig(DASHBOARD_YAML)
    const plan = resolveExportPlan(config)

    // all/dist-hist: defaults.width=1000, plots.dist-hist.width=800 → 800 wins
    const allDistHist = plan.find(p => p.stateId === 'all' && p.plotId === 'dist-hist')!
    expect(allDistHist.width).toBe(800)
    expect(allDistHist.height).toBe(500)
    expect(allDistHist.style.axisTitleFontSize).toBe(16)

    // car-only/dist-hist: state-level title override
    const carDistHist = plan.find(p => p.stateId === 'car-only' && p.plotId === 'dist-hist')!
    expect(carDistHist.plotDef.title).toBe('Car Distance')
  })

  it('generates correct filenames', () => {
    const config = parseExportConfig(DASHBOARD_YAML)
    const plan = resolveExportPlan(config)
    const filenames = plan.map(p => p.filename)
    expect(filenames).toContain('all-dist-hist')
    expect(filenames).toContain('car-only-dist-hist')
  })

  it('sets comparison flag from state config', () => {
    const yaml = `
table:
  file: data.csv
layout:
  row1:
    - type: histogram
      name: h1
      column: x
export:
  states:
    compared:
      export: [h1]
      comparison: true
`
    const config = parseExportConfig(yaml)
    const plan = resolveExportPlan(config)
    expect(plan[0].comparison).toBe(true)
  })

  it('uses default dimensions when no overrides', () => {
    const yaml = `
table:
  file: data.csv
layout:
  row1:
    - type: histogram
      name: h1
      column: x
export:
  states:
    default:
      export: [h1]
`
    const config = parseExportConfig(yaml)
    const plan = resolveExportPlan(config)
    expect(plan[0].width).toBe(600)  // EXPORT_DEFAULTS.width — matches dashboard card scale
    expect(plan[0].height).toBe(400) // EXPORT_DEFAULTS.height
    expect(plan[0].scale).toBe(2)    // EXPORT_DEFAULTS.scale
  })

  it('auto-scales built-in style defaults by resolved export width', () => {
    const yaml = `
table:
  file: data.csv
layout:
  row1:
    - type: scatter-plot
      name: s1
      xColumn: x
      yColumn: y
export:
  defaults:
    width: 1400
  states:
    default:
      export: [s1]
`
    const plan = resolveExportPlan(parseExportConfig(yaml))
    // At width=1400 with baselines axisTitle=14 / axisTick=12 / marker=1.1,
    // factor=2.333: axisTitle 14*2.333≈32.7, axisTick 12*2.333=28, marker 1.1*2.333≈2.6.
    expect(plan[0].style.axisTitleFontSize).toBe(32.7)
    expect(plan[0].style.axisTickFontSize).toBe(28)
    expect(plan[0].style.markerSizeMultiplier).toBe(2.6)
    // marginScale tracks the same factor so builders can inflate margins
    expect(plan[0].style.marginScale).toBe(2.3)
  })

  it('lets explicit default and state style overrides win over auto-scaling', () => {
    const yaml = `
table:
  file: data.csv
layout:
  row1:
    - type: scatter-plot
      name: s1
      xColumn: x
      yColumn: y
export:
  defaults:
    width: 1400
    axisTitleFontSize: 18
  states:
    default:
      export: [s1]
      plots:
        s1:
          axisTickFontSize: 11
`
    const plan = resolveExportPlan(parseExportConfig(yaml))
    expect(plan[0].style.axisTitleFontSize).toBe(18)
    expect(plan[0].style.axisTickFontSize).toBe(11)
  })

  it('resolves scatter axis titles from table column formats when explicit titles are absent', () => {
    const yaml = `
table:
  dataset: data.csv
  columns:
    formats:
      fleet:
        label: Fleet size
        unit: vehicles
      served_requests:
        label: Daily commutes replaced
layout:
  row1:
    - type: scatter-plot
      name: s1
      xColumn: fleet
      yColumn: served_requests
export:
  states:
    default:
      export: [s1]
`
    const plan = resolveExportPlan(parseExportConfig(yaml))
    expect(plan[0].plotDef.xAxisTitle).toBe('Fleet size (vehicles)')
    expect(plan[0].plotDef.yAxisTitle).toBe('Daily commutes replaced')
  })

  it('does not override explicit axis titles with table column formats', () => {
    const yaml = `
table:
  file: data.csv
  columns:
    formats:
      fleet:
        label: Fleet size
layout:
  row1:
    - type: scatter-plot
      name: s1
      xColumn: fleet
      yColumn: served_requests
      xAxisTitle: Explicit fleet title
export:
  states:
    default:
      export: [s1]
`
    const plan = resolveExportPlan(parseExportConfig(yaml))
    expect(plan[0].plotDef.xAxisTitle).toBe('Explicit fleet title')
  })
})
