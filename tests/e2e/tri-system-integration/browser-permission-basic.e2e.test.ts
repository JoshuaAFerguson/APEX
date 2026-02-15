/**
 * E2E tests for basic browser-permission integration scenarios
 *
 * This test suite covers the core integration scenarios between the browser tool
 * and the permission system, ensuring proper access control and permission enforcement.
 *
 * Test scenarios covered:
 * 1. Permission gate blocking - Verify browser operations are blocked when permissions are denied
 * 2. Allow-always persistence - Verify that allow-always permissions persist across operations
 * 3. Allow-once consumption - Verify that allow-once permissions are consumed after single use
 * 4. Domain blocklist enforcement - Verify that blocklisted domains are properly denied
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTriSystemTestEnvironment,
  createPermissionDeniedScenario,
  assertPermissionEnforced,
  assertTriSystemEventSequence,
  assertBrowserPermissionRespected,
  assertTriSystemReady,
  type TriSystemTestEnvironment,
  type SystemEvent
} from './test-utils';

describe('Browser Permission Basic E2E Integration', () => {
  let testEnv: TriSystemTestEnvironment;

  beforeEach(async () => {
    // Create a clean test environment for each test
    testEnv = await createTriSystemTestEnvironment({
      toolConfig: {
        enabledTools: ['Browser', 'Read', 'Write']
      },
      permissionConfig: {
        preset: 'selective',
        defaultLevel: 'deny'
      },
      browserConfig: {
        backend: 'mock',
        headless: true
      },
      eventConfig: {
        captureAll: true,
        enableCorrelation: true
      }
    });

    // Verify the test environment is properly initialized
    assertTriSystemReady(testEnv);
  });

  afterEach(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  describe('Permission Gate Blocking', () => {
    it('should block browser navigation when permissions are denied', async () => {
      // Setup: Create a permission-denied scenario
      const deniedEnv = await createPermissionDeniedScenario({
        deniedTools: ['Browser'],
        blockedDomains: []
      });

      try {
        // Execute: Attempt to navigate to a website
        const result = await deniedEnv.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'navigate',
          {
            operation: 'navigate',
            params: { url: 'https://example.com' }
          }
        );

        // Assert: Operation should be blocked due to permission denial
        assertPermissionEnforced(result, 'denied');
        assertBrowserPermissionRespected(result, 'navigate');

        // Verify expected event sequence
        const events = deniedEnv.systemEvents.getAllEvents();
        assertTriSystemEventSequence(events, [
          { type: 'permission:requested', system: 'permission' },
          { type: 'permission:denied', system: 'permission' },
          { type: 'tool:execution:error', system: 'tool' }
        ]);

        expect(result.success).toBe(false);
        expect(result.permissionDenied).toBe(true);
        expect(result.error).toContain('denied');
      } finally {
        await deniedEnv.cleanup();
      }
    });

    it('should block browser click operations when permissions are denied', async () => {
      // Setup: Create environment with browser tool denied
      const deniedEnv = await createPermissionDeniedScenario({
        deniedTools: ['Browser']
      });

      try {
        // Execute: Attempt to click an element
        const result = await deniedEnv.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'click',
          {
            operation: 'click',
            params: { selector: '#button' }
          }
        );

        // Assert: Click operation should be blocked
        assertPermissionEnforced(result, 'denied');
        assertBrowserPermissionRespected(result, 'click');

        expect(result.success).toBe(false);
        expect(result.permissionDenied).toBe(true);
      } finally {
        await deniedEnv.cleanup();
      }
    });

    it('should block browser screenshot when permissions are denied', async () => {
      // Setup: Create environment with browser operations denied
      const deniedEnv = await createPermissionDeniedScenario({
        deniedOperations: ['screenshot']
      });

      try {
        // Execute: Attempt to take a screenshot
        const result = await deniedEnv.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'screenshot',
          {
            operation: 'screenshot',
            params: { fullPage: true }
          }
        );

        // Assert: Screenshot operation should be blocked
        assertPermissionEnforced(result, 'denied');
        assertBrowserPermissionRespected(result, 'screenshot');

        expect(result.success).toBe(false);
        expect(result.permissionDenied).toBe(true);
      } finally {
        await deniedEnv.cleanup();
      }
    });
  });

  describe('Allow-Always Persistence', () => {
    it('should allow browser operations consistently with allow-always permission', async () => {
      // Setup: Grant allow-always permission for browser tool
      await testEnv.permissionSystem.store.grantPermission('Browser', 'allow-always');

      // Execute: Perform multiple browser operations
      const navigationResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'navigate',
        {
          operation: 'navigate',
          params: { url: 'https://example.com' }
        }
      );

      const clickResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'click',
        {
          operation: 'click',
          params: { selector: '#button' }
        }
      );

      const screenshotResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'screenshot',
        {
          operation: 'screenshot',
          params: { fullPage: false }
        }
      );

      // Assert: All operations should succeed
      assertPermissionEnforced(navigationResult, 'granted');
      assertPermissionEnforced(clickResult, 'granted');
      assertPermissionEnforced(screenshotResult, 'granted');

      assertBrowserPermissionRespected(navigationResult, 'navigate');
      assertBrowserPermissionRespected(clickResult, 'click');
      assertBrowserPermissionRespected(screenshotResult, 'screenshot');

      // Verify persistent permission behavior
      expect(navigationResult.success).toBe(true);
      expect(clickResult.success).toBe(true);
      expect(screenshotResult.success).toBe(true);

      // Verify all operations were granted by the same persistent permission
      const events = testEnv.systemEvents.getAllEvents();
      const grantedEvents = events.filter(e => e.type === 'permission:granted');
      expect(grantedEvents.length).toBeGreaterThanOrEqual(3);
    });

    it('should persist allow-always permission across different browser operations', async () => {
      // Setup: Grant allow-always permission
      await testEnv.permissionSystem.store.grantPermission('Browser', 'allow-always', 'https://example.com');

      // Execute: Multiple operations to the same domain
      const operations = ['navigate', 'click', 'type', 'screenshot', 'evaluate'];
      const results = [];

      for (const operation of operations) {
        const params = {
          operation: operation as any,
          params: operation === 'navigate'
            ? { url: 'https://example.com' }
            : operation === 'click'
            ? { selector: '#element' }
            : operation === 'type'
            ? { selector: '#input', text: 'test' }
            : operation === 'screenshot'
            ? { fullPage: false }
            : { script: 'return document.title;' }
        };

        const result = await testEnv.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          operation,
          params
        );

        results.push(result);
      }

      // Assert: All operations should succeed due to persistent permission
      results.forEach((result, index) => {
        assertPermissionEnforced(result, 'granted');
        expect(result.success).toBe(true);
        expect(result.metadata?.tool).toBe('Browser');
        expect(result.metadata?.operation).toBe(operations[index]);
      });
    });
  });

  describe('Allow-Once Consumption', () => {
    it('should consume allow-once permission after single browser operation', async () => {
      // Setup: Grant allow-once permission for browser navigation
      await testEnv.permissionSystem.store.grantPermission('Browser', 'allow-once', 'navigate');

      // Execute: First operation should succeed
      const firstResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'navigate',
        {
          operation: 'navigate',
          params: { url: 'https://example.com' }
        }
      );

      // Execute: Second operation should be denied (permission consumed)
      const secondResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'navigate',
        {
          operation: 'navigate',
          params: { url: 'https://test.com' }
        }
      );

      // Assert: First operation succeeds, second fails
      assertPermissionEnforced(firstResult, 'granted');
      assertPermissionEnforced(secondResult, 'denied');

      expect(firstResult.success).toBe(true);
      expect(secondResult.success).toBe(false);
      expect(secondResult.permissionDenied).toBe(true);

      // Verify permission consumption in event sequence
      const events = testEnv.systemEvents.getAllEvents();
      const permissionEvents = events.filter(e => e.type.startsWith('permission:'));

      // Should have: granted (first), denied (second)
      expect(permissionEvents.some(e => e.type === 'permission:granted')).toBe(true);
      expect(permissionEvents.some(e => e.type === 'permission:denied')).toBe(true);
    });

    it('should allow different operations with separate allow-once permissions', async () => {
      // Setup: Grant separate allow-once permissions for different operations
      await testEnv.permissionSystem.store.grantPermission('Browser', 'allow-once', 'navigate');
      await testEnv.permissionSystem.store.grantPermission('Browser', 'allow-once', 'click');

      // Execute: Different operations should each work once
      const navigateResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'navigate',
        {
          operation: 'navigate',
          params: { url: 'https://example.com' }
        }
      );

      const clickResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'click',
        {
          operation: 'click',
          params: { selector: '#button' }
        }
      );

      // Execute: Repeat operations should be denied
      const secondNavigateResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'navigate',
        {
          operation: 'navigate',
          params: { url: 'https://test.com' }
        }
      );

      const secondClickResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'click',
        {
          operation: 'click',
          params: { selector: '#other-button' }
        }
      );

      // Assert: First of each operation succeeds, repeats fail
      assertPermissionEnforced(navigateResult, 'granted');
      assertPermissionEnforced(clickResult, 'granted');
      assertPermissionEnforced(secondNavigateResult, 'denied');
      assertPermissionEnforced(secondClickResult, 'denied');

      expect(navigateResult.success).toBe(true);
      expect(clickResult.success).toBe(true);
      expect(secondNavigateResult.success).toBe(false);
      expect(secondClickResult.success).toBe(false);
    });
  });

  describe('Domain Blocklist Enforcement', () => {
    it('should block navigation to blocklisted domains', async () => {
      // Setup: Create environment with blocked domains
      const blockedEnv = await createTriSystemTestEnvironment({
        permissionConfig: {
          preset: 'selective',
          defaultLevel: 'allow-always',
          blockedDomains: ['malicious.com', 'blocked.net']
        },
        browserConfig: {
          backend: 'mock',
          headless: true
        },
        eventConfig: {
          captureAll: true
        }
      });

      try {
        // Execute: Attempt to navigate to blocked domain
        const blockedResult = await blockedEnv.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'navigate',
          {
            operation: 'navigate',
            params: { url: 'https://malicious.com/evil-page' }
          }
        );

        // Execute: Attempt to navigate to allowed domain
        const allowedResult = await blockedEnv.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'navigate',
          {
            operation: 'navigate',
            params: { url: 'https://example.com/safe-page' }
          }
        );

        // Assert: Blocked domain denied, allowed domain succeeds
        assertPermissionEnforced(blockedResult, 'denied');
        assertPermissionEnforced(allowedResult, 'granted');

        expect(blockedResult.success).toBe(false);
        expect(blockedResult.permissionDenied).toBe(true);
        expect(allowedResult.success).toBe(true);

        // Verify domain-specific denial reason
        expect(blockedResult.error).toContain('blocked');
      } finally {
        await blockedEnv.cleanup();
      }
    });

    it('should enforce domain blocklist for all browser operations', async () => {
      // Setup: Environment with comprehensive domain blocking
      const blockedEnv = await createTriSystemTestEnvironment({
        permissionConfig: {
          preset: 'allowAll',
          blockedDomains: ['dangerous.com']
        },
        browserConfig: {
          backend: 'mock'
        }
      });

      try {
        // Execute: Multiple operations on blocked domain
        const operations = [
          { operation: 'navigate', params: { url: 'https://dangerous.com/' } },
          { operation: 'click', params: { selector: '#button', url: 'https://dangerous.com/' } },
          { operation: 'screenshot', params: { url: 'https://dangerous.com/' } }
        ];

        for (const { operation, params } of operations) {
          const result = await blockedEnv.toolSystem.executor.executeWithPermissionCheck(
            'Browser',
            operation,
            { operation: operation as any, params }
          );

          // Assert: All operations on blocked domain should be denied
          assertPermissionEnforced(result, 'denied');
          assertBrowserPermissionRespected(result, operation as any);

          expect(result.success).toBe(false);
          expect(result.permissionDenied).toBe(true);
        }
      } finally {
        await blockedEnv.cleanup();
      }
    });

    it('should allow subdomain access when parent domain is not blocked', async () => {
      // Setup: Environment allowing specific subdomains
      const allowedEnv = await createTriSystemTestEnvironment({
        permissionConfig: {
          preset: 'selective',
          defaultLevel: 'allow-always',
          blockedDomains: ['specific.badsite.com'], // Only block specific subdomain
          deniedOperations: []
        },
        browserConfig: {
          backend: 'mock'
        }
      });

      try {
        // Execute: Navigate to allowed subdomain
        const allowedSubdomain = await allowedEnv.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'navigate',
          {
            operation: 'navigate',
            params: { url: 'https://safe.badsite.com/' }
          }
        );

        // Execute: Navigate to blocked subdomain
        const blockedSubdomain = await allowedEnv.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'navigate',
          {
            operation: 'navigate',
            params: { url: 'https://specific.badsite.com/' }
          }
        );

        // Assert: Allowed subdomain succeeds, blocked subdomain fails
        assertPermissionEnforced(allowedSubdomain, 'granted');
        assertPermissionEnforced(blockedSubdomain, 'denied');

        expect(allowedSubdomain.success).toBe(true);
        expect(blockedSubdomain.success).toBe(false);
      } finally {
        await allowedEnv.cleanup();
      }
    });
  });
});