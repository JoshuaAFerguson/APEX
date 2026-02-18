/**
 * @fileoverview Shared utilities for type interaction testing
 *
 * This module provides specialized utilities for testing typing interactions:
 * - Realistic typing simulation with configurable delays
 * - Event capture and analysis during typing
 * - Input state validation and monitoring
 * - Keyboard shortcut simulation
 * - Copy/paste operations
 * - Focus management during typing
 */

import { Page, Locator } from 'playwright';

// Type interaction configuration interfaces
export interface TypingOptions {
  /** Delay between individual characters (ms) */
  delayBetweenChars?: number;
  /** Whether to append to existing text or replace */
  append?: boolean;
  /** Whether to wait for element to be focused first */
  waitForFocus?: boolean;
  /** Maximum time to wait for typing to complete */
  timeout?: number;
  /** Whether to simulate realistic typing mistakes */
  simulateMistakes?: boolean;
  /** Probability of making a typing mistake (0-1) */
  mistakeRate?: number;
}

export interface SlowTypingOptions extends TypingOptions {
  /** Additional delay variance for more realistic timing */
  delayVariance?: number;
  /** Whether to pause at word boundaries */
  pauseAtWords?: boolean;
  /** Delay at word boundaries (ms) */
  wordPauseDelay?: number;
}

export interface TypingEvent {
  type: string;
  timestamp: number;
  key?: string;
  value?: string;
  target?: string;
}

export interface CapturedTypingEvents {
  keydownEvents: TypingEvent[];
  keyupEvents: TypingEvent[];
  inputEvents: TypingEvent[];
  changeEvents: TypingEvent[];
  focusEvents: TypingEvent[];
  blurEvents: TypingEvent[];
  totalEvents: number;
  duration: number;
}

export interface InputValidationState {
  value: string;
  isValid: boolean;
  validationMessage: string;
  characterCount: number;
  hasError: boolean;
  errorMessage?: string;
}

export interface TypingScenario {
  name: string;
  selector: string;
  text: string;
  options?: TypingOptions;
  expectedResult?: string;
  validationExpected?: boolean;
}

/**
 * Simulates realistic typing in an input element
 */
export async function simulateTyping(
  page: Page,
  selector: string,
  text: string,
  options: TypingOptions = {}
): Promise<void> {
  const {
    delayBetweenChars = 20,
    append = false,
    waitForFocus = true,
    timeout = 30000,
    simulateMistakes = false,
    mistakeRate = 0.02
  } = options;

  // Get the element
  const element = page.locator(selector);

  // Wait for element to be ready
  await element.waitFor({ state: 'visible', timeout });

  if (waitForFocus) {
    await element.focus();
  }

  // Clear existing content if not appending
  if (!append) {
    await element.clear();
  }

  // Simulate typing with optional mistakes
  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Simulate typing mistakes
    if (simulateMistakes && Math.random() < mistakeRate && i > 0) {
      // Type wrong character
      const wrongChar = String.fromCharCode(char.charCodeAt(0) + 1);
      await element.type(wrongChar, { delay: delayBetweenChars });

      // Brief pause to "notice" mistake
      await page.waitForTimeout(100 + Math.random() * 200);

      // Backspace to correct
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(50);
    }

    // Type the correct character
    await element.type(char, { delay: delayBetweenChars });

    // Add small random variance to make typing more realistic
    if (delayBetweenChars > 0) {
      const variance = Math.random() * 10 - 5; // ±5ms variance
      await page.waitForTimeout(Math.max(1, variance));
    }
  }
}

/**
 * Simulates slow, deliberate typing with realistic pauses
 */
