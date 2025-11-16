// Color scheme utilities for map visualization

import type { Request, ColorByMode } from '../CommuterClusteringConfig'

// RGBA color type
type Color = [number, number, number, number]

// Default color schemes
const DEFAULT_MODE_COLORS: Record<string, Color> = {
  car: [255, 68, 68, 255],      // Red
  pt: [68, 119, 255, 255],       // Blue
  bike: [68, 255, 119, 255],     // Green
  walk: [255, 187, 68, 255],     // Orange
  other: [128, 128, 128, 255],   // Gray
}

const DEFAULT_ACTIVITY_COLORS: Record<string, Color> = {
  home: [68, 119, 255, 255],      // Blue
  work: [255, 68, 119, 255],      // Pink
  education: [68, 255, 119, 255], // Green
  shopping: [255, 119, 68, 255],  // Orange
  leisure: [170, 68, 255, 255],   // Purple
  other: [119, 119, 119, 255],    // Gray
}

/**
 * Get color for a request based on color-by mode
 */
export function getColorByAttribute(
  request: Request,
  colorBy: ColorByMode,
  customColors?: Record<string, string>
): Color {
  switch (colorBy) {
    case 'mode':
      return getModeColor(request.main_mode || request.mode, customColors)
    case 'activity':
      return getActivityColor(request.start_activity_type, customColors)
    case 'price':
      return getGradientColor(request.max_price || 0, 0, 50)  // €0-50 range
    case 'detour':
      return getGradientColor(request.max_detour || 1.0, 1.0, 2.0)  // 1.0-2.0x detour
    default:
      return [128, 128, 128, 255]  // Gray default
  }
}

/**
 * Get color for transport mode
 */
export function getModeColor(
  mode: string,
  customColors?: Record<string, string>
): Color {
  if (customColors && customColors[mode]) {
    return hexToRgba(customColors[mode])
  }

  return DEFAULT_MODE_COLORS[mode] || DEFAULT_MODE_COLORS.other
}

/**
 * Get color for activity type
 */
export function getActivityColor(
  activity: string | undefined,
  customColors?: Record<string, string>
): Color {
  if (!activity) {
    return DEFAULT_ACTIVITY_COLORS.other
  }

  if (customColors && customColors[activity]) {
    return hexToRgba(customColors[activity])
  }

  return DEFAULT_ACTIVITY_COLORS[activity] || DEFAULT_ACTIVITY_COLORS.other
}

/**
 * Get gradient color (green → yellow → red)
 */
export function getGradientColor(
  value: number,
  min: number,
  max: number
): Color {
  // Clamp value to range
  const clampedValue = Math.max(min, Math.min(max, value))

  // Normalize to 0-1
  const ratio = (clampedValue - min) / (max - min)

  // Green → Yellow → Red gradient
  let r: number, g: number

  if (ratio < 0.5) {
    // Green → Yellow
    r = Math.floor(255 * (ratio * 2))
    g = 255
  } else {
    // Yellow → Red
    r = 255
    g = Math.floor(255 * (1 - (ratio - 0.5) * 2))
  }

  return [r, g, 0, 255]
}

/**
 * Get cluster color by ID
 */
export function getClusterColor(
  clusterId: number,
  hullType?: 'origin' | 'destination'
): Color {
  // Use color palette for clusters
  const colors: Color[] = [
    [255, 99, 132, 180],   // Red
    [54, 162, 235, 180],   // Blue
    [255, 206, 86, 180],   // Yellow
    [75, 192, 192, 180],   // Teal
    [153, 102, 255, 180],  // Purple
    [255, 159, 64, 180],   // Orange
    [199, 199, 199, 180],  // Gray
    [83, 102, 255, 180],   // Indigo
    [40, 159, 64, 180],    // Green
    [210, 99, 132, 180],   // Pink
  ]

  const baseColor = colors[clusterId % colors.length]

  // Adjust opacity based on hull type
  if (hullType === 'origin') {
    return [baseColor[0], baseColor[1], baseColor[2], 150]
  } else if (hullType === 'destination') {
    return [baseColor[0], baseColor[1], baseColor[2], 100]
  }

  return baseColor
}

/**
 * Convert hex color to RGBA
 */
export function hexToRgba(hex: string, alpha: number = 255): Color {
  // Remove # if present
  hex = hex.replace(/^#/, '')

  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  return [r, g, b, alpha]
}

/**
 * Get legend items for color-by mode
 */
export function getLegendItems(
  colorBy: ColorByMode,
  requests: Request[],
  customColors?: Record<string, string>
): Array<{ label: string; color: Color }> {
  switch (colorBy) {
    case 'mode': {
      const modes = Array.from(new Set(requests.map(r => r.main_mode || r.mode)))
      return modes.map(mode => ({
        label: mode,
        color: getModeColor(mode, customColors),
      }))
    }
    case 'activity': {
      const activities = Array.from(
        new Set(requests.map(r => r.start_activity_type).filter(a => a))
      )
      return activities.map(activity => ({
        label: activity!,
        color: getActivityColor(activity, customColors),
      }))
    }
    case 'price': {
      return [
        { label: '€0', color: [0, 255, 0, 255] },
        { label: '€25', color: [255, 255, 0, 255] },
        { label: '€50', color: [255, 0, 0, 255] },
      ]
    }
    case 'detour': {
      return [
        { label: '1.0x', color: [0, 255, 0, 255] },
        { label: '1.5x', color: [255, 255, 0, 255] },
        { label: '2.0x', color: [255, 0, 0, 255] },
      ]
    }
    default:
      return []
  }
}
