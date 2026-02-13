/**
 * Integration Tests for Text Clearing and Replacement
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { simulateTyping } from './setup';
import { TypingSimulator, SpecialKeys } from './utils/typing-simulator';

describe('Text Clearing and Replacement Tests', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container.parentNode) {
      document.body.removeChild(container);
    }
    vi.clearAllMocks();
  });

  function createInput(value = '', type = 'text'): HTMLInputElement {
    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    input.id = 'test-input';
    container.appendChild(input);
    return input;
  }

  function createTextarea(value = ''): HTMLTextAreaElement {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.id = 'test-textarea';
    container.appendChild(textarea);
    return textarea;
  }

  describe('Clear Existing Content Then Type New Text', () => {
    it('should clear existing text and replace with new text', async () => {
      const input = createInput('old text');
      expect(input.value).toBe('old text');

      await simulateTyping(input, 'new text', { clear: true });

      expect(input.value).toBe('new text');
      expect(input.value).not.toContain('old text');
    });

    it('should clear existing email and type new email', async () => {
      const input = createInput('old@test.com', 'email');
      expect(input.value).toBe('old@test.com');

      await simulateTyping(input, 'new@test.com', { clear: true });

      expect(input.value).toBe('new@test.com');
      expect(input.checkValidity()).toBe(true);
    });

    it('should clear existing password and type new password', async () => {
      const input = createInput('oldpass', 'password');
      expect(input.value).toBe('oldpass');

      await simulateTyping(input, 'newpass', { clear: true });

      expect(input.value).toBe('newpass');
      expect(input.type).toBe('password');
    });

    it('should clear multiline textarea content', async () => {
      const textarea = createTextarea('Line 1\nLine 2\nLine 3');
      expect(textarea.value).toBe('Line 1\nLine 2\nLine 3');

      await simulateTyping(textarea, 'New line 1\nNew line 2', { clear: true });

      expect(textarea.value).toBe('New line 1\nNew line 2');
      expect(textarea.value).not.toContain('Line 1');
    });

    it('should track value changes during clear and replace', async () => {
      const input = createInput('track changes');
      const changes: string[] = [];

      input.addEventListener('input', () => {
        changes.push(input.value);
      });

      await simulateTyping(input, 'ABC', { delay: 10, clear: true });

      expect(changes).toContain('A');
      expect(changes).toContain('AB');
      expect(changes).toContain('ABC');
      expect(input.value).toBe('ABC');
    });
  });

  describe('Select All and Replace Text', () => {
    it('should select all text with Ctrl+A and replace', async () => {
      const input = createInput('select all this');
      input.focus();

      const simulator = new TypingSimulator(input, { clearFirst: false });
      await simulator.pressKey(SpecialKeys.CTRL_A, { ctrl: true });

      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe('select all this'.length);

      await simulator.typeText('replaced text');

      expect(input.value).toBe('replaced text');
      expect(input.value).not.toContain('select all this');
    });

    it('should select all in textarea and replace', async () => {
      const textarea = createTextarea('First line\nSecond line');
      textarea.focus();

      const simulator = new TypingSimulator(textarea, { clearFirst: false });
      await simulator.pressKey(SpecialKeys.CTRL_A, { ctrl: true });

      expect(textarea.selectionStart).toBe(0);
      expect(textarea.selectionEnd).toBe('First line\nSecond line'.length);

      await simulator.typeText('New content');

      expect(textarea.value).toBe('New content');
      expect(textarea.value).not.toContain('First line');
    });

    it('should handle partial selection replacement', async () => {
      const input = createInput('keep this, replace that');
      input.focus();

      // Select "replace" portion (characters 11-18)
      input.setSelectionRange(11, 18);
      expect(input.value.substring(11, 18)).toBe('replace');

      const simulator = new TypingSimulator(input, { clearFirst: false });
      await simulator.typeText('update');

      expect(input.value).toBe('keep this, update that');
      expect(input.value).toContain('keep this');
      expect(input.value).toContain('that');
    });
  });

  describe('Backspace Character-by-Character Clearing', () => {
    it('should clear text character by character using backspace', async () => {
      const input = createInput('clear slowly');
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);

      const changes: string[] = [];
      input.addEventListener('input', () => {
        changes.push(input.value);
      });

      const simulator = new TypingSimulator(input, { clearFirst: false });

      for (let i = 0; i < 'clear slowly'.length; i++) {
        await simulator.backspace(1);
        await simulator.wait(20);
      }

      expect(input.value).toBe('');
      expect(changes.length).toBe('clear slowly'.length);
      expect(changes[0]).toBe('clear slowl');
      expect(changes[changes.length - 1]).toBe('');
    });

    it('should clear multiline textarea with backspace', async () => {
      const textarea = createTextarea('Line A\nLine B');
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);

      const simulator = new TypingSimulator(textarea, { clearFirst: false });

      for (let i = 0; i < textarea.value.length; i++) {
        await simulator.backspace(1);
      }

      expect(textarea.value).toBe('');
    });

    it('should clear text then type replacement', async () => {
      const input = createInput('old content');
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);

      const simulator = new TypingSimulator(input, { clearFirst: false });

      // Clear all characters
      for (let i = 0; i < 'old content'.length; i++) {
        await simulator.backspace(1);
      }

      expect(input.value).toBe('');

      // Type new content
      await simulator.typeText('new content');

      expect(input.value).toBe('new content');
    });
  });

  describe('Edge Cases and Validation', () => {
    it('should handle empty input gracefully', async () => {
      const input = createInput('');

      await simulateTyping(input, 'hello', { clear: true });

      expect(input.value).toBe('hello');

      const simulator = new TypingSimulator(input, { clearFirst: false });
      await simulator.backspace(10); // More backspaces than characters

      expect(input.value).toBe(''); // Should remain empty without error
    });

    it('should maintain focus during operations', async () => {
      const input1 = createInput('first');
      const input2 = createInput('second');

      input1.focus();
      expect(document.activeElement).toBe(input1);

      const simulator = new TypingSimulator(input1, { focusElement: true });
      await simulator.typeText('updated first');

      expect(document.activeElement).toBe(input1);
      expect(input1.value).toBe('updated first');
      expect(input2.value).toBe('second'); // Unchanged
    });

    it('should trigger proper events during clearing', async () => {
      const input = createInput('test content');
      const events: string[] = [];

      ['input', 'change', 'focus', 'blur'].forEach(eventType => {
        input.addEventListener(eventType, () => {
          events.push(eventType);
        });
      });

      input.focus();

      const simulator = new TypingSimulator(input, {
        clearFirst: true,
        triggerValidation: true,
        blurAfter: true
      });

      await simulator.typeText('new content');

      expect(events).toContain('focus');
      expect(events).toContain('input');
      expect(events).toContain('change');
    });

    it('should handle validation during replacement', async () => {
      const input = createInput('abc123');
      input.required = true;
      input.pattern = '[0-9]+'; // Numbers only

      expect(input.checkValidity()).toBe(false); // Initial invalid

      await simulateTyping(input, '789', { clear: true });

      expect(input.value).toBe('789');
      expect(input.checkValidity()).toBe(true); // Now valid

      await simulateTyping(input, '', { clear: true });

      expect(input.value).toBe('');
      expect(input.checkValidity()).toBe(false); // Invalid - required and empty
    });
  });
});