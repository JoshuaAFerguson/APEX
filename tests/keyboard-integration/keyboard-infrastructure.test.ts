/**
 * @fileoverview Integration test to verify keyboard testing infrastructure
 *
 * This test demonstrates and validates the keyboard event simulation
 * infrastructure for APEX. It serves as both a verification test
 * and a reference example for writing keyboard integration tests.
 *
 * Test Features:
 * - Basic key event simulation
 * - Modifier key combinations
 * - Ink component integration
 * - ShortcutManager integration
 * - Key sequence simulation
 * - Event validation and assertions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KeyboardEventSimulator, COMMON_SHORTCUTS } from './utils/keyboard-events.js';
import { APEX_SHORTCUTS, LETTER_KEYS, ACTION_KEYS } from './fixtures/key-combinations.js';
import type { InkKeyEvent } from './setup.js';

// Mock a simplified version of Ink useInput handler
type InputHandler = (input: string | undefined, key: InkKeyEvent) => void;

// Mock a simplified ShortcutManager interface
interface MockShortcutManager {
  handleKey: (event: { key: string; ctrl: boolean; alt: boolean; shift: boolean; meta: boolean }) => boolean;
  shortcuts: Map<string, () => void>;
}

// Test doubles
let mockInputHandler: vi.MockedFunction<InputHandler>;
let mockShortcutManager: MockShortcutManager;
let simulator: KeyboardEventSimulator;

describe('Keyboard Integration Test Infrastructure', () => {
  beforeEach(() => {
    // Reset simulator for each test
    simulator = new KeyboardEventSimulator();

    // Mock input handler that tracks calls
    mockInputHandler = vi.fn();

    // Mock ShortcutManager with basic functionality
    mockShortcutManager = {
      shortcuts: new Map(),
      handleKey: vi.fn((event) => {
        const shortcutKey = `${event.ctrl ? 'ctrl+' : ''}${event.alt ? 'alt+' : ''}${event.shift ? 'shift+' : ''}${event.meta ? 'meta+' : ''}${event.key}`;
        const handler = mockShortcutManager.shortcuts.get(shortcutKey);
        if (handler) {
          handler();
          return true;
        }
        return false;
      }),
    };

    // Register some common shortcuts for testing
    mockShortcutManager.shortcuts.set('ctrl+c', vi.fn()); // cancel
    mockShortcutManager.shortcuts.set('ctrl+h', vi.fn()); // help
    mockShortcutManager.shortcuts.set('ctrl+l', vi.fn()); // clear
  });

  describe('Basic Key Event Simulation', () => {
    it('should simulate single character key events', () => {
      simulator.fire({ key: 'a' }, mockInputHandler);

      expect(mockInputHandler).toHaveBeenCalledTimes(1);
      expect(mockInputHandler).toHaveBeenCalledWith('a', expect.objectContaining({
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
      }));
    });

    it('should simulate special keys correctly', () => {
      simulator.fire({ key: 'return' }, mockInputHandler);

      expect(mockInputHandler).toHaveBeenCalledWith('', expect.objectContaining({
        return: true,
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
      }));
    });

    it('should simulate escape key correctly', () => {
      simulator.fire({ key: 'escape' }, mockInputHandler);

      expect(mockInputHandler).toHaveBeenCalledWith('', expect.objectContaining({
        escape: true,
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
      }));
    });

    it('should simulate arrow keys correctly', () => {
      simulator.fire({ key: 'ArrowUp' }, mockInputHandler);

      expect(mockInputHandler).toHaveBeenCalledWith('', expect.objectContaining({
        upArrow: true,
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
      }));
    });
  });

  describe('Modifier Key Combinations', () => {
    it('should handle Ctrl+key combinations', () => {
      simulator.fire({ key: 'c', ctrl: true }, mockInputHandler);

      expect(mockInputHandler).toHaveBeenCalledWith('c', expect.objectContaining({
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      }));
    });

    it('should handle multiple modifiers', () => {
      simulator.fire({ key: 's', ctrl: true, shift: true }, mockInputHandler);

      expect(mockInputHandler).toHaveBeenCalledWith('s', expect.objectContaining({
        ctrl: true,
        shift: true,
        alt: false,
        meta: false,
      }));
    });

    it('should handle all modifiers pressed', () => {
      simulator.fire({
        key: 'a',
        ctrl: true,
        alt: true,
        shift: true,
        meta: true
      }, mockInputHandler);

      expect(mockInputHandler).toHaveBeenCalledWith('a', expect.objectContaining({
        ctrl: true,
        alt: true,
        shift: true,
        meta: true,
      }));
    });
  });

  describe('ShortcutManager Integration', () => {
    it('should fire events to ShortcutManager', () => {
      const result = simulator.fireToShortcutManager(
        { key: 'c', ctrl: true },
        mockShortcutManager
      );

      expect(result).toBe(true);
      expect(mockShortcutManager.handleKey).toHaveBeenCalledWith({
        key: 'c',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      });
    });

    it('should return false for unregistered shortcuts', () => {
      const result = simulator.fireToShortcutManager(
        { key: 'x', ctrl: true },
        mockShortcutManager
      );

      expect(result).toBe(false);
    });

    it('should handle APEX-specific shortcuts', () => {
      // Test help shortcut
      const helpResult = simulator.fireToShortcutManager(
        APEX_SHORTCUTS.help,
        mockShortcutManager
      );
      expect(helpResult).toBe(true);

      // Test clear shortcut
      const clearResult = simulator.fireToShortcutManager(
        APEX_SHORTCUTS.clear,
        mockShortcutManager
      );
      expect(clearResult).toBe(true);
    });
  });

  describe('Key Sequence Simulation', () => {
    it('should fire sequences of key events', async () => {
      const sequence = [
        { key: 'h', ctrl: true },  // help
        { key: 'escape' },         // escape
        { key: 'return' },         // confirm
      ];

      await simulator.fireSequence(sequence, mockInputHandler);

      expect(mockInputHandler).toHaveBeenCalledTimes(3);

      // Verify the sequence order
      const calls = mockInputHandler.mock.calls;
      expect(calls[0]).toEqual(['h', expect.objectContaining({ ctrl: true })]);
      expect(calls[1]).toEqual(['', expect.objectContaining({ escape: true })]);
      expect(calls[2]).toEqual(['', expect.objectContaining({ return: true })]);
    });

    it('should handle rapid typing', () => {
      const text = 'hello';
      simulator.fireRapid(text, mockInputHandler);

      expect(mockInputHandler).toHaveBeenCalledTimes(5);

      // Check each character was fired
      const calls = mockInputHandler.mock.calls;
      expect(calls[0][0]).toBe('h');
      expect(calls[1][0]).toBe('e');
      expect(calls[2][0]).toBe('l');
      expect(calls[3][0]).toBe('l');
      expect(calls[4][0]).toBe('o');
    });
  });

  describe('Event Logging and Debugging', () => {
    it('should track fired events in log', () => {
      simulator.clearEventLog();

      simulator.fire({ key: 'a' }, mockInputHandler);
      simulator.fire({ key: 'b', ctrl: true }, mockInputHandler);

      const log = simulator.getEventLog();
      expect(log).toHaveLength(2);
      expect(log[0].event).toEqual({ key: 'a' });
      expect(log[1].event).toEqual({ key: 'b', ctrl: true });
    });

    it('should format key combinations for display', () => {
      expect(simulator.formatKeyCombination({ key: 'c', ctrl: true }))
        .toBe('Ctrl+C');

      expect(simulator.formatKeyCombination({ key: 's', ctrl: true, shift: true }))
        .toBe('Ctrl+Shift+S');

      expect(simulator.formatKeyCombination({ key: 'return' }))
        .toBe('Return');
    });
  });

  describe('Global Test Helpers', () => {
    it('should provide global keyboard test helpers', () => {
      // Access global helpers
      const { createKeyEvent, fireKeyEvent, getContext } = globalThis.keyboardTestHelpers;

      expect(createKeyEvent).toBeDefined();
      expect(fireKeyEvent).toBeDefined();
      expect(getContext).toBeDefined();
    });

    it('should create Ink events using global helpers', () => {
      const { createKeyEvent } = globalThis.keyboardTestHelpers;

      const event = createKeyEvent({ key: 'a', ctrl: true });

      expect(event).toEqual({
        input: 'a',
        key: expect.objectContaining({
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        })
      });
    });
  });

  describe('Test Fixture Validation', () => {
    it('should provide comprehensive letter key fixtures', () => {
      expect(LETTER_KEYS).toHaveLength(26);
      expect(LETTER_KEYS[0]).toEqual({ key: 'a' });
      expect(LETTER_KEYS[25]).toEqual({ key: 'z' });
    });

    it('should provide action key fixtures', () => {
      expect(ACTION_KEYS).toContain({ key: 'return' });
      expect(ACTION_KEYS).toContain({ key: 'escape' });
      expect(ACTION_KEYS).toContain({ key: 'tab' });
    });

    it('should provide APEX shortcut fixtures', () => {
      expect(APEX_SHORTCUTS.cancel).toEqual({ key: 'c', ctrl: true });
      expect(APEX_SHORTCUTS.help).toEqual({ key: 'h', ctrl: true });
      expect(APEX_SHORTCUTS.thoughts).toEqual({ key: 't', ctrl: true });
    });
  });

  describe('Key Normalization', () => {
    it('should normalize key aliases', () => {
      expect(simulator.normalizeKey('enter')).toBe('return');
      expect(simulator.normalizeKey('esc')).toBe('escape');
      expect(simulator.normalizeKey('space')).toBe(' ');
    });

    it('should preserve regular keys', () => {
      expect(simulator.normalizeKey('a')).toBe('a');
      expect(simulator.normalizeKey('F1')).toBe('F1');
      expect(simulator.normalizeKey('ArrowUp')).toBe('ArrowUp');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty key input gracefully', () => {
      expect(() => {
        simulator.fire({ key: '' }, mockInputHandler);
      }).not.toThrow();
    });

    it('should handle undefined input', () => {
      // Create event with undefined key (edge case)
      const event = simulator.createInkEvent({ key: 'undefined' });
      expect(event.input).toBe('undefined');
    });

    it('should handle special characters', () => {
      simulator.fire({ key: '@' }, mockInputHandler);
      expect(mockInputHandler).toHaveBeenCalledWith('@', expect.any(Object));
    });
  });
});

/**
 * Example of a complete integration test for a specific keyboard workflow
 */
