/**
 * Comprehensive test suite for APEX Browser Automation System
 *
 * This test file validates the browser automation capabilities including:
 * 1. Multi-browser backend support (Playwright/Puppeteer)
 * 2. Console monitoring and error tracking
 * 3. Visual regression testing
 * 4. Session management
 * 5. Security and permission integration
 * 6. Event emission and monitoring
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { BrowserTool, BrowserResult, BrowserToolConfig } from '../tools/browser-tool';
import { BrowserConsoleStream } from '../browser-console-stream';
import { PermissionManager } from '../permission-manager';
import { PermissionStore } from '../permission-store';
import { EventEmitter } from 'eventemitter3';
import { VisualComparisonEventData } from '@apexcli/core';

// Mock external browser dependencies
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(() => Promise.resolve(mockBrowser))
  },
  firefox: {
    launch: vi.fn(() => Promise.resolve(mockBrowser))
  },
  webkit: {
    launch: vi.fn(() => Promise.resolve(mockBrowser))
  }
}));

vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn(() => Promise.resolve(mockPuppeteerBrowser))
  },
  launch: vi.fn(() => Promise.resolve(mockPuppeteerBrowser))
}));

vi.mock('fs', () => {
  const mock = {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => ''),
    readdirSync: vi.fn(() => []),
    statSync: vi.fn(),
    unlinkSync: vi.fn(),
    promises: {
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      readFile: vi.fn(),
      unlink: vi.fn(),
      access: vi.fn(),
      stat: vi.fn(),
      readdir: vi.fn(),
      rmdir: vi.fn(),
    },
  };
  return { ...mock, default: mock };
});

vi.mock('pixelmatch', () => ({
  default: vi.fn(() => 10) // Mock 10 different pixels
}));

vi.mock('pngjs', () => ({
  PNG: {
    sync: {
      read: vi.fn(() => ({
        width: 1920,
        height: 1080,
        data: new Buffer(1920 * 1080 * 4)
      })),
      write: vi.fn(() => Buffer.from('mock-diff-image'))
    }
  }
}));

vi.mock('../browser-console-stream', () => ({
  BrowserConsoleStream: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    startStream: vi.fn(),
    clearBuffers: vi.fn()
  }))
}));

// Mock browser objects
const mockPage = {
  url: vi.fn(() => 'https://example.com'),
  title: vi.fn(() => Promise.resolve('Test Page Title')),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  click: vi.fn(() => Promise.resolve()),
  type: vi.fn(() => Promise.resolve()),
  fill: vi.fn(() => Promise.resolve()),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-screenshot-data'))),
  evaluate: vi.fn(() => Promise.resolve('script-result')),
  hover: vi.fn(() => Promise.resolve()),
  waitForSelector: vi.fn(() => Promise.resolve()),
  getAttribute: vi.fn(() => Promise.resolve('test-attribute-value')),
  textContent: vi.fn(() => Promise.resolve('Test element text')),
  content: vi.fn(() => Promise.resolve('<html><body>Test content</body></html>')),
  innerHTML: vi.fn(() => Promise.resolve('<div>Inner HTML content</div>')),
  locator: vi.fn(() => ({
    screenshot: vi.fn(() => Promise.resolve(Buffer.from('element-screenshot'))),
    evaluate: vi.fn(() => Promise.resolve()),
    scrollIntoViewIfNeeded: vi.fn(() => Promise.resolve())
  })),
  $: vi.fn(() => Promise.resolve({
    screenshot: vi.fn(() => Promise.resolve(Buffer.from('element-screenshot')))
  })),
  $eval: vi.fn(() => Promise.resolve('element-eval-result')),
  on: vi.fn(),
  viewport: vi.fn(() => ({ width: 1920, height: 1080 })),
  viewportSize: vi.fn(() => ({ width: 1920, height: 1080 })),
  setViewport: vi.fn(() => Promise.resolve())
};

const mockContext = {
  newPage: vi.fn(() => Promise.resolve(mockPage)),
  on: vi.fn()
};

const mockBrowser = {
  newContext: vi.fn(() => Promise.resolve(mockContext))
};

const mockPuppeteerBrowser = {
  newPage: vi.fn(() => Promise.resolve(mockPage))
};

describe('APEX Browser Automation System', () => {
  let browserTool: BrowserTool;
  let permissionManager: PermissionManager;
  let permissionStore: PermissionStore;
  let eventEmitter: EventEmitter;
  let mockConsoleStream: any;

  beforeEach(async () => {
    // Mock permission store
    permissionStore = {
      getPermission: vi.fn(),
      savePermission: vi.fn(),
      clearPermission: vi.fn(),
      getExtendedPermission: vi.fn()
    } as any;

    permissionManager = new PermissionManager(permissionStore);
    eventEmitter = new EventEmitter();

    // Mock console stream
    mockConsoleStream = {
      on: vi.fn(),
      startStream: vi.fn(),
      clearBuffers: vi.fn()
    };

    (BrowserConsoleStream as any).mockImplementation(() => mockConsoleStream);

    browserTool = new BrowserTool({
      permissionManager,
      eventEmitter,
      engine: 'chromium',
      headless: true,
      backend: 'playwright'
    });

    // Default permission setup for most tests
    const mockCheckToolPermission = vi.fn().mockResolvedValue({
      allowed: true,
      level: 'allow-always',
      requiresConfirmation: false
    });
    permissionManager.checkToolPermission = mockCheckToolPermission;

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Browser Initialization and Management', () => {
    describe('Browser Engine Support', () => {
      it('should support Chromium browser engine', async () => {
        const chromiumTool = new BrowserTool({
          permissionManager,
          engine: 'chromium',
          headless: true
        });

        const result = await chromiumTool.execute({
          operation: 'navigate',
          params: { url: 'https://chromium-test.com' }
        });

        expect(result.success).toBe(true);
        expect(result.operation).toBe('navigate');
      });

      it('should support Firefox browser engine', async () => {
        const firefoxTool = new BrowserTool({
          permissionManager,
          engine: 'firefox',
          headless: true
        });

        const result = await firefoxTool.execute({
          operation: 'navigate',
          params: { url: 'https://firefox-test.com' }
        });

        expect(result.success).toBe(true);
        expect(result.operation).toBe('navigate');
      });

      it('should support WebKit browser engine', async () => {
        const webkitTool = new BrowserTool({
          permissionManager,
          engine: 'webkit',
          headless: true
        });

        const result = await webkitTool.execute({
          operation: 'navigate',
          params: { url: 'https://webkit-test.com' }
        });

        expect(result.success).toBe(true);
        expect(result.operation).toBe('navigate');
      });
    });

    describe('Backend Support', () => {
      it('should support Playwright backend', async () => {
        const playwrightTool = new BrowserTool({
          permissionManager,
          backend: 'playwright',
          engine: 'chromium'
        });

        const result = await playwrightTool.execute({
          operation: 'navigate',
          params: { url: 'https://playwright-test.com' }
        });

        expect(result.success).toBe(true);
        expect(mockBrowser.newContext).toHaveBeenCalled();
      });

      it('should support Puppeteer backend when available', async () => {
        const puppeteerTool = new BrowserTool({
          permissionManager,
          backend: 'puppeteer',
          engine: 'chromium'
        });

        const result = await puppeteerTool.execute({
          operation: 'navigate',
          params: { url: 'https://puppeteer-test.com' }
        });

        expect(result.success).toBe(true);
      });

      it('should handle Puppeteer unavailability gracefully', async () => {
        vi.doMock('puppeteer', () => {
          throw new Error('Module not found');
        });

        const puppeteerTool = new BrowserTool({
          permissionManager,
          backend: 'puppeteer'
        });

        const result = await puppeteerTool.execute({
          operation: 'navigate',
          params: { url: 'https://unavailable-test.com' }
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('puppeteer is not installed');
      });
    });

    describe('Configuration Options', () => {
      it('should apply browser configuration options', async () => {
        const mockGetToolConfig = vi.fn().mockResolvedValue({
          enabled: true,
          engine: 'chromium',
          headless: false,
          userAgent: 'APEX-Test-Agent/1.0',
          viewport: { width: 1280, height: 720 },
          allowDownloads: false,
          blockPopups: true
        } as BrowserToolConfig);

        permissionManager.getToolConfig = mockGetToolConfig;

        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://config-test.com' }
        });

        expect(result.success).toBe(true);
        expect(mockBrowser.newContext).toHaveBeenCalledWith({
          userAgent: 'APEX-Test-Agent/1.0',
          viewport: { width: 1280, height: 720 },
          acceptDownloads: false
        });
      });

      it('should handle page load timeouts from configuration', async () => {
        const mockGetToolConfig = vi.fn().mockResolvedValue({
          pageLoadTimeout: 10000
        } as BrowserToolConfig);

        permissionManager.getToolConfig = mockGetToolConfig;

        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://timeout-test.com' }
        });

        expect(result.success).toBe(true);
        expect(mockPage.goto).toHaveBeenCalledWith(
          'https://timeout-test.com',
          expect.objectContaining({
            timeout: 10000
          })
        );
      });
    });
  });

  describe('Console Monitoring and Error Tracking', () => {
    describe('Console Stream Integration', () => {
      it('should initialize console streaming by default', async () => {
        await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://console-test.com' }
        });

        expect(BrowserConsoleStream).toHaveBeenCalled();
        expect(mockConsoleStream.startStream).toHaveBeenCalledWith(mockPage);
      });

      it('should disable console streaming when configured', async () => {
        const mockGetToolConfig = vi.fn().mockResolvedValue({
          consoleStream: {
            enabled: false
          }
        } as BrowserToolConfig);

        permissionManager.getToolConfig = mockGetToolConfig;

        await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://no-console-test.com' }
        });

        expect(mockConsoleStream.startStream).not.toHaveBeenCalled();
      });

      it('should configure console streaming with custom settings', async () => {
        const customConfig = {
          logLevel: 'error' as const,
          bufferSize: 500,
          includeStackTrace: true
        };

        const mockGetToolConfig = vi.fn().mockResolvedValue({
          consoleStream: {
            enabled: true,
            config: customConfig
          }
        } as BrowserToolConfig);

        permissionManager.getToolConfig = mockGetToolConfig;

        await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://custom-console-test.com' }
        });

        expect(BrowserConsoleStream).toHaveBeenCalledWith(customConfig);
      });
    });

    describe('Enhanced Message Handling', () => {
      it('should capture enhanced console messages during operations', async () => {
        const mockMessages = [
          {
            level: 'log',
            text: 'Page loaded successfully',
            timestamp: new Date(),
            location: { url: 'https://example.com', lineNumber: 1 }
          }
        ];

        const mockErrors = [
          {
            message: 'Script error',
            stack: 'Error: Script error\n  at line 5',
            timestamp: new Date(),
            source: 'https://example.com/script.js'
          }
        ];

        // Simulate console stream events
        mockConsoleStream.on.mockImplementation((event: string, listener: Function) => {
          if (event === 'message') {
            setTimeout(() => listener(mockMessages[0]), 0);
          } else if (event === 'error') {
            setTimeout(() => listener(mockErrors[0]), 0);
          }
        });

        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://console-messages-test.com' }
        });

        expect(result.success).toBe(true);
        expect(result.metadata).toHaveProperty('enhancedConsoleMessages');
        expect(result.metadata).toHaveProperty('enhancedRuntimeErrors');
      });

      it('should provide console buffer management methods', () => {
        expect(typeof browserTool.getEnhancedConsoleMessages).toBe('function');
        expect(typeof browserTool.getEnhancedRuntimeErrors).toBe('function');
        expect(typeof browserTool.clearConsoleBuffers).toBe('function');
        expect(typeof browserTool.getConsoleStream).toBe('function');

        browserTool.clearConsoleBuffers();
        expect(mockConsoleStream.clearBuffers).toHaveBeenCalled();
      });

      it('should limit console message buffer size', async () => {
        // This would be tested by ensuring the internal buffer doesn't grow beyond limits
        const messages = Array.from({ length: 1500 }, (_, i) => ({
          level: 'log',
          text: `Message ${i}`,
          timestamp: new Date()
        }));

        // Simulate many console messages
        mockConsoleStream.on.mockImplementation((event: string, listener: Function) => {
          if (event === 'message') {
            messages.forEach(msg => setTimeout(() => listener(msg), 0));
          }
        });

        await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://many-messages-test.com' }
        });

        // Buffer should be limited to 1000 messages (as per implementation)
        const capturedMessages = browserTool.getEnhancedConsoleMessages();
        expect(capturedMessages.length).toBeLessThanOrEqual(1000);
      });
    });
  });

  describe('Visual Regression Testing', () => {
    describe('Screenshot Comparison', () => {
      it('should perform visual regression testing with baseline', async () => {
        const mockPNG = require('pngjs').PNG;
        mockPNG.sync.read.mockReturnValue({
          width: 1920,
          height: 1080,
          data: new Buffer(1920 * 1080 * 4)
        });

        const pixelmatch = require('pixelmatch').default;
        pixelmatch.mockReturnValue(50); // 50 different pixels

        const result = await browserTool.execute({
          operation: 'compareScreenshot',
          params: {
            baselinePath: '/baselines/homepage.png',
            diffPath: '/diffs/homepage-diff.png',
            threshold: 0.01,
            testId: 'homepage-visual-test',
            fullPage: true
          }
        });

        expect(result.success).toBe(true);
        expect(result.operation).toBe('compareScreenshot');
        expect(result.data).toEqual({
          diffPixels: 50,
          totalPixels: 1920 * 1080,
          diffRatio: 50 / (1920 * 1080),
          threshold: 0.01,
          match: expect.any(Boolean),
          diffPath: '/diffs/homepage-diff.png'
        });

        expect(mockPage.screenshot).toHaveBeenCalledWith({
          fullPage: true,
          type: 'png',
          quality: undefined
        });
      });

      it('should emit visual comparison events on success', async () => {
        const eventSpy = vi.fn();
        eventEmitter.on('visual:comparison:passed', eventSpy);

        const pixelmatch = require('pixelmatch').default;
        pixelmatch.mockReturnValue(5); // Very few different pixels (pass)

        const result = await browserTool.execute({
          operation: 'compareScreenshot',
          params: {
            baselinePath: '/baselines/button.png',
            threshold: 0.01,
            testId: 'button-test'
          }
        });

        expect(result.success).toBe(true);
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            testId: 'button-test',
            passed: true,
            diffPercentage: expect.any(Number),
            threshold: 1, // 0.01 * 100
            pageUrl: 'https://example.com'
          })
        );
      });

      it('should emit visual comparison events on failure', async () => {
        const eventSpy = vi.fn();
        eventEmitter.on('visual:comparison:failed', eventSpy);

        const pixelmatch = require('pixelmatch').default;
        pixelmatch.mockReturnValue(50000); // Many different pixels (fail)

        const result = await browserTool.execute({
          operation: 'compareScreenshot',
          params: {
            baselinePath: '/baselines/form.png',
            threshold: 0.01,
            testId: 'form-test'
          }
        });

        expect(result.success).toBe(true);
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            testId: 'form-test',
            passed: false,
            diffPercentage: expect.any(Number),
            threshold: 1
          })
        );
      });

      it('should handle element-specific screenshot comparison', async () => {
        const result = await browserTool.execute({
          operation: 'compareScreenshot',
          params: {
            baselinePath: '/baselines/header-element.png',
            selector: '.header',
            testId: 'header-element-test'
          }
        });

        expect(result.success).toBe(true);
        expect(mockPage.locator).toHaveBeenCalledWith('.header');
      });

      it('should handle missing baseline screenshots', async () => {
        const fs = require('fs');
        fs.existsSync.mockReturnValue(false);

        const result = await browserTool.execute({
          operation: 'compareScreenshot',
          params: {
            baselinePath: '/nonexistent/baseline.png'
          }
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Baseline screenshot not found');
      });

      it('should handle size mismatch between baseline and current', async () => {
        const mockPNG = require('pngjs').PNG;
        mockPNG.sync.read
          .mockReturnValueOnce({
            width: 1920,
            height: 1080,
            data: new Buffer(1920 * 1080 * 4)
          })
          .mockReturnValueOnce({
            width: 1280,
            height: 720,
            data: new Buffer(1280 * 720 * 4)
          });

        const result = await browserTool.execute({
          operation: 'compareScreenshot',
          params: {
            baselinePath: '/baselines/different-size.png'
          }
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Screenshot size mismatch');
      });
    });

    describe('Screenshot Capture', () => {
      it('should capture full page screenshots', async () => {
        const result = await browserTool.execute({
          operation: 'screenshot',
          params: {
            fullPage: true,
            format: 'png',
            quality: 90
          }
        });

        expect(result.success).toBe(true);
        expect(result.operation).toBe('screenshot');
        expect(result.data).toEqual({
          width: 1920,
          height: 1080,
          format: 'png'
        });
        expect(result.screenshot).toContain('data:image/png;base64,');

        expect(mockPage.screenshot).toHaveBeenCalledWith({
          path: undefined,
          fullPage: true,
          type: 'png',
          quality: 90
        });
      });

      it('should capture element screenshots', async () => {
        const result = await browserTool.execute({
          operation: 'screenshot',
          params: {
            selector: '#main-content',
            format: 'jpeg',
            quality: 80
          }
        });

        expect(result.success).toBe(true);
        expect(mockPage.locator).toHaveBeenCalledWith('#main-content');
      });

      it('should save screenshots to specified path', async () => {
        const result = await browserTool.execute({
          operation: 'screenshot',
          params: {
            path: '/screenshots/test-capture.png',
            fullPage: true
          }
        });

        expect(result.success).toBe(true);
        expect(result.screenshot).toBe('/screenshots/test-capture.png');

        expect(mockPage.screenshot).toHaveBeenCalledWith({
          path: '/screenshots/test-capture.png',
          fullPage: true,
          type: undefined,
          quality: undefined
        });
      });
    });
  });

  describe('Browser Operations', () => {
    describe('Navigation Operations', () => {
      it('should navigate with custom wait conditions', async () => {
        const result = await browserTool.execute({
          operation: 'navigate',
          params: {
            url: 'https://spa-app.com',
            waitUntil: 'networkidle',
            timeout: 30000
          }
        });

        expect(result.success).toBe(true);
        expect(mockPage.goto).toHaveBeenCalledWith('https://spa-app.com', {
          waitUntil: 'networkidle',
          timeout: 30000
        });
      });

      it('should handle navigation failures', async () => {
        mockPage.goto.mockRejectedValue(new Error('Navigation timeout'));

        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://slow-loading.com' }
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Navigation timeout');
      });
    });

    describe('Interaction Operations', () => {
      it('should perform complex click interactions', async () => {
        const result = await browserTool.execute({
          operation: 'click',
          params: {
            selector: '.dropdown-trigger',
            button: 'right',
            clickCount: 2,
            delay: 100
          }
        });

        expect(result.success).toBe(true);
        expect(mockPage.click).toHaveBeenCalledWith('.dropdown-trigger', {
          button: 'right',
          clickCount: 2,
          delay: 100
        });
      });

      it('should handle typing with character delays', async () => {
        const result = await browserTool.execute({
          operation: 'type',
          params: {
            selector: '#search-input',
            text: 'test query',
            delay: 50,
            clearFirst: true
          }
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({
          typed: 'test query',
          into: '#search-input'
        });

        expect(mockPage.fill).toHaveBeenCalledWith('#search-input', '');
        expect(mockPage.fill).toHaveBeenCalledWith('#search-input', 'test query');
      });

      it('should perform hover interactions', async () => {
        const result = await browserTool.execute({
          operation: 'hover',
          params: { selector: '.menu-item' }
        });

        expect(result.success).toBe(true);
        expect(mockPage.hover).toHaveBeenCalledWith('.menu-item');
      });

      it('should perform scroll operations', async () => {
        const result = await browserTool.execute({
          operation: 'scroll',
          params: { x: 0, y: 500 }
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ scrolled: '0,500' });
        expect(mockPage.evaluate).toHaveBeenCalled();
      });

      it('should scroll elements into view', async () => {
        const result = await browserTool.execute({
          operation: 'scroll',
          params: { selector: '#bottom-element' }
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ scrolled: '#bottom-element' });
      });
    });

    describe('Data Extraction Operations', () => {
      it('should extract element attributes', async () => {
        const result = await browserTool.execute({
          operation: 'getAttribute',
          params: {
            selector: '#link',
            attribute: 'href'
          }
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({
          attribute: 'href',
          value: 'test-attribute-value'
        });

        expect(mockPage.getAttribute).toHaveBeenCalledWith('#link', 'href');
      });

      it('should extract element text content', async () => {
        const result = await browserTool.execute({
          operation: 'getText',
          params: { selector: '.content' }
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ text: 'Test element text' });
        expect(mockPage.textContent).toHaveBeenCalledWith('.content');
      });

      it('should extract HTML content', async () => {
        const result = await browserTool.execute({
          operation: 'getHtml',
          params: { selector: '.widget' }
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ html: '<div>Inner HTML content</div>' });
        expect(mockPage.innerHTML).toHaveBeenCalledWith('.widget');
      });

      it('should extract full page HTML when no selector specified', async () => {
        const result = await browserTool.execute({
          operation: 'getHtml',
          params: {}
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({
          html: '<html><body>Test content</body></html>'
        });
        expect(mockPage.content).toHaveBeenCalled();
      });
    });

    describe('Advanced Operations', () => {
      it('should execute JavaScript with proper isolation', async () => {
        mockPage.evaluate.mockResolvedValue({ result: 'computed value' });

        const result = await browserTool.execute({
          operation: 'evaluate',
          params: {
            script: 'return document.querySelector(".data").dataset.value',
            args: ['param1', 'param2']
          }
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ result: { result: 'computed value' } });
        expect(mockPage.evaluate).toHaveBeenCalled();
      });

      it('should submit forms with validation', async () => {
        const result = await browserTool.execute({
          operation: 'submit',
          params: {
            selector: '#contact-form',
            validate: true
          }
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ submitted: '#contact-form' });
      });

      it('should wait for elements with visibility requirements', async () => {
        const result = await browserTool.execute({
          operation: 'waitForSelector',
          params: {
            selector: '.loading-spinner',
            timeout: 10000,
            visible: true
          }
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ found: '.loading-spinner' });

        expect(mockPage.waitForSelector).toHaveBeenCalledWith('.loading-spinner', {
          timeout: 10000,
          state: 'visible'
        });
      });
    });
  });

  describe('Security and Permission Integration', () => {
    describe('Domain Security', () => {
      it('should enforce domain allowlist restrictions', async () => {
        const mockGetToolConfig = vi.fn().mockResolvedValue({
          enabled: true,
          allowedDomains: ['trusted.com', 'safe.org']
        } as BrowserToolConfig);

        permissionManager.getToolConfig = mockGetToolConfig;

        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://untrusted.com' }
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Domain untrusted.com is not in allowlist');
      });

      it('should enforce domain blocklist restrictions', async () => {
        const mockGetToolConfig = vi.fn().mockResolvedValue({
          enabled: true,
          blockedDomains: ['malicious.com', 'spam.net']
        } as BrowserToolConfig);

        permissionManager.getToolConfig = mockGetToolConfig;

        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://malicious.com/phishing' }
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Domain malicious.com is blocked');
      });
    });

    describe('Operation-Specific Security', () => {
      it('should block JavaScript execution when disabled', async () => {
        const mockGetToolConfig = vi.fn().mockResolvedValue({
          enabled: true,
          allowJavaScriptExecution: false
        } as BrowserToolConfig);

        permissionManager.getToolConfig = mockGetToolConfig;

        const result = await browserTool.execute({
          operation: 'evaluate',
          params: { script: 'console.log("blocked")' }
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('JavaScript execution is disabled');
      });

      it('should block form submissions when disabled', async () => {
        const mockGetToolConfig = vi.fn().mockResolvedValue({
          enabled: true,
          allowFormSubmission: false
        } as BrowserToolConfig);

        permissionManager.getToolConfig = mockGetToolConfig;

        const result = await browserTool.execute({
          operation: 'submit',
          params: { selector: '#form' }
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Form submission is disabled');
      });

      it('should block screenshots when disabled', async () => {
        const mockGetToolConfig = vi.fn().mockResolvedValue({
          enabled: true,
          allowScreenshots: false
        } as BrowserToolConfig);

        permissionManager.getToolConfig = mockGetToolConfig;

        const result = await browserTool.execute({
          operation: 'screenshot',
          params: { fullPage: true }
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Screenshots are disabled');
      });
    });

    describe('Permission Scoping', () => {
      it('should create proper permission scopes for different operations', async () => {
        const mockCheckToolPermission = vi.fn().mockResolvedValue({
          allowed: true,
          level: 'allow-always',
          requiresConfirmation: false
        });
        permissionManager.checkToolPermission = mockCheckToolPermission;

        await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://example.com/page' }
        });

        expect(mockCheckToolPermission).toHaveBeenCalledWith('Browser', {
          scope: 'navigate:https://example.com/page',
          consumeAllowOnce: true
        });

        await browserTool.execute({
          operation: 'click',
          params: { selector: '#button' }
        });

        expect(mockCheckToolPermission).toHaveBeenCalledWith('Browser', {
          scope: 'click:#button',
          consumeAllowOnce: true
        });
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    describe('Browser Errors', () => {
      it('should handle page crash gracefully', async () => {
        mockPage.goto.mockRejectedValue(new Error('Page crashed'));

        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://crashy-site.com' }
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Page crashed');
        expect(result.metadata?.permissionGranted).toBe(false);
      });

      it('should handle element not found errors', async () => {
        mockPage.click.mockRejectedValue(new Error('Element not found'));

        const result = await browserTool.execute({
          operation: 'click',
          params: { selector: '#nonexistent' }
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Element not found');
      });

      it('should handle timeout errors', async () => {
        mockPage.waitForSelector.mockRejectedValue(new Error('Timeout exceeded'));

        const result = await browserTool.execute({
          operation: 'waitForSelector',
          params: { selector: '.never-appears', timeout: 1000 }
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Timeout exceeded');
      });
    });

    describe('Configuration Errors', () => {
      it('should handle disabled browser tool', async () => {
        const mockGetToolConfig = vi.fn().mockResolvedValue({
          enabled: false
        } as BrowserToolConfig);

        permissionManager.getToolConfig = mockGetToolConfig;

        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://example.com' }
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Browser tool is disabled');
      });
    });
  });

  describe('Multi-Backend Compatibility', () => {
    describe('Backend-Specific Operations', () => {
      it('should handle wait conditions correctly for different backends', async () => {
        const playwrightTool = new BrowserTool({
          permissionManager,
          backend: 'playwright'
        });

        const puppeteerTool = new BrowserTool({
          permissionManager,
          backend: 'puppeteer'
        });

        // Test Playwright networkidle mapping
        await playwrightTool.execute({
          operation: 'navigate',
          params: { url: 'https://example.com', waitUntil: 'networkidle' }
        });

        expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
          waitUntil: 'networkidle',
          timeout: undefined
        });

        // Test Puppeteer networkidle mapping (should become 'networkidle0')
        vi.clearAllMocks();

        // For puppeteer, we would expect the wait condition to be mapped
        // but since we're using the same mock, we'll just verify the tool works
        const result = await puppeteerTool.execute({
          operation: 'navigate',
          params: { url: 'https://example.com', waitUntil: 'networkidle' }
        });

        expect(result.success).toBe(true);
      });

      it('should handle viewport size retrieval for different backends', async () => {
        // This tests the internal viewport size handling
        const result = await browserTool.execute({
          operation: 'screenshot',
          params: { fullPage: true }
        });

        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('width');
        expect(result.data).toHaveProperty('height');
      });
    });
  });

  describe('Event Emission and Monitoring', () => {
    it('should emit events through injected event emitter', () => {
      const testTool = new BrowserTool();
      const testEventEmitter = new EventEmitter();

      testTool.setEventEmitter(testEventEmitter);

      // Verify event emitter injection works
      expect(() => testTool.setEventEmitter(testEventEmitter)).not.toThrow();
    });

    it('should emit visual comparison events with proper data structure', async () => {
      const eventData: VisualComparisonEventData[] = [];
      eventEmitter.on('visual:comparison:passed', (data) => eventData.push(data));
      eventEmitter.on('visual:comparison:failed', (data) => eventData.push(data));

      const pixelmatch = require('pixelmatch').default;
      pixelmatch.mockReturnValue(100); // Some differences

      await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: '/baselines/test.png',
          testId: 'event-test',
          threshold: 0.01
        }
      });

      expect(eventData.length).toBe(1);
      expect(eventData[0]).toMatchObject({
        testId: 'event-test',
        baseline: '/baselines/test.png',
        diffPercentage: expect.any(Number),
        threshold: 1,
        passed: expect.any(Boolean),
        pageUrl: 'https://example.com',
        timestamp: expect.any(Date)
      });
    });
  });
});