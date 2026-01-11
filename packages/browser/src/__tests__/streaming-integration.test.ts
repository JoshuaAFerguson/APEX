/**
 * @apexcli/browser - Real-time Streaming Integration Tests
 *
 * Integration tests for real-time console and error streaming functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';
import type { CapturedConsoleMessage, CapturedJavaScriptError, PageErrorEvent } from '../types.js';

describe('Real-time Streaming Integration', () => {
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

  describe('Console and Error Streaming Combined', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        consoleLevels: ['log', 'warn', 'error', 'info'],
        includeStackTraces: true,
      });
      await session.launch();
    });

    it('should stream both console messages and errors in real-time', async () => {
      const capturedConsoleMessages: CapturedConsoleMessage[] = [];
      const capturedJavaScriptErrors: CapturedJavaScriptError[] = [];
      const capturedPageErrors: PageErrorEvent[] = [];

      // Set up event listeners
      session.on('consoleMessage', (message) => {
        capturedConsoleMessages.push(message);
      });

      session.on('javascriptError', (error) => {
        capturedJavaScriptErrors.push(error);
      });

      session.on('pageError', (error) => {
        capturedPageErrors.push(error);
      });

      // Start real-time capture
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

            // Generate console messages
            console.log('Streaming log message ' + counter);
            console.warn('Streaming warning ' + counter);

            // Generate errors periodically
            if (counter % 2 === 0) {
              setTimeout(() => {
                throw new Error('Streaming error ' + counter);
              }, 25);
            }

            // Generate promise rejections
            if (counter % 3 === 0) {
              setTimeout(() => {
                Promise.reject(new Error('Streaming promise rejection ' + counter));
              }, 50);
            }

            if (counter >= 5) {
              clearInterval(interval);
            }
          }, 150);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Wait for all events to be generated and captured
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Verify console messages were captured
      expect(capturedConsoleMessages.length).toBeGreaterThanOrEqual(8); // 5 logs + 5 warnings minimum

      const logMessages = capturedConsoleMessages.filter(m => m.type === 'log');
      const warnMessages = capturedConsoleMessages.filter(m => m.type === 'warn');

      expect(logMessages.length).toBeGreaterThanOrEqual(5);
      expect(warnMessages.length).toBeGreaterThanOrEqual(5);

      // Verify errors were captured
      expect(capturedJavaScriptErrors.length + capturedPageErrors.length).toBeGreaterThanOrEqual(3);

      // Verify timeline - events should be captured in real-time with proper timestamps
      const allEvents = [
        ...capturedConsoleMessages.map(m => ({ type: 'console', timestamp: m.timestamp })),
        ...capturedJavaScriptErrors.map(e => ({ type: 'jsError', timestamp: e.timestamp })),
        ...capturedPageErrors.map(e => ({ type: 'pageError', timestamp: e.timestamp }))
      ].sort((a, b) => a.timestamp - b.timestamp);

      expect(allEvents.length).toBeGreaterThanOrEqual(10);

      // Check that timestamps are spread over time (real-time capture)
      if (allEvents.length >= 2) {
        const timeSpan = allEvents[allEvents.length - 1].timestamp - allEvents[0].timestamp;
        expect(timeSpan).toBeGreaterThan(100); // Should span more than 100ms
      }
    });

    it('should handle concurrent page navigation with streaming', async () => {
      const capturedMessages: CapturedConsoleMessage[] = [];
      const capturedErrors: CapturedJavaScriptError[] = [];

      session.on('consoleMessage', (message) => {
        capturedMessages.push(message);
      });

      session.on('javascriptError', (error) => {
        capturedErrors.push(error);
      });

      session.startRealTimeCapture({
        consolePollingMs: 50,
        errorPollingMs: 50,
        autoStart: true,
      });

      // Navigate to multiple pages with console activity
      const pages = [
        `<script>
          console.log('Page 1 log');
          setTimeout(() => throw new Error('Page 1 error'), 50);
        </script>`,
        `<script>
          console.warn('Page 2 warning');
          setTimeout(() => console.error('Page 2 error log'), 50);
        </script>`,
        `<script>
          console.info('Page 3 info');
          setTimeout(() => Promise.reject(new Error('Page 3 rejection')), 50);
        </script>`
      ];

      for (let i = 0; i < pages.length; i++) {
        await session.navigate(`data:text/html,${encodeURIComponent(pages[i])}`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Additional wait for final captures
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should have messages from all pages
      expect(capturedMessages.length).toBeGreaterThanOrEqual(4);
      expect(capturedErrors.length).toBeGreaterThanOrEqual(2);

      // Check for messages from each page
      const hasPage1Log = capturedMessages.some(m => m.text.includes('Page 1 log'));
      const hasPage2Warning = capturedMessages.some(m => m.text.includes('Page 2 warning'));
      const hasPage3Info = capturedMessages.some(m => m.text.includes('Page 3 info'));

      expect(hasPage1Log).toBe(true);
      expect(hasPage2Warning).toBe(true);
      expect(hasPage3Info).toBe(true);
    });

    it('should maintain streaming performance under load', async () => {
      const capturedMessages: CapturedConsoleMessage[] = [];
      const capturedErrors: CapturedJavaScriptError[] = [];

      session.on('consoleMessage', (message) => {
        capturedMessages.push(message);
      });

      session.on('javascriptError', (error) => {
        capturedErrors.push(error);
      });

      session.startRealTimeCapture({
        consolePollingMs: 25, // High frequency polling
        errorPollingMs: 25,
        autoStart: true,
      });

      const html = `
        <script>
          // Generate high volume of console messages and errors
          let messageCount = 0;
          let errorCount = 0;

          const highVolumeInterval = setInterval(() => {
            for (let i = 0; i < 10; i++) {
              messageCount++;
              console.log('High volume message ' + messageCount);

              if (messageCount % 5 === 0) {
                errorCount++;
                setTimeout(() => {
                  throw new Error('High volume error ' + errorCount);
                }, Math.random() * 50);
              }
            }

            if (messageCount >= 100) {
              clearInterval(highVolumeInterval);
            }
          }, 100);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Wait for high volume generation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify performance - should capture a significant portion of messages
      expect(capturedMessages.length).toBeGreaterThan(80); // At least 80% capture rate
      expect(capturedErrors.length).toBeGreaterThan(15); // At least 15 errors

      // Check message sequence
      const sequentialMessages = capturedMessages.filter(m => m.text.includes('High volume message'));
      expect(sequentialMessages.length).toBeGreaterThan(80);

      // Verify timestamps are roughly sequential
      let sequentialTimestamps = 0;
      for (let i = 1; i < sequentialMessages.length; i++) {
        if (sequentialMessages[i].timestamp >= sequentialMessages[i - 1].timestamp) {
          sequentialTimestamps++;
        }
      }

      // Most timestamps should be in order (allowing for some variation due to async capture)
      const sequentialPercentage = sequentialTimestamps / (sequentialMessages.length - 1);
      expect(sequentialPercentage).toBeGreaterThan(0.8); // 80% should be in order
    });
  });

  describe('Enhanced Console Message Retrieval Integration', () => {
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

    it('should integrate enhanced console retrieval with standard capture', async () => {
      const standardMessages: CapturedConsoleMessage[] = [];

      session.on('consoleMessage', (message) => {
        standardMessages.push(message);
      });

      const html = `
        <script>
          function logWithStack() {
            console.log('Message from function with stack');
            console.warn('Warning from function');
          }

          logWithStack();

          setTimeout(() => {
            console.error('Delayed error message');
          }, 100);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Retrieve enhanced messages
      const enhancedResult = await session.retrieveEnhancedConsoleMessages();
      expect(enhancedResult.success).toBe(true);

      // Get all captured messages
      const allMessages = session.getCapturedConsoleMessages();

      // Should have messages from both standard and enhanced capture
      expect(allMessages.length).toBeGreaterThanOrEqual(3);

      const logMessage = allMessages.find(m => m.text.includes('Message from function with stack'));
      const warnMessage = allMessages.find(m => m.text.includes('Warning from function'));
      const errorMessage = allMessages.find(m => m.text.includes('Delayed error message'));

      expect(logMessage).toBeDefined();
      expect(warnMessage).toBeDefined();
      expect(errorMessage).toBeDefined();

      // Enhanced messages should have location information
      if (logMessage?.location) {
        expect(logMessage.location.url).toBeDefined();
        expect(typeof logMessage.location.lineNumber).toBe('number');
        expect(typeof logMessage.location.columnNumber).toBe('number');
      }
    });

    it('should handle mixed console and error injection script retrieval', async () => {
      session.startRealTimeCapture({
        consolePollingMs: 100,
        errorPollingMs: 100,
        autoStart: true,
      });

      const html = `
        <script>
          // Mix of console messages and errors
          console.log('Initial log');

          setTimeout(() => {
            console.warn('First warning');
            throw new Error('First error');
          }, 50);

          setTimeout(() => {
            console.error('Error log message');
            Promise.reject(new Error('Promise rejection'));
          }, 100);

          setTimeout(() => {
            console.info('Final info message');
          }, 150);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 400));

      // Retrieve both enhanced console messages and JavaScript errors
      const consoleResult = await session.retrieveEnhancedConsoleMessages();
      const errorResult = await session.retrieveCapturedJavaScriptErrors();

      expect(consoleResult.success).toBe(true);
      expect(errorResult.success).toBe(true);

      const allConsoleMessages = session.getCapturedConsoleMessages();
      const allJsErrors = session.getCapturedJavaScriptErrors();

      expect(allConsoleMessages.length).toBeGreaterThanOrEqual(4);
      expect(allJsErrors.length).toBeGreaterThanOrEqual(2);

      // Verify we have the expected message types
      const messageTypes = [...new Set(allConsoleMessages.map(m => m.type))];
      expect(messageTypes).toContain('log');
      expect(messageTypes).toContain('warn');
      expect(messageTypes).toContain('error');
      expect(messageTypes).toContain('info');
    });
  });

  describe('Streaming Configuration and Control', () => {
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

    it('should support dynamic streaming configuration updates', async () => {
      const capturedMessages: CapturedConsoleMessage[] = [];

      session.on('consoleMessage', (message) => {
        capturedMessages.push(message);
      });

      // Start with console capture disabled
      session.updateCaptureConfig({
        captureConsole: false,
      });

      const html = `
        <script>
          console.log('This should NOT be captured');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(capturedMessages).toHaveLength(0);

      // Enable console capture and start real-time streaming
      session.updateCaptureConfig({
        captureConsole: true,
        consoleLevels: ['log', 'warn', 'error'],
      });

      session.startRealTimeCapture({
        consolePollingMs: 50,
        errorPollingMs: 100,
        autoStart: true,
      });

      const html2 = `
        <script>
          console.log('This SHOULD be captured');
          console.warn('This warning should also be captured');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html2)}`);

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(capturedMessages.length).toBeGreaterThanOrEqual(2);

      const logMessage = capturedMessages.find(m => m.text.includes('This SHOULD be captured'));
      const warnMessage = capturedMessages.find(m => m.text.includes('This warning should also be captured'));

      expect(logMessage).toBeDefined();
      expect(warnMessage).toBeDefined();
    });

    it('should handle streaming with selective console level filtering', async () => {
      const capturedMessages: CapturedConsoleMessage[] = [];

      session.on('consoleMessage', (message) => {
        capturedMessages.push(message);
      });

      // Configure to only capture errors and warnings
      session.updateCaptureConfig({
        captureConsole: true,
        consoleLevels: ['error', 'warn'],
      });

      session.startRealTimeCapture({
        consolePollingMs: 50,
        errorPollingMs: 100,
        autoStart: true,
      });

      const html = `
        <script>
          console.log('This log should NOT be captured');
          console.info('This info should NOT be captured');
          console.debug('This debug should NOT be captured');
          console.warn('This warning SHOULD be captured');
          console.error('This error SHOULD be captured');
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should only have warn and error messages
      expect(capturedMessages.length).toBeGreaterThanOrEqual(2);

      const messageTypes = [...new Set(capturedMessages.map(m => m.type))];
      expect(messageTypes).not.toContain('log');
      expect(messageTypes).not.toContain('info');
      expect(messageTypes).not.toContain('debug');
      expect(messageTypes).toContain('warn');
      expect(messageTypes).toContain('error');
    });

    it('should handle stopping and restarting streaming', async () => {
      const capturedMessages: CapturedConsoleMessage[] = [];
      const capturedErrors: CapturedJavaScriptError[] = [];

      session.on('consoleMessage', (message) => {
        capturedMessages.push(message);
      });

      session.on('javascriptError', (error) => {
        capturedErrors.push(error);
      });

      // Start streaming
      session.startRealTimeCapture({
        consolePollingMs: 100,
        errorPollingMs: 100,
        autoStart: true,
      });

      const html1 = `
        <script>
          console.log('Message during first streaming period');
          setTimeout(() => throw new Error('Error during first streaming period'), 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html1)}`);

      await new Promise(resolve => setTimeout(resolve, 200));

      const firstPeriodMessageCount = capturedMessages.length;
      const firstPeriodErrorCount = capturedErrors.length;

      expect(firstPeriodMessageCount).toBeGreaterThan(0);
      expect(firstPeriodErrorCount).toBeGreaterThan(0);

      // Stop streaming
      session.stopErrorPolling();

      const html2 = `
        <script>
          console.log('Message during stopped period');
          setTimeout(() => throw new Error('Error during stopped period'), 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html2)}`);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Counts should not have increased significantly
      expect(capturedMessages.length).toBeLessThanOrEqual(firstPeriodMessageCount + 2);
      expect(capturedErrors.length).toBe(firstPeriodErrorCount); // Error polling stopped

      // Restart streaming
      session.startRealTimeCapture({
        consolePollingMs: 100,
        errorPollingMs: 100,
        autoStart: true,
      });

      const html3 = `
        <script>
          console.log('Message during restarted streaming');
          setTimeout(() => throw new Error('Error during restarted streaming'), 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html3)}`);

      await new Promise(resolve => setTimeout(resolve, 300));

      // Should have new messages and errors
      expect(capturedMessages.length).toBeGreaterThan(firstPeriodMessageCount + 1);
      expect(capturedErrors.length).toBeGreaterThan(firstPeriodErrorCount);

      session.stopErrorPolling();
    });
  });

  describe('Error Resilience During Streaming', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        maxBufferSize: 100, // Sufficient buffer for error resilience tests
      });
      await session.launch();
    });

    it('should continue streaming after page crashes or navigation errors', async () => {
      const capturedMessages: CapturedConsoleMessage[] = [];

      session.on('consoleMessage', (message) => {
        capturedMessages.push(message);
      });

      session.startRealTimeCapture({
        consolePollingMs: 100,
        errorPollingMs: 100,
        autoStart: true,
      });

      // Navigate to a page that generates messages then crashes
      const crashyHtml = `
        <script>
          console.log('Message before crash');

          setTimeout(() => {
            console.log('Message right before crash');
            // Force a navigation that might cause issues
            window.location.href = 'about:blank';
          }, 100);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(crashyHtml)}`);

      await new Promise(resolve => setTimeout(resolve, 300));

      const preRecoveryCount = capturedMessages.length;
      expect(preRecoveryCount).toBeGreaterThan(0);

      // Navigate to a new stable page
      const stableHtml = `
        <script>
          console.log('Message after recovery');
          setTimeout(() => console.log('Delayed message after recovery'), 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(stableHtml)}`);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have continued capturing messages
      expect(capturedMessages.length).toBeGreaterThan(preRecoveryCount);

      const recoveryMessage = capturedMessages.find(m => m.text.includes('Message after recovery'));
      expect(recoveryMessage).toBeDefined();
    });

    it('should handle injection script failures gracefully', async () => {
      const capturedMessages: CapturedConsoleMessage[] = [];
      const capturedErrors: CapturedJavaScriptError[] = [];

      session.on('consoleMessage', (message) => {
        capturedMessages.push(message);
      });

      session.on('javascriptError', (error) => {
        capturedErrors.push(error);
      });

      session.startRealTimeCapture({
        consolePollingMs: 100,
        errorPollingMs: 100,
        autoStart: true,
      });

      // Page with potential script conflicts
      const conflictHtml = `
        <script>
          // Try to interfere with our injection
          window.__apexConsoleCapture = null;
          window.__apexErrorCapture = undefined;

          console.log('Message despite interference');

          setTimeout(() => {
            throw new Error('Error despite interference');
          }, 50);

          setTimeout(() => {
            // Try to overwrite our capture again
            if (window.__apexConsoleCapture) {
              window.__apexConsoleCapture.length = 0;
            }
            console.log('Message after interference attempt');
          }, 100);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(conflictHtml)}`);

      await new Promise(resolve => setTimeout(resolve, 400));

      // Should still capture some messages (from Playwright's native capture at minimum)
      expect(capturedMessages.length + capturedErrors.length).toBeGreaterThan(0);

      // Try manual retrieval to ensure system still works
      const enhancedResult = await session.retrieveEnhancedConsoleMessages();
      const errorResult = await session.retrieveCapturedJavaScriptErrors();

      expect(enhancedResult.success).toBe(true);
      expect(errorResult.success).toBe(true);
    });
  });
});