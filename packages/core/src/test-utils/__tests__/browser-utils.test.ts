/**
 * Test file to verify browser utilities exports and basic functionality
 */
import { describe, test, expect } from 'vitest';
import {
  // Mock page utilities
  createMockPage,
  createMockElement,
  createMockPageWithForm,
  createMockPageWithNavigation,
  addElementToPage,
  addConsoleMessage,
  type MockPageObject,
  type MockElementState,
  type FormConfig,
  type NavLink,

  // DOM building utilities
  buildFormHtml,
  buildTableHtml,
  buildNavigationHtml,
  buildListHtml,
  buildModalHtml,
  buildCardGridHtml,
  buildBasicPageHtml,
  type TableConfig,
  type ModalConfig,
  type CardConfig,

  // Test URL utilities
  generateTestUrl,
  generateTestUrls,
  createUrlPattern,
  testUrls,
  urlValidation,
  urlUtils,
  testScenarios,
  type TestUrlOptions,

  // Browser assertion utilities
  assertNavigationState,
  assertPageContent,
  assertElementExists,
  assertElementVisible,
  assertElementText,
  assertElementValue,
  assertNoErrors,
  assertConsoleContains,
  assertLocalStorageItem,
  assertCookie,
  assertBrowserState,
  type AssertionResult,
  type NavigationState,
  type BrowserStateExpectation
} from '../index';

describe('Browser Test Utilities', () => {
  describe('Mock Page Objects', () => {
    test('should create a basic mock page', () => {
      const page = createMockPage();

      expect(page.url).toBe('http://localhost:3000');
      expect(page.title).toBe('Test Page');
      expect(page.loading).toBe(false);
      expect(page.readyState).toBe('complete');
      expect(page.elements).toBeInstanceOf(Map);
      expect(page.consoleMessages).toEqual([]);
      expect(page.errors).toEqual([]);
    });

    test('should create a mock page with form', () => {
      const formConfig: FormConfig = {
        id: 'test-form',
        fields: [
          { name: 'email', type: 'email', label: 'Email', required: true },
          { name: 'password', type: 'password', label: 'Password', required: true }
        ]
      };

      const page = createMockPageWithForm(formConfig);

      expect(page.elements.has('#test-form')).toBe(true);
      expect(page.elements.has('#email')).toBe(true);
      expect(page.elements.has('#password')).toBe(true);
      expect(page.elements.has('#submit-btn')).toBe(true);
    });

    test('should create a mock element', () => {
      const element = createMockElement('#test', {
        text: 'Test Element',
        visible: true
      });

      expect(element.selector).toBe('#test');
      expect(element.text).toBe('Test Element');
      expect(element.visible).toBe(true);
      expect(element.enabled).toBe(true);
    });
  });

  describe('DOM Building Utilities', () => {
    test('should build form HTML', () => {
      const config: FormConfig = {
        id: 'test-form',
        method: 'POST',
        fields: [
          { name: 'username', type: 'text', label: 'Username' }
        ]
      };

      const html = buildFormHtml(config);

      expect(html).toContain('<form id="test-form"');
      expect(html).toContain('method="POST"');
      expect(html).toContain('name="username"');
      expect(html).toContain('type="text"');
    });

    test('should build table HTML', () => {
      const config: TableConfig = {
        headers: ['Name', 'Age'],
        rows: [['John', '30'], ['Jane', '25']],
        id: 'test-table'
      };

      const html = buildTableHtml(config);

      expect(html).toContain('<table id="test-table"');
      expect(html).toContain('<th>Name</th>');
      expect(html).toContain('<td>John</td>');
    });
  });

  describe('Test URL Generation', () => {
    test('should generate basic test URL', () => {
      const url = generateTestUrl();
      expect(url).toBe('http://localhost:3000/');
    });

    test('should generate URL with options', () => {
      const url = generateTestUrl({
        protocol: 'https',
        hostname: 'example.com',
        port: 443,
        path: '/test'
      });
      expect(url).toBe('https://example.com/test');
    });

    test('should create URL from pattern', () => {
      const url = createUrlPattern('/users/:id/posts/:postId', {
        id: '123',
        postId: '456'
      });
      expect(url).toBe('/users/123/posts/456');
    });

    test('should validate URLs', () => {
      expect(urlValidation.isValidUrl('https://example.com')).toBe(true);
      expect(urlValidation.isValidUrl('not-a-url')).toBe(false);
      expect(urlValidation.isSecure('https://example.com')).toBe(true);
      expect(urlValidation.isSecure('http://example.com')).toBe(false);
    });
  });

  describe('Browser Assertions', () => {
    test('should assert navigation state', () => {
      const page = createMockPage({
        url: 'https://example.com',
        title: 'Example Page'
      });

      const result = assertNavigationState(page, {
        url: 'https://example.com',
        title: 'Example Page',
        loaded: true
      });

      expect(result.pass).toBe(true);
      expect(result.message).toContain('Navigation state matches');
    });

    test('should assert element existence', () => {
      const page = createMockPage();
      const element = createMockElement('#test-element');
      addElementToPage(page, element);

      const result = assertElementExists(page, '#test-element');

      expect(result.pass).toBe(true);
      expect(result.message).toContain('exists');
    });

    test('should assert no errors', () => {
      const page = createMockPage();

      const result = assertNoErrors(page);

      expect(result.pass).toBe(true);
      expect(result.message).toContain('no errors');
    });

    test('should assert console messages', () => {
      const page = createMockPage();
      addConsoleMessage(page, 'log', 'Test message');

      const result = assertConsoleContains(page, 'log', 'Test message');

      expect(result.pass).toBe(true);
    });
  });
});