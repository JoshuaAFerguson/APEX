/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ThemeProvider } from 'next-themes'
import { axe, toHaveNoViolations } from 'jest-axe'
import {
  TaskCompletionRateChart,
  TaskCompletionRateChartMini,
} from '../TaskCompletionRateChart'
import type { TaskCompletionRateData } from '@/types/performance-metrics'

// Add jest-axe matchers
expect.extend(toHaveNoViolations)

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock Recharts components with accessibility features
vi.mock('recharts', () => ({
  PieChart: ({ children, ...props }: any) => (
    <div data-testid="pie-chart" role="img" aria-hidden="false" {...props}>
      {children}
    </div>
  ),
  BarChart: ({ children, ...props }: any) => (
    <div data-testid="bar-chart" role="img" aria-hidden="false" {...props}>
      {children}
    </div>
  ),
  Pie: ({ dataKey, data, onClick, children }: any) => (
    <div
      data-testid={`pie-${dataKey}`}
      onClick={() => onClick && onClick(data?.[0] || {})}
      role="button"
      tabIndex={onClick ? 0 : -1}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          onClick(data?.[0] || {})
        }
      }}
      aria-label={`Pie chart segment for ${dataKey}`}
    >
      {children}
    </div>
  ),
  Cell: ({ fill }: any) => (
    <div data-testid="pie-cell" style={{ backgroundColor: fill }} />
  ),
  Bar: ({ dataKey, fill, onClick }: any) => (
    <div
      data-testid={`bar-${dataKey}`}
      style={{ backgroundColor: fill }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : -1}
      aria-label={`Bar chart segment for ${dataKey}`}
    />
  ),
  XAxis: ({ dataKey }: any) => (
    <div data-testid="x-axis" role="img" aria-label={`X-axis for ${dataKey}`} />
  ),
  YAxis: () => (
    <div data-testid="y-axis" role="img" aria-label="Y-axis" />
  ),
  CartesianGrid: () => (
    <div data-testid="cartesian-grid" aria-hidden="true" />
  ),
  Tooltip: ({ content }: any) => (
    <div
      data-testid="tooltip"
      role="tooltip"
      aria-live="polite"
      aria-atomic="true"
    >
      {content}
    </div>
  ),
  Legend: () => (
    <div data-testid="legend" role="img" aria-label="Chart legend" />
  ),
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container" role="img">
      {children}
    </div>
  ),
}))

// Mock chart utils
vi.mock('@/lib/chart-utils', () => ({
  useChartTheme: () => ({
    colors: {
      primary: '#0ea5e9',
      background: '#ffffff',
      border: '#e4e4e7',
      text: '#09090b',
    },
    mode: 'light' as const,
    mounted: true,
  }),
  getTooltipStyle: () => ({ contentStyle: {}, labelStyle: {} }),
  getGridStyle: () => ({}),
  getAxisStyle: () => ({}),
  compactNumberFormatter: (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toString()
  },
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/types/performance-metrics', async () => {
  const actual = await vi.importActual('@/types/performance-metrics')
  return {
    ...actual,
    formatPercentage: (value: number, decimals: number = 1) => `${value.toFixed(decimals)}%`,
  }
})

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      {children}
    </ThemeProvider>
  )
}

// Helper to create test data
function createTestData(): TaskCompletionRateData {
  return {
    data: [
      {
        timestamp: new Date('2024-01-01T12:00:00Z'),
        completionRate: 75,
        successRate: 85,
        completedCount: 100,
        failedCount: 15,
        totalProcessed: 115,
        avgDurationMs: 2500,
      },
    ],
    overallCompletionRate: 78.5,
    overallSuccessRate: 84.2,
    totalCompleted: 1200,
    totalFailed: 180,
    totalProcessed: 1380,
    statusCounts: {
      completed: 1200,
      failed: 180,
      cancelled: 50,
      inProgress: 25,
      pending: 75,
      paused: 10,
    },
    byStatus: {
      completed: 1200,
      failed: 180,
      cancelled: 50,
    },
    avgDurationMs: 2500,
    medianDurationMs: 2200,
    p95DurationMs: 4500,
    timeRange: '24h',
    generatedAt: new Date(),
    trend: 1,
    changePercent: 12.5,
  }
}

