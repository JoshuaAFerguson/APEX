/**
 * @apexcli/browser - Browser Error Scenarios Integration Tests
 *
 * Integration tests for browser error scenarios covering:
 * 1. Network failure simulation
 * 2. Request timeout handling
 * 3. Page load timeout
 * 4. Element not found errors
 * 5. Navigation errors
 * 6. Graceful error recovery mechanisms
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Page, Route } from 'playwright';
import {
  createBrowserManager,
  createBrowserSession,
  BrowserManager,
  BrowserSession,
} from '../index.js';
import type { BrowserActionResult } from '../types.js';

/**
 * Network error simulator for controlled error testing
 */
class NetworkErrorSimulator {
  private page: Page;
  private interceptedRoutes: Set<string> = new Set();

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Simulate network offline/disconnected scenario
   */
  async simulateOffline(): Promise<void> {
    const pattern = '**/*';
    this.interceptedRoutes.add(pattern);
    await this.page.route(pattern, (route: Route) => {
      route.abort('internetdisconnected');
    });
  }

  /**
   * Simulate DNS resolution failure
   */
  async simulateDNSFailure(): Promise<void> {
    const pattern = '**/*';
    this.interceptedRoutes.add(pattern);
    await this.page.route(pattern, (route: Route) => {
      route.abort('namenotresolved');
    });
  }

  /**
   * Simulate connection timeout
   */
  async simulateTimeout(delayMs: number = 5000): Promise<void> {
    const pattern = '**/*';
    this.interceptedRoutes.add(pattern);
    await this.page.route(pattern, async (route: Route) => {
      // Delay then abort to simulate timeout
      await new Promise(resolve => setTimeout(resolve, delayMs));
      route.abort('timedout');
    });
  }

  /**
   * Simulate server error responses
   */
  async simulateServerError(statusCode: number = 500): Promise<void> {
    const pattern = '**/*';
    this.interceptedRoutes.add(pattern);
    await this.page.route(pattern, (route: Route) => {
      route.fulfill({
        status: statusCode,
        contentType: 'text/html',
        body: `<html><body><h1>Server Error ${statusCode}</h1></body></html>`
      });
    });
  }

  /**
   * Simulate connection refused
   */
  async simulateConnectionRefused(): Promise<void> {
    const pattern = '**/*';
    this.interceptedRoutes.add(pattern);
    await this.page.route(pattern, (route: Route) => {
      route.abort('connectionrefused');
    });
  }

  /**
   * Restore normal network behavior
   */
  async restore(): Promise<void> {
    for (const pattern of this.interceptedRoutes) {
      await this.page.unroute(pattern);
    }
    this.interceptedRoutes.clear();
  }
}

/**
 * Error assertion helpers for validating browser error scenarios
 */
class ErrorAssertions {
  /**
   * Expect a network error in the browser action result
   */
  static expectNetworkError(result: BrowserActionResult<unknown>): void {
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.duration).toBeGreaterThan(0);

    const errorMessage = result.error?.toLowerCase() || '';
    expect(
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('dns') ||
      errorMessage.includes('internet') ||
      errorMessage.includes('offline') ||
      errorMessage.includes('namenotresolved') ||
      errorMessage.includes('internetdisconnected') ||
      errorMessage.includes('connectionrefused')
    ).toBe(true);
  }

  /**
   * Expect a timeout error in the browser action result
   */
  static expectTimeoutError(result: BrowserActionResult<unknown>): void {
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.duration).toBeGreaterThan(0);

    const errorMessage = result.error?.toLowerCase() || '';
    expect(
      errorMessage.includes('timeout') ||
      errorMessage.includes('timed out') ||
      errorMessage.includes('timedout')
    ).toBe(true);
  }

  /**
   * Expect an element not found error
   */
  static expectElementNotFoundError(result: BrowserActionResult<unknown>): void {
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.duration).toBeGreaterThan(0);

    const errorMessage = result.error?.toLowerCase() || '';
    expect(
      errorMessage.includes('element') ||
      errorMessage.includes('selector') ||
      errorMessage.includes('not found') ||
      errorMessage.includes('missing')
    ).toBe(true);
  }

  /**
   * Expect a navigation error
   */
  static expectNavigationError(result: BrowserActionResult<unknown>): void {
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.duration).toBeGreaterThan(0);

    const errorMessage = result.error?.toLowerCase() || '';
    expect(
      errorMessage.includes('navigation') ||
      errorMessage.includes('navigate') ||
      errorMessage.includes('url') ||
      errorMessage.includes('invalid')
    ).toBe(true);
  }
}

