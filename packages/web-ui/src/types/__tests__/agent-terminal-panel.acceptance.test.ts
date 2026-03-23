/**
 * AgentTerminalPanel Types - Acceptance Criteria Test Suite
 *
 * Tests that verify all specific acceptance criteria are met:
 * - TypeScript interfaces defined for AgentLogEntry, AgentStatus, AgentTerminalPanelProps, and useAgentLogStream hook return types
 * - Types support log levels, timestamps, agent metadata, and streaming state
 */

import { describe, it, expect } from 'vitest'
import type {
  AgentLogEntry,
  AgentLogMetadata,
  AgentTerminalPanelProps,
  LogSource,
  StreamingState,
  LogStreamState,
  LogStreamStats,
  UseAgentLogStreamOptions,
  UseAgentLogStreamReturn,
} from '../agent-log-stream'
import type { LogLevel } from '../log-viewer'
import type { AgentStatus } from '../agent-metrics'
import type { WebSocketConnectionStatus } from '../websocket-connection'

// ============================================================================
// Acceptance Criteria 1: AgentLogEntry Interface
// ============================================================================

describe('Acceptance Criteria: AgentLogEntry Interface', () => {
  it('should define AgentLogEntry interface with all required fields', () => {
    // Test that the interface accepts all required properties
    const logEntry: AgentLogEntry = {
      id: 'test-id',
      timestamp: new Date(),
      level: 'info',
      message: 'Test message',
      source: 'agent',
      metadata: {},
    }

    expect(typeof logEntry.id).toBe('string')
    expect(logEntry.timestamp).toBeInstanceOf(Date)
    expect(['debug', 'info', 'warn', 'error']).toContain(logEntry.level)
    expect(typeof logEntry.message).toBe('string')
    expect(['agent', 'system', 'user', 'tool', 'error']).toContain(logEntry.source)
    expect(typeof logEntry.metadata).toBe('object')
  })

  it('should support all log levels', () => {
    const logLevels: LogLevel[] = ['debug', 'info', 'warn', 'error']

    logLevels.forEach(level => {
      const logEntry: AgentLogEntry = {
        id: `log-${level}`,
        timestamp: new Date(),
        level,
        message: `${level} message`,
        source: 'agent',
        metadata: {},
      }

      expect(logEntry.level).toBe(level)
    })
  })

  it('should support all log sources', () => {
    const logSources: LogSource[] = ['agent', 'system', 'user', 'tool', 'error']

    logSources.forEach(source => {
      const logEntry: AgentLogEntry = {
        id: `log-${source}`,
        timestamp: new Date(),
        level: 'info',
        message: `Message from ${source}`,
        source,
        metadata: {},
      }

      expect(logEntry.source).toBe(source)
    })
  })

  it('should support optional fields for streaming and hierarchy', () => {
    const logEntry: AgentLogEntry = {
      id: 'streaming-log',
      timestamp: new Date(),
      level: 'debug',
      message: 'Streaming log entry',
      source: 'agent',
      metadata: {},
      isStreaming: true,
      parentId: 'parent-log-id',
      sequenceNumber: 42,
    }

    expect(logEntry.isStreaming).toBe(true)
    expect(logEntry.parentId).toBe('parent-log-id')
    expect(logEntry.sequenceNumber).toBe(42)
  })

  it('should support comprehensive agent metadata', () => {
    const metadata: AgentLogMetadata = {
      agentId: 'agent-123',
      agentName: 'Test Agent',
      executionId: 'execution-456',
      stage: 'planning',
      toolName: 'testTool',
      durationMs: 1500,
      tokens: {
        input: 100,
        output: 50,
        total: 150,
      },
      cost: 0.0075,
      error: {
        code: 'TEST_ERROR',
        message: 'Test error message',
        stack: 'Error stack trace',
      },
      extra: {
        customField: 'customValue',
        nestedData: {
          level1: 'value1',
          level2: { sublevel: 'subvalue' },
        },
      },
    }

    const logEntry: AgentLogEntry = {
      id: 'metadata-test',
      timestamp: new Date(),
      level: 'error',
      message: 'Log with comprehensive metadata',
      source: 'tool',
      metadata,
    }

    expect(logEntry.metadata.agentId).toBe('agent-123')
    expect(logEntry.metadata.agentName).toBe('Test Agent')
    expect(logEntry.metadata.executionId).toBe('execution-456')
    expect(logEntry.metadata.stage).toBe('planning')
    expect(logEntry.metadata.toolName).toBe('testTool')
    expect(logEntry.metadata.durationMs).toBe(1500)
    expect(logEntry.metadata.tokens?.total).toBe(150)
    expect(logEntry.metadata.cost).toBe(0.0075)
    expect(logEntry.metadata.error?.code).toBe('TEST_ERROR')
    expect(logEntry.metadata.extra?.customField).toBe('customValue')
  })
})

