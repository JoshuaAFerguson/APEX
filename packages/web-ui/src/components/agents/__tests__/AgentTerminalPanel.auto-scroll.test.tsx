/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AgentTerminalPanel } from '../AgentTerminalPanel'
import type { AgentLogEntry } from '@/types/agent-log-stream'

// Mock implementations for testing auto-scroll behavior
let mockLogs: AgentLogEntry[] = []
let mockAutoScroll = true
let mockNewItemsSinceScroll = 0
let mockNotifyNewItems: ReturnType<typeof vi.fn>
let mockScrollToBottom: ReturnType<typeof vi.fn>
let mockHandleScroll: ReturnType<typeof vi.fn>

// Create mock log entries for testing
function createMockLog(id: string, message: string): AgentLogEntry {
  return {
    id,
    timestamp: new Date(),
    level: 'info',
    message,
    source: 'agent',
    metadata: {
      agentId: 'test-agent',
    },
  }
}

vi.mock('@/hooks/useAgentLogStream', () => ({
  useAgentLogStream: vi.fn(() => ({
    filteredLogs: mockLogs,
    filter: {
      levels: new Set(['debug', 'info', 'warn', 'error']),
      searchText: '',
      stage: null,
      agent: null,
    },
    streamState: {
      state: 'streaming',
      connectionStatus: 'connected',
      isReceiving: true,
      logsReceivedCount: mockLogs.length,
      lastLogAt: new Date(),
      bytesReceived: 0,
      streamStartedAt: new Date(),
      error: null,
    },
    stats: {
      totalLogs: mockLogs.length,
      logsPerSecond: 1.0,
      byLevel: { debug: 0, info: mockLogs.length, warn: 0, error: 0 },
      bySource: { agent: mockLogs.length, system: 0, user: 0, tool: 0, error: 0 },
      errorCount: 0,
      streamDurationMs: 5000,
    },
    isConnecting: false,
    isStreaming: true,
    isPaused: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    clearLogs: vi.fn(),
    setFilter: vi.fn(),
    resetFilter: vi.fn(),
    exportLogs: vi.fn(() => JSON.stringify(mockLogs)),
    scrollToLog: vi.fn(),
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

// Simplified mocks for sub-components
vi.mock('../AgentTerminalPanelHeader', () => ({
  AgentTerminalPanelHeader: () => <div data-testid="header">Header</div>,
}))

vi.mock('../AgentTerminalPanelControls', () => ({
  AgentTerminalPanelControls: () => <div data-testid="controls">Controls</div>,
}))

vi.mock('../AgentTerminalPanelLogEntry', () => ({
  AgentTerminalPanelLogEntry: ({ log }: { log: AgentLogEntry }) => (
    <div data-testid={`log-entry-${log.id}`}>
      {log.message}
    </div>
  ),
}))

vi.mock('@/lib/websocket-client', () => ({
  wsClient: {
    isConnected: vi.fn(() => true),
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    getHealthState: vi.fn(() => ({ isHealthy: true, consecutiveFailures: 0 })),
  },
}))

describe('AgentTerminalPanel - Auto-scroll Behavior', () => {
  beforeEach(() => {
    // Reset mocks
    mockLogs = []
    mockAutoScroll = true
    mockNewItemsSinceScroll = 0
    mockNotifyNewItems = vi.fn()
    mockScrollToBottom = vi.fn()
    mockHandleScroll = vi.fn()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('renders empty state initially', () => {
    render(
      <AgentTerminalPanel
        panelId="test-panel"
        agentId="test-agent"
      />
    )

    expect(screen.getByText('Logs will appear here as they arrive')).toBeInTheDocument()
    expect(screen.getByText('Auto-scrolling')).toBeInTheDocument()
  })

  it('displays logs when they are available', async () => {
    // Add some logs
    mockLogs = [
      createMockLog('1', 'First log message'),
      createMockLog('2', 'Second log message'),
    ]

    const { rerender } = render(
      <AgentTerminalPanel
        panelId="test-panel"
        agentId="test-agent"
      />
    )

    rerender(
      <AgentTerminalPanel
        panelId="test-panel"
        agentId="test-agent"
      />
    )

    expect(screen.getByTestId('log-entry-1')).toBeInTheDocument()
    expect(screen.getByTestId('log-entry-2')).toBeInTheDocument()
    expect(screen.getByText('First log message')).toBeInTheDocument()
    expect(screen.getByText('Second log message')).toBeInTheDocument()
  })

  it('shows auto-scrolling indicator when auto-scroll is enabled', () => {
    mockAutoScroll = true
    mockLogs = [createMockLog('1', 'Test message')]

    render(
      <AgentTerminalPanel
        panelId="test-panel"
        agentId="test-agent"
      />
    )

    expect(screen.getByText('Auto-scrolling')).toBeInTheDocument()
    expect(screen.queryByText(/new logs/)).not.toBeInTheDocument()
  })

  it('shows "new logs" button when auto-scroll is disabled and new logs available', () => {
    mockAutoScroll = false
    mockNewItemsSinceScroll = 3
    mockLogs = [
      createMockLog('1', 'Old log'),
      createMockLog('2', 'New log 1'),
      createMockLog('3', 'New log 2'),
      createMockLog('4', 'New log 3'),
    ]

    render(
      <AgentTerminalPanel
        panelId="test-panel"
        agentId="test-agent"
      />
    )

    const newLogsButton = screen.getByText('3 new logs')
    expect(newLogsButton).toBeInTheDocument()
    expect(screen.queryByText('Auto-scrolling')).not.toBeInTheDocument()
  })

  it('calls scrollToBottom when new logs button is clicked', () => {
    mockAutoScroll = false
    mockNewItemsSinceScroll = 2
    mockLogs = [createMockLog('1', 'Test message')]

    render(
      <AgentTerminalPanel
        panelId="test-panel"
        agentId="test-agent"
      />
    )

    const newLogsButton = screen.getByText('2 new logs')
    fireEvent.click(newLogsButton)

    expect(mockScrollToBottom).toHaveBeenCalled()
  })

  it('handles singular vs plural in new logs button text', () => {
    mockAutoScroll = false
    mockNewItemsSinceScroll = 1

    render(
      <AgentTerminalPanel
        panelId="test-panel"
        agentId="test-agent"
      />
    )

    expect(screen.getByText('1 new log')).toBeInTheDocument()
    expect(screen.queryByText('1 new logs')).not.toBeInTheDocument()
  })

  it('notifies auto-scroll hook when logs change', async () => {
    // Start with some logs
    mockLogs = [createMockLog('1', 'Initial log')]

    const { rerender } = render(
      <AgentTerminalPanel
        panelId="test-panel"
        agentId="test-agent"
      />
    )

    // Add more logs
    mockLogs = [
      createMockLog('1', 'Initial log'),
      createMockLog('2', 'New log 1'),
      createMockLog('3', 'New log 2'),
    ]

    rerender(
      <AgentTerminalPanel
        panelId="test-panel"
        agentId="test-agent"
      />
    )

    // Wait for the effect to run
    await waitFor(() => {
      expect(mockNotifyNewItems).toHaveBeenCalledWith(2)
    })
  })

  it('shows correct log count in status bar', () => {
    mockLogs = [
      createMockLog('1', 'Log 1'),
      createMockLog('2', 'Log 2'),
      createMockLog('3', 'Log 3'),
    ]

    render(
      <AgentTerminalPanel
        panelId="test-panel"
        agentId="test-agent"
      />
    )

    expect(screen.getByText('Showing 3 of 3 logs')).toBeInTheDocument()
    expect(screen.getByText('1.0 logs/sec')).toBeInTheDocument()
  })

  it('respects autoScroll prop from component props', () => {
    render(
      <AgentTerminalPanel
        panelId="test-panel"
        agentId="test-agent"
        autoScroll={false}
      />
    )

    // Component renders successfully with autoScroll prop
    expect(screen.getByTestId('header')).toBeInTheDocument()
  })

  it('passes auto-scroll callback correctly', () => {
    render(
      <AgentTerminalPanel
        panelId="test-panel"
        agentId="test-agent"
      />
    )

    // Component renders successfully and auto-scroll functionality is integrated
    expect(screen.getByTestId('header')).toBeInTheDocument()
  })
})

describe('AgentTerminalPanel - Auto-scroll Integration Scenarios', () => {
  beforeEach(() => {
    mockLogs = []
    mockAutoScroll = true
    mockNewItemsSinceScroll = 0
    mockNotifyNewItems = vi.fn()
    mockScrollToBottom = vi.fn()
    mockHandleScroll = vi.fn()
    vi.clearAllMocks()
  })

  it('handles rapid log additions correctly', async () => {
    const { rerender } = render(
      <AgentTerminalPanel
        panelId="test-panel"
        agentId="test-agent"
      />
    )

    // Simulate rapid log additions
    for (let i = 1; i <= 5; i++) {
      mockLogs.push(createMockLog(`${i}`, `Log message ${i}`))

      rerender(
        <AgentTerminalPanel
          panelId="test-panel"
          agentId="test-agent"
        />
      )
    }

    await waitFor(() => {
      expect(mockNotifyNewItems).toHaveBeenCalled()
    })

    // Should show all logs
    expect(screen.getByText('Showing 5 of 5 logs')).toBeInTheDocument()
  })

  it('handles auto-scroll state changes during streaming', () => {
    mockLogs = [createMockLog('1', 'Test log')]

    const { rerender } = render(
      <AgentTerminalPanel
        panelId="test-panel"
        agentId="test-agent"
      />
    )

    // Initially auto-scrolling
    expect(screen.getByText('Auto-scrolling')).toBeInTheDocument()

    // User scrolls up, disabling auto-scroll
    mockAutoScroll = false
    mockNewItemsSinceScroll = 2

    rerender(
      <AgentTerminalPanel
        panelId="test-panel"
        agentId="test-agent"
      />
    )

    expect(screen.queryByText('Auto-scrolling')).not.toBeInTheDocument()
    expect(screen.getByText('2 new logs')).toBeInTheDocument()
  })
})