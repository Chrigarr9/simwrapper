/**
 * Color schemes for interactive dashboard visualizations
 * Adapted from commuter-requests plugin for generic use
 */

// Transport mode colors
export const MODE_COLORS: { [mode: string]: string } = {
  car: '#e74c3c',
  pt: '#3498db',
  bike: '#2ecc71',
  walk: '#f39c12',
  drt: '#9b59b6',
  ride: '#1abc9c',
  transit: '#3498db',
  auto: '#e74c3c',
  bicycle: '#2ecc71',
  pedestrian: '#f39c12',
  default: '#95a5a6',
}

// Activity type colors
export const ACTIVITY_COLORS: { [activity: string]: string } = {
  home: '#4477ff',
  work: '#ff4477',
  education: '#44ff77',
  shopping: '#ff7744',
  leisure: '#aa44ff',
  other: '#777777',
}

// Generic categorical color palette (for arbitrary categories)
export const CATEGORICAL_COLORS = [
  '#3498db', // Blue
  '#e74c3c', // Red
  '#2ecc71', // Green
  '#f39c12', // Orange
  '#9b59b6', // Purple
  '#1abc9c', // Teal
  '#e67e22', // Dark Orange
  '#34495e', // Dark Gray Blue
  '#16a085', // Sea Green
  '#c0392b', // Dark Red
  '#2980b9', // Dark Blue
  '#8e44ad', // Dark Purple
  '#27ae60', // Dark Green
  '#d35400', // Rust
  '#7f8c8d', // Gray
]

/**
 * Get color for a transport mode
 */
export function getModeColor(mode: string): string {
  const normalizedMode = mode?.toLowerCase()?.trim() || ''
  return MODE_COLORS[normalizedMode] || MODE_COLORS.default
}

/**
 * Get RGB array for deck.gl [R, G, B, A]
 */
export function getModeColorRGB(mode: string, alpha: number = 255): [number, number, number, number] {
  const hex = getModeColor(mode)
  return hexToRgba(hex, alpha)
}

/**
 * Get color for an activity type
 */
export function getActivityColor(activity: string): string {
  const normalizedActivity = activity?.toLowerCase()?.trim() || ''
  return ACTIVITY_COLORS[normalizedActivity] || ACTIVITY_COLORS.other
}

/**
 * Get color for any categorical value with consistent hashing
 * Uses a color from the palette based on the value
 */
export function getCategoryColor(value: any, index?: number): string {
  // First check if it's a known mode
  const modeColor = MODE_COLORS[String(value).toLowerCase()]
  if (modeColor && modeColor !== MODE_COLORS.default) {
    return modeColor
  }

  // Then check if it's a known activity
  const activityColor = ACTIVITY_COLORS[String(value).toLowerCase()]
  if (activityColor && activityColor !== ACTIVITY_COLORS.other) {
    return activityColor
  }

  // If index provided, use it directly
  if (index !== undefined) {
    return CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length]
  }

  // Otherwise use hash-based color assignment
  const hash = String(value)
    .split('')
    .reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0)
  return CATEGORICAL_COLORS[Math.abs(hash) % CATEGORICAL_COLORS.length]
}

/**
 * Generate a color from a hash (for cluster IDs etc.)
 */
export function getHashColor(value: any): string {
  if (value === undefined || value === null) {
    return '#808080'
  }

  const hash = String(value)
    .split('')
    .reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0)

  const hue = Math.abs(hash % 360)
  return hslToHex(hue, 70, 50)
}

/**
 * Convert hex color to RGBA array for deck.gl
 */
export function hexToRgba(hex: string, alpha: number = 255): [number, number, number, number] {
  const cleanHex = hex.replace('#', '')
  const r = parseInt(cleanHex.slice(0, 2), 16)
  const g = parseInt(cleanHex.slice(2, 4), 16)
  const b = parseInt(cleanHex.slice(4, 6), 16)
  return [r, g, b, alpha]
}

/**
 * Convert HSL to hex color
 */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * Build a color map for an array of unique values
 * Returns a Map for O(1) lookups
 */
export function buildColorMap(values: any[]): Map<string, string> {
  const colorMap = new Map<string, string>()
  const uniqueValues = [...new Set(values.map(v => String(v)))]

  uniqueValues.forEach((value, index) => {
    colorMap.set(value, getCategoryColor(value, index))
  })

  return colorMap
}
