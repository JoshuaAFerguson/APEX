import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useAgentTerminalPanelState } from '../useAgentTerminalPanelState'
import type { UseAgentTerminalPanelStateOptions } from '@/types/agent-terminal-panel'

describe('useAgentTerminalPanelState - Focus Navigation', () => {
  describe('basic focus functionality', () => {
    it('should initialize with no focused panel by default', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3']
      }))

      expect(result.current.focusedPanelId).toBe(null)
      expect(result.current.focusedIndex).toBe(-1)
      expect(result.current.panelOrder).toEqual(['panel1', 'panel2', 'panel3'])
    })

    it('should initialize with specified focused panel', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel2'
      }))

      expect(result.current.focusedPanelId).toBe('panel2')
      expect(result.current.focusedIndex).toBe(1)
    })

    it('should ignore invalid initial focused panel', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'nonexistent'
      }))

      expect(result.current.focusedPanelId).toBe(null)
      expect(result.current.focusedIndex).toBe(-1)
    })

    it('should focus specific panel by ID', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3']
      }))

      act(() => {
        result.current.focusPanel('panel2')
      })

      expect(result.current.focusedPanelId).toBe('panel2')
      expect(result.current.focusedIndex).toBe(1)
      expect(result.current.isPanelFocused('panel2')).toBe(true)
      expect(result.current.isPanelFocused('panel1')).toBe(false)
    })

    it('should clear focus', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel1'
      }))

      expect(result.current.focusedPanelId).toBe('panel1')

      act(() => {
        result.current.clearFocus()
      })

      expect(result.current.focusedPanelId).toBe(null)
      expect(result.current.focusedIndex).toBe(-1)
    })
  })

  describe('focus navigation', () => {
    it('should move focus to next panel', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel1'
      }))

      expect(result.current.focusedPanelId).toBe('panel1')

      act(() => {
        result.current.focusNext()
      })

      expect(result.current.focusedPanelId).toBe('panel2')
      expect(result.current.focusedIndex).toBe(1)
    })

    it('should move focus to previous panel', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel2'
      }))

      expect(result.current.focusedPanelId).toBe('panel2')

      act(() => {
        result.current.focusPrevious()
      })

      expect(result.current.focusedPanelId).toBe('panel1')
      expect(result.current.focusedIndex).toBe(0)
    })

    it('should wrap focus from last to first panel with focusNext', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel3'
      }))

      expect(result.current.focusedPanelId).toBe('panel3')

      act(() => {
        result.current.focusNext()
      })

      expect(result.current.focusedPanelId).toBe('panel1')
      expect(result.current.focusedIndex).toBe(0)
    })

    it('should wrap focus from first to last panel with focusPrevious', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel1'
      }))

      expect(result.current.focusedPanelId).toBe('panel1')

      act(() => {
        result.current.focusPrevious()
      })

      expect(result.current.focusedPanelId).toBe('panel3')
      expect(result.current.focusedIndex).toBe(2)
    })

    it('should start at first panel when focusing next from no focus', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3']
      }))

      expect(result.current.focusedPanelId).toBe(null)

      act(() => {
        result.current.focusNext()
      })

      expect(result.current.focusedPanelId).toBe('panel1')
      expect(result.current.focusedIndex).toBe(0)
    })

    it('should start at last panel when focusing previous from no focus', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3']
      }))

      expect(result.current.focusedPanelId).toBe(null)

      act(() => {
        result.current.focusPrevious()
      })

      expect(result.current.focusedPanelId).toBe('panel3')
      expect(result.current.focusedIndex).toBe(2)
    })
  })

  describe('panel order management', () => {
    it('should update panel order', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3']
      }))

      expect(result.current.panelOrder).toEqual(['panel1', 'panel2', 'panel3'])

      act(() => {
        result.current.setPanelOrder(['panel3', 'panel1', 'panel2'])
      })

      expect(result.current.panelOrder).toEqual(['panel3', 'panel1', 'panel2'])
    })

    it('should clear focus when focused panel removed from order', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel2'
      }))

      expect(result.current.focusedPanelId).toBe('panel2')

      act(() => {
        result.current.setPanelOrder(['panel1', 'panel3']) // Remove panel2
      })

      expect(result.current.focusedPanelId).toBe(null)
      expect(result.current.panelOrder).toEqual(['panel1', 'panel3'])
    })

    it('should maintain focus when panel order changes but focused panel remains', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel2'
      }))

      expect(result.current.focusedPanelId).toBe('panel2')
      expect(result.current.focusedIndex).toBe(1)

      act(() => {
        result.current.setPanelOrder(['panel3', 'panel2', 'panel1']) // Reorder but keep panel2
      })

      expect(result.current.focusedPanelId).toBe('panel2')
      expect(result.current.focusedIndex).toBe(1) // New index in reordered list
    })
  })

  describe('focus callbacks', () => {
    it('should call onFocusChange when focus changes', () => {
      const onFocusChange = vi.fn()
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2'],
        onFocusChange
      }))

      act(() => {
        result.current.focusPanel('panel1')
      })

      expect(onFocusChange).toHaveBeenCalledWith('panel1', null)

      act(() => {
        result.current.focusPanel('panel2')
      })

      expect(onFocusChange).toHaveBeenCalledWith('panel2', 'panel1')
    })

    it('should call onFocusChange when clearing focus', () => {
      const onFocusChange = vi.fn()
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2'],
        initialFocusedPanelId: 'panel1',
        onFocusChange
      }))

      onFocusChange.mockClear() // Clear initial call

      act(() => {
        result.current.clearFocus()
      })

      expect(onFocusChange).toHaveBeenCalledWith(null, 'panel1')
    })

    it('should call onFocusChange when navigating', () => {
      const onFocusChange = vi.fn()
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2'],
        initialFocusedPanelId: 'panel1',
        onFocusChange
      }))

      onFocusChange.mockClear() // Clear initial call

      act(() => {
        result.current.focusNext()
      })

      expect(onFocusChange).toHaveBeenCalledWith('panel2', 'panel1')
    })

    it('should not call onFocusChange when focusing already focused panel', () => {
      const onFocusChange = vi.fn()
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2'],
        initialFocusedPanelId: 'panel1',
        onFocusChange
      }))

      onFocusChange.mockClear() // Clear initial call

      act(() => {
        result.current.focusPanel('panel1')
      })

      // Should not call onFocusChange when focusing the same panel
      expect(onFocusChange).not.toHaveBeenCalled()
    })
  })

  describe('panel registration integration', () => {
    it('should add registered panel to panel order', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState())

      act(() => {
        result.current.registerPanel('panel1')
      })

      expect(result.current.panelOrder).toContain('panel1')

      act(() => {
        result.current.registerPanel('panel2')
      })

      expect(result.current.panelOrder).toEqual(['panel1', 'panel2'])
    })

    it('should remove unregistered panel from panel order and clear focus', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel2'
      }))

      // Register panels first
      act(() => {
        result.current.registerPanel('panel1')
        result.current.registerPanel('panel2')
        result.current.registerPanel('panel3')
      })

      expect(result.current.focusedPanelId).toBe('panel2')

      act(() => {
        result.current.unregisterPanel('panel2')
      })

      expect(result.current.panelOrder).not.toContain('panel2')
      expect(result.current.focusedPanelId).toBe(null)
    })
  })

  describe('edge cases', () => {
    it('should handle empty panel order', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState())

      expect(result.current.focusedPanelId).toBe(null)
      expect(result.current.focusedIndex).toBe(-1)

      act(() => {
        result.current.focusNext()
      })

      expect(result.current.focusedPanelId).toBe(null)

      act(() => {
        result.current.focusPrevious()
      })

      expect(result.current.focusedPanelId).toBe(null)
    })

    it('should handle single panel', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1'],
        initialFocusedPanelId: 'panel1'
      }))

      expect(result.current.focusedPanelId).toBe('panel1')

      act(() => {
        result.current.focusNext()
      })

      expect(result.current.focusedPanelId).toBe('panel1') // Should wrap to itself

      act(() => {
        result.current.focusPrevious()
      })

      expect(result.current.focusedPanelId).toBe('panel1') // Should wrap to itself
    })

    it('should ignore focusing non-existent panel', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2']
      }))

      act(() => {
        result.current.focusPanel('nonexistent')
      })

      expect(result.current.focusedPanelId).toBe(null)
    })
  })

  describe('integration with panel states', () => {
    it('should maintain focus when panel states change', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel2'
      }))

      // Register panels first
      act(() => {
        result.current.registerPanel('panel1')
        result.current.registerPanel('panel2')
        result.current.registerPanel('panel3')
      })

      expect(result.current.focusedPanelId).toBe('panel2')

      // Change panel state
      act(() => {
        result.current.minimize('panel2')
      })

      // Focus should remain on panel2
      expect(result.current.focusedPanelId).toBe('panel2')
      expect(result.current.getPanelState('panel2')).toBe('minimized')
    })

    it('should work correctly with maximize mutual exclusivity', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        initialPanelOrder: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel1'
      }))

      // Register panels first
      act(() => {
        result.current.registerPanel('panel1')
        result.current.registerPanel('panel2')
        result.current.registerPanel('panel3')
      })

      // Maximize focused panel
      act(() => {
        result.current.maximize('panel1')
      })

      expect(result.current.focusedPanelId).toBe('panel1')
      expect(result.current.getPanelState('panel1')).toBe('maximized')

      // Move focus and maximize another panel
      act(() => {
        result.current.focusNext()
        result.current.maximize('panel2')
      })

      expect(result.current.focusedPanelId).toBe('panel2')
      expect(result.current.getPanelState('panel1')).toBe('normal') // Should be restored
      expect(result.current.getPanelState('panel2')).toBe('maximized')
    })
  })

  describe('function stability', () => {
    it('should return stable function references', () => {
      const { result, rerender } = renderHook(() => useAgentTerminalPanelState())

      const initialFunctions = {
        focusNext: result.current.focusNext,
        focusPrevious: result.current.focusPrevious,
        focusPanel: result.current.focusPanel,
        clearFocus: result.current.clearFocus,
        isPanelFocused: result.current.isPanelFocused,
        setPanelOrder: result.current.setPanelOrder,
      }

      // Rerender to check function stability
      rerender()

      expect(result.current.focusNext).toBe(initialFunctions.focusNext)
      expect(result.current.focusPrevious).toBe(initialFunctions.focusPrevious)
      expect(result.current.focusPanel).toBe(initialFunctions.focusPanel)
      expect(result.current.clearFocus).toBe(initialFunctions.clearFocus)
      expect(result.current.isPanelFocused).toBe(initialFunctions.isPanelFocused)
      expect(result.current.setPanelOrder).toBe(initialFunctions.setPanelOrder)
    })
  })
})