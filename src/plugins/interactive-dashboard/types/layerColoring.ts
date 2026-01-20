/**
 * Layer Coloring Types
 *
 * TypeScript interfaces for the adaptive layer coloring system.
 * This system determines which layers receive data-driven colorBy coloring
 * versus neutral styling based on layer relationships.
 */

/**
 * Layer coloring role - determines how a layer receives colors
 *
 * - 'primary': Layer receives full colorBy data coloring
 * - 'secondary': Layer receives subdued colorBy coloring (future use)
 * - 'neutral': Layer receives theme-neutral styling
 * - 'auto': Defer to automatic role detection
 */
export type ColorByRole = 'primary' | 'secondary' | 'neutral' | 'auto'

/**
 * Dashboard-level strategy for automatic role assignment
 *
 * - 'auto': Automatically detect roles based on layer relationships
 * - 'explicit': Only layers with explicit colorByRole get coloring
 * - 'all': All layers receive colorBy coloring
 */
export type LayerStrategy = 'auto' | 'explicit' | 'all'

/**
 * Computed role for a specific layer
 *
 * Contains the layer name, its computed role, and the reason
 * for the role assignment (useful for debugging).
 */
export interface LayerColoringRole {
  /** Name of the layer */
  layerName: string
  /** Computed coloring role */
  role: 'primary' | 'secondary' | 'neutral'
  /** Human-readable explanation for the role assignment */
  reason: string
}

/**
 * Group of layers sharing the same geoProperty
 *
 * Layers that share a geoProperty are semantically connected -
 * they represent related data (e.g., origin clusters and OD arcs
 * both linked by cluster_id).
 */
export interface LayerGroup {
  /** The shared geoProperty value (normalized to lowercase) */
  geoProperty: string
  /** All layers in this group */
  layers: LayerConfigForColoring[]
  /** Whether this group contains an arc layer */
  hasArc: boolean
  /** Count of geometry layers (non-arc) in this group */
  geometryCount: number
}

/**
 * Minimal layer config interface for coloring computation
 *
 * This interface captures only the properties needed for layer
 * role computation. It's compatible with the full LayerConfig
 * used elsewhere in the application.
 */
export interface LayerConfigForColoring {
  /** Unique layer name */
  name: string
  /** Layer type: 'polygon', 'line', 'arc', 'scatterplot', etc. */
  type: string
  /** Linkage configuration for connecting to central data table */
  linkage?: {
    /** Property in GeoJSON features to match against table */
    geoProperty?: string
    /** Column in central data table to link */
    tableColumn?: string
  }
  /** Explicit coloring role override */
  colorByRole?: ColorByRole
  /** Static line/outline color (hex string) */
  color?: string
  /** Static fill color (hex string) */
  fillColor?: string
  /** Data-driven coloring configuration */
  colorBy?: {
    attribute?: string
    type?: 'categorical' | 'numeric'
    scale?: [number, number]
    colors?: string[]
  }
}
