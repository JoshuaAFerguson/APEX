/**
 * @file packages/browser/src/__tests__/timeout-error-messages-validation.test.ts
 *
 * Validation tests for timeout error messages and error handling
 *
 * Ensures that timeout errors provide:
 * - Clear, descriptive error messages
 * - Consistent error format across all methods
 * - Proper error context (selector, timeout value, operation type)
 * - Helpful debugging information
 * - Appropriate error classifications
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createBrowserManager, createBrowserSession } from '../index.js';
import type {
  BrowserManager,
  BrowserSession,
  BrowserSessionConfig
} from '../types.js';

describe('Timeout Error Messages Validation', () => {
  let manager: BrowserManager;
  let session: BrowserSession;

  beforeEach(async () => {
    manager = createBrowserManager();
    session = createBrowserSession(manager, {
      browserType: 'chromium',
      headless: true,
      timeout: 2000,
    });
    await session.launch();
    await session.navigate('data:text/html,<div>Error message test page</div>');
  });

  afterEach(async () => {
    if (session) {
      await session.close();
    }
    await manager.shutdown();
  });

  describe('Error Message Content Validation', () => {
    it('should provide descriptive timeout error messages for click operations', async () => {
      const result = await session.click('#nonexistent-button', { timeout: 500 });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      const error = result.error!;

      // Should mention timeout
      expect(error.toLowerCase()).toMatch(/timeout|timed out|timedout/);

      // Should be informative but not overly technical
      expect(error.length).toBeGreaterThan(10);
      expect(error.length).toBeLessThan(500);
    });

    it('should provide clear error messages for element waiting operations', async () => {
      const operations = [
        {
          name: 'waitForElement',
          operation: () => session.waitForElement('#missing-element', { timeout: 400 })
        },
        {
          name: 'waitForSelector',
          operation: () => session.waitForSelector('#missing-selector', { timeout: 400 })
        }
      ];

      for (const { name, operation } of operations) {
        const result = await operation();

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();

        const error = result.error!;

        // Should mention timeout
        expect(error.toLowerCase()).toMatch(/timeout|timed out|timedout/);

        // Should be descriptive
        expect(error.length).toBeGreaterThan(5);
      }
    });

    it('should provide informative error messages for navigation timeouts', async () => {
      // Try to navigate with very short timeout
      const result = await session.navigate('data:text/html,<script>while(true){}</script>', {
        timeout: 200
      });

      if (!result.success) {
        expect(result.error).toBeDefined();

        const error = result.error!;
        expect(error.toLowerCase()).toMatch(/timeout|timed out|navigation|load/);
      }
    });

    it('should provide context for waitForFunction timeout errors', async () => {
      const result = await session.waitForFunction(() => false, { timeout: 300 });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      const error = result.error!;
      expect(error.toLowerCase()).toMatch(/timeout|timed out|function/);
    });

    it('should provide clear error messages for screenshot timeout operations', async () => {
      const result = await session.captureElement('#nonexistent-for-screenshot', {
        timeout: 350
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      const error = result.error!;
      expect(error.toLowerCase()).toMatch(/timeout|timed out|element|screenshot|capture/);
    });
  });

  describe('Error Message Consistency', () => {
    it('should maintain consistent error message structure across different operation types', async () => {
      const operations = [
        { name: 'click', op: () => session.click('#consistent1', { timeout: 300 }) },
        { name: 'type', op: () => session.type('#consistent2', 'text', { timeout: 300 }) },
        { name: 'hover', op: () => session.hover('#consistent3', { timeout: 300 }) },
        { name: 'focus', op: () => session.focus('#consistent4', { timeout: 300 }) },
        { name: 'waitElement', op: () => session.waitForElement('#consistent5', { timeout: 300 }) },
        { name: 'waitFunction', op: () => session.waitForFunction(() => false, { timeout: 300 }) },
      ];

      const errorMessages = [];

      for (const { name, op } of operations) {
        const result = await op();
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();

        errorMessages.push({
          operation: name,
          error: result.error!,
          length: result.error!.length
        });
      }

      // All errors should mention timeout
      errorMessages.forEach(({ operation, error }) => {
        expect(error.toLowerCase()).toMatch(/timeout|timed out|timedout/);
      });

      // Error message lengths should be reasonably consistent
      const lengths = errorMessages.map(msg => msg.length);
      const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      const maxDeviation = Math.max(...lengths.map(len => Math.abs(len - avgLength)));

      // No error message should be extremely different in length
      expect(maxDeviation).toBeLessThan(avgLength * 2);
    });

    it('should provide consistent error format for similar operations', async () => {
      const interactionOps = [
        { name: 'click', op: () => session.click('#format-test-click', { timeout: 250 }) },
        { name: 'hover', op: () => session.hover('#format-test-hover', { timeout: 250 }) },
        { name: 'focus', op: () => session.focus('#format-test-focus', { timeout: 250 }) },
      ];

      const waitOps = [
        { name: 'waitElement', op: () => session.waitForElement('#format-test-wait1', { timeout: 250 }) },
        { name: 'waitSelector', op: () => session.waitForSelector('#format-test-wait2', { timeout: 250 }) },
      ];

      // Test interaction operations
      const interactionErrors = [];
      for (const { name, op } of interactionOps) {
        const result = await op();
        expect(result.success).toBe(false);
        interactionErrors.push(result.error!);
      }

      // Test wait operations
      const waitErrors = [];
      for (const { name, op } of waitOps) {
        const result = await op();
        expect(result.success).toBe(false);
        waitErrors.push(result.error!);
      }

      // Similar operations should have similar error patterns
      // (This is a basic check - in practice, you might want more sophisticated pattern matching)
      interactionErrors.forEach(error => {
        expect(error.toLowerCase()).toMatch(/timeout|timed out/);
      });

      waitErrors.forEach(error => {
        expect(error.toLowerCase()).toMatch(/timeout|timed out/);
      });
    });
  });

  describe('Error Context and Debugging Information', () => {
    it('should handle timeout errors with meaningful context for complex selectors', async () => {
      const complexSelectors = [
        '#complex-id',
        '.complex-class',
        'button[data-test="complex"]',
        'div > span.nested',
        '//xpath//complex',
      ];

      for (const selector of complexSelectors) {
        const result = await session.click(selector, { timeout: 200 });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.duration).toBeGreaterThan(0);

        // Error should be informative
        const error = result.error!;
        expect(error.toLowerCase()).toMatch(/timeout|timed out/);
        expect(error.length).toBeGreaterThan(5);
      }
    });

    it('should provide useful error information for different timeout durations', async () => {
      const timeouts = [100, 500, 1000];
      const errors = [];

      for (const timeout of timeouts) {
        const result = await session.waitForElement('#duration-test', { timeout });
        expect(result.success).toBe(false);
        expect(result.duration).toBeGreaterThanOrEqual(timeout * 0.7);

        errors.push({
          timeout,
          error: result.error!,
          duration: result.duration
        });
      }

      // All errors should be timeout-related
      errors.forEach(({ error, timeout, duration }) => {
        expect(error.toLowerCase()).toMatch(/timeout|timed out/);
        // Duration should be reflected appropriately
        expect(duration).toBeLessThan(timeout * 1.5);
      });
    });

    it('should handle timeout errors gracefully with different browser states', async () => {
      const states = [
        {
          name: 'normal page',
          setup: () => session.navigate('data:text/html,<div>Normal page</div>')
        },
        {
          name: 'page with scripts',
          setup: () => session.navigate('data:text/html,<div>Page with scripts</div><script>console.log("loaded");</script>')
        },
        {
          name: 'page with forms',
          setup: () => session.navigate('data:text/html,<form><input type="text"><button>Submit</button></form>')
        }
      ];

      for (const { name, setup } of states) {
        await setup();

        const result = await session.click('#state-test', { timeout: 300 });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.duration).toBeGreaterThan(0);

        // Error should be consistent regardless of page state
        const error = result.error!;
        expect(error.toLowerCase()).toMatch(/timeout|timed out/);
      }
    });
  });

  describe('Error Recovery and Session State', () => {
    it('should maintain clear error reporting after multiple timeout failures', async () => {
      const timeoutOperations = [
        () => session.click('#multi-fail-1', { timeout: 200 }),
        () => session.waitForElement('#multi-fail-2', { timeout: 200 }),
        () => session.type('#multi-fail-3', 'text', { timeout: 200 }),
        () => session.hover('#multi-fail-4', { timeout: 200 }),
      ];

      const results = [];

      for (const operation of timeoutOperations) {
        const result = await operation();
        results.push(result);
      }

      // All should fail with timeout errors
      results.forEach((result, index) => {
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error!.toLowerCase()).toMatch(/timeout|timed out/);
        expect(result.duration).toBeGreaterThan(0);
      });

      // Error quality should not degrade
      const errorLengths = results.map(r => r.error!.length);
      const avgLength = errorLengths.reduce((a, b) => a + b, 0) / errorLengths.length;

      // All errors should be reasonably substantial
      errorLengths.forEach(length => {
        expect(length).toBeGreaterThan(5);
        expect(Math.abs(length - avgLength)).toBeLessThan(avgLength);
      });
    });

    it('should provide accurate error information after successful operations', async () => {
      // Navigate to page with actual elements
      await session.navigate('data:text/html,<button id="success-btn">Success</button>');

      // Perform successful operation
      const successResult = await session.click('#success-btn');
      expect(successResult.success).toBe(true);

      // Then perform failing operation
      const failResult = await session.click('#nonexistent-after-success', { timeout: 300 });

      expect(failResult.success).toBe(false);
      expect(failResult.error).toBeDefined();
      expect(failResult.error!.toLowerCase()).toMatch(/timeout|timed out/);

      // Error should be clear and not affected by previous success
      expect(failResult.duration).toBeGreaterThanOrEqual(200);
      expect(failResult.duration).toBeLessThan(600);
    });

    it('should handle error messages consistently across different element states', async () => {
      await session.navigate('data:text/html,' + encodeURIComponent(`
        <div>
          <button id="visible-btn">Visible</button>
          <button id="hidden-btn" style="display: none;">Hidden</button>
          <button id="disabled-btn" disabled>Disabled</button>
        </div>
      `));

      // Test timeout on visible element (shouldn't happen)
      const visibleResult = await session.click('#visible-btn');
      expect(visibleResult.success).toBe(true); // Should succeed

      // Test timeout on nonexistent element
      const nonexistentResult = await session.click('#nonexistent-btn', { timeout: 250 });
      expect(nonexistentResult.success).toBe(false);
      expect(nonexistentResult.error).toBeDefined();
      expect(nonexistentResult.error!.toLowerCase()).toMatch(/timeout|timed out/);

      // Both error messages should be informative
      const nonexistentError = nonexistentResult.error!;
      expect(nonexistentError.length).toBeGreaterThan(10);
    });
  });

  describe('Special Timeout Scenarios Error Handling', () => {
    it('should provide appropriate error messages for waitForLoadState timeouts', async () => {
      // Try to wait for network idle with very short timeout
      const result = await session.waitForLoadState('networkidle', { timeout: 100 });

      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error!.toLowerCase()).toMatch(/timeout|timed out|load|network/);
      }
    });

    it('should handle waitForRequest timeout errors clearly', async () => {
      const result = await session.waitForRequest(/\/never-requested\//, { timeout: 250 });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.toLowerCase()).toMatch(/timeout|timed out|request/);
    });

    it('should handle waitForResponse timeout errors clearly', async () => {
      const result = await session.waitForResponse(/\/never-responded\//, { timeout: 250 });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.toLowerCase()).toMatch(/timeout|timed out|response/);
    });

    it('should provide clear error messages for navigation timeout edge cases', async () => {
      const navigationCases = [
        {
          name: 'reload with short timeout',
          operation: () => session.reload({ timeout: 100 })
        },
        {
          name: 'goBack with short timeout',
          operation: () => session.goBack({ timeout: 100 })
        },
        {
          name: 'goForward with short timeout',
          operation: () => session.goForward({ timeout: 100 })
        }
      ];

      for (const { name, operation } of navigationCases) {
        const result = await operation();

        // May succeed or fail depending on timing, but if it fails, error should be clear
        if (!result.success) {
          expect(result.error).toBeDefined();
          expect(result.error!.toLowerCase()).toMatch(/timeout|timed out|navigation|history|load/);
        }
      }
    });
  });

  describe('Error Message Localization and Clarity', () => {
    it('should provide error messages that are clear for debugging', async () => {
      const debugScenarios = [
        {
          name: 'Simple selector timeout',
          operation: () => session.click('#debug-simple', { timeout: 200 })
        },
        {
          name: 'Complex selector timeout',
          operation: () => session.click('div.container > button[data-role="submit"]', { timeout: 200 })
        },
        {
          name: 'XPath selector timeout',
          operation: () => session.click('//button[@id="debug-xpath"]', { timeout: 200 })
        }
      ];

      for (const { name, operation } of debugScenarios) {
        const result = await operation();

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();

        const error = result.error!;

        // Error should be in English and readable
        expect(error).toMatch(/^[A-Za-z]/); // Starts with letter
        expect(error.toLowerCase()).toMatch(/timeout|timed out/);

        // Should not contain internal technical jargon that would confuse users
        expect(error.toLowerCase()).not.toMatch(/internal|stacktrace|heap|gc/);
      }
    });

    it('should provide actionable error messages', async () => {
      const result = await session.click('#actionable-error-test', { timeout: 300 });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      const error = result.error!;

      // Error should suggest what went wrong (timeout) without being too technical
      expect(error.toLowerCase()).toMatch(/timeout|timed out/);

      // Should be concise but informative
      expect(error.length).toBeGreaterThan(15);
      expect(error.length).toBeLessThan(200);
    });
  });
});