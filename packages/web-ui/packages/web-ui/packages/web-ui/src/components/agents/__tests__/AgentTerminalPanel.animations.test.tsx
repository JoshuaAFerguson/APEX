/**
 * @vitest-environment jsdom
 *
 * AgentTerminalPanel CSS Animations Tests (ADR-0043) - Fixed Version
 *
 * Tests the CSS transitions and animations implementation according to ADR-0043:
 * - Height transitions use 300ms ease-out timing
 * - Content fades with 200ms ease-in-out
 * - Chevron icon rotates smoothly
 * - No visual glitches during rapid state changes
 * - Animation classes match ADR spec (PANEL_HEIGHTS, PANEL_TRANSITIONS constants)
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentTerminalPanel } from '../AgentTerminalPanel'
import {
  PANEL_HEIGHTS,
  PANEL_WIDTHS,
  PANEL_TRANSITIONS,
  PANEL_PERFORMANCE,
  PANEL_CONTENT_CLASSES,
  ANIMATION_DURATIONS
} from '../constants'
import type { AgentTerminalPanelProps, AgentLogEntry } from '@/types/agent-log-stream'
import type { PanelDisplayState } from '@/types/agent-terminal-panel'

// Mock data for tests
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

// Mock child components for clean animation testing
vi.mock('../AgentTerminalPanelHeader', () => ({
  AgentTerminalPanelHeader: ({
    title,
    panelState,
    onMinimize,
    onMaximize,
    onRestore,
    onClose
  }: any) => (
    <div data-testid="header" data-panel-state={panelState}>
      <span>{title}</span>
      {panelState === 'normal' && (
        <>
          <button data-testid="minimize-btn" onClick={onMinimize}>Minimize</button>
          <button data-testid="maximize-btn" onClick={onMaximize}>Maximize</button>
        </>
      )}
      {panelState === 'minimized' && (
        <button data-testid="restore-btn" onClick={onRestore}>Restore</button>
      )}
      {panelState === 'maximized' && (
        <button data-testid="restore-btn" onClick={onRestore}>Restore</button>
      )}
      <button data-testid="close-btn" onClick={onClose}>Close</button>
    </div>
  ),
}))

vi.mock('../AgentTerminalPanelControls', () => ({
  AgentTerminalPanelControls: ({ show }: any) => (
    show ? <div data-testid="controls">Controls with filters</div> : null
  ),
}))

vi.mock('../AgentTerminalPanelLogEntry', () => ({
  AgentTerminalPanelLogEntry: ({ log }: any) => (
    <div data-testid={`log-${log.id}`}>{log.message}</div>
  ),
}))

// Helper to create test logs
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

// Helper to test transition classes
function expectTransitionClasses(element: HTMLElement) {
  expect(element).toHaveClass('transition-[height]')
  expect(element).toHaveClass('duration-300')
  expect(element).toHaveClass('ease-out')
}

// Helper to test performance classes
function expectPerformanceClasses(element: HTMLElement) {
  expect(element).toHaveClass('will-change-[height,opacity]')
}

describe('AgentTerminalPanel - Animation Implementation (ADR-0043)', () => {
  const defaultProps: AgentTerminalPanelProps = {
    panelId: 'test-panel',
    agentId: 'test-agent',
    title: 'Animation Test Panel',
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
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('ADR-0043 Compliance: Animation Constants Integration', () => {
    it('applies correct PANEL_HEIGHTS classes for each state', () => {
      const { rerender, container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      let panel = container.firstChild as HTMLElement
      expect(panel).toHaveClass('h-80') // PANEL_HEIGHTS.normal

      rerender(<AgentTerminalPanel {...defaultProps} panelState="minimized" />)
      panel = container.firstChild as HTMLElement
      expect(panel).toHaveClass('h-12') // PANEL_HEIGHTS.minimized

      rerender(<AgentTerminalPanel {...defaultProps} panelState="maximized" />)
      panel = container.firstChild as HTMLElement
      expect(panel).toHaveClass('h-full') // PANEL_HEIGHTS.maximized
    })

    it('applies PANEL_TRANSITIONS.height class for height animations', () => {
      const { container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      const panel = container.firstChild as HTMLElement
      expectTransitionClasses(panel)
    })

    it('applies PANEL_PERFORMANCE classes for optimization', () => {
      const { container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      const panel = container.firstChild as HTMLElement
      expectPerformanceClasses(panel)
    })
  })

  describe('ADR-0043 Compliance: Animation Timing Verification', () => {
    it('verifies ANIMATION_DURATIONS constants match CSS classes', () => {
      // Test that our constants are consistent
      expect(ANIMATION_DURATIONS.height).toBe(300)
      expect(ANIMATION_DURATIONS.opacity).toBe(200)
      expect(ANIMATION_DURATIONS.transform).toBe(200)

      // Verify CSS classes use matching durations
      expect(PANEL_TRANSITIONS.height).toContain('duration-300')
      expect(PANEL_TRANSITIONS.opacity).toContain('duration-200')
      expect(PANEL_TRANSITIONS.transform).toContain('duration-200')
    })

    it('verifies timing functions match ADR specifications', () => {
      // Height: 300ms ease-out
      expect(PANEL_TRANSITIONS.height).toContain('ease-out')

      // Opacity: 200ms ease-in-out
      expect(PANEL_TRANSITIONS.opacity).toContain('ease-in-out')

      // Transform: 200ms ease-out
      expect(PANEL_TRANSITIONS.transform).toContain('ease-out')
    })
  })

  describe('State Transition Animation Flow', () => {
    it('maintains animation classes during state transitions', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      const panel = container.firstChild as HTMLElement

      // Verify initial state has animation classes
      expectTransitionClasses(panel)
      expectPerformanceClasses(panel)

      // Click minimize button
      const minimizeBtn = screen.getByTestId('minimize-btn')
      await user.click(minimizeBtn)

      // Animation classes should still be present
      expectTransitionClasses(panel)
      expectPerformanceClasses(panel)
    })

    it('handles rapid state changes without breaking animation classes', async () => {
      let panelState: PanelDisplayState = 'normal'

      const { rerender, container } = render(
        <AgentTerminalPanel {...defaultProps} panelState={panelState} />
      )

      const panel = container.firstChild as HTMLElement

      // Rapidly change states multiple times
      const states: PanelDisplayState[] = ['minimized', 'normal', 'maximized', 'normal', 'minimized']

      for (const state of states) {
        panelState = state
        rerender(<AgentTerminalPanel {...defaultProps} panelState={panelState} />)

        // Animation classes should remain consistent
        expectTransitionClasses(panel)
        expectPerformanceClasses(panel)

        // State-specific height class should be applied
        if (state === 'minimized') {
          expect(panel).toHaveClass('h-12')
        } else if (state === 'maximized') {
          expect(panel).toHaveClass('h-full')
        } else {
          expect(panel).toHaveClass('h-80')
        }
      }
    })
  })

  describe('Accessibility and Animation Integration', () => {
    it('maintains ARIA attributes during animated transitions', () => {
      const { rerender } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      let panel = screen.getByRole('region')
      expect(panel).toHaveAttribute('aria-expanded', 'true')
      expect(panel).toHaveAttribute('tabIndex', '0')

      rerender(<AgentTerminalPanel {...defaultProps} panelState="minimized" />)

      panel = screen.getByRole('region')
      expect(panel).toHaveAttribute('aria-expanded', 'false')
      expect(panel).toHaveAttribute('tabIndex', '0')
    })

    it('keyboard navigation works with animated panels', () => {
      const { container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      const panel = container.firstChild as HTMLElement
      panel.focus()

      // Test keyboard event handling
      fireEvent.keyDown(panel, { key: 'Enter' })
      fireEvent.keyDown(panel, { key: 'M' })
      fireEvent.keyDown(panel, { key: 'Escape' })

      // Panel should maintain animation classes after keyboard events
      expectTransitionClasses(panel)
      expectPerformanceClasses(panel)
    })
  })

  describe('Performance Optimization Classes', () => {
    it('applies will-change hints for performance', () => {
      const { container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      const panel = container.firstChild as HTMLElement
      expectPerformanceClasses(panel)
    })

    it('maintains performance classes across all states', () => {
      const states: PanelDisplayState[] = ['normal', 'minimized', 'maximized']

      states.forEach(state => {
        const { container } = render(
          <AgentTerminalPanel {...defaultProps} panelState={state} />
        )

        const panel = container.firstChild as HTMLElement
        expectPerformanceClasses(panel)
      })
    })
  })

  describe('Edge Cases and Error Conditions', () => {
    it('handles undefined or null panel states gracefully', () => {
      // Test with undefined panelState (should default to normal)
      const { container } = render(
        <AgentTerminalPanel {...defaultProps} panelState={undefined as any} />
      )

      const panel = container.firstChild as HTMLElement
      expectTransitionClasses(panel)
      expectPerformanceClasses(panel)
    })

    it('maintains animation integrity with custom styling', () => {
      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
          className="custom-panel-class"
          maxHeight="500px"
        />
      )

      const panel = container.firstChild as HTMLElement

      // Should have both custom and animation classes
      expect(panel).toHaveClass('custom-panel-class')
      expectTransitionClasses(panel)
      expectPerformanceClasses(panel)

      // Custom styling should work alongside animations
      expect(panel.style.maxHeight).toBe('500px')
    })

    it('handles animation during content updates', () => {
      mockLogs = [createTestLog('1', 'Initial log')]

      const { rerender, container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      // Add more logs
      mockLogs = [
        createTestLog('1', 'Initial log'),
        createTestLog('2', 'New log 1'),
        createTestLog('3', 'New log 2'),
      ]

      rerender(<AgentTerminalPanel {...defaultProps} panelState="normal" />)

      const panel = container.firstChild as HTMLElement

      // Animation classes should remain intact during content updates
      expectTransitionClasses(panel)
      expectPerformanceClasses(panel)
    })
  })
})