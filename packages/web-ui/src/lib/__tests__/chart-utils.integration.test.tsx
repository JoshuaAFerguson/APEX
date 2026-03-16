/**
 * Integration Tests for Chart Utilities
 *
 * Tests the chart-utils module in realistic scenarios with React components
 * and theme provider integration to ensure proper theme-aware behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { act } from '@testing-library/react'
import React, { type ReactNode } from 'react'

// Mock next-themes with realistic theme provider behavior
const mockSetTheme = vi.fn()
const mockThemeProvider = {
  resolvedTheme: 'light',
  theme: 'light',
  setTheme: mockSetTheme,
  themes: ['light', 'dark'],
  systemTheme: 'light',
}

vi.mock('next-themes', () => ({
  useTheme: () => mockThemeProvider,
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
}))

import {
  useChartTheme,
  useChartColors,
  ChartContainer,
  createAxisFormatter,
  createTooltipFormatter,
  getTooltipStyle,
  getGridStyle,
  getAxisStyle,
  getCategoricalColor,
} from '../chart-utils'

// ============================================================================
// Test Components
// ============================================================================

/**
 * Test component that uses the chart theme hook
 */
function ThemeAwareChart() {
  const { colors, mode, mounted } = useChartTheme()

  if (!mounted) {
    return <div data-testid="loading">Loading theme...</div>
  }

  return (
    <div data-testid="chart" data-theme={mode}>
      <div data-testid="primary-color" style={{ color: colors.primary }}>
        Primary Color
      </div>
      <div data-testid="background" style={{ backgroundColor: colors.background }}>
        Background
      </div>
      <div data-testid="text" style={{ color: colors.text }}>
        Text Color
      </div>
    </div>
  )
}

/**
 * Test component that uses chart colors hook
 */
function MultiSeriesChart({ seriesCount = 4 }: { seriesCount?: number }) {
  const colors = useChartColors(seriesCount)

  return (
    <div data-testid="multi-series-chart">
      {colors.map((color, index) => (
        <div
          key={index}
          data-testid={`series-${index}`}
          style={{ backgroundColor: color }}
        >
          Series {index + 1}
        </div>
      ))}
    </div>
  )
}

/**
 * Test component that uses ChartContainer
 */
function ResponsiveChart({
  height,
  aspectRatio,
  testId = 'chart-container',
}: {
  height?: number | 'auto'
  aspectRatio?: number
  testId?: string
}) {
  return (
    <div data-testid={testId}>
      <ChartContainer
        height={height}
        aspectRatio={aspectRatio}
        aria-label="Test chart"
      >
      {({ width, height: containerHeight }) => (
        <div data-testid="chart-content">
          Chart content {width}x{containerHeight}
        </div>
      )}
      </ChartContainer>
    </div>
  )
}

/**
 * Test component that uses formatted data
 */