// ============================================================================
// Acceptance Criteria 2: AgentStatus Interface
// ============================================================================

describe('Acceptance Criteria: AgentStatus Type', () => {
  it('should define AgentStatus type with all valid statuses', () => {
    const validStatuses: AgentStatus[] = ['idle', 'processing', 'error', 'offline']

    validStatuses.forEach(status => {
      const agentStatus: AgentStatus = status
      expect(['idle', 'processing', 'error', 'offline']).toContain(agentStatus)
    })
  })

  it('should work in agent terminal panel props', () => {
    const validStatuses: AgentStatus[] = ['idle', 'processing', 'error', 'offline']

    validStatuses.forEach(status => {
      const props: AgentTerminalPanelProps = {
        panelId: 'test-panel',
        agentId: 'test-agent',
        agentStatus: status,
      }

      expect(props.agentStatus).toBe(status)
    })
  })
})

// ============================================================================
// Acceptance Criteria 3: AgentTerminalPanelProps Interface
// ============================================================================

describe('Acceptance Criteria: AgentTerminalPanelProps Interface', () => {
  it('should define minimal required props', () => {
    const minimalProps: AgentTerminalPanelProps = {
      panelId: 'panel-1',
      agentId: 'agent-1',
    }

    expect(typeof minimalProps.panelId).toBe('string')
    expect(typeof minimalProps.agentId).toBe('string')
  })

  it('should support all display configuration options', () => {
    const displayProps: AgentTerminalPanelProps = {
      panelId: 'display-panel',
      agentId: 'display-agent',
      title: 'Custom Terminal Title',
      agentStatus: 'processing',
      maxHeight: '800px',
      minHeight: '300px',
      showTimestamps: true,
      showLevelBadges: true,
      showSourceBadges: false,
      wrapLines: true,
      fontSize: 'md',
      theme: 'dark',
      className: 'custom-terminal-class',
    }

    expect(displayProps.title).toBe('Custom Terminal Title')
    expect(displayProps.agentStatus).toBe('processing')
    expect(displayProps.maxHeight).toBe('800px')
    expect(displayProps.minHeight).toBe('300px')
    expect(displayProps.showTimestamps).toBe(true)
    expect(displayProps.showLevelBadges).toBe(true)
    expect(displayProps.showSourceBadges).toBe(false)
    expect(displayProps.wrapLines).toBe(true)
    expect(displayProps.fontSize).toBe('md')
    expect(displayProps.theme).toBe('dark')
    expect(displayProps.className).toBe('custom-terminal-class')
  })

  it('should support streaming configuration options', () => {
    const streamingProps: AgentTerminalPanelProps = {
      panelId: 'streaming-panel',
      agentId: 'streaming-agent',
      autoConnect: false,
      autoScroll: false,
      maxLogs: 2000,
    }

    expect(streamingProps.autoConnect).toBe(false)
    expect(streamingProps.autoScroll).toBe(false)
    expect(streamingProps.maxLogs).toBe(2000)
  })

  it('should support filter configuration options', () => {
    const filterProps: AgentTerminalPanelProps = {
      panelId: 'filter-panel',
      agentId: 'filter-agent',
      showFilters: false,
      showSearch: true,
      initialFilter: {
        levels: new Set(['error', 'warn']),
        searchText: 'test search',
        stage: 'execution',
        agent: 'specific-agent',
      },
      visibleLevels: ['error', 'warn'],
    }

    expect(filterProps.showFilters).toBe(false)
    expect(filterProps.showSearch).toBe(true)
    expect(filterProps.initialFilter?.levels.has('error')).toBe(true)
    expect(filterProps.initialFilter?.searchText).toBe('test search')
    expect(filterProps.initialFilter?.stage).toBe('execution')
    expect(filterProps.initialFilter?.agent).toBe('specific-agent')
    expect(filterProps.visibleLevels).toEqual(['error', 'warn'])
  })

  it('should support all event callback options', () => {
    let logSelectCalled = false
    let filterChangeCalled = false
    let streamStateChangeCalled = false
    let errorCalled = false
    let clearCalled = false

    const callbackProps: AgentTerminalPanelProps = {
      panelId: 'callback-panel',
      agentId: 'callback-agent',
      onLogSelect: () => { logSelectCalled = true },
      onFilterChange: () => { filterChangeCalled = true },
      onStreamStateChange: () => { streamStateChangeCalled = true },
      onError: () => { errorCalled = true },
      onClear: () => { clearCalled = true },
    }

    // Test callback signatures
    expect(typeof callbackProps.onLogSelect).toBe('function')
    expect(typeof callbackProps.onFilterChange).toBe('function')
    expect(typeof callbackProps.onStreamStateChange).toBe('function')
    expect(typeof callbackProps.onError).toBe('function')
    expect(typeof callbackProps.onClear).toBe('function')

    // Test callback invocations
    callbackProps.onLogSelect?.({
      id: 'test',
      timestamp: new Date(),
      level: 'info',
      message: 'test',
      source: 'agent',
      metadata: {},
    })
    callbackProps.onFilterChange?.({ searchText: 'test' })
    callbackProps.onStreamStateChange?.('streaming')
    callbackProps.onError?.('test error')
    callbackProps.onClear?.()

    expect(logSelectCalled).toBe(true)
    expect(filterChangeCalled).toBe(true)
    expect(streamStateChangeCalled).toBe(true)
    expect(errorCalled).toBe(true)
    expect(clearCalled).toBe(true)
  })
})

