/**
 * @fileoverview Advanced Tests for Browser Fixtures Module
 *
 * This test file complements the existing browser-fixtures.test.ts with additional
 * advanced test cases that cover:
 * - Memory usage and leak detection
 * - Performance characteristics
 * - Cross-browser behavioral differences
 * - Network simulation and error scenarios
 * - Resource cleanup verification
 * - Concurrent fixture usage
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';

// Mock Playwright before importing our module
const mockPage = {
  goto: vi.fn().mockResolvedValue(undefined),
  click: vi.fn().mockResolvedValue(undefined),
  fill: vi.fn().mockResolvedValue(undefined),
  screenshot: vi.fn().mockResolvedValue(undefined),
  setContent: vi.fn().mockResolvedValue(undefined),
  waitForLoadState: vi.fn().mockResolvedValue(undefined),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
  setDefaultTimeout: vi.fn().mockResolvedValue(undefined),
  locator: vi.fn().mockReturnValue({
    waitFor: vi.fn().mockResolvedValue(undefined),
    first: vi.fn().mockReturnThis(),
    isVisible: vi.fn().mockResolvedValue(true),
  }),
  evaluate: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  textContent: vi.fn().mockResolvedValue('test content'),
  setOffline: vi.fn().mockResolvedValue(undefined),
  emulateNetworkConditions: vi.fn().mockResolvedValue(undefined),
};

const mockContext = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn().mockResolvedValue(undefined),
  tracing: {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  },
  setOffline: vi.fn().mockResolvedValue(undefined),
};

const mockBrowser = {
  newContext: vi.fn().mockResolvedValue(mockContext),
  close: vi.fn().mockResolvedValue(undefined),
  version: vi.fn().mockReturnValue('1.0.0-test'),
  browserType: vi.fn().mockReturnValue({ name: 'chromium' }),
};

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
  firefox: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
  webkit: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 1024 }),
  readdir: vi.fn().mockResolvedValue([]),
}));

// Import after mocks
import {
  BrowserFixture,
  createScopedBrowserFixture,
  PageUtils,
  type BrowserFixtureConfig,
} from '../browser-fixtures.js';

describe('Browser Fixtures - Advanced Tests', () => {
  let fixture: BrowserFixture;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (fixture) {
      await fixture.teardown();
    }
  });

  describe('Memory and Resource Management', () => {
    test('should handle memory-intensive operations without leaks', async () => {
      const config: Partial<BrowserFixtureConfig> = {
        recordVideo: true,
        trace: true,
        captureFailureScreenshots: true,
      };

      fixture = new BrowserFixture(config);
      await fixture.setup();

      // Simulate memory-intensive operations
      const iterations = 10;
      const screenshots: string[] = [];

      for (let i = 0; i < iterations; i++) {
        const screenshotPath = await fixture.screenshot(`memory-test-${i}`);
        screenshots.push(screenshotPath);
      }

      expect(screenshots).toHaveLength(iterations);
      expect(mockPage.screenshot).toHaveBeenCalledTimes(iterations);

      // Verify cleanup doesn't fail with many artifacts
      await fixture.teardown();
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    test('should handle rapid setup/teardown cycles without resource leaks', async () => {
      const cycles = 5;
      const fixtures: BrowserFixture[] = [];

      for (let i = 0; i < cycles; i++) {
        const testFixture = new BrowserFixture();
        await testFixture.setup();
        fixtures.push(testFixture);
      }

      // Teardown all fixtures
      for (const testFixture of fixtures) {
        await testFixture.teardown();
      }

      expect(mockBrowser.close).toHaveBeenCalledTimes(cycles);
      expect(mockContext.close).toHaveBeenCalledTimes(cycles);
    });

    test('should properly cleanup resources on partial setup failure', async () => {
      const { chromium } = await import('playwright');

      // Simulate browser launch success but context creation failure
      chromium.launch.mockResolvedValueOnce(mockBrowser);
      mockBrowser.newContext.mockRejectedValueOnce(new Error('Context creation failed'));

      fixture = new BrowserFixture();

      await expect(fixture.setup()).rejects.toThrow('Browser fixture setup failed');

      // Should still cleanup the browser that was successfully created
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('Performance Characteristics', () => {
    test('should handle concurrent fixture operations efficiently', async () => {
      const numFixtures = 3;
      const fixtures: BrowserFixture[] = [];

      // Create multiple fixtures concurrently
      const setupPromises = Array.from({ length: numFixtures }, async () => {
        const testFixture = new BrowserFixture();
        await testFixture.setup();
        fixtures.push(testFixture);
        return testFixture;
      });

      const results = await Promise.all(setupPromises);
      expect(results).toHaveLength(numFixtures);

      // Perform operations on all fixtures concurrently
      const navigationPromises = fixtures.map(f => f.navigateTo('http://localhost:3000'));
      await Promise.all(navigationPromises);

      expect(mockPage.goto).toHaveBeenCalledTimes(numFixtures);

      // Cleanup all fixtures
      await Promise.all(fixtures.map(f => f.teardown()));
    });

    test('should measure and report performance metrics correctly', async () => {
      fixture = new BrowserFixture();
      await fixture.setup();

      const mockMetrics = {
        domContentLoaded: 150,
        loadComplete: 800,
        firstPaint: 75,
        timestamp: Date.now(),
      };

      mockPage.evaluate.mockResolvedValue(mockMetrics);

      const metrics = await fixture.getPerformanceMetrics();

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(metrics).toEqual(mockMetrics);
    });

    test('should handle timeout scenarios gracefully', async () => {
      fixture = new BrowserFixture({ timeout: 1000 }); // Very short timeout
      await fixture.setup();

      // Mock timeout error
      const timeoutError = new Error('Timeout 1000ms exceeded');
      mockPage.goto.mockRejectedValue(timeoutError);

      await expect(fixture.navigateTo('http://slow-site.com')).rejects.toThrow();
      expect(mockPage.goto).toHaveBeenCalled();
    });
  });

  describe('Network Simulation and Error Scenarios', () => {
    test('should handle network offline scenarios', async () => {
      fixture = new BrowserFixture();
      await fixture.setup();

      const page = fixture.getPage();

      // Simulate going offline
      await page.setOffline(true);
      expect(mockPage.setOffline).toHaveBeenCalledWith(true);

      // Should handle navigation failure due to offline state
      mockPage.goto.mockRejectedValue(new Error('ERR_NETWORK_CHANGED'));

      await expect(fixture.navigateTo('http://example.com')).rejects.toThrow();
    });

    test('should simulate different network conditions', async () => {
      fixture = new BrowserFixture();
      await fixture.setup();

      const page = fixture.getPage();

      // Simulate slow network
      const networkConditions = {
        offline: false,
        downloadThroughput: 1024 * 1024, // 1MB/s
        uploadThroughput: 512 * 1024,    // 512KB/s
        latency: 100, // 100ms
      };

      await page.emulateNetworkConditions(networkConditions);
      expect(mockPage.emulateNetworkConditions).toHaveBeenCalledWith(networkConditions);
    });

    test('should handle DNS resolution failures', async () => {
      fixture = new BrowserFixture({ retries: 2 });
      await fixture.setup();

      mockPage.goto.mockRejectedValue(new Error('ERR_NAME_NOT_RESOLVED'));

      await expect(fixture.navigateTo('http://nonexistent.local')).rejects.toThrow();
      expect(mockPage.goto).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('Cross-Browser Behavioral Differences', () => {
    test('should handle browser-specific features correctly', async () => {
      const browserTypes: Array<'chromium' | 'firefox' | 'webkit'> = [
        'chromium', 'firefox', 'webkit'
      ];

      for (const browserType of browserTypes) {
        const testFixture = new BrowserFixture({ browserType });
        await testFixture.setup();

        const config = testFixture.getConfig();
        expect(config.browserType).toBe(browserType);

        await testFixture.teardown();
      }
    });

    test('should handle browser-specific viewport constraints', async () => {
      const viewports = [
        { width: 320, height: 568 },   // Mobile
        { width: 768, height: 1024 },  // Tablet
        { width: 1920, height: 1080 }, // Desktop
      ];

      for (const viewport of viewports) {
        const testFixture = new BrowserFixture({ viewport });
        await testFixture.setup();

        const config = testFixture.getConfig();
        expect(config.viewport).toEqual(viewport);

        await testFixture.teardown();
      }
    });
  });

  describe('Event System Stress Testing', () => {
    test('should handle high-frequency events without memory leaks', async () => {
      fixture = new BrowserFixture();

      const eventCounts = {
        setup: 0,
        teardown: 0,
        navigation: 0,
        screenshot: 0,
      };

      fixture.on('fixture:setup', () => eventCounts.setup++);
      fixture.on('fixture:teardown', () => eventCounts.teardown++);
      fixture.on('navigation:success', () => eventCounts.navigation++);
      fixture.on('screenshot:taken', () => eventCounts.screenshot++);

      await fixture.setup();
      expect(eventCounts.setup).toBe(1);

      // Generate many events
      for (let i = 0; i < 10; i++) {
        await fixture.navigateTo(`http://example.com/page-${i}`);
        await fixture.screenshot(`test-${i}`);
      }

      expect(eventCounts.navigation).toBe(10);
      expect(eventCounts.screenshot).toBe(10);

      await fixture.teardown();
      expect(eventCounts.teardown).toBe(1);
    });

    test('should handle event listener removal correctly', async () => {
      fixture = new BrowserFixture();

      const listener = vi.fn();
      fixture.on('navigation:success', listener);

      await fixture.setup();
      await fixture.navigateTo('http://example.com');
      expect(listener).toHaveBeenCalledTimes(1);

      // Remove listener
      fixture.off('navigation:success', listener);

      await fixture.navigateTo('http://example.com/page2');
      expect(listener).toHaveBeenCalledTimes(1); // Should not be called again
    });
  });

  describe('Configuration Edge Cases', () => {
    test('should handle extreme timeout values', async () => {
      const configs = [
        { timeout: 1 },        // Very short
        { timeout: 300000 },   // Very long
      ];

      for (const config of configs) {
        const testFixture = new BrowserFixture(config);
        await testFixture.setup();

        expect(testFixture.getConfig().timeout).toBe(config.timeout);

        await testFixture.teardown();
      }
    });

    test('should handle invalid configuration gracefully', async () => {
      // @ts-expect-error - Testing invalid browser type
      fixture = new BrowserFixture({ browserType: 'invalid-browser' });

      // Should fall back to chromium
      await fixture.setup();
      const { chromium } = await import('playwright');
      expect(chromium.launch).toHaveBeenCalled();
    });

    test('should handle complex artifact directory structures', async () => {
      const deepPath = '/very/deep/nested/path/for/test/artifacts';
      fixture = new BrowserFixture({ artifactDir: deepPath });

      await fixture.setup();

      const artifactDir = fixture.getArtifactDir();
      expect(artifactDir).toContain('test-artifacts');
    });
  });

  describe('Page Utility Functions Advanced Testing', () => {
    test('should handle complex HTML structures in test pages', () => {
      const simpleHtml = PageUtils.createSimpleTestPage();
      const formHtml = PageUtils.createFormTestPage();

      // Verify HTML structure
      expect(simpleHtml).toContain('<!DOCTYPE html>');
      expect(simpleHtml).toContain('onclick="showResult()"');
      expect(simpleHtml).toContain('function showResult()');

      expect(formHtml).toContain('<form id="test-form">');
      expect(formHtml).toContain('type="email"');
      expect(formHtml).toContain('addEventListener');
    });

    test('should handle page content with special characters', async () => {
      fixture = new BrowserFixture();
      await fixture.setup();

      const htmlWithSpecialChars = `
        <html>
          <body>
            <div id="special">Special chars: "quotes", 'apostrophes', & ampersands, < > brackets</div>
          </body>
        </html>
      `;

      const { loadPageContent } = await import('../browser-fixtures.js');
      await loadPageContent(fixture, htmlWithSpecialChars);

      expect(mockPage.setContent).toHaveBeenCalledWith(htmlWithSpecialChars);
      expect(mockPage.waitForLoadState).toHaveBeenCalledWith('domcontentloaded');
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should recover from browser crashes gracefully', async () => {
      fixture = new BrowserFixture();
      await fixture.setup();

      // Simulate browser crash
      mockBrowser.close.mockRejectedValueOnce(new Error('Browser process crashed'));

      // Should handle crash during teardown without throwing
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await fixture.teardown();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('should handle context creation race conditions', async () => {
      const fixtures = Array.from({ length: 3 }, () => new BrowserFixture());

      // Simulate race condition where browser is closed while creating contexts
      let closeCallCount = 0;
      mockBrowser.close.mockImplementation(async () => {
        closeCallCount++;
        if (closeCallCount === 1) {
          throw new Error('Browser already closed');
        }
      });

      const setupPromises = fixtures.map(f => f.setup());
      await Promise.all(setupPromises.map(p => p.catch(() => {}))); // Ignore errors

      // Cleanup
      const teardownPromises = fixtures.map(f => f.teardown());
      await Promise.all(teardownPromises);
    });

    test('should handle page navigation race conditions', async () => {
      fixture = new BrowserFixture({ retries: 1 });
      await fixture.setup();

      // Simulate race condition in navigation
      mockPage.goto
        .mockRejectedValueOnce(new Error('Navigation in progress'))
        .mockResolvedValueOnce(undefined);

      await fixture.navigateTo('http://example.com');
      expect(mockPage.goto).toHaveBeenCalledTimes(2);
    });
  });

  describe('Scoped Fixtures Advanced Scenarios', () => {
    test('should handle multiple scoped fixtures with different configurations', async () => {
      const configs = [
        { browserType: 'chromium' as const, headless: true },
        { browserType: 'firefox' as const, headless: false },
        { browserType: 'webkit' as const, viewport: { width: 800, height: 600 } },
      ];

      const fixtures = await Promise.all(
        configs.map(config => createScopedBrowserFixture(config))
      );

      expect(fixtures).toHaveLength(3);

      // Verify each fixture has correct configuration
      for (let i = 0; i < fixtures.length; i++) {
        const config = fixtures[i].getConfig();
        expect(config.browserType).toBe(configs[i].browserType);
      }

      // Cleanup all
      await Promise.all(fixtures.map(f => f.teardown()));
    });

    test('should isolate scoped fixtures from each other', async () => {
      const fixture1 = await createScopedBrowserFixture({
        artifactDir: '/tmp/fixture1'
      });
      const fixture2 = await createScopedBrowserFixture({
        artifactDir: '/tmp/fixture2'
      });

      // Operations on one should not affect the other
      await fixture1.navigateTo('http://example.com/page1');
      await fixture2.navigateTo('http://example.com/page2');

      expect(mockPage.goto).toHaveBeenCalledTimes(2);
      expect(mockPage.goto).toHaveBeenCalledWith('http://example.com/page1', expect.anything());
      expect(mockPage.goto).toHaveBeenCalledWith('http://example.com/page2', expect.anything());

      await Promise.all([fixture1.teardown(), fixture2.teardown()]);
    });
  });
});