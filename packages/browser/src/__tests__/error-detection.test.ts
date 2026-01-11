/**
 * @apexcli/browser - JavaScript Error Detection Tests
 *
 * Comprehensive tests for JavaScript runtime error detection and stack trace capture
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';
import type { CapturedJavaScriptError, PageErrorEvent } from '../types.js';

describe('JavaScript Error Detection', () => {
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

  describe('Basic Error Capture', () => {
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

    it('should capture uncaught JavaScript errors', async () => {
      const html = `
        <script>
          setTimeout(() => {
            throw new Error('Test uncaught error');
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Start error polling
      session.startErrorPolling(100);

      await new Promise(resolve => setTimeout(resolve, 300));

      const errorResult = await session.retrieveCapturedJavaScriptErrors();
      expect(errorResult.success).toBe(true);

      const capturedErrors = session.getCapturedJavaScriptErrors();
      const uncaughtError = capturedErrors.find(err => err.message.includes('Test uncaught error'));

      expect(uncaughtError).toBeDefined();
      expect(uncaughtError!.uncaught).toBe(true);
      expect(uncaughtError!.message).toContain('Test uncaught error');
      expect(uncaughtError!.name).toBe('Error');
      expect(uncaughtError!.timestamp).toBeGreaterThan(0);

      session.stopErrorPolling();
    });

    it('should capture unhandled promise rejections', async () => {
      const html = `
        <script>
          setTimeout(() => {
            Promise.reject(new Error('Test promise rejection'));
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(100);

      await new Promise(resolve => setTimeout(resolve, 300));

      const errorResult = await session.retrieveCapturedJavaScriptErrors();
      expect(errorResult.success).toBe(true);

      const capturedErrors = session.getCapturedJavaScriptErrors();
      const rejectionError = capturedErrors.find(err =>
        err.message.includes('Test promise rejection') ||
        err.name === 'UnhandledPromiseRejection'
      );

      expect(rejectionError).toBeDefined();
      expect(rejectionError!.uncaught).toBe(true);
      expect(rejectionError!.timestamp).toBeGreaterThan(0);

      session.stopErrorPolling();
    });

    it('should capture ReferenceError', async () => {
      const html = `
        <script>
          setTimeout(() => {
            undefinedVariable.someProperty;
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(100);

      await new Promise(resolve => setTimeout(resolve, 300));

      await session.retrieveCapturedJavaScriptErrors();
      const capturedErrors = session.getCapturedJavaScriptErrors();
      const referenceError = capturedErrors.find(err =>
        err.message.includes('undefinedVariable') || err.name === 'ReferenceError'
      );

      expect(referenceError).toBeDefined();
      expect(referenceError!.uncaught).toBe(true);

      session.stopErrorPolling();
    });

    it('should capture TypeError', async () => {
      const html = `
        <script>
          setTimeout(() => {
            null.someMethod();
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(100);

      await new Promise(resolve => setTimeout(resolve, 300));

      await session.retrieveCapturedJavaScriptErrors();
      const capturedErrors = session.getCapturedJavaScriptErrors();
      const typeError = capturedErrors.find(err =>
        err.name === 'TypeError' || err.message.includes('null')
      );

      expect(typeError).toBeDefined();
      expect(typeError!.uncaught).toBe(true);

      session.stopErrorPolling();
    });

    it('should capture SyntaxError', async () => {
      const html = `
        <script>
          setTimeout(() => {
            eval('invalid syntax here {');
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(100);

      await new Promise(resolve => setTimeout(resolve, 300));

      await session.retrieveCapturedJavaScriptErrors();
      const capturedErrors = session.getCapturedJavaScriptErrors();
      const syntaxError = capturedErrors.find(err =>
        err.name === 'SyntaxError' || err.message.includes('syntax')
      );

      expect(syntaxError).toBeDefined();
      expect(syntaxError!.uncaught).toBe(true);

      session.stopErrorPolling();
    });
  });

  describe('Stack Trace Capture', () => {
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

    it('should capture stack traces for errors', async () => {
      const html = `
        <script>
          function level1() {
            level2();
          }

          function level2() {
            level3();
          }

          function level3() {
            throw new Error('Error with stack trace');
          }

          setTimeout(() => {
            try {
              level1();
            } catch (e) {
              // Let it become uncaught
              setTimeout(() => { throw e; }, 10);
            }
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(100);

      await new Promise(resolve => setTimeout(resolve, 400));

      await session.retrieveCapturedJavaScriptErrors();
      const capturedErrors = session.getCapturedJavaScriptErrors();
      const errorWithStack = capturedErrors.find(err =>
        err.message.includes('Error with stack trace') && err.stack
      );

      expect(errorWithStack).toBeDefined();
      expect(errorWithStack!.stack).toBeDefined();
      expect(errorWithStack!.stack!.length).toBeGreaterThan(0);
      expect(errorWithStack!.stack!).toContain('level3');

      session.stopErrorPolling();
    });

    it('should capture source location information', async () => {
      const html = `
        <script>
          // Line 3
          setTimeout(() => {
            // Line 5 - this should be in the error source
            throw new Error('Error with location info');
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(100);

      await new Promise(resolve => setTimeout(resolve, 300));

      await session.retrieveCapturedJavaScriptErrors();
      const capturedErrors = session.getCapturedJavaScriptErrors();
      const errorWithLocation = capturedErrors.find(err =>
        err.message.includes('Error with location info')
      );

      expect(errorWithLocation).toBeDefined();
      if (errorWithLocation?.source) {
        expect(errorWithLocation.source.url).toBeDefined();
        expect(typeof errorWithLocation.source.line).toBe('number');
        expect(typeof errorWithLocation.source.column).toBe('number');
        expect(errorWithLocation.source.line).toBeGreaterThan(0);
        expect(errorWithLocation.source.column).toBeGreaterThan(0);
      }

      session.stopErrorPolling();
    });
  });

  describe('Page Error Events', () => {
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

    it('should capture page error events', async () => {
      const capturedPageErrors: PageErrorEvent[] = [];

      session.on('pageError', (error) => {
        capturedPageErrors.push(error);
      });

      const html = `
        <script>
          setTimeout(() => {
            throw new Error('Page error test');
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(capturedPageErrors.length).toBeGreaterThan(0);

      const pageError = capturedPageErrors.find(err =>
        err.message.includes('Page error test')
      );

      expect(pageError).toBeDefined();
      expect(pageError!.error).toBeInstanceOf(Error);
      expect(pageError!.message).toContain('Page error test');
      expect(pageError!.timestamp).toBeGreaterThan(0);
      expect(pageError!.stack).toBeDefined();
    });

    it('should track page errors separately from JavaScript errors', async () => {
      const html = `
        <script>
          setTimeout(() => {
            throw new Error('Combined error test');
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(100);

      await new Promise(resolve => setTimeout(resolve, 300));

      await session.retrieveCapturedJavaScriptErrors();

      const jsErrors = session.getCapturedJavaScriptErrors();
      const pageErrors = session.getCapturedPageErrors();

      // Should have both types of errors for the same incident
      expect(jsErrors.length + pageErrors.length).toBeGreaterThan(0);

      session.stopErrorPolling();
    });
  });

  describe('Real-time Error Events', () => {
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

    it('should emit JavaScript error events in real-time', async () => {
      const capturedEvents: CapturedJavaScriptError[] = [];

      session.on('javascriptError', (error) => {
        capturedEvents.push(error);
      });

      session.startErrorPolling(100);

      const html = `
        <script>
          let counter = 0;
          const interval = setInterval(() => {
            counter++;
            if (counter <= 3) {
              setTimeout(() => {
                throw new Error('Real-time error ' + counter);
              }, 10);
            } else {
              clearInterval(interval);
            }
          }, 100);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Wait for errors to be generated and captured
      await new Promise(resolve => setTimeout(resolve, 800));

      expect(capturedEvents.length).toBeGreaterThanOrEqual(3);

      const error1 = capturedEvents.find(e => e.message.includes('Real-time error 1'));
      const error2 = capturedEvents.find(e => e.message.includes('Real-time error 2'));
      const error3 = capturedEvents.find(e => e.message.includes('Real-time error 3'));

      expect(error1).toBeDefined();
      expect(error2).toBeDefined();
      expect(error3).toBeDefined();

      // Verify timestamps are in order
      expect(error1!.timestamp).toBeLessThanOrEqual(error2!.timestamp);
      expect(error2!.timestamp).toBeLessThanOrEqual(error3!.timestamp);

      session.stopErrorPolling();
    });
  });

  describe('Error Buffer Management', () => {
    beforeEach(async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        maxBufferSize: 3, // Only keep 3 errors
      });
      await session.launch();
    });

    it('should respect maxBufferSize for error buffer', async () => {
      session.startErrorPolling(100);

      const html = `
        <script>
          for (let i = 1; i <= 10; i++) {
            setTimeout(() => {
              throw new Error('Buffer test error ' + i);
            }, i * 50);
          }
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Wait for all errors to be generated and processed
      await new Promise(resolve => setTimeout(resolve, 800));

      await session.retrieveCapturedJavaScriptErrors();
      const capturedErrors = session.getCapturedJavaScriptErrors();

      // Should only keep the last 3 errors due to buffer limit
      expect(capturedErrors.length).toBeLessThanOrEqual(3);

      if (capturedErrors.length === 3) {
        // Should have the most recent errors
        const hasRecentError = capturedErrors.some(err =>
          err.message.includes('Buffer test error 8') ||
          err.message.includes('Buffer test error 9') ||
          err.message.includes('Buffer test error 10')
        );
        expect(hasRecentError).toBe(true);
      }

      session.stopErrorPolling();
    });

    it('should handle clearing captured error data', async () => {
      const html = `
        <script>
          setTimeout(() => {
            throw new Error('Error before clear');
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(100);

      await new Promise(resolve => setTimeout(resolve, 200));

      await session.retrieveCapturedJavaScriptErrors();
      let errors = session.getCapturedJavaScriptErrors();
      let pageErrors = session.getCapturedPageErrors();

      expect(errors.length + pageErrors.length).toBeGreaterThan(0);

      // Clear captured data
      session.clearCapturedData();

      errors = session.getCapturedJavaScriptErrors();
      pageErrors = session.getCapturedPageErrors();

      expect(errors).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);

      session.stopErrorPolling();
    });
  });

  describe('Error Polling Control', () => {
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

    it('should start and stop error polling correctly', async () => {
      const html = `
        <script>
          function generateError() {
            throw new Error('Polling test error');
          }
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Start polling
      session.startErrorPolling(100);

      // Generate an error
      await session.evaluate(() => {
        setTimeout(() => {
          throw new Error('Polling test error');
        }, 50);
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      await session.retrieveCapturedJavaScriptErrors();
      let errors = session.getCapturedJavaScriptErrors();
      const initialErrorCount = errors.length;

      // Stop polling
      session.stopErrorPolling();

      // Generate another error (should not be captured)
      await session.evaluate(() => {
        setTimeout(() => {
          throw new Error('Error after stop');
        }, 50);
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      await session.retrieveCapturedJavaScriptErrors();
      errors = session.getCapturedJavaScriptErrors();

      // Should not have increased
      expect(errors.length).toBe(initialErrorCount);
    });

    it('should handle custom polling intervals', async () => {
      const html = `
        <script>
          setTimeout(() => {
            throw new Error('Custom interval error');
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Start polling with very short interval
      session.startErrorPolling(50);

      await new Promise(resolve => setTimeout(resolve, 200));

      await session.retrieveCapturedJavaScriptErrors();
      const errors = session.getCapturedJavaScriptErrors();

      expect(errors.length).toBeGreaterThan(0);

      session.stopErrorPolling();
    });
  });

  describe('Error Capture without Enabled Errors', () => {
    it('should not capture errors when error capture is disabled', async () => {
      session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: false, // Error capture disabled
      });
      await session.launch();

      const html = `
        <script>
          setTimeout(() => {
            throw new Error('This should not be captured');
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      await new Promise(resolve => setTimeout(resolve, 200));

      const errorResult = await session.retrieveCapturedJavaScriptErrors();
      expect(errorResult.success).toBe(true);

      const jsErrors = session.getCapturedJavaScriptErrors();
      const pageErrors = session.getCapturedPageErrors();

      expect(jsErrors).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });
  });

  describe('Complex Error Scenarios', () => {
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

    it('should handle errors in async/await functions', async () => {
      const html = `
        <script>
          async function asyncErrorFunction() {
            await new Promise(resolve => setTimeout(resolve, 50));
            throw new Error('Async function error');
          }

          setTimeout(async () => {
            try {
              await asyncErrorFunction();
            } catch (e) {
              // Let it become uncaught
              setTimeout(() => { throw e; }, 10);
            }
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(100);

      await new Promise(resolve => setTimeout(resolve, 400));

      await session.retrieveCapturedJavaScriptErrors();
      const errors = session.getCapturedJavaScriptErrors();
      const asyncError = errors.find(err => err.message.includes('Async function error'));

      expect(asyncError).toBeDefined();
      expect(asyncError!.uncaught).toBe(true);

      session.stopErrorPolling();
    });

    it('should handle errors in event handlers', async () => {
      const html = `
        <button id="errorButton">Click me</button>
        <script>
          document.getElementById('errorButton').addEventListener('click', () => {
            throw new Error('Event handler error');
          });
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(100);

      // Trigger the error by clicking the button
      await session.click('#errorButton');

      await new Promise(resolve => setTimeout(resolve, 200));

      await session.retrieveCapturedJavaScriptErrors();
      const errors = session.getCapturedJavaScriptErrors();
      const handlerError = errors.find(err => err.message.includes('Event handler error'));

      expect(handlerError).toBeDefined();

      session.stopErrorPolling();
    });

    it('should capture multiple types of errors in sequence', async () => {
      const html = `
        <script>
          setTimeout(() => {
            // Reference error
            undefinedVariable.property;
          }, 50);

          setTimeout(() => {
            // Type error
            null.method();
          }, 100);

          setTimeout(() => {
            // Custom error
            throw new Error('Custom error message');
          }, 150);

          setTimeout(() => {
            // Promise rejection
            Promise.reject(new Error('Promise rejection error'));
          }, 200);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(50);

      await new Promise(resolve => setTimeout(resolve, 500));

      await session.retrieveCapturedJavaScriptErrors();
      const errors = session.getCapturedJavaScriptErrors();

      expect(errors.length).toBeGreaterThanOrEqual(3);

      const hasReferenceError = errors.some(err =>
        err.name === 'ReferenceError' || err.message.includes('undefinedVariable')
      );
      const hasTypeError = errors.some(err =>
        err.name === 'TypeError' || err.message.includes('null')
      );
      const hasCustomError = errors.some(err =>
        err.message.includes('Custom error message')
      );

      expect(hasReferenceError || hasTypeError || hasCustomError).toBe(true);

      session.stopErrorPolling();
    });
  });
});