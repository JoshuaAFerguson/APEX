/**
 * @fileoverview Mock Tools Executor for Claude Agent SDK Testing
 *
 * This module provides a comprehensive mock executor system for testing Claude Agent SDK
 * tool interactions without requiring actual tool implementations. It enables:
 * - Simulating tool execution behavior with configurable responses
 * - Recording tool invocations for verification in tests
 * - Managing tool state and behavior across test scenarios
 * - Supporting both simple static responses and complex dynamic behaviors
 *
 * ## Architecture Decision Record (ADR-076)
 *
 * ### Context
 * APEX needs to test Claude Agent SDK integrations that involve tool execution.
 * Testing real tool execution would be slow, unreliable, and could have side effects.
 * We need a way to mock tool behavior while maintaining compatibility with the SDK's
 * tool execution patterns.
 *
 * ### Decision
 * Create a MockToolsExecutor that:
 * 1. Maintains a registry of mock tools with configurable behaviors
 * 2. Records all tool invocations for test verification
 * 3. Supports both static responses and dynamic execution logic
 * 4. Provides comprehensive event tracking for tool lifecycle
 * 5. Enables easy setup/teardown for test isolation
 *
 * ### Consequences
 * - Tests can run fast without actual tool execution
 * - Comprehensive verification of tool usage patterns
 * - Consistent mock behavior across test suites
 * - Easy simulation of edge cases and error conditions
 *
 * @module @apex/core/test-utils/mock-tools-executor
 */

import { EventEmitter } from 'events';
import {
  type MockTool,
  type MockToolResponse,
  type ToolInvocation,
  type ToolInvocationContext,
  type MockToolRegistryEntry,
  type MockToolInvocationEvent,
  type MockToolBehaviorConfig,
  type MockToolExecutor,
  type MockToolValidationResult,
  MockToolResponseSchema,
} from './mock-tool-types';

/**
 * Configuration options for the MockToolsExecutor
 */
export interface MockToolsExecutorConfig {
  /** Whether to record all tool invocations (default: true) */
  recordInvocations?: boolean;
  /** Whether to emit events for tool lifecycle (default: true) */
  emitEvents?: boolean;
  /** Default timeout for tool execution in milliseconds (default: 5000) */
  defaultTimeout?: number;
  /** Whether to validate tool parameters (default: true) */
  validateParameters?: boolean;
  /** Whether to validate tool responses (default: true) */
  validateResponses?: boolean;
  /** Maximum number of concurrent tool executions (default: 10) */
  maxConcurrentExecutions?: number;
  /** Global behavior configuration applied to all tools */
  globalBehavior?: MockToolBehaviorConfig;
}

/**
 * Statistics about tool execution
 */
export interface MockToolExecutionStats {
  /** Total number of tool invocations */
  totalInvocations: number;
  /** Number of successful executions */
  successfulExecutions: number;
  /** Number of failed executions */
  failedExecutions: number;
  /** Number of executions that threw errors */
  errorExecutions: number;
  /** Average execution duration in milliseconds */
  averageDuration: number;
  /** Total execution time across all tools */
  totalDuration: number;
  /** Number of currently executing tools */
  currentlyExecuting: number;
  /** Per-tool statistics */
  perTool: Record<string, {
    invocations: number;
    successes: number;
    failures: number;
    errors: number;
    averageDuration: number;
    lastInvoked?: Date;
  }>;
}

/**
 * Mock tools executor that simulates Claude Agent SDK tool execution.
 * This class provides a complete mock environment for testing tool interactions
 * without requiring actual tool implementations.
 *
 * @example
 * ```typescript
 * const executor = new MockToolsExecutor();
 *
 * // Register a simple mock tool
 * executor.registerTool({
 *   name: 'Read',
 *   description: 'Read file contents',
 *   parameters: {
 *     type: 'object',
 *     properties: {
 *       file_path: { type: 'string' }
 *     },
 *     required: ['file_path']
 *   },
 *   execute: async (params) => ({
 *     success: true,
 *     content: [{ type: 'text', text: 'mock file content' }]
 *   })
 * });
 *
 * // Execute the tool
 * const response = await executor.executeTool('Read', { file_path: '/test.txt' });
 * expect(response.success).toBe(true);
 *
 * // Verify invocations
 * const invocations = executor.getInvocations('Read');
 * expect(invocations).toHaveLength(1);
 * ```
 */
