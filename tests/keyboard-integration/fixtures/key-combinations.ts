/**
 * @fileoverview Keyboard event test fixtures for APEX testing
 *
 * This module provides predefined keyboard event fixtures for common
 * test scenarios, organized by category for easy discovery and reuse.
 */

import type { KeyboardEventOptions } from '../setup.js';

// ============================================================================
// Basic Key Fixtures
// ============================================================================

/**
 * Single letter key events (a-z)
 */
export const LETTER_KEYS: KeyboardEventOptions[] = Array.from(
  { length: 26 },
  (_, i) => ({ key: String.fromCharCode(97 + i) })
);

/**
 * Uppercase letter key events (A-Z with shift)
 */
export const UPPERCASE_LETTER_KEYS: KeyboardEventOptions[] = Array.from(
  { length: 26 },
  (_, i) => ({ key: String.fromCharCode(97 + i), shift: true })
);

/**
 * Number key events (0-9)
 */
export const NUMBER_KEYS: KeyboardEventOptions[] = Array.from(
  { length: 10 },
  (_, i) => ({ key: String(i) })
);

/**
 * Common special character keys
 */
export const SPECIAL_CHARACTER_KEYS: KeyboardEventOptions[] = [
  { key: ' ' },      // space
  { key: '!' },
  { key: '@' },
  { key: '#' },
  { key: '$' },
  { key: '%' },
  { key: '^' },
  { key: '&' },
  { key: '*' },
  { key: '(' },
  { key: ')' },
  { key: '-' },
  { key: '_' },
  { key: '=' },
  { key: '+' },
  { key: '[' },
  { key: ']' },
  { key: '{' },
  { key: '}' },
  { key: '\\' },
  { key: '|' },
  { key: ';' },
  { key: ':' },
  { key: "'" },
  { key: '"' },
  { key: ',' },
  { key: '<' },
  { key: '.' },
  { key: '>' },
  { key: '/' },
  { key: '?' },
  { key: '`' },
  { key: '~' },
];

// ============================================================================
// Navigation Key Fixtures
// ============================================================================

/**
 * Arrow key events
 */
export const ARROW_KEYS: KeyboardEventOptions[] = [
  { key: 'ArrowUp' },
  { key: 'ArrowDown' },
  { key: 'ArrowLeft' },
  { key: 'ArrowRight' },
];

/**
 * Page navigation keys
 */
export const PAGE_NAVIGATION_KEYS: KeyboardEventOptions[] = [
  { key: 'PageUp' },
  { key: 'PageDown' },
  { key: 'Home' },
  { key: 'End' },
];

/**
 * All navigation keys combined
 */
export const ALL_NAVIGATION_KEYS: KeyboardEventOptions[] = [
  ...ARROW_KEYS,
  ...PAGE_NAVIGATION_KEYS,
];

// ============================================================================
// Action Key Fixtures
// ============================================================================

/**
 * Confirmation/action keys
 */
export const ACTION_KEYS: KeyboardEventOptions[] = [
  { key: 'return' },    // Enter
  { key: 'escape' },    // Esc
  { key: 'tab' },       // Tab
  { key: 'backspace' }, // Backspace
  { key: 'delete' },    // Delete
];

/**
 * Function keys (F1-F12)
 */
export const FUNCTION_KEYS: KeyboardEventOptions[] = Array.from(
  { length: 12 },
  (_, i) => ({ key: `F${i + 1}` })
);

// ============================================================================
// Modifier Combination Fixtures
// ============================================================================

/**
 * Ctrl + letter combinations
 */
export const CTRL_LETTER_COMBINATIONS: KeyboardEventOptions[] = Array.from(
  { length: 26 },
  (_, i) => ({ key: String.fromCharCode(97 + i), ctrl: true })
);

/**
 * Alt + letter combinations
 */
export const ALT_LETTER_COMBINATIONS: KeyboardEventOptions[] = Array.from(
  { length: 26 },
  (_, i) => ({ key: String.fromCharCode(97 + i), alt: true })
);

