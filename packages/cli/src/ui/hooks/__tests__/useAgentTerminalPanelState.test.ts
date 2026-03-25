import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useAgentTerminalPanelState, PanelState, type UseAgentTerminalPanelStateOptions } from '../useAgentTerminalPanelState.js';

describe('useAgentTerminalPanelState', () => {
  describe('uncontrolled mode', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState());

      expect(result.current.getPanelState('panel1')).toBe(PanelState.Normal);
      expect(result.current.getPanelState('panel2')).toBe(PanelState.Normal);
      expect(result.current.getAllPanelStates()).toEqual({});
    });

    it('should initialize with custom initial states', () => {
      const initialStates = {
        panel1: PanelState.Minimized,
        panel2: PanelState.Maximized,
      };

      const { result } = renderHook(() =>
        useAgentTerminalPanelState({ initialPanelStates: initialStates })
      );

      expect(result.current.getPanelState('panel1')).toBe(PanelState.Minimized);
      expect(result.current.getPanelState('panel2')).toBe(PanelState.Maximized);
      expect(result.current.getAllPanelStates()).toEqual(initialStates);
    });

    it('should use custom default state for unknown panels', () => {
      const { result } = renderHook(() =>
        useAgentTerminalPanelState({ defaultPanelState: PanelState.Minimized })
      );

      expect(result.current.getPanelState('unknownPanel')).toBe(PanelState.Minimized);
    });

    describe('minimize function', () => {
      it('should minimize a panel', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState());

        act(() => {
          result.current.minimize('panel1');
        });

        expect(result.current.getPanelState('panel1')).toBe(PanelState.Minimized);
      });

      it('should minimize multiple panels independently', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState());

        act(() => {
          result.current.minimize('panel1');
          result.current.minimize('panel2');
        });

        expect(result.current.getPanelState('panel1')).toBe(PanelState.Minimized);
        expect(result.current.getPanelState('panel2')).toBe(PanelState.Minimized);
      });
    });

    describe('maximize function', () => {
      it('should maximize a panel', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState());

        act(() => {
          result.current.maximize('panel1');
        });

        expect(result.current.getPanelState('panel1')).toBe(PanelState.Maximized);
      });

      it('should enforce mutual exclusivity - only one panel maximized at a time', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState());

        act(() => {
          result.current.maximize('panel1');
        });

        expect(result.current.getPanelState('panel1')).toBe(PanelState.Maximized);

        act(() => {
          result.current.maximize('panel2');
        });

        // panel1 should be restored to normal, panel2 should be maximized
        expect(result.current.getPanelState('panel1')).toBe(PanelState.Normal);
        expect(result.current.getPanelState('panel2')).toBe(PanelState.Maximized);
      });

      it('should not change state when maximizing an already maximized panel', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState());

        act(() => {
          result.current.maximize('panel1');
        });

        expect(result.current.getPanelState('panel1')).toBe(PanelState.Maximized);

        act(() => {
          result.current.maximize('panel1'); // Maximize same panel again
        });

        expect(result.current.getPanelState('panel1')).toBe(PanelState.Maximized);
      });

      it('should handle maximizing when starting from minimized state', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState());

        act(() => {
          result.current.minimize('panel1');
          result.current.maximize('panel1');
        });

        expect(result.current.getPanelState('panel1')).toBe(PanelState.Maximized);
      });
    });

    describe('restore function', () => {
      it('should restore a minimized panel to normal', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState());

        act(() => {
          result.current.minimize('panel1');
          result.current.restore('panel1');
        });

        expect(result.current.getPanelState('panel1')).toBe(PanelState.Normal);
      });

      it('should restore a maximized panel to normal', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState());

        act(() => {
          result.current.maximize('panel1');
          result.current.restore('panel1');
        });

        expect(result.current.getPanelState('panel1')).toBe(PanelState.Normal);
      });

      it('should not change state when restoring an already normal panel', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState());

        expect(result.current.getPanelState('panel1')).toBe(PanelState.Normal);

        act(() => {
          result.current.restore('panel1');
        });

        expect(result.current.getPanelState('panel1')).toBe(PanelState.Normal);
      });
    });

    describe('restoreAll function', () => {
      it('should restore all panels to normal state', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState());

        act(() => {
          result.current.minimize('panel1');
          result.current.maximize('panel2');
          result.current.minimize('panel3');
        });

        expect(result.current.getPanelState('panel1')).toBe(PanelState.Minimized);
        expect(result.current.getPanelState('panel2')).toBe(PanelState.Maximized);
        expect(result.current.getPanelState('panel3')).toBe(PanelState.Minimized);

        act(() => {
          result.current.restoreAll();
        });

        expect(result.current.getPanelState('panel1')).toBe(PanelState.Normal);
        expect(result.current.getPanelState('panel2')).toBe(PanelState.Normal);
        expect(result.current.getPanelState('panel3')).toBe(PanelState.Normal);
      });

      it('should handle restoreAll when no panels need restoring', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState());

        // All panels are already normal by default
        act(() => {
          result.current.restoreAll();
        });

        expect(result.current.getPanelState('panel1')).toBe(PanelState.Normal);
        expect(result.current.getPanelState('panel2')).toBe(PanelState.Normal);
      });

      it('should restore from initial non-normal states', () => {
        const initialStates = {
          panel1: PanelState.Minimized,
          panel2: PanelState.Maximized,
          panel3: PanelState.Normal,
        };

        const { result } = renderHook(() =>
          useAgentTerminalPanelState({ initialPanelStates: initialStates })
        );

        act(() => {
          result.current.restoreAll();
        });

        expect(result.current.getPanelState('panel1')).toBe(PanelState.Normal);
        expect(result.current.getPanelState('panel2')).toBe(PanelState.Normal);
        expect(result.current.getPanelState('panel3')).toBe(PanelState.Normal);
      });
    });

    describe('state transitions', () => {
      it('should handle complex state transition sequences', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState());

        // Start with normal state
        expect(result.current.getPanelState('panel1')).toBe(PanelState.Normal);

        // Minimize
        act(() => {
          result.current.minimize('panel1');
        });
        expect(result.current.getPanelState('panel1')).toBe(PanelState.Minimized);

        // Maximize (should go directly from minimized to maximized)
        act(() => {
          result.current.maximize('panel1');
        });
        expect(result.current.getPanelState('panel1')).toBe(PanelState.Maximized);

        // Minimize again
        act(() => {
          result.current.minimize('panel1');
        });
        expect(result.current.getPanelState('panel1')).toBe(PanelState.Minimized);

        // Restore to normal
        act(() => {
          result.current.restore('panel1');
        });
        expect(result.current.getPanelState('panel1')).toBe(PanelState.Normal);
      });

      it('should maintain mutual exclusivity across multiple operations', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState());

        // Maximize panel1
        act(() => {
          result.current.maximize('panel1');
        });
        expect(result.current.getPanelState('panel1')).toBe(PanelState.Maximized);

        // Maximize panel2 (should restore panel1)
        act(() => {
          result.current.maximize('panel2');
        });
        expect(result.current.getPanelState('panel1')).toBe(PanelState.Normal);
        expect(result.current.getPanelState('panel2')).toBe(PanelState.Maximized);

        // Maximize panel3 (should restore panel2)
        act(() => {
          result.current.maximize('panel3');
        });
        expect(result.current.getPanelState('panel1')).toBe(PanelState.Normal);
        expect(result.current.getPanelState('panel2')).toBe(PanelState.Normal);
        expect(result.current.getPanelState('panel3')).toBe(PanelState.Maximized);

        // Verify only one panel is maximized
        const allStates = result.current.getAllPanelStates();
        const maximizedPanels = Object.values(allStates).filter(state => state === PanelState.Maximized);
        expect(maximizedPanels).toHaveLength(1);
      });
    });
  });

  describe('controlled mode', () => {
    it('should use controlled panel states', () => {
      const controlledStates = {
        panel1: PanelState.Minimized,
        panel2: PanelState.Maximized,
      };

      const { result } = renderHook(() =>
        useAgentTerminalPanelState({ panelStates: controlledStates })
      );

      expect(result.current.getPanelState('panel1')).toBe(PanelState.Minimized);
      expect(result.current.getPanelState('panel2')).toBe(PanelState.Maximized);
      expect(result.current.getAllPanelStates()).toEqual(controlledStates);
    });

    it('should call onPanelStateChange when state is updated', () => {
      const onPanelStateChange = vi.fn();
      const controlledStates = { panel1: PanelState.Normal };

      const { result } = renderHook(() =>
        useAgentTerminalPanelState({
          panelStates: controlledStates,
          onPanelStateChange
        })
      );

      act(() => {
        result.current.minimize('panel1');
      });

      expect(onPanelStateChange).toHaveBeenCalledWith('panel1', PanelState.Minimized);
    });

    it('should call onPanelStateChange for maximize with mutual exclusivity', () => {
      const onPanelStateChange = vi.fn();
      const controlledStates = {
        panel1: PanelState.Maximized,
        panel2: PanelState.Normal,
      };

      const { result } = renderHook(() =>
        useAgentTerminalPanelState({
          panelStates: controlledStates,
          onPanelStateChange
        })
      );

      act(() => {
        result.current.maximize('panel2');
      });

      // Should call twice: once to restore panel1, once to maximize panel2
      expect(onPanelStateChange).toHaveBeenCalledTimes(2);
      expect(onPanelStateChange).toHaveBeenCalledWith('panel1', PanelState.Normal);
      expect(onPanelStateChange).toHaveBeenCalledWith('panel2', PanelState.Maximized);
    });

    it('should call onPanelStateChange for restoreAll', () => {
      const onPanelStateChange = vi.fn();
      const controlledStates = {
        panel1: PanelState.Minimized,
        panel2: PanelState.Maximized,
        panel3: PanelState.Normal,
      };

      const { result } = renderHook(() =>
        useAgentTerminalPanelState({
          panelStates: controlledStates,
          onPanelStateChange
        })
      );

      act(() => {
        result.current.restoreAll();
      });

      // Should only call for panels that need restoring (panel1 and panel2)
      expect(onPanelStateChange).toHaveBeenCalledTimes(2);
      expect(onPanelStateChange).toHaveBeenCalledWith('panel1', PanelState.Normal);
      expect(onPanelStateChange).toHaveBeenCalledWith('panel2', PanelState.Normal);
    });

    it('should not call onPanelStateChange when callback is not provided', () => {
      const controlledStates = { panel1: PanelState.Normal };

      const { result } = renderHook(() =>
        useAgentTerminalPanelState({ panelStates: controlledStates })
      );

      // Should not throw error when callback is undefined
      expect(() => {
        act(() => {
          result.current.minimize('panel1');
        });
      }).not.toThrow();
    });

    it('should work with updated controlled states', () => {
      let controlledStates = { panel1: PanelState.Normal };
      const onPanelStateChange = vi.fn();

      const { result, rerender } = renderHook(
        ({ states }) => useAgentTerminalPanelState({
          panelStates: states,
          onPanelStateChange
        }),
        { initialProps: { states: controlledStates } }
      );

      expect(result.current.getPanelState('panel1')).toBe(PanelState.Normal);

      // Update controlled states
      controlledStates = { panel1: PanelState.Minimized };
      rerender({ states: controlledStates });

      expect(result.current.getPanelState('panel1')).toBe(PanelState.Minimized);
    });
  });

  describe('function stability', () => {
    it('should return stable function references', () => {
      const { result, rerender } = renderHook(() => useAgentTerminalPanelState());

      const initialFunctions = {
        minimize: result.current.minimize,
        maximize: result.current.maximize,
        restore: result.current.restore,
        restoreAll: result.current.restoreAll,
        getPanelState: result.current.getPanelState,
        getAllPanelStates: result.current.getAllPanelStates,
      };

      // Rerender to check function stability
      rerender();

      expect(result.current.minimize).toBe(initialFunctions.minimize);
      expect(result.current.maximize).toBe(initialFunctions.maximize);
      expect(result.current.restore).toBe(initialFunctions.restore);
      expect(result.current.restoreAll).toBe(initialFunctions.restoreAll);
      expect(result.current.getPanelState).toBe(initialFunctions.getPanelState);
      expect(result.current.getAllPanelStates).toBe(initialFunctions.getAllPanelStates);
    });

    it('should maintain function stability in controlled mode', () => {
      const onPanelStateChange = vi.fn();
      const controlledStates = { panel1: PanelState.Normal };

      const { result, rerender } = renderHook(() =>
        useAgentTerminalPanelState({
          panelStates: controlledStates,
          onPanelStateChange
        })
      );

      const initialFunctions = {
        minimize: result.current.minimize,
        maximize: result.current.maximize,
        restore: result.current.restore,
        restoreAll: result.current.restoreAll,
        getPanelState: result.current.getPanelState,
        getAllPanelStates: result.current.getAllPanelStates,
      };

      rerender();

      expect(result.current.minimize).toBe(initialFunctions.minimize);
      expect(result.current.maximize).toBe(initialFunctions.maximize);
      expect(result.current.restore).toBe(initialFunctions.restore);
      expect(result.current.restoreAll).toBe(initialFunctions.restoreAll);
      expect(result.current.getPanelState).toBe(initialFunctions.getPanelState);
      expect(result.current.getAllPanelStates).toBe(initialFunctions.getAllPanelStates);
    });
  });

  describe('edge cases', () => {
    it('should handle empty panel IDs gracefully', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState());

      expect(() => {
        act(() => {
          result.current.minimize('');
          result.current.maximize('');
          result.current.restore('');
        });
      }).not.toThrow();

      expect(result.current.getPanelState('')).toBe(PanelState.Normal);
    });

    it('should handle special characters in panel IDs', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState());
      const specialPanelId = 'panel-with-special_chars.123';

      act(() => {
        result.current.minimize(specialPanelId);
      });

      expect(result.current.getPanelState(specialPanelId)).toBe(PanelState.Minimized);
    });

    it('should handle rapid state changes correctly', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState());

      act(() => {
        // Rapid state changes
        result.current.minimize('panel1');
        result.current.maximize('panel1');
        result.current.minimize('panel1');
        result.current.restore('panel1');
        result.current.maximize('panel1');
      });

      expect(result.current.getPanelState('panel1')).toBe(PanelState.Maximized);
    });

    it('should maintain mutual exclusivity even with rapid maximize calls', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState());

      act(() => {
        result.current.maximize('panel1');
        result.current.maximize('panel2');
        result.current.maximize('panel3');
        result.current.maximize('panel4');
      });

      // Only panel4 should be maximized
      expect(result.current.getPanelState('panel1')).toBe(PanelState.Normal);
      expect(result.current.getPanelState('panel2')).toBe(PanelState.Normal);
      expect(result.current.getPanelState('panel3')).toBe(PanelState.Normal);
      expect(result.current.getPanelState('panel4')).toBe(PanelState.Maximized);

      // Verify only one panel is maximized
      const allStates = result.current.getAllPanelStates();
      const maximizedPanels = Object.values(allStates).filter(state => state === PanelState.Maximized);
      expect(maximizedPanels).toHaveLength(1);
    });
  });

  describe('performance considerations', () => {
    it('should minimize re-renders with memoization', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState());

      // Multiple calls to the same function should return the same reference
      const getState1 = result.current.getPanelState;
      const getState2 = result.current.getPanelState;

      expect(getState1).toBe(getState2);
    });

    it('should handle many panels efficiently', () => {
      const initialStates: Record<string, PanelState> = {};

      // Create 100 panels
      for (let i = 0; i < 100; i++) {
        initialStates[`panel${i}`] = PanelState.Normal;
      }

      const { result } = renderHook(() =>
        useAgentTerminalPanelState({ initialPanelStates: initialStates })
      );

      // Should handle operations on many panels efficiently
      act(() => {
        result.current.maximize('panel50');
      });

      expect(result.current.getPanelState('panel50')).toBe(PanelState.Maximized);

      // Verify all other panels are normal
      for (let i = 0; i < 100; i++) {
        if (i !== 50) {
          expect(result.current.getPanelState(`panel${i}`)).toBe(PanelState.Normal);
        }
      }
    });
  });

  describe('focus navigation', () => {
    describe('basic focus functionality', () => {
      it('should initialize with no focused panel by default', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState({
          panelIds: ['panel1', 'panel2', 'panel3']
        }));

        expect(result.current.focusedPanelId).toBe(null);
        expect(result.current.focusedIndex).toBe(-1);
      });

      it('should initialize with specified focused panel', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState({
          panelIds: ['panel1', 'panel2', 'panel3'],
          initialFocusedPanelId: 'panel2'
        }));

        expect(result.current.focusedPanelId).toBe('panel2');
        expect(result.current.focusedIndex).toBe(1);
      });

      it('should focus specific panel by ID', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState({
          panelIds: ['panel1', 'panel2', 'panel3']
        }));

        act(() => {
          result.current.focusPanel('panel2');
        });

        expect(result.current.focusedPanelId).toBe('panel2');
        expect(result.current.focusedIndex).toBe(1);
        expect(result.current.isPanelFocused('panel2')).toBe(true);
        expect(result.current.isPanelFocused('panel1')).toBe(false);
      });

      it('should clear focus', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState({
          panelIds: ['panel1', 'panel2', 'panel3'],
          initialFocusedPanelId: 'panel1'
        }));

        expect(result.current.focusedPanelId).toBe('panel1');

        act(() => {
          result.current.clearFocus();
        });

        expect(result.current.focusedPanelId).toBe(null);
        expect(result.current.focusedIndex).toBe(-1);
      });
    });

    describe('focus navigation', () => {
      it('should move focus to next panel', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState({
          panelIds: ['panel1', 'panel2', 'panel3'],
          initialFocusedPanelId: 'panel1'
        }));

        expect(result.current.focusedPanelId).toBe('panel1');

        act(() => {
          result.current.focusNext();
        });

        expect(result.current.focusedPanelId).toBe('panel2');
        expect(result.current.focusedIndex).toBe(1);
      });

      it('should move focus to previous panel', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState({
          panelIds: ['panel1', 'panel2', 'panel3'],
          initialFocusedPanelId: 'panel2'
        }));

        expect(result.current.focusedPanelId).toBe('panel2');

        act(() => {
          result.current.focusPrevious();
        });

        expect(result.current.focusedPanelId).toBe('panel1');
        expect(result.current.focusedIndex).toBe(0);
      });

      it('should wrap focus from last to first panel with focusNext', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState({
          panelIds: ['panel1', 'panel2', 'panel3'],
          initialFocusedPanelId: 'panel3'
        }));

        expect(result.current.focusedPanelId).toBe('panel3');

        act(() => {
          result.current.focusNext();
        });

        expect(result.current.focusedPanelId).toBe('panel1');
        expect(result.current.focusedIndex).toBe(0);
      });

      it('should wrap focus from first to last panel with focusPrevious', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState({
          panelIds: ['panel1', 'panel2', 'panel3'],
          initialFocusedPanelId: 'panel1'
        }));

        expect(result.current.focusedPanelId).toBe('panel1');

        act(() => {
          result.current.focusPrevious();
        });

        expect(result.current.focusedPanelId).toBe('panel3');
        expect(result.current.focusedIndex).toBe(2);
      });

      it('should start at first panel when focusing next from no focus', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState({
          panelIds: ['panel1', 'panel2', 'panel3']
        }));

        expect(result.current.focusedPanelId).toBe(null);

        act(() => {
          result.current.focusNext();
        });

        expect(result.current.focusedPanelId).toBe('panel1');
        expect(result.current.focusedIndex).toBe(0);
      });

      it('should start at last panel when focusing previous from no focus', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState({
          panelIds: ['panel1', 'panel2', 'panel3']
        }));

        expect(result.current.focusedPanelId).toBe(null);

        act(() => {
          result.current.focusPrevious();
        });

        expect(result.current.focusedPanelId).toBe('panel3');
        expect(result.current.focusedIndex).toBe(2);
      });
    });

    describe('focus callbacks', () => {
      it('should call onFocusChange when focus changes', () => {
        const onFocusChange = vi.fn();
        const { result } = renderHook(() => useAgentTerminalPanelState({
          panelIds: ['panel1', 'panel2'],
          onFocusChange
        }));

        act(() => {
          result.current.focusPanel('panel1');
        });

        expect(onFocusChange).toHaveBeenCalledWith('panel1', null);

        act(() => {
          result.current.focusPanel('panel2');
        });

        expect(onFocusChange).toHaveBeenCalledWith('panel2', 'panel1');
      });

      it('should not call onFocusChange when focusing already focused panel', () => {
        const onFocusChange = vi.fn();
        const { result } = renderHook(() => useAgentTerminalPanelState({
          panelIds: ['panel1', 'panel2'],
          initialFocusedPanelId: 'panel1',
          onFocusChange
        }));

        onFocusChange.mockClear(); // Clear initial call

        act(() => {
          result.current.focusPanel('panel1');
        });

        expect(onFocusChange).not.toHaveBeenCalled();
      });
    });

    describe('edge cases', () => {
      it('should handle empty panel list', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState({
          panelIds: []
        }));

        expect(result.current.focusedPanelId).toBe(null);
        expect(result.current.focusedIndex).toBe(-1);

        act(() => {
          result.current.focusNext();
        });

        expect(result.current.focusedPanelId).toBe(null);

        act(() => {
          result.current.focusPrevious();
        });

        expect(result.current.focusedPanelId).toBe(null);
      });

      it('should handle single panel', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState({
          panelIds: ['panel1'],
          initialFocusedPanelId: 'panel1'
        }));

        expect(result.current.focusedPanelId).toBe('panel1');

        act(() => {
          result.current.focusNext();
        });

        expect(result.current.focusedPanelId).toBe('panel1');

        act(() => {
          result.current.focusPrevious();
        });

        expect(result.current.focusedPanelId).toBe('panel1');
      });

      it('should ignore focusing non-existent panel', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState({
          panelIds: ['panel1', 'panel2']
        }));

        act(() => {
          result.current.focusPanel('nonexistent');
        });

        expect(result.current.focusedPanelId).toBe(null);
      });

      it('should clear focus if focused panel removed from list', () => {
        let panelIds = ['panel1', 'panel2', 'panel3'];
        const { result, rerender } = renderHook(
          ({ ids }) => useAgentTerminalPanelState({ panelIds: ids }),
          { initialProps: { ids: panelIds } }
        );

        act(() => {
          result.current.focusPanel('panel2');
        });

        expect(result.current.focusedPanelId).toBe('panel2');

        // Remove focused panel from list
        panelIds = ['panel1', 'panel3'];
        rerender({ ids: panelIds });

        expect(result.current.focusedPanelId).toBe(null);
        expect(result.current.focusedIndex).toBe(-1);
      });
    });

    describe('integration with panel states', () => {
      it('should maintain focus when panel states change', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState({
          panelIds: ['panel1', 'panel2', 'panel3'],
          initialFocusedPanelId: 'panel2'
        }));

        expect(result.current.focusedPanelId).toBe('panel2');

        // Change panel state
        act(() => {
          result.current.minimize('panel2');
        });

        // Focus should remain on panel2
        expect(result.current.focusedPanelId).toBe('panel2');
        expect(result.current.getPanelState('panel2')).toBe(PanelState.Minimized);
      });

      it('should work correctly with maximize mutual exclusivity', () => {
        const { result } = renderHook(() => useAgentTerminalPanelState({
          panelIds: ['panel1', 'panel2', 'panel3'],
          initialFocusedPanelId: 'panel1'
        }));

        // Maximize focused panel
        act(() => {
          result.current.maximize('panel1');
        });

        expect(result.current.focusedPanelId).toBe('panel1');
        expect(result.current.getPanelState('panel1')).toBe(PanelState.Maximized);

        // Move focus and maximize another panel
        act(() => {
          result.current.focusNext();
          result.current.maximize('panel2');
        });

        expect(result.current.focusedPanelId).toBe('panel2');
        expect(result.current.getPanelState('panel1')).toBe(PanelState.Normal); // Should be restored
        expect(result.current.getPanelState('panel2')).toBe(PanelState.Maximized);
      });
    });
  });

  describe('additional acceptance criteria validation', () => {
    it('should export all required functions from the hook interface', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState());

      // Verify all required functions are available
      expect(typeof result.current.minimize).toBe('function');
      expect(typeof result.current.maximize).toBe('function');
      expect(typeof result.current.restore).toBe('function');
      expect(typeof result.current.restoreAll).toBe('function');
      expect(typeof result.current.getPanelState).toBe('function');

      // Verify additional utility function
      expect(typeof result.current.getAllPanelStates).toBe('function');
    });

    it('should maintain type safety with PanelState enum', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState());

      // Verify enum values are correctly used
      expect(result.current.getPanelState('test')).toBe(PanelState.Normal);

      act(() => {
        result.current.minimize('test');
      });
      expect(result.current.getPanelState('test')).toBe(PanelState.Minimized);

      act(() => {
        result.current.maximize('test');
      });
      expect(result.current.getPanelState('test')).toBe(PanelState.Maximized);
    });

    it('should handle concurrent state changes correctly', () => {
      const { result } = renderHook(() => useAgentTerminalPanelState());

      // Simulate concurrent operations that might happen in real usage
      act(() => {
        result.current.maximize('panel1');
        result.current.minimize('panel2');
        result.current.maximize('panel3'); // Should override panel1
        result.current.restore('panel2');  // Should set panel2 to normal
      });

      expect(result.current.getPanelState('panel1')).toBe(PanelState.Normal);
      expect(result.current.getPanelState('panel2')).toBe(PanelState.Normal);
      expect(result.current.getPanelState('panel3')).toBe(PanelState.Maximized);

      // Verify only one panel is maximized
      const allStates = result.current.getAllPanelStates();
      const maximizedCount = Object.values(allStates).filter(state => state === PanelState.Maximized).length;
      expect(maximizedCount).toBe(1);
    });

    it('should handle state persistence correctly in controlled mode', () => {
      const onPanelStateChange = vi.fn();
      let controlledStates = {
        panel1: PanelState.Normal,
        panel2: PanelState.Minimized,
      };

      const { result, rerender } = renderHook(
        ({ states }) => useAgentTerminalPanelState({
          panelStates: states,
          onPanelStateChange
        }),
        { initialProps: { states: controlledStates } }
      );

      // Initial state should match controlled states
      expect(result.current.getPanelState('panel1')).toBe(PanelState.Normal);
      expect(result.current.getPanelState('panel2')).toBe(PanelState.Minimized);

      // Make a change
      act(() => {
        result.current.maximize('panel1');
      });

      // Should call the callback
      expect(onPanelStateChange).toHaveBeenCalledWith('panel1', PanelState.Maximized);

      // Update external state to simulate parent component updating
      controlledStates = {
        panel1: PanelState.Maximized,
        panel2: PanelState.Normal, // Parent also updated panel2
      };
      rerender({ states: controlledStates });

      // Hook should reflect the updated controlled state
      expect(result.current.getPanelState('panel1')).toBe(PanelState.Maximized);
      expect(result.current.getPanelState('panel2')).toBe(PanelState.Normal);
    });
  });
});