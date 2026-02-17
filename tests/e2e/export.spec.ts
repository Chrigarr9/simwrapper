import { test, expect } from '@playwright/test'

test.describe('Export System', () => {
  test('export route loads and shows ExportView', async ({ page }) => {
    // Navigate to export route with test config
    await page.goto('/export?config=export-test.yaml&root=files&subfolder=test-export')

    // Wait for the export view to appear
    await expect(page.locator('.export-view')).toBeVisible({ timeout: 15000 })

    // Should show the exporting header
    await expect(page.locator('.export-header h2')).toBeVisible()
  })

  test('export route shows error for missing config', async ({ page }) => {
    // Navigate without a config param
    await page.goto('/export')

    // Should show an error about missing config
    await expect(page.locator('.error')).toBeVisible({ timeout: 10000 })
  })

  test('export route renders progress bar', async ({ page }) => {
    await page.goto('/export?config=export-test.yaml&root=files&subfolder=test-export')

    // Wait for export view to appear
    await expect(page.locator('.export-view')).toBeVisible({ timeout: 15000 })

    // Progress bar should appear once export begins processing
    await expect(page.locator('.progress-bar-container')).toBeVisible({ timeout: 30000 })
  })

  test('export completes and shows download button', async ({ page }) => {
    await page.goto('/export?config=export-test.yaml&root=files&subfolder=test-export')

    // Wait for export to fully complete
    await expect(page.locator('text=Export Complete')).toBeVisible({ timeout: 60000 })

    // Download ZIP button should be visible
    await expect(page.locator('button:has-text("Download ZIP")')).toBeVisible()

    // Close button should also be visible
    await expect(page.locator('button:has-text("Close")')).toBeVisible()
  })
})
