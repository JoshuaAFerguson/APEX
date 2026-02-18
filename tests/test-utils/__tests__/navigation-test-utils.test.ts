/**
 * @fileoverview Tests for Navigation Test Utilities
 *
 * This file tests the navigation test utilities and fixtures to ensure they work correctly
 * and provide the expected functionality for testing navigation operations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  NavigationTestHelper,
  NavigationTestFixture,
  NavigationTestFixtureFactory,
  TestPageTemplates,
  TestScenarios,
  createNavigationTestHelper,
  NavigationTestSetup,
} from '../index.js';

describe('NavigationTestUtils', () => {
  let helper: NavigationTestHelper;
  let fixture: NavigationTestFixture;

  afterEach(async () => {
    // Clean up any test instances
    if (helper) {
      await helper.teardown().catch(console.warn);
    }
    if (fixture) {
      await fixture.teardown().catch(console.warn);
    }
  });

  describe('NavigationTestHelper', () => {
    it('should create and initialize a navigation test helper', async () => {
      helper = createNavigationTestHelper({
        headless: true,
        timeout: 10000,
      });

      await helper.setup();

      expect(helper.page).toBeDefined();
      expect(helper.browser).toBeDefined();
    });

    it('should navigate to a URL and collect metrics', async () => {
      helper = createNavigationTestHelper({ headless: true });
      await helper.setup();

      const result = await helper.goto('about:blank');

      expect(result.success).toBe(true);
      expect(result.finalUrl).toBe('about:blank');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should assert URL correctly', async () => {
      helper = createNavigationTestHelper({ headless: true });
      await helper.setup();

      await helper.goto('about:blank');

      // Should pass for correct URL
      await helper.assertURL({ url: 'about:blank' });

      // Should fail for incorrect URL
      try {
        await helper.assertURL({ url: 'https://example.com/' });
        expect.fail('Should have thrown error for incorrect URL');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Expected URL');
      }
    });

    it('should assert page content correctly', async () => {
      helper = createNavigationTestHelper({ headless: true });
      await helper.setup();

      // Set content and test assertions
      if (helper.page) {
        await helper.page.setContent(`
          <html>
            <body>
              <h1>Test Page</h1>
              <p id="content">Hello World</p>
            </body>
          </html>
        `);

        // Should pass for existing text
        await helper.assertPageContent({ text: 'Test Page' });

        // Should pass for existing selector
        await helper.assertPageContent({
          selector: '#content',
          visible: true,
        });

        // Should pass for element count
        await helper.assertPageContent({
          selector: 'h1',
          count: 1,
        });
      }
    });

    it('should wait for elements correctly', async () => {
      helper = createNavigationTestHelper({ headless: true });
      await helper.setup();

      if (helper.page) {
        await helper.page.setContent(`
          <html>
            <body>
              <button id="test-button">Click me</button>
            </body>
          </html>
        `);

        // Should successfully wait for visible element
        await helper.waitForElement('#test-button', { visible: true });

        // Should timeout for non-existent element
        try {
          await helper.waitForElement('#non-existent', { timeout: 1000 });
          expect.fail('Should have thrown error for non-existent element');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('NavigationTestSetup', () => {
    it('should create basic navigation setup', async () => {
      helper = await NavigationTestSetup.basic({ headless: true });

      expect(helper.page).toBeDefined();
      expect(helper.browser).toBeDefined();
    });

    it('should create headless navigation setup', async () => {
      helper = await NavigationTestSetup.headless();

      expect(helper.page).toBeDefined();
      expect(helper.browser.context.config.headless).toBe(true);
    });

    it('should create CI navigation setup', async () => {
      helper = await NavigationTestSetup.ci();

      expect(helper.page).toBeDefined();
      expect(helper.browser.context.config.headless).toBe(true);
      expect(helper.browser.context.config.slowMo).toBe(0);
    });

    it('should create debug navigation setup', async () => {
      helper = await NavigationTestSetup.debug();

      expect(helper.page).toBeDefined();
      expect(helper.browser.context.config.headless).toBe(false);
      expect(helper.browser.context.config.slowMo).toBe(500);
    });
  });

  describe('NavigationTestFixture', () => {
    it('should create and manage test isolation', async () => {
      fixture = NavigationTestFixtureFactory.createUnitTestFixture();
      await fixture.setup();

      expect(fixture.page).toBeDefined();
      expect(fixture.navigationHelper).toBeDefined();

      // Test reset functionality
      if (fixture.page) {
        await fixture.page.setContent('<html><body><p>Initial content</p></body></html>');
        await fixture.reset();

        // After reset, should be back to about:blank
        expect(fixture.page.url()).toBe('about:blank');
      }
    });

    it('should capture network logs when configured', async () => {
      fixture = NavigationTestFixtureFactory.createIntegrationTestFixture();
      await fixture.setup();

      if (fixture.page) {
        // Navigate to trigger network activity
        await fixture.page.goto('about:blank');

        // Check that network activity is captured
        const networkActivity = fixture.networkActivity;
        expect(Array.isArray(networkActivity)).toBe(true);
      }
    });

    it('should capture console logs when configured', async () => {
      fixture = NavigationTestFixtureFactory.createIntegrationTestFixture();
      await fixture.setup();

      if (fixture.page) {
        await fixture.page.setContent(`
          <html>
            <body>
              <script>console.log('Test message');</script>
            </body>
          </html>
        `);

        // Wait a bit for console message to be captured
        await new Promise(resolve => setTimeout(resolve, 100));

        const consoleActivity = fixture.consoleActivity;
        expect(Array.isArray(consoleActivity)).toBe(true);
      }
    });

    it('should create pages with custom configuration', async () => {
      fixture = NavigationTestFixtureFactory.createUnitTestFixture();
      await fixture.setup();

      const customPage = await fixture.createPage({
        content: TestPageTemplates.simple,
        viewport: { width: 800, height: 600 },
      });

      expect(customPage).toBeDefined();

      // Check that content was set
      const title = await customPage.title();
      expect(title).toBe('Simple Test Page');
    });
  });

  describe('TestPageTemplates', () => {
    it('should provide valid HTML templates', async () => {
      fixture = NavigationTestFixtureFactory.createUnitTestFixture();
      await fixture.setup();

      // Test each template
      const templates = [
        TestPageTemplates.simple,
        TestPageTemplates.form,
        TestPageTemplates.spa,
        TestPageTemplates.loading,
      ];

      for (const template of templates) {
        const page = await fixture.createPage({ content: template });

        // Should be able to load the template without errors
        const title = await page.title();
        expect(typeof title).toBe('string');
        expect(title.length).toBeGreaterThan(0);
      }
    });
  });

  describe('TestScenarios', () => {
    it('should set up basic navigation scenario', async () => {
      fixture = NavigationTestFixtureFactory.createUnitTestFixture();
      await fixture.setup();

      await TestScenarios.basicNavigation(fixture);

      if (fixture.page) {
        const title = await fixture.page.title();
        expect(title).toBe('Simple Test Page');
      }
    });

    it('should set up form submission scenario', async () => {
      fixture = NavigationTestFixtureFactory.createUnitTestFixture();
      await fixture.setup();

      await TestScenarios.formSubmission(fixture);

      if (fixture.page) {
        const title = await fixture.page.title();
        expect(title).toBe('Form Test Page');

        // Check that form elements exist
        const nameInput = fixture.page.locator('#name');
        await expect(nameInput).toBeVisible();
      }
    });

    it('should set up SPA navigation scenario', async () => {
      fixture = NavigationTestFixtureFactory.createUnitTestFixture();
      await fixture.setup();

      await TestScenarios.spaNavigation(fixture);

      if (fixture.page) {
        const title = await fixture.page.title();
        expect(title).toBe('SPA Test Page');

        // Check that navigation buttons exist
        const homeBtn = fixture.page.locator('#home-btn');
        await expect(homeBtn).toBeVisible();
      }
    });

    it('should set up async loading scenario', async () => {
      fixture = NavigationTestFixtureFactory.createUnitTestFixture();
      await fixture.setup();

      await TestScenarios.asyncLoading(fixture);

      if (fixture.page) {
        const title = await fixture.page.title();
        expect(title).toBe('Loading Test Page');

        // Check that load button exists
        const loadBtn = fixture.page.locator('#load-data');
        await expect(loadBtn).toBeVisible();
      }
    });
  });

  describe('Factory Methods', () => {
    it('should create different fixture types', async () => {
      const unitFixture = NavigationTestFixtureFactory.createUnitTestFixture();
      const integrationFixture = NavigationTestFixtureFactory.createIntegrationTestFixture();
      const debugFixture = NavigationTestFixtureFactory.createDebugFixture();
      const ciFixture = NavigationTestFixtureFactory.createCIFixture();

      expect(unitFixture).toBeInstanceOf(NavigationTestFixture);
      expect(integrationFixture).toBeInstanceOf(NavigationTestFixture);
      expect(debugFixture).toBeInstanceOf(NavigationTestFixture);
      expect(ciFixture).toBeInstanceOf(NavigationTestFixture);

      // Clean up
      await Promise.all([
        unitFixture.teardown().catch(console.warn),
        integrationFixture.teardown().catch(console.warn),
        debugFixture.teardown().catch(console.warn),
        ciFixture.teardown().catch(console.warn),
      ]);
    });

    it('should create custom fixture with specific options', async () => {
      const customFixture = NavigationTestFixtureFactory.createCustomFixture(
        { headless: true, timeout: 15000 },
        { incognito: false, captureNetworkLogs: true }
      );

      expect(customFixture).toBeInstanceOf(NavigationTestFixture);

      await customFixture.teardown().catch(console.warn);
    });
  });
});