/**
 * @apexcli/browser - Browser State Assertions
 *
 * Framework-agnostic assertion helpers for verifying browser state
 */

import type { MockPageObject, MockElementState } from './mock-page-objects.js';

export interface AssertionResult {
  pass: boolean;
  message: string;
  actual?: unknown;
  expected?: unknown;
}

export interface NavigationState {
  url: string | RegExp;
  title: string | RegExp;
  loaded: boolean;
}

export interface BrowserStateExpectation {
  url?: string | RegExp;
  title?: string | RegExp;
  hasErrors?: boolean;
  elementExists?: string[];
  elementVisible?: string[];
  consoleMessages?: Array<{ level: string; text: string | RegExp }>;
}

/**
 * Assert that the page navigation state matches expectations
 */
export function assertNavigationState(
  page: MockPageObject,
  expected: Partial<NavigationState>
): AssertionResult {
  const failures: string[] = [];

  // Check URL
  if (expected.url !== undefined) {
    const urlMatches = typeof expected.url === 'string'
      ? page.url === expected.url
      : expected.url.test(page.url);

    if (!urlMatches) {
      failures.push(`Expected URL to match ${expected.url}, but got "${page.url}"`);
    }
  }

  // Check title
  if (expected.title !== undefined) {
    const titleMatches = typeof expected.title === 'string'
      ? page.title === expected.title
      : expected.title.test(page.title);

    if (!titleMatches) {
      failures.push(`Expected title to match ${expected.title}, but got "${page.title}"`);
    }
  }

  return {
    pass: failures.length === 0,
    message: failures.length === 0
      ? 'Navigation state matches expectations'
      : failures.join('; '),
    actual: { url: page.url, title: page.title },
    expected
  };
}

/**
 * Assert that the page content contains expected text or matches a pattern
 */
export function assertPageContent(
  page: MockPageObject,
  expectedContent: string | RegExp
): AssertionResult {
  const contentMatches = typeof expectedContent === 'string'
    ? page.content.includes(expectedContent)
    : expectedContent.test(page.content);

  return {
    pass: contentMatches,
    message: contentMatches
      ? `Page content contains expected content`
      : `Page content does not contain expected content: ${expectedContent}`,
    actual: page.content,
    expected: expectedContent
  };
}

/**
 * Assert that an element exists on the page
 */
export function assertElementExists(
  page: MockPageObject,
  selector: string
): AssertionResult {
  const elementExists = page.elements.has(selector);

  return {
    pass: elementExists,
    message: elementExists
      ? `Element "${selector}" exists`
      : `Element "${selector}" does not exist`,
    actual: elementExists,
    expected: true
  };
}

/**
 * Assert that an element is visible on the page
 */
export function assertElementVisible(
  page: MockPageObject,
  selector: string
): AssertionResult {
  const element = page.elements.get(selector);

  if (!element) {
    return {
      pass: false,
      message: `Element "${selector}" does not exist`,
      actual: undefined,
      expected: 'element to exist and be visible'
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
 * Assert that an element's text content matches expected value
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
      message: `Element "${selector}" does not exist`,
      actual: undefined,
      expected
    };
  }

  const textMatches = typeof expected === 'string'
    ? element.text === expected
    : expected.test(element.text);

  return {
    pass: textMatches,
    message: textMatches
      ? `Element "${selector}" text matches expected value`
      : `Element "${selector}" text "${element.text}" does not match expected: ${expected}`,
    actual: element.text,
    expected
  };
}

/**
 * Assert that the page has no errors
 */
export function assertNoErrors(page: MockPageObject): AssertionResult {
  const hasNoErrors = page.errors.length === 0;

  return {
    pass: hasNoErrors,
    message: hasNoErrors
      ? 'Page has no errors'
      : `Page has ${page.errors.length} error(s): ${page.errors.join(', ')}`,
    actual: page.errors,
    expected: []
  };
}

/**
 * Assert that the console contains a specific message
 */
export function assertConsoleContains(
  page: MockPageObject,
  level: string,
  text: string | RegExp
): AssertionResult {
  const matchingMessages = page.consoleMessages.filter(msg => {
    if (msg.level !== level) return false;

    return typeof text === 'string'
      ? msg.text.includes(text)
      : text.test(msg.text);
  });

  const hasMatchingMessage = matchingMessages.length > 0;

  return {
    pass: hasMatchingMessage,
    message: hasMatchingMessage
      ? `Console contains ${level} message matching: ${text}`
      : `Console does not contain ${level} message matching: ${text}`,
    actual: page.consoleMessages.filter(msg => msg.level === level),
    expected: { level, text }
  };
}

/**
 * Assert multiple browser state conditions at once
 */
