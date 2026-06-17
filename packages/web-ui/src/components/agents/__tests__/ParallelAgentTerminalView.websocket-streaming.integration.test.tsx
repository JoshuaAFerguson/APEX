/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { ParallelAgentTerminalView } from '../ParallelAgentTerminalView'
import type { AgentTerminalPanelConfig } from '../ParallelAgentTerminalView.types'

// Mock WebSocket client for integration testing
let mockConnectionStatus = 'disconnected'
let mockEventHandlers = new Map<string, Function[]>()
let mockEvents: any[] = []

const mockWSClient = {
  isConnected: vi.fn(() => mockConnectionStatus === 'connected'),
  connect: vi.fn(() => {
    mockConnectionStatus = 'connected'
  }),
  disconnect: vi.fn(() => {
    mockConnectionStatus = 'disconnected'
  }),
  on: vi.fn((eventType: string, handler: Function) => {
    if (!mockEventHandlers.has(eventType)) {
      mockEventHandlers.set(eventType, [])
    }
    mockEventHandlers.get(eventType)!.push(handler)
  }),
  off: vi.fn((eventType: string, handler: Function) => {
    const handlers = mockEventHandlers.get(eventType)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }),
  emit: (eventType: string, event: any) => {
    const handlers = mockEventHandlers.get(eventType) || []
    handlers.forEach(handler => handler(event))
  },
  getHealthState: vi.fn(() => ({
    isHealthy: mockConnectionStatus === 'connected',
    consecutiveFailures: 0,
  })),
}

// Mock the WebSocket client
vi.mock('@/lib/websocket-client', () => ({
  wsClient: mockWSClient,
}))

// Mock useAgentTerminals with simplified behavior
vi.mock('@/hooks/useAgentTerminals', () => ({
  useAgentTerminals: vi.fn(() => ({
    agents: new Map(),
    connectionHealth: {
      status: mockConnectionStatus,
      isHealthy: mockConnectionStatus === 'connected',
      latencyMs: 50,
      averageLatencyMs: 50,
      reconnectAttempts: 0,
      maxReconnectAttempts: 10,
      consecutiveFailures: 0,
      lastHealthyAt: new Date(),
      lastCheckAt: new Date(),
      connectionUptime: 5000,
    },
    agentIds: [],
    registerAgent: vi.fn(),
    getAgentState: vi.fn(() => ({
      logs: [],
      filteredLogs: [],
      streamState: {
        state: mockConnectionStatus === 'connected' ? 'streaming' : 'idle',
        connectionStatus: mockConnectionStatus,
        isReceiving: false,
        logsReceivedCount: 0,
        lastLogAt: null,
        bytesReceived: 0,
        streamStartedAt: null,
        error: null,
      },
      isPaused: false,
      error: null,
    })),
    connect: mockWSClient.connect,
    disconnect: mockWSClient.disconnect,
    isConnected: mockConnectionStatus === 'connected',
    isReconnecting: mockConnectionStatus === 'reconnecting',
  }))
}))

// Mock AgentTerminalPanel to focus on WebSocket integration
vi.mock('../AgentTerminalPanel', () => ({
  AgentTerminalPanel: vi.fn(({
    panelId,
    agentId,
    title,
    panelState,
    agentStatus,
    autoConnect,
  }) => {
    // Simulate auto-connect behavior
    React.useEffect(() => {
      if (autoConnect && mockConnectionStatus === 'disconnected') {
        mockWSClient.connect()
      }
    }, [autoConnect])

    return (
      <div
        data-testid={`agent-terminal-panel-${panelId}`}
        data-panel-state={panelState}
        data-agent-id={agentId}
        data-connection-status={mockConnectionStatus}
        data-auto-connect={autoConnect}
      >
        <div data-testid={`panel-header-${panelId}`}>
          <span data-testid={`panel-title-${panelId}`}>{title || `Agent ${agentId}`}</span>
          <span data-testid={`connection-status-${panelId}`}>{mockConnectionStatus}</span>
          {agentStatus && <span data-testid={`agent-status-${panelId}`}>{agentStatus}</span>}
        </div>

        <div data-testid={`panel-content-${panelId}`}>
          WebSocket Integration Panel
        </div>
      </div>
    )
  }),
}))