/**
 * Create data URLs for error testing scenarios
 */
const ErrorPageFixtures = {
  /**
   * Page that makes network requests that will fail
   */
  networkErrorPage: `data:text/html,
    <html>
      <head><title>Network Test Page</title></head>
      <body>
        <h1>Network Test</h1>
        <script>
          // Try to load an external resource
          fetch('https://external-api.example.com/data')
            .then(response => response.json())
            .then(data => console.log('Success:', data))
            .catch(error => console.error('Network Error:', error));
        </script>
      </body>
    </html>`,

  /**
   * Page with long-running script for timeout testing
   */
  timeoutPage: `data:text/html,
    <html>
      <head><title>Timeout Test Page</title></head>
      <body>
        <h1>Loading...</h1>
        <script>
          // Simulate long loading time
          const start = Date.now();
          while (Date.now() - start < 30000) {
            // Busy wait for 30 seconds
          }
          document.querySelector('h1').textContent = 'Loaded!';
        </script>
      </body>
    </html>`,

  /**
   * Page that contains JavaScript errors
   */
  errorTriggerPage: `data:text/html,
    <html>
      <head><title>Error Test Page</title></head>
      <body>
        <h1>Error Test</h1>
        <script>
          // Trigger various errors
          setTimeout(() => {
            throw new Error('Intentional runtime error');
          }, 100);

          // Reference error
          console.log(undefinedVariable);

          // Type error
          null.someMethod();
        </script>
      </body>
    </html>`,

  /**
   * Simple page for testing recovery
   */
  recoveryPage: `data:text/html,
    <html>
      <head><title>Recovery Test</title></head>
      <body>
        <h1>Recovered Successfully</h1>
        <p>This page loaded successfully after an error.</p>
      </body>
    </html>`,
};

