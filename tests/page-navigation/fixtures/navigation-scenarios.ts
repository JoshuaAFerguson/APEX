/**
 * @fileoverview Navigation test scenarios and fixtures for APEX integration testing
 *
 * This file provides reusable navigation test scenarios that cover:
 * - Basic navigation flows (forward, back, refresh)
 * - URL routing and parameter validation
 * - Navigation history management
 * - Cross-origin navigation testing
 * - Error handling during navigation
 * - Performance validation for navigation
 */

import { Page } from 'playwright';
import { waitForNavigationComplete, getNavigationMetrics, captureNavigationScreenshot } from '../setup';

// Navigation scenario types
export interface NavigationScenario {
  name: string;
  description: string;
  steps: NavigationStep[];
  expectedOutcome: ExpectedOutcome;
  timeout?: number;
}

export interface NavigationStep {
  type: 'goto' | 'click' | 'back' | 'forward' | 'reload' | 'wait' | 'evaluate';
  target?: string;
  selector?: string;
  code?: string;
  timeout?: number;
  expectNavigation?: boolean;
}

export interface ExpectedOutcome {
  finalUrl?: string;
  urlPattern?: RegExp;
  historyLength?: number;
  pageTitle?: string;
  performanceThreshold?: number; // Maximum load time in ms
  errorExpected?: boolean;
}

// Common navigation test scenarios
export const NAVIGATION_SCENARIOS: NavigationScenario[] = [
  {
    name: 'basic-page-navigation',
    description: 'Navigate between pages using links',
    steps: [
      { type: 'goto', target: '/', expectNavigation: true },
      { type: 'click', selector: 'a[href="/page1"]', expectNavigation: true },
      { type: 'wait', timeout: 1000 },
      { type: 'click', selector: 'a[href="/page2"]', expectNavigation: true },
    ],
    expectedOutcome: {
      urlPattern: /\/page2$/,
      pageTitle: 'Navigation Test - Page 2',
      historyLength: 3,
      performanceThreshold: 5000,
    },
  },
  {
    name: 'browser-history-navigation',
    description: 'Use browser back and forward buttons',
    steps: [
      { type: 'goto', target: '/', expectNavigation: true },
      { type: 'click', selector: 'a[href="/page1"]', expectNavigation: true },
      { type: 'click', selector: 'a[href="/page2"]', expectNavigation: true },
      { type: 'back', expectNavigation: true },
      { type: 'wait', timeout: 500 },
      { type: 'forward', expectNavigation: true },
    ],
    expectedOutcome: {
      urlPattern: /\/page2$/,
      historyLength: 3,
    },
  },
  {
    name: 'page-reload',
    description: 'Reload current page',
    steps: [
      { type: 'goto', target: '/page1', expectNavigation: true },
      { type: 'wait', timeout: 1000 },
      { type: 'reload', expectNavigation: true },
    ],
    expectedOutcome: {
      urlPattern: /\/page1$/,
      pageTitle: 'Navigation Test - Page 1',
    },
  },
  {
    name: 'redirect-handling',
    description: 'Handle HTTP redirects',
    steps: [
      { type: 'goto', target: '/redirect?to=/page2', expectNavigation: true },
    ],
    expectedOutcome: {
      urlPattern: /\/page2$/,
      pageTitle: 'Navigation Test - Page 2',
    },
  },
  {
    name: 'slow-page-loading',
    description: 'Handle slow loading pages',
    steps: [
      { type: 'goto', target: '/slow', expectNavigation: true, timeout: 10000 },
    ],
    expectedOutcome: {
      urlPattern: /\/slow$/,
      pageTitle: 'Navigation Test - Slow Page',
      performanceThreshold: 8000,
    },
    timeout: 15000,
  },
  {
    name: 'error-page-handling',
    description: 'Handle server errors during navigation',
    steps: [
      { type: 'goto', target: '/error', expectNavigation: true },
    ],
    expectedOutcome: {
      urlPattern: /\/error$/,
      errorExpected: true,
    },
  },
  {
    name: 'complex-navigation-flow',
    description: 'Multi-step navigation with various interactions',
    steps: [
      { type: 'goto', target: '/', expectNavigation: true },
      { type: 'click', selector: 'a[href="/page1"]', expectNavigation: true },
      { type: 'click', selector: 'a[href="/page2"]', expectNavigation: true },
      { type: 'back', expectNavigation: true },
      { type: 'click', selector: 'a[href="/page3"]', expectNavigation: true },
      { type: 'click', selector: 'a[href="/"]', expectNavigation: true },
    ],
    expectedOutcome: {
      urlPattern: /\/$/,
      pageTitle: 'Navigation Test Home',
      historyLength: 6,
    },
  },
];

