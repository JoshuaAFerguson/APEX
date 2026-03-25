/**
 * Unit tests for PanelStateStatus utility functions
 *
 * Tests the utility functions that handle panel state status text generation
 * and visibility logic without requiring React component rendering.
 */

import { describe, it, expect } from 'vitest';
import {
  PanelState,
  getPanelStateStatusText,
  shouldShowStatusText
} from '../AgentTerminalPanel.types.js';
import type { TerminalPanelDisplayMode } from '../AgentTerminalPanel.types.js';

describe('PanelStateStatus Utility Functions', () => {
  describe('getPanelStateStatusText', () => {
    it('returns correct status text for each panel state', () => {
      const testCases = [
        { panelState: PanelState.Normal, expected: '[normal]' },
        { panelState: PanelState.Minimized, expected: '[minimized]' },
        { panelState: PanelState.Maximized, expected: '[maximized]' },
      ];

      testCases.forEach(({ panelState, expected }) => {
        const result = getPanelStateStatusText(panelState);
        expect(result).toBe(expected);
      });
    });

    it('returns default [normal] for invalid states', () => {
      // Test with an invalid state (casting to bypass TypeScript)
      const result = getPanelStateStatusText('invalid' as PanelState);
      expect(result).toBe('[normal]');
    });
  });

  describe('shouldShowStatusText', () => {
    describe('Verbose mode behavior', () => {
      it('always shows status text in verbose mode regardless of focus', () => {
        const testCases = [
          { focused: true, panelState: PanelState.Normal },
          { focused: false, panelState: PanelState.Normal },
          { focused: true, panelState: PanelState.Minimized },
          { focused: false, panelState: PanelState.Minimized },
          { focused: true, panelState: PanelState.Maximized },
          { focused: false, panelState: PanelState.Maximized },
        ];

        testCases.forEach(({ focused, panelState }) => {
          const result = shouldShowStatusText({
            displayMode: 'verbose',
            focused,
            panelState,
          });
          expect(result).toBe(true);
        });
      });
    });

    describe('Focused state behavior', () => {
      it('shows status text when focused regardless of display mode', () => {
        const displayModes: TerminalPanelDisplayMode[] = ['normal', 'compact', 'verbose'];
        const panelStates = [PanelState.Normal, PanelState.Minimized, PanelState.Maximized];

        displayModes.forEach((displayMode) => {
          panelStates.forEach((panelState) => {
            const result = shouldShowStatusText({
              displayMode,
              focused: true,
              panelState,
            });
            expect(result).toBe(true);
          });
        });
      });
    });

    describe('Normal mode behavior', () => {
      it('shows status text for non-normal states when not focused', () => {
        const nonNormalStates = [PanelState.Minimized, PanelState.Maximized];

        nonNormalStates.forEach((panelState) => {
          const result = shouldShowStatusText({
            displayMode: 'normal',
            focused: false,
            panelState,
          });
          expect(result).toBe(true);
        });
      });

      it('hides status text for normal state when not focused', () => {
        const result = shouldShowStatusText({
          displayMode: 'normal',
          focused: false,
          panelState: PanelState.Normal,
        });
        expect(result).toBe(false);
      });
    });

    describe('Compact mode behavior', () => {
      it('hides status text when not focused', () => {
        const panelStates = [PanelState.Normal, PanelState.Minimized, PanelState.Maximized];

        panelStates.forEach((panelState) => {
          const result = shouldShowStatusText({
            displayMode: 'compact',
            focused: false,
            panelState,
          });
          expect(result).toBe(false);
        });
      });

      it('shows status text when focused', () => {
        const panelStates = [PanelState.Normal, PanelState.Minimized, PanelState.Maximized];

        panelStates.forEach((panelState) => {
          const result = shouldShowStatusText({
            displayMode: 'compact',
            focused: true,
            panelState,
          });
          expect(result).toBe(true);
        });
      });
    });

    describe('Undefined panelState handling', () => {
      it('handles undefined panelState correctly', () => {
        const testCases = [
          { displayMode: 'verbose' as const, focused: false, expected: true },
          { displayMode: 'normal' as const, focused: false, expected: false },
          { displayMode: 'compact' as const, focused: false, expected: false },
          { displayMode: 'verbose' as const, focused: true, expected: true },
          { displayMode: 'normal' as const, focused: true, expected: true },
          { displayMode: 'compact' as const, focused: true, expected: true },
        ];

        testCases.forEach(({ displayMode, focused, expected }) => {
          const result = shouldShowStatusText({
            displayMode,
            focused,
            panelState: undefined,
          });
          expect(result).toBe(expected);
        });
      });
    });
  });

  describe('Integration tests', () => {
    it('correctly handles all possible visibility combinations', () => {
      const displayModes: TerminalPanelDisplayMode[] = ['normal', 'compact', 'verbose'];
      const panelStates = [PanelState.Normal, PanelState.Minimized, PanelState.Maximized];
      const focusStates = [true, false];

      const expectedResults: Record<string, boolean> = {
        // Verbose mode - always shows
        'verbose-true-normal': true,
        'verbose-false-normal': true,
        'verbose-true-minimized': true,
        'verbose-false-minimized': true,
        'verbose-true-maximized': true,
        'verbose-false-maximized': true,

        // Normal mode - shows when focused OR when state is not normal (if not focused)
        'normal-true-normal': true,
        'normal-false-normal': false,
        'normal-true-minimized': true,
        'normal-false-minimized': true,
        'normal-true-maximized': true,
        'normal-false-maximized': true,

        // Compact mode - only shows when focused
        'compact-true-normal': true,
        'compact-false-normal': false,
        'compact-true-minimized': true,
        'compact-false-minimized': false,
        'compact-true-maximized': true,
        'compact-false-maximized': false,
      };

      displayModes.forEach((displayMode) => {
        focusStates.forEach((focused) => {
          panelStates.forEach((panelState) => {
            const key = `${displayMode}-${focused}-${panelState.toLowerCase()}`;
            const expected = expectedResults[key];

            const result = shouldShowStatusText({
              displayMode,
              focused,
              panelState,
            });

            expect(result).toBe(expected);
          });
        });
      });
    });

    it('verifies status text format consistency', () => {
      // Ensure all panel states produce valid bracketed text
      Object.values(PanelState).forEach((state) => {
        const statusText = getPanelStateStatusText(state);

        // Should start with [ and end with ]
        expect(statusText).toMatch(/^\[.*\]$/);

        // Should contain the state name (lowercase)
        expect(statusText).toContain(state.toLowerCase());

        // Should be exactly the expected format
        expect(statusText).toBe(`[${state.toLowerCase()}]`);
      });
    });
  });
});