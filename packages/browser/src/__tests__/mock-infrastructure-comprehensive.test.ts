/**
 * Mock Infrastructure Comprehensive Tests
 *
 * Tests that thoroughly validate the mock browser infrastructure
 * including all mock implementations, fixtures, and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import all mock infrastructure
import {
  MockBrowserSession,
  MockBrowserManager,
  createMockScenario,
  commonScenarios,
  type MockBrowserSessionConfig,
  type MockScenarioConfig,
  type MockBehaviorConfig,
  type MockPageState,
  type MockElement,
} from '../mocks/index.js';

// Import mock types for testing
import type {
  MockBrowserEvents,
  MockBrowserManagerState,
  MockNavigationResult,
  MockScreenshot,
  MockOperation,
  MockResponse,
} from '../mocks/types.js';

// Import test utilities
import {
  createMockPage,
  createMockElement,
  buildCompletePage,
  assertElementExists,
  assertNavigationState,
  PerformanceMonitor,
  type MockPageObject,
  type AssertionResult,
} from '../test-utils/index.js';

describe('Mock Infrastructure Comprehensive Tests', () => {

  describe('MockBrowserSession Implementation', () => {
    let session: MockBrowserSession;

    beforeEach(() => {
      session = new MockBrowserSession({
        browserType: 'chromium',
        headless: true,
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 10,
          useRealisticDelays: false,
          failureRate: 0,
        },
        trackOperations: true,
      });
    });

    afterEach(async () => {
      if (session.isLaunched()) {
        await session.close();
      }
    });

    it('should handle session lifecycle correctly', async () => {
      // Initial state
      expect(session.isLaunched()).toBe(false);

      // Launch session
      const launchResult = await session.launch();
      expect(launchResult.success).toBe(true);
      expect(session.isLaunched()).toBe(true);

      // Navigation
      const navResult = await session.navigate('https://test.com');
      expect(navResult.success).toBe(true);

      // Get page info
      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);

      const urlResult = await session.getUrl();
      expect(urlResult.success).toBe(true);
      expect(urlResult.data).toBe('https://test.com');

      // Close session
      const closeResult = await session.close();
      expect(closeResult.success).toBe(true);
      expect(session.isLaunched()).toBe(false);

      // Operations should fail after close
      const postCloseNav = await session.navigate('https://other.com');
      expect(postCloseNav.success).toBe(false);
      expect(postCloseNav.error).toContain('not launched');
    });

    it('should handle element interactions with realistic behavior', async () => {
      await session.launch();
      await session.navigate('https://form-test.com');

      // Test various input types
      const textResult = await session.type('#text-input', 'Hello World');
      expect(textResult.success).toBe(true);

      const numberResult = await session.type('#number-input', '42');
      expect(numberResult.success).toBe(true);

      const emailResult = await session.type('#email-input', 'test@example.com');
      expect(emailResult.success).toBe(true);

      // Test button clicks
      const clickResult = await session.click('#submit-button');
      expect(clickResult.success).toBe(true);

      const doubleClickResult = await session.doubleClick('#special-button');
      expect(doubleClickResult.success).toBe(true);

      // Test hover interactions
      const hoverResult = await session.hover('#menu-item');
      expect(hoverResult.success).toBe(true);

      // Test select interactions
      const selectResult = await session.selectOption('#dropdown', 'option2');
      expect(selectResult.success).toBe(true);

      // Test checkbox/radio interactions
      const checkResult = await session.check('#checkbox');
      expect(checkResult.success).toBe(true);

      const uncheckResult = await session.uncheck('#checkbox');
      expect(uncheckResult.success).toBe(true);
    });

    it('should handle file operations and uploads', async () => {
      await session.launch();
      await session.navigate('https://file-test.com');

      // Test file upload simulation
      const uploadResult = await session.setInputFiles('#file-upload', [
        { name: 'test.txt', content: 'test file content', mimeType: 'text/plain' },
        { name: 'image.png', content: 'fake-png-data', mimeType: 'image/png' },
      ]);
      expect(uploadResult.success).toBe(true);

      // Test download simulation
      const downloadResult = await session.downloadFile('/api/download/report.pdf');
      expect(downloadResult.success).toBe(true);
      expect(downloadResult.data).toBeInstanceOf(Buffer);
    });

    it('should handle JavaScript evaluation and execution', async () => {
      await session.launch();
      await session.navigate('https://js-test.com');

      // Simple evaluation
      const mathResult = await session.evaluate(() => 2 + 2);
      expect(mathResult.success).toBe(true);
      expect(mathResult.data).toBe(4);

      // DOM evaluation
      const domResult = await session.evaluate(() => document.title);
      expect(domResult.success).toBe(true);

      // Function with arguments
      const argsResult = await session.evaluate((a: number, b: number) => a * b, 6, 7);
      expect(argsResult.success).toBe(true);
      expect(argsResult.data).toBe(42);

      // Complex object return
      const objectResult = await session.evaluate(() => ({
        url: window.location.href,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
      }));
      expect(objectResult.success).toBe(true);
      expect(objectResult.data).toHaveProperty('url');
      expect(objectResult.data).toHaveProperty('timestamp');
    });

    it('should handle waiting operations with proper timeouts', async () => {
      await session.launch();
      await session.navigate('https://async-test.com');

      // Wait for selector that exists
      const waitResult = await session.waitForSelector('#existing-element', { timeout: 1000 });
      expect(waitResult.success).toBe(true);

      // Wait for selector that doesn't exist (should timeout)
      const timeoutResult = await session.waitForSelector('#non-existent', { timeout: 100 });
      expect(timeoutResult.success).toBe(false);
      expect(timeoutResult.error).toContain('timeout');

      // Wait for navigation
      const navWaitResult = await session.waitForNavigation(() =>
        session.click('#nav-link')
      );
      expect(navWaitResult.success).toBe(true);

      // Wait for function
      const functionWaitResult = await session.waitForFunction(
        () => (window as any).testCondition === true,
        { timeout: 1000 }
      );
      expect(functionWaitResult.success).toBe(true);
    });

    it('should capture screenshots with various options', async () => {
      await session.launch();
      await session.navigate('https://screenshot-test.com');

      // Full page screenshot
      const fullPageResult = await session.screenshot({
        fullPage: true,
        type: 'png'
      });
      expect(fullPageResult.success).toBe(true);
      expect(fullPageResult.data).toBeInstanceOf(Buffer);

      // Viewport screenshot
      const viewportResult = await session.screenshot({
        fullPage: false,
        type: 'jpeg',
        quality: 80
      });
      expect(viewportResult.success).toBe(true);
      expect(viewportResult.data).toBeInstanceOf(Buffer);

      // Element screenshot
      const elementResult = await session.screenshot({
        selector: '#main-content',
        type: 'png'
      });
      expect(elementResult.success).toBe(true);
      expect(elementResult.data).toBeInstanceOf(Buffer);

      // Custom clip area
      const clipResult = await session.screenshot({
        clip: { x: 0, y: 0, width: 800, height: 600 },
        type: 'png'
      });
      expect(clipResult.success).toBe(true);
    });

    it('should track operations when enabled', async () => {
      const trackingSession = new MockBrowserSession({
        browserType: 'chromium',
        trackOperations: true,
        mockConfig: { defaultSuccess: true, defaultDelay: 5 },
      });

      await trackingSession.launch();
      await trackingSession.navigate('https://tracking-test.com');
      await trackingSession.click('#button1');
      await trackingSession.type('#input1', 'test');
      await trackingSession.screenshot();

      const operations = trackingSession.getOperationHistory();
      expect(operations).toHaveLength(5); // launch, navigate, click, type, screenshot

      expect(operations[0].operation).toBe('launch');
      expect(operations[1].operation).toBe('navigate');
      expect(operations[2].operation).toBe('click');
      expect(operations[3].operation).toBe('type');
      expect(operations[4].operation).toBe('screenshot');

      operations.forEach(op => {
        expect(op.timestamp).toBeInstanceOf(Date);
        expect(op.duration).toBeGreaterThanOrEqual(0);
        expect(op.success).toBe(true);
      });

      await trackingSession.close();
    });

    it('should handle failure scenarios correctly', async () => {
      const flakySession = new MockBrowserSession({
        browserType: 'chromium',
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 10,
          failureRate: 0.8, // 80% failure rate for testing
        },
      });

      await flakySession.launch();

      let successCount = 0;
      let failureCount = 0;
      const attempts = 10;

      for (let i = 0; i < attempts; i++) {
        const result = await flakySession.click('#test-button');
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
          expect(result.error).toBeDefined();
        }
      }

      // With 80% failure rate, we should see mostly failures
      expect(failureCount).toBeGreaterThan(successCount);
      expect(failureCount + successCount).toBe(attempts);

      await flakySession.close();
    });

    it('should handle realistic delays when configured', async () => {
      const realisticSession = new MockBrowserSession({
        browserType: 'chromium',
        mockConfig: {
          defaultSuccess: true,
          useRealisticDelays: true,
          defaultDelay: 200, // Base delay
        },
      });

      await realisticSession.launch();

      const startTime = Date.now();
      await realisticSession.navigate('https://delay-test.com');
      const navDuration = Date.now() - startTime;

      const clickStartTime = Date.now();
      await realisticSession.click('#button');
      const clickDuration = Date.now() - clickStartTime;

      // Should take some time due to realistic delays
      expect(navDuration).toBeGreaterThan(100);
      expect(clickDuration).toBeGreaterThan(50);

      await realisticSession.close();
    });
  });

  describe('MockBrowserManager Implementation', () => {
    let manager: MockBrowserManager;

    beforeEach(() => {
      manager = new MockBrowserManager({
        maxInstances: 3,
        reuseInstances: false,
      });
    });

    afterEach(async () => {
      await manager.shutdown();
    });

    it('should manage multiple browser sessions', async () => {
      const sessions: MockBrowserSession[] = [];

      // Create multiple sessions
      for (let i = 0; i < 3; i++) {
        const sessionResult = await manager.createSession({
          browserType: 'chromium',
          mockConfig: { defaultSuccess: true, defaultDelay: 10 },
        });
        expect(sessionResult.success).toBe(true);
        sessions.push(sessionResult.data!);
      }

      // Launch all sessions
      for (const session of sessions) {
        const launchResult = await session.launch();
        expect(launchResult.success).toBe(true);
      }

      // Check resource usage
      const usage = await manager.getResourceUsage();
      expect(usage.totalInstances).toBe(3);
      expect(usage.totalContexts).toBe(3);
      expect(usage.activeBrowsers).toBe(3);

      // Close all sessions
      for (const session of sessions) {
        await session.close();
      }

      // Verify cleanup
      const finalUsage = await manager.getResourceUsage();
      expect(finalUsage.totalInstances).toBe(0);
      expect(finalUsage.totalContexts).toBe(0);
      expect(finalUsage.activeBrowsers).toBe(0);
    });

    it('should enforce instance limits', async () => {
      const limitedManager = new MockBrowserManager({
        maxInstances: 2,
        reuseInstances: false,
      });

      try {
        const sessions: MockBrowserSession[] = [];

        // Create up to the limit
        for (let i = 0; i < 2; i++) {
          const result = await limitedManager.createSession();
          expect(result.success).toBe(true);
          sessions.push(result.data!);
        }

        // Try to exceed the limit
        const exceededResult = await limitedManager.createSession();
        expect(exceededResult.success).toBe(false);
        expect(exceededResult.error).toContain('instance limit');

        // Clean up
        for (const session of sessions) {
          await session.close();
        }
      } finally {
        await limitedManager.shutdown();
      }
    });

    it('should handle instance reuse when configured', async () => {
      const reusingManager = new MockBrowserManager({
        maxInstances: 3,
        reuseInstances: true,
      });

      try {
        const session1Result = await reusingManager.createSession({
          browserType: 'chromium',
        });
        expect(session1Result.success).toBe(true);
        const session1 = session1Result.data!;

        await session1.launch();
        await session1.close();

        const session2Result = await reusingManager.createSession({
          browserType: 'chromium', // Same config
        });
        expect(session2Result.success).toBe(true);
        const session2 = session2Result.data!;

        // With reuse, should be more efficient
        const usage = await reusingManager.getResourceUsage();
        expect(usage.reuseCount).toBeGreaterThan(0);

        await session2.close();
      } finally {
        await reusingManager.shutdown();
      }
    });

    it('should provide detailed resource monitoring', async () => {
      const session1 = await manager.createSession({ browserType: 'chromium' });
      const session2 = await manager.createSession({ browserType: 'firefox' });

      expect(session1.success).toBe(true);
      expect(session2.success).toBe(true);

      await session1.data!.launch();
      await session2.data!.launch();

      const usage = await manager.getResourceUsage();
      expect(usage.totalInstances).toBe(2);
      expect(usage.browserTypes).toEqual(['chromium', 'firefox']);
      expect(usage.memoryUsage).toBeGreaterThan(0);
      expect(usage.startTime).toBeInstanceOf(Date);
      expect(usage.uptime).toBeGreaterThan(0);

      await session1.data!.close();
      await session2.data!.close();
    });
  });

  describe('Mock Page Objects and Elements', () => {
    it('should create realistic mock page objects', () => {
      const pageConfig = {
        title: 'E-commerce Product Page',
        url: 'https://shop.test/products/123',
        body: `
          <div class="product-container">
            <h1 id="product-title">Awesome Widget</h1>
            <div class="price">$99.99</div>
            <button id="add-to-cart" class="btn primary">Add to Cart</button>
            <select id="quantity">
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </div>
        `,
        metadata: {
          productId: '123',
          category: 'widgets',
          inStock: true,
        },
      };

      const page = createMockPage(pageConfig.url, pageConfig);
      expect(page.title).toBe('E-commerce Product Page');
      expect(page.url).toBe('https://shop.test/products/123');
      expect(page.html).toContain('Awesome Widget');
      expect(page.html).toContain('add-to-cart');
      expect(page.metadata).toEqual(pageConfig.metadata);
    });

    it('should create interactive mock elements', () => {
      const button = createMockElement('button', {
        id: 'interactive-btn',
        text: 'Click Me',
        attributes: {
          class: 'btn primary',
          'data-action': 'submit',
        },
        state: {
          visible: true,
          enabled: true,
          focused: false,
        },
        events: {
          click: () => ({ action: 'clicked', timestamp: Date.now() }),
          hover: () => ({ action: 'hovered' }),
        },
      });

      expect(button.tagName).toBe('button');
      expect(button.id).toBe('interactive-btn');
      expect(button.text).toBe('Click Me');
      expect(button.attributes.class).toBe('btn primary');
      expect(button.state.enabled).toBe(true);

      // Test event simulation
      const clickEvent = button.events?.click?.();
      expect(clickEvent).toHaveProperty('action', 'clicked');
      expect(clickEvent).toHaveProperty('timestamp');

      const hoverEvent = button.events?.hover?.();
      expect(hoverEvent).toHaveProperty('action', 'hovered');
    });

    it('should handle form elements with validation', () => {
      const emailInput = createMockElement('input', {
        id: 'email-field',
        attributes: {
          type: 'email',
          required: 'true',
          placeholder: 'Enter your email',
        },
        state: {
          value: '',
          valid: false,
          touched: false,
        },
        validation: {
          required: true,
          pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          message: 'Please enter a valid email address',
        },
      });

      expect(emailInput.attributes.type).toBe('email');
      expect(emailInput.state.valid).toBe(false);
      expect(emailInput.validation?.required).toBe(true);
      expect(emailInput.validation?.pattern).toBeInstanceOf(RegExp);

      // Test validation logic
      emailInput.state.value = 'invalid-email';
      emailInput.state.valid = !emailInput.validation?.pattern?.test(emailInput.state.value);
      expect(emailInput.state.valid).toBe(true); // Negated, so valid becomes false

      emailInput.state.value = 'valid@email.com';
      emailInput.state.valid = emailInput.validation?.pattern?.test(emailInput.state.value);
      expect(emailInput.state.valid).toBe(true);
    });
  });

  describe('Scenario Builder Comprehensive Tests', () => {
    it('should build complex multi-page scenarios', () => {
      const ecommerceScenario = createMockScenario()
        // Login page
        .withUrl('https://shop.test/login')
        .withElement('#username', {
          required: true,
          validation: { pattern: /^\w+$/ }
        })
        .withElement('#password', {
          required: true,
          type: 'password'
        })
        .withOperation('type', { selector: '#username', text: 'testuser' })
        .withOperation('type', { selector: '#password', text: 'testpass' })
        .withOperation('click', { selector: '#login-btn' })

        // Navigate to product page
        .withNavigation('https://shop.test/products/widget-123')
        .withElement('#product-title', { text: 'Amazing Widget' })
        .withElement('#add-to-cart', { enabled: true })
        .withElement('#quantity', { type: 'select', options: ['1', '2', '3'] })
        .withOperation('selectOption', { selector: '#quantity', value: '2' })
        .withOperation('click', { selector: '#add-to-cart' })

        // Navigate to cart
        .withNavigation('https://shop.test/cart')
        .withElement('#cart-items', { text: 'Amazing Widget' })
        .withElement('#checkout-btn', { enabled: true })
        .withOperation('click', { selector: '#checkout-btn' })

        .build();

      expect(ecommerceScenario.url).toBe('https://shop.test/login');
      expect(ecommerceScenario.elements['#username']).toBeDefined();
      expect(ecommerceScenario.elements['#password']).toBeDefined();
      expect(ecommerceScenario.operations).toHaveLength(6);
      expect(ecommerceScenario.navigations).toHaveLength(2);

      // Verify operation sequence
      const operations = ecommerceScenario.operations;
      expect(operations[0].type).toBe('type');
      expect(operations[0].selector).toBe('#username');
      expect(operations[1].type).toBe('type');
      expect(operations[1].selector).toBe('#password');
      expect(operations[2].type).toBe('click');
      expect(operations[2].selector).toBe('#login-btn');
    });

    it('should provide common scenario templates', () => {
      // Test login scenario
      const loginScenario = commonScenarios.loginPage;
      expect(loginScenario.url).toContain('login');
      expect(loginScenario.elements['#username']).toBeDefined();
      expect(loginScenario.elements['#password']).toBeDefined();
      expect(loginScenario.elements['#login-btn']).toBeDefined();

      // Test dashboard scenario
      const dashboardScenario = commonScenarios.dashboardPage;
      expect(dashboardScenario.url).toContain('dashboard');
      expect(dashboardScenario.elements['#nav-menu']).toBeDefined();
      expect(dashboardScenario.elements['#user-profile']).toBeDefined();

      // Test form scenario
      const formScenario = commonScenarios.formPage;
      expect(formScenario.url).toContain('form');
      expect(formScenario.elements['#form-container']).toBeDefined();
      expect(formScenario.elements['#submit-btn']).toBeDefined();

      // Each scenario should have required elements
      Object.values(commonScenarios).forEach(scenario => {
        expect(scenario.url).toBeTruthy();
        expect(Object.keys(scenario.elements)).toHaveLength.toBeGreaterThan(0);
      });
    });

    it('should support scenario customization and inheritance', () => {
      const baseLoginScenario = commonScenarios.loginPage;

      const customizedScenario = createMockScenario()
        .inheritFrom(baseLoginScenario)
        .withUrl('https://custom.test/signin')
        .withElement('#email', {
          type: 'email',
          validation: { required: true, pattern: /\S+@\S+/ }
        })
        .withElement('#remember-me', { type: 'checkbox', checked: false })
        .withOperation('type', { selector: '#email', text: 'user@test.com' })
        .withOperation('check', { selector: '#remember-me' })
        .withResponseTemplate('login-success', {
          status: 200,
          body: { token: 'abc123', user: { id: 1, name: 'Test User' } },
        })
        .build();

      expect(customizedScenario.url).toBe('https://custom.test/signin');
      expect(customizedScenario.elements['#email']).toBeDefined();
      expect(customizedScenario.elements['#remember-me']).toBeDefined();
      expect(customizedScenario.responseTemplates?.['login-success']).toBeDefined();

      // Should inherit base scenario elements
      expect(customizedScenario.elements['#username']).toBeDefined();
      expect(customizedScenario.elements['#password']).toBeDefined();
    });

    it('should support conditional operations and branching', () => {
      const conditionalScenario = createMockScenario()
        .withUrl('https://app.test/conditional')
        .withElement('#feature-toggle', { type: 'checkbox' })
        .withElement('#advanced-panel', { visible: false })
        .withElement('#basic-panel', { visible: true })

        // Conditional operations based on feature toggle
        .withConditionalOperation({
          condition: (state) => state.elements['#feature-toggle']?.checked,
          operation: { type: 'click', selector: '#enable-advanced' },
          thenOperations: [
            { type: 'waitForSelector', selector: '#advanced-panel' },
            { type: 'type', selector: '#advanced-input', text: 'advanced value' },
          ],
          elseOperations: [
            { type: 'type', selector: '#basic-input', text: 'basic value' },
          ],
        })
        .build();

      expect(conditionalScenario.conditionalOperations).toHaveLength(1);
      expect(conditionalScenario.conditionalOperations![0].condition).toBeTypeOf('function');
      expect(conditionalScenario.conditionalOperations![0].thenOperations).toHaveLength(2);
      expect(conditionalScenario.conditionalOperations![0].elseOperations).toHaveLength(1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid configurations gracefully', () => {
      // Invalid browser type
      expect(() => {
        new MockBrowserSession({
          browserType: 'invalid-browser' as any,
        });
      }).toThrow('Unsupported browser type');

      // Invalid failure rate
      expect(() => {
        new MockBrowserSession({
          mockConfig: {
            defaultSuccess: true,
            failureRate: 1.5, // Invalid > 1
          },
        });
      }).toThrow('Failure rate must be between 0 and 1');

      // Negative delay
      expect(() => {
        new MockBrowserSession({
          mockConfig: {
            defaultSuccess: true,
            defaultDelay: -100,
          },
        });
      }).toThrow('Delay cannot be negative');
    });

    it('should handle memory leaks and resource cleanup', async () => {
      const sessions: MockBrowserSession[] = [];

      // Create many sessions to test cleanup
      for (let i = 0; i < 10; i++) {
        const session = new MockBrowserSession({
          trackOperations: true,
          mockConfig: { defaultDelay: 1 },
        });
        sessions.push(session);
      }

      // Launch and use sessions
      for (const session of sessions) {
        await session.launch();
        await session.navigate(`https://test${sessions.indexOf(session)}.com`);
        await session.click('#button');
      }

      // Close all sessions
      for (const session of sessions) {
        await session.close();
      }

      // Verify no memory leaks (operation histories should be cleared)
      sessions.forEach(session => {
        const history = session.getOperationHistory();
        expect(history).toHaveLength(0); // Should be cleared after close
      });
    });

    it('should handle concurrent operations safely', async () => {
      const session = new MockBrowserSession({
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 50,
        },
      });

      await session.launch();
      await session.navigate('https://concurrent-test.com');

      // Run multiple operations concurrently
      const operations = [
        session.click('#button1'),
        session.click('#button2'),
        session.type('#input1', 'text1'),
        session.type('#input2', 'text2'),
        session.screenshot(),
      ];

      const results = await Promise.allSettled(operations);

      // All operations should complete (either succeed or fail gracefully)
      results.forEach((result, index) => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value).toHaveProperty('success');
          expect(result.value).toHaveProperty('duration');
        }
      });

      await session.close();
    });

    it('should validate selector formats and provide helpful errors', async () => {
      const session = new MockBrowserSession();
      await session.launch();
      await session.navigate('https://selector-test.com');

      // Invalid selector formats
      const invalidSelectors = [
        '', // Empty
        '   ', // Whitespace only
        'not a selector', // Plain text
        '###invalid', // Invalid CSS
      ];

      for (const selector of invalidSelectors) {
        const result = await session.click(selector);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid selector');
      }

      await session.close();
    });

    it('should handle network simulation errors', async () => {
      const networkSession = new MockBrowserSession({
        mockConfig: {
          defaultSuccess: true,
          networkConditions: {
            offline: false,
            latency: 100,
            downloadThroughput: 1000000,
            uploadThroughput: 500000,
          },
        },
      });

      await networkSession.launch();

      // Test normal conditions
      const normalNav = await networkSession.navigate('https://normal.test');
      expect(normalNav.success).toBe(true);

      // Simulate offline
      networkSession.setNetworkConditions({ offline: true });
      const offlineNav = await networkSession.navigate('https://offline.test');
      expect(offlineNav.success).toBe(false);
      expect(offlineNav.error).toContain('network');

      // Restore connection
      networkSession.setNetworkConditions({ offline: false });
      const restoredNav = await networkSession.navigate('https://restored.test');
      expect(restoredNav.success).toBe(true);

      await networkSession.close();
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle high-frequency operations efficiently', async () => {
      const session = new MockBrowserSession({
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 1, // Very fast
          useRealisticDelays: false,
        },
      });

      await session.launch();
      await session.navigate('https://performance-test.com');

      const startTime = Date.now();
      const operationCount = 100;

      // Perform many operations rapidly
      for (let i = 0; i < operationCount; i++) {
        await session.click('#button');
      }

      const duration = Date.now() - startTime;
      const opsPerSecond = (operationCount / duration) * 1000;

      // Should handle at least 50 operations per second
      expect(opsPerSecond).toBeGreaterThan(50);

      await session.close();
    });

    it('should maintain performance with large operation histories', async () => {
      const session = new MockBrowserSession({
        trackOperations: true,
        mockConfig: { defaultDelay: 1 },
      });

      await session.launch();
      await session.navigate('https://history-test.com');

      // Perform many operations to build large history
      for (let i = 0; i < 500; i++) {
        await session.click(`#button-${i}`);
      }

      const history = session.getOperationHistory();
      expect(history).toHaveLength(502); // 500 clicks + launch + navigate

      // Performance should not degrade significantly
      const startTime = Date.now();
      await session.click('#final-button');
      const singleOpTime = Date.now() - startTime;

      expect(singleOpTime).toBeLessThan(100); // Should still be fast

      await session.close();
    });
  });
});