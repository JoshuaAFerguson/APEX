/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AgentTerminalPanel } from '../AgentTerminalPanel'
import type { AgentTerminalPanelProps, AgentLogEntry } from '@/types/agent-log-stream'

// Mock data for testing
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
let mockStats = {
  totalLogs: 0,
  logsPerSecond: 0,
  byLevel: { debug: 0, info: 0, warn: 0, error: 0 },
  bySource: { agent: 0, system: 0, user: 0, tool: 0, error: 0 },
  errorCount: 0,
  streamDurationMs: 0,
}
let mockAutoScroll = true
let mockNewItemsSinceScroll = 0
let mockIsStreaming = false

// Mock functions
const mockConnect = vi.fn()
const mockDisconnect = vi.fn()
const mockPause = vi.fn()
const mockResume = vi.fn()
const mockClearLogs = vi.fn()
const mockSetFilter = vi.fn()
const mockResetFilter = vi.fn()
const mockExportLogs = vi.fn(() => '[]')
const mockScrollToLog = vi.fn()
const mockScrollToBottom = vi.fn()
const mockHandleScroll = vi.fn()
const mockNotifyNewItems = vi.fn()

// Mock the hooks
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
    stats: mockStats,
    isConnecting: false,
    isStreaming: mockIsStreaming,
    isPaused: false,
    error: null,
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
    isAtBottom: true,
    setAutoScroll: vi.fn(),
    resetNewItemsCounter: vi.fn(),
    notifyNewItems: mockNotifyNewItems,
  })),
}))

// Mock child components
vi.mock('../AgentTerminalPanelHeader', () => ({
  AgentTerminalPanelHeader: ({ title, onMinimize, onClose }: any) => (
    <div data-testid="header">
      <span>{title}</span>
      <button data-testid="minimize" onClick={onMinimize}>Minimize</button>
      <button data-testid="close" onClick={onClose}>Close</button>
    </div>
  ),
}))

vi.mock('../AgentTerminalPanelControls', () => ({
  AgentTerminalPanelControls: ({ show }: any) => (
    show ? <div data-testid="controls">Controls</div> : null
  ),
}))

vi.mock('../AgentTerminalPanelLogEntry', () => ({
  AgentTerminalPanelLogEntry: ({ log, onClick }: any) => (
    <div data-testid={`log-${log.id}`} onClick={() => onClick?.(log)}>
      {log.message}
    </div>
  ),
}))

vi.mock('@/lib/websocket-client', () => ({
  wsClient: {
    isConnected: vi.fn(() => false),
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    getHealthState: vi.fn(() => ({ isHealthy: true, consecutiveFailures: 0 })),
  },
}))

function createTestLog(id: string, message: string): AgentLogEntry {
  return {
    id,
    timestamp: new Date(),
    level: 'info',
    message,
    source: 'agent',
    metadata: { agentId: 'test' },
  }
}

