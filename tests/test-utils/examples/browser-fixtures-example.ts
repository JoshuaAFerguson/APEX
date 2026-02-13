/**
 * @fileoverview Browser Fixtures Usage Example
 *
 * This example demonstrates how to use the browser fixtures module
 * in different testing scenarios.
 */

import {
  setupBrowserFixture,
  getBrowserFixture,
  createScopedBrowserFixture,
  loadPageContent,
  PageUtils,
  type BrowserFixtureConfig
} from '../browser-fixtures.js';

import { describe, test, expect, beforeAll, afterAll } from 'vitest';

// Example 1: Global Fixture Setup
describe('Example: Global Browser Fixture', () => {
  // Setup global fixture with custom configuration
  setupBrowserFixture({
    browserType: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 720 },
    captureFailureScreenshots: true,
  });

  test('should navigate and interact with page', async () => {
    const fixture = getBrowserFixture();
    const page = fixture.getPage();

    // Load a test page
    const html = PageUtils.createSimpleTestPage();
    await loadPageContent(fixture, html);

    // Interact with elements
    await page.fill('#test-input', 'Hello World');
    await page.click('#test-btn');

    // Verify result
    const result = await page.textContent('#result');
    expect(result).toContain('Button clicked!');
    expect(result).toContain('Hello World');
  });

  test('should capture screenshots', async () => {
    const fixture = getBrowserFixture();
    const page = fixture.getPage();

    // Load test page
    const html = PageUtils.createFormTestPage();
    await loadPageContent(fixture, html);

    // Fill form
    await page.fill('#name', 'John Doe');
    await page.fill('#email', 'john@example.com');
    await page.selectOption('#category', 'general');

    // Take screenshot
    const screenshotPath = await fixture.screenshot('form-filled');
    expect(screenshotPath).toContain('form-filled');
  });

  test('should monitor performance', async () => {
    const fixture = getBrowserFixture();

    // Load test page
    const html = PageUtils.createSimpleTestPage();
    await loadPageContent(fixture, html);

    // Get performance metrics
    const metrics = await fixture.getPerformanceMetrics();
    expect(metrics).toHaveProperty('domContentLoaded');
    expect(metrics).toHaveProperty('loadComplete');
  });
});

// Example 2: Scoped Fixture for Isolated Tests
describe('Example: Scoped Browser Fixture', () => {
  test('should create isolated browser instance', async () => {
    const fixture = await createScopedBrowserFixture({
      browserType: 'firefox',
      headless: true,
      viewport: { width: 800, height: 600 },
    });

    try {
      const page = fixture.getPage();
      const config = fixture.getConfig();

      expect(config.browserType).toBe('firefox');
      expect(config.viewport).toEqual({ width: 800, height: 600 });

      // Load and interact with page
      const html = PageUtils.createSimpleTestPage();
      await loadPageContent(fixture, html);

      await page.click('#test-btn');
      const result = await page.textContent('#result');
      expect(result).toContain('Button clicked!');

    } finally {
      await fixture.teardown();
    }
  });
});

// Example 3: Manual Fixture Management
describe('Example: Manual Fixture Management', () => {
  test('should manually manage fixture lifecycle', async () => {
    // Import the BrowserFixture class
    const { BrowserFixture } = await import('../browser-fixtures.js');

    const config: Partial<BrowserFixtureConfig> = {
      browserType: 'webkit',
      headless: true,
      viewport: { width: 1024, height: 768 },
      timeout: 60000,
    };

    const fixture = new BrowserFixture(config);

    try {
      // Setup
      await fixture.setup();

      // Use fixture
      const page = fixture.getPage();
      const html = PageUtils.createFormTestPage();
      await loadPageContent(fixture, html);

      // Fill and submit form
      await page.fill('#name', 'Test User');
      await page.fill('#email', 'test@example.com');
      await page.fill('#message', 'This is a test message');
      await page.click('button[type="submit"]');

      // Verify submission
      const result = await page.textContent('#form-result');
      expect(result).toContain('Form Submitted!');
      expect(result).toContain('Test User');

    } finally {
      // Cleanup
      await fixture.teardown();
    }
  });
});

// Example 4: Event Handling
describe('Example: Event Handling', () => {
  test('should listen to fixture events', async () => {
    const fixture = await createScopedBrowserFixture({
      headless: true,
    });

    const events: string[] = [];

    // Listen to events
    fixture.on('navigation:success', () => events.push('navigation:success'));
    fixture.on('screenshot:taken', () => events.push('screenshot:taken'));
    fixture.on('console', (data) => events.push(`console:${data.type}`));

    try {
      const page = fixture.getPage();

      // Load page
      const html = PageUtils.createSimpleTestPage();
      await loadPageContent(fixture, html);

      // Take screenshot
      await fixture.screenshot('event-test');

      // Events should have been emitted
      expect(events).toContain('screenshot:taken');

    } finally {
      await fixture.teardown();
    }
  });
});

// Example 5: Configuration Variations
describe('Example: Different Configurations', () => {
  const configurations: Array<{
    name: string;
    config: Partial<BrowserFixtureConfig>;
  }> = [
    {
      name: 'Development Mode',
      config: {
        headless: false,
        devtools: true,
        slowMo: 500,
      },
    },
    {
      name: 'CI Mode',
      config: {
        headless: true,
        captureFailureScreenshots: true,
        recordVideo: false,
      },
    },
    {
      name: 'Mobile Viewport',
      config: {
        viewport: { width: 375, height: 667 },
        browserType: 'chromium',
      },
    },
    {
      name: 'High Resolution',
      config: {
        viewport: { width: 2560, height: 1440 },
        timeout: 60000,
      },
    },
  ];

  configurations.forEach(({ name, config }) => {
    test(`should work with ${name} configuration`, async () => {
      const fixture = await createScopedBrowserFixture(config);

      try {
        const fixtureConfig = fixture.getConfig();
        const page = fixture.getPage();

        // Verify configuration was applied
        if (config.viewport) {
          expect(fixtureConfig.viewport).toEqual(config.viewport);
        }
        if (config.browserType) {
          expect(fixtureConfig.browserType).toBe(config.browserType);
        }

        // Basic functionality test
        const html = PageUtils.createSimpleTestPage();
        await loadPageContent(fixture, html);

        await page.click('#test-btn');
        const result = await page.textContent('#result');
        expect(result).toContain('Button clicked!');

      } finally {
        await fixture.teardown();
      }
    });
  });
});

// Example 6: Error Handling
describe('Example: Error Handling', () => {
  test('should handle navigation failures gracefully', async () => {
    const fixture = await createScopedBrowserFixture({
      retries: 2,
      timeout: 5000,
    });

    try {
      // This should work (loading HTML content)
      const html = PageUtils.createSimpleTestPage();
      await loadPageContent(fixture, html);

      // Basic interaction should work
      const page = fixture.getPage();
      await page.click('#test-btn');

    } finally {
      await fixture.teardown();
    }
  });

  test('should cleanup properly on errors', async () => {
    const fixture = await createScopedBrowserFixture();

    try {
      // Even if test fails, fixture should still be cleaned up
      expect(fixture.getBrowser()).toBeDefined();
      expect(fixture.getPage()).toBeDefined();

    } finally {
      await fixture.teardown();

      // After teardown, accessing components should throw
      expect(() => fixture.getBrowser()).toThrow();
      expect(() => fixture.getPage()).toThrow();
    }
  });
});

export default {
  // These examples demonstrate the main usage patterns
  globalFixture: setupBrowserFixture,
  scopedFixture: createScopedBrowserFixture,
  pageUtils: PageUtils,
};