import {
  ConsoleMessageSchema,
  BrowserErrorSchema,
  StackFrameSchema,
  type ConsoleSeverity,
  type ConsoleMessage,
  type BrowserError,
  type StackFrame,
} from '../types.js';

/**
 * Test suite validating browser automation type compatibility with Playwright
 * Ensures our schemas can handle real Playwright browser automation data
 */
describe('Playwright Integration Validation', () => {
  describe('ConsoleMessage compatibility with Playwright console events', () => {
    it('should handle Playwright console message structure', () => {
      // Simulates the structure that Playwright would provide from page.on('console')
      const playwrightStyleConsoleMessage = {
        severity: 'error' as ConsoleSeverity,
        message: 'Uncaught TypeError: Cannot read property "length" of undefined',
        timestamp: new Date('2023-12-01T10:30:00Z'),
        sourceUrl: 'https://example.com/app.js',
        lineNumber: 42,
        columnNumber: 15,
      };

      const result = ConsoleMessageSchema.parse(playwrightStyleConsoleMessage);
      expect(result.severity).toBe('error');
      expect(result.message).toContain('TypeError');
      expect(result.sourceUrl).toBe('https://example.com/app.js');
      expect(result.lineNumber).toBe(42);
      expect(result.columnNumber).toBe(15);
    });

    it('should handle all Playwright console severity levels', () => {
      const playwrightSeverityLevels: ConsoleSeverity[] = [
        'log',    // console.log()
        'info',   // console.info()
        'warn',   // console.warn()
        'error',  // console.error()
        'debug',  // console.debug()
        'trace',  // console.trace()
      ];

      playwrightSeverityLevels.forEach(severity => {
        const message = {
          severity,
          message: `Test ${severity} message`,
          timestamp: new Date(),
        };

        expect(() => ConsoleMessageSchema.parse(message)).not.toThrow();
        const result = ConsoleMessageSchema.parse(message);
        expect(result.severity).toBe(severity);
      });
    });
  });

  describe('BrowserError compatibility with Playwright error events', () => {
    it('should handle Playwright page error structure', () => {
      // Simulates the structure that Playwright would provide from page.on('pageerror')
      const playwrightStyleError = {
        name: 'TypeError',
        message: 'Cannot read property "addEventListener" of null',
        timestamp: new Date('2023-12-01T15:45:00Z'),
        sourceUrl: 'https://example.com/main.js',
        lineNumber: 156,
        columnNumber: 23,
      };

      const result = BrowserErrorSchema.parse(playwrightStyleError);
      expect(result.name).toBe('TypeError');
      expect(result.message).toContain('addEventListener');
      expect(result.sourceUrl).toBe('https://example.com/main.js');
      expect(result.lineNumber).toBe(156);
      expect(result.columnNumber).toBe(23);
    });

    it('should handle Playwright network error structure', () => {
      const networkError = {
        name: 'NetworkError',
        message: 'Failed to fetch resource: net::ERR_CONNECTION_REFUSED',
        timestamp: new Date(),
        sourceUrl: 'https://api.example.com/data',
      };

      const result = BrowserErrorSchema.parse(networkError);
      expect(result.name).toBe('NetworkError');
      expect(result.message).toContain('ERR_CONNECTION_REFUSED');
      expect(result.sourceUrl).toBe('https://api.example.com/data');
    });
  });

  describe('StackFrame compatibility with Playwright stack traces', () => {
    it('should handle Playwright JavaScript stack frame', () => {
      const playwrightStackFrame = {
        functionName: 'onClick',
        fileName: 'https://example.com/static/js/app.js',
        lineNumber: 89,
        columnNumber: 12,
      };

      const result = StackFrameSchema.parse(playwrightStackFrame);
      expect(result.functionName).toBe('onClick');
      expect(result.fileName).toBe('https://example.com/static/js/app.js');
      expect(result.lineNumber).toBe(89);
      expect(result.columnNumber).toBe(12);
    });

    it('should handle Playwright anonymous function stack frame', () => {
      const anonymousFrame = {
        fileName: '<anonymous>',
        lineNumber: 1,
        columnNumber: 1,
      };

      const result = StackFrameSchema.parse(anonymousFrame);
      expect(result.functionName).toBeUndefined();
      expect(result.fileName).toBe('<anonymous>');
    });

    it('should handle webpack-style module paths', () => {
      const webpackFrame = {
        functionName: 'Module.eval',
        fileName: 'webpack://my-app/./src/components/Button.js',
        lineNumber: 25,
        columnNumber: 8,
      };

      const result = StackFrameSchema.parse(webpackFrame);
      expect(result.functionName).toBe('Module.eval');
      expect(result.fileName).toBe('webpack://my-app/./src/components/Button.js');
    });
  });

  describe('Real-world Playwright scenarios', () => {
    it('should handle complex error with full stack trace from Playwright', () => {
      const timestamp = new Date();
      const complexPlaywrightError = {
        name: 'ReferenceError',
        message: 'myFunction is not defined',
        timestamp,
        sourceUrl: 'https://example.com/app.js',
        lineNumber: 234,
        columnNumber: 18,
        stackTrace: [
          {
            functionName: 'handleClick',
            fileName: 'https://example.com/app.js',
            lineNumber: 234,
            columnNumber: 18,
          },
          {
            functionName: 'addEventListener.<anonymous>',
            fileName: 'https://example.com/app.js',
            lineNumber: 45,
            columnNumber: 25,
          },
          {
            // Anonymous frame from event system
            fileName: '<anonymous>',
            lineNumber: 1,
            columnNumber: 1,
          },
        ] as StackFrame[],
      };

      const result = BrowserErrorSchema.parse(complexPlaywrightError);
      expect(result.stackTrace).toHaveLength(3);
      expect(result.stackTrace![0].functionName).toBe('handleClick');
      expect(result.stackTrace![1].functionName).toBe('addEventListener.<anonymous>');
      expect(result.stackTrace![2].functionName).toBeUndefined();
    });

    it('should handle console message with stack trace from Playwright', () => {
      const timestamp = new Date();
      const consoleWithTrace = {
        severity: 'trace' as ConsoleSeverity,
        message: 'Debug trace output',
        timestamp,
        sourceUrl: 'https://example.com/debug.js',
        lineNumber: 15,
        columnNumber: 8,
        stackTrace: [
          {
            functionName: 'debugLog',
            fileName: 'https://example.com/debug.js',
            lineNumber: 15,
            columnNumber: 8,
          },
          {
            functionName: 'processData',
            fileName: 'https://example.com/data.js',
            lineNumber: 67,
            columnNumber: 20,
          },
        ] as StackFrame[],
      };

      const result = ConsoleMessageSchema.parse(consoleWithTrace);
      expect(result.severity).toBe('trace');
      expect(result.stackTrace).toHaveLength(2);
      expect(result.stackTrace![0].functionName).toBe('debugLog');
    });

    it('should handle mobile browser scenarios from Playwright', () => {
      const mobileError = {
        name: 'TouchEvent',
        message: 'Touch event handler failed',
        timestamp: new Date(),
        sourceUrl: 'https://mobile.example.com/touch.js',
        lineNumber: 123,
        columnNumber: 45,
        stackTrace: [
          {
            functionName: 'onTouchStart',
            fileName: 'https://mobile.example.com/touch.js',
            lineNumber: 123,
            columnNumber: 45,
          },
        ] as StackFrame[],
      };

      expect(() => BrowserErrorSchema.parse(mobileError)).not.toThrow();
      const result = BrowserErrorSchema.parse(mobileError);
      expect(result.name).toBe('TouchEvent');
      expect(result.sourceUrl).toContain('mobile.example.com');
    });

    it('should handle cross-origin script errors from Playwright', () => {
      const crossOriginError = {
        name: 'SecurityError',
        message: 'Script from another origin blocked',
        timestamp: new Date(),
        sourceUrl: 'https://cdn.example.com/external.js',
      };

      const result = BrowserErrorSchema.parse(crossOriginError);
      expect(result.name).toBe('SecurityError');
      expect(result.sourceUrl).toContain('cdn.example.com');
      expect(result.lineNumber).toBeUndefined(); // Often unavailable for cross-origin
    });
  });

  describe('Browser automation workflow validation', () => {
    it('should support typical error monitoring workflow', () => {
      const errors: BrowserError[] = [];
      const messages: ConsoleMessage[] = [];

      // Simulate collecting browser errors and console messages during automation
      const timestamp = new Date();

      // Page load error
      errors.push(BrowserErrorSchema.parse({
        name: 'LoadError',
        message: 'Resource failed to load',
        timestamp,
        sourceUrl: 'https://example.com/missing.js',
      }));

      // JavaScript execution error
      errors.push(BrowserErrorSchema.parse({
        name: 'TypeError',
        message: 'Cannot read property of null',
        timestamp: new Date(timestamp.getTime() + 1000),
        sourceUrl: 'https://example.com/app.js',
        lineNumber: 45,
        columnNumber: 12,
      }));

      // Console error message
      messages.push(ConsoleMessageSchema.parse({
        severity: 'error',
        message: 'API request failed',
        timestamp: new Date(timestamp.getTime() + 2000),
        sourceUrl: 'https://example.com/api.js',
        lineNumber: 78,
        columnNumber: 5,
      }));

      // Console warning
      messages.push(ConsoleMessageSchema.parse({
        severity: 'warn',
        message: 'Deprecated function used',
        timestamp: new Date(timestamp.getTime() + 3000),
      }));

      // Validate the collected data
      expect(errors).toHaveLength(2);
      expect(messages).toHaveLength(2);
      expect(errors[0].name).toBe('LoadError');
      expect(errors[1].name).toBe('TypeError');
      expect(messages[0].severity).toBe('error');
      expect(messages[1].severity).toBe('warn');

      // Ensure all items have valid timestamps
      [...errors, ...messages].forEach(item => {
        expect(item.timestamp instanceof Date).toBe(true);
      });
    });

    it('should validate type compatibility for browser automation tools', () => {
      // This test ensures the types work well with typical browser automation patterns
      interface BrowserSession {
        errors: BrowserError[];
        consoleMessages: ConsoleMessage[];
      }

      const session: BrowserSession = {
        errors: [],
        consoleMessages: [],
      };

      // Add data using our schemas
      session.errors.push(BrowserErrorSchema.parse({
        name: 'NetworkError',
        message: 'Fetch failed',
        timestamp: new Date(),
      }));

      session.consoleMessages.push(ConsoleMessageSchema.parse({
        severity: 'info',
        message: 'Page loaded successfully',
        timestamp: new Date(),
      }));

      // TypeScript should infer correct types
      const firstError: BrowserError = session.errors[0];
      const firstMessage: ConsoleMessage = session.consoleMessages[0];

      expect(firstError.name).toBe('NetworkError');
      expect(firstMessage.severity).toBe('info');

      // Should work with array methods
      const errorCount = session.errors.length;
      const messageCount = session.consoleMessages.length;
      const hasErrors = session.errors.some(error => error.name.includes('Error'));
      const infoMessages = session.consoleMessages.filter(msg => msg.severity === 'info');

      expect(errorCount).toBe(1);
      expect(messageCount).toBe(1);
      expect(hasErrors).toBe(true);
      expect(infoMessages).toHaveLength(1);
    });
  });
});