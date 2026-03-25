/**
 * @vitest-environment jsdom
 */
import React, { useEffect, useState } from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { ConnectedParallelAgentTerminalView } from '../ConnectedParallelAgentTerminalView'
import type { ConnectedAgentConfig, ConnectedParallelAgentTerminalViewRef } from '../ConnectedParallelAgentTerminalView.types'
import type { AgentTerminalConfig } from '@/types/agent-terminals'

// Create a more realistic mock of useAgentTerminals that simulates real behavior
const createMockUseAgentTerminals = () => {
  const registeredAgents = new Map<string, AgentTerminalConfig>()

  return {
    agents: registeredAgents,
    agentIds: Array.from(registeredAgents.keys()),
    connectionHealth: {
      status: 'connected' as const,
      isHealthy: true,
      latencyMs: 25,
      averageLatencyMs: 30,
      reconnectAttempts: 0,
      maxReconnectAttempts: 10,
      consecutiveFailures: 0,
      lastHealthyAt: new Date().toISOString(),
      lastCheckAt: new Date().toISOString(),
      connectionUptime: 15000,
    },
    aggregateStats: {
      totalLogs: registeredAgents.size * 10,
      totalAgents: registeredAgents.size,
      activeAgents: registeredAgents.size,
      errorCount: 0,
      pausedAgents: 0,
    },
    getAgentState: vi.fn((agentId: string) => {
      const config = registeredAgents.get(agentId)
      return config ? {
        config,
        logs: [],
        filteredLogs: [],
        streamState: {
          isActive: true,
          isPaused: false,
          logCount: 0,
          errorCount: 0,
        },
        connectionStatus: 'connected' as const,
      } : undefined
    }),
    getAgentLogs: vi.fn(() => []),
    getAgentFilteredLogs: vi.fn(() => []),
    getAgentConnectionStatus: vi.fn(() => 'connected'),
    registerAgent: vi.fn((config: AgentTerminalConfig) => {
      registeredAgents.set(config.agentId, config)
    }),
    unregisterAgent: vi.fn((agentId: string) => {
      registeredAgents.delete(agentId)
    }),
    isAgentRegistered: vi.fn((agentId: string) => registeredAgents.has(agentId)),
    pauseAgent: vi.fn(),
    resumeAgent: vi.fn(),
    clearAgentLogs: vi.fn(),
    setAgentFilter: vi.fn(),
    resetAgentFilter: vi.fn(),
    exportAgentLogs: vi.fn(() => ''),
    pauseAll: vi.fn(),
    resumeAll: vi.fn(),
    clearAll: vi.fn(),
    reconnect: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: true,
    isReconnecting: false,
  }
}

let mockUseAgentTerminals: ReturnType<typeof createMockUseAgentTerminals>

const mockParallelAgentTerminalViewRef = {
  minimizeAll: vi.fn(),
  restoreAll: vi.fn(),
  getAllStates: vi.fn(() => ({})),
  maximizePanel: vi.fn(),
  focusPanel: vi.fn(),
}

vi.mock('@/hooks/useAgentTerminals', () => ({
  useAgentTerminals: vi.fn(() => mockUseAgentTerminals),
}))

vi.mock('../ParallelAgentTerminalView', () => ({
  ParallelAgentTerminalView: React.forwardRef<any, any>(function MockIntegrationParallelAgentTerminalView(props, ref) {
    React.useImperativeHandle(ref, () => mockParallelAgentTerminalViewRef)

    return (
      <div data-testid={props.testId || 'parallel-agent-terminal-view'}>
        <div data-testid="integration-test-view">Integration Test ParallelAgentTerminalView</div>
        <div data-testid="panel-count">{props.panels?.length || 0} panels</div>
        {props.panels?.map((panel: any, index: number) => (
          <div
            key={panel.panelId}
            data-testid={`integration-panel-${panel.panelId}`}
            data-panel-id={panel.panelId}
            data-agent-id={panel.agentId}
            data-title={panel.title}
            data-auto-connect={panel.autoConnect}
          >
            Panel {index + 1}: {panel.title || panel.agentId}
            {!panel.autoConnect && <span data-testid="no-auto-connect">No Auto Connect</span>}
            <button
              onClick={() => props.onPanelClose?.(panel.panelId)}
              data-testid={`integration-close-${panel.panelId}`}
            >
              Close Panel
            </button>
          </div>
        ))}
      </div>
    )
  }),
}))

