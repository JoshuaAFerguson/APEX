/**
 * Comprehensive Browser Tool Tests
 *
 * Tests for the BrowserTool implementation covering:
 * - Core browser operations (navigate, click, type, screenshot, etc.)
 * - Permission management integration
 * - Multiple backend support (Playwright/Puppeteer)
 * - Error handling and edge cases
 * - Resource management and lifecycle
 * - Configuration-based restrictions
 * - Dangerous operation handling
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { BrowserTool, BrowserToolConfig, BrowserResult } from './browser-tool';
import { PermissionManager } from '../permission-manager';
import {
  BrowserPermissionDeniedError,
  isBrowserPermissionDeniedError,
  ApexError,
  ApexErrorCode
} from '@apexcli/core';

// Mock Playwright modules
const mockPage = {
  on: vi.fn(),
  url: vi.fn(() => 'https://test.example.com'),
  title: vi.fn(() => 'Test Page'),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  click: vi.fn(),
  fill: vi.fn(),
  type: vi.fn(),
  hover: vi.fn(),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-screenshot'))),
  locator: vi.fn(() => ({
    screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-element-screenshot'))),
    evaluate: vi.fn(),
    scrollIntoViewIfNeeded: vi.fn(),
  })),
  evaluate: vi.fn(),
  waitForSelector: vi.fn(),
  getAttribute: vi.fn(),
  textContent: vi.fn(() => 'Test text content'),
  innerHTML: vi.fn(() => '<p>Test HTML</p>'),
  content: vi.fn(() => '<html><body>Full page content</body></html>'),
  pdf: vi.fn(() => Promise.resolve(Buffer.from('mock-pdf'))),
  close: vi.fn(),
  viewportSize: vi.fn(() => ({ width: 1920, height: 1080 })),
  $eval: vi.fn(),
  $: vi.fn(),
};

const mockContext = {
  newPage: vi.fn(() => Promise.resolve(mockPage)),
  close: vi.fn(),
  on: vi.fn(),
};

const mockBrowser = {
  newContext: vi.fn(() => Promise.resolve(mockContext)),
  close: vi.fn(),
};

const mockBrowserType = {
  launch: vi.fn(() => Promise.resolve(mockBrowser)),
};

// Mock Playwright
vi.mock('playwright', () => ({
  chromium: mockBrowserType,
  firefox: mockBrowserType,
  webkit: mockBrowserType,
}));

// Mock Puppeteer
const mockPuppeteerPage = {
  url: vi.fn(() => 'https://test.example.com'),
  title: vi.fn(() => 'Test Page'),
  goto: vi.fn(() => Promise.resolve({ status: 200 })),
  click: vi.fn(),
  type: vi.fn(),
  hover: vi.fn(),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-screenshot'))),
  evaluate: vi.fn(),
  waitForSelector: vi.fn(),
  $eval: vi.fn(),
  $: vi.fn(() => ({
    screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-element-screenshot'))),
  })),
  setViewport: vi.fn(),
  setUserAgent: vi.fn(),
  viewport: vi.fn(() => ({ width: 1920, height: 1080 })),
  on: vi.fn(),
  close: vi.fn(),
};

const mockPuppeteerBrowser = {
  newPage: vi.fn(() => Promise.resolve(mockPuppeteerPage)),
  close: vi.fn(),
};

const mockPuppeteer = {
  launch: vi.fn(() => Promise.resolve(mockPuppeteerBrowser)),
};

// Mock dynamic import for Puppeteer
vi.mock('puppeteer', () => ({
  default: mockPuppeteer,
}));

// Mock file system operations
vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => Buffer.from('mock-file-content')),
  writeFileSync: vi.fn(),
}));

// Mock pixelmatch
vi.mock('pixelmatch', () => ({
  default: vi.fn(() => 100), // 100 different pixels
}));

// Mock pngjs
vi.mock('pngjs', () => ({
  PNG: {
    sync: {
      read: vi.fn(() => ({
        width: 800,
        height: 600,
        data: Buffer.alloc(800 * 600 * 4),
      })),
      write: vi.fn(() => Buffer.from('mock-png')),
    },
  },
}));

describe('BrowserTool', () => {
  let browserTool: BrowserTool;
  let mockPermissionManager: Partial<PermissionManager>;
  let mockEventEmitter: EventEmitter;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock responses
    mockBrowserType.launch.mockResolvedValue(mockBrowser);
    mockBrowser.newContext.mockResolvedValue(mockContext);
    mockContext.newPage.mockResolvedValue(mockPage);
    mockPuppeteer.launch.mockResolvedValue(mockPuppeteerBrowser);
    mockPuppeteerBrowser.newPage.mockResolvedValue(mockPuppeteerPage);

    // Create mock permission manager
    mockPermissionManager = {
      checkToolPermission: vi.fn(() => Promise.resolve({
        allowed: true,
        level: 'full',
        requiresConfirmation: false,
      })),
      getToolConfig: vi.fn(() => Promise.resolve({
        enabled: true,
        allowJavaScriptExecution: true,
        allowFormSubmission: true,
        allowScreenshots: true,
        allowedDomains: ['test.example.com', 'app.example.com'],
        blockedDomains: ['blocked.example.com'],
      } as BrowserToolConfig)),
    };

    mockEventEmitter = new EventEmitter();

    browserTool = new BrowserTool({
      permissionManager: mockPermissionManager as PermissionManager,
      eventEmitter: mockEventEmitter,
    });
  });

  afterEach(async () => {
    try {
      await browserTool.cleanup();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Constructor and Configuration', () => {
    it('should create instance with default options', () => {
      const tool = new BrowserTool();
      expect(tool).toBeInstanceOf(BrowserTool);
      expect(tool.getState()).toBe('idle');
    });

    it('should create instance with custom options', () => {
      const tool = new BrowserTool({
        engine: 'firefox',
        backend: 'puppeteer',
        headless: false,
      });
      expect(tool).toBeInstanceOf(BrowserTool);
    });

    it('should allow runtime permission manager injection', () => {
      const tool = new BrowserTool();
      tool.setPermissionManager(mockPermissionManager as PermissionManager);
      expect(() => tool.setPermissionManager(mockPermissionManager as PermissionManager)).not.toThrow();
    });

    it('should allow runtime event emitter injection', () => {
      const tool = new BrowserTool();
      const emitter = new EventEmitter();
      tool.setEventEmitter(emitter);
      expect(() => tool.setEventEmitter(emitter)).not.toThrow();
    });
  });

  describe('Permission Management', () => {
    it('should check permissions before executing operations', async () => {
      const result = await browserTool.checkPermission('navigate', 'https://test.example.com');

      expect(result.allowed).toBe(true);
      expect(mockPermissionManager.checkToolPermission).toHaveBeenCalledWith(
        'Browser',
        expect.objectContaining({
          scope: 'navigate:https://test.example.com',
          consumeAllowOnce: false,
        })
      );
    });

    it('should allow operations when no permission manager is set', async () => {
      const tool = new BrowserTool();
      const result = await tool.checkPermission('navigate', 'https://test.example.com');

      expect(result.allowed).toBe(true);
      expect(result.level).toBe(null);
    });

    it('should deny operations when permission is denied', async () => {
      (mockPermissionManager.checkToolPermission as Mock).mockResolvedValue({
        allowed: false,
        level: null,
        requiresConfirmation: false,
        denialReason: 'Domain not allowed',
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://denied.example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser permission denied');
      expect(result.metadata?.permissionGranted).toBe(false);
    });

    it('should emit permission denied events', async () => {
      (mockPermissionManager.checkToolPermission as Mock).mockResolvedValue({
        allowed: false,
        denialReason: 'Domain not allowed',
      });

      const permissionDeniedSpy = vi.fn();
      mockEventEmitter.on('permission:denied', permissionDeniedSpy);

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://denied.example.com' }
      });

      expect(permissionDeniedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'navigate',
          target: 'https://denied.example.com',
          denialReason: 'Domain not allowed',
        })
      );
    });
  });

  describe('Configuration-based Restrictions', () => {
    it('should block operations when tool is disabled', async () => {
      (mockPermissionManager.getToolConfig as Mock).mockResolvedValue({
        enabled: false,
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser tool is disabled');
    });

    it('should block navigation to blocked domains', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://blocked.example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Domain blocked.example.com is blocked');
    });

    it('should block navigation to domains not in allowlist', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://not-allowed.example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Domain not-allowed.example.com is not in allowlist');
    });

    it('should block JavaScript execution when disabled', async () => {
      (mockPermissionManager.getToolConfig as Mock).mockResolvedValue({
        enabled: true,
        allowJavaScriptExecution: false,
      });

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'console.log("test")' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('JavaScript execution is disabled');
    });

    it('should block form submissions when disabled', async () => {
      (mockPermissionManager.getToolConfig as Mock).mockResolvedValue({
        enabled: true,
        allowFormSubmission: false,
      });

      const result = await browserTool.execute({
        operation: 'submit',
        params: { selector: '#test-form' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Form submission is disabled');
    });

    it('should block screenshots when disabled', async () => {
      (mockPermissionManager.getToolConfig as Mock).mockResolvedValue({
        enabled: true,
        allowScreenshots: false,
      });

      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Screenshots are disabled');
    });
  });

  describe('Browser Operations - Playwright Backend', () => {
    it('should execute navigation operation successfully', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('navigate');
      expect(result.data).toEqual({ url: 'https://test.example.com', status: 200 });
      expect(result.metadata?.url).toBe('https://test.example.com');
      expect(result.metadata?.permissionGranted).toBe(true);
      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://test.example.com',
        expect.objectContaining({ waitUntil: 'load' })
      );
    });

    it('should execute click operation successfully', async () => {
      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: '#test-button' }
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('click');
      expect(result.data).toEqual({ clicked: '#test-button' });
      expect(mockPage.click).toHaveBeenCalledWith('#test-button', expect.any(Object));
    });

    it('should execute type operation successfully', async () => {
      const result = await browserTool.execute({
        operation: 'type',
        params: { selector: '#test-input', text: 'test text' }
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('type');
      expect(result.data).toEqual({ typed: 'test text', into: '#test-input' });
      expect(mockPage.fill).toHaveBeenCalledWith('#test-input', 'test text');
    });

    it('should execute type operation with clearFirst option', async () => {
      const result = await browserTool.execute({
        operation: 'type',
        params: { selector: '#test-input', text: 'test text', clearFirst: true }
      });

      expect(result.success).toBe(true);
      expect(mockPage.fill).toHaveBeenCalledWith('#test-input', '');
      expect(mockPage.fill).toHaveBeenCalledWith('#test-input', 'test text');
    });

    it('should execute screenshot operation successfully', async () => {
      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true, format: 'png' }
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('screenshot');
      expect(result.screenshot).toContain('data:image/png;base64,');
      expect(mockPage.screenshot).toHaveBeenCalledWith({
        path: undefined,
        fullPage: true,
        type: 'png',
        quality: undefined,
      });
    });

    it('should execute element screenshot operation', async () => {
      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { selector: '#test-element', format: 'png' }
      });

      expect(result.success).toBe(true);
      expect(mockPage.locator).toHaveBeenCalledWith('#test-element');
    });

    it('should execute evaluate operation successfully', async () => {
      mockPage.evaluate.mockResolvedValue('evaluation result');

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'return document.title;' }
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('evaluate');
      expect(result.data).toEqual({ result: 'evaluation result' });
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should execute submit operation successfully', async () => {
      const result = await browserTool.execute({
        operation: 'submit',
        params: { selector: '#test-form', validate: true }
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('submit');
      expect(result.data).toEqual({ submitted: '#test-form' });
    });

    it('should execute waitForSelector operation successfully', async () => {
      const result = await browserTool.execute({
        operation: 'waitForSelector',
        params: { selector: '#test-element', timeout: 5000, visible: true }
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('waitForSelector');
      expect(result.data).toEqual({ found: '#test-element' });
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('#test-element', {
        timeout: 5000,
        state: 'visible',
      });
    });

    it('should execute getAttribute operation successfully', async () => {
      mockPage.getAttribute.mockResolvedValue('test-value');

      const result = await browserTool.execute({
        operation: 'getAttribute',
        params: { selector: '#test-element', attribute: 'data-value' }
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('getAttribute');
      expect(result.data).toEqual({ attribute: 'data-value', value: 'test-value' });
    });

    it('should execute getText operation successfully', async () => {
      const result = await browserTool.execute({
        operation: 'getText',
        params: { selector: '#test-element' }
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('getText');
      expect(result.data).toEqual({ text: 'Test text content' });
    });

    it('should execute getHtml operation for element successfully', async () => {
      const result = await browserTool.execute({
        operation: 'getHtml',
        params: { selector: '#test-element' }
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('getHtml');
      expect(result.data).toEqual({ html: '<p>Test HTML</p>' });
    });

    it('should execute getHtml operation for full page successfully', async () => {
      const result = await browserTool.execute({
        operation: 'getHtml',
        params: {}
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ html: '<html><body>Full page content</body></html>' });
    });

    it('should execute scroll operation with coordinates', async () => {
      const result = await browserTool.execute({
        operation: 'scroll',
        params: { x: 100, y: 200 }
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('scroll');
      expect(result.data).toEqual({ scrolled: '100,200' });
    });

    it('should execute scroll operation with selector', async () => {
      const result = await browserTool.execute({
        operation: 'scroll',
        params: { selector: '#test-element' }
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ scrolled: '#test-element' });
    });

    it('should execute hover operation successfully', async () => {
      const result = await browserTool.execute({
        operation: 'hover',
        params: { selector: '#test-element' }
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('hover');
      expect(result.data).toEqual({ hovered: '#test-element' });
    });

    it('should execute PDF generation successfully', async () => {
      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: { format: 'A4', landscape: false }
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('generatePdf');
      expect(result.screenshot).toContain('data:application/pdf;base64,');
      expect(mockPage.pdf).toHaveBeenCalled();
    });
  });

  describe('Browser Operations - Puppeteer Backend', () => {
    beforeEach(() => {
      browserTool = new BrowserTool({
        backend: 'puppeteer',
        permissionManager: mockPermissionManager as PermissionManager,
      });
    });

    it('should execute navigation with Puppeteer backend', async () => {
      mockPuppeteerPage.goto.mockResolvedValue({ status: 200 });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      expect(result.success).toBe(true);
      expect(mockPuppeteerPage.goto).toHaveBeenCalled();
    });

    it('should execute type operation with Puppeteer backend', async () => {
      const result = await browserTool.execute({
        operation: 'type',
        params: { selector: '#test-input', text: 'test text', delay: 100 }
      });

      expect(result.success).toBe(true);
      expect(mockPuppeteerPage.click).toHaveBeenCalledWith('#test-input');
      expect(mockPuppeteerPage.type).toHaveBeenCalledWith('#test-input', 'test text', { delay: 100 });
    });

    it('should handle PDF generation error with Puppeteer', async () => {
      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: { format: 'A4' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('PDF generation is only supported with Playwright using Chromium browser');
    });

    it('should handle getAttribute with Puppeteer backend', async () => {
      mockPuppeteerPage.$eval.mockResolvedValue('test-value');

      const result = await browserTool.execute({
        operation: 'getAttribute',
        params: { selector: '#test-element', attribute: 'data-value' }
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ attribute: 'data-value', value: 'test-value' });
      expect(mockPuppeteerPage.$eval).toHaveBeenCalled();
    });

    it('should handle getText with Puppeteer backend', async () => {
      mockPuppeteerPage.$eval.mockResolvedValue('Test text content');

      const result = await browserTool.execute({
        operation: 'getText',
        params: { selector: '#test-element' }
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ text: 'Test text content' });
    });
  });

  describe('Visual Regression Testing', () => {
    const fs = await import('fs');
    const PNG = await import('pngjs');
    const pixelmatch = await import('pixelmatch');

    beforeEach(() => {
      (fs.existsSync as Mock).mockReturnValue(true);
      (PNG.PNG.sync.read as Mock).mockReturnValue({
        width: 800,
        height: 600,
        data: Buffer.alloc(800 * 600 * 4),
      });
      (pixelmatch.default as Mock).mockReturnValue(100);
    });

    it('should execute visual comparison successfully', async () => {
      const result = await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: '/path/to/baseline.png',
          threshold: 0.1,
          fullPage: true,
        }
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('compareScreenshot');
      expect(result.data).toMatchObject({
        differentPixels: 100,
        totalPixels: 480000,
        threshold: 0.1,
        isMatch: expect.any(Boolean),
      });
    });

    it('should handle missing baseline screenshot', async () => {
      (fs.existsSync as Mock).mockReturnValue(false);

      const result = await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: '/path/to/missing.png',
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Baseline screenshot not found');
    });

    it('should handle screenshot size mismatch', async () => {
      (PNG.PNG.sync.read as Mock)
        .mockReturnValueOnce({ width: 800, height: 600, data: Buffer.alloc(800 * 600 * 4) })
        .mockReturnValueOnce({ width: 1200, height: 800, data: Buffer.alloc(1200 * 800 * 4) });

      const result = await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: '/path/to/baseline.png',
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Screenshot size mismatch');
    });

    it('should emit visual comparison events', async () => {
      const visualComparisonSpy = vi.fn();
      mockEventEmitter.on('visual:comparison:passed', visualComparisonSpy);

      (pixelmatch.default as Mock).mockReturnValue(10); // Low difference

      await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: '/path/to/baseline.png',
          threshold: 0.1,
          testId: 'test-123',
        }
      });

      expect(visualComparisonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          testId: 'test-123',
          passed: true,
          diffPercentage: expect.any(Number),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle browser launch failures', async () => {
      mockBrowserType.launch.mockRejectedValue(new Error('Browser launch failed'));

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser launch failed');
    });

    it('should handle page operation failures', async () => {
      mockPage.click.mockRejectedValue(new Error('Element not found'));

      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: '#non-existent' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Element not found');
    });

    it('should handle unsupported operations', async () => {
      const result = await browserTool.execute({
        operation: 'unsupported' as any,
        params: {} as any
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported operation: unsupported');
    });

    it('should handle BrowserPermissionDeniedError gracefully', async () => {
      const permissionError = new BrowserPermissionDeniedError(
        'Test permission denied',
        {
          operation: 'navigate',
          target: 'https://test.example.com',
          denialReason: 'Test denial',
          permissionType: 'domain',
          sessionId: 'test-session'
        }
      );

      mockPage.goto.mockRejectedValue(permissionError);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Test permission denied');
      expect(isBrowserPermissionDeniedError(permissionError)).toBe(true);
    });
  });

  describe('Resource Management and Lifecycle', () => {
    it('should track resource state correctly', async () => {
      expect(browserTool.getState()).toBe('idle');
      expect(browserTool.isActive()).toBe(false);

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      expect(browserTool.getState()).toBe('active');
      expect(browserTool.isActive()).toBe(true);

      const resourceState = browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(true);
      expect(resourceState.contextActive).toBe(true);
      expect(resourceState.pageActive).toBe(true);
      expect(resourceState.sessionId).toBeDefined();
    });

    it('should cleanup resources properly', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      expect(browserTool.isActive()).toBe(true);

      await browserTool.cleanup();

      expect(browserTool.getState()).toBe('destroyed');
      expect(mockPage.close).toHaveBeenCalled();
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should prevent operations on destroyed instance', async () => {
      await browserTool.cleanup();

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('BrowserTool instance has been destroyed');
    });

    it('should handle cleanup failures gracefully', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      mockPage.close.mockRejectedValue(new Error('Page close failed'));
      mockContext.close.mockRejectedValue(new Error('Context close failed'));
      mockBrowser.close.mockRejectedValue(new Error('Browser close failed'));

      // Should not throw, but log warnings
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(browserTool.cleanup()).rejects.toThrow(ApexError);

      consoleSpy.mockRestore();
    });

    it('should force destroy resources when cleanup fails', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      mockPage.close.mockRejectedValue(new Error('Cleanup failed'));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await browserTool.destroy();

      expect(browserTool.getState()).toBe('destroyed');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Normal cleanup failed, forcing resource reset:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should emit state transition events', async () => {
      const stateTransitionSpy = vi.fn();
      mockEventEmitter.on('browser:state:transition', stateTransitionSpy);

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      expect(stateTransitionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          previousState: 'idle',
          newState: 'launching',
        })
      );

      expect(stateTransitionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          previousState: 'launching',
          newState: 'active',
        })
      );
    });

    it('should prevent multiple concurrent page initialization', async () => {
      const promise1 = browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test1.example.com' }
      });

      const promise2 = browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test2.example.com' }
      });

      await Promise.all([promise1, promise2]);

      // Should only launch one browser instance
      expect(mockBrowserType.launch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Console and Error Capture', () => {
    it('should capture console messages during operations', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      expect(result.metadata?.consoleMessages).toBeDefined();
      expect(result.metadata?.runtimeErrors).toBeDefined();
      expect(result.metadata?.enhancedConsoleMessages).toBeDefined();
      expect(result.metadata?.enhancedRuntimeErrors).toBeDefined();
    });

    it('should provide access to console stream', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      const consoleStream = browserTool.getConsoleStream();
      expect(consoleStream).toBeDefined();
    });

    it('should clear console buffers on command', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      browserTool.clearConsoleBuffers();

      const messages = browserTool.getEnhancedConsoleMessages();
      const errors = browserTool.getEnhancedRuntimeErrors();

      expect(messages).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Dangerous Operations', () => {
    it('should identify evaluate as dangerous operation', async () => {
      (mockPermissionManager.checkToolPermission as Mock).mockResolvedValue({
        allowed: true,
        level: null, // No explicit permission level
        requiresConfirmation: false,
      });

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'console.log("dangerous")' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous operation requires explicit permission');
    });

    it('should allow dangerous operations with explicit permission level', async () => {
      (mockPermissionManager.checkToolPermission as Mock).mockResolvedValue({
        allowed: true,
        level: 'full',
        requiresConfirmation: false,
      });

      mockPage.evaluate.mockResolvedValue('safe execution');

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'return "safe"' }
      });

      expect(result.success).toBe(true);
    });

    it('should identify submit as dangerous operation', async () => {
      (mockPermissionManager.checkToolPermission as Mock).mockResolvedValue({
        allowed: true,
        level: null,
        requiresConfirmation: false,
      });

      const result = await browserTool.execute({
        operation: 'submit',
        params: { selector: '#dangerous-form' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous operation requires explicit permission');
    });
  });

  describe('Target Extraction', () => {
    it('should extract correct targets for different operations', async () => {
      const testCases = [
        {
          operation: 'navigate' as const,
          params: { url: 'https://test.example.com' },
          expectedTarget: 'https://test.example.com'
        },
        {
          operation: 'click' as const,
          params: { selector: '#button' },
          expectedTarget: '#button'
        },
        {
          operation: 'screenshot' as const,
          params: { selector: '#element' },
          expectedTarget: '#element'
        },
        {
          operation: 'screenshot' as const,
          params: {},
          expectedTarget: 'viewport'
        }
      ];

      for (const testCase of testCases) {
        const result = await browserTool.checkPermission(
          testCase.operation,
          testCase.expectedTarget
        );
        expect(result.allowed).toBe(true);
        expect(mockPermissionManager.checkToolPermission).toHaveBeenCalledWith(
          'Browser',
          expect.objectContaining({
            scope: `${testCase.operation}:${testCase.expectedTarget}`
          })
        );
      }
    });
  });
});