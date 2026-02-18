/**
 * @fileoverview Shared test utilities for simulating typing interactions
 *
 * This module provides utilities for simulating realistic user typing behaviors
 * across different input types and scenarios. It includes:
 * - Realistic typing delays and patterns
 * - Input validation simulation
 * - Keyboard event simulation
 * - Focus management utilities
 * - Error state testing helpers
 *
 * Features:
 * - Configurable typing speeds (slow, normal, fast)
 * - Support for special keys (Tab, Enter, Backspace, etc.)
 * - Clipboard operation simulation
 * - IME input method simulation
 * - Accessibility testing helpers
 */

/**
 * Typing speed configurations
 */
export const TypingSpeed = {
  SLOW: { min: 100, max: 200 },
  NORMAL: { min: 50, max: 100 },
  FAST: { min: 10, max: 50 },
  INSTANT: { min: 0, max: 0 }
} as const;

export type TypingSpeedConfig = typeof TypingSpeed[keyof typeof TypingSpeed];

/**
 * Special key codes for keyboard simulation
 */
export const SpecialKeys = {
  BACKSPACE: 'Backspace',
  DELETE: 'Delete',
  ENTER: 'Enter',
  TAB: 'Tab',
  ESCAPE: 'Escape',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  HOME: 'Home',
  END: 'End',
  CTRL_A: 'KeyA', // With ctrl modifier
  CTRL_C: 'KeyC', // With ctrl modifier
  CTRL_V: 'KeyV', // With ctrl modifier
} as const;

/**
 * Options for typing simulation
 */
export interface TypingOptions {
  speed?: TypingSpeedConfig;
  clearFirst?: boolean;
  triggerValidation?: boolean;
  simulateErrors?: boolean;
  focusElement?: boolean;
  blurAfter?: boolean;
}

/**
 * Advanced typing simulator that mimics realistic user behavior
 */
export class TypingSimulator {
  private element: HTMLElement;
  private options: Required<TypingOptions>;

  constructor(element: HTMLElement, options: TypingOptions = {}) {
    this.element = element;
    this.options = {
      speed: TypingSpeed.NORMAL,
      clearFirst: true,
      triggerValidation: true,
      simulateErrors: false,
      focusElement: true,
      blurAfter: false,
      ...options
    };
  }

  /**
   * Simulates typing text with realistic delays and events
   */
  async typeText(text: string): Promise<void> {
    if (this.options.focusElement) {
      this.element.focus();
    }

    if (this.options.clearFirst && 'value' in this.element) {
      await this.clearInput();
    }

    // Simulate typing each character
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      await this.typeCharacter(char);

      // Random delay between keystrokes
      const delay = this.getRandomDelay();
      if (delay > 0) {
        await this.wait(delay);
      }
    }

    if (this.options.triggerValidation) {
      await this.triggerValidationEvents();
    }

