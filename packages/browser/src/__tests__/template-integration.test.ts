/**
 * @apexcli/browser - Template Integration Tests
 *
 * Integration tests that validate the HTML templates work correctly with browser automation:
 * - Template rendering in browser contexts
 * - Template variable injection in real scenarios
 * - Template builders producing automation-compatible HTML
 * - End-to-end template usage workflows
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TestPages,
  NavigationTemplateBuilder,
  FormTemplateBuilder,
  TemplateProcessor,
  TemplateVariables,
  TestDataGenerators
} from '../test-utils/test-pages.js';
import { JSDOM } from 'jsdom';

// Mock browser manager for integration testing
class MockBrowserManager {
  private currentHtml: string = '';
  private dom: JSDOM | null = null;

  async loadPage(html: string): Promise<void> {
    this.currentHtml = html;
    this.dom = new JSDOM(html, {
      url: 'http://localhost:3000/',
      runScripts: 'dangerously',
      resources: 'usable'
    });

    // Simulate page load event
    this.dom.window.dispatchEvent(new this.dom.window.Event('DOMContentLoaded'));
  }

  getDocument(): Document {
    if (!this.dom) throw new Error('No page loaded');
    return this.dom.window.document;
  }

  getWindow(): Window {
    if (!this.dom) throw new Error('No page loaded');
    return this.dom.window as any;
  }

  async clickElement(selector: string): Promise<void> {
    const element = this.getDocument().querySelector(selector) as HTMLElement;
    if (!element) throw new Error(`Element not found: ${selector}`);
    element.click();
  }

  async fillInput(selector: string, value: string): Promise<void> {
    const input = this.getDocument().querySelector(selector) as HTMLInputElement;
    if (!input) throw new Error(`Input not found: ${selector}`);
    input.value = value;
    input.dispatchEvent(new this.dom!.window.Event('input', { bubbles: true }));
  }

  async getElementText(selector: string): Promise<string> {
    const element = this.getDocument().querySelector(selector);
    if (!element) throw new Error(`Element not found: ${selector}`);
    return element.textContent || '';
  }

  async executeScript(script: string): Promise<any> {
    return this.getWindow().eval(script);
  }

  cleanup(): void {
    this.dom?.window.close();
    this.dom = null;
  }
}

describe('Template Integration Tests', () => {
  let browser: MockBrowserManager;

  beforeEach(() => {
    browser = new MockBrowserManager();
  });

  afterEach(() => {
    browser.cleanup();
  });

  describe('Template Loading and Rendering', () => {
    it('should load and render simple template correctly', async () => {
      const html = TestPages.simple('Integration Test', '#f0f0f0');
      await browser.loadPage(html);

      const document = browser.getDocument();
      const title = document.querySelector('title')?.textContent;
      const heading = document.querySelector('h1')?.textContent;

      expect(title).toBe('Integration Test');
      expect(heading).toBe('Integration Test');

      const body = document.querySelector('body');
      expect(body?.style.background).toContain('#f0f0f0');
    });

    it('should load and render complex template with animations', async () => {
      const html = TestPages.complex();
      await browser.loadPage(html);

      const document = browser.getDocument();
      const animatedElement = document.querySelector('.pulse');
      const gradientText = document.querySelector('.gradient-text');

      expect(animatedElement).toBeTruthy();
      expect(gradientText).toBeTruthy();

      // Verify CSS animations are present
      const styles = document.querySelector('style')?.textContent;
      expect(styles).toContain('@keyframes pulse');
      expect(styles).toContain('animation: pulse');
    });

    it('should load template with unicode characters correctly', async () => {
      const html = TestPages.unicode();
      await browser.loadPage(html);

      const document = browser.getDocument();
      const body = document.body;

      expect(body.textContent).toContain('🌟');
      expect(body.textContent).toContain('你好');
      expect(body.textContent).toContain('こんにちは');
      expect(body.textContent).toContain('₿');
    });
  });

  describe('Template Variable Injection in Browser Context', () => {
    it('should inject variables correctly in form template', async () => {
      const variables: TemplateVariables = {
        title: 'Custom Integration Form',
        backgroundColor: '#e6f3ff',
        defaultText: 'Integrated Text',
        defaultEmail: 'integration@test.com',
        defaultNumber: '75'
      };

      const html = TestPages.formTest(variables);
      await browser.loadPage(html);

      const document = browser.getDocument();

      expect(document.title).toBe('Custom Integration Form');
      expect(document.body.style.backgroundColor).toBe('rgb(230, 243, 255)');

      const textInput = document.getElementById('text-input') as HTMLInputElement;
      const emailInput = document.getElementById('email-input') as HTMLInputElement;
      const numberInput = document.getElementById('number-input') as HTMLInputElement;

      expect(textInput.value).toBe('Integrated Text');
      expect(emailInput.value).toBe('integration@test.com');
      expect(numberInput.value).toBe('75');
    });

    it('should inject variables correctly in iframe template', async () => {
      const variables: TemplateVariables = {
        title: 'Integration Iframe Test',
        iframeSrc: 'custom-integration.html',
        iframeHeight: '500px'
      };

      const html = TestPages.iframeTest(variables);
      await browser.loadPage(html);

      const document = browser.getDocument();
      const iframe = document.getElementById('test-iframe') as HTMLIFrameElement;

      expect(document.title).toBe('Integration Iframe Test');
      expect(iframe.src).toContain('custom-integration.html');
      expect(iframe.style.height).toBe('500px');
    });
  });

  describe('Navigation Template Builder Integration', () => {
    it('should build and load navigation template correctly', async () => {
      const html = new NavigationTemplateBuilder()
        .setTitle('Integration Navigation Test')
        .setBackgroundColor('#f5f5f5')
        .setDescription('Testing navigation template integration')
        .addLink('page1.html', 'Page 1')
        .addLink('page2.html', 'Page 2', '_blank')
        .addLink('page3.html', 'Page 3')
        .build();

      await browser.loadPage(html);

      const document = browser.getDocument();
      expect(document.title).toBe('Integration Navigation Test');
      expect(document.body.textContent).toContain('Testing navigation template integration');

      const links = document.querySelectorAll('.nav-links a');
      expect(links).toHaveLength(3);

      const link1 = links[0] as HTMLAnchorElement;
      const link2 = links[1] as HTMLAnchorElement;

      expect(link1.href).toContain('page1.html');
      expect(link1.textContent).toBe('Page 1');
      expect(link2.target).toBe('_blank');
    });

    it('should provide working JavaScript helpers in navigation template', async () => {
      const html = new NavigationTemplateBuilder()
        .addLink('test1.html', 'Test 1')
        .addLink('test2.html', 'Test 2')
        .build();

      await browser.loadPage(html);

      // Test JavaScript helpers
      const pageInstance = await browser.executeScript('window.testHelpers.getPageInstance()');
      const linksCount = await browser.executeScript('window.testHelpers.getLinksCount()');
      const allLinks = await browser.executeScript('window.testHelpers.getAllLinks()');

      expect(typeof pageInstance).toBe('string');
      expect(pageInstance).toHaveLength(9); // Random string length
      expect(linksCount).toBe(2);
      expect(Array.isArray(allLinks)).toBe(true);
      expect(allLinks).toHaveLength(2);
      expect(allLinks[0]).toHaveProperty('href');
      expect(allLinks[0]).toHaveProperty('text');
    });
  });

  describe('Form Template Builder Integration', () => {
    it('should build and load form template correctly', async () => {
      const html = new FormTemplateBuilder()
        .setTitle('Integration Form Test')
        .setBackgroundColor('#fff8f0')
        .addTextField('username', 'Username', { placeholder: 'Enter username' })
        .addEmailField('email', 'Email Address', { required: 'true' })
        .addPasswordField('password', 'Password')
        .addNumberField('age', 'Age', 18, 100)
        .addSelectField('category', 'Category', [
          { value: 'A', text: 'Category A' },
          { value: 'B', text: 'Category B' }
        ])
        .addTextareaField('notes', 'Notes', 3)
        .build();

      await browser.loadPage(html);

      const document = browser.getDocument();
      expect(document.title).toBe('Integration Form Test');

      // Verify all fields are present and functional
      const usernameField = document.getElementById('username') as HTMLInputElement;
      const emailField = document.getElementById('email') as HTMLInputElement;
      const passwordField = document.getElementById('password') as HTMLInputElement;
      const ageField = document.getElementById('age') as HTMLInputElement;
      const categoryField = document.getElementById('category') as HTMLSelectElement;
      const notesField = document.getElementById('notes') as HTMLTextAreaElement;

      expect(usernameField.type).toBe('text');
      expect(usernameField.placeholder).toBe('Enter username');
      expect(emailField.type).toBe('email');
      expect(emailField.required).toBe(true);
      expect(passwordField.type).toBe('password');
      expect(ageField.type).toBe('number');
      expect(ageField.min).toBe('18');
      expect(ageField.max).toBe('100');
      expect(categoryField.tagName).toBe('SELECT');
      expect(categoryField.options).toHaveLength(2);
      expect(notesField.tagName).toBe('TEXTAREA');
      expect(notesField.rows).toBe(3);
    });

    it('should provide working form helpers and functionality', async () => {
      const html = new FormTemplateBuilder()
        .addTextField('test', 'Test Field')
        .addEmailField('email', 'Email')
        .build();

      await browser.loadPage(html);

      // Test form helpers
      const fieldsCount = await browser.executeScript('window.testHelpers.getFieldsCount()');
      expect(fieldsCount).toBe(2);

      // Test fill functionality
      await browser.executeScript('window.testHelpers.fillTestData()');

      const testField = browser.getDocument().getElementById('test') as HTMLInputElement;
      const emailField = browser.getDocument().getElementById('email') as HTMLInputElement;

      expect(testField.value).toContain('Test Text');
      expect(emailField.value).toBe('test@example.com');

      // Test get form data
      const formData = await browser.executeScript('window.testHelpers.getFormData()');
      expect(typeof formData).toBe('object');
      expect(formData).toHaveProperty('test');
      expect(formData).toHaveProperty('email');
    });
  });

  describe('Template Data Generators Integration', () => {
    it('should generate and render heavy content correctly', async () => {
      const html = TestDataGenerators.generateHeavyContent(50);
      await browser.loadPage(html);

      const document = browser.getDocument();
      const elements = document.querySelectorAll('div');

      // Should have 50 content elements plus container elements
      expect(elements.length).toBeGreaterThanOrEqual(50);

      // Should contain element numbering
      expect(document.body.textContent).toContain('Element 1');
      expect(document.body.textContent).toContain('Element 50');
    });

    it('should generate random test page with valid structure', async () => {
      const html = TestDataGenerators.randomTestPage();
      await browser.loadPage(html);

      const document = browser.getDocument();

      expect(document.querySelector('h1')).toBeTruthy();
      expect(document.querySelectorAll('p').length).toBeGreaterThan(5);

      // Should have colorful styling
      const body = document.body;
      expect(body.style.background).toContain('hsl(');
      expect(body.style.color).toContain('hsl(');
    });

    it('should generate consistent random colors in valid format', () => {
      for (let i = 0; i < 20; i++) {
        const color = TestDataGenerators.randomColor();
        expect(color).toMatch(/^hsl\(\d{1,3}, \d{1,3}%, \d{1,3}%\)$/);

        // Parse and validate color ranges
        const match = color.match(/hsl\((\d+), (\d+)%, (\d+)%\)/);
        expect(match).toBeTruthy();

        const [, hue, saturation, lightness] = match!;
        expect(parseInt(hue)).toBeGreaterThanOrEqual(0);
        expect(parseInt(hue)).toBeLessThan(360);
        expect(parseInt(saturation)).toBeGreaterThanOrEqual(50);
        expect(parseInt(lightness)).toBeGreaterThanOrEqual(40);
      }
    });
  });

  describe('Template JavaScript Functionality Integration', () => {
    it('should execute form validation correctly in browser context', async () => {
      const html = TestPages.formTest();
      await browser.loadPage(html);

      // Fill form with invalid data
      await browser.fillInput('#firstName', '');
      await browser.fillInput('#email', 'invalid-email');

      // Trigger validation
      await browser.executeScript('window.testHelpers.validateForm()');

      // Check validation results
      const validationResults = browser.getDocument().getElementById('validation-results');
      const validationText = validationResults?.textContent || '';

      expect(validationText).toContain('❌');
      expect(validationText).toContain('First name is required');
      expect(validationText).toContain('Email format is invalid');
    });

    it('should handle navigation functionality correctly', async () => {
      const html = TestPages.simple('Navigation Test');
      await browser.loadPage(html);

      // Get initial page instance
      const initialInstance = await browser.executeScript('window.testHelpers.getPageInstance()');
      expect(typeof initialInstance).toBe('string');

      // Get load time
      const loadTime = await browser.executeScript('window.testHelpers.getLoadTime()');
      expect(loadTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO timestamp format
    });

    it('should handle iframe functionality correctly', async () => {
      const html = TestPages.iframeTest();
      await browser.loadPage(html);

      // Get initial iframe count
      const initialCount = await browser.executeScript('window.testHelpers.getIframeCount()');
      expect(initialCount).toBeGreaterThan(0);

      // Get iframe by ID
      const iframe = await browser.executeScript('window.testHelpers.getIframeById("iframe-basic")');
      expect(iframe).toBeTruthy();
    });
  });

  describe('Template Processor Advanced Integration', () => {
    it('should handle complex nested variable scenarios', async () => {
      const processor = TemplateProcessor.createProcessor({
        siteName: 'Integration Test Site',
        version: '2.0',
        author: 'Test Author'
      });

      const template = `
        <html>
          <head><title>{{siteName}} - Version {{version}}</title></head>
          <body>
            <header>
              <h1>{{siteName}}</h1>
              <p>Version: {{version}} by {{author}}</p>
              <p>Custom message: {{customMessage}}</p>
            </header>
            <main>Content goes here</main>
          </body>
        </html>
      `;

      const html = processor(template, { customMessage: 'Integration Success!' });
      await browser.loadPage(html);

      const document = browser.getDocument();

      expect(document.title).toBe('Integration Test Site - Version 2.0');
      expect(document.querySelector('h1')?.textContent).toBe('Integration Test Site');
      expect(document.body.textContent).toContain('Version: 2.0 by Test Author');
      expect(document.body.textContent).toContain('Custom message: Integration Success!');
    });

    it('should handle template processing with special characters and HTML entities', async () => {
      const variables: TemplateVariables = {
        title: 'Test & "Integration" <Special>',
        description: 'This contains special chars: &amp; &lt; &gt; "quotes"'
      };

      const template = `
        <html>
          <head><title>{{title}}</title></head>
          <body>
            <h1>{{title}}</h1>
            <p>{{description}}</p>
          </body>
        </html>
      `;

      const html = TemplateProcessor.process(template, variables);
      await browser.loadPage(html);

      const document = browser.getDocument();

      // Special characters should be preserved
      expect(document.title).toContain('Test & "Integration" <Special>');
      expect(document.body.textContent).toContain('&amp; &lt; &gt; "quotes"');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed templates gracefully', async () => {
      const malformedHtml = '<html><head><title>Test</title><body><h1>Unclosed tags test</body></html>';

      // Should not throw when loading malformed HTML
      expect(async () => {
        await browser.loadPage(malformedHtml);
      }).not.toThrow();

      const document = browser.getDocument();
      expect(document.title).toBe('Test');
    });

    it('should handle missing template variables gracefully', async () => {
      const template = `
        <html>
          <head><title>{{missingTitle}}</title></head>
          <body>
            <h1>{{existingTitle}}</h1>
            <p>{{missingDescription}}</p>
          </body>
        </html>
      `;

      const html = TemplateProcessor.process(template, { existingTitle: 'Existing' });
      await browser.loadPage(html);

      const document = browser.getDocument();

      // Missing variables should remain as placeholders
      expect(document.title).toBe('{{missingTitle}}');
      expect(document.querySelector('h1')?.textContent).toBe('Existing');
      expect(document.body.textContent).toContain('{{missingDescription}}');
    });

    it('should handle empty or null template values', async () => {
      const variables: TemplateVariables = {
        title: '',
        content: null as any,
        number: 0,
        boolean: false
      };

      const template = `
        <html>
          <body>
            <h1>{{title}}</h1>
            <p>{{content}}</p>
            <span>{{number}}</span>
            <div>{{boolean}}</div>
          </body>
        </html>
      `;

      const html = TemplateProcessor.process(template, variables);
      await browser.loadPage(html);

      const document = browser.getDocument();

      expect(document.querySelector('h1')?.textContent).toBe('');
      expect(document.body.textContent).toContain('{{content}}'); // null becomes placeholder
      expect(document.body.textContent).toContain('0');
      expect(document.body.textContent).toContain('false');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large templates efficiently', async () => {
      const startTime = Date.now();

      const html = TestDataGenerators.generateHeavyContent(1000);
      await browser.loadPage(html);

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      // Should load within reasonable time (less than 2 seconds)
      expect(loadTime).toBeLessThan(2000);

      const document = browser.getDocument();
      const elements = document.querySelectorAll('div');
      expect(elements.length).toBeGreaterThanOrEqual(1000);
    });

    it('should handle multiple template variables efficiently', async () => {
      const variables: TemplateVariables = {};

      // Create 100 variables
      for (let i = 0; i < 100; i++) {
        variables[`var${i}`] = `Value ${i}`;
      }

      let template = '<html><body>';
      for (let i = 0; i < 100; i++) {
        template += `<p>Variable ${i}: {{var${i}}}</p>`;
      }
      template += '</body></html>';

      const startTime = Date.now();
      const html = TemplateProcessor.process(template, variables);
      const processTime = Date.now() - startTime;

      // Should process within reasonable time
      expect(processTime).toBeLessThan(100);

      await browser.loadPage(html);

      const document = browser.getDocument();
      const paragraphs = document.querySelectorAll('p');
      expect(paragraphs).toHaveLength(100);

      // Check a few random values
      expect(paragraphs[0].textContent).toBe('Variable 0: Value 0');
      expect(paragraphs[50].textContent).toBe('Variable 50: Value 50');
      expect(paragraphs[99].textContent).toBe('Variable 99: Value 99');
    });
  });
});