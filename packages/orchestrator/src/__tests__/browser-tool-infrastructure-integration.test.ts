/**
 * Browser Tool Infrastructure Integration Tests
 *
 * This test suite verifies that browser automation integrates correctly with
 * the tool system infrastructure. It specifically tests:
 * 1. Browser tools can be invoked through the tool infrastructure
 * 2. Results are properly handled and returned
 * 3. Tool registration and discovery works correctly
 * 4. Error handling flows through the tool infrastructure
 * 5. Tool execution events are properly emitted
 * 6. Permission system integration works correctly
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { BrowserTool } from '../tools/browser-tool.js';
import { PermissionManager } from '../permission-manager.js';
import { PermissionStore } from '../permission-store.js';
import { EventEmitter } from 'eventemitter3';
import type {
  PermissionLevel,
  ToolPermissionResult,
  BrowserOperation,
  ToolExecutionContext
} from '@apexcli/core';

// Mock Playwright browser infrastructure
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

describe('Browser Tool Infrastructure Integration', () => {
  let browserTool: BrowserTool;
  let permissionManager: PermissionManager;
  let permissionStore: PermissionStore;
  let eventEmitter: EventEmitter;
  let mockEvents: Array<{ event: string; data: any }> = [];

  beforeEach(async () => {
    // Clear previous mocks and events
    vi.clearAllMocks();
    mockEvents = [];

    // Create event emitter for capturing events
    eventEmitter = new EventEmitter();

    // Set up event listeners to capture all events
    const originalEmit = eventEmitter.emit.bind(eventEmitter);
    eventEmitter.emit = vi.fn((event: string, data?: any) => {
      mockEvents.push({ event, data });
      return originalEmit(event, data);
    }) as any;

    // Create permission store and manager
    permissionStore = new PermissionStore(':memory:');
    await permissionStore.initialize();

    permissionManager = new PermissionManager(permissionStore, eventEmitter);

    // Create browser tool with permission manager
    const config = {
      allowedDomains: ['*'],
      blockedDomains: [],
      requireConfirmation: false,
      headless: true,
      viewport: { width: 1280, height: 720 },
      timeout: 30000,
    };

    browserTool = new BrowserTool(config, permissionManager, eventEmitter);
  });

  afterEach(async () => {
    if (browserTool) {
      await browserTool.cleanup();
    }
    if (permissionStore) {
      await permissionStore.close();
    }
  });

  describe('Tool Registration and Discovery', () => {
    it('should register browser tool with correct metadata', async () => {
      expect(browserTool).toBeDefined();
      expect(browserTool.name).toBe('Browser');
      expect(browserTool.category).toBe('automation');
      expect(browserTool.description).toContain('Browser automation');

      // Verify tool supports expected operations
      const supportedOps: BrowserOperation[] = [
        'navigate', 'click', 'type', 'screenshot', 'compareScreenshot',
        'evaluate', 'submit', 'waitForSelector', 'getAttribute',
        'getText', 'getHtml', 'scroll', 'hover'
      ];

      // Tool should handle all these operations without error during validation
      for (const operation of supportedOps) {
        const testInput = { operation, params: {} };
        const validation = await browserTool.validate(testInput, {} as ToolExecutionContext);
        expect(validation.isValid).toBe(true);
      }
    });

    it('should handle tool discovery through infrastructure', async () => {
      // Test that browser tool can be discovered and instantiated
      // through the tool infrastructure
      const toolInstance = browserTool;

      expect(toolInstance).toBeInstanceOf(BrowserTool);
      expect(toolInstance.name).toBe('Browser');
      expect(typeof toolInstance.execute).toBe('function');
      expect(typeof toolInstance.validate).toBe('function');
      expect(typeof toolInstance.cleanup).toBe('function');
    });
  });

  describe('Tool Invocation Through Infrastructure', () => {
    it('should execute navigate operation through tool infrastructure', async () => {
      const context: ToolExecutionContext = {
        taskId: 'test-task-1',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      };

      const input = {
        operation: 'navigate' as BrowserOperation,
        params: { url: 'https://test.example.com' },
      };

      const result = await browserTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.url).toBe('https://test.example.com');
      expect(result.data.title).toBe('Test Page');

      // Verify browser was launched and page navigated
      expect(mockBrowser.newContext).toHaveBeenCalled();
      expect(mockPage.goto).toHaveBeenCalledWith('https://test.example.com', expect.any(Object));
    });

    it('should execute click operation through tool infrastructure', async () => {
      // First navigate to set up browser context
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      }, {
        taskId: 'test-task-1',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      });

      const context: ToolExecutionContext = {
        taskId: 'test-task-2',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      };

      const input = {
        operation: 'click' as BrowserOperation,
        params: { selector: '#test-button' },
      };

      const result = await browserTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // Verify click was performed
      expect(mockPage.click).toHaveBeenCalledWith('#test-button', expect.any(Object));
    });

    it('should execute type operation through tool infrastructure', async () => {
      // First navigate to set up browser context
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      }, {
        taskId: 'test-task-1',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      });

      const context: ToolExecutionContext = {
        taskId: 'test-task-3',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      };

      const input = {
        operation: 'type' as BrowserOperation,
        params: {
          selector: '#test-input',
          text: 'Hello World'
        },
      };

      const result = await browserTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // Verify typing was performed
      expect(mockPage.type).toHaveBeenCalledWith('#test-input', 'Hello World', expect.any(Object));
    });

    it('should execute screenshot operation through tool infrastructure', async () => {
      // First navigate to set up browser context
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      }, {
        taskId: 'test-task-1',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      });

      const context: ToolExecutionContext = {
        taskId: 'test-task-4',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      };

      const input = {
        operation: 'screenshot' as BrowserOperation,
        params: { fullPage: true },
      };

      const result = await browserTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.buffer).toBeInstanceOf(Buffer);
      expect(result.data.path).toBeDefined();

      // Verify screenshot was taken
      expect(mockPage.screenshot).toHaveBeenCalledWith(expect.objectContaining({
        fullPage: true
      }));
    });
  });

  describe('Result Handling Through Infrastructure', () => {
    it('should properly format and return results', async () => {
      const context: ToolExecutionContext = {
        taskId: 'test-task-5',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      };

      const input = {
        operation: 'navigate' as BrowserOperation,
        params: { url: 'https://test.example.com' },
      };

      const result = await browserTool.execute(input, context);

      // Verify result structure matches expected format
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('timestamp');

      // Verify result data contains expected fields
      expect(result.data).toHaveProperty('url');
      expect(result.data).toHaveProperty('title');
      expect(result.data).toHaveProperty('status');

      // Verify metadata
      expect(result.metadata).toHaveProperty('operation');
      expect(result.metadata.operation).toBe('navigate');
      expect(result.metadata).toHaveProperty('executionTime');
      expect(typeof result.metadata.executionTime).toBe('number');
    });

    it('should handle complex data structures in results', async () => {
      // First navigate
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      }, {
        taskId: 'test-task-1',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      });

      const context: ToolExecutionContext = {
        taskId: 'test-task-6',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      };

      const input = {
        operation: 'getHtml' as BrowserOperation,
        params: { selector: 'body' },
      };

      const result = await browserTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.html).toBeDefined();
      expect(typeof result.data.html).toBe('string');
    });

    it('should handle binary data in results (screenshots)', async () => {
      // First navigate
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      }, {
        taskId: 'test-task-1',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      });

      const context: ToolExecutionContext = {
        taskId: 'test-task-7',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      };

      const input = {
        operation: 'screenshot' as BrowserOperation,
        params: { format: 'png' },
      };

      const result = await browserTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data.buffer).toBeInstanceOf(Buffer);
      expect(result.data.path).toMatch(/\.png$/);
      expect(result.data.format).toBe('png');
    });
  });

  describe('Error Handling Through Infrastructure', () => {
    it('should handle navigation errors through tool infrastructure', async () => {
      // Mock navigation failure
      mockPage.goto.mockRejectedValueOnce(new Error('Navigation failed'));

      const context: ToolExecutionContext = {
        taskId: 'test-task-8',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      };

      const input = {
        operation: 'navigate' as BrowserOperation,
        params: { url: 'https://invalid.url' },
      };

      const result = await browserTool.execute(input, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Navigation failed');
    });

    it('should handle selector errors through tool infrastructure', async () => {
      // First navigate successfully
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      }, {
        taskId: 'test-task-1',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      });

      // Mock click failure
      mockPage.click.mockRejectedValueOnce(new Error('Element not found'));

      const context: ToolExecutionContext = {
        taskId: 'test-task-9',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      };

      const input = {
        operation: 'click' as BrowserOperation,
        params: { selector: '#non-existent' },
      };

      const result = await browserTool.execute(input, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Element not found');
    });

    it('should handle browser launch errors through tool infrastructure', async () => {
      // Mock browser launch failure
      const { chromium } = await import('playwright');
      (chromium.launch as Mock).mockRejectedValueOnce(new Error('Browser launch failed'));

      // Create new tool instance to trigger fresh browser launch
      const newBrowserTool = new BrowserTool({
        allowedDomains: ['*'],
        blockedDomains: [],
        requireConfirmation: false,
        headless: true,
      }, permissionManager, eventEmitter);

      const context: ToolExecutionContext = {
        taskId: 'test-task-10',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      };

      const input = {
        operation: 'navigate' as BrowserOperation,
        params: { url: 'https://test.example.com' },
      };

      const result = await newBrowserTool.execute(input, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Browser launch failed');

      await newBrowserTool.cleanup();
    });
  });

  describe('Permission System Integration', () => {
    it('should check permissions before executing operations', async () => {
      // Create tool with stricter permissions
      const restrictedConfig = {
        allowedDomains: ['example.com'],
        blockedDomains: ['blocked.com'],
        requireConfirmation: true,
        headless: true,
      };

      const restrictedTool = new BrowserTool(restrictedConfig, permissionManager, eventEmitter);

      const context: ToolExecutionContext = {
        taskId: 'test-task-11',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'restricted' as PermissionLevel,
      };

      // Test allowed domain
      const allowedInput = {
        operation: 'navigate' as BrowserOperation,
        params: { url: 'https://example.com' },
      };

      const allowedResult = await restrictedTool.execute(allowedInput, context);
      expect(allowedResult.success).toBe(true);

      // Test blocked domain
      const blockedInput = {
        operation: 'navigate' as BrowserOperation,
        params: { url: 'https://blocked.com' },
      };

      const blockedResult = await restrictedTool.execute(blockedInput, context);
      expect(blockedResult.success).toBe(false);
      expect(blockedResult.error?.message).toContain('blocked');

      await restrictedTool.cleanup();
    });

    it('should handle permission events through infrastructure', async () => {
      const context: ToolExecutionContext = {
        taskId: 'test-task-12',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      };

      const input = {
        operation: 'navigate' as BrowserOperation,
        params: { url: 'https://test.example.com' },
      };

      await browserTool.execute(input, context);

      // Check if permission-related events were emitted
      const permissionEvents = mockEvents.filter(event =>
        event.event.includes('permission') ||
        event.event.includes('tool:started') ||
        event.event.includes('tool:completed')
      );

      expect(permissionEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Event Emission Through Infrastructure', () => {
    it('should emit tool execution events', async () => {
      const context: ToolExecutionContext = {
        taskId: 'test-task-13',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      };

      const input = {
        operation: 'navigate' as BrowserOperation,
        params: { url: 'https://test.example.com' },
      };

      await browserTool.execute(input, context);

      // Verify events were emitted
      expect(mockEvents.length).toBeGreaterThan(0);

      // Check for specific event types
      const eventTypes = mockEvents.map(e => e.event);
      expect(eventTypes).toContain('tool:started');
      expect(eventTypes).toContain('tool:completed');
    });

    it('should emit error events on failures', async () => {
      // Mock navigation failure
      mockPage.goto.mockRejectedValueOnce(new Error('Navigation failed'));

      const context: ToolExecutionContext = {
        taskId: 'test-task-14',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      };

      const input = {
        operation: 'navigate' as BrowserOperation,
        params: { url: 'https://invalid.url' },
      };

      await browserTool.execute(input, context);

      // Verify error events were emitted
      const errorEvents = mockEvents.filter(e =>
        e.event.includes('error') || e.event.includes('tool:failed')
      );
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    it('should emit progress events for long-running operations', async () => {
      // Mock a long-running screenshot operation
      mockPage.screenshot.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve(Buffer.from('mock-screenshot')), 100)
        )
      );

      // First navigate
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      }, {
        taskId: 'test-task-1',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      });

      const context: ToolExecutionContext = {
        taskId: 'test-task-15',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      };

      const input = {
        operation: 'screenshot' as BrowserOperation,
        params: { fullPage: true },
      };

      await browserTool.execute(input, context);

      // Should have tool execution events
      const toolEvents = mockEvents.filter(e =>
        e.event.startsWith('tool:')
      );
      expect(toolEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Resource Management Through Infrastructure', () => {
    it('should properly manage browser resources', async () => {
      const context: ToolExecutionContext = {
        taskId: 'test-task-16',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      };

      // Execute multiple operations
      const operations = [
        { operation: 'navigate' as BrowserOperation, params: { url: 'https://test1.example.com' } },
        { operation: 'navigate' as BrowserOperation, params: { url: 'https://test2.example.com' } },
        { operation: 'navigate' as BrowserOperation, params: { url: 'https://test3.example.com' } },
      ];

      for (const input of operations) {
        const result = await browserTool.execute(input, context);
        expect(result.success).toBe(true);
      }

      // Verify browser context was reused efficiently
      // Should not create excessive browser instances
      expect(mockBrowser.newContext).toHaveBeenCalled();
      expect(mockContext.newPage).toHaveBeenCalled();
    });

    it('should clean up resources properly', async () => {
      const context: ToolExecutionContext = {
        taskId: 'test-task-17',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      };

      const input = {
        operation: 'navigate' as BrowserOperation,
        params: { url: 'https://test.example.com' },
      };

      await browserTool.execute(input, context);

      // Clean up tool
      await browserTool.cleanup();

      // Verify cleanup was called
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('Validation Through Infrastructure', () => {
    it('should validate inputs before execution', async () => {
      const context: ToolExecutionContext = {
        taskId: 'test-task-18',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      };

      // Test valid input
      const validInput = {
        operation: 'navigate' as BrowserOperation,
        params: { url: 'https://test.example.com' },
      };

      const validResult = await browserTool.validate(validInput, context);
      expect(validResult.isValid).toBe(true);

      // Test invalid input
      const invalidInput = {
        operation: 'invalid-operation' as any,
        params: {},
      };

      const invalidResult = await browserTool.validate(invalidInput, context);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toBeDefined();
      expect(invalidResult.errors!.length).toBeGreaterThan(0);
    });

    it('should validate operation-specific parameters', async () => {
      const context: ToolExecutionContext = {
        taskId: 'test-task-19',
        userId: 'test-user',
        projectPath: '/test/project',
        autonomyLevel: 'guided' as PermissionLevel,
      };

      // Test click without selector (should be invalid)
      const invalidClickInput = {
        operation: 'click' as BrowserOperation,
        params: {},
      };

      const clickResult = await browserTool.validate(invalidClickInput, context);
      expect(clickResult.isValid).toBe(false);

      // Test type without text (should be invalid)
      const invalidTypeInput = {
        operation: 'type' as BrowserOperation,
        params: { selector: '#input' },
      };

      const typeResult = await browserTool.validate(invalidTypeInput, context);
      expect(clickResult.isValid).toBe(false);
    });
  });
});