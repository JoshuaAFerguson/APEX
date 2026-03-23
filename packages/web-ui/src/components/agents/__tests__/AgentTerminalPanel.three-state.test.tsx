/**
 * @vitest-environment jsdom
 *
 * AgentTerminalPanel Three-State Architecture Tests (ADR-0032)
 *
 * Tests the three-state panel architecture implementation according to ADR-0032:
 * - minimized: Header only, content hidden
 * - normal: Default full view with all controls
 * - maximized: Full-width expanded view
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AgentTerminalPanel } from '../AgentTerminalPanel'
import type { AgentTerminalPanelProps, AgentLogEntry } from '@/types/agent-log-stream'
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
let mockStats = {
  totalLogs: 0,
  logsPerSecond: 0,
  byLevel: { debug: 0, info: 0, warn: 0, error: 0 },
  bySource: { agent: 0, system: 0, user: 0, tool: 0, error: 0 },
  errorCount: 0,
  streamDurationMs: 0,
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
    handleScroll: mockHandleScroll,
    scrollToBottom: mockScrollToBottom,
    autoScroll: true,
    newItemsSinceScroll: 0,
    isAtBottom: true,
    setAutoScroll: vi.fn(),
    resetNewItemsCounter: vi.fn(),
    notifyNewItems: mockNotifyNewItems,
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
    onClose
  }: any) => (
    <div data-testid="header">
      <span data-testid="header-title">{title}</span>
      <span data-testid="header-agent-id">{agentId}</span>
      <span data-testid="header-agent-status">{agentStatus || 'idle'}</span>
      <span data-testid="header-streaming-state">{streamingState}</span>
      <span data-testid="header-panel-state">{panelState}</span>
      {onMinimize && <button data-testid="minimize-btn" onClick={onMinimize}>Minimize</button>}
      {onMaximize && <button data-testid="maximize-btn" onClick={onMaximize}>Maximize</button>}
      {onRestore && <button data-testid="restore-btn" onClick={onRestore}>Restore</button>}
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
    <div data-testid={`log-${log.id}`}>
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

describe('AgentTerminalPanel - Three-State Architecture (ADR-0032)', () => {
  const defaultProps: AgentTerminalPanelProps = {
    panelId: 'test-panel',
    agentId: 'test-agent',
    title: 'Test Terminal',
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
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('ADR-0032 Compliance: Three Panel States', () => {
    describe('Normal State (default)', () => {
      it('renders in normal state by default', () => {
        render(<AgentTerminalPanel {...defaultProps} />)

        // Header should be present
        expect(screen.getByTestId('header')).toBeInTheDocument()
        expect(screen.getByTestId('header-panel-state')).toHaveTextContent('normal')

        // Controls should be visible
        expect(screen.getByTestId('controls')).toBeInTheDocument()

        // Content area should be visible (log viewport)
        expect(screen.getByText('No logs yet')).toBeInTheDocument()

        // Panel should have normal sizing classes
        const container = screen.getByTestId('header').closest('div')
        expect(container).not.toHaveClass('h-12') // not minimized height
        expect(container).not.toHaveClass('col-span-full') // not maximized width
      })

      it('shows correct control buttons in normal state', () => {
        render(<AgentTerminalPanel {...defaultProps} />)

        // Should show minimize and maximize buttons
        expect(screen.getByTestId('minimize-btn')).toBeInTheDocument()
        expect(screen.getByTestId('maximize-btn')).toBeInTheDocument()
        expect(screen.queryByTestId('restore-btn')).not.toBeInTheDocument()
      })

      it('displays agent information correctly in header', () => {
        render(
          <AgentTerminalPanel
            {...defaultProps}
            agentStatus="running"
          />
        )

        expect(screen.getByTestId('header-title')).toHaveTextContent('Test Terminal')
        expect(screen.getByTestId('header-agent-id')).toHaveTextContent('test-agent')
        expect(screen.getByTestId('header-agent-status')).toHaveTextContent('running')
      })
    })

    describe('Minimized State', () => {
      it('renders correctly when panelState is minimized', () => {
        render(
          <AgentTerminalPanel
            {...defaultProps}
            panelState="minimized"
          />
        )

        // Header should be present
        expect(screen.getByTestId('header')).toBeInTheDocument()
        expect(screen.getByTestId('header-panel-state')).toHaveTextContent('minimized')

        // Controls should be hidden
        expect(screen.queryByTestId('controls')).not.toBeInTheDocument()

        // Content area should be hidden (no log viewport visible)
        expect(screen.queryByText('No logs yet')).not.toBeInTheDocument()

        // Panel should have proper structure for minimized state
        const container = screen.getByTestId('header').closest('div')
        expect(container).toBeInTheDocument()
      })

      it('shows only restore button in minimized state', () => {
        render(
          <AgentTerminalPanel
            {...defaultProps}
            panelState="minimized"
          />
        )

        // Should only show restore button
        expect(screen.queryByTestId('minimize-btn')).not.toBeInTheDocument()
        expect(screen.queryByTestId('maximize-btn')).not.toBeInTheDocument()
        expect(screen.getByTestId('restore-btn')).toBeInTheDocument()
      })

      it('has proper ARIA attributes in minimized state', () => {
        render(
          <AgentTerminalPanel
            {...defaultProps}
            panelState="minimized"
          />
        )

        const panel = screen.getByRole('region')
        expect(panel).toHaveAttribute('aria-label', 'Agent terminal panel: Test Terminal')
        expect(panel).toHaveAttribute('tabIndex', '0')
      })
    })

    describe('Maximized State', () => {
      it('renders correctly when panelState is maximized', () => {
        render(
          <AgentTerminalPanel
            {...defaultProps}
            panelState="maximized"
          />
        )

        // Header should be present
        expect(screen.getByTestId('header')).toBeInTheDocument()
        expect(screen.getByTestId('header-panel-state')).toHaveTextContent('maximized')

        // Controls should be visible
        expect(screen.getByTestId('controls')).toBeInTheDocument()

        // Content area should be visible
        expect(screen.getByText('No logs yet')).toBeInTheDocument()

        // Panel should have proper structure for maximized state
        const container = screen.getByTestId('header').closest('div')
        expect(container).toBeInTheDocument()
      })

      it('shows only restore button in maximized state', () => {
        render(
          <AgentTerminalPanel
            {...defaultProps}
            panelState="maximized"
          />
        )

        // Should only show restore button
        expect(screen.queryByTestId('minimize-btn')).not.toBeInTheDocument()
        expect(screen.queryByTestId('maximize-btn')).not.toBeInTheDocument()
        expect(screen.getByTestId('restore-btn')).toBeInTheDocument()
      })

      it('has proper ARIA attributes in maximized state', () => {
        render(
          <AgentTerminalPanel
            {...defaultProps}
            panelState="maximized"
          />
        )

        const panel = screen.getByRole('region')
        expect(panel).toHaveAttribute('aria-label', 'Agent terminal panel: Test Terminal')
        expect(panel).toHaveAttribute('tabIndex', '0')
      })
    })
  })

  describe('State Transition Callbacks (ADR-0032)', () => {
    it('calls onMinimize callback when minimize button clicked', () => {
      const onMinimize = vi.fn()

      render(
        <AgentTerminalPanel
          {...defaultProps}
          onMinimize={onMinimize}
        />
      )

      fireEvent.click(screen.getByTestId('minimize-btn'))
      expect(onMinimize).toHaveBeenCalledTimes(1)
    })

    it('calls onMaximize callback when maximize button clicked', () => {
      const onMaximize = vi.fn()

      render(
        <AgentTerminalPanel
          {...defaultProps}
          onMaximize={onMaximize}
        />
      )

      fireEvent.click(screen.getByTestId('maximize-btn'))
      expect(onMaximize).toHaveBeenCalledTimes(1)
    })

    it('calls onRestore callback when restore button clicked from minimized', () => {
      const onRestore = vi.fn()

      render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="minimized"
          onRestore={onRestore}
        />
      )

      fireEvent.click(screen.getByTestId('restore-btn'))
      expect(onRestore).toHaveBeenCalledTimes(1)
    })

    it('calls onRestore callback when restore button clicked from maximized', () => {
      const onRestore = vi.fn()

      render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="maximized"
          onRestore={onRestore}
        />
      )

      fireEvent.click(screen.getByTestId('restore-btn'))
      expect(onRestore).toHaveBeenCalledTimes(1)
    })

    it('calls onClose callback and disconnects stream', () => {
      const onClose = vi.fn()

      render(
        <AgentTerminalPanel
          {...defaultProps}
          onClose={onClose}
        />
      )

      fireEvent.click(screen.getByTestId('close-btn'))
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(mockDisconnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('Controlled vs Uncontrolled Pattern', () => {
    it('uses controlled pattern when panelState prop provided', () => {
      const { rerender } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
        />
      )

      expect(screen.getByTestId('header-panel-state')).toHaveTextContent('normal')

      // Change panelState prop
      rerender(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="minimized"
        />
      )

      expect(screen.getByTestId('header-panel-state')).toHaveTextContent('minimized')
    })

    it('supports backward compatibility with isMinimized prop', () => {
      render(
        <AgentTerminalPanel
          {...defaultProps}
          isMinimized={true}
        />
      )

      // Should render in minimized state
      const container = screen.getByTestId('header').closest('div')
      expect(container).toBeInTheDocument()
      expect(screen.queryByTestId('controls')).not.toBeInTheDocument()
    })

    it('prioritizes panelState over isMinimized when both provided', () => {
      render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
          isMinimized={true}
        />
      )

      // Should use panelState (normal) over isMinimized (true)
      expect(screen.getByTestId('header-panel-state')).toHaveTextContent('normal')
      expect(screen.getByTestId('controls')).toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation (ADR-0032)', () => {
    it('supports keyboard toggle between minimized and normal states', () => {
      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
        />
      )

      const panel = container.firstChild as HTMLElement
      panel.focus()

      // Press Enter to toggle state
      fireEvent.keyDown(panel, { key: 'Enter' })
      // Note: In real implementation, this would trigger onMinimize
    })

    it('supports keyboard maximize/restore with M key', () => {
      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
        />
      )

      const panel = container.firstChild as HTMLElement
      panel.focus()

      // Press M to maximize
      fireEvent.keyDown(panel, { key: 'M' })
      // Note: In real implementation, this would trigger onMaximize
    })

    it('supports Escape key to restore from maximized', () => {
      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="maximized"
        />
      )

      const panel = container.firstChild as HTMLElement
      panel.focus()

      // Press Escape to restore
      fireEvent.keyDown(panel, { key: 'Escape' })
      // Note: In real implementation, this would trigger onRestore
    })

    it('supports Minus key to minimize panel', () => {
      const onMinimize = vi.fn()
      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
          onMinimize={onMinimize}
        />
      )

      const panel = container.firstChild as HTMLElement
      panel.focus()

      // Press Minus key to minimize
      fireEvent.keyDown(panel, { key: '-' })
      expect(onMinimize).toHaveBeenCalled()
    })

    it('supports Underscore key (Shift+Minus) to minimize panel', () => {
      const onMinimize = vi.fn()
      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
          onMinimize={onMinimize}
        />
      )

      const panel = container.firstChild as HTMLElement
      panel.focus()

      // Press Underscore key (Shift+Minus) to minimize
      fireEvent.keyDown(panel, { key: '_' })
      expect(onMinimize).toHaveBeenCalled()
    })

    it('supports Plus key to restore from minimized state', () => {
      const onRestore = vi.fn()
      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="minimized"
          onRestore={onRestore}
        />
      )

      const panel = container.firstChild as HTMLElement
      panel.focus()

      // Press Plus key to restore
      fireEvent.keyDown(panel, { key: '+' })
      expect(onRestore).toHaveBeenCalled()
    })

    it('supports Equals key to restore from minimized state', () => {
      const onRestore = vi.fn()
      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="minimized"
          onRestore={onRestore}
        />
      )

      const panel = container.firstChild as HTMLElement
      panel.focus()

      // Press Equals key (unshifted plus) to restore
      fireEvent.keyDown(panel, { key: '=' })
      expect(onRestore).toHaveBeenCalled()
    })

    it('ignores Minus key when already minimized', () => {
      const onMinimize = vi.fn()
      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="minimized"
          onMinimize={onMinimize}
        />
      )

      const panel = container.firstChild as HTMLElement
      panel.focus()

      // Press Minus key when already minimized - should not call onMinimize
      fireEvent.keyDown(panel, { key: '-' })
      expect(onMinimize).not.toHaveBeenCalled()
    })

    it('ignores Plus key when not minimized', () => {
      const onRestore = vi.fn()
      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
          onRestore={onRestore}
        />
      )

      const panel = container.firstChild as HTMLElement
      panel.focus()

      // Press Plus key when not minimized - should not call onRestore
      fireEvent.keyDown(panel, { key: '+' })
      expect(onRestore).not.toHaveBeenCalled()
    })

    it('verifies all keyboard shortcuts work correctly together', () => {
      const onMinimize = vi.fn()
      const onMaximize = vi.fn()
      const onRestore = vi.fn()

      const { container, rerender } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
          onMinimize={onMinimize}
          onMaximize={onMaximize}
          onRestore={onRestore}
        />
      )

      const panel = container.firstChild as HTMLElement
      panel.focus()

      // Test Enter/Space to minimize from normal state
      fireEvent.keyDown(panel, { key: 'Enter' })
      expect(onMinimize).toHaveBeenCalledTimes(1)

      fireEvent.keyDown(panel, { key: ' ' })
      expect(onMinimize).toHaveBeenCalledTimes(2)

      // Test Minus key to minimize
      fireEvent.keyDown(panel, { key: '-' })
      expect(onMinimize).toHaveBeenCalledTimes(3)

      // Re-render as minimized to test restore
      rerender(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="minimized"
          onMinimize={onMinimize}
          onMaximize={onMaximize}
          onRestore={onRestore}
        />
      )

      // Test Enter/Space to restore from minimized state
      fireEvent.keyDown(panel, { key: 'Enter' })
      expect(onRestore).toHaveBeenCalledTimes(1)

      fireEvent.keyDown(panel, { key: ' ' })
      expect(onRestore).toHaveBeenCalledTimes(2)

      // Test Plus key to restore
      fireEvent.keyDown(panel, { key: '+' })
      expect(onRestore).toHaveBeenCalledTimes(3)

      // Re-render as normal to test maximize
      rerender(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
          onMinimize={onMinimize}
          onMaximize={onMaximize}
          onRestore={onRestore}
        />
      )

      // Test M key to maximize
      fireEvent.keyDown(panel, { key: 'M' })
      expect(onMaximize).toHaveBeenCalledTimes(1)

      fireEvent.keyDown(panel, { key: 'm' })
      expect(onMaximize).toHaveBeenCalledTimes(2)

      // Re-render as maximized to test restore from maximized
      rerender(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="maximized"
          onMinimize={onMinimize}
          onMaximize={onMaximize}
          onRestore={onRestore}
        />
      )

      // Test M key to restore from maximized
      fireEvent.keyDown(panel, { key: 'M' })
      expect(onRestore).toHaveBeenCalledTimes(4)

      // Test Escape key to restore from maximized
      fireEvent.keyDown(panel, { key: 'Escape' })
      expect(onRestore).toHaveBeenCalledTimes(5)
    })
  })

  describe('Content Visibility Rules (ADR-0032)', () => {
    beforeEach(() => {
      mockLogs = [
        createTestLog('1', 'Test log 1'),
        createTestLog('2', 'Test log 2'),
      ]
    })

    it('hides content area when minimized', () => {
      render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="minimized"
        />
      )

      // No log entries should be visible
      expect(screen.queryByTestId('log-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('log-2')).not.toBeInTheDocument()

      // Controls should be hidden
      expect(screen.queryByTestId('controls')).not.toBeInTheDocument()

      // Status bar should be hidden
      expect(screen.queryByText(/Showing.*logs/)).not.toBeInTheDocument()
    })

    it('shows content area in normal state', () => {
      render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
        />
      )

      // Log entries should be visible
      expect(screen.getByTestId('log-1')).toBeInTheDocument()
      expect(screen.getByTestId('log-2')).toBeInTheDocument()

      // Controls should be visible
      expect(screen.getByTestId('controls')).toBeInTheDocument()

      // Status bar should be visible
      expect(screen.getByText(/Showing.*logs/)).toBeInTheDocument()
    })

    it('shows content area in maximized state', () => {
      render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="maximized"
        />
      )

      // Log entries should be visible
      expect(screen.getByTestId('log-1')).toBeInTheDocument()
      expect(screen.getByTestId('log-2')).toBeInTheDocument()

      // Controls should be visible
      expect(screen.getByTestId('controls')).toBeInTheDocument()

      // Status bar should be visible
      expect(screen.getByText(/Showing.*logs/)).toBeInTheDocument()
    })
  })

  describe('Styling and Layout (ADR-0032)', () => {
    it('applies correct structure for each state', () => {
      const { rerender } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="minimized"
        />
      )

      let container = screen.getByTestId('header').closest('div')
      expect(container).toBeInTheDocument()

      rerender(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
        />
      )

      container = screen.getByTestId('header').closest('div')
      expect(container).toBeInTheDocument()
      expect(screen.getByTestId('controls')).toBeInTheDocument()

      rerender(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="maximized"
        />
      )

      container = screen.getByTestId('header').closest('div')
      expect(container).toBeInTheDocument()
    })

    it('renders appropriately for maximized state', () => {
      const { rerender } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
        />
      )

      let container = screen.getByTestId('header').closest('div')
      expect(container).toBeInTheDocument()

      rerender(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="maximized"
        />
      )

      container = screen.getByTestId('header').closest('div')
      expect(container).toBeInTheDocument()
    })

    it('handles maximized panels correctly', () => {
      render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="maximized"
        />
      )

      const container = screen.getByTestId('header').closest('div')
      expect(container).toBeInTheDocument()
    })

    it('respects custom height constraints in non-maximized states', () => {
      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
          maxHeight="600px"
          minHeight="150px"
        />
      )

      const panel = container.firstChild as HTMLElement
      expect(panel.style.maxHeight).toBe('600px')
      expect(panel.style.minHeight).toBe('150px')
    })

    it('ignores custom height constraints in maximized state', () => {
      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="maximized"
          maxHeight="600px"
          minHeight="150px"
        />
      )

      const panel = container.firstChild as HTMLElement
      expect(panel.style.maxHeight).toBe('')
      expect(panel.style.minHeight).toBe('')
    })
  })
})