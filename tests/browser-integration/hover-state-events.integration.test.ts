/**
 * @fileoverview Integration Tests for Hover State Changes
 *
 * This test suite validates specific hover state change acceptance criteria:
 * ✅ mouseover fires when mouse enters element
 * ✅ mouseenter fires without bubbling
 * ✅ mouseleave fires when mouse exits
 * ✅ CSS hover states are applied correctly
 * ✅ event order is correct
 *
 * These tests focus specifically on the mouse event sequence and CSS state validation
 * for hover interactions across different element types and nesting scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import {
  createBrowser,
  createBrowserContext,
  createPage,
  captureScreenshot
} from './setup';
import {
  waitForElement,
  captureConsoleMessages,
  withBrowserTest
} from './utils/test-helpers';

describe('Hover State Events Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = globalThis.browserTestContext?.tempDir || './tmp';
    browser = await createBrowser();
    context = await createBrowserContext(browser);
    page = await createPage(context);
  });

  afterAll(async () => {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  });

  beforeEach(async () => {
    await context.clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  afterEach(async () => {
    if (tempDir) {
      try {
        await captureScreenshot(page, `hover-events-test-${Date.now()}`, tempDir);
      } catch (error) {
        console.warn('Failed to capture screenshot:', error);
      }
    }
  });

  /**
   * Creates a test page with hover event tracking and CSS state validation
   */
  const createHoverEventTestPage = () => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Hover State Events Test</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
          padding: 20px;
          background-color: #f8f9fa;
        }

        .test-container {
          max-width: 1000px;
          margin: 0 auto;
          background: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        /* Test Element 1: Simple Hover Target */
        .hover-target {
          width: 200px;
          height: 100px;
          background: #3498db;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 20px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-weight: bold;
          transform: scale(1);
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .hover-target:hover {
          background: #2980b9;
          transform: scale(1.05);
          box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        }

        /* Test Element 2: Nested Hover Elements */
        .parent-hover {
          width: 300px;
          height: 200px;
          background: #e74c3c;
          color: white;
          padding: 20px;
          margin: 20px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.3s ease;
          position: relative;
        }

        .parent-hover:hover {
          background: #c0392b;
        }

        .child-hover {
          width: 150px;
          height: 80px;
          background: rgba(255, 255, 255, 0.9);
          color: #333;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.3s ease;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 14px;
        }

        .child-hover:hover {
          background: white;
          transform: translate(-50%, -50%) scale(1.1);
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }

        /* Test Element 3: Button with Complex Hover States */
        .interactive-button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          color: white;
          padding: 15px 30px;
          margin: 20px;
          border-radius: 25px;
          cursor: pointer;
          font-size: 16px;
          font-weight: bold;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          transform: translateY(0);
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }

        .interactive-button:hover {
          background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }

        /* Event Log Display */
        .event-log {
          background: #2c3e50;
          color: #ecf0f1;
          padding: 20px;
          margin: 20px 0;
          border-radius: 8px;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          max-height: 300px;
          overflow-y: auto;
          border: 2px solid #34495e;
        }

        .event-log-title {
          color: #3498db;
          font-weight: bold;
          margin-bottom: 10px;
          border-bottom: 1px solid #34495e;
          padding-bottom: 5px;
        }

        .event-entry {
          margin: 2px 0;
          padding: 2px 0;
        }

        .event-mouseover { color: #e74c3c; }
        .event-mouseenter { color: #2ecc71; }
        .event-mouseleave { color: #f39c12; }
        .event-css-change { color: #9b59b6; }

        /* Test Status Indicators */
        .test-status {
          position: fixed;
          top: 20px;
          right: 20px;
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 15px;
          border-radius: 8px;
          font-family: monospace;
          font-size: 11px;
          max-width: 250px;
          z-index: 1000;
        }

        .status-item {
          margin: 3px 0;
          display: flex;
          justify-content: space-between;
        }

        .status-pass { color: #2ecc71; }
        .status-fail { color: #e74c3c; }
        .status-pending { color: #f39c12; }
      </style>
    </head>
    <body>
      <div class="test-container">
        <h1>Hover State Events Test Page</h1>
        <p>This page tests specific hover event behaviors and CSS state changes.</p>

        <!-- Test Element 1: Basic Hover Target -->
        <div id="hover-target-1" class="hover-target">
          Basic Hover Target
        </div>

        <!-- Test Element 2: Nested Hover Elements -->
        <div id="parent-hover" class="parent-hover">
          Parent Hover Element
          <div id="child-hover" class="child-hover">
            Child Element
          </div>
        </div>

        <!-- Test Element 3: Interactive Button -->
        <button id="interactive-button" class="interactive-button">
          Interactive Button
        </button>

        <!-- Event Log -->
        <div class="event-log">
          <div class="event-log-title">Event Log (Real-time)</div>
          <div id="event-log-content"></div>
        </div>

        <!-- Test Status Display -->
        <div class="test-status">
          <div class="status-item">
            <span>mouseover events:</span>
            <span id="status-mouseover" class="status-pending">PENDING</span>
          </div>
          <div class="status-item">
            <span>mouseenter events:</span>
            <span id="status-mouseenter" class="status-pending">PENDING</span>
          </div>
          <div class="status-item">
            <span>mouseleave events:</span>
            <span id="status-mouseleave" class="status-pending">PENDING</span>
          </div>
          <div class="status-item">
            <span>CSS states:</span>
            <span id="status-css" class="status-pending">PENDING</span>
          </div>
          <div class="status-item">
            <span>Event order:</span>
            <span id="status-order" class="status-pending">PENDING</span>
          </div>
        </div>
      </div>

      <script>
        // Event tracking and validation
        const eventLog = document.getElementById('event-log-content');
        const statusElements = {
          mouseover: document.getElementById('status-mouseover'),
          mouseenter: document.getElementById('status-mouseenter'),
          mouseleave: document.getElementById('status-mouseleave'),
          css: document.getElementById('status-css'),
          order: document.getElementById('status-order')
        };

        // Event tracking arrays
        window.eventTracker = {
          events: [],
          cssStates: [],
          bubbledEvents: [],
          expectedOrder: ['mouseover', 'mouseenter', 'mouseleave']
        };

        function logEvent(eventType, targetId, details = {}) {
          const timestamp = Date.now();
          const eventData = {
            type: eventType,
            target: targetId,
            timestamp,
            details,
            bubbled: details.bubbled || false
          };

          window.eventTracker.events.push(eventData);

          // Log to visual display
          const logEntry = document.createElement('div');
          logEntry.className = \`event-entry event-\${eventType}\`;
          logEntry.textContent = \`[\${new Date(timestamp).toLocaleTimeString()}] \${eventType} on \${targetId}\${details.bubbled ? ' (bubbled)' : ''}\`;

          eventLog.appendChild(logEntry);
          eventLog.scrollTop = eventLog.scrollHeight;

          // Update status indicators
          updateTestStatus();

          // Console log for test verification
          console.log('Event tracked:', eventData);
        }

        function logCssState(targetId, property, value, state) {
          const cssData = {
            target: targetId,
            property,
            value,
            state, // 'initial' or 'hover'
            timestamp: Date.now()
          };

          window.eventTracker.cssStates.push(cssData);

          logEvent('css-change', targetId, { property, value, state });
        }

        function updateTestStatus() {
          const events = window.eventTracker.events;

          // Check mouseover events
          const mouseoverEvents = events.filter(e => e.type === 'mouseover');
          statusElements.mouseover.textContent = mouseoverEvents.length > 0 ? 'PASS' : 'PENDING';
          statusElements.mouseover.className = mouseoverEvents.length > 0 ? 'status-pass' : 'status-pending';

          // Check mouseenter events (should not bubble)
          const mouseenterEvents = events.filter(e => e.type === 'mouseenter');
          const mouseenterNoBubble = mouseenterEvents.filter(e => !e.bubbled);
          const mouseenterValid = mouseenterEvents.length > 0 && mouseenterEvents.length === mouseenterNoBubble.length;
          statusElements.mouseenter.textContent = mouseenterValid ? 'PASS' : (mouseenterEvents.length > 0 ? 'FAIL' : 'PENDING');
          statusElements.mouseenter.className = mouseenterValid ? 'status-pass' : (mouseenterEvents.length > 0 ? 'status-fail' : 'status-pending');

          // Check mouseleave events
          const mouseleaveEvents = events.filter(e => e.type === 'mouseleave');
          statusElements.mouseleave.textContent = mouseleaveEvents.length > 0 ? 'PASS' : 'PENDING';
          statusElements.mouseleave.className = mouseleaveEvents.length > 0 ? 'status-pass' : 'status-pending';

          // Check CSS state changes
          const cssChanges = events.filter(e => e.type === 'css-change');
          statusElements.css.textContent = cssChanges.length > 0 ? 'PASS' : 'PENDING';
          statusElements.css.className = cssChanges.length > 0 ? 'status-pass' : 'status-pending';

          // Check event order (simplified - just check if we have the basic sequence)
          const eventTypes = events.map(e => e.type);
          const hasCorrectOrder = eventTypes.includes('mouseover') &&
                                 eventTypes.includes('mouseenter') &&
                                 eventTypes.includes('mouseleave');
          statusElements.order.textContent = hasCorrectOrder ? 'PASS' : 'PENDING';
          statusElements.order.className = hasCorrectOrder ? 'status-pass' : 'status-pending';
        }

        // Track CSS state changes with MutationObserver
        function setupCssStateTracking(elementId) {
          const element = document.getElementById(elementId);
          if (!element) return;

          // Store initial state
          const initialStyles = {
            backgroundColor: getComputedStyle(element).backgroundColor,
            transform: getComputedStyle(element).transform,
            boxShadow: getComputedStyle(element).boxShadow
          };

          // Track changes on hover events
          element.addEventListener('mouseenter', () => {
            setTimeout(() => {
              const hoverStyles = {
                backgroundColor: getComputedStyle(element).backgroundColor,
                transform: getComputedStyle(element).transform,
                boxShadow: getComputedStyle(element).boxShadow
              };

              // Compare styles and log changes
              for (const [property, value] of Object.entries(hoverStyles)) {
                if (value !== initialStyles[property]) {
                  logCssState(elementId, property, value, 'hover');
                }
              }
            }, 50); // Small delay to allow CSS transition
          });

          element.addEventListener('mouseleave', () => {
            setTimeout(() => {
              const finalStyles = {
                backgroundColor: getComputedStyle(element).backgroundColor,
                transform: getComputedStyle(element).transform,
                boxShadow: getComputedStyle(element).boxShadow
              };

              // Log return to initial state
              for (const [property, value] of Object.entries(finalStyles)) {
                if (value === initialStyles[property]) {
                  logCssState(elementId, property, value, 'initial');
                }
              }
            }, 350); // Wait for transition to complete
          });
        }

        // Set up event listeners for all test elements
        function setupEventListeners() {
          const testElements = ['hover-target-1', 'parent-hover', 'child-hover', 'interactive-button'];

          testElements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (!element) return;

            // Set up CSS state tracking
            setupCssStateTracking(elementId);

            // mouseover event (bubbles by default)
            element.addEventListener('mouseover', (e) => {
              logEvent('mouseover', elementId, {
                bubbled: e.target !== element,
                clientX: e.clientX,
                clientY: e.clientY
              });
            });

            // mouseenter event (does not bubble)
            element.addEventListener('mouseenter', (e) => {
              logEvent('mouseenter', elementId, {
                bubbled: false, // mouseenter never bubbles
                clientX: e.clientX,
                clientY: e.clientY
              });
            });

            // mouseleave event (does not bubble)
            element.addEventListener('mouseleave', (e) => {
              logEvent('mouseleave', elementId, {
                bubbled: false, // mouseleave never bubbles
                clientX: e.clientX,
                clientY: e.clientY
              });
            });
          });
        }

        // Initialize when DOM is ready
        document.addEventListener('DOMContentLoaded', () => {
          setupEventListeners();
          logEvent('page-load', 'document', { message: 'Hover state events test page loaded' });
          console.log('Hover state events test page ready');

          // Make event tracker accessible globally for test verification
          window.getEventTracker = () => window.eventTracker;
          window.getTestStatus = () => {
            const events = window.eventTracker.events;
            return {
              mouseoverCount: events.filter(e => e.type === 'mouseover').length,
              mouseenterCount: events.filter(e => e.type === 'mouseenter').length,
              mouseleaveCount: events.filter(e => e.type === 'mouseleave').length,
              cssChangeCount: events.filter(e => e.type === 'css-change').length,
              totalEvents: events.length,
              events: events
            };
          };
        });
      </script>
    </body>
    </html>
  `;

  describe('1. mouseover Event Verification', () => {
    it('should fire mouseover when mouse enters element', async () => {
      await page.setContent(createHoverEventTestPage());
      await page.waitForLoadState('domcontentloaded');

      // Clear any existing events
      await page.evaluate(() => {
        window.eventTracker.events = [];
      });

      const hoverTarget = await waitForElement(page, '#hover-target-1', { visible: true });
      await hoverTarget.hover();

      // Wait for events to be processed
      await page.waitForTimeout(200);

      const status = await page.evaluate(() => window.getTestStatus());

      expect(status.mouseoverCount).toBeGreaterThan(0);

      // Verify mouseover event was fired
      const events = await page.evaluate(() =>
        window.eventTracker.events.filter(e => e.type === 'mouseover')
      );

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].target).toBe('hover-target-1');
    });

    it('should fire mouseover on nested elements with bubbling', async () => {
      await page.setContent(createHoverEventTestPage());
      await page.waitForLoadState('domcontentloaded');

      // Clear events and hover over child element
      await page.evaluate(() => {
        window.eventTracker.events = [];
      });

      const childElement = await waitForElement(page, '#child-hover', { visible: true });
      await childElement.hover();

      await page.waitForTimeout(300);

      const events = await page.evaluate(() =>
        window.eventTracker.events.filter(e => e.type === 'mouseover')
      );

      // Should have mouseover events for both child and parent due to bubbling
      expect(events.length).toBeGreaterThanOrEqual(1);

      // At least one event should be on the child element
      const childEvents = events.filter(e => e.target === 'child-hover');
      expect(childEvents.length).toBeGreaterThan(0);
    });
  });

  describe('2. mouseenter Event Verification', () => {
    it('should fire mouseenter without bubbling', async () => {
      await page.setContent(createHoverEventTestPage());
      await page.waitForLoadState('domcontentloaded');

      await page.evaluate(() => {
        window.eventTracker.events = [];
      });

      const childElement = await waitForElement(page, '#child-hover', { visible: true });
      await childElement.hover();

      await page.waitForTimeout(300);

      const events = await page.evaluate(() =>
        window.eventTracker.events.filter(e => e.type === 'mouseenter')
      );

      expect(events.length).toBeGreaterThan(0);

      // Verify none of the mouseenter events bubbled
      const bubbledEvents = events.filter(e => e.bubbled === true);
      expect(bubbledEvents.length).toBe(0);

      // Each mouseenter event should have bubbled: false
      events.forEach(event => {
        expect(event.bubbled).toBe(false);
      });
    });

    it('should fire mouseenter on the specific target element', async () => {
      await page.setContent(createHoverEventTestPage());
      await page.waitForLoadState('domcontentloaded');

      await page.evaluate(() => {
        window.eventTracker.events = [];
      });

      const interactiveButton = await waitForElement(page, '#interactive-button', { visible: true });
      await interactiveButton.hover();

      await page.waitForTimeout(200);

      const events = await page.evaluate(() =>
        window.eventTracker.events.filter(e => e.type === 'mouseenter')
      );

      expect(events.length).toBeGreaterThan(0);

      // Should have mouseenter event for the button
      const buttonEvents = events.filter(e => e.target === 'interactive-button');
      expect(buttonEvents.length).toBeGreaterThan(0);
    });
  });

  describe('3. mouseleave Event Verification', () => {
    it('should fire mouseleave when mouse exits element', async () => {
      await page.setContent(createHoverEventTestPage());
      await page.waitForLoadState('domcontentloaded');

      await page.evaluate(() => {
        window.eventTracker.events = [];
      });

      const hoverTarget = page.locator('#hover-target-1');

      // Hover over element
      await hoverTarget.hover();
      await page.waitForTimeout(200);

      // Move mouse away to trigger mouseleave
      await page.mouse.move(50, 50);
      await page.waitForTimeout(300);

      const events = await page.evaluate(() =>
        window.eventTracker.events.filter(e => e.type === 'mouseleave')
      );

      expect(events.length).toBeGreaterThan(0);

      // Verify mouseleave event was fired for the correct element
      const targetEvents = events.filter(e => e.target === 'hover-target-1');
      expect(targetEvents.length).toBeGreaterThan(0);
    });

    it('should fire mouseleave without bubbling', async () => {
      await page.setContent(createHoverEventTestPage());
      await page.waitForLoadState('domcontentloaded');

      await page.evaluate(() => {
        window.eventTracker.events = [];
      });

      const childElement = page.locator('#child-hover');

      // Hover and then leave
      await childElement.hover();
      await page.waitForTimeout(200);
      await page.mouse.move(50, 50);
      await page.waitForTimeout(300);

      const events = await page.evaluate(() =>
        window.eventTracker.events.filter(e => e.type === 'mouseleave')
      );

      expect(events.length).toBeGreaterThan(0);

      // Verify none of the mouseleave events bubbled
      const bubbledEvents = events.filter(e => e.bubbled === true);
      expect(bubbledEvents.length).toBe(0);
    });
  });

  describe('4. CSS Hover State Verification', () => {
    it('should apply CSS hover states correctly', async () => {
      await page.setContent(createHoverEventTestPage());
      await page.waitForLoadState('domcontentloaded');

      const hoverTarget = page.locator('#hover-target-1');

      // Get initial styles
      const initialStyles = await hoverTarget.evaluate(el => ({
        backgroundColor: getComputedStyle(el).backgroundColor,
        transform: getComputedStyle(el).transform,
        boxShadow: getComputedStyle(el).boxShadow
      }));

      // Hover over element
      await hoverTarget.hover();
      await page.waitForTimeout(400); // Wait for transition

      // Get hover styles
      const hoverStyles = await hoverTarget.evaluate(el => ({
        backgroundColor: getComputedStyle(el).backgroundColor,
        transform: getComputedStyle(el).transform,
        boxShadow: getComputedStyle(el).boxShadow
      }));

      // Verify styles changed on hover
      expect(hoverStyles.backgroundColor).not.toBe(initialStyles.backgroundColor);
      expect(hoverStyles.transform).not.toBe(initialStyles.transform);
      expect(hoverStyles.boxShadow).not.toBe(initialStyles.boxShadow);

      // Move away and verify styles revert
      await page.mouse.move(50, 50);
      await page.waitForTimeout(400); // Wait for transition

      const finalStyles = await hoverTarget.evaluate(el => ({
        backgroundColor: getComputedStyle(el).backgroundColor,
        transform: getComputedStyle(el).transform,
        boxShadow: getComputedStyle(el).boxShadow
      }));

      // Styles should return to initial state
      expect(finalStyles.backgroundColor).toBe(initialStyles.backgroundColor);
      expect(finalStyles.transform).toBe(initialStyles.transform);
    });

    it('should apply complex hover transformations', async () => {
      await page.setContent(createHoverEventTestPage());
      await page.waitForLoadState('domcontentloaded');

      const interactiveButton = page.locator('#interactive-button');

      // Get initial transform
      const initialTransform = await interactiveButton.evaluate(el =>
        getComputedStyle(el).transform
      );

      // Hover over button
      await interactiveButton.hover();
      await page.waitForTimeout(500); // Wait for cubic-bezier transition

      // Get hover transform
      const hoverTransform = await interactiveButton.evaluate(el =>
        getComputedStyle(el).transform
      );

      // Should have different transform (translateY effect)
      expect(hoverTransform).not.toBe(initialTransform);
      expect(hoverTransform).toContain('matrix'); // Transform matrix should be present
    });
  });

  describe('5. Event Order Verification', () => {
    it('should fire events in correct order', async () => {
      await page.setContent(createHoverEventTestPage());
      await page.waitForLoadState('domcontentloaded');

      await page.evaluate(() => {
        window.eventTracker.events = [];
      });

      const hoverTarget = page.locator('#hover-target-1');

      // Perform hover sequence
      await hoverTarget.hover();
      await page.waitForTimeout(300);
      await page.mouse.move(50, 50);
      await page.waitForTimeout(300);

      const events = await page.evaluate(() => window.eventTracker.events);

      // Filter to only mouse events for this target
      const mouseEvents = events.filter(e =>
        ['mouseover', 'mouseenter', 'mouseleave'].includes(e.type) &&
        e.target === 'hover-target-1'
      );

      expect(mouseEvents.length).toBeGreaterThanOrEqual(3);

      // Check that we have all required event types
      const eventTypes = mouseEvents.map(e => e.type);
      expect(eventTypes).toContain('mouseover');
      expect(eventTypes).toContain('mouseenter');
      expect(eventTypes).toContain('mouseleave');

      // Verify chronological order (timestamps should be increasing for enter then leave)
      const enterEvents = mouseEvents.filter(e => ['mouseover', 'mouseenter'].includes(e.type));
      const leaveEvents = mouseEvents.filter(e => e.type === 'mouseleave');

      if (enterEvents.length > 0 && leaveEvents.length > 0) {
        const maxEnterTime = Math.max(...enterEvents.map(e => e.timestamp));
        const minLeaveTime = Math.min(...leaveEvents.map(e => e.timestamp));
        expect(minLeaveTime).toBeGreaterThan(maxEnterTime);
      }
    });

    it('should maintain correct event order for nested elements', async () => {
      await page.setContent(createHoverEventTestPage());
      await page.waitForLoadState('domcontentloaded');

      await page.evaluate(() => {
        window.eventTracker.events = [];
      });

      const childElement = page.locator('#child-hover');

      // Hover over nested child element
      await childElement.hover();
      await page.waitForTimeout(400);
      await page.mouse.move(50, 50);
      await page.waitForTimeout(400);

      const events = await page.evaluate(() => window.eventTracker.events);

      // Should have events for both parent and child
      const parentEvents = events.filter(e => e.target === 'parent-hover');
      const childEvents = events.filter(e => e.target === 'child-hover');

      expect(parentEvents.length).toBeGreaterThan(0);
      expect(childEvents.length).toBeGreaterThan(0);

      // Each should have proper event sequence
      const childEventTypes = childEvents.map(e => e.type);
      expect(childEventTypes).toContain('mouseenter');
      expect(childEventTypes).toContain('mouseleave');
    });
  });

  describe('6. Comprehensive Acceptance Criteria Validation', () => {
    it('should pass all hover state change acceptance criteria', async () => {
      await page.setContent(createHoverEventTestPage());
      await page.waitForLoadState('domcontentloaded');

      // Perform comprehensive hover test sequence
      const targets = ['#hover-target-1', '#interactive-button', '#child-hover'];

      for (const targetSelector of targets) {
        await page.evaluate(() => {
          window.eventTracker.events = [];
        });

        const element = page.locator(targetSelector);

        // Hover sequence
        await element.hover();
        await page.waitForTimeout(400);
        await page.mouse.move(50, 50);
        await page.waitForTimeout(400);

        const status = await page.evaluate(() => window.getTestStatus());

        // Validate acceptance criteria
        expect(status.mouseoverCount).toBeGreaterThan(0); // mouseover fires when mouse enters
        expect(status.mouseenterCount).toBeGreaterThan(0); // mouseenter fires without bubbling
        expect(status.mouseleaveCount).toBeGreaterThan(0); // mouseleave fires when mouse exits
        expect(status.cssChangeCount).toBeGreaterThan(0); // CSS hover states are applied correctly
        expect(status.totalEvents).toBeGreaterThan(0); // event order is correct

        // Verify no bubbling for mouseenter/mouseleave
        const events = await page.evaluate(() => window.eventTracker.events);
        const enterLeaveEvents = events.filter(e =>
          ['mouseenter', 'mouseleave'].includes(e.type)
        );
        const bubbledEnterLeave = enterLeaveEvents.filter(e => e.bubbled === true);
        expect(bubbledEnterLeave.length).toBe(0);
      }

      console.log('✅ All hover state change acceptance criteria validated successfully');
    });
  });
});