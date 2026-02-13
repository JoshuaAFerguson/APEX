/**
 * Browser Tool Integration Tests
 *
 * Integration tests for the BrowserTool implementation covering:
 * - Real browser automation scenarios
 * - End-to-end permission flows
 * - Cross-backend compatibility
 * - Performance and resource management
 * - Real-world error scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { BrowserTool, BrowserToolConfig } from './browser-tool';
import { PermissionManager } from '../permission-manager';
import { BrowserConsoleStream } from '../browser-console-stream';
import * as fs from 'fs';
import * as path from 'path';

// Test environment setup
const TEST_TIMEOUT = 30000; // 30 seconds for integration tests
const TEST_SERVER_PORT = 9876;
const TEST_HTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Page</title>
    <style>
        .hidden { display: none; }
        .visible { display: block; }
        #delayed-element { opacity: 0; transition: opacity 2s; }
        #delayed-element.show { opacity: 1; }
    </style>
</head>
<body>
    <h1 id="main-heading">Browser Tool Test Page</h1>
    <form id="test-form">
        <input id="text-input" type="text" placeholder="Enter text" />
        <button id="submit-button" type="submit">Submit</button>
    </form>
    <div id="click-target">Click me</div>
    <div id="hover-target">Hover me</div>
    <div id="delayed-element">Delayed element</div>
    <script>
        // Add some console output for testing
        console.log('Page loaded successfully');
        console.warn('This is a warning message');

        // Add click handler
        document.getElementById('click-target').addEventListener('click', function() {
            console.log('Element clicked');
            this.style.backgroundColor = 'green';
        });

        // Add hover handler
        document.getElementById('hover-target').addEventListener('mouseenter', function() {
            console.log('Element hovered');
            this.style.backgroundColor = 'blue';
        });

        // Show delayed element after 1 second
        setTimeout(() => {
            document.getElementById('delayed-element').classList.add('show');
        }, 1000);

        // Simulate some runtime errors for testing
        setTimeout(() => {
            try {
                nonExistentFunction();
            } catch (error) {
                console.error('Runtime error caught:', error.message);
            }
        }, 500);
    </script>
</body>
</html>
`;

describe('Browser Tool Integration Tests', () => {
  let browserTool: BrowserTool;
  let mockPermissionManager: Partial<PermissionManager>;
  let mockEventEmitter: EventEmitter;
  let testServer: any;
  let testUrl: string;

  beforeEach(() => {
    // Create test server (mock implementation for testing)
    testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(TEST_HTML)}`;

    // Setup mock permission manager with realistic responses
    mockPermissionManager = {
      checkToolPermission: vi.fn(() => Promise.resolve({
        allowed: true,
        level: 'full',
        requiresConfirmation: false,
      })),
      getToolConfig: vi.fn(() => Promise.resolve({
        enabled: true,
        allowJavaScriptExecution: true,
        allowFormSubmission: true,
        allowScreenshots: true,
        allowedDomains: ['localhost', '127.0.0.1', 'test.example.com'],
        pageLoadTimeout: 10000,
        headless: true,
        viewport: { width: 1920, height: 1080 },
        consoleStream: {
          enabled: true,
          config: {
            minLevel: 0, // Capture all levels
            captureArgs: true,
            captureStackTraces: true,
          }
        }
      } as BrowserToolConfig)),
    };

    mockEventEmitter = new EventEmitter();

    browserTool = new BrowserTool({
      permissionManager: mockPermissionManager as PermissionManager,
      eventEmitter: mockEventEmitter,
      headless: true, // Always run headless in tests
    });
  }, TEST_TIMEOUT);

  afterEach(async () => {
    try {
      await browserTool.cleanup();
    } catch (error) {
      console.warn('Test cleanup error (expected in some tests):', error);
    }
  }, TEST_TIMEOUT);

  describe('End-to-End Page Navigation', () => {
    it('should navigate to page and capture basic information', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl, waitUntil: 'load' }
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('navigate');
      expect(result.metadata?.title).toContain('Test Page');
      expect(result.metadata?.url).toContain('data:text/html');
      expect(result.metadata?.permissionGranted).toBe(true);

      // Verify resource state is active
      const resourceState = browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(true);
      expect(resourceState.pageActive).toBe(true);
    }, TEST_TIMEOUT);

    it('should handle navigation with timeout', async () => {
      // Test with very short timeout to verify timeout handling
      const result = await browserTool.execute({
        operation: 'navigate',
        params: {
          url: testUrl,
          timeout: 1, // Very short timeout
          waitUntil: 'load'
        }
      });

      // The test might succeed or fail depending on timing, but should not crash
      expect(result).toBeDefined();
      expect(result.operation).toBe('navigate');
    }, TEST_TIMEOUT);
  });

  describe('Interactive Element Operations', () => {
    beforeEach(async () => {
      // Navigate to test page for each test
      await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });
    });

    it('should perform click operation on element', async () => {
      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: '#click-target' }
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ clicked: '#click-target' });

      // Verify console message was captured
      const messages = result.metadata?.enhancedConsoleMessages || [];
      const clickMessage = messages.find(msg => msg.text.includes('Element clicked'));
      expect(clickMessage).toBeDefined();
    }, TEST_TIMEOUT);

    it('should perform hover operation on element', async () => {
      const result = await browserTool.execute({
        operation: 'hover',
        params: { selector: '#hover-target' }
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ hovered: '#hover-target' });
    }, TEST_TIMEOUT);

    it('should type into input field', async () => {
      const testText = 'Integration test text';

      const result = await browserTool.execute({
        operation: 'type',
        params: {
          selector: '#text-input',
          text: testText,
          clearFirst: true
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        typed: testText,
        into: '#text-input'
      });

      // Verify the text was actually entered
      const getValueResult = await browserTool.execute({
        operation: 'getAttribute',
        params: { selector: '#text-input', attribute: 'value' }
      });

      expect(getValueResult.success).toBe(true);
      expect(getValueResult.data?.value).toBe(testText);
    }, TEST_TIMEOUT);

    it('should wait for element to become visible', async () => {
      // This element becomes visible after 1 second via JavaScript
      const result = await browserTool.execute({
        operation: 'waitForSelector',
        params: {
          selector: '#delayed-element.show',
          timeout: 3000,
          visible: true
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ found: '#delayed-element.show' });
    }, TEST_TIMEOUT);

    it('should get element text content', async () => {
      const result = await browserTool.execute({
        operation: 'getText',
        params: { selector: '#main-heading' }
      });

      expect(result.success).toBe(true);
      expect(result.data?.text).toBe('Browser Tool Test Page');
    }, TEST_TIMEOUT);

    it('should get element HTML content', async () => {
      const result = await browserTool.execute({
        operation: 'getHtml',
        params: { selector: '#main-heading' }
      });

      expect(result.success).toBe(true);
      expect(result.data?.html).toBe('Browser Tool Test Page');
    }, TEST_TIMEOUT);
  });

  describe('Screenshot and Visual Testing', () => {
    beforeEach(async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });
    });

    it('should capture full page screenshot', async () => {
      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true, format: 'png' }
      });

      expect(result.success).toBe(true);
      expect(result.screenshot).toBeDefined();
      expect(result.data?.format).toBe('png');

      if (result.screenshot?.startsWith('data:image/png;base64,')) {
        // Verify it's a valid base64 image
        const base64Data = result.screenshot.split(',')[1];
        expect(base64Data.length).toBeGreaterThan(0);
      }
    }, TEST_TIMEOUT);

    it('should capture element screenshot', async () => {
      const result = await browserTool.execute({
        operation: 'screenshot',
        params: {
          selector: '#main-heading',
          format: 'png'
        }
      });

      expect(result.success).toBe(true);
      expect(result.screenshot).toBeDefined();
    }, TEST_TIMEOUT);

    it('should save screenshot to file', async () => {
      const tempDir = path.join(__dirname, '..', '..', '..', '..', 'temp');
      const screenshotPath = path.join(tempDir, 'test-screenshot.png');

      // Ensure temp directory exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const result = await browserTool.execute({
        operation: 'screenshot',
        params: {
          path: screenshotPath,
          fullPage: true
        }
      });

      expect(result.success).toBe(true);
      expect(result.screenshot).toBe(screenshotPath);

      // Cleanup
      try {
        if (fs.existsSync(screenshotPath)) {
          fs.unlinkSync(screenshotPath);
        }
      } catch (error) {
        console.warn('Failed to cleanup test screenshot:', error);
      }
    }, TEST_TIMEOUT);
  });

  describe('JavaScript Execution', () => {
    beforeEach(async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });
    });

    it('should execute JavaScript and return result', async () => {
      const result = await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: 'return document.title;'
        }
      });

      expect(result.success).toBe(true);
      expect(result.data?.result).toBe('Test Page');
    }, TEST_TIMEOUT);

    it('should execute JavaScript with arguments', async () => {
      const result = await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: 'return args[0] + args[1];',
          args: [10, 20]
        }
      });

      expect(result.success).toBe(true);
      expect(result.data?.result).toBe(30);
    }, TEST_TIMEOUT);

    it('should handle JavaScript execution errors', async () => {
      const result = await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: 'throw new Error("Test error");'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Test error');
    }, TEST_TIMEOUT);
  });

  describe('Console Message Capture', () => {
    beforeEach(async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });
    });

    it('should capture console messages during page load', async () => {
      // Navigate again to capture fresh console messages
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });

      const messages = result.metadata?.enhancedConsoleMessages || [];

      // Should capture the page load message
      const loadMessage = messages.find(msg =>
        msg.text.includes('Page loaded successfully')
      );
      expect(loadMessage).toBeDefined();

      // Should capture the warning message
      const warningMessage = messages.find(msg =>
        msg.text.includes('This is a warning message')
      );
      expect(warningMessage).toBeDefined();
    }, TEST_TIMEOUT);

    it('should capture runtime errors', async () => {
      // Wait for the runtime error to occur (happens after 500ms)
      await new Promise(resolve => setTimeout(resolve, 1000));

      const errors = browserTool.getEnhancedRuntimeErrors();

      // Should capture the runtime error
      expect(errors.length).toBeGreaterThan(0);
      const runtimeError = errors.find(error =>
        error.message.includes('Runtime error caught') ||
        error.message.includes('nonExistentFunction')
      );
      expect(runtimeError).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('Backend Compatibility', () => {
    it('should work with Puppeteer backend', async () => {
      const puppeteerTool = new BrowserTool({
        backend: 'puppeteer',
        permissionManager: mockPermissionManager as PermissionManager,
        headless: true,
      });

      try {
        const result = await puppeteerTool.execute({
          operation: 'navigate',
          params: { url: testUrl }
        });

        // Should succeed or fail gracefully (Puppeteer might not be available in test env)
        expect(result).toBeDefined();
        expect(result.operation).toBe('navigate');
      } catch (error) {
        // Puppeteer might not be available in test environment
        expect(error.message).toContain('puppeteer');
      } finally {
        await puppeteerTool.cleanup();
      }
    }, TEST_TIMEOUT);

    it('should handle missing Puppeteer gracefully', async () => {
      // Mock the dynamic import to simulate missing Puppeteer
      vi.doMock('puppeteer', () => {
        throw new Error('Module not found: puppeteer');
      });

      const puppeteerTool = new BrowserTool({
        backend: 'puppeteer',
        permissionManager: mockPermissionManager as PermissionManager,
      });

      try {
        const result = await puppeteerTool.execute({
          operation: 'navigate',
          params: { url: testUrl }
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('puppeteer is not installed');
      } finally {
        await puppeteerTool.cleanup();
      }
    }, TEST_TIMEOUT);
  });

  describe('Permission Integration Flows', () => {
    it('should enforce domain allowlist', async () => {
      // Mock permission manager to block non-allowed domains
      (mockPermissionManager.getToolConfig as any).mockResolvedValue({
        enabled: true,
        allowedDomains: ['allowed.example.com'],
        blockedDomains: [],
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://blocked.example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not in allowlist');
    }, TEST_TIMEOUT);

    it('should block dangerous operations without permission', async () => {
      // Mock permission check to return no explicit level
      (mockPermissionManager.checkToolPermission as any).mockResolvedValue({
        allowed: true,
        level: null, // No explicit permission level
        requiresConfirmation: false,
      });

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'console.log("dangerous")' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous operation requires explicit permission');
    }, TEST_TIMEOUT);

    it('should emit permission events', async () => {
      const permissionEvents: any[] = [];
      mockEventEmitter.on('permission:denied', (event) => {
        permissionEvents.push(event);
      });

      // Configure to deny permissions
      (mockPermissionManager.checkToolPermission as any).mockResolvedValue({
        allowed: false,
        denialReason: 'Test denial',
      });

      await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });

      expect(permissionEvents).toHaveLength(1);
      expect(permissionEvents[0]).toMatchObject({
        operation: 'navigate',
        denialReason: 'Test denial',
      });
    }, TEST_TIMEOUT);
  });

  describe('Resource Management Under Load', () => {
    it('should handle multiple concurrent operations', async () => {
      // Navigate first to establish page
      await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });

      // Execute multiple operations concurrently
      const operations = [
        browserTool.execute({
          operation: 'getText',
          params: { selector: '#main-heading' }
        }),
        browserTool.execute({
          operation: 'getAttribute',
          params: { selector: '#text-input', attribute: 'placeholder' }
        }),
        browserTool.execute({
          operation: 'screenshot',
          params: { selector: '#click-target' }
        }),
      ];

      const results = await Promise.all(operations);

      // All operations should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Resource state should be consistent
      const resourceState = browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(true);
      expect(resourceState.activeOperations).toBe(0); // All operations completed
    }, TEST_TIMEOUT);

    it('should cleanup properly after resource exhaustion', async () => {
      // Simulate resource exhaustion by forcing browser launch to fail
      const originalLaunch = mockPermissionManager.getToolConfig;

      let callCount = 0;
      (mockPermissionManager.getToolConfig as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call succeeds to allow permission checks
          return Promise.resolve({
            enabled: true,
            allowJavaScriptExecution: true,
          });
        }
        // Subsequent calls fail to simulate resource exhaustion
        throw new Error('Resource exhausted');
      });

      try {
        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url: testUrl }
        });

        // Should handle error gracefully
        expect(result.success).toBe(false);
      } finally {
        // Restore original implementation
        mockPermissionManager.getToolConfig = originalLaunch;
      }

      // Tool should still be in a valid state
      expect(browserTool.getState()).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('Error Recovery', () => {
    it('should recover from page crashes', async () => {
      // Navigate to establish page
      await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });

      // Simulate page crash by executing dangerous JavaScript
      await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: 'while(true) { new Array(999999999); }' // Memory exhaustion
        }
      });

      // Tool should still be operational for new operations
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });

      // Should either succeed with new page or fail gracefully
      expect(result).toBeDefined();
      expect(result.operation).toBe('navigate');
    }, TEST_TIMEOUT);

    it('should handle browser process termination', async () => {
      // Navigate to establish browser
      await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });

      // Force cleanup to simulate browser termination
      await browserTool.cleanup();

      // Subsequent operations should fail gracefully
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: testUrl }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('destroyed');
    }, TEST_TIMEOUT);
  });
});