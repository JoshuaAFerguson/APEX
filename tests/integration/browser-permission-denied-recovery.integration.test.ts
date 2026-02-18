/**
 * Browser Permission-Denied Recovery Scenarios Integration Tests
 *
 * This test suite verifies that browser automation can recover gracefully
 * from permission denials and support retry/recovery workflows.
 *
 * Tests verify:
 * 1. Retry after permission grant following initial denial
 * 2. Fresh session creation after cleanup from denial
 * 3. Event handling for permission state changes
 * 4. State transitions during permission changes
 * 5. Recovery from different types of permission denials
 *
 * @module tests/integration/browser-permission-denied-recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createPermissionTestContext,
  createPermissionDenialScenarios,
  assertPermissionDeniedResponse,
  assertCleanResourceState,
  assertPermissionEventsEmitted,
  assertNoCrashes,
  type PermissionTestContext,
  type PermissionEvent
} from '../test-utils/permission-test-helpers.js';
import type { BrowserOperation } from '../../packages/orchestrator/src/tools/browser-tool.js';

describe('Browser Permission-Denied Recovery Scenarios Integration Tests', () => {
  let testContext: PermissionTestContext;
  const scenarios = createPermissionDenialScenarios();

  afterEach(async () => {
    if (testContext) {
      await testContext.browserTool.cleanup();
      testContext = null as any;
    }
    vi.restoreAllMocks();
  });

  describe('Retry After Denial', () => {
    it('should support retry after granting navigation permission', async () => {
      testContext = scenarios.denyNavigation();

      // First attempt should fail
      const firstResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      assertPermissionDeniedResponse(firstResult, 'navigate');
      expect(testContext.events.filter(e => e.type === 'denied').length).toBe(1);

      // Grant permission
      await testContext.permissionManager.grantPermission('Browser', 'full', 'navigate');

      // Second attempt should succeed
      const secondResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(secondResult.success).toBe(true);
      expect(secondResult.operation).toBe('navigate');
      expect(secondResult.data?.url).toBe('https://example.com');

      // Verify permission granted event was emitted
      assertPermissionEventsEmitted(testContext.events, 'granted', 'Browser');

      assertNoCrashes();
    });

    it('should support retry after granting JavaScript permission', async () => {
      testContext = scenarios.denyJavaScript();

      // First attempt should fail
      const firstResult = await testContext.browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' }
      });

      assertPermissionDeniedResponse(firstResult, 'evaluate');

      // Grant permission
      await testContext.permissionManager.grantPermission('Browser', 'full', 'evaluate');

      // Second attempt should succeed
      const secondResult = await testContext.browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' }
      });

      expect(secondResult.success).toBe(true);
      expect(secondResult.operation).toBe('evaluate');
      expect(secondResult.data?.result).toBe('mock-evaluation-result');

      assertNoCrashes();
    });

    it('should support retry after granting interaction permissions', async () => {
      testContext = scenarios.denyInteraction();

      // First attempt should fail
      const firstResult = await testContext.browserTool.execute({
        operation: 'click',
        params: { selector: '#button' }
      });

      assertPermissionDeniedResponse(firstResult, 'click');

      // Grant permission
      await testContext.permissionManager.grantPermission('Browser', 'full', 'click');

      // Second attempt should succeed
      const secondResult = await testContext.browserTool.execute({
        operation: 'click',
        params: { selector: '#button' }
      });

      expect(secondResult.success).toBe(true);
      expect(secondResult.operation).toBe('click');
      expect(testContext.mockBrowser.page.click).toHaveBeenCalledWith('#button');

      assertNoCrashes();
    });

    it('should support retry after granting screenshot permissions', async () => {
      testContext = scenarios.denyScreenshots();

      // First attempt should fail
      const firstResult = await testContext.browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      assertPermissionDeniedResponse(firstResult, 'screenshot');

      // Grant permission
      await testContext.permissionManager.grantPermission('Browser', 'full', 'screenshot');

      // Second attempt should succeed
      const secondResult = await testContext.browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      expect(secondResult.success).toBe(true);
      expect(secondResult.operation).toBe('screenshot');
      expect(Buffer.isBuffer(secondResult.data?.screenshot)).toBe(true);

      assertNoCrashes();
    });

    it('should handle complex multi-operation retry scenarios', async () => {
      testContext = scenarios.partialDenial();

      // Mix of operations, some denied, some allowed
      const operations = [
        { operation: 'navigate', params: { url: 'https://example.com' }, shouldInitiallySucceed: true },
        { operation: 'evaluate', params: { script: 'document.title' }, shouldInitiallySucceed: false },
        { operation: 'click', params: { selector: '#button' }, shouldInitiallySucceed: true },
        { operation: 'submit', params: { selector: '#form' }, shouldInitiallySucceed: false },
      ];

      // First round - mixed results
      const firstResults = [];
      for (const op of operations) {
        const result = await testContext.browserTool.execute(op);
        firstResults.push(result);

        if (op.shouldInitiallySucceed) {
          expect(result.success).toBe(true);
        } else {
          assertPermissionDeniedResponse(result, op.operation as BrowserOperation);
        }
      }

      // Grant all permissions
      await testContext.permissionManager.grantPermission('Browser', 'full', 'evaluate');
      await testContext.permissionManager.grantPermission('Browser', 'full', 'submit');

      // Second round - all should succeed
      const secondResults = [];
      for (const op of operations) {
        const result = await testContext.browserTool.execute(op);
        secondResults.push(result);
        expect(result.success).toBe(true);
      }

      assertNoCrashes();
    });

    it('should support immediate retry after permission grant', async () => {
      testContext = createPermissionTestContext();

      // Start denied
      await testContext.permissionManager.denyPermission('Browser', 'navigate');

      // Fail
      const deniedResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      assertPermissionDeniedResponse(deniedResult, 'navigate');

      // Grant and immediately retry
      await testContext.permissionManager.grantPermission('Browser', 'full', 'navigate');

      const immediateResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(immediateResult.success).toBe(true);

      assertNoCrashes();
    });
  });

  describe('Fresh Session After Denial', () => {
    it('should create fresh session after cleanup from denied state', async () => {
      testContext = scenarios.denyAllOperations();

      // First attempt should fail
      const deniedResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      assertPermissionDeniedResponse(deniedResult, 'navigate');

      // Cleanup should work even after denial
      await testContext.browserTool.cleanup();
      assertCleanResourceState(testContext);

      // Grant permissions
      await testContext.permissionManager.grantPermission('Browser', 'full');

      // New operation should create fresh session
      const freshResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(freshResult.success).toBe(true);
      expect(testContext.mockBrowser.state.pageActive).toBe(true);

      // Should have new session ID
      const resourceState = testContext.browserTool.getResourceState();
      expect(resourceState.sessionId).toBeDefined();

      assertNoCrashes();
    });

    it('should maintain clean state between denied sessions', async () => {
      testContext = createPermissionTestContext();

      // Session 1: Allow navigation, deny clicks
      await testContext.permissionManager.grantPermission('Browser', 'full', 'navigate');
      await testContext.permissionManager.denyPermission('Browser', 'click');

      const nav1 = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example1.com' }
      });
      expect(nav1.success).toBe(true);

      const click1 = await testContext.browserTool.execute({
        operation: 'click',
        params: { selector: '#button1' }
      });
      assertPermissionDeniedResponse(click1, 'click');

      await testContext.browserTool.cleanup();
      assertCleanResourceState(testContext);

      // Session 2: Allow clicks, deny navigation
      await testContext.permissionManager.denyPermission('Browser', 'navigate');
      await testContext.permissionManager.grantPermission('Browser', 'full', 'click');

      const nav2 = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example2.com' }
      });
      assertPermissionDeniedResponse(nav2, 'navigate');

      // Click should work now (but no page to click on due to nav denial)
      const click2 = await testContext.browserTool.execute({
        operation: 'click',
        params: { selector: '#button2' }
      });
      expect(click2.success).toBe(true);

      assertNoCrashes();
    });

    it('should handle session recreation after partial resource cleanup failure', async () => {
      testContext = createPermissionTestContext();

      // Establish session
      await testContext.permissionManager.grantPermission('Browser', 'full');
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Mock partial cleanup failure
      testContext.mockBrowser.page.close.mockRejectedValue(new Error('Page close failed'));

      // Cleanup should handle failure gracefully
      await testContext.browserTool.cleanup();

      // Grant permissions and create new session
      await testContext.permissionManager.grantPermission('Browser', 'full');

      const freshResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://newexample.com' }
      });

      expect(freshResult.success).toBe(true);

      assertNoCrashes();
    });
  });

  describe('Event Handling', () => {
    it('should emit complete event sequence during permission recovery', async () => {
      testContext = scenarios.denyNavigation();

      // Clear existing events
      testContext.events.length = 0;

      // Failed attempt
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Should have denial event
      expect(testContext.events.filter(e => e.type === 'denied').length).toBe(1);

      // Grant permission
      await testContext.permissionManager.grantPermission('Browser', 'full', 'navigate');

      // Successful attempt
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Should have both denial and grant events
      const deniedEvents = testContext.events.filter(e => e.type === 'denied');
      const grantedEvents = testContext.events.filter(e => e.type === 'granted');

      expect(deniedEvents.length).toBe(1);
      expect(grantedEvents.length).toBe(1);

      // Events should have correct timestamps
      expect(deniedEvents[0].timestamp.getTime()).toBeLessThan(grantedEvents[0].timestamp.getTime());
    });

    it('should emit permission events for each operation type during recovery', async () => {
      testContext = scenarios.partialDenial();

      testContext.events.length = 0;

      // Mixed operations
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      }); // Should succeed

      await testContext.browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' }
      }); // Should fail

      // Grant evaluate permission
      await testContext.permissionManager.grantPermission('Browser', 'full', 'evaluate');

      await testContext.browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' }
      }); // Should succeed

      // Check event sequence
      const navGranted = testContext.events.find(e => e.type === 'granted' && e.scope === 'navigate');
      const evalDenied = testContext.events.find(e => e.type === 'denied' && e.scope === 'evaluate');
      const evalGranted = testContext.events.find(e => e.type === 'granted' && e.scope === 'evaluate');

      expect(navGranted).toBeDefined();
      expect(evalDenied).toBeDefined();
      expect(evalGranted).toBeDefined();

      // Verify chronological order
      expect(navGranted!.timestamp.getTime()).toBeLessThan(evalDenied!.timestamp.getTime());
      expect(evalDenied!.timestamp.getTime()).toBeLessThan(evalGranted!.timestamp.getTime());
    });

    it('should emit events with proper context during domain permission recovery', async () => {
      testContext = scenarios.blockDomains(['blocked.com']);

      testContext.events.length = 0;

      // Attempt blocked domain
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://blocked.com' }
      });

      const deniedEvent = testContext.events.find(e => e.type === 'denied');
      expect(deniedEvent).toBeDefined();
      expect(deniedEvent!.scope).toContain('navigate');
      expect(deniedEvent!.denialReason).toMatch(/domain|blocked/i);

      // Update configuration to allow domain
      await testContext.permissionManager.setToolConfig('Browser', {
        blockedDomains: [],
        allowedDomains: ['blocked.com', 'example.com']
      });

      // Grant permission
      await testContext.permissionManager.grantPermission('Browser', 'full', 'navigate');

      // Retry
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://blocked.com' }
      });

      const grantedEvent = testContext.events.find(e => e.type === 'granted' && e.timestamp > deniedEvent!.timestamp);
      expect(grantedEvent).toBeDefined();
      expect(grantedEvent!.scope).toContain('navigate');
    });

    it('should handle event emission during rapid permission changes', async () => {
      testContext = createPermissionTestContext();

      testContext.events.length = 0;

      // Rapid permission changes
      for (let i = 0; i < 5; i++) {
        if (i % 2 === 0) {
          await testContext.permissionManager.grantPermission('Browser', 'full', 'navigate');
        } else {
          await testContext.permissionManager.denyPermission('Browser', 'navigate');
        }

        await testContext.browserTool.execute({
          operation: 'navigate',
          params: { url: `https://example.com/page${i}` }
        });
      }

      // Should have events for each attempt
      const grantedEvents = testContext.events.filter(e => e.type === 'granted');
      const deniedEvents = testContext.events.filter(e => e.type === 'denied');

      expect(grantedEvents.length).toBeGreaterThan(0);
      expect(deniedEvents.length).toBeGreaterThan(0);

      // Events should be in chronological order
      for (let i = 1; i < testContext.events.length; i++) {
        expect(testContext.events[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          testContext.events[i - 1].timestamp.getTime()
        );
      }

      assertNoCrashes();
    });
  });

  describe('State Transitions During Recovery', () => {
    it('should maintain consistent resource state during permission recovery', async () => {
      testContext = scenarios.denyNavigation();

      // Initial state
      let resourceState = testContext.browserTool.getResourceState();
      expect(resourceState.activeOperations).toBe(0);
      expect(resourceState.lifecycleState).toBe('idle');

      // Failed operation should not change resource state
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      resourceState = testContext.browserTool.getResourceState();
      expect(resourceState.activeOperations).toBe(0);
      expect(resourceState.browserActive).toBe(false);

      // Grant permission and successful operation should update state
      await testContext.permissionManager.grantPermission('Browser', 'full', 'navigate');

      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      resourceState = testContext.browserTool.getResourceState();
      expect(resourceState.pageActive).toBe(true);
      expect(resourceState.lifecycleState).toBe('active');
    });

    it('should handle state transitions during mixed operation recovery', async () => {
      testContext = scenarios.partialDenial();

      // Start with some operations working
      const navResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      expect(navResult.success).toBe(true);

      let resourceState = testContext.browserTool.getResourceState();
      expect(resourceState.pageActive).toBe(true);

      // Failed operation should not break existing state
      const evalResult = await testContext.browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' }
      });
      assertPermissionDeniedResponse(evalResult, 'evaluate');

      resourceState = testContext.browserTool.getResourceState();
      expect(resourceState.pageActive).toBe(true); // Should still be active

      // Grant permission and retry
      await testContext.permissionManager.grantPermission('Browser', 'full', 'evaluate');

      const evalRetry = await testContext.browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' }
      });
      expect(evalRetry.success).toBe(true);

      resourceState = testContext.browserTool.getResourceState();
      expect(resourceState.pageActive).toBe(true);
      expect(resourceState.activeOperations).toBe(0);
    });

    it('should properly track operation counts during recovery scenarios', async () => {
      testContext = createPermissionTestContext();

      // Start with granted permissions
      await testContext.permissionManager.grantPermission('Browser', 'full');

      // Perform operation
      const result1 = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      expect(result1.success).toBe(true);

      let resourceState = testContext.browserTool.getResourceState();
      expect(resourceState.activeOperations).toBe(0); // Should be 0 after completion

      // Deny permissions
      await testContext.permissionManager.denyPermission('Browser', 'click');

      // Failed operation should not affect operation count
      const result2 = await testContext.browserTool.execute({
        operation: 'click',
        params: { selector: '#button' }
      });
      assertPermissionDeniedResponse(result2, 'click');

      resourceState = testContext.browserTool.getResourceState();
      expect(resourceState.activeOperations).toBe(0);

      // Grant and retry
      await testContext.permissionManager.grantPermission('Browser', 'full', 'click');

      const result3 = await testContext.browserTool.execute({
        operation: 'click',
        params: { selector: '#button' }
      });
      expect(result3.success).toBe(true);

      resourceState = testContext.browserTool.getResourceState();
      expect(resourceState.activeOperations).toBe(0);
    });
  });

  describe('Different Recovery Patterns', () => {
    it('should support one-time permission grants with expiration', async () => {
      testContext = scenarios.denyNavigation();

      // Grant one-time permission
      await testContext.permissionManager.grantPermission('Browser', 'once', 'navigate');

      // First use should succeed
      const firstResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      expect(firstResult.success).toBe(true);

      // Second use should fail (permission consumed)
      const secondResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example2.com' }
      });
      assertPermissionDeniedResponse(secondResult, 'navigate');

      assertNoCrashes();
    });

    it('should support permanent permission grants', async () => {
      testContext = scenarios.denyAllOperations();

      // Grant permanent permissions
      await testContext.permissionManager.grantPermission('Browser', 'always');

      // Multiple operations should succeed
      const operations = [
        { operation: 'navigate', params: { url: 'https://example.com' } },
        { operation: 'click', params: { selector: '#button1' } },
        { operation: 'click', params: { selector: '#button2' } },
        { operation: 'screenshot', params: { fullPage: true } },
      ];

      for (const op of operations) {
        const result = await testContext.browserTool.execute(op);
        expect(result.success).toBe(true);
      }

      assertNoCrashes();
    });

    it('should support granular permission recovery', async () => {
      testContext = scenarios.denyAllOperations();

      // Grant permissions one by one
      const permissionOrder = [
        { permission: 'navigate', operation: 'navigate', params: { url: 'https://example.com' } },
        { permission: 'click', operation: 'click', params: { selector: '#button' } },
        { permission: 'screenshot', operation: 'screenshot', params: { fullPage: true } },
        { permission: 'evaluate', operation: 'evaluate', params: { script: 'document.title' } },
      ];

      for (let i = 0; i < permissionOrder.length; i++) {
        const { permission, operation, params } = permissionOrder[i];

        // Should fail before permission granted
        const deniedResult = await testContext.browserTool.execute({ operation, params });
        assertPermissionDeniedResponse(deniedResult, operation as BrowserOperation);

        // Grant permission
        await testContext.permissionManager.grantPermission('Browser', 'full', permission);

        // Should succeed after permission granted
        const grantedResult = await testContext.browserTool.execute({ operation, params });
        expect(grantedResult.success).toBe(true);

        // Previous permissions should still work
        for (let j = 0; j <= i; j++) {
          const prevOp = permissionOrder[j];
          const retestResult = await testContext.browserTool.execute({
            operation: prevOp.operation,
            params: prevOp.params
          });
          expect(retestResult.success).toBe(true);
        }
      }

      assertNoCrashes();
    });

    it('should handle complex permission hierarchies during recovery', async () => {
      testContext = createPermissionTestContext();

      // Start with broad denial
      await testContext.permissionManager.denyPermission('Browser');

      // Should fail
      const result1 = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      assertPermissionDeniedResponse(result1, 'navigate');

      // Grant specific permission
      await testContext.permissionManager.grantPermission('Browser', 'full', 'navigate:https://example.com');

      // Should succeed for specific URL
      const result2 = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      expect(result2.success).toBe(true);

      // Should fail for different URL
      const result3 = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://other.com' }
      });
      assertPermissionDeniedResponse(result3, 'navigate');

      // Grant broader permission
      await testContext.permissionManager.grantPermission('Browser', 'full', 'navigate');

      // Should succeed for any URL
      const result4 = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://other.com' }
      });
      expect(result4.success).toBe(true);

      assertNoCrashes();
    });
  });
});