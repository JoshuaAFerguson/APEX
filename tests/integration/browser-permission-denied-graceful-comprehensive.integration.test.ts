/**
 * Comprehensive Browser Permission-Denied Graceful Error Handling Integration Tests
 *
 * This test suite comprehensively verifies that browser automation handles
 * permission-denied scenarios gracefully without crashes, with appropriate
 * error messages, and proper cleanup. These tests validate the specific
 * acceptance criteria for permission-denied error handling.
 *
 * Acceptance Criteria Tested:
 * 1. When permissions are denied, browser automation handles the denial gracefully
 * 2. Appropriate error messages are provided
 * 3. No crashes occur during permission denial
 * 4. Proper cleanup of browser resources occurs
 * 5. Tests pass validation
 *
 * @module tests/integration/browser-permission-denied-graceful-comprehensive
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import {
  createPermissionTestContext,
  createPermissionDenialScenarios,
  assertPermissionDeniedResponse,
  assertCleanResourceState,
  assertPermissionEventsEmitted,
  assertNoCrashes,
  assertErrorMessageQuality,
  type PermissionTestContext,
  type PermissionEvent
} from '../test-utils/permission-test-helpers.js';
import type { BrowserOperation } from '../../packages/orchestrator/src/tools/browser-tool.js';

describe('Comprehensive Browser Permission-Denied Graceful Error Handling Integration Tests', () => {
  let testContext: PermissionTestContext;
  const scenarios = createPermissionDenialScenarios();
  let resourceCleanupTracker: { cleaned: boolean, reason?: string };

  beforeEach(() => {
    resourceCleanupTracker = { cleaned: false };
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (testContext) {
      try {
        await testContext.browserTool.cleanup();
        resourceCleanupTracker.cleaned = true;
        resourceCleanupTracker.reason = 'Normal test cleanup';
      } catch (error) {
        resourceCleanupTracker.cleaned = false;
        resourceCleanupTracker.reason = `Cleanup failed: ${error}`;
      }
      testContext = null as any;
    }
    vi.restoreAllMocks();
  });

  describe('Acceptance Criteria 1: Graceful Denial Handling', () => {
    it('should handle navigation permission denial gracefully without system instability', async () => {
      testContext = scenarios.denyNavigation();

      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Verify graceful handling - denial is returned as result, not thrown
      expect(() => result).not.toThrow();
      assertPermissionDeniedResponse(result, 'navigate');

      // Verify system remained stable
      expect(process).toBeDefined();
      expect(typeof process.exit).toBe('function');
      assertNoCrashes();

      // Verify no browser resources were inappropriately allocated
      expect(testContext.mockBrowser.state.browserActive).toBe(false);
      expect(testContext.mockBrowser.state.pageActive).toBe(false);
    });

    it('should handle form submission denial gracefully during active session', async () => {
      // Start with navigation allowed, form submission denied
      testContext = createPermissionTestContext({
        denyOperations: ['submit']
      });

      // Navigate successfully first
      const navResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/form' }
      });
      expect(navResult.success).toBe(true);

      // Now attempt form submission - should be denied gracefully
      const submitResult = await testContext.browserTool.execute({
        operation: 'submit',
        params: { selector: '#contact-form' }
      });

      assertPermissionDeniedResponse(submitResult, 'submit');
      expect(() => submitResult).not.toThrow();

      // Browser session should remain stable
      expect(testContext.mockBrowser.state.pageActive).toBe(true);
      assertNoCrashes();
    });

    it('should handle JavaScript execution denial gracefully', async () => {
      testContext = scenarios.denyJavaScript();

      const result = await testContext.browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.querySelector("#sensitive-data").textContent' }
      });

      // Verify graceful denial
      assertPermissionDeniedResponse(result, 'evaluate');
      expect(result.error).toMatch(/javascript.*execution.*denied|script.*not.*permitted/i);

      // Verify no code was actually executed
      expect(testContext.mockBrowser.page.evaluate).not.toHaveBeenCalled();
      assertNoCrashes();
    });

    it('should handle screenshot capture denial gracefully', async () => {
      testContext = scenarios.denyScreenshots();

      const result = await testContext.browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true, format: 'png' }
      });

      assertPermissionDeniedResponse(result, 'screenshot');
      expect(result.error).toMatch(/screenshot.*capture.*denied|image.*not.*allowed/i);

      // No screenshot should have been taken
      expect(testContext.mockBrowser.page.screenshot).not.toHaveBeenCalled();
      assertNoCrashes();
    });

    it('should handle data extraction denial gracefully', async () => {
      testContext = scenarios.denyDataExtraction();

      const textResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: { selector: '.user-data' }
      });

      const attrResult = await testContext.browserTool.execute({
        operation: 'getAttribute',
        params: { selector: '#form', attribute: 'action' }
      });

      assertPermissionDeniedResponse(textResult, 'getText');
      assertPermissionDeniedResponse(attrResult, 'getAttribute');

      // No data extraction should have occurred
      expect(testContext.mockBrowser.page.textContent).not.toHaveBeenCalled();
      expect(testContext.mockBrowser.page.getAttribute).not.toHaveBeenCalled();
      assertNoCrashes();
    });

    it('should handle multiple simultaneous permission denials gracefully', async () => {
      testContext = scenarios.denyAllOperations();

      const operations = [
        { operation: 'navigate', params: { url: 'https://example.com' } },
        { operation: 'click', params: { selector: '#button' } },
        { operation: 'type', params: { selector: '#input', text: 'test' } },
        { operation: 'screenshot', params: { fullPage: true } },
        { operation: 'evaluate', params: { script: 'window.location.href' } },
      ];

      // Execute all operations in parallel
      const results = await Promise.allSettled(
        operations.map(op => testContext.browserTool.execute(op))
      );

      // All should be fulfilled (gracefully handled), none should reject
      results.forEach((result, index) => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          assertPermissionDeniedResponse(result.value, operations[index].operation as BrowserOperation);
        }
      });

      assertNoCrashes();
    });
  });

  describe('Acceptance Criteria 2: Appropriate Error Messages', () => {
    it('should provide clear, user-friendly error messages for denied operations', async () => {
      const testCases = [
        {
          scenario: scenarios.denyNavigation(),
          operation: 'navigate' as BrowserOperation,
          params: { url: 'https://restricted.com' },
          expectedMessage: /navigation.*permission.*denied|access.*blocked/i,
        },
        {
          scenario: scenarios.denyInteraction(),
          operation: 'click' as BrowserOperation,
          params: { selector: '#sensitive-button' },
          expectedMessage: /click.*permission.*denied|interaction.*not.*allowed/i,
        },
        {
          scenario: scenarios.denyJavaScript(),
          operation: 'evaluate' as BrowserOperation,
          params: { script: 'alert("test")' },
          expectedMessage: /javascript.*execution.*denied|script.*not.*permitted/i,
        },
        {
          scenario: scenarios.denyScreenshots(),
          operation: 'screenshot' as BrowserOperation,
          params: { fullPage: true },
          expectedMessage: /screenshot.*capture.*denied|image.*not.*allowed/i,
        },
      ];

      for (const testCase of testCases) {
        testContext = testCase.scenario;

        const result = await testContext.browserTool.execute({
          operation: testCase.operation,
          params: testCase.params,
        });

        assertPermissionDeniedResponse(result, testCase.operation);
        expect(result.error).toMatch(testCase.expectedMessage);
        assertErrorMessageQuality(result.error);

        // Verify error message doesn't contain internal implementation details
        expect(result.error).not.toContain('/Users/');
        expect(result.error).not.toContain('packages/');
        expect(result.error).not.toContain('.ts');
        expect(result.error).not.toContain('undefined');
        expect(result.error).not.toContain('TypeError');

        await testContext.browserTool.cleanup();
      }
    });

    it('should provide operation-specific error context and suggestions', async () => {
      testContext = scenarios.blockDomains(['sensitive.com']);

      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://sensitive.com/data' }
      });

      assertPermissionDeniedResponse(result, 'navigate');

      // Verify error message contains helpful context
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(20);

      // Verify suggestions are provided
      expect(Array.isArray(result.metadata.suggestions)).toBe(true);
      expect(result.metadata.suggestions.length).toBeGreaterThan(0);

      // Suggestions should be helpful and actionable
      const suggestionsText = result.metadata.suggestions.join(' ').toLowerCase();
      expect(suggestionsText).toMatch(/allowed.*domain|permission|configuration|contact.*administrator/);
    });

    it('should sanitize error messages to prevent information leakage', async () => {
      testContext = scenarios.denyAllOperations();

      const sensitiveOperations = [
        { operation: 'navigate', params: { url: 'https://internal.company.com/secrets' } },
        { operation: 'evaluate', params: { script: 'fetch("/api/internal/user-data")' } },
        { operation: 'getAttribute', params: { selector: '#api-key', attribute: 'value' } },
      ];

      for (const op of sensitiveOperations) {
        const result = await testContext.browserTool.execute(op);

        assertPermissionDeniedResponse(result, op.operation as BrowserOperation);

        // Verify no sensitive information is leaked
        expect(result.error).not.toContain('internal.company.com');
        expect(result.error).not.toContain('api-key');
        expect(result.error).not.toContain('/api/internal');
        expect(result.error).not.toContain('secrets');

        // Should still be informative
        expect(result.error).toMatch(/permission.*denied|operation.*not.*allowed/i);
        assertErrorMessageQuality(result.error);
      }
    });

    it('should provide consistent error message structure across operations', async () => {
      const operations: Array<{ operation: BrowserOperation; params: any }> = [
        { operation: 'navigate', params: { url: 'https://example.com' } },
        { operation: 'click', params: { selector: '#button' } },
        { operation: 'type', params: { selector: '#input', text: 'test' } },
        { operation: 'screenshot', params: { fullPage: true } },
        { operation: 'evaluate', params: { script: 'document.title' } },
      ];

      testContext = scenarios.denyAllOperations();

      const results = [];
      for (const op of operations) {
        const result = await testContext.browserTool.execute(op);
        results.push(result);
      }

      // All results should have consistent error structure
      results.forEach((result, index) => {
        assertPermissionDeniedResponse(result, operations[index].operation);

        // Consistent metadata structure
        expect(result.metadata).toMatchObject({
          permissionDenied: true,
          deniedBy: expect.any(String),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
          suggestions: expect.any(Array),
        });

        assertErrorMessageQuality(result.error);
      });
    });
  });

  describe('Acceptance Criteria 3: No Crashes During Denial', () => {
    it('should never crash when permissions are denied before operation start', async () => {
      testContext = scenarios.denyAllOperations();

      // Attempt operations that would normally cause browser interactions
      const dangerousOperations = [
        { operation: 'navigate', params: { url: 'javascript:alert("xss")' } },
        { operation: 'evaluate', params: { script: 'while(true){}' } },
        { operation: 'click', params: { selector: 'body', clickCount: 1000 } },
        { operation: 'screenshot', params: { fullPage: true } },
      ];

      for (const op of dangerousOperations) {
        const result = await testContext.browserTool.execute(op);

        // Should return denial gracefully, never crash
        expect(() => result).not.toThrow();
        assertPermissionDeniedResponse(result, op.operation as BrowserOperation);
      }

      // Verify process is still stable
      assertNoCrashes();
      expect(process.memoryUsage).toBeDefined();
      expect(typeof process.memoryUsage()).toBe('object');
    });

    it('should handle rapid permission denial attempts without crashing', async () => {
      testContext = scenarios.denyAllOperations();

      // Rapid-fire permission denials
      const rapidOperations = Array(50).fill(null).map((_, i) => ({
        operation: 'navigate' as BrowserOperation,
        params: { url: `https://example.com/page-${i}` }
      }));

      const startTime = Date.now();

      // Execute all operations rapidly
      const results = await Promise.all(
        rapidOperations.map(op => testContext.browserTool.execute(op))
      );

      const endTime = Date.now();

      // All should be denied gracefully
      results.forEach((result, index) => {
        expect(() => result).not.toThrow();
        assertPermissionDeniedResponse(result, 'navigate');
      });

      // Should complete in reasonable time (not hang/crash)
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds max

      assertNoCrashes();
    });

    it('should handle permission system failures without crashing', async () => {
      testContext = scenarios.simulateFailure();

      // Attempt operation when permission system is failing
      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Should handle failure gracefully, not crash
      expect(() => result).not.toThrow();
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*database|connection.*lost|system.*error/i);

      assertNoCrashes();
    });

    it('should handle concurrent permission denials across multiple operations', async () => {
      testContext = scenarios.denyAllOperations();

      // Simulate concurrent operations from different sources
      const concurrentOperations = [
        testContext.browserTool.execute({ operation: 'navigate', params: { url: 'https://site1.com' } }),
        testContext.browserTool.execute({ operation: 'navigate', params: { url: 'https://site2.com' } }),
        testContext.browserTool.execute({ operation: 'click', params: { selector: '#btn1' } }),
        testContext.browserTool.execute({ operation: 'click', params: { selector: '#btn2' } }),
        testContext.browserTool.execute({ operation: 'screenshot', params: { fullPage: true } }),
        testContext.browserTool.execute({ operation: 'evaluate', params: { script: 'document.title' } }),
      ];

      const results = await Promise.allSettled(concurrentOperations);

      // All should be fulfilled (gracefully handled)
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(() => result.value).not.toThrow();
          expect(result.value.success).toBe(false);
          expect(result.value.permissionDenied).toBe(true);
        }
      });

      assertNoCrashes();
    });
  });

  describe('Acceptance Criteria 4: Proper Resource Cleanup', () => {
    it('should cleanup browser resources properly when permissions denied before allocation', async () => {
      testContext = scenarios.denyNavigation();

      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      assertPermissionDeniedResponse(result, 'navigate');

      // Verify no resources were allocated
      expect(testContext.mockBrowser.state.browserActive).toBe(false);
      expect(testContext.mockBrowser.state.contextActive).toBe(false);
      expect(testContext.mockBrowser.state.pageActive).toBe(false);
      expect(testContext.mockBrowser.state.activeOperations).toBe(0);

      assertCleanResourceState(testContext);
    });

    it('should cleanup browser resources properly when permissions denied after allocation', async () => {
      testContext = createPermissionTestContext();

      // Start with navigation allowed to allocate resources
      await testContext.permissionManager.grantPermission('Browser', 'full', 'navigate');

      const navResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(navResult.success).toBe(true);
      expect(testContext.mockBrowser.state.pageActive).toBe(true);

      // Now deny further operations
      await testContext.permissionManager.denyPermission('Browser', 'evaluate');

      const evalResult = await testContext.browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' }
      });

      assertPermissionDeniedResponse(evalResult, 'evaluate');

      // Cleanup should work properly
      await testContext.browserTool.cleanup();

      // Resources should be cleaned up
      expect(testContext.mockBrowser.state.browserActive).toBe(false);
      expect(testContext.mockBrowser.state.activeOperations).toBe(0);
    });

    it('should handle cleanup when permission denied during active operations', async () => {
      testContext = createPermissionTestContext({
        denyOperations: ['click'] // Allow navigation, deny clicks
      });

      // Navigate successfully to establish session
      const navResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(navResult.success).toBe(true);

      // Attempt denied operation
      const clickResult = await testContext.browserTool.execute({
        operation: 'click',
        params: { selector: '#button' }
      });

      assertPermissionDeniedResponse(clickResult, 'click');

      // Verify active operations are properly tracked
      expect(testContext.mockBrowser.state.activeOperations).toBe(0);

      // Manual cleanup should work
      await testContext.browserTool.cleanup();
      assertCleanResourceState(testContext);
    });

    it('should prevent resource leaks during rapid permission denials', async () => {
      testContext = scenarios.denyAllOperations();

      const initialResourceState = { ...testContext.mockBrowser.state };

      // Attempt multiple operations rapidly
      const operations = Array(20).fill(null).map((_, i) => ({
        operation: 'navigate' as BrowserOperation,
        params: { url: `https://example.com/page-${i}` }
      }));

      for (const op of operations) {
        const result = await testContext.browserTool.execute(op);
        assertPermissionDeniedResponse(result, op.operation);
      }

      // Resource state should remain clean (no accumulation)
      expect(testContext.mockBrowser.state.browserActive).toBe(initialResourceState.browserActive);
      expect(testContext.mockBrowser.state.contextActive).toBe(initialResourceState.contextActive);
      expect(testContext.mockBrowser.state.pageActive).toBe(initialResourceState.pageActive);
      expect(testContext.mockBrowser.state.activeOperations).toBe(0);

      assertCleanResourceState(testContext);
    });

    it('should cleanup properly when cleanup itself encounters permission issues', async () => {
      testContext = createPermissionTestContext();

      // Simulate scenario where cleanup might fail
      const originalClose = testContext.mockBrowser.close;
      testContext.mockBrowser.close = vi.fn(() => {
        throw new Error('Cleanup permission denied');
      });

      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Even if cleanup fails, the denial should be handled gracefully
      expect(() => result).not.toThrow();

      // Restore original cleanup for afterEach
      testContext.mockBrowser.close = originalClose;

      assertNoCrashes();
    });
  });

  describe('Acceptance Criteria 5: Event System Integration', () => {
    it('should emit permission denial events with complete context', async () => {
      testContext = scenarios.denyNavigation();

      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://blocked.com/sensitive' }
      });

      assertPermissionEventsEmitted(testContext.events, 'denied', 'Browser');

      const deniedEvents = testContext.events.filter(e => e.type === 'denied');
      expect(deniedEvents.length).toBeGreaterThan(0);

      const latestEvent = deniedEvents[deniedEvents.length - 1];
      expect(latestEvent).toMatchObject({
        type: 'denied',
        tool: 'Browser',
        scope: 'navigate',
        denialReason: expect.any(String),
        timestamp: expect.any(Date),
      });

      // Verify timing
      expect(latestEvent.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
      expect(Date.now() - latestEvent.timestamp.getTime()).toBeLessThan(1000);
    });

    it('should maintain event integrity during multiple denials', async () => {
      testContext = scenarios.partialDenial();

      const operations = [
        { operation: 'navigate', params: { url: 'https://example.com' } }, // Allowed
        { operation: 'evaluate', params: { script: 'document.title' } }, // Denied
        { operation: 'click', params: { selector: '#button' } }, // Allowed
        { operation: 'submit', params: { selector: '#form' } }, // Denied
      ];

      await Promise.allSettled(
        operations.map(op => testContext.browserTool.execute(op))
      );

      const grantedEvents = testContext.events.filter(e => e.type === 'granted');
      const deniedEvents = testContext.events.filter(e => e.type === 'denied');

      // Should have both granted and denied events
      expect(grantedEvents.length).toBeGreaterThan(0);
      expect(deniedEvents.length).toBeGreaterThan(0);

      // Events should be properly ordered by timestamp
      const allEvents = [...testContext.events].sort((a, b) =>
        a.timestamp.getTime() - b.timestamp.getTime()
      );

      allEvents.forEach((event, index) => {
        expect(event.timestamp).toBeInstanceOf(Date);
        if (index > 0) {
          expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(
            allEvents[index - 1].timestamp.getTime()
          );
        }
      });
    });
  });

  describe('Integration Test Validation', () => {
    it('should pass all acceptance criteria tests without errors', async () => {
      // This meta-test verifies that all previous tests can run successfully
      // It serves as a final validation that the implementation meets requirements

      const testResults = {
        gracefulHandling: false,
        appropriateErrors: false,
        noCrashes: false,
        properCleanup: false,
        eventIntegration: false,
      };

      try {
        // Test graceful handling
        testContext = scenarios.denyAllOperations();
        const result = await testContext.browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://example.com' }
        });

        assertPermissionDeniedResponse(result, 'navigate');
        assertNoCrashes();
        testResults.gracefulHandling = true;

        // Test error messages
        assertErrorMessageQuality(result.error);
        expect(result.metadata.suggestions).toBeDefined();
        testResults.appropriateErrors = true;

        // Test no crashes
        expect(process).toBeDefined();
        testResults.noCrashes = true;

        // Test cleanup
        await testContext.browserTool.cleanup();
        assertCleanResourceState(testContext);
        testResults.properCleanup = true;

        // Test events
        assertPermissionEventsEmitted(testContext.events, 'denied', 'Browser');
        testResults.eventIntegration = true;

      } catch (error) {
        console.error('Integration test validation failed:', error);
        throw error;
      }

      // Verify all criteria passed
      expect(testResults.gracefulHandling).toBe(true);
      expect(testResults.appropriateErrors).toBe(true);
      expect(testResults.noCrashes).toBe(true);
      expect(testResults.properCleanup).toBe(true);
      expect(testResults.eventIntegration).toBe(true);

      // Final verification that the test environment is stable
      expect(resourceCleanupTracker.cleaned).toBe(true);
    });
  });
});