/**
 * @apexcli/browser - Uncaught Exception Integration Tests
 *
 * Integration tests that trigger uncaught exceptions in browser, verify they are detected,
 * and validate stack trace information is captured correctly through the complete pipeline.
 *
 * These tests validate end-to-end integration of error capture components in realistic scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';
import type { CapturedJavaScriptError, PageErrorEvent } from '../types.js';

describe('Uncaught Exception Integration Tests', () => {
  let manager: BrowserManager;

  beforeEach(() => {
    manager = new BrowserManager();
  });

  afterEach(async () => {
    if (manager) {
      await manager.shutdown();
    }
  });

  describe('End-to-End Error Pipeline', () => {
    let session: BrowserSession;

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

    afterEach(async () => {
      if (session) {
        await session.close();
      }
    });

    it('should capture exception through complete pipeline', async () => {
      let pageErrorCaptured: PageErrorEvent | null = null;
      let javascriptErrorCaptured: CapturedJavaScriptError | null = null;

      // Set up event listeners to verify both event types fire
      session.on('pageError', (error: PageErrorEvent) => {
        pageErrorCaptured = error;
      });

      session.on('javascriptError', (error: CapturedJavaScriptError) => {
        javascriptErrorCaptured = error;
      });

      // Create a page that will throw an uncaught exception
      const html = `
        <html>
          <head><title>Error Test Page</title></head>
          <body>
            <h1>Integration Test</h1>
            <script>
              // Function that will trigger an uncaught exception
              function triggerError() {
                throw new Error('Integration test uncaught error');
              }

              // Schedule the error to occur after page load
              setTimeout(() => {
                triggerError();
              }, 100);
            </script>
          </body>
        </html>
      `;

      // Navigate to the error page
      const navResult = await session.navigate(`data:text/html,${encodeURIComponent(html)}`);
      expect(navResult.success).toBe(true);

      // Start error polling to capture errors
      session.startErrorPolling(50);

      // Wait for error to occur and be captured
      await new Promise(resolve => setTimeout(resolve, 500));

      // Stop polling and retrieve errors
      session.stopErrorPolling();
      await session.retrieveCapturedJavaScriptErrors();

      // Verify pageError event fired
      expect(pageErrorCaptured).toBeDefined();
      expect(pageErrorCaptured?.message).toContain('Integration test uncaught error');
      expect(pageErrorCaptured?.timestamp).toBeDefined();

      // Verify javascriptError event fired
      expect(javascriptErrorCaptured).toBeDefined();
      expect(javascriptErrorCaptured?.message).toContain('Integration test uncaught error');
      expect(javascriptErrorCaptured?.uncaught).toBe(true);

      // Verify error retrieval through getCapturedJavaScriptErrors
      const capturedErrors = session.getCapturedJavaScriptErrors();
      const testError = capturedErrors.find(err =>
        err.message.includes('Integration test uncaught error')
      );

      expect(testError).toBeDefined();
      expect(testError?.uncaught).toBe(true);
      expect(testError?.name).toBe('Error');
      expect(testError?.timestamp).toBeDefined();

      // Verify stack trace is captured and contains function name
      expect(testError?.stack).toBeDefined();
      expect(testError?.stack).toContain('triggerError');

      // Verify source location if available
      if (testError?.source) {
        expect(testError.source.url).toBeDefined();
        expect(testError.source.line).toBeGreaterThan(0);
        expect(testError.source.column).toBeGreaterThan(0);
      }
    }, 30000);

    it('should correlate pageError and javascriptError events', async () => {
      const capturedEvents: { pageError?: PageErrorEvent; javascriptError?: CapturedJavaScriptError } = {};

      // Set up event listeners
      session.on('pageError', (error: PageErrorEvent) => {
        capturedEvents.pageError = error;
      });

      session.on('javascriptError', (error: CapturedJavaScriptError) => {
        capturedEvents.javascriptError = error;
      });

      // Create a page with a specific error for correlation testing
      const html = `
        <script>
          setTimeout(() => {
            throw new ReferenceError('CorrelationTestVariable is not defined');
          }, 100);
        </script>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);
      session.startErrorPolling(50);

      await new Promise(resolve => setTimeout(resolve, 500));

      session.stopErrorPolling();

      // Both events should have fired for the same error
      expect(capturedEvents.pageError).toBeDefined();
      expect(capturedEvents.javascriptError).toBeDefined();

      // Verify they represent the same error
      const pageErrorMsg = capturedEvents.pageError?.message || '';
      const jsErrorMsg = capturedEvents.javascriptError?.message || '';

      expect(pageErrorMsg).toContain('CorrelationTestVariable is not defined');
      expect(jsErrorMsg).toContain('CorrelationTestVariable is not defined');

      // Verify error type consistency
      expect(capturedEvents.javascriptError?.name).toBe('ReferenceError');
    }, 30000);
  });

  describe('Multi-Session Error Isolation', () => {
    it('should isolate errors between concurrent sessions', async () => {
      const sessions: BrowserSession[] = [];
      const errorsBySession: CapturedJavaScriptError[][] = [[], [], []];

      try {
        // Create three concurrent sessions
        for (let i = 0; i < 3; i++) {
          const session = new BrowserSession(manager, {
            browserType: 'chromium',
            headless: true,
          }, {
            captureConsole: true,
            captureErrors: true,
            includeStackTraces: true,
          });

          await session.launch();
          sessions.push(session);

          // Set up error capture for this session
          session.on('javascriptError', (error: CapturedJavaScriptError) => {
            errorsBySession[i].push(error);
          });
        }

        // Create unique errors in each session
        const errorMessages = [
          'Session1Error: Unique error message 1',
          'Session2Error: Unique error message 2',
          'Session3Error: Unique error message 3'
        ];

        // Navigate each session to a page with its unique error
        for (let i = 0; i < sessions.length; i++) {
          const html = `
            <script>
              setTimeout(() => {
                throw new Error('${errorMessages[i]}');
              }, 100);
            </script>
          `;

          await sessions[i].navigate(`data:text/html,${encodeURIComponent(html)}`);
          sessions[i].startErrorPolling(50);
        }

        // Wait for all errors to occur
        await new Promise(resolve => setTimeout(resolve, 500));

        // Stop polling and retrieve errors from all sessions
        for (let i = 0; i < sessions.length; i++) {
          sessions[i].stopErrorPolling();
          await sessions[i].retrieveCapturedJavaScriptErrors();
        }

        // Verify each session only captured its own error
        for (let i = 0; i < sessions.length; i++) {
          const sessionErrors = sessions[i].getCapturedJavaScriptErrors();
          const sessionSpecificError = sessionErrors.find(err =>
            err.message.includes(errorMessages[i])
          );

          expect(sessionSpecificError).toBeDefined();

          // Verify this session doesn't have errors from other sessions
          for (let j = 0; j < errorMessages.length; j++) {
            if (i !== j) {
              const otherSessionError = sessionErrors.find(err =>
                err.message.includes(errorMessages[j])
              );
              expect(otherSessionError).toBeUndefined();
            }
          }
        }

        // Verify event isolation
        for (let i = 0; i < errorsBySession.length; i++) {
          expect(errorsBySession[i].length).toBeGreaterThan(0);
          const hasOwnError = errorsBySession[i].some(err =>
            err.message.includes(errorMessages[i])
          );
          expect(hasOwnError).toBe(true);

          // Verify no cross-contamination
          for (let j = 0; j < errorMessages.length; j++) {
            if (i !== j) {
              const hasOtherError = errorsBySession[i].some(err =>
                err.message.includes(errorMessages[j])
              );
              expect(hasOtherError).toBe(false);
            }
          }
        }
      } finally {
        // Clean up all sessions
        await Promise.all(sessions.map(session => session.close()));
      }
    }, 45000);

    it('should maintain error history after session navigation', async () => {
      const session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      }, {
        captureConsole: true,
        captureErrors: true,
        includeStackTraces: true,
      });

      await session.launch();

      try {
        // Navigate to first page with error
        const html1 = `
          <script>
            setTimeout(() => {
              throw new Error('FirstPageError: Error from page 1');
            }, 100);
          </script>
        `;

        await session.navigate(`data:text/html,${encodeURIComponent(html1)}`);
        session.startErrorPolling(50);

        await new Promise(resolve => setTimeout(resolve, 300));

        // Navigate to second page with different error
        const html2 = `
          <script>
            setTimeout(() => {
              throw new Error('SecondPageError: Error from page 2');
            }, 100);
          </script>
        `;

        await session.navigate(`data:text/html,${encodeURIComponent(html2)}`);

        await new Promise(resolve => setTimeout(resolve, 300));

        session.stopErrorPolling();
        await session.retrieveCapturedJavaScriptErrors();

        // Verify both errors are captured
        const allErrors = session.getCapturedJavaScriptErrors();

        const firstPageError = allErrors.find(err =>
          err.message.includes('FirstPageError')
        );
        const secondPageError = allErrors.find(err =>
          err.message.includes('SecondPageError')
        );

        expect(firstPageError).toBeDefined();
        expect(secondPageError).toBeDefined();

        // Verify timestamps show proper ordering
        if (firstPageError && secondPageError) {
          expect(firstPageError.timestamp).toBeLessThan(secondPageError.timestamp);
        }
      } finally {
        await session.close();
      }
    }, 30000);
  });

  describe('Stack Trace Validation', () => {
    let session: BrowserSession;

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

    afterEach(async () => {
      if (session) {
        await session.close();
      }
    });

    it('should capture accurate line and column numbers', async () => {
      // Create HTML with known error location
      const html = `
        <html>
          <body>
            <script>
              function errorFunction() {
                throw new Error('LocationTestError');  // Line 6, predictable location
              }

              setTimeout(() => {
                errorFunction();
              }, 100);
            </script>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);
      session.startErrorPolling(50);

      await new Promise(resolve => setTimeout(resolve, 500));

      session.stopErrorPolling();
      await session.retrieveCapturedJavaScriptErrors();

      const errors = session.getCapturedJavaScriptErrors();
      const locationError = errors.find(err =>
        err.message.includes('LocationTestError')
      );

      expect(locationError).toBeDefined();
      expect(locationError?.stack).toBeDefined();
      expect(locationError?.stack).toContain('errorFunction');

      // Verify source location if captured
      if (locationError?.source) {
        expect(locationError.source.url).toBeDefined();
        expect(locationError.source.line).toBeGreaterThan(0);
        expect(locationError.source.column).toBeGreaterThan(0);
      }
    }, 30000);

    it('should preserve stack traces with multiple function calls', async () => {
      const html = `
        <script>
          function level1() { level2(); }
          function level2() { level3(); }
          function level3() { level4(); }
          function level4() {
            throw new Error('MultiLevelError: Stack trace test');
          }

          setTimeout(() => {
            level1();
          }, 100);
        </script>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);
      session.startErrorPolling(50);

      await new Promise(resolve => setTimeout(resolve, 500));

      session.stopErrorPolling();
      await session.retrieveCapturedJavaScriptErrors();

      const errors = session.getCapturedJavaScriptErrors();
      const multiLevelError = errors.find(err =>
        err.message.includes('MultiLevelError')
      );

      expect(multiLevelError).toBeDefined();
      expect(multiLevelError?.stack).toBeDefined();

      // Verify all function names appear in stack trace
      const stack = multiLevelError?.stack || '';
      expect(stack).toContain('level4');
      expect(stack).toContain('level3');
      expect(stack).toContain('level2');
      expect(stack).toContain('level1');
    }, 30000);
  });

  describe('Error Capture Timing and Reliability', () => {
    let session: BrowserSession;

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

    afterEach(async () => {
      if (session) {
        await session.close();
      }
    });

    it('should handle rapid sequential exceptions', async () => {
      const html = `
        <script>
          let errorCount = 0;

          function triggerError() {
            errorCount++;
            throw new Error('RapidError #' + errorCount);
          }

          setTimeout(() => {
            // Trigger 10 rapid errors
            for (let i = 0; i < 10; i++) {
              setTimeout(() => {
                try {
                  triggerError();
                } catch (e) {
                  // Re-throw to make uncaught
                  setTimeout(() => { throw e; }, 1);
                }
              }, i * 10);
            }
          }, 100);
        </script>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);
      session.startErrorPolling(25); // Fast polling for rapid errors

      // Wait for all errors to occur
      await new Promise(resolve => setTimeout(resolve, 2000));

      session.stopErrorPolling();
      await session.retrieveCapturedJavaScriptErrors();

      const errors = session.getCapturedJavaScriptErrors();
      const rapidErrors = errors.filter(err =>
        err.message.includes('RapidError')
      );

      // Should capture most if not all rapid errors
      expect(rapidErrors.length).toBeGreaterThanOrEqual(5);
      expect(rapidErrors.length).toBeLessThanOrEqual(10);

      // Verify each error has proper metadata
      rapidErrors.forEach(error => {
        expect(error.uncaught).toBe(true);
        expect(error.name).toBe('Error');
        expect(error.timestamp).toBeDefined();
        expect(error.stack).toBeDefined();
      });
    }, 45000);

    it('should capture errors from dynamically loaded content', async () => {
      const html = `
        <html>
          <body>
            <script>
              setTimeout(() => {
                // Dynamically add script with error
                const script = document.createElement('script');
                script.textContent = \`
                  setTimeout(() => {
                    throw new Error('DynamicScriptError: From dynamically loaded script');
                  }, 50);
                \`;
                document.head.appendChild(script);
              }, 100);
            </script>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);
      session.startErrorPolling(50);

      await new Promise(resolve => setTimeout(resolve, 1000));

      session.stopErrorPolling();
      await session.retrieveCapturedJavaScriptErrors();

      const errors = session.getCapturedJavaScriptErrors();
      const dynamicError = errors.find(err =>
        err.message.includes('DynamicScriptError')
      );

      expect(dynamicError).toBeDefined();
      expect(dynamicError?.uncaught).toBe(true);
      expect(dynamicError?.stack).toBeDefined();
    }, 30000);
  });

  describe('Real Browser Error Scenarios', () => {
    let session: BrowserSession;

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

    afterEach(async () => {
      if (session) {
        await session.close();
      }
    });

    it('should capture errors from iframes', async () => {
      const iframeHtml = `
        <script>
          setTimeout(() => {
            throw new Error('IFrameError: Error from within iframe');
          }, 100);
        </script>
      `;

      const mainHtml = `
        <html>
          <body>
            <h1>Main Page</h1>
            <iframe src="data:text/html,${encodeURIComponent(iframeHtml)}" width="400" height="200"></iframe>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(mainHtml)}`);
      session.startErrorPolling(50);

      await new Promise(resolve => setTimeout(resolve, 1000));

      session.stopErrorPolling();
      await session.retrieveCapturedJavaScriptErrors();

      const errors = session.getCapturedJavaScriptErrors();
      const iframeError = errors.find(err =>
        err.message.includes('IFrameError')
      );

      expect(iframeError).toBeDefined();
      expect(iframeError?.uncaught).toBe(true);
    }, 30000);

    it('should handle different error types correctly', async () => {
      const html = `
        <script>
          const errorTypes = [
            () => { throw new ReferenceError('ReferenceError test'); },
            () => { throw new TypeError('TypeError test'); },
            () => { throw new SyntaxError('SyntaxError test'); },
            () => { throw new URIError('URIError test'); }
          ];

          errorTypes.forEach((errorFn, index) => {
            setTimeout(() => {
              try {
                errorFn();
              } catch (e) {
                setTimeout(() => { throw e; }, 1);
              }
            }, (index + 1) * 100);
          });
        </script>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);
      session.startErrorPolling(50);

      await new Promise(resolve => setTimeout(resolve, 1500));

      session.stopErrorPolling();
      await session.retrieveCapturedJavaScriptErrors();

      const errors = session.getCapturedJavaScriptErrors();

      const referenceError = errors.find(err => err.name === 'ReferenceError');
      const typeError = errors.find(err => err.name === 'TypeError');
      const syntaxError = errors.find(err => err.name === 'SyntaxError');
      const uriError = errors.find(err => err.name === 'URIError');

      expect(referenceError).toBeDefined();
      expect(typeError).toBeDefined();
      expect(syntaxError).toBeDefined();
      expect(uriError).toBeDefined();

      // Verify each error has proper attributes
      [referenceError, typeError, syntaxError, uriError].forEach(error => {
        if (error) {
          expect(error.uncaught).toBe(true);
          expect(error.timestamp).toBeDefined();
          expect(error.stack).toBeDefined();
        }
      });
    }, 30000);
  });
});