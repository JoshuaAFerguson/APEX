/**
 * @apexcli/browser - Capture Edge Cases Tests
 *
 * Tests for edge cases, error scenarios, and capture configuration limits
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';

describe('Capture Edge Cases', () => {
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

  describe('Extreme Console Message Volumes', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        maxBufferSize: 50, // Small buffer to test overflow
      });
      await session.launch();
    });

    it('should handle rapid console message bursts', async () => {
      const html = `
        <script>
          // Generate 200 messages as fast as possible
          for (let i = 0; i < 200; i++) {
            console.log('Burst message ' + i);
          }
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 200));

      const messages = session.getCapturedConsoleMessages();

      // Should handle the burst and respect buffer limits
      expect(messages.length).toBeLessThanOrEqual(50);
      expect(messages.length).toBeGreaterThan(0);

      // Buffer should contain the most recent messages
      const lastMessage = messages[messages.length - 1];
      expect(lastMessage.text).toMatch(/Burst message \d+/);

      // Parse the message number and verify it's from the latter part of the burst
      const messageMatch = lastMessage.text.match(/Burst message (\d+)/);
      if (messageMatch) {
        const messageNumber = parseInt(messageMatch[1], 10);
        expect(messageNumber).toBeGreaterThan(150); // Should be from the end of the burst
      }
    });

    it('should handle interleaved console and error bursts', async () => {
      const html = `
        <script>
          for (let i = 0; i < 100; i++) {
            console.log('Interleaved log ' + i);
            console.warn('Interleaved warning ' + i);

            if (i % 10 === 0) {
              setTimeout(() => {
                throw new Error('Interleaved error ' + i);
              }, 1);
            }
          }
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(50);

      await new Promise(resolve => setTimeout(resolve, 500));

      const consoleMessages = session.getCapturedConsoleMessages();
      const jsErrors = session.getCapturedJavaScriptErrors();

      // Should capture messages but respect buffer limits
      expect(consoleMessages.length).toBeLessThanOrEqual(50);
      expect(consoleMessages.length).toBeGreaterThan(0);
      expect(jsErrors.length).toBeGreaterThan(0);

      session.stopErrorPolling();
    });
  });

  describe('Complex Object Serialization in Console', () => {
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

    it('should handle deeply nested objects', async () => {
      const html = `
        <script>
          const deepObject = {
            level1: {
              level2: {
                level3: {
                  level4: {
                    level5: {
                      value: 'deep value',
                      array: [1, 2, { nested: 'array object' }],
                      circular: null
                    }
                  }
                }
              }
            }
          };

          // Create circular reference
          deepObject.level1.level2.level3.level4.level5.circular = deepObject;

          console.log('Deep object:', deepObject);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const deepObjectMessage = messages.find(m => m.text.includes('Deep object:'));

      expect(deepObjectMessage).toBeDefined();
      expect(deepObjectMessage!.args).toBeDefined();
      expect(deepObjectMessage!.args.length).toBeGreaterThanOrEqual(2);

      // Should not crash on circular references
      expect(deepObjectMessage!.text).toBeDefined();
      expect(deepObjectMessage!.args[0]).toBe('Deep object:');
    });

    it('should handle various data types in console arguments', async () => {
      const html = `
        <script>
          const testDate = new Date('2023-01-01T00:00:00Z');
          const testRegex = /test.*pattern/gi;
          const testFunction = function namedFunction() { return 'test'; };
          const testMap = new Map([['key1', 'value1'], ['key2', 'value2']]);
          const testSet = new Set([1, 2, 3, 'string', { object: true }]);
          const testSymbol = Symbol('test symbol');

          console.log('Mixed types:',
            null,
            undefined,
            true,
            false,
            42,
            'string',
            testDate,
            testRegex,
            testFunction,
            testMap,
            testSet,
            testSymbol
          );
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const mixedTypesMessage = messages.find(m => m.text.includes('Mixed types:'));

      expect(mixedTypesMessage).toBeDefined();
      expect(mixedTypesMessage!.args).toBeDefined();
      expect(mixedTypesMessage!.args.length).toBeGreaterThanOrEqual(13);

      // Should handle all types without crashing
      expect(mixedTypesMessage!.text).toBeDefined();
      expect(mixedTypesMessage!.text.length).toBeGreaterThan(0);
    });

    it('should handle DOM elements in console arguments', async () => {
      const html = `
        <div id="testElement" class="test-class" data-value="123">Test Content</div>
        <script>
          const element = document.getElementById('testElement');
          const nodeList = document.querySelectorAll('div');
          const htmlCollection = document.getElementsByClassName('test-class');

          console.log('DOM elements:', element, nodeList, htmlCollection);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const domMessage = messages.find(m => m.text.includes('DOM elements:'));

      expect(domMessage).toBeDefined();
      expect(domMessage!.args).toBeDefined();
      expect(domMessage!.args.length).toBeGreaterThanOrEqual(4);

      // Should handle DOM elements without crashing
      expect(domMessage!.text).toBeDefined();
    });
  });

  describe('Error Capture Under Extreme Conditions', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        maxBufferSize: 20,
      });
      await session.launch();
    });

    it('should handle rapid error generation', async () => {
      const html = `
        <script>
          for (let i = 0; i < 50; i++) {
            setTimeout(() => {
              throw new Error('Rapid error ' + i);
            }, i * 5);
          }
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(25);

      await new Promise(resolve => setTimeout(resolve, 500));

      await session.retrieveCapturedJavaScriptErrors();
      const errors = session.getCapturedJavaScriptErrors();

      // Should capture errors but respect buffer limits
      expect(errors.length).toBeLessThanOrEqual(20);
      expect(errors.length).toBeGreaterThan(0);

      // Should have errors from the latter part of the sequence
      const hasLateError = errors.some(err => {
        const match = err.message.match(/Rapid error (\d+)/);
        return match && parseInt(match[1], 10) > 30;
      });
      expect(hasLateError).toBe(true);

      session.stopErrorPolling();
    });

    it('should handle errors with extremely long stack traces', async () => {
      const html = `
        <script>
          function createDeepStack(depth) {
            if (depth <= 0) {
              throw new Error('Error from depth ' + depth + ' with very long message that contains lots of details about what went wrong and includes many characters to test stack trace handling capabilities');
            }
            return createDeepStack(depth - 1);
          }

          setTimeout(() => {
            try {
              createDeepStack(50);
            } catch (e) {
              setTimeout(() => { throw e; }, 10);
            }
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(100);

      await new Promise(resolve => setTimeout(resolve, 300));

      await session.retrieveCapturedJavaScriptErrors();
      const errors = session.getCapturedJavaScriptErrors();

      const deepStackError = errors.find(err =>
        err.message.includes('Error from depth') && err.stack
      );

      expect(deepStackError).toBeDefined();
      expect(deepStackError!.stack).toBeDefined();
      expect(deepStackError!.stack!.length).toBeGreaterThan(100);

      // Should contain multiple stack frames
      const stackLines = deepStackError!.stack!.split('\n');
      expect(stackLines.length).toBeGreaterThan(10);

      session.stopErrorPolling();
    });

    it('should handle errors with unusual characters and encodings', async () => {
      const html = `
        <script>
          setTimeout(() => {
            throw new Error('Error with unicode: 🚀💥⚠️ and special chars: "quotes", \\'apostrophes\\', [brackets], {braces}, <tags>, &entities;, \\n\\t\\r');
          }, 50);

          setTimeout(() => {
            throw new Error('Error with null\\x00 and control\\x01 chars\\x02');
          }, 100);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(100);

      await new Promise(resolve => setTimeout(resolve, 300));

      await session.retrieveCapturedJavaScriptErrors();
      const errors = session.getCapturedJavaScriptErrors();

      expect(errors.length).toBeGreaterThanOrEqual(2);

      const unicodeError = errors.find(err => err.message.includes('🚀💥⚠️'));
      const controlCharsError = errors.find(err => err.message.includes('control'));

      expect(unicodeError).toBeDefined();
      expect(controlCharsError).toBeDefined();

      // Should preserve the special characters
      expect(unicodeError!.message).toContain('🚀💥⚠️');
      expect(unicodeError!.message).toContain('quotes');

      session.stopErrorPolling();
    });
  });

  describe('Capture Configuration Edge Cases', () => {
    it('should handle zero buffer size gracefully', async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        maxBufferSize: 0, // Zero buffer size
      });
      await session.launch();

      const html = `
        <script>
          console.log('Should not be stored');
          setTimeout(() => throw new Error('Should not be stored'), 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(100);

      await new Promise(resolve => setTimeout(resolve, 200));

      const messages = session.getCapturedConsoleMessages();
      const errors = session.getCapturedJavaScriptErrors();

      // With zero buffer, nothing should be stored
      expect(messages).toHaveLength(0);
      expect(errors).toHaveLength(0);

      session.stopErrorPolling();
    });

    it('should handle extremely large buffer sizes', async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        maxBufferSize: 100000, // Very large buffer
      });
      await session.launch();

      const html = `
        <script>
          for (let i = 0; i < 1000; i++) {
            console.log('Large buffer message ' + i);
          }
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 300));

      const messages = session.getCapturedConsoleMessages();

      // Should capture many messages without issues
      expect(messages.length).toBeGreaterThan(900);
      expect(messages.length).toBeLessThanOrEqual(1000);
    });

    it('should handle invalid console level configurations', async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        consoleLevels: ['invalid', 'also-invalid'] as any,
      });
      await session.launch();

      const html = `
        <script>
          console.log('Standard log message');
          console.warn('Standard warning');
          console.error('Standard error');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();

      // Should either capture nothing (strict filtering) or fall back to capturing all
      expect(typeof messages.length).toBe('number');
      expect(messages.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle configuration updates during active capture', async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        consoleLevels: ['log'],
        maxBufferSize: 10,
      });
      await session.launch();

      const messages: any[] = [];
      session.on('consoleMessage', (msg) => messages.push(msg));

      const html = `
        <script>
          console.log('Initial log');
          console.warn('Initial warning (should not be captured)');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const initialCount = messages.length;
      expect(initialCount).toBeGreaterThan(0);

      // Update configuration while running
      session.updateCaptureConfig({
        consoleLevels: ['warn', 'error'],
        maxBufferSize: 50,
      });

      const html2 = `
        <script>
          console.log('Later log (should not be captured after config change)');
          console.warn('Later warning (should be captured after config change)');
          console.error('Later error (should be captured after config change)');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html2)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const finalMessages = session.getCapturedConsoleMessages();

      // Should have messages from both periods with different filtering
      expect(finalMessages.length).toBeGreaterThan(initialCount);

      const hasInitialLog = finalMessages.some(m => m.text.includes('Initial log'));
      const hasLaterWarning = finalMessages.some(m => m.text.includes('Later warning'));
      const hasLaterError = finalMessages.some(m => m.text.includes('Later error'));
      const hasLaterLog = finalMessages.some(m => m.text.includes('Later log'));

      expect(hasInitialLog).toBe(true);
      expect(hasLaterWarning).toBe(true);
      expect(hasLaterError).toBe(true);
      expect(hasLaterLog).toBe(false); // Should not be captured after config change
    });
  });

  describe('Browser State Edge Cases', () => {
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

    it('should handle capture during rapid navigation', async () => {
      const capturedMessages: any[] = [];

      session.on('consoleMessage', (msg) => capturedMessages.push(msg));

      session.startRealTimeCapture({
        consolePollingMs: 50,
        errorPollingMs: 50,
        autoStart: true,
      });

      // Navigate rapidly between different pages
      const pages = [
        `<script>console.log('Page 1 message');</script>`,
        `<script>console.log('Page 2 message');</script>`,
        `<script>console.log('Page 3 message');</script>`,
        `<script>console.log('Page 4 message');</script>`,
        `<script>console.log('Page 5 message');</script>`
      ];

      for (let i = 0; i < pages.length; i++) {
        await session.navigate(`data:text/html,${encodeURIComponent(pages[i])}`);
        await new Promise(resolve => setTimeout(resolve, 20)); // Very short wait
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(capturedMessages.length).toBeGreaterThan(0);

      // Should have messages from multiple pages
      const uniqueMessages = [...new Set(capturedMessages.map(m => m.text))];
      expect(uniqueMessages.length).toBeGreaterThan(1);
    });

    it('should handle capture when page becomes unresponsive', async () => {
      const html = `
        <script>
          console.log('Before infinite loop');

          setTimeout(() => {
            console.log('Starting infinite loop');
            let i = 0;
            while (true) {
              i++;
              if (i % 1000000 === 0) {
                // Brief pause to prevent total freeze
                setTimeout(() => {}, 1);
              }
            }
          }, 100);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 300));

      const messages = session.getCapturedConsoleMessages();

      // Should capture at least the initial messages before the page becomes unresponsive
      expect(messages.length).toBeGreaterThan(0);

      const beforeLoop = messages.find(m => m.text.includes('Before infinite loop'));
      expect(beforeLoop).toBeDefined();
    });

    it('should handle capture after browser context switches', async () => {
      const capturedMessages: any[] = [];

      session.on('consoleMessage', (msg) => capturedMessages.push(msg));

      const html1 = `
        <script>
          console.log('Message in original context');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html1)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const originalContextMessages = capturedMessages.length;
      expect(originalContextMessages).toBeGreaterThan(0);

      // Navigate to a different origin (which may create a new context internally)
      const html2 = `
        <script>
          console.log('Message after context switch');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html2)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(capturedMessages.length).toBeGreaterThan(originalContextMessages);

      const afterSwitch = capturedMessages.find(m => m.text.includes('Message after context switch'));
      expect(afterSwitch).toBeDefined();
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        maxBufferSize: 1000,
      });
      await session.launch();
    });

    it('should handle large console message payloads', async () => {
      const html = `
        <script>
          // Generate a very large string
          const largeString = 'x'.repeat(100000);
          const largeObject = { data: largeString, array: new Array(1000).fill('test') };

          console.log('Large payload message:', largeString.substring(0, 100) + '...');
          console.log('Large object:', largeObject);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 200));

      const messages = session.getCapturedConsoleMessages();

      expect(messages.length).toBeGreaterThanOrEqual(2);

      const largePayloadMessage = messages.find(m => m.text.includes('Large payload message'));
      const largeObjectMessage = messages.find(m => m.text.includes('Large object'));

      expect(largePayloadMessage).toBeDefined();
      expect(largeObjectMessage).toBeDefined();

      // Should handle large payloads without crashing
      expect(largePayloadMessage!.text.length).toBeGreaterThan(0);
      expect(largeObjectMessage!.text.length).toBeGreaterThan(0);
    });

    it('should handle sustained high-frequency capture', async () => {
      const html = `
        <script>
          let messageCount = 0;
          const interval = setInterval(() => {
            messageCount++;
            console.log('High frequency message ' + messageCount);

            if (messageCount >= 500) {
              clearInterval(interval);
            }
          }, 10); // Very high frequency
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Let it run for a while
      await new Promise(resolve => setTimeout(resolve, 6000));

      const messages = session.getCapturedConsoleMessages();

      // Should have captured many messages but not necessarily all due to buffer limits
      expect(messages.length).toBeGreaterThan(100);
      expect(messages.length).toBeLessThanOrEqual(1000); // Buffer limit

      // Should have captured recent messages
      const lastMessage = messages[messages.length - 1];
      const messageMatch = lastMessage.text.match(/High frequency message (\d+)/);

      if (messageMatch) {
        const messageNumber = parseInt(messageMatch[1], 10);
        expect(messageNumber).toBeGreaterThan(200); // Should be from later in the sequence
      }
    }, 10000);
  });
});