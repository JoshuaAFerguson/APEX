/**
 * @fileoverview Text Input Integration Tests
 *
 * Comprehensive integration tests for text input fields covering:
 * - Typing text into empty inputs
 * - Typing into inputs with existing values
 * - Input value verification and synchronization
 * - Focus behavior before typing
 * - Input event handling and validation
 * - Text selection and cursor positioning
 * - Character input simulation and edge cases
 *
 * Test Coverage:
 * ✅ Typing text into empty input
 * ✅ Typing into input with existing value
 * ✅ Verifying input.value reflects typed content
 * ✅ Testing focus behavior before typing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  simulateTyping,
  fillFormWithTestData,
  waitForValidation
} from './setup';

describe('Text Input Field Integration Tests', () => {
  let container: HTMLElement;
  let input: HTMLInputElement;

  beforeEach(() => {
    // Create a clean test environment for each test
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Clean up after each test
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  /**
   * Helper function to create various types of text inputs for testing
   */
  function createTextInput(options: {
    type?: 'text' | 'email' | 'password' | 'url' | 'tel' | 'search';
    value?: string;
    placeholder?: string;
    maxLength?: number;
    required?: boolean;
    pattern?: string;
    id?: string;
    name?: string;
    autoComplete?: string;
    disabled?: boolean;
    readonly?: boolean;
  } = {}): HTMLInputElement {
    const {
      type = 'text',
      value = '',
      placeholder = '',
      maxLength,
      required = false,
      pattern,
      id = 'test-input',
      name = 'test-input',
      autoComplete,
      disabled = false,
      readonly = false,
    } = options;

    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    input.placeholder = placeholder;
    input.id = id;
    input.name = name;
    input.disabled = disabled;
    input.readOnly = readonly;

    if (maxLength) input.maxLength = maxLength;
    if (required) input.required = required;
    if (pattern) input.pattern = pattern;
    if (autoComplete) input.autocomplete = autoComplete;

    // Create associated label for accessibility
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = `Test ${type} input`;

    container.appendChild(label);
    container.appendChild(input);

    return input;
  }

  describe('Basic Text Input Interaction', () => {
    it('should type text into empty input', async () => {
      // Arrange: Create empty text input
      input = createTextInput();
      expect(input.value).toBe('');

      // Act: Simulate typing
      const testText = 'Hello World';
      await simulateTyping(input, testText);

      // Assert: Verify text was typed correctly
      expect(input.value).toBe(testText);
    });

    it('should type text into input with existing value', async () => {
      // Arrange: Create input with initial value
      const initialValue = 'Initial ';
      input = createTextInput({ value: initialValue });
      expect(input.value).toBe(initialValue);

      // Act: Simulate typing additional text (append mode)
      const additionalText = 'content';
      await simulateTyping(input, additionalText, { clear: false });

      // Assert: Verify text was appended
      expect(input.value).toBe(initialValue + additionalText);
    });

    it('should replace existing value when clear option is true', async () => {
      // Arrange: Create input with initial value
      const initialValue = 'Replace me';
      input = createTextInput({ value: initialValue });
      expect(input.value).toBe(initialValue);

      // Act: Simulate typing with clear option (default behavior)
      const newText = 'New content';
      await simulateTyping(input, newText, { clear: true });

      // Assert: Verify original content was replaced
      expect(input.value).toBe(newText);
    });

    it('should verify input.value reflects typed content accurately', async () => {
      // Arrange: Create input and track value changes
      input = createTextInput();
      const valueChanges: string[] = [];

      input.addEventListener('input', () => {
        valueChanges.push(input.value);
      });

      // Act: Type text character by character
      const testText = 'Test';
      await simulateTyping(input, testText, { delay: 10 });

      // Assert: Verify each character was captured
      expect(valueChanges).toEqual(['T', 'Te', 'Tes', 'Test']);
      expect(input.value).toBe(testText);
    });
  });

  describe('Focus Behavior and Input Events', () => {
    it('should handle focus behavior before typing', async () => {
      // Arrange: Create input and track focus events
      input = createTextInput();
      let hasFocused = false;
      let focusEventTriggered = false;

      input.addEventListener('focus', () => {
        focusEventTriggered = true;
        hasFocused = true;
      });

      // Act: Focus input before typing
      input.focus();
      expect(document.activeElement).toBe(input);
      expect(focusEventTriggered).toBe(true);

      // Type text while focused
      await simulateTyping(input, 'Focused input');

      // Assert: Verify focus state and content
      expect(hasFocused).toBe(true);
      expect(input.value).toBe('Focused input');
      expect(document.activeElement).toBe(input);
    });

    it('should trigger proper event sequence during typing', async () => {
      // Arrange: Create input and track events
      input = createTextInput();
      const events: string[] = [];

      ['focus', 'input', 'change', 'blur'].forEach(eventType => {
        input.addEventListener(eventType, () => {
          events.push(eventType);
        });
      });

      // Act: Focus, type, and blur
      input.focus();
      await simulateTyping(input, 'Event test');
      input.blur();

      // Assert: Verify correct event sequence
      expect(events).toContain('focus');
      expect(events).toContain('input');
      expect(events).toContain('change');
      expect(events).toContain('blur');
    });

    it('should handle input events with proper event data', async () => {
      // Arrange: Create input and capture event details
      input = createTextInput();
      let lastInputEvent: Event | null = null;

      input.addEventListener('input', (event) => {
        lastInputEvent = event;
      });

      // Act: Type text
      await simulateTyping(input, 'A');

      // Assert: Verify event properties
      expect(lastInputEvent).toBeTruthy();
      expect(lastInputEvent!.type).toBe('input');
      expect(lastInputEvent!.bubbles).toBe(true);
    });
  });

  describe('Different Input Types and Validation', () => {
    it('should handle email input validation', async () => {
      // Arrange: Create email input
      input = createTextInput({ type: 'email', required: true });

      // Act & Assert: Test invalid email
      await simulateTyping(input, 'invalid-email');
      expect(input.checkValidity()).toBe(false);

      // Act & Assert: Test valid email
      input.value = '';
      await simulateTyping(input, 'user@example.com');
      expect(input.checkValidity()).toBe(true);
      expect(input.value).toBe('user@example.com');
    });

    it('should handle password input masking', async () => {
      // Arrange: Create password input
      input = createTextInput({ type: 'password' });

      // Act: Type test content
      const testContent = 'testContent123';
      await simulateTyping(input, testContent);

      // Assert: Verify value is stored but input type is password
      expect(input.value).toBe(testContent);
      expect(input.type).toBe('password');
    });

    it('should handle URL input validation', async () => {
      // Arrange: Create URL input
      input = createTextInput({ type: 'url' });

      // Act & Assert: Test invalid URL
      await simulateTyping(input, 'not-a-url');
      expect(input.checkValidity()).toBe(false);

      // Act & Assert: Test valid URL
      input.value = '';
      await simulateTyping(input, 'https://example.com');
      expect(input.checkValidity()).toBe(true);
    });

    it('should handle tel input for phone numbers', async () => {
      // Arrange: Create tel input
      input = createTextInput({ type: 'tel' });

      // Act: Type phone number
      const phoneNumber = '+1-555-123-4567';
      await simulateTyping(input, phoneNumber);

      // Assert: Verify phone number input
      expect(input.value).toBe(phoneNumber);
      expect(input.type).toBe('tel');
    });
  });

  describe('Input Constraints and Validation', () => {
    it('should respect maxLength constraint', async () => {
      // Arrange: Create input with length limit
      const maxLength = 10;
      input = createTextInput({ maxLength });

      // Act: Try to type text longer than maxLength
      const longText = 'This is a very long text that exceeds the limit';
      await simulateTyping(input, longText);

      // Assert: Verify text is truncated to maxLength
      expect(input.value.length).toBeLessThanOrEqual(maxLength);
    });

    it('should handle required field validation', async () => {
      // Arrange: Create required input
      input = createTextInput({ required: true });

      // Act & Assert: Test empty required field
      expect(input.checkValidity()).toBe(false);

      // Act & Assert: Test filled required field
      await simulateTyping(input, 'Required content');
      expect(input.checkValidity()).toBe(true);
    });

    it('should validate against pattern constraint', async () => {
      // Arrange: Create input with pattern (numbers only)
      input = createTextInput({ pattern: '[0-9]+' });

      // Act & Assert: Test invalid pattern
      await simulateTyping(input, 'abc123');
      expect(input.checkValidity()).toBe(false);

      // Act & Assert: Test valid pattern
      input.value = '';
      await simulateTyping(input, '123456');
      expect(input.checkValidity()).toBe(true);
    });
  });

  describe('Form Integration and Accessibility', () => {
    it('should integrate with form submission', async () => {
      // Arrange: Create form with text inputs
      const form = document.createElement('form');
      form.innerHTML = `
        <label for="username">Username:</label>
        <input type="text" id="username" name="username" required>
        <label for="email">Email:</label>
        <input type="email" id="email" name="email" required>
        <button type="submit">Submit</button>
      `;
      container.appendChild(form);

      const usernameInput = form.querySelector('#username') as HTMLInputElement;
      const emailInput = form.querySelector('#email') as HTMLInputElement;

      let formData: FormData | null = null;
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        formData = new FormData(form);
      });

      // Act: Fill form and submit
      await fillFormWithTestData(form, {
        username: 'testuser',
        email: 'test@example.com'
      });

      const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
      submitButton.click();

      // Assert: Verify form data
      expect(formData).toBeTruthy();
      expect(formData!.get('username')).toBe('testuser');
      expect(formData!.get('email')).toBe('test@example.com');
    });

    it('should maintain accessibility attributes during interaction', async () => {
      // Arrange: Create input with accessibility attributes
      input = createTextInput();
      input.setAttribute('aria-label', 'Test input field');
      input.setAttribute('aria-describedby', 'help-text');
      input.setAttribute('aria-required', 'true');

      // Create help text
      const helpText = document.createElement('div');
      helpText.id = 'help-text';
      helpText.textContent = 'Please enter your text here';
      container.appendChild(helpText);

      // Act: Type text
      await simulateTyping(input, 'Accessible content');

      // Assert: Verify accessibility attributes are preserved
      expect(input.getAttribute('aria-label')).toBe('Test input field');
      expect(input.getAttribute('aria-describedby')).toBe('help-text');
      expect(input.getAttribute('aria-required')).toBe('true');
      expect(input.value).toBe('Accessible content');
    });

    it('should handle placeholder text correctly', async () => {
      // Arrange: Create input with placeholder
      const placeholderText = 'Enter your name here';
      input = createTextInput({ placeholder: placeholderText });

      // Assert: Verify placeholder is visible when empty
      expect(input.placeholder).toBe(placeholderText);
      expect(input.value).toBe('');

      // Act: Type text
      await simulateTyping(input, 'Actual content');

      // Assert: Verify placeholder behavior with content
      expect(input.value).toBe('Actual content');
      expect(input.placeholder).toBe(placeholderText);
    });
  });

  describe('Advanced Text Input Scenarios', () => {
    it('should handle special characters and unicode', async () => {
      // Arrange: Create input
      input = createTextInput();

      // Act: Type special characters and unicode
      const specialText = 'Special: àáâãäåæçèé 中文 🚀 ñ';
      await simulateTyping(input, specialText);

      // Assert: Verify special characters are preserved
      expect(input.value).toBe(specialText);
    });

    it('should handle textarea multiline input', async () => {
      // Arrange: Create textarea
      const textarea = document.createElement('textarea');
      textarea.id = 'multiline-input';
      textarea.name = 'multiline-input';
      container.appendChild(textarea);

      // Act: Type multiline content
      const multilineText = 'Line 1\nLine 2\nLine 3';
      await simulateTyping(textarea, multilineText);

      // Assert: Verify multiline content
      expect(textarea.value).toBe(multilineText);
      expect(textarea.value.split('\n')).toHaveLength(3);
    });

    it('should handle disabled and readonly inputs', async () => {
      // Arrange: Create disabled input
      const disabledInput = createTextInput({ disabled: true });

      // Arrange: Create readonly input
      const readonlyInput = createTextInput({ readonly: true, value: 'Read only' });

      // Act & Assert: Try to type in disabled input
      await simulateTyping(disabledInput, 'Should not work');
      expect(disabledInput.value).toBe(''); // Should remain empty

      // Act & Assert: Try to type in readonly input
      const originalValue = readonlyInput.value;
      await simulateTyping(readonlyInput, 'Should not work');
      expect(readonlyInput.value).toBe(originalValue); // Should remain unchanged
    });

    it('should handle rapid typing simulation', async () => {
      // Arrange: Create input and track all changes
      input = createTextInput();
      const changes: string[] = [];

      input.addEventListener('input', () => {
        changes.push(input.value);
      });

      // Act: Simulate very fast typing
      const rapidText = 'FastTyping';
      await simulateTyping(input, rapidText, { delay: 1 });

      // Assert: Verify all characters were captured
      expect(input.value).toBe(rapidText);
      expect(changes.length).toBe(rapidText.length);
    });

    it('should maintain input state across focus changes', async () => {
      // Arrange: Create multiple inputs
      const input1 = createTextInput({ id: 'input1', name: 'input1' });
      const input2 = createTextInput({ id: 'input2', name: 'input2' });

      // Act: Type in first input
      input1.focus();
      await simulateTyping(input1, 'First input content');

      // Switch focus and type in second input
      input2.focus();
      await simulateTyping(input2, 'Second input content');

      // Return focus to first input
      input1.focus();

      // Assert: Verify both inputs maintained their values
      expect(input1.value).toBe('First input content');
      expect(input2.value).toBe('Second input content');
      expect(document.activeElement).toBe(input1);
    });

    it('should handle empty string input', async () => {
      // Arrange: Create input with initial value
      input = createTextInput({ value: 'Initial content' });

      // Act: Type empty string (should clear if clear option is true)
      await simulateTyping(input, '', { clear: true });

      // Assert: Verify input is cleared
      expect(input.value).toBe('');
    });
  });
});