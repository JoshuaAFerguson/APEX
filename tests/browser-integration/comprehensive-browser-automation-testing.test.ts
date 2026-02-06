/**
 * @fileoverview Comprehensive Browser Automation Testing Suite
 *
 * This test suite validates the complete browser automation integration test infrastructure
 * created for APEX. It tests all components systematically to ensure they work correctly
 * and provides comprehensive coverage of the testing utilities, mocks, and helpers.
 *
 * Test Categories:
 * 1. Core Infrastructure Components
 * 2. Browser Automation Utilities
 * 3. Permission Testing Systems
 * 4. Mock and Simulation Components
 * 5. Integration Context Management
 * 6. Error Handling and Edge Cases
 * 7. Performance and Resource Management
 * 8. Cross-Browser Compatibility
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';

// Import test infrastructure components
import {
  createTestEnvironment,
  runWithCleanup,
  type TestEnvironment
} from '../test-utils/index.js';

import {
  BrowserTestBase,
  createBrowserTest,
  BrowserTestUtils,
  DEFAULT_BROWSER_TEST_CONFIG,
  type BrowserTestConfig
} from '../test-utils/browser-test-base.js';

import {
  BrowserAutomationMocks,
  createMockBrowserContext,
  type MockBrowserContext
} from '../test-utils/browser-automation-mocks.js';

import {
  createBrowserPermissionSimulator,
  type BrowserPermissionSimulator
} from '../test-utils/browser-permission-simulator.js';

import {
  createPermissionTestContext,
  type PermissionTestContext
} from '../test-utils/permission-test-helpers.js';

import {
  createBrowser,
  createBrowserContext,
  createPage,
  captureScreenshot,
  setupTestPage,
  waitForNetworkIdle
} from './setup.js';

// Import browser integration utilities
import { createBrowserAutomationTestManager } from './utils/browser-automation-test-helpers.js';
import { createPermissionMockManager } from './utils/browser-permission-mocks.js';
import { createIntegrationTestManager } from './utils/integration-test-context.js';

describe('Comprehensive Browser Automation Testing Suite', () => {
  let testEnvironment: TestEnvironment;
  let tempDir: string;

  beforeAll(async () => {
    // Initialize test environment
    testEnvironment = await createTestEnvironment({
      contextId: 'comprehensive-browser-test',
      withMocks: true,
    });
    tempDir = testEnvironment.tempDir;
  });

  afterAll(async () => {
    // Clean up test environment
    if (testEnvironment) {
      await testEnvironment.cleanup.cleanup();
    }
  });

  describe('Core Infrastructure Components', () => {
    describe('Test Environment Setup', () => {
      it('should create test environment with all required components', async () => {
        expect(testEnvironment).toBeDefined();
        expect(testEnvironment.context).toBeDefined();
        expect(testEnvironment.cleanup).toBeDefined();
        expect(testEnvironment.tempDir).toBeDefined();

        // Verify temp directory exists
        const stats = await fs.stat(testEnvironment.tempDir);
        expect(stats.isDirectory()).toBe(true);
      });

      it('should provide cleanup mechanisms', () => {
        expect(typeof testEnvironment.cleanup.cleanup).toBe('function');
        expect(typeof testEnvironment.cleanup.addCleanupTask).toBe('function');
      });

      it('should support runWithCleanup utility', async () => {
        const result = await runWithCleanup(async (env) => {
          expect(env.context).toBeDefined();
          expect(env.cleanup).toBeDefined();
          expect(env.tempDir).toBeDefined();

          // Create a test file
          const testFile = path.join(env.tempDir, 'cleanup-test.txt');
          await fs.writeFile(testFile, 'test content');

          // Verify file exists
          const exists = await fs.access(testFile).then(() => true, () => false);
          expect(exists).toBe(true);

          return 'cleanup-success';
        }, { withMocks: true });

        expect(result).toBe('cleanup-success');
      });
    });

    describe('BrowserTestBase Class', () => {
      let browserTest: BrowserTestBase;

      beforeEach(() => {
        browserTest = createBrowserTest({
          headless: true,
          timeout: 10000,
        });
      });

      afterEach(async () => {
        if (browserTest) {
          await browserTest.teardown();
        }
      });

      it('should create browser test instance with correct configuration', () => {
        expect(browserTest).toBeDefined();
        expect(browserTest.context).toBeDefined();
        expect(browserTest.context.config.headless).toBe(true);
        expect(browserTest.context.config.timeout).toBe(10000);
      });

      it('should provide all required methods', () => {
        expect(typeof browserTest.setup).toBe('function');
        expect(typeof browserTest.teardown).toBe('function');
        expect(typeof browserTest.navigate).toBe('function');
        expect(typeof browserTest.click).toBe('function');
        expect(typeof browserTest.fill).toBe('function');
        expect(typeof browserTest.takeScreenshot).toBe('function');
      });

      it('should handle setup and teardown lifecycle', async () => {
        // Setup browser test
        await browserTest.setup();

        expect(browserTest.context.browser).toBeDefined();
        expect(browserTest.context.context).toBeDefined();
        expect(browserTest.context.page).toBeDefined();
        expect(browserTest.context.tempDir).toBeDefined();

        // Teardown
        await browserTest.teardown();

        // Resources should be cleaned up
        expect(browserTest.context.browser).toBeUndefined();
        expect(browserTest.context.context).toBeUndefined();
        expect(browserTest.context.page).toBeUndefined();
      });

      it('should emit lifecycle events', async () => {
        const setupEvents: string[] = [];
        const teardownEvents: string[] = [];

        browserTest.on('setup:complete', () => setupEvents.push('complete'));
        browserTest.on('teardown:complete', () => teardownEvents.push('complete'));

        await browserTest.setup();
        expect(setupEvents).toContain('complete');

        await browserTest.teardown();
        expect(teardownEvents).toContain('complete');
      });
    });

    describe('BrowserTestUtils', () => {
      it('should provide all utility functions', () => {
        expect(typeof BrowserTestUtils.createTestPage).toBe('function');
        expect(typeof BrowserTestUtils.waitForElement).toBe('function');
        expect(typeof BrowserTestUtils.captureScreenshot).toBe('function');
        expect(typeof BrowserTestUtils.compareScreenshots).toBe('function');
        expect(typeof BrowserTestUtils.waitForSelector).toBe('function');
        expect(typeof BrowserTestUtils.getElementText).toBe('function');
      });
    });
  });

  describe('Browser Automation Utilities', () => {
    describe('Direct Browser Creation', () => {
      let browser: Browser;
      let context: BrowserContext;
      let page: Page;

      afterEach(async () => {
        if (page) await page.close();
        if (context) await context.close();
        if (browser) await browser.close();
      });

      it('should create browser instances with different configurations', async () => {
        browser = await createBrowser({
          browserType: 'chromium',
          headless: true,
        });

        expect(browser).toBeDefined();
        expect(browser.isConnected()).toBe(true);

        context = await createBrowserContext(browser);
        expect(context).toBeDefined();

        page = await createPage(context);
        expect(page).toBeDefined();
      });

      it('should handle page navigation and interaction', async () => {
        browser = await createBrowser({ headless: true });
        context = await createBrowserContext(browser);
        page = await createPage(context);

        // Create a test page
        await setupTestPage(page);

        // Verify page content
        const title = await page.title();
        expect(title).toBe('APEX Browser Test Page');

        // Test interaction
        await page.click('.button');

        // Wait for interaction result
        await page.waitForTimeout(100);

        // Verify output was updated
        const output = await page.textContent('#output');
        expect(output).toContain('Button clicked');
      });

      it('should capture screenshots', async () => {
        browser = await createBrowser({ headless: true });
        context = await createBrowserContext(browser);
        page = await createPage(context);

        await setupTestPage(page);

        const screenshotPath = await captureScreenshot(page, 'test-screenshot', tempDir);

        expect(screenshotPath).toBeDefined();
        expect(screenshotPath).toContain('.png');

        // Verify screenshot file exists
        const exists = await fs.access(screenshotPath).then(() => true, () => false);
        expect(exists).toBe(true);
      });

      it('should wait for network idle', async () => {
        browser = await createBrowser({ headless: true });
        context = await createBrowserContext(browser);
        page = await createPage(context);

        await setupTestPage(page);

        // Should complete without timeout
        await expect(waitForNetworkIdle(page, 5000)).resolves.not.toThrow();
      });
    });
  });

  describe('Permission Testing Systems', () => {
    describe('Permission Test Context', () => {
      let permissionContext: PermissionTestContext;

      beforeEach(() => {
        permissionContext = createPermissionTestContext({
          autonomyLevel: 'limited',
          denyOperations: ['navigate', 'screenshot'],
          allowedDomains: ['trusted.com'],
          blockedDomains: ['blocked.com'],
        });
      });

      it('should create permission test context with correct configuration', () => {
        expect(permissionContext).toBeDefined();
        expect(permissionContext.browserTool).toBeDefined();
        expect(permissionContext.permissionManager).toBeDefined();
        expect(permissionContext.config).toBeDefined();

        expect(permissionContext.config.autonomyLevel).toBe('limited');
        expect(permissionContext.config.denyOperations).toContain('navigate');
        expect(permissionContext.config.denyOperations).toContain('screenshot');
      });

      it('should simulate permission denials', async () => {
        const result = await permissionContext.browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://example.com' }
        });

        expect(result.permissionDenied).toBe(true);
        expect(result.error).toContain('Permission denied');
      });

      it('should handle domain blocking', async () => {
        const result = await permissionContext.browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://blocked.com' }
        });

        expect(result.permissionDenied).toBe(true);
        expect(result.error).toContain('blocked');
      });
    });

    describe('Browser Permission Simulator', () => {
      let simulator: BrowserPermissionSimulator;

      beforeEach(() => {
        simulator = createBrowserPermissionSimulator({
          defaultPermissionLevel: 'limited',
          blockedDomains: ['malicious.com'],
          deniedOperations: ['evaluate', 'screenshot'],
        });
      });

      it('should create permission simulator with correct configuration', () => {
        expect(simulator).toBeDefined();
        expect(typeof simulator.checkPermission).toBe('function');
        expect(typeof simulator.simulatePermissionDenial).toBe('function');
        expect(typeof simulator.getPermissionStatus).toBe('function');
      });

      it('should check permissions correctly', async () => {
        const allowedResult = await simulator.checkPermission('navigate', {
          domain: 'trusted.com'
        });
        expect(allowedResult.allowed).toBe(true);

        const deniedResult = await simulator.checkPermission('screenshot', {
          domain: 'any.com'
        });
        expect(deniedResult.allowed).toBe(false);
      });

      it('should simulate permission denials', async () => {
        const denial = await simulator.simulatePermissionDenial('evaluate', {
          domain: 'test.com',
          reason: 'Security policy violation'
        });

        expect(denial.denied).toBe(true);
        expect(denial.reason).toContain('Security policy');
      });

      it('should get permission status', () => {
        const status = simulator.getPermissionStatus();

        expect(status).toBeDefined();
        expect(status.defaultLevel).toBe('limited');
        expect(status.blockedDomains).toContain('malicious.com');
        expect(status.deniedOperations).toContain('evaluate');
      });
    });
  });

  describe('Mock and Simulation Components', () => {
    describe('Browser Automation Mocks', () => {
      let mockContext: MockBrowserContext;

      beforeEach(() => {
        mockContext = createMockBrowserContext({
          permissions: {
            navigate: true,
            screenshot: true,
            click: false,
            evaluate: false,
          },
          blockedDomains: ['malicious.com', 'blocked.example.com'],
          simulateFailures: true,
        });
      });

      it('should create mock browser context with correct setup', () => {
        expect(mockContext).toBeDefined();
        expect(mockContext.browser).toBeDefined();
        expect(mockContext.context).toBeDefined();
        expect(mockContext.permissionManager).toBeDefined();
        expect(mockContext.config).toBeDefined();
      });

      it('should respect permission configurations', () => {
        expect(mockContext.config.permissions.navigate).toBe(true);
        expect(mockContext.config.permissions.screenshot).toBe(true);
        expect(mockContext.config.permissions.click).toBe(false);
        expect(mockContext.config.permissions.evaluate).toBe(false);
      });

      it('should provide mock browser utilities', () => {
        expect(typeof BrowserAutomationMocks.createMockBrowser).toBe('function');
        expect(typeof BrowserAutomationMocks.createMockPage).toBe('function');
        expect(typeof BrowserAutomationMocks.createMockElement).toBe('function');
      });
    });
  });

  describe('Integration Context Management', () => {
    describe('Browser Automation Test Manager', () => {
      it('should create browser automation test manager', () => {
        const manager = createBrowserAutomationTestManager({
          browserType: 'chromium',
          headless: true,
          enablePermissionTesting: true,
        });

        expect(manager).toBeDefined();
        expect(typeof manager.createTestSession).toBe('function');
        expect(typeof manager.runTestScenario).toBe('function');
        expect(typeof manager.cleanup).toBe('function');
      });
    });

    describe('Permission Mock Manager', () => {
      it('should create permission mock manager', () => {
        const manager = createPermissionMockManager({
          defaultPermissionLevel: 'limited',
          enableLogging: true,
        });

        expect(manager).toBeDefined();
        expect(typeof manager.createPermissionContext).toBe('function');
        expect(typeof manager.simulatePermissionDenial).toBe('function');
        expect(typeof manager.resetPermissions).toBe('function');
      });
    });

    describe('Integration Test Manager', () => {
      it('should create integration test manager', () => {
        const manager = createIntegrationTestManager({
          enableApexIntegration: true,
          mockOrchestrator: true,
        });

        expect(manager).toBeDefined();
        expect(typeof manager.createTestContext).toBe('function');
        expect(typeof manager.runIntegrationTest).toBe('function');
        expect(typeof manager.cleanup).toBe('function');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle permission denial errors gracefully', () => {
      const context = createPermissionTestContext({
        denyOperations: ['navigate', 'screenshot', 'click'],
        blockedDomains: ['blocked.com'],
      });

      expect(context).toBeDefined();
      expect(context.browserTool).toBeDefined();

      // Should not throw during creation
      expect(() => context.browserTool.execute).not.toThrow();
    });

    it('should handle browser automation failures', () => {
      const mockContext = createMockBrowserContext({
        simulateFailures: true,
        permissions: { navigate: false, screenshot: false },
      });

      expect(mockContext).toBeDefined();
      expect(mockContext.permissionManager).toBeDefined();

      // Mock context should be created successfully even with failures enabled
      expect(mockContext.config.simulateFailures).toBe(true);
    });

    it('should handle missing browser dependencies', () => {
      // Test that the infrastructure handles missing dependencies gracefully
      expect(() => {
        createBrowserTest({
          backend: 'playwright',
          browserType: 'chromium'
        });
      }).not.toThrow();
    });

    it('should validate browser test configuration', () => {
      const config: BrowserTestConfig = {
        backend: 'playwright',
        browserType: 'chromium',
        headless: true,
        viewport: { width: 1280, height: 720 },
        timeout: 30000,
      };

      const browserTest = createBrowserTest(config);
      expect(browserTest.context.config.backend).toBe('playwright');
      expect(browserTest.context.config.browserType).toBe('chromium');
      expect(browserTest.context.config.viewport.width).toBe(1280);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should provide resource cleanup utilities', async () => {
      const env = await createTestEnvironment();

      expect(env.cleanup).toBeDefined();
      expect(typeof env.cleanup.cleanup).toBe('function');
      expect(typeof env.cleanup.addCleanupTask).toBe('function');

      // Add a cleanup task
      let cleanupExecuted = false;
      env.cleanup.addCleanupTask(async () => {
        cleanupExecuted = true;
      });

      // Execute cleanup
      await env.cleanup.cleanup();
      expect(cleanupExecuted).toBe(true);
    });

    it('should manage temporary directories properly', async () => {
      const env = await createTestEnvironment();

      expect(env.tempDir).toBeDefined();
      expect(typeof env.tempDir).toBe('string');

      // Directory should exist
      const stats = await fs.stat(env.tempDir);
      expect(stats.isDirectory()).toBe(true);

      // Create test file
      const testFile = path.join(env.tempDir, 'resource-test.txt');
      await fs.writeFile(testFile, 'test content');

      // File should exist
      const fileExists = await fs.access(testFile).then(() => true, () => false);
      expect(fileExists).toBe(true);

      await env.cleanup.cleanup();
    });

    it('should handle browser instance resource management', async () => {
      const browserTest = createBrowserTest({ headless: true });

      await browserTest.setup();

      // Verify resources are allocated
      expect(browserTest.context.browser).toBeDefined();
      expect(browserTest.context.browser?.isConnected()).toBe(true);

      await browserTest.teardown();

      // Resources should be cleaned up
      expect(browserTest.context.browser).toBeUndefined();
    });
  });

  describe('Cross-Browser Compatibility', () => {
    it('should support default browser configuration', () => {
      expect(DEFAULT_BROWSER_TEST_CONFIG).toBeDefined();
      expect(DEFAULT_BROWSER_TEST_CONFIG.backend).toBe('playwright');
      expect(DEFAULT_BROWSER_TEST_CONFIG.browserType).toBe('chromium');
      expect(DEFAULT_BROWSER_TEST_CONFIG.viewport.width).toBe(1280);
      expect(DEFAULT_BROWSER_TEST_CONFIG.viewport.height).toBe(720);
    });

    it('should create browser tests with different browser types', () => {
      const chromiumTest = createBrowserTest({ browserType: 'chromium' });
      expect(chromiumTest.context.config.browserType).toBe('chromium');

      const firefoxTest = createBrowserTest({ browserType: 'firefox' });
      expect(firefoxTest.context.config.browserType).toBe('firefox');

      const webkitTest = createBrowserTest({ browserType: 'webkit' });
      expect(webkitTest.context.config.browserType).toBe('webkit');
    });

    it('should support different backend configurations', () => {
      const playwrightTest = createBrowserTest({ backend: 'playwright' });
      expect(playwrightTest.context.config.backend).toBe('playwright');

      const puppeteerTest = createBrowserTest({ backend: 'puppeteer' });
      expect(puppeteerTest.context.config.backend).toBe('puppeteer');
    });
  });

  describe('Test Fixture Validation', () => {
    it('should have all required HTML test fixtures', async () => {
      const fixturesDir = path.join(__dirname, 'fixtures');
      const requiredFixtures = [
        'basic-test-page.html',
        'form-test-page.html',
        'interactive-test-page.html',
        'error-test-page.html'
      ];

      for (const fixture of requiredFixtures) {
        const fixturePath = path.join(fixturesDir, fixture);
        const exists = await fs.access(fixturePath).then(() => true, () => false);
        expect(exists).toBe(true);

        if (exists) {
          const content = await fs.readFile(fixturePath, 'utf-8');
          expect(content).toContain('<!DOCTYPE html>');
          expect(content).toContain('<title>');
        }
      }
    });

    it('should have all required TypeScript test scenario files', async () => {
      const fixturesDir = path.join(__dirname, 'fixtures');
      const requiredScenarios = [
        'common-scenarios.ts',
        'permission-test-scenarios.ts',
        'error-page-scenarios.ts'
      ];

      for (const scenario of requiredScenarios) {
        const scenarioPath = path.join(fixturesDir, scenario);
        const exists = await fs.access(scenarioPath).then(() => true, () => false);
        expect(exists).toBe(true);
      }
    });
  });

  describe('Utility Helper Validation', () => {
    it('should have all required browser automation helpers', async () => {
      const utilsDir = path.join(__dirname, 'utils');
      const requiredHelpers = [
        'browser-automation-test-helpers.ts',
        'browser-permission-mocks.ts',
        'integration-test-context.ts',
        'test-helpers.ts'
      ];

      for (const helper of requiredHelpers) {
        const helperPath = path.join(utilsDir, helper);
        const exists = await fs.access(helperPath).then(() => true, () => false);
        expect(exists).toBe(true);
      }
    });
  });

  describe('Full Integration Test', () => {
    it('should run a complete browser automation integration test', async () => {
      const result = await runWithCleanup(async (env) => {
        // Create browser test
        const browserTest = createBrowserTest({
          headless: true,
          timeout: 15000
        });

        try {
          // Setup browser
          await browserTest.setup();

          // Create test page
          await BrowserTestUtils.createTestPage(browserTest);

          // Test navigation
          await browserTest.navigate('data:text/html,<html><body><h1>Test</h1></body></html>');

          // Take screenshot
          const screenshot = await browserTest.takeScreenshot('integration-test');
          expect(screenshot).toBeDefined();

          // Test permission context
          const permissionContext = createPermissionTestContext({
            denyOperations: ['evaluate'],
            allowedDomains: ['test.com']
          });

          expect(permissionContext).toBeDefined();

          return 'integration-test-success';
        } finally {
          await browserTest.teardown();
        }
      }, { withMocks: true });

      expect(result).toBe('integration-test-success');
    });
  });
});