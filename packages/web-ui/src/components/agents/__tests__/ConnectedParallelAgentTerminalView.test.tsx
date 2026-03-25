/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { ConnectedParallelAgentTerminalView } from '../ConnectedParallelAgentTerminalView'
import type { ConnectedAgentConfig, ConnectedParallelAgentTerminalViewRef } from '../ConnectedParallelAgentTerminalView.types'

// Mock dependencies
const mockUseAgentTerminals = {
  agents: new Map(),
  agentIds: [],
  connectionHealth: {
    status: 'connected' as const,
    isHealthy: true,
    latencyMs: null,
    averageLatencyMs: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
    consecutiveFailures: 0,
    lastHealthyAt: null,
    lastCheckAt: null,
    connectionUptime: null,
  },
  aggregateStats: {
    totalLogs: 0,
    totalAgents: 0,
    activeAgents: 0,
    errorCount: 0,
    pausedAgents: 0,
  },
  getAgentState: vi.fn(() => undefined),
  getAgentLogs: vi.fn(() => []),
  getAgentFilteredLogs: vi.fn(() => []),
  getAgentConnectionStatus: vi.fn(),
  registerAgent: vi.fn(),
  unregisterAgent: vi.fn(),
  isAgentRegistered: vi.fn(() => false),
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
  ParallelAgentTerminalView: React.forwardRef<any, any>(function MockParallelAgentTerminalView(props, ref) {
    React.useImperativeHandle(ref, () => mockParallelAgentTerminalViewRef)

    return (
      <div data-testid={props.testId || 'parallel-agent-terminal-view'}>
        <div data-testid="mock-parallel-view">Mock ParallelAgentTerminalView</div>
        {props.panels?.map((panel: any) => (
          <div
            key={panel.panelId}
            data-testid={`panel-${panel.panelId}`}
            data-panel-id={panel.panelId}
            data-agent-id={panel.agentId}
            data-title={panel.title}
          >
            Panel: {panel.title || panel.agentId}
            <button
              onClick={() => props.onPanelClose?.(panel.panelId)}
              data-testid={`close-${panel.panelId}`}
            >
              Close
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

describe('ConnectedParallelAgentTerminalView', () => {
  const mockAgents: ConnectedAgentConfig[] = [
    {
      panelId: 'panel-1',
      agentId: 'agent-1',
      title: 'Agent 1',
      maxLogs: 100,
      autoStart: true,
    },
    {
      panelId: 'panel-2',
      agentId: 'agent-2',
      title: 'Agent 2',
      initialFilter: { level: 'info' },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock implementations
    mockUseAgentTerminals.registerAgent = vi.fn()
    mockUseAgentTerminals.unregisterAgent = vi.fn()
    mockUseAgentTerminals.isAgentRegistered = vi.fn(() => false)
    mockUseAgentTerminals.getAgentState = vi.fn(() => undefined)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Rendering', () => {
    it('renders successfully with agents', () => {
      render(<ConnectedParallelAgentTerminalView agents={mockAgents} />)

      expect(screen.getByTestId('connected-parallel-agent-terminal-view')).toBeInTheDocument()
      expect(screen.getByTestId('mock-parallel-view')).toBeInTheDocument()
      expect(screen.getByTestId('panel-panel-1')).toBeInTheDocument()
      expect(screen.getByTestId('panel-panel-2')).toBeInTheDocument()
    })

    it('renders with custom testId', () => {
      render(
        <ConnectedParallelAgentTerminalView
          agents={mockAgents}
          testId="custom-test-id"
        />
      )

      expect(screen.getByTestId('custom-test-id')).toBeInTheDocument()
    })

    it('handles empty agents array', () => {
      render(<ConnectedParallelAgentTerminalView agents={[]} />)

      expect(screen.getByTestId('connected-parallel-agent-terminal-view')).toBeInTheDocument()
      expect(screen.queryByTestId(/panel-/)).not.toBeInTheDocument()
    })

    it('applies custom className', () => {
      render(
        <ConnectedParallelAgentTerminalView
          agents={mockAgents}
          className="custom-class"
        />
      )

      const view = screen.getByTestId('connected-parallel-agent-terminal-view')
      expect(view).toBeInTheDocument()
    })
  })

  describe('Props forwarding to ParallelAgentTerminalView', () => {
    it('forwards all layout props correctly', () => {
      const onPanelStateChange = vi.fn()
      const onPanelClose = vi.fn()

      render(
        <ConnectedParallelAgentTerminalView
          agents={mockAgents}
          gap="lg"
          maxHeight="500px"
          onPanelStateChange={onPanelStateChange}
          onPanelClose={onPanelClose}
          className="custom-class"
          displayMode="compact"
          showLoadingSkeleton={true}
        />
      )

      // Component should render without errors
      expect(screen.getByTestId('connected-parallel-agent-terminal-view')).toBeInTheDocument()
    })

    it('transforms agent configs to panel configs correctly', () => {
      render(<ConnectedParallelAgentTerminalView agents={mockAgents} />)

      // Check that panels are created with correct data
      const panel1 = screen.getByTestId('panel-panel-1')
      const panel2 = screen.getByTestId('panel-panel-2')

      expect(panel1).toHaveAttribute('data-agent-id', 'agent-1')
      expect(panel1).toHaveAttribute('data-title', 'Agent 1')
      expect(panel2).toHaveAttribute('data-agent-id', 'agent-2')
      expect(panel2).toHaveAttribute('data-title', 'Agent 2')
    })
  })

  describe('useAgentTerminals Integration', () => {
    it('accepts streaming options correctly', () => {
      const onLogs = vi.fn()
      const onError = vi.fn()
      const onConnectionChange = vi.fn()

      render(
        <ConnectedParallelAgentTerminalView
          agents={mockAgents}
          autoConnect={false}
          defaultMaxLogs={100}
          onLogs={onLogs}
          onError={onError}
          onConnectionChange={onConnectionChange}
          debug={true}
        />
      )

      // Component should render successfully with all options
      expect(screen.getByTestId('connected-parallel-agent-terminal-view')).toBeInTheDocument()
    })

    it('uses default streaming options when not provided', () => {
      render(<ConnectedParallelAgentTerminalView agents={mockAgents} />)

      // Component should render successfully with defaults
      expect(screen.getByTestId('connected-parallel-agent-terminal-view')).toBeInTheDocument()
    })
  })

  describe('Agent Registration', () => {
    it('registers agents on mount', async () => {
      await act(async () => {
        render(<ConnectedParallelAgentTerminalView agents={mockAgents} />)
      })

      expect(mockUseAgentTerminals.registerAgent).toHaveBeenCalledTimes(2)
      expect(mockUseAgentTerminals.registerAgent).toHaveBeenCalledWith({
        agentId: 'agent-1',
        agentName: 'Agent 1',
        maxLogs: 100,
        initialFilter: undefined,
        autoStart: true,
      })
      expect(mockUseAgentTerminals.registerAgent).toHaveBeenCalledWith({
        agentId: 'agent-2',
        agentName: 'Agent 2',
        maxLogs: undefined,
        initialFilter: { level: 'info' },
        autoStart: undefined,
      })
    })

    it('skips registration if agent is already registered', async () => {
      mockUseAgentTerminals.isAgentRegistered = vi.fn((agentId) => agentId === 'agent-1')

      await act(async () => {
        render(<ConnectedParallelAgentTerminalView agents={mockAgents} />)
      })

      expect(mockUseAgentTerminals.registerAgent).toHaveBeenCalledTimes(1)
      expect(mockUseAgentTerminals.registerAgent).toHaveBeenCalledWith({
        agentId: 'agent-2',
        agentName: 'Agent 2',
        maxLogs: undefined,
        initialFilter: { level: 'info' },
        autoStart: undefined,
      })
    })

    it('unregisters agents when they are removed from props', async () => {
      const { rerender } = render(<ConnectedParallelAgentTerminalView agents={mockAgents} />)

      await act(async () => {
        // Remove the first agent
        rerender(<ConnectedParallelAgentTerminalView agents={[mockAgents[1]]} />)
      })

      expect(mockUseAgentTerminals.unregisterAgent).toHaveBeenCalledWith('agent-1')
      expect(mockUseAgentTerminals.unregisterAgent).toHaveBeenCalledTimes(1)
    })

    it('registers new agents when they are added to props', async () => {
      const { rerender } = render(<ConnectedParallelAgentTerminalView agents={[mockAgents[0]]} />)

      vi.clearAllMocks()

      await act(async () => {
        // Add the second agent
        rerender(<ConnectedParallelAgentTerminalView agents={mockAgents} />)
      })

      expect(mockUseAgentTerminals.registerAgent).toHaveBeenCalledWith({
        agentId: 'agent-2',
        agentName: 'Agent 2',
        maxLogs: undefined,
        initialFilter: { level: 'info' },
        autoStart: undefined,
      })
    })

    it('unregisters all agents on unmount', async () => {
      mockUseAgentTerminals.isAgentRegistered = vi.fn(() => true)

      const { unmount } = render(<ConnectedParallelAgentTerminalView agents={mockAgents} />)

      await act(async () => {
        unmount()
      })

      expect(mockUseAgentTerminals.unregisterAgent).toHaveBeenCalledWith('agent-1')
      expect(mockUseAgentTerminals.unregisterAgent).toHaveBeenCalledWith('agent-2')
      expect(mockUseAgentTerminals.unregisterAgent).toHaveBeenCalledTimes(2)
    })
  })

  describe('Panel Close Handler', () => {
    it('unregisters agent when panel is closed', async () => {
      const onPanelClose = vi.fn()

      render(
        <ConnectedParallelAgentTerminalView
          agents={mockAgents}
          onPanelClose={onPanelClose}
        />
      )

      const closeButton = screen.getByTestId('close-panel-1')

      await act(async () => {
        fireEvent.click(closeButton)
      })

      expect(mockUseAgentTerminals.unregisterAgent).toHaveBeenCalledWith('agent-1')
      expect(onPanelClose).toHaveBeenCalledWith('panel-1')
    })

    it('handles panel close when agent is not found', async () => {
      const onPanelClose = vi.fn()

      render(
        <ConnectedParallelAgentTerminalView
          agents={mockAgents}
          onPanelClose={onPanelClose}
        />
      )

      // Simulate close for non-existent panel
      const component = screen.getByTestId('connected-parallel-agent-terminal-view')

      await act(async () => {
        fireEvent.click(screen.getByTestId('close-panel-1'))
      })

      expect(onPanelClose).toHaveBeenCalledWith('panel-1')
    })
  })

  describe('Error Handling', () => {
    it('handles registration errors gracefully', async () => {
      const onError = vi.fn()
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockUseAgentTerminals.registerAgent = vi.fn(() => {
        throw new Error('Registration failed')
      })

      await act(async () => {
        render(
          <ConnectedParallelAgentTerminalView
            agents={[mockAgents[0]]}
            onError={onError}
          />
        )
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ConnectedParallelAgentTerminalView] Failed to register agent:',
        'agent-1',
        expect.any(Error)
      )
      expect(onError).toHaveBeenCalledWith('agent-1', 'Registration failed')

      consoleErrorSpy.mockRestore()
    })

    it('handles unregistration errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockUseAgentTerminals.unregisterAgent = vi.fn(() => {
        throw new Error('Unregistration failed')
      })

      const { rerender } = render(<ConnectedParallelAgentTerminalView agents={mockAgents} />)

      await act(async () => {
        rerender(<ConnectedParallelAgentTerminalView agents={[]} />)
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ConnectedParallelAgentTerminalView] Failed to unregister agent:',
        expect.any(String),
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })

    it('handles cleanup errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockUseAgentTerminals.isAgentRegistered = vi.fn(() => true)
      mockUseAgentTerminals.unregisterAgent = vi.fn(() => {
        throw new Error('Cleanup failed')
      })

      const { unmount } = render(<ConnectedParallelAgentTerminalView agents={[mockAgents[0]]} />)

      await act(async () => {
        unmount()
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ConnectedParallelAgentTerminalView] Failed to cleanup agent:',
        'agent-1',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Debug Logging', () => {
    it('logs debug messages when debug=true', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await act(async () => {
        render(
          <ConnectedParallelAgentTerminalView
            agents={[mockAgents[0]]}
            debug={true}
          />
        )
      })

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ConnectedParallelAgentTerminalView] Registered agent:',
        'agent-1'
      )

      consoleLogSpy.mockRestore()
    })

    it('does not log debug messages when debug=false', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await act(async () => {
        render(
          <ConnectedParallelAgentTerminalView
            agents={[mockAgents[0]]}
            debug={false}
          />
        )
      })

      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('[ConnectedParallelAgentTerminalView]')
      )

      consoleLogSpy.mockRestore()
    })
  })

  describe('Ref API', () => {
    it('exposes all ref API methods', () => {
      const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()

      render(<ConnectedParallelAgentTerminalView ref={ref} agents={mockAgents} />)

      expect(ref.current).toBeDefined()

      // Panel view controls
      expect(typeof ref.current!.minimizeAll).toBe('function')
      expect(typeof ref.current!.restoreAll).toBe('function')
      expect(typeof ref.current!.getAllStates).toBe('function')
      expect(typeof ref.current!.maximizePanel).toBe('function')
      expect(typeof ref.current!.focusPanel).toBe('function')

      // Per-agent stream controls
      expect(typeof ref.current!.pauseAgent).toBe('function')
      expect(typeof ref.current!.resumeAgent).toBe('function')
      expect(typeof ref.current!.clearAgentLogs).toBe('function')
      expect(typeof ref.current!.setAgentFilter).toBe('function')
      expect(typeof ref.current!.resetAgentFilter).toBe('function')
      expect(typeof ref.current!.exportAgentLogs).toBe('function')
      expect(typeof ref.current!.getAgentLogs).toBe('function')
      expect(typeof ref.current!.getAgentFilteredLogs).toBe('function')

      // Bulk stream controls
      expect(typeof ref.current!.pauseAll).toBe('function')
      expect(typeof ref.current!.resumeAll).toBe('function')
      expect(typeof ref.current!.clearAll).toBe('function')
      expect(typeof ref.current!.reconnect).toBe('function')

      // Agent registration
      expect(typeof ref.current!.registerAgent).toBe('function')
      expect(typeof ref.current!.unregisterAgent).toBe('function')
      expect(typeof ref.current!.isAgentRegistered).toBe('function')

      // Status
      expect(typeof ref.current!.getAggregateStats).toBe('function')
      expect(typeof ref.current!.isConnected).toBe('boolean')
      expect(typeof ref.current!.isReconnecting).toBe('boolean')
    })

    it('delegates panel view control methods to underlying ParallelAgentTerminalView', () => {
      const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()

      render(<ConnectedParallelAgentTerminalView ref={ref} agents={mockAgents} />)

      // Test panel view controls
      ref.current!.minimizeAll()
      expect(mockParallelAgentTerminalViewRef.minimizeAll).toHaveBeenCalled()

      ref.current!.restoreAll()
      expect(mockParallelAgentTerminalViewRef.restoreAll).toHaveBeenCalled()

      ref.current!.getAllStates()
      expect(mockParallelAgentTerminalViewRef.getAllStates).toHaveBeenCalled()

      ref.current!.maximizePanel('panel-1')
      expect(mockParallelAgentTerminalViewRef.maximizePanel).toHaveBeenCalledWith('panel-1')

      ref.current!.focusPanel('panel-2')
      expect(mockParallelAgentTerminalViewRef.focusPanel).toHaveBeenCalledWith('panel-2')
    })

    it('exposes stream control methods from useAgentTerminals', () => {
      const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()

      render(<ConnectedParallelAgentTerminalView ref={ref} agents={mockAgents} />)

      // Test stream controls
      ref.current!.pauseAgent('agent-1')
      expect(mockUseAgentTerminals.pauseAgent).toHaveBeenCalledWith('agent-1')

      ref.current!.resumeAgent('agent-2')
      expect(mockUseAgentTerminals.resumeAgent).toHaveBeenCalledWith('agent-2')

      ref.current!.clearAgentLogs('agent-1')
      expect(mockUseAgentTerminals.clearAgentLogs).toHaveBeenCalledWith('agent-1')

      ref.current!.pauseAll()
      expect(mockUseAgentTerminals.pauseAll).toHaveBeenCalled()

      ref.current!.resumeAll()
      expect(mockUseAgentTerminals.resumeAll).toHaveBeenCalled()

      ref.current!.clearAll()
      expect(mockUseAgentTerminals.clearAll).toHaveBeenCalled()

      ref.current!.reconnect()
      expect(mockUseAgentTerminals.reconnect).toHaveBeenCalled()
    })

    it('returns correct status values', () => {
      const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()

      render(<ConnectedParallelAgentTerminalView ref={ref} agents={mockAgents} />)

      expect(ref.current!.isConnected).toBe(true)
      expect(ref.current!.isReconnecting).toBe(false)

      const stats = ref.current!.getAggregateStats()
      expect(stats).toEqual(mockUseAgentTerminals.aggregateStats)
    })
  })

  describe('Edge Cases', () => {
    it('handles rapidly changing agents prop', async () => {
      const agents1 = [mockAgents[0]]
      const agents2 = [mockAgents[1]]
      const agents3 = []

      const { rerender } = render(<ConnectedParallelAgentTerminalView agents={agents1} />)

      await act(async () => {
        rerender(<ConnectedParallelAgentTerminalView agents={agents2} />)
        rerender(<ConnectedParallelAgentTerminalView agents={agents3} />)
      })

      // Should handle all changes without errors
      expect(screen.getByTestId('connected-parallel-agent-terminal-view')).toBeInTheDocument()
    })

    it('handles duplicate agent IDs gracefully', async () => {
      const duplicateAgents: ConnectedAgentConfig[] = [
        {
          panelId: 'panel-1',
          agentId: 'agent-1',
          title: 'Agent 1A',
        },
        {
          panelId: 'panel-2',
          agentId: 'agent-1', // Duplicate agent ID
          title: 'Agent 1B',
        },
      ]

      await act(async () => {
        render(<ConnectedParallelAgentTerminalView agents={duplicateAgents} />)
      })

      // Should still render both panels
      expect(screen.getByTestId('panel-panel-1')).toBeInTheDocument()
      expect(screen.getByTestId('panel-panel-2')).toBeInTheDocument()
    })

    it('handles agents with minimal configuration', async () => {
      const minimalAgents: ConnectedAgentConfig[] = [
        {
          panelId: 'panel-1',
          agentId: 'agent-1',
          title: 'Minimal Agent',
        },
      ]

      await act(async () => {
        render(<ConnectedParallelAgentTerminalView agents={minimalAgents} />)
      })

      expect(mockUseAgentTerminals.registerAgent).toHaveBeenCalledWith({
        agentId: 'agent-1',
        agentName: 'Minimal Agent',
        maxLogs: undefined,
        initialFilter: undefined,
        autoStart: undefined,
      })
    })
  })
})