/**
 * @fileoverview Keyboard event simulation utilities for APEX testing
 *
 * This module provides type-safe utilities for simulating keyboard events
 * in tests, supporting both Ink-style events and ShortcutManager events.
 *
 * Features:
 * - Type-safe event creation
 * - Support for all modifier keys
 * - Special key handling (Enter, Escape, Arrow keys, etc.)
 * - Key sequence simulation with timing control
 * - Event normalization and validation
 */

import type { InkKeyEvent, ShortcutEvent, KeyboardEventOptions } from '../setup.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Common key aliases for normalization
 */
export const KEY_ALIASES: Record<string, string> = {
  'enter': 'return',
  'esc': 'escape',
  'space': ' ',
  'spacebar': ' ',
  'ctrl': 'control',
  'cmd': 'meta',
  'command': 'meta',
  'opt': 'alt',
  'option': 'alt',
};

/**
 * Special keys that don't produce character input
 */
export const SPECIAL_KEYS = new Set([
  'return',
  'escape',
  'tab',
  'backspace',
  'delete',
  'uparrow', 'arrowup',
  'downarrow', 'arrowdown',
  'leftarrow', 'arrowleft',
  'rightarrow', 'arrowright',
  'pageup',
  'pagedown',
  'home',
  'end',
  'insert',
  'f1', 'f2', 'f3', 'f4', 'f5', 'f6',
  'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
]);

/**
 * Predefined common key combinations
 */
export const COMMON_SHORTCUTS = {
  // Application control
  cancel: { key: 'c', ctrl: true } as KeyboardEventOptions,
  exit: { key: 'd', ctrl: true } as KeyboardEventOptions,
  clear: { key: 'l', ctrl: true } as KeyboardEventOptions,

  // Navigation
  help: { key: 'h', ctrl: true } as KeyboardEventOptions,
  status: { key: 's', ctrl: true, shift: true } as KeyboardEventOptions,
  agents: { key: 'a', ctrl: true, shift: true } as KeyboardEventOptions,
  workflows: { key: 'w', ctrl: true, shift: true } as KeyboardEventOptions,
  thoughts: { key: 't', ctrl: true } as KeyboardEventOptions,

  // Preview mode
  confirm: { key: 'return' } as KeyboardEventOptions,
  cancelPreview: { key: 'escape' } as KeyboardEventOptions,
  edit: { key: 'e' } as KeyboardEventOptions,

  // Text editing
  selectAll: { key: 'a', ctrl: true } as KeyboardEventOptions,
  copy: { key: 'c', ctrl: true } as KeyboardEventOptions,
  paste: { key: 'v', ctrl: true } as KeyboardEventOptions,
  undo: { key: 'z', ctrl: true } as KeyboardEventOptions,
  redo: { key: 'z', ctrl: true, shift: true } as KeyboardEventOptions,
} as const;

// ============================================================================
// KeyboardEventSimulator Class
// ============================================================================

/**
 * A utility class for simulating keyboard events in tests
 *
 * @example
 * ```typescript
 * const simulator = new KeyboardEventSimulator();
 *
 * // Create a simple key event
 * const event = simulator.createInkEvent({ key: 'a' });
 *
 * // Create a key combination
 * const ctrlC = simulator.createInkEvent({ key: 'c', ctrl: true });
 *
 * // Fire events to handlers
 * simulator.fire({ key: 'escape' }, myHandler);
 * ```
 */
export class KeyboardEventSimulator {
  private eventLog: Array<{ timestamp: number; event: KeyboardEventOptions }> = [];

  /**
   * Normalize a key value to its canonical form
   */
  normalizeKey(key: string): string {
    const lower = key.toLowerCase();
    return KEY_ALIASES[lower] || key;
  }

  /**
   * Check if a key is a special key (doesn't produce character input)
   */
  isSpecialKey(key: string): boolean {
    return SPECIAL_KEYS.has(key.toLowerCase());
  }

  /**
   * Create an Ink-compatible key event
   */
  createInkEvent(options: KeyboardEventOptions): { input: string | undefined; key: InkKeyEvent } {
    const normalizedKey = this.normalizeKey(options.key);
    const key: InkKeyEvent = {
      ctrl: options.ctrl || false,
      alt: options.alt || false,
      shift: options.shift || false,
      meta: options.meta || false,
    };

    // Set special key flags
    switch (normalizedKey.toLowerCase()) {
      case 'return':
        key.return = true;
        return { input: '', key };
      case 'escape':
        key.escape = true;
        return { input: '', key };
      case 'tab':
        key.tab = true;
        return { input: '', key };
      case 'backspace':
        key.backspace = true;
        return { input: '', key };
      case 'delete':
        key.delete = true;
        return { input: '', key };
      case 'uparrow':
      case 'arrowup':
        key.upArrow = true;
        return { input: '', key };
      case 'downarrow':
      case 'arrowdown':
        key.downArrow = true;
        return { input: '', key };
      case 'leftarrow':
      case 'arrowleft':
        key.leftArrow = true;
        return { input: '', key };
      case 'rightarrow':
      case 'arrowright':
        key.rightArrow = true;
        return { input: '', key };
      case 'pageup':
        key.pageUp = true;
        return { input: '', key };
      case 'pagedown':
        key.pageDown = true;
        return { input: '', key };
      default:
        // Regular character input
        // Apply shift modifier to letter case
        const inputChar = options.shift && normalizedKey.length === 1
          ? normalizedKey.toUpperCase()
          : normalizedKey;
        return { input: inputChar, key };
    }
  }

