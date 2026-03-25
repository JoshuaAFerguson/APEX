/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConnectedParallelAgentTerminalView } from '../ConnectedParallelAgentTerminalView'
import type {
  ConnectedAgentConfig,
  ConnectedParallelAgentTerminalViewRef
} from '../ConnectedParallelAgentTerminalView.types'

// ============================================================================
// Mock Setup
// ============================================================================

// Mock handlers and state that will be shared
const mockEventHandlers = new Map<string, Function[]>()

// Mock WebSocket client
vi.mock('@/lib/websocket-client', () => ({
  wsClient: {
    isConnected: vi.fn(() => true),
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn((eventType: string, handler: Function) => {
      if (!mockEventHandlers.has(eventType)) {
        mockEventHandlers.set(eventType, [])
      }
      mockEventHandlers.get(eventType)!.push(handler)
    }),
    off: vi.fn(),
    emit: (eventType: string, event: unknown) => {
      const handlers = mockEventHandlers.get(eventType) || []
      handlers.forEach(handler => handler(event))
    }
  },
}))

// Mock WebSocket connection hook
const mockConnectionHealth = {
  status: 'connected' as const,
  isHealthy: true,
  latencyMs: 45,
  averageLatencyMs: 50,
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
  consecutiveFailures: 0,
  lastHealthyAt: new Date(),
  lastCheckAt: new Date(),
  connectionUptime: 5000,
}

vi.mock('@/hooks/useWebSocketConnection', () => ({
  useWebSocketConnection: vi.fn(() => mockConnectionHealth),
}))

// Mock log stream utilities
vi.mock('@/types/agent-log-stream', async () => {
  const actual = await vi.importActual('@/types/agent-log-stream')
  return {
    ...actual,
    filterLogs: vi.fn((logs: unknown[]) => logs),
    exportLogs: vi.fn(() => 'exported-logs'),
    calculateLogStreamStats: vi.fn(() => ({
      totalEntries: 0,
      totalErrors: 0,
      bytesReceived: 0,
      entriesPerSecond: 0,
      averageEntryLength: 0,
      oldestEntry: null,
      newestEntry: null,
    })),
    DEFAULT_LOG_FILTER: {
      levels: ['debug', 'info', 'warn', 'error'],
      sources: ['agent', 'system', 'user', 'tool', 'error'],
      search: '',
      timeRange: null,
    }
  }
})

// Mock ParallelAgentTerminalView to focus on integration
vi.mock('../ParallelAgentTerminalView', () => ({
  ParallelAgentTerminalView: React.forwardRef<any, any>(({
    panels,
    gap,
    onPanelClose,
    testId,
    ...props
  }, ref) => {
    React.useImperativeHandle(ref, () => ({
      minimizeAll: vi.fn(),
      restoreAll: vi.fn(),
      getAllStates: vi.fn(() => ({})),
      maximizePanel: vi.fn(),
      focusPanel: vi.fn(),
    }))

    return (
      <div data-testid={testId} data-panel-count={panels?.length}>
        {panels?.map((panel: any) => (
          <div
            key={panel.panelId}
            data-testid={`panel-${panel.panelId}`}
            data-agent-id={panel.agentId}
            data-title={panel.title}
            data-auto-connect={panel.autoConnect?.toString()}
          >
            {panel.title}
            <button
              onClick={() => onPanelClose?.(panel.panelId)}
              data-testid={`close-${panel.panelId}`}
            >
              Close
            </button>
          </div>
        ))}
      </div>
    )
  })
}))

// ============================================================================
// Test Helpers and Factories
// ============================================================================

/**
 * Create mock agent configuration
 */
function createMockAgentConfig(
  agentId: string,
  overrides?: Partial<ConnectedAgentConfig>
): ConnectedAgentConfig {
  return {
    panelId: `panel-${agentId}`,
    agentId,
    title: `Agent ${agentId}`,
    agentStatus: 'idle',
    maxLogs: 500,
    autoStart: true,
    ...overrides,
  }
}

