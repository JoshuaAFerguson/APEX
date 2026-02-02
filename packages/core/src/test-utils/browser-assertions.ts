/**
 * Browser state assertion utilities for testing
 *
 * This module provides assertion helpers for verifying browser state
 * in a framework-agnostic way. Functions return assertion results
 * rather than throwing, making them compatible with any test framework.
 */

import { MockPageObject, MockElementState } from './mock-page';

/**
 * Assertion result interface
 */
export interface AssertionResult {
  /** Whether the assertion passed */
  pass: boolean;
  /** Human-readable message describing the result */
  message: string;
  /** Actual value observed */
  actual?: unknown;
  /** Expected value */
  expected?: unknown;
}

/**
 * Navigation state expectation interface
 */
export interface NavigationState {
  /** Expected URL (string or regex) */
  url: string | RegExp;
  /** Expected page title (string or regex) */
  title: string | RegExp;
  /** Whether page should be loaded */
  loaded: boolean;
}

/**
 * Browser state expectation interface
 */
export interface BrowserStateExpectation {
  /** Expected URL (string or regex) */
  url?: string | RegExp;
  /** Expected page title (string or regex) */
  title?: string | RegExp;
  /** Whether errors should be present */
  hasErrors?: boolean;
  /** Selectors that should exist */
  elementExists?: string[];
  /** Selectors that should be visible */
  elementVisible?: string[];
  /** Expected console messages */
  consoleMessages?: Array<{ level: string; text: string | RegExp }>;
  /** Expected localStorage entries */
  localStorage?: Record<string, string>;
  /** Expected cookies */
  cookies?: Array<{ name: string; value?: string }>;
  /** Expected loading state */
  loading?: boolean;
  /** Expected ready state */
  readyState?: 'loading' | 'interactive' | 'complete';
}

/**
 * Helper function to match string or regex
 */
function matchesPattern(actual: string, expected: string | RegExp): boolean {
  if (typeof expected === 'string') {
    return actual === expected;
  }
  return expected.test(actual);
}

/**
 * Asserts navigation state matches expectations
 */
export function assertNavigationState(
  page: MockPageObject,
  expected: Partial<NavigationState>
): AssertionResult {
  const failures: string[] = [];

  if (expected.url !== undefined) {
    if (!matchesPattern(page.url, expected.url)) {
      failures.push(`URL mismatch: expected ${expected.url}, got "${page.url}"`);
    }
  }

  if (expected.title !== undefined) {
    if (!matchesPattern(page.title, expected.title)) {
      failures.push(`Title mismatch: expected ${expected.title}, got "${page.title}"`);
    }
  }

  if (expected.loaded !== undefined) {
    const isLoaded = !page.loading && page.readyState === 'complete';
    if (isLoaded !== expected.loaded) {
      failures.push(`Loading state mismatch: expected loaded=${expected.loaded}, page is ${isLoaded ? 'loaded' : 'not loaded'}`);
    }
  }

  if (failures.length === 0) {
    return {
      pass: true,
      message: 'Navigation state matches expectations',
      actual: { url: page.url, title: page.title, loaded: !page.loading }
    };
  }

  return {
    pass: false,
    message: `Navigation state assertion failed: ${failures.join(', ')}`,
    actual: { url: page.url, title: page.title, loaded: !page.loading },
    expected
  };
}

/**
 * Asserts page content matches expectation
 */
export function assertPageContent(
  page: MockPageObject,
  expectedContent: string | RegExp
): AssertionResult {
  const matches = matchesPattern(page.content, expectedContent);

  return {
    pass: matches,
    message: matches
      ? 'Page content matches expectation'
      : `Page content does not match: expected ${expectedContent}`,
    actual: page.content,
    expected: expectedContent
  };
}

/**
 * Asserts element exists in page
 */
