/**
 * Color schemes for request visualization
 */

// Default mode colors (extend as needed)
export const MODE_COLORS: { [mode: string]: string } = {
  car: '#e74c3c',
  pt: '#3498db',
  bike: '#2ecc71',
  walk: '#f39c12',
  drt: '#9b59b6',
  ride: '#1abc9c',
  default: '#95a5a6',
}

/**
 * Get color for a mode (with fallback to default)
 */
export function getModeColor(mode: string): string {
  return MODE_COLORS[mode?.toLowerCase()] || MODE_COLORS.default
}

/**
 * Alias for getModeColor (for consistency)
 */
export function getModeColorHex(mode: string): string {
  return getModeColor(mode)
}

/**
 * Get color as RGB array for Deck.gl [R, G, B, A]
 */
export function getModeColorRGB(mode: string, alpha: number = 255): [number, number, number, number] {
  const hex = getModeColor(mode)
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b, alpha]
}

/**
 * Generate color palette for all modes in dataset
 */
export function generateModePalette(modes: string[]): { [mode: string]: string } {
  const palette: { [mode: string]: string } = {}

  modes.forEach((mode) => {
    palette[mode] = getModeColor(mode)
  })

  return palette
}

/**
 * Activity type colors
 */
export const ACTIVITY_COLORS: { [activity: string]: string } = {
  home: '#4477ff',
  work: '#ff4477',
  education: '#44ff77',
  shopping: '#ff7744',
  leisure: '#aa44ff',
  other: '#777777',
}

/**
 * Get color for an activity type
 */
export function getActivityColor(activity: string): string {
  return ACTIVITY_COLORS[activity?.toLowerCase()] || '#999999'
}

/**
 * Get activity color as RGB array for Deck.gl [R, G, B, A]
 */
export function getActivityColorRGB(activity: string, alpha: number = 255): [number, number, number, number] {
  const hex = getActivityColor(activity)
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b, alpha]
}

/**
 * Generic hex to RGB conversion
 */
export function hexToRgb(hex: string, alpha: number = 255): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b, alpha]
}
