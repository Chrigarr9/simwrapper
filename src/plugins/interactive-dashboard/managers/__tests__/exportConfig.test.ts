import { describe, it, expect } from 'vitest'
import { resolveExportPlan } from '../../export/ExportEngine'
import type { ExportConfig } from '../../types/exportConfig'

describe('Export Config Resolution', () => {
  const minimalConfig: ExportConfig = {
    table: { file: 'data.csv' },
    plots: {
      'hist-dist': { type: 'histogram', column: 'distance', bins: 20 },
    },
    states: {
      all: { export: ['hist-dist'] },
    },
  }

  it('should apply global defaults when no overrides', () => {
    const plan = resolveExportPlan(minimalConfig)
    expect(plan).toHaveLength(1)
    expect(plan[0].width).toBe(1200)
    expect(plan[0].height).toBe(800)
    expect(plan[0].scale).toBe(2)
    expect(plan[0].format).toBe('png')
    expect(plan[0].scientific).toBe(true)
  })

  it('should cascade defaults → state → plot overrides', () => {
    const config: ExportConfig = {
      table: { file: 'data.csv' },
      defaults: { width: 1000, format: 'svg' },
      plots: {
        hist: { type: 'histogram', column: 'distance', width: 800 },
      },
      states: {
        filtered: {
          format: 'png', // State overrides defaults
          export: ['hist'],
        },
      },
    }
    const plan = resolveExportPlan(config)
    expect(plan[0].width).toBe(800) // Plot-level wins
    expect(plan[0].format).toBe('png') // State-level wins over defaults
  })

  it('should generate correct filenames from state-plot pattern', () => {
    const plan = resolveExportPlan(minimalConfig)
    expect(plan[0].filename).toBe('all-hist-dist')
    expect(plan[0].stateId).toBe('all')
    expect(plan[0].plotId).toBe('hist-dist')
  })

  it('should resolve filters from state', () => {
    const config: ExportConfig = {
      table: { file: 'data.csv' },
      plots: { hist: { type: 'histogram', column: 'distance' } },
      states: {
        long: {
          filters: { distance: { min: 5000 } },
          export: ['hist'],
        },
      },
    }
    const plan = resolveExportPlan(config)
    expect(plan[0].filters).toEqual({ distance: { min: 5000 } })
  })

  it('should throw on missing plot reference', () => {
    const config: ExportConfig = {
      table: { file: 'data.csv' },
      plots: {},
      states: {
        all: { export: ['nonexistent'] },
      },
    }
    expect(() => resolveExportPlan(config)).toThrow(/nonexistent/)
  })
})
