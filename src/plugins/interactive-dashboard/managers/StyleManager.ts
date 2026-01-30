/**
 * StyleManager - Centralized color management for Interactive Dashboard
 *
 * This class is the single source of truth for all colors used across dashboard components.
 * It generates CSS custom properties and provides programmatic access to theme colors.
 *
 * Usage:
 *   import { StyleManager, initializeTheme } from './StyleManager'
 *
 *   // Initialize once at app startup
 *   initializeTheme()
 *
 *   // Get colors programmatically
 *   const color = StyleManager.getInstance().getColor('theme.background.primary')
 *   const rgba = StyleManager.getInstance().getColorRGBA('interaction.hover', 200)
 *
 *   // Or use CSS variables in components
 *   // background-color: var(--dashboard-bg-primary)
 */

import globalStore from '@/store'
import { ColorScheme } from '@/Globals'

// ============================================================================
// COLOR CONSTANTS - Defined inline (single source of truth)
// ============================================================================

// Transport mode colors (domain-specific, not theme-dependent)
const MODE_COLORS: { [mode: string]: string } = {
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

// Activity type colors (domain-specific)
const ACTIVITY_COLORS: { [activity: string]: string } = {
  home: '#4477ff',
  work: '#ff4477',
  education: '#44ff77',
  shopping: '#ff7744',
  leisure: '#aa44ff',
  other: '#777777',
}

// Generic categorical color palette - 15 colorblind-safe colors
// Designed for arbitrary categories with good visual distinction
const CATEGORICAL_COLORS = [
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
 * Color palette type for theme-aware colors (light/dark/scientific variants)
 */
interface ThemeColorPalette {
  light: string
  dark: string
  scientific: string
}

/**
 * Filter interaction styling configuration
 */
interface FilterStyleConfig {
  nonFilteredAlpha: number      // Alpha (0-255) for non-filtered items
  filteredWidthMultiplier: number  // Width multiplier for filtered items
  nonFilteredWidthPx: number    // Minimum width for non-filtered items
}

/**
 * Sequential color scale names
 */
type SequentialScaleName = 'viridis' | 'blues' | 'reds' | 'greens' | 'plasma'

/**
 * Number formatting configuration
 */
interface NumberFormatConfig {
  defaultDecimals: number         // Default decimal places (2)
  maxDecimals: number             // Maximum decimals for very precise values
  useGrouping: boolean            // Use thousand separators (true)
  compactThreshold: number        // Value above which to use compact notation (1000000)
  scientificThreshold: number     // Value below which to use scientific notation (0.01)
}

/**
 * Layer style defaults for different layer types
 */
interface ArcLayerStyle {
  color: string
  opacity: number
  arcHeight: number
  arcTilt: number
  widthScale: [number, number]  // min, max width for attribute-based sizing
}

interface BoundaryLayerStyle {
  fillColor: string
  fillOpacity: number
  lineColor: string
  lineWidth: number
}

interface LayerStyleDefaults {
  // Arc layer defaults (for OD flow visualization)
  arc: ArcLayerStyle
  // Boundary layer defaults (for cluster outlines)
  boundary: BoundaryLayerStyle
  // OD-specific boundary (outline only, no fill)
  odBoundary: BoundaryLayerStyle
}

/**
 * Complete color definitions for the dashboard theming system
 */
interface ColorDefinitions {
  // Theme colors (mode-aware)
  theme: {
    background: {
      primary: ThemeColorPalette
      secondary: ThemeColorPalette
      tertiary: ThemeColorPalette
    }
    text: {
      primary: ThemeColorPalette
      secondary: ThemeColorPalette
    }
    border: {
      default: ThemeColorPalette
      subtle: ThemeColorPalette
    }
  }

  // Interaction state colors (constant across modes)
  interaction: {
    hover: string
    selected: string
    dimmedAlpha: number // 0-255 for deck.gl
  }

  // Filter interaction styling
  filter: FilterStyleConfig

  // Sequential color scales for numeric data
  sequentialScales: Record<SequentialScaleName, string[]>

  // OD cluster colors (colorblind-safe defaults)
  cluster: {
    origin: string
    destination: string
  }

  // Chart colors (mode-aware)
  chart: {
    bar: {
      default: ThemeColorPalette
      selected: ThemeColorPalette
    }
    grid: ThemeColorPalette
  }

  // Categorical palette (for arbitrary categories)
  categorical: string[]

  // Transport mode colors
  mode: { [mode: string]: string }

  // Activity type colors
  activity: { [activity: string]: string }

  // Number formatting configuration
  numberFormat: NumberFormatConfig

  // Layer style defaults
  layers: LayerStyleDefaults

  // Scientific mode configuration (for publication-ready output)
  scientific: {
    fontFamily: string
    axisLineWidth: number
    markerBorderWidth: number
    hideInteractiveChrome: boolean  // Hide zoom buttons, tooltips in scientific mode
    markerSymbols: string[]         // Plotly marker symbols for scatter plots
    barPatterns: string[]           // Plotly pattern shapes for bars
    piePatterns: string[]           // Plotly pattern shapes for pie slices
  }
}

/**
 * StyleManager class - Singleton for centralized color management
 */
export class StyleManager {
  private static instance: StyleManager | null = null
  private currentMode: 'light' | 'dark' | 'scientific' = 'dark'
  private styleElement: HTMLStyleElement | null = null
  private unsubscribe: (() => void) | null = null

  // Cluster color overrides (from YAML configuration)
  private clusterColorOverrides: { origin?: string; destination?: string } = {}

  /**
   * Complete color definitions
   */
  private readonly colors: ColorDefinitions = {
    theme: {
      background: {
        // Scientific colors: Pure white background for maximum print contrast
        primary: { light: '#ffffff', dark: '#1e293b', scientific: '#ffffff' },
        secondary: { light: '#f8f9fa', dark: '#334155', scientific: '#ffffff' },
        tertiary: { light: '#f1f5f9', dark: '#475569', scientific: '#f5f5f5' },
      },
      text: {
        // Scientific colors: Black text for publication readability
        primary: { light: '#374151', dark: '#e2e8f0', scientific: '#000000' },
        secondary: { light: '#6b7280', dark: '#94a3b8', scientific: '#333333' },
      },
      border: {
        // Scientific colors: Black borders for crisp print output
        default: { light: '#e5e7eb', dark: '#475569', scientific: '#000000' },
        subtle: { light: '#f3f4f6', dark: '#334155', scientific: '#cccccc' },
      },
    },

    // Interaction state colors - constant across modes per CONTEXT.md
    interaction: {
      hover: '#fbbf24', // Orange/amber
      selected: '#3b82f6', // Blue
      dimmedAlpha: 77, // ~0.3 opacity (77/255)
    },

    // Filter interaction styling - controls visual hierarchy when filters are active
    filter: {
      nonFilteredAlpha: 15,        // Very transparent for non-filtered items (more dim than dimmedAlpha)
      filteredWidthMultiplier: 1.2, // Slight width boost for filtered items
      nonFilteredWidthPx: 1,       // Minimum width for dimmed items
    },

    // Sequential color scales for numeric data visualization
    sequentialScales: {
      viridis: ['#440154', '#482878', '#3e4a89', '#31688e', '#26838e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde724'],
      blues: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
      reds: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'],
      greens: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
      plasma: ['#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786', '#d8576b', '#ed7953', '#fb9f3a', '#fdca26', '#f0f921'],
    },

    // OD cluster colors - colorblind-safe defaults
    cluster: {
      origin: '#2563eb', // Blue-600 (deuteranopia-safe)
      destination: '#dc2626', // Red-600 (distinguishable)
    },

    // Chart colors (mode-aware)
    chart: {
      bar: {
        // Scientific uses black for default bars (maximum contrast)
        default: { light: '#3b82f6', dark: '#60a5fa', scientific: '#000000' },
        selected: { light: '#ef4444', dark: '#f87171', scientific: '#666666' },
      },
      // Scientific uses light gray grid for subtlety
      grid: { light: '#e5e7eb', dark: '#334155', scientific: '#cccccc' },
    },

    // Keep existing categorical colors
    categorical: CATEGORICAL_COLORS,

    // Keep existing mode colors
    mode: MODE_COLORS,

    // Keep existing activity colors
    activity: ACTIVITY_COLORS,

    // Layer style defaults - single source of truth for layer styling
    layers: {
      // Arc layer defaults (for OD flow visualization)
      arc: {
        color: '#9b59b6',      // Purple - matches cluster dashboard
        opacity: 0.9,
        arcHeight: 0.2,
        arcTilt: 25,
        widthScale: [4, 14],   // Width range for num_requests-based sizing
      },
      // Boundary layer defaults (for cluster outlines with fill)
      boundary: {
        fillColor: '#9b59b6',
        fillOpacity: 0.8,
        lineColor: '#8e44ad',
        lineWidth: 2,
      },
      // OD-specific boundary (outline only, no fill - for OD cluster view)
      odBoundary: {
        fillColor: '#7f8c8d',
        fillOpacity: 0,
        lineColor: '#7f8c8d',
        lineWidth: 2,
      },
    },

    // Number formatting configuration
    numberFormat: {
      defaultDecimals: 2,           // Default: 2 decimal places
      maxDecimals: 4,               // For very precise values
      useGrouping: true,            // Use thousand separators (1,234.56)
      compactThreshold: 1000000,    // Use compact notation above 1M (1.2M)
      scientificThreshold: 0.01,    // Use scientific notation below 0.01 (1.2e-3)
    },

    // Scientific mode configuration (for publication-ready output)
    scientific: {
      fontFamily: 'Arial, Helvetica, sans-serif',
      axisLineWidth: 1.5,
      markerBorderWidth: 1,
      hideInteractiveChrome: true,  // Hide zoom buttons, tooltips in scientific mode
      markerSymbols: ['circle', 'square', 'diamond', 'cross', 'x', 'triangle-up', 'triangle-down', 'star', 'hexagon', 'pentagon'],
      barPatterns: ['', '/', '\\', 'x', '-', '|', '+', '.'],  // '' means solid fill
      piePatterns: ['', '/', '\\', 'x', '+', '-', '|', '.'],
    },
  }

  /**
   * Private constructor - use getInstance()
   */
  private constructor() {
    // Default to dark mode (matching existing app default)
    this.currentMode = 'dark'
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): StyleManager {
    if (!StyleManager.instance) {
      StyleManager.instance = new StyleManager()
    }
    return StyleManager.instance
  }

  /**
   * Initialize theme and subscribe to store changes
   * Call this once at app initialization
   */
  initialize(): void {
    // Read initial mode from store
    this.syncModeFromStore()

    // Inject CSS variables
    this.injectCSSVariables()

    // Subscribe to store changes
    this.subscribeToStore()
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Remove store subscription
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }

    // Remove style element
    if (this.styleElement && this.styleElement.parentNode) {
      this.styleElement.parentNode.removeChild(this.styleElement)
      this.styleElement = null
    }
  }

  /**
   * Get current color mode
   */
  getMode(): 'light' | 'dark' | 'scientific' {
    return this.currentMode
  }

  /**
   * Set color mode explicitly
   */
  setMode(mode: 'light' | 'dark' | 'scientific'): void {
    if (this.currentMode !== mode) {
      this.currentMode = mode
      this.injectCSSVariables()
    }
  }

  /**
   * Check if currently in scientific mode
   */
  isScientificMode(): boolean {
    return this.currentMode === 'scientific'
  }

  /**
   * Get scientific mode configuration
   */
  getScientificConfig(): { fontFamily: string; axisLineWidth: number; markerBorderWidth: number; hideInteractiveChrome: boolean; markerSymbols: string[]; barPatterns: string[]; piePatterns: string[] } {
    return { ...this.colors.scientific }
  }

  /**
   * Get marker symbol for scientific mode scatter plots
   *
   * @param index - Category index
   * @returns Plotly marker symbol (wraps around if index exceeds array length)
   */
  getScientificMarkerSymbol(index: number): string {
    const symbols = this.colors.scientific.markerSymbols
    return symbols[index % symbols.length]
  }

  /**
   * Get bar pattern for scientific mode histograms
   *
   * @param index - Trace index
   * @returns Plotly pattern shape (wraps around if index exceeds array length)
   */
  getScientificBarPattern(index: number): string {
    const patterns = this.colors.scientific.barPatterns
    return patterns[index % patterns.length]
  }

  /**
   * Get pie slice pattern for scientific mode pie charts
   *
   * @param index - Slice index
   * @returns Plotly pattern shape (wraps around if index exceeds array length)
   */
  getScientificPiePattern(index: number): string {
    const patterns = this.colors.scientific.piePatterns
    return patterns[index % patterns.length]
  }

  /**
   * Get a color value by path
   *
   * @param path - Dot-separated path to color, e.g., 'theme.background.primary'
   * @returns Hex color string
   *
   * @example
   * getColor('theme.background.primary') // returns '#ffffff' or '#1e293b' based on mode
   * getColor('interaction.hover') // returns '#fbbf24'
   * getColor('cluster.origin') // returns '#2563eb' (or override if set)
   */
  getColor(path: string): string {
    const parts = path.split('.')

    // Handle cluster colors (may have overrides)
    if (parts[0] === 'cluster' && parts.length === 2) {
      const clusterType = parts[1] as 'origin' | 'destination'
      if (this.clusterColorOverrides[clusterType]) {
        return this.clusterColorOverrides[clusterType]!
      }
      return this.colors.cluster[clusterType]
    }

    // Handle interaction colors (not mode-aware)
    if (parts[0] === 'interaction' && parts.length === 2) {
      const key = parts[1] as keyof typeof this.colors.interaction
      const value = this.colors.interaction[key]
      return typeof value === 'string' ? value : '#808080'
    }

    // Handle theme colors (mode-aware)
    if (parts[0] === 'theme' && parts.length === 3) {
      const category = parts[1] as keyof typeof this.colors.theme
      const name = parts[2] as string
      const colorSet = this.colors.theme[category] as any
      if (colorSet && colorSet[name]) {
        return colorSet[name][this.currentMode]
      }
    }

    // Handle chart colors (mode-aware)
    if (parts[0] === 'chart') {
      if (parts.length === 2 && parts[1] === 'grid') {
        return this.colors.chart.grid[this.currentMode]
      }
      if (parts.length === 3 && parts[1] === 'bar') {
        const barType = parts[2] as 'default' | 'selected'
        if (barType in this.colors.chart.bar) {
          return this.colors.chart.bar[barType][this.currentMode]
        }
      }
    }

    // Handle categorical colors by index
    if (parts[0] === 'categorical' && parts.length === 2) {
      const index = parseInt(parts[1], 10)
      if (!isNaN(index)) {
        return this.colors.categorical[index % this.colors.categorical.length]
      }
    }

    // Handle mode colors
    if (parts[0] === 'mode' && parts.length === 2) {
      return this.colors.mode[parts[1]] || this.colors.mode.default
    }

    // Handle activity colors
    if (parts[0] === 'activity' && parts.length === 2) {
      return this.colors.activity[parts[1]] || this.colors.activity.other
    }

    // Fallback
    console.warn(`StyleManager: Unknown color path "${path}"`)
    return '#808080'
  }

  /**
   * Get RGBA array for deck.gl
   *
   * @param path - Dot-separated path to color
   * @param alpha - Alpha value 0-255 (default 255)
   * @returns [R, G, B, A] array for deck.gl
   *
   * @example
   * getColorRGBA('interaction.hover', 200) // returns [251, 191, 36, 200]
   */
  getColorRGBA(path: string, alpha: number = 255): [number, number, number, number] {
    const hex = this.getColor(path)
    return this.hexToRgba(hex, alpha)
  }

  /**
   * Get dimmed RGBA (for non-selected/non-hovered items)
   *
   * @param path - Dot-separated path to base color
   * @returns [R, G, B, A] with dimmed alpha
   */
  getDimmedColorRGBA(path: string): [number, number, number, number] {
    return this.getColorRGBA(path, this.colors.interaction.dimmedAlpha)
  }

  /**
   * Override cluster colors (for YAML configuration)
   */
  setClusterColors(colors: { origin?: string; destination?: string }): void {
    this.clusterColorOverrides = { ...colors }
    this.injectCSSVariables()
  }

  /**
   * Reset cluster colors to defaults
   */
  resetClusterColors(): void {
    this.clusterColorOverrides = {}
    this.injectCSSVariables()
  }

  /**
   * Get categorical color by index
   */
  getCategoricalColor(index: number): string {
    return this.colors.categorical[index % this.colors.categorical.length]
  }

  /**
   * Get categorical color as RGBA
   */
  getCategoricalColorRGBA(index: number, alpha: number = 255): [number, number, number, number] {
    const hex = this.getCategoricalColor(index)
    return this.hexToRgba(hex, alpha)
  }

  // ----- Layer Style Getters -----

  /**
   * Get arc layer style defaults
   *
   * @example
   * const arcStyle = StyleManager.getInstance().getArcLayerStyle()
   * // Use in MapCard: color: arcStyle.color, opacity: arcStyle.opacity, etc.
   */
  getArcLayerStyle(): ArcLayerStyle {
    return { ...this.colors.layers.arc }
  }

  /**
   * Get boundary layer style defaults (for filled boundaries)
   */
  getBoundaryLayerStyle(): BoundaryLayerStyle {
    return { ...this.colors.layers.boundary }
  }

  /**
   * Get OD boundary layer style defaults (outline only, no fill)
   */
  getODBoundaryLayerStyle(): BoundaryLayerStyle {
    return { ...this.colors.layers.odBoundary }
  }

  /**
   * Get all layer style defaults
   */
  getLayerStyles(): LayerStyleDefaults {
    return {
      arc: { ...this.colors.layers.arc },
      boundary: { ...this.colors.layers.boundary },
      odBoundary: { ...this.colors.layers.odBoundary },
    }
  }

  // ----- Filter Styling Methods -----

  /**
   * Get filter interaction styling configuration
   * Use these values for consistent filter behavior across all cards
   *
   * @example
   * const filterStyle = StyleManager.getInstance().getFilterStyle()
   * // Non-filtered items: alpha = filterStyle.nonFilteredAlpha
   * // Filtered item width: baseWidth * filterStyle.filteredWidthMultiplier
   */
  getFilterStyle(): FilterStyleConfig {
    return { ...this.colors.filter }
  }

  // ----- Sequential Color Scale Methods -----

  /**
   * Interpolate a color from a sequential scale
   *
   * @param scale - Name of the sequential scale (viridis, blues, reds, greens, plasma)
   * @param t - Normalized value between 0 and 1
   * @returns Hex color string
   *
   * @example
   * getSequentialColor('viridis', 0.5) // returns middle color in viridis scale
   */
  getSequentialColor(scale: SequentialScaleName, t: number): string {
    const colors = this.colors.sequentialScales[scale]
    if (!colors || colors.length === 0) {
      console.warn(`StyleManager: Unknown sequential scale "${scale}"`)
      return '#808080'
    }

    // Clamp t to [0, 1]
    t = Math.max(0, Math.min(1, t))

    // Find the two colors to interpolate between
    const scaledIndex = t * (colors.length - 1)
    const lowerIndex = Math.floor(scaledIndex)
    const upperIndex = Math.ceil(scaledIndex)
    const fraction = scaledIndex - lowerIndex

    if (lowerIndex === upperIndex) {
      return colors[lowerIndex]
    }

    // Interpolate between the two colors
    return this.interpolateHexColors(colors[lowerIndex], colors[upperIndex], fraction)
  }

  /**
   * Get a sequential color as RGBA array for deck.gl
   *
   * @param scale - Name of the sequential scale
   * @param t - Normalized value between 0 and 1
   * @param alpha - Alpha value 0-255 (default 255)
   */
  getSequentialColorRGBA(
    scale: SequentialScaleName,
    t: number,
    alpha: number = 255
  ): [number, number, number, number] {
    const hex = this.getSequentialColor(scale, t)
    return this.hexToRgba(hex, alpha)
  }

  /**
   * Get CSS gradient string for a sequential scale (for legend display)
   *
   * @param scale - Name of the sequential scale
   * @returns CSS linear-gradient string
   *
   * @example
   * getSequentialGradientCSS('viridis') // 'linear-gradient(to right, #440154, ..., #fde724)'
   */
  getSequentialGradientCSS(scale: SequentialScaleName): string {
    const colors = this.colors.sequentialScales[scale]
    if (!colors || colors.length === 0) {
      return 'linear-gradient(to right, #808080, #808080)'
    }
    return `linear-gradient(to right, ${colors.join(', ')})`
  }

  // ----- Categorical Color Map Methods -----

  /**
   * Build a color map for categorical values using consistent palette assignment
   * Values are assigned colors based on their index (sorted alphabetically for consistency)
   *
   * @param sortedValues - Array of unique values, sorted for consistent color assignment
   * @returns Map from value to hex color
   *
   * @example
   * const colorMap = StyleManager.getInstance().buildCategoricalColorMap(['bike', 'car', 'walk'])
   * colorMap.get('car') // returns consistent color for 'car'
   */
  buildCategoricalColorMap(sortedValues: string[]): Map<string, string> {
    const colorMap = new Map<string, string>()
    sortedValues.forEach((value, index) => {
      colorMap.set(value, this.getCategoricalColor(index))
    })
    return colorMap
  }

  /**
   * Get interaction color as RGBA array
   * Convenience method for deck.gl integration
   *
   * @param state - 'hover' or 'selected'
   * @param alpha - Alpha value 0-255 (default 255)
   */
  getInteractionColorRGBA(
    state: 'hover' | 'selected',
    alpha: number = 255
  ): [number, number, number, number] {
    return this.getColorRGBA(`interaction.${state}`, alpha)
  }

  // ----- Public Hex Conversion -----

  /**
   * Convert hex color to RGBA array (public method)
   *
   * @param hex - Hex color string (with or without #)
   * @param alpha - Alpha value 0-255 (default 255)
   * @returns [R, G, B, A] array
   */
  hexToRgba(hex: string, alpha: number = 255): [number, number, number, number] {
    const cleanHex = hex.replace('#', '')
    const r = parseInt(cleanHex.slice(0, 2), 16)
    const g = parseInt(cleanHex.slice(2, 4), 16)
    const b = parseInt(cleanHex.slice(4, 6), 16)
    return [r, g, b, alpha]
  }

  // ----- Number Formatting Methods -----

  /**
   * Get number formatting configuration
   */
  getNumberFormat(): NumberFormatConfig {
    return { ...this.colors.numberFormat }
  }

  /**
   * Format a number for display with consistent decimal places and formatting
   *
   * @param value - The number to format
   * @param options - Optional overrides for formatting
   * @returns Formatted string
   *
   * @example
   * formatNumber(1234.5678) // "1,234.57"
   * formatNumber(0.001234) // "1.23e-3"
   * formatNumber(1234567) // "1.23M"
   * formatNumber(1234.5, { decimals: 0 }) // "1,235"
   */
  formatNumber(
    value: number | null | undefined,
    options?: {
      decimals?: number
      forceDecimals?: boolean  // Always show decimals even for whole numbers
      compact?: boolean        // Force compact notation (1.2M)
      noGrouping?: boolean     // Disable thousand separators
    }
  ): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '—'
    }

    const config = this.colors.numberFormat
    const decimals = options?.decimals ?? config.defaultDecimals
    const useGrouping = !options?.noGrouping && config.useGrouping

    // Handle very small numbers with scientific notation
    if (Math.abs(value) > 0 && Math.abs(value) < config.scientificThreshold) {
      return value.toExponential(decimals)
    }

    // Handle very large numbers with compact notation
    if (options?.compact || Math.abs(value) >= config.compactThreshold) {
      return this.formatCompact(value, decimals)
    }

    // Standard formatting
    const formatted = value.toLocaleString(undefined, {
      minimumFractionDigits: options?.forceDecimals ? decimals : 0,
      maximumFractionDigits: decimals,
      useGrouping,
    })

    return formatted
  }

  /**
   * Format a number in compact notation (1.2K, 1.5M, etc.)
   */
  private formatCompact(value: number, decimals: number): string {
    const absValue = Math.abs(value)
    const sign = value < 0 ? '-' : ''

    if (absValue >= 1e9) {
      return sign + (absValue / 1e9).toFixed(decimals) + 'B'
    }
    if (absValue >= 1e6) {
      return sign + (absValue / 1e6).toFixed(decimals) + 'M'
    }
    if (absValue >= 1e3) {
      return sign + (absValue / 1e3).toFixed(decimals) + 'K'
    }
    return value.toFixed(decimals)
  }

  /**
   * Format a percentage value
   *
   * @param value - The value (0-1 or 0-100 depending on isRatio)
   * @param isRatio - If true, value is 0-1 and will be multiplied by 100
   * @returns Formatted percentage string with % symbol
   */
  formatPercent(value: number | null | undefined, isRatio: boolean = false): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '—'
    }

    const pctValue = isRatio ? value * 100 : value
    const decimals = this.colors.numberFormat.defaultDecimals

    return pctValue.toFixed(decimals) + '%'
  }

  // ----- Private methods -----

  /**
   * Interpolate between two hex colors
   */
  private interpolateHexColors(color1: string, color2: string, t: number): string {
    const rgb1 = this.hexToRgba(color1)
    const rgb2 = this.hexToRgba(color2)

    const r = Math.round(rgb1[0] + (rgb2[0] - rgb1[0]) * t)
    const g = Math.round(rgb1[1] + (rgb2[1] - rgb1[1]) * t)
    const b = Math.round(rgb1[2] + (rgb2[2] - rgb1[2]) * t)

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  /**
   * Sync mode from Vuex store
   */
  private syncModeFromStore(): void {
    const colorScheme = globalStore.state.colorScheme
    if (colorScheme === ColorScheme.ScientificMode) {
      this.currentMode = 'scientific'
    } else if (colorScheme === ColorScheme.LightMode) {
      this.currentMode = 'light'
    } else {
      this.currentMode = 'dark'
    }
  }

  /**
   * Subscribe to Vuex store for theme changes
   */
  private subscribeToStore(): void {
    // Use Vuex watch to detect colorScheme changes
    this.unsubscribe = globalStore.watch(
      state => state.colorScheme,
      (newValue: ColorScheme) => {
        let newMode: 'light' | 'dark' | 'scientific'
        if (newValue === ColorScheme.ScientificMode) {
          newMode = 'scientific'
        } else if (newValue === ColorScheme.LightMode) {
          newMode = 'light'
        } else {
          newMode = 'dark'
        }
        if (this.currentMode !== newMode) {
          this.currentMode = newMode
          this.injectCSSVariables()
        }
      }
    )
  }

  /**
   * Inject CSS variables into document head
   */
  private injectCSSVariables(): void {
    // Only run in browser environment
    if (typeof document === 'undefined') return

    const css = this.generateCSSVariables()

    // Create or update style element
    if (!this.styleElement) {
      this.styleElement = document.createElement('style')
      this.styleElement.id = 'dashboard-theme-vars'
      document.head.appendChild(this.styleElement)
    }

    this.styleElement.textContent = css
  }

  /**
   * Generate CSS variable declarations
   */
  private generateCSSVariables(): string {
    const vars: string[] = []

    // Theme background colors
    vars.push(`--dashboard-bg-primary: ${this.colors.theme.background.primary[this.currentMode]}`)
    vars.push(
      `--dashboard-bg-secondary: ${this.colors.theme.background.secondary[this.currentMode]}`
    )
    vars.push(`--dashboard-bg-tertiary: ${this.colors.theme.background.tertiary[this.currentMode]}`)

    // Theme text colors
    vars.push(`--dashboard-text-primary: ${this.colors.theme.text.primary[this.currentMode]}`)
    vars.push(`--dashboard-text-secondary: ${this.colors.theme.text.secondary[this.currentMode]}`)

    // Theme border colors
    vars.push(`--dashboard-border-default: ${this.colors.theme.border.default[this.currentMode]}`)
    vars.push(`--dashboard-border-subtle: ${this.colors.theme.border.subtle[this.currentMode]}`)

    // Interaction colors (constant across modes)
    vars.push(`--dashboard-interaction-hover: ${this.colors.interaction.hover}`)
    vars.push(`--dashboard-interaction-selected: ${this.colors.interaction.selected}`)

    // Cluster colors (with possible overrides)
    vars.push(`--dashboard-cluster-origin: ${this.getColor('cluster.origin')}`)
    vars.push(`--dashboard-cluster-destination: ${this.getColor('cluster.destination')}`)

    // Chart colors
    vars.push(`--dashboard-chart-bar: ${this.colors.chart.bar.default[this.currentMode]}`)
    vars.push(`--dashboard-chart-bar-selected: ${this.colors.chart.bar.selected[this.currentMode]}`)
    vars.push(`--dashboard-chart-grid: ${this.colors.chart.grid[this.currentMode]}`)

    // Categorical colors (first 15 as CSS variables for convenience)
    this.colors.categorical.forEach((color, index) => {
      vars.push(`--dashboard-categorical-${index}: ${color}`)
    })

    // Scientific mode indicator (1 or 0 for CSS usage)
    vars.push(`--dashboard-scientific-mode: ${this.currentMode === 'scientific' ? 1 : 0}`)
    // Scientific font family
    vars.push(`--dashboard-font-scientific: ${this.colors.scientific.fontFamily}`)

    return `:root {\n  ${vars.join(';\n  ')};\n}`
  }

}

/**
 * Convenience function to initialize the theme system
 * Call once at app startup
 */
export function initializeTheme(): void {
  StyleManager.getInstance().initialize()
}

/**
 * Export color type definitions for use in other modules
 */
export type {
  ThemeColorPalette,
  ColorDefinitions,
  ArcLayerStyle,
  BoundaryLayerStyle,
  LayerStyleDefaults,
  FilterStyleConfig,
  SequentialScaleName,
  NumberFormatConfig,
}
