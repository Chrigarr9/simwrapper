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

// Import existing color schemes for backward compatibility
import { MODE_COLORS, ACTIVITY_COLORS, CATEGORICAL_COLORS } from '../utils/colorSchemes'

/**
 * Color palette type for theme-aware colors (light/dark variants)
 */
interface ThemeColorPalette {
  light: string
  dark: string
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
}

/**
 * StyleManager class - Singleton for centralized color management
 */
export class StyleManager {
  private static instance: StyleManager | null = null
  private currentMode: 'light' | 'dark' = 'dark'
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
        primary: { light: '#ffffff', dark: '#1e293b' },
        secondary: { light: '#f8f9fa', dark: '#334155' },
        tertiary: { light: '#f1f5f9', dark: '#475569' },
      },
      text: {
        primary: { light: '#374151', dark: '#e2e8f0' },
        secondary: { light: '#6b7280', dark: '#94a3b8' },
      },
      border: {
        default: { light: '#e5e7eb', dark: '#475569' },
        subtle: { light: '#f3f4f6', dark: '#334155' },
      },
    },

    // Interaction state colors - constant across modes per CONTEXT.md
    interaction: {
      hover: '#fbbf24', // Orange/amber
      selected: '#3b82f6', // Blue
      dimmedAlpha: 77, // ~0.3 opacity (77/255)
    },

    // OD cluster colors - colorblind-safe defaults
    cluster: {
      origin: '#2563eb', // Blue-600 (deuteranopia-safe)
      destination: '#dc2626', // Red-600 (distinguishable)
    },

    // Chart colors (mode-aware)
    chart: {
      bar: {
        default: { light: '#3b82f6', dark: '#60a5fa' },
        selected: { light: '#ef4444', dark: '#f87171' },
      },
      grid: { light: '#e5e7eb', dark: '#334155' },
    },

    // Keep existing categorical colors
    categorical: CATEGORICAL_COLORS,

    // Keep existing mode colors
    mode: MODE_COLORS,

    // Keep existing activity colors
    activity: ACTIVITY_COLORS,
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
  getMode(): 'light' | 'dark' {
    return this.currentMode
  }

  /**
   * Set color mode explicitly
   */
  setMode(mode: 'light' | 'dark'): void {
    if (this.currentMode !== mode) {
      this.currentMode = mode
      this.injectCSSVariables()
    }
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

  // ----- Private methods -----

  /**
   * Sync mode from Vuex store
   */
  private syncModeFromStore(): void {
    const colorScheme = globalStore.state.colorScheme
    this.currentMode = colorScheme === ColorScheme.LightMode ? 'light' : 'dark'
  }

  /**
   * Subscribe to Vuex store for theme changes
   */
  private subscribeToStore(): void {
    // Use Vuex watch to detect colorScheme changes
    this.unsubscribe = globalStore.watch(
      state => state.colorScheme,
      (newValue: ColorScheme) => {
        const newMode = newValue === ColorScheme.LightMode ? 'light' : 'dark'
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

    return `:root {\n  ${vars.join(';\n  ')};\n}`
  }

  /**
   * Convert hex color to RGBA array
   */
  private hexToRgba(hex: string, alpha: number = 255): [number, number, number, number] {
    const cleanHex = hex.replace('#', '')
    const r = parseInt(cleanHex.slice(0, 2), 16)
    const g = parseInt(cleanHex.slice(2, 4), 16)
    const b = parseInt(cleanHex.slice(4, 6), 16)
    return [r, g, b, alpha]
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
export type { ThemeColorPalette, ColorDefinitions }
