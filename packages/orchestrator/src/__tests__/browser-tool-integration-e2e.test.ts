/**
 * Browser Tool Integration E2E Tests
 *
 * End-to-end integration tests for the BrowserTool within the orchestrator package.
 * These tests verify that the browser automation functionality works correctly
 * through the orchestrator's tool system, including:
 *
 * - Browser tool initialization and lifecycle
 * - Real browser automation operations
 * - Console capture and error detection
 * - Integration with permission system
 * - Performance under realistic workloads
 * - Cross-tool coordination
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { BrowserTool, type BrowserToolConfig } from '../tools/browser-tool.js';
import { BrowserConsoleStream, ConsoleLogLevel } from '../browser-console-stream.js';
import type { PermissionManager } from '../types.js';

describe('Browser Tool Integration E2E Tests', () => {
  let browserTool: BrowserTool;
  let mockPermissionManager: PermissionManager;

  const createRealPermissionManager = (): PermissionManager => ({
    async checkToolPermission(toolName: string, operation: string) {
      return {
        allowed: true,
        level: 'full',
        requiresConfirmation: false,
      };
    },
    async getToolConfig(toolName: string): Promise<BrowserToolConfig> {
      return {
        enabled: true,
        timeout: 30000,
        allowedDomains: ['*'],
        blockedDomains: [],
        consoleStream: {
          enabled: true,
          config: {
            minLevel: ConsoleLogLevel.DEBUG,
            maxBufferSize: 100,
            captureArgs: true,
            captureStackTraces: true,
            sessionId: `integration-test-${Date.now()}`,
          }
        }
      };
    },
  });

  const testPageHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Browser Tool Integration Test</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .test-section { margin: 20px 0; padding: 15px; border: 1px solid #ccc; }
        .success { color: green; }
        .error { color: red; }
        .warning { color: orange; }
        #output { background: #f5f5f5; padding: 10px; min-height: 50px; }
      </style>
    </head>
    <body>
      <h1 id="main-title">Browser Tool Integration Test Page</h1>

      <div class="test-section">
        <h3>Navigation Test</h3>
        <p id="nav-status">Page loaded successfully</p>
      </div>

      <div class="test-section">
        <h3>Form Interaction Test</h3>
        <input id="test-input" type="text" placeholder="Enter test data" />
        <select id="test-select">
          <option value="">Choose option</option>
          <option value="test1">Test Option 1</option>
          <option value="test2">Test Option 2</option>
        </select>
        <button id="test-button" onclick="handleTestClick()">Test Button</button>
      </div>

      <div class="test-section">
        <h3>Console Output Test</h3>
        <button id="console-log" onclick="generateLogs()">Generate Console Logs</button>
        <button id="console-error" onclick="generateError()">Generate Error</button>
        <button id="console-warning" onclick="generateWarning()">Generate Warning</button>
      </div>

      <div class="test-section">
        <h3>Dynamic Content Test</h3>
        <button id="dynamic-button" onclick="updateContent()">Update Content</button>
        <div id="output">Initial content</div>
      </div>

      <div class="test-section">
        <h3>Performance Test</h3>
        <button id="performance-test" onclick="performanceTest()">Run Performance Test</button>
        <div id="performance-result"></div>
      </div>

      <script>
        console.log('Browser Tool Integration Test page loaded');

        let clickCount = 0;
        let updateCount = 0;

        function handleTestClick() {
          clickCount++;
          console.info('Test button clicked', { count: clickCount, timestamp: Date.now() });

          const input = document.getElementById('test-input').value;
          const select = document.getElementById('test-select').value;

          console.log('Form data collected:', { input, select });

          const output = document.getElementById('output');
          output.innerHTML = \`
            <div class="success">
              Button clicked \${clickCount} times<br>
              Input: \${input}<br>
              Select: \${select}
            </div>
          \`;
        }

        function generateLogs() {
          console.log('Generated log message');
          console.info('Generated info message with data', {
            timestamp: new Date().toISOString(),
            random: Math.random()
          });
          console.debug('Generated debug message');
          console.trace('Generated trace message');
        }

        function generateError() {
          console.error('Generated error message');
          try {
            // Intentionally throw an error for testing
            throw new Error('Intentional integration test error');
          } catch (e) {
            console.error('Caught error:', e.message);
            // Re-throw to trigger global error handler
            setTimeout(() => { throw e; }, 1);
          }
        }

        function generateWarning() {
          console.warn('Generated warning message', {
            level: 'warning',
            source: 'integration-test'
          });
        }

        function updateContent() {
          updateCount++;
          const output = document.getElementById('output');
          output.innerHTML = \`
            <div class="success">
              Content updated \${updateCount} times at \${new Date().toLocaleTimeString()}
            </div>
          \`;
          console.log('Content updated', { count: updateCount });
        }

        function performanceTest() {
          console.time('Performance Test');
          console.log('Starting performance test');

          const start = performance.now();

          // Simulate some work
          let result = 0;
          for (let i = 0; i < 100000; i++) {
            result += Math.random();
          }

          const end = performance.now();
          const duration = end - start;

          console.timeEnd('Performance Test');
          console.log('Performance test completed', {
            duration: duration.toFixed(2) + 'ms',
            result: result.toFixed(2)
          });

          document.getElementById('performance-result').innerHTML = \`
            <div class="success">
              Performance test completed in \${duration.toFixed(2)}ms
            </div>
          \`;
        }

        // Global error handler
        window.onerror = function(message, source, lineno, colno, error) {
          console.error('Global error caught:', {
            message,
            source,
            line: lineno,
            column: colno,
            error: error?.toString()
          });
          return true; // Prevent default handling
        };

        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', function(event) {
          console.error('Unhandled promise rejection:', event.reason);
          event.preventDefault();
        });

        // Log page interactions
        document.addEventListener('click', function(e) {
          if (e.target.tagName === 'BUTTON') {
            console.debug('Button interaction detected:', {
              id: e.target.id,
              text: e.target.textContent,
              timestamp: Date.now()
            });
          }
        });
      </script>
    </body>
    </html>
  `;

  beforeAll(async () => {
    // Setup for all integration tests
  });

  afterAll(async () => {
    // Cleanup for all integration tests
  });

  beforeEach(async () => {
    mockPermissionManager = createRealPermissionManager();
    browserTool = new BrowserTool({ permissionManager: mockPermissionManager });
  });

  afterEach(async () => {
    // Clean up browser resources
    try {
      const consoleStream = browserTool.getConsoleStream?.();
      if (consoleStream) {
        consoleStream.stopStream();
      }
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Browser Tool Basic Operations', () => {
    it('should successfully execute navigate operation', async () => {
      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });

      expect(result.success).toBe(true);
      expect(result.screenshot).toBeDefined();
      expect(result.metadata?.enhancedConsoleMessages).toBeDefined();
      expect(result.metadata?.enhancedRuntimeErrors).toBeDefined();
      expect(result.metadata?.permissionGranted).toBe(true);

      // Verify console messages were captured during navigation
      const consoleMessages = browserTool.getEnhancedConsoleMessages?.() || [];
      expect(consoleMessages.length).toBeGreaterThan(0);

      const pageLoadMessage = consoleMessages.find(msg =>
        msg.text.includes('Browser Tool Integration Test page loaded')
      );
      expect(pageLoadMessage).toBeDefined();
    }, 15000);

    it('should successfully execute click operation', async () => {
      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;

      // First navigate to the page
      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });
      expect(navResult.success).toBe(true);

      // Then click the test button
      const clickResult = await browserTool.execute({
        operation: 'click',
        params: { selector: '#test-button' }
      });

      expect(clickResult.success).toBe(true);
      expect(clickResult.screenshot).toBeDefined();
      expect(clickResult.metadata?.enhancedConsoleMessages).toBeDefined();

      // Verify console messages from the click event
      const consoleMessages = browserTool.getEnhancedConsoleMessages?.() || [];
      const buttonClickMessage = consoleMessages.find(msg =>
        msg.text.includes('Test button clicked')
      );
      expect(buttonClickMessage).toBeDefined();
    }, 15000);

    it('should successfully execute type operation', async () => {
      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;

      // Navigate to page
      await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });

      // Type in the input field
      const typeResult = await browserTool.execute({
        operation: 'type',
        params: { selector: '#test-input', text: 'Integration test data' }
      });

      expect(typeResult.success).toBe(true);
      expect(typeResult.screenshot).toBeDefined();

      // Verify the input was typed correctly
      const getTextResult = await browserTool.execute({
        operation: 'getAttribute',
        params: { selector: '#test-input', name: 'value' }
      });

      expect(getTextResult.success).toBe(true);
      expect(getTextResult.result).toBe('Integration test data');
    }, 15000);

    it('should successfully execute screenshot operation', async () => {
      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;

      await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });

      const screenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      expect(screenshotResult.success).toBe(true);
      expect(screenshotResult.screenshot).toBeDefined();
      expect(screenshotResult.screenshot).toBeInstanceOf(Buffer);
      expect(screenshotResult.screenshot!.length).toBeGreaterThan(0);
    }, 15000);

    it('should successfully execute evaluate operation', async () => {
      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;

      await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });

      const evalResult = await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: '() => ({ title: document.title, elementCount: document.querySelectorAll("*").length })'
        }
      });

      expect(evalResult.success).toBe(true);
      expect(evalResult.result).toMatchObject({
        title: 'Browser Tool Integration Test',
        elementCount: expect.any(Number)
      });
    }, 15000);
  });

  describe('Console Capture Integration', () => {
    it('should capture various console log types during automation', async () => {
      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;

      await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });

      // Trigger console log generation
      await browserTool.execute({
        operation: 'click',
        params: { selector: '#console-log' }
      });

      // Wait a moment for console events
      await new Promise(resolve => setTimeout(resolve, 100));

      const consoleMessages = browserTool.getEnhancedConsoleMessages?.() || [];
      expect(consoleMessages.length).toBeGreaterThan(0);

      // Check for different log levels
      const logMessage = consoleMessages.find(msg => msg.text.includes('Generated log message'));
      const infoMessage = consoleMessages.find(msg => msg.text.includes('Generated info message'));
      const debugMessage = consoleMessages.find(msg => msg.text.includes('Generated debug message'));

      expect(logMessage).toBeDefined();
      expect(infoMessage).toBeDefined();
      expect(debugMessage).toBeDefined();

      // Verify message metadata
      if (logMessage) {
        expect(logMessage.level).toBe(ConsoleLogLevel.INFO);
        expect(logMessage.timestamp).toBeInstanceOf(Date);
        expect(logMessage.sessionId).toBeDefined();
      }
    }, 15000);

    it('should capture and categorize JavaScript errors', async () => {
      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;

      await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });

      // Trigger error generation
      await browserTool.execute({
        operation: 'click',
        params: { selector: '#console-error' }
      });

      // Wait for error events
      await new Promise(resolve => setTimeout(resolve, 200));

      const runtimeErrors = browserTool.getEnhancedRuntimeErrors?.() || [];
      expect(runtimeErrors.length).toBeGreaterThan(0);

      const testError = runtimeErrors.find(err =>
        err.message.includes('Intentional integration test error')
      );

      expect(testError).toBeDefined();
      if (testError) {
        expect(testError.category).toBe('javascript');
        expect(testError.severity).toBeDefined();
        expect(testError.stack).toBeDefined();
        expect(testError.context).toMatchObject({
          pageUrl: expect.stringContaining('data:text/html'),
          pageTitle: 'Browser Tool Integration Test',
          userAgent: expect.any(String)
        });
      }
    }, 15000);

    it('should capture console warnings properly', async () => {
      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;

      await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });

      await browserTool.execute({
        operation: 'click',
        params: { selector: '#console-warning' }
      });

      // Wait for console events
      await new Promise(resolve => setTimeout(resolve, 100));

      const consoleMessages = browserTool.getEnhancedConsoleMessages?.() || [];
      const warningMessage = consoleMessages.find(msg =>
        msg.text.includes('Generated warning message')
      );

      expect(warningMessage).toBeDefined();
      if (warningMessage) {
        expect(warningMessage.level).toBe(ConsoleLogLevel.WARN);
        expect(warningMessage.type).toBe('warning');
      }
    }, 15000);
  });

  describe('Complex Workflow Integration', () => {
    it('should handle multi-step automation workflow with console monitoring', async () => {
      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;

      // Step 1: Navigate
      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });
      expect(navResult.success).toBe(true);

      // Step 2: Fill form
      const typeResult = await browserTool.execute({
        operation: 'type',
        params: { selector: '#test-input', text: 'Multi-step workflow data' }
      });
      expect(typeResult.success).toBe(true);

      // Step 3: Select option
      const selectResult = await browserTool.execute({
        operation: 'selectOption',
        params: { selector: '#test-select', value: 'test2' }
      });
      expect(selectResult.success).toBe(true);

      // Step 4: Click button
      const clickResult = await browserTool.execute({
        operation: 'click',
        params: { selector: '#test-button' }
      });
      expect(clickResult.success).toBe(true);

      // Step 5: Update dynamic content
      const updateResult = await browserTool.execute({
        operation: 'click',
        params: { selector: '#dynamic-button' }
      });
      expect(updateResult.success).toBe(true);

      // Step 6: Take final screenshot
      const screenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });
      expect(screenshotResult.success).toBe(true);

      // Verify console activity throughout workflow
      const consoleMessages = browserTool.getEnhancedConsoleMessages?.() || [];
      expect(consoleMessages.length).toBeGreaterThan(3);

      const workflowMessages = consoleMessages.filter(msg =>
        msg.text.includes('Test button clicked') ||
        msg.text.includes('Content updated') ||
        msg.text.includes('Form data collected')
      );
      expect(workflowMessages.length).toBeGreaterThan(0);
    }, 25000);

    it('should handle performance testing with console monitoring', async () => {
      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;

      await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });

      // Trigger performance test
      await browserTool.execute({
        operation: 'click',
        params: { selector: '#performance-test' }
      });

      // Wait for performance test to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      const consoleMessages = browserTool.getEnhancedConsoleMessages?.() || [];

      const performanceMessages = consoleMessages.filter(msg =>
        msg.text.includes('Performance test') ||
        msg.text.includes('Performance Test')
      );

      expect(performanceMessages.length).toBeGreaterThan(0);

      // Check for timing console messages
      const timingStart = consoleMessages.find(msg => msg.text.includes('Starting performance test'));
      const timingEnd = consoleMessages.find(msg => msg.text.includes('Performance test completed'));

      expect(timingStart).toBeDefined();
      expect(timingEnd).toBeDefined();
    }, 15000);
  });

  describe('Error Handling and Recovery', () => {
    it('should handle invalid selectors gracefully', async () => {
      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;

      await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });

      const clickResult = await browserTool.execute({
        operation: 'click',
        params: { selector: '#non-existent-element' }
      });

      expect(clickResult.success).toBe(false);
      expect(clickResult.error).toBeDefined();

      // Verify the tool is still functional after error
      const validClickResult = await browserTool.execute({
        operation: 'click',
        params: { selector: '#test-button' }
      });
      expect(validClickResult.success).toBe(true);
    }, 15000);

    it('should handle navigation errors gracefully', async () => {
      const invalidNavResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'invalid://not-a-real-url' }
      });

      expect(invalidNavResult.success).toBe(false);
      expect(invalidNavResult.error).toBeDefined();

      // Verify tool can recover with valid navigation
      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;
      const validNavResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });
      expect(validNavResult.success).toBe(true);
    }, 15000);

    it('should handle timeout errors gracefully', async () => {
      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;

      await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });

      const timeoutResult = await browserTool.execute({
        operation: 'waitForSelector',
        params: { selector: '#element-that-never-appears', timeout: 100 }
      });

      expect(timeoutResult.success).toBe(false);
      expect(timeoutResult.error).toBeDefined();

      // Verify tool is still functional after timeout
      const titleResult = await browserTool.execute({
        operation: 'getTitle',
        params: {}
      });
      expect(titleResult.success).toBe(true);
    }, 15000);
  });

  describe('Resource Management', () => {
    it('should demonstrate proper resource cleanup', async () => {
      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;

      // Perform several operations
      await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });

      await browserTool.execute({
        operation: 'click',
        params: { selector: '#test-button' }
      });

      await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      // Verify console stream is active
      const consoleStream = browserTool.getConsoleStream?.();
      if (consoleStream) {
        expect(consoleStream.getStats().isActive).toBe(true);
        expect(consoleStream.getStats().messagesCount).toBeGreaterThan(0);

        // Test cleanup
        browserTool.clearConsoleBuffers?.();
        expect(browserTool.getEnhancedConsoleMessages?.()).toHaveLength(0);
        expect(browserTool.getEnhancedRuntimeErrors?.()).toHaveLength(0);
      }
    }, 15000);

    it('should handle memory management under load', async () => {
      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;

      await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });

      // Perform many operations to test memory management
      for (let i = 0; i < 10; i++) {
        await browserTool.execute({
          operation: 'click',
          params: { selector: i % 2 === 0 ? '#test-button' : '#dynamic-button' }
        });

        if (i % 3 === 0) {
          await browserTool.execute({
            operation: 'screenshot',
            params: { fullPage: false }
          });
        }
      }

      const consoleMessages = browserTool.getEnhancedConsoleMessages?.() || [];
      expect(consoleMessages.length).toBeGreaterThan(0);
      expect(consoleMessages.length).toBeLessThan(1000); // Should not accumulate indefinitely
    }, 25000);
  });

  describe('Permission System Integration', () => {
    it('should respect permission manager configurations', async () => {
      // Create a restrictive permission manager
      const restrictivePermissionManager: PermissionManager = {
        async checkToolPermission() {
          return {
            allowed: false,
            level: 'none',
            requiresConfirmation: false,
          };
        },
        async getToolConfig() {
          return {
            enabled: false,
            timeout: 1000,
            allowedDomains: [],
            blockedDomains: ['*'],
            consoleStream: {
              enabled: false,
              config: {
                minLevel: ConsoleLogLevel.ERROR,
                maxBufferSize: 0,
                captureArgs: false,
                captureStackTraces: false,
              }
            }
          };
        },
      };

      const restrictedBrowserTool = new BrowserTool({ permissionManager: restrictivePermissionManager });

      const result = await restrictedBrowserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('permission') || expect(result.error).toContain('not allowed');
    }, 10000);

    it('should handle permission confirmations properly', async () => {
      const confirmationPermissionManager: PermissionManager = {
        async checkToolPermission() {
          return {
            allowed: true,
            level: 'full',
            requiresConfirmation: true,
          };
        },
        async getToolConfig() {
          return {
            enabled: true,
            timeout: 30000,
            allowedDomains: ['*'],
            blockedDomains: [],
            consoleStream: {
              enabled: true,
              config: {
                minLevel: ConsoleLogLevel.INFO,
                maxBufferSize: 50,
                captureArgs: true,
                captureStackTraces: true,
              }
            }
          };
        },
      };

      const confirmationBrowserTool = new BrowserTool({ permissionManager: confirmationPermissionManager });

      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;
      const result = await confirmationBrowserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });

      // Should succeed even with confirmation required (in test mode)
      expect(result.success).toBe(true);
      expect(result.metadata?.permissionGranted).toBe(true);
    }, 15000);
  });
});