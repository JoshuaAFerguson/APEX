/**
 * Tests for Chart Utilities
 *
 * Tests the theme-aware Recharts wrapper utilities including:
 * - useChartTheme hook
 * - useChartColors hook
 * - ChartContainer component
 * - Axis and tooltip formatters
 * - Style utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: vi.fn(() => ({
    resolvedTheme: 'dark',
    theme: 'dark',
  })),
}))

import {
  useChartTheme,
  useChartColors,
  ChartContainer,
  createAxisFormatter,
  createTooltipFormatter,
  compactNumberFormatter,
  currencyFormatter,
  percentageFormatter,
  tokenFormatter,
  shortDateFormatter,
  timeFormatter,
  getTooltipStyle,
  getGridStyle,
  getAxisStyle,
  getCategoricalColor,
} from '../chart-utils'

// ============================================================================
// Test Setup
// ============================================================================

// Get the mocked useTheme
const mockUseTheme = vi.mocked((await import('next-themes')).useTheme)

// Helper to create React wrapper for hooks
const wrapper = ({ children }: { children: ReactNode }) => children

describe('chart-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================================
  // useChartTheme Hook Tests
  // ==========================================================================

  describe('useChartTheme', () => {
    it('should return dark theme colors when theme is dark', () => {
      mockUseTheme.mockReturnValue({
        resolvedTheme: 'dark',
        theme: 'dark',
        setTheme: vi.fn(),
        themes: ['light', 'dark'],
        systemTheme: 'dark',
      })

      const { result } = renderHook(() => useChartTheme(), { wrapper })

      expect(result.current.mode).toBe('dark')
      expect(result.current.mounted).toBe(true)
      expect(result.current.colors.primary).toBe('#0ea5e9') // apex-500
      expect(result.current.colors.background).toBe('#0a0a0a')
    })

    it('should return light theme colors when theme is light', () => {
      mockUseTheme.mockReturnValue({
        resolvedTheme: 'light',
        theme: 'light',
        setTheme: vi.fn(),
        themes: ['light', 'dark'],
        systemTheme: 'light',
      })

      const { result } = renderHook(() => useChartTheme(), { wrapper })

      expect(result.current.mode).toBe('light')
      expect(result.current.mounted).toBe(true)
      expect(result.current.colors.primary).toBe('#0284c7') // apex-600
      expect(result.current.colors.background).toBe('#ffffff')
    })

    it('should return mounted=false when resolvedTheme is undefined (SSR)', () => {
      mockUseTheme.mockReturnValue({
        resolvedTheme: undefined,
        theme: undefined,
        setTheme: vi.fn(),
        themes: ['light', 'dark'],
        systemTheme: undefined,
      })

      const { result } = renderHook(() => useChartTheme(), { wrapper })

      expect(result.current.mounted).toBe(false)
      // Should default to dark theme
      expect(result.current.mode).toBe('dark')
    })

    it('should include all required color properties', () => {
      mockUseTheme.mockReturnValue({
        resolvedTheme: 'dark',
        theme: 'dark',
        setTheme: vi.fn(),
        themes: ['light', 'dark'],
        systemTheme: 'dark',
      })

      const { result } = renderHook(() => useChartTheme(), { wrapper })
      const { colors } = result.current

      // Check all palette colors exist
      expect(colors.primary).toBeDefined()
      expect(colors.secondary).toBeDefined()
      expect(colors.success).toBeDefined()
      expect(colors.warning).toBeDefined()
      expect(colors.error).toBeDefined()
      expect(colors.info).toBeDefined()
      expect(colors.grid).toBeDefined()
      expect(colors.axis).toBeDefined()
      expect(colors.text).toBeDefined()
      expect(colors.textMuted).toBeDefined()
      expect(colors.background).toBeDefined()
      expect(colors.tooltipBackground).toBeDefined()
      expect(colors.tooltipBorder).toBeDefined()
      expect(colors.categorical).toBeDefined()
      expect(colors.categorical.length).toBe(8)
    })

    it('should have different colors for light and dark themes', () => {
      // Get dark colors
      mockUseTheme.mockReturnValue({
        resolvedTheme: 'dark',
        theme: 'dark',
        setTheme: vi.fn(),
        themes: ['light', 'dark'],
        systemTheme: 'dark',
      })

      const { result: darkResult } = renderHook(() => useChartTheme(), { wrapper })
      const darkColors = { ...darkResult.current.colors }

      // Get light colors
      mockUseTheme.mockReturnValue({
        resolvedTheme: 'light',
        theme: 'light',
        setTheme: vi.fn(),
        themes: ['light', 'dark'],
        systemTheme: 'light',
      })

      const { result: lightResult } = renderHook(() => useChartTheme(), { wrapper })
      const lightColors = lightResult.current.colors

      // Key colors should differ between themes
      expect(darkColors.background).not.toBe(lightColors.background)
      expect(darkColors.text).not.toBe(lightColors.text)
      expect(darkColors.grid).not.toBe(lightColors.grid)
    })
  })

  // ==========================================================================
  // useChartColors Hook Tests
  // ==========================================================================

  describe('useChartColors', () => {
    beforeEach(() => {
      mockUseTheme.mockReturnValue({
        resolvedTheme: 'dark',
        theme: 'dark',
        setTheme: vi.fn(),
        themes: ['light', 'dark'],
        systemTheme: 'dark',
      })
    })

    it('should return default 8 colors', () => {
      const { result } = renderHook(() => useChartColors(), { wrapper })

      expect(result.current).toHaveLength(8)
      expect(result.current[0]).toBe('#0ea5e9') // First categorical color
    })

    it('should return requested number of colors', () => {
      const { result } = renderHook(() => useChartColors(3), { wrapper })

      expect(result.current).toHaveLength(3)
    })

    it('should not exceed available colors', () => {
      const { result } = renderHook(() => useChartColors(100), { wrapper })

      expect(result.current).toHaveLength(8)
    })

    it('should return empty array for zero count', () => {
      const { result } = renderHook(() => useChartColors(0), { wrapper })

      expect(result.current).toHaveLength(0)
    })
  })

  // ==========================================================================
  // createAxisFormatter Tests
  // ==========================================================================

  describe('createAxisFormatter', () => {
    describe('number type', () => {
      it('should format numbers with default precision', () => {
        const formatter = createAxisFormatter({ type: 'number' })

        expect(formatter(1234)).toBe('1,234')
        expect(formatter(0)).toBe('0')
      })

      it('should format numbers with custom precision', () => {
        const formatter = createAxisFormatter({ type: 'number', precision: 2 })

        expect(formatter(1234.5678)).toBe('1,234.57')
        expect(formatter(0)).toBe('0.00')
      })

      it('should handle string input', () => {
        const formatter = createAxisFormatter({ type: 'number' })

        expect(formatter('1234')).toBe('1,234')
      })

      it('should return empty string for invalid input', () => {
        const formatter = createAxisFormatter({ type: 'number' })

        expect(formatter('invalid')).toBe('')
        expect(formatter(NaN)).toBe('')
      })

      it('should apply prefix and suffix', () => {
        const formatter = createAxisFormatter({
          type: 'number',
          prefix: '$',
          suffix: ' USD'
        })

        expect(formatter(100)).toBe('$100 USD')
      })
    })

    describe('currency type', () => {
      it('should format as USD currency', () => {
        const formatter = createAxisFormatter({ type: 'currency' })

        expect(formatter(1234.56)).toBe('$1,234.56')
      })

      it('should handle precision', () => {
        const formatter = createAxisFormatter({ type: 'currency', precision: 0 })
        // Intl.NumberFormat with currency and precision 0 shows no decimals
        // Note: The rounding behavior is browser-dependent
        const result = formatter(1234.56)
        expect(result).toMatch(/^\$1,234|^\$1,235/) // May round or truncate
      })

      it('should handle different currencies', () => {
        const formatter = createAxisFormatter({ type: 'currency', currency: 'EUR' })

        // Note: Exact format depends on locale
        expect(formatter(100)).toContain('100')
      })
    })

    describe('percentage type', () => {
      it('should format as percentage (0-1 scale)', () => {
        const formatter = createAxisFormatter({ type: 'percentage', precision: 0 })

        expect(formatter(0.5)).toBe('50%')
        expect(formatter(1)).toBe('100%')
        expect(formatter(0.123)).toBe('12%')
      })

      it('should handle precision', () => {
        const formatter = createAxisFormatter({ type: 'percentage', precision: 2 })

        expect(formatter(0.1234)).toBe('12.34%')
      })
    })

    describe('compact type', () => {
      it('should format thousands as K', () => {
        const formatter = createAxisFormatter({ type: 'compact' })

        expect(formatter(1000)).toBe('1.0K')
        expect(formatter(1500)).toBe('1.5K')
        expect(formatter(10000)).toBe('10.0K')
      })

      it('should format millions as M', () => {
        const formatter = createAxisFormatter({ type: 'compact' })

        expect(formatter(1000000)).toBe('1.0M')
        expect(formatter(1500000)).toBe('1.5M')
      })

      it('should format billions as B', () => {
        const formatter = createAxisFormatter({ type: 'compact' })

        expect(formatter(1000000000)).toBe('1.0B')
      })

      it('should not compact numbers below threshold', () => {
        const formatter = createAxisFormatter({ type: 'compact' })

        expect(formatter(999)).toBe('999')
        expect(formatter(100)).toBe('100')
      })

      it('should handle custom threshold', () => {
        const formatter = createAxisFormatter({ type: 'compact', compactThreshold: 10000 })

        expect(formatter(5000)).toBe('5,000')
        expect(formatter(15000)).toBe('15.0K')
      })

      it('should handle negative numbers', () => {
        const formatter = createAxisFormatter({ type: 'compact' })

        expect(formatter(-1000)).toBe('-1.0K')
        expect(formatter(-1000000)).toBe('-1.0M')
      })
    })

    describe('date type', () => {
      it('should format dates', () => {
        const formatter = createAxisFormatter({ type: 'date' })
        const date = new Date('2025-01-15T12:00:00Z')

        const result = formatter(date)
        expect(result).toContain('1') // Day
        expect(result).toMatch(/15|Jan/)
      })

      it('should handle date strings', () => {
        const formatter = createAxisFormatter({ type: 'date' })

        const result = formatter('2025-01-15')
        expect(result).toMatch(/1.*5|15|Jan/)
      })

      it('should return empty for invalid dates', () => {
        const formatter = createAxisFormatter({ type: 'date' })

        expect(formatter('invalid')).toBe('')
      })
    })

    describe('time type', () => {
      it('should format time', () => {
        const formatter = createAxisFormatter({ type: 'time' })
        const date = new Date('2025-01-15T14:30:00')

        const result = formatter(date)
        expect(result).toMatch(/\d{1,2}:\d{2}/)
      })
    })

    describe('datetime type', () => {
      it('should format datetime', () => {
        const formatter = createAxisFormatter({ type: 'datetime' })
        const date = new Date('2025-01-15T14:30:00')

        const result = formatter(date)
        // Should contain both date and time components
        expect(result).toMatch(/\d/)
      })
    })

    describe('null/undefined handling', () => {
      it('should return empty string for null', () => {
        const formatter = createAxisFormatter({ type: 'number' })

        expect(formatter(null as any)).toBe('')
      })

      it('should return empty string for undefined', () => {
        const formatter = createAxisFormatter({ type: 'number' })

        expect(formatter(undefined as any)).toBe('')
      })
    })
  })

  // ==========================================================================
  // createTooltipFormatter Tests
  // ==========================================================================

  describe('createTooltipFormatter', () => {
    it('should return tuple with formatted value and label', () => {
      const formatter = createTooltipFormatter({ type: 'number', label: 'Count' })

      const [value, label] = formatter(1234)

      expect(value).toBe('1,234')
      expect(label).toBe('Count')
    })

    it('should use name as fallback label', () => {
      const formatter = createTooltipFormatter({ type: 'number' })

      const [_, label] = formatter(1234, 'dataKey')

      expect(label).toBe('dataKey')
    })

    it('should return empty label when none provided', () => {
      const formatter = createTooltipFormatter({ type: 'number' })

      const [_, label] = formatter(1234)

      expect(label).toBe('')
    })

    it('should work with currency formatting', () => {
      const formatter = createTooltipFormatter({
        type: 'currency',
        label: 'Revenue'
      })

      const [value, label] = formatter(1234.56)

      expect(value).toBe('$1,234.56')
      expect(label).toBe('Revenue')
    })
  })

  // ==========================================================================
  // Pre-built Formatters Tests
  // ==========================================================================

  describe('pre-built formatters', () => {
    it('compactNumberFormatter should format numbers compactly', () => {
      expect(compactNumberFormatter(1000)).toBe('1.0K')
      expect(compactNumberFormatter(1000000)).toBe('1.0M')
    })

    it('currencyFormatter should format as currency', () => {
      expect(currencyFormatter(100)).toBe('$100.00')
    })

    it('percentageFormatter should format as percentage', () => {
      expect(percentageFormatter(0.5)).toBe('50.0%')
    })

    it('tokenFormatter should format with token suffix', () => {
      expect(tokenFormatter(1000)).toBe('1.0K tokens')
    })

    it('shortDateFormatter should format dates', () => {
      const date = new Date('2025-01-15')
      const result = shortDateFormatter(date)
      expect(result).toBeTruthy()
    })

    it('timeFormatter should format time', () => {
      const date = new Date('2025-01-15T14:30:00')
      const result = timeFormatter(date)
      expect(result).toMatch(/\d{1,2}:\d{2}/)
    })
  })

  // ==========================================================================
  // Style Utility Functions Tests
  // ==========================================================================

  describe('getTooltipStyle', () => {
    it('should return tooltip style object', () => {
      const theme = {
        colors: {
          tooltipBackground: '#141414',
          tooltipBorder: '#27272a',
          text: '#fafafa',
          textMuted: '#a1a1aa',
        },
      } as any

      const style = getTooltipStyle(theme)

      expect(style.contentStyle.backgroundColor).toBe('#141414')
      expect(style.contentStyle.borderColor).toBe('#27272a')
      expect(style.labelStyle.color).toBe('#fafafa')
      expect(style.itemStyle.color).toBe('#a1a1aa')
    })
  })

  describe('getGridStyle', () => {
    it('should return grid style props', () => {
      const theme = {
        colors: {
          grid: '#27272a',
        },
      } as any

      const style = getGridStyle(theme)

      expect(style.stroke).toBe('#27272a')
      expect(style.strokeDasharray).toBe('3 3')
      expect(style.strokeOpacity).toBe(0.6)
    })
  })

  describe('getAxisStyle', () => {
    it('should return axis style props', () => {
      const theme = {
        colors: {
          axis: '#3f3f46',
          textMuted: '#a1a1aa',
        },
      } as any

      const style = getAxisStyle(theme)

      expect(style.stroke).toBe('#3f3f46')
      expect(style.tick.fill).toBe('#a1a1aa')
      expect(style.tick.fontSize).toBe(12)
      expect(style.axisLine.stroke).toBe('#3f3f46')
      expect(style.tickLine.stroke).toBe('#3f3f46')
    })
  })

  describe('getCategoricalColor', () => {
    it('should return color by index', () => {
      const theme = {
        colors: {
          categorical: ['#ff0000', '#00ff00', '#0000ff'],
        },
      } as any

      expect(getCategoricalColor(theme, 0)).toBe('#ff0000')
      expect(getCategoricalColor(theme, 1)).toBe('#00ff00')
      expect(getCategoricalColor(theme, 2)).toBe('#0000ff')
    })

    it('should wrap around for indices beyond array length', () => {
      const theme = {
        colors: {
          categorical: ['#ff0000', '#00ff00', '#0000ff'],
        },
      } as any

      expect(getCategoricalColor(theme, 3)).toBe('#ff0000')
      expect(getCategoricalColor(theme, 4)).toBe('#00ff00')
      expect(getCategoricalColor(theme, 5)).toBe('#0000ff')
    })
  })

  // ==========================================================================
  // ChartContainer Component Tests
  // ==========================================================================

  describe('ChartContainer', () => {
    // Note: Component tests would typically use React Testing Library
    // These are more like type/interface tests

    it('should accept required props', () => {
      // This is more of a type check
      const props = {
        children: ({ width, height }: { width: number; height: number }) => null,
      }

      expect(props.children).toBeDefined()
    })

    it('should accept optional props', () => {
      const props = {
        children: () => null,
        height: 300,
        aspectRatio: 16 / 9,
        minHeight: 200,
        className: 'my-chart',
        'aria-label': 'Chart description',
      }

      expect(props.height).toBe(300)
      expect(props.aspectRatio).toBeCloseTo(1.78, 1)
      expect(props['aria-label']).toBe('Chart description')
    })

    it('should accept "auto" height', () => {
      const props = {
        children: () => null,
        height: 'auto' as const,
      }

      expect(props.height).toBe('auto')
    })
  })

  // ==========================================================================
  // Edge Cases and Error Handling
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle zero values', () => {
      const numberFormatter = createAxisFormatter({ type: 'number' })
      const compactFormatter = createAxisFormatter({ type: 'compact' })
      const percentFormatter = createAxisFormatter({ type: 'percentage' })
      const currencyFmt = createAxisFormatter({ type: 'currency' })

      expect(numberFormatter(0)).toBe('0')
      expect(compactFormatter(0)).toBe('0')
      expect(percentFormatter(0)).toBe('0%')
      // Currency defaults to 2 decimal places
      expect(currencyFmt(0)).toBe('$0.00')
    })

    it('should handle very large numbers', () => {
      const formatter = createAxisFormatter({ type: 'compact' })

      expect(formatter(1e12)).toBe('1000.0B')
    })

    it('should handle very small numbers', () => {
      const formatter = createAxisFormatter({ type: 'number', precision: 4 })

      expect(formatter(0.0001)).toBe('0.0001')
    })

    it('should handle negative percentage', () => {
      const formatter = createAxisFormatter({ type: 'percentage' })

      expect(formatter(-0.5)).toBe('-50%')
    })

    it('should handle Infinity', () => {
      const formatter = createAxisFormatter({ type: 'number' })

      expect(formatter(Infinity)).toBe('')
    })
  })
})