    if (this.options.blurAfter) {
      this.element.blur();
    }
  }

  /**
   * Simulates typing a single character
   */
  async typeCharacter(char: string): Promise<void> {
    const inputElement = this.element as HTMLInputElement | HTMLTextAreaElement;

    // Dispatch keydown event
    this.element.dispatchEvent(new KeyboardEvent('keydown', {
      key: char,
      code: this.getKeyCode(char),
      bubbles: true,
      cancelable: true
    }));

    // Update value
    if ('value' in this.element) {
      const currentValue = inputElement.value || '';
      const selectionStart = inputElement.selectionStart || currentValue.length;
      const selectionEnd = inputElement.selectionEnd || currentValue.length;

      const newValue =
        currentValue.slice(0, selectionStart) +
        char +
        currentValue.slice(selectionEnd);

      inputElement.value = newValue;

      // Update cursor position
      const newPosition = selectionStart + 1;
      inputElement.setSelectionRange(newPosition, newPosition);
    }

    // Dispatch keypress event (deprecated but some components might listen)
    this.element.dispatchEvent(new KeyboardEvent('keypress', {
      key: char,
      code: this.getKeyCode(char),
      bubbles: true,
      cancelable: true
    }));

    // Dispatch input event
    this.element.dispatchEvent(new Event('input', { bubbles: true }));

    // Dispatch keyup event
    this.element.dispatchEvent(new KeyboardEvent('keyup', {
      key: char,
      code: this.getKeyCode(char),
      bubbles: true,
      cancelable: true
    }));
  }

  /**
   * Simulates special key presses
   */
  async pressKey(key: string, modifiers: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}): Promise<void> {
    const keyboardEventInit: KeyboardEventInit = {
      key,
      code: this.getKeyCode(key),
      bubbles: true,
      cancelable: true,
      ctrlKey: modifiers.ctrl || false,
      shiftKey: modifiers.shift || false,
      altKey: modifiers.alt || false
    };

    this.element.dispatchEvent(new KeyboardEvent('keydown', keyboardEventInit));

    // Handle special key behaviors
    await this.handleSpecialKey(key, modifiers);

    this.element.dispatchEvent(new KeyboardEvent('keyup', keyboardEventInit));
  }

  /**
   * Simulates backspace key presses to delete characters
   */
  async backspace(count: number = 1): Promise<void> {
    for (let i = 0; i < count; i++) {
      await this.pressKey(SpecialKeys.BACKSPACE);

      const delay = this.getRandomDelay();
      if (delay > 0) {
        await this.wait(delay);
      }
    }
  }

  /**
   * Clears the input field
   */
  async clearInput(): Promise<void> {
    if ('value' in this.element) {
      const inputElement = this.element as HTMLInputElement | HTMLTextAreaElement;
      const currentLength = inputElement.value.length;

      // Select all and delete
      await this.pressKey(SpecialKeys.CTRL_A, { ctrl: true });
      await this.wait(50);
      await this.pressKey(SpecialKeys.DELETE);

      // Trigger events
      this.element.dispatchEvent(new Event('input', { bubbles: true }));
      this.element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /**
   * Simulates pasting text from clipboard
   */
  async pasteText(text: string): Promise<void> {
    // Mock clipboard data
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', text);

    // Dispatch paste event
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData
    });

    this.element.dispatchEvent(pasteEvent);

    // If paste wasn't prevented, update the value
    if (!pasteEvent.defaultPrevented && 'value' in this.element) {
      const inputElement = this.element as HTMLInputElement | HTMLTextAreaElement;
      const selectionStart = inputElement.selectionStart || 0;
      const selectionEnd = inputElement.selectionEnd || 0;
      const currentValue = inputElement.value || '';

      const newValue =
        currentValue.slice(0, selectionStart) +
        text +
        currentValue.slice(selectionEnd);

      inputElement.value = newValue;

      // Update cursor position
      const newPosition = selectionStart + text.length;
      inputElement.setSelectionRange(newPosition, newPosition);

      // Trigger events
      this.element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /**
   * Triggers validation-related events
   */
  private async triggerValidationEvents(): Promise<void> {
    this.element.dispatchEvent(new Event('change', { bubbles: true }));

    // Small delay to allow validation to process
    await this.wait(10);

    // Trigger blur to simulate user moving to next field
    if (this.options.blurAfter) {
      this.element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    }
  }

  /**
   * Handles special key behaviors
   */
  private async handleSpecialKey(key: string, modifiers: { ctrl?: boolean; shift?: boolean; alt?: boolean }): Promise<void> {
    const inputElement = this.element as HTMLInputElement | HTMLTextAreaElement;

    switch (key) {
      case SpecialKeys.BACKSPACE:
        if ('value' in this.element && inputElement.value) {
          const selectionStart = inputElement.selectionStart || 0;
          const selectionEnd = inputElement.selectionEnd || 0;
          const currentValue = inputElement.value;

          if (selectionStart === selectionEnd && selectionStart > 0) {
            // Delete character before cursor
            const newValue =
              currentValue.slice(0, selectionStart - 1) +
              currentValue.slice(selectionStart);
            inputElement.value = newValue;
            inputElement.setSelectionRange(selectionStart - 1, selectionStart - 1);
          } else if (selectionStart !== selectionEnd) {
            // Delete selected text
            const newValue =
              currentValue.slice(0, selectionStart) +
              currentValue.slice(selectionEnd);
            inputElement.value = newValue;
            inputElement.setSelectionRange(selectionStart, selectionStart);
          }

          this.element.dispatchEvent(new Event('input', { bubbles: true }));
        }
        break;

      case SpecialKeys.DELETE:
        if ('value' in this.element && inputElement.value) {
          const selectionStart = inputElement.selectionStart || 0;
          const selectionEnd = inputElement.selectionEnd || 0;
          const currentValue = inputElement.value;

          if (selectionStart === selectionEnd && selectionStart < currentValue.length) {
            // Delete character after cursor
            const newValue =
              currentValue.slice(0, selectionStart) +
              currentValue.slice(selectionStart + 1);
            inputElement.value = newValue;
          } else if (selectionStart !== selectionEnd) {
            // Delete selected text
            const newValue =
              currentValue.slice(0, selectionStart) +
              currentValue.slice(selectionEnd);
            inputElement.value = newValue;
            inputElement.setSelectionRange(selectionStart, selectionStart);
          }

          this.element.dispatchEvent(new Event('input', { bubbles: true }));
        }
        break;

      case SpecialKeys.ENTER:
        if (this.element.tagName === 'TEXTAREA') {
          // Add line break in textarea
          if ('value' in this.element) {
            const selectionStart = inputElement.selectionStart || 0;
            const currentValue = inputElement.value || '';
            const newValue =
              currentValue.slice(0, selectionStart) +
              '\n' +
              currentValue.slice(selectionStart);
            inputElement.value = newValue;
            inputElement.setSelectionRange(selectionStart + 1, selectionStart + 1);
            this.element.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        break;

      case SpecialKeys.CTRL_A:
        if (modifiers.ctrl && 'value' in this.element) {
          // Select all text
          inputElement.setSelectionRange(0, inputElement.value.length);
        }
        break;
    }
  }

  /**
   * Gets a random delay based on the configured typing speed
   */
  private getRandomDelay(): number {
    const { min, max } = this.options.speed;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Converts a character to a key code
   */
  private getKeyCode(char: string): string {
    if (char.length === 1) {
      // Regular characters
      const code = char.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        return `Key${char.toUpperCase()}`;
      } else if (code >= 97 && code <= 122) {
        return `Key${char.toUpperCase()}`;
      } else if (code >= 48 && code <= 57) {
        return `Digit${char}`;
      }
    }

    // Special characters and keys
    const specialCodes: Record<string, string> = {
      ' ': 'Space',
      '\n': 'Enter',
      '\t': 'Tab',
      [SpecialKeys.BACKSPACE]: 'Backspace',
      [SpecialKeys.DELETE]: 'Delete',
      [SpecialKeys.ENTER]: 'Enter',
      [SpecialKeys.TAB]: 'Tab',
      [SpecialKeys.ESCAPE]: 'Escape',
    };

    return specialCodes[char] || 'Unidentified';
  }

  /**
   * Utility method to wait for a specified amount of time
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Convenience functions for common typing scenarios
 */
export async function simulateSlowTyping(element: HTMLElement, text: string): Promise<void> {
  const simulator = new TypingSimulator(element, { speed: TypingSpeed.SLOW });
  await simulator.typeText(text);
}

export async function simulateNormalTyping(element: HTMLElement, text: string): Promise<void> {
  const simulator = new TypingSimulator(element, { speed: TypingSpeed.NORMAL });
  await simulator.typeText(text);
}

export async function simulateFastTyping(element: HTMLElement, text: string): Promise<void> {
  const simulator = new TypingSimulator(element, { speed: TypingSpeed.FAST });
  await simulator.typeText(text);
}

export async function simulateInstantTyping(element: HTMLElement, text: string): Promise<void> {
  const simulator = new TypingSimulator(element, { speed: TypingSpeed.INSTANT });
  await simulator.typeText(text);
}

/**
 * Simulates typing with errors and corrections
 */
export async function simulateTypingWithErrors(element: HTMLElement, text: string, errorRate: number = 0.1): Promise<void> {
  const simulator = new TypingSimulator(element, { speed: TypingSpeed.NORMAL });

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Randomly introduce errors
    if (Math.random() < errorRate) {
      // Type wrong character
      const wrongChar = String.fromCharCode(char.charCodeAt(0) + 1);
      await simulator.typeCharacter(wrongChar);
      await simulator.wait(100);

      // Realize mistake and correct it
      await simulator.backspace(1);
      await simulator.wait(200);
    }

    await simulator.typeCharacter(char);
    await simulator.wait(simulator['getRandomDelay']());
  }
}

/**
 * Validates that an element can receive typing input
 */
export function validateTypingTarget(element: HTMLElement): boolean {
  const typingElements = ['INPUT', 'TEXTAREA'];
  const editableElements = element.contentEditable === 'true';

  return typingElements.includes(element.tagName) || editableElements;
}

/**
 * Gets the current text value from various input elements
 */
export function getElementValue(element: HTMLElement): string {
  if ('value' in element) {
    return (element as HTMLInputElement | HTMLTextAreaElement).value;
  } else if (element.contentEditable === 'true') {
    return element.textContent || '';
  }

  return '';
}