/**
 * @fileoverview Integration test for browser fixtures module
 *
 * This is a simple integration test to verify the browser fixtures module
 * can be imported and basic functionality works.
 */

import { describe, test, expect, vi } from 'vitest';

// Mock Playwright before importing
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn(),
          setDefaultTimeout: vi.fn(),
          on: vi.fn(),
          off: vi.fn(),
        }),
        close: vi.fn(),
        tracing: {
          start: vi.fn(),
          stop: vi.fn(),
        },
      }),
      close: vi.fn(),
    }),
  },
  firefox: { launch: vi.fn() },
  webkit: { launch: vi.fn() },
}));

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdtemp: vi.fn().mockResolvedValue('/tmp/test-123'),
}));

describe('Browser Fixtures Integration', () => {
  test('should import browser fixtures module successfully', async () => {
    const module = await import('./browser-fixtures.js');

    expect(module.BrowserFixture).toBeDefined();
    expect(module.setupBrowserFixture).toBeDefined();
    expect(module.createScopedBrowserFixture).toBeDefined();
    expect(module.DEFAULT_BROWSER_CONFIG).toBeDefined();
    expect(module.PageUtils).toBeDefined();
  });

  test('should create browser fixture instance', async () => {
    const { BrowserFixture } = await import('./browser-fixtures.js');

    const fixture = new BrowserFixture({
      browserType: 'chromium',
      headless: true,
    });

    expect(fixture).toBeDefined();
    expect(fixture.getConfig()).toBeDefined();
  });

  test('should create test pages with PageUtils', async () => {
    const { PageUtils } = await import('./browser-fixtures.js');

    const simplePageHtml = PageUtils.createSimpleTestPage();
    const formPageHtml = PageUtils.createFormTestPage();

    expect(simplePageHtml).toContain('<!DOCTYPE html>');
    expect(simplePageHtml).toContain('<title>Test Page</title>');

    expect(formPageHtml).toContain('<!DOCTYPE html>');
    expect(formPageHtml).toContain('<form id="test-form">');
  });

  test('should have valid default configuration', async () => {
    const { DEFAULT_BROWSER_CONFIG } = await import('./browser-fixtures.js');

    expect(DEFAULT_BROWSER_CONFIG.browserType).toMatch(/^(chromium|firefox|webkit)$/);
    expect(DEFAULT_BROWSER_CONFIG.timeout).toBeGreaterThan(0);
    expect(DEFAULT_BROWSER_CONFIG.viewport.width).toBeGreaterThan(0);
    expect(DEFAULT_BROWSER_CONFIG.viewport.height).toBeGreaterThan(0);
  });
});