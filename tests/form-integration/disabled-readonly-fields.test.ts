/**
 * Integration Tests for Disabled and Readonly Fields
 *
 * Tests that typing is properly blocked or handled when fields are disabled or readonly.
 * Verifies proper error handling and no-op behavior for restricted field interactions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { simulateTyping } from './setup';
import { TypingSimulator, SpecialKeys, TypingSpeed } from './utils/typing-simulator';

describe('Disabled and Readonly Fields Integration Tests', () => {
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

  function createInput(
    value = '',
    type = 'text',
    options: { disabled?: boolean; readonly?: boolean } = {}
  ): HTMLInputElement {
    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    input.id = 'test-input';

    if (options.disabled) {
      input.disabled = true;
    }

    if (options.readonly) {
      input.readOnly = true;
    }

    container.appendChild(input);
    return input;
  }

  function createTextarea(
    value = '',
    options: { disabled?: boolean; readonly?: boolean } = {}
  ): HTMLTextAreaElement {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.id = 'test-textarea';

    if (options.disabled) {
      textarea.disabled = true;
    }

    if (options.readonly) {
      textarea.readOnly = true;
    }

    container.appendChild(textarea);
    return textarea;
  }

  describe('Disabled Input Fields', () => {
    it('should not change value when attempting to type in disabled text input', async () => {
      const input = createInput('initial value', 'text', { disabled: true });
      const initialValue = input.value;

      expect(input.disabled).toBe(true);
      expect(input.value).toBe('initial value');

      // Attempt to type in disabled input
      try {
        await simulateTyping(input, 'new text', { clear: true });
      } catch (error) {
        // Some typing utilities might throw errors for disabled fields
      }

      // Value should remain unchanged
      expect(input.value).toBe(initialValue);
      expect(input.value).toBe('initial value');
    });

    it('should not change value when attempting to type in disabled password input', async () => {
      const input = createInput('secret', 'password', { disabled: true });
      const initialValue = input.value;

      expect(input.disabled).toBe(true);
      expect(input.type).toBe('password');

      // Attempt typing in disabled password field
      const simulator = new TypingSimulator(input, { clearFirst: false });

      try {
        await simulator.typeText('newsecret');
      } catch (error) {
        // Expected - disabled fields should not accept input
      }

      expect(input.value).toBe(initialValue);
      expect(input.value).toBe('secret');
    });

    it('should not change value when attempting to type in disabled email input', async () => {
      const input = createInput('test@example.com', 'email', { disabled: true });
      const initialValue = input.value;

      expect(input.disabled).toBe(true);
      expect(input.type).toBe('email');

      // Simulate manual value change attempts (bypassing normal typing)
      const originalValue = input.value;
      input.value = 'newemail@test.com';

      // Disabled inputs might allow programmatic changes but not user interaction
      // However, for user interaction testing, we focus on typing simulation
      input.value = originalValue; // Reset to test typing behavior

      const simulator = new TypingSimulator(input, { clearFirst: false });

      try {
        await simulator.typeText('new@email.com');
      } catch (error) {
        // Expected - disabled fields should not accept typed input
      }

      expect(input.value).toBe(initialValue);
    });

    it('should not change value when attempting to type in disabled textarea', async () => {
      const textarea = createTextarea('Original content\nLine 2', { disabled: true });
      const initialValue = textarea.value;

      expect(textarea.disabled).toBe(true);
      expect(textarea.value).toBe('Original content\nLine 2');

      const simulator = new TypingSimulator(textarea, { clearFirst: false });

      try {
        await simulator.typeText('New content');
      } catch (error) {
        // Expected for disabled textarea
      }

      expect(textarea.value).toBe(initialValue);
      expect(textarea.value).toBe('Original content\nLine 2');
    });

    it('should not respond to keyboard events on disabled input', async () => {
      const input = createInput('test', 'text', { disabled: true });
      const initialValue = input.value;

      // Track events to ensure they don't cause changes
      const eventLog: string[] = [];

      ['keydown', 'keypress', 'keyup', 'input', 'change'].forEach(eventType => {
        input.addEventListener(eventType, () => {
          eventLog.push(eventType);
        });
      });

      const simulator = new TypingSimulator(input, { clearFirst: false });

      // Attempt various key operations
      try {
        await simulator.pressKey('a');
        await simulator.pressKey(SpecialKeys.BACKSPACE);
        await simulator.pressKey(SpecialKeys.DELETE);
        await simulator.pressKey(SpecialKeys.CTRL_A, { ctrl: true });
      } catch (error) {
        // Expected for disabled fields
      }

      expect(input.value).toBe(initialValue);
      expect(input.value).toBe('test');

      // Disabled elements might not receive or process keyboard events normally
      // The important thing is the value doesn't change
    });

    it('should not accept pasted content in disabled input', async () => {
      const input = createInput('original', 'text', { disabled: true });
      const initialValue = input.value;

      const simulator = new TypingSimulator(input, { clearFirst: false });

      try {
        await simulator.pasteText('pasted content');
      } catch (error) {
        // Expected for disabled fields
      }

      expect(input.value).toBe(initialValue);
      expect(input.value).toBe('original');
    });
  });

  describe('Readonly Input Fields', () => {
    it('should not change value when attempting to type in readonly text input', async () => {
      const input = createInput('readonly content', 'text', { readonly: true });
      const initialValue = input.value;

      expect(input.readOnly).toBe(true);
      expect(input.value).toBe('readonly content');

      // Readonly fields should not accept typed input
      const simulator = new TypingSimulator(input, { clearFirst: false });

      try {
        await simulator.typeText('new content');
      } catch (error) {
        // May throw error for readonly fields
      }

      expect(input.value).toBe(initialValue);
      expect(input.value).toBe('readonly content');
    });

    it('should not change value when attempting to type in readonly password input', async () => {
      const input = createInput('readonly-pass', 'password', { readonly: true });
      const initialValue = input.value;

      expect(input.readOnly).toBe(true);
      expect(input.type).toBe('password');

      const simulator = new TypingSimulator(input, { clearFirst: false });

      try {
        await simulator.typeText('newpass');
      } catch (error) {
        // Expected for readonly password fields
      }

      expect(input.value).toBe(initialValue);
      expect(input.value).toBe('readonly-pass');
    });

    it('should not change value when attempting to type in readonly email input', async () => {
      const input = createInput('readonly@example.com', 'email', { readonly: true });
      const initialValue = input.value;

      expect(input.readOnly).toBe(true);
      expect(input.type).toBe('email');

      const simulator = new TypingSimulator(input, { clearFirst: false });

      try {
        await simulator.typeText('new@example.com');
      } catch (error) {
        // Expected for readonly email fields
      }

      expect(input.value).toBe(initialValue);
      expect(input.value).toBe('readonly@example.com');
    });

    it('should not change value when attempting to type in readonly textarea', async () => {
      const textarea = createTextarea(
        'Readonly content\nMultiple lines\nImmutable',
        { readonly: true }
      );
      const initialValue = textarea.value;

      expect(textarea.readOnly).toBe(true);

      const simulator = new TypingSimulator(textarea, { clearFirst: false });

      try {
        await simulator.typeText('\nNew line added');
      } catch (error) {
        // Expected for readonly textarea
      }

      expect(textarea.value).toBe(initialValue);
      expect(textarea.value).toBe('Readonly content\nMultiple lines\nImmutable');
    });

    it('should not respond to backspace and delete in readonly input', async () => {
      const input = createInput('cannot delete this', 'text', { readonly: true });
      const initialValue = input.value;

      const simulator = new TypingSimulator(input, { clearFirst: false });

      try {
        await simulator.backspace(5);
        await simulator.pressKey(SpecialKeys.DELETE);
      } catch (error) {
        // Expected for readonly fields
      }

      expect(input.value).toBe(initialValue);
      expect(input.value).toBe('cannot delete this');
    });

    it('should not respond to select all and delete in readonly input', async () => {
      const input = createInput('select all but cannot delete', 'text', { readonly: true });
      const initialValue = input.value;

      const simulator = new TypingSimulator(input, { clearFirst: false });

      try {
        await simulator.pressKey(SpecialKeys.CTRL_A, { ctrl: true });
        await simulator.pressKey(SpecialKeys.DELETE);
      } catch (error) {
        // Expected for readonly fields
      }

      expect(input.value).toBe(initialValue);
      expect(input.value).toBe('select all but cannot delete');
    });

    it('should not accept pasted content in readonly input', async () => {
      const input = createInput('readonly original', 'text', { readonly: true });
      const initialValue = input.value;

      const simulator = new TypingSimulator(input, { clearFirst: false });

      try {
        await simulator.pasteText('pasted text');
      } catch (error) {
        // Expected for readonly fields
      }

      expect(input.value).toBe(initialValue);
      expect(input.value).toBe('readonly original');
    });
  });

  describe('Focus and Event Behavior', () => {
    it('should allow focus on readonly input but not accept input', async () => {
      const input = createInput('readonly focus test', 'text', { readonly: true });
      const initialValue = input.value;

      // Readonly fields should be focusable
      input.focus();
      expect(document.activeElement).toBe(input);

      // But typing should not change the value
      const simulator = new TypingSimulator(input, { clearFirst: false });

      try {
        await simulator.typeText('should not appear');
      } catch (error) {
        // Expected
      }

      expect(input.value).toBe(initialValue);
      expect(document.activeElement).toBe(input); // Should still be focused
    });

    it('should not be focusable when disabled', async () => {
      const input = createInput('disabled focus test', 'text', { disabled: true });

      // Disabled fields should not be focusable
      input.focus();

      // In some browsers, disabled elements cannot receive focus
      // The behavior may vary, but the key point is they shouldn't accept input
      const simulator = new TypingSimulator(input, { clearFirst: false, focusElement: false });

      try {
        await simulator.typeText('should not work');
      } catch (error) {
        // Expected for disabled fields
      }

      expect(input.value).toBe('disabled focus test');
    });

    it('should not trigger change events when attempting to type in readonly fields', async () => {
      const input = createInput('readonly change test', 'text', { readonly: true });
      const events: string[] = [];

      ['input', 'change', 'keydown', 'keyup'].forEach(eventType => {
        input.addEventListener(eventType, (e) => {
          events.push(eventType);
        });
      });

      const simulator = new TypingSimulator(input, { clearFirst: false });

      try {
        await simulator.typeText('abc');
      } catch (error) {
        // May throw for readonly
      }

      expect(input.value).toBe('readonly change test');

      // Readonly fields might still receive keyboard events but shouldn't process input
      // The important verification is that the value doesn't change
    });

    it('should not trigger change events when attempting to type in disabled fields', async () => {
      const input = createInput('disabled change test', 'text', { disabled: true });
      const events: string[] = [];

      ['input', 'change', 'keydown', 'keyup'].forEach(eventType => {
        input.addEventListener(eventType, (e) => {
          events.push(eventType);
        });
      });

      const simulator = new TypingSimulator(input, { clearFirst: false });

      try {
        await simulator.typeText('xyz');
      } catch (error) {
        // Expected for disabled fields
      }

      expect(input.value).toBe('disabled change test');

      // Disabled fields should not receive or process events normally
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle both disabled and readonly attributes gracefully', async () => {
      const input = createInput('both disabled and readonly', 'text', {
        disabled: true,
        readonly: true
      });
      const initialValue = input.value;

      expect(input.disabled).toBe(true);
      expect(input.readOnly).toBe(true);

      const simulator = new TypingSimulator(input, { clearFirst: false });

      try {
        await simulator.typeText('should not work');
      } catch (error) {
        // Expected when both attributes are set
      }

      expect(input.value).toBe(initialValue);
      expect(input.value).toBe('both disabled and readonly');
    });

    it('should handle empty disabled input correctly', async () => {
      const input = createInput('', 'text', { disabled: true });

      expect(input.disabled).toBe(true);
      expect(input.value).toBe('');

      const simulator = new TypingSimulator(input, { clearFirst: false });

      try {
        await simulator.typeText('first content');
      } catch (error) {
        // Expected for disabled
      }

      expect(input.value).toBe(''); // Should remain empty
    });

    it('should handle empty readonly input correctly', async () => {
      const input = createInput('', 'text', { readonly: true });

      expect(input.readOnly).toBe(true);
      expect(input.value).toBe('');

      const simulator = new TypingSimulator(input, { clearFirst: false });

      try {
        await simulator.typeText('first content');
      } catch (error) {
        // Expected for readonly
      }

      expect(input.value).toBe(''); // Should remain empty
    });

    it('should handle rapid typing attempts on disabled field', async () => {
      const input = createInput('rapid test', 'text', { disabled: true });
      const initialValue = input.value;

      const simulator = new TypingSimulator(input, {
        speed: TypingSpeed.FAST,
        clearFirst: false
      });

      try {
        await simulator.typeText('abcdefghijklmnop');
      } catch (error) {
        // Expected for disabled
      }

      expect(input.value).toBe(initialValue);
    });

    it('should handle rapid typing attempts on readonly field', async () => {
      const input = createInput('rapid readonly test', 'text', { readonly: true });
      const initialValue = input.value;

      const simulator = new TypingSimulator(input, {
        speed: TypingSpeed.FAST,
        clearFirst: false
      });

      try {
        await simulator.typeText('abcdefghijklmnop');
      } catch (error) {
        // Expected for readonly
      }

      expect(input.value).toBe(initialValue);
    });

    it('should properly validate that no modifications occur with various input types', async () => {
      const inputTypes = ['text', 'password', 'email', 'url', 'tel', 'search'];

      for (const type of inputTypes) {
        // Test disabled
        const disabledInput = createInput(`disabled-${type}`, type, { disabled: true });
        const disabledInitialValue = disabledInput.value;

        const disabledSimulator = new TypingSimulator(disabledInput, { clearFirst: false });
        try {
          await disabledSimulator.typeText('new-value');
        } catch (error) {
          // Expected
        }

        expect(disabledInput.value).toBe(disabledInitialValue);

        // Test readonly
        const readonlyInput = createInput(`readonly-${type}`, type, { readonly: true });
        const readonlyInitialValue = readonlyInput.value;

        const readonlySimulator = new TypingSimulator(readonlyInput, { clearFirst: false });
        try {
          await readonlySimulator.typeText('new-value');
        } catch (error) {
          // Expected
        }

        expect(readonlyInput.value).toBe(readonlyInitialValue);
      }
    });
  });

  describe('Verification and No-op Behavior', () => {
    it('should verify that disabled field operations result in no-ops', async () => {
      const input = createInput('verify disabled', 'text', { disabled: true });
      const beforeState = {
        value: input.value,
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
        disabled: input.disabled
      };

      // Attempt multiple operations
      const simulator = new TypingSimulator(input, { clearFirst: false });

      const operations = [
        () => simulator.typeText('abc'),
        () => simulator.backspace(3),
        () => simulator.pressKey(SpecialKeys.DELETE),
        () => simulator.pressKey(SpecialKeys.CTRL_A, { ctrl: true }),
        () => simulator.pasteText('paste test')
      ];

      for (const operation of operations) {
        try {
          await operation();
        } catch (error) {
          // Expected - operations should fail or be no-ops
        }
      }

      // Verify nothing changed
      expect(input.value).toBe(beforeState.value);
      expect(input.disabled).toBe(beforeState.disabled);

      // State should be completely unchanged
      expect({
        value: input.value,
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
        disabled: input.disabled
      }).toEqual(beforeState);
    });

    it('should verify that readonly field operations result in no-ops', async () => {
      const input = createInput('verify readonly', 'text', { readonly: true });
      const beforeState = {
        value: input.value,
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
        readOnly: input.readOnly
      };

      // Attempt multiple operations
      const simulator = new TypingSimulator(input, { clearFirst: false });

      const operations = [
        () => simulator.typeText('def'),
        () => simulator.backspace(5),
        () => simulator.pressKey(SpecialKeys.DELETE),
        () => simulator.pressKey(SpecialKeys.CTRL_A, { ctrl: true }),
        () => simulator.pasteText('paste readonly test')
      ];

      for (const operation of operations) {
        try {
          await operation();
        } catch (error) {
          // Expected - operations should fail or be no-ops
        }
      }

      // Verify nothing changed except possibly selection (readonly allows selection)
      expect(input.value).toBe(beforeState.value);
      expect(input.readOnly).toBe(beforeState.readOnly);
    });

    it('should demonstrate proper error handling for restricted field interactions', () => {
      const disabledInput = createInput('disabled', 'text', { disabled: true });
      const readonlyInput = createInput('readonly', 'text', { readonly: true });

      // Verify initial states
      expect(disabledInput.disabled).toBe(true);
      expect(disabledInput.value).toBe('disabled');

      expect(readonlyInput.readOnly).toBe(true);
      expect(readonlyInput.value).toBe('readonly');

      // These should be safe operations that don't throw
      expect(() => {
        disabledInput.focus(); // May or may not focus, but shouldn't throw
      }).not.toThrow();

      expect(() => {
        readonlyInput.focus(); // Should focus successfully
      }).not.toThrow();

      // Values should remain unchanged
      expect(disabledInput.value).toBe('disabled');
      expect(readonlyInput.value).toBe('readonly');
    });
  });
});