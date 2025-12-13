/**
 * Debug utility for InteractiveDashboard
 * Set DEBUG_INTERACTIVE_DASHBOARD = true to enable verbose logging
 */

// Check for debug mode via localStorage or URL parameter
const isDebugMode = (): boolean => {
  if (typeof window === 'undefined') return false
  
  // Check URL parameter: ?debug=interactive-dashboard
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('debug') === 'interactive-dashboard') return true
  
  // Check localStorage
  if (localStorage.getItem('DEBUG_INTERACTIVE_DASHBOARD') === 'true') return true
  
  return false
}

// Cache the debug mode check
let _debugMode: boolean | null = null

export function debugLog(...args: any[]): void {
  if (_debugMode === null) {
    _debugMode = isDebugMode()
  }
  if (_debugMode) {
    console.log(...args)
  }
}

// Force enable/disable debug mode programmatically
export function setDebugMode(enabled: boolean): void {
  _debugMode = enabled
  if (typeof window !== 'undefined') {
    if (enabled) {
      localStorage.setItem('DEBUG_INTERACTIVE_DASHBOARD', 'true')
    } else {
      localStorage.removeItem('DEBUG_INTERACTIVE_DASHBOARD')
    }
  }
}
