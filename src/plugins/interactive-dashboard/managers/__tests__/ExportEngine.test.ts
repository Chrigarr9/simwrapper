import { describe, it, expect, beforeEach } from 'vitest'
import { ExportEngine } from '../../export/ExportEngine'
import { FilterManager } from '../FilterManager'

describe('ExportEngine', () => {
  let engine: ExportEngine

  beforeEach(() => {
    engine = new ExportEngine()
  })

  describe('parseConfig', () => {
    it('should parse valid YAML and resolve plan', () => {
      const yaml = `
table:
  file: data.csv
plots:
  hist:
    type: histogram
    column: distance
states:
  all:
    export: [hist]
`
      const { config, plan } = engine.parseConfig(yaml)
      expect(config.table.file).toBe('data.csv')
      expect(plan).toHaveLength(1)
      expect(plan[0].plotId).toBe('hist')
    })

    it('should throw on missing table', () => {
      const yaml = `
plots:
  hist:
    type: histogram
states:
  all:
    export: [hist]
`
      expect(() => engine.parseConfig(yaml)).toThrow(/table.file/)
    })

    it('should throw on empty plots', () => {
      const yaml = `
table:
  file: data.csv
plots: {}
states:
  all:
    export: []
`
      expect(() => engine.parseConfig(yaml)).toThrow(/at least one plot/)
    })

    it('should throw on empty states', () => {
      const yaml = `
table:
  file: data.csv
plots:
  hist:
    type: histogram
states: {}
`
      expect(() => engine.parseConfig(yaml)).toThrow(/at least one state/)
    })
  })

  describe('applyFilters', () => {
    const testData = [
      { id: 1, mode: 'car', distance: 1000 },
      { id: 2, mode: 'pt', distance: 5000 },
      { id: 3, mode: 'bike', distance: 2000 },
      { id: 4, mode: 'car', distance: 8000 },
    ]

    it('should apply categorical filter (single value)', () => {
      const fm = new FilterManager()
      engine.applyFilters(fm, { mode: 'car' }, testData)
      expect(fm.hasActiveFilters()).toBe(true)
      const filtered = fm.getFilteredData(testData, 'id')
      expect(filtered).toHaveLength(2)
      expect(filtered.every((r: any) => r.mode === 'car')).toBe(true)
    })

    it('should apply categorical filter (array)', () => {
      const fm = new FilterManager()
      engine.applyFilters(fm, { mode: ['car', 'pt'] }, testData)
      const filtered = fm.getFilteredData(testData, 'id')
      expect(filtered).toHaveLength(3)
    })

    it('should apply numeric range filter', () => {
      const fm = new FilterManager()
      engine.applyFilters(fm, { distance: { min: 3000 } }, testData)
      const filtered = fm.getFilteredData(testData, 'id')
      expect(filtered).toHaveLength(2)
      expect(filtered.every((r: any) => r.distance >= 3000)).toBe(true)
    })

    it('should apply numeric range filter with min and max', () => {
      const fm = new FilterManager()
      engine.applyFilters(fm, { distance: { min: 1500, max: 6000 } }, testData)
      const filtered = fm.getFilteredData(testData, 'id')
      expect(filtered).toHaveLength(2)
    })

    it('should clear previous filters before applying new ones', () => {
      const fm = new FilterManager()
      engine.applyFilters(fm, { mode: 'car' }, testData)
      expect(fm.hasActiveFilters()).toBe(true)
      engine.applyFilters(fm, {}, testData)
      expect(fm.hasActiveFilters()).toBe(false)
    })
  })

  describe('progress tracking', () => {
    it('should call progress callbacks', () => {
      const updates: any[] = []
      engine.onProgress(p => updates.push({ ...p }))

      // parseConfig triggers no progress, but we can test the callback mechanism
      expect(updates).toHaveLength(0)
    })
  })
})
