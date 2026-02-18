# ADR-094: Tool Mocking Utilities for Claude Agent SDK Integration

**Status**: Proposed
**Date**: 2025-02-05
**Author**: Architect Agent

## Context

The APEX codebase requires comprehensive test utilities to mock Claude Agent SDK tool calls and responses. While ADR-035 established the foundation for `MockClaudeAgentSDK` focusing on `query()` mocking, there is a gap in test utilities specifically designed for:

1. **Tool Definition Mocking**: Mocking the `tool()` function from `@anthropic-ai/claude-agent-sdk`
2. **Tool Execution Simulation**: Simulating tool execution results and side effects
3. **Tool Invocation Capture**: Capturing and verifying tool invocations during tests
4. **Tool Usage Pattern Verification**: Verifying tool usage patterns and sequences

### Current State Analysis

The existing mock infrastructure includes:

1. **MockClaudeAgentSDK** (`packages/orchestrator/src/__tests__/mocks/claude-agent-sdk.ts`):
   - Comprehensive `query()` mocking
   - Streaming response simulation
   - Response builder pattern
   - Call history tracking

2. **Tool Execution Hooks** (`packages/core/src/types.ts`):
   - `ToolStartHookContext`, `ToolCompleteHookContext`, `ToolErrorHookContext` types
   - Event-based tool execution tracking

3. **MCP Mock Server** (`packages/orchestrator/src/mcp/mock-server/`):
   - `MockMCPServerBuilder` with fluent API
   - Tool handler configuration
   - Response sequences and dynamic handlers

4. **Mock Helpers** (`packages/core/src/test-fixtures/mock-helpers.ts`):
   - Factory functions for common mocks
   - `createAgentSdkMock()` for basic SDK mocking

### Gap Analysis

The acceptance criteria require:
> Test utilities exist to mock Claude Agent SDK tool calls and responses. Helpers can simulate tool execution, capture tool invocations, and verify tool usage patterns in tests.

Missing capabilities:
- No dedicated utility for mocking the `tool()` function
- No standardized way to simulate individual tool executions
- No fluent API for capturing and asserting tool invocations
- No pattern matchers for verifying tool usage sequences

## Decision

Create a dedicated `MockToolRegistry` utility that extends the existing mock infrastructure to provide comprehensive tool mocking capabilities.

## Technical Design

### 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          Tool Mocking Utilities                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                        MockToolRegistry                                 │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │  │
│  │  │  Tool Registration                                                │  │  │
│  │  │  - registerTool(name, schema, handler): MockToolDefinition       │  │  │
│  │  │  - registerToolWithResponses(name, schema, responses): void      │  │  │
│  │  │  - getTool(name): MockToolDefinition                             │  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │  │
│  │  │  Tool Execution Simulation                                        │  │  │
│  │  │  - simulateExecution(toolName, input): MockToolResult            │  │  │
│  │  │  - simulateError(toolName, error): void                          │  │  │
│  │  │  - queueResponses(toolName, responses): void                     │  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │  │
│  │  │  Invocation Capture                                               │  │  │
│  │  │  - getInvocations(toolName?): ToolInvocationRecord[]             │  │  │
│  │  │  - getLastInvocation(toolName): ToolInvocationRecord             │  │  │
│  │  │  - clearInvocations(): void                                       │  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │  │
│  │  │  Usage Pattern Verification                                       │  │  │
│  │  │  - wasToolCalled(toolName): boolean                              │  │  │
│  │  │  - wasCalledWith(toolName, expectedInput): boolean               │  │  │
│  │  │  - verifyCallSequence(sequence): VerificationResult              │  │  │
│  │  │  - expectToolCalls(expectations): void (throws on mismatch)      │  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                        MockToolBuilder (Fluent API)                     │  │
│  │  new MockToolBuilder('Read')                                            │  │
│  │    .withSchema({ file_path: z.string() })                              │  │
│  │    .withResponse({ content: [{ type: 'text', text: 'file content' }]}) │  │
│  │    .withDynamicHandler((args) => ({ ... }))                            │  │
│  │    .withSequence([response1, response2, response3])                    │  │
│  │    .withDelay(100)                                                      │  │
│  │    .withErrorOn(3, new Error('Rate limit'))                            │  │
│  │    .build(): MockToolDefinition                                         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                        Integration with Existing Mocks                  │  │
│  │  - Extends MockClaudeAgentSDK with tool() function mock                │  │
│  │  - Integrates with createMockModule() for vi.mock() usage              │  │
│  │  - Emits tool execution events for hook testing                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2. Core Type Definitions

