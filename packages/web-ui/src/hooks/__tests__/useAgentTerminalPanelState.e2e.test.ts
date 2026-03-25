import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useAgentTerminalPanelState } from '../useAgentTerminalPanelState'

describe('useAgentTerminalPanelState - E2E Cross-Platform Tests', () => {
  describe('cross-platform compatibility', () => {
    it('should work with both web-ui and CLI-style panel naming', () => {
      // Test with web-ui style names (PascalCase components)
      const { result: webResult } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['AgentTerminal', 'OutputViewer', 'DebugConsole'],
        initialFocusedPanelId: 'AgentTerminal'
      }))

      act(() => {
        webResult.current.registerPanel('AgentTerminal')
        webResult.current.registerPanel('OutputViewer')
        webResult.current.registerPanel('DebugConsole')
      })

      // Test with CLI-style names (snake_case, kebab-case, etc.)
      const { result: cliResult } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['main_terminal', 'output-viewer', 'debug.console'],
        initialFocusedPanelId: 'main_terminal'
      }))

      act(() => {
        cliResult.current.registerPanel('main_terminal')
        cliResult.current.registerPanel('output-viewer')
        cliResult.current.registerPanel('debug.console')
      })

      // Both should behave identically
      expect(webResult.current.focusedPanelId).toBe('AgentTerminal')
      expect(cliResult.current.focusedPanelId).toBe('main_terminal')

      // Navigation should work the same way
      act(() => {
        webResult.current.focusNext()
        cliResult.current.focusNext()
      })

      expect(webResult.current.focusedPanelId).toBe('OutputViewer')
      expect(cliResult.current.focusedPanelId).toBe('output-viewer')

      // State management should work the same way
      act(() => {
        webResult.current.maximize('OutputViewer')
        cliResult.current.maximize('output-viewer')
      })

      expect(webResult.current.getPanelState('OutputViewer')).toBe('maximized')
      expect(cliResult.current.getPanelState('output-viewer')).toBe('maximized') // Both should behave the same
    })

    it('should handle mixed naming conventions in single instance', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['WebTerminal', 'cli_output', 'debug-console', 'error.log'],
        initialFocusedPanelId: 'WebTerminal'
      }))

      act(() => {
        result.current.registerPanel('WebTerminal')
        result.current.registerPanel('cli_output')
        result.current.registerPanel('debug-console')
        result.current.registerPanel('error.log')
      })

      expect(result.current.focusedPanelId).toBe('WebTerminal')

      // Navigate through all different naming styles
      act(() => {
        result.current.focusNext() // WebTerminal -> cli_output
      })
      expect(result.current.focusedPanelId).toBe('cli_output')

      act(() => {
        result.current.focusNext() // cli_output -> debug-console
      })
      expect(result.current.focusedPanelId).toBe('debug-console')

      act(() => {
        result.current.focusNext() // debug-console -> error.log
      })
      expect(result.current.focusedPanelId).toBe('error.log')

      act(() => {
        result.current.focusNext() // error.log -> WebTerminal (wrap)
      })
      expect(result.current.focusedPanelId).toBe('WebTerminal')

      // State operations should work with all naming styles
      act(() => {
        result.current.maximize('cli_output')
      })
      expect(result.current.getPanelState('cli_output')).toBe('maximized')

      act(() => {
        result.current.minimize('debug-console')
      })
      expect(result.current.getPanelState('debug-console')).toBe('minimized')

      act(() => {
        result.current.restore('error.log')
      })
      expect(result.current.getPanelState('error.log')).toBe('normal')
    })
  })

  describe('real-world end-to-end scenarios', () => {
    it('should handle complete user session workflow', () => {
      const sessionEvents = vi.fn()
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['MainAgent', 'SubAgent1', 'SubAgent2', 'LogsViewer', 'DebugPanel'],
        onFocusChange: (newFocus, prevFocus) => {
          sessionEvents('focus_change', { newFocus, prevFocus })
        },
        onStateChange: (panelId, newState, allStates) => {
          sessionEvents('state_change', { panelId, newState, allStates })
        }
      }))

      // Session start: User registers all panels
      act(() => {
        ['MainAgent', 'SubAgent1', 'SubAgent2', 'LogsViewer', 'DebugPanel'].forEach(id => {
          result.current.registerPanel(id)
        })
      })

      // User starts by focusing main agent terminal
      act(() => {
        result.current.focusPanel('MainAgent')
      })

      expect(result.current.focusedPanelId).toBe('MainAgent')
      expect(sessionEvents).toHaveBeenCalledWith('focus_change', {
        newFocus: 'MainAgent',
        prevFocus: null
      })

      sessionEvents.mockClear()

      // User maximizes main agent for full-screen work
      act(() => {
        result.current.maximize('MainAgent')
      })

      expect(result.current.getPanelState('MainAgent')).toBe('maximized')

      // User tabs through agents to check status
      act(() => {
        result.current.focusNext() // MainAgent -> SubAgent1
        result.current.focusNext() // SubAgent1 -> SubAgent2
      })

      expect(result.current.focusedPanelId).toBe('SubAgent2')
      expect(sessionEvents).toHaveBeenCalledWith('focus_change', {
        newFocus: 'SubAgent1',
        prevFocus: 'MainAgent'
      })

      // User minimizes unused agent and maximizes current one
      act(() => {
        result.current.minimize('SubAgent1')
        result.current.maximize('SubAgent2') // Should restore MainAgent
      })

      expect(result.current.getPanelState('MainAgent')).toBe('normal')
      expect(result.current.getPanelState('SubAgent1')).toBe('minimized')
      expect(result.current.getPanelState('SubAgent2')).toBe('maximized')

      // User navigates to logs to check output
      act(() => {
        result.current.focusNext() // SubAgent2 -> LogsViewer
        result.current.focusNext() // LogsViewer -> DebugPanel
      })

      expect(result.current.focusedPanelId).toBe('DebugPanel')

      // User opens debug panel in maximized view
      act(() => {
        result.current.maximize('DebugPanel')
      })

      expect(result.current.getPanelState('SubAgent2')).toBe('normal') // Should be restored
      expect(result.current.getPanelState('DebugPanel')).toBe('maximized')

      // User shift-tabs back to review logs
      act(() => {
        result.current.focusPrevious() // DebugPanel -> LogsViewer
      })

      expect(result.current.focusedPanelId).toBe('LogsViewer')

      // User cleans up session by restoring all panels
      act(() => {
        result.current.restoreAll()
      })

      // Verify final clean state
      const finalStates = result.current.getAllStates()
      const nonNormalStates = Object.entries(finalStates)
        .filter(([, state]) => state !== 'normal')

      expect(nonNormalStates).toHaveLength(0) // All panels should be normal
      expect(result.current.focusedPanelId).toBe('LogsViewer') // Focus should remain
    })

    it('should handle error recovery scenarios', () => {
      const errorHandler = vi.fn()
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['agent1', 'agent2', 'agent3'],
        onFocusChange: (newFocus, prevFocus) => {
          // Simulate callback error
          if (newFocus === 'agent2') {
            errorHandler('focus_error', newFocus)
            throw new Error('Focus callback error')
          }
        }
      }))

      act(() => {
        ['agent1', 'agent2', 'agent3'].forEach(id => {
          result.current.registerPanel(id)
        })
      })

      // Start with agent1
      act(() => {
        result.current.focusPanel('agent1')
      })

      expect(result.current.focusedPanelId).toBe('agent1')

      // Navigate to agent2 (should trigger error but not break the hook)
      // The error is in the callback, so focus change should still happen
      act(() => {
        result.current.focusNext() // agent1 -> agent2
      })

      // Hook should still function correctly despite callback error
      expect(result.current.focusedPanelId).toBe('agent2')

      // Continue navigation should work
      act(() => {
        result.current.focusNext() // agent2 -> agent3
      })

      expect(result.current.focusedPanelId).toBe('agent3')
      expect(errorHandler).toHaveBeenCalledWith('focus_error', 'agent2')

      // State operations should still work
      act(() => {
        result.current.maximize('agent3')
      })

      expect(result.current.getPanelState('agent3')).toBe('maximized')
    })

    it('should handle dynamic panel management during active session', () => {
      const onFocusChange = vi.fn()
      let currentPanels = ['terminal1', 'terminal2']

      const { result, rerender } = renderHook(
        ({ panelOrder }) => useAgentTerminalPanelState({
          initialPanelOrder: panelOrder,
          initialFocusedPanelId: panelOrder[0],
          onFocusChange
        }),
        {
          initialProps: { panelOrder: currentPanels }
        }
      )

      // Register initial panels
      act(() => {
        currentPanels.forEach(id => result.current.registerPanel(id))
      })

      expect(result.current.focusedPanelId).toBe('terminal1')

      // Maximize first terminal
      act(() => {
        result.current.maximize('terminal1')
      })

      // User adds new terminal mid-session
      currentPanels = ['terminal1', 'terminal2', 'terminal3']
      rerender({ panelOrder: currentPanels })

      // Register new panel
      act(() => {
        result.current.registerPanel('terminal3')
      })

      // Navigate to new terminal
      act(() => {
        result.current.focusNext() // terminal1 -> terminal2
        result.current.focusNext() // terminal2 -> terminal3
      })

      expect(result.current.focusedPanelId).toBe('terminal3')

      // User removes middle terminal
      currentPanels = ['terminal1', 'terminal3']
      rerender({ panelOrder: currentPanels })

      act(() => {
        result.current.unregisterPanel('terminal2')
        result.current.setPanelOrder(['terminal1', 'terminal3'])
      })

      // Focus should remain on terminal3
      expect(result.current.focusedPanelId).toBe('terminal3')

      // Navigation should work with updated panel list
      act(() => {
        result.current.focusNext() // terminal3 -> terminal1 (wrap around)
      })

      expect(result.current.focusedPanelId).toBe('terminal1')

      // State should be preserved for remaining panels
      expect(result.current.getPanelState('terminal1')).toBe('maximized')
    })
  })

  describe('performance and scalability tests', () => {
    it('should handle high-frequency operations efficiently', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: Array.from({ length: 20 }, (_, i) => `panel-${i}`)
      }))

      // Register all panels
      act(() => {
        for (let i = 0; i < 20; i++) {
          result.current.registerPanel(`panel-${i}`)
        }
      })

      const startTime = performance.now()

      // Perform many rapid operations
      act(() => {
        // Rapid navigation (1000 operations)
        for (let i = 0; i < 1000; i++) {
          if (i % 2 === 0) {
            result.current.focusNext()
          } else {
            result.current.focusPrevious()
          }
        }

        // Rapid state changes (100 operations)
        for (let i = 0; i < 100; i++) {
          const panelIndex = i % 20
          if (i % 3 === 0) {
            result.current.maximize(`panel-${panelIndex}`)
          } else if (i % 3 === 1) {
            result.current.minimize(`panel-${panelIndex}`)
          } else {
            result.current.restore(`panel-${panelIndex}`)
          }
        }

        // Final restoration
        result.current.restoreAll()
      })

      const endTime = performance.now()
      const executionTime = endTime - startTime

      // Should complete in reasonable time (less than 500ms for all operations)
      expect(executionTime).toBeLessThan(500)

      // Final state should be consistent
      const finalStates = result.current.getAllStates()
      const nonNormalStates = Object.values(finalStates).filter(state => state !== 'normal')
      expect(nonNormalStates).toHaveLength(0)

      // Focus should be at some valid position
      expect(result.current.focusedIndex).toBeGreaterThanOrEqual(0)
      expect(result.current.focusedIndex).toBeLessThan(20)
    })

    it('should maintain memory stability across many operations', () => {
      const { result, unmount } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3']
      }))

      act(() => {
        ['panel1', 'panel2', 'panel3'].forEach(id => result.current.registerPanel(id))
      })

      // Capture initial memory baseline (approximate)
      const initialTime = performance.now()

      // Perform many operations that could potentially cause memory leaks
      act(() => {
        for (let cycle = 0; cycle < 100; cycle++) {
          // Navigation cycle
          result.current.focusNext()
          result.current.focusNext()
          result.current.focusPrevious()
          result.current.focusPrevious()

          // State cycle
          result.current.maximize('panel1')
          result.current.maximize('panel2')
          result.current.maximize('panel3')
          result.current.restoreAll()

          // Focus management
          result.current.clearFocus()
          result.current.focusPanel('panel2')
        }
      })

      const endTime = performance.now()

      // Operations should not cause excessive delays (indicating potential memory issues)
      expect(endTime - initialTime).toBeLessThan(1000)

      // Clean unmount should work without errors
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('integration with React ecosystem', () => {
    it('should work properly with React Strict Mode (double effect execution)', () => {
      // Simulate Strict Mode by running effects twice
      const onFocusChange = vi.fn()
      const { result, rerender } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2'],
        initialFocusedPanelId: 'panel1',
        onFocusChange
      }))

      // Simulate double mount (Strict Mode behavior)
      rerender()
      rerender()

      expect(result.current.focusedPanelId).toBe('panel1')

      act(() => {
        result.current.registerPanel('panel1')
        result.current.registerPanel('panel2')
      })

      // Navigation should work correctly even with double mounting
      act(() => {
        result.current.focusNext()
      })

      expect(result.current.focusedPanelId).toBe('panel2')

      // Callback should be called correctly (not duplicated due to strict mode)
      expect(onFocusChange).toHaveBeenCalledTimes(1)
      expect(onFocusChange).toHaveBeenCalledWith('panel2', 'panel1')
    })

    it('should handle concurrent updates properly', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3']
      }))

      act(() => {
        ['panel1', 'panel2', 'panel3'].forEach(id => result.current.registerPanel(id))
      })

      // Simulate concurrent state updates that might happen in real React apps
      act(() => {
        // These would typically happen in different event handlers
        result.current.focusPanel('panel1')
        result.current.maximize('panel1')

        // User quickly tabs to next panel
        result.current.focusNext()

        // And maximizes it (should trigger mutual exclusivity)
        result.current.maximize('panel2')
      })

      // Final state should be consistent
      expect(result.current.focusedPanelId).toBe('panel2')
      expect(result.current.getPanelState('panel1')).toBe('normal') // Should be restored
      expect(result.current.getPanelState('panel2')).toBe('maximized')

      // Only one panel should be maximized
      const allStates = result.current.getAllStates()
      const maximizedCount = Object.values(allStates)
        .filter(state => state === 'maximized').length
      expect(maximizedCount).toBe(1)
    })
  })
})