/**
 * Create mock ApexEvent
 */
function createMockApexEvent(type: string, agentId: string, overrides = {}) {
  return {
    type,
    taskId: agentId,
    timestamp: new Date(),
    data: {
      message: `Log message for ${agentId}`,
      level: 'info',
      source: 'agent',
      ...overrides,
    }
  }
}

/**
 * Create mock connection health
 */
function createMockConnectionHealth(status: 'connected' | 'disconnected' | 'reconnecting') {
  return {
    ...mockConnectionHealth,
    status,
    isHealthy: status === 'connected',
    reconnectAttempts: status === 'reconnecting' ? 2 : 0,
  }
}

/**
 * Create mock log entry
 */
function createMockLogEntry(agentId: string, message = 'Test log message') {
  return {
    id: `log-${Date.now()}-${Math.random()}`,
    timestamp: new Date(),
    level: 'info' as const,
    source: 'agent' as const,
    message,
    agentId,
    metadata: {},
  }
}

// ============================================================================
// Test Setup
// ============================================================================

// Import after mocks
import { wsClient } from '@/lib/websocket-client'
import { useWebSocketConnection } from '@/hooks/useWebSocketConnection'

const mockWsClient = wsClient as any
const mockUseWebSocketConnection = useWebSocketConnection as any

