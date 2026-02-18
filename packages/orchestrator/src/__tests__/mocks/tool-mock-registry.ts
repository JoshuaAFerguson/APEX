/**
 * MockToolRegistry - Central registry for mock tool management
 *
 * Provides comprehensive tool mocking capabilities:
 * - Tool registration with configurable responses
 * - Execution simulation with delay and error support
 * - Invocation capture for assertions
 * - Usage pattern verification
 */

import { vi } from 'vitest';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';
import type {
  MockToolDefinition,
  MockToolConfig,
  MockToolResult,
  MockToolHandler,
  MockToolContext,
  ToolInvocationRecord,
  ToolCallVerificationResult,
  ToolCallExpectation,
  ToolExecutionOptions,
  ToolUsageStatistics,
  ToolCallPattern,
  PatternMatchResult,
} from './tool-mock.types';

/**
 * MockToolRegistry - Central registry for mock tool management
 *
 * Provides comprehensive tool mocking capabilities including tool registration,
 * execution simulation, invocation tracking, and usage pattern verification.
 *
 * @example
 * ```typescript
 * const registry = new MockToolRegistry();
 * registry.registerTool('Read', 'Read file', z.object({ file_path: z.string() }), {
 *   response: { content: [{ type: 'text', text: 'file content' }] }
 * });
 *
 * const result = await registry.simulateExecution('Read', { file_path: '/test.ts' });
 * expect(registry.wasToolCalled('Read')).toBe(true);
 * ```
 */
export class MockToolRegistry extends EventEmitter {
  private tools: Map<string, MockToolDefinition> = new Map();
  private invocations: ToolInvocationRecord[] = [];
  private invocationCounts: Map<string, number> = new Map();
  private permissionChecker?: (toolName: string, input: Record<string, unknown>) => Promise<'allow' | 'deny'>;

  /**
   * Register a mock tool with configurable behavior
   *
   * @param name - The tool name
   * @param description - Tool description
   * @param schema - Zod schema for input validation
   * @param config - Mock configuration options
   * @returns The registered tool definition
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
    this.emit('tool:registered', { name, definition });
    return definition;
  }

  /**
   * Register a tool with a sequence of responses
   *
   * @param name - The tool name
   * @param description - Tool description
   * @param schema - Zod schema for input validation
   * @param responses - Array of responses to cycle through
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
   *
   * @param name - The tool name
   * @returns The tool definition or undefined if not found
   */
  getTool(name: string): MockToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool is registered
   *
   * @param name - The tool name
   * @returns true if the tool is registered
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all registered tool names
   *
   * @returns Array of registered tool names
   */
  getRegisteredToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Simulate tool execution with comprehensive behavior handling
   *
   * @param toolName - The tool to execute
   * @param input - The input arguments
   * @param options - Execution options
   * @returns Promise resolving to the mock result
   */
  async simulateExecution(
    toolName: string,
    input: Record<string, unknown>,
    options: ToolExecutionOptions = {}
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

    // Emit start event
    this.emit('tool:start', {
      toolName,
      input,
      callId,
      timestamp,
      invocationCount,
    });

    // Check permissions if enabled
    if (options.checkPermissions && this.permissionChecker) {
      const permission = await this.permissionChecker(toolName, input);
      if (permission === 'deny') {
        const error = new Error(`Permission denied for tool: ${toolName}`);
        const record = this.createErrorRecord(toolName, input, timestamp, callId, error);
        this.invocations.push(record);
        this.emit('tool:error', { ...record, context });
        throw error;
      }
    }

    // Check max invocations
    if (tool.config.maxInvocations && invocationCount > tool.config.maxInvocations) {
      const error = new Error(`Tool '${toolName}' exceeded max invocations (${tool.config.maxInvocations})`);
      const record = this.createErrorRecord(toolName, input, timestamp, callId, error);
      this.invocations.push(record);
      this.emit('tool:error', { ...record, context });
      throw error;
    }

    // Check for forced errors from options
    if (options.forceError) {
      const record = this.createErrorRecord(toolName, input, timestamp, callId, options.forceError);
      this.invocations.push(record);
      this.emit('tool:error', { ...record, context });
      throw options.forceError;
    }

    // Check for scheduled errors
    const scheduledError = tool.config.errorOnCall?.find(e => e.callNumber === invocationCount);
    if (scheduledError) {
      const record = this.createErrorRecord(toolName, input, timestamp, callId, scheduledError.error);
      this.invocations.push(record);
      this.emit('tool:error', { ...record, context });
      throw scheduledError.error;
    }

    // Apply delay (options override config)
    const delay = options.delay ?? tool.config.delay;
    if (delay) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    let result: MockToolResult;
    const startTime = Date.now();

    try {
      // Determine response
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

      // Emit completion event
      this.emit('tool:complete', {
        ...record,
        context,
        success: !result.isError,
        output: result.content,
      });

      return result;
    } catch (error) {
      const record = this.createErrorRecord(
        toolName,
        input,
        timestamp,
        callId,
        error as Error,
        Date.now() - startTime
      );
      this.invocations.push(record);
      this.emit('tool:error', { ...record, context });
      throw error;
    }
  }