export function assertBrowserState(
  page: MockPageObject,
  expected: BrowserStateExpectation
): AssertionResult {
  const failures: string[] = [];

  // Check URL
  if (expected.url !== undefined) {
    const urlResult = assertNavigationState(page, { url: expected.url });
    if (!urlResult.pass) {
      failures.push(urlResult.message);
    }
  }

  // Check title
  if (expected.title !== undefined) {
    const titleResult = assertNavigationState(page, { title: expected.title });
    if (!titleResult.pass) {
      failures.push(titleResult.message);
    }
  }

  // Check error state
  if (expected.hasErrors !== undefined) {
    const hasErrors = page.errors.length > 0;
    if (hasErrors !== expected.hasErrors) {
      failures.push(
        expected.hasErrors
          ? `Expected page to have errors, but found none`
          : `Expected page to have no errors, but found: ${page.errors.join(', ')}`
      );
    }
  }

  // Check element existence
  if (expected.elementExists) {
    expected.elementExists.forEach(selector => {
      const existsResult = assertElementExists(page, selector);
      if (!existsResult.pass) {
        failures.push(existsResult.message);
      }
    });
  }

  // Check element visibility
  if (expected.elementVisible) {
    expected.elementVisible.forEach(selector => {
      const visibleResult = assertElementVisible(page, selector);
      if (!visibleResult.pass) {
        failures.push(visibleResult.message);
      }
    });
  }

  // Check console messages
  if (expected.consoleMessages) {
    expected.consoleMessages.forEach(expectedMsg => {
      const consoleResult = assertConsoleContains(page, expectedMsg.level, expectedMsg.text);
      if (!consoleResult.pass) {
        failures.push(consoleResult.message);
      }
    });
  }

  return {
    pass: failures.length === 0,
    message: failures.length === 0
      ? 'All browser state assertions passed'
      : failures.join('; '),
    actual: {
      url: page.url,
      title: page.title,
      errors: page.errors,
      elements: Array.from(page.elements.keys()),
      consoleMessages: page.consoleMessages
    },
    expected
  };
}

/**
 * Assert that an element has specific attributes
 */
export function assertElementAttributes(
  page: MockPageObject,
  selector: string,
  expectedAttributes: Record<string, string>
): AssertionResult {
  const element = page.elements.get(selector);

  if (!element) {
    return {
      pass: false,
      message: `Element "${selector}" does not exist`,
      actual: undefined,
      expected: expectedAttributes
    };
  }

  const failures: string[] = [];

  Object.entries(expectedAttributes).forEach(([attr, expectedValue]) => {
    const actualValue = element.attributes[attr];
    if (actualValue !== expectedValue) {
      failures.push(
        `Expected attribute "${attr}" to be "${expectedValue}", but got "${actualValue}"`
      );
    }
  });

  return {
    pass: failures.length === 0,
    message: failures.length === 0
      ? `Element "${selector}" has expected attributes`
      : failures.join('; '),
    actual: element.attributes,
    expected: expectedAttributes
  };
}

/**
 * Assert that an element has a specific tag name
 */
export function assertElementTagName(
  page: MockPageObject,
  selector: string,
  expectedTagName: string
): AssertionResult {
  const element = page.elements.get(selector);

  if (!element) {
    return {
      pass: false,
      message: `Element "${selector}" does not exist`,
      actual: undefined,
      expected: expectedTagName
    };
  }

  const tagMatches = element.tagName.toLowerCase() === expectedTagName.toLowerCase();

  return {
    pass: tagMatches,
    message: tagMatches
      ? `Element "${selector}" has expected tag name "${expectedTagName}"`
      : `Element "${selector}" has tag name "${element.tagName}", expected "${expectedTagName}"`,
    actual: element.tagName,
    expected: expectedTagName
  };
}

/**
 * Assert that an element is enabled/disabled
 */
export function assertElementEnabled(
  page: MockPageObject,
  selector: string,
  shouldBeEnabled: boolean = true
): AssertionResult {
  const element = page.elements.get(selector);

  if (!element) {
    return {
      pass: false,
      message: `Element "${selector}" does not exist`,
      actual: undefined,
      expected: shouldBeEnabled
    };
  }

  const enabledMatches = element.enabled === shouldBeEnabled;

  return {
    pass: enabledMatches,
    message: enabledMatches
      ? `Element "${selector}" is ${shouldBeEnabled ? 'enabled' : 'disabled'} as expected`
      : `Element "${selector}" is ${element.enabled ? 'enabled' : 'disabled'}, expected ${shouldBeEnabled ? 'enabled' : 'disabled'}`,
    actual: element.enabled,
    expected: shouldBeEnabled
  };
}

/**
 * Assert that the page has specific cookies
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
      message: `Cookie "${name}" does not exist`,
      actual: page.cookies.map(c => c.name),
      expected: name
    };
  }

  if (expectedValue !== undefined && cookie.value !== expectedValue) {
    return {
      pass: false,
      message: `Cookie "${name}" has value "${cookie.value}", expected "${expectedValue}"`,
      actual: cookie.value,
      expected: expectedValue
    };
  }

  return {
    pass: true,
    message: expectedValue !== undefined
      ? `Cookie "${name}" has expected value "${expectedValue}"`
      : `Cookie "${name}" exists`,
    actual: cookie.value,
    expected: expectedValue
  };
}

/**
 * Assert that localStorage contains a specific key/value
 */
export function assertLocalStorage(
  page: MockPageObject,
  key: string,
  expectedValue?: string
): AssertionResult {
  const actualValue = page.localStorage.get(key);

  if (actualValue === undefined) {
    return {
      pass: false,
      message: `localStorage key "${key}" does not exist`,
      actual: Array.from(page.localStorage.keys()),
      expected: key
    };
  }

  if (expectedValue !== undefined && actualValue !== expectedValue) {
    return {
      pass: false,
      message: `localStorage key "${key}" has value "${actualValue}", expected "${expectedValue}"`,
      actual: actualValue,
      expected: expectedValue
    };
  }

  return {
    pass: true,
    message: expectedValue !== undefined
      ? `localStorage key "${key}" has expected value "${expectedValue}"`
      : `localStorage key "${key}" exists`,
    actual: actualValue,
    expected: expectedValue
  };
}