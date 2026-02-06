/**
 * @fileoverview Enhanced Browser Automation Test Helpers with Permission Testing Support
 *
 * This file provides comprehensive utilities for testing browser automation functionality
 * including permission handling, error scenarios, and comprehensive test infrastructure.
 *
 * Features:
 * - Permission-aware browser test contexts
 * - Mock browser sessions with permission controls
 * - Comprehensive error scenario testing
 * - Screenshot and console message capture
 * - Network request mocking and validation
 * - Browser resource lifecycle management
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { Browser, BrowserContext, Page, ElementHandle } from 'playwright';
import { chromium, firefox, webkit } from 'playwright';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createPermissionTestContext } from '../../test-utils/permission-test-helpers.js';

// ============================================================================
// Enhanced Types and Interfaces
// ============================================================================

/**
 * Enhanced browser test configuration with permission support
 */
export interface BrowserAutomationTestConfig {
  // Browser configuration
  backend: 'playwright' | 'puppeteer';
  browserType: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  viewport: { width: number; height: number };
  slowMo?: number;
  devtools?: boolean;
  timeout: number;
  retries: number;

  // Permission configuration
  permissionTesting: {
    enabled: boolean;
    denyOperations?: string[];
    blockedDomains?: string[];
    simulateFailures?: boolean;
    defaultPermissionLevel?: 'full' | 'limited' | 'none';
  };

  // Test artifact configuration
  artifacts: {
    screenshots: boolean;
    consoleLogs: boolean;
    networkLogs: boolean;
    performanceMetrics: boolean;
    saveOnFailure: boolean;
    artifactDir: string;
  };

  // Resource management
  resourceManagement: {
    trackResources: boolean;
    validateCleanup: boolean;
    maxMemoryUsage?: number;
    timeoutCleanup: number;
  };
}

/**
 * Enhanced browser test context with comprehensive tracking
 */
export interface BrowserAutomationContext {
  // Browser resources
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;

  // Test session information
  sessionId: string;
  testName: string;
  startTime: Date;
  tempDir: string;

  // Artifact tracking
  screenshots: Array<{
    name: string;
    path: string;
    timestamp: Date;
    size: number;
  }>;
  consoleLogs: Array<{
    type: string;
    text: string;
    timestamp: Date;
    url?: string;
  }>;
  networkRequests: Array<{
    url: string;
    method: string;
    status?: number;
    timestamp: Date;
    duration?: number;
  }>;

  // Resource tracking
  resources: {
    browserActive: boolean;
    contextActive: boolean;
    pageActive: boolean;
    activeOperations: number;
    memoryUsage?: number;
    lifecycleState: 'initializing' | 'ready' | 'active' | 'cleanup' | 'destroyed';
  };

  // Permission context
  permissions: {
    manager: any;
    events: Array<{
      type: 'requested' | 'granted' | 'denied';
      tool: string;
      operation: string;
      timestamp: Date;
      result?: any;
    }>;
    deniedOperations: string[];
  };

  // Configuration
  config: BrowserAutomationTestConfig;
}

/**
 * Browser operation result with comprehensive metadata
 */
export interface BrowserOperationResult {
  success: boolean;
  operation: string;
  data?: any;
  error?: string;
  permissionDenied?: boolean;
  metadata: {
    timestamp: Date;
    duration: number;
    memoryUsed?: number;
    resourceState: any;
    permissionChecked: boolean;
    denialReason?: string;
    suggestions?: string[];
  };
}

/**
 * Test scenario for comprehensive browser testing
 */
export interface BrowserTestScenario {
  name: string;
  description: string;
  setup?: (context: BrowserAutomationContext) => Promise<void>;
  execute: (context: BrowserAutomationContext) => Promise<BrowserOperationResult>;
  validate: (context: BrowserAutomationContext, result: BrowserOperationResult) => Promise<void>;
  cleanup?: (context: BrowserAutomationContext) => Promise<void>;
  expectedPermissions?: string[];
  shouldFail?: boolean;
  retries?: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_BROWSER_AUTOMATION_CONFIG: BrowserAutomationTestConfig = {
  // Browser settings
  backend: 'playwright',
  browserType: 'chromium',
  headless: process.env.CI === 'true' || process.env.BROWSER_TEST_HEADLESS === 'true',
  viewport: { width: 1280, height: 720 },
  slowMo: process.env.CI ? 0 : 50,
  devtools: !process.env.CI,
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,

  // Permission settings
  permissionTesting: {
    enabled: true,
    denyOperations: [],
    blockedDomains: [],
    simulateFailures: false,
    defaultPermissionLevel: 'full',
  },

  // Artifact settings
  artifacts: {
    screenshots: true,
    consoleLogs: true,
    networkLogs: true,
    performanceMetrics: true,
    saveOnFailure: true,
    artifactDir: 'test-artifacts/browser-automation',
  },

  // Resource management settings
  resourceManagement: {
    trackResources: true,
    validateCleanup: true,
    maxMemoryUsage: 512 * 1024 * 1024, // 512MB
    timeoutCleanup: 10000, // 10 seconds
  },
};

// ============================================================================
// Enhanced Browser Automation Test Manager
// ============================================================================

/**
 * Comprehensive browser automation test manager
 */
export class BrowserAutomationTestManager extends EventEmitter {
  private contexts: Map<string, BrowserAutomationContext> = new Map();
  private globalTempDir?: string;