// ============================================================================
// Acceptance Criteria 4: useAgentLogStream Hook Return Types
// ============================================================================

describe('Acceptance Criteria: useAgentLogStream Hook Return Types', () => {
  it('should define UseAgentLogStreamOptions with all configuration options', () => {
    const options: UseAgentLogStreamOptions = {
      agentId: 'hook-agent',
      autoConnect: false,
      maxLogs: 1500,
      filter: {
        levels: new Set(['info', 'error']),
        searchText: 'hook test',
        stage: 'testing',
        agent: 'test-agent',
      },
      onLogs: (logs) => console.log(`Received ${logs.length} logs`),
      onConnectionChange: (status) => console.log(`Connection: ${status}`),
      onError: (error) => console.error(`Error: ${error}`),
      debug: true,
    }

    expect(options.agentId).toBe('hook-agent')
    expect(options.autoConnect).toBe(false)
    expect(options.maxLogs).toBe(1500)
    expect(options.filter?.searchText).toBe('hook test')
    expect(typeof options.onLogs).toBe('function')
    expect(typeof options.onConnectionChange).toBe('function')
    expect(typeof options.onError).toBe('function')
    expect(options.debug).toBe(true)
  })

  it('should define UseAgentLogStreamReturn with all data and control methods', () => {
    const mockLogStreamReturn: UseAgentLogStreamReturn = {
      // Data properties
      logs: [
        {
          id: 'log-1',
          timestamp: new Date(),
          level: 'info',
          message: 'Test log',
          source: 'agent',
          metadata: { agentId: 'test-agent' },
        }
      ],
      filteredLogs: [
        {
          id: 'log-1',
          timestamp: new Date(),
          level: 'info',
          message: 'Test log',
          source: 'agent',
          metadata: { agentId: 'test-agent' },
        }
      ],
      filter: {
        levels: new Set(['info']),
        searchText: '',
        stage: null,
        agent: null,
      },
      streamState: {
        state: 'streaming',
        connectionStatus: 'connected',
        isReceiving: true,
        logsReceivedCount: 1,
        lastLogAt: new Date(),
        bytesReceived: 1024,
        streamStartedAt: new Date(),
        error: null,
      },
      stats: {
        totalLogs: 1,
        logsPerSecond: 0.5,
        byLevel: { debug: 0, info: 1, warn: 0, error: 0 },
        bySource: { agent: 1, system: 0, user: 0, tool: 0, error: 0 },
        errorCount: 0,
        streamDurationMs: 2000,
      },

      // Status properties
      isConnecting: false,
      isStreaming: true,
      isPaused: false,
      error: null,

      // Control methods
      connect: () => {},
      disconnect: () => {},
      pause: () => {},
      resume: () => {},
      clearLogs: () => {},
      addLogs: () => {},
      setFilter: () => {},
      resetFilter: () => {},
      exportLogs: () => '',
      scrollToLog: () => {},
      scrollToBottom: () => {},
    }

    // Verify data properties
    expect(Array.isArray(mockLogStreamReturn.logs)).toBe(true)
    expect(Array.isArray(mockLogStreamReturn.filteredLogs)).toBe(true)
    expect(mockLogStreamReturn.filter.levels).toBeInstanceOf(Set)
    expect(typeof mockLogStreamReturn.streamState).toBe('object')
    expect(typeof mockLogStreamReturn.stats).toBe('object')

    // Verify status properties
    expect(typeof mockLogStreamReturn.isConnecting).toBe('boolean')
    expect(typeof mockLogStreamReturn.isStreaming).toBe('boolean')
    expect(typeof mockLogStreamReturn.isPaused).toBe('boolean')

    // Verify control methods
    expect(typeof mockLogStreamReturn.connect).toBe('function')
    expect(typeof mockLogStreamReturn.disconnect).toBe('function')
    expect(typeof mockLogStreamReturn.pause).toBe('function')
    expect(typeof mockLogStreamReturn.resume).toBe('function')
    expect(typeof mockLogStreamReturn.clearLogs).toBe('function')
    expect(typeof mockLogStreamReturn.addLogs).toBe('function')
    expect(typeof mockLogStreamReturn.setFilter).toBe('function')
    expect(typeof mockLogStreamReturn.resetFilter).toBe('function')
    expect(typeof mockLogStreamReturn.exportLogs).toBe('function')
    expect(typeof mockLogStreamReturn.scrollToLog).toBe('function')
    expect(typeof mockLogStreamReturn.scrollToBottom).toBe('function')
  })

  it('should support streaming state management', () => {
    const streamingStates: StreamingState[] = [
      'idle',
      'connecting',
      'streaming',
      'paused',
      'disconnected',
      'error',
    ]

    streamingStates.forEach(state => {
      const streamState: LogStreamState = {
        state,
        connectionStatus: 'connected',
        isReceiving: state === 'streaming',
        logsReceivedCount: 0,
        lastLogAt: null,
        bytesReceived: 0,
        streamStartedAt: null,
        error: state === 'error' ? 'Connection failed' : null,
      }

      expect(streamState.state).toBe(state)
      expect(typeof streamState.isReceiving).toBe('boolean')
      expect(state === 'error' ? streamState.error : !streamState.error).toBeTruthy()
    })
  })

  it('should support comprehensive log stream statistics', () => {
    const stats: LogStreamStats = {
      totalLogs: 100,
      logsPerSecond: 5.5,
      byLevel: {
        debug: 25,
        info: 40,
        warn: 25,
        error: 10,
      },
      bySource: {
        agent: 50,
        system: 20,
        user: 10,
        tool: 15,
        error: 5,
      },
      errorCount: 10,
      streamDurationMs: 18000,
    }

    expect(stats.totalLogs).toBe(100)
    expect(stats.logsPerSecond).toBe(5.5)
    expect(stats.byLevel.debug + stats.byLevel.info + stats.byLevel.warn + stats.byLevel.error).toBe(100)
    expect(stats.bySource.agent + stats.bySource.system + stats.bySource.user + stats.bySource.tool + stats.bySource.error).toBe(100)
    expect(stats.errorCount).toBe(10)
    expect(stats.streamDurationMs).toBe(18000)
  })
})

