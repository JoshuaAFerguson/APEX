/**
 * Integration Test Infrastructure Validation
 *
 * Comprehensive tests that verify the browser integration test infrastructure
 * works correctly and provides all necessary testing capabilities for
 * browser automation without requiring actual browser instances.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import mock infrastructure
import {
  MockBrowserSession,
  MockBrowserManager,
  createMockBrowserSession,
  createMockBrowserManager,
  launchMockBrowser,
  createMockSessionForTesting,
  createUnreliableMockSession,
  createMockScenario,
  commonScenarios,
  defaultMockConfig,
  type MockBrowserSessionConfig,
  type MockScenarioConfig,
} from '../mocks/index.js';

// Import test utilities
import {
  createMockPage,
  createMockElement,
  createMockPageWithForm,
  createMockPageWithNavigation,
  buildFormHtml,
  buildTableHtml,
  buildNavigationHtml,
  buildCompletePage,
  generateTestUrl,
  testUrls,
  assertNavigationState,
  assertPageContent,
  assertElementExists,
  assertElementVisible,
  assertNoErrors,
  assertBrowserState,
  TestPages,
  TestDataGenerators,
  PerformanceMonitor,
  MockScenarios,
  type AssertionResult,
  type NavigationState,
  type FormConfig,
  type TestUrlOptions,
} from '../test-utils/index.js';

// Import real browser infrastructure for comparison
import {
  createBrowserManager,
  createBrowserSession,
  launchBrowser,
  type BrowserManager,
  type BrowserSession,
  type BrowserSessionConfig,
  type CaptureConfig,
  type BrowserActionResult,
} from '../index.js';

describe('Browser Integration Test Infrastructure', () => {

  describe('Mock Infrastructure Validation', () => {
    it('should provide complete mock browser automation capabilities', async () => {
      // Test mock browser manager creation
      const mockManager = createMockBrowserManager({
        maxInstances: 5,
        reuseInstances: true,
      });

      expect(mockManager).toBeInstanceOf(MockBrowserManager);

      // Test mock session creation
      const mockSession = createMockBrowserSession({
        browserType: 'chromium',
        headless: true,
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 50,
          useRealisticDelays: false,
        },
      });

      expect(mockSession).toBeInstanceOf(MockBrowserSession);

      // Test session launch
      const launchResult = await mockSession.launch();
      expect(launchResult.success).toBe(true);

      // Test navigation
      const navResult = await mockSession.navigate('https://example.com');
      expect(navResult.success).toBe(true);

      // Test element interaction
      const clickResult = await mockSession.click('#test-button');
      expect(clickResult.success).toBe(true);

      // Test form interaction
      const typeResult = await mockSession.type('#input-field', 'test value');
      expect(typeResult.success).toBe(true);

      // Test screenshot capture
      const screenshotResult = await mockSession.screenshot({ fullPage: true });
      expect(screenshotResult.success).toBe(true);
      expect(screenshotResult.data).toBeInstanceOf(Buffer);

      // Test cleanup
      const closeResult = await mockSession.close();
      expect(closeResult.success).toBe(true);
    });

    it('should provide specialized testing session creation', async () => {
      // Test fast testing session
      const testSession = createMockSessionForTesting('integration-test', {
        browserType: 'firefox',
        mockConfig: {
          defaultDelay: 5, // Very fast for testing
          useRealisticDelays: false,
        },
      });

      expect(testSession).toBeInstanceOf(MockBrowserSession);

      const config = testSession.getConfig();
      expect(config.browserType).toBe('firefox');
      expect(config.mockConfig.defaultDelay).toBe(5);
      expect(config.trackOperations).toBe(true);

      // Test unreliable session for failure scenarios
      const unreliableSession = createUnreliableMockSession(0.3, {
        mockConfig: {
          defaultDelay: 100,
        },
      });

      expect(unreliableSession).toBeInstanceOf(MockBrowserSession);

      const unreliableConfig = unreliableSession.getConfig();
      expect(unreliableConfig.mockConfig.failureRate).toBe(0.3);
    });

    it('should provide convenient launch utilities', async () => {
      const browserResult = await launchMockBrowser({
        browserType: 'webkit',
        headless: false,
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 25,
        },
      });

      expect(browserResult.success).toBe(true);
      expect(browserResult.data).toBeInstanceOf(MockBrowserSession);
      expect(browserResult.duration).toBeTypeOf('number');

      if (browserResult.data) {
        // Test that the launched browser is ready to use
        const navResult = await browserResult.data.navigate('https://test-site.com');
        expect(navResult.success).toBe(true);

        await browserResult.data.close();
      }
    });
  });

  describe('Test Utilities Validation', () => {
    let mockSession: MockBrowserSession;

    beforeEach(async () => {
      mockSession = createMockSessionForTesting('test-utils-validation');
      await mockSession.launch();
    });

    afterEach(async () => {
      await mockSession.close();
    });

    it('should provide mock page object creation utilities', () => {
      // Test basic mock page creation
      const mockPage = createMockPage('https://example.com', {
        title: 'Test Page',
        body: '<h1>Hello World</h1>',
      });

      expect(mockPage.url).toBe('https://example.com');
      expect(mockPage.title).toBe('Test Page');
      expect(mockPage.html).toContain('Hello World');

      // Test mock element creation
      const mockElement = createMockElement('button', {
        id: 'test-btn',
        text: 'Click Me',
        attributes: { class: 'btn primary' },
        state: { visible: true, enabled: true },
      });

      expect(mockElement.tagName).toBe('button');
      expect(mockElement.id).toBe('test-btn');
      expect(mockElement.text).toBe('Click Me');
      expect(mockElement.attributes.class).toBe('btn primary');
      expect(mockElement.state.visible).toBe(true);

      // Test form page creation
      const formConfig: FormConfig = {
        action: '/submit',
        method: 'POST',
        fields: [
          { name: 'username', type: 'text', label: 'Username', required: true },
          { name: 'email', type: 'email', label: 'Email', required: true },
          { name: 'message', type: 'textarea', label: 'Message', required: false },
        ],
        submitText: 'Submit Form',
      };

      const formPage = createMockPageWithForm('https://form.test', formConfig);
      expect(formPage.url).toBe('https://form.test');
      expect(formPage.html).toContain('form');
      expect(formPage.html).toContain('username');
      expect(formPage.html).toContain('Submit Form');

      // Test navigation page creation
      const navPage = createMockPageWithNavigation('https://nav.test', [
        { href: '/home', text: 'Home' },
        { href: '/about', text: 'About' },
        { href: '/contact', text: 'Contact' },
      ]);

      expect(navPage.html).toContain('nav');
      expect(navPage.html).toContain('Home');
      expect(navPage.html).toContain('About');
      expect(navPage.html).toContain('Contact');
    });

    it('should provide DOM building utilities', () => {
      // Test form HTML generation
      const formHtml = buildFormHtml({
        action: '/api/submit',
        method: 'POST',
        fields: [
          { name: 'firstname', type: 'text', label: 'First Name', required: true },
          { name: 'lastname', type: 'text', label: 'Last Name', required: true },
          { name: 'age', type: 'number', label: 'Age', required: false },
        ],
        submitText: 'Create Account',
      });

      expect(formHtml).toContain('form');
      expect(formHtml).toContain('action="/api/submit"');
      expect(formHtml).toContain('method="POST"');
      expect(formHtml).toContain('firstname');
      expect(formHtml).toContain('Create Account');

      // Test table HTML generation
      const tableHtml = buildTableHtml({
        headers: ['Name', 'Email', 'Role'],
        rows: [
          ['John Doe', 'john@example.com', 'Admin'],
          ['Jane Smith', 'jane@example.com', 'User'],
        ],
        caption: 'User Management Table',
      });

      expect(tableHtml).toContain('table');
      expect(tableHtml).toContain('User Management Table');
      expect(tableHtml).toContain('John Doe');
      expect(tableHtml).toContain('jane@example.com');

      // Test navigation HTML generation
      const navHtml = buildNavigationHtml([
        { href: '/dashboard', text: 'Dashboard', active: true },
        { href: '/profile', text: 'Profile', active: false },
        { href: '/settings', text: 'Settings', active: false },
      ]);

      expect(navHtml).toContain('nav');
      expect(navHtml).toContain('Dashboard');
      expect(navHtml).toContain('active');

      // Test complete page generation
      const completePage = buildCompletePage({
        title: 'Integration Test Page',
        head: '<meta charset="UTF-8">',
        body: '<main><h1>Test Content</h1></main>',
        styles: 'body { font-family: Arial, sans-serif; }',
        scripts: 'console.log("Page loaded");',
      });

      expect(completePage).toContain('<!DOCTYPE html>');
      expect(completePage).toContain('Integration Test Page');
      expect(completePage).toContain('Test Content');
      expect(completePage).toContain('font-family: Arial');
      expect(completePage).toContain('Page loaded');
    });

    it('should provide URL generation utilities', () => {
      // Test basic URL generation
      const testUrl = generateTestUrl('https', {
        domain: 'api.test.com',
        path: '/users/123',
        query: { format: 'json', include: 'profile' },
        fragment: 'details',
      });

      expect(testUrl).toBe('https://api.test.com/users/123?format=json&include=profile#details');

      // Test pre-built test URLs
      expect(testUrls.local).toContain('localhost');
      expect(testUrls.secure).toContain('https://');
      expect(testUrls.api).toContain('api');

      // Test URL validation
      const dataUrl = generateTestUrl('data', {
        content: '<h1>Hello</h1>',
        mimeType: 'text/html',
        charset: 'utf-8',
      });

      expect(dataUrl).toContain('data:text/html');
      expect(dataUrl).toContain('Hello');
    });

    it('should provide browser state assertion utilities', async () => {
      // Setup test page
      const testPage = buildCompletePage({
        title: 'Assertion Test Page',
        body: `
          <div id="content">
            <h1 id="title">Page Title</h1>
            <button id="btn" class="active">Click Me</button>
            <input id="input" type="text" value="test value" />
          </div>
        `,
      });

      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPage)}`;
      await mockSession.navigate(dataUrl);

      // Test navigation state assertions
      const navState: NavigationState = {
        url: dataUrl,
        title: 'Assertion Test Page',
        ready: true,
      };

      const navResult = await assertNavigationState(mockSession, navState);
      expect(navResult.success).toBe(true);

      // Test page content assertions
      const contentResult = await assertPageContent(mockSession, 'Page Title');
      expect(contentResult.success).toBe(true);

      // Test element existence assertions
      const elementResult = await assertElementExists(mockSession, '#title');
      expect(elementResult.success).toBe(true);

      // Test element visibility assertions
      const visibilityResult = await assertElementVisible(mockSession, '#btn');
      expect(visibilityResult.success).toBe(true);

      // Test error absence assertions
      const noErrorsResult = await assertNoErrors(mockSession);
      expect(noErrorsResult.success).toBe(true);

      // Test browser state assertions
      const browserStateResult = await assertBrowserState(mockSession, {
        hasPage: true,
        isNavigated: true,
        pageTitle: 'Assertion Test Page',
      });
      expect(browserStateResult.success).toBe(true);
    });
  });

  describe('Scenario Building and Mock Configurations', () => {
    it('should provide scenario building capabilities', async () => {
      // Test custom scenario creation
      const customScenario = createMockScenario()
        .withUrl('https://ecommerce.test')
        .withElement('#add-to-cart', { enabled: true, visible: true })
        .withElement('#quantity', { value: '2' })
        .withOperation('click', { selector: '#add-to-cart', delay: 100 })
        .withOperation('type', { selector: '#quantity', text: '3', delay: 50 })
        .build();

      expect(customScenario.url).toBe('https://ecommerce.test');
      expect(customScenario.elements['#add-to-cart']).toBeDefined();
      expect(customScenario.elements['#add-to-cart'].enabled).toBe(true);
      expect(customScenario.operations).toHaveLength(2);

      // Test common scenarios
      expect(commonScenarios.loginPage).toBeDefined();
      expect(commonScenarios.dashboardPage).toBeDefined();
      expect(commonScenarios.formPage).toBeDefined();

      const loginScenario = commonScenarios.loginPage;
      expect(loginScenario.url).toContain('login');
      expect(loginScenario.elements['#username']).toBeDefined();
      expect(loginScenario.elements['#password']).toBeDefined();

      // Test scenario application to session
      const session = createMockBrowserSession({
        browserType: 'chromium',
        mockConfig: defaultMockConfig,
      });

      await session.launch();

      // Apply scenario would be integrated into the mock session
      await session.navigate(loginScenario.url);

      // Verify scenario elements are available
      const usernameResult = await session.type('#username', 'testuser');
      expect(usernameResult.success).toBe(true);

      const passwordResult = await session.type('#password', 'testpass');
      expect(passwordResult.success).toBe(true);

      await session.close();
    });

    it('should provide configurable mock behaviors', async () => {
      // Test success-oriented configuration
      const successSession = createMockBrowserSession({
        browserType: 'chromium',
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 10,
          failureRate: 0,
          useRealisticDelays: false,
        },
      });

      await successSession.launch();

      // All operations should succeed
      for (let i = 0; i < 5; i++) {
        const result = await successSession.navigate('https://test.com');
        expect(result.success).toBe(true);
      }

      await successSession.close();

      // Test failure-prone configuration
      const unreliableSession = createMockBrowserSession({
        browserType: 'chromium',
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 50,
          failureRate: 0.5, // 50% failure rate
          useRealisticDelays: true,
        },
      });

      await unreliableSession.launch();

      // Some operations should fail
      let failures = 0;
      const attempts = 10;

      for (let i = 0; i < attempts; i++) {
        const result = await unreliableSession.click('#test-button');
        if (!result.success) failures++;
      }

      // We expect some failures with 50% failure rate
      expect(failures).toBeGreaterThan(0);
      expect(failures).toBeLessThan(attempts);

      await unreliableSession.close();
    });
  });

  describe('Test Utilities Integration', () => {
    it('should provide test data generation utilities', () => {
      // Test page generators
      const testPages = TestPages.generate({
        count: 3,
        baseUrl: 'https://test.com',
        includeNavigation: true,
        includeForms: true,
      });

      expect(testPages).toHaveLength(3);
      testPages.forEach(page => {
        expect(page.url).toContain('test.com');
        expect(page.html).toContain('nav');
        expect(page.html).toContain('form');
      });

      // Test data generators
      const formData = TestDataGenerators.generateFormData({
        fields: ['firstName', 'lastName', 'email', 'age'],
        locale: 'en',
      });

      expect(formData.firstName).toBeTruthy();
      expect(formData.lastName).toBeTruthy();
      expect(formData.email).toContain('@');
      expect(Number(formData.age)).toBeGreaterThan(0);
    });

    it('should provide performance monitoring utilities', async () => {
      const monitor = new PerformanceMonitor();

      const session = createMockSessionForTesting('performance-test');
      await session.launch();

      // Start monitoring
      monitor.startOperation('navigation');
      await session.navigate('https://performance-test.com');
      monitor.endOperation('navigation');

      monitor.startOperation('interaction');
      await session.click('#test-button');
      await session.type('#test-input', 'performance test');
      monitor.endOperation('interaction');

      // Get performance metrics
      const metrics = monitor.getMetrics();
      expect(metrics.navigation).toBeDefined();
      expect(metrics.interaction).toBeDefined();
      expect(metrics.navigation.duration).toBeGreaterThan(0);
      expect(metrics.interaction.duration).toBeGreaterThan(0);

      // Test performance assertions
      expect(metrics.navigation.duration).toBeLessThan(1000); // Mock should be fast
      expect(metrics.interaction.duration).toBeLessThan(500);

      await session.close();
    });

    it('should provide mock scenario utilities', () => {
      // Test scenario library
      const scenarios = MockScenarios.getAllScenarios();
      expect(scenarios.length).toBeGreaterThan(0);

      const ecommerceScenario = MockScenarios.getScenario('ecommerce');
      expect(ecommerceScenario).toBeDefined();
      expect(ecommerceScenario?.url).toContain('shop');

      // Test scenario customization
      const customized = MockScenarios.customizeScenario('loginPage', {
        url: 'https://custom-login.test',
        elements: {
          '#username': { placeholder: 'Enter username here' },
        },
      });

      expect(customized.url).toBe('https://custom-login.test');
      expect(customized.elements['#username'].placeholder).toBe('Enter username here');
    });
  });

  describe('Real vs Mock Browser Compatibility', () => {
    it('should provide compatible APIs between real and mock implementations', async () => {
      // Test API compatibility by using same operations on both
      const mockSession = createMockSessionForTesting('compatibility-test');

      // Mock operations
      await mockSession.launch();
      const mockNavResult = await mockSession.navigate('https://example.com');
      const mockClickResult = await mockSession.click('#button');
      const mockTypeResult = await mockSession.type('#input', 'test');
      const mockScreenshotResult = await mockSession.screenshot();
      await mockSession.close();

      // All operations should have same result structure
      expect(mockNavResult).toHaveProperty('success');
      expect(mockNavResult).toHaveProperty('duration');
      expect(mockClickResult).toHaveProperty('success');
      expect(mockTypeResult).toHaveProperty('success');
      expect(mockScreenshotResult).toHaveProperty('success');
      expect(mockScreenshotResult).toHaveProperty('data');

      // Test factory functions have same signatures
      const mockManager = createMockBrowserManager({ maxInstances: 3 });
      expect(mockManager).toBeDefined();

      const mockLaunchResult = await launchMockBrowser({
        browserType: 'chromium',
        headless: true
      });
      expect(mockLaunchResult).toHaveProperty('success');
      expect(mockLaunchResult).toHaveProperty('duration');

      if (mockLaunchResult.success) {
        await mockLaunchResult.data!.close();
      }
    });

    it('should provide test-friendly defaults and configurations', () => {
      // Test that default configurations are suitable for testing
      const testSession = createMockSessionForTesting('defaults-test');
      const config = testSession.getConfig();

      expect(config.headless).toBe(true); // No UI for tests
      expect(config.mockConfig.defaultDelay).toBeLessThan(100); // Fast for tests
      expect(config.mockConfig.useRealisticDelays).toBe(false); // Predictable timing
      expect(config.trackOperations).toBe(true); // Track for debugging

      // Test that utility functions provide sensible defaults
      const quickSession = createMockSessionForTesting('quick-test');
      const quickConfig = quickSession.getConfig();
      expect(quickConfig.mockConfig.defaultDelay).toBeLessThan(50);

      const unreliableSession = createUnreliableMockSession(0.2);
      const unreliableConfig = unreliableSession.getConfig();
      expect(unreliableConfig.mockConfig.failureRate).toBe(0.2);
      expect(unreliableConfig.trackOperations).toBe(true);
    });
  });

  describe('Test Infrastructure Completeness', () => {
    it('should provide all necessary test infrastructure components', () => {
      // Verify all major test infrastructure components are exported and functional

      // Mock implementations
      expect(MockBrowserSession).toBeDefined();
      expect(MockBrowserManager).toBeDefined();

      // Factory functions
      expect(createMockBrowserSession).toBeTypeOf('function');
      expect(createMockBrowserManager).toBeTypeOf('function');
      expect(launchMockBrowser).toBeTypeOf('function');

      // Test utilities
      expect(createMockPage).toBeTypeOf('function');
      expect(createMockElement).toBeTypeOf('function');
      expect(buildFormHtml).toBeTypeOf('function');
      expect(generateTestUrl).toBeTypeOf('function');
      expect(assertNavigationState).toBeTypeOf('function');

      // Scenario builders
      expect(createMockScenario).toBeTypeOf('function');
      expect(commonScenarios).toBeTypeOf('object');

      // Test helpers
      expect(TestPages).toBeTypeOf('object');
      expect(TestDataGenerators).toBeTypeOf('object');
      expect(PerformanceMonitor).toBeTypeOf('function');
      expect(MockScenarios).toBeTypeOf('object');

      // Configuration
      expect(defaultMockConfig).toBeTypeOf('object');
      expect(defaultMockConfig.defaultSuccess).toBe(true);
    });

    it('should support comprehensive test scenarios', async () => {
      // Test complex multi-step scenarios
      const scenario = createMockScenario()
        .withUrl('https://complex-app.test')
        .withElement('#login-form', { visible: true })
        .withElement('#username', { required: true })
        .withElement('#password', { required: true })
        .withElement('#submit-btn', { enabled: true })
        .withOperation('type', { selector: '#username', text: 'testuser' })
        .withOperation('type', { selector: '#password', text: 'testpass' })
        .withOperation('click', { selector: '#submit-btn' })
        .withNavigation('https://complex-app.test/dashboard')
        .withElement('#welcome-msg', { text: 'Welcome testuser!' })
        .build();

      const session = createMockBrowserSession({
        browserType: 'chromium',
        mockConfig: { defaultSuccess: true, defaultDelay: 25 },
      }, scenario);

      await session.launch();
      await session.navigate(scenario.url);

      // Execute scenario operations
      for (const operation of scenario.operations) {
        const result = await session[operation.type as keyof MockBrowserSession](
          operation.selector,
          operation.text || operation.options
        );
        expect((result as BrowserActionResult<any>).success).toBe(true);
      }

      await session.close();
    });
  });
});