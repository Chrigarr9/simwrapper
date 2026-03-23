import { formatLabel, stripEmptyUnitBrackets } from './labelFormatter'

export interface DashboardColumnFormat {
  type?: string
  convertFrom?: string
  unit?: string
  decimals?: number
  titleCase?: boolean
}

export function sortLegendCategories<T>(values: T[]): T[] {
  const sorted = [...values]
  const numericValues = sorted.map(Number)
  const isNumericSeries = sorted.length > 0 && numericValues.every(v => Number.isFinite(v))

  if (isNumericSeries) {
    sorted.sort((a, b) => Number(a) - Number(b))
  } else {
    sorted.sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }))
  }

  return sorted
}

export function formatChartTitle(
  column: string,
  formats?: Record<string, DashboardColumnFormat>,
  options?: { stripEmptyUnits?: boolean; labelOverride?: string }
): string {
  const baseLabel = options?.labelOverride || formatLabel(column, formats as Record<string, { titleCase?: boolean }> | undefined, column)

  const format = formats?.[column]
  if (!format?.type) {
    return options?.stripEmptyUnits ? stripEmptyUnitBrackets(baseLabel) : baseLabel
  }

  let title = baseLabel
  switch (format.type) {
    case 'time':
      title = `${baseLabel} [hh:mm]`
      break
    case 'duration':
      if (format.unit === 'min') title = `${baseLabel} [min]`
      else if (format.unit === 's') title = `${baseLabel} [s]`
      break
    case 'distance':
      if (format.unit === 'km') title = `${baseLabel} [km]`
      else if (format.unit === 'm') title = `${baseLabel} [m]`
      break
    case 'percent':
      title = `${baseLabel} [%]`
      break
    case 'decimal':
    case 'integer':
      if (format.unit) title = `${baseLabel} [${format.unit}]`
      break
  }

  return options?.stripEmptyUnits ? stripEmptyUnitBrackets(title) : title
}
