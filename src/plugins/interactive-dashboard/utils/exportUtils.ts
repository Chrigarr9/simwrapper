/**
 * Export utilities for chart and map export functionality
 *
 * Uses:
 * - Plotly.downloadImage() for chart exports
 * - Canvas toDataURL() for map exports
 * - JSZip for bulk export
 */

import Plotly from 'plotly.js/dist/plotly'
import JSZip from 'jszip'
import type { ExportConfig, ExportResult, ExportFormat } from '../types/export'
import { DEFAULT_EXPORT_CONFIG } from '../types/export'

const PLOTLY_TO_IMAGE_TIMEOUT_MS = 15000
const PLOTLY_TO_IMAGE_RETRIES = 2

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
    promise
      .then(value => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch(error => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

async function svgFallbackImageData(
  plotElement: HTMLElement,
  format: ExportFormat,
  width: number,
  height: number,
  scale: number
): Promise<string> {
  const svgNode = plotElement.querySelector('svg.main-svg') as SVGElement | null
  if (!svgNode) {
    throw new Error('No Plotly SVG found for fallback export')
  }

  const serialized = new XMLSerializer().serializeToString(svgNode)

  if (format === 'svg') {
    const svgBase64 = btoa(unescape(encodeURIComponent(serialized)))
    return `data:image/svg+xml;base64,${svgBase64}`
  }

  const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })
  const svgUrl = URL.createObjectURL(svgBlob)

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Failed to load SVG fallback image'))
      image.src = svgUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas context unavailable for fallback export')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

/**
 * Export a Plotly chart to an image file
 *
 * @param plotElement - The Plotly chart container element
 * @param config - Export configuration
 * @returns Promise resolving to ExportResult with base64 data
 *
 * @example
 * const result = await exportPlotlyChart(plotContainer, { format: 'png', width: 1200 })
 */
export async function exportPlotlyChart(
  plotElement: HTMLElement,
  config: Partial<ExportConfig> = {}
): Promise<ExportResult> {
  const mergedConfig = { ...DEFAULT_EXPORT_CONFIG, ...config }
  const { format, width, height, scale, filename } = mergedConfig

  let imageData = ''
  let lastToImageError: unknown = null
  for (let attempt = 1; attempt <= PLOTLY_TO_IMAGE_RETRIES; attempt++) {
    try {
      imageData = await withTimeout(
        Plotly.toImage(plotElement, {
          format,
          width,
          height,
          scale,
        }),
        PLOTLY_TO_IMAGE_TIMEOUT_MS,
        `Plotly.toImage attempt ${attempt}`
      )
      break
    } catch (error) {
      lastToImageError = error
      if (attempt < PLOTLY_TO_IMAGE_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 350))
      }
    }
  }

  if (!imageData) {
    try {
      imageData = await svgFallbackImageData(plotElement, format, width, height, scale)
    } catch (fallbackError) {
      const toImageMsg =
        lastToImageError instanceof Error ? lastToImageError.message : String(lastToImageError)
      const fallbackMsg =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      throw new Error(`Plotly export failed (toImage + SVG): ${toImageMsg}; ${fallbackMsg}`)
    }
  }

  // Plotly returns data URL (data:image/png;base64,...)
  // Extract just the base64 part
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')

  const mimeType = format === 'svg' ? 'image/svg+xml' : 'image/png'
  const extension = format

  return {
    data: base64Data,
    extension,
    filename: filename || 'chart',
    mimeType,
  }
}

/**
 * Export a Plotly chart and trigger browser download
 *
 * @param plotElement - The Plotly chart container element
 * @param config - Export configuration
 */
export async function downloadPlotlyChart(
  plotElement: HTMLElement,
  config: Partial<ExportConfig> = {}
): Promise<void> {
  const mergedConfig = { ...DEFAULT_EXPORT_CONFIG, ...config }
  const { format, width, height, scale, filename } = mergedConfig

  // Use Plotly.downloadImage for direct download
  await Plotly.downloadImage(plotElement, {
    format,
    width,
    height,
    scale,
    filename: filename || 'chart',
  })
}

