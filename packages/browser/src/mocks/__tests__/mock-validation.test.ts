/**
 * @apexcli/browser/mocks - Comprehensive Mock Validation Tests
 *
 * Validates that mock classes accurately simulate browser behavior,
 * handle edge cases correctly, and maintain interface compatibility.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MockBrowserSession,
  MockBrowserManager,
  createMockBrowserSession,
  createMockBrowserManager,
  createMockScenario,
  launchMockBrowser,
  createMockSessionForTesting,
  createUnreliableMockSession,
  commonScenarios,
  defaultMockConfig,
} from '../index.js';
import type {
  MockBehaviorConfig,
  MockScenarioConfig,
  MockBrowserSessionConfig,
  MockPageState,
  MockElement,
  MockOperation
} from '../types.js';

describe('Mock Validation Tests', () => {
  let session: MockBrowserSession;
  let manager: MockBrowserManager;

  beforeEach(() => {
    session = createMockBrowserSession();
    manager = createMockBrowserManager();
  });

  describe('Interface Compatibility Validation', () => {
    it('should implement all required browser session methods', () => {
      // Verify all expected methods exist
      expect(typeof session.launch).toBe('function');
      expect(typeof session.navigate).toBe('function');
      expect(typeof session.clickElement).toBe('function');
      expect(typeof session.typeInElement).toBe('function');
      expect(typeof session.elementExists).toBe('function');
      expect(typeof session.getElementText).toBe('function');
      expect(typeof session.captureScreenshot).toBe('function');
      expect(typeof session.waitForNavigation).toBe('function');
      expect(typeof session.close).toBe('function');
    });

    it('should implement all required browser manager methods', () => {
      // Verify all expected methods exist
      expect(typeof manager.initialize).toBe('function');
      expect(typeof manager.createSession).toBe('function');
      expect(typeof manager.closeSession).toBe('function');
      expect(typeof manager.cleanup).toBe('function');
      expect(typeof manager.checkResourceUsage).toBe('function');
      expect(typeof manager.getBrowserInstances).toBe('function');
      expect(typeof manager.getBrowserContexts).toBe('function');
      expect(typeof manager.getActiveSessionCount).toBe('function');
      expect(typeof manager.isInitialized).toBe('function');
      expect(typeof manager.getConfig).toBe('function');
      expect(typeof manager.getState).toBe('function');
    });

    it('should return BrowserActionResult format for all operations', async () => {
      await session.launch();

      const results = await Promise.all([
        session.navigate('https://example.com'),
        session.clickElement('#button'),
        session.typeInElement('#input', 'text'),
        session.elementExists('#element'),
        session.getElementText('#text'),
        session.captureScreenshot(),
        session.waitForNavigation(),
      ]);

      results.forEach((result, index) => {
        expect(result).toHaveProperty('success');
        expect(typeof result.success).toBe('boolean');
        expect(result).toHaveProperty('duration');
        expect(typeof result.duration).toBe('number');
        expect(result.duration).toBeGreaterThanOrEqual(0);

        if (!result.success) {
          expect(result).toHaveProperty('error');
          expect(typeof result.error).toBe('string');
        }

        // Some operations return data
        if (result.success && (index === 3 || index === 4 || index === 5)) {
          expect(result).toHaveProperty('data');
        }
      });
    });

    it('should handle EventEmitter interface correctly', () => {
      const session = createMockBrowserSession();

      // Should have EventEmitter methods
      expect(typeof session.on).toBe('function');
      expect(typeof session.off).toBe('function');
      expect(typeof session.emit).toBe('function');
      expect(typeof session.removeAllListeners).toBe('function');

      // Should handle event registration
      const spy = vi.fn();
      session.on('operation', spy);
      expect(session.listeners('operation')).toContain(spy);

      session.off('operation', spy);
      expect(session.listeners('operation')).not.toContain(spy);
    });
  });

  describe('Edge Case Validation', () => {
    it('should handle empty and invalid selectors gracefully', async () => {
      await session.launch();
      await session.navigate('https://example.com');

      const edgeCaseSelectors = [
        '',
        '   ',
        null as any,
        undefined as any,
        123 as any,
        {} as any,
        '#',
        '.',
        '[invalid',
        'very-long-selector-'.repeat(100),
      ];

      for (const selector of edgeCaseSelectors) {
        try {
          const result = await session.elementExists(selector);
          expect(result).toHaveProperty('success');
          expect(typeof result.success).toBe('boolean');
        } catch (error) {
          // If error is thrown, it should be handled gracefully
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should handle invalid URLs gracefully', async () => {
      await session.launch();

      const invalidUrls = [
        '',
        '   ',
        'not-a-url',
        'invalid://url',
        'ftp://unsupported',
        null as any,
        undefined as any,
        123 as any,
        'a'.repeat(10000), // Very long string
      ];

      for (const url of invalidUrls) {
        try {
          const result = await session.navigate(url);
          expect(result).toHaveProperty('success');
          if (!result.success) {
            expect(result.error).toBeDefined();
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should handle concurrent operations correctly', async () => {
      await session.launch();
      await session.navigate('https://example.com');

      // Execute multiple operations concurrently
      const operations = Array.from({ length: 10 }, (_, i) => [
        session.clickElement(`#button-${i}`),
        session.typeInElement(`#input-${i}`, `text-${i}`),
        session.elementExists(`#element-${i}`),
        session.captureScreenshot(),
      ]).flat();

      const results = await Promise.all(operations);

      // All operations should complete
      expect(results).toHaveLength(40);
      results.forEach(result => {
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('duration');
      });

      // Operations should be tracked
      const history = session.getOperationHistory();
      expect(history.length).toBeGreaterThanOrEqual(40);
    });

    it('should handle operations on unlaunched session', async () => {
      // Don't launch the session
      const operations = [
        () => session.navigate('https://example.com'),
        () => session.clickElement('#button'),
        () => session.typeInElement('#input', 'text'),
        () => session.elementExists('#element'),
        () => session.captureScreenshot(),
      ];

      for (const operation of operations) {
        const result = await operation();
        expect(result.success).toBe(false);
        expect(result.error).toContain('not launched');
      }
    });

    it('should handle malformed scenario configurations', () => {
      const malformedConfigs = [
        null as any,
        undefined as any,
        { operations: null },
        { urlBehaviors: 'invalid' as any },
        { elementBehaviors: [] as any },
        { operations: { '*': null } },
        { urlBehaviors: { 'url': { loadTime: 'invalid' } } } as any,
      ];

      malformedConfigs.forEach((config, index) => {
        expect(() => {
          const session = createMockBrowserSession({}, config);
          expect(session).toBeDefined();
        }).not.toThrow();
      });
    });

    it('should handle extreme delay configurations', async () => {
      const extremeSession = createMockBrowserSession({
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 0,
          useRealisticDelays: false,
        },
      });

      await extremeSession.launch();

      const startTime = Date.now();
      const result = await extremeSession.navigate('https://example.com');
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(100); // Should be very fast
    });
  });

  describe('Error Simulation Validation', () => {
    it('should simulate realistic error scenarios', async () => {
      const errorScenario = createMockScenario()
        .forOperation('navigate')
          .fails('ERR_NETWORK_TIMEOUT')
        .and()
        .forOperation('clickElement')
          .fails('Element not clickable at this time')
        .and()
        .forElement('#missing')
          .exists(false)
        .and()
        .build();

      const errorSession = createMockBrowserSession({}, errorScenario);
      await errorSession.launch();

      // Navigation should fail with specific error
      const navResult = await errorSession.navigate('https://example.com');
      expect(navResult.success).toBe(false);
      expect(navResult.error).toBe('ERR_NETWORK_TIMEOUT');

      // Click should fail with specific error
      const clickResult = await errorSession.clickElement('#button');
      expect(clickResult.success).toBe(false);
      expect(clickResult.error).toBe('Element not clickable at this time');

      // Missing element should not exist
      const existsResult = await errorSession.elementExists('#missing');
      expect(existsResult.success).toBe(true);
      expect(existsResult.data).toBe(false);
    });

    it('should handle random failure simulation', async () => {
      const unreliableSession = createUnreliableMockSession(0.8); // 80% failure rate
      await unreliableSession.launch();

      const operations = Array.from({ length: 20 }, () =>
        unreliableSession.elementExists('#test')
      );

      const results = await Promise.all(operations);
      const failures = results.filter(r => !r.success).length;
      const successes = results.filter(r => r.success).length;

      // With 80% failure rate, should have mostly failures
      // (allowing some variance due to randomness)
      expect(failures).toBeGreaterThan(successes);
      expect(failures).toBeGreaterThan(10);
    });

    it('should validate failure rate clamping', () => {
      const session1 = createUnreliableMockSession(-1);
      const session2 = createUnreliableMockSession(2);

      expect(session1.getConfig().mockConfig.failureRate).toBe(0);
      expect(session2.getConfig().mockConfig.failureRate).toBe(1);
    });

    it('should handle operation timeouts gracefully', async () => {
      const timeoutScenario = createMockScenario()
        .forOperation('navigate')
          .withDelay(100)
          .succeeds()
        .and()
        .build();

      const timeoutSession = createMockBrowserSession({
        timeout: 50, // Very short timeout
      }, timeoutScenario);

      await timeoutSession.launch();

      // Operation should complete even with short timeout in mock
      const result = await timeoutSession.navigate('https://example.com');
      expect(result.success).toBe(true);
    });
  });

  describe('State Management Validation', () => {
    it('should maintain consistent page state across operations', async () => {
      await session.launch();

      let pageState = session.getPageState();
      expect(pageState.url).toBe('about:blank');
      expect(pageState.loaded).toBe(false);

      // Navigate and check state update
      await session.navigate('https://example.com/test');

      pageState = session.getPageState();
      expect(pageState.url).toBe('https://example.com/test');
      expect(pageState.loaded).toBe(true);
      expect(pageState.title).toContain('example.com');

      // Type in element and check value update
      await session.typeInElement('#content', 'test value');

      pageState = session.getPageState();
      const element = pageState.elements.get('#content');
      expect(element?.value).toBe('test value');
    });

    it('should track operations with complete timing information', async () => {
      await session.launch();
      await session.navigate('https://example.com');
      await session.clickElement('#button');

      const history = session.getOperationHistory();

      expect(history).toHaveLength(3); // launch, navigate, click

      history.forEach(operation => {
        expect(operation.startTime).toBeDefined();
        expect(operation.endTime).toBeDefined();
        expect(operation.endTime!).toBeGreaterThanOrEqual(operation.startTime);
        expect(operation.success).toBeDefined();
        expect(operation.name).toBeDefined();
        expect(operation.args).toBeDefined();
        expect(Array.isArray(operation.args)).toBe(true);
      });
    });

    it('should handle state isolation between sessions', async () => {
      const session1 = createMockBrowserSession();
      const session2 = createMockBrowserSession();

      await session1.launch();
      await session2.launch();

      await session1.navigate('https://site1.com');
      await session2.navigate('https://site2.com');

      const state1 = session1.getPageState();
      const state2 = session2.getPageState();

      expect(state1.url).toBe('https://site1.com');
      expect(state2.url).toBe('https://site2.com');

      // Operations should be independent
      const history1 = session1.getOperationHistory();
      const history2 = session2.getOperationHistory();

      expect(history1).toHaveLength(2); // launch, navigate
      expect(history2).toHaveLength(2); // launch, navigate
    });

    it('should preserve element state across multiple interactions', async () => {
      const scenario = createMockScenario()
        .forElement('#form-input')
          .exists()
          .visible()
          .enabled()
          .withValue('initial')
        .and()
        .build();

      const stateSession = createMockBrowserSession({}, scenario);
      await stateSession.launch();
      await stateSession.navigate('https://form.example.com');

      // Check initial state
      let pageState = stateSession.getPageState();
      let element = pageState.elements.get('#form-input');
      expect(element?.value).toBe('initial');

      // Update value
      await stateSession.typeInElement('#form-input', 'updated value');

      // Check updated state
      pageState = stateSession.getPageState();
      element = pageState.elements.get('#form-input');
      expect(element?.value).toBe('updated value');

      // Value should persist
      await stateSession.clickElement('#form-input');
      pageState = stateSession.getPageState();
      element = pageState.elements.get('#form-input');
      expect(element?.value).toBe('updated value');
    });
  });

  describe('Performance and Resource Validation', () => {
    it('should handle high-volume operations efficiently', async () => {
      const fastSession = createMockSessionForTesting('volume-test', {
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 1,
          useRealisticDelays: false,
        },
      });

      await fastSession.launch();

      const operationCount = 1000;
      const startTime = Date.now();

      const operations = Array.from({ length: operationCount }, (_, i) =>
        fastSession.elementExists(`#element-${i}`)
      );

      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;

      // All operations should succeed
      expect(results.every(r => r.success)).toBe(true);

      // Should complete quickly (less than 1 second for 1000 operations)
      expect(duration).toBeLessThan(1000);

      // All operations should be tracked
      const history = fastSession.getOperationHistory();
      expect(history).toHaveLength(operationCount + 1); // +1 for launch
    });

    it('should manage memory efficiently with large scenarios', () => {
      const largeScenario = createMockScenario();

      // Add many URL behaviors
      for (let i = 0; i < 100; i++) {
        largeScenario
          .forUrl(`https://site${i}.example.com`)
            .loadTime(Math.floor(Math.random() * 1000))
            .withTitle(`Site ${i}`)
          .and();
      }

      // Add many element behaviors
      for (let i = 0; i < 200; i++) {
        largeScenario
          .forElement(`#element-${i}`)
            .exists()
            .visible()
            .enabled()
            .withText(`Element ${i}`)
          .and();
      }

      const scenario = largeScenario.build();

      expect(Object.keys(scenario.urlBehaviors || {})).toHaveLength(100);
      expect(Object.keys(scenario.elementBehaviors || {})).toHaveLength(200);

      // Should create session without memory issues
      const session = createMockBrowserSession({}, scenario);
      expect(session).toBeDefined();
      expect(session.getConfig().scenarioConfig).toBeDefined();
    });

    it('should handle rapid session creation and cleanup', async () => {
      const manager = createMockBrowserManager({ maxInstances: 10 });
      await manager.initialize();

      const sessions: MockBrowserSession[] = [];

      // Create many sessions quickly
      for (let i = 0; i < 5; i++) {
        const result = await manager.createSession();
        expect(result.success).toBe(true);
        sessions.push(result.data!);
      }

      expect(manager.getActiveSessionCount()).toBe(5);

      // Clean up all sessions
      for (const session of sessions) {
        const result = await manager.closeSession(session);
        expect(result.success).toBe(true);
      }

      expect(manager.getActiveSessionCount()).toBe(0);
    });
  });

  describe('Configuration Validation', () => {
    it('should handle all valid browser type configurations', () => {
      const browserTypes = ['chromium', 'firefox', 'webkit'] as const;

      browserTypes.forEach(browserType => {
        const session = createMockBrowserSession({ browserType });
        expect(session.getConfig().browserType).toBe(browserType);
      });
    });

    it('should handle viewport configurations correctly', () => {
      const viewports = [
        { width: 800, height: 600 },
        { width: 1920, height: 1080 },
        { width: 375, height: 667 }, // iPhone
        { width: 768, height: 1024 }, // iPad
      ];

      viewports.forEach(viewport => {
        const session = createMockBrowserSession({ viewport });
        expect(session.getConfig().viewport).toEqual(viewport);
      });
    });

    it('should validate mock behavior configurations', () => {
      const configs: MockBehaviorConfig[] = [
        {
          defaultSuccess: true,
          defaultDelay: 0,
          useRealisticDelays: false,
        },
        {
          defaultSuccess: false,
          defaultDelay: 1000,
          failureRate: 0.5,
          useRealisticDelays: true,
        },
        {
          defaultSuccess: true,
          defaultDelay: 200,
          failureRate: 0.1,
          useRealisticDelays: false,
        },
      ];

      configs.forEach(mockConfig => {
        const session = createMockBrowserSession({ mockConfig });
        expect(session.getConfig().mockConfig).toMatchObject(mockConfig);
      });
    });

    it('should merge configurations properly', () => {
      const baseConfig: Partial<MockBrowserSessionConfig> = {
        browserType: 'firefox',
        headless: false,
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 100,
          useRealisticDelays: false,
        },
      };

      const overrideConfig: Partial<MockBrowserSessionConfig> = {
        browserType: 'chromium',
        mockConfig: {
          defaultDelay: 200,
        },
      };

      const session = createMockBrowserSession({
        ...baseConfig,
        ...overrideConfig,
        mockConfig: {
          ...baseConfig.mockConfig,
          ...overrideConfig.mockConfig,
        },
      });

      const finalConfig = session.getConfig();
      expect(finalConfig.browserType).toBe('chromium');
      expect(finalConfig.headless).toBe(false);
      expect(finalConfig.mockConfig.defaultSuccess).toBe(true);
      expect(finalConfig.mockConfig.defaultDelay).toBe(200);
    });
  });

  describe('Event System Validation', () => {
    it('should emit all expected events with correct data', async () => {
      const events: any[] = [];

      session.on('operation', (operation) => {
        events.push({ type: 'operation', data: operation });
      });

      session.on('navigation', (result) => {
        events.push({ type: 'navigation', data: result });
      });

      session.on('elementInteraction', (selector, action, success) => {
        events.push({ type: 'elementInteraction', data: { selector, action, success } });
      });

      session.on('screenshot', (options, result) => {
        events.push({ type: 'screenshot', data: { options, result } });
      });

      session.on('stateChange', (state) => {
        events.push({ type: 'stateChange', data: state });
      });

      // Perform operations that should emit events
      await session.launch();
      await session.navigate('https://example.com');
      await session.clickElement('#button');
      await session.typeInElement('#input', 'text');
      await session.captureScreenshot();

      // Verify events were emitted
      const eventTypes = events.map(e => e.type);
      expect(eventTypes).toContain('operation');
      expect(eventTypes).toContain('navigation');
      expect(eventTypes).toContain('elementInteraction');
      expect(eventTypes).toContain('screenshot');
      expect(eventTypes).toContain('stateChange');

      // Verify event data structure
      events.forEach(event => {
        expect(event.type).toBeDefined();
        expect(event.data).toBeDefined();
      });
    });

    it('should handle event listeners correctly', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      session.on('operation', listener1);
      session.on('operation', listener2);

      // Both listeners should be registered
      expect(session.listenerCount('operation')).toBe(2);

      session.off('operation', listener1);

      // Only one listener should remain
      expect(session.listenerCount('operation')).toBe(1);

      session.removeAllListeners('operation');

      // No listeners should remain
      expect(session.listenerCount('operation')).toBe(0);
    });
  });

  afterEach(() => {
    // Cleanup
    session.removeAllListeners();
    manager.removeAllListeners();
  });
});