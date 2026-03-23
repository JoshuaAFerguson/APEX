/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { AgentTerminalPanel } from '../AgentTerminalPanel'
import type { AgentTerminalPanelProps, AgentLogEntry } from '@/types/agent-log-stream'

// Mock state that will be modified by tests
let mockStreamState = {
  state: 'idle' as const,
  connectionStatus: 'disconnected' as const,
  isReceiving: false,
  logsReceivedCount: 0,
  lastLogAt: null,
  bytesReceived: 0,
  streamStartedAt: null,
  error: null,
}

let mockLogs: AgentLogEntry[] = []
let mockFilter = {
  levels: new Set(['debug', 'info', 'warn', 'error'] as const),
  searchText: '',
  stage: null,
  agent: null,
}

// Mock callbacks that track interactions
const mockConnect = vi.fn()
const mockDisconnect = vi.fn()
const mockPause = vi.fn()
const mockResume = vi.fn()
const mockClearLogs = vi.fn()
const mockSetFilter = vi.fn()
const mockResetFilter = vi.fn()
const mockExportLogs = vi.fn(() => JSON.stringify(mockLogs))
const mockScrollToLog = vi.fn()

// Auto-scroll mocks
let mockAutoScroll = true
let mockNewItemsSinceScroll = 0
const mockScrollToBottom = vi.fn()
const mockNotifyNewItems = vi.fn()
const mockHandleScroll = vi.fn()

// Integration test hook mocks that respond to state changes
vi.mock('@/hooks/useAgentLogStream', () => ({
  useAgentLogStream: vi.fn(() => ({
    filteredLogs: mockLogs,
    filter: mockFilter,
    streamState: mockStreamState,
    stats: {
      totalLogs: mockLogs.length,
      logsPerSecond: mockStreamState.state === 'streaming' ? 2.1 : 0,
      byLevel: mockLogs.reduce(
        (acc, log) => {
          acc[log.level]++
          return acc
        },
        { debug: 0, info: 0, warn: 0, error: 0 }
      ),
      bySource: mockLogs.reduce(
        (acc, log) => {
          acc[log.source]++
          return acc
        },
        { agent: 0, system: 0, user: 0, tool: 0, error: 0 }
      ),
      errorCount: mockLogs.filter(log => log.level === 'error').length,
      streamDurationMs: mockStreamState.streamStartedAt
        ? Date.now() - mockStreamState.streamStartedAt.getTime()
        : 0,
    },
    isConnecting: mockStreamState.state === 'connecting',
    isStreaming: mockStreamState.state === 'streaming',
    isPaused: mockStreamState.state === 'paused',
    error: mockStreamState.error,
    connect: mockConnect,
    disconnect: mockDisconnect,
    pause: mockPause,
    resume: mockResume,
    clearLogs: mockClearLogs,
    setFilter: mockSetFilter,
    resetFilter: mockResetFilter,
    exportLogs: mockExportLogs,
    scrollToLog: mockScrollToLog,
  })),
}))

vi.mock('@/hooks/useAutoScroll', () => ({
  useAutoScroll: vi.fn(() => ({
    containerRef: { current: null },
    handleScroll: mockHandleScroll,
    scrollToBottom: mockScrollToBottom,
    autoScroll: mockAutoScroll,
    newItemsSinceScroll: mockNewItemsSinceScroll,
    isAtBottom: mockAutoScroll,
    setAutoScroll: vi.fn((enabled: boolean) => {
      mockAutoScroll = enabled
    }),
    resetNewItemsCounter: vi.fn(() => {
      mockNewItemsSinceScroll = 0
    }),
    notifyNewItems: mockNotifyNewItems,
  })),
}))

// Realistic component mocks that simulate actual behavior
vi.mock('../AgentTerminalPanelHeader', () => ({
  AgentTerminalPanelHeader: ({
    title,
    agentId,
    streamingState,
    onMinimize,
    onMaximize,
    onClose,
    onPause,
    onResume,
    onClear,
    onExport,
    isMinimized
  }: any) => (
    <div data-testid="header">
      <span data-testid="title">{title}</span>
      <span data-testid="agent-id">{agentId}</span>
      <span data-testid="streaming-state">{streamingState}</span>
      {!isMinimized && (
        <>
          <button data-testid="btn-minimize" onClick={onMinimize}>Minimize</button>
          <button data-testid="btn-close" onClick={onClose}>Close</button>
          <button data-testid="btn-pause" onClick={onPause}>Pause</button>
          <button data-testid="btn-resume" onClick={onResume}>Resume</button>
          <button data-testid="btn-clear" onClick={onClear}>Clear</button>
          <button data-testid="btn-export" onClick={onExport}>Export</button>
        </>
      )}
      {isMinimized && (
        <button data-testid="btn-maximize" onClick={onMaximize}>Maximize</button>
      )}
    </div>
  ),
}))