  constructor() {
    super();
    this.setupGlobalHandlers();
  }

  /**
   * Setup global error handlers and cleanup
   */
  private setupGlobalHandlers(): void {
    process.on('exit', () => this.cleanupAll());
    process.on('SIGINT', () => this.cleanupAll());
    process.on('SIGTERM', () => this.cleanupAll());

    // Handle unhandled rejections
    process.on('unhandledRejection', (error) => {
      this.emit('error', { type: 'unhandled-rejection', error });
    });
  }

  /**
   * Create a comprehensive browser test context
   */
  async createContext(
    testName: string,
    config: Partial<BrowserAutomationTestConfig> = {}
  ): Promise<BrowserAutomationContext> {
    const sessionId = `browser-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const testConfig = { ...DEFAULT_BROWSER_AUTOMATION_CONFIG, ...config };

    // Ensure global temp directory exists
    if (!this.globalTempDir) {
      this.globalTempDir = await fs.mkdtemp(
        path.join(process.cwd(), 'test-artifacts', 'browser-temp-')
      );
    }

    // Create test-specific temp directory
    const tempDir = path.join(this.globalTempDir, sessionId);
    await fs.mkdir(tempDir, { recursive: true });

    // Create artifacts directory
    const artifactDir = path.join(tempDir, 'artifacts');
    await fs.mkdir(artifactDir, { recursive: true });

    // Create permission context if enabled
    let permissionContext;
    if (testConfig.permissionTesting.enabled) {
      permissionContext = createPermissionTestContext({
        denyOperations: testConfig.permissionTesting.denyOperations,
        blockedDomains: testConfig.permissionTesting.blockedDomains,
        simulateFailures: testConfig.permissionTesting.simulateFailures,
        defaultPermissionLevel: testConfig.permissionTesting.defaultPermissionLevel,
      });
    }

    const context: BrowserAutomationContext = {
      sessionId,
      testName,
      startTime: new Date(),
      tempDir: artifactDir,
      screenshots: [],
      consoleLogs: [],
      networkRequests: [],
      resources: {
        browserActive: false,
        contextActive: false,
        pageActive: false,
        activeOperations: 0,
        lifecycleState: 'initializing',
      },
      permissions: {
        manager: permissionContext?.permissionManager,
        events: [],
        deniedOperations: testConfig.permissionTesting.denyOperations || [],
      },
      config: testConfig,
    };

    // Store context for cleanup
    this.contexts.set(sessionId, context);

    this.emit('context:created', { sessionId, testName });
    return context;
  }

  /**
   * Initialize browser resources for a context
   */
  async initializeBrowser(context: BrowserAutomationContext): Promise<void> {
    try {
      context.resources.lifecycleState = 'initializing';

      // Create browser
      context.browser = await this.createBrowser(context.config);
      context.resources.browserActive = true;

      // Create browser context
      context.context = await this.createBrowserContext(context);
      context.resources.contextActive = true;

      // Create page
      context.page = await this.createPage(context);
      context.resources.pageActive = true;

      // Setup page monitoring
      await this.setupPageMonitoring(context);

      context.resources.lifecycleState = 'ready';
      this.emit('browser:initialized', { sessionId: context.sessionId });
    } catch (error) {
      context.resources.lifecycleState = 'destroyed';
      this.emit('browser:initialization-failed', { sessionId: context.sessionId, error });
      throw error;
    }
  }

  /**
   * Create browser instance with enhanced configuration
   */
  private async createBrowser(config: BrowserAutomationTestConfig): Promise<Browser> {
    let playwrightBrowser;

    switch (config.browserType) {
      case 'firefox':
        playwrightBrowser = firefox;
        break;
      case 'webkit':
        playwrightBrowser = webkit;
        break;
      case 'chromium':
      default:
        playwrightBrowser = chromium;
        break;
    }

    return await playwrightBrowser.launch({
      headless: config.headless,
      slowMo: config.slowMo,
      devtools: config.devtools,
      args: [
        // Enhanced security and performance settings
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        // Memory management
        '--max-old-space-size=512',
        '--memory-pressure-off',
      ],
    });
  }

  /**
   * Create browser context with test-optimized settings
   */
  private async createBrowserContext(
    context: BrowserAutomationContext
  ): Promise<BrowserContext> {
    if (!context.browser) {
      throw new Error('Browser not initialized');
    }

    const browserContext = await context.browser.newContext({
      viewport: context.config.viewport,
      // Test optimization settings
      reducedMotion: 'reduce',
      forcedColors: 'none',
      colorScheme: 'light',
      timezoneId: 'UTC',
      locale: 'en-US',
      // Security settings
      acceptDownloads: false,
      ignoreHTTPSErrors: true,
      // Performance settings
      bypassCSP: true,
      javaScriptEnabled: true,
    });

    return browserContext;
  }

  /**
   * Create page with comprehensive monitoring
   */
  private async createPage(context: BrowserAutomationContext): Promise<Page> {
    if (!context.context) {
      throw new Error('Browser context not initialized');
    }

    const page = await context.context.newPage();

    // Set timeouts
    page.setDefaultTimeout(context.config.timeout);
    page.setDefaultNavigationTimeout(context.config.timeout);

    return page;
  }

  /**
   * Setup comprehensive page monitoring
   */
  private async setupPageMonitoring(context: BrowserAutomationContext): Promise<void> {
    if (!context.page) return;

    // Console message monitoring
    if (context.config.artifacts.consoleLogs) {
      context.page.on('console', (msg) => {
        context.consoleLogs.push({
          type: msg.type(),
          text: msg.text(),
          timestamp: new Date(),
          url: context.page?.url(),
        });
      });
    }

    // Network request monitoring
    if (context.config.artifacts.networkLogs) {
      context.page.on('request', (request) => {
        const requestData = {
          url: request.url(),
          method: request.method(),
          timestamp: new Date(),
        };
        context.networkRequests.push(requestData);
      });

      context.page.on('response', (response) => {
        const request = context.networkRequests.find(
          req => req.url === response.url() && !('status' in req)
        );
        if (request) {
          (request as any).status = response.status();
          (request as any).duration = Date.now() - request.timestamp.getTime();
        }
      });
    }

    // Error monitoring
    context.page.on('pageerror', (error) => {
      this.emit('page:error', {
        sessionId: context.sessionId,
        error: error.message,
        stack: error.stack,
      });
    });

    // Request failure monitoring
    context.page.on('requestfailed', (request) => {
      this.emit('page:request-failed', {
        sessionId: context.sessionId,
        url: request.url(),
        failure: request.failure(),
      });
    });
  }

  /**
   * Execute browser operation with permission checking and comprehensive monitoring
   */
  async executeOperation(
    context: BrowserAutomationContext,
    operation: string,
    params: any = {}
  ): Promise<BrowserOperationResult> {
    const startTime = Date.now();
    context.resources.activeOperations++;
    context.resources.lifecycleState = 'active';

    try {
      const result: BrowserOperationResult = {
        success: false,
        operation,
        metadata: {
          timestamp: new Date(),
          duration: 0,
          resourceState: { ...context.resources },
          permissionChecked: false,
        },
      };

      // Check permissions if enabled
      if (context.config.permissionTesting.enabled && context.permissions.manager) {
        try {
          const permissionResult = await context.permissions.manager.checkToolPermission(
            'Browser',
            { scope: operation }
          );

          result.metadata.permissionChecked = true;

          // Record permission event
          context.permissions.events.push({
            type: permissionResult.allowed ? 'granted' : 'denied',
            tool: 'Browser',
            operation,
            timestamp: new Date(),
            result: permissionResult,
          });

          if (!permissionResult.allowed) {
            result.permissionDenied = true;
            result.error = permissionResult.denialReason || 'Permission denied';
            result.metadata.denialReason = permissionResult.denialReason;
            result.metadata.suggestions = this.getPermissionSuggestions(operation);
            return result;
          }
        } catch (permissionError) {
          result.error = `Permission check failed: ${permissionError}`;
          result.metadata.denialReason = 'Permission system failure';
          return result;
        }
      }

      // Execute the actual browser operation
      const operationResult = await this.performBrowserOperation(context, operation, params);

      result.success = operationResult.success;
      result.data = operationResult.data;
      result.error = operationResult.error;

      return result;
    } catch (error) {
      return {
        success: false,
        operation,
        error: `Operation failed: ${error}`,
        metadata: {
          timestamp: new Date(),
          duration: Date.now() - startTime,
          resourceState: { ...context.resources },
          permissionChecked: false,
        },
      };
    } finally {
      context.resources.activeOperations = Math.max(0, context.resources.activeOperations - 1);
      if (context.resources.activeOperations === 0) {
        context.resources.lifecycleState = 'ready';
      }

      // Update duration
      const endTime = Date.now();
      if (result && result.metadata) {
        result.metadata.duration = endTime - startTime;
      }
    }
  }

  /**
   * Perform the actual browser operation
   */
  private async performBrowserOperation(
    context: BrowserAutomationContext,
    operation: string,
    params: any
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!context.page) {
      return { success: false, error: 'Page not initialized' };
    }

    try {
      switch (operation) {
        case 'navigate':
          await context.page.goto(params.url, {
            timeout: context.config.timeout,
            waitUntil: 'networkidle'
          });
          return { success: true, data: { url: params.url } };

        case 'click':
          await context.page.click(params.selector, { timeout: context.config.timeout });
          return { success: true, data: { clicked: true } };

        case 'type':
          await context.page.fill(params.selector, params.text);
          return { success: true, data: { typed: params.text } };

        case 'screenshot':
          const screenshotPath = await this.takeScreenshot(context, params.name || 'operation');
          return { success: true, data: { screenshot: screenshotPath } };

        case 'evaluate':
          const evalResult = await context.page.evaluate(params.script);
          return { success: true, data: { result: evalResult } };

        case 'getText':
          const text = await context.page.locator(params.selector).textContent();
          return { success: true, data: { text } };

        case 'getAttribute':
          const attr = await context.page.locator(params.selector).getAttribute(params.attribute);
          return { success: true, data: { attribute: attr } };

        case 'waitForSelector':
          await context.page.waitForSelector(params.selector, { timeout: context.config.timeout });
          return { success: true, data: { found: true } };

        default:
          return { success: false, error: `Unknown operation: ${operation}` };
      }
    } catch (error) {
      return { success: false, error: `${operation} failed: ${error}` };
    }
  }

  /**
   * Take a screenshot with comprehensive metadata
   */
  async takeScreenshot(context: BrowserAutomationContext, name: string): Promise<string> {
    if (!context.page) {
      throw new Error('Page not initialized');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}-${timestamp}.png`;
    const filepath = path.join(context.tempDir, filename);

    await context.page.screenshot({
      path: filepath,
      fullPage: true,
      animations: 'disabled',
    });

    // Get file stats
    const stats = await fs.stat(filepath);

    context.screenshots.push({
      name,
      path: filepath,
      timestamp: new Date(),
      size: stats.size,
    });

    this.emit('screenshot:taken', {
      sessionId: context.sessionId,
      name,
      filepath,
      size: stats.size,
    });

    return filepath;
  }

