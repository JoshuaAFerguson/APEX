/**
 * @fileoverview Tests for keyboard event simulation utilities
 *
 * These tests verify that the keyboard test infrastructure works correctly
 * before using it to test actual application keyboard handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  KeyboardEventSimulator,
  createSimulator,
  createInkEvent,
  createShortcutEvent,
  generateModifierCombinations,
  generateCharacterRange,
  generateFunctionKeys,
  eventsEqual,
  eventMatchesShortcut,
  COMMON_SHORTCUTS,
  KEY_ALIASES,
  SPECIAL_KEYS,
} from '../utils/keyboard-events.js';
import {
  LETTER_KEYS,
  NUMBER_KEYS,
  ARROW_KEYS,
  ACTION_KEYS,
  APEX_SHORTCUTS,
  AUTO_EXECUTE_CANCEL_KEYS,
  PREVIEW_MODE_SPECIAL_KEYS,
  getAllFixtures,
  getFixturesByCategory,
} from '../fixtures/key-combinations.js';

describe('KeyboardEventSimulator', () => {
  let simulator: KeyboardEventSimulator;

  beforeEach(() => {
    simulator = createSimulator();
  });

  describe('key normalization', () => {
    it('should normalize common key aliases', () => {
      expect(simulator.normalizeKey('enter')).toBe('return');
      expect(simulator.normalizeKey('esc')).toBe('escape');
      expect(simulator.normalizeKey('space')).toBe(' ');
      expect(simulator.normalizeKey('spacebar')).toBe(' ');
    });

    it('should preserve keys without aliases', () => {
      expect(simulator.normalizeKey('a')).toBe('a');
      expect(simulator.normalizeKey('Tab')).toBe('Tab');
      expect(simulator.normalizeKey('F1')).toBe('F1');
    });

    it('should handle case-insensitive aliases', () => {
      expect(simulator.normalizeKey('ENTER')).toBe('return');
      expect(simulator.normalizeKey('Enter')).toBe('return');
      expect(simulator.normalizeKey('ESC')).toBe('escape');
    });
  });

  describe('special key detection', () => {
    it('should identify special keys correctly', () => {
      expect(simulator.isSpecialKey('return')).toBe(true);
      expect(simulator.isSpecialKey('escape')).toBe(true);
      expect(simulator.isSpecialKey('tab')).toBe(true);
      expect(simulator.isSpecialKey('backspace')).toBe(true);
      expect(simulator.isSpecialKey('delete')).toBe(true);
      expect(simulator.isSpecialKey('arrowup')).toBe(true);
      expect(simulator.isSpecialKey('pagedown')).toBe(true);
    });

    it('should identify regular keys correctly', () => {
      expect(simulator.isSpecialKey('a')).toBe(false);
      expect(simulator.isSpecialKey('1')).toBe(false);
      expect(simulator.isSpecialKey(' ')).toBe(false);
    });
  });

  describe('createInkEvent', () => {
    it('should create events for regular character keys', () => {
      const event = simulator.createInkEvent({ key: 'a' });
      expect(event.input).toBe('a');
      expect(event.key.ctrl).toBe(false);
      expect(event.key.alt).toBe(false);
      expect(event.key.shift).toBe(false);
      expect(event.key.meta).toBe(false);
    });

    it('should create events with modifier keys', () => {
      const event = simulator.createInkEvent({
        key: 'c',
        ctrl: true,
        shift: true,
      });
      expect(event.input).toBe('C'); // shift uppercase
      expect(event.key.ctrl).toBe(true);
      expect(event.key.shift).toBe(true);
    });

    it('should create events for Enter key', () => {
      const event = simulator.createInkEvent({ key: 'return' });
      expect(event.input).toBe('');
      expect(event.key.return).toBe(true);
    });

    it('should create events for Escape key', () => {
      const event = simulator.createInkEvent({ key: 'escape' });
      expect(event.input).toBe('');
      expect(event.key.escape).toBe(true);
    });

    it('should create events for Tab key', () => {
      const event = simulator.createInkEvent({ key: 'tab' });
      expect(event.input).toBe('');
      expect(event.key.tab).toBe(true);
    });

    it('should create events for arrow keys', () => {
      const upEvent = simulator.createInkEvent({ key: 'ArrowUp' });
      expect(upEvent.input).toBe('');
      expect(upEvent.key.upArrow).toBe(true);

      const downEvent = simulator.createInkEvent({ key: 'ArrowDown' });
      expect(downEvent.key.downArrow).toBe(true);

      const leftEvent = simulator.createInkEvent({ key: 'ArrowLeft' });
      expect(leftEvent.key.leftArrow).toBe(true);

      const rightEvent = simulator.createInkEvent({ key: 'ArrowRight' });
      expect(rightEvent.key.rightArrow).toBe(true);
    });

    it('should handle "enter" alias for "return"', () => {
      const event = simulator.createInkEvent({ key: 'enter' });
      expect(event.key.return).toBe(true);
    });

    it('should handle "esc" alias for "escape"', () => {
      const event = simulator.createInkEvent({ key: 'esc' });
      expect(event.key.escape).toBe(true);
    });
  });

  describe('createShortcutEvent', () => {
    it('should create ShortcutManager-compatible events', () => {
      const event = simulator.createShortcutEvent({
        key: 'c',
        ctrl: true,
      });
      expect(event.key).toBe('c');
      expect(event.ctrl).toBe(true);
      expect(event.alt).toBe(false);
      expect(event.shift).toBe(false);
      expect(event.meta).toBe(false);
    });

    it('should normalize key aliases', () => {
      const event = simulator.createShortcutEvent({ key: 'enter' });
      expect(event.key).toBe('return');
    });
  });

  describe('fire', () => {
    it('should call handler with correct event', () => {
      const handler = vi.fn();
      simulator.fire({ key: 'a' }, handler);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith('a', expect.objectContaining({
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
      }));
    });

    it('should log events for debugging', () => {
      const handler = vi.fn();
      simulator.fire({ key: 'a' }, handler);
      simulator.fire({ key: 'b', ctrl: true }, handler);

      const log = simulator.getEventLog();
      expect(log).toHaveLength(2);
      expect(log[0].event.key).toBe('a');
      expect(log[1].event.key).toBe('b');
      expect(log[1].event.ctrl).toBe(true);
    });
  });

  describe('fireSequence', () => {
    it('should fire multiple events in order', async () => {
      const handler = vi.fn();
      await simulator.fireSequence(
        [{ key: 'a' }, { key: 'b' }, { key: 'c' }],
        handler
      );

      expect(handler).toHaveBeenCalledTimes(3);
      const calls = handler.mock.calls;
      expect(calls[0][0]).toBe('a');
      expect(calls[1][0]).toBe('b');
      expect(calls[2][0]).toBe('c');
    });

    it('should respect delay between events', async () => {
      const handler = vi.fn();
      const startTime = Date.now();

      await simulator.fireSequence(
        [{ key: 'a' }, { key: 'b' }],
        handler,
        { delay: 50 }
      );

      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(45); // Allow some variance
    });
  });

  describe('fireRapid', () => {
    it('should fire each character as a separate event', () => {
      const handler = vi.fn();
      simulator.fireRapid('abc', handler);

      expect(handler).toHaveBeenCalledTimes(3);
      expect(handler.mock.calls[0][0]).toBe('a');
      expect(handler.mock.calls[1][0]).toBe('b');
      expect(handler.mock.calls[2][0]).toBe('c');
    });
  });

  describe('formatKeyCombination', () => {
    it('should format simple keys', () => {
      expect(simulator.formatKeyCombination({ key: 'a' })).toBe('A');
      expect(simulator.formatKeyCombination({ key: 'return' })).toBe('Return');
    });

    it('should format modifier combinations', () => {
      expect(simulator.formatKeyCombination({ key: 'c', ctrl: true })).toBe('Ctrl+C');
      expect(simulator.formatKeyCombination({ key: 's', ctrl: true, shift: true })).toBe('Ctrl+Shift+S');
      expect(simulator.formatKeyCombination({ key: 'a', meta: true })).toBe('Cmd+A');
    });

    it('should order modifiers consistently', () => {
      expect(simulator.formatKeyCombination({
        key: 'x',
        ctrl: true,
        alt: true,
        shift: true,
        meta: true,
      })).toBe('Ctrl+Alt+Shift+Cmd+X');
    });
  });

  describe('event log management', () => {
    it('should track all fired events', () => {
      const handler = vi.fn();
      simulator.fire({ key: 'a' }, handler);
      simulator.fire({ key: 'b' }, handler);

      expect(simulator.getEventLog()).toHaveLength(2);
    });

    it('should clear event log', () => {
      const handler = vi.fn();
      simulator.fire({ key: 'a' }, handler);
      simulator.clearEventLog();

      expect(simulator.getEventLog()).toHaveLength(0);
    });
  });
});

describe('Utility Functions', () => {
  describe('createInkEvent', () => {
    it('should work as a standalone function', () => {
      const event = createInkEvent({ key: 'a', ctrl: true });
      expect(event.input).toBe('a');
      expect(event.key.ctrl).toBe(true);
    });
  });

  describe('createShortcutEvent', () => {
    it('should work as a standalone function', () => {
      const event = createShortcutEvent({ key: 'c', ctrl: true });
      expect(event.key).toBe('c');
      expect(event.ctrl).toBe(true);
    });
  });

  describe('generateModifierCombinations', () => {
    it('should generate all 16 modifier combinations', () => {
      const combinations = [...generateModifierCombinations('a')];
      expect(combinations).toHaveLength(16); // 2^4 combinations

      // Verify all modifier combinations exist
      expect(combinations.some(c => !c.ctrl && !c.alt && !c.shift && !c.meta)).toBe(true);
      expect(combinations.some(c => c.ctrl && !c.alt && !c.shift && !c.meta)).toBe(true);
      expect(combinations.some(c => c.ctrl && c.alt && c.shift && c.meta)).toBe(true);
    });
  });

  describe('generateCharacterRange', () => {
    it('should generate events for character range', () => {
      const events = [...generateCharacterRange('a', 'c')];
      expect(events).toHaveLength(3);
      expect(events[0].key).toBe('a');
      expect(events[1].key).toBe('b');
      expect(events[2].key).toBe('c');
    });
  });

  describe('generateFunctionKeys', () => {
    it('should generate F1-F12 events', () => {
      const events = [...generateFunctionKeys()];
      expect(events).toHaveLength(12);
      expect(events[0].key).toBe('F1');
      expect(events[11].key).toBe('F12');
    });
  });

  describe('eventsEqual', () => {
    it('should detect equal events', () => {
      expect(eventsEqual(
        { key: 'a', ctrl: true },
        { key: 'a', ctrl: true }
      )).toBe(true);
    });

    it('should detect different events', () => {
      expect(eventsEqual(
        { key: 'a', ctrl: true },
        { key: 'b', ctrl: true }
      )).toBe(false);

      expect(eventsEqual(
        { key: 'a', ctrl: true },
        { key: 'a', ctrl: false }
      )).toBe(false);
    });

    it('should normalize key aliases for comparison', () => {
      expect(eventsEqual(
        { key: 'enter' },
        { key: 'return' }
      )).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(eventsEqual(
        { key: 'A' },
        { key: 'a' }
      )).toBe(true);
    });
  });

  describe('eventMatchesShortcut', () => {
    it('should match compatible events', () => {
      expect(eventMatchesShortcut(
        { key: 'c', ctrl: true },
        COMMON_SHORTCUTS.cancel
      )).toBe(true);
    });

    it('should not match incompatible events', () => {
      expect(eventMatchesShortcut(
        { key: 'd', ctrl: true },
        COMMON_SHORTCUTS.cancel
      )).toBe(false);
    });
  });
});

describe('Key Combination Fixtures', () => {
  describe('LETTER_KEYS', () => {
    it('should contain all 26 lowercase letters', () => {
      expect(LETTER_KEYS).toHaveLength(26);
      expect(LETTER_KEYS[0].key).toBe('a');
      expect(LETTER_KEYS[25].key).toBe('z');
    });
  });

  describe('NUMBER_KEYS', () => {
    it('should contain digits 0-9', () => {
      expect(NUMBER_KEYS).toHaveLength(10);
      expect(NUMBER_KEYS[0].key).toBe('0');
      expect(NUMBER_KEYS[9].key).toBe('9');
    });
  });

  describe('ARROW_KEYS', () => {
    it('should contain all four arrow keys', () => {
      expect(ARROW_KEYS).toHaveLength(4);
      const keys = ARROW_KEYS.map(k => k.key.toLowerCase());
      expect(keys).toContain('arrowup');
      expect(keys).toContain('arrowdown');
      expect(keys).toContain('arrowleft');
      expect(keys).toContain('arrowright');
    });
  });

  describe('ACTION_KEYS', () => {
    it('should contain common action keys', () => {
      expect(ACTION_KEYS.length).toBeGreaterThanOrEqual(4);
      const keys = ACTION_KEYS.map(k => k.key.toLowerCase());
      expect(keys).toContain('return');
      expect(keys).toContain('escape');
      expect(keys).toContain('tab');
      expect(keys).toContain('backspace');
    });
  });

  describe('APEX_SHORTCUTS', () => {
    it('should define cancel shortcut as Ctrl+C', () => {
      expect(APEX_SHORTCUTS.cancel.key).toBe('c');
      expect(APEX_SHORTCUTS.cancel.ctrl).toBe(true);
    });

    it('should define exit shortcut as Ctrl+D', () => {
      expect(APEX_SHORTCUTS.exit.key).toBe('d');
      expect(APEX_SHORTCUTS.exit.ctrl).toBe(true);
    });

    it('should define help shortcut as Ctrl+H', () => {
      expect(APEX_SHORTCUTS.help.key).toBe('h');
      expect(APEX_SHORTCUTS.help.ctrl).toBe(true);
    });

    it('should define status shortcut as Ctrl+Shift+S', () => {
      expect(APEX_SHORTCUTS.status.key).toBe('s');
      expect(APEX_SHORTCUTS.status.ctrl).toBe(true);
      expect(APEX_SHORTCUTS.status.shift).toBe(true);
    });
  });

  describe('AUTO_EXECUTE_CANCEL_KEYS', () => {
    it('should not include reserved keys (e)', () => {
      const keys = AUTO_EXECUTE_CANCEL_KEYS.map(k => k.key.toLowerCase());
      expect(keys).not.toContain('e');
    });

    it('should include common alphanumeric keys', () => {
      const keys = AUTO_EXECUTE_CANCEL_KEYS.map(k => k.key.toLowerCase());
      expect(keys).toContain('a');
      expect(keys).toContain('z');
      expect(keys).toContain('0');
      expect(keys).toContain('9');
    });
  });

  describe('PREVIEW_MODE_SPECIAL_KEYS', () => {
    it('should include Enter, Escape, and e', () => {
      const keys = PREVIEW_MODE_SPECIAL_KEYS.map(k => k.key.toLowerCase());
      expect(keys).toContain('return');
      expect(keys).toContain('escape');
      expect(keys).toContain('e');
    });
  });

  describe('getAllFixtures', () => {
    it('should return a non-empty array', () => {
      const all = getAllFixtures();
      expect(all.length).toBeGreaterThan(100); // Should have many fixtures
    });
  });

  describe('getFixturesByCategory', () => {
    it('should return fixtures for valid category', () => {
      const letters = getFixturesByCategory('letters');
      expect(letters).toHaveLength(26);
    });
  });
});

describe('COMMON_SHORTCUTS', () => {
  it('should define application control shortcuts', () => {
    expect(COMMON_SHORTCUTS.cancel).toBeDefined();
    expect(COMMON_SHORTCUTS.exit).toBeDefined();
    expect(COMMON_SHORTCUTS.clear).toBeDefined();
  });

  it('should define navigation shortcuts', () => {
    expect(COMMON_SHORTCUTS.help).toBeDefined();
    expect(COMMON_SHORTCUTS.status).toBeDefined();
    expect(COMMON_SHORTCUTS.thoughts).toBeDefined();
  });

  it('should define preview mode shortcuts', () => {
    expect(COMMON_SHORTCUTS.confirm).toBeDefined();
    expect(COMMON_SHORTCUTS.cancelPreview).toBeDefined();
    expect(COMMON_SHORTCUTS.edit).toBeDefined();
  });
});

describe('Global Test Helpers', () => {
  it('should have keyboardTestHelpers available globally', () => {
    expect(globalThis.keyboardTestHelpers).toBeDefined();
    expect(typeof globalThis.keyboardTestHelpers.createKeyEvent).toBe('function');
    expect(typeof globalThis.keyboardTestHelpers.fireKeyEvent).toBe('function');
    expect(typeof globalThis.keyboardTestHelpers.fireKeySequence).toBe('function');
  });

  describe('createKeyEvent', () => {
    it('should create events via global helper', () => {
      const event = globalThis.keyboardTestHelpers.createKeyEvent({ key: 'a' });
      expect(event.input).toBe('a');
    });
  });

  describe('createShortcutEvent', () => {
    it('should create shortcut events via global helper', () => {
      const event = globalThis.keyboardTestHelpers.createShortcutEvent({
        key: 'c',
        ctrl: true,
      });
      expect(event.key).toBe('c');
      expect(event.ctrl).toBe(true);
    });
  });

  describe('getContext', () => {
    it('should return test context', () => {
      const ctx = globalThis.keyboardTestHelpers.getContext();
      expect(ctx).toBeDefined();
      expect(Array.isArray(ctx.inputHandlers)).toBe(true);
      expect(Array.isArray(ctx.firedEvents)).toBe(true);
    });
  });

  describe('resetContext', () => {
    it('should reset the test context', () => {
      const ctx1 = globalThis.keyboardTestHelpers.getContext();
      ctx1.firedEvents.push({ input: 'test', key: {} as any });

      globalThis.keyboardTestHelpers.resetContext();

      const ctx2 = globalThis.keyboardTestHelpers.getContext();
      expect(ctx2.firedEvents).toHaveLength(0);
    });
  });
});
