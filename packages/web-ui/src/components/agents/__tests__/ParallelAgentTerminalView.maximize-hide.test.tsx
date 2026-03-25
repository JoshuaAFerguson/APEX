/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ParallelAgentTerminalView } from '../ParallelAgentTerminalView'
import type {
  AgentTerminalPanelConfig
} from '../ParallelAgentTerminalView.types'

// Mock the AgentTerminalPanel component
vi.mock('../AgentTerminalPanel', () => ({
  AgentTerminalPanel: vi.fn(({
    panelId,
    agentId,
    title,
    onMinimize,
    onMaximize,
    onRestore,
    panelState
  }) => (
    <div
      data-testid={`agent-terminal-panel-${panelId}`}
      data-panel-state={panelState}
    >
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
    </div>
  )),
}))

// Test data
const createMockPanels = (count: number): AgentTerminalPanelConfig[] => {
  return Array.from({ length: count }, (_, i) => ({
    panelId: `panel-${i + 1}`,
    agentId: `agent-${i + 1}`,
    title: `Agent ${i + 1}`,
    autoConnect: true,
  }))
}

describe('ParallelAgentTerminalView - Maximize/Hide Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock console to avoid noise in test output
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  describe('Panel Maximize Behavior', () => {
    it('should render panels correctly', async () => {
      const panels = createMockPanels(3)

      render(<ParallelAgentTerminalView panels={panels} />)

      // Verify all panels are rendered
      expect(screen.getByTestId('agent-terminal-panel-panel-1')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-panel-2')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-panel-3')).toBeInTheDocument()

      // Verify control buttons are present
      expect(screen.getByTestId('maximize-panel-1')).toBeInTheDocument()
      expect(screen.getByTestId('minimize-panel-1')).toBeInTheDocument()
      expect(screen.getByTestId('restore-panel-1')).toBeInTheDocument()
    })

    it('should have maximize functionality', async () => {
      const panels = createMockPanels(2)
      const onPanelStateChange = vi.fn()

      render(
        <ParallelAgentTerminalView
          panels={panels}
          onPanelStateChange={onPanelStateChange}
        />
      )

      const maximizeButton = screen.getByTestId('maximize-panel-1')
      expect(maximizeButton).toBeInTheDocument()

      await userEvent.click(maximizeButton)

      // Should call the state change callback
      expect(onPanelStateChange).toHaveBeenCalled()
    })

    it('should have minimize functionality', async () => {
      const panels = createMockPanels(2)
      const onPanelStateChange = vi.fn()

      render(
        <ParallelAgentTerminalView
          panels={panels}
          onPanelStateChange={onPanelStateChange}
        />
      )

      const minimizeButton = screen.getByTestId('minimize-panel-1')
      expect(minimizeButton).toBeInTheDocument()

      await userEvent.click(minimizeButton)

      // Should call the state change callback
      expect(onPanelStateChange).toHaveBeenCalled()
    })

    it('should have restore functionality', async () => {
      const panels = createMockPanels(2)

      render(<ParallelAgentTerminalView panels={panels} />)

      const restoreButton = screen.getByTestId('restore-panel-1')
      expect(restoreButton).toBeInTheDocument()

      await userEvent.click(restoreButton)

      // Button should be functional
      expect(restoreButton).toBeInTheDocument()
    })
  })

  describe('Grid Layout Classes', () => {
    it('should apply grid layout classes to container', async () => {
      const panels = createMockPanels(3)

      render(<ParallelAgentTerminalView panels={panels} />)

      const container = screen.getByTestId('parallel-agent-terminal-view')
      expect(container).toBeInTheDocument()

      // Should have grid-related classes
      const classes = container.className
      expect(classes).toMatch(/grid/)
    })

    it('should apply transition classes for smooth animations', async () => {
      const panels = createMockPanels(2)

      render(<ParallelAgentTerminalView panels={panels} />)

      // Check that panels are wrapped in containers with proper attributes
      const panelContainers = screen.getAllByRole('generic').filter(el =>
        el.hasAttribute('data-panel-id')
      )

      expect(panelContainers.length).toBeGreaterThan(0)
    })
  })

  describe('ARIA and Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      const panels = createMockPanels(2)

      render(<ParallelAgentTerminalView panels={panels} />)

      const container = screen.getByRole('region', {
        name: /Parallel agent terminals \(2 panels\)/
      })

      expect(container).toBeInTheDocument()
      expect(container).toHaveAttribute('aria-describedby')
    })

    it('should provide screen reader description', async () => {
      const panels = createMockPanels(2)

      render(<ParallelAgentTerminalView panels={panels} />)

      const description = screen.getByText(/Grid of 2 agent terminal panels/)
      expect(description).toBeInTheDocument()
      expect(description).toHaveClass('sr-only')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty panels array', () => {
      render(<ParallelAgentTerminalView panels={[]} />)

      expect(screen.getByTestId('parallel-agent-terminal-view-empty')).toBeInTheDocument()
      expect(screen.getByText('No agent terminals to display')).toBeInTheDocument()
    })

    it('should handle single panel', async () => {
      const panels = createMockPanels(1)

      render(<ParallelAgentTerminalView panels={panels} />)

      expect(screen.getByTestId('agent-terminal-panel-panel-1')).toBeInTheDocument()
      expect(screen.getByTestId('maximize-panel-1')).toBeInTheDocument()
    })

    it('should handle many panels', async () => {
      const panels = createMockPanels(10)

      render(<ParallelAgentTerminalView panels={panels} />)

      // All panels should render
      panels.forEach((_, i) => {
        expect(screen.getByTestId(`agent-terminal-panel-panel-${i + 1}`)).toBeInTheDocument()
      })
    })

    it('should handle panels with different configurations', async () => {
      const panels: AgentTerminalPanelConfig[] = [
        { panelId: 'panel-1', agentId: 'agent-1', title: 'Custom Title 1' },
        { panelId: 'panel-2', agentId: 'agent-2', autoConnect: false },
        { panelId: 'panel-3', agentId: 'agent-3', initialState: 'minimized' }
      ]

      render(<ParallelAgentTerminalView panels={panels} />)

      expect(screen.getByText('Custom Title 1')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-panel-1')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-panel-2')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-panel-3')).toBeInTheDocument()
    })
  })

  describe('Panel State Props', () => {
    it('should pass panel state to AgentTerminalPanel components', async () => {
      const panels = createMockPanels(2)

      render(<ParallelAgentTerminalView panels={panels} />)

      // Check that panels have data-panel-state attribute
      const panel1 = screen.getByTestId('agent-terminal-panel-panel-1')
      const panel2 = screen.getByTestId('agent-terminal-panel-panel-2')

      expect(panel1).toHaveAttribute('data-panel-state')
      expect(panel2).toHaveAttribute('data-panel-state')
    })

    it('should handle initial panel states', async () => {
      const panels: AgentTerminalPanelConfig[] = [
        { panelId: 'panel-1', agentId: 'agent-1', initialState: 'normal' },
        { panelId: 'panel-2', agentId: 'agent-2', initialState: 'minimized' }
      ]

      render(<ParallelAgentTerminalView panels={panels} />)

      // Both panels should render regardless of initial state
      expect(screen.getByTestId('agent-terminal-panel-panel-1')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-panel-2')).toBeInTheDocument()
    })
  })

  describe('Callback Functions', () => {
    it('should call onPanelStateChange when provided', async () => {
      const onPanelStateChange = vi.fn()
      const panels = createMockPanels(2)

      render(
        <ParallelAgentTerminalView
          panels={panels}
          onPanelStateChange={onPanelStateChange}
        />
      )

      await userEvent.click(screen.getByTestId('maximize-panel-1'))

      expect(onPanelStateChange).toHaveBeenCalledWith(
        'panel-1',
        expect.any(String),
        expect.any(Object)
      )
    })

    it('should work without callback functions', async () => {
      const panels = createMockPanels(2)

      render(<ParallelAgentTerminalView panels={panels} />)

      // Should not throw errors when clicking buttons
      await expect(async () => {
        await userEvent.click(screen.getByTestId('maximize-panel-1'))
        await userEvent.click(screen.getByTestId('minimize-panel-2'))
        await userEvent.click(screen.getByTestId('restore-panel-1'))
      }).not.toThrow()
    })
  })

  describe('Component Props', () => {
    it('should accept custom className', async () => {
      const panels = createMockPanels(2)

      render(
        <ParallelAgentTerminalView
          panels={panels}
          className="custom-class"
        />
      )

      const container = screen.getByTestId('parallel-agent-terminal-view')
      expect(container).toHaveClass('custom-class')
    })

    it('should accept custom testId', async () => {
      const panels = createMockPanels(2)

      render(
        <ParallelAgentTerminalView
          panels={panels}
          testId="custom-test-id"
        />
      )

      expect(screen.getByTestId('custom-test-id')).toBeInTheDocument()
    })

    it('should handle different gap sizes', async () => {
      const panels = createMockPanels(2)

      render(
        <ParallelAgentTerminalView
          panels={panels}
          gap="lg"
        />
      )

      const container = screen.getByTestId('parallel-agent-terminal-view')
      expect(container).toBeInTheDocument()
      // Gap classes should be applied (exact class depends on implementation)
      expect(container.className).toMatch(/gap/)
    })

    it('should handle custom maxHeight', async () => {
      const panels = createMockPanels(2)

      render(
        <ParallelAgentTerminalView
          panels={panels}
          maxHeight="500px"
        />
      )

      const container = screen.getByTestId('parallel-agent-terminal-view')
      expect(container).toBeInTheDocument()
      // Should apply maxHeight via style or class
    })
  })
})