describe('Complete Keyboard Workflow Example', () => {
  it('should simulate a complete user interaction workflow', async () => {
    const simulator = new KeyboardEventSimulator();
    const inputHandler = vi.fn();

    // Simulate user workflow:
    // 1. Press Ctrl+H for help
    // 2. Navigate with arrow keys
    // 3. Press Escape to close
    // 4. Type a command
    // 5. Press Enter to confirm

    const workflow = [
      { key: 'h', ctrl: true },      // Open help
      { key: 'ArrowDown' },          // Navigate down
      { key: 'ArrowDown' },          // Navigate down more
      { key: 'escape' },             // Close help
      { key: '/' },                  // Start typing command
      { key: 's' },
      { key: 't' },
      { key: 'a' },
      { key: 't' },
      { key: 'u' },
      { key: 's' },
      { key: 'return' },             // Execute command
    ];

    // Fire the complete workflow
    await simulator.fireSequence(workflow, inputHandler);

    // Verify the complete sequence was handled
    expect(inputHandler).toHaveBeenCalledTimes(workflow.length);

    // Verify specific key events
    const calls = inputHandler.mock.calls;
    expect(calls[0][1]).toMatchObject({ ctrl: true }); // Ctrl+H
    expect(calls[1][1]).toMatchObject({ downArrow: true }); // Arrow down
    expect(calls[3][1]).toMatchObject({ escape: true }); // Escape
    expect(calls[4][0]).toBe('/'); // Start of command
    expect(calls[calls.length - 1][1]).toMatchObject({ return: true }); // Enter
  });
});