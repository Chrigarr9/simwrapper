/**
 * TypeScript interfaces for DashboardCard component
 *
 * These types define the contract for the unified DashboardCard wrapper
 * that manages card frame, header, buttons, and content slot.
 */

/**
 * Configuration for a dashboard card, derived from YAML config.
 * This matches the card objects created in InteractiveDashboard.setupRows()
 */
export interface CardConfig {
  /** Unique identifier for the card (generated as 'card-id-N') */
  id: string

  /** Card type from YAML (e.g., 'map', 'histogram', 'pie', 'scatter', 'data-table', 'text') */
  type: string

  /** Card title displayed in header */
  title?: string

  /** Card description displayed below title */
  description?: string

  /** Info text shown in collapsible info panel */
  info?: string

  /** Height multiplier (actual height = height * 60, default 300 except for text type) */
  height?: number

  /** Width/flex value for card sizing */
  width?: number

  /** Custom background color */
  backgroundColor?: string

  /** Alternative name for backgroundColor */
  background?: string

  /** Whether the card content is visible */
  visible?: boolean

  /** Whether the card content has finished loading */
  isLoaded?: boolean

  /** Array of error messages to display */
  errors?: string[]

  /** Whether to show the header (derived from title/description presence) */
  showHeader?: boolean

  /** Card-specific props passed to the content component */
  props?: Record<string, any>

  /** Linkage configuration for interactive cards */
  linkage?: any

  /** Layer configurations for map cards */
  layers?: any[]

  /** Card number in the layout sequence */
  number?: number

  /** Allow additional YAML properties */
  [key: string]: any
}

/**
 * Props for DashboardCard component
 */
export interface DashboardCardProps {
  /** Card configuration object */
  card: CardConfig

  /** Whether this card is currently fullscreen */
  isFullscreen: boolean

  /** Whether the panel is narrow (responsive breakpoint) */
  isPanelNarrow: boolean

  /** Whether the dashboard is in fullscreen mode */
  isFullScreenDashboard: boolean
}

/**
 * Events emitted by DashboardCard
 *
 * Note: toggle-info is NOT emitted - info toggle is managed locally by DashboardCard
 * This keeps info state encapsulated and reduces parent complexity.
 */
export interface DashboardCardEmits {
  /** Emitted when user clicks enlarge/restore button. Payload is the card ID. */
  'toggle-fullscreen': [cardId: string]

  /** Emitted when user clears errors. Payload is the card ID. */
  'clear-errors': [cardId: string]

  /** Emitted when card dimensions change. Used by Plotly and other resizable charts. */
  'card-resize': [cardId: string, dimensions: { width: number; height: number }]
}
