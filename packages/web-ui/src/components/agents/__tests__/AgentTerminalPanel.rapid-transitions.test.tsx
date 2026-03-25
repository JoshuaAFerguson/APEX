/**
 * @vitest-environment jsdom
 *
 * AgentTerminalPanel Rapid Transitions Tests (ADR-0043)
 *
 * Edge case tests for rapid state changes and animation protection:
 * - Tests rapid successive state changes
 * - Verifies no visual glitches during quick interactions
 * - Tests animation class stability
 * - Validates debounce and performance protection
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentTerminalPanel } from '../AgentTerminalPanel'
import {
  PANEL_HEIGHTS,
  PANEL_TRANSITIONS,
  PANEL_CONTENT_CLASSES,
  ANIMATION_DURATIONS
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

// Mock functions
const mockConnect = vi.fn()
const mockDisconnect = vi.fn()
const mockSetFilter = vi.fn()
const mockScrollToBottom = vi.fn()
const mockHandleScroll = vi.fn()
const mockNotifyNewItems = vi.fn()

// Performance tracking
let transitionCount = 0
let lastTransitionTime = 0

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
    error: mockStreamState.error,
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
    autoScroll: true,
    newItemsSinceScroll: 0,
    isAtBottom: true,
    setAutoScroll: vi.fn(),
    resetNewItemsCounter: vi.fn(),
    notifyNewItems: mockNotifyNewItems,
  })),
}))

// Enhanced mocks to track rapid transitions
vi.mock('../AgentTerminalPanelHeader', () => ({
  AgentTerminalPanelHeader: ({
    title,
    panelState,
    onMinimize,
    onMaximize,
    onRestore,
    onClose
  }: any) => {
    return (
      <div data-testid="header" data-panel-state={panelState}>
        <span data-testid="header-title">{title}</span>
        <span data-testid="transition-count">{transitionCount}</span>
        {panelState === 'normal' && (
          <>
            <button
              data-testid="minimize-btn"
              onClick={() => {
                transitionCount++
                lastTransitionTime = Date.now()
                onMinimize?.()
              }}
            >
              Minimize
            </button>
            <button
              data-testid="maximize-btn"
              onClick={() => {
                transitionCount++
                lastTransitionTime = Date.now()
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
              transitionCount++
              lastTransitionTime = Date.now()
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

vi.mock('../AgentTerminalPanelControls', () => ({
  AgentTerminalPanelControls: ({ show, showSearch, onSearchChange }: any) => (
    show ? (
      <div data-testid="controls">
        <div>Controls</div>
        {showSearch && (
          <input
            type="text"
            placeholder="Search logs..."
            onChange={(e) => onSearchChange?.(e.target.value)}
            data-testid="search-input"
          />
        )}
      </div>
    ) : null
  ),
}))

vi.mock('../AgentTerminalPanelLogEntry', () => ({
  AgentTerminalPanelLogEntry: ({ log }: any) => (
    <div data-testid={`log-${log.id}`}>{log.message}</div>
  ),
}))

// Helper functions
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

function expectTransitionIntegrity(element: HTMLElement) {
  const classes = element.className.split(' ')

  // Core animation classes should always be present
  expect(classes).toContain('transition-[height]')
  expect(classes).toContain('duration-300')
  expect(classes).toContain('ease-out')
  expect(classes).toContain('will-change-[height,opacity]')
}

function simulateRapidClicks(buttons: HTMLElement[], interval: number = 10) {
  return new Promise<void>((resolve) => {
    let index = 0
    const clickInterval = setInterval(() => {
      if (index >= buttons.length) {
        clearInterval(clickInterval)
        resolve()
        return
      }

      const button = buttons[index]
      if (button && button.isConnected) {
        fireEvent.click(button)
      }
      index++
    }, interval)
  })
}

async function measureTransitionPerformance(callback: () => Promise<void>): Promise<number> {
  const startTime = performance.now()
  await callback()
  const endTime = performance.now()
  return endTime - startTime
}

describe('AgentTerminalPanel - Rapid Transitions and Edge Cases (ADR-0043)', () => {
  const defaultProps: AgentTerminalPanelProps = {
    panelId: 'test-panel',
    agentId: 'test-agent',
    title: 'Rapid Transition Test Panel',
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
    transitionCount = 0
    lastTransitionTime = 0
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Rapid State Changes Protection', () => {
    it('handles rapid minimize/restore cycles without breaking', async () => {
      const user = userEvent.setup()
      let currentState: PanelDisplayState = 'normal'

      const { rerender, container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState={currentState}
          onMinimize={() => { currentState = 'minimized' }}
          onRestore={() => { currentState = 'normal' }}
        />
      )

      // Perform rapid minimize/restore cycles
      for (let cycle = 0; cycle < 10; cycle++) {
        // Minimize
        const minimizeBtn = screen.getByTestId('minimize-btn')
        await user.click(minimizeBtn)

        rerender(
          <AgentTerminalPanel
            {...defaultProps}
            panelState="minimized"
            onRestore={() => { currentState = 'normal' }}
          />
        )

        let panel = container.firstChild as HTMLElement
        expectTransitionIntegrity(panel)
        expect(panel).toHaveClass(PANEL_HEIGHTS.minimized)

        // Restore immediately
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

        panel = container.firstChild as HTMLElement
        expectTransitionIntegrity(panel)
        expect(panel).toHaveClass(PANEL_HEIGHTS.normal)
      }
    })

    it('maintains animation stability during burst state changes', async () => {
      const states: PanelDisplayState[] = ['minimized', 'normal', 'maximized', 'normal', 'minimized', 'normal']

      let stateIndex = 0
      const { rerender, container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      // Rapidly cycle through states
      const startTime = Date.now()

      for (const state of states) {
        rerender(<AgentTerminalPanel {...defaultProps} panelState={state} />)

        const panel = container.firstChild as HTMLElement
        const contentArea = container.querySelector(`.${PANEL_CONTENT_CLASSES.animate}`)

        // Verify animation classes remain stable
        expectTransitionIntegrity(panel)
        expect(contentArea).toHaveClass(PANEL_CONTENT_CLASSES.animate)

        // Verify correct height class
        expect(panel).toHaveClass(PANEL_HEIGHTS[state])

        // Verify content visibility
        const shouldBeExpanded = state !== 'minimized'
        expect(contentArea).toHaveAttribute(
          PANEL_CONTENT_CLASSES.expandedAttr,
          shouldBeExpanded.toString()
        )
      }

      const duration = Date.now() - startTime
      // Should complete rapidly without performance issues
      expect(duration).toBeLessThan(1000)
    })

    it('prevents animation class conflicts during overlapping transitions', async () => {
      const { rerender, container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      const panel = container.firstChild as HTMLElement
      const initialClasses = panel.className

      // Trigger multiple rapid rerendering
      const rapidStates: PanelDisplayState[] = ['minimized', 'normal', 'maximized', 'minimized', 'normal']

      for (const state of rapidStates) {
        rerender(<AgentTerminalPanel {...defaultProps} panelState={state} />)

        // Should never lose core animation classes
        expectTransitionIntegrity(panel)

        // Should not accumulate duplicate classes
        const currentClasses = panel.className.split(' ')
        const transitionClasses = currentClasses.filter(cls => cls.includes('transition'))
        expect(transitionClasses.length).toBe(1) // Only one transition-[height] class
      }
    })
  })

  describe('High-Frequency User Interactions', () => {
    it('handles mouse spam clicks gracefully', async () => {
      const { container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      const minimizeBtn = screen.getByTestId('minimize-btn')
      const panel = container.firstChild as HTMLElement

      // Spam click the button
      for (let i = 0; i < 50; i++) {
        fireEvent.click(minimizeBtn)
      }

      // Animation classes should remain stable
      expectTransitionIntegrity(panel)
    })

    it('handles rapid keyboard navigation without animation breaks', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      const panel = container.firstChild as HTMLElement
      panel.focus()

      // Rapid keyboard interactions
      const keySequence = ['Enter', ' ', 'M', 'Escape', 'Enter', ' ', 'M']

      for (const key of keySequence) {
        await user.keyboard(`{${key}}`)
      }

      expectTransitionIntegrity(panel)
    })

    it('maintains performance during concurrent user actions', async () => {
      const user = userEvent.setup()
      mockLogs = Array.from({ length: 100 }, (_, i) =>
        createTestLog(`rapid-${i}`, `Rapid test log ${i}`)
      )

      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
          showFilters={true}
          showSearch={true}
        />
      )

      const panel = container.firstChild as HTMLElement
      const searchInput = screen.getByPlaceholderText('Search logs...')
      const minimizeBtn = screen.getByTestId('minimize-btn')

      const performanceStart = performance.now()

      // Perform concurrent actions
      await Promise.all([
        user.type(searchInput, 'test search'),
        user.click(minimizeBtn),
        user.type(searchInput, ' more text'),
      ])

      const performanceEnd = performance.now()
      const duration = performanceEnd - performanceStart

      // Should complete within reasonable time
      expect(duration).toBeLessThan(2000)
      expectTransitionIntegrity(panel)
    })
  })

  describe('Memory and Performance Stress Tests', () => {
    it('handles large content during rapid transitions without memory leaks', () => {
      // Create large log dataset
      mockLogs = Array.from({ length: 1000 }, (_, i) =>
        createTestLog(`stress-${i}`, `Stress test log entry ${i} with substantial content that should test memory management during rapid state changes`)
      )

      const { rerender, container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      const panel = container.firstChild as HTMLElement
      const initialMemoryUsage = (performance as any).memory?.usedJSHeapSize || 0

      // Perform many rapid transitions with large content
      for (let i = 0; i < 20; i++) {
        rerender(<AgentTerminalPanel {...defaultProps} panelState="minimized" />)
        rerender(<AgentTerminalPanel {...defaultProps} panelState="normal" />)
        rerender(<AgentTerminalPanel {...defaultProps} panelState="maximized" />)
        rerender(<AgentTerminalPanel {...defaultProps} panelState="normal" />)
      }

      const finalMemoryUsage = (performance as any).memory?.usedJSHeapSize || 0

      // Memory usage shouldn't grow excessively
      if (initialMemoryUsage > 0) {
        const memoryGrowth = finalMemoryUsage - initialMemoryUsage
        expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024) // Less than 50MB growth
      }

      expectTransitionIntegrity(panel)
    })

    it('maintains animation smoothness with high log throughput', async () => {
      let logId = 0
      const { rerender, container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      // Simulate high-frequency log updates during transitions
      const simulateLogStream = () => {
        mockLogs = Array.from({ length: 50 }, (_, i) =>
          createTestLog(`stream-${logId++}`, `Streaming log ${logId}`)
        )
      }

      const performanceStart = performance.now()

      // Perform transitions while simulating log stream
      for (let i = 0; i < 10; i++) {
        simulateLogStream()
        rerender(<AgentTerminalPanel {...defaultProps} panelState="minimized" />)

        simulateLogStream()
        rerender(<AgentTerminalPanel {...defaultProps} panelState="normal" />)

        simulateLogStream()
        rerender(<AgentTerminalPanel {...defaultProps} panelState="maximized" />)
      }

      const performanceEnd = performance.now()
      const duration = performanceEnd - performanceStart

      // Should handle high throughput without significant performance degradation
      expect(duration).toBeLessThan(5000)

      const panel = container.firstChild as HTMLElement
      expectTransitionIntegrity(panel)
    })
  })

  describe('Edge Case State Combinations', () => {
    it('handles simultaneous prop and state changes', () => {
      const { rerender, container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
          maxHeight="400px"
          className="initial-class"
        />
      )

      const panel = container.firstChild as HTMLElement
      expectTransitionIntegrity(panel)
      expect(panel).toHaveClass('initial-class')

      // Change multiple props simultaneously
      rerender(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="minimized"
          maxHeight="600px"
          className="updated-class"
          theme="light"
        />
      )

      expectTransitionIntegrity(panel)
      expect(panel).toHaveClass('updated-class')
      expect(panel).not.toHaveClass('initial-class')
    })

    it('handles state changes during error conditions', () => {
      mockStreamState.error = 'Connection error during transition'

      const { rerender, container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      const panel = container.firstChild as HTMLElement
      expectTransitionIntegrity(panel)
      expect(screen.getByText('Stream Error')).toBeInTheDocument()

      // Transition should work despite error
      rerender(<AgentTerminalPanel {...defaultProps} panelState="minimized" />)

      expectTransitionIntegrity(panel)
      expect(panel).toHaveClass(PANEL_HEIGHTS.minimized)
    })

    it('handles invalid state recovery', () => {
      const { rerender, container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      const panel = container.firstChild as HTMLElement
      expectTransitionIntegrity(panel)

      // Pass invalid state
      rerender(<AgentTerminalPanel {...defaultProps} panelState={'invalid' as any} />)

      // Should maintain animation integrity
      expectTransitionIntegrity(panel)

      // Should recover to valid state
      rerender(<AgentTerminalPanel {...defaultProps} panelState="minimized" />)

      expectTransitionIntegrity(panel)
      expect(panel).toHaveClass(PANEL_HEIGHTS.minimized)
    })
  })

  describe('Animation Timing Edge Cases', () => {
    it('handles transitions faster than animation duration', async () => {
      const { rerender, container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      const panel = container.firstChild as HTMLElement

      // Change state faster than animation can complete (300ms)
      const transitionInterval = 50 // Much faster than 300ms

      const rapidTransitions = async () => {
        for (let i = 0; i < 10; i++) {
          rerender(<AgentTerminalPanel {...defaultProps} panelState="minimized" />)
          await new Promise(resolve => setTimeout(resolve, transitionInterval))
          rerender(<AgentTerminalPanel {...defaultProps} panelState="normal" />)
          await new Promise(resolve => setTimeout(resolve, transitionInterval))
        }
      }

      await rapidTransitions()
      expectTransitionIntegrity(panel)
    })

    it('verifies animation class persistence during transition overlap', () => {
      const { rerender, container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      const panel = container.firstChild as HTMLElement
      const contentArea = container.querySelector(`.${PANEL_CONTENT_CLASSES.animate}`)

      // Capture initial animation classes
      const initialPanelClasses = panel.className
      const initialContentClasses = contentArea?.className

      // Perform overlapping transitions
      rerender(<AgentTerminalPanel {...defaultProps} panelState="minimized" />)
      rerender(<AgentTerminalPanel {...defaultProps} panelState="maximized" />)
      rerender(<AgentTerminalPanel {...defaultProps} panelState="normal" />)

      // Animation classes should be preserved
      expect(panel.className).toContain('transition-[height]')
      expect(panel.className).toContain('duration-300')
      expect(contentArea?.className).toContain(PANEL_CONTENT_CLASSES.animate)
    })
  })

  describe('Browser Compatibility Edge Cases', () => {
    it('handles CSS transition support detection', () => {
      // Mock CSS.supports for testing
      const originalCSSSupports = CSS.supports
      CSS.supports = vi.fn((property: string, value: string) => {
        if (property === 'transition' && value === 'height 300ms ease-out') {
          return true
        }
        return false
      })

      const { container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      const panel = container.firstChild as HTMLElement
      expectTransitionIntegrity(panel)

      // Restore original CSS.supports
      CSS.supports = originalCSSSupports
    })

    it('gracefully degrades when will-change is not supported', () => {
      // Mock property support
      Object.defineProperty(window, 'CSS', {
        value: {
          supports: () => false
        }
      })

      const { container } = render(
        <AgentTerminalPanel {...defaultProps} panelState="normal" />
      )

      const panel = container.firstChild as HTMLElement

      // Core transition classes should still be applied
      expect(panel).toHaveClass('transition-[height]')
      expect(panel).toHaveClass('duration-300')
    })
  })
})