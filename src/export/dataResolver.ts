export interface ResolveExportItemDataArgs {
  allData: any[]
  idColumn: string
  stateFilters?: Record<string, any>
  cardFixedFilter?: Record<string, any>
  useVisualSample?: boolean
}

export interface ResolvedExportItemData {
  filteredData: any[]
  baselineData: any[]
}

export function resolveExportItemData(args: ResolveExportItemDataArgs): ResolvedExportItemData {
  const {
    allData,
    stateFilters = {},
    cardFixedFilter = {},
    useVisualSample = false,
  } = args

  const baselineData = useVisualSample ? applyVisualSampleFilter(allData) : allData
  let filteredData = applyFilters(allData, stateFilters)
  filteredData = applyFixedFilter(filteredData, cardFixedFilter)
  if (useVisualSample) filteredData = applyVisualSampleFilter(filteredData)

  return { filteredData, baselineData }
}

export function applyFilters(rows: any[], filters: Record<string, any>): any[] {
  return rows.filter(row => {
    for (const [column, filterDef] of Object.entries(filters ?? {})) {
      if (!matchesFilter(row[column], filterDef)) return false
    }
    return true
  })
}

function matchesFilter(value: any, filterDef: any): boolean {
  if (Array.isArray(filterDef)) {
    return filterDef.some(v => valuesMatch(value, v))
  }

  if (filterDef && typeof filterDef === 'object') {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return false
    if (filterDef.min !== undefined && numeric < Number(filterDef.min)) return false
    if (filterDef.max !== undefined && numeric > Number(filterDef.max)) return false
    return true
  }

  return valuesMatch(value, filterDef)
}

function applyFixedFilter(rows: any[], fixedFilter: Record<string, any>): any[] {
  return rows.filter(row => {
    for (const [column, value] of Object.entries(fixedFilter ?? {})) {
      if (String(row[column]) !== String(value)) return false
    }
    return true
  })
}

function applyVisualSampleFilter(rows: any[]): any[] {
  return rows.filter(row => toBool(row?.is_visual_sampled))
}

function toBool(value: any): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'yes'
  }
  return false
}

function valuesMatch(cellValue: any, filterValue: any): boolean {
  if (cellValue === filterValue) return true
  // eslint-disable-next-line eqeqeq
  if (cellValue == filterValue) return true

  const cellStr = String(cellValue)
  const filterStr = String(filterValue)

  const filterPrefix = filterStr.match(/^([a-zA-Z]+_)(\d+)$/)
  if (filterPrefix) {
    // eslint-disable-next-line eqeqeq
    if (cellStr == filterPrefix[2]) return true
  }

  const cellPrefix = cellStr.match(/^([a-zA-Z]+_)(\d+)$/)
  if (cellPrefix) {
    // eslint-disable-next-line eqeqeq
    if (filterStr == cellPrefix[2]) return true
  }

  return false
}