// Mock the utilities
vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}))

describe('ConnectedParallelAgentTerminalView Integration', () => {
  const mockAgents: ConnectedAgentConfig[] = [
    {
      panelId: 'panel-1',
      agentId: 'agent-1',
      title: 'Test Agent 1',
      maxLogs: 200,
      autoStart: true,
      initialFilter: { level: 'info' },
    },
    {
      panelId: 'panel-2',
      agentId: 'agent-2',
      title: 'Test Agent 2',
      maxLogs: 300,
    },
  ]

  beforeEach(() => {
    mockUseAgentTerminals = createMockUseAgentTerminals()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Agent Lifecycle Management', () => {
    it('properly registers agents with correct configuration', async () => {
      await act(async () => {
        render(<ConnectedParallelAgentTerminalView agents={mockAgents} />)
      })

      expect(mockUseAgentTerminals.registerAgent).toHaveBeenCalledTimes(2)
      expect(mockUseAgentTerminals.registerAgent).toHaveBeenNthCalledWith(1, {
        agentId: 'agent-1',
        agentName: 'Test Agent 1',
        maxLogs: 200,
        initialFilter: { level: 'info' },
        autoStart: true,
      })
      expect(mockUseAgentTerminals.registerAgent).toHaveBeenNthCalledWith(2, {
        agentId: 'agent-2',
        agentName: 'Test Agent 2',
        maxLogs: 300,
        initialFilter: undefined,
        autoStart: undefined,
      })
    })

    it('reflects registered agents in panel configuration', async () => {
      await act(async () => {
        render(<ConnectedParallelAgentTerminalView agents={mockAgents} />)
      })

      // Check that panels are configured with autoConnect: false
      const panel1 = screen.getByTestId('integration-panel-panel-1')
      const panel2 = screen.getByTestId('integration-panel-panel-2')

      expect(panel1).toHaveAttribute('data-auto-connect', 'false')
      expect(panel2).toHaveAttribute('data-auto-connect', 'false')
      expect(screen.getAllByTestId('no-auto-connect')).toHaveLength(2)
    })

    it('dynamically adds and removes agents based on prop changes', async () => {
      const initialAgents = [mockAgents[0]]
      const { rerender } = render(<ConnectedParallelAgentTerminalView agents={initialAgents} />)

      // Initially only one agent should be registered
      await waitFor(() => {
        expect(mockUseAgentTerminals.registerAgent).toHaveBeenCalledTimes(1)
        expect(screen.getByTestId('panel-count')).toHaveTextContent('1 panels')
      })

      vi.clearAllMocks()

      // Add the second agent
      await act(async () => {
        rerender(<ConnectedParallelAgentTerminalView agents={mockAgents} />)
      })

      await waitFor(() => {
        expect(mockUseAgentTerminals.registerAgent).toHaveBeenCalledTimes(1)
        expect(mockUseAgentTerminals.registerAgent).toHaveBeenCalledWith({
          agentId: 'agent-2',
          agentName: 'Test Agent 2',
          maxLogs: 300,
          initialFilter: undefined,
          autoStart: undefined,
        })
        expect(screen.getByTestId('panel-count')).toHaveTextContent('2 panels')
      })

      vi.clearAllMocks()

      // Remove the first agent
      await act(async () => {
        rerender(<ConnectedParallelAgentTerminalView agents={[mockAgents[1]]} />)
      })

      await waitFor(() => {
        expect(screen.getByTestId('panel-count')).toHaveTextContent('1 panels')
      })
      expect(mockUseAgentTerminals.unregisterAgent).toHaveBeenCalledWith('agent-1')
    })

    it('unregisters agents when component unmounts', async () => {
      mockUseAgentTerminals.isAgentRegistered = vi.fn(() => true)

      const { unmount } = render(<ConnectedParallelAgentTerminalView agents={mockAgents} />)

      await act(async () => {
        unmount()
      })

      expect(mockUseAgentTerminals.unregisterAgent).toHaveBeenCalledWith('agent-1')
      expect(mockUseAgentTerminals.unregisterAgent).toHaveBeenCalledWith('agent-2')
    })
  })

  describe('Panel Close Integration', () => {
    it('unregisters agent when panel is closed through UI', async () => {
      const user = userEvent.setup()

      render(<ConnectedParallelAgentTerminalView agents={mockAgents} />)

      const closeButton = screen.getByTestId('integration-close-panel-1')

      await act(async () => {
        await user.click(closeButton)
      })

      expect(mockUseAgentTerminals.unregisterAgent).toHaveBeenCalledWith('agent-1')
    })

    it('calls parent onPanelClose callback when panel is closed', async () => {
      const user = userEvent.setup()
      const onPanelClose = vi.fn()

      render(
        <ConnectedParallelAgentTerminalView
          agents={mockAgents}
          onPanelClose={onPanelClose}
        />
      )

      const closeButton = screen.getByTestId('integration-close-panel-2')

      await act(async () => {
        await user.click(closeButton)
      })

      expect(onPanelClose).toHaveBeenCalledWith('panel-2')
      expect(mockUseAgentTerminals.unregisterAgent).toHaveBeenCalledWith('agent-2')
    })
  })

  describe('Real-time State Updates', () => {
    it('updates panel configuration when agent state changes', async () => {
      // Create a wrapper component that can update agent configs
      const TestWrapper = () => {
        const [agents, setAgents] = useState(mockAgents)

        useEffect(() => {
          // Simulate updating agent configuration after initial render
          const timer = setTimeout(() => {
            setAgents(prev => prev.map(agent =>
              agent.agentId === 'agent-1'
                ? { ...agent, title: 'Updated Agent 1' }
                : agent
            ))
          }, 100)

          return () => clearTimeout(timer)
        }, [])

        return <ConnectedParallelAgentTerminalView agents={agents} />
      }

      render(<TestWrapper />)

      // Initially should show original title
      expect(screen.getByText('Panel 1: Test Agent 1')).toBeInTheDocument()

      // Wait for the state update
      await waitFor(() => {
        expect(screen.getByText('Panel 1: Updated Agent 1')).toBeInTheDocument()
      }, { timeout: 200 })
    })
  })

  describe('Connection Health Integration', () => {
    it('uses connection options correctly', () => {
      const onConnectionChange = vi.fn()
      const onError = vi.fn()
      const onLogs = vi.fn()

      render(
        <ConnectedParallelAgentTerminalView
          agents={mockAgents}
          autoConnect={false}
          defaultMaxLogs={150}
          onConnectionChange={onConnectionChange}
          onError={onError}
          onLogs={onLogs}
          debug={true}
        />
      )

      // Component should render successfully with all options
      expect(screen.getByTestId('integration-test-view')).toBeInTheDocument()
    })
  })

  describe('Ref API Integration', () => {
    it('provides fully functional ref API', () => {
      const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()

      render(<ConnectedParallelAgentTerminalView ref={ref} agents={mockAgents} />)

      expect(ref.current).toBeTruthy()

      // Test that methods are properly bound and callable
      expect(() => ref.current!.minimizeAll()).not.toThrow()
      expect(() => ref.current!.restoreAll()).not.toThrow()
      expect(() => ref.current!.pauseAll()).not.toThrow()
      expect(() => ref.current!.resumeAll()).not.toThrow()
      expect(() => ref.current!.clearAll()).not.toThrow()
      expect(() => ref.current!.reconnect()).not.toThrow()

      // Test individual agent controls
      expect(() => ref.current!.pauseAgent('agent-1')).not.toThrow()
      expect(() => ref.current!.resumeAgent('agent-1')).not.toThrow()
      expect(() => ref.current!.clearAgentLogs('agent-1')).not.toThrow()

      // Test status getters
      expect(typeof ref.current!.isConnected).toBe('boolean')
      expect(typeof ref.current!.isReconnecting).toBe('boolean')
      expect(typeof ref.current!.getAggregateStats()).toBe('object')
    })

    it('delegates view operations to underlying ParallelAgentTerminalView', () => {
      const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()

      render(<ConnectedParallelAgentTerminalView ref={ref} agents={mockAgents} />)

      ref.current!.maximizePanel('panel-1')
      expect(mockParallelAgentTerminalViewRef.maximizePanel).toHaveBeenCalledWith('panel-1')

      ref.current!.focusPanel('panel-2')
      expect(mockParallelAgentTerminalViewRef.focusPanel).toHaveBeenCalledWith('panel-2')

      const states = ref.current!.getAllStates()
      expect(mockParallelAgentTerminalViewRef.getAllStates).toHaveBeenCalled()
      expect(states).toBeDefined()
    })

    it('delegates stream operations to useAgentTerminals', () => {
      const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()

      render(<ConnectedParallelAgentTerminalView ref={ref} agents={mockAgents} />)

      ref.current!.setAgentFilter('agent-1', { level: 'error' })
      expect(mockUseAgentTerminals.setAgentFilter).toHaveBeenCalledWith('agent-1', { level: 'error' })

      ref.current!.resetAgentFilter('agent-2')
      expect(mockUseAgentTerminals.resetAgentFilter).toHaveBeenCalledWith('agent-2')

      const logs = ref.current!.getAgentLogs('agent-1')
      expect(mockUseAgentTerminals.getAgentLogs).toHaveBeenCalledWith('agent-1')
      expect(logs).toBeDefined()
    })
  })

  describe('Error Recovery', () => {
    it('recovers gracefully from registration failures', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const onError = vi.fn()

      // Make registerAgent throw for the first agent only
      mockUseAgentTerminals.registerAgent = vi.fn((config) => {
        if (config.agentId === 'agent-1') {
          throw new Error('Network error')
        }
      })

      await act(async () => {
        render(
          <ConnectedParallelAgentTerminalView
            agents={mockAgents}
            onError={onError}
          />
        )
      })

      // Should have tried to register both agents
      expect(mockUseAgentTerminals.registerAgent).toHaveBeenCalledTimes(2)

      // Should have called error handler for failed agent
      expect(onError).toHaveBeenCalledWith('agent-1', 'Network error')

      // Component should still render successfully
      expect(screen.getByTestId('integration-test-view')).toBeInTheDocument()

      consoleErrorSpy.mockRestore()
    })

    it('handles partial unregistration failures during cleanup', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockUseAgentTerminals.isAgentRegistered = vi.fn(() => true)
      mockUseAgentTerminals.unregisterAgent = vi.fn((agentId) => {
        if (agentId === 'agent-1') {
          throw new Error('Unregister failed')
        }
      })

      const { unmount } = render(<ConnectedParallelAgentTerminalView agents={mockAgents} />)

      await act(async () => {
        unmount()
      })

      // Should have attempted to unregister both agents
      expect(mockUseAgentTerminals.unregisterAgent).toHaveBeenCalledTimes(2)

      // Should have logged error for the failed unregistration
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ConnectedParallelAgentTerminalView] Failed to cleanup agent:',
        'agent-1',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Performance Considerations', () => {
    it('handles large numbers of agents efficiently', async () => {
      const manyAgents: ConnectedAgentConfig[] = Array.from({ length: 12 }, (_, i) => ({
        panelId: `panel-${i}`,
        agentId: `agent-${i}`,
        title: `Agent ${i}`,
      }))

      await act(async () => {
        render(<ConnectedParallelAgentTerminalView agents={manyAgents} />)
      })

      expect(mockUseAgentTerminals.registerAgent).toHaveBeenCalledTimes(12)
      expect(screen.getByTestId('panel-count')).toHaveTextContent('12 panels')

      // All panels should be rendered
      for (let i = 0; i < 12; i++) {
        expect(screen.getByTestId(`integration-panel-panel-${i}`)).toBeInTheDocument()
      }
    })

    it('minimizes re-renders when agent props do not change', () => {
      const { rerender } = render(<ConnectedParallelAgentTerminalView agents={mockAgents} />)

      vi.clearAllMocks()

      // Re-render with same agents reference
      rerender(<ConnectedParallelAgentTerminalView agents={mockAgents} />)

      // Should not trigger any registration calls
      expect(mockUseAgentTerminals.registerAgent).not.toHaveBeenCalled()
      expect(mockUseAgentTerminals.unregisterAgent).not.toHaveBeenCalled()
    })
  })
})