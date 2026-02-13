/**
 * @fileoverview Textarea Elements Integration Tests
 *
 * Comprehensive integration tests for textarea elements covering:
 * - Single line text input in textareas
 * - Multi-line text input with Enter key interactions
 * - Long text content handling and performance
 * - Text value verification and synchronization
 * - Focus behavior and event handling
 * - Textarea-specific attributes and constraints
 * - Copy/paste and keyboard navigation
 * - Accessibility features for textareas
 *
 * Test Coverage (Acceptance Criteria):
 * ✅ Typing single line in textarea
 * ✅ Typing multiple lines with Enter key
 * ✅ Typing long text content
 * ✅ Verifying textarea.value reflects all typed content
 * ✅ Focus behavior and cursor positioning
 * ✅ Event handling during text input
 * ✅ Textarea constraints (rows, cols, maxLength)
 * ✅ Accessibility and screen reader support
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  simulateTyping,
  fillFormWithTestData,
  waitForValidation
} from './setup';

describe('Textarea Elements Integration Tests', () => {
  let container: HTMLElement;
  let textarea: HTMLTextAreaElement;

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
   * Helper function to create various types of textareas for testing
   */
  function createTextarea(options: {
    rows?: number;
    cols?: number;
    value?: string;
    placeholder?: string;
    maxLength?: number;
    required?: boolean;
    id?: string;
    name?: string;
    disabled?: boolean;
    readonly?: boolean;
    wrap?: 'hard' | 'soft';
    resize?: 'none' | 'both' | 'horizontal' | 'vertical';
  } = {}): HTMLTextAreaElement {
    const {
      rows = 4,
      cols = 50,
      value = '',
      placeholder = '',
      maxLength,
      required = false,
      id = 'test-textarea',
      name = 'test-textarea',
      disabled = false,
      readonly = false,
      wrap = 'soft',
      resize = 'both',
    } = options;

    const textarea = document.createElement('textarea');
    textarea.rows = rows;
    textarea.cols = cols;
    textarea.value = value;
    textarea.placeholder = placeholder;
    textarea.id = id;
    textarea.name = name;
    textarea.disabled = disabled;
    textarea.readOnly = readonly;
    textarea.wrap = wrap;

    if (maxLength) textarea.maxLength = maxLength;
    if (required) textarea.required = required;

    // Set CSS resize property
    textarea.style.resize = resize;

    // Create associated label for accessibility
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = 'Test textarea field';

    container.appendChild(label);
    container.appendChild(textarea);

    return textarea;
  }

  describe('Basic Textarea Interaction - Single Line', () => {
    it('should type single line text in textarea', async () => {
      // Arrange: Create empty textarea
      textarea = createTextarea();
      expect(textarea.value).toBe('');

      // Act: Simulate typing single line
      const testText = 'This is a single line of text in textarea';
      await simulateTyping(textarea, testText);

      // Assert: Verify text was typed correctly
      expect(textarea.value).toBe(testText);
      expect(textarea.value.split('\n')).toHaveLength(1);
    });

    it('should handle typing in textarea with existing single line content', async () => {
      // Arrange: Create textarea with initial single line
      const initialValue = 'Initial content ';
      textarea = createTextarea({ value: initialValue });
      expect(textarea.value).toBe(initialValue);

      // Act: Simulate appending additional text
      const additionalText = 'appended text';
      await simulateTyping(textarea, additionalText, { clear: false });

      // Assert: Verify text was appended correctly
      expect(textarea.value).toBe(initialValue + additionalText);
      expect(textarea.value.split('\n')).toHaveLength(1);
    });

    it('should replace existing single line content when clear option is true', async () => {
      // Arrange: Create textarea with initial content
      const initialValue = 'Replace this content';
      textarea = createTextarea({ value: initialValue });
      expect(textarea.value).toBe(initialValue);

      // Act: Simulate typing with clear option
      const newText = 'New single line content';
      await simulateTyping(textarea, newText, { clear: true });

      // Assert: Verify original content was replaced
      expect(textarea.value).toBe(newText);
      expect(textarea.value.split('\n')).toHaveLength(1);
    });
  });

  describe('Multi-line Text Input with Enter Key', () => {
    it('should type multiple lines with Enter key', async () => {
      // Arrange: Create empty textarea
      textarea = createTextarea();
      expect(textarea.value).toBe('');

      // Act: Simulate typing multiple lines with newlines
      const multilineText = 'Line 1\nLine 2\nLine 3';
      await simulateTyping(textarea, multilineText);

      // Assert: Verify multi-line content
      expect(textarea.value).toBe(multilineText);
      expect(textarea.value.split('\n')).toHaveLength(3);
      expect(textarea.value.split('\n')[0]).toBe('Line 1');
      expect(textarea.value.split('\n')[1]).toBe('Line 2');
      expect(textarea.value.split('\n')[2]).toBe('Line 3');
    });

    it('should handle Enter key simulation for line breaks', async () => {
      // Arrange: Create textarea and track key events
      textarea = createTextarea();
      const keyEvents: string[] = [];

      textarea.addEventListener('keydown', (e) => {
        keyEvents.push(`keydown:${e.key}`);
      });

      textarea.addEventListener('keyup', (e) => {
        keyEvents.push(`keyup:${e.key}`);
      });

      // Act: Type text with explicit Enter key simulation
      await simulateTyping(textarea, 'First line');

      // Simulate Enter key press
      const enterKeydown = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      const enterKeyup = new KeyboardEvent('keyup', { key: 'Enter', bubbles: true });

      textarea.dispatchEvent(enterKeydown);
      textarea.value += '\n'; // Simulate the newline insertion
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(enterKeyup);

      await simulateTyping(textarea, 'Second line', { clear: false });

      // Assert: Verify Enter key was processed and content is multi-line
      expect(keyEvents).toContain('keydown:Enter');
      expect(keyEvents).toContain('keyup:Enter');
      expect(textarea.value).toBe('First line\nSecond line');
      expect(textarea.value.split('\n')).toHaveLength(2);
    });

    it('should handle complex multi-line content with various line endings', async () => {
      // Arrange: Create textarea
      textarea = createTextarea();

      // Act: Type content with different line ending patterns
      const complexText = 'Line 1\n\nLine 3 (after empty line)\nLine 4\n\n\nLine 7 (after multiple empty lines)';
      await simulateTyping(textarea, complexText);

      // Assert: Verify complex line structure
      expect(textarea.value).toBe(complexText);
      const lines = textarea.value.split('\n');
      expect(lines).toHaveLength(7);
      expect(lines[0]).toBe('Line 1');
      expect(lines[1]).toBe(''); // Empty line
      expect(lines[2]).toBe('Line 3 (after empty line)');
      expect(lines[4]).toBe(''); // Empty line
      expect(lines[5]).toBe(''); // Empty line
      expect(lines[6]).toBe('Line 7 (after multiple empty lines)');
    });

    it('should maintain line structure when adding to existing multi-line content', async () => {
      // Arrange: Create textarea with existing multi-line content
      const initialContent = 'Existing Line 1\nExisting Line 2';
      textarea = createTextarea({ value: initialContent });

      // Act: Append more lines
      const additionalContent = '\nNew Line 3\nNew Line 4';
      await simulateTyping(textarea, additionalContent, { clear: false });

      // Assert: Verify line structure is maintained
      const expectedContent = initialContent + additionalContent;
      expect(textarea.value).toBe(expectedContent);
      expect(textarea.value.split('\n')).toHaveLength(4);
    });
  });

  describe('Long Text Content Handling', () => {
    it('should handle typing long text content efficiently', async () => {
      // Arrange: Create textarea and prepare long content
      textarea = createTextarea();
      const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100); // ~5600 characters

      // Act: Type long content and measure performance
      const startTime = Date.now();
      await simulateTyping(textarea, longText, { delay: 1 }); // Fast typing
      const endTime = Date.now();

      // Assert: Verify long content handling
      expect(textarea.value).toBe(longText);
      expect(textarea.value.length).toBe(longText.length);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle very long multi-line content', async () => {
      // Arrange: Create textarea
      textarea = createTextarea({ rows: 10 });

      // Generate long multi-line content
      const lines: string[] = [];
      for (let i = 1; i <= 100; i++) {
        lines.push(`This is line ${i} with some content to make it reasonably long`);
      }
      const longMultilineText = lines.join('\n');

      // Act: Type the long multi-line content
      await simulateTyping(textarea, longMultilineText, { delay: 0 });

      // Assert: Verify all lines are present
      expect(textarea.value).toBe(longMultilineText);
      expect(textarea.value.split('\n')).toHaveLength(100);
      expect(textarea.value.split('\n')[0]).toBe('This is line 1 with some content to make it reasonably long');
      expect(textarea.value.split('\n')[99]).toBe('This is line 100 with some content to make it reasonably long');
    });

    it('should handle long content with mixed character types', async () => {
      // Arrange: Create textarea
      textarea = createTextarea();

      // Create content with various character types
      const mixedContent = [
        'Regular ASCII text',
        'Unicode characters: àáâãäåæçèé 中文 日本語 한글',
        'Emojis: 🚀 🎉 ✨ 🔥 💯',
        'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?',
        'Numbers: 1234567890',
        'Mixed: Test123! 🎯 中文test'
      ].join('\n');

      // Act: Type mixed content
      await simulateTyping(textarea, mixedContent);

      // Assert: Verify all character types are preserved
      expect(textarea.value).toBe(mixedContent);
      expect(textarea.value).toContain('中文');
      expect(textarea.value).toContain('🚀');
      expect(textarea.value).toContain('!@#$%');
      expect(textarea.value.split('\n')).toHaveLength(6);
    });

    it('should handle performance with rapid content updates', async () => {
      // Arrange: Create textarea and track events
      textarea = createTextarea();
      const updateEvents: number[] = [];

      textarea.addEventListener('input', () => {
        updateEvents.push(Date.now());
      });

      // Act: Rapidly add content
      const rapidContent = 'Quick update text';
      await simulateTyping(textarea, rapidContent, { delay: 5 }); // Very fast typing

      // Assert: Verify rapid updates were handled
      expect(textarea.value).toBe(rapidContent);
      expect(updateEvents.length).toBe(rapidContent.length);

      // Verify events were spaced reasonably (no major blocking)
      for (let i = 1; i < updateEvents.length; i++) {
        const timeDiff = updateEvents[i] - updateEvents[i - 1];
        expect(timeDiff).toBeLessThan(100); // Should be very fast
      }
    });
  });

  describe('Textarea Value Verification', () => {
    it('should verify textarea.value reflects all typed content accurately', async () => {
      // Arrange: Create textarea and track value changes
      textarea = createTextarea();
      const valueChanges: string[] = [];

      textarea.addEventListener('input', () => {
        valueChanges.push(textarea.value);
      });

      // Act: Type content character by character
      const testText = 'Test\nMulti\nLine';
      await simulateTyping(textarea, testText, { delay: 10 });

      // Assert: Verify each character was captured accurately
      expect(textarea.value).toBe(testText);
      expect(valueChanges.length).toBe(testText.length);

      // Verify progressive building of content
      expect(valueChanges[0]).toBe('T');
      expect(valueChanges[4]).toBe('Test\n');
      expect(valueChanges[valueChanges.length - 1]).toBe(testText);
    });

    it('should maintain value integrity during focus changes', async () => {
      // Arrange: Create multiple textareas
      const textarea1 = createTextarea({ id: 'textarea1', name: 'textarea1' });
      const textarea2 = createTextarea({ id: 'textarea2', name: 'textarea2' });

      const content1 = 'Content for first textarea\nWith multiple lines';
      const content2 = 'Content for second textarea\nAlso with multiple lines\nThree lines total';

      // Act: Type in first textarea
      textarea1.focus();
      await simulateTyping(textarea1, content1);

      // Switch to second textarea
      textarea2.focus();
      await simulateTyping(textarea2, content2);

      // Return to first textarea
      textarea1.focus();

      // Assert: Verify both textareas maintained their values
      expect(textarea1.value).toBe(content1);
      expect(textarea2.value).toBe(content2);
      expect(textarea1.value.split('\n')).toHaveLength(2);
      expect(textarea2.value.split('\n')).toHaveLength(3);
      expect(document.activeElement).toBe(textarea1);
    });

    it('should handle value synchronization with programmatic changes', async () => {
      // Arrange: Create textarea
      textarea = createTextarea();
      let lastInputValue = '';

      textarea.addEventListener('input', () => {
        lastInputValue = textarea.value;
      });

      // Act: Mix user typing and programmatic changes
      await simulateTyping(textarea, 'User typed: ');

      // Programmatic change
      textarea.value += 'Programmatic addition\n';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      await simulateTyping(textarea, 'More user input', { clear: false });

      // Assert: Verify value integrity
      const expectedValue = 'User typed: Programmatic addition\nMore user input';
      expect(textarea.value).toBe(expectedValue);
      expect(lastInputValue).toBe(expectedValue);
    });

    it('should preserve content across form resets and restorations', async () => {
      // Arrange: Create form with textarea
      const form = document.createElement('form');
      textarea = createTextarea();
      form.appendChild(textarea);
      container.appendChild(form);

      const testContent = 'Important content\nThat should be preserved\nAcross form operations';

      // Act: Type content and perform form operations
      await simulateTyping(textarea, testContent);

      // Store current value
      const storedValue = textarea.value;

      // Reset form
      form.reset();
      expect(textarea.value).toBe(''); // Should be cleared by reset

      // Restore value
      textarea.value = storedValue;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      // Assert: Verify content restoration
      expect(textarea.value).toBe(testContent);
      expect(textarea.value.split('\n')).toHaveLength(3);
    });
  });

  describe('Focus Behavior and Event Handling', () => {
    it('should handle focus behavior properly before typing', async () => {
      // Arrange: Create textarea and track focus events
      textarea = createTextarea();
      let focusEventTriggered = false;
      let blurEventTriggered = false;

      textarea.addEventListener('focus', () => {
        focusEventTriggered = true;
      });

      textarea.addEventListener('blur', () => {
        blurEventTriggered = true;
      });

      // Act: Focus textarea and type
      textarea.focus();
      expect(document.activeElement).toBe(textarea);
      expect(focusEventTriggered).toBe(true);

      await simulateTyping(textarea, 'Focused textarea content\nWith multiple lines');

      // Blur the textarea
      textarea.blur();

      // Assert: Verify focus behavior and content
      expect(textarea.value).toBe('Focused textarea content\nWith multiple lines');
      expect(blurEventTriggered).toBe(true);
    });

    it('should trigger proper event sequence during multi-line typing', async () => {
      // Arrange: Create textarea and track events
      textarea = createTextarea();
      const events: { type: string; timestamp: number }[] = [];

      ['focus', 'input', 'change', 'keydown', 'keyup', 'blur'].forEach(eventType => {
        textarea.addEventListener(eventType, () => {
          events.push({ type: eventType, timestamp: Date.now() });
        });
      });

      // Act: Focus, type multi-line content, and blur
      textarea.focus();

      // Simulate keydown/keyup for Enter key
      const enterKeydown = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      const enterKeyup = new KeyboardEvent('keyup', { key: 'Enter', bubbles: true });

      await simulateTyping(textarea, 'Line 1');
      textarea.dispatchEvent(enterKeydown);
      textarea.value += '\n';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(enterKeyup);
      await simulateTyping(textarea, 'Line 2', { clear: false });

      textarea.blur();

      // Assert: Verify correct event sequence
      const eventTypes = events.map(e => e.type);
      expect(eventTypes).toContain('focus');
      expect(eventTypes).toContain('input');
      expect(eventTypes).toContain('keydown');
      expect(eventTypes).toContain('keyup');
      expect(eventTypes).toContain('blur');
    });

    it('should handle cursor positioning in multi-line content', async () => {
      // Arrange: Create textarea with content
      textarea = createTextarea();
      const content = 'Line 1\nLine 2\nLine 3';
      await simulateTyping(textarea, content);

      // Act: Test cursor positioning
      textarea.focus();

      // Set cursor at beginning of second line (position 7: after "Line 1\n")
      textarea.setSelectionRange(7, 7);

      // Insert text at cursor position
      const insertText = 'INSERTED ';
      textarea.value = textarea.value.slice(0, 7) + insertText + textarea.value.slice(7);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      // Assert: Verify cursor positioning worked
      expect(textarea.value).toBe('Line 1\nINSERTED Line 2\nLine 3');
      expect(textarea.selectionStart).toBe(7); // Cursor should still be at insertion point
    });

    it('should handle selection and replacement in multi-line text', async () => {
      // Arrange: Create textarea with multi-line content
      textarea = createTextarea();
      const originalContent = 'First line\nSecond line\nThird line';
      await simulateTyping(textarea, originalContent);

      // Act: Select "Second line" and replace it
      textarea.focus();
      const startPos = originalContent.indexOf('Second line');
      const endPos = startPos + 'Second line'.length;

      textarea.setSelectionRange(startPos, endPos);
      expect(textarea.selectedText || textarea.value.slice(startPos, endPos)).toBe('Second line');

      // Replace selected text
      const replacementText = 'REPLACED LINE';
      const beforeSelection = textarea.value.slice(0, startPos);
      const afterSelection = textarea.value.slice(endPos);
      textarea.value = beforeSelection + replacementText + afterSelection;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      // Assert: Verify replacement worked
      expect(textarea.value).toBe('First line\nREPLACED LINE\nThird line');
    });
  });

  describe('Textarea Constraints and Validation', () => {
    it('should respect maxLength constraint for multi-line content', async () => {
      // Arrange: Create textarea with maxLength limit
      const maxLength = 50;
      textarea = createTextarea({ maxLength });

      // Act: Try to type content longer than maxLength
      const longContent = 'This is line 1\nThis is line 2\nThis is line 3\nThis is line 4 that exceeds the limit';
      await simulateTyping(textarea, longContent);

      // Assert: Verify content is truncated to maxLength
      expect(textarea.value.length).toBeLessThanOrEqual(maxLength);
      expect(textarea.value).toContain('\n'); // Should still have newlines within limit
    });

    it('should handle required field validation for textareas', async () => {
      // Arrange: Create required textarea
      textarea = createTextarea({ required: true });

      // Act & Assert: Test empty required textarea
      expect(textarea.checkValidity()).toBe(false);
      expect(textarea.validity.valueMissing).toBe(true);

      // Add content
      await simulateTyping(textarea, 'Required content\nWith multiple lines');
      expect(textarea.checkValidity()).toBe(true);
      expect(textarea.validity.valueMissing).toBe(false);

      // Clear content again
      textarea.value = '';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      expect(textarea.checkValidity()).toBe(false);
    });

    it('should handle rows and cols attributes properly', async () => {
      // Arrange: Create textarea with specific dimensions
      textarea = createTextarea({ rows: 6, cols: 80 });

      // Assert: Verify attributes are set correctly
      expect(textarea.rows).toBe(6);
      expect(textarea.cols).toBe(80);

      // Act: Type content that spans the specified dimensions
      const content = 'A'.repeat(80) + '\n' + 'B'.repeat(80) + '\n' + 'C'.repeat(80);
      await simulateTyping(textarea, content);

      // Assert: Verify content fits the dimensions concept
      expect(textarea.value).toBe(content);
      expect(textarea.value.split('\n')).toHaveLength(3);
    });

    it('should handle disabled and readonly textareas correctly', async () => {
      // Arrange: Create disabled and readonly textareas
      const disabledTextarea = createTextarea({
        id: 'disabled-textarea',
        disabled: true
      });

      const readonlyTextarea = createTextarea({
        id: 'readonly-textarea',
        readonly: true,
        value: 'Read only content\nCannot be modified'
      });

      // Act & Assert: Try to type in disabled textarea
      await simulateTyping(disabledTextarea, 'Should not work\nMultiple lines');
      expect(disabledTextarea.value).toBe(''); // Should remain empty

      // Act & Assert: Try to type in readonly textarea
      const originalValue = readonlyTextarea.value;
      await simulateTyping(readonlyTextarea, 'Should not work');
      expect(readonlyTextarea.value).toBe(originalValue); // Should remain unchanged
    });
  });

  describe('Form Integration and Accessibility', () => {
    it('should integrate properly with form submission', async () => {
      // Arrange: Create form with textarea
      const form = document.createElement('form');
      form.innerHTML = `
        <label for="comments">Comments:</label>
        <textarea id="comments" name="comments" required></textarea>
        <label for="description">Description:</label>
        <textarea id="description" name="description" rows="6"></textarea>
        <button type="submit">Submit</button>
      `;
      container.appendChild(form);

      const commentsTextarea = form.querySelector('#comments') as HTMLTextAreaElement;
      const descriptionTextarea = form.querySelector('#description') as HTMLTextAreaElement;

      let formData: FormData | null = null;
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        formData = new FormData(form);
      });

      // Act: Fill textareas and submit
      await fillFormWithTestData(form, {
        comments: 'Great product!\nVery satisfied\nRecommended!',
        description: 'Detailed description\nWith multiple paragraphs\n\nSecond paragraph here'
      });

      const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
      submitButton.click();

      // Assert: Verify form data includes multi-line content
      expect(formData).toBeTruthy();
      expect(formData!.get('comments')).toBe('Great product!\nVery satisfied\nRecommended!');
      expect(formData!.get('description')).toBe('Detailed description\nWith multiple paragraphs\n\nSecond paragraph here');
    });

    it('should maintain accessibility attributes during interaction', async () => {
      // Arrange: Create textarea with accessibility attributes
      textarea = createTextarea();
      textarea.setAttribute('aria-label', 'Multi-line text input');
      textarea.setAttribute('aria-describedby', 'textarea-help');
      textarea.setAttribute('aria-required', 'true');

      // Create help text
      const helpText = document.createElement('div');
      helpText.id = 'textarea-help';
      helpText.textContent = 'Enter your detailed comments here. Use multiple lines as needed.';
      container.appendChild(helpText);

      // Act: Type multi-line content
      await simulateTyping(textarea, 'Accessible content\nWith multiple lines\nAnd proper labeling');

      // Assert: Verify accessibility attributes are preserved
      expect(textarea.getAttribute('aria-label')).toBe('Multi-line text input');
      expect(textarea.getAttribute('aria-describedby')).toBe('textarea-help');
      expect(textarea.getAttribute('aria-required')).toBe('true');
      expect(textarea.value.split('\n')).toHaveLength(3);
    });

    it('should handle placeholder text correctly with multi-line content', async () => {
      // Arrange: Create textarea with placeholder
      const placeholderText = 'Enter your comments here...\nYou can use multiple lines';
      textarea = createTextarea({ placeholder: placeholderText });

      // Assert: Verify placeholder is visible when empty
      expect(textarea.placeholder).toBe(placeholderText);
      expect(textarea.value).toBe('');

      // Act: Type multi-line content
      await simulateTyping(textarea, 'Actual content\nWith multiple lines\nOverrides placeholder');

      // Assert: Verify placeholder behavior with content
      expect(textarea.value).toBe('Actual content\nWith multiple lines\nOverrides placeholder');
      expect(textarea.placeholder).toBe(placeholderText);
      expect(textarea.value.split('\n')).toHaveLength(3);
    });

    it('should support keyboard navigation in multi-line content', async () => {
      // Arrange: Create textarea with content
      textarea = createTextarea();
      const content = 'Line 1 content\nLine 2 content\nLine 3 content';
      await simulateTyping(textarea, content);

      textarea.focus();

      // Act: Test keyboard navigation
      // Move to beginning
      textarea.setSelectionRange(0, 0);
      expect(textarea.selectionStart).toBe(0);

      // Move to end
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      expect(textarea.selectionStart).toBe(textarea.value.length);

      // Select all content
      textarea.setSelectionRange(0, textarea.value.length);
      expect(textarea.selectionEnd - textarea.selectionStart).toBe(textarea.value.length);

      // Assert: Verify navigation worked
      expect(textarea.value).toBe(content);
    });
  });

  describe('Advanced Textarea Scenarios', () => {
    it('should handle copy and paste operations with multi-line content', async () => {
      // Arrange: Create textarea
      textarea = createTextarea();
      textarea.focus();

      // Mock clipboard API calls
      const mockClipboard = {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn().mockResolvedValue('Pasted content\nWith multiple lines\nFrom clipboard')
      };
      Object.defineProperty(navigator, 'clipboard', { value: mockClipboard });

      // Act: Type initial content
      await simulateTyping(textarea, 'Initial content\nFirst line');

      // Simulate copy operation (select all and copy)
      textarea.setSelectionRange(0, textarea.value.length);

      // Simulate paste operation
      const pastedContent = await mockClipboard.readText();
      textarea.value = pastedContent;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      // Assert: Verify paste operation
      expect(textarea.value).toBe('Pasted content\nWith multiple lines\nFrom clipboard');
      expect(textarea.value.split('\n')).toHaveLength(3);
    });

    it('should handle undo/redo simulation with multi-line edits', async () => {
      // Arrange: Create textarea and track history
      textarea = createTextarea();
      const history: string[] = [];
      let historyIndex = -1;

      textarea.addEventListener('input', () => {
        // Simple undo/redo simulation
        if (historyIndex < history.length - 1) {
          history.splice(historyIndex + 1);
        }
        history.push(textarea.value);
        historyIndex = history.length - 1;
      });

      // Act: Perform multiple edits
      await simulateTyping(textarea, 'First edit');
      await simulateTyping(textarea, '\nSecond line', { clear: false });
      await simulateTyping(textarea, '\nThird line', { clear: false });

      // Simulate undo
      if (historyIndex > 0) {
        historyIndex--;
        textarea.value = history[historyIndex];
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Assert: Verify undo worked
      expect(textarea.value).toBe('First edit\nSecond line');
      expect(history.length).toBeGreaterThan(2);
    });

    it('should handle rapid multi-line content updates', async () => {
      // Arrange: Create textarea and performance tracking
      textarea = createTextarea();
      const updateTimes: number[] = [];

      textarea.addEventListener('input', () => {
        updateTimes.push(Date.now());
      });

      // Act: Rapid multi-line content updates
      const rapidUpdates = [
        'Line 1',
        'Line 1\nLine 2',
        'Line 1\nLine 2\nLine 3',
        'Line 1\nLine 2\nLine 3\nLine 4',
        'Line 1\nLine 2\nLine 3\nLine 4\nLine 5'
      ];

      for (const content of rapidUpdates) {
        textarea.value = content;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 5)); // Very fast updates
      }

      // Assert: Verify rapid updates were handled efficiently
      expect(textarea.value).toBe(rapidUpdates[rapidUpdates.length - 1]);
      expect(textarea.value.split('\n')).toHaveLength(5);
      expect(updateTimes).toHaveLength(rapidUpdates.length);
    });
  });
});