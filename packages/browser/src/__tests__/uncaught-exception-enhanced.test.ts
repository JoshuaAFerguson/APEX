/**
 * @apexcli/browser - Enhanced Uncaught Exception Detection Tests
 *
 * Comprehensive tests for uncaught exception detection with detailed stack traces
 * and various error scenarios beyond the existing error-detection.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';
import type { CapturedJavaScriptError, PageErrorEvent } from '../types.js';

describe('Enhanced Uncaught Exception Detection', () => {
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

  describe('Advanced Stack Trace Analysis', () => {
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

    it('should capture detailed stack traces with file, line, and column information', async () => {
      const html = `
        <script>
          function deepFunction1() {
            deepFunction2();
          }

          function deepFunction2() {
            deepFunction3();
          }

          function deepFunction3() {
            deepFunction4();
          }

          function deepFunction4() {
            deepFunction5();
          }

          function deepFunction5() {
            // This will create a detailed stack trace
            throw new Error('Deep stack trace error');
          }

          setTimeout(() => {
            try {
              deepFunction1();
            } catch (e) {
              // Re-throw to make it uncaught
              setTimeout(() => { throw e; }, 10);
            }
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(50);

      await new Promise(resolve => setTimeout(resolve, 400));

      await session.retrieveCapturedJavaScriptErrors();
      const errors = session.getCapturedJavaScriptErrors();
      const deepStackError = errors.find(err => err.message.includes('Deep stack trace error'));

      expect(deepStackError).toBeDefined();
      expect(deepStackError!.stack).toBeDefined();
      expect(deepStackError!.stack!.length).toBeGreaterThan(50);

      // Should contain function names in stack
      expect(deepStackError!.stack!).toContain('deepFunction5');
      expect(deepStackError!.stack!).toContain('deepFunction4');
      expect(deepStackError!.stack!).toContain('deepFunction3');
      expect(deepStackError!.stack!).toContain('deepFunction2');
      expect(deepStackError!.stack!).toContain('deepFunction1');

      // Verify source location is captured
      if (deepStackError!.source) {
        expect(deepStackError!.source.url).toBeDefined();
        expect(deepStackError!.source.line).toBeGreaterThan(0);
        expect(deepStackError!.source.column).toBeGreaterThan(0);
      }

      session.stopErrorPolling();
    });

    it('should capture stack traces from async function errors', async () => {
      const html = `
        <script>
          async function asyncLevel1() {
            return await asyncLevel2();
          }

          async function asyncLevel2() {
            return await asyncLevel3();
          }

          async function asyncLevel3() {
            await new Promise(resolve => setTimeout(resolve, 10));
            throw new Error('Async stack trace error');
          }

          setTimeout(async () => {
            try {
              await asyncLevel1();
            } catch (e) {
              // Make it uncaught
              setTimeout(() => { throw e; }, 10);
            }
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(50);

      await new Promise(resolve => setTimeout(resolve, 400));

      await session.retrieveCapturedJavaScriptErrors();
      const errors = session.getCapturedJavaScriptErrors();
      const asyncError = errors.find(err => err.message.includes('Async stack trace error'));

      expect(asyncError).toBeDefined();
      expect(asyncError!.stack).toBeDefined();
      expect(asyncError!.uncaught).toBe(true);

      // Async stack traces should contain function names
      expect(asyncError!.stack!).toContain('asyncLevel3');

      session.stopErrorPolling();
    });

    it('should capture stack traces from promise chain errors', async () => {
      const html = `
        <script>
          function promiseChain1() {
            return Promise.resolve()
              .then(() => promiseChain2())
              .then(() => promiseChain3());
          }

          function promiseChain2() {
            return new Promise((resolve) => {
              setTimeout(() => resolve('level2'), 10);
            });
          }

          function promiseChain3() {
            return new Promise((resolve, reject) => {
              setTimeout(() => {
                reject(new Error('Promise chain error'));
              }, 10);
            });
          }

          setTimeout(() => {
            promiseChain1().catch(e => {
              // Make the promise rejection uncaught
              setTimeout(() => { throw e; }, 10);
            });
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(50);

      await new Promise(resolve => setTimeout(resolve, 500));

      await session.retrieveCapturedJavaScriptErrors();
      const errors = session.getCapturedJavaScriptErrors();
      const promiseChainError = errors.find(err => err.message.includes('Promise chain error'));

      expect(promiseChainError).toBeDefined();
      expect(promiseChainError!.uncaught).toBe(true);

      if (promiseChainError!.stack) {
        expect(promiseChainError!.stack.length).toBeGreaterThan(0);
      }

      session.stopErrorPolling();
    });

    it('should capture stack traces from event handler errors', async () => {
      const html = `
        <button id="errorButton">Click Me</button>
        <script>
          function handleClick() {
            nestedEventFunction();
          }

          function nestedEventFunction() {
            deeperEventFunction();
          }

          function deeperEventFunction() {
            throw new Error('Event handler stack trace error');
          }

          document.getElementById('errorButton').addEventListener('click', handleClick);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(50);

      // Trigger the error by clicking the button
      await session.click('#errorButton');

      await new Promise(resolve => setTimeout(resolve, 300));

      await session.retrieveCapturedJavaScriptErrors();
      const errors = session.getCapturedJavaScriptErrors();
      const eventError = errors.find(err => err.message.includes('Event handler stack trace error'));

      expect(eventError).toBeDefined();
      expect(eventError!.stack).toBeDefined();

      // Event handler stack traces should contain function names
      expect(eventError!.stack!).toContain('deeperEventFunction');
      expect(eventError!.stack!).toContain('nestedEventFunction');
      expect(eventError!.stack!).toContain('handleClick');

      session.stopErrorPolling();
    });
  });

  describe('Error Types and Classification', () => {
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

    it('should properly classify ReferenceError with stack traces', async () => {
      const html = `
        <script>
          function triggerReferenceError() {
            nonExistentFunction();
          }

          setTimeout(() => {
            try {
              triggerReferenceError();
            } catch (e) {
              setTimeout(() => { throw e; }, 10);
            }
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(50);

      await new Promise(resolve => setTimeout(resolve, 300));

      await session.retrieveCapturedJavaScriptErrors();
      const errors = session.getCapturedJavaScriptErrors();
      const refError = errors.find(err =>
        err.name === 'ReferenceError' || err.message.includes('nonExistentFunction')
      );

      expect(refError).toBeDefined();
      expect(refError!.name).toBe('ReferenceError');
      expect(refError!.uncaught).toBe(true);
      expect(refError!.stack).toBeDefined();
      expect(refError!.stack!).toContain('triggerReferenceError');

      session.stopErrorPolling();
    });

    it('should properly classify TypeError with detailed context', async () => {
      const html = `
        <script>
          function triggerTypeError() {
            const nullObj = null;
            nullObj.someMethod(); // This will throw TypeError
          }

          setTimeout(() => {
            try {
              triggerTypeError();
            } catch (e) {
              setTimeout(() => { throw e; }, 10);
            }
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(50);

      await new Promise(resolve => setTimeout(resolve, 300));

      await session.retrieveCapturedJavaScriptErrors();
      const errors = session.getCapturedJavaScriptErrors();
      const typeError = errors.find(err =>
        err.name === 'TypeError' || err.message.toLowerCase().includes('cannot read prop')
      );

      expect(typeError).toBeDefined();
      expect(typeError!.name).toBe('TypeError');
      expect(typeError!.uncaught).toBe(true);
      expect(typeError!.stack).toBeDefined();

      session.stopErrorPolling();
    });

    it('should capture custom error types with inheritance', async () => {
      const html = `
        <script>
          class CustomError extends Error {
            constructor(message) {
              super(message);
              this.name = 'CustomError';
              this.customProperty = 'custom value';
            }
          }

          class BusinessLogicError extends CustomError {
            constructor(message, code) {
              super(message);
              this.name = 'BusinessLogicError';
              this.errorCode = code;
            }
          }

          function throwCustomError() {
            throw new BusinessLogicError('Business logic failed', 'BL001');
          }

          setTimeout(() => {
            try {
              throwCustomError();
            } catch (e) {
              setTimeout(() => { throw e; }, 10);
            }
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(50);

      await new Promise(resolve => setTimeout(resolve, 300));

      await session.retrieveCapturedJavaScriptErrors();
      const errors = session.getCapturedJavaScriptErrors();
      const customError = errors.find(err =>
        err.name === 'BusinessLogicError' || err.message.includes('Business logic failed')
      );

      expect(customError).toBeDefined();
      expect(customError!.name).toBe('BusinessLogicError');
      expect(customError!.message).toContain('Business logic failed');
      expect(customError!.uncaught).toBe(true);
      expect(customError!.stack).toBeDefined();

      session.stopErrorPolling();
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

    it('should capture errors from dynamically loaded scripts', async () => {
      const html = `
        <script>
          function loadDynamicScript() {
            const script = document.createElement('script');
            script.textContent = \`
              function dynamicFunction() {
                throw new Error('Dynamic script error');
              }
              setTimeout(() => {
                try {
                  dynamicFunction();
                } catch (e) {
                  setTimeout(() => { throw e; }, 10);
                }
              }, 100);
            \`;
            document.head.appendChild(script);
          }

          setTimeout(() => loadDynamicScript(), 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(50);

      await new Promise(resolve => setTimeout(resolve, 500));

      await session.retrieveCapturedJavaScriptErrors();
      const errors = session.getCapturedJavaScriptErrors();
      const dynamicError = errors.find(err => err.message.includes('Dynamic script error'));

      expect(dynamicError).toBeDefined();
      expect(dynamicError!.uncaught).toBe(true);

      if (dynamicError!.stack) {
        expect(dynamicError!.stack).toContain('dynamicFunction');
      }

      session.stopErrorPolling();
    });

    it('should capture errors from Web Workers when possible', async () => {
      const html = `
        <script>
          // Create a worker that will throw an error
          const workerScript = \`
            self.onmessage = function(e) {
              if (e.data === 'throw') {
                throw new Error('Worker error');
              }
            };
          \`;

          const blob = new Blob([workerScript], { type: 'application/javascript' });
          const worker = new Worker(URL.createObjectURL(blob));

          worker.onerror = function(event) {
            // Re-throw worker error in main thread
            setTimeout(() => {
              throw new Error('Worker error: ' + event.message);
            }, 10);
          };

          setTimeout(() => {
            worker.postMessage('throw');
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(50);

      await new Promise(resolve => setTimeout(resolve, 500));

      await session.retrieveCapturedJavaScriptErrors();
      const errors = session.getCapturedJavaScriptErrors();
      const workerError = errors.find(err => err.message.includes('Worker error'));

      if (workerError) {
        expect(workerError.uncaught).toBe(true);
        expect(workerError.message).toContain('Worker error');
      }

      session.stopErrorPolling();
    });

    it('should capture errors from setTimeout and setInterval callbacks', async () => {
      const html = `
        <script>
          // setTimeout error
          setTimeout(() => {
            throw new Error('setTimeout callback error');
          }, 50);

          // setInterval error
          let intervalCount = 0;
          const intervalId = setInterval(() => {
            intervalCount++;
            if (intervalCount === 2) {
              clearInterval(intervalId);
              throw new Error('setInterval callback error');
            }
          }, 75);

          // Nested setTimeout error
          setTimeout(() => {
            setTimeout(() => {
              throw new Error('Nested setTimeout error');
            }, 25);
          }, 100);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(25);

      await new Promise(resolve => setTimeout(resolve, 500));

      await session.retrieveCapturedJavaScriptErrors();
      const errors = session.getCapturedJavaScriptErrors();

      const setTimeoutError = errors.find(err => err.message.includes('setTimeout callback error'));
      const setIntervalError = errors.find(err => err.message.includes('setInterval callback error'));
      const nestedError = errors.find(err => err.message.includes('Nested setTimeout error'));

      expect(setTimeoutError).toBeDefined();
      expect(setTimeoutError!.uncaught).toBe(true);

      expect(setIntervalError).toBeDefined();
      expect(setIntervalError!.uncaught).toBe(true);

      expect(nestedError).toBeDefined();
      expect(nestedError!.uncaught).toBe(true);

      session.stopErrorPolling();
    });

    it('should capture errors from fetch and XMLHttpRequest failures', async () => {
      const html = `
        <script>
          // Fetch error
          fetch('https://nonexistent-domain-12345.com/api')
            .catch(err => {
              // Re-throw to make it uncaught
              setTimeout(() => {
                throw new Error('Fetch error: ' + err.message);
              }, 10);
            });

          // XMLHttpRequest error
          setTimeout(() => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', 'https://another-nonexistent-domain-67890.com/data');
            xhr.onerror = function() {
              throw new Error('XHR error: Network failure');
            };
            xhr.send();
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(50);

      await new Promise(resolve => setTimeout(resolve, 1000));

      await session.retrieveCapturedJavaScriptErrors();
      const errors = session.getCapturedJavaScriptErrors();

      const fetchError = errors.find(err => err.message.includes('Fetch error'));
      const xhrError = errors.find(err => err.message.includes('XHR error'));

      // Note: These might not always trigger depending on browser security policies
      // But if they do, they should be captured correctly
      if (fetchError) {
        expect(fetchError.uncaught).toBe(true);
      }
      if (xhrError) {
        expect(xhrError.uncaught).toBe(true);
      }

      session.stopErrorPolling();
    });
  });

  describe('Error Source Mapping and Location Accuracy', () => {
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

    it('should accurately report line and column numbers for inline scripts', async () => {
      const html = `
        <script>
          // Line 2
          // Line 3
          function errorAtKnownLocation() {
            // Line 5 - this comment helps identify the location
            throw new Error('Error at known location'); // This should be around line 6
          }
          // Line 8
          setTimeout(() => {
            try {
              errorAtKnownLocation(); // Line 11
            } catch (e) {
              setTimeout(() => { throw e; }, 10);
            }
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(50);

      await new Promise(resolve => setTimeout(resolve, 300));

      await session.retrieveCapturedJavaScriptErrors();
      const errors = session.getCapturedJavaScriptErrors();
      const locationError = errors.find(err => err.message.includes('Error at known location'));

      expect(locationError).toBeDefined();

      if (locationError!.source) {
        expect(locationError!.source.url).toBeDefined();
        expect(locationError!.source.line).toBeGreaterThan(0);
        expect(locationError!.source.column).toBeGreaterThan(0);

        // The error should be around line 6 (allowing for some variance)
        expect(locationError!.source.line).toBeGreaterThanOrEqual(5);
        expect(locationError!.source.line).toBeLessThanOrEqual(8);
      }

      session.stopErrorPolling();
    });

    it('should handle errors in eval\'d code with source mapping', async () => {
      const html = `
        <script>
          function executeEvalCode() {
            const code = \`
              function evalFunction() {
                throw new Error('Error from eval code');
              }
              evalFunction();
            \`;
            eval(code);
          }

          setTimeout(() => {
            try {
              executeEvalCode();
            } catch (e) {
              setTimeout(() => { throw e; }, 10);
            }
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(50);

      await new Promise(resolve => setTimeout(resolve, 300));

      await session.retrieveCapturedJavaScriptErrors();
      const errors = session.getCapturedJavaScriptErrors();
      const evalError = errors.find(err => err.message.includes('Error from eval code'));

      expect(evalError).toBeDefined();
      expect(evalError!.uncaught).toBe(true);

      // Stack trace should contain both eval context and original function
      if (evalError!.stack) {
        expect(evalError!.stack).toContain('evalFunction');
      }

      session.stopErrorPolling();
    });
  });

  describe('Multi-threaded Error Capture', () => {
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

    it('should capture multiple simultaneous uncaught exceptions', async () => {
      const html = `
        <script>
          // Generate multiple errors simultaneously
          setTimeout(() => { throw new Error('Concurrent error 1'); }, 50);
          setTimeout(() => { throw new Error('Concurrent error 2'); }, 55);
          setTimeout(() => { throw new Error('Concurrent error 3'); }, 60);
          setTimeout(() => { throw new Error('Concurrent error 4'); }, 65);
          setTimeout(() => { throw new Error('Concurrent error 5'); }, 70);

          // Also generate some from different sources
          setTimeout(() => {
            document.body.addEventListener('custom-event', () => {
              throw new Error('Event-driven concurrent error');
            });
            document.body.dispatchEvent(new Event('custom-event'));
          }, 75);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(25);

      await new Promise(resolve => setTimeout(resolve, 500));

      await session.retrieveCapturedJavaScriptErrors();
      const errors = session.getCapturedJavaScriptErrors();

      const concurrentErrors = errors.filter(err => err.message.includes('Concurrent error'));
      const eventError = errors.find(err => err.message.includes('Event-driven concurrent error'));

      expect(concurrentErrors.length).toBeGreaterThanOrEqual(5);
      expect(eventError).toBeDefined();

      // All errors should be marked as uncaught
      concurrentErrors.forEach(error => {
        expect(error.uncaught).toBe(true);
        expect(error.timestamp).toBeGreaterThan(0);
      });

      if (eventError) {
        expect(eventError.uncaught).toBe(true);
      }

      // Verify timestamps are in reasonable order
      const sortedErrors = errors.sort((a, b) => a.timestamp - b.timestamp);
      for (let i = 1; i < sortedErrors.length; i++) {
        expect(sortedErrors[i].timestamp).toBeGreaterThanOrEqual(sortedErrors[i - 1].timestamp);
      }

      session.stopErrorPolling();
    });

    it('should handle error capture under high load conditions', async () => {
      const html = `
        <script>
          // Create high-frequency error generation
          function generateRapidErrors() {
            for (let i = 0; i < 20; i++) {
              setTimeout(() => {
                throw new Error('Rapid error ' + i);
              }, i * 5);
            }
          }

          // Start multiple rapid error generators
          setTimeout(() => generateRapidErrors(), 50);
          setTimeout(() => generateRapidErrors(), 100);
          setTimeout(() => generateRapidErrors(), 150);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(10); // Very frequent polling

      await new Promise(resolve => setTimeout(resolve, 800));

      await session.retrieveCapturedJavaScriptErrors();
      const errors = session.getCapturedJavaScriptErrors();

      const rapidErrors = errors.filter(err => err.message.includes('Rapid error'));

      // Should capture a significant number of rapid errors
      expect(rapidErrors.length).toBeGreaterThanOrEqual(40); // Allow for some loss under high load

      // All should be uncaught
      rapidErrors.forEach(error => {
        expect(error.uncaught).toBe(true);
        expect(error.name).toBe('Error');
        expect(error.timestamp).toBeGreaterThan(0);
      });

      session.stopErrorPolling();
    });
  });

  describe('Page Error Event Integration', () => {
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

    it('should coordinate JavaScript errors with page error events', async () => {
      const capturedPageErrors: PageErrorEvent[] = [];

      session.on('pageError', (error) => {
        capturedPageErrors.push(error);
      });

      const html = `
        <script>
          setTimeout(() => {
            throw new Error('Coordinated error test');
          }, 50);
        </script>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      session.startErrorPolling(50);

      await new Promise(resolve => setTimeout(resolve, 300));

      await session.retrieveCapturedJavaScriptErrors();
      const jsErrors = session.getCapturedJavaScriptErrors();
      const pageErrors = session.getCapturedPageErrors();

      const coordinatedJsError = jsErrors.find(err => err.message.includes('Coordinated error test'));
      const coordinatedPageError = capturedPageErrors.find(err => err.message.includes('Coordinated error test'));

      expect(coordinatedJsError).toBeDefined();
      expect(coordinatedPageError).toBeDefined();

      // Both should represent the same error
      expect(coordinatedJsError!.message).toEqual(coordinatedPageError!.message);
      expect(coordinatedJsError!.uncaught).toBe(true);

      // Timestamps should be close
      const timeDiff = Math.abs(coordinatedJsError!.timestamp - coordinatedPageError!.timestamp);
      expect(timeDiff).toBeLessThan(100); // Within 100ms

      session.stopErrorPolling();
    });
  });
});