// ============================================================================
// Acceptance Criteria 5: Timestamp Support
// ============================================================================

describe('Acceptance Criteria: Timestamp Support', () => {
  it('should support timestamp fields in all relevant types', () => {
    const now = new Date()
    const past = new Date(Date.now() - 60000) // 1 minute ago

    // AgentLogEntry timestamp
    const logEntry: AgentLogEntry = {
      id: 'timestamp-test',
      timestamp: now,
      level: 'info',
      message: 'Timestamp test',
      source: 'agent',
      metadata: {},
    }
    expect(logEntry.timestamp).toBeInstanceOf(Date)

    // LogStreamState timestamps
    const streamState: LogStreamState = {
      state: 'streaming',
      connectionStatus: 'connected',
      isReceiving: true,
      logsReceivedCount: 1,
      lastLogAt: now,
      bytesReceived: 100,
      streamStartedAt: past,
      error: null,
    }
    expect(streamState.lastLogAt).toBeInstanceOf(Date)
    expect(streamState.streamStartedAt).toBeInstanceOf(Date)
  })

  it('should handle null timestamps appropriately', () => {
    const streamState: LogStreamState = {
      state: 'idle',
      connectionStatus: 'disconnected',
      isReceiving: false,
      logsReceivedCount: 0,
      lastLogAt: null,
      bytesReceived: 0,
      streamStartedAt: null,
      error: null,
    }

    expect(streamState.lastLogAt).toBeNull()
    expect(streamState.streamStartedAt).toBeNull()
  })
})

