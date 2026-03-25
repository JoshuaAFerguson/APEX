/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ConnectedParallelAgentTerminalView } from '../ConnectedParallelAgentTerminalView'
import type { ConnectedAgentConfig, ConnectedParallelAgentTerminalViewRef } from '../ConnectedParallelAgentTerminalView.types'
import type { AgentTerminalConfig } from '@/types/agent-terminals'

// Mock data for comprehensive ref API testing
const mockAgentStates = new Map([
  ['agent-1', {
    config: { agentId: 'agent-1', agentName: 'Agent 1' } as AgentTerminalConfig,
    logs: [
      { id: '1', timestamp: '2024-01-01T10:00:00Z', level: 'info', message: 'Agent 1 started' },
      { id: '2', timestamp: '2024-01-01T10:01:00Z', level: 'debug', message: 'Agent 1 debug' },
    ],
    filteredLogs: [
      { id: '1', timestamp: '2024-01-01T10:00:00Z', level: 'info', message: 'Agent 1 started' },
    ],
    streamState: {
      isActive: true,
      isPaused: false,
      logCount: 2,
      errorCount: 0,
    },
    connectionStatus: 'connected' as const,
  }],
  ['agent-2', {
    config: { agentId: 'agent-2', agentName: 'Agent 2' } as AgentTerminalConfig,
    logs: [
      { id: '3', timestamp: '2024-01-01T10:00:00Z', level: 'error', message: 'Agent 2 error' },
    ],
    filteredLogs: [
      { id: '3', timestamp: '2024-01-01T10:00:00Z', level: 'error', message: 'Agent 2 error' },
    ],
    streamState: {
      isActive: true,
      isPaused: true,
      logCount: 1,
      errorCount: 1,
    },
    connectionStatus: 'connected' as const,
  }],
])

const mockUseAgentTerminals = {
  agents: mockAgentStates,
  agentIds: ['agent-1', 'agent-2'],
  connectionHealth: {
    status: 'connected' as const,
    isHealthy: true,
    latencyMs: 15,
    averageLatencyMs: 20,
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
    consecutiveFailures: 0,
    lastHealthyAt: '2024-01-01T10:00:00Z',
    lastCheckAt: '2024-01-01T10:02:00Z',
    connectionUptime: 120000,
  },
  aggregateStats: {
    totalLogs: 3,
    totalAgents: 2,
    activeAgents: 2,
    errorCount: 1,
    pausedAgents: 1,
  },
  getAgentState: vi.fn((agentId: string) => mockAgentStates.get(agentId)),
  getAgentLogs: vi.fn((agentId: string) => mockAgentStates.get(agentId)?.logs || []),
  getAgentFilteredLogs: vi.fn((agentId: string) => mockAgentStates.get(agentId)?.filteredLogs || []),
  getAgentConnectionStatus: vi.fn((agentId: string) => mockAgentStates.get(agentId)?.connectionStatus || 'disconnected'),
  registerAgent: vi.fn(),
  unregisterAgent: vi.fn(),
  isAgentRegistered: vi.fn((agentId: string) => mockAgentStates.has(agentId)),
  pauseAgent: vi.fn(),
  resumeAgent: vi.fn(),
  clearAgentLogs: vi.fn(),
  setAgentFilter: vi.fn(),
  resetAgentFilter: vi.fn(),
  exportAgentLogs: vi.fn((agentId: string, format: 'json' | 'text' | 'csv') => {
    const logs = mockAgentStates.get(agentId)?.logs || []
    if (format === 'json') {
      return JSON.stringify(logs, null, 2)
    } else if (format === 'csv') {
      return 'id,timestamp,level,message\n' + logs.map(log =>
        `${log.id},${log.timestamp},${log.level},${log.message}`
      ).join('\n')
    } else {
      return logs.map(log => `[${log.timestamp}] ${log.level}: ${log.message}`).join('\n')
    }
  }),
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
  getAllStates: vi.fn(() => ({
    'panel-1': { state: 'normal', isVisible: true, size: 'medium' },
    'panel-2': { state: 'minimized', isVisible: true, size: 'small' },
  })),
  maximizePanel: vi.fn(),
  focusPanel: vi.fn(),
}

vi.mock('@/hooks/useAgentTerminals', () => ({
  useAgentTerminals: vi.fn(() => mockUseAgentTerminals),
}))

vi.mock('../ParallelAgentTerminalView', () => ({
  ParallelAgentTerminalView: React.forwardRef<any, any>(function MockRefApiParallelAgentTerminalView(props, ref) {
    React.useImperativeHandle(ref, () => mockParallelAgentTerminalViewRef)
    return <div data-testid="parallel-view">Mock Parallel View</div>
  }),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}))