```typescript
// packages/orchestrator/src/__tests__/mocks/tool-mock.types.ts

import type { z } from 'zod';

/**
 * Content block types for tool responses (matches SDK types)
 */
export type MockToolContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'resource'; resource: { uri: string; mimeType?: string; text?: string } };

/**
 * Result of a mock tool execution
 */
export interface MockToolResult {
  content: MockToolContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/**
 * Record of a tool invocation for tracking and verification
 */
export interface ToolInvocationRecord {
  toolName: string;
  input: Record<string, unknown>;
  timestamp: Date;
  callId: string;
  result?: MockToolResult;
  error?: Error;
  duration?: number;
}

/**
 * Configuration for mock tool behavior
 */
export interface MockToolConfig {
  /** Static response to return */
  response?: MockToolResult;
  /** Dynamic handler function */
  handler?: MockToolHandler;
  /** Sequence of responses to cycle through */
  responseSequence?: MockToolResult[];
  /** Delay in ms before returning */
  delay?: number;
  /** Error to throw on specific call number */
  errorOnCall?: { callNumber: number; error: Error }[];
  /** Maximum number of invocations allowed */
  maxInvocations?: number;
}

/**
 * Handler function type for dynamic tool responses
 */
export type MockToolHandler = (
  args: Record<string, unknown>,
  context: MockToolContext
) => MockToolResult | Promise<MockToolResult>;

/**
 * Context provided to mock tool handlers
 */
export interface MockToolContext {
  toolName: string;
  callId: string;
  invocationCount: number;
  timestamp: Date;
}

/**
 * Definition of a mock tool
 */
export interface MockToolDefinition {
  name: string;
  description: string;
  schema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  config: MockToolConfig;
}

/**
 * Verification result for tool call sequence assertions
 */
export interface ToolCallVerificationResult {
  passed: boolean;
  expectedSequence: string[];
  actualSequence: string[];
  mismatches: Array<{
    index: number;
    expected: string;
    actual: string | undefined;
  }>;
}

/**
 * Expectation for tool call verification
 */
export interface ToolCallExpectation {
  toolName: string;
  input?: Record<string, unknown> | ((input: Record<string, unknown>) => boolean);
  times?: number | { min?: number; max?: number };
}
```

### 3. MockToolRegistry Implementation

