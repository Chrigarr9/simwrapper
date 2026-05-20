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

  // Stub APIs that Plotly expects but jsdom doesn't have.
  //
  // Canvas getContext: Plotly uses `ctx.measureText(str).width` to size
  // legends, axis tick labels, and annotations. jsdom returns null for
  // getContext, which previously caused Plotly to fall back to a tiny
  // default character width (~6px) and clip multi-word legend entries
  // ("service_rate") to single-letter fragments. We return a minimal mock
  // context whose measureText approximates Arial glyph widths well enough
  // for layout purposes (length × 0.55 × fontSize, matching ~1100u/em).
  ;(window as any).HTMLCanvasElement.prototype.getContext = function (kind: string) {
    if (kind !== '2d') return null
    let _font = '14px Arial'
    return {
      get font() { return _font },
      set font(v: string) { _font = v },
      measureText(text: string) {
        const m = /(\d+(?:\.\d+)?)px/.exec(_font)
        const fontSize = m ? parseFloat(m[1]) : 14
        return { width: (text?.length ?? 0) * fontSize * 0.55 }
      },
      // No-op drawing methods so Plotly can call them without crashing
      save() {}, restore() {}, scale() {}, translate() {}, rotate() {},
      beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, fill() {}, stroke() {},
      fillRect() {}, clearRect() {}, fillText() {}, strokeText() {},
      setTransform() {}, transform() {}, drawImage() {},
      getImageData() { return { data: new Uint8ClampedArray(4), width: 1, height: 1 } },
      putImageData() {},
      createLinearGradient() { return { addColorStop() {} } },
      createRadialGradient() { return { addColorStop() {} } },
      arc() {}, ellipse() {}, rect() {}, clip() {},
      lineWidth: 1, fillStyle: '#000', strokeStyle: '#000',
      textAlign: 'start', textBaseline: 'alphabetic', globalAlpha: 1,
    }
  }
  ;(window as any).URL.createObjectURL = () => ''
  // jsdom doesn't implement SVG path geometry; Plotly calls these when drawing
  // annotation arrows (showarrow: true). Safe no-op stubs prevent crashes — the
  // headless renderer doesn't need pixel-perfect arrow coordinates.
  ;(window as any).SVGElement.prototype.getTotalLength = () => 0
  ;(window as any).SVGElement.prototype.getPointAtLength = () => ({ x: 0, y: 0 })

  // jsdom returns 0 (or `undefined`) for SVG text-measurement APIs, which
  // makes Plotly's auto-layout think every legend entry / axis label is one
  // character wide → it then over-truncates trace names ("service_rate" → "s")
  // and overlaps legend entries. We patch SVGElement.prototype (in jsdom, text
  // elements inherit directly from SVGElement, not SVGGraphicsElement or
  // SVGTextContentElement, both of which are absent from the prototype chain).
  // Width approximation: length × 0.55 × fontSize matches Arial proportions
  // well enough that legends, axis ticks, and annotations render at correct
  // width. Falls back to font-size 14 when neither attr nor CSS is set.
  function approxFontSize(el: any): number {
    const attr = el.getAttribute?.('font-size')
    if (attr) {
      const n = parseFloat(attr)
      if (Number.isFinite(n)) return n
    }
    const styleSize = el.style?.fontSize
    if (styleSize) {
      const n = parseFloat(styleSize)
      if (Number.isFinite(n)) return n
    }
    return 14
  }
  function approxBBox(el: any) {
    const text = el.textContent ?? ''
    const fontSize = approxFontSize(el)
    return {
      x: 0,
      y: 0,
      width: text.length * fontSize * 0.55,
      height: fontSize * 1.2,
      top: 0,
      left: 0,
      right: text.length * fontSize * 0.55,
      bottom: fontSize * 1.2,
    }
  }
  ;(window as any).SVGElement.prototype.getBBox = function () {
    return approxBBox(this)
  }
  ;(window as any).SVGElement.prototype.getComputedTextLength = function () {
    const text = (this as any).textContent ?? ''
    const fontSize = approxFontSize(this)
    return text.length * fontSize * 0.55
  }
  // getBoundingClientRect: Plotly's legend / annotation sizing path uses this
  // (not getBBox or canvas measureText). Patch only on SVGElement so non-SVG
  // elements (e.g. the wrapping div) keep jsdom's zero-default behavior —
  // that worked correctly for plot-area layout before this stub was added.
  // Restrict approximation to TEXT elements; non-text SVG elements get
  // zero-bbox so Plotly doesn't double-count them in margin calculations.
  ;(window as any).SVGElement.prototype.getBoundingClientRect = function () {
    const tag = (this as any).tagName
    if (tag === 'text' || tag === 'tspan') return approxBBox(this)
    return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }
  }

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
