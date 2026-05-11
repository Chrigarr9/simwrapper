import { JSDOM } from 'jsdom'
import { Resvg } from '@resvg/resvg-js'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import type { PlotlyFigure, ExportResult } from '../types'

const require = createRequire(import.meta.url)

let plotlyJsSource: string | null = null

function getPlotlySource(): string {
  if (!plotlyJsSource) {
    plotlyJsSource = readFileSync(require.resolve('plotly.js-dist/plotly.js'), 'utf-8')
  }
  return plotlyJsSource
}

/**
 * Render a PlotlyFigure to SVG string using jsdom.
 */
export async function renderToSVG(
  figure: PlotlyFigure,
  width: number,
  height: number,
  scale: number
): Promise<string> {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="plot"></div></body></html>', {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  })
  const { window } = dom

  // Stub APIs that Plotly expects but jsdom doesn't have
  ;(window as any).HTMLCanvasElement.prototype.getContext = () => null
  ;(window as any).URL.createObjectURL = () => ''
  // jsdom doesn't implement SVG path geometry; Plotly calls these when drawing
  // annotation arrows (showarrow: true). Safe no-op stubs prevent crashes — the
  // headless renderer doesn't need pixel-perfect arrow coordinates.
  ;(window as any).SVGElement.prototype.getTotalLength = () => 0
  ;(window as any).SVGElement.prototype.getPointAtLength = () => ({ x: 0, y: 0 })

  // Load plotly.js into jsdom
  window.eval(getPlotlySource())

  const plotDiv = window.document.getElementById('plot')!

  // Render the figure
  await (window as any).Plotly.newPlot(plotDiv, figure.traces, {
    ...figure.layout,
    width: width * scale,
    height: height * scale,
  }, { staticPlot: true, ...figure.config })

  // Export to SVG
  const svgData = await (window as any).Plotly.toImage(plotDiv, {
    format: 'svg',
    width: width * scale,
    height: height * scale,
  })

  // Clean up
  dom.window.close()

  // Strip data URL prefix
  const svgString = svgData.replace(/^data:image\/svg\+xml,/, '')
  return decodeURIComponent(svgString)
}

/**
 * Render a PlotlyFigure to PNG buffer via SVG → resvg.
 * If resvg panics (e.g. degenerate zero-height geometry from a constant-value
 * column), returns a small placeholder error tile so the export run can continue.
 */
export async function renderToPNG(
  figure: PlotlyFigure,
  width: number,
  height: number,
  scale: number,
  filename?: string
): Promise<Buffer> {
  const svg = await renderToSVG(figure, width, height, scale)
  try {
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width' as const, value: width * scale },
    })
    const rendered = resvg.render()
    return Buffer.from(rendered.asPng())
  } catch (err) {
    const label = filename ?? 'unknown'
    const msg = (err instanceof Error ? err.message : String(err)).slice(0, 100)
    console.warn(`[chartRenderer] resvg failed for "${label}": ${msg}`)
    return renderErrorPlaceholder(label, msg)
  }
}

/**
 * Returns a small PNG tile indicating render failure.
 * Uses sharp (already a dependency via mapRenderer) to rasterize a plain SVG.
 */
async function renderErrorPlaceholder(filename: string, message: string): Promise<Buffer> {
  function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }
  const errSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120">
    <rect width="400" height="120" fill="#fff0f0" stroke="#cc3333" stroke-width="2"/>
    <text x="12" y="28" font-family="monospace" font-size="13" fill="#cc3333" font-weight="bold">Render failed</text>
    <text x="12" y="52" font-family="monospace" font-size="11" fill="#444444">${esc(filename)}</text>
    <text x="12" y="76" font-family="monospace" font-size="10" fill="#666666">${esc(message)}</text>
  </svg>`
  const sharp = (await import('sharp')).default
  return sharp(Buffer.from(errSvg)).png().toBuffer()
}

/**
 * Render a PlotlyFigure to the requested format.
 */
export async function renderChart(
  figure: PlotlyFigure,
  filename: string,
  format: 'png' | 'svg',
  width: number,
  height: number,
  scale: number
): Promise<ExportResult> {
  if (format === 'svg') {
    const svg = await renderToSVG(figure, width, height, scale)
    return { filename, format: 'svg', data: Buffer.from(svg, 'utf-8') }
  }

  const png = await renderToPNG(figure, width, height, scale, filename)
  return { filename, format: 'png', data: png }
}
