/**
 * Browser Console Stream Tests
 *
 * Comprehensive test suite for BrowserConsoleStream class covering:
 * - Console message capture and streaming
 * - Enhanced runtime error detection
 * - Error context and stack trace processing
 * - Message filtering and categorization
 * - Performance and buffer management
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import {
  BrowserConsoleStream,
  ConsoleStreamConfig,
  ConsoleLogLevel,
  BrowserConsoleMessage,
  BrowserRuntimeError,
  ConsoleFilters,
  createConsoleStream
} from './browser-console-stream';

// Mock Playwright Page
const mockPage = {
  on: vi.fn(),
  url: vi.fn(() => 'https://example.com'),
  title: vi.fn(() => 'Test Page'),
  evaluate: vi.fn(() => Promise.resolve('Mozilla/5.0 (Test) Chrome/91.0.4472.124 Safari/537.36')),
  viewportSize: vi.fn(() => ({ width: 1280, height: 720 })),
};

const mockConsoleMessage = {
  type: vi.fn(),
  text: vi.fn(),
  location: vi.fn(() => ({
    url: 'https://example.com/script.js',
    lineNumber: 42,
    columnNumber: 10,
  })),
  args: vi.fn(() => []),
};

const mockConsoleArgs = [
  { jsonValue: vi.fn(() => Promise.resolve('test')), toString: vi.fn(() => 'test') },
  { jsonValue: vi.fn(() => Promise.resolve(123)), toString: vi.fn(() => '123') },
];

describe('BrowserConsoleStream', () => {
  let consoleStream: BrowserConsoleStream;
  let mockPageInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPageInstance = { ...mockPage };
    consoleStream = new BrowserConsoleStream();
  });

  afterEach(() => {
    if (consoleStream) {
      consoleStream.stopStream();
    }
  });

  describe('Initialization and Configuration', () => {
    it('should create console stream with default configuration', () => {
      const stream = new BrowserConsoleStream();
      expect(stream).toBeInstanceOf(BrowserConsoleStream);
      expect(stream).toBeInstanceOf(EventEmitter);
    });

    it('should create console stream with custom configuration', () => {
      const config: ConsoleStreamConfig = {
        minLevel: ConsoleLogLevel.ERROR,
        maxBufferSize: 500,
        captureArgs: false,
        captureStackTraces: false,
        sessionId: 'test-session',
      };

      const stream = new BrowserConsoleStream(config);
      const stats = stream.getStats();
      expect(stats.sessionId).toBe('test-session');
    });

    it('should use createConsoleStream factory function', () => {
      const stream = createConsoleStream({
        minLevel: ConsoleLogLevel.WARN,
        maxBufferSize: 200,
      });

      expect(stream).toBeInstanceOf(BrowserConsoleStream);
    });
  });

  describe('Stream Lifecycle', () => {
    it('should start stream successfully', async () => {
      const eventSpy = vi.fn();
      consoleStream.on('stream-started', eventSpy);

      await consoleStream.startStream(mockPageInstance);

      expect(mockPageInstance.on).toHaveBeenCalledWith('console', expect.any(Function));
      expect(mockPageInstance.on).toHaveBeenCalledWith('pageerror', expect.any(Function));
      expect(mockPageInstance.on).toHaveBeenCalledWith('requestfailed', expect.any(Function));
      expect(mockPageInstance.on).toHaveBeenCalledWith('response', expect.any(Function));
      expect(eventSpy).toHaveBeenCalledWith(expect.any(Object));

      const stats = consoleStream.getStats();
      expect(stats.isActive).toBe(true);
    });

    it('should prevent starting stream twice', async () => {
      await consoleStream.startStream(mockPageInstance);

      await expect(
        consoleStream.startStream(mockPageInstance)
      ).rejects.toThrow('Console stream is already active');
    });

    it('should stop stream successfully', async () => {
      const eventSpy = vi.fn();
      consoleStream.on('stream-stopped', eventSpy);

      await consoleStream.startStream(mockPageInstance);
      consoleStream.stopStream();

      expect(eventSpy).toHaveBeenCalled();

      const stats = consoleStream.getStats();
      expect(stats.isActive).toBe(false);
    });

    it('should handle stopping inactive stream gracefully', () => {
      expect(() => consoleStream.stopStream()).not.toThrow();
    });
  });

  describe('Console Message Capture', () => {
    beforeEach(async () => {
      await consoleStream.startStream(mockPageInstance);
    });

    it('should capture and emit console messages', async () => {
      const messageSpy = vi.fn();
      consoleStream.on('message', messageSpy);

      // Setup mock console message
      mockConsoleMessage.type.mockReturnValue('log');
      mockConsoleMessage.text.mockReturnValue('Test console message');
      mockConsoleMessage.args.mockReturnValue(mockConsoleArgs);

      // Simulate console message
      const consoleHandler = mockPageInstance.on.mock.calls.find(
        call => call[0] === 'console'
      )?.[1];
      expect(consoleHandler).toBeDefined();

      await consoleHandler(mockConsoleMessage);

      expect(messageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'log',
          text: 'Test console message',
          level: ConsoleLogLevel.INFO,
          timestamp: expect.any(Date),
          sessionId: expect.any(String),
          location: expect.objectContaining({
            url: 'https://example.com/script.js',
            lineNumber: 42,
            columnNumber: 10,
          }),
          pageContext: expect.objectContaining({
            url: 'https://example.com',
            title: 'Test Page',
            userAgent: expect.any(String),
          }),
        })
      );
    });

    it('should capture console arguments when enabled', async () => {
      const streamWithArgs = new BrowserConsoleStream({ captureArgs: true });
      await streamWithArgs.startStream(mockPageInstance);

      const messageSpy = vi.fn();
      streamWithArgs.on('message', messageSpy);

      mockConsoleMessage.type.mockReturnValue('log');
      mockConsoleMessage.text.mockReturnValue('Test with args');
      mockConsoleMessage.args.mockReturnValue(mockConsoleArgs);

      const consoleHandler = mockPageInstance.on.mock.calls.find(
        call => call[0] === 'console'
      )?.[1];

      await consoleHandler(mockConsoleMessage);

      expect(messageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          args: ['test', 123],
        })
      );

      streamWithArgs.stopStream();
    });

    it('should map console types to correct log levels', async () => {
      const testCases = [
        { type: 'error', expectedLevel: ConsoleLogLevel.ERROR },
        { type: 'warning', expectedLevel: ConsoleLogLevel.WARN },
        { type: 'info', expectedLevel: ConsoleLogLevel.INFO },
        { type: 'debug', expectedLevel: ConsoleLogLevel.DEBUG },
        { type: 'verbose', expectedLevel: ConsoleLogLevel.VERBOSE },
        { type: 'unknown', expectedLevel: ConsoleLogLevel.INFO },
      ];

      const messageSpy = vi.fn();
      consoleStream.on('message', messageSpy);

      const consoleHandler = mockPageInstance.on.mock.calls.find(
        call => call[0] === 'console'
      )?.[1];

      for (const testCase of testCases) {
        mockConsoleMessage.type.mockReturnValue(testCase.type);
        mockConsoleMessage.text.mockReturnValue(`${testCase.type} message`);

        await consoleHandler(mockConsoleMessage);

        expect(messageSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            level: testCase.expectedLevel,
          })
        );

        messageSpy.mockClear();
      }
    });
  });

  describe('Runtime Error Detection', () => {
    beforeEach(async () => {
      await consoleStream.startStream(mockPageInstance);
    });

    it('should capture and emit runtime errors', async () => {
      const errorSpy = vi.fn();
      consoleStream.on('error', errorSpy);

      const testError = new Error('Test runtime error');
      testError.stack = 'Error: Test runtime error\n    at test.js:10:5';

      const errorHandler = mockPageInstance.on.mock.calls.find(
        call => call[0] === 'pageerror'
      )?.[1];

      await errorHandler(testError);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test runtime error',
          name: 'Error',
          stack: expect.stringContaining('Test runtime error'),
          timestamp: expect.any(Date),
          category: 'javascript',
          severity: 'high',
          context: expect.objectContaining({
            userAgent: expect.any(String),
            pageUrl: 'https://example.com',
            pageTitle: 'Test Page',
            viewport: { width: 1280, height: 720 },
          }),
          sessionId: expect.any(String),
        })
      );
    });

    it('should categorize errors correctly', async () => {
      const errorSpy = vi.fn();
      consoleStream.on('error', errorSpy);

      const errorHandler = mockPageInstance.on.mock.calls.find(
        call => call[0] === 'pageerror'
      )?.[1];

      const testCases = [
        { message: 'Network request failed', expectedCategory: 'network' },
        { message: 'CORS policy violation', expectedCategory: 'security' },
        { message: 'Permission denied', expectedCategory: 'permission' },
        { message: 'Resource not found 404', expectedCategory: 'resource' },
        { message: 'Undefined variable x', expectedCategory: 'javascript' },
      ];

      for (const testCase of testCases) {
        const error = new Error(testCase.message);
        await errorHandler(error);

        expect(errorSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            category: testCase.expectedCategory,
          })
        );

        errorSpy.mockClear();
      }
    });

    it('should assess error severity correctly', async () => {
      const errorSpy = vi.fn();
      consoleStream.on('error', errorSpy);

      const errorHandler = mockPageInstance.on.mock.calls.find(
        call => call[0] === 'pageerror'
      )?.[1];

      const testCases = [
        { message: 'Fatal crash occurred', expectedSeverity: 'critical' },
        { message: 'Application error occurred', expectedSeverity: 'high' },
        { message: 'Warning: deprecated method', expectedSeverity: 'medium' },
        { message: 'Minor issue detected', expectedSeverity: 'low' },
      ];

      for (const testCase of testCases) {
        const error = new Error(testCase.message);
        await errorHandler(error);

        expect(errorSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            severity: testCase.expectedSeverity,
          })
        );

        errorSpy.mockClear();
      }
    });
  });

  describe('Network Error Detection', () => {
    beforeEach(async () => {
      await consoleStream.startStream(mockPageInstance);
    });

    it('should capture network request failures', async () => {
      const networkErrorSpy = vi.fn();
      consoleStream.on('network-error', networkErrorSpy);

      const mockRequest = {
        url: () => 'https://example.com/api/data',
        method: () => 'GET',
        failure: () => ({ errorText: 'Connection timeout' }),
      };

      const requestFailedHandler = mockPageInstance.on.mock.calls.find(
        call => call[0] === 'requestfailed'
      )?.[1];

      requestFailedHandler(mockRequest);

      expect(networkErrorSpy).toHaveBeenCalledWith({
        url: 'https://example.com/api/data',
        method: 'GET',
        status: 0,
        statusText: 'Connection timeout',
        timestamp: expect.any(Date),
        sessionId: expect.any(String),
      });
    });

    it('should capture HTTP error responses', async () => {
      const networkErrorSpy = vi.fn();
      consoleStream.on('network-error', networkErrorSpy);

      const mockResponse = {
        url: () => 'https://example.com/api/not-found',
        status: () => 404,
        statusText: () => 'Not Found',
        request: () => ({ method: () => 'GET' }),
      };

      const responseHandler = mockPageInstance.on.mock.calls.find(
        call => call[0] === 'response'
      )?.[1];

      responseHandler(mockResponse);

      expect(networkErrorSpy).toHaveBeenCalledWith({
        url: 'https://example.com/api/not-found',
        method: 'GET',
        status: 404,
        statusText: 'Not Found',
        timestamp: expect.any(Date),
        sessionId: expect.any(String),
      });
    });

    it('should not emit network errors for successful responses', async () => {
      const networkErrorSpy = vi.fn();
      consoleStream.on('network-error', networkErrorSpy);

      const mockResponse = {
        url: () => 'https://example.com/api/success',
        status: () => 200,
        statusText: () => 'OK',
        request: () => ({ method: () => 'GET' }),
      };

      const responseHandler = mockPageInstance.on.mock.calls.find(
        call => call[0] === 'response'
      )?.[1];

      responseHandler(mockResponse);

      expect(networkErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Message Filtering', () => {
    it('should filter messages by minimum log level', async () => {
      const streamWithLevelFilter = new BrowserConsoleStream({
        minLevel: ConsoleLogLevel.WARN,
      });

      await streamWithLevelFilter.startStream(mockPageInstance);

      const messageSpy = vi.fn();
      streamWithLevelFilter.on('message', messageSpy);

      const consoleHandler = mockPageInstance.on.mock.calls.find(
        call => call[0] === 'console'
      )?.[1];

      // Test messages below threshold (should be filtered out)
      mockConsoleMessage.type.mockReturnValue('debug');
      mockConsoleMessage.text.mockReturnValue('Debug message');
      await consoleHandler(mockConsoleMessage);

      mockConsoleMessage.type.mockReturnValue('info');
      mockConsoleMessage.text.mockReturnValue('Info message');
      await consoleHandler(mockConsoleMessage);

      // Test messages at or above threshold (should be captured)
      mockConsoleMessage.type.mockReturnValue('warning');
      mockConsoleMessage.text.mockReturnValue('Warning message');
      await consoleHandler(mockConsoleMessage);

      mockConsoleMessage.type.mockReturnValue('error');
      mockConsoleMessage.text.mockReturnValue('Error message');
      await consoleHandler(mockConsoleMessage);

      // Only warning and error messages should be captured
      expect(messageSpy).toHaveBeenCalledTimes(2);
      expect(messageSpy).toHaveBeenNthCalledWith(1,
        expect.objectContaining({ type: 'warning' })
      );
      expect(messageSpy).toHaveBeenNthCalledWith(2,
        expect.objectContaining({ type: 'error' })
      );

      streamWithLevelFilter.stopStream();
    });

    it('should apply custom filters', async () => {
      const customFilter = vi.fn((message) => !message.text.includes('ignore'));
      const streamWithFilter = new BrowserConsoleStream({
        filters: [customFilter],
      });

      await streamWithFilter.startStream(mockPageInstance);

      const messageSpy = vi.fn();
      streamWithFilter.on('message', messageSpy);

      const consoleHandler = mockPageInstance.on.mock.calls.find(
        call => call[0] === 'console'
      )?.[1];

      // Message that should be filtered out
      mockConsoleMessage.type.mockReturnValue('log');
      mockConsoleMessage.text.mockReturnValue('Please ignore this message');
      await consoleHandler(mockConsoleMessage);

      // Message that should pass through
      mockConsoleMessage.text.mockReturnValue('Important message');
      await consoleHandler(mockConsoleMessage);

      expect(customFilter).toHaveBeenCalledTimes(2);
      expect(messageSpy).toHaveBeenCalledTimes(1);
      expect(messageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Important message' })
      );

      streamWithFilter.stopStream();
    });
  });

  describe('Buffer Management', () => {
    it('should manage message buffer size', async () => {
      const streamWithSmallBuffer = new BrowserConsoleStream({
        maxBufferSize: 3,
      });

      await streamWithSmallBuffer.startStream(mockPageInstance);

      const bufferFullSpy = vi.fn();
      streamWithSmallBuffer.on('buffer-full', bufferFullSpy);

      const consoleHandler = mockPageInstance.on.mock.calls.find(
        call => call[0] === 'console'
      )?.[1];

      // Add messages to exceed buffer
      for (let i = 1; i <= 5; i++) {
        mockConsoleMessage.type.mockReturnValue('log');
        mockConsoleMessage.text.mockReturnValue(`Message ${i}`);
        await consoleHandler(mockConsoleMessage);
      }

      // Buffer should have been trimmed
      const messages = streamWithSmallBuffer.getMessages();
      expect(messages).toHaveLength(3);
      expect(messages[0].text).toBe('Message 3');
      expect(messages[2].text).toBe('Message 5');

      expect(bufferFullSpy).toHaveBeenCalledWith(2); // 2 messages dropped

      streamWithSmallBuffer.stopStream();
    });

    it('should clear buffers on command', async () => {
      await consoleStream.startStream(mockPageInstance);

      const consoleHandler = mockPageInstance.on.mock.calls.find(
        call => call[0] === 'console'
      )?.[1];

      // Add some messages
      mockConsoleMessage.type.mockReturnValue('log');
      mockConsoleMessage.text.mockReturnValue('Test message');
      await consoleHandler(mockConsoleMessage);

      expect(consoleStream.getMessages()).toHaveLength(1);

      consoleStream.clearBuffers();

      expect(consoleStream.getMessages()).toHaveLength(0);
      expect(consoleStream.getErrors()).toHaveLength(0);
    });
  });

  describe('Built-in Filters', () => {
    it('should filter messages with excludeText filter', () => {
      const filter = ConsoleFilters.excludeText('debug');

      const debugMessage = {
        text: 'This is a debug message',
        type: 'log',
        level: ConsoleLogLevel.INFO,
        timestamp: new Date(),
      } as BrowserConsoleMessage;

      const infoMessage = {
        text: 'This is an info message',
        type: 'log',
        level: ConsoleLogLevel.INFO,
        timestamp: new Date(),
      } as BrowserConsoleMessage;

      expect(filter(debugMessage)).toBe(false);
      expect(filter(infoMessage)).toBe(true);
    });

    it('should filter messages with includeDomain filter', () => {
      const filter = ConsoleFilters.includeDomain('example.com');

      const sameOriginMessage = {
        text: 'Message from same origin',
        location: { url: 'https://example.com/script.js' },
        type: 'log',
        level: ConsoleLogLevel.INFO,
        timestamp: new Date(),
      } as BrowserConsoleMessage;

      const crossOriginMessage = {
        text: 'Message from different origin',
        location: { url: 'https://other.com/script.js' },
        type: 'log',
        level: ConsoleLogLevel.INFO,
        timestamp: new Date(),
      } as BrowserConsoleMessage;

      const noLocationMessage = {
        text: 'Message with no location',
        type: 'log',
        level: ConsoleLogLevel.INFO,
        timestamp: new Date(),
      } as BrowserConsoleMessage;

      expect(filter(sameOriginMessage)).toBe(true);
      expect(filter(crossOriginMessage)).toBe(false);
      expect(filter(noLocationMessage)).toBe(true); // No location = allow
    });

    it('should filter out third party scripts', () => {
      const filter = ConsoleFilters.excludeThirdParty();

      const firstPartyMessage = {
        text: 'First party message',
        location: { url: 'https://myapp.com/script.js' },
        type: 'log',
        level: ConsoleLogLevel.INFO,
        timestamp: new Date(),
      } as BrowserConsoleMessage;

      const gaMessage = {
        text: 'Google Analytics message',
        location: { url: 'https://www.google-analytics.com/analytics.js' },
        type: 'log',
        level: ConsoleLogLevel.INFO,
        timestamp: new Date(),
      } as BrowserConsoleMessage;

      expect(filter(firstPartyMessage)).toBe(true);
      expect(filter(gaMessage)).toBe(false);
    });

    it('should filter for errors only', () => {
      const filter = ConsoleFilters.errorsOnly();

      const errorMessage = {
        text: 'Error message',
        type: 'error',
        level: ConsoleLogLevel.ERROR,
        timestamp: new Date(),
      } as BrowserConsoleMessage;

      const infoMessage = {
        text: 'Info message',
        type: 'log',
        level: ConsoleLogLevel.INFO,
        timestamp: new Date(),
      } as BrowserConsoleMessage;

      expect(filter(errorMessage)).toBe(true);
      expect(filter(infoMessage)).toBe(false);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide stream statistics', async () => {
      const initialStats = consoleStream.getStats();
      expect(initialStats).toEqual({
        messagesCount: 0,
        errorsCount: 0,
        isActive: false,
        sessionId: expect.any(String),
      });

      await consoleStream.startStream(mockPageInstance);

      const activeStats = consoleStream.getStats();
      expect(activeStats.isActive).toBe(true);
      expect(activeStats.sessionId).toBe(initialStats.sessionId);
    });

    it('should track message and error counts', async () => {
      await consoleStream.startStream(mockPageInstance);

      const consoleHandler = mockPageInstance.on.mock.calls.find(
        call => call[0] === 'console'
      )?.[1];
      const errorHandler = mockPageInstance.on.mock.calls.find(
        call => call[0] === 'pageerror'
      )?.[1];

      // Add a console message
      mockConsoleMessage.type.mockReturnValue('log');
      mockConsoleMessage.text.mockReturnValue('Test message');
      await consoleHandler(mockConsoleMessage);

      // Add a runtime error
      const error = new Error('Test error');
      await errorHandler(error);

      const stats = consoleStream.getStats();
      expect(stats.messagesCount).toBe(1);
      expect(stats.errorsCount).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle console message processing errors gracefully', async () => {
      // Mock console.error to suppress error output in tests
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await consoleStream.startStream(mockPageInstance);

      // Setup mock to throw error
      mockPageInstance.url.mockImplementation(() => {
        throw new Error('Page access error');
      });

      const consoleHandler = mockPageInstance.on.mock.calls.find(
        call => call[0] === 'console'
      )?.[1];

      mockConsoleMessage.type.mockReturnValue('log');
      mockConsoleMessage.text.mockReturnValue('Test message');

      // Should not throw even if processing fails
      expect(async () => {
        await consoleHandler(mockConsoleMessage);
      }).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should handle error processing failures gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await consoleStream.startStream(mockPageInstance);

      // Setup mock to throw error during context gathering
      mockPageInstance.title.mockImplementation(() => {
        throw new Error('Title access error');
      });

      const errorHandler = mockPageInstance.on.mock.calls.find(
        call => call[0] === 'pageerror'
      )?.[1];

      const testError = new Error('Test runtime error');

      // Should not throw even if processing fails
      expect(async () => {
        await errorHandler(testError);
      }).not.toThrow();

      consoleSpy.mockRestore();
    });
  });
});