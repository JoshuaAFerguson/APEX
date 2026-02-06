/**
 * @fileoverview Keyboard integration test setup for APEX
 *
 * This setup file provides:
 * 1. Global keyboard event simulation utilities
 * 2. Ink component mocking infrastructure
 * 3. Fake timer configuration for deterministic tests
 * 4. Common test helpers for keyboard-related tests
 *
 * Usage:
 * - Automatically loaded by vitest.config.ts setupFiles
 * - Provides global utilities via `globalThis`
 * - Configures consistent mocking for keyboard tests
 */

import { beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Keyboard event options for simulation
 */
export interface KeyboardEventOptions {
  /** The key value (e.g., 'a', 'Enter', 'Escape') */
  key: string;
  /** Ctrl/Control modifier */
  ctrl?: boolean;
  /** Alt/Option modifier */
  alt?: boolean;
  /** Shift modifier */
  shift?: boolean;
  /** Meta/Command modifier */
  meta?: boolean;
}

/**
 * Ink-compatible key event structure
 * Matches the format expected by Ink's useInput hook
 */
export interface InkKeyEvent {
  return?: boolean;
  escape?: boolean;
  tab?: boolean;
  backspace?: boolean;
  delete?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  upArrow?: boolean;
  downArrow?: boolean;
  leftArrow?: boolean;
  rightArrow?: boolean;
  pageUp?: boolean;
  pageDown?: boolean;
}

/**
 * Shortcut event structure for ShortcutManager
 */
export interface ShortcutEvent {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

/**
 * Keyboard test context with mocks and helpers
 */
export interface KeyboardTestContext {
  /** Captured useInput handlers */
  inputHandlers: Array<(input: string | undefined, key: InkKeyEvent) => void>;
  /** Mock useInput implementation */
  mockUseInput: ReturnType<typeof vi.fn>;
  /** Mock useApp implementation */
  mockUseApp: ReturnType<typeof vi.fn>;
  /** Track fired events */
  firedEvents: Array<{ input: string | undefined; key: InkKeyEvent }>;
}

/**
 * Keyboard test helpers available globally
 */
export interface KeyboardTestHelpers {
  /** Create a keyboard event for simulation */
  createKeyEvent: (options: KeyboardEventOptions) => { input: string | undefined; key: InkKeyEvent };
  /** Create a ShortcutManager-compatible event */
  createShortcutEvent: (options: KeyboardEventOptions) => ShortcutEvent;
  /** Fire a key event to all registered handlers */
  fireKeyEvent: (options: KeyboardEventOptions) => void;
  /** Fire a sequence of key events with optional delay */
  fireKeySequence: (events: KeyboardEventOptions[], delay?: number) => Promise<void>;
  /** Get the current test context */
  getContext: () => KeyboardTestContext;
  /** Reset the test context */
  resetContext: () => void;
}

// ============================================================================
// Global Test Context
// ============================================================================

let testContext: KeyboardTestContext = {
  inputHandlers: [],
  mockUseInput: vi.fn(),
  mockUseApp: vi.fn(),
  firedEvents: [],
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize a key to its standard representation
 */
function normalizeKey(key: string): string {
  // Handle common key aliases
  const keyAliases: Record<string, string> = {
    'enter': 'return',
    'esc': 'escape',
    'space': ' ',
    'spacebar': ' ',
  };

  const lowerKey = key.toLowerCase();
  return keyAliases[lowerKey] || key;
}

/**
 * Create an Ink-compatible key event from options
 */
function createKeyEvent(options: KeyboardEventOptions): { input: string | undefined; key: InkKeyEvent } {
  const normalizedKey = normalizeKey(options.key);
  const key: InkKeyEvent = {
    ctrl: options.ctrl || false,
    alt: options.alt || false,
    shift: options.shift || false,
    meta: options.meta || false,
  };

  // Handle special keys
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
      return { input: normalizedKey, key };
  }
}

/**
 * Create a ShortcutManager-compatible event from options
 */
function createShortcutEvent(options: KeyboardEventOptions): ShortcutEvent {
  return {
    key: normalizeKey(options.key),
    ctrl: options.ctrl || false,
    alt: options.alt || false,
    shift: options.shift || false,
    meta: options.meta || false,
  };
}

/**
 * Fire a key event to all registered handlers
 */
function fireKeyEvent(options: KeyboardEventOptions): void {
  const event = createKeyEvent(options);
  testContext.firedEvents.push(event);

  for (const handler of testContext.inputHandlers) {
    handler(event.input, event.key);
  }
}

/**
 * Fire a sequence of key events with optional delay
 */
async function fireKeySequence(events: KeyboardEventOptions[], delay = 0): Promise<void> {
  for (let i = 0; i < events.length; i++) {
    fireKeyEvent(events[i]);

    if (delay > 0 && i < events.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Get the current test context
 */
function getContext(): KeyboardTestContext {
  return testContext;
}

/**
 * Reset the test context
 */
function resetContext(): void {
  testContext = {
    inputHandlers: [],
    mockUseInput: vi.fn((handler) => {
      testContext.inputHandlers.push(handler);
    }),
    mockUseApp: vi.fn(() => ({ exit: vi.fn() })),
    firedEvents: [],
  };
}

// ============================================================================
// Global Test Helpers
// ============================================================================

const keyboardHelpers: KeyboardTestHelpers = {
  createKeyEvent,
  createShortcutEvent,
  fireKeyEvent,
  fireKeySequence,
  getContext,
  resetContext,
};

// Make helpers available globally
declare global {
  // eslint-disable-next-line no-var
  var keyboardTestHelpers: KeyboardTestHelpers;
}

globalThis.keyboardTestHelpers = keyboardHelpers;

// ============================================================================
// Global Hooks
// ============================================================================

/**
 * Global setup before all tests
 */
beforeAll(async () => {
  // Ensure we're in a test environment
  process.env.NODE_ENV = 'test';
  process.env.APEX_TEST_MODE = 'keyboard-integration';

  // Initialize fake timers for deterministic testing
  vi.useFakeTimers();
});

/**
 * Setup before each test
 */
beforeEach(() => {
  // Reset the test context for isolation
  resetContext();

  // Clear all mocks
  vi.clearAllMocks();
});

/**
 * Cleanup after each test
 */
afterEach(() => {
  // Clear all mocks
  vi.clearAllMocks();

  // Run any pending timers
  vi.runOnlyPendingTimers();
});

/**
 * Global teardown after all tests
 */
afterAll(() => {
  // Restore real timers
  vi.useRealTimers();

  // Restore all mocks
  vi.restoreAllMocks();
});

// ============================================================================
// Export for direct imports
// ============================================================================

export {
  testContext,
  createKeyEvent,
  createShortcutEvent,
  fireKeyEvent,
  fireKeySequence,
  getContext,
  resetContext,
  keyboardHelpers,
  normalizeKey,
};