```typescript
// packages/orchestrator/src/__tests__/mocks/tool-mock-registry.ts

import { vi } from 'vitest';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type {
  MockToolDefinition,
  MockToolConfig,
  MockToolResult,
  MockToolHandler,
  MockToolContext,
  ToolInvocationRecord,
  ToolCallVerificationResult,
  ToolCallExpectation,
} from './tool-mock.types';

/**
 * MockToolRegistry - Central registry for mock tool management
 *
 * Provides comprehensive tool mocking capabilities:
 * - Tool registration with configurable responses
 * - Execution simulation with delay and error support
 * - Invocation capture for assertions
 * - Usage pattern verification
 */
export class MockToolRegistry {
  private tools: Map<string, MockToolDefinition> = new Map();
  private invocations: ToolInvocationRecord[] = [];
  private invocationCounts: Map<string, number> = new Map();

  /**
   * Register a mock tool with static response
   */
  registerTool(
    name: string,
    description: string,
    schema: z.ZodObject<Record<string, z.ZodTypeAny>>,
    config: MockToolConfig = {}
  ): MockToolDefinition {
    const definition: MockToolDefinition = {
      name,
      description,
      schema,
      config,
    };
    this.tools.set(name, definition);
    return definition;
  }

  /**
   * Register a tool with a sequence of responses
   */
  registerToolWithResponses(
    name: string,
    description: string,
    schema: z.ZodObject<Record<string, z.ZodTypeAny>>,
    responses: MockToolResult[]
  ): void {
    this.registerTool(name, description, schema, {
      responseSequence: responses,
    });
  }

  /**
   * Get a registered tool definition
   */
  getTool(name: string): MockToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool is registered
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Simulate tool execution
   */
  async simulateExecution(
    toolName: string,
    input: Record<string, unknown>
  ): Promise<MockToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' is not registered`);
    }

    const callId = uuidv4();
    const timestamp = new Date();
    const invocationCount = (this.invocationCounts.get(toolName) ?? 0) + 1;
    this.invocationCounts.set(toolName, invocationCount);

    const context: MockToolContext = {
      toolName,
      callId,
      invocationCount,
      timestamp,
    };

    // Check max invocations
    if (tool.config.maxInvocations && invocationCount > tool.config.maxInvocations) {
      throw new Error(`Tool '${toolName}' exceeded max invocations (${tool.config.maxInvocations})`);
    }

    // Check for scheduled errors
    const scheduledError = tool.config.errorOnCall?.find(e => e.callNumber === invocationCount);
    if (scheduledError) {
      const record: ToolInvocationRecord = {
        toolName,
        input,
        timestamp,
        callId,
        error: scheduledError.error,
      };
      this.invocations.push(record);
      throw scheduledError.error;
    }

    // Apply delay if configured
    if (tool.config.delay) {
      await new Promise(resolve => setTimeout(resolve, tool.config.delay));
    }

    let result: MockToolResult;
    const startTime = Date.now();

    try {
      if (tool.config.handler) {
        // Dynamic handler
        result = await tool.config.handler(input, context);
      } else if (tool.config.responseSequence) {
        // Cycle through response sequence
        const index = (invocationCount - 1) % tool.config.responseSequence.length;
        result = tool.config.responseSequence[index];
      } else if (tool.config.response) {
        // Static response
        result = tool.config.response;
      } else {
        // Default response
        result = {
          content: [{ type: 'text', text: `Mock result for ${toolName}` }],
          isError: false,
        };
      }

      const record: ToolInvocationRecord = {
        toolName,
        input,
        timestamp,
        callId,
        result,
        duration: Date.now() - startTime,
      };
      this.invocations.push(record);

      return result;
    } catch (error) {
      const record: ToolInvocationRecord = {
        toolName,
        input,
        timestamp,
        callId,
        error: error as Error,
        duration: Date.now() - startTime,
      };
      this.invocations.push(record);
      throw error;
    }
  }

  /**
   * Queue responses for a tool
   */
  queueResponses(toolName: string, responses: MockToolResult[]): void {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' is not registered`);
    }
    tool.config.responseSequence = responses;
  }

  // ========================================
  // Invocation Capture Methods
  // ========================================

  /**
   * Get all invocations, optionally filtered by tool name
   */
  getInvocations(toolName?: string): ToolInvocationRecord[] {
    if (toolName) {
      return this.invocations.filter(inv => inv.toolName === toolName);
    }
    return [...this.invocations];
  }

  /**
   * Get the last invocation for a tool
   */
  getLastInvocation(toolName: string): ToolInvocationRecord | undefined {
    const toolInvocations = this.getInvocations(toolName);
    return toolInvocations[toolInvocations.length - 1];
  }

  /**
   * Get invocation count for a tool
   */
  getInvocationCount(toolName: string): number {
    return this.invocationCounts.get(toolName) ?? 0;
  }

  /**
   * Clear all invocation records
   */
  clearInvocations(): void {
    this.invocations = [];
    this.invocationCounts.clear();
  }

  // ========================================
  // Usage Pattern Verification Methods
  // ========================================

  /**
   * Check if a tool was called at least once
   */
  wasToolCalled(toolName: string): boolean {
    return this.invocations.some(inv => inv.toolName === toolName);
  }

  /**
   * Check if a tool was called with specific input
   */
  wasCalledWith(
    toolName: string,
    expectedInput: Record<string, unknown> | ((input: Record<string, unknown>) => boolean)
  ): boolean {
    const toolInvocations = this.getInvocations(toolName);

    if (typeof expectedInput === 'function') {
      return toolInvocations.some(inv => expectedInput(inv.input));
    }

    return toolInvocations.some(inv =>
      JSON.stringify(inv.input) === JSON.stringify(expectedInput)
    );
  }

  /**
   * Verify a sequence of tool calls occurred in order
   */
  verifyCallSequence(expectedSequence: string[]): ToolCallVerificationResult {
    const actualSequence = this.invocations.map(inv => inv.toolName);
    const mismatches: ToolCallVerificationResult['mismatches'] = [];

    for (let i = 0; i < expectedSequence.length; i++) {
      if (actualSequence[i] !== expectedSequence[i]) {
        mismatches.push({
          index: i,
          expected: expectedSequence[i],
          actual: actualSequence[i],
        });
      }
    }

    return {
      passed: mismatches.length === 0 && actualSequence.length >= expectedSequence.length,
      expectedSequence,
      actualSequence,
      mismatches,
    };
  }

  /**
   * Assert tool call expectations (throws on failure)
   */
  expectToolCalls(expectations: ToolCallExpectation[]): void {
    for (const expectation of expectations) {
      const invocations = this.getInvocations(expectation.toolName);

      // Check invocation count
      if (expectation.times !== undefined) {
        const count = invocations.length;
        if (typeof expectation.times === 'number') {
          if (count !== expectation.times) {
            throw new Error(
              `Expected '${expectation.toolName}' to be called ${expectation.times} times, but was called ${count} times`
            );
          }
        } else {
          if (expectation.times.min !== undefined && count < expectation.times.min) {
            throw new Error(
              `Expected '${expectation.toolName}' to be called at least ${expectation.times.min} times, but was called ${count} times`
            );
          }
          if (expectation.times.max !== undefined && count > expectation.times.max) {
            throw new Error(
              `Expected '${expectation.toolName}' to be called at most ${expectation.times.max} times, but was called ${count} times`
            );
          }
        }
      }

      // Check input pattern
      if (expectation.input !== undefined) {
        const matched = this.wasCalledWith(expectation.toolName, expectation.input);
        if (!matched) {
          throw new Error(
            `Expected '${expectation.toolName}' to be called with matching input, but no invocation matched`
          );
        }
      }
    }
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.tools.clear();
    this.invocations = [];
    this.invocationCounts.clear();
  }
}
```

### 4. MockToolBuilder Fluent API

```typescript
// packages/orchestrator/src/__tests__/mocks/tool-mock-builder.ts

