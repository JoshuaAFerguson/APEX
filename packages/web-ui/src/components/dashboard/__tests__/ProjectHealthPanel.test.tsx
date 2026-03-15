import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProjectHealthPanel } from '../ProjectHealthPanel'
import { HealthStatusIndicator } from '../HealthStatusIndicator'
import { MetricCard } from '../MetricCard'
import {
  generateMockHealthMetrics,
  generateWarningMockMetrics,
  generateCriticalMockMetrics,
  calculateProjectHealthStatus,
  DEFAULT_HEALTH_THRESHOLDS,
  type ProjectHealthMetrics,
} from '@/types/project-health'

// Helper function to render ProjectHealthPanel with default props
const renderHealthPanel = (props: Partial<Parameters<typeof ProjectHealthPanel>[0]> = {}) => {
  return render(<ProjectHealthPanel {...props} />)
}

describe('ProjectHealthPanel', () => {
  describe('Rendering', () => {
    it('renders with healthy mock data', () => {
      const metrics = generateMockHealthMetrics()
      renderHealthPanel({ metrics })

      expect(screen.getByText('Project Health')).toBeInTheDocument()
      expect(screen.getByText('Healthy')).toBeInTheDocument()
      expect(screen.getByText('Success Rate')).toBeInTheDocument()
      expect(screen.getByText('Avg Duration')).toBeInTheDocument()
      expect(screen.getByText('System Health')).toBeInTheDocument()
    })

    it('renders with warning mock data', () => {
      const metrics = generateWarningMockMetrics()
      renderHealthPanel({ metrics })

      expect(screen.getByText('Warning')).toBeInTheDocument()
    })

    it('renders with critical mock data', () => {
      const metrics = generateCriticalMockMetrics()
      renderHealthPanel({ metrics })

      expect(screen.getByText('Critical')).toBeInTheDocument()
    })

    it('renders loading state when isLoading is true and no metrics', () => {
      renderHealthPanel({ isLoading: true })

      expect(screen.getByText('Loading health metrics...')).toBeInTheDocument()
    })

    it('renders error state with error message', () => {
      const error = new Error('Failed to fetch health data')
      renderHealthPanel({ error })

      expect(screen.getByText('Error Loading Health Metrics')).toBeInTheDocument()
      expect(screen.getByText('Failed to fetch health data')).toBeInTheDocument()
    })

    it('renders unknown status when no metrics provided', () => {
      renderHealthPanel()

      expect(screen.getByText('Unknown')).toBeInTheDocument()
    })

    it('renders time range label', () => {
      const metrics = generateMockHealthMetrics()
      renderHealthPanel({ metrics, timeRange: '24h' })

      expect(screen.getByText('Last 24 hours')).toBeInTheDocument()
    })
  })

  describe('Metric Display', () => {
    it('displays success rate correctly', () => {
      const metrics = generateMockHealthMetrics({ successRate: 95.5 })
      renderHealthPanel({ metrics })

      expect(screen.getByText('95.5%')).toBeInTheDocument()
    })

    it('displays average duration correctly', () => {
      const metrics = generateMockHealthMetrics({ averageDurationMs: 2500 })
      renderHealthPanel({ metrics })

      expect(screen.getByText('2.5s')).toBeInTheDocument()
    })

    it('displays system health correctly', () => {
      const metrics = generateMockHealthMetrics({ systemHealth: 92.0 })
      renderHealthPanel({ metrics })

      expect(screen.getByText('92.0%')).toBeInTheDocument()
    })

    it('shows task breakdown when showDetails is true', () => {
      const metrics = generateMockHealthMetrics()
      renderHealthPanel({ metrics, showDetails: true })

      expect(screen.getByText('Task Breakdown')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Pending')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('Failed')).toBeInTheDocument()
    })

    it('hides task breakdown when showDetails is false', () => {
      const metrics = generateMockHealthMetrics()
      renderHealthPanel({ metrics, showDetails: false })

      expect(screen.queryByText('Task Breakdown')).not.toBeInTheDocument()
    })
  })

  describe('Connection Status', () => {
    it('shows connected status with latency', () => {
      const metrics = generateMockHealthMetrics({
        connection: {
          isConnected: true,
          latencyMs: 45,
          averageLatencyMs: 52,
          reconnectAttempts: 0,
        },
      })
      renderHealthPanel({ metrics, showConnectionStatus: true })

      expect(screen.getByText('Connected (45ms)')).toBeInTheDocument()
    })

    it('shows disconnected status with retry attempts', () => {
      const metrics = generateMockHealthMetrics({
        connection: {
          isConnected: false,
          latencyMs: 0,
          averageLatencyMs: 0,
          reconnectAttempts: 3,
        },
      })
      renderHealthPanel({ metrics, showConnectionStatus: true })

      expect(screen.getByText('Disconnected (3 attempts)')).toBeInTheDocument()
    })

    it('hides connection status when showConnectionStatus is false', () => {
      const metrics = generateMockHealthMetrics()
      renderHealthPanel({ metrics, showConnectionStatus: false })

      expect(screen.queryByText(/Connected/)).not.toBeInTheDocument()
    })
  })

  describe('Interactions', () => {
    it('calls onRefresh when refresh button is clicked', () => {
      const onRefresh = vi.fn()
      const metrics = generateMockHealthMetrics()
      renderHealthPanel({ metrics, onRefresh })

      const refreshButton = screen.getByRole('button', { name: 'Refresh health metrics' })
      fireEvent.click(refreshButton)

      expect(onRefresh).toHaveBeenCalledTimes(1)
    })

    it('calls onStatusChange when status changes', () => {
      const onStatusChange = vi.fn()
      const metrics = generateMockHealthMetrics({ status: 'healthy' })
      renderHealthPanel({ metrics, onStatusChange })

      expect(onStatusChange).toHaveBeenCalledWith('healthy')
    })

    it('shows retry button on error state', () => {
      const onRefresh = vi.fn()
      const error = new Error('Connection failed')
      renderHealthPanel({ error, onRefresh })

      const retryButton = screen.getByRole('button', { name: 'Try Again' })
      fireEvent.click(retryButton)

      expect(onRefresh).toHaveBeenCalledTimes(1)
    })
  })

  describe('Status Calculation', () => {
    it('calculates healthy status correctly', () => {
      const metrics = {
        successRate: 95,
        systemHealth: 90,
        averageDurationMs: 3000,
      }
      const status = calculateProjectHealthStatus(metrics, DEFAULT_HEALTH_THRESHOLDS)
      expect(status).toBe('healthy')
    })

    it('calculates warning status for low success rate', () => {
      const metrics = {
        successRate: 85, // Below 90 warning threshold
        systemHealth: 90,
        averageDurationMs: 3000,
      }
      const status = calculateProjectHealthStatus(metrics, DEFAULT_HEALTH_THRESHOLDS)
      expect(status).toBe('warning')
    })

    it('calculates critical status for very low success rate', () => {
      const metrics = {
        successRate: 65, // Below 70 critical threshold
        systemHealth: 90,
        averageDurationMs: 3000,
      }
      const status = calculateProjectHealthStatus(metrics, DEFAULT_HEALTH_THRESHOLDS)
      expect(status).toBe('critical')
    })

    it('calculates warning status for high duration', () => {
      const metrics = {
        successRate: 95,
        systemHealth: 90,
        averageDurationMs: 8000, // Above 5000 warning threshold
      }
      const status = calculateProjectHealthStatus(metrics, DEFAULT_HEALTH_THRESHOLDS)
      expect(status).toBe('warning')
    })

    it('calculates critical status for very high duration', () => {
      const metrics = {
        successRate: 95,
        systemHealth: 90,
        averageDurationMs: 20000, // Above 15000 critical threshold
      }
      const status = calculateProjectHealthStatus(metrics, DEFAULT_HEALTH_THRESHOLDS)
      expect(status).toBe('critical')
    })

    it('respects custom thresholds', () => {
      const metrics = {
        successRate: 92, // Would be healthy with defaults
        systemHealth: 90,
        averageDurationMs: 3000,
      }
      const customThresholds = {
        ...DEFAULT_HEALTH_THRESHOLDS,
        successRateWarning: 95, // Higher threshold
      }
      const status = calculateProjectHealthStatus(metrics, customThresholds)
      expect(status).toBe('warning')
    })
  })

  describe('Accessibility', () => {
    it('has proper region role and label', () => {
      const metrics = generateMockHealthMetrics()
      renderHealthPanel({ metrics })

      expect(screen.getByRole('region', { name: 'Project Health Panel' })).toBeInTheDocument()
    })

    it('has status role on health indicator', () => {
      const metrics = generateMockHealthMetrics()
      renderHealthPanel({ metrics })

      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('has accessible refresh button', () => {
      const metrics = generateMockHealthMetrics()
      renderHealthPanel({ metrics, onRefresh: () => {} })

      const refreshButton = screen.getByRole('button', { name: 'Refresh health metrics' })
      expect(refreshButton).toBeInTheDocument()
    })
  })
})

describe('HealthStatusIndicator', () => {
  it('renders healthy status', () => {
    render(<HealthStatusIndicator status="healthy" />)
    expect(screen.getByText('Healthy')).toBeInTheDocument()
  })

  it('renders warning status', () => {
    render(<HealthStatusIndicator status="warning" />)
    expect(screen.getByText('Warning')).toBeInTheDocument()
  })

  it('renders critical status', () => {
    render(<HealthStatusIndicator status="critical" />)
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })

  it('renders unknown status', () => {
    render(<HealthStatusIndicator status="unknown" />)
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('hides label when showLabel is false', () => {
    render(<HealthStatusIndicator status="healthy" showLabel={false} />)
    expect(screen.queryByText('Healthy')).not.toBeInTheDocument()
  })

  it('renders different sizes', () => {
    const { rerender } = render(<HealthStatusIndicator status="healthy" size="sm" data-testid="indicator" />)
    expect(screen.getByTestId('indicator')).toHaveClass('text-xs')

    rerender(<HealthStatusIndicator status="healthy" size="lg" data-testid="indicator" />)
    expect(screen.getByTestId('indicator')).toHaveClass('text-base')
  })

  it('has proper ARIA label', () => {
    render(<HealthStatusIndicator status="healthy" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Health status: Healthy')
  })
})

describe('MetricCard', () => {
  it('renders title and value', () => {
    render(<MetricCard title="Test Metric" value={42} />)

    expect(screen.getByText('Test Metric')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders with unit suffix', () => {
    render(<MetricCard title="Percentage" value={85} unit="%" />)

    expect(screen.getByText('85')).toBeInTheDocument()
    expect(screen.getByText('%')).toBeInTheDocument()
  })

  it('renders description text', () => {
    render(<MetricCard title="Metric" value={100} description="This is a description" />)

    expect(screen.getByText('This is a description')).toBeInTheDocument()
  })

  it('renders status indicator bar', () => {
    const { container } = render(<MetricCard title="Metric" value={100} status="healthy" />)

    const statusBar = container.querySelector('.bg-green-500')
    expect(statusBar).toBeInTheDocument()
  })

  it('formats large numbers with locale', () => {
    render(<MetricCard title="Count" value={1000000} />)

    expect(screen.getByText('1,000,000')).toBeInTheDocument()
  })
})

describe('Mock Data Generators', () => {
  it('generates healthy mock metrics', () => {
    const metrics = generateMockHealthMetrics()

    expect(metrics.status).toBe('healthy')
    expect(metrics.successRate).toBeGreaterThanOrEqual(90)
    expect(metrics.systemHealth).toBeGreaterThanOrEqual(85)
    expect(metrics.tasks).toBeDefined()
    expect(metrics.connection).toBeDefined()
    expect(metrics.lastUpdated).toBeInstanceOf(Date)
  })

  it('generates warning mock metrics', () => {
    const metrics = generateWarningMockMetrics()

    expect(metrics.status).toBe('warning')
    expect(metrics.successRate).toBeLessThan(90)
  })

  it('generates critical mock metrics', () => {
    const metrics = generateCriticalMockMetrics()

    expect(metrics.status).toBe('critical')
    expect(metrics.successRate).toBeLessThan(70)
    expect(metrics.connection?.isConnected).toBe(false)
  })

  it('allows overriding mock metrics', () => {
    const metrics = generateMockHealthMetrics({
      successRate: 50,
      status: 'critical',
    })

    expect(metrics.successRate).toBe(50)
    expect(metrics.status).toBe('critical')
  })
})
