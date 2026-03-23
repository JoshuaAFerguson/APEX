/**
 * @vitest-environment jsdom
 *
 * AgentTerminalPanel Transition Integration Tests (ADR-0043)
 *
 * Integration tests for smooth CSS transitions and animations:
 * - Tests complete transition workflows
 * - Verifies timing and coordination between animations
 * - Tests real-world user interaction scenarios
 * - Validates accessibility during transitions
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentTerminalPanel } from '../AgentTerminalPanel'
import {
  PANEL_HEIGHTS,
  PANEL_TRANSITIONS,
  ANIMATION_DURATIONS,
  PANEL_CONTENT_CLASSES
} from '../constants'
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
let mockAutoScroll = true
let mockNewItemsSinceScroll = 0

// Mock functions with transition tracking
const mockConnect = vi.fn()
const mockDisconnect = vi.fn()
const mockSetFilter = vi.fn()
const mockScrollToBottom = vi.fn()
const mockHandleScroll = vi.fn()
const mockNotifyNewItems = vi.fn()

// Track state changes for transition testing
let stateChangeHistory: { state: PanelDisplayState; timestamp: number }[] = []
let transitionCallbacks: { onMinimize?: () => void; onMaximize?: () => void; onRestore?: () => void } = {}

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
      totalLogs: mockLogs.length,
      logsPerSecond: 0,
      byLevel: { debug: 0, info: mockLogs.length, warn: 0, error: 0 },
      bySource: { agent: mockLogs.length, system: 0, user: 0, tool: 0, error: 0 },
      errorCount: 0,
      streamDurationMs: 0,
    },
    isConnecting: false,
    isStreaming: false,
    isPaused: false,
    error: null,
    connect: mockConnect,
    disconnect: mockDisconnect,
    pause: vi.fn(),
    resume: vi.fn(),
    clearLogs: vi.fn(),
    setFilter: mockSetFilter,
    resetFilter: vi.fn(),
    exportLogs: vi.fn(() => '[]'),
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
    isAtBottom: mockAutoScroll,
    setAutoScroll: vi.fn(),
    resetNewItemsCounter: vi.fn(),
    notifyNewItems: mockNotifyNewItems,
  })),
}))

// Enhanced header mock that tracks state changes
vi.mock('../AgentTerminalPanelHeader', () => ({
  AgentTerminalPanelHeader: ({
    title,
    panelState,
    onMinimize,
    onMaximize,
    onRestore,
    onClose
  }: any) => {
    // Track callbacks for transition testing
    transitionCallbacks = { onMinimize, onMaximize, onRestore }

    return (
      <div data-testid="header" data-panel-state={panelState}>
        <span data-testid="header-title">{title}</span>
        {panelState === 'normal' && (
          <>
            <button
              data-testid="minimize-btn"
              onClick={() => {
                stateChangeHistory.push({ state: 'minimized', timestamp: Date.now() })
                onMinimize?.()
              }}
            >
              Minimize
            </button>
            <button
              data-testid="maximize-btn"
              onClick={() => {
                stateChangeHistory.push({ state: 'maximized', timestamp: Date.now() })
                onMaximize?.()
              }}
            >
              Maximize
            </button>
          </>
        )}
        {(panelState === 'minimized' || panelState === 'maximized') && (
          <button
            data-testid="restore-btn"
            onClick={() => {
              stateChangeHistory.push({ state: 'normal', timestamp: Date.now() })
              onRestore?.()
            }}
          >
            Restore
          </button>
        )}
        <button data-testid="close-btn" onClick={onClose}>Close</button>
      </div>
    )
  },
}))

// Mock controls with state tracking
vi.mock('../AgentTerminalPanelControls', () => ({
  AgentTerminalPanelControls: ({ show, filter, onFilterChange }: any) => (
    show ? (
      <div data-testid="controls" data-visible={show}>
        <input
          data-testid="search-input"
          value={filter?.searchText || ''}
          onChange={(e) => onFilterChange?.({ searchText: e.target.value })}
          placeholder="Search logs..."
        />
        <div data-testid="filter-controls">Filter Controls</div>
      </div>
    ) : null
  ),
}))

// Mock log entries
vi.mock('../AgentTerminalPanelLogEntry', () => ({
  AgentTerminalPanelLogEntry: ({ log, isSelected }: any) => (
    <div
      data-testid={`log-${log.id}`}
      data-selected={isSelected}
      className="log-entry"
    >
      {log.message}
    </div>
  ),
}))

// Helper functions
function createTestLog(id: string, message: string, level: 'debug' | 'info' | 'warn' | 'error' = 'info'): AgentLogEntry {
  return {
    id,
    timestamp: new Date(),
    level,
    message,
    source: 'agent',
    metadata: { agentId: 'test' },
  }
}

function expectTransitionClasses(element: HTMLElement) {
  const classes = element.className.split(' ')
  expect(classes).toContain('transition-[height]')
  expect(classes).toContain('duration-300')
  expect(classes).toContain('ease-out')
}

function expectContentAnimationClasses(element: HTMLElement, expanded: boolean) {
  const classes = element.className.split(' ')
  expect(classes).toContain(PANEL_CONTENT_CLASSES.animate)

  if (expanded) {
    expect(classes).toContain('opacity-100')
    expect(classes).toContain('visible')
  } else {
    expect(classes).toContain('opacity-0')
    expect(classes).toContain('invisible')
  }
}

describe('AgentTerminalPanel - Transition Integration Tests (ADR-0043)', () => {
  const defaultProps: AgentTerminalPanelProps = {
    panelId: 'test-panel',
    agentId: 'test-agent',
    title: 'Transition Test Panel',
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
    mockAutoScroll = true
    mockNewItemsSinceScroll = 0
    stateChangeHistory = []
    transitionCallbacks = {}
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Complete Transition Workflows', () => {
    it('handles normal → minimized → normal transition workflow', async () => {
      const user = userEvent.setup()

      // Start with controlled component for transition testing
      let currentState: PanelDisplayState = 'normal'
      const { rerender, container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState={currentState}
          onMinimize={() => { currentState = 'minimized' }}
          onRestore={() => { currentState = 'normal' }}
        />
      )

      // Initial state verification
      let panel = container.firstChild as HTMLElement
      expect(panel).toHaveClass(PANEL_HEIGHTS.normal)
      expectTransitionClasses(panel)

      let contentArea = container.querySelector(`.${PANEL_CONTENT_CLASSES.animate}`)
      expect(contentArea).toHaveAttribute(PANEL_CONTENT_CLASSES.expandedAttr, 'true')
      expectContentAnimationClasses(contentArea as HTMLElement, true)

      // Trigger minimize
      const minimizeBtn = screen.getByTestId('minimize-btn')
      await user.click(minimizeBtn)

      // Update to minimized state
      rerender(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="minimized"
          onRestore={() => { currentState = 'normal' }}
        />
      )

      // Verify minimized state
      panel = container.firstChild as HTMLElement
      expect(panel).toHaveClass(PANEL_HEIGHTS.minimized)
      expectTransitionClasses(panel)

      contentArea = container.querySelector(`.${PANEL_CONTENT_CLASSES.animate}`)
      expect(contentArea).toHaveAttribute(PANEL_CONTENT_CLASSES.expandedAttr, 'false')
      expectContentAnimationClasses(contentArea as HTMLElement, false)

      // Restore to normal
      const restoreBtn = screen.getByTestId('restore-btn')
      await user.click(restoreBtn)

      rerender(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
          onMinimize={() => { currentState = 'minimized' }}
          onMaximize={() => { currentState = 'maximized' }}
        />
      )

      // Verify restored state
      panel = container.firstChild as HTMLElement
      expect(panel).toHaveClass(PANEL_HEIGHTS.normal)
      expectTransitionClasses(panel)

      contentArea = container.querySelector(`.${PANEL_CONTENT_CLASSES.animate}`)
      expect(contentArea).toHaveAttribute(PANEL_CONTENT_CLASSES.expandedAttr, 'true')
      expectContentAnimationClasses(contentArea as HTMLElement, true)
    })

    it('handles normal → maximized → normal transition workflow', async () => {
      const user = userEvent.setup()

      let currentState: PanelDisplayState = 'normal'
      const { rerender, container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState={currentState}
          onMaximize={() => { currentState = 'maximized' }}
          onRestore={() => { currentState = 'normal' }}
        />
      )

      // Initial normal state
      let panel = container.firstChild as HTMLElement
      expect(panel).toHaveClass(PANEL_HEIGHTS.normal)
      expect(panel).not.toHaveClass('col-span-full')

      // Trigger maximize
      const maximizeBtn = screen.getByTestId('maximize-btn')
      await user.click(maximizeBtn)

      // Update to maximized state
      rerender(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="maximized"
          onRestore={() => { currentState = 'normal' }}
        />
      )

      // Verify maximized state
      panel = container.firstChild as HTMLElement
      expect(panel).toHaveClass(PANEL_HEIGHTS.maximized)
      expect(panel).toHaveClass('col-span-full')
      expect(panel).toHaveClass('z-10')

      // Restore to normal
      const restoreBtn = screen.getByTestId('restore-btn')
      await user.click(restoreBtn)

      rerender(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
          onMinimize={() => { currentState = 'minimized' }}
          onMaximize={() => { currentState = 'maximized' }}
        />
      )

      // Verify restored state
      panel = container.firstChild as HTMLElement
      expect(panel).toHaveClass(PANEL_HEIGHTS.normal)
      expect(panel).not.toHaveClass('col-span-full')
      expect(panel).not.toHaveClass('z-10')
    })

    it('handles complex state transition chain', async () => {
      const user = userEvent.setup()

      const stateSequence: PanelDisplayState[] = ['normal', 'minimized', 'normal', 'maximized', 'normal']
      let currentStateIndex = 0

      const { rerender, container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState={stateSequence[currentStateIndex]}
        />
      )

      for (let i = 1; i < stateSequence.length; i++) {
        const currentState = stateSequence[i - 1]
        const nextState = stateSequence[i]

        // Determine which button to click based on transition
        let button: HTMLElement
        if (nextState === 'minimized') {
          button = screen.getByTestId('minimize-btn')
        } else if (nextState === 'maximized') {
          button = screen.getByTestId('maximize-btn')
        } else {
          button = screen.getByTestId('restore-btn')
        }

        await user.click(button)

        // Update to next state
        rerender(
          <AgentTerminalPanel
            {...defaultProps}
            panelState={nextState}
          />
        )

        // Verify transition integrity
        const panel = container.firstChild as HTMLElement
        expectTransitionClasses(panel)
        expect(panel).toHaveClass(PANEL_HEIGHTS[nextState])

        const contentArea = container.querySelector(`.${PANEL_CONTENT_CLASSES.animate}`)
        const shouldBeExpanded = nextState !== 'minimized'
        expect(contentArea).toHaveAttribute(
          PANEL_CONTENT_CLASSES.expandedAttr,
          shouldBeExpanded.toString()
        )
      }
    })
  })

  describe('Animation Timing and Coordination', () => {
    it('coordinates height and opacity transitions properly', async () => {
      mockLogs = [
        createTestLog('1', 'Test content for animation'),
        createTestLog('2', 'More content'),
      ]

      const { rerender, container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      const panel = container.firstChild as HTMLElement
      const contentArea = container.querySelector(`.${PANEL_CONTENT_CLASSES.animate}`)

      // Verify both elements have proper transition classes
      expectTransitionClasses(panel)
      expect(contentArea).toHaveClass(PANEL_CONTENT_CLASSES.animate)

      // Simulate rapid state change
      rerender(<AgentTerminalPanel {...defaultProps} panelState="minimized" />)

      // Both height and opacity should transition together
      expectTransitionClasses(panel)
      expect(contentArea).toHaveClass(PANEL_CONTENT_CLASSES.animate)
      expect(contentArea).toHaveAttribute(PANEL_CONTENT_CLASSES.expandedAttr, 'false')
    })

    it('maintains consistent animation classes during rapid changes', async () => {
      const { rerender, container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      const states: PanelDisplayState[] = ['minimized', 'normal', 'maximized', 'normal', 'minimized']

      // Rapidly cycle through states
      for (const state of states) {
        rerender(<AgentTerminalPanel {...defaultProps} panelState={state} />)

        const panel = container.firstChild as HTMLElement
        const contentArea = container.querySelector(`.${PANEL_CONTENT_CLASSES.animate}`)

        // Animation classes should be consistently applied
        expectTransitionClasses(panel)
        expect(panel).toHaveClass('will-change-[height,opacity]')
        expect(contentArea).toHaveClass(PANEL_CONTENT_CLASSES.animate)
      }
    })

    it('handles animation during content updates', async () => {
      mockLogs = [createTestLog('1', 'Initial log')]

      const { rerender, container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      // Add logs during transition
      mockLogs = [
        createTestLog('1', 'Initial log'),
        createTestLog('2', 'New log during transition'),
        createTestLog('3', 'Another log'),
      ]

      // Trigger state change while adding content
      rerender(<AgentTerminalPanel {...defaultProps} panelState="minimized" />)

      const panel = container.firstChild as HTMLElement
      const contentArea = container.querySelector(`.${PANEL_CONTENT_CLASSES.animate}`)

      // Animation should work despite content changes
      expectTransitionClasses(panel)
      expect(contentArea).toHaveAttribute(PANEL_CONTENT_CLASSES.expandedAttr, 'false')
    })
  })

  describe('Real-World User Interaction Scenarios', () => {
    it('handles user scrolling during panel transitions', async () => {
      const user = userEvent.setup()
      mockLogs = Array.from({ length: 20 }, (_, i) =>
        createTestLog(`log-${i}`, `Log entry ${i + 1}`)
      )

      const { rerender, container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      // Simulate user scroll
      const scrollContainer = container.querySelector('.overflow-y-auto')
      if (scrollContainer) {
        fireEvent.scroll(scrollContainer, { target: { scrollTop: 100 } })
      }

      // Transition state while scrolled
      rerender(<AgentTerminalPanel {...defaultProps} panelState="maximized" />)

      const panel = container.firstChild as HTMLElement
      expectTransitionClasses(panel)
      expect(panel).toHaveClass(PANEL_HEIGHTS.maximized)
    })

    it('handles filter changes during panel transitions', async () => {
      const user = userEvent.setup()
      mockLogs = [
        createTestLog('1', 'Error log', 'error'),
        createTestLog('2', 'Info log', 'info'),
      ]

      const { rerender, container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" showFilters={true} />
      )

      // Start filter change
      const searchInput = screen.getByTestId('search-input')
      await user.type(searchInput, 'error')

      // Transition panel state during filtering
      rerender(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="maximized"
          showFilters={true}
        />
      )

      const panel = container.firstChild as HTMLElement
      expectTransitionClasses(panel)
      expect(panel).toHaveClass(PANEL_HEIGHTS.maximized)

      // Filter should still work
      expect(mockSetFilter).toHaveBeenCalledWith({ searchText: 'error' })
    })

    it('handles auto-scroll interactions during transitions', async () => {
      const user = userEvent.setup()
      mockAutoScroll = false
      mockNewItemsSinceScroll = 3

      const { rerender, container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      // Should show new logs button
      const newLogsButton = screen.getByText('3 new logs')
      expect(newLogsButton).toBeInTheDocument()

      // Click new logs button during transition
      await user.click(newLogsButton)

      // Transition state
      rerender(<AgentTerminalPanel {...defaultProps} panelState="minimized" />)

      const panel = container.firstChild as HTMLElement
      expectTransitionClasses(panel)
      expect(mockScrollToBottom).toHaveBeenCalled()
    })
  })

  describe('Accessibility During Transitions', () => {
    it('maintains ARIA attributes during animated transitions', () => {
      const { rerender } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      let panel = screen.getByRole('region')
      expect(panel).toHaveAttribute('aria-expanded', 'true')
      expect(panel).toHaveAttribute('aria-label', 'Agent terminal panel: Transition Test Panel')

      rerender(<AgentTerminalPanel {...defaultProps} panelState="minimized" />)

      panel = screen.getByRole('region')
      expect(panel).toHaveAttribute('aria-expanded', 'false')
      expect(panel).toHaveAttribute('aria-label', 'Agent terminal panel: Transition Test Panel')

      rerender(<AgentTerminalPanel {...defaultProps} panelState="maximized" />)

      panel = screen.getByRole('region')
      expect(panel).toHaveAttribute('aria-expanded', 'true')
    })

    it('preserves keyboard navigation during transitions', async () => {
      const user = userEvent.setup()
      const { rerender, container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      const panel = container.firstChild as HTMLElement
      panel.focus()
      expect(document.activeElement).toBe(panel)

      // Keyboard event during transition
      await user.keyboard('{Enter}')

      // Transition state
      rerender(<AgentTerminalPanel {...defaultProps} panelState="minimized" />)

      // Focus should be maintained and panel should still be interactive
      expect(panel).toHaveAttribute('tabIndex', '0')

      // Additional keyboard navigation should work
      await user.keyboard('{Enter}')
      await user.keyboard('{Escape}')
    })

    it('handles screen reader announcements during transitions', () => {
      const { rerender, container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      let contentArea = container.querySelector(`.${PANEL_CONTENT_CLASSES.animate}`)
      expect(contentArea).toHaveAttribute('aria-hidden', 'false')

      rerender(<AgentTerminalPanel {...defaultProps} panelState="minimized" />)

      contentArea = container.querySelector(`.${PANEL_CONTENT_CLASSES.animate}`)
      expect(contentArea).toHaveAttribute('aria-hidden', 'true')
    })
  })

  describe('Performance During Transitions', () => {
    it('maintains performance optimization classes during all transitions', () => {
      const states: PanelDisplayState[] = ['normal', 'minimized', 'maximized', 'normal']

      states.forEach(state => {
        const { container } = render(
          <AgentTerminalPanel {...defaultProps} panelState={state} />
        )

        const panel = container.firstChild as HTMLElement
        expect(panel).toHaveClass('will-change-[height,opacity]')
      })
    })

    it('handles large content sets during transitions smoothly', () => {
      // Create large content set
      mockLogs = Array.from({ length: 500 }, (_, i) =>
        createTestLog(`large-${i}`, `Large content log entry ${i + 1}`)
      )

      const { rerender, container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      const panel = container.firstChild as HTMLElement
      expectTransitionClasses(panel)

      // Transition with large content
      rerender(<AgentTerminalPanel {...defaultProps} panelState="minimized" />)

      expectTransitionClasses(panel)
      expect(panel).toHaveClass('will-change-[height,opacity]')
    })
  })

  describe('Error Conditions During Transitions', () => {
    it('handles stream errors during panel transitions', () => {
      mockStreamState.error = 'Connection failed'

      const { rerender, container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      // Should show error state
      expect(screen.getByText('Stream Error')).toBeInTheDocument()

      // Transition should still work despite error
      rerender(<AgentTerminalPanel {...defaultProps} panelState="minimized" />)

      const panel = container.firstChild as HTMLElement
      expectTransitionClasses(panel)
    })

    it('handles malformed state transitions gracefully', () => {
      const { rerender, container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      // Attempt invalid state transition
      rerender(<AgentTerminalPanel {...defaultProps} panelState={'invalid' as any} />)

      const panel = container.firstChild as HTMLElement
      expectTransitionClasses(panel)
    })

    it('maintains animation integrity during prop updates', () => {
      const { rerender, container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
          maxHeight="400px"
        />
      )

      let panel = container.firstChild as HTMLElement
      expectTransitionClasses(panel)
      expect(panel.style.maxHeight).toBe('400px')

      // Update props during transition
      rerender(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="minimized"
          maxHeight="500px"
          className="updated-class"
        />
      )

      panel = container.firstChild as HTMLElement
      expectTransitionClasses(panel)
      expect(panel).toHaveClass('updated-class')
    })
  })
})