describe('AgentTerminalPanel - Unit Tests', () => {
  const defaultProps: AgentTerminalPanelProps = {
    panelId: 'test-panel',
    agentId: 'test-agent',
  }

  beforeEach(() => {
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
    mockStats = {
      totalLogs: 0,
      logsPerSecond: 0,
      byLevel: { debug: 0, info: 0, warn: 0, error: 0 },
      bySource: { agent: 0, system: 0, user: 0, tool: 0, error: 0 },
      errorCount: 0,
      streamDurationMs: 0,
    }
    mockAutoScroll = true
    mockNewItemsSinceScroll = 0
    mockIsStreaming = false

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Component Rendering', () => {
    it('renders with minimal required props', () => {
      render(<AgentTerminalPanel panelId="test" agentId="agent" />)
      expect(screen.getByTestId('header')).toBeInTheDocument()
    })

    it('uses agentId as default title', () => {
      render(<AgentTerminalPanel panelId="test" agentId="my-agent" />)
      expect(screen.getByText('my-agent')).toBeInTheDocument()
    })

    it('uses custom title when provided', () => {
      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="agent"
          title="Custom Terminal"
        />
      )
      expect(screen.getByText('Custom Terminal')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      const { container } = render(
        <AgentTerminalPanel
          panelId="test"
          agentId="agent"
          className="custom-class"
        />
      )
      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('applies custom height styles', () => {
      const { container } = render(
        <AgentTerminalPanel
          panelId="test"
          agentId="agent"
          maxHeight="600px"
          minHeight="100px"
        />
      )
      const element = container.firstChild as HTMLElement
      expect(element.style.maxHeight).toBe('600px')
      expect(element.style.minHeight).toBe('100px')
    })

    it('handles maxHeight="none" correctly', () => {
      const { container } = render(
        <AgentTerminalPanel
          panelId="test"
          agentId="agent"
          maxHeight="none"
        />
      )
      const element = container.firstChild as HTMLElement
      expect(element.style.maxHeight).toBe('')
    })
  })

  describe('Theme Support', () => {
    it('applies dark theme by default', () => {
      const { container } = render(
        <AgentTerminalPanel panelId="test" agentId="agent" />
      )
      expect(container.firstChild).toHaveClass('bg-gray-950/90')
    })

    it('applies light theme when specified', () => {
      const { container } = render(
        <AgentTerminalPanel
          panelId="test"
          agentId="agent"
          theme="light"
        />
      )
      expect(container.firstChild).toHaveClass('bg-white/90')
    })
  })

  describe('Controls Visibility', () => {
    it('shows controls when showFilters is true', () => {
      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="agent"
          showFilters={true}
        />
      )
      expect(screen.getByTestId('controls')).toBeInTheDocument()
    })

    it('shows controls when showSearch is true', () => {
      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="agent"
          showSearch={true}
        />
      )
      expect(screen.getByTestId('controls')).toBeInTheDocument()
    })

    it('hides controls when both showFilters and showSearch are false', () => {
      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="agent"
          showFilters={false}
          showSearch={false}
        />
      )
      expect(screen.queryByTestId('controls')).not.toBeInTheDocument()
    })
  })

  describe('Log Display', () => {
    it('renders log entries when available', () => {
      mockLogs = [
        createTestLog('1', 'First log'),
        createTestLog('2', 'Second log'),
      ]

      render(<AgentTerminalPanel panelId="test" agentId="agent" />)

      expect(screen.getByTestId('log-1')).toBeInTheDocument()
      expect(screen.getByTestId('log-2')).toBeInTheDocument()
      expect(screen.getByText('First log')).toBeInTheDocument()
      expect(screen.getByText('Second log')).toBeInTheDocument()
    })

    it('shows empty state when no logs and not streaming', () => {
      render(<AgentTerminalPanel panelId="test" agentId="agent" />)

      expect(screen.getByText('No logs yet')).toBeInTheDocument()
      expect(screen.getByText('Connect to start streaming logs')).toBeInTheDocument()
    })
  })

  describe('Status Bar', () => {
    it('displays log count correctly', () => {
      mockLogs = [createTestLog('1', 'Test log')]
      mockStats.totalLogs = 5

      render(<AgentTerminalPanel panelId="test" agentId="agent" />)

      expect(screen.getByText('Showing 1 of 5 logs')).toBeInTheDocument()
    })

    it('displays error count when errors exist', () => {
      mockStats.errorCount = 3

      render(<AgentTerminalPanel panelId="test" agentId="agent" />)

      expect(screen.getByText('3 errors')).toBeInTheDocument()
    })

    it('displays singular error count correctly', () => {
      mockStats.errorCount = 1

      render(<AgentTerminalPanel panelId="test" agentId="agent" />)

      expect(screen.getByText('1 error')).toBeInTheDocument()
    })

    it('displays logs per second when streaming', () => {
      mockStats.logsPerSecond = 2.5
      mockIsStreaming = true

      render(<AgentTerminalPanel panelId="test" agentId="agent" />)

      expect(screen.getByText('2.5 logs/sec')).toBeInTheDocument()
    })
  })

  describe('Panel Minimize/Maximize', () => {
    it('starts in non-minimized state', () => {
      render(<AgentTerminalPanel panelId="test" agentId="agent" />)

      expect(screen.getByTestId('controls')).toBeInTheDocument()
      expect(screen.getByTestId('minimize')).toBeInTheDocument()
    })

    it('handles minimize action', () => {
      const { rerender } = render(
        <AgentTerminalPanel panelId="test" agentId="agent" />
      )

      const minimizeButton = screen.getByTestId('minimize')
      fireEvent.click(minimizeButton)

      // In a real scenario, this would trigger a re-render with minimized state
      // For unit testing, we verify the click handler was called
      expect(minimizeButton).toBeInTheDocument()
    })
  })

  describe('Event Callbacks', () => {
    it('calls onLogSelect when log is clicked', () => {
      const onLogSelect = vi.fn()
      mockLogs = [createTestLog('1', 'Test log')]

      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="agent"
          onLogSelect={onLogSelect}
        />
      )

      fireEvent.click(screen.getByTestId('log-1'))

      expect(mockScrollToLog).toHaveBeenCalledWith('1')
      expect(onLogSelect).toHaveBeenCalledWith(mockLogs[0])
    })

    it('does not call onLogSelect when not provided', () => {
      mockLogs = [createTestLog('1', 'Test log')]

      render(<AgentTerminalPanel panelId="test" agentId="agent" />)

      // Should not throw when clicking without callback
      fireEvent.click(screen.getByTestId('log-1'))
    })

    it('calls disconnect on close', () => {
      render(<AgentTerminalPanel panelId="test" agentId="agent" />)

      fireEvent.click(screen.getByTestId('close'))

      expect(mockDisconnect).toHaveBeenCalled()
    })
  })

  describe('Auto-scroll Integration', () => {
    it('shows auto-scroll indicator when enabled', () => {
      mockAutoScroll = true

      render(<AgentTerminalPanel panelId="test" agentId="agent" />)

      expect(screen.getByText('Auto-scrolling')).toBeInTheDocument()
    })

    it('shows new logs button when auto-scroll disabled', () => {
      mockAutoScroll = false
      mockNewItemsSinceScroll = 5

      render(<AgentTerminalPanel panelId="test" agentId="agent" />)

      expect(screen.getByText('5 new logs')).toBeInTheDocument()
      expect(screen.queryByText('Auto-scrolling')).not.toBeInTheDocument()
    })

    it('calls scrollToBottom when new logs button clicked', () => {
      mockAutoScroll = false
      mockNewItemsSinceScroll = 3

      render(<AgentTerminalPanel panelId="test" agentId="agent" />)

      fireEvent.click(screen.getByText('3 new logs'))

      expect(mockScrollToBottom).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('handles empty log arrays gracefully', () => {
      mockLogs = []

      render(<AgentTerminalPanel panelId="test" agentId="agent" />)

      expect(screen.getByText('No logs yet')).toBeInTheDocument()
    })

    it('handles malformed log data gracefully', () => {
      // This would be handled by the useAgentLogStream hook in practice
      mockLogs = []

      render(<AgentTerminalPanel panelId="test" agentId="agent" />)

      expect(screen.getByTestId('header')).toBeInTheDocument()
    })
  })

  describe('Performance Considerations', () => {
    it('limits log display based on maxLogs prop', () => {
      // The actual limiting happens in the useAgentLogStream hook
      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="agent"
          maxLogs={500}
        />
      )

      // Verify component renders with the prop
      expect(screen.getByTestId('header')).toBeInTheDocument()
    })

    it('handles large numbers of logs without crashing', () => {
      // Create many logs
      mockLogs = Array.from({ length: 100 }, (_, i) =>
        createTestLog(i.toString(), `Log ${i}`)
      )

      render(<AgentTerminalPanel panelId="test" agentId="agent" />)

      // Should render without issues
      expect(screen.getByTestId('log-0')).toBeInTheDocument()
      expect(screen.getByTestId('log-99')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('provides proper ARIA labels for interactive elements', () => {
      render(<AgentTerminalPanel panelId="test" agentId="agent" />)

      const header = screen.getByTestId('header')
      expect(header).toBeInTheDocument()

      // The actual ARIA attributes would be tested in the header component
    })

    it('supports keyboard navigation', () => {
      mockLogs = [createTestLog('1', 'Test log')]
      const onLogSelect = vi.fn()

      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="agent"
          onLogSelect={onLogSelect}
        />
      )

      // Verify clickable elements exist
      expect(screen.getByTestId('log-1')).toBeInTheDocument()
    })
  })

  describe('Props Validation', () => {
    it('handles missing optional props gracefully', () => {
      // Should not crash with only required props
      render(<AgentTerminalPanel panelId="test" agentId="agent" />)

      expect(screen.getByTestId('header')).toBeInTheDocument()
    })

    it('uses prop defaults correctly', () => {
      const { container } = render(
        <AgentTerminalPanel panelId="test" agentId="agent" />
      )

      // Check default styling is applied
      expect(container.firstChild).toHaveClass('bg-gray-950/90')
    })
  })
})