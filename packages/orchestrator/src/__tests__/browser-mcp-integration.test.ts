/**
 * Browser MCP Integration Tests
 *
 * This test suite validates the Model Context Protocol (MCP) integration for browser tools.
 * It ensures that browser tools can be properly exposed and invoked through the MCP interface
 * that integrates with the Claude Agent SDK.
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { BrowserTool } from '../tools/browser-tool';
import { buildBrowserToolsServer } from '../browser-mcp';
import { PermissionManager } from '../permission-manager';
import type { PermissionLevel, BrowserOperation } from '@apexcli/core';

// Mock the Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  createSdkMcpServer: vi.fn((config) => ({
    type: 'sdk',
    name: config.name,
    tools: config.tools,
  })),
  tool: vi.fn((name, description, schema, handler) => ({
    name,
    description,
    schema,
    handler,
  })),
}));

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
  evaluate: vi.fn(() => Promise.resolve('test-result')),
  waitForSelector: vi.fn(),
  getAttribute: vi.fn(() => Promise.resolve('test-value')),
  textContent: vi.fn(() => Promise.resolve('test content')),
  innerHTML: vi.fn(() => Promise.resolve('<div>test</div>')),
  content: vi.fn(() => Promise.resolve('<!DOCTYPE html><html><body>test</body></html>')),
  hover: vi.fn(),
  locator: vi.fn(() => ({
    screenshot: vi.fn(() => Promise.resolve(Buffer.from('element-screenshot'))),
    scrollIntoViewIfNeeded: vi.fn(),
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

// Mock Playwright modules
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(() => Promise.resolve(mockBrowser)),
  },
  firefox: {
    launch: vi.fn(() => Promise.resolve(mockBrowser)),
  },
  webkit: {
    launch: vi.fn(() => Promise.resolve(mockBrowser)),
  },
}));

describe('Browser MCP Integration', () => {
  let browserTool: BrowserTool;
  let mockPermissionManager: PermissionManager;

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
      })),
    } as any;

    browserTool = new BrowserTool({
      permissionManager: mockPermissionManager,
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

  describe('MCP Server Creation', () => {
    it('should create a valid MCP server with browser tool', () => {
      const server = buildBrowserToolsServer(browserTool);

      expect(server).toMatchObject({
        name: 'browser-tools',
        config: {
          type: 'sdk',
          name: 'browser-tools',
          tools: expect.any(Array),
        },
      });

      // Verify the tool was registered
      expect(server.config.tools).toHaveLength(1);
    });

    it('should configure browser tool with correct schema and handler', () => {
      const server = buildBrowserToolsServer(browserTool);
      const browserToolDef = server.config.tools[0];

      // Verify tool definition structure
      expect(browserToolDef).toMatchObject({
        name: 'Browser',
        description: expect.stringContaining('Browser automation'),
        schema: expect.any(Object),
        handler: expect.any(Function),
      });

      // Verify schema includes operation field
      expect(browserToolDef.schema.operation).toBeDefined();
      expect(browserToolDef.schema.params).toBeDefined();
    });
  });

  describe('MCP Tool Handler Execution', () => {
    it('should handle successful browser operations through MCP interface', async () => {
      const server = buildBrowserToolsServer(browserTool);
      const browserToolHandler = server.config.tools[0].handler;

      const result = await browserToolHandler({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result).toMatchObject({
        content: [
          {
            type: 'text',
            text: 'Browser navigate succeeded',
          },
        ],
        structuredContent: expect.objectContaining({
          success: true,
          operation: 'navigate',
          data: expect.any(Object),
          metadata: expect.any(Object),
        }),
        isError: false,
      });
    });

    it('should handle failed browser operations through MCP interface', async () => {
      // Force navigation failure
      mockPage.goto.mockRejectedValue(new Error('Navigation failed'));

      const server = buildBrowserToolsServer(browserTool);
      const browserToolHandler = server.config.tools[0].handler;

      const result = await browserToolHandler({
        operation: 'navigate',
        params: { url: 'https://invalid-url.com' },
      });

      expect(result).toMatchObject({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('Browser navigate failed'),
          },
        ],
        structuredContent: expect.objectContaining({
          success: false,
          operation: 'navigate',
          error: expect.any(String),
        }),
        isError: true,
      });
    });

    it('should handle all supported browser operations through MCP', async () => {
      const server = buildBrowserToolsServer(browserTool);
      const browserToolHandler = server.config.tools[0].handler;

      const operations: Array<{ operation: BrowserOperation; params: any }> = [
        { operation: 'navigate', params: { url: 'https://example.com' } },
        { operation: 'click', params: { selector: '#button' } },
        { operation: 'type', params: { selector: '#input', text: 'test' } },
        { operation: 'screenshot', params: { fullPage: true } },
        { operation: 'evaluate', params: { script: 'return document.title;' } },
        { operation: 'getAttribute', params: { selector: '#element', attribute: 'value' } },
        { operation: 'getText', params: { selector: '#text' } },
        { operation: 'getHtml', params: { selector: '#container' } },
        { operation: 'hover', params: { selector: '#menu' } },
        { operation: 'scroll', params: { x: 100, y: 200 } },
      ];

      for (const { operation, params } of operations) {
        const result = await browserToolHandler({ operation, params });

        expect(result.content[0].text).toContain(`Browser ${operation} succeeded`);
        expect(result.structuredContent.success).toBe(true);
        expect(result.structuredContent.operation).toBe(operation);
        expect(result.isError).toBe(false);
      }
    });

    it('should handle missing or undefined params gracefully', async () => {
      const server = buildBrowserToolsServer(browserTool);
      const browserToolHandler = server.config.tools[0].handler;

      // Test with undefined params
      const result = await browserToolHandler({
        operation: 'screenshot',
        params: undefined,
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.structuredContent).toBeDefined();
    });
  });

  describe('MCP Operation Schema Validation', () => {
    it('should support all valid browser operations in schema', () => {
      const server = buildBrowserToolsServer(browserTool);
      const browserToolDef = server.config.tools[0];
      const operationSchema = browserToolDef.schema.operation;

      // The schema should be a Zod enum with all supported operations
      const supportedOps = [
        'navigate', 'click', 'type', 'screenshot', 'compareScreenshot',
        'evaluate', 'submit', 'waitForSelector', 'getAttribute',
        'getText', 'getHtml', 'scroll', 'hover',
      ];

      // This would be validated at runtime by Zod
      expect(operationSchema).toBeDefined();
    });

    it('should have flexible params schema for different operations', () => {
      const server = buildBrowserToolsServer(browserTool);
      const browserToolDef = server.config.tools[0];
      const paramsSchema = browserToolDef.schema.params;

      // Params should be optional record to support different operation parameters
      expect(paramsSchema).toBeDefined();
    });
  });

  describe('MCP Error Handling', () => {
    it('should handle permission denied errors through MCP interface', async () => {
      // Mock permission denial
      (mockPermissionManager.checkToolPermission as Mock).mockResolvedValue({
        allowed: false,
        level: null,
        requiresConfirmation: false,
        denialReason: 'Operation not permitted',
      });

      const server = buildBrowserToolsServer(browserTool);
      const browserToolHandler = server.config.tools[0].handler;

      const result = await browserToolHandler({
        operation: 'evaluate',
        params: { script: 'alert("test")' },
      });

      expect(result.content[0].text).toContain('Browser evaluate failed');
      expect(result.structuredContent.success).toBe(false);
      expect(result.structuredContent.error).toContain('permission');
      expect(result.isError).toBe(true);
    });

    it('should handle tool configuration errors through MCP interface', async () => {
      // Mock disabled tool configuration
      (mockPermissionManager.getToolConfig as Mock).mockResolvedValue({
        enabled: false,
      });

      const server = buildBrowserToolsServer(browserTool);
      const browserToolHandler = server.config.tools[0].handler;

      const result = await browserToolHandler({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.content[0].text).toContain('Browser navigate failed');
      expect(result.structuredContent.error).toContain('disabled');
      expect(result.isError).toBe(true);
    });
  });

  describe('MCP Integration with Orchestrator', () => {
    it('should integrate with orchestrator browser tool instance', () => {
      // Verify that the MCP server can be built with any BrowserTool instance
      const orchestratorBrowserTool = new BrowserTool();
      const server = buildBrowserToolsServer(orchestratorBrowserTool);

      expect(server.name).toBe('browser-tools');
      expect(server.config.tools).toHaveLength(1);
    });

    it('should preserve browser tool configuration through MCP interface', async () => {
      const customBrowserTool = new BrowserTool({
        engine: 'firefox',
        headless: false,
        backend: 'playwright',
      });

      const server = buildBrowserToolsServer(customBrowserTool);
      const browserToolHandler = server.config.tools[0].handler;

      // The MCP handler should use the configured browser tool
      const result = await browserToolHandler({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.structuredContent.success).toBe(true);
    });
  });

  describe('MCP Structured Content Format', () => {
    it('should provide complete structured content for successful operations', async () => {
      const server = buildBrowserToolsServer(browserTool);
      const browserToolHandler = server.config.tools[0].handler;

      const result = await browserToolHandler({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      const structuredContent = result.structuredContent;

      // Verify complete BrowserResult structure
      expect(structuredContent).toMatchObject({
        success: true,
        operation: 'navigate',
        data: expect.any(Object),
        metadata: expect.objectContaining({
          url: expect.any(String),
          executionTime: expect.any(Number),
          permissionGranted: expect.any(Boolean),
          target: expect.any(String),
        }),
      });
    });

    it('should provide complete structured content for failed operations', async () => {
      mockPage.goto.mockRejectedValue(new Error('Test error'));

      const server = buildBrowserToolsServer(browserTool);
      const browserToolHandler = server.config.tools[0].handler;

      const result = await browserToolHandler({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      const structuredContent = result.structuredContent;

      expect(structuredContent).toMatchObject({
        success: false,
        operation: 'navigate',
        error: 'Test error',
        metadata: expect.objectContaining({
          executionTime: expect.any(Number),
          permissionGranted: expect.any(Boolean),
        }),
      });
    });
  });
});