import { z } from 'zod';
import type {
  MockToolDefinition,
  MockToolConfig,
  MockToolResult,
  MockToolHandler,
} from './tool-mock.types';

/**
 * Fluent builder for creating mock tool definitions
 *
 * @example
 * ```typescript
 * const readTool = new MockToolBuilder('Read')
 *   .withDescription('Read file contents')
 *   .withSchema({ file_path: z.string() })
 *   .withResponse({
 *     content: [{ type: 'text', text: 'file content' }],
 *     isError: false,
 *   })
 *   .build();
 * ```
 */
export class MockToolBuilder {
  private name: string;
  private description: string = '';
  private schema: z.ZodObject<Record<string, z.ZodTypeAny>> = z.object({});
  private config: MockToolConfig = {};

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Set the tool description
   */
  withDescription(description: string): this {
    this.description = description;
    return this;
  }

  /**
   * Set the tool input schema
   */
  withSchema(shape: Record<string, z.ZodTypeAny>): this {
    this.schema = z.object(shape);
    return this;
  }

  /**
   * Set a static response
   */
  withResponse(response: MockToolResult): this {
    this.config.response = response;
    return this;
  }

  /**
   * Set a text response (convenience method)
   */
  withTextResponse(text: string, isError = false): this {
    this.config.response = {
      content: [{ type: 'text', text }],
      isError,
    };
    return this;
  }

