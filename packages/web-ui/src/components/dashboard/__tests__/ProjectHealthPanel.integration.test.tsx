/**
 * Integration test for ProjectHealthPanel demonstrating the acceptance criteria
 *
 * This test verifies that the ProjectHealthPanel component:
 * - Displays project health status with visual indicators (healthy/warning/critical)
 * - Shows metrics like success rate, average duration, and system health
 * - Renders correctly with mock data and real API data
 */
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProjectHealthPanel } from '../ProjectHealthPanel'
import {
  generateMockHealthMetrics,
  generateWarningMockMetrics,
  generateCriticalMockMetrics,
} from '@/types/project-health'

describe('ProjectHealthPanel - Acceptance Criteria Integration Tests', () => {
  describe('AC1: Displays project health status with visual indicators', () => {
    it('shows healthy status with green visual indicator', () => {
      const healthyMetrics = generateMockHealthMetrics()
      render(<ProjectHealthPanel metrics={healthyMetrics} />)

      // Verify health status is displayed
      expect(screen.getByText('Healthy')).toBeInTheDocument()

      // Verify health status indicator is present with proper role
      const statusIndicator = screen.getByRole('status')
      expect(statusIndicator).toHaveAttribute('aria-label', 'Health status: Healthy')

      // Verify overall panel structure
      expect(screen.getByRole('region', { name: 'Project Health Panel' })).toBeInTheDocument()
    })

    it('shows warning status with yellow visual indicator', () => {
      const warningMetrics = generateWarningMockMetrics()
      render(<ProjectHealthPanel metrics={warningMetrics} />)

      expect(screen.getByText('Warning')).toBeInTheDocument()

      const statusIndicator = screen.getByRole('status')
      expect(statusIndicator).toHaveAttribute('aria-label', 'Health status: Warning')
    })

    it('shows critical status with red visual indicator', () => {
      const criticalMetrics = generateCriticalMockMetrics()
      render(<ProjectHealthPanel metrics={criticalMetrics} />)

      expect(screen.getByText('Critical')).toBeInTheDocument()

      const statusIndicator = screen.getByRole('status')
      expect(statusIndicator).toHaveAttribute('aria-label', 'Health status: Critical')
    })
  })

  describe('AC2: Shows metrics like success rate, average duration, and system health', () => {
    it('displays success rate metric with percentage formatting', () => {
      const metrics = generateMockHealthMetrics({ successRate: 95.5 })
      render(<ProjectHealthPanel metrics={metrics} />)

      expect(screen.getByText('Success Rate')).toBeInTheDocument()
      expect(screen.getByText('95.5%')).toBeInTheDocument()
    })

    it('displays average duration metric with proper time formatting', () => {
      const metrics = generateMockHealthMetrics({ averageDurationMs: 2500 })
      render(<ProjectHealthPanel metrics={metrics} />)

      expect(screen.getByText('Avg Duration')).toBeInTheDocument()
      expect(screen.getByText('2.5s')).toBeInTheDocument()
    })

    it('displays system health metric with percentage formatting', () => {
      const metrics = generateMockHealthMetrics({ systemHealth: 92.0 })
      render(<ProjectHealthPanel metrics={metrics} />)

      expect(screen.getByText('System Health')).toBeInTheDocument()
      expect(screen.getByText('92.0%')).toBeInTheDocument()
    })

    it('displays all three core metrics in a grid layout', () => {
      const metrics = generateMockHealthMetrics()
      render(<ProjectHealthPanel metrics={metrics} />)

      // All core metrics should be present
      expect(screen.getByText('Success Rate')).toBeInTheDocument()
      expect(screen.getByText('Avg Duration')).toBeInTheDocument()
      expect(screen.getByText('System Health')).toBeInTheDocument()

      // Verify the values are displayed (using getAllByText since there are multiple percentages)
      const percentageElements = screen.getAllByText(/\d+\.\d+%/)
      expect(percentageElements.length).toBeGreaterThanOrEqual(2) // Success rate and system health
      expect(screen.getByText(/\d+\.\d+s/)).toBeInTheDocument() // Duration
    })
  })

  describe('AC3: Renders correctly with mock data and real API data', () => {
    it('renders with mock healthy data', () => {
      const mockData = generateMockHealthMetrics()
      render(<ProjectHealthPanel metrics={mockData} />)

      // Verify all expected elements are present
      expect(screen.getByText('Project Health')).toBeInTheDocument()
      expect(screen.getByText('Healthy')).toBeInTheDocument()
      expect(screen.getByText('Success Rate')).toBeInTheDocument()
      expect(screen.getByText('Avg Duration')).toBeInTheDocument()
      expect(screen.getByText('System Health')).toBeInTheDocument()

      // Verify connection status is shown
      expect(screen.getByText(/Connected \(\d+ms\)/)).toBeInTheDocument()
    })

    it('renders with mock warning data', () => {
      const mockData = generateWarningMockMetrics()
      render(<ProjectHealthPanel metrics={mockData} />)

      expect(screen.getByText('Warning')).toBeInTheDocument()
      expect(screen.getByText('82.0%')).toBeInTheDocument() // Success rate from warning mock
    })

    it('renders with mock critical data', () => {
      const mockData = generateCriticalMockMetrics()
      render(<ProjectHealthPanel metrics={mockData} />)

      expect(screen.getByText('Critical')).toBeInTheDocument()
      expect(screen.getByText('55.0%')).toBeInTheDocument() // Success rate from critical mock
      expect(screen.getByText(/Disconnected/)).toBeInTheDocument() // Connection issues
    })

    it('renders with simulated real API data structure', () => {
      // Simulate data that would come from a real API endpoint
      const apiData = {
        status: 'healthy' as const,
        successRate: 97.2,
        averageDurationMs: 1850,
        systemHealth: 94.5,
        tasks: {
          activeTasks: 2,
          pendingTasks: 8,
          completedTasks: 156,
          failedTasks: 3,
        },
        connection: {
          isConnected: true,
          latencyMs: 32,
          averageLatencyMs: 45,
          reconnectAttempts: 0,
          connectedSince: new Date(Date.now() - 7200000), // 2 hours ago
        },
        lastUpdated: new Date(),
      }

      render(<ProjectHealthPanel metrics={apiData} />)

      // Verify API data is properly displayed
      expect(screen.getByText('97.2%')).toBeInTheDocument()
      expect(screen.getByText('1.9s')).toBeInTheDocument()
      expect(screen.getByText('94.5%')).toBeInTheDocument()
      expect(screen.getByText('Connected (32ms)')).toBeInTheDocument()
    })

    it('handles loading state appropriately', () => {
      render(<ProjectHealthPanel isLoading={true} />)

      expect(screen.getByText('Loading health metrics...')).toBeInTheDocument()
    })

    it('handles error state appropriately', () => {
      const error = new Error('Failed to fetch health data from API')
      render(<ProjectHealthPanel error={error} />)

      expect(screen.getByText('Error Loading Health Metrics')).toBeInTheDocument()
      expect(screen.getByText('Failed to fetch health data from API')).toBeInTheDocument()
    })

    it('handles missing data gracefully', () => {
      render(<ProjectHealthPanel />)

      // Should show unknown state when no metrics provided
      expect(screen.getByText('Unknown')).toBeInTheDocument()
      const placeholderElements = screen.getAllByText('--')
      expect(placeholderElements.length).toBeGreaterThanOrEqual(1) // At least one placeholder value
    })
  })

  describe('AC4: Component functionality and user interactions', () => {
    it('supports detailed view with task breakdown', () => {
      const metrics = generateMockHealthMetrics()
      render(<ProjectHealthPanel metrics={metrics} showDetails={true} />)

      expect(screen.getByText('Task Breakdown')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Pending')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('Failed')).toBeInTheDocument()
    })

    it('supports different time ranges', () => {
      const metrics = generateMockHealthMetrics()
      render(<ProjectHealthPanel metrics={metrics} timeRange="24h" />)

      expect(screen.getByText('Last 24 hours')).toBeInTheDocument()
    })

    it('supports refresh functionality', () => {
      const metrics = generateMockHealthMetrics()
      const mockRefresh = () => {}
      render(<ProjectHealthPanel metrics={metrics} onRefresh={mockRefresh} />)

      expect(screen.getByRole('button', { name: 'Refresh health metrics' })).toBeInTheDocument()
    })

    it('supports connection status display toggle', () => {
      const metrics = generateMockHealthMetrics()

      // With connection status (default)
      const { rerender } = render(<ProjectHealthPanel metrics={metrics} showConnectionStatus={true} />)
      expect(screen.getByText(/Connected/)).toBeInTheDocument()

      // Without connection status
      rerender(<ProjectHealthPanel metrics={metrics} showConnectionStatus={false} />)
      expect(screen.queryByText(/Connected/)).not.toBeInTheDocument()
    })
  })

  describe('AC5: Accessibility and visual design', () => {
    it('has proper accessibility attributes', () => {
      const metrics = generateMockHealthMetrics()
      const mockRefresh = () => {}
      render(<ProjectHealthPanel metrics={metrics} onRefresh={mockRefresh} />)

      // Main panel has region role
      expect(screen.getByRole('region', { name: 'Project Health Panel' })).toBeInTheDocument()

      // Status indicator has proper role and label
      expect(screen.getByRole('status')).toBeInTheDocument()

      // Buttons have proper labels (only rendered when onRefresh is provided)
      const refreshButton = screen.getByRole('button', { name: 'Refresh health metrics' })
      expect(refreshButton).toBeInTheDocument()
    })

    it('displays visual status indicators with proper colors', () => {
      const healthyMetrics = generateMockHealthMetrics()
      const { container } = render(<ProjectHealthPanel metrics={healthyMetrics} />)

      // Should have green color classes for healthy status
      expect(container.querySelector('.border-green-900')).toBeInTheDocument()
      expect(container.querySelector('.bg-green-500')).toBeInTheDocument()
    })

    it('supports responsive grid layout', () => {
      const metrics = generateMockHealthMetrics()
      const { container } = render(<ProjectHealthPanel metrics={metrics} />)

      // Should have responsive grid classes
      const gridContainer = container.querySelector('.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-3')
      expect(gridContainer).toBeInTheDocument()
    })
  })
})