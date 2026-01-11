/**
 * Browser Automation Integration Example Test
 *
 * This test provides a simple, practical example demonstrating the browser automation
 * functionality with console capture and error detection. This serves as both a test
 * and documentation of how to use the browser automation features.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserTool } from '../tools/browser-tool';
import { BrowserConsoleStream, ConsoleLogLevel } from '../browser-console-stream';

// Simple mock setup for demonstration
const mockPage = {
  on: vi.fn(),
  url: vi.fn(() => 'https://example.com'),
  title: vi.fn(() => 'Example Website'),
  evaluate: vi.fn(() => Promise.resolve('Mozilla/5.0 (Example) Chrome/91.0')),
  viewportSize: vi.fn(() => ({ width: 1280, height: 720 })),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  click: vi.fn(),
  fill: vi.fn(),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('example-screenshot'))),
};

const mockContext = {
  newPage: vi.fn(() => Promise.resolve(mockPage)),
  close: vi.fn(),
};

const mockBrowser = {
  newContext: vi.fn(() => Promise.resolve(mockContext)),
  close: vi.fn(),
  isConnected: vi.fn(() => true),
};

vi.mock('playwright', () => ({
  chromium: { launch: vi.fn(() => Promise.resolve(mockBrowser)) },
  firefox: { launch: vi.fn(() => Promise.resolve(mockBrowser)) },
  webkit: { launch: vi.fn(() => Promise.resolve(mockBrowser)) },
}));

describe('Browser Automation Integration Example', () => {
  let browserTool: BrowserTool;
  let mockPermissionManager: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Simple permission manager for the example
    mockPermissionManager = {
      checkToolPermission: vi.fn(() => Promise.resolve({
        allowed: true,
        level: 'full',
        requiresConfirmation: false
      })),
      getToolConfig: vi.fn(() => Promise.resolve({
        enabled: true,
        consoleStream: {
          enabled: true,
          config: {
            minLevel: ConsoleLogLevel.INFO,
            captureArgs: true,
            captureStackTraces: true,
          }
        }
      })),
    };

    browserTool = new BrowserTool({ permissionManager: mockPermissionManager });
  });

  afterEach(() => {
    // Clean up
    const stream = browserTool.getConsoleStream();
    if (stream) {
      stream.stopStream();
    }
  });

  describe('Simple Integration Example', () => {
    it('should demonstrate basic browser automation with console capture', async () => {
      // Example 1: Navigate to a website
      console.log('📁 Example: Basic navigation with console monitoring');

      const navigationResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(navigationResult.success).toBe(true);
      console.log('✅ Navigation successful');

      // Verify console stream is initialized
      const consoleStream = browserTool.getConsoleStream();
      expect(consoleStream).toBeInstanceOf(BrowserConsoleStream);
      console.log('✅ Console stream initialized');

      // Example 2: Capture console output
      console.log('📁 Example: Console message capture');

      // Find the console handler and simulate a message
      const pageOnCalls = mockPage.on.mock.calls;
      const consoleCall = pageOnCalls.find(call => call[0] === 'console');
      const consoleHandler = consoleCall?.[1];

      expect(consoleHandler).toBeDefined();

      // Simulate a console message from the page
      await consoleHandler({
        type: () => 'log',
        text: () => 'Page loaded successfully!',
        location: () => ({ url: 'https://example.com/app.js', lineNumber: 15 }),
        args: () => []
      });

      const capturedMessages = browserTool.getEnhancedConsoleMessages();
      expect(capturedMessages).toHaveLength(1);
      expect(capturedMessages[0].text).toBe('Page loaded successfully!');
      console.log('✅ Console message captured:', capturedMessages[0].text);

      // Example 3: Error detection
      console.log('📁 Example: Runtime error detection');

      // Find the error handler and simulate an error
      const errorCall = pageOnCalls.find(call => call[0] === 'pageerror');
      const errorHandler = errorCall?.[1];

      expect(errorHandler).toBeDefined();

      // Simulate a JavaScript error
      const jsError = new Error('Button not found in DOM');
      jsError.name = 'ElementError';
      jsError.stack = 'ElementError: Button not found in DOM\n    at findButton (app.js:42:15)';

      await errorHandler(jsError);

      const capturedErrors = browserTool.getEnhancedRuntimeErrors();
      expect(capturedErrors).toHaveLength(1);
      expect(capturedErrors[0].message).toBe('Button not found in DOM');
      expect(capturedErrors[0].category).toBe('javascript');
      console.log('✅ Runtime error captured:', capturedErrors[0].message);

      // Example 4: Browser interaction with monitoring
      console.log('📁 Example: Browser interaction with monitoring');

      const clickResult = await browserTool.execute({
        operation: 'click',
        params: { selector: '#submit-button' }
      });

      expect(clickResult.success).toBe(true);
      expect(clickResult.metadata?.enhancedConsoleMessages).toBeDefined();
      expect(clickResult.metadata?.enhancedRuntimeErrors).toBeDefined();
      console.log('✅ Click operation completed with monitoring data');

      // Example 5: Screenshot with console data
      console.log('📁 Example: Screenshot with console data');

      const screenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      expect(screenshotResult.success).toBe(true);
      expect(screenshotResult.screenshot).toBeDefined();
      expect(screenshotResult.metadata?.enhancedConsoleMessages).toBeDefined();
      console.log('✅ Screenshot taken with console monitoring active');

      console.log('🎉 Browser automation example completed successfully!');
    });

    it('should demonstrate error handling in real-world scenarios', async () => {
      console.log('📁 Example: Real-world error scenarios');

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/error-prone-page' }
      });

      // Get handlers
      const pageOnCalls = mockPage.on.mock.calls;
      const consoleHandler = pageOnCalls.find(call => call[0] === 'console')?.[1];
      const errorHandler = pageOnCalls.find(call => call[0] === 'pageerror')?.[1];

      // Simulate a realistic error scenario
      console.log('📁 Simulating: Network error followed by retry');

      // 1. Network error occurs
      const networkError = new Error('Failed to fetch user data from API');
      networkError.name = 'NetworkError';
      await errorHandler(networkError);

      // 2. Application logs the error
      await consoleHandler({
        type: () => 'error',
        text: () => 'API request failed, attempting retry...',
        location: () => ({ url: 'https://example.com/api.js', lineNumber: 67 }),
        args: () => []
      });

      // 3. Retry succeeds
      await consoleHandler({
        type: () => 'info',
        text: () => 'Retry successful, user data loaded',
        location: () => ({ url: 'https://example.com/api.js', lineNumber: 89 }),
        args: () => []
      });

      // Verify the scenario was captured
      const messages = browserTool.getEnhancedConsoleMessages();
      const errors = browserTool.getEnhancedRuntimeErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Failed to fetch user data from API');
      expect(errors[0].category).toBe('network');

      expect(messages).toHaveLength(2);
      expect(messages[0].text).toContain('API request failed');
      expect(messages[1].text).toContain('Retry successful');

      console.log('✅ Error scenario captured:', {
        errors: errors.length,
        messages: messages.length
      });
    });

    it('should demonstrate console filtering capabilities', async () => {
      console.log('📁 Example: Console filtering');

      // Configure with error-only filtering
      mockPermissionManager.getToolConfig.mockResolvedValue({
        enabled: true,
        consoleStream: {
          enabled: true,
          config: {
            minLevel: ConsoleLogLevel.ERROR, // Only capture errors and above
            captureArgs: true,
          }
        }
      });

      // Reinitialize with filtering config
      browserTool = new BrowserTool({ permissionManager: mockPermissionManager });

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/filtered-logging' }
      });

      const pageOnCalls = mockPage.on.mock.calls;
      const consoleHandler = pageOnCalls.find(call => call[0] === 'console')?.[1];

      // Simulate various log levels
      await consoleHandler({
        type: () => 'debug',
        text: () => 'Debug information (should be filtered)',
        location: () => ({}),
        args: () => []
      });

      await consoleHandler({
        type: () => 'info',
        text: () => 'Info message (should be filtered)',
        location: () => ({}),
        args: () => []
      });

      await consoleHandler({
        type: () => 'error',
        text: () => 'Error message (should be captured)',
        location: () => ({}),
        args: () => []
      });

      // Verify filtering worked
      const filteredMessages = browserTool.getEnhancedConsoleMessages();
      expect(filteredMessages).toHaveLength(1);
      expect(filteredMessages[0].text).toBe('Error message (should be captured)');
      expect(filteredMessages[0].level).toBe(ConsoleLogLevel.ERROR);

      console.log('✅ Console filtering working:', {
        captured: filteredMessages.length,
        message: filteredMessages[0].text
      });
    });

    it('should demonstrate buffer management', async () => {
      console.log('📁 Example: Buffer management');

      // Configure with small buffer for demonstration
      mockPermissionManager.getToolConfig.mockResolvedValue({
        enabled: true,
        consoleStream: {
          enabled: true,
          config: {
            maxBufferSize: 5, // Small buffer
            minLevel: ConsoleLogLevel.DEBUG
          }
        }
      });

      browserTool = new BrowserTool({ permissionManager: mockPermissionManager });

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/buffer-demo' }
      });

      const pageOnCalls = mockPage.on.mock.calls;
      const consoleHandler = pageOnCalls.find(call => call[0] === 'console')?.[1];

      // Generate more messages than buffer size
      for (let i = 0; i < 10; i++) {
        await consoleHandler({
          type: () => 'log',
          text: () => `Message ${i}`,
          location: () => ({}),
          args: () => []
        });
      }

      // Verify buffer management
      const messages = browserTool.getEnhancedConsoleMessages();
      expect(messages.length).toBeLessThanOrEqual(5); // Buffer limit

      // Should contain the most recent messages
      const lastMessage = messages[messages.length - 1];
      expect(lastMessage.text).toBe('Message 9');

      console.log('✅ Buffer management working:', {
        bufferSize: messages.length,
        lastMessage: lastMessage.text
      });

      // Demonstrate buffer clearing
      browserTool.clearConsoleBuffers();
      expect(browserTool.getEnhancedConsoleMessages()).toHaveLength(0);
      console.log('✅ Buffer cleared successfully');
    });
  });

  describe('Usage Patterns and Best Practices', () => {
    it('should demonstrate recommended usage patterns', async () => {
      console.log('📁 Example: Recommended usage patterns');

      // Pattern 1: Initialize once, use throughout session
      const initResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/best-practices' }
      });

      expect(initResult.success).toBe(true);
      console.log('✅ Pattern 1: Single initialization');

      // Pattern 2: Check console stream status
      const stream = browserTool.getConsoleStream();
      if (stream) {
        const stats = stream.getStats();
        console.log('📊 Stream stats:', stats);
        expect(stats.isActive).toBe(true);
      }

      // Pattern 3: Periodic monitoring during operations
      const operations = ['click', 'type', 'screenshot'];
      for (const operation of operations) {
        const result = await browserTool.execute({
          operation: operation as any,
          params: operation === 'type'
            ? { selector: '#input', text: 'test' }
            : operation === 'click'
            ? { selector: '#button' }
            : {}
        });

        expect(result.success).toBe(true);
        expect(result.metadata?.enhancedConsoleMessages).toBeDefined();
        console.log(`✅ Operation ${operation} completed with monitoring`);
      }

      // Pattern 4: Error analysis
      const pageOnCalls = mockPage.on.mock.calls;
      const errorHandler = pageOnCalls.find(call => call[0] === 'pageerror')?.[1];

      await errorHandler(new Error('Test error for analysis'));

      const errors = browserTool.getEnhancedRuntimeErrors();
      if (errors.length > 0) {
        const error = errors[0];
        console.log('🔍 Error analysis:', {
          category: error.category,
          severity: error.severity,
          hasStack: !!error.stack,
          hasContext: !!error.context
        });
      }

      console.log('✅ Usage patterns demonstrated successfully');
    });

    it('should show performance monitoring example', async () => {
      console.log('📁 Example: Performance monitoring');

      const startTime = Date.now();

      // Simulate a performance-critical operation
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/performance-test' }
      });

      // Multiple operations
      for (let i = 0; i < 5; i++) {
        await browserTool.execute({
          operation: 'click',
          params: { selector: `#button-${i}` }
        });
      }

      const executionTime = Date.now() - startTime;

      // Verify console stream performance
      const stream = browserTool.getConsoleStream();
      const stats = stream?.getStats();

      console.log('📊 Performance metrics:', {
        executionTime: `${executionTime}ms`,
        streamActive: stats?.isActive,
        messagesCount: stats?.messagesCount,
        errorsCount: stats?.errorsCount
      });

      expect(executionTime).toBeLessThan(10000); // Should complete quickly
      expect(stats?.isActive).toBe(true);

      console.log('✅ Performance monitoring completed');
    });
  });
});