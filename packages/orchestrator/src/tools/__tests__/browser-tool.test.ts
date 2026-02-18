/**
 * Browser Tool Core Functionality Tests
 *
 * Tests the core BrowserTool class functionality including:
 * - Tool initialization and configuration
 * - Permission checking and validation
 * - Browser automation operations (navigate, click, type, screenshot, etc.)
 * - Error handling and edge cases
 * - Configuration validation and restrictions
 * - Backend switching (Playwright vs Puppeteer)
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import {
  BrowserTool,
  BrowserToolConfig,
  BrowserNavigateParams,
  BrowserClickParams,
  BrowserTypeParams,
  BrowserScreenshotParams,
  BrowserEvaluateParams,
  BrowserResult
} from '../browser-tool';
import { PermissionManager } from '../../permission-manager';
import { PermissionLevel } from '@apexcli/core';
import { EventEmitter } from 'eventemitter3';

// Mock Playwright
const mockPage = {
  on: vi.fn(),
  off: vi.fn(),
  url: vi.fn(() => 'https://example.com'),
  title: vi.fn(() => 'Test Page'),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  click: vi.fn(),
  fill: vi.fn(),
  type: vi.fn(),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('screenshot-data'))),
  evaluate: vi.fn(),
  waitForSelector: vi.fn(),
  getAttribute: vi.fn(() => Promise.resolve('test-attribute')),
  textContent: vi.fn(() => Promise.resolve('test content')),
  innerHTML: vi.fn(() => Promise.resolve('<div>test</div>')),
  content: vi.fn(() => Promise.resolve('<!DOCTYPE html><html><body>test</body></html>')),
  hover: vi.fn(),
  locator: vi.fn(() => ({
    screenshot: vi.fn(() => Promise.resolve(Buffer.from('element-screenshot'))),
    scrollIntoViewIfNeeded: vi.fn(),
    evaluate: vi.fn(),
  })),
  viewportSize: vi.fn(() => ({ width: 1280, height: 720 })),
};

const mockContext = {
  newPage: vi.fn(() => Promise.resolve(mockPage)),
  on: vi.fn(),
  close: vi.fn(),
};

const mockBrowser = {
  newContext: vi.fn(() => Promise.resolve(mockContext)),
  close: vi.fn(),
  version: vi.fn(() => '1.40.0'),
  isConnected: vi.fn(() => true),
};

const mockBrowserType = {
  launch: vi.fn(() => Promise.resolve(mockBrowser)),
};

// Mock Playwright modules
vi.mock('playwright', () => ({
  chromium: mockBrowserType,
  firefox: mockBrowserType,
  webkit: mockBrowserType,
}));

// Mock Puppeteer (optional dependency)
vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn(() => Promise.resolve({
      newPage: vi.fn(() => Promise.resolve({
        url: vi.fn(() => 'https://example.com'),
        title: vi.fn(() => 'Test Page'),
        goto: vi.fn(() => Promise.resolve({ status: 200 })),
        click: vi.fn(),
        type: vi.fn(),
        screenshot: vi.fn(() => Promise.resolve(Buffer.from('screenshot-data'))),
        evaluate: vi.fn(),
        waitForSelector: vi.fn(),
        $eval: vi.fn(),
        $: vi.fn(),
        on: vi.fn(),
        viewport: vi.fn(() => ({ width: 1280, height: 720 })),
        setViewport: vi.fn(),
        setUserAgent: vi.fn(),
      })),
    })),
  },
}));

describe('BrowserTool Core Functionality', () => {
  let browserTool: BrowserTool;
  let mockPermissionManager: PermissionManager;
  let eventEmitter: EventEmitter;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock browser responses
    mockBrowser.newContext.mockResolvedValue(mockContext);
    mockContext.newPage.mockResolvedValue(mockPage);

    // Create mock permission manager
    mockPermissionManager = {
      checkToolPermission: vi.fn(() => Promise.resolve({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false,
      })),
      getToolConfig: vi.fn(() => Promise.resolve({
        enabled: true,
        allowJavaScriptExecution: true,
        allowFormSubmission: true,
        allowScreenshots: true,
        allowedDomains: [],
        blockedDomains: [],
      } as BrowserToolConfig)),
    } as any;

    eventEmitter = new EventEmitter();

    browserTool = new BrowserTool({
      permissionManager: mockPermissionManager,
      eventEmitter,
    });
  });

  afterEach(async () => {
    // Clean up any browser resources
    try {
      if (browserTool.getConsoleStream?.()) {
        browserTool.getConsoleStream()?.stopStream();
      }
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Tool Initialization', () => {
    it('should initialize with default settings', () => {
      const tool = new BrowserTool();
      expect(tool).toBeInstanceOf(BrowserTool);
    });

    it('should initialize with custom options', () => {
      const customEventEmitter = new EventEmitter();
      const tool = new BrowserTool({
        engine: 'firefox',
        headless: false,
        backend: 'playwright',
        eventEmitter: customEventEmitter,
      });
      expect(tool).toBeInstanceOf(BrowserTool);
    });

    it('should allow runtime injection of permission manager', () => {
      const tool = new BrowserTool();
      tool.setPermissionManager(mockPermissionManager);
      // Permission manager should be set (verified through behavior in other tests)
    });

    it('should allow runtime injection of event emitter', () => {
      const tool = new BrowserTool();
      const emitter = new EventEmitter();
      tool.setEventEmitter(emitter);
      // Event emitter should be set (verified through behavior in other tests)
    });
  });

  describe('Permission Checking', () => {
    it('should check permissions for navigation operation', async () => {
      const result = await browserTool.checkPermission('navigate', 'https://example.com');

      expect(result).toEqual({
        allowed: true,
        level: 'full',
        requiresConfirmation: false,
      });
      expect(mockPermissionManager.checkToolPermission).toHaveBeenCalledWith(
        'Browser',
        expect.objectContaining({
          scope: 'navigate:https://example.com',
          consumeAllowOnce: false,
        })
      );
    });

    it('should check permissions for dangerous evaluate operation', async () => {
      const result = await browserTool.checkPermission('evaluate', 'script_123abc');

      expect(result.allowed).toBe(true);
      expect(mockPermissionManager.checkToolPermission).toHaveBeenCalledWith(
        'Browser',
        expect.objectContaining({
          scope: 'evaluate:script_123abc',
        })
      );
    });

    it('should allow operations when no permission manager is set', async () => {
      const tool = new BrowserTool();
      const result = await tool.checkPermission('navigate', 'https://example.com');

      expect(result).toEqual({
        allowed: true,
        level: null,
        requiresConfirmation: false,
      });
    });

    it('should handle permission denial', async () => {
      (mockPermissionManager.checkToolPermission as Mock).mockResolvedValue({
        allowed: false,
        level: null,
        requiresConfirmation: false,
        denialReason: 'Domain not allowed',
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://blocked.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Domain not allowed');
      expect(result.metadata?.permissionGranted).toBe(false);
    });
  });

  describe('Configuration Restrictions', () => {
    it('should block operations when tool is disabled', async () => {
      (mockPermissionManager.getToolConfig as Mock).mockResolvedValue({
        enabled: false,
      } as BrowserToolConfig);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Browser tool is disabled');
    });

    it('should block navigation to blocked domains', async () => {
      (mockPermissionManager.getToolConfig as Mock).mockResolvedValue({
        enabled: true,
        blockedDomains: ['blocked.com'],
      } as BrowserToolConfig);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://blocked.com/page' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Domain blocked.com is blocked');
    });

    it('should allow navigation to allowed domains only', async () => {
      (mockPermissionManager.getToolConfig as Mock).mockResolvedValue({
        enabled: true,
        allowedDomains: ['allowed.com'],
      } as BrowserToolConfig);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://other.com/page' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Domain other.com is not in allowlist');
    });

    it('should block JavaScript execution when disabled', async () => {
      (mockPermissionManager.getToolConfig as Mock).mockResolvedValue({
        enabled: true,
        allowJavaScriptExecution: false,
      } as BrowserToolConfig);

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'console.log("test")' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('JavaScript execution is disabled');
    });

    it('should block form submission when disabled', async () => {
      (mockPermissionManager.getToolConfig as Mock).mockResolvedValue({
        enabled: true,
        allowFormSubmission: false,
      } as BrowserToolConfig);

      const result = await browserTool.execute({
        operation: 'submit',
        params: { selector: '#form' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Form submission is disabled');
    });

    it('should block screenshots when disabled', async () => {
      (mockPermissionManager.getToolConfig as Mock).mockResolvedValue({
        enabled: true,
        allowScreenshots: false,
      } as BrowserToolConfig);

      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Screenshots are disabled');
    });
  });

  describe('Browser Automation Operations', () => {
    describe('Navigation', () => {
      it('should navigate to URL successfully', async () => {
        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://example.com/page' },
        });

        expect(result.success).toBe(true);
        expect(result.operation).toBe('navigate');
        expect(result.data).toEqual({
          url: 'https://example.com/page',
          status: 200,
        });
        expect(mockPage.goto).toHaveBeenCalledWith(
          'https://example.com/page',
          expect.objectContaining({
            waitUntil: 'load',
          })
        );
      });

      it('should navigate with custom wait conditions', async () => {
        const result = await browserTool.execute({
          operation: 'navigate',
          params: {
            url: 'https://example.com/page',
            waitUntil: 'networkidle',
            timeout: 5000,
          },
        });

        expect(result.success).toBe(true);
        expect(mockPage.goto).toHaveBeenCalledWith(
          'https://example.com/page',
          expect.objectContaining({
            waitUntil: 'networkidle',
            timeout: 5000,
          })
        );
      });
    });

    describe('Click Operations', () => {
      it('should click element successfully', async () => {
        const result = await browserTool.execute({
          operation: 'click',
          params: { selector: '#button' },
        });

        expect(result.success).toBe(true);
        expect(result.operation).toBe('click');
        expect(result.data).toEqual({
          clicked: '#button',
        });
        expect(mockPage.click).toHaveBeenCalledWith('#button', {});
      });

      it('should click with custom options', async () => {
        const result = await browserTool.execute({
          operation: 'click',
          params: {
            selector: '#button',
            button: 'right',
            clickCount: 2,
            delay: 100,
          },
        });

        expect(result.success).toBe(true);
        expect(mockPage.click).toHaveBeenCalledWith('#button', {
          button: 'right',
          clickCount: 2,
          delay: 100,
        });
      });
    });

    describe('Type Operations', () => {
      it('should type text into element successfully', async () => {
        const result = await browserTool.execute({
          operation: 'type',
          params: {
            selector: '#input',
            text: 'Hello World',
          },
        });

        expect(result.success).toBe(true);
        expect(result.operation).toBe('type');
        expect(result.data).toEqual({
          typed: 'Hello World',
          into: '#input',
        });
        expect(mockPage.fill).toHaveBeenCalledWith('#input', 'Hello World');
      });

      it('should clear input before typing when specified', async () => {
        const result = await browserTool.execute({
          operation: 'type',
          params: {
            selector: '#input',
            text: 'New Text',
            clearFirst: true,
          },
        });

        expect(result.success).toBe(true);
        expect(mockPage.fill).toHaveBeenCalledWith('#input', '');
        expect(mockPage.fill).toHaveBeenCalledWith('#input', 'New Text');
      });

      it('should type with delay when specified', async () => {
        const result = await browserTool.execute({
          operation: 'type',
          params: {
            selector: '#input',
            text: 'Slow Type',
            delay: 100,
          },
        });

        expect(result.success).toBe(true);
        expect(mockPage.click).toHaveBeenCalledWith('#input');
        expect(mockPage.type).toHaveBeenCalledWith('#input', 'Slow Type', { delay: 100 });
      });
    });

    describe('Screenshot Operations', () => {
      it('should take full page screenshot successfully', async () => {
        const result = await browserTool.execute({
          operation: 'screenshot',
          params: { fullPage: true },
        });

        expect(result.success).toBe(true);
        expect(result.operation).toBe('screenshot');
        expect(result.data).toEqual({
          width: 1280,
          height: 720,
          format: 'png',
        });
        expect(result.screenshot).toMatch(/^data:image\/png;base64,/);
        expect(mockPage.screenshot).toHaveBeenCalledWith({
          fullPage: true,
          type: undefined,
          quality: undefined,
          path: undefined,
        });
      });

      it('should take element screenshot', async () => {
        const result = await browserTool.execute({
          operation: 'screenshot',
          params: {
            selector: '#element',
            format: 'jpeg',
            quality: 80,
          },
        });

        expect(result.success).toBe(true);
        expect(result.data?.format).toBe('jpeg');
        expect(mockPage.locator).toHaveBeenCalledWith('#element');
      });

      it('should save screenshot to file', async () => {
        const result = await browserTool.execute({
          operation: 'screenshot',
          params: {
            path: '/tmp/screenshot.png',
            fullPage: true,
          },
        });

        expect(result.success).toBe(true);
        expect(result.screenshot).toBe('/tmp/screenshot.png');
        expect(mockPage.screenshot).toHaveBeenCalledWith({
          path: '/tmp/screenshot.png',
          fullPage: true,
          type: undefined,
          quality: undefined,
        });
      });
    });

    describe('JavaScript Evaluation', () => {
      it('should evaluate JavaScript successfully', async () => {
        mockPage.evaluate.mockResolvedValue('evaluation result');

        const result = await browserTool.execute({
          operation: 'evaluate',
          params: {
            script: 'return document.title;',
          },
        });

        expect(result.success).toBe(true);
        expect(result.operation).toBe('evaluate');
        expect(result.data).toEqual({
          result: 'evaluation result',
        });
        expect(mockPage.evaluate).toHaveBeenCalled();
      });

      it('should evaluate JavaScript with arguments', async () => {
        mockPage.evaluate.mockResolvedValue(42);

        const result = await browserTool.execute({
          operation: 'evaluate',
          params: {
            script: 'return args[0] + args[1];',
            args: [20, 22],
          },
        });

        expect(result.success).toBe(true);
        expect(result.data?.result).toBe(42);
      });
    });

    describe('Wait Operations', () => {
      it('should wait for selector successfully', async () => {
        const result = await browserTool.execute({
          operation: 'waitForSelector',
          params: {
            selector: '#loading',
            timeout: 5000,
            visible: true,
          },
        });

        expect(result.success).toBe(true);
        expect(result.operation).toBe('waitForSelector');
        expect(result.data).toEqual({
          found: '#loading',
        });
        expect(mockPage.waitForSelector).toHaveBeenCalledWith('#loading', {
          timeout: 5000,
          state: 'visible',
        });
      });
    });

    describe('Element Information', () => {
      it('should get element attribute', async () => {
        const result = await browserTool.execute({
          operation: 'getAttribute',
          params: {
            selector: '#link',
            attribute: 'href',
          },
        });

        expect(result.success).toBe(true);
        expect(result.operation).toBe('getAttribute');
        expect(result.data).toEqual({
          attribute: 'href',
          value: 'test-attribute',
        });
        expect(mockPage.getAttribute).toHaveBeenCalledWith('#link', 'href');
      });

      it('should get element text content', async () => {
        const result = await browserTool.execute({
          operation: 'getText',
          params: {
            selector: '#text',
          },
        });

        expect(result.success).toBe(true);
        expect(result.operation).toBe('getText');
        expect(result.data).toEqual({
          text: 'test content',
        });
        expect(mockPage.textContent).toHaveBeenCalledWith('#text');
      });

      it('should get element HTML content', async () => {
        const result = await browserTool.execute({
          operation: 'getHtml',
          params: {
            selector: '#container',
          },
        });

        expect(result.success).toBe(true);
        expect(result.operation).toBe('getHtml');
        expect(result.data).toEqual({
          html: '<div>test</div>',
        });
        expect(mockPage.innerHTML).toHaveBeenCalledWith('#container');
      });

      it('should get full page HTML when no selector provided', async () => {
        const result = await browserTool.execute({
          operation: 'getHtml',
          params: {},
        });

        expect(result.success).toBe(true);
        expect(result.data?.html).toBe('<!DOCTYPE html><html><body>test</body></html>');
        expect(mockPage.content).toHaveBeenCalled();
      });
    });

    describe('Scroll Operations', () => {
      it('should scroll to coordinates', async () => {
        const result = await browserTool.execute({
          operation: 'scroll',
          params: {
            x: 100,
            y: 200,
          },
        });

        expect(result.success).toBe(true);
        expect(result.operation).toBe('scroll');
        expect(result.data).toEqual({
          scrolled: '100,200',
        });
        expect(mockPage.evaluate).toHaveBeenCalled();
      });

      it('should scroll element into view', async () => {
        const result = await browserTool.execute({
          operation: 'scroll',
          params: {
            selector: '#target',
          },
        });

        expect(result.success).toBe(true);
        expect(result.data?.scrolled).toBe('#target');
        expect(mockPage.locator).toHaveBeenCalledWith('#target');
      });
    });

    describe('Hover Operations', () => {
      it('should hover over element successfully', async () => {
        const result = await browserTool.execute({
          operation: 'hover',
          params: {
            selector: '#menu',
          },
        });

        expect(result.success).toBe(true);
        expect(result.operation).toBe('hover');
        expect(result.data).toEqual({
          hovered: '#menu',
        });
        expect(mockPage.hover).toHaveBeenCalledWith('#menu');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle browser operation errors gracefully', async () => {
      mockPage.goto.mockRejectedValue(new Error('Navigation failed'));

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.operation).toBe('navigate');
      expect(result.error).toBe('Navigation failed');
      expect(result.metadata?.permissionGranted).toBe(false);
    });

    it('should handle unknown operations', async () => {
      const result = await browserTool.execute({
        operation: 'unknown' as any,
        params: {} as any,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported operation');
    });

    it('should handle permission manager errors', async () => {
      (mockPermissionManager.checkToolPermission as Mock).mockRejectedValue(
        new Error('Permission check failed')
      );

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission check failed');
    });
  });

  describe('Console and Runtime Error Capture', () => {
    it('should include console messages in operation metadata', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.consoleMessages).toBeDefined();
      expect(result.metadata?.runtimeErrors).toBeDefined();
      expect(result.metadata?.enhancedConsoleMessages).toBeDefined();
      expect(result.metadata?.enhancedRuntimeErrors).toBeDefined();
    });

    it('should provide access to enhanced console messages', () => {
      const messages = browserTool.getEnhancedConsoleMessages();
      expect(Array.isArray(messages)).toBe(true);
    });

    it('should provide access to enhanced runtime errors', () => {
      const errors = browserTool.getEnhancedRuntimeErrors();
      expect(Array.isArray(errors)).toBe(true);
    });

    it('should clear console buffers when requested', () => {
      browserTool.clearConsoleBuffers();
      expect(browserTool.getEnhancedConsoleMessages()).toHaveLength(0);
      expect(browserTool.getEnhancedRuntimeErrors()).toHaveLength(0);
    });
  });

  describe('Metadata and Execution Time', () => {
    it('should include execution metadata in results', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.metadata).toMatchObject({
        url: 'https://example.com',
        title: 'Test Page',
        executionTime: expect.any(Number),
        permissionGranted: true,
        permissionLevel: 'full',
        target: 'https://example.com',
      });
    });

    it('should track execution time accurately', async () => {
      // Introduce a delay to ensure execution time is measured
      mockPage.goto.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { status: () => 200 };
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.metadata?.executionTime).toBeGreaterThan(0);
    });
  });
});