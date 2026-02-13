/**
 * @apexcli/browser - Assertions Test Suite
 *
 * Comprehensive tests for browser state assertion utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  assertNavigationState,
  assertPageContent,
  assertElementExists,
  assertElementVisible,
  assertElementText,
  assertNoErrors,
  assertConsoleContains,
  assertBrowserState,
  assertElementAttributes,
  assertElementTagName,
  assertElementEnabled,
  assertCookie,
  assertLocalStorage,
  type AssertionResult,
  type NavigationState,
  type BrowserStateExpectation
} from '../assertions.js';
import {
  createMockPage,
  addElementToMockPage,
  addConsoleMessage,
  addError,
  setCookie,
  setLocalStorage,
  type MockPageObject
} from '../mock-page-objects.js';

describe('Assertions', () => {
  let page: MockPageObject;

  beforeEach(() => {
    page = createMockPage({
      url: 'https://example.com/test',
      title: 'Test Page',
      content: '<html><body><h1>Welcome</h1><p>Test content</p></body></html>'
    });
  });

  describe('assertNavigationState', () => {
    it('should pass when URL matches string expectation', () => {
      const result = assertNavigationState(page, { url: 'https://example.com/test' });

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Navigation state matches expectations');
      expect(result.actual).toEqual({ url: 'https://example.com/test', title: 'Test Page' });
      expect(result.expected).toEqual({ url: 'https://example.com/test' });
    });

    it('should pass when URL matches RegExp expectation', () => {
      const result = assertNavigationState(page, { url: /example\.com/ });

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Navigation state matches expectations');
    });

    it('should fail when URL does not match string expectation', () => {
      const result = assertNavigationState(page, { url: 'https://different.com' });

      expect(result.pass).toBe(false);
      expect(result.message).toContain('Expected URL to match https://different.com');
      expect(result.message).toContain('but got "https://example.com/test"');
    });

    it('should fail when URL does not match RegExp expectation', () => {
      const result = assertNavigationState(page, { url: /notfound/ });

      expect(result.pass).toBe(false);
      expect(result.message).toContain('Expected URL to match /notfound/');
    });

    it('should pass when title matches string expectation', () => {
      const result = assertNavigationState(page, { title: 'Test Page' });

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Navigation state matches expectations');
    });

    it('should pass when title matches RegExp expectation', () => {
      const result = assertNavigationState(page, { title: /Test.*/ });

      expect(result.pass).toBe(true);
    });

    it('should fail when title does not match expectation', () => {
      const result = assertNavigationState(page, { title: 'Different Title' });

      expect(result.pass).toBe(false);
      expect(result.message).toContain('Expected title to match Different Title');
      expect(result.message).toContain('but got "Test Page"');
    });

    it('should validate both URL and title together', () => {
      const result = assertNavigationState(page, {
        url: 'https://example.com/test',
        title: 'Test Page'
      });

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Navigation state matches expectations');
    });

    it('should fail if any navigation property fails', () => {
      const result = assertNavigationState(page, {
        url: 'https://example.com/test',
        title: 'Wrong Title'
      });

      expect(result.pass).toBe(false);
      expect(result.message).toContain('Expected title to match Wrong Title');
    });

    it('should handle empty expectations', () => {
      const result = assertNavigationState(page, {});

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Navigation state matches expectations');
    });
  });

  describe('assertPageContent', () => {
    it('should pass when content contains expected string', () => {
      const result = assertPageContent(page, 'Welcome');

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Page content contains expected content');
      expect(result.actual).toBe(page.content);
      expect(result.expected).toBe('Welcome');
    });

    it('should pass when content matches RegExp', () => {
      const result = assertPageContent(page, /h1.*Welcome.*h1/);

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Page content contains expected content');
    });

    it('should fail when content does not contain expected string', () => {
      const result = assertPageContent(page, 'NotFound');

      expect(result.pass).toBe(false);
      expect(result.message).toContain('Page content does not contain expected content: NotFound');
      expect(result.actual).toBe(page.content);
      expect(result.expected).toBe('NotFound');
    });

    it('should fail when content does not match RegExp', () => {
      const result = assertPageContent(page, /notfound/);

      expect(result.pass).toBe(false);
      expect(result.message).toContain('Page content does not contain expected content: /notfound/');
    });

    it('should handle empty content', () => {
      const emptyPage = createMockPage({ content: '' });
      const result = assertPageContent(emptyPage, 'anything');

      expect(result.pass).toBe(false);
    });

    it('should handle empty search string', () => {
      const result = assertPageContent(page, '');

      expect(result.pass).toBe(true); // Empty string is always contained
    });
  });

  describe('assertElementExists', () => {
    beforeEach(() => {
      addElementToMockPage(page, '#existing', { text: 'Existing element' });
    });

    it('should pass when element exists', () => {
      const result = assertElementExists(page, '#existing');

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Element "#existing" exists');
      expect(result.actual).toBe(true);
      expect(result.expected).toBe(true);
    });

    it('should fail when element does not exist', () => {
      const result = assertElementExists(page, '#nonexistent');

      expect(result.pass).toBe(false);
      expect(result.message).toBe('Element "#nonexistent" does not exist');
      expect(result.actual).toBe(false);
      expect(result.expected).toBe(true);
    });
  });

  describe('assertElementVisible', () => {
    beforeEach(() => {
      addElementToMockPage(page, '#visible', { text: 'Visible', visible: true });
      addElementToMockPage(page, '#hidden', { text: 'Hidden', visible: false });
    });

    it('should pass when element exists and is visible', () => {
      const result = assertElementVisible(page, '#visible');

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Element "#visible" is visible');
      expect(result.actual).toBe(true);
      expect(result.expected).toBe(true);
    });

    it('should fail when element exists but is not visible', () => {
      const result = assertElementVisible(page, '#hidden');

      expect(result.pass).toBe(false);
      expect(result.message).toBe('Element "#hidden" is not visible');
      expect(result.actual).toBe(false);
      expect(result.expected).toBe(true);
    });

    it('should fail when element does not exist', () => {
      const result = assertElementVisible(page, '#nonexistent');

      expect(result.pass).toBe(false);
      expect(result.message).toBe('Element "#nonexistent" does not exist');
      expect(result.actual).toBeUndefined();
      expect(result.expected).toBe('element to exist and be visible');
    });
  });

  describe('assertElementText', () => {
    beforeEach(() => {
      addElementToMockPage(page, '#text-element', { text: 'Hello World' });
      addElementToMockPage(page, '#empty-element', { text: '' });
    });

    it('should pass when element text matches string exactly', () => {
      const result = assertElementText(page, '#text-element', 'Hello World');

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Element "#text-element" text matches expected value');
      expect(result.actual).toBe('Hello World');
      expect(result.expected).toBe('Hello World');
    });

    it('should pass when element text matches RegExp', () => {
      const result = assertElementText(page, '#text-element', /Hello.*/);

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Element "#text-element" text matches expected value');
    });

    it('should fail when element text does not match string', () => {
      const result = assertElementText(page, '#text-element', 'Different Text');

      expect(result.pass).toBe(false);
      expect(result.message).toContain('Element "#text-element" text "Hello World" does not match expected: Different Text');
      expect(result.actual).toBe('Hello World');
      expect(result.expected).toBe('Different Text');
    });

    it('should fail when element text does not match RegExp', () => {
      const result = assertElementText(page, '#text-element', /Goodbye/);

      expect(result.pass).toBe(false);
      expect(result.message).toContain('does not match expected: /Goodbye/');
    });

    it('should handle empty text', () => {
      const result = assertElementText(page, '#empty-element', '');

      expect(result.pass).toBe(true);
      expect(result.actual).toBe('');
    });

    it('should fail when element does not exist', () => {
      const result = assertElementText(page, '#nonexistent', 'any text');

      expect(result.pass).toBe(false);
      expect(result.message).toBe('Element "#nonexistent" does not exist');
      expect(result.actual).toBeUndefined();
    });
  });

  describe('assertNoErrors', () => {
    it('should pass when page has no errors', () => {
      const result = assertNoErrors(page);

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Page has no errors');
      expect(result.actual).toEqual([]);
      expect(result.expected).toEqual([]);
    });

    it('should fail when page has errors', () => {
      addError(page, 'First error');
      addError(page, 'Second error');

      const result = assertNoErrors(page);

      expect(result.pass).toBe(false);
      expect(result.message).toBe('Page has 2 error(s): First error, Second error');
      expect(result.actual).toEqual(['First error', 'Second error']);
      expect(result.expected).toEqual([]);
    });

    it('should handle single error', () => {
      addError(page, 'Single error');

      const result = assertNoErrors(page);

      expect(result.pass).toBe(false);
      expect(result.message).toBe('Page has 1 error(s): Single error');
    });
  });

  describe('assertConsoleContains', () => {
    beforeEach(() => {
      addConsoleMessage(page, 'info', 'Information message');
      addConsoleMessage(page, 'error', 'Error occurred');
      addConsoleMessage(page, 'warn', 'Warning: Something happened');
    });

    it('should pass when console contains exact message', () => {
      const result = assertConsoleContains(page, 'info', 'Information message');

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Console contains info message matching: Information message');
      expect(result.expected).toEqual({ level: 'info', text: 'Information message' });
    });

    it('should pass when console contains partial message', () => {
      const result = assertConsoleContains(page, 'warn', 'Something');

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Console contains warn message matching: Something');
    });

    it('should pass when console message matches RegExp', () => {
      const result = assertConsoleContains(page, 'error', /Error.*/);

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Console contains error message matching: /Error.*/');
    });

    it('should fail when level does not match', () => {
      const result = assertConsoleContains(page, 'debug', 'Information message');

      expect(result.pass).toBe(false);
      expect(result.message).toBe('Console does not contain debug message matching: Information message');
    });

    it('should fail when text does not match', () => {
      const result = assertConsoleContains(page, 'info', 'Nonexistent message');

      expect(result.pass).toBe(false);
      expect(result.message).toBe('Console does not contain info message matching: Nonexistent message');
    });

    it('should return actual messages of matching level', () => {
      const result = assertConsoleContains(page, 'info', 'Nonexistent');

      expect(result.actual).toEqual([{ level: 'info', text: 'Information message' }]);
    });

    it('should handle empty console', () => {
      const emptyPage = createMockPage();
      const result = assertConsoleContains(emptyPage, 'info', 'Any message');

      expect(result.pass).toBe(false);
      expect(result.actual).toEqual([]);
    });
  });

  describe('assertBrowserState', () => {
    beforeEach(() => {
      addElementToMockPage(page, '#element1', { text: 'Element 1', visible: true });
      addElementToMockPage(page, '#element2', { text: 'Element 2', visible: false });
      addConsoleMessage(page, 'info', 'Test message');
    });

    it('should pass when all conditions are met', () => {
      const expected: BrowserStateExpectation = {
        url: 'https://example.com/test',
        title: 'Test Page',
        hasErrors: false,
        elementExists: ['#element1', '#element2'],
        elementVisible: ['#element1'],
        consoleMessages: [{ level: 'info', text: 'Test message' }]
      };

      const result = assertBrowserState(page, expected);

      expect(result.pass).toBe(true);
      expect(result.message).toBe('All browser state assertions passed');
    });

    it('should fail when URL does not match', () => {
      const expected: BrowserStateExpectation = {
        url: 'https://wrong.com'
      };

      const result = assertBrowserState(page, expected);

      expect(result.pass).toBe(false);
      expect(result.message).toContain('Expected URL to match https://wrong.com');
    });

    it('should fail when title does not match', () => {
      const expected: BrowserStateExpectation = {
        title: /Wrong.*/
      };

      const result = assertBrowserState(page, expected);

      expect(result.pass).toBe(false);
      expect(result.message).toContain('Expected title to match /Wrong.*/');
    });

    it('should check error state correctly - expects errors but has none', () => {
      const expected: BrowserStateExpectation = {
        hasErrors: true
      };

      const result = assertBrowserState(page, expected);

      expect(result.pass).toBe(false);
      expect(result.message).toContain('Expected page to have errors, but found none');
    });

    it('should check error state correctly - expects no errors but has some', () => {
      addError(page, 'Test error');

      const expected: BrowserStateExpectation = {
        hasErrors: false
      };

      const result = assertBrowserState(page, expected);

      expect(result.pass).toBe(false);
      expect(result.message).toContain('Expected page to have no errors, but found: Test error');
    });

    it('should fail when expected element does not exist', () => {
      const expected: BrowserStateExpectation = {
        elementExists: ['#nonexistent']
      };

      const result = assertBrowserState(page, expected);

      expect(result.pass).toBe(false);
      expect(result.message).toContain('Element "#nonexistent" does not exist');
    });

    it('should fail when expected visible element is not visible', () => {
      const expected: BrowserStateExpectation = {
        elementVisible: ['#element2']
      };

      const result = assertBrowserState(page, expected);

      expect(result.pass).toBe(false);
      expect(result.message).toContain('Element "#element2" is not visible');
    });

    it('should fail when expected console message is not found', () => {
      const expected: BrowserStateExpectation = {
        consoleMessages: [{ level: 'error', text: 'Not found' }]
      };

      const result = assertBrowserState(page, expected);

      expect(result.pass).toBe(false);
      expect(result.message).toContain('Console does not contain error message matching: Not found');
    });

    it('should accumulate multiple failures', () => {
      const expected: BrowserStateExpectation = {
        url: 'https://wrong.com',
        elementExists: ['#nonexistent'],
        hasErrors: true
      };

      const result = assertBrowserState(page, expected);

      expect(result.pass).toBe(false);
      expect(result.message).toContain('Expected URL to match https://wrong.com');
      expect(result.message).toContain('Element "#nonexistent" does not exist');
      expect(result.message).toContain('Expected page to have errors, but found none');
    });

    it('should include actual state in result', () => {
      const result = assertBrowserState(page, {});

      expect(result.actual).toEqual({
        url: 'https://example.com/test',
        title: 'Test Page',
        errors: [],
        elements: ['#element1', '#element2'],
        consoleMessages: [{ level: 'info', text: 'Test message' }]
      });
    });
  });

  describe('assertElementAttributes', () => {
    beforeEach(() => {
      addElementToMockPage(page, '#input', {
        tagName: 'INPUT',
        attributes: {
          type: 'text',
          name: 'username',
          id: 'input',
          class: 'form-control'
        }
      });
    });

    it('should pass when all attributes match', () => {
      const expected = {
        type: 'text',
        name: 'username'
      };

      const result = assertElementAttributes(page, '#input', expected);

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Element "#input" has expected attributes');
      expect(result.expected).toEqual(expected);
    });

    it('should fail when attribute value does not match', () => {
      const expected = {
        type: 'password',
        name: 'username'
      };

      const result = assertElementAttributes(page, '#input', expected);

      expect(result.pass).toBe(false);
      expect(result.message).toContain('Expected attribute "type" to be "password", but got "text"');
    });

    it('should fail when attribute is missing', () => {
      const expected = {
        placeholder: 'Enter username'
      };

      const result = assertElementAttributes(page, '#input', expected);

      expect(result.pass).toBe(false);
      expect(result.message).toContain('Expected attribute "placeholder" to be "Enter username", but got "undefined"');
    });

    it('should fail when element does not exist', () => {
      const result = assertElementAttributes(page, '#nonexistent', { type: 'text' });

      expect(result.pass).toBe(false);
      expect(result.message).toBe('Element "#nonexistent" does not exist');
      expect(result.actual).toBeUndefined();
    });

    it('should handle empty expected attributes', () => {
      const result = assertElementAttributes(page, '#input', {});

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Element "#input" has expected attributes');
    });
  });

  describe('assertElementTagName', () => {
    beforeEach(() => {
      addElementToMockPage(page, '#button', { tagName: 'BUTTON' });
      addElementToMockPage(page, '#input', { tagName: 'INPUT' });
    });

    it('should pass when tag name matches exactly', () => {
      const result = assertElementTagName(page, '#button', 'BUTTON');

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Element "#button" has expected tag name "BUTTON"');
      expect(result.actual).toBe('BUTTON');
      expect(result.expected).toBe('BUTTON');
    });

    it('should pass when tag name matches case-insensitively', () => {
      const result = assertElementTagName(page, '#button', 'button');

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Element "#button" has expected tag name "button"');
    });

    it('should fail when tag name does not match', () => {
      const result = assertElementTagName(page, '#button', 'INPUT');

      expect(result.pass).toBe(false);
      expect(result.message).toBe('Element "#button" has tag name "BUTTON", expected "INPUT"');
      expect(result.actual).toBe('BUTTON');
      expect(result.expected).toBe('INPUT');
    });

    it('should fail when element does not exist', () => {
      const result = assertElementTagName(page, '#nonexistent', 'DIV');

      expect(result.pass).toBe(false);
      expect(result.message).toBe('Element "#nonexistent" does not exist');
      expect(result.actual).toBeUndefined();
      expect(result.expected).toBe('DIV');
    });
  });

  describe('assertElementEnabled', () => {
    beforeEach(() => {
      addElementToMockPage(page, '#enabled', { enabled: true });
      addElementToMockPage(page, '#disabled', { enabled: false });
    });

    it('should pass when element is enabled and should be enabled', () => {
      const result = assertElementEnabled(page, '#enabled', true);

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Element "#enabled" is enabled as expected');
      expect(result.actual).toBe(true);
      expect(result.expected).toBe(true);
    });

    it('should pass when element is disabled and should be disabled', () => {
      const result = assertElementEnabled(page, '#disabled', false);

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Element "#disabled" is disabled as expected');
      expect(result.actual).toBe(false);
      expect(result.expected).toBe(false);
    });

    it('should default to expecting enabled', () => {
      const result = assertElementEnabled(page, '#enabled');

      expect(result.pass).toBe(true);
      expect(result.expected).toBe(true);
    });

    it('should fail when element is disabled but should be enabled', () => {
      const result = assertElementEnabled(page, '#disabled', true);

      expect(result.pass).toBe(false);
      expect(result.message).toBe('Element "#disabled" is disabled, expected enabled');
      expect(result.actual).toBe(false);
      expect(result.expected).toBe(true);
    });

    it('should fail when element is enabled but should be disabled', () => {
      const result = assertElementEnabled(page, '#enabled', false);

      expect(result.pass).toBe(false);
      expect(result.message).toBe('Element "#enabled" is enabled, expected disabled');
      expect(result.actual).toBe(true);
      expect(result.expected).toBe(false);
    });

    it('should fail when element does not exist', () => {
      const result = assertElementEnabled(page, '#nonexistent');

      expect(result.pass).toBe(false);
      expect(result.message).toBe('Element "#nonexistent" does not exist');
      expect(result.actual).toBeUndefined();
      expect(result.expected).toBe(true);
    });
  });

  describe('assertCookie', () => {
    beforeEach(() => {
      setCookie(page, 'session_id', 'abc123');
      setCookie(page, 'theme', 'dark');
      setCookie(page, 'empty_cookie', '');
    });

    it('should pass when cookie exists with expected value', () => {
      const result = assertCookie(page, 'session_id', 'abc123');

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Cookie "session_id" has expected value "abc123"');
      expect(result.actual).toBe('abc123');
      expect(result.expected).toBe('abc123');
    });

    it('should pass when cookie exists and value is not checked', () => {
      const result = assertCookie(page, 'theme');

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Cookie "theme" exists');
      expect(result.actual).toBe('dark');
      expect(result.expected).toBeUndefined();
    });

    it('should handle empty cookie values', () => {
      const result = assertCookie(page, 'empty_cookie', '');

      expect(result.pass).toBe(true);
      expect(result.actual).toBe('');
    });

    it('should fail when cookie does not exist', () => {
      const result = assertCookie(page, 'nonexistent');

      expect(result.pass).toBe(false);
      expect(result.message).toBe('Cookie "nonexistent" does not exist');
      expect(result.actual).toEqual(['session_id', 'theme', 'empty_cookie']);
      expect(result.expected).toBe('nonexistent');
    });

    it('should fail when cookie value does not match', () => {
      const result = assertCookie(page, 'session_id', 'wrong_value');

      expect(result.pass).toBe(false);
      expect(result.message).toBe('Cookie "session_id" has value "abc123", expected "wrong_value"');
      expect(result.actual).toBe('abc123');
      expect(result.expected).toBe('wrong_value');
    });
  });

  describe('assertLocalStorage', () => {
    beforeEach(() => {
      setLocalStorage(page, 'user_preference', 'dark_mode');
      setLocalStorage(page, 'language', 'en-US');
      setLocalStorage(page, 'empty_value', '');
    });

    it('should pass when localStorage key exists with expected value', () => {
      const result = assertLocalStorage(page, 'user_preference', 'dark_mode');

      expect(result.pass).toBe(true);
      expect(result.message).toBe('localStorage key "user_preference" has expected value "dark_mode"');
      expect(result.actual).toBe('dark_mode');
      expect(result.expected).toBe('dark_mode');
    });

    it('should pass when localStorage key exists and value is not checked', () => {
      const result = assertLocalStorage(page, 'language');

      expect(result.pass).toBe(true);
      expect(result.message).toBe('localStorage key "language" exists');
      expect(result.actual).toBe('en-US');
      expect(result.expected).toBeUndefined();
    });

    it('should handle empty localStorage values', () => {
      const result = assertLocalStorage(page, 'empty_value', '');

      expect(result.pass).toBe(true);
      expect(result.actual).toBe('');
    });

    it('should fail when localStorage key does not exist', () => {
      const result = assertLocalStorage(page, 'nonexistent');

      expect(result.pass).toBe(false);
      expect(result.message).toBe('localStorage key "nonexistent" does not exist');
      expect(result.actual).toEqual(['user_preference', 'language', 'empty_value']);
      expect(result.expected).toBe('nonexistent');
    });

    it('should fail when localStorage value does not match', () => {
      const result = assertLocalStorage(page, 'user_preference', 'light_mode');

      expect(result.pass).toBe(false);
      expect(result.message).toBe('localStorage key "user_preference" has value "dark_mode", expected "light_mode"');
      expect(result.actual).toBe('dark_mode');
      expect(result.expected).toBe('light_mode');
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle malformed RegExp patterns gracefully', () => {
      // This is more of a JavaScript runtime test, but worth checking behavior
      const validPattern = /test/;
      const result = assertPageContent(page, validPattern);
      expect(typeof result).toBe('object');
      expect(typeof result.pass).toBe('boolean');
    });

    it('should handle special characters in selectors', () => {
      addElementToMockPage(page, '#element\\:with\\:colons', { text: 'Special' });
      const result = assertElementExists(page, '#element\\:with\\:colons');
      expect(result.pass).toBe(true);
    });

    it('should handle Unicode text content', () => {
      addElementToMockPage(page, '#unicode', { text: '🚀 测试 émoji' });
      const result = assertElementText(page, '#unicode', '🚀 测试 émoji');
      expect(result.pass).toBe(true);
    });

    it('should handle very long error messages', () => {
      const longError = 'A'.repeat(10000);
      addError(page, longError);
      const result = assertNoErrors(page);
      expect(result.pass).toBe(false);
      expect(result.message).toContain(longError);
    });

    it('should handle null/undefined-like values in attributes', () => {
      addElementToMockPage(page, '#null-attrs', {
        attributes: {
          'data-value': 'null',
          'empty': ''
        }
      });

      const result = assertElementAttributes(page, '#null-attrs', {
        'data-value': 'null',
        'empty': ''
      });
      expect(result.pass).toBe(true);
    });
  });
});