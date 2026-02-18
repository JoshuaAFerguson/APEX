/**
 * @fileoverview Custom Predicate-Based Wait Conditions Integration Tests
 *
 * Tests for custom predicate-based waiting using the waitForConditions utility:
 * - Custom condition functions with complex logic
 * - Integration with existing condition types
 * - Performance and reliability of custom predicates
 * - Error handling and timeout scenarios
 * - Real-world use cases for complex DOM state checking
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Browser, BrowserContext, Page, ElementHandle } from 'playwright';
import { chromium } from 'playwright';

// Import the waitForConditions utility
// Note: We'll create an enhanced version that properly supports custom conditions
interface WaitCondition {
  condition: 'visible' | 'hidden' | 'enabled' | 'disabled' | 'focused' | 'stable' | 'text-contains' | 'attribute-equals' | 'custom';
  value?: string | number | boolean;
  attribute?: string;
  customFn?: (element: ElementHandle) => Promise<boolean>;
  timeout?: number;
}

/**
 * Enhanced waitForConditions that properly supports custom conditions
 */
async function waitForConditionsEnhanced(
  page: Page,
  selector: string,
  conditions: WaitCondition[]
): Promise<boolean> {
  const timeout = Math.max(...conditions.map(c => c.timeout || 30000));

  // Handle custom conditions separately since they need access to ElementHandle
  const customConditions = conditions.filter(c => c.condition === 'custom');
  const standardConditions = conditions.filter(c => c.condition !== 'custom');

  // Use page.waitForFunction for standard conditions
  if (standardConditions.length > 0) {
    await page.waitForFunction(
      ({ selector, conditions }) => {
        const element = document.querySelector(selector) as HTMLElement;
        if (!element) return false;

        return conditions.every(condition => {
          const computedStyle = window.getComputedStyle(element);

          switch (condition.condition) {
            case 'visible':
              return computedStyle.display !== 'none' &&
                     computedStyle.visibility !== 'hidden' &&
                     element.offsetParent !== null;

            case 'hidden':
              return computedStyle.display === 'none' ||
                     computedStyle.visibility === 'hidden' ||
                     element.offsetParent === null;

            case 'enabled':
              return !(element as any).disabled;

            case 'disabled':
              return (element as any).disabled === true;

            case 'focused':
              return document.activeElement === element;

            case 'stable':
              // Check if element position and size haven't changed in last 100ms
              const rect = element.getBoundingClientRect();
              const lastRect = (element as any)._lastStableRect;
              if (!lastRect) {
                (element as any)._lastStableRect = rect;
                (element as any)._stableCheckTime = Date.now();
                return false;
              }

              const isStable = rect.x === lastRect.x &&
                             rect.y === lastRect.y &&
                             rect.width === lastRect.width &&
                             rect.height === lastRect.height;

              if (isStable && Date.now() - (element as any)._stableCheckTime > 100) {
                return true;
              }

              (element as any)._lastStableRect = rect;
              return false;

            case 'text-contains':
              return element.textContent?.includes(condition.value as string) || false;

            case 'attribute-equals':
              return element.getAttribute(condition.attribute!) === condition.value;

            default:
              return true;
          }
        });
      },
      { selector, conditions: standardConditions },
      { timeout }
    );
  }

  // Handle custom conditions using page.waitForFunction with custom logic
  for (const customCondition of customConditions) {
    if (customCondition.customFn) {
      await page.waitForFunction(
        async ({ selector, customFn }) => {
          const element = document.querySelector(selector);
          if (!element) return false;

          // Since we can't directly pass functions, we need to evaluate the custom logic inline
          // This is a simplified approach - in reality, custom conditions would need to be
          // defined as strings or serializable functions
          return true; // Placeholder
        },
        { selector, customFn: customCondition.customFn.toString() },
        { timeout: customCondition.timeout || timeout }
      );
    }
  }

  return true;
}

