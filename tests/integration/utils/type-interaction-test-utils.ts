/**
 * @fileoverview Shared Test Utilities for Type Interaction Testing
 *
 * This module provides specialized utilities for type interaction integration tests:
 * - Test scenario execution and validation
 * - Input state monitoring and assertion helpers
 * - Keyboard shortcut testing utilities
 * - Performance measurement for typing operations
 * - Cross-browser compatibility testing helpers
 */

import { Page, Locator } from 'playwright';
import { expect } from 'vitest';

// Type interaction test interfaces
export interface TypeInteractionTest {
  name: string;
  description: string;
  selector: string;
  inputText: string;
  expectedOutput?: string;
  validationRules?: ValidationRule[];
  performanceThreshold?: number;
}

export interface ValidationRule {
  type: 'required' | 'pattern' | 'length' | 'email' | 'number' | 'custom';
  value?: string | number;
  message?: string;
  validator?: (value: string) => boolean;
}

export interface TypingPerformanceMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  charactersTyped: number;
  eventsGenerated: number;
  charactersPerSecond: number;
  eventsPerSecond: number;
}

export interface InputStateSnapshot {
  value: string;
  isValid: boolean;
  isFocused: boolean;
  isDisabled: boolean;
  isReadonly: boolean;
  hasError: boolean;
  errorMessage?: string;
  characterCount: number;
  timestamp: number;
}

/**
 * Type Interaction Test Utilities Class
 */
export class TypeInteractionTestUtils {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Captures the current state of an input element
   */
  async captureInputState(selector: string): Promise<InputStateSnapshot> {
    return await this.page.evaluate((sel) => {
      const element = document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement;
      if (!element) {
        throw new Error(`Element not found: ${sel}`);
      }

      const errorElement = document.getElementById(element.id + '-error');
      const errorMessage = errorElement?.textContent || '';

      return {
        value: element.value || (element as any).textContent || '',
        isValid: element.validity ? element.validity.valid : true,
        isFocused: document.activeElement === element,
        isDisabled: element.disabled || false,
        isReadonly: element.readOnly || false,
        hasError: !element.validity?.valid || !!errorMessage,
        errorMessage: errorMessage || undefined,
        characterCount: (element.value || (element as any).textContent || '').length,
        timestamp: Date.now()
      };
    }, selector);
  }

  /**
   * Compares two input state snapshots and asserts differences
   */
  assertStateChanged(
    beforeState: InputStateSnapshot,
    afterState: InputStateSnapshot,
    expectedChanges: Partial<InputStateSnapshot>
  ): void {
    // Verify timestamp progression
    expect(afterState.timestamp).toBeGreaterThan(beforeState.timestamp);

    // Check specific expected changes
    Object.entries(expectedChanges).forEach(([key, expectedValue]) => {
      if (key !== 'timestamp') {
        expect(afterState[key as keyof InputStateSnapshot]).toBe(expectedValue);
      }
    });
  }

  /**
   * Waits for an input element to reach a specific state
   */
  async waitForInputState(
    selector: string,
    expectedState: Partial<InputStateSnapshot>,
    timeout: number = 10000
  ): Promise<InputStateSnapshot> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const currentState = await this.captureInputState(selector);

      const stateMatches = Object.entries(expectedState).every(([key, expectedValue]) => {
        return currentState[key as keyof InputStateSnapshot] === expectedValue;
      });

      if (stateMatches) {
        return currentState;
      }

