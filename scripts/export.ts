#!/usr/bin/env tsx
/**
 * Headless export script for SimWrapper dashboards.
 *
 * Usage:
 *   npm run export -- path/to/export-config.yaml
 *   npm run export -- path/to/export-config.yaml --output ./figures
 *   npm run export -- path/to/export-config.yaml --root projectSlug --subfolder path/to/data
 *   npm run export -- path/to/export-config.yaml --dpr 2
 *
 * This script:
 * 1. Starts a Vite dev server
 * 2. Launches headless Chromium via Playwright
 * 3. Navigates to the export route with the config
 * 4. Waits for export completion
 * 5. Saves the ZIP file to the output directory
 */

import { chromium } from 'playwright'
import { createServer } from 'vite'
import { resolve, dirname, basename, join } from 'path'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import JSZip from 'jszip'

type ExportItem = {
  data: string
  extension: string
  filename: string
}

async function extractZipBuffer(zipBuffer: Buffer, outputDir: string, zipName: string): Promise<string> {
  const zip = await JSZip.loadAsync(zipBuffer)
  const extractFolder = resolve(outputDir, zipName.replace(/\.zip$/i, ''))
  if (!existsSync(extractFolder)) mkdirSync(extractFolder, { recursive: true })

  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) {
      mkdirSync(join(extractFolder, relativePath), { recursive: true })
      continue
    }

    const safePath = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
    if (safePath.includes('..')) {
      console.warn(`[export] Skipping unsafe zip entry: ${relativePath}`)
      continue
    }

    const fullPath = join(extractFolder, safePath)
    const parentDir = dirname(fullPath)
    if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true })

    const content = await zipEntry.async('nodebuffer')
    writeFileSync(fullPath, content)
  }

  return extractFolder
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0 || args[0] === '--help') {
    console.log(
      'Usage: npm run export -- <config.yaml> [--output <dir>] [--root <slug>] [--subfolder <path>]'
    )
    process.exit(0)
  }

  const configPath = resolve(args[0])
  if (!existsSync(configPath)) {
    console.error(`Error: Config file not found: ${configPath}`)
    process.exit(1)
  }

  // Parse optional args
  let outputDir = resolve(dirname(configPath), 'export')
  let root = ''
  let subfolder = ''
  let deviceScaleFactor = 2
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      outputDir = resolve(args[++i])
      continue
    }
    if (args[i] === '--root' && args[i + 1]) {
      root = args[++i]
      continue
    }
    if (args[i] === '--subfolder' && args[i + 1]) {
      subfolder = args[++i]
      continue
    }
    if (args[i] === '--dpr' && args[i + 1]) {
      const parsed = Number(args[++i])
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --dpr value: ${args[i]}`)
      }
      deviceScaleFactor = parsed
      continue
    }
  }

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

  console.log(`[export] Config: ${configPath}`)
  console.log(`[export] Output: ${outputDir}`)
  console.log(`[export] DPR: ${deviceScaleFactor}`)

  // Start Vite dev server
  console.log('[export] Starting dev server...')
  const server = await createServer({
    configFile: resolve(__dirname, '..', 'vite.config.mts'),
    server: { port: 0 }, // Auto-select available port
  })
  await server.listen()
  const address = server.httpServer?.address()
  const port = typeof address === 'object' && address ? address.port : 8080
  const baseUrl = `http://localhost:${port}`
  console.log(`[export] Dev server running at ${baseUrl}`)

  // Launch headless browser
  console.log('[export] Launching browser...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor,
  })
  const page = await context.newPage()

  page.on('console', msg => {
    const type = msg.type()
    const text = msg.text()
    if (type === 'error' || text.includes('Error') || text.includes('error')) {
      console.log(`[page:${type}] ${text}`)
    }
  })

  page.on('pageerror', err => {
    console.log(`[pageerror] ${err.message}`)
  })

  page.on('requestfailed', req => {
    console.log(`[requestfailed] ${req.method()} ${req.url()} :: ${req.failure()?.errorText || 'unknown'}`)
  })

  // Navigate to export route
  const configName = basename(configPath)
  const params = new URLSearchParams({
    config: configName,
    ...(root && { root }),
    ...(subfolder && { subfolder }),
  })
  const exportUrl = `${baseUrl}/export?${params.toString()}`
  console.log(`[export] Navigating to ${exportUrl}`)
  await page.goto(exportUrl, { waitUntil: 'networkidle' })

  // Wait for export to complete, then trigger ZIP download.
  console.log('[export] Waiting for export to complete...')
  try {
    await page.waitForFunction('window.__exportComplete === true', undefined, { timeout: 300000 })
  } catch (error) {
    const timeoutDiagnostics = await page.evaluate(() => {
      const bodyText = document?.body?.innerText || ''
      return {
        location: window.location.href,
        title: document.title,
        exportComplete: (window as any).__exportComplete,
        exportSummary: (window as any).__exportSummary || null,
        exportResultsLength: Array.isArray((window as any).__exportResults)
          ? (window as any).__exportResults.length
          : null,
        bodySnippet: bodyText.slice(0, 1200),
      }
    })
    console.log('[export] Timeout diagnostics:', timeoutDiagnostics)
    throw error
  }

  const inPageResults = (await page.evaluate(() => (window as any).__exportResults || null)) as ExportItem[] | null
  const debugInfo = await page.evaluate(() => ({
    exportComplete: (window as any).__exportComplete,
    exportResultsType: typeof (window as any).__exportResults,
    exportResultsLength: Array.isArray((window as any).__exportResults)
      ? (window as any).__exportResults.length
      : null,
    exportSummary: (window as any).__exportSummary || null,
  }))
  console.log('[export] Debug markers:', JSON.stringify(debugInfo, null, 2))

  const downloadButton = page.locator('button.btn-download')
  const buttonCount = await downloadButton.count()
  if (buttonCount === 0) {
    throw new Error('Export completed but Download ZIP button was not found.')
  }

  const downloadPromise = page.waitForEvent('download', { timeout: 120000 })
  await downloadButton.first().click()

  try {
    const download = await downloadPromise
    const suggestedName = download.suggestedFilename()
    const downloadPath = resolve(outputDir, suggestedName)
    await download.saveAs(downloadPath)
    console.log(`[export] Downloaded: ${downloadPath}`)

    const downloadedZipBuffer = readFileSync(downloadPath)
    const extractedDir = await extractZipBuffer(downloadedZipBuffer, outputDir, suggestedName)
    console.log(`[export] Extracted to: ${extractedDir}`)
  } catch {
    console.log('[export] No browser download event intercepted, using in-page export fallback...')

    const exportItems = inPageResults
    if (!exportItems || exportItems.length === 0) {
      const summary = await page.evaluate(() => (window as any).__exportSummary || null)
      throw new Error(
        `Export completed but produced 0 files. Summary: ${JSON.stringify(summary)}`
      )
    }

    const zip = new JSZip()
    const usedFilenames = new Set<string>()
    for (const item of exportItems) {
      let filename = `${item.filename}.${item.extension}`
      let counter = 1
      while (usedFilenames.has(filename)) {
        filename = `${item.filename}-${counter}.${item.extension}`
        counter += 1
      }
      usedFilenames.add(filename)
      zip.file(filename, item.data, { base64: true })
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })
    const zipPath = resolve(outputDir, 'dashboard-export.zip')
    writeFileSync(zipPath, zipBuffer)
    console.log(`[export] Saved via fallback: ${zipPath}`)

    const extractedDir = await extractZipBuffer(zipBuffer, outputDir, 'dashboard-export.zip')
    console.log(`[export] Extracted to: ${extractedDir}`)
  }

  // Cleanup
  await browser.close()
  await server.close()

  console.log('[export] Done!')
  process.exit(0)
}

main().catch(error => {
  console.error('[export] Fatal error:', error)
  process.exit(1)
})
