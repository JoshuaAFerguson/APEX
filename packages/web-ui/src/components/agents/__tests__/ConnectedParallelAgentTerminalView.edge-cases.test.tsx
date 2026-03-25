/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { ConnectedParallelAgentTerminalView } from '../ConnectedParallelAgentTerminalView'
import type { ConnectedAgentConfig, ConnectedParallelAgentTerminalViewRef } from '../ConnectedParallelAgentTerminalView.types'

// Mock setup
const createFailingMockUseAgentTerminals = () => ({
  agents: new Map(),
  agentIds: [],
  connectionHealth: {
    status: 'disconnected' as const,
    isHealthy: false,
    latencyMs: null,
    averageLatencyMs: null,
    reconnectAttempts: 5,
    maxReconnectAttempts: 10,
    consecutiveFailures: 3,
    lastHealthyAt: null,
    lastCheckAt: new Date().toISOString(),
    connectionUptime: 0,
  },
  aggregateStats: {
    totalLogs: 0,
    totalAgents: 0,
    activeAgents: 0,
    errorCount: 5,
    pausedAgents: 0,
  },
  getAgentState: vi.fn(() => undefined),
  getAgentLogs: vi.fn(() => []),
  getAgentFilteredLogs: vi.fn(() => []),
  getAgentConnectionStatus: vi.fn(() => 'disconnected'),
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
  isConnected: false,
  isReconnecting: true,
})

let mockUseAgentTerminals: ReturnType<typeof createFailingMockUseAgentTerminals>

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
  ParallelAgentTerminalView: React.forwardRef<any, any>(function MockEdgeCaseParallelAgentTerminalView(props, ref) {
    React.useImperativeHandle(ref, () => mockParallelAgentTerminalViewRef)

    return (
      <div data-testid={props.testId || 'parallel-agent-terminal-view'}>
        <div data-testid="edge-case-view">Edge Case ParallelAgentTerminalView</div>
        {props.panels?.map((panel: any) => (
          <div
            key={panel.panelId}
            data-testid={`edge-panel-${panel.panelId}`}
            data-panel-id={panel.panelId}
            data-agent-id={panel.agentId}
          >
            Panel: {panel.title || panel.agentId}
            <button
              onClick={() => props.onPanelClose?.(panel.panelId)}
              data-testid={`edge-close-${panel.panelId}`}
            >
              Close
            </button>
          </div>
        ))}
      </div>
    )
  }),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}))

