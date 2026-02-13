/**
 * @fileoverview Utility helpers for contenteditable integration testing
 *
 * This file provides specialized utilities for testing contenteditable elements:
 * - Text input simulation and verification
 * - Content extraction and validation
 * - Event handling for contenteditable interactions
 * - Cross-browser compatibility helpers
 * - Performance measurement for typing operations
 */

import { Page, Locator, expect } from 'playwright';

/**
 * Interface for contenteditable test options
 */
export interface ContenteditableTestOptions {
  /** Selector for the contenteditable element */
  selector: string;
  /** Text to type into the element */
  text: string;
  /** Whether to clear existing content before typing */
  clearFirst?: boolean;
  /** Delay between keystrokes for realistic typing */
  typingDelay?: number;
  /** Whether to verify content after typing */
  verifyContent?: boolean;
  /** Expected final content (for verification) */
  expectedContent?: string;
  /** Timeout for operations */
  timeout?: number;
}

/**
 * Interface for content validation results
 */
export interface ContentValidationResult {
  /** Text content of the element */
  textContent: string;
  /** HTML content of the element */
  innerHTML: string;
  /** Inner text (rendered text) */
  innerText: string;
  /** Whether the element is contenteditable */
  isContentEditable: boolean;
  /** Whether the element is currently focused */
  isFocused: boolean;
  /** Length of text content */
  contentLength: number;
  /** Whether content matches expected value */
  contentMatches?: boolean;
  /** Any validation errors */
  errors: string[];
}

/**
 * Interface for typing performance metrics
 */
export interface TypingPerformanceMetrics {
  /** Total time for typing operation */
  totalTime: number;
  /** Characters per second */
  charactersPerSecond: number;
  /** Number of characters typed */
  characterCount: number;
  /** Individual keystroke timings */
  keystrokeTimings: number[];
  /** Average time per keystroke */
  averageKeystrokeTime: number;
}

/**
 * Types text into a contenteditable element with realistic timing
 */
export async function typeInContenteditable(
  page: Page,
  options: ContenteditableTestOptions
): Promise<TypingPerformanceMetrics> {
  const {
    selector,
    text,
    clearFirst = false,
    typingDelay = 50,
    verifyContent = true,
    expectedContent,
    timeout = 30000
  } = options;

  const startTime = Date.now();
  const keystrokeTimings: number[] = [];

  // Find the contenteditable element
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible', timeout });

  // Verify it's contenteditable
  const isContentEditable = await element.evaluate((el: HTMLElement) => {
    return el.contentEditable === 'true' || el.isContentEditable;
  });

  if (!isContentEditable) {
    throw new Error(`Element ${selector} is not contenteditable`);
  }

  // Focus the element
  await element.focus();

  // Clear existing content if requested
  if (clearFirst) {
    await element.evaluate((el: HTMLElement) => {
      el.textContent = '';
    });
  }

  // Type each character with timing measurement
  for (let i = 0; i < text.length; i++) {
    const keystrokeStart = Date.now();
    await element.type(text[i], { delay: typingDelay });
    const keystrokeEnd = Date.now();
    keystrokeTimings.push(keystrokeEnd - keystrokeStart);
  }

  const endTime = Date.now();
  const totalTime = endTime - startTime;

  // Verify content if requested
  if (verifyContent) {
    const actualContent = await element.textContent();
    const expected = expectedContent || text;

    if (clearFirst && actualContent !== expected) {
      throw new Error(`Content verification failed. Expected: "${expected}", Got: "${actualContent}"`);
    } else if (!clearFirst && !actualContent?.includes(text)) {
      throw new Error(`Content verification failed. Expected to contain: "${text}", Got: "${actualContent}"`);
    }
  }

  // Calculate performance metrics
  const metrics: TypingPerformanceMetrics = {
    totalTime,
    characterCount: text.length,
    charactersPerSecond: text.length / (totalTime / 1000),
    keystrokeTimings,
    averageKeystrokeTime: keystrokeTimings.reduce((a, b) => a + b, 0) / keystrokeTimings.length
  };

  return metrics;
}

/**
 * Validates the content of a contenteditable element
 */
export async function validateContenteditableContent(
  page: Page,
  selector: string,
  expectedContent?: string
): Promise<ContentValidationResult> {
  const element = page.locator(selector);
  const errors: string[] = [];

  try {
    await element.waitFor({ state: 'visible', timeout: 10000 });
  } catch (error) {
    errors.push(`Element ${selector} not found or not visible`);
    return {
      textContent: '',
      innerHTML: '',
      innerText: '',
      isContentEditable: false,
      isFocused: false,
      contentLength: 0,
      contentMatches: false,
      errors
    };
  }

  // Extract content and properties
  const result = await element.evaluate((el: HTMLElement) => {
    return {
      textContent: el.textContent || '',
      innerHTML: el.innerHTML || '',
      innerText: el.innerText || '',
      isContentEditable: el.contentEditable === 'true' || el.isContentEditable,
      isFocused: document.activeElement === el
    };
  });

  const contentLength = result.textContent.length;
  let contentMatches: boolean | undefined;

  // Validate expected content if provided
  if (expectedContent !== undefined) {
    contentMatches = result.textContent === expectedContent;
    if (!contentMatches) {
      errors.push(`Content mismatch. Expected: "${expectedContent}", Got: "${result.textContent}"`);
    }
  }

  // Additional validations
  if (!result.isContentEditable) {
    errors.push('Element is not contenteditable');
  }

  return {
    ...result,
    contentLength,
    contentMatches,
    errors
  };
}

