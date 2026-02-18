/**
 * Claude Agent SDK Tool Mocking Utilities
 *
 * Comprehensive mocking utilities for testing Claude Agent SDK integration.
 * Provides tools to mock tool calls, capture invocations, and verify usage patterns.
 */

import { vi, type MockInstance } from 'vitest';
import EventEmitter from 'events';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Represents a tool call made to the Claude Agent SDK
 */
export interface ToolCall {
  /** Tool name that was called */
  toolName: string;
  /** Parameters passed to the tool */
  parameters: Record<string, unknown>;
  /** When the tool was called */
  timestamp: Date;
  /** Call index for ordering */
  callIndex: number;
  /** Result returned by the mock */
  result?: unknown;
  /** Error thrown by the mock (if any) */
  error?: Error;
}

/**
 * Configuration for tool mock behavior
 */
export interface ToolMockConfig {
  /** Tool name this mock applies to */
  toolName: string;
  /** Result to return when tool is called */
  result?: unknown;
  /** Error to throw when tool is called */
  error?: Error;
  /** Delay before returning result (in ms) */
  delay?: number;
  /** Custom implementation function */
  implementation?: (params: Record<string, unknown>) => unknown;
  /** Whether to track calls to this tool */
  trackCalls?: boolean;
}

/**
 * Options for configuring the Claude Agent SDK mock
 */
export interface SDKMockOptions {
  /** Whether to track all tool calls */
  trackCalls?: boolean;
  /** Default response for unmocked tools */
  defaultResponse?: unknown;
  /** Whether to throw on unmocked tools */
  throwOnUnmocked?: boolean;
}

/**
 * Mock response structure from Claude Agent SDK query
 */
export interface MockQueryResponse {
  /** Response content */
  content: string;
  /** Tool calls made during execution */
  toolCalls?: ToolCall[];
  /** Usage information */
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

// ============================================================================
// Mock Tool Manager
// ============================================================================

/**
 * Manages mocking of Claude Agent SDK tool calls
 * Provides comprehensive testing utilities for tool integration
 */
export class MockToolManager extends EventEmitter {
  private toolMocks = new Map<string, ToolMockConfig>();
  private toolCalls: ToolCall[] = [];
  private callCounter = 0;
  private options: SDKMockOptions;
  private queryMock: MockInstance | null = null;

  constructor(options: SDKMockOptions = {}) {
    super();
    this.options = {
      trackCalls: true,
      defaultResponse: { success: true },
      throwOnUnmocked: false,
      ...options,
    };
  }

  /**
   * Configure mock behavior for a specific tool
   */
  mockTool(config: ToolMockConfig): void {
    this.toolMocks.set(config.toolName, {
      trackCalls: true,
      ...config,
    });
    this.emit('toolMocked', config.toolName);
  }

  /**
   * Mock multiple tools at once
   */
  mockTools(configs: ToolMockConfig[]): void {
    configs.forEach(config => this.mockTool(config));
  }

  /**
   * Remove mock for a specific tool
   */
  unmockTool(toolName: string): void {
    this.toolMocks.delete(toolName);
    this.emit('toolUnmocked', toolName);
  }

  /**
   * Clear all tool mocks
   */
  clearMocks(): void {
    this.toolMocks.clear();
    this.emit('mocksCleared');
  }

  /**
   * Reset call history without clearing mocks
   */
  resetCallHistory(): void {
    this.toolCalls = [];
    this.callCounter = 0;
    this.emit('historyReset');
  }

