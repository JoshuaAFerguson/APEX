import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAgentTerminalPanelState, PanelState, type UseAgentTerminalPanelStateOptions } from '../useAgentTerminalPanelState.js'

describe('useAgentTerminalPanelState - CLI Integration Tests', () => {
  describe('CLI-specific navigation patterns', () => {
    it('should handle CLI terminal naming conventions', () => {
      const onFocusChange = vi.fn()
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['cli-main', 'cli-secondary', 'output_stream', 'error.log', 'debug-console'],
        initialFocusedPanelId: 'cli-main',
        onFocusChange
      }))

      expect(result.current.focusedPanelId).toBe('cli-main')
      expect(result.current.focusedIndex).toBe(0)

      // Navigate through CLI-style named panels
      act(() => {
        result.current.focusNext() // cli-main -> cli-secondary
      })

      expect(result.current.focusedPanelId).toBe('cli-secondary')
      expect(result.current.focusedIndex).toBe(1)

      act(() => {
        result.current.focusNext() // cli-secondary -> output_stream
      })

      expect(result.current.focusedPanelId).toBe('output_stream')

      act(() => {
        result.current.focusNext() // output_stream -> error.log
      })

      expect(result.current.focusedPanelId).toBe('error.log')

      act(() => {
        result.current.focusNext() // error.log -> debug-console
      })

      expect(result.current.focusedPanelId).toBe('debug-console')

      act(() => {
        result.current.focusNext() // debug-console -> cli-main (wrap around)
      })

      expect(result.current.focusedPanelId).toBe('cli-main')
      expect(result.current.focusedIndex).toBe(0)

      // Verify all focus change callbacks were called correctly
      expect(onFocusChange).toHaveBeenCalledTimes(5)
      expect(onFocusChange).toHaveBeenNthCalledWith(1, 'cli-secondary', 'cli-main')
      expect(onFocusChange).toHaveBeenNthCalledWith(2, 'output_stream', 'cli-secondary')
      expect(onFocusChange).toHaveBeenNthCalledWith(3, 'error.log', 'output_stream')
      expect(onFocusChange).toHaveBeenNthCalledWith(4, 'debug-console', 'error.log')
      expect(onFocusChange).toHaveBeenNthCalledWith(5, 'cli-main', 'debug-console')
    })

    it('should handle reverse navigation with Shift+Tab simulation', () => {
      const onFocusChange = vi.fn()
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['term1', 'term2', 'term3', 'term4'],
        initialFocusedPanelId: 'term1',
        onFocusChange
      }))

      // Navigate forward first
      act(() => {
        result.current.focusNext() // term1 -> term2
        result.current.focusNext() // term2 -> term3
      })

      expect(result.current.focusedPanelId).toBe('term3')
      onFocusChange.mockClear()

      // Simulate Shift+Tab navigation backwards
      act(() => {
        result.current.focusPrevious() // term3 -> term2
      })

      expect(result.current.focusedPanelId).toBe('term2')
      expect(onFocusChange).toHaveBeenCalledWith('term2', 'term3')

      act(() => {
        result.current.focusPrevious() // term2 -> term1
      })

      expect(result.current.focusedPanelId).toBe('term1')

      act(() => {
        result.current.focusPrevious() // term1 -> term4 (wrap around)
      })

      expect(result.current.focusedPanelId).toBe('term4')
      expect(result.current.focusedIndex).toBe(3)
    })

    it('should work with many CLI panels efficiently', () => {
      const PANEL_COUNT = 50
      const panelIds = Array.from({ length: PANEL_COUNT }, (_, i) => `cli-terminal-${i + 1}`)

      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds,
        initialFocusedPanelId: 'cli-terminal-1'
      }))

      expect(result.current.focusedPanelId).toBe('cli-terminal-1')

      const startTime = performance.now()

      // Navigate through all panels
      act(() => {
        for (let i = 1; i < PANEL_COUNT; i++) {
          result.current.focusNext()
        }
      })

      const endTime = performance.now()

      expect(result.current.focusedPanelId).toBe(`cli-terminal-${PANEL_COUNT}`)
      expect(endTime - startTime).toBeLessThan(100) // Should be fast even with many panels

      // Test wrap-around
      act(() => {
        result.current.focusNext()
      })

      expect(result.current.focusedPanelId).toBe('cli-terminal-1') // Wrapped to beginning
    })
  })

  describe('CLI state management with focus navigation', () => {
    it('should handle typical CLI workflow with multiple terminals', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['main-terminal', 'logs-viewer', 'debugger', 'file-watcher'],
        initialFocusedPanelId: 'main-terminal'
      }))

      expect(result.current.focusedPanelId).toBe('main-terminal')

      // User maximizes main terminal for coding
      act(() => {
        result.current.maximize('main-terminal')
      })

      expect(result.current.getPanelState('main-terminal')).toBe(PanelState.Maximized)
      expect(result.current.focusedPanelId).toBe('main-terminal') // Focus remains

      // User tabs to logs viewer to check output
      act(() => {
        result.current.focusNext()
      })

      expect(result.current.focusedPanelId).toBe('logs-viewer')

      // User minimizes main terminal and maximizes logs
      act(() => {
        result.current.minimize('main-terminal')
        result.current.maximize('logs-viewer')
      })

      expect(result.current.getPanelState('main-terminal')).toBe(PanelState.Minimized)
      expect(result.current.getPanelState('logs-viewer')).toBe(PanelState.Maximized)

      // User tabs to debugger
      act(() => {
        result.current.focusNext()
      })

      expect(result.current.focusedPanelId).toBe('debugger')

      // User shift-tabs back to logs
      act(() => {
        result.current.focusPrevious()
      })

      expect(result.current.focusedPanelId).toBe('logs-viewer')

      // User restores all panels
      act(() => {
        result.current.restoreAll()
      })

      expect(result.current.getPanelState('main-terminal')).toBe(PanelState.Normal)
      expect(result.current.getPanelState('logs-viewer')).toBe(PanelState.Normal)
      expect(result.current.getPanelState('debugger')).toBe(PanelState.Normal)
      expect(result.current.getPanelState('file-watcher')).toBe(PanelState.Normal)
    })

    it('should handle controlled mode with external CLI state manager', () => {
      const onPanelStateChange = vi.fn()
      const onFocusChange = vi.fn()

      let externalStates = {
        'terminal1': PanelState.Normal,
        'terminal2': PanelState.Minimized,
        'logs': PanelState.Normal,
        'debug': PanelState.Normal
      }

      const { result, rerender } = renderHook(
        ({ panelStates }) => useAgentTerminalPanelState({
          panelStates,
          onPanelStateChange,
          panelIds: ['terminal1', 'terminal2', 'logs', 'debug'],
          initialFocusedPanelId: 'terminal1',
          onFocusChange
        }),
        {
          initialProps: { panelStates: externalStates }
        }
      )

      expect(result.current.getPanelState('terminal2')).toBe(PanelState.Minimized)

      // User focuses minimized terminal and restores it
      act(() => {
        result.current.focusPanel('terminal2')
        result.current.restore('terminal2')
      })

      expect(onPanelStateChange).toHaveBeenCalledWith('terminal2', PanelState.Normal)
      expect(onFocusChange).toHaveBeenCalledWith('terminal2', 'terminal1')

      // External state updates to reflect the change
      externalStates = {
        'terminal1': PanelState.Normal,
        'terminal2': PanelState.Normal,
        'logs': PanelState.Normal,
        'debug': PanelState.Normal
      }
      rerender({ panelStates: externalStates })

      // User navigates and maximizes debug panel
      act(() => {
        result.current.focusNext() // terminal2 -> logs
        result.current.focusNext() // logs -> debug
        result.current.maximize('debug')
      })

      expect(onPanelStateChange).toHaveBeenCalledWith('debug', PanelState.Maximized)
      expect(onFocusChange).toHaveBeenCalledWith('debug', 'logs')
    })
  })

  describe('CLI edge cases and error handling', () => {
    it('should handle rapid CLI operations without breaking', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['cli1', 'cli2', 'cli3', 'cli4', 'cli5'],
        initialFocusedPanelId: 'cli1'
      }))

      // Simulate rapid user interactions common in CLI environments
      act(() => {
        // Rapid navigation
        result.current.focusNext()
        result.current.focusNext()
        result.current.focusPrevious()
        result.current.focusNext()

        // Rapid state changes
        result.current.maximize('cli3')
        result.current.minimize('cli1')
        result.current.maximize('cli4') // Should restore cli3
        result.current.minimize('cli2')

        // More navigation
        result.current.focusNext()
        result.current.focusPrevious()

        // Restore operations
        result.current.restore('cli1')
        result.current.restoreAll()
      })

      // Should end in a consistent state
      expect(result.current.focusedPanelId).toBe('cli3') // Last focused
      expect(result.current.getAllPanelStates()).toEqual({
        cli1: PanelState.Normal,
        cli2: PanelState.Normal,
        cli3: PanelState.Normal,
        cli4: PanelState.Normal,
        cli5: PanelState.Normal
      })
    })

    it('should handle dynamic panel management in CLI context', () => {
      const onFocusChange = vi.fn()
      let currentPanelIds = ['base-terminal', 'output']

      const { result, rerender } = renderHook(
        ({ ids }) => useAgentTerminalPanelState({
          panelIds: ids,
          initialFocusedPanelId: ids[0],
          onFocusChange
        }),
        {
          initialProps: { ids: currentPanelIds }
        }
      )

      expect(result.current.focusedPanelId).toBe('base-terminal')

      // Add new terminals dynamically (common in CLI environments)
      currentPanelIds = ['base-terminal', 'output', 'new-task-1', 'new-task-2']
      rerender({ ids: currentPanelIds })

      // Navigate to new terminal
      act(() => {
        result.current.focusNext() // base-terminal -> output
        result.current.focusNext() // output -> new-task-1
      })

      expect(result.current.focusedPanelId).toBe('new-task-1')

      // Remove a terminal that's not currently focused
      currentPanelIds = ['base-terminal', 'output', 'new-task-2']
      rerender({ ids: currentPanelIds })

      // Focus should be cleared since focused panel was removed
      expect(result.current.focusedPanelId).toBe(null)

      // Should be able to start navigation again
      act(() => {
        result.current.focusNext()
      })

      expect(result.current.focusedPanelId).toBe('base-terminal') // First panel
    })

    it('should handle CLI-specific error scenarios', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['term1', 'term2'],
        initialFocusedPanelId: 'term1'
      }))

      // Test navigation with special characters in panel IDs (common in CLI)
      const specialPanelIds = ['term-1_main', 'term.2.backup', 'term:3:debug', 'term@4@temp']

      act(() => {
        result.current.clearFocus()
      })

      // Simulate updating panel list with special characters
      const { result: specialResult } = renderHook(() => useAgentTerminalPanelState({
        panelIds: specialPanelIds,
        initialFocusedPanelId: 'term-1_main'
      }))

      expect(specialResult.current.focusedPanelId).toBe('term-1_main')

      // Navigation should work with special characters
      act(() => {
        specialResult.current.focusNext()
      })

      expect(specialResult.current.focusedPanelId).toBe('term.2.backup')

      act(() => {
        specialResult.current.focusNext()
      })

      expect(specialResult.current.focusedPanelId).toBe('term:3:debug')

      act(() => {
        specialResult.current.focusNext()
      })

      expect(specialResult.current.focusedPanelId).toBe('term@4@temp')

      // State management should also work
      act(() => {
        specialResult.current.maximize('term:3:debug')
      })

      expect(specialResult.current.getPanelState('term:3:debug')).toBe(PanelState.Maximized)
    })
  })

  describe('CLI performance and stability', () => {
    it('should maintain stable function references during CLI operations', () => {
      const { result, rerender } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['cli-term1', 'cli-term2'],
        onFocusChange: vi.fn()
      }))

      const initialFunctions = {
        focusNext: result.current.focusNext,
        focusPrevious: result.current.focusPrevious,
        focusPanel: result.current.focusPanel,
        clearFocus: result.current.clearFocus,
        minimize: result.current.minimize,
        maximize: result.current.maximize,
        restore: result.current.restore,
        restoreAll: result.current.restoreAll,
        getPanelState: result.current.getPanelState,
        getAllPanelStates: result.current.getAllPanelStates,
      }

      // Simulate multiple re-renders that might happen in CLI environment
      for (let i = 0; i < 20; i++) {
        rerender()
      }

      // All functions should remain stable
      expect(result.current.focusNext).toBe(initialFunctions.focusNext)
      expect(result.current.focusPrevious).toBe(initialFunctions.focusPrevious)
      expect(result.current.focusPanel).toBe(initialFunctions.focusPanel)
      expect(result.current.clearFocus).toBe(initialFunctions.clearFocus)
      expect(result.current.minimize).toBe(initialFunctions.minimize)
      expect(result.current.maximize).toBe(initialFunctions.maximize)
      expect(result.current.restore).toBe(initialFunctions.restore)
      expect(result.current.restoreAll).toBe(initialFunctions.restoreAll)
      expect(result.current.getPanelState).toBe(initialFunctions.getPanelState)
      expect(result.current.getAllPanelStates).toBe(initialFunctions.getAllPanelStates)
    })

    it('should handle memory-intensive CLI scenarios', () => {
      const LARGE_PANEL_COUNT = 200
      const largePanelIds = Array.from({ length: LARGE_PANEL_COUNT }, (_, i) => `cli-panel-${i}`)

      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: largePanelIds,
        initialFocusedPanelId: 'cli-panel-0'
      }))

      const startTime = performance.now()

      // Perform many operations
      act(() => {
        // Navigate through many panels
        for (let i = 0; i < 50; i++) {
          result.current.focusNext()
        }

        // Change states of many panels
        for (let i = 0; i < 10; i++) {
          result.current.maximize(`cli-panel-${i * 20}`)
        }

        // Restore all
        result.current.restoreAll()

        // Navigate backwards
        for (let i = 0; i < 25; i++) {
          result.current.focusPrevious()
        }
      })

      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(200) // Should complete reasonably fast
      expect(result.current.focusedPanelId).toBe('cli-panel-25') // Should be at correct position

      // Verify final state is consistent
      const allStates = result.current.getAllPanelStates()
      const maximizedPanels = Object.values(allStates).filter(state => state === PanelState.Maximized)
      expect(maximizedPanels).toHaveLength(0) // All should be restored
    })
  })

  describe('CLI acceptance criteria validation', () => {
    it('should fulfill acceptance criteria: Tab moves focus to next panel in CLI', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['cli-main', 'cli-logs', 'cli-debug'],
        initialFocusedPanelId: 'cli-main'
      }))

      // Tab key simulation (focusNext)
      act(() => {
        result.current.focusNext()
      })

      expect(result.current.focusedPanelId).toBe('cli-logs')
      expect(result.current.focusedIndex).toBe(1)
    })

    it('should fulfill acceptance criteria: Shift+Tab moves to previous panel in CLI', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['cli-main', 'cli-logs', 'cli-debug'],
        initialFocusedPanelId: 'cli-logs'
      }))

      // Shift+Tab key simulation (focusPrevious)
      act(() => {
        result.current.focusPrevious()
      })

      expect(result.current.focusedPanelId).toBe('cli-main')
      expect(result.current.focusedIndex).toBe(0)
    })

    it('should fulfill acceptance criteria: Focus wraps around at end/beginning in CLI', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['terminal1', 'terminal2', 'terminal3'],
        initialFocusedPanelId: 'terminal3'
      }))

      // Tab at end should wrap to beginning
      act(() => {
        result.current.focusNext()
      })

      expect(result.current.focusedPanelId).toBe('terminal1')
      expect(result.current.focusedIndex).toBe(0)

      // Shift+Tab at beginning should wrap to end
      act(() => {
        result.current.focusPrevious()
      })

      expect(result.current.focusedPanelId).toBe('terminal3')
      expect(result.current.focusedIndex).toBe(2)
    })

    it('should fulfill acceptance criteria: Navigation works in CLI context', () => {
      const onFocusChange = vi.fn()
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['cli_terminal_1', 'cli_terminal_2', 'cli_output', 'cli_error_log'],
        initialFocusedPanelId: 'cli_terminal_1',
        onFocusChange
      }))

      // Test full navigation cycle in CLI context
      expect(result.current.focusedPanelId).toBe('cli_terminal_1')

      // Forward navigation
      act(() => {
        result.current.focusNext() // -> cli_terminal_2
        result.current.focusNext() // -> cli_output
        result.current.focusNext() // -> cli_error_log
        result.current.focusNext() // -> cli_terminal_1 (wrapped)
      })

      expect(result.current.focusedPanelId).toBe('cli_terminal_1')
      expect(onFocusChange).toHaveBeenCalledTimes(4)

      // Backward navigation
      act(() => {
        result.current.focusPrevious() // -> cli_error_log (wrapped)
        result.current.focusPrevious() // -> cli_output
        result.current.focusPrevious() // -> cli_terminal_2
        result.current.focusPrevious() // -> cli_terminal_1
      })

      expect(result.current.focusedPanelId).toBe('cli_terminal_1')
      expect(onFocusChange).toHaveBeenCalledTimes(8)
    })

    it('should work with all CLI hook functions', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['term1', 'term2', 'term3']
      }))

      // Verify all expected functions are available and work
      expect(typeof result.current.focusNext).toBe('function')
      expect(typeof result.current.focusPrevious).toBe('function')
      expect(typeof result.current.focusPanel).toBe('function')
      expect(typeof result.current.clearFocus).toBe('function')
      expect(typeof result.current.isPanelFocused).toBe('function')
      expect(typeof result.current.minimize).toBe('function')
      expect(typeof result.current.maximize).toBe('function')
      expect(typeof result.current.restore).toBe('function')
      expect(typeof result.current.restoreAll).toBe('function')
      expect(typeof result.current.getPanelState).toBe('function')
      expect(typeof result.current.getAllPanelStates).toBe('function')

      // Test that all functions work without errors
      expect(() => {
        act(() => {
          result.current.focusPanel('term1')
          result.current.maximize('term1')
          result.current.focusNext()
          result.current.minimize('term2')
          result.current.focusPrevious()
          result.current.restoreAll()
          result.current.clearFocus()
          result.current.focusNext()
        })
      }).not.toThrow()
    })
  })
})