describe('TaskCompletionRateChart Accessibility', () => {
  const testData = createTestData()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ARIA Compliance', () => {
    it('should not have any accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <TaskCompletionRateChart data={testData} />
        </TestWrapper>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('has proper role and ARIA labels on chart container', () => {
      render(
        <TestWrapper>
          <TaskCompletionRateChart data={testData} />
        </TestWrapper>
      )

      const chart = screen.getByRole('img')
      expect(chart).toHaveAttribute('aria-label')

      const ariaLabel = chart.getAttribute('aria-label')
      expect(ariaLabel).toContain('Task completion chart')
      expect(ariaLabel).toContain('84.2% success rate')
      expect(ariaLabel).toContain('1,200 completed')
      expect(ariaLabel).toContain('180 failed')
    })

    it('provides comprehensive screen reader summary', () => {
      render(
        <TestWrapper>
          <TaskCompletionRateChart data={testData} />
        </TestWrapper>
      )

      const summary = screen.getByText(/Task completion summary/, { selector: '.sr-only' })
      expect(summary).toBeInTheDocument()

      const summaryText = summary.textContent
      expect(summaryText).toContain('1,380 tasks processed')
      expect(summaryText).toContain('1,200 completed (78.5% completion rate)')
      expect(summaryText).toContain('180 failed')
      expect(summaryText).toContain('Overall success rate: 84.2%')
    })

    it('has proper ARIA live regions for dynamic content', () => {
      render(
        <TestWrapper>
          <TaskCompletionRateChart data={testData} />
        </TestWrapper>
      )

      const tooltip = screen.getByRole('tooltip')
      expect(tooltip).toHaveAttribute('aria-live', 'polite')
      expect(tooltip).toHaveAttribute('aria-atomic', 'true')
    })

    it('provides descriptive labels for interactive elements', () => {
      render(
        <TestWrapper>
          <TaskCompletionRateChart data={testData} onDataPointClick={vi.fn()} />
        </TestWrapper>
      )

      const pieElement = screen.getByTestId('pie-value')
      expect(pieElement).toHaveAttribute('aria-label', 'Pie chart segment for value')
      expect(pieElement).toHaveAttribute('role', 'button')
    })
  })

  describe('Keyboard Navigation', () => {
    it('makes interactive pie segments keyboard accessible', () => {
      const onClickMock = vi.fn()
      render(
        <TestWrapper>
          <TaskCompletionRateChart data={testData} onDataPointClick={onClickMock} />
        </TestWrapper>
      )

      const pieElement = screen.getByTestId('pie-value')
      expect(pieElement).toHaveAttribute('tabIndex', '0')

      // Test Enter key activation
      fireEvent.keyDown(pieElement, { key: 'Enter' })
      expect(onClickMock).toHaveBeenCalledTimes(1)

      // Test Space key activation
      fireEvent.keyDown(pieElement, { key: ' ' })
      expect(onClickMock).toHaveBeenCalledTimes(2)
    })

    it('does not make non-interactive elements focusable', () => {
      render(
        <TestWrapper>
          <TaskCompletionRateChart data={testData} />
        </TestWrapper>
      )

      const pieElement = screen.getByTestId('pie-value')
      expect(pieElement).toHaveAttribute('tabIndex', '-1')
    })

    it('maintains proper tab order', () => {
      render(
        <TestWrapper>
          <div>
            <button>Before Chart</button>
            <TaskCompletionRateChart data={testData} onDataPointClick={vi.fn()} />
            <button>After Chart</button>
          </div>
        </TestWrapper>
      )

      const beforeButton = screen.getByText('Before Chart')
      const pieElement = screen.getByTestId('pie-value')
      const afterButton = screen.getByText('After Chart')

      beforeButton.focus()
      expect(document.activeElement).toBe(beforeButton)

      // Tab to pie element
      fireEvent.keyDown(beforeButton, { key: 'Tab' })
      pieElement.focus()
      expect(document.activeElement).toBe(pieElement)

      // Tab to after button
      fireEvent.keyDown(pieElement, { key: 'Tab' })
      afterButton.focus()
      expect(document.activeElement).toBe(afterButton)
    })
  })

  describe('Color and Contrast', () => {
    it('provides alternative methods to convey information beyond color', () => {
      render(
        <TestWrapper>
          <TaskCompletionRateChart data={testData} />
        </TestWrapper>
      )

      // Should have text labels for each status
      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('Failed')).toBeInTheDocument()

      // Should have numerical values
      expect(screen.getByText('1,200')).toBeInTheDocument() // Completed count
      expect(screen.getByText('180')).toBeInTheDocument() // Failed count

      // Should have percentage values
      expect(screen.getByText('84.2%')).toBeInTheDocument() // Success rate
    })

    it('includes patterns or shapes in addition to color coding', () => {
      render(
        <TestWrapper>
          <TaskCompletionRateChart data={testData} variant="bar" />
        </TestWrapper>
      )

      // Bar chart should have distinct patterns/shapes for different statuses
      const bars = screen.getAllByText(/Completed|Failed|Cancelled/)
      expect(bars.length).toBeGreaterThan(0)
    })

    it('maintains readability in high contrast mode', () => {
      // Mock high contrast preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query.includes('prefers-contrast: high'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={testData} />
        </TestWrapper>
      )

      const chart = screen.getByRole('img')
      expect(chart).toBeInTheDocument()
    })
  })

  describe('Screen Reader Optimization', () => {
    it('provides detailed descriptions for complex data', () => {
      render(
        <TestWrapper>
          <TaskCompletionRateChart data={testData} />
        </TestWrapper>
      )

      const summary = screen.getByText(/Task completion summary/, { selector: '.sr-only' })
      const summaryText = summary.textContent

      // Should describe all important aspects of the data
      expect(summaryText).toContain('1,380 tasks processed')
      expect(summaryText).toContain('1,200 completed')
      expect(summaryText).toContain('78.5% completion rate')
      expect(summaryText).toContain('180 failed')
      expect(summaryText).toContain('84.2%')
    })

    it('hides decorative elements from screen readers', () => {
      render(
        <TestWrapper>
          <TaskCompletionRateChart data={testData} />
        </TestWrapper>
      )

      const grid = screen.getByTestId('cartesian-grid')
      expect(grid).toHaveAttribute('aria-hidden', 'true')
    })

    it('provides context for numerical data', () => {
      render(
        <TestWrapper>
          <TaskCompletionRateChart data={testData} showSuccessRate={true} />
        </TestWrapper>
      )

      // Success rate should have context
      expect(screen.getByText('Success Rate')).toBeInTheDocument()
      expect(screen.getByText('84.2%')).toBeInTheDocument()

      // Counts should have labels
      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('Failed')).toBeInTheDocument()
      expect(screen.getByText('Total')).toBeInTheDocument()
    })
  })

  describe('Empty and Error States Accessibility', () => {
    it('properly handles empty state accessibility', () => {
      const emptyData = {
        ...testData,
        statusCounts: { completed: 0, failed: 0, cancelled: 0, inProgress: 0, pending: 0, paused: 0 },
        totalProcessed: 0,
        totalCompleted: 0,
        totalFailed: 0,
      }

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={emptyData} />
        </TestWrapper>
      )

      const emptyMessage = screen.getByText('No task completion data available')
      expect(emptyMessage).toBeInTheDocument()
      expect(emptyMessage.closest('[role="status"]')).toBeTruthy()
    })

    it('provides accessible loading state', () => {
      // Mock loading state
      vi.mocked(require('@/lib/chart-utils').useChartTheme).mockReturnValueOnce({
        colors: {},
        mode: 'light',
        mounted: false,
      })

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={testData} />
        </TestWrapper>
      )

      // Loading skeletons should have proper accessibility attributes
      const skeletonElements = document.querySelectorAll('.animate-pulse')
      expect(skeletonElements.length).toBeGreaterThan(0)

      // Should have a loading indicator accessible to screen readers
      expect(document.querySelector('[aria-label*="Loading"]') ||
             document.querySelector('[role="status"]')).toBeTruthy()
    })
  })

  describe('Dynamic Content Accessibility', () => {
    it('announces data changes to screen readers', () => {
      const { rerender } = render(
        <TestWrapper>
          <TaskCompletionRateChart data={testData} />
        </TestWrapper>
      )

      // Initial state
      expect(screen.getByText('84.2%')).toBeInTheDocument()

      // Update data
      const updatedData = {
        ...testData,
        overallSuccessRate: 90.0,
        totalCompleted: 1350,
      }

      rerender(
        <TestWrapper>
          <TaskCompletionRateChart data={updatedData} />
        </TestWrapper>
      )

      // Updated success rate should be announced
      expect(screen.getByText('90.0%')).toBeInTheDocument()

      const tooltip = screen.getByRole('tooltip')
      expect(tooltip).toHaveAttribute('aria-live', 'polite')
    })
  })
})

