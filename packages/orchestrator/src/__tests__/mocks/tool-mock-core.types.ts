/**
 * Core Tool Mock Types for Claude Agent SDK
 *
 * This module provides the foundational types for mocking Claude Agent SDK tools
 * in tests. These types align with SDK tool structures and provide clean interfaces
 * for test utilities.
 *
 * @module tool-mock-core.types
 * @see ADR-095: Core Tool Mock Types and Interfaces for Claude Agent SDK
 */

import type { z } from 'zod';

// Re-export existing types for compatibility
export type {
  MockToolResult,
  MockToolContent,
  ToolInvocationRecord,
  MockToolDefinition,
  MockToolConfig,
  MockToolHandler,
  MockToolContext,
} from './tool-mock.types';

/**
 * Content types that can be returned from tool execution.
 * Aligns with Claude Agent SDK ToolResult content types.
 *
 * @example
 * ```typescript
 * const textContent: ToolContentBlock = { type: 'text', text: 'File contents here' };
 * const imageContent: ToolContentBlock = {
 *   type: 'image',
 *   source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo...' }
 * };
 * ```
 */
export type ToolContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'resource'; resource: { uri: string; mimeType?: string; text?: string } };

/**
 * Response from a mock tool execution.
 * Aligns with Claude Agent SDK ToolResult structure.
 *
 * @example
 * ```typescript
 * const response: MockToolResponse = {
 *   content: [{ type: 'text', text: 'Operation completed successfully' }],
 *   structuredContent: { success: true, itemsProcessed: 5 },
 *   isError: false
 * };
 * ```
 */
export interface MockToolResponse {
  /** Content blocks returned by the tool */
  content: ToolContentBlock[];
  /** Optional structured data for programmatic access */
  structuredContent?: Record<string, unknown>;
  /** Whether this response represents an error condition */
  isError?: boolean;
}

/**
 * Record of a single tool invocation for tracking and verification.
 * Captures all data needed to verify tool usage patterns in tests.
 *
 * @example
 * ```typescript
 * const invocation: ToolInvocation = {
 *   toolName: 'Read',
 *   input: { file_path: '/src/index.ts' },
 *   callId: 'call-123',
 *   timestamp: new Date(),
 *   duration: 15,
 *   response: { content: [{ type: 'text', text: 'export const x = 1;' }] }
 * };
 * ```
 */
export interface ToolInvocation {
  /** Name of the tool that was invoked */
  toolName: string;
  /** Input parameters passed to the tool */
  input: Record<string, unknown>;
  /** Unique identifier for this invocation */
  callId: string;
  /** When the tool was invoked */
  timestamp: Date;
  /** Duration of execution in milliseconds */
  duration?: number;
  /** Response from the tool (if successful) */
  response?: MockToolResponse;
  /** Error that occurred (if failed) */
  error?: Error;
}

/**
 * Context provided to tool handlers during execution.
 * Contains metadata about the current execution for use in dynamic handlers.
 *
 * @example
 * ```typescript
 * const handler = (input: Input, context: ToolExecutionContext) => {
 *   console.log(`Executing ${context.toolName} (call #${context.invocationCount})`);
 *   return { content: [{ type: 'text', text: 'done' }] };
 * };
 * ```
 */
export interface ToolExecutionContext {
  /** Unique identifier for this execution */
  callId: string;
  /** Name of the tool being executed */
  toolName: string;
  /** How many times this tool has been invoked (1-based) */
  invocationCount: number;
  /** Timestamp when execution started */
  timestamp: Date;
}

/**
 * Definition of a mock tool for testing.
 * Provides all configuration needed to simulate tool behavior.
 *
 * @typeParam TInput - Type of the tool's input parameters
 *
 * @example
 * ```typescript
 * const readTool: MockTool<{ file_path: string }> = {
 *   name: 'Read',
 *   description: 'Read file contents',
 *   inputSchema: z.object({ file_path: z.string() }),
 *   handler: async (input) => ({
 *     content: [{ type: 'text', text: `Contents of ${input.file_path}` }]
 *   })
 * };
 * ```
 */
