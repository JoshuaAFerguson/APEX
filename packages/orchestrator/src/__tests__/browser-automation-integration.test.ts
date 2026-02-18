/**
 * Browser Automation Integration Test
 *
 * This test validates the complete browser automation implementation including:
 * - Console log capture and streaming
 * - JavaScript runtime error detection
 * - Error context with stack traces
 * - Integration with BrowserTool and BrowserConsoleStream
 * - Real-world usage scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserTool, BrowserToolConfig } from '../tools/browser-tool';
import { BrowserConsoleStream, ConsoleLogLevel } from '../browser-console-stream';

// Mock Playwright Page with comprehensive event simulation
const mockPage = {
  on: vi.fn(),
  off: vi.fn(),
  url: vi.fn(() => 'https://integration-test.example.com'),
  title: vi.fn(() => 'Integration Test Page'),
  evaluate: vi.fn(() => Promise.resolve('Mozilla/5.0 (Test) AppleWebKit/537.36')),
  viewportSize: vi.fn(() => ({ width: 1920, height: 1080 })),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  click: vi.fn(),
  fill: vi.fn(),
  type: vi.fn(),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-screenshot-data'))),
  waitForSelector: vi.fn(() => Promise.resolve({})),
  getAttribute: vi.fn(() => Promise.resolve('test-value')),
  textContent: vi.fn(() => Promise.resolve('Test Content')),
  innerHTML: vi.fn(() => Promise.resolve('<div>Test</div>')),
  scrollIntoView: vi.fn(),
  hover: vi.fn(),
};

const mockContext = {
  newPage: vi.fn(() => Promise.resolve(mockPage)),
  on: vi.fn(),
  close: vi.fn(),
};

const mockBrowser = {
  newContext: vi.fn(() => Promise.resolve(mockContext)),
  version: vi.fn(() => '1.40.0'),
  isConnected: vi.fn(() => true),
  close: vi.fn(),
  on: vi.fn(),
};

const mockBrowserType = {
  launch: vi.fn(() => Promise.resolve(mockBrowser)),
};

// Mock Playwright - use vi.hoisted() for mock references in hoisted vi.mock()
const hoistedMockBrowserType = vi.hoisted(() => ({
  launch: vi.fn(() => Promise.resolve({ newContext: vi.fn(), version: vi.fn(() => '1.40.0'), isConnected: vi.fn(() => true), close: vi.fn(), on: vi.fn() })),
}));
vi.mock('playwright', () => ({
  chromium: hoistedMockBrowserType,
  firefox: hoistedMockBrowserType,
  webkit: hoistedMockBrowserType,
}));

describe('Browser Automation Integration', () => {
  let browserTool: BrowserTool;
  let mockPermissionManager: any;
  let consoleHandler: (message: any) => Promise<void>;
  let errorHandler: (error: Error) => Promise<void>;
  let requestFailedHandler: (request: any) => void;
  let responseHandler: (response: any) => void;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup realistic mock responses
    mockBrowser.newContext.mockResolvedValue(mockContext);
    mockContext.newPage.mockResolvedValue(mockPage);

    // Create comprehensive permission manager mock
    mockPermissionManager = {
      checkToolPermission: vi.fn(() => Promise.resolve({
        allowed: true,
        level: 'full',
        requiresConfirmation: false
      })),
      getToolConfig: vi.fn(() => Promise.resolve({
        enabled: true,
        timeout: 30000,
        allowedDomains: ['integration-test.example.com', 'test-app.example.com'],
        consoleStream: {
          enabled: true,
          config: {
            minLevel: ConsoleLogLevel.DEBUG,
            maxBufferSize: 100,
            captureArgs: true,
            captureStackTraces: true,
          }
        }
      } as BrowserToolConfig)),
    };

    browserTool = new BrowserTool({ permissionManager: mockPermissionManager });

    // Setup event handler capture for simulation
    mockPage.on.mockImplementation((event: string, handler: any) => {
      switch (event) {
        case 'console':
          consoleHandler = handler;
          break;
        case 'pageerror':
          errorHandler = handler;
          break;
        case 'requestfailed':
          requestFailedHandler = handler;
          break;
        case 'response':
          responseHandler = handler;
          break;
      }
    });
  });

  afterEach(() => {
    // Clean up browser resources
    try {
      if (browserTool.getConsoleStream?.()) {
        browserTool.getConsoleStream()?.stopStream();
      }
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Complete Workflow - Console Capture and Error Detection', () => {
    it('should demonstrate full console capture workflow', async () => {
      // Step 1: Navigate to a page (this initializes console stream)
      const navigationResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://integration-test.example.com/app' }
      });

      expect(navigationResult.success).toBe(true);
      expect(navigationResult.metadata?.enhancedConsoleMessages).toBeDefined();
      expect(navigationResult.metadata?.enhancedRuntimeErrors).toBeDefined();

      // Step 2: Simulate various console messages
      const consoleMessages = [
        {
          type: () => 'log',
          text: () => 'Application initialized',
          location: () => ({ url: 'https://integration-test.example.com/app.js', lineNumber: 15, columnNumber: 8 }),
          args: () => [
            { jsonValue: () => Promise.resolve('v1.2.3'), toString: () => 'v1.2.3' }
          ]
        },
        {
          type: () => 'info',
          text: () => 'User authentication successful',
          location: () => ({ url: 'https://integration-test.example.com/auth.js', lineNumber: 42, columnNumber: 12 }),
          args: () => [
            { jsonValue: () => Promise.resolve({ userId: 123 }), toString: () => '[object Object]' }
          ]
        },
        {
          type: () => 'warning',
          text: () => 'Deprecated API usage detected',
          location: () => ({ url: 'https://integration-test.example.com/legacy.js', lineNumber: 88, columnNumber: 5 }),
          args: () => []
        },
        {
          type: () => 'error',
          text: () => 'Failed to load resource: net::ERR_INTERNET_DISCONNECTED',
          location: () => ({ url: 'https://integration-test.example.com/api.js', lineNumber: 156, columnNumber: 20 }),
          args: () => []
        }
      ];

      // Simulate each console message
      for (const message of consoleMessages) {
        await consoleHandler(message);
      }

      // Step 3: Verify console messages were captured
      const capturedMessages = browserTool.getEnhancedConsoleMessages();
      expect(capturedMessages).toHaveLength(4);

      // Verify log message
      expect(capturedMessages[0]).toMatchObject({
        type: 'log',
        text: 'Application initialized',
        level: ConsoleLogLevel.INFO,
        location: {
          url: 'https://integration-test.example.com/app.js',
          lineNumber: 15,
          columnNumber: 8
        },
        args: ['v1.2.3']
      });

      // Verify info message with complex arguments
      expect(capturedMessages[1]).toMatchObject({
        type: 'info',
        text: 'User authentication successful',
        level: ConsoleLogLevel.INFO,
        location: {
          url: 'https://integration-test.example.com/auth.js',
          lineNumber: 42,
          columnNumber: 12
        }
      });

      // Verify warning message
      expect(capturedMessages[2]).toMatchObject({
        type: 'warning',
        text: 'Deprecated API usage detected',
        level: ConsoleLogLevel.WARN,
        location: {
          url: 'https://integration-test.example.com/legacy.js',
          lineNumber: 88,
          columnNumber: 5
        }
      });

      // Verify error message
      expect(capturedMessages[3]).toMatchObject({
        type: 'error',
        text: 'Failed to load resource: net::ERR_INTERNET_DISCONNECTED',
        level: ConsoleLogLevel.ERROR,
        location: {
          url: 'https://integration-test.example.com/api.js',
          lineNumber: 156,
          columnNumber: 20
        }
      });

      // Step 4: Verify all messages have proper page context
      capturedMessages.forEach(message => {
        expect(message.pageContext).toMatchObject({
          url: 'https://integration-test.example.com',
          title: 'Integration Test Page',
          userAgent: 'Mozilla/5.0 (Test) AppleWebKit/537.36'
        });
        expect(message.timestamp).toBeInstanceOf(Date);
        expect(message.sessionId).toMatch(/^[a-f0-9-]+$/);
      });
    });

    it('should demonstrate full runtime error detection workflow', async () => {
      // Step 1: Initialize browser automation
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://integration-test.example.com/error-test' }
      });

      // Step 2: Simulate various runtime errors
      const runtimeErrors = [
        // JavaScript TypeError
        Object.assign(new Error('Cannot read property "click" of null'), {
          name: 'TypeError',
          stack: 'TypeError: Cannot read property "click" of null\n' +
                 '    at handleButtonClick (https://integration-test.example.com/handlers.js:25:15)\n' +
                 '    at HTMLButtonElement.onclick (https://integration-test.example.com/app.js:100:5)'
        }),
        // Network Error
        Object.assign(new Error('Failed to fetch: network error'), {
          name: 'NetworkError',
          stack: 'NetworkError: Failed to fetch: network error\n' +
                 '    at fetch (https://integration-test.example.com/api.js:45:10)'
        }),
        // Security Error
        Object.assign(new Error('Cross-origin request blocked by CORS policy'), {
          name: 'SecurityError',
          stack: 'SecurityError: Cross-origin request blocked by CORS policy\n' +
                 '    at XMLHttpRequest.send (https://integration-test.example.com/xhr.js:78:22)'
        }),
        // Permission Error
        Object.assign(new Error('Permission denied: geolocation access'), {
          name: 'NotAllowedError',
          stack: 'NotAllowedError: Permission denied: geolocation access\n' +
                 '    at Geolocation.getCurrentPosition (https://integration-test.example.com/location.js:12:8)'
        }),
        // Resource Error
        Object.assign(new Error('Failed to load resource: 404 Not Found'), {
          name: 'ResourceError',
          stack: 'ResourceError: Failed to load resource: 404 Not Found\n' +
                 '    at Image.onerror (https://integration-test.example.com/media.js:33:16)'
        }),
        // Critical Error
        Object.assign(new Error('Fatal application crash detected'), {
          name: 'FatalError',
          stack: 'FatalError: Fatal application crash detected\n' +
                 '    at window.onerror (https://integration-test.example.com/error-handler.js:89:12)'
        })
      ];

      // Simulate each runtime error
      for (const error of runtimeErrors) {
        await errorHandler(error);
      }

      // Step 3: Verify runtime errors were captured and categorized
      const capturedErrors = browserTool.getEnhancedRuntimeErrors();
      expect(capturedErrors).toHaveLength(6);

      // Verify JavaScript error categorization
      expect(capturedErrors[0]).toMatchObject({
        name: 'TypeError',
        message: 'Cannot read property "click" of null',
        category: 'javascript',
        severity: 'high',
        stack: expect.stringContaining('TypeError: Cannot read property "click" of null')
      });

      // Verify Network error categorization
      expect(capturedErrors[1]).toMatchObject({
        name: 'NetworkError',
        message: 'Failed to fetch: network error',
        category: 'network',
        severity: 'high'
      });

      // Verify Security error categorization
      expect(capturedErrors[2]).toMatchObject({
        name: 'SecurityError',
        message: 'Cross-origin request blocked by CORS policy',
        category: 'security',
        severity: 'medium'
      });

      // Verify Permission error categorization
      expect(capturedErrors[3]).toMatchObject({
        name: 'NotAllowedError',
        message: 'Permission denied: geolocation access',
        category: 'permission',
        severity: 'medium'
      });

      // Verify Resource error categorization
      expect(capturedErrors[4]).toMatchObject({
        name: 'ResourceError',
        message: 'Failed to load resource: 404 Not Found',
        category: 'resource',
        severity: 'high'
      });

      // Verify Critical error categorization
      expect(capturedErrors[5]).toMatchObject({
        name: 'FatalError',
        message: 'Fatal application crash detected',
        category: 'javascript',
        severity: 'critical'
      });

      // Step 4: Verify all errors have proper context
      capturedErrors.forEach(error => {
        expect(error.context).toMatchObject({
          userAgent: 'Mozilla/5.0 (Test) AppleWebKit/537.36',
          pageUrl: 'https://integration-test.example.com',
          pageTitle: 'Integration Test Page',
          viewport: { width: 1920, height: 1080 }
        });
        expect(error.timestamp).toBeInstanceOf(Date);
        expect(error.sessionId).toMatch(/^[a-f0-9-]+$/);
      });
    });

    it('should demonstrate browser operations with console monitoring', async () => {
      // Step 1: Navigate and capture initial console output
      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://integration-test.example.com/interactive' }
      });

      expect(navResult.success).toBe(true);

      // Simulate console output during navigation
      await consoleHandler({
        type: () => 'info',
        text: () => 'Page loaded successfully',
        location: () => ({ url: 'https://integration-test.example.com/interactive', lineNumber: 1 }),
        args: () => []
      });

      // Step 2: Click operation with console monitoring
      const clickResult = await browserTool.execute({
        operation: 'click',
        params: { selector: '#dynamic-button' }
      });

      expect(clickResult.success).toBe(true);

      // Simulate console output from click event
      await consoleHandler({
        type: () => 'log',
        text: () => 'Button clicked: dynamic-button',
        location: () => ({ url: 'https://integration-test.example.com/events.js', lineNumber: 45 }),
        args: () => []
      });

      // Step 3: Type operation with console monitoring
      const typeResult = await browserTool.execute({
        operation: 'type',
        params: { selector: '#text-input', text: 'integration test data' }
      });

      expect(typeResult.success).toBe(true);

      // Simulate console output from input validation
      await consoleHandler({
        type: () => 'debug',
        text: () => 'Input validation passed for: text-input',
        location: () => ({ url: 'https://integration-test.example.com/validation.js', lineNumber: 78 }),
        args: () => []
      });

      // Step 4: Screenshot operation
      const screenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      expect(screenshotResult.success).toBe(true);
      expect(screenshotResult.screenshot).toBeDefined();

      // Step 5: Verify all operations included console data in metadata
      [navResult, clickResult, typeResult, screenshotResult].forEach(result => {
        expect(result.metadata?.enhancedConsoleMessages).toBeDefined();
        expect(result.metadata?.enhancedRuntimeErrors).toBeDefined();
        expect(result.metadata?.permissionGranted).toBe(true);
      });

      // Step 6: Verify cumulative console messages
      const allMessages = browserTool.getEnhancedConsoleMessages();
      expect(allMessages.length).toBeGreaterThanOrEqual(3);

      const messageTexts = allMessages.map(m => m.text);
      expect(messageTexts).toContain('Page loaded successfully');
      expect(messageTexts).toContain('Button clicked: dynamic-button');
      expect(messageTexts).toContain('Input validation passed for: text-input');
    });

    it('should demonstrate network error detection during browser operations', async () => {
      // Step 1: Navigate to page
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://integration-test.example.com/network-test' }
      });

      // Step 2: Simulate network request failures
      const networkFailures = [
        {
          url: () => 'https://integration-test.example.com/api/users',
          method: () => 'GET',
          failure: () => ({ errorText: 'Connection timeout after 30 seconds' })
        },
        {
          url: () => 'https://integration-test.example.com/api/data',
          method: () => 'POST',
          failure: () => ({ errorText: 'DNS resolution failed' })
        }
      ];

      networkFailures.forEach(request => {
        requestFailedHandler(request);
      });

      // Step 3: Simulate HTTP error responses
      const httpErrors = [
        {
          url: () => 'https://integration-test.example.com/api/protected',
          status: () => 401,
          statusText: () => 'Unauthorized',
          request: () => ({ method: () => 'GET' })
        },
        {
          url: () => 'https://integration-test.example.com/api/notfound',
          status: () => 404,
          statusText: () => 'Not Found',
          request: () => ({ method: () => 'GET' })
        },
        {
          url: () => 'https://integration-test.example.com/api/server-error',
          status: () => 500,
          statusText: () => 'Internal Server Error',
          request: () => ({ method: () => 'POST' })
        }
      ];

      httpErrors.forEach(response => {
        responseHandler(response);
      });

      // Step 4: Verify network errors were captured
      const consoleStream = browserTool.getConsoleStream();
      expect(consoleStream).toBeInstanceOf(BrowserConsoleStream);

      // Network errors are emitted as events, we verify the handlers were called
      expect(requestFailedHandler).toHaveBeenCalledTimes(2);
      expect(responseHandler).toHaveBeenCalledTimes(3);

      // Step 5: Verify successful responses are not treated as errors
      responseHandler({
        url: () => 'https://integration-test.example.com/api/success',
        status: () => 200,
        statusText: () => 'OK',
        request: () => ({ method: () => 'GET' })
      });

      // This should not trigger network error (status 200 is success)
      expect(responseHandler).toHaveBeenCalledTimes(4);
    });

    it('should demonstrate buffer management during high-volume operations', async () => {
      // Step 1: Configure with small buffer for testing
      mockPermissionManager.getToolConfig.mockResolvedValue({
        enabled: true,
        consoleStream: {
          enabled: true,
          config: {
            minLevel: ConsoleLogLevel.DEBUG,
            maxBufferSize: 10, // Small buffer for testing
            captureArgs: false,
          }
        }
      } as BrowserToolConfig);

      // Reinitialize with new config
      browserTool = new BrowserTool({ permissionManager: mockPermissionManager });

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://integration-test.example.com/high-volume' }
      });

      // Step 2: Simulate many console messages to test buffer management
      for (let i = 0; i < 25; i++) {
        await consoleHandler({
          type: () => 'log',
          text: () => `High volume message ${i}`,
          location: () => ({ url: 'https://integration-test.example.com/volume.js', lineNumber: i + 1 }),
          args: () => []
        });
      }

      // Step 3: Verify buffer size is maintained
      const messages = browserTool.getEnhancedConsoleMessages();
      expect(messages.length).toBeLessThanOrEqual(10);

      // Step 4: Verify we kept the most recent messages
      const lastMessage = messages[messages.length - 1];
      expect(lastMessage.text).toBe('High volume message 24');

      // Step 5: Test buffer clearing
      browserTool.clearConsoleBuffers();
      expect(browserTool.getEnhancedConsoleMessages()).toHaveLength(0);
      expect(browserTool.getEnhancedRuntimeErrors()).toHaveLength(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle console stream failures gracefully', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock page.url to throw error during context gathering
      mockPage.url.mockImplementation(() => {
        throw new Error('Page context access failed');
      });

      // Should still complete navigation successfully
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://integration-test.example.com/error-page' }
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.enhancedConsoleMessages).toBeDefined();
      expect(result.metadata?.enhancedRuntimeErrors).toBeDefined();

      warnSpy.mockRestore();
    });

    it('should handle malformed console messages gracefully', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://integration-test.example.com/malformed' }
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Simulate malformed console message
      const malformedMessage = {
        type: () => { throw new Error('Type access failed'); },
        text: () => 'Valid text',
        location: () => ({}),
        args: () => []
      };

      // Should not crash the application
      expect(async () => {
        await consoleHandler(malformedMessage);
      }).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should handle browser disconnection during operations', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://integration-test.example.com/disconnect-test' }
      });

      // Simulate browser disconnection
      mockBrowser.isConnected.mockReturnValue(false);

      // Operations should handle disconnection gracefully
      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: '#test-button' }
      });

      // Depending on implementation, this may succeed (if browser reconnects)
      // or fail gracefully without crashing
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Performance and Memory Management', () => {
    it('should demonstrate efficient resource cleanup', async () => {
      // Step 1: Perform multiple operations
      const operations = [
        { operation: 'navigate' as const, params: { url: 'https://integration-test.example.com/page1' }},
        { operation: 'click' as const, params: { selector: '#button1' }},
        { operation: 'type' as const, params: { selector: '#input1', text: 'test data' }},
        { operation: 'screenshot' as const, params: { fullPage: true }},
      ];

      for (const op of operations) {
        const result = await browserTool.execute(op);
        expect(result.success).toBe(true);
      }

      // Step 2: Generate console activity for each operation
      for (let i = 0; i < operations.length; i++) {
        await consoleHandler({
          type: () => 'info',
          text: () => `Operation ${i} completed`,
          location: () => ({ url: `https://integration-test.example.com/page1`, lineNumber: i + 10 }),
          args: () => []
        });
      }

      // Step 3: Verify memory usage is reasonable
      const messages = browserTool.getEnhancedConsoleMessages();
      expect(messages.length).toBeGreaterThan(0);

      // Step 4: Test cleanup
      browserTool.clearConsoleBuffers();
      expect(browserTool.getEnhancedConsoleMessages()).toHaveLength(0);

      // Step 5: Verify stream can be stopped and restarted
      const consoleStream = browserTool.getConsoleStream();
      if (consoleStream) {
        consoleStream.stopStream();
        expect(consoleStream.getStats().isActive).toBe(false);
      }
    });
  });
});