/**
 * Ctrl + Shift + letter combinations
 */
export const CTRL_SHIFT_LETTER_COMBINATIONS: KeyboardEventOptions[] = Array.from(
  { length: 26 },
  (_, i) => ({ key: String.fromCharCode(97 + i), ctrl: true, shift: true })
);

/**
 * Meta/Cmd + letter combinations
 */
export const META_LETTER_COMBINATIONS: KeyboardEventOptions[] = Array.from(
  { length: 26 },
  (_, i) => ({ key: String.fromCharCode(97 + i), meta: true })
);

// ============================================================================
// APEX-Specific Shortcut Fixtures
// ============================================================================

/**
 * Default APEX CLI shortcuts
 */
export const APEX_SHORTCUTS = {
  // Application control
  cancel: { key: 'c', ctrl: true } as KeyboardEventOptions,
  exit: { key: 'd', ctrl: true } as KeyboardEventOptions,
  clear: { key: 'l', ctrl: true } as KeyboardEventOptions,

  // Help and navigation
  help: { key: 'h', ctrl: true } as KeyboardEventOptions,
  status: { key: 's', ctrl: true, shift: true } as KeyboardEventOptions,
  agents: { key: 'a', ctrl: true, shift: true } as KeyboardEventOptions,
  workflows: { key: 'w', ctrl: true, shift: true } as KeyboardEventOptions,

  // Display modes
  thoughts: { key: 't', ctrl: true } as KeyboardEventOptions,
  toggleThoughts: { key: 't', ctrl: true } as KeyboardEventOptions,

  // Preview mode actions
  confirm: { key: 'return' } as KeyboardEventOptions,
  cancelPreview: { key: 'escape' } as KeyboardEventOptions,
  edit: { key: 'e' } as KeyboardEventOptions,
};

/**
 * All APEX shortcuts as an array for iteration
 */
export const ALL_APEX_SHORTCUTS: KeyboardEventOptions[] = Object.values(APEX_SHORTCUTS);

// ============================================================================
// Preview Mode Fixtures
// ============================================================================

/**
 * Keys that should cancel auto-execute countdown
 * (any key except Enter, Escape, and 'e')
 */
export const AUTO_EXECUTE_CANCEL_KEYS: KeyboardEventOptions[] = [
  ...LETTER_KEYS.filter(k => k.key !== 'e'),
  ...NUMBER_KEYS,
  { key: ' ' },  // space
  { key: '.' },
  { key: ',' },
  { key: '/' },
  { key: '-' },
];

/**
 * Keys that should NOT cancel auto-execute countdown
 * (they have special behavior in preview mode)
 */
export const PREVIEW_MODE_SPECIAL_KEYS: KeyboardEventOptions[] = [
  { key: 'return' },  // confirms execution
  { key: 'escape' },  // cancels preview
  { key: 'e' },       // enters edit mode
  { key: 'E' },       // also enters edit mode
];

// ============================================================================
// Edge Case Fixtures
// ============================================================================

/**
 * Keys with all modifiers pressed
 */
export const ALL_MODIFIERS_PRESSED: KeyboardEventOptions[] = [
  { key: 'a', ctrl: true, alt: true, shift: true, meta: true },
  { key: 'return', ctrl: true, alt: true, shift: true, meta: true },
  { key: 'escape', ctrl: true, alt: true, shift: true, meta: true },
];

/**
 * Empty or whitespace inputs
 */
export const WHITESPACE_INPUTS: KeyboardEventOptions[] = [
  { key: '' },
  { key: ' ' },
  { key: '  ' },
  { key: '\t' },
  { key: '\n' },
];

/**
 * Unicode character inputs
 */
export const UNICODE_INPUTS: KeyboardEventOptions[] = [
  { key: '\u00e9' },  // e with accent
  { key: '\u00f1' },  // n with tilde
  { key: '\u4e2d' },  // Chinese character
  { key: '\ud83d\ude00' }, // emoji (grinning face)
];