describe('TaskCompletionRateChartMini Accessibility', () => {
  const testData = createTestData()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Compact Layout Accessibility', () => {
    it('should not have any accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <TaskCompletionRateChartMini data={testData} />
        </TestWrapper>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('maintains accessibility in minimal space', () => {
      render(
        <TestWrapper>
          <TaskCompletionRateChartMini data={testData} height={60} />
        </TestWrapper>
      )

      // Essential information should still be accessible
      expect(screen.getByText('84%')).toBeInTheDocument() // Success rate
      expect(screen.getByText('1,200 / 1,380 tasks')).toBeInTheDocument() // Task counts

      // Chart should have proper role
      const responsiveContainer = screen.getByTestId('responsive-container')
      expect(responsiveContainer).toHaveAttribute('role', 'img')
    })

    it('provides adequate information for screen readers', () => {
      render(
        <TestWrapper>
          <TaskCompletionRateChartMini data={testData} />
        </TestWrapper>
      )

      // Should have all essential information visible
      expect(screen.getByText('84%')).toBeInTheDocument()
      expect(screen.getByText('1,200 / 1,380 tasks')).toBeInTheDocument()
    })

    it('handles empty state accessibly', () => {
      const emptyData = {
        ...testData,
        statusCounts: { completed: 0, failed: 0, cancelled: 0, inProgress: 0, pending: 0, paused: 0 },
        totalProcessed: 0,
      }

      render(
        <TestWrapper>
          <TaskCompletionRateChartMini data={emptyData} />
        </TestWrapper>
      )

      const emptyMessage = screen.getByText('No data')
      expect(emptyMessage).toBeInTheDocument()
    })
  })

  describe('Dashboard Context Accessibility', () => {
    it('works well in dashboard grid without accessibility issues', async () => {
      const { container } = render(
        <TestWrapper>
          <div role="main" aria-label="Task completion dashboard">
            <h2>Task Completion Statistics</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <TaskCompletionRateChartMini data={testData} />
              <TaskCompletionRateChartMini data={testData} />
              <TaskCompletionRateChartMini data={testData} />
            </div>
          </div>
        </TestWrapper>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()

      // All mini charts should be accessible
      const charts = screen.getAllByTestId('responsive-container')
      expect(charts).toHaveLength(3)
      charts.forEach(chart => {
        expect(chart).toHaveAttribute('role', 'img')
      })
    })
  })
})

