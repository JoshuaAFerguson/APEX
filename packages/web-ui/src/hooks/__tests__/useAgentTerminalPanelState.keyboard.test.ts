import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAgentTerminalPanelState } from '../useAgentTerminalPanelState'

// Mock keyboard event utilities
const createKeyboardEvent = (key: string, options: Partial<KeyboardEvent> = {}): KeyboardEvent => {
  return new KeyboardEvent('keydown', {
    key,
    code: `Key${key.toUpperCase()}`,
    bubbles: true,
    cancelable: true,
    ...options,
  })
}

// Mock component that would typically handle keyboard events
const createKeyboardHandler = (hookResult: any) => {
  return (event: KeyboardEvent) => {
    if (event.key === 'Tab') {
      event.preventDefault()
      if (event.shiftKey) {
        hookResult.current.focusPrevious()
      } else {
        hookResult.current.focusNext()
      }
    }
  }
}

describe('useAgentTerminalPanelState - Keyboard Integration Tests', () => {
  let mockContainer: HTMLElement

  beforeEach(() => {
    mockContainer = document.createElement('div')
    mockContainer.setAttribute('role', 'tablist')
    mockContainer.setAttribute('aria-label', 'Agent Terminal Panels')
    document.body.appendChild(mockContainer)
  })

  afterEach(() => {
    document.body.removeChild(mockContainer)
  })

  describe('Tab key navigation simulation', () => {
    it('should handle Tab key events correctly', () => {
      const onFocusChange = vi.fn()
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['terminal1', 'terminal2', 'terminal3'],
        initialFocusedPanelId: 'terminal1',
        onFocusChange
      }))

      act(() => {
        ['terminal1', 'terminal2', 'terminal3'].forEach(id => {
          result.current.registerPanel(id)
        })
      })

      const keyboardHandler = createKeyboardHandler(result)

      // Simulate Tab key press
      const tabEvent = createKeyboardEvent('Tab')
      const preventDefaultSpy = vi.spyOn(tabEvent, 'preventDefault')

      act(() => {
        keyboardHandler(tabEvent)
      })

      expect(preventDefaultSpy).toHaveBeenCalled()
      expect(result.current.focusedPanelId).toBe('terminal2')
      expect(onFocusChange).toHaveBeenCalledWith('terminal2', 'terminal1')
    })

    it('should handle Shift+Tab key events correctly', () => {
      const onFocusChange = vi.fn()
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['terminal1', 'terminal2', 'terminal3'],
        initialFocusedPanelId: 'terminal2',
        onFocusChange
      }))

      act(() => {
        ['terminal1', 'terminal2', 'terminal3'].forEach(id => {
          result.current.registerPanel(id)
        })
      })

      const keyboardHandler = createKeyboardHandler(result)

      // Simulate Shift+Tab key press
      const shiftTabEvent = createKeyboardEvent('Tab', { shiftKey: true })
      const preventDefaultSpy = vi.spyOn(shiftTabEvent, 'preventDefault')

      act(() => {
        keyboardHandler(shiftTabEvent)
      })

      expect(preventDefaultSpy).toHaveBeenCalled()
      expect(result.current.focusedPanelId).toBe('terminal1')
      expect(onFocusChange).toHaveBeenCalledWith('terminal1', 'terminal2')
    })

    it('should handle rapid keyboard navigation', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3', 'panel4'],
        initialFocusedPanelId: 'panel1'
      }))

      act(() => {
        ['panel1', 'panel2', 'panel3', 'panel4'].forEach(id => {
          result.current.registerPanel(id)
        })
      })

      const keyboardHandler = createKeyboardHandler(result)

      // Simulate rapid Tab presses
      act(() => {
        const tabEvent1 = createKeyboardEvent('Tab')
        const tabEvent2 = createKeyboardEvent('Tab')
        const tabEvent3 = createKeyboardEvent('Tab')
        const shiftTabEvent = createKeyboardEvent('Tab', { shiftKey: true })

        keyboardHandler(tabEvent1) // panel1 -> panel2
        keyboardHandler(tabEvent2) // panel2 -> panel3
        keyboardHandler(tabEvent3) // panel3 -> panel4
        keyboardHandler(shiftTabEvent) // panel4 -> panel3
      })

      expect(result.current.focusedPanelId).toBe('panel3')
      expect(result.current.focusedIndex).toBe(2)
    })

    it('should handle keyboard navigation with wrap-around', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['first', 'middle', 'last'],
        initialFocusedPanelId: 'last'
      }))

      act(() => {
        ['first', 'middle', 'last'].forEach(id => {
          result.current.registerPanel(id)
        })
      })

      const keyboardHandler = createKeyboardHandler(result)

      // Tab at end should wrap to beginning
      act(() => {
        const tabEvent = createKeyboardEvent('Tab')
        keyboardHandler(tabEvent)
      })

      expect(result.current.focusedPanelId).toBe('first')
      expect(result.current.focusedIndex).toBe(0)

      // Shift+Tab at beginning should wrap to end
      act(() => {
        const shiftTabEvent = createKeyboardEvent('Tab', { shiftKey: true })
        keyboardHandler(shiftTabEvent)
      })

      expect(result.current.focusedPanelId).toBe('last')
      expect(result.current.focusedIndex).toBe(2)
    })
  })

  describe('keyboard event integration with panel states', () => {
    it('should maintain focus during state transitions', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel1'
      }))

      act(() => {
        ['panel1', 'panel2', 'panel3'].forEach(id => {
          result.current.registerPanel(id)
        })
      })

      const keyboardHandler = createKeyboardHandler(result)

      // Maximize focused panel
      act(() => {
        result.current.maximize('panel1')
      })

      expect(result.current.focusedPanelId).toBe('panel1')
      expect(result.current.getPanelState('panel1')).toBe('maximized')

      // Tab to next panel
      act(() => {
        const tabEvent = createKeyboardEvent('Tab')
        keyboardHandler(tabEvent)
      })

      expect(result.current.focusedPanelId).toBe('panel2')

      // Maximize new focused panel (should restore previous)
      act(() => {
        result.current.maximize('panel2')
      })

      expect(result.current.getPanelState('panel1')).toBe('normal')
      expect(result.current.getPanelState('panel2')).toBe('maximized')
      expect(result.current.focusedPanelId).toBe('panel2')

      // Continue navigation
      act(() => {
        const tabEvent = createKeyboardEvent('Tab')
        keyboardHandler(tabEvent)
      })

      expect(result.current.focusedPanelId).toBe('panel3')
    })

    it('should handle keyboard navigation with minimized panels', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['active', 'minimized', 'normal'],
        initialFocusedPanelId: 'active'
      }))

      act(() => {
        ['active', 'minimized', 'normal'].forEach(id => {
          result.current.registerPanel(id)
        })
      })

      // Set up initial states
      act(() => {
        result.current.minimize('minimized')
      })

      const keyboardHandler = createKeyboardHandler(result)

      expect(result.current.focusedPanelId).toBe('active')

      // Tab through all panels including minimized ones
      act(() => {
        const tabEvent = createKeyboardEvent('Tab')
        keyboardHandler(tabEvent) // active -> minimized
      })

      expect(result.current.focusedPanelId).toBe('minimized')
      expect(result.current.getPanelState('minimized')).toBe('minimized')

      act(() => {
        const tabEvent = createKeyboardEvent('Tab')
        keyboardHandler(tabEvent) // minimized -> normal
      })

      expect(result.current.focusedPanelId).toBe('normal')

      // Should be able to restore minimized panel even when not focused
      act(() => {
        result.current.restore('minimized')
      })

      expect(result.current.getPanelState('minimized')).toBe('normal')
      expect(result.current.focusedPanelId).toBe('normal') // Focus should remain
    })
  })

  describe('accessibility features', () => {
    it('should provide proper ARIA attributes for focused panels', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel1'
      }))

      act(() => {
        ['panel1', 'panel2', 'panel3'].forEach(id => {
          result.current.registerPanel(id)
        })
      })

      // Create mock panel elements
      const panel1 = document.createElement('div')
      const panel2 = document.createElement('div')
      const panel3 = document.createElement('div')

      panel1.setAttribute('id', 'panel1')
      panel2.setAttribute('id', 'panel2')
      panel3.setAttribute('id', 'panel3')

      mockContainer.appendChild(panel1)
      mockContainer.appendChild(panel2)
      mockContainer.appendChild(panel3)

      // Simulate component setting ARIA attributes based on hook state
      const updateAriaAttributes = () => {
        [panel1, panel2, panel3].forEach(panel => {
          const panelId = panel.id
          const isFocused = result.current.isPanelFocused(panelId)
          const panelState = result.current.getPanelState(panelId)

          panel.setAttribute('role', 'tabpanel')
          panel.setAttribute('aria-selected', isFocused.toString())
          panel.setAttribute('aria-expanded', panelState !== 'minimized' ? 'true' : 'false')
          panel.setAttribute('tabindex', isFocused ? '0' : '-1')

          if (isFocused) {
            panel.setAttribute('aria-current', 'true')
          } else {
            panel.removeAttribute('aria-current')
          }
        })
      }

      updateAriaAttributes()

      // Check initial state
      expect(panel1.getAttribute('aria-selected')).toBe('true')
      expect(panel1.getAttribute('aria-current')).toBe('true')
      expect(panel1.getAttribute('tabindex')).toBe('0')
      expect(panel2.getAttribute('aria-selected')).toBe('false')
      expect(panel2.getAttribute('tabindex')).toBe('-1')

      // Navigate to next panel
      act(() => {
        result.current.focusNext()
      })

      updateAriaAttributes()

      expect(panel1.getAttribute('aria-selected')).toBe('false')
      expect(panel1.getAttribute('tabindex')).toBe('-1')
      expect(panel1.getAttribute('aria-current')).toBe(null)
      expect(panel2.getAttribute('aria-selected')).toBe('true')
      expect(panel2.getAttribute('aria-current')).toBe('true')
      expect(panel2.getAttribute('tabindex')).toBe('0')

      // Minimize a panel
      act(() => {
        result.current.minimize('panel3')
      })

      updateAriaAttributes()

      expect(panel3.getAttribute('aria-expanded')).toBe('false')
    })

    it('should support screen reader announcements during navigation', () => {
      const announcements = vi.fn()
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['Terminal1', 'Terminal2', 'Logs', 'Debug'],
        initialFocusedPanelId: 'Terminal1',
        onFocusChange: (newPanelId, prevPanelId) => {
          if (newPanelId) {
            const currentIndex = result.current.focusedIndex + 1
            const totalPanels = result.current.panelOrder.length
            const panelState = result.current.getPanelState(newPanelId)

            announcements(`${newPanelId} panel focused. ${currentIndex} of ${totalPanels}. State: ${panelState}`)
          }
        }
      }))

      act(() => {
        ['Terminal1', 'Terminal2', 'Logs', 'Debug'].forEach(id => {
          result.current.registerPanel(id)
        })
      })

      const keyboardHandler = createKeyboardHandler(result)

      // Navigate and check announcements
      act(() => {
        const tabEvent = createKeyboardEvent('Tab')
        keyboardHandler(tabEvent)
      })

      expect(announcements).toHaveBeenCalledWith('Terminal2 panel focused. 1 of 4. State: normal')

      // Minimize current panel and navigate
      act(() => {
        result.current.minimize('Terminal2')
        const tabEvent = createKeyboardEvent('Tab')
        keyboardHandler(tabEvent)
      })

      expect(announcements).toHaveBeenCalledWith('Logs panel focused. 3 of 4. State: normal')

      // Navigate to minimized panel
      act(() => {
        const shiftTabEvent = createKeyboardEvent('Tab', { shiftKey: true })
        keyboardHandler(shiftTabEvent)
      })

      expect(announcements).toHaveBeenCalledWith('Terminal2 panel focused. 2 of 4. State: minimized')
    })

    it('should handle focus management for screen readers', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3']
      }))

      act(() => {
        ['panel1', 'panel2', 'panel3'].forEach(id => {
          result.current.registerPanel(id)
        })
      })

      // Start with no focus (screen reader mode)
      expect(result.current.focusedPanelId).toBe(null)
      expect(result.current.focusedIndex).toBe(-1)

      // First Tab should focus first panel
      act(() => {
        result.current.focusNext()
      })

      expect(result.current.focusedPanelId).toBe('panel1')
      expect(result.current.focusedIndex).toBe(0)

      // Clear focus (simulate losing focus to other UI elements)
      act(() => {
        result.current.clearFocus()
      })

      expect(result.current.focusedPanelId).toBe(null)

      // Next Tab should focus first panel again
      act(() => {
        result.current.focusNext()
      })

      expect(result.current.focusedPanelId).toBe('panel1')

      // Shift+Tab from no focus should focus last panel
      act(() => {
        result.current.clearFocus()
        result.current.focusPrevious()
      })

      expect(result.current.focusedPanelId).toBe('panel3')
      expect(result.current.focusedIndex).toBe(2)
    })
  })

  describe('keyboard event edge cases', () => {
    it('should handle keyboard events when no panels exist', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: []
      }))

      const keyboardHandler = createKeyboardHandler(result)

      expect(() => {
        act(() => {
          const tabEvent = createKeyboardEvent('Tab')
          keyboardHandler(tabEvent)
        })
      }).not.toThrow()

      expect(result.current.focusedPanelId).toBe(null)

      expect(() => {
        act(() => {
          const shiftTabEvent = createKeyboardEvent('Tab', { shiftKey: true })
          keyboardHandler(shiftTabEvent)
        })
      }).not.toThrow()

      expect(result.current.focusedPanelId).toBe(null)
    })

    it('should handle keyboard events with single panel', () => {
      const onFocusChange = vi.fn()
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['onlyPanel'],
        initialFocusedPanelId: 'onlyPanel',
        onFocusChange
      }))

      act(() => {
        result.current.registerPanel('onlyPanel')
      })

      const keyboardHandler = createKeyboardHandler(result)

      expect(result.current.focusedPanelId).toBe('onlyPanel')
      onFocusChange.mockClear()

      // Tab should wrap to same panel
      act(() => {
        const tabEvent = createKeyboardEvent('Tab')
        keyboardHandler(tabEvent)
      })

      expect(result.current.focusedPanelId).toBe('onlyPanel')
      // Since we're wrapping to the same panel, the callback may or may not be called
      // depending on the implementation - this is acceptable behavior

      onFocusChange.mockClear()

      // Shift+Tab should also wrap to same panel
      act(() => {
        const shiftTabEvent = createKeyboardEvent('Tab', { shiftKey: true })
        keyboardHandler(shiftTabEvent)
      })

      expect(result.current.focusedPanelId).toBe('onlyPanel')
      // Since we're wrapping to the same panel, the callback may or may not be called
      // depending on the implementation - this is acceptable behavior
    })

    it('should handle concurrent keyboard events and state changes', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel1'
      }))

      act(() => {
        ['panel1', 'panel2', 'panel3'].forEach(id => {
          result.current.registerPanel(id)
        })
      })

      const keyboardHandler = createKeyboardHandler(result)

      // Simulate rapid concurrent operations
      act(() => {
        const tabEvent = createKeyboardEvent('Tab')
        keyboardHandler(tabEvent) // Focus to panel2

        result.current.maximize('panel2') // Maximize current

        const anotherTabEvent = createKeyboardEvent('Tab')
        keyboardHandler(anotherTabEvent) // Focus to panel3

        result.current.minimize('panel1') // Minimize non-focused
        result.current.maximize('panel3') // Maximize current (should restore panel2)
      })

      // Final state should be consistent
      expect(result.current.focusedPanelId).toBe('panel3')
      expect(result.current.getPanelState('panel1')).toBe('minimized')
      expect(result.current.getPanelState('panel2')).toBe('normal')
      expect(result.current.getPanelState('panel3')).toBe('maximized')
    })

    it('should handle keyboard navigation during dynamic panel changes', () => {
      let panelList = ['panel1', 'panel2', 'panel3']
      const { result, rerender } = renderHook(
        ({ panels }) => useAgentTerminalPanelState({
          initialPanelOrder: panels,
          initialFocusedPanelId: panels[1] // panel2
        }),
        { initialProps: { panels: panelList } }
      )

      act(() => {
        panelList.forEach(id => result.current.registerPanel(id))
      })

      const keyboardHandler = createKeyboardHandler(result)

      expect(result.current.focusedPanelId).toBe('panel2')

      // Remove currently focused panel
      panelList = ['panel1', 'panel3']
      rerender({ panels: panelList })

      act(() => {
        result.current.unregisterPanel('panel2')
        result.current.setPanelOrder(panelList)
      })

      // Focus should be cleared
      expect(result.current.focusedPanelId).toBe(null)

      // Keyboard navigation should start fresh
      act(() => {
        const tabEvent = createKeyboardEvent('Tab')
        keyboardHandler(tabEvent)
      })

      expect(result.current.focusedPanelId).toBe('panel1')

      act(() => {
        const tabEvent = createKeyboardEvent('Tab')
        keyboardHandler(tabEvent)
      })

      expect(result.current.focusedPanelId).toBe('panel3')

      act(() => {
        const tabEvent = createKeyboardEvent('Tab')
        keyboardHandler(tabEvent) // Should wrap to panel1
      })

      expect(result.current.focusedPanelId).toBe('panel1')
    })
  })

  describe('integration with real keyboard event handling', () => {
    it('should work with actual DOM event listeners', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel1'
      }))

      act(() => {
        ['panel1', 'panel2', 'panel3'].forEach(id => {
          result.current.registerPanel(id)
        })
      })

      let actualHandlerCalled = false
      const realKeyboardHandler = (event: KeyboardEvent) => {
        actualHandlerCalled = true
        if (event.key === 'Tab') {
          event.preventDefault()
          if (event.shiftKey) {
            act(() => result.current.focusPrevious())
          } else {
            act(() => result.current.focusNext())
          }
        }
      }

      // Add real event listener
      mockContainer.addEventListener('keydown', realKeyboardHandler)

      // Dispatch real keyboard event
      const realTabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true
      })

      mockContainer.dispatchEvent(realTabEvent)

      expect(actualHandlerCalled).toBe(true)
      expect(result.current.focusedPanelId).toBe('panel2')

      // Clean up
      mockContainer.removeEventListener('keydown', realKeyboardHandler)
    })

    it('should handle event bubbling and capturing correctly', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2'],
        initialFocusedPanelId: 'panel1'
      }))

      act(() => {
        ['panel1', 'panel2'].forEach(id => {
          result.current.registerPanel(id)
        })
      })

      const captureHandler = vi.fn()
      const bubbleHandler = vi.fn()

      const keyboardHandler = (event: KeyboardEvent) => {
        if (event.key === 'Tab') {
          event.preventDefault()
          act(() => result.current.focusNext())
        }
      }

      // Add capture and bubble listeners
      mockContainer.addEventListener('keydown', captureHandler, true)
      mockContainer.addEventListener('keydown', keyboardHandler, false)
      mockContainer.addEventListener('keydown', bubbleHandler, false)

      // Dispatch event
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true
      })

      mockContainer.dispatchEvent(tabEvent)

      expect(captureHandler).toHaveBeenCalled()
      expect(bubbleHandler).toHaveBeenCalled()
      expect(result.current.focusedPanelId).toBe('panel2')

      // Clean up
      mockContainer.removeEventListener('keydown', captureHandler, true)
      mockContainer.removeEventListener('keydown', keyboardHandler, false)
      mockContainer.removeEventListener('keydown', bubbleHandler, false)
    })
  })
})