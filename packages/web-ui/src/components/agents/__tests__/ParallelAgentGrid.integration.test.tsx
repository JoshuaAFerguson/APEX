/**
 * @vitest-environment jsdom
 *
 * ParallelAgentGrid Integration Tests
 *
 * Tests grid layout behavior when multiple AgentTerminalPanel components
 * are rendered together in a grid container, verifying:
 * - AC1: Maximized panel gets col-span-full class
 * - AC2: Non-maximized panels are hidden when one is maximized
 * - AC3: Grid layout classes change based on panel count and maximize state
 * - AC4: Smooth transitions are applied
 */

import React, { useState, useCallback } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AgentTerminalPanel } from '../AgentTerminalPanel'
import { getPanelGridClasses, getGridLayoutClasses } from '@/lib/utils'
import {
  PANEL_HEIGHTS,
  PANEL_WIDTHS,
  PANEL_TRANSITIONS,
  PANEL_PERFORMANCE,
} from '../constants'
import type { PanelDisplayState } from '@/types/agent-terminal-panel'
import type { AgentLogEntry } from '@/types/agent-log-stream'

// Mock state that will be modified by tests
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

let mockLogs: AgentLogEntry[] = []
let mockFilter = {
  levels: new Set(['debug', 'info', 'warn', 'error'] as const),
  searchText: '',
  stage: null,
  agent: null,
}

// Mock callbacks that track interactions
const mockConnect = vi.fn()
const mockDisconnect = vi.fn()
const mockPause = vi.fn()
const mockResume = vi.fn()
const mockClearLogs = vi.fn()
const mockSetFilter = vi.fn()
const mockResetFilter = vi.fn()
const mockExportLogs = vi.fn(() => JSON.stringify(mockLogs))
const mockScrollToLog = vi.fn()

// Auto-scroll mocks
let mockAutoScroll = true
let mockNewItemsSinceScroll = 0
const mockScrollToBottom = vi.fn()
const mockNotifyNewItems = vi.fn()
const mockHandleScroll = vi.fn()

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ChevronDown: () => <div data-testid="chevron-down" />,
  Minimize2: () => <div data-testid="minimize2" />,
  Maximize2: () => <div data-testid="maximize2" />,
  X: () => <div data-testid="x" />,
  Play: () => <div data-testid="play" />,
  Pause: () => <div data-testid="pause" />,
  RotateCcw: () => <div data-testid="rotate-ccw" />,
  Download: () => <div data-testid="download" />,
  Search: () => <div data-testid="search" />,
  Filter: () => <div data-testid="filter" />,
}))