function DataChart() {
  const numberFormatter = createAxisFormatter({ type: 'number', precision: 2 })
  const currencyFormatter = createAxisFormatter({ type: 'currency' })
  const percentageFormatter = createAxisFormatter({ type: 'percentage', precision: 1 })
  const compactFormatter = createAxisFormatter({ type: 'compact' })

  const sampleData = [
    { value: 1234.56, label: 'Revenue' },
    { value: 0.234, label: 'Conversion' },
    { value: 1500000, label: 'Users' },
  ]

  return (
    <div data-testid="data-chart">
      {sampleData.map((item, index) => (
        <div key={index} data-testid={`data-item-${index}`}>
          <span data-testid={`number-${index}`}>
            {numberFormatter(item.value)}
          </span>
          <span data-testid={`currency-${index}`}>
            {currencyFormatter(item.value)}
          </span>
          <span data-testid={`percentage-${index}`}>
            {percentageFormatter(item.value)}
          </span>
          <span data-testid={`compact-${index}`}>
            {compactFormatter(item.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Chart Utils Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to light theme
    mockThemeProvider.resolvedTheme = 'light'
    mockThemeProvider.theme = 'light'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================================
  // Theme Integration Tests
  // ==========================================================================

  describe('Theme Integration', () => {
    it('should render theme-aware chart with light theme', async () => {
      render(<ThemeAwareChart />)

      await waitFor(() => {
        expect(screen.getByTestId('chart')).toBeInTheDocument()
      })

      const chart = screen.getByTestId('chart')
      expect(chart).toHaveAttribute('data-theme', 'light')
      expect(screen.getByTestId('primary-color')).toBeInTheDocument()
      expect(screen.getByTestId('background')).toBeInTheDocument()
      expect(screen.getByTestId('text')).toBeInTheDocument()
    })

    it('should switch theme colors when theme changes', async () => {
      const { rerender } = render(<ThemeAwareChart />)

      // Verify light theme
      await waitFor(() => {
        expect(screen.getByTestId('chart')).toHaveAttribute('data-theme', 'light')
      })

      // Change to dark theme
      act(() => {
        mockThemeProvider.resolvedTheme = 'dark'
        mockThemeProvider.theme = 'dark'
      })

      rerender(<ThemeAwareChart />)

      await waitFor(() => {
        expect(screen.getByTestId('chart')).toHaveAttribute('data-theme', 'dark')
      })
    })

    it('should handle SSR state with loading fallback', async () => {
      // Simulate SSR state
      mockThemeProvider.resolvedTheme = undefined as any

      render(<ThemeAwareChart />)

      expect(screen.getByTestId('loading')).toBeInTheDocument()
      expect(screen.getByText('Loading theme...')).toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Chart Colors Integration Tests
  // ==========================================================================

  describe('Chart Colors Integration', () => {
    it('should render multi-series chart with correct number of colors', () => {
      render(<MultiSeriesChart seriesCount={3} />)

      expect(screen.getByTestId('multi-series-chart')).toBeInTheDocument()
      expect(screen.getByTestId('series-0')).toBeInTheDocument()
      expect(screen.getByTestId('series-1')).toBeInTheDocument()
      expect(screen.getByTestId('series-2')).toBeInTheDocument()
      expect(screen.queryByTestId('series-3')).not.toBeInTheDocument()
    })

    it('should handle maximum color count gracefully', () => {
      render(<MultiSeriesChart seriesCount={100} />)

      // Should still only render up to 8 series (the max available)
      const chart = screen.getByTestId('multi-series-chart')
      const seriesElements = Array.from(chart.children)
      expect(seriesElements).toHaveLength(8)
    })
  })

  // ==========================================================================
  // ChartContainer Integration Tests
  // ==========================================================================

  describe('ChartContainer Integration', () => {
    it('should render responsive container with children', () => {
      render(<ResponsiveChart />)

      expect(screen.getByRole('img')).toBeInTheDocument()
      expect(screen.getByLabelText('Test chart')).toBeInTheDocument()
      expect(screen.getByTestId('chart-content')).toBeInTheDocument()
    })

    it('should handle fixed height containers', () => {
      render(<ResponsiveChart height={300} />)

      const container = screen.getByRole('img')
      expect(container).toBeInTheDocument()
    })

    it('should apply custom CSS classes', () => {
      render(
        <ChartContainer className="custom-chart-class" aria-label="Custom chart">
          {() => <div>Content</div>}
        </ChartContainer>
      )

      const container = screen.getByRole('img')
      expect(container).toHaveClass('custom-chart-class')
    })
  })

  // ==========================================================================
  // Data Formatting Integration Tests
  // ==========================================================================

  describe('Data Formatting Integration', () => {
    it('should format data consistently across different types', () => {
      render(<DataChart />)

      const chart = screen.getByTestId('data-chart')
      expect(chart).toBeInTheDocument()

      // Check that all format types are present
      expect(screen.getByTestId('number-0')).toBeInTheDocument()
      expect(screen.getByTestId('currency-0')).toBeInTheDocument()
      expect(screen.getByTestId('percentage-0')).toBeInTheDocument()
      expect(screen.getByTestId('compact-0')).toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Style Utilities Integration Tests
  // ==========================================================================

  describe('Style Utilities Integration', () => {
    it('should provide consistent styling across components', () => {
      const StyledChart = () => {
        const theme = useChartTheme()
        const gridStyle = getGridStyle(theme)
        const axisStyle = getAxisStyle(theme)

        return (
          <div data-testid="styled-chart">
            <div
              data-testid="grid"
              style={{
                stroke: gridStyle.stroke,
                strokeDasharray: gridStyle.strokeDasharray,
                opacity: gridStyle.strokeOpacity,
              }}
            >
              Grid
            </div>
            <div
              data-testid="axis"
              style={{
                stroke: axisStyle.stroke,
                color: axisStyle.tick.fill,
              }}
            >
              Axis
            </div>
          </div>
        )
      }

      render(<StyledChart />)

      expect(screen.getByTestId('styled-chart')).toBeInTheDocument()
      expect(screen.getByTestId('grid')).toBeInTheDocument()
      expect(screen.getByTestId('axis')).toBeInTheDocument()
    })

    it('should handle categorical colors consistently', () => {
      const CategoricalChart = () => {
        const theme = useChartTheme()
        const colors = [0, 1, 2, 8, 9, 10].map(i => getCategoricalColor(theme, i))

        return (
          <div data-testid="categorical-chart">
            {colors.map((color, index) => (
              <div
                key={index}
                data-testid={`categorical-${index}`}
                style={{ backgroundColor: color }}
              >
                Color {index}
              </div>
            ))}
          </div>
        )
      }

      render(<CategoricalChart />)

      expect(screen.getByTestId('categorical-chart')).toBeInTheDocument()
    })
  })

  // ==========================================================================
  // End-to-End Chart Scenario
  // ==========================================================================

  describe('End-to-End Chart Scenarios', () => {
    it('should handle complete chart implementation', async () => {
      const FullChart = () => {
        const { colors, mounted } = useChartTheme()
        const chartColors = useChartColors(3)
        const numberFormatter = createAxisFormatter({ type: 'compact' })

        if (!mounted) {
          return <div data-testid="loading">Loading...</div>
        }

        return (
          <ChartContainer height={300} aria-label="Complete chart example">
            {() => (
              <div
                data-testid="full-chart"
                style={{ backgroundColor: colors.background, color: colors.text }}
              >
                <div data-testid="chart-title" style={{ color: colors.text }}>
                  Revenue Chart
                </div>
                <div data-testid="chart-data">
                  {[1000, 2000, 3000].map((value, index) => (
                    <div
                      key={index}
                      data-testid={`data-point-${index}`}
                      style={{
                        backgroundColor: chartColors[index],
                        padding: '4px',
                        margin: '2px',
                      }}
                    >
                      {numberFormatter(value)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ChartContainer>
        )
      }

      render(<FullChart />)

      await waitFor(() => {
        expect(screen.getByTestId('full-chart')).toBeInTheDocument()
      })

      expect(screen.getByLabelText('Complete chart example')).toBeInTheDocument()
      expect(screen.getByTestId('chart-title')).toHaveTextContent('Revenue Chart')
      expect(screen.getByTestId('data-point-0')).toHaveTextContent('1.0K')
      expect(screen.getByTestId('data-point-1')).toHaveTextContent('2.0K')
      expect(screen.getByTestId('data-point-2')).toHaveTextContent('3.0K')
    })

    it('should maintain performance with multiple chart instances', async () => {
      const MultipleCharts = () => {
        return (
          <div data-testid="multiple-charts">
            <ThemeAwareChart />
            <MultiSeriesChart seriesCount={4} />
            <ResponsiveChart testId="responsive-1" />
            <DataChart />
          </div>
        )
      }

      const start = Date.now()
      render(<MultipleCharts />)

      await waitFor(() => {
        expect(screen.getByTestId('multiple-charts')).toBeInTheDocument()
      })
      const duration = Date.now() - start

      // Should render quickly (within 1 second)
      expect(duration).toBeLessThan(1000)

      // All charts should be present
      expect(screen.getByTestId('chart')).toBeInTheDocument()
      expect(screen.getByTestId('multi-series-chart')).toBeInTheDocument()
      expect(screen.getByTestId('responsive-1')).toBeInTheDocument()
      expect(screen.getByTestId('data-chart')).toBeInTheDocument()
    })
  })
})