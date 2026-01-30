/**
 * Label formatting utilities for converting column names to display labels.
 *
 * Handles common patterns in data column names:
 * - snake_case: "main_mode" -> "Main Mode"
 * - camelCase: "tripDistance" -> "Trip Distance"
 * - Abbreviations: "trip_id" -> "Trip ID", "vkt_km" -> "VKT KM"
 */

/**
 * Common abbreviations that should be displayed in uppercase.
 * These are domain-specific terms from transportation/simulation data.
 */
const ABBREVIATIONS = new Set([
  'id',   // Identifier
  'od',   // Origin-Destination
  'pt',   // Public Transport
  'drt',  // Demand Responsive Transport
  'km',   // Kilometers
  'vkt',  // Vehicle Kilometers Traveled
  'pkm',  // Person Kilometers
  'pmt',  // Person Miles Traveled
  'vmt',  // Vehicle Miles Traveled
  // Note: 'avg', 'min', 'max', 'std' are NOT included - they look better as "Avg", "Min", "Max", "Std"
  'num',  // Number
  'cnt',  // Count
])

/**
 * Convert snake_case or camelCase string to Title Case with proper abbreviation handling.
 *
 * Examples:
 * - "main_mode" -> "Main Mode"
 * - "trip_id" -> "Trip ID"
 * - "tripDistance" -> "Trip Distance"
 * - "vkt_per_capita" -> "VKT Per Capita"
 * - "od_pairs" -> "OD Pairs"
 *
 * @param str - The string to convert
 * @returns The title-cased string
 */
export function toTitleCase(str: string): string {
  if (!str) return ''

  // Split by underscores first (snake_case)
  const snakeParts = str.split('_')

  // Then split each part by camelCase boundaries
  const allParts = snakeParts.flatMap(part =>
    // Split on camelCase boundaries: "tripDistance" -> ["trip", "Distance"]
    part.split(/(?=[A-Z])/)
  )

  // Filter out empty strings and process each word
  return allParts
    .filter(word => word.trim())
    .map(word => {
      const lower = word.toLowerCase()

      // Check if it's a known abbreviation
      if (ABBREVIATIONS.has(lower)) {
        return lower.toUpperCase()
      }

      // Otherwise, capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

/**
 * Strip empty or placeholder unit brackets from a label.
 *
 * Useful for categorical attributes where the label may have "[-]"
 * indicating no unit, which looks odd when displayed.
 *
 * Examples:
 * - "Transport Mode [-]" -> "Transport Mode"
 * - "Distance [km]" -> "Distance [km]" (unchanged - has actual unit)
 * - "Budget [€]" -> "Budget [€]" (unchanged - has actual unit)
 *
 * @param label - The label to clean
 * @returns The label with empty unit brackets removed
 */
export function stripEmptyUnitBrackets(label: string): string {
  if (!label) return ''
  // Remove " [-]" at the end of the string (empty unit placeholder)
  return label.replace(/\s*\[-\]\s*$/, '').trim()
}