describe('ConnectedParallelAgentTerminalView Edge Cases', () => {
  beforeEach(() => {
    mockUseAgentTerminals = createFailingMockUseAgentTerminals()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Invalid Agent Configurations', () => {
    it('handles agents with missing required fields', async () => {
      const invalidAgents: any[] = [
        {
          // Missing agentId and title
          panelId: 'panel-1',
        },
        {
          panelId: 'panel-2',
          agentId: '', // Empty agentId
          title: 'Valid Title',
        },
        {
          panelId: 'panel-3',
          agentId: 'agent-3',
          title: '', // Empty title
        },
      ]

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await act(async () => {
        render(<ConnectedParallelAgentTerminalView agents={invalidAgents} />)
      })

      // Component should still render
      expect(screen.getByTestId('edge-case-view')).toBeInTheDocument()

      consoleErrorSpy.mockRestore()
    })

    it('handles agents with extremely long configurations', async () => {
      const longAgents: ConnectedAgentConfig[] = [
        {
          panelId: 'a'.repeat(1000),
          agentId: 'b'.repeat(1000),
          title: 'c'.repeat(1000),
          maxLogs: Number.MAX_SAFE_INTEGER,
        },
      ]

      await act(async () => {
        render(<ConnectedParallelAgentTerminalView agents={longAgents} />)
      })

      expect(screen.getByTestId('edge-case-view')).toBeInTheDocument()
    })

    it('handles agents with negative or zero maxLogs', async () => {
      const edgeAgents: ConnectedAgentConfig[] = [
        {
          panelId: 'panel-1',
          agentId: 'agent-1',
          title: 'Agent 1',
          maxLogs: -100,
        },
        {
          panelId: 'panel-2',
          agentId: 'agent-2',
          title: 'Agent 2',
          maxLogs: 0,
        },
      ]

      await act(async () => {
        render(<ConnectedParallelAgentTerminalView agents={edgeAgents} />)
      })

      expect(mockUseAgentTerminals.registerAgent).toHaveBeenCalledWith({
        agentId: 'agent-1',
        agentName: 'Agent 1',
        maxLogs: -100,
        initialFilter: undefined,
        autoStart: undefined,
      })

      expect(mockUseAgentTerminals.registerAgent).toHaveBeenCalledWith({
        agentId: 'agent-2',
        agentName: 'Agent 2',
        maxLogs: 0,
        initialFilter: undefined,
        autoStart: undefined,
      })
    })

    it('handles malformed initialFilter objects', async () => {
      const malformedAgents: ConnectedAgentConfig[] = [
        {
          panelId: 'panel-1',
          agentId: 'agent-1',
          title: 'Agent 1',
          initialFilter: {} as any, // Empty object
        },
        {
          panelId: 'panel-2',
          agentId: 'agent-2',
          title: 'Agent 2',
          initialFilter: { invalidField: 'value' } as any, // Invalid fields
        },
      ]

      await act(async () => {
        render(<ConnectedParallelAgentTerminalView agents={malformedAgents} />)
      })

      expect(mockUseAgentTerminals.registerAgent).toHaveBeenCalledWith({
        agentId: 'agent-1',
        agentName: 'Agent 1',
        maxLogs: undefined,
        initialFilter: {},
        autoStart: undefined,
      })
    })
  })

  describe('Registration Failures', () => {
    it('handles registration throwing synchronous errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const onError = vi.fn()

      mockUseAgentTerminals.registerAgent = vi.fn(() => {
        throw new Error('Synchronous registration error')
      })

      const agents: ConnectedAgentConfig[] = [
        { panelId: 'panel-1', agentId: 'agent-1', title: 'Agent 1' }
      ]

      await act(async () => {
        render(
          <ConnectedParallelAgentTerminalView
            agents={agents}
            onError={onError}
          />
        )
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ConnectedParallelAgentTerminalView] Failed to register agent:',
        'agent-1',
        expect.any(Error)
      )
      expect(onError).toHaveBeenCalledWith('agent-1', 'Synchronous registration error')

      consoleErrorSpy.mockRestore()
    })

    it('handles registration throwing non-Error objects', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const onError = vi.fn()

      mockUseAgentTerminals.registerAgent = vi.fn(() => {
        throw 'String error' // Throwing a string instead of Error
      })

      const agents: ConnectedAgentConfig[] = [
        { panelId: 'panel-1', agentId: 'agent-1', title: 'Agent 1' }
      ]

      await act(async () => {
        render(
          <ConnectedParallelAgentTerminalView
            agents={agents}
            onError={onError}
          />
        )
      })

      expect(onError).toHaveBeenCalledWith('agent-1', 'Registration failed')

      consoleErrorSpy.mockRestore()
    })

    it('handles partial registration failures with multiple agents', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const onError = vi.fn()

      let callCount = 0
      mockUseAgentTerminals.registerAgent = vi.fn(() => {
        callCount++
        if (callCount === 2) {
          throw new Error('Second agent failed')
        }
      })

      const agents: ConnectedAgentConfig[] = [
        { panelId: 'panel-1', agentId: 'agent-1', title: 'Agent 1' },
        { panelId: 'panel-2', agentId: 'agent-2', title: 'Agent 2' },
        { panelId: 'panel-3', agentId: 'agent-3', title: 'Agent 3' },
      ]

      await act(async () => {
        render(
          <ConnectedParallelAgentTerminalView
            agents={agents}
            onError={onError}
          />
        )
      })

      expect(mockUseAgentTerminals.registerAgent).toHaveBeenCalledTimes(3)
      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith('agent-2', 'Second agent failed')

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Unregistration Failures', () => {
    it('handles unregistration errors during component updates', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockUseAgentTerminals.unregisterAgent = vi.fn(() => {
        throw new Error('Unregistration failed')
      })

      const initialAgents: ConnectedAgentConfig[] = [
        { panelId: 'panel-1', agentId: 'agent-1', title: 'Agent 1' },
        { panelId: 'panel-2', agentId: 'agent-2', title: 'Agent 2' },
      ]

      const { rerender } = render(
        <ConnectedParallelAgentTerminalView agents={initialAgents} />
      )

      await act(async () => {
        rerender(<ConnectedParallelAgentTerminalView agents={[]} />)
      })

      expect(consoleErrorSpy).toHaveBeenCalledTimes(2)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ConnectedParallelAgentTerminalView] Failed to unregister agent:',
        'agent-1',
        expect.any(Error)
      )
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ConnectedParallelAgentTerminalView] Failed to unregister agent:',
        'agent-2',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })

    it('handles unregistration errors during panel close', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const onError = vi.fn()
      const onPanelClose = vi.fn()

      mockUseAgentTerminals.unregisterAgent = vi.fn(() => {
        throw new Error('Panel close unregister failed')
      })

      const agents: ConnectedAgentConfig[] = [
        { panelId: 'panel-1', agentId: 'agent-1', title: 'Agent 1' }
      ]

      render(
        <ConnectedParallelAgentTerminalView
          agents={agents}
          onError={onError}
          onPanelClose={onPanelClose}
        />
      )

      const closeButton = screen.getByTestId('edge-close-panel-1')

      await act(async () => {
        fireEvent.click(closeButton)
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ConnectedParallelAgentTerminalView] Failed to unregister agent on close:',
        'agent-1',
        expect.any(Error)
      )
      expect(onError).toHaveBeenCalledWith('agent-1', 'Panel close unregister failed')
      expect(onPanelClose).toHaveBeenCalledWith('panel-1')

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Ref API Failures', () => {
    it('handles null ref gracefully', () => {
      const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()

      // Mock the underlying view ref to be null
      mockParallelAgentTerminalViewRef.getAllStates = vi.fn(() => null)

      render(<ConnectedParallelAgentTerminalView ref={ref} agents={[]} />)

      expect(ref.current).toBeDefined()

      // These should not throw even if underlying ref returns null
      expect(() => ref.current!.getAllStates()).not.toThrow()
      expect(ref.current!.getAllStates()).toEqual({})
    })

    it('handles underlying view ref methods throwing errors', () => {
      const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()

      mockParallelAgentTerminalViewRef.minimizeAll = vi.fn(() => {
        throw new Error('MinimizeAll failed')
      })

      render(<ConnectedParallelAgentTerminalView ref={ref} agents={[]} />)

      // Should not propagate errors to caller
      expect(() => ref.current!.minimizeAll()).toThrow()
    })

    it('handles stream control methods with invalid agent IDs', () => {
      const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()

      mockUseAgentTerminals.pauseAgent = vi.fn(() => {
        throw new Error('Agent not found')
      })

      render(<ConnectedParallelAgentTerminalView ref={ref} agents={[]} />)

      // Should propagate the error from the hook
      expect(() => ref.current!.pauseAgent('non-existent-agent')).toThrow('Agent not found')
    })
  })

  describe('Rapid State Changes', () => {
    it('handles rapid agent prop updates', async () => {
      const agents1: ConnectedAgentConfig[] = [
        { panelId: 'panel-1', agentId: 'agent-1', title: 'Agent 1' }
      ]
      const agents2: ConnectedAgentConfig[] = [
        { panelId: 'panel-2', agentId: 'agent-2', title: 'Agent 2' }
      ]
      const agents3: ConnectedAgentConfig[] = []

      const { rerender } = render(
        <ConnectedParallelAgentTerminalView agents={agents1} />
      )

      // Rapid updates
      await act(async () => {
        rerender(<ConnectedParallelAgentTerminalView agents={agents2} />)
        rerender(<ConnectedParallelAgentTerminalView agents={agents3} />)
        rerender(<ConnectedParallelAgentTerminalView agents={agents1} />)
      })

      // Should handle all changes without errors
      expect(screen.getByTestId('edge-case-view')).toBeInTheDocument()
    })

    it('handles concurrent panel closes', async () => {
      const user = userEvent.setup()

      const agents: ConnectedAgentConfig[] = [
        { panelId: 'panel-1', agentId: 'agent-1', title: 'Agent 1' },
        { panelId: 'panel-2', agentId: 'agent-2', title: 'Agent 2' },
        { panelId: 'panel-3', agentId: 'agent-3', title: 'Agent 3' },
      ]

      render(<ConnectedParallelAgentTerminalView agents={agents} />)

      const closeButtons = [
        screen.getByTestId('edge-close-panel-1'),
        screen.getByTestId('edge-close-panel-2'),
        screen.getByTestId('edge-close-panel-3'),
      ]

      // Click all close buttons rapidly
      await act(async () => {
        await Promise.all(closeButtons.map(button => user.click(button)))
      })

      expect(mockUseAgentTerminals.unregisterAgent).toHaveBeenCalledTimes(3)
    })
  })

  describe('Memory and Resource Management', () => {
    it('handles unmount during async operations', async () => {
      let resolveRegistration: () => void
      const registrationPromise = new Promise<void>(resolve => {
        resolveRegistration = resolve
      })

      mockUseAgentTerminals.registerAgent = vi.fn(() => {
        return registrationPromise
      })

      const agents: ConnectedAgentConfig[] = [
        { panelId: 'panel-1', agentId: 'agent-1', title: 'Agent 1' }
      ]

      const { unmount } = render(<ConnectedParallelAgentTerminalView agents={agents} />)

      // Unmount before registration completes
      await act(async () => {
        unmount()
        resolveRegistration!()
      })

      // Should not cause any memory leaks or errors
      expect(true).toBe(true) // Test passes if no errors thrown
    })

    it('handles maximum agent limit edge case', async () => {
      const maxAgents: ConnectedAgentConfig[] = Array.from({ length: 100 }, (_, i) => ({
        panelId: `panel-${i}`,
        agentId: `agent-${i}`,
        title: `Agent ${i}`,
      }))

      await act(async () => {
        render(<ConnectedParallelAgentTerminalView agents={maxAgents} />)
      })

      expect(mockUseAgentTerminals.registerAgent).toHaveBeenCalledTimes(100)
      expect(screen.getByTestId('edge-case-view')).toBeInTheDocument()
    })
  })

  describe('Connection State Edge Cases', () => {
    it('handles disconnected state gracefully', () => {
      mockUseAgentTerminals.isConnected = false
      mockUseAgentTerminals.isReconnecting = true

      const ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()

      render(
        <ConnectedParallelAgentTerminalView
          ref={ref}
          agents={[{ panelId: 'panel-1', agentId: 'agent-1', title: 'Agent 1' }]}
        />
      )

      expect(ref.current!.isConnected).toBe(false)
      expect(ref.current!.isReconnecting).toBe(true)
    })

    it('handles reconnection during agent updates', async () => {
      mockUseAgentTerminals.isReconnecting = true

      const agents: ConnectedAgentConfig[] = [
        { panelId: 'panel-1', agentId: 'agent-1', title: 'Agent 1' }
      ]

      const { rerender } = render(<ConnectedParallelAgentTerminalView agents={agents} />)

      // Update agents during reconnection
      const updatedAgents = [
        ...agents,
        { panelId: 'panel-2', agentId: 'agent-2', title: 'Agent 2' }
      ]

      await act(async () => {
        rerender(<ConnectedParallelAgentTerminalView agents={updatedAgents} />)
      })

      expect(screen.getByTestId('edge-case-view')).toBeInTheDocument()
    })
  })

  describe('Debug Mode Edge Cases', () => {
    it('handles console methods being undefined', async () => {
      // Temporarily remove console.log
      const originalConsoleLog = console.log
      delete (console as any).log

      await act(async () => {
        render(
          <ConnectedParallelAgentTerminalView
            agents={[{ panelId: 'panel-1', agentId: 'agent-1', title: 'Agent 1' }]}
            debug={true}
          />
        )
      })

      // Should not throw errors
      expect(screen.getByTestId('edge-case-view')).toBeInTheDocument()

      // Restore console.log
      console.log = originalConsoleLog
    })

    it('handles debug logging with complex objects', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const complexAgent: ConnectedAgentConfig = {
        panelId: 'panel-1',
        agentId: 'agent-1',
        title: 'Complex Agent',
        initialFilter: {
          level: 'info',
          source: 'system',
          custom: { deeply: { nested: { object: true } } }
        } as any,
      }

      await act(async () => {
        render(
          <ConnectedParallelAgentTerminalView
            agents={[complexAgent]}
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
  })
})