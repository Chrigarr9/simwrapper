// Type definitions for Interactive Dashboard Plugin

/**
 * Configuration for a single table column
 */
export interface ColumnFormat {
  type?: 'string' | 'number' | 'decimal' | 'time' | 'duration' | 'distance' | 'boolean'
  unit?: string  // Display unit (e.g., 'km', 'h', 'min', 's', 'm')
  decimals?: number  // Number of decimal places for numeric types
  convertFrom?: 'seconds' | 'meters'  // Source unit for automatic conversion
}

/**
 * Configuration for table columns visibility and formatting
 */
export interface TableColumnConfig {
  show?: string[]  // Explicit list of columns to show (empty = show all)
  hide?: string[]  // Columns to hide (applied after show filter)
  formats?: { [columnKey: string]: ColumnFormat }  // Column-specific formatting
}

/**
 * Central data table configuration
 */
export interface TableConfig {
  name?: string  // Table display name (default: "Items")
  dataset: string  // Path to CSV file
  idColumn: string  // Column to use as unique identifier
  visible?: boolean  // Whether to show the table (default: false)
  columns?: TableColumnConfig  // Column visibility and formatting
}

/**
 * Linkage configuration for connecting cards to the central data table
 */
export interface LinkageConfig {
  type?: 'filter' | 'highlight'  // Type of linkage (default: 'filter')
  column?: string  // Column in the central table to link to
  tableColumn?: string  // For map layers: column in the central table
  geoProperty?: string  // For map layers: property in GeoJSON to match
  onHover?: 'highlight' | 'none'  // Behavior on hover (default: 'none')
  onSelect?: 'filter' | 'highlight' | 'none'  // Behavior on selection (default: 'filter')
  behavior?: 'toggle' | 'replace'  // For histogram/pie: toggle or replace selection (default: 'toggle')
}

/**
 * Base card configuration
 */
export interface CardConfig {
  type: string  // Card type (histogram, pie-chart, map, etc.)
  title?: string  // Card title
  description?: string  // Card description
  width?: number  // Card width (grid units, default: 1)
  height?: number  // Card height (grid units, default: 4)
  linkage?: LinkageConfig  // Optional linkage configuration
  [key: string]: any  // Allow additional card-specific properties
}

/**
 * Histogram card configuration
 */
export interface HistogramCardConfig extends CardConfig {
  type: 'histogram'
  column: string  // Column to create histogram from
  binSize?: number  // Bin size for histogram (default: auto)
}

/**
 * Pie chart card configuration
 */
export interface PieChartCardConfig extends CardConfig {
  type: 'pie-chart'
  column: string  // Column to create pie chart from
}

/**
 * Scatter plot card configuration
 */
export interface ScatterCardConfig extends CardConfig {
  type: 'scatter-plot'
  xColumn: string  // Column for X axis
  yColumn: string  // Column for Y axis
  colorColumn?: string  // Optional column for point colors (categorical)
  sizeColumn?: string  // Optional column for point sizes (numeric)
  markerSize?: number  // Default marker size (default: 8)
}

/**
 * Map card configuration
 */
export interface MapCardConfig extends CardConfig {
  type: 'map'
  center?: [number, number]  // Map center [lon, lat]
  zoom?: number  // Initial zoom level
  layers?: MapLayerConfig[]  // Map layers
}

/**
 * Map layer configuration
 */
export interface MapLayerConfig {
  name: string
  file: string  // Path to GeoJSON file
  type: 'circle' | 'fill' | 'line'  // Layer type
  visible?: boolean  // Initial visibility (default: true)
  radius?: number  // Circle radius (for circle layers)
  fillColor?: string  // Fill color
  linkage?: LinkageConfig  // Optional linkage configuration
}

/**
 * Row layout configuration
 */
export interface RowConfig {
  [key: string]: CardConfig[]  // Key is row name (e.g., 'row1', 'row2')
}

/**
 * Main Interactive Dashboard configuration
 */
export interface InteractiveDashboardConfig {
  header: {
    tab: string  // Tab name
    title: string  // Dashboard title
    description?: string  // Dashboard description
  }
  table: TableConfig  // Central data table (required - triggers InteractiveDashboard)
  layout: RowConfig  // Dashboard layout with cards
}