  /**
   * Create a ShortcutManager-compatible event
   */
  createShortcutEvent(options: KeyboardEventOptions): ShortcutEvent {
    return {
      key: this.normalizeKey(options.key),
      ctrl: options.ctrl || false,
      alt: options.alt || false,
      shift: options.shift || false,
      meta: options.meta || false,
    };
  }

  /**
   * Fire a keyboard event to an Ink useInput handler
   */
  fire(
    options: KeyboardEventOptions,
    handler: (input: string | undefined, key: InkKeyEvent) => void
  ): void {
    const event = this.createInkEvent(options);
    this.eventLog.push({ timestamp: Date.now(), event: options });
    handler(event.input, event.key);
  }

  /**
   * Fire a keyboard event to a ShortcutManager
   */
  fireToShortcutManager(
    options: KeyboardEventOptions,
    manager: { handleKey: (event: ShortcutEvent) => boolean }
  ): boolean {
    const event = this.createShortcutEvent(options);
    this.eventLog.push({ timestamp: Date.now(), event: options });
    return manager.handleKey(event);
  }

  /**
   * Fire a sequence of keyboard events with optional delays
   */
  async fireSequence(
    events: KeyboardEventOptions[],
    handler: (input: string | undefined, key: InkKeyEvent) => void,
    options: { delay?: number } = {}
  ): Promise<void> {
    const { delay = 0 } = options;

    for (let i = 0; i < events.length; i++) {
      this.fire(events[i], handler);

      if (delay > 0 && i < events.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Fire rapid key presses (simulates user typing quickly)
   */
  fireRapid(
    keys: string,
    handler: (input: string | undefined, key: InkKeyEvent) => void
  ): void {
    for (const char of keys) {
      this.fire({ key: char }, handler);
    }
  }

  /**
   * Get the event log for debugging/assertions
   */
  getEventLog(): Array<{ timestamp: number; event: KeyboardEventOptions }> {
    return [...this.eventLog];
  }

  /**
   * Clear the event log
   */
  clearEventLog(): void {
    this.eventLog = [];
  }

  /**
   * Format a key combination for display
   */
  formatKeyCombination(options: KeyboardEventOptions): string {
    const parts: string[] = [];

    if (options.ctrl) parts.push('Ctrl');
    if (options.alt) parts.push('Alt');
    if (options.shift) parts.push('Shift');
    if (options.meta) parts.push('Cmd');

    const key = options.key.length === 1
      ? options.key.toUpperCase()
      : options.key.charAt(0).toUpperCase() + options.key.slice(1);

    parts.push(key);

    return parts.join('+');
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a new KeyboardEventSimulator instance
 */
export function createSimulator(): KeyboardEventSimulator {
  return new KeyboardEventSimulator();
}

/**
 * Create a single Ink-compatible key event (convenience function)
 */
export function createInkEvent(options: KeyboardEventOptions): { input: string | undefined; key: InkKeyEvent } {
  return new KeyboardEventSimulator().createInkEvent(options);
}

/**
 * Create a single ShortcutManager-compatible event (convenience function)
 */
export function createShortcutEvent(options: KeyboardEventOptions): ShortcutEvent {
  return new KeyboardEventSimulator().createShortcutEvent(options);
}

/**
 * Generate all modifier key combinations for a base key
 * Useful for exhaustive testing of modifier handling
 */
export function* generateModifierCombinations(
  baseKey: string
): Generator<KeyboardEventOptions> {
  const modifiers = ['ctrl', 'alt', 'shift', 'meta'] as const;
  const combinations = Math.pow(2, modifiers.length);

  for (let i = 0; i < combinations; i++) {
    const options: KeyboardEventOptions = { key: baseKey };

    for (let j = 0; j < modifiers.length; j++) {
      if (i & (1 << j)) {
        options[modifiers[j]] = true;
      }
    }

    yield options;
  }
}

/**
 * Generate a range of character key events
 * @example generateCharacterRange('a', 'z') -> events for a, b, c, ..., z
 */
export function* generateCharacterRange(
  start: string,
  end: string
): Generator<KeyboardEventOptions> {
  const startCode = start.charCodeAt(0);
  const endCode = end.charCodeAt(0);

  for (let code = startCode; code <= endCode; code++) {
    yield { key: String.fromCharCode(code) };
  }
}

/**
 * Generate all F-key events (F1-F12)
 */
export function* generateFunctionKeys(): Generator<KeyboardEventOptions> {
  for (let i = 1; i <= 12; i++) {
    yield { key: `F${i}` };
  }
}

// ============================================================================
// Test Matchers
// ============================================================================

/**
 * Check if two key events are equivalent
 */
export function eventsEqual(
  a: KeyboardEventOptions,
  b: KeyboardEventOptions
): boolean {
  const simulator = new KeyboardEventSimulator();
  const keyA = simulator.normalizeKey(a.key).toLowerCase();
  const keyB = simulator.normalizeKey(b.key).toLowerCase();

  return (
    keyA === keyB &&
    (a.ctrl || false) === (b.ctrl || false) &&
    (a.alt || false) === (b.alt || false) &&
    (a.shift || false) === (b.shift || false) &&
    (a.meta || false) === (b.meta || false)
  );
}

/**
 * Check if a key event matches a shortcut definition
 */
export function eventMatchesShortcut(
  event: KeyboardEventOptions,
  shortcut: KeyboardEventOptions
): boolean {
  return eventsEqual(event, shortcut);
}

export default KeyboardEventSimulator;
