/**
 * Comprehensive tests for browser assertion helpers
 * Tests browser-specific assertion utilities for page state validation
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Create minimal mock types for testing browser assertions
interface MockElementState {
  text: string;
  visible: boolean;
  enabled: boolean;
  tagName: string;
  attributes: Record<string, string>;
}

interface MockPageObject {
  url: string;
  title: string;
  content: string;
  elements: Map<string, MockElementState>;
  errors: string[];
  consoleMessages: Array<{ level: string; text: string }>;
  cookies: Array<{ name: string; value: string }>;
  localStorage: Map<string, string>;
}

interface AssertionResult {
  success: boolean;
  message: string;
  actual?: unknown;
  expected?: unknown;
}

interface NavigationState {
  url: string | RegExp;
  title: string | RegExp;
  loaded: boolean;
}

interface BrowserStateExpectation {
  url?: string | RegExp;
  title?: string | RegExp;
  hasErrors?: boolean;
  elementExists?: string[];
  elementVisible?: string[];
  consoleMessages?: Array<{ level: string; text: string | RegExp }>;
}

// Mock implementation of browser assertions for testing
function createMockPage(options: Partial<MockPageObject> = {}): MockPageObject {
  return {
    url: 'https://example.com',
    title: 'Test Page',
    content: '<html><body>Test content</body></html>',
    elements: new Map(),
    errors: [],
    consoleMessages: [],
    cookies: [],
    localStorage: new Map(),
    ...options
  };
}

function addElementToMockPage(
  page: MockPageObject,
  selector: string,
  state: Partial<MockElementState> = {}
): void {
  page.elements.set(selector, {
    text: '',
    visible: true,
    enabled: true,
    tagName: 'DIV',
    attributes: {},
    ...state
  });
}

function addConsoleMessage(page: MockPageObject, level: string, text: string): void {
  page.consoleMessages.push({ level, text });
}

function addError(page: MockPageObject, error: string): void {
  page.errors.push(error);
}

function setCookie(page: MockPageObject, name: string, value: string): void {
  page.cookies.push({ name, value });
}

function setLocalStorage(page: MockPageObject, key: string, value: string): void {
  page.localStorage.set(key, value);
}

// Mock implementation of browser assertion functions
function assertNavigationState(
  page: MockPageObject,
  expected: Partial<NavigationState>
): AssertionResult {
  const failures: string[] = [];

  if (expected.url !== undefined) {
    const urlMatches = typeof expected.url === 'string'
      ? page.url === expected.url
      : expected.url.test(page.url);

    if (!urlMatches) {
      failures.push(`Expected URL to match ${expected.url}, but got "${page.url}"`);
    }
  }

  if (expected.title !== undefined) {
    const titleMatches = typeof expected.title === 'string'
      ? page.title === expected.title
      : expected.title.test(page.title);

    if (!titleMatches) {
      failures.push(`Expected title to match ${expected.title}, but got "${page.title}"`);
    }
  }

  return {
    success: failures.length === 0,
    message: failures.length === 0
      ? 'Navigation state matches expected state'
      : failures.join('; '),
    actual: { url: page.url, title: page.title },
    expected
  };
}

function assertPageContent(
  page: MockPageObject,
  expectedContent: string | RegExp
): AssertionResult {
  const contentMatches = typeof expectedContent === 'string'
    ? page.content.includes(expectedContent)
    : expectedContent.test(page.content);

  return {
    success: contentMatches,
    message: contentMatches
      ? `Page content contains expected text`
      : `Page content does not contain expected content: ${expectedContent}`,
    actual: page.content,
    expected: expectedContent
  };
}

function assertElementExists(
  page: MockPageObject,
  selector: string
): AssertionResult {
  const elementExists = page.elements.has(selector);

  return {
    success: elementExists,
    message: elementExists
      ? `Element found: ${selector}`
      : `Element not found: ${selector}`,
    actual: elementExists,
    expected: true
  };
}

function assertElementVisible(
  page: MockPageObject,
  selector: string
): AssertionResult {
  const element = page.elements.get(selector);

  if (!element) {
    return {
      success: false,
      message: `Element not found: ${selector}`,
      actual: undefined,
      expected: 'element to exist and be visible'
    };
  }

  return {
    success: element.visible,
    message: element.visible
      ? `Element "${selector}" is visible`
      : `Element "${selector}" is not visible`,
    actual: element.visible,
    expected: true
  };
}

function assertBrowserState(
  page: MockPageObject,
  expected: BrowserStateExpectation
): AssertionResult {
  const failures: string[] = [];

  if (expected.url !== undefined) {
    const urlResult = assertNavigationState(page, { url: expected.url });
    if (!urlResult.success) {
      failures.push(urlResult.message);
    }
  }

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

  if (expected.elementExists) {
    expected.elementExists.forEach(selector => {
      const existsResult = assertElementExists(page, selector);
      if (!existsResult.success) {
        failures.push(existsResult.message);
      }
    });
  }

  return {
    success: failures.length === 0,
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

describe('Browser Assertion Helpers', () => {
  let page: MockPageObject;

  beforeEach(() => {
    page = createMockPage({
      url: 'https://example.com/test',
      title: 'Test Page',
      content: '<html><body><h1>Welcome</h1><p>Test content</p></body></html>'
    });
  });

  describe('assertNavigationState', () => {
    it('should pass when URL matches exactly', () => {
      const result = assertNavigationState(page, { url: 'https://example.com/test' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Navigation state matches expected state');
      expect(result.actual).toEqual({
        url: 'https://example.com/test',
        title: 'Test Page'
      });
    });

    it('should pass when URL matches regex pattern', () => {
      const result = assertNavigationState(page, { url: /example\.com\/test/ });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Navigation state matches expected state');
    });

    it('should fail when URL does not match', () => {
      const result = assertNavigationState(page, { url: 'https://different.com' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Expected URL to match https://different.com');
      expect(result.message).toContain('but got "https://example.com/test"');
    });

    it('should pass when title matches exactly', () => {
      const result = assertNavigationState(page, { title: 'Test Page' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Navigation state matches expected state');
    });

    it('should pass when title matches regex pattern', () => {
      const result = assertNavigationState(page, { title: /Test.*/ });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Navigation state matches expected state');
    });

    it('should fail when title does not match', () => {
      const result = assertNavigationState(page, { title: 'Different Title' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Expected title to match Different Title');
      expect(result.message).toContain('but got "Test Page"');
    });

    it('should validate multiple navigation properties together', () => {
      const result = assertNavigationState(page, {
        url: 'https://example.com/test',
        title: 'Test Page'
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Navigation state matches expected state');
    });

    it('should fail if any navigation property fails', () => {
      const result = assertNavigationState(page, {
        url: 'https://example.com/test',
        title: 'Wrong Title'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Expected title to match Wrong Title');
    });

    it('should handle empty expectations gracefully', () => {
      const result = assertNavigationState(page, {});

      expect(result.success).toBe(true);
      expect(result.message).toBe('Navigation state matches expected state');
    });

    it('should handle complex URL patterns', () => {
      // Test with query parameters
      const pageWithQuery = createMockPage({
        url: 'https://example.com/search?q=test&type=full'
      });

      const result = assertNavigationState(pageWithQuery, {
        url: /\/search\?.*q=test/
      });

      expect(result.success).toBe(true);
    });

    it('should handle international domain names', () => {
      const pageWithIDN = createMockPage({
        url: 'https://тест.example.com'
      });

      const result = assertNavigationState(pageWithIDN, {
        url: 'https://тест.example.com'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('assertPageContent', () => {
    it('should pass when content contains expected string', () => {
      const result = assertPageContent(page, 'Welcome');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Page content contains expected text');
      expect(result.actual).toBe(page.content);
      expect(result.expected).toBe('Welcome');
    });

    it('should pass when content matches regex pattern', () => {
      const result = assertPageContent(page, /<h1>.*Welcome.*<\/h1>/);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Page content contains expected text');
    });

    it('should fail when content does not contain expected string', () => {
      const result = assertPageContent(page, 'NotFound');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Page content does not contain expected content: NotFound');
      expect(result.actual).toBe(page.content);
      expect(result.expected).toBe('NotFound');
    });

    it('should fail when content does not match regex pattern', () => {
      const result = assertPageContent(page, /<div>.*NotFound.*<\/div>/);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Page content does not contain expected content:');
    });

    it('should handle empty content', () => {
      const emptyPage = createMockPage({ content: '' });
      const result = assertPageContent(emptyPage, 'anything');

      expect(result.success).toBe(false);
    });

    it('should handle empty search string', () => {
      const result = assertPageContent(page, '');

      expect(result.success).toBe(true); // Empty string is contained in any string
    });

    it('should be case-sensitive by default', () => {
      const result1 = assertPageContent(page, 'welcome'); // lowercase
      const result2 = assertPageContent(page, 'Welcome'); // correct case

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(true);
    });

    it('should handle special HTML characters', () => {
      const pageWithSpecialChars = createMockPage({
        content: '<div>&lt;script&gt;alert("test")&lt;/script&gt;</div>'
      });

      const result = assertPageContent(pageWithSpecialChars, '&lt;script&gt;');

      expect(result.success).toBe(true);
    });

    it('should handle very large content', () => {
      const largeContent = '<div>' + 'x'.repeat(100000) + '</div>';
      const largePage = createMockPage({ content: largeContent });

      const result = assertPageContent(largePage, 'x'.repeat(1000));

      expect(result.success).toBe(true);
    });
  });

  describe('assertElementExists', () => {
    beforeEach(() => {
      addElementToMockPage(page, '#existing-element', { text: 'Existing' });
      addElementToMockPage(page, '.class-selector', { text: 'Class element' });
      addElementToMockPage(page, '[data-testid="test-element"]', { text: 'Test element' });
    });

    it('should pass when element exists', () => {
      const result = assertElementExists(page, '#existing-element');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Element found: #existing-element');
      expect(result.actual).toBe(true);
      expect(result.expected).toBe(true);
    });

    it('should fail when element does not exist', () => {
      const result = assertElementExists(page, '#nonexistent-element');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Element not found: #nonexistent-element');
      expect(result.actual).toBe(false);
      expect(result.expected).toBe(true);
    });

    it('should work with different selector types', () => {
      expect(assertElementExists(page, '#existing-element').success).toBe(true);
      expect(assertElementExists(page, '.class-selector').success).toBe(true);
      expect(assertElementExists(page, '[data-testid="test-element"]').success).toBe(true);
    });

    it('should handle complex selectors', () => {
      addElementToMockPage(page, 'div > p.content:first-child', { text: 'Complex' });

      const result = assertElementExists(page, 'div > p.content:first-child');

      expect(result.success).toBe(true);
    });

    it('should handle selectors with special characters', () => {
      addElementToMockPage(page, '#element\\:with\\:colons', { text: 'Special' });

      const result = assertElementExists(page, '#element\\:with\\:colons');

      expect(result.success).toBe(true);
    });

    it('should be case-sensitive for IDs and classes', () => {
      addElementToMockPage(page, '#CaseSensitive', { text: 'Case test' });

      expect(assertElementExists(page, '#CaseSensitive').success).toBe(true);
      expect(assertElementExists(page, '#casesensitive').success).toBe(false);
    });
  });

  describe('assertElementVisible', () => {
    beforeEach(() => {
      addElementToMockPage(page, '#visible-element', {
        text: 'Visible',
        visible: true
      });
      addElementToMockPage(page, '#hidden-element', {
        text: 'Hidden',
        visible: false
      });
    });

    it('should pass when element exists and is visible', () => {
      const result = assertElementVisible(page, '#visible-element');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Element "#visible-element" is visible');
      expect(result.actual).toBe(true);
      expect(result.expected).toBe(true);
    });

    it('should fail when element exists but is not visible', () => {
      const result = assertElementVisible(page, '#hidden-element');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Element "#hidden-element" is not visible');
      expect(result.actual).toBe(false);
      expect(result.expected).toBe(true);
    });

    it('should fail when element does not exist', () => {
      const result = assertElementVisible(page, '#nonexistent-element');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Element not found: #nonexistent-element');
      expect(result.actual).toBeUndefined();
      expect(result.expected).toBe('element to exist and be visible');
    });

    it('should handle dynamically shown/hidden elements', () => {
      // Simulate showing a hidden element
      const element = page.elements.get('#hidden-element')!;
      element.visible = true;

      const result = assertElementVisible(page, '#hidden-element');

      expect(result.success).toBe(true);
    });

    it('should handle elements with display: none simulation', () => {
      addElementToMockPage(page, '#display-none', {
        visible: false,
        attributes: { style: 'display: none;' }
      });

      const result = assertElementVisible(page, '#display-none');

      expect(result.success).toBe(false);
    });

    it('should handle elements with visibility: hidden simulation', () => {
      addElementToMockPage(page, '#visibility-hidden', {
        visible: false,
        attributes: { style: 'visibility: hidden;' }
      });

      const result = assertElementVisible(page, '#visibility-hidden');

      expect(result.success).toBe(false);
    });
  });

  describe('assertBrowserState', () => {
    beforeEach(() => {
      addElementToMockPage(page, '#element1', {
        text: 'Element 1',
        visible: true
      });
      addElementToMockPage(page, '#element2', {
        text: 'Element 2',
        visible: false
      });
      addConsoleMessage(page, 'info', 'Test message');
      addConsoleMessage(page, 'warn', 'Warning message');
    });

    it('should pass when all conditions are met', () => {
      const expected: BrowserStateExpectation = {
        url: 'https://example.com/test',
        hasErrors: false,
        elementExists: ['#element1', '#element2']
      };

      const result = assertBrowserState(page, expected);

      expect(result.success).toBe(true);
      expect(result.message).toBe('All browser state assertions passed');
    });

    it('should fail when URL does not match', () => {
      const expected: BrowserStateExpectation = {
        url: 'https://wrong.com'
      };

      const result = assertBrowserState(page, expected);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Expected URL to match https://wrong.com');
    });

    it('should check error state correctly - expects errors but has none', () => {
      const expected: BrowserStateExpectation = {
        hasErrors: true
      };

      const result = assertBrowserState(page, expected);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Expected page to have errors, but found none');
    });

    it('should check error state correctly - expects no errors but has some', () => {
      addError(page, 'Test error');
      addError(page, 'Another error');

      const expected: BrowserStateExpectation = {
        hasErrors: false
      };

      const result = assertBrowserState(page, expected);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Expected page to have no errors, but found: Test error, Another error');
    });

    it('should fail when expected element does not exist', () => {
      const expected: BrowserStateExpectation = {
        elementExists: ['#nonexistent-element']
      };

      const result = assertBrowserState(page, expected);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Element not found: #nonexistent-element');
    });

    it('should accumulate multiple failures', () => {
      const expected: BrowserStateExpectation = {
        url: 'https://wrong.com',
        elementExists: ['#nonexistent'],
        hasErrors: true
      };

      const result = assertBrowserState(page, expected);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Expected URL to match https://wrong.com');
      expect(result.message).toContain('Element not found: #nonexistent');
      expect(result.message).toContain('Expected page to have errors, but found none');
    });

    it('should include comprehensive actual state in result', () => {
      const result = assertBrowserState(page, {});

      expect(result.actual).toEqual({
        url: 'https://example.com/test',
        title: 'Test Page',
        errors: [],
        elements: ['#element1', '#element2'],
        consoleMessages: [
          { level: 'info', text: 'Test message' },
          { level: 'warn', text: 'Warning message' }
        ]
      });
    });

    it('should handle complex multi-condition scenarios', () => {
      // Setup a complex page state
      addElementToMockPage(page, '#form', { visible: true });
      addElementToMockPage(page, '#submit-btn', { visible: true, enabled: true });
      addElementToMockPage(page, '#loading', { visible: false });
      addConsoleMessage(page, 'debug', 'Form initialized');

      const expected: BrowserStateExpectation = {
        url: /example\.com/,
        hasErrors: false,
        elementExists: ['#form', '#submit-btn', '#loading']
      };

      const result = assertBrowserState(page, expected);

      expect(result.success).toBe(true);
    });

    it('should handle empty state expectations', () => {
      const result = assertBrowserState(page, {});

      expect(result.success).toBe(true);
      expect(result.message).toBe('All browser state assertions passed');
    });
  });

  describe('integration scenarios', () => {
    it('should test complete page interaction workflow', () => {
      // Setup a realistic page scenario
      const loginPage = createMockPage({
        url: 'https://app.example.com/login',
        title: 'Login - Example App',
        content: '<form id="login-form"><input id="username" type="text"><input id="password" type="password"><button id="submit">Login</button></form>'
      });

      // Add form elements
      addElementToMockPage(loginPage, '#login-form', { visible: true });
      addElementToMockPage(loginPage, '#username', { visible: true, enabled: true });
      addElementToMockPage(loginPage, '#password', { visible: true, enabled: true });
      addElementToMockPage(loginPage, '#submit', { visible: true, enabled: true });

      // Test initial page state
      expect(assertNavigationState(loginPage, {
        url: /\/login$/,
        title: /Login.*Example/
      }).success).toBe(true);

      expect(assertPageContent(loginPage, 'Login').success).toBe(true);

      expect(assertBrowserState(loginPage, {
        hasErrors: false,
        elementExists: ['#login-form', '#username', '#password', '#submit']
      }).success).toBe(true);

      // Simulate form submission with validation error
      addError(loginPage, 'Invalid credentials');
      addConsoleMessage(loginPage, 'error', 'Login failed');

      expect(assertBrowserState(loginPage, {
        hasErrors: true
      }).success).toBe(true);
    });

    it('should test responsive design state changes', () => {
      // Setup mobile vs desktop scenarios
      const mobilePage = createMockPage({
        url: 'https://example.com/responsive',
        title: 'Responsive Test'
      });

      // Mobile: hamburger menu visible, desktop nav hidden
      addElementToMockPage(mobilePage, '#hamburger-menu', { visible: true });
      addElementToMockPage(mobilePage, '#desktop-nav', { visible: false });
      addElementToMockPage(mobilePage, '#mobile-content', { visible: true });

      expect(assertBrowserState(mobilePage, {
        elementExists: ['#hamburger-menu', '#desktop-nav', '#mobile-content']
      }).success).toBe(true);

      expect(assertElementVisible(mobilePage, '#hamburger-menu').success).toBe(true);
      expect(assertElementVisible(mobilePage, '#desktop-nav').success).toBe(false);
    });

    it('should test single page application state transitions', () => {
      // Setup SPA routing scenario
      const spaPage = createMockPage({
        url: 'https://spa.example.com/dashboard',
        title: 'Dashboard - SPA Example'
      });

      // Initial dashboard state
      addElementToMockPage(spaPage, '#dashboard', { visible: true });
      addElementToMockPage(spaPage, '#sidebar', { visible: true });
      addElementToMockPage(spaPage, '#user-profile', { visible: false });
      addConsoleMessage(spaPage, 'info', 'Dashboard loaded');

      // Simulate navigation to profile
      spaPage.url = 'https://spa.example.com/profile';
      spaPage.title = 'Profile - SPA Example';
      page.elements.get('#dashboard')!.visible = false;
      page.elements.get('#user-profile')!.visible = true;
      addConsoleMessage(spaPage, 'info', 'Profile loaded');

      expect(assertNavigationState(spaPage, {
        url: /\/profile$/
      }).success).toBe(true);

      expect(assertBrowserState(spaPage, {
        elementExists: ['#dashboard', '#sidebar', '#user-profile']
      }).success).toBe(true);
    });

    it('should test error and loading state handling', () => {
      // Setup error state scenario
      const errorPage = createMockPage({
        url: 'https://example.com/error',
        title: '500 - Server Error',
        content: '<div class="error-page"><h1>Server Error</h1><p>Something went wrong</p></div>'
      });

      addElementToMockPage(errorPage, '.error-page', { visible: true });
      addElementToMockPage(errorPage, '#retry-btn', { visible: true, enabled: true });
      addError(errorPage, 'Internal server error');
      addConsoleMessage(errorPage, 'error', 'Failed to load user data');

      expect(assertNavigationState(errorPage, {
        title: /Server Error/
      }).success).toBe(true);

      expect(assertPageContent(errorPage, 'Something went wrong').success).toBe(true);

      expect(assertBrowserState(errorPage, {
        hasErrors: true,
        elementExists: ['.error-page', '#retry-btn']
      }).success).toBe(true);
    });
  });

  describe('edge cases and robustness', () => {
    it('should handle pages with no DOM elements', () => {
      const emptyPage = createMockPage({
        content: ''
      });

      expect(assertElementExists(emptyPage, 'any-selector').success).toBe(false);
      expect(assertBrowserState(emptyPage, { hasErrors: false }).success).toBe(true);
    });

    it('should handle pages with thousands of elements', () => {
      const largePage = createMockPage();

      // Add many elements
      for (let i = 0; i < 1000; i++) {
        addElementToMockPage(largePage, `#element-${i}`, {
          text: `Element ${i}`,
          visible: i % 2 === 0
        });
      }

      // Should handle large element sets efficiently
      expect(assertElementExists(largePage, '#element-500').success).toBe(true);
      expect(assertElementVisible(largePage, '#element-500').success).toBe(true);
      expect(assertElementVisible(largePage, '#element-501').success).toBe(false);
    });

    it('should handle Unicode content and selectors', () => {
      const unicodePage = createMockPage({
        content: '<div>🚀 测试 émoji content</div>',
        title: '测试页面 🌟'
      });

      addElementToMockPage(unicodePage, '#测试元素', {
        text: '🚀 测试 émoji'
      });

      expect(assertNavigationState(unicodePage, {
        title: /测试页面/
      }).success).toBe(true);

      expect(assertPageContent(unicodePage, '🚀 测试').success).toBe(true);

      expect(assertElementExists(unicodePage, '#测试元素').success).toBe(true);
    });

    it('should handle very long URLs and titles', () => {
      const longUrl = 'https://example.com/' + 'very-long-path/'.repeat(100) + 'page';
      const longTitle = 'Very Long Title ' + 'With Many Words '.repeat(50);

      const longPage = createMockPage({
        url: longUrl,
        title: longTitle
      });

      expect(assertNavigationState(longPage, {
        url: longUrl
      }).success).toBe(true);

      expect(assertNavigationState(longPage, {
        title: longTitle
      }).success).toBe(true);
    });

    it('should handle malformed HTML content gracefully', () => {
      const malformedPage = createMockPage({
        content: '<div><p>Unclosed paragraph<div><span>Nested improperly</div></span>'
      });

      // Should not crash on malformed HTML
      expect(assertPageContent(malformedPage, 'Unclosed').success).toBe(true);
      expect(assertPageContent(malformedPage, 'Nested improperly').success).toBe(true);
    });

    it('should handle null and undefined values gracefully', () => {
      const specialPage = createMockPage({
        content: 'null undefined'
      });

      // Should handle edge case inputs without crashing
      expect(assertPageContent(specialPage, 'null').success).toBe(true);
      expect(assertPageContent(specialPage, 'undefined').success).toBe(true);
    });

    it('should handle concurrent state changes', () => {
      const dynamicPage = createMockPage();

      // Simulate rapid element creation/destruction
      for (let i = 0; i < 10; i++) {
        addElementToMockPage(dynamicPage, `#temp-${i}`, { visible: true });

        if (i > 5) {
          dynamicPage.elements.delete(`#temp-${i - 5}`);
        }
      }

      // Should handle state correctly even with changes
      expect(assertElementExists(dynamicPage, '#temp-9').success).toBe(true);
      expect(assertElementExists(dynamicPage, '#temp-1').success).toBe(false);
    });
  });
});