      await this.page.waitForTimeout(100);
    }

    const finalState = await this.captureInputState(selector);
    throw new Error(`Timeout waiting for input state. Current state: ${JSON.stringify(finalState)}, Expected: ${JSON.stringify(expectedState)}`);
  }

  /**
   * Validates an input element against a set of validation rules
   */
  async validateInput(selector: string, rules: ValidationRule[]): Promise<{ isValid: boolean; errors: string[] }> {
    const element = this.page.locator(selector);
    const value = await element.inputValue();
    const errors: string[] = [];

    for (const rule of rules) {
      let isRuleValid = true;
      let errorMessage = rule.message || `Validation failed for rule: ${rule.type}`;

      switch (rule.type) {
        case 'required':
          isRuleValid = value.trim().length > 0;
          errorMessage = rule.message || 'Field is required';
          break;

        case 'pattern':
          if (rule.value && typeof rule.value === 'string') {
            const regex = new RegExp(rule.value);
            isRuleValid = regex.test(value);
            errorMessage = rule.message || 'Input does not match required pattern';
          }
          break;

        case 'length':
          if (rule.value && typeof rule.value === 'number') {
            isRuleValid = value.length >= rule.value;
            errorMessage = rule.message || `Input must be at least ${rule.value} characters`;
          }
          break;

        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          isRuleValid = emailRegex.test(value);
          errorMessage = rule.message || 'Please enter a valid email address';
          break;

        case 'number':
          const num = parseFloat(value);
          isRuleValid = !isNaN(num);
          errorMessage = rule.message || 'Please enter a valid number';
          break;

        case 'custom':
          if (rule.validator) {
            isRuleValid = rule.validator(value);
            errorMessage = rule.message || 'Custom validation failed';
          }
          break;
      }

      if (!isRuleValid) {
        errors.push(errorMessage);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Measures typing performance for a given input operation
   */
  async measureTypingPerformance(
    selector: string,
    typingAction: () => Promise<void>
  ): Promise<TypingPerformanceMetrics> {
    // Clear any existing event log
    await this.page.evaluate(() => {
      if (window.testUtils) {
        window.testUtils.clearEventLog();
      }
    });

    const startTime = Date.now();
    await typingAction();
    const endTime = Date.now();

    const duration = endTime - startTime;
    const finalValue = await this.page.locator(selector).inputValue();
    const charactersTyped = finalValue.length;

    // Get event log if available
    const eventLog = await this.page.evaluate(() => {
      return window.testUtils ? window.testUtils.getEventLog() : [];
    });

    const eventsGenerated = eventLog.length;

    return {
      startTime,
      endTime,
      duration,
      charactersTyped,
      eventsGenerated,
      charactersPerSecond: charactersTyped / (duration / 1000),
      eventsPerSecond: eventsGenerated / (duration / 1000)
    };
  }

  /**
   * Tests keyboard shortcuts and special key combinations
   */
  async testKeyboardShortcuts(selector: string): Promise<{ [shortcut: string]: boolean }> {
    const element = this.page.locator(selector);
    const results: { [shortcut: string]: boolean } = {};

    // Test Ctrl+A (Select All)
    await element.clear();
    await element.type('Test content for shortcuts');
    await element.focus();
    await this.page.keyboard.press('Control+a');
    await this.page.keyboard.type('Replaced');
    const selectAllResult = await element.inputValue();
    results['Ctrl+A'] = selectAllResult === 'Replaced';

    // Test Ctrl+C and Ctrl+V (Copy/Paste)
    await element.clear();
    await element.type('Copy this text');
    await element.focus();
    await this.page.keyboard.press('Control+a');
    await this.page.keyboard.press('Control+c');
    await element.clear();
    await this.page.keyboard.press('Control+v');
    const pasteResult = await element.inputValue();
    results['Ctrl+C/V'] = pasteResult === 'Copy this text';

    // Test Escape key (should not affect text content in most inputs)
    await element.clear();
    await element.type('Before escape');
    await this.page.keyboard.press('Escape');
    const escapeResult = await element.inputValue();
    results['Escape'] = escapeResult === 'Before escape';

    // Test Home/End keys
    await element.clear();
    await element.type('Test text');
    await this.page.keyboard.press('Home');
    await this.page.keyboard.type('Start ');
    const homeResult = await element.inputValue();
    results['Home'] = homeResult === 'Start Test text';

    return results;
  }

  /**
   * Tests cross-browser compatibility for typing interactions
   */
  async testCrossBrowserCompatibility(selector: string, testText: string): Promise<boolean> {
    try {
      const element = this.page.locator(selector);

      // Test basic typing
      await element.clear();
      await element.type(testText);
      const basicResult = await element.inputValue();

      if (basicResult !== testText) {
        return false;
      }

      // Test special characters and Unicode
      const unicodeText = '🌍 Hello 世界 café';
      await element.clear();
      await element.type(unicodeText);
      const unicodeResult = await element.inputValue();

      return unicodeResult === unicodeText;
    } catch (error) {
      console.warn('Cross-browser compatibility test failed:', error);
      return false;
    }
  }
}

/**
 * Typing Scenario Runner Class
 */
export class TypingScenarioRunner {
  private page: Page;
  private testUtils: TypeInteractionTestUtils;

  constructor(page: Page) {
    this.page = page;
    this.testUtils = new TypeInteractionTestUtils(page);
  }

  /**
   * Executes a comprehensive typing test scenario
   */
  async runTypingScenario(test: TypeInteractionTest): Promise<{
    success: boolean;
    actualOutput: string;
    expectedOutput: string;
    validationResults?: { isValid: boolean; errors: string[] };
    performanceMetrics?: TypingPerformanceMetrics;
    error?: string;
  }> {
    try {
      const element = this.page.locator(test.selector);
      await element.waitFor({ state: 'visible', timeout: 10000 });

      // Capture initial state
      const initialState = await this.testUtils.captureInputState(test.selector);

      // Perform typing with performance measurement
      const performanceMetrics = await this.testUtils.measureTypingPerformance(
        test.selector,
        async () => {
          await element.clear();
          await element.type(test.inputText);
        }
      );

      // Get actual output
      const actualOutput = await element.inputValue();
      const expectedOutput = test.expectedOutput || test.inputText;

      // Validate if rules are provided
      let validationResults;
      if (test.validationRules) {
        validationResults = await this.testUtils.validateInput(test.selector, test.validationRules);
      }

      // Check performance threshold
      const performanceOk = !test.performanceThreshold ||
        performanceMetrics.duration <= test.performanceThreshold;

      const success = actualOutput === expectedOutput &&
        performanceOk &&
        (!validationResults || validationResults.isValid);

      return {
        success,
        actualOutput,
        expectedOutput,
        validationResults,
        performanceMetrics,
        error: success ? undefined : 'Test assertion failed'
      };

    } catch (error) {
      return {
        success: false,
        actualOutput: '',
        expectedOutput: test.expectedOutput || test.inputText,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Runs multiple typing scenarios in sequence
   */
  async runMultipleScenarios(tests: TypeInteractionTest[]): Promise<Array<{
    test: TypeInteractionTest;
    result: Awaited<ReturnType<TypingScenarioRunner['runTypingScenario']>>;
  }>> {
    const results = [];

    for (const test of tests) {
      const result = await this.runTypingScenario(test);
      results.push({ test, result });

      // Brief pause between scenarios
      await this.page.waitForTimeout(100);
    }

    return results;
  }
}

/**
 * Input Validation Tester Class
 */
export class InputValidationTester {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Tests various validation scenarios for an input field
   */
  async testValidationScenarios(selector: string): Promise<{
    requiredField: boolean;
    patternValidation: boolean;
    lengthValidation: boolean;
    typeValidation: boolean;
  }> {
    const element = this.page.locator(selector);
    const results = {
      requiredField: false,
      patternValidation: false,
      lengthValidation: false,
      typeValidation: false
    };

    try {
      // Test required field validation
      const isRequired = await element.getAttribute('required');
      if (isRequired !== null) {
        await element.clear();
        await element.blur();
        const validity = await element.evaluate((el: HTMLInputElement) => el.validity.valid);
        results.requiredField = !validity; // Should be invalid when empty
      }

      // Test pattern validation
      const pattern = await element.getAttribute('pattern');
      if (pattern) {
        await element.clear();
        await element.type('invalid-pattern');
        await element.blur();
        const validity = await element.evaluate((el: HTMLInputElement) => el.validity.valid);
        results.patternValidation = !validity; // Should be invalid for wrong pattern
      }

      // Test length validation
      const maxLength = await element.getAttribute('maxlength');
      if (maxLength) {
        const longText = 'a'.repeat(parseInt(maxLength) + 5);
        await element.clear();
        await element.type(longText);
        const actualValue = await element.inputValue();
        results.lengthValidation = actualValue.length <= parseInt(maxLength);
      }

      // Test type-specific validation (for email, number, etc.)
      const inputType = await element.getAttribute('type');
      if (inputType === 'email') {
        await element.clear();
        await element.type('invalid-email');
        await element.blur();
        const validity = await element.evaluate((el: HTMLInputElement) => el.validity.valid);
        results.typeValidation = !validity; // Should be invalid for bad email
      }

    } catch (error) {
      console.warn('Validation testing failed:', error);
    }

    return results;
  }
}

/**
 * Keyboard Shortcut Tester Class
 */
export class KeyboardShortcutTester {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Tests comprehensive keyboard shortcuts across different input types
   */
  async testAllKeyboardShortcuts(selectors: string[]): Promise<{
    [selector: string]: { [shortcut: string]: boolean };
  }> {
    const results: { [selector: string]: { [shortcut: string]: boolean } } = {};
    const testUtils = new TypeInteractionTestUtils(this.page);

    for (const selector of selectors) {
      try {
        results[selector] = await testUtils.testKeyboardShortcuts(selector);
      } catch (error) {
        console.warn(`Keyboard shortcut testing failed for ${selector}:`, error);
        results[selector] = {};
      }
    }

    return results;
  }

  /**
   * Tests tab navigation between form fields
   */
  async testTabNavigation(selectors: string[]): Promise<{
    correctOrder: boolean;
    allFieldsReached: boolean;
    navigationPath: string[];
  }> {
    const navigationPath: string[] = [];

    try {
      // Start from first element
      await this.page.locator(selectors[0]).focus();

      for (let i = 0; i < selectors.length; i++) {
        const focusedId = await this.page.evaluate(() => document.activeElement?.id || 'none');
        navigationPath.push(focusedId);

        if (i < selectors.length - 1) {
          await this.page.keyboard.press('Tab');
          await this.page.waitForTimeout(50); // Brief pause for focus to settle
        }
      }

      const correctOrder = navigationPath.every((id, index) => {
        const expectedId = selectors[index];
        return id === expectedId;
      });

      const allFieldsReached = selectors.every(id => navigationPath.includes(id));

      return {
        correctOrder,
        allFieldsReached,
        navigationPath
      };

    } catch (error) {
      console.warn('Tab navigation testing failed:', error);
      return {
        correctOrder: false,
        allFieldsReached: false,
        navigationPath
      };
    }
  }
}

// Export utility functions for common test operations
export async function waitForTypingComplete(
  page: Page,
  selector: string,
  expectedValue: string,
  timeout: number = 5000
): Promise<boolean> {
  try {
    await page.waitForFunction(
      ({ sel, expected }) => {
        const element = document.querySelector(sel) as HTMLInputElement;
        return element && element.value === expected;
      },
      { sel: selector, expected: expectedValue },
      { timeout }
    );
    return true;
  } catch {
    return false;
  }
}

export async function clearAllInputs(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('input, textarea, [contenteditable]').forEach((el: any) => {
      if (!el.disabled && !el.readOnly) {
        if (el.contentEditable === 'true') {
          el.innerHTML = '';
        } else {
          el.value = '';
        }
      }
    });
  });
}

export async function fillAllInputsWithTestData(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (window.testUtils && typeof window.testUtils.fillTestData === 'function') {
      window.testUtils.fillTestData();
    }
  });
}

// Export all classes and utilities
export {
  TypeInteractionTest,
  ValidationRule,
  TypingPerformanceMetrics,
  InputStateSnapshot,
};