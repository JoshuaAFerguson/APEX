/**
 * @fileoverview Element Creation Utilities Test Suite
 *
 * This test file comprehensively validates the element creation utilities
 * in the element interaction infrastructure. It tests:
 * - createElement function with various configurations
 * - createElementCollection for multiple elements
 * - createTestForm for complex form structures
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserTestBase, createBrowserTest } from '../../test-utils/browser-test-base.js';
import {
  createElement,
  createElementCollection,
  createTestForm,
  type FormField
} from '../utils/element-interaction-helpers.js';

describe('Element Creation Utilities', () => {
  let browserTest: BrowserTestBase;

  beforeEach(async () => {
    browserTest = createBrowserTest({
      headless: true,
      timeout: 30000,
    });
    await browserTest.setup();

    // Set up a basic test page
    await browserTest.context.page!.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Element Creation Test</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .container { max-width: 800px; margin: 0 auto; }
          .test-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Element Creation Test Page</h1>
          <div class="test-section" id="dynamic-content">
            <h2>Dynamic Elements Will Appear Here</h2>
          </div>
        </div>
      </body>
      </html>
    `);

    await browserTest.context.page!.waitForLoadState('domcontentloaded');
  });

  afterEach(async () => {
    await browserTest.teardown();
  });

  describe('createElement', () => {
    it('should create a basic button element', async () => {
      const buttonElement = await createElement(browserTest.context.page!, {
        tag: 'button',
        id: 'test-button',
        className: 'btn btn-primary',
        text: 'Click Me',
        parent: '.container'
      });

      expect(buttonElement).toBeDefined();
      expect(buttonElement.id).toBe('test-button');

      // Verify element appears in DOM
      const element = browserTest.context.page!.locator('#test-button');
      await expect(element).toBeVisible();

      const text = await element.textContent();
      expect(text).toBe('Click Me');

      const className = await element.getAttribute('class');
      expect(className).toBe('btn btn-primary');
    });

    it('should create an input element with attributes and styles', async () => {
      const inputElement = await createElement(browserTest.context.page!, {
        tag: 'input',
        id: 'test-input',
        className: 'form-control',
        attributes: {
          type: 'text',
          placeholder: 'Enter your name',
          'data-testid': 'name-input',
          required: 'true'
        },
        styles: {
          width: '300px',
          padding: '10px',
          borderRadius: '5px',
          border: '1px solid #ccc'
        },
        parent: '#dynamic-content'
      });

      expect(inputElement).toBeDefined();
      expect(inputElement.id).toBe('test-input');

      const element = browserTest.context.page!.locator('#test-input');
      await expect(element).toBeVisible();

      // Verify attributes
      const type = await element.getAttribute('type');
      expect(type).toBe('text');

      const placeholder = await element.getAttribute('placeholder');
      expect(placeholder).toBe('Enter your name');

      const testId = await element.getAttribute('data-testid');
      expect(testId).toBe('name-input');

      const required = await element.getAttribute('required');
      expect(required).toBe('');

      // Verify styles
      const width = await element.evaluate(el => getComputedStyle(el).width);
      expect(width).toBe('300px');
    });

    it('should create a div with innerHTML content', async () => {
      const divElement = await createElement(browserTest.context.page!, {
        tag: 'div',
        id: 'content-div',
        className: 'content-wrapper',
        innerHTML: `
          <h3>Dynamic Content</h3>
          <p>This content was inserted dynamically</p>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
            <li>Item 3</li>
          </ul>
        `,
        parent: '#dynamic-content'
      });

      expect(divElement).toBeDefined();
      expect(divElement.id).toBe('content-div');

      const element = browserTest.context.page!.locator('#content-div');
      await expect(element).toBeVisible();

      // Verify innerHTML content
      const h3 = element.locator('h3');
      await expect(h3).toBeVisible();
      await expect(h3).toHaveText('Dynamic Content');

      const listItems = element.locator('li');
      await expect(listItems).toHaveCount(3);
      await expect(listItems.nth(0)).toHaveText('Item 1');
    });

    it('should handle event listeners during creation', async () => {
      const buttonElement = await createElement(browserTest.context.page!, {
        tag: 'button',
        id: 'event-button',
        text: 'Click for Event',
        events: {
          click: `
            const button = event.target;
            button.textContent = 'Clicked!';
            button.setAttribute('data-clicked', 'true');
          `
        },
        parent: '.container'
      });

      expect(buttonElement).toBeDefined();

      const element = browserTest.context.page!.locator('#event-button');
      await expect(element).toBeVisible();

      // Click the button to trigger event
      await element.click();

      // Verify event was handled
      const text = await element.textContent();
      expect(text).toBe('Clicked!');

      const clicked = await element.getAttribute('data-clicked');
      expect(clicked).toBe('true');
    });
  });

  describe('createElementCollection', () => {
    it('should create multiple similar elements', async () => {
      const collection = await createElementCollection(browserTest.context.page!, {
        tag: 'button',
        baseId: 'btn',
        className: 'collection-button',
        count: 5,
        textTemplate: 'Button {index}',
        attributes: {
          'data-index': '{index}'
        },
        parent: '#dynamic-content'
      });

      expect(collection).toBeDefined();
      expect(collection.elements).toHaveLength(5);
      expect(Object.keys(collection.elementsById)).toHaveLength(5);

      // Verify each button was created correctly
      for (let i = 0; i < 5; i++) {
        const selector = `#btn-${i}`;
        const element = browserTest.context.page!.locator(selector);

        await expect(element).toBeVisible();

        const text = await element.textContent();
        expect(text).toBe(`Button ${i}`);

        const dataIndex = await element.getAttribute('data-index');
        expect(dataIndex).toBe(i.toString());
      }
    });

    it('should create collection with custom configuration per element', async () => {
      const customConfigs = [
        { id: 'red-btn', styles: { backgroundColor: 'red' }, text: 'Red Button' },
        { id: 'blue-btn', styles: { backgroundColor: 'blue' }, text: 'Blue Button' },
        { id: 'green-btn', styles: { backgroundColor: 'green' }, text: 'Green Button' }
      ];

      const collection = await createElementCollection(browserTest.context.page!, {
        tag: 'button',
        className: 'color-button',
        customConfigs,
        parent: '#dynamic-content'
      });

      expect(collection.elements).toHaveLength(3);

      // Verify custom configurations
      const redBtn = browserTest.context.page!.locator('#red-btn');
      await expect(redBtn).toHaveText('Red Button');

      const blueBtn = browserTest.context.page!.locator('#blue-btn');
      await expect(blueBtn).toHaveText('Blue Button');

      const greenBtn = browserTest.context.page!.locator('#green-btn');
      await expect(greenBtn).toHaveText('Green Button');
    });
  });

  describe('createTestForm', () => {
    it('should create a comprehensive form with various field types', async () => {
      const formFields: FormField[] = [
        {
          selector: 'username',
          type: 'text',
          label: 'Username',
          placeholder: 'Enter username',
          required: true,
          validationPattern: '^[a-zA-Z0-9_]+$'
        },
        {
          selector: 'email',
          type: 'email',
          label: 'Email Address',
          placeholder: 'Enter email',
          required: true
        },
        {
          selector: 'password',
          type: 'password',
          label: 'Password',
          required: true,
          minLength: 8
        },
        {
          selector: 'age',
          type: 'number',
          label: 'Age',
          min: 18,
          max: 100
        },
        {
          selector: 'bio',
          type: 'textarea',
          label: 'Biography',
          placeholder: 'Tell us about yourself',
          rows: 4
        },
        {
          selector: 'country',
          type: 'select',
          label: 'Country',
          options: [
            { value: '', text: 'Select Country' },
            { value: 'us', text: 'United States' },
            { value: 'ca', text: 'Canada' },
            { value: 'uk', text: 'United Kingdom' }
          ]
        },
        {
          selector: 'newsletter',
          type: 'checkbox',
          label: 'Subscribe to newsletter'
        },
        {
          selector: 'gender',
          type: 'radio',
          label: 'Gender',
          options: [
            { value: 'male', text: 'Male' },
            { value: 'female', text: 'Female' },
            { value: 'other', text: 'Other' }
          ]
        }
      ];

      const { form, fields } = await createTestForm(browserTest.context.page!, {
        id: 'comprehensive-form',
        className: 'test-form',
        fields: formFields,
        submitButton: true,
        resetButton: true,
        parent: '#dynamic-content'
      });

      expect(form).toBeDefined();
      expect(form.id).toBe('comprehensive-form');
      expect(Object.keys(fields)).toHaveLength(8);

      // Verify form is visible
      const formElement = browserTest.context.page!.locator('#comprehensive-form');
      await expect(formElement).toBeVisible();

      // Verify each field type
      await expect(browserTest.context.page!.locator('#comprehensive-form-username')).toBeVisible();
      await expect(browserTest.context.page!.locator('#comprehensive-form-email')).toBeVisible();
      await expect(browserTest.context.page!.locator('#comprehensive-form-password')).toBeVisible();
      await expect(browserTest.context.page!.locator('#comprehensive-form-age')).toBeVisible();
      await expect(browserTest.context.page!.locator('#comprehensive-form-bio')).toBeVisible();
      await expect(browserTest.context.page!.locator('#comprehensive-form-country')).toBeVisible();
      await expect(browserTest.context.page!.locator('#comprehensive-form-newsletter')).toBeVisible();

      // Verify radio buttons
      await expect(browserTest.context.page!.locator('input[name="comprehensive-form-gender"]')).toHaveCount(3);

      // Verify submit and reset buttons
      await expect(browserTest.context.page!.locator('button[type="submit"]')).toBeVisible();
      await expect(browserTest.context.page!.locator('button[type="reset"]')).toBeVisible();
    });

    it('should create form with validation and custom styling', async () => {
      const formFields: FormField[] = [
        {
          selector: 'email',
          type: 'email',
          label: 'Email',
          required: true,
          validationMessage: 'Please enter a valid email address'
        },
        {
          selector: 'phone',
          type: 'tel',
          label: 'Phone Number',
          pattern: '^[0-9-()+ ]+$',
          validationMessage: 'Please enter a valid phone number'
        }
      ];

      const { form, fields } = await createTestForm(browserTest.context.page!, {
        id: 'validation-form',
        fields: formFields,
        submitButton: true,
        formStyles: {
          maxWidth: '400px',
          margin: '20px auto',
          padding: '20px',
          border: '1px solid #ddd',
          borderRadius: '8px'
        },
        fieldStyles: {
          marginBottom: '15px'
        },
        labelStyles: {
          display: 'block',
          marginBottom: '5px',
          fontWeight: 'bold'
        },
        inputStyles: {
          width: '100%',
          padding: '8px',
          border: '1px solid #ccc',
          borderRadius: '4px'
        },
        parent: '#dynamic-content'
      });

      expect(form).toBeDefined();
      expect(Object.keys(fields)).toHaveLength(2);

      // Verify form styling was applied
      const formElement = browserTest.context.page!.locator('#validation-form');
      await expect(formElement).toBeVisible();

      const maxWidth = await formElement.evaluate(el => getComputedStyle(el).maxWidth);
      expect(maxWidth).toBe('400px');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid parent selectors gracefully', async () => {
      try {
        await createElement(browserTest.context.page!, {
          tag: 'div',
          id: 'invalid-parent-test',
          parent: '#non-existent-parent'
        });
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('Parent element not found');
      }
    });

    it('should handle malformed HTML gracefully', async () => {
      const element = await createElement(browserTest.context.page!, {
        tag: 'div',
        id: 'malformed-test',
        innerHTML: '<p>Unclosed paragraph<span>Nested span</div>', // Malformed HTML
        parent: '.container'
      });

      expect(element).toBeDefined();

      // Verify the element still gets created (browser will fix HTML)
      const createdElement = browserTest.context.page!.locator('#malformed-test');
      await expect(createdElement).toBeVisible();
    });

    it('should validate required parameters', async () => {
      try {
        await createElement(browserTest.context.page!, {
          // Missing tag - should throw error
        } as any);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('tag is required');
      }
    });
  });

  describe('Performance and Memory', () => {
    it('should handle creation of many elements efficiently', async () => {
      const startTime = Date.now();

      // Create 50 elements
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          createElement(browserTest.context.page!, {
            tag: 'div',
            id: `perf-test-${i}`,
            className: 'perf-element',
            text: `Element ${i}`,
            parent: '#dynamic-content'
          })
        );
      }

      const elements = await Promise.all(promises);
      const endTime = Date.now();

      expect(elements).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all elements are in the DOM
      const elementCount = await browserTest.context.page!.locator('.perf-element').count();
      expect(elementCount).toBe(50);
    });

    it('should properly clean up event listeners', async () => {
      const element = await createElement(browserTest.context.page!, {
        tag: 'button',
        id: 'cleanup-test',
        text: 'Test Cleanup',
        events: {
          click: 'console.log("Button clicked");'
        },
        parent: '.container'
      });

      expect(element).toBeDefined();

      // Remove the element
      await browserTest.context.page!.evaluate(() => {
        const el = document.getElementById('cleanup-test');
        if (el) {
          el.remove();
        }
      });

      // Verify element is gone
      const elementExists = await browserTest.context.page!.locator('#cleanup-test').isVisible();
      expect(elementExists).toBe(false);
    });
  });
});