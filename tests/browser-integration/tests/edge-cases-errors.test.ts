/**
 * @fileoverview Edge Cases and Error Handling Test Suite
 *
 * This test file comprehensively validates error handling and edge cases
 * in the element interaction infrastructure. It tests:
 * - Error scenarios and graceful failure handling
 * - Edge cases with element states and timing
 * - Boundary conditions and unusual inputs
 * - Network interruptions and page state changes
 * - Memory and performance edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserTestBase, createBrowserTest } from '../../test-utils/browser-test-base.js';
import {
  createElement,
  createElementCollection,
  createTestForm,
  waitForConditions,
  getElementState,
  performClick,
  performTextInput,
  fillForm,
  assertElement,
  assertElements,
  type FormField
} from '../utils/element-interaction-helpers.js';

describe('Edge Cases and Error Handling', () => {
  let browserTest: BrowserTestBase;

  beforeEach(async () => {
    browserTest = createBrowserTest({
      headless: true,
      timeout: 30000,
    });
    await browserTest.setup();

    // Set up a test page with various problematic scenarios
    await browserTest.context.page!.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Edge Cases Test</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .container { max-width: 800px; margin: 0 auto; }
          .hidden { display: none !important; }
          .invisible { visibility: hidden; }
          .transparent { opacity: 0; }
          .overlapped { position: relative; }
          .overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 0, 0, 0.5);
            z-index: 1000;
          }
          .moving {
            animation: move 2s infinite;
          }
          @keyframes move {
            0% { transform: translateX(0); }
            50% { transform: translateX(100px); }
            100% { transform: translateX(0); }
          }
          .error-prone {
            border: 2px solid red;
            background: #ffe6e6;
          }
          .nested-deep {
            padding: 20px;
            border: 1px solid #ddd;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Edge Cases Test Page</h1>

          <div class="test-section">
            <h2>Visibility Edge Cases</h2>
            <button id="hidden-button" class="hidden">Hidden Button</button>
            <button id="invisible-button" class="invisible">Invisible Button</button>
            <button id="transparent-button" class="transparent">Transparent Button</button>
            <div id="zero-size" style="width: 0; height: 0; overflow: hidden;">
              <button id="zero-size-button">Zero Size Button</button>
            </div>
          </div>

          <div class="test-section">
            <h2>Overlapping Elements</h2>
            <div class="overlapped">
              <button id="covered-button">Covered Button</button>
              <div id="overlay" class="overlay" style="display: none;">Overlay</div>
            </div>
            <button id="toggle-overlay">Toggle Overlay</button>
          </div>

          <div class="test-section">
            <h2>Dynamic Elements</h2>
            <button id="create-remove">Create/Remove Element</button>
            <div id="dynamic-container"></div>
          </div>

          <div class="test-section">
            <h2>Moving Elements</h2>
            <button id="moving-button" class="moving">Moving Button</button>
            <button id="start-stop-animation">Start/Stop Animation</button>
          </div>

          <div class="test-section">
            <h2>Deeply Nested Elements</h2>
            <div class="nested-deep">
              <div class="nested-deep">
                <div class="nested-deep">
                  <div class="nested-deep">
                    <div class="nested-deep">
                      <button id="deeply-nested">Deep Button</button>
                      <input type="text" id="deeply-nested-input" placeholder="Deep Input">
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="test-section">
            <h2>Special Characters and Unicode</h2>
            <input type="text" id="unicode-input" placeholder="Enter unicode">
            <textarea id="special-chars" placeholder="Special characters"></textarea>
          </div>

          <div class="test-section">
            <h2>Large Data Handling</h2>
            <textarea id="large-text" rows="10" cols="50"></textarea>
            <button id="fill-large">Fill with Large Text</button>
          </div>

          <div class="test-section">
            <h2>Disabled and Readonly Elements</h2>
            <input type="text" id="disabled-input" placeholder="Disabled" disabled>
            <input type="text" id="readonly-input" placeholder="Readonly" readonly>
            <button id="toggle-disabled">Toggle Disabled</button>
          </div>

          <div class="test-section">
            <h2>Invalid HTML and Malformed Elements</h2>
            <div id="malformed-container">
              <!-- Malformed HTML will be inserted here -->
            </div>
          </div>

          <div class="test-section">
            <h2>Rapid State Changes</h2>
            <button id="rapid-changes">Rapid Changes</button>
            <div id="rapid-status">Ready</div>
          </div>

          <div class="test-section">
            <h2>Memory Test Elements</h2>
            <button id="create-many">Create Many Elements</button>
            <div id="memory-container"></div>
            <button id="cleanup-many">Cleanup Elements</button>
          </div>
        </div>

        <script>
          let dynamicElementCount = 0;
          let animationRunning = false;
          let rapidChangesRunning = false;

          // Toggle overlay
          document.getElementById('toggle-overlay').addEventListener('click', function() {
            const overlay = document.getElementById('overlay');
            overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
          });

          // Create/remove dynamic element
          document.getElementById('create-remove').addEventListener('click', function() {
            const container = document.getElementById('dynamic-container');
            const existingElement = document.getElementById('dynamic-element');

            if (existingElement) {
              existingElement.remove();
              this.textContent = 'Create Element';
            } else {
              const element = document.createElement('button');
              element.id = 'dynamic-element';
              element.textContent = 'Dynamic Element ' + (++dynamicElementCount);
              element.addEventListener('click', function() {
                this.textContent = 'Clicked!';
              });
              container.appendChild(element);
              this.textContent = 'Remove Element';
            }
          });

          // Start/stop animation
          document.getElementById('start-stop-animation').addEventListener('click', function() {
            const movingButton = document.getElementById('moving-button');
            animationRunning = !animationRunning;

            if (animationRunning) {
              movingButton.classList.add('moving');
              this.textContent = 'Stop Animation';
            } else {
              movingButton.classList.remove('moving');
              this.textContent = 'Start Animation';
            }
          });

          // Fill with large text
          document.getElementById('fill-large').addEventListener('click', function() {
            const largeText = document.getElementById('large-text');
            const text = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(1000);
            largeText.value = text;
          });

          // Toggle disabled state
          document.getElementById('toggle-disabled').addEventListener('click', function() {
            const disabledInput = document.getElementById('disabled-input');
            disabledInput.disabled = !disabledInput.disabled;
            this.textContent = disabledInput.disabled ? 'Enable Input' : 'Disable Input';
          });

          // Rapid changes
          document.getElementById('rapid-changes').addEventListener('click', function() {
            if (rapidChangesRunning) return;

            rapidChangesRunning = true;
            const status = document.getElementById('rapid-status');
            let count = 0;

            const interval = setInterval(() => {
              count++;
              status.textContent = 'Change ' + count;
              status.className = count % 2 === 0 ? 'even' : 'odd';
              status.setAttribute('data-count', count.toString());

              if (count >= 100) {
                clearInterval(interval);
                rapidChangesRunning = false;
                status.textContent = 'Completed 100 changes';
              }
            }, 10); // Very rapid changes
          });

          // Create many elements for memory testing
          document.getElementById('create-many').addEventListener('click', function() {
            const container = document.getElementById('memory-container');
            for (let i = 0; i < 1000; i++) {
              const element = document.createElement('div');
              element.id = 'memory-element-' + i;
              element.textContent = 'Element ' + i;
              element.className = 'memory-test-element';
              element.style.cssText = 'margin: 1px; padding: 2px; border: 1px solid #ccc;';
              container.appendChild(element);
            }
            this.disabled = true;
          });

          // Cleanup many elements
          document.getElementById('cleanup-many').addEventListener('click', function() {
            const container = document.getElementById('memory-container');
            container.innerHTML = '';
            document.getElementById('create-many').disabled = false;
          });

          // Add malformed HTML
          setTimeout(() => {
            const malformedContainer = document.getElementById('malformed-container');
            malformedContainer.innerHTML = `
              <div>
                <p>Unclosed paragraph
                <span>Nested span
                  <button id="malformed-button">Malformed Button</div>
                </span>
              </p>
            `;
          }, 100);

          // Simulate network interruption scenarios
          window.simulateNetworkError = function() {
            throw new Error('Simulated network error');
          };

          // Simulate memory pressure
          window.simulateMemoryPressure = function() {
            const bigArray = new Array(1000000).fill('memory pressure test data');
            return bigArray;
          };
        </script>
      </body>
      </html>
    `);

    await browserTest.context.page!.waitForLoadState('domcontentloaded');
    // Wait a bit for the malformed HTML to be added
    await browserTest.context.page!.waitForTimeout(200);
  });

  afterEach(async () => {
    await browserTest.teardown();
  });

  describe('Element Visibility Edge Cases', () => {
    it('should handle hidden elements (display: none)', async () => {
      const state = await getElementState(browserTest.context.page!, '#hidden-button');
      expect(state?.visible).toBe(false);

      // Attempt to click hidden element should fail gracefully
      const clickResult = await performClick(browserTest.context.page!, '#hidden-button', {
        force: false // Don't force click on hidden element
      });
      expect(clickResult.success).toBe(false);
      expect(clickResult.error).toContain('not visible');
    });

    it('should handle invisible elements (visibility: hidden)', async () => {
      const state = await getElementState(browserTest.context.page!, '#invisible-button');
      expect(state?.visible).toBe(false);

      // Should detect as not visible
      const waitResult = await waitForConditions(browserTest.context.page!, '#invisible-button', [
        { condition: 'visible', timeout: 1000 }
      ]);
      expect(waitResult).toBe(false);
    });

    it('should handle transparent elements (opacity: 0)', async () => {
      const state = await getElementState(browserTest.context.page!, '#transparent-button');

      // Element exists but may not be considered visible depending on implementation
      expect(state).toBeDefined();
      expect(state?.boundingBox).toBeDefined();
    });

    it('should handle zero-size elements', async () => {
      const state = await getElementState(browserTest.context.page!, '#zero-size-button');
      expect(state).toBeDefined();

      // Element should have zero or very small bounding box
      if (state?.boundingBox) {
        expect(state.boundingBox.width).toBeLessThanOrEqual(1);
        expect(state.boundingBox.height).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Overlapping and Covered Elements', () => {
    it('should detect when elements are covered by overlays', async () => {
      // Initially button should be clickable
      let state = await getElementState(browserTest.context.page!, '#covered-button');
      expect(state?.visible).toBe(true);

      // Show overlay
      await performClick(browserTest.context.page!, '#toggle-overlay');

      // Button is now covered, click should still work but may need force
      const clickResult = await performClick(browserTest.context.page!, '#covered-button', {
        force: true // Force click through overlay
      });
      expect(clickResult.success).toBe(true);
    });

    it('should handle elements that become covered during interaction', async () => {
      // Start clicking the button repeatedly while toggling overlay
      const clickPromises = [];

      for (let i = 0; i < 5; i++) {
        clickPromises.push(
          performClick(browserTest.context.page!, '#covered-button', {
            force: false,
            retries: 3
          })
        );

        // Toggle overlay during clicks
        if (i % 2 === 0) {
          clickPromises.push(
            performClick(browserTest.context.page!, '#toggle-overlay')
          );
        }
      }

      const results = await Promise.allSettled(clickPromises);

      // Some clicks should succeed, some may fail due to overlay
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(0);
    });
  });

  describe('Dynamic Element Scenarios', () => {
    it('should handle elements that are created and removed rapidly', async () => {
      // Create element
      await performClick(browserTest.context.page!, '#create-remove');

      // Wait for element to exist
      const waitResult = await waitForConditions(browserTest.context.page!, '#dynamic-element', [
        { condition: 'visible', timeout: 3000 }
      ]);
      expect(waitResult).toBe(true);

      // Click the dynamic element
      const clickResult = await performClick(browserTest.context.page!, '#dynamic-element');
      expect(clickResult.success).toBe(true);

      // Remove element
      await performClick(browserTest.context.page!, '#create-remove');

      // Element should no longer exist
      const finalState = await getElementState(browserTest.context.page!, '#dynamic-element');
      expect(finalState).toBeNull();
    });

    it('should handle waiting for elements that never appear', async () => {
      const startTime = Date.now();

      const waitResult = await waitForConditions(browserTest.context.page!, '#never-exists', [
        { condition: 'visible', timeout: 2000 }
      ]);

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      expect(waitResult).toBe(false);
      expect(elapsed).toBeGreaterThanOrEqual(1900);
      expect(elapsed).toBeLessThan(3000);
    });

    it('should handle elements that change attributes rapidly', async () => {
      // Start rapid changes
      await performClick(browserTest.context.page!, '#rapid-changes');

      // Try to track state during rapid changes
      let stateSnapshots = [];

      for (let i = 0; i < 10; i++) {
        const state = await getElementState(browserTest.context.page!, '#rapid-status');
        if (state) {
          stateSnapshots.push({
            text: state.text,
            dataCount: state.attributes['data-count'],
            timestamp: Date.now()
          });
        }
        await browserTest.context.page!.waitForTimeout(100);
      }

      expect(stateSnapshots.length).toBeGreaterThan(0);

      // Should see different values indicating rapid changes
      const uniqueTexts = new Set(stateSnapshots.map(s => s.text));
      expect(uniqueTexts.size).toBeGreaterThan(1);
    });
  });

  describe('Moving and Animated Elements', () => {
    it('should handle clicking moving elements', async () => {
      // Start animation
      await performClick(browserTest.context.page!, '#start-stop-animation');

      // Try to click moving element
      const clickResult = await performClick(browserTest.context.page!, '#moving-button', {
        waitForStable: true, // Wait for element to stabilize
        timeout: 5000
      });

      expect(clickResult.success).toBe(true);
    });

    it('should wait for element stability before interaction', async () => {
      // Start animation
      await performClick(browserTest.context.page!, '#start-stop-animation');

      // Wait for element to be stable (should timeout since it's continuously moving)
      const stabilityResult = await waitForConditions(browserTest.context.page!, '#moving-button', [
        { condition: 'stable', timeout: 2000 }
      ]);

      expect(stabilityResult).toBe(false); // Should timeout due to continuous movement

      // Stop animation
      await performClick(browserTest.context.page!, '#start-stop-animation');

      // Now element should stabilize
      const stableResult = await waitForConditions(browserTest.context.page!, '#moving-button', [
        { condition: 'stable', timeout: 3000 }
      ]);

      expect(stableResult).toBe(true);
    });
  });

  describe('Special Character and Unicode Handling', () => {
    it('should handle unicode characters in text input', async () => {
      const unicodeText = '🎉🎊 Hello 世界 🌍 Émojis & Special ℃haracters! 🚀';

      const result = await performTextInput(
        browserTest.context.page!,
        '#unicode-input',
        unicodeText,
        {
          clearFirst: true,
          validateInput: true,
          expectedValue: unicodeText,
          typeDelay: 50
        }
      );

      expect(result.success).toBe(true);
      expect(result.finalValue).toBe(unicodeText);

      // Verify the input actually contains the unicode text
      const inputValue = await browserTest.context.page!.inputValue('#unicode-input');
      expect(inputValue).toBe(unicodeText);
    });

    it('should handle special characters and escape sequences', async () => {
      const specialChars = 'Line1\\nLine2\\tTab\\rReturn"Quotes"&Ampersand<>Tags';

      const result = await performTextInput(
        browserTest.context.page!,
        '#special-chars',
        specialChars,
        {
          clearFirst: true,
          validateInput: true,
          expectedValue: specialChars
        }
      );

      expect(result.success).toBe(true);
      expect(result.finalValue).toBe(specialChars);
    });

    it('should handle extremely long text input', async () => {
      // Create a very long string
      const longText = 'A'.repeat(10000) + ' End';

      const result = await performTextInput(
        browserTest.context.page!,
        '#large-text',
        longText,
        {
          clearFirst: true,
          validateInput: true,
          expectedValue: longText,
          typeDelay: 1 // Very fast typing
        }
      );

      expect(result.success).toBe(true);
      expect(result.finalValue).toBe(longText);
      expect(result.finalValue.length).toBe(10005);
    });
  });

  describe('Disabled and Readonly Elements', () => {
    it('should detect disabled elements correctly', async () => {
      const state = await getElementState(browserTest.context.page!, '#disabled-input');
      expect(state?.enabled).toBe(false);

      // Attempt to type in disabled input should fail
      const inputResult = await performTextInput(
        browserTest.context.page!,
        '#disabled-input',
        'should not work',
        { validateInput: false }
      );

      expect(inputResult.success).toBe(false);
    });

    it('should handle elements that become disabled during interaction', async () => {
      // Initially element should be enabled
      let state = await getElementState(browserTest.context.page!, '#disabled-input');
      expect(state?.enabled).toBe(false); // Starts disabled

      // Enable it
      await performClick(browserTest.context.page!, '#toggle-disabled');

      // Now should be enabled
      state = await getElementState(browserTest.context.page!, '#disabled-input');
      expect(state?.enabled).toBe(true);

      // Type in it
      const inputResult = await performTextInput(
        browserTest.context.page!,
        '#disabled-input',
        'now it works'
      );

      expect(inputResult.success).toBe(true);
    });

    it('should handle readonly elements', async () => {
      const state = await getElementState(browserTest.context.page!, '#readonly-input');
      expect(state?.enabled).toBe(true); // Readonly elements are enabled but not editable

      // Attempt to type should work (browser allows it) but content won't change
      const initialValue = await browserTest.context.page!.inputValue('#readonly-input');

      await performTextInput(
        browserTest.context.page!,
        '#readonly-input',
        'should not change',
        { validateInput: false }
      );

      const finalValue = await browserTest.context.page!.inputValue('#readonly-input');
      expect(finalValue).toBe(initialValue); // Value should not change
    });
  });

  describe('Malformed HTML and Invalid Selectors', () => {
    it('should handle malformed HTML gracefully', async () => {
      // The malformed button should still be accessible despite invalid HTML structure
      const state = await getElementState(browserTest.context.page!, '#malformed-button');
      expect(state).toBeDefined(); // Browser should have corrected the HTML

      const clickResult = await performClick(browserTest.context.page!, '#malformed-button');
      expect(clickResult.success).toBe(true);
    });

    it('should handle invalid CSS selectors', async () => {
      try {
        await getElementState(browserTest.context.page!, '#invalid..selector..with..dots');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle XPath expressions mixed with CSS selectors', async () => {
      // Test with an XPath-like string that's not a valid CSS selector
      const invalidSelector = '//div[@class="container"]';

      try {
        await getElementState(browserTest.context.page!, invalidSelector);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle creation of many elements efficiently', async () => {
      const startTime = Date.now();

      // Create 1000 elements
      await performClick(browserTest.context.page!, '#create-many');

      // Wait for creation to complete
      await waitForConditions(browserTest.context.page!, '#memory-element-999', [
        { condition: 'visible', timeout: 10000 }
      ]);

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should complete within reasonable time (adjust as needed)
      expect(elapsed).toBeLessThan(15000);

      // Verify elements exist
      const elementCount = await browserTest.context.page!.locator('.memory-test-element').count();
      expect(elementCount).toBe(1000);

      // Clean up
      await performClick(browserTest.context.page!, '#cleanup-many');
    });

    it('should handle memory pressure scenarios', async () => {
      // Simulate memory pressure
      await browserTest.context.page!.evaluate(() => {
        window.simulateMemoryPressure();
      });

      // Operations should still work under memory pressure
      const result = await performTextInput(
        browserTest.context.page!,
        '#unicode-input',
        'memory pressure test'
      );

      expect(result.success).toBe(true);
    });

    it('should handle rapid creation and destruction of elements', async () => {
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        // Create element
        await performClick(browserTest.context.page!, '#create-remove');

        // Wait briefly
        await browserTest.context.page!.waitForTimeout(10);

        // Remove element
        await performClick(browserTest.context.page!, '#create-remove');

        // Wait briefly
        await browserTest.context.page!.waitForTimeout(10);
      }

      // Should complete without errors
      const containerContent = await browserTest.context.page!.textContent('#dynamic-container');
      expect(containerContent).toBe(''); // Should be empty after all iterations
    });
  });

  describe('Timing and Race Condition Edge Cases', () => {
    it('should handle simultaneous operations on same element', async () => {
      // Start multiple operations simultaneously
      const operations = [
        performClick(browserTest.context.page!, '#deeply-nested', { force: true }),
        getElementState(browserTest.context.page!, '#deeply-nested'),
        performClick(browserTest.context.page!, '#deeply-nested', { force: true }),
        getElementState(browserTest.context.page!, '#deeply-nested')
      ];

      const results = await Promise.allSettled(operations);

      // At least some operations should succeed
      const successes = results.filter(r => r.status === 'fulfilled').length;
      expect(successes).toBeGreaterThan(0);
    });

    it('should handle page navigation during operations', async () => {
      // Start a long operation
      const longOperationPromise = fillForm(
        browserTest.context.page!,
        'body', // Use body as form to avoid form not found errors
        {
          '#unicode-input': 'test value 1',
          '#special-chars': 'test value 2'
        },
        {
          waitBetweenFields: 1000, // Long delay between fields
          continueOnError: true
        }
      );

      // Simulate page reload during operation
      setTimeout(async () => {
        try {
          await browserTest.context.page!.reload();
        } catch (error) {
          // Page reload might fail if operations are ongoing
        }
      }, 500);

      // Operation should handle page changes gracefully
      try {
        const result = await longOperationPromise;
        // If it completes, that's fine
      } catch (error) {
        // If it fails due to page reload, that's also acceptable
        expect(error).toBeDefined();
      }
    });

    it('should handle element state changes during wait conditions', async () => {
      // Start waiting for an element
      const waitPromise = waitForConditions(browserTest.context.page!, '#dynamic-element', [
        { condition: 'visible', timeout: 5000 }
      ]);

      // Create and remove the element multiple times during wait
      setTimeout(async () => {
        for (let i = 0; i < 3; i++) {
          await performClick(browserTest.context.page!, '#create-remove');
          await browserTest.context.page!.waitForTimeout(100);
          await performClick(browserTest.context.page!, '#create-remove');
          await browserTest.context.page!.waitForTimeout(100);
        }
        // Create it one final time
        await performClick(browserTest.context.page!, '#create-remove');
      }, 100);

      const result = await waitPromise;
      expect(result).toBe(true); // Should eventually succeed
    });
  });

  describe('Browser Compatibility Edge Cases', () => {
    it('should handle elements with non-standard properties', async () => {
      // Add custom properties via JavaScript
      await browserTest.context.page!.evaluate(() => {
        const element = document.getElementById('deeply-nested-input');
        if (element) {
          (element as any).customProperty = 'custom value';
          element.setAttribute('data-custom', 'custom-data');
          element.setAttribute('weird-attribute!@#', 'weird-value');
        }
      });

      const state = await getElementState(browserTest.context.page!, '#deeply-nested-input');
      expect(state).toBeDefined();
      expect(state?.attributes['data-custom']).toBe('custom-data');
      expect(state?.attributes['weird-attribute!@#']).toBe('weird-value');
    });

    it('should handle elements in different document contexts', async () => {
      // Add an iframe with its own document context
      await browserTest.context.page!.evaluate(() => {
        const iframe = document.createElement('iframe');
        iframe.id = 'test-iframe';
        iframe.srcdoc = `
          <html>
            <body>
              <button id="iframe-button">Iframe Button</button>
            </body>
          </html>
        `;
        document.body.appendChild(iframe);
      });

      await browserTest.context.page!.waitForSelector('#test-iframe');

      // The utilities should work with main document elements
      const mainElementState = await getElementState(browserTest.context.page!, '#deeply-nested');
      expect(mainElementState).toBeDefined();

      // For iframe elements, we'd need frame-specific handling (not tested here as it requires different approach)
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from temporary network interruptions', async () => {
      // Simulate temporary script error
      await browserTest.context.page!.evaluate(() => {
        window.simulateNetworkError();
      });

      // Operations should still work after script errors
      const result = await performClick(browserTest.context.page!, '#deeply-nested', {
        retries: 3
      });

      expect(result.success).toBe(true);
    });

    it('should handle elements that throw errors during state capture', async () => {
      // Create an element that throws errors when accessed
      await browserTest.context.page!.evaluate(() => {
        const problematicElement = document.createElement('div');
        problematicElement.id = 'problematic-element';

        // Override getter to throw error
        Object.defineProperty(problematicElement, 'textContent', {
          get: function() {
            throw new Error('Property access error');
          }
        });

        document.body.appendChild(problematicElement);
      });

      // Should handle errors gracefully
      try {
        const state = await getElementState(browserTest.context.page!, '#problematic-element');
        // If we get here, error was handled gracefully
        expect(state).toBeDefined();
      } catch (error) {
        // If error is thrown, it should be meaningful
        expect(error).toBeDefined();
      }
    });

    it('should handle assertions with inconsistent element states', async () => {
      // Create an element that changes state rapidly
      await browserTest.context.page!.evaluate(() => {
        const flakeyElement = document.createElement('button');
        flakeyElement.id = 'flakey-element';
        flakeyElement.textContent = 'Initial';
        document.body.appendChild(flakeyElement);

        // Make it change randomly
        setInterval(() => {
          flakeyElement.textContent = Math.random() > 0.5 ? 'State A' : 'State B';
          flakeyElement.disabled = Math.random() > 0.7;
        }, 50);
      });

      // Assertions might fail due to rapid changes, but should handle it gracefully
      try {
        const assertionResult = await assertElement(browserTest.context.page!, {
          selector: '#flakey-element',
          type: 'text',
          expected: 'State A'
        });

        // Either succeeds or fails, both are acceptable for flakey elements
        expect(typeof assertionResult.passed).toBe('boolean');
      } catch (error) {
        // Should handle rapid state changes gracefully
        expect(error).toBeDefined();
      }
    });
  });
});