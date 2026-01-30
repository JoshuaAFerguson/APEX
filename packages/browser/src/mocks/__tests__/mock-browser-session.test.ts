/**
 * @apexcli/browser/mocks - MockBrowserSession Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockBrowserSession } from '../mock-browser-session.js';
import { createMockScenario } from '../scenario-builder.js';
import type { MockBrowserSessionConfig, MockScenarioConfig } from '../types.js';

describe('MockBrowserSession', () => {
  let session: MockBrowserSession;

  beforeEach(() => {
    session = new MockBrowserSession({
      browserType: 'chromium',
      mockConfig: {
        defaultSuccess: true,
        defaultDelay: 10,
        useRealisticDelays: false,
      },
      trackOperations: true,
    });
  });

  describe('constructor and configuration', () => {
    it('should create session with default config', () => {
      const defaultSession = new MockBrowserSession();
      const config = defaultSession.getConfig();

      expect(config.browserType).toBe('chromium');
      expect(config.headless).toBe(true);
      expect(config.mockConfig.defaultSuccess).toBe(true);
    });

    it('should create session with custom config', () => {
      const customSession = new MockBrowserSession({
        browserType: 'firefox',
        headless: false,
        viewport: { width: 1920, height: 1080 },
        mockConfig: {
          defaultSuccess: false,
          defaultDelay: 500,
          useRealisticDelays: true,
        },
      });

      const config = customSession.getConfig();
      expect(config.browserType).toBe('firefox');
      expect(config.headless).toBe(false);
      expect(config.viewport).toEqual({ width: 1920, height: 1080 });
      expect(config.mockConfig.defaultSuccess).toBe(false);
    });

    it('should handle scenario configuration', () => {
      const scenario = createMockScenario()
        .forUrl('https://example.com')
          .loadTime(1000)
        .and()
        .forElement('#button')
          .exists()
          .enabled()
        .build();

      const scenarioSession = new MockBrowserSession({}, scenario);
      const config = scenarioSession.getConfig();

      expect(config.scenarioConfig).toBeDefined();
      expect(config.scenarioConfig?.urlBehaviors?.['https://example.com']).toBeDefined();
      expect(config.scenarioConfig?.elementBehaviors?.['#button']).toBeDefined();
    });
  });

  describe('launch operation', () => {
    it('should launch successfully with default config', async () => {
      const result = await session.launch();

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it('should track launch operation', async () => {
      await session.launch();
      const operations = session.getOperationHistory();

      expect(operations).toHaveLength(1);
      expect(operations[0].name).toBe('launch');
      expect(operations[0].success).toBe(true);
    });

    it('should handle launch failure', async () => {
      const failSession = new MockBrowserSession({
        mockConfig: {
          defaultSuccess: false,
          defaultDelay: 10,
          useRealisticDelays: false,
        },
        scenarioConfig: {
          operations: {
            launch: {
              success: false,
              error: 'Mock launch failure',
            },
          },
        },
      });

      const result = await failSession.launch();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Mock launch failure');
    });
  });

  describe('navigation operations', () => {
    beforeEach(async () => {
      await session.launch();
    });

    it('should navigate successfully', async () => {
      const result = await session.navigate('https://example.com');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.url).toBe('https://example.com');
      expect(result.data?.title).toContain('Mock Page');
    });

    it('should update page state after navigation', async () => {
      await session.navigate('https://example.com');
      const pageState = session.getPageState();

      expect(pageState.url).toBe('https://example.com');
      expect(pageState.loaded).toBe(true);
      expect(pageState.title).toContain('example.com');
    });

    it('should emit navigation events', async () => {
      const navigationSpy = vi.fn();
      session.on('navigation', navigationSpy);

      await session.navigate('https://example.com');

      expect(navigationSpy).toHaveBeenCalledTimes(1);
      expect(navigationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com',
          success: true,
        })
      );
    });

    it('should fail navigation when not launched', async () => {
      const unlaunchedSession = new MockBrowserSession();
      const result = await unlaunchedSession.navigate('https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Browser session not launched');
    });

    it('should respect URL-specific behavior from scenario', async () => {
      const scenario = createMockScenario()
        .forUrl('https://slow.example.com')
          .loadTime(2000)
        .build();

      const scenarioSession = new MockBrowserSession({}, scenario);
      await scenarioSession.launch();

      const result = await scenarioSession.navigate('https://slow.example.com');

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(2000);
    });
  });

  describe('element operations', () => {
    beforeEach(async () => {
      await session.launch();
      await session.navigate('https://example.com');
    });

    it('should check element existence', async () => {
      const result = await session.elementExists('#content');

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('should handle non-existent elements', async () => {
      const scenario = createMockScenario()
        .forElement('#missing')
          .exists(false)
        .build();

      const scenarioSession = new MockBrowserSession({}, scenario);
      await scenarioSession.launch();
      await scenarioSession.navigate('https://example.com');

      const result = await scenarioSession.elementExists('#missing');

      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });

    it('should click element successfully', async () => {
      const result = await session.clickElement('#content');

      expect(result.success).toBe(true);
    });

    it('should emit element interaction events', async () => {
      const interactionSpy = vi.fn();
      session.on('elementInteraction', interactionSpy);

      await session.clickElement('#content');

      expect(interactionSpy).toHaveBeenCalledWith('#content', 'click', true);
    });

    it('should fail to click disabled elements', async () => {
      const scenario = createMockScenario()
        .forElement('#disabled-button')
          .exists(true)
          .visible(true)
          .enabled(false)
        .build();

      const scenarioSession = new MockBrowserSession({}, scenario);
      await scenarioSession.launch();
      await scenarioSession.navigate('https://example.com');

      const result = await scenarioSession.clickElement('#disabled-button');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Element not enabled');
    });

    it('should type in element successfully', async () => {
      const result = await session.typeInElement('#content', 'test text');

      expect(result.success).toBe(true);

      // Check that element value was updated
      const pageState = session.getPageState();
      const element = pageState.elements.get('#content');
      expect(element?.value).toBe('test text');
    });

    it('should get element text', async () => {
      const scenario = createMockScenario()
        .forElement('#text-element')
          .exists(true)
          .withText('Hello World')
        .build();

      const scenarioSession = new MockBrowserSession({}, scenario);
      await scenarioSession.launch();
      await scenarioSession.navigate('https://example.com');

      const result = await scenarioSession.getElementText('#text-element');

      expect(result.success).toBe(true);
      expect(result.data).toBe('Hello World');
    });
  });

  describe('screenshot operations', () => {
    beforeEach(async () => {
      await session.launch();
      await session.navigate('https://example.com');
    });

    it('should capture screenshot successfully', async () => {
      const result = await session.captureScreenshot();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.format).toBe('png');
      expect(result.data?.data).toBeDefined();
    });

    it('should capture screenshot with options', async () => {
      const result = await session.captureScreenshot({
        type: 'jpeg',
        quality: 80,
      });

      expect(result.success).toBe(true);
      expect(result.data?.format).toBe('jpeg');
    });

    it('should emit screenshot events', async () => {
      const screenshotSpy = vi.fn();
      session.on('screenshot', screenshotSpy);

      const options = { type: 'png' as const };
      await session.captureScreenshot(options);

      expect(screenshotSpy).toHaveBeenCalledWith(
        options,
        expect.objectContaining({
          format: 'png',
          data: expect.any(String),
        })
      );
    });
  });

  describe('operation tracking', () => {
    beforeEach(async () => {
      await session.launch();
    });

    it('should track all operations', async () => {
      await session.navigate('https://example.com');
      await session.clickElement('#content');
      await session.captureScreenshot();

      const operations = session.getOperationHistory();

      expect(operations).toHaveLength(4); // launch, navigate, click, screenshot
      expect(operations.map(op => op.name)).toEqual([
        'launch',
        'navigate',
        'clickElement',
        'captureScreenshot',
      ]);
    });

    it('should track operation timing', async () => {
      await session.navigate('https://example.com');

      const operations = session.getOperationHistory();
      const navOperation = operations.find(op => op.name === 'navigate');

      expect(navOperation?.startTime).toBeDefined();
      expect(navOperation?.endTime).toBeDefined();
      expect(navOperation?.endTime!).toBeGreaterThan(navOperation?.startTime!);
    });

    it('should disable operation tracking when configured', () => {
      const noTrackSession = new MockBrowserSession({
        trackOperations: false,
      });

      expect(noTrackSession.getOperationHistory()).toHaveLength(0);
    });
  });

  describe('failure simulation', () => {
    it('should simulate random failures with failure rate', async () => {
      const unreliableSession = new MockBrowserSession({
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 10,
          failureRate: 1.0, // 100% failure rate
          useRealisticDelays: false,
        },
      });

      await unreliableSession.launch(); // This might fail

      // Try multiple operations - with 100% failure rate, some should fail
      const results = await Promise.all([
        unreliableSession.navigate('https://example.com'),
        unreliableSession.elementExists('#test'),
        unreliableSession.captureScreenshot(),
      ]);

      // With 100% failure rate, at least some operations should fail
      const failures = results.filter(result => !result.success);
      expect(failures.length).toBeGreaterThan(0);
    });
  });

  describe('close operation', () => {
    it('should close session successfully', async () => {
      await session.launch();
      const result = await session.close();

      expect(result.success).toBe(true);
    });

    it('should track close operation', async () => {
      await session.launch();
      await session.close();

      const operations = session.getOperationHistory();
      const closeOperation = operations.find(op => op.name === 'close');

      expect(closeOperation).toBeDefined();
      expect(closeOperation?.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Create a session that will throw an error during operation
      const errorSession = new MockBrowserSession({
        scenarioConfig: {
          operations: {
            navigate: {
              success: false,
              error: 'Unexpected navigation error',
            },
          },
        },
      });

      await errorSession.launch();
      const result = await errorSession.navigate('https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected navigation error');
    });
  });
});