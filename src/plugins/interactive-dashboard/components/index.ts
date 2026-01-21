/**
 * Interactive Dashboard Components
 *
 * This module exports reusable components for the Interactive Dashboard plugin.
 */

// Card wrapper component
export { default as DashboardCard } from './DashboardCard.vue'

// Portal for fullscreen cards (CSS containment escape)
export { default as FullscreenPortal } from './FullscreenPortal.vue'

// Re-export types for convenient imports
export * from '../types/dashboardCard'