/**
 * Very long input strings (edge case)
 */
export const LONG_INPUTS: KeyboardEventOptions[] = [
  { key: 'a'.repeat(100) },
  { key: 'test '.repeat(20) },
];

// ============================================================================
// Test Scenario Fixtures
// ============================================================================

/**
 * Scenario: User types a command quickly
 */
export const RAPID_TYPING_SCENARIO: KeyboardEventOptions[] = [
  { key: '/' },
  { key: 's' },
  { key: 't' },
  { key: 'a' },
  { key: 't' },
  { key: 'u' },
  { key: 's' },
  { key: 'return' },
];

/**
 * Scenario: User cancels auto-execute and then confirms
 */
export const CANCEL_THEN_CONFIRM_SCENARIO: KeyboardEventOptions[] = [
  { key: 'x' },       // any key to cancel countdown
  { key: 'return' },  // confirm execution
];

/**
 * Scenario: User cancels auto-execute and then edits
 */
export const CANCEL_THEN_EDIT_SCENARIO: KeyboardEventOptions[] = [
  { key: 'q' },  // any key to cancel countdown
  { key: 'e' },  // enter edit mode
];

/**
 * Scenario: User cancels auto-execute and then abandons
 */
export const CANCEL_THEN_ABANDON_SCENARIO: KeyboardEventOptions[] = [
  { key: 'w' },      // any key to cancel countdown
  { key: 'escape' }, // cancel preview entirely
];

/**
 * Scenario: Navigation through UI elements
 */
export const UI_NAVIGATION_SCENARIO: KeyboardEventOptions[] = [
  { key: 'tab' },
  { key: 'ArrowDown' },
  { key: 'ArrowDown' },
  { key: 'ArrowUp' },
  { key: 'return' },
];

/**
 * Scenario: Keyboard shortcut sequence (help, then status, then exit)
 */
export const SHORTCUT_SEQUENCE_SCENARIO: KeyboardEventOptions[] = [
  { key: 'h', ctrl: true },  // help
  { key: 's', ctrl: true, shift: true },  // status
  { key: 'd', ctrl: true },  // exit
];

// ============================================================================
// Fixture Categories for Parameterized Tests
// ============================================================================

/**
 * All fixture categories for comprehensive testing
 */
export const ALL_FIXTURE_CATEGORIES = {
  letters: LETTER_KEYS,
  uppercaseLetters: UPPERCASE_LETTER_KEYS,
  numbers: NUMBER_KEYS,
  specialChars: SPECIAL_CHARACTER_KEYS,
  arrows: ARROW_KEYS,
  pageNav: PAGE_NAVIGATION_KEYS,
  actions: ACTION_KEYS,
  functionKeys: FUNCTION_KEYS,
  ctrlCombos: CTRL_LETTER_COMBINATIONS,
  altCombos: ALT_LETTER_COMBINATIONS,
  ctrlShiftCombos: CTRL_SHIFT_LETTER_COMBINATIONS,
  metaCombos: META_LETTER_COMBINATIONS,
  apexShortcuts: ALL_APEX_SHORTCUTS,
  autoExecCancel: AUTO_EXECUTE_CANCEL_KEYS,
  previewSpecial: PREVIEW_MODE_SPECIAL_KEYS,
  edgeCases: [...ALL_MODIFIERS_PRESSED, ...WHITESPACE_INPUTS, ...UNICODE_INPUTS, ...LONG_INPUTS],
} as const;

/**
 * Get all fixtures as a flat array (useful for exhaustive testing)
 */
export function getAllFixtures(): KeyboardEventOptions[] {
  return Object.values(ALL_FIXTURE_CATEGORIES).flat();
}

/**
 * Get fixtures by category name
 */
export function getFixturesByCategory(
  category: keyof typeof ALL_FIXTURE_CATEGORIES
): KeyboardEventOptions[] {
  return ALL_FIXTURE_CATEGORIES[category];
}