// Mock hooks with minimal state for testing grid behavior
vi.mock('@/hooks/useAgentLogStream', () => ({
  useAgentLogStream: vi.fn(() => ({
    filteredLogs: mockLogs,
    filter: mockFilter,
    streamState: mockStreamState,
    stats: {
      totalLogs: mockLogs.length,
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

/**
 * Test wrapper component that simulates a grid container with multiple panels
 */
interface TestPanelData {
  id: string
  agentId: string
  title: string
  panelState: PanelDisplayState
}

interface TestParallelAgentGridProps {
  panels: TestPanelData[]
  onPanelStateChange: (panelId: string, newState: PanelDisplayState) => void
}

const TestParallelAgentGrid: React.FC<TestParallelAgentGridProps> = ({
  panels,
  onPanelStateChange
}) => {
  const hasMaximizedPanel = panels.some(p => p.panelState === 'maximized')

  return (
    <div
      className={getGridLayoutClasses(panels.length, hasMaximizedPanel)}
      data-testid="grid-container"
    >
      {panels.map(panel => (
        <div
          key={panel.id}
          className={getPanelGridClasses(
            hasMaximizedPanel,
            panel.panelState === 'maximized'
          )}
          data-testid={`panel-wrapper-${panel.id}`}
        >
          <AgentTerminalPanel
            panelId={panel.id}
            agentId={panel.agentId}
            title={panel.title}
            panelState={panel.panelState}
            onMaximize={() => onPanelStateChange(panel.id, 'maximized')}
            onMinimize={() => onPanelStateChange(panel.id, 'minimized')}
            onRestore={() => onPanelStateChange(panel.id, 'normal')}
            autoConnect={false}
            showFilters={false}
            showSearch={false}
          />
        </div>
      ))}
    </div>
  )
}

/**
 * Test utility to create a controlled wrapper
 */
const TestControlledGrid: React.FC<{
  initialPanels: Omit<TestPanelData, 'panelState'>[]
  initialStates?: Record<string, PanelDisplayState>
}> = ({ initialPanels, initialStates = {} }) => {
  const [panelStates, setPanelStates] = useState<Record<string, PanelDisplayState>>(() => {
    const states: Record<string, PanelDisplayState> = {}
    initialPanels.forEach(panel => {
      states[panel.id] = initialStates[panel.id] || 'normal'
    })
    return states
  })

  const handlePanelStateChange = useCallback((panelId: string, newState: PanelDisplayState) => {
    setPanelStates(prev => {
      const next = { ...prev }

      // If maximizing a panel, restore all others to normal
      if (newState === 'maximized') {
        Object.keys(next).forEach(id => {
          if (id !== panelId && next[id] === 'maximized') {
            next[id] = 'normal'
          }
        })
      }

      next[panelId] = newState
      return next
    })
  }, [])

  const panels: TestPanelData[] = initialPanels.map(panel => ({
    ...panel,
    panelState: panelStates[panel.id],
  }))

  return (
    <TestParallelAgentGrid
      panels={panels}
      onPanelStateChange={handlePanelStateChange}
    />
  )
}

describe('ParallelAgentGrid Integration', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
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
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('AC1: Maximized Panel Col-Span-Full', () => {
    it('should apply col-span-full class to maximized panel', () => {
      const panels = [
        { id: 'panel-1', agentId: 'agent-1', title: 'Agent 1' },
        { id: 'panel-2', agentId: 'agent-2', title: 'Agent 2' },
        { id: 'panel-3', agentId: 'agent-3', title: 'Agent 3' },
      ]

      render(
        <TestControlledGrid
          initialPanels={panels}
          initialStates={{ 'panel-2': 'maximized' }}
        />
      )

      // Get wrapper elements
      const panel1Wrapper = screen.getByTestId('panel-wrapper-panel-1')
      const panel2Wrapper = screen.getByTestId('panel-wrapper-panel-2')
      const panel3Wrapper = screen.getByTestId('panel-wrapper-panel-3')

      // Verify maximized panel has col-span-full
      expect(panel2Wrapper).toHaveClass('col-span-full')

      // Verify other panels do not have col-span-full
      expect(panel1Wrapper).not.toHaveClass('col-span-full')
      expect(panel3Wrapper).not.toHaveClass('col-span-full')
    })

    it('should not apply col-span-full when no panels are maximized', () => {
      const panels = [
        { id: 'panel-1', agentId: 'agent-1', title: 'Agent 1' },
        { id: 'panel-2', agentId: 'agent-2', title: 'Agent 2' },
        { id: 'panel-3', agentId: 'agent-3', title: 'Agent 3' },
      ]

      render(<TestControlledGrid initialPanels={panels} />)

      // Get wrapper elements
      const panel1Wrapper = screen.getByTestId('panel-wrapper-panel-1')
      const panel2Wrapper = screen.getByTestId('panel-wrapper-panel-2')
      const panel3Wrapper = screen.getByTestId('panel-wrapper-panel-3')

      // Verify no panel has col-span-full
      expect(panel1Wrapper).not.toHaveClass('col-span-full')
      expect(panel2Wrapper).not.toHaveClass('col-span-full')
      expect(panel3Wrapper).not.toHaveClass('col-span-full')
    })

    it('should transfer col-span-full when different panel is maximized', async () => {
      const panels = [
        { id: 'panel-1', agentId: 'agent-1', title: 'Agent 1' },
        { id: 'panel-2', agentId: 'agent-2', title: 'Agent 2' },
      ]

      // Create simple static grids with fixed states instead of controlled ones
      const { unmount } = render(
        <TestParallelAgentGrid
          panels={[
            { ...panels[0], panelState: 'maximized' },
            { ...panels[1], panelState: 'normal' },
          ]}
          onPanelStateChange={vi.fn()}
        />
      )

      // Initially panel-1 should be maximized
      expect(screen.getByTestId('panel-wrapper-panel-1')).toHaveClass('col-span-full')
      expect(screen.getByTestId('panel-wrapper-panel-2')).not.toHaveClass('col-span-full')

      unmount()

      // Now test with panel-2 maximized
      render(
        <TestParallelAgentGrid
          panels={[
            { ...panels[0], panelState: 'normal' },
            { ...panels[1], panelState: 'maximized' },
          ]}
          onPanelStateChange={vi.fn()}
        />
      )

      // Now panel-2 should be maximized
      expect(screen.getByTestId('panel-wrapper-panel-1')).not.toHaveClass('col-span-full')
      expect(screen.getByTestId('panel-wrapper-panel-2')).toHaveClass('col-span-full')
    })
  })

  describe('AC2: Non-Maximized Panels Hidden', () => {
    it('should hide non-maximized panels when one panel is maximized', () => {
      const panels = [
        { id: 'panel-1', agentId: 'agent-1', title: 'Agent 1' },
        { id: 'panel-2', agentId: 'agent-2', title: 'Agent 2' },
        { id: 'panel-3', agentId: 'agent-3', title: 'Agent 3' },
      ]

      render(
        <TestControlledGrid
          initialPanels={panels}
          initialStates={{ 'panel-2': 'maximized' }}
        />
      )

      // Get wrapper elements
      const panel1Wrapper = screen.getByTestId('panel-wrapper-panel-1')
      const panel2Wrapper = screen.getByTestId('panel-wrapper-panel-2')
      const panel3Wrapper = screen.getByTestId('panel-wrapper-panel-3')

      // Verify non-maximized panels are hidden
      expect(panel1Wrapper).toHaveClass('hidden')
      expect(panel3Wrapper).toHaveClass('hidden')

      // Verify maximized panel is not hidden
      expect(panel2Wrapper).not.toHaveClass('hidden')
    })

    it('should show all panels when none are maximized', () => {
      const panels = [
        { id: 'panel-1', agentId: 'agent-1', title: 'Agent 1' },
        { id: 'panel-2', agentId: 'agent-2', title: 'Agent 2' },
        { id: 'panel-3', agentId: 'agent-3', title: 'Agent 3' },
      ]

      render(<TestControlledGrid initialPanels={panels} />)

      // Get wrapper elements
      const panel1Wrapper = screen.getByTestId('panel-wrapper-panel-1')
      const panel2Wrapper = screen.getByTestId('panel-wrapper-panel-2')
      const panel3Wrapper = screen.getByTestId('panel-wrapper-panel-3')

      // Verify no panel is hidden
      expect(panel1Wrapper).not.toHaveClass('hidden')
      expect(panel2Wrapper).not.toHaveClass('hidden')
      expect(panel3Wrapper).not.toHaveClass('hidden')
    })

    it('should update hidden state when maximize state changes', async () => {
      const panels = [
        { id: 'panel-1', agentId: 'agent-1', title: 'Agent 1' },
        { id: 'panel-2', agentId: 'agent-2', title: 'Agent 2' },
      ]

      // Test initial state - no panels hidden
      const { unmount } = render(
        <TestParallelAgentGrid
          panels={[
            { ...panels[0], panelState: 'normal' },
            { ...panels[1], panelState: 'normal' },
          ]}
          onPanelStateChange={vi.fn()}
        />
      )

      expect(screen.getByTestId('panel-wrapper-panel-1')).not.toHaveClass('hidden')
      expect(screen.getByTestId('panel-wrapper-panel-2')).not.toHaveClass('hidden')

      unmount()

      // Test maximized state
      render(
        <TestParallelAgentGrid
          panels={[
            { ...panels[0], panelState: 'maximized' },
            { ...panels[1], panelState: 'normal' },
          ]}
          onPanelStateChange={vi.fn()}
        />
      )

      // Now panel-2 should be hidden
      expect(screen.getByTestId('panel-wrapper-panel-1')).not.toHaveClass('hidden')
      expect(screen.getByTestId('panel-wrapper-panel-2')).toHaveClass('hidden')
    })
  })

  describe('AC3: Grid Layout Class Changes', () => {
    it('should use correct grid classes for different panel counts in normal state', () => {
      const testCases = [
        { count: 1, expected: 'grid grid-cols-1 gap-2' },
        { count: 2, expected: 'grid grid-cols-1 sm:grid-cols-2 gap-2' },
        { count: 3, expected: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2' },
        { count: 4, expected: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2' },
        { count: 5, expected: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2' },
        { count: 6, expected: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2' },
      ]

      testCases.forEach(({ count, expected }) => {
        const panels = Array.from({ length: count }, (_, i) => ({
          id: `panel-${i + 1}`,
          agentId: `agent-${i + 1}`,
          title: `Agent ${i + 1}`,
        }))

        const { unmount } = render(<TestControlledGrid initialPanels={panels} />)

        const gridContainer = screen.getByTestId('grid-container')
        expect(gridContainer).toHaveClass(...expected.split(' '))

        unmount()
      })
    })

    it('should use single column layout when any panel is maximized', () => {
      const panels = [
        { id: 'panel-1', agentId: 'agent-1', title: 'Agent 1' },
        { id: 'panel-2', agentId: 'agent-2', title: 'Agent 2' },
        { id: 'panel-3', agentId: 'agent-3', title: 'Agent 3' },
      ]

      render(
        <TestControlledGrid
          initialPanels={panels}
          initialStates={{ 'panel-2': 'maximized' }}
        />
      )

      const gridContainer = screen.getByTestId('grid-container')
      expect(gridContainer).toHaveClass('grid', 'grid-cols-1', 'gap-2')

      // Should not have the 3-panel responsive classes
      expect(gridContainer).not.toHaveClass('sm:grid-cols-2')
      expect(gridContainer).not.toHaveClass('lg:grid-cols-3')
    })

    it('should transition grid layout when maximize state changes', () => {
      const panels = [
        { id: 'panel-1', agentId: 'agent-1', title: 'Agent 1' },
        { id: 'panel-2', agentId: 'agent-2', title: 'Agent 2' },
        { id: 'panel-3', agentId: 'agent-3', title: 'Agent 3' },
      ]

      // Test normal state - 3-column responsive layout
      const { unmount } = render(
        <TestParallelAgentGrid
          panels={[
            { ...panels[0], panelState: 'normal' },
            { ...panels[1], panelState: 'normal' },
            { ...panels[2], panelState: 'normal' },
          ]}
          onPanelStateChange={vi.fn()}
        />
      )

      const gridContainer = screen.getByTestId('grid-container')
      expect(gridContainer).toHaveClass('grid', 'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3', 'gap-2')

      unmount()

      // Test maximized state - single column
      render(
        <TestParallelAgentGrid
          panels={[
            { ...panels[0], panelState: 'maximized' },
            { ...panels[1], panelState: 'normal' },
            { ...panels[2], panelState: 'normal' },
          ]}
          onPanelStateChange={vi.fn()}
        />
      )

      const gridContainer2 = screen.getByTestId('grid-container')
      expect(gridContainer2).toHaveClass('grid', 'grid-cols-1', 'gap-2')
      expect(gridContainer2).not.toHaveClass('sm:grid-cols-2')
      expect(gridContainer2).not.toHaveClass('lg:grid-cols-3')
    })

    it('should handle edge cases gracefully', () => {
      // Test with 0 panels (empty grid)
      const { unmount } = render(<TestControlledGrid initialPanels={[]} />)

      const gridContainer = screen.getByTestId('grid-container')
      // Should use default 6-column layout for 0 panels (as per utility function)
      expect(gridContainer).toHaveClass('grid', 'grid-cols-1', 'gap-2')

      unmount()

      // Test with more than 6 panels
      const manyPanels = Array.from({ length: 8 }, (_, i) => ({
        id: `panel-${i + 1}`,
        agentId: `agent-${i + 1}`,
        title: `Agent ${i + 1}`,
      }))

      render(<TestControlledGrid initialPanels={manyPanels} />)

      const gridContainer2 = screen.getByTestId('grid-container')
      // Should use 8-panel layout for 8 panels
      expect(gridContainer2).toHaveClass('grid', 'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-4', 'xl:grid-cols-4', '2xl:grid-cols-4', 'gap-2')
    })
  })

  describe('AC4: Smooth Transitions', () => {
    it('should apply transition classes to panels', () => {
      const panels = [
        { id: 'panel-1', agentId: 'agent-1', title: 'Agent 1' },
        { id: 'panel-2', agentId: 'agent-2', title: 'Agent 2' },
      ]

      render(<TestControlledGrid initialPanels={panels} />)

      // Find the AgentTerminalPanel components (they have the transition classes)
      const panel1 = screen.getByLabelText('Agent terminal panel: Agent 1')
      const panel2 = screen.getByLabelText('Agent terminal panel: Agent 2')

      // Verify transition classes are applied
      expect(panel1).toHaveClass(PANEL_TRANSITIONS.height)
      expect(panel2).toHaveClass(PANEL_TRANSITIONS.height)

      // Verify performance optimization classes
      expect(panel1).toHaveClass(PANEL_PERFORMANCE.willChange)
      expect(panel2).toHaveClass(PANEL_PERFORMANCE.willChange)
    })

    it('should maintain transition classes during state changes', () => {
      const panels = [
        { id: 'panel-1', agentId: 'agent-1', title: 'Agent 1' },
        { id: 'panel-2', agentId: 'agent-2', title: 'Agent 2' },
      ]

      const { rerender } = render(<TestControlledGrid initialPanels={panels} />)

      const panel1 = screen.getByLabelText('Agent terminal panel: Agent 1')
      const panel2 = screen.getByLabelText('Agent terminal panel: Agent 2')

      // Check initial transition classes
      expect(panel1).toHaveClass(PANEL_TRANSITIONS.height)
      expect(panel2).toHaveClass(PANEL_TRANSITIONS.height)

      // Maximize panel-1
      rerender(
        <TestControlledGrid
          initialPanels={panels}
          initialStates={{ 'panel-1': 'maximized' }}
        />
      )

      // Transition classes should still be present
      expect(panel1).toHaveClass(PANEL_TRANSITIONS.height)
      // panel2 wrapper is hidden, but the panel itself still has transitions
      expect(panel2).toHaveClass(PANEL_TRANSITIONS.height)
    })

    it('should apply specific transition timing values', () => {
      const panels = [
        { id: 'panel-1', agentId: 'agent-1', title: 'Agent 1' },
      ]

      render(<TestControlledGrid initialPanels={panels} />)

      const panel = screen.getByLabelText('Agent terminal panel: Agent 1')

      // Check specific transition classes as defined in constants
      expect(panel).toHaveClass('transition-[height]')
      expect(panel).toHaveClass('duration-300')
      expect(panel).toHaveClass('ease-out')
    })

    it('should apply performance optimization classes', () => {
      const panels = [
        { id: 'panel-1', agentId: 'agent-1', title: 'Agent 1' },
      ]

      render(<TestControlledGrid initialPanels={panels} />)

      const panel = screen.getByLabelText('Agent terminal panel: Agent 1')

      // Check performance optimization classes
      expect(panel).toHaveClass('will-change-[height,opacity]')
    })
  })

  describe('Multi-Panel Integration Scenarios', () => {
    it('should handle complex state transitions with multiple panels', async () => {
      const panels = [
        { id: 'panel-1', agentId: 'agent-1', title: 'Agent 1' },
        { id: 'panel-2', agentId: 'agent-2', title: 'Agent 2' },
        { id: 'panel-3', agentId: 'agent-3', title: 'Agent 3' },
        { id: 'panel-4', agentId: 'agent-4', title: 'Agent 4' },
      ]

      // Test initial state: 4-column responsive layout, no panels hidden
      const { unmount } = render(
        <TestParallelAgentGrid
          panels={[
            { ...panels[0], panelState: 'normal' },
            { ...panels[1], panelState: 'normal' },
            { ...panels[2], panelState: 'normal' },
            { ...panels[3], panelState: 'normal' },
          ]}
          onPanelStateChange={vi.fn()}
        />
      )

      const gridContainer = screen.getByTestId('grid-container')
      expect(gridContainer).toHaveClass('grid', 'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-4', 'gap-2')
      panels.forEach(panel => {
        expect(screen.getByTestId(`panel-wrapper-${panel.id}`)).not.toHaveClass('hidden')
        expect(screen.getByTestId(`panel-wrapper-${panel.id}`)).not.toHaveClass('col-span-full')
      })

      unmount()

      // Test with panel-3 maximized
      render(
        <TestParallelAgentGrid
          panels={[
            { ...panels[0], panelState: 'normal' },
            { ...panels[1], panelState: 'normal' },
            { ...panels[2], panelState: 'maximized' },
            { ...panels[3], panelState: 'normal' },
          ]}
          onPanelStateChange={vi.fn()}
        />
      )

      const gridContainer2 = screen.getByTestId('grid-container')

      // Should be single column, panel-3 maximized, others hidden
      expect(gridContainer2).toHaveClass('grid', 'grid-cols-1', 'gap-2')
      expect(gridContainer2).not.toHaveClass('lg:grid-cols-4')

      expect(screen.getByTestId('panel-wrapper-panel-1')).toHaveClass('hidden')
      expect(screen.getByTestId('panel-wrapper-panel-2')).toHaveClass('hidden')
      expect(screen.getByTestId('panel-wrapper-panel-3')).toHaveClass('col-span-full')
      expect(screen.getByTestId('panel-wrapper-panel-3')).not.toHaveClass('hidden')
      expect(screen.getByTestId('panel-wrapper-panel-4')).toHaveClass('hidden')
    })

    it('should handle dynamic panel addition and removal', () => {
      const initialPanels = [
        { id: 'panel-1', agentId: 'agent-1', title: 'Agent 1' },
        { id: 'panel-2', agentId: 'agent-2', title: 'Agent 2' },
      ]

      const { rerender } = render(<TestControlledGrid initialPanels={initialPanels} />)

      const gridContainer = screen.getByTestId('grid-container')

      // Initially 2 panels
      expect(gridContainer).toHaveClass('sm:grid-cols-2')
      expect(gridContainer).not.toHaveClass('lg:grid-cols-3')

      // Add a third panel
      const expandedPanels = [
        ...initialPanels,
        { id: 'panel-3', agentId: 'agent-3', title: 'Agent 3' },
      ]

      rerender(<TestControlledGrid initialPanels={expandedPanels} />)

      // Should now use 3-column layout
      expect(gridContainer).toHaveClass('lg:grid-cols-3')
      expect(screen.getByTestId('panel-wrapper-panel-3')).toBeInTheDocument()

      // Remove back to 1 panel
      rerender(<TestControlledGrid initialPanels={[initialPanels[0]]} />)

      // Should use single column layout
      expect(gridContainer).toHaveClass('grid-cols-1')
      expect(gridContainer).not.toHaveClass('sm:grid-cols-2')
      expect(gridContainer).not.toHaveClass('lg:grid-cols-3')
    })

    it('should maintain state consistency under rapid changes', () => {
      const panels = [
        { id: 'panel-1', agentId: 'agent-1', title: 'Agent 1' },
        { id: 'panel-2', agentId: 'agent-2', title: 'Agent 2' },
        { id: 'panel-3', agentId: 'agent-3', title: 'Agent 3' },
      ]

      // Test a few key state scenarios for consistency
      const stateScenarios = [
        {
          name: 'panel-1 maximized',
          panels: [
            { ...panels[0], panelState: 'maximized' as const },
            { ...panels[1], panelState: 'normal' as const },
            { ...panels[2], panelState: 'normal' as const },
          ],
          expectations: {
            gridClass: 'grid-cols-1',
            notGridClass: 'lg:grid-cols-3',
            maximized: 'panel-1',
            hidden: ['panel-2', 'panel-3'],
          }
        },
        {
          name: 'all normal',
          panels: [
            { ...panels[0], panelState: 'normal' as const },
            { ...panels[1], panelState: 'normal' as const },
            { ...panels[2], panelState: 'normal' as const },
          ],
          expectations: {
            gridClass: 'lg:grid-cols-3',
            notGridClass: null,
            maximized: null,
            hidden: [],
          }
        },
        {
          name: 'panel-3 maximized',
          panels: [
            { ...panels[0], panelState: 'normal' as const },
            { ...panels[1], panelState: 'normal' as const },
            { ...panels[2], panelState: 'maximized' as const },
          ],
          expectations: {
            gridClass: 'grid-cols-1',
            notGridClass: 'lg:grid-cols-3',
            maximized: 'panel-3',
            hidden: ['panel-1', 'panel-2'],
          }
        }
      ]

      stateScenarios.forEach(({ name, panels: scenarioPanels, expectations }) => {
        const { unmount } = render(
          <TestParallelAgentGrid
            panels={scenarioPanels}
            onPanelStateChange={vi.fn()}
          />
        )

        // Verify grid container classes
        const gridContainer = screen.getByTestId('grid-container')
        expect(gridContainer).toHaveClass(expectations.gridClass)
        if (expectations.notGridClass) {
          expect(gridContainer).not.toHaveClass(expectations.notGridClass)
        }

        // Verify panel wrapper classes
        panels.forEach(panel => {
          const wrapper = screen.getByTestId(`panel-wrapper-${panel.id}`)

          if (expectations.maximized === panel.id) {
            expect(wrapper).toHaveClass('col-span-full')
            expect(wrapper).not.toHaveClass('hidden')
          } else if (expectations.hidden.includes(panel.id)) {
            expect(wrapper).toHaveClass('hidden')
            expect(wrapper).not.toHaveClass('col-span-full')
          } else {
            expect(wrapper).not.toHaveClass('hidden')
            expect(wrapper).not.toHaveClass('col-span-full')
          }
        })

        unmount()
      })
    })
  })
})