  /**
   * Set a dynamic handler function
   */
  withDynamicHandler(handler: MockToolHandler): this {
    this.config.handler = handler;
    return this;
  }

  /**
   * Set a sequence of responses to cycle through
   */
  withSequence(responses: MockToolResult[]): this {
    this.config.responseSequence = responses;
    return this;
  }

  /**
   * Set response delay in milliseconds
   */
  withDelay(ms: number): this {
    this.config.delay = ms;
    return this;
  }

  /**
   * Schedule an error on a specific invocation number
   */
  withErrorOn(callNumber: number, error: Error): this {
    if (!this.config.errorOnCall) {
      this.config.errorOnCall = [];
    }
    this.config.errorOnCall.push({ callNumber, error });
    return this;
  }

  /**
   * Set maximum number of invocations allowed
   */
  withMaxInvocations(max: number): this {
    this.config.maxInvocations = max;
    return this;
  }

  /**
   * Build the tool definition
   */
  build(): MockToolDefinition {
    return {
      name: this.name,
      description: this.description,
      schema: this.schema,
      config: this.config,
    };
  }
}

/**
 * Convenience function to create a MockToolBuilder
 */
export function createMockTool(name: string): MockToolBuilder {
  return new MockToolBuilder(name);
}
```

### 5. Integration with MockClaudeAgentSDK

```typescript
// Extension to packages/orchestrator/src/__tests__/mocks/claude-agent-sdk.ts

import { MockToolRegistry, MockToolBuilder } from './tool-mock-registry';
import type { MockToolDefinition } from './tool-mock.types';

// Add to MockClaudeAgentSDK class:

export class MockClaudeAgentSDK {
  // ... existing implementation ...

  private toolRegistry: MockToolRegistry = new MockToolRegistry();
  private toolMock = vi.fn();

  /**
   * Get the tool registry for registering and managing mock tools
   */
  getToolRegistry(): MockToolRegistry {
    return this.toolRegistry;
  }

  /**
   * Get the mock tool() function for vi.mock()
   */
  getToolMock(): typeof tool {
    return this.toolMock as typeof tool;
  }

  /**
   * Register a mock tool (convenience method)
   */
  registerTool(definition: MockToolDefinition): this {
    this.toolRegistry.registerTool(
      definition.name,
      definition.description,
      definition.schema,
      definition.config
    );

    // Configure the tool mock to handle this tool
    this.setupToolMock();

    return this;
  }

  /**
   * Setup tool mock to return registered tools
   */
  private setupToolMock(): void {
    this.toolMock.mockImplementation(
      (name: string, description: string, schema: Record<string, z.ZodTypeAny>, handler: Function) => {
        // If tool is registered, wrap handler with our mock
        if (this.toolRegistry.hasTool(name)) {
          return {
            name,
            description,
            inputSchema: schema,
            handler: async (args: Record<string, unknown>) => {
              return this.toolRegistry.simulateExecution(name, args);
            },
          };
        }

        // Otherwise, use original handler
        return { name, description, inputSchema: schema, handler };
      }
    );
  }
}

// Update createMockModule to include tool mock:

export function createMockModule(mockSDK: MockClaudeAgentSDK) {
  return {
    query: mockSDK.getQueryMock(),
    createSdkMcpServer: vi.fn(),
    tool: mockSDK.getToolMock(),
  };
}
```

### 6. File Structure

```
packages/orchestrator/src/__tests__/mocks/
├── index.ts                      # Re-exports all mocks (update)
├── claude-agent-sdk.ts           # MockClaudeAgentSDK (extend)
├── claude-agent-sdk.types.ts     # SDK mock types (existing)
├── tool-mock.types.ts            # Tool mock type definitions (NEW)
├── tool-mock-registry.ts         # MockToolRegistry class (NEW)
├── tool-mock-builder.ts          # MockToolBuilder fluent API (NEW)
├── tool-mock.test.ts             # Tests for tool mocking utilities (NEW)
└── permission-revocation.ts      # Permission revocation utilities (existing)
```

### 7. Usage Examples

#### 7.1 Basic Tool Mocking

```typescript
import { MockClaudeAgentSDK, createMockTool } from '../mocks';

