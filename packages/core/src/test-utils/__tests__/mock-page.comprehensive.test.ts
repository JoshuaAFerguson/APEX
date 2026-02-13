/**
 * Comprehensive tests for mock page object utilities
 */
import { describe, test, expect, beforeEach } from 'vitest';
import {
  createMockPage,
  createMockElement,
  createMockPageWithForm,
  createMockPageWithNavigation,
  addElementToPage,
  addConsoleMessage,
  addErrorToPage,
  setCookieOnPage,
  setLocalStorageItem,
  type MockPageObject,
  type MockElementState,
  type FormConfig,
  type FormField,
  type NavLink
} from '../mock-page';

describe('Mock Page Objects - Comprehensive Tests', () => {
  describe('createMockPage', () => {
    test('should create page with all default properties', () => {
      const page = createMockPage();

      expect(page).toEqual({
        url: 'http://localhost:3000',
        title: 'Test Page',
        content: '<html><body><h1>Test Page</h1></body></html>',
        elements: expect.any(Map),
        consoleMessages: [],
        errors: [],
        cookies: [],
        localStorage: expect.any(Map),
        sessionStorage: expect.any(Map),
        loading: false,
        readyState: 'complete'
      });
    });

    test('should allow overriding default properties', () => {
      const customPage = createMockPage({
        url: 'https://custom.com',
        title: 'Custom Title',
        loading: true,
        readyState: 'loading',
        errors: ['Test error']
      });

      expect(customPage.url).toBe('https://custom.com');
      expect(customPage.title).toBe('Custom Title');
      expect(customPage.loading).toBe(true);
      expect(customPage.readyState).toBe('loading');
      expect(customPage.errors).toEqual(['Test error']);
    });

    test('should handle partial overrides correctly', () => {
      const page = createMockPage({ url: 'https://partial.com' });

      expect(page.url).toBe('https://partial.com');
      expect(page.title).toBe('Test Page'); // Should retain default
      expect(page.loading).toBe(false); // Should retain default
    });
  });

  describe('createMockElement', () => {
    test('should create element with all default properties', () => {
      const element = createMockElement('#test-selector');

      expect(element).toEqual({
        selector: '#test-selector',
        visible: true,
        enabled: true,
        text: '',
        value: '',
        attributes: {},
        tagName: 'div',
        children: []
      });
    });

    test('should allow overriding element properties', () => {
      const element = createMockElement('.custom', {
        tagName: 'button',
        text: 'Click me',
        visible: false,
        enabled: false,
        value: 'submit',
        attributes: { type: 'submit', class: 'btn-primary' }
      });

      expect(element.selector).toBe('.custom');
      expect(element.tagName).toBe('button');
      expect(element.text).toBe('Click me');
      expect(element.visible).toBe(false);
      expect(element.enabled).toBe(false);
      expect(element.value).toBe('submit');
      expect(element.attributes).toEqual({ type: 'submit', class: 'btn-primary' });
    });

    test('should handle nested children elements', () => {
      const child1 = createMockElement('#child1', { text: 'Child 1' });
      const child2 = createMockElement('#child2', { text: 'Child 2' });
      const parent = createMockElement('#parent', { children: [child1, child2] });

      expect(parent.children).toHaveLength(2);
      expect(parent.children[0].text).toBe('Child 1');
      expect(parent.children[1].text).toBe('Child 2');
    });
  });

  describe('createMockPageWithForm', () => {
    test('should create form with text input', () => {
      const formConfig: FormConfig = {
        id: 'text-form',
        action: '/submit',
        method: 'POST',
        fields: [{
          name: 'username',
          type: 'text',
          label: 'Username',
          required: true,
          placeholder: 'Enter username',
          value: 'defaultUser'
        }],
        submitLabel: 'Submit Form'
      };

      const page = createMockPageWithForm(formConfig);

      expect(page.title).toBe('Form Test Page');
      expect(page.elements.has('#text-form')).toBe(true);
      expect(page.elements.has('#username')).toBe(true);
      expect(page.elements.has('#submit-btn')).toBe(true);

      const formElement = page.elements.get('#text-form')!;
      expect(formElement.attributes.action).toBe('/submit');
      expect(formElement.attributes.method).toBe('POST');
      expect(formElement.attributes.id).toBe('text-form');

      const usernameElement = page.elements.get('#username')!;
      expect(usernameElement.attributes.name).toBe('username');
      expect(usernameElement.attributes.type).toBe('text');
      expect(usernameElement.attributes.placeholder).toBe('Enter username');
      expect(usernameElement.attributes.required).toBe('true');
      expect(usernameElement.value).toBe('defaultUser');

      const submitElement = page.elements.get('#submit-btn')!;
      expect(submitElement.text).toBe('Submit Form');
      expect(submitElement.attributes.type).toBe('submit');
    });

    test('should create form with various field types', () => {
      const formConfig: FormConfig = {
        fields: [
          { name: 'email', type: 'email', label: 'Email' },
          { name: 'password', type: 'password', label: 'Password' },
          { name: 'age', type: 'number', label: 'Age' },
          { name: 'bio', type: 'textarea', label: 'Bio' },
          { name: 'country', type: 'select', label: 'Country', options: ['US', 'UK', 'CA'] },
          { name: 'newsletter', type: 'checkbox', label: 'Newsletter' },
          { name: 'gender', type: 'radio', label: 'Gender', options: ['Male', 'Female', 'Other'] }
        ]
      };

      const page = createMockPageWithForm(formConfig);

      expect(page.elements.has('#email')).toBe(true);
      expect(page.elements.has('#password')).toBe(true);
      expect(page.elements.has('#age')).toBe(true);
      expect(page.elements.has('#bio')).toBe(true);
      expect(page.elements.has('#country')).toBe(true);
      expect(page.elements.has('#newsletter')).toBe(true);
      expect(page.elements.has('#gender')).toBe(true);

      // Check textarea element
      const bioElement = page.elements.get('#bio')!;
      expect(bioElement.tagName).toBe('textarea');
    });

    test('should handle form with default values', () => {
      const formConfig: FormConfig = {
        fields: [
          { name: 'name', type: 'text', label: 'Name' },
        ]
      };

      const page = createMockPageWithForm(formConfig);

      expect(page.elements.has('#test-form')).toBe(true); // Default form ID
      expect(page.elements.get('#submit-btn')!.text).toBe('Submit'); // Default submit label
    });
  });

  describe('createMockPageWithNavigation', () => {
    test('should create navigation with multiple links', () => {
      const navLinks: NavLink[] = [
        { text: 'Home', href: '/' },
        { text: 'About', href: '/about', title: 'About us' },
        { text: 'Contact', href: '/contact', target: '_blank', className: 'external' }
      ];

      const page = createMockPageWithNavigation(navLinks);

      expect(page.title).toBe('Navigation Test Page');
      expect(page.elements.has('#nav-menu')).toBe(true);
      expect(page.elements.has('#nav-link-0')).toBe(true);
      expect(page.elements.has('#nav-link-1')).toBe(true);
      expect(page.elements.has('#nav-link-2')).toBe(true);

      const link0 = page.elements.get('#nav-link-0')!;
      expect(link0.text).toBe('Home');
      expect(link0.attributes.href).toBe('/');
      expect(link0.tagName).toBe('a');

      const link1 = page.elements.get('#nav-link-1')!;
      expect(link1.text).toBe('About');
      expect(link1.attributes.title).toBe('About us');

      const link2 = page.elements.get('#nav-link-2')!;
      expect(link2.attributes.target).toBe('_blank');
      expect(link2.attributes.class).toBe('external');
    });

    test('should create navigation with empty links array', () => {
      const page = createMockPageWithNavigation([]);

      expect(page.elements.has('#nav-menu')).toBe(true);
      const navElement = page.elements.get('#nav-menu')!;
      expect(navElement.children).toHaveLength(0);
    });
  });

  describe('addElementToPage', () => {
    test('should add element to page elements map', () => {
      const page = createMockPage();
      const element = createMockElement('#new-element', { text: 'New Element' });

      const result = addElementToPage(page, element);

      expect(result).toBe(page); // Should return the same page object
      expect(page.elements.has('#new-element')).toBe(true);
      expect(page.elements.get('#new-element')!.text).toBe('New Element');
    });

    test('should overwrite existing element with same selector', () => {
      const page = createMockPage();
      const element1 = createMockElement('#same-selector', { text: 'First' });
      const element2 = createMockElement('#same-selector', { text: 'Second' });

      addElementToPage(page, element1);
      addElementToPage(page, element2);

      expect(page.elements.get('#same-selector')!.text).toBe('Second');
    });
  });

  describe('addConsoleMessage', () => {
    test('should add console message with timestamp', () => {
      const page = createMockPage();
      const beforeTime = Date.now();

      const result = addConsoleMessage(page, 'log', 'Test message');
      const afterTime = Date.now();

      expect(result).toBe(page);
      expect(page.consoleMessages).toHaveLength(1);
      expect(page.consoleMessages[0].level).toBe('log');
      expect(page.consoleMessages[0].text).toBe('Test message');
      expect(page.consoleMessages[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(page.consoleMessages[0].timestamp).toBeLessThanOrEqual(afterTime);
    });

    test('should add multiple console messages', () => {
      const page = createMockPage();

      addConsoleMessage(page, 'log', 'First message');
      addConsoleMessage(page, 'warn', 'Warning message');
      addConsoleMessage(page, 'error', 'Error message');

      expect(page.consoleMessages).toHaveLength(3);
      expect(page.consoleMessages[0].level).toBe('log');
      expect(page.consoleMessages[1].level).toBe('warn');
      expect(page.consoleMessages[2].level).toBe('error');
    });

    test('should handle various console levels', () => {
      const page = createMockPage();
      const levels = ['debug', 'info', 'log', 'warn', 'error'];

      levels.forEach(level => {
        addConsoleMessage(page, level, `${level} message`);
      });

      expect(page.consoleMessages).toHaveLength(5);
      levels.forEach((level, index) => {
        expect(page.consoleMessages[index].level).toBe(level);
        expect(page.consoleMessages[index].text).toBe(`${level} message`);
      });
    });
  });

  describe('addErrorToPage', () => {
    test('should add error to errors array', () => {
      const page = createMockPage();

      const result = addErrorToPage(page, 'Test error occurred');

      expect(result).toBe(page);
      expect(page.errors).toHaveLength(1);
      expect(page.errors[0]).toBe('Test error occurred');
    });

    test('should add multiple errors', () => {
      const page = createMockPage();

      addErrorToPage(page, 'First error');
      addErrorToPage(page, 'Second error');

      expect(page.errors).toHaveLength(2);
      expect(page.errors).toEqual(['First error', 'Second error']);
    });
  });

  describe('setCookieOnPage', () => {
    test('should add cookie with name and value', () => {
      const page = createMockPage();

      const result = setCookieOnPage(page, 'sessionId', 'abc123');

      expect(result).toBe(page);
      expect(page.cookies).toHaveLength(1);
      expect(page.cookies[0]).toEqual({
        name: 'sessionId',
        value: 'abc123',
        domain: undefined,
        path: undefined
      });
    });

    test('should add cookie with domain and path options', () => {
      const page = createMockPage();

      setCookieOnPage(page, 'token', 'xyz789', {
        domain: '.example.com',
        path: '/app'
      });

      expect(page.cookies[0]).toEqual({
        name: 'token',
        value: 'xyz789',
        domain: '.example.com',
        path: '/app'
      });
    });

    test('should add multiple cookies', () => {
      const page = createMockPage();

      setCookieOnPage(page, 'cookie1', 'value1');
      setCookieOnPage(page, 'cookie2', 'value2');

      expect(page.cookies).toHaveLength(2);
      expect(page.cookies[0].name).toBe('cookie1');
      expect(page.cookies[1].name).toBe('cookie2');
    });
  });

  describe('setLocalStorageItem', () => {
    test('should add localStorage item', () => {
      const page = createMockPage();

      const result = setLocalStorageItem(page, 'userPrefs', '{"theme":"dark"}');

      expect(result).toBe(page);
      expect(page.localStorage.get('userPrefs')).toBe('{"theme":"dark"}');
    });

    test('should add multiple localStorage items', () => {
      const page = createMockPage();

      setLocalStorageItem(page, 'item1', 'value1');
      setLocalStorageItem(page, 'item2', 'value2');

      expect(page.localStorage.size).toBe(2);
      expect(page.localStorage.get('item1')).toBe('value1');
      expect(page.localStorage.get('item2')).toBe('value2');
    });

    test('should overwrite existing localStorage item', () => {
      const page = createMockPage();

      setLocalStorageItem(page, 'key', 'original');
      setLocalStorageItem(page, 'key', 'updated');

      expect(page.localStorage.get('key')).toBe('updated');
    });
  });

  describe('Complex scenarios', () => {
    test('should create a complete page with form, navigation, and state', () => {
      // Start with form page
      const formConfig: FormConfig = {
        id: 'login-form',
        fields: [
          { name: 'username', type: 'text', label: 'Username', required: true },
          { name: 'password', type: 'password', label: 'Password', required: true }
        ]
      };
      const page = createMockPageWithForm(formConfig);

      // Add navigation
      const homeLink = createMockElement('#home-link', {
        tagName: 'a',
        text: 'Home',
        attributes: { href: '/' }
      });
      addElementToPage(page, homeLink);

      // Add some console messages and errors
      addConsoleMessage(page, 'info', 'Page loaded');
      addConsoleMessage(page, 'warn', 'Form validation required');
      addErrorToPage(page, 'Network timeout');

      // Add cookies and localStorage
      setCookieOnPage(page, 'sessionId', 'sess_123');
      setLocalStorageItem(page, 'lastVisit', new Date().toISOString());

      // Verify the complete page state
      expect(page.elements.size).toBe(4); // form, 2 inputs, submit button, home link
      expect(page.elements.has('#login-form')).toBe(true);
      expect(page.elements.has('#username')).toBe(true);
      expect(page.elements.has('#password')).toBe(true);
      expect(page.elements.has('#submit-btn')).toBe(true);
      expect(page.elements.has('#home-link')).toBe(true);
      expect(page.consoleMessages).toHaveLength(2);
      expect(page.errors).toHaveLength(1);
      expect(page.cookies).toHaveLength(1);
      expect(page.localStorage.size).toBe(1);
    });
  });
});