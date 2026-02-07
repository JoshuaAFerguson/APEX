/**
 * @fileoverview Setup file for APEX page navigation integration tests
 *
 * This file provides:
 * - Global browser instance management for navigation testing
 * - Setup and teardown utilities for navigation test scenarios
 * - Mock server lifecycle management for controlled navigation
 * - Navigation-specific browser configuration and utilities
 * - Cleanup hooks for browser resources and navigation state
 * - Performance monitoring setup for navigation testing
 * - Navigation history management utilities
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import { chromium, firefox, webkit } from 'playwright';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createServer } from 'http';
import type { Server } from 'http';

// Global test state for navigation testing
export interface NavigationTestContext {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  tempDir?: string;
  screenshots?: string[];
  mockServer?: Server;
  mockServerPort?: number;
  navigationHistory?: string[];
  performanceMetrics?: Record<string, any>[];
}

// Global context shared across tests
declare global {
  var navigationTestContext: NavigationTestContext;
}

// Navigation test configuration
export interface NavigationTestConfig {
  backend: 'playwright' | 'puppeteer';
  browserType: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  viewport: { width: number; height: number };
  slowMo?: number;
  devtools?: boolean;
  recordNavigationHistory?: boolean;
  measurePerformance?: boolean;
}

// Default navigation test configuration
export const DEFAULT_NAVIGATION_CONFIG: NavigationTestConfig = {
  backend: 'playwright',
  browserType: 'chromium',
  headless: process.env.CI === 'true' || process.env.BROWSER_TEST_HEADLESS === 'true',
  viewport: { width: 1280, height: 720 },
  slowMo: process.env.CI ? 0 : 100,
  devtools: false,
  recordNavigationHistory: true,
  measurePerformance: true,
};

/**
 * Creates a temporary directory for navigation test artifacts
 */
async function createTempDir(): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-navigation-test-'));
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
 * Creates a browser instance for navigation testing
 */
export async function createNavigationBrowser(config: Partial<NavigationTestConfig> = {}): Promise<Browser> {
  const testConfig = { ...DEFAULT_NAVIGATION_CONFIG, ...config };

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
    // Enable navigation-specific features
    args: [
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
    ],
  });

  return browser;
}

/**
 * Creates a browser context with navigation-specific settings
 */
export async function createNavigationContext(
  browser: Browser,
  config: Partial<NavigationTestConfig> = {}
): Promise<BrowserContext> {
  const testConfig = { ...DEFAULT_NAVIGATION_CONFIG, ...config };

  const context = await browser.newContext({
    viewport: testConfig.viewport,
    // Disable animations for consistent navigation timing
    reducedMotion: 'reduce',
    // Set consistent timezone
    timezoneId: 'UTC',
    // Enable navigation features
    recordHar: testConfig.measurePerformance ? { path: path.join(globalThis.navigationTestContext.tempDir!, 'navigation.har') } : undefined,
    recordVideo: process.env.CI ? undefined : { dir: globalThis.navigationTestContext.tempDir! },
  });

  return context;
}

/**
 * Creates a new page with navigation tracking
 */
export async function createNavigationPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();

  // Set default timeout for navigation operations
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(45000);

  // Track navigation events if enabled
  if (DEFAULT_NAVIGATION_CONFIG.recordNavigationHistory) {
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        globalThis.navigationTestContext.navigationHistory?.push(frame.url());
      }
    });
  }

  // Track performance metrics if enabled
  if (DEFAULT_NAVIGATION_CONFIG.measurePerformance) {
    page.on('load', async () => {
      try {
        const metrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          return {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
            firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
            firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
            timestamp: Date.now(),
            url: window.location.href,
          };
        });
        globalThis.navigationTestContext.performanceMetrics?.push(metrics);
      } catch (error) {
        console.warn('Failed to capture performance metrics:', error);
      }
    });
  }

  return page;
}

/**
 * Creates a mock server for navigation testing
 */
export async function createMockServer(): Promise<{ server: Server; port: number }> {
  const server = createServer((req, res) => {
    const url = req.url || '/';

    // Enable CORS for testing
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Route handling for navigation scenarios
    if (url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(createHomePage());
    } else if (url === '/page1') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(createTestPage('Page 1', '/page2'));
    } else if (url === '/page2') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(createTestPage('Page 2', '/page3'));
    } else if (url === '/page3') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(createTestPage('Page 3', '/'));
    } else if (url.startsWith('/redirect')) {
      const target = new URL(url, 'http://localhost').searchParams.get('to') || '/';
      res.writeHead(302, { 'Location': target });
      res.end();
    } else if (url === '/slow') {
      // Simulate slow loading page
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(createTestPage('Slow Page', '/'));
      }, 2000);
    } else if (url === '/error') {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Server Error</h1></body></html>');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Page Not Found</h1></body></html>');
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(0, 'localhost', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        resolve({ server, port: address.port });
      } else {
        reject(new Error('Failed to start mock server'));
      }
    });
  });
}

/**
 * Creates the home page HTML
 */
