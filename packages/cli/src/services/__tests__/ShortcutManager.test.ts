import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ShortcutManager,
  KeyboardShortcut,
  ShortcutEvent,
  KeyCombination,
  ShortcutContext
} from '../ShortcutManager';

describe('ShortcutManager', () => {
  let manager: ShortcutManager;

  beforeEach(() => {
    manager = new ShortcutManager();
  });

  describe('initialization', () => {
    it('should register default shortcuts', () => {
      const shortcuts = manager.getShortcuts();

      expect(shortcuts.length).toBeGreaterThan(0);
      expect(shortcuts.some(s => s.id === 'cancel')).toBe(true);
      expect(shortcuts.some(s => s.id === 'exit')).toBe(true);
      expect(shortcuts.some(s => s.id === 'clear')).toBe(true);
    });

    it('should start with global context', () => {
      expect(manager.getCurrentContext()).toBe('global');
    });
  });

  describe('shortcut registration', () => {
    it('should register custom shortcuts', () => {
      const customShortcut: KeyboardShortcut = {
        id: 'custom-test',
        description: 'Custom test shortcut',
        keys: { key: 'x', ctrl: true },
        action: { type: 'emit', event: 'custom-test' }
      };

      manager.register(customShortcut);
      const shortcuts = manager.getShortcuts();

      expect(shortcuts.some(s => s.id === 'custom-test')).toBe(true);
    });

    it('should replace existing shortcuts with same ID', () => {
      const shortcut1: KeyboardShortcut = {
        id: 'test',
        description: 'First test',
        keys: { key: 'x', ctrl: true },
        action: { type: 'emit', event: 'test1' }
      };

      const shortcut2: KeyboardShortcut = {
        id: 'test',
        description: 'Second test',
        keys: { key: 'y', ctrl: true },
        action: { type: 'emit', event: 'test2' }
      };

      manager.register(shortcut1);
      manager.register(shortcut2);

      const shortcuts = manager.getShortcuts();
      const testShortcuts = shortcuts.filter(s => s.id === 'test');

      expect(testShortcuts).toHaveLength(1);
      expect(testShortcuts[0].description).toBe('Second test');
    });

    it('should unregister shortcuts', () => {
      const customShortcut: KeyboardShortcut = {
        id: 'to-remove',
        description: 'Will be removed',
        keys: { key: 'r', ctrl: true },
        action: { type: 'emit', event: 'remove' }
      };

      manager.register(customShortcut);
      expect(manager.getShortcuts().some(s => s.id === 'to-remove')).toBe(true);

      manager.unregister('to-remove');
      expect(manager.getShortcuts().some(s => s.id === 'to-remove')).toBe(false);
    });
  });

  describe('context management', () => {
    it('should push and pop contexts', () => {
      expect(manager.getCurrentContext()).toBe('global');

      manager.pushContext('input');
      expect(manager.getCurrentContext()).toBe('input');

      manager.pushContext('modal');
      expect(manager.getCurrentContext()).toBe('modal');

      const popped = manager.popContext();
      expect(popped).toBe('modal');
      expect(manager.getCurrentContext()).toBe('input');

      manager.popContext();
      expect(manager.getCurrentContext()).toBe('global');
    });

    it('should not pop last context', () => {
      expect(manager.getCurrentContext()).toBe('global');

      const popped = manager.popContext();
      expect(popped).toBeUndefined();
      expect(manager.getCurrentContext()).toBe('global');
    });
  });

  describe('key matching', () => {
    beforeEach(() => {
      // Clear default shortcuts for cleaner testing
      const defaultShortcuts = manager.getShortcuts();
      defaultShortcuts.forEach(s => manager.unregister(s.id));
    });

    it('should match simple key combinations', () => {
      const shortcut: KeyboardShortcut = {
        id: 'test',
        description: 'Test',
        keys: { key: 'c', ctrl: true },
        action: { type: 'emit', event: 'test' }
      };

      const handler = vi.fn();
      manager.register(shortcut);
      manager.on('test', handler);

      // Should match
      const event1: ShortcutEvent = { key: 'c', ctrl: true, alt: false, shift: false, meta: false };
      expect(manager.handleKey(event1)).toBe(true);
      expect(handler).toHaveBeenCalledOnce();

      // Should not match (different key)
      handler.mockClear();
      const event2: ShortcutEvent = { key: 'd', ctrl: true, alt: false, shift: false, meta: false };
      expect(manager.handleKey(event2)).toBe(false);
      expect(handler).not.toHaveBeenCalled();

      // Should not match (missing ctrl)
      const event3: ShortcutEvent = { key: 'c', ctrl: false, alt: false, shift: false, meta: false };
      expect(manager.handleKey(event3)).toBe(false);
    });

    it('should match complex key combinations', () => {
      const shortcut: KeyboardShortcut = {
        id: 'complex',
        description: 'Complex shortcut',
        keys: { key: 's', ctrl: true, shift: true, alt: true },
        action: { type: 'emit', event: 'complex' }
      };

      const handler = vi.fn();
      manager.register(shortcut);
      manager.on('complex', handler);

      const event: ShortcutEvent = {
        key: 's',
        ctrl: true,
        shift: true,
        alt: true,
        meta: false
      };

      expect(manager.handleKey(event)).toBe(true);
      expect(handler).toHaveBeenCalledOnce();
    });

    it('should be case insensitive', () => {
      const shortcut: KeyboardShortcut = {
        id: 'case-test',
        description: 'Case insensitive test',
        keys: { key: 'A', ctrl: true },
        action: { type: 'emit', event: 'case-test' }
      };

      const handler = vi.fn();
      manager.register(shortcut);
      manager.on('case-test', handler);

      const event1: ShortcutEvent = { key: 'a', ctrl: true, alt: false, shift: false, meta: false };
      const event2: ShortcutEvent = { key: 'A', ctrl: true, alt: false, shift: false, meta: false };

      expect(manager.handleKey(event1)).toBe(true);
      expect(manager.handleKey(event2)).toBe(true);
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('context filtering', () => {
    beforeEach(() => {
      // Clear default shortcuts for cleaner testing
      const defaultShortcuts = manager.getShortcuts();
      defaultShortcuts.forEach(s => manager.unregister(s.id));
    });

    it('should execute global shortcuts in any context', () => {
      const globalShortcut: KeyboardShortcut = {
        id: 'global-test',
        description: 'Global shortcut',
        keys: { key: 'g', ctrl: true },
        action: { type: 'emit', event: 'global' },
        context: 'global'
      };

      const handler = vi.fn();
      manager.register(globalShortcut);
      manager.on('global', handler);

      // Test in global context
      expect(manager.getCurrentContext()).toBe('global');
      const event: ShortcutEvent = { key: 'g', ctrl: true, alt: false, shift: false, meta: false };
      expect(manager.handleKey(event)).toBe(true);
      expect(handler).toHaveBeenCalledOnce();

      // Test in input context
      handler.mockClear();
      manager.pushContext('input');
      expect(manager.handleKey(event)).toBe(true);
      expect(handler).toHaveBeenCalledOnce();

      // Test in modal context
      handler.mockClear();
      manager.pushContext('modal');
      expect(manager.handleKey(event)).toBe(true);
      expect(handler).toHaveBeenCalledOnce();
    });

    it('should execute context-specific shortcuts only in correct context', () => {
      const inputShortcut: KeyboardShortcut = {
        id: 'input-test',
        description: 'Input shortcut',
        keys: { key: 'i', ctrl: true },
        action: { type: 'emit', event: 'input-only' },
        context: 'input'
      };

      const handler = vi.fn();
      manager.register(inputShortcut);
      manager.on('input-only', handler);

      const event: ShortcutEvent = { key: 'i', ctrl: true, alt: false, shift: false, meta: false };

      // Should not work in global context
      expect(manager.getCurrentContext()).toBe('global');
      expect(manager.handleKey(event)).toBe(false);
      expect(handler).not.toHaveBeenCalled();

      // Should work in input context
      manager.pushContext('input');
      expect(manager.handleKey(event)).toBe(true);
      expect(handler).toHaveBeenCalledOnce();

      // Should not work in other contexts
      handler.mockClear();
      manager.pushContext('modal');
      expect(manager.handleKey(event)).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should execute shortcuts without context in any context', () => {
      const anyShortcut: KeyboardShortcut = {
        id: 'any-test',
        description: 'Any context shortcut',
        keys: { key: 'a', ctrl: true },
        action: { type: 'emit', event: 'any-context' }
        // No context specified
      };

      const handler = vi.fn();
      manager.register(anyShortcut);
      manager.on('any-context', handler);

      const event: ShortcutEvent = { key: 'a', ctrl: true, alt: false, shift: false, meta: false };

      // Should work in all contexts
      expect(manager.handleKey(event)).toBe(true);
      expect(handler).toHaveBeenCalledOnce();

      handler.mockClear();
      manager.pushContext('input');
      expect(manager.handleKey(event)).toBe(true);
      expect(handler).toHaveBeenCalledOnce();

      handler.mockClear();
      manager.pushContext('modal');
      expect(manager.handleKey(event)).toBe(true);
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('enabled state', () => {
    beforeEach(() => {
      // Clear default shortcuts for cleaner testing
      const defaultShortcuts = manager.getShortcuts();
      defaultShortcuts.forEach(s => manager.unregister(s.id));
    });

    it('should respect enabled function', () => {
      let isEnabled = true;
      const shortcut: KeyboardShortcut = {
        id: 'conditional',
        description: 'Conditional shortcut',
        keys: { key: 'c', ctrl: true },
        action: { type: 'emit', event: 'conditional' },
        enabled: () => isEnabled
      };

      const handler = vi.fn();
      manager.register(shortcut);
      manager.on('conditional', handler);

      const event: ShortcutEvent = { key: 'c', ctrl: true, alt: false, shift: false, meta: false };

      // Should work when enabled
      expect(manager.handleKey(event)).toBe(true);
      expect(handler).toHaveBeenCalledOnce();

      // Should not work when disabled
      handler.mockClear();
      isEnabled = false;
      expect(manager.handleKey(event)).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('action execution', () => {
    beforeEach(() => {
      // Clear default shortcuts for cleaner testing
      const defaultShortcuts = manager.getShortcuts();
      defaultShortcuts.forEach(s => manager.unregister(s.id));
    });

    it('should execute function actions', () => {
      const functionHandler = vi.fn();
      const shortcut: KeyboardShortcut = {
        id: 'function-test',
        description: 'Function action test',
        keys: { key: 'f', ctrl: true },
        action: { type: 'function', handler: functionHandler }
      };

      manager.register(shortcut);

      const event: ShortcutEvent = { key: 'f', ctrl: true, alt: false, shift: false, meta: false };
      expect(manager.handleKey(event)).toBe(true);
      expect(functionHandler).toHaveBeenCalledOnce();
    });

    it('should execute command actions', () => {
      const commandHandler = vi.fn();
      manager.on('command', commandHandler);

      const shortcut: KeyboardShortcut = {
        id: 'command-test',
        description: 'Command action test',
        keys: { key: 'h', ctrl: true },
        action: { type: 'command', command: '/help' }
      };

      manager.register(shortcut);

      const event: ShortcutEvent = { key: 'h', ctrl: true, alt: false, shift: false, meta: false };
      expect(manager.handleKey(event)).toBe(true);
      expect(commandHandler).toHaveBeenCalledWith('/help');
    });

    it('should execute emit actions', () => {
      const eventHandler = vi.fn();
      manager.on('custom-event', eventHandler);

      const shortcut: KeyboardShortcut = {
        id: 'emit-test',
        description: 'Emit action test',
        keys: { key: 'e', ctrl: true },
        action: { type: 'emit', event: 'custom-event', payload: { test: 'data' } }
      };

      manager.register(shortcut);

      const event: ShortcutEvent = { key: 'e', ctrl: true, alt: false, shift: false, meta: false };
      expect(manager.handleKey(event)).toBe(true);
      expect(eventHandler).toHaveBeenCalledWith({ test: 'data' });
    });

    it('should execute emit actions without payload', () => {
      const eventHandler = vi.fn();
      manager.on('no-payload', eventHandler);

      const shortcut: KeyboardShortcut = {
        id: 'no-payload-test',
        description: 'No payload test',
        keys: { key: 'n', ctrl: true },
        action: { type: 'emit', event: 'no-payload' }
      };

      manager.register(shortcut);

      const event: ShortcutEvent = { key: 'n', ctrl: true, alt: false, shift: false, meta: false };
      expect(manager.handleKey(event)).toBe(true);
      expect(eventHandler).toHaveBeenCalledWith(undefined);
    });
  });

  describe('event handling', () => {
    it('should add and remove event handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      manager.on('test-event', handler1);
      manager.on('test-event', handler2);

      // Emit event
      manager['emit']('test-event', 'payload');

      expect(handler1).toHaveBeenCalledWith('payload');
      expect(handler2).toHaveBeenCalledWith('payload');

      // Remove one handler
      handler1.mockClear();
      handler2.mockClear();
      manager.off('test-event', handler1);

      manager['emit']('test-event', 'payload2');

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith('payload2');
    });

    it('should handle multiple handlers for same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      manager.on('multi-handler', handler1);
      manager.on('multi-handler', handler2);
      manager.on('multi-handler', handler3);

      manager['emit']('multi-handler', 'test');

      expect(handler1).toHaveBeenCalledWith('test');
      expect(handler2).toHaveBeenCalledWith('test');
      expect(handler3).toHaveBeenCalledWith('test');
    });

    it('should handle removing non-existent handlers gracefully', () => {
      const handler = vi.fn();

      // Should not throw
      manager.off('non-existent', handler);
      manager.off('test', handler); // Handler not added
    });
  });

  describe('utility methods', () => {
    it('should get shortcuts for specific context', () => {
      manager.register({
        id: 'global-1',
        description: 'Global 1',
        keys: { key: 'g' },
        action: { type: 'emit', event: 'g1' },
        context: 'global'
      });

      manager.register({
        id: 'input-1',
        description: 'Input 1',
        keys: { key: 'i' },
        action: { type: 'emit', event: 'i1' },
        context: 'input'
      });

      manager.register({
        id: 'no-context',
        description: 'No context',
        keys: { key: 'n' },
        action: { type: 'emit', event: 'n1' }
        // No context specified
      });

      const inputShortcuts = manager.getShortcutsForContext('input');
      const globalShortcuts = manager.getShortcutsForContext('global');

      // Input context should get global shortcuts, input shortcuts, and no-context shortcuts
      expect(inputShortcuts.some(s => s.id === 'global-1')).toBe(true);
      expect(inputShortcuts.some(s => s.id === 'input-1')).toBe(true);
      expect(inputShortcuts.some(s => s.id === 'no-context')).toBe(true);

      // Global context should get global shortcuts and no-context shortcuts
      expect(globalShortcuts.some(s => s.id === 'global-1')).toBe(true);
      expect(globalShortcuts.some(s => s.id === 'no-context')).toBe(true);
      expect(globalShortcuts.some(s => s.id === 'input-1')).toBe(false);
    });

    it('should format key combinations correctly', () => {
      const testCases: { keys: KeyCombination; expected: string }[] = [
        { keys: { key: 'a' }, expected: 'A' },
        { keys: { key: 'a', ctrl: true }, expected: 'Ctrl+A' },
        { keys: { key: 'a', shift: true }, expected: 'Shift+A' },
        { keys: { key: 'a', alt: true }, expected: 'Alt+A' },
        { keys: { key: 'a', meta: true }, expected: 'Cmd+A' },
        { keys: { key: 'a', ctrl: true, shift: true }, expected: 'Ctrl+Shift+A' },
        { keys: { key: 'a', ctrl: true, alt: true, shift: true, meta: true }, expected: 'Ctrl+Alt+Shift+Cmd+A' },
        { keys: { key: 'F1' }, expected: 'F1' },
        { keys: { key: 'Tab', ctrl: true }, expected: 'Ctrl+TAB' },
        { keys: { key: 'enter', shift: true }, expected: 'Shift+ENTER' },
      ];

      for (const testCase of testCases) {
        expect(manager.formatKey(testCase.keys)).toBe(testCase.expected);
      }
    });
  });

  describe('default shortcuts integration', () => {
    it('should handle cancel shortcut (Ctrl+C)', () => {
      const cancelHandler = vi.fn();
      manager.on('cancel', cancelHandler);
      manager.pushContext('processing');

      const event: ShortcutEvent = { key: 'c', ctrl: true, alt: false, shift: false, meta: false };
      expect(manager.handleKey(event)).toBe(true);
      expect(cancelHandler).toHaveBeenCalledOnce();
    });

    it('should handle exit shortcut (Ctrl+D)', () => {
      const exitHandler = vi.fn();
      manager.on('exit', exitHandler);

      const event: ShortcutEvent = { key: 'd', ctrl: true, alt: false, shift: false, meta: false };
      expect(manager.handleKey(event)).toBe(true);
      expect(exitHandler).toHaveBeenCalledOnce();
    });

    it('should handle help shortcut (Ctrl+H)', () => {
      const commandHandler = vi.fn();
      manager.on('command', commandHandler);

      const event: ShortcutEvent = { key: 'h', ctrl: true, alt: false, shift: false, meta: false };
      expect(manager.handleKey(event)).toBe(true);
      expect(commandHandler).toHaveBeenCalledWith('/help');
    });

    it('should handle session shortcuts (Ctrl+Shift combinations)', () => {
      const commandHandler = vi.fn();
      manager.on('command', commandHandler);

      // Ctrl+Shift+S for status
      const statusEvent: ShortcutEvent = { key: 's', ctrl: true, alt: false, shift: true, meta: false };
      expect(manager.handleKey(statusEvent)).toBe(true);
      expect(commandHandler).toHaveBeenCalledWith('/status');

      commandHandler.mockClear();

      // Ctrl+Shift+A for agents
      const agentsEvent: ShortcutEvent = { key: 'a', ctrl: true, alt: false, shift: true, meta: false };
      expect(manager.handleKey(agentsEvent)).toBe(true);
      expect(commandHandler).toHaveBeenCalledWith('/agents');

      commandHandler.mockClear();

      // Ctrl+Shift+W for workflows
      const workflowsEvent: ShortcutEvent = { key: 'w', ctrl: true, alt: false, shift: true, meta: false };
      expect(manager.handleKey(workflowsEvent)).toBe(true);
      expect(commandHandler).toHaveBeenCalledWith('/workflows');
    });
  });

  describe('edge cases', () => {
    it('should handle empty key events gracefully', () => {
      const emptyEvent: ShortcutEvent = { key: '', ctrl: false, alt: false, shift: false, meta: false };
      expect(manager.handleKey(emptyEvent)).toBe(false);
    });

    it('should handle multiple matching shortcuts (first match wins)', () => {
      // Clear defaults to avoid interference
      const defaultShortcuts = manager.getShortcuts();
      defaultShortcuts.forEach(s => manager.unregister(s.id));

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      manager.register({
        id: 'first',
        description: 'First shortcut',
        keys: { key: 'x', ctrl: true },
        action: { type: 'emit', event: 'first' }
      });

      manager.register({
        id: 'second',
        description: 'Second shortcut',
        keys: { key: 'x', ctrl: true },
        action: { type: 'emit', event: 'second' }
      });

      manager.on('first', handler1);
      manager.on('second', handler2);

      const event: ShortcutEvent = { key: 'x', ctrl: true, alt: false, shift: false, meta: false };
      expect(manager.handleKey(event)).toBe(true);

      // Only first one should be called (order of iteration may vary)
      expect(handler1.mock.calls.length + handler2.mock.calls.length).toBe(1);
    });

    it('should not crash on invalid action types', () => {
      const shortcut: KeyboardShortcut = {
        id: 'invalid-action',
        description: 'Invalid action test',
        keys: { key: 'x', ctrl: true },
        action: { type: 'invalid' } as any
      };

      manager.register(shortcut);

      const event: ShortcutEvent = { key: 'x', ctrl: true, alt: false, shift: false, meta: false };

      // Should not throw
      expect(() => manager.handleKey(event)).not.toThrow();
    });
  });
});