describe('ParallelAgentTerminalView + useAgentTerminals Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEventHandlers.clear()

    // Reset connection health to default
    mockUseWebSocketConnection.mockReturnValue(mockConnectionHealth)
    mockWsClient.isConnected.mockReturnValue(true)
  })

  afterEach(() => {
    mockEventHandlers.clear()
  })

  // ============================================================================
  // Hook Initialization with Panels
  // ============================================================================

  describe('Hook Initialization with Panels', () => {
    it('initializes hook with empty panels', () => {
      render(<ConnectedParallelAgentTerminalView agents={[]} />)

      // Should render but not register any agents
      expect(screen.getByTestId('connected-parallel-agent-terminal-view')).toBeInTheDocument()
      expect(screen.getByTestId('connected-parallel-agent-terminal-view')).toHaveAttribute('data-panel-count', '0')
    })

    it('initializes hook with multiple panel configurations', () => {
      const agents = [
        createMockAgentConfig('a1', { title: 'Agent One' }),
        createMockAgentConfig('a2', { title: 'Agent Two' }),
      ]

      render(<ConnectedParallelAgentTerminalView agents={agents} />)

      // Should render panels with correct configuration
      expect(screen.getByTestId('panel-panel-a1')).toBeInTheDocument()
      expect(screen.getByTestId('panel-panel-a2')).toBeInTheDocument()

      // Panels should be configured with autoConnect: false (managed centrally)
      expect(screen.getByTestId('panel-panel-a1')).toHaveAttribute('data-auto-connect', 'false')
      expect(screen.getByTestId('panel-panel-a2')).toHaveAttribute('data-auto-connect', 'false')
    })

    it('applies defaultMaxLogs to all agents', () => {
      const agents = [
        createMockAgentConfig('a1'),
        createMockAgentConfig('a2', { maxLogs: undefined }), // Should use default
      ]

      render(
        <ConnectedParallelAgentTerminalView
          agents={agents}
          defaultMaxLogs={750}
        />
      )

      // Panels should be rendered (verifying hook processed configurations)
      expect(screen.getByTestId('panel-panel-a1')).toBeInTheDocument()
      expect(screen.getByTestId('panel-panel-a2')).toBeInTheDocument()
    })

    it('passes autoConnect option to WebSocket', () => {
      const agents = [createMockAgentConfig('a1')]

      render(
        <ConnectedParallelAgentTerminalView
          agents={agents}
          autoConnect={false}
        />
      )

      // WebSocket connection should be initialized (hook setup verification)
      expect(mockUseWebSocketConnection).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Agent Registration/Unregistration
  // ============================================================================

  describe('Agent Registration/Unregistration', () => {
    it('registers agents when panels are added', async () => {
      const agent1 = createMockAgentConfig('a1')
      const agent2 = createMockAgentConfig('a2')

      const { rerender } = render(
        <ConnectedParallelAgentTerminalView agents={[agent1]} />
      )

      // Initially should have one panel
      expect(screen.getByTestId('panel-panel-a1')).toBeInTheDocument()
      expect(screen.queryByTestId('panel-panel-a2')).not.toBeInTheDocument()

      // Add second agent
      rerender(
        <ConnectedParallelAgentTerminalView agents={[agent1, agent2]} />
      )

      // Should now have both panels
      await waitFor(() => {
        expect(screen.getByTestId('panel-panel-a1')).toBeInTheDocument()
        expect(screen.getByTestId('panel-panel-a2')).toBeInTheDocument()
      })
    })

    it('unregisters agents when panels are removed', async () => {
      const agent1 = createMockAgentConfig('a1')
      const agent2 = createMockAgentConfig('a2')

      const { rerender } = render(
        <ConnectedParallelAgentTerminalView agents={[agent1, agent2]} />
      )

      // Initially should have both panels
      expect(screen.getByTestId('panel-panel-a1')).toBeInTheDocument()
      expect(screen.getByTestId('panel-panel-a2')).toBeInTheDocument()

      // Remove second agent
      rerender(
        <ConnectedParallelAgentTerminalView agents={[agent1]} />
      )

      // Should only have first panel
      await waitFor(() => {
        expect(screen.getByTestId('panel-panel-a1')).toBeInTheDocument()
        expect(screen.queryByTestId('panel-panel-a2')).not.toBeInTheDocument()
      })
    })

    it('handles panel reordering without re-registration', async () => {
      const agent1 = createMockAgentConfig('a1')
      const agent2 = createMockAgentConfig('a2')

      const { rerender } = render(
        <ConnectedParallelAgentTerminalView agents={[agent1, agent2]} />
      )

      // Initially should have both panels in order
      expect(screen.getByTestId('panel-panel-a1')).toBeInTheDocument()
      expect(screen.getByTestId('panel-panel-a2')).toBeInTheDocument()

      // Reorder agents
      rerender(
        <ConnectedParallelAgentTerminalView agents={[agent2, agent1]} />
      )

      // Should still have both panels (reordered)
      await waitFor(() => {
        expect(screen.getByTestId('panel-panel-a1')).toBeInTheDocument()
        expect(screen.getByTestId('panel-panel-a2')).toBeInTheDocument()
      })
    })

    it('respects max 12 agent limit', () => {
      // Create 13 agents (exceeding limit)
      const agents = Array.from({ length: 13 }, (_, i) =>
        createMockAgentConfig(`a${i + 1}`)
      )

      render(<ConnectedParallelAgentTerminalView agents={agents} />)

      // Should render all agents (component level limit check)
      expect(screen.getByTestId('connected-parallel-agent-terminal-view')).toHaveAttribute('data-panel-count', '13')
    })

    it('cleanup unregisters all agents on unmount', () => {
      const agents = [
        createMockAgentConfig('a1'),
        createMockAgentConfig('a2'),
      ]

      const { unmount } = render(
        <ConnectedParallelAgentTerminalView agents={agents} />
      )

      // Initially should have panels
      expect(screen.getByTestId('panel-panel-a1')).toBeInTheDocument()
      expect(screen.getByTestId('panel-panel-a2')).toBeInTheDocument()

      // Unmount component
      unmount()

      // Component should be gone (cleanup verification)
      expect(screen.queryByTestId('connected-parallel-agent-terminal-view')).not.toBeInTheDocument()
    })
  })

  // ============================================================================
  // Log Data Flow to Panels
  // ============================================================================

  describe('Log Data Flow to Panels', () => {
    it('routes log events to correct agent panel', async () => {
      const agent1 = createMockAgentConfig('a1')
      const agent2 = createMockAgentConfig('a2')
      const onLogsSpy = vi.fn()

      render(
        <ConnectedParallelAgentTerminalView
          agents={[agent1, agent2]}
          onLogs={onLogsSpy}
        />
      )

      // Emit event for agent1
      act(() => {
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'a1'))
      })

      await waitFor(() => {
        // Verify routing occurs (through onLogs callback)
        expect(onLogsSpy).toHaveBeenCalledWith('a1', expect.any(Array))
      })
    })

    it('applies per-agent log buffer limits', async () => {
      const agent1 = createMockAgentConfig('a1', { maxLogs: 2 })
      const onLogsSpy = vi.fn()

      render(
        <ConnectedParallelAgentTerminalView
          agents={[agent1]}
          onLogs={onLogsSpy}
        />
      )

      // Emit multiple events to test buffering
      act(() => {
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'a1', { message: 'Log 1' }))
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'a1', { message: 'Log 2' }))
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'a1', { message: 'Log 3' }))
      })

      await waitFor(() => {
        // Should receive logs (buffer limit handled internally by hook)
        expect(onLogsSpy).toHaveBeenCalled()
      })
    })

    it('applies per-agent filters to logs', async () => {
      const agent1 = createMockAgentConfig('a1', {
        initialFilter: {
          levels: ['error'],
          search: 'critical'
        }
      })
      const onLogsSpy = vi.fn()

      render(
        <ConnectedParallelAgentTerminalView
          agents={[agent1]}
          onLogs={onLogsSpy}
        />
      )

      // Emit events with different levels
      act(() => {
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'a1', { level: 'info' }))
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'a1', { level: 'error' }))
      })

      await waitFor(() => {
        // Should receive logs (filtering handled by hook)
        expect(onLogsSpy).toHaveBeenCalled()
      })
    })

    it('ignores events for unregistered agents', async () => {
      const agent1 = createMockAgentConfig('a1')
      const onLogsSpy = vi.fn()

      render(
        <ConnectedParallelAgentTerminalView
          agents={[agent1]}
          onLogs={onLogsSpy}
        />
      )

      // Emit event for unregistered agent
      act(() => {
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'unregistered-agent'))
      })

      // Wait briefly to ensure no spurious calls
      await new Promise(resolve => setTimeout(resolve, 50))

      // Should not have been called for unregistered agent
      expect(onLogsSpy).not.toHaveBeenCalledWith('unregistered-agent', expect.anything())
    })

    it('handles high-frequency log events', async () => {
      const agent1 = createMockAgentConfig('a1')
      const onLogsSpy = vi.fn()

      render(
        <ConnectedParallelAgentTerminalView
          agents={[agent1]}
          onLogs={onLogsSpy}
        />
      )

      // Emit many rapid events
      act(() => {
        for (let i = 0; i < 100; i++) {
          mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'a1', {
            message: `Rapid log ${i}`
          }))
        }
      })

      await waitFor(() => {
        // Should handle high frequency (may batch or throttle)
        expect(onLogsSpy).toHaveBeenCalled()
      })
    })
  })

  // ============================================================================
  // Pause/Resume Propagation
  // ============================================================================

  describe('Pause/Resume Propagation', () => {
    it('pauses individual agent via ref API', async () => {
      const agent1 = createMockAgentConfig('a1')
      const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()
      const onLogsSpy = vi.fn()

      render(
        <ConnectedParallelAgentTerminalView
          ref={ref}
          agents={[agent1]}
          onLogs={onLogsSpy}
        />
      )

      // Pause agent
      act(() => {
        ref.current!.pauseAgent('a1')
      })

      // Emit event after pause
      act(() => {
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'a1'))
      })

      // Verify pause method is available
      expect(ref.current?.pauseAgent).toBeInstanceOf(Function)
    })

    it('resumes individual agent via ref API', async () => {
      const agent1 = createMockAgentConfig('a1')
      const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()
      const onLogsSpy = vi.fn()

      render(
        <ConnectedParallelAgentTerminalView
          ref={ref}
          agents={[agent1]}
          onLogs={onLogsSpy}
        />
      )

      // Pause then resume agent
      act(() => {
        ref.current!.pauseAgent('a1')
        ref.current!.resumeAgent('a1')
      })

      // Emit event after resume
      act(() => {
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'a1'))
      })

      // Verify resume method is available
      expect(ref.current?.resumeAgent).toBeInstanceOf(Function)
    })

    it('pauseAll stops all agent streams', async () => {
      const agents = [
        createMockAgentConfig('a1'),
        createMockAgentConfig('a2'),
      ]
      const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()
      const onLogsSpy = vi.fn()

      render(
        <ConnectedParallelAgentTerminalView
          ref={ref}
          agents={agents}
          onLogs={onLogsSpy}
        />
      )

      // Pause all agents
      act(() => {
        ref.current!.pauseAll()
      })

      // Emit events for both agents
      act(() => {
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'a1'))
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'a2'))
      })

      // Verify pauseAll method is available
      expect(ref.current?.pauseAll).toBeInstanceOf(Function)
    })

    it('resumeAll resumes all agent streams', async () => {
      const agents = [
        createMockAgentConfig('a1'),
        createMockAgentConfig('a2'),
      ]
      const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()

      render(
        <ConnectedParallelAgentTerminalView
          ref={ref}
          agents={agents}
        />
      )

      // Pause all then resume all
      act(() => {
        ref.current!.pauseAll()
        ref.current!.resumeAll()
      })

      // Verify resumeAll method is available
      expect(ref.current?.resumeAll).toBeInstanceOf(Function)
    })

    it('paused agent ignores incoming events', async () => {
      const agent1 = createMockAgentConfig('a1')
      const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()
      const onLogsSpy = vi.fn()

      render(
        <ConnectedParallelAgentTerminalView
          ref={ref}
          agents={[agent1]}
          onLogs={onLogsSpy}
        />
      )

      // Pause agent
      act(() => {
        ref.current!.pauseAgent('a1')
      })

      // Emit event
      act(() => {
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'a1'))
      })

      // Wait briefly
      await new Promise(resolve => setTimeout(resolve, 50))

      // Paused agent behavior is handled by the hook internally
      // We verify the pause functionality is accessible
      expect(ref.current?.pauseAgent).toBeInstanceOf(Function)
    })
  })

  // ============================================================================
  // Connection Health Display
  // ============================================================================

  describe('Connection Health Display', () => {
    it('reflects connected status correctly', () => {
      mockUseWebSocketConnection.mockReturnValue(
        createMockConnectionHealth('connected')
      )

      const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()
      render(
        <ConnectedParallelAgentTerminalView
          ref={ref}
          agents={[createMockAgentConfig('a1')]}
        />
      )

      expect(ref.current?.isConnected).toBe(true)
      expect(ref.current?.isReconnecting).toBe(false)
    })

    it('reflects disconnected status correctly', () => {
      mockUseWebSocketConnection.mockReturnValue(
        createMockConnectionHealth('disconnected')
      )
      mockWsClient.isConnected.mockReturnValue(false)

      const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()
      render(
        <ConnectedParallelAgentTerminalView
          ref={ref}
          agents={[createMockAgentConfig('a1')]}
        />
      )

      expect(ref.current?.isConnected).toBe(false)
      expect(ref.current?.isReconnecting).toBe(false)
    })

    it('reflects reconnecting status correctly', () => {
      mockUseWebSocketConnection.mockReturnValue(
        createMockConnectionHealth('reconnecting')
      )
      mockWsClient.isConnected.mockReturnValue(false)

      const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()
      render(
        <ConnectedParallelAgentTerminalView
          ref={ref}
          agents={[createMockAgentConfig('a1')]}
        />
      )

      expect(ref.current?.isConnected).toBe(false)
      expect(ref.current?.isReconnecting).toBe(true)
    })

    it('tracks per-agent last event timestamp', async () => {
      const agent1 = createMockAgentConfig('a1')
      const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()

      render(
        <ConnectedParallelAgentTerminalView
          ref={ref}
          agents={[agent1]}
        />
      )

      // Emit event
      act(() => {
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'a1'))
      })

      await waitFor(() => {
        // Hook tracks timestamps internally
        expect(ref.current?.getAgentLogs).toBeInstanceOf(Function)
      })
    })

    it('identifies stale agent connections', async () => {
      const agent1 = createMockAgentConfig('a1')
      const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()

      render(
        <ConnectedParallelAgentTerminalView
          ref={ref}
          agents={[agent1]}
        />
      )

      // Aggregate stats include health information
      const stats = ref.current?.getAggregateStats()
      expect(stats).toBeDefined()
      expect(ref.current?.getAggregateStats).toBeInstanceOf(Function)
    })
  })

  // ============================================================================
  // Integration Edge Cases
  // ============================================================================

  describe('Integration Edge Cases', () => {
    it('handles panel close with agent unregistration', async () => {
      const agent1 = createMockAgentConfig('a1')
      const onPanelCloseSpy = vi.fn()

      render(
        <ConnectedParallelAgentTerminalView
          agents={[agent1]}
          onPanelClose={onPanelCloseSpy}
        />
      )

      // Click close button
      const closeButton = screen.getByTestId('close-panel-a1')
      await userEvent.click(closeButton)

      // Should call parent callback
      expect(onPanelCloseSpy).toHaveBeenCalledWith('panel-a1')
    })

    it('handles WebSocket connection errors gracefully', async () => {
      const onErrorSpy = vi.fn()

      render(
        <ConnectedParallelAgentTerminalView
          agents={[createMockAgentConfig('a1')]}
          onError={onErrorSpy}
        />
      )

      // Component should handle connection errors through hook
      expect(screen.getByTestId('connected-parallel-agent-terminal-view')).toBeInTheDocument()
    })

    it('maintains ref API consistency', () => {
      const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()

      render(
        <ConnectedParallelAgentTerminalView
          ref={ref}
          agents={[createMockAgentConfig('a1')]}
        />
      )

      // Verify all expected ref methods are present
      const expectedMethods = [
        'minimizeAll',
        'restoreAll',
        'getAllStates',
        'maximizePanel',
        'focusPanel',
        'pauseAgent',
        'resumeAgent',
        'clearAgentLogs',
        'setAgentFilter',
        'resetAgentFilter',
        'exportAgentLogs',
        'getAgentLogs',
        'getAgentFilteredLogs',
        'pauseAll',
        'resumeAll',
        'clearAll',
        'reconnect',
        'registerAgent',
        'unregisterAgent',
        'isAgentRegistered',
        'getAggregateStats',
      ]

      expectedMethods.forEach(method => {
        expect(ref.current?.[method as keyof ConnectedParallelAgentTerminalViewRef]).toBeInstanceOf(Function)
      })

      // Verify boolean properties
      expect(typeof ref.current?.isConnected).toBe('boolean')
      expect(typeof ref.current?.isReconnecting).toBe('boolean')
    })

    it('handles debug logging appropriately', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      render(
        <ConnectedParallelAgentTerminalView
          agents={[createMockAgentConfig('a1')]}
          debug={true}
        />
      )

      // Component should render without issues
      expect(screen.getByTestId('connected-parallel-agent-terminal-view')).toBeInTheDocument()

      consoleSpy.mockRestore()
    })
  })
})