  /**
   * Setup Claude Agent SDK query mock
   */
  setupSDKMock(): MockInstance {
    if (this.queryMock) {
      return this.queryMock;
    }

    // Mock the query function to capture tool calls
    const mockQuery = vi.fn().mockImplementation(async (options: {
      agentDefinition?: unknown;
      prompt?: string;
      tools?: Record<string, unknown>;
    }) => {
      const { tools = {} } = options;
      const toolCallsInQuery: ToolCall[] = [];

      // Simulate tool execution for each tool in the query
      for (const [toolName, toolDef] of Object.entries(tools)) {
        const mockConfig = this.toolMocks.get(toolName);

        if (mockConfig) {
          const call = await this.executeToolMock(toolName, {}, mockConfig);
          toolCallsInQuery.push(call);
        }
      }

      // Return mock response
      const response: MockQueryResponse = {
        content: `Mock response with ${toolCallsInQuery.length} tool calls`,
        toolCalls: toolCallsInQuery,
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        },
      };

      this.emit('queryExecuted', response);
      return response;
    });

    this.queryMock = mockQuery;
    return mockQuery;
  }

  /**
   * Execute a tool mock with the given parameters
   */
  private async executeToolMock(
    toolName: string,
    parameters: Record<string, unknown>,
    config: ToolMockConfig
  ): Promise<ToolCall> {
    const call: ToolCall = {
      toolName,
      parameters,
      timestamp: new Date(),
      callIndex: this.callCounter++,
    };

    try {
      // Apply delay if configured
      if (config.delay && config.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, config.delay));
      }

      // Throw error if configured
      if (config.error) {
        call.error = config.error;
        throw config.error;
      }

