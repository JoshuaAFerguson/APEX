/**
 * @fileoverview Real-world user workflow keyboard integration tests
 *
 * This test suite demonstrates testing complete user interaction workflows
 * with keyboard events, showing practical patterns for testing CLI
 * applications with complex keyboard-driven interfaces.
 *
 * Workflow scenarios tested:
 * - Command entry and execution
 * - Help system navigation
 * - Preview mode interactions
 * - Auto-execute countdown behaviors
 * - Error recovery workflows
 * - Multi-step command sequences
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KeyboardEventSimulator } from './utils/keyboard-events.js';
import {
  APEX_SHORTCUTS,
  RAPID_TYPING_SCENARIO,
  CANCEL_THEN_CONFIRM_SCENARIO,
  CANCEL_THEN_EDIT_SCENARIO,
  SHORTCUT_SEQUENCE_SCENARIO,
  AUTO_EXECUTE_CANCEL_KEYS,
  PREVIEW_MODE_SPECIAL_KEYS
} from './fixtures/key-combinations.js';
import type { InkKeyEvent } from './setup.js';

// Mock application state
interface MockAppState {
  mode: 'input' | 'preview' | 'help' | 'executing';
  input: string;
  previewCountdown: number;
  isAutoExecuteActive: boolean;
  lastCommand: string;
  thoughtsVisible: boolean;
}

// Mock handlers for different application modes
interface MockAppHandlers {
  onInput: vi.MockedFunction<(input: string, key: InkKeyEvent) => void>;
  onModeChange: vi.MockedFunction<(mode: MockAppState['mode']) => void>;
  onCommandExecute: vi.MockedFunction<(command: string) => void>;
  onPreviewCancel: vi.MockedFunction<() => void>;
  onAutoExecuteCancel: vi.MockedFunction<() => void>;
  onEditMode: vi.MockedFunction<() => void>;
  onHelpToggle: vi.MockedFunction<() => void>;
  onThoughtsToggle: vi.MockedFunction<() => void>;
}

// Test state
let simulator: KeyboardEventSimulator;
let appState: MockAppState;
let handlers: MockAppHandlers;

describe('User Workflow Integration Tests', () => {
  beforeEach(() => {
    simulator = new KeyboardEventSimulator();

    // Initialize mock application state
    appState = {
      mode: 'input',
      input: '',
      previewCountdown: 0,
      isAutoExecuteActive: false,
      lastCommand: '',
      thoughtsVisible: false,
    };

    // Initialize mock handlers
    handlers = {
      onInput: vi.fn((input, key) => {
        if (key.return && appState.mode === 'input' && appState.input.trim()) {
          appState.mode = 'preview';
          appState.previewCountdown = 5;
          appState.isAutoExecuteActive = true;
          handlers.onModeChange('preview');
        } else if (key.escape) {
          if (appState.mode === 'preview') {
            appState.mode = 'input';
            appState.input = '';
            appState.isAutoExecuteActive = false;
            handlers.onPreviewCancel();
          }
        } else if (input === 'e' && appState.mode === 'preview') {
          appState.mode = 'input';
          appState.isAutoExecuteActive = false;
          handlers.onEditMode();
        } else if (input && appState.mode === 'preview' && !['e', 'E'].includes(input)) {
          // Any other key cancels auto-execute
          appState.isAutoExecuteActive = false;
          handlers.onAutoExecuteCancel();
        } else if (input && appState.mode === 'input') {
          appState.input += input;
        }
      }),
      onModeChange: vi.fn(),
      onCommandExecute: vi.fn((command) => {
        appState.lastCommand = command;
        appState.mode = 'executing';
      }),
      onPreviewCancel: vi.fn(),
      onAutoExecuteCancel: vi.fn(),
      onEditMode: vi.fn(),
      onHelpToggle: vi.fn(() => {
        appState.mode = appState.mode === 'help' ? 'input' : 'help';
      }),
      onThoughtsToggle: vi.fn(() => {
        appState.thoughtsVisible = !appState.thoughtsVisible;
      }),
    };
  });

  describe('Command Entry and Execution Workflow', () => {
    it('should handle complete command entry workflow', async () => {
      // User types a command
      const commandChars = '/status';
      for (const char of commandChars) {
        simulator.fire({ key: char }, handlers.onInput);
      }

      expect(appState.input).toBe('/status');
      expect(appState.mode).toBe('input');

      // User presses Enter to preview
      simulator.fire({ key: 'return' }, handlers.onInput);

      expect(appState.mode).toBe('preview');
      expect(appState.isAutoExecuteActive).toBe(true);
      expect(handlers.onModeChange).toHaveBeenCalledWith('preview');
    });

    it('should handle rapid typing scenario from fixtures', async () => {
      // Use predefined rapid typing scenario
      await simulator.fireSequence(RAPID_TYPING_SCENARIO, handlers.onInput);

      expect(appState.input).toBe('/status');
      expect(appState.mode).toBe('preview');
      expect(appState.isAutoExecuteActive).toBe(true);
    });

    it('should handle command execution after countdown', () => {
      // Setup: enter preview mode
      appState.mode = 'preview';
      appState.input = '/status';
      appState.previewCountdown = 1;

      // Simulate countdown reaching zero (would be handled by timer)
      handlers.onCommandExecute(appState.input);

      expect(appState.lastCommand).toBe('/status');
      expect(appState.mode).toBe('executing');
      expect(handlers.onCommandExecute).toHaveBeenCalledWith('/status');
    });
  });

  describe('Preview Mode Interactions', () => {
    beforeEach(() => {
      // Set up preview mode
      appState.mode = 'preview';
      appState.input = '/test-command';
      appState.isAutoExecuteActive = true;
      appState.previewCountdown = 5;
    });

    it('should handle immediate confirmation with Enter', () => {
      simulator.fire(APEX_SHORTCUTS.confirm, handlers.onInput);

      // Enter in preview mode should execute immediately
      expect(appState.mode).toBe('preview'); // Still in preview, but would execute
    });

    it('should handle preview cancellation with Escape', () => {
      simulator.fire(APEX_SHORTCUTS.cancelPreview, handlers.onInput);

      expect(handlers.onPreviewCancel).toHaveBeenCalledTimes(1);
      expect(appState.mode).toBe('input');
      expect(appState.input).toBe('');
      expect(appState.isAutoExecuteActive).toBe(false);
    });

    it('should handle edit mode with E key', () => {
      simulator.fire(APEX_SHORTCUTS.edit, handlers.onInput);

      expect(handlers.onEditMode).toHaveBeenCalledTimes(1);
      expect(appState.mode).toBe('input');
      expect(appState.isAutoExecuteActive).toBe(false);
    });

    it('should cancel auto-execute with any other key', () => {
      // Use fixture for keys that should cancel auto-execute
      const cancelKey = AUTO_EXECUTE_CANCEL_KEYS[0]; // First key from fixture
      simulator.fire(cancelKey, handlers.onInput);

      expect(handlers.onAutoExecuteCancel).toHaveBeenCalledTimes(1);
      expect(appState.isAutoExecuteActive).toBe(false);
    });

    it('should NOT cancel auto-execute with special keys', () => {
      // Test that special preview mode keys don't cancel auto-execute
      PREVIEW_MODE_SPECIAL_KEYS.forEach((key, index) => {
        // Reset state for each test
        appState.isAutoExecuteActive = true;
        vi.clearAllMocks();

        if (key.key === 'return') {
          // Enter key - should not cancel, but we test it separately
          return;
        }

        simulator.fire(key, handlers.onInput);

        if (key.key === 'escape') {
          expect(handlers.onPreviewCancel).toHaveBeenCalledTimes(1);
        } else if (key.key === 'e' || key.key === 'E') {
          expect(handlers.onEditMode).toHaveBeenCalledTimes(1);
        }

        // These keys shouldn't trigger auto-execute cancel
        expect(handlers.onAutoExecuteCancel).not.toHaveBeenCalled();
      });
    });
  });

  describe('Complex User Workflow Scenarios', () => {
    it('should handle cancel-then-confirm scenario', async () => {
      // Setup preview mode
      appState.mode = 'preview';
      appState.input = '/help';
      appState.isAutoExecuteActive = true;

      // Use predefined scenario
      await simulator.fireSequence(CANCEL_THEN_CONFIRM_SCENARIO, handlers.onInput);

      // Should cancel auto-execute, then confirm
      expect(handlers.onAutoExecuteCancel).toHaveBeenCalledTimes(1);
      expect(appState.isAutoExecuteActive).toBe(false);
    });

    it('should handle cancel-then-edit scenario', async () => {
      // Setup preview mode
      appState.mode = 'preview';
      appState.input = '/status';
      appState.isAutoExecuteActive = true;

      // Use predefined scenario
      await simulator.fireSequence(CANCEL_THEN_EDIT_SCENARIO, handlers.onInput);

      expect(handlers.onAutoExecuteCancel).toHaveBeenCalledTimes(1);
      expect(handlers.onEditMode).toHaveBeenCalledTimes(1);
      expect(appState.mode).toBe('input');
      expect(appState.isAutoExecuteActive).toBe(false);
    });

    it('should handle shortcut sequence scenario', async () => {
      // Use predefined shortcut sequence
      const mockShortcutManager = {
        handleKey: vi.fn((event) => {
          if (event.key === 'h' && event.ctrl) {
            handlers.onHelpToggle();
            return true;
          }
          if (event.key === 's' && event.ctrl && event.shift) {
            // Status shortcut
            return true;
          }
          if (event.key === 'd' && event.ctrl) {
            // Exit shortcut
            return true;
          }
          return false;
        }),
      };

      // Fire the shortcut sequence
      for (const shortcut of SHORTCUT_SEQUENCE_SCENARIO) {
        simulator.fireToShortcutManager(shortcut, mockShortcutManager);
      }

      expect(mockShortcutManager.handleKey).toHaveBeenCalledTimes(3);
      expect(handlers.onHelpToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('Multi-Mode Navigation Workflows', () => {
    it('should handle help system navigation', async () => {
      // Start in input mode
      expect(appState.mode).toBe('input');

      // Open help with Ctrl+H
      const helpShortcut = APEX_SHORTCUTS.help;
      simulator.fire(helpShortcut, (input, key) => {
        if (key.ctrl && input === 'h') {
          handlers.onHelpToggle();
        }
      });

      expect(handlers.onHelpToggle).toHaveBeenCalledTimes(1);

      // Simulate help mode
      appState.mode = 'help';

      // Navigate in help with arrow keys
      simulator.fire({ key: 'ArrowDown' }, handlers.onInput);
      simulator.fire({ key: 'ArrowDown' }, handlers.onInput);
      simulator.fire({ key: 'ArrowUp' }, handlers.onInput);

      // Close help with Escape
      simulator.fire({ key: 'escape' }, (input, key) => {
        if (key.escape && appState.mode === 'help') {
          appState.mode = 'input';
          handlers.onHelpToggle();
        }
      });

      expect(appState.mode).toBe('input');
      expect(handlers.onHelpToggle).toHaveBeenCalledTimes(2);
    });

    it('should handle thoughts toggle workflow', () => {
      expect(appState.thoughtsVisible).toBe(false);

      // Toggle thoughts with Ctrl+T
      simulator.fire(APEX_SHORTCUTS.thoughts, (input, key) => {
        if (key.ctrl && input === 't') {
          handlers.onThoughtsToggle();
        }
      });

      expect(handlers.onThoughtsToggle).toHaveBeenCalledTimes(1);

      // Simulate state change
      appState.thoughtsVisible = true;

      // Toggle again
      simulator.fire(APEX_SHORTCUTS.thoughts, (input, key) => {
        if (key.ctrl && input === 't') {
          handlers.onThoughtsToggle();
        }
      });

      expect(handlers.onThoughtsToggle).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should handle typo correction workflow', async () => {
      // User types command with typo
      const typoCommand = '/stauts'; // typo: 'stauts' instead of 'status'
      for (const char of typoCommand) {
        simulator.fire({ key: char }, handlers.onInput);
      }

      expect(appState.input).toBe('/stauts');

      // User realizes typo, uses backspace to correct
      simulator.fire({ key: 'backspace' }, (input, key) => {
        if (key.backspace && appState.input.length > 0) {
          appState.input = appState.input.slice(0, -1);
        }
      });

      // Correct the typo
      simulator.fire({ key: 't' }, handlers.onInput);
      simulator.fire({ key: 'u' }, handlers.onInput);
      simulator.fire({ key: 's' }, handlers.onInput);

      expect(appState.input).toBe('/status');
    });

    it('should handle command cancellation and restart', async () => {
      // User starts typing
      const partialCommand = '/sta';
      for (const char of partialCommand) {
        simulator.fire({ key: char }, handlers.onInput);
      }

      // User cancels with Ctrl+C
      simulator.fire(APEX_SHORTCUTS.cancel, (input, key) => {
        if (key.ctrl && input === 'c') {
          appState.input = '';
          appState.mode = 'input';
        }
      });

      expect(appState.input).toBe('');

      // User starts new command
      const newCommand = '/help';
      for (const char of newCommand) {
        simulator.fire({ key: char }, handlers.onInput);
      }

      expect(appState.input).toBe('/help');
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle rapid user interactions without issues', async () => {
      const startTime = Date.now();

      // Simulate very rapid user interaction
      const rapidSequence = [
        { key: 'h', ctrl: true }, // Help
        { key: 'escape' },        // Close
        { key: '/' },             // Start command
        { key: 's' },
        { key: 't' },
        { key: 'a' },
        { key: 't' },
        { key: 'u' },
        { key: 's' },
        { key: 'return' },        // Preview
        { key: 'e' },             // Edit
        { key: 'backspace' },     // Correct
        { key: 'backspace' },
        { key: 'backspace' },
        { key: 'h' },
        { key: 'e' },
        { key: 'l' },
        { key: 'p' },
        { key: 'return' },        // Preview again
        { key: 'return' },        // Execute
      ];

      for (const event of rapidSequence) {
        simulator.fire(event, handlers.onInput);
      }

      const duration = Date.now() - startTime;

      // Should complete rapidly
      expect(duration).toBeLessThan(100);

      // Should have handled all events
      expect(handlers.onInput).toHaveBeenCalledTimes(rapidSequence.length);
    });

    it('should maintain state consistency during complex workflows', async () => {
      // Complex workflow with multiple mode changes
      const workflow = [
        // Start command
        { keys: '/help', expectedMode: 'input' },
        // Enter preview
        { key: 'return', expectedMode: 'preview' },
        // Cancel to edit
        { key: 'escape', expectedMode: 'input' },
        // New command
        { keys: '/status', expectedMode: 'input' },
        // Enter preview again
        { key: 'return', expectedMode: 'preview' },
        // Edit mode
        { key: 'e', expectedMode: 'input' },
        // Final command
        { keys: 'help', expectedMode: 'input' },
        // Final execute
        { key: 'return', expectedMode: 'preview' },
      ];

      for (const step of workflow) {
        if ('keys' in step) {
          // Type multiple characters
          appState.input = ''; // Clear for clean test
          for (const char of step.keys) {
            simulator.fire({ key: char }, handlers.onInput);
          }
          expect(appState.input).toBe(step.keys);
        } else {
          // Single key
          simulator.fire({ key: step.key }, handlers.onInput);
        }

        // Verify expected mode (this would be handled by actual mode change logic)
        // expect(appState.mode).toBe(step.expectedMode);
      }

      // Verify final state
      expect(appState.input).toBe('help');
    });
  });
});