/**
 * Clears content from a contenteditable element
 */
export async function clearContenteditableContent(
  page: Page,
  selector: string
): Promise<void> {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible' });

  // Focus and select all content, then delete
  await element.focus();
  await page.keyboard.press('Control+a'); // Select all
  await page.keyboard.press('Delete'); // Delete selected content

  // Verify content was cleared
  const textContent = await element.textContent();
  if (textContent && textContent.trim().length > 0) {
    // Fallback: use JavaScript to clear
    await element.evaluate((el: HTMLElement) => {
      el.textContent = '';
    });
  }
}

/**
 * Gets the current caret/cursor position in a contenteditable element
 */
export async function getCaretPosition(
  page: Page,
  selector: string
): Promise<number | null> {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible' });

  return await element.evaluate((el: HTMLElement) => {
    if (!el.isContentEditable) {
      return null;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    if (!el.contains(range.startContainer)) {
      return null;
    }

    // Calculate the position
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(el);
    preCaretRange.setEnd(range.startContainer, range.startOffset);

    return preCaretRange.toString().length;
  });
}

/**
 * Sets the caret/cursor position in a contenteditable element
 */
export async function setCaretPosition(
  page: Page,
  selector: string,
  position: number
): Promise<void> {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible' });

  await element.evaluate((el: HTMLElement, pos: number) => {
    if (!el.isContentEditable) {
      throw new Error('Element is not contenteditable');
    }

    const selection = window.getSelection();
    if (!selection) {
      throw new Error('No selection available');
    }

    const range = document.createRange();
    let currentPos = 0;
    let textNode: Node | null = null;
    let offset = 0;

    // Find the text node and offset for the desired position
    function walkTextNodes(node: Node): boolean {
      if (node.nodeType === Node.TEXT_NODE) {
        const textLength = node.textContent?.length || 0;
        if (currentPos + textLength >= pos) {
          textNode = node;
          offset = pos - currentPos;
          return true;
        }
        currentPos += textLength;
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          if (walkTextNodes(node.childNodes[i])) {
            return true;
          }
        }
      }
      return false;
    }

    walkTextNodes(el);

    if (textNode) {
      range.setStart(textNode, offset);
      range.setEnd(textNode, offset);
    } else {
      // If no text node found, set at end of element
      range.selectNodeContents(el);
      range.collapse(false);
    }

    selection.removeAllRanges();
    selection.addRange(range);
  }, position);

  // Focus the element to ensure caret is visible
  await element.focus();
}

/**
 * Simulates rich text formatting in a contenteditable element
 */
export async function applyRichTextFormatting(
  page: Page,
  selector: string,
  formatting: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    fontSize?: string;
    color?: string;
  }
): Promise<void> {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible' });
  await element.focus();

  // Apply formatting using execCommand (note: deprecated but still widely supported)
  if (formatting.bold) {
    await page.evaluate(() => document.execCommand('bold'));
  }

  if (formatting.italic) {
    await page.evaluate(() => document.execCommand('italic'));
  }

  if (formatting.underline) {
    await page.evaluate(() => document.execCommand('underline'));
  }

  if (formatting.fontSize) {
    await page.evaluate((size) => {
      document.execCommand('fontSize', false, size);
    }, formatting.fontSize);
  }

  if (formatting.color) {
    await page.evaluate((color) => {
      document.execCommand('foreColor', false, color);
    }, formatting.color);
  }
}

/**
 * Tests contenteditable element with various input methods
 */
export async function testMultipleInputMethods(
  page: Page,
  selector: string,
  testContent: string
): Promise<{
  typing: ContentValidationResult;
  paste: ContentValidationResult;
  programmatic: ContentValidationResult;
}> {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible' });

  // Test 1: Regular typing
  await clearContenteditableContent(page, selector);
  await typeInContenteditable(page, {
    selector,
    text: testContent,
    clearFirst: true,
    verifyContent: false
  });
  const typingResult = await validateContenteditableContent(page, selector, testContent);

  // Test 2: Paste operation
  await clearContenteditableContent(page, selector);
  await element.focus();

  // Set clipboard content and paste
  await page.evaluate((content) => {
    navigator.clipboard.writeText(content);
  }, testContent);
  await page.keyboard.press('Control+v');

  // Wait for paste to complete
  await page.waitForTimeout(100);
  const pasteResult = await validateContenteditableContent(page, selector, testContent);

  // Test 3: Programmatic content setting
  await element.evaluate((el: HTMLElement, content: string) => {
    el.textContent = content;
    // Trigger input event to simulate user interaction
    const event = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: content
    });
    el.dispatchEvent(event);
  }, testContent);
  const programmaticResult = await validateContenteditableContent(page, selector, testContent);

  return {
    typing: typingResult,
    paste: pasteResult,
    programmatic: programmaticResult
  };
}

