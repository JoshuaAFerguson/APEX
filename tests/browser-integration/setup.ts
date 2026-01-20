/**
 * @fileoverview Setup file for APEX browser automation integration tests
 *
 * This file provides:
 * - Global browser instance management
 * - Setup and teardown utilities for browser automation tests
 * - Common browser configuration and utilities
 * - Cleanup hooks for browser resources
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import { chromium, firefox, webkit } from 'playwright';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';

// Global test state for browser instances
export interface BrowserTestContext {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  tempDir?: string;
  screenshots?: string[];
}

// Global context shared across tests
declare global {
  var browserTestContext: BrowserTestContext;
}

// Browser test configuration
export interface BrowserTestConfig {
  backend: 'playwright' | 'puppeteer';
  browserType: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  viewport: { width: number; height: number };
  slowMo?: number;
  devtools?: boolean;
}

// Default browser test configuration
export const DEFAULT_BROWSER_CONFIG: BrowserTestConfig = {
  backend: 'playwright',
  browserType: 'chromium',
  headless: process.env.CI === 'true' || process.env.BROWSER_TEST_HEADLESS === 'true',
  viewport: { width: 1280, height: 720 },
  slowMo: process.env.CI ? 0 : 100,
  devtools: false,
};

/**
 * Creates a temporary directory for browser test artifacts
 */
async function createTempDir(): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-browser-test-'));
  return tempDir;
}

/**
 * Cleans up temporary directory and its contents
 */
async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Failed to cleanup temp directory ${tempDir}:`, error);
  }
}

/**
 * Creates a browser instance based on the test configuration
 */
export async function createBrowser(config: Partial<BrowserTestConfig> = {}): Promise<Browser> {
  const testConfig = { ...DEFAULT_BROWSER_CONFIG, ...config };

  let browserType;
  switch (testConfig.browserType) {
    case 'firefox':
      browserType = firefox;
      break;
    case 'webkit':
      browserType = webkit;
      break;
    case 'chromium':
    default:
      browserType = chromium;
      break;
  }

  const browser = await browserType.launch({
    headless: testConfig.headless,
    slowMo: testConfig.slowMo,
    devtools: testConfig.devtools,
  });

  return browser;
}

/**
 * Creates a browser context with default settings
 */
export async function createBrowserContext(
  browser: Browser,
  config: Partial<BrowserTestConfig> = {}
): Promise<BrowserContext> {
  const testConfig = { ...DEFAULT_BROWSER_CONFIG, ...config };

  const context = await browser.newContext({
    viewport: testConfig.viewport,
    // Disable animations for consistent screenshots
    reducedMotion: 'reduce',
    // Set consistent timezone
    timezoneId: 'UTC',
  });

  return context;
}

/**
 * Creates a new page in the browser context
 */
export async function createPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();

  // Set default timeout for page operations
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(30000);

  return page;
}

/**
 * Captures a screenshot and saves it to the temp directory
 */
export async function captureScreenshot(
  page: Page,
  name: string,
  tempDir: string
): Promise<string> {
  const screenshotPath = path.join(tempDir, `${name}-${Date.now()}.png`);
  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
  });

  return screenshotPath;
}

/**
 * Utility function to wait for network idle
 */
export async function waitForNetworkIdle(page: Page, timeout = 30000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Utility function to setup a simple test page
 */
export async function setupTestPage(page: Page): Promise<void> {
  const testHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>APEX Browser Test Page</title>
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
        .button {
          background: #007acc;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          margin: 10px 5px;
        }
        .button:hover {
          background: #005a9e;
        }
        #output {
          margin-top: 20px;
          padding: 10px;
          background: #f0f0f0;
          border-radius: 4px;
          min-height: 100px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>APEX Browser Test Page</h1>
        <p>This page is used for browser automation testing.</p>

        <button class="button" onclick="showMessage()">Click Me</button>
        <button class="button" onclick="changeContent()">Change Content</button>
        <input type="text" id="textInput" placeholder="Enter text here" />
        <button class="button" onclick="processInput()">Process Input</button>

        <div id="output">
          <p>Output will appear here...</p>
        </div>
      </div>

      <script>
        function showMessage() {
          document.getElementById('output').innerHTML =
            '<p style="color: green;">Button clicked at ' + new Date().toISOString() + '</p>';
        }

        function changeContent() {
          document.getElementById('output').innerHTML =
            '<p style="color: blue;">Content changed at ' + new Date().toISOString() + '</p>';
        }

        function processInput() {
          const input = document.getElementById('textInput').value;
          document.getElementById('output').innerHTML =
            '<p style="color: purple;">Processed: "' + input + '" at ' + new Date().toISOString() + '</p>';
        }

        // Simulate console messages for testing
        console.log('Test page loaded');
        console.warn('This is a test warning');
        console.error('This is a test error');
      </script>
    </body>
    </html>
  `;

  await page.setContent(testHTML);
  await page.waitForLoadState('domcontentloaded');
}

