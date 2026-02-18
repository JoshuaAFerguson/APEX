/**
 * @apexcli/browser/mocks - Performance and Stress Tests
 *
 * Tests to ensure mock implementations perform well under load
 * and handle stress scenarios gracefully.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MockBrowserSession,
  MockBrowserManager,
  createMockBrowserSession,
  createMockBrowserManager,
  createMockScenario,
  createMockSessionForTesting,
  createUnreliableMockSession,
} from '../index.js';

describe('Performance and Stress Tests', () => {
  describe('High-Volume Operation Performance', () => {
    let session: MockBrowserSession;

    beforeEach(async () => {
      session = createMockSessionForTesting('performance-test', {
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 1, // Very fast for testing
          useRealisticDelays: false,
        },
      });
      await session.launch();
    });

    it('should handle 1000 element queries efficiently', async () => {
      const startTime = Date.now();
      const operationCount = 1000;

      const operations = Array.from({ length: operationCount }, (_, i) =>
        session.elementExists(`#element-${i}`)
      );

      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;

      // All operations should succeed
      expect(results.every(r => r.success)).toBe(true);
      expect(results).toHaveLength(operationCount);

      // Should complete quickly (less than 1 second)
      expect(duration).toBeLessThan(1000);

      // Average operation time should be reasonable
      const avgTime = duration / operationCount;
      expect(avgTime).toBeLessThan(1); // Less than 1ms per operation

      console.log(`Completed ${operationCount} operations in ${duration}ms (${avgTime.toFixed(2)}ms avg)`);
    });

    it('should handle rapid navigation between many URLs', async () => {
      const urlCount = 100;
      const startTime = Date.now();

      const urls = Array.from(
        { length: urlCount },
        (_, i) => `https://site${i}.example.com/page${i}`
      );

      // Navigate to all URLs sequentially
      for (const url of urls) {
        const result = await session.navigate(url);
        expect(result.success).toBe(true);
      }

      const duration = Date.now() - startTime;
      const avgNavigationTime = duration / urlCount;

      // Should complete navigation quickly
      expect(duration).toBeLessThan(2000); // Less than 2 seconds total
      expect(avgNavigationTime).toBeLessThan(20); // Less than 20ms per navigation

      // Final page state should be correct
      const pageState = session.getPageState();
      expect(pageState.url).toBe(urls[urls.length - 1]);

      console.log(`Navigated to ${urlCount} URLs in ${duration}ms (${avgNavigationTime.toFixed(2)}ms avg)`);
    });

    it('should handle large text input operations efficiently', async () => {
      await session.navigate('https://example.com');

      const textSizes = [1000, 10000, 100000, 500000]; // Characters
      const results: number[] = [];

      for (const size of textSizes) {
        const largeText = 'x'.repeat(size);
        const startTime = Date.now();

        const result = await session.typeInElement('#large-input', largeText);
        const duration = Date.now() - startTime;

        expect(result.success).toBe(true);
        results.push(duration);

        // Verify text was stored correctly
        const pageState = session.getPageState();
        const element = pageState.elements.get('#large-input');
        expect(element?.value).toBe(largeText);

        console.log(`Text input of ${size} chars completed in ${duration}ms`);
      }

      // Performance should scale reasonably with input size
      // (allowing for some variation in timing)
      results.forEach(duration => {
        expect(duration).toBeLessThan(100); // Each operation under 100ms
      });
    });

    it('should handle concurrent operations on same session', async () => {
      await session.navigate('https://example.com');

      const concurrentOperations = 50;
      const startTime = Date.now();

      // Mix of different operation types
      const operations = Array.from({ length: concurrentOperations }, (_, i) => {
        const operationType = i % 4;
        switch (operationType) {
          case 0:
            return session.elementExists(`#element-${i}`);
          case 1:
            return session.clickElement(`#button-${i}`);
          case 2:
            return session.getElementText(`#text-${i}`);
          case 3:
            return session.captureScreenshot();
          default:
            return session.elementExists(`#default-${i}`);
        }
      });

      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;

      // All operations should complete
      expect(results).toHaveLength(concurrentOperations);
      results.forEach(result => {
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('duration');
      });

      // Should complete quickly despite concurrency
      expect(duration).toBeLessThan(1000);

      console.log(`${concurrentOperations} concurrent operations completed in ${duration}ms`);
    });

    afterEach(async () => {
      await session.close();
    });
  });

  describe('Memory Usage and Cleanup Performance', () => {
    it('should manage memory efficiently with large operation history', async () => {
      const session = createMockSessionForTesting('memory-test', {
        trackOperations: true,
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 0,
          useRealisticDelays: false,
        },
      });

      await session.launch();

      // Create large operation history
      const operationCount = 5000;
      for (let i = 0; i < operationCount; i++) {
        await session.elementExists(`#test-${i}`);

        // Periodically check memory hasn't grown excessively
        if (i % 1000 === 0 && i > 0) {
          const history = session.getOperationHistory();
          expect(history).toHaveLength(i + 2); // +1 for launch, +1 for current

          // Each operation should have complete data
          history.forEach(op => {
            expect(op.name).toBeDefined();
            expect(op.startTime).toBeDefined();
            expect(op.endTime).toBeDefined();
            expect(op.args).toBeDefined();
          });
        }
      }

      const finalHistory = session.getOperationHistory();
      expect(finalHistory).toHaveLength(operationCount + 1); // +1 for launch

      await session.close();
    });

    it('should handle rapid session creation and destruction', async () => {
      const manager = createMockBrowserManager({
        maxInstances: 20,
      });

      const sessionCount = 100;
      const batchSize = 10;
      const createDestroyTime: number[] = [];

      // Create and destroy sessions in batches
      for (let batch = 0; batch < sessionCount / batchSize; batch++) {
        const batchStart = Date.now();
        const sessions: MockBrowserSession[] = [];

        // Create batch of sessions
        for (let i = 0; i < batchSize; i++) {
          const result = await manager.createSession();
          expect(result.success).toBe(true);
          sessions.push(result.data!);
        }

        expect(manager.getActiveSessionCount()).toBe(batchSize);

        // Destroy batch of sessions
        for (const session of sessions) {
          const result = await manager.closeSession(session);
          expect(result.success).toBe(true);
        }

        expect(manager.getActiveSessionCount()).toBe(0);

        const batchTime = Date.now() - batchStart;
        createDestroyTime.push(batchTime);

        console.log(`Batch ${batch + 1}: Created and destroyed ${batchSize} sessions in ${batchTime}ms`);
      }

      // Performance should remain consistent across batches
      const avgTime = createDestroyTime.reduce((a, b) => a + b, 0) / createDestroyTime.length;
      expect(avgTime).toBeLessThan(1000); // Average batch under 1 second

      // No session leaks
      expect(manager.getActiveSessionCount()).toBe(0);
      expect(manager.getBrowserInstances()).toHaveLength(0);
      expect(manager.getBrowserContexts()).toHaveLength(0);

      await manager.cleanup();
    });

    it('should handle large scenario configurations efficiently', async () => {
      const startTime = Date.now();

      // Create very large scenario
      const scenarioBuilder = createMockScenario();

      // Add many URL behaviors
      for (let i = 0; i < 500; i++) {
        scenarioBuilder
          .forUrl(`https://domain${i}.com/path${i}`)
            .loadTime(i * 10)
            .withTitle(`Page ${i}`)
          .and();
      }

      // Add many element behaviors
      for (let i = 0; i < 1000; i++) {
        scenarioBuilder
          .forElement(`#element-${i}`)
            .exists(i % 2 === 0)
            .visible(i % 3 === 0)
            .enabled(i % 4 === 0)
            .withText(`Element ${i} text`)
            .withValue(`value${i}`)
          .and();
      }

      // Add many operation behaviors
      for (let i = 0; i < 200; i++) {
        scenarioBuilder
          .forOperation(`operation${i}`)
            .succeeds({ result: `success${i}` })
            .withDelay(i)
          .and();
      }

      const scenario = scenarioBuilder.build();
      const buildTime = Date.now() - startTime;

      expect(Object.keys(scenario.urlBehaviors || {})).toHaveLength(500);
      expect(Object.keys(scenario.elementBehaviors || {})).toHaveLength(1000);
      expect(Object.keys(scenario.operations || {})).toHaveLength(200);

      // Should build quickly
      expect(buildTime).toBeLessThan(1000);

      // Should create session quickly with large scenario
      const sessionStart = Date.now();
      const session = createMockBrowserSession({}, scenario);
      const sessionTime = Date.now() - sessionStart;

      expect(sessionTime).toBeLessThan(100);
      expect(session.getConfig().scenarioConfig).toBeDefined();

      console.log(`Large scenario built in ${buildTime}ms, session created in ${sessionTime}ms`);
    });
  });

  describe('Stress Test Scenarios', () => {
    it('should handle extreme failure rates without breaking', async () => {
      const extremeSession = createUnreliableMockSession(1.0); // 100% failure rate
      await extremeSession.launch(); // Launch might still succeed

      const operationCount = 100;
      const operations = Array.from({ length: operationCount }, (_, i) => {
        const operationType = i % 3;
        switch (operationType) {
          case 0:
            return extremeSession.navigate(`https://example${i}.com`);
          case 1:
            return extremeSession.clickElement(`#button-${i}`);
          case 2:
            return extremeSession.elementExists(`#element-${i}`);
          default:
            return extremeSession.captureScreenshot();
        }
      });

      const results = await Promise.all(operations);

      // All operations should complete (not throw)
      expect(results).toHaveLength(operationCount);

      // Most should fail due to high failure rate
      const failures = results.filter(r => !r.success);
      expect(failures.length).toBeGreaterThan(operationCount * 0.7); // At least 70% failures

      // All failed operations should have error messages
      failures.forEach(failure => {
        expect(failure.error).toBeDefined();
        expect(typeof failure.error).toBe('string');
      });

      // Session should remain functional
      const pageState = extremeSession.getPageState();
      expect(pageState).toBeDefined();

      await extremeSession.close();
    });

    it('should handle resource limit stress testing', async () => {
      const stressManager = createMockBrowserManager({
        maxInstances: 5,
        resourceLimits: {
          maxMemoryMB: 200,
          maxCpuPercent: 50,
        },
      });

      await stressManager.initialize();

      const resourceExceededEvents: any[] = [];
      stressManager.on('resourceLimitExceeded', (event) => {
        resourceExceededEvents.push(event);
      });

      // Create sessions up to limit
      const sessions: MockBrowserSession[] = [];
      for (let i = 0; i < 5; i++) {
        const result = await stressManager.createSession();
        expect(result.success).toBe(true);
        sessions.push(result.data!);
      }

      // Try to exceed instance limit
      const extraSessionResult = await stressManager.createSession();
      expect(extraSessionResult.success).toBe(false);

      // Check resources multiple times to trigger events
      for (let i = 0; i < 10; i++) {
        await stressManager.checkResourceUsage();
      }

      // Should have triggered resource limit events
      expect(resourceExceededEvents.length).toBeGreaterThan(0);

      // Verify event structure
      resourceExceededEvents.forEach(event => {
        expect(['memory', 'cpu']).toContain(event.type);
        expect(typeof event.value).toBe('number');
        expect(typeof event.limit).toBe('number');
        expect(event.value).toBeGreaterThan(event.limit);
      });

      // Cleanup all sessions
      for (const session of sessions) {
        const result = await stressManager.closeSession(session);
        expect(result.success).toBe(true);
      }

      await stressManager.cleanup();
    });

    it('should handle mixed concurrent operations stress test', async () => {
      const stressSessions = Array.from({ length: 10 }, () =>
        createMockSessionForTesting('stress-test')
      );

      // Launch all sessions
      await Promise.all(stressSessions.map(session => session.launch()));

      // Create mixed operation load
      const allOperations: Promise<any>[] = [];

      stressSessions.forEach((session, sessionIndex) => {
        // Each session performs multiple operations
        for (let i = 0; i < 20; i++) {
          allOperations.push(
            session.navigate(`https://stress-test-${sessionIndex}-${i}.com`)
          );
          allOperations.push(
            session.clickElement(`#stress-button-${i}`)
          );
          allOperations.push(
            session.typeInElement(`#stress-input-${i}`, `stress-text-${i}`)
          );
          allOperations.push(
            session.elementExists(`#stress-element-${i}`)
          );
          allOperations.push(
            session.captureScreenshot()
          );
        }
      });

      const startTime = Date.now();
      const results = await Promise.all(allOperations);
      const duration = Date.now() - startTime;

      // All operations should complete
      expect(results).toHaveLength(stressSessions.length * 20 * 5);

      // Most should succeed
      const successes = results.filter(r => r.success);
      expect(successes.length).toBeGreaterThan(results.length * 0.8);

      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000); // Under 5 seconds

      console.log(
        `Stress test: ${results.length} operations across ${stressSessions.length} sessions in ${duration}ms`
      );

      // Cleanup
      await Promise.all(stressSessions.map(session => session.close()));
    });
  });

  describe('Event System Performance', () => {
    it('should handle many event listeners without performance degradation', async () => {
      const session = createMockSessionForTesting('event-performance');
      const listenerCount = 1000;
      const listeners: any[] = [];

      // Add many listeners
      for (let i = 0; i < listenerCount; i++) {
        const listener = vi.fn();
        listeners.push(listener);
        session.on('operation', listener);
      }

      expect(session.listenerCount('operation')).toBe(listenerCount);

      // Perform operations
      const startTime = Date.now();
      await session.launch();
      await session.navigate('https://example.com');
      await session.clickElement('#button');
      const duration = Date.now() - startTime;

      // Should complete quickly despite many listeners
      expect(duration).toBeLessThan(500);

      // All listeners should have been called
      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalledTimes(3); // 3 operations
      });

      // Cleanup listeners
      session.removeAllListeners('operation');
      expect(session.listenerCount('operation')).toBe(0);

      await session.close();
    });

    it('should handle rapid event emission without memory leaks', async () => {
      const session = createMockSessionForTesting('event-rapid');
      let eventCount = 0;

      const listener = () => {
        eventCount++;
      };

      session.on('operation', listener);

      // Perform many rapid operations
      const operationCount = 500;
      for (let i = 0; i < operationCount; i++) {
        await session.elementExists(`#rapid-${i}`);
      }

      // All events should have been emitted
      expect(eventCount).toBe(operationCount);

      session.off('operation', listener);
      await session.close();
    });
  });

  describe('Configuration Performance', () => {
    it('should handle complex scenario merging efficiently', () => {
      const baseScenario = createMockScenario();

      // Build complex base scenario
      for (let i = 0; i < 100; i++) {
        baseScenario
          .forElement(`#base-${i}`)
            .exists()
            .visible()
          .and();
      }

      const scenario1 = baseScenario.build();

      // Create extension scenario
      const extensionBuilder = createMockScenario();
      for (let i = 50; i < 150; i++) {
        extensionBuilder
          .forElement(`#base-${i}`)
            .enabled()
            .withText(`Extended ${i}`)
          .and();
      }

      const scenario2 = extensionBuilder.build();

      // Merge scenarios by creating sessions with overlapping configs
      const startTime = Date.now();
      const session1 = createMockBrowserSession({}, scenario1);
      const session2 = createMockBrowserSession({}, scenario2);
      const mergeTime = Date.now() - startTime;

      expect(mergeTime).toBeLessThan(100);
      expect(session1.getConfig().scenarioConfig).toBeDefined();
      expect(session2.getConfig().scenarioConfig).toBeDefined();

      console.log(`Complex scenario merging completed in ${mergeTime}ms`);
    });

    it('should handle realistic delays efficiently', async () => {
      const realisticSession = createMockBrowserSession({
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 100, // Reasonable default
          useRealisticDelays: true,
        },
      });

      await realisticSession.launch();

      const operations = [
        'navigate',
        'clickElement',
        'typeInElement',
        'captureScreenshot',
        'waitForNavigation',
      ];

      const timings: number[] = [];

      for (const operation of operations) {
        const startTime = Date.now();

        switch (operation) {
          case 'navigate':
            await realisticSession.navigate('https://example.com');
            break;
          case 'clickElement':
            await realisticSession.clickElement('#button');
            break;
          case 'typeInElement':
            await realisticSession.typeInElement('#input', 'text');
            break;
          case 'captureScreenshot':
            await realisticSession.captureScreenshot();
            break;
          case 'waitForNavigation':
            await realisticSession.waitForNavigation();
            break;
        }

        const duration = Date.now() - startTime;
        timings.push(duration);
      }

      // Realistic delays should be in reasonable ranges
      timings.forEach((timing, index) => {
        expect(timing).toBeGreaterThan(100); // Should respect realistic delays
        expect(timing).toBeLessThan(3000); // But not excessive
        console.log(`${operations[index]}: ${timing}ms`);
      });

      await realisticSession.close();
    });
  });
});