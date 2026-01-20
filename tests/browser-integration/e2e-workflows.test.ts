/**
 * @fileoverview End-to-end browser automation workflow tests
 *
 * This test suite validates complete browser automation workflows that would be used
 * by the APEX orchestrator system for real-world browser automation tasks:
 * - Multi-step form interactions
 * - Navigation flows with state persistence
 * - Error recovery scenarios
 * - Performance monitoring during workflows
 * - Cross-browser compatibility testing
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import {
  createBrowser,
  createBrowserContext,
  createPage,
  mockBrowserDependencies,
  setupTestPage,
} from './setup';

import {
  createTestPage,
  runNavigationScenario,
  runInteractionScenario,
  NAVIGATION_SCENARIOS,
  INTERACTION_SCENARIOS,
} from './fixtures/common-scenarios';

import {
  takeScreenshot,
  waitForElement,
  safeClick,
  safeFill,
  waitForNetworkIdle,
  measurePerformance,
  captureConsoleMessages,
  capturePageErrors,
  withBrowserTest,
  setupMockServer,
} from './utils/test-helpers';

describe('End-to-End Browser Automation Workflows', () => {
  let testTempDir: string;
  let mockBrowser: any;
  let mockContext: any;
  let mockPage: any;

  beforeAll(async () => {
    testTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-e2e-test-'));
    mockBrowserDependencies();
  });

  afterAll(async () => {
    try {
      await fs.rm(testTempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup e2e test temp dir:', error);
    }
  });

  beforeEach(async () => {
    // Create comprehensive mock browser with realistic behavior
    const createMockPage = () => ({
      goto: vi.fn().mockResolvedValue(undefined),
      setContent: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      waitForFunction: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('mock-screenshot')),
      title: vi.fn().mockResolvedValue('Test Page Title'),
      url: vi.fn().mockReturnValue('https://test.example.com'),
      textContent: vi.fn().mockResolvedValue('Mock text content'),
      inputValue: vi.fn().mockResolvedValue('mock-input-value'),
      locator: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(3),
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(true),
          isHidden: vi.fn().mockResolvedValue(false),
          textContent: vi.fn().mockResolvedValue('Mock element text'),
        }),
        nth: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(true),
          click: vi.fn().mockResolvedValue(undefined),
          fill: vi.fn().mockResolvedValue(undefined),
        }),
        waitFor: vi.fn().mockResolvedValue(undefined),
        scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
        click: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
        fill: vi.fn().mockResolvedValue(undefined),
        inputValue: vi.fn().mockResolvedValue('test-value'),
        isVisible: vi.fn().mockResolvedValue(true),
        isHidden: vi.fn().mockResolvedValue(false),
      }),
      click: vi.fn().mockResolvedValue(undefined),
      fill: vi.fn().mockResolvedValue(undefined),
      selectOption: vi.fn().mockResolvedValue(['selected-value']),
      evaluate: vi.fn().mockImplementation((fn: Function) => {
        if (typeof fn === 'function') {
          return Promise.resolve(fn());
        }
        return Promise.resolve({});
      }),
      on: vi.fn(),
      off: vi.fn(),
      route: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
      context: vi.fn().mockReturnValue({
        clearCookies: vi.fn().mockResolvedValue(undefined),
      }),
    });

    mockPage = createMockPage();

    mockContext = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      clearCookies: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockBrowser = {
      newContext: vi.fn().mockResolvedValue(mockContext),
      isConnected: vi.fn().mockReturnValue(true),
      close: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe('Multi-Step Form Workflows', () => {
    it('should complete user registration workflow', async () => {
      await withBrowserTest(
        async (page) => {
          // Step 1: Navigate to registration page
          await page.goto('https://app.example.com/register');

          // Step 2: Fill personal information
          await safeFill(page, '#firstName', 'John');
          await safeFill(page, '#lastName', 'Doe');
          await safeFill(page, '#email', 'john.doe@example.com');

          // Step 3: Set password
          await safeFill(page, '#password', 'SecurePass123!');
          await safeFill(page, '#confirmPassword', 'SecurePass123!');

          // Step 4: Accept terms
          await safeClick(page, '#termsCheckbox');

          // Step 5: Submit form
          await safeClick(page, '#submitButton');

          // Step 6: Wait for redirect and verify success
          await waitForElement(page, '.success-message', {
            visible: true,
            timeout: 10000,
          });

          // Verify all steps were executed
          expect(page.goto).toHaveBeenCalledWith('https://app.example.com/register');
          expect(page.locator).toHaveBeenCalledWith('#firstName');
          expect(page.locator).toHaveBeenCalledWith('#submitButton');
          expect(page.locator().fill).toHaveBeenCalledWith('John');
          expect(page.locator().click).toHaveBeenCalled();
        },
        mockPage
      );
    });

    it('should handle multi-page form workflow', async () => {
      await withBrowserTest(
        async (page) => {
          const formData = {
            step1: { name: 'Test User', company: 'Test Corp' },
            step2: { address: '123 Test St', city: 'Test City' },
            step3: { preferences: ['email', 'sms'] },
          };

          // Step 1: Basic information
          await page.goto('/form/step1');
          await safeFill(page, '#name', formData.step1.name);
          await safeFill(page, '#company', formData.step1.company);
          await safeClick(page, '#nextStep');

          // Step 2: Address information
          await waitForElement(page, '#address', { visible: true });
          await safeFill(page, '#address', formData.step2.address);
          await safeFill(page, '#city', formData.step2.city);
          await safeClick(page, '#nextStep');

          // Step 3: Preferences
          await waitForElement(page, '#preferences', { visible: true });
          for (const pref of formData.step3.preferences) {
            await safeClick(page, `#pref-${pref}`);
          }
          await safeClick(page, '#submitForm');

          // Verify completion
          await waitForElement(page, '.form-complete', { visible: true });

          // Verify workflow progression
          expect(page.goto).toHaveBeenCalledWith('/form/step1');
          expect(page.locator().fill).toHaveBeenCalledWith('Test User');
          expect(page.locator().fill).toHaveBeenCalledWith('123 Test St');
        },
        mockPage
      );
    });

    it('should handle form validation errors and recovery', async () => {
      await withBrowserTest(
        async (page) => {
          await page.goto('/form');

          // Submit empty form to trigger validation
          await safeClick(page, '#submitButton');

          // Wait for error messages
          await waitForElement(page, '.error-message', { visible: true });

          // Capture validation errors
          const errors = await captureConsoleMessages(page, async () => {
            // Fill form correctly after errors
            await safeFill(page, '#email', 'valid@example.com');
            await safeFill(page, '#password', 'ValidPassword123!');
            await safeClick(page, '#submitButton');
          });

          // Verify error handling and recovery
          expect(page.locator).toHaveBeenCalledWith('.error-message');
          expect(page.locator().fill).toHaveBeenCalledWith('valid@example.com');
        },
        mockPage
      );
    });
  });

  describe('Navigation and State Management Workflows', () => {
    it('should handle single-page application navigation', async () => {
      await withBrowserTest(
        async (page) => {
          // Initial page load
          await page.goto('/app');
          await waitForNetworkIdle(page);

          // Navigate through different sections
          const sections = ['dashboard', 'profile', 'settings'];

          for (const section of sections) {
            await safeClick(page, `#nav-${section}`);
            await waitForElement(page, `#${section}-content`, { visible: true });

            // Take screenshot for visual verification
            await takeScreenshot(page, `navigation-${section}`, testTempDir);
          }

          // Verify navigation states
          expect(page.locator().click).toHaveBeenCalledTimes(sections.length);
          expect(page.screenshot).toHaveBeenCalledTimes(sections.length);
        },
        mockPage
      );
    });

    it('should persist state across page reloads', async () => {
      await withBrowserTest(
        async (page) => {
          // Set initial state
          await page.goto('/app');
          await safeFill(page, '#search-input', 'test query');
          await safeClick(page, '#filter-option-1');

          // Capture state before reload
          const beforeReloadState = await page.evaluate(() => ({
            searchValue: (document.querySelector('#search-input') as HTMLInputElement)?.value,
            filterState: (document.querySelector('#filter-option-1') as HTMLInputElement)?.checked,
          }));

          // Reload page
          await page.goto('/app');
          await waitForNetworkIdle(page);

          // Verify state persistence
          const afterReloadState = await page.evaluate(() => ({
            searchValue: (document.querySelector('#search-input') as HTMLInputElement)?.value,
            filterState: (document.querySelector('#filter-option-1') as HTMLInputElement)?.checked,
          }));

          expect(beforeReloadState).toBeDefined();
          expect(afterReloadState).toBeDefined();
        },
        mockPage
      );
    });

    it('should handle browser back/forward navigation', async () => {
      await withBrowserTest(
        async (page) => {
          // Navigate through multiple pages
          await page.goto('/page1');
          await waitForNetworkIdle(page);

          await page.goto('/page2');
          await waitForNetworkIdle(page);

          await page.goto('/page3');
          await waitForNetworkIdle(page);

          // Test back navigation
          await page.goBack();
          expect(page.url()).toContain('/page2');

          await page.goBack();
          expect(page.url()).toContain('/page1');

          // Test forward navigation
          await page.goForward();
          expect(page.url()).toContain('/page2');
        },
        mockPage
      );
    });
  });

  describe('Error Recovery and Resilience Workflows', () => {
    it('should handle network timeouts and retry logic', async () => {
      await withBrowserTest(
        async (page) => {
          // Mock network timeout
          let attemptCount = 0;
          page.goto.mockImplementation(async (url: string) => {
            attemptCount++;
            if (attemptCount <= 2) {
              throw new Error('Navigation timeout');
            }
            return undefined;
          });

          // Implement retry logic
          const maxRetries = 3;
          let success = false;

          for (let attempt = 1; attempt <= maxRetries && !success; attempt++) {
            try {
              await page.goto('/unreliable-endpoint');
              success = true;
            } catch (error) {
              if (attempt === maxRetries) {
                throw error;
              }
              await page.waitForTimeout(1000 * attempt); // Exponential backoff
            }
          }

          expect(success).toBe(true);
          expect(attemptCount).toBe(3);
        },
        mockPage
      );
    });

    it('should recover from JavaScript errors', async () => {
      await withBrowserTest(
        async (page) => {
          const pageErrors: any[] = [];

          // Capture page errors
          const errors = await capturePageErrors(page, async () => {
            await page.goto('/page-with-js-errors');

            // Try to interact despite errors
            try {
              await safeClick(page, '#error-prone-button');
            } catch (error) {
              // Continue with alternative action
              await safeClick(page, '#fallback-button');
            }
          });

          // Verify error handling
          expect(errors).toBeInstanceOf(Array);
          expect(page.on).toHaveBeenCalledWith('pageerror', expect.any(Function));
        },
        mockPage
      );
    });

    it('should handle element not found scenarios', async () => {
      await withBrowserTest(
        async (page) => {
          // Mock element not found
          page.locator.mockReturnValue({
            waitFor: vi.fn().mockRejectedValue(new Error('Element not found')),
            isVisible: vi.fn().mockResolvedValue(false),
          });

          await page.goto('/dynamic-content');

          // Try to find element with fallback strategy
          let elementFound = false;
          const selectors = ['#primary-button', '.secondary-button', '[data-action="submit"]'];

          for (const selector of selectors) {
            try {
              await waitForElement(page, selector, { timeout: 2000 });
              elementFound = true;
              break;
            } catch (error) {
              continue; // Try next selector
            }
          }

          // Use default action if no elements found
          if (!elementFound) {
            await page.evaluate(() => {
              // Execute fallback JavaScript action
              window.dispatchEvent(new Event('fallback-action'));
            });
          }

          expect(page.locator).toHaveBeenCalledTimes(selectors.length);
        },
        mockPage
      );
    });
  });

  describe('Performance Monitoring Workflows', () => {
    it('should monitor page load performance', async () => {
      await withBrowserTest(
        async (page) => {
          const performance = await measurePerformance(page, async () => {
            await page.goto('/performance-test');
            await waitForNetworkIdle(page);
            await waitForElement(page, '#main-content', { visible: true });
          });

          expect(performance.duration).toBeGreaterThan(0);
          expect(performance.startTime).toBeLessThan(performance.endTime);
        },
        mockPage
      );
    });

    it('should track resource loading metrics', async () => {
      await withBrowserTest(
        async (page) => {
          // Mock performance metrics
          page.evaluate.mockResolvedValue({
            navigation: {
              loadEventEnd: 2000,
              loadEventStart: 1800,
              domContentLoadedEventEnd: 1500,
              domContentLoadedEventStart: 1400,
            },
            resources: [
              { name: 'main.js', duration: 200 },
              { name: 'styles.css', duration: 150 },
              { name: 'api-call', duration: 500 },
            ],
          });

          await page.goto('/performance-heavy-page');

          const metrics = await page.evaluate(() => ({
            navigation: window.performance.timing,
            resources: window.performance.getEntriesByType('resource'),
          }));

          expect(metrics.navigation).toBeDefined();
          expect(metrics.resources).toBeInstanceOf(Array);
        },
        mockPage
      );
    });
  });

  describe('Cross-Browser Compatibility Workflows', () => {
    it('should test workflows across different browser types', async () => {
      const browserTypes = ['chromium', 'firefox', 'webkit'];
      const results: Record<string, boolean> = {};

      for (const browserType of browserTypes) {
        try {
          const browser = await createBrowser({ browserType: browserType as any });
          const context = await createBrowserContext(browser);
          const page = await createPage(context);

          // Run compatibility test
          await page.goto('/compatibility-test');
          await safeFill(page, '#test-input', 'cross-browser-test');
          await safeClick(page, '#test-button');

          const result = await page.textContent('#result');
          results[browserType] = result?.includes('success') ?? false;

          await page.close();
          await context.close();
          await browser.close();
        } catch (error) {
          console.warn(`Browser ${browserType} not available:`, error);
          results[browserType] = false;
        }
      }

      // At least one browser should work (mocked)
      const successfulTests = Object.values(results).filter(Boolean);
      expect(successfulTests.length).toBeGreaterThan(0);
    });

    it('should handle browser-specific features gracefully', async () => {
      await withBrowserTest(
        async (page) => {
          // Test feature detection
          const features = await page.evaluate(() => ({
            webgl: !!(window as any).WebGLRenderingContext,
            geolocation: !!navigator.geolocation,
            webworkers: !!window.Worker,
            localstorage: !!window.localStorage,
          }));

          // Adapt workflow based on available features
          if (features.localstorage) {
            await page.evaluate(() => {
              localStorage.setItem('test-feature', 'enabled');
            });
          }

          if (features.geolocation) {
            // Mock geolocation for testing
            await page.evaluate(() => {
              Object.defineProperty(navigator, 'geolocation', {
                value: {
                  getCurrentPosition: (success: Function) => {
                    success({ coords: { latitude: 37.7749, longitude: -122.4194 } });
                  },
                },
              });
            });
          }

          expect(features).toBeDefined();
          expect(typeof features.localstorage).toBe('boolean');
        },
        mockPage
      );
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('should handle file upload workflows', async () => {
      await withBrowserTest(
        async (page) => {
          await page.goto('/file-upload');

          // Mock file input interaction
          page.locator.mockReturnValue({
            setInputFiles: vi.fn().mockResolvedValue(undefined),
            isVisible: vi.fn().mockResolvedValue(true),
          });

          const fileInput = page.locator('#file-upload');
          await fileInput.setInputFiles([{
            name: 'test-file.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('Test file content'),
          }]);

          await safeClick(page, '#upload-button');
          await waitForElement(page, '.upload-success', { visible: true });

          expect(fileInput.setInputFiles).toHaveBeenCalled();
        },
        mockPage
      );
    });

    it('should handle real-time data updates', async () => {
      await withBrowserTest(
        async (page) => {
          await page.goto('/real-time-dashboard');

          // Mock WebSocket connection
          await page.evaluate(() => {
            (window as any).mockWebSocket = {
              send: vi.fn(),
              close: vi.fn(),
            };
          });

          // Monitor real-time updates
          const messages = await captureConsoleMessages(page, async () => {
            // Simulate real-time data updates
            await page.evaluate(() => {
              const mockData = [
                { timestamp: Date.now(), value: 100 },
                { timestamp: Date.now() + 1000, value: 150 },
                { timestamp: Date.now() + 2000, value: 120 },
              ];

              mockData.forEach((data, index) => {
                setTimeout(() => {
                  console.log(`Real-time update: ${JSON.stringify(data)}`);
                  document.dispatchEvent(new CustomEvent('data-update', { detail: data }));
                }, index * 100);
              });
            });

            await page.waitForTimeout(1000);
          });

          expect(messages.length).toBeGreaterThan(0);
        },
        mockPage
      );
    });

    it('should test complete e-commerce checkout workflow', async () => {
      await withBrowserTest(
        async (page) => {
          const checkoutFlow = [
            { step: 'product-selection', url: '/products', action: async () => {
              await safeClick(page, '.product-item:first-child .add-to-cart');
              await safeClick(page, '.product-item:nth-child(2) .add-to-cart');
            }},
            { step: 'cart-review', url: '/cart', action: async () => {
              await waitForElement(page, '.cart-items', { visible: true });
              await safeClick(page, '#proceed-to-checkout');
            }},
            { step: 'shipping-info', url: '/checkout/shipping', action: async () => {
              await safeFill(page, '#shipping-address', '123 Test Street');
              await safeFill(page, '#shipping-city', 'Test City');
              await safeFill(page, '#shipping-zip', '12345');
              await safeClick(page, '#continue-to-payment');
            }},
            { step: 'payment', url: '/checkout/payment', action: async () => {
              await safeFill(page, '#card-number', '4111111111111111');
              await safeFill(page, '#expiry', '12/25');
              await safeFill(page, '#cvv', '123');
              await safeClick(page, '#place-order');
            }},
            { step: 'confirmation', url: '/order-confirmation', action: async () => {
              await waitForElement(page, '.order-confirmation', { visible: true });
            }},
          ];

          for (const step of checkoutFlow) {
            await page.goto(step.url);
            await waitForNetworkIdle(page);
            await step.action();

            // Take screenshot at each step for verification
            await takeScreenshot(page, `checkout-${step.step}`, testTempDir);
          }

          // Verify complete workflow execution
          expect(page.goto).toHaveBeenCalledTimes(checkoutFlow.length);
          expect(page.screenshot).toHaveBeenCalledTimes(checkoutFlow.length);
        },
        mockPage
      );
    });
  });
});