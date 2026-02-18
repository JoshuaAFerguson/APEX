/**
 * @apexcli/browser - Mock Page Objects Test Suite
 *
 * Comprehensive tests for mock page object creation and manipulation utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockPage,
  createMockElement,
  createMockPageWithForm,
  createMockPageWithNavigation,
  addElementToMockPage,
  addConsoleMessage,
  addError,
  setCookie,
  setLocalStorage,
  type MockPageObject,
  type MockElementState,
  type FormConfig,
  type NavLink
} from '../mock-page-objects.js';

describe('Mock Page Objects', () => {
  describe('createMockPage', () => {
    it('should create a basic mock page with default values', () => {
      const page = createMockPage();

      expect(page.url).toBe('about:blank');
      expect(page.title).toBe('Test Page');
      expect(page.content).toBe('<html><body><h1>Test Page</h1></body></html>');
      expect(page.elements).toBeInstanceOf(Map);
      expect(page.elements.size).toBe(0);
      expect(page.consoleMessages).toEqual([]);
      expect(page.errors).toEqual([]);
      expect(page.cookies).toEqual([]);
      expect(page.localStorage).toBeInstanceOf(Map);
      expect(page.localStorage.size).toBe(0);
    });

    it('should accept overrides to customize the mock page', () => {
      const overrides = {
        url: 'https://example.com',
        title: 'Custom Title',
        content: '<html><body><h1>Custom Content</h1></body></html>',
        errors: ['Test error']
      };

      const page = createMockPage(overrides);

      expect(page.url).toBe('https://example.com');
      expect(page.title).toBe('Custom Title');
      expect(page.content).toBe('<html><body><h1>Custom Content</h1></body></html>');
      expect(page.errors).toEqual(['Test error']);
    });

    it('should preserve default values for unspecified overrides', () => {
      const page = createMockPage({ url: 'https://test.com' });

      expect(page.url).toBe('https://test.com');
      expect(page.title).toBe('Test Page'); // Default preserved
      expect(page.elements).toBeInstanceOf(Map); // Default preserved
    });
  });

  describe('createMockElement', () => {
    it('should create a basic mock element with default values', () => {
      const element = createMockElement('#test');

      expect(element.selector).toBe('#test');
      expect(element.visible).toBe(true);
      expect(element.enabled).toBe(true);
      expect(element.text).toBe('');
      expect(element.value).toBe('');
      expect(element.attributes).toEqual({});
      expect(element.tagName).toBe('DIV');
      expect(element.children).toEqual([]);
    });

    it('should accept overrides to customize the element', () => {
      const overrides = {
        visible: false,
        enabled: false,
        text: 'Button Text',
        value: 'button-value',
        attributes: { type: 'button', class: 'btn' },
        tagName: 'BUTTON'
      };

      const element = createMockElement('#button', overrides);

      expect(element.selector).toBe('#button');
      expect(element.visible).toBe(false);
      expect(element.enabled).toBe(false);
      expect(element.text).toBe('Button Text');
      expect(element.value).toBe('button-value');
      expect(element.attributes).toEqual({ type: 'button', class: 'btn' });
      expect(element.tagName).toBe('BUTTON');
    });

    it('should handle nested children elements', () => {
      const child1 = createMockElement('#child1', { text: 'Child 1' });
      const child2 = createMockElement('#child2', { text: 'Child 2' });

      const parent = createMockElement('#parent', {
        children: [child1, child2]
      });

      expect(parent.children).toHaveLength(2);
      expect(parent.children[0].selector).toBe('#child1');
      expect(parent.children[0].text).toBe('Child 1');
      expect(parent.children[1].selector).toBe('#child2');
      expect(parent.children[1].text).toBe('Child 2');
    });
  });

  describe('createMockPageWithForm', () => {
    it('should create a page with form elements', () => {
      const formConfig: FormConfig = {
        action: '/submit',
        method: 'POST',
        submitLabel: 'Submit Form',
        fields: [
          { name: 'username', type: 'text', label: 'Username', required: true },
          { name: 'email', type: 'email', label: 'Email', placeholder: 'Enter email' },
          { name: 'age', type: 'number', label: 'Age', value: '25' }
        ]
      };

      const page = createMockPageWithForm(formConfig);

      expect(page.title).toBe('Form Test Page');
      expect(page.content).toContain('<form action="/submit" method="POST">');
      expect(page.content).toContain('name="username"');
      expect(page.content).toContain('type="text"');
      expect(page.content).toContain('required');

      // Check that elements were added to the map
      expect(page.elements.has('#username')).toBe(true);
      expect(page.elements.has('#email')).toBe(true);
      expect(page.elements.has('#age')).toBe(true);
      expect(page.elements.has('#submit')).toBe(true);

      const usernameElement = page.elements.get('#username');
      expect(usernameElement?.tagName).toBe('INPUT');
      expect(usernameElement?.attributes.name).toBe('username');
      expect(usernameElement?.attributes.type).toBe('text');
      expect(usernameElement?.attributes.required).toBe('true');

      const submitElement = page.elements.get('#submit');
      expect(submitElement?.tagName).toBe('BUTTON');
      expect(submitElement?.text).toBe('Submit Form');
    });

    it('should handle different field types correctly', () => {
      const formConfig: FormConfig = {
        fields: [
          { name: 'message', type: 'textarea', label: 'Message' },
          { name: 'country', type: 'select', label: 'Country', options: ['USA', 'Canada'] },
          { name: 'newsletter', type: 'checkbox', label: 'Subscribe to Newsletter' },
          { name: 'gender', type: 'radio', label: 'Gender', options: ['Male', 'Female'] }
        ]
      };

      const page = createMockPageWithForm(formConfig);

      const messageElement = page.elements.get('#message');
      expect(messageElement?.tagName).toBe('TEXTAREA');

      const countryElement = page.elements.get('#country');
      expect(countryElement?.tagName).toBe('SELECT');

      const newsletterElement = page.elements.get('#newsletter');
      expect(newsletterElement?.tagName).toBe('INPUT');
      expect(newsletterElement?.attributes.type).toBe('checkbox');

      const genderElement = page.elements.get('#gender');
      expect(genderElement?.tagName).toBe('INPUT');
      expect(genderElement?.attributes.type).toBe('radio');
    });

    it('should use default values when not specified', () => {
      const formConfig: FormConfig = {
        fields: [
          { name: 'test', type: 'text', label: 'Test' }
        ]
      };

      const page = createMockPageWithForm(formConfig);

      expect(page.content).toContain('<form action="" method="POST">');
      expect(page.elements.get('#submit')?.text).toBe('Submit');
    });
  });

  describe('createMockPageWithNavigation', () => {
    it('should create a page with navigation links', () => {
      const links: NavLink[] = [
        { href: '/home', text: 'Home' },
        { href: '/about', text: 'About', target: '_blank' },
        { href: '/contact', text: 'Contact' }
      ];

      const page = createMockPageWithNavigation(links);

      expect(page.title).toBe('Navigation Test Page');
      expect(page.content).toContain('<nav>');
      expect(page.content).toContain('href="/home"');
      expect(page.content).toContain('>Home</a>');
      expect(page.content).toContain('target="_blank"');

      // Check that navigation elements were added
      expect(page.elements.has('#nav-link-0')).toBe(true);
      expect(page.elements.has('#nav-link-1')).toBe(true);
      expect(page.elements.has('#nav-link-2')).toBe(true);

      const homeLink = page.elements.get('#nav-link-0');
      expect(homeLink?.tagName).toBe('A');
      expect(homeLink?.text).toBe('Home');
      expect(homeLink?.attributes.href).toBe('/home');
      expect(homeLink?.attributes.target).toBe('_self');

      const aboutLink = page.elements.get('#nav-link-1');
      expect(aboutLink?.attributes.target).toBe('_blank');
    });

    it('should handle empty navigation links', () => {
      const page = createMockPageWithNavigation([]);

      expect(page.title).toBe('Navigation Test Page');
      expect(page.elements.size).toBe(0);
    });
  });

  describe('addElementToMockPage', () => {
    let page: MockPageObject;

    beforeEach(() => {
      page = createMockPage();
    });

    it('should add an element to the page', () => {
      addElementToMockPage(page, '#new-element', {
        text: 'New Element',
        tagName: 'SPAN'
      });

      expect(page.elements.has('#new-element')).toBe(true);
      const element = page.elements.get('#new-element');
      expect(element?.text).toBe('New Element');
      expect(element?.tagName).toBe('SPAN');
      expect(element?.selector).toBe('#new-element');
    });

    it('should use default element properties when not specified', () => {
      addElementToMockPage(page, '#default-element');

      const element = page.elements.get('#default-element');
      expect(element?.visible).toBe(true);
      expect(element?.enabled).toBe(true);
      expect(element?.tagName).toBe('DIV');
    });

    it('should overwrite existing elements with the same selector', () => {
      addElementToMockPage(page, '#element', { text: 'First' });
      addElementToMockPage(page, '#element', { text: 'Second' });

      const element = page.elements.get('#element');
      expect(element?.text).toBe('Second');
    });
  });

  describe('addConsoleMessage', () => {
    let page: MockPageObject;

    beforeEach(() => {
      page = createMockPage();
    });

    it('should add a console message to the page', () => {
      addConsoleMessage(page, 'info', 'Test message');

      expect(page.consoleMessages).toHaveLength(1);
      expect(page.consoleMessages[0]).toEqual({
        level: 'info',
        text: 'Test message'
      });
    });

    it('should accumulate multiple console messages', () => {
      addConsoleMessage(page, 'info', 'First message');
      addConsoleMessage(page, 'error', 'Second message');
      addConsoleMessage(page, 'warn', 'Third message');

      expect(page.consoleMessages).toHaveLength(3);
      expect(page.consoleMessages[0].level).toBe('info');
      expect(page.consoleMessages[1].level).toBe('error');
      expect(page.consoleMessages[2].level).toBe('warn');
    });

    it('should handle different log levels', () => {
      const levels = ['debug', 'info', 'warn', 'error', 'log'];

      levels.forEach((level, index) => {
        addConsoleMessage(page, level, `Message ${index}`);
      });

      expect(page.consoleMessages).toHaveLength(5);
      levels.forEach((level, index) => {
        expect(page.consoleMessages[index].level).toBe(level);
        expect(page.consoleMessages[index].text).toBe(`Message ${index}`);
      });
    });
  });

  describe('addError', () => {
    let page: MockPageObject;

    beforeEach(() => {
      page = createMockPage();
    });

    it('should add an error to the page', () => {
      addError(page, 'Test error message');

      expect(page.errors).toHaveLength(1);
      expect(page.errors[0]).toBe('Test error message');
    });

    it('should accumulate multiple errors', () => {
      addError(page, 'First error');
      addError(page, 'Second error');
      addError(page, 'Third error');

      expect(page.errors).toHaveLength(3);
      expect(page.errors).toEqual(['First error', 'Second error', 'Third error']);
    });

    it('should handle empty error messages', () => {
      addError(page, '');

      expect(page.errors).toHaveLength(1);
      expect(page.errors[0]).toBe('');
    });
  });

  describe('setCookie', () => {
    let page: MockPageObject;

    beforeEach(() => {
      page = createMockPage();
    });

    it('should set a cookie on the page', () => {
      setCookie(page, 'session_id', 'abc123');

      expect(page.cookies).toHaveLength(1);
      expect(page.cookies[0]).toEqual({
        name: 'session_id',
        value: 'abc123'
      });
    });

    it('should set a cookie with domain', () => {
      setCookie(page, 'tracking', 'xyz789', '.example.com');

      expect(page.cookies).toHaveLength(1);
      expect(page.cookies[0]).toEqual({
        name: 'tracking',
        value: 'xyz789',
        domain: '.example.com'
      });
    });

    it('should accumulate multiple cookies', () => {
      setCookie(page, 'cookie1', 'value1');
      setCookie(page, 'cookie2', 'value2', '.test.com');

      expect(page.cookies).toHaveLength(2);
      expect(page.cookies[0].name).toBe('cookie1');
      expect(page.cookies[1].name).toBe('cookie2');
      expect(page.cookies[1].domain).toBe('.test.com');
    });

    it('should allow duplicate cookie names', () => {
      setCookie(page, 'duplicate', 'value1');
      setCookie(page, 'duplicate', 'value2');

      expect(page.cookies).toHaveLength(2);
      expect(page.cookies[0].value).toBe('value1');
      expect(page.cookies[1].value).toBe('value2');
    });
  });

  describe('setLocalStorage', () => {
    let page: MockPageObject;

    beforeEach(() => {
      page = createMockPage();
    });

    it('should set a localStorage item on the page', () => {
      setLocalStorage(page, 'user_preference', 'dark_mode');

      expect(page.localStorage.has('user_preference')).toBe(true);
      expect(page.localStorage.get('user_preference')).toBe('dark_mode');
    });

    it('should accumulate multiple localStorage items', () => {
      setLocalStorage(page, 'theme', 'dark');
      setLocalStorage(page, 'language', 'en-US');
      setLocalStorage(page, 'sidebar_collapsed', 'true');

      expect(page.localStorage.size).toBe(3);
      expect(page.localStorage.get('theme')).toBe('dark');
      expect(page.localStorage.get('language')).toBe('en-US');
      expect(page.localStorage.get('sidebar_collapsed')).toBe('true');
    });

    it('should overwrite existing localStorage values', () => {
      setLocalStorage(page, 'setting', 'initial');
      setLocalStorage(page, 'setting', 'updated');

      expect(page.localStorage.size).toBe(1);
      expect(page.localStorage.get('setting')).toBe('updated');
    });

    it('should handle empty keys and values', () => {
      setLocalStorage(page, '', 'empty key');
      setLocalStorage(page, 'empty_value', '');

      expect(page.localStorage.has('')).toBe(true);
      expect(page.localStorage.get('')).toBe('empty key');
      expect(page.localStorage.get('empty_value')).toBe('');
    });
  });

  describe('Integration tests', () => {
    it('should create a complex page with all features', () => {
      // Start with a form page
      const formConfig: FormConfig = {
        action: '/register',
        method: 'POST',
        fields: [
          { name: 'username', type: 'text', label: 'Username', required: true },
          { name: 'email', type: 'email', label: 'Email', required: true }
        ]
      };

      const page = createMockPageWithForm(formConfig);

      // Add additional elements
      addElementToMockPage(page, '#header', {
        text: 'Registration Form',
        tagName: 'H1'
      });

      addElementToMockPage(page, '#footer', {
        text: 'Copyright 2024',
        tagName: 'FOOTER'
      });

      // Add console messages
      addConsoleMessage(page, 'info', 'Form initialized');
      addConsoleMessage(page, 'warn', 'Password field missing');

      // Add errors
      addError(page, 'Validation error');

      // Set cookies and localStorage
      setCookie(page, 'csrf_token', 'token123');
      setLocalStorage(page, 'form_draft', '{"username":"test"}');

      // Verify the complete page state
      expect(page.title).toBe('Form Test Page');
      expect(page.elements.size).toBe(5); // username, email, submit, header, footer
      expect(page.consoleMessages).toHaveLength(2);
      expect(page.errors).toHaveLength(1);
      expect(page.cookies).toHaveLength(1);
      expect(page.localStorage.size).toBe(1);

      // Verify specific elements
      expect(page.elements.get('#header')?.text).toBe('Registration Form');
      expect(page.elements.get('#username')?.attributes.required).toBe('true');
      expect(page.consoleMessages[0].text).toBe('Form initialized');
      expect(page.errors[0]).toBe('Validation error');
      expect(page.cookies[0].name).toBe('csrf_token');
      expect(page.localStorage.get('form_draft')).toBe('{"username":"test"}');
    });
  });
});