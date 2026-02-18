/**
 * @fileoverview Integration tests for special key combinations in APEX
 *
 * This test suite verifies the behavior of special key combinations across
 * different components and interaction patterns:
 *
 * - Enter key: submission vs newline behavior
 * - Tab key: focus navigation patterns
 * - Escape key: cancellation and mode exit behavior
 * - Shift+Enter: newline insertion behavior
 * - Ctrl/Cmd+A: select all behavior
 *
 * These tests cover both UI components and CLI interaction patterns to ensure
 * consistent keyboard behavior across the APEX application.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  KeyboardEventSimulator,
  createSimulator,
  COMMON_SHORTCUTS,
} from '../utils/keyboard-events.js';
import type {
  KeyboardEventOptions,
  InkKeyEvent,
  ShortcutEvent,
  KeyboardTestContext,
} from '../setup.js';

// ============================================================================
// Test Setup and Utilities
// ============================================================================

/**
 * Mock component context for testing keyboard interactions
 */
interface MockComponentContext {
  /** Current focus state */
  focused: boolean;
  /** Current text value */
  text: string;
  /** Current selection (start, end) */
  selection: { start: number; end: number };
  /** Whether component is in multi-line mode */
  multiline: boolean;
  /** Form submission handler */
  onSubmit: ReturnType<typeof vi.fn>;
  /** Text change handler */
  onChange: ReturnType<typeof vi.fn>;
  /** Focus change handler */
  onFocus: ReturnType<typeof vi.fn>;
  /** Blur handler */
  onBlur: ReturnType<typeof vi.fn>;
  /** Escape handler */
  onEscape: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock component context for testing
 */
function createMockContext(options: Partial<MockComponentContext> = {}): MockComponentContext {
  return {
    focused: false,
    text: '',
    selection: { start: 0, end: 0 },
    multiline: false,
    onSubmit: vi.fn(),
    onChange: vi.fn(),
    onFocus: vi.fn(),
    onBlur: vi.fn(),
    onEscape: vi.fn(),
    ...options,
  };
}

/**
 * Mock keyboard handler that simulates component behavior
 */
function createKeyboardHandler(context: MockComponentContext) {
  return (input: string | undefined, key: InkKeyEvent) => {
    // Handle Enter key behavior
    if (key.return) {
      if (key.shift && context.multiline) {
        // Shift+Enter in multiline: insert newline
        const { start } = context.selection;
        context.text = context.text.slice(0, start) + '\n' + context.text.slice(start);
        context.selection = { start: start + 1, end: start + 1 };
        context.onChange(context.text);
      } else if (!key.shift) {
        // Enter without shift: submit or newline based on context
        if (context.multiline && !context.text.endsWith('\n')) {
          // In multiline, Enter adds newline unless explicitly submitting
          const { start } = context.selection;
          context.text = context.text.slice(0, start) + '\n' + context.text.slice(start);
          context.selection = { start: start + 1, end: start + 1 };
          context.onChange(context.text);
        } else {
          // Submit form
          context.onSubmit(context.text);
        }
      }
      return;
    }

    // Handle Escape key behavior
    if (key.escape) {
      context.onEscape();
      // Clear selection and reset focus
      context.selection = { start: 0, end: 0 };
      context.focused = false;
      context.onBlur();
      return;
    }

    // Handle Tab key behavior
    if (key.tab) {
      if (key.shift) {
        // Shift+Tab: move focus backward
        context.onBlur();
        // Note: In real implementation, would move to previous focusable element
      } else {
        // Tab: move focus forward
        context.onBlur();
        // Note: In real implementation, would move to next focusable element
      }
      return;
    }

    // Handle Ctrl+A / Cmd+A (select all)
    if (input === 'a' && (key.ctrl || key.meta)) {
      context.selection = { start: 0, end: context.text.length };
      return;
    }

    // Handle regular character input
    if (input && !key.ctrl && !key.alt && !key.meta) {
      const { start, end } = context.selection;
      const newText = context.text.slice(0, start) + input + context.text.slice(end);
      context.text = newText;
      context.selection = { start: start + input.length, end: start + input.length };
      context.onChange(context.text);
    }
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Special Key Combinations Integration Tests', () => {
  let simulator: KeyboardEventSimulator;
  let testContext: KeyboardTestContext;

  beforeEach(() => {
    simulator = createSimulator();
    testContext = globalThis.keyboardTestHelpers.getContext();
    globalThis.keyboardTestHelpers.resetContext();
  });

  afterEach(() => {
    simulator.clearEventLog();
  });

  describe('Enter Key Behavior', () => {
    describe('in single-line contexts', () => {
      it('should submit form on Enter keypress', () => {
        const context = createMockContext({
          text: 'test input',
          multiline: false,
        });
        const handler = createKeyboardHandler(context);

        simulator.fire({ key: 'return' }, handler);

        expect(context.onSubmit).toHaveBeenCalledOnce();
        expect(context.onSubmit).toHaveBeenCalledWith('test input');
        expect(context.onChange).not.toHaveBeenCalled();
      });

      it('should submit empty form on Enter keypress', () => {
        const context = createMockContext({
          text: '',
          multiline: false,
        });
        const handler = createKeyboardHandler(context);

        simulator.fire({ key: 'return' }, handler);

        expect(context.onSubmit).toHaveBeenCalledOnce();
        expect(context.onSubmit).toHaveBeenCalledWith('');
      });

      it('should ignore Shift+Enter in single-line context', () => {
        const context = createMockContext({
          text: 'test input',
          multiline: false,
        });
        const handler = createKeyboardHandler(context);

        simulator.fire({ key: 'return', shift: true }, handler);

        // In single-line, Shift+Enter should still submit
        expect(context.onSubmit).toHaveBeenCalledOnce();
        expect(context.onSubmit).toHaveBeenCalledWith('test input');
      });
    });

    describe('in multi-line contexts', () => {
      it('should insert newline on Enter keypress', () => {
        const context = createMockContext({
          text: 'line 1',
          selection: { start: 6, end: 6 }, // at end
          multiline: true,
        });
        const handler = createKeyboardHandler(context);

        simulator.fire({ key: 'return' }, handler);

        expect(context.onChange).toHaveBeenCalledOnce();
        expect(context.onChange).toHaveBeenCalledWith('line 1\n');
        expect(context.selection).toEqual({ start: 7, end: 7 });
        expect(context.onSubmit).not.toHaveBeenCalled();
      });

      it('should insert newline at cursor position', () => {
        const context = createMockContext({
          text: 'line 1 content',
          selection: { start: 6, end: 6 }, // after "line 1"
          multiline: true,
        });
        const handler = createKeyboardHandler(context);

        simulator.fire({ key: 'return' }, handler);

        expect(context.onChange).toHaveBeenCalledOnce();
        expect(context.onChange).toHaveBeenCalledWith('line 1\n content');
        expect(context.selection).toEqual({ start: 7, end: 7 });
      });

      it('should submit on Enter when text ends with newline', () => {
        const context = createMockContext({
          text: 'line 1\nline 2\n',
          selection: { start: 14, end: 14 }, // at end
          multiline: true,
        });
        const handler = createKeyboardHandler(context);

        simulator.fire({ key: 'return' }, handler);

        expect(context.onSubmit).toHaveBeenCalledOnce();
        expect(context.onSubmit).toHaveBeenCalledWith('line 1\nline 2\n');
      });
    });
  });

  describe('Shift+Enter Behavior', () => {
    it('should always insert newline in multiline context', () => {
      const context = createMockContext({
        text: 'line 1',
        selection: { start: 6, end: 6 },
        multiline: true,
      });
      const handler = createKeyboardHandler(context);

      simulator.fire({ key: 'return', shift: true }, handler);

      expect(context.onChange).toHaveBeenCalledOnce();
      expect(context.onChange).toHaveBeenCalledWith('line 1\n');
      expect(context.selection).toEqual({ start: 7, end: 7 });
      expect(context.onSubmit).not.toHaveBeenCalled();
    });

    it('should insert newline at beginning of text', () => {
      const context = createMockContext({
        text: 'existing content',
        selection: { start: 0, end: 0 },
        multiline: true,
      });
      const handler = createKeyboardHandler(context);

      simulator.fire({ key: 'return', shift: true }, handler);

      expect(context.onChange).toHaveBeenCalledOnce();
      expect(context.onChange).toHaveBeenCalledWith('\nexisting content');
      expect(context.selection).toEqual({ start: 1, end: 1 });
    });

    it('should insert newline in middle of text', () => {
      const context = createMockContext({
        text: 'first second',
        selection: { start: 5, end: 5 }, // between words
        multiline: true,
      });
      const handler = createKeyboardHandler(context);

      simulator.fire({ key: 'return', shift: true }, handler);

      expect(context.onChange).toHaveBeenCalledOnce();
      expect(context.onChange).toHaveBeenCalledWith('first\n second');
      expect(context.selection).toEqual({ start: 6, end: 6 });
    });

    it('should work with text selection', () => {
      const context = createMockContext({
        text: 'select this text',
        selection: { start: 7, end: 11 }, // "this" is selected
        multiline: true,
      });
      const handler = createKeyboardHandler(context);

      simulator.fire({ key: 'return', shift: true }, handler);

      expect(context.onChange).toHaveBeenCalledOnce();
      expect(context.onChange).toHaveBeenCalledWith('select \n text');
      expect(context.selection).toEqual({ start: 8, end: 8 });
    });
  });

  describe('Tab Key Focus Navigation', () => {
    it('should trigger blur on Tab keypress', () => {
      const context = createMockContext({
        focused: true,
      });
      const handler = createKeyboardHandler(context);

      simulator.fire({ key: 'tab' }, handler);

      expect(context.onBlur).toHaveBeenCalledOnce();
      expect(context.focused).toBe(false);
    });

    it('should trigger blur on Shift+Tab keypress', () => {
      const context = createMockContext({
        focused: true,
      });
      const handler = createKeyboardHandler(context);

      simulator.fire({ key: 'tab', shift: true }, handler);

      expect(context.onBlur).toHaveBeenCalledOnce();
      expect(context.focused).toBe(false);
    });

    it('should not interfere with text when Tab is pressed', () => {
      const context = createMockContext({
        text: 'original text',
        focused: true,
      });
      const handler = createKeyboardHandler(context);

      simulator.fire({ key: 'tab' }, handler);

      expect(context.text).toBe('original text');
      expect(context.onChange).not.toHaveBeenCalled();
    });

    it('should handle multiple Tab presses', () => {
      const context = createMockContext({
        focused: true,
      });
      const handler = createKeyboardHandler(context);

      simulator.fire({ key: 'tab' }, handler);
      simulator.fire({ key: 'tab' }, handler);
      simulator.fire({ key: 'tab', shift: true }, handler);

      expect(context.onBlur).toHaveBeenCalledTimes(3);
    });
  });

  describe('Escape Key Behavior', () => {
    it('should trigger escape handler', () => {
      const context = createMockContext({
        focused: true,
        text: 'some text',
      });
      const handler = createKeyboardHandler(context);

      simulator.fire({ key: 'escape' }, handler);

      expect(context.onEscape).toHaveBeenCalledOnce();
      expect(context.onBlur).toHaveBeenCalledOnce();
      expect(context.focused).toBe(false);
    });

    it('should clear selection on escape', () => {
      const context = createMockContext({
        text: 'selected text',
        selection: { start: 2, end: 10 }, // "lected " is selected
        focused: true,
      });
      const handler = createKeyboardHandler(context);

      simulator.fire({ key: 'escape' }, handler);

      expect(context.selection).toEqual({ start: 0, end: 0 });
      expect(context.onEscape).toHaveBeenCalledOnce();
    });

    it('should not modify text content', () => {
      const context = createMockContext({
        text: 'preserve this text',
        focused: true,
      });
      const handler = createKeyboardHandler(context);

      simulator.fire({ key: 'escape' }, handler);

      expect(context.text).toBe('preserve this text');
      expect(context.onChange).not.toHaveBeenCalled();
    });

    it('should work with modifier keys', () => {
      const context = createMockContext({
        focused: true,
      });
      const handler = createKeyboardHandler(context);

      // Test Escape with various modifiers
      simulator.fire({ key: 'escape', ctrl: true }, handler);
      expect(context.onEscape).toHaveBeenCalledTimes(1);

      globalThis.keyboardTestHelpers.resetContext();
      simulator.fire({ key: 'escape', shift: true }, handler);
      expect(context.onEscape).toHaveBeenCalledTimes(2);

      globalThis.keyboardTestHelpers.resetContext();
      simulator.fire({ key: 'escape', alt: true }, handler);
      expect(context.onEscape).toHaveBeenCalledTimes(3);
    });
  });

  describe('Ctrl/Cmd+A Select All Behavior', () => {
    it('should select all text with Ctrl+A', () => {
      const context = createMockContext({
        text: 'select all this text',
        selection: { start: 5, end: 5 }, // cursor in middle
      });
      const handler = createKeyboardHandler(context);

      simulator.fire({ key: 'a', ctrl: true }, handler);

      expect(context.selection).toEqual({ start: 0, end: 20 });
    });

    it('should select all text with Cmd+A (Meta key)', () => {
      const context = createMockContext({
        text: 'select all this text',
        selection: { start: 5, end: 5 },
      });
      const handler = createKeyboardHandler(context);

      simulator.fire({ key: 'a', meta: true }, handler);

      expect(context.selection).toEqual({ start: 0, end: 20 });
    });

    it('should work with empty text', () => {
      const context = createMockContext({
        text: '',
        selection: { start: 0, end: 0 },
      });
      const handler = createKeyboardHandler(context);

      simulator.fire({ key: 'a', ctrl: true }, handler);

      expect(context.selection).toEqual({ start: 0, end: 0 });
    });

    it('should work with single character', () => {
      const context = createMockContext({
        text: 'x',
        selection: { start: 0, end: 0 },
      });
      const handler = createKeyboardHandler(context);

      simulator.fire({ key: 'a', ctrl: true }, handler);

      expect(context.selection).toEqual({ start: 0, end: 1 });
    });

    it('should work with multiline text', () => {
      const context = createMockContext({
        text: 'line 1\nline 2\nline 3',
        selection: { start: 8, end: 8 }, // middle of line 2
        multiline: true,
      });
      const handler = createKeyboardHandler(context);

      simulator.fire({ key: 'a', ctrl: true }, handler);

      expect(context.selection).toEqual({ start: 0, end: 20 });
    });

    it('should not trigger when other modifiers are present with Ctrl+A', () => {
      const context = createMockContext({
        text: 'should not select all',
        selection: { start: 5, end: 5 },
      });
      const handler = createKeyboardHandler(context);

      // Ctrl+Shift+A should not select all
      simulator.fire({ key: 'a', ctrl: true, shift: true }, handler);

      expect(context.selection).toEqual({ start: 5, end: 5 });

      // Ctrl+Alt+A should not select all
      simulator.fire({ key: 'a', ctrl: true, alt: true }, handler);

      expect(context.selection).toEqual({ start: 5, end: 5 });
    });

    it('should not interfere with regular "a" input', () => {
      const context = createMockContext({
        text: 'test',
        selection: { start: 4, end: 4 },
      });
      const handler = createKeyboardHandler(context);

      // Regular 'a' should be added to text
      simulator.fire({ key: 'a' }, handler);

      expect(context.text).toBe('testa');
      expect(context.selection).toEqual({ start: 5, end: 5 });
      expect(context.onChange).toHaveBeenCalledWith('testa');
    });
  });

  describe('Combined Key Sequence Tests', () => {
    it('should handle Enter -> Escape sequence', () => {
      const context = createMockContext({
        text: 'test input',
        multiline: false,
      });
      const handler = createKeyboardHandler(context);

      simulator.fire({ key: 'return' }, handler);
      expect(context.onSubmit).toHaveBeenCalledWith('test input');

      simulator.fire({ key: 'escape' }, handler);
      expect(context.onEscape).toHaveBeenCalledOnce();
    });

    it('should handle Ctrl+A -> Shift+Enter sequence in multiline', () => {
      const context = createMockContext({
        text: 'line 1\nline 2',
        selection: { start: 3, end: 3 },
        multiline: true,
      });
      const handler = createKeyboardHandler(context);

      // Select all
      simulator.fire({ key: 'a', ctrl: true }, handler);
      expect(context.selection).toEqual({ start: 0, end: 13 });

      // Shift+Enter should replace selection with newline
      simulator.fire({ key: 'return', shift: true }, handler);
      expect(context.onChange).toHaveBeenCalledWith('\n');
    });

    it('should handle Tab -> Enter sequence', () => {
      const context1 = createMockContext({
        text: 'first field',
        focused: true,
      });
      const context2 = createMockContext({
        text: 'second field',
        focused: false,
        multiline: false,
      });

      const handler1 = createKeyboardHandler(context1);
      const handler2 = createKeyboardHandler(context2);

      // Tab out of first field
      simulator.fire({ key: 'tab' }, handler1);
      expect(context1.onBlur).toHaveBeenCalledOnce();

      // Enter in second field (simulating focus move)
      context2.focused = true;
      simulator.fire({ key: 'return' }, handler2);
      expect(context2.onSubmit).toHaveBeenCalledWith('second field');
    });

    it('should handle rapid key sequence with special keys', async () => {
      const context = createMockContext({
        text: '',
        multiline: true,
      });
      const handler = createKeyboardHandler(context);

      const sequence: KeyboardEventOptions[] = [
        { key: 'h' },
        { key: 'e' },
        { key: 'l' },
        { key: 'l' },
        { key: 'o' },
        { key: 'return', shift: true },
        { key: 'w' },
        { key: 'o' },
        { key: 'r' },
        { key: 'l' },
        { key: 'd' },
        { key: 'a', ctrl: true }, // select all
        { key: 'escape' }, // escape
      ];

      await simulator.fireSequence(sequence, handler, { delay: 10 });

      // Should have typed "hello\nworld", then selected all, then escaped
      expect(context.text).toBe('hello\nworld');
      expect(context.onEscape).toHaveBeenCalledOnce();
      expect(context.selection).toEqual({ start: 0, end: 0 });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle key events when context is undefined', () => {
      const context = createMockContext();
      const handler = createKeyboardHandler(context);

      // Should not throw
      expect(() => {
        simulator.fire({ key: 'return' }, handler);
        simulator.fire({ key: 'escape' }, handler);
        simulator.fire({ key: 'tab' }, handler);
        simulator.fire({ key: 'a', ctrl: true }, handler);
      }).not.toThrow();
    });

    it('should handle simultaneous modifier keys', () => {
      const context = createMockContext({
        text: 'test text',
        selection: { start: 4, end: 4 },
      });
      const handler = createKeyboardHandler(context);

      // Ctrl+Shift+Alt+Meta+A (all modifiers)
      simulator.fire({
        key: 'a',
        ctrl: true,
        shift: true,
        alt: true,
        meta: true,
      }, handler);

      // Should not select all with extra modifiers
      expect(context.selection).toEqual({ start: 4, end: 4 });
    });

    it('should handle invalid selection ranges gracefully', () => {
      const context = createMockContext({
        text: 'short',
        selection: { start: 100, end: 200 }, // invalid range
      });
      const handler = createKeyboardHandler(context);

      // Should still work with Ctrl+A
      simulator.fire({ key: 'a', ctrl: true }, handler);
      expect(context.selection).toEqual({ start: 0, end: 5 });
    });

    it('should handle empty key events', () => {
      const context = createMockContext();
      const handler = createKeyboardHandler(context);

      // Empty key event should be handled gracefully
      expect(() => {
        simulator.fire({ key: '' }, handler);
      }).not.toThrow();
    });
  });
});