export async function simulateSlowTyping(
  page: Page,
  selector: string,
  text: string,
  options: SlowTypingOptions = {}
): Promise<void> {
  const {
    delayBetweenChars = 100,
    delayVariance = 50,
    pauseAtWords = true,
    wordPauseDelay = 300,
    ...baseOptions
  } = options;

  const element = page.locator(selector);
  await element.waitFor({ state: 'visible', timeout: baseOptions.timeout || 30000 });

  if (baseOptions.waitForFocus !== false) {
    await element.focus();
  }

  if (!baseOptions.append) {
    await element.clear();
  }

  const words = text.split(' ');

  for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
    const word = words[wordIndex];

    // Type each character in the word
    for (let charIndex = 0; charIndex < word.length; charIndex++) {
      const char = word[charIndex];
      await element.type(char);

      // Variable delay between characters
      const delay = delayBetweenChars + (Math.random() * delayVariance - delayVariance / 2);
      await page.waitForTimeout(Math.max(1, delay));
    }

    // Add space and pause between words (except for last word)
    if (wordIndex < words.length - 1) {
      await element.type(' ');

      if (pauseAtWords) {
        await page.waitForTimeout(wordPauseDelay);
      }
    }
  }
}

/**
 * Simulates pasting text into an input element
 */
export async function simulatePasteText(
  page: Page,
  selector: string,
  text: string,
  options: { append?: boolean; timeout?: number } = {}
): Promise<void> {
  const { append = false, timeout = 30000 } = options;

  const element = page.locator(selector);
  await element.waitFor({ state: 'visible', timeout });
  await element.focus();

  if (!append) {
    await element.clear();
  }

  // Simulate clipboard paste operation
  await page.evaluate((textToPaste) => {
    return navigator.clipboard.writeText(textToPaste);
  }, text);

  await page.keyboard.press('Control+v');
}

/**
 * Simulates keyboard shortcuts in sequence
 */
export async function simulateKeyboardShortcuts(
  page: Page,
  selector: string,
  shortcuts: string[]
): Promise<void> {
  const element = page.locator(selector);
  await element.focus();

  for (const shortcut of shortcuts) {
    await page.keyboard.press(shortcut);
    await page.waitForTimeout(100); // Brief delay between shortcuts
  }
}

/**
 * Waits for input value to match expected value
 */
export async function waitForInputValue(
  page: Page,
  selector: string,
  expectedValue: string,
  options: { timeout?: number; exact?: boolean } = {}
): Promise<boolean> {
  const { timeout = 10000, exact = true } = options;

  try {
    await page.waitForFunction(
      ({ sel, expected, exactMatch }) => {
        const element = document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement;
        if (!element) return false;

        return exactMatch
          ? element.value === expected
          : element.value.includes(expected);
      },
      { sel: selector, expected: expectedValue, exactMatch: exact },
      { timeout }
    );
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Captures typing-related events during an action
 */
export async function captureTypingEvents(
  page: Page,
  action: () => Promise<void>
): Promise<CapturedTypingEvents> {
  const events: TypingEvent[] = [];
  const startTime = Date.now();

  // Event listeners for different typing-related events
  const eventTypes = ['keydown', 'keyup', 'input', 'change', 'focus', 'blur'];

  // Set up event listeners
  await page.evaluate((types) => {
    types.forEach(eventType => {
      document.addEventListener(eventType, (e) => {
        const event = {
          type: eventType,
          timestamp: Date.now(),
          target: (e.target as HTMLElement)?.id || 'unknown',
          key: (e as KeyboardEvent).key,
          value: (e.target as HTMLInputElement)?.value
        };

        // Store in window object for retrieval
        if (!window._capturedEvents) {
          window._capturedEvents = [];
        }
        window._capturedEvents.push(event);
      }, true);
    });
  }, eventTypes);

  // Execute the action
  await action();

  // Retrieve captured events
  const capturedEvents = await page.evaluate(() => {
    const events = window._capturedEvents || [];
    delete window._capturedEvents; // Clean up
    return events;
  });

  const endTime = Date.now();

  // Categorize events
  const categorizedEvents: CapturedTypingEvents = {
    keydownEvents: capturedEvents.filter(e => e.type === 'keydown'),
    keyupEvents: capturedEvents.filter(e => e.type === 'keyup'),
    inputEvents: capturedEvents.filter(e => e.type === 'input'),
    changeEvents: capturedEvents.filter(e => e.type === 'change'),
    focusEvents: capturedEvents.filter(e => e.type === 'focus'),
    blurEvents: capturedEvents.filter(e => e.type === 'blur'),
    totalEvents: capturedEvents.length,
    duration: endTime - startTime
  };

  return categorizedEvents;
}

/**
 * Validates input state and returns validation information
 */
export async function validateInputState(
  page: Page,
  selector: string
): Promise<InputValidationState> {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement;

    if (!element) {
      throw new Error(`Element not found: ${sel}`);
    }

    return {
      value: element.value,
      isValid: element.validity.valid,
      validationMessage: element.validationMessage,
      characterCount: element.value.length,
      hasError: !element.validity.valid,
      errorMessage: !element.validity.valid ? element.validationMessage : undefined
    };
  }, selector);
}