export class MockToolsExecutor extends EventEmitter {
  private readonly config: Required<MockToolsExecutorConfig>;
  private readonly toolRegistry = new Map<string, MockToolRegistryEntry>();
  private readonly executionPromises = new Map<string, Promise<MockToolResponse>>();
  private invocationIdCounter = 0;

  /**
   * Creates a new MockToolsExecutor instance
   *
   * @param config - Configuration options for the executor
   */
  constructor(config: MockToolsExecutorConfig = {}) {
    super();

    this.config = {
      recordInvocations: true,
      emitEvents: true,
      defaultTimeout: 5000,
      validateParameters: true,
      validateResponses: true,
      maxConcurrentExecutions: 10,
      ...config,
      globalBehavior: {
        trackInvocations: true,
        ...config.globalBehavior,
      },
    };
  }

  /**
   * Registers a mock tool for execution
   *
   * @param tool - The mock tool definition
   * @param behavior - Optional behavior configuration for this tool
   * @returns this (for chaining)
   */
  registerTool(tool: MockTool, behavior?: MockToolBehaviorConfig): this {
    const entry: MockToolRegistryEntry = {
      tool,
      behavior: { ...this.config.globalBehavior, ...behavior },
      invocations: [],
      sequenceIndex: 0,
      invocationCount: 0,
      enabled: tool.enabled ?? true,
      registeredAt: new Date(),
    };

    this.toolRegistry.set(tool.name, entry);
    return this;
  }

  /**
   * Registers multiple mock tools at once
   *
   * @param tools - Array of mock tool definitions
   * @returns this (for chaining)
   */
  registerTools(tools: MockTool[]): this {
    for (const tool of tools) {
      this.registerTool(tool);
    }
    return this;
  }

  /**
   * Unregisters a mock tool
   *
   * @param toolName - Name of the tool to unregister
   * @returns Whether the tool was found and removed
   */
  unregisterTool(toolName: string): boolean {
    return this.toolRegistry.delete(toolName);
  }

  /**
   * Checks if a tool is registered
   *
   * @param toolName - Name of the tool to check
   * @returns Whether the tool is registered
   */
  isToolRegistered(toolName: string): boolean {
    return this.toolRegistry.has(toolName);
  }

  /**
   * Gets a list of all registered tool names
   *
   * @returns Array of tool names
   */
  getRegisteredToolNames(): string[] {
    return Array.from(this.toolRegistry.keys());
  }

