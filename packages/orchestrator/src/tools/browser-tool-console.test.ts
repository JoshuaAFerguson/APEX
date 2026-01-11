/**
 * Browser Tool Console Integration Tests
 *
 * Tests specifically for the enhanced console capture and streaming integration
 * between BrowserTool and BrowserConsoleStream, verifying:
 * - Console stream initialization and lifecycle
 * - Enhanced console message capture in operations
 * - Runtime error detection and context
 * - Integration with permission management
 * - Performance and memory management
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { BrowserTool, BrowserToolConfig } from './browser-tool';
import { BrowserConsoleStream, ConsoleLogLevel } from '../browser-console-stream';

// Mock Playwright
const mockPage = {
  on: vi.fn(),
  url: vi.fn(() => 'https://test.example.com'),
  title: vi.fn(() => 'Test Page Title'),
  evaluate: vi.fn(() => Promise.resolve('Test User Agent')),
  viewportSize: vi.fn(() => ({ width: 1920, height: 1080 })),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  click: vi.fn(),
  fill: vi.fn(),
  type: vi.fn(),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-screenshot'))),
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

// Mock Playwright modules
vi.mock('playwright', () => ({
  chromium: mockBrowserType,
  firefox: mockBrowserType,
  webkit: mockBrowserType,
}));

describe('Browser Tool Console Integration', () => {
  let browserTool: BrowserTool;
  let mockPermissionManager: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock responses
    mockBrowser.newContext.mockResolvedValue(mockContext);
    mockContext.newPage.mockResolvedValue(mockPage);

    // Create mock permission manager
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
            minLevel: ConsoleLogLevel.DEBUG,
            captureArgs: true,
            captureStackTraces: true,
          }
        }
      } as BrowserToolConfig)),
    };

    browserTool = new BrowserTool({ permissionManager: mockPermissionManager });
  });

  afterEach(() => {
    // Clean up any browser resources
    try {
      if (browserTool.getConsoleStream?.()) {
        browserTool.getConsoleStream()?.stopStream();
      }
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Console Stream Initialization', () => {
    it('should initialize console stream when performing operations', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      expect(result.success).toBe(true);

      // Check that enhanced console data is included in metadata
      expect(result.metadata?.enhancedConsoleMessages).toBeDefined();
      expect(result.metadata?.enhancedRuntimeErrors).toBeDefined();

      // Verify console stream was created
      const consoleStream = browserTool.getConsoleStream();
      expect(consoleStream).toBeInstanceOf(BrowserConsoleStream);
    });

    it('should not initialize console stream when disabled', async () => {
      // Configure with console streaming disabled
      mockPermissionManager.getToolConfig.mockResolvedValue({
        enabled: true,
        consoleStream: {
          enabled: false
        }
      } as BrowserToolConfig);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      expect(result.success).toBe(true);

      // Enhanced console data should still be in metadata but empty
      expect(result.metadata?.enhancedConsoleMessages).toEqual([]);
      expect(result.metadata?.enhancedRuntimeErrors).toEqual([]);
    });

    it('should handle console stream initialization failure gracefully', async () => {
      // Mock console.warn to avoid test output
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Force an error during stream initialization
      const originalConsoleStream = BrowserConsoleStream;
      vi.doMock('../browser-console-stream', () => ({
        BrowserConsoleStream: vi.fn(() => {
          throw new Error('Stream initialization failed');
        })
      }));

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      // Operation should still succeed with fallback
      expect(result.success).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to set up console streaming:',
        expect.any(Error)
      );

      warnSpy.mockRestore();
    });
  });

  describe('Enhanced Console Message Capture', () => {
    let consoleHandler: (message: any) => Promise<void>;
    let mockConsoleMessage: any;

    beforeEach(async () => {
      // Initialize browser tool to set up page listeners
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      // Find the console message handler
      const pageOnCalls = mockPage.on.mock.calls;
      const consoleCall = pageOnCalls.find(call => call[0] === 'console');
      consoleHandler = consoleCall?.[1];

      // Setup mock console message
      mockConsoleMessage = {
        type: vi.fn(),
        text: vi.fn(),
        location: vi.fn(() => ({
          url: 'https://test.example.com/app.js',
          lineNumber: 25,
          columnNumber: 10,
        })),
        args: vi.fn(() => [
          { jsonValue: vi.fn(() => Promise.resolve('test')), toString: vi.fn(() => 'test') },
          { jsonValue: vi.fn(() => Promise.resolve(42)), toString: vi.fn(() => '42') },
        ]),
      };
    });

    it('should capture enhanced console messages during operations', async () => {
      // Simulate console message
      mockConsoleMessage.type.mockReturnValue('log');
      mockConsoleMessage.text.mockReturnValue('Application started successfully');

      await consoleHandler(mockConsoleMessage);

      const enhancedMessages = browserTool.getEnhancedConsoleMessages();
      expect(enhancedMessages).toHaveLength(1);

      const message = enhancedMessages[0];
      expect(message).toMatchObject({
        type: 'log',
        text: 'Application started successfully',
        level: ConsoleLogLevel.INFO,
        timestamp: expect.any(Date),
        sessionId: expect.any(String),
        location: {
          url: 'https://test.example.com/app.js',
          lineNumber: 25,
          columnNumber: 10,
        },
        pageContext: {
          url: 'https://test.example.com',
          title: 'Test Page Title',
          userAgent: 'Test User Agent',
        },
        args: ['test', 42],
      });
    });

    it('should capture console messages of different types', async () => {
      const testCases = [
        { type: 'error', expectedLevel: ConsoleLogLevel.ERROR },
        { type: 'warning', expectedLevel: ConsoleLogLevel.WARN },
        { type: 'info', expectedLevel: ConsoleLogLevel.INFO },
        { type: 'debug', expectedLevel: ConsoleLogLevel.DEBUG },
      ];

      for (const testCase of testCases) {
        mockConsoleMessage.type.mockReturnValue(testCase.type);
        mockConsoleMessage.text.mockReturnValue(`${testCase.type} message`);

        await consoleHandler(mockConsoleMessage);
      }

      const enhancedMessages = browserTool.getEnhancedConsoleMessages();
      expect(enhancedMessages).toHaveLength(testCases.length);

      testCases.forEach((testCase, index) => {
        expect(enhancedMessages[index]).toMatchObject({
          type: testCase.type,
          level: testCase.expectedLevel,
        });
      });
    });
  });

  describe('Enhanced Runtime Error Detection', () => {
    let errorHandler: (error: Error) => Promise<void>;

    beforeEach(async () => {
      // Initialize browser tool to set up page listeners
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      // Find the pageerror handler
      const pageOnCalls = mockPage.on.mock.calls;
      const errorCall = pageOnCalls.find(call => call[0] === 'pageerror');
      errorHandler = errorCall?.[1];
    });

    it('should capture enhanced runtime errors during operations', async () => {
      const testError = new Error('TypeError: Cannot read property "x" of undefined');
      testError.name = 'TypeError';
      testError.stack = 'TypeError: Cannot read property "x" of undefined\n    at Object.test (https://test.example.com/app.js:42:15)\n    at main (https://test.example.com/app.js:100:5)';

      await errorHandler(testError);

      const enhancedErrors = browserTool.getEnhancedRuntimeErrors();
      expect(enhancedErrors).toHaveLength(1);

      const error = enhancedErrors[0];
      expect(error).toMatchObject({
        message: 'TypeError: Cannot read property "x" of undefined',
        name: 'TypeError',
        stack: expect.stringContaining('TypeError: Cannot read property "x" of undefined'),
        timestamp: expect.any(Date),
        category: 'javascript',
        severity: 'high',
        context: {
          userAgent: 'Test User Agent',
          pageUrl: 'https://test.example.com',
          pageTitle: 'Test Page Title',
          viewport: { width: 1920, height: 1080 },
          timestamp: expect.any(Date),
        },
        sessionId: expect.any(String),
      });
    });

    it('should categorize different types of runtime errors', async () => {
      const testCases = [
        {
          message: 'Network error: Failed to fetch',
          expectedCategory: 'network',
          expectedSeverity: 'high'
        },
        {
          message: 'CORS policy: No Access-Control-Allow-Origin header',
          expectedCategory: 'security',
          expectedSeverity: 'medium'
        },
        {
          message: 'Permission denied for geolocation',
          expectedCategory: 'permission',
          expectedSeverity: 'medium'
        },
        {
          message: 'Resource load error: 404 Not Found',
          expectedCategory: 'resource',
          expectedSeverity: 'high'
        },
        {
          message: 'Fatal crash: Application terminated unexpectedly',
          expectedCategory: 'javascript',
          expectedSeverity: 'critical'
        },
      ];

      for (const testCase of testCases) {
        const error = new Error(testCase.message);
        await errorHandler(error);
      }

      const enhancedErrors = browserTool.getEnhancedRuntimeErrors();
      expect(enhancedErrors).toHaveLength(testCases.length);

      testCases.forEach((testCase, index) => {
        expect(enhancedErrors[index]).toMatchObject({
          category: testCase.expectedCategory,
          severity: testCase.expectedSeverity,
        });
      });
    });
  });

  describe('Operation Result Integration', () => {
    it('should include enhanced console data in navigation results', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com/page' }
      });

      expect(result).toMatchObject({
        success: true,
        operation: 'navigate',
        data: {
          url: 'https://test.example.com/page',
          status: 200,
        },
        metadata: {
          url: 'https://test.example.com/page',
          title: 'Test Page Title',
          executionTime: 0,
          permissionGranted: true,
          consoleMessages: expect.any(Array),
          runtimeErrors: expect.any(Array),
          enhancedConsoleMessages: expect.any(Array),
          enhancedRuntimeErrors: expect.any(Array),
        },
      });
    });

    it('should include enhanced console data in click operation results', async () => {
      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: '#submit-button' }
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.enhancedConsoleMessages).toBeDefined();
      expect(result.metadata?.enhancedRuntimeErrors).toBeDefined();
    });

    it('should include enhanced console data in screenshot operation results', async () => {
      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.enhancedConsoleMessages).toBeDefined();
      expect(result.metadata?.enhancedRuntimeErrors).toBeDefined();
    });
  });

  describe('Buffer Management and Performance', () => {
    it('should manage console message buffer size to prevent memory issues', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      const pageOnCalls = mockPage.on.mock.calls;
      const consoleCall = pageOnCalls.find(call => call[0] === 'console');
      const consoleHandler = consoleCall?.[1];

      const mockConsoleMessage = {
        type: vi.fn(() => 'log'),
        text: vi.fn(),
        location: vi.fn(() => ({})),
        args: vi.fn(() => []),
      };

      // Add many messages to test buffer management
      for (let i = 0; i < 1050; i++) {
        mockConsoleMessage.text.mockReturnValue(`Message ${i}`);
        await consoleHandler(mockConsoleMessage);
      }

      const enhancedMessages = browserTool.getEnhancedConsoleMessages();

      // Should not exceed buffer limit (1000)
      expect(enhancedMessages.length).toBeLessThanOrEqual(1000);

      // Should contain the most recent messages
      const lastMessage = enhancedMessages[enhancedMessages.length - 1];
      expect(lastMessage.text).toBe('Message 1049');
    });

    it('should clear console buffers on command', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      const pageOnCalls = mockPage.on.mock.calls;
      const consoleCall = pageOnCalls.find(call => call[0] === 'console');
      const consoleHandler = consoleCall?.[1];

      const mockConsoleMessage = {
        type: vi.fn(() => 'log'),
        text: vi.fn(() => 'Test message'),
        location: vi.fn(() => ({})),
        args: vi.fn(() => []),
      };

      // Add some messages
      await consoleHandler(mockConsoleMessage);

      expect(browserTool.getEnhancedConsoleMessages()).toHaveLength(1);

      // Clear buffers
      browserTool.clearConsoleBuffers();

      expect(browserTool.getEnhancedConsoleMessages()).toHaveLength(0);
      expect(browserTool.getEnhancedRuntimeErrors()).toHaveLength(0);
    });
  });

  describe('Console Stream Access', () => {
    it('should provide access to console stream instance', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      const consoleStream = browserTool.getConsoleStream();
      expect(consoleStream).toBeInstanceOf(BrowserConsoleStream);

      const stats = consoleStream?.getStats();
      expect(stats).toMatchObject({
        messagesCount: expect.any(Number),
        errorsCount: expect.any(Number),
        isActive: true,
        sessionId: expect.any(String),
      });
    });

    it('should return undefined for console stream before initialization', () => {
      const consoleStream = browserTool.getConsoleStream();
      expect(consoleStream).toBeUndefined();
    });
  });

  describe('Configuration Integration', () => {
    it('should respect console stream configuration from tool config', async () => {
      // Configure with specific console stream settings
      mockPermissionManager.getToolConfig.mockResolvedValue({
        enabled: true,
        consoleStream: {
          enabled: true,
          config: {
            minLevel: ConsoleLogLevel.ERROR,
            captureArgs: false,
            maxBufferSize: 50,
          }
        }
      } as BrowserToolConfig);

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      const consoleStream = browserTool.getConsoleStream();
      expect(consoleStream).toBeInstanceOf(BrowserConsoleStream);

      // The configuration should be applied (specific values are internal to stream)
      // We verify by testing behavior: only ERROR level and above should be captured
      const pageOnCalls = mockPage.on.mock.calls;
      const consoleCall = pageOnCalls.find(call => call[0] === 'console');
      const consoleHandler = consoleCall?.[1];

      const mockConsoleMessage = {
        type: vi.fn(),
        text: vi.fn(),
        location: vi.fn(() => ({})),
        args: vi.fn(() => []),
      };

      // Add info message (should be filtered out)
      mockConsoleMessage.type.mockReturnValue('info');
      mockConsoleMessage.text.mockReturnValue('Info message');
      await consoleHandler(mockConsoleMessage);

      // Add error message (should be captured)
      mockConsoleMessage.type.mockReturnValue('error');
      mockConsoleMessage.text.mockReturnValue('Error message');
      await consoleHandler(mockConsoleMessage);

      const messages = browserTool.getEnhancedConsoleMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('error');
    });
  });
});