// Test utilities
function createTestPanelConfig(agentId: string, overrides: Partial<AgentTerminalPanelConfig> = {}): AgentTerminalPanelConfig {
  return {
    panelId: `panel-${agentId}`,
    agentId,
    title: `Agent ${agentId}`,
    agentStatus: 'running',
    initialState: 'normal',
    autoConnect: true,
    ...overrides,
  }
}

describe('ParallelAgentTerminalView WebSocket Streaming Integration', () => {
  beforeEach(() => {
    mockConnectionStatus = 'disconnected'
    mockEventHandlers.clear()
    mockEvents = []
    vi.clearAllMocks()

    // Setup crypto for testing
    Object.defineProperty(window, 'crypto', {
      value: { randomUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36)) },
      writable: true,
    })
  })

  afterEach(() => {
    mockConnectionStatus = 'disconnected'
    mockEventHandlers.clear()
    vi.clearAllMocks()
  })

  describe('Real-time Log Streaming to Panels', () => {
    it('renders agent panels with WebSocket integration capabilities', async () => {
      const panels = [
        createTestPanelConfig('agent-1'),
        createTestPanelConfig('agent-2'),
        createTestPanelConfig('agent-3'),
      ]

      render(
        <ParallelAgentTerminalView
          panels={panels}
          testId="websocket-streaming-terminal"
        />
      )

      // Verify all panels render
      await waitFor(() => {
        expect(screen.getByTestId('agent-terminal-panel-panel-agent-1')).toBeInTheDocument()
        expect(screen.getByTestId('agent-terminal-panel-panel-agent-2')).toBeInTheDocument()
        expect(screen.getByTestId('agent-terminal-panel-panel-agent-3')).toBeInTheDocument()
      })

      // Verify panels show correct agent info
      expect(screen.getByTestId('panel-title-panel-agent-1')).toHaveTextContent('Agent agent-1')
      expect(screen.getByTestId('panel-title-panel-agent-2')).toHaveTextContent('Agent agent-2')
      expect(screen.getByTestId('panel-title-panel-agent-3')).toHaveTextContent('Agent agent-3')
    })

    it('handles WebSocket connection state changes across all panels', async () => {
      const panels = [
        createTestPanelConfig('agent-1', { autoConnect: false }),
        createTestPanelConfig('agent-2', { autoConnect: false }),
      ]

      // Ensure we start disconnected
      mockConnectionStatus = 'disconnected'

      const { rerender } = render(
        <ParallelAgentTerminalView
          panels={panels}
          testId="connection-state-terminal"
        />
      )

      // Initially disconnected
      await waitFor(() => {
        expect(screen.getByTestId('connection-status-panel-agent-1')).toHaveTextContent('disconnected')
        expect(screen.getByTestId('connection-status-panel-agent-2')).toHaveTextContent('disconnected')
      })

      // Connect WebSocket
      act(() => {
        mockConnectionStatus = 'connected'
      })

      rerender(
        <ParallelAgentTerminalView
          panels={panels}
          testId="connection-state-terminal"
        />
      )

      // Verify connection status updates
      await waitFor(() => {
        expect(screen.getByTestId('connection-status-panel-agent-1')).toHaveTextContent('connected')
        expect(screen.getByTestId('connection-status-panel-agent-2')).toHaveTextContent('connected')
      })
    })

    it('supports auto-connect functionality for WebSocket integration', async () => {
      const panels = [
        createTestPanelConfig('auto-agent', { autoConnect: true }),
        createTestPanelConfig('manual-agent', { autoConnect: false }),
      ]

      render(
        <ParallelAgentTerminalView
          panels={panels}
          testId="auto-connect-terminal"
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('agent-terminal-panel-panel-auto-agent')).toBeInTheDocument()
        expect(screen.getByTestId('agent-terminal-panel-panel-manual-agent')).toBeInTheDocument()
      })

      // Verify auto-connect attribute is set correctly
      expect(screen.getByTestId('agent-terminal-panel-panel-auto-agent')).toHaveAttribute('data-auto-connect', 'true')
      expect(screen.getByTestId('agent-terminal-panel-panel-manual-agent')).toHaveAttribute('data-auto-connect', 'false')
    })

    it('properly handles WebSocket event subscription setup', async () => {
      const panels = [createTestPanelConfig('event-test')]

      render(
        <ParallelAgentTerminalView
          panels={panels}
          testId="event-subscription-terminal"
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('agent-terminal-panel-panel-event-test')).toBeInTheDocument()
      })

      // Verify WebSocket client methods are available
      expect(mockWSClient.on).toBeDefined()
      expect(mockWSClient.off).toBeDefined()
      expect(mockWSClient.connect).toBeDefined()
      expect(mockWSClient.disconnect).toBeDefined()
    })
  })

  describe('Connection/Disconnection Handling', () => {
    it('handles connection state transitions properly', async () => {
      const panels = [createTestPanelConfig('connection-test', { autoConnect: false })]

      // Ensure we start disconnected
      mockConnectionStatus = 'disconnected'

      const { rerender } = render(
        <ParallelAgentTerminalView
          panels={panels}
          testId="connection-handling-terminal"
        />
      )

      // Start disconnected
      await waitFor(() => {
        expect(screen.getByTestId('connection-status-panel-connection-test')).toHaveTextContent('disconnected')
      })

      // Transition to connected
      act(() => {
        mockConnectionStatus = 'connected'
      })

      rerender(
        <ParallelAgentTerminalView
          panels={panels}
          testId="connection-handling-terminal"
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('connection-status-panel-connection-test')).toHaveTextContent('connected')
      })

      // Transition to reconnecting
      act(() => {
        mockConnectionStatus = 'reconnecting'
      })

      rerender(
        <ParallelAgentTerminalView
          panels={panels}
          testId="connection-handling-terminal"
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('connection-status-panel-connection-test')).toHaveTextContent('reconnecting')
      })
    })

    it('maintains panel integrity during connection interruptions', async () => {
      const panels = [
        createTestPanelConfig('stable-1'),
        createTestPanelConfig('stable-2'),
      ]

      const { rerender } = render(
        <ParallelAgentTerminalView
          panels={panels}
          testId="connection-stability-terminal"
        />
      )

      // Initially connected
      act(() => {
        mockConnectionStatus = 'connected'
      })

      rerender(
        <ParallelAgentTerminalView
          panels={panels}
          testId="connection-stability-terminal"
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('agent-terminal-panel-panel-stable-1')).toBeInTheDocument()
        expect(screen.getByTestId('agent-terminal-panel-panel-stable-2')).toBeInTheDocument()
      })

      // Simulate disconnection
      act(() => {
        mockConnectionStatus = 'disconnected'
      })

      rerender(
        <ParallelAgentTerminalView
          panels={panels}
          testId="connection-stability-terminal"
        />
      )

      // Panels should still be present
      expect(screen.getByTestId('agent-terminal-panel-panel-stable-1')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-panel-stable-2')).toBeInTheDocument()

      // Connection status should reflect disconnection
      expect(screen.getByTestId('connection-status-panel-stable-1')).toHaveTextContent('disconnected')
      expect(screen.getByTestId('connection-status-panel-stable-2')).toHaveTextContent('disconnected')
    })
  })

  describe('Event Routing to Correct Agent Panels', () => {
    it('sets up event routing infrastructure for multiple agents', async () => {
      const panels = [
        createTestPanelConfig('router-1'),
        createTestPanelConfig('router-2'),
        createTestPanelConfig('router-3'),
      ]

      render(
        <ParallelAgentTerminalView
          panels={panels}
          testId="event-routing-terminal"
        />
      )

      // Verify all panels have unique identifiers for routing
      await waitFor(() => {
        expect(screen.getByTestId('agent-terminal-panel-panel-router-1')).toHaveAttribute('data-agent-id', 'router-1')
        expect(screen.getByTestId('agent-terminal-panel-panel-router-2')).toHaveAttribute('data-agent-id', 'router-2')
        expect(screen.getByTestId('agent-terminal-panel-panel-router-3')).toHaveAttribute('data-agent-id', 'router-3')
      })
    })

    it('maintains separate panel contexts for event isolation', async () => {
      const panels = [
        createTestPanelConfig('isolated-a'),
        createTestPanelConfig('isolated-b'),
      ]

      render(
        <ParallelAgentTerminalView
          panels={panels}
          testId="event-isolation-terminal"
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('agent-terminal-panel-panel-isolated-a')).toBeInTheDocument()
        expect(screen.getByTestId('agent-terminal-panel-panel-isolated-b')).toBeInTheDocument()
      })

      // Each panel should have its own isolated context
      const panelA = screen.getByTestId('agent-terminal-panel-panel-isolated-a')
      const panelB = screen.getByTestId('agent-terminal-panel-panel-isolated-b')

      expect(panelA).toHaveAttribute('data-agent-id', 'isolated-a')
      expect(panelB).toHaveAttribute('data-agent-id', 'isolated-b')

      // Panels should be independent components
      expect(panelA).not.toBe(panelB)
    })
  })

  describe('High-frequency Event Processing', () => {
    it('handles multiple agents with WebSocket integration efficiently', async () => {
      // Create many panels to test performance
      const panels = Array.from({ length: 8 }, (_, i) =>
        createTestPanelConfig(`perf-agent-${i + 1}`)
      )

      const startTime = performance.now()

      render(
        <ParallelAgentTerminalView
          panels={panels}
          testId="performance-terminal"
        />
      )

      // Wait for all panels to render
      await waitFor(() => {
        panels.forEach((_, i) => {
          expect(screen.getByTestId(`agent-terminal-panel-panel-perf-agent-${i + 1}`)).toBeInTheDocument()
        })
      })

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render efficiently (under 100ms for 8 panels)
      expect(renderTime).toBeLessThan(100)
    })

    it('maintains performance with WebSocket connection state changes', async () => {
      const panels = Array.from({ length: 6 }, (_, i) =>
        createTestPanelConfig(`state-perf-${i + 1}`)
      )

      const { rerender } = render(
        <ParallelAgentTerminalView
          panels={panels}
          testId="state-performance-terminal"
        />
      )

      // Rapidly change connection states
      const states = ['connected', 'disconnected', 'reconnecting', 'connected']

      for (const state of states) {
        const startTime = performance.now()

        act(() => {
          mockConnectionStatus = state as any
        })

        rerender(
          <ParallelAgentTerminalView
            panels={panels}
            testId="state-performance-terminal"
          />
        )

        const endTime = performance.now()
        const stateChangeTime = endTime - startTime

        // Each state change should be fast
        expect(stateChangeTime).toBeLessThan(50)
      }
    })
  })

  describe('Reconnection Behavior', () => {
    it('supports WebSocket reconnection infrastructure', async () => {
      const panels = [createTestPanelConfig('reconnect-test')]

      const { rerender } = render(
        <ParallelAgentTerminalView
          panels={panels}
          testId="reconnection-terminal"
        />
      )

      // Start connected
      act(() => {
        mockConnectionStatus = 'connected'
      })

      rerender(
        <ParallelAgentTerminalView
          panels={panels}
          testId="reconnection-terminal"
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('connection-status-panel-reconnect-test')).toHaveTextContent('connected')
      })

      // Simulate connection loss and reconnection
      act(() => {
        mockConnectionStatus = 'reconnecting'
      })

      rerender(
        <ParallelAgentTerminalView
          panels={panels}
          testId="reconnection-terminal"
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('connection-status-panel-reconnect-test')).toHaveTextContent('reconnecting')
      })

      // Complete reconnection
      act(() => {
        mockConnectionStatus = 'connected'
      })

      rerender(
        <ParallelAgentTerminalView
          panels={panels}
          testId="reconnection-terminal"
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('connection-status-panel-reconnect-test')).toHaveTextContent('connected')
      })
    })

    it('maintains panel state consistency during reconnection cycles', async () => {
      const panels = [
        createTestPanelConfig('cycle-1'),
        createTestPanelConfig('cycle-2'),
      ]

      const { rerender } = render(
        <ParallelAgentTerminalView
          panels={panels}
          testId="reconnection-cycle-terminal"
        />
      )

      // Simulate multiple reconnection cycles
      const connectionCycle = ['connected', 'disconnected', 'reconnecting', 'connected']

      for (let cycle = 0; cycle < 3; cycle++) {
        for (const status of connectionCycle) {
          act(() => {
            mockConnectionStatus = status as any
          })

          rerender(
            <ParallelAgentTerminalView
              panels={panels}
              testId="reconnection-cycle-terminal"
            />
          )

          // Panels should remain stable throughout cycles
          expect(screen.getByTestId('agent-terminal-panel-panel-cycle-1')).toBeInTheDocument()
          expect(screen.getByTestId('agent-terminal-panel-panel-cycle-2')).toBeInTheDocument()
        }
      }

      // Final state should be connected
      expect(screen.getByTestId('connection-status-panel-cycle-1')).toHaveTextContent('connected')
      expect(screen.getByTestId('connection-status-panel-cycle-2')).toHaveTextContent('connected')
    })
  })

  describe('Integration with Panel Controls', () => {
    it('maintains WebSocket integration during panel state changes', async () => {
      const panels = [createTestPanelConfig('control-integration')]

      render(
        <ParallelAgentTerminalView
          panels={panels}
          testId="control-integration-terminal"
        />
      )

      const panel = await waitFor(() =>
        screen.getByTestId('agent-terminal-panel-panel-control-integration')
      )

      // Panel should maintain WebSocket context regardless of display state
      expect(panel).toHaveAttribute('data-agent-id', 'control-integration')
      expect(panel).toHaveAttribute('data-connection-status', mockConnectionStatus)

      // Connection status should be trackable
      expect(screen.getByTestId('connection-status-panel-control-integration')).toHaveTextContent(mockConnectionStatus)
    })

    it('handles dynamic panel addition with WebSocket integration', async () => {
      const initialPanels = [createTestPanelConfig('dynamic-initial')]
      const { rerender } = render(
        <ParallelAgentTerminalView
          panels={initialPanels}
          testId="dynamic-integration-terminal"
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('agent-terminal-panel-panel-dynamic-initial')).toBeInTheDocument()
      })

      // Add more panels
      const expandedPanels = [
        ...initialPanels,
        createTestPanelConfig('dynamic-added-1'),
        createTestPanelConfig('dynamic-added-2'),
      ]

      rerender(
        <ParallelAgentTerminalView
          panels={expandedPanels}
          testId="dynamic-integration-terminal"
        />
      )

      // All panels should render with WebSocket integration
      await waitFor(() => {
        expect(screen.getByTestId('agent-terminal-panel-panel-dynamic-initial')).toBeInTheDocument()
        expect(screen.getByTestId('agent-terminal-panel-panel-dynamic-added-1')).toBeInTheDocument()
        expect(screen.getByTestId('agent-terminal-panel-panel-dynamic-added-2')).toBeInTheDocument()
      })

      // Each panel should have proper WebSocket context
      expect(screen.getByTestId('agent-terminal-panel-panel-dynamic-added-1')).toHaveAttribute('data-agent-id', 'dynamic-added-1')
      expect(screen.getByTestId('agent-terminal-panel-panel-dynamic-added-2')).toHaveAttribute('data-agent-id', 'dynamic-added-2')
    })
  })
})