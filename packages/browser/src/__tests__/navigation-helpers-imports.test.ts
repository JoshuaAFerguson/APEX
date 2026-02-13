/**
 * Simple import verification test to check that our navigation helpers
 * can be imported without compilation errors
 */

import { describe, it, expect } from 'vitest';

describe('Navigation Helpers Imports', () => {
  it('should import navigation helper functions correctly', async () => {
    // Test direct imports from navigation-helpers module
    const helpers = await import('../navigation-helpers.js');

    expect(typeof helpers.goto).toBe('function');
    expect(typeof helpers.waitForNavigation).toBe('function');
    expect(typeof helpers.assertURL).toBe('function');
    expect(typeof helpers.assertPageContent).toBe('function');
  });

  it('should import navigation helpers from test-utils', async () => {
    // Test imports from test-utils barrel export
    const testUtils = await import('../test-utils.js');

    expect(typeof testUtils.goto).toBe('function');
    expect(typeof testUtils.waitForNavigation).toBe('function');
    expect(typeof testUtils.assertURL).toBe('function');
    expect(typeof testUtils.assertPageContent).toBe('function');
  });

  it('should import navigation helpers from main browser package', async () => {
    // Test imports from main package index
    const browser = await import('../index.js');

    expect(typeof browser.goto).toBe('function');
    expect(typeof browser.waitForNavigation).toBe('function');
    expect(typeof browser.assertURL).toBe('function');
    expect(typeof browser.assertPageContent).toBe('function');
  });
});