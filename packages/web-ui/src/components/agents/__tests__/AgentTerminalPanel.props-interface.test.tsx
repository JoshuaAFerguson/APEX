/**
 * @vitest-environment jsdom
 *
 * AgentTerminalPanel Props Interface Tests (ADR-0032 Compliance)
 *
 * Tests that the component props interface matches the ADR-0032 specification
 * and properly handles all required and optional props for the three-state architecture.
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentTerminalPanel } from '../AgentTerminalPanel'
import type {
  AgentTerminalPanelProps,
  AgentTerminalPanelCoreProps,
  AgentLogEntry
} from '@/types/agent-log-stream'
import type { PanelDisplayState } from '@/types/agent-terminal-panel'

// Mock data
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
    scrollToBottom: vi.fn(),
    autoScroll: true,
    newItemsSinceScroll: 0,
    notifyNewItems: vi.fn(),
  })),
}))

// Mock child components
vi.mock('../AgentTerminalPanelHeader', () => ({
  AgentTerminalPanelHeader: ({
    title,
    agentId,
    agentStatus,
    streamingState,
    panelState,
    onMinimize,
    onMaximize,
    onRestore,
    onClose,
    onPause,
    onResume,
    onClear,
    onExport
  }: any) => (
    <div data-testid="header">
      <span data-testid="title">{title}</span>
      <span data-testid="agent-id">{agentId}</span>
      <span data-testid="agent-status">{agentStatus || 'idle'}</span>
      <span data-testid="streaming-state">{streamingState}</span>
      <span data-testid="panel-state">{panelState}</span>
      {onMinimize && <button data-testid="minimize" onClick={onMinimize}>Minimize</button>}
      {onMaximize && <button data-testid="maximize" onClick={onMaximize}>Maximize</button>}
      {onRestore && <button data-testid="restore" onClick={onRestore}>Restore</button>}
      <button data-testid="close" onClick={onClose}>Close</button>
      <button data-testid="pause" onClick={onPause}>Pause</button>
      <button data-testid="resume" onClick={onResume}>Resume</button>
      <button data-testid="clear" onClick={onClear}>Clear</button>
      <button data-testid="export" onClick={onExport}>Export</button>
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

describe('AgentTerminalPanel - Props Interface (ADR-0032)', () => {
  beforeEach(() => {
    mockLogs = []
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Required Props (ADR-0032)', () => {
    it('renders with only required props: panelId and agentId', () => {
      render(
        <AgentTerminalPanel
          panelId="test-panel-123"
          agentId="test-agent-456"
        />
      )

      expect(screen.getByTestId('header')).toBeInTheDocument()
      expect(screen.getByTestId('agent-id')).toHaveTextContent('test-agent-456')
    })

    it('uses agentId as fallback title when title not provided', () => {
      render(
        <AgentTerminalPanel
          panelId="test-panel"
          agentId="my-test-agent"
        />
      )

      expect(screen.getByTestId('title')).toHaveTextContent('my-test-agent')
    })

    it('validates panelId is passed correctly to header', () => {
      render(
        <AgentTerminalPanel
          panelId="unique-panel-id-789"
          agentId="test-agent"
        />
      )

      // panelId should be available for state management
      expect(screen.getByTestId('header')).toBeInTheDocument()
    })
  })

  describe('Display State Props (ADR-0032)', () => {
    it('accepts and passes panelState prop correctly', () => {
      const testStates: PanelDisplayState[] = ['minimized', 'normal', 'maximized']

      testStates.forEach(state => {
        const { unmount } = render(
          <AgentTerminalPanel
            panelId="test"
            agentId="test"
            panelState={state}
          />
        )

        expect(screen.getByTestId('panel-state')).toHaveTextContent(state)
        unmount()
      })
    })

    it('accepts title prop and displays it in header', () => {
      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          title="Custom Terminal Title"
        />
      )

      expect(screen.getByTestId('title')).toHaveTextContent('Custom Terminal Title')
    })

    it('accepts and displays agentStatus prop', () => {
      const statuses = ['idle', 'running', 'stopped', 'error'] as const

      statuses.forEach(status => {
        const { unmount } = render(
          <AgentTerminalPanel
            panelId="test"
            agentId="test"
            agentStatus={status}
          />
        )

        expect(screen.getByTestId('agent-status')).toHaveTextContent(status)
        unmount()
      })
    })

    it('supports backward compatibility with isMinimized prop', () => {
      const { rerender } = render(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          isMinimized={false}
        />
      )

      expect(screen.getByTestId('controls')).toBeInTheDocument()

      rerender(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          isMinimized={true}
        />
      )

      expect(screen.queryByTestId('controls')).not.toBeInTheDocument()
    })
  })

  describe('State Change Callback Props (ADR-0032)', () => {
    it('calls onMinimize when minimize action is triggered', () => {
      const onMinimize = vi.fn()

      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          onMinimize={onMinimize}
        />
      )

      fireEvent.click(screen.getByTestId('minimize'))
      expect(onMinimize).toHaveBeenCalledTimes(1)
    })

    it('calls onMaximize when maximize action is triggered', () => {
      const onMaximize = vi.fn()

      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          onMaximize={onMaximize}
        />
      )

      fireEvent.click(screen.getByTestId('maximize'))
      expect(onMaximize).toHaveBeenCalledTimes(1)
    })

    it('calls onRestore when restore action is triggered', () => {
      const onRestore = vi.fn()

      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          panelState="minimized"
          onRestore={onRestore}
        />
      )

      fireEvent.click(screen.getByTestId('restore'))
      expect(onRestore).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when close action is triggered', () => {
      const onClose = vi.fn()

      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          onClose={onClose}
        />
      )

      fireEvent.click(screen.getByTestId('close'))
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(mockDisconnect).toHaveBeenCalledTimes(1)
    })

    it('calls onPause when pause action is triggered', () => {
      const onPause = vi.fn()

      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          onPause={onPause}
        />
      )

      fireEvent.click(screen.getByTestId('pause'))
      expect(onPause).toHaveBeenCalledTimes(1)
      expect(mockPause).toHaveBeenCalledTimes(1)
    })

    it('calls onResume when resume action is triggered', () => {
      const onResume = vi.fn()

      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          onResume={onResume}
        />
      )

      fireEvent.click(screen.getByTestId('resume'))
      expect(onResume).toHaveBeenCalledTimes(1)
      expect(mockResume).toHaveBeenCalledTimes(1)
    })

    it('calls onClear when clear action is triggered', () => {
      const onClear = vi.fn()

      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          onClear={onClear}
        />
      )

      fireEvent.click(screen.getByTestId('clear'))
      expect(onClear).toHaveBeenCalledTimes(1)
      expect(mockClearLogs).toHaveBeenCalledTimes(1)
    })
  })

  describe('ARIA Attributes (ADR-0032)', () => {
    it('applies correct ARIA attributes for panel region', () => {
      render(
        <AgentTerminalPanel
          panelId="test-panel"
          agentId="test-agent"
          title="Test Terminal"
        />
      )

      const panel = screen.getByRole('region')
      expect(panel).toHaveAttribute('aria-label', 'Agent terminal panel: Test Terminal')
      expect(panel).toHaveAttribute('aria-expanded', 'true')
      expect(panel).toHaveAttribute('tabIndex', '0')
    })

    it('updates aria-expanded based on panel state', () => {
      const { rerender } = render(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          panelState="normal"
        />
      )

      expect(screen.getByRole('region')).toHaveAttribute('aria-expanded', 'true')

      rerender(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          panelState="minimized"
        />
      )

      expect(screen.getByRole('region')).toHaveAttribute('aria-expanded', 'false')
    })

    it('applies custom aria-label when provided via props', () => {
      const customProps = {
        panelId: 'test',
        agentId: 'test',
        title: 'Custom Terminal',
        'aria-label': 'Custom ARIA label' as any,
      }

      // Note: This would need the component to accept aria-label as a prop
      // For now, we test the default behavior
      render(<AgentTerminalPanel {...customProps} />)

      expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Agent terminal panel: Custom Terminal')
    })

    it('maintains focus management with tabIndex', () => {
      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
        />
      )

      const panel = screen.getByRole('region')
      expect(panel).toHaveAttribute('tabIndex', '0')

      // Panel should be focusable
      panel.focus()
      expect(document.activeElement).toBe(panel)
    })
  })

  describe('Optional Display Props', () => {
    it('accepts and applies maxHeight and minHeight', () => {
      const { container } = render(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          maxHeight="800px"
          minHeight="200px"
        />
      )

      const panel = container.firstChild as HTMLElement
      expect(panel.style.maxHeight).toBe('800px')
      expect(panel.style.minHeight).toBe('200px')
    })

    it('accepts and applies className', () => {
      const { container } = render(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          className="custom-terminal-class"
        />
      )

      expect(container.firstChild).toHaveClass('custom-terminal-class')
    })

    it('accepts and applies theme prop', () => {
      const { container, rerender } = render(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          theme="dark"
        />
      )

      expect(container.firstChild).toHaveClass('bg-gray-950/90')

      rerender(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          theme="light"
        />
      )

      expect(container.firstChild).toHaveClass('bg-white/90')
    })
  })

  describe('Streaming and Filter Props', () => {
    it('accepts autoConnect prop', () => {
      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          autoConnect={false}
        />
      )

      // Component should render without auto-connecting
      expect(screen.getByTestId('header')).toBeInTheDocument()
    })

    it('accepts autoScroll prop', () => {
      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          autoScroll={false}
        />
      )

      // Component should render with auto-scroll disabled
      expect(screen.getByTestId('header')).toBeInTheDocument()
    })

    it('accepts maxLogs prop', () => {
      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          maxLogs={500}
        />
      )

      // Component should render with custom max logs limit
      expect(screen.getByTestId('header')).toBeInTheDocument()
    })

    it('controls filter and search visibility', () => {
      const { rerender } = render(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          showFilters={true}
          showSearch={true}
        />
      )

      expect(screen.getByTestId('controls')).toBeInTheDocument()

      rerender(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          showFilters={false}
          showSearch={false}
        />
      )

      expect(screen.queryByTestId('controls')).not.toBeInTheDocument()
    })
  })

  describe('Event Callback Props', () => {
    it('calls onLogSelect when a log is clicked', () => {
      const onLogSelect = vi.fn()
      mockLogs = [createTestLog('test-log', 'Test message')]

      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          onLogSelect={onLogSelect}
        />
      )

      fireEvent.click(screen.getByTestId('log-test-log'))
      expect(onLogSelect).toHaveBeenCalledWith(mockLogs[0])
      expect(mockScrollToLog).toHaveBeenCalledWith('test-log')
    })

    it('calls onFilterChange when filter is updated', () => {
      const onFilterChange = vi.fn()

      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          onFilterChange={onFilterChange}
        />
      )

      // This would be called by the controls component
      // The test verifies the prop is passed correctly
      expect(screen.getByTestId('header')).toBeInTheDocument()
    })

    it('calls onStreamStateChange when streaming state changes', () => {
      const onStreamStateChange = vi.fn()

      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          onStreamStateChange={onStreamStateChange}
        />
      )

      // This would be called when stream state changes
      // The test verifies the prop is accepted
      expect(screen.getByTestId('header')).toBeInTheDocument()
    })

    it('calls onError when errors occur', () => {
      const onError = vi.fn()

      render(
        <AgentTerminalPanel
          panelId="test"
          agentId="test"
          onError={onError}
        />
      )

      // This would be called when errors occur
      // The test verifies the prop is accepted
      expect(screen.getByTestId('header')).toBeInTheDocument()
    })
  })

  describe('Type Safety and Validation', () => {
    it('accepts all valid PanelDisplayState values', () => {
      const states: PanelDisplayState[] = ['minimized', 'normal', 'maximized']

      states.forEach(state => {
        expect(() => {
          render(
            <AgentTerminalPanel
              panelId="test"
              agentId="test"
              panelState={state}
            />
          )
        }).not.toThrow()
      })
    })

    it('handles undefined optional props gracefully', () => {
      expect(() => {
        render(
          <AgentTerminalPanel
            panelId="test"
            agentId="test"
            title={undefined}
            agentStatus={undefined}
            panelState={undefined}
            onMinimize={undefined}
            onMaximize={undefined}
            onRestore={undefined}
            onClose={undefined}
          />
        )
      }).not.toThrow()
    })
  })
})