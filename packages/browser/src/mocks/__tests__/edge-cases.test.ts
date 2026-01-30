/**
 * @apexcli/browser/mocks - Edge Cases and Error Scenario Tests
 *
 * Tests for edge cases, boundary conditions, and error scenarios
 * to ensure robust behavior under unusual conditions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MockBrowserSession,
  MockBrowserManager,
  createMockBrowserSession,
  createMockBrowserManager,
  createMockScenario,
  launchMockBrowser,
  createUnreliableMockSession,
  commonScenarios,
} from '../index.js';
import type { MockScenarioConfig } from '../types.js';

describe('Edge Cases and Error Scenarios', () => {
  describe('Invalid Input Handling', () => {
    let session: MockBrowserSession;

    beforeEach(async () => {
      session = createMockBrowserSession();
      await session.launch();
    });

    it('should handle null and undefined inputs gracefully', async () => {
      const results = await Promise.allSettled([
        session.navigate(null as any),
        session.navigate(undefined as any),
        session.clickElement(null as any),
        session.clickElement(undefined as any),
        session.typeInElement(null as any, 'text'),
        session.typeInElement('#input', null as any),
        session.elementExists(null as any),
        session.getElementText(null as any),
      ]);

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          expect(result.value).toHaveProperty('success');
          expect(result.value).toHaveProperty('duration');
        } else {
          // If rejected, should be a meaningful error
          expect(result.reason).toBeInstanceOf(Error);
        }
      });
    });

    it('should handle non-string inputs for string parameters', async () => {
      await session.navigate('https://example.com');

      const invalidInputs = [
        123,
        {},
        [],
        true,
        Symbol('test'),
        new Date(),
      ];

      for (const input of invalidInputs) {
        try {
          const result = await session.typeInElement('#input', input as any);
          expect(result).toHaveProperty('success');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should handle circular references in configurations', () => {
      const circularConfig: any = {
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 100,
          useRealisticDelays: false,
        },
      };
      circularConfig.self = circularConfig;

      expect(() => {
        const session = createMockBrowserSession(circularConfig);
        expect(session).toBeDefined();
      }).not.toThrow();
    });

    it('should handle extremely large input strings', async () => {
      await session.navigate('https://example.com');

      const largeText = 'x'.repeat(1000000); // 1MB of text
      const result = await session.typeInElement('#input', largeText);

      expect(result).toHaveProperty('success');
      if (result.success) {
        const pageState = session.getPageState();
        const element = pageState.elements.get('#input');
        expect(element?.value).toBe(largeText);
      }
    });

    it('should handle special characters in selectors', async () => {
      await session.navigate('https://example.com');

      const specialSelectors = [
        '#test\\:colon',
        '#test\\.dot',
        '[data-test="value with spaces"]',
        '#unicode-测试-элемент-🎯',
        '#with\\nnewline',
        '#with\\ttab',
        '#with"quotes',
        "#with'apostrophes",
      ];

      for (const selector of specialSelectors) {
        const result = await session.elementExists(selector);
        expect(result).toHaveProperty('success');
        expect(typeof result.success).toBe('boolean');
      }
    });
  });

  describe('Boundary Condition Testing', () => {
    it('should handle zero and negative delays', async () => {
      const zeroDelaySession = createMockBrowserSession({
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 0,
          useRealisticDelays: false,
        },
      });

      const negativeDelaySession = createMockBrowserSession({
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: -100,
          useRealisticDelays: false,
        },
      });

      await zeroDelaySession.launch();
      await negativeDelaySession.launch();

      const results = await Promise.all([
        zeroDelaySession.navigate('https://example.com'),
        negativeDelaySession.navigate('https://example.com'),
      ]);

      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle maximum safe integer values', async () => {
      const extremeSession = createMockBrowserSession({
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: Number.MAX_SAFE_INTEGER,
          useRealisticDelays: false,
        },
        timeout: Number.MAX_SAFE_INTEGER,
      });

      await extremeSession.launch();

      // Should handle extreme values gracefully
      expect(extremeSession.getConfig().mockConfig.defaultDelay).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle empty viewport dimensions', () => {
      const zeroViewportSession = createMockBrowserSession({
        viewport: { width: 0, height: 0 },
      });

      expect(zeroViewportSession.getConfig().viewport).toEqual({ width: 0, height: 0 });

      const negativeViewportSession = createMockBrowserSession({
        viewport: { width: -100, height: -100 },
      });

      expect(negativeViewportSession.getConfig().viewport).toEqual({ width: -100, height: -100 });
    });

    it('should handle maximum browser instances', async () => {
      const manager = createMockBrowserManager({ maxInstances: 1 });
      await manager.initialize();

      // Create maximum allowed sessions
      const session1Result = await manager.createSession();
      expect(session1Result.success).toBe(true);

      // Try to exceed limit
      const session2Result = await manager.createSession();
      expect(session2Result.success).toBe(false);
      expect(session2Result.error).toContain('Maximum number');

      // Should be able to create after closing one
      await manager.closeSession(session1Result.data!);
      const session3Result = await manager.createSession();
      expect(session3Result.success).toBe(true);
    });
  });

  describe('Race Condition Testing', () => {
    it('should handle concurrent session operations', async () => {
      const sessions = Array.from({ length: 5 }, () => createMockBrowserSession());

      // Launch all sessions concurrently
      const launchResults = await Promise.all(
        sessions.map(session => session.launch())
      );

      launchResults.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Perform concurrent operations on all sessions
      const operationResults = await Promise.all(
        sessions.map(session =>
          Promise.all([
            session.navigate('https://example.com'),
            session.elementExists('#test'),
            session.captureScreenshot(),
          ])
        )
      );

      operationResults.forEach(sessionResults => {
        sessionResults.forEach(result => {
          expect(result).toHaveProperty('success');
        });
      });
    });

    it('should handle rapid session creation and destruction', async () => {
      const manager = createMockBrowserManager();
      await manager.initialize();

      const operations = [];

      // Create and destroy sessions rapidly
      for (let i = 0; i < 10; i++) {
        operations.push(
          manager.createSession().then(result => {
            if (result.success) {
              return manager.closeSession(result.data!);
            }
            return result;
          })
        );
      }

      const results = await Promise.all(operations);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(manager.getActiveSessionCount()).toBe(0);
    });

    it('should handle concurrent manager operations', async () => {
      const manager = createMockBrowserManager();

      // Initialize and check resources concurrently
      const results = await Promise.all([
        manager.initialize(),
        manager.checkResourceUsage(),
        manager.initialize(), // Double initialize
        manager.cleanup(),
        manager.initialize(), // Initialize after cleanup
      ]);

      results.forEach(result => {
        expect(result).toHaveProperty('success');
      });
    });
  });

  describe('Memory and Resource Edge Cases', () => {
    it('should handle memory pressure simulation', async () => {
      const resourceManager = createMockBrowserManager({
        resourceLimits: {
          maxMemoryMB: 100, // Very low limit
          maxCpuPercent: 10, // Very low limit
        },
      });

      const limitExceededEvents: any[] = [];
      resourceManager.on('resourceLimitExceeded', (event) => {
        limitExceededEvents.push(event);
      });

      await resourceManager.initialize();

      // Create sessions that will exceed limits
      const sessions = [];
      for (let i = 0; i < 3; i++) {
        const result = await resourceManager.createSession();
        if (result.success) {
          sessions.push(result.data!);
        }
      }

      // Check resources
      await resourceManager.checkResourceUsage();

      // Should have triggered resource limit events
      expect(limitExceededEvents.length).toBeGreaterThan(0);

      // Cleanup
      for (const session of sessions) {
        await resourceManager.closeSession(session);
      }
    });

    it('should handle large operation history', async () => {
      const session = createMockBrowserSession({
        trackOperations: true,
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 1,
          useRealisticDelays: false,
        },
      });

      await session.launch();

      // Generate large operation history
      for (let i = 0; i < 1000; i++) {
        await session.elementExists(`#element-${i}`);
      }

      const history = session.getOperationHistory();
      expect(history).toHaveLength(1001); // 1000 + launch

      // History should maintain correct structure
      history.forEach(operation => {
        expect(operation.name).toBeDefined();
        expect(operation.startTime).toBeDefined();
        expect(operation.endTime).toBeDefined();
        expect(operation.success).toBeDefined();
      });
    });

    it('should handle cleanup with many active sessions', async () => {
      const manager = createMockBrowserManager({ maxInstances: 20 });
      await manager.initialize();

      // Create many sessions
      const sessions = [];
      for (let i = 0; i < 15; i++) {
        const result = await manager.createSession();
        if (result.success) {
          sessions.push(result.data!);
        }
      }

      expect(manager.getActiveSessionCount()).toBe(15);

      // Cleanup should close all sessions
      const cleanupResult = await manager.cleanup();
      expect(cleanupResult.success).toBe(true);
      expect(manager.getActiveSessionCount()).toBe(0);
      expect(manager.isInitialized()).toBe(false);
    });
  });

  describe('Error Recovery Testing', () => {
    it('should recover from operation failures', async () => {
      const scenario = createMockScenario()
        .forOperation('navigate')
          .fails('Network error')
        .and()
        .forOperation('clickElement')
          .succeeds()
        .and()
        .build();

      const session = createMockBrowserSession({}, scenario);
      await session.launch();

      // Navigation should fail
      const navResult = await session.navigate('https://example.com');
      expect(navResult.success).toBe(false);

      // But other operations should still work
      const clickResult = await session.clickElement('#button');
      expect(clickResult.success).toBe(true);

      // Session should remain functional
      const screenshotResult = await session.captureScreenshot();
      expect(screenshotResult.success).toBe(true);
    });

    it('should handle cascading failures gracefully', async () => {
      const unreliableSession = createUnreliableMockSession(0.9); // 90% failure rate
      await unreliableSession.launch();

      const operations = [];
      for (let i = 0; i < 50; i++) {
        operations.push(unreliableSession.elementExists(`#test-${i}`));
      }

      const results = await Promise.all(operations);

      // Some operations should fail, but none should throw
      const failures = results.filter(r => !r.success);
      const successes = results.filter(r => r.success);

      expect(failures.length).toBeGreaterThan(0);
      expect(successes.length).toBeGreaterThan(0); // Some should still succeed

      // All results should have proper structure
      results.forEach(result => {
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('duration');
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      });
    });

    it('should maintain state consistency after errors', async () => {
      const errorScenario = createMockScenario()
        .forOperation('typeInElement')
          .fails('Input validation error')
        .and()
        .build();

      const session = createMockBrowserSession({}, errorScenario);
      await session.launch();
      await session.navigate('https://example.com');

      // Typing should fail
      const typeResult = await session.typeInElement('#input', 'test');
      expect(typeResult.success).toBe(false);

      // But page state should remain consistent
      const pageState = session.getPageState();
      expect(pageState.url).toBe('https://example.com');
      expect(pageState.loaded).toBe(true);

      // Element should exist but not have the failed input
      const element = pageState.elements.get('#input');
      expect(element).toBeDefined();
      expect(element?.value).not.toBe('test');
    });
  });

  describe('Scenario Configuration Edge Cases', () => {
    it('should handle conflicting scenario configurations', () => {
      const conflictingScenario = createMockScenario()
        .forOperation('navigate')
          .succeeds()
          .withDelay(100)
        .and()
        .forOperation('navigate')
          .fails('Override error')
          .withDelay(200)
        .and()
        .build();

      const session = createMockBrowserSession({}, conflictingScenario);
      expect(session).toBeDefined();

      // Should use the last configuration
      const config = session.getConfig();
      expect(config.scenarioConfig?.operations?.navigate).toBeDefined();
    });

    it('should handle wildcard operation overrides', async () => {
      const wildcardScenario = createMockScenario()
        .forOperation('*')
          .succeeds()
          .withDelay(50)
        .and()
        .forOperation('navigate')
          .fails('Specific error')
        .and()
        .build();

      const session = createMockBrowserSession({}, wildcardScenario);
      await session.launch();

      // Specific operation should use specific config
      const navResult = await session.navigate('https://example.com');
      expect(navResult.success).toBe(false);
      expect(navResult.error).toBe('Specific error');

      // Other operations should use wildcard config
      const clickResult = await session.clickElement('#button');
      expect(clickResult.success).toBe(true);
    });

    it('should handle deeply nested scenario objects', () => {
      const deepScenario: MockScenarioConfig = {
        operations: {
          'level1': {
            success: true,
            returnValue: {
              level2: {
                level3: {
                  level4: {
                    deepValue: 'test',
                    array: [1, 2, 3, { nested: true }],
                    null: null,
                    undefined: undefined,
                  }
                }
              }
            }
          }
        }
      };

      const session = createMockBrowserSession({}, deepScenario);
      expect(session).toBeDefined();
      expect(session.getConfig().scenarioConfig).toBeDefined();
    });

    it('should handle scenario with many URL patterns', () => {
      const manyUrlsScenario = createMockScenario();

      // Add many URL patterns
      for (let i = 0; i < 100; i++) {
        manyUrlsScenario
          .forUrl(`https://site${i}.example.com`)
            .loadTime(i * 10)
            .withTitle(`Site ${i}`)
          .and();
      }

      const scenario = manyUrlsScenario.build();
      const session = createMockBrowserSession({}, scenario);

      expect(Object.keys(scenario.urlBehaviors || {})).toHaveLength(100);
      expect(session).toBeDefined();
    });
  });

  describe('Event System Edge Cases', () => {
    it('should handle event listener errors gracefully', async () => {
      const session = createMockBrowserSession();

      // Add listener that throws
      session.on('operation', () => {
        throw new Error('Listener error');
      });

      // Add normal listener
      const normalListener = vi.fn();
      session.on('operation', normalListener);

      // Operation should still complete despite listener error
      await session.launch();

      // Normal listener should still be called
      expect(normalListener).toHaveBeenCalled();
    });

    it('should handle many event listeners', async () => {
      const session = createMockBrowserSession();
      const listeners = [];

      // Add many listeners
      for (let i = 0; i < 100; i++) {
        const listener = vi.fn();
        listeners.push(listener);
        session.on('operation', listener);
      }

      await session.launch();

      // All listeners should be called
      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalled();
      });

      // Remove all listeners
      session.removeAllListeners('operation');
      expect(session.listenerCount('operation')).toBe(0);
    });

    it('should handle event listener cleanup on session close', async () => {
      const session = createMockBrowserSession();
      const listener = vi.fn();

      session.on('operation', listener);
      expect(session.listenerCount('operation')).toBe(1);

      await session.launch();
      await session.close();

      // Listeners should still exist after close (not auto-cleaned)
      expect(session.listenerCount('operation')).toBe(1);

      // But can be manually cleaned
      session.removeAllListeners();
      expect(session.listenerCount('operation')).toBe(0);
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should handle different browser type configurations', () => {
      const browserTypes = ['chromium', 'firefox', 'webkit'] as const;

      browserTypes.forEach(browserType => {
        const session = createMockBrowserSession({ browserType });
        const config = session.getConfig();

        expect(config.browserType).toBe(browserType);
        expect(session).toBeDefined();
      });
    });

    it('should handle different platform-specific paths', async () => {
      const platformPaths = [
        '/unix/style/path',
        'C:\\Windows\\Path',
        '\\\\unc\\share\\path',
        'relative/path',
        './relative/path',
        '../parent/path',
      ];

      for (const path of platformPaths) {
        const session = createMockBrowserSession();
        await session.launch();

        // Should handle platform paths gracefully
        const result = await session.navigate(`file://${path}`);
        expect(result).toHaveProperty('success');
      }
    });

    it('should handle different character encodings in text', async () => {
      const session = createMockBrowserSession();
      await session.launch();
      await session.navigate('https://example.com');

      const encodingTexts = [
        'ASCII text',
        'UTF-8: 你好世界',
        'UTF-8: Здравствуй мир',
        'UTF-8: مرحبا بالعالم',
        'UTF-8: 🎯🚀💻🌟',
        'Latin-1: café résumé',
        'Mixed: Hello 世界 🌍',
      ];

      for (const text of encodingTexts) {
        const result = await session.typeInElement('#input', text);
        expect(result.success).toBe(true);

        const pageState = session.getPageState();
        const element = pageState.elements.get('#input');
        expect(element?.value).toBe(text);
      }
    });
  });
});