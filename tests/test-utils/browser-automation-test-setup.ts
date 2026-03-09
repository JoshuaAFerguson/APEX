/**
 * @fileoverview Browser Automation Test Setup Infrastructure
 *
 * Enhanced test setup infrastructure for browser automation integration testing including:
 * - Comprehensive browser test environment setup and teardown
 * - Test context management with permission simulation
 * - Browser automation mock management
 * - Test lifecycle hooks and utilities
 * - Error handling and cleanup procedures
 *
 * @module tests/test-utils/browser-automation-test-setup
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Import our custom test utilities
import {
  type MockBrowserContext,
  type BrowserMockConfig,
  createMockBrowserContext,
  MockBrowserEnvironment,
} from './browser-automation-mocks.js';
import {
  type BrowserPermissionSimulator,
  createBrowserPermissionSimulator,
  type BrowserPermissionTestContext,
  createBrowserPermissionTestContext,
} from './browser-permission-simulator.js';
import {
  type BrowserTestContext,
  createBrowserTestContext,
  loadTestPage,
  SIMPLE_TEST_PAGE,
} from './browser-test-fixtures.js';

// ============================================================================
// Test Environment Configuration
// ============================================================================

/**
 * Browser automation test environment configuration
 */
export interface BrowserAutomationTestConfig {
  /** Whether to use real browsers or mocks */
  useRealBrowser: boolean;
  /** Browser type for real browser testing */
  browserType: 'chromium' | 'firefox' | 'webkit';
  /** Whether to run in headless mode */
  headless: boolean;
  /** Test timeout in milliseconds */
  timeout: number;
  /** Whether to capture screenshots on failure */
  captureFailureScreenshots: boolean;
  /** Directory for test artifacts */
  artifactDir: string;
  /** Permission testing configuration */
  permissionTesting: {
    enabled: boolean;
    defaultDenials: string[];
    simulateFailures: boolean;
  };
  /** Mock browser configuration */
  mockBrowser: BrowserMockConfig;
}

/**
 * Default test configuration
 */
export const DEFAULT_TEST_CONFIG: BrowserAutomationTestConfig = {
  useRealBrowser: process.env.USE_REAL_BROWSER === 'true',
  browserType: 'chromium',
  headless: process.env.CI === 'true',
  timeout: 30000,
  captureFailureScreenshots: true,
  artifactDir: path.join(process.cwd(), 'test-artifacts', 'browser-automation'),
  permissionTesting: {
    enabled: true,
    defaultDenials: ['dangerous-operation', 'file-system-access'],
    simulateFailures: false,
  },
  mockBrowser: {
    url: 'http://localhost:3000',
    title: 'Test Page',
    simulateSlowNetwork: false,
    simulatePermissionDenials: false,
    viewport: { width: 1280, height: 720 },
  },
};

// ============================================================================
// Test Environment Manager
// ============================================================================

/**
 * Comprehensive browser automation test environment
 */
export class BrowserAutomationTestEnvironment {
  private config: BrowserAutomationTestConfig;
  private realBrowser?: Browser;
  private realContext?: BrowserContext;
  private realPage?: Page;
  private mockEnvironment?: MockBrowserEnvironment;
  private permissionSimulator?: BrowserPermissionSimulator;
  private testContext?: BrowserTestContext;
  private artifactDir?: string;
  private cleanup: (() => Promise<void>)[] = [];

  constructor(config: Partial<BrowserAutomationTestConfig> = {}) {
    this.config = { ...DEFAULT_TEST_CONFIG, ...config };
  }

  /**
   * Setup the test environment
   */
  async setup(): Promise<void> {
    // Create artifact directory
    this.artifactDir = await this.createArtifactDirectory();

    // Setup permission testing if enabled
    if (this.config.permissionTesting.enabled) {
      this.permissionSimulator = createBrowserPermissionSimulator({
        defaultPermissionLevel: 'read',
        denyOperations: this.config.permissionTesting.defaultDenials,
        simulateNetworkFailures: this.config.permissionTesting.simulateFailures,
        responseDelay: 10,
      });
    }

    // Create test context
    this.testContext = createBrowserTestContext();

    if (this.config.useRealBrowser) {
      await this.setupRealBrowser();
    } else {
      await this.setupMockBrowser();
    }
  }

