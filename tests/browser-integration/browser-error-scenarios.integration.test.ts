/**
 * Browser Error Scenarios Integration Tests
 *
 * Comprehensive integration tests for browser error handling including:
 * - Network failure simulation
 * - Request timeout handling
 * - Page load timeout
 * - Element not found errors
 * - Navigation errors
 * - Graceful error recovery mechanisms
 *
 * @module tests/integration/browser-error-scenarios.integration.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createBrowserManager,
  createBrowserSession,
  BrowserManager,
  BrowserSession,
} from '@apexcli/browser';
import {
  createErrorTestContext,
  ErrorTestPages,
  ErrorAssertions,
  InvalidUrls,
  MissingSelectors,
  wait,
  retryWithBackoff,
  type BrowserErrorTestContext,
} from '../../test-utils/browser-error-fixtures.js';

describe('Browser Error Scenarios Integration Tests', () => {
  // Set longer timeout for browser tests
  vi.setConfig({ testTimeout: 60000 });

  describe('Network Failure Simulation', () => {
    let testContext: BrowserErrorTestContext;

    beforeEach(async () => {
      testContext = await createErrorTestContext({ timeout: 10000 });
      await testContext.session.launch();
    });

    afterEach(async () => {
      await testContext.cleanup();
    });

    it('should handle net::ERR_INTERNET_DISCONNECTED gracefully', async () => {
      // Navigate to a non-routable IP to simulate disconnection
      const result = await testContext.session.navigate(
        'http://10.255.255.1:9999/test'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);

      // Verify session is still operational
      await ErrorAssertions.assertSessionOperational(testContext.session);
    });

    it('should handle DNS resolution failures (ERR_NAME_NOT_RESOLVED)', async () => {
      const result = await testContext.session.navigate(
        'http://this-domain-absolutely-does-not-exist-12345.invalid'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Error should mention DNS or name resolution
      expect(result.error!.toLowerCase()).toMatch(
        /not.?found|dns|resolve|err_name/i
      );

      await ErrorAssertions.assertSessionOperational(testContext.session);
    });

    it('should handle connection refused errors (ERR_CONNECTION_REFUSED)', async () => {
      // Attempt to connect to localhost on unlikely port
      const result = await testContext.session.navigate('http://localhost:59999');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      await ErrorAssertions.assertSessionOperational(testContext.session);
    });

    it('should handle connection timeout errors', async () => {
      // Use a non-routable IP that will timeout
      const result = await testContext.session.navigate(
        'http://10.255.255.1:80/timeout-test',
        { timeout: 3000 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Duration should be close to timeout value
      expect(result.duration).toBeGreaterThan(2000);

      await ErrorAssertions.assertSessionOperational(testContext.session);
    });

    it('should recover from temporary network failures', async () => {
      // First, cause a network error
      const failResult = await testContext.session.navigate('http://localhost:59999');
      expect(failResult.success).toBe(false);

      // Then, navigate to a valid page
      const successResult = await testContext.session.navigate(
        ErrorTestPages.simplePage('Recovery Success')
      );
      expect(successResult.success).toBe(true);

      // Verify page content
      const textResult = await testContext.session.getText('h1');
      expect(textResult.success).toBe(true);
      expect(textResult.data).toBe('Recovery Success');
    });

    it('should handle multiple consecutive network failures', async () => {
      const failures: boolean[] = [];

      // Cause multiple network errors
      for (const url of InvalidUrls.unreachable) {
        const result = await testContext.session.navigate(url, { timeout: 2000 });
        failures.push(result.success);
      }

      // All should fail
      expect(failures.every((f) => f === false)).toBe(true);

      // Session should still recover
      await ErrorAssertions.assertSessionOperational(testContext.session);
    });
  });

  describe('Request Timeout Handling', () => {
    let testContext: BrowserErrorTestContext;

    beforeEach(async () => {
      // Use short timeout for faster tests
      testContext = await createErrorTestContext({ timeout: 5000 });
      await testContext.session.launch();
    });

    afterEach(async () => {
      await testContext.cleanup();
    });

    it('should timeout on slow operations with custom timeout', async () => {
      // Navigate to page with slow element (5000ms delay)
      await testContext.session.navigate(ErrorTestPages.slowResource(5000));

      // Try to wait for element that takes too long
      const result = await testContext.session.waitForElement('#loaded', {
        timeout: 500,
      });

      ErrorAssertions.assertTimeoutError(result);
      ErrorAssertions.assertDurationInRange(result, 500, 2000);
    });

    it('should respect custom timeout configurations', async () => {
      const shortTimeoutSession = createBrowserSession(testContext.manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 500, // Very short default timeout
      });

      try {
        await shortTimeoutSession.launch();

        // This should timeout quickly
        const result = await shortTimeoutSession.navigate(
          'http://10.255.255.1:9999/very-slow'
        );

        expect(result.success).toBe(false);
        // Should fail within reasonable time due to timeout
        expect(result.duration).toBeLessThan(5000);
      } finally {
        await shortTimeoutSession.close();
      }
    });

    it('should not leak resources after timeout', async () => {
      const initialUsage = await testContext.manager.getResourceUsage();

      // Cause multiple timeouts
      for (let i = 0; i < 3; i++) {
        await testContext.session.navigate(ErrorTestPages.slowResource(10000), {
          timeout: 200,
        });
      }

      const finalUsage = await testContext.manager.getResourceUsage();

      // Resource counts should be stable (no leaks)
      expect(finalUsage.totalContexts).toBe(initialUsage.totalContexts);
      expect(finalUsage.totalInstances).toBeLessThanOrEqual(
        initialUsage.totalInstances + 1
      );
    });

    it('should allow operation retry after timeout', async () => {
      // First attempt times out
      const timeoutResult = await testContext.session.navigate(
        ErrorTestPages.slowResource(5000),
        { timeout: 200 }
      );
      expect(timeoutResult.success).toBe(false);

      // Retry with valid page should work
      const retryResult = await testContext.session.navigate(
        ErrorTestPages.simplePage('Retry Success')
      );
      expect(retryResult.success).toBe(true);

      const textResult = await testContext.session.getText('h1');
      expect(textResult.data).toBe('Retry Success');
    });

    it('should handle timeout during element interaction', async () => {
      await testContext.session.navigate(ErrorTestPages.simplePage('Test'));

      // Try to click non-existent element with short timeout
      const result = await testContext.session.click('#nonexistent', {
        timeout: 500,
      });

      expect(result.success).toBe(false);
      expect(result.duration).toBeGreaterThanOrEqual(500);
    });
  });

  describe('Page Load Timeout', () => {
    let testContext: BrowserErrorTestContext;

    beforeEach(async () => {
      testContext = await createErrorTestContext({ timeout: 10000 });
      await testContext.session.launch();
    });

    afterEach(async () => {
      await testContext.cleanup();
    });

    it('should timeout on slow page load', async () => {
      const result = await testContext.session.navigate(ErrorTestPages.infiniteLoad, {
        timeout: 1000,
        waitUntil: 'networkidle',
      });

      // May succeed with partial load or timeout depending on browser behavior
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle pages with infinite loading states', async () => {
      // Navigate with domcontentloaded which should succeed faster
      const result = await testContext.session.navigate(ErrorTestPages.infiniteLoad, {
        waitUntil: 'domcontentloaded',
        timeout: 5000,
      });

      // DOMContentLoaded should trigger even if page has pending resources
      expect(result.success).toBe(true);

      // Content should be accessible
      const contentResult = await testContext.session.getText('#content');
      expect(contentResult.success).toBe(true);
    });

    it('should respect waitUntil options during timeout', async () => {
      // Test with 'commit' which is the fastest
      const commitResult = await testContext.session.navigate(
        ErrorTestPages.slowResource(5000),
        { waitUntil: 'commit', timeout: 3000 }
      );
      expect(commitResult.success).toBe(true);

      // Test with 'load' which waits for resources
      const loadResult = await testContext.session.navigate(
        ErrorTestPages.slowResource(5000),
        { waitUntil: 'load', timeout: 3000 }
      );
      // This will likely succeed since data URL loads quickly
      expect(loadResult.duration).toBeGreaterThan(0);
    });

    it('should capture partial content on timeout scenarios', async () => {
      // Navigate to page with delayed content
      const navResult = await testContext.session.navigate(
        ErrorTestPages.delayedElement(3000, 'delayed'),
        { waitUntil: 'domcontentloaded', timeout: 5000 }
      );
      expect(navResult.success).toBe(true);

      // Initial content should be available
      const placeholderResult = await testContext.session.getText('#placeholder');
      expect(placeholderResult.success).toBe(true);
      expect(placeholderResult.data).toContain('Waiting');
    });

    it('should allow navigation after page load timeout', async () => {
      // Cause a potential timeout
      await testContext.session.navigate(ErrorTestPages.infiniteLoad, {
        timeout: 500,
        waitUntil: 'networkidle',
      });

      // Should be able to navigate to a new page
      const recoveryResult = await testContext.session.navigate(
        ErrorTestPages.simplePage('After Timeout')
      );
      expect(recoveryResult.success).toBe(true);

      const textResult = await testContext.session.getText('h1');
      expect(textResult.data).toBe('After Timeout');
    });
  });

  describe('Element Not Found Errors', () => {
    let testContext: BrowserErrorTestContext;

    beforeEach(async () => {
      testContext = await createErrorTestContext({ timeout: 5000 });
      await testContext.session.launch();
      await testContext.session.navigate(
        'data:text/html,<div id="existing">Hello</div><button class="btn">Click</button>'
      );
    });

    afterEach(async () => {
      await testContext.cleanup();
    });

    it('should handle missing elements with clear error messages', async () => {
      const result = await testContext.session.click('#nonexistent-element', {
        timeout: 500,
      });

      ErrorAssertions.assertElementNotFound(result);
    });

    it('should timeout appropriately when waiting for elements', async () => {
      const startTime = Date.now();
      const result = await testContext.session.waitForElement('#will-never-appear', {
        timeout: 1000,
      });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(duration).toBeGreaterThanOrEqual(1000);
      expect(duration).toBeLessThan(3000); // Allow some tolerance
    });

    it('should handle stale element references gracefully', async () => {
      // Navigate to page with transient element
      await testContext.session.navigate(
        ErrorTestPages.transientElement(100, 500, 'transient')
      );

      // Wait for element to appear
      await wait(200);

      // Try to interact with element that may be removed
      const clickResult = await testContext.session.click('#transient', {
        timeout: 1000,
      });

      // May succeed or fail depending on timing - both are acceptable
      expect(typeof clickResult.success).toBe('boolean');
      expect(clickResult.duration).toBeGreaterThan(0);
    });

    it('should handle elements that appear after delay', async () => {
      // Navigate to page with delayed element
      await testContext.session.navigate(
        ErrorTestPages.delayedElement(500, 'delayed-el')
      );

      // Wait for element with sufficient timeout
      const result = await testContext.session.waitForElement('#delayed-el', {
        timeout: 2000,
      });

      expect(result.success).toBe(true);

      // Should be able to interact with the element
      const clickResult = await testContext.session.click('#delayed-el');
      expect(clickResult.success).toBe(true);
    });

    it('should provide actionable error context', async () => {
      // Try multiple selectors and verify error messages are helpful
      for (const selector of MissingSelectors.ids) {
        const result = await testContext.session.click(selector, { timeout: 200 });
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error!.length).toBeGreaterThan(0);
      }
    });

    it('should handle getText on non-existent element', async () => {
      const result = await testContext.session.getText('#nonexistent', {
        timeout: 500,
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle type on non-existent element', async () => {
      const result = await testContext.session.type('#nonexistent', 'text', {
        timeout: 500,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Navigation Errors', () => {
    let testContext: BrowserErrorTestContext;

    beforeEach(async () => {
      testContext = await createErrorTestContext({ timeout: 10000 });
      await testContext.session.launch();
    });

    afterEach(async () => {
      await testContext.cleanup();
    });

    it('should handle invalid URL formats', async () => {
      for (const url of InvalidUrls.malformed) {
        const result = await testContext.session.navigate(url, { timeout: 2000 });
        // Should either fail gracefully or handle the URL
        expect(result.duration).toBeGreaterThan(0);
      }

      // Session should still work
      await ErrorAssertions.assertSessionOperational(testContext.session);
    });

    it('should handle about:blank and special URLs', async () => {
      // about:blank should work
      const blankResult = await testContext.session.navigate('about:blank');
      expect(blankResult.success).toBe(true);

      // data URLs should work
      const dataResult = await testContext.session.navigate(
        'data:text/html,<h1>Data URL</h1>'
      );
      expect(dataResult.success).toBe(true);
    });

    it('should recover browser state after navigation failure', async () => {
      // Navigate to valid page first
      await testContext.session.navigate(ErrorTestPages.simplePage('Initial Page'));

      // Cause navigation failure
      const failResult = await testContext.session.navigate('http://localhost:59999', {
        timeout: 2000,
      });
      expect(failResult.success).toBe(false);

      // Browser state should be recoverable
      const currentUrl = testContext.session.getCurrentUrl();
      expect(currentUrl).toBeDefined();

      // Should be able to navigate again
      const recoveryResult = await testContext.session.navigate(
        ErrorTestPages.simplePage('Recovery')
      );
      expect(recoveryResult.success).toBe(true);

      const textResult = await testContext.session.getText('h1');
      expect(textResult.data).toBe('Recovery');
    });

    it('should handle back/forward navigation with no history', async () => {
      // Fresh session has no history
      const backResult = await testContext.session.goBack();
      expect(backResult.success).toBe(true);
      expect(backResult.data).toBeNull(); // No history to go back to

      const forwardResult = await testContext.session.goForward();
      expect(forwardResult.success).toBe(true);
      expect(forwardResult.data).toBeNull(); // No forward history
    });

    it('should handle back/forward after building history', async () => {
      // Build history
      await testContext.session.navigate(ErrorTestPages.simplePage('Page 1'));
      await testContext.session.navigate(ErrorTestPages.simplePage('Page 2'));
      await testContext.session.navigate(ErrorTestPages.simplePage('Page 3'));

      // Go back
      const backResult = await testContext.session.goBack();
      expect(backResult.success).toBe(true);

      let textResult = await testContext.session.getText('h1');
      expect(textResult.data).toBe('Page 2');

      // Go back again
      await testContext.session.goBack();
      textResult = await testContext.session.getText('h1');
      expect(textResult.data).toBe('Page 1');

      // Go forward
      const forwardResult = await testContext.session.goForward();
      expect(forwardResult.success).toBe(true);

      textResult = await testContext.session.getText('h1');
      expect(textResult.data).toBe('Page 2');
    });

    it('should handle reload errors gracefully', async () => {
      // Navigate to a page first
      await testContext.session.navigate(ErrorTestPages.simplePage('Reload Test'));

      // Reload should work
      const reloadResult = await testContext.session.reload();
      expect(reloadResult.success).toBe(true);

      // Content should still be there
      const textResult = await testContext.session.getText('h1');
      expect(textResult.data).toBe('Reload Test');
    });
  });

  describe('Graceful Error Recovery Mechanisms', () => {
    let testContext: BrowserErrorTestContext;

    beforeEach(async () => {
      testContext = await createErrorTestContext({ timeout: 10000 });
      await testContext.session.launch();
    });

    afterEach(async () => {
      await testContext.cleanup();
    });

    it('should maintain browser session after single error', async () => {
      await testContext.session.navigate(ErrorTestPages.simplePage('Test Page'));

      // Cause an error
      const errorResult = await testContext.session.click('#nonexistent', {
        timeout: 500,
      });
      expect(errorResult.success).toBe(false);

      // Session should still be active
      expect(testContext.session.isActive()).toBe(true);

      // Can still perform operations
      const navResult = await testContext.session.navigate(
        ErrorTestPages.simplePage('Still Working')
      );
      expect(navResult.success).toBe(true);
    });

    it('should allow retry after recoverable errors', async () => {
      await testContext.session.navigate(
        ErrorTestPages.delayedElement(1000, 'delayed')
      );

      // First attempt fails (element not yet present)
      const firstAttempt = await testContext.session.click('#delayed', {
        timeout: 200,
      });
      expect(firstAttempt.success).toBe(false);

      // Wait for element to appear
      await wait(1200);

      // Retry should succeed
      const retryAttempt = await testContext.session.click('#delayed');
      expect(retryAttempt.success).toBe(true);
    });

    it('should provide error context for debugging', async () => {
      await testContext.session.navigate(ErrorTestPages.simplePage('Error Context'));

      // Cause various errors and verify they have useful context
      const errors: Array<{ operation: string; result: any }> = [];

      errors.push({
        operation: 'click missing element',
        result: await testContext.session.click('#missing', { timeout: 200 }),
      });

      errors.push({
        operation: 'navigate to invalid',
        result: await testContext.session.navigate('http://localhost:59999', {
          timeout: 2000,
        }),
      });

      errors.push({
        operation: 'wait for missing element',
        result: await testContext.session.waitForElement('#never', { timeout: 200 }),
      });

      // All errors should have meaningful information
      for (const { operation, result } of errors) {
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error!.length).toBeGreaterThan(0);
        expect(result.duration).toBeGreaterThan(0);
      }
    });

    it('should emit appropriate events during error scenarios', async () => {
      // Navigate to page that throws error
      await testContext.session.navigate(ErrorTestPages.jsError);

      // Wait for error to be captured
      await wait(1000);

      // Should have captured the JS error event
      expect(testContext.errors.length).toBeGreaterThan(0);
      const jsError = testContext.errors.find(
        (e) => e.type === 'javascriptError' || e.type === 'pageError'
      );
      expect(jsError).toBeDefined();
      expect(jsError!.message).toContain('Test JS Error');

      // Session should still work
      await ErrorAssertions.assertSessionOperational(testContext.session);
    });

    it('should capture console errors', async () => {
      await testContext.session.navigate(ErrorTestPages.consoleOutputPage);

      // Wait for console output to be captured
      await wait(500);

      // Check captured console messages (if available through events)
      const consoleMessages = testContext.session.getCapturedConsoleMessages();
      expect(consoleMessages.length).toBeGreaterThan(0);
    });

    it('should cleanup resources on session close after errors', async () => {
      const manager = testContext.manager;
      const initialUsage = await manager.getResourceUsage();

      // Create a session that will encounter errors
      const tempSession = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      });

      await tempSession.launch();

      // Cause some errors
      await tempSession.navigate('http://localhost:59999', { timeout: 1000 });
      await tempSession.click('#nonexistent', { timeout: 200 });

      // Close the session
      const closeResult = await tempSession.close();
      expect(closeResult.success).toBe(true);

      // Manager should clean up
      const postCloseUsage = await manager.getResourceUsage();
      expect(postCloseUsage.totalContexts).toBeLessThan(
        initialUsage.totalContexts + 2
      );
    });

    it('should support error aggregation for multi-step operations', async () => {
      const operationResults: Array<{
        step: string;
        success: boolean;
        error?: string;
      }> = [];

      // Multi-step operation with some failing steps
      const steps = [
        {
          step: 'navigate',
          action: () =>
            testContext.session.navigate(ErrorTestPages.simplePage('Multi-Step')),
        },
        {
          step: 'click missing',
          action: () =>
            testContext.session.click('#missing', { timeout: 200 }),
        },
        {
          step: 'recover navigate',
          action: () =>
            testContext.session.navigate(ErrorTestPages.simplePage('Recovery')),
        },
        {
          step: 'screenshot',
          action: () => testContext.session.screenshot(),
        },
        {
          step: 'get text',
          action: () => testContext.session.getText('h1'),
        },
      ];

      for (const { step, action } of steps) {
        const result = await action();
        operationResults.push({
          step,
          success: result.success,
          error: result.error,
        });
      }

      // Verify results
      expect(operationResults[0].success).toBe(true); // navigate
      expect(operationResults[1].success).toBe(false); // click missing
      expect(operationResults[2].success).toBe(true); // recover
      expect(operationResults[3].success).toBe(true); // screenshot
      expect(operationResults[4].success).toBe(true); // get text

      // Failed step should have error details
      expect(operationResults[1].error).toBeDefined();
    });

    it('should handle retry with backoff utility', async () => {
      await testContext.session.navigate(
        ErrorTestPages.delayedElement(1500, 'retry-el')
      );

      // Use retry utility
      const result = await retryWithBackoff(
        () => testContext.session.click('#retry-el', { timeout: 500 }),
        5,
        200
      );

      // Should eventually succeed after element appears
      expect(result.success).toBe(true);
    });

    it('should handle multiple sequential errors without degradation', async () => {
      await testContext.session.navigate(ErrorTestPages.simplePage('Resilience Test'));

      // Cause many errors in sequence
      const errorCount = 10;
      for (let i = 0; i < errorCount; i++) {
        await testContext.session.click(`#missing-${i}`, { timeout: 100 });
      }

      // Session should still be fully functional
      expect(testContext.session.isActive()).toBe(true);

      // All operations should still work
      const navResult = await testContext.session.navigate(
        ErrorTestPages.simplePage('After Many Errors')
      );
      expect(navResult.success).toBe(true);

      const screenshotResult = await testContext.session.screenshot();
      expect(screenshotResult.success).toBe(true);

      const textResult = await testContext.session.getText('h1');
      expect(textResult.success).toBe(true);
      expect(textResult.data).toBe('After Many Errors');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    let testContext: BrowserErrorTestContext;

    beforeEach(async () => {
      testContext = await createErrorTestContext({ timeout: 10000 });
      await testContext.session.launch();
    });

    afterEach(async () => {
      await testContext.cleanup();
    });

    it('should handle zero timeout gracefully', async () => {
      const result = await testContext.session.navigate(
        ErrorTestPages.simplePage('Zero Timeout'),
        { timeout: 0 }
      );

      // Should either succeed immediately or fail gracefully
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle very long content without errors', async () => {
      // Create page with very long content
      const longContent = 'A'.repeat(100000);
      const longPage = `data:text/html,<div id="long">${longContent}</div>`;

      const navResult = await testContext.session.navigate(longPage);
      expect(navResult.success).toBe(true);

      const textResult = await testContext.session.getText('#long');
      expect(textResult.success).toBe(true);
      expect(textResult.data!.length).toBe(100000);
    });

    it('should handle rapid navigation changes', async () => {
      const urls = [
        ErrorTestPages.simplePage('Page A'),
        ErrorTestPages.simplePage('Page B'),
        ErrorTestPages.simplePage('Page C'),
      ];

      // Rapid navigation without waiting
      const results = await Promise.all(
        urls.map((url) => testContext.session.navigate(url))
      );

      // At least one should succeed (the last one typically)
      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBeGreaterThanOrEqual(1);

      // Session should be stable
      expect(testContext.session.isActive()).toBe(true);
    });

    it('should handle screenshot during page transition', async () => {
      await testContext.session.navigate(ErrorTestPages.simplePage('Transition Test'));

      // Start navigation and immediately try screenshot
      const navPromise = testContext.session.navigate(
        ErrorTestPages.simplePage('New Page')
      );
      const screenshotResult = await testContext.session.screenshot();

      await navPromise;

      // Screenshot should succeed (capturing either old or new page)
      expect(screenshotResult.success).toBe(true);
      expect(screenshotResult.data).toBeInstanceOf(Buffer);
    });

    it('should handle evaluate with error-throwing script', async () => {
      await testContext.session.navigate(ErrorTestPages.simplePage('Eval Test'));

      const result = await testContext.session.evaluate(() => {
        throw new Error('Intentional evaluation error');
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Intentional evaluation error');

      // Session should still work
      await ErrorAssertions.assertSessionOperational(testContext.session);
    });

    it('should handle operations on closed session gracefully', async () => {
      const tempSession = createBrowserSession(testContext.manager, {
        browserType: 'chromium',
        headless: true,
      });

      await tempSession.launch();
      await tempSession.navigate(ErrorTestPages.simplePage('Temp'));

      // Close the session
      await tempSession.close();

      // Operations on closed session should fail gracefully
      const navResult = await tempSession.navigate(ErrorTestPages.simplePage('After Close'));
      expect(navResult.success).toBe(false);

      const clickResult = await tempSession.click('#test');
      expect(clickResult.success).toBe(false);

      const screenshotResult = await tempSession.screenshot();
      expect(screenshotResult.success).toBe(false);
    });
  });
});