export interface MockTool<TInput extends Record<string, unknown> = Record<string, unknown>> {
  /** Unique name identifying this tool */
  name: string;
  /** Human-readable description of what the tool does */
  description: string;
  /** Zod schema for validating tool input */
  inputSchema: z.ZodType<TInput>;
  /**
   * Handler function that processes input and returns a response.
   * Can be synchronous or asynchronous.
   */
  handler: (input: TInput, context: ToolExecutionContext) => MockToolResponse | Promise<MockToolResponse>;
}

/**
 * Contract for components that can execute mock tools.
 * Enables dependency injection and testing of tool execution flows.
 *
 * @example
 * ```typescript
 * class TestToolExecutor implements MockToolExecutor {
 *   private tools = new Map<string, MockTool>();
 *   private invocations: ToolInvocation[] = [];
 *
 *   async execute(toolName: string, input: Record<string, unknown>) {
 *     const tool = this.tools.get(toolName);
 *     if (!tool) throw new Error(`Tool not found: ${toolName}`);
 *     // ... execute and track
 *   }
 *
 *   // ... other methods
 * }
 * ```
 */
export interface MockToolExecutor {
  /**
   * Execute a tool with the given input.
   * @param toolName - Name of the tool to execute
   * @param input - Input parameters for the tool
   * @returns The tool's response
   * @throws Error if tool not found or execution fails
   */
  execute(toolName: string, input: Record<string, unknown>): Promise<MockToolResponse>;

  /**
   * Check if a tool is registered and available for execution.
   * @param toolName - Name of the tool to check
   */
  hasToolAvailable(toolName: string): boolean;

  /**
   * Get all tool invocations, optionally filtered by tool name.
   * @param toolName - Optional tool name to filter by
   */
  getInvocations(toolName?: string): ToolInvocation[];

  /**
   * Get the most recent invocation for a tool.
   * @param toolName - Name of the tool
   */
  getLastInvocation(toolName: string): ToolInvocation | undefined;

  /**
   * Clear all recorded invocations.
   */
  clearInvocations(): void;
}

/**
 * Options for configuring mock tool behavior.
 * Used with MockToolBuilder to customize tool responses.
 *
 * @example
 * ```typescript
 * const options: MockToolOptions = {
 *   responseSequence: [
 *     { content: [{ type: 'text', text: 'first call' }] },
 *     { content: [{ type: 'text', text: 'second call' }] },
 *   ],
 *   delay: 100,
 *   errorOnCall: [{ callNumber: 3, error: new Error('Rate limited') }]
 * };
 * ```
 */
export interface MockToolOptions {
  /** Fixed response to return for all invocations */
  response?: MockToolResponse;
  /** Sequence of responses to cycle through */
  responseSequence?: MockToolResponse[];
  /** Delay in milliseconds before returning */
  delay?: number;
  /** Schedule errors on specific invocation numbers */
  errorOnCall?: Array<{ callNumber: number; error: Error }>;
  /** Maximum number of invocations allowed before throwing */
  maxInvocations?: number;
}

/**
 * Result of verifying a sequence of tool calls.
 * Returned by verification methods to indicate whether assertions passed.
 *
 * @example
 * ```typescript
 * const result: ToolSequenceVerificationResult = {
 *   passed: false,
 *   expected: ['Read', 'Edit', 'Write'],
 *   actual: ['Read', 'Write'],
 *   mismatches: [{ index: 1, expected: 'Edit', actual: 'Write' }]
 * };
 * ```
 */
export interface ToolSequenceVerificationResult {
  /** Whether the verification passed */
  passed: boolean;
  /** Expected sequence of tool names */
  expected: string[];
  /** Actual sequence of tool names */
  actual: string[];
  /** Details of any mismatches found */
  mismatches: Array<{
    index: number;
    expected: string;
    actual: string | undefined;
  }>;
}

/**
 * Factory function type for creating mock tools with fluent API.
 *
 * @typeParam TInput - Type of the tool's input parameters
 *
 * @example
 * ```typescript
 * const createTool: MockToolFactory = (name) => new MockToolBuilder(name);
 * const readTool = createTool<{ file_path: string }>('Read')
 *   .withDescription('Read file contents')
 *   .build();
 * ```
 */
export type MockToolFactory = <TInput extends Record<string, unknown>>(
  name: string
) => MockToolBuilder<TInput>;

