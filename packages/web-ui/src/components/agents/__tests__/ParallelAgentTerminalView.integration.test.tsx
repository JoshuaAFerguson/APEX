/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ParallelAgentTerminalView } from '../ParallelAgentTerminalView'
import type {
  ParallelAgentTerminalViewProps,
  ParallelAgentTerminalViewRef,
  AgentTerminalPanelConfig
} from '../ParallelAgentTerminalView.types'

// Mock the dependencies
vi.mock('../AgentTerminalPanel', () => ({
  AgentTerminalPanel: vi.fn(({
    panelId,
    agentId,
    title,
    onMinimize,
    onMaximize,
    onRestore,
    onClose,
    panelState,
    agentStatus
  }) => (
    <div
      data-testid={`agent-terminal-panel-${panelId}`}
      data-panel-state={panelState}
      data-agent-status={agentStatus}
    >
      <h3>{title || `Agent ${agentId}`}</h3>
      <div data-testid={`panel-status-${panelId}`}>Status: {panelState}</div>
      {agentStatus && (
        <div data-testid={`agent-status-${panelId}`}>Agent: {agentStatus}</div>
      )}
      <div className="panel-controls">
        <button
          onClick={() => onMinimize?.()}
          data-testid={`minimize-${panelId}`}
          disabled={panelState === 'minimized'}
        >
          Minimize
        </button>
        <button
          onClick={() => onMaximize?.()}
          data-testid={`maximize-${panelId}`}
          disabled={panelState === 'maximized'}
        >
          Maximize
        </button>
        <button
          onClick={() => onRestore?.()}
          data-testid={`restore-${panelId}`}
          disabled={panelState === 'normal'}
        >
          Restore
        </button>
        <button
          onClick={() => onClose?.()}
          data-testid={`close-${panelId}`}
        >
          Close
        </button>
      </div>
    </div>
  )),
}))

// Enhanced mock for useAgentTerminalPanelState that preserves state across re-renders
const mockState = {
  states: new Map<string, string>(),
  registeredPanels: new Set<string>(),
  maximizedPanel: null as string | null
}

vi.mock('@/hooks/useAgentTerminalPanelState', () => ({
  useAgentTerminalPanelState: vi.fn(({ onStateChange, controlledStates }) => {
    const updateState = (panelId: string, newState: string) => {
      const previousState = mockState.states.get(panelId) || 'normal'

      // Handle maximized state mutual exclusivity
      if (newState === 'maximized') {
        // Clear any other maximized panel
        mockState.states.forEach((state, id) => {
          if (state === 'maximized' && id !== panelId) {
            mockState.states.set(id, 'normal')
          }
        })
        mockState.maximizedPanel = panelId
      } else if (previousState === 'maximized') {
        mockState.maximizedPanel = null
      }

      mockState.states.set(panelId, newState)

      if (onStateChange) {
        const allStates: Record<string, string> = {}
        mockState.states.forEach((state, id) => {
          allStates[id] = state
        })
        onStateChange(panelId, newState, allStates)
      }
    }

    return {
      minimize: vi.fn((panelId) => updateState(panelId, 'minimized')),
      maximize: vi.fn((panelId) => updateState(panelId, 'maximized')),
      restore: vi.fn((panelId) => updateState(panelId, 'normal')),
      restoreAll: vi.fn(() => {
        mockState.states.forEach((_, panelId) => updateState(panelId, 'normal'))
        mockState.maximizedPanel = null
      }),
      getPanelState: vi.fn((panelId) => {
        if (controlledStates && controlledStates[panelId]) {
          return controlledStates[panelId]
        }
        return mockState.states.get(panelId) || 'normal'
      }),
      getAllStates: vi.fn(() => {
        if (controlledStates) return controlledStates
        const result: Record<string, string> = {}
        mockState.states.forEach((state, panelId) => {
          result[panelId] = state
        })
        return result
      }),
      hasMaximizedPanel: mockState.maximizedPanel !== null,
      maximizedPanelId: mockState.maximizedPanel,
      registerPanel: vi.fn((panelId, initialState = 'normal') => {
        mockState.registeredPanels.add(panelId)
        mockState.states.set(panelId, initialState)
        if (initialState === 'maximized') {
          mockState.maximizedPanel = panelId
        }
      }),
      unregisterPanel: vi.fn((panelId) => {
        mockState.registeredPanels.delete(panelId)
        if (mockState.maximizedPanel === panelId) {
          mockState.maximizedPanel = null
        }
        mockState.states.delete(panelId)
      }),
    }
  }),
}))