// Global setup and teardown hooks
beforeAll(async () => {
  // Initialize global browser test context
  globalThis.browserTestContext = {
    screenshots: [],
  };

  // Create temporary directory for test artifacts
  globalThis.browserTestContext.tempDir = await createTempDir();

  console.log(`Browser test temp directory: ${globalThis.browserTestContext.tempDir}`);
});

afterAll(async () => {
  // Cleanup browser resources
  if (globalThis.browserTestContext.page) {
    await globalThis.browserTestContext.page.close();
  }

  if (globalThis.browserTestContext.context) {
    await globalThis.browserTestContext.context.close();
  }

  if (globalThis.browserTestContext.browser) {
    await globalThis.browserTestContext.browser.close();
  }

  // Cleanup temporary directory
  if (globalThis.browserTestContext.tempDir) {
    await cleanupTempDir(globalThis.browserTestContext.tempDir);
  }

  console.log('Browser test cleanup completed');
});

// Per-test setup and teardown
beforeEach(async () => {
  // Reset browser state for each test
  if (globalThis.browserTestContext.page) {
    // Clear cookies and local storage
    await globalThis.browserTestContext.page.context().clearCookies();
    await globalThis.browserTestContext.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }
});

afterEach(async () => {
  // Capture screenshot on test failure for debugging
  if (globalThis.browserTestContext.page && globalThis.browserTestContext.tempDir) {
    try {
      const screenshot = await captureScreenshot(
        globalThis.browserTestContext.page,
        'test-failure',
        globalThis.browserTestContext.tempDir
      );
      globalThis.browserTestContext.screenshots?.push(screenshot);
    } catch (error) {
      console.warn('Failed to capture failure screenshot:', error);
    }
  }
});

// Mock browser dependencies for tests that don't need actual browsers
export function mockBrowserDependencies() {
  vi.mock('playwright', () => ({
    chromium: {
      launch: vi.fn().mockResolvedValue({
        newContext: vi.fn().mockResolvedValue({
          newPage: vi.fn().mockResolvedValue({
            goto: vi.fn(),
            screenshot: vi.fn(),
            close: vi.fn(),
          }),
          close: vi.fn(),
        }),
        close: vi.fn(),
      }),
    },
    firefox: {
      launch: vi.fn().mockResolvedValue({
        newContext: vi.fn().mockResolvedValue({
          newPage: vi.fn().mockResolvedValue({
            goto: vi.fn(),
            screenshot: vi.fn(),
            close: vi.fn(),
          }),
          close: vi.fn(),
        }),
        close: vi.fn(),
      }),
    },
    webkit: {
      launch: vi.fn().mockResolvedValue({
        newContext: vi.fn().mockResolvedValue({
          newPage: vi.fn().mockResolvedValue({
            goto: vi.fn(),
            screenshot: vi.fn(),
            close: vi.fn(),
          }),
          close: vi.fn(),
        }),
        close: vi.fn(),
      }),
    },
  }));

  vi.mock('puppeteer', () => ({
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn(),
        screenshot: vi.fn(),
        close: vi.fn(),
      }),
      close: vi.fn(),
    }),
  }));
}

// Export utilities for test files
export {
  BrowserTestConfig,
  BrowserTestContext,
  DEFAULT_BROWSER_CONFIG,
  createTempDir,
  cleanupTempDir,
};