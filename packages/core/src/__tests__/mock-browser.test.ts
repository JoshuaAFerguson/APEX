/**
 * @fileoverview Unit Tests for Browser Mock Classes
 *
 * This test suite comprehensively tests the mock browser classes in
 * `packages/core/src/tools/browser/mock-browser.ts` covering all mock classes,
 * testing both success and failure scenarios, configuration options, and edge cases.
 *
 * Test Coverage:
 * - MockBrowserConfig schema validation
 * - MockElementImpl class functionality
 * - MockPageImpl class functionality
 * - MockBrowserImpl class functionality
 * - Factory functions for different browser modes
 * - Error simulation and edge cases
 * - Network condition simulation
 * - Utility functions and mock data creation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MockBrowserImpl,
  MockPageImpl,
  MockElementImpl,
  MockBrowserConfigSchema,
  MockBrowserModeSchema,
  MockBrowserErrorTypeSchema,
  MockNetworkConditionSchema,
  MockOperationOutcomeSchema,
  createSuccessMockBrowser,
  createFailureMockBrowser,
  createIntermittentMockBrowser,
  createRealisticMockBrowser,
  createSequenceMockBrowser,
  createMockScreenshotComparison,
  createMockConsoleMessages,
  createMockBrowserErrors,
  type MockBrowserConfig,
  type MockBrowserMode,
  type MockBrowserErrorType,
  type MockNetworkCondition,
  type MockOperationOutcome,
  type MockElement,
  type MockPage,
  type MockBrowser,
} from '../tools/browser/mock-browser.js';

describe('MockBrowser Schema Validation', () => {
  describe('MockBrowserConfigSchema', () => {
    it('should validate with default values', () => {
      const result = MockBrowserConfigSchema.parse({});
      expect(result.mode).toBe('success');
      expect(result.successProbability).toBe(0.8);
      expect(result.operationSequence).toEqual([]);
      expect(result.operationOverrides).toEqual({});
      expect(result.simulateConsole).toBe(false);
      expect(result.simulateErrors).toBe(false);
      expect(result.pageTitle).toBe('Mock Page Title');
      expect(result.currentUrl).toBe('https://mock.example.com');
      expect(result.viewport.width).toBe(1280);
      expect(result.viewport.height).toBe(720);
    });

    it('should validate with custom configuration', () => {
      const config = {
        mode: 'intermittent' as MockBrowserMode,
        successProbability: 0.9,
        operationSequence: [{ success: true, delay: 100 }],
        operationOverrides: {
          click: { success: false, errorType: 'timeout' as MockBrowserErrorType }
        },
        networkConditions: { latency: 100, packetLoss: 0.05 },
        simulateConsole: true,
        simulateErrors: true,
        pageTitle: 'Test Page',
        currentUrl: 'https://test.com',
        viewport: { width: 1920, height: 1080 }
      };

      const result = MockBrowserConfigSchema.parse(config);
      expect(result).toEqual(expect.objectContaining(config));
    });

    it('should reject invalid mode values', () => {
      expect(() => MockBrowserConfigSchema.parse({ mode: 'invalid' }))
        .toThrow();
    });

    it('should reject invalid success probability', () => {
      expect(() => MockBrowserConfigSchema.parse({ successProbability: 1.5 }))
        .toThrow();
      expect(() => MockBrowserConfigSchema.parse({ successProbability: -0.1 }))
        .toThrow();
    });
  });

  describe('MockBrowserModeSchema', () => {
    it('should validate all supported modes', () => {
      const validModes = ['success', 'failure', 'intermittent', 'sequence', 'realistic'];
      validModes.forEach(mode => {
        expect(() => MockBrowserModeSchema.parse(mode)).not.toThrow();
      });
    });
  });

  describe('MockBrowserErrorTypeSchema', () => {
    it('should validate all supported error types', () => {
      const validErrors = [
        'timeout', 'element_not_found', 'network_error', 'javascript_error',
        'navigation_error', 'permission_denied', 'browser_crash', 'invalid_selector'
      ];
      validErrors.forEach(errorType => {
        expect(() => MockBrowserErrorTypeSchema.parse(errorType)).not.toThrow();
      });
    });
  });

  describe('MockNetworkConditionSchema', () => {
    it('should validate with default values', () => {
      const result = MockNetworkConditionSchema.parse({});
      expect(result.latency).toBe(0);
      expect(result.packetLoss).toBe(0);
      expect(result.connectionFailure).toBe(0);
      expect(result.timeoutProbability).toBe(0);
    });

    it('should reject negative values', () => {
      expect(() => MockNetworkConditionSchema.parse({ latency: -10 })).toThrow();
      expect(() => MockNetworkConditionSchema.parse({ packetLoss: -0.1 })).toThrow();
    });

    it('should reject probability values above 1', () => {
      expect(() => MockNetworkConditionSchema.parse({ packetLoss: 1.1 })).toThrow();
      expect(() => MockNetworkConditionSchema.parse({ connectionFailure: 2.0 })).toThrow();
    });
  });

  describe('MockOperationOutcomeSchema', () => {
    it('should validate minimal outcome', () => {
      const result = MockOperationOutcomeSchema.parse({ success: true });
      expect(result.success).toBe(true);
      expect(result.delay).toBe(0);
    });

    it('should validate complete outcome', () => {
      const outcome = {
        success: false,
        errorType: 'timeout' as MockBrowserErrorType,
        errorMessage: 'Custom error message',
        delay: 500,
        result: { customData: 'test' }
      };

      const result = MockOperationOutcomeSchema.parse(outcome);
      expect(result).toEqual(outcome);
    });
  });
});

describe('MockElementImpl', () => {
  let mockElement: MockElement;
  let config: MockBrowserConfig;

  beforeEach(() => {
    config = MockBrowserConfigSchema.parse({ mode: 'success' });
    mockElement = new MockElementImpl('#test-button', config);
  });

  describe('constructor and properties', () => {
    it('should create element with default properties', () => {
      expect(mockElement.tagName).toBe('button');
      expect(mockElement.textContent).toBe('Mock text for #test-button');
      expect(mockElement.visible).toBe(true);
      expect(mockElement.boundingBox).toEqual({ x: 0, y: 0, width: 100, height: 30 });
    });

    it('should infer tag from selector', () => {
      const inputElement = new MockElementImpl('input[type="text"]', config);
      expect(inputElement.tagName).toBe('input');

      const formElement = new MockElementImpl('form.login', config);
      expect(formElement.tagName).toBe('form');

      const linkElement = new MockElementImpl('a.nav-link', config);
      expect(linkElement.tagName).toBe('a');

      const divElement = new MockElementImpl('.container', config);
      expect(divElement.tagName).toBe('div');
    });

    it('should use custom attributes', () => {
      const customAttributes = {
        tagName: 'span',
        textContent: 'Custom text',
        innerHTML: '<b>Bold text</b>',
        visible: 'false'
      };

      const customElement = new MockElementImpl('#custom', config, customAttributes);
      expect(customElement.tagName).toBe('span');
      expect(customElement.textContent).toBe('Custom text');
      expect(customElement.innerHTML).toBe('<b>Bold text</b>');
      expect(customElement.visible).toBe(false);
      expect(customElement.boundingBox).toBeNull();
    });
  });

  describe('click method', () => {
    it('should succeed in success mode', async () => {
      await expect(mockElement.click()).resolves.not.toThrow();
    });

    it('should handle click with options', async () => {
      await expect(mockElement.click({ delay: 100, force: true })).resolves.not.toThrow();
    });

    it('should fail in failure mode', async () => {
      const failureConfig = MockBrowserConfigSchema.parse({ mode: 'failure' });
      const failureElement = new MockElementImpl('#button', failureConfig);

      await expect(failureElement.click()).rejects.toThrow('[element_not_found]');
    });

    it('should respect operation overrides', async () => {
      const overrideConfig = MockBrowserConfigSchema.parse({
        operationOverrides: {
          click: { success: false, errorType: 'timeout', errorMessage: 'Click timeout' }
        }
      });
      const overrideElement = new MockElementImpl('#button', overrideConfig);

      await expect(overrideElement.click()).rejects.toThrow('[timeout] Click timeout');
    });
  });

  describe('type method', () => {
    it('should type text successfully', async () => {
      await mockElement.type('Hello World');
      expect(mockElement.textContent).toBe('Mock text for #test-buttonHello World');
    });

    it('should clear and type with clear option', async () => {
      await mockElement.type('New Text', { clear: true });
      expect(mockElement.textContent).toBe('New Text');
    });

    it('should handle empty text', async () => {
      await mockElement.type('');
      expect(mockElement.textContent).toBe('Mock text for #test-button');
    });

    it('should fail in failure mode', async () => {
      const failureConfig = MockBrowserConfigSchema.parse({ mode: 'failure' });
      const failureElement = new MockElementImpl('#input', failureConfig);

      await expect(failureElement.type('text')).rejects.toThrow();
    });
  });

  describe('hover method', () => {
    it('should succeed in success mode', async () => {
      await expect(mockElement.hover()).resolves.not.toThrow();
    });

    it('should fail in failure mode', async () => {
      const failureConfig = MockBrowserConfigSchema.parse({ mode: 'failure' });
      const failureElement = new MockElementImpl('#button', failureConfig);

      await expect(failureElement.hover()).rejects.toThrow();
    });
  });

  describe('getAttribute method', () => {
    it('should return null for non-existent attributes', async () => {
      const result = await mockElement.getAttribute('nonexistent');
      expect(result).toBeNull();
    });

    it('should return existing attribute values', async () => {
      mockElement.attributes['class'] = 'test-class';
      const result = await mockElement.getAttribute('class');
      expect(result).toBe('test-class');
    });
  });

  describe('getText method', () => {
    it('should return current text content', async () => {
      const text = await mockElement.getText();
      expect(text).toBe('Mock text for #test-button');
    });
  });

  describe('getHtml method', () => {
    it('should return current innerHTML', async () => {
      const html = await mockElement.getHtml();
      expect(html).toBe('<span>Mock text for #test-button</span>');
    });
  });

  describe('isVisible method', () => {
    it('should return visibility state', async () => {
      expect(await mockElement.isVisible()).toBe(true);

      mockElement.visible = false;
      expect(await mockElement.isVisible()).toBe(false);
    });
  });

  describe('waitForState method', () => {
    it('should succeed for visible state when element is visible', async () => {
      await expect(mockElement.waitForState('visible')).resolves.not.toThrow();
    });

    it('should succeed for hidden state when element is hidden', async () => {
      mockElement.visible = false;
      await expect(mockElement.waitForState('hidden')).resolves.not.toThrow();
    });

    it('should succeed for attached state', async () => {
      await expect(mockElement.waitForState('attached')).resolves.not.toThrow();
    });

    it('should timeout when state is not reached', async () => {
      // Mock element is visible, waiting for hidden should timeout quickly
      await expect(mockElement.waitForState('hidden', { timeout: 100 }))
        .rejects.toThrow('Element did not reach state \'hidden\' within 100ms');
    });
  });

  describe('intermittent mode', () => {
    it('should sometimes succeed and sometimes fail', async () => {
      const intermittentConfig = MockBrowserConfigSchema.parse({
        mode: 'intermittent',
        successProbability: 0.5
      });

      // Mock Math.random to control outcomes
      const originalRandom = Math.random;
      let callCount = 0;
      vi.spyOn(Math, 'random').mockImplementation(() => {
        callCount++;
        return callCount % 2 === 0 ? 0.3 : 0.7; // Alternate between success and failure
      });

      const element = new MockElementImpl('#test', intermittentConfig);

      // First call should succeed (0.3 < 0.5)
      await expect(element.click()).resolves.not.toThrow();

      // Second call should fail (0.7 >= 0.5)
      await expect(element.click()).rejects.toThrow();

      Math.random = originalRandom;
    });
  });

  describe('realistic mode', () => {
    it('should include delays and occasional failures', async () => {
      const realisticConfig = MockBrowserConfigSchema.parse({
        mode: 'realistic',
        realisticDelays: { click: 100 }
      });

      // Mock Math.random to ensure success
      vi.spyOn(Math, 'random').mockReturnValue(0.9); // Less than 0.95, so should succeed

      const element = new MockElementImpl('#test', realisticConfig);

      const startTime = Date.now();
      await element.click();
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThan(50); // Should have some delay
      vi.restoreAllMocks();
    });
  });

  describe('sequence mode', () => {
    it('should follow predefined sequence', async () => {
      const sequenceConfig = MockBrowserConfigSchema.parse({
        mode: 'sequence',
        operationSequence: [
          { success: true, delay: 10 },
          { success: false, errorType: 'timeout' },
          { success: true, delay: 20 }
        ]
      });

      const element = new MockElementImpl('#test', sequenceConfig);

      // First call should succeed
      await expect(element.click()).resolves.not.toThrow();

      // Second call should fail
      await expect(element.click()).rejects.toThrow('[timeout]');

      // Third call should succeed
      await expect(element.click()).resolves.not.toThrow();

      // Fourth call should cycle back to first (succeed)
      await expect(element.click()).resolves.not.toThrow();
    });
  });
});

describe('MockPageImpl', () => {
  let mockPage: MockPage;
  let config: MockBrowserConfig;

  beforeEach(() => {
    config = MockBrowserConfigSchema.parse({
      mode: 'success',
      pageTitle: 'Test Page',
      currentUrl: 'https://test.example.com'
    });
    mockPage = new MockPageImpl(config);
  });

  describe('constructor and basic properties', () => {
    it('should initialize with config values', () => {
      expect(mockPage.url()).toBe('https://test.example.com');
    });

    it('should setup default elements', async () => {
      const bodyElement = await mockPage.$('body');
      expect(bodyElement).not.toBeNull();
      expect(bodyElement?.tagName).toBe('body');
    });
  });

  describe('url method', () => {
    it('should return current URL', () => {
      expect(mockPage.url()).toBe('https://test.example.com');
    });
  });

  describe('title method', () => {
    it('should return page title', async () => {
      const title = await mockPage.title();
      expect(title).toBe('Test Page');
    });

    it('should fail in failure mode', async () => {
      const failurePage = new MockPageImpl(MockBrowserConfigSchema.parse({ mode: 'failure' }));
      await expect(failurePage.title()).rejects.toThrow();
    });
  });

  describe('goto method', () => {
    it('should navigate to new URL', async () => {
      await mockPage.goto('https://newsite.com');
      expect(mockPage.url()).toBe('https://newsite.com');
    });

    it('should handle navigation timeout option', async () => {
      await expect(mockPage.goto('https://example.com', { timeout: 5000 }))
        .resolves.not.toThrow();
    });

    it('should fail in failure mode', async () => {
      const failurePage = new MockPageImpl(MockBrowserConfigSchema.parse({ mode: 'failure' }));
      await expect(failurePage.goto('https://example.com')).rejects.toThrow();
    });
  });

  describe('element selection', () => {
    describe('$ method', () => {
      it('should return existing element', async () => {
        const element = await mockPage.$('button');
        expect(element).not.toBeNull();
        expect(element?.tagName).toBe('button');
      });

      it('should create new element for unknown selector', async () => {
        const element = await mockPage.$('#new-element');
        expect(element).not.toBeNull();
        expect(element?.tagName).toBe('div'); // Default inferred tag
      });

      it('should return same element for repeated calls', async () => {
        const element1 = await mockPage.$('#same-element');
        const element2 = await mockPage.$('#same-element');
        expect(element1).toBe(element2);
      });
    });

    describe('$$ method', () => {
      it('should return array with single element', async () => {
        const elements = await mockPage.$$('button');
        expect(Array.isArray(elements)).toBe(true);
        expect(elements.length).toBe(1);
        expect(elements[0]?.tagName).toBe('button');
      });

      it('should return empty array for non-existent elements in failure mode', async () => {
        // Even in success mode, if the single element selection fails, return empty array
        const elements = await mockPage.$$('non-existent-element');
        expect(Array.isArray(elements)).toBe(true);
      });
    });

    describe('waitForSelector method', () => {
      it('should return element when found', async () => {
        const element = await mockPage.waitForSelector('#test-element');
        expect(element).not.toBeNull();
      });

      it('should wait for element state', async () => {
        const element = await mockPage.waitForSelector('#test-element', {
          timeout: 5000,
          state: 'visible'
        });
        expect(element).not.toBeNull();
      });

      it('should handle timeout option', async () => {
        await expect(mockPage.waitForSelector('#element', { timeout: 100 }))
          .resolves.not.toThrow();
      });
    });
  });

  describe('screenshot method', () => {
    it('should return mock screenshot data by default', async () => {
      const screenshot = await mockPage.screenshot();
      expect(screenshot).toMatch(/^data:image\/png;base64,/);
    });

    it('should return path when path option provided', async () => {
      const screenshot = await mockPage.screenshot({ path: '/tmp/test.png' });
      expect(screenshot).toBe('/tmp/test.png');
    });

    it('should handle all screenshot options', async () => {
      const options = {
        path: '/tmp/full.png',
        fullPage: true,
        format: 'png' as const,
        quality: 90
      };

      const screenshot = await mockPage.screenshot(options);
      expect(screenshot).toBe('/tmp/full.png');
    });

    it('should fail in failure mode', async () => {
      const failurePage = new MockPageImpl(MockBrowserConfigSchema.parse({ mode: 'failure' }));
      await expect(failurePage.screenshot()).rejects.toThrow();
    });
  });

  describe('evaluate method', () => {
    it('should execute function scripts', async () => {
      const result = await mockPage.evaluate(() => 'function result');
      expect(result).toBe('function result');
    });

    it('should handle function scripts that throw', async () => {
      await expect(mockPage.evaluate(() => { throw new Error('test error'); }))
        .rejects.toThrow('[javascript_error] test error');
    });

    it('should return mock values for string scripts', async () => {
      const titleResult = await mockPage.evaluate('document.title');
      expect(titleResult).toBe('Test Page');

      const urlResult = await mockPage.evaluate('window.location.href');
      expect(urlResult).toBe('https://test.example.com');

      const nullResult = await mockPage.evaluate('some.other.script');
      expect(nullResult).toBeNull();
    });
  });

  describe('form interaction', () => {
    describe('submitForm method', () => {
      it('should submit existing form', async () => {
        await expect(mockPage.submitForm('form')).resolves.not.toThrow();
      });

      it('should throw error for non-existent form', async () => {
        // Create a page that will return null for the form selector
        const customPage = new MockPageImpl(config);

        // Override the $ method to return null for the specific selector
        const originalDollar = customPage.$;
        customPage.$ = async (selector: string) => {
          if (selector === '#non-existent-form') {
            return null;
          }
          return originalDollar.call(customPage, selector);
        };

        await expect(customPage.submitForm('#non-existent-form'))
          .rejects.toThrow('[element_not_found] Form #non-existent-form not found');
      });
    });
  });

  describe('scroll method', () => {
    it('should scroll with default options', async () => {
      await expect(mockPage.scroll()).resolves.not.toThrow();
    });

    it('should scroll with specific coordinates', async () => {
      await expect(mockPage.scroll({ x: 100, y: 200 })).resolves.not.toThrow();
    });
  });

  describe('setViewportSize method', () => {
    it('should update viewport configuration', async () => {
      const newSize = { width: 1920, height: 1080 };
      await mockPage.setViewportSize(newSize);
      expect(config.viewport).toEqual(newSize);
    });
  });

  describe('console and error management', () => {
    it('should return empty arrays by default', () => {
      expect(mockPage.getConsoleMessages()).toEqual([]);
      expect(mockPage.getBrowserErrors()).toEqual([]);
    });

    it('should clear console messages and errors', () => {
      mockPage.clearConsole();
      expect(mockPage.getConsoleMessages()).toEqual([]);
      expect(mockPage.getBrowserErrors()).toEqual([]);
    });

    it('should emit console messages when configured', async () => {
      const consoleConfig = MockBrowserConfigSchema.parse({
        simulateConsole: true,
        consoleMessages: [
          { severity: 'info', message: 'Page loaded', operation: 'navigate' }
        ]
      });

      const consolePage = new MockPageImpl(consoleConfig);
      await consolePage.goto('https://example.com');

      const messages = consolePage.getConsoleMessages();
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].message).toBe('Page loaded');
      expect(messages[0].severity).toBe('info');
    });

    it('should emit browser errors when configured', async () => {
      const errorConfig = MockBrowserConfigSchema.parse({
        simulateErrors: true,
        browserErrors: [
          { name: 'NetworkError', message: 'Failed to load', operation: 'navigate' }
        ]
      });

      const errorPage = new MockPageImpl(errorConfig);
      await errorPage.goto('https://example.com');

      const errors = errorPage.getBrowserErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toBe('Failed to load');
      expect(errors[0].name).toBe('NetworkError');
    });
  });

  describe('close method', () => {
    it('should clear elements', async () => {
      await mockPage.$('#test-element'); // Create an element
      await mockPage.close();

      // After close, should create new elements
      const newElement = await mockPage.$('#test-element');
      expect(newElement).not.toBeNull(); // New element should be created
    });
  });

  describe('network conditions', () => {
    it('should simulate network latency', async () => {
      const networkConfig = MockBrowserConfigSchema.parse({
        networkConditions: { latency: 100 }
      });

      const networkPage = new MockPageImpl(networkConfig);
      const startTime = Date.now();
      await networkPage.goto('https://example.com');
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThan(80); // Should include latency
    });

    it('should simulate connection failures', async () => {
      const failureConfig = MockBrowserConfigSchema.parse({
        networkConditions: { connectionFailure: 1.0 } // 100% failure rate
      });

      const failurePage = new MockPageImpl(failureConfig);
      await expect(failurePage.goto('https://example.com'))
        .rejects.toThrow('[network_error] Connection failed');
    });

    it('should simulate timeouts', async () => {
      const timeoutConfig = MockBrowserConfigSchema.parse({
        networkConditions: { timeoutProbability: 1.0 } // 100% timeout rate
      });

      const timeoutPage = new MockPageImpl(timeoutConfig);
      await expect(timeoutPage.goto('https://example.com'))
        .rejects.toThrow('[timeout] Operation timed out');
    });
  });
});

describe('MockBrowserImpl', () => {
  let mockBrowser: MockBrowser;
  let config: MockBrowserConfig;

  beforeEach(() => {
    config = MockBrowserConfigSchema.parse({ mode: 'success' });
    mockBrowser = new MockBrowserImpl(config);
  });

  describe('constructor', () => {
    it('should create browser with default config', () => {
      const defaultBrowser = new MockBrowserImpl();
      expect(defaultBrowser).toBeInstanceOf(MockBrowserImpl);
    });

    it('should create browser with custom config', () => {
      const customConfig = { mode: 'failure' as MockBrowserMode };
      const customBrowser = new MockBrowserImpl(customConfig);
      expect(customBrowser).toBeInstanceOf(MockBrowserImpl);
    });
  });

  describe('newPage method', () => {
    it('should create and track new pages', async () => {
      const page1 = await mockBrowser.newPage();
      const page2 = await mockBrowser.newPage();

      expect(page1).toBeInstanceOf(MockPageImpl);
      expect(page2).toBeInstanceOf(MockPageImpl);
      expect(page1).not.toBe(page2);

      const pages = mockBrowser.pages();
      expect(pages).toHaveLength(2);
      expect(pages).toContain(page1);
      expect(pages).toContain(page2);
    });
  });

  describe('pages method', () => {
    it('should return empty array initially', () => {
      expect(mockBrowser.pages()).toEqual([]);
    });

    it('should return copy of pages array', async () => {
      await mockBrowser.newPage();
      const pages1 = mockBrowser.pages();
      const pages2 = mockBrowser.pages();

      expect(pages1).toEqual(pages2);
      expect(pages1).not.toBe(pages2); // Should be different array instances
    });
  });

  describe('close method', () => {
    it('should close all pages', async () => {
      const page1 = await mockBrowser.newPage();
      const page2 = await mockBrowser.newPage();

      expect(mockBrowser.pages()).toHaveLength(2);

      await mockBrowser.close();

      expect(mockBrowser.pages()).toEqual([]);
    });

    it('should handle closing with no pages', async () => {
      await expect(mockBrowser.close()).resolves.not.toThrow();
    });
  });

  describe('version method', () => {
    it('should return browser version', () => {
      expect(mockBrowser.version()).toBe('MockBrowser 1.0.0');
    });
  });

  describe('setUserAgent method', () => {
    it('should set user agent', async () => {
      await expect(mockBrowser.setUserAgent('Custom Agent 1.0'))
        .resolves.not.toThrow();
    });
  });
});

describe('Factory Functions', () => {
  describe('createSuccessMockBrowser', () => {
    it('should create browser with success mode', async () => {
      const browser = createSuccessMockBrowser();
      const page = await browser.newPage();

      await expect(page.goto('https://example.com')).resolves.not.toThrow();
      await expect(page.screenshot()).resolves.toBeDefined();
    });

    it('should accept custom config', async () => {
      const browser = createSuccessMockBrowser({ pageTitle: 'Custom Title' });
      const page = await browser.newPage();

      const title = await page.title();
      expect(title).toBe('Custom Title');
    });
  });

  describe('createFailureMockBrowser', () => {
    it('should create browser with failure mode', async () => {
      const browser = createFailureMockBrowser();
      const page = await browser.newPage();

      await expect(page.goto('https://example.com')).rejects.toThrow();
    });

    it('should use specified error type', async () => {
      const browser = createFailureMockBrowser('network_error');
      const page = await browser.newPage();

      await expect(page.goto('https://example.com'))
        .rejects.toThrow('[network_error]');
    });

    it('should accept custom config', async () => {
      const browser = createFailureMockBrowser('timeout', { pageTitle: 'Failure Page' });
      const page = await browser.newPage();

      // Title should work even in failure mode since it's not overridden
      const title = await page.title();
      expect(title).toBe('Failure Page');
    });
  });

  describe('createIntermittentMockBrowser', () => {
    it('should create browser with intermittent mode', () => {
      const browser = createIntermittentMockBrowser(0.7);
      expect(browser).toBeInstanceOf(MockBrowserImpl);
    });

    it('should use default success probability', () => {
      const browser = createIntermittentMockBrowser();
      expect(browser).toBeInstanceOf(MockBrowserImpl);
    });

    it('should accept custom config', () => {
      const browser = createIntermittentMockBrowser(0.9, { pageTitle: 'Intermittent Page' });
      expect(browser).toBeInstanceOf(MockBrowserImpl);
    });
  });

  describe('createRealisticMockBrowser', () => {
    it('should create browser with realistic simulation', async () => {
      const browser = createRealisticMockBrowser();
      const page = await browser.newPage();

      // Should have network latency
      const startTime = Date.now();
      await page.goto('https://example.com');
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThan(30); // Should include some delay

      // Should have console messages
      const messages = page.getConsoleMessages();
      expect(messages.length).toBeGreaterThan(0);
    });

    it('should accept custom config', async () => {
      const browser = createRealisticMockBrowser({ pageTitle: 'Realistic Page' });
      const page = await browser.newPage();

      const title = await page.title();
      expect(title).toBe('Realistic Page');
    });
  });

  describe('createSequenceMockBrowser', () => {
    it('should follow operation sequence', async () => {
      const sequence = [
        { success: true, delay: 10 },
        { success: false, errorType: 'timeout' as MockBrowserErrorType }
      ];

      const browser = createSequenceMockBrowser(sequence);
      const page = await browser.newPage();

      // First operation should succeed
      await expect(page.goto('https://example.com')).resolves.not.toThrow();

      // Second operation should fail
      await expect(page.screenshot()).rejects.toThrow('[timeout]');
    });

    it('should accept custom config', () => {
      const sequence = [{ success: true }];
      const browser = createSequenceMockBrowser(sequence, { pageTitle: 'Sequence Page' });
      expect(browser).toBeInstanceOf(MockBrowserImpl);
    });
  });
});

describe('Utility Functions', () => {
  describe('createMockScreenshotComparison', () => {
    it('should create matching comparison by default', () => {
      const comparison = createMockScreenshotComparison();

      expect(comparison.isMatch).toBe(true);
      expect(comparison.similarity).toBe(1.0);
      expect(comparison.differentPixels).toBe(0);
      expect(comparison.totalPixels).toBe(100000);
      expect(comparison.dimensions).toEqual({ width: 1280, height: 720 });
      expect(comparison.diffImagePath).toBeUndefined();
    });

    it('should create non-matching comparison', () => {
      const comparison = createMockScreenshotComparison(false, 0.85);

      expect(comparison.isMatch).toBe(false);
      expect(comparison.similarity).toBe(0.85);
      expect(comparison.differentPixels).toBe(1000);
      expect(comparison.diffImagePath).toBe('/tmp/diff.png');
    });

    it('should handle custom parameters', () => {
      const comparison = createMockScreenshotComparison(true, 0.99);

      expect(comparison.isMatch).toBe(true);
      expect(comparison.similarity).toBe(0.99);
      expect(comparison.differentPixels).toBe(0);
    });
  });

  describe('createMockConsoleMessages', () => {
    it('should create array of console messages', () => {
      const messages = createMockConsoleMessages();

      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBe(3);

      expect(messages[0].severity).toBe('info');
      expect(messages[0].message).toBe('Page initialized');
      expect(messages[0].sourceUrl).toBe('https://mock.example.com');

      expect(messages[1].severity).toBe('warn');
      expect(messages[1].lineNumber).toBe(42);

      expect(messages[2].severity).toBe('error');
      expect(messages[2].lineNumber).toBe(15);
      expect(messages[2].columnNumber).toBe(30);
    });

    it('should have timestamps', () => {
      const messages = createMockConsoleMessages();
      messages.forEach(message => {
        expect(message.timestamp).toBeInstanceOf(Date);
      });
    });
  });

  describe('createMockBrowserErrors', () => {
    it('should create array of browser errors', () => {
      const errors = createMockBrowserErrors();

      expect(Array.isArray(errors)).toBe(true);
      expect(errors.length).toBe(2);

      expect(errors[0].name).toBe('TypeError');
      expect(errors[0].message).toBe('Cannot read property of undefined');
      expect(errors[0].sourceUrl).toBe('https://mock.example.com');
      expect(errors[0].lineNumber).toBe(25);

      expect(errors[1].name).toBe('NetworkError');
      expect(errors[1].message).toBe('Failed to fetch resource');
    });

    it('should have timestamps', () => {
      const errors = createMockBrowserErrors();
      errors.forEach(error => {
        expect(error.timestamp).toBeInstanceOf(Date);
      });
    });
  });
});

describe('Edge Cases and Error Scenarios', () => {
  describe('invalid configurations', () => {
    it('should handle invalid mode gracefully with schema validation', () => {
      expect(() => MockBrowserConfigSchema.parse({ mode: 'invalid-mode' }))
        .toThrow();
    });

    it('should handle invalid probabilities gracefully', () => {
      expect(() => MockBrowserConfigSchema.parse({ successProbability: 2.0 }))
        .toThrow();
    });
  });

  describe('operation sequence edge cases', () => {
    it('should handle empty operation sequence', async () => {
      const config = MockBrowserConfigSchema.parse({
        mode: 'sequence',
        operationSequence: []
      });

      const element = new MockElementImpl('#test', config);
      // Should fall back to default success behavior
      await expect(element.click()).resolves.not.toThrow();
    });

    it('should cycle through sequence repeatedly', async () => {
      const config = MockBrowserConfigSchema.parse({
        mode: 'sequence',
        operationSequence: [
          { success: true },
          { success: false, errorType: 'timeout' }
        ]
      });

      const element = new MockElementImpl('#test', config);

      // Test multiple cycles
      await expect(element.click()).resolves.not.toThrow(); // success
      await expect(element.click()).rejects.toThrow(); // failure
      await expect(element.click()).resolves.not.toThrow(); // success again
      await expect(element.click()).rejects.toThrow(); // failure again
    });
  });

  describe('network condition edge cases', () => {
    it('should handle extreme network conditions', async () => {
      const extremeConfig = MockBrowserConfigSchema.parse({
        networkConditions: {
          latency: 1000,
          packetLoss: 0.5,
          connectionFailure: 0.0, // No failures to ensure test completes
          timeoutProbability: 0.0
        }
      });

      const page = new MockPageImpl(extremeConfig);

      const startTime = Date.now();
      await page.goto('https://example.com');
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThan(900); // Should include high latency
    });
  });

  describe('element selector edge cases', () => {
    it('should handle complex CSS selectors', async () => {
      const config = MockBrowserConfigSchema.parse({ mode: 'success' });
      const page = new MockPageImpl(config);

      const complexSelectors = [
        'div.class[data-test="value"]',
        'button:nth-child(2)',
        'input[type="email"][required]',
        '#id > .class + .sibling'
      ];

      for (const selector of complexSelectors) {
        const element = await page.$(selector);
        expect(element).not.toBeNull();
      }
    });
  });

  describe('memory and resource management', () => {
    it('should properly clean up resources on close', async () => {
      const browser = new MockBrowserImpl();
      const pages = [];

      // Create multiple pages
      for (let i = 0; i < 5; i++) {
        pages.push(await browser.newPage());
      }

      expect(browser.pages()).toHaveLength(5);

      // Close browser
      await browser.close();

      expect(browser.pages()).toHaveLength(0);
    });

    it('should handle concurrent operations', async () => {
      const config = MockBrowserConfigSchema.parse({
        mode: 'success',
        networkConditions: { latency: 10 }
      });

      const page = new MockPageImpl(config);

      // Run multiple operations concurrently
      const promises = [
        page.goto('https://example1.com'),
        page.screenshot(),
        page.evaluate('document.title'),
        page.$('#test-element'),
        page.scroll({ x: 100, y: 200 })
      ];

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });

  describe('error message formatting', () => {
    it('should format error messages consistently', async () => {
      const failureConfig = MockBrowserConfigSchema.parse({
        operationOverrides: {
          click: {
            success: false,
            errorType: 'element_not_found',
            errorMessage: 'Custom error message'
          }
        }
      });

      const element = new MockElementImpl('#test', failureConfig);

      await expect(element.click())
        .rejects.toThrow('[element_not_found] Custom error message');
    });

    it('should use default error messages when not specified', async () => {
      const failureConfig = MockBrowserConfigSchema.parse({
        operationOverrides: {
          hover: {
            success: false,
            errorType: 'timeout'
          }
        }
      });

      const element = new MockElementImpl('#test', failureConfig);

      await expect(element.hover())
        .rejects.toThrow('[timeout] Mock hover operation failed');
    });
  });
});