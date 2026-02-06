/**
 * Browser Permission-Denied Graceful Handling Integration Tests
 *
 * This test suite comprehensively verifies that browser automation handles
 * permission-denied scenarios gracefully without crashes, with appropriate
 * error messages, and proper resource cleanup.
 *
 * Tests ensure that when permissions are denied:
 * 1. System handles denial gracefully without crashes
 * 2. Appropriate, user-friendly error messages are provided
 * 3. Proper cleanup of browser resources occurs
 * 4. No resource leaks when permissions denied mid-operation
 * 5. Appropriate events are emitted for monitoring
 * 6. Recovery workflows are supported
 *
 * @module tests/integration/browser-permission-denied-graceful
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

describe('Browser Permission-Denied Graceful Handling Integration Tests', () => {
  let testContext: PermissionTestContext;
  const scenarios = createPermissionDenialScenarios();

  afterEach(async () => {
    if (testContext) {
      await testContext.browserTool.cleanup();
      testContext = null as any;
    }
    vi.restoreAllMocks();
  });

  describe('Pre-Operation Denial', () => {
    it('should handle navigation denial before browser launch', async () => {
      testContext = scenarios.denyNavigation();

      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Verify graceful denial
      assertPermissionDeniedResponse(result, 'navigate');
      expect(result.error).toMatch(/permission.*denied|navigation.*blocked/i);

      // Verify no browser resources were allocated
      expect(testContext.mockBrowser.state.browserActive).toBe(false);
      expect(testContext.mockBrowser.state.contextActive).toBe(false);
      expect(testContext.mockBrowser.state.pageActive).toBe(false);

      // Verify events were emitted
      assertPermissionEventsEmitted(testContext.events, 'denied', 'Browser');

      // Verify no crashes occurred
      assertNoCrashes();
    });

    it('should handle click operation denial before element interaction', async () => {
      testContext = scenarios.denyInteraction();

      const result = await testContext.browserTool.execute({
        operation: 'click',
        params: { selector: '#button' }
      });

      assertPermissionDeniedResponse(result, 'click');
      expect(result.error).toMatch(/permission.*denied|click.*not.*allowed/i);

      // No interaction should have occurred
      expect(testContext.mockBrowser.page.click).not.toHaveBeenCalled();

      assertPermissionEventsEmitted(testContext.events, 'denied');
      assertNoCrashes();
    });

    it('should handle screenshot denial before image capture', async () => {
      testContext = scenarios.denyScreenshots();

      const result = await testContext.browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      assertPermissionDeniedResponse(result, 'screenshot');
      expect(result.error).toMatch(/permission.*denied|screenshot.*not.*allowed/i);

      // No screenshot should have been taken
      expect(testContext.mockBrowser.page.screenshot).not.toHaveBeenCalled();

      assertPermissionEventsEmitted(testContext.events, 'denied');
      assertNoCrashes();
    });

    it('should handle JavaScript execution denial', async () => {
      testContext = scenarios.denyJavaScript();

      const result = await testContext.browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' }
      });

      assertPermissionDeniedResponse(result, 'evaluate');
      expect(result.error).toMatch(/permission.*denied|javascript.*not.*allowed/i);

      // No JavaScript should have been executed
      expect(testContext.mockBrowser.page.evaluate).not.toHaveBeenCalled();

      assertPermissionEventsEmitted(testContext.events, 'denied');
      assertNoCrashes();
    });

    it('should handle data extraction denial (getText)', async () => {
      testContext = scenarios.denyDataExtraction();

      const result = await testContext.browserTool.execute({
        operation: 'getText',
        params: { selector: 'h1' }
      });

      assertPermissionDeniedResponse(result, 'getText');
      expect(result.error).toMatch(/permission.*denied|text.*extraction.*not.*allowed/i);

      // No text extraction should have occurred
      expect(testContext.mockBrowser.page.textContent).not.toHaveBeenCalled();

      assertPermissionEventsEmitted(testContext.events, 'denied');
      assertNoCrashes();
    });

    it('should handle attribute extraction denial (getAttribute)', async () => {
      testContext = scenarios.denyDataExtraction();

      const result = await testContext.browserTool.execute({
        operation: 'getAttribute',
        params: { selector: '#form', attribute: 'action' }
      });

      assertPermissionDeniedResponse(result, 'getAttribute');
      expect(result.error).toMatch(/permission.*denied|attribute.*extraction.*not.*allowed/i);

      // No attribute extraction should have occurred
      expect(testContext.mockBrowser.page.getAttribute).not.toHaveBeenCalled();

      assertPermissionEventsEmitted(testContext.events, 'denied');
      assertNoCrashes();
    });
  });

  describe('Mid-Operation Denial', () => {
    it('should handle permission denial during active browser session', async () => {
      // Start with permissions granted
      testContext = createPermissionTestContext();

      // First operation should succeed
      await testContext.permissionManager.grantPermission('Browser', 'full', 'navigate');

      const firstResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(firstResult.success).toBe(true);
      expect(testContext.mockBrowser.state.pageActive).toBe(true);

      // Now deny further operations
      await testContext.permissionManager.denyPermission('Browser', 'click');

      const secondResult = await testContext.browserTool.execute({
        operation: 'click',
        params: { selector: '#button' }
      });

      // Second operation should be denied but session should remain stable
      assertPermissionDeniedResponse(secondResult, 'click');

      // Browser should still be active from first operation
      expect(testContext.mockBrowser.state.pageActive).toBe(true);

      assertPermissionEventsEmitted(testContext.events, 'denied');
      assertNoCrashes();
    });

    it('should handle concurrent permission denials gracefully', async () => {
      testContext = scenarios.partialDenial();

      // Mix of operations, some denied, some allowed
      const operations = [
        { operation: 'navigate', params: { url: 'https://example.com' } },
        { operation: 'evaluate', params: { script: 'window.location.href' } }, // Should be denied
        { operation: 'click', params: { selector: '#button' } },
        { operation: 'submit', params: { selector: '#form' } }, // Should be denied
      ];

      const results = await Promise.allSettled(
        operations.map(op => testContext.browserTool.execute(op))
      );

      // Check that denied operations failed gracefully
      const evaluateResult = results[1];
      const submitResult = results[3];

      expect(evaluateResult.status).toBe('fulfilled');
      if (evaluateResult.status === 'fulfilled') {
        assertPermissionDeniedResponse(evaluateResult.value, 'evaluate');
      }

      expect(submitResult.status).toBe('fulfilled');
      if (submitResult.status === 'fulfilled') {
        assertPermissionDeniedResponse(submitResult.value, 'submit');
      }

      // Verify system remained stable
      assertNoCrashes();

      // Verify both denial and grant events were emitted
      const deniedEvents = testContext.events.filter(e => e.type === 'denied');
      const grantedEvents = testContext.events.filter(e => e.type === 'granted');

      expect(deniedEvents.length).toBeGreaterThan(0);
      expect(grantedEvents.length).toBeGreaterThan(0);
    });
  });

  describe('No Crash Scenarios', () => {
    it('should handle complete operation denial without system instability', async () => {
      testContext = scenarios.denyAllOperations();

      // Attempt multiple operations in rapid succession
      const operations: Array<{ operation: BrowserOperation; params: any }> = [
        { operation: 'navigate', params: { url: 'https://example.com' } },
        { operation: 'click', params: { selector: '#button' } },
        { operation: 'type', params: { selector: '#input', text: 'test' } },
        { operation: 'screenshot', params: { fullPage: true } },
        { operation: 'evaluate', params: { script: 'document.title' } },
      ];

      const results = [];
      for (const op of operations) {
        const result = await testContext.browserTool.execute(op);
        results.push(result);
      }

      // All operations should be denied gracefully
      results.forEach((result, index) => {
        assertPermissionDeniedResponse(result, operations[index].operation);
      });

      // Verify no browser operations were actually executed
      expect(testContext.mockBrowser.page.goto).not.toHaveBeenCalled();
      expect(testContext.mockBrowser.page.click).not.toHaveBeenCalled();
      expect(testContext.mockBrowser.page.type).not.toHaveBeenCalled();
      expect(testContext.mockBrowser.page.screenshot).not.toHaveBeenCalled();
      expect(testContext.mockBrowser.page.evaluate).not.toHaveBeenCalled();

      // Verify system stability
      assertNoCrashes();
      assertCleanResourceState(testContext);
    });

    it('should handle permission system failures without crashes', async () => {
      testContext = scenarios.simulateFailure();

      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Should handle permission system failure gracefully
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*database|connection.*lost/i);

      // No browser operations should have been attempted
      expect(testContext.mockBrowser.page.goto).not.toHaveBeenCalled();

      assertNoCrashes();
    });

    it('should handle rapid permission changes without instability', async () => {
      testContext = createPermissionTestContext();

      // Rapidly grant and deny permissions
      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
          await testContext.permissionManager.grantPermission('Browser', 'full');
        } else {
          await testContext.permissionManager.denyPermission('Browser');
        }

        const result = await testContext.browserTool.execute({
          operation: 'navigate',
          params: { url: `https://example.com/page${i}` }
        });

        // Result should match current permission state
        if (i % 2 === 0) {
          expect(result.success).toBe(true);
        } else {
          expect(result.success).toBe(false);
          assertPermissionDeniedResponse(result, 'navigate');
        }
      }

      assertNoCrashes();
    });
  });

  describe('Error Response Structure', () => {
    it('should return properly structured permission denied responses', async () => {
      testContext = scenarios.denyNavigation();

      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Verify complete response structure
      expect(result).toMatchObject({
        success: false,
        operation: 'navigate',
        error: expect.any(String),
        permissionDenied: true,
        metadata: {
          permissionDenied: true,
          deniedBy: expect.any(String),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
          suggestions: expect.any(Array),
        },
      });

      // Verify error message quality
      assertErrorMessageQuality(result.error);

      // Verify suggestions are helpful
      expect(result.metadata.suggestions.length).toBeGreaterThan(0);
      result.metadata.suggestions.forEach((suggestion: string) => {
        expect(typeof suggestion).toBe('string');
        expect(suggestion.length).toBeGreaterThan(10);
      });
    });

    it('should provide operation-specific error messages', async () => {
      const operationTests = [
        {
          scenario: scenarios.denyNavigation(),
          operation: 'navigate' as BrowserOperation,
          params: { url: 'https://blocked.com' },
          expectedErrorPattern: /navigation.*denied|access.*blocked/i,
        },
        {
          scenario: scenarios.denyJavaScript(),
          operation: 'evaluate' as BrowserOperation,
          params: { script: 'document.title' },
          expectedErrorPattern: /javascript.*denied|execution.*not.*permitted/i,
        },
        {
          scenario: scenarios.denyScreenshots(),
          operation: 'screenshot' as BrowserOperation,
          params: { fullPage: true },
          expectedErrorPattern: /screenshot.*denied|capture.*not.*allowed/i,
        },
      ];

      for (const test of operationTests) {
        testContext = test.scenario;

        const result = await testContext.browserTool.execute({
          operation: test.operation,
          params: test.params,
        });

        assertPermissionDeniedResponse(result, test.operation);
        expect(result.error).toMatch(test.expectedErrorPattern);
        assertErrorMessageQuality(result.error);

        await testContext.browserTool.cleanup();
      }
    });

    it('should include helpful resolution suggestions for different denial types', async () => {
      const denialTypeTests = [
        {
          scenario: scenarios.blockDomains(['malicious.com']),
          operation: 'navigate' as BrowserOperation,
          params: { url: 'https://malicious.com' },
          expectedSuggestions: ['domain', 'allowed', 'security'],
        },
        {
          scenario: scenarios.denyJavaScript(),
          operation: 'evaluate' as BrowserOperation,
          params: { script: 'alert("test")' },
          expectedSuggestions: ['javascript', 'configuration', 'different'],
        },
      ];

      for (const test of denialTypeTests) {
        testContext = test.scenario;

        const result = await testContext.browserTool.execute({
          operation: test.operation,
          params: test.params,
        });

        assertPermissionDeniedResponse(result, test.operation);

        // Check that suggestions contain expected keywords
        const suggestionsText = result.metadata.suggestions.join(' ').toLowerCase();
        test.expectedSuggestions.forEach(keyword => {
          expect(suggestionsText).toContain(keyword);
        });

        await testContext.browserTool.cleanup();
      }
    });

    it('should sanitize error messages to not expose internal paths', async () => {
      testContext = scenarios.denyAllOperations();

      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      assertPermissionDeniedResponse(result, 'navigate');

      // Verify no internal paths or secrets are exposed
      expect(result.error).not.toContain('/Users/');
      expect(result.error).not.toContain('node_modules');
      expect(result.error).not.toContain('packages/');
      expect(result.error).not.toContain('.ts');
      expect(result.error).not.toContain('TypeError');
      expect(result.error).not.toContain('undefined');

      assertErrorMessageQuality(result.error);
    });
  });

  describe('Domain-Based Permission Denial', () => {
    it('should handle blocked domain access gracefully', async () => {
      testContext = scenarios.blockDangerous();

      const blockedDomains = [
        'https://malicious.com',
        'https://dangerous.site/path',
        'https://blocked.domain/page?param=value',
      ];

      for (const url of blockedDomains) {
        const result = await testContext.browserTool.execute({
          operation: 'navigate',
          params: { url }
        });

        assertPermissionDeniedResponse(result, 'navigate');
        expect(result.error).toMatch(/domain.*blocked|access.*denied/i);

        // Verify no navigation occurred
        expect(testContext.mockBrowser.page.goto).not.toHaveBeenCalledWith(url);
      }

      assertNoCrashes();
    });

    it('should allow non-blocked domains while denying blocked ones', async () => {
      testContext = scenarios.blockDomains(['blocked.com']);

      // Allow safe domains
      const allowedResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(allowedResult.success).toBe(true);

      // Block dangerous domains
      const blockedResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://blocked.com' }
      });

      assertPermissionDeniedResponse(blockedResult, 'navigate');
      expect(blockedResult.error).toMatch(/domain.*blocked|permission.*denied/i);

      assertNoCrashes();
    });
  });

  describe('Event Emission Verification', () => {
    it('should emit permission:denied events with correct payload', async () => {
      testContext = scenarios.denyNavigation();

      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

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

      expect(latestEvent.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
      expect(latestEvent.denialReason!.length).toBeGreaterThan(0);
    });

    it('should emit both denied and granted events in mixed scenarios', async () => {
      testContext = scenarios.partialDenial();

      // Perform operations that should have mixed results
      await Promise.allSettled([
        testContext.browserTool.execute({ operation: 'navigate', params: { url: 'https://example.com' } }),
        testContext.browserTool.execute({ operation: 'evaluate', params: { script: 'document.title' } }),
        testContext.browserTool.execute({ operation: 'click', params: { selector: '#button' } }),
      ]);

      const grantedEvents = testContext.events.filter(e => e.type === 'granted');
      const deniedEvents = testContext.events.filter(e => e.type === 'denied');

      expect(grantedEvents.length).toBeGreaterThan(0);
      expect(deniedEvents.length).toBeGreaterThan(0);

      // Verify event structure
      grantedEvents.forEach(event => {
        expect(event).toMatchObject({
          type: 'granted',
          tool: 'Browser',
          scope: expect.any(String),
          level: expect.any(String),
          timestamp: expect.any(Date),
        });
      });

      deniedEvents.forEach(event => {
        expect(event).toMatchObject({
          type: 'denied',
          tool: 'Browser',
          scope: expect.any(String),
          denialReason: expect.any(String),
          timestamp: expect.any(Date),
        });
      });
    });
  });

  describe('Recovery and Retry Scenarios', () => {
    it('should support retry after permission grant', async () => {
      testContext = scenarios.denyNavigation();

      // First attempt should fail
      const firstResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      assertPermissionDeniedResponse(firstResult, 'navigate');

      // Grant permission
      await testContext.permissionManager.grantPermission('Browser', 'full', 'navigate');

      // Second attempt should succeed
      const secondResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(secondResult.success).toBe(true);
      expect(secondResult.operation).toBe('navigate');

      assertNoCrashes();
    });

    it('should maintain stable state after permission changes', async () => {
      testContext = createPermissionTestContext();

      // Start with denied permissions
      await testContext.permissionManager.denyPermission('Browser');

      // Multiple failed attempts
      for (let i = 0; i < 3; i++) {
        const result = await testContext.browserTool.execute({
          operation: 'navigate',
          params: { url: `https://example.com/page${i}` }
        });

        assertPermissionDeniedResponse(result, 'navigate');
      }

      // Grant permissions
      await testContext.permissionManager.grantPermission('Browser', 'full');

      // Should now succeed
      const successResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/success' }
      });

      expect(successResult.success).toBe(true);

      // Resource state should be clean
      assertCleanResourceState(testContext);
      assertNoCrashes();
    });
  });
});