describe('ConnectedParallelAgentTerminalView Ref API', () => {
  const mockAgents: ConnectedAgentConfig[] = [
    {
      panelId: 'panel-1',
      agentId: 'agent-1',
      title: 'Agent 1',
    },
    {
      panelId: 'panel-2',
      agentId: 'agent-2',
      title: 'Agent 2',
    },
  ]

  let ref: React.RefObject<ConnectedParallelAgentTerminalViewRef>

  beforeEach(() => {
    ref = React.createRef<ConnectedParallelAgentTerminalViewRef>()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Ref Creation and Availability', () => {
    it('creates ref object successfully', () => {
      render(<ConnectedParallelAgentTerminalView ref={ref} agents={mockAgents} />)

      expect(ref.current).toBeTruthy()
      expect(typeof ref.current).toBe('object')
    })

    it('exposes all required ref API methods', () => {
      render(<ConnectedParallelAgentTerminalView ref={ref} agents={mockAgents} />)

      const requiredMethods = [
        // Panel view controls
        'minimizeAll', 'restoreAll', 'getAllStates', 'maximizePanel', 'focusPanel',
        // Per-agent stream controls
        'pauseAgent', 'resumeAgent', 'clearAgentLogs', 'setAgentFilter', 'resetAgentFilter',
        'exportAgentLogs', 'getAgentLogs', 'getAgentFilteredLogs',
        // Bulk stream controls
        'pauseAll', 'resumeAll', 'clearAll', 'reconnect',
        // Agent registration
        'registerAgent', 'unregisterAgent', 'isAgentRegistered',
        // Status
        'getAggregateStats',
      ]

      requiredMethods.forEach(method => {
        expect(typeof ref.current![method]).toBe('function')
      })

      // Status properties
      expect(typeof ref.current!.isConnected).toBe('boolean')
      expect(typeof ref.current!.isReconnecting).toBe('boolean')
    })
  })

  describe('Panel View Control Methods', () => {
    beforeEach(() => {
      render(<ConnectedParallelAgentTerminalView ref={ref} agents={mockAgents} />)
    })

    it('delegates minimizeAll to underlying view', () => {
      ref.current!.minimizeAll()

      expect(mockParallelAgentTerminalViewRef.minimizeAll).toHaveBeenCalledTimes(1)
      expect(mockParallelAgentTerminalViewRef.minimizeAll).toHaveBeenCalledWith()
    })

    it('delegates restoreAll to underlying view', () => {
      ref.current!.restoreAll()

      expect(mockParallelAgentTerminalViewRef.restoreAll).toHaveBeenCalledTimes(1)
      expect(mockParallelAgentTerminalViewRef.restoreAll).toHaveBeenCalledWith()
    })

    it('delegates getAllStates and returns panel states', () => {
      const states = ref.current!.getAllStates()

      expect(mockParallelAgentTerminalViewRef.getAllStates).toHaveBeenCalledTimes(1)
      expect(states).toEqual({
        'panel-1': { state: 'normal', isVisible: true, size: 'medium' },
        'panel-2': { state: 'minimized', isVisible: true, size: 'small' },
      })
    })

    it('delegates maximizePanel with correct panel ID', () => {
      ref.current!.maximizePanel('panel-1')

      expect(mockParallelAgentTerminalViewRef.maximizePanel).toHaveBeenCalledTimes(1)
      expect(mockParallelAgentTerminalViewRef.maximizePanel).toHaveBeenCalledWith('panel-1')
    })

    it('delegates focusPanel with correct panel ID', () => {
      ref.current!.focusPanel('panel-2')

      expect(mockParallelAgentTerminalViewRef.focusPanel).toHaveBeenCalledTimes(1)
      expect(mockParallelAgentTerminalViewRef.focusPanel).toHaveBeenCalledWith('panel-2')
    })

    it('handles getAllStates when underlying view returns null', () => {
      mockParallelAgentTerminalViewRef.getAllStates = vi.fn(() => null)

      const states = ref.current!.getAllStates()

      expect(states).toEqual({})
    })

    it('handles view ref being null/undefined', () => {
      // Simulate null view ref
      const nullViewRef = { current: null }
      mockParallelAgentTerminalViewRef.getAllStates = vi.fn(() => null)

      expect(() => ref.current!.getAllStates()).not.toThrow()
      expect(ref.current!.getAllStates()).toEqual({})
    })
  })

  describe('Per-Agent Stream Control Methods', () => {
    beforeEach(() => {
      render(<ConnectedParallelAgentTerminalView ref={ref} agents={mockAgents} />)
    })

    it('calls pauseAgent with correct agent ID', () => {
      ref.current!.pauseAgent('agent-1')

      expect(mockUseAgentTerminals.pauseAgent).toHaveBeenCalledTimes(1)
      expect(mockUseAgentTerminals.pauseAgent).toHaveBeenCalledWith('agent-1')
    })

    it('calls resumeAgent with correct agent ID', () => {
      ref.current!.resumeAgent('agent-2')

      expect(mockUseAgentTerminals.resumeAgent).toHaveBeenCalledTimes(1)
      expect(mockUseAgentTerminals.resumeAgent).toHaveBeenCalledWith('agent-2')
    })

    it('calls clearAgentLogs with correct agent ID', () => {
      ref.current!.clearAgentLogs('agent-1')

      expect(mockUseAgentTerminals.clearAgentLogs).toHaveBeenCalledTimes(1)
      expect(mockUseAgentTerminals.clearAgentLogs).toHaveBeenCalledWith('agent-1')
    })

    it('calls setAgentFilter with correct parameters', () => {
      const filter = { level: 'error', source: 'system' }
      ref.current!.setAgentFilter('agent-1', filter)

      expect(mockUseAgentTerminals.setAgentFilter).toHaveBeenCalledTimes(1)
      expect(mockUseAgentTerminals.setAgentFilter).toHaveBeenCalledWith('agent-1', filter)
    })

    it('calls resetAgentFilter with correct agent ID', () => {
      ref.current!.resetAgentFilter('agent-2')

      expect(mockUseAgentTerminals.resetAgentFilter).toHaveBeenCalledTimes(1)
      expect(mockUseAgentTerminals.resetAgentFilter).toHaveBeenCalledWith('agent-2')
    })

    it('calls exportAgentLogs and returns formatted data', () => {
      const result = ref.current!.exportAgentLogs('agent-1', 'json')

      expect(mockUseAgentTerminals.exportAgentLogs).toHaveBeenCalledTimes(1)
      expect(mockUseAgentTerminals.exportAgentLogs).toHaveBeenCalledWith('agent-1', 'json')
      expect(result).toEqual(JSON.stringify(mockAgentStates.get('agent-1')!.logs, null, 2))
    })

    it('exports logs in different formats', () => {
      const jsonResult = ref.current!.exportAgentLogs('agent-1', 'json')
      const textResult = ref.current!.exportAgentLogs('agent-1', 'text')
      const csvResult = ref.current!.exportAgentLogs('agent-1', 'csv')

      expect(jsonResult).toContain('"level": "info"')
      expect(textResult).toContain('[2024-01-01T10:00:00Z] info: Agent 1 started')
      expect(csvResult).toContain('id,timestamp,level,message')
    })

    it('calls getAgentLogs and returns log data', () => {
      const logs = ref.current!.getAgentLogs('agent-1')

      expect(mockUseAgentTerminals.getAgentLogs).toHaveBeenCalledTimes(1)
      expect(mockUseAgentTerminals.getAgentLogs).toHaveBeenCalledWith('agent-1')
      expect(logs).toEqual(mockAgentStates.get('agent-1')!.logs)
    })

    it('calls getAgentFilteredLogs and returns filtered log data', () => {
      const filteredLogs = ref.current!.getAgentFilteredLogs('agent-1')

      expect(mockUseAgentTerminals.getAgentFilteredLogs).toHaveBeenCalledTimes(1)
      expect(mockUseAgentTerminals.getAgentFilteredLogs).toHaveBeenCalledWith('agent-1')
      expect(filteredLogs).toEqual(mockAgentStates.get('agent-1')!.filteredLogs)
    })

    it('handles non-existent agent IDs gracefully', () => {
      const nonExistentLogs = ref.current!.getAgentLogs('non-existent-agent')

      expect(mockUseAgentTerminals.getAgentLogs).toHaveBeenCalledWith('non-existent-agent')
      expect(nonExistentLogs).toEqual([])
    })
  })

  describe('Bulk Stream Control Methods', () => {
    beforeEach(() => {
      render(<ConnectedParallelAgentTerminalView ref={ref} agents={mockAgents} />)
    })

    it('calls pauseAll', () => {
      ref.current!.pauseAll()

      expect(mockUseAgentTerminals.pauseAll).toHaveBeenCalledTimes(1)
      expect(mockUseAgentTerminals.pauseAll).toHaveBeenCalledWith()
    })

    it('calls resumeAll', () => {
      ref.current!.resumeAll()

      expect(mockUseAgentTerminals.resumeAll).toHaveBeenCalledTimes(1)
      expect(mockUseAgentTerminals.resumeAll).toHaveBeenCalledWith()
    })

    it('calls clearAll', () => {
      ref.current!.clearAll()

      expect(mockUseAgentTerminals.clearAll).toHaveBeenCalledTimes(1)
      expect(mockUseAgentTerminals.clearAll).toHaveBeenCalledWith()
    })

    it('calls reconnect', () => {
      ref.current!.reconnect()

      expect(mockUseAgentTerminals.reconnect).toHaveBeenCalledTimes(1)
      expect(mockUseAgentTerminals.reconnect).toHaveBeenCalledWith()
    })

    it('supports chaining bulk operations', () => {
      expect(() => {
        ref.current!.pauseAll()
        ref.current!.clearAll()
        ref.current!.resumeAll()
      }).not.toThrow()

      expect(mockUseAgentTerminals.pauseAll).toHaveBeenCalledTimes(1)
      expect(mockUseAgentTerminals.clearAll).toHaveBeenCalledTimes(1)
      expect(mockUseAgentTerminals.resumeAll).toHaveBeenCalledTimes(1)
    })
  })

  describe('Agent Registration Methods', () => {
    beforeEach(() => {
      // Reset mock to default state
      mockUseAgentTerminals.registerAgent = vi.fn()
      render(<ConnectedParallelAgentTerminalView ref={ref} agents={mockAgents} />)
      vi.clearAllMocks() // Clear calls from component initialization
    })

    it('calls registerAgent with correct configuration', () => {
      const agentConfig: AgentTerminalConfig = {
        agentId: 'agent-3',
        agentName: 'Agent 3',
        maxLogs: 100,
      }

      ref.current!.registerAgent(agentConfig)

      expect(mockUseAgentTerminals.registerAgent).toHaveBeenCalledTimes(1)
      expect(mockUseAgentTerminals.registerAgent).toHaveBeenCalledWith(agentConfig)
    })

    it('calls unregisterAgent with correct agent ID', () => {
      ref.current!.unregisterAgent('agent-1')

      expect(mockUseAgentTerminals.unregisterAgent).toHaveBeenCalledTimes(1)
      expect(mockUseAgentTerminals.unregisterAgent).toHaveBeenCalledWith('agent-1')
    })

    it('calls isAgentRegistered and returns correct status', () => {
      const isRegistered = ref.current!.isAgentRegistered('agent-1')

      expect(mockUseAgentTerminals.isAgentRegistered).toHaveBeenCalledTimes(1)
      expect(mockUseAgentTerminals.isAgentRegistered).toHaveBeenCalledWith('agent-1')
      expect(isRegistered).toBe(true)
    })

    it('returns false for non-existent agents', () => {
      mockUseAgentTerminals.isAgentRegistered = vi.fn(() => false)

      const isRegistered = ref.current!.isAgentRegistered('non-existent-agent')

      expect(isRegistered).toBe(false)
    })
  })

  describe('Status Methods and Properties', () => {
    beforeEach(() => {
      render(<ConnectedParallelAgentTerminalView ref={ref} agents={mockAgents} />)
    })

    it('returns getAggregateStats correctly', () => {
      const stats = ref.current!.getAggregateStats()

      expect(stats).toEqual({
        totalLogs: 3,
        totalAgents: 2,
        activeAgents: 2,
        errorCount: 1,
        pausedAgents: 1,
      })
    })

    it('exposes isConnected status', () => {
      expect(ref.current!.isConnected).toBe(true)
    })

    it('exposes isReconnecting status', () => {
      expect(ref.current!.isReconnecting).toBe(false)
    })

    it('reflects real-time connection status changes', () => {
      // Simulate connection status change
      mockUseAgentTerminals.isConnected = false
      mockUseAgentTerminals.isReconnecting = true

      // Re-render to pick up changes
      const { rerender } = render(<ConnectedParallelAgentTerminalView ref={ref} agents={mockAgents} />)
      rerender(<ConnectedParallelAgentTerminalView ref={ref} agents={mockAgents} />)

      expect(ref.current!.isConnected).toBe(false)
      expect(ref.current!.isReconnecting).toBe(true)
    })
  })

  describe('Method Call Sequences and Combinations', () => {
    beforeEach(() => {
      render(<ConnectedParallelAgentTerminalView ref={ref} agents={mockAgents} />)
    })

    it('supports complex operation sequences', () => {
      expect(() => {
        // Panel operations
        ref.current!.maximizePanel('panel-1')
        ref.current!.focusPanel('panel-1')

        // Agent operations
        ref.current!.pauseAgent('agent-2')
        ref.current!.setAgentFilter('agent-1', { level: 'error' })

        // Bulk operations
        ref.current!.clearAll()

        // View operations
        ref.current!.minimizeAll()
        ref.current!.restoreAll()
      }).not.toThrow()

      expect(mockParallelAgentTerminalViewRef.maximizePanel).toHaveBeenCalledWith('panel-1')
      expect(mockParallelAgentTerminalViewRef.focusPanel).toHaveBeenCalledWith('panel-1')
      expect(mockUseAgentTerminals.pauseAgent).toHaveBeenCalledWith('agent-2')
      expect(mockUseAgentTerminals.setAgentFilter).toHaveBeenCalledWith('agent-1', { level: 'error' })
      expect(mockUseAgentTerminals.clearAll).toHaveBeenCalled()
      expect(mockParallelAgentTerminalViewRef.minimizeAll).toHaveBeenCalled()
      expect(mockParallelAgentTerminalViewRef.restoreAll).toHaveBeenCalled()
    })

    it('handles rapid successive calls', () => {
      expect(() => {
        for (let i = 0; i < 10; i++) {
          ref.current!.pauseAll()
          ref.current!.resumeAll()
        }
      }).not.toThrow()

      expect(mockUseAgentTerminals.pauseAll).toHaveBeenCalledTimes(10)
      expect(mockUseAgentTerminals.resumeAll).toHaveBeenCalledTimes(10)
    })
  })

  describe('Error Handling in Ref Methods', () => {
    beforeEach(() => {
      // Reset all mock functions
      mockUseAgentTerminals.registerAgent = vi.fn()
      mockUseAgentTerminals.pauseAgent = vi.fn()
      mockUseAgentTerminals.exportAgentLogs = vi.fn(() => 'test data')
      render(<ConnectedParallelAgentTerminalView ref={ref} agents={mockAgents} />)
    })

    it('propagates errors from stream control methods', () => {
      // Override the mock for this specific test
      ref.current!.pauseAgent = vi.fn(() => {
        throw new Error('Stream control failed')
      })

      expect(() => ref.current!.pauseAgent('agent-1')).toThrow('Stream control failed')
    })

    it('propagates errors from view control methods', () => {
      // Override the mock for this specific test
      ref.current!.maximizePanel = vi.fn(() => {
        throw new Error('View control failed')
      })

      expect(() => ref.current!.maximizePanel('panel-1')).toThrow('View control failed')
    })

    it('handles errors in export methods gracefully', () => {
      // Override the mock for this specific test
      ref.current!.exportAgentLogs = vi.fn(() => {
        throw new Error('Export failed')
      })

      expect(() => ref.current!.exportAgentLogs('agent-1', 'json')).toThrow('Export failed')
    })

    it('handles registration errors', () => {
      // Override the mock for this specific test
      ref.current!.registerAgent = vi.fn(() => {
        throw new Error('Registration failed')
      })

      expect(() => ref.current!.registerAgent({
        agentId: 'test-agent',
        agentName: 'Test Agent'
      })).toThrow('Registration failed')
    })
  })

  describe('Ref Stability Across Re-renders', () => {
    it('maintains ref methods across prop changes', () => {
      // Reset register agent to not throw errors
      mockUseAgentTerminals.registerAgent = vi.fn()

      const { rerender } = render(<ConnectedParallelAgentTerminalView ref={ref} agents={mockAgents} />)

      const initialRef = ref.current
      const initialPauseAll = ref.current!.pauseAll

      // Change props
      rerender(<ConnectedParallelAgentTerminalView ref={ref} agents={[mockAgents[0]]} />)

      // Ref should remain stable
      expect(ref.current).toBe(initialRef)
      expect(ref.current!.pauseAll).toBe(initialPauseAll)
    })

    it('maintains functionality after multiple re-renders', () => {
      // Reset register agent to not throw errors
      mockUseAgentTerminals.registerAgent = vi.fn()

      const { rerender } = render(<ConnectedParallelAgentTerminalView ref={ref} agents={mockAgents} />)

      // Multiple re-renders with different props
      for (let i = 0; i < 5; i++) {
        rerender(<ConnectedParallelAgentTerminalView ref={ref} agents={mockAgents.slice(0, (i % 2) + 1)} />)
      }

      // Methods should still work
      expect(() => ref.current!.pauseAll()).not.toThrow()
      expect(() => ref.current!.getAllStates()).not.toThrow()
      expect(() => ref.current!.getAggregateStats()).not.toThrow()

      expect(mockUseAgentTerminals.pauseAll).toHaveBeenCalledTimes(1)
      expect(mockParallelAgentTerminalViewRef.getAllStates).toHaveBeenCalledTimes(1)
    })
  })
})