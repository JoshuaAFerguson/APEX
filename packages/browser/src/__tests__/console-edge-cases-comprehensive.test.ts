/**
 * @apexcli/browser - Comprehensive Console Edge Cases Tests
 *
 * Tests for all edge cases in console message capture including:
 * - Empty messages, very long messages, special characters
 * - Circular references, undefined/null values, non-string arguments
 * - Multiple arguments to console methods
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';
import type { CapturedConsoleMessage } from '../types.js';

describe('Console Edge Cases - Comprehensive Tests', () => {
  let manager: BrowserManager;
  let session: BrowserSession;

  beforeEach(() => {
    manager = new BrowserManager();
  });

  afterEach(async () => {
    if (session) {
      await session.close();
    }
    if (manager) {
      await manager.shutdown();
    }
  });

  describe('Empty and Minimal Messages', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
      });
      await session.launch();
    });

    it('should handle empty console messages', async () => {
      const html = `
        <script>
          console.log();
          console.log('');
          console.log('', '', '');
          console.warn();
          console.error();
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();

      expect(messages.length).toBeGreaterThanOrEqual(5);

      // Find empty messages
      const emptyLog = messages.find(m => m.type === 'log' && (m.text === '' || m.text === undefined || m.args.length === 0));
      const emptyStringLog = messages.find(m => m.type === 'log' && m.text === '');
      const emptyWarn = messages.find(m => m.type === 'warn' && (m.text === '' || m.args.length === 0));
      const emptyError = messages.find(m => m.type === 'error' && (m.text === '' || m.args.length === 0));

      // Should capture empty messages gracefully
      expect(emptyLog || emptyStringLog).toBeDefined();
      expect(emptyWarn).toBeDefined();
      expect(emptyError).toBeDefined();

      // All messages should have proper structure
      messages.forEach(message => {
        expect(message.timestamp).toBeGreaterThan(0);
        expect(message.type).toBeDefined();
        expect(message.args).toBeDefined();
      });
    });

    it('should handle whitespace-only messages', async () => {
      const html = `
        <script>
          console.log(' ');
          console.log('   ');
          console.log('\\t');
          console.log('\\n');
          console.log('\\r\\n');
          console.log('    \\t\\n\\r    ');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const whitespaceMessages = messages.filter(m => m.type === 'log');

      expect(whitespaceMessages.length).toBeGreaterThanOrEqual(6);

      whitespaceMessages.forEach(message => {
        expect(message.args).toBeDefined();
        expect(message.text).toBeDefined();
        expect(message.timestamp).toBeGreaterThan(0);
      });
    });
  });

  describe('Undefined, Null, and Special Values', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
      });
      await session.launch();
    });

    it('should handle undefined and null values', async () => {
      const html = `
        <script>
          console.log(undefined);
          console.log(null);
          console.log('Value:', undefined);
          console.log('Null value:', null);
          console.warn(undefined, null, undefined);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();

      const undefinedMessage = messages.find(m => m.text.includes('undefined') && !m.text.includes('Value:'));
      const nullMessage = messages.find(m => m.text.includes('null') && !m.text.includes('Null value:'));
      const valueUndefinedMessage = messages.find(m => m.text.includes('Value:') && m.text.includes('undefined'));
      const nullValueMessage = messages.find(m => m.text.includes('Null value:') && m.text.includes('null'));

      expect(undefinedMessage).toBeDefined();
      expect(nullMessage).toBeDefined();
      expect(valueUndefinedMessage).toBeDefined();
      expect(nullValueMessage).toBeDefined();

      // Verify args contain the actual undefined/null values
      if (undefinedMessage) {
        expect(undefinedMessage.args).toBeDefined();
      }
      if (nullMessage) {
        expect(nullMessage.args).toBeDefined();
      }
    });

    it('should handle NaN, Infinity, and -Infinity', async () => {
      const html = `
        <script>
          console.log(NaN);
          console.log(Infinity);
          console.log(-Infinity);
          console.log('Result:', NaN);
          console.log('Positive infinity:', Infinity);
          console.log('Negative infinity:', -Infinity);
          console.error(NaN, Infinity, -Infinity);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();

      const nanMessage = messages.find(m => m.text.includes('NaN') && !m.text.includes('Result:'));
      const infinityMessage = messages.find(m => m.text.includes('Infinity') && !m.text.includes('Positive'));
      const negInfinityMessage = messages.find(m => m.text.includes('-Infinity') && !m.text.includes('Negative'));

      expect(nanMessage).toBeDefined();
      expect(infinityMessage).toBeDefined();
      expect(negInfinityMessage).toBeDefined();

      // All should have proper structure
      [nanMessage, infinityMessage, negInfinityMessage].forEach(message => {
        if (message) {
          expect(message.args).toBeDefined();
          expect(message.timestamp).toBeGreaterThan(0);
        }
      });
    });

    it('should handle boolean and numeric edge cases', async () => {
      const html = `
        <script>
          console.log(true);
          console.log(false);
          console.log(0);
          console.log(-0);
          console.log(0.0);
          console.log(-0.0);
          console.log(Number.MAX_VALUE);
          console.log(Number.MIN_VALUE);
          console.log(Number.MAX_SAFE_INTEGER);
          console.log(Number.MIN_SAFE_INTEGER);
          console.log(Number.EPSILON);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const numericMessages = messages.filter(m => m.type === 'log');

      expect(numericMessages.length).toBeGreaterThanOrEqual(11);

      numericMessages.forEach(message => {
        expect(message.args).toBeDefined();
        expect(message.text).toBeDefined();
        expect(message.timestamp).toBeGreaterThan(0);
      });
    });
  });

  describe('Non-String Arguments and Complex Types', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
      });
      await session.launch();
    });

    it('should handle function arguments', async () => {
      const html = `
        <script>
          function namedFunction() { return 'hello'; }
          const anonymousFunction = function() { return 'world'; };
          const arrowFunction = () => 'arrow';
          const asyncFunction = async () => 'async';

          console.log(namedFunction);
          console.log(anonymousFunction);
          console.log(arrowFunction);
          console.log(asyncFunction);
          console.log('Functions:', namedFunction, anonymousFunction, arrowFunction);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const functionMessages = messages.filter(m =>
        m.text.includes('function') ||
        m.text.includes('Functions:') ||
        m.text.includes('=>') ||
        m.text.includes('namedFunction')
      );

      expect(functionMessages.length).toBeGreaterThanOrEqual(4);

      functionMessages.forEach(message => {
        expect(message.args).toBeDefined();
        expect(message.text).toBeDefined();
        expect(message.timestamp).toBeGreaterThan(0);
      });
    });

    it('should handle Date, RegExp, and built-in objects', async () => {
      const html = `
        <script>
          const date = new Date();
          const regex = /test[0-9]+/gi;
          const map = new Map([['key1', 'value1'], ['key2', 'value2']]);
          const set = new Set([1, 2, 3, 1, 2, 3]);
          const weakMap = new WeakMap();
          const weakSet = new WeakSet();

          console.log('Date:', date);
          console.log('Regex:', regex);
          console.log('Map:', map);
          console.log('Set:', set);
          console.log('WeakMap:', weakMap);
          console.log('WeakSet:', weakSet);
          console.log('All together:', date, regex, map, set);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();

      const dateMessage = messages.find(m => m.text.includes('Date:'));
      const regexMessage = messages.find(m => m.text.includes('Regex:'));
      const mapMessage = messages.find(m => m.text.includes('Map:'));
      const setMessage = messages.find(m => m.text.includes('Set:'));

      expect(dateMessage).toBeDefined();
      expect(regexMessage).toBeDefined();
      expect(mapMessage).toBeDefined();
      expect(setMessage).toBeDefined();

      [dateMessage, regexMessage, mapMessage, setMessage].forEach(message => {
        if (message) {
          expect(message.args).toBeDefined();
          expect(message.args.length).toBeGreaterThanOrEqual(2);
        }
      });
    });

    it('should handle Error objects and stack traces', async () => {
      const html = `
        <script>
          const standardError = new Error('Standard error message');
          const typeError = new TypeError('Type error message');
          const rangeError = new RangeError('Range error message');
          const syntaxError = new SyntaxError('Syntax error message');

          console.log('Error:', standardError);
          console.log('TypeError:', typeError);
          console.error('Range error:', rangeError);
          console.warn('Syntax error:', syntaxError);

          // Errors with custom properties
          const customError = new Error('Custom error');
          customError.code = 'CUSTOM_CODE';
          customError.details = { nested: 'data' };
          console.log('Custom error:', customError);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();

      const errorMessages = messages.filter(m =>
        m.text.includes('Error:') ||
        m.text.includes('TypeError:') ||
        m.text.includes('Range error:') ||
        m.text.includes('Syntax error:') ||
        m.text.includes('Custom error:')
      );

      expect(errorMessages.length).toBeGreaterThanOrEqual(5);

      errorMessages.forEach(message => {
        expect(message.args).toBeDefined();
        expect(message.args.length).toBeGreaterThanOrEqual(2);
        expect(message.timestamp).toBeGreaterThan(0);
      });
    });
  });

  describe('Multiple Arguments Edge Cases', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
      });
      await session.launch();
    });

    it('should handle mixed type multiple arguments', async () => {
      const html = `
        <script>
          console.log('String', 42, true, null, undefined, NaN, Infinity);
          console.log('Mixed:', { obj: 'value' }, [1, 2, 3], function test() {}, new Date());
          console.warn('Warning with', 'multiple', 'string', 'arguments', 'and', 'numbers', 1, 2, 3);
          console.error('Error:', new Error('test'), 'additional', 'context', { error: true });
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();

      const mixedArgsMessage = messages.find(m => m.text.includes('String') && m.text.includes('42'));
      const mixedObjectsMessage = messages.find(m => m.text.includes('Mixed:'));
      const multipleStringMessage = messages.find(m => m.text.includes('Warning with') && m.type === 'warn');
      const errorContextMessage = messages.find(m => m.text.includes('Error:') && m.type === 'error');

      expect(mixedArgsMessage).toBeDefined();
      expect(mixedObjectsMessage).toBeDefined();
      expect(multipleStringMessage).toBeDefined();
      expect(errorContextMessage).toBeDefined();

      // Check argument counts
      expect(mixedArgsMessage!.args.length).toBeGreaterThanOrEqual(7);
      expect(mixedObjectsMessage!.args.length).toBeGreaterThanOrEqual(5);
      expect(multipleStringMessage!.args.length).toBeGreaterThanOrEqual(9);
      expect(errorContextMessage!.args.length).toBeGreaterThanOrEqual(4);
    });

    it('should handle large number of arguments', async () => {
      const html = `
        <script>
          const args = [];
          for (let i = 0; i < 50; i++) {
            args.push('arg' + i);
          }
          console.log('Many args:', ...args);

          const mixedArgs = [];
          for (let i = 0; i < 20; i++) {
            mixedArgs.push(i % 2 === 0 ? 'string' + i : i);
          }
          console.log('Mixed many:', ...mixedArgs);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();

      const manyArgsMessage = messages.find(m => m.text.includes('Many args:'));
      const mixedManyMessage = messages.find(m => m.text.includes('Mixed many:'));

      expect(manyArgsMessage).toBeDefined();
      expect(mixedManyMessage).toBeDefined();

      expect(manyArgsMessage!.args.length).toBeGreaterThanOrEqual(30); // 'Many args:' + 50 args
      expect(mixedManyMessage!.args.length).toBeGreaterThanOrEqual(15); // 'Mixed many:' + 20 args
    });

    it('should handle arguments with problematic toString/valueOf methods', async () => {
      const html = `
        <script>
          const problematicObj1 = {
            toString() { throw new Error('toString throws'); },
            valueOf() { return 42; }
          };

          const problematicObj2 = {
            toString() { return 'good toString'; },
            valueOf() { throw new Error('valueOf throws'); }
          };

          const problematicObj3 = {
            toString() { return null; },
            valueOf() { return undefined; }
          };

          try {
            console.log('Problematic objects:', problematicObj1, problematicObj2, problematicObj3);
          } catch (e) {
            console.error('Caught error during console.log:', e.message);
          }

          // Also test with other console methods
          try {
            console.warn('Warning with problematic:', problematicObj1);
          } catch (e) {
            console.error('Caught error during console.warn:', e.message);
          }
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();

      // Should have either the problematic objects message or error messages
      const problematicMessage = messages.find(m => m.text.includes('Problematic objects:'));
      const errorMessages = messages.filter(m => m.text.includes('Caught error'));

      expect(problematicMessage || errorMessages.length > 0).toBeTruthy();

      if (problematicMessage) {
        expect(problematicMessage.args).toBeDefined();
        expect(problematicMessage.args.length).toBeGreaterThanOrEqual(4);
      }

      errorMessages.forEach(message => {
        expect(message.type).toBe('error');
        expect(message.args).toBeDefined();
      });
    });
  });

  describe('Very Long Messages and Performance', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        maxBufferSize: 50, // Increased for long message tests
      });
      await session.launch();
    });

    it('should handle extremely long single arguments', async () => {
      const html = `
        <script>
          // Generate various large strings
          const megaString = 'A'.repeat(1000000); // 1MB string
          const unicodeLarge = '🚀'.repeat(100000); // Large Unicode string
          const mixedLarge = ('Hello World! '.repeat(1000) + '🌟'.repeat(1000)).repeat(100);

          console.log('Mega string:', megaString);
          console.log('Unicode large:', unicodeLarge);
          console.log('Mixed large:', mixedLarge);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 500));

      const messages = session.getCapturedConsoleMessages();

      const megaMessage = messages.find(m => m.text.includes('Mega string:'));
      const unicodeMessage = messages.find(m => m.text.includes('Unicode large:'));
      const mixedMessage = messages.find(m => m.text.includes('Mixed large:'));

      // Should handle at least one of the large messages
      expect(megaMessage || unicodeMessage || mixedMessage).toBeDefined();

      // Verify structure is maintained
      [megaMessage, unicodeMessage, mixedMessage].forEach(message => {
        if (message) {
          expect(message.args).toBeDefined();
          expect(message.timestamp).toBeGreaterThan(0);
          expect(message.type).toBe('log');
        }
      });
    });

    it('should handle many long arguments in single console call', async () => {
      const html = `
        <script>
          const longArgs = [];
          for (let i = 0; i < 10; i++) {
            longArgs.push('LongArgument' + i + '_'.repeat(10000));
          }

          console.log('Many long args:', ...longArgs);

          // Also test with objects containing long strings
          const objectsWithLongStrings = [];
          for (let i = 0; i < 5; i++) {
            objectsWithLongStrings.push({
              id: i,
              longProperty: 'X'.repeat(50000),
              nested: {
                deepLongProperty: 'Y'.repeat(30000)
              }
            });
          }

          console.log('Objects with long strings:', ...objectsWithLongStrings);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 500));

      const messages = session.getCapturedConsoleMessages();

      const manyLongMessage = messages.find(m => m.text.includes('Many long args:'));
      const objectsLongMessage = messages.find(m => m.text.includes('Objects with long strings:'));

      // Should handle at least one of the messages
      expect(manyLongMessage || objectsLongMessage).toBeDefined();

      if (manyLongMessage) {
        expect(manyLongMessage.args).toBeDefined();
        expect(manyLongMessage.args.length).toBeGreaterThanOrEqual(5); // 'Many long args:' + some args
      }

      if (objectsLongMessage) {
        expect(objectsLongMessage.args).toBeDefined();
        expect(objectsLongMessage.args.length).toBeGreaterThanOrEqual(3); // 'Objects...' + some objects
      }
    });
  });

  describe('Circular References and Self-References', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
      });
      await session.launch();
    });

    it('should handle complex circular reference patterns', async () => {
      const html = `
        <script>
          // Direct circular reference
          const a = { name: 'a' };
          a.self = a;

          // Mutual circular references
          const b = { name: 'b' };
          const c = { name: 'c' };
          b.ref = c;
          c.ref = b;

          // Circular array reference
          const arr = [1, 2, 3];
          arr.push(arr);

          // Mixed object-array circular reference
          const obj = { data: 'test' };
          const arrWithObj = [obj];
          obj.array = arrWithObj;

          console.log('Direct circular:', a);
          console.log('Mutual circular:', b, c);
          console.log('Circular array:', arr);
          console.log('Mixed circular:', obj);
          console.log('All together:', a, b, c, arr, obj);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 200));

      const messages = session.getCapturedConsoleMessages();

      const directMessage = messages.find(m => m.text.includes('Direct circular:'));
      const mutualMessage = messages.find(m => m.text.includes('Mutual circular:'));
      const arrayMessage = messages.find(m => m.text.includes('Circular array:'));
      const mixedMessage = messages.find(m => m.text.includes('Mixed circular:'));
      const allMessage = messages.find(m => m.text.includes('All together:'));

      expect(directMessage).toBeDefined();
      expect(mutualMessage).toBeDefined();
      expect(arrayMessage).toBeDefined();
      expect(mixedMessage).toBeDefined();
      expect(allMessage).toBeDefined();

      // All should be handled gracefully without crashing
      [directMessage, mutualMessage, arrayMessage, mixedMessage, allMessage].forEach(message => {
        if (message) {
          expect(message.args).toBeDefined();
          expect(message.timestamp).toBeGreaterThan(0);
          // Should not throw when JSON.stringify is attempted
          expect(() => JSON.stringify(message)).not.toThrow();
        }
      });
    });

    it('should handle deeply nested circular references', async () => {
      const html = `
        <script>
          function createDeepCircular(depth) {
            const root = { level: 0, depth: depth };
            let current = root;

            for (let i = 1; i < depth; i++) {
              current.next = { level: i, depth: depth };
              current = current.next;
            }

            // Create circular reference at the end
            current.next = root;

            return root;
          }

          const shallow = createDeepCircular(5);
          const medium = createDeepCircular(25);
          const deep = createDeepCircular(100);

          console.log('Shallow circular:', shallow);
          console.log('Medium circular:', medium);
          console.log('Deep circular:', deep);

          // Also test with mixed types in the chain
          const mixedChain = { type: 'object', level: 0 };
          mixedChain.array = [1, 2, { nested: mixedChain }];

          console.log('Mixed chain circular:', mixedChain);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 300));

      const messages = session.getCapturedConsoleMessages();

      const shallowMessage = messages.find(m => m.text.includes('Shallow circular:'));
      const mediumMessage = messages.find(m => m.text.includes('Medium circular:'));
      const deepMessage = messages.find(m => m.text.includes('Deep circular:'));
      const mixedChainMessage = messages.find(m => m.text.includes('Mixed chain circular:'));

      // Should handle all levels of nesting gracefully
      expect(shallowMessage).toBeDefined();
      expect(mediumMessage || deepMessage).toBeDefined(); // At least one deep structure
      expect(mixedChainMessage).toBeDefined();

      [shallowMessage, mediumMessage, deepMessage, mixedChainMessage].forEach(message => {
        if (message) {
          expect(message.args).toBeDefined();
          expect(message.timestamp).toBeGreaterThan(0);
          // Should not cause infinite loops or crashes
          expect(message.text).toBeDefined();
        }
      });
    });
  });

  describe('Special Characters and Encoding', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
      });
      await session.launch();
    });

    it('should handle all console methods with edge case arguments', async () => {
      const html = `
        <script>
          const edgeCases = [
            '',                          // empty string
            null,                        // null
            undefined,                   // undefined
            NaN,                         // NaN
            Infinity,                    // Infinity
            -Infinity,                   // -Infinity
            0,                          // zero
            -0,                         // negative zero
            true,                       // boolean true
            false,                      // boolean false
            Symbol('test'),             // symbol
            BigInt(123456789012345),    // bigint
            function() { return 'test'; }, // function
            new Date(),                 // date object
            /regex/gi,                  // regex
            new Error('test error'),    // error object
            { circular: null },         // object (will be made circular)
            [1, 2, 3]                  // array
          ];

          // Make one object circular
          edgeCases[16].circular = edgeCases[16];

          // Test all console methods
          console.log('log with edge cases:', ...edgeCases);
          console.info('info with edge cases:', ...edgeCases);
          console.warn('warn with edge cases:', ...edgeCases);
          console.error('error with edge cases:', ...edgeCases);
          console.debug('debug with edge cases:', ...edgeCases);

          // Test console methods individually with problematic values
          console.log(edgeCases[1]); // null
          console.info(edgeCases[2]); // undefined
          console.warn(edgeCases[3]); // NaN
          console.error(edgeCases[17]); // error object
          console.debug(edgeCases[16]); // circular object
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 200));

      const messages = session.getCapturedConsoleMessages();

      // Should have captured all console method calls
      const logMessages = messages.filter(m => m.type === 'log');
      const infoMessages = messages.filter(m => m.type === 'info');
      const warnMessages = messages.filter(m => m.type === 'warn');
      const errorMessages = messages.filter(m => m.type === 'error');
      const debugMessages = messages.filter(m => m.type === 'debug');

      expect(logMessages.length).toBeGreaterThanOrEqual(2); // Bulk + individual
      expect(infoMessages.length).toBeGreaterThanOrEqual(2);
      expect(warnMessages.length).toBeGreaterThanOrEqual(2);
      expect(errorMessages.length).toBeGreaterThanOrEqual(2);
      expect(debugMessages.length).toBeGreaterThanOrEqual(2);

      // All messages should be properly structured
      messages.forEach(message => {
        expect(message.args).toBeDefined();
        expect(message.text).toBeDefined();
        expect(message.timestamp).toBeGreaterThan(0);
        expect(['log', 'info', 'warn', 'error', 'debug']).toContain(message.type);
      });

      // Verify the bulk messages have many arguments
      const bulkLogMessage = logMessages.find(m => m.text.includes('log with edge cases:'));
      if (bulkLogMessage) {
        expect(bulkLogMessage.args.length).toBeGreaterThanOrEqual(18); // Message + edge cases
      }
    });
  });
});