/**
 * Export a MapLibre/deck.gl map canvas to an image
 *
 * @param mapInstance - MapLibre map instance (has getCanvas() method)
 * @param config - Export configuration
 * @returns Promise resolving to ExportResult with base64 data
 *
 * @example
 * const result = await exportMapCanvas(mapInstance, { format: 'png' })
 */
export async function exportMapCanvas(
  mapInstance: { getCanvas: () => HTMLCanvasElement; isStyleLoaded: () => boolean; areTilesLoaded: () => boolean; once: (event: string, callback: () => void) => void },
  config: Partial<ExportConfig> = {}
): Promise<ExportResult> {
  const mergedConfig = { ...DEFAULT_EXPORT_CONFIG, ...config }
  const { format, filename } = mergedConfig

  // Wait for map to be idle (all tiles loaded)
  await new Promise<void>(resolve => {
    if (mapInstance.isStyleLoaded() && mapInstance.areTilesLoaded()) {
      resolve()
    } else {
      mapInstance.once('idle', () => resolve())
    }
  })

  // Get the canvas element
  const canvas = mapInstance.getCanvas() as HTMLCanvasElement

  // Export as data URL
  const mimeType = format === 'svg' ? 'image/svg+xml' : 'image/png'
  const dataUrl = canvas.toDataURL(mimeType)

  // Extract base64 data
  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '')

  return {
    data: base64Data,
    extension: format === 'svg' ? 'svg' : 'png',
    filename: filename || 'map',
    mimeType,
  }
}

/**
 * Download a map canvas as an image file
 *
 * @param mapInstance - MapLibre map instance
 * @param config - Export configuration
 */
export async function downloadMapCanvas(
  mapInstance: { getCanvas: () => HTMLCanvasElement; isStyleLoaded: () => boolean; areTilesLoaded: () => boolean; once: (event: string, callback: () => void) => void },
  config: Partial<ExportConfig> = {}
): Promise<void> {
  const result = await exportMapCanvas(mapInstance, config)
  downloadBase64(result.data, `${result.filename}.${result.extension}`, result.mimeType)
}

/**
 * Export all charts in a dashboard as a ZIP file
 *
 * @param exportResults - Array of export results from individual cards
 * @param zipFilename - Name for the ZIP file (without .zip extension)
 */
export async function exportAllChartsAsZip(
  exportResults: ExportResult[],
  zipFilename: string = 'dashboard-export'
): Promise<void> {
  const zip = new JSZip()

  // Track used filenames to avoid collisions
  const usedFilenames = new Set<string>()

  exportResults.forEach(result => {
    // Generate unique filename
    let filename = `${result.filename}.${result.extension}`
    let counter = 1
    while (usedFilenames.has(filename)) {
      filename = `${result.filename}-${counter}.${result.extension}`
      counter++
    }
    usedFilenames.add(filename)

    // Add file to ZIP
    zip.file(filename, result.data, { base64: true })
  })

  // Generate ZIP blob
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  // Trigger download
  downloadBlob(blob, `${zipFilename}.zip`)
}

/**
 * Create a sanitized filename from a card title
 *
 * @param title - Card title
 * @param cardType - Card type (used as fallback)
 * @returns Sanitized filename (without extension)
 */
export function sanitizeFilename(title: string | undefined, cardType: string): string {
  if (!title) {
    return cardType
  }

  // Replace spaces with hyphens, remove special characters
  return (
    title
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || cardType
  )
}

/**
 * Download base64 data as a file
 */
function downloadBase64(base64Data: string, filename: string, mimeType: string): void {
  const link = document.createElement('a')
  link.href = `data:${mimeType};base64,${base64Data}`
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Download a Blob as a file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Clean up blob URL to prevent memory leak
  URL.revokeObjectURL(url)
}
