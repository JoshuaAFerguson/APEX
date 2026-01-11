/**
 * @apexcli/browser - Console Capture Tests
 *
 * Comprehensive tests for browser console message capture functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';
import type { CapturedConsoleMessage } from '../types.js';

describe('Console Capture', () => {
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

  describe('Basic Console Message Capture', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        consoleLevels: ['log', 'warn', 'error', 'info', 'debug'],
      });
      await session.launch();
    });

    it('should capture console.log messages', async () => {
      const html = `
        <script>
          console.log('Test log message');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const logMessage = messages.find(m => m.type === 'log' && m.text.includes('Test log message'));

      expect(logMessage).toBeDefined();
      expect(logMessage!.type).toBe('log');
      expect(logMessage!.text).toBe('Test log message');
      expect(logMessage!.timestamp).toBeGreaterThan(0);
    });

    it('should capture console.warn messages', async () => {
      const html = `
        <script>
          console.warn('Test warning message');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const warnMessage = messages.find(m => m.type === 'warn' && m.text.includes('Test warning message'));

      expect(warnMessage).toBeDefined();
      expect(warnMessage!.type).toBe('warn');
      expect(warnMessage!.text).toBe('Test warning message');
    });

    it('should capture console.error messages', async () => {
      const html = `
        <script>
          console.error('Test error message');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const errorMessage = messages.find(m => m.type === 'error' && m.text.includes('Test error message'));

      expect(errorMessage).toBeDefined();
      expect(errorMessage!.type).toBe('error');
      expect(errorMessage!.text).toBe('Test error message');
    });

    it('should capture console.info messages', async () => {
      const html = `
        <script>
          console.info('Test info message');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const infoMessage = messages.find(m => m.type === 'info' && m.text.includes('Test info message'));

      expect(infoMessage).toBeDefined();
      expect(infoMessage!.type).toBe('info');
      expect(infoMessage!.text).toBe('Test info message');
    });

    it('should capture console.debug messages', async () => {
      const html = `
        <script>
          console.debug('Test debug message');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const debugMessage = messages.find(m => m.type === 'debug' && m.text.includes('Test debug message'));

      expect(debugMessage).toBeDefined();
      expect(debugMessage!.type).toBe('debug');
      expect(debugMessage!.text).toBe('Test debug message');
    });
  });

  describe('Console Message Arguments Capture', () => {
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

    it('should capture multiple arguments passed to console methods', async () => {
      const html = `
        <script>
          console.log('Message with', 'multiple', 'arguments', 42, true);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const message = messages.find(m => m.type === 'log');

      expect(message).toBeDefined();
      expect(message!.args).toBeDefined();
      expect(message!.args.length).toBeGreaterThanOrEqual(5);
      expect(message!.args).toContain('Message with');
      expect(message!.args).toContain('multiple');
      expect(message!.args).toContain('arguments');
      expect(message!.args).toContain(42);
      expect(message!.args).toContain(true);
    });

    it('should capture object arguments in console messages', async () => {
      const html = `
        <script>
          const testObj = { name: 'test', value: 123, nested: { prop: 'data' } };
          console.log('Object:', testObj);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const message = messages.find(m => m.type === 'log' && m.text.includes('Object:'));

      expect(message).toBeDefined();
      expect(message!.args).toBeDefined();
      expect(message!.args.length).toBeGreaterThanOrEqual(2);
    });

    it('should capture array arguments in console messages', async () => {
      const html = `
        <script>
          const testArray = [1, 'two', { three: 3 }, [4, 5]];
          console.log('Array:', testArray);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const message = messages.find(m => m.type === 'log' && m.text.includes('Array:'));

      expect(message).toBeDefined();
      expect(message!.args).toBeDefined();
      expect(message!.args.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Console Message Location Capture', () => {
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

    it('should capture location information for console messages', async () => {
      const html = `
        <script>
          function testFunction() {
            console.log('Message with location');
          }
          testFunction();
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      const message = messages.find(m => m.type === 'log' && m.text.includes('Message with location'));

      expect(message).toBeDefined();
      expect(message!.location).toBeDefined();
      expect(message!.location!.url).toBeDefined();
      expect(typeof message!.location!.lineNumber).toBe('number');
      expect(typeof message!.location!.columnNumber).toBe('number');
    });
  });

  describe('Console Level Filtering', () => {
    it('should only capture specified console levels', async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        consoleLevels: ['error', 'warn'], // Only capture errors and warnings
      });
      await session.launch();

      const html = `
        <script>
          console.log('This should NOT be captured');
          console.info('This should NOT be captured');
          console.debug('This should NOT be captured');
          console.warn('This should be captured');
          console.error('This should be captured');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();

      // Should only have warn and error messages
      const logMessages = messages.filter(m => m.type === 'log');
      const infoMessages = messages.filter(m => m.type === 'info');
      const debugMessages = messages.filter(m => m.type === 'debug');
      const warnMessages = messages.filter(m => m.type === 'warn');
      const errorMessages = messages.filter(m => m.type === 'error');

      expect(logMessages).toHaveLength(0);
      expect(infoMessages).toHaveLength(0);
      expect(debugMessages).toHaveLength(0);
      expect(warnMessages.length).toBeGreaterThan(0);
      expect(errorMessages.length).toBeGreaterThan(0);
    });

    it('should capture all levels when no filter is specified', async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        // No consoleLevels specified - should capture all
      });
      await session.launch();

      const html = `
        <script>
          console.log('Log message');
          console.info('Info message');
          console.warn('Warn message');
          console.error('Error message');
          console.debug('Debug message');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();

      // Should have all types of messages
      const messageTypes = [...new Set(messages.map(m => m.type))];
      expect(messageTypes).toContain('log');
      expect(messageTypes).toContain('info');
      expect(messageTypes).toContain('warn');
      expect(messageTypes).toContain('error');
    });
  });

  describe('Buffer Management', () => {
    it('should respect maxBufferSize configuration', async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        maxBufferSize: 3, // Only keep 3 messages
      });
      await session.launch();

      const html = `
        <script>
          for (let i = 1; i <= 10; i++) {
            console.log('Message ' + i);
          }
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 200));

      const messages = session.getCapturedConsoleMessages();

      // Should only keep the last 3 messages due to buffer limit
      expect(messages.length).toBeLessThanOrEqual(3);

      if (messages.length === 3) {
        // Should have the most recent messages
        expect(messages.some(m => m.text.includes('Message 8') || m.text.includes('Message 9') || m.text.includes('Message 10'))).toBe(true);
      }
    });

    it('should handle clearing captured data', async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
      });
      await session.launch();

      const html = `
        <script>
          console.log('Message before clear');
          console.warn('Warning before clear');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      let messages = session.getCapturedConsoleMessages();
      expect(messages.length).toBeGreaterThan(0);

      // Clear captured data
      session.clearCapturedData();

      messages = session.getCapturedConsoleMessages();
      expect(messages).toHaveLength(0);
    });
  });

  describe('Real-time Console Message Events', () => {
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

    it('should emit consoleMessage events in real-time', async () => {
      const capturedEvents: CapturedConsoleMessage[] = [];

      session.on('consoleMessage', (message) => {
        capturedEvents.push(message);
      });

      const html = `
        <script>
          console.log('Real-time message 1');
          setTimeout(() => console.log('Real-time message 2'), 50);
          setTimeout(() => console.log('Real-time message 3'), 100);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Wait for all messages to be captured
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(capturedEvents.length).toBeGreaterThanOrEqual(3);

      const message1 = capturedEvents.find(e => e.text.includes('Real-time message 1'));
      const message2 = capturedEvents.find(e => e.text.includes('Real-time message 2'));
      const message3 = capturedEvents.find(e => e.text.includes('Real-time message 3'));

      expect(message1).toBeDefined();
      expect(message2).toBeDefined();
      expect(message3).toBeDefined();

      // Verify timestamps are in order
      expect(message1!.timestamp).toBeLessThanOrEqual(message2!.timestamp);
      expect(message2!.timestamp).toBeLessThanOrEqual(message3!.timestamp);
    });
  });

  describe('Enhanced Console Capture', () => {
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

    it('should retrieve enhanced console messages with stack traces', async () => {
      const html = `
        <script>
          function nestedFunction() {
            console.log('Message from nested function');
          }

          function wrapperFunction() {
            nestedFunction();
          }

          wrapperFunction();
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const enhancedResult = await session.retrieveEnhancedConsoleMessages();
      expect(enhancedResult.success).toBe(true);

      const messages = session.getCapturedConsoleMessages();
      const nestedMessage = messages.find(m => m.text.includes('Message from nested function'));

      expect(nestedMessage).toBeDefined();
      expect(nestedMessage!.location).toBeDefined();
    });

    it('should handle real-time capture streaming', async () => {
      const capturedMessages: CapturedConsoleMessage[] = [];

      session.on('consoleMessage', (message) => {
        capturedMessages.push(message);
      });

      session.startRealTimeCapture({
        consolePollingMs: 100,
        errorPollingMs: 100,
        autoStart: true,
      });

      const html = `
        <script>
          let counter = 0;
          const interval = setInterval(() => {
            counter++;
            console.log('Streaming message ' + counter);
            if (counter >= 3) {
              clearInterval(interval);
            }
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Wait for streaming capture
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(capturedMessages.length).toBeGreaterThanOrEqual(3);

      const streamingMessages = capturedMessages.filter(m => m.text.includes('Streaming message'));
      expect(streamingMessages.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Configuration Updates', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: false, // Start with console capture disabled
        captureErrors: true,
      });
      await session.launch();
    });

    it('should support dynamic capture configuration updates', async () => {
      // Initially console capture is disabled
      let config = session.getCaptureConfig();
      expect(config.captureConsole).toBe(false);

      // Generate some console messages (should not be captured)
      const html1 = `
        <script>
          console.log('This should not be captured initially');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html1)}`);
      await new Promise(resolve => setTimeout(resolve, 100));

      let messages = session.getCapturedConsoleMessages();
      expect(messages).toHaveLength(0);

      // Enable console capture
      session.updateCaptureConfig({
        captureConsole: true,
        consoleLevels: ['log', 'warn', 'error'],
      });

      config = session.getCaptureConfig();
      expect(config.captureConsole).toBe(true);
      expect(config.consoleLevels).toEqual(['log', 'warn', 'error']);

      // Generate more console messages (should now be captured)
      const html2 = `
        <script>
          console.log('This should be captured now');
          console.warn('This warning should also be captured');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html2)}`);
      await new Promise(resolve => setTimeout(resolve, 100));

      messages = session.getCapturedConsoleMessages();
      expect(messages.length).toBeGreaterThan(0);

      const logMessage = messages.find(m => m.text.includes('This should be captured now'));
      const warnMessage = messages.find(m => m.text.includes('This warning should also be captured'));

      expect(logMessage).toBeDefined();
      expect(warnMessage).toBeDefined();
    });
  });

  describe('Disabled Console Capture', () => {
    it('should not capture console messages when capture is disabled', async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: false, // Console capture disabled
        captureErrors: true,
      });
      await session.launch();

      const html = `
        <script>
          console.log('This should not be captured');
          console.warn('This should not be captured');
          console.error('This should not be captured');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      expect(messages).toHaveLength(0);
    });
  });
});