import { ToolInvocation, ToolExecution } from '@apexcli/core';

/**
 * Options for querying recorded tool invocations
 */
export interface ToolInvocationQueryOptions {
  /** Filter by tool name */
  toolName?: string;
  /** Filter by task ID */
  taskId?: string;
  /** Filter by agent name */
  agentName?: string;
  /** Filter by stage name */
  stageName?: string;
  /** Filter by time range - start time */
  startTime?: Date;
  /** Filter by time range - end time */
  endTime?: Date;
  /** Filter by specific parameters (exact match) */
  parameters?: Record<string, unknown>;
  /** Filter by execution status */
  status?: 'running' | 'completed' | 'failed';
  /** Maximum number of results to return */
  limit?: number;
}

/**
 * Complete record of a tool invocation with execution details
 */
export interface ToolInvocationRecord {
  /** The original invocation request */
  invocation: ToolInvocation;
  /** The execution details if available */
  execution?: ToolExecution;
  /** Timestamp when the invocation was recorded */
  recordedAt: Date;
}

/**
 * Statistics about recorded tool invocations
 */
export interface ToolInvocationStats {
  /** Total number of recorded invocations */
  totalInvocations: number;
  /** Number of successful executions */
  successfulExecutions: number;
  /** Number of failed executions */
  failedExecutions: number;
  /** Number of running executions */
  runningExecutions: number;
  /** Most frequently used tools */
  topTools: Array<{ toolName: string; count: number }>;
  /** Average execution duration (for completed executions) */
  averageDuration?: number;
}

/**
 * ToolInvocationRecorder captures all tool invocations and executions for analysis and testing.
 *
 * This class provides an in-memory recording mechanism for tool calls that can be used
 * during testing or development to capture and analyze tool usage patterns.
 *
 * @example
 * ```typescript
 * const recorder = new ToolInvocationRecorder();
 *
 * // Record a tool invocation
 * recorder.recordInvocation({
 *   toolName: 'Read',
 *   parameters: { file_path: '/test.txt' },
 *   context: { taskId: 'task-1', agentName: 'developer' }
 * });
 *
 * // Query recorded invocations
 * const readInvocations = recorder.queryInvocations({ toolName: 'Read' });
 *
 * // Clear recordings for next test
 * recorder.clear();
 * ```
 */
export class ToolInvocationRecorder {
  private records: ToolInvocationRecord[] = [];

  /**
   * Record a tool invocation request
   *
   * @param invocation - The tool invocation to record
   * @returns The recorded invocation record
   */
  recordInvocation(invocation: ToolInvocation): ToolInvocationRecord {
    const record: ToolInvocationRecord = {
      invocation,
      recordedAt: new Date(),
    };

    this.records.push(record);
    return record;
  }

  /**
   * Update a recorded invocation with execution details
   *
   * @param requestId - The request ID of the invocation to update
   * @param execution - The execution details
   * @returns True if the record was found and updated, false otherwise
   */
  recordExecution(requestId: string, execution: ToolExecution): boolean {
    const record = this.records.find(r => r.invocation.requestId === requestId);
    if (record) {
      record.execution = execution;
      return true;
    }
    return false;
  }

  /**
   * Update execution for invocation by call ID
   *
   * @param callId - The call ID of the execution
   * @param execution - The execution details
   * @returns True if a matching record was found and updated, false otherwise
   */
  recordExecutionByCallId(callId: string, execution: ToolExecution): boolean {
    const record = this.records.find(r =>
      r.execution?.callId === callId ||
      (!r.execution && this.matchesInvocation(r.invocation, execution))
    );

    if (record) {
      record.execution = execution;
      return true;
    }
    return false;
  }

  /**
   * Check if an invocation matches an execution based on tool name and context
   */
  private matchesInvocation(invocation: ToolInvocation, execution: ToolExecution): boolean {
    return invocation.toolName === execution.toolName &&
           invocation.context?.taskId === execution.taskId &&
           invocation.context?.agentName === execution.agentName &&
           invocation.context?.stageName === execution.stageName;
  }