      // Use custom implementation if provided
      if (config.implementation) {
        call.result = await config.implementation(parameters);
      } else {
        call.result = config.result;
      }
    } catch (error) {
      call.error = error instanceof Error ? error : new Error(String(error));
      throw error;
    } finally {
      // Track call if enabled
      if (config.trackCalls && this.options.trackCalls) {
        this.toolCalls.push(call);
        this.emit('toolCalled', call);
      }
    }

    return call;
  }

  /**
   * Get all recorded tool calls
   */
  getToolCalls(): ToolCall[] {
    return [...this.toolCalls];
  }

  /**
   * Get calls for a specific tool
   */
  getToolCallsFor(toolName: string): ToolCall[] {
    return this.toolCalls.filter(call => call.toolName === toolName);
  }

  /**
   * Get the most recent call for a tool
   */
  getLastCallFor(toolName: string): ToolCall | undefined {
    const calls = this.getToolCallsFor(toolName);
    return calls.length > 0 ? calls[calls.length - 1] : undefined;
  }

  /**
   * Check if a tool was called
   */
  wasToolCalled(toolName: string): boolean {
    return this.toolCalls.some(call => call.toolName === toolName);
  }

  /**
   * Get the number of times a tool was called
   */
  getToolCallCount(toolName: string): number {
    return this.toolCalls.filter(call => call.toolName === toolName).length;
  }

  /**
   * Verify tool was called with specific parameters
   */
  verifyToolCalledWith(toolName: string, expectedParams: Record<string, unknown>): boolean {
    const calls = this.getToolCallsFor(toolName);
    return calls.some(call =>
      this.parametersMatch(call.parameters, expectedParams)
    );
  }

  /**
   * Verify the order of tool calls
   */
  verifyCallOrder(expectedOrder: string[]): boolean {
    const actualOrder = this.toolCalls
      .sort((a, b) => a.callIndex - b.callIndex)
      .map(call => call.toolName);

    return JSON.stringify(actualOrder) === JSON.stringify(expectedOrder);
  }

  /**
   * Helper to check if parameters match
   */
  private parametersMatch(
    actual: Record<string, unknown>,
    expected: Record<string, unknown>
  ): boolean {
    for (const [key, value] of Object.entries(expected)) {
      if (actual[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Cleanup method to restore original functions
   */
  cleanup(): void {
    if (this.queryMock) {
      this.queryMock.mockRestore();
      this.queryMock = null;
    }
    this.clearMocks();
    this.resetCallHistory();
    this.removeAllListeners();
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a preconfigured mock tool manager
 */
export function createMockToolManager(options?: SDKMockOptions): MockToolManager {
  return new MockToolManager(options);
}

/**
 * Quick setup for common tool mocks
 */
export function setupCommonToolMocks(manager: MockToolManager): void {
  // Mock common read/write tools
  manager.mockTools([
    {
      toolName: 'Read',
      result: { content: 'Mock file content' },
    },
    {
      toolName: 'Write',
      result: { success: true },
    },
    {
      toolName: 'Edit',
      result: { success: true },
    },
    {
      toolName: 'Bash',
      result: { stdout: 'Mock command output', stderr: '', exitCode: 0 },
    },
    {
      toolName: 'Glob',
      result: { files: ['file1.ts', 'file2.ts'] },
    },
    {
      toolName: 'Grep',
      result: { matches: [] },
    },
  ]);
}

/**
 * Create a failing tool mock for error testing
 */
export function createFailingToolMock(toolName: string, error: Error): ToolMockConfig {
  return {
    toolName,
    error,
    trackCalls: true,
  };
}

/**
 * Create a delayed tool mock for timing tests
 */
export function createDelayedToolMock(
  toolName: string,
  result: unknown,
  delayMs: number
): ToolMockConfig {
  return {
    toolName,
    result,
    delay: delayMs,
    trackCalls: true,
  };
}

/**
 * Create a tool mock with custom implementation
 */
export function createCustomToolMock(
  toolName: string,
  implementation: (params: Record<string, unknown>) => unknown
): ToolMockConfig {
  return {
    toolName,
    implementation,
    trackCalls: true,
  };
}

/**
 * Mock the entire Claude Agent SDK module for testing
 */
export function mockClaudeAgentSDK(): MockToolManager {
  const manager = createMockToolManager();

  // Setup the SDK mock
  const queryMock = manager.setupSDKMock();

  // Mock the module
  vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
    query: queryMock,
  }));

  return manager;
}

/**
 * Restore the Claude Agent SDK module after testing
 */
export function restoreClaudeAgentSDK(): void {
  vi.unmock('@anthropic-ai/claude-agent-sdk');
}

// ============================================================================
// Test Assertions
// ============================================================================

/**
 * Assert that a tool was called
 */
export function expectToolToBeCalled(manager: MockToolManager, toolName: string): void {
  if (!manager.wasToolCalled(toolName)) {
    throw new Error(`Expected tool '${toolName}' to be called, but it was not`);
  }
}

/**
 * Assert that a tool was called with specific parameters
 */
export function expectToolToBeCalledWith(
  manager: MockToolManager,
  toolName: string,
  expectedParams: Record<string, unknown>
): void {
  if (!manager.verifyToolCalledWith(toolName, expectedParams)) {
    const actualCalls = manager.getToolCallsFor(toolName);
    const actualParams = actualCalls.map(call => call.parameters);
    throw new Error(
      `Expected tool '${toolName}' to be called with ${JSON.stringify(expectedParams)}, ` +
      `but actual calls were: ${JSON.stringify(actualParams)}`
    );
  }
}

/**
 * Assert that tools were called in a specific order
 */
export function expectToolCallOrder(
  manager: MockToolManager,
  expectedOrder: string[]
): void {
  if (!manager.verifyCallOrder(expectedOrder)) {
    const actualOrder = manager.getToolCalls()
      .sort((a, b) => a.callIndex - b.callIndex)
      .map(call => call.toolName);
    throw new Error(
      `Expected tool call order: ${JSON.stringify(expectedOrder)}, ` +
      `but actual order was: ${JSON.stringify(actualOrder)}`
    );
  }
}

/**
 * Assert that a tool was called a specific number of times
 */
export function expectToolCallCount(
  manager: MockToolManager,
  toolName: string,
  expectedCount: number
): void {
  const actualCount = manager.getToolCallCount(toolName);
  if (actualCount !== expectedCount) {
    throw new Error(
      `Expected tool '${toolName}' to be called ${expectedCount} times, ` +
      `but it was called ${actualCount} times`
    );
  }
}