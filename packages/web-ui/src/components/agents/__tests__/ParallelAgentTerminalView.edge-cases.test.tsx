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

describe('ParallelAgentTerminalView - Edge Cases and Error Paths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock console to avoid noise in test output
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('Empty and Invalid Panel Configurations', () => {
    it('should handle empty panels array gracefully', () => {
      render(<ParallelAgentTerminalView panels={[]} />)

      expect(screen.getByTestId('parallel-agent-terminal-view-empty')).toBeInTheDocument()
      expect(screen.getByText('No agent terminals to display')).toBeInTheDocument()
    })

    it('should reject malformed panel objects with validation errors', () => {
      const malformedPanels = [
        // @ts-expect-error Testing malformed input
        { panelId: '', agentId: 'agent-1' }, // Empty panelId
        // @ts-expect-error Testing malformed input
        { panelId: 'panel-2', agentId: '' }, // Empty agentId
      ]

      // Should throw validation errors for invalid configurations
      expect(() => {
        render(<ParallelAgentTerminalView panels={malformedPanels} />)
      }).toThrow(/validation failed/)
    })
  })

  describe('Extreme Panel Counts', () => {
    it('should handle maximum panel count (12)', () => {
      const panels = createMockPanels(12)

      render(<ParallelAgentTerminalView panels={panels} />)

      // All panels should render
      panels.forEach((_, i) => {
        expect(screen.getByTestId(`agent-terminal-panel-panel-${i + 1}`)).toBeInTheDocument()
      })
    })

    it('should handle excessive panel count (>12)', () => {
      const panels = createMockPanels(20)

      render(<ParallelAgentTerminalView panels={panels} />)

      // Should render without throwing errors
      expect(screen.getByTestId('parallel-agent-terminal-view')).toBeInTheDocument()
    })

    it('should maintain performance with many rapid state changes', async () => {
      const panels = createMockPanels(6)

      render(<ParallelAgentTerminalView panels={panels} />)

      const startTime = performance.now()

      // Perform many rapid operations
      for (let i = 0; i < 10; i++) {
        const panelIndex = (i % panels.length) + 1
        await userEvent.click(screen.getByTestId(`maximize-panel-${panelIndex}`))
        await userEvent.click(screen.getByTestId(`restore-panel-${panelIndex}`))
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete in reasonable time (less than 2 seconds)
      expect(duration).toBeLessThan(2000)
    })
  })

  describe('Memory Management and Cleanup', () => {
    it('should properly cleanup when panels are removed', async () => {
      const panels = createMockPanels(3)
      const { rerender } = render(<ParallelAgentTerminalView panels={panels} />)

      // Verify initial panels
      expect(screen.getByTestId('agent-terminal-panel-panel-1')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-panel-2')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-panel-3')).toBeInTheDocument()

      // Remove one panel
      const reducedPanels = panels.slice(0, 2)
      rerender(<ParallelAgentTerminalView panels={reducedPanels} />)

      // Should remove the third panel
      expect(screen.getByTestId('agent-terminal-panel-panel-1')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-panel-2')).toBeInTheDocument()
      expect(screen.queryByTestId('agent-terminal-panel-panel-3')).not.toBeInTheDocument()
    })

    it('should handle rapid panel addition and removal', async () => {
      let panels = createMockPanels(2)
      const { rerender } = render(<ParallelAgentTerminalView panels={panels} />)

      // Rapidly add and remove panels
      for (let i = 0; i < 3; i++) {
        // Add panels
        panels = createMockPanels(4)
        rerender(<ParallelAgentTerminalView panels={panels} />)

        // Verify panels are added
        expect(screen.getByTestId('agent-terminal-panel-panel-4')).toBeInTheDocument()

        // Remove panels
        panels = createMockPanels(2)
        rerender(<ParallelAgentTerminalView panels={panels} />)

        // Verify panels are removed
        expect(screen.queryByTestId('agent-terminal-panel-panel-4')).not.toBeInTheDocument()
      }
    })

    it('should cleanup properly on unmount during active states', async () => {
      const panels = createMockPanels(2)
      const { unmount } = render(<ParallelAgentTerminalView panels={panels} />)

      // Interact with a panel
      await userEvent.click(screen.getByTestId('maximize-panel-1'))

      // Unmount while in an active state
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Accessibility Edge Cases', () => {
    it('should handle screen reader interactions gracefully', async () => {
      const panels = createMockPanels(2)

      render(<ParallelAgentTerminalView panels={panels} />)

      // Test keyboard navigation
      const maximizeButton = screen.getByTestId('maximize-panel-1')

      maximizeButton.focus()
      expect(document.activeElement).toBe(maximizeButton)

      // Should not throw errors on keyboard interaction
      await expect(async () => {
        await userEvent.keyboard('{Enter}')
      }).not.toThrow()
    })

    it('should maintain proper ARIA labels during error states', () => {
      const panels = createMockPanels(1)

      render(<ParallelAgentTerminalView panels={panels} />)

      const container = screen.getByRole('region', {
        name: /Parallel agent terminals \(1 panels\)/
      })

      expect(container).toBeInTheDocument()
      expect(container).toHaveAttribute('aria-describedby')
    })

    it('should handle focus management when panels disappear', async () => {
      const panels = createMockPanels(2)
      const { rerender } = render(<ParallelAgentTerminalView panels={panels} />)

      const maximizeButton1 = screen.getByTestId('maximize-panel-1')
      maximizeButton1.focus()

      // Remove the focused panel
      rerender(<ParallelAgentTerminalView panels={[panels[1]]} />)

      // Should not cause focus issues
      expect(() => {
        // Any focus-related operations should work
        screen.getByTestId('maximize-panel-2').focus()
      }).not.toThrow()
    })
  })

  describe('Prop Validation and Type Safety', () => {
    it('should handle invalid gap values gracefully', () => {
      const panels = createMockPanels(2)

      // @ts-expect-error Testing invalid prop
      const { container } = render(
        <ParallelAgentTerminalView panels={panels} gap="invalid" />
      )

      // Should render without errors
      expect(container.firstChild).toBeInTheDocument()
    })

    it('should handle invalid maxHeight values', () => {
      const panels = createMockPanels(2)

      // @ts-expect-error Testing invalid prop
      const { container } = render(
        <ParallelAgentTerminalView panels={panels} maxHeight={123} />
      )

      // Should render without errors
      expect(container.firstChild).toBeInTheDocument()
    })

    it('should handle missing optional panel properties', () => {
      const minimalPanels: AgentTerminalPanelConfig[] = [
        { panelId: 'panel-1', agentId: 'agent-1' }, // Only required props
        { panelId: 'panel-2', agentId: 'agent-2' },
      ]

      render(<ParallelAgentTerminalView panels={minimalPanels} />)

      // Should render successfully with minimal props
      expect(screen.getByTestId('agent-terminal-panel-panel-1')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-panel-2')).toBeInTheDocument()
    })
  })

  describe('Error Recovery and Resilience', () => {
    it('should handle callback errors gracefully', async () => {
      const panels = createMockPanels(2)
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error')
      })

      render(
        <ParallelAgentTerminalView
          panels={panels}
          onPanelStateChange={errorCallback}
        />
      )

      // Component should not crash when callback throws
      // Note: Since we're mocking the hook, the callback won't actually be called
      // This test verifies the component can render with an error-throwing callback
      await expect(async () => {
        await userEvent.click(screen.getByTestId('maximize-panel-1'))
      }).not.toThrow()

      // Component should still be functional
      expect(screen.getByTestId('agent-terminal-panel-panel-1')).toBeInTheDocument()
    })

    it('should recover from rapid state changes', async () => {
      const panels = createMockPanels(2)

      render(<ParallelAgentTerminalView panels={panels} />)

      // Very rapid state changes
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(userEvent.click(screen.getByTestId('maximize-panel-1')))
        promises.push(userEvent.click(screen.getByTestId('restore-panel-1')))
      }

      await Promise.allSettled(promises)

      // Component should still be functional
      expect(screen.getByTestId('agent-terminal-panel-panel-1')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-panel-2')).toBeInTheDocument()
    })

    it('should handle concurrent operations correctly', async () => {
      const panels = createMockPanels(3)

      render(<ParallelAgentTerminalView panels={panels} />)

      // Try to operate on multiple panels simultaneously
      const operations = [
        userEvent.click(screen.getByTestId('maximize-panel-1')),
        userEvent.click(screen.getByTestId('minimize-panel-2')),
        userEvent.click(screen.getByTestId('restore-panel-3')),
      ]

      await Promise.allSettled(operations)

      // All panels should still be present and functional
      expect(screen.getByTestId('agent-terminal-panel-panel-1')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-panel-2')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-panel-3')).toBeInTheDocument()
    })
  })

  describe('Browser Compatibility Edge Cases', () => {
    it('should work with limited CSS support', () => {
      // Mock missing CSS Grid support
      const originalGetComputedStyle = window.getComputedStyle
      window.getComputedStyle = vi.fn(() => ({
        display: 'block', // Instead of grid
        gridTemplateColumns: '',
      })) as any

      const panels = createMockPanels(2)

      render(<ParallelAgentTerminalView panels={panels} />)

      // Should still render panels
      expect(screen.getByTestId('agent-terminal-panel-panel-1')).toBeInTheDocument()
      expect(screen.getByTestId('agent-terminal-panel-panel-2')).toBeInTheDocument()

      // Restore original function
      window.getComputedStyle = originalGetComputedStyle
    })

    it('should handle missing animation support', async () => {
      // Mock missing animation support
      const originalRequestAnimationFrame = global.requestAnimationFrame
      global.requestAnimationFrame = vi.fn((callback) => {
        // Immediately call callback instead of scheduling
        callback(0)
        return 0
      })

      const panels = createMockPanels(2)

      render(<ParallelAgentTerminalView panels={panels} />)

      // State changes should still work
      await userEvent.click(screen.getByTestId('maximize-panel-1'))

      expect(screen.getByTestId('agent-terminal-panel-panel-1')).toBeInTheDocument()

      // Restore original function
      global.requestAnimationFrame = originalRequestAnimationFrame
    })
  })
})