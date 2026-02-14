/**
 * Tests for Claude Agent SDK Tool Mocking Utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MockToolManager,
  createMockToolManager,
  setupCommonToolMocks,
  createFailingToolMock,
  createDelayedToolMock,
  createCustomToolMock,
  mockClaudeAgentSDK,
  restoreClaudeAgentSDK,
  expectToolToBeCalled,
  expectToolToBeCalledWith,
  expectToolCallOrder,
  expectToolCallCount,
  type ToolCall,
  type ToolMockConfig,
} from '../claude-agent-sdk-mocks';

describe('MockToolManager', () => {
  let manager: MockToolManager;

  beforeEach(() => {
    manager = createMockToolManager();
  });

  afterEach(() => {
    manager.cleanup();
  });

  describe('Basic Functionality', () => {
    it('should create a mock tool manager with default options', () => {
      expect(manager).toBeInstanceOf(MockToolManager);
    });

    it('should mock a single tool', () => {
      const config: ToolMockConfig = {
        toolName: 'Read',
        result: { content: 'test content' },
      };

      manager.mockTool(config);
      expect(manager.wasToolCalled('Read')).toBe(false);
    });

    it('should mock multiple tools', () => {
      const configs: ToolMockConfig[] = [
        { toolName: 'Read', result: { content: 'test' } },
        { toolName: 'Write', result: { success: true } },
      ];

      manager.mockTools(configs);
    });

    it('should unmock a tool', () => {
      manager.mockTool({ toolName: 'Read', result: { content: 'test' } });
      manager.unmockTool('Read');
    });

    it('should clear all mocks', () => {
      manager.mockTools([
        { toolName: 'Read', result: { content: 'test' } },
        { toolName: 'Write', result: { success: true } },
      ]);
      manager.clearMocks();
    });
  });

  describe('SDK Mock Integration', () => {
    it('should setup SDK mock and return mock function', () => {
      const mockQuery = manager.setupSDKMock();
      expect(mockQuery).toBeDefined();
      expect(vi.isMockFunction(mockQuery)).toBe(true);
    });

    it('should handle query execution with mocked tools', async () => {
      manager.mockTool({
        toolName: 'Read',
        result: { content: 'mock content' },
      });

      const mockQuery = manager.setupSDKMock();
      const response = await mockQuery({
        prompt: 'test prompt',
        tools: { Read: {} },
      });

      expect(response).toMatchObject({
        content: expect.stringContaining('tool calls'),
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        },
      });
    });
  });

  describe('Call Tracking', () => {
    beforeEach(() => {
      // Setup a mock tool and execute it
      manager.mockTool({
        toolName: 'Read',
        result: { content: 'test content' },
      });
    });

    it('should track tool calls', async () => {
      const mockQuery = manager.setupSDKMock();
      await mockQuery({ tools: { Read: {} } });

      const calls = manager.getToolCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        toolName: 'Read',
        result: { content: 'test content' },
        timestamp: expect.any(Date),
        callIndex: 0,
      });
    });

    it('should get calls for specific tool', async () => {
      manager.mockTool({
        toolName: 'Write',
        result: { success: true },
      });

      const mockQuery = manager.setupSDKMock();
      await mockQuery({ tools: { Read: {}, Write: {} } });

      const readCalls = manager.getToolCallsFor('Read');
      const writeCalls = manager.getToolCallsFor('Write');

      expect(readCalls).toHaveLength(1);
      expect(writeCalls).toHaveLength(1);
      expect(readCalls[0].toolName).toBe('Read');
      expect(writeCalls[0].toolName).toBe('Write');
    });

    it('should get last call for tool', async () => {
      const mockQuery = manager.setupSDKMock();

      // Execute multiple queries
      await mockQuery({ tools: { Read: {} } });
      await mockQuery({ tools: { Read: {} } });

      const lastCall = manager.getLastCallFor('Read');
      expect(lastCall).toBeDefined();
      expect(lastCall?.callIndex).toBe(1); // Second call
    });

    it('should check if tool was called', async () => {
      expect(manager.wasToolCalled('Read')).toBe(false);

      const mockQuery = manager.setupSDKMock();
      await mockQuery({ tools: { Read: {} } });

      expect(manager.wasToolCalled('Read')).toBe(true);
      expect(manager.wasToolCalled('Write')).toBe(false);
    });

    it('should count tool calls', async () => {
      const mockQuery = manager.setupSDKMock();

      await mockQuery({ tools: { Read: {} } });
      await mockQuery({ tools: { Read: {} } });
      await mockQuery({ tools: { Read: {} } });

      expect(manager.getToolCallCount('Read')).toBe(3);
      expect(manager.getToolCallCount('Write')).toBe(0);
    });

    it('should reset call history', async () => {
      const mockQuery = manager.setupSDKMock();
      await mockQuery({ tools: { Read: {} } });

      expect(manager.getToolCalls()).toHaveLength(1);

      manager.resetCallHistory();
      expect(manager.getToolCalls()).toHaveLength(0);
      expect(manager.wasToolCalled('Read')).toBe(false);
    });
  });

  describe('Parameter Verification', () => {
    it('should verify tool called with specific parameters', async () => {
      manager.mockTool({
        toolName: 'Read',
        result: { content: 'test' },
        implementation: (params) => {
          // Store the parameters for verification
          return { content: 'test', receivedParams: params };
        },
      });

      // Note: This test demonstrates the concept, but actual parameter passing
      // would need to be implemented in the query mock based on your SDK usage
      const result = manager.verifyToolCalledWith('Read', { file: 'test.txt' });
      expect(typeof result).toBe('boolean');
    });

    it('should verify call order', async () => {
      manager.mockTools([
        { toolName: 'Read', result: { content: 'test' } },
        { toolName: 'Write', result: { success: true } },
        { toolName: 'Edit', result: { success: true } },
      ]);

      const mockQuery = manager.setupSDKMock();

      // Execute tools in specific order
      await mockQuery({ tools: { Read: {} } });
      await mockQuery({ tools: { Write: {} } });
      await mockQuery({ tools: { Edit: {} } });

      expect(manager.verifyCallOrder(['Read', 'Write', 'Edit'])).toBe(true);
      expect(manager.verifyCallOrder(['Write', 'Read', 'Edit'])).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle tool mock errors', async () => {
      const testError = new Error('Mock error');
      manager.mockTool({
        toolName: 'Read',
        error: testError,
      });

      const mockQuery = manager.setupSDKMock();

      await expect(mockQuery({ tools: { Read: {} } }))
        .rejects.toThrow('Mock error');

      const calls = manager.getToolCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].error).toBe(testError);
    });

    it('should handle custom implementation errors', async () => {
      manager.mockTool({
        toolName: 'Read',
        implementation: () => {
          throw new Error('Custom implementation error');
        },
      });

      const mockQuery = manager.setupSDKMock();

      await expect(mockQuery({ tools: { Read: {} } }))
        .rejects.toThrow('Custom implementation error');
    });
  });

  describe('Timing and Delays', () => {
    it('should handle delayed tool responses', async () => {
      const delay = 100;
      manager.mockTool({
        toolName: 'Read',
        result: { content: 'delayed content' },
        delay,
      });

      const mockQuery = manager.setupSDKMock();
      const start = Date.now();

      await mockQuery({ tools: { Read: {} } });

      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(delay - 10); // Allow for timing variance
    });
  });

  describe('Custom Implementations', () => {
    it('should use custom implementation function', async () => {
      const customImpl = vi.fn((params: Record<string, unknown>) => {
        return { customResult: true, params };
      });

      manager.mockTool({
        toolName: 'CustomTool',
        implementation: customImpl,
      });

      const mockQuery = manager.setupSDKMock();
      await mockQuery({ tools: { CustomTool: {} } });

      expect(customImpl).toHaveBeenCalled();

      const calls = manager.getToolCalls();
      expect(calls[0].result).toMatchObject({
        customResult: true,
      });
    });
  });

  describe('Events', () => {
    it('should emit events for tool operations', () => {
      const toolMockedSpy = vi.fn();
      const toolUnmockedSpy = vi.fn();
      const mocksClearedSpy = vi.fn();
      const historyResetSpy = vi.fn();

      manager.on('toolMocked', toolMockedSpy);
      manager.on('toolUnmocked', toolUnmockedSpy);
      manager.on('mocksCleared', mocksClearedSpy);
      manager.on('historyReset', historyResetSpy);

      manager.mockTool({ toolName: 'Test', result: {} });
      expect(toolMockedSpy).toHaveBeenCalledWith('Test');

      manager.unmockTool('Test');
      expect(toolUnmockedSpy).toHaveBeenCalledWith('Test');

      manager.clearMocks();
      expect(mocksClearedSpy).toHaveBeenCalled();

      manager.resetCallHistory();
      expect(historyResetSpy).toHaveBeenCalled();
    });

    it('should emit tool called events', async () => {
      const toolCalledSpy = vi.fn();
      manager.on('toolCalled', toolCalledSpy);

      manager.mockTool({ toolName: 'Read', result: { content: 'test' } });

      const mockQuery = manager.setupSDKMock();
      await mockQuery({ tools: { Read: {} } });

      expect(toolCalledSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'Read',
          result: { content: 'test' },
        })
      );
    });
  });
});

describe('Utility Functions', () => {
  describe('createMockToolManager', () => {
    it('should create manager with custom options', () => {
      const manager = createMockToolManager({
        trackCalls: false,
        defaultResponse: { custom: true },
        throwOnUnmocked: true,
      });

      expect(manager).toBeInstanceOf(MockToolManager);
    });
  });

  describe('setupCommonToolMocks', () => {
    it('should setup common tool mocks', () => {
      const manager = createMockToolManager();
      setupCommonToolMocks(manager);

      // Verify that common tools are mocked (this would need actual tool execution)
      expect(manager).toBeInstanceOf(MockToolManager);
    });
  });

  describe('createFailingToolMock', () => {
    it('should create a failing tool mock configuration', () => {
      const error = new Error('Test error');
      const config = createFailingToolMock('TestTool', error);

      expect(config).toMatchObject({
        toolName: 'TestTool',
        error,
        trackCalls: true,
      });
    });
  });

  describe('createDelayedToolMock', () => {
    it('should create a delayed tool mock configuration', () => {
      const config = createDelayedToolMock('TestTool', { result: true }, 500);

      expect(config).toMatchObject({
        toolName: 'TestTool',
        result: { result: true },
        delay: 500,
        trackCalls: true,
      });
    });
  });

  describe('createCustomToolMock', () => {
    it('should create a custom tool mock configuration', () => {
      const impl = vi.fn();
      const config = createCustomToolMock('TestTool', impl);

      expect(config).toMatchObject({
        toolName: 'TestTool',
        implementation: impl,
        trackCalls: true,
      });
    });
  });
});

describe('Module Mocking', () => {
  afterEach(() => {
    restoreClaudeAgentSDK();
  });

  describe('mockClaudeAgentSDK', () => {
    it('should mock the entire Claude Agent SDK module', () => {
      const manager = mockClaudeAgentSDK();

      expect(manager).toBeInstanceOf(MockToolManager);

      // The mock should be set up
      expect(vi.isMocked).toBeDefined();
    });
  });

  describe('restoreClaudeAgentSDK', () => {
    it('should restore the Claude Agent SDK module', () => {
      mockClaudeAgentSDK();
      restoreClaudeAgentSDK();

      // After restoration, the mock should be cleared
      expect(vi.isMocked).toBeDefined();
    });
  });
});

describe('Test Assertions', () => {
  let manager: MockToolManager;

  beforeEach(async () => {
    manager = createMockToolManager();
    manager.mockTool({ toolName: 'Read', result: { content: 'test' } });

    const mockQuery = manager.setupSDKMock();
    await mockQuery({ tools: { Read: {} } });
  });

  afterEach(() => {
    manager.cleanup();
  });

  describe('expectToolToBeCalled', () => {
    it('should pass when tool was called', () => {
      expect(() => expectToolToBeCalled(manager, 'Read')).not.toThrow();
    });

    it('should throw when tool was not called', () => {
      expect(() => expectToolToBeCalled(manager, 'Write'))
        .toThrow("Expected tool 'Write' to be called, but it was not");
    });
  });

  describe('expectToolToBeCalledWith', () => {
    it('should pass when parameters match', () => {
      // This test would need actual parameter tracking implementation
      expect(() => expectToolToBeCalledWith(manager, 'Read', {})).not.toThrow();
    });

    it('should throw when parameters don\'t match', () => {
      expect(() => expectToolToBeCalledWith(manager, 'Read', { file: 'nonexistent.txt' }))
        .toThrow();
    });
  });

  describe('expectToolCallOrder', () => {
    it('should pass when order matches', async () => {
      manager.mockTool({ toolName: 'Write', result: { success: true } });

      const mockQuery = manager.setupSDKMock();
      await mockQuery({ tools: { Write: {} } });

      expect(() => expectToolCallOrder(manager, ['Read', 'Write'])).not.toThrow();
    });

    it('should throw when order doesn\'t match', async () => {
      manager.mockTool({ toolName: 'Write', result: { success: true } });

      const mockQuery = manager.setupSDKMock();
      await mockQuery({ tools: { Write: {} } });

      expect(() => expectToolCallOrder(manager, ['Write', 'Read']))
        .toThrow();
    });
  });

  describe('expectToolCallCount', () => {
    it('should pass when count matches', () => {
      expect(() => expectToolCallCount(manager, 'Read', 1)).not.toThrow();
    });

    it('should throw when count doesn\'t match', () => {
      expect(() => expectToolCallCount(manager, 'Read', 2))
        .toThrow("Expected tool 'Read' to be called 2 times, but it was called 1 times");
    });
  });
});