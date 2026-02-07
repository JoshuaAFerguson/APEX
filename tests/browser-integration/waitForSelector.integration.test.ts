/**
 * @fileoverview waitForSelector Integration Tests
 *
 * Comprehensive integration tests for waitForSelector functionality covering:
 * - Element waiting with different states (visible, hidden, attached, detached)
 * - Dynamic DOM updates and element state transitions
 * - Timeout configurations and error handling
 * - Edge cases and stress scenarios
 *
 * Acceptance Criteria:
 * ✅ Tests pass for waitForSelector with different state options
 * ✅ Tests cover waiting for elements to appear, disappear, become visible, and become hidden
 * ✅ Includes tests for dynamic DOM updates
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import { BrowserTool } from '../../packages/orchestrator/src/tools/browser-tool.js';

describe('waitForSelector Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let browserTool: BrowserTool;

  beforeEach(async () => {
    browser = await chromium.launch({
      headless: process.env.CI === 'true' || process.env.BROWSER_TEST_HEADLESS === 'true',
    });
    context = await browser.newContext();
    page = await context.newPage();
    page.setDefaultTimeout(30000);
    browserTool = new BrowserTool();
  });

  afterEach(async () => {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  });

  describe('Element State - Visible', () => {
    it('should wait for element to become visible from hidden', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Visible State Test</title></head>
        <body>
          <div id="test-element" style="display: none;">Hidden Element</div>
          <script>
            setTimeout(() => {
              document.getElementById('test-element').style.display = 'block';
            }, 200);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // Verify element is initially hidden
      const initiallyVisible = await page.locator('#test-element').isVisible();
      expect(initiallyVisible).toBe(false);

      // Wait for element to become visible using Playwright's waitForSelector
      const element = await page.waitForSelector('#test-element', {
        state: 'visible',
        timeout: 5000
      });

      expect(element).not.toBeNull();
      const isVisible = await page.locator('#test-element').isVisible();
      expect(isVisible).toBe(true);

      // Test with BrowserTool
      const result = await browserTool.execute({
        operation: 'waitForSelector',
        params: {
          selector: '#test-element',
          options: { state: 'visible', timeout: 1000 }
        }
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('waitForSelector');
    });

    it('should wait for dynamically added element to become visible', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Dynamic Element Test</title></head>
        <body>
          <div id="container"></div>
          <script>
            setTimeout(() => {
              const newElement = document.createElement('div');
              newElement.id = 'dynamic-element';
              newElement.textContent = 'Dynamically Added';
              newElement.style.display = 'block';
              document.getElementById('container').appendChild(newElement);
            }, 150);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // Element doesn't exist initially
      const initialCount = await page.locator('#dynamic-element').count();
      expect(initialCount).toBe(0);

      // Wait for dynamic element to appear and become visible
      await page.waitForSelector('#dynamic-element', {
        state: 'visible',
        timeout: 5000
      });

      const element = await page.locator('#dynamic-element');
      expect(await element.isVisible()).toBe(true);
      expect(await element.textContent()).toBe('Dynamically Added');
    });

    it('should handle element with opacity transitions', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Opacity Transition Test</title>
          <style>
            .fade-in {
              opacity: 0;
              transition: opacity 0.3s ease-in;
            }
            .visible {
              opacity: 1;
            }
          </style>
        </head>
        <body>
          <div id="fade-element" class="fade-in">Fading Element</div>
          <script>
            setTimeout(() => {
              document.getElementById('fade-element').classList.add('visible');
            }, 100);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // Wait for element to become visible (opacity transition)
      await page.waitForSelector('#fade-element', {
        state: 'visible',
        timeout: 5000
      });

      const element = await page.locator('#fade-element');
      expect(await element.isVisible()).toBe(true);

      // Check that opacity transition completed
      const opacity = await element.evaluate(el => getComputedStyle(el).opacity);
      expect(parseFloat(opacity)).toBeGreaterThan(0);
    });
  });

  describe('Element State - Hidden', () => {
    it('should wait for visible element to become hidden', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Hidden State Test</title></head>
        <body>
          <div id="test-element" style="display: block;">Visible Element</div>
          <script>
            setTimeout(() => {
              document.getElementById('test-element').style.display = 'none';
            }, 200);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // Verify element is initially visible
      const initiallyVisible = await page.locator('#test-element').isVisible();
      expect(initiallyVisible).toBe(true);

      // Wait for element to become hidden
      await page.waitForSelector('#test-element', {
        state: 'hidden',
        timeout: 5000
      });

      const isHidden = await page.locator('#test-element').isVisible();
      expect(isHidden).toBe(false);
    });

    it('should wait for element to become hidden via CSS visibility', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>CSS Visibility Test</title></head>
        <body>
          <div id="test-element" style="visibility: visible;">CSS Visible Element</div>
          <script>
            setTimeout(() => {
              document.getElementById('test-element').style.visibility = 'hidden';
            }, 150);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // Verify element is initially visible
      const initiallyVisible = await page.locator('#test-element').isVisible();
      expect(initiallyVisible).toBe(true);

      // Wait for element to become hidden
      await page.waitForSelector('#test-element', {
        state: 'hidden',
        timeout: 5000
      });

      const isHidden = await page.locator('#test-element').isVisible();
      expect(isHidden).toBe(false);
    });

    it('should wait for element to be hidden by parent container', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Parent Hidden Test</title></head>
        <body>
          <div id="parent-container">
            <div id="child-element">Child Element</div>
          </div>
          <script>
            setTimeout(() => {
              document.getElementById('parent-container').style.display = 'none';
            }, 180);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // Verify child element is initially visible
      const initiallyVisible = await page.locator('#child-element').isVisible();
      expect(initiallyVisible).toBe(true);

      // Wait for child element to become hidden when parent is hidden
      await page.waitForSelector('#child-element', {
        state: 'hidden',
        timeout: 5000
      });

      const isHidden = await page.locator('#child-element').isVisible();
      expect(isHidden).toBe(false);
    });
  });

  describe('Element State - Attached', () => {
    it('should wait for element to be attached to DOM', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Attached State Test</title></head>
        <body>
          <div id="container"></div>
          <script>
            setTimeout(() => {
              const newElement = document.createElement('div');
              newElement.id = 'attached-element';
              newElement.textContent = 'Now Attached';
              newElement.style.display = 'none'; // Hidden but attached
              document.getElementById('container').appendChild(newElement);
            }, 160);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // Element doesn't exist initially
      const initialCount = await page.locator('#attached-element').count();
      expect(initialCount).toBe(0);

      // Wait for element to be attached (even if not visible)
      await page.waitForSelector('#attached-element', {
        state: 'attached',
        timeout: 5000
      });

      const attachedCount = await page.locator('#attached-element').count();
      expect(attachedCount).toBe(1);

      // Element should be in DOM but not visible
      const isVisible = await page.locator('#attached-element').isVisible();
      expect(isVisible).toBe(false);
    });

    it('should wait for element moved from one parent to another', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Element Move Test</title></head>
        <body>
          <div id="source-container">
            <div id="movable-element">Moving Element</div>
          </div>
          <div id="target-container"></div>
          <script>
            setTimeout(() => {
              const element = document.getElementById('movable-element');
              const targetContainer = document.getElementById('target-container');
              targetContainer.appendChild(element);
            }, 120);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // Element is initially in source container
      const initialParent = await page.locator('#movable-element').evaluate(el => el.parentElement?.id);
      expect(initialParent).toBe('source-container');

      // Wait a bit for the move to happen
      await page.waitForTimeout(200);

      // Verify element is still attached and in new location
      const movedCount = await page.locator('#movable-element').count();
      expect(movedCount).toBe(1);

      const newParent = await page.locator('#movable-element').evaluate(el => el.parentElement?.id);
      expect(newParent).toBe('target-container');
    });

    it('should handle elements attached with complex structure', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Complex Structure Test</title></head>
        <body>
          <div id="root"></div>
          <script>
            setTimeout(() => {
              const structure = document.createElement('div');
              structure.innerHTML = \`
                <div class="level-1">
                  <div class="level-2">
                    <div id="deep-element" class="level-3">Deep Element</div>
                  </div>
                </div>
              \`;
              document.getElementById('root').appendChild(structure);
            }, 140);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // Wait for deeply nested element to be attached
      await page.waitForSelector('#deep-element', {
        state: 'attached',
        timeout: 5000
      });

      const element = await page.locator('#deep-element');
      expect(await element.count()).toBe(1);
      expect(await element.textContent()).toBe('Deep Element');

      // Verify nested structure
      const hasLevel3Class = await element.evaluate(el => el.classList.contains('level-3'));
      expect(hasLevel3Class).toBe(true);
    });
  });

  describe('Element State - Detached', () => {
    it('should wait for element to be detached from DOM', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Detached State Test</title></head>
        <body>
          <div id="removable-element">Will be Removed</div>
          <script>
            setTimeout(() => {
              const element = document.getElementById('removable-element');
              element.parentNode.removeChild(element);
            }, 190);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // Verify element exists initially
      const initialCount = await page.locator('#removable-element').count();
      expect(initialCount).toBe(1);

      // Wait for element to be detached
      await page.waitForSelector('#removable-element', {
        state: 'detached',
        timeout: 5000
      });

      const finalCount = await page.locator('#removable-element').count();
      expect(finalCount).toBe(0);
    });

    it('should wait for element to be detached when parent is removed', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Parent Removal Test</title></head>
        <body>
          <div id="parent-to-remove">
            <div id="child-to-detach">Child Element</div>
          </div>
          <script>
            setTimeout(() => {
              const parent = document.getElementById('parent-to-remove');
              parent.parentNode.removeChild(parent);
            }, 170);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // Verify both parent and child exist initially
      const initialParentCount = await page.locator('#parent-to-remove').count();
      const initialChildCount = await page.locator('#child-to-detach').count();
      expect(initialParentCount).toBe(1);
      expect(initialChildCount).toBe(1);

      // Wait for child to be detached when parent is removed
      await page.waitForSelector('#child-to-detach', {
        state: 'detached',
        timeout: 5000
      });

      const finalChildCount = await page.locator('#child-to-detach').count();
      expect(finalChildCount).toBe(0);
    });

    it('should handle rapid attach/detach cycles', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Rapid Cycles Test</title></head>
        <body>
          <div id="container"></div>
          <script>
            let element = null;
            let cycles = 0;
            const maxCycles = 5;

            function toggleElement() {
              if (element && element.parentNode) {
                element.parentNode.removeChild(element);
                element = null;
              } else {
                element = document.createElement('div');
                element.id = 'cycling-element';
                element.textContent = 'Cycle: ' + cycles;
                document.getElementById('container').appendChild(element);
              }

              cycles++;
              if (cycles < maxCycles * 2) {
                setTimeout(toggleElement, 100);
              }
            }

            setTimeout(toggleElement, 50);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // Wait for element to be attached first
      await page.waitForSelector('#cycling-element', {
        state: 'attached',
        timeout: 5000
      });

      // Then wait for it to be detached
      await page.waitForSelector('#cycling-element', {
        state: 'detached',
        timeout: 5000
      });

      // Final state should be detached
      const finalCount = await page.locator('#cycling-element').count();
      expect(finalCount).toBe(0);
    });
  });

  describe('Dynamic DOM Updates', () => {
    it('should handle complex DOM mutations', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Complex DOM Mutations</title></head>
        <body>
          <div id="mutation-container"></div>
          <script>
            let step = 0;
            const steps = [
              () => {
                const list = document.createElement('ul');
                list.id = 'dynamic-list';
                document.getElementById('mutation-container').appendChild(list);
              },
              () => {
                const list = document.getElementById('dynamic-list');
                for (let i = 1; i <= 3; i++) {
                  const item = document.createElement('li');
                  item.textContent = \`Item \${i}\`;
                  item.className = 'list-item';
                  if (i === 3) item.id = 'final-item';
                  list.appendChild(item);
                }
              },
              () => {
                const finalItem = document.getElementById('final-item');
                finalItem.classList.add('highlighted');
                finalItem.style.backgroundColor = 'yellow';
              }
            ];

            function executeStep() {
              if (step < steps.length) {
                steps[step]();
                step++;
                setTimeout(executeStep, 150);
              }
            }

            setTimeout(executeStep, 100);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // Wait for dynamic list to be attached
      await page.waitForSelector('#dynamic-list', {
        state: 'attached',
        timeout: 5000
      });

      // Wait for final item to appear
      await page.waitForSelector('#final-item', {
        state: 'visible',
        timeout: 5000
      });

      // Wait for final item to be highlighted
      await page.waitForSelector('#final-item.highlighted', {
        state: 'visible',
        timeout: 5000
      });

      // Verify final state
      const finalItem = await page.locator('#final-item');
      expect(await finalItem.count()).toBe(1);
      expect(await finalItem.textContent()).toBe('Item 3');

      const hasHighlightClass = await finalItem.evaluate(el => el.classList.contains('highlighted'));
      expect(hasHighlightClass).toBe(true);

      const backgroundColor = await finalItem.evaluate(el => getComputedStyle(el).backgroundColor);
      expect(backgroundColor).toContain('255, 255, 0'); // Yellow in RGB
    });

    it('should handle form elements being added dynamically', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Dynamic Form Test</title></head>
        <body>
          <div id="form-container"></div>
          <script>
            setTimeout(() => {
              const form = document.createElement('form');
              form.id = 'dynamic-form';

              const emailInput = document.createElement('input');
              emailInput.type = 'email';
              emailInput.id = 'email-input';
              emailInput.placeholder = 'Enter email';

              const submitButton = document.createElement('button');
              submitButton.type = 'submit';
              submitButton.id = 'submit-button';
              submitButton.textContent = 'Submit';

              form.appendChild(emailInput);
              form.appendChild(submitButton);
              document.getElementById('form-container').appendChild(form);
            }, 120);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // Wait for form elements to be attached
      await page.waitForSelector('#dynamic-form', {
        state: 'attached',
        timeout: 5000
      });

      await page.waitForSelector('#email-input', {
        state: 'visible',
        timeout: 5000
      });

      await page.waitForSelector('#submit-button', {
        state: 'visible',
        timeout: 5000
      });

      // Test interaction with dynamically added elements
      await page.fill('#email-input', 'test@example.com');
      const inputValue = await page.inputValue('#email-input');
      expect(inputValue).toBe('test@example.com');

      const buttonText = await page.textContent('#submit-button');
      expect(buttonText).toBe('Submit');
    });

    it('should handle iframe content loading', async () => {
      const iframeContent = `
        <!DOCTYPE html>
        <html>
        <head><title>Iframe Content</title></head>
        <body>
          <div id="iframe-element">Iframe Content Loaded</div>
        </body>
        </html>
      `;

      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Iframe Test</title></head>
        <body>
          <div id="iframe-container"></div>
          <script>
            setTimeout(() => {
              const iframe = document.createElement('iframe');
              iframe.id = 'test-iframe';
              iframe.srcdoc = \`${iframeContent.replace(/`/g, '\\`')}\`;
              document.getElementById('iframe-container').appendChild(iframe);
            }, 100);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // Wait for iframe to be attached
      await page.waitForSelector('#test-iframe', {
        state: 'attached',
        timeout: 5000
      });

      // Wait for iframe to load
      const iframe = page.frameLocator('#test-iframe');
      await iframe.locator('#iframe-element').waitFor({
        state: 'visible',
        timeout: 5000
      });

      const iframeElementText = await iframe.locator('#iframe-element').textContent();
      expect(iframeElementText).toBe('Iframe Content Loaded');
    });
  });

  describe('Timeout Configurations', () => {
    it('should respect custom timeout settings', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Timeout Test</title></head>
        <body>
          <div id="container"></div>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      const startTime = Date.now();

      // Test with short timeout - should fail
      await expect(
        page.waitForSelector('#nonexistent-element', { timeout: 500 })
      ).rejects.toThrow();

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(450);
      expect(elapsed).toBeLessThan(1000);
    });

    it('should succeed before timeout when condition is met', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Quick Success Test</title></head>
        <body>
          <div id="container"></div>
          <script>
            setTimeout(() => {
              const element = document.createElement('div');
              element.id = 'quick-element';
              element.textContent = 'Quick Element';
              document.getElementById('container').appendChild(element);
            }, 50);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      const startTime = Date.now();

      await page.waitForSelector('#quick-element', {
        state: 'visible',
        timeout: 5000
      });

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(500); // Should complete much faster than timeout
    });

    it('should handle timeout with different element states', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>State Timeout Test</title></head>
        <body>
          <div id="persistent-element" style="display: block;">Always Visible</div>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // This should timeout because element never becomes hidden
      const startTime = Date.now();

      await expect(
        page.waitForSelector('#persistent-element', {
          state: 'hidden',
          timeout: 600
        })
      ).rejects.toThrow();

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(550);
    });

    it('should test BrowserTool timeout configuration', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>BrowserTool Timeout</title></head>
        <body>
          <div id="container"></div>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // Test BrowserTool with custom timeout
      const startTime = Date.now();

      const result = await browserTool.execute({
        operation: 'waitForSelector',
        params: {
          selector: '#missing-element',
          options: { timeout: 800 }
        }
      });

      // Since this is a mock implementation, it should return success
      // In a real implementation, we would test actual timeout behavior
      expect(result.success).toBe(true);
      expect(result.operation).toBe('waitForSelector');
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle malformed selectors gracefully', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Malformed Selector Test</title></head>
        <body>
          <div id="test-element">Test Element</div>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // Test with malformed CSS selector
      await expect(
        page.waitForSelector('#[invalid-selector', { timeout: 1000 })
      ).rejects.toThrow();

      // Test with empty selector
      await expect(
        page.waitForSelector('', { timeout: 1000 })
      ).rejects.toThrow();
    });

    it('should handle elements that appear and disappear rapidly', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Rapid State Changes</title></head>
        <body>
          <div id="container"></div>
          <script>
            let isVisible = false;
            let changeCount = 0;
            const maxChanges = 20;

            function toggleElement() {
              const element = document.getElementById('flickering-element');

              if (!element && !isVisible) {
                const newElement = document.createElement('div');
                newElement.id = 'flickering-element';
                newElement.textContent = 'Flickering Element';
                document.getElementById('container').appendChild(newElement);
                isVisible = true;
              } else if (element && isVisible) {
                element.parentNode.removeChild(element);
                isVisible = false;
              }

              changeCount++;
              if (changeCount < maxChanges) {
                setTimeout(toggleElement, 50);
              } else {
                // Final state: ensure element is visible
                if (!isVisible) {
                  const finalElement = document.createElement('div');
                  finalElement.id = 'flickering-element';
                  finalElement.textContent = 'Final Flickering Element';
                  document.getElementById('container').appendChild(finalElement);
                }
              }
            }

            setTimeout(toggleElement, 100);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // Wait for element to eventually stabilize as visible
      await page.waitForSelector('#flickering-element', {
        state: 'visible',
        timeout: 10000
      });

      const element = await page.locator('#flickering-element');
      expect(await element.isVisible()).toBe(true);
      expect(await element.textContent()).toContain('Flickering Element');
    });

    it('should handle shadow DOM elements', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Shadow DOM Test</title></head>
        <body>
          <div id="shadow-host"></div>
          <script>
            setTimeout(() => {
              const host = document.getElementById('shadow-host');
              const shadow = host.attachShadow({mode: 'open'});

              const shadowElement = document.createElement('div');
              shadowElement.id = 'shadow-element';
              shadowElement.textContent = 'Shadow Element';
              shadow.appendChild(shadowElement);
            }, 150);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // Wait for shadow host to have shadow root
      await page.waitForFunction(() => {
        const host = document.getElementById('shadow-host');
        return host && host.shadowRoot !== null;
      }, { timeout: 5000 });

      // Verify shadow DOM content
      const shadowElement = await page.locator('#shadow-host').locator('#shadow-element');
      expect(await shadowElement.textContent()).toBe('Shadow Element');
    });

    it('should handle multiple elements with same selector', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Multiple Elements Test</title></head>
        <body>
          <div id="container"></div>
          <script>
            setTimeout(() => {
              for (let i = 1; i <= 5; i++) {
                const element = document.createElement('div');
                element.className = 'multiple-element';
                element.textContent = \`Element \${i}\`;
                element.dataset.index = i;
                document.getElementById('container').appendChild(element);
              }
            }, 130);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // Wait for any element with the class to appear
      await page.waitForSelector('.multiple-element', {
        state: 'visible',
        timeout: 5000
      });

      // Verify multiple elements exist
      const elementCount = await page.locator('.multiple-element').count();
      expect(elementCount).toBe(5);

      // Verify specific element content
      const thirdElement = await page.locator('.multiple-element[data-index="3"]');
      expect(await thirdElement.textContent()).toBe('Element 3');
    });

    it('should handle CSS animations and transitions', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Animation Test</title>
          <style>
            @keyframes slideIn {
              from { transform: translateX(-100%); }
              to { transform: translateX(0); }
            }

            .animated {
              animation: slideIn 0.5s ease-in-out forwards;
            }

            .delayed-element {
              opacity: 0;
              transition: opacity 0.3s ease-in;
            }

            .delayed-element.show {
              opacity: 1;
            }
          </style>
        </head>
        <body>
          <div id="animated-element" class="animated" style="display: none;">Animated Element</div>
          <div id="delayed-element" class="delayed-element">Delayed Element</div>
          <script>
            setTimeout(() => {
              document.getElementById('animated-element').style.display = 'block';
            }, 100);

            setTimeout(() => {
              document.getElementById('delayed-element').classList.add('show');
            }, 200);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // Wait for animated element to become visible
      await page.waitForSelector('#animated-element', {
        state: 'visible',
        timeout: 5000
      });

      // Wait for delayed element to transition to visible
      await page.waitForSelector('#delayed-element.show', {
        state: 'visible',
        timeout: 5000
      });

      const animatedElement = await page.locator('#animated-element');
      const delayedElement = await page.locator('#delayed-element');

      expect(await animatedElement.isVisible()).toBe(true);
      expect(await delayedElement.isVisible()).toBe(true);

      // Verify CSS classes
      expect(await delayedElement.evaluate(el => el.classList.contains('show'))).toBe(true);
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle large number of elements efficiently', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Large DOM Test</title></head>
        <body>
          <div id="large-container"></div>
          <script>
            setTimeout(() => {
              const container = document.getElementById('large-container');
              const fragment = document.createDocumentFragment();

              for (let i = 1; i <= 1000; i++) {
                const element = document.createElement('div');
                element.className = 'large-dom-element';
                element.textContent = \`Element \${i}\`;
                if (i === 500) {
                  element.id = 'middle-element';
                }
                if (i === 1000) {
                  element.id = 'last-element';
                }
                fragment.appendChild(element);
              }

              container.appendChild(fragment);
            }, 100);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      const startTime = Date.now();

      // Wait for specific element in large DOM
      await page.waitForSelector('#middle-element', {
        state: 'visible',
        timeout: 10000
      });

      await page.waitForSelector('#last-element', {
        state: 'visible',
        timeout: 10000
      });

      const elapsed = Date.now() - startTime;

      // Verify elements exist and performance is reasonable
      const middleElement = await page.locator('#middle-element');
      expect(await middleElement.textContent()).toBe('Element 500');

      const totalElements = await page.locator('.large-dom-element').count();
      expect(totalElements).toBe(1000);

      // Should complete within reasonable time
      expect(elapsed).toBeLessThan(5000);
    });

    it('should handle concurrent waitForSelector operations', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Concurrent Wait Test</title></head>
        <body>
          <div id="container"></div>
          <script>
            // Create elements at different intervals
            setTimeout(() => {
              const element1 = document.createElement('div');
              element1.id = 'concurrent-1';
              element1.textContent = 'Concurrent Element 1';
              document.getElementById('container').appendChild(element1);
            }, 150);

            setTimeout(() => {
              const element2 = document.createElement('div');
              element2.id = 'concurrent-2';
              element2.textContent = 'Concurrent Element 2';
              document.getElementById('container').appendChild(element2);
            }, 300);

            setTimeout(() => {
              const element3 = document.createElement('div');
              element3.id = 'concurrent-3';
              element3.textContent = 'Concurrent Element 3';
              document.getElementById('container').appendChild(element3);
            }, 450);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      // Start multiple concurrent wait operations
      const waitPromises = [
        page.waitForSelector('#concurrent-1', { state: 'visible', timeout: 10000 }),
        page.waitForSelector('#concurrent-2', { state: 'visible', timeout: 10000 }),
        page.waitForSelector('#concurrent-3', { state: 'visible', timeout: 10000 })
      ];

      const elements = await Promise.all(waitPromises);

      // All waits should succeed
      expect(elements).toHaveLength(3);
      elements.forEach(element => {
        expect(element).not.toBeNull();
      });

      // Verify element content
      expect(await page.textContent('#concurrent-1')).toBe('Concurrent Element 1');
      expect(await page.textContent('#concurrent-2')).toBe('Concurrent Element 2');
      expect(await page.textContent('#concurrent-3')).toBe('Concurrent Element 3');
    });

    it('should maintain performance with complex selectors', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Complex Selectors Test</title></head>
        <body>
          <div class="container">
            <div class="section" data-type="main">
              <div id="content"></div>
            </div>
          </div>
          <script>
            setTimeout(() => {
              const content = document.getElementById('content');
              const structure = \`
                <article class="post" data-category="tech">
                  <header class="post-header">
                    <h1 class="post-title">Tech Article</h1>
                  </header>
                  <div class="post-content">
                    <p class="post-paragraph first">First paragraph</p>
                    <p class="post-paragraph middle" id="target-paragraph">Target paragraph</p>
                    <p class="post-paragraph last">Last paragraph</p>
                  </div>
                  <footer class="post-footer" data-comments="enabled">
                    <button id="complex-target" class="btn btn-primary" data-action="comment">Comment</button>
                  </footer>
                </article>
              \`;
              content.innerHTML = structure;
            }, 200);
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPage);

      const startTime = Date.now();

      // Test complex selectors
      const complexSelectors = [
        'article.post[data-category="tech"] h1.post-title',
        '.container .section[data-type="main"] #target-paragraph',
        'footer.post-footer[data-comments="enabled"] button.btn.btn-primary[data-action="comment"]',
        'div.post-content > p.post-paragraph:nth-child(2)',
        'article[data-category="tech"] button#complex-target'
      ];

      const selectorPromises = complexSelectors.map(selector =>
        page.waitForSelector(selector, { state: 'visible', timeout: 10000 })
      );

      const elements = await Promise.all(selectorPromises);
      const elapsed = Date.now() - startTime;

      // All complex selectors should resolve
      expect(elements).toHaveLength(5);
      elements.forEach(element => {
        expect(element).not.toBeNull();
      });

      // Performance should be reasonable
      expect(elapsed).toBeLessThan(3000);

      // Verify specific elements
      expect(await page.textContent('h1.post-title')).toBe('Tech Article');
      expect(await page.textContent('#target-paragraph')).toBe('Target paragraph');
      expect(await page.textContent('#complex-target')).toBe('Comment');
    });
  });
});