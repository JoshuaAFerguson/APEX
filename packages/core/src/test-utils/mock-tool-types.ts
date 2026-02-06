/**
 * @fileoverview Mock Tool Types for Claude Agent SDK Testing
 *
 * This module provides TypeScript interfaces and types for creating mock tools
 * that align with Claude Agent SDK tool structures. These types enable testing
 * of tool execution, validation, and response handling without requiring actual
 * Claude Agent SDK integration.
 *
 * ## Architecture Decision Record (ADR-075)
 *
 * ### Context
 * APEX needs to test Claude Agent SDK tool integrations without making real API calls.
 * This requires mock types that:
 * 1. Mirror the structure of actual Claude Agent SDK tools
 * 2. Support configurable tool execution behavior for testing various scenarios
 * 3. Enable tracking of tool invocations for verification
 * 4. Allow simulation of success, failure, and error conditions
 *
 * ### Decision
 * Create a dedicated mock-tool-types module in `@apex/core/test-utils` that provides:
 * - **MockTool**: Complete tool definition with execution behavior
 * - **MockToolResponse**: Structured response from mock tool execution
 * - **ToolInvocation**: Record of a tool being invoked with parameters
 * - **MockToolExecutor**: Interface for custom tool execution logic
 *
 * These types are designed to:
 * - Be compatible with Claude Agent SDK's tool structures
 * - Support both simple static responses and complex dynamic behaviors
 * - Enable comprehensive testing of tool execution flows
 * - Provide type safety for test implementations
 *
 * ### Consequences
 * - Test code can create type-safe mock tools without SDK dependencies
 * - Consistent mock tool interface across all APEX test suites
 * - Easy simulation of various tool execution scenarios
 * - Clear separation between production and test tool types
 *
 * @module @apex/core/test-utils/mock-tool-types
 */

import { z } from 'zod';

// ============================================================================
// Tool Parameter Types (aligned with Claude Agent SDK)
// ============================================================================

/**
 * JSON Schema type values supported by tool parameters
 */
export type MockToolParameterType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'array'
  | 'object'
  | 'null';

/**
 * JSON Schema parameter definition for mock tools.
 * Mirrors the structure used in Claude Agent SDK tool definitions.
 */
export interface MockToolParameter {
  /** JSON Schema type of the parameter */
  type: MockToolParameterType | MockToolParameterType[];
  /** Human-readable description of the parameter */
  description?: string;
  /** Default value if not provided */
  default?: unknown;
  /** Enumerated allowed values */
  enum?: unknown[];
  /** For arrays: schema of array items */
  items?: MockToolParameter;
  /** For objects: property definitions */
  properties?: Record<string, MockToolParameter>;
  /** For objects: required property names */
  required?: string[];
  /** String minimum length */
  minLength?: number;
  /** String maximum length */
  maxLength?: number;
  /** String pattern (regex) */
  pattern?: string;
  /** Number minimum value */
  minimum?: number;
  /** Number maximum value */
  maximum?: number;
  /** Number exclusive minimum */
  exclusiveMinimum?: number;
  /** Number exclusive maximum */
  exclusiveMaximum?: number;
  /** Array minimum items */
  minItems?: number;
  /** Array maximum items */
  maxItems?: number;
  /** Array unique items constraint */
  uniqueItems?: boolean;
  /** Whether additional properties are allowed (objects) */
  additionalProperties?: boolean | MockToolParameter;
}

/**
 * Parameters schema for mock tools (JSON Schema format)
 */
export interface MockToolParametersSchema {
  /** Schema type - always 'object' for tool parameters */
  type: 'object';
  /** Property definitions */
  properties: Record<string, MockToolParameter>;
  /** Required property names */
  required?: string[];
  /** Whether additional properties are allowed */
  additionalProperties?: boolean;
}

// ============================================================================
// Mock Tool Response Types
// ============================================================================

/**
 * Content types that can be returned in a mock tool response.
 * Aligns with Claude Agent SDK's content block types.
 */
export type MockToolResponseContentType = 'text' | 'image' | 'resource' | 'error';

/**
 * Text content in a tool response
 */
export interface MockToolTextContent {
  type: 'text';
  /** Text content to return */
  text: string;
}

/**
 * Image content in a tool response
 */
export interface MockToolImageContent {
  type: 'image';
  /** Base64-encoded image data */
  data: string;
  /** MIME type of the image */
  mimeType: string;
}

