/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { AgentTerminalPanel } from '../AgentTerminalPanel'
import type { AgentTerminalPanelProps, AgentLogEntry } from '@/types/agent-log-stream'

// Mock state for WebSocket testing
let mockLogs: AgentLogEntry[] = []
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
let mockIsConnecting = false
let mockIsStreaming = false
let mockError: string | null = null

// Mock connection functions
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

// Mock hooks for WebSocket testing
vi.mock('@/hooks/useAgentLogStream', () => ({
  useAgentLogStream: vi.fn(() => ({
    filteredLogs: mockLogs,
    filter: {
      levels: new Set(['debug', 'info', 'warn', 'error']),
      searchText: '',
      stage: null,
      agent: null,
    },
    streamState: mockStreamState,
    stats: {
      totalLogs: mockLogs.length,
      logsPerSecond: mockIsStreaming ? 2.5 : 0,
      byLevel: { debug: 0, info: mockLogs.length, warn: 0, error: 0 },
      bySource: { agent: mockLogs.length, system: 0, user: 0, tool: 0, error: 0 },
      errorCount: mockLogs.filter(log => log.level === 'error').length,
      streamDurationMs: 0,
    },
    isConnecting: mockIsConnecting,
    isStreaming: mockIsStreaming,
    isPaused: false,
    error: mockError,
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
    handleScroll: vi.fn(),
    scrollToBottom: mockScrollToBottom,
    autoScroll: mockAutoScroll,
    newItemsSinceScroll: mockNewItemsSinceScroll,
    isAtBottom: true,
    setAutoScroll: vi.fn(),
    resetNewItemsCounter: vi.fn(),
    notifyNewItems: mockNotifyNewItems,
  })),
}))

// Mock child components for focused testing
vi.mock('../AgentTerminalPanelHeader', () => ({
  AgentTerminalPanelHeader: ({
    title,
    streamingState,
    onPause,
    onResume,
    onClear,
    onClose
  }: any) => (
    <div data-testid="header">
      <span data-testid="title">{title}</span>
      <span data-testid="streaming-state">{streamingState}</span>
      <button data-testid="pause-btn" onClick={onPause}>Pause</button>
      <button data-testid="resume-btn" onClick={onResume}>Resume</button>
      <button data-testid="clear-btn" onClick={onClear}>Clear</button>
      <button data-testid="close-btn" onClick={onClose}>Close</button>
    </div>
  ),
}))

vi.mock('../AgentTerminalPanelControls', () => ({
  AgentTerminalPanelControls: ({ show }: any) => (
    show ? <div data-testid="controls">Controls</div> : null
  ),
}))

vi.mock('../AgentTerminalPanelLogEntry', () => ({
  AgentTerminalPanelLogEntry: ({ log }: any) => (
    <div data-testid={`log-entry-${log.id}`}>
      {log.message}
    </div>
  ),
}))

