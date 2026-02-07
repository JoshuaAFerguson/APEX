/**
 * @fileoverview Wait Conditions and State Management Test Suite
 *
 * This test file comprehensively validates the wait conditions and state management
 * utilities in the element interaction infrastructure. It tests:
 * - waitForConditions with various condition types
 * - getElementState for comprehensive state capture
 * - compareElementStates for state change tracking
 * - Advanced timing and stability conditions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserTestBase, createBrowserTest } from '../../test-utils/browser-test-base.js';
import {
  waitForConditions,
  getElementState,
  compareElementStates,
  type WaitCondition
} from '../utils/element-interaction-helpers.js';

describe('Wait Conditions and State Management', () => {
  let browserTest: BrowserTestBase;

  beforeEach(async () => {
    browserTest = createBrowserTest({
      headless: true,
      timeout: 30000,
    });
    await browserTest.setup();

    // Set up a dynamic test page with various interactive elements
    await browserTest.context.page!.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Wait Conditions Test</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .container { max-width: 800px; margin: 0 auto; }
          .hidden { display: none; }
          .disabled { opacity: 0.5; pointer-events: none; }
          .loading { animation: pulse 1s infinite; }
          @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
          .test-element {
            padding: 10px;
            margin: 10px;
            border: 2px solid #ddd;
            background: #f9f9f9;
            transition: all 0.3s ease;
          }
          .active { border-color: #007acc; background: #e6f3ff; }
          .error { border-color: #dc3545; background: #f8d7da; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Wait Conditions Test Page</h1>

          <div class="test-section">
            <h2>Dynamic Visibility</h2>
            <button id="toggle-visibility">Toggle Visibility</button>
            <div id="dynamic-element" class="test-element hidden">
              I will appear/disappear dynamically
            </div>
          </div>

          <div class="test-section">
            <h2>Enable/Disable Testing</h2>
            <button id="toggle-enable">Toggle Enable</button>
            <input type="text" id="dynamic-input" class="test-element" placeholder="I can be enabled/disabled">
          </div>

          <div class="test-section">
            <h2>Content Changes</h2>
            <button id="change-content">Change Content</button>
            <div id="content-element" class="test-element">Original Content</div>
          </div>

          <div class="test-section">
            <h2>Attribute Changes</h2>
            <button id="change-attributes">Change Attributes</button>
            <div id="attribute-element" class="test-element" data-status="initial" data-count="0">
              Check my attributes
            </div>
          </div>

          <div class="test-section">
            <h2>Delayed Loading</h2>
            <button id="start-loading">Start Loading</button>
            <div id="loading-element" class="test-element">Ready</div>
          </div>

          <div class="test-section">
            <h2>Focus Testing</h2>
            <input type="text" id="focus-input" class="test-element" placeholder="Click to focus">
            <button id="focus-button">Focus Input</button>
          </div>

          <div class="test-section">
            <h2>Complex State Changes</h2>
            <button id="complex-state">Trigger Complex State</button>
            <div id="complex-element" class="test-element" data-phase="initial">
              Phase: Initial
            </div>
          </div>
        </div>

        <script>
          // Dynamic visibility toggle
          document.getElementById('toggle-visibility').addEventListener('click', function() {
            const element = document.getElementById('dynamic-element');
            element.classList.toggle('hidden');
          });

          // Enable/disable toggle
          document.getElementById('toggle-enable').addEventListener('click', function() {
            const input = document.getElementById('dynamic-input');
            input.disabled = !input.disabled;
            input.classList.toggle('disabled');
          });

          // Content changes
          document.getElementById('change-content').addEventListener('click', function() {
            const element = document.getElementById('content-element');
            const contents = ['Updated Content', 'Another Update', 'Final Content', 'Original Content'];
            const currentIndex = contents.indexOf(element.textContent);
            const nextIndex = (currentIndex + 1) % contents.length;
            element.textContent = contents[nextIndex];
          });

          // Attribute changes
          document.getElementById('change-attributes').addEventListener('click', function() {
            const element = document.getElementById('attribute-element');
            const currentCount = parseInt(element.getAttribute('data-count'));
            const newCount = currentCount + 1;
            element.setAttribute('data-count', newCount.toString());

            const statuses = ['initial', 'processing', 'complete', 'error'];
            const currentStatus = element.getAttribute('data-status');
            const currentStatusIndex = statuses.indexOf(currentStatus);
            const newStatus = statuses[(currentStatusIndex + 1) % statuses.length];
            element.setAttribute('data-status', newStatus);

            element.className = 'test-element ' + newStatus;
          });

          // Delayed loading simulation
          document.getElementById('start-loading').addEventListener('click', function() {
            const element = document.getElementById('loading-element');
            element.textContent = 'Loading...';
            element.classList.add('loading');

            setTimeout(() => {
              element.textContent = 'Loaded!';
              element.classList.remove('loading');
              element.classList.add('active');
            }, 2000);
          });

          // Focus management
          document.getElementById('focus-button').addEventListener('click', function() {
            document.getElementById('focus-input').focus();
          });

          // Complex state changes
          document.getElementById('complex-state').addEventListener('click', function() {
            const element = document.getElementById('complex-element');
            const phases = [
              { name: 'initial', text: 'Phase: Initial', class: '' },
              { name: 'loading', text: 'Phase: Loading...', class: 'loading' },
              { name: 'processing', text: 'Phase: Processing...', class: 'loading active' },
              { name: 'complete', text: 'Phase: Complete!', class: 'active' },
              { name: 'error', text: 'Phase: Error!', class: 'error' }
            ];

            let currentPhase = 0;
            const interval = setInterval(() => {
              if (currentPhase < phases.length) {
                const phase = phases[currentPhase];
                element.setAttribute('data-phase', phase.name);
                element.textContent = phase.text;
                element.className = 'test-element ' + phase.class;
                currentPhase++;
              } else {
                clearInterval(interval);
              }
            }, 1000);
          });
        </script>
      </body>
      </html>
    `);

    await browserTest.context.page!.waitForLoadState('domcontentloaded');
  });

  afterEach(async () => {
    await browserTest.teardown();
  });

  describe('waitForConditions', () => {
    it('should wait for element to become visible', async () => {
      // Initially element should be hidden
      const initialState = await getElementState(browserTest.context.page!, '#dynamic-element');
      expect(initialState?.visible).toBe(false);

      // Start the visibility toggle
      const togglePromise = browserTest.context.page!.click('#toggle-visibility');

      // Wait for element to become visible
      const waitPromise = waitForConditions(browserTest.context.page!, '#dynamic-element', [
        { condition: 'visible', timeout: 5000 }
      ]);

      await Promise.all([togglePromise, waitPromise]);

      const result = await waitPromise;
      expect(result).toBe(true);

      // Verify element is now visible
      const finalState = await getElementState(browserTest.context.page!, '#dynamic-element');
      expect(finalState?.visible).toBe(true);
    });

    it('should wait for element to become enabled', async () => {
      // Initially element should be enabled
      const initialState = await getElementState(browserTest.context.page!, '#dynamic-input');
      expect(initialState?.enabled).toBe(true);

      // Disable the element first
      await browserTest.context.page!.click('#toggle-enable');

      // Wait a moment to ensure it's disabled
      await browserTest.context.page!.waitForTimeout(100);

      const disabledState = await getElementState(browserTest.context.page!, '#dynamic-input');
      expect(disabledState?.enabled).toBe(false);

      // Start the enable toggle
      const togglePromise = browserTest.context.page!.click('#toggle-enable');

      // Wait for element to become enabled again
      const waitPromise = waitForConditions(browserTest.context.page!, '#dynamic-input', [
        { condition: 'enabled', timeout: 5000 }
      ]);

      await Promise.all([togglePromise, waitPromise]);

      const result = await waitPromise;
      expect(result).toBe(true);

      // Verify element is now enabled
      const finalState = await getElementState(browserTest.context.page!, '#dynamic-input');
      expect(finalState?.enabled).toBe(true);
    });

    it('should wait for text content to contain specific value', async () => {
      // Start content change
      const changePromise = browserTest.context.page!.click('#change-content');

      // Wait for text to contain "Updated"
      const waitPromise = waitForConditions(browserTest.context.page!, '#content-element', [
        { condition: 'text-contains', value: 'Updated', timeout: 5000 }
      ]);

      await Promise.all([changePromise, waitPromise]);

      const result = await waitPromise;
      expect(result).toBe(true);

      const finalState = await getElementState(browserTest.context.page!, '#content-element');
      expect(finalState?.text).toContain('Updated');
    });

    it('should wait for attribute to equal specific value', async () => {
      // Start attribute change
      const changePromise = browserTest.context.page!.click('#change-attributes');

      // Wait for data-count to equal "1"
      const waitPromise = waitForConditions(browserTest.context.page!, '#attribute-element', [
        { condition: 'attribute-equals', attribute: 'data-count', value: '1', timeout: 5000 }
      ]);

      await Promise.all([changePromise, waitPromise]);

      const result = await waitPromise;
      expect(result).toBe(true);

      const finalState = await getElementState(browserTest.context.page!, '#attribute-element');
      expect(finalState?.attributes['data-count']).toBe('1');
    });

    it('should wait for element to be focused', async () => {
      // Start focus action
      const focusPromise = browserTest.context.page!.click('#focus-button');

      // Wait for element to be focused
      const waitPromise = waitForConditions(browserTest.context.page!, '#focus-input', [
        { condition: 'focused', timeout: 5000 }
      ]);

      await Promise.all([focusPromise, waitPromise]);

      const result = await waitPromise;
      expect(result).toBe(true);

      const finalState = await getElementState(browserTest.context.page!, '#focus-input');
      expect(finalState?.focused).toBe(true);
    });

    it('should wait for multiple conditions simultaneously', async () => {
      // Start complex state change
      const statePromise = browserTest.context.page!.click('#complex-state');

      // Wait for element to be visible AND have specific attribute AND contain text
      const waitPromise = waitForConditions(browserTest.context.page!, '#complex-element', [
        { condition: 'visible', timeout: 10000 },
        { condition: 'attribute-equals', attribute: 'data-phase', value: 'complete', timeout: 10000 },
        { condition: 'text-contains', value: 'Complete', timeout: 10000 }
      ]);

      await statePromise;
      const result = await waitPromise;
      expect(result).toBe(true);

      const finalState = await getElementState(browserTest.context.page!, '#complex-element');
      expect(finalState?.visible).toBe(true);
      expect(finalState?.attributes['data-phase']).toBe('complete');
      expect(finalState?.text).toContain('Complete');
    });

    it('should handle timeout when conditions are not met', async () => {
      const startTime = Date.now();

      // Wait for a condition that will never be met
      const result = await waitForConditions(browserTest.context.page!, '#dynamic-element', [
        { condition: 'text-contains', value: 'NonExistentText', timeout: 2000 }
      ]);

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      expect(result).toBe(false);
      expect(elapsed).toBeGreaterThanOrEqual(1900); // Should wait close to full timeout
      expect(elapsed).toBeLessThan(3000); // But not too much longer
    });

    it('should wait for element stability', async () => {
      // Start loading process
      await browserTest.context.page!.click('#start-loading');

      // Wait for element to be stable (not changing)
      const result = await waitForConditions(browserTest.context.page!, '#loading-element', [
        { condition: 'stable', timeout: 5000 }
      ]);

      expect(result).toBe(true);

      // Element should have finished loading animation
      const finalState = await getElementState(browserTest.context.page!, '#loading-element');
      expect(finalState?.text).toBe('Loaded!');
    });
  });

  describe('getElementState', () => {
    it('should capture comprehensive element state', async () => {
      // Get state of a basic element
      const state = await getElementState(browserTest.context.page!, '#dynamic-element');

      expect(state).toBeDefined();
      expect(typeof state!.visible).toBe('boolean');
      expect(typeof state!.enabled).toBe('boolean');
      expect(typeof state!.focused).toBe('boolean');
      expect(typeof state!.value).toBe('string');
      expect(typeof state!.text).toBe('string');
      expect(typeof state!.tagName).toBe('string');
      expect(typeof state!.attributes).toBe('object');
      expect(Array.isArray(state!.classes)).toBe(true);
      expect(typeof state!.computedStyles).toBe('object');

      // Verify specific properties
      expect(state!.tagName.toLowerCase()).toBe('div');
      expect(state!.classes).toContain('test-element');
      expect(state!.classes).toContain('hidden');
    });

    it('should capture input element state including value', async () => {
      // Type some text into input
      await browserTest.context.page!.fill('#dynamic-input', 'Test Value');

      const state = await getElementState(browserTest.context.page!, '#dynamic-input');

      expect(state).toBeDefined();
      expect(state!.value).toBe('Test Value');
      expect(state!.tagName.toLowerCase()).toBe('input');
      expect(state!.enabled).toBe(true);
    });

    it('should capture checkbox/radio state', async () => {
      // Add a checkbox to the page
      await browserTest.context.page!.evaluate(() => {
        const container = document.querySelector('.container');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'test-checkbox';
        checkbox.checked = true;
        container?.appendChild(checkbox);
      });

      const state = await getElementState(browserTest.context.page!, '#test-checkbox');

      expect(state).toBeDefined();
      expect(state!.checked).toBe(true);
    });

    it('should capture computed styles and bounding box', async () => {
      const state = await getElementState(browserTest.context.page!, '#content-element');

      expect(state).toBeDefined();
      expect(state!.computedStyles).toBeDefined();
      expect(state!.boundingBox).toBeDefined();

      // Verify bounding box has required properties
      if (state!.boundingBox) {
        expect(typeof state!.boundingBox.x).toBe('number');
        expect(typeof state!.boundingBox.y).toBe('number');
        expect(typeof state!.boundingBox.width).toBe('number');
        expect(typeof state!.boundingBox.height).toBe('number');
        expect(state!.boundingBox.width).toBeGreaterThan(0);
        expect(state!.boundingBox.height).toBeGreaterThan(0);
      }
    });
  });

  describe('compareElementStates', () => {
    it('should detect state changes between snapshots', async () => {
      // Get initial state
      const beforeState = await getElementState(browserTest.context.page!, '#content-element');

      // Change content
      await browserTest.context.page!.click('#change-content');

      // Get state after change
      const afterState = await getElementState(browserTest.context.page!, '#content-element');

      // Compare states
      const comparison = compareElementStates(beforeState!, afterState!);

      expect(comparison).toBeDefined();
      expect(comparison.hasChanges).toBe(true);
      expect(comparison.changedProperties).toContain('text');
      expect(comparison.changes.text).toBeDefined();
      expect(comparison.changes.text.before).toBe('Original Content');
      expect(comparison.changes.text.after).toBe('Updated Content');
    });

    it('should detect attribute changes', async () => {
      // Get initial state
      const beforeState = await getElementState(browserTest.context.page!, '#attribute-element');

      // Change attributes
      await browserTest.context.page!.click('#change-attributes');

      // Get state after change
      const afterState = await getElementState(browserTest.context.page!, '#attribute-element');

      // Compare states
      const comparison = compareElementStates(beforeState!, afterState!);

      expect(comparison.hasChanges).toBe(true);
      expect(comparison.changedProperties).toContain('attributes');
      expect(comparison.changes.attributes).toBeDefined();
      expect(comparison.changes.attributes.changed['data-count']).toBeDefined();
      expect(comparison.changes.attributes.changed['data-count'].before).toBe('0');
      expect(comparison.changes.attributes.changed['data-count'].after).toBe('1');
    });

    it('should detect visibility changes', async () => {
      // Get initial state (element should be hidden)
      const beforeState = await getElementState(browserTest.context.page!, '#dynamic-element');

      // Make visible
      await browserTest.context.page!.click('#toggle-visibility');

      // Get state after change
      const afterState = await getElementState(browserTest.context.page!, '#dynamic-element');

      // Compare states
      const comparison = compareElementStates(beforeState!, afterState!);

      expect(comparison.hasChanges).toBe(true);
      expect(comparison.changedProperties).toContain('visible');
      expect(comparison.changes.visible).toBeDefined();
      expect(comparison.changes.visible.before).toBe(false);
      expect(comparison.changes.visible.after).toBe(true);
    });

    it('should detect no changes when element state is unchanged', async () => {
      // Get initial state
      const beforeState = await getElementState(browserTest.context.page!, '#content-element');

      // Wait a moment but don't change anything
      await browserTest.context.page!.waitForTimeout(100);

      // Get state again
      const afterState = await getElementState(browserTest.context.page!, '#content-element');

      // Compare states
      const comparison = compareElementStates(beforeState!, afterState!);

      expect(comparison.hasChanges).toBe(false);
      expect(comparison.changedProperties).toHaveLength(0);
      expect(Object.keys(comparison.changes)).toHaveLength(0);
    });

    it('should detect class changes', async () => {
      // Get initial state
      const beforeState = await getElementState(browserTest.context.page!, '#attribute-element');

      // Change attributes (which also changes classes)
      await browserTest.context.page!.click('#change-attributes');

      // Get state after change
      const afterState = await getElementState(browserTest.context.page!, '#attribute-element');

      // Compare states
      const comparison = compareElementStates(beforeState!, afterState!);

      expect(comparison.hasChanges).toBe(true);
      expect(comparison.changedProperties).toContain('classes');
      expect(comparison.changes.classes).toBeDefined();
      expect(comparison.changes.classes.added).toContain('processing');
    });
  });

  describe('Advanced Wait Scenarios', () => {
    it('should handle rapid state changes', async () => {
      // Start complex state changes that happen rapidly
      await browserTest.context.page!.click('#complex-state');

      // Wait for intermediate state
      const intermediateResult = await waitForConditions(browserTest.context.page!, '#complex-element', [
        { condition: 'attribute-equals', attribute: 'data-phase', value: 'loading', timeout: 3000 }
      ]);

      expect(intermediateResult).toBe(true);

      // Continue waiting for final state
      const finalResult = await waitForConditions(browserTest.context.page!, '#complex-element', [
        { condition: 'attribute-equals', attribute: 'data-phase', value: 'complete', timeout: 8000 }
      ]);

      expect(finalResult).toBe(true);
    });

    it('should handle custom wait conditions', async () => {
      // Use custom condition to wait for specific computed style
      const result = await waitForConditions(browserTest.context.page!, '#complex-element', [
        {
          condition: 'custom',
          timeout: 5000,
          customFn: async (element) => {
            const computedStyle = await element.evaluate(el => {
              return getComputedStyle(el).borderColor;
            });
            return computedStyle.includes('rgb(0, 122, 204)'); // #007acc
          }
        }
      ]);

      // Start state change that will trigger the custom condition
      await browserTest.context.page!.click('#complex-state');

      // The custom condition should be met when element gets 'active' class
      expect(result).toBe(true);
    });

    it('should handle element removal and recreation', async () => {
      // Remove and recreate an element
      await browserTest.context.page!.evaluate(() => {
        const element = document.getElementById('content-element');
        const parent = element?.parentNode;
        const newElement = document.createElement('div');
        newElement.id = 'content-element';
        newElement.className = 'test-element';
        newElement.textContent = 'Recreated Element';

        if (element && parent) {
          parent.removeChild(element);
          setTimeout(() => {
            parent.appendChild(newElement);
          }, 1000);
        }
      });

      // Wait for element to become visible again
      const result = await waitForConditions(browserTest.context.page!, '#content-element', [
        { condition: 'visible', timeout: 3000 }
      ]);

      expect(result).toBe(true);

      const state = await getElementState(browserTest.context.page!, '#content-element');
      expect(state?.text).toBe('Recreated Element');
    });
  });
});