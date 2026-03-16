/**
 * Integration tests for WebSocketConnectionIndicator state transitions
 * Verifies connection indicator state changes and timing behavior
 * Tests real-world connection scenarios and timing events
 */

import React from 'react'
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebSocketConnectionIndicator } from '../WebSocketConnectionIndicator'
import type { WebSocketConnectionHealth } from '@/types/websocket-connection'

// Mock the utilities
vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' '),
}))

// Mock the tooltip with state tracking
vi.mock('../WebSocketConnectionTooltip', () => ({
  WebSocketConnectionTooltip: ({ children, health }: { children: React.ReactNode; health: WebSocketConnectionHealth }) => (
    <div data-testid="websocket-tooltip" data-health={JSON.stringify(health)}>
      {children}
    </div>
  ),
}))

// Simulated connection health manager
class ConnectionHealthSimulator {
  private listeners: Array<(health: WebSocketConnectionHealth) => void> = []
  private currentHealth: WebSocketConnectionHealth

  constructor() {
    this.currentHealth = {
      status: 'disconnected',
      isHealthy: false,
      latencyMs: null,
      averageLatencyMs: null,
      reconnectAttempts: 0,
      maxReconnectAttempts: 10,
      consecutiveFailures: 0,
      lastHealthyAt: null,
      lastCheckAt: new Date(),
      connectionUptime: null,
    }
  }

  subscribe(listener: (health: WebSocketConnectionHealth) => void) {
    this.listeners.push(listener)
    listener(this.currentHealth) // Immediate callback with current state
  }

  unsubscribe(listener: (health: WebSocketConnectionHealth) => void) {
    this.listeners = this.listeners.filter(l => l !== listener)
  }

  setState(updates: Partial<WebSocketConnectionHealth>) {
    this.currentHealth = {
      ...this.currentHealth,
      ...updates,
      lastCheckAt: new Date(),
    }
    this.listeners.forEach(listener => listener(this.currentHealth))
  }

  getCurrentHealth() {
    return this.currentHealth
  }

  // Simulate connection lifecycle
  async connectLifecycle() {
    // Start connecting
    this.setState({ status: 'connecting', isHealthy: false })
    await new Promise(resolve => setTimeout(resolve, 100))

    // Connected successfully
    this.setState({
      status: 'connected',
      isHealthy: true,
      latencyMs: 45,
      averageLatencyMs: 50,
      reconnectAttempts: 0,
      consecutiveFailures: 0,
      lastHealthyAt: new Date(),
      connectionUptime: 0
    })
  }

  async disconnectLifecycle() {
    // Connection lost
    this.setState({
      status: 'disconnected',
      isHealthy: false,
      latencyMs: null,
      consecutiveFailures: this.currentHealth.consecutiveFailures + 1,
      connectionUptime: null
    })
  }

  async reconnectLifecycle(maxAttempts: number = 5) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Reconnecting with attempt count
      this.setState({
        status: 'reconnecting',
        isHealthy: false,
        reconnectAttempts: attempt,
        latencyMs: null
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      // Simulate success on last attempt
      if (attempt === maxAttempts) {
        await this.connectLifecycle()
        return
      }
    }
  }

  async errorLifecycle() {
    this.setState({
      status: 'error',
      isHealthy: false,
      latencyMs: null,
      consecutiveFailures: this.currentHealth.consecutiveFailures + 1
    })
  }
}

// Real-time connection indicator component
interface ConnectionTestProps {
  simulator: ConnectionHealthSimulator
  onStateChange?: (health: WebSocketConnectionHealth) => void
  showLatency?: boolean
  showReconnectAttempts?: boolean
  size?: 'sm' | 'md' | 'lg'
  animated?: boolean
}

const ConnectionTester: React.FC<ConnectionTestProps> = ({
  simulator,
  onStateChange,
  showLatency = false,
  showReconnectAttempts = true,
  size = 'md',
  animated = true
}) => {
  const [health, setHealth] = React.useState<WebSocketConnectionHealth>(simulator.getCurrentHealth())

  React.useEffect(() => {
    const handleHealthUpdate = (newHealth: WebSocketConnectionHealth) => {
      setHealth(newHealth)
      onStateChange?.(newHealth)
    }

    simulator.subscribe(handleHealthUpdate)

    return () => {
      simulator.unsubscribe(handleHealthUpdate)
    }
  }, [simulator, onStateChange])

  return (
    <div data-testid="connection-tester" data-current-status={health.status}>
      <WebSocketConnectionIndicator
        healthOverride={health}
        showLatency={showLatency}
        showReconnectAttempts={showReconnectAttempts}
        size={size}
        animated={animated}
        showTooltip
      />
      <div data-testid="debug-info">
        <div data-testid="debug-status">{health.status}</div>
        <div data-testid="debug-latency">{health.latencyMs || 'null'}</div>
        <div data-testid="debug-attempts">{health.reconnectAttempts}</div>
        <div data-testid="debug-failures">{health.consecutiveFailures}</div>
        <div data-testid="debug-healthy">{health.isHealthy.toString()}</div>
      </div>
    </div>
  )
}

