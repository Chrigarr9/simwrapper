interface ColumnFormat {
  label?: string
  unit?: string
}

export function resolveAxisTitle(args: {
  explicitTitle?: string
  column: string
  tableFormats?: Record<string, ColumnFormat>
}): string {
  const explicit = args.explicitTitle?.trim()
  if (explicit) return explicit

  const format = args.tableFormats?.[args.column]
  const label = format?.label?.trim()
  const unit = format?.unit?.trim()

  if (label && unit && unit !== '[-]') return `${label} (${unit})`
  if (label) return label
  return args.column
}
