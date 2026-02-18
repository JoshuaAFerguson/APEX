/**
 * @fileoverview Claude Agent SDK Tool Mocking Utilities
 *
 * Provides comprehensive test utilities for mocking Claude Agent SDK tool calls
 * and responses. Includes helpers to simulate tool execution, capture tool
 * invocations, and verify tool usage patterns in tests.
 */

import type {
  ToolExecution,
  ToolResult,
  AgentTool,
} from '../types.js';

// ============================================================================
// Core Mock Types
// ============================================================================

/**
 * Configuration for mock tool responses
 */
export interface MockToolResponseConfig {
  /** Whether the tool call should succeed */
  success?: boolean;
  /** Output data from the tool */
  output?: unknown;
  /** Error message if the tool fails */
  error?: string;
  /** Delay in milliseconds before responding */
  delay?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Captured tool call information for verification
 */
export interface CapturedToolCall {
  /** Name of the tool that was called */
  toolName: string;
  /** Parameters passed to the tool */
  parameters: Record<string, unknown>;
  /** Timestamp when the tool was called */
  calledAt: Date;
  /** Unique call identifier */
  callId: string;
  /** Agent that made the call */
  agentName?: string;
  /** Workflow stage when called */
  stageName?: string;
}

/**
 * Mock tool behavior configuration
 */
export interface MockToolBehavior {
  /** Static response to return */
  response?: MockToolResponseConfig;
  /** Function that generates a response based on input */
  responseGenerator?: (params: Record<string, unknown>) => MockToolResponseConfig | Promise<MockToolResponseConfig>;
  /** Whether this tool should always fail */
  alwaysFails?: boolean;
  /** Number of times to call before succeeding (for testing retries) */
  failureCount?: number;
}

// ============================================================================
// MockToolExecution - Core Mock Class
// ============================================================================

/**
 * Mock implementation for tool execution in tests.
 * Captures tool calls and provides configurable responses.
 */
export class MockToolExecution {
  private capturedCalls: CapturedToolCall[] = [];
  private toolBehaviors = new Map<string, MockToolBehavior>();
  private callCounts = new Map<string, number>();
  private failureCounts = new Map<string, number>();

  /**
   * Configure behavior for a specific tool
   */
  mockTool(toolName: string, behavior: MockToolBehavior): this {
    this.toolBehaviors.set(toolName, behavior);
    return this;
  }

  /**
   * Mock a tool with a static success response
   */
  mockToolSuccess(toolName: string, output: unknown, metadata?: Record<string, unknown>): this {
    return this.mockTool(toolName, {
      response: { success: true, output, metadata },
    });
  }

  /**
   * Mock a tool with a static failure response
   */
  mockToolFailure(toolName: string, error: string, metadata?: Record<string, unknown>): this {
    return this.mockTool(toolName, {
      response: { success: false, error, metadata },
    });
  }

  /**
   * Mock a tool that responds with a delay
   */
  mockToolDelayed(toolName: string, output: unknown, delay: number): this {
    return this.mockTool(toolName, {
      response: { success: true, output, delay },
    });
  }

  /**
   * Mock a tool that fails for the first N calls, then succeeds
   */
  mockToolRetry(toolName: string, failureCount: number, successOutput: unknown, errorMessage: string = 'Tool temporarily failed'): this {
    return this.mockTool(toolName, {
      failureCount,
      responseGenerator: (params) => {
        const failures = this.failureCounts.get(toolName) || 0;
        if (failures < failureCount) {
          this.failureCounts.set(toolName, failures + 1);
          return { success: false, error: errorMessage };
        }
        return { success: true, output: successOutput };
      },
    });
  }

  /**
   * Mock a tool with dynamic response generation
   */
  mockToolDynamic(
    toolName: string,
    responseGenerator: (params: Record<string, unknown>) => MockToolResponseConfig | Promise<MockToolResponseConfig>
  ): this {
    return this.mockTool(toolName, { responseGenerator });
  }