  /**
   * Setup real browser environment
   */
  private async setupRealBrowser(): Promise<void> {
    // Launch browser
    this.realBrowser = await chromium.launch({
      headless: this.config.headless,
      devtools: !this.config.headless && !process.env.CI,
    });

    this.cleanup.push(async () => {
      if (this.realBrowser) {
        await this.realBrowser.close();
      }
    });

    // Create context
    this.realContext = await this.realBrowser.newContext({
      viewport: this.config.mockBrowser.viewport,
      recordVideo: this.config.captureFailureScreenshots ? {
        dir: path.join(this.artifactDir!, 'videos')
      } : undefined,
    });

    this.cleanup.push(async () => {
      if (this.realContext) {
        await this.realContext.close();
      }
    });

    // Create page
    this.realPage = await this.realContext.newPage();
    this.realPage.setDefaultTimeout(this.config.timeout);

    // Setup permission simulator integration
    if (this.permissionSimulator) {
      // Note: In a real implementation, you'd integrate with actual browser permissions
      console.log('Permission simulator initialized for real browser testing');
    }
  }

  /**
   * Setup mock browser environment
   */
  private async setupMockBrowser(): Promise<void> {
    this.mockEnvironment = new MockBrowserEnvironment(this.config.mockBrowser);
    await this.mockEnvironment.setup();

    // Integrate with permission simulator
    if (this.permissionSimulator) {
      this.permissionSimulator.setBrowserContext(this.mockEnvironment.getContext());
    }

    this.cleanup.push(async () => {
      if (this.mockEnvironment) {
        await this.mockEnvironment.teardown();
      }
    });
  }

  /**
   * Get the current page instance (real or mock)
   */
  getPage(): Page | any {
    if (this.config.useRealBrowser) {
      return this.realPage!;
    } else {
      return this.mockEnvironment?.getContext().page;
    }
  }

  /**
   * Get the permission simulator
   */
  getPermissionSimulator(): BrowserPermissionSimulator | undefined {
    return this.permissionSimulator;
  }

  /**
   * Get the test context
   */
  getTestContext(): BrowserTestContext | undefined {
    return this.testContext;
  }

  /**
   * Capture screenshot for debugging
   */
  async captureScreenshot(name: string): Promise<string> {
    const page = this.getPage();
    if (!page || !this.artifactDir) {
      throw new Error('Test environment not properly initialized');
    }

    const screenshotPath = path.join(
      this.artifactDir,
      'screenshots',
      `${name}-${Date.now()}.png`
    );

    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });

    if (this.config.useRealBrowser) {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } else {
      // Mock screenshot
      await fs.writeFile(screenshotPath, 'mock-screenshot-data');
    }

    return screenshotPath;
  }

  /**
   * Test permission scenario
   */
  async testPermissionScenario(
    operation: string,
    options: any = {}
  ): Promise<{ granted: boolean; error?: string }> {
    if (!this.permissionSimulator) {
      throw new Error('Permission testing not enabled');
    }

    try {
      const response = await this.permissionSimulator.requestPermission(operation, options);
      return { granted: response.granted, error: response.reason };
    } catch (error) {
      return { granted: false, error: String(error) };
    }
  }

  /**
   * Load a test page
   */
  async loadTestPage(pageContent: string = SIMPLE_TEST_PAGE): Promise<void> {
    const page = this.getPage();
    if (!page) {
      throw new Error('No page available');
    }

    if (this.config.useRealBrowser) {
      await loadTestPage(page, pageContent);
    } else {
      // Mock page loading
      await page.setContent(pageContent);
    }
  }

  /**
   * Clean up the test environment
   */
  async teardown(): Promise<void> {
    // Run cleanup functions in reverse order
    for (let i = this.cleanup.length - 1; i >= 0; i--) {
      try {
        await this.cleanup[i]();
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
    }

    this.cleanup = [];
  }

  /**
   * Create artifact directory
   */
  private async createArtifactDirectory(): Promise<string> {
    const artifactDir = path.join(
      this.config.artifactDir,
      `test-${Date.now()}`
    );

    await fs.mkdir(artifactDir, { recursive: true });
    await fs.mkdir(path.join(artifactDir, 'screenshots'), { recursive: true });
    await fs.mkdir(path.join(artifactDir, 'videos'), { recursive: true });

    return artifactDir;
  }
}