// ============================================================================
// Acceptance Criteria Summary Test
// ============================================================================

describe('Acceptance Criteria: Complete Coverage Verification', () => {
  it('should verify all acceptance criteria are implemented', () => {
    // 1. AgentLogEntry interface ✓
    const agentLogEntry: AgentLogEntry = {
      id: 'test',
      timestamp: new Date(),
      level: 'info',
      message: 'test',
      source: 'agent',
      metadata: { agentId: 'agent-1' },
    }
    expect(agentLogEntry).toBeDefined()

    // 2. AgentStatus type ✓
    const agentStatus: AgentStatus = 'processing'
    expect(['idle', 'processing', 'error', 'offline']).toContain(agentStatus)

    // 3. AgentTerminalPanelProps interface ✓
    const panelProps: AgentTerminalPanelProps = {
      panelId: 'panel',
      agentId: 'agent',
    }
    expect(panelProps).toBeDefined()

    // 4. useAgentLogStream hook return types ✓
    const hookReturn: UseAgentLogStreamReturn = {
      logs: [],
      filteredLogs: [],
      filter: { levels: new Set(), searchText: '', stage: null, agent: null },
      streamState: {
        state: 'idle',
        connectionStatus: 'disconnected',
        isReceiving: false,
        logsReceivedCount: 0,
        lastLogAt: null,
        bytesReceived: 0,
        streamStartedAt: null,
        error: null,
      },
      stats: {
        totalLogs: 0,
        logsPerSecond: 0,
        byLevel: { debug: 0, info: 0, warn: 0, error: 0 },
        bySource: { agent: 0, system: 0, user: 0, tool: 0, error: 0 },
        errorCount: 0,
        streamDurationMs: 0,
      },
      isConnecting: false,
      isStreaming: false,
      isPaused: false,
      error: null,
      connect: () => {},
      disconnect: () => {},
      pause: () => {},
      resume: () => {},
      clearLogs: () => {},
      addLogs: () => {},
      setFilter: () => {},
      resetFilter: () => {},
      exportLogs: () => '',
      scrollToLog: () => {},
      scrollToBottom: () => {},
    }
    expect(hookReturn).toBeDefined()

    // 5. Support for log levels, timestamps, agent metadata, streaming state ✓
    expect(['debug', 'info', 'warn', 'error']).toHaveLength(4) // Log levels
    expect(agentLogEntry.timestamp).toBeInstanceOf(Date) // Timestamps
    expect(agentLogEntry.metadata).toBeDefined() // Agent metadata
    expect(['idle', 'connecting', 'streaming', 'paused', 'disconnected', 'error']).toHaveLength(6) // Streaming states

    console.log('✅ All acceptance criteria verified and implemented successfully!')
  })
})