export function assertElementExists(
  page: MockPageObject,
  selector: string
): AssertionResult {
  const exists = page.elements.has(selector);

  return {
    pass: exists,
    message: exists
      ? `Element "${selector}" exists`
      : `Element "${selector}" does not exist`,
    actual: exists,
    expected: true
  };
}

/**
 * Asserts element is visible
 */
export function assertElementVisible(
  page: MockPageObject,
  selector: string
): AssertionResult {
  const element = page.elements.get(selector);

  if (!element) {
    return {
      pass: false,
      message: `Cannot check visibility: element "${selector}" does not exist`,
      actual: undefined,
      expected: true
    };
  }

  return {
    pass: element.visible,
    message: element.visible
      ? `Element "${selector}" is visible`
      : `Element "${selector}" is not visible`,
    actual: element.visible,
    expected: true
  };
}

/**
 * Asserts element text matches expectation
 */
export function assertElementText(
  page: MockPageObject,
  selector: string,
  expected: string | RegExp
): AssertionResult {
  const element = page.elements.get(selector);

  if (!element) {
    return {
      pass: false,
      message: `Cannot check text: element "${selector}" does not exist`,
      actual: undefined,
      expected
    };
  }

  const matches = matchesPattern(element.text, expected);

  return {
    pass: matches,
    message: matches
      ? `Element "${selector}" text matches expectation`
      : `Element "${selector}" text does not match: expected ${expected}, got "${element.text}"`,
    actual: element.text,
    expected
  };
}

/**
 * Asserts element has expected value
 */
export function assertElementValue(
  page: MockPageObject,
  selector: string,
  expected: string
): AssertionResult {
  const element = page.elements.get(selector);

  if (!element) {
    return {
      pass: false,
      message: `Cannot check value: element "${selector}" does not exist`,
      actual: undefined,
      expected
    };
  }

  return {
    pass: element.value === expected,
    message: element.value === expected
      ? `Element "${selector}" has expected value`
      : `Element "${selector}" value mismatch: expected "${expected}", got "${element.value}"`,
    actual: element.value,
    expected
  };
}

/**
 * Asserts page has no errors
 */
export function assertNoErrors(page: MockPageObject): AssertionResult {
  const hasErrors = page.errors.length > 0;

  return {
    pass: !hasErrors,
    message: hasErrors
      ? `Page has ${page.errors.length} error(s): ${page.errors.join(', ')}`
      : 'Page has no errors',
    actual: page.errors,
    expected: []
  };
}

/**
 * Asserts console contains specific message
 */
export function assertConsoleContains(
  page: MockPageObject,
  level: string,
  text: string | RegExp
): AssertionResult {
  const matchingMessages = page.consoleMessages.filter(
    msg => msg.level === level && matchesPattern(msg.text, text)
  );

  const found = matchingMessages.length > 0;

  return {
    pass: found,
    message: found
      ? `Console contains ${level} message matching "${text}"`
      : `Console does not contain ${level} message matching "${text}"`,
    actual: page.consoleMessages.filter(msg => msg.level === level),
    expected: { level, text }
  };
}

/**
 * Asserts localStorage contains expected entry
 */
export function assertLocalStorageItem(
  page: MockPageObject,
  key: string,
  expectedValue?: string
): AssertionResult {
  const actualValue = page.localStorage.get(key);

  if (expectedValue === undefined) {
    // Just check existence
    const exists = actualValue !== undefined;
    return {
      pass: exists,
      message: exists
        ? `localStorage contains key "${key}"`
        : `localStorage does not contain key "${key}"`,
      actual: actualValue,
      expected: 'any value'
    };
  }

  // Check specific value
  const matches = actualValue === expectedValue;
  return {
    pass: matches,
    message: matches
      ? `localStorage "${key}" has expected value`
      : `localStorage "${key}" mismatch: expected "${expectedValue}", got "${actualValue}"`,
    actual: actualValue,
    expected: expectedValue
  };
}

/**
 * Asserts cookie exists with optional value check
 */
