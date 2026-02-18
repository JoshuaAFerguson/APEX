/**
 * @apexcli/browser - Type Validation Tests
 *
 * Unit tests for ConsoleMessage and BrowserError type validation
 */

import { describe, it, expect } from 'vitest';
import type {
  CapturedConsoleMessage,
  CapturedJavaScriptError,
  PageErrorEvent,
  ConsoleLogLevel,
  CaptureConfig,
} from '../types.js';

// Helper functions for type validation without external dependencies
function isValidConsoleLogLevel(value: unknown): value is ConsoleLogLevel {
  const validLevels = [
    'log',
    'debug',
    'info',
    'warn',
    'error',
    'assert',
    'dir',
    'dirxml',
    'table',
    'trace',
    'clear',
    'startGroup',
    'startGroupCollapsed',
    'endGroup',
    'profile',
    'profileEnd',
    'timeEnd',
    'count',
    'timeStamp',
  ] as const;
  return typeof value === 'string' && validLevels.includes(value as ConsoleLogLevel);
}

function isValidCapturedConsoleMessage(value: unknown): value is CapturedConsoleMessage {
  if (!value || typeof value !== 'object') return false;

  const obj = value as any;

  // Check required fields
  if (!isValidConsoleLogLevel(obj.type)) return false;
  if (typeof obj.text !== 'string') return false;
  if (!Array.isArray(obj.args)) return false;
  if (typeof obj.timestamp !== 'number' || obj.timestamp <= 0) return false;

  // Check optional location field
  if (obj.location !== undefined) {
    if (typeof obj.location !== 'object' || obj.location === null) return false;
    if (typeof obj.location.url !== 'string') return false;
    if (obj.location.lineNumber !== undefined && typeof obj.location.lineNumber !== 'number') return false;
    if (obj.location.columnNumber !== undefined && typeof obj.location.columnNumber !== 'number') return false;
  }

  return true;
}

function isValidCapturedJavaScriptError(value: unknown): value is CapturedJavaScriptError {
  if (!value || typeof value !== 'object') return false;

  const obj = value as any;

  // Check required fields
  if (typeof obj.message !== 'string') return false;
  if (typeof obj.name !== 'string') return false;
  if (typeof obj.timestamp !== 'number' || obj.timestamp <= 0) return false;
  if (typeof obj.uncaught !== 'boolean') return false;

  // Check optional fields
  if (obj.stack !== undefined && typeof obj.stack !== 'string') return false;

  if (obj.source !== undefined) {
    if (typeof obj.source !== 'object' || obj.source === null) return false;
    if (typeof obj.source.url !== 'string') return false;
    if (obj.source.line !== undefined && typeof obj.source.line !== 'number') return false;
    if (obj.source.column !== undefined && typeof obj.source.column !== 'number') return false;
  }

  return true;
}

function isValidPageErrorEvent(value: unknown): value is PageErrorEvent {
  if (!value || typeof value !== 'object') return false;

  const obj = value as any;

  // Check required fields
  if (!(obj.error instanceof Error)) return false;
  if (typeof obj.message !== 'string') return false;
  if (typeof obj.timestamp !== 'number' || obj.timestamp <= 0) return false;

  // Check optional fields
  if (obj.filename !== undefined && typeof obj.filename !== 'string') return false;
  if (obj.lineno !== undefined && typeof obj.lineno !== 'number') return false;
  if (obj.colno !== undefined && typeof obj.colno !== 'number') return false;
  if (obj.stack !== undefined && typeof obj.stack !== 'string') return false;

  return true;
}

function isValidCaptureConfig(value: unknown): value is CaptureConfig {
  if (!value || typeof value !== 'object') return false;

  const obj = value as any;

  // Check required fields
  if (typeof obj.captureConsole !== 'boolean') return false;
  if (typeof obj.captureErrors !== 'boolean') return false;

  // Check optional fields
  if (obj.consoleLevels !== undefined) {
    if (!Array.isArray(obj.consoleLevels)) return false;
    if (!obj.consoleLevels.every(isValidConsoleLogLevel)) return false;
  }

  if (obj.maxBufferSize !== undefined) {
    if (typeof obj.maxBufferSize !== 'number' || obj.maxBufferSize <= 0) return false;
  }

  if (obj.includeStackTraces !== undefined) {
    if (typeof obj.includeStackTraces !== 'boolean') return false;
  }

  return true;
}

