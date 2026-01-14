/**
 * @apexcli/browser - Enhanced Console Integration Tests
 *
 * Comprehensive integration tests with real browser capturing console.log/warn/error
 * Extends existing console capture tests with additional scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';
import type { CapturedConsoleMessage } from '../types.js';

describe('Enhanced Console Integration Tests', () => {
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

  describe('Advanced Console Method Capture', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        consoleLevels: ['log', 'warn', 'error', 'info', 'debug', 'assert', 'table', 'dir', 'trace'],
        includeStackTraces: true,
      });
      await session.launch();
    });

    it('should capture console.assert messages', async () => {
      const html = `
        <script>
          console.assert(false, 'Assertion failed message');
          console.assert(true, 'This should not appear');
          console.assert(1 === 2, 'Math is broken', { value: 42 });
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const assertMessages = messages.filter(m => m.type === 'assert');

      expect(assertMessages.length).toBeGreaterThanOrEqual(2);

      const firstAssert = assertMessages.find(m => m.text.includes('Assertion failed message'));
      const secondAssert = assertMessages.find(m => m.text.includes('Math is broken'));

      expect(firstAssert).toBeDefined();
      expect(secondAssert).toBeDefined();

      // Should not capture the successful assertion
      const successfulAssert = assertMessages.find(m => m.text.includes('This should not appear'));
      expect(successfulAssert).toBeUndefined();
    });

    it('should capture console.table messages', async () => {
      const html = `
        <script>
          const tableData = [
            { name: 'Alice', age: 30, city: 'New York' },
            { name: 'Bob', age: 25, city: 'San Francisco' },
            { name: 'Charlie', age: 35, city: 'Chicago' }
          ];
          console.table(tableData);
          console.table(tableData, ['name', 'age']);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const tableMessages = messages.filter(m => m.type === 'table');

      expect(tableMessages.length).toBeGreaterThanOrEqual(2);

      tableMessages.forEach(message => {
        expect(message.type).toBe('table');
        expect(message.args).toBeDefined();
        expect(message.timestamp).toBeGreaterThan(0);
      });
    });

    it('should capture console.dir messages', async () => {
      const html = `
        <script>
          const complexObject = {
            name: 'TestObject',
            methods: {
              getName() { return this.name; },
              setName(name) { this.name = name; }
            },
            data: [1, 2, { nested: 'value' }]
          };
          console.dir(complexObject);
          console.dir(document.body);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const dirMessages = messages.filter(m => m.type === 'dir');

      expect(dirMessages.length).toBeGreaterThanOrEqual(2);

      dirMessages.forEach(message => {
        expect(message.type).toBe('dir');
        expect(message.args).toBeDefined();
        expect(message.args.length).toBeGreaterThan(0);
      });
    });

    it('should capture console.trace messages', async () => {
      const html = `
        <script>
          function level1() {
            level2();
          }

          function level2() {
            level3();
          }

          function level3() {
            console.trace('Trace from level3');
          }

          level1();
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const traceMessages = messages.filter(m => m.type === 'trace');

      expect(traceMessages.length).toBeGreaterThanOrEqual(1);

      const traceMessage = traceMessages.find(m => m.text.includes('Trace from level3'));
      expect(traceMessage).toBeDefined();
      expect(traceMessage!.type).toBe('trace');
    });

    it('should capture console group methods', async () => {
      const html = `
        <script>
          console.group('Main Group');
          console.log('Message in main group');
          console.groupCollapsed('Collapsed Group');
          console.log('Message in collapsed group');
          console.warn('Warning in collapsed group');
          console.groupEnd();
          console.log('Back in main group');
          console.groupEnd();
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const groupMessages = messages.filter(m =>
        m.type === 'startGroup' ||
        m.type === 'startGroupCollapsed' ||
        m.type === 'endGroup'
      );

      expect(groupMessages.length).toBeGreaterThanOrEqual(4);

      const startGroup = groupMessages.find(m => m.type === 'startGroup');
      const startGroupCollapsed = groupMessages.find(m => m.type === 'startGroupCollapsed');
      const endGroups = groupMessages.filter(m => m.type === 'endGroup');

      expect(startGroup).toBeDefined();
      expect(startGroupCollapsed).toBeDefined();
      expect(endGroups.length).toBeGreaterThanOrEqual(2);
    });

    it('should capture console.count and console.countReset', async () => {
      const html = `
        <script>
          console.count('myCounter');
          console.count('myCounter');
          console.count('anotherCounter');
          console.count('myCounter');
          console.countReset('myCounter');
          console.count('myCounter');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const countMessages = messages.filter(m => m.type === 'count');

      expect(countMessages.length).toBeGreaterThanOrEqual(5);

      countMessages.forEach(message => {
        expect(message.type).toBe('count');
        expect(message.text).toBeDefined();
      });
    });

    it('should capture console timing methods', async () => {
      const html = `
        <script>
          console.time('operationTimer');

          // Simulate some work
          let sum = 0;
          for (let i = 0; i < 1000; i++) {
            sum += i;
          }

          console.timeLog('operationTimer', 'Checkpoint reached');

          // More work
          for (let i = 0; i < 1000; i++) {
            sum += i;
          }

          console.timeEnd('operationTimer');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const timeMessages = messages.filter(m => m.type === 'timeEnd');

      expect(timeMessages.length).toBeGreaterThanOrEqual(1);

      const timeEndMessage = timeMessages.find(m => m.text.includes('operationTimer'));
      expect(timeEndMessage).toBeDefined();
      expect(timeEndMessage!.type).toBe('timeEnd');
    });
  });

  describe('Console Message Content Validation', () => {
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

    it('should capture formatted string messages', async () => {
      const html = `
        <script>
          console.log('User %s has %d points', 'Alice', 150);
          console.log('Progress: %c%s%c', 'color: green; font-weight: bold', '85%', 'color: black');
          console.log('%o', { name: 'Object', value: 42 });
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const logMessages = messages.filter(m => m.type === 'log');

      expect(logMessages.length).toBeGreaterThanOrEqual(3);

      const userMessage = logMessages.find(m => m.text.includes('User Alice has 150 points'));
      const progressMessage = logMessages.find(m => m.text.includes('Progress:'));
      const objectMessage = logMessages.find(m => m.args.length > 0);

      expect(userMessage).toBeDefined();
      expect(progressMessage).toBeDefined();
      expect(objectMessage).toBeDefined();

      // Check that arguments are preserved
      expect(userMessage!.args).toContain('User %s has %d points');
      expect(userMessage!.args).toContain('Alice');
      expect(userMessage!.args).toContain(150);
    });

    it('should capture console messages with binary data', async () => {
      const html = `
        <script>
          const buffer = new ArrayBuffer(16);
          const view = new Uint8Array(buffer);
          view.fill(42);

          console.log('ArrayBuffer:', buffer);
          console.log('Uint8Array:', view);

          const blob = new Blob(['Hello, World!'], { type: 'text/plain' });
          console.log('Blob:', blob);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const logMessages = messages.filter(m => m.type === 'log');

      expect(logMessages.length).toBeGreaterThanOrEqual(3);

      const bufferMessage = logMessages.find(m => m.text.includes('ArrayBuffer:'));
      const viewMessage = logMessages.find(m => m.text.includes('Uint8Array:'));
      const blobMessage = logMessages.find(m => m.text.includes('Blob:'));

      expect(bufferMessage).toBeDefined();
      expect(viewMessage).toBeDefined();
      expect(blobMessage).toBeDefined();

      // Verify that binary objects don't crash the capture system
      expect(bufferMessage!.args).toBeDefined();
      expect(viewMessage!.args).toBeDefined();
      expect(blobMessage!.args).toBeDefined();
    });

    it('should capture console messages with function references', async () => {
      const html = `
        <script>
          function namedFunction() {
            return 'I am a named function';
          }

          const arrowFunction = (x) => x * 2;
          const asyncFunction = async () => 'async result';

          console.log('Named function:', namedFunction);
          console.log('Arrow function:', arrowFunction);
          console.log('Async function:', asyncFunction);
          console.log('Built-in function:', Math.random);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const logMessages = messages.filter(m => m.type === 'log');

      expect(logMessages.length).toBeGreaterThanOrEqual(4);

      const namedFuncMessage = logMessages.find(m => m.text.includes('Named function:'));
      const arrowFuncMessage = logMessages.find(m => m.text.includes('Arrow function:'));
      const asyncFuncMessage = logMessages.find(m => m.text.includes('Async function:'));
      const builtinFuncMessage = logMessages.find(m => m.text.includes('Built-in function:'));

      expect(namedFuncMessage).toBeDefined();
      expect(arrowFuncMessage).toBeDefined();
      expect(asyncFuncMessage).toBeDefined();
      expect(builtinFuncMessage).toBeDefined();

      // Verify function references are captured
      expect(namedFuncMessage!.args).toBeDefined();
      expect(arrowFuncMessage!.args).toBeDefined();
      expect(asyncFuncMessage!.args).toBeDefined();
      expect(builtinFuncMessage!.args).toBeDefined();
    });
  });

  describe('Cross-Browser Console Compatibility', () => {
    const browserTypes = ['chromium', 'firefox', 'webkit'] as const;

    browserTypes.forEach(browserType => {
      it(`should capture console messages consistently in ${browserType}`, async () => {
        session = new BrowserSession(manager, {
          browserType,
          headless: true,
        }, {
          captureConsole: true,
          captureErrors: true,
        });
        await session.launch();

        const html = `
          <script>
            console.log('Standard log message');
            console.warn('Standard warning');
            console.error('Standard error');
            console.info('Standard info');
          </script>
        `;
        await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

        await new Promise(resolve => setTimeout(resolve, 150));

        const messages = session.getCapturedConsoleMessages();

        expect(messages.length).toBeGreaterThanOrEqual(4);

        const logMessage = messages.find(m => m.type === 'log' && m.text.includes('Standard log message'));
        const warnMessage = messages.find(m => m.type === 'warn' && m.text.includes('Standard warning'));
        const errorMessage = messages.find(m => m.type === 'error' && m.text.includes('Standard error'));
        const infoMessage = messages.find(m => m.type === 'info' && m.text.includes('Standard info'));

        expect(logMessage).toBeDefined();
        expect(warnMessage).toBeDefined();
        expect(errorMessage).toBeDefined();
        expect(infoMessage).toBeDefined();

        // Verify consistent structure across browsers
        [logMessage, warnMessage, errorMessage, infoMessage].forEach(message => {
          expect(message!.timestamp).toBeGreaterThan(0);
          expect(message!.args).toBeDefined();
          expect(Array.isArray(message!.args)).toBe(true);
        });
      });
    });
  });

  describe('Real-time Console Streaming', () => {
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

    it('should stream console messages in real-time with precise timing', async () => {
      const capturedEvents: Array<{ message: CapturedConsoleMessage; captureTime: number }> = [];

      session.on('consoleMessage', (message) => {
        capturedEvents.push({
          message,
          captureTime: Date.now(),
        });
      });

      const startTime = Date.now();
      const html = `
        <script>
          const startTime = Date.now();

          setTimeout(() => console.log('Message at 50ms'), 50);
          setTimeout(() => console.log('Message at 100ms'), 100);
          setTimeout(() => console.log('Message at 150ms'), 150);
          setTimeout(() => console.log('Message at 200ms'), 200);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 400));

      expect(capturedEvents.length).toBeGreaterThanOrEqual(4);

      // Verify messages were captured in roughly the correct order
      const sortedEvents = capturedEvents.sort((a, b) => a.message.timestamp - b.message.timestamp);

      for (let i = 1; i < sortedEvents.length; i++) {
        expect(sortedEvents[i].message.timestamp).toBeGreaterThanOrEqual(
          sortedEvents[i - 1].message.timestamp
        );
      }

      // Verify timing accuracy
      const timedMessages = sortedEvents.filter(e => e.message.text.includes('Message at'));
      expect(timedMessages.length).toBe(4);

      timedMessages.forEach((event, index) => {
        const expectedDelay = 50 * (index + 1);
        const actualDelay = event.message.timestamp - startTime;

        // Allow for some timing variance (±50ms)
        expect(actualDelay).toBeGreaterThanOrEqual(expectedDelay - 50);
        expect(actualDelay).toBeLessThanOrEqual(expectedDelay + 100);
      });
    });

    it('should handle rapid console message bursts in real-time', async () => {
      const capturedEvents: CapturedConsoleMessage[] = [];
      let eventCounter = 0;

      session.on('consoleMessage', (message) => {
        eventCounter++;
        capturedEvents.push(message);
      });

      const html = `
        <script>
          // Generate rapid burst of messages
          for (let i = 0; i < 50; i++) {
            console.log('Rapid message ' + i);
          }
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Wait for all events to be processed
      await new Promise(resolve => setTimeout(resolve, 300));

      expect(eventCounter).toBeGreaterThanOrEqual(40); // Allow for some loss in rapid bursts
      expect(capturedEvents.length).toBeGreaterThanOrEqual(40);

      // Verify events are in order
      for (let i = 1; i < capturedEvents.length; i++) {
        expect(capturedEvents[i].timestamp).toBeGreaterThanOrEqual(
          capturedEvents[i - 1].timestamp
        );
      }

      // Verify content integrity
      const rapidMessages = capturedEvents.filter(e => e.text.includes('Rapid message'));
      expect(rapidMessages.length).toBeGreaterThanOrEqual(40);
    });
  });

  describe('Memory and Performance Impact', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        maxBufferSize: 1000, // Large buffer for performance testing
      });
      await session.launch();
    });

    it('should handle high-volume console output without memory leaks', async () => {
      const html = `
        <script>
          // Generate high volume of console messages
          function generateMessages() {
            for (let i = 0; i < 500; i++) {
              console.log('High volume message ' + i, {
                data: 'x'.repeat(1000),
                timestamp: Date.now(),
                index: i
              });
            }
          }

          // Generate messages in chunks to avoid blocking
          let chunkCount = 0;
          const interval = setInterval(() => {
            generateMessages();
            chunkCount++;
            if (chunkCount >= 3) {
              clearInterval(interval);
            }
          }, 100);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 1000));

      const messages = session.getCapturedConsoleMessages();

      // Should respect buffer limits
      expect(messages.length).toBeLessThanOrEqual(1000);
      expect(messages.length).toBeGreaterThan(900);

      // Verify messages are from the latest chunks (buffer management working)
      const highVolumeMessages = messages.filter(m => m.text.includes('High volume message'));
      expect(highVolumeMessages.length).toBeGreaterThan(900);

      // Check that the most recent messages are preserved
      const lastMessage = messages[messages.length - 1];
      expect(lastMessage.text).toMatch(/High volume message \d+/);
    });

    it('should maintain performance with complex object logging', async () => {
      const html = `
        <script>
          function createComplexObject(depth = 5) {
            if (depth === 0) return { value: Math.random() };

            return {
              level: depth,
              data: 'x'.repeat(100),
              children: Array(10).fill(null).map(() => createComplexObject(depth - 1)),
              timestamp: Date.now(),
              metadata: {
                browser: navigator.userAgent,
                url: window.location.href,
                date: new Date().toISOString()
              }
            };
          }

          for (let i = 0; i < 100; i++) {
            const complexObj = createComplexObject(3);
            console.log('Complex object ' + i + ':', complexObj);
          }
        </script>
      `;

      const startTime = Date.now();
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 500));

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should complete processing within reasonable time
      expect(processingTime).toBeLessThan(2000);

      const messages = session.getCapturedConsoleMessages();
      expect(messages.length).toBeGreaterThanOrEqual(90);

      const complexMessages = messages.filter(m => m.text.includes('Complex object'));
      expect(complexMessages.length).toBeGreaterThanOrEqual(90);

      // Verify that complex objects don't break the capture system
      complexMessages.forEach(message => {
        expect(message.args).toBeDefined();
        expect(message.args.length).toBeGreaterThanOrEqual(2);
        expect(message.timestamp).toBeGreaterThan(0);
      });
    });
  });
});