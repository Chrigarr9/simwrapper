import { describe, it, expect } from 'vitest'
import { buildBarFigure } from '../bar'
import { PRINT_CHART_STYLE } from '../../defaults'
import type { BarInput } from '../../types'

const baseStyle = { ...PRINT_CHART_STYLE, isScientific: false }
const scientificStyle = { ...PRINT_CHART_STYLE }

describe('buildBarFigure — simple', () => {
  it('produces one trace for one numeric column over categorical x', () => {
    const input: BarInput = {
      type: 'bar',
      title: 'Test',
      xColumn: 'scheme',
      yColumns: ['service_rate'],
      filteredData: [
        { scheme: 'equal', service_rate: 0.8 },
        { scheme: 'coalition', service_rate: 0.85 },
        { scheme: 'solidarity', service_rate: 0.78 },
      ],
    }
    const fig = buildBarFigure(input, baseStyle)
    expect(fig.traces).toHaveLength(1)
    expect(fig.traces[0].type).toBe('bar')
    expect(fig.traces[0].x).toEqual(['equal', 'coalition', 'solidarity'])
    expect(fig.traces[0].y).toEqual([0.8, 0.85, 0.78])
  })
})

describe('buildBarFigure — grouped', () => {
  it('produces N traces for N yColumns, side by side', () => {
    const input: BarInput = {
      type: 'bar',
      title: 'KPIs',
      xColumn: 'scheme',
      yColumns: ['service_rate', 'mean_detour_factor'],
      barmode: 'group',
      filteredData: [
        { scheme: 'equal', service_rate: 0.8, mean_detour_factor: 1.2 },
        { scheme: 'coalition', service_rate: 0.85, mean_detour_factor: 1.25 },
      ],
    }
    const fig = buildBarFigure(input, baseStyle)
    expect(fig.traces).toHaveLength(2)
    expect(fig.layout.barmode).toBe('group')
  })
})

describe('buildBarFigure — stacked', () => {
  it('sets barmode=stack when requested', () => {
    const input: BarInput = {
      type: 'bar',
      title: 'Stacked',
      xColumn: 'fleet',
      yColumns: ['fare', 'subsidy'],
      barmode: 'stack',
      filteredData: [
        { fleet: 100, fare: 30, subsidy: 80 },
        { fleet: 300, fare: 50, subsidy: 110 },
      ],
    }
    const fig = buildBarFigure(input, baseStyle)
    expect(fig.layout.barmode).toBe('stack')
    expect(fig.traces).toHaveLength(2)
  })
})

describe('buildBarFigure — scientific mode', () => {
  it('applies pattern fills when multiple traces and isScientific=true', () => {
    const input: BarInput = {
      type: 'bar',
      xColumn: 'scheme',
      yColumns: ['service_rate', 'mean_detour_factor'],
      filteredData: [
        { scheme: 'equal', service_rate: 0.8, mean_detour_factor: 1.2 },
      ],
    }
    const fig = buildBarFigure(input, scientificStyle)
    const patterns = fig.traces.map((t: any) => t.marker?.pattern?.shape)
    expect(patterns.filter((p: any) => p && p.length > 0)).toHaveLength(2)
  })

  it('uses black axis lines + barColor for single trace in scientific mode', () => {
    const input: BarInput = {
      type: 'bar',
      xColumn: 'scheme',
      yColumns: ['service_rate'],
      filteredData: [{ scheme: 'equal', service_rate: 0.8 }],
    }
    const fig = buildBarFigure(input, scientificStyle)
    expect(fig.traces[0].marker.color).toBe(scientificStyle.barColor)
    expect(fig.layout.xaxis.linecolor).toBe(scientificStyle.textColor)
    // Guard: single trace must NOT receive a pattern (isMulti=false)
    expect(fig.traces[0].marker.pattern).toBeUndefined()
  })
})

describe('buildBarFigure — colorByColumn (categorical)', () => {
  it('splits one yColumn into one trace per category value', () => {
    const input: BarInput = {
      type: 'bar',
      xColumn: 'fleet',
      yColumns: ['served_requests'],
      colorByColumn: 'pricing_scheme',
      filteredData: [
        { fleet: 100, pricing_scheme: 'equal', served_requests: 1000 },
        { fleet: 100, pricing_scheme: 'coalition', served_requests: 1100 },
        { fleet: 300, pricing_scheme: 'equal', served_requests: 3200 },
        { fleet: 300, pricing_scheme: 'coalition', served_requests: 3500 },
      ],
    }
    const fig = buildBarFigure(input, baseStyle)
    expect(fig.traces).toHaveLength(2)
    expect(fig.traces.map((t: any) => t.name).sort()).toEqual(['coalition', 'equal'])
    // Verify y-values aligned to correct x per category (the lookup-map plumbing)
    const equalTrace = fig.traces.find((t: any) => t.name === 'equal')
    expect(equalTrace.x).toEqual([100, 300])
    expect(equalTrace.y).toEqual([1000, 3200])
    const coalitionTrace = fig.traces.find((t: any) => t.name === 'coalition')
    expect(coalitionTrace.y).toEqual([1100, 3500])
  })
})

// ── Degenerate-axis guard (resvg panic prevention) ──────────────────────────

describe('buildBarFigure — degenerate axis guard', () => {
  it('forces autorange=false and non-degenerate yaxis range when all y values are identical', () => {
    // Simulates a slice where total_subsidy is all-zero: Plotly would autorange
    // to [0,0] producing zero-height geometry that crashes resvg (geom.rs:27).
    const input: BarInput = {
      type: 'bar',
      xColumn: 'scheme',
      yColumns: ['total_subsidy'],
      filteredData: [
        { scheme: 'equal', total_subsidy: 0 },
        { scheme: 'coalition', total_subsidy: 0 },
        { scheme: 'solidarity', total_subsidy: 0 },
      ],
    }
    const fig = buildBarFigure(input, baseStyle)
    expect(fig.layout.yaxis.autorange).toBe(false)
    const [lo, hi] = fig.layout.yaxis.range as [number, number]
    expect(hi).toBeGreaterThan(lo)
  })

  it('does not set autorange=false when y values vary normally', () => {
    const input: BarInput = {
      type: 'bar',
      xColumn: 'scheme',
      yColumns: ['service_rate'],
      filteredData: [
        { scheme: 'equal', service_rate: 0.8 },
        { scheme: 'coalition', service_rate: 0.85 },
      ],
    }
    const fig = buildBarFigure(input, baseStyle)
    expect(fig.layout.yaxis.autorange).toBeUndefined()
    expect(fig.layout.yaxis.range).toBeUndefined()
  })
})
