/**
 * Browser Tool Handlers - Acceptance Criteria Validation
 *
 * This test validates that browser tool handlers are implemented in the orchestrator package
 * and can be invoked through the existing tool system with structured results.
 *
 * Acceptance Criteria:
 * - Browser tool handlers are implemented in @apex/orchestrator
 * - Handlers can be invoked through the existing tool system
 * - Handlers support basic browser operations
 * - Handlers return structured results
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { BrowserTool } from '../browser-tool';
import { PermissionManager } from '../../permission-manager';
import type {
  BrowserOperation,
  BrowserResult,
  BrowserParams,
  PermissionLevel,
  ToolPermissionResult
} from '@apexcli/core';
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
  evaluate: vi.fn(() => Promise.resolve('evaluation-result')),
  waitForSelector: vi.fn(),
  getAttribute: vi.fn(() => Promise.resolve('test-value')),
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
  close: vi.fn(),
};

const mockContext = {
  newPage: vi.fn(() => Promise.resolve(mockPage)),
  on: vi.fn(),
  close: vi.fn(),
};

const mockBrowser = {
  newContext: vi.fn(() => Promise.resolve(mockContext)),
  close: vi.fn(),
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

describe('Browser Tool Handlers - Acceptance Criteria', () => {
  let browserTool: BrowserTool;
  let mockPermissionManager: PermissionManager;
  let eventEmitter: EventEmitter;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock browser responses
    mockBrowser.newContext.mockResolvedValue(mockContext);
    mockContext.newPage.mockResolvedValue(mockPage);

    // Create mock permission manager that allows all operations
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
      })),
    } as any;

    eventEmitter = new EventEmitter();

    // Initialize browser tool with permission manager
    browserTool = new BrowserTool({
      permissionManager: mockPermissionManager,
      eventEmitter,
    });
  });

  afterEach(async () => {
    // Clean up browser resources
    try {
      await browserTool.cleanup();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Tool System Integration', () => {
    it('should be invokable through the tool system infrastructure', () => {
      // Verify BrowserTool is a proper class that can be instantiated
      expect(browserTool).toBeInstanceOf(BrowserTool);

      // Verify it has the required execute method for tool system integration
      expect(typeof browserTool.execute).toBe('function');

      // Verify it has permission checking capabilities
      expect(typeof browserTool.checkPermission).toBe('function');

      // Verify it can be configured with permission manager
      expect(typeof browserTool.setPermissionManager).toBe('function');
    });

    it('should return structured results with required metadata', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Verify structured result format
      expect(result).toMatchObject({
        success: expect.any(Boolean),
        operation: 'navigate',
        data: expect.any(Object),
        metadata: expect.objectContaining({
          url: expect.any(String),
          executionTime: expect.any(Number),
          permissionGranted: expect.any(Boolean),
          target: expect.any(String),
          consoleMessages: expect.any(Array),
          runtimeErrors: expect.any(Array),
          enhancedConsoleMessages: expect.any(Array),
          enhancedRuntimeErrors: expect.any(Array),
        }),
      });

      // Verify operation-specific data structure
      expect(result.data).toMatchObject({
        url: 'https://example.com',
        status: 200,
      });
    });
  });

  describe('Basic Browser Operations Support', () => {
    const basicOperations: Array<{
      operation: BrowserOperation;
      params: any;
      expectedDataStructure: any;
    }> = [
      {
        operation: 'navigate',
        params: { url: 'https://example.com' },
        expectedDataStructure: { url: expect.any(String), status: expect.any(Number) },
      },
      {
        operation: 'click',
        params: { selector: '#button' },
        expectedDataStructure: { clicked: expect.any(String) },
      },
      {
        operation: 'type',
        params: { selector: '#input', text: 'test text' },
        expectedDataStructure: { typed: expect.any(String), into: expect.any(String) },
      },
      {
        operation: 'screenshot',
        params: { fullPage: true },
        expectedDataStructure: { width: expect.any(Number), height: expect.any(Number), format: expect.any(String) },
      },
      {
        operation: 'evaluate',
        params: { script: 'return document.title;' },
        expectedDataStructure: { result: expect.any(String) },
      },
      {
        operation: 'getAttribute',
        params: { selector: '#element', attribute: 'data-value' },
        expectedDataStructure: { attribute: expect.any(String), value: expect.any(String) },
      },
      {
        operation: 'getText',
        params: { selector: '#text' },
        expectedDataStructure: { text: expect.any(String) },
      },
      {
        operation: 'getHtml',
        params: { selector: '#container' },
        expectedDataStructure: { html: expect.any(String) },
      },
      {
        operation: 'hover',
        params: { selector: '#menu' },
        expectedDataStructure: { hovered: expect.any(String) },
      },
      {
        operation: 'scroll',
        params: { x: 100, y: 200 },
        expectedDataStructure: { scrolled: expect.any(String) },
      },
    ];

    basicOperations.forEach(({ operation, params, expectedDataStructure }) => {
      it(`should support ${operation} operation with structured results`, async () => {
        const result = await browserTool.execute({
          operation,
          params,
        } as BrowserParams);

        // Verify operation completed successfully
        expect(result.success).toBe(true);
        expect(result.operation).toBe(operation);

        // Verify structured data format
        expect(result.data).toMatchObject(expectedDataStructure);

        // Verify metadata is present
        expect(result.metadata).toBeDefined();
        expect(result.metadata?.permissionGranted).toBe(true);
        expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Error Handling with Structured Results', () => {
    it('should return structured error results when operations fail', async () => {
      // Force a navigation error
      mockPage.goto.mockRejectedValue(new Error('Navigation failed'));

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://invalid-url.com' },
      });

      // Verify structured error result
      expect(result).toMatchObject({
        success: false,
        operation: 'navigate',
        error: 'Navigation failed',
        metadata: expect.objectContaining({
          executionTime: expect.any(Number),
          permissionGranted: false,
        }),
      });
    });

    it('should handle permission denials with structured results', async () => {
      // Mock permission denial
      (mockPermissionManager.checkToolPermission as Mock).mockResolvedValue({
        allowed: false,
        level: null,
        requiresConfirmation: false,
        denialReason: 'Operation not permitted',
      });

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'alert("test")' },
      });

      // Verify structured permission denial result
      expect(result).toMatchObject({
        success: false,
        operation: 'evaluate',
        error: expect.stringContaining('Operation not permitted'),
        metadata: expect.objectContaining({
          permissionGranted: false,
        }),
      });
    });
  });

  describe('Tool Configuration and Lifecycle', () => {
    it('should support runtime configuration through permission manager', () => {
      const newPermissionManager = {} as PermissionManager;

      // Should allow runtime injection of permission manager
      expect(() => {
        browserTool.setPermissionManager(newPermissionManager);
      }).not.toThrow();
    });

    it('should support event emission for tool integration', () => {
      const newEventEmitter = new EventEmitter();

      // Should allow runtime injection of event emitter
      expect(() => {
        browserTool.setEventEmitter(newEventEmitter);
      }).not.toThrow();
    });

    it('should provide resource state information', () => {
      // Verify resource state tracking
      const resourceState = browserTool.getResourceState();
      expect(resourceState).toMatchObject({
        browserActive: expect.any(Boolean),
        contextActive: expect.any(Boolean),
        pageActive: expect.any(Boolean),
        sessionId: expect.any(String),
        activeOperations: expect.any(Number),
      });
    });

    it('should support graceful cleanup', async () => {
      // Should not throw when cleaning up
      await expect(browserTool.cleanup()).resolves.not.toThrow();

      // Should track state correctly after cleanup
      expect(browserTool.getState()).toBe('destroyed');
    });
  });

  describe('Advanced Operations', () => {
    it('should support form submission operations', async () => {
      const result = await browserTool.execute({
        operation: 'submit',
        params: { selector: '#form', validate: true },
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        submitted: '#form',
      });
    });

    it('should support element waiting operations', async () => {
      const result = await browserTool.execute({
        operation: 'waitForSelector',
        params: { selector: '#dynamic-element', timeout: 5000, visible: true },
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        found: '#dynamic-element',
      });
    });

    it('should support complex JavaScript evaluation', async () => {
      mockPage.evaluate.mockResolvedValue({ title: 'Test Page', links: 5 });

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: 'return { title: document.title, links: document.querySelectorAll("a").length };',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data?.result).toMatchObject({
        title: 'Test Page',
        links: 5,
      });
    });
  });

  describe('Acceptance Criteria Validation', () => {
    it('validates that browser tool handlers are implemented in @apex/orchestrator', () => {
      // Verify the BrowserTool is exported from orchestrator package
      expect(BrowserTool).toBeDefined();
      expect(BrowserTool.prototype.execute).toBeDefined();

      // Verify it can be instantiated
      const tool = new BrowserTool();
      expect(tool).toBeInstanceOf(BrowserTool);
    });

    it('validates handlers can be invoked through existing tool system', async () => {
      // Verify the tool follows the standard tool interface
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Tool system integration requires execute method that returns structured results
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.operation).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('validates handlers support basic browser operations', async () => {
      const basicOps: BrowserOperation[] = [
        'navigate', 'click', 'type', 'screenshot', 'evaluate',
        'getAttribute', 'getText', 'getHtml', 'hover', 'scroll'
      ];

      // Verify all basic operations are supported
      for (const op of basicOps) {
        const params = op === 'navigate'
          ? { url: 'https://example.com' }
          : op === 'click' || op === 'type' || op === 'getAttribute' || op === 'getText' || op === 'getHtml' || op === 'hover'
          ? { selector: '#test' }
          : op === 'type'
          ? { selector: '#input', text: 'test' }
          : op === 'getAttribute'
          ? { selector: '#test', attribute: 'value' }
          : op === 'screenshot'
          ? { fullPage: true }
          : op === 'evaluate'
          ? { script: 'return true;' }
          : op === 'scroll'
          ? { x: 0, y: 0 }
          : {};

        const result = await browserTool.execute({
          operation: op,
          params,
        } as BrowserParams);

        // Each operation should return a structured result
        expect(result.operation).toBe(op);
        expect(typeof result.success).toBe('boolean');
      }
    });

    it('validates handlers return structured results', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Verify structured result format meets acceptance criteria
      const structuredResult: BrowserResult = {
        success: expect.any(Boolean),
        operation: expect.any(String),
        data: expect.any(Object),
        metadata: {
          url: expect.any(String),
          executionTime: expect.any(Number),
          permissionGranted: expect.any(Boolean),
          target: expect.any(String),
          consoleMessages: expect.any(Array),
          runtimeErrors: expect.any(Array),
          enhancedConsoleMessages: expect.any(Array),
          enhancedRuntimeErrors: expect.any(Array),
        },
      };

      expect(result).toMatchObject(structuredResult);
    });
  });
});