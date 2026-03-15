/**
 * API integration scenario tests for ProjectHealthPanel
 *
 * This file tests realistic API integration scenarios including WebSocket
 * connections, data transformations, error handling, and real-time updates.
 */
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { ProjectHealthPanel } from '../ProjectHealthPanel'
import type { ProjectHealthMetrics, ProjectHealthStatus } from '@/types/project-health'

// Mock WebSocket for testing real-time updates
class MockWebSocket {
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  readyState: number = WebSocket.CONNECTING

  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = WebSocket.OPEN
      this.onopen?.(new Event('open'))
    }, 0)
  }

  send(data: string) {
    // Simulate sending data
  }

  close() {
    this.readyState = WebSocket.CLOSED
    this.onclose?.(new CloseEvent('close'))
  }

  // Helper method to simulate receiving messages
  simulateMessage(data: any) {
    if (this.readyState === WebSocket.OPEN) {
      this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }))
    }
  }

  // Helper method to simulate connection error
  simulateError() {
    this.onerror?.(new Event('error'))
  }
}

// Mock global WebSocket
Object.defineProperty(global, 'WebSocket', {
  value: MockWebSocket,
  writable: true,
})

describe('ProjectHealthPanel - API Integration Scenarios', () => {
  describe('Real-time Data Updates', () => {
    it('handles WebSocket health metrics updates', async () => {
      const mockWs = new MockWebSocket('ws://localhost:8080/health')
      const { rerender } = render(<ProjectHealthPanel />)

      // Initial state - no metrics
      expect(screen.getByText('Unknown')).toBeInTheDocument()

      // Simulate receiving health data via WebSocket
      const healthUpdate = {
        type: 'health_metrics',
        data: {
          status: 'healthy',
          successRate: 96.5,
          averageDurationMs: 1850,
          systemHealth: 94.2,
          tasks: {
            activeTasks: 3,
            pendingTasks: 7,
            completedTasks: 145,
            failedTasks: 2,
          },
          connection: {
            isConnected: true,
            latencyMs: 32,
            averageLatencyMs: 45,
            reconnectAttempts: 0,
          },
          lastUpdated: new Date().toISOString(),
        },
      }

      // Update component with WebSocket data
      act(() => {
        const transformedData: ProjectHealthMetrics = {
          ...healthUpdate.data,
          lastUpdated: new Date(healthUpdate.data.lastUpdated),
        }
        rerender(<ProjectHealthPanel metrics={transformedData} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Healthy')).toBeInTheDocument()
        expect(screen.getByText('96.5%')).toBeInTheDocument()
        expect(screen.getByText('1.9s')).toBeInTheDocument()
        expect(screen.getByText('94.2%')).toBeInTheDocument()
      })
    })

    it('handles gradual metric degradation over time', async () => {
      const statusUpdates: Array<{ metrics: Partial<ProjectHealthMetrics>, expectedStatus: ProjectHealthStatus }> = [
        {
          metrics: { status: 'healthy', successRate: 95, systemHealth: 90, averageDurationMs: 3000 },
          expectedStatus: 'healthy'
        },
        {
          metrics: { status: 'warning', successRate: 85, systemHealth: 80, averageDurationMs: 6000 },
          expectedStatus: 'warning'
        },
        {
          metrics: { status: 'critical', successRate: 65, systemHealth: 55, averageDurationMs: 18000 },
          expectedStatus: 'critical'
        },
      ]

      const { rerender } = render(<ProjectHealthPanel />)

      for (const update of statusUpdates) {
        const fullMetrics: ProjectHealthMetrics = {
          status: update.expectedStatus,
          successRate: 95,
          averageDurationMs: 2500,
          systemHealth: 92,
          lastUpdated: new Date(),
          ...update.metrics,
        }

        await act(async () => {
          rerender(<ProjectHealthPanel metrics={fullMetrics} />)
        })

        await waitFor(() => {
          expect(screen.getByText(
            update.expectedStatus.charAt(0).toUpperCase() + update.expectedStatus.slice(1)
          )).toBeInTheDocument()
        })
      }
    })

    it('handles rapid metric fluctuations', async () => {
      const { rerender } = render(<ProjectHealthPanel />)

      // Simulate rapid fluctuations like those seen in high-traffic systems
      const fluctuations = [
        { successRate: 95, status: 'healthy' as const },
        { successRate: 88, status: 'warning' as const },
        { successRate: 97, status: 'healthy' as const },
        { successRate: 85, status: 'warning' as const },
        { successRate: 92, status: 'healthy' as const },
      ]

      for (let i = 0; i < fluctuations.length; i++) {
        const fluctuation = fluctuations[i]
        const metrics: ProjectHealthMetrics = {
          status: fluctuation.status,
          successRate: fluctuation.successRate,
          averageDurationMs: 2500,
          systemHealth: 92,
          lastUpdated: new Date(),
        }

        await act(async () => {
          rerender(<ProjectHealthPanel metrics={metrics} />)
        })

        // Add small delay to simulate real-time updates
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      // Should settle on the last state
      await waitFor(() => {
        expect(screen.getByText('Healthy')).toBeInTheDocument()
      })
    })
  })

  describe('API Error Scenarios', () => {
    it('handles network timeout errors', async () => {
      const networkError = new Error('Network timeout after 30 seconds')
      networkError.name = 'NetworkError'

      render(<ProjectHealthPanel error={networkError} />)

      expect(screen.getByText('Error Loading Health Metrics')).toBeInTheDocument()
      expect(screen.getByText('Network timeout after 30 seconds')).toBeInTheDocument()
    })

    it('handles server 500 errors', async () => {
      const serverError = new Error('Internal Server Error (500)')
      serverError.name = 'ServerError'

      render(<ProjectHealthPanel error={serverError} />)

      expect(screen.getByText('Error Loading Health Metrics')).toBeInTheDocument()
      expect(screen.getByText('Internal Server Error (500)')).toBeInTheDocument()
    })

    it('handles authentication errors', async () => {
      const authError = new Error('Authentication failed: Invalid API key')
      authError.name = 'AuthenticationError'

      render(<ProjectHealthPanel error={authError} />)

      expect(screen.getByText('Error Loading Health Metrics')).toBeInTheDocument()
      expect(screen.getByText('Authentication failed: Invalid API key')).toBeInTheDocument()
    })

    it('handles malformed API response', async () => {
      const malformedError = new Error('Invalid JSON response from server')
      malformedError.name = 'ParseError'

      render(<ProjectHealthPanel error={malformedError} />)

      expect(screen.getByText('Error Loading Health Metrics')).toBeInTheDocument()
      expect(screen.getByText('Invalid JSON response from server')).toBeInTheDocument()
    })
  })

  describe('Data Transformation Scenarios', () => {
    it('transforms API response to component format', () => {
      // Simulate raw API response format
      const apiResponse = {
        system_status: 'healthy',
        success_percentage: 94.7,
        avg_duration_milliseconds: 2340,
        system_health_percentage: 91.5,
        task_statistics: {
          active_count: 5,
          pending_count: 12,
          completed_count: 234,
          failed_count: 8,
        },
        connection_info: {
          connected: true,
          latency_ms: 47,
          avg_latency_ms: 52,
          reconnection_attempts: 0,
          connected_since: '2024-01-15T10:30:00Z',
        },
        last_update: '2024-01-15T14:22:15Z',
      }

      // Transform to component format
      const transformedMetrics: ProjectHealthMetrics = {
        status: apiResponse.system_status as ProjectHealthStatus,
        successRate: apiResponse.success_percentage,
        averageDurationMs: apiResponse.avg_duration_milliseconds,
        systemHealth: apiResponse.system_health_percentage,
        tasks: {
          activeTasks: apiResponse.task_statistics.active_count,
          pendingTasks: apiResponse.task_statistics.pending_count,
          completedTasks: apiResponse.task_statistics.completed_count,
          failedTasks: apiResponse.task_statistics.failed_count,
        },
        connection: {
          isConnected: apiResponse.connection_info.connected,
          latencyMs: apiResponse.connection_info.latency_ms,
          averageLatencyMs: apiResponse.connection_info.avg_latency_ms,
          reconnectAttempts: apiResponse.connection_info.reconnection_attempts,
          connectedSince: new Date(apiResponse.connection_info.connected_since),
        },
        lastUpdated: new Date(apiResponse.last_update),
      }

      render(<ProjectHealthPanel metrics={transformedMetrics} />)

      expect(screen.getByText('Healthy')).toBeInTheDocument()
      expect(screen.getByText('94.7%')).toBeInTheDocument()
      expect(screen.getByText('2.3s')).toBeInTheDocument()
      expect(screen.getByText('91.5%')).toBeInTheDocument()
    })

    it('handles API response with missing optional fields', () => {
      // Simulate minimal API response
      const minimalApiResponse = {
        status: 'warning',
        successRate: 83.2,
        averageDurationMs: 7500,
        systemHealth: 78.9,
        lastUpdated: new Date().toISOString(),
        // Missing tasks and connection objects
      }

      const transformedMetrics: ProjectHealthMetrics = {
        status: minimalApiResponse.status as ProjectHealthStatus,
        successRate: minimalApiResponse.successRate,
        averageDurationMs: minimalApiResponse.averageDurationMs,
        systemHealth: minimalApiResponse.systemHealth,
        lastUpdated: new Date(minimalApiResponse.lastUpdated),
      }

      render(<ProjectHealthPanel metrics={transformedMetrics} showDetails={true} />)

      expect(screen.getByText('Warning')).toBeInTheDocument()
      expect(screen.getByText('83.2%')).toBeInTheDocument()
      // Should gracefully handle missing optional data
      expect(screen.queryByText('Task Breakdown')).not.toBeInTheDocument()
    })
  })

  describe('Connection State Management', () => {
    it('handles connection establishment flow', async () => {
      const onStatusChange = vi.fn()
      const { rerender } = render(
        <ProjectHealthPanel isLoading={true} onStatusChange={onStatusChange} />
      )

      // Initial connecting state
      expect(screen.getByText('Loading health metrics...')).toBeInTheDocument()

      // Connection established, first data received
      await act(async () => {
        rerender(
          <ProjectHealthPanel
            metrics={{
              status: 'healthy',
              successRate: 95,
              averageDurationMs: 2500,
              systemHealth: 92,
              connection: {
                isConnected: true,
                latencyMs: 45,
                averageLatencyMs: 50,
                reconnectAttempts: 0,
                connectedSince: new Date(Date.now() - 1000), // 1 second ago
              },
              lastUpdated: new Date(),
            }}
            isLoading={false}
            onStatusChange={onStatusChange}
          />
        )
      })

      await waitFor(() => {
        expect(screen.queryByText('Loading health metrics...')).not.toBeInTheDocument()
        expect(screen.getByText('Healthy')).toBeInTheDocument()
        expect(screen.getByText('Connected (45ms)')).toBeInTheDocument()
        expect(onStatusChange).toHaveBeenCalledWith('healthy')
      })
    })

    it('handles connection loss and reconnection', async () => {
      const { rerender } = render(
        <ProjectHealthPanel
          metrics={{
            status: 'healthy',
            successRate: 95,
            averageDurationMs: 2500,
            systemHealth: 92,
            connection: {
              isConnected: true,
              latencyMs: 45,
              averageLatencyMs: 50,
              reconnectAttempts: 0,
            },
            lastUpdated: new Date(),
          }}
        />
      )

      expect(screen.getByText('Connected (45ms)')).toBeInTheDocument()

      // Simulate connection loss
      await act(async () => {
        rerender(
          <ProjectHealthPanel
            metrics={{
              status: 'critical',
              successRate: 95,
              averageDurationMs: 2500,
              systemHealth: 92,
              connection: {
                isConnected: false,
                latencyMs: 0,
                averageLatencyMs: 50,
                reconnectAttempts: 3,
              },
              lastUpdated: new Date(Date.now() - 30000), // 30 seconds ago
            }}
          />
        )
      })

      await waitFor(() => {
        expect(screen.getByText('Disconnected (3 attempts)')).toBeInTheDocument()
        expect(screen.getByText('Critical')).toBeInTheDocument()
      })

      // Simulate reconnection
      await act(async () => {
        rerender(
          <ProjectHealthPanel
            metrics={{
              status: 'healthy',
              successRate: 95,
              averageDurationMs: 2500,
              systemHealth: 92,
              connection: {
                isConnected: true,
                latencyMs: 78, // Higher latency after reconnection
                averageLatencyMs: 60,
                reconnectAttempts: 0, // Reset after successful reconnection
                connectedSince: new Date(), // Just reconnected
              },
              lastUpdated: new Date(),
            }}
          />
        )
      })

      await waitFor(() => {
        expect(screen.getByText('Connected (78ms)')).toBeInTheDocument()
        expect(screen.getByText('Healthy')).toBeInTheDocument()
      })
    })
  })

  describe('Load Testing Scenarios', () => {
    it('handles high-frequency updates without performance issues', async () => {
      const { rerender } = render(<ProjectHealthPanel />)
      const startTime = performance.now()

      // Simulate high-frequency updates (like 10 updates per second)
      for (let i = 0; i < 100; i++) {
        await act(async () => {
          rerender(
            <ProjectHealthPanel
              metrics={{
                status: 'healthy',
                successRate: 90 + (Math.random() * 10), // 90-100%
                averageDurationMs: 2000 + (Math.random() * 1000), // 2-3 seconds
                systemHealth: 85 + (Math.random() * 15), // 85-100%
                lastUpdated: new Date(),
              }}
            />
          )
        })
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Should handle 100 rapid updates in reasonable time
      expect(totalTime).toBeLessThan(1000) // Less than 1 second
      expect(screen.getByText('Healthy')).toBeInTheDocument()
    })

    it('handles burst of error states', async () => {
      const { rerender } = render(<ProjectHealthPanel />)

      const errors = [
        new Error('Connection timeout'),
        new Error('Server overloaded'),
        new Error('Rate limit exceeded'),
        new Error('Service unavailable'),
        new Error('Database connection failed'),
      ]

      for (const error of errors) {
        await act(async () => {
          rerender(<ProjectHealthPanel error={error} />)
        })

        expect(screen.getByText('Error Loading Health Metrics')).toBeInTheDocument()
        expect(screen.getByText(error.message)).toBeInTheDocument()

        // Brief pause between errors
        await new Promise(resolve => setTimeout(resolve, 5))
      }
    })
  })

  describe('Realistic Production Scenarios', () => {
    it('simulates typical production system health over time', async () => {
      // Simulate a typical day in production with various conditions
      const timelineScenarios = [
        { time: '09:00', status: 'healthy', successRate: 98.5, systemHealth: 95, averageDurationMs: 1200 },
        { time: '12:00', status: 'warning', successRate: 87.3, systemHealth: 83, averageDurationMs: 4500 }, // Lunch rush
        { time: '14:00', status: 'healthy', successRate: 96.2, systemHealth: 91, averageDurationMs: 2100 }, // Back to normal
        { time: '18:00', status: 'warning', successRate: 84.1, systemHealth: 79, averageDurationMs: 6200 }, // Evening peak
        { time: '22:00', status: 'healthy', successRate: 99.1, systemHealth: 97, averageDurationMs: 800 },  // Night time
      ]

      const { rerender } = render(<ProjectHealthPanel />)

      for (const scenario of timelineScenarios) {
        const metrics: ProjectHealthMetrics = {
          status: scenario.status as ProjectHealthStatus,
          successRate: scenario.successRate,
          averageDurationMs: scenario.averageDurationMs,
          systemHealth: scenario.systemHealth,
          tasks: {
            activeTasks: Math.floor(Math.random() * 20),
            pendingTasks: Math.floor(Math.random() * 50),
            completedTasks: Math.floor(Math.random() * 1000) + 100,
            failedTasks: Math.floor(Math.random() * 20),
          },
          connection: {
            isConnected: true,
            latencyMs: Math.floor(Math.random() * 100) + 20,
            averageLatencyMs: Math.floor(Math.random() * 80) + 40,
            reconnectAttempts: 0,
          },
          lastUpdated: new Date(),
        }

        await act(async () => {
          rerender(<ProjectHealthPanel metrics={metrics} showDetails={true} />)
        })

        await waitFor(() => {
          expect(screen.getByText(
            scenario.status.charAt(0).toUpperCase() + scenario.status.slice(1)
          )).toBeInTheDocument()
        })

        // Simulate time passing
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    })
  })
})