describe('Tool Mocking', () => {
  let mockSDK: MockClaudeAgentSDK;

  beforeEach(() => {
    mockSDK = new MockClaudeAgentSDK();
    vi.mock('@anthropic-ai/claude-agent-sdk', () => createMockModule(mockSDK));

    // Register mock tools
    mockSDK.registerTool(
      createMockTool('Read')
        .withDescription('Read file contents')
        .withSchema({ file_path: z.string() })
        .withTextResponse('file content here')
        .build()
    );
  });

  it('should capture tool invocations', async () => {
    const registry = mockSDK.getToolRegistry();

    await registry.simulateExecution('Read', { file_path: '/src/index.ts' });

    expect(registry.wasToolCalled('Read')).toBe(true);
    expect(registry.getInvocationCount('Read')).toBe(1);

    const invocation = registry.getLastInvocation('Read');
    expect(invocation?.input).toEqual({ file_path: '/src/index.ts' });
  });
});
```

#### 7.2 Response Sequences

```typescript
it('should cycle through response sequence', async () => {
  const registry = mockSDK.getToolRegistry();

  registry.registerToolWithResponses('GetStatus', 'Get status', z.object({}), [
    { content: [{ type: 'text', text: 'initializing' }] },
    { content: [{ type: 'text', text: 'ready' }] },
    { content: [{ type: 'text', text: 'complete' }] },
  ]);

  const result1 = await registry.simulateExecution('GetStatus', {});
  const result2 = await registry.simulateExecution('GetStatus', {});
  const result3 = await registry.simulateExecution('GetStatus', {});

  expect(result1.content[0]).toEqual({ type: 'text', text: 'initializing' });
  expect(result2.content[0]).toEqual({ type: 'text', text: 'ready' });
  expect(result3.content[0]).toEqual({ type: 'text', text: 'complete' });
});
```

#### 7.3 Dynamic Handlers

```typescript
it('should use dynamic handlers', async () => {
  mockSDK.registerTool(
    createMockTool('Write')
      .withSchema({ file_path: z.string(), content: z.string() })
      .withDynamicHandler((args, context) => ({
        content: [{ type: 'text', text: `Wrote ${args.content.length} chars to ${args.file_path}` }],
        structuredContent: { bytesWritten: args.content.length },
      }))
      .build()
  );

  const registry = mockSDK.getToolRegistry();
  const result = await registry.simulateExecution('Write', {
    file_path: '/test.txt',
    content: 'Hello, World!',
  });

  expect(result.content[0]).toEqual({ type: 'text', text: 'Wrote 13 chars to /test.txt' });
  expect(result.structuredContent).toEqual({ bytesWritten: 13 });
});
```

#### 7.4 Error Simulation

```typescript
it('should simulate errors on specific calls', async () => {
  mockSDK.registerTool(
    createMockTool('API')
      .withTextResponse('success')
      .withErrorOn(2, new Error('Rate limit exceeded'))
      .build()
  );

  const registry = mockSDK.getToolRegistry();

  await registry.simulateExecution('API', {}); // Call 1: success
  await expect(registry.simulateExecution('API', {})).rejects.toThrow('Rate limit exceeded'); // Call 2: error
  await registry.simulateExecution('API', {}); // Call 3: success
});
```

#### 7.5 Verifying Tool Call Sequences

```typescript
it('should verify call sequence', async () => {
  const registry = mockSDK.getToolRegistry();

  await registry.simulateExecution('Read', { file_path: '/a.ts' });
  await registry.simulateExecution('Edit', { file_path: '/a.ts', content: 'new' });
  await registry.simulateExecution('Write', { file_path: '/b.ts', content: '...' });

  const result = registry.verifyCallSequence(['Read', 'Edit', 'Write']);

  expect(result.passed).toBe(true);
  expect(result.actualSequence).toEqual(['Read', 'Edit', 'Write']);
});
```

#### 7.6 Asserting Tool Call Expectations

```typescript
it('should assert tool call expectations', async () => {
  const registry = mockSDK.getToolRegistry();

  await registry.simulateExecution('Read', { file_path: '/src/index.ts' });
  await registry.simulateExecution('Read', { file_path: '/src/utils.ts' });
  await registry.simulateExecution('Write', { file_path: '/dist/index.js', content: '...' });

  // This will throw if expectations are not met
  registry.expectToolCalls([
    { toolName: 'Read', times: 2 },
    { toolName: 'Write', times: 1 },
    {
      toolName: 'Read',
      input: (input) => input.file_path.includes('index')
    },
  ]);
});
```

### 8. Integration with Existing Infrastructure

#### 8.1 Integration with Tool Execution Hooks

The tool registry can emit events compatible with the existing hook system:

```typescript
// In MockToolRegistry.simulateExecution():

