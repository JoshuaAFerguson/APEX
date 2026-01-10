import {
  ConsoleSeveritySchema,
  type ConsoleSeverity,
  StackFrameSchema,
  type StackFrame,
  ConsoleMessageSchema,
  type ConsoleMessage,
  BrowserErrorSchema,
  type BrowserError,
} from '../types.js';

/**
 * Test suite for browser automation types
 * Tests the Zod schemas for ConsoleMessage, BrowserError, and StackFrame types
 * Validates severity levels, timestamps, source locations, and stack trace structures
 */
describe('Browser Automation Types', () => {
  describe('ConsoleSeveritySchema', () => {
    it('should accept all valid severity levels', () => {
      const validSeverities: ConsoleSeverity[] = ['log', 'info', 'warn', 'error', 'debug', 'trace'];

      validSeverities.forEach(severity => {
        expect(() => ConsoleSeveritySchema.parse(severity)).not.toThrow();
        expect(ConsoleSeveritySchema.parse(severity)).toBe(severity);
      });
    });

    it('should reject invalid severity levels', () => {
      const invalidSeverities = ['verbose', 'critical', 'fatal', '', null, undefined, 123, {}];

      invalidSeverities.forEach(severity => {
        expect(() => ConsoleSeveritySchema.parse(severity)).toThrow();
      });
    });

    it('should have proper TypeScript type inference', () => {
      const severity: ConsoleSeverity = ConsoleSeveritySchema.parse('error');
      expect(severity).toBe('error');

      // This ensures TypeScript compilation works correctly
      const isValidSeverity = (s: string): s is ConsoleSeverity => {
        return ['log', 'info', 'warn', 'error', 'debug', 'trace'].includes(s);
      };

      expect(isValidSeverity('error')).toBe(true);
      expect(isValidSeverity('invalid')).toBe(false);
    });
  });

  describe('StackFrameSchema', () => {
    it('should accept valid stack frame with all fields', () => {
      const validStackFrame = {
        functionName: 'myFunction',
        fileName: 'https://example.com/script.js',
        lineNumber: 42,
        columnNumber: 15,
      };

      const result = StackFrameSchema.parse(validStackFrame);
      expect(result).toEqual(validStackFrame);
      expect(result.functionName).toBe('myFunction');
      expect(result.fileName).toBe('https://example.com/script.js');
      expect(result.lineNumber).toBe(42);
      expect(result.columnNumber).toBe(15);
    });

    it('should accept stack frame without optional functionName', () => {
      const stackFrameWithoutFunction = {
        fileName: 'anonymous',
        lineNumber: 1,
        columnNumber: 1,
      };

      const result = StackFrameSchema.parse(stackFrameWithoutFunction);
      expect(result).toEqual(stackFrameWithoutFunction);
      expect(result.functionName).toBeUndefined();
    });

    it('should require fileName, lineNumber, and columnNumber', () => {
      const requiredFields = ['fileName', 'lineNumber', 'columnNumber'];

      requiredFields.forEach(field => {
        const invalidFrame = {
          functionName: 'test',
          fileName: 'test.js',
          lineNumber: 1,
          columnNumber: 1,
        };
        delete (invalidFrame as any)[field];

        expect(() => StackFrameSchema.parse(invalidFrame)).toThrow();
      });
    });

    it('should validate line and column numbers are positive integers', () => {
      const baseFrame = {
        fileName: 'test.js',
        lineNumber: 1,
        columnNumber: 1,
      };

      // Valid positive integers
      expect(() => StackFrameSchema.parse({ ...baseFrame, lineNumber: 1 })).not.toThrow();
      expect(() => StackFrameSchema.parse({ ...baseFrame, columnNumber: 1 })).not.toThrow();
      expect(() => StackFrameSchema.parse({ ...baseFrame, lineNumber: 100 })).not.toThrow();

      // Invalid values
      expect(() => StackFrameSchema.parse({ ...baseFrame, lineNumber: 0 })).toThrow();
      expect(() => StackFrameSchema.parse({ ...baseFrame, columnNumber: 0 })).toThrow();
      expect(() => StackFrameSchema.parse({ ...baseFrame, lineNumber: -1 })).toThrow();
      expect(() => StackFrameSchema.parse({ ...baseFrame, columnNumber: -5 })).toThrow();
      expect(() => StackFrameSchema.parse({ ...baseFrame, lineNumber: 1.5 })).toThrow();
      expect(() => StackFrameSchema.parse({ ...baseFrame, columnNumber: 2.7 })).toThrow();
      expect(() => StackFrameSchema.parse({ ...baseFrame, lineNumber: 'invalid' })).toThrow();
      expect(() => StackFrameSchema.parse({ ...baseFrame, columnNumber: null })).toThrow();
    });

    it('should handle various file name formats', () => {
      const fileNameFormats = [
        'script.js',
        'https://example.com/script.js',
        'file:///path/to/script.js',
        '/absolute/path/script.js',
        './relative/path/script.js',
        'anonymous',
        '<eval>',
        'webpack://./src/index.js',
      ];

      fileNameFormats.forEach(fileName => {
        const frame = { fileName, lineNumber: 1, columnNumber: 1 };
        expect(() => StackFrameSchema.parse(frame)).not.toThrow();
        expect(StackFrameSchema.parse(frame).fileName).toBe(fileName);
      });
    });
  });

  describe('ConsoleMessageSchema', () => {
    it('should accept valid console message with all required fields', () => {
      const timestamp = new Date('2023-12-01T10:30:00Z');
      const validMessage = {
        severity: 'error' as ConsoleSeverity,
        message: 'Something went wrong',
        timestamp,
        sourceUrl: 'https://example.com/script.js',
        lineNumber: 25,
        columnNumber: 10,
      };

      const result = ConsoleMessageSchema.parse(validMessage);
      expect(result).toEqual(validMessage);
      expect(result.severity).toBe('error');
      expect(result.message).toBe('Something went wrong');
      expect(result.timestamp).toEqual(timestamp);
      expect(result.sourceUrl).toBe('https://example.com/script.js');
      expect(result.lineNumber).toBe(25);
      expect(result.columnNumber).toBe(10);
    });

    it('should accept console message with only required fields', () => {
      const timestamp = new Date();
      const minimalMessage = {
        severity: 'log' as ConsoleSeverity,
        message: 'Hello world',
        timestamp,
      };

      const result = ConsoleMessageSchema.parse(minimalMessage);
      expect(result.severity).toBe('log');
      expect(result.message).toBe('Hello world');
      expect(result.timestamp).toEqual(timestamp);
      expect(result.sourceUrl).toBeUndefined();
      expect(result.lineNumber).toBeUndefined();
      expect(result.columnNumber).toBeUndefined();
      expect(result.stackTrace).toBeUndefined();
    });

    it('should accept console message with stack trace', () => {
      const timestamp = new Date();
      const stackTrace: StackFrame[] = [
        {
          functionName: 'errorFunction',
          fileName: 'error.js',
          lineNumber: 15,
          columnNumber: 8,
        },
        {
          fileName: 'main.js',
          lineNumber: 5,
          columnNumber: 12,
        },
      ];

      const messageWithStack = {
        severity: 'error' as ConsoleSeverity,
        message: 'Stack trace error',
        timestamp,
        stackTrace,
      };

      const result = ConsoleMessageSchema.parse(messageWithStack);
      expect(result.stackTrace).toEqual(stackTrace);
      expect(result.stackTrace).toHaveLength(2);
      expect(result.stackTrace![0].functionName).toBe('errorFunction');
      expect(result.stackTrace![1].functionName).toBeUndefined();
    });

    it('should require severity, message, and timestamp', () => {
      const baseMessage = {
        severity: 'info' as ConsoleSeverity,
        message: 'test message',
        timestamp: new Date(),
      };

      // Valid complete message
      expect(() => ConsoleMessageSchema.parse(baseMessage)).not.toThrow();

      // Missing required fields
      expect(() => ConsoleMessageSchema.parse({ ...baseMessage, severity: undefined })).toThrow();
      expect(() => ConsoleMessageSchema.parse({ ...baseMessage, message: undefined })).toThrow();
      expect(() => ConsoleMessageSchema.parse({ ...baseMessage, timestamp: undefined })).toThrow();
    });

    it('should validate line and column numbers when provided', () => {
      const baseMessage = {
        severity: 'warn' as ConsoleSeverity,
        message: 'test',
        timestamp: new Date(),
        sourceUrl: 'test.js',
      };

      // Valid line and column numbers
      expect(() => ConsoleMessageSchema.parse({ ...baseMessage, lineNumber: 1, columnNumber: 1 })).not.toThrow();
      expect(() => ConsoleMessageSchema.parse({ ...baseMessage, lineNumber: 100 })).not.toThrow();
      expect(() => ConsoleMessageSchema.parse({ ...baseMessage, columnNumber: 50 })).not.toThrow();

      // Invalid line and column numbers
      expect(() => ConsoleMessageSchema.parse({ ...baseMessage, lineNumber: 0 })).toThrow();
      expect(() => ConsoleMessageSchema.parse({ ...baseMessage, columnNumber: 0 })).toThrow();
      expect(() => ConsoleMessageSchema.parse({ ...baseMessage, lineNumber: -1 })).toThrow();
      expect(() => ConsoleMessageSchema.parse({ ...baseMessage, lineNumber: 1.5 })).toThrow();
    });

    it('should handle various message content types', () => {
      const timestamp = new Date();
      const messageTypes = [
        'Simple string message',
        'Message with special characters: !@#$%^&*()',
        'Multi-line\nmessage\nwith\nbreaks',
        'Unicode message: 🚀 ✨ 💻',
        'Very long message: ' + 'x'.repeat(1000),
        '',
      ];

      messageTypes.forEach(messageContent => {
        const message = {
          severity: 'info' as ConsoleSeverity,
          message: messageContent,
          timestamp,
        };
        expect(() => ConsoleMessageSchema.parse(message)).not.toThrow();
        expect(ConsoleMessageSchema.parse(message).message).toBe(messageContent);
      });
    });

    it('should validate timestamp as Date object', () => {
      const baseMessage = {
        severity: 'debug' as ConsoleSeverity,
        message: 'timestamp test',
      };

      // Valid Date objects
      expect(() => ConsoleMessageSchema.parse({ ...baseMessage, timestamp: new Date() })).not.toThrow();
      expect(() => ConsoleMessageSchema.parse({ ...baseMessage, timestamp: new Date('2023-01-01') })).not.toThrow();

      // Invalid timestamp values
      expect(() => ConsoleMessageSchema.parse({ ...baseMessage, timestamp: '2023-01-01' })).toThrow();
      expect(() => ConsoleMessageSchema.parse({ ...baseMessage, timestamp: 1672531200000 })).toThrow();
      expect(() => ConsoleMessageSchema.parse({ ...baseMessage, timestamp: null })).toThrow();
      expect(() => ConsoleMessageSchema.parse({ ...baseMessage, timestamp: undefined })).toThrow();
    });
  });

  describe('BrowserErrorSchema', () => {
    it('should accept valid browser error with all fields', () => {
      const timestamp = new Date('2023-12-01T15:45:00Z');
      const stackTrace: StackFrame[] = [
        {
          functionName: 'crashFunction',
          fileName: 'crash.js',
          lineNumber: 20,
          columnNumber: 5,
        },
      ];

      const validError = {
        name: 'TypeError',
        message: 'Cannot read property of undefined',
        timestamp,
        sourceUrl: 'https://example.com/app.js',
        lineNumber: 42,
        columnNumber: 15,
        stackTrace,
      };

      const result = BrowserErrorSchema.parse(validError);
      expect(result).toEqual(validError);
      expect(result.name).toBe('TypeError');
      expect(result.message).toBe('Cannot read property of undefined');
      expect(result.timestamp).toEqual(timestamp);
      expect(result.sourceUrl).toBe('https://example.com/app.js');
      expect(result.lineNumber).toBe(42);
      expect(result.columnNumber).toBe(15);
      expect(result.stackTrace).toEqual(stackTrace);
    });

    it('should accept browser error with only required fields', () => {
      const timestamp = new Date();
      const minimalError = {
        name: 'Error',
        message: 'Generic error',
        timestamp,
      };

      const result = BrowserErrorSchema.parse(minimalError);
      expect(result.name).toBe('Error');
      expect(result.message).toBe('Generic error');
      expect(result.timestamp).toEqual(timestamp);
      expect(result.sourceUrl).toBeUndefined();
      expect(result.lineNumber).toBeUndefined();
      expect(result.columnNumber).toBeUndefined();
      expect(result.stackTrace).toBeUndefined();
    });

    it('should require name, message, and timestamp', () => {
      const baseError = {
        name: 'TestError',
        message: 'test error message',
        timestamp: new Date(),
      };

      // Valid complete error
      expect(() => BrowserErrorSchema.parse(baseError)).not.toThrow();

      // Missing required fields
      expect(() => BrowserErrorSchema.parse({ ...baseError, name: undefined })).toThrow();
      expect(() => BrowserErrorSchema.parse({ ...baseError, message: undefined })).toThrow();
      expect(() => BrowserErrorSchema.parse({ ...baseError, timestamp: undefined })).toThrow();
    });

    it('should handle various error types and messages', () => {
      const timestamp = new Date();
      const errorTypes = [
        { name: 'TypeError', message: 'Cannot read property of null' },
        { name: 'ReferenceError', message: 'Variable is not defined' },
        { name: 'SyntaxError', message: 'Unexpected token' },
        { name: 'NetworkError', message: 'Failed to fetch' },
        { name: 'TimeoutError', message: 'Request timed out' },
        { name: 'CustomError', message: 'Application specific error' },
        { name: '', message: 'Error with empty name' },
        { name: 'Error', message: '' },
      ];

      errorTypes.forEach(({ name, message }) => {
        const error = { name, message, timestamp };
        expect(() => BrowserErrorSchema.parse(error)).not.toThrow();
        const parsed = BrowserErrorSchema.parse(error);
        expect(parsed.name).toBe(name);
        expect(parsed.message).toBe(message);
      });
    });

    it('should validate line and column numbers when provided', () => {
      const baseError = {
        name: 'Error',
        message: 'test error',
        timestamp: new Date(),
        sourceUrl: 'test.js',
      };

      // Valid line and column numbers
      expect(() => BrowserErrorSchema.parse({ ...baseError, lineNumber: 1, columnNumber: 1 })).not.toThrow();
      expect(() => BrowserErrorSchema.parse({ ...baseError, lineNumber: 999 })).not.toThrow();

      // Invalid line and column numbers
      expect(() => BrowserErrorSchema.parse({ ...baseError, lineNumber: 0 })).toThrow();
      expect(() => BrowserErrorSchema.parse({ ...baseError, columnNumber: 0 })).toThrow();
      expect(() => BrowserErrorSchema.parse({ ...baseError, lineNumber: -10 })).toThrow();
      expect(() => BrowserErrorSchema.parse({ ...baseError, lineNumber: 3.14 })).toThrow();
    });

    it('should accept complex stack traces', () => {
      const timestamp = new Date();
      const complexStackTrace: StackFrame[] = [
        {
          functionName: 'innerFunction',
          fileName: 'inner.js',
          lineNumber: 10,
          columnNumber: 5,
        },
        {
          functionName: 'middleFunction',
          fileName: 'middle.js',
          lineNumber: 25,
          columnNumber: 12,
        },
        {
          functionName: 'outerFunction',
          fileName: 'outer.js',
          lineNumber: 50,
          columnNumber: 8,
        },
        {
          // Anonymous function
          fileName: '<anonymous>',
          lineNumber: 1,
          columnNumber: 1,
        },
      ];

      const errorWithComplexStack = {
        name: 'Error',
        message: 'Complex stack trace error',
        timestamp,
        stackTrace: complexStackTrace,
      };

      const result = BrowserErrorSchema.parse(errorWithComplexStack);
      expect(result.stackTrace).toEqual(complexStackTrace);
      expect(result.stackTrace).toHaveLength(4);
      expect(result.stackTrace![0].functionName).toBe('innerFunction');
      expect(result.stackTrace![3].functionName).toBeUndefined();
    });

    it('should handle empty stack trace array', () => {
      const timestamp = new Date();
      const errorWithEmptyStack = {
        name: 'Error',
        message: 'Error with empty stack',
        timestamp,
        stackTrace: [],
      };

      const result = BrowserErrorSchema.parse(errorWithEmptyStack);
      expect(result.stackTrace).toEqual([]);
      expect(result.stackTrace).toHaveLength(0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle console message with browser error in message', () => {
      const timestamp = new Date();
      const errorStackTrace: StackFrame[] = [
        {
          functionName: 'problematicFunction',
          fileName: 'problem.js',
          lineNumber: 15,
          columnNumber: 10,
        },
      ];

      // Console message containing error information
      const consoleMessage = {
        severity: 'error' as ConsoleSeverity,
        message: 'Uncaught TypeError: Cannot read property of undefined',
        timestamp,
        sourceUrl: 'https://example.com/app.js',
        lineNumber: 30,
        columnNumber: 8,
        stackTrace: errorStackTrace,
      };

      const result = ConsoleMessageSchema.parse(consoleMessage);
      expect(result.severity).toBe('error');
      expect(result.message).toContain('TypeError');
      expect(result.stackTrace).toEqual(errorStackTrace);
    });

    it('should handle browser error and console message with same stack trace structure', () => {
      const timestamp = new Date();
      const sharedStackTrace: StackFrame[] = [
        {
          functionName: 'sharedFunction',
          fileName: 'shared.js',
          lineNumber: 100,
          columnNumber: 20,
        },
      ];

      const browserError = {
        name: 'ReferenceError',
        message: 'x is not defined',
        timestamp,
        stackTrace: sharedStackTrace,
      };

      const consoleMessage = {
        severity: 'error' as ConsoleSeverity,
        message: 'ReferenceError: x is not defined',
        timestamp,
        stackTrace: sharedStackTrace,
      };

      const parsedError = BrowserErrorSchema.parse(browserError);
      const parsedMessage = ConsoleMessageSchema.parse(consoleMessage);

      expect(parsedError.stackTrace).toEqual(parsedMessage.stackTrace);
      expect(parsedError.stackTrace![0].functionName).toBe('sharedFunction');
      expect(parsedMessage.stackTrace![0].functionName).toBe('sharedFunction');
    });

    it('should validate type compatibility between schemas', () => {
      const timestamp = new Date();

      // Create instances that should be compatible
      const stackFrame: StackFrame = {
        functionName: 'testFunction',
        fileName: 'test.js',
        lineNumber: 1,
        columnNumber: 1,
      };

      const consoleMessage: ConsoleMessage = {
        severity: 'log',
        message: 'Test message',
        timestamp,
        stackTrace: [stackFrame],
      };

      const browserError: BrowserError = {
        name: 'TestError',
        message: 'Test error',
        timestamp,
        stackTrace: [stackFrame],
      };

      // Verify all schemas accept these instances
      expect(() => StackFrameSchema.parse(stackFrame)).not.toThrow();
      expect(() => ConsoleMessageSchema.parse(consoleMessage)).not.toThrow();
      expect(() => BrowserErrorSchema.parse(browserError)).not.toThrow();

      // Verify TypeScript type compatibility
      const frames: StackFrame[] = [stackFrame];
      const message = { ...consoleMessage, stackTrace: frames };
      const error = { ...browserError, stackTrace: frames };

      expect(ConsoleMessageSchema.parse(message).stackTrace).toEqual(frames);
      expect(BrowserErrorSchema.parse(error).stackTrace).toEqual(frames);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very large line and column numbers', () => {
      const timestamp = new Date();
      const largeNumbers = {
        severity: 'info' as ConsoleSeverity,
        message: 'Large numbers test',
        timestamp,
        lineNumber: Number.MAX_SAFE_INTEGER,
        columnNumber: Number.MAX_SAFE_INTEGER,
      };

      expect(() => ConsoleMessageSchema.parse(largeNumbers)).not.toThrow();
      const result = ConsoleMessageSchema.parse(largeNumbers);
      expect(result.lineNumber).toBe(Number.MAX_SAFE_INTEGER);
      expect(result.columnNumber).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle very long messages', () => {
      const timestamp = new Date();
      const veryLongMessage = 'x'.repeat(100000); // 100KB message

      const consoleMessage = {
        severity: 'debug' as ConsoleSeverity,
        message: veryLongMessage,
        timestamp,
      };

      expect(() => ConsoleMessageSchema.parse(consoleMessage)).not.toThrow();
      expect(ConsoleMessageSchema.parse(consoleMessage).message).toHaveLength(100000);
    });

    it('should handle stack traces with many frames', () => {
      const timestamp = new Date();
      const manyFrames: StackFrame[] = Array.from({ length: 100 }, (_, i) => ({
        functionName: `function${i}`,
        fileName: `file${i}.js`,
        lineNumber: i + 1,
        columnNumber: i + 1,
      }));

      const errorWithManyFrames = {
        name: 'DeepStackError',
        message: 'Error with deep stack',
        timestamp,
        stackTrace: manyFrames,
      };

      expect(() => BrowserErrorSchema.parse(errorWithManyFrames)).not.toThrow();
      const result = BrowserErrorSchema.parse(errorWithManyFrames);
      expect(result.stackTrace).toHaveLength(100);
      expect(result.stackTrace![99].functionName).toBe('function99');
    });

    it('should reject malformed data gracefully', () => {
      const malformedData = [
        null,
        undefined,
        'string',
        123,
        [],
        true,
        { randomField: 'value' },
      ];

      malformedData.forEach(data => {
        expect(() => ConsoleSeveritySchema.parse(data)).toThrow();
        expect(() => StackFrameSchema.parse(data)).toThrow();
        expect(() => ConsoleMessageSchema.parse(data)).toThrow();
        expect(() => BrowserErrorSchema.parse(data)).toThrow();
      });
    });

    it('should provide meaningful error messages for validation failures', () => {
      const invalidConsoleMessage = {
        severity: 'invalid-severity',
        message: 'test',
        timestamp: 'not-a-date',
      };

      try {
        ConsoleMessageSchema.parse(invalidConsoleMessage);
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.errors).toBeDefined();
        expect(error.errors.length).toBeGreaterThan(0);
      }

      const invalidStackFrame = {
        functionName: 'test',
        fileName: 'test.js',
        lineNumber: -1, // Invalid
        columnNumber: 'invalid', // Invalid
      };

      try {
        StackFrameSchema.parse(invalidStackFrame);
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.errors).toBeDefined();
        expect(error.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('TypeScript Type Compatibility', () => {
    it('should have proper type inference for all schemas', () => {
      // This test ensures TypeScript compilation and type inference work correctly
      const severity: ConsoleSeverity = ConsoleSeveritySchema.parse('error');
      const stackFrame: StackFrame = StackFrameSchema.parse({
        fileName: 'test.js',
        lineNumber: 1,
        columnNumber: 1,
      });
      const consoleMessage: ConsoleMessage = ConsoleMessageSchema.parse({
        severity: 'info',
        message: 'test',
        timestamp: new Date(),
      });
      const browserError: BrowserError = BrowserErrorSchema.parse({
        name: 'Error',
        message: 'test',
        timestamp: new Date(),
      });

      // Type assertions to verify TypeScript compilation
      expect(typeof severity).toBe('string');
      expect(typeof stackFrame.fileName).toBe('string');
      expect(typeof consoleMessage.severity).toBe('string');
      expect(typeof browserError.name).toBe('string');
      expect(consoleMessage.timestamp instanceof Date).toBe(true);
      expect(browserError.timestamp instanceof Date).toBe(true);
    });

    it('should support optional field type inference', () => {
      const partialStackFrame: StackFrame = StackFrameSchema.parse({
        fileName: 'test.js',
        lineNumber: 1,
        columnNumber: 1,
        // functionName is optional
      });

      const partialConsoleMessage: ConsoleMessage = ConsoleMessageSchema.parse({
        severity: 'log',
        message: 'test',
        timestamp: new Date(),
        // sourceUrl, lineNumber, columnNumber, stackTrace are optional
      });

      const partialBrowserError: BrowserError = BrowserErrorSchema.parse({
        name: 'Error',
        message: 'test',
        timestamp: new Date(),
        // sourceUrl, lineNumber, columnNumber, stackTrace are optional
      });

      expect(partialStackFrame.functionName).toBeUndefined();
      expect(partialConsoleMessage.sourceUrl).toBeUndefined();
      expect(partialBrowserError.stackTrace).toBeUndefined();
    });
  });
});