function createHomePage(): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Navigation Test Home</title>
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
        .nav-button {
          background: #007acc;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          margin: 10px 5px;
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
        <h1>Navigation Test Home</h1>
        <p>This is the home page for navigation testing.</p>

        <nav>
          <a href="/page1" class="nav-button">Go to Page 1</a>
          <a href="/page2" class="nav-button">Go to Page 2</a>
          <a href="/page3" class="nav-button">Go to Page 3</a>
          <a href="/slow" class="nav-button">Slow Page</a>
          <a href="/redirect?to=/page1" class="nav-button">Redirect Test</a>
          <a href="/error" class="nav-button">Error Page</a>
        </nav>

        <div id="content">
          <p>Current URL: <span id="current-url"></span></p>
          <p>Timestamp: <span id="timestamp"></span></p>
        </div>
      </div>

      <script>
        document.getElementById('current-url').textContent = window.location.href;
        document.getElementById('timestamp').textContent = new Date().toISOString();
        console.log('Home page loaded');
      </script>
    </body>
    </html>
  `;
}

/**
 * Creates a test page HTML with navigation
 */
function createTestPage(title: string, nextPage: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Navigation Test - ${title}</title>
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
        .nav-button {
          background: #007acc;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          margin: 10px 5px;
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
        <h1>${title}</h1>
        <p>This is ${title} for navigation testing.</p>

        <nav>
          <a href="/" class="nav-button">Home</a>
          <a href="${nextPage}" class="nav-button">Next Page</a>
          <button class="nav-button" onclick="history.back()">Back</button>
          <button class="nav-button" onclick="history.forward()">Forward</button>
          <button class="nav-button" onclick="location.reload()">Reload</button>
        </nav>

        <div id="content">
          <p>Current URL: <span id="current-url"></span></p>
          <p>Timestamp: <span id="timestamp"></span></p>
          <p>History Length: <span id="history-length"></span></p>
        </div>
      </div>

      <script>
        document.getElementById('current-url').textContent = window.location.href;
        document.getElementById('timestamp').textContent = new Date().toISOString();
        document.getElementById('history-length').textContent = history.length;
        console.log('${title} loaded');
      </script>
    </body>
    </html>
  `;
}

/**
 * Captures a screenshot for navigation testing
 */
export async function captureNavigationScreenshot(
  page: Page,
  name: string,
  tempDir: string
): Promise<string> {
  const screenshotPath = path.join(tempDir, `navigation-${name}-${Date.now()}.png`);
  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
  });
  return screenshotPath;
}

/**
 * Waits for navigation to complete with additional checks
 */
export async function waitForNavigationComplete(page: Page, timeout = 30000): Promise<void> {
  await Promise.all([
    page.waitForLoadState('networkidle', { timeout }),
    page.waitForLoadState('domcontentloaded', { timeout }),
  ]);
}

/**
 * Gets navigation performance metrics
 */
export async function getNavigationMetrics(page: Page): Promise<any> {
  return await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
      firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
      url: window.location.href,
      timestamp: Date.now(),
    };
  });
}

// Global setup and teardown hooks
beforeAll(async () => {
  // Initialize global navigation test context
  globalThis.navigationTestContext = {
    screenshots: [],
    navigationHistory: [],
    performanceMetrics: [],
  };

  // Create temporary directory for test artifacts
  globalThis.navigationTestContext.tempDir = await createTempDir();

  // Start mock server
  const { server, port } = await createMockServer();
  globalThis.navigationTestContext.mockServer = server;
  globalThis.navigationTestContext.mockServerPort = port;

  console.log(`Navigation test temp directory: ${globalThis.navigationTestContext.tempDir}`);
  console.log(`Mock server started on port: ${port}`);
});

afterAll(async () => {
  // Cleanup browser resources
  if (globalThis.navigationTestContext.page) {
    await globalThis.navigationTestContext.page.close();
  }

  if (globalThis.navigationTestContext.context) {
    await globalThis.navigationTestContext.context.close();
  }

  if (globalThis.navigationTestContext.browser) {
    await globalThis.navigationTestContext.browser.close();
  }

  // Stop mock server
  if (globalThis.navigationTestContext.mockServer) {
    globalThis.navigationTestContext.mockServer.close();
  }

  // Cleanup temporary directory
  if (globalThis.navigationTestContext.tempDir) {
    await cleanupTempDir(globalThis.navigationTestContext.tempDir);
  }

  console.log('Navigation test cleanup completed');
});

// Per-test setup and teardown
beforeEach(async () => {
  // Reset navigation history
  globalThis.navigationTestContext.navigationHistory = [];
  globalThis.navigationTestContext.performanceMetrics = [];

  // Reset browser state for each test
  if (globalThis.navigationTestContext.page) {
    // Clear cookies and local storage
    await globalThis.navigationTestContext.page.context().clearCookies();
    await globalThis.navigationTestContext.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }
});

afterEach(async () => {
  // Capture screenshot on test failure for debugging
  if (globalThis.navigationTestContext.page && globalThis.navigationTestContext.tempDir) {
    try {
      const screenshot = await captureNavigationScreenshot(
        globalThis.navigationTestContext.page,
        'test-failure',
        globalThis.navigationTestContext.tempDir
      );
      globalThis.navigationTestContext.screenshots?.push(screenshot);
    } catch (error) {
      console.warn('Failed to capture failure screenshot:', error);
    }
  }
});

// Mock navigation dependencies for tests that don't need actual browsers
export function mockNavigationDependencies() {
  vi.mock('playwright', () => ({
    chromium: {
      launch: vi.fn().mockResolvedValue({
        newContext: vi.fn().mockResolvedValue({
          newPage: vi.fn().mockResolvedValue({
            goto: vi.fn(),
            goBack: vi.fn(),
            goForward: vi.fn(),
            reload: vi.fn(),
            url: vi.fn().mockReturnValue('http://localhost:3000/'),
            screenshot: vi.fn(),
            close: vi.fn(),
            on: vi.fn(),
            evaluate: vi.fn(),
            waitForLoadState: vi.fn(),
          }),
          close: vi.fn(),
          clearCookies: vi.fn(),
        }),
        close: vi.fn(),
      }),
    },
  }));
}

// Export utilities for test files
export {
  NavigationTestConfig,
  NavigationTestContext,
  DEFAULT_NAVIGATION_CONFIG,
  createTempDir,
  cleanupTempDir,
  createMockServer,
};