  /**
   * Query recorded tool invocations based on various criteria
   *
   * @param options - Query options to filter results
   * @returns Array of matching tool invocation records
   */
  queryInvocations(options: ToolInvocationQueryOptions = {}): ToolInvocationRecord[] {
    let results = this.records;

    // Apply filters
    if (options.toolName) {
      results = results.filter(r => r.invocation.toolName === options.toolName);
    }

    if (options.taskId) {
      results = results.filter(r => r.invocation.context?.taskId === options.taskId);
    }

    if (options.agentName) {
      results = results.filter(r => r.invocation.context?.agentName === options.agentName);
    }

    if (options.stageName) {
      results = results.filter(r => r.invocation.context?.stageName === options.stageName);
    }

    if (options.startTime) {
      results = results.filter(r => r.recordedAt >= options.startTime!);
    }

    if (options.endTime) {
      results = results.filter(r => r.recordedAt <= options.endTime!);
    }

    if (options.status && options.status === 'running') {
      results = results.filter(r => r.execution?.status === 'running');
    } else if (options.status && options.status === 'completed') {
      results = results.filter(r => r.execution?.status === 'completed');
    } else if (options.status && options.status === 'failed') {
      results = results.filter(r => r.execution?.status === 'failed');
    }

    if (options.parameters) {
      results = results.filter(r => this.parametersMatch(r.invocation.parameters, options.parameters!));
    }

    // Apply limit
    if (options.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Check if parameters match (exact match for primitive values, deep check for objects)
   */
  private parametersMatch(recorded: Record<string, unknown>, filter: Record<string, unknown>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (!(key in recorded)) {
        return false;
      }

      if (typeof value === 'object' && value !== null && typeof recorded[key] === 'object' && recorded[key] !== null) {
        // For objects, do a shallow comparison
        const recordedObj = recorded[key] as Record<string, unknown>;
        const filterObj = value as Record<string, unknown>;

        for (const [objKey, objValue] of Object.entries(filterObj)) {
          if (recordedObj[objKey] !== objValue) {
            return false;
          }
        }
      } else if (recorded[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get statistics about recorded tool invocations
   *
   * @returns Statistics object with counts and analysis
   */
  getStats(): ToolInvocationStats {
    const totalInvocations = this.records.length;
    const executions = this.records.filter(r => r.execution);

    const successfulExecutions = executions.filter(r => r.execution!.status === 'completed').length;
    const failedExecutions = executions.filter(r => r.execution!.status === 'failed').length;
    const runningExecutions = executions.filter(r => r.execution!.status === 'running').length;

    // Calculate top tools
    const toolCounts = new Map<string, number>();
    this.records.forEach(r => {
      const count = toolCounts.get(r.invocation.toolName) || 0;
      toolCounts.set(r.invocation.toolName, count + 1);
    });

    const topTools = Array.from(toolCounts.entries())
      .map(([toolName, count]) => ({ toolName, count }))
      .sort((a, b) => b.count - a.count);

    // Calculate average duration for completed executions
    const completedExecutions = executions.filter(r =>
      r.execution!.status === 'completed' && r.execution!.duration !== undefined
    );

    const averageDuration = completedExecutions.length > 0
      ? completedExecutions.reduce((sum, r) => sum + r.execution!.duration!, 0) / completedExecutions.length
      : undefined;

    return {
      totalInvocations,
      successfulExecutions,
      failedExecutions,
      runningExecutions,
      topTools,
      averageDuration,
    };
  }

  /**
   * Get all recorded invocations for a specific tool name
   *
   * @param toolName - Name of the tool to get invocations for
   * @returns Array of invocation records for the specified tool
   */
  getInvocationsForTool(toolName: string): ToolInvocationRecord[] {
    return this.queryInvocations({ toolName });
  }

  /**
   * Get invocations within a specific time range
   *
   * @param startTime - Start of the time range
   * @param endTime - End of the time range
   * @returns Array of invocation records within the time range
   */
  getInvocationsInTimeRange(startTime: Date, endTime: Date): ToolInvocationRecord[] {
    return this.queryInvocations({ startTime, endTime });
  }

  /**
   * Get invocations that match specific parameters
   *
   * @param parameters - Parameters to match against
   * @returns Array of invocation records with matching parameters
   */
  getInvocationsWithParameters(parameters: Record<string, unknown>): ToolInvocationRecord[] {
    return this.queryInvocations({ parameters });
  }

  /**
   * Check if any invocations have been recorded
   *
   * @returns True if there are recorded invocations, false otherwise
   */
  hasInvocations(): boolean {
    return this.records.length > 0;
  }

  /**
   * Get the total number of recorded invocations
   *
   * @returns Number of recorded invocations
   */
  getInvocationCount(): number {
    return this.records.length;
  }

  /**
   * Get the most recent invocation record
   *
   * @returns The most recently recorded invocation, or undefined if none exist
   */
  getLatestInvocation(): ToolInvocationRecord | undefined {
    return this.records[this.records.length - 1];
  }

  /**
   * Clear all recorded invocations
   *
   * This method is particularly useful for tests to reset the recorder state
   * between test cases.
   */
  clear(): void {
    this.records = [];
  }

  /**
   * Reset the recorder to initial state
   *
   * Alias for clear() to provide semantic clarity in different contexts
   */
  reset(): void {
    this.clear();
  }

  /**
   * Get a copy of all recorded invocation records
   *
   * @returns Array of all recorded invocation records (defensive copy)
   */
  getAllInvocations(): ToolInvocationRecord[] {
    return [...this.records];
  }
}

/**
 * Singleton instance of ToolInvocationRecorder for global use
 *
 * This can be used across the application to record tool invocations
 * without needing to pass the recorder instance around.
 *
 * @example
 * ```typescript
 * import { globalRecorder } from './tool-invocation-recorder';
 *
 * // Record invocation
 * globalRecorder.recordInvocation(invocation);
 *
 * // Query invocations
 * const results = globalRecorder.queryInvocations({ toolName: 'Read' });
 * ```
 */
export const globalRecorder = new ToolInvocationRecorder();