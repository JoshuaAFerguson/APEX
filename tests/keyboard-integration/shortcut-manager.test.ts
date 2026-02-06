/**
 * @fileoverview ShortcutManager integration tests for APEX
 *
 * This test suite validates keyboard shortcut handling integration
 * with APEX's ShortcutManager. It demonstrates practical usage
 * patterns for testing keyboard-driven CLI interactions.
 *
 * Features tested:
 * - Basic shortcut registration and handling
 * - Modifier key combinations
 * - Shortcut precedence and conflicts
 * - Event propagation and prevention
 * - Integration with Ink components
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KeyboardEventSimulator } from './utils/keyboard-events.js';
import { APEX_SHORTCUTS, CTRL_LETTER_COMBINATIONS } from './fixtures/key-combinations.js';
import type { InkKeyEvent } from './setup.js';

// Mock ShortcutManager interface based on APEX's actual implementation
interface MockShortcutManager {
  shortcuts: Map<string, { handler: () => void; description: string }>;
  handleKey: (event: { key: string; ctrl: boolean; alt: boolean; shift: boolean; meta: boolean }) => boolean;
  register: (combination: string, handler: () => void, description?: string) => void;
  unregister: (combination: string) => void;
  isRegistered: (combination: string) => boolean;
  getDescription: (combination: string) => string | undefined;
}

// Test state
let simulator: KeyboardEventSimulator;
let shortcutManager: MockShortcutManager;
let mockHandlers: Record<string, vi.MockedFunction<() => void>>;

describe('ShortcutManager Integration Tests', () => {
  beforeEach(() => {
    simulator = new KeyboardEventSimulator();
    mockHandlers = {
      cancel: vi.fn(),
      help: vi.fn(),
      clear: vi.fn(),
      status: vi.fn(),
      thoughts: vi.fn(),
      agents: vi.fn(),
      workflows: vi.fn(),
    };

    // Create mock ShortcutManager
    shortcutManager = {
      shortcuts: new Map(),
      handleKey: vi.fn((event) => {
        const key = event.key.toLowerCase();
        let combination = key;

        if (event.meta) combination = `meta+${combination}`;
        if (event.ctrl) combination = `ctrl+${combination}`;
        if (event.alt) combination = `alt+${combination}`;
        if (event.shift) combination = `shift+${combination}`;

        const shortcut = shortcutManager.shortcuts.get(combination);
        if (shortcut) {
          shortcut.handler();
          return true;
        }
        return false;
      }),
      register: vi.fn((combination, handler, description = '') => {
        shortcutManager.shortcuts.set(combination, { handler, description });
      }),
      unregister: vi.fn((combination) => {
        shortcutManager.shortcuts.delete(combination);
      }),
      isRegistered: vi.fn((combination) => {
        return shortcutManager.shortcuts.has(combination);
      }),
      getDescription: vi.fn((combination) => {
        return shortcutManager.shortcuts.get(combination)?.description;
      }),
    };

    // Register default APEX shortcuts
    shortcutManager.register('ctrl+c', mockHandlers.cancel, 'Cancel current operation');
    shortcutManager.register('ctrl+h', mockHandlers.help, 'Show help');
    shortcutManager.register('ctrl+l', mockHandlers.clear, 'Clear screen');
    shortcutManager.register('ctrl+shift+s', mockHandlers.status, 'Show status');
    shortcutManager.register('ctrl+t', mockHandlers.thoughts, 'Toggle thoughts display');
    shortcutManager.register('ctrl+shift+a', mockHandlers.agents, 'Show agents');
    shortcutManager.register('ctrl+shift+w', mockHandlers.workflows, 'Show workflows');
  });

  describe('Basic Shortcut Registration and Handling', () => {
    it('should handle registered shortcuts', () => {
      const result = simulator.fireToShortcutManager(
        APEX_SHORTCUTS.cancel,
        shortcutManager
      );

      expect(result).toBe(true);
      expect(mockHandlers.cancel).toHaveBeenCalledTimes(1);
    });

    it('should return false for unregistered shortcuts', () => {
      const result = simulator.fireToShortcutManager(
        { key: 'x', ctrl: true },
        shortcutManager
      );

      expect(result).toBe(false);
    });

    it('should handle all predefined APEX shortcuts', () => {
      // Test each APEX shortcut
      const results = [
        { shortcut: APEX_SHORTCUTS.help, handler: mockHandlers.help },
        { shortcut: APEX_SHORTCUTS.clear, handler: mockHandlers.clear },
        { shortcut: APEX_SHORTCUTS.thoughts, handler: mockHandlers.thoughts },
        { shortcut: APEX_SHORTCUTS.status, handler: mockHandlers.status },
        { shortcut: APEX_SHORTCUTS.agents, handler: mockHandlers.agents },
        { shortcut: APEX_SHORTCUTS.workflows, handler: mockHandlers.workflows },
      ];

      results.forEach(({ shortcut, handler }) => {
        vi.clearAllMocks();
        const result = simulator.fireToShortcutManager(shortcut, shortcutManager);
        expect(result).toBe(true);
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Modifier Key Combinations', () => {
    it('should distinguish between different modifier combinations', () => {
      // Register different combinations for the same base key
      const baseHandlers = {
        ctrl: vi.fn(),
        alt: vi.fn(),
        shift: vi.fn(),
        ctrlShift: vi.fn(),
      };

      shortcutManager.register('ctrl+t', baseHandlers.ctrl, 'Ctrl+T');
      shortcutManager.register('alt+t', baseHandlers.alt, 'Alt+T');
      shortcutManager.register('shift+t', baseHandlers.shift, 'Shift+T');
      shortcutManager.register('ctrl+shift+t', baseHandlers.ctrlShift, 'Ctrl+Shift+T');

      // Test each combination
      simulator.fireToShortcutManager({ key: 't', ctrl: true }, shortcutManager);
      expect(baseHandlers.ctrl).toHaveBeenCalledTimes(1);

      simulator.fireToShortcutManager({ key: 't', alt: true }, shortcutManager);
      expect(baseHandlers.alt).toHaveBeenCalledTimes(1);

      simulator.fireToShortcutManager({ key: 't', shift: true }, shortcutManager);
      expect(baseHandlers.shift).toHaveBeenCalledTimes(1);

      simulator.fireToShortcutManager({ key: 't', ctrl: true, shift: true }, shortcutManager);
      expect(baseHandlers.ctrlShift).toHaveBeenCalledTimes(1);

      // Ensure no cross-contamination
      expect(baseHandlers.ctrl).toHaveBeenCalledTimes(1);
      expect(baseHandlers.alt).toHaveBeenCalledTimes(1);
      expect(baseHandlers.shift).toHaveBeenCalledTimes(1);
    });

    it('should handle complex modifier combinations', () => {
      const handler = vi.fn();
      shortcutManager.register('ctrl+alt+shift+meta+f', handler, 'Complex combination');

      const result = simulator.fireToShortcutManager({
        key: 'f',
        ctrl: true,
        alt: true,
        shift: true,
        meta: true,
      }, shortcutManager);

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Shortcut Lifecycle Management', () => {
    it('should register new shortcuts dynamically', () => {
      const newHandler = vi.fn();

      expect(shortcutManager.isRegistered('ctrl+y')).toBe(false);

      shortcutManager.register('ctrl+y', newHandler, 'New shortcut');

      expect(shortcutManager.isRegistered('ctrl+y')).toBe(true);

      const result = simulator.fireToShortcutManager(
        { key: 'y', ctrl: true },
        shortcutManager
      );

      expect(result).toBe(true);
      expect(newHandler).toHaveBeenCalledTimes(1);
    });

    it('should unregister shortcuts', () => {
      const handler = vi.fn();
      shortcutManager.register('ctrl+z', handler, 'Temporary shortcut');

      expect(shortcutManager.isRegistered('ctrl+z')).toBe(true);

      shortcutManager.unregister('ctrl+z');

      expect(shortcutManager.isRegistered('ctrl+z')).toBe(false);

      const result = simulator.fireToShortcutManager(
        { key: 'z', ctrl: true },
        shortcutManager
      );

      expect(result).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should provide shortcut descriptions', () => {
      expect(shortcutManager.getDescription('ctrl+h')).toBe('Show help');
      expect(shortcutManager.getDescription('ctrl+c')).toBe('Cancel current operation');
      expect(shortcutManager.getDescription('nonexistent')).toBeUndefined();
    });
  });

  describe('Event Handling Patterns', () => {
    it('should handle rapid shortcut sequences', async () => {
      const sequence = [
        APEX_SHORTCUTS.help,     // Open help
        APEX_SHORTCUTS.status,   // Check status
        APEX_SHORTCUTS.clear,    // Clear screen
      ];

      for (const shortcut of sequence) {
        simulator.fireToShortcutManager(shortcut, shortcutManager);
      }

      expect(mockHandlers.help).toHaveBeenCalledTimes(1);
      expect(mockHandlers.status).toHaveBeenCalledTimes(1);
      expect(mockHandlers.clear).toHaveBeenCalledTimes(1);
    });

    it('should handle shortcut conflicts gracefully', () => {
      // Register a conflicting shortcut
      const conflictHandler = vi.fn();
      shortcutManager.register('ctrl+h', conflictHandler, 'Conflicting help');

      // The last registered handler should take precedence
      const result = simulator.fireToShortcutManager(
        APEX_SHORTCUTS.help,
        shortcutManager
      );

      expect(result).toBe(true);
      expect(conflictHandler).toHaveBeenCalledTimes(1);
      expect(mockHandlers.help).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive keys', () => {
      const handler = vi.fn();
      shortcutManager.register('ctrl+shift+q', handler, 'Quit');

      // Test both upper and lower case
      simulator.fireToShortcutManager({ key: 'Q', ctrl: true, shift: true }, shortcutManager);
      expect(handler).toHaveBeenCalledTimes(1);

      simulator.fireToShortcutManager({ key: 'q', ctrl: true, shift: true }, shortcutManager);
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration with Ink Components', () => {
    it('should integrate with useInput handlers', () => {
      const inkHandler = vi.fn<[string | undefined, InkKeyEvent], void>();

      // Simulate useInput registration
      const { getContext } = globalThis.keyboardTestHelpers;
      const context = getContext();
      context.inputHandlers.push(inkHandler);

      // Fire an event that should reach both Ink and ShortcutManager
      simulator.fire(APEX_SHORTCUTS.help, inkHandler);

      expect(inkHandler).toHaveBeenCalledWith(
        'h',
        expect.objectContaining({ ctrl: true })
      );
    });

    it('should handle preview mode shortcuts', () => {
      // Preview mode shortcuts from fixtures
      const confirmHandler = vi.fn();
      const cancelHandler = vi.fn();
      const editHandler = vi.fn();

      shortcutManager.register('return', confirmHandler, 'Confirm');
      shortcutManager.register('escape', cancelHandler, 'Cancel');
      shortcutManager.register('e', editHandler, 'Edit');

      // Test preview mode shortcuts
      simulator.fireToShortcutManager(APEX_SHORTCUTS.confirm, shortcutManager);
      expect(confirmHandler).toHaveBeenCalledTimes(1);

      simulator.fireToShortcutManager(APEX_SHORTCUTS.cancelPreview, shortcutManager);
      expect(cancelHandler).toHaveBeenCalledTimes(1);

      simulator.fireToShortcutManager(APEX_SHORTCUTS.edit, shortcutManager);
      expect(editHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle rapid fire shortcuts efficiently', () => {
      const startTime = Date.now();

      // Fire 100 rapid shortcuts
      for (let i = 0; i < 100; i++) {
        simulator.fireToShortcutManager(APEX_SHORTCUTS.clear, shortcutManager);
      }

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100); // Should complete in under 100ms
      expect(mockHandlers.clear).toHaveBeenCalledTimes(100);
    });

    it('should handle many registered shortcuts without performance degradation', () => {
      // Register many shortcuts
      const handlers = [];
      for (let i = 0; i < 100; i++) {
        const handler = vi.fn();
        handlers.push(handler);
        shortcutManager.register(`ctrl+f${i}`, handler, `Function ${i}`);
      }

      const startTime = Date.now();

      // Test random shortcut lookup
      const result = simulator.fireToShortcutManager(
        { key: 'f50', ctrl: true },
        shortcutManager
      );

      const duration = Date.now() - startTime;

      expect(result).toBe(true);
      expect(handlers[50]).toHaveBeenCalledTimes(1);
      expect(duration).toBeLessThan(10); // Should be very fast
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid key combinations gracefully', () => {
      expect(() => {
        simulator.fireToShortcutManager({ key: '', ctrl: true }, shortcutManager);
      }).not.toThrow();
    });

    it('should handle undefined handlers gracefully', () => {
      shortcutManager.register('ctrl+u', undefined as any, 'Undefined handler');

      expect(() => {
        simulator.fireToShortcutManager({ key: 'u', ctrl: true }, shortcutManager);
      }).not.toThrow();
    });

    it('should handle special Unicode characters', () => {
      const handler = vi.fn();
      shortcutManager.register('ctrl+é', handler, 'Unicode shortcut');

      const result = simulator.fireToShortcutManager(
        { key: 'é', ctrl: true },
        shortcutManager
      );

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});