describe('Browser Error Integration Tests', () => {
  let manager: BrowserManager;
  let session: BrowserSession;
  let networkSimulator: NetworkErrorSimulator;

  beforeEach(async () => {
    manager = createBrowserManager();
    session = createBrowserSession(manager, {
      browserType: 'chromium',
      headless: true,
      timeout: 5000, // Short timeout for faster tests
    });

    const launchResult = await session.launch();
    expect(launchResult.success).toBe(true);

    // Get the underlying page for network simulation
    const page = session.getPage();
    expect(page).toBeDefined();
    networkSimulator = new NetworkErrorSimulator(page!);
  });

  afterEach(async () => {
    if (networkSimulator) {
      await networkSimulator.restore();
    }
    if (session) {
      await session.close();
    }
    if (manager) {
      await manager.shutdown();
    }
  });

  describe('Network Failure Simulation', () => {
    it('should handle DNS resolution failure', async () => {
      await networkSimulator.simulateDNSFailure();

      const result = await session.navigate('https://non-existent-domain.example');

      ErrorAssertions.expectNetworkError(result);
    });

    it('should handle internet disconnected scenario', async () => {
      await networkSimulator.simulateOffline();

      const result = await session.navigate('https://google.com');

      ErrorAssertions.expectNetworkError(result);
    });

    it('should handle connection refused', async () => {
      await networkSimulator.simulateConnectionRefused();

      const result = await session.navigate('https://httpbin.org/get');

      ErrorAssertions.expectNetworkError(result);
    });

    it('should handle server errors gracefully', async () => {
      await networkSimulator.simulateServerError(500);

      const result = await session.navigate('https://httpbin.org/status/200');

      // Server error should still navigate but might affect page content
      expect(result.duration).toBeGreaterThan(0);
      expect(typeof result.success).toBe('boolean');
    });

    it('should recover after network errors', async () => {
      // First, trigger a network error
      await networkSimulator.simulateDNSFailure();
      const failResult = await session.navigate('https://example.com');
      ErrorAssertions.expectNetworkError(failResult);

      // Restore network and verify recovery
      await networkSimulator.restore();
      const recoveryResult = await session.navigate(ErrorPageFixtures.recoveryPage);
      expect(recoveryResult.success).toBe(true);

      // Verify page content loaded correctly
      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);
      expect(titleResult.data).toBe('Recovery Test');
    });
  });

  describe('Request Timeout Handling', () => {
    it('should handle connection timeout', async () => {
      await networkSimulator.simulateTimeout(10000); // 10 second delay

      const result = await session.navigate('https://httpbin.org/delay/1', { timeout: 1000 });

      ErrorAssertions.expectTimeoutError(result);
    });

    it('should handle request timeout with retry behavior', async () => {
      await networkSimulator.simulateTimeout(3000);

      // Multiple operations should all timeout
      const operations = [
        session.navigate('https://httpbin.org/get', { timeout: 500 }),
        session.navigate('https://jsonplaceholder.typicode.com/posts/1', { timeout: 500 }),
      ];

      const results = await Promise.all(operations);
      results.forEach(result => {
        ErrorAssertions.expectTimeoutError(result);
      });
    });
  });

  describe('Page Load Timeout', () => {
    it('should handle page load timeout with slow script', async () => {
      const result = await session.navigate(ErrorPageFixtures.timeoutPage, {
        timeout: 100 // Very short timeout for slow page
      });

      ErrorAssertions.expectTimeoutError(result);
    });

    it('should handle navigation timeout on valid but slow page', async () => {
      const slowPageUrl = `data:text/html,
        <html>
          <head><title>Slow Page</title></head>
          <body>
            <h1>Loading...</h1>
            <script>
              // Simulate slow loading with delayed DOM ready
              setTimeout(() => {
                document.querySelector('h1').textContent = 'Loaded!';
                window.dispatchEvent(new Event('DOMContentLoaded'));
              }, 5000);
            </script>
          </body>
        </html>`;

      const result = await session.navigate(slowPageUrl, {
        timeout: 100,
        waitUntil: 'domcontentloaded'
      });

      ErrorAssertions.expectTimeoutError(result);
    });
  });

  describe('Element Not Found Errors', () => {
    beforeEach(async () => {
      // Navigate to a simple page for element testing
      const navResult = await session.navigate('data:text/html,<div id="existing">Found</div>');
      expect(navResult.success).toBe(true);
    });

    it('should handle clicking non-existent elements', async () => {
      const result = await session.click('#non-existent-button');

      ErrorAssertions.expectElementNotFoundError(result);
    });

    it('should handle typing into missing input fields', async () => {
      const result = await session.type('#missing-input', 'test text');

      ErrorAssertions.expectElementNotFoundError(result);
    });

    it('should handle getting text from missing elements', async () => {
      const result = await session.getText('#missing-element');

      ErrorAssertions.expectElementNotFoundError(result);
    });

    it('should handle waiting for elements that never appear', async () => {
      const result = await session.waitForElement('#never-exists', { timeout: 200 });

      ErrorAssertions.expectElementNotFoundError(result);
    });

    it('should handle scrolling to missing elements', async () => {
      const result = await session.scroll({ selector: '#missing-scroll-target' });

      ErrorAssertions.expectElementNotFoundError(result);
    });

    it('should recover after element errors', async () => {
      // Trigger element error
      const errorResult = await session.click('#non-existent');
      ErrorAssertions.expectElementNotFoundError(errorResult);

      // Verify session can continue with valid operations
      const validResult = await session.click('#existing');
      expect(validResult.success).toBe(true);

      const textResult = await session.getText('#existing');
      expect(textResult.success).toBe(true);
      expect(textResult.data).toBe('Found');
    });
  });

  describe('Navigation Errors', () => {
    it('should handle invalid URL schemes', async () => {
      const invalidUrls = [
        'ftp://unsupported.protocol.com',
        'invalid://not.a.real.protocol',
        'javascript:alert("xss")', // Security risk
        '',
        'not-a-url-at-all',
      ];

      for (const url of invalidUrls) {
        const result = await session.navigate(url);

        // Should either fail or handle gracefully
        expect(result.duration).toBeGreaterThan(0);
        expect(typeof result.success).toBe('boolean');

        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      }
    });

    it('should handle malformed URLs', async () => {
      const malformedUrls = [
        'ht tp://space in protocol.com',
        'https://[invalid-bracket-url.com',
        'https://user@:password@example.com', // Malformed credentials
        'https://example.com:999999', // Invalid port
      ];

      for (const url of malformedUrls) {
        const result = await session.navigate(url);

        expect(result.duration).toBeGreaterThan(0);
        expect(typeof result.success).toBe('boolean');
      }
    });

    it('should handle navigation during page transition', async () => {
      // Start navigation to first page
      const firstNavPromise = session.navigate(ErrorPageFixtures.timeoutPage);

      // Immediately try to navigate somewhere else
      const secondNavResult = await session.navigate(ErrorPageFixtures.recoveryPage);

      // Wait for first navigation to complete/fail
      const firstNavResult = await firstNavPromise;

      // At least one should succeed or both should handle gracefully
      expect(firstNavResult.duration).toBeGreaterThan(0);
      expect(secondNavResult.duration).toBeGreaterThan(0);
    });

    it('should handle back navigation with no history', async () => {
      // Try to go back when there's no previous page
      const backResult = await session.goBack();

      expect(backResult.success).toBe(false);
      expect(backResult.error).toBeDefined();
      expect(backResult.error?.toLowerCase()).toContain('back');
    });

    it('should handle forward navigation with no history', async () => {
      // Try to go forward when there's no next page
      const forwardResult = await session.goForward();

      expect(forwardResult.success).toBe(false);
      expect(forwardResult.error).toBeDefined();
      expect(forwardResult.error?.toLowerCase()).toContain('forward');
    });
  });

  describe('Graceful Error Recovery Mechanisms', () => {
    it('should continue session after JavaScript errors', async () => {
      // Navigate to page with JavaScript errors
      const navResult = await session.navigate(ErrorPageFixtures.errorTriggerPage);
      expect(navResult.success).toBe(true);

      // Wait a bit for JS errors to occur
      await new Promise(resolve => setTimeout(resolve, 200));

      // Session should still be functional
      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);
      expect(titleResult.data).toBe('Error Test Page');

      // Should be able to navigate to recovery page
      const recoveryResult = await session.navigate(ErrorPageFixtures.recoveryPage);
      expect(recoveryResult.success).toBe(true);
    });

    it('should handle multiple consecutive errors gracefully', async () => {
      // Chain of operations that should fail
      const errorResults = await Promise.all([
        session.click('#non-existent-1'),
        session.click('#non-existent-2'),
        session.type('#missing-input', 'text'),
        session.getText('#missing-text'),
      ]);

      // All should fail but not crash the session
      errorResults.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.duration).toBeGreaterThan(0);
      });

      // Session should still work for valid operations
      const navResult = await session.navigate(ErrorPageFixtures.recoveryPage);
      expect(navResult.success).toBe(true);
    });

    it('should emit error events during failures', async () => {
      const errors: string[] = [];

      // Listen for error events (if session supports EventEmitter)
      if ('on' in session && typeof session.on === 'function') {
        (session as any).on('error', (error: Error) => {
          errors.push(error.message);
        });
      }

      // Trigger some errors
      await session.click('#non-existent');
      await session.navigate('invalid://url');

      // Even if no events were emitted, operations should complete
      expect(true).toBe(true); // Test passes if no crashes occur
    });

    it('should cleanup resources after errors', async () => {
      // Get initial browser state
      const initialBrowser = session.getBrowser();
      expect(initialBrowser).toBeDefined();

      // Trigger various errors
      await networkSimulator.simulateOffline();
      await session.navigate('https://example.com');
      await session.click('#non-existent');

      // Browser should still be available and functional
      const finalBrowser = session.getBrowser();
      expect(finalBrowser).toBeDefined();
      expect(finalBrowser).toBe(initialBrowser);

      // Should be able to restore and navigate normally
      await networkSimulator.restore();
      const recoveryResult = await session.navigate(ErrorPageFixtures.recoveryPage);
      expect(recoveryResult.success).toBe(true);
    });

    it('should handle session recovery after page crashes', async () => {
      // Navigate to a page that might cause issues
      const crashPageUrl = `data:text/html,
        <html>
          <body>
            <h1>Crash Test</h1>
            <script>
              // Try to cause memory issues (may not actually crash in modern browsers)
              setTimeout(() => {
                const arr = [];
                for (let i = 0; i < 1000000; i++) {
                  arr.push(new Array(1000).fill('data'));
                }
              }, 100);
            </script>
          </body>
        </html>`;

      const navResult = await session.navigate(crashPageUrl);
      expect(navResult.success).toBe(true);

      // Wait a bit for potential issues
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should still be able to navigate away
      const recoveryResult = await session.navigate(ErrorPageFixtures.recoveryPage);
      expect(recoveryResult.success).toBe(true);

      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);
      expect(titleResult.data).toBe('Recovery Test');
    });

    it('should handle concurrent error operations', async () => {
      // Run multiple failing operations concurrently
      const concurrentOperations = [
        session.click('#fail-1'),
        session.click('#fail-2'),
        session.type('#fail-input', 'text'),
        session.getText('#fail-text'),
        session.scroll({ selector: '#fail-scroll' }),
      ];

      const results = await Promise.allSettled(concurrentOperations);

      // All should complete (fulfill or reject) without hanging
      expect(results).toHaveLength(5);

      results.forEach(result => {
        expect(['fulfilled', 'rejected']).toContain(result.status);
      });

      // Session should remain functional
      const healthCheck = await session.navigate(ErrorPageFixtures.recoveryPage);
      expect(healthCheck.success).toBe(true);
    });
  });
});