/**
 * Resource reference in a tool response
 */
export interface MockToolResourceContent {
  type: 'resource';
  /** Resource URI */
  uri: string;
  /** Resource MIME type */
  mimeType?: string;
  /** Text content if available */
  text?: string;
  /** Binary content (base64) if available */
  blob?: string;
}

/**
 * Error content in a tool response
 */
export interface MockToolErrorContent {
  type: 'error';
  /** Error message */
  message: string;
  /** Error code if applicable */
  code?: string | number;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Union type for all content types in tool responses
 */
export type MockToolContentBlock =
  | MockToolTextContent
  | MockToolImageContent
  | MockToolResourceContent
  | MockToolErrorContent;

/**
 * Response from a mock tool execution.
 * Represents the result of invoking a tool with specific parameters.
 *
 * @example
 * ```typescript
 * const successResponse: MockToolResponse = {
 *   success: true,
 *   content: [{ type: 'text', text: 'File created successfully' }],
 *   duration: 150,
 *   metadata: { bytesWritten: 1024 }
 * };
 *
 * const errorResponse: MockToolResponse = {
 *   success: false,
 *   isError: true,
 *   content: [{ type: 'error', message: 'File not found', code: 'ENOENT' }],
 *   duration: 5
 * };
 * ```
 */
export interface MockToolResponse {
  /** Whether the tool execution succeeded */
  success: boolean;
  /** Whether this response represents an error (for SDK compatibility) */
  isError?: boolean;
  /** Content blocks returned by the tool */
  content: MockToolContentBlock[];
  /** Execution duration in milliseconds */
  duration?: number;
  /** Additional metadata about the execution */
  metadata?: Record<string, unknown>;
  /** Timestamp when the tool was invoked */
  invokedAt?: Date;
  /** Timestamp when execution completed */
  completedAt?: Date;
}

// ============================================================================
// Tool Invocation Tracking
// ============================================================================

/**
 * Record of a tool invocation.
 * Captures all information about a single tool call for verification and debugging.
 *
 * @example
 * ```typescript
 * const invocation: ToolInvocation = {
 *   id: 'call_abc123',
 *   toolName: 'Read',
 *   parameters: { file_path: '/src/index.ts' },
 *   invokedAt: new Date(),
 *   context: {
 *     taskId: 'task_xyz789',
 *     agentName: 'developer',
 *     stageName: 'coding'
 *   }
 * };
 * ```
 */
export interface ToolInvocation {
  /** Unique identifier for this invocation */
  id: string;
  /** Name of the tool being invoked */
  toolName: string;
  /** Parameters passed to the tool */
  parameters: Record<string, unknown>;
  /** Timestamp when the tool was invoked */
  invokedAt: Date;
  /** Response from the tool execution (set after completion) */
  response?: MockToolResponse;
  /** Timestamp when execution completed */
  completedAt?: Date;
  /** Execution duration in milliseconds */
  duration?: number;
  /** Execution context */
  context?: ToolInvocationContext;
  /** Error that occurred during execution (if any) */
  error?: Error;
}

/**
 * Context information for a tool invocation
 */
export interface ToolInvocationContext {
  /** ID of the task invoking the tool */
  taskId?: string;
  /** Name of the agent invoking the tool */
  agentName?: string;
  /** Current workflow stage */
  stageName?: string;
  /** Working directory for file operations */
  workingDirectory?: string;
  /** Request ID for tracking */
  requestId?: string;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

// ============================================================================
// Mock Tool Executor Interface
// ============================================================================

/**
 * Function signature for custom tool execution logic.
 * Allows tests to define dynamic behavior based on invocation parameters.
 *
 * @example
 * ```typescript
 * const readFileExecutor: MockToolExecutorFn = async (params, context) => {
 *   const path = params.file_path as string;
 *   if (path.includes('nonexistent')) {
 *     return {
 *       success: false,
 *       isError: true,
 *       content: [{ type: 'error', message: 'File not found', code: 'ENOENT' }]
 *     };
 *   }
 *   return {
 *     success: true,
 *     content: [{ type: 'text', text: 'mock file content' }]
 *   };
 * };
 * ```
 */
export type MockToolExecutorFn = (
  parameters: Record<string, unknown>,
  context?: ToolInvocationContext
) => MockToolResponse | Promise<MockToolResponse>;

/**
 * Interface for mock tool executors.
 * Provides a structured way to define tool execution behavior for testing.
 *
 * @example
 * ```typescript
 * class FileReadExecutor implements MockToolExecutor {
 *   private fileContents = new Map<string, string>();
 *
 *   setFileContent(path: string, content: string) {
 *     this.fileContents.set(path, content);
 *   }
 *
 *   async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
 *     const path = params.file_path as string;
 *     const content = this.fileContents.get(path);
 *     if (!content) {
 *       return {
 *         success: false,
 *         isError: true,
 *         content: [{ type: 'error', message: `File not found: ${path}` }]
 *       };
 *     }
 *     return {
 *       success: true,
 *       content: [{ type: 'text', text: content }]
 *     };
 *   }
 *
 *   reset() {
 *     this.fileContents.clear();
 *   }
 * }
 * ```
 */
export interface MockToolExecutor {
  /**
   * Execute the tool with given parameters
   *
   * @param parameters - Tool input parameters
   * @param context - Execution context
   * @returns Tool response (can be sync or async)
   */
  execute(
    parameters: Record<string, unknown>,
    context?: ToolInvocationContext
  ): MockToolResponse | Promise<MockToolResponse>;

