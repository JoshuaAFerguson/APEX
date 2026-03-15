/**
 * Edge cases and error boundary tests for ProjectHealthPanel
 *
 * This file tests extreme scenarios, boundary conditions, and error handling
 * to ensure the component is robust and provides good user experience in
 * edge cases that may occur in production.
 */
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProjectHealthPanel } from '../ProjectHealthPanel'
import {
  generateMockHealthMetrics,
  type ProjectHealthMetrics,
  DEFAULT_HEALTH_THRESHOLDS,
} from '@/types/project-health'

describe('ProjectHealthPanel - Edge Cases', () => {
  describe('Extreme Data Values', () => {
    it('handles zero values correctly', () => {
      const metrics: ProjectHealthMetrics = {
        status: 'critical',
        successRate: 0,
        averageDurationMs: 0,
        systemHealth: 0,
        tasks: {
          activeTasks: 0,
          pendingTasks: 0,
          completedTasks: 0,
          failedTasks: 0,
        },
        connection: {
          isConnected: false,
          latencyMs: 0,
          averageLatencyMs: 0,
          reconnectAttempts: 0,
        },
        lastUpdated: new Date(),
      }

      render(<ProjectHealthPanel metrics={metrics} />)

      expect(screen.getByText('0.0%')).toBeInTheDocument() // Success rate
      expect(screen.getByText('0ms')).toBeInTheDocument() // Duration
      expect(screen.getByText('Critical')).toBeInTheDocument()
    })

    it('handles maximum safe integer values', () => {
      const metrics: ProjectHealthMetrics = {
        status: 'critical',
        successRate: 100,
        averageDurationMs: Number.MAX_SAFE_INTEGER,
        systemHealth: 100,
        tasks: {
          activeTasks: Number.MAX_SAFE_INTEGER,
          pendingTasks: Number.MAX_SAFE_INTEGER,
          completedTasks: Number.MAX_SAFE_INTEGER,
          failedTasks: Number.MAX_SAFE_INTEGER,
        },
        connection: {
          isConnected: true,
          latencyMs: Number.MAX_SAFE_INTEGER,
          averageLatencyMs: Number.MAX_SAFE_INTEGER,
          reconnectAttempts: Number.MAX_SAFE_INTEGER,
        },
        lastUpdated: new Date(),
      }

      render(<ProjectHealthPanel metrics={metrics} />)

      // Should handle large numbers gracefully
      expect(screen.getByText('100.0%')).toBeInTheDocument()
      // Duration should be formatted appropriately for very large values
      const durationElement = screen.getByText(/h$/) // Should show hours for very large duration
      expect(durationElement).toBeInTheDocument()
    })

    it('handles NaN and Infinity values gracefully', () => {
      const metrics: ProjectHealthMetrics = {
        status: 'unknown',
        successRate: NaN,
        averageDurationMs: Infinity,
        systemHealth: -Infinity,
        tasks: {
          activeTasks: NaN,
          pendingTasks: Infinity,
          completedTasks: -Infinity,
          failedTasks: NaN,
        },
        connection: {
          isConnected: true,
          latencyMs: NaN,
          averageLatencyMs: Infinity,
          reconnectAttempts: -Infinity,
        },
        lastUpdated: new Date(),
      }

      render(<ProjectHealthPanel metrics={metrics} />)

      // Component should not crash and show fallback values
      expect(screen.getByText('Unknown')).toBeInTheDocument()
      expect(screen.getByText('Project Health')).toBeInTheDocument()
    })

    it('handles negative values appropriately', () => {
      const metrics: ProjectHealthMetrics = {
        status: 'critical',
        successRate: -10,
        averageDurationMs: -500,
        systemHealth: -25,
        tasks: {
          activeTasks: -5,
          pendingTasks: -3,
          completedTasks: -100,
          failedTasks: -50,
        },
        connection: {
          isConnected: false,
          latencyMs: -100,
          averageLatencyMs: -200,
          reconnectAttempts: -5,
        },
        lastUpdated: new Date(),
      }

      render(<ProjectHealthPanel metrics={metrics} />)

      // Should handle negative values gracefully
      expect(screen.getByText('Critical')).toBeInTheDocument()
      expect(screen.getByText('Project Health')).toBeInTheDocument()
    })
  })

  describe('Date and Time Edge Cases', () => {
    it('handles very old dates', () => {
      const veryOldDate = new Date('1970-01-01T00:00:00Z')
      const metrics = generateMockHealthMetrics({
        lastUpdated: veryOldDate,
        connection: {
          isConnected: true,
          latencyMs: 45,
          averageLatencyMs: 52,
          reconnectAttempts: 0,
          connectedSince: veryOldDate,
        },
      })

      render(<ProjectHealthPanel metrics={metrics} />)

      // Should show some time indication even for very old dates
      const updatedText = screen.getByText(/Updated/)
      expect(updatedText).toBeInTheDocument()
    })

    it('handles future dates', () => {
      const futureDate = new Date(Date.now() + 86400000) // Tomorrow
      const metrics = generateMockHealthMetrics({
        lastUpdated: futureDate,
        connection: {
          isConnected: true,
          latencyMs: 45,
          averageLatencyMs: 52,
          reconnectAttempts: 0,
          connectedSince: futureDate,
        },
      })

      render(<ProjectHealthPanel metrics={metrics} />)

      // Should handle future dates gracefully
      const updatedText = screen.getByText(/Updated/)
      expect(updatedText).toBeInTheDocument()
    })

    it('handles invalid dates', () => {
      const metrics = generateMockHealthMetrics({
        lastUpdated: new Date('invalid date'),
      })

      render(<ProjectHealthPanel metrics={metrics} />)

      // Should not crash with invalid date
      expect(screen.getByText('Project Health')).toBeInTheDocument()
    })
  })

  describe('Null and Undefined Handling', () => {
    it('handles partial metrics data with missing fields', () => {
      const incompleteMetrics: Partial<ProjectHealthMetrics> = {
        status: 'healthy',
        successRate: 95,
        // Missing averageDurationMs, systemHealth, tasks, connection
        lastUpdated: new Date(),
      }

      render(<ProjectHealthPanel metrics={incompleteMetrics as ProjectHealthMetrics} />)

      expect(screen.getByText('Healthy')).toBeInTheDocument()
      expect(screen.getByText('95.0%')).toBeInTheDocument()
      expect(screen.getByText('--')).toBeInTheDocument() // Missing values shown as placeholders
    })

    it('handles null connection object', () => {
      const metrics = generateMockHealthMetrics({
        connection: null as any,
      })

      render(<ProjectHealthPanel metrics={metrics} showConnectionStatus={true} />)

      // Should not crash and should not show connection status
      expect(screen.getByText('Healthy')).toBeInTheDocument()
      expect(screen.queryByText(/Connected/)).not.toBeInTheDocument()
    })

    it('handles null tasks object', () => {
      const metrics = generateMockHealthMetrics({
        tasks: null as any,
      })

      render(<ProjectHealthPanel metrics={metrics} showDetails={true} />)

      // Should not crash and should handle missing task data
      expect(screen.getByText('Healthy')).toBeInTheDocument()
      expect(screen.queryByText('Task Breakdown')).not.toBeInTheDocument()
    })
  })

  describe('Rapid State Changes', () => {
    it('handles rapid successive status changes', async () => {
      const onStatusChange = vi.fn()
      const { rerender } = render(
        <ProjectHealthPanel
          metrics={generateMockHealthMetrics({ status: 'healthy' })}
          onStatusChange={onStatusChange}
        />
      )

      // Rapidly change status multiple times
      rerender(
        <ProjectHealthPanel
          metrics={generateMockHealthMetrics({ status: 'warning' })}
          onStatusChange={onStatusChange}
        />
      )

      rerender(
        <ProjectHealthPanel
          metrics={generateMockHealthMetrics({ status: 'critical' })}
          onStatusChange={onStatusChange}
        />
      )

      rerender(
        <ProjectHealthPanel
          metrics={generateMockHealthMetrics({ status: 'healthy' })}
          onStatusChange={onStatusChange}
        />
      )

      // Should handle all status changes without issues
      expect(onStatusChange).toHaveBeenCalledWith('healthy')
      expect(onStatusChange).toHaveBeenCalledWith('warning')
      expect(onStatusChange).toHaveBeenCalledWith('critical')
      expect(onStatusChange).toHaveBeenLastCalledWith('healthy')
    })

    it('handles rapid refresh button clicks', async () => {
      const onRefresh = vi.fn()
      render(
        <ProjectHealthPanel
          metrics={generateMockHealthMetrics()}
          onRefresh={onRefresh}
        />
      )

      const refreshButton = screen.getByRole('button', { name: 'Refresh health metrics' })

      // Click rapidly multiple times
      fireEvent.click(refreshButton)
      fireEvent.click(refreshButton)
      fireEvent.click(refreshButton)
      fireEvent.click(refreshButton)

      expect(onRefresh).toHaveBeenCalledTimes(4)
    })

    it('handles loading state changes while data updates', () => {
      const { rerender } = render(
        <ProjectHealthPanel isLoading={true} />
      )

      expect(screen.getByText('Loading health metrics...')).toBeInTheDocument()

      // Switch to loaded state with data
      rerender(
        <ProjectHealthPanel
          metrics={generateMockHealthMetrics()}
          isLoading={false}
        />
      )

      expect(screen.queryByText('Loading health metrics...')).not.toBeInTheDocument()
      expect(screen.getByText('Healthy')).toBeInTheDocument()

      // Switch back to loading
      rerender(
        <ProjectHealthPanel
          metrics={generateMockHealthMetrics()}
          isLoading={true}
        />
      )

      // Should show data while loading (not show loading spinner over existing data)
      expect(screen.getByText('Healthy')).toBeInTheDocument()
      expect(screen.queryByText('Loading health metrics...')).not.toBeInTheDocument()
    })
  })

  describe('Custom Threshold Edge Cases', () => {
    it('handles zero thresholds', () => {
      const metrics = generateMockHealthMetrics({
        successRate: 50,
        systemHealth: 50,
        averageDurationMs: 5000,
      })

      const zeroThresholds = {
        successRateWarning: 0,
        successRateCritical: 0,
        systemHealthWarning: 0,
        systemHealthCritical: 0,
        durationWarning: 0,
        durationCritical: 0,
      }

      render(<ProjectHealthPanel metrics={metrics} thresholds={zeroThresholds} />)

      // With zero thresholds, everything should be healthy
      expect(screen.getByText('Healthy')).toBeInTheDocument()
    })

    it('handles inverted thresholds (warning > critical)', () => {
      const metrics = generateMockHealthMetrics({
        successRate: 85,
      })

      const invertedThresholds = {
        ...DEFAULT_HEALTH_THRESHOLDS,
        successRateWarning: 70, // Lower than critical
        successRateCritical: 90, // Higher than warning
      }

      render(<ProjectHealthPanel metrics={metrics} thresholds={invertedThresholds} />)

      // Should handle gracefully even with illogical thresholds
      expect(screen.getByText('Project Health')).toBeInTheDocument()
    })

    it('handles extremely high thresholds', () => {
      const metrics = generateMockHealthMetrics({
        successRate: 99.99,
        systemHealth: 99.99,
        averageDurationMs: 1,
      })

      const extremeThresholds = {
        successRateWarning: 99.999,
        successRateCritical: 99.9999,
        systemHealthWarning: 99.999,
        systemHealthCritical: 99.9999,
        durationWarning: 0.1,
        durationCritical: 0.01,
      }

      render(<ProjectHealthPanel metrics={metrics} thresholds={extremeThresholds} />)

      // Even excellent metrics should show as critical with extreme thresholds
      expect(screen.getByText('Critical')).toBeInTheDocument()
    })
  })

  describe('Error Boundaries and Resilience', () => {
    it('handles malformed error objects', () => {
      const malformedError = {
        message: 'Something went wrong',
        // Missing standard Error properties
      } as Error

      render(<ProjectHealthPanel error={malformedError} />)

      expect(screen.getByText('Error Loading Health Metrics')).toBeInTheDocument()
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('handles error with no message', () => {
      const errorWithoutMessage = new Error()
      errorWithoutMessage.message = ''

      render(<ProjectHealthPanel error={errorWithoutMessage} />)

      expect(screen.getByText('Error Loading Health Metrics')).toBeInTheDocument()
      // Should handle empty error message gracefully
    })

    it('handles circular reference in error object', () => {
      const circularError: any = new Error('Circular reference error')
      circularError.circular = circularError // Create circular reference

      render(<ProjectHealthPanel error={circularError} />)

      expect(screen.getByText('Error Loading Health Metrics')).toBeInTheDocument()
      expect(screen.getByText('Circular reference error')).toBeInTheDocument()
    })
  })

  describe('Memory and Performance Edge Cases', () => {
    it('handles extremely large task numbers', () => {
      const metrics = generateMockHealthMetrics({
        tasks: {
          activeTasks: 999999999,
          pendingTasks: 999999999,
          completedTasks: 999999999,
          failedTasks: 999999999,
        },
      })

      render(<ProjectHealthPanel metrics={metrics} showDetails={true} />)

      // Should format large numbers with locale-appropriate separators
      const formattedNumbers = screen.getAllByText(/999,999,999/)
      expect(formattedNumbers.length).toBeGreaterThan(0)
    })

    it('handles frequent re-renders without memory leaks', () => {
      const { rerender } = render(<ProjectHealthPanel />)

      // Simulate many re-renders
      for (let i = 0; i < 100; i++) {
        rerender(
          <ProjectHealthPanel
            metrics={generateMockHealthMetrics({
              successRate: Math.random() * 100,
              averageDurationMs: Math.random() * 10000,
              systemHealth: Math.random() * 100,
            })}
          />
        )
      }

      // Should complete without crashing
      expect(screen.getByText('Project Health')).toBeInTheDocument()
    })

    it('handles component unmounting during async operations', () => {
      const onRefresh = vi.fn()
      const { unmount } = render(
        <ProjectHealthPanel
          metrics={generateMockHealthMetrics()}
          onRefresh={onRefresh}
        />
      )

      const refreshButton = screen.getByRole('button', { name: 'Refresh health metrics' })
      fireEvent.click(refreshButton)

      // Unmount immediately after triggering async operation
      unmount()

      // Should not cause any errors or warnings
      expect(onRefresh).toHaveBeenCalledTimes(1)
    })
  })
})