vi.mock('@/lib/websocket-client', () => ({
  wsClient: {
    isConnected: vi.fn(() => mockStreamState.connectionStatus === 'connected'),
    connect: mockConnect,
    disconnect: mockDisconnect,
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
    metadata: { agentId: 'test-agent' },
  }
}

function simulateConnectionState(state: string, connectionStatus: string, error?: string) {
  act(() => {
    mockStreamState.state = state as any
    mockStreamState.connectionStatus = connectionStatus as any
    mockStreamState.error = error || null
    mockIsConnecting = state === 'connecting'
    mockIsStreaming = state === 'streaming'
    mockError = error || null
  })
}

describe('AgentTerminalPanel - WebSocket Connection Integration', () => {
  const defaultProps: AgentTerminalPanelProps = {
    panelId: 'websocket-test-panel',
    agentId: 'websocket-test-agent',
    title: 'WebSocket Test Terminal',
  }

  beforeEach(() => {
    mockLogs = []
    simulateConnectionState('idle', 'disconnected')
    mockAutoScroll = true
    mockNewItemsSinceScroll = 0

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Connection State Display', () => {
    it('shows disconnected state with connect button', () => {
      render(<AgentTerminalPanel {...defaultProps} />)

      expect(screen.getByText('No logs yet')).toBeInTheDocument()
      expect(screen.getByText('Connect to start streaming logs')).toBeInTheDocument()
      expect(screen.getByText('Connect')).toBeInTheDocument()
    })

    it('shows connecting state with loading spinner', () => {
      simulateConnectionState('connecting', 'connecting')

      render(<AgentTerminalPanel {...defaultProps} />)

      expect(screen.getByText('Connecting to log stream...')).toBeInTheDocument()
      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })

    it('shows streaming state when connected', () => {
      simulateConnectionState('streaming', 'connected')
      mockLogs = [createTestLog('1', 'Streaming test message')]

      render(<AgentTerminalPanel {...defaultProps} />)

      expect(screen.getByTestId('streaming-state')).toHaveTextContent('streaming')
      expect(screen.getByTestId('log-entry-1')).toBeInTheDocument()
    })

    it('shows disconnected overlay when connection is lost', () => {
      simulateConnectionState('disconnected', 'disconnected')

      render(<AgentTerminalPanel {...defaultProps} />)

      expect(screen.getByText('Disconnected')).toBeInTheDocument()
      expect(screen.getByText('Lost connection to log stream')).toBeInTheDocument()
      expect(screen.getByText('Reconnect')).toBeInTheDocument()
    })

    it('shows error state with error message', () => {
      simulateConnectionState('error', 'error', 'WebSocket connection failed')

      render(<AgentTerminalPanel {...defaultProps} />)

      expect(screen.getByText('Stream Error')).toBeInTheDocument()
      expect(screen.getByText('WebSocket connection failed')).toBeInTheDocument()
      expect(screen.getByText('Reconnect')).toBeInTheDocument()
    })
  })

  describe('Connection Control Actions', () => {
    it('calls connect when connect button is clicked', () => {
      render(<AgentTerminalPanel {...defaultProps} />)

      const connectButton = screen.getByText('Connect')
      fireEvent.click(connectButton)

      expect(mockConnect).toHaveBeenCalled()
    })

    it('calls connect when reconnect button is clicked from disconnected state', () => {
      simulateConnectionState('disconnected', 'disconnected')

      render(<AgentTerminalPanel {...defaultProps} />)

      const reconnectButton = screen.getByText('Reconnect')
      fireEvent.click(reconnectButton)

      expect(mockConnect).toHaveBeenCalled()
    })

    it('calls connect when reconnect button is clicked from error state', () => {
      simulateConnectionState('error', 'error', 'Connection timeout')

      render(<AgentTerminalPanel {...defaultProps} />)

      const reconnectButton = screen.getByText('Reconnect')
      fireEvent.click(reconnectButton)

      expect(mockConnect).toHaveBeenCalled()
    })

    it('calls disconnect when close button is clicked', () => {
      render(<AgentTerminalPanel {...defaultProps} />)

      const closeButton = screen.getByTestId('close-btn')
      fireEvent.click(closeButton)

      expect(mockDisconnect).toHaveBeenCalled()
    })
  })

  describe('Real-time Log Streaming', () => {
    it('displays logs as they arrive during streaming', async () => {
      simulateConnectionState('streaming', 'connected')

      const { rerender } = render(<AgentTerminalPanel {...defaultProps} />)

      // Simulate new logs arriving
      mockLogs = [createTestLog('1', 'First real-time log')]
      rerender(<AgentTerminalPanel {...defaultProps} />)

      expect(screen.getByTestId('log-entry-1')).toBeInTheDocument()
      expect(screen.getByText('First real-time log')).toBeInTheDocument()

      // Add more logs
      mockLogs = [
        ...mockLogs,
        createTestLog('2', 'Second real-time log'),
        createTestLog('3', 'Third real-time log'),
      ]
      rerender(<AgentTerminalPanel {...defaultProps} />)

      expect(screen.getByTestId('log-entry-2')).toBeInTheDocument()
      expect(screen.getByTestId('log-entry-3')).toBeInTheDocument()
      expect(screen.getByText('Showing 3 of 3 logs')).toBeInTheDocument()
    })

    it('shows logs per second when streaming', () => {
      simulateConnectionState('streaming', 'connected')
      mockLogs = [createTestLog('1', 'Test log')]

      render(<AgentTerminalPanel {...defaultProps} />)

      expect(screen.getByText('2.5 logs/sec')).toBeInTheDocument()
    })

    it('handles rapid log updates without performance issues', async () => {
      simulateConnectionState('streaming', 'connected')

      const { rerender } = render(<AgentTerminalPanel {...defaultProps} />)

      // Simulate rapid log additions
      const startTime = performance.now()
      for (let i = 0; i < 50; i++) {
        mockLogs.push(createTestLog(`rapid-${i}`, `Rapid log ${i}`))
      }

      rerender(<AgentTerminalPanel {...defaultProps} />)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(100) // Should render quickly
      expect(screen.getByText('Showing 50 of 50 logs')).toBeInTheDocument()
    })
  })

  describe('Stream Control Integration', () => {
    it('pauses log processing when pause button is clicked', () => {
      simulateConnectionState('streaming', 'connected')

      render(<AgentTerminalPanel {...defaultProps} />)

      const pauseButton = screen.getByTestId('pause-btn')
      fireEvent.click(pauseButton)

      expect(mockPause).toHaveBeenCalled()
    })

    it('resumes log processing when resume button is clicked', () => {
      render(<AgentTerminalPanel {...defaultProps} />)

      const resumeButton = screen.getByTestId('resume-btn')
      fireEvent.click(resumeButton)

      expect(mockResume).toHaveBeenCalled()
    })

    it('clears logs when clear button is clicked', () => {
      mockLogs = [createTestLog('1', 'Log to be cleared')]

      render(<AgentTerminalPanel {...defaultProps} />)

      const clearButton = screen.getByTestId('clear-btn')
      fireEvent.click(clearButton)

      expect(mockClearLogs).toHaveBeenCalled()
    })
  })

  describe('Connection Status Indicators', () => {
    it('shows auto-scrolling indicator when connected and streaming', () => {
      simulateConnectionState('streaming', 'connected')
      mockAutoScroll = true

      render(<AgentTerminalPanel {...defaultProps} />)

      expect(screen.getByText('Auto-scrolling')).toBeInTheDocument()
    })

    it('shows connection status in header', () => {
      simulateConnectionState('streaming', 'connected')

      render(<AgentTerminalPanel {...defaultProps} />)

      expect(screen.getByTestId('streaming-state')).toHaveTextContent('streaming')
    })

    it('handles connection state transitions smoothly', () => {
      const { rerender } = render(<AgentTerminalPanel {...defaultProps} />)

      // Start disconnected
      expect(screen.getByText('Connect')).toBeInTheDocument()

      // Transition to connecting
      simulateConnectionState('connecting', 'connecting')
      rerender(<AgentTerminalPanel {...defaultProps} />)
      expect(screen.getByText('Connecting to log stream...')).toBeInTheDocument()

      // Transition to streaming
      simulateConnectionState('streaming', 'connected')
      rerender(<AgentTerminalPanel {...defaultProps} />)
      expect(screen.getByTestId('streaming-state')).toHaveTextContent('streaming')

      // Transition to disconnected
      simulateConnectionState('disconnected', 'disconnected')
      rerender(<AgentTerminalPanel {...defaultProps} />)
      expect(screen.getByText('Disconnected')).toBeInTheDocument()
    })
  })

  describe('Error Handling During Streaming', () => {
    it('continues to show existing logs when connection errors occur', () => {
      simulateConnectionState('streaming', 'connected')
      mockLogs = [createTestLog('1', 'Existing log')]

      const { rerender } = render(<AgentTerminalPanel {...defaultProps} />)

      expect(screen.getByTestId('log-entry-1')).toBeInTheDocument()

      // Simulate connection error
      simulateConnectionState('error', 'error', 'Network timeout')
      rerender(<AgentTerminalPanel {...defaultProps} />)

      // Logs should still be visible
      expect(screen.getByTestId('log-entry-1')).toBeInTheDocument()
      expect(screen.getByText('Stream Error')).toBeInTheDocument()
    })

    it('handles reconnection after error', () => {
      simulateConnectionState('error', 'error', 'Connection lost')

      render(<AgentTerminalPanel {...defaultProps} />)

      const reconnectButton = screen.getByText('Reconnect')
      fireEvent.click(reconnectButton)

      expect(mockConnect).toHaveBeenCalled()
    })

    it('shows appropriate error messages for different error types', () => {
      const errorMessages = [
        'WebSocket connection failed',
        'Authentication error',
        'Network timeout',
        'Server error',
      ]

      errorMessages.forEach((errorMessage) => {
        simulateConnectionState('error', 'error', errorMessage)

        const { container } = render(<AgentTerminalPanel {...defaultProps} />)

        expect(screen.getByText(errorMessage)).toBeInTheDocument()
        expect(screen.getByText('Stream Error')).toBeInTheDocument()

        container.remove()
      })
    })
  })

  describe('Auto-scroll During Streaming', () => {
    it('notifies auto-scroll hook when new logs arrive', async () => {
      simulateConnectionState('streaming', 'connected')

      const { rerender } = render(<AgentTerminalPanel {...defaultProps} />)

      // Add new logs
      mockLogs = [
        createTestLog('1', 'New log 1'),
        createTestLog('2', 'New log 2'),
      ]

      rerender(<AgentTerminalPanel {...defaultProps} />)

      await waitFor(() => {
        expect(mockNotifyNewItems).toHaveBeenCalledWith(2)
      })
    })

    it('shows new logs button when auto-scroll is disabled', () => {
      mockAutoScroll = false
      mockNewItemsSinceScroll = 5

      render(<AgentTerminalPanel {...defaultProps} />)

      expect(screen.getByText('5 new logs')).toBeInTheDocument()
    })

    it('scrolls to bottom when new logs button is clicked', () => {
      mockAutoScroll = false
      mockNewItemsSinceScroll = 3

      render(<AgentTerminalPanel {...defaultProps} />)

      const newLogsButton = screen.getByText('3 new logs')
      fireEvent.click(newLogsButton)

      expect(mockScrollToBottom).toHaveBeenCalled()
    })
  })
})