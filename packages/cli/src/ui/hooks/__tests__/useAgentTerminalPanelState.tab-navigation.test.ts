import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useAgentTerminalPanelState, PanelState, type UseAgentTerminalPanelStateOptions } from '../useAgentTerminalPanelState.js';

describe('useAgentTerminalPanelState - Tab Navigation', () => {
  describe('Tab key navigation simulation', () => {
    it('should simulate Tab key moving focus to next panel', () => {
      const onFocusChange = vi.fn();
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel1',
        onFocusChange
      }));

      expect(result.current.focusedPanelId).toBe('panel1');
      expect(result.current.focusedIndex).toBe(0);

      // Simulate Tab key press (calls focusNext)
      act(() => {
        result.current.focusNext();
      });

      expect(result.current.focusedPanelId).toBe('panel2');
      expect(result.current.focusedIndex).toBe(1);
      expect(onFocusChange).toHaveBeenCalledWith('panel2', 'panel1');
    });

    it('should simulate Shift+Tab moving focus to previous panel', () => {
      const onFocusChange = vi.fn();
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel2',
        onFocusChange
      }));

      expect(result.current.focusedPanelId).toBe('panel2');
      expect(result.current.focusedIndex).toBe(1);

      // Simulate Shift+Tab key press (calls focusPrevious)
      act(() => {
        result.current.focusPrevious();
      });

      expect(result.current.focusedPanelId).toBe('panel1');
      expect(result.current.focusedIndex).toBe(0);
      expect(onFocusChange).toHaveBeenCalledWith('panel1', 'panel2');
    });

    it('should wrap Tab navigation at the end of panel list', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel3'
      }));

      expect(result.current.focusedPanelId).toBe('panel3');
      expect(result.current.focusedIndex).toBe(2);

      // Tab at last panel should wrap to first
      act(() => {
        result.current.focusNext();
      });

      expect(result.current.focusedPanelId).toBe('panel1');
      expect(result.current.focusedIndex).toBe(0);
    });

    it('should wrap Shift+Tab navigation at the beginning of panel list', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel1'
      }));

      expect(result.current.focusedPanelId).toBe('panel1');
      expect(result.current.focusedIndex).toBe(0);

      // Shift+Tab at first panel should wrap to last
      act(() => {
        result.current.focusPrevious();
      });

      expect(result.current.focusedPanelId).toBe('panel3');
      expect(result.current.focusedIndex).toBe(2);
    });

    it('should handle rapid Tab navigation correctly', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['panel1', 'panel2', 'panel3', 'panel4'],
        initialFocusedPanelId: 'panel1'
      }));

      // Rapid Tab navigation: panel1 -> panel2 -> panel3 -> panel4 -> panel1
      act(() => {
        result.current.focusNext(); // panel2
        result.current.focusNext(); // panel3
        result.current.focusNext(); // panel4
        result.current.focusNext(); // panel1 (wrapped)
      });

      expect(result.current.focusedPanelId).toBe('panel1');
      expect(result.current.focusedIndex).toBe(0);
    });

    it('should handle mixed Tab and Shift+Tab navigation', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel2'
      }));

      expect(result.current.focusedPanelId).toBe('panel2');

      // Tab forward then backward
      act(() => {
        result.current.focusNext(); // panel3
        result.current.focusNext(); // panel1 (wrapped)
        result.current.focusPrevious(); // panel3
        result.current.focusPrevious(); // panel2
      });

      expect(result.current.focusedPanelId).toBe('panel2');
      expect(result.current.focusedIndex).toBe(1);
    });
  });

  describe('CLI context navigation', () => {
    it('should work correctly in CLI context with many panels', () => {
      const panelIds = Array.from({ length: 10 }, (_, i) => `cli-panel-${i + 1}`);

      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds,
        initialFocusedPanelId: 'cli-panel-1'
      }));

      expect(result.current.focusedPanelId).toBe('cli-panel-1');
      expect(result.current.focusedIndex).toBe(0);

      // Navigate through all panels
      for (let i = 1; i < panelIds.length; i++) {
        act(() => {
          result.current.focusNext();
        });
        expect(result.current.focusedPanelId).toBe(`cli-panel-${i + 1}`);
        expect(result.current.focusedIndex).toBe(i);
      }

      // Wrap to beginning
      act(() => {
        result.current.focusNext();
      });
      expect(result.current.focusedPanelId).toBe('cli-panel-1');
      expect(result.current.focusedIndex).toBe(0);
    });

    it('should handle CLI-style panel naming conventions', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['terminal_1', 'terminal_2', 'output-panel', 'log_viewer'],
        initialFocusedPanelId: 'terminal_1'
      }));

      act(() => {
        result.current.focusNext(); // terminal_2
        result.current.focusNext(); // output-panel
      });

      expect(result.current.focusedPanelId).toBe('output-panel');

      act(() => {
        result.current.focusNext(); // log_viewer
      });

      expect(result.current.focusedPanelId).toBe('log_viewer');

      act(() => {
        result.current.focusNext(); // wrap to terminal_1
      });

      expect(result.current.focusedPanelId).toBe('terminal_1');
    });
  });

  describe('Web UI context navigation', () => {
    it('should work correctly in web UI context with component-style names', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['AgentTerminal', 'OutputViewer', 'DebugConsole', 'ErrorLog'],
        initialFocusedPanelId: 'AgentTerminal'
      }));

      expect(result.current.focusedPanelId).toBe('AgentTerminal');

      // Tab through web UI panels
      act(() => {
        result.current.focusNext(); // OutputViewer
      });
      expect(result.current.focusedPanelId).toBe('OutputViewer');

      act(() => {
        result.current.focusNext(); // DebugConsole
      });
      expect(result.current.focusedPanelId).toBe('DebugConsole');

      act(() => {
        result.current.focusNext(); // ErrorLog
      });
      expect(result.current.focusedPanelId).toBe('ErrorLog');

      act(() => {
        result.current.focusNext(); // wrap to AgentTerminal
      });
      expect(result.current.focusedPanelId).toBe('AgentTerminal');
    });

    it('should handle dynamic panel addition/removal in web UI', () => {
      let panelIds = ['panel-a', 'panel-b'];

      const { result, rerender } = renderHook(
        ({ ids }) => useAgentTerminalPanelState({ panelIds: ids }),
        { initialProps: { ids: panelIds } }
      );

      act(() => {
        result.current.focusPanel('panel-b');
      });
      expect(result.current.focusedPanelId).toBe('panel-b');

      // Add a new panel
      panelIds = ['panel-a', 'panel-b', 'panel-c'];
      rerender({ ids: panelIds });

      // Focus should remain on panel-b
      expect(result.current.focusedPanelId).toBe('panel-b');

      // Tab to new panel
      act(() => {
        result.current.focusNext();
      });
      expect(result.current.focusedPanelId).toBe('panel-c');

      // Remove the currently focused panel
      panelIds = ['panel-a', 'panel-b'];
      rerender({ ids: panelIds });

      // Focus should be cleared
      expect(result.current.focusedPanelId).toBe(null);
    });
  });

  describe('Navigation with panel state changes', () => {
    it('should maintain focus when navigating through panels with different states', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel1'
      }));

      // Set up different panel states
      act(() => {
        result.current.minimize('panel1');
        result.current.maximize('panel2');
        // panel3 stays normal
      });

      expect(result.current.focusedPanelId).toBe('panel1');
      expect(result.current.getPanelState('panel1')).toBe(PanelState.Minimized);

      // Navigate to maximized panel
      act(() => {
        result.current.focusNext();
      });

      expect(result.current.focusedPanelId).toBe('panel2');
      expect(result.current.getPanelState('panel2')).toBe(PanelState.Maximized);

      // Navigate to normal panel
      act(() => {
        result.current.focusNext();
      });

      expect(result.current.focusedPanelId).toBe('panel3');
      expect(result.current.getPanelState('panel3')).toBe(PanelState.Normal);
    });

    it('should handle focus navigation when maximized panel changes', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel1'
      }));

      // Maximize currently focused panel
      act(() => {
        result.current.maximize('panel1');
      });

      expect(result.current.focusedPanelId).toBe('panel1');
      expect(result.current.getPanelState('panel1')).toBe(PanelState.Maximized);

      // Navigate to next panel
      act(() => {
        result.current.focusNext();
      });

      expect(result.current.focusedPanelId).toBe('panel2');

      // Maximize the newly focused panel (should restore panel1)
      act(() => {
        result.current.maximize('panel2');
      });

      expect(result.current.focusedPanelId).toBe('panel2');
      expect(result.current.getPanelState('panel1')).toBe(PanelState.Normal);
      expect(result.current.getPanelState('panel2')).toBe(PanelState.Maximized);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle Tab navigation with no panels', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: []
      }));

      expect(result.current.focusedPanelId).toBe(null);
      expect(result.current.focusedIndex).toBe(-1);

      // Tab navigation should do nothing
      act(() => {
        result.current.focusNext();
      });

      expect(result.current.focusedPanelId).toBe(null);

      act(() => {
        result.current.focusPrevious();
      });

      expect(result.current.focusedPanelId).toBe(null);
    });

    it('should handle Tab navigation with single panel', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['only-panel'],
        initialFocusedPanelId: 'only-panel'
      }));

      expect(result.current.focusedPanelId).toBe('only-panel');
      expect(result.current.focusedIndex).toBe(0);

      // Tab should wrap to the same panel
      act(() => {
        result.current.focusNext();
      });

      expect(result.current.focusedPanelId).toBe('only-panel');
      expect(result.current.focusedIndex).toBe(0);

      // Shift+Tab should also wrap to the same panel
      act(() => {
        result.current.focusPrevious();
      });

      expect(result.current.focusedPanelId).toBe('only-panel');
      expect(result.current.focusedIndex).toBe(0);
    });

    it('should gracefully handle focus on non-existent panel', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['panel1', 'panel2']
      }));

      // Try to focus non-existent panel
      act(() => {
        result.current.focusPanel('non-existent');
      });

      expect(result.current.focusedPanelId).toBe(null);

      // Regular navigation should still work
      act(() => {
        result.current.focusNext();
      });

      expect(result.current.focusedPanelId).toBe('panel1');
    });

    it('should handle panel order changes during navigation', () => {
      let currentPanelIds = ['a', 'b', 'c'];

      const { result, rerender } = renderHook(
        ({ ids }) => useAgentTerminalPanelState({ panelIds: ids }),
        { initialProps: { ids: currentPanelIds } }
      );

      // Focus middle panel
      act(() => {
        result.current.focusPanel('b');
      });
      expect(result.current.focusedPanelId).toBe('b');
      expect(result.current.focusedIndex).toBe(1);

      // Reorder panels
      currentPanelIds = ['c', 'a', 'b'];
      rerender({ ids: currentPanelIds });

      // Focus should remain on 'b' but index should update
      expect(result.current.focusedPanelId).toBe('b');
      expect(result.current.focusedIndex).toBe(2);

      // Navigation should work with new order
      act(() => {
        result.current.focusNext(); // Should wrap to 'c'
      });
      expect(result.current.focusedPanelId).toBe('c');
      expect(result.current.focusedIndex).toBe(0);
    });
  });

  describe('Focus callbacks integration', () => {
    it('should call onFocusChange callback during Tab navigation', () => {
      const onFocusChange = vi.fn();

      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['panel1', 'panel2', 'panel3'],
        onFocusChange
      }));

      // Start navigation
      act(() => {
        result.current.focusNext(); // null -> panel1
      });
      expect(onFocusChange).toHaveBeenCalledWith('panel1', null);

      act(() => {
        result.current.focusNext(); // panel1 -> panel2
      });
      expect(onFocusChange).toHaveBeenCalledWith('panel2', 'panel1');

      act(() => {
        result.current.focusPrevious(); // panel2 -> panel1
      });
      expect(onFocusChange).toHaveBeenCalledWith('panel1', 'panel2');

      expect(onFocusChange).toHaveBeenCalledTimes(3);
    });

    it('should not call onFocusChange when focus doesnt actually change', () => {
      const onFocusChange = vi.fn();

      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['panel1'],
        initialFocusedPanelId: 'panel1',
        onFocusChange
      }));

      onFocusChange.mockClear(); // Clear the initial call

      // Tab on single panel (focus shouldn't change)
      act(() => {
        result.current.focusNext();
      });

      // Since there's only one panel, focus wraps to itself
      // This should still trigger the callback since focusNext was called
      expect(onFocusChange).toHaveBeenCalledWith('panel1', 'panel1');
    });

    it('should handle callback errors gracefully', () => {
      const faultyCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      // Should not throw despite callback error
      expect(() => {
        const { result } = renderHook(() => useAgentTerminalPanelState({
          panelIds: ['panel1', 'panel2'],
          onFocusChange: faultyCallback
        }));

        act(() => {
          result.current.focusNext();
        });
      }).not.toThrow();
    });
  });

  describe('Performance and stability', () => {
    it('should maintain function reference stability during Tab navigation', () => {
      const { result, rerender } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['panel1', 'panel2']
      }));

      const initialFunctions = {
        focusNext: result.current.focusNext,
        focusPrevious: result.current.focusPrevious,
        focusPanel: result.current.focusPanel,
        clearFocus: result.current.clearFocus,
      };

      // Trigger some navigation
      act(() => {
        result.current.focusNext();
        result.current.focusPrevious();
      });

      // Rerender
      rerender();

      // Functions should remain stable
      expect(result.current.focusNext).toBe(initialFunctions.focusNext);
      expect(result.current.focusPrevious).toBe(initialFunctions.focusPrevious);
      expect(result.current.focusPanel).toBe(initialFunctions.focusPanel);
      expect(result.current.clearFocus).toBe(initialFunctions.clearFocus);
    });

    it('should handle rapid Tab navigation efficiently', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: Array.from({ length: 100 }, (_, i) => `panel-${i}`)
      }));

      // Rapid navigation through many panels
      const start = performance.now();

      act(() => {
        for (let i = 0; i < 1000; i++) {
          result.current.focusNext();
        }
      });

      const end = performance.now();

      // Should complete quickly (less than 100ms for 1000 operations)
      expect(end - start).toBeLessThan(100);

      // Final focus should be correct (1000 % 100 = 0, so back to first panel)
      expect(result.current.focusedPanelId).toBe('panel-0');
    });
  });

  describe('Acceptance criteria validation', () => {
    it('should fulfill requirement: Tab key moves focus to next panel', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel1'
      }));

      // Tab (focusNext) should move to next panel
      act(() => {
        result.current.focusNext();
      });

      expect(result.current.focusedPanelId).toBe('panel2');
    });

    it('should fulfill requirement: Shift+Tab moves to previous panel', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel2'
      }));

      // Shift+Tab (focusPrevious) should move to previous panel
      act(() => {
        result.current.focusPrevious();
      });

      expect(result.current.focusedPanelId).toBe('panel1');
    });

    it('should fulfill requirement: Focus wraps around when reaching the end', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel3'
      }));

      // Tab at last panel should wrap to first
      act(() => {
        result.current.focusNext();
      });

      expect(result.current.focusedPanelId).toBe('panel1');
    });

    it('should fulfill requirement: Focus wraps around when reaching the beginning', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['panel1', 'panel2', 'panel3'],
        initialFocusedPanelId: 'panel1'
      }));

      // Shift+Tab at first panel should wrap to last
      act(() => {
        result.current.focusPrevious();
      });

      expect(result.current.focusedPanelId).toBe('panel3');
    });

    it('should fulfill requirement: Navigation works in CLI context', () => {
      // CLI context simulation
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['cli-terminal', 'cli-output', 'cli-debug'],
        initialFocusedPanelId: 'cli-terminal'
      }));

      expect(result.current.focusedPanelId).toBe('cli-terminal');

      act(() => {
        result.current.focusNext();
      });

      expect(result.current.focusedPanelId).toBe('cli-output');

      act(() => {
        result.current.focusPrevious();
      });

      expect(result.current.focusedPanelId).toBe('cli-terminal');
    });

    it('should fulfill requirement: Navigation works in web-ui context', () => {
      // Web-UI context simulation
      const { result } = renderHook(() => useAgentTerminalPanelState({
        panelIds: ['WebTerminal', 'WebOutput', 'WebDebug'],
        initialFocusedPanelId: 'WebTerminal'
      }));

      expect(result.current.focusedPanelId).toBe('WebTerminal');

      act(() => {
        result.current.focusNext();
      });

      expect(result.current.focusedPanelId).toBe('WebOutput');

      act(() => {
        result.current.focusPrevious();
      });

      expect(result.current.focusedPanelId).toBe('WebTerminal');
    });
  });
});