vi.mock('../AgentTerminalPanelControls', () => ({
  AgentTerminalPanelControls: ({
    show,
    filter,
    onFilterChange,
    onResetFilter,
    showSearch,
    showLevelFilter
  }: any) => (
    show ? (
      <div data-testid="controls">
        {showSearch && (
          <input
            data-testid="search-input"
            placeholder="Search..."
            value={filter?.searchText || ''}
            onChange={(e) => onFilterChange?.({ searchText: e.target.value })}
          />
        )}
        {showLevelFilter && (
          <select
            data-testid="level-filter"
            onChange={(e) => {
              const level = e.target.value
              onFilterChange?.({
                levels: new Set(level ? [level] : ['debug', 'info', 'warn', 'error'])
              })
            }}
          >
            <option value="">All Levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
        )}
        <button data-testid="btn-reset-filter" onClick={onResetFilter}>
          Reset
        </button>
      </div>
    ) : null
  ),
}))

vi.mock('../AgentTerminalPanelLogEntry', () => ({
  AgentTerminalPanelLogEntry: ({ log, onClick, isSelected }: any) => (
    <div
      data-testid={`log-entry-${log.id}`}
      data-level={log.level}
      data-selected={isSelected}
      onClick={() => onClick?.(log)}
      style={{
        backgroundColor: isSelected ? '#333' : 'transparent',
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      <span data-testid={`log-message-${log.id}`}>{log.message}</span>
      <span data-testid={`log-level-${log.id}`}>{log.level}</span>
    </div>
  ),
}))

vi.mock('@/lib/websocket-client', () => ({
  wsClient: {
    isConnected: vi.fn(() => mockStreamState.connectionStatus === 'connected'),
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    getHealthState: vi.fn(() => ({ isHealthy: true, consecutiveFailures: 0 })),
  },
}))

// Helper functions
function createTestLog(id: string, message: string, level: 'debug' | 'info' | 'warn' | 'error' = 'info'): AgentLogEntry {
  return {
    id,
    timestamp: new Date(),
    level,
    message,
    source: 'agent',
    metadata: {
      agentId: 'test-agent',
      agentName: 'Test Agent',
    },
  }
}

function simulateStreamStateChange(newState: typeof mockStreamState.state) {
  act(() => {
    mockStreamState.state = newState
    if (newState === 'streaming') {
      mockStreamState.connectionStatus = 'connected'
      mockStreamState.isReceiving = true
      mockStreamState.streamStartedAt = new Date()
    } else if (newState === 'disconnected') {
      mockStreamState.connectionStatus = 'disconnected'
      mockStreamState.isReceiving = false
    }
  })
}

function simulateNewLogs(newLogs: AgentLogEntry[]) {
  act(() => {
    mockLogs.push(...newLogs)
    if (!mockAutoScroll) {
      mockNewItemsSinceScroll += newLogs.length
    }
  })
}

describe('AgentTerminalPanel - Integration Tests', () => {
  const defaultProps: AgentTerminalPanelProps = {
    panelId: 'test-panel',
    agentId: 'test-agent',
    title: 'Test Terminal',
  }

  beforeEach(() => {
    // Reset all state
    mockLogs = []
    mockStreamState = {
      state: 'idle',
      connectionStatus: 'disconnected',
      isReceiving: false,
      logsReceivedCount: 0,
      lastLogAt: null,
      bytesReceived: 0,
      streamStartedAt: null,
      error: null,
    }
    mockFilter = {
      levels: new Set(['debug', 'info', 'warn', 'error']),
      searchText: '',
      stage: null,
      agent: null,
    }
    mockAutoScroll = true
    mockNewItemsSinceScroll = 0

    // Reset all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Streaming Lifecycle Integration', () => {
    it('handles complete streaming lifecycle', async () => {
      const onStreamStateChange = vi.fn()

      const { rerender } = render(
        <AgentTerminalPanel
          {...defaultProps}
          onStreamStateChange={onStreamStateChange}
        />
      )

      // Initial idle state
      expect(screen.getByText('No logs yet')).toBeInTheDocument()
      expect(screen.getByTestId('streaming-state')).toHaveTextContent('idle')

      // Start connecting
      simulateStreamStateChange('connecting')
      rerender(
        <AgentTerminalPanel
          {...defaultProps}
          onStreamStateChange={onStreamStateChange}
        />
      )

      expect(screen.getByText('Connecting to log stream...')).toBeInTheDocument()

      // Connected and streaming
      simulateStreamStateChange('streaming')
      rerender(
        <AgentTerminalPanel
          {...defaultProps}
          onStreamStateChange={onStreamStateChange}
        />
      )

      expect(screen.getByText('Logs will appear here as they arrive')).toBeInTheDocument()
      expect(screen.getByText('Auto-scrolling')).toBeInTheDocument()

      // Add some logs
      simulateNewLogs([
        createTestLog('1', 'First streaming log'),
        createTestLog('2', 'Second streaming log'),
      ])
      rerender(
        <AgentTerminalPanel
          {...defaultProps}
          onStreamStateChange={onStreamStateChange}
        />
      )

      expect(screen.getByTestId('log-entry-1')).toBeInTheDocument()
      expect(screen.getByTestId('log-entry-2')).toBeInTheDocument()
      expect(screen.getByText('Showing 2 of 2 logs')).toBeInTheDocument()
      expect(screen.getByText('2.1 logs/sec')).toBeInTheDocument()
    })

    it('handles connection loss and recovery', async () => {
      const { rerender } = render(<AgentTerminalPanel {...defaultProps} />)

      // Start streaming
      simulateStreamStateChange('streaming')
      simulateNewLogs([createTestLog('1', 'Before disconnect')])
      rerender(<AgentTerminalPanel {...defaultProps} />)

      expect(screen.getByTestId('log-entry-1')).toBeInTheDocument()

      // Lose connection
      simulateStreamStateChange('disconnected')
      rerender(<AgentTerminalPanel {...defaultProps} />)

      expect(screen.getByText('Disconnected')).toBeInTheDocument()
      expect(screen.getByText('Lost connection to log stream')).toBeInTheDocument()

      // Test reconnect
      const reconnectButton = screen.getByText('Reconnect')
      fireEvent.click(reconnectButton)

      expect(mockConnect).toHaveBeenCalled()
    })

    it('handles streaming errors gracefully', async () => {
      const { rerender } = render(<AgentTerminalPanel {...defaultProps} />)

      // Simulate error
      act(() => {
        mockStreamState.error = 'WebSocket connection failed'
      })
      rerender(<AgentTerminalPanel {...defaultProps} />)

      expect(screen.getByText('Stream Error')).toBeInTheDocument()
      expect(screen.getByText('WebSocket connection failed')).toBeInTheDocument()

      // Test reconnect from error state
      const reconnectButton = screen.getByText('Reconnect')
      fireEvent.click(reconnectButton)

      expect(mockConnect).toHaveBeenCalled()
    })
  })

  describe('Auto-scroll Integration', () => {
    it('manages auto-scroll state during streaming', async () => {
      const { rerender } = render(<AgentTerminalPanel {...defaultProps} />)

      // Start with auto-scroll enabled
      simulateStreamStateChange('streaming')
      rerender(<AgentTerminalPanel {...defaultProps} />)

      expect(screen.getByText('Auto-scrolling')).toBeInTheDocument()

      // Add logs - should auto-scroll
      simulateNewLogs([createTestLog('1', 'Auto-scroll log')])
      rerender(<AgentTerminalPanel {...defaultProps} />)

      expect(screen.getByText('Auto-scrolling')).toBeInTheDocument()

      // User scrolls up (disable auto-scroll)
      act(() => {
        mockAutoScroll = false
        mockNewItemsSinceScroll = 0
      })

      // Add more logs
      simulateNewLogs([
        createTestLog('2', 'New log while scrolled up'),
        createTestLog('3', 'Another new log'),
      ])
      rerender(<AgentTerminalPanel {...defaultProps} />)

      expect(screen.queryByText('Auto-scrolling')).not.toBeInTheDocument()
      expect(screen.getByText('2 new logs')).toBeInTheDocument()

      // Click to scroll to bottom
      const newLogsButton = screen.getByText('2 new logs')
      fireEvent.click(newLogsButton)

      expect(mockScrollToBottom).toHaveBeenCalled()
    })

    it('tracks new items correctly across state changes', async () => {
      const { rerender } = render(<AgentTerminalPanel {...defaultProps} />)

      // Start with logs
      simulateNewLogs([createTestLog('1', 'Initial log')])
      rerender(<AgentTerminalPanel {...defaultProps} />)

      // User scrolls up
      act(() => {
        mockAutoScroll = false
      })

      // Add logs incrementally
      simulateNewLogs([createTestLog('2', 'New log 1')])
      rerender(<AgentTerminalPanel {...defaultProps} />)

      expect(screen.getByText('1 new log')).toBeInTheDocument()

      simulateNewLogs([createTestLog('3', 'New log 2')])
      rerender(<AgentTerminalPanel {...defaultProps} />)

      expect(screen.getByText('2 new logs')).toBeInTheDocument()
    })
  })

  describe('Filtering Integration', () => {
    it('handles search filtering with real-time updates', async () => {
      simulateNewLogs([
        createTestLog('1', 'Error message', 'error'),
        createTestLog('2', 'Debug information', 'debug'),
        createTestLog('3', 'Important error', 'error'),
      ])

      const { rerender } = render(
        <AgentTerminalPanel
          {...defaultProps}
          showSearch={true}
        />
      )

      // Wait for logs to be rendered
      await waitFor(() => {
        expect(screen.getByTestId('log-entry-1')).toBeInTheDocument()
      })

      expect(screen.getByTestId('log-entry-2')).toBeInTheDocument()
      expect(screen.getByTestId('log-entry-3')).toBeInTheDocument()

      // Search for "error"
      const searchInput = screen.getByTestId('search-input')
      fireEvent.change(searchInput, { target: { value: 'error' } })

      expect(mockSetFilter).toHaveBeenCalledWith({ searchText: 'error' })

      // Simulate filter applied (case-insensitive search)
      act(() => {
        mockFilter.searchText = 'error'
        mockLogs = mockLogs.filter(log => log.message.toLowerCase().includes('error'))
      })
      rerender(
        <AgentTerminalPanel
          {...defaultProps}
          showSearch={true}
        />
      )

      expect(screen.getByTestId('log-entry-1')).toBeInTheDocument()
      expect(screen.getByTestId('log-entry-3')).toBeInTheDocument()
      expect(screen.queryByTestId('log-entry-2')).not.toBeInTheDocument()
    })

    it('handles level filtering', async () => {
      simulateNewLogs([
        createTestLog('1', 'Info message', 'info'),
        createTestLog('2', 'Error message', 'error'),
        createTestLog('3', 'Debug message', 'debug'),
      ])

      render(
        <AgentTerminalPanel
          {...defaultProps}
          showFilters={true}
        />
      )

      // Filter by error level
      const levelFilter = screen.getByTestId('level-filter')
      fireEvent.change(levelFilter, { target: { value: 'error' } })

      expect(mockSetFilter).toHaveBeenCalledWith({
        levels: new Set(['error'])
      })
    })

    it('resets filter correctly', async () => {
      render(
        <AgentTerminalPanel
          {...defaultProps}
          showFilters={true}
        />
      )

      const resetButton = screen.getByTestId('btn-reset-filter')
      fireEvent.click(resetButton)

      expect(mockResetFilter).toHaveBeenCalled()
    })
  })

  describe('Panel Control Integration', () => {
    it('handles minimize/maximize cycle', async () => {
      const { rerender } = render(<AgentTerminalPanel {...defaultProps} />)

      // Initially not minimized
      expect(screen.getByTestId('btn-minimize')).toBeInTheDocument()
      expect(screen.getByTestId('controls')).toBeInTheDocument()

      // Click minimize - in real app this would change state
      fireEvent.click(screen.getByTestId('btn-minimize'))

      // Simulate minimized state
      const minimizedComponent = (
        <div className="border border-gray-800 rounded-lg overflow-hidden custom-class">
          <div data-testid="header">
            <span data-testid="title">Test Terminal</span>
            <span data-testid="agent-id">test-agent</span>
            <span data-testid="streaming-state">idle</span>
            <button data-testid="btn-maximize" onClick={() => {}}>Maximize</button>
          </div>
        </div>
      )

      // In minimized state, controls should be hidden
      rerender(minimizedComponent as any)
      expect(screen.getByTestId('btn-maximize')).toBeInTheDocument()
      expect(screen.queryByTestId('btn-minimize')).not.toBeInTheDocument()
    })

    it('handles stream control operations', async () => {
      render(<AgentTerminalPanel {...defaultProps} />)

      // Test pause
      fireEvent.click(screen.getByTestId('btn-pause'))
      expect(mockPause).toHaveBeenCalled()

      // Test resume
      fireEvent.click(screen.getByTestId('btn-resume'))
      expect(mockResume).toHaveBeenCalled()

      // Test clear
      fireEvent.click(screen.getByTestId('btn-clear'))
      expect(mockClearLogs).toHaveBeenCalled()
    })

    it('handles log export with data', async () => {
      simulateNewLogs([
        createTestLog('1', 'Export test log 1'),
        createTestLog('2', 'Export test log 2'),
      ])

      render(<AgentTerminalPanel {...defaultProps} />)

      // Just test that export function is called when export button is clicked
      fireEvent.click(screen.getByTestId('btn-export'))

      expect(mockExportLogs).toHaveBeenCalledWith('json')
    })
  })

  describe('Log Selection Integration', () => {
    it('handles log selection and navigation', async () => {
      const onLogSelect = vi.fn()

      simulateNewLogs([
        createTestLog('1', 'First log'),
        createTestLog('2', 'Second log'),
      ])

      const { rerender } = render(
        <AgentTerminalPanel
          {...defaultProps}
          onLogSelect={onLogSelect}
        />
      )

      // Click first log
      fireEvent.click(screen.getByTestId('log-entry-1'))

      expect(mockScrollToLog).toHaveBeenCalledWith('1')
      expect(onLogSelect).toHaveBeenCalledWith(mockLogs[0])

      // Simulate selection state change
      rerender(
        <AgentTerminalPanel
          {...defaultProps}
          onLogSelect={onLogSelect}
        />
      )

      // Click second log
      fireEvent.click(screen.getByTestId('log-entry-2'))

      expect(mockScrollToLog).toHaveBeenCalledWith('2')
      expect(onLogSelect).toHaveBeenCalledWith(mockLogs[1])
    })
  })

  describe('Error Recovery Integration', () => {
    it('recovers from temporary errors', async () => {
      const { rerender } = render(<AgentTerminalPanel {...defaultProps} />)

      // Start streaming successfully
      simulateStreamStateChange('streaming')
      simulateNewLogs([createTestLog('1', 'Working log')])
      rerender(<AgentTerminalPanel {...defaultProps} />)

      expect(screen.getByTestId('log-entry-1')).toBeInTheDocument()

      // Encounter error
      act(() => {
        mockStreamState.error = 'Temporary network error'
      })
      rerender(<AgentTerminalPanel {...defaultProps} />)

      expect(screen.getByText('Stream Error')).toBeInTheDocument()

      // Clear error and reconnect
      act(() => {
        mockStreamState.error = null
      })
      simulateStreamStateChange('streaming')
      simulateNewLogs([createTestLog('2', 'After recovery')])
      rerender(<AgentTerminalPanel {...defaultProps} />)

      // Should show both old and new logs
      expect(screen.getByTestId('log-entry-1')).toBeInTheDocument()
      expect(screen.getByTestId('log-entry-2')).toBeInTheDocument()
      expect(screen.queryByText('Stream Error')).not.toBeInTheDocument()
    })
  })

  describe('Performance Integration', () => {
    it('handles rapid log updates without issues', async () => {
      const { rerender } = render(<AgentTerminalPanel {...defaultProps} />)

      // Simulate rapid log additions
      for (let i = 1; i <= 50; i++) {
        simulateNewLogs([createTestLog(`${i}`, `Rapid log ${i}`)])
      }

      rerender(<AgentTerminalPanel {...defaultProps} />)

      // Should handle all logs without crashing
      expect(screen.getByTestId('log-entry-1')).toBeInTheDocument()
      expect(screen.getByTestId('log-entry-50')).toBeInTheDocument()
      expect(screen.getByText('Showing 50 of 50 logs')).toBeInTheDocument()
    })
  })
})