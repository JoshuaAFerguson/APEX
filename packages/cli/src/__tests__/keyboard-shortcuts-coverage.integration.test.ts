import { describe, it, expect, beforeEach } from 'vitest';
import { ShortcutManager, KeyboardShortcut } from '../services/ShortcutManager';

describe('Keyboard Shortcuts Coverage Integration Tests', () => {
  let manager: ShortcutManager;
  let shortcuts: KeyboardShortcut[];

  beforeEach(() => {
    manager = new ShortcutManager();
    shortcuts = manager.getShortcuts();
  });

  describe('total coverage validation', () => {
    it('should have exactly 22 shortcuts as documented', () => {
      expect(shortcuts).toHaveLength(22);
    });

    it('should cover all required shortcut categories', () => {
      const categories = {
        global: shortcuts.filter(s => !s.context || s.context === 'global'),
        input: shortcuts.filter(s => s.context === 'input'),
        processing: shortcuts.filter(s => s.context === 'processing'),
        sessionManagement: shortcuts.filter(s => s.id.includes('session') || s.id === 'quickSave'),
        quickCommands: shortcuts.filter(s => ['status', 'agents', 'workflows', 'toggleThoughts'].includes(s.id)),
        history: shortcuts.filter(s => s.id.includes('history')),
        editing: shortcuts.filter(s => ['clearLine', 'deleteWord', 'beginningOfLine', 'endOfLine'].includes(s.id))
      };

      expect(categories.global.length).toBeGreaterThanOrEqual(4);
      expect(categories.input.length).toBeGreaterThanOrEqual(8);
      expect(categories.processing.length).toBeGreaterThanOrEqual(1);
      expect(categories.sessionManagement.length).toBeGreaterThanOrEqual(3);
      expect(categories.quickCommands.length).toBeGreaterThanOrEqual(4);
      expect(categories.history.length).toBeGreaterThanOrEqual(2);
      expect(categories.editing.length).toBeGreaterThanOrEqual(4);
    });

    it('should include all essential shortcuts mentioned in documentation', () => {
      const essentialShortcuts = [
        { id: 'exit', keys: 'Ctrl+D', description: 'Exit APEX' },
        { id: 'cancel', keys: 'Ctrl+C', description: 'Cancel current operation' },
        { id: 'clear', keys: 'Ctrl+L', description: 'Clear screen' },
        { id: 'help', keys: 'Ctrl+H', description: 'Show help' },
        { id: 'quickSave', keys: 'Ctrl+S', description: 'Quick save session' }
      ];

      for (const essential of essentialShortcuts) {
        const found = shortcuts.find(s => s.id === essential.id);
        expect(found, `Essential shortcut ${essential.id} not found`).toBeDefined();

        if (found) {
          const formatted = manager.formatKey(found.keys);
          expect(formatted).toBe(essential.keys);
        }
      }
    });
  });

  describe('specific shortcut validation', () => {
    it('should validate Global Shortcuts', () => {
      const expectedGlobal = [
        { id: 'exit', keys: { key: 'd', ctrl: true }, description: 'Exit APEX' },
        { id: 'clear', keys: { key: 'l', ctrl: true }, description: 'Clear screen' },
        { id: 'dismiss', keys: { key: 'Escape' }, description: 'Dismiss suggestions/modal' },
        { id: 'quickSave', keys: { key: 's', ctrl: true }, description: 'Quick save session' },
        { id: 'help', keys: { key: 'h', ctrl: true }, description: 'Show help' }
      ];

      for (const expected of expectedGlobal) {
        const found = shortcuts.find(s => s.id === expected.id);
        expect(found, `Global shortcut ${expected.id} not found`).toBeDefined();

        if (found) {
          expect(found.keys).toEqual(expected.keys);
          expect(found.description.toLowerCase()).toContain(
            expected.description.toLowerCase().split(' ')[0]
          );
          expect(found.context === undefined || found.context === 'global').toBe(true);
        }
      }
    });

    it('should validate Session Management shortcuts', () => {
      const expectedSession = [
        { id: 'sessionInfo', keys: { key: 'i', ctrl: true, shift: true }, description: 'Show session info' },
        { id: 'sessionList', keys: { key: 'l', ctrl: true, shift: true }, description: 'List sessions' }
      ];

      for (const expected of expectedSession) {
        const found = shortcuts.find(s => s.id === expected.id);
        expect(found, `Session shortcut ${expected.id} not found`).toBeDefined();

        if (found) {
          expect(found.keys).toEqual(expected.keys);
          expect(found.context === undefined || found.context === 'global').toBe(true);
        }
      }
    });

    it('should validate Quick Commands shortcuts', () => {
      const expectedQuick = [
        { id: 'status', keys: { key: 's', ctrl: true, shift: true }, description: 'Show status' },
        { id: 'agents', keys: { key: 'a', ctrl: true, shift: true }, description: 'List agents' },
        { id: 'workflows', keys: { key: 'w', ctrl: true, shift: true }, description: 'List workflows' },
        { id: 'toggleThoughts', keys: { key: 't', ctrl: true }, description: 'Toggle thoughts display' }
      ];

      for (const expected of expectedQuick) {
        const found = shortcuts.find(s => s.id === expected.id);
        expect(found, `Quick command shortcut ${expected.id} not found`).toBeDefined();

        if (found) {
          expect(found.keys).toEqual(expected.keys);
          expect(found.context === undefined || found.context === 'global').toBe(true);
        }
      }
    });

    it('should validate Input & Editing shortcuts', () => {
      const expectedInput = [
        { id: 'clearLine', keys: { key: 'u', ctrl: true }, description: 'Clear current line' },
        { id: 'deleteWord', keys: { key: 'w', ctrl: true }, description: 'Delete word before cursor' },
        { id: 'beginningOfLine', keys: { key: 'a', ctrl: true }, description: 'Move to beginning of line' },
        { id: 'endOfLine', keys: { key: 'e', ctrl: true }, description: 'Move to end of line' },
        { id: 'submit', keys: { key: 'Enter' }, description: 'Submit input' },
        { id: 'newline', keys: { key: 'Enter', shift: true }, description: 'Insert newline (multi-line mode)' },
        { id: 'complete', keys: { key: 'Tab' }, description: 'Complete suggestion' }
      ];

      for (const expected of expectedInput) {
        const found = shortcuts.find(s => s.id === expected.id);
        expect(found, `Input shortcut ${expected.id} not found`).toBeDefined();

        if (found) {
          expect(found.keys).toEqual(expected.keys);
          expect(found.context).toBe('input');
        }
      }
    });

    it('should validate History Navigation shortcuts', () => {
      const expectedHistory = [
        { id: 'previousHistory', keys: { key: 'p', ctrl: true }, description: 'Previous history entry' },
        { id: 'nextHistory', keys: { key: 'n', ctrl: true }, description: 'Next history entry' },
        { id: 'historySearch', keys: { key: 'r', ctrl: true }, description: 'Search history' }
      ];

      for (const expected of expectedHistory) {
        const found = shortcuts.find(s => s.id === expected.id);
        expect(found, `History shortcut ${expected.id} not found`).toBeDefined();

        if (found) {
          expect(found.keys).toEqual(expected.keys);
          expect(found.context).toBe('input');
        }
      }
    });

    it('should validate Processing & Control shortcuts', () => {
      const expectedProcessing = [
        { id: 'cancel', keys: { key: 'c', ctrl: true }, description: 'Cancel current operation' }
      ];

      for (const expected of expectedProcessing) {
        const found = shortcuts.find(s => s.id === expected.id);
        expect(found, `Processing shortcut ${expected.id} not found`).toBeDefined();

        if (found) {
          expect(found.keys).toEqual(expected.keys);
          expect(found.context).toBe('processing');
        }
      }
    });
  });

  describe('shortcut uniqueness and conflicts', () => {
    it('should have unique shortcut combinations', () => {
      const keyMap = new Map<string, KeyboardShortcut[]>();

      for (const shortcut of shortcuts) {
        const keyCombo = manager.formatKey(shortcut.keys);
        if (!keyMap.has(keyCombo)) {
          keyMap.set(keyCombo, []);
        }
        keyMap.get(keyCombo)!.push(shortcut);
      }

      for (const [combo, shortcuts] of keyMap) {
        if (shortcuts.length > 1) {
          // Check if they have different contexts (which is OK)
          const contexts = shortcuts.map(s => s.context || 'global');
          const uniqueContexts = [...new Set(contexts)];

          if (uniqueContexts.length === 1) {
            expect.fail(
              `Duplicate shortcut combination "${combo}" found in same context: ` +
              shortcuts.map(s => s.id).join(', ')
            );
          }
        }
      }
    });

    it('should not have conflicting context-aware shortcuts', () => {
      // Check that global shortcuts don't conflict with input shortcuts that could be active
      const globalShortcuts = shortcuts.filter(s => !s.context || s.context === 'global');
      const inputShortcuts = shortcuts.filter(s => s.context === 'input');

      for (const global of globalShortcuts) {
        const globalKey = manager.formatKey(global.keys);

        for (const input of inputShortcuts) {
          const inputKey = manager.formatKey(input.keys);

          if (globalKey === inputKey) {
            // This is OK if they serve different purposes in different contexts
            // but we should verify the behavior is intentional
            expect(global.id).not.toBe(input.id);
          }
        }
      }
    });
  });

  describe('action type validation', () => {
    it('should have proper action types for all shortcuts', () => {
      const validActionTypes = ['command', 'function', 'emit'];

      for (const shortcut of shortcuts) {
        expect(validActionTypes).toContain(shortcut.action.type);

        switch (shortcut.action.type) {
          case 'command':
            expect(typeof shortcut.action.command).toBe('string');
            expect(shortcut.action.command.length).toBeGreaterThan(0);
            break;
          case 'function':
            expect(typeof shortcut.action.handler).toBe('function');
            break;
          case 'emit':
            expect(typeof shortcut.action.event).toBe('string');
            expect(shortcut.action.event.length).toBeGreaterThan(0);
            break;
        }
      }
    });

    it('should have correct commands for command actions', () => {
      const commandShortcuts = shortcuts.filter(s => s.action.type === 'command');
      const expectedCommands = {
        help: '/help',
        quickSave: '/session save quick-save',
        sessionInfo: '/session info',
        sessionList: '/session list',
        status: '/status',
        agents: '/agents',
        workflows: '/workflows',
        toggleThoughts: '/thoughts'
      };

      for (const [shortcutId, expectedCommand] of Object.entries(expectedCommands)) {
        const shortcut = commandShortcuts.find(s => s.id === shortcutId);
        expect(shortcut, `Command shortcut ${shortcutId} not found`).toBeDefined();

        if (shortcut && shortcut.action.type === 'command') {
          expect(shortcut.action.command).toBe(expectedCommand);
        }
      }
    });
  });

  describe('context behavior validation', () => {
    it('should have correct context assignments', () => {
      const contextExpectations = {
        global: ['exit', 'clear', 'dismiss', 'quickSave', 'sessionInfo', 'sessionList', 'help', 'status', 'agents', 'workflows', 'toggleThoughts'],
        input: ['clearLine', 'deleteWord', 'previousHistory', 'nextHistory', 'historySearch', 'complete', 'newline', 'submit', 'beginningOfLine', 'endOfLine'],
        processing: ['cancel']
      };

      for (const [expectedContext, shortcutIds] of Object.entries(contextExpectations)) {
        for (const id of shortcutIds) {
          const shortcut = shortcuts.find(s => s.id === id);
          expect(shortcut, `Shortcut ${id} not found`).toBeDefined();

          if (shortcut) {
            if (expectedContext === 'global') {
              expect(shortcut.context === undefined || shortcut.context === 'global').toBe(true);
            } else {
              expect(shortcut.context).toBe(expectedContext);
            }
          }
        }
      }
    });

    it('should allow context-appropriate shortcuts to be retrieved', () => {
      const globalShortcuts = manager.getShortcutsForContext('global');
      const inputShortcuts = manager.getShortcutsForContext('input');
      const processagingShortcuts = manager.getShortcutsForContext('processing');

      // Global context should have global and no-context shortcuts
      expect(globalShortcuts.some(s => s.id === 'exit')).toBe(true);
      expect(globalShortcuts.some(s => s.id === 'help')).toBe(true);

      // Input context should have global, input, and no-context shortcuts
      expect(inputShortcuts.some(s => s.id === 'exit')).toBe(true); // global
      expect(inputShortcuts.some(s => s.id === 'clearLine')).toBe(true); // input
      expect(inputShortcuts.some(s => s.id === 'cancel')).toBe(false); // processing only

      // Processing context should have global, processing, and no-context shortcuts
      expect(processagingShortcuts.some(s => s.id === 'exit')).toBe(true); // global
      expect(processagingShortcuts.some(s => s.id === 'cancel')).toBe(true); // processing
      expect(processagingShortcuts.some(s => s.id === 'clearLine')).toBe(false); // input only
    });
  });
});