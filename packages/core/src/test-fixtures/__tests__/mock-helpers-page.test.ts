/**
 * @fileoverview Tests for createPageMock helper
 *
 * Tests the createPageMock function for browser/playwright page object mocking.
 * Covers default behavior, override merging, and mock function verification.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPageMock } from '../mock-helpers.js';

describe('createPageMock', () => {
  let pageMock: ReturnType<typeof createPageMock>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('default behavior', () => {
    beforeEach(() => {
      pageMock = createPageMock();
    });

    it('should create navigation methods', () => {
      expect(pageMock.goto).toBeDefined();
      expect(vi.isMockFunction(pageMock.goto)).toBe(true);
      expect(pageMock.goto).toHaveLength(0);
    });

    it('should create page property methods', () => {
      expect(pageMock.url).toBeDefined();
      expect(vi.isMockFunction(pageMock.url)).toBe(true);
      expect(pageMock.url()).toBe('https://example.com');

      expect(pageMock.title).toBeDefined();
      expect(vi.isMockFunction(pageMock.title)).toBe(true);

      expect(pageMock.content).toBeDefined();
      expect(vi.isMockFunction(pageMock.content)).toBe(true);
    });

    it('should create element interaction methods', () => {
      expect(pageMock.click).toBeDefined();
      expect(vi.isMockFunction(pageMock.click)).toBe(true);

      expect(pageMock.type).toBeDefined();
      expect(vi.isMockFunction(pageMock.type)).toBe(true);

      expect(pageMock.fill).toBeDefined();
      expect(vi.isMockFunction(pageMock.fill)).toBe(true);

      expect(pageMock.selectOption).toBeDefined();
      expect(vi.isMockFunction(pageMock.selectOption)).toBe(true);
    });

    it('should create waiting methods', () => {
      expect(pageMock.waitForSelector).toBeDefined();
      expect(vi.isMockFunction(pageMock.waitForSelector)).toBe(true);

      expect(pageMock.waitForTimeout).toBeDefined();
      expect(vi.isMockFunction(pageMock.waitForTimeout)).toBe(true);

      expect(pageMock.waitForLoadState).toBeDefined();
      expect(vi.isMockFunction(pageMock.waitForLoadState)).toBe(true);
    });

    it('should create screenshot and evaluation methods', () => {
      expect(pageMock.screenshot).toBeDefined();
      expect(vi.isMockFunction(pageMock.screenshot)).toBe(true);

      expect(pageMock.evaluate).toBeDefined();
      expect(vi.isMockFunction(pageMock.evaluate)).toBe(true);
    });

    it('should create locator method', () => {
      expect(pageMock.locator).toBeDefined();
      expect(vi.isMockFunction(pageMock.locator)).toBe(true);

      const locator = pageMock.locator('selector');
      expect(locator).toBeDefined();
      expect(locator.click).toBeDefined();
      expect(locator.fill).toBeDefined();
      expect(locator.textContent).toBeDefined();
      expect(locator.isVisible).toBeDefined();
      expect(locator.isHidden).toBeDefined();
      expect(locator.first).toBeDefined();
      expect(locator.last).toBeDefined();
    });

    it('should create event handling methods', () => {
      expect(pageMock.on).toBeDefined();
      expect(vi.isMockFunction(pageMock.on)).toBe(true);

      expect(pageMock.off).toBeDefined();
      expect(vi.isMockFunction(pageMock.off)).toBe(true);
    });
  });

  describe('default return values', () => {
    beforeEach(() => {
      pageMock = createPageMock();
    });

    it('should return appropriate default values for async navigation', async () => {
      await expect(pageMock.goto('https://example.com')).resolves.toBeUndefined();
    });

    it('should return default page properties', async () => {
      expect(pageMock.url()).toBe('https://example.com');
      await expect(pageMock.title()).resolves.toBe('Test Page');
      await expect(pageMock.content()).resolves.toBe('<html><body>Mock content</body></html>');
    });

    it('should return appropriate values for interaction methods', async () => {
      await expect(pageMock.click('button')).resolves.toBeUndefined();
      await expect(pageMock.type('input', 'text')).resolves.toBeUndefined();
      await expect(pageMock.fill('input', 'value')).resolves.toBeUndefined();
      await expect(pageMock.selectOption('select', 'option')).resolves.toEqual([]);
    });

    it('should return appropriate values for waiting methods', async () => {
      await expect(pageMock.waitForSelector('selector')).resolves.toEqual({});
      await expect(pageMock.waitForTimeout(1000)).resolves.toBeUndefined();
      await expect(pageMock.waitForLoadState('networkidle')).resolves.toBeUndefined();
    });

    it('should return mock screenshot data', async () => {
      const screenshot = await pageMock.screenshot();
      expect(Buffer.isBuffer(screenshot)).toBe(true);
      expect(screenshot.toString()).toBe('fake-screenshot');
    });

    it('should execute evaluation functions', async () => {
      const result = await pageMock.evaluate(() => 'test result');
      expect(result).toBe('test result');

      const mathResult = await pageMock.evaluate((a: number, b: number) => a + b, 2, 3);
      expect(mathResult).toBe(5);
    });

    it('should return mock locator with default behavior', async () => {
      const locator = pageMock.locator('test-selector');

      await expect(locator.click()).resolves.toBeUndefined();
      await expect(locator.fill('text')).resolves.toBeUndefined();
      await expect(locator.textContent()).resolves.toBe('Mock text');
      await expect(locator.isVisible()).resolves.toBe(true);
      await expect(locator.isHidden()).resolves.toBe(false);

      // Test chaining methods
      expect(locator.first()).toBe(locator);
      expect(locator.last()).toBe(locator);
    });
  });

  describe('override merging', () => {
    it('should merge simple method overrides', () => {
      const customUrl = vi.fn().mockReturnValue('https://custom.com');
      const customClick = vi.fn().mockResolvedValue('clicked');

      pageMock = createPageMock({
        url: customUrl,
        click: customClick,
      });

      expect(pageMock.url).toBe(customUrl);
      expect(pageMock.click).toBe(customClick);
      expect(pageMock.url()).toBe('https://custom.com');

      // Other methods should remain as defaults
      expect(pageMock.goto).toBeDefined();
      expect(vi.isMockFunction(pageMock.goto)).toBe(true);
    });

    it('should override async method implementations', async () => {
      const customTitle = vi.fn().mockResolvedValue('Custom Title');
      const customContent = vi.fn().mockResolvedValue('<div>Custom content</div>');

      pageMock = createPageMock({
        title: customTitle,
        content: customContent,
      });

      await expect(pageMock.title()).resolves.toBe('Custom Title');
      await expect(pageMock.content()).resolves.toBe('<div>Custom content</div>');
      expect(customTitle).toHaveBeenCalled();
      expect(customContent).toHaveBeenCalled();
    });

    it('should override interaction methods', async () => {
      const customFill = vi.fn().mockResolvedValue('filled');
      const customSelectOption = vi.fn().mockResolvedValue(['option1', 'option2']);

      pageMock = createPageMock({
        fill: customFill,
        selectOption: customSelectOption,
      });

      const fillResult = await pageMock.fill('input', 'test');
      const selectResult = await pageMock.selectOption('select', 'value');

      expect(fillResult).toBe('filled');
      expect(selectResult).toEqual(['option1', 'option2']);
      expect(customFill).toHaveBeenCalledWith('input', 'test');
      expect(customSelectOption).toHaveBeenCalledWith('select', 'value');
    });

    it('should override waiting methods with custom behavior', async () => {
      const customWaitForSelector = vi.fn().mockResolvedValue({
        element: 'found',
        visible: true
      });
      const customWaitForTimeout = vi.fn().mockResolvedValue('timeout complete');

      pageMock = createPageMock({
        waitForSelector: customWaitForSelector,
        waitForTimeout: customWaitForTimeout,
      });

      const selectorResult = await pageMock.waitForSelector('.test');
      const timeoutResult = await pageMock.waitForTimeout(500);

      expect(selectorResult).toEqual({ element: 'found', visible: true });
      expect(timeoutResult).toBe('timeout complete');
      expect(customWaitForSelector).toHaveBeenCalledWith('.test');
      expect(customWaitForTimeout).toHaveBeenCalledWith(500);
    });

    it('should override screenshot and evaluate methods', async () => {
      const customScreenshot = vi.fn().mockResolvedValue(Buffer.from('custom-screenshot'));
      const customEvaluate = vi.fn().mockImplementation(async (fn: Function, ...args: any[]) => {
        return `custom: ${fn(...args)}`;
      });

      pageMock = createPageMock({
        screenshot: customScreenshot,
        evaluate: customEvaluate,
      });

      const screenshot = await pageMock.screenshot();
      const evaluated = await pageMock.evaluate((x: number) => x * 2, 5);

      expect(screenshot.toString()).toBe('custom-screenshot');
      expect(evaluated).toBe('custom: 10');
      expect(customScreenshot).toHaveBeenCalled();
      expect(customEvaluate).toHaveBeenCalled();
    });

    it('should override locator method and its return value', () => {
      const customLocator = vi.fn().mockReturnValue({
        click: vi.fn().mockResolvedValue('custom click'),
        fill: vi.fn().mockResolvedValue('custom fill'),
        textContent: vi.fn().mockResolvedValue('custom text'),
        isVisible: vi.fn().mockResolvedValue(false),
        isHidden: vi.fn().mockResolvedValue(true),
        first: vi.fn().mockReturnValue('first element'),
        last: vi.fn().mockReturnValue('last element'),
      });

      pageMock = createPageMock({
        locator: customLocator,
      });

      const locator = pageMock.locator('custom-selector');
      expect(customLocator).toHaveBeenCalledWith('custom-selector');
      expect(locator.textContent).toBeDefined();
    });

    it('should override event handling methods', () => {
      const customOn = vi.fn();
      const customOff = vi.fn();

      pageMock = createPageMock({
        on: customOn,
        off: customOff,
      });

      pageMock.on('load', () => {});
      pageMock.off('load', () => {});

      expect(customOn).toHaveBeenCalled();
      expect(customOff).toHaveBeenCalled();
    });

    it('should handle partial overrides correctly', () => {
      pageMock = createPageMock({
        url: vi.fn().mockReturnValue('https://partial.com'),
        // Only override url, others should use defaults
      });

      expect(pageMock.url()).toBe('https://partial.com');
      expect(vi.isMockFunction(pageMock.goto)).toBe(true);
      expect(vi.isMockFunction(pageMock.title)).toBe(true);
      expect(vi.isMockFunction(pageMock.click)).toBe(true);
    });
  });

  describe('mock function verification', () => {
    beforeEach(() => {
      pageMock = createPageMock();
    });

    describe('call tracking', () => {
      it('should track navigation calls', async () => {
        await pageMock.goto('https://test.com');
        await pageMock.goto('https://test2.com', { waitUntil: 'load' });

        expect(pageMock.goto).toHaveBeenCalledTimes(2);
        expect(pageMock.goto).toHaveBeenCalledWith('https://test.com');
        expect(pageMock.goto).toHaveBeenCalledWith('https://test2.com', { waitUntil: 'load' });
      });

      it('should track property access calls', () => {
        pageMock.url();
        pageMock.url();

        expect(pageMock.url).toHaveBeenCalledTimes(2);
      });

      it('should track interaction calls', async () => {
        await pageMock.click('button');
        await pageMock.type('input', 'hello');
        await pageMock.fill('textarea', 'world');
        await pageMock.selectOption('select', ['option1', 'option2']);

        expect(pageMock.click).toHaveBeenCalledWith('button');
        expect(pageMock.type).toHaveBeenCalledWith('input', 'hello');
        expect(pageMock.fill).toHaveBeenCalledWith('textarea', 'world');
        expect(pageMock.selectOption).toHaveBeenCalledWith('select', ['option1', 'option2']);
      });

      it('should track waiting calls', async () => {
        await pageMock.waitForSelector('.element', { timeout: 5000 });
        await pageMock.waitForTimeout(1000);
        await pageMock.waitForLoadState('networkidle');

        expect(pageMock.waitForSelector).toHaveBeenCalledWith('.element', { timeout: 5000 });
        expect(pageMock.waitForTimeout).toHaveBeenCalledWith(1000);
        expect(pageMock.waitForLoadState).toHaveBeenCalledWith('networkidle');
      });

      it('should track screenshot and evaluation calls', async () => {
        await pageMock.screenshot({ fullPage: true });
        await pageMock.evaluate(() => document.title);

        expect(pageMock.screenshot).toHaveBeenCalledWith({ fullPage: true });
        expect(pageMock.evaluate).toHaveBeenCalledWith(expect.any(Function));
      });

      it('should track locator calls', () => {
        pageMock.locator('first-selector');
        pageMock.locator('second-selector');

        expect(pageMock.locator).toHaveBeenCalledTimes(2);
        expect(pageMock.locator).toHaveBeenCalledWith('first-selector');
        expect(pageMock.locator).toHaveBeenCalledWith('second-selector');
      });

      it('should track event handling calls', () => {
        const handler1 = vi.fn();
        const handler2 = vi.fn();

        pageMock.on('load', handler1);
        pageMock.on('error', handler2);
        pageMock.off('load', handler1);

        expect(pageMock.on).toHaveBeenCalledTimes(2);
        expect(pageMock.on).toHaveBeenCalledWith('load', handler1);
        expect(pageMock.on).toHaveBeenCalledWith('error', handler2);
        expect(pageMock.off).toHaveBeenCalledWith('load', handler1);
      });
    });

    describe('custom implementations', () => {
      it('should allow custom navigation implementation', async () => {
        let currentUrl = 'about:blank';

        pageMock = createPageMock({
          goto: vi.fn().mockImplementation(async (url: string) => {
            currentUrl = url;
            return { url, success: true };
          }),
          url: vi.fn().mockImplementation(() => currentUrl),
        });

        const result = await pageMock.goto('https://example.com');
        expect(result).toEqual({ url: 'https://example.com', success: true });
        expect(pageMock.url()).toBe('https://example.com');
      });

      it('should allow custom interaction implementation', async () => {
        const formData: Record<string, string> = {};

        pageMock = createPageMock({
          fill: vi.fn().mockImplementation(async (selector: string, value: string) => {
            formData[selector] = value;
            return { selector, value, filled: true };
          }),
        });

        await pageMock.fill('input[name="username"]', 'testuser');
        await pageMock.fill('input[name="password"]', 'secret');

        expect(formData).toEqual({
          'input[name="username"]': 'testuser',
          'input[name="password"]': 'secret',
        });
      });

      it('should allow custom waiting implementation with timeouts', async () => {
        pageMock = createPageMock({
          waitForSelector: vi.fn().mockImplementation(async (selector: string, options: any = {}) => {
            const timeout = options.timeout || 5000;
            if (selector === '.never-appears') {
              throw new Error(`Timeout ${timeout}ms exceeded waiting for selector "${selector}"`);
            }
            return { selector, found: true, timeout };
          }),
        });

        const result = await pageMock.waitForSelector('.appears');
        expect(result).toEqual({ selector: '.appears', found: true, timeout: 5000 });

        await expect(pageMock.waitForSelector('.never-appears'))
          .rejects
          .toThrow('Timeout 5000ms exceeded waiting for selector ".never-appears"');
      });

      it('should allow custom evaluation with context', async () => {
        const pageContext = { title: 'Test Page', users: ['Alice', 'Bob'] };

        pageMock = createPageMock({
          evaluate: vi.fn().mockImplementation(async (fn: Function, ...args: any[]) => {
            // Simulate page context
            return fn.call(pageContext, ...args);
          }),
        });

        const title = await pageMock.evaluate(function(this: any) {
          return this.title;
        });
        const userCount = await pageMock.evaluate(function(this: any) {
          return this.users.length;
        });

        expect(title).toBe('Test Page');
        expect(userCount).toBe(2);
      });

      it('should allow custom locator implementation', () => {
        const elements = new Map([
          ['button', { text: 'Click me', visible: true }],
          ['.hidden', { text: 'Hidden', visible: false }],
        ]);

        pageMock = createPageMock({
          locator: vi.fn().mockImplementation((selector: string) => {
            const element = elements.get(selector);
            return {
              click: vi.fn().mockResolvedValue(`clicked ${selector}`),
              fill: vi.fn().mockResolvedValue(`filled ${selector}`),
              textContent: vi.fn().mockResolvedValue(element?.text || 'Not found'),
              isVisible: vi.fn().mockResolvedValue(element?.visible || false),
              isHidden: vi.fn().mockResolvedValue(!element?.visible),
              first: vi.fn().mockReturnThis(),
              last: vi.fn().mockReturnThis(),
            };
          }),
        });

        const buttonLocator = pageMock.locator('button');
        const hiddenLocator = pageMock.locator('.hidden');

        expect(buttonLocator.textContent()).resolves.toBe('Click me');
        expect(buttonLocator.isVisible()).resolves.toBe(true);
        expect(hiddenLocator.isVisible()).resolves.toBe(false);
      });
    });

    describe('mock reset and verification', () => {
      it('should allow mocks to be reset', async () => {
        await pageMock.goto('https://example.com');
        await pageMock.click('button');

        expect(pageMock.goto).toHaveBeenCalledTimes(1);
        expect(pageMock.click).toHaveBeenCalledTimes(1);

        vi.clearAllMocks();

        expect(pageMock.goto).not.toHaveBeenCalled();
        expect(pageMock.click).not.toHaveBeenCalled();

        // Functions should still work after reset
        await pageMock.goto('https://after-reset.com');
        expect(pageMock.goto).toHaveBeenCalledTimes(1);
      });

      it('should maintain mock implementations after reset', async () => {
        const customGoto = vi.fn().mockResolvedValue('custom navigation');

        pageMock = createPageMock({
          goto: customGoto,
        });

        await pageMock.goto('https://example.com');
        expect(customGoto).toHaveBeenCalledTimes(1);

        vi.clearAllMocks();

        // Custom implementation should still work
        const result = await pageMock.goto('https://after-reset.com');
        expect(result).toBe('custom navigation');
        expect(customGoto).toHaveBeenCalledTimes(1);
      });

      it('should allow verification of call order', async () => {
        await pageMock.goto('https://example.com');
        await pageMock.waitForLoadState('networkidle');
        await pageMock.click('button');
        await pageMock.fill('input', 'text');

        const gotoCall = pageMock.goto.mock.invocationCallOrder[0];
        const waitCall = pageMock.waitForLoadState.mock.invocationCallOrder[0];
        const clickCall = pageMock.click.mock.invocationCallOrder[0];
        const fillCall = pageMock.fill.mock.invocationCallOrder[0];

        expect(gotoCall).toBeLessThan(waitCall);
        expect(waitCall).toBeLessThan(clickCall);
        expect(clickCall).toBeLessThan(fillCall);
      });
    });
  });
});