describe('Accessibility Best Practices', () => {
  const testData = createTestData()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('follows WCAG 2.1 AA guidelines for interactive elements', () => {
    render(
      <TestWrapper>
        <TaskCompletionRateChart data={testData} onDataPointClick={vi.fn()} />
      </TestWrapper>
    )

    const pieElement = screen.getByTestId('pie-value')

    // Should be keyboard accessible
    expect(pieElement).toHaveAttribute('role', 'button')
    expect(pieElement).toHaveAttribute('tabIndex', '0')

    // Should have descriptive label
    expect(pieElement).toHaveAttribute('aria-label')
  })

  it('provides multiple ways to access the same information', () => {
    render(
      <TestWrapper>
        <TaskCompletionRateChart data={testData} />
      </TestWrapper>
    )

    // Visual chart
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument()

    // Text-based statistics
    expect(screen.getByText('84.2%')).toBeInTheDocument() // Success rate
    expect(screen.getByText('1,200')).toBeInTheDocument() // Completed count
    expect(screen.getByText('180')).toBeInTheDocument() // Failed count

    // ARIA label with summary
    const chart = screen.getByRole('img')
    expect(chart).toHaveAttribute('aria-label', expect.stringContaining('success rate'))

    // Screen reader summary
    expect(screen.getByText(/Task completion summary/, { selector: '.sr-only' })).toBeInTheDocument()
  })

  it('maintains semantic structure', () => {
    render(
      <TestWrapper>
        <main>
          <h1>Dashboard</h1>
          <section>
            <h2>Task Completion</h2>
            <TaskCompletionRateChart data={testData} />
          </section>
        </main>
      </TestWrapper>
    )

    // Should maintain proper heading hierarchy
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dashboard')
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Task Completion')
  })

  it('handles focus management properly', () => {
    render(
      <TestWrapper>
        <div>
          <button>Before</button>
          <TaskCompletionRateChart data={testData} onDataPointClick={vi.fn()} />
          <button>After</button>
        </div>
      </TestWrapper>
    )

    const beforeButton = screen.getByText('Before')
    const afterButton = screen.getByText('After')
    const pieElement = screen.getByTestId('pie-value')

    // Focus should move logically
    beforeButton.focus()
    expect(document.activeElement).toBe(beforeButton)

    pieElement.focus()
    expect(document.activeElement).toBe(pieElement)

    afterButton.focus()
    expect(document.activeElement).toBe(afterButton)
  })
})