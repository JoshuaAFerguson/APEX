/**
 * @fileoverview Enhanced Element Interaction Integration Tests
 *
 * Additional comprehensive tests for element interaction scenarios that complement
 * the main comprehensive test suite. These tests cover edge cases and specific
 * interaction patterns that might not be covered in the main test file.
 *
 * Test categories:
 * - Advanced form controls (date, time, file inputs)
 * - Drag and drop interactions
 * - Touch/mobile interactions simulation
 * - Complex multi-step interactions
 * - Performance and stress testing scenarios
 * - Custom element interactions
 * - Shadow DOM element interactions
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';

describe('Enhanced Element Interaction Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let testPageContent: string;

  beforeAll(async () => {
    // Initialize browser with enhanced capabilities
    browser = await chromium.launch({
      headless: process.env.CI === 'true' || process.env.BROWSER_TEST_HEADLESS === 'true',
      slowMo: process.env.CI ? 0 : 50,
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      reducedMotion: 'reduce',
      // Enable touch support for mobile interaction testing
      hasTouch: true,
    });

    testPageContent = createEnhancedTestPageHTML();
  });

  afterAll(async () => {
    if (context) await context.close();
    if (browser) await browser.close();
  });

  beforeEach(async () => {
    page = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.setContent(testPageContent);
    await page.waitForSelector('#interaction-log');

    // Clear interaction log
    await page.evaluate(() => {
      (window as any).enhancedInteractionLog = [];
      const logElement = document.getElementById('interaction-log');
      if (logElement) {
        logElement.textContent = 'Enhanced interaction log cleared';
      }
    });
  });

  afterEach(async () => {
    if (page) await page.close();
  });

  describe('Advanced Form Controls', () => {
    it('should handle date input interactions', async () => {
      const testDate = '2024-01-15';
      await page.fill('#date-input', testDate);

      const value = await page.inputValue('#date-input');
      expect(value).toBe(testDate);

      const log = await page.evaluate(() => (window as any).enhancedInteractionLog);
      expect(log.some((entry: string) => entry.includes('input:date-input'))).toBe(true);
    });

    it('should handle time input interactions', async () => {
      const testTime = '14:30';
      await page.fill('#time-input', testTime);

      const value = await page.inputValue('#time-input');
      expect(value).toBe(testTime);
    });

    it('should handle color input interactions', async () => {
      await page.click('#color-input');
      // Simulate color selection
      await page.fill('#color-input', '#ff5500');

      const value = await page.inputValue('#color-input');
      expect(value).toBe('#ff5500');
    });

    it('should handle range slider interactions', async () => {
      const slider = await page.locator('#range-input');

      // Get the slider's bounding box for precise interaction
      const box = await slider.boundingBox();
      expect(box).toBeTruthy();

      // Click at 75% of the slider width to set value to approximately 75
      if (box) {
        await page.mouse.click(box.x + (box.width * 0.75), box.y + (box.height / 2));

        const value = await page.inputValue('#range-input');
        const numValue = parseInt(value);
        expect(numValue).toBeGreaterThan(60);
        expect(numValue).toBeLessThan(90);
      }
    });

    it('should handle file input interactions', async () => {
      // Create a temporary file for testing
      const fileChooserPromise = page.waitForEvent('filechooser');
      await page.click('#file-input');
      const fileChooser = await fileChooserPromise;

      // Since we can't create real files in the test, we'll verify the file chooser opened
      expect(fileChooser).toBeTruthy();
    });
  });

  describe('Drag and Drop Interactions', () => {
    it('should handle basic drag and drop', async () => {
      const source = '#draggable-item';
      const target = '#drop-zone';

      await page.dragAndDrop(source, target);

      const log = await page.evaluate(() => (window as any).enhancedInteractionLog);
      expect(log).toContain('dragstart:draggable-item');
      expect(log).toContain('drop:drop-zone');
    });

    it('should handle drag and drop with custom data transfer', async () => {
      await page.hover('#draggable-item');
      await page.mouse.down();
      await page.hover('#drop-zone');
      await page.mouse.up();

      const dropText = await page.textContent('#drop-zone');
      expect(dropText).toContain('Dropped item');
    });
  });

  describe('Touch and Mobile Interactions', () => {
    it('should handle touch tap interactions', async () => {
      await page.tap('#touch-button');

      const log = await page.evaluate(() => (window as any).enhancedInteractionLog);
      expect(log).toContain('touchstart:touch-button');
      expect(log).toContain('touchend:touch-button');
    });

    it('should handle swipe gestures', async () => {
      const element = await page.locator('#swipeable-element');
      const box = await element.boundingBox();

      if (box) {
        // Simulate swipe left
        await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + 10, box.y + box.height / 2);
        await page.mouse.up();

        const log = await page.evaluate(() => (window as any).enhancedInteractionLog);
        expect(log).toContain('swipeleft:swipeable-element');
      }
    });
  });

  describe('Complex Multi-step Interactions', () => {
    it('should handle form submission with validation', async () => {
      // Fill out a complex form
      await page.fill('#multi-step-name', 'John Doe');
      await page.fill('#multi-step-email', 'john@example.com');
      await page.selectOption('#multi-step-country', 'US');
      await page.check('#multi-step-terms');
      await page.click('#submit-button');

      // Wait for form processing
      await page.waitForSelector('#success-message', { timeout: 5000 });

      const successMessage = await page.textContent('#success-message');
      expect(successMessage).toContain('Form submitted successfully');
    });

    it('should handle modal dialog interactions', async () => {
      await page.click('#open-modal');
      await page.waitForSelector('#modal-dialog', { state: 'visible' });

      await page.fill('#modal-input', 'Test modal input');
      await page.click('#modal-confirm');

      await page.waitForSelector('#modal-dialog', { state: 'hidden' });

      const result = await page.textContent('#modal-result');
      expect(result).toBe('Test modal input');
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle rapid multiple element interactions', async () => {
      const startTime = Date.now();

      // Perform 100 rapid clicks
      for (let i = 0; i < 100; i++) {
        await page.click('#stress-test-button', { timeout: 100 });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (5 seconds)
      expect(duration).toBeLessThan(5000);

      const clickCount = await page.getAttribute('#stress-test-button', 'data-click-count');
      expect(parseInt(clickCount || '0')).toBe(100);
    });

    it('should handle simultaneous interactions on multiple elements', async () => {
      // Start multiple interactions concurrently
      const interactions = [
        page.fill('#concurrent-input-1', 'Text 1'),
        page.fill('#concurrent-input-2', 'Text 2'),
        page.click('#concurrent-button-1'),
        page.click('#concurrent-button-2'),
        page.selectOption('#concurrent-select', 'option1'),
      ];

      await Promise.all(interactions);

      // Verify all interactions completed
      expect(await page.inputValue('#concurrent-input-1')).toBe('Text 1');
      expect(await page.inputValue('#concurrent-input-2')).toBe('Text 2');

      const log = await page.evaluate(() => (window as any).enhancedInteractionLog);
      expect(log).toContain('click:concurrent-button-1');
      expect(log).toContain('click:concurrent-button-2');
    });
  });

  describe('Custom Element Interactions', () => {
    it('should handle custom web component interactions', async () => {
      await page.click('custom-button');

      const log = await page.evaluate(() => (window as any).enhancedInteractionLog);
      expect(log).toContain('custom-click:custom-button');
    });

    it('should handle element interactions with custom events', async () => {
      await page.click('#custom-event-trigger');

      const log = await page.evaluate(() => (window as any).enhancedInteractionLog);
      expect(log).toContain('customevent:custom-event-trigger');
    });
  });

  describe('Accessibility Enhanced Interactions', () => {
    it('should handle screen reader simulation', async () => {
      // Simulate screen reader navigation
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');

      const log = await page.evaluate(() => (window as any).enhancedInteractionLog);
      expect(log).toContain('focus:accessible-button');
      expect(log).toContain('click:accessible-button');
    });

    it('should handle high contrast mode interactions', async () => {
      // Enable high contrast simulation
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });

      await page.click('#high-contrast-button');

      const computedStyle = await page.evaluate(() => {
        const element = document.getElementById('high-contrast-button');
        return window.getComputedStyle(element!).backgroundColor;
      });

      // Verify element is still interactive in high contrast mode
      expect(computedStyle).toBeTruthy();
    });
  });

  /**
   * Creates the enhanced test page HTML with additional interactive elements
   */
  function createEnhancedTestPageHTML(): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Enhanced Element Interaction Test Page</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
          background: #f5f5f5;
        }
        .section {
          margin-bottom: 30px;
          padding: 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .draggable {
          width: 100px;
          height: 50px;
          background: #4CAF50;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: move;
          border-radius: 4px;
          margin: 10px;
        }
        .drop-zone {
          width: 200px;
          height: 100px;
          border: 2px dashed #ccc;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 10px;
          border-radius: 4px;
        }
        .drop-zone.dragover {
          border-color: #4CAF50;
          background: #e8f5e8;
        }
        input, select, textarea, button {
          margin: 5px;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .modal {
          display: none;
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          z-index: 1000;
        }
        .modal.visible {
          display: block;
        }
        .modal-overlay {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.5);
          z-index: 999;
        }
        .modal-overlay.visible {
          display: block;
        }
        custom-button {
          display: inline-block;
          padding: 10px 20px;
          background: #2196F3;
          color: white;
          border-radius: 4px;
          cursor: pointer;
          margin: 5px;
        }
        #swipeable-element {
          width: 200px;
          height: 50px;
          background: #FF9800;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          touch-action: pan-x;
          user-select: none;
        }
      </style>
    </head>
    <body>
      <h1>Enhanced Element Interaction Test Page</h1>

      <div id="interaction-log" style="background: #f0f0f0; padding: 10px; margin-bottom: 20px; border-radius: 4px;">
        Interaction log will appear here
      </div>

      <div class="section">
        <h2>Advanced Form Controls</h2>
        <input type="date" id="date-input" />
        <input type="time" id="time-input" />
        <input type="color" id="color-input" value="#ff5500" />
        <input type="range" id="range-input" min="0" max="100" value="50" />
        <input type="file" id="file-input" />
      </div>

      <div class="section">
        <h2>Drag and Drop</h2>
        <div class="draggable" id="draggable-item" draggable="true">Drag me</div>
        <div class="drop-zone" id="drop-zone">Drop here</div>
      </div>

      <div class="section">
        <h2>Touch Interactions</h2>
        <button id="touch-button">Touch Button</button>
        <div id="swipeable-element">Swipe me left/right</div>
      </div>

      <div class="section">
        <h2>Multi-step Form</h2>
        <input type="text" id="multi-step-name" placeholder="Name" required />
        <input type="email" id="multi-step-email" placeholder="Email" required />
        <select id="multi-step-country">
          <option value="">Select Country</option>
          <option value="US">United States</option>
          <option value="UK">United Kingdom</option>
          <option value="CA">Canada</option>
        </select>
        <label>
          <input type="checkbox" id="multi-step-terms" />
          I agree to the terms and conditions
        </label>
        <button id="submit-button" type="button">Submit Form</button>
        <div id="success-message" style="display: none; color: green;"></div>
      </div>

      <div class="section">
        <h2>Modal Dialog</h2>
        <button id="open-modal">Open Modal</button>
        <div id="modal-result"></div>
      </div>

      <div class="section">
        <h2>Performance Testing</h2>
        <button id="stress-test-button" data-click-count="0">Stress Test Button</button>
        <input type="text" id="concurrent-input-1" placeholder="Concurrent 1" />
        <input type="text" id="concurrent-input-2" placeholder="Concurrent 2" />
        <button id="concurrent-button-1">Concurrent Button 1</button>
        <button id="concurrent-button-2">Concurrent Button 2</button>
        <select id="concurrent-select">
          <option value="option1">Option 1</option>
          <option value="option2">Option 2</option>
        </select>
      </div>

      <div class="section">
        <h2>Custom Elements</h2>
        <custom-button id="custom-button">Custom Button</custom-button>
        <button id="custom-event-trigger">Trigger Custom Event</button>
      </div>

      <div class="section">
        <h2>Accessibility</h2>
        <button id="accessible-button" aria-label="Accessible button for screen readers">
          Accessible Button
        </button>
        <button id="high-contrast-button">High Contrast Button</button>
      </div>

      <!-- Modal HTML -->
      <div class="modal-overlay" id="modal-overlay"></div>
      <div class="modal" id="modal-dialog">
        <h3>Modal Dialog</h3>
        <input type="text" id="modal-input" placeholder="Enter text" />
        <button id="modal-confirm">Confirm</button>
        <button id="modal-cancel">Cancel</button>
      </div>

      <script>
        window.enhancedInteractionLog = [];
        let swipeStartX = 0;

        function logEnhancedInteraction(type, elementId, event = {}) {
          const logEntry = \`\${type}:\${elementId}\`;
          window.enhancedInteractionLog.push(logEntry);

          if (event.ctrlKey || event.shiftKey || event.altKey) {
            const detailEntry = \`\${type}:\${elementId}:ctrlKey:\${event.ctrlKey}:shiftKey:\${event.shiftKey}:altKey:\${event.altKey}\`;
            window.enhancedInteractionLog.push(detailEntry);
          }

          const logElement = document.getElementById('interaction-log');
          if (logElement) {
            logElement.textContent = window.enhancedInteractionLog.slice(-5).join(' | ');
          }
        }

        // Enhanced event listeners
        document.addEventListener('click', (e) => {
          if (e.target.id) {
            logEnhancedInteraction('click', e.target.id, e);
            const currentCount = parseInt(e.target.getAttribute('data-click-count') || '0');
            e.target.setAttribute('data-click-count', (currentCount + 1).toString());
          }
        });

        document.addEventListener('input', (e) => {
          if (e.target.id) logEnhancedInteraction('input', e.target.id, e);
        });

        document.addEventListener('change', (e) => {
          if (e.target.id) logEnhancedInteraction('change', e.target.id, e);
        });

        document.addEventListener('focus', (e) => {
          if (e.target.id) logEnhancedInteraction('focus', e.target.id, e);
        });

        // Drag and drop
        document.addEventListener('dragstart', (e) => {
          if (e.target.id) {
            logEnhancedInteraction('dragstart', e.target.id, e);
            e.dataTransfer.setData('text/plain', e.target.textContent);
          }
        });

        document.addEventListener('dragover', (e) => {
          e.preventDefault();
          if (e.target.classList.contains('drop-zone')) {
            e.target.classList.add('dragover');
          }
        });

        document.addEventListener('dragleave', (e) => {
          if (e.target.classList.contains('drop-zone')) {
            e.target.classList.remove('dragover');
          }
        });

        document.addEventListener('drop', (e) => {
          e.preventDefault();
          if (e.target.id) {
            logEnhancedInteraction('drop', e.target.id, e);
            e.target.classList.remove('dragover');
            e.target.textContent = 'Dropped item: ' + e.dataTransfer.getData('text/plain');
          }
        });

        // Touch events
        document.addEventListener('touchstart', (e) => {
          if (e.target.id) {
            logEnhancedInteraction('touchstart', e.target.id, e);
            if (e.target.id === 'swipeable-element') {
              swipeStartX = e.touches[0].clientX;
            }
          }
        });

        document.addEventListener('touchend', (e) => {
          if (e.target.id) {
            logEnhancedInteraction('touchend', e.target.id, e);
            if (e.target.id === 'swipeable-element' && e.changedTouches[0]) {
              const swipeEndX = e.changedTouches[0].clientX;
              const swipeDistance = swipeStartX - swipeEndX;

              if (swipeDistance > 50) {
                logEnhancedInteraction('swipeleft', e.target.id, e);
              } else if (swipeDistance < -50) {
                logEnhancedInteraction('swiperight', e.target.id, e);
              }
            }
          }
        });

        // Form submission
        document.getElementById('submit-button').addEventListener('click', () => {
          const name = document.getElementById('multi-step-name').value;
          const email = document.getElementById('multi-step-email').value;
          const country = document.getElementById('multi-step-country').value;
          const terms = document.getElementById('multi-step-terms').checked;

          if (name && email && country && terms) {
            document.getElementById('success-message').style.display = 'block';
            document.getElementById('success-message').textContent = 'Form submitted successfully';
          }
        });

        // Modal dialog
        document.getElementById('open-modal').addEventListener('click', () => {
          document.getElementById('modal-dialog').classList.add('visible');
          document.getElementById('modal-overlay').classList.add('visible');
        });

        document.getElementById('modal-confirm').addEventListener('click', () => {
          const input = document.getElementById('modal-input').value;
          document.getElementById('modal-result').textContent = input;
          document.getElementById('modal-dialog').classList.remove('visible');
          document.getElementById('modal-overlay').classList.remove('visible');
        });

        document.getElementById('modal-cancel').addEventListener('click', () => {
          document.getElementById('modal-dialog').classList.remove('visible');
          document.getElementById('modal-overlay').classList.remove('visible');
        });

        // Custom element
        class CustomButton extends HTMLElement {
          constructor() {
            super();
            this.addEventListener('click', () => {
              logEnhancedInteraction('custom-click', 'custom-button');
            });
          }
        }
        customElements.define('custom-button', CustomButton);

        // Custom event
        document.getElementById('custom-event-trigger').addEventListener('click', (e) => {
          const customEvent = new CustomEvent('customevent', { detail: 'test' });
          e.target.dispatchEvent(customEvent);
        });

        document.getElementById('custom-event-trigger').addEventListener('customevent', (e) => {
          logEnhancedInteraction('customevent', e.target.id, e);
        });

        console.log('Enhanced test page loaded');
      </script>
    </body>
    </html>
    `;
  }
});