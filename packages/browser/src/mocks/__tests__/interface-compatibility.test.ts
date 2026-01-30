/**
 * @apexcli/browser/mocks - Interface Compatibility Tests
 *
 * Validates that mock classes provide the same interface as real browser classes
 * and return data in the expected formats for seamless testing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MockBrowserSession,
  MockBrowserManager,
  createMockBrowserSession,
  createMockBrowserManager,
  createMockScenario,
} from '../index.js';
import type {
  MockBrowserSessionConfig,
  MockBrowserManagerState,
  MockNavigationResult,
  MockScreenshot,
  MockPageState,
  MockElement,
  MockOperation,
} from '../types.js';

describe('Interface Compatibility Tests', () => {
  describe('BrowserSession Interface Compatibility', () => {
    let session: MockBrowserSession;

    beforeEach(async () => {
      session = createMockBrowserSession();
      await session.launch();
    });

    it('should implement BrowserActionResult interface for all operations', async () => {
      const operations = [
        () => session.navigate('https://example.com'),
        () => session.clickElement('#button'),
        () => session.typeInElement('#input', 'test'),
        () => session.elementExists('#element'),
        () => session.getElementText('#text'),
        () => session.captureScreenshot(),
        () => session.waitForNavigation(),
        () => session.close(),
      ];

      for (const operation of operations) {
        const result = await operation();

        // Must have success property
        expect(result).toHaveProperty('success');
        expect(typeof result.success).toBe('boolean');

        // Must have duration property
        expect(result).toHaveProperty('duration');
        expect(typeof result.duration).toBe('number');
        expect(result.duration).toBeGreaterThanOrEqual(0);

        // If failed, must have error
        if (!result.success) {
          expect(result).toHaveProperty('error');
          expect(typeof result.error).toBe('string');
          expect(result.error!.length).toBeGreaterThan(0);
        }

        // If has data, verify it's defined
        if ('data' in result) {
          expect(result.data).toBeDefined();
        }
      }
    });

    it('should implement ElementSelector interface compatibility', async () => {
      await session.navigate('https://example.com');

      const selectorFormats = [
        '#id-selector',
        '.class-selector',
        'tag-selector',
        '[attribute="value"]',
        '#parent .child',
        'tag#id.class',
        { type: 'css', value: '#complex-selector' },
        { type: 'xpath', value: '//div[@id="test"]' },
      ];

      for (const selector of selectorFormats) {
        const result = await session.elementExists(selector as any);

        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('duration');

        if (result.success) {
          expect(result).toHaveProperty('data');
          expect(typeof result.data).toBe('boolean');
        }
      }
    });

    it('should return NavigationResult with expected structure', async () => {
      const result = await session.navigate('https://example.com/test');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      const navResult = result.data as MockNavigationResult;
      expect(navResult).toHaveProperty('url');
      expect(navResult).toHaveProperty('title');
      expect(navResult).toHaveProperty('loadTime');
      expect(navResult).toHaveProperty('success');

      expect(typeof navResult.url).toBe('string');
      expect(typeof navResult.title).toBe('string');
      expect(typeof navResult.loadTime).toBe('number');
      expect(typeof navResult.success).toBe('boolean');

      expect(navResult.url).toBe('https://example.com/test');
      expect(navResult.loadTime).toBeGreaterThan(0);
      expect(navResult.success).toBe(true);
    });

    it('should return Screenshot with expected structure', async () => {
      const result = await session.captureScreenshot({
        type: 'png',
        quality: 90,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      const screenshot = result.data as MockScreenshot;
      expect(screenshot).toHaveProperty('data');
      expect(screenshot).toHaveProperty('width');
      expect(screenshot).toHaveProperty('height');
      expect(screenshot).toHaveProperty('format');
      expect(screenshot).toHaveProperty('captureTime');

      expect(typeof screenshot.data).toBe('string');
      expect(typeof screenshot.width).toBe('number');
      expect(typeof screenshot.height).toBe('number');
      expect(typeof screenshot.format).toBe('string');
      expect(typeof screenshot.captureTime).toBe('number');

      expect(screenshot.format).toBe('png');
      expect(screenshot.width).toBeGreaterThan(0);
      expect(screenshot.height).toBeGreaterThan(0);
      expect(screenshot.data.length).toBeGreaterThan(0);
    });

    it('should provide PageState interface compatibility', () => {
      const pageState = session.getPageState();

      expect(pageState).toHaveProperty('url');
      expect(pageState).toHaveProperty('title');
      expect(pageState).toHaveProperty('loaded');
      expect(pageState).toHaveProperty('elements');
      expect(pageState).toHaveProperty('consoleMessages');
      expect(pageState).toHaveProperty('errors');

      expect(typeof pageState.url).toBe('string');
      expect(typeof pageState.title).toBe('string');
      expect(typeof pageState.loaded).toBe('boolean');
      expect(pageState.elements).toBeInstanceOf(Map);
      expect(Array.isArray(pageState.consoleMessages)).toBe(true);
      expect(Array.isArray(pageState.errors)).toBe(true);

      // Optional properties
      if (pageState.content !== undefined) {
        expect(typeof pageState.content).toBe('string');
      }
      if (pageState.viewport !== undefined) {
        expect(pageState.viewport).toHaveProperty('width');
        expect(pageState.viewport).toHaveProperty('height');
        expect(typeof pageState.viewport.width).toBe('number');
        expect(typeof pageState.viewport.height).toBe('number');
      }
    });

    it('should provide Element interface compatibility', async () => {
      await session.navigate('https://example.com');

      // Create element through interaction
      await session.typeInElement('#test-input', 'test value');

      const pageState = session.getPageState();
      const element = pageState.elements.get('#test-input');

      expect(element).toBeDefined();
      expect(element!).toHaveProperty('selector');
      expect(element!).toHaveProperty('exists');
      expect(element!).toHaveProperty('visible');
      expect(element!).toHaveProperty('enabled');

      expect(typeof element!.selector).toBe('string');
      expect(typeof element!.exists).toBe('boolean');
      expect(typeof element!.visible).toBe('boolean');
      expect(typeof element!.enabled).toBe('boolean');

      // Optional properties
      if (element!.text !== undefined) {
        expect(typeof element!.text).toBe('string');
      }
      if (element!.value !== undefined) {
        expect(typeof element!.value).toBe('string');
        expect(element!.value).toBe('test value');
      }
      if (element!.attributes !== undefined) {
        expect(typeof element!.attributes).toBe('object');
      }
      if (element!.boundingBox !== undefined) {
        expect(element!.boundingBox).toHaveProperty('x');
        expect(element!.boundingBox).toHaveProperty('y');
        expect(element!.boundingBox).toHaveProperty('width');
        expect(element!.boundingBox).toHaveProperty('height');
      }
    });

    it('should track operations with Operation interface compatibility', async () => {
      await session.navigate('https://example.com');
      await session.clickElement('#button');

      const operations = session.getOperationHistory();
      expect(operations.length).toBeGreaterThan(0);

      operations.forEach(operation => {
        expect(operation).toHaveProperty('name');
        expect(operation).toHaveProperty('args');
        expect(operation).toHaveProperty('startTime');

        expect(typeof operation.name).toBe('string');
        expect(Array.isArray(operation.args)).toBe(true);
        expect(typeof operation.startTime).toBe('number');

        // Optional properties that should exist after completion
        if (operation.endTime !== undefined) {
          expect(typeof operation.endTime).toBe('number');
          expect(operation.endTime).toBeGreaterThanOrEqual(operation.startTime);
        }
        if (operation.success !== undefined) {
          expect(typeof operation.success).toBe('boolean');
        }
        if (operation.error !== undefined) {
          expect(typeof operation.error).toBe('string');
        }
        // result can be any type
      });
    });
  });

  describe('BrowserManager Interface Compatibility', () => {
    let manager: MockBrowserManager;

    beforeEach(async () => {
      manager = createMockBrowserManager();
      await manager.initialize();
    });

    it('should implement BrowserManager interface completely', () => {
      // Required methods
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

      // Mock-specific methods
      expect(typeof manager.getState).toBe('function');
    });

    it('should return BrowserInstanceInfo with expected structure', async () => {
      await manager.createSession();

      const instances = manager.getBrowserInstances();
      expect(instances.length).toBeGreaterThan(0);

      const instance = instances[0];
      expect(instance).toHaveProperty('id');
      expect(instance).toHaveProperty('type');
      expect(instance).toHaveProperty('createdAt');
      expect(instance).toHaveProperty('lastActiveAt');
      expect(instance).toHaveProperty('contextCount');
      expect(instance).toHaveProperty('inUse');

      expect(typeof instance.id).toBe('string');
      expect(typeof instance.type).toBe('string');
      expect(instance.createdAt).toBeInstanceOf(Date);
      expect(instance.lastActiveAt).toBeInstanceOf(Date);
      expect(typeof instance.contextCount).toBe('number');
      expect(typeof instance.inUse).toBe('boolean');

      // Optional properties
      if (instance.resourceUsage !== undefined) {
        expect(instance.resourceUsage).toHaveProperty('memoryMB');
        expect(instance.resourceUsage).toHaveProperty('cpuPercent');
        expect(typeof instance.resourceUsage.memoryMB).toBe('number');
        expect(typeof instance.resourceUsage.cpuPercent).toBe('number');
      }
    });

    it('should return BrowserContextInfo with expected structure', async () => {
      await manager.createSession();

      const contexts = manager.getBrowserContexts();
      expect(contexts.length).toBeGreaterThan(0);

      const context = contexts[0];
      expect(context).toHaveProperty('id');
      expect(context).toHaveProperty('browserId');
      expect(context).toHaveProperty('createdAt');
      expect(context).toHaveProperty('lastActiveAt');
      expect(context).toHaveProperty('pageCount');
      expect(context).toHaveProperty('config');

      expect(typeof context.id).toBe('string');
      expect(typeof context.browserId).toBe('string');
      expect(context.createdAt).toBeInstanceOf(Date);
      expect(context.lastActiveAt).toBeInstanceOf(Date);
      expect(typeof context.pageCount).toBe('number');
      expect(typeof context.config).toBe('object');

      // Config should match BrowserSessionConfig structure
      const config = context.config as MockBrowserSessionConfig;
      expect(config).toHaveProperty('browserType');
      expect(config).toHaveProperty('headless');
      expect(config).toHaveProperty('viewport');
      expect(config).toHaveProperty('timeout');
      expect(config).toHaveProperty('mockConfig');
      expect(config).toHaveProperty('trackOperations');
    });

    it('should return resource usage with expected structure', async () => {
      await manager.createSession();

      const result = await manager.checkResourceUsage();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      const usage = result.data!;
      expect(usage).toHaveProperty('memory');
      expect(usage).toHaveProperty('cpu');

      expect(typeof usage.memory).toBe('number');
      expect(typeof usage.cpu).toBe('number');
      expect(usage.memory).toBeGreaterThanOrEqual(0);
      expect(usage.cpu).toBeGreaterThanOrEqual(0);
    });

    it('should provide ManagerState interface compatibility', () => {
      const state = manager.getState();

      expect(state).toHaveProperty('activeSessions');
      expect(state).toHaveProperty('sessions');
      expect(state).toHaveProperty('initialized');

      expect(typeof state.activeSessions).toBe('number');
      expect(state.sessions).toBeInstanceOf(Map);
      expect(typeof state.initialized).toBe('boolean');

      expect(state.activeSessions).toBeGreaterThanOrEqual(0);
      expect(state.initialized).toBe(true);
    });
  });

  describe('Event Interface Compatibility', () => {
    it('should emit MockBrowserEvents with expected signatures', async () => {
      const session = createMockBrowserSession();
      const events: any[] = [];

      // Subscribe to all events with expected signatures
      session.on('operation', (operation: MockOperation) => {
        events.push({ type: 'operation', data: operation });
        expect(operation).toHaveProperty('name');
        expect(operation).toHaveProperty('args');
        expect(operation).toHaveProperty('startTime');
      });

      session.on('navigation', (result: MockNavigationResult) => {
        events.push({ type: 'navigation', data: result });
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('loadTime');
        expect(result).toHaveProperty('success');
      });

      session.on('elementInteraction', (selector: string, action: string, success: boolean) => {
        events.push({ type: 'elementInteraction', data: { selector, action, success } });
        expect(typeof selector).toBe('string');
        expect(typeof action).toBe('string');
        expect(typeof success).toBe('boolean');
      });

      session.on('screenshot', (options: any, result: MockScreenshot) => {
        events.push({ type: 'screenshot', data: { options, result } });
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('width');
        expect(result).toHaveProperty('height');
        expect(result).toHaveProperty('format');
      });

      session.on('stateChange', (state: MockPageState) => {
        events.push({ type: 'stateChange', data: state });
        expect(state).toHaveProperty('url');
        expect(state).toHaveProperty('loaded');
        expect(state).toHaveProperty('elements');
      });

      // Perform operations to trigger events
      await session.launch();
      await session.navigate('https://example.com');
      await session.clickElement('#button');
      await session.captureScreenshot();

      // Verify all expected events were emitted
      const eventTypes = events.map(e => e.type);
      expect(eventTypes).toContain('operation');
      expect(eventTypes).toContain('navigation');
      expect(eventTypes).toContain('elementInteraction');
      expect(eventTypes).toContain('screenshot');
      expect(eventTypes).toContain('stateChange');
    });

    it('should emit BrowserManagerEvents with expected signatures', async () => {
      const manager = createMockBrowserManager();
      const events: any[] = [];

      manager.on('browserCreated', (info: any) => {
        events.push({ type: 'browserCreated', data: info });
        expect(info).toHaveProperty('id');
        expect(info).toHaveProperty('type');
        expect(info).toHaveProperty('createdAt');
      });

      manager.on('contextCreated', (info: any) => {
        events.push({ type: 'contextCreated', data: info });
        expect(info).toHaveProperty('id');
        expect(info).toHaveProperty('browserId');
        expect(info).toHaveProperty('createdAt');
      });

      manager.on('contextClosed', (contextId: string) => {
        events.push({ type: 'contextClosed', data: contextId });
        expect(typeof contextId).toBe('string');
      });

      manager.on('browserClosed', (browserId: string) => {
        events.push({ type: 'browserClosed', data: browserId });
        expect(typeof browserId).toBe('string');
      });

      manager.on('resourceLimitExceeded', (event: any) => {
        events.push({ type: 'resourceLimitExceeded', data: event });
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('value');
        expect(event).toHaveProperty('limit');
      });

      // Perform operations to trigger events
      await manager.initialize();
      const sessionResult = await manager.createSession();
      if (sessionResult.success) {
        await manager.closeSession(sessionResult.data!);
      }

      // Verify events were emitted with correct structure
      const eventTypes = events.map(e => e.type);
      expect(eventTypes).toContain('browserCreated');
      expect(eventTypes).toContain('contextCreated');
    });
  });

  describe('Configuration Interface Compatibility', () => {
    it('should support all BrowserSessionConfig options', () => {
      const fullConfig: MockBrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        viewport: { width: 1920, height: 1080 },
        timeout: 60000,
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 150,
          failureRate: 0.1,
          useRealisticDelays: true,
        },
        trackOperations: true,
        scenarioConfig: {
          operations: {
            navigate: { success: true, delay: 1000 },
          },
          urlBehaviors: {
            'https://example.com': { loadTime: 500 },
          },
          elementBehaviors: {
            '#button': { exists: true, visible: true, enabled: true },
          },
        },
      };

      const session = createMockBrowserSession(fullConfig);
      const retrievedConfig = session.getConfig();

      expect(retrievedConfig.browserType).toBe('chromium');
      expect(retrievedConfig.headless).toBe(true);
      expect(retrievedConfig.viewport).toEqual({ width: 1920, height: 1080 });
      expect(retrievedConfig.timeout).toBe(60000);
      expect(retrievedConfig.trackOperations).toBe(true);
      expect(retrievedConfig.mockConfig).toEqual(fullConfig.mockConfig);
      expect(retrievedConfig.scenarioConfig).toEqual(fullConfig.scenarioConfig);
    });

    it('should support all BrowserManagerConfig options', () => {
      const fullManagerConfig = {
        maxInstances: 10,
        instanceIdleTimeout: 600000,
        reuseInstances: false,
        resourceLimits: {
          maxMemoryMB: 2048,
          maxCpuPercent: 90,
        },
      };

      const manager = createMockBrowserManager(fullManagerConfig);
      const retrievedConfig = manager.getConfig();

      expect(retrievedConfig.maxInstances).toBe(10);
      expect(retrievedConfig.instanceIdleTimeout).toBe(600000);
      expect(retrievedConfig.reuseInstances).toBe(false);
      expect(retrievedConfig.resourceLimits).toEqual({
        maxMemoryMB: 2048,
        maxCpuPercent: 90,
      });
    });

    it('should support scenario builder interface compatibility', () => {
      const scenario = createMockScenario()
        .forUrl('https://test.com')
          .loadTime(1000)
          .withTitle('Test Page')
          .withContent('<html>Test content</html>')
        .and()
        .forElement('#form-input')
          .exists(true)
          .visible(true)
          .enabled(false)
          .withText('Input field')
          .withValue('default value')
        .and()
        .forOperation('customOperation')
          .succeeds({ custom: 'data' })
          .withDelay(500)
        .and()
        .build();

      expect(scenario).toHaveProperty('urlBehaviors');
      expect(scenario).toHaveProperty('elementBehaviors');
      expect(scenario).toHaveProperty('operations');

      expect(scenario.urlBehaviors!['https://test.com']).toEqual({
        loadTime: 1000,
        title: 'Test Page',
        content: '<html>Test content</html>',
      });

      expect(scenario.elementBehaviors!['#form-input']).toEqual({
        exists: true,
        visible: true,
        enabled: false,
        text: 'Input field',
        value: 'default value',
      });

      expect(scenario.operations!['customOperation']).toEqual({
        success: true,
        returnValue: { custom: 'data' },
        delay: 500,
      });
    });
  });

  describe('Type Safety and Interface Constraints', () => {
    it('should enforce proper typing for ElementSelector', async () => {
      const session = createMockBrowserSession();
      await session.launch();

      // String selectors
      const stringResult = await session.elementExists('#string-selector');
      expect(stringResult).toHaveProperty('success');

      // Object selectors
      const cssResult = await session.elementExists({
        type: 'css',
        value: '.css-selector'
      });
      expect(cssResult).toHaveProperty('success');

      const xpathResult = await session.elementExists({
        type: 'xpath',
        value: '//div[@class="xpath-selector"]'
      });
      expect(xpathResult).toHaveProperty('success');
    });

    it('should enforce proper typing for screenshot options', async () => {
      const session = createMockBrowserSession();
      await session.launch();

      const pngResult = await session.captureScreenshot({
        type: 'png',
      });
      expect(pngResult.data?.format).toBe('png');

      const jpegResult = await session.captureScreenshot({
        type: 'jpeg',
        quality: 80,
      });
      expect(jpegResult.data?.format).toBe('jpeg');
    });

    it('should enforce proper typing for browser types', () => {
      const supportedTypes = ['chromium', 'firefox', 'webkit'] as const;

      supportedTypes.forEach(browserType => {
        const session = createMockBrowserSession({ browserType });
        expect(session.getConfig().browserType).toBe(browserType);
      });
    });

    it('should maintain type consistency across operations', async () => {
      const session = createMockBrowserSession();
      await session.launch();

      // Navigation should return NavigationResult
      const navResult = await session.navigate('https://example.com');
      if (navResult.success && navResult.data) {
        expect(typeof navResult.data.url).toBe('string');
        expect(typeof navResult.data.title).toBe('string');
        expect(typeof navResult.data.loadTime).toBe('number');
        expect(typeof navResult.data.success).toBe('boolean');
      }

      // Element existence should return boolean
      const existsResult = await session.elementExists('#test');
      if (existsResult.success) {
        expect(typeof existsResult.data).toBe('boolean');
      }

      // Element text should return string
      const textResult = await session.getElementText('#text');
      if (textResult.success) {
        expect(typeof textResult.data).toBe('string');
      }

      // Screenshot should return MockScreenshot
      const screenshotResult = await session.captureScreenshot();
      if (screenshotResult.success && screenshotResult.data) {
        expect(typeof screenshotResult.data.data).toBe('string');
        expect(typeof screenshotResult.data.width).toBe('number');
        expect(typeof screenshotResult.data.height).toBe('number');
        expect(['png', 'jpeg']).toContain(screenshotResult.data.format);
      }
    });
  });

  afterEach(async () => {
    // Cleanup any sessions and managers
    // This is important for interface compatibility testing
  });
});