/**
 * Builder interface for fluent mock tool construction.
 * Enables chainable configuration of mock tools.
 *
 * @typeParam TInput - Type of the tool's input parameters
 *
 * @example
 * ```typescript
 * const tool = builder
 *   .withDescription('Write file contents')
 *   .withSchema(z.object({ file_path: z.string(), content: z.string() }))
 *   .withResponse({ content: [{ type: 'text', text: 'Written' }] })
 *   .build();
 * ```
 */
export interface MockToolBuilder<TInput extends Record<string, unknown>> {
  /** Set the tool description */
  withDescription(description: string): MockToolBuilder<TInput>;
  /** Set the input validation schema */
  withSchema(schema: z.ZodType<TInput>): MockToolBuilder<TInput>;
  /** Set a static response */
  withResponse(response: MockToolResponse): MockToolBuilder<TInput>;
  /** Set a dynamic handler function */
  withHandler(
    handler: (input: TInput, context: ToolExecutionContext) => MockToolResponse | Promise<MockToolResponse>
  ): MockToolBuilder<TInput>;
  /** Set additional options */
  withOptions(options: MockToolOptions): MockToolBuilder<TInput>;
  /** Build the final MockTool */
  build(): MockTool<TInput>;
}

// ============================================================================
// Type Guards and Converters
// ============================================================================

/**
 * Type guard to check if a value is a MockToolResponse.
 *
 * @param value - Value to check
 * @returns True if value is a valid MockToolResponse
 *
 * @example
 * ```typescript
 * if (isMockToolResponse(result)) {
 *   console.log('Got response:', result.content);
 * }
 * ```
 */
export function isMockToolResponse(value: unknown): value is MockToolResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'content' in value &&
    Array.isArray((value as MockToolResponse).content)
  );
}

/**
 * Type guard to check if a value is a ToolInvocation.
 *
 * @param value - Value to check
 * @returns True if value is a valid ToolInvocation
 */
export function isToolInvocation(value: unknown): value is ToolInvocation {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toolName' in value &&
    typeof (value as ToolInvocation).toolName === 'string' &&
    'input' in value &&
    'callId' in value &&
    'timestamp' in value
  );
}

/**
 * Type guard to check if a value is a ToolContentBlock.
 *
 * @param value - Value to check
 * @returns True if value is a valid ToolContentBlock
 */
export function isToolContentBlock(value: unknown): value is ToolContentBlock {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return false;
  }

  const block = value as { type: string };

  switch (block.type) {
    case 'text':
      return 'text' in block && typeof (block as { text: unknown }).text === 'string';
    case 'image':
      return 'source' in block;
    case 'resource':
      return 'resource' in block;
    default:
      return false;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a text-only MockToolResponse.
 *
 * @param text - Text content to return
 * @param isError - Whether this represents an error
 * @returns A MockToolResponse with text content
 *
 * @example
 * ```typescript
 * const response = createTextResponse('File contents here');
 * const errorResponse = createTextResponse('File not found', true);
 * ```
 */
export function createTextResponse(text: string, isError = false): MockToolResponse {
  return {
    content: [{ type: 'text', text }],
    isError,
  };
}

/**
 * Create an error MockToolResponse.
 *
 * @param errorMessage - Error message to return
 * @returns A MockToolResponse marked as an error
 *
 * @example
 * ```typescript
 * const errorResponse = createErrorResponse('Permission denied');
 * ```
 */
export function createErrorResponse(errorMessage: string): MockToolResponse {
  return createTextResponse(errorMessage, true);
}

/**
 * Create a MockToolResponse with structured content.
 *
 * @param structured - Structured data to include
 * @param textSummary - Optional text summary of the result
 * @returns A MockToolResponse with structured content
 *
 * @example
 * ```typescript
 * const response = createStructuredResponse(
 *   { files: ['a.ts', 'b.ts'], count: 2 },
 *   'Found 2 files'
 * );
 * ```
 */
export function createStructuredResponse(
  structured: Record<string, unknown>,
  textSummary?: string
): MockToolResponse {
  return {
    content: textSummary ? [{ type: 'text', text: textSummary }] : [],
    structuredContent: structured,
  };
}