/**
 * Creates a typing scenario for batch testing
 */
export function createTypingScenario(config: TypingScenario): TypingScenario {
  return {
    name: config.name,
    selector: config.selector,
    text: config.text,
    options: {
      delayBetweenChars: 50,
      waitForFocus: true,
      ...config.options
    },
    expectedResult: config.expectedResult || config.text,
    validationExpected: config.validationExpected
  };
}

/**
 * Executes multiple typing scenarios in sequence
 */
export async function executeTypingScenarios(
  page: Page,
  scenarios: TypingScenario[]
): Promise<Array<{ scenario: TypingScenario; success: boolean; actualValue: string; error?: string }>> {
  const results = [];

  for (const scenario of scenarios) {
    try {
      await simulateTyping(page, scenario.selector, scenario.text, scenario.options);

      // Wait a moment for any async validation
      await page.waitForTimeout(100);

      const actualValue = await page.locator(scenario.selector).inputValue();
      const success = actualValue === scenario.expectedResult;

      results.push({
        scenario,
        success,
        actualValue,
      });
    } catch (error) {
      results.push({
        scenario,
        success: false,
        actualValue: '',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return results;
}

/**
 * Simulates realistic typing patterns with common typing behaviors
 */
export async function simulateRealisticTyping(
  page: Page,
  selector: string,
  text: string,
  options: {
    wpm?: number; // Words per minute
    mistakeRate?: number; // Probability of mistakes
    hesitationRate?: number; // Probability of hesitation
  } = {}
): Promise<void> {
  const { wpm = 40, mistakeRate = 0.03, hesitationRate = 0.1 } = options;

  // Calculate delay based on WPM (average word length ~5 characters)
  const avgCharsPerMinute = wpm * 5;
  const avgDelayMs = 60000 / avgCharsPerMinute;

  const element = page.locator(selector);
  await element.focus();

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Simulate hesitation at punctuation or after mistakes
    if ((char.match(/[.!?,:;]/) || Math.random() < hesitationRate)) {
      await page.waitForTimeout(200 + Math.random() * 300);
    }

    // Simulate typing mistake
    if (Math.random() < mistakeRate) {
      const wrongChar = char === char.toLowerCase()
        ? char.toUpperCase()
        : char.toLowerCase();

      await element.type(wrongChar, { delay: avgDelayMs });
      await page.waitForTimeout(100 + Math.random() * 200); // Notice mistake
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(50);
    }

    // Type correct character
    await element.type(char, { delay: avgDelayMs + (Math.random() * 20 - 10) });
  }
}

/**
 * Tests input field behavior with various edge cases
 */
export async function testInputEdgeCases(
  page: Page,
  selector: string
): Promise<{
  canReceiveFocus: boolean;
  canAcceptText: boolean;
  respectsMaxLength: boolean;
  triggersValidation: boolean;
  handlesUnicode: boolean;
  handlesSpecialChars: boolean;
}> {
  const element = page.locator(selector);

  // Test focus
  let canReceiveFocus = false;
  try {
    await element.focus();
    canReceiveFocus = await element.evaluate(el => document.activeElement === el);
  } catch {
    canReceiveFocus = false;
  }

  // Test text acceptance
  let canAcceptText = false;
  try {
    const initialValue = await element.inputValue();
    await element.type('test');
    const newValue = await element.inputValue();
    canAcceptText = newValue !== initialValue;
    await element.clear();
  } catch {
    canAcceptText = false;
  }

  // Test max length (if applicable)
  let respectsMaxLength = true;
  try {
    const maxLength = await element.getAttribute('maxlength');
    if (maxLength) {
      const longText = 'a'.repeat(parseInt(maxLength) + 10);
      await element.clear();
      await element.type(longText);
      const value = await element.inputValue();
      respectsMaxLength = value.length <= parseInt(maxLength);
    }
  } catch {
    respectsMaxLength = true; // No maxlength to test
  }

  // Test validation
  let triggersValidation = false;
  try {
    await element.clear();
    await element.type('invalid-email-format');
    const validity = await element.evaluate((el: HTMLInputElement) => el.validity.valid);
    triggersValidation = !validity; // If it's invalid, validation is working
  } catch {
    triggersValidation = false;
  }

  // Test Unicode support
  let handlesUnicode = false;
  try {
    await element.clear();
    const unicodeText = '🌍中文';
    await element.type(unicodeText);
    const value = await element.inputValue();
    handlesUnicode = value === unicodeText;
  } catch {
    handlesUnicode = false;
  }

  // Test special characters
  let handlesSpecialChars = false;
  try {
    await element.clear();
    const specialChars = '!@#$%^&*()';
    await element.type(specialChars);
    const value = await element.inputValue();
    handlesSpecialChars = value === specialChars;
  } catch {
    handlesSpecialChars = false;
  }

  return {
    canReceiveFocus,
    canAcceptText,
    respectsMaxLength,
    triggersValidation,
    handlesUnicode,
    handlesSpecialChars
  };
}

// Declare window extensions for TypeScript
declare global {
  interface Window {
    _capturedEvents?: TypingEvent[];
  }
}

// Export commonly used typing patterns
export const TYPING_PATTERNS = {
  SLOW_DELIBERATE: { delayBetweenChars: 150, pauseAtWords: true, wordPauseDelay: 400 },
  NORMAL_SPEED: { delayBetweenChars: 50, delayVariance: 20 },
  FAST_TYPING: { delayBetweenChars: 15, delayVariance: 10 },
  WITH_MISTAKES: { delayBetweenChars: 80, simulateMistakes: true, mistakeRate: 0.05 },
  REALISTIC: { delayBetweenChars: 60, delayVariance: 30, simulateMistakes: true, mistakeRate: 0.02 }
};

// Export test data sets
export const TEST_TEXT_SAMPLES = {
  BASIC: 'Hello, World!',
  WITH_NUMBERS: 'User123 typed 456 characters at 12:34 PM',
  WITH_SPECIAL_CHARS: 'Email: test@example.com! Password: P@ssw0rd#123',
  MULTILINE: 'Line 1\nLine 2\nLine 3 with more content',
  UNICODE: 'Hello 世界 🌍 Café naïve résumé العربية русский',
  LONG_TEXT: 'This is a longer text sample that can be used for testing typing performance and behavior with extended content. '.repeat(3),
  PROGRAMMING: 'function test() {\n  console.log("Hello World");\n  return true;\n}',
  EMAIL_ADDRESSES: ['test@example.com', 'user.name+tag@domain.co.uk', 'invalid-email'],
  PHONE_NUMBERS: ['+1-555-123-4567', '(555) 123-4567', '555.123.4567'],
  URLS: ['https://example.com', 'http://localhost:3000/path', 'ftp://files.example.com']
};