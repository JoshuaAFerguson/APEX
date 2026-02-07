/**
 * @fileoverview Navigation test helper utilities for APEX integration testing
 *
 * This file provides utility functions for:
 * - Navigation state validation
 * - Performance measurement during navigation
 * - History management testing
 * - URL validation and manipulation
 * - Navigation event monitoring
 * - Screenshot capture for navigation debugging
 */

import { Page, BrowserContext } from 'playwright';
import { captureNavigationScreenshot } from '../setup';
import * as path from 'path';

// Navigation validation types
export interface NavigationValidation {
  url?: string | RegExp;
  title?: string | RegExp;
  historyLength?: number;
  performanceThreshold?: number;
  hasElement?: string;
  textContent?: { selector: string; text: string | RegExp };
}

export interface NavigationPerformance {
  domContentLoaded: number;
  loadComplete: number;
  firstPaint: number;
  firstContentfulPaint: number;
  totalNavigationTime: number;
  timestamp: number;
  url: string;
}

export interface NavigationHistory {
  length: number;
  currentIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;
  entries: string[];
}

/**
 * Safely navigates to a URL with error handling and timeout
 */
export async function safeNavigate(
  page: Page,
  url: string,
  options: {
    timeout?: number;
    waitUntil?: 'networkidle' | 'domcontentloaded' | 'load';
    retries?: number;
  } = {}
): Promise<boolean> {
  const { timeout = 30000, waitUntil = 'networkidle', retries = 2 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await page.goto(url, { timeout, waitUntil });
      return true;
    } catch (error) {
      console.warn(`Navigation attempt ${attempt + 1} failed:`, error);
      if (attempt === retries) {
        console.error(`Failed to navigate to ${url} after ${retries + 1} attempts`);
        return false;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}

/**
 * Safely clicks a link with navigation handling
 */
export async function safeNavigationClick(
  page: Page,
  selector: string,
  options: {
    timeout?: number;
    waitForNavigation?: boolean;
    retries?: number;
  } = {}
): Promise<boolean> {
  const { timeout = 30000, waitForNavigation = true, retries = 2 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (waitForNavigation) {
        await Promise.all([
          page.waitForLoadState('networkidle', { timeout }),
          page.click(selector, { timeout }),
        ]);
      } else {
        await page.click(selector, { timeout });
      }
      return true;
    } catch (error) {
      console.warn(`Navigation click attempt ${attempt + 1} failed:`, error);
      if (attempt === retries) {
        console.error(`Failed to click ${selector} after ${retries + 1} attempts`);
        return false;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return false;
}

/**
 * Validates navigation state against expected conditions
 */
export async function validateNavigation(
  page: Page,
  validation: NavigationValidation
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    // URL validation
    if (validation.url) {
      const currentUrl = page.url();
      const urlMatches = typeof validation.url === 'string'
        ? currentUrl === validation.url
        : validation.url.test(currentUrl);

      if (!urlMatches) {
        errors.push(`URL mismatch: expected ${validation.url}, got ${currentUrl}`);
      }
    }

    // Title validation
    if (validation.title) {
      const currentTitle = await page.title();
      const titleMatches = typeof validation.title === 'string'
        ? currentTitle === validation.title
        : validation.title.test(currentTitle);

      if (!titleMatches) {
        errors.push(`Title mismatch: expected ${validation.title}, got ${currentTitle}`);
      }
    }

    // History length validation
    if (validation.historyLength !== undefined) {
      const historyLength = await page.evaluate(() => history.length);
      if (historyLength !== validation.historyLength) {
        errors.push(`History length mismatch: expected ${validation.historyLength}, got ${historyLength}`);
      }
    }

    // Element presence validation
    if (validation.hasElement) {
      const elementExists = await page.locator(validation.hasElement).count() > 0;
      if (!elementExists) {
        errors.push(`Expected element not found: ${validation.hasElement}`);
      }
    }

    // Text content validation
    if (validation.textContent) {
      try {
        const element = page.locator(validation.textContent.selector);
        const textContent = await element.textContent();
        if (textContent) {
          const textMatches = typeof validation.textContent.text === 'string'
            ? textContent.includes(validation.textContent.text)
            : validation.textContent.text.test(textContent);

          if (!textMatches) {
            errors.push(`Text content mismatch in ${validation.textContent.selector}: expected ${validation.textContent.text}, got ${textContent}`);
          }
        } else {
          errors.push(`No text content found in ${validation.textContent.selector}`);
        }
      } catch (error) {
        errors.push(`Failed to get text content from ${validation.textContent.selector}: ${error}`);
      }
    }

  } catch (error) {
    errors.push(`Validation error: ${error}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Measures navigation performance
 */
export async function measureNavigationPerformance(page: Page): Promise<NavigationPerformance> {
  return await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paintEntries = performance.getEntriesByType('paint');

    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint')?.startTime || 0;
    const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0;

    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      firstPaint,
      firstContentfulPaint,
      totalNavigationTime: navigation.loadEventEnd - navigation.navigationStart,
      timestamp: Date.now(),
      url: window.location.href,
    };
  });
}

/**
 * Gets detailed navigation history information
 */
export async function getNavigationHistory(page: Page): Promise<NavigationHistory> {
  const historyInfo = await page.evaluate(() => {
    return {
      length: history.length,
      href: window.location.href,
    };
  });

  // Note: Due to security restrictions, we can't access the actual history entries
  // but we can determine navigation capabilities
  const canGoBack = await page.evaluate(() => window.history.length > 1);
  const canGoForward = false; // This would need more complex tracking

  return {
    length: historyInfo.length,
    currentIndex: historyInfo.length - 1, // Estimated
    canGoBack,
    canGoForward,
    entries: [historyInfo.href], // Limited due to security
  };
}

/**
 * Waits for navigation to complete with comprehensive checks
 */
export async function waitForNavigationComplete(
  page: Page,
  options: {
    timeout?: number;
    waitForSelector?: string;
    expectedUrl?: string | RegExp;
  } = {}
): Promise<boolean> {
  const { timeout = 30000, waitForSelector, expectedUrl } = options;

  try {
    // Wait for basic load states
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout }),
      page.waitForLoadState('domcontentloaded', { timeout }),
    ]);

    // Wait for specific selector if provided
    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout, state: 'visible' });
    }

    // Validate URL if expected
    if (expectedUrl) {
      let urlMatches = false;
      const startTime = Date.now();

      while (!urlMatches && Date.now() - startTime < timeout) {
        const currentUrl = page.url();
        urlMatches = typeof expectedUrl === 'string'
          ? currentUrl === expectedUrl
          : expectedUrl.test(currentUrl);

        if (!urlMatches) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (!urlMatches) {
        throw new Error(`Navigation URL validation failed: expected ${expectedUrl}, got ${page.url()}`);
      }
    }

    return true;
  } catch (error) {
    console.error('Navigation completion failed:', error);
    return false;
  }
}

/**
 * Performs browser back navigation with validation
 */
export async function navigateBack(
  page: Page,
  validation?: NavigationValidation
): Promise<boolean> {
  try {
    await Promise.all([
      page.waitForLoadState('networkidle'),
      page.goBack(),
    ]);

    if (validation) {
      const result = await validateNavigation(page, validation);
      if (!result.valid) {
        console.error('Back navigation validation failed:', result.errors);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Back navigation failed:', error);
    return false;
  }
}

/**
 * Performs browser forward navigation with validation
 */
export async function navigateForward(
  page: Page,
  validation?: NavigationValidation
): Promise<boolean> {
  try {
    await Promise.all([
      page.waitForLoadState('networkidle'),
      page.goForward(),
    ]);

    if (validation) {
      const result = await validateNavigation(page, validation);
      if (!result.valid) {
        console.error('Forward navigation validation failed:', result.errors);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Forward navigation failed:', error);
    return false;
  }
}

/**
 * Performs page reload with validation
 */
export async function reloadPage(
  page: Page,
  validation?: NavigationValidation
): Promise<boolean> {
  try {
    await Promise.all([
      page.waitForLoadState('networkidle'),
      page.reload(),
    ]);

    if (validation) {
      const result = await validateNavigation(page, validation);
      if (!result.valid) {
        console.error('Reload validation failed:', result.errors);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Page reload failed:', error);
    return false;
  }
}

/**
 * Creates a detailed navigation state snapshot
 */
export async function captureNavigationSnapshot(
  page: Page,
  name: string,
  tempDir: string
): Promise<{
  screenshot: string;
  performance: NavigationPerformance;
  history: NavigationHistory;
  validation: any;
}> {
  // Capture screenshot
  const screenshot = await captureNavigationScreenshot(page, name, tempDir);

  // Measure performance
  const performance = await measureNavigationPerformance(page);

  // Get history info
  const history = await getNavigationHistory(page);

  // Basic validation info
  const validation = {
    url: page.url(),
    title: await page.title(),
    timestamp: Date.now(),
  };

  return {
    screenshot,
    performance,
    history,
    validation,
  };
}

/**
 * Monitors navigation events during test execution
 */
export class NavigationEventMonitor {
  private events: Array<{ type: string; url: string; timestamp: number }> = [];
  private page: Page;

  constructor(page: Page) {
    this.page = page;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.page.on('framenavigated', (frame) => {
      if (frame === this.page.mainFrame()) {
        this.events.push({
          type: 'framenavigated',
          url: frame.url(),
          timestamp: Date.now(),
        });
      }
    });

    this.page.on('load', () => {
      this.events.push({
        type: 'load',
        url: this.page.url(),
        timestamp: Date.now(),
      });
    });

    this.page.on('domcontentloaded', () => {
      this.events.push({
        type: 'domcontentloaded',
        url: this.page.url(),
        timestamp: Date.now(),
      });
    });
  }

  getEvents(): Array<{ type: string; url: string; timestamp: number }> {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
  }

  getNavigationCount(): number {
    return this.events.filter(event => event.type === 'framenavigated').length;
  }

  getLoadEvents(): Array<{ type: string; url: string; timestamp: number }> {
    return this.events.filter(event => event.type === 'load');
  }
}

/**
 * Utility to test navigation across multiple browser contexts
 */
export async function testCrossContextNavigation(
  contexts: BrowserContext[],
  url: string,
  validation?: NavigationValidation
): Promise<boolean[]> {
  const results = await Promise.all(
    contexts.map(async (context) => {
      try {
        const page = await context.newPage();
        const success = await safeNavigate(page, url);

        if (success && validation) {
          const validationResult = await validateNavigation(page, validation);
          await page.close();
          return validationResult.valid;
        }

        await page.close();
        return success;
      } catch (error) {
        console.error('Cross-context navigation failed:', error);
        return false;
      }
    })
  );

  return results;
}

/**
 * Utility to measure navigation performance across multiple iterations
 */
export async function benchmarkNavigation(
  page: Page,
  url: string,
  iterations: number = 5
): Promise<{
  average: number;
  min: number;
  max: number;
  results: NavigationPerformance[];
}> {
  const results: NavigationPerformance[] = [];

  for (let i = 0; i < iterations; i++) {
    const startTime = Date.now();
    await safeNavigate(page, url);
    const performance = await measureNavigationPerformance(page);
    results.push(performance);

    // Small delay between iterations
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const times = results.map(r => r.totalNavigationTime);

  return {
    average: times.reduce((sum, time) => sum + time, 0) / times.length,
    min: Math.min(...times),
    max: Math.max(...times),
    results,
  };
}

// Re-export types for convenient access
export type {
  NavigationValidation,
  NavigationPerformance,
  NavigationHistory,
};