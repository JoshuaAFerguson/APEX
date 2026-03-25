/**
 * @vitest-environment jsdom
 *
 * ParallelAgentGrid Unit Tests
 *
 * Comprehensive unit tests for the ParallelAgentGrid component covering:
 * - Component rendering with various configurations
 * - Grid layout class application based on panel count
 * - Panel state management integration
 * - Controlled vs uncontrolled state handling
 * - Edge cases and error scenarios
 * - Accessibility features
 * - Debug mode functionality
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ParallelAgentGrid } from '../ParallelAgentGrid'
import type { PanelDisplayState } from '@/types/agent-terminal-panel'

// Mock the utility functions
vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual('@/lib/utils')
  return {
    ...actual,
    cn: vi.fn((...args) => args.filter(Boolean).join(' ')),
    getGridLayoutClasses: vi.fn((panelCount: number, isMaximized: boolean) => {
      if (isMaximized) return 'grid grid-cols-1 gap-2'

      const configs = {
        1: 'grid grid-cols-1 gap-2',
        2: 'grid grid-cols-1 sm:grid-cols-2 gap-2',
        3: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2',
        4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2',
      }

      return configs[Math.min(panelCount, 4) as keyof typeof configs] || 'grid grid-cols-1 gap-2'
    }),
    getPanelGridClasses: vi.fn((isMaximized: boolean, isThisMaximized: boolean) => {
      if (isMaximized) {
        return isThisMaximized ? 'col-span-full' : 'hidden'
      }
      return ''
    })
  }
})

// Mock the useAgentTerminalPanelState hook
let mockHookReturn = {
  getAllStates: vi.fn(() => ({})),
  maximizedPanelId: null,
  hasMaximizedPanel: false,
  panelCount: 0,
  registerPanel: vi.fn(),
  unregisterPanel: vi.fn(),
  updatePanelState: vi.fn(),
  resetAll: vi.fn(),
}

vi.mock('@/hooks/useAgentTerminalPanelState', () => ({
  useAgentTerminalPanelState: vi.fn(() => mockHookReturn)
}))

// Mock child components for testing
const MockAgentTerminalPanel = ({ panelId, title, children }: any) => (
  <div data-testid={`mock-panel-${panelId}`} aria-label={title}>
    {children}
  </div>
)

describe('ParallelAgentGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock hook return values
    mockHookReturn = {
      getAllStates: vi.fn(() => ({})),
      maximizedPanelId: null,
      hasMaximizedPanel: false,
      panelCount: 0,
      registerPanel: vi.fn(),
      unregisterPanel: vi.fn(),
      updatePanelState: vi.fn(),
      resetAll: vi.fn(),
    }

    // Reset the mock hook to return the updated values
    vi.mocked(require('@/hooks/useAgentTerminalPanelState').useAgentTerminalPanelState).mockReturnValue(mockHookReturn)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render empty grid container when no children provided', () => {
      render(<ParallelAgentGrid />)

      const gridContainer = screen.getByTestId('grid-container')
      expect(gridContainer).toBeInTheDocument()
      expect(gridContainer).toHaveAttribute('role', 'grid')
      expect(gridContainer).toHaveAttribute('aria-label', 'Agent terminal grid with 0 panels')
    })

    it('should render with single child', () => {
      render(
        <ParallelAgentGrid>
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
        </ParallelAgentGrid>
      )

      const gridContainer = screen.getByTestId('grid-container')
      const panelWrapper = screen.getByTestId('panel-wrapper-0')
      const mockPanel = screen.getByTestId('mock-panel-test-1')

      expect(gridContainer).toBeInTheDocument()
      expect(panelWrapper).toBeInTheDocument()
      expect(mockPanel).toBeInTheDocument()
      expect(gridContainer).toHaveAttribute('aria-label', 'Agent terminal grid with 1 panel')
    })

    it('should render with multiple children', () => {
      render(
        <ParallelAgentGrid>
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
          <MockAgentTerminalPanel panelId="test-2" title="Test Panel 2" />
          <MockAgentTerminalPanel panelId="test-3" title="Test Panel 3" />
        </ParallelAgentGrid>
      )

      const gridContainer = screen.getByTestId('grid-container')
      expect(gridContainer).toHaveAttribute('aria-label', 'Agent terminal grid with 3 panels')

      // Check all panel wrappers are present
      expect(screen.getByTestId('panel-wrapper-0')).toBeInTheDocument()
      expect(screen.getByTestId('panel-wrapper-1')).toBeInTheDocument()
      expect(screen.getByTestId('panel-wrapper-2')).toBeInTheDocument()

      // Check all mock panels are present
      expect(screen.getByTestId('mock-panel-test-1')).toBeInTheDocument()
      expect(screen.getByTestId('mock-panel-test-2')).toBeInTheDocument()
      expect(screen.getByTestId('mock-panel-test-3')).toBeInTheDocument()
    })

    it('should handle non-React element children', () => {
      render(
        <ParallelAgentGrid>
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
          {'string child'}
          {42}
          {null}
          <MockAgentTerminalPanel panelId="test-2" title="Test Panel 2" />
        </ParallelAgentGrid>
      )

      const gridContainer = screen.getByTestId('grid-container')
      expect(gridContainer).toBeInTheDocument()

      // Should still render valid React elements
      expect(screen.getByTestId('mock-panel-test-1')).toBeInTheDocument()
      expect(screen.getByTestId('mock-panel-test-2')).toBeInTheDocument()
    })
  })

  describe('Grid Layout Classes', () => {
    it('should apply correct grid classes for different panel counts', () => {
      const { getGridLayoutClasses } = require('@/lib/utils')

      const testCases = [
        { count: 1, children: 1 },
        { count: 2, children: 2 },
        { count: 3, children: 3 },
        { count: 4, children: 4 },
      ]

      testCases.forEach(({ count, children }) => {
        const { unmount } = render(
          <ParallelAgentGrid>
            {Array.from({ length: children }, (_, i) => (
              <MockAgentTerminalPanel key={i} panelId={`test-${i}`} title={`Test Panel ${i}`} />
            ))}
          </ParallelAgentGrid>
        )

        expect(getGridLayoutClasses).toHaveBeenCalledWith(count, false)
        unmount()
      })
    })

    it('should use maximized layout when hasMaximizedPanel is true', () => {
      const { getGridLayoutClasses } = require('@/lib/utils')

      mockHookReturn.hasMaximizedPanel = true
      vi.mocked(require('@/hooks/useAgentTerminalPanelState').useAgentTerminalPanelState).mockReturnValue(mockHookReturn)

      render(
        <ParallelAgentGrid>
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
          <MockAgentTerminalPanel panelId="test-2" title="Test Panel 2" />
        </ParallelAgentGrid>
      )

      expect(getGridLayoutClasses).toHaveBeenCalledWith(2, true)
    })

    it('should use maximized layout when controlled state has maximized panel', () => {
      const { getGridLayoutClasses } = require('@/lib/utils')

      render(
        <ParallelAgentGrid controlledStates={{ 'test-1': 'maximized', 'test-2': 'normal' }}>
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
          <MockAgentTerminalPanel panelId="test-2" title="Test Panel 2" />
        </ParallelAgentGrid>
      )

      expect(getGridLayoutClasses).toHaveBeenCalledWith(2, true)
    })

    it('should prioritize registeredPanelCount over child count', () => {
      const { getGridLayoutClasses } = require('@/lib/utils')

      mockHookReturn.panelCount = 5
      vi.mocked(require('@/hooks/useAgentTerminalPanelState').useAgentTerminalPanelState).mockReturnValue(mockHookReturn)

      render(
        <ParallelAgentGrid>
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
          <MockAgentTerminalPanel panelId="test-2" title="Test Panel 2" />
        </ParallelAgentGrid>
      )

      expect(getGridLayoutClasses).toHaveBeenCalledWith(5, false)
    })
  })

  describe('Panel Grid Classes', () => {
    it('should apply correct panel classes when no panels are maximized', () => {
      const { getPanelGridClasses } = require('@/lib/utils')

      render(
        <ParallelAgentGrid>
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
          <MockAgentTerminalPanel panelId="test-2" title="Test Panel 2" />
        </ParallelAgentGrid>
      )

      expect(getPanelGridClasses).toHaveBeenCalledWith(false, false)
    })

    it('should apply correct panel classes when using controlled states', () => {
      const { getPanelGridClasses } = require('@/lib/utils')

      mockHookReturn.getAllStates = vi.fn(() => ({ 'test-1': 'maximized', 'test-2': 'normal' }))
      vi.mocked(require('@/hooks/useAgentTerminalPanelState').useAgentTerminalPanelState).mockReturnValue(mockHookReturn)

      render(
        <ParallelAgentGrid controlledStates={{ 'test-1': 'maximized', 'test-2': 'normal' }}>
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
          <MockAgentTerminalPanel panelId="test-2" title="Test Panel 2" />
        </ParallelAgentGrid>
      )

      // First panel should be maximized
      expect(getPanelGridClasses).toHaveBeenCalledWith(true, true)
      // Second panel should be hidden
      expect(getPanelGridClasses).toHaveBeenCalledWith(true, false)
    })

    it('should generate panel wrapper test IDs correctly', () => {
      render(
        <ParallelAgentGrid>
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
          <MockAgentTerminalPanel panelId="test-2" title="Test Panel 2" />
          <div>Non-panel element</div>
        </ParallelAgentGrid>
      )

      expect(screen.getByTestId('panel-wrapper-test-1')).toBeInTheDocument()
      expect(screen.getByTestId('panel-wrapper-test-2')).toBeInTheDocument()
      expect(screen.getByTestId('panel-wrapper-2')).toBeInTheDocument() // Non-panel element gets index-based ID
    })
  })

  describe('Hook Integration', () => {
    it('should initialize hook with correct parameters when panels provided', () => {
      const { useAgentTerminalPanelState } = require('@/hooks/useAgentTerminalPanelState')
      const panels = [
        { panelId: 'panel-1', agentId: 'agent-1', title: 'Agent 1' },
        { panelId: 'panel-2', agentId: 'agent-2', title: 'Agent 2', initialState: 'minimized' as PanelDisplayState },
      ]

      render(<ParallelAgentGrid panels={panels} debug={true} />)

      expect(useAgentTerminalPanelState).toHaveBeenCalledWith({
        initialStates: {
          'panel-1': 'normal',
          'panel-2': 'minimized',
        },
        controlledStates: undefined,
        onStateChange: undefined,
        debug: true,
      })
    })

    it('should pass controlledStates and onStateChange to hook', () => {
      const { useAgentTerminalPanelState } = require('@/hooks/useAgentTerminalPanelState')
      const controlledStates = { 'panel-1': 'maximized' as PanelDisplayState }
      const onStateChange = vi.fn()

      render(
        <ParallelAgentGrid
          controlledStates={controlledStates}
          onStateChange={onStateChange}
        />
      )

      expect(useAgentTerminalPanelState).toHaveBeenCalledWith({
        initialStates: {},
        controlledStates,
        onStateChange,
        debug: false,
      })
    })

    it('should call getAllStates from hook', () => {
      const mockGetAllStates = vi.fn(() => ({ 'panel-1': 'normal' }))
      mockHookReturn.getAllStates = mockGetAllStates
      vi.mocked(require('@/hooks/useAgentTerminalPanelState').useAgentTerminalPanelState).mockReturnValue(mockHookReturn)

      render(
        <ParallelAgentGrid>
          <MockAgentTerminalPanel panelId="panel-1" title="Panel 1" />
        </ParallelAgentGrid>
      )

      expect(mockGetAllStates).toHaveBeenCalled()
    })
  })

  describe('Controlled vs Uncontrolled State', () => {
    it('should work in uncontrolled mode with no panels prop', () => {
      render(
        <ParallelAgentGrid>
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
        </ParallelAgentGrid>
      )

      const gridContainer = screen.getByTestId('grid-container')
      expect(gridContainer).toBeInTheDocument()
    })

    it('should work in controlled mode with controlledStates', () => {
      const controlledStates = { 'test-1': 'maximized' as PanelDisplayState }

      render(
        <ParallelAgentGrid controlledStates={controlledStates}>
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
        </ParallelAgentGrid>
      )

      const gridContainer = screen.getByTestId('grid-container')
      expect(gridContainer).toBeInTheDocument()
    })

    it('should prioritize controlledStates over internal states', () => {
      const { getPanelGridClasses } = require('@/lib/utils')

      mockHookReturn.getAllStates = vi.fn(() => ({ 'test-1': 'normal' }))
      vi.mocked(require('@/hooks/useAgentTerminalPanelState').useAgentTerminalPanelState).mockReturnValue(mockHookReturn)

      render(
        <ParallelAgentGrid controlledStates={{ 'test-1': 'maximized' }}>
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
        </ParallelAgentGrid>
      )

      // Should use controlled state (maximized) instead of internal state (normal)
      expect(getPanelGridClasses).toHaveBeenCalledWith(true, true)
    })
  })

  describe('Debug Mode', () => {
    let consoleSpy: any

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleSpy.mockRestore()
    })

    it('should not log when debug is false', () => {
      render(
        <ParallelAgentGrid debug={false}>
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
        </ParallelAgentGrid>
      )

      expect(consoleSpy).not.toHaveBeenCalled()
    })

    it('should log render state when debug is true', () => {
      mockHookReturn.maximizedPanelId = 'test-1'
      mockHookReturn.hasMaximizedPanel = true
      mockHookReturn.panelCount = 2
      mockHookReturn.getAllStates = vi.fn(() => ({ 'test-1': 'maximized', 'test-2': 'normal' }))
      vi.mocked(require('@/hooks/useAgentTerminalPanelState').useAgentTerminalPanelState).mockReturnValue(mockHookReturn)

      render(
        <ParallelAgentGrid debug={true}>
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
          <MockAgentTerminalPanel panelId="test-2" title="Test Panel 2" />
        </ParallelAgentGrid>
      )

      expect(consoleSpy).toHaveBeenCalledWith('[ParallelAgentGrid] Render state:', expect.objectContaining({
        effectivePanelCount: 2,
        childCount: 2,
        registeredPanelCount: 2,
        isAnyPanelMaximized: true,
        maximizedPanelId: 'test-1',
        allStates: { 'test-1': 'maximized', 'test-2': 'normal' },
      }))
    })

    it('should log individual panel debug info when debug is true', () => {
      mockHookReturn.getAllStates = vi.fn(() => ({ 'test-1': 'maximized' }))
      vi.mocked(require('@/hooks/useAgentTerminalPanelState').useAgentTerminalPanelState).mockReturnValue(mockHookReturn)

      render(
        <ParallelAgentGrid debug={true}>
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
        </ParallelAgentGrid>
      )

      expect(consoleSpy).toHaveBeenCalledWith('[ParallelAgentGrid] Panel test-1:', expect.objectContaining({
        state: 'maximized',
        isMaximized: true,
      }))
    })
  })

  describe('Accessibility', () => {
    it('should have correct ARIA attributes on grid container', () => {
      render(
        <ParallelAgentGrid>
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
          <MockAgentTerminalPanel panelId="test-2" title="Test Panel 2" />
        </ParallelAgentGrid>
      )

      const gridContainer = screen.getByTestId('grid-container')
      expect(gridContainer).toHaveAttribute('role', 'grid')
      expect(gridContainer).toHaveAttribute('aria-label', 'Agent terminal grid with 2 panels')
    })

    it('should handle singular vs plural in aria-label', () => {
      const { rerender } = render(
        <ParallelAgentGrid>
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
        </ParallelAgentGrid>
      )

      let gridContainer = screen.getByTestId('grid-container')
      expect(gridContainer).toHaveAttribute('aria-label', 'Agent terminal grid with 1 panel')

      rerender(
        <ParallelAgentGrid>
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
          <MockAgentTerminalPanel panelId="test-2" title="Test Panel 2" />
        </ParallelAgentGrid>
      )

      gridContainer = screen.getByTestId('grid-container')
      expect(gridContainer).toHaveAttribute('aria-label', 'Agent terminal grid with 2 panels')
    })
  })

  describe('CSS Classes and Styling', () => {
    it('should apply custom className to grid container', () => {
      const { cn } = require('@/lib/utils')

      render(
        <ParallelAgentGrid className="custom-grid-class">
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
        </ParallelAgentGrid>
      )

      expect(cn).toHaveBeenCalledWith(
        expect.stringContaining('grid'),
        'custom-grid-class'
      )
    })

    it('should merge grid layout classes with custom className', () => {
      const { cn } = require('@/lib/utils')

      render(<ParallelAgentGrid className="my-custom-class" />)

      const gridContainer = screen.getByTestId('grid-container')
      expect(gridContainer).toBeInTheDocument()
      expect(cn).toHaveBeenCalled()
    })

    it('should apply panel grid classes to wrapper divs', () => {
      const { cn } = require('@/lib/utils')

      render(
        <ParallelAgentGrid>
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
        </ParallelAgentGrid>
      )

      expect(cn).toHaveBeenCalled()
      const panelWrapper = screen.getByTestId('panel-wrapper-test-1')
      expect(panelWrapper).toBeInTheDocument()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty panels array', () => {
      render(<ParallelAgentGrid panels={[]} />)

      const gridContainer = screen.getByTestId('grid-container')
      expect(gridContainer).toBeInTheDocument()
      expect(gridContainer).toHaveAttribute('aria-label', 'Agent terminal grid with 0 panels')
    })

    it('should handle panels with missing panelId', () => {
      render(
        <ParallelAgentGrid>
          <div data-testid="no-panel-id">No panel ID</div>
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
        </ParallelAgentGrid>
      )

      expect(screen.getByTestId('panel-wrapper-0')).toBeInTheDocument()
      expect(screen.getByTestId('panel-wrapper-test-1')).toBeInTheDocument()
    })

    it('should handle mixed valid and invalid children', () => {
      render(
        <ParallelAgentGrid>
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
          {null}
          {undefined}
          <MockAgentTerminalPanel panelId="test-2" title="Test Panel 2" />
          {'string child'}
        </ParallelAgentGrid>
      )

      expect(screen.getByTestId('mock-panel-test-1')).toBeInTheDocument()
      expect(screen.getByTestId('mock-panel-test-2')).toBeInTheDocument()
    })

    it('should handle large number of children gracefully', () => {
      const manyChildren = Array.from({ length: 15 }, (_, i) => (
        <MockAgentTerminalPanel key={i} panelId={`test-${i}`} title={`Test Panel ${i}`} />
      ))

      render(<ParallelAgentGrid>{manyChildren}</ParallelAgentGrid>)

      const gridContainer = screen.getByTestId('grid-container')
      expect(gridContainer).toBeInTheDocument()
      expect(gridContainer).toHaveAttribute('aria-label', 'Agent terminal grid with 15 panels')
    })

    it('should handle undefined controlledStates gracefully', () => {
      render(
        <ParallelAgentGrid controlledStates={undefined}>
          <MockAgentTerminalPanel panelId="test-1" title="Test Panel 1" />
        </ParallelAgentGrid>
      )

      const gridContainer = screen.getByTestId('grid-container')
      expect(gridContainer).toBeInTheDocument()
    })
  })

  describe('Component Props and Interface', () => {
    it('should have correct displayName', () => {
      expect(ParallelAgentGrid.displayName).toBe('ParallelAgentGrid')
    })

    it('should accept all defined props without TypeScript errors', () => {
      const panels = [
        { panelId: 'panel-1', agentId: 'agent-1', title: 'Agent 1', initialState: 'normal' as PanelDisplayState }
      ]
      const controlledStates = { 'panel-1': 'maximized' as PanelDisplayState }
      const onStateChange = vi.fn()

      // This test verifies that all props are accepted without TypeScript compilation errors
      render(
        <ParallelAgentGrid
          panels={panels}
          controlledStates={controlledStates}
          onStateChange={onStateChange}
          className="test-class"
          debug={true}
        >
          <MockAgentTerminalPanel panelId="panel-1" title="Panel 1" />
        </ParallelAgentGrid>
      )

      const gridContainer = screen.getByTestId('grid-container')
      expect(gridContainer).toBeInTheDocument()
    })
  })
})