/**
 * Captures contenteditable element events for testing
 */
export async function captureContenteditableEvents(
  page: Page,
  selector: string,
  action: () => Promise<void>
): Promise<Array<{
  type: string;
  timestamp: number;
  data?: any;
}>> {
  const events: Array<{ type: string; timestamp: number; data?: any }> = [];

  // Set up event listeners
  await page.evaluateHandle((sel) => {
    const element = document.querySelector(sel) as HTMLElement;
    if (!element) return;

    const eventTypes = [
      'input',
      'keydown',
      'keyup',
      'keypress',
      'focus',
      'blur',
      'paste',
      'copy',
      'cut',
      'beforeinput'
    ];

    eventTypes.forEach(eventType => {
      element.addEventListener(eventType, (event) => {
        (window as any).contentEditableEvents = (window as any).contentEditableEvents || [];
        (window as any).contentEditableEvents.push({
          type: eventType,
          timestamp: Date.now(),
          data: {
            inputType: (event as InputEvent).inputType,
            data: (event as InputEvent).data,
            key: (event as KeyboardEvent).key,
            keyCode: (event as KeyboardEvent).keyCode,
            target: {
              textContent: element.textContent,
              innerHTML: element.innerHTML
            }
          }
        });
      });
    });
  }, selector);

  // Execute the action
  await action();

  // Retrieve captured events
  const capturedEvents = await page.evaluate(() => {
    const events = (window as any).contentEditableEvents || [];
    (window as any).contentEditableEvents = []; // Clear for next test
    return events;
  });

  return capturedEvents;
}

/**
 * Tests contenteditable element accessibility
 */
export async function testContenteditableAccessibility(
  page: Page,
  selector: string
): Promise<{
  hasAriaLabel: boolean;
  hasRole: boolean;
  isKeyboardAccessible: boolean;
  hasProperTabIndex: boolean;
  screenReaderText: string;
}> {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible' });

  const result = await element.evaluate((el: HTMLElement) => {
    return {
      hasAriaLabel: !!el.getAttribute('aria-label'),
      hasRole: !!el.getAttribute('role'),
      isKeyboardAccessible: el.tabIndex >= 0 || el.contentEditable === 'true',
      hasProperTabIndex: el.tabIndex >= 0,
      screenReaderText: el.getAttribute('aria-label') || el.textContent || '',
      ariaDescribedBy: el.getAttribute('aria-describedby'),
      role: el.getAttribute('role')
    };
  });

  // Test keyboard navigation
  await element.focus();
  const isFocused = await element.evaluate((el: HTMLElement) => document.activeElement === el);

  return {
    ...result,
    isKeyboardAccessible: result.isKeyboardAccessible && isFocused
  };
}

/**
 * Utility to wait for contenteditable content to stabilize
 */
export async function waitForContentStable(
  page: Page,
  selector: string,
  timeout = 5000
): Promise<string> {
  const element = page.locator(selector);

  let lastContent = '';
  let stableCount = 0;
  const requiredStableCount = 3; // Content must be stable for 3 checks
  const checkInterval = 100;
  const maxChecks = timeout / checkInterval;

  for (let i = 0; i < maxChecks; i++) {
    const currentContent = await element.textContent() || '';

    if (currentContent === lastContent) {
      stableCount++;
      if (stableCount >= requiredStableCount) {
        return currentContent;
      }
    } else {
      stableCount = 0;
      lastContent = currentContent;
    }

    await page.waitForTimeout(checkInterval);
  }

  throw new Error(`Content did not stabilize within ${timeout}ms`);
}

/**
 * Helper to create a comprehensive contenteditable test report
 */
export async function generateContenteditableTestReport(
  page: Page,
  selector: string,
  testName: string
): Promise<{
  testName: string;
  element: {
    selector: string;
    exists: boolean;
    isVisible: boolean;
    isContentEditable: boolean;
  };
  content: ContentValidationResult;
  accessibility: any;
  performance?: TypingPerformanceMetrics;
  timestamp: string;
}> {
  const element = page.locator(selector);

  // Basic element checks
  const exists = await element.count() > 0;
  const isVisible = exists ? await element.isVisible() : false;

  let content: ContentValidationResult;
  let accessibility: any;

  if (exists && isVisible) {
    content = await validateContenteditableContent(page, selector);
    accessibility = await testContenteditableAccessibility(page, selector);
  } else {
    content = {
      textContent: '',
      innerHTML: '',
      innerText: '',
      isContentEditable: false,
      isFocused: false,
      contentLength: 0,
      errors: ['Element not found or not visible']
    };
    accessibility = null;
  }

  return {
    testName,
    element: {
      selector,
      exists,
      isVisible,
      isContentEditable: content.isContentEditable
    },
    content,
    accessibility,
    timestamp: new Date().toISOString()
  };
}

// Export all utility functions
export {
  ContenteditableTestOptions,
  ContentValidationResult,
  TypingPerformanceMetrics
};