// ============================================================================
// Global Test Environment Setup
// ============================================================================

/**
 * Global test environment instance
 */
let globalTestEnvironment: BrowserAutomationTestEnvironment | undefined;

/**
 * Setup global browser automation test environment
 */
export function setupBrowserAutomationTesting(
  config?: Partial<BrowserAutomationTestConfig>
): void {
  beforeAll(async () => {
    globalTestEnvironment = new BrowserAutomationTestEnvironment(config);
    await globalTestEnvironment.setup();
    console.log('Browser automation test environment initialized');
  });

  afterAll(async () => {
    if (globalTestEnvironment) {
      await globalTestEnvironment.teardown();
      globalTestEnvironment = undefined;
      console.log('Browser automation test environment cleaned up');
    }
  });

  beforeEach(async () => {
    // Reset test state for each test
    if (globalTestEnvironment) {
      const permissionSimulator = globalTestEnvironment.getPermissionSimulator();
      if (permissionSimulator) {
        permissionSimulator.clearPermissions();
      }
    }
  });

  afterEach(async () => {
    // Capture failure screenshots if enabled
    if (globalTestEnvironment?.config.captureFailureScreenshots) {
      try {
        await globalTestEnvironment.captureScreenshot('test-end');
      } catch (error) {
        console.warn('Failed to capture test end screenshot:', error);
      }
    }
  });
}

/**
 * Get the global test environment
 */
export function getBrowserTestEnvironment(): BrowserAutomationTestEnvironment {
  if (!globalTestEnvironment) {
    throw new Error('Browser test environment not initialized. Call setupBrowserAutomationTesting() first.');
  }
  return globalTestEnvironment;
}

// ============================================================================
// Test Utility Functions
// ============================================================================

/**
 * Create a scoped test environment for specific tests
 */
export async function createScopedTestEnvironment(
  config?: Partial<BrowserAutomationTestConfig>
): Promise<BrowserAutomationTestEnvironment> {
  const environment = new BrowserAutomationTestEnvironment(config);
  await environment.setup();
  return environment;
}

/**
 * Mock browser automation dependencies for unit tests
 */
export function mockBrowserAutomationDependencies(): void {
  // Note: vi.mock calls need to be at module top-level due to hoisting
  // This function is kept for API compatibility but actual mocking
  // should be done at module import time
  console.warn('mockBrowserAutomationDependencies: vi.mock should be called at module level');
}

/**
 * Assert browser automation test results
 */
export function assertBrowserTestResult(
  result: { success: boolean; errors: string[] },
  expectSuccess = true
): void {
  if (expectSuccess) {
    if (!result.success) {
      throw new Error(`Browser test failed with errors: ${result.errors.join(', ')}`);
    }
  } else {
    if (result.success) {
      throw new Error('Expected browser test to fail, but it succeeded');
    }
  }
}

/**
 * Wait for browser automation operation with timeout
 */
export async function waitForBrowserOperation<T>(
  operation: () => Promise<T>,
  timeout = 30000,
  description = 'Browser operation'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`${description} timed out after ${timeout}ms`)), timeout);
  });

  return Promise.race([operation(), timeoutPromise]);
}

// ============================================================================
// Exports
// ============================================================================

export type {
  BrowserAutomationTestConfig,
  BrowserAutomationTestEnvironment,
};

// DEFAULT_TEST_CONFIG is already exported inline above