  /**
   * Reset executor state (for use between tests)
   */
  reset?(): void;

  /**
   * Validate parameters before execution
   *
   * @param parameters - Parameters to validate
   * @returns Validation result
   */
  validate?(parameters: Record<string, unknown>): MockToolValidationResult;
}

/**
 * Result of mock tool parameter validation
 */
export interface MockToolValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Error messages if validation failed */
  errors?: string[];
  /** Warning messages (validation passed but with concerns) */
  warnings?: string[];
}

// ============================================================================
// Mock Tool Definition
// ============================================================================

/**
 * Tool category types for organization
 */
export type MockToolCategory =
  | 'filesystem'
  | 'shell'
  | 'web'
  | 'browser'
  | 'search'
  | 'system'
  | 'custom'
  | 'mcp';

/**
 * Complete mock tool definition.
 * Combines tool metadata with execution behavior for comprehensive testing.
 *
 * @example
 * ```typescript
 * const mockReadTool: MockTool = {
 *   name: 'Read',
 *   description: 'Read file contents',
 *   category: 'filesystem',
 *   parameters: {
 *     type: 'object',
 *     properties: {
 *       file_path: {
 *         type: 'string',
 *         description: 'Path to the file to read'
 *       },
 *       encoding: {
 *         type: 'string',
 *         default: 'utf-8'
 *       }
 *     },
 *     required: ['file_path']
 *   },
 *   execute: async (params) => ({
 *     success: true,
 *     content: [{ type: 'text', text: 'file contents' }]
 *   })
 * };
 * ```
 */
export interface MockTool {
  /** Unique tool name */
  name: string;
  /** Human-readable description */
  description: string;
  /** Tool category for organization */
  category?: MockToolCategory;
  /** Parameter schema (JSON Schema format) */
  parameters: MockToolParametersSchema;
  /** Whether this tool is potentially dangerous */
  dangerous?: boolean;
  /** Whether the tool is enabled */
  enabled?: boolean;
  /** Tool version */
  version?: string;
  /** Execution function or executor instance */
  execute: MockToolExecutorFn | MockToolExecutor;
  /** Static response to return (alternative to execute function) */
  staticResponse?: MockToolResponse;
  /** Response sequence for successive calls */
  responseSequence?: MockToolResponse[];
  /** Delay before returning response (ms) */
  responseDelay?: number;
  /** Whether to record invocations */
  recordInvocations?: boolean;
  /** Maximum invocations allowed (0 = unlimited) */
  maxInvocations?: number;
  /** Custom validation function */
  validate?: (params: Record<string, unknown>) => MockToolValidationResult;
  /** Tags for filtering and organization */
  tags?: string[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Mock Tool Registry Types
// ============================================================================

/**
 * Configuration for mock tool behavior
 */
export interface MockToolBehaviorConfig {
  /** Response delay in milliseconds */
  delay?: number;
  /** Error probability (0.0 to 1.0) */
  errorProbability?: number;
  /** Error to throw when errorProbability triggers */
  errorToThrow?: Error | string;
  /** Whether to track invocations */
  trackInvocations?: boolean;
  /** Maximum number of concurrent executions */
  maxConcurrent?: number;
  /** Timeout for execution in milliseconds */
  timeout?: number;
}

/**
 * Mock tool registry entry combining tool definition with runtime state
 */
export interface MockToolRegistryEntry {
  /** The mock tool definition */
  tool: MockTool;
  /** Behavior configuration */
  behavior?: MockToolBehaviorConfig;
  /** Recorded invocations */
  invocations: ToolInvocation[];
  /** Current response sequence index */
  sequenceIndex: number;
  /** Total invocation count */
  invocationCount: number;
  /** Whether the tool is currently enabled */
  enabled: boolean;
  /** Timestamp when tool was registered */
  registeredAt: Date;
  /** Last invocation timestamp */
  lastInvokedAt?: Date;
}

/**
 * Event emitted when a mock tool is invoked
 */
export interface MockToolInvocationEvent {
  /** Event type */
  type: 'tool:invoked' | 'tool:completed' | 'tool:error';
  /** Tool name */
  toolName: string;
  /** Invocation record */
  invocation: ToolInvocation;
  /** Response (for completed events) */
  response?: MockToolResponse;
  /** Error (for error events) */
  error?: Error;
  /** Timestamp */
  timestamp: Date;
}

// ============================================================================
// Zod Schemas for Runtime Validation
// ============================================================================

/**
 * Zod schema for MockToolResponse validation
 */
export const MockToolResponseSchema = z.object({
  success: z.boolean(),
  isError: z.boolean().optional(),
  content: z.array(
    z.discriminatedUnion('type', [
      z.object({
        type: z.literal('text'),
        text: z.string(),
      }),
      z.object({
        type: z.literal('image'),
        data: z.string(),
        mimeType: z.string(),
      }),
      z.object({
        type: z.literal('resource'),
        uri: z.string(),
        mimeType: z.string().optional(),
        text: z.string().optional(),
        blob: z.string().optional(),
      }),
      z.object({
        type: z.literal('error'),
        message: z.string(),
        code: z.union([z.string(), z.number()]).optional(),
        details: z.record(z.string(), z.unknown()).optional(),
      }),
    ])
  ),
  duration: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  invokedAt: z.date().optional(),
  completedAt: z.date().optional(),
});

/**
 * Zod schema for ToolInvocation validation
 */
export const ToolInvocationSchema = z.object({
  id: z.string(),
  toolName: z.string(),
  parameters: z.record(z.string(), z.unknown()),
  invokedAt: z.date(),
  response: MockToolResponseSchema.optional(),
  completedAt: z.date().optional(),
  duration: z.number().optional(),
  context: z
    .object({
      taskId: z.string().optional(),
      agentName: z.string().optional(),
      stageName: z.string().optional(),
      workingDirectory: z.string().optional(),
      requestId: z.string().optional(),
    })
    .optional(),
  error: z.instanceof(Error).optional(),
});

/**
 * Zod schema for MockToolParametersSchema validation
 */
export const MockToolParametersSchemaSchema = z.object({
  type: z.literal('object'),
  properties: z.record(z.string(), z.any()),
  required: z.array(z.string()).optional(),
  additionalProperties: z.boolean().optional(),
});

/**
 * Zod schema for MockTool validation
 */
export const MockToolSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  category: z
    .enum(['filesystem', 'shell', 'web', 'browser', 'search', 'system', 'custom', 'mcp'])
    .optional(),
  parameters: MockToolParametersSchemaSchema,
  dangerous: z.boolean().optional(),
  enabled: z.boolean().optional(),
  version: z.string().optional(),
  execute: z.union([z.function(), z.any()]), // Function or executor object
  staticResponse: MockToolResponseSchema.optional(),
  responseSequence: z.array(MockToolResponseSchema).optional(),
  responseDelay: z.number().optional(),
  recordInvocations: z.boolean().optional(),
  maxInvocations: z.number().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type {
  MockToolParameterType,
  MockToolParameter,
  MockToolParametersSchema,
  MockToolResponseContentType,
  MockToolTextContent,
  MockToolImageContent,
  MockToolResourceContent,
  MockToolErrorContent,
  MockToolContentBlock,
  MockToolResponse,
  ToolInvocation,
  ToolInvocationContext,
  MockToolExecutorFn,
  MockToolExecutor,
  MockToolValidationResult,
  MockToolCategory,
  MockTool,
  MockToolBehaviorConfig,
  MockToolRegistryEntry,
  MockToolInvocationEvent,
};
