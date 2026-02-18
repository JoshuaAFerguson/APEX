/**
 * @fileoverview Simple navigation demonstration test
 *
 * This test demonstrates that the page navigation infrastructure is working
 * by running a basic navigation scenario. It serves as both a validation
 * of the infrastructure and a simple example of how to use the navigation
 * testing utilities.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import {
  createNavigationBrowser,
  createNavigationContext,
  createNavigationPage,
} from './setup';
import { safeNavigate, validateNavigation } from './utils/navigation-helpers';

describe('Simple Navigation Demo', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let baseUrl: string;

  beforeEach(async () => {
    browser = await createNavigationBrowser();
    context = await createNavigationContext(browser);
    page = await createNavigationPage(context);
    baseUrl = `http://localhost:${globalThis.navigationTestContext.mockServerPort}`;
  });

  afterEach(async () => {
    await page?.close();
    await context?.close();
    await browser?.close();
  });

  it('should successfully navigate to home page and validate content', async () => {
    // Navigate to home page
    const success = await safeNavigate(page, `${baseUrl}/`);
    expect(success).toBe(true);

    // Validate navigation state
    const validation = await validateNavigation(page, {
      url: `${baseUrl}/`,
      title: 'Navigation Test Home',
      hasElement: 'h1',
      textContent: { selector: 'h1', text: 'Navigation Test Home' },
    });

    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    console.log('✅ Navigation demo test completed successfully!');
    console.log(`📍 Navigated to: ${page.url()}`);
    console.log(`📄 Page title: ${await page.title()}`);
  });

  it('should successfully navigate between pages', async () => {
    // Start at home
    await safeNavigate(page, `${baseUrl}/`);

    // Navigate to page 1
    await page.click('a[href="/page1"]');
    await page.waitForLoadState('networkidle');

    const page1Validation = await validateNavigation(page, {
      url: `${baseUrl}/page1`,
      title: 'Navigation Test - Page 1',
    });
    expect(page1Validation.valid).toBe(true);

    // Navigate to page 2
    await page.click('a[href="/page2"]');
    await page.waitForLoadState('networkidle');

    const page2Validation = await validateNavigation(page, {
      url: `${baseUrl}/page2`,
      title: 'Navigation Test - Page 2',
    });
    expect(page2Validation.valid).toBe(true);

    console.log('✅ Multi-page navigation demo completed successfully!');
    console.log(`📍 Final URL: ${page.url()}`);
  });
});