  /**
   * Get permission denial suggestions
   */
  private getPermissionSuggestions(operation: string): string[] {
    const suggestions = [
      `Check if the '${operation}' operation is allowed in the current permission policy`,
      'Review the browser automation permissions in your APEX configuration',
      'Consider updating the permission settings to allow this operation',
    ];

    switch (operation) {
      case 'navigate':
        suggestions.push('Verify the target domain is not in the blocked domains list');
        break;
      case 'screenshot':
        suggestions.push('Enable screenshot permissions in browser automation settings');
        break;
      case 'evaluate':
        suggestions.push('Check if JavaScript execution is allowed in the current context');
        break;
    }

    return suggestions;
  }

  /**
   * Run a comprehensive test scenario
   */
  async runScenario(
    context: BrowserAutomationContext,
    scenario: BrowserTestScenario
  ): Promise<{ success: boolean; result?: BrowserOperationResult; error?: string }> {
    try {
      this.emit('scenario:started', { sessionId: context.sessionId, scenario: scenario.name });

      // Setup if required
      if (scenario.setup) {
        await scenario.setup(context);
      }

      // Execute with retries
      let result: BrowserOperationResult;
      const maxRetries = scenario.retries || context.config.retries;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          result = await scenario.execute(context);

          if (result.success || scenario.shouldFail) {
            break;
          }

          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          }
        } catch (error) {
          if (attempt === maxRetries) {
            throw error;
          }
        }
      }

