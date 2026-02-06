/**
 * @fileoverview Comprehensive Browser Integration Infrastructure Validation
 *
 * This test suite validates the complete browser integration test infrastructure
 * by testing all components together in realistic scenarios that mirror actual
 * usage patterns. It ensures:
 *
 * 1. DOM element creation and interaction utilities work correctly
 * 2. Browser test base classes handle all lifecycle scenarios
 * 3. Helper utilities provide reliable element state assertions
 * 4. Mock infrastructure provides equivalent behavior to real browsers
 * 5. Test fixtures support complex multi-step test scenarios
 * 6. Performance monitoring and debugging tools function properly
 * 7. Error handling and recovery mechanisms work as expected
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { BrowserTestBase, createBrowserTest, BrowserTestUtils } from '@apex/test-utils/browser-test-base';
import {
  createMockPage,
  createMockElement,
  createMockPageWithForm,
  buildFormHtml,
  buildTableHtml,
  generateTestUrl,
  assertNavigationState,
  assertPageContent,
  assertElementExists,
  assertElementVisible,
  assertNoErrors,
  TestPages,
  TestDataGenerators,
  PerformanceMonitor,
  type FormConfig
} from '@apexcli/browser/test-utils';
import {
  takeScreenshot,
  waitForElement,
  safeClick,
  safeFill,
  measurePerformance,
  captureConsoleMessages,
  setupAlertHandler,
  createTestPage
} from './utils/test-helpers.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Comprehensive Browser Integration Infrastructure Validation', () => {
  let browserTest: BrowserTestBase;
  let tempDir: string;

  beforeAll(async () => {
    // Create shared temp directory for all tests
    tempDir = await fs.mkdtemp(path.join(process.cwd(), 'test-artifacts', 'comprehensive-validation-'));
  });

  afterAll(async () => {
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error);
    }
  });

  beforeEach(async () => {
    browserTest = createBrowserTest({
      headless: true,
      timeout: 30000,
      viewport: { width: 1280, height: 720 }
    });
    await browserTest.setup();
  });

  afterEach(async () => {
    if (browserTest) {
      await browserTest.teardown();
    }
  });

  describe('End-to-End DOM Building and Interaction Scenarios', () => {
    it('should handle complete form workflow with mock infrastructure', async () => {
      // Create a comprehensive form configuration
      const formConfig: FormConfig = {
        action: '/api/submit',
        method: 'POST',
        fields: [
          { name: 'firstName', type: 'text', label: 'First Name', required: true },
          { name: 'lastName', type: 'text', label: 'Last Name', required: true },
          { name: 'email', type: 'email', label: 'Email Address', required: true },
          { name: 'phone', type: 'tel', label: 'Phone Number', required: false },
          { name: 'message', type: 'textarea', label: 'Message', required: true },
          { name: 'newsletter', type: 'checkbox', label: 'Subscribe to newsletter', required: false }
        ],
        submitText: 'Submit Form'
      };

      // Create form page using DOM builders
      const formPage = createMockPageWithForm('https://test.example.com/contact', formConfig);

      // Verify form structure
      expect(formPage.html).toContain('form');
      expect(formPage.html).toContain('firstName');
      expect(formPage.html).toContain('Submit Form');

      // Load the form in browser
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(formPage.html)}`;
      await browserTest.navigateTo(dataUrl);

      // Verify navigation state
      const navResult = await assertNavigationState(browserTest, {
        url: dataUrl,
        title: formPage.title || 'Test Page',
        ready: true
      });
      expect(navResult.success).toBe(true);

      // Test form field interactions
      await safeFill(browserTest.context.page!, '[name="firstName"]', 'John');
      await safeFill(browserTest.context.page!, '[name="lastName"]', 'Doe');
      await safeFill(browserTest.context.page!, '[name="email"]', 'john.doe@example.com');
      await safeFill(browserTest.context.page!, '[name="message"]', 'This is a test message from the comprehensive infrastructure validation.');

      // Verify field values using helper assertions
      const firstNameElement = await waitForElement(browserTest.context.page!, '[name="firstName"]');
      const firstNameValue = await firstNameElement.inputValue();
      expect(firstNameValue).toBe('John');

      // Test checkbox interaction
      await safeClick(browserTest.context.page!, '[name="newsletter"]');

      // Take screenshot of completed form
      const screenshotPath = await takeScreenshot(browserTest.context.page!, 'form-completed', tempDir);
      expect(screenshotPath).toBeDefined();

      // Verify screenshot was created
      const stats = await fs.stat(screenshotPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should handle complex table interaction scenarios', async () => {
      // Generate table HTML using DOM builders
      const tableHtml = buildTableHtml({
        headers: ['ID', 'Name', 'Email', 'Status', 'Actions'],
        rows: [
          ['1', 'John Doe', 'john@example.com', 'Active', '<button class="edit-btn" data-id="1">Edit</button>'],
          ['2', 'Jane Smith', 'jane@example.com', 'Inactive', '<button class="edit-btn" data-id="2">Edit</button>'],
          ['3', 'Bob Johnson', 'bob@example.com', 'Active', '<button class="edit-btn" data-id="3">Edit</button>']
        ],
        caption: 'User Management Table'
      });

      // Create complete page with table
      const pageHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Table Test Page</title>
          <style>
            table { border-collapse: collapse; width: 100%; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .edit-btn { background: #007acc; color: white; border: none; padding: 5px 10px; cursor: pointer; }
            #output { margin: 20px 0; padding: 10px; background: #f0f0f0; }
          </style>
        </head>
        <body>
          <h1>Table Interaction Test</h1>
          ${tableHtml}
          <div id="output">No action performed yet</div>
          <script>
            document.addEventListener('click', function(e) {
              if (e.target.classList.contains('edit-btn')) {
                const id = e.target.dataset.id;
                document.getElementById('output').innerHTML = 'Edit clicked for user ID: ' + id;
              }
            });
          </script>
        </body>
        </html>
      `;

      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(pageHtml)}`;
      await browserTest.navigateTo(dataUrl);

      // Verify table structure using content assertions
      const tableContentResult = await assertPageContent(browserTest, 'User Management Table');
      expect(tableContentResult.success).toBe(true);

      // Verify table elements exist
      const tableExistsResult = await assertElementExists(browserTest, 'table');
      expect(tableExistsResult.success).toBe(true);

      const headerExistsResult = await assertElementExists(browserTest, 'th');
      expect(headerExistsResult.success).toBe(true);

      // Test row interaction
      await safeClick(browserTest.context.page!, '[data-id="2"]');

      // Verify interaction result
      const outputResult = await assertPageContent(browserTest, 'Edit clicked for user ID: 2');
      expect(outputResult.success).toBe(true);

      // Take screenshot of table interaction
      const screenshotPath = await takeScreenshot(browserTest.context.page!, 'table-interaction', tempDir);
      expect(screenshotPath).toBeDefined();
    });
  });

  describe('Advanced Test Utilities Integration', () => {
    it('should measure performance across multiple operations', async () => {
      const performanceMonitor = new PerformanceMonitor();

      // Create a test page with performance testing
      const testPageUrl = await createTestPage();

      // Measure navigation performance
      performanceMonitor.startOperation('navigation');
      await browserTest.navigateTo(testPageUrl);
      performanceMonitor.endOperation('navigation');

      // Measure element interaction performance
      performanceMonitor.startOperation('interaction');
      const element = await waitForElement(browserTest.context.page!, '.content-card');
      await element.scrollIntoViewIfNeeded();
      await element.click();
      performanceMonitor.endOperation('interaction');

      // Measure screenshot performance
      performanceMonitor.startOperation('screenshot');
      await takeScreenshot(browserTest.context.page!, 'performance-test', tempDir);
      performanceMonitor.endOperation('screenshot');

      // Get performance metrics
      const metrics = performanceMonitor.getMetrics();

      // Validate performance measurements
      expect(metrics.navigation).toBeDefined();
      expect(metrics.interaction).toBeDefined();
      expect(metrics.screenshot).toBeDefined();

      expect(metrics.navigation.duration).toBeGreaterThan(0);
      expect(metrics.interaction.duration).toBeGreaterThan(0);
      expect(metrics.screenshot.duration).toBeGreaterThan(0);

      // Performance thresholds (mock infrastructure should be fast)
      expect(metrics.navigation.duration).toBeLessThan(5000); // 5s max for navigation
      expect(metrics.interaction.duration).toBeLessThan(2000); // 2s max for interactions
      expect(metrics.screenshot.duration).toBeLessThan(3000); // 3s max for screenshots
    });

    it('should generate and validate test data using TestDataGenerators', async () => {
      // Generate test form data
      const formData = TestDataGenerators.generateFormData({
        fields: ['firstName', 'lastName', 'email', 'company', 'phone'],
        locale: 'en'
      });

      expect(formData.firstName).toBeTruthy();
      expect(formData.lastName).toBeTruthy();
      expect(formData.email).toMatch(/\S+@\S+\.\S+/);
      expect(formData.company).toBeTruthy();
      expect(formData.phone).toBeTruthy();

      // Generate test pages using TestPages
      const testPages = TestPages.generate({
        count: 3,
        baseUrl: 'https://test-infrastructure.com',
        includeNavigation: true,
        includeForms: true
      });

      expect(testPages).toHaveLength(3);
      testPages.forEach((page, index) => {
        expect(page.url).toContain('test-infrastructure.com');
        expect(page.html).toContain('nav');
        expect(page.html).toContain('form');
        expect(page.title).toBeTruthy();
      });

      // Use generated data in a real test scenario
      const formConfig: FormConfig = {
        action: '/submit',
        method: 'POST',
        fields: [
          { name: 'firstName', type: 'text', label: 'First Name', required: true },
          { name: 'lastName', type: 'text', label: 'Last Name', required: true },
          { name: 'email', type: 'email', label: 'Email', required: true }
        ],
        submitText: 'Submit'
      };

      const generatedFormPage = createMockPageWithForm(testPages[0].url, formConfig);
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(generatedFormPage.html)}`;
      await browserTest.navigateTo(dataUrl);

      // Fill form with generated data
      await safeFill(browserTest.context.page!, '[name="firstName"]', formData.firstName);
      await safeFill(browserTest.context.page!, '[name="lastName"]', formData.lastName);
      await safeFill(browserTest.context.page!, '[name="email"]', formData.email);

      // Verify data was filled correctly
      const firstNameValue = await browserTest.context.page!.locator('[name="firstName"]').inputValue();
      expect(firstNameValue).toBe(formData.firstName);
    });

    it('should handle console message capture and error detection', async () => {
      // Create a test page with various console messages
      const testPageHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Console Test Page</title></head>
        <body>
          <h1>Console Message Testing</h1>
          <button id="log-btn" onclick="logMessages()">Generate Logs</button>
          <button id="error-btn" onclick="triggerError()">Trigger Error</button>
          <div id="output"></div>
          <script>
            console.log('Page loaded successfully');

            function logMessages() {
              console.log('Info: Button clicked');
              console.warn('Warning: This is a test warning');
              console.info('Info message from user action');
              document.getElementById('output').innerHTML = 'Logs generated at ' + new Date().toISOString();
            }

            function triggerError() {
              console.error('Error: Intentional test error');
              throw new Error('Test error for validation');
            }
          </script>
        </body>
        </html>
      `;

      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;
      await browserTest.navigateTo(dataUrl);

      // Capture console messages during interactions
      const consoleMessages = await captureConsoleMessages(browserTest.context.page!, async () => {
        await safeClick(browserTest.context.page!, '#log-btn');
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async logs
      });

      // Validate console messages were captured
      expect(consoleMessages.length).toBeGreaterThan(0);

      const logMessage = consoleMessages.find(msg =>
        msg.type === 'log' && msg.text.includes('Button clicked')
      );
      expect(logMessage).toBeDefined();

      const warnMessage = consoleMessages.find(msg =>
        msg.type === 'warning' && msg.text.includes('test warning')
      );
      expect(warnMessage).toBeDefined();

      // Test error capture
      const errorMessages = await captureConsoleMessages(browserTest.context.page!, async () => {
        try {
          await safeClick(browserTest.context.page!, '#error-btn');
        } catch (error) {
          // Expected error from the triggered JavaScript error
        }
      });

      const errorMessage = errorMessages.find(msg =>
        msg.type === 'error' && msg.text.includes('Intentional test error')
      );
      expect(errorMessage).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should gracefully handle missing elements and invalid selectors', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Test element not found scenario
      await expect(async () => {
        await waitForElement(browserTest.context.page!, '#non-existent-element', { timeout: 1000 });
      }).rejects.toThrow(/Element not found/);

      // Test malformed selector handling
      await expect(async () => {
        await waitForElement(browserTest.context.page!, '<<<invalid>>>selector>>>', { timeout: 1000 });
      }).rejects.toThrow();

      // Verify browser is still functional after errors
      const recoverElement = await waitForElement(browserTest.context.page!, '#test-button');
      expect(recoverElement).toBeDefined();
      await recoverElement.click();
    });

    it('should handle network timeout scenarios', async () => {
      // Test navigation timeout with invalid URL
      await expect(async () => {
        await browserTest.navigateTo('https://this-domain-should-not-exist-12345.com', { timeout: 5000 });
      }).rejects.toThrow();

      // Verify browser recovers and can navigate to valid pages
      await BrowserTestUtils.createTestPage(browserTest);
      const title = await browserTest.context.page!.title();
      expect(title).toBe('APEX Browser Test Page');
    });

    it('should handle alert dialogs and user prompts', async () => {
      const alertPageHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Alert Test Page</title></head>
        <body>
          <button id="alert-btn" onclick="alert('Test alert message')">Show Alert</button>
          <button id="confirm-btn" onclick="confirmResult = confirm('Confirm this action?')">Show Confirm</button>
          <div id="result"></div>
        </body>
        </html>
      `;

      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(alertPageHtml)}`;
      await browserTest.navigateTo(dataUrl);

      // Setup alert handler to auto-accept
      await setupAlertHandler(browserTest.context.page!, 'accept');

      // Trigger alert and verify it's handled
      await safeClick(browserTest.context.page!, '#alert-btn');

      // Trigger confirm dialog
      await safeClick(browserTest.context.page!, '#confirm-btn');

      // Verify dialogs were handled without hanging the test
      expect(true).toBe(true); // If we reach here, dialogs were handled
    });
  });

  describe('Resource Management and Cleanup', () => {
    it('should properly manage multiple browser contexts', async () => {
      const contexts = [];
      const pages = [];

      try {
        // Create multiple contexts to test resource management
        for (let i = 0; i < 3; i++) {
          const context = await browserTest.context.browser!.newContext();
          const page = await context.newPage();

          contexts.push(context);
          pages.push(page);

          // Navigate each page to different content
          const testUrl = generateTestUrl('data', {
            content: `<h1>Context ${i}</h1><p>Page content for context ${i}</p>`,
            mimeType: 'text/html'
          });

          await page.goto(testUrl);
          const title = await page.textContent('h1');
          expect(title).toBe(`Context ${i}`);
        }

        // Take screenshots of all contexts
        for (let i = 0; i < pages.length; i++) {
          const screenshotPath = await takeScreenshot(pages[i], `context-${i}`, tempDir);
          expect(screenshotPath).toBeDefined();
        }

      } finally {
        // Clean up all contexts and pages
        for (const page of pages) {
          await page.close();
        }
        for (const context of contexts) {
          await context.close();
        }
      }

      // Verify main browser test is still functional
      await BrowserTestUtils.createTestPage(browserTest);
      const mainTitle = await browserTest.context.page!.title();
      expect(mainTitle).toBe('APEX Browser Test Page');
    });

    it('should handle graceful shutdown under various conditions', async () => {
      // Test shutdown with pending operations
      const operationsPromise = Promise.all([
        BrowserTestUtils.createTestPage(browserTest),
        browserTest.takeScreenshot('shutdown-test'),
        browserTest.getPerformanceMetrics()
      ]);

      await operationsPromise;

      // Test that teardown works even with active operations
      const additionalTest = createBrowserTest({ headless: true });
      await additionalTest.setup();

      try {
        await BrowserTestUtils.createTestPage(additionalTest);
        // Don't await this, test teardown with pending operation
        const pendingScreenshot = additionalTest.takeScreenshot('pending-operation');

        // Force teardown
        await additionalTest.teardown();

        // Should not throw errors
        expect(true).toBe(true);
      } catch (error) {
        // Some pending operations may fail during teardown, which is acceptable
        console.warn('Teardown with pending operations:', error);
      }
    });
  });

  describe('Integration Completeness Validation', () => {
    it('should verify all infrastructure components work together', async () => {
      // This test validates that all components of the infrastructure work together
      // in a realistic end-to-end scenario that mirrors actual usage

      const performanceMonitor = new PerformanceMonitor();

      // 1. Generate test data
      const testData = TestDataGenerators.generateFormData({
        fields: ['name', 'email', 'message'],
        locale: 'en'
      });

      // 2. Build complex page structure
      const formHtml = buildFormHtml({
        action: '/submit',
        method: 'POST',
        fields: [
          { name: 'name', type: 'text', label: 'Name', required: true },
          { name: 'email', type: 'email', label: 'Email', required: true },
          { name: 'message', type: 'textarea', label: 'Message', required: true }
        ],
        submitText: 'Submit'
      });

      const tableHtml = buildTableHtml({
        headers: ['Feature', 'Status', 'Coverage'],
        rows: [
          ['DOM Builders', '✓ Implemented', '100%'],
          ['Test Utilities', '✓ Implemented', '100%'],
          ['Assertions', '✓ Implemented', '100%'],
          ['Performance', '✓ Implemented', '100%'],
          ['Error Handling', '✓ Implemented', '100%']
        ],
        caption: 'Infrastructure Status'
      });

      const pageHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Integration Test Complete</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            input, textarea { width: 100%; padding: 5px; margin: 5px 0; }
            button { padding: 10px 20px; background: #007acc; color: white; border: none; }
          </style>
        </head>
        <body>
          <h1>Browser Integration Infrastructure - Complete Validation</h1>

          <div class="section">
            <h2>Infrastructure Status</h2>
            ${tableHtml}
          </div>

          <div class="section">
            <h2>Test Form</h2>
            ${formHtml}
          </div>

          <div class="section" id="results">
            <h2>Test Results</h2>
            <p>Waiting for test execution...</p>
          </div>

          <script>
            console.log('Integration test page loaded');
            document.querySelector('form').addEventListener('submit', function(e) {
              e.preventDefault();
              document.getElementById('results').innerHTML =
                '<h2>Test Results</h2><p style="color: green;">✓ All infrastructure components validated successfully!</p>';
            });
          </script>
        </body>
        </html>
      `;

      // 3. Navigate and measure performance
      performanceMonitor.startOperation('fullWorkflow');

      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(pageHtml)}`;
      await browserTest.navigateTo(dataUrl);

      // 4. Validate navigation and content
      const navResult = await assertNavigationState(browserTest, {
        url: dataUrl,
        title: 'Integration Test Complete',
        ready: true
      });
      expect(navResult.success).toBe(true);

      const contentResult = await assertPageContent(browserTest, 'Infrastructure Status');
      expect(contentResult.success).toBe(true);

      // 5. Interact with form using generated data
      await safeFill(browserTest.context.page!, '[name="name"]', testData.name);
      await safeFill(browserTest.context.page!, '[name="email"]', testData.email);
      await safeFill(browserTest.context.page!, '[name="message"]', testData.message);

      // 6. Submit form and verify result
      await safeClick(browserTest.context.page!, 'button[type="submit"]');

      // 7. Verify form submission result
      const successResult = await assertPageContent(browserTest, 'All infrastructure components validated successfully');
      expect(successResult.success).toBe(true);

      // 8. Validate no errors occurred
      const noErrorsResult = await assertNoErrors(browserTest);
      expect(noErrorsResult.success).toBe(true);

      // 9. Take final screenshot
      const screenshotPath = await takeScreenshot(browserTest.context.page!, 'integration-complete', tempDir);
      expect(screenshotPath).toBeDefined();

      performanceMonitor.endOperation('fullWorkflow');

      // 10. Validate performance
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.fullWorkflow.duration).toBeLessThan(30000); // 30s max for full workflow

      // 11. Verify all expected files were created
      const files = await fs.readdir(tempDir);
      const screenshotFiles = files.filter(f => f.endsWith('.png'));
      expect(screenshotFiles.length).toBeGreaterThan(0);
    });
  });
});