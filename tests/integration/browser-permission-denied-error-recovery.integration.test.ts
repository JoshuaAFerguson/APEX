/**
 * Browser Permission-Denied Error Recovery Integration Tests
 *
 * This test suite specifically focuses on error recovery scenarios when
 * browser permissions are denied. It validates that the system can handle
 * edge cases, recover from permission failures, and maintain stability
 * under adverse conditions.
 *
 * Complements the main graceful error handling tests by focusing on:
 * - Permission state transitions
 * - Error recovery workflows
 * - System resilience under pressure
 * - Resource management during failures
 *
 * @module tests/integration/browser-permission-denied-error-recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import {
  createPermissionTestContext,
  createPermissionDenialScenarios,
  assertPermissionDeniedResponse,
  assertCleanResourceState,
  assertNoCrashes,
  assertErrorMessageQuality,
  type PermissionTestContext,
  type PermissionEvent
} from '../test-utils/permission-test-helpers.js';
import type { BrowserOperation } from '../../packages/orchestrator/src/tools/browser-tool.js';

describe('Browser Permission-Denied Error Recovery Integration Tests', () => {
  let testContext: PermissionTestContext;
  const scenarios = createPermissionDenialScenarios();

  afterEach(async () => {
    if (testContext) {
      await testContext.browserTool.cleanup();
      testContext = null as any;
    }
    vi.restoreAllMocks();
  });

  describe('Permission State Recovery', () => {
    it('should recover gracefully from denied to granted permission states', async () => {
      testContext = scenarios.denyNavigation();

      // First attempt should be denied
      const deniedResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      assertPermissionDeniedResponse(deniedResult, 'navigate');
      expect(deniedResult.error).toMatch(/navigation.*permission.*denied/i);

      // Grant permission and retry
      await testContext.permissionManager.grantPermission('Browser', 'full', 'navigate');

      const allowedResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(allowedResult.success).toBe(true);
      expect(allowedResult.operation).toBe('navigate');

      // Verify system remained stable throughout transition
      assertNoCrashes();
    });

    it('should handle permission revocation during active browser session', async () => {
      testContext = createPermissionTestContext();

      // Start with full permissions
      await testContext.permissionManager.grantPermission('Browser', 'full');

      // Establish active session
      const navResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(navResult.success).toBe(true);
      expect(testContext.mockBrowser.state.pageActive).toBe(true);

      // Revoke permissions mid-session
      await testContext.permissionManager.denyPermission('Browser', 'click');

      // Subsequent operations should be denied gracefully
      const clickResult = await testContext.browserTool.execute({
        operation: 'click',
        params: { selector: '#button' }
      });

      assertPermissionDeniedResponse(clickResult, 'click');

      // Browser session should remain stable
      expect(testContext.mockBrowser.state.pageActive).toBe(true);
      assertNoCrashes();
    });

    it('should handle oscillating permission states without resource leaks', async () => {
      testContext = createPermissionTestContext();

      // Oscillate permissions multiple times
      for (let i = 0; i < 5; i++) {
        if (i % 2 === 0) {
          await testContext.permissionManager.grantPermission('Browser', 'full', 'navigate');
        } else {
          await testContext.permissionManager.denyPermission('Browser', 'navigate');
        }

        const result = await testContext.browserTool.execute({
          operation: 'navigate',
          params: { url: `https://example.com/page-${i}` }
        });

        if (i % 2 === 0) {
          expect(result.success).toBe(true);
        } else {
          assertPermissionDeniedResponse(result, 'navigate');
        }
      }

      // Verify no resource accumulation
      expect(testContext.mockBrowser.state.activeOperations).toBe(0);
      assertNoCrashes();
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should provide recovery suggestions after permission denial', async () => {
      testContext = scenarios.blockDomains(['corporate.internal']);

      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://corporate.internal/dashboard' }
      });

      assertPermissionDeniedResponse(result, 'navigate');

      // Verify actionable recovery suggestions
      expect(Array.isArray(result.metadata.suggestions)).toBe(true);
      expect(result.metadata.suggestions.length).toBeGreaterThan(0);

      const suggestionsText = result.metadata.suggestions.join(' ').toLowerCase();
      expect(suggestionsText).toMatch(
        /contact.*administrator|request.*access|allowed.*domains|configuration/
      );

      // Suggestions should be specific and helpful
      result.metadata.suggestions.forEach((suggestion: string) => {
        expect(suggestion.length).toBeGreaterThan(10);
        expect(suggestion).toMatch(/^[A-Z]/); // Should start with capital letter
        expect(suggestion).toMatch(/[.!?]$/); // Should end with punctuation
      });
    });

    it('should handle retry workflows with different permission scopes', async () => {
      testContext = createPermissionTestContext({
        denyOperations: ['navigate:https://sensitive.com']
      });

      // First URL should be denied
      const deniedResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://sensitive.com' }
      });

      assertPermissionDeniedResponse(deniedResult, 'navigate');

      // Different URL should be allowed
      const allowedResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(allowedResult.success).toBe(true);

      // Verify selective permission enforcement
      assertNoCrashes();
    });

    it('should support permission escalation workflows', async () => {
      testContext = createPermissionTestContext({
        defaultPermissionLevel: 'limited'
      });

      // Limited permission operation should succeed
      const limitedResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(limitedResult.success).toBe(true);

      // Escalate to full permissions
      await testContext.permissionManager.grantPermission('Browser', 'full');

      // Full permission operation should succeed
      const fullResult = await testContext.browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' }
      });

      expect(fullResult.success).toBe(true);

      assertNoCrashes();
    });
  });

  describe('System Resilience Under Pressure', () => {
    it('should handle permission denial storms without degradation', async () => {
      testContext = scenarios.denyAllOperations();

      // Generate high volume of denied requests
      const stormRequests = Array(100).fill(null).map((_, i) => ({
        operation: (['navigate', 'click', 'type', 'screenshot', 'evaluate'] as BrowserOperation[])[i % 5],
        params: { url: `https://example.com/${i}`, selector: `#element-${i}`, text: `test-${i}` }
      }));

      const startTime = Date.now();

      const results = await Promise.all(
        stormRequests.map(request => testContext.browserTool.execute(request))
      );

      const endTime = Date.now();

      // All should be denied gracefully
      results.forEach((result, index) => {
        assertPermissionDeniedResponse(result, stormRequests[index].operation);
      });

      // Should complete in reasonable time (no hanging/blocking)
      expect(endTime - startTime).toBeLessThan(30000); // 30 seconds max

      // System should remain stable
      assertNoCrashes();
      expect(testContext.mockBrowser.state.activeOperations).toBe(0);
    });

    it('should handle concurrent permission checks without race conditions', async () => {
      testContext = createPermissionTestContext({
        denyOperations: ['evaluate', 'screenshot']
      });

      // Concurrent operations with mixed permissions
      const concurrentOperations = [
        testContext.browserTool.execute({ operation: 'navigate', params: { url: 'https://site1.com' } }), // Allowed
        testContext.browserTool.execute({ operation: 'navigate', params: { url: 'https://site2.com' } }), // Allowed
        testContext.browserTool.execute({ operation: 'evaluate', params: { script: 'document.title' } }), // Denied
        testContext.browserTool.execute({ operation: 'click', params: { selector: '#btn1' } }), // Allowed
        testContext.browserTool.execute({ operation: 'screenshot', params: { fullPage: true } }), // Denied
        testContext.browserTool.execute({ operation: 'click', params: { selector: '#btn2' } }), // Allowed
      ];

      const results = await Promise.allSettled(concurrentOperations);

      // Verify expected pattern
      const successCount = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
      const deniedCount = results.filter(r => r.status === 'fulfilled' && (r.value as any).permissionDenied).length;

      expect(successCount).toBeGreaterThan(0); // Some operations should succeed
      expect(deniedCount).toBeGreaterThan(0); // Some should be denied
      expect(successCount + deniedCount).toBe(results.length); // All should be handled

      assertNoCrashes();
    });

    it('should maintain stability during permission system overload', async () => {
      testContext = scenarios.simulateFailure();

      // Attempt operations while permission system is failing
      const overloadOperations = Array(20).fill(null).map((_, i) => ({
        operation: 'navigate' as BrowserOperation,
        params: { url: `https://example.com/page-${i}` }
      }));

      const results = await Promise.all(
        overloadOperations.map(op => testContext.browserTool.execute(op))
      );

      // All should fail gracefully (not throw)
      results.forEach(result => {
        expect(() => result).not.toThrow();
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/permission.*database|connection.*lost|system.*error/i);
      });

      assertNoCrashes();
    });
  });

  describe('Resource Management During Failures', () => {
    it('should prevent resource accumulation during repeated denials', async () => {
      testContext = scenarios.denyAllOperations();

      const initialState = { ...testContext.mockBrowser.state };

      // Repeated failed operations
      for (let i = 0; i < 50; i++) {
        const result = await testContext.browserTool.execute({
          operation: 'navigate',
          params: { url: `https://example.com/page-${i}` }
        });

        assertPermissionDeniedResponse(result, 'navigate');

        // State should not accumulate
        expect(testContext.mockBrowser.state.activeOperations).toBe(0);
      }

      // Final state should match initial state
      expect(testContext.mockBrowser.state.browserActive).toBe(initialState.browserActive);
      expect(testContext.mockBrowser.state.contextActive).toBe(initialState.contextActive);
      expect(testContext.mockBrowser.state.pageActive).toBe(initialState.pageActive);

      assertCleanResourceState(testContext);
    });

    it('should handle partial resource allocation failures gracefully', async () => {
      testContext = createPermissionTestContext();

      // Simulate scenario where browser launches but context creation is denied
      const originalNewContext = testContext.mockBrowser.browser.newContext;
      testContext.mockBrowser.browser.newContext = vi.fn(() => {
        throw new Error('Context creation denied by policy');
      });

      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(() => result).not.toThrow();

      // Restore for cleanup
      testContext.mockBrowser.browser.newContext = originalNewContext;

      assertNoCrashes();
    });

    it('should cleanup resources when permission denied during cleanup', async () => {
      testContext = createPermissionTestContext();

      // Establish session
      const navResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(navResult.success).toBe(true);

      // Simulate cleanup permission denial
      const originalClose = testContext.mockBrowser.close;
      testContext.mockBrowser.close = vi.fn(async () => {
        throw new Error('Cleanup permission denied');
      });

      // Cleanup should not throw even if denied
      expect(async () => {
        await testContext.browserTool.cleanup();
      }).not.toThrow();

      // Restore for test teardown
      testContext.mockBrowser.close = originalClose;

      assertNoCrashes();
    });
  });

  describe('Edge Case Validation', () => {
    it('should handle malformed permission responses gracefully', async () => {
      testContext = createPermissionTestContext();

      // Mock malformed permission response
      testContext.permissionManager.checkToolPermission = vi.fn().mockResolvedValue({
        allowed: undefined, // Malformed
        level: null,
        requiresConfirmation: 'invalid', // Wrong type
      });

      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Should handle malformed response gracefully
      expect(() => result).not.toThrow();
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*error|system.*error/i);

      assertNoCrashes();
    });

    it('should handle extremely long URLs in permission denial messages', async () => {
      testContext = scenarios.denyNavigation();

      const veryLongUrl = 'https://example.com/' + 'a'.repeat(2000) + '/sensitive';

      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: veryLongUrl }
      });

      assertPermissionDeniedResponse(result, 'navigate');

      // Error message should be reasonable length (not include full URL)
      expect(result.error.length).toBeLessThan(500);
      assertErrorMessageQuality(result.error);
    });

    it('should handle special characters in permission scope safely', async () => {
      testContext = scenarios.denyAllOperations();

      const specialUrls = [
        'https://example.com/path?param=value&other="quoted"',
        'https://example.com/path#fragment<script>alert("xss")</script>',
        'https://example.com/path?param=value\n\r\t',
      ];

      for (const url of specialUrls) {
        const result = await testContext.browserTool.execute({
          operation: 'navigate',
          params: { url }
        });

        assertPermissionDeniedResponse(result, 'navigate');

        // Error message should not contain unescaped special characters
        expect(result.error).not.toContain('<script>');
        expect(result.error).not.toContain('\n');
        expect(result.error).not.toContain('\r');
        expect(result.error).not.toContain('\t');

        assertErrorMessageQuality(result.error);
      }

      assertNoCrashes();
    });
  });

  describe('Integration Test Comprehensive Validation', () => {
    it('should demonstrate complete error recovery workflow', async () => {
      // This integration test demonstrates a complete workflow from denial to recovery
      testContext = scenarios.denyAllOperations();

      // Phase 1: Initial denial
      const phase1Result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://corporate.com/dashboard' }
      });

      assertPermissionDeniedResponse(phase1Result, 'navigate');
      expect(phase1Result.metadata.suggestions.length).toBeGreaterThan(0);

      // Phase 2: Partial permission grant
      await testContext.permissionManager.grantPermission('Browser', 'limited', 'navigate');

      const phase2Result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(phase2Result.success).toBe(true);

      // Phase 3: Sensitive operation still denied
      const phase3Result = await testContext.browserTool.execute({
        operation: 'evaluate',
        params: { script: 'fetch("/api/sensitive")' }
      });

      assertPermissionDeniedResponse(phase3Result, 'evaluate');

      // Phase 4: Full permission escalation
      await testContext.permissionManager.grantPermission('Browser', 'full');

      const phase4Result = await testContext.browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' }
      });

      expect(phase4Result.success).toBe(true);

      // Verify system stability throughout entire workflow
      assertNoCrashes();
      assertCleanResourceState(testContext);

      // Verify event sequence
      const events = testContext.events;
      const deniedEvents = events.filter(e => e.type === 'denied');
      const grantedEvents = events.filter(e => e.type === 'granted');

      expect(deniedEvents.length).toBeGreaterThan(0);
      expect(grantedEvents.length).toBeGreaterThan(0);
    });
  });
});