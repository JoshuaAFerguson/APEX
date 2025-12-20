/**
 * Smoke Tests for Input Experience Components
 * Quick validation that components can be imported and basic functionality exists
 */

import { describe, it, expect } from 'vitest';

describe('Input Experience Components Smoke Test', () => {
  it('should be able to import AdvancedInput component', async () => {
    try {
      const { AdvancedInput } = await import('../ui/components/AdvancedInput');
      expect(AdvancedInput).toBeDefined();
      expect(typeof AdvancedInput).toBe('function');
    } catch (error) {
      console.error('Failed to import AdvancedInput:', error);
      throw error;
    }
  });

  it('should be able to import ShortcutManager service', async () => {
    try {
      const { ShortcutManager } = await import('../services/ShortcutManager');
      expect(ShortcutManager).toBeDefined();
      expect(typeof ShortcutManager).toBe('function');

      // Test basic instantiation
      const manager = new ShortcutManager();
      expect(manager).toBeDefined();
      expect(typeof manager.getShortcuts).toBe('function');
      expect(typeof manager.handleKey).toBe('function');
    } catch (error) {
      console.error('Failed to import ShortcutManager:', error);
      throw error;
    }
  });

  it('should be able to import CompletionEngine service', async () => {
    try {
      const { CompletionEngine } = await import('../services/CompletionEngine');
      expect(CompletionEngine).toBeDefined();
      expect(typeof CompletionEngine).toBe('function');

      // Test basic instantiation
      const engine = new CompletionEngine();
      expect(engine).toBeDefined();
      expect(typeof engine.getCompletions).toBe('function');
    } catch (error) {
      console.error('Failed to import CompletionEngine:', error);
      throw error;
    }
  });

  it('should validate test utilities are available', async () => {
    try {
      const testUtils = await import('./test-utils');
      expect(testUtils.mockUseInput).toBeDefined();
      expect(testUtils.ThemeProvider).toBeDefined();
      expect(typeof testUtils.render).toBe('function');
    } catch (error) {
      console.error('Failed to import test utilities:', error);
      throw error;
    }
  });
});

describe('ShortcutManager Basic Functionality', () => {
  it('should have default shortcuts registered', async () => {
    const { ShortcutManager } = await import('../services/ShortcutManager');
    const manager = new ShortcutManager();

    const shortcuts = manager.getShortcuts();
    expect(shortcuts).toBeInstanceOf(Array);
    expect(shortcuts.length).toBeGreaterThan(0);

    // Should have some basic shortcuts
    const shortcutIds = shortcuts.map(s => s.id);
    expect(shortcutIds).toContain('cancel'); // Ctrl+C
    expect(shortcutIds).toContain('exit'); // Ctrl+D
  });

  it('should handle key formatting correctly', async () => {
    const { ShortcutManager } = await import('../services/ShortcutManager');
    const manager = new ShortcutManager();

    const testCases = [
      { keys: { key: 'c', ctrl: true }, expected: 'Ctrl+C' },
      { keys: { key: 'enter', shift: true }, expected: 'Shift+ENTER' },
      { keys: { key: 'tab' }, expected: 'TAB' },
    ];

    testCases.forEach(({ keys, expected }) => {
      const formatted = manager.formatKey(keys);
      expect(formatted).toBe(expected);
    });
  });

  it('should handle context management', async () => {
    const { ShortcutManager } = await import('../services/ShortcutManager');
    const manager = new ShortcutManager();

    expect(manager.getCurrentContext()).toBe('global');

    manager.pushContext('input');
    expect(manager.getCurrentContext()).toBe('input');

    const popped = manager.popContext();
    expect(popped).toBe('input');
    expect(manager.getCurrentContext()).toBe('global');
  });
});