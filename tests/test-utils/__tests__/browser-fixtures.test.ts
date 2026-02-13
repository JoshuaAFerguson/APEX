/**
 * @fileoverview Tests for Browser Fixtures Module
 *
 * Comprehensive test suite for the browser fixtures module, covering:
 * - Fixture lifecycle management
 * - Configuration options
 * - Error handling and cleanup
 * - Integration with Vitest
 * - Performance and reliability features
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
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
  evaluate: vi.fn().mockResolvedValue({
    domContentLoaded: 100,
    loadComplete: 500,
    firstPaint: 50,
    timestamp: Date.now(),
  }),
  on: vi.fn(),
  off: vi.fn(),
  textContent: vi.fn().mockResolvedValue('test content'),
};

const mockContext = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn().mockResolvedValue(undefined),
  tracing: {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  },
};

const mockBrowser = {
  newContext: vi.fn().mockResolvedValue(mockContext),
  close: vi.fn().mockResolvedValue(undefined),
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
  mkdtemp: vi.fn().mockResolvedValue('/tmp/test-artifacts-123'),
}));

// Now import our module
import {
  BrowserFixture,
  setupBrowserFixture,
  getBrowserFixture,
  createScopedBrowserFixture,
  loadPageContent,
  waitForNetworkIdle,
  PageUtils,
  DEFAULT_BROWSER_CONFIG,
  type BrowserFixtureConfig,
  type ViewportConfig,
} from '../browser-fixtures.js';

describe('BrowserFixture', () => {
  let fixture: BrowserFixture;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (fixture) {
      await fixture.teardown();
    }
  });

  describe('Configuration', () => {
    test('should use default configuration', () => {
      fixture = new BrowserFixture();
      const config = fixture.getConfig();

      expect(config.browserType).toBe('chromium');
      expect(config.timeout).toBe(30000);
      expect(config.retries).toBeGreaterThanOrEqual(0);
      expect(config.viewport).toEqual({ width: 1280, height: 720 });
    });

    test('should merge custom configuration', () => {
      const customConfig: Partial<BrowserFixtureConfig> = {
        browserType: 'firefox',
        headless: false,
        viewport: { width: 1920, height: 1080 },
        timeout: 60000,
      };

      fixture = new BrowserFixture(customConfig);
      const config = fixture.getConfig();

      expect(config.browserType).toBe('firefox');
      expect(config.headless).toBe(false);
      expect(config.viewport).toEqual({ width: 1920, height: 1080 });
      expect(config.timeout).toBe(60000);
    });

    test('should not allow config updates after setup', async () => {
      fixture = new BrowserFixture();
      await fixture.setup();

      expect(() => {
        fixture.updateConfig({ browserType: 'firefox' });
      }).toThrow('Cannot update configuration after setup');
    });

    test('should allow config updates before setup', () => {
      fixture = new BrowserFixture();

      expect(() => {
        fixture.updateConfig({ browserType: 'firefox' });
      }).not.toThrow();

      const config = fixture.getConfig();
      expect(config.browserType).toBe('firefox');
    });
  });

  describe('Lifecycle Management', () => {
    test('should setup browser fixture successfully', async () => {
      fixture = new BrowserFixture();

      await fixture.setup();

      expect(fixture.getBrowser()).toBeDefined();
      expect(fixture.getContext()).toBeDefined();
      expect(fixture.getPage()).toBeDefined();
      expect(fixture.getArtifactDir()).toBeDefined();
    });

    test('should prevent double setup', async () => {
      fixture = new BrowserFixture();
      await fixture.setup();

      await expect(fixture.setup()).rejects.toThrow('Browser fixture already set up');
    });

    test('should teardown browser fixture successfully', async () => {
      fixture = new BrowserFixture();
      await fixture.setup();

      await fixture.teardown();

      expect(() => fixture.getBrowser()).toThrow('Browser fixture not set up');
      expect(() => fixture.getContext()).toThrow('Browser fixture not set up');
      expect(() => fixture.getPage()).toThrow('Browser fixture not set up');
    });

    test('should handle teardown errors gracefully', async () => {
      fixture = new BrowserFixture();
      await fixture.setup();

      // Make browser close throw an error
      mockBrowser.close.mockRejectedValueOnce(new Error('Browser close failed'));

      // Should not throw, but log warning
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await fixture.teardown();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('should emit lifecycle events', async () => {
      fixture = new BrowserFixture();

      const setupListener = vi.fn();
      const teardownListener = vi.fn();

      fixture.on('fixture:setup', setupListener);
      fixture.on('fixture:teardown', teardownListener);

      await fixture.setup();
      expect(setupListener).toHaveBeenCalledWith({
        browserType: 'chromium',
        viewport: { width: 1280, height: 720 },
        artifactDir: expect.stringContaining('test-artifacts'),
      });

      await fixture.teardown();
      expect(teardownListener).toHaveBeenCalled();
    });
  });

  describe('Browser Types', () => {
    test('should launch chromium browser', async () => {
      const { chromium } = await import('playwright');
      fixture = new BrowserFixture({ browserType: 'chromium' });

      await fixture.setup();

      expect(chromium.launch).toHaveBeenCalledWith({
        headless: expect.any(Boolean),
        slowMo: expect.any(Number),
        devtools: expect.any(Boolean),
      });
    });

    test('should launch firefox browser', async () => {
      const { firefox } = await import('playwright');
      fixture = new BrowserFixture({ browserType: 'firefox' });

      await fixture.setup();

      expect(firefox.launch).toHaveBeenCalled();
    });

    test('should launch webkit browser', async () => {
      const { webkit } = await import('playwright');
      fixture = new BrowserFixture({ browserType: 'webkit' });

      await fixture.setup();

      expect(webkit.launch).toHaveBeenCalled();
    });
  });

  describe('Page Operations', () => {
    beforeEach(async () => {
      fixture = new BrowserFixture();
      await fixture.setup();
    });

    test('should navigate to URL successfully', async () => {
      const url = 'http://localhost:3000';

      await fixture.navigateTo(url);

      expect(mockPage.goto).toHaveBeenCalledWith(url, {
        timeout: 30000,
        waitUntil: 'domcontentloaded',
      });
    });

    test('should retry navigation on failure', async () => {
      fixture = new BrowserFixture({ retries: 2 });
      await fixture.setup();

      mockPage.goto
        .mockRejectedValueOnce(new Error('Navigation failed'))
        .mockRejectedValueOnce(new Error('Navigation failed again'))
        .mockResolvedValueOnce(undefined);

      await fixture.navigateTo('http://localhost:3000');

      expect(mockPage.goto).toHaveBeenCalledTimes(3);
    });

    test('should fail after max retries', async () => {
      fixture = new BrowserFixture({ retries: 1 });
      await fixture.setup();

      mockPage.goto.mockRejectedValue(new Error('Network error'));

      await expect(fixture.navigateTo('http://localhost:3000')).rejects.toThrow(
        'Failed to navigate to http://localhost:3000 after 2 attempts'
      );
    });

    test('should wait for elements', async () => {
      const selector = '#my-element';

      await fixture.waitForElement(selector);

      expect(mockPage.locator).toHaveBeenCalledWith(selector);
    });

    test('should take screenshots', async () => {
      const screenshotName = 'test-screenshot';

      const screenshotPath = await fixture.screenshot(screenshotName);

      expect(mockPage.screenshot).toHaveBeenCalledWith({
        path: expect.stringContaining(screenshotName),
        fullPage: true,
      });
      expect(screenshotPath).toContain(screenshotName);
    });

    test('should create new pages', async () => {
      const newPage = await fixture.createNewPage();

      expect(mockContext.newPage).toHaveBeenCalled();
      expect(newPage.setDefaultTimeout).toHaveBeenCalledWith(30000);
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      fixture = new BrowserFixture();
      await fixture.setup();
    });

    test('should collect performance metrics', async () => {
      const metrics = await fixture.getPerformanceMetrics();

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(metrics).toHaveProperty('domContentLoaded');
      expect(metrics).toHaveProperty('loadComplete');
      expect(metrics).toHaveProperty('firstPaint');
    });
  });

  describe('Error Handling', () => {
    test('should handle setup failures gracefully', async () => {
      const { chromium } = await import('playwright');
      chromium.launch.mockRejectedValueOnce(new Error('Browser launch failed'));

      fixture = new BrowserFixture();

      await expect(fixture.setup()).rejects.toThrow('Browser fixture setup failed');

      // Should still be able to attempt setup again
      chromium.launch.mockResolvedValueOnce(mockBrowser);
      await expect(fixture.setup()).resolves.toBeUndefined();
    });

    test('should throw error when accessing components before setup', () => {
      fixture = new BrowserFixture();

      expect(() => fixture.getBrowser()).toThrow('Browser fixture not set up');
      expect(() => fixture.getContext()).toThrow('Browser fixture not set up');
      expect(() => fixture.getPage()).toThrow('Browser fixture not set up');
      expect(() => fixture.getArtifactDir()).toThrow('Browser fixture not set up');
    });
  });

  describe('Artifact Management', () => {
    beforeEach(async () => {
      fixture = new BrowserFixture();
      await fixture.setup();
    });

    test('should create artifact directories', async () => {
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('test-artifacts'),
        { recursive: true }
      );
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('screenshots'),
        { recursive: true }
      );
    });

    test('should support video recording', async () => {
      fixture = new BrowserFixture({ recordVideo: true });
      await fixture.setup();

      expect(mockBrowser.newContext).toHaveBeenCalledWith(
        expect.objectContaining({
          recordVideo: expect.objectContaining({
            dir: expect.stringContaining('videos'),
          }),
        })
      );
    });

    test('should support trace collection', async () => {
      fixture = new BrowserFixture({ trace: true });
      await fixture.setup();

      expect(mockContext.tracing.start).toHaveBeenCalledWith({
        screenshots: true,
        snapshots: true,
        sources: true,
      });
    });
  });
});

describe('Vitest Integration', () => {
  // Note: These tests are somewhat limited because we can't easily test
  // the actual beforeAll/afterAll hooks in this context, but we can test
  // the core functionality

  test('should setup and provide global fixture', () => {
    expect(() => setupBrowserFixture()).not.toThrow();
  });

  test('should throw when accessing global fixture before setup', () => {
    expect(() => getBrowserFixture()).toThrow(
      'Browser fixture not initialized'
    );
  });
});

describe('Scoped Fixtures', () => {
  test('should create and setup scoped fixture', async () => {
    const fixture = await createScopedBrowserFixture({
      browserType: 'firefox',
      headless: true,
    });

    expect(fixture).toBeInstanceOf(BrowserFixture);
    expect(fixture.getBrowser()).toBeDefined();
    expect(fixture.getPage()).toBeDefined();

    await fixture.teardown();
  });

  test('should support custom configuration', async () => {
    const config = {
      browserType: 'webkit' as const,
      viewport: { width: 800, height: 600 },
      timeout: 60000,
    };

    const fixture = await createScopedBrowserFixture(config);
    const fixtureConfig = fixture.getConfig();

    expect(fixtureConfig.browserType).toBe('webkit');
    expect(fixtureConfig.viewport).toEqual({ width: 800, height: 600 });
    expect(fixtureConfig.timeout).toBe(60000);

    await fixture.teardown();
  });
});

describe('Utility Functions', () => {
  let fixture: BrowserFixture;

  beforeEach(async () => {
    fixture = new BrowserFixture();
    await fixture.setup();
  });

  afterEach(async () => {
    await fixture.teardown();
  });

  test('should load page content', async () => {
    const html = '<html><body><h1>Test</h1></body></html>';

    await loadPageContent(fixture, html);

    expect(mockPage.setContent).toHaveBeenCalledWith(html);
    expect(mockPage.waitForLoadState).toHaveBeenCalledWith('domcontentloaded');
  });

  test('should wait for network idle', async () => {
    await waitForNetworkIdle(fixture);

    expect(mockPage.waitForLoadState).toHaveBeenCalledWith('networkidle', {
      timeout: 30000,
    });
  });

  test('should wait for network idle with custom timeout', async () => {
    await waitForNetworkIdle(fixture, { timeout: 60000 });

    expect(mockPage.waitForLoadState).toHaveBeenCalledWith('networkidle', {
      timeout: 60000,
    });
  });
});

describe('PageUtils', () => {
  test('should create simple test page', () => {
    const html = PageUtils.createSimpleTestPage();

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Test Page</title>');
    expect(html).toContain('id="test-btn"');
    expect(html).toContain('id="test-input"');
    expect(html).toContain('id="result"');
  });

  test('should create form test page', () => {
    const html = PageUtils.createFormTestPage();

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Form Test Page</title>');
    expect(html).toContain('id="test-form"');
    expect(html).toContain('type="email"');
    expect(html).toContain('<select');
    expect(html).toContain('<textarea');
  });
});

describe('Configuration Validation', () => {
  test('should have valid default configuration', () => {
    expect(DEFAULT_BROWSER_CONFIG.browserType).toMatch(/^(chromium|firefox|webkit)$/);
    expect(DEFAULT_BROWSER_CONFIG.timeout).toBeGreaterThan(0);
    expect(DEFAULT_BROWSER_CONFIG.retries).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_BROWSER_CONFIG.viewport.width).toBeGreaterThan(0);
    expect(DEFAULT_BROWSER_CONFIG.viewport.height).toBeGreaterThan(0);
  });

  test('should handle environment variable configuration', () => {
    // Test CI environment
    const originalCI = process.env.CI;
    process.env.CI = 'true';

    const fixture = new BrowserFixture();
    const config = fixture.getConfig();

    expect(config.headless).toBe(true);

    process.env.CI = originalCI;
  });
});

describe('Event System', () => {
  let fixture: BrowserFixture;

  beforeEach(() => {
    fixture = new BrowserFixture();
  });

  afterEach(async () => {
    await fixture.teardown();
  });

  test('should extend EventEmitter', () => {
    expect(fixture).toBeInstanceOf(EventEmitter);
  });

  test('should emit setup and teardown events', async () => {
    const setupSpy = vi.fn();
    const teardownSpy = vi.fn();

    fixture.on('fixture:setup', setupSpy);
    fixture.on('fixture:teardown', teardownSpy);

    await fixture.setup();
    expect(setupSpy).toHaveBeenCalled();

    await fixture.teardown();
    expect(teardownSpy).toHaveBeenCalled();
  });

  test('should emit navigation events', async () => {
    const successSpy = vi.fn();
    fixture.on('navigation:success', successSpy);

    await fixture.setup();
    await fixture.navigateTo('http://localhost:3000');

    expect(successSpy).toHaveBeenCalledWith({
      url: 'http://localhost:3000',
      attempt: 0,
    });
  });

  test('should emit screenshot events', async () => {
    const screenshotSpy = vi.fn();
    fixture.on('screenshot:taken', screenshotSpy);

    await fixture.setup();
    await fixture.screenshot('test');

    expect(screenshotSpy).toHaveBeenCalledWith({
      name: 'test',
      filepath: expect.stringContaining('test'),
    });
  });
});

describe('Resource Cleanup', () => {
  test('should cleanup resources on teardown', async () => {
    const fixture = new BrowserFixture();
    await fixture.setup();

    await fixture.teardown();

    expect(mockBrowser.close).toHaveBeenCalled();
    expect(mockContext.close).toHaveBeenCalled();
  });

  test('should handle partial cleanup on setup failure', async () => {
    const { chromium } = await import('playwright');

    // Setup will partially succeed (browser launches) but fail during context creation
    chromium.launch.mockResolvedValueOnce(mockBrowser);
    mockBrowser.newContext.mockRejectedValueOnce(new Error('Context creation failed'));

    const fixture = new BrowserFixture();

    await expect(fixture.setup()).rejects.toThrow();

    // Should still cleanup the browser that was created
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  test('should handle multiple teardown calls safely', async () => {
    const fixture = new BrowserFixture();
    await fixture.setup();

    // Multiple teardown calls should not cause issues
    await fixture.teardown();
    await fixture.teardown();
    await fixture.teardown();

    // Browser should only be closed once (additional calls are no-ops)
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });
});