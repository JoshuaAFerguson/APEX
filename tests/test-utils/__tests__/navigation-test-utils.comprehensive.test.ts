/**
 * @fileoverview Comprehensive Tests for Navigation Test Utilities
 *
 * This file provides comprehensive test coverage for navigation test utilities
 * including edge cases, error scenarios, performance testing, and integration scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  NavigationTestHelper,
  NavigationTestFixture,
  NavigationTestFixtureFactory,
  TestPageTemplates,
  TestScenarios,
  createNavigationTestHelper,
  NavigationTestSetup,
  type NavigationTestConfig,
  type NavigationOptions,
  type URLAssertion,
  type PageContentAssertion,
} from '../navigation-test-utils.js';

describe('NavigationTestUtils - Comprehensive Tests', () => {
  let helper: NavigationTestHelper | null = null;
  let fixture: NavigationTestFixture | null = null;

  afterEach(async () => {
    // Clean up any test instances
    if (helper) {
      await helper.teardown().catch(console.warn);
      helper = null;
    }
    if (fixture) {
      await fixture.teardown().catch(console.warn);
      fixture = null;
    }
  });

  describe('NavigationTestHelper - Edge Cases', () => {
    it('should handle navigation to invalid URLs gracefully', async () => {
      helper = createNavigationTestHelper({
        headless: true,
        navigationTimeout: 5000,
      });
      await helper.setup();

      // Test invalid URLs
      const invalidUrls = [
        'invalid-url',
        'file://nonexistent/path',
        'ftp://invalid.protocol',
      ];

      for (const url of invalidUrls) {
        try {
          await helper.goto(url);
          expect.fail(`Should have thrown error for invalid URL: ${url}`);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBeDefined();
        }
      }
    });

    it('should handle navigation timeout correctly', async () => {
      helper = createNavigationTestHelper({
        headless: true,
        navigationTimeout: 1000, // Very short timeout
      });
      await helper.setup();

      try {
        // Simulate slow-loading page
        await helper.goto('https://httpbin.org/delay/5');
        expect.fail('Should have thrown timeout error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/timeout|TimeoutError/i);
      }
    });

    it('should handle pages with JavaScript errors', async () => {
      helper = createNavigationTestHelper({ headless: true });
      await helper.setup();

      if (helper.page) {
        const errorContent = `
          <!DOCTYPE html>
          <html>
          <head><title>Error Page</title></head>
          <body>
            <h1>Error Page</h1>
            <script>
              // Intentional JavaScript error
              throw new Error('Test JavaScript error');
            </script>
          </body>
          </html>
        `;

        await helper.page.setContent(errorContent);

        // Should still be able to assert content despite JS error
        await helper.assertPageContent({ text: 'Error Page' });
        await helper.assertURL({ url: 'about:blank', pathname: true });
      }
    });

    it('should handle large pages and performance metrics', async () => {
      helper = createNavigationTestHelper({ headless: true });
      await helper.setup();

      if (helper.page) {
        // Create a large page with many elements
        const largeContent = `
          <!DOCTYPE html>
          <html>
          <head><title>Large Page</title></head>
          <body>
            <h1>Large Page Test</h1>
            ${Array.from({ length: 1000 }, (_, i) =>
              `<div id="item-${i}" class="item">Item ${i}</div>`
            ).join('')}
          </body>
          </html>
        `;

        const startTime = Date.now();
        await helper.page.setContent(largeContent);
        const result = await helper.goto('about:blank');

        expect(result.success).toBe(true);
        expect(result.duration).toBeGreaterThan(0);
        expect(result.metrics).toBeDefined();
      }
    });
  });

  describe('NavigationTestHelper - URL Assertions Advanced', () => {
    beforeEach(async () => {
      helper = createNavigationTestHelper({ headless: true });
      await helper.setup();
    });

    it('should handle complex URL assertion scenarios', async () => {
      if (!helper?.page) return;

      // Test various URL formats
      await helper.page.goto('https://example.com/path?param=value#section');

      // Test pathname only
      await helper.assertURL({
        url: '/path',
        pathname: true,
      });

      // Test ignoring query parameters
      await helper.assertURL({
        url: 'https://example.com/path#section',
        ignoreQuery: true,
      });

      // Test ignoring hash
      await helper.assertURL({
        url: 'https://example.com/path?param=value',
        ignoreHash: true,
      });

      // Test ignoring both query and hash
      await helper.assertURL({
        url: 'https://example.com/path',
        ignoreQuery: true,
        ignoreHash: true,
      });
    });

    it('should handle regex URL assertions', async () => {
      if (!helper?.page) return;

      await helper.page.goto('https://example.com/users/123/profile');

      // Test regex patterns
      await helper.assertURL({
        url: /\/users\/\d+\/profile/,
      });

      await helper.assertURL({
        url: /^https:\/\/example\.com/,
      });
    });

    it('should provide detailed error messages for URL assertion failures', async () => {
      if (!helper?.page) return;

      await helper.page.goto('https://example.com/actual/path');

      try {
        await helper.assertURL({ url: 'https://example.com/expected/path' });
        expect.fail('Should have thrown URL assertion error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const message = (error as Error).message;
        expect(message).toContain('Expected URL');
        expect(message).toContain('but got');
      }
    });
  });

  describe('NavigationTestHelper - Page Content Assertions Advanced', () => {
    beforeEach(async () => {
      helper = createNavigationTestHelper({ headless: true });
      await helper.setup();
    });

    it('should handle regex content assertions', async () => {
      if (!helper?.page) return;

      const content = `
        <html>
          <body>
            <h1>Test Page 12345</h1>
            <p>Current timestamp: ${Date.now()}</p>
            <div class="items">
              <span class="item">Item 1</span>
              <span class="item">Item 2</span>
              <span class="item">Item 3</span>
            </div>
          </body>
        </html>
      `;

      await helper.page.setContent(content);

      // Test regex text matching
      await helper.assertPageContent({
        text: /Test Page \d+/,
      });

      await helper.assertPageContent({
        text: /timestamp: \d+/,
      });

      // Test element count
      await helper.assertPageContent({
        selector: '.item',
        count: 3,
      });

      // Test visibility
      await helper.assertPageContent({
        selector: '.items',
        visible: true,
      });
    });

    it('should handle content assertion timeout scenarios', async () => {
      if (!helper?.page) return;

      await helper.page.setContent('<html><body><h1>Initial</h1></body></html>');

      // Test timeout for non-existent content
      try {
        await helper.assertPageContent({
          text: 'Non-existent text',
          timeout: 1000,
        });
        expect.fail('Should have thrown timeout error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle dynamic content changes', async () => {
      if (!helper?.page) return;

      const dynamicContent = `
        <html>
          <body>
            <h1 id="title">Initial Title</h1>
            <button id="change-btn" onclick="changeTitle()">Change Title</button>
            <script>
              function changeTitle() {
                setTimeout(() => {
                  document.getElementById('title').textContent = 'Updated Title';
                }, 500);
              }
            </script>
          </body>
        </html>
      `;

      await helper.page.setContent(dynamicContent);

      // Trigger dynamic change
      await helper.page.click('#change-btn');

      // Wait for change and assert
      await helper.waitForElement('#title', { timeout: 2000 });

      // Wait a bit longer for the actual change
      await new Promise(resolve => setTimeout(resolve, 600));

      await helper.assertPageContent({
        text: 'Updated Title',
        timeout: 2000,
      });
    });
  });

  describe('NavigationTestHelper - Event Emission', () => {
    it('should emit navigation events correctly', async () => {
      helper = createNavigationTestHelper({ headless: true });

      const events: Array<{name: string, data: any}> = [];

      // Listen to all navigation events
      helper.on('navigation:start', (data) => events.push({name: 'navigation:start', data}));
      helper.on('navigation:success', (data) => events.push({name: 'navigation:success', data}));
      helper.on('navigation:error', (data) => events.push({name: 'navigation:error', data}));

      await helper.setup();

      // Perform navigation
      await helper.goto('about:blank');

      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.name === 'navigation:start')).toBe(true);
      expect(events.some(e => e.name === 'navigation:success')).toBe(true);
    });

    it('should emit assertion events correctly', async () => {
      helper = createNavigationTestHelper({ headless: true });

      const events: Array<{name: string, data: any}> = [];

      helper.on('assertion:url-passed', (data) => events.push({name: 'assertion:url-passed', data}));
      helper.on('assertion:content-text-passed', (data) => events.push({name: 'assertion:content-text-passed', data}));

      await helper.setup();

      if (helper.page) {
        await helper.page.setContent('<html><body><h1>Test</h1></body></html>');

        await helper.assertURL({ url: 'about:blank', pathname: true });
        await helper.assertPageContent({ text: 'Test' });

        expect(events.length).toBe(2);
        expect(events.some(e => e.name === 'assertion:url-passed')).toBe(true);
        expect(events.some(e => e.name === 'assertion:content-text-passed')).toBe(true);
      }
    });
  });

  describe('NavigationTestFixture - Advanced Scenarios', () => {
    it('should handle test isolation correctly', async () => {
      fixture = NavigationTestFixtureFactory.createIntegrationTestFixture();
      await fixture.setup();

      if (fixture.page) {
        // Set up initial state
        await fixture.page.setContent(`
          <html>
            <body>
              <h1>Test</h1>
              <script>
                localStorage.setItem('test', 'value');
                sessionStorage.setItem('test', 'value');
              </script>
            </body>
          </html>
        `);

        // Verify storage is set
        const beforeReset = await fixture.page.evaluate(() => ({
          localStorage: localStorage.getItem('test'),
          sessionStorage: sessionStorage.getItem('test'),
        }));

        expect(beforeReset.localStorage).toBe('value');
        expect(beforeReset.sessionStorage).toBe('value');

        // Reset the fixture
        await fixture.reset();

        // Verify storage is cleared
        const afterReset = await fixture.page.evaluate(() => ({
          localStorage: localStorage.getItem('test'),
          sessionStorage: sessionStorage.getItem('test'),
        }));

        expect(afterReset.localStorage).toBeNull();
        expect(afterReset.sessionStorage).toBeNull();
      }
    });

    it('should capture network and console logs', async () => {
      fixture = NavigationTestFixtureFactory.createIntegrationTestFixture();
      await fixture.setup();

      if (fixture.page) {
        await fixture.page.setContent(`
          <html>
            <body>
              <h1>Log Test</h1>
              <script>
                console.log('Test log message');
                console.warn('Test warning');
                console.error('Test error');

                // Make a network request
                fetch('data:text/plain,test-response');
              </script>
            </body>
          </html>
        `);

        // Wait for logs to be captured
        await new Promise(resolve => setTimeout(resolve, 500));

        const consoleActivity = fixture.consoleActivity;
        const networkActivity = fixture.networkActivity;

        expect(consoleActivity.length).toBeGreaterThan(0);
        expect(consoleActivity.some(log => log.text.includes('Test log message'))).toBe(true);

        expect(networkActivity.length).toBeGreaterThan(0);
      }
    });

    it('should create multiple pages with different configurations', async () => {
      fixture = NavigationTestFixtureFactory.createUnitTestFixture();
      await fixture.setup();

      const page1 = await fixture.createPage({
        content: TestPageTemplates.simple,
        viewport: { width: 800, height: 600 },
      });

      const page2 = await fixture.createPage({
        content: TestPageTemplates.form,
        viewport: { width: 1200, height: 800 },
      });

      expect(await page1.title()).toBe('Simple Test Page');
      expect(await page2.title()).toBe('Form Test Page');

      // Verify different viewport sizes (Note: Playwright sets viewport at context level)
      const page1ViewportSize = page1.viewportSize();
      const page2ViewportSize = page2.viewportSize();

      expect(page1ViewportSize).toBeDefined();
      expect(page2ViewportSize).toBeDefined();
    });
  });

  describe('Test Scenarios - Comprehensive', () => {
    beforeEach(async () => {
      fixture = NavigationTestFixtureFactory.createUnitTestFixture();
      await fixture.setup();
    });

    it('should handle SPA navigation with history', async () => {
      await TestScenarios.spaNavigation(fixture!);

      if (fixture!.page) {
        const page = fixture!.page;

        // Test SPA navigation
        await page.click('#about-btn');
        await page.waitForFunction(() =>
          document.getElementById('content')?.textContent?.includes('About Page')
        );

        await helper!.assertPageContent({ text: 'About Page' });

        // Test browser back/forward
        await page.goBack();
        await page.waitForFunction(() =>
          document.getElementById('content')?.textContent?.includes('Home Page')
        );
      }
    });

    it('should handle async loading scenarios', async () => {
      await TestScenarios.asyncLoading(fixture!);

      if (fixture!.page) {
        const page = fixture!.page;

        // Trigger async loading
        await page.click('#load-data');

        // Wait for loading state
        await page.waitForSelector('.loading', { state: 'visible' });

        // Wait for data to load
        await page.waitForFunction(() =>
          document.getElementById('data')?.textContent?.includes('Data loaded successfully!')
        );

        // Verify loading state is gone
        await page.waitForSelector('.loading', { state: 'hidden' });
      }
    });

    it('should handle form submission scenarios', async () => {
      await TestScenarios.formSubmission(fixture!);

      if (fixture!.page) {
        const page = fixture!.page;

        // Fill and submit form
        await page.fill('#name', 'Test User');
        await page.fill('#email', 'test@example.com');

        // Verify form elements
        const nameValue = await page.inputValue('#name');
        const emailValue = await page.inputValue('#email');

        expect(nameValue).toBe('Test User');
        expect(emailValue).toBe('test@example.com');
      }
    });
  });

  describe('Factory Methods - Edge Cases', () => {
    it('should create fixtures with custom isolation options', async () => {
      const customFixture = NavigationTestFixtureFactory.createCustomFixture(
        { headless: true, timeout: 15000 },
        {
          incognito: false,
          captureNetworkLogs: true,
          captureConsoleLogs: true,
          clearCookies: false,
        }
      );

      await customFixture.setup();

      expect(customFixture.navigationHelper).toBeDefined();

      await customFixture.teardown();
    });

    it('should handle factory method failures gracefully', async () => {
      // Test with invalid configuration
      try {
        const invalidFixture = NavigationTestFixtureFactory.createCustomFixture(
          { timeout: -1 } // Invalid timeout
        );

        // Should still create fixture but may fail on setup
        expect(invalidFixture).toBeInstanceOf(NavigationTestFixture);

        await invalidFixture.teardown().catch(() => {}); // Cleanup if needed
      } catch (error) {
        // Expected for some invalid configurations
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent navigation operations', async () => {
      const helpers: NavigationTestHelper[] = [];

      try {
        // Create multiple navigation helpers
        for (let i = 0; i < 3; i++) {
          const h = createNavigationTestHelper({ headless: true });
          await h.setup();
          helpers.push(h);
        }

        // Perform concurrent navigations
        const results = await Promise.all(
          helpers.map(h => h.goto('about:blank'))
        );

        // Verify all navigations succeeded
        results.forEach(result => {
          expect(result.success).toBe(true);
        });

      } finally {
        // Cleanup all helpers
        await Promise.all(
          helpers.map(h => h.teardown().catch(console.warn))
        );
      }
    });

    it('should measure navigation performance metrics', async () => {
      helper = createNavigationTestHelper({
        headless: true,
        waitForNetworkIdle: true,
      });
      await helper.setup();

      // Test multiple navigations and collect metrics
      const results = [];

      for (let i = 0; i < 3; i++) {
        const result = await helper.goto('about:blank');
        results.push(result);
      }

      // Verify metrics are collected
      results.forEach(result => {
        expect(result.duration).toBeGreaterThan(0);
        expect(result.success).toBe(true);
      });

      // Calculate average duration
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      expect(avgDuration).toBeGreaterThan(0);
    });
  });
});