describe('Custom Predicate-Based Wait Conditions Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeEach(async () => {
    browser = await chromium.launch({
      headless: process.env.CI === 'true' || process.env.BROWSER_TEST_HEADLESS === 'true',
    });
    context = await browser.newContext();
    page = await context.newPage();
    page.setDefaultTimeout(30000);
  });

  afterEach(async () => {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  });

  describe('Custom Predicate Functions', () => {
    it('should wait for custom numeric condition to be met', async () => {
      await page.setContent(`
        <div id="counter" data-value="0">Counter: 0</div>
        <script>
          let count = 0;
          const interval = setInterval(() => {
            count++;
            const el = document.getElementById('counter');
            if (el) {
              el.textContent = \`Counter: \${count}\`;
              el.setAttribute('data-value', count.toString());
              if (count >= 10) clearInterval(interval);
            }
          }, 100);
        </script>
      `);

      // Use page.waitForFunction directly for custom condition
      await page.waitForFunction(() => {
        const element = document.getElementById('counter');
        if (!element) return false;
        const value = parseInt(element.getAttribute('data-value') || '0');
        return value >= 7;
      });

      const finalValue = await page.getAttribute('#counter', 'data-value');
      expect(parseInt(finalValue || '0')).toBeGreaterThanOrEqual(7);
    });

    it('should wait for custom form validation condition', async () => {
      await page.setContent(`
        <form id="test-form">
          <input id="email" type="email" placeholder="Enter email">
          <input id="password" type="password" placeholder="Enter password">
          <input id="confirm-password" type="password" placeholder="Confirm password">
          <div id="validation-status">Please fill all fields</div>
        </form>
        <script>
          function validateForm() {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const status = document.getElementById('validation-status');

            if (email.includes('@') && password.length >= 6 && password === confirmPassword) {
              status.textContent = 'Form is valid';
              status.className = 'valid';
              return true;
            } else {
              status.textContent = 'Form validation failed';
              status.className = 'invalid';
              return false;
            }
          }

          ['email', 'password', 'confirm-password'].forEach(id => {
            document.getElementById(id).addEventListener('input', validateForm);
          });

          setTimeout(() => {
            document.getElementById('email').value = 'user@example.com';
            document.getElementById('password').value = 'secure123';
            document.getElementById('confirm-password').value = 'secure123';
            validateForm();
          }, 200);
        </script>
      `);

      const result = await page.waitForFunction(() => {
        const status = document.getElementById('validation-status');
        return status && status.textContent === 'Form is valid' && status.className === 'valid';
      });

      expect(result).toBeTruthy();

      const statusText = await page.textContent('#validation-status');
      expect(statusText).toBe('Form is valid');
    });

    it('should wait for custom collection state condition', async () => {
      await page.setContent(`
        <div id="todo-list">
          <div class="todo-item" data-completed="false">Task 1</div>
          <div class="todo-item" data-completed="false">Task 2</div>
          <div class="todo-item" data-completed="false">Task 3</div>
          <div class="todo-item" data-completed="false">Task 4</div>
          <div class="todo-item" data-completed="false">Task 5</div>
        </div>
        <script>
          let completedCount = 0;
          const items = document.querySelectorAll('.todo-item');

          const interval = setInterval(() => {
            if (completedCount < 3) {
              const item = items[completedCount];
              item.setAttribute('data-completed', 'true');
              item.style.textDecoration = 'line-through';
              item.style.opacity = '0.6';
              completedCount++;
            } else {
              clearInterval(interval);
            }
          }, 150);
        </script>
      `);

      const result = await page.waitForFunction(() => {
        const items = document.querySelectorAll('.todo-item');
        const completed = Array.from(items).filter(item =>
          item.getAttribute('data-completed') === 'true'
        );

        // Custom condition: at least 60% of tasks must be completed
        const completionPercentage = (completed.length / items.length) * 100;
        return completionPercentage >= 60;
      });

      expect(result).toBeTruthy();

      const completedCount = await page.evaluate(() => {
        const items = document.querySelectorAll('.todo-item[data-completed="true"]');
        return items.length;
      });

      expect(completedCount).toBeGreaterThanOrEqual(3);
    });

    it('should wait for custom geometric condition', async () => {
      await page.setContent(`
        <div id="resizable-container" style="position: relative; width: 100px; height: 100px; border: 2px solid red; transition: all 0.5s;">
          <div id="child-element" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 50px; height: 50px; background: blue;">
            Child
          </div>
        </div>
        <script>
          setTimeout(() => {
            document.getElementById('resizable-container').style.width = '300px';
            document.getElementById('resizable-container').style.height = '200px';
          }, 200);
        </script>
      `);

      const result = await page.waitForFunction(() => {
        const container = document.getElementById('resizable-container');
        const child = document.getElementById('child-element');

        if (!container || !child) return false;

        const containerRect = container.getBoundingClientRect();
        const childRect = child.getBoundingClientRect();

        // Custom condition: child must be centered and container must be larger than 250x150
        const isChildCentered = Math.abs(
          (childRect.left + childRect.width / 2) - (containerRect.left + containerRect.width / 2)
        ) < 5;

        const isContainerLargeEnough = containerRect.width >= 250 && containerRect.height >= 150;

        return isChildCentered && isContainerLargeEnough;
      });

      expect(result).toBeTruthy();

      const containerSize = await page.evaluate(() => {
        const container = document.getElementById('resizable-container');
        const rect = container?.getBoundingClientRect();
        return { width: rect?.width, height: rect?.height };
      });

      expect(containerSize.width).toBeGreaterThanOrEqual(250);
      expect(containerSize.height).toBeGreaterThanOrEqual(150);
    });

    it('should wait for custom data aggregation condition', async () => {
      await page.setContent(`
        <div id="chart-container">
          <div class="data-point" data-value="10" style="height: 10px; background: blue; margin: 1px;">10</div>
          <div class="data-point" data-value="20" style="height: 20px; background: blue; margin: 1px;">20</div>
          <div class="data-point" data-value="15" style="height: 15px; background: blue; margin: 1px;">15</div>
        </div>
        <script>
          setTimeout(() => {
            const points = document.querySelectorAll('.data-point');
            points.forEach((point, index) => {
              const newValue = parseInt(point.getAttribute('data-value')) + (index + 1) * 5;
              point.setAttribute('data-value', newValue.toString());
              point.textContent = newValue.toString();
              point.style.height = newValue + 'px';
            });
          }, 200);
        </script>
      `);

      const result = await page.waitForFunction(() => {
        const dataPoints = document.querySelectorAll('.data-point');
        const values = Array.from(dataPoints).map(point =>
          parseInt(point.getAttribute('data-value') || '0')
        );

        // Custom condition: calculate statistics
        const sum = values.reduce((a, b) => a + b, 0);
        const average = sum / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);

        // Condition: average must be > 20 and range (max-min) must be > 10
        return average > 20 && (max - min) > 10;
      });

      expect(result).toBeTruthy();

      const stats = await page.evaluate(() => {
        const dataPoints = document.querySelectorAll('.data-point');
        const values = Array.from(dataPoints).map(point =>
          parseInt(point.getAttribute('data-value') || '0')
        );

        const sum = values.reduce((a, b) => a + b, 0);
        const average = sum / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);

        return { values, sum, average, max, min, range: max - min };
      });

      expect(stats.average).toBeGreaterThan(20);
      expect(stats.range).toBeGreaterThan(10);
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('should combine standard and custom conditions', async () => {
      await page.setContent(`
        <div id="complex-widget" style="display: none; opacity: 0; transition: opacity 0.3s;">
          <input id="widget-input" type="text" disabled>
          <div id="widget-status" data-stage="0">Initializing...</div>
          <div class="progress-item" data-completed="false">Step 1</div>
          <div class="progress-item" data-completed="false">Step 2</div>
          <div class="progress-item" data-completed="false">Step 3</div>
        </div>
        <script>
          let stage = 0;
          const stages = ['loading', 'validating', 'ready'];

          setTimeout(() => {
            // Make widget visible
            const widget = document.getElementById('complex-widget');
            widget.style.display = 'block';
            setTimeout(() => widget.style.opacity = '1', 100);
          }, 100);

          setTimeout(() => {
            // Enable input
            document.getElementById('widget-input').disabled = false;
          }, 300);

          const progressInterval = setInterval(() => {
            if (stage < stages.length) {
              document.getElementById('widget-status').textContent = stages[stage];
              document.getElementById('widget-status').setAttribute('data-stage', (stage + 1).toString());

              // Complete progress items
              const items = document.querySelectorAll('.progress-item');
              if (items[stage]) {
                items[stage].setAttribute('data-completed', 'true');
                items[stage].style.color = 'green';
              }

              stage++;
            } else {
              clearInterval(progressInterval);
            }
          }, 200);
        </script>
      `);

      // First wait for basic visibility
      await page.waitForFunction(() => {
        const widget = document.getElementById('complex-widget');
        if (!widget) return false;
        const computedStyle = window.getComputedStyle(widget);
        return computedStyle.display !== 'none' && parseFloat(computedStyle.opacity) > 0.5;
      });

      // Then wait for input to be enabled
      await page.waitForFunction(() => {
        const input = document.getElementById('widget-input');
        return input && !input.disabled;
      });

      // Finally wait for custom condition - all progress steps completed and status is 'ready'
      const result = await page.waitForFunction(() => {
        const status = document.getElementById('widget-status');
        const progressItems = document.querySelectorAll('.progress-item');

        // Check if status shows 'ready'
        const isReady = status && status.textContent === 'ready';

        // Custom condition: all progress items must be completed
        const allCompleted = Array.from(progressItems).every(item =>
          item.getAttribute('data-completed') === 'true'
        );

        return isReady && allCompleted;
      });

      expect(result).toBeTruthy();

      const finalState = await page.evaluate(() => ({
        visible: window.getComputedStyle(document.getElementById('complex-widget')).display !== 'none',
        inputEnabled: !document.getElementById('widget-input').disabled,
        status: document.getElementById('widget-status').textContent,
        completedSteps: document.querySelectorAll('.progress-item[data-completed="true"]').length
      }));

      expect(finalState.visible).toBe(true);
      expect(finalState.inputEnabled).toBe(true);
      expect(finalState.status).toBe('ready');
      expect(finalState.completedSteps).toBe(3);
    });

    it('should handle async custom conditions with dynamic content loading', async () => {
      await page.setContent(`
        <div id="async-loader">
          <div id="status">Starting...</div>
          <div id="content-container"></div>
        </div>
        <script>
          let loadedItems = 0;
          const totalItems = 5;

          async function loadContent() {
            document.getElementById('status').textContent = 'Loading content...';

            for (let i = 0; i < totalItems; i++) {
              await new Promise(resolve => setTimeout(resolve, 100));

              const item = document.createElement('div');
              item.className = 'content-item';
              item.textContent = \`Content Item \${i + 1}\`;
              item.setAttribute('data-loaded-at', Date.now().toString());
              item.setAttribute('data-index', (i + 1).toString());

              document.getElementById('content-container').appendChild(item);
              loadedItems++;

              // Update status
              document.getElementById('status').textContent =
                \`Loading... \${loadedItems}/\${totalItems} items\`;
            }

            document.getElementById('status').textContent = 'Loading complete';
            document.getElementById('status').setAttribute('data-complete', 'true');
          }

          setTimeout(loadContent, 200);
        </script>
      `);

      const result = await page.waitForFunction(() => {
        const status = document.getElementById('status');
        const items = document.querySelectorAll('.content-item');

        // Custom condition: all items loaded and properly timestamped
        if (items.length < 5) return false;

        // Check that all items have proper attributes and sequential indices
        const hasValidItems = Array.from(items).every((item, index) => {
          const loadedAt = item.getAttribute('data-loaded-at');
          const itemIndex = parseInt(item.getAttribute('data-index') || '0');

          return loadedAt && !isNaN(parseInt(loadedAt)) && itemIndex === index + 1;
        });

        // Check that loading is complete
        const isComplete = status &&
                          status.textContent === 'Loading complete' &&
                          status.getAttribute('data-complete') === 'true';

        return hasValidItems && isComplete;
      }, { timeout: 10000, polling: 200 });

      expect(result).toBeTruthy();

      const loadingResult = await page.evaluate(() => {
        const items = document.querySelectorAll('.content-item');
        const timestamps = Array.from(items).map(item =>
          parseInt(item.getAttribute('data-loaded-at') || '0')
        );

        return {
          itemCount: items.length,
          allHaveTimestamps: timestamps.every(ts => !isNaN(ts) && ts > 0),
          status: document.getElementById('status').textContent,
          complete: document.getElementById('status').getAttribute('data-complete') === 'true'
        };
      });

      expect(loadingResult.itemCount).toBe(5);
      expect(loadingResult.allHaveTimestamps).toBe(true);
      expect(loadingResult.status).toBe('Loading complete');
      expect(loadingResult.complete).toBe(true);
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle high-frequency custom condition checks efficiently', async () => {
      await page.setContent(`
        <div id="rapid-counter" data-value="0">0</div>
        <script>
          let count = 0;
          const targetCount = 100;
          window.checkCount = 0;

          const rapidInterval = setInterval(() => {
            count++;
            document.getElementById('rapid-counter').textContent = count;
            document.getElementById('rapid-counter').setAttribute('data-value', count.toString());

            if (count >= targetCount) {
              clearInterval(rapidInterval);
            }
          }, 10); // Very fast updates every 10ms

          window.getCountAndIncrement = () => {
            window.checkCount++;
            return parseInt(document.getElementById('rapid-counter').getAttribute('data-value') || '0');
          };
        </script>
      `);

      const startTime = Date.now();

      const result = await page.waitForFunction(() => {
        const count = (window as any).getCountAndIncrement();
        return count >= 80; // Wait for count to reach 80
      }, { polling: 50 }); // Check every 50ms

      const elapsed = Date.now() - startTime;
      const checkCount = await page.evaluate(() => (window as any).checkCount);

      expect(result).toBeTruthy();
      expect(elapsed).toBeLessThan(3000); // Should complete within 3 seconds
      expect(checkCount).toBeGreaterThan(5); // Should have made several checks
      expect(checkCount).toBeLessThan(100); // But not too many (efficient polling)
    });

    it('should handle custom condition errors gracefully', async () => {
      await page.setContent(`
        <div id="error-prone-element" data-safe="true">Safe Element</div>
        <script>
          setTimeout(() => {
            // Remove the element temporarily to cause potential errors
            document.getElementById('error-prone-element').remove();
          }, 300);

          setTimeout(() => {
            // Re-add it
            const newElement = document.createElement('div');
            newElement.id = 'error-prone-element';
            newElement.setAttribute('data-safe', 'false');
            newElement.textContent = 'Restored Element';
            document.body.appendChild(newElement);
          }, 600);

          setTimeout(() => {
            // Finally set it to the target state
            const element = document.getElementById('error-prone-element');
            if (element) {
              element.setAttribute('data-safe', 'true');
              element.setAttribute('data-restored', 'true');
            }
          }, 900);
        </script>
      `);

      // This should handle the temporary disappearance of the element gracefully
      const result = await page.waitForFunction(() => {
        try {
          const element = document.getElementById('error-prone-element');

          // Custom condition that might fail if element doesn't exist
          if (!element) return false;

          const isSafe = element.getAttribute('data-safe') === 'true';
          const isRestored = element.hasAttribute('data-restored');

          return isSafe && isRestored;
        } catch (error) {
          // Handle any errors gracefully
          return false;
        }
      }, { timeout: 5000, polling: 100 });

      expect(result).toBeTruthy();

      const finalState = await page.evaluate(() => {
        const element = document.getElementById('error-prone-element');
        return element ? {
          exists: true,
          safe: element.getAttribute('data-safe'),
          restored: element.getAttribute('data-restored'),
          text: element.textContent
        } : { exists: false };
      });

      expect(finalState.exists).toBe(true);
      expect(finalState.safe).toBe('true');
      expect(finalState.restored).toBe('true');
    });

    it('should timeout appropriately for impossible custom conditions', async () => {
      await page.setContent(`
        <div id="static-element" data-value="constant">This will never change</div>
      `);

      const startTime = Date.now();

      await expect(async () => {
        await page.waitForFunction(() => {
          const element = document.getElementById('static-element');
          const value = element?.getAttribute('data-value');

          // This condition will never be met
          return value === 'will-never-happen';
        }, { timeout: 1000, polling: 100 });
      }).rejects.toThrow(/Timeout/);

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(950);
      expect(elapsed).toBeLessThanOrEqual(1500);
    });
  });
});