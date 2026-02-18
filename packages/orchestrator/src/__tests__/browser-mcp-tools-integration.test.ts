/**
 * Browser MCP Tools Integration Tests
 *
 * This test suite verifies that browser automation integrates correctly with
 * MCP (Model Context Protocol) tools. It specifically tests:
 * 1. Browser operations can be invoked as MCP tools
 * 2. MCP browser tools return properly formatted results
 * 3. Error handling works through MCP tool interface
 * 4. Tool discovery includes browser operations
 * 5. Parameter validation works through MCP interface
 * 6. Event streaming works with MCP browser tools
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '../index.js';
import { BrowserTool } from '../tools/browser-tool.js';
import type { McpServerConfig, ToolExecution } from '@apexcli/core';

// Mock Playwright infrastructure
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(() => Promise.resolve(mockBrowser)),
  },
  firefox: {
    launch: vi.fn(() => Promise.resolve(mockBrowser)),
  },
  webkit: {
    launch: vi.fn(() => Promise.resolve(mockBrowser)),
  }
}));

// Mock filesystem operations
vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(() => 'mock-file-content'),
  unlinkSync: vi.fn(),
  promises: {
    writeFile: vi.fn(() => Promise.resolve()),
    readFile: vi.fn(() => Promise.resolve('mock-content')),
    mkdir: vi.fn(() => Promise.resolve()),
    access: vi.fn(() => Promise.resolve()),
  }
}));

// Mock console stream
vi.mock('../browser-console-stream', () => ({
  BrowserConsoleStream: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    getMessages: vi.fn(() => []),
    getErrors: vi.fn(() => []),
  })),
}));

// Create mock browser objects
const mockPage = {
  url: vi.fn(() => 'https://test.example.com'),
  title: vi.fn(() => 'Test Page'),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  click: vi.fn(() => Promise.resolve()),
  fill: vi.fn(() => Promise.resolve()),
  type: vi.fn(() => Promise.resolve()),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-screenshot'))),
  waitForSelector: vi.fn(() => Promise.resolve({})),
  getAttribute: vi.fn(() => Promise.resolve('test-value')),
  textContent: vi.fn(() => Promise.resolve('Test Content')),
  innerHTML: vi.fn(() => Promise.resolve('<div>Test</div>')),
  hover: vi.fn(() => Promise.resolve()),
  evaluate: vi.fn(() => Promise.resolve('evaluation-result')),
  locator: vi.fn(() => ({
    click: vi.fn(() => Promise.resolve()),
    fill: vi.fn(() => Promise.resolve()),
    scrollIntoView: vi.fn(() => Promise.resolve()),
  })),
  on: vi.fn(),
  off: vi.fn(),
  close: vi.fn(() => Promise.resolve()),
};

const mockContext = {
  newPage: vi.fn(() => Promise.resolve(mockPage)),
  close: vi.fn(() => Promise.resolve()),
  pages: vi.fn(() => [mockPage]),
};

const mockBrowser = {
  newContext: vi.fn(() => Promise.resolve(mockContext)),
  version: vi.fn(() => '1.40.0'),
  isConnected: vi.fn(() => true),
  close: vi.fn(() => Promise.resolve()),
  contexts: vi.fn(() => [mockContext]),
};

describe('Browser MCP Tools Integration', () => {
  let orchestrator: ApexOrchestrator;
  let mockEvents: Array<{ type: string; data: any }> = [];

  const testConfig = {
    autonomyLevel: 'guided' as const,
    permissions: {
      browser: {
        enabled: true,
        allowedDomains: ['*'],
        blockedDomains: [],
        requireConfirmation: false,
      },
    },
    limits: {
      maxConcurrentTasks: 1,
      maxExecutionTime: 60000,
    },
    mcp: {
      enabled: true,
      servers: [] as McpServerConfig[],
    }
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockEvents = [];

    orchestrator = new ApexOrchestrator({ projectPath: '/test/project' });

    // Set up event listeners
    orchestrator.on('tool:started', (data) => mockEvents.push({ type: 'tool:started', data }));
    orchestrator.on('tool:completed', (data) => mockEvents.push({ type: 'tool:completed', data }));
    orchestrator.on('tool:failed', (data) => mockEvents.push({ type: 'tool:failed', data }));
    orchestrator.on('mcp:tool:executed', (data) => mockEvents.push({ type: 'mcp:tool:executed', data }));
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
  });

  describe('MCP Browser Tool Discovery', () => {
    it('should discover browser tools through MCP interface', async () => {
      // Test that browser operations are discoverable as MCP tools
      const availableTools = await orchestrator.getAvailableTools();

      expect(availableTools).toBeDefined();

      // Look for browser-related tools
      const browserTools = availableTools.filter(tool =>
        tool.name.toLowerCase().includes('browser') ||
        tool.category === 'automation'
      );

      expect(browserTools.length).toBeGreaterThan(0);

      // Verify expected browser operations are available
      const expectedOperations = [
        'navigate', 'click', 'type', 'screenshot', 'getText'
      ];

      const toolNames = browserTools.map(t => t.name.toLowerCase());
      const hasExpectedOps = expectedOperations.some(op =>
        toolNames.some(name => name.includes(op))
      );

      expect(hasExpectedOps).toBe(true);
    });

    it('should provide correct tool metadata through MCP interface', async () => {
      const tools = await orchestrator.getAvailableTools();
      const browserTool = tools.find(t =>
        t.name.toLowerCase().includes('browser') ||
        t.category === 'automation'
      );

      if (browserTool) {
        expect(browserTool).toHaveProperty('name');
        expect(browserTool).toHaveProperty('description');
        expect(browserTool).toHaveProperty('category');
        expect(browserTool).toHaveProperty('inputSchema');

        expect(typeof browserTool.name).toBe('string');
        expect(typeof browserTool.description).toBe('string');
        expect(browserTool.category).toBe('automation');
        expect(browserTool.inputSchema).toBeDefined();
      }
    });
  });

  describe('MCP Browser Tool Execution', () => {
    it('should execute browser navigate through MCP interface', async () => {
      const toolExecution: ToolExecution = {
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'navigate',
          params: { url: 'https://test.example.com' }
        }
      };

      const result = await orchestrator.executeTool(toolExecution);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();

      // Verify result structure
      if (typeof result.content === 'object') {
        expect(result.content).toHaveProperty('url');
        expect(result.content).toHaveProperty('title');
      }

      // Verify events were emitted
      const toolEvents = mockEvents.filter(e =>
        e.type === 'tool:completed' || e.type === 'mcp:tool:executed'
      );
      expect(toolEvents.length).toBeGreaterThan(0);
    });

    it('should execute browser click through MCP interface', async () => {
      // First navigate to establish browser context
      await orchestrator.executeTool({
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'navigate',
          params: { url: 'https://test.example.com' }
        }
      });

      const toolExecution: ToolExecution = {
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'click',
          params: { selector: '#test-button' }
        }
      };

      const result = await orchestrator.executeTool(toolExecution);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      // Verify click was performed
      expect(mockPage.click).toHaveBeenCalledWith('#test-button', expect.any(Object));
    });

    it('should execute browser screenshot through MCP interface', async () => {
      // First navigate
      await orchestrator.executeTool({
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'navigate',
          params: { url: 'https://test.example.com' }
        }
      });

      const toolExecution: ToolExecution = {
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'screenshot',
          params: { fullPage: true }
        }
      };

      const result = await orchestrator.executeTool(toolExecution);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      // Verify screenshot was taken
      expect(mockPage.screenshot).toHaveBeenCalledWith(expect.objectContaining({
        fullPage: true
      }));

      // Verify result contains screenshot data
      if (typeof result.content === 'object') {
        expect(result.content).toHaveProperty('buffer');
        expect(result.content).toHaveProperty('path');
      }
    });

    it('should execute browser type through MCP interface', async () => {
      // First navigate
      await orchestrator.executeTool({
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'navigate',
          params: { url: 'https://test.example.com' }
        }
      });

      const toolExecution: ToolExecution = {
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'type',
          params: {
            selector: '#test-input',
            text: 'Hello MCP World'
          }
        }
      };

      const result = await orchestrator.executeTool(toolExecution);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      // Verify typing was performed
      expect(mockPage.type).toHaveBeenCalledWith('#test-input', 'Hello MCP World', expect.any(Object));
    });
  });

  describe('MCP Error Handling', () => {
    it('should handle navigation errors through MCP interface', async () => {
      // Mock navigation failure
      mockPage.goto.mockRejectedValueOnce(new Error('MCP Navigation failed'));

      const toolExecution: ToolExecution = {
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'navigate',
          params: { url: 'https://invalid.url' }
        }
      };

      const result = await orchestrator.executeTool(toolExecution);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Navigation failed');

      // Verify error events were emitted
      const errorEvents = mockEvents.filter(e => e.type === 'tool:failed');
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    it('should handle invalid operation through MCP interface', async () => {
      const toolExecution: ToolExecution = {
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'invalid-operation',
          params: {}
        }
      };

      const result = await orchestrator.executeTool(toolExecution);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle missing parameters through MCP interface', async () => {
      const toolExecution: ToolExecution = {
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'click',
          params: {} // Missing selector
        }
      };

      const result = await orchestrator.executeTool(toolExecution);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('MCP Parameter Validation', () => {
    it('should validate navigate parameters through MCP interface', async () => {
      // Valid navigation
      const validExecution: ToolExecution = {
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'navigate',
          params: { url: 'https://valid.example.com' }
        }
      };

      const validResult = await orchestrator.executeTool(validExecution);
      expect(validResult.success).toBe(true);

      // Invalid navigation (missing URL)
      const invalidExecution: ToolExecution = {
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'navigate',
          params: {}
        }
      };

      const invalidResult = await orchestrator.executeTool(invalidExecution);
      expect(invalidResult.success).toBe(false);
    });

    it('should validate click parameters through MCP interface', async () => {
      // First navigate
      await orchestrator.executeTool({
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'navigate',
          params: { url: 'https://test.example.com' }
        }
      });

      // Valid click
      const validExecution: ToolExecution = {
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'click',
          params: { selector: '#test-button' }
        }
      };

      const validResult = await orchestrator.executeTool(validExecution);
      expect(validResult.success).toBe(true);

      // Invalid click (missing selector)
      const invalidExecution: ToolExecution = {
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'click',
          params: {}
        }
      };

      const invalidResult = await orchestrator.executeTool(invalidExecution);
      expect(invalidResult.success).toBe(false);
    });
  });

  describe('MCP Result Formatting', () => {
    it('should format navigation results correctly through MCP', async () => {
      const toolExecution: ToolExecution = {
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'navigate',
          params: { url: 'https://test.example.com' }
        }
      };

      const result = await orchestrator.executeTool(toolExecution);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();

      // Check result structure matches MCP format
      expect(result).toHaveProperty('toolResult');
      expect(result.toolResult).toHaveProperty('content');

      if (typeof result.content === 'object') {
        expect(result.content).toHaveProperty('url');
        expect(result.content).toHaveProperty('title');
        expect(result.content).toHaveProperty('status');
      }
    });

    it('should format screenshot results correctly through MCP', async () => {
      // First navigate
      await orchestrator.executeTool({
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'navigate',
          params: { url: 'https://test.example.com' }
        }
      });

      const toolExecution: ToolExecution = {
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'screenshot',
          params: { format: 'png' }
        }
      };

      const result = await orchestrator.executeTool(toolExecution);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      // Verify result contains screenshot data in proper format
      if (typeof result.content === 'object') {
        expect(result.content).toHaveProperty('buffer');
        expect(result.content).toHaveProperty('path');
        expect(result.content).toHaveProperty('format');
      }
    });

    it('should format text extraction results correctly through MCP', async () => {
      // First navigate
      await orchestrator.executeTool({
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'navigate',
          params: { url: 'https://test.example.com' }
        }
      });

      const toolExecution: ToolExecution = {
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'getText',
          params: { selector: 'body' }
        }
      };

      const result = await orchestrator.executeTool(toolExecution);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      if (typeof result.content === 'object') {
        expect(result.content).toHaveProperty('text');
        expect(typeof result.content.text).toBe('string');
      }
    });
  });

  describe('MCP Event Integration', () => {
    it('should emit proper MCP tool events', async () => {
      const toolExecution: ToolExecution = {
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'navigate',
          params: { url: 'https://test.example.com' }
        }
      };

      await orchestrator.executeTool(toolExecution);

      // Verify MCP-specific events were emitted
      const mcpEvents = mockEvents.filter(e => e.type.includes('mcp'));
      expect(mcpEvents.length).toBeGreaterThan(0);

      // Verify general tool events were also emitted
      const toolEvents = mockEvents.filter(e =>
        e.type.includes('tool:') &&
        !e.type.includes('mcp')
      );
      expect(toolEvents.length).toBeGreaterThan(0);
    });

    it('should include proper metadata in MCP tool events', async () => {
      const toolExecution: ToolExecution = {
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'navigate',
          params: { url: 'https://test.example.com' }
        }
      };

      await orchestrator.executeTool(toolExecution);

      // Find completed tool events
      const completedEvents = mockEvents.filter(e => e.type === 'tool:completed');
      expect(completedEvents.length).toBeGreaterThan(0);

      const event = completedEvents[0];
      expect(event.data).toHaveProperty('toolName');
      expect(event.data).toHaveProperty('executionTime');
      expect(event.data).toHaveProperty('success');
    });
  });

  describe('MCP Tool Chain Integration', () => {
    it('should support chaining browser operations through MCP', async () => {
      // Execute a sequence of browser operations
      const operations = [
        {
          toolName: 'mcp__browser-tools__Browser',
          parameters: {
            operation: 'navigate',
            params: { url: 'https://test.example.com' }
          }
        },
        {
          toolName: 'mcp__browser-tools__Browser',
          parameters: {
            operation: 'type',
            params: { selector: '#search', text: 'test query' }
          }
        },
        {
          toolName: 'mcp__browser-tools__Browser',
          parameters: {
            operation: 'click',
            params: { selector: '#submit' }
          }
        },
        {
          toolName: 'mcp__browser-tools__Browser',
          parameters: {
            operation: 'screenshot',
            params: { fullPage: true }
          }
        }
      ];

      const results = [];
      for (const operation of operations) {
        const result = await orchestrator.executeTool(operation);
        results.push(result);
        expect(result.success).toBe(true);
      }

      // Verify all operations succeeded
      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Verify events were emitted for each operation
      const completedEvents = mockEvents.filter(e => e.type === 'tool:completed');
      expect(completedEvents.length).toBeGreaterThanOrEqual(4);
    });

    it('should maintain browser context across MCP tool calls', async () => {
      // Navigate to establish context
      await orchestrator.executeTool({
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'navigate',
          params: { url: 'https://test.example.com' }
        }
      });

      // Perform action that requires existing context
      const result = await orchestrator.executeTool({
        toolName: 'mcp__browser-tools__Browser',
        parameters: {
          operation: 'getText',
          params: { selector: 'title' }
        }
      });

      expect(result.success).toBe(true);
      expect(mockPage.textContent).toHaveBeenCalled();

      // Verify we didn't create excessive browser instances
      expect(mockBrowser.newContext).toHaveBeenCalledTimes(1);
    });
  });
});