export function assertCookie(
  page: MockPageObject,
  name: string,
  expectedValue?: string
): AssertionResult {
  const cookie = page.cookies.find(c => c.name === name);

  if (!cookie) {
    return {
      pass: false,
      message: `Cookie "${name}" not found`,
      actual: page.cookies.map(c => c.name),
      expected: name
    };
  }

  if (expectedValue === undefined) {
    return {
      pass: true,
      message: `Cookie "${name}" exists`,
      actual: cookie.value
    };
  }

  const matches = cookie.value === expectedValue;
  return {
    pass: matches,
    message: matches
      ? `Cookie "${name}" has expected value`
      : `Cookie "${name}" value mismatch: expected "${expectedValue}", got "${cookie.value}"`,
    actual: cookie.value,
    expected: expectedValue
  };
}

/**
 * Comprehensive browser state assertion
 */
export function assertBrowserState(
  page: MockPageObject,
  expected: BrowserStateExpectation
): AssertionResult {
  const results: AssertionResult[] = [];

  // Check URL
  if (expected.url !== undefined) {
    const urlResult = assertNavigationState(page, { url: expected.url });
    if (!urlResult.pass) results.push(urlResult);
  }

  // Check title
  if (expected.title !== undefined) {
    const titleResult = assertNavigationState(page, { title: expected.title });
    if (!titleResult.pass) results.push(titleResult);
  }

  // Check errors
  if (expected.hasErrors !== undefined) {
    const hasErrors = page.errors.length > 0;
    if (hasErrors !== expected.hasErrors) {
      results.push({
        pass: false,
        message: `Error state mismatch: expected hasErrors=${expected.hasErrors}, got ${hasErrors}`,
        actual: hasErrors,
        expected: expected.hasErrors
      });
    }
  }

  // Check element existence
  if (expected.elementExists) {
    expected.elementExists.forEach(selector => {
      const existsResult = assertElementExists(page, selector);
      if (!existsResult.pass) results.push(existsResult);
    });
  }

  // Check element visibility
  if (expected.elementVisible) {
    expected.elementVisible.forEach(selector => {
      const visibleResult = assertElementVisible(page, selector);
      if (!visibleResult.pass) results.push(visibleResult);
    });
  }

  // Check console messages
  if (expected.consoleMessages) {
    expected.consoleMessages.forEach(expectedMsg => {
      const consoleResult = assertConsoleContains(page, expectedMsg.level, expectedMsg.text);
      if (!consoleResult.pass) results.push(consoleResult);
    });
  }

  // Check localStorage
  if (expected.localStorage) {
    Object.entries(expected.localStorage).forEach(([key, value]) => {
      const lsResult = assertLocalStorageItem(page, key, value);
      if (!lsResult.pass) results.push(lsResult);
    });
  }

  // Check cookies
  if (expected.cookies) {
    expected.cookies.forEach(expectedCookie => {
      const cookieResult = assertCookie(page, expectedCookie.name, expectedCookie.value);
      if (!cookieResult.pass) results.push(cookieResult);
    });
  }

  // Check loading state
  if (expected.loading !== undefined) {
    if (page.loading !== expected.loading) {
      results.push({
        pass: false,
        message: `Loading state mismatch: expected ${expected.loading}, got ${page.loading}`,
        actual: page.loading,
        expected: expected.loading
      });
    }
  }

  // Check ready state
  if (expected.readyState !== undefined) {
    if (page.readyState !== expected.readyState) {
      results.push({
        pass: false,
        message: `Ready state mismatch: expected "${expected.readyState}", got "${page.readyState}"`,
        actual: page.readyState,
        expected: expected.readyState
      });
    }
  }

  if (results.length === 0) {
    return {
      pass: true,
      message: 'All browser state assertions passed',
      actual: page
    };
  }

  const failureMessages = results.map(r => r.message).join('; ');
  return {
    pass: false,
    message: `Browser state assertion failed: ${failureMessages}`,
    actual: page,
    expected
  };
}