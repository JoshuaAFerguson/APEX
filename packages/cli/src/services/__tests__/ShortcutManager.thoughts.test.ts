/**
 * Focused tests for the thoughts toggle functionality in ShortcutManager
 * Tests specifically the Ctrl+T shortcut registration and behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ShortcutManager,
  type KeyboardShortcut,
  type ShortcutEvent,
} from '../ShortcutManager.js';

describe('ShortcutManager - Thoughts Toggle Functionality', () => {
  let manager: ShortcutManager;

  beforeEach(() => {
    manager = new ShortcutManager();
  });

  describe('Default thoughts shortcut registration', () => {
    it('should register toggleThoughts shortcut by default', () => {
      const shortcuts = manager.getShortcuts();
      const thoughtsShortcut = shortcuts.find(s => s.id === 'toggleThoughts');

      expect(thoughtsShortcut).toBeDefined();
      expect(thoughtsShortcut?.id).toBe('toggleThoughts');
      expect(thoughtsShortcut?.description).toBe('Toggle thoughts display');
      expect(thoughtsShortcut?.keys.key).toBe('t');
      expect(thoughtsShortcut?.keys.ctrl).toBe(true);
      expect(thoughtsShortcut?.action.type).toBe('command');
      expect(thoughtsShortcut?.action.command).toBe('/thoughts');
    });

    it('should not require additional modifier keys', () => {
      const shortcuts = manager.getShortcuts();
      const thoughtsShortcut = shortcuts.find(s => s.id === 'toggleThoughts');

      expect(thoughtsShortcut?.keys.alt).toBeFalsy();
      expect(thoughtsShortcut?.keys.shift).toBeFalsy();
      expect(thoughtsShortcut?.keys.meta).toBeFalsy();
    });

    it('should be accessible in global context', () => {
      const shortcuts = manager.getShortcuts();
      const thoughtsShortcut = shortcuts.find(s => s.id === 'toggleThoughts');

      // Should work in global context (undefined context means works everywhere)
      expect(thoughtsShortcut?.context).toBeUndefined();
    });
  });

  describe('Ctrl+T key combination handling', () => {
    it('should trigger on exact Ctrl+T combination', () => {
      const commandHandler = vi.fn();
      manager.on('command', commandHandler);

      const ctrlTEvent: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      const result = manager.handleKey(ctrlTEvent);

      expect(result).toBe(true);
      expect(commandHandler).toHaveBeenCalledOnce();
      expect(commandHandler).toHaveBeenCalledWith('/thoughts');
    });

    it('should be case insensitive for T key', () => {
      const commandHandler = vi.fn();
      manager.on('command', commandHandler);

      const events: ShortcutEvent[] = [
        { key: 't', ctrl: true, alt: false, shift: false, meta: false },
        { key: 'T', ctrl: true, alt: false, shift: false, meta: false },
      ];

      events.forEach(event => {
        const result = manager.handleKey(event);
        expect(result).toBe(true);
      });

      expect(commandHandler).toHaveBeenCalledTimes(2);
      expect(commandHandler).toHaveBeenNthCalledWith(1, '/thoughts');
      expect(commandHandler).toHaveBeenNthCalledWith(2, '/thoughts');
    });

    it('should not trigger with additional modifiers', () => {
      const commandHandler = vi.fn();
      manager.on('command', commandHandler);

      const invalidEvents: ShortcutEvent[] = [
        { key: 't', ctrl: true, alt: true, shift: false, meta: false },  // Ctrl+Alt+T
        { key: 't', ctrl: true, alt: false, shift: true, meta: false },  // Ctrl+Shift+T
        { key: 't', ctrl: true, alt: false, shift: false, meta: true },  // Ctrl+Cmd+T
        { key: 't', ctrl: true, alt: true, shift: true, meta: false },   // Ctrl+Alt+Shift+T
      ];

      invalidEvents.forEach(event => {
        const result = manager.handleKey(event);
        expect(result).toBe(false);
      });

      expect(commandHandler).not.toHaveBeenCalled();
    });

    it('should not trigger without Ctrl modifier', () => {
      const commandHandler = vi.fn();
      manager.on('command', commandHandler);

      const invalidEvents: ShortcutEvent[] = [
        { key: 't', ctrl: false, alt: false, shift: false, meta: false }, // Just T
        { key: 't', ctrl: false, alt: true, shift: false, meta: false },  // Alt+T
        { key: 't', ctrl: false, alt: false, shift: true, meta: false },  // Shift+T
        { key: 't', ctrl: false, alt: false, shift: false, meta: true },  // Cmd+T
      ];

      invalidEvents.forEach(event => {
        const result = manager.handleKey(event);
        expect(result).toBe(false);
      });

      expect(commandHandler).not.toHaveBeenCalled();
    });

    it('should not trigger with wrong key', () => {
      const commandHandler = vi.fn();
      manager.on('command', commandHandler);

      const wrongKeyEvents: ShortcutEvent[] = [
        { key: 'r', ctrl: true, alt: false, shift: false, meta: false }, // Ctrl+R
        { key: 'y', ctrl: true, alt: false, shift: false, meta: false }, // Ctrl+Y
        { key: 'u', ctrl: true, alt: false, shift: false, meta: false }, // Ctrl+U
        { key: 'th', ctrl: true, alt: false, shift: false, meta: false }, // Invalid multi-char
      ];

      wrongKeyEvents.forEach(event => {
        const result = manager.handleKey(event);
        expect(result).toBe(false);
      });

      expect(commandHandler).not.toHaveBeenCalled();
    });
  });

  describe('Context behavior', () => {
    it('should work in global context', () => {
      expect(manager.getCurrentContext()).toBe('global');

      const commandHandler = vi.fn();
      manager.on('command', commandHandler);

      const ctrlTEvent: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      expect(manager.handleKey(ctrlTEvent)).toBe(true);
      expect(commandHandler).toHaveBeenCalledWith('/thoughts');
    });

    it('should work in input context', () => {
      manager.pushContext('input');
      expect(manager.getCurrentContext()).toBe('input');

      const commandHandler = vi.fn();
      manager.on('command', commandHandler);

      const ctrlTEvent: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      expect(manager.handleKey(ctrlTEvent)).toBe(true);
      expect(commandHandler).toHaveBeenCalledWith('/thoughts');
    });

    it('should work in modal context', () => {
      manager.pushContext('modal');
      expect(manager.getCurrentContext()).toBe('modal');

      const commandHandler = vi.fn();
      manager.on('command', commandHandler);

      const ctrlTEvent: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      expect(manager.handleKey(ctrlTEvent)).toBe(true);
      expect(commandHandler).toHaveBeenCalledWith('/thoughts');
    });

    it('should work in processing context', () => {
      manager.pushContext('processing');
      expect(manager.getCurrentContext()).toBe('processing');

      const commandHandler = vi.fn();
      manager.on('command', commandHandler);

      const ctrlTEvent: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      expect(manager.handleKey(ctrlTEvent)).toBe(true);
      expect(commandHandler).toHaveBeenCalledWith('/thoughts');
    });

    it('should work across context changes', () => {
      const commandHandler = vi.fn();
      manager.on('command', commandHandler);

      const ctrlTEvent: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      // Test in global
      expect(manager.handleKey(ctrlTEvent)).toBe(true);

      // Change context and test
      manager.pushContext('input');
      expect(manager.handleKey(ctrlTEvent)).toBe(true);

      // Change context again and test
      manager.pushContext('modal');
      expect(manager.handleKey(ctrlTEvent)).toBe(true);

      // Return to previous context and test
      manager.popContext();
      expect(manager.handleKey(ctrlTEvent)).toBe(true);

      expect(commandHandler).toHaveBeenCalledTimes(4);
      commandHandler.mock.calls.forEach(call => {
        expect(call[0]).toBe('/thoughts');
      });
    });
  });

  describe('Event emission and handling', () => {
    it('should emit command event with correct payload', () => {
      const commandHandler = vi.fn();
      manager.on('command', commandHandler);

      const ctrlTEvent: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      manager.handleKey(ctrlTEvent);

      expect(commandHandler).toHaveBeenCalledOnce();
      expect(commandHandler).toHaveBeenCalledWith('/thoughts');
    });

    it('should support multiple event handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      manager.on('command', handler1);
      manager.on('command', handler2);
      manager.on('command', handler3);

      const ctrlTEvent: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      manager.handleKey(ctrlTEvent);

      expect(handler1).toHaveBeenCalledWith('/thoughts');
      expect(handler2).toHaveBeenCalledWith('/thoughts');
      expect(handler3).toHaveBeenCalledWith('/thoughts');
    });

    it('should handle event handler removal', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      manager.on('command', handler1);
      manager.on('command', handler2);

      const ctrlTEvent: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      // First trigger
      manager.handleKey(ctrlTEvent);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      // Remove one handler
      manager.off('command', handler1);

      // Second trigger
      manager.handleKey(ctrlTEvent);
      expect(handler1).toHaveBeenCalledTimes(1); // Should not increase
      expect(handler2).toHaveBeenCalledTimes(2); // Should increase
    });
  });

  describe('Shortcut customization and overrides', () => {
    it('should allow replacing the thoughts shortcut', () => {
      const customShortcut: KeyboardShortcut = {
        id: 'toggleThoughts',
        description: 'Custom thoughts toggle',
        keys: { key: 'y', ctrl: true },
        action: { type: 'command', command: '/custom-thoughts' },
      };

      manager.register(customShortcut);

      const commandHandler = vi.fn();
      manager.on('command', commandHandler);

      // Original shortcut should not work
      const ctrlTEvent: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      expect(manager.handleKey(ctrlTEvent)).toBe(false);
      expect(commandHandler).not.toHaveBeenCalled();

      // New shortcut should work
      const ctrlYEvent: ShortcutEvent = {
        key: 'y',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      expect(manager.handleKey(ctrlYEvent)).toBe(true);
      expect(commandHandler).toHaveBeenCalledWith('/custom-thoughts');
    });

    it('should allow disabling thoughts shortcut', () => {
      manager.unregister('toggleThoughts');

      const commandHandler = vi.fn();
      manager.on('command', commandHandler);

      const ctrlTEvent: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      expect(manager.handleKey(ctrlTEvent)).toBe(false);
      expect(commandHandler).not.toHaveBeenCalled();
    });

    it('should allow conditional enabling via enabled function', () => {
      let thoughtsEnabled = true;

      const conditionalShortcut: KeyboardShortcut = {
        id: 'toggleThoughts',
        description: 'Conditional thoughts toggle',
        keys: { key: 't', ctrl: true },
        action: { type: 'command', command: '/thoughts' },
        enabled: () => thoughtsEnabled,
      };

      manager.register(conditionalShortcut);

      const commandHandler = vi.fn();
      manager.on('command', commandHandler);

      const ctrlTEvent: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      // Should work when enabled
      expect(manager.handleKey(ctrlTEvent)).toBe(true);
      expect(commandHandler).toHaveBeenCalledWith('/thoughts');

      // Should not work when disabled
      thoughtsEnabled = false;
      commandHandler.mockClear();
      expect(manager.handleKey(ctrlTEvent)).toBe(false);
      expect(commandHandler).not.toHaveBeenCalled();
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle malformed key events gracefully', () => {
      const commandHandler = vi.fn();
      manager.on('command', commandHandler);

      const malformedEvents: ShortcutEvent[] = [
        { key: '', ctrl: true, alt: false, shift: false, meta: false },
        { key: null as any, ctrl: true, alt: false, shift: false, meta: false },
        { key: undefined as any, ctrl: true, alt: false, shift: false, meta: false },
      ];

      malformedEvents.forEach(event => {
        expect(() => manager.handleKey(event)).not.toThrow();
        expect(manager.handleKey(event)).toBe(false);
      });

      expect(commandHandler).not.toHaveBeenCalled();
    });

    it('should handle missing modifier flags gracefully', () => {
      const commandHandler = vi.fn();
      manager.on('command', commandHandler);

      const incompleteEvent = {
        key: 't',
        ctrl: true,
        // Missing other modifiers
      } as ShortcutEvent;

      expect(() => manager.handleKey(incompleteEvent)).not.toThrow();
    });

    it('should not interfere with other shortcuts', () => {
      const thoughtsHandler = vi.fn();
      const helpHandler = vi.fn();

      manager.on('command', (command: string) => {
        if (command === '/thoughts') thoughtsHandler();
        else if (command === '/help') helpHandler();
      });

      // Test thoughts shortcut
      const ctrlTEvent: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      // Test help shortcut (should be Ctrl+H)
      const ctrlHEvent: ShortcutEvent = {
        key: 'h',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      expect(manager.handleKey(ctrlTEvent)).toBe(true);
      expect(manager.handleKey(ctrlHEvent)).toBe(true);

      expect(thoughtsHandler).toHaveBeenCalledOnce();
      expect(helpHandler).toHaveBeenCalledOnce();
    });
  });

  describe('Performance and memory considerations', () => {
    it('should handle rapid shortcut triggers efficiently', () => {
      const commandHandler = vi.fn();
      manager.on('command', commandHandler);

      const ctrlTEvent: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        manager.handleKey(ctrlTEvent);
      }
      const end = performance.now();

      expect(end - start).toBeLessThan(100);
      expect(commandHandler).toHaveBeenCalledTimes(1000);
    });

    it('should not leak memory with repeated registrations', () => {
      const initialShortcutCount = manager.getShortcuts().length;

      // Register and unregister many times
      for (let i = 0; i < 100; i++) {
        manager.register({
          id: 'toggleThoughts',
          description: `Thoughts toggle ${i}`,
          keys: { key: 't', ctrl: true },
          action: { type: 'command', command: '/thoughts' },
        });
      }

      expect(manager.getShortcuts().length).toBe(initialShortcutCount);
    });
  });
});