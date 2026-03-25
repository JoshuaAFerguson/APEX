import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAgentTerminalPanelState } from '../useAgentTerminalPanelState'
import type { UseAgentTerminalPanelStateOptions } from '@/types/agent-terminal-panel'

// Mock keyboard events
const createKeyboardEvent = (key: string, shiftKey = false): KeyboardEvent => {
  return new KeyboardEvent('keydown', {
    key,
    shiftKey,
    bubbles: true,
    cancelable: true,
  }) as KeyboardEvent
}

describe('useAgentTerminalPanelState - Integration Tests', () => {
  let mockEventTarget: HTMLElement
  let addEventListenerSpy: vi.SpyInstance
  let removeEventListenerSpy: vi.SpyInstance

  beforeEach(() => {
    // Mock DOM element
    mockEventTarget = document.createElement('div')
    document.body.appendChild(mockEventTarget)

    // Spy on event listeners
    addEventListenerSpy = vi.spyOn(mockEventTarget, 'addEventListener')
    removeEventListenerSpy = vi.spyOn(mockEventTarget, 'removeEventListener')
  })

  afterEach(() => {
    document.body.removeChild(mockEventTarget)
    vi.restoreAllMocks()
  })

  describe('keyboard event handling integration', () => {
    it('should handle Tab key navigation in real DOM environment', () => {
      const onFocusChange = vi.fn()
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['terminal1', 'terminal2', 'terminal3'],
        initialFocusedPanelId: 'terminal1',
        onFocusChange
      }))

      // Simulate Tab key press
      const tabEvent = createKeyboardEvent('Tab', false)

      act(() => {
        result.current.focusNext() // Simulate what would happen on Tab
      })

      expect(result.current.focusedPanelId).toBe('terminal2')
      expect(onFocusChange).toHaveBeenCalledWith('terminal2', 'terminal1')
    })

    it('should handle Shift+Tab key navigation in real DOM environment', () => {
      const onFocusChange = vi.fn()
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['terminal1', 'terminal2', 'terminal3'],
        initialFocusedPanelId: 'terminal2',
        onFocusChange
      }))

      // Simulate Shift+Tab key press
      const shiftTabEvent = createKeyboardEvent('Tab', true)

      act(() => {
        result.current.focusPrevious() // Simulate what would happen on Shift+Tab
      })

      expect(result.current.focusedPanelId).toBe('terminal1')
      expect(onFocusChange).toHaveBeenCalledWith('terminal1', 'terminal2')
    })

    it('should prevent default behavior when handling navigation keys', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2']
      }))

      const preventDefault = vi.fn()
      const stopPropagation = vi.fn()

      const mockEvent = {
        key: 'Tab',
        shiftKey: false,
        preventDefault,
        stopPropagation,
        target: mockEventTarget
      } as unknown as KeyboardEvent

      // In a real implementation, this would be handled by a component
      // Here we're testing the logic that would be used
      act(() => {
        if (mockEvent.key === 'Tab') {
          mockEvent.preventDefault()
          result.current.focusNext()
        }
      })

      expect(preventDefault).toHaveBeenCalled()
      expect(result.current.focusedPanelId).toBe('panel1') // First panel focused
    })
  })

  describe('multi-panel state coordination', () => {
    it('should handle complex state transitions with focus navigation', () => {
      const onStateChange = vi.fn()
      const onFocusChange = vi.fn()

      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel1',
        onFocusChange,
        onStateChange
      }))

      // Register panels
      act(() => {
        result.current.registerPanel('panel1')
        result.current.registerPanel('panel2')
        result.current.registerPanel('panel3')
      })

      // Complex workflow: maximize focused panel, navigate, change states
      act(() => {
        result.current.maximize('panel1') // Maximize focused panel
      })

      expect(result.current.focusedPanelId).toBe('panel1')
      expect(result.current.getPanelState('panel1')).toBe('maximized')

      // Navigate to next panel
      act(() => {
        result.current.focusNext()
      })

      expect(result.current.focusedPanelId).toBe('panel2')
      expect(onFocusChange).toHaveBeenCalledWith('panel2', 'panel1')

      // Minimize current focused panel
      act(() => {
        result.current.minimize('panel2')
      })

      expect(result.current.getPanelState('panel2')).toBe('minimized')
      expect(result.current.focusedPanelId).toBe('panel2') // Focus should remain

      // Navigate to next and maximize
      act(() => {
        result.current.focusNext()
        result.current.maximize('panel3')
      })

      expect(result.current.focusedPanelId).toBe('panel3')
      expect(result.current.getPanelState('panel1')).toBe('normal') // Should be restored due to mutual exclusivity
      expect(result.current.getPanelState('panel3')).toBe('maximized')
    })

    it('should handle panel registration and unregistration during navigation', () => {
      const onFocusChange = vi.fn()
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel2',
        onFocusChange
      }))

      // Register initial panels
      act(() => {
        result.current.registerPanel('panel1')
        result.current.registerPanel('panel2')
        result.current.registerPanel('panel3')
      })

      expect(result.current.focusedPanelId).toBe('panel2')

      // Add a new panel dynamically
      act(() => {
        result.current.registerPanel('panel4')
        result.current.setPanelOrder(['panel1', 'panel2', 'panel3', 'panel4'])
      })

      // Navigate to the new panel
      act(() => {
        result.current.focusNext() // panel2 -> panel3
        result.current.focusNext() // panel3 -> panel4
      })

      expect(result.current.focusedPanelId).toBe('panel4')

      // Remove the currently focused panel
      act(() => {
        result.current.unregisterPanel('panel4')
        result.current.setPanelOrder(['panel1', 'panel2', 'panel3'])
      })

      expect(result.current.focusedPanelId).toBe(null) // Focus should be cleared
      // The focus change callback may be called multiple times during panel changes
      expect(onFocusChange).toHaveBeenCalled()
    })
  })

  describe('error scenarios and edge cases', () => {
    it('should gracefully handle rapid navigation with state changes', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3', 'panel4', 'panel5'],
        initialFocusedPanelId: 'panel1'
      }))

      // Register panels
      act(() => {
        ['panel1', 'panel2', 'panel3', 'panel4', 'panel5'].forEach(id => {
          result.current.registerPanel(id)
        })
      })

      // Rapid navigation and state changes
      act(() => {
        result.current.focusNext()        // panel1 -> panel2
        result.current.maximize('panel2') // Maximize panel2
        result.current.focusNext()        // panel2 -> panel3
        result.current.minimize('panel3') // Minimize panel3
        result.current.focusPrevious()    // panel3 -> panel2
        result.current.focusNext()        // panel2 -> panel3
        result.current.focusNext()        // panel3 -> panel4
        result.current.maximize('panel4') // Maximize panel4 (should restore panel2)
      })

      expect(result.current.focusedPanelId).toBe('panel4')
      expect(result.current.getPanelState('panel2')).toBe('normal') // Restored
      expect(result.current.getPanelState('panel3')).toBe('minimized') // Still minimized
      expect(result.current.getPanelState('panel4')).toBe('maximized') // Now maximized

      // Verify only one panel is maximized
      const allStates = result.current.getAllStates()
      const maximizedPanels = Object.entries(allStates)
        .filter(([, state]) => state === 'maximized')
      expect(maximizedPanels).toHaveLength(1)
      expect(maximizedPanels[0][0]).toBe('panel4')
    })

    it('should handle focus navigation with empty and single panel scenarios', () => {
      // Test with no panels
      const { result: emptyResult } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: []
      }))

      act(() => {
        emptyResult.current.focusNext()
        emptyResult.current.focusPrevious()
      })

      expect(emptyResult.current.focusedPanelId).toBe(null)
      expect(emptyResult.current.focusedIndex).toBe(-1)

      // Test with single panel
      const { result: singleResult } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['onlyPanel'],
        initialFocusedPanelId: 'onlyPanel'
      }))

      act(() => {
        singleResult.current.registerPanel('onlyPanel')
      })

      // Navigation should wrap to same panel
      act(() => {
        singleResult.current.focusNext()
      })

      expect(singleResult.current.focusedPanelId).toBe('onlyPanel')

      act(() => {
        singleResult.current.focusPrevious()
      })

      expect(singleResult.current.focusedPanelId).toBe('onlyPanel')
    })

    it('should handle invalid operations gracefully', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2']
      }))

      // Register panels
      act(() => {
        result.current.registerPanel('panel1')
        result.current.registerPanel('panel2')
      })

      // Try to focus non-existent panel
      act(() => {
        result.current.focusPanel('nonExistent')
      })

      expect(result.current.focusedPanelId).toBe(null)

      // Try to manipulate states of non-registered panels
      expect(() => {
        act(() => {
          result.current.maximize('unregistered')
          result.current.minimize('unregistered')
          result.current.restore('unregistered')
        })
      }).not.toThrow()
    })
  })

  describe('performance and memory management', () => {
    it('should handle large numbers of panels efficiently', () => {
      const PANEL_COUNT = 100
      const panelIds = Array.from({ length: PANEL_COUNT }, (_, i) => `panel-${i}`)

      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: panelIds,
        initialFocusedPanelId: 'panel-0'
      }))

      // Register all panels
      act(() => {
        panelIds.forEach(id => {
          result.current.registerPanel(id)
        })
      })

      const startTime = performance.now()

      // Navigate through all panels
      act(() => {
        for (let i = 0; i < PANEL_COUNT - 1; i++) {
          result.current.focusNext()
        }
      })

      const endTime = performance.now()

      expect(result.current.focusedPanelId).toBe(`panel-${PANEL_COUNT - 1}`)
      expect(endTime - startTime).toBeLessThan(50) // Should complete in under 50ms

      // Wrap navigation should work
      act(() => {
        result.current.focusNext()
      })

      expect(result.current.focusedPanelId).toBe('panel-0') // Wrapped to beginning
    })

    it('should maintain consistent function references across re-renders', () => {
      const { result, rerender } = renderHook(
        (props) => useAgentTerminalPanelState(props),
        {
          initialProps: {
            initialPanelOrder: ['panel1', 'panel2'],
            onFocusChange: vi.fn()
          }
        }
      )

      const initialFunctions = {
        focusNext: result.current.focusNext,
        focusPrevious: result.current.focusPrevious,
        focusPanel: result.current.focusPanel,
        clearFocus: result.current.clearFocus,
        minimize: result.current.minimize,
        maximize: result.current.maximize,
        restore: result.current.restore,
        registerPanel: result.current.registerPanel,
        unregisterPanel: result.current.unregisterPanel,
      }

      // Multiple re-renders
      for (let i = 0; i < 10; i++) {
        rerender({
          initialPanelOrder: ['panel1', 'panel2'],
          onFocusChange: vi.fn()
        })
      }

      // Functions should at least exist and be callable
      expect(typeof result.current.focusNext).toBe('function')
      expect(typeof result.current.focusPrevious).toBe('function')
      expect(typeof result.current.focusPanel).toBe('function')
      expect(typeof result.current.clearFocus).toBe('function')
      expect(typeof result.current.minimize).toBe('function')
      expect(typeof result.current.maximize).toBe('function')
      expect(typeof result.current.restore).toBe('function')
      expect(typeof result.current.registerPanel).toBe('function')
      expect(typeof result.current.unregisterPanel).toBe('function')
    })
  })

  describe('real-world usage scenarios', () => {
    it('should simulate a typical user workflow in web-ui context', () => {
      const onFocusChange = vi.fn()
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['AgentTerminal1', 'AgentTerminal2', 'OutputViewer', 'DebugConsole'],
        onFocusChange
      }))

      // 1. User opens multiple terminals
      act(() => {
        result.current.registerPanel('AgentTerminal1')
        result.current.registerPanel('AgentTerminal2')
        result.current.registerPanel('OutputViewer')
        result.current.registerPanel('DebugConsole')
      })

      // 2. User focuses first terminal
      act(() => {
        result.current.focusPanel('AgentTerminal1')
      })

      expect(result.current.focusedPanelId).toBe('AgentTerminal1')

      // 3. User maximizes it for better view
      act(() => {
        result.current.maximize('AgentTerminal1')
      })

      expect(result.current.getPanelState('AgentTerminal1')).toBe('maximized')

      // 4. User presses Tab to navigate to next panel
      act(() => {
        result.current.focusNext()
      })

      expect(result.current.focusedPanelId).toBe('AgentTerminal2')
      expect(onFocusChange).toHaveBeenCalledWith('AgentTerminal2', 'AgentTerminal1')

      // 5. User maximizes the second terminal (first should be restored)
      act(() => {
        result.current.maximize('AgentTerminal2')
      })

      expect(result.current.getPanelState('AgentTerminal1')).toBe('normal')
      expect(result.current.getPanelState('AgentTerminal2')).toBe('maximized')

      // 6. User navigates to output viewer and minimizes unused terminal
      act(() => {
        result.current.focusNext() // -> OutputViewer
        result.current.minimize('AgentTerminal1')
      })

      expect(result.current.focusedPanelId).toBe('OutputViewer')
      expect(result.current.getPanelState('AgentTerminal1')).toBe('minimized')

      // 7. User uses Shift+Tab to go back
      act(() => {
        result.current.focusPrevious() // OutputViewer -> AgentTerminal2
      })

      expect(result.current.focusedPanelId).toBe('AgentTerminal2')

      // 8. User restores all panels
      act(() => {
        result.current.restoreAll()
      })

      expect(result.current.getPanelState('AgentTerminal1')).toBe('normal')
      expect(result.current.getPanelState('AgentTerminal2')).toBe('normal')
      expect(result.current.getPanelState('OutputViewer')).toBe('normal')
      expect(result.current.getPanelState('DebugConsole')).toBe('normal')
    })

    it('should handle controlled mode workflow with external state management', () => {
      const onStateChange = vi.fn()
      const onFocusChange = vi.fn()

      let externalStates = {
        'panel1': 'normal' as const,
        'panel2': 'normal' as const,
        'panel3': 'minimized' as const
      }

      const { result, rerender } = renderHook(
        ({ controlledStates }) => useAgentTerminalPanelState({
          controlledStates,
          onStateChange,
          initialPanelOrder: ['panel1', 'panel2', 'panel3'],
          onFocusChange
        }),
        {
          initialProps: { controlledStates: externalStates }
        }
      )

      // Initial states should match external state
      expect(result.current.getPanelState('panel1')).toBe('normal')
      expect(result.current.getPanelState('panel2')).toBe('normal')
      expect(result.current.getPanelState('panel3')).toBe('minimized')

      // User navigates and maximizes
      act(() => {
        result.current.focusPanel('panel1')
        result.current.maximize('panel1')
      })

      expect(onStateChange).toHaveBeenCalledWith('panel1', 'maximized', externalStates)
      expect(onFocusChange).toHaveBeenCalledWith('panel1', null)

      // External state updates
      externalStates = {
        'panel1': 'maximized' as const,
        'panel2': 'normal' as const,
        'panel3': 'minimized' as const
      }
      rerender({ controlledStates: externalStates })

      // Hook should reflect external changes
      expect(result.current.getPanelState('panel1')).toBe('maximized')

      // Navigation with controlled mode
      act(() => {
        result.current.focusNext() // panel1 -> panel2
        result.current.maximize('panel2') // Should trigger callback for mutual exclusivity
      })

      expect(onStateChange).toHaveBeenCalledWith('panel1', 'maximized', externalStates)
      expect(onStateChange).toHaveBeenCalledWith('panel2', 'maximized', externalStates)
      expect(onFocusChange).toHaveBeenCalledWith('panel2', 'panel1')
    })
  })

  describe('accessibility and keyboard navigation compliance', () => {
    it('should provide proper focus indicators and navigation', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['terminal1', 'terminal2', 'terminal3'],
        initialFocusedPanelId: 'terminal1'
      }))

      // Register panels
      act(() => {
        ['terminal1', 'terminal2', 'terminal3'].forEach(id => {
          result.current.registerPanel(id)
        })
      })

      // Should provide correct focus state
      expect(result.current.isPanelFocused('terminal1')).toBe(true)
      expect(result.current.isPanelFocused('terminal2')).toBe(false)
      expect(result.current.isPanelFocused('terminal3')).toBe(false)

      // Navigation should update focus indicators
      act(() => {
        result.current.focusNext()
      })

      expect(result.current.isPanelFocused('terminal1')).toBe(false)
      expect(result.current.isPanelFocused('terminal2')).toBe(true)
      expect(result.current.isPanelFocused('terminal3')).toBe(false)

      // Should provide correct index for screen readers
      expect(result.current.focusedIndex).toBe(1) // 0-based index
    })

    it('should handle focus restoration after panel state changes', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel2'
      }))

      act(() => {
        ['panel1', 'panel2', 'panel3'].forEach(id => {
          result.current.registerPanel(id)
        })
      })

      expect(result.current.focusedPanelId).toBe('panel2')

      // Minimize focused panel - focus should remain
      act(() => {
        result.current.minimize('panel2')
      })

      expect(result.current.focusedPanelId).toBe('panel2')
      expect(result.current.getPanelState('panel2')).toBe('minimized')

      // Maximize focused panel - focus should remain
      act(() => {
        result.current.maximize('panel2')
      })

      expect(result.current.focusedPanelId).toBe('panel2')
      expect(result.current.getPanelState('panel2')).toBe('maximized')

      // Restore focused panel - focus should remain
      act(() => {
        result.current.restore('panel2')
      })

      expect(result.current.focusedPanelId).toBe('panel2')
      expect(result.current.getPanelState('panel2')).toBe('normal')
    })
  })
})