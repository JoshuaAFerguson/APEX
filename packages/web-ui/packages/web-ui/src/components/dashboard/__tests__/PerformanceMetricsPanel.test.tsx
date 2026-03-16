/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { PerformanceMetricsPanel } from '../PerformanceMetricsPanel'
import { EMPTY_AGGREGATED_METRICS } from '@/types/performance-metrics'

describe('PerformanceMetricsPanel', () => {
  it('renders without crashing', () => {
    render(<PerformanceMetricsPanel />)
    expect(screen.getByLabelText('Performance Metrics Panel')).toBeInTheDocument()
  })

  it('shows loading state when loading prop is true', () => {
    render(<PerformanceMetricsPanel loading={true} />)
    expect(screen.getByText('Loading performance metrics...')).toBeInTheDocument()
  })

  it('shows error state when error prop is provided', () => {
    render(<PerformanceMetricsPanel error="Test error message" />)
    expect(screen.getByText('Error Loading Performance Metrics')).toBeInTheDocument()
    expect(screen.getByText('Test error message')).toBeInTheDocument()
  })

  it('shows empty state when no data is provided', () => {
    render(<PerformanceMetricsPanel />)
    expect(screen.getByText('No performance data available')).toBeInTheDocument()
  })

  it('shows charts when data is provided', () => {
    const mockData = {
      ...EMPTY_AGGREGATED_METRICS,
      tokenUsage: {
        ...EMPTY_AGGREGATED_METRICS.tokenUsage,
        data: [
          {
            timestamp: new Date(),
            totalTokens: 100,
            breakdown: {
              inputTokens: 50,
              outputTokens: 50,
            },
          },
        ],
      },
    }

    render(
      <PerformanceMetricsPanel
        data={mockData}
        showTokenUsage={true}
        showTaskCompletion={true}
        showCostTrend={true}
      />
    )

    expect(screen.getByText('Token Usage Over Time')).toBeInTheDocument()
    expect(screen.getByText('Task Completion Rate')).toBeInTheDocument()
    expect(screen.getByText('Cost Trend')).toBeInTheDocument()
  })

  it('hides time range selector when showTimeRangeSelector is false', () => {
    render(<PerformanceMetricsPanel showTimeRangeSelector={false} />)
    expect(screen.queryByTestId('time-range-selector')).not.toBeInTheDocument()
  })

  it('shows time range selector by default', () => {
    render(<PerformanceMetricsPanel />)
    expect(screen.getByTestId('time-range-selector')).toBeInTheDocument()
  })

  it('shows refresh button when onRefresh prop is provided', () => {
    const mockRefresh = jest.fn()
    render(<PerformanceMetricsPanel onRefresh={mockRefresh} />)
    expect(screen.getByLabelText('Refresh performance metrics')).toBeInTheDocument()
  })

  it('applies custom className when provided', () => {
    const { container } = render(<PerformanceMetricsPanel className="custom-class" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })
})