describe('WebSocketConnectionIndicator - State Transition Integration Tests', () => {
  let simulator: ConnectionHealthSimulator

  beforeEach(() => {
    vi.clearAllMocks()
    simulator = new ConnectionHealthSimulator()
  })

  describe('Connection Lifecycle Transitions', () => {
    it('transitions through complete connection lifecycle', async () => {
      const stateChanges: WebSocketConnectionHealth[] = []

      render(
        <ConnectionTester
          simulator={simulator}
          onStateChange={(health) => stateChanges.push({ ...health })}
          showLatency
        />
      )

      // Initial disconnected state
      expect(screen.getByText('Disconnected')).toBeInTheDocument()
      expect(screen.getByTestId('debug-status')).toHaveTextContent('disconnected')

      // Start connecting state
      act(() => {
        simulator.setState({ status: 'connecting', isHealthy: false })
      })

      // Should show connecting state
      expect(screen.getByText('Connecting...')).toBeInTheDocument()
      expect(screen.getByTestId('debug-status')).toHaveTextContent('connecting')

      // Move to connected state
      act(() => {
        simulator.setState({
          status: 'connected',
          isHealthy: true,
          latencyMs: 45,
          averageLatencyMs: 50,
          reconnectAttempts: 0,
          consecutiveFailures: 0,
          lastHealthyAt: new Date(),
          connectionUptime: 0
        })
      })

      // Should show connected state with latency
      expect(screen.getByText('45ms')).toBeInTheDocument()
      expect(screen.getByTestId('debug-status')).toHaveTextContent('connected')
      expect(screen.getByTestId('debug-healthy')).toHaveTextContent('true')

      // Verify state change sequence
      expect(stateChanges.length).toBeGreaterThan(0)
      expect(stateChanges.some(s => s.status === 'disconnected')).toBe(true)
      expect(stateChanges.some(s => s.status === 'connecting')).toBe(true)
      expect(stateChanges.some(s => s.status === 'connected')).toBe(true)
    })

    it('handles disconnection and reconnection cycles', () => {
      render(
        <ConnectionTester
          simulator={simulator}
          showReconnectAttempts
        />
      )

      // Start connected
      act(() => {
        simulator.setState({
          status: 'connected',
          isHealthy: true,
          latencyMs: 50
        })
      })

      expect(screen.getByText('Connected')).toBeInTheDocument()

      // Simulate disconnection
      act(() => {
        simulator.setState({
          status: 'disconnected',
          isHealthy: false,
          latencyMs: null,
          consecutiveFailures: 1,
          connectionUptime: null
        })
      })

      expect(screen.getByText('Disconnected')).toBeInTheDocument()
      expect(screen.getByTestId('debug-failures')).toHaveTextContent('1')

      // Start reconnection process
      act(() => {
        simulator.setState({
          status: 'reconnecting',
          isHealthy: false,
          reconnectAttempts: 1,
          maxReconnectAttempts: 10,
          latencyMs: null
        })
      })

      // Should show reconnection attempts
      expect(screen.getByText('Reconnecting (1/10)')).toBeInTheDocument()

      // More attempts
      act(() => {
        simulator.setState({
          status: 'reconnecting',
          reconnectAttempts: 2
        })
      })

      expect(screen.getByText('Reconnecting (2/10)')).toBeInTheDocument()

      // Complete reconnection
      act(() => {
        simulator.setState({
          status: 'connected',
          isHealthy: true,
          reconnectAttempts: 0,
          latencyMs: 45
        })
      })

      expect(screen.getByText('Connected')).toBeInTheDocument()
      expect(screen.getByTestId('debug-attempts')).toHaveTextContent('0')
    })

    it('handles error states and recovery', () => {
      render(
        <ConnectionTester
          simulator={simulator}
          animated={true}
        />
      )

      // Simulate connection error
      act(() => {
        simulator.setState({
          status: 'error',
          isHealthy: false,
          latencyMs: null,
          consecutiveFailures: 1
        })
      })

      expect(screen.getByText('Connection Error')).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveClass('animate-pulse')

      // Simulate recovery
      act(() => {
        simulator.setState({
          status: 'connected',
          isHealthy: true,
          latencyMs: 45,
          consecutiveFailures: 0
        })
      })

      expect(screen.getByText('Connected')).toBeInTheDocument()
      expect(screen.getByRole('status')).not.toHaveClass('animate-pulse')
    })
  })

  describe('Real-time Latency Updates', () => {
    it('updates latency display in real-time', () => {
      render(
        <ConnectionTester
          simulator={simulator}
          showLatency
        />
      )

      // Start connected
      act(() => {
        simulator.setState({
          status: 'connected',
          isHealthy: true,
          latencyMs: 25
        })
      })

      expect(screen.getByText('25ms')).toBeInTheDocument()

      // Update latency multiple times
      const latencies = [30, 45, 60, 100, 150]

      for (const latency of latencies) {
        act(() => {
          simulator.setState({ latencyMs: latency })
        })

        expect(screen.getByText(`${latency}ms`)).toBeInTheDocument()
      }
    })

    it('formats high latency values correctly', () => {
      render(
        <ConnectionTester
          simulator={simulator}
          showLatency
        />
      )

      const latencyTests = [
        { input: 1500, expected: '1.5s' },
        { input: 2000, expected: '2.0s' },
        { input: 5500, expected: '5.5s' },
        { input: 10000, expected: '10.0s' },
      ]

      for (const { input, expected } of latencyTests) {
        act(() => {
          simulator.setState({
            status: 'connected',
            isHealthy: true,
            latencyMs: input
          })
        })

        expect(screen.getByText(expected)).toBeInTheDocument()
      }
    })

    it('handles latency spikes and recoveries', () => {
      render(
        <ConnectionTester
          simulator={simulator}
          showLatency
        />
      )

      // Normal latency
      act(() => {
        simulator.setState({
          status: 'connected',
          isHealthy: true,
          latencyMs: 50
        })
      })

      expect(screen.getByText('50ms')).toBeInTheDocument()

      // Latency spike
      act(() => {
        simulator.setState({ latencyMs: 2000 })
      })

      expect(screen.getByText('2.0s')).toBeInTheDocument()

      // Recovery
      act(() => {
        simulator.setState({ latencyMs: 45 })
      })

      expect(screen.getByText('45ms')).toBeInTheDocument()
    })
  })

  describe('Reconnection Attempt Tracking', () => {
    it('tracks reconnection attempts accurately', () => {
      render(
        <ConnectionTester
          simulator={simulator}
          showReconnectAttempts
        />
      )

      // Start reconnecting
      for (let attempt = 1; attempt <= 5; attempt++) {
        act(() => {
          simulator.setState({
            status: 'reconnecting',
            reconnectAttempts: attempt,
            maxReconnectAttempts: 10
          })
        })

        expect(screen.getByText(`Reconnecting (${attempt}/10)`)).toBeInTheDocument()
        expect(screen.getByTestId('debug-attempts')).toHaveTextContent(attempt.toString())
      }
    })

    it('handles maximum reconnection attempts reached', () => {
      render(
        <ConnectionTester
          simulator={simulator}
          showReconnectAttempts
        />
      )

      // Reach maximum attempts
      act(() => {
        simulator.setState({
          status: 'reconnecting',
          reconnectAttempts: 10,
          maxReconnectAttempts: 10
        })
      })

      expect(screen.getByText('Reconnecting (10/10)')).toBeInTheDocument()

      // Transition to error state
      act(() => {
        simulator.setState({
          status: 'error',
          consecutiveFailures: 10
        })
      })

      expect(screen.getByText('Connection Error')).toBeInTheDocument()
    })

    it('resets attempt counter on successful connection', () => {
      render(
        <ConnectionTester
          simulator={simulator}
          showReconnectAttempts
        />
      )

      // Failed attempts
      act(() => {
        simulator.setState({
          status: 'reconnecting',
          reconnectAttempts: 3,
          maxReconnectAttempts: 10
        })
      })

      expect(screen.getByText('Reconnecting (3/10)')).toBeInTheDocument()

      // Successful connection
      act(() => {
        simulator.setState({
          status: 'connected',
          isHealthy: true,
          reconnectAttempts: 0,
          latencyMs: 45
        })
      })

      expect(screen.getByText('Connected')).toBeInTheDocument()
      expect(screen.getByTestId('debug-attempts')).toHaveTextContent('0')
    })
  })

  describe('Animation State Management', () => {
    it('applies correct animations during state transitions', () => {
      render(
        <ConnectionTester
          simulator={simulator}
          animated={true}
        />
      )

      // Connecting state should animate
      act(() => {
        simulator.setState({ status: 'connecting' })
      })

      expect(screen.getByRole('status')).toHaveClass('animate-pulse')

      // Connected state should not animate
      act(() => {
        simulator.setState({
          status: 'connected',
          isHealthy: true,
          latencyMs: 50
        })
      })

      expect(screen.getByRole('status')).not.toHaveClass('animate-pulse')

      // Error state should animate
      act(() => {
        simulator.setState({ status: 'error' })
      })

      expect(screen.getByRole('status')).toHaveClass('animate-pulse')
    })

    it('disables animations when animated prop is false', () => {
      render(
        <ConnectionTester
          simulator={simulator}
          animated={false}
        />
      )

      const animatedStates = ['connecting', 'reconnecting', 'disconnected', 'error']

      for (const status of animatedStates) {
        act(() => {
          simulator.setState({ status: status as any })
        })

        expect(screen.getByRole('status')).not.toHaveClass('animate-pulse')
      }
    })
  })

  describe('Tooltip State Synchronization', () => {
    it('updates tooltip health data with state changes', () => {
      render(
        <ConnectionTester
          simulator={simulator}
        />
      )

      // Update to connected state
      const connectedHealth = {
        status: 'connected' as const,
        isHealthy: true,
        latencyMs: 75,
        averageLatencyMs: 80,
        reconnectAttempts: 0,
        consecutiveFailures: 0
      }

      act(() => {
        simulator.setState(connectedHealth)
      })

      const tooltip = screen.getByTestId('websocket-tooltip')
      const healthData = JSON.parse(tooltip.getAttribute('data-health') || '{}')
      expect(healthData.status).toBe('connected')
      expect(healthData.latencyMs).toBe(75)
      expect(healthData.isHealthy).toBe(true)

      // Update to error state
      act(() => {
        simulator.setState({
          status: 'error',
          isHealthy: false,
          latencyMs: null,
          consecutiveFailures: 5
        })
      })

      const updatedTooltip = screen.getByTestId('websocket-tooltip')
      const updatedHealthData = JSON.parse(updatedTooltip.getAttribute('data-health') || '{}')
      expect(updatedHealthData.status).toBe('error')
      expect(updatedHealthData.latencyMs).toBe(null)
      expect(updatedHealthData.consecutiveFailures).toBe(5)
    })
  })

  describe('Performance Under Rapid State Changes', () => {
    it('handles rapid state transitions efficiently', () => {
      const stateChanges: string[] = []

      render(
        <ConnectionTester
          simulator={simulator}
          onStateChange={(health) => stateChanges.push(health.status)}
        />
      )

      // Rapid state changes - synchronous, no timers needed
      act(() => {
        const states = ['connecting', 'connected', 'disconnected', 'reconnecting', 'error', 'connected']

        for (let i = 0; i < 50; i++) {
          const status = states[i % states.length]
          simulator.setState({
            status: status as any,
            isHealthy: status === 'connected',
            latencyMs: status === 'connected' ? Math.random() * 200 : null,
            reconnectAttempts: status === 'reconnecting' ? (i % 10) + 1 : 0
          })
        }
      })

      // Should still be functional
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(stateChanges.length).toBeGreaterThan(0)
    })

    it('batches multiple simultaneous updates correctly', () => {
      render(
        <ConnectionTester
          simulator={simulator}
          showLatency
          showReconnectAttempts
        />
      )

      // Simultaneous property updates
      act(() => {
        simulator.setState({
          status: 'connected',
          isHealthy: true,
          latencyMs: 125,
          averageLatencyMs: 130,
          reconnectAttempts: 0,
          consecutiveFailures: 0,
          connectionUptime: 3600000
        })
      })

      expect(screen.getByText('125ms')).toBeInTheDocument()
      expect(screen.getByTestId('debug-healthy')).toHaveTextContent('true')
      expect(screen.getByTestId('debug-attempts')).toHaveTextContent('0')
    })
  })
})