      // Validate result
      await scenario.validate(context, result!);

      // Cleanup if required
      if (scenario.cleanup) {
        await scenario.cleanup(context);
      }

      this.emit('scenario:completed', { sessionId: context.sessionId, scenario: scenario.name });
      return { success: true, result: result! };
    } catch (error) {
      this.emit('scenario:failed', { sessionId: context.sessionId, scenario: scenario.name, error });
      return { success: false, error: `${error}` };
    }
  }

  /**
   * Cleanup a specific context
   */
  async cleanup(sessionId: string): Promise<void> {
    const context = this.contexts.get(sessionId);
    if (!context) return;

    try {
      context.resources.lifecycleState = 'cleanup';

      // Take final screenshot on failure if configured
      if (context.config.artifacts.saveOnFailure && context.page) {
        try {
          await this.takeScreenshot(context, 'cleanup-final');
        } catch (error) {
          // Ignore screenshot errors during cleanup
        }
      }

      // Close page
      if (context.page && context.resources.pageActive) {
        await context.page.close();
        context.resources.pageActive = false;
      }

      // Close context
      if (context.context && context.resources.contextActive) {
        await context.context.close();
        context.resources.contextActive = false;
      }

      // Close browser
      if (context.browser && context.resources.browserActive) {
        await context.browser.close();
        context.resources.browserActive = false;
      }

      context.resources.lifecycleState = 'destroyed';
      this.contexts.delete(sessionId);

      this.emit('context:cleanup-completed', { sessionId });
    } catch (error) {
      this.emit('context:cleanup-failed', { sessionId, error });
    }
  }

  /**
   * Cleanup all contexts
   */
  async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.contexts.keys()).map(sessionId =>
      this.cleanup(sessionId)
    );

    await Promise.allSettled(cleanupPromises);

    // Cleanup global temp directory
    if (this.globalTempDir) {
      try {
        await fs.rm(this.globalTempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to cleanup global temp directory:', error);
      }
    }
  }

  /**
   * Get comprehensive test report for a context
   */
  generateTestReport(context: BrowserAutomationContext): any {
    const endTime = new Date();
    const duration = endTime.getTime() - context.startTime.getTime();

    return {
      session: {
        id: context.sessionId,
        testName: context.testName,
        startTime: context.startTime,
        endTime,
        duration,
      },
      resources: {
        ...context.resources,
        screenshots: context.screenshots.length,
        consoleLogs: context.consoleLogs.length,
        networkRequests: context.networkRequests.length,
      },
      permissions: {
        eventsRecorded: context.permissions.events.length,
        deniedOperations: context.permissions.deniedOperations.length,
        permissionChecks: context.permissions.events.filter(e => e.type === 'requested').length,
      },
      artifacts: {
        screenshots: context.screenshots,
        consoleLogs: context.consoleLogs.slice(-10), // Last 10 logs
        networkRequests: context.networkRequests.slice(-10), // Last 10 requests
        tempDir: context.tempDir,
      },
      config: context.config,
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a browser automation test manager instance
 */
export function createBrowserAutomationTestManager(): BrowserAutomationTestManager {
  return new BrowserAutomationTestManager();
}

/**
 * Create a browser test context with permission testing enabled
 */
export async function createBrowserTestContext(
  testName: string,
  config: Partial<BrowserAutomationTestConfig> = {}
): Promise<{ manager: BrowserAutomationTestManager; context: BrowserAutomationContext }> {
  const manager = createBrowserAutomationTestManager();
  const context = await manager.createContext(testName, config);
  await manager.initializeBrowser(context);

  return { manager, context };
}

/**
 * Run a browser test with automatic cleanup
 */
export async function runBrowserTest<T>(
  testName: string,
  testFn: (context: BrowserAutomationContext, manager: BrowserAutomationTestManager) => Promise<T>,
  config: Partial<BrowserAutomationTestConfig> = {}
): Promise<T> {
  const { manager, context } = await createBrowserTestContext(testName, config);

  try {
    return await testFn(context, manager);
  } finally {
    await manager.cleanup(context.sessionId);
  }
}

// Export all interfaces and types
export {
  BrowserAutomationTestConfig,
  BrowserAutomationContext,
  BrowserOperationResult,
  BrowserTestScenario,
  DEFAULT_BROWSER_AUTOMATION_CONFIG,
};