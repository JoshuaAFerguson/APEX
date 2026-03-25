/**
 * Centralized mocks for AgentTerminalPanel tests
 *
 * Provides reusable mock implementations for hooks and components
 * to ensure consistent testing behavior across all test files.
 */

import React from 'react'
import { vi } from 'vitest'
import type { UseAgentLogStreamReturn } from '@/hooks/useAgentLogStream'
import type { UseAutoScrollReturn } from '@/hooks/useAutoScroll'
import { MOCK_LOGS, MOCK_STREAM_STATES, MOCK_STATS } from './AgentTerminalPanel.fixtures'

// ============================================================================
// Hook Mocks
// ============================================================================

/**
 * Creates a mock implementation of useAgentLogStream hook
 */
export function createAgentLogStreamMock(overrides: Partial<UseAgentLogStreamReturn> = {}): UseAgentLogStreamReturn {
  return {
    filteredLogs: MOCK_LOGS,
    filter: {},
    streamState: MOCK_STREAM_STATES.streaming,
    stats: MOCK_STATS,
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
    exportLogs: vi.fn(() => JSON.stringify(MOCK_LOGS)),
    scrollToLog: vi.fn(),
    ...overrides,
  }
}

/**
 * Creates a mock implementation of useAutoScroll hook
 */
export function createAutoScrollMock(overrides: Partial<UseAutoScrollReturn> = {}): UseAutoScrollReturn {
  return {
    containerRef: { current: null },
    handleScroll: vi.fn(),
    scrollToBottom: vi.fn(),
    autoScroll: true,
    newItemsSinceScroll: 0,
    notifyNewItems: vi.fn(),
    ...overrides,
  }
}

/**
 * Creates a mock implementation with error state
 */
export function createErrorStateMock() {
  return createAgentLogStreamMock({
    error: 'Connection failed',
    streamState: MOCK_STREAM_STATES.error,
    isConnecting: false,
    isStreaming: false,
  })
}

/**
 * Creates a mock implementation with disconnected state
 */
export function createDisconnectedStateMock() {
  return createAgentLogStreamMock({
    streamState: MOCK_STREAM_STATES.disconnected,
    isConnecting: false,
    isStreaming: false,
    filteredLogs: [],
  })
}

/**
 * Creates a mock implementation with connecting state
 */
export function createConnectingStateMock() {
  return createAgentLogStreamMock({
    streamState: MOCK_STREAM_STATES.connecting,
    isConnecting: true,
    isStreaming: false,
    filteredLogs: [],
  })
}

// ============================================================================
// Component Mocks
// ============================================================================

/**
 * Mock AgentTerminalPanelHeader component
 */
export const MockAgentTerminalPanelHeader = vi.fn(({ onMinimize, onMaximize, onRestore, onClose, onPause, onResume, onClear, onExport, ...props }) => {
  return (
    <div data-testid="mock-header" {...props}>
      <span data-testid="header-title">{props.title}</span>
      <span data-testid="header-agent-id">{props.agentId}</span>
      <span data-testid="header-agent-status">{props.agentStatus}</span>
      <span data-testid="header-streaming-state">{props.streamingState}</span>
      <span data-testid="header-panel-state">{props.panelState}</span>

      {onMinimize && (
        <button data-testid="header-minimize" onClick={onMinimize}>
          Minimize
        </button>
      )}
      {onMaximize && (
        <button data-testid="header-maximize" onClick={onMaximize}>
          Maximize
        </button>
      )}
      {onRestore && (
        <button data-testid="header-restore" onClick={onRestore}>
          Restore
        </button>
      )}
      {onClose && (
        <button data-testid="header-close" onClick={onClose}>
          Close
        </button>
      )}
      {onPause && (
        <button data-testid="header-pause" onClick={onPause}>
          Pause
        </button>
      )}
      {onResume && (
        <button data-testid="header-resume" onClick={onResume}>
          Resume
        </button>
      )}
      {onClear && (
        <button data-testid="header-clear" onClick={onClear}>
          Clear
        </button>
      )}
      {onExport && (
        <button data-testid="header-export" onClick={onExport}>
          Export
        </button>
      )}
    </div>
  )
})

/**
 * Mock AgentTerminalPanelControls component
 */
export const MockAgentTerminalPanelControls = vi.fn(({ onFilterChange, onResetFilter, ...props }) => {
  return (
    <div data-testid="mock-controls" {...props}>
      <span data-testid="controls-show">{String(props.show)}</span>
      <span data-testid="controls-show-search">{String(props.showSearch)}</span>
      <span data-testid="controls-show-level-filter">{String(props.showLevelFilter)}</span>
      <span data-testid="controls-show-source-filter">{String(props.showSourceFilter)}</span>

      {onFilterChange && (
        <button
          data-testid="controls-change-filter"
          onClick={() => onFilterChange({ level: 'error' })}
        >
          Change Filter
        </button>
      )}
      {onResetFilter && (
        <button data-testid="controls-reset-filter" onClick={onResetFilter}>
          Reset Filter
        </button>
      )}
    </div>
  )
})

/**
 * Mock AgentTerminalPanelLogEntry component
 */
export const MockAgentTerminalPanelLogEntry = vi.fn(({ log, onClick, ...props }) => {
  return (
    <div
      data-testid={`mock-log-entry-${log.id}`}
      className={props.isSelected ? 'selected' : ''}
      onClick={() => onClick?.(log)}
      {...props}
    >
      <span data-testid="log-timestamp">{log.timestamp.toISOString()}</span>
      <span data-testid="log-level">{log.level}</span>
      <span data-testid="log-message">{log.message}</span>
      <span data-testid="log-source">{log.source}</span>
      <span data-testid="log-show-timestamps">{String(props.showTimestamps)}</span>
      <span data-testid="log-show-level-badges">{String(props.showLevelBadges)}</span>
      <span data-testid="log-show-source-badges">{String(props.showSourceBadges)}</span>
      <span data-testid="log-wrap-lines">{String(props.wrapLines)}</span>
      <span data-testid="log-font-size">{props.fontSize}</span>
    </div>
  )
})

// ============================================================================
// Global Mock Setup Functions
// ============================================================================

/**
 * Sets up mocks for useAgentLogStream hook
 */
export function mockUseAgentLogStream(mockReturn?: Partial<UseAgentLogStreamReturn>) {
  return vi.mocked(vi.hoisted(() => ({
    useAgentLogStream: vi.fn(() => createAgentLogStreamMock(mockReturn)),
  })))
}

/**
 * Sets up mocks for useAutoScroll hook
 */
export function mockUseAutoScroll(mockReturn?: Partial<UseAutoScrollReturn>) {
  return vi.mocked(vi.hoisted(() => ({
    useAutoScroll: vi.fn(() => createAutoScrollMock(mockReturn)),
  })))
}

/**
 * Sets up mocks for child components
 */
export function mockChildComponents() {
  return vi.mocked(vi.hoisted(() => ({
    AgentTerminalPanelHeader: MockAgentTerminalPanelHeader,
    AgentTerminalPanelControls: MockAgentTerminalPanelControls,
    AgentTerminalPanelLogEntry: MockAgentTerminalPanelLogEntry,
  })))
}

/**
 * Resets all mocks to their default state
 */
export function resetAllMocks() {
  vi.clearAllMocks()
  MockAgentTerminalPanelHeader.mockClear()
  MockAgentTerminalPanelControls.mockClear()
  MockAgentTerminalPanelLogEntry.mockClear()
}