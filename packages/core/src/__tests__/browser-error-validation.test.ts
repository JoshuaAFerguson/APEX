import {
  BrowserErrorSchema,
  type BrowserError,
  StackFrameSchema,
  type StackFrame,
} from '../types.js';

/**
 * Dedicated unit tests for BrowserError type validation
 * Tests comprehensive Zod schema validation including valid errors,
 * stack trace parsing, missing fields, and various error types
 */
describe('BrowserError Type Validation', () => {
  describe('Valid BrowserError Objects', () => {
    it('should validate minimal valid BrowserError with required fields only', () => {
      const minimalError = {
        name: 'Error',
        message: 'Something went wrong',
        timestamp: new Date('2023-12-01T10:30:00Z'),
      };

      const result = BrowserErrorSchema.parse(minimalError);
      expect(result.name).toBe('Error');
      expect(result.message).toBe('Something went wrong');
      expect(result.timestamp).toEqual(new Date('2023-12-01T10:30:00Z'));
      expect(result.sourceUrl).toBeUndefined();
      expect(result.lineNumber).toBeUndefined();
      expect(result.columnNumber).toBeUndefined();
      expect(result.stackTrace).toBeUndefined();
    });

    it('should validate complete BrowserError with all fields', () => {
      const stackTrace: StackFrame[] = [
        {
          functionName: 'handleClick',
          url: 'https://example.com/app.js',
          lineNumber: 42,
          columnNumber: 15,
        },
        {
          functionName: 'addEventListener',
          url: 'https://example.com/lib.js',
          lineNumber: 123,
          columnNumber: 8,
        },
      ];

      const completeError = {
        name: 'TypeError',
        message: 'Cannot read property "click" of null',
        timestamp: new Date('2023-12-01T15:45:30Z'),
        sourceUrl: 'https://example.com/main.js',
        lineNumber: 67,
        columnNumber: 24,
        stackTrace,
      };

      const result = BrowserErrorSchema.parse(completeError);
      expect(result.name).toBe('TypeError');
      expect(result.message).toBe('Cannot read property "click" of null');
      expect(result.timestamp).toEqual(new Date('2023-12-01T15:45:30Z'));
      expect(result.sourceUrl).toBe('https://example.com/main.js');
      expect(result.lineNumber).toBe(67);
      expect(result.columnNumber).toBe(24);
      expect(result.stackTrace).toEqual(stackTrace);
      expect(result.stackTrace).toHaveLength(2);
    });

    it('should validate BrowserError with empty string values', () => {
      const errorWithEmptyStrings = {
        name: '',
        message: '',
        timestamp: new Date(),
        sourceUrl: '',
      };

      const result = BrowserErrorSchema.parse(errorWithEmptyStrings);
      expect(result.name).toBe('');
      expect(result.message).toBe('');
      expect(result.sourceUrl).toBe('');
    });

    it('should validate BrowserError with unicode and special characters', () => {
      const unicodeError = {
        name: 'ValidationError',
        message: '🚨 Error: Invalid input (émoji & spéciàl chars)',
        timestamp: new Date(),
        sourceUrl: 'https://example.com/módulo.js',
      };

      const result = BrowserErrorSchema.parse(unicodeError);
      expect(result.name).toBe('ValidationError');
      expect(result.message).toBe('🚨 Error: Invalid input (émoji & spéciàl chars)');
      expect(result.sourceUrl).toBe('https://example.com/módulo.js');
    });
  });

  describe('Various Error Types', () => {
    const timestamp = new Date('2023-12-01T12:00:00Z');

    const errorTypes = [
      { name: 'TypeError', message: 'Cannot read property of null' },
      { name: 'ReferenceError', message: 'variable is not defined' },
      { name: 'SyntaxError', message: 'Unexpected token' },
      { name: 'RangeError', message: 'Invalid array length' },
      { name: 'EvalError', message: 'Illegal eval usage' },
      { name: 'URIError', message: 'URI malformed' },
      { name: 'NetworkError', message: 'Failed to fetch resource' },
      { name: 'TimeoutError', message: 'Request timed out' },
      { name: 'SecurityError', message: 'Permission denied' },
      { name: 'QuotaExceededError', message: 'Storage quota exceeded' },
      { name: 'CustomApplicationError', message: 'Application-specific error occurred' },
      { name: 'UnhandledPromiseRejectionError', message: 'Promise rejected without handler' },
    ];

    errorTypes.forEach(({ name, message }) => {
      it(`should validate ${name} error type`, () => {
        const errorObject = {
          name,
          message,
          timestamp,
        };

        const result = BrowserErrorSchema.parse(errorObject);
        expect(result.name).toBe(name);
        expect(result.message).toBe(message);
        expect(result.timestamp).toEqual(timestamp);
      });
    });

    it('should validate all error types in bulk', () => {
      const errors = errorTypes.map(({ name, message }) => ({
        name,
        message,
        timestamp,
      }));

      errors.forEach(error => {
        expect(() => BrowserErrorSchema.parse(error)).not.toThrow();
      });

      expect(errors).toHaveLength(12);
    });
  });

  describe('Stack Trace Parsing', () => {
    it('should validate empty stack trace array', () => {
      const errorWithEmptyStack = {
        name: 'Error',
        message: 'Error without stack trace',
        timestamp: new Date(),
        stackTrace: [],
      };

      const result = BrowserErrorSchema.parse(errorWithEmptyStack);
      expect(result.stackTrace).toEqual([]);
      expect(result.stackTrace).toHaveLength(0);
    });

    it('should validate single stack frame', () => {
      const singleFrame: StackFrame = {
        functionName: 'main',
        url: 'file:///app.js',
        lineNumber: 1,
        columnNumber: 1,
      };

      const errorWithSingleFrame = {
        name: 'Error',
        message: 'Single frame error',
        timestamp: new Date(),
        stackTrace: [singleFrame],
      };

      const result = BrowserErrorSchema.parse(errorWithSingleFrame);
      expect(result.stackTrace).toEqual([singleFrame]);
      expect(result.stackTrace).toHaveLength(1);
      expect(result.stackTrace![0].functionName).toBe('main');
    });

    it('should validate deep stack trace with multiple frames', () => {
      const deepStack: StackFrame[] = Array.from({ length: 20 }, (_, i) => ({
        functionName: `function_${i}`,
        url: `https://example.com/module_${i}.js`,
        lineNumber: i * 10 + 1,
        columnNumber: i + 1,
      }));

      const errorWithDeepStack = {
        name: 'RecursionError',
        message: 'Maximum call stack size exceeded',
        timestamp: new Date(),
        stackTrace: deepStack,
      };

      const result = BrowserErrorSchema.parse(errorWithDeepStack);
      expect(result.stackTrace).toHaveLength(20);
      expect(result.stackTrace![0].functionName).toBe('function_0');
      expect(result.stackTrace![19].functionName).toBe('function_19');
      expect(result.stackTrace![10].lineNumber).toBe(101);
    });

    it('should validate stack trace with anonymous functions', () => {
      const anonymousStack: StackFrame[] = [
        {
          functionName: 'namedFunction',
          url: 'app.js',
          lineNumber: 10,
          columnNumber: 5,
        },
        {
          // Anonymous function (no functionName)
          url: '<anonymous>',
          lineNumber: 1,
          columnNumber: 1,
        },
        {
          functionName: 'eval',
          url: '<eval>',
          lineNumber: 2,
          columnNumber: 15,
        },
      ];

      const errorWithAnonymousStack = {
        name: 'Error',
        message: 'Error with mixed stack trace',
        timestamp: new Date(),
        stackTrace: anonymousStack,
      };

      const result = BrowserErrorSchema.parse(errorWithAnonymousStack);
      expect(result.stackTrace).toHaveLength(3);
      expect(result.stackTrace![0].functionName).toBe('namedFunction');
      expect(result.stackTrace![1].functionName).toBeUndefined();
      expect(result.stackTrace![2].functionName).toBe('eval');
    });

    it('should validate stack trace with various URL formats', () => {
      const urlFormats: StackFrame[] = [
        {
          functionName: 'httpFunction',
          url: 'https://cdn.example.com/lib.min.js',
          lineNumber: 1,
          columnNumber: 1234,
        },
        {
          functionName: 'fileFunction',
          url: 'file:///Users/dev/project/src/main.js',
          lineNumber: 42,
          columnNumber: 8,
        },
        {
          functionName: 'webpackFunction',
          url: 'webpack://./src/components/Button.js',
          lineNumber: 15,
          columnNumber: 20,
        },
        {
          functionName: 'dataFunction',
          url: 'data:text/javascript,console.log("hello")',
          lineNumber: 1,
          columnNumber: 1,
        },
        {
          functionName: 'blobFunction',
          url: 'blob:https://example.com/550e8400-e29b-41d4-a716-446655440000',
          lineNumber: 3,
          columnNumber: 12,
        },
      ];

      const errorWithVariousUrls = {
        name: 'Error',
        message: 'Error with various URL formats',
        timestamp: new Date(),
        stackTrace: urlFormats,
      };

      const result = BrowserErrorSchema.parse(errorWithVariousUrls);
      expect(result.stackTrace).toHaveLength(5);
      expect(result.stackTrace![0].url).toBe('https://cdn.example.com/lib.min.js');
      expect(result.stackTrace![1].url).toBe('file:///Users/dev/project/src/main.js');
      expect(result.stackTrace![2].url).toBe('webpack://./src/components/Button.js');
      expect(result.stackTrace![3].url).toBe('data:text/javascript,console.log("hello")');
      expect(result.stackTrace![4].url).toBe('blob:https://example.com/550e8400-e29b-41d4-a716-446655440000');
    });
  });

  describe('Missing and Invalid Fields', () => {
    describe('Required Fields Validation', () => {
      const baseValidError = {
        name: 'TestError',
        message: 'test message',
        timestamp: new Date(),
      };

      it('should reject BrowserError missing name field', () => {
        const missingName = {
          message: 'test message',
          timestamp: new Date(),
        };

        expect(() => BrowserErrorSchema.parse(missingName)).toThrow();
      });

      it('should reject BrowserError missing message field', () => {
        const missingMessage = {
          name: 'TestError',
          timestamp: new Date(),
        };

        expect(() => BrowserErrorSchema.parse(missingMessage)).toThrow();
      });

      it('should reject BrowserError missing timestamp field', () => {
        const missingTimestamp = {
          name: 'TestError',
          message: 'test message',
        };

        expect(() => BrowserErrorSchema.parse(missingTimestamp)).toThrow();
      });

      it('should reject BrowserError with all required fields undefined', () => {
        const allUndefined = {
          name: undefined,
          message: undefined,
          timestamp: undefined,
        };

        expect(() => BrowserErrorSchema.parse(allUndefined)).toThrow();
      });

      it('should reject BrowserError with all required fields null', () => {
        const allNull = {
          name: null,
          message: null,
          timestamp: null,
        };

        expect(() => BrowserErrorSchema.parse(allNull)).toThrow();
      });
    });

    describe('Invalid Field Types', () => {
      const baseValidError = {
        name: 'TestError',
        message: 'test message',
        timestamp: new Date(),
      };

      it('should reject non-string name field', () => {
        const invalidNames = [123, true, null, undefined, {}, []];

        invalidNames.forEach(invalidName => {
          const invalidError = { ...baseValidError, name: invalidName };
          expect(() => BrowserErrorSchema.parse(invalidError)).toThrow();
        });
      });

      it('should reject non-string message field', () => {
        const invalidMessages = [123, true, null, undefined, {}, []];

        invalidMessages.forEach(invalidMessage => {
          const invalidError = { ...baseValidError, message: invalidMessage };
          expect(() => BrowserErrorSchema.parse(invalidError)).toThrow();
        });
      });

      it('should reject non-Date timestamp field', () => {
        const invalidTimestamps = [
          '2023-12-01T10:30:00Z', // string date
          1701422000000, // number timestamp
          true,
          null,
          undefined,
          {},
          [],
          'invalid-date',
        ];

        invalidTimestamps.forEach(invalidTimestamp => {
          const invalidError = { ...baseValidError, timestamp: invalidTimestamp };
          expect(() => BrowserErrorSchema.parse(invalidError)).toThrow();
        });
      });

      it('should reject non-string sourceUrl field', () => {
        const invalidUrls = [123, true, null, {}, []];

        invalidUrls.forEach(invalidUrl => {
          const invalidError = { ...baseValidError, sourceUrl: invalidUrl };
          expect(() => BrowserErrorSchema.parse(invalidError)).toThrow();
        });
      });
    });

    describe('Invalid Line and Column Numbers', () => {
      const baseValidError = {
        name: 'TestError',
        message: 'test message',
        timestamp: new Date(),
        sourceUrl: 'test.js',
      };

      it('should reject zero and negative line numbers', () => {
        const invalidLineNumbers = [0, -1, -10, -999];

        invalidLineNumbers.forEach(invalidLine => {
          const invalidError = { ...baseValidError, lineNumber: invalidLine };
          expect(() => BrowserErrorSchema.parse(invalidError)).toThrow();
        });
      });

      it('should reject zero and negative column numbers', () => {
        const invalidColumnNumbers = [0, -1, -5, -100];

        invalidColumnNumbers.forEach(invalidColumn => {
          const invalidError = { ...baseValidError, columnNumber: invalidColumn };
          expect(() => BrowserErrorSchema.parse(invalidError)).toThrow();
        });
      });

      it('should reject non-integer line and column numbers', () => {
        const nonIntegers = [1.5, 2.7, 3.14159, Math.PI];

        nonIntegers.forEach(nonInteger => {
          const invalidLineError = { ...baseValidError, lineNumber: nonInteger };
          expect(() => BrowserErrorSchema.parse(invalidLineError)).toThrow();

          const invalidColumnError = { ...baseValidError, columnNumber: nonInteger };
          expect(() => BrowserErrorSchema.parse(invalidColumnError)).toThrow();
        });
      });

      it('should reject non-numeric line and column numbers', () => {
        const nonNumbers = ['42', '100', true, false, null, undefined, {}, []];

        nonNumbers.forEach(nonNumber => {
          const invalidLineError = { ...baseValidError, lineNumber: nonNumber };
          expect(() => BrowserErrorSchema.parse(invalidLineError)).toThrow();

          const invalidColumnError = { ...baseValidError, columnNumber: nonNumber };
          expect(() => BrowserErrorSchema.parse(invalidColumnError)).toThrow();
        });
      });

      it('should accept valid positive integer line and column numbers', () => {
        const validNumbers = [1, 2, 10, 42, 100, 999, 1000, Number.MAX_SAFE_INTEGER];

        validNumbers.forEach(validNumber => {
          const validLineError = { ...baseValidError, lineNumber: validNumber };
          expect(() => BrowserErrorSchema.parse(validLineError)).not.toThrow();
          expect(BrowserErrorSchema.parse(validLineError).lineNumber).toBe(validNumber);

          const validColumnError = { ...baseValidError, columnNumber: validNumber };
          expect(() => BrowserErrorSchema.parse(validColumnError)).not.toThrow();
          expect(BrowserErrorSchema.parse(validColumnError).columnNumber).toBe(validNumber);
        });
      });
    });

    describe('Invalid Stack Trace', () => {
      const baseValidError = {
        name: 'TestError',
        message: 'test message',
        timestamp: new Date(),
      };

      it('should reject non-array stack trace', () => {
        const nonArrays = ['string', 123, true, {}, null];

        nonArrays.forEach(nonArray => {
          const invalidError = { ...baseValidError, stackTrace: nonArray };
          expect(() => BrowserErrorSchema.parse(invalidError)).toThrow();
        });
      });

      it('should reject invalid stack frame objects in array', () => {
        const invalidFrames = [
          'string',
          123,
          true,
          null,
          { invalid: 'frame' },
          { url: 'test.js' }, // missing required lineNumber and columnNumber
          { lineNumber: 1 }, // missing required url and columnNumber
          { columnNumber: 1 }, // missing required url and lineNumber
        ];

        invalidFrames.forEach(invalidFrame => {
          const invalidError = { ...baseValidError, stackTrace: [invalidFrame] };
          expect(() => BrowserErrorSchema.parse(invalidError)).toThrow();
        });
      });

      it('should reject mixed valid and invalid frames', () => {
        const mixedStack = [
          // Valid frame
          {
            functionName: 'validFunction',
            url: 'valid.js',
            lineNumber: 1,
            columnNumber: 1,
          },
          // Invalid frame
          {
            functionName: 'invalidFunction',
            url: 'invalid.js',
            lineNumber: 0, // Invalid: must be >= 1
            columnNumber: 1,
          },
        ];

        const invalidError = { ...baseValidError, stackTrace: mixedStack };
        expect(() => BrowserErrorSchema.parse(invalidError)).toThrow();
      });
    });
  });

  describe('Edge Cases and Boundary Testing', () => {
    it('should handle very large line and column numbers', () => {
      const largeNumbers = {
        name: 'Error',
        message: 'Large numbers test',
        timestamp: new Date(),
        lineNumber: Number.MAX_SAFE_INTEGER,
        columnNumber: Number.MAX_SAFE_INTEGER,
      };

      const result = BrowserErrorSchema.parse(largeNumbers);
      expect(result.lineNumber).toBe(Number.MAX_SAFE_INTEGER);
      expect(result.columnNumber).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle very long error messages', () => {
      const veryLongMessage = 'Error: '.repeat(10000); // ~70KB message
      const longMessageError = {
        name: 'VerboseError',
        message: veryLongMessage,
        timestamp: new Date(),
      };

      const result = BrowserErrorSchema.parse(longMessageError);
      expect(result.message).toBe(veryLongMessage);
      expect(result.message.length).toBe(70000);
    });

    it('should handle very long error names', () => {
      const veryLongName = 'Very'.repeat(1000) + 'LongErrorName'; // ~4KB name
      const longNameError = {
        name: veryLongName,
        message: 'Error with very long name',
        timestamp: new Date(),
      };

      const result = BrowserErrorSchema.parse(longNameError);
      expect(result.name).toBe(veryLongName);
      expect(result.name.length).toBe(4013);
    });

    it('should handle complex nested object attempts', () => {
      const nestedObject = {
        name: 'TestError',
        message: 'test',
        timestamp: new Date(),
        extraField: { nested: { deeply: 'value' } }, // Extra field should be ignored
        stackTrace: [
          {
            functionName: 'test',
            url: 'test.js',
            lineNumber: 1,
            columnNumber: 1,
            extraFrameField: 'ignored', // Extra field should be ignored or cause validation to fail
          },
        ],
      };

      // Note: Zod by default strips unknown fields in .parse() but .strict() would reject them
      const result = BrowserErrorSchema.parse(nestedObject);
      expect(result.name).toBe('TestError');
      expect(result.stackTrace![0].functionName).toBe('test');
      expect((result as any).extraField).toBeUndefined(); // Extra field should be stripped
    });

    it('should handle Date edge cases', () => {
      const dateEdgeCases = [
        new Date(0), // Unix epoch
        new Date('1970-01-01T00:00:00Z'), // Unix epoch
        new Date('2099-12-31T23:59:59Z'), // Far future
        new Date(Date.now()), // Current time
        new Date('Invalid'), // Invalid Date object (but still Date type)
      ];

      dateEdgeCases.forEach(date => {
        const errorWithDate = {
          name: 'DateTestError',
          message: 'Date edge case test',
          timestamp: date,
        };

        if (isNaN(date.getTime())) {
          // Invalid Date should be rejected by Zod
          expect(() => BrowserErrorSchema.parse(errorWithDate)).toThrow();
        } else {
          const result = BrowserErrorSchema.parse(errorWithDate);
          expect(result.timestamp).toEqual(date);
        }
      });
    });
  });

  describe('Type Inference and Compatibility', () => {
    it('should maintain proper TypeScript type inference', () => {
      const error: BrowserError = {
        name: 'TypeError',
        message: 'Type inference test',
        timestamp: new Date(),
        sourceUrl: 'test.js',
        lineNumber: 42,
        columnNumber: 15,
        stackTrace: [
          {
            functionName: 'testFunction',
            url: 'test.js',
            lineNumber: 10,
            columnNumber: 5,
          },
        ],
      };

      const parsed: BrowserError = BrowserErrorSchema.parse(error);

      // TypeScript should infer correct types
      expect(typeof parsed.name).toBe('string');
      expect(typeof parsed.message).toBe('string');
      expect(parsed.timestamp instanceof Date).toBe(true);
      expect(typeof parsed.sourceUrl).toBe('string');
      expect(typeof parsed.lineNumber).toBe('number');
      expect(typeof parsed.columnNumber).toBe('number');
      expect(Array.isArray(parsed.stackTrace)).toBe(true);
      expect(parsed.stackTrace![0]).toBeDefined();
      expect(typeof parsed.stackTrace![0].functionName).toBe('string');
    });

    it('should handle optional fields correctly in type system', () => {
      const minimalError: BrowserError = {
        name: 'Error',
        message: 'Minimal error',
        timestamp: new Date(),
      };

      const parsed = BrowserErrorSchema.parse(minimalError);

      // Optional fields should be undefined, not missing
      expect(parsed.sourceUrl).toBeUndefined();
      expect(parsed.lineNumber).toBeUndefined();
      expect(parsed.columnNumber).toBeUndefined();
      expect(parsed.stackTrace).toBeUndefined();

      // But should be assignable to the type
      const withOptionals: BrowserError = {
        ...parsed,
        sourceUrl: 'added.js',
        lineNumber: 100,
        columnNumber: 50,
      };

      expect(withOptionals.sourceUrl).toBe('added.js');
      expect(withOptionals.lineNumber).toBe(100);
      expect(withOptionals.columnNumber).toBe(50);
    });
  });

  describe('Real-world Error Scenarios', () => {
    it('should validate common JavaScript errors', () => {
      const commonErrors = [
        {
          name: 'TypeError',
          message: "Cannot read property 'length' of undefined",
          timestamp: new Date(),
          sourceUrl: 'https://myapp.com/bundle.js',
          lineNumber: 1,
          columnNumber: 12345,
        },
        {
          name: 'ReferenceError',
          message: 'jQuery is not defined',
          timestamp: new Date(),
          sourceUrl: 'https://myapp.com/main.js',
          lineNumber: 15,
          columnNumber: 8,
        },
        {
          name: 'SyntaxError',
          message: 'Unexpected token }',
          timestamp: new Date(),
          sourceUrl: 'https://myapp.com/script.js',
          lineNumber: 42,
          columnNumber: 20,
        },
      ];

      commonErrors.forEach(error => {
        expect(() => BrowserErrorSchema.parse(error)).not.toThrow();
        const parsed = BrowserErrorSchema.parse(error);
        expect(parsed.name).toBe(error.name);
        expect(parsed.message).toBe(error.message);
      });
    });

    it('should validate network and resource loading errors', () => {
      const networkErrors = [
        {
          name: 'NetworkError',
          message: 'Failed to fetch',
          timestamp: new Date(),
          sourceUrl: 'https://api.example.com/data',
        },
        {
          name: 'SecurityError',
          message: 'Blocked by CORS policy',
          timestamp: new Date(),
          sourceUrl: 'https://external-api.com/endpoint',
        },
        {
          name: 'TimeoutError',
          message: 'The operation was aborted',
          timestamp: new Date(),
          sourceUrl: 'https://slow-server.com/resource',
        },
      ];

      networkErrors.forEach(error => {
        expect(() => BrowserErrorSchema.parse(error)).not.toThrow();
        const parsed = BrowserErrorSchema.parse(error);
        expect(parsed.name).toBe(error.name);
        expect(parsed.message).toBe(error.message);
        expect(parsed.sourceUrl).toBe(error.sourceUrl);
      });
    });

    it('should validate errors from different execution contexts', () => {
      const contextualErrors = [
        {
          name: 'Error',
          message: 'Main thread error',
          timestamp: new Date(),
          sourceUrl: 'https://app.com/main.js',
          lineNumber: 50,
          columnNumber: 12,
        },
        {
          name: 'Error',
          message: 'Web Worker error',
          timestamp: new Date(),
          sourceUrl: 'https://app.com/worker.js',
          lineNumber: 25,
          columnNumber: 8,
        },
        {
          name: 'Error',
          message: 'Service Worker error',
          timestamp: new Date(),
          sourceUrl: 'https://app.com/sw.js',
          lineNumber: 100,
          columnNumber: 15,
        },
        {
          name: 'Error',
          message: 'Inline script error',
          timestamp: new Date(),
          sourceUrl: 'https://app.com/page.html',
          lineNumber: 15,
          columnNumber: 5,
        },
      ];

      contextualErrors.forEach(error => {
        expect(() => BrowserErrorSchema.parse(error)).not.toThrow();
        const parsed = BrowserErrorSchema.parse(error);
        expect(parsed.message).toContain(error.message.split(' ')[0]); // Check context type in message
      });
    });
  });
});