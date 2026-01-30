/**
 * Export types for chart and map export functionality
 */

/**
 * Supported export formats
 */
export type ExportFormat = 'png' | 'svg'

/**
 * Export configuration for individual chart/map export
 */
export interface ExportConfig {
  /** Export format (png or svg) */
  format: ExportFormat
  /** Output width in pixels (default: 1200) */
  width?: number
  /** Output height in pixels (default: derived from aspect ratio) */
  height?: number
  /** Scale factor for resolution (default: 2 for 300 DPI equivalent) */
  scale?: number
  /** Custom filename (without extension) */
  filename?: string
}

/**
 * Default export configuration
 */
export const DEFAULT_EXPORT_CONFIG: Required<Omit<ExportConfig, 'filename'>> & { filename?: string } = {
  format: 'png',
  width: 1200,
  height: 800,
  scale: 2, // 2x scale = ~300 DPI at 1200px width
  filename: undefined,
}

/**
 * Export result containing the data and metadata
 */
export interface ExportResult {
  /** Base64-encoded image data (without data: prefix) */
  data: string
  /** File extension */
  extension: string
  /** Suggested filename */
  filename: string
  /** MIME type */
  mimeType: string
}

/**
 * Card export info for bulk export
 */
export interface CardExportInfo {
  /** Card ID */
  cardId: string
  /** Card title (used for filename) */
  title: string
  /** Card type (histogram, scatter, pie, map, etc.) */
  type: string
  /** Export element reference (Plotly div or canvas) */
  element?: HTMLElement
}