/**
 * Runs a navigation scenario on the provided page
 */
export async function runNavigationScenario(
  page: Page,
  scenario: NavigationScenario,
  baseUrl: string
): Promise<{ success: boolean; metrics: any; error?: Error }> {
  const startTime = Date.now();
  let navigationMetrics: any[] = [];

  try {
    console.log(`Running navigation scenario: ${scenario.name}`);

    for (const step of scenario.steps) {
      console.log(`  Executing step: ${step.type}${step.target || step.selector ? ` (${step.target || step.selector})` : ''}`);

      switch (step.type) {
        case 'goto':
          const url = step.target!.startsWith('http') ? step.target! : `${baseUrl}${step.target}`;

          if (step.expectNavigation) {
            await Promise.all([
              page.waitForLoadState('networkidle', { timeout: step.timeout || 30000 }),
              page.goto(url, { timeout: step.timeout || 30000 }),
            ]);
          } else {
            await page.goto(url, { timeout: step.timeout || 30000 });
          }

          navigationMetrics.push(await getNavigationMetrics(page));
          break;

        case 'click':
          if (step.expectNavigation) {
            await Promise.all([
              page.waitForLoadState('networkidle', { timeout: step.timeout || 30000 }),
              page.click(step.selector!, { timeout: step.timeout || 30000 }),
            ]);
            navigationMetrics.push(await getNavigationMetrics(page));
          } else {
            await page.click(step.selector!, { timeout: step.timeout || 30000 });
          }
          break;

        case 'back':
          if (step.expectNavigation) {
            await Promise.all([
              page.waitForLoadState('networkidle', { timeout: step.timeout || 30000 }),
              page.goBack({ timeout: step.timeout || 30000 }),
            ]);
            navigationMetrics.push(await getNavigationMetrics(page));
          } else {
            await page.goBack({ timeout: step.timeout || 30000 });
          }
          break;

        case 'forward':
          if (step.expectNavigation) {
            await Promise.all([
              page.waitForLoadState('networkidle', { timeout: step.timeout || 30000 }),
              page.goForward({ timeout: step.timeout || 30000 }),
            ]);
            navigationMetrics.push(await getNavigationMetrics(page));
          } else {
            await page.goForward({ timeout: step.timeout || 30000 });
          }
          break;

        case 'reload':
          if (step.expectNavigation) {
            await Promise.all([
              page.waitForLoadState('networkidle', { timeout: step.timeout || 30000 }),
              page.reload({ timeout: step.timeout || 30000 }),
            ]);
            navigationMetrics.push(await getNavigationMetrics(page));
          } else {
            await page.reload({ timeout: step.timeout || 30000 });
          }
          break;

        case 'wait':
          await new Promise(resolve => setTimeout(resolve, step.timeout || 1000));
          break;

        case 'evaluate':
          if (step.code) {
            await page.evaluate(step.code);
          }
          break;
      }

      // Small delay between steps for stability
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Validate expected outcome
    const currentUrl = page.url();
    const pageTitle = await page.title();
    const historyLength = await page.evaluate(() => history.length);

    const outcome = scenario.expectedOutcome;

    // URL validation
    if (outcome.finalUrl && currentUrl !== outcome.finalUrl) {
      throw new Error(`Expected final URL ${outcome.finalUrl}, got ${currentUrl}`);
    }

    if (outcome.urlPattern && !outcome.urlPattern.test(currentUrl)) {
      throw new Error(`Expected URL to match ${outcome.urlPattern}, got ${currentUrl}`);
    }

    // Title validation
    if (outcome.pageTitle && pageTitle !== outcome.pageTitle) {
      throw new Error(`Expected page title "${outcome.pageTitle}", got "${pageTitle}"`);
    }

    // History validation
    if (outcome.historyLength && historyLength !== outcome.historyLength) {
      throw new Error(`Expected history length ${outcome.historyLength}, got ${historyLength}`);
    }

    // Performance validation
    if (outcome.performanceThreshold) {
      const totalTime = Date.now() - startTime;
      if (totalTime > outcome.performanceThreshold) {
        throw new Error(`Scenario exceeded performance threshold: ${totalTime}ms > ${outcome.performanceThreshold}ms`);
      }
    }

    console.log(`  Scenario completed successfully in ${Date.now() - startTime}ms`);

    return {
      success: true,
      metrics: {
        duration: Date.now() - startTime,
        navigationMetrics,
        finalUrl: currentUrl,
        pageTitle,
        historyLength,
      },
    };

  } catch (error) {
    const errorInfo = error as Error;

    // Check if error was expected
    if (scenario.expectedOutcome.errorExpected) {
      console.log(`  Expected error occurred: ${errorInfo.message}`);
      return {
        success: true,
        metrics: {
          duration: Date.now() - startTime,
          navigationMetrics,
          error: errorInfo.message,
        },
      };
    }

    console.error(`  Scenario failed: ${errorInfo.message}`);
    return {
      success: false,
      metrics: {
        duration: Date.now() - startTime,
        navigationMetrics,
      },
      error: errorInfo,
    };
  }
}

/**
 * Creates a comprehensive navigation test page
 */
export async function createNavigationTestPage(page: Page, baseUrl: string): Promise<void> {
  const testHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>APEX Navigation Test Page</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 40px;
          background: #f5f5f5;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .nav-section {
          margin: 20px 0;
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .nav-button {
          background: #007acc;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          margin: 5px;
          text-decoration: none;
          display: inline-block;
        }
        .nav-button:hover {
          background: #005a9e;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>APEX Navigation Test Page</h1>

        <div class="nav-section">
          <h2>Basic Navigation</h2>
          <a href="${baseUrl}/" class="nav-button">Home</a>
          <a href="${baseUrl}/page1" class="nav-button">Page 1</a>
          <a href="${baseUrl}/page2" class="nav-button">Page 2</a>
          <a href="${baseUrl}/page3" class="nav-button">Page 3</a>
        </div>

        <div class="nav-section">
          <h2>Browser Controls</h2>
          <button class="nav-button" onclick="history.back()">Back</button>
          <button class="nav-button" onclick="history.forward()">Forward</button>
          <button class="nav-button" onclick="location.reload()">Reload</button>
        </div>

        <div class="nav-section">
          <h2>Special Cases</h2>
          <a href="${baseUrl}/slow" class="nav-button">Slow Page</a>
          <a href="${baseUrl}/redirect?to=${baseUrl}/page1" class="nav-button">Redirect</a>
          <a href="${baseUrl}/error" class="nav-button">Error Page</a>
          <a href="${baseUrl}/404" class="nav-button">Not Found</a>
        </div>

        <div class="nav-section">
          <h2>Navigation Info</h2>
          <p>Current URL: <span id="current-url"></span></p>
          <p>History Length: <span id="history-length"></span></p>
          <p>Page Load Time: <span id="load-time"></span></p>
        </div>
      </div>

      <script>
        function updateNavigationInfo() {
          document.getElementById('current-url').textContent = window.location.href;
          document.getElementById('history-length').textContent = history.length;
        }

        // Track page load time
        window.addEventListener('load', () => {
          const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
          document.getElementById('load-time').textContent = loadTime + 'ms';
          updateNavigationInfo();
        });

        // Update info on navigation
        window.addEventListener('popstate', updateNavigationInfo);
        updateNavigationInfo();

        console.log('Navigation test page loaded');
      </script>
    </body>
    </html>
  `;

  await page.setContent(testHTML);
  await waitForNavigationComplete(page);
}

/**
 * Verifies navigation state
 */
export async function verifyNavigationState(
  page: Page,
  expectedUrl: string | RegExp,
  expectedTitle?: string
): Promise<boolean> {
  const currentUrl = page.url();
  const currentTitle = await page.title();

  const urlMatch = typeof expectedUrl === 'string'
    ? currentUrl === expectedUrl
    : expectedUrl.test(currentUrl);

  const titleMatch = !expectedTitle || currentTitle === expectedTitle;

  return urlMatch && titleMatch;
}

/**
 * Performance test scenarios
 */
export const PERFORMANCE_NAVIGATION_SCENARIOS: NavigationScenario[] = [
  {
    name: 'fast-navigation-performance',
    description: 'Measure performance of fast navigation',
    steps: [
      { type: 'goto', target: '/', expectNavigation: true },
      { type: 'click', selector: 'a[href="/page1"]', expectNavigation: true },
    ],
    expectedOutcome: {
      performanceThreshold: 2000, // 2 seconds max
    },
  },
  {
    name: 'multiple-navigation-performance',
    description: 'Measure performance across multiple navigations',
    steps: [
      { type: 'goto', target: '/', expectNavigation: true },
      { type: 'click', selector: 'a[href="/page1"]', expectNavigation: true },
      { type: 'click', selector: 'a[href="/page2"]', expectNavigation: true },
      { type: 'click', selector: 'a[href="/page3"]', expectNavigation: true },
      { type: 'click', selector: 'a[href="/"]', expectNavigation: true },
    ],
    expectedOutcome: {
      performanceThreshold: 8000, // 8 seconds max for all navigations
    },
  },
];

// Export all scenarios grouped
export const ALL_NAVIGATION_SCENARIOS = {
  basic: NAVIGATION_SCENARIOS,
  performance: PERFORMANCE_NAVIGATION_SCENARIOS,
};