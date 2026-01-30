/**
 * @apexcli/browser/mocks - Integration Tests
 *
 * Tests for integration between mock components and convenience functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createMockBrowserManager,
  createMockBrowserSession,
  launchMockBrowser,
  createMockSessionForTesting,
  createUnreliableMockSession,
  createMockScenario,
  commonScenarios,
} from '../index.js';

describe('Mock Integration Tests', () => {
  describe('convenience functions', () => {
    it('should create mock browser manager with default config', () => {
      const manager = createMockBrowserManager();

      expect(manager).toBeDefined();
      expect(manager.getConfig().maxInstances).toBe(5);
      expect(manager.isInitialized()).toBe(false);
    });

    it('should create mock browser session with default config', () => {
      const session = createMockBrowserSession();

      expect(session).toBeDefined();
      expect(session.getConfig().browserType).toBe('chromium');
      expect(session.getConfig().mockConfig.defaultSuccess).toBe(true);
    });

    it('should launch mock browser successfully', async () => {
      const result = await launchMockBrowser({
        browserType: 'firefox',
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 10,
          useRealisticDelays: false,
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      const session = result.data!;
      expect(session.getConfig().browserType).toBe('firefox');

      // Verify session is launched
      const pageState = session.getPageState();
      expect(pageState).toBeDefined();
    });

    it('should create testing session with fast config', () => {
      const session = createMockSessionForTesting('test-case-1');

      const config = session.getConfig();
      expect(config.mockConfig.defaultDelay).toBe(10);
      expect(config.trackOperations).toBe(true);
      expect(config.mockConfig.useRealisticDelays).toBe(false);
    });

    it('should create unreliable session with failure rate', () => {
      const session = createUnreliableMockSession(0.5);

      const config = session.getConfig();
      expect(config.mockConfig.failureRate).toBe(0.5);
      expect(config.mockConfig.useRealisticDelays).toBe(true);
    });

    it('should clamp failure rate to valid range', () => {
      const session1 = createUnreliableMockSession(-0.1);
      const session2 = createUnreliableMockSession(1.5);

      expect(session1.getConfig().mockConfig.failureRate).toBe(0);
      expect(session2.getConfig().mockConfig.failureRate).toBe(1);
    });
  });

  describe('end-to-end workflows', () => {
    it('should complete login workflow with scenario', async () => {
      // Create login scenario
      const scenario = createMockScenario()
        .forUrl('https://app.test.com/login')
          .loadTime(500)
          .withTitle('Login - Test App')
        .and()
        .forElement('#username')
          .exists()
          .visible()
          .enabled()
        .and()
        .forElement('#password')
          .exists()
          .visible()
          .enabled()
        .and()
        .forElement('#submit')
          .exists()
          .visible()
          .enabled()
          .withText('Login')
        .and()
        .build();

      const result = await launchMockBrowser({
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 50,
          useRealisticDelays: false,
        },
      }, scenario);

      expect(result.success).toBe(true);

      const session = result.data!;

      // Perform login workflow
      const navResult = await session.navigate('https://app.test.com/login');
      expect(navResult.success).toBe(true);
      expect(navResult.data?.title).toBe('Login - Test App');

      const usernameResult = await session.typeInElement('#username', 'testuser');
      expect(usernameResult.success).toBe(true);

      const passwordResult = await session.typeInElement('#password', 'password123');
      expect(passwordResult.success).toBe(true);

      const submitResult = await session.clickElement('#submit');
      expect(submitResult.success).toBe(true);

      // Verify operations were tracked
      const operations = session.getOperationHistory();
      expect(operations.map(op => op.name)).toEqual([
        'launch',
        'navigate',
        'typeInElement',
        'typeInElement',
        'clickElement',
      ]);
    });

    it('should handle form interaction workflow', async () => {
      const scenario = commonScenarios.formInteraction('#contact-form');

      const session = createMockBrowserSession({
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 20,
          useRealisticDelays: false,
        },
      }, scenario);

      await session.launch();
      await session.navigate('https://contact.example.com');

      // Test form interactions
      const inputExists = await session.elementExists('#contact-form input');
      expect(inputExists.data).toBe(true);

      const buttonText = await session.getElementText('#contact-form button');
      expect(buttonText.data).toBe('Submit');

      const typeResult = await session.typeInElement('#contact-form input', 'test message');
      expect(typeResult.success).toBe(true);

      const clickResult = await session.clickElement('#contact-form button');
      expect(clickResult.success).toBe(true);
    });

    it('should handle error scenarios gracefully', async () => {
      // Create scenario with navigation failure
      const scenario = commonScenarios.navigationFailure('Server unreachable');

      const session = createMockBrowserSession({}, scenario);
      await session.launch();

      const navResult = await session.navigate('https://unreachable.com');
      expect(navResult.success).toBe(false);
      expect(navResult.error).toBe('Server unreachable');

      // Other operations should still work
      const screenshotResult = await session.captureScreenshot();
      expect(screenshotResult.success).toBe(true);
    });

    it('should handle slow network conditions', async () => {
      const scenario = commonScenarios.slowNetwork();

      const session = createMockBrowserSession({}, scenario);
      await session.launch();

      const startTime = Date.now();
      const navResult = await session.navigate('https://example.com');
      const duration = Date.now() - startTime;

      expect(navResult.success).toBe(true);
      expect(duration).toBeGreaterThanOrEqual(3000);
    });
  });

  describe('event handling integration', () => {
    it('should emit and handle events across manager and session', async () => {
      const manager = createMockBrowserManager();

      const browserCreatedSpy = vi.fn();
      const contextCreatedSpy = vi.fn();
      manager.on('browserCreated', browserCreatedSpy);
      manager.on('contextCreated', contextCreatedSpy);

      const sessionResult = await manager.createSession();
      expect(sessionResult.success).toBe(true);

      const session = sessionResult.data!;

      const navigationSpy = vi.fn();
      const operationSpy = vi.fn();
      session.on('navigation', navigationSpy);
      session.on('operation', operationSpy);

      await session.launch();
      await session.navigate('https://example.com');

      // Verify manager events
      expect(browserCreatedSpy).toHaveBeenCalled();
      expect(contextCreatedSpy).toHaveBeenCalled();

      // Verify session events
      expect(navigationSpy).toHaveBeenCalled();
      expect(operationSpy).toHaveBeenCalled();
    });
  });

  describe('resource management integration', () => {
    it('should manage multiple sessions and track resources', async () => {
      const manager = createMockBrowserManager({
        maxInstances: 3,
      });

      const sessions = [];

      // Create multiple sessions
      for (let i = 0; i < 3; i++) {
        const result = await manager.createSession();
        expect(result.success).toBe(true);
        sessions.push(result.data!);
      }

      expect(manager.getActiveSessionCount()).toBe(3);

      // Check resource usage
      const resourceResult = await manager.checkResourceUsage();
      expect(resourceResult.success).toBe(true);
      expect(resourceResult.data!.memory).toBeGreaterThan(0);

      // Close all sessions
      for (const session of sessions) {
        const closeResult = await manager.closeSession(session);
        expect(closeResult.success).toBe(true);
      }

      expect(manager.getActiveSessionCount()).toBe(0);
    });
  });

  describe('scenario integration with real workflows', () => {
    it('should handle e-commerce checkout scenario', async () => {
      const scenario = createMockScenario()
        // Product page
        .forUrl('https://shop.example.com/product/123')
          .loadTime(800)
          .withTitle('Product - Example Shop')
        .and()
        .forElement('#add-to-cart')
          .exists()
          .visible()
          .enabled()
          .withText('Add to Cart')
        .and()
        // Cart page
        .forUrl('https://shop.example.com/cart')
          .loadTime(600)
          .withTitle('Shopping Cart')
        .and()
        .forElement('#checkout-button')
          .exists()
          .visible()
          .enabled()
          .withText('Proceed to Checkout')
        .and()
        // Checkout operations
        .forOperation('addToCart')
          .succeeds()
          .withDelay(300)
        .and()
        .forOperation('proceedToCheckout')
          .succeeds()
          .withDelay(500)
        .and()
        .build();

      const session = createMockBrowserSession({
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 100,
          useRealisticDelays: false,
        },
      }, scenario);

      await session.launch();

      // Product page interaction
      const productNavResult = await session.navigate('https://shop.example.com/product/123');
      expect(productNavResult.success).toBe(true);
      expect(productNavResult.data?.title).toBe('Product - Example Shop');

      const addToCartResult = await session.clickElement('#add-to-cart');
      expect(addToCartResult.success).toBe(true);

      // Cart page interaction
      const cartNavResult = await session.navigate('https://shop.example.com/cart');
      expect(cartNavResult.success).toBe(true);

      const checkoutResult = await session.clickElement('#checkout-button');
      expect(checkoutResult.success).toBe(true);

      // Verify complete workflow was tracked
      const operations = session.getOperationHistory();
      const operationNames = operations.map(op => op.name);

      expect(operationNames).toContain('launch');
      expect(operationNames).toContain('navigate');
      expect(operationNames).toContain('clickElement');
    });

    it('should simulate realistic testing conditions', async () => {
      // Create session optimized for testing
      const session = createMockSessionForTesting('checkout-test', {
        viewport: { width: 1920, height: 1080 },
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 5, // Very fast for testing
          useRealisticDelays: false,
        },
      });

      await session.launch();

      // Perform rapid operations typical in testing
      const operations = [
        () => session.navigate('https://test.app.com'),
        () => session.elementExists('#main-content'),
        () => session.clickElement('#nav-menu'),
        () => session.typeInElement('#search-input', 'test query'),
        () => session.captureScreenshot(),
        () => session.getElementText('#result-count'),
      ];

      const startTime = Date.now();
      const results = await Promise.all(operations.map(op => op()));
      const totalTime = Date.now() - startTime;

      // All operations should succeed quickly
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should complete very quickly with test configuration
      expect(totalTime).toBeLessThan(100);

      // Verify operation tracking
      const history = session.getOperationHistory();
      expect(history).toHaveLength(7); // launch + 6 operations
    });
  });
});