  /**
   * Enables or disables a tool
   *
   * @param toolName - Name of the tool
   * @param enabled - Whether the tool should be enabled
   * @returns Whether the tool was found and updated
   */
  setToolEnabled(toolName: string, enabled: boolean): boolean {
    const entry = this.toolRegistry.get(toolName);
    if (entry) {
      entry.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Executes a mock tool with the given parameters
   *
   * @param toolName - Name of the tool to execute
   * @param parameters - Parameters to pass to the tool
   * @param context - Optional execution context
   * @returns Promise that resolves to the tool response
   */
  async executeTool(
    toolName: string,
    parameters: Record<string, unknown>,
    context?: ToolInvocationContext
  ): Promise<MockToolResponse> {
    const entry = this.toolRegistry.get(toolName);

    if (!entry) {
      throw new Error(`Tool '${toolName}' is not registered`);
    }

    if (!entry.enabled) {
      throw new Error(`Tool '${toolName}' is disabled`);
    }

    // Check concurrent execution limits
    if (this.executionPromises.size >= this.config.maxConcurrentExecutions) {
      throw new Error(`Maximum concurrent executions (${this.config.maxConcurrentExecutions}) reached`);
    }

    // Create invocation record
    const invocationId = `inv_${++this.invocationIdCounter}`;
    const invocation: ToolInvocation = {
      id: invocationId,
      toolName,
      parameters,
      invokedAt: new Date(),
      context,
    };

    // Validate parameters if enabled
    if (this.config.validateParameters) {
      const validationResult = this.validateToolParameters(entry.tool, parameters);
      if (!validationResult.valid) {
        const error = new Error(`Parameter validation failed: ${validationResult.errors?.join(', ')}`);
        invocation.error = error;
        invocation.completedAt = new Date();
        invocation.duration = 0;

        this.recordInvocation(entry, invocation);
        throw error;
      }
    }

    // Emit tool invoked event
    if (this.config.emitEvents) {
      this.emitToolEvent('tool:invoked', toolName, invocation);
    }

    // Execute the tool
    const executionPromise = this.executeToolInternal(entry, invocation);
    this.executionPromises.set(invocationId, executionPromise);

    try {
      const response = await executionPromise;

      // Update invocation with response
      invocation.response = response;
      invocation.completedAt = new Date();
      invocation.duration = invocation.completedAt.getTime() - invocation.invokedAt.getTime();

      // Validate response if enabled
      if (this.config.validateResponses) {
        const validation = MockToolResponseSchema.safeParse(response);
        if (!validation.success) {
          console.warn(`Tool '${toolName}' returned invalid response:`, validation.error);
        }
      }

      // Record invocation
      this.recordInvocation(entry, invocation);

      // Emit completion event
      if (this.config.emitEvents) {
        this.emitToolEvent('tool:completed', toolName, invocation, response);
      }

      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Update invocation with error
      invocation.error = err;
      invocation.completedAt = new Date();
      invocation.duration = invocation.completedAt.getTime() - invocation.invokedAt.getTime();

      // Record invocation
      this.recordInvocation(entry, invocation);

      // Emit error event
      if (this.config.emitEvents) {
        this.emitToolEvent('tool:error', toolName, invocation, undefined, err);
      }

      throw err;
    } finally {
      this.executionPromises.delete(invocationId);
    }
  }

  /**
   * Internal tool execution method
   */
  private async executeToolInternal(
    entry: MockToolRegistryEntry,
    invocation: ToolInvocation
  ): Promise<MockToolResponse> {
    const { tool, behavior } = entry;

    // Apply response delay if configured
    if (behavior?.delay || tool.responseDelay) {
      const delay = behavior?.delay ?? tool.responseDelay ?? 0;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Check error probability
    if (behavior?.errorProbability && Math.random() < behavior.errorProbability) {
      const error = behavior.errorToThrow instanceof Error
        ? behavior.errorToThrow
        : new Error(String(behavior.errorToThrow ?? 'Mock error'));
      throw error;
    }

    // Handle static response
    if (tool.staticResponse) {
      return tool.staticResponse;
    }

    // Handle response sequence
    if (tool.responseSequence && tool.responseSequence.length > 0) {
      const response = tool.responseSequence[entry.sequenceIndex];
      entry.sequenceIndex = (entry.sequenceIndex + 1) % tool.responseSequence.length;
      return response;
    }

    // Execute tool logic
    if (typeof tool.execute === 'function') {
      return await tool.execute(invocation.parameters, invocation.context);
    } else {
      return await tool.execute.execute(invocation.parameters, invocation.context);
    }
  }

  /**
   * Records a tool invocation
   */
  private recordInvocation(entry: MockToolRegistryEntry, invocation: ToolInvocation): void {
    if (!this.config.recordInvocations) {
      return;
    }

    entry.invocations.push(invocation);
    entry.invocationCount++;
    entry.lastInvokedAt = invocation.invokedAt;

    // Limit invocations array size to prevent memory leaks
    if (entry.invocations.length > 1000) {
      entry.invocations.splice(0, entry.invocations.length - 1000);
    }
  }

  /**
   * Emits a tool event
   */
  private emitToolEvent(
    type: MockToolInvocationEvent['type'],
    toolName: string,
    invocation: ToolInvocation,
    response?: MockToolResponse,
    error?: Error
  ): void {
    const event: MockToolInvocationEvent = {
      type,
      toolName,
      invocation,
      response,
      error,
      timestamp: new Date(),
    };
    (this as any).emit(type, event);
    (this as any).emit('tool:event', event);
  }

  /**
   * Validates tool parameters against the tool's schema
   */
  private validateToolParameters(
    tool: MockTool,
    parameters: Record<string, unknown>
  ): MockToolValidationResult {
    // Use custom validation if provided
    if (tool.validate) {
      return tool.validate(parameters);
    }

    // Basic validation using the parameters schema
    const schema = tool.parameters;
    const errors: string[] = [];

    // Check required parameters
    if (schema.required) {
      for (const requiredParam of schema.required) {
        if (!(requiredParam in parameters)) {
          errors.push(`Missing required parameter: ${requiredParam}`);
        }
      }
    }

    // Basic type checking for properties
    for (const [paramName, paramValue] of Object.entries(parameters)) {
      const paramSchema = schema.properties[paramName];
      if (paramSchema && !this.validateParameterValue(paramValue, paramSchema)) {
        errors.push(`Invalid type for parameter '${paramName}'`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validates a single parameter value against its schema
   */
  private validateParameterValue(value: unknown, schema: any): boolean {
    // This is a simplified validation - in a real implementation,
    // you might want to use a JSON Schema validator
    const type = schema.type;

    if (Array.isArray(type)) {
      return type.some(t => this.checkType(value, t));
    }

    return this.checkType(value, type);
  }

  /**
   * Checks if a value matches a specific type
   */
  private checkType(value: unknown, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'integer':
        return typeof value === 'number' && Number.isInteger(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'null':
        return value === null;
      default:
        return false;
    }
  }

  /**
   * Gets all invocations for a specific tool
   *
   * @param toolName - Name of the tool
   * @returns Array of tool invocations
   */
  getInvocations(toolName?: string): ToolInvocation[] {
    if (toolName) {
      const entry = this.toolRegistry.get(toolName);
      return entry ? [...entry.invocations] : [];
    }

    // Return all invocations across all tools
    const allInvocations: ToolInvocation[] = [];
    for (const entry of this.toolRegistry.values()) {
      allInvocations.push(...entry.invocations);
    }
    return allInvocations.sort((a, b) => a.invokedAt.getTime() - b.invokedAt.getTime());
  }

  /**
   * Gets the last invocation for a specific tool
   *
   * @param toolName - Name of the tool
   * @returns The most recent invocation, or undefined if none
   */
  getLastInvocation(toolName: string): ToolInvocation | undefined {
    const invocations = this.getInvocations(toolName);
    return invocations.length > 0 ? invocations[invocations.length - 1] : undefined;
  }

  /**
   * Clears all recorded invocations
   *
   * @param toolName - Optional tool name to clear specific tool invocations
   */
  clearInvocations(toolName?: string): void {
    if (toolName) {
      const entry = this.toolRegistry.get(toolName);
      if (entry) {
        entry.invocations = [];
        entry.invocationCount = 0;
        entry.sequenceIndex = 0;
      }
    } else {
      for (const entry of this.toolRegistry.values()) {
        entry.invocations = [];
        entry.invocationCount = 0;
        entry.sequenceIndex = 0;
      }
    }
  }

  /**
   * Gets execution statistics
   *
   * @returns Comprehensive execution statistics
   */
  getStats(): MockToolExecutionStats {
    let totalInvocations = 0;
    let successfulExecutions = 0;
    let failedExecutions = 0;
    let errorExecutions = 0;
    let totalDuration = 0;
    const perTool: MockToolExecutionStats['perTool'] = {};

    for (const [toolName, entry] of this.toolRegistry.entries()) {
      const toolInvocations = entry.invocations;
      const toolSuccesses = toolInvocations.filter(inv => inv.response?.success).length;
      const toolFailures = toolInvocations.filter(inv => inv.response?.success === false).length;
      const toolErrors = toolInvocations.filter(inv => inv.error).length;
      const toolDurations = toolInvocations
        .filter(inv => inv.duration !== undefined)
        .map(inv => inv.duration!);
      const avgDuration = toolDurations.length > 0
        ? toolDurations.reduce((a, b) => a + b, 0) / toolDurations.length
        : 0;

      totalInvocations += toolInvocations.length;
      successfulExecutions += toolSuccesses;
      failedExecutions += toolFailures;
      errorExecutions += toolErrors;
      totalDuration += toolDurations.reduce((a, b) => a + b, 0);

      perTool[toolName] = {
        invocations: toolInvocations.length,
        successes: toolSuccesses,
        failures: toolFailures,
        errors: toolErrors,
        averageDuration: avgDuration,
        lastInvoked: entry.lastInvokedAt,
      };
    }

    return {
      totalInvocations,
      successfulExecutions,
      failedExecutions,
      errorExecutions,
      averageDuration: totalInvocations > 0 ? totalDuration / totalInvocations : 0,
      totalDuration,
      currentlyExecuting: this.executionPromises.size,
      perTool,
    };
  }

  /**
   * Resets the executor state
   * Clears all invocations, resets sequence indices, and removes execution promises
   */
  reset(): void {
    this.clearInvocations();

    // Reset sequence indices
    for (const entry of this.toolRegistry.values()) {
      entry.sequenceIndex = 0;
    }

    // Clear execution promises (shouldn't have any if used properly)
    this.executionPromises.clear();

    // Reset invocation counter
    this.invocationIdCounter = 0;

    // Reset any executor instances
    for (const entry of this.toolRegistry.values()) {
      if (typeof entry.tool.execute === 'object' && entry.tool.execute.reset) {
        entry.tool.execute.reset();
      }
    }
  }

  /**
   * Creates a helper function that can be used to replace tool execution in tests
   *
   * @returns Function that mimics Claude Agent SDK tool execution behavior
   */
  createToolExecutionHandler(): (toolName: string, params: Record<string, unknown>) => Promise<MockToolResponse> {
    return this.executeTool.bind(this);
  }
}

/**
 * Creates default mock tools for common Claude Agent SDK tools
 *
 * @returns Array of mock tools for Read, Write, Edit, Bash, Glob, Grep
 */
export function createDefaultMockTools(): MockTool[] {
  return [
    // Read tool mock
    {
      name: 'Read',
      description: 'Reads file contents from the filesystem',
      category: 'filesystem',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'The absolute path to the file to read'
          },
          limit: {
            type: 'number',
            description: 'Number of lines to read'
          },
          offset: {
            type: 'number',
            description: 'Line number to start reading from'
          }
        },
        required: ['file_path']
      },
      execute: async (params) => ({
        success: true,
        content: [{ type: 'text', text: `Mock content for ${params.file_path}` }]
      })
    },

    // Write tool mock
    {
      name: 'Write',
      description: 'Writes content to a file',
      category: 'filesystem',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'The absolute path to write to'
          },
          content: {
            type: 'string',
            description: 'Content to write'
          }
        },
        required: ['file_path', 'content']
      },
      execute: async (params) => ({
        success: true,
        content: [{ type: 'text', text: `File written to ${params.file_path}` }]
      })
    },

    // Edit tool mock
    {
      name: 'Edit',
      description: 'Performs exact string replacements in files',
      category: 'filesystem',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'The absolute path to the file to modify'
          },
          old_string: {
            type: 'string',
            description: 'The text to replace'
          },
          new_string: {
            type: 'string',
            description: 'The replacement text'
          }
        },
        required: ['file_path', 'old_string', 'new_string']
      },
      execute: async (params) => ({
        success: true,
        content: [{ type: 'text', text: `Edited ${params.file_path}` }]
      })
    },

    // Bash tool mock
    {
      name: 'Bash',
      description: 'Execute bash commands',
      category: 'shell',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The command to execute'
          }
        },
        required: ['command']
      },
      execute: async (params) => ({
        success: true,
        content: [{ type: 'text', text: `$ ${params.command}\nMock command output` }]
      })
    },

    // Glob tool mock
    {
      name: 'Glob',
      description: 'Find files using glob patterns',
      category: 'filesystem',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'The glob pattern to match files'
          },
          path: {
            type: 'string',
            description: 'The directory to search in'
          }
        },
        required: ['pattern']
      },
      execute: async (params) => ({
        success: true,
        content: [{ type: 'text', text: `Found files matching ${params.pattern}:\n./src/file1.ts\n./src/file2.ts` }]
      })
    },

    // Grep tool mock
    {
      name: 'Grep',
      description: 'Search for text patterns in files',
      category: 'search',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'The pattern to search for'
          },
          path: {
            type: 'string',
            description: 'File or directory to search'
          }
        },
        required: ['pattern']
      },
      execute: async (params) => ({
        success: true,
        content: [{ type: 'text', text: `Search results for "${params.pattern}":\n./src/file1.ts:10:matching line` }]
      })
    }
  ];
}

/**
 * Factory function to create a preconfigured MockToolsExecutor with default tools
 *
 * @param config - Optional configuration for the executor
 * @returns Configured MockToolsExecutor instance with default tools
 */
export function createMockToolsExecutor(config?: MockToolsExecutorConfig): MockToolsExecutor {
  const executor = new MockToolsExecutor(config);
  executor.registerTools(createDefaultMockTools());
  return executor;
}