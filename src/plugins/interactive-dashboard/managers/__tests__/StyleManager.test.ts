import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { StyleManager, initializeTheme } from '../StyleManager'

// Mock the Vuex store
vi.mock('@/store', () => ({
  default: {
    state: {
      colorScheme: 'dark',
    },
    watch: vi.fn(() => vi.fn()), // Returns unsubscribe function
  },
}))

// Mock DOM for CSS injection
const mockStyleElement = {
  id: '',
  textContent: '',
  parentNode: {
    removeChild: vi.fn(),
  },
}

describe('StyleManager', () => {
  let styleManager: StyleManager

  beforeEach(() => {
    // Reset singleton for each test
    ;(StyleManager as any).instance = null

    // Mock document.createElement and document.head
    vi.spyOn(document, 'createElement').mockReturnValue(mockStyleElement as any)
    vi.spyOn(document.head, 'appendChild').mockImplementation(() => mockStyleElement as any)

    // Get fresh instance
    styleManager = StyleManager.getInstance()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Singleton pattern', () => {
    test('returns same instance on multiple calls', () => {
      const instance1 = StyleManager.getInstance()
      const instance2 = StyleManager.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('getColor', () => {
    test('returns theme background colors for dark mode', () => {
      expect(styleManager.getColor('theme.background.primary')).toBe('#1e293b')
      expect(styleManager.getColor('theme.background.secondary')).toBe('#334155')
      expect(styleManager.getColor('theme.background.tertiary')).toBe('#475569')
    })

    test('returns theme background colors for light mode', () => {
      styleManager.setMode('light')
      expect(styleManager.getColor('theme.background.primary')).toBe('#ffffff')
      expect(styleManager.getColor('theme.background.secondary')).toBe('#f8f9fa')
      expect(styleManager.getColor('theme.background.tertiary')).toBe('#f1f5f9')
    })

    test('returns theme text colors', () => {
      // Dark mode
      expect(styleManager.getColor('theme.text.primary')).toBe('#e2e8f0')
      expect(styleManager.getColor('theme.text.secondary')).toBe('#94a3b8')

      // Light mode
      styleManager.setMode('light')
      expect(styleManager.getColor('theme.text.primary')).toBe('#374151')
      expect(styleManager.getColor('theme.text.secondary')).toBe('#6b7280')
    })

    test('returns theme border colors', () => {
      // Dark mode
      expect(styleManager.getColor('theme.border.default')).toBe('#475569')
      expect(styleManager.getColor('theme.border.subtle')).toBe('#334155')

      // Light mode
      styleManager.setMode('light')
      expect(styleManager.getColor('theme.border.default')).toBe('#e5e7eb')
      expect(styleManager.getColor('theme.border.subtle')).toBe('#f3f4f6')
    })

    test('returns interaction colors (constant across modes)', () => {
      expect(styleManager.getColor('interaction.hover')).toBe('#fbbf24')
      expect(styleManager.getColor('interaction.selected')).toBe('#3b82f6')

      styleManager.setMode('light')
      expect(styleManager.getColor('interaction.hover')).toBe('#fbbf24')
      expect(styleManager.getColor('interaction.selected')).toBe('#3b82f6')
    })

    test('returns cluster colors', () => {
      expect(styleManager.getColor('cluster.origin')).toBe('#2563eb')
      expect(styleManager.getColor('cluster.destination')).toBe('#dc2626')
    })

    test('returns chart colors', () => {
      // Dark mode
      expect(styleManager.getColor('chart.bar.default')).toBe('#60a5fa')
      expect(styleManager.getColor('chart.bar.selected')).toBe('#f87171')
      expect(styleManager.getColor('chart.grid')).toBe('#334155')

      // Light mode
      styleManager.setMode('light')
      expect(styleManager.getColor('chart.bar.default')).toBe('#3b82f6')
      expect(styleManager.getColor('chart.bar.selected')).toBe('#ef4444')
      expect(styleManager.getColor('chart.grid')).toBe('#e5e7eb')
    })

    test('returns categorical colors by index', () => {
      expect(styleManager.getColor('categorical.0')).toBe('#3498db')
      expect(styleManager.getColor('categorical.1')).toBe('#e74c3c')
      expect(styleManager.getColor('categorical.14')).toBe('#7f8c8d')
      // Wraps around
      expect(styleManager.getColor('categorical.15')).toBe('#3498db')
    })

    test('returns mode colors', () => {
      expect(styleManager.getColor('mode.car')).toBe('#e74c3c')
      expect(styleManager.getColor('mode.pt')).toBe('#3498db')
      expect(styleManager.getColor('mode.bike')).toBe('#2ecc71')
      expect(styleManager.getColor('mode.unknown')).toBe('#95a5a6') // default
    })

    test('returns activity colors', () => {
      expect(styleManager.getColor('activity.home')).toBe('#4477ff')
      expect(styleManager.getColor('activity.work')).toBe('#ff4477')
      expect(styleManager.getColor('activity.unknown')).toBe('#777777') // other
    })

    test('returns fallback for unknown paths', () => {
      expect(styleManager.getColor('unknown.path')).toBe('#808080')
    })
  })

  describe('getColorRGBA', () => {
    test('converts hex to RGBA array', () => {
      const rgba = styleManager.getColorRGBA('interaction.hover')
      expect(rgba).toEqual([251, 191, 36, 255])
    })

    test('applies custom alpha', () => {
      const rgba = styleManager.getColorRGBA('interaction.hover', 200)
      expect(rgba).toEqual([251, 191, 36, 200])
    })
  })

  describe('getDimmedColorRGBA', () => {
    test('returns color with dimmed alpha', () => {
      const rgba = styleManager.getDimmedColorRGBA('interaction.selected')
      // Alpha should be ~77 (0.3 opacity)
      expect(rgba[3]).toBe(77)
    })
  })

  describe('setClusterColors', () => {
    test('overrides cluster colors', () => {
      styleManager.setClusterColors({ origin: '#00ff00' })
      expect(styleManager.getColor('cluster.origin')).toBe('#00ff00')
      expect(styleManager.getColor('cluster.destination')).toBe('#dc2626') // unchanged
    })

    test('resets cluster colors', () => {
      styleManager.setClusterColors({ origin: '#00ff00' })
      styleManager.resetClusterColors()
      expect(styleManager.getColor('cluster.origin')).toBe('#2563eb')
    })
  })

  describe('getCategoricalColor', () => {
    test('returns categorical colors by index', () => {
      expect(styleManager.getCategoricalColor(0)).toBe('#3498db')
      expect(styleManager.getCategoricalColor(1)).toBe('#e74c3c')
    })

    test('wraps around for large indices', () => {
      expect(styleManager.getCategoricalColor(15)).toBe('#3498db')
      expect(styleManager.getCategoricalColor(16)).toBe('#e74c3c')
    })
  })

  describe('getCategoricalColorRGBA', () => {
    test('returns categorical color as RGBA', () => {
      const rgba = styleManager.getCategoricalColorRGBA(0)
      expect(rgba).toEqual([52, 152, 219, 255])
    })

    test('applies custom alpha', () => {
      const rgba = styleManager.getCategoricalColorRGBA(0, 128)
      expect(rgba).toEqual([52, 152, 219, 128])
    })
  })

  describe('setMode', () => {
    test('switches theme mode', () => {
      expect(styleManager.getMode()).toBe('dark')

      styleManager.setMode('light')
      expect(styleManager.getMode()).toBe('light')

      styleManager.setMode('dark')
      expect(styleManager.getMode()).toBe('dark')
    })
  })

  describe('initialize', () => {
    test('initializeTheme convenience function works', () => {
      ;(StyleManager as any).instance = null
      expect(() => initializeTheme()).not.toThrow()
    })
  })
})