  /**
   * Queue responses for a tool (replaces existing sequence)
   *
   * @param toolName - The tool name
   * @param responses - Array of responses to queue
   */
  queueResponses(toolName: string, responses: MockToolResult[]): void {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' is not registered`);
    }
    tool.config.responseSequence = [...responses];
  }

  /**
   * Add responses to existing queue
   *
   * @param toolName - The tool name
   * @param responses - Array of responses to add
   */
  addResponses(toolName: string, responses: MockToolResult[]): void {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' is not registered`);
    }
    if (!tool.config.responseSequence) {
      tool.config.responseSequence = [];
    }
    tool.config.responseSequence.push(...responses);
  }

  // ========================================
  // Invocation Capture Methods
  // ========================================

  /**
   * Get all invocations, optionally filtered by tool name
   *
   * @param toolName - Optional tool name filter
   * @returns Array of invocation records
   */
  getInvocations(toolName?: string): ToolInvocationRecord[] {
    if (toolName) {
      return this.invocations.filter(inv => inv.toolName === toolName);
    }
    return [...this.invocations];
  }

  /**
   * Get the last invocation for a tool
   *
   * @param toolName - The tool name
   * @returns The last invocation record or undefined
   */
  getLastInvocation(toolName: string): ToolInvocationRecord | undefined {
    const toolInvocations = this.getInvocations(toolName);
    return toolInvocations[toolInvocations.length - 1];
  }

  /**
   * Get invocation count for a tool
   *
   * @param toolName - The tool name
   * @returns Number of invocations
   */
  getInvocationCount(toolName: string): number {
    return this.invocationCounts.get(toolName) ?? 0;
  }

  /**
   * Get usage statistics for a tool
   *
   * @param toolName - The tool name
   * @returns Usage statistics
   */
  getToolStatistics(toolName: string): ToolUsageStatistics {
    const invocations = this.getInvocations(toolName);
    const totalInvocations = invocations.length;

    if (totalInvocations === 0) {
      return {
        totalInvocations: 0,
        totalDuration: 0,
        averageDuration: 0,
        errorRate: 0,
      };
    }

    const durations = invocations.filter(inv => inv.duration !== undefined).map(inv => inv.duration!);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const errorCount = invocations.filter(inv => inv.error !== undefined).length;
    const timestamps = invocations.map(inv => inv.timestamp);

    return {
      totalInvocations,
      totalDuration,
      averageDuration: totalDuration / durations.length || 0,
      errorRate: errorCount / totalInvocations,
      firstInvocation: timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : undefined,
      lastInvocation: timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : undefined,
    };
  }

  /**
   * Clear all invocation records
   */
  clearInvocations(): void {
    this.invocations = [];
    this.invocationCounts.clear();
    this.emit('invocations:cleared');
  }

  // ========================================
  // Usage Pattern Verification Methods
  // ========================================

  /**
   * Check if a tool was called at least once
   *
   * @param toolName - The tool name
   * @returns true if the tool was called
   */
  wasToolCalled(toolName: string): boolean {
    return this.invocations.some(inv => inv.toolName === toolName);
  }

  /**
   * Check if a tool was called with specific input
   *
   * @param toolName - The tool name
   * @param expectedInput - Expected input object or predicate function
   * @returns true if the tool was called with matching input
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
   *
   * @param expectedSequence - Array of expected tool names in order
   * @returns Verification result with details
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
   * Verify tool calls match complex patterns
   *
   * @param patterns - Array of patterns to match
   * @returns Pattern match results
   */
  verifyCallPatterns(patterns: ToolCallPattern[]): PatternMatchResult[] {
    return patterns.map(pattern => this.verifyPattern(pattern));
  }

  /**
   * Assert tool call expectations (throws on failure)
   *
   * @param expectations - Array of tool call expectations
   * @throws Error if expectations are not met
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
   * Set a permission checker for tool execution
   *
   * @param checker - Function to check permissions
   */
  setPermissionChecker(checker: (toolName: string, input: Record<string, unknown>) => Promise<'allow' | 'deny'>): void {
    this.permissionChecker = checker;
  }

  /**
   * Clear the permission checker
   */
  clearPermissionChecker(): void {
    this.permissionChecker = undefined;
  }

  /**
   * Reset all state (tools, invocations, etc.)
   */
  reset(): void {
    this.tools.clear();
    this.invocations = [];
    this.invocationCounts.clear();
    this.permissionChecker = undefined;
    this.removeAllListeners();
    this.emit('registry:reset');
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Create an error invocation record
   */
  private createErrorRecord(
    toolName: string,
    input: Record<string, unknown>,
    timestamp: Date,
    callId: string,
    error: Error,
    duration?: number
  ): ToolInvocationRecord {
    return {
      toolName,
      input,
      timestamp,
      callId,
      error,
      duration,
    };
  }

  /**
   * Verify a single pattern against invocations
   */
  private verifyPattern(pattern: ToolCallPattern): PatternMatchResult {
    const violations: PatternMatchResult['violations'] = [];
    let matches: ToolInvocationRecord[] = [];

    // Find matching invocations
    for (const invocation of this.invocations) {
      const nameMatches = typeof pattern.toolName === 'string'
        ? invocation.toolName === pattern.toolName
        : pattern.toolName.test(invocation.toolName);

      if (!nameMatches) continue;

      const inputMatches = !pattern.input ||
        (typeof pattern.input === 'function'
          ? pattern.input(invocation.input)
          : JSON.stringify(invocation.input) === JSON.stringify(pattern.input));

      if (inputMatches) {
        matches.push(invocation);
      }
    }

    // Check count expectations
    if (pattern.times !== undefined) {
      const count = matches.length;
      if (typeof pattern.times === 'number') {
        if (count !== pattern.times) {
          violations.push({
            type: count < pattern.times ? 'missing' : 'extra',
            message: `Expected ${pattern.times} matches, found ${count}`,
            expected: pattern.times,
            actual: count,
          });
        }
      } else {
        if (pattern.times.min !== undefined && count < pattern.times.min) {
          violations.push({
            type: 'missing',
            message: `Expected at least ${pattern.times.min} matches, found ${count}`,
            expected: pattern.times.min,
            actual: count,
          });
        }
        if (pattern.times.max !== undefined && count > pattern.times.max) {
          violations.push({
            type: 'extra',
            message: `Expected at most ${pattern.times.max} matches, found ${count}`,
            expected: pattern.times.max,
            actual: count,
          });
        }
      }
    }

    return {
      passed: violations.length === 0,
      pattern,
      matches,
      violations,
    };
  }
}