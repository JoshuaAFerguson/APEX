/**
 * Comprehensive tests for WebSocketConnectionIndicator component
 * Covers all acceptance criteria scenarios including:
 * - Connection state transitions and timing
 * - Visual indicator variations and animations
 * - Edge cases and error handling
 * - Real-time state updates
 * - Accessibility compliance
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebSocketConnectionIndicator } from '../WebSocketConnectionIndicator'
import type { WebSocketConnectionHealth } from '@/types/websocket-connection'

// Mock the cn utility function
vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' '),
}))

// Mock functions are now inlined below

vi.mock('../WebSocketConnectionTooltip', () => ({
  WebSocketConnectionTooltip: ({ children, health }: { children: React.ReactNode; health: WebSocketConnectionHealth }) => (
    <div data-testid="websocket-tooltip" data-health={JSON.stringify(health)}>
      {children}
      {health.showTooltip !== false && (
        <div data-testid="tooltip-content" role="tooltip">
          <div data-testid="tooltip-status">{health.status}</div>
          <div data-testid="tooltip-latency">{health.latencyMs}ms</div>
          <div data-testid="tooltip-reconnect-attempts">{health.reconnectAttempts}</div>
        </div>
      )}
    </div>
  ),
}))

// Controllable mock hook state
let mockHookHealth: WebSocketConnectionHealth = {
  status: 'connected',
  isHealthy: true,
  latencyMs: 45,
  averageLatencyMs: 52,
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
  consecutiveFailures: 0,
  lastHealthyAt: new Date(),
  lastCheckAt: new Date(),
  connectionUptime: 3600000, // 1 hour
}

// Mock the hook with default values that uses the mockHookHealth variable
vi.mock('@/hooks/useWebSocketConnection', () => ({
  useWebSocketConnection: () => mockHookHealth,
}))

// Test data for comprehensive state coverage
const healthStateVariations: Array<{
  name: string
  health: Partial<WebSocketConnectionHealth>
  expectedText: string
  expectedClasses: string[]
}> = [
  {
    name: 'healthy connected',
    health: { status: 'connected', isHealthy: true, latencyMs: 25 },
    expectedText: 'Connected',
    expectedClasses: ['bg-green-950/50', 'text-green-400', 'border-green-900']
  },
  {
    name: 'connected with high latency',
    health: { status: 'connected', isHealthy: true, latencyMs: 500 },
    expectedText: 'Connected',
    expectedClasses: ['bg-green-950/50', 'text-green-400', 'border-green-900']
  },
  {
    name: 'disconnected',
    health: { status: 'disconnected', isHealthy: false, latencyMs: null },
    expectedText: 'Disconnected',
    expectedClasses: ['bg-red-950/50', 'text-red-400', 'border-red-900']
  },
  {
    name: 'connecting',
    health: { status: 'connecting', isHealthy: false, latencyMs: null },
    expectedText: 'Connecting...',
    expectedClasses: ['bg-apex-950/50', 'text-apex-400', 'border-apex-900']
  },
  {
    name: 'reconnecting with attempts',
    health: {
      status: 'reconnecting',
      isHealthy: false,
      latencyMs: null,
      reconnectAttempts: 3,
      maxReconnectAttempts: 10
    },
    expectedText: 'Reconnecting (3/10)',
    expectedClasses: ['bg-yellow-950/50', 'text-yellow-400', 'border-yellow-900']
  },
  {
    name: 'connection error',
    health: { status: 'error', isHealthy: false, consecutiveFailures: 5 },
    expectedText: 'Connection Error',
    expectedClasses: ['bg-red-950/50', 'text-red-400', 'border-red-900']
  },
]

// Size configuration test data
const sizeVariations = [
  { size: 'sm' as const, classes: ['px-2', 'py-1', 'text-xs', 'gap-1'] },
  { size: 'md' as const, classes: ['px-3', 'py-1.5', 'text-sm', 'gap-1.5'] },
  { size: 'lg' as const, classes: ['px-4', 'py-2', 'text-base', 'gap-2'] },
]

describe('WebSocketConnectionIndicator - Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to default connected state
    mockHookHealth = {
      status: 'connected',
      isHealthy: true,
      latencyMs: 45,
      averageLatencyMs: 52,
      reconnectAttempts: 0,
      maxReconnectAttempts: 10,
      consecutiveFailures: 0,
      lastHealthyAt: new Date(),
      lastCheckAt: new Date(),
      connectionUptime: 3600000,
    }
    // Note: The mock is set up at the module level and will use the mockHookHealth value
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Connection State Transitions', () => {
    healthStateVariations.forEach(({ name, health, expectedText, expectedClasses }) => {
      it(`renders ${name} state correctly`, () => {
        render(<WebSocketConnectionIndicator healthOverride={health} />)

        const indicator = screen.getByRole('status')
        expect(screen.getByText(expectedText)).toBeInTheDocument()

        expectedClasses.forEach(className => {
          expect(indicator).toHaveClass(className)
        })

        // Verify ARIA label
        expect(indicator).toHaveAttribute('aria-label', `Connection status: ${expectedText}`)
      })
    })

    it('handles rapid state transitions without issues', async () => {
      const { rerender } = render(<WebSocketConnectionIndicator />)

      // Simulate rapid state changes
      const states = ['connected', 'disconnected', 'connecting', 'reconnecting', 'error']

      for (const status of states) {
        await act(async () => {
          rerender(
            <WebSocketConnectionIndicator
              healthOverride={{
                status: status as any,
                isHealthy: status === 'connected',
                latencyMs: status === 'connected' ? 50 : null
              }}
            />
          )
        })

        // Small delay to allow DOM updates
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('maintains state consistency during transitions', () => {
      const { rerender } = render(
        <WebSocketConnectionIndicator
          healthOverride={{ status: 'connected', latencyMs: 45 }}
          showLatency
        />
      )

      expect(screen.getByText('45ms')).toBeInTheDocument()

      rerender(
        <WebSocketConnectionIndicator
          healthOverride={{ status: 'disconnected', latencyMs: null }}
          showLatency
        />
      )

      expect(screen.getByText('Disconnected')).toBeInTheDocument()
      expect(screen.queryByText('45ms')).not.toBeInTheDocument()
    })
  })

  describe('Visual Indicators and Animation', () => {
    sizeVariations.forEach(({ size, classes }) => {
      it(`renders ${size} size with correct styling`, () => {
        render(<WebSocketConnectionIndicator size={size} />)

        const indicator = screen.getByRole('status')
        classes.forEach(className => {
          expect(indicator).toHaveClass(className)
        })
      })
    })

    it('applies animation classes based on connection state', () => {
      const animatedStates = [
        { status: 'connecting', expectPulse: true, expectSpin: true },
        { status: 'reconnecting', expectPulse: true, expectSpin: true },
        { status: 'disconnected', expectPulse: true, expectSpin: false },
        { status: 'error', expectPulse: true, expectSpin: false },
        { status: 'connected', expectPulse: false, expectSpin: false },
      ]

      animatedStates.forEach(({ status, expectPulse, expectSpin }) => {
        const { unmount } = render(
          <WebSocketConnectionIndicator
            animated
            healthOverride={{ status: status as any }}
          />
        )

        const indicator = screen.getByRole('status')

        if (expectPulse) {
          expect(indicator).toHaveClass('animate-pulse')
        } else {
          expect(indicator).not.toHaveClass('animate-pulse')
        }

        unmount()
      })
    })

    it('disables animations when animated prop is false', () => {
      render(
        <WebSocketConnectionIndicator
          animated={false}
          healthOverride={{ status: 'connecting' }}
        />
      )

      const indicator = screen.getByRole('status')
      expect(indicator).not.toHaveClass('animate-pulse')
    })

    it('includes status dot and icon elements', () => {
      render(<WebSocketConnectionIndicator />)

      const indicator = screen.getByRole('status')
      const hiddenElements = indicator.querySelectorAll('[aria-hidden="true"]')

      // Should have dot and icon (both marked as aria-hidden)
      expect(hiddenElements.length).toBeGreaterThan(0)
    })
  })

  describe('Latency Display Features', () => {
    const latencyTestCases = [
      { latencyMs: 15, expected: '15ms', description: 'low latency' },
      { latencyMs: 150, expected: '150ms', description: 'medium latency' },
      { latencyMs: 1500, expected: '1.5s', description: 'high latency' },
      { latencyMs: 5000, expected: '5.0s', description: 'very high latency' },
      { latencyMs: null, expected: 'Connected', description: 'null latency' },
    ]

    latencyTestCases.forEach(({ latencyMs, expected, description }) => {
      it(`displays ${description} correctly when showLatency is true`, () => {
        render(
          <WebSocketConnectionIndicator
            showLatency
            healthOverride={{
              status: 'connected',
              latencyMs
            }}
          />
        )

        expect(screen.getByText(expected)).toBeInTheDocument()
      })
    })

    it('shows status text instead of latency when showLatency is false', () => {
      render(
        <WebSocketConnectionIndicator
          showLatency={false}
          healthOverride={{
            status: 'connected',
            latencyMs: 45
          }}
        />
      )

      expect(screen.getByText('Connected')).toBeInTheDocument()
      expect(screen.queryByText('45ms')).not.toBeInTheDocument()
    })

    it('handles latency display during state transitions', () => {
      const { rerender } = render(
        <WebSocketConnectionIndicator
          showLatency
          healthOverride={{
            status: 'connected',
            latencyMs: 100
          }}
        />
      )

      expect(screen.getByText('100ms')).toBeInTheDocument()

      rerender(
        <WebSocketConnectionIndicator
          showLatency
          healthOverride={{
            status: 'disconnected',
            latencyMs: null
          }}
        />
      )

      expect(screen.getByText('Disconnected')).toBeInTheDocument()
      expect(screen.queryByText('100ms')).not.toBeInTheDocument()
    })
  })

  describe('Reconnection Attempts Display', () => {
    it('shows reconnection attempts when reconnecting', () => {
      const testCases = [
        { attempts: 1, max: 5, expected: 'Reconnecting (1/5)' },
        { attempts: 3, max: 10, expected: 'Reconnecting (3/10)' },
        { attempts: 9, max: 10, expected: 'Reconnecting (9/10)' },
      ]

      testCases.forEach(({ attempts, max, expected }) => {
        const { unmount } = render(
          <WebSocketConnectionIndicator
            healthOverride={{
              status: 'reconnecting',
              reconnectAttempts: attempts,
              maxReconnectAttempts: max
            }}
          />
        )

        expect(screen.getByText(expected)).toBeInTheDocument()
        unmount()
      })
    })

    it('hides reconnection count when showReconnectAttempts is false', () => {
      render(
        <WebSocketConnectionIndicator
          showReconnectAttempts={false}
          healthOverride={{
            status: 'reconnecting',
            reconnectAttempts: 3,
            maxReconnectAttempts: 10
          }}
        />
      )

      expect(screen.getByText('Reconnecting')).toBeInTheDocument()
      expect(screen.queryByText('Reconnecting (3/10)')).not.toBeInTheDocument()
    })

    it('shows basic text when reconnect attempts is 0', () => {
      render(
        <WebSocketConnectionIndicator
          healthOverride={{
            status: 'reconnecting',
            reconnectAttempts: 0,
            maxReconnectAttempts: 10
          }}
        />
      )

      expect(screen.getByText('Reconnecting')).toBeInTheDocument()
      expect(screen.queryByText('(0/10)')).not.toBeInTheDocument()
    })
  })

  describe('Tooltip Integration and Interaction', () => {
    it('wraps indicator with tooltip when showTooltip is true', () => {
      render(<WebSocketConnectionIndicator showTooltip />)

      expect(screen.getByTestId('websocket-tooltip')).toBeInTheDocument()

      const tooltip = screen.getByTestId('websocket-tooltip')
      const indicator = screen.getByRole('status')
      expect(tooltip).toContainElement(indicator)
    })

    it('does not wrap with tooltip when showTooltip is false', () => {
      render(<WebSocketConnectionIndicator showTooltip={false} />)

      expect(screen.queryByTestId('websocket-tooltip')).not.toBeInTheDocument()
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('shows tooltip content on mouse interaction', async () => {
      const healthData = {
        status: 'connected' as const,
        latencyMs: 75,
        reconnectAttempts: 0
      }

      render(
        <WebSocketConnectionIndicator
          showTooltip
          healthOverride={healthData}
        />
      )

      const tooltip = screen.getByTestId('websocket-tooltip')

      fireEvent.mouseEnter(tooltip)

      await waitFor(() => {
        expect(screen.getByTestId('tooltip-content')).toBeInTheDocument()
        expect(screen.getByTestId('tooltip-status')).toHaveTextContent('connected')
        expect(screen.getByTestId('tooltip-latency')).toHaveTextContent('75')
      })

      fireEvent.mouseLeave(tooltip)

      await waitFor(() => {
        expect(screen.queryByTestId('tooltip-content')).not.toBeInTheDocument()
      })
    })

    it('supports keyboard tooltip interaction', async () => {
      render(<WebSocketConnectionIndicator showTooltip />)

      const tooltip = screen.getByTestId('websocket-tooltip')

      fireEvent.focus(tooltip)

      await waitFor(() => {
        expect(tooltip).toHaveAttribute('data-tooltip-visible', 'true')
      })

      fireEvent.blur(tooltip)

      await waitFor(() => {
        expect(tooltip).toHaveAttribute('data-tooltip-visible', 'false')
      })
    })
  })

  describe('Health Override Functionality', () => {
    it('uses override data instead of hook data', () => {
      // Hook returns connected, but override is error
      const override = {
        status: 'error' as const,
        isHealthy: false,
        consecutiveFailures: 3
      }

      render(<WebSocketConnectionIndicator healthOverride={override} />)

      expect(screen.getByText('Connection Error')).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveClass('text-red-400')
    })

    it('merges override with hook data correctly', () => {
      const override = {
        latencyMs: 999
      }

      render(
        <WebSocketConnectionIndicator
          showLatency
          healthOverride={override}
        />
      )

      // Should use override latency
      expect(screen.getByText('999ms')).toBeInTheDocument()
      // But maintain status from hook (connected)
      expect(screen.getByRole('status')).toHaveClass('text-green-400')
    })

    it('handles partial override gracefully', () => {
      render(
        <WebSocketConnectionIndicator
          healthOverride={{ status: 'disconnected' }}
        />
      )

      expect(screen.getByText('Disconnected')).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveClass('text-red-400')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('handles null/undefined health data gracefully', () => {
      const problematicData = {
        status: 'connected' as const,
        latencyMs: null,
        averageLatencyMs: undefined,
        lastHealthyAt: null,
        lastCheckAt: undefined,
        connectionUptime: null
      }

      expect(() => {
        render(<WebSocketConnectionIndicator healthOverride={problematicData} />)
      }).not.toThrow()

      expect(screen.getByText('Connected')).toBeInTheDocument()
    })

    it('handles extreme latency values', () => {
      const extremeLatencies = [0, 1, 10000, 999999]

      extremeLatencies.forEach(latency => {
        const { unmount } = render(
          <WebSocketConnectionIndicator
            showLatency
            healthOverride={{
              status: 'connected',
              latencyMs: latency
            }}
          />
        )

        // Should not crash and should display some text
        expect(screen.getByRole('status')).toBeInTheDocument()
        unmount()
      })
    })

    it('handles missing reconnection attempt data', () => {
      render(
        <WebSocketConnectionIndicator
          healthOverride={{
            status: 'reconnecting',
            reconnectAttempts: undefined as any,
            maxReconnectAttempts: undefined as any
          }}
        />
      )

      expect(screen.getByText('Reconnecting')).toBeInTheDocument()
    })

    it('handles unknown connection status gracefully', () => {
      render(
        <WebSocketConnectionIndicator
          healthOverride={{
            status: 'unknown-status' as any
          }}
        />
      )

      // Should default to error state
      expect(screen.getByText('Connection Error')).toBeInTheDocument()
    })
  })

  describe('Accessibility Compliance', () => {
    it('provides proper ARIA attributes for all states', () => {
      healthStateVariations.forEach(({ name, health, expectedText }) => {
        const { unmount } = render(<WebSocketConnectionIndicator healthOverride={health} />)

        const indicator = screen.getByRole('status')
        expect(indicator).toHaveAttribute('aria-label', `Connection status: ${expectedText}`)
        expect(indicator).toHaveAttribute('role', 'status')

        unmount()
      })
    })

    it('marks decorative elements as aria-hidden', () => {
      render(<WebSocketConnectionIndicator />)

      const indicator = screen.getByRole('status')
      const hiddenElements = indicator.querySelectorAll('[aria-hidden="true"]')

      // Should have dot and icon marked as decorative
      expect(hiddenElements.length).toBeGreaterThan(0)
    })

    it('supports keyboard navigation', () => {
      render(<WebSocketConnectionIndicator showTooltip />)

      const tooltip = screen.getByTestId('websocket-tooltip')

      // Should be focusable
      tooltip.focus()
      expect(document.activeElement).toBe(tooltip)
    })

    it('maintains contrast requirements across states', () => {
      healthStateVariations.forEach(({ name, health, expectedClasses }) => {
        const { unmount } = render(<WebSocketConnectionIndicator healthOverride={health} />)

        const indicator = screen.getByRole('status')

        // Should have appropriate color classes for contrast
        const hasColorClasses = expectedClasses.some(cls =>
          cls.includes('text-') && indicator.classList.contains(cls)
        )
        expect(hasColorClasses).toBe(true)

        unmount()
      })
    })
  })

  describe('Custom Styling and Props', () => {
    it('applies custom className correctly', () => {
      render(<WebSocketConnectionIndicator className="custom-indicator" />)

      const indicator = screen.getByRole('status')
      expect(indicator).toHaveClass('custom-indicator')
    })

    it('preserves default classes when adding custom className', () => {
      render(<WebSocketConnectionIndicator className="custom" />)

      const indicator = screen.getByRole('status')
      expect(indicator).toHaveClass(
        'inline-flex',
        'items-center',
        'rounded-full',
        'border',
        'font-medium',
        'transition-all',
        'duration-300',
        'custom'
      )
    })

    it('passes through HTML attributes correctly', () => {
      render(
        <WebSocketConnectionIndicator
          data-testid="custom-indicator"
          id="connection-indicator"
          title="Connection Status"
        />
      )

      const indicator = screen.getByTestId('custom-indicator')
      expect(indicator).toHaveAttribute('id', 'connection-indicator')
      expect(indicator).toHaveAttribute('title', 'Connection Status')
    })
  })

  describe('Performance and Memory', () => {
    it('handles rapid prop changes efficiently', () => {
      const { rerender } = render(<WebSocketConnectionIndicator showLatency />)

      const start = performance.now()

      // Simulate rapid prop changes
      for (let i = 0; i < 100; i++) {
        rerender(
          <WebSocketConnectionIndicator
            showLatency={i % 2 === 0}
            size={i % 3 === 0 ? 'sm' : i % 3 === 1 ? 'md' : 'lg'}
            animated={i % 4 === 0}
          />
        )
      }

      const renderTime = performance.now() - start
      expect(renderTime).toBeLessThan(1000) // Should handle changes efficiently

      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('cleans up properly when unmounted', () => {
      const { unmount } = render(<WebSocketConnectionIndicator showTooltip />)

      unmount()

      // Should not have any lingering elements
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.queryByTestId('websocket-tooltip')).not.toBeInTheDocument()
    })
  })
})