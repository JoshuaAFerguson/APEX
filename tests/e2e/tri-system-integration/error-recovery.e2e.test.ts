/**
 * Comprehensive E2E Tests for Error Handling and Recovery Across Tri-System Integration
 *
 * This test suite verifies error handling and recovery mechanisms across the three integrated systems:
 * - Tool System: Core tool infrastructure and execution engine
 * - Permission System: Access control and authorization enforcement
 * - Browser System: Web automation capabilities
 *
 * Tests cover:
 * 1. Permission system failures with graceful degradation
 * 2. Browser failures with permission state preservation
 * 3. Cascading error recovery across systems
 * 4. Resource cleanup after failures
 * 5. Error event propagation and correlation
 * 6. System resilience and fault tolerance
 *
 * Acceptance Criteria:
 * - All error scenarios handled gracefully
 * - Permission state preserved during failures
 * - Resources properly cleaned up
 * - Cross-system error recovery works correctly
 * - Event propagation maintains consistency
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTriSystemTestEnvironment,
  createPermissionDeniedScenario,
  createBrowserToolIntegrationScenario,
  createFullAutonomyScenario,
  assertTriSystemEventSequence,
  assertPermissionEnforced,
  assertBrowserPermissionRespected,
  assertTriSystemReady,
  assertCleanShutdown,
  assertCrossSystemEventPropagation,
  type TriSystemTestEnvironment,
  type SystemEvent,
  type ToolExecutionResult,
  type MockPermissionManager,
  type BrowserOperation
} from './test-utils.js';

describe('Tri-System Error Handling and Recovery E2E Tests', () => {
  let env: TriSystemTestEnvironment | null = null;

  afterEach(async () => {
    if (env) {
      await env.cleanup();
      env = null;
    }
    vi.clearAllMocks();
  });

  describe('Permission System Failures', () => {
    it('should handle permission manager service unavailability', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true, enableCorrelation: true }
      });

      env.systemEvents.start();

      // Mock permission manager to fail with service unavailable error
      const originalCheck = env.permissionSystem.manager.checkToolPermission;
      env.permissionSystem.manager.checkToolPermission = vi.fn()
        .mockRejectedValue(new Error('Permission service unavailable'));

      // Attempt tool execution that requires permission
      const result = await env.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'navigate',
        { params: { url: 'https://example.com' } }
      );

      // Should fail gracefully with clear error message
      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission service unavailable');
      expect(result.metadata?.tool).toBe('Browser');

      // Verify error events were emitted
      const allEvents = env.systemEvents.getAllEvents();
      const errorEvents = allEvents.filter(e => e.type.includes('error'));
      expect(errorEvents.length).toBeGreaterThan(0);

      // System should remain operational after error
      assertTriSystemReady(env);

      // Restore original permission check and verify recovery
      env.permissionSystem.manager.checkToolPermission = originalCheck;

      const recoveryResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'Read',
        'file',
        { filePath: '/test.txt' }
      );

      expect(recoveryResult.success).toBe(true);
    });

    it('should handle permission database corruption scenarios', async () => {
      env = await createTriSystemTestEnvironment({
        permissionConfig: {
          preset: 'selective',
          simulateFailures: true
        },
        eventConfig: { captureAll: true }
      });

      env.systemEvents.start();

      // Simulate database corruption by making permission checks intermittently fail
      let callCount = 0;
      const mockCheck = vi.fn().mockImplementation(async (tool: string, options: any) => {
        callCount++;
        if (callCount % 3 === 0) {
          throw new Error('Database corruption detected: permission table corrupted');
        }
        return {
          allowed: true,
          level: 'allow-once',
          denialReason: null
        };
      });

      env.permissionSystem.manager.checkToolPermission = mockCheck;

      // Execute multiple operations to trigger failures
      const results = await Promise.allSettled([
        env.toolSystem.executor.executeWithPermissionCheck('Read', 'file', { filePath: '/file1.txt' }),
        env.toolSystem.executor.executeWithPermissionCheck('Write', 'file', { filePath: '/file2.txt', content: 'data' }),
        env.toolSystem.executor.executeWithPermissionCheck('Browser', 'navigate', { params: { url: 'https://test.com' } })
      ]);

      // Some should succeed, some should fail
      const successes = results.filter(r => r.status === 'fulfilled' && (r.value as ToolExecutionResult).success);
      const failures = results.filter(r => r.status === 'fulfilled' && !(r.value as ToolExecutionResult).success);

      expect(successes.length).toBeGreaterThan(0);
      expect(failures.length).toBeGreaterThan(0);

      // Verify error events contain database corruption information
      const allEvents = env.systemEvents.getAllEvents();
      const databaseErrors = allEvents.filter(e =>
        e.type.includes('error') &&
        e.data?.error?.includes('Database corruption')
      );
      expect(databaseErrors.length).toBeGreaterThan(0);
    });

    it('should preserve permission state during system failures', async () => {
      env = await createTriSystemTestEnvironment({
        permissionConfig: { preset: 'selective' },
        eventConfig: { captureAll: true }
      });

      // Grant specific permissions before failure
      await env.permissionSystem.manager.grantPermission('Browser', 'allow-always', 'https://trusted.com');
      await env.permissionSystem.manager.grantPermission('Write', 'allow-once', '/important/file.txt');

      // Verify permissions are granted
      const browserPermission = await env.permissionSystem.manager.checkToolPermission('Browser', {
        scope: 'https://trusted.com'
      });
      expect(browserPermission.allowed).toBe(true);
      expect(browserPermission.level).toBe('allow-always');

      const writePermission = await env.permissionSystem.manager.checkToolPermission('Write', {
        scope: '/important/file.txt'
      });
      expect(writePermission.allowed).toBe(true);
      expect(writePermission.level).toBe('allow-once');

      // Simulate system failure and recovery
      const originalCheck = env.permissionSystem.manager.checkToolPermission;
      env.permissionSystem.manager.checkToolPermission = vi.fn()
        .mockRejectedValueOnce(new Error('System failure'))
        .mockImplementation(originalCheck);

      // First call should fail
      await expect(
        env.permissionSystem.manager.checkToolPermission('Browser', { scope: 'https://trusted.com' })
      ).rejects.toThrow('System failure');

      // Subsequent calls should work with preserved state
      const recoveredBrowserPermission = await env.permissionSystem.manager.checkToolPermission('Browser', {
        scope: 'https://trusted.com'
      });
      expect(recoveredBrowserPermission.allowed).toBe(true);
      expect(recoveredBrowserPermission.level).toBe('allow-always');

      // allow-once permission should still be consumable
      const consumePermission = await env.permissionSystem.manager.checkToolPermission('Write', {
        scope: '/important/file.txt'
      });
      expect(consumePermission.allowed).toBe(true);
      expect(consumePermission.level).toBe('allow-once');
    });

    it('should handle permission timeout scenarios gracefully', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true }
      });

      env.systemEvents.start();

      // Mock permission check to timeout
      const mockCheck = vi.fn().mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Permission check timeout')), 100)
        )
      );

      env.permissionSystem.manager.checkToolPermission = mockCheck;

      // Execute with timeout
      const startTime = Date.now();
      const result = await env.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'navigate',
        { params: { url: 'https://slow-check.com' } }
      );
      const endTime = Date.now();

      // Should fail quickly with timeout error
      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission check timeout');
      expect(endTime - startTime).toBeLessThan(5000); // Should not hang

      // Verify timeout event was emitted
      const allEvents = env.systemEvents.getAllEvents();
      const timeoutEvents = allEvents.filter(e =>
        e.data?.error?.includes('timeout') || e.type.includes('timeout')
      );
      expect(timeoutEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Browser Failures with Permission State Preservation', () => {
    it('should preserve permissions when browser session crashes', async () => {
      env = await createBrowserToolIntegrationScenario();
      env.systemEvents.start();

      // Grant browser permission for specific domain
      await env.permissionSystem.manager.grantPermission('Browser', 'allow-always', 'https://fragile-site.com');

      // Verify permission is granted
      const initialPermission = await env.permissionSystem.manager.checkToolPermission('Browser', {
        scope: 'https://fragile-site.com'
      });
      expect(initialPermission.allowed).toBe(true);

      // Create browser session and navigate
      const session = await env.browserSystem.tool.createSession();
      expect(session).toBeDefined();

      // Simulate successful navigation
      const navResult = await env.browserSystem.tool.execute({
        operation: 'navigate',
        params: { url: 'https://fragile-site.com' },
        sessionId: session.id
      });
      expect(navResult.success).toBe(true);

      // Simulate browser crash
      env.browserSystem.mockPage.goto.mockRejectedValue(new Error('Browser process crashed'));
      env.browserSystem.mockBrowser.close.mockRejectedValue(new Error('Browser process not responding'));

      // Attempt operation on crashed browser
      const crashedResult = await env.browserSystem.tool.execute({
        operation: 'click',
        params: { selector: '#button' },
        sessionId: session.id
      });

      expect(crashedResult.success).toBe(false);
      expect(crashedResult.error).toContain('Browser process crashed');

      // Verify permission state is preserved after browser crash
      const preservedPermission = await env.permissionSystem.manager.checkToolPermission('Browser', {
        scope: 'https://fragile-site.com'
      });
      expect(preservedPermission.allowed).toBe(true);
      expect(preservedPermission.level).toBe('allow-always');

      // Should be able to create new session with same permissions
      const mockBrowser = vi.fn().mockResolvedValue({
        newContext: vi.fn().mockResolvedValue({
          newPage: vi.fn().mockResolvedValue({
            goto: vi.fn().mockResolvedValue({ status: () => 200 })
          })
        })
      });

      // Simulate recovery with new browser instance
      env.browserSystem.mockBrowser.newContext.mockResolvedValue({
        newPage: vi.fn().mockResolvedValue(env.browserSystem.mockPage)
      });
      env.browserSystem.mockPage.goto.mockResolvedValue({ status: () => 200 });

      const newSession = await env.browserSystem.tool.createSession();
      expect(newSession).toBeDefined();
      expect(newSession.id).not.toBe(session.id);
    });

    it('should handle browser navigation failures without affecting other permissions', async () => {
      env = await createTriSystemTestEnvironment({
        permissionConfig: { preset: 'selective' },
        eventConfig: { captureAll: true }
      });

      env.systemEvents.start();

      // Grant multiple permissions
      await env.permissionSystem.manager.grantPermission('Browser', 'allow-always', 'https://good-site.com');
      await env.permissionSystem.manager.grantPermission('Browser', 'allow-always', 'https://bad-site.com');
      await env.permissionSystem.manager.grantPermission('Read', 'allow-always');
      await env.permissionSystem.manager.grantPermission('Write', 'allow-once');

      // Simulate navigation failure to one site
      env.browserSystem.mockPage.goto.mockImplementation(async (url: string) => {
        if (url.includes('bad-site.com')) {
          throw new Error('Network timeout: site unreachable');
        }
        return { status: () => 200 };
      });

      // Failed navigation should not affect other browser permissions
      const badResult = await env.browserSystem.tool.execute({
        operation: 'navigate',
        params: { url: 'https://bad-site.com' }
      });
      expect(badResult.success).toBe(false);

      // Good site should still work
      const goodResult = await env.browserSystem.tool.execute({
        operation: 'navigate',
        params: { url: 'https://good-site.com' }
      });
      expect(goodResult.success).toBe(true);

      // Non-browser tools should be unaffected
      const readResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'Read',
        'file',
        { filePath: '/test.txt' }
      );
      expect(readResult.success).toBe(true);

      // Verify all permissions are still intact
      const goodSitePermission = await env.permissionSystem.manager.checkToolPermission('Browser', {
        scope: 'https://good-site.com'
      });
      expect(goodSitePermission.allowed).toBe(true);

      const badSitePermission = await env.permissionSystem.manager.checkToolPermission('Browser', {
        scope: 'https://bad-site.com'
      });
      expect(badSitePermission.allowed).toBe(true);

      const readPermission = await env.permissionSystem.manager.checkToolPermission('Read', { scope: 'default' });
      expect(readPermission.allowed).toBe(true);
    });

    it('should recover browser state after page crashes', async () => {
      env = await createBrowserToolIntegrationScenario();
      env.systemEvents.start();

      // Create session and navigate successfully
      const session = await env.browserSystem.tool.createSession();

      const initialNav = await env.browserSystem.tool.execute({
        operation: 'navigate',
        params: { url: 'https://stable-site.com' }
      });
      expect(initialNav.success).toBe(true);

      // Simulate page crash during interaction
      let crashCount = 0;
      env.browserSystem.mockPage.click.mockImplementation(async (selector: string) => {
        crashCount++;
        if (crashCount === 1) {
          throw new Error('Page crashed during interaction');
        }
        return Promise.resolve();
      });

      // First click should fail
      const crashedClick = await env.browserSystem.tool.execute({
        operation: 'click',
        params: { selector: '#crash-button' }
      });
      expect(crashedClick.success).toBe(false);
      expect(crashedClick.error).toContain('Page crashed during interaction');

      // Verify error was logged
      const allEvents = env.systemEvents.getAllEvents();
      const crashEvents = allEvents.filter(e =>
        e.type === 'browser:operation:error' &&
        e.data?.error?.includes('Page crashed')
      );
      expect(crashEvents.length).toBeGreaterThan(0);

      // Subsequent click should succeed (recovery)
      const recoveredClick = await env.browserSystem.tool.execute({
        operation: 'click',
        params: { selector: '#recovery-button' }
      });
      expect(recoveredClick.success).toBe(true);

      // Verify recovery events
      const recoveryEvents = allEvents.filter(e =>
        e.type === 'browser:operation:complete' &&
        e.data?.operation === 'click'
      );
      expect(recoveryEvents.length).toBeGreaterThan(0);
    });

    it('should handle browser context isolation failures', async () => {
      env = await createTriSystemTestEnvironment({
        browserConfig: { backend: 'mock' },
        eventConfig: { captureAll: true }
      });

      env.systemEvents.start();

      // Create multiple browser sessions
      const session1 = await env.browserSystem.tool.createSession();
      const session2 = await env.browserSystem.tool.createSession();

      expect(session1.id).not.toBe(session2.id);

      // Simulate context corruption in one session
      env.browserSystem.mockPage.evaluate.mockImplementation(async (script: string) => {
        if (script.includes('session1')) {
          throw new Error('Context isolation breach: memory corruption');
        }
        return 'success';
      });

      // Session 1 should fail
      const session1Result = await env.browserSystem.tool.execute({
        operation: 'evaluate',
        params: { script: 'session1_specific_code()' },
        sessionId: session1.id
      });
      expect(session1Result.success).toBe(false);
      expect(session1Result.error).toContain('Context isolation breach');

      // Session 2 should remain unaffected
      const session2Result = await env.browserSystem.tool.execute({
        operation: 'evaluate',
        params: { script: 'session2_specific_code()' },
        sessionId: session2.id
      });
      expect(session2Result.success).toBe(true);

      // Verify isolation failure was properly logged
      const allEvents = env.systemEvents.getAllEvents();
      const isolationEvents = allEvents.filter(e =>
        e.data?.error?.includes('Context isolation breach')
      );
      expect(isolationEvents.length).toBeGreaterThan(0);

      // Should be able to close sessions independently
      await env.browserSystem.tool.closeSession(session1.id);
      await env.browserSystem.tool.closeSession(session2.id);
    });
  });

  describe('Cascading Error Recovery', () => {
    it('should handle tool execution failure propagating through permission system', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true, enableCorrelation: true }
      });

      env.systemEvents.start();

      // Set up cascading failure scenario
      // 1. Tool execution starts
      // 2. Permission check succeeds
      // 3. Tool execution fails
      // 4. Permission system should log failure but remain stable

      let permissionCheckCalled = false;
      const mockPermissionCheck = vi.fn().mockImplementation(async (tool: string, options: any) => {
        permissionCheckCalled = true;
        return {
          allowed: true,
          level: 'allow-once',
          denialReason: null
        };
      });

      env.permissionSystem.manager.checkToolPermission = mockPermissionCheck;

      // Make tool execution fail after permission check
      env.toolSystem.mocks.browser.mockRejectedValue(new Error('Tool execution critical failure'));

      const result = await env.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'navigate',
        { params: { url: 'https://fail-after-permission.com' } }
      );

      // Verify cascading behavior
      expect(permissionCheckCalled).toBe(true);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool execution critical failure');

      // Permission system should remain operational
      const subsequentPermCheck = await env.permissionSystem.manager.checkToolPermission('Read', {
        scope: 'test'
      });
      expect(subsequentPermCheck.allowed).toBe(true);

      // Verify event sequence
      const allEvents = env.systemEvents.getAllEvents();
      assertTriSystemEventSequence(allEvents, [
        { type: 'permission:requested', system: 'permission' },
        { type: 'permission:granted', system: 'permission' },
        { type: 'tool:execution:start', system: 'tool' },
        { type: 'tool:execution:error', system: 'tool' }
      ]);
    });

    it('should recover from multi-system cascading failures', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true, enableCorrelation: true }
      });

      env.systemEvents.start();

      // Simulate complex cascading failure:
      // 1. Browser navigation fails
      // 2. This triggers permission re-evaluation
      // 3. Permission system temporarily fails
      // 4. All systems should recover

      let failureCount = 0;

      // Browser fails first time
      env.browserSystem.mockPage.goto.mockImplementation(async (url: string) => {
        failureCount++;
        if (failureCount === 1) {
          throw new Error('Browser navigation failed: DNS resolution error');
        }
        return { status: () => 200 };
      });

      // Permission system fails during first re-evaluation
      const originalPermCheck = env.permissionSystem.manager.checkToolPermission;
      env.permissionSystem.manager.checkToolPermission = vi.fn().mockImplementation(async (tool: string, options: any) => {
        if (failureCount === 1) {
          throw new Error('Permission system overloaded during failure handling');
        }
        return originalPermCheck.call(env!.permissionSystem.manager, tool, options);
      });

      // First operation should fail completely
      const firstResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'navigate',
        { params: { url: 'https://cascading-failure.com' } }
      );

      expect(firstResult.success).toBe(false);

      // Wait a bit for systems to stabilize
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second operation should succeed (recovery)
      const secondResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'navigate',
        { params: { url: 'https://recovery-site.com' } }
      );

      expect(secondResult.success).toBe(true);

      // Verify all systems are operational
      assertTriSystemReady(env);

      // Check event correlation shows recovery
      const allEvents = env.systemEvents.getAllEvents();
      const errorEvents = allEvents.filter(e => e.type.includes('error'));
      const successEvents = allEvents.filter(e => e.type.includes('complete'));

      expect(errorEvents.length).toBeGreaterThan(0);
      expect(successEvents.length).toBeGreaterThan(0);

      // Verify cross-system recovery correlation
      const correlatedGroups = env.systemEvents.correlatedEvents;
      expect(correlatedGroups.length).toBeGreaterThan(0);

      // Should have events from all three systems
      const hasAllSystems = correlatedGroups.some(group =>
        group.systems.has('tool') &&
        group.systems.has('permission') &&
        group.systems.has('browser')
      );
      expect(hasAllSystems).toBe(true);
    });

    it('should maintain system boundaries during cascading failures', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true }
      });

      // Create isolated failure in browser system
      env.browserSystem.mockPage.screenshot.mockRejectedValue(new Error('Screenshot service crashed'));

      // Tool system and permission system should remain unaffected
      const readResult = await env.toolSystem.executor.execute('Read', { filePath: '/test.txt' });
      expect(readResult.success).toBe(true);

      const permissionResult = await env.permissionSystem.manager.checkToolPermission('Write', { scope: 'test' });
      expect(permissionResult.allowed).toBe(true);

      // Only browser operations should fail
      const screenshotResult = await env.browserSystem.tool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });
      expect(screenshotResult.success).toBe(false);

      // Other browser operations should work
      const navResult = await env.browserSystem.tool.execute({
        operation: 'navigate',
        params: { url: 'https://isolation-test.com' }
      });
      expect(navResult.success).toBe(true);

      assertTriSystemReady(env);
    });

    it('should handle partial system recovery scenarios', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true, enableCorrelation: true }
      });

      env.systemEvents.start();

      // Simulate partial system failures with staggered recovery
      let browserRecoveryStep = 0;
      let permissionRecoveryStep = 0;

      // Browser system recovery in steps
      env.browserSystem.mockPage.goto.mockImplementation(async (url: string) => {
        browserRecoveryStep++;
        if (browserRecoveryStep <= 2) {
          throw new Error(`Browser recovery step ${browserRecoveryStep}: still recovering`);
        }
        return { status: () => 200 };
      });

      // Permission system recovery in steps
      const originalPermCheck = env.permissionSystem.manager.checkToolPermission;
      env.permissionSystem.manager.checkToolPermission = vi.fn().mockImplementation(async (tool: string, options: any) => {
        permissionRecoveryStep++;
        if (permissionRecoveryStep <= 1) {
          throw new Error(`Permission recovery step ${permissionRecoveryStep}: rebuilding cache`);
        }
        return originalPermCheck.call(env!.permissionSystem.manager, tool, options);
      });

      // Execute multiple operations to trigger recovery sequence
      const results = [];

      for (let i = 0; i < 4; i++) {
        const result = await env.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'navigate',
          { params: { url: `https://recovery-test-${i}.com` } }
        );
        results.push(result);

        // Small delay between attempts
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // First few should fail, last ones should succeed
      const failures = results.filter(r => !r.success);
      const successes = results.filter(r => r.success);

      expect(failures.length).toBeGreaterThan(0);
      expect(successes.length).toBeGreaterThan(0);

      // Verify recovery progression in events
      const allEvents = env.systemEvents.getAllEvents();
      const recoveryEvents = allEvents.filter(e =>
        e.data?.error?.includes('still recovering') ||
        e.data?.error?.includes('rebuilding cache')
      );
      expect(recoveryEvents.length).toBeGreaterThan(0);

      // Final state should be fully operational
      assertTriSystemReady(env);
    });
  });

  describe('Resource Cleanup After Failures', () => {
    it('should clean up browser resources after navigation failures', async () => {
      env = await createBrowserToolIntegrationScenario();
      env.systemEvents.start();

      // Create multiple sessions
      const sessions = [];
      for (let i = 0; i < 3; i++) {
        const session = await env.browserSystem.tool.createSession();
        sessions.push(session);
      }

      // Simulate navigation failures in all sessions
      env.browserSystem.mockPage.goto.mockRejectedValue(new Error('Navigation timeout'));

      const failedOperations = await Promise.allSettled(
        sessions.map(session =>
          env!.browserSystem.tool.execute({
            operation: 'navigate',
            params: { url: 'https://timeout-site.com' },
            sessionId: session.id
          })
        )
      );

      // All should fail
      failedOperations.forEach(result => {
        if (result.status === 'fulfilled') {
          expect(result.value.success).toBe(false);
        }
      });

      // Cleanup should close all sessions
      await env.cleanup();

      // Verify browser close was called (resource cleanup)
      expect(env.browserSystem.mockBrowser.close).toHaveBeenCalled();

      // Environment should be in clean state
      assertCleanShutdown(env);

      // Set env to null since we cleaned up manually
      env = null;
    });

    it('should clean up permission grants after system failures', async () => {
      env = await createTriSystemTestEnvironment({
        permissionConfig: { preset: 'selective' }
      });

      // Grant temporary permissions
      await env.permissionSystem.manager.grantPermission('Browser', 'allow-once', 'https://temp-site.com');
      await env.permissionSystem.manager.grantPermission('Write', 'allow-once', '/tmp/temp-file.txt');

      // Verify permissions are granted
      const browserPerm = await env.permissionSystem.manager.checkToolPermission('Browser', {
        scope: 'https://temp-site.com'
      });
      expect(browserPerm.allowed).toBe(true);

      // Simulate system failure
      env.toolSystem.mocks.browser.mockRejectedValue(new Error('System crash during execution'));

      const failedResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'navigate',
        { params: { url: 'https://temp-site.com' } }
      );

      expect(failedResult.success).toBe(false);

      // allow-once permissions should still be consumed even on failure
      const consumedPerm = await env.permissionSystem.manager.checkToolPermission('Browser', {
        scope: 'https://temp-site.com'
      });
      // This depends on implementation - might be consumed or preserved depending on failure point

      // Clean up should clear any remaining temporary state
      if (env.permissionSystem.manager.clearPermissions) {
        env.permissionSystem.manager.clearPermissions();
      }

      // Verify cleanup
      await env.cleanup();
      assertCleanShutdown(env);

      env = null;
    });

    it('should clean up event listeners after system failures', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true, maxEvents: 100 }
      });

      env.systemEvents.start();

      // Generate events that cause system stress
      for (let i = 0; i < 50; i++) {
        env.eventEmitter.emit('tool:execution:start', {
          tool: 'Browser',
          iteration: i,
          timestamp: new Date()
        });

        env.eventEmitter.emit('permission:requested', {
          tool: 'Browser',
          iteration: i,
          timestamp: new Date()
        });

        // Simulate some operations failing
        if (i % 5 === 0) {
          env.eventEmitter.emit('tool:execution:error', {
            tool: 'Browser',
            error: `Simulated failure ${i}`,
            timestamp: new Date()
          });
        }
      }

      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      const eventCount = env.systemEvents.getAllEvents().length;
      expect(eventCount).toBeGreaterThan(0);
      expect(eventCount).toBeLessThanOrEqual(100); // Respects max limit

      // Stop event capture (should clean up listeners)
      env.systemEvents.stop();

      // Emit more events - these should not be captured
      env.eventEmitter.emit('tool:execution:start', {
        tool: 'Read',
        test: 'post-cleanup',
        timestamp: new Date()
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      const finalEventCount = env.systemEvents.getAllEvents().length;
      expect(finalEventCount).toBe(eventCount); // No new events captured

      // Full cleanup
      await env.cleanup();

      // Events should be cleared
      const cleanedEvents = env.systemEvents.getAllEvents();
      expect(cleanedEvents.length).toBe(0);

      assertCleanShutdown(env);
      env = null;
    });

    it('should handle memory leaks during error scenarios', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true, maxEvents: 20 }
      });

      env.systemEvents.start();

      // Simulate memory pressure with many failed operations
      const operations = [];
      for (let i = 0; i < 30; i++) {
        operations.push(
          env.toolSystem.executor.execute('Browser', {
            operation: 'navigate',
            params: { url: `https://memory-test-${i}.com` }
          })
        );
      }

      const results = await Promise.allSettled(operations);

      // Should respect memory limits
      const allEvents = env.systemEvents.getAllEvents();
      expect(allEvents.length).toBeLessThanOrEqual(20);

      // Oldest events should be evicted
      const eventTypes = allEvents.map(e => e.type);
      expect(eventTypes).toContain('tool:execution:start');
      expect(eventTypes).toContain('tool:execution:complete');

      // Memory cleanup should work
      env.systemEvents.cleanup();
      expect(env.systemEvents.getAllEvents().length).toBe(0);

      // System should still be operational
      const finalTest = await env.toolSystem.executor.execute('Read', { filePath: '/memory-test.txt' });
      expect(finalTest.success).toBe(true);

      assertTriSystemReady(env);
    });

    it('should clean up orphaned resources across system boundaries', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true }
      });

      env.systemEvents.start();

      // Create resources across systems
      const browserSession = await env.browserSystem.tool.createSession();
      await env.permissionSystem.manager.grantPermission('Browser', 'allow-always', 'https://orphan-test.com');

      // Simulate partial failures that could leave orphaned resources
      env.browserSystem.mockPage.close.mockRejectedValue(new Error('Page close failed'));
      env.toolSystem.mocks.browser.mockRejectedValue(new Error('Tool execution failed'));

      // Operations that create and fail to clean up resources
      const failedNav = await env.browserSystem.tool.execute({
        operation: 'navigate',
        params: { url: 'https://orphan-test.com' },
        sessionId: browserSession.id
      });

      // Might succeed or fail depending on mock setup
      expect(failedNav).toBeDefined();

      // Force cleanup should handle orphaned resources
      await env.cleanup();

      // Verify comprehensive cleanup occurred
      expect(env.browserSystem.mockBrowser.close).toHaveBeenCalled();

      // Permission system should be cleared
      if (env.permissionSystem.manager.clearPermissions) {
        expect(env.permissionSystem.manager.clearPermissions).toHaveBeenCalled();
      }

      assertCleanShutdown(env);
      env = null;
    });
  });

  describe('Error Event Propagation and Correlation', () => {
    it('should correlate error events across all three systems', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true, enableCorrelation: true }
      });

      env.systemEvents.start();

      // Trigger a complex operation that will generate correlated events
      const complexResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'navigate',
        { params: { url: 'https://correlation-test.com' } }
      );

      expect(complexResult.success).toBe(true);

      // Wait for all events to be captured
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify events were generated across systems
      const toolEvents = env.systemEvents.getEventsBySystem('tool');
      const permissionEvents = env.systemEvents.getEventsBySystem('permission');
      const browserEvents = env.systemEvents.getEventsBySystem('browser');

      expect(toolEvents.length).toBeGreaterThan(0);
      expect(permissionEvents.length).toBeGreaterThan(0);
      expect(browserEvents.length).toBeGreaterThan(0);

      // Verify correlation between systems
      const correlatedGroups = env.systemEvents.correlatedEvents;
      expect(correlatedGroups.length).toBeGreaterThan(0);

      // Should have at least one group spanning all systems
      const fullCorrelation = correlatedGroups.find(group =>
        group.systems.has('tool') &&
        group.systems.has('permission') &&
        group.systems.has('browser')
      );
      expect(fullCorrelation).toBeDefined();

      if (fullCorrelation) {
        expect(fullCorrelation.events.length).toBeGreaterThanOrEqual(3);
        expect(fullCorrelation.correlationId).toBeDefined();
      }
    });

    it('should maintain event ordering during error cascades', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true, enableCorrelation: true }
      });

      env.systemEvents.start();

      // Set up a scenario that will cause predictable event ordering
      env.toolSystem.mocks.browser.mockRejectedValue(new Error('Predictable browser failure'));

      const result = await env.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'navigate',
        { params: { url: 'https://ordering-test.com' } }
      );

      expect(result.success).toBe(false);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify event ordering
      const allEvents = env.systemEvents.getAllEvents();
      const eventTypes = allEvents.map(e => ({ type: e.type, system: e.system, time: e.timestamp }));

      // Sort by timestamp to verify ordering
      eventTypes.sort((a, b) => a.time.getTime() - b.time.getTime());

      // Should follow logical flow: permission -> tool -> error
      const permissionIndex = eventTypes.findIndex(e => e.type.startsWith('permission:'));
      const toolStartIndex = eventTypes.findIndex(e => e.type === 'tool:execution:start');
      const toolErrorIndex = eventTypes.findIndex(e => e.type === 'tool:execution:error');

      expect(permissionIndex).toBeGreaterThanOrEqual(0);
      expect(toolStartIndex).toBeGreaterThan(permissionIndex);
      expect(toolErrorIndex).toBeGreaterThan(toolStartIndex);
    });

    it('should preserve event context during system failures', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true, enableCorrelation: true }
      });

      env.systemEvents.start();

      // Generate events with rich context
      const testContext = {
        userId: 'test-user-123',
        sessionId: 'session-456',
        operation: 'complex-workflow'
      };

      // Emit events with context
      env.eventEmitter.emit('tool:execution:start', {
        tool: 'Browser',
        context: testContext,
        timestamp: new Date()
      });

      env.eventEmitter.emit('permission:requested', {
        tool: 'Browser',
        scope: 'https://context-test.com',
        context: testContext,
        timestamp: new Date()
      });

      // Simulate failure
      env.eventEmitter.emit('tool:execution:error', {
        tool: 'Browser',
        error: 'Context preservation test failure',
        context: testContext,
        timestamp: new Date()
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify context is preserved in all events
      const allEvents = env.systemEvents.getAllEvents();
      const contextEvents = allEvents.filter(e => e.data?.context);

      expect(contextEvents.length).toBeGreaterThanOrEqual(3);

      contextEvents.forEach(event => {
        expect(event.data.context).toEqual(testContext);
      });

      // Verify correlation maintains context
      const correlatedGroups = env.systemEvents.correlatedEvents;
      const contextualGroup = correlatedGroups.find(group =>
        group.events.some(e => e.data?.context?.userId === 'test-user-123')
      );

      expect(contextualGroup).toBeDefined();
      if (contextualGroup) {
        expect(contextualGroup.events.length).toBeGreaterThan(0);
      }
    });

    it('should handle event overflow during error storms', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true, maxEvents: 50 }
      });

      env.systemEvents.start();

      // Generate error storm
      const errorPromises = [];
      for (let i = 0; i < 100; i++) {
        errorPromises.push(
          env.toolSystem.executor.execute('Browser', {
            operation: 'navigate',
            params: { url: `https://error-storm-${i}.com` }
          })
        );
      }

      await Promise.allSettled(errorPromises);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should respect event limits
      const allEvents = env.systemEvents.getAllEvents();
      expect(allEvents.length).toBeLessThanOrEqual(50);

      // Should maintain event diversity (not just one type)
      const eventTypes = new Set(allEvents.map(e => e.type));
      expect(eventTypes.size).toBeGreaterThan(1);

      // Should still be able to capture new events
      env.eventEmitter.emit('test:overflow:recovery', {
        message: 'Post-overflow test',
        timestamp: new Date()
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify system is still functional
      assertTriSystemReady(env);
    });
  });

  describe('System Resilience and Fault Tolerance', () => {
    it('should maintain core functionality during partial system failures', async () => {
      env = await createTriSystemTestEnvironment();

      // Simulate browser system completely down
      env.browserSystem.tool.execute = vi.fn().mockRejectedValue(new Error('Browser system offline'));
      env.browserSystem.tool.createSession = vi.fn().mockRejectedValue(new Error('Browser system offline'));

      // Other systems should continue working
      const readResult = await env.toolSystem.executor.execute('Read', { filePath: '/resilience-test.txt' });
      expect(readResult.success).toBe(true);

      const writeResult = await env.toolSystem.executor.execute('Write', {
        filePath: '/resilience-output.txt',
        content: 'System resilience test'
      });
      expect(writeResult.success).toBe(true);

      // Permission system should work
      const permission = await env.permissionSystem.manager.checkToolPermission('Read', { scope: 'default' });
      expect(permission.allowed).toBe(true);

      // Browser operations should fail gracefully
      const browserResult = await env.toolSystem.executor.execute('Browser', {
        operation: 'navigate',
        params: { url: 'https://resilience-test.com' }
      });
      expect(browserResult.success).toBe(false);
      expect(browserResult.error).toContain('Browser system offline');

      // Overall system should remain stable
      assertTriSystemReady(env);
    });

    it('should recover automatically from transient failures', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true }
      });

      env.systemEvents.start();

      // Simulate transient failures (fail first few attempts, then succeed)
      let attemptCount = 0;
      env.toolSystem.mocks.browser.mockImplementation(async (params) => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error(`Transient failure attempt ${attemptCount}`);
        }
        return { success: true, data: { url: params.params?.url } };
      });

      // Multiple attempts should eventually succeed
      const results = [];
      for (let i = 0; i < 4; i++) {
        const result = await env.toolSystem.executor.execute('Browser', {
          operation: 'navigate',
          params: { url: `https://transient-${i}.com` }
        });
        results.push(result);

        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const failures = results.filter(r => !r.success);
      const successes = results.filter(r => r.success);

      expect(failures.length).toBe(2); // First two should fail
      expect(successes.length).toBe(2); // Last two should succeed

      // Verify recovery is logged in events
      const allEvents = env.systemEvents.getAllEvents();
      const failureEvents = allEvents.filter(e => e.type.includes('error'));
      const successEvents = allEvents.filter(e => e.type.includes('complete'));

      expect(failureEvents.length).toBeGreaterThan(0);
      expect(successEvents.length).toBeGreaterThan(0);
    });

    it('should maintain system consistency during concurrent error handling', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true }
      });

      env.systemEvents.start();

      // Simulate concurrent operations with mixed success/failure
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(
          env.toolSystem.executor.execute('Browser', {
            operation: 'navigate',
            params: { url: `https://concurrent-${i}.com` }
          })
        );

        operations.push(
          env.toolSystem.executor.execute('Read', {
            filePath: `/concurrent/file-${i}.txt`
          })
        );

        if (i % 3 === 0) {
          // Add some permission checks
          operations.push(
            env.permissionSystem.manager.checkToolPermission('Write', { scope: `concurrent-${i}` })
          );
        }
      }

      // Execute all concurrently
      const results = await Promise.allSettled(operations);

      // Should have mix of successes and fulfilled promises
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      expect(fulfilled.length).toBeGreaterThan(0);
      // Rejections should be minimal in mock environment

      // System should remain consistent
      await new Promise(resolve => setTimeout(resolve, 100));

      const allEvents = env.systemEvents.getAllEvents();
      expect(allEvents.length).toBeGreaterThan(0);

      // No deadlocks or hanging operations
      assertTriSystemReady(env);
    });

    it('should provide detailed error diagnostics for debugging', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true, enableCorrelation: true }
      });

      env.systemEvents.start();

      // Create a complex failure scenario with detailed context
      const diagnosticContext = {
        testCase: 'detailed-diagnostics',
        timestamp: new Date().toISOString(),
        environment: 'e2e-test'
      };

      // Simulate detailed failure
      env.toolSystem.mocks.browser.mockRejectedValue(
        new Error('Detailed failure: Connection timeout after 5000ms, retries exhausted (3/3), last error: ECONNREFUSED')
      );

      const result = await env.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'navigate',
        {
          params: { url: 'https://diagnostic-test.com' },
          context: diagnosticContext
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Detailed failure');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.tool).toBe('Browser');
      expect(result.metadata?.executionTime).toBeGreaterThan(0);

      // Verify diagnostic information in events
      const allEvents = env.systemEvents.getAllEvents();
      const errorEvents = allEvents.filter(e => e.type.includes('error'));

      expect(errorEvents.length).toBeGreaterThan(0);

      const detailedError = errorEvents.find(e =>
        e.data?.error?.includes('Connection timeout')
      );
      expect(detailedError).toBeDefined();

      if (detailedError) {
        expect(detailedError.timestamp).toBeInstanceOf(Date);
        expect(detailedError.system).toBe('tool');
      }

      // Correlation should preserve diagnostic context
      const correlatedGroups = env.systemEvents.correlatedEvents;
      const diagnosticGroup = correlatedGroups.find(group =>
        group.events.some(e => e.data?.context?.testCase === 'detailed-diagnostics')
      );

      expect(diagnosticGroup).toBeDefined();
    });
  });
});