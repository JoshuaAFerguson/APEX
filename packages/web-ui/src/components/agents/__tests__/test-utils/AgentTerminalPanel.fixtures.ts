/**
 * Shared test fixtures for AgentTerminalPanel tests
 *
 * Provides standardized test data, props, and mock configurations
 * to ensure consistency across all test files.
 */

import { vi } from 'vitest'
import type { AgentTerminalPanelProps, AgentLogEntry, StreamingState } from '@/types/agent-log-stream'
import type { PanelDisplayState } from '@/types/agent-terminal-panel'

// ============================================================================
// Standard Test Props
// ============================================================================

export const DEFAULT_TEST_PROPS: AgentTerminalPanelProps = {
  panelId: 'test-panel-1',
  agentId: 'test-agent-1',
  title: 'Test Agent Terminal',
  agentStatus: 'idle',
  panelState: 'normal',
  maxHeight: '400px',
  minHeight: '200px',
  autoConnect: true,
  autoScroll: true,
  maxLogs: 1000,
  showFilters: true,
  showSearch: true,
  showTimestamps: true,
  showLevelBadges: true,
  showSourceBadges: false,
  wrapLines: true,
  fontSize: 'sm',
  theme: 'dark',
}

export const MINIMAL_TEST_PROPS: Pick<AgentTerminalPanelProps, 'panelId' | 'agentId'> = {
  panelId: 'minimal-panel',
  agentId: 'minimal-agent',
}

export const CALLBACK_TEST_PROPS: AgentTerminalPanelProps = {
  ...DEFAULT_TEST_PROPS,
  onLogSelect: vi.fn(),
  onFilterChange: vi.fn(),
  onStreamStateChange: vi.fn(),
  onError: vi.fn(),
  onClear: vi.fn(),
  onMinimize: vi.fn(),
  onMaximize: vi.fn(),
  onRestore: vi.fn(),
  onClose: vi.fn(),
  onPause: vi.fn(),
  onResume: vi.fn(),
}

// ============================================================================
// Mock Log Data
// ============================================================================

export const MOCK_LOGS: AgentLogEntry[] = [
  createTestLog({
    id: 'log-1',
    timestamp: new Date('2024-01-01T10:00:00Z'),
    level: 'info',
    message: 'Agent started successfully',
    source: 'agent',
    metadata: {
      agentId: 'test-agent-1',
      agentName: 'Test Agent',
      stage: 'initialization',
    }
  }),
  createTestLog({
    id: 'log-2',
    timestamp: new Date('2024-01-01T10:00:01Z'),
    level: 'debug',
    message: 'Loading configuration...',
    source: 'system',
    metadata: {
      agentId: 'test-agent-1',
      stage: 'configuration',
    }
  }),
  createTestLog({
    id: 'log-3',
    timestamp: new Date('2024-01-01T10:00:02Z'),
    level: 'warn',
    message: 'Deprecated API used',
    source: 'tool',
    metadata: {
      agentId: 'test-agent-1',
      toolName: 'legacy-tool',
      stage: 'execution',
    }
  }),
  createTestLog({
    id: 'log-4',
    timestamp: new Date('2024-01-01T10:00:03Z'),
    level: 'error',
    message: 'Failed to connect to database',
    source: 'error',
    metadata: {
      agentId: 'test-agent-1',
      stage: 'execution',
    }
  })
]

export const MOCK_LOG_WITH_LONG_MESSAGE = createTestLog({
  id: 'long-log',
  message: 'This is a very long log message that should wrap to multiple lines when displayed in the terminal panel. It contains extensive detail about the operation being performed and should test the text wrapping functionality properly.',
  level: 'info',
  source: 'agent',
})

// ============================================================================
// Mock Stream States
// ============================================================================

