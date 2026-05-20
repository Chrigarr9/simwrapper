import { describe, it, expect } from 'vitest'
import { resolveAxisTitle } from '../labels'

describe('resolveAxisTitle', () => {
  it('uses explicit axis title first', () => {
    expect(resolveAxisTitle({
      explicitTitle: 'Fleet size (vehicles)',
      column: 'constraint__fleet_size',
    })).toBe('Fleet size (vehicles)')
  })

  it('uses table format label and unit when explicit title is absent', () => {
    expect(resolveAxisTitle({
      column: 'fare',
      tableFormats: {
        fare: { label: 'Mean fare', unit: 'EUR / ride' },
      },
    })).toBe('Mean fare (EUR / ride)')
  })

  it('uses table format label without empty unit', () => {
    expect(resolveAxisTitle({
      column: 'served_requests',
      tableFormats: {
        served_requests: { label: 'Daily commutes replaced', unit: '[-]' },
      },
    })).toBe('Daily commutes replaced')
  })

  it('falls back to raw column name', () => {
    expect(resolveAxisTitle({ column: 'service_rate' })).toBe('service_rate')
  })
})