describe('Type Validation Tests', () => {
  describe('ConsoleLogLevel Validation', () => {
    it('should validate all supported console log levels', () => {
      const validLevels: ConsoleLogLevel[] = [
        'log',
        'debug',
        'info',
        'warn',
        'error',
        'assert',
        'dir',
        'dirxml',
        'table',
        'trace',
        'clear',
        'startGroup',
        'startGroupCollapsed',
        'endGroup',
        'profile',
        'profileEnd',
        'timeEnd',
        'count',
        'timeStamp',
      ];

      validLevels.forEach((level) => {
        expect(isValidConsoleLogLevel(level)).toBe(true);
      });
    });

    it('should reject invalid console log levels', () => {
      const invalidLevels = [
        'invalid',
        'LOG',
        'Debug',
        'ERROR',
        '',
        null,
        undefined,
        123,
        {},
        [],
      ];

      invalidLevels.forEach((level) => {
        expect(isValidConsoleLogLevel(level)).toBe(false);
      });
    });
  });

  describe('CapturedConsoleMessage Validation', () => {
    it('should validate a complete console message', () => {
      const validMessage: CapturedConsoleMessage = {
        type: 'log',
        text: 'Test log message',
        args: ['Test', 'log', 'message', 42, true],
        location: {
          url: 'data:text/html,script',
          lineNumber: 5,
          columnNumber: 12,
        },
        timestamp: Date.now(),
      };

      expect(isValidCapturedConsoleMessage(validMessage)).toBe(true);
    });

    it('should validate a minimal console message', () => {
      const minimalMessage: CapturedConsoleMessage = {
        type: 'warn',
        text: 'Warning message',
        args: [],
        timestamp: 1642694400000,
      };

      expect(isValidCapturedConsoleMessage(minimalMessage)).toBe(true);
    });

    it('should validate console messages with various argument types', () => {
      const messageWithMixedArgs: CapturedConsoleMessage = {
        type: 'error',
        text: 'Error with mixed arguments',
        args: [
          'string',
          42,
          true,
          null,
          undefined,
          { object: 'value' },
          [1, 2, 3],
          new Date(),
        ],
        timestamp: Date.now(),
      };

      expect(isValidCapturedConsoleMessage(messageWithMixedArgs)).toBe(true);
    });

    it('should reject console messages with invalid type', () => {
      const invalidMessage = {
        type: 'invalid-type',
        text: 'Test message',
        args: [],
        timestamp: Date.now(),
      };

      expect(isValidCapturedConsoleMessage(invalidMessage)).toBe(false);
    });

    it('should reject console messages with missing required fields', () => {
      const incompleteMessages = [
        {
          // Missing type
          text: 'Test message',
          args: [],
          timestamp: Date.now(),
        },
        {
          type: 'log',
          // Missing text
          args: [],
          timestamp: Date.now(),
        },
        {
          type: 'log',
          text: 'Test message',
          // Missing args
          timestamp: Date.now(),
        },
        {
          type: 'log',
          text: 'Test message',
          args: [],
          // Missing timestamp
        },
      ];

      incompleteMessages.forEach((message) => {
        expect(isValidCapturedConsoleMessage(message)).toBe(false);
      });
    });

    it('should reject console messages with invalid timestamp', () => {
      const messagesWithInvalidTimestamp = [
        {
          type: 'log',
          text: 'Test message',
          args: [],
          timestamp: -1, // Negative timestamp
        },
        {
          type: 'log',
          text: 'Test message',
          args: [],
          timestamp: 0, // Zero timestamp
        },
        {
          type: 'log',
          text: 'Test message',
          args: [],
          timestamp: 'invalid', // Non-number timestamp
        },
      ];

      messagesWithInvalidTimestamp.forEach((message) => {
        expect(isValidCapturedConsoleMessage(message)).toBe(false);
      });
    });

    it('should validate location object structure', () => {
      const messageWithValidLocation: CapturedConsoleMessage = {
        type: 'info',
        text: 'Message with location',
        args: ['arg1'],
        location: {
          url: 'https://example.com/script.js',
          lineNumber: 42,
          columnNumber: 15,
        },
        timestamp: Date.now(),
      };

      expect(isValidCapturedConsoleMessage(messageWithValidLocation)).toBe(true);
    });

    it('should validate location object with minimal fields', () => {
      const messageWithMinimalLocation: CapturedConsoleMessage = {
        type: 'debug',
        text: 'Debug message',
        args: [],
        location: {
          url: 'file:///path/to/script.js',
        },
        timestamp: Date.now(),
      };

      expect(isValidCapturedConsoleMessage(messageWithMinimalLocation)).toBe(true);
    });

    it('should reject invalid location objects', () => {
      const messagesWithInvalidLocation = [
        {
          type: 'log',
          text: 'Test message',
          args: [],
          location: {
            // Missing url
            lineNumber: 10,
          },
          timestamp: Date.now(),
        },
        {
          type: 'log',
          text: 'Test message',
          args: [],
          location: {
            url: '', // Empty URL
            lineNumber: 10,
          },
          timestamp: Date.now(),
        },
        {
          type: 'log',
          text: 'Test message',
          args: [],
          location: {
            url: 'valid-url',
            lineNumber: 'invalid', // Non-number line number
          },
          timestamp: Date.now(),
        },
      ];

      messagesWithInvalidLocation.forEach((message) => {
        expect(isValidCapturedConsoleMessage(message)).toBe(false);
      });
    });
  });

  describe('CapturedJavaScriptError Validation', () => {
    it('should validate a complete JavaScript error', () => {
      const validError: CapturedJavaScriptError = {
        message: 'Test error message',
        stack: 'Error: Test error message\n    at testFunction (script.js:10:5)',
        name: 'Error',
        source: {
          url: 'https://example.com/script.js',
          line: 10,
          column: 5,
        },
        timestamp: Date.now(),
        uncaught: true,
      };

      expect(isValidCapturedJavaScriptError(validError)).toBe(true);
    });

    it('should validate a minimal JavaScript error', () => {
      const minimalError: CapturedJavaScriptError = {
        message: 'Simple error',
        name: 'Error',
        timestamp: Date.now(),
        uncaught: false,
      };

      expect(isValidCapturedJavaScriptError(minimalError)).toBe(true);
    });

    it('should validate different error types', () => {
      const errorTypes = [
        'Error',
        'TypeError',
        'ReferenceError',
        'SyntaxError',
        'RangeError',
        'URIError',
        'EvalError',
        'UnhandledPromiseRejection',
      ];

      errorTypes.forEach((errorType) => {
        const error: CapturedJavaScriptError = {
          message: `Test ${errorType} message`,
          name: errorType,
          timestamp: Date.now(),
          uncaught: true,
        };

        expect(isValidCapturedJavaScriptError(error)).toBe(true);
      });
    });

    it('should reject JavaScript errors with missing required fields', () => {
      const incompleteErrors = [
        {
          // Missing message
          name: 'Error',
          timestamp: Date.now(),
          uncaught: true,
        },
        {
          message: 'Test error',
          // Missing name
          timestamp: Date.now(),
          uncaught: true,
        },
        {
          message: 'Test error',
          name: 'Error',
          // Missing timestamp
          uncaught: true,
        },
        {
          message: 'Test error',
          name: 'Error',
          timestamp: Date.now(),
          // Missing uncaught
        },
      ];

      incompleteErrors.forEach((error) => {
        expect(isValidCapturedJavaScriptError(error)).toBe(false);
      });
    });

    it('should validate source object structure', () => {
      const errorWithSource: CapturedJavaScriptError = {
        message: 'Error with source info',
        name: 'TypeError',
        source: {
          url: 'https://cdn.example.com/library.min.js',
          line: 1,
          column: 2547,
        },
        timestamp: Date.now(),
        uncaught: true,
      };

      expect(isValidCapturedJavaScriptError(errorWithSource)).toBe(true);
    });

    it('should validate source object with minimal fields', () => {
      const errorWithMinimalSource: CapturedJavaScriptError = {
        message: 'Error with minimal source',
        name: 'ReferenceError',
        source: {
          url: 'data:text/html,inline-script',
        },
        timestamp: Date.now(),
        uncaught: false,
      };

      expect(isValidCapturedJavaScriptError(errorWithMinimalSource)).toBe(true);
    });

    it('should reject invalid source objects', () => {
      const errorsWithInvalidSource = [
        {
          message: 'Test error',
          name: 'Error',
          source: {
            // Missing url
            line: 10,
          },
          timestamp: Date.now(),
          uncaught: true,
        },
        {
          message: 'Test error',
          name: 'Error',
          source: {
            url: '', // Empty URL
          },
          timestamp: Date.now(),
          uncaught: true,
        },
        {
          message: 'Test error',
          name: 'Error',
          source: {
            url: 'valid-url',
            line: 'invalid', // Non-number line
          },
          timestamp: Date.now(),
          uncaught: true,
        },
      ];

      errorsWithInvalidSource.forEach((error) => {
        expect(isValidCapturedJavaScriptError(error)).toBe(false);
      });
    });
  });

  describe('PageErrorEvent Validation', () => {
    it('should validate a complete page error event', () => {
      const error = new Error('Test page error');
      const validPageError: PageErrorEvent = {
        error,
        message: 'Test page error',
        filename: 'https://example.com/app.js',
        lineno: 25,
        colno: 10,
        stack: error.stack || '',
        timestamp: Date.now(),
      };

      expect(isValidPageErrorEvent(validPageError)).toBe(true);
    });

    it('should validate a minimal page error event', () => {
      const error = new Error('Minimal page error');
      const minimalPageError: PageErrorEvent = {
        error,
        message: 'Minimal page error',
        timestamp: Date.now(),
      };

      expect(isValidPageErrorEvent(minimalPageError)).toBe(true);
    });

    it('should reject page error events with missing required fields', () => {
      const error = new Error('Test error');
      const incompletePageErrors = [
        {
          // Missing error
          message: 'Test error',
          timestamp: Date.now(),
        },
        {
          error,
          // Missing message
          timestamp: Date.now(),
        },
        {
          error,
          message: 'Test error',
          // Missing timestamp
        },
      ];

      incompletePageErrors.forEach((pageError) => {
        expect(isValidPageErrorEvent(pageError)).toBe(false);
      });
    });

    it('should validate page error with all optional fields', () => {
      const error = new Error('Complete page error');
      error.stack = 'Error: Complete page error\n    at function (file.js:10:5)';

      const completePageError: PageErrorEvent = {
        error,
        message: 'Complete page error',
        filename: '/path/to/file.js',
        lineno: 10,
        colno: 5,
        stack: error.stack,
        timestamp: Date.now(),
      };

      expect(isValidPageErrorEvent(completePageError)).toBe(true);
    });
  });

  describe('CaptureConfig Validation', () => {
    it('should validate a complete capture configuration', () => {
      const validConfig: CaptureConfig = {
        captureConsole: true,
        consoleLevels: ['log', 'warn', 'error'],
        captureErrors: true,
        maxBufferSize: 100,
        includeStackTraces: true,
      };

      expect(isValidCaptureConfig(validConfig)).toBe(true);
    });

    it('should validate a minimal capture configuration', () => {
      const minimalConfig: CaptureConfig = {
        captureConsole: false,
        captureErrors: true,
      };

      expect(isValidCaptureConfig(minimalConfig)).toBe(true);
    });

    it('should validate configuration with all console levels', () => {
      const allLevelsConfig: CaptureConfig = {
        captureConsole: true,
        consoleLevels: [
          'log',
          'debug',
          'info',
          'warn',
          'error',
          'assert',
          'dir',
          'dirxml',
          'table',
          'trace',
          'clear',
          'startGroup',
          'startGroupCollapsed',
          'endGroup',
          'profile',
          'profileEnd',
          'timeEnd',
          'count',
          'timeStamp',
        ],
        captureErrors: true,
        maxBufferSize: 1000,
        includeStackTraces: false,
      };

      expect(isValidCaptureConfig(allLevelsConfig)).toBe(true);
    });

    it('should reject invalid capture configurations', () => {
      const invalidConfigs = [
        {
          // Missing captureConsole
          captureErrors: true,
        },
        {
          captureConsole: 'invalid', // Non-boolean
          captureErrors: true,
        },
        {
          captureConsole: true,
          // Missing captureErrors
        },
        {
          captureConsole: true,
          captureErrors: 'invalid', // Non-boolean
        },
        {
          captureConsole: true,
          captureErrors: true,
          maxBufferSize: 0, // Zero buffer size
        },
        {
          captureConsole: true,
          captureErrors: true,
          maxBufferSize: -10, // Negative buffer size
        },
        {
          captureConsole: true,
          captureErrors: true,
          consoleLevels: ['invalid-level'], // Invalid console level
        },
        {
          captureConsole: true,
          captureErrors: true,
          includeStackTraces: 'invalid', // Non-boolean
        },
      ];

      invalidConfigs.forEach((config) => {
        expect(isValidCaptureConfig(config)).toBe(false);
      });
    });

    it('should validate empty console levels array', () => {
      const configWithEmptyLevels: CaptureConfig = {
        captureConsole: true,
        consoleLevels: [], // Empty array should be valid
        captureErrors: true,
      };

      expect(isValidCaptureConfig(configWithEmptyLevels)).toBe(true);
    });
  });

  describe('Edge Cases and Complex Validation', () => {
    it('should handle very large timestamp values', () => {
      const messageWithLargeTimestamp: CapturedConsoleMessage = {
        type: 'log',
        text: 'Message with large timestamp',
        args: [],
        timestamp: Number.MAX_SAFE_INTEGER,
      };

      expect(isValidCapturedConsoleMessage(messageWithLargeTimestamp)).toBe(true);
    });

    it('should handle unicode and special characters in messages', () => {
      const unicodeMessage: CapturedConsoleMessage = {
        type: 'log',
        text: '🚀 Unicode message with emoji and special chars: åäö',
        args: ['🎯', '特殊文字', '🌟'],
        timestamp: Date.now(),
      };

      expect(isValidCapturedConsoleMessage(unicodeMessage)).toBe(true);
    });

    it('should handle extremely long error messages', () => {
      const longMessage = 'A'.repeat(10000);
      const longStackTrace = 'Error\n' + 'at function\n'.repeat(1000);

      const longError: CapturedJavaScriptError = {
        message: longMessage,
        stack: longStackTrace,
        name: 'Error',
        timestamp: Date.now(),
        uncaught: true,
      };

      expect(isValidCapturedJavaScriptError(longError)).toBe(true);
    });

    it('should validate URLs with various protocols', () => {
      const urlProtocols = [
        'https://example.com/script.js',
        'http://localhost:3000/app.js',
        'file:///path/to/local/file.js',
        'data:text/javascript,console.log("hello")',
        'blob:https://example.com/12345-67890',
        'about:blank',
        'chrome-extension://abc123/content.js',
        'moz-extension://def456/background.js',
      ];

      urlProtocols.forEach((url) => {
        const message: CapturedConsoleMessage = {
          type: 'log',
          text: 'Test message',
          args: [],
          location: { url },
          timestamp: Date.now(),
        };

        expect(isValidCapturedConsoleMessage(message)).toBe(true);
      });
    });
  });

  describe('Type Safety and TypeScript Integration', () => {
    it('should enforce type safety at compile time', () => {
      // These should compile without errors
      const validMessage: CapturedConsoleMessage = {
        type: 'log',
        text: 'Type-safe message',
        args: [],
        timestamp: Date.now(),
      };

      const validError: CapturedJavaScriptError = {
        message: 'Type-safe error',
        name: 'Error',
        timestamp: Date.now(),
        uncaught: true,
      };

      expect(validMessage.type).toBe('log');
      expect(validError.uncaught).toBe(true);
    });

    it('should validate arrays of console messages', () => {
      const messageArray: CapturedConsoleMessage[] = [
        {
          type: 'log',
          text: 'First message',
          args: [],
          timestamp: Date.now(),
        },
        {
          type: 'warn',
          text: 'Second message',
          args: ['arg1', 42],
          timestamp: Date.now() + 1,
        },
        {
          type: 'error',
          text: 'Third message',
          args: [],
          location: {
            url: 'test.js',
            lineNumber: 1,
            columnNumber: 1,
          },
          timestamp: Date.now() + 2,
        },
      ];

      messageArray.forEach(message => {
        expect(isValidCapturedConsoleMessage(message)).toBe(true);
      });
    });

    it('should validate arrays of JavaScript errors', () => {
      const errorArray: CapturedJavaScriptError[] = [
        {
          message: 'First error',
          name: 'TypeError',
          timestamp: Date.now(),
          uncaught: true,
        },
        {
          message: 'Second error',
          name: 'ReferenceError',
          stack: 'ReferenceError: Second error\n    at line 1',
          timestamp: Date.now() + 1,
          uncaught: false,
        },
      ];

      errorArray.forEach(error => {
        expect(isValidCapturedJavaScriptError(error)).toBe(true);
      });
    });
  });
});