export const MOCK_STREAM_STATES = {
  idle: {
    state: 'idle' as StreamingState,
    connectionStatus: 'disconnected' as const,
    isReceiving: false,
    logsReceivedCount: 0,
    lastLogAt: null,
    bytesReceived: 0,
    streamStartedAt: null,
    error: null,
  },
  connecting: {
    state: 'connecting' as StreamingState,
    connectionStatus: 'connecting' as const,
    isReceiving: false,
    logsReceivedCount: 0,
    lastLogAt: null,
    bytesReceived: 0,
    streamStartedAt: new Date(),
    error: null,
  },
  streaming: {
    state: 'streaming' as StreamingState,
    connectionStatus: 'connected' as const,
    isReceiving: true,
    logsReceivedCount: 42,
    lastLogAt: new Date(),
    bytesReceived: 1024,
    streamStartedAt: new Date(Date.now() - 60000), // 1 minute ago
    error: null,
  },
  paused: {
    state: 'paused' as StreamingState,
    connectionStatus: 'connected' as const,
    isReceiving: false,
    logsReceivedCount: 42,
    lastLogAt: new Date(),
    bytesReceived: 1024,
    streamStartedAt: new Date(Date.now() - 60000),
    error: null,
  },
  error: {
    state: 'error' as StreamingState,
    connectionStatus: 'error' as const,
    isReceiving: false,
    logsReceivedCount: 15,
    lastLogAt: new Date(),
    bytesReceived: 512,
    streamStartedAt: new Date(Date.now() - 30000),
    error: 'Connection timeout',
  },
  disconnected: {
    state: 'disconnected' as StreamingState,
    connectionStatus: 'disconnected' as const,
    isReceiving: false,
    logsReceivedCount: 15,
    lastLogAt: new Date(),
    bytesReceived: 512,
    streamStartedAt: null,
    error: null,
  },
}

export const MOCK_STATS = {
  totalLogs: 4,
  logsPerSecond: 1.5,
  byLevel: { debug: 1, info: 2, warn: 1, error: 1 },
  bySource: { agent: 2, system: 1, user: 0, tool: 1, error: 1 },
  errorCount: 1,
  streamDurationMs: 60000,
}

// ============================================================================
// Panel State Combinations
// ============================================================================

export const PANEL_STATE_COMBINATIONS: Array<{
  state: PanelDisplayState
  description: string
  isVisible: boolean
  allowsInteraction: boolean
}> = [
  {
    state: 'normal',
    description: 'normal state with full content visible',
    isVisible: true,
    allowsInteraction: true,
  },
  {
    state: 'minimized',
    description: 'minimized state with hidden content',
    isVisible: false,
    allowsInteraction: false,
  },
  {
    state: 'maximized',
    description: 'maximized state with full screen content',
    isVisible: true,
    allowsInteraction: true,
  },
]

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a test log entry with optional overrides
 */
export function createTestLog(overrides: Partial<AgentLogEntry> = {}): AgentLogEntry {
  return {
    id: `test-log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    level: 'info',
    message: 'Test log message',
    source: 'agent',
    metadata: {
      agentId: 'test-agent',
      agentName: 'Test Agent',
      stage: 'test',
    },
    ...overrides,
  }
}

/**
 * Creates test props with optional overrides
 */
export function createTestProps(overrides: Partial<AgentTerminalPanelProps> = {}): AgentTerminalPanelProps {
  return {
    ...DEFAULT_TEST_PROPS,
    ...overrides,
  }
}

/**
 * Creates a mock stream state with optional overrides
 */
export function createMockStreamState(state: StreamingState, overrides = {}) {
  const baseState = MOCK_STREAM_STATES[state] || MOCK_STREAM_STATES.idle
  return {
    ...baseState,
    ...overrides,
  }
}

/**
 * Creates multiple test logs for volume testing
 */
export function createTestLogBatch(count: number, baseOverrides: Partial<AgentLogEntry> = {}): AgentLogEntry[] {
  return Array.from({ length: count }, (_, index) =>
    createTestLog({
      ...baseOverrides,
      id: `batch-log-${index}`,
      message: `Log entry ${index + 1} of ${count}`,
      timestamp: new Date(Date.now() + index * 1000), // Stagger timestamps by 1 second
    })
  )
}

/**
 * Creates props for multi-panel testing
 */
export function createMultiPanelProps(panelIndex: number, totalPanels: number): AgentTerminalPanelProps {
  return createTestProps({
    panelId: `panel-${panelIndex}`,
    agentId: `agent-${panelIndex}`,
    title: `Agent ${panelIndex} of ${totalPanels}`,
  })
}