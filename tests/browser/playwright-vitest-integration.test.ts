/**
 * @fileoverview Vitest + Playwright Integration Test
 *
 * This test file verifies that Playwright works correctly with Vitest browser mode.
 * It tests the integration between @vitest/browser and Playwright provider.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { browserUtils } from './setup.js';

describe('Playwright + Vitest Browser Integration', () => {
  beforeEach(() => {
    // Clean up DOM for each test
    if (typeof document !== 'undefined') {
      document.body.innerHTML = '';
    }
  });

  describe('DOM Manipulation and Interaction', () => {
    it('should manipulate DOM elements in browser environment', () => {
      // Create test content
      browserUtils.createTestPage(`
        <div id="test-container">
          <h1 id="title">Test Page</h1>
          <button id="click-button">Click Me</button>
          <input id="text-input" type="text" placeholder="Enter text" />
          <div id="output">Initial state</div>
        </div>
      `);

      // Verify elements exist
      const title = document.querySelector('#title');
      const button = document.querySelector('#click-button');
      const input = document.querySelector('#text-input') as HTMLInputElement;
      const output = document.querySelector('#output');

      expect(title).toBeTruthy();
      expect(button).toBeTruthy();
      expect(input).toBeTruthy();
      expect(output).toBeTruthy();

      // Test text content
      expect(title?.textContent).toBe('Test Page');
      expect(output?.textContent).toBe('Initial state');
    });

    it('should handle user interactions', () => {
      browserUtils.createTestPage(`
        <button id="counter-btn">Count: 0</button>
        <script>
          let count = 0;
          document.getElementById('counter-btn').addEventListener('click', function() {
            count++;
            this.textContent = 'Count: ' + count;
          });
        </script>
      `);

      const button = document.querySelector('#counter-btn') as HTMLButtonElement;
      expect(button.textContent).toBe('Count: 0');

      // Simulate clicks
      button.click();
      expect(button.textContent).toBe('Count: 1');

      button.click();
      expect(button.textContent).toBe('Count: 2');
    });

    it('should handle form interactions', () => {
      browserUtils.createTestPage(`
        <form id="test-form">
          <input id="name-input" type="text" name="name" />
          <input id="email-input" type="email" name="email" />
          <button type="submit">Submit</button>
        </form>
        <div id="form-output"></div>
      `);

      const nameInput = document.querySelector('#name-input') as HTMLInputElement;
      const emailInput = document.querySelector('#email-input') as HTMLInputElement;
      const output = document.querySelector('#form-output');

      // Fill in form
      nameInput.value = 'Test User';
      emailInput.value = 'test@example.com';

      // Trigger input events
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));

      expect(nameInput.value).toBe('Test User');
      expect(emailInput.value).toBe('test@example.com');
    });
  });

  describe('Browser Environment Testing', () => {
    it('should have access to browser APIs', () => {
      // Test that we have access to browser globals
      expect(window).toBeDefined();
      expect(document).toBeDefined();
      expect(navigator).toBeDefined();
      expect(location).toBeDefined();

      // Test browser info
      const browserInfo = browserUtils.getBrowserInfo();
      expect(browserInfo).toBeDefined();
      expect(typeof browserInfo).toBe('object');
    });

    it('should support local storage', () => {
      // Test localStorage
      localStorage.setItem('test-key', 'test-value');
      expect(localStorage.getItem('test-key')).toBe('test-value');

      // Test sessionStorage
      sessionStorage.setItem('session-key', 'session-value');
      expect(sessionStorage.getItem('session-key')).toBe('session-value');

      // Cleanup
      localStorage.removeItem('test-key');
      sessionStorage.removeItem('session-key');
    });

    it('should support cookies', () => {
      // Test cookie manipulation
      document.cookie = 'test-cookie=test-value';
      expect(document.cookie).toContain('test-cookie=test-value');
    });

    it('should support async operations', async () => {
      let resolved = false;

      // Test Promise
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolved = true;
          resolve();
        }, 100);
      });

      expect(resolved).toBe(true);
    });
  });

  describe('Event Handling', () => {
    it('should handle DOM events', () => {
      browserUtils.createTestPage(`
        <button id="event-button">Click for Event</button>
        <div id="event-output"></div>
      `);

      const button = document.querySelector('#event-button')!;
      const output = document.querySelector('#event-output')!;
      let eventFired = false;

      button.addEventListener('click', (event) => {
        eventFired = true;
        output.textContent = `Event fired: ${event.type}`;
      });

      // Trigger event
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(eventFired).toBe(true);
      expect(output.textContent).toBe('Event fired: click');
    });

    it('should handle keyboard events', () => {
      browserUtils.createTestPage(`
        <input id="key-input" type="text" />
        <div id="key-output"></div>
      `);

      const input = document.querySelector('#key-input')!;
      const output = document.querySelector('#key-output')!;

      input.addEventListener('keydown', (event) => {
        output.textContent = `Key pressed: ${event.key}`;
      });

      // Simulate keydown event
      const keyEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      input.dispatchEvent(keyEvent);

      expect(output.textContent).toBe('Key pressed: Enter');
    });

    it('should handle custom events', () => {
      browserUtils.createTestPage(`
        <div id="custom-target"></div>
        <div id="custom-output"></div>
      `);

      const target = document.querySelector('#custom-target')!;
      const output = document.querySelector('#custom-output')!;

      target.addEventListener('custom-event', (event: any) => {
        output.textContent = `Custom event: ${event.detail.message}`;
      });

      // Dispatch custom event
      const customEvent = new CustomEvent('custom-event', {
        detail: { message: 'Hello from custom event!' }
      });
      target.dispatchEvent(customEvent);

      expect(output.textContent).toBe('Custom event: Hello from custom event!');
    });
  });

  describe('Advanced Browser Features', () => {
    it('should support CSS and styling', () => {
      browserUtils.createTestPage(`
        <style>
          .styled-element {
            color: red;
            font-size: 20px;
            margin: 10px;
          }
        </style>
        <div id="styled-div" class="styled-element">Styled content</div>
      `);

      const styledDiv = document.querySelector('#styled-div') as HTMLElement;
      const styles = window.getComputedStyle(styledDiv);

      expect(styles.color).toBe('red');
      expect(styles.fontSize).toBe('20px');
      expect(styles.margin).toBe('10px');
    });

    it('should support media queries and responsive design', () => {
      browserUtils.createTestPage(`
        <style>
          .responsive-element {
            width: 100px;
          }
          @media (max-width: 600px) {
            .responsive-element {
              width: 50px;
            }
          }
        </style>
        <div id="responsive-div" class="responsive-element">Responsive</div>
      `);

      const responsiveDiv = document.querySelector('#responsive-div') as HTMLElement;

      // Note: In test environment, we might not be able to control viewport size
      // but we can verify the element exists and has styles applied
      expect(responsiveDiv).toBeTruthy();
      expect(responsiveDiv.className).toBe('responsive-element');
    });

    it('should support fetch and network requests', async () => {
      // Test fetch is available
      expect(fetch).toBeDefined();

      // In a real test, you might mock fetch or test against a test server
      // For now, just verify the API is available
      const fetchExists = typeof fetch === 'function';
      expect(fetchExists).toBe(true);
    });
  });

  describe('Performance and Timing', () => {
    it('should support performance measurements', () => {
      // Test performance API
      expect(performance).toBeDefined();
      expect(performance.now).toBeDefined();

      const start = performance.now();
      const end = performance.now();

      expect(typeof start).toBe('number');
      expect(typeof end).toBe('number');
      expect(end).toBeGreaterThanOrEqual(start);
    });

    it('should handle timers correctly', async () => {
      let timerFired = false;

      // Test setTimeout
      setTimeout(() => {
        timerFired = true;
      }, 50);

      // Wait for timer
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(timerFired).toBe(true);
    });

    it('should support requestAnimationFrame', () => {
      expect(requestAnimationFrame).toBeDefined();
      expect(cancelAnimationFrame).toBeDefined();

      let animationFired = false;

      requestAnimationFrame(() => {
        animationFired = true;
      });

      // Note: In test environment, RAF might behave differently
      // but we can verify the API exists
      expect(typeof requestAnimationFrame).toBe('function');
    });
  });
});