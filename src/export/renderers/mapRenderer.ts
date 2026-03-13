import mbgl from '@maplibre/maplibre-gl-native'
import sharp from 'sharp'
import type { MapRenderConfig, ExportResult } from '../types'

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
  const { width, height, scale, center, zoom, styleUrl, sources, layers } = config

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
      ratio: scale,
    })

    map.load(style)

    map.render(
      { zoom, center: [center[0], center[1]], width: pixelWidth, height: pixelHeight },
      async (err: Error | null, buffer: Buffer) => {
        map.release()

        if (err) return reject(err)

        try {
          const png = await sharp(buffer, {
            raw: { width: pixelWidth, height: pixelHeight, channels: 4 },
          })
            .png()
            .toBuffer()

          resolve({ filename, format: 'png', data: png })
        } catch (sharpErr) {
          reject(sharpErr)
        }
      }
    )
  })
}
