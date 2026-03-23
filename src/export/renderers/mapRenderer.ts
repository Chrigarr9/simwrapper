import mbgl from '@maplibre/maplibre-gl-native'
import sharp from 'sharp'
import type { MapRenderConfig, ExportResult, LegendData } from '../types'

const LEGEND_MARGIN = 24

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatLegendValue(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return ''
  if (Math.abs(value) >= 100 || Number.isInteger(value)) return String(Math.round(value))
  return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function buildLegendSvg(legend: LegendData): { svg: string; width: number; height: number } {
  const width = 320
  const title = escapeXml(legend.title)

  if (legend.type === 'categorical') {
    const items = legend.items ?? []
    const rowHeight = 28
    const height = Math.max(112, 72 + items.length * rowHeight)
    const rows = items
      .map((item, index) => {
        const y = 54 + index * rowHeight
        return [
          `<rect x="20" y="${y - 12}" width="18" height="18" rx="3" fill="${item.color}" stroke="#555" stroke-width="0.75"/>`,
          `<text x="48" y="${y + 2}" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#111">${escapeXml(item.label)}</text>`,
        ].join('')
      })
      .join('')

    return {
      width,
      height,
      svg: `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="rgba(255,255,255,0.92)" stroke="rgba(0,0,0,0.18)"/>
          <text x="20" y="32" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#111">${title}</text>
          ${rows}
        </svg>`,
    }
  }

  const minLabel = escapeXml(formatLegendValue(legend.minValue))
  const maxLabel = escapeXml(formatLegendValue(legend.maxValue))
  const minColor = legend.minColor ?? '#440154'
  const maxColor = legend.maxColor ?? '#fde725'
  const height = 164

  return {
    width,
    height,
    svg: `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <defs>
          <linearGradient id="legend-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="${minColor}"/>
            <stop offset="100%" stop-color="${maxColor}"/>
          </linearGradient>
        </defs>
        <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="rgba(255,255,255,0.92)" stroke="rgba(0,0,0,0.18)"/>
        <text x="20" y="32" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#111">${title}</text>
        <rect x="20" y="52" width="28" height="82" rx="5" fill="url(#legend-gradient)" stroke="rgba(0,0,0,0.18)"/>
        <text x="62" y="66" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#111">${maxLabel}</text>
        <text x="62" y="132" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#111">${minLabel}</text>
      </svg>`,
  }
}

async function compositeLegendOverlay(
  png: Buffer,
  pixelWidth: number,
  pixelHeight: number,
  legend: LegendData,
): Promise<Buffer> {
  const { svg, width, height } = buildLegendSvg(legend)

  return sharp(png)
    .composite([
      {
        input: Buffer.from(svg),
        top: Math.max(LEGEND_MARGIN, pixelHeight - height - LEGEND_MARGIN),
        left: Math.max(LEGEND_MARGIN, pixelWidth - width - LEGEND_MARGIN),
      },
    ])
    .png()
    .toBuffer()
}

/**
 * Fetch a remote resource (tile, sprite, glyph) for maplibre-gl-native.
 */
async function fetchResource(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

/**
 * Render a map to PNG using maplibre-gl-native.
 */
export async function renderMap(
  config: MapRenderConfig,
  filename: string
): Promise<ExportResult> {
  const { width, height, scale, center, zoom, styleUrl, sources, layers, legend } = config

  const pixelWidth = Math.round(width * scale)
  const pixelHeight = Math.round(height * scale)

  // Load the base style
  const styleResponse = await fetch(styleUrl)
  const style = await styleResponse.json()

  // Add GeoJSON sources
  for (const [name, source] of Object.entries(sources)) {
    style.sources[name] = source
  }

  // Add data layers
  style.layers.push(...layers)

  return new Promise<ExportResult>((resolve, reject) => {
    const map = new mbgl.Map({
      request: (req: { url: string; kind: number }, callback: Function) => {
        fetchResource(req.url)
          .then(data => callback(null, { data }))
          .catch(err => {
            console.warn(`[mapRenderer] Failed to fetch ${req.url}: ${err.message}`)
            callback(err)
          })
      },
      // Export scale is already baked into width/height below.
      // Applying it again via native pixel ratio causes remote-style overlays
      // to disappear in high-resolution exports.
      ratio: 1,
    })

    map.load(style)

    map.render(
      { zoom, center: [center[0], center[1]], width: pixelWidth, height: pixelHeight },
      async (err: Error | null, buffer: Buffer) => {
        map.release()

        if (err) return reject(err)

        try {
          let png = await sharp(buffer, {
            raw: { width: pixelWidth, height: pixelHeight, channels: 4 },
          })
            .png()
            .toBuffer()

          if (legend) {
            png = await compositeLegendOverlay(png, pixelWidth, pixelHeight, legend)
          }

          resolve({ filename, format: 'png', data: png })
        } catch (sharpErr) {
          reject(sharpErr)
        }
      }
    )
  })
}