  /**
   * Simulate a tool execution
   */
  async executeTool(
    toolName: string,
    parameters: Record<string, unknown>,
    context?: {
      agentName?: string;
      stageName?: string;
      taskId?: string;
    }
  ): Promise<ToolExecution> {
    const callId = `mock-call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();

    // Capture the call
    const capturedCall: CapturedToolCall = {
      toolName,
      parameters,
      calledAt: startTime,
      callId,
      agentName: context?.agentName,
      stageName: context?.stageName,
    };
    this.capturedCalls.push(capturedCall);

    // Update call count
    const currentCount = this.callCounts.get(toolName) || 0;
    this.callCounts.set(toolName, currentCount + 1);

    // Get behavior for this tool
    const behavior = this.toolBehaviors.get(toolName);
    let responseConfig: MockToolResponseConfig;

    if (!behavior) {
      // Default behavior: success with echo response
      responseConfig = {
        success: true,
        output: { message: `Tool ${toolName} executed`, parameters },
      };
    } else if (behavior.alwaysFails) {
      responseConfig = {
        success: false,
        error: `Tool ${toolName} is configured to always fail`,
      };
    } else if (behavior.responseGenerator) {
      responseConfig = await behavior.responseGenerator(parameters);
    } else if (behavior.response) {
      responseConfig = behavior.response;
    } else {
      responseConfig = { success: true, output: { message: 'Default success' } };
    }

    // Apply delay if specified
    if (responseConfig.delay && responseConfig.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, responseConfig.delay));
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    // Build the execution result
    const execution: ToolExecution = {
      callId,
      toolName,
      input: parameters,
      taskId: context?.taskId,
      agentName: context?.agentName,
      stageName: context?.stageName,
      startTime,
      endTime,
      duration,
      status: responseConfig.success ? 'completed' : 'failed',
      result: {
        success: responseConfig.success ?? true,
        output: responseConfig.output,
        error: responseConfig.error,
      },
      error: responseConfig.success === false ? responseConfig.error : undefined,
      metadata: responseConfig.metadata,
    };

    return execution;
  }

  // ============================================================================
  // Verification Methods
  // ============================================================================

  /**
   * Get all captured tool calls
   */
  getCapturedCalls(): readonly CapturedToolCall[] {
    return [...this.capturedCalls];
  }

  /**
   * Get captured calls for a specific tool
   */
  getCallsForTool(toolName: string): readonly CapturedToolCall[] {
    return this.capturedCalls.filter(call => call.toolName === toolName);
  }

  /**
   * Get the number of times a tool was called
   */
  getCallCount(toolName: string): number {
    return this.callCounts.get(toolName) || 0;
  }

  /**
   * Get the total number of tool calls made
   */
  getTotalCallCount(): number {
    return this.capturedCalls.length;
  }

  /**
   * Check if a specific tool was called
   */
  wasToolCalled(toolName: string): boolean {
    return this.getCallCount(toolName) > 0;
  }

  /**
   * Check if a tool was called with specific parameters
   */
  wasToolCalledWith(toolName: string, expectedParams: Partial<Record<string, unknown>>): boolean {
    return this.capturedCalls.some(call => {
      if (call.toolName !== toolName) return false;

      for (const [key, value] of Object.entries(expectedParams)) {
        if (call.parameters[key] !== value) return false;
      }

      return true;
    });
  }

  /**
   * Check if tools were called in a specific order
   */
  wereToolsCalledInOrder(toolNames: string[]): boolean {
    const relevantCalls = this.capturedCalls.filter(call =>
      toolNames.includes(call.toolName)
    );

    if (relevantCalls.length < toolNames.length) return false;

    let expectedIndex = 0;
    for (const call of relevantCalls) {
      if (call.toolName === toolNames[expectedIndex]) {
        expectedIndex++;
        if (expectedIndex >= toolNames.length) return true;
      }
    }

    return false;
  }

  /**
   * Assert that a tool was called exactly N times
   */
  assertToolCalledTimes(toolName: string, expectedCount: number): void {
    const actualCount = this.getCallCount(toolName);
    if (actualCount !== expectedCount) {
      throw new Error(
        `Expected ${toolName} to be called ${expectedCount} times, but was called ${actualCount} times`
      );
    }
  }

  /**
   * Assert that a tool was called with specific parameters
   */
  assertToolCalledWith(toolName: string, expectedParams: Partial<Record<string, unknown>>): void {
    if (!this.wasToolCalledWith(toolName, expectedParams)) {
      const calls = this.getCallsForTool(toolName);
      throw new Error(
        `Expected ${toolName} to be called with parameters ${JSON.stringify(expectedParams)}, ` +
        `but actual calls were: ${JSON.stringify(calls.map(c => c.parameters))}`
      );
    }
  }

  /**
   * Assert that tools were called in a specific order
   */
  assertToolsCalledInOrder(toolNames: string[]): void {
    if (!this.wereToolsCalledInOrder(toolNames)) {
      const actualOrder = this.capturedCalls.map(call => call.toolName);
      throw new Error(
        `Expected tools to be called in order [${toolNames.join(', ')}], ` +
        `but actual order was [${actualOrder.join(', ')}]`
      );
    }
  }

  /**
   * Reset all captured calls and behaviors
   */
  reset(): void {
    this.capturedCalls = [];
    this.toolBehaviors.clear();
    this.callCounts.clear();
    this.failureCounts.clear();
  }

  /**
   * Reset only captured calls (keep behaviors)
   */
  resetCalls(): void {
    this.capturedCalls = [];
    this.callCounts.clear();
    this.failureCounts.clear();
  }

  /**
   * Reset only behaviors (keep captured calls)
   */
  resetBehaviors(): void {
    this.toolBehaviors.clear();
  }
}

// ============================================================================
// Builder Pattern for Complex Scenarios
// ============================================================================

/**
 * Builder for creating complex tool mocking scenarios
 */
export class MockToolScenarioBuilder {
  private mockExecution = new MockToolExecution();

  /**
   * Add a tool with success behavior
   */
  withSuccessTool(toolName: string, output: unknown): this {
    this.mockExecution.mockToolSuccess(toolName, output);
    return this;
  }

  /**
   * Add a tool with failure behavior
   */
  withFailingTool(toolName: string, error: string): this {
    this.mockExecution.mockToolFailure(toolName, error);
    return this;
  }

  /**
   * Add a tool with retry behavior
   */
  withRetryTool(toolName: string, failureCount: number, successOutput: unknown): this {
    this.mockExecution.mockToolRetry(toolName, failureCount, successOutput);
    return this;
  }

  /**
   * Add a tool with delay
   */
  withDelayedTool(toolName: string, output: unknown, delay: number): this {
    this.mockExecution.mockToolDelayed(toolName, output, delay);
    return this;
  }

  /**
   * Add a tool with dynamic behavior
   */
  withDynamicTool(
    toolName: string,
    responseGenerator: (params: Record<string, unknown>) => MockToolResponseConfig
  ): this {
    this.mockExecution.mockToolDynamic(toolName, responseGenerator);
    return this;
  }

  /**
   * Build the mock tool execution
   */
  build(): MockToolExecution {
    return this.mockExecution;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a mock tool execution with default behavior
 */
export function createMockToolExecution(): MockToolExecution {
  return new MockToolExecution();
}

/**
 * Create a builder for complex scenarios
 */
export function createMockToolScenario(): MockToolScenarioBuilder {
  return new MockToolScenarioBuilder();
}

/**
 * Create a mock tool execution pre-configured with common file tools
 */
export function createFileSystemMockTools(): MockToolExecution {
  return createMockToolScenario()
    .withSuccessTool('Read', { content: 'mock file content', encoding: 'utf-8' })
    .withSuccessTool('Write', { written: true, bytesWritten: 100 })
    .withSuccessTool('Edit', { edited: true, changes: 1 })
    .withSuccessTool('Glob', { matches: ['/test/file1.js', '/test/file2.js'] })
    .withSuccessTool('Grep', { matches: [], pattern: 'test' })
    .build();
}

/**
 * Create a mock tool execution pre-configured with common shell tools
 */
export function createShellMockTools(): MockToolExecution {
  return createMockToolScenario()
    .withSuccessTool('Bash', { stdout: 'command output', stderr: '', exitCode: 0 })
    .build();
}

/**
 * Create a mock tool execution pre-configured with web tools
 */
export function createWebMockTools(): MockToolExecution {
  return createMockToolScenario()
    .withSuccessTool('WebFetch', {
      content: '<html><body>test</body></html>',
      statusCode: 200
    })
    .withSuccessTool('WebSearch', {
      results: [{ title: 'Test', url: 'https://example.com' }],
      totalResults: 1
    })
    .build();
}

/**
 * Create a comprehensive mock tool execution with all common tools
 */
export function createComprehensiveMockTools(): MockToolExecution {
  const fileSystemMock = createFileSystemMockTools();
  const shellMock = createShellMockTools();
  const webMock = createWebMockTools();

  // Combine all behaviors
  const comprehensive = createMockToolExecution();

  // Copy behaviors from specialized mocks
  ['Read', 'Write', 'Edit', 'Glob', 'Grep'].forEach(tool => {
    const calls = fileSystemMock.getCallsForTool(tool);
    if (calls.length === 0) {
      // Add default behavior if not already present
      comprehensive.mockToolSuccess(tool, { message: `${tool} mock response` });
    }
  });

  comprehensive.mockToolSuccess('Bash', { stdout: 'mock output', stderr: '', exitCode: 0 });
  comprehensive.mockToolSuccess('WebFetch', { content: 'mock content', statusCode: 200 });
  comprehensive.mockToolSuccess('WebSearch', { results: [], totalResults: 0 });
  comprehensive.mockToolSuccess('TodoWrite', { success: true });
  comprehensive.mockToolSuccess('Browser', { success: true });

  return comprehensive;
}