/**
 * @apexcli/browser - Malformed Console Edge Cases Tests
 *
 * Tests for malformed/edge case console outputs and error scenarios
 * that could break console capture or cause unexpected behavior
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';
import type { CapturedConsoleMessage, CapturedJavaScriptError } from '../types.js';

describe('Malformed Console Edge Cases Tests', () => {
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

  describe('Malformed Object Serialization', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        includeStackTraces: true,
      });
      await session.launch();
    });

    it('should handle circular reference objects without crashing', async () => {
      const html = `
        <script>
          const circularObj = { name: 'circular' };
          circularObj.self = circularObj;
          circularObj.nested = { parent: circularObj };

          console.log('Circular object:', circularObj);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const circularMessage = messages.find(m => m.text.includes('Circular object:'));

      expect(circularMessage).toBeDefined();
      expect(circularMessage!.type).toBe('log');
      expect(circularMessage!.args).toBeDefined();
      expect(circularMessage!.text).toBeDefined();

      // Should not crash or throw errors during serialization
      expect(() => JSON.stringify(circularMessage)).not.toThrow();
    });

    it('should handle objects with getters that throw errors', async () => {
      const html = `
        <script>
          const problematicObj = {
            normalProp: 'normal value',
            get throwingGetter() {
              throw new Error('Getter error');
            },
            get circularGetter() {
              return this;
            }
          };

          console.log('Problematic object:', problematicObj);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const problematicMessage = messages.find(m => m.text.includes('Problematic object:'));

      expect(problematicMessage).toBeDefined();
      expect(problematicMessage!.args).toBeDefined();
      expect(problematicMessage!.text).toBeDefined();

      // Should handle the problematic object gracefully
      expect(problematicMessage!.args.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle objects with Symbol properties', async () => {
      const html = `
        <script>
          const symbolKey = Symbol('secret');
          const symbolIterator = Symbol.iterator;

          const objWithSymbols = {
            normalProp: 'visible',
            [symbolKey]: 'hidden value',
            [symbolIterator]: function* () {
              yield 'first';
              yield 'second';
            }
          };

          console.log('Object with symbols:', objWithSymbols);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const symbolMessage = messages.find(m => m.text.includes('Object with symbols:'));

      expect(symbolMessage).toBeDefined();
      expect(symbolMessage!.args).toBeDefined();
      expect(symbolMessage!.text).toBeDefined();
    });

    it('should handle objects with prototype pollution attempts', async () => {
      const html = `
        <script>
          const maliciousObj = {
            constructor: {
              prototype: {
                isAdmin: true
              }
            },
            __proto__: {
              polluted: 'dangerous value'
            }
          };

          console.log('Potentially malicious object:', maliciousObj);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const maliciousMessage = messages.find(m => m.text.includes('Potentially malicious object:'));

      expect(maliciousMessage).toBeDefined();
      expect(maliciousMessage!.args).toBeDefined();

      // Should capture the object safely without executing harmful code
      expect(maliciousMessage!.text).toBeDefined();
    });
  });

  describe('Large and Extreme Data Edge Cases', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        maxBufferSize: 100, // Limited buffer for testing
      });
      await session.launch();
    });

    it('should handle extremely large strings in console output', async () => {
      const html = `
        <script>
          const hugeString = 'A'.repeat(1000000); // 1MB string
          console.log('Huge string:', hugeString);

          const anotherHugeString = 'B'.repeat(500000);
          console.warn('Another huge string:', anotherHugeString);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 200));

      const messages = session.getCapturedConsoleMessages();
      const hugeStringMessage = messages.find(m => m.text.includes('Huge string:'));
      const anotherHugeMessage = messages.find(m => m.text.includes('Another huge string:'));

      expect(hugeStringMessage || anotherHugeMessage).toBeDefined();

      if (hugeStringMessage) {
        expect(hugeStringMessage.args).toBeDefined();
        expect(hugeStringMessage.text).toBeDefined();
      }

      if (anotherHugeMessage) {
        expect(anotherHugeMessage.args).toBeDefined();
        expect(anotherHugeMessage.text).toBeDefined();
      }
    });

    it('should handle deeply nested arrays and objects', async () => {
      const html = `
        <script>
          function createDeepStructure(depth) {
            if (depth === 0) return 'leaf';
            return {
              level: depth,
              nested: createDeepStructure(depth - 1),
              array: [createDeepStructure(depth - 1), createDeepStructure(depth - 1)]
            };
          }

          const deepStructure = createDeepStructure(50);
          console.log('Deep structure:', deepStructure);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 200));

      const messages = session.getCapturedConsoleMessages();
      const deepMessage = messages.find(m => m.text.includes('Deep structure:'));

      expect(deepMessage).toBeDefined();
      expect(deepMessage!.args).toBeDefined();

      // Should not crash on deep structures
      expect(deepMessage!.text).toBeDefined();
    });

    it('should handle arrays with sparse elements and holes', async () => {
      const html = `
        <script>
          const sparseArray = new Array(100);
          sparseArray[0] = 'first';
          sparseArray[50] = 'middle';
          sparseArray[99] = 'last';

          console.log('Sparse array:', sparseArray);

          const holeyArray = [1, 2, , , 5, , , 8];
          console.log('Holey array:', holeyArray);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const sparseMessage = messages.find(m => m.text.includes('Sparse array:'));
      const holeyMessage = messages.find(m => m.text.includes('Holey array:'));

      expect(sparseMessage).toBeDefined();
      expect(holeyMessage).toBeDefined();

      expect(sparseMessage!.args).toBeDefined();
      expect(holeyMessage!.args).toBeDefined();
    });
  });

  describe('Unicode and Character Encoding Edge Cases', () => {
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

    it('should handle various Unicode characters and emojis', async () => {
      const html = `
        <script>
          console.log('Unicode test: 🚀🌟⭐🎯🔥💯');
          console.log('Special chars: åäöñüéèàç');
          console.log('Mathematical symbols: ∑∏∫∆∇∂');
          console.log('Chinese: 你好世界');
          console.log('Japanese: こんにちは世界');
          console.log('Arabic: مرحبا بالعالم');
          console.log('Russian: Привет, мир');
          console.log('Combining characters: é (e + ́)');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();

      const unicodeMessages = messages.filter(m => m.text.includes('🚀') ||
        m.text.includes('åäö') ||
        m.text.includes('∑∏') ||
        m.text.includes('你好') ||
        m.text.includes('こんにちは') ||
        m.text.includes('مرحبا') ||
        m.text.includes('Привет'));

      expect(unicodeMessages.length).toBeGreaterThanOrEqual(6);

      unicodeMessages.forEach(message => {
        expect(message.text).toBeDefined();
        expect(message.args).toBeDefined();
        expect(message.timestamp).toBeGreaterThan(0);
      });
    });

    it('should handle control characters and escape sequences', async () => {
      const html = `
        <script>
          console.log('Control chars: \\x00\\x01\\x02\\x03\\x04\\x05');
          console.log('Escape sequences: \\n\\t\\r\\\\');
          console.log('Zero-width chars: ​‌‍'); // Zero-width space, non-joiner, joiner
          console.log('Byte order mark: \\uFEFF');
          console.log('Null character: \\u0000');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const controlCharMessages = messages.filter(m =>
        m.text.includes('Control chars:') ||
        m.text.includes('Escape sequences:') ||
        m.text.includes('Zero-width chars:') ||
        m.text.includes('Byte order mark:') ||
        m.text.includes('Null character:')
      );

      expect(controlCharMessages.length).toBeGreaterThanOrEqual(3);

      controlCharMessages.forEach(message => {
        expect(message.text).toBeDefined();
        expect(message.args).toBeDefined();
      });
    });

    it('should handle malformed Unicode sequences', async () => {
      const html = `
        <script>
          try {
            // Create potentially problematic Unicode strings
            const malformed1 = String.fromCharCode(0xD800); // Unpaired high surrogate
            const malformed2 = String.fromCharCode(0xDC00); // Unpaired low surrogate
            const malformed3 = String.fromCharCode(0xD800, 0x20, 0xDC00); // Interrupted surrogate pair

            console.log('Malformed Unicode 1:', malformed1);
            console.log('Malformed Unicode 2:', malformed2);
            console.log('Malformed Unicode 3:', malformed3);
          } catch (e) {
            console.log('Error handling malformed Unicode:', e.message);
          }
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const malformedMessages = messages.filter(m => m.text.includes('Malformed Unicode') ||
        m.text.includes('Error handling malformed'));

      expect(malformedMessages.length).toBeGreaterThanOrEqual(1);

      malformedMessages.forEach(message => {
        expect(message.text).toBeDefined();
        expect(message.args).toBeDefined();
      });
    });
  });

  describe('Browser API Edge Cases', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        includeStackTraces: true,
      });
      await session.launch();
    });

    it('should handle console methods being overridden', async () => {
      const html = `
        <script>
          // Save original console methods
          const originalLog = console.log;
          const originalWarn = console.warn;

          // Override console methods
          console.log = function(...args) {
            originalLog('OVERRIDDEN LOG:', ...args);
          };

          console.warn = function(...args) {
            originalWarn('OVERRIDDEN WARN:', ...args);
          };

          console.log('This should be overridden');
          console.warn('This warning should be overridden');

          // Restore original methods
          console.log = originalLog;
          console.warn = originalWarn;

          console.log('This should be normal');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const overriddenLogMessages = messages.filter(m => m.text.includes('OVERRIDDEN LOG:'));
      const overriddenWarnMessages = messages.filter(m => m.text.includes('OVERRIDDEN WARN:'));
      const normalMessages = messages.filter(m => m.text.includes('This should be normal'));

      expect(overriddenLogMessages.length).toBeGreaterThanOrEqual(1);
      expect(overriddenWarnMessages.length).toBeGreaterThanOrEqual(1);
      expect(normalMessages.length).toBeGreaterThanOrEqual(1);

      // Verify that overridden console methods are still captured
      overriddenLogMessages.forEach(message => {
        expect(message.type).toBe('log');
        expect(message.args).toBeDefined();
      });
    });

    it('should handle console methods being deleted or undefined', async () => {
      const html = `
        <script>
          // Save original console
          const originalConsole = { ...console };

          try {
            // Try to break console methods
            delete console.log;
            delete console.warn;

            // This should not crash the capture system
            if (typeof console.log === 'function') {
              console.log('This should not appear');
            } else {
              console.error('Console.log was deleted');
            }

            // Restore console
            console.log = originalConsole.log;
            console.warn = originalConsole.warn;

            console.log('Restored console functionality');
          } catch (e) {
            console.error('Error during console manipulation:', e.message);
          }
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();

      // Should handle the console manipulation gracefully
      expect(messages.length).toBeGreaterThan(0);

      const errorMessage = messages.find(m => m.text.includes('Console.log was deleted') ||
        m.text.includes('Error during console'));
      const restoredMessage = messages.find(m => m.text.includes('Restored console functionality'));

      expect(errorMessage || restoredMessage).toBeDefined();
    });

    it('should handle errors in console method arguments evaluation', async () => {
      const html = `
        <script>
          const problematicArg = {
            toString() {
              throw new Error('toString error');
            },
            valueOf() {
              throw new Error('valueOf error');
            }
          };

          try {
            console.log('Problematic argument:', problematicArg);
          } catch (e) {
            console.error('Caught console error:', e.message);
          }

          // Function that throws when called
          function throwingFunction() {
            throw new Error('Function call error');
          }

          try {
            console.log('Function result:', throwingFunction());
          } catch (e) {
            console.error('Caught function error:', e.message);
          }
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();

      const problematicMessage = messages.find(m => m.text.includes('Problematic argument:'));
      const errorMessages = messages.filter(m => m.text.includes('Caught console error:') ||
        m.text.includes('Caught function error:'));

      // Should handle problematic arguments gracefully
      expect(problematicMessage || errorMessages.length > 0).toBeTruthy();

      if (problematicMessage) {
        expect(problematicMessage.args).toBeDefined();
      }

      errorMessages.forEach(message => {
        expect(message.type).toBe('error');
        expect(message.args).toBeDefined();
      });
    });
  });

  describe('Memory and Resource Edge Cases', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        maxBufferSize: 10, // Very small buffer
      });
      await session.launch();
    });

    it('should handle buffer overflow gracefully', async () => {
      const html = `
        <script>
          // Generate more messages than the buffer can hold
          for (let i = 0; i < 50; i++) {
            console.log('Overflow message ' + i);
          }
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 200));

      const messages = session.getCapturedConsoleMessages();

      // Should respect buffer limit
      expect(messages.length).toBeLessThanOrEqual(10);
      expect(messages.length).toBeGreaterThan(0);

      // Should contain the most recent messages
      const hasRecentMessage = messages.some(m => {
        const match = m.text.match(/Overflow message (\d+)/);
        return match && parseInt(match[1]) >= 40;
      });

      expect(hasRecentMessage).toBe(true);
    });

    it('should handle rapid message generation without memory leaks', async () => {
      const html = `
        <script>
          // Generate rapid burst of messages
          let counter = 0;
          const interval = setInterval(() => {
            console.log('Rapid message', counter++, {
              timestamp: Date.now(),
              data: 'x'.repeat(1000)
            });

            if (counter >= 100) {
              clearInterval(interval);
            }
          }, 1);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 500));

      const messages = session.getCapturedConsoleMessages();

      // Should handle the rapid messages
      expect(messages.length).toBeLessThanOrEqual(10); // Buffer limit
      expect(messages.length).toBeGreaterThan(0);

      // Should not crash or run out of memory
      messages.forEach(message => {
        expect(message.text).toBeDefined();
        expect(message.args).toBeDefined();
        expect(message.timestamp).toBeGreaterThan(0);
      });
    });
  });

  describe('Concurrent Access and Race Conditions', () => {
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

    it('should handle concurrent console calls and buffer modifications', async () => {
      const html = `
        <script>
          // Simulate concurrent access to console from multiple sources
          setTimeout(() => console.log('Async log 1'), 10);
          setTimeout(() => console.warn('Async warn 1'), 15);
          setTimeout(() => console.error('Async error 1'), 20);

          // Immediate calls mixed with timeouts
          console.log('Immediate log 1');
          setTimeout(() => console.log('Async log 2'), 25);
          console.warn('Immediate warn 1');
          setTimeout(() => console.warn('Async warn 2'), 30);

          // Recursive timeout calls
          let recursiveCount = 0;
          function recursiveLog() {
            console.log('Recursive log', recursiveCount++);
            if (recursiveCount < 5) {
              setTimeout(recursiveLog, 5);
            }
          }
          setTimeout(recursiveLog, 35);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 300));

      const messages = session.getCapturedConsoleMessages();

      expect(messages.length).toBeGreaterThanOrEqual(8);

      const asyncLogs = messages.filter(m => m.text.includes('Async log'));
      const asyncWarns = messages.filter(m => m.text.includes('Async warn'));
      const asyncErrors = messages.filter(m => m.text.includes('Async error'));
      const recursiveLogs = messages.filter(m => m.text.includes('Recursive log'));

      expect(asyncLogs.length).toBeGreaterThanOrEqual(2);
      expect(asyncWarns.length).toBeGreaterThanOrEqual(2);
      expect(asyncErrors.length).toBeGreaterThanOrEqual(1);
      expect(recursiveLogs.length).toBeGreaterThanOrEqual(4);

      // Verify all messages have proper structure
      messages.forEach(message => {
        expect(message.type).toBeDefined();
        expect(message.text).toBeDefined();
        expect(message.args).toBeDefined();
        expect(message.timestamp).toBeGreaterThan(0);
      });
    });

    it('should handle console capture configuration changes during operation', async () => {
      const html = `
        <script>
          console.log('Message before config change');

          // Simulate config changes by changing what gets logged
          setTimeout(() => {
            console.warn('Warning during operation');
            console.error('Error during operation');
          }, 50);

          setTimeout(() => {
            console.log('Message after config change');
            console.info('Info message after config change');
          }, 100);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 75));

      // Simulate configuration change mid-operation
      session.updateCaptureConfig({
        captureConsole: true,
        consoleLevels: ['error', 'warn'], // Only capture errors and warnings
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const allMessages = session.getCapturedConsoleMessages();

      // Should have messages from before and after config change
      const beforeMessages = allMessages.filter(m => m.text.includes('Message before config'));
      const warningMessages = allMessages.filter(m => m.text.includes('Warning during operation'));
      const errorMessages = allMessages.filter(m => m.text.includes('Error during operation'));

      expect(beforeMessages.length).toBeGreaterThanOrEqual(1);
      expect(warningMessages.length).toBeGreaterThanOrEqual(1);
      expect(errorMessages.length).toBeGreaterThanOrEqual(1);

      // After config change, log and info messages might be filtered
      // This tests the robustness of the capture system during config changes
    });
  });
});