/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ParallelAgentTerminalView } from '../ParallelAgentTerminalView'
import type {
  ParallelAgentTerminalViewProps,
  AgentTerminalPanelConfig
} from '../ParallelAgentTerminalView.types'
import { validatePanelConfigurations } from '../ParallelAgentTerminalView.utils'

// Mock the dependencies
vi.mock('../AgentTerminalPanel', () => ({
  AgentTerminalPanel: vi.fn(({ panelId, agentId, title, onMinimize, onMaximize, onRestore, onClose, panelState }) => (
    <div data-testid={`agent-terminal-panel-${panelId}`} data-panel-state={panelState}>
      <div>{title || `Agent ${agentId}`}</div>
      <button onClick={() => onMinimize?.()} data-testid={`minimize-${panelId}`}>
        Minimize
      </button>
      <button onClick={() => onMaximize?.()} data-testid={`maximize-${panelId}`}>
        Maximize
      </button>
      <button onClick={() => onRestore?.()} data-testid={`restore-${panelId}`}>
        Restore
      </button>
      <button onClick={() => onClose?.()} data-testid={`close-${panelId}`}>
        Close
      </button>
    </div>
  )),
}))

vi.mock('@/hooks/useAgentTerminalPanelState', () => ({
  useAgentTerminalPanelState: vi.fn(({ onStateChange }) => {
    const states = new Map()
    const registeredPanels = new Set()

    return {
      minimize: vi.fn((panelId) => {
        states.set(panelId, 'minimized')
        if (onStateChange) {
          onStateChange(panelId, 'minimized', { [panelId]: 'minimized' })
        }
      }),
      maximize: vi.fn((panelId) => {
        states.set(panelId, 'maximized')
        if (onStateChange) {
          onStateChange(panelId, 'maximized', { [panelId]: 'maximized' })
        }
      }),
      restore: vi.fn((panelId) => {
        states.set(panelId, 'normal')
        if (onStateChange) {
          onStateChange(panelId, 'normal', { [panelId]: 'normal' })
        }
      }),
      restoreAll: vi.fn(() => {
        states.forEach((_, panelId) => states.set(panelId, 'normal'))
      }),
      getPanelState: vi.fn((panelId) => states.get(panelId) || 'normal'),
      getAllStates: vi.fn(() => {
        const result: Record<string, string> = {}
        states.forEach((state, panelId) => {
          result[panelId] = state
        })
        return result
      }),
      hasMaximizedPanel: false,
      maximizedPanelId: null,
      registerPanel: vi.fn((panelId, initialState = 'normal') => {
        registeredPanels.add(panelId)
        states.set(panelId, initialState)
      }),
      unregisterPanel: vi.fn((panelId) => {
        registeredPanels.delete(panelId)
        states.delete(panelId)
      }),
    }
  }),
}))

// Mock console methods
const originalConsole = { ...console }
beforeEach(() => {
  console.warn = vi.fn()
  console.error = vi.fn()
})

afterEach(() => {
  console.warn = originalConsole.warn
  console.error = originalConsole.error
})

// Test data
const createMockPanels = (count: number): AgentTerminalPanelConfig[] => {
  return Array.from({ length: count }, (_, i) => ({
    panelId: `panel-${i + 1}`,
    agentId: `agent-${i + 1}`,
    title: `Agent ${i + 1}`,
    autoConnect: true,
  }))
}

const defaultProps: ParallelAgentTerminalViewProps = {
  panels: createMockPanels(2),
  gap: 'md',
  maxHeight: 'auto',
}

describe('ParallelAgentTerminalView', () => {
  describe('Basic Rendering', () => {
    it('renders with minimum required props', () => {
      render(<ParallelAgentTerminalView {...defaultProps} />)

      expect(screen.getByTestId('parallel-agent-terminal-view')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-panel-1')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-panel-2')).toBeInTheDocument()
    })

    it('renders correct number of panels', () => {
      const panels = createMockPanels(4)
      render(<ParallelAgentTerminalView panels={panels} />)

      panels.forEach((panel) => {
        expect(screen.getByTestId(`agent-terminal-panel-${panel.panelId}`)).toBeInTheDocument()
      })
    })

    it('applies custom className', () => {
      render(<ParallelAgentTerminalView {...defaultProps} className="custom-class" />)

      const container = screen.getByTestId('parallel-agent-terminal-view')
      expect(container).toHaveClass('custom-class')
    })

    it('uses custom testId', () => {
      render(<ParallelAgentTerminalView {...defaultProps} testId="custom-test-id" />)

      expect(screen.getByTestId('custom-test-id')).toBeInTheDocument()
    })
  })

  describe('Panel Configuration Validation', () => {
    it('handles empty panels array', () => {
      render(<ParallelAgentTerminalView panels={[]} />)

      expect(screen.getByTestId('parallel-agent-terminal-view-empty')).toBeInTheDocument()
      expect(screen.getByText('No agent terminals to display')).toBeInTheDocument()
    })

    it('validates panel configurations', () => {
      expect(() => {
        validatePanelConfigurations([
          { panelId: '', agentId: 'agent-1' }, // Missing panelId
        ])
      }).not.toThrow()

      const validation = validatePanelConfigurations([
        { panelId: '', agentId: 'agent-1' },
      ])
      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain("Panel at index 0 missing required 'panelId' field")
    })

    it('throws error for invalid panel configurations', () => {
      expect(() => {
        render(
          <ParallelAgentTerminalView
            panels={[
              { panelId: '', agentId: 'agent-1' } as any, // Invalid config
            ]}
          />
        )
      }).toThrow(/ParallelAgentTerminalView validation failed/)
    })

    it('limits panels to maximum of 12', () => {
      const panels = createMockPanels(15) // More than max
      render(<ParallelAgentTerminalView panels={panels} />)

      // Should only render first 12 panels
      for (let i = 1; i <= 12; i++) {
        expect(screen.getByTestId(`agent-terminal-panel-panel-${i}`)).toBeInTheDocument()
      }

      // Should not render panels 13-15
      for (let i = 13; i <= 15; i++) {
        expect(screen.queryByTestId(`agent-terminal-panel-panel-${i}`)).not.toBeInTheDocument()
      }
    })
  })

  describe('Grid Layout', () => {
    it('applies correct grid classes for different panel counts', () => {
      const testCases = [1, 2, 3, 4, 6, 8, 12]

      testCases.forEach((count) => {
        const { unmount } = render(
          <ParallelAgentTerminalView panels={createMockPanels(count)} testId={`test-${count}`} />
        )

        const container = screen.getByTestId(`test-${count}`)
        expect(container).toHaveClass('grid')

        unmount()
      })
    })

    it('applies custom gap sizes', () => {
      const { rerender } = render(<ParallelAgentTerminalView {...defaultProps} gap="sm" />)
      let container = screen.getByTestId('parallel-agent-terminal-view')
      expect(container).toHaveClass('gap-2')

      rerender(<ParallelAgentTerminalView {...defaultProps} gap="md" />)
      container = screen.getByTestId('parallel-agent-terminal-view')
      expect(container).toHaveClass('gap-4')

      rerender(<ParallelAgentTerminalView {...defaultProps} gap="lg" />)
      container = screen.getByTestId('parallel-agent-terminal-view')
      expect(container).toHaveClass('gap-6')
    })

    it('handles maxHeight settings', () => {
      const { rerender } = render(
        <ParallelAgentTerminalView {...defaultProps} maxHeight="500px" />
      )
      let container = screen.getByTestId('parallel-agent-terminal-view')
      expect(container).toHaveStyle({ maxHeight: '500px' })
      expect(container).toHaveClass('overflow-y-auto')

      rerender(<ParallelAgentTerminalView {...defaultProps} maxHeight="auto" />)
      container = screen.getByTestId('parallel-agent-terminal-view')
      expect(container).not.toHaveStyle({ maxHeight: '500px' })
    })
  })

  describe('Panel State Management', () => {
    it('handles panel minimize/maximize/restore actions', async () => {
      const user = userEvent.setup()
      render(<ParallelAgentTerminalView {...defaultProps} />)

      // Test minimize
      const minimizeButton = screen.getByTestId('minimize-panel-1')
      await user.click(minimizeButton)

      // Test maximize
      const maximizeButton = screen.getByTestId('maximize-panel-1')
      await user.click(maximizeButton)

      // Test restore
      const restoreButton = screen.getByTestId('restore-panel-1')
      await user.click(restoreButton)
    })

    it('calls onPanelStateChange when panel states change', async () => {
      const onPanelStateChange = vi.fn()
      const user = userEvent.setup()

      render(
        <ParallelAgentTerminalView
          {...defaultProps}
          onPanelStateChange={onPanelStateChange}
        />
      )

      const minimizeButton = screen.getByTestId('minimize-panel-1')
      await user.click(minimizeButton)

      // Note: The actual call would happen in the hook, this tests the wiring
      expect(onPanelStateChange).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Object)
      )
    })

    it('calls onPanelClose when panel is closed', async () => {
      const onPanelClose = vi.fn()
      const user = userEvent.setup()

      render(
        <ParallelAgentTerminalView
          {...defaultProps}
          onPanelClose={onPanelClose}
        />
      )

      const closeButton = screen.getByTestId('close-panel-1')
      await user.click(closeButton)

      expect(onPanelClose).toHaveBeenCalledWith('panel-1')
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<ParallelAgentTerminalView {...defaultProps} />)

      const container = screen.getByTestId('parallel-agent-terminal-view')
      expect(container).toHaveAttribute('role', 'region')
      expect(container).toHaveAttribute('aria-label', 'Parallel agent terminals (2 panels)')
      expect(container).toHaveAttribute('aria-describedby')
    })

    it('provides screen reader description', () => {
      render(<ParallelAgentTerminalView {...defaultProps} />)

      const description = screen.getByText(/Grid of 2 agent terminal panels/)
      expect(description).toHaveClass('sr-only')
    })

    it('supports keyboard navigation focus styles', () => {
      render(<ParallelAgentTerminalView {...defaultProps} />)

      const panelContainers = screen.getAllByTestId(/agent-terminal-panel-/)
      panelContainers.forEach(container => {
        expect(container.parentElement).toHaveClass('focus-within:ring-2')
      })
    })
  })

  describe('Imperative API (Ref)', () => {
    it('exposes ref methods for external control', () => {
      const ref = React.createRef<any>()
      render(<ParallelAgentTerminalView {...defaultProps} ref={ref} />)

      expect(ref.current).toHaveProperty('minimizeAll')
      expect(ref.current).toHaveProperty('restoreAll')
      expect(ref.current).toHaveProperty('getAllStates')
      expect(ref.current).toHaveProperty('maximizePanel')
      expect(ref.current).toHaveProperty('focusPanel')
    })

    it('minimizeAll method works correctly', () => {
      const ref = React.createRef<any>()
      render(<ParallelAgentTerminalView {...defaultProps} ref={ref} />)

      expect(() => ref.current.minimizeAll()).not.toThrow()
    })

    it('focusPanel method attempts to focus panel', () => {
      const ref = React.createRef<any>()
      render(<ParallelAgentTerminalView {...defaultProps} ref={ref} />)

      // Mock querySelector and focus
      const mockElement = {
        focus: vi.fn(),
        scrollIntoView: vi.fn(),
      }
      const originalQuerySelector = document.querySelector
      document.querySelector = vi.fn(() => mockElement as any)

      ref.current.focusPanel('panel-1')

      expect(mockElement.focus).toHaveBeenCalled()
      expect(mockElement.scrollIntoView).toHaveBeenCalled()

      document.querySelector = originalQuerySelector
    })
  })

  describe('Props Forwarding', () => {
    it('forwards panelProps to AgentTerminalPanel', () => {
      const panels: AgentTerminalPanelConfig[] = [
        {
          panelId: 'panel-1',
          agentId: 'agent-1',
          panelProps: {
            showFilters: true,
            showSearch: true,
          },
        },
      ]

      render(<ParallelAgentTerminalView panels={panels} />)

      // The mock component will receive all props including panelProps spread
      expect(screen.getByTestId('agent-terminal-panel-panel-1')).toBeInTheDocument()
    })

    it('forwards displayMode to all panels', () => {
      render(
        <ParallelAgentTerminalView
          {...defaultProps}
          displayMode="compact"
        />
      )

      // Mock component would receive displayMode prop
      expect(screen.getByTestId('agent-terminal-panel-panel-1')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-panel-2')).toBeInTheDocument()
    })
  })

  describe('Performance and Warnings', () => {
    it('logs performance warnings for high panel counts in development', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const panels = createMockPanels(10)
      render(<ParallelAgentTerminalView panels={panels} />)

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(/ParallelAgentTerminalView.*performance/)
      )

      process.env.NODE_ENV = originalEnv
    })

    it('logs responsive warnings for many panels in development', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const panels = createMockPanels(8)
      render(<ParallelAgentTerminalView panels={panels} />)

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(/ParallelAgentTerminalView.*mobile/)
      )

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('Edge Cases', () => {
    it('handles panels with missing optional properties', () => {
      const panels: AgentTerminalPanelConfig[] = [
        {
          panelId: 'panel-1',
          agentId: 'agent-1',
          // No title, status, etc.
        },
      ]

      render(<ParallelAgentTerminalView panels={panels} />)

      expect(screen.getByTestId('agent-terminal-panel-panel-1')).toBeInTheDocument()
      expect(screen.getByText('Agent agent-1')).toBeInTheDocument() // Default title
    })

    it('handles rapid prop changes', async () => {
      const { rerender } = render(<ParallelAgentTerminalView panels={createMockPanels(2)} />)

      // Rapidly change panel configurations
      rerender(<ParallelAgentTerminalView panels={createMockPanels(4)} />)
      rerender(<ParallelAgentTerminalView panels={createMockPanels(1)} />)
      rerender(<ParallelAgentTerminalView panels={createMockPanels(6)} />)

      // Should not crash and should show latest configuration
      expect(screen.getAllByTestId(/agent-terminal-panel-/).length).toBe(6)
    })

    it('handles duplicate agentIds gracefully', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const panels: AgentTerminalPanelConfig[] = [
        { panelId: 'panel-1', agentId: 'agent-1' },
        { panelId: 'panel-2', agentId: 'agent-1' }, // Duplicate agentId
      ]

      render(<ParallelAgentTerminalView panels={panels} />)

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(/Duplicate agentId 'agent-1'/)
      )

      process.env.NODE_ENV = originalEnv
    })
  })
})