// Emit tool:start event
this.emit('tool:start', {
  taskId: 'mock-task',
  toolName,
  input,
  callId,
  timestamp,
});

// After execution, emit tool:complete
this.emit('tool:complete', {
  taskId: 'mock-task',
  toolName,
  callId,
  result: { success: !result.isError, output: result.content },
  timing: { startTime: timestamp, endTime: new Date(), duration },
  timestamp: new Date(),
});
```

#### 8.2 Integration with Permission System

```typescript
// Tool registry can check permissions before execution
async simulateExecution(
  toolName: string,
  input: Record<string, unknown>,
  options?: { checkPermissions?: boolean }
): Promise<MockToolResult> {
  if (options?.checkPermissions) {
    const permission = await this.permissionChecker?.check(toolName, input);
    if (permission === 'deny') {
      throw new Error(`Permission denied for tool: ${toolName}`);
    }
  }
  // ... rest of execution
}
```

## Acceptance Criteria Mapping

| Acceptance Criteria | Implementation |
|---------------------|----------------|
| Test utilities exist to mock Claude Agent SDK tool calls | `MockToolRegistry`, `MockToolBuilder`, extended `MockClaudeAgentSDK` |
| Helpers can simulate tool execution | `MockToolRegistry.simulateExecution()` with response sequences, delays, errors |
| Capture tool invocations | `ToolInvocationRecord[]`, `getInvocations()`, `getLastInvocation()` |
| Verify tool usage patterns | `wasToolCalled()`, `wasCalledWith()`, `verifyCallSequence()`, `expectToolCalls()` |

## Consequences

### Positive

- **Comprehensive Coverage**: Addresses all aspects of tool mocking
- **Fluent API**: Intuitive builder pattern for tool configuration
- **Integration**: Extends existing `MockClaudeAgentSDK` infrastructure
- **Type Safety**: Full TypeScript support throughout
- **Flexibility**: Supports static responses, sequences, and dynamic handlers
- **Testability**: Rich verification API for asserting tool behavior

### Negative

- **Additional Complexity**: New classes and types to learn
- **Memory Overhead**: Invocation tracking consumes memory for large test suites
- **Maintenance**: Must be kept in sync with SDK tool interface changes

### Neutral

- **Gradual Adoption**: Can be adopted incrementally alongside existing patterns
- **Compatibility**: Works with existing mock infrastructure

## Implementation Plan

| Step | Description | Files |
|------|-------------|-------|
| 1 | Create type definitions | `tool-mock.types.ts` |
| 2 | Implement MockToolRegistry | `tool-mock-registry.ts` |
| 3 | Implement MockToolBuilder | `tool-mock-builder.ts` |
| 4 | Extend MockClaudeAgentSDK | `claude-agent-sdk.ts` |
| 5 | Update module exports | `index.ts` |
| 6 | Write comprehensive tests | `tool-mock.test.ts` |
| 7 | Add integration tests | `tool-mock.integration.test.ts` |
| 8 | Update documentation | `docs/mock-helpers-api.md` |

## References

- ADR-035: Claude Agent SDK Mock Utilities
- ADR-038: Tool Execution Hooks
- Existing `MockClaudeAgentSDK` implementation
- Claude Agent SDK `tool()` function documentation
- MCP Mock Server Builder patterns
