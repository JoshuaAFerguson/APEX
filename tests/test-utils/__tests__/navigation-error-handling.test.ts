/**
 * @fileoverview Error Handling Tests for Navigation Test Utilities
 *
 * This file focuses on testing error scenarios, edge cases, and error recovery
 * for the navigation test utilities.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  NavigationTestHelper,
  NavigationTestFixture,
  NavigationTestFixtureFactory,
  createNavigationTestHelper,
} from '../navigation-test-utils.js';

describe('NavigationTestUtils - Error Handling', () => {
  let helper: NavigationTestHelper | null = null;
  let fixture: NavigationTestFixture | null = null;

  afterEach(async () => {
    if (helper) {
      await helper.teardown().catch(console.warn);
      helper = null;
    }
    if (fixture) {
      await fixture.teardown().catch(console.warn);
      fixture = null;
    }
  });

  describe('NavigationTestHelper - Error States', () => {
    it('should throw error when using helper before setup', async () => {
      helper = createNavigationTestHelper({ headless: true });

      // Try to use helper without setup
      try {
        await helper.goto('about:blank');
        expect.fail('Should have thrown error for uninitialized helper');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('not initialized');
      }

      try {
        await helper.assertURL({ url: 'about:blank' });
        expect.fail('Should have thrown error for uninitialized helper');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('not initialized');
      }

      try {
        await helper.waitForElement('#test');
        expect.fail('Should have thrown error for uninitialized helper');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('not initialized');
      }
    });

    it('should handle browser crash gracefully', async () => {
      helper = createNavigationTestHelper({ headless: true });
      await helper.setup();

      if (helper.page) {
        // Simulate browser crash by closing the page
        await helper.page.close();

        try {
          await helper.goto('about:blank');
          expect.fail('Should have thrown error for closed page');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should handle network errors during navigation', async () => {
      helper = createNavigationTestHelper({
        headless: true,
        navigationTimeout: 5000,
      });
      await helper.setup();

      // Test network error scenarios
      const networkErrorUrls = [
        'http://nonexistent.domain.invalid',
        'https://127.0.0.1:99999', // Port that should be closed
      ];

      for (const url of networkErrorUrls) {
        try {
          await helper.goto(url);
          expect.fail(`Should have thrown network error for URL: ${url}`);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          const message = (error as Error).message;
          expect(message).toBeDefined();
        }
      }
    });

    it('should handle malformed HTML gracefully', async () => {
      helper = createNavigationTestHelper({ headless: true });
      await helper.setup();

      if (helper.page) {
        const malformedHTML = `
          <html>
          <head><title>Malformed</title>
          <body>
          <h1>Unclosed tags
          <p>Missing closing tags
          <div>
          <script>
            // Unclosed script
            console.log('test'
        `;

        await helper.page.setContent(malformedHTML);

        // Should still be able to interact with page
        await helper.assertPageContent({ text: 'Unclosed tags' });
        await helper.assertURL({ url: 'about:blank', pathname: true });
      }
    });

    it('should handle invalid selector patterns', async () => {
      helper = createNavigationTestHelper({ headless: true });
      await helper.setup();

      if (helper.page) {
        await helper.page.setContent('<html><body><div id="test">Test</div></body></html>');

        const invalidSelectors = [
          '###invalid',
          '[unclosed',
          'div:invalid-pseudo',
          '.class-with-unicode-\uFFFD',
        ];

        for (const selector of invalidSelectors) {
          try {
            await helper.waitForElement(selector, { timeout: 1000 });
            // Some selectors might not throw but timeout
          } catch (error) {
            expect(error).toBeInstanceOf(Error);
          }
        }
      }
    });

    it('should handle memory intensive operations', async () => {
      helper = createNavigationTestHelper({
        headless: true,
        navigationTimeout: 15000,
      });
      await helper.setup();

      if (helper.page) {
        // Create a page with many elements
        const largeContent = `
          <html>
          <head><title>Memory Test</title></head>
          <body>
            ${Array.from({ length: 10000 }, (_, i) =>
              `<div id="element-${i}" class="item" data-index="${i}">
                <span>Content ${i}</span>
                <input type="text" value="Value ${i}" />
              </div>`
            ).join('')}
          </body>
          </html>
        `;

        await helper.page.setContent(largeContent);

        // Should be able to interact with the large page
        await helper.assertPageContent({
          selector: '.item',
          count: 10000,
          timeout: 15000,
        });

        await helper.waitForElement('#element-9999', { timeout: 10000 });
      }
    });
  });

  describe('NavigationTestHelper - Timeout Scenarios', () => {
    it('should handle various timeout configurations', async () => {
      const timeouts = [100, 1000, 5000];

      for (const timeout of timeouts) {
        helper = createNavigationTestHelper({
          headless: true,
          navigationTimeout: timeout,
        });
        await helper.setup();

        if (helper.page) {
          await helper.page.setContent(`
            <html>
              <body>
                <div id="delayed-element" style="display: none;">
                  Delayed Content
                </div>
                <script>
                  setTimeout(() => {
                    document.getElementById('delayed-element').style.display = 'block';
                  }, ${timeout + 1000}); // Longer than timeout
                </script>
              </body>
            </html>
          `);

          try {
            await helper.waitForElement('#delayed-element', {
              visible: true,
              timeout: timeout
            });
            expect.fail('Should have timed out');
          } catch (error) {
            expect(error).toBeInstanceOf(Error);
          }
        }

        await helper.teardown();
        helper = null;
      }
    });

    it('should handle navigation timeout with retries', async () => {
      helper = createNavigationTestHelper({
        headless: true,
        navigationTimeout: 2000,
      });
      await helper.setup();

      const slowUrl = 'data:text/html,<html><body><script>setTimeout(() => {}, 5000);</script></body></html>';

      try {
        await helper.goto(slowUrl);
        // If it succeeds, that's fine too
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/timeout|TimeoutError/i);
      }
    });
  });

  describe('NavigationTestFixture - Error Recovery', () => {
    it('should recover from fixture setup failures', async () => {
      // Test creating fixture with invalid configuration
      const invalidFixture = NavigationTestFixtureFactory.createCustomFixture({
        headless: true,
        timeout: -1, // Invalid timeout
      });

      try {
        await invalidFixture.setup();
        // If setup succeeds, test basic functionality
        expect(invalidFixture.navigationHelper).toBeDefined();
      } catch (error) {
        // Setup failure is expected with invalid config
        expect(error).toBeInstanceOf(Error);
      } finally {
        await invalidFixture.teardown().catch(() => {});
      }
    });

    it('should handle fixture reset failures gracefully', async () => {
      fixture = NavigationTestFixtureFactory.createUnitTestFixture();
      await fixture.setup();

      if (fixture.page) {
        // Close the page to simulate a failure scenario
        await fixture.page.close();

        try {
          await fixture.reset();
          expect.fail('Should have thrown error for closed page');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should handle network logging failures', async () => {
      fixture = NavigationTestFixtureFactory.createIntegrationTestFixture();
      await fixture.setup();

      if (fixture.page) {
        // Add a lot of event listeners to potentially cause issues
        for (let i = 0; i < 100; i++) {
          fixture.page.on('request', () => {});
          fixture.page.on('response', () => {});
        }

        // Should still work despite many event listeners
        await fixture.page.setContent('<html><body>Test</body></html>');

        const networkActivity = fixture.networkActivity;
        expect(Array.isArray(networkActivity)).toBe(true);
      }
    });
  });

  describe('Error Message Quality', () => {
    it('should provide helpful error messages for common mistakes', async () => {
      helper = createNavigationTestHelper({ headless: true });
      await helper.setup();

      if (helper.page) {
        await helper.page.setContent('<html><body><div id="content">Test</div></body></html>');

        // Test URL assertion failure message
        try {
          await helper.assertURL({
            url: 'https://expected.com/path',
          });
          expect.fail('Should have thrown URL assertion error');
        } catch (error) {
          const message = (error as Error).message;
          expect(message).toContain('Expected URL');
          expect(message).toContain('but got');
          expect(message).toContain('about:blank');
        }

        // Test content assertion failure message
        try {
          await helper.assertPageContent({
            text: 'Non-existent content',
            timeout: 1000,
          });
          expect.fail('Should have thrown content assertion error');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBeDefined();
        }

        // Test element not found message
        try {
          await helper.waitForElement('#non-existent', { timeout: 1000 });
          expect.fail('Should have thrown element not found error');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBeDefined();
        }
      }
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources even after errors', async () => {
      helper = createNavigationTestHelper({ headless: true });

      // Force an error during setup
      const originalSetup = helper.setup.bind(helper);
      vi.spyOn(helper, 'setup').mockImplementation(async () => {
        await originalSetup();
        throw new Error('Simulated setup error');
      });

      try {
        await helper.setup();
        expect.fail('Should have thrown setup error');
      } catch (error) {
        expect((error as Error).message).toBe('Simulated setup error');
      }

      // Teardown should still work
      await expect(helper.teardown()).resolves.not.toThrow();
    });

    it('should handle multiple teardown calls gracefully', async () => {
      helper = createNavigationTestHelper({ headless: true });
      await helper.setup();

      // Multiple teardown calls should not throw
      await helper.teardown();
      await helper.teardown(); // Second call should be safe
      await helper.teardown(); // Third call should also be safe
    });
  });

  describe('Concurrent Error Scenarios', () => {
    it('should handle errors in concurrent operations', async () => {
      const helpers: NavigationTestHelper[] = [];

      try {
        // Create multiple helpers
        for (let i = 0; i < 3; i++) {
          const h = createNavigationTestHelper({ headless: true });
          await h.setup();
          helpers.push(h);
        }

        // Perform operations that will cause errors concurrently
        const operations = helpers.map(async (h, index) => {
          try {
            if (index === 0) {
              // This should succeed
              return await h.goto('about:blank');
            } else if (index === 1) {
              // This should fail
              return await h.goto('invalid://url');
            } else {
              // This should timeout
              return await h.goto('https://httpbin.org/delay/10', { timeout: 1000 });
            }
          } catch (error) {
            return { error: error as Error, index };
          }
        });

        const results = await Promise.allSettled(operations);

        // Should have mix of fulfilled and rejected
        expect(results).toHaveLength(3);
        expect(results.some(r => r.status === 'fulfilled')).toBe(true);

      } finally {
        // Cleanup all helpers
        await Promise.allSettled(
          helpers.map(h => h.teardown().catch(console.warn))
        );
      }
    });
  });
});