// Mock console methods to capture warnings
const originalConsole = { ...console }
beforeEach(() => {
  console.warn = vi.fn()
  console.error = vi.fn()
  console.log = vi.fn()

  // Reset mock state between tests
  mockState.states.clear()
  mockState.registeredPanels.clear()
  mockState.maximizedPanel = null
})

afterEach(() => {
  console.warn = originalConsole.warn
  console.error = originalConsole.error
  console.log = originalConsole.log
})

// Test data generators
const createComplexPanels = (): AgentTerminalPanelConfig[] => [
  {
    panelId: 'agent-panel-1',
    agentId: 'agent-001',
    title: 'Data Processing Agent',
    agentStatus: 'running',
    initialState: 'normal',
    autoConnect: true,
    panelProps: { showFilters: true, showSearch: true }
  },
  {
    panelId: 'agent-panel-2',
    agentId: 'agent-002',
    title: 'File Manager Agent',
    agentStatus: 'idle',
    initialState: 'minimized',
    autoConnect: false,
    panelProps: { showFilters: false }
  },
  {
    panelId: 'agent-panel-3',
    agentId: 'agent-003',
    title: 'Network Monitor',
    agentStatus: 'error',
    initialState: 'normal',
    autoConnect: true,
    panelProps: { showSearch: false, verboseMode: true }
  }
]

const createHighVolumeScenario = (): AgentTerminalPanelConfig[] =>
  Array.from({ length: 12 }, (_, i) => ({
    panelId: `high-vol-panel-${i + 1}`,
    agentId: `agent-hv-${String(i + 1).padStart(3, '0')}`,
    title: `Agent ${i + 1} - ${['Processing', 'Monitoring', 'Analyzing', 'Managing'][i % 4]}`,
    agentStatus: ['running', 'idle', 'error', 'stopped'][i % 4] as any,
    initialState: i === 0 ? 'maximized' : 'normal',
    autoConnect: i % 2 === 0,
    panelProps: {
      showFilters: i % 3 === 0,
      showSearch: i % 2 === 0,
      verboseMode: i % 4 === 0
    }
  }))

describe('ParallelAgentTerminalView Integration Tests', () => {
  describe('Complex Multi-Panel Scenarios', () => {
    it('should manage multiple panels with different configurations', async () => {
      const user = userEvent.setup()
      const onPanelStateChange = vi.fn()
      const onPanelClose = vi.fn()

      render(
        <ParallelAgentTerminalView
          panels={createComplexPanels()}
          gap="lg"
          maxHeight="800px"
          onPanelStateChange={onPanelStateChange}
          onPanelClose={onPanelClose}
          testId="complex-terminal-view"
        />
      )

      // Verify all panels are rendered with correct configurations
      expect(screen.getByTestId('agent-terminal-panel-agent-panel-1')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-agent-panel-2')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-agent-panel-3')).toBeInTheDocument()

      // Check panel titles
      expect(screen.getByText('Data Processing Agent')).toBeInTheDocument()
      expect(screen.getByText('File Manager Agent')).toBeInTheDocument()
      expect(screen.getByText('Network Monitor')).toBeInTheDocument()

      // Check initial states
      expect(screen.getByTestId('panel-status-agent-panel-1')).toHaveTextContent('Status: normal')
      expect(screen.getByTestId('panel-status-agent-panel-2')).toHaveTextContent('Status: minimized')
      expect(screen.getByTestId('panel-status-agent-panel-3')).toHaveTextContent('Status: normal')

      // Check agent statuses
      expect(screen.getByTestId('agent-status-agent-panel-1')).toHaveTextContent('Agent: running')
      expect(screen.getByTestId('agent-status-agent-panel-2')).toHaveTextContent('Agent: idle')
      expect(screen.getByTestId('agent-status-agent-panel-3')).toHaveTextContent('Agent: error')

      // Test panel interactions
      await user.click(screen.getByTestId('maximize-agent-panel-1'))
      expect(onPanelStateChange).toHaveBeenCalledWith(
        'agent-panel-1',
        'maximized',
        expect.any(Object)
      )

      await user.click(screen.getByTestId('close-agent-panel-2'))
      expect(onPanelClose).toHaveBeenCalledWith('agent-panel-2')
    })

    it('should handle high-volume scenario with 12 panels', async () => {
      const user = userEvent.setup()
      const panels = createHighVolumeScenario()

      render(
        <ParallelAgentTerminalView
          panels={panels}
          gap="sm"
          maxHeight="600px"
          testId="high-volume-terminal"
        />
      )

      // Check that all 12 panels are rendered
      for (let i = 1; i <= 12; i++) {
        expect(screen.getByTestId(`agent-terminal-panel-high-vol-panel-${i}`)).toBeInTheDocument()
      }

      // Check grid layout classes for high panel count
      const container = screen.getByTestId('high-volume-terminal')
      expect(container).toHaveClass('grid')
      expect(container).toHaveClass('gap-2') // Small gap

      // Check overflow handling
      expect(container).toHaveClass('overflow-y-auto')
      expect(container).toHaveStyle({ maxHeight: '600px' })

      // Test that first panel starts maximized
      expect(screen.getByTestId('panel-status-high-vol-panel-1')).toHaveTextContent('Status: maximized')

      // Test maximization mutual exclusivity
      await user.click(screen.getByTestId('maximize-high-vol-panel-5'))

      // Wait for state updates to propagate
      await waitFor(() => {
        expect(screen.getByTestId('panel-status-high-vol-panel-5')).toHaveTextContent('Status: maximized')
      })
    })

    it('should handle real-world dynamic panel management', async () => {
      const user = userEvent.setup()
      const initialPanels = createComplexPanels()

      const { rerender } = render(
        <ParallelAgentTerminalView
          panels={initialPanels}
          maxHeight="500px"
          testId="dynamic-terminal"
        />
      )

      // Initial state: 3 panels
      expect(screen.getAllByTestId(/agent-terminal-panel-/).length).toBe(3)

      // Add more panels dynamically
      const expandedPanels = [
        ...initialPanels,
        {
          panelId: 'dynamic-panel-4',
          agentId: 'agent-004',
          title: 'API Gateway',
          agentStatus: 'running' as any,
          initialState: 'normal' as any,
          autoConnect: true,
          panelProps: { showMetrics: true }
        },
        {
          panelId: 'dynamic-panel-5',
          agentId: 'agent-005',
          title: 'Cache Manager',
          agentStatus: 'idle' as any,
          initialState: 'normal' as any,
          autoConnect: false,
          panelProps: { showLogs: true }
        }
      ]

      rerender(
        <ParallelAgentTerminalView
          panels={expandedPanels}
          maxHeight="500px"
          testId="dynamic-terminal"
        />
      )

      // Check new panels are added
      expect(screen.getAllByTestId(/agent-terminal-panel-/).length).toBe(5)
      expect(screen.getByText('API Gateway')).toBeInTheDocument()
      expect(screen.getByText('Cache Manager')).toBeInTheDocument()

      // Test state persistence for existing panels
      expect(screen.getByTestId('panel-status-agent-panel-2')).toHaveTextContent('Status: minimized')

      // Remove panels dynamically
      const reducedPanels = expandedPanels.slice(0, 2)

      rerender(
        <ParallelAgentTerminalView
          panels={reducedPanels}
          maxHeight="500px"
          testId="dynamic-terminal"
        />
      )

      // Check panels are removed
      expect(screen.getAllByTestId(/agent-terminal-panel-/).length).toBe(2)
      expect(screen.queryByText('Network Monitor')).not.toBeInTheDocument()
      expect(screen.queryByText('API Gateway')).not.toBeInTheDocument()
    })
  })

  describe('State Management Integration', () => {
    it('should handle controlled vs uncontrolled state modes', async () => {
      const user = userEvent.setup()
      const onStateChange = vi.fn()
      const controlledStates = {
        'ctrl-panel-1': 'normal',
        'ctrl-panel-2': 'maximized',
        'ctrl-panel-3': 'minimized'
      }

      const panels: AgentTerminalPanelConfig[] = [
        { panelId: 'ctrl-panel-1', agentId: 'agent-c1' },
        { panelId: 'ctrl-panel-2', agentId: 'agent-c2' },
        { panelId: 'ctrl-panel-3', agentId: 'agent-c3' }
      ]

      render(
        <ParallelAgentTerminalView
          panels={panels}
          panelStates={controlledStates}
          onPanelStateChange={onStateChange}
          testId="controlled-terminal"
        />
      )

      // Check controlled states are respected
      expect(screen.getByTestId('panel-status-ctrl-panel-1')).toHaveTextContent('Status: normal')
      expect(screen.getByTestId('panel-status-ctrl-panel-2')).toHaveTextContent('Status: maximized')
      expect(screen.getByTestId('panel-status-ctrl-panel-3')).toHaveTextContent('Status: minimized')

      // Test that interactions still trigger callbacks
      await user.click(screen.getByTestId('restore-ctrl-panel-2'))
      expect(onStateChange).toHaveBeenCalledWith('ctrl-panel-2', 'normal', expect.any(Object))

      // Test uncontrolled mode (no panelStates prop)
      const { unmount, rerender } = render(
        <ParallelAgentTerminalView
          panels={panels}
          onPanelStateChange={onStateChange}
          testId="controlled-terminal"
        />
      )

      unmount()

      render(
        <ParallelAgentTerminalView
          panels={panels}
          onPanelStateChange={onStateChange}
          testId="uncontrolled-terminal"
        />
      )

      // All panels should start in normal state (uncontrolled)
      expect(screen.getByTestId('panel-status-ctrl-panel-1')).toHaveTextContent('Status: normal')
      expect(screen.getByTestId('panel-status-ctrl-panel-2')).toHaveTextContent('Status: normal')
      expect(screen.getByTestId('panel-status-ctrl-panel-3')).toHaveTextContent('Status: normal')
    })

    it('should handle imperative API through ref', async () => {
      const user = userEvent.setup()
      const panels = createComplexPanels()
      const ref = React.createRef<ParallelAgentTerminalViewRef>()

      // Mock DOM methods for focusPanel test
      const mockFocus = vi.fn()
      const mockScrollIntoView = vi.fn()
      const mockElement = {
        focus: mockFocus,
        scrollIntoView: mockScrollIntoView
      }

      const originalQuerySelector = document.querySelector
      document.querySelector = vi.fn((selector) => {
        if (selector.includes('agent-panel-1')) {
          return mockElement as any
        }
        return null
      })

      render(
        <ParallelAgentTerminalView
          panels={panels}
          ref={ref}
          testId="ref-terminal"
        />
      )

      // Test ref API methods
      expect(ref.current).toBeTruthy()
      expect(typeof ref.current!.minimizeAll).toBe('function')
      expect(typeof ref.current!.restoreAll).toBe('function')
      expect(typeof ref.current!.getAllStates).toBe('function')
      expect(typeof ref.current!.maximizePanel).toBe('function')
      expect(typeof ref.current!.focusPanel).toBe('function')

      // Test minimizeAll
      act(() => {
        ref.current!.minimizeAll()
      })

      // Test maximizePanel
      act(() => {
        ref.current!.maximizePanel('agent-panel-1')
      })

      // Test focusPanel
      act(() => {
        ref.current!.focusPanel('agent-panel-1')
      })

      expect(mockFocus).toHaveBeenCalled()
      expect(mockScrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      })

      // Test getAllStates
      const states = ref.current!.getAllStates()
      expect(typeof states).toBe('object')

      // Restore original querySelector
      document.querySelector = originalQuerySelector
    })
  })

  describe('Responsive Behavior Integration', () => {
    it('should adapt layout based on viewport and panel count', async () => {
      const testCases = [
        { count: 2, expectedClasses: 'grid' },
        { count: 4, expectedClasses: 'grid' },
        { count: 8, expectedClasses: 'grid' },
        { count: 12, expectedClasses: 'grid' }
      ]

      for (const { count, expectedClasses } of testCases) {
        const panels = Array.from({ length: count }, (_, i) => ({
          panelId: `responsive-panel-${i + 1}`,
          agentId: `agent-${i + 1}`
        }))

        const { unmount } = render(
          <ParallelAgentTerminalView
            panels={panels}
            testId={`responsive-${count}`}
          />
        )

        const container = screen.getByTestId(`responsive-${count}`)
        expect(container).toHaveClass(expectedClasses)

        // Check responsive classes are applied
        const containerClasses = container.className
        expect(containerClasses).toMatch(/sm:grid-cols-/)
        expect(containerClasses).toMatch(/lg:grid-cols-/)

        unmount()
      }
    })

    it('should handle maximized state responsive behavior', async () => {
      const user = userEvent.setup()
      const panels = Array.from({ length: 6 }, (_, i) => ({
        panelId: `max-responsive-panel-${i + 1}`,
        agentId: `agent-${i + 1}`
      }))

      render(
        <ParallelAgentTerminalView
          panels={panels}
          testId="max-responsive-terminal"
        />
      )

      const container = screen.getByTestId('max-responsive-terminal')

      // Initially should have multi-column grid layout
      expect(container).toHaveClass('grid')
      expect(container.className).toMatch(/grid-cols-\d+/)

      // Maximize a panel
      await user.click(screen.getByTestId('maximize-max-responsive-panel-3'))

      // Container should switch to single column when maximized
      await waitFor(() => {
        expect(container).toHaveClass('grid-cols-1')
      })

      // Restore panel
      await user.click(screen.getByTestId('restore-max-responsive-panel-3'))

      // Should return to multi-column layout
      await waitFor(() => {
        expect(container.className).toMatch(/sm:grid-cols-|lg:grid-cols-|xl:grid-cols-/)
      })
    })
  })

  describe('Performance and Warning Integration', () => {
    it('should log appropriate warnings in development mode', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      // Test with high panel count
      const highCountPanels = Array.from({ length: 11 }, (_, i) => ({
        panelId: `perf-panel-${i + 1}`,
        agentId: `agent-${i + 1}`
      }))

      render(
        <ParallelAgentTerminalView
          panels={highCountPanels}
          testId="performance-terminal"
        />
      )

      // Check that performance warnings are logged
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(/performance/)
      )
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(/mobile|smaller screens/)
      )

      process.env.NODE_ENV = originalEnv
    })

    it('should handle error scenarios gracefully', () => {
      // Test with panels that exceed maximum
      const excessivePanels = Array.from({ length: 15 }, (_, i) => ({
        panelId: `excess-panel-${i + 1}`,
        agentId: `agent-${i + 1}`
      }))

      render(
        <ParallelAgentTerminalView
          panels={excessivePanels}
          testId="excessive-terminal"
        />
      )

      // Should only render first 12 panels
      expect(screen.getAllByTestId(/agent-terminal-panel-/).length).toBe(12)

      // Should warn about excess panels in development
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const { rerender } = render(
        <ParallelAgentTerminalView
          panels={excessivePanels}
          testId="excessive-terminal-dev"
        />
      )

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(/Maximum 12 panels supported.*15 panels provided/)
      )

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('Real-world Usage Patterns', () => {
    it('should support monitoring dashboard scenario', async () => {
      const user = userEvent.setup()
      const monitoringPanels: AgentTerminalPanelConfig[] = [
        {
          panelId: 'cpu-monitor',
          agentId: 'monitor-cpu',
          title: 'CPU Monitor',
          agentStatus: 'running',
          initialState: 'normal',
          panelProps: { showMetrics: true, refreshRate: 1000 }
        },
        {
          panelId: 'memory-monitor',
          agentId: 'monitor-memory',
          title: 'Memory Monitor',
          agentStatus: 'running',
          initialState: 'normal',
          panelProps: { showMetrics: true, refreshRate: 2000 }
        },
        {
          panelId: 'network-monitor',
          agentId: 'monitor-network',
          title: 'Network Monitor',
          agentStatus: 'idle',
          initialState: 'minimized',
          panelProps: { showGraphs: true }
        },
        {
          panelId: 'error-log',
          agentId: 'logger-error',
          title: 'Error Logger',
          agentStatus: 'error',
          initialState: 'normal',
          panelProps: { filterLevel: 'error' }
        }
      ]

      const onPanelStateChange = vi.fn()

      render(
        <ParallelAgentTerminalView
          panels={monitoringPanels}
          gap="md"
          maxHeight="100vh"
          displayMode="compact"
          onPanelStateChange={onPanelStateChange}
          testId="monitoring-dashboard"
        />
      )

      // Verify monitoring setup
      expect(screen.getByText('CPU Monitor')).toBeInTheDocument()
      expect(screen.getByText('Memory Monitor')).toBeInTheDocument()
      expect(screen.getByText('Network Monitor')).toBeInTheDocument()
      expect(screen.getByText('Error Logger')).toBeInTheDocument()

      // Check initial states match monitoring needs
      expect(screen.getByTestId('panel-status-cpu-monitor')).toHaveTextContent('Status: normal')
      expect(screen.getByTestId('panel-status-memory-monitor')).toHaveTextContent('Status: normal')
      expect(screen.getByTestId('panel-status-network-monitor')).toHaveTextContent('Status: minimized')
      expect(screen.getByTestId('panel-status-error-log')).toHaveTextContent('Status: normal')

      // Test maximizing error panel for investigation
      await user.click(screen.getByTestId('maximize-error-log'))
      expect(onPanelStateChange).toHaveBeenCalledWith('error-log', 'maximized', expect.any(Object))

      // Test expanding minimized network panel
      await user.click(screen.getByTestId('restore-network-monitor'))
      expect(onPanelStateChange).toHaveBeenCalledWith('network-monitor', 'normal', expect.any(Object))
    })

    it('should support development workflow scenario', async () => {
      const user = userEvent.setup()
      const devPanels: AgentTerminalPanelConfig[] = [
        {
          panelId: 'build-agent',
          agentId: 'dev-build',
          title: 'Build Process',
          agentStatus: 'running',
          initialState: 'normal',
          panelProps: { showProgress: true }
        },
        {
          panelId: 'test-runner',
          agentId: 'dev-test',
          title: 'Test Runner',
          agentStatus: 'idle',
          initialState: 'normal',
          panelProps: { showResults: true, autoRefresh: true }
        },
        {
          panelId: 'linter',
          agentId: 'dev-lint',
          title: 'Code Linter',
          agentStatus: 'running',
          initialState: 'minimized',
          panelProps: { showWarnings: false }
        },
        {
          panelId: 'dev-server',
          agentId: 'dev-server',
          title: 'Development Server',
          agentStatus: 'running',
          initialState: 'normal',
          panelProps: { showRequests: true }
        }
      ]

      const onPanelClose = vi.fn()

      render(
        <ParallelAgentTerminalView
          panels={devPanels}
          gap="lg"
          maxHeight="80vh"
          displayMode="verbose"
          onPanelClose={onPanelClose}
          testId="dev-workflow"
        />
      )

      // Test development workflow interactions
      expect(screen.getByText('Build Process')).toBeInTheDocument()
      expect(screen.getByText('Test Runner')).toBeInTheDocument()

      // Close linter (not needed for current task)
      await user.click(screen.getByTestId('close-linter'))
      expect(onPanelClose).toHaveBeenCalledWith('linter')

      // Maximize test runner to focus on failures
      await user.click(screen.getByTestId('maximize-test-runner'))

      // Verify only test runner is visible when maximized
      await waitFor(() => {
        expect(screen.getByTestId('panel-status-test-runner')).toHaveTextContent('Status: maximized')
      })
    })
  })

  describe('Accessibility Integration', () => {
    it('should maintain accessibility across state changes', async () => {
      const user = userEvent.setup()
      const panels = createComplexPanels()

      render(
        <ParallelAgentTerminalView
          panels={panels}
          testId="accessible-terminal"
        />
      )

      const container = screen.getByTestId('accessible-terminal')

      // Check ARIA attributes
      expect(container).toHaveAttribute('role', 'region')
      expect(container).toHaveAttribute('aria-label', 'Parallel agent terminals (3 panels)')
      expect(container).toHaveAttribute('aria-describedby', 'accessible-terminal-description')

      // Check description element
      const description = screen.getByText(/Grid of 3 agent terminal panels/)
      expect(description).toHaveClass('sr-only')

      // Test state changes maintain accessibility
      await user.click(screen.getByTestId('maximize-agent-panel-1'))

      await waitFor(() => {
        const updatedDescription = screen.getByText(/Panel agent-panel-1 is currently maximized/)
        expect(updatedDescription).toBeInTheDocument()
      })

      // Test keyboard navigation support
      const panelWrappers = container.querySelectorAll('[data-panel-id]')
      panelWrappers.forEach(wrapper => {
        expect(wrapper).toHaveClass('focus-within:ring-2')
      })
    })

    it('should provide proper focus management', async () => {
      const panels = createComplexPanels()
      const ref = React.createRef<ParallelAgentTerminalViewRef>()

      // Mock focus and scrolling
      const mockFocus = vi.fn()
      const mockScrollIntoView = vi.fn()
      const mockElement = { focus: mockFocus, scrollIntoView: mockScrollIntoView }

      document.querySelector = vi.fn(() => mockElement as any)

      render(
        <ParallelAgentTerminalView
          panels={panels}
          ref={ref}
          testId="focus-terminal"
        />
      )

      // Test programmatic focus
      act(() => {
        ref.current!.focusPanel('agent-panel-2')
      })

      expect(document.querySelector).toHaveBeenCalledWith(
        '[data-testid="focus-terminal"] [data-panel-id="agent-panel-2"]'
      )
      expect(mockFocus).toHaveBeenCalled()
      expect(mockScrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      })
    })
  })
})