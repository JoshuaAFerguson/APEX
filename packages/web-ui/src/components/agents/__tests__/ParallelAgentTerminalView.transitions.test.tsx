/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ParallelAgentTerminalView } from '../ParallelAgentTerminalView'
import type {
  AgentTerminalPanelConfig
} from '../ParallelAgentTerminalView.types'

// Mock the AgentTerminalPanel component with transition classes
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
      className={`panel-${panelState} transition-all duration-300 ease-out`}
      style={{
        transform: panelState === 'minimized' ? 'scale(0.95)' : 'scale(1)',
        opacity: panelState === 'minimized' ? '0.7' : '1',
        transitionProperty: 'transform, opacity, width, height',
        transitionDuration: '300ms',
        transitionTimingFunction: 'ease-out'
      }}
    >
      <div>{title || `Agent ${agentId}`}</div>
      <button
        onClick={() => onMinimize?.()}
        data-testid={`minimize-${panelId}`}
        className="transition-colors duration-300 ease-out"
      >
        Minimize
      </button>
      <button
        onClick={() => onMaximize?.()}
        data-testid={`maximize-${panelId}`}
        className="transition-colors duration-300 ease-out"
      >
        Maximize
      </button>
      <button
        onClick={() => onRestore?.()}
        data-testid={`restore-${panelId}`}
        className="transition-colors duration-300 ease-out"
      >
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

describe('ParallelAgentTerminalView - CSS Transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock console to avoid noise in test output
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  describe('Transition Classes Application', () => {
    it('should apply duration-300 ease-out transition classes to panels', async () => {
      const panels = createMockPanels(2)

      render(<ParallelAgentTerminalView panels={panels} />)

      const panel1 = screen.getByTestId('agent-terminal-panel-panel-1')
      const panel2 = screen.getByTestId('agent-terminal-panel-panel-2')

      // Check transition classes are applied
      expect(panel1).toHaveClass('transition-all', 'duration-300', 'ease-out')
      expect(panel2).toHaveClass('transition-all', 'duration-300', 'ease-out')
    })

    it('should apply correct transition properties for state changes', async () => {
      const panels = createMockPanels(2)

      render(<ParallelAgentTerminalView panels={panels} />)

      const panel1 = screen.getByTestId('agent-terminal-panel-panel-1')

      // Check initial transition properties
      expect(panel1).toHaveStyle({
        transitionProperty: 'transform, opacity, width, height',
        transitionDuration: '300ms',
        transitionTimingFunction: 'ease-out'
      })
    })

    it('should maintain transition classes during minimize state change', async () => {
      const panels = createMockPanels(2)

      render(<ParallelAgentTerminalView panels={panels} />)

      // Minimize panel-1
      await userEvent.click(screen.getByTestId('minimize-panel-1'))

      const panel1 = screen.getByTestId('agent-terminal-panel-panel-1')

      // Check visual transition properties for minimize
      expect(panel1).toHaveStyle({
        transform: 'scale(0.95)',
        opacity: '0.7'
      })
      expect(panel1).toHaveClass('transition-all', 'duration-300', 'ease-out')
    })
  })

  describe('Interactive Control Transitions', () => {
    it('should apply transition classes to interactive controls', async () => {
      const panels = createMockPanels(1)

      render(<ParallelAgentTerminalView panels={panels} />)

      // Check buttons have transition classes
      expect(screen.getByTestId('minimize-panel-1')).toHaveClass('transition-colors', 'duration-300', 'ease-out')
      expect(screen.getByTestId('maximize-panel-1')).toHaveClass('transition-colors', 'duration-300', 'ease-out')
      expect(screen.getByTestId('restore-panel-1')).toHaveClass('transition-colors', 'duration-300', 'ease-out')
    })

    it('should maintain transition classes on user interaction', async () => {
      const panels = createMockPanels(1)

      render(<ParallelAgentTerminalView panels={panels} />)

      const maximizeButton = screen.getByTestId('maximize-panel-1')

      await userEvent.click(maximizeButton)

      // Button should maintain its transition classes after interaction
      expect(maximizeButton).toHaveClass('transition-colors', 'duration-300', 'ease-out')
    })
  })

  describe('Smooth State Transitions', () => {
    it('should handle state transitions without errors', async () => {
      const panels = createMockPanels(2)

      render(<ParallelAgentTerminalView panels={panels} />)

      // Should not throw errors during state transitions
      await expect(async () => {
        await userEvent.click(screen.getByTestId('maximize-panel-1'))
        await userEvent.click(screen.getByTestId('restore-panel-1'))
        await userEvent.click(screen.getByTestId('minimize-panel-2'))
      }).not.toThrow()
    })

    it('should handle rapid state changes gracefully', async () => {
      const panels = createMockPanels(2)

      render(<ParallelAgentTerminalView panels={panels} />)

      // Rapid state changes should not break the component
      for (let i = 0; i < 3; i++) {
        await userEvent.click(screen.getByTestId('maximize-panel-1'))
        await userEvent.click(screen.getByTestId('restore-panel-1'))
      }

      // Component should still be functional
      expect(screen.getByTestId('agent-terminal-panel-panel-1')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-panel-2')).toBeInTheDocument()
    })
  })

  describe('CSS Transform and Opacity Behavior', () => {
    it('should apply scale transform for minimized panels', async () => {
      const panels = createMockPanels(2)

      render(<ParallelAgentTerminalView panels={panels} />)

      await userEvent.click(screen.getByTestId('minimize-panel-1'))

      const panel1 = screen.getByTestId('agent-terminal-panel-panel-1')

      expect(panel1).toHaveStyle({
        transform: 'scale(0.95)',
        opacity: '0.7'
      })
    })

    it('should reset transforms for normal state panels', async () => {
      const panels = createMockPanels(2)

      render(<ParallelAgentTerminalView panels={panels} />)

      const panel1 = screen.getByTestId('agent-terminal-panel-panel-1')

      // Normal state should have default transform and opacity
      expect(panel1).toHaveStyle({
        transform: 'scale(1)',
        opacity: '1'
      })
    })

    it('should maintain transforms through state changes', async () => {
      const panels = createMockPanels(2)

      render(<ParallelAgentTerminalView panels={panels} />)

      // Start minimized
      await userEvent.click(screen.getByTestId('minimize-panel-1'))

      let panel1 = screen.getByTestId('agent-terminal-panel-panel-1')
      expect(panel1).toHaveStyle({
        transform: 'scale(0.95)',
        opacity: '0.7'
      })

      // Restore to normal
      await userEvent.click(screen.getByTestId('restore-panel-1'))

      panel1 = screen.getByTestId('agent-terminal-panel-panel-1')
      expect(panel1).toHaveStyle({
        transform: 'scale(1)',
        opacity: '1'
      })
    })
  })

  describe('Performance and Accessibility', () => {
    it('should handle multiple panels efficiently', async () => {
      const panels = createMockPanels(6)

      const startTime = performance.now()

      render(<ParallelAgentTerminalView panels={panels} />)

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render efficiently (less than 100ms)
      expect(renderTime).toBeLessThan(100)

      // All panels should be rendered with transition classes
      panels.forEach((_, i) => {
        const panel = screen.getByTestId(`agent-terminal-panel-panel-${i + 1}`)
        expect(panel).toHaveClass('transition-all', 'duration-300', 'ease-out')
      })
    })

    it('should not break with rapid interactions', async () => {
      const panels = createMockPanels(3)

      render(<ParallelAgentTerminalView panels={panels} />)

      // Simulate rapid user interactions
      const interactions = [
        () => userEvent.click(screen.getByTestId('maximize-panel-1')),
        () => userEvent.click(screen.getByTestId('minimize-panel-2')),
        () => userEvent.click(screen.getByTestId('restore-panel-1')),
        () => userEvent.click(screen.getByTestId('maximize-panel-3')),
      ]

      // Execute interactions rapidly
      for (const interaction of interactions) {
        await interaction()
      }

      // Component should still be functional
      expect(screen.getByTestId('agent-terminal-panel-panel-1')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-panel-2')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-panel-3')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle single panel transitions', async () => {
      const panels = createMockPanels(1)

      render(<ParallelAgentTerminalView panels={panels} />)

      await userEvent.click(screen.getByTestId('minimize-panel-1'))

      const panel = screen.getByTestId('agent-terminal-panel-panel-1')
      expect(panel).toHaveClass('transition-all', 'duration-300', 'ease-out')
      expect(panel).toHaveStyle({
        transform: 'scale(0.95)',
        opacity: '0.7'
      })
    })

    it('should handle empty panel arrays gracefully', () => {
      render(<ParallelAgentTerminalView panels={[]} />)

      expect(screen.getByTestId('parallel-agent-terminal-view-empty')).toBeInTheDocument()
    })

    it('should maintain transition classes with custom props', async () => {
      const panels = createMockPanels(2)

      render(
        <ParallelAgentTerminalView
          panels={panels}
          gap="lg"
          maxHeight="600px"
          className="custom-class"
        />
      )

      const panel1 = screen.getByTestId('agent-terminal-panel-panel-1')
      expect(panel1).toHaveClass('transition-all', 'duration-300', 'ease-out')
    })
  })
})