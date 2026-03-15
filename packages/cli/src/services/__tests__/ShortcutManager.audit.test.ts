/**
 * Comprehensive audit tests for ShortcutManager default shortcuts registration
 *
 * These tests verify:
 * 1. All default shortcuts are registered correctly
 * 2. Each shortcut has correct key combinations, contexts, and actions
 * 3. No duplicate IDs exist
 * 4. All expected shortcuts from the implementation are present
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ShortcutManager, KeyboardShortcut, ShortcutContext } from '../ShortcutManager';

describe('ShortcutManager Default Shortcuts Audit', () => {
  let manager: ShortcutManager;

  beforeEach(() => {
    manager = new ShortcutManager();
  });

  describe('Default Shortcuts Registration Audit', () => {
    it('should register all expected default shortcuts', () => {
      const shortcuts = manager.getShortcuts();
      const shortcutIds = shortcuts.map(s => s.id);

      // Expected default shortcuts based on registerDefaultShortcuts implementation
      const expectedShortcuts = [
        'cancel',
        'exit',
        'clear',
        'clearLine',
        'deleteWord',
        'historySearch',
        'previousHistory',
        'nextHistory',
        'complete',
        'dismiss',
        'newline',
        'submit',
        'beginningOfLine',
        'endOfLine',
        'quickSave',
        'sessionInfo',
        'sessionList',
        'help',
        'status',
        'agents',
        'workflows',
        'toggleThoughts'
      ];

      expectedShortcuts.forEach(shortcutId => {
        expect(shortcutIds).toContain(shortcutId);
      });

      expect(shortcuts.length).toBeGreaterThanOrEqual(expectedShortcuts.length);
    });

    it('should have no duplicate shortcut IDs', () => {
      const shortcuts = manager.getShortcuts();
      const ids = shortcuts.map(s => s.id);
      const uniqueIds = new Set(ids);

      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should validate cancel shortcut registration', () => {
      const shortcuts = manager.getShortcuts();
      const cancelShortcut = shortcuts.find(s => s.id === 'cancel');

      expect(cancelShortcut).toBeDefined();
      expect(cancelShortcut?.description).toBe('Cancel current operation');
      expect(cancelShortcut?.keys.key).toBe('c');
      expect(cancelShortcut?.keys.ctrl).toBe(true);
      expect(cancelShortcut?.context).toBe('processing');
      expect(cancelShortcut?.action.type).toBe('emit');
      expect((cancelShortcut?.action as any).event).toBe('cancel');
    });

    it('should validate exit shortcut registration', () => {
      const shortcuts = manager.getShortcuts();
      const exitShortcut = shortcuts.find(s => s.id === 'exit');

      expect(exitShortcut).toBeDefined();
      expect(exitShortcut?.description).toBe('Exit APEX');
      expect(exitShortcut?.keys.key).toBe('d');
      expect(exitShortcut?.keys.ctrl).toBe(true);
      expect(exitShortcut?.context).toBe('global');
      expect(exitShortcut?.action.type).toBe('emit');
      expect((exitShortcut?.action as any).event).toBe('exit');
    });

    it('should validate clear shortcut registration', () => {
      const shortcuts = manager.getShortcuts();
      const clearShortcut = shortcuts.find(s => s.id === 'clear');

      expect(clearShortcut).toBeDefined();
      expect(clearShortcut?.description).toBe('Clear screen');
      expect(clearShortcut?.keys.key).toBe('l');
      expect(clearShortcut?.keys.ctrl).toBe(true);
      expect(clearShortcut?.context).toBe('global');
      expect(clearShortcut?.action.type).toBe('emit');
      expect((clearShortcut?.action as any).event).toBe('clear');
    });

    it('should validate input context shortcuts', () => {
      const shortcuts = manager.getShortcuts();
      const inputShortcuts = shortcuts.filter(s => s.context === 'input');

      const expectedInputShortcuts = [
        'clearLine',
        'deleteWord',
        'historySearch',
        'previousHistory',
        'nextHistory',
        'complete',
        'newline',
        'submit',
        'beginningOfLine',
        'endOfLine'
      ];

      expectedInputShortcuts.forEach(id => {
        const shortcut = inputShortcuts.find(s => s.id === id);
        expect(shortcut).toBeDefined();
        expect(shortcut?.context).toBe('input');
      });
    });

    it('should validate global context shortcuts', () => {
      const shortcuts = manager.getShortcuts();
      const globalShortcuts = shortcuts.filter(s => s.context === 'global');

      const expectedGlobalShortcuts = [
        'exit',
        'clear',
        'dismiss',
        'quickSave',
        'sessionInfo',
        'sessionList',
        'help',
        'status',
        'agents',
        'workflows',
        'toggleThoughts'
      ];

      expectedGlobalShortcuts.forEach(id => {
        const shortcut = globalShortcuts.find(s => s.id === id);
        expect(shortcut).toBeDefined();
        expect(shortcut?.context).toBe('global');
      });
    });

    it('should validate command actions shortcuts', () => {
      const shortcuts = manager.getShortcuts();
      const commandShortcuts = shortcuts.filter(s => s.action.type === 'command');

      const expectedCommandShortcuts = [
        { id: 'quickSave', command: '/session save quick-save' },
        { id: 'sessionInfo', command: '/session info' },
        { id: 'sessionList', command: '/session list' },
        { id: 'help', command: '/help' },
        { id: 'status', command: '/status' },
        { id: 'agents', command: '/agents' },
        { id: 'workflows', command: '/workflows' },
        { id: 'toggleThoughts', command: '/thoughts' }
      ];

      expectedCommandShortcuts.forEach(expected => {
        const shortcut = commandShortcuts.find(s => s.id === expected.id);
        expect(shortcut).toBeDefined();
        expect(shortcut?.action.type).toBe('command');
        expect((shortcut?.action as any).command).toBe(expected.command);
      });
    });

    it('should validate emit actions shortcuts', () => {
      const shortcuts = manager.getShortcuts();
      const emitShortcuts = shortcuts.filter(s => s.action.type === 'emit');

      const expectedEmitShortcuts = [
        { id: 'cancel', event: 'cancel' },
        { id: 'exit', event: 'exit' },
        { id: 'clear', event: 'clear' },
        { id: 'clearLine', event: 'clearLine' },
        { id: 'deleteWord', event: 'deleteWord' },
        { id: 'historySearch', event: 'historySearch' },
        { id: 'previousHistory', event: 'historyPrev' },
        { id: 'nextHistory', event: 'historyNext' },
        { id: 'complete', event: 'complete' },
        { id: 'dismiss', event: 'dismiss' },
        { id: 'newline', event: 'newline' },
        { id: 'submit', event: 'submit' },
        { id: 'beginningOfLine', event: 'moveCursor' },
        { id: 'endOfLine', event: 'moveCursor' }
      ];

      expectedEmitShortcuts.forEach(expected => {
        const shortcut = emitShortcuts.find(s => s.id === expected.id);
        expect(shortcut).toBeDefined();
        expect(shortcut?.action.type).toBe('emit');
        expect((shortcut?.action as any).event).toBe(expected.event);
      });
    });

    it('should validate all shortcuts have required properties', () => {
      const shortcuts = manager.getShortcuts();

      shortcuts.forEach(shortcut => {
        // Required properties
        expect(shortcut.id).toBeDefined();
        expect(shortcut.id).toBeTypeOf('string');
        expect(shortcut.id.length).toBeGreaterThan(0);

        expect(shortcut.description).toBeDefined();
        expect(shortcut.description).toBeTypeOf('string');
        expect(shortcut.description.length).toBeGreaterThan(0);

        expect(shortcut.keys).toBeDefined();
        expect(shortcut.keys.key).toBeDefined();
        expect(shortcut.keys.key).toBeTypeOf('string');
        expect(shortcut.keys.key.length).toBeGreaterThan(0);

        expect(shortcut.action).toBeDefined();
        expect(shortcut.action.type).toBeDefined();
        expect(['command', 'function', 'emit']).toContain(shortcut.action.type);

        // Context is optional but if defined should be valid
        if (shortcut.context) {
          const validContexts: ShortcutContext[] = [
            'global', 'input', 'processing', 'idle', 'suggestions', 'history', 'modal'
          ];
          expect(validContexts).toContain(shortcut.context);
        }
      });
    });

    it('should validate key combinations are well-formed', () => {
      const shortcuts = manager.getShortcuts();

      shortcuts.forEach(shortcut => {
        const keys = shortcut.keys;

        // Key should be non-empty string
        expect(keys.key).toBeDefined();
        expect(keys.key).toBeTypeOf('string');
        expect(keys.key.length).toBeGreaterThan(0);

        // Modifier keys should be boolean or undefined
        if (keys.ctrl !== undefined) {
          expect(keys.ctrl).toBeTypeOf('boolean');
        }
        if (keys.alt !== undefined) {
          expect(keys.alt).toBeTypeOf('boolean');
        }
        if (keys.shift !== undefined) {
          expect(keys.shift).toBeTypeOf('boolean');
        }
        if (keys.meta !== undefined) {
          expect(keys.meta).toBeTypeOf('boolean');
        }
      });
    });
  });
});