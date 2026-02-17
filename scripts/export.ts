#!/usr/bin/env tsx
/**
 * Headless export script for SimWrapper dashboards.
 *
 * Usage:
 *   npm run export -- path/to/export-config.yaml
 *   npm run export -- path/to/export-config.yaml --output ./figures
 *   npm run export -- path/to/export-config.yaml --root projectSlug --subfolder path/to/data
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
import { resolve, dirname, basename } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'

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
  }

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

  console.log(`[export] Config: ${configPath}`)
  console.log(`[export] Output: ${outputDir}`)

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
  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()

  // Set up download handler
  const downloadPromise = page.waitForEvent('download', { timeout: 300000 })

  // Navigate to export route
  const configName = basename(configPath)
  const params = new URLSearchParams({
    config: configName,
    ...(root && { root }),
    ...(subfolder && { subfolder }),
  })
  const exportUrl = `${baseUrl}/export?${params.toString()}`
  console.log(`[export] Navigating to ${exportUrl}`)
  await page.goto(exportUrl)

  // Wait for export to complete
  console.log('[export] Waiting for export to complete...')
  try {
    const download = await downloadPromise
    const downloadPath = resolve(outputDir, download.suggestedFilename())
    await download.saveAs(downloadPath)
    console.log(`[export] Downloaded: ${downloadPath}`)
  } catch {
    // Fallback: check for window.__exportComplete
    await page.waitForFunction('window.__exportComplete === true', { timeout: 300000 })
    console.log('[export] Export complete (no download intercepted)')
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
