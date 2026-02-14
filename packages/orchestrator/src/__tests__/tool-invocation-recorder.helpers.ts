import {
  ToolInvocationRecorder,
  ToolInvocationRecord,
  ToolInvocationQueryOptions,
} from '../tool-invocation-recorder.js';
import { ToolInvocation, ToolExecution } from '@apexcli/core';

/**
 * Test utilities and helpers for ToolInvocationRecorder testing
 *
 * Provides convenient factory methods, assertions, and complex scenario builders
 * for comprehensive testing of the ToolInvocationRecorder.
 */

export interface InvocationBuilder {
  withTool(toolName: string): InvocationBuilder;
  withParams(parameters: Record<string, unknown>): InvocationBuilder;
  withContext(context: Partial<ToolInvocation['context']>): InvocationBuilder;
  withRequestId(requestId: string): InvocationBuilder;
  build(): ToolInvocation;
}

export interface ExecutionBuilder {
  withCallId(callId: string): ExecutionBuilder;
  withStatus(status: 'running' | 'completed' | 'failed'): ExecutionBuilder;
  withDuration(duration: number): ExecutionBuilder;
  withResult(result: unknown): ExecutionBuilder;
  withError(error: string): ExecutionBuilder;
  build(): ToolExecution;
}

export interface WorkflowBuilder {
  addStage(stageName: string): StageBuilder;
  withAgent(agentName: string): WorkflowBuilder;
  withTask(taskId: string): WorkflowBuilder;
  execute(recorder: ToolInvocationRecorder): WorkflowExecution;
}

export interface StageBuilder {
  addInvocation(toolName: string, parameters?: Record<string, unknown>): StageBuilder;
  addExecution(callId: string, status: 'running' | 'completed' | 'failed', result?: unknown): StageBuilder;
  nextStage(stageName: string): StageBuilder;
  complete(): WorkflowBuilder;
}

export interface WorkflowExecution {
  invocations: ToolInvocationRecord[];
  getStageInvocations(stageName: string): ToolInvocationRecord[];
  getToolInvocations(toolName: string): ToolInvocationRecord[];
  getFailedInvocations(): ToolInvocationRecord[];
  getCompletedInvocations(): ToolInvocationRecord[];
  getStats(): {
    totalInvocations: number;
    stageBreakdown: Record<string, number>;
    toolBreakdown: Record<string, number>;
    statusBreakdown: Record<string, number>;
  };
}

/**
 * Factory for creating test invocations
 */
export class InvocationFactory {
  static builder(): InvocationBuilder {
    return new InvocationBuilderImpl();
  }

  static read(filePath: string, context?: Partial<ToolInvocation['context']>): ToolInvocation {
    return this.builder()
      .withTool('Read')
      .withParams({ file_path: filePath })
      .withContext(context || {})
      .build();
  }

  static write(filePath: string, content: string, context?: Partial<ToolInvocation['context']>): ToolInvocation {
    return this.builder()
      .withTool('Write')
      .withParams({ file_path: filePath, content })
      .withContext(context || {})
      .build();
  }

  static edit(filePath: string, oldString: string, newString: string, context?: Partial<ToolInvocation['context']>): ToolInvocation {
    return this.builder()
      .withTool('Edit')
      .withParams({ file_path: filePath, old_string: oldString, new_string: newString })
      .withContext(context || {})
      .build();
  }

  static glob(pattern: string, path?: string, context?: Partial<ToolInvocation['context']>): ToolInvocation {
    const params: Record<string, unknown> = { pattern };
    if (path) params.path = path;

    return this.builder()
      .withTool('Glob')
      .withParams(params)
      .withContext(context || {})
      .build();
  }

  static grep(pattern: string, options?: Record<string, unknown>, context?: Partial<ToolInvocation['context']>): ToolInvocation {
    return this.builder()
      .withTool('Grep')
      .withParams({ pattern, ...options })
      .withContext(context || {})
      .build();
  }

  static bash(command: string, context?: Partial<ToolInvocation['context']>): ToolInvocation {
    return this.builder()
      .withTool('Bash')
      .withParams({ command })
      .withContext(context || {})
      .build();
  }

  static custom(toolName: string, parameters: Record<string, unknown>, context?: Partial<ToolInvocation['context']>): ToolInvocation {
    return this.builder()
      .withTool(toolName)
      .withParams(parameters)
      .withContext(context || {})
      .build();
  }
}

/**
 * Factory for creating test executions
 */
export class ExecutionFactory {
  static builder(toolName: string): ExecutionBuilder {
    return new ExecutionBuilderImpl(toolName);
  }

  static completed(toolName: string, result: unknown, duration?: number): ToolExecution {
    return this.builder(toolName)
      .withStatus('completed')
      .withResult(result)
      .withDuration(duration || 100)
      .build();
  }

  static failed(toolName: string, error: string, duration?: number): ToolExecution {
    return this.builder(toolName)
      .withStatus('failed')
      .withError(error)
      .withDuration(duration || 50)
      .build();
  }

  static running(toolName: string): ToolExecution {
    return this.builder(toolName)
      .withStatus('running')
      .build();
  }
}

/**
 * Factory for creating complex test workflows
 */
export class WorkflowFactory {
  static builder(): WorkflowBuilder {
    return new WorkflowBuilderImpl();
  }

  static developmentWorkflow(taskId: string = 'dev-task'): WorkflowBuilder {
    return this.builder()
      .withTask(taskId)
      .withAgent('developer')
      .addStage('planning')
        .addInvocation('Glob', { pattern: 'src/**/*.ts' })
        .addInvocation('Read', { file_path: 'package.json' })
        .addInvocation('Grep', { pattern: 'TODO|FIXME' })
        .nextStage('implementation')
        .addInvocation('Read', { file_path: 'src/main.ts' })
        .addInvocation('Edit', { file_path: 'src/main.ts', old_string: 'old', new_string: 'new' })
        .addInvocation('Write', { file_path: 'src/feature.ts', content: 'feature implementation' })
        .nextStage('testing')
        .addInvocation('Write', { file_path: 'src/feature.test.ts', content: 'test implementation' })
        .addInvocation('Bash', { command: 'npm test' })
        .complete();
  }

  static reviewWorkflow(taskId: string = 'review-task'): WorkflowBuilder {
    return this.builder()
      .withTask(taskId)
      .withAgent('reviewer')
      .addStage('review')
        .addInvocation('Read', { file_path: 'src/changes.ts' })
        .addInvocation('Grep', { pattern: 'console\\.log' })
        .addInvocation('Read', { file_path: 'src/test.ts' })
        .complete();
  }

  static bugfixWorkflow(taskId: string = 'bugfix-task'): WorkflowBuilder {
    return this.builder()
      .withTask(taskId)
      .withAgent('developer')
      .addStage('investigation')
        .addInvocation('Read', { file_path: 'src/buggy.ts' })
        .addInvocation('Bash', { command: 'npm test -- --verbose' })
        .addInvocation('Grep', { pattern: 'error|exception' })
        .nextStage('fixing')
        .addInvocation('Edit', { file_path: 'src/buggy.ts', old_string: 'buggy', new_string: 'fixed' })
        .addInvocation('Bash', { command: 'npm test' })
        .complete();
  }
}

/**
 * Advanced assertions for testing scenarios
 */
export class RecorderAssertions {
  constructor(private recorder: ToolInvocationRecorder) {}

  static for(recorder: ToolInvocationRecorder): RecorderAssertions {
    return new RecorderAssertions(recorder);
  }

  expectInvocationCount(expected: number): RecorderAssertions {
    expect(this.recorder.getInvocationCount()).toBe(expected);
    return this;
  }

  expectToolUsage(toolName: string, expectedCount: number): RecorderAssertions {
    const toolInvocations = this.recorder.getInvocationsForTool(toolName);
    expect(toolInvocations).toHaveLength(expectedCount);
    return this;
  }

  expectStageCompletion(stageName: string, expectedCount: number): RecorderAssertions {
    const stageInvocations = this.recorder.queryInvocations({ stageName });
    expect(stageInvocations).toHaveLength(expectedCount);
    return this;
  }

  expectAllExecutionsSuccessful(): RecorderAssertions {
    const stats = this.recorder.getStats();
    expect(stats.failedExecutions).toBe(0);
    expect(stats.runningExecutions).toBe(0);
    expect(stats.successfulExecutions).toBeGreaterThan(0);
    return this;
  }

  expectExecutionStats(expected: { completed?: number; failed?: number; running?: number }): RecorderAssertions {
    const stats = this.recorder.getStats();
    if (expected.completed !== undefined) {
      expect(stats.successfulExecutions).toBe(expected.completed);
    }
    if (expected.failed !== undefined) {
      expect(stats.failedExecutions).toBe(expected.failed);
    }
    if (expected.running !== undefined) {
      expect(stats.runningExecutions).toBe(expected.running);
    }
    return this;
  }

  expectWorkflowPattern(pattern: string[]): RecorderAssertions {
    const invocations = this.recorder.getAllInvocations();
    const actualPattern = invocations.map(inv => inv.invocation.toolName);
    expect(actualPattern).toEqual(pattern);
    return this;
  }

  expectChronologicalOrder(): RecorderAssertions {
    const invocations = this.recorder.getAllInvocations();
    for (let i = 1; i < invocations.length; i++) {
      expect(invocations[i].recordedAt.getTime())
        .toBeGreaterThanOrEqual(invocations[i - 1].recordedAt.getTime());
    }
    return this;
  }

  expectQueryResults(query: ToolInvocationQueryOptions, expectedCount: number): RecorderAssertions {
    const results = this.recorder.queryInvocations(query);
    expect(results).toHaveLength(expectedCount);
    return this;
  }
}

/**
 * Performance measurement utilities
 */
export class PerformanceProfiler {
  private measurements: Map<string, number[]> = new Map();

  measureOperation<T>(name: string, operation: () => T): T {
    const start = performance.now();
    const result = operation();
    const duration = performance.now() - start;

    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);

    return result;
  }

  async measureAsyncOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await operation();
    const duration = performance.now() - start;

    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);

    return result;
  }

  getStats(operationName: string): { min: number; max: number; avg: number; total: number; count: number } | null {
    const measurements = this.measurements.get(operationName);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    return {
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      avg: measurements.reduce((sum, val) => sum + val, 0) / measurements.length,
      total: measurements.reduce((sum, val) => sum + val, 0),
      count: measurements.length,
    };
  }

  getAllStats(): Record<string, ReturnType<typeof this.getStats>> {
    const stats: Record<string, ReturnType<typeof this.getStats>> = {};
    for (const [name] of this.measurements) {
      stats[name] = this.getStats(name);
    }
    return stats;
  }

  clear(): void {
    this.measurements.clear();
  }

  report(): string {
    const allStats = this.getAllStats();
    const lines = ['Performance Report:', '================'];

    for (const [name, stats] of Object.entries(allStats)) {
      if (stats) {
        lines.push(`${name}:`);
        lines.push(`  Count: ${stats.count}`);
        lines.push(`  Total: ${stats.total.toFixed(2)}ms`);
        lines.push(`  Average: ${stats.avg.toFixed(2)}ms`);
        lines.push(`  Min: ${stats.min.toFixed(2)}ms`);
        lines.push(`  Max: ${stats.max.toFixed(2)}ms`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}

// Implementation classes (private)

class InvocationBuilderImpl implements InvocationBuilder {
  private invocation: Partial<ToolInvocation> = {};

  withTool(toolName: string): InvocationBuilder {
    this.invocation.toolName = toolName;
    return this;
  }

  withParams(parameters: Record<string, unknown>): InvocationBuilder {
    this.invocation.parameters = parameters;
    return this;
  }

  withContext(context: Partial<ToolInvocation['context']>): InvocationBuilder {
    this.invocation.context = { ...this.invocation.context, ...context };
    return this;
  }

  withRequestId(requestId: string): InvocationBuilder {
    this.invocation.requestId = requestId;
    return this;
  }

  build(): ToolInvocation {
    if (!this.invocation.toolName) {
      throw new Error('Tool name is required');
    }

    return {
      toolName: this.invocation.toolName,
      parameters: this.invocation.parameters || {},
      context: this.invocation.context,
      requestId: this.invocation.requestId,
    };
  }
}

class ExecutionBuilderImpl implements ExecutionBuilder {
  private execution: Partial<ToolExecution>;

  constructor(toolName: string) {
    this.execution = {
      toolName,
      callId: `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      input: {},
      startTime: new Date(),
    };
  }

  withCallId(callId: string): ExecutionBuilder {
    this.execution.callId = callId;
    return this;
  }

  withStatus(status: 'running' | 'completed' | 'failed'): ExecutionBuilder {
    this.execution.status = status;
    return this;
  }

  withDuration(duration: number): ExecutionBuilder {
    this.execution.duration = duration;
    return this;
  }

  withResult(result: unknown): ExecutionBuilder {
    this.execution.result = result;
    return this;
  }

  withError(error: string): ExecutionBuilder {
    this.execution.error = error;
    return this;
  }

  build(): ToolExecution {
    if (!this.execution.toolName || !this.execution.callId || !this.execution.status) {
      throw new Error('Tool name, call ID, and status are required');
    }

    return this.execution as ToolExecution;
  }
}

class WorkflowBuilderImpl implements WorkflowBuilder {
  private stages: Array<{ name: string; invocations: Array<{ tool: string; params?: Record<string, unknown> }> }> = [];
  private currentStage: { name: string; invocations: Array<{ tool: string; params?: Record<string, unknown> }> } | null = null;
  private agentName: string = 'test-agent';
  private taskId: string = 'test-task';

  withAgent(agentName: string): WorkflowBuilder {
    this.agentName = agentName;
    return this;
  }

  withTask(taskId: string): WorkflowBuilder {
    this.taskId = taskId;
    return this;
  }

  addStage(stageName: string): StageBuilder {
    if (this.currentStage) {
      this.stages.push(this.currentStage);
    }
    this.currentStage = { name: stageName, invocations: [] };
    return new StageBuilderImpl(this, this.currentStage);
  }

  execute(recorder: ToolInvocationRecorder): WorkflowExecution {
    if (this.currentStage) {
      this.stages.push(this.currentStage);
    }

    const allInvocations: ToolInvocationRecord[] = [];

    for (const stage of this.stages) {
      for (const inv of stage.invocations) {
        const invocation = InvocationFactory.custom(inv.tool, inv.params || {}, {
          taskId: this.taskId,
          agentName: this.agentName,
          stageName: stage.name,
        });

        const record = recorder.recordInvocation(invocation);
        allInvocations.push(record);
      }
    }

    return new WorkflowExecutionImpl(allInvocations, recorder);
  }
}

class StageBuilderImpl implements StageBuilder {
  constructor(
    private workflow: WorkflowBuilderImpl,
    private stage: { name: string; invocations: Array<{ tool: string; params?: Record<string, unknown> }> }
  ) {}

  addInvocation(toolName: string, parameters?: Record<string, unknown>): StageBuilder {
    this.stage.invocations.push({ tool: toolName, params: parameters });
    return this;
  }

  addExecution(callId: string, status: 'running' | 'completed' | 'failed', result?: unknown): StageBuilder {
    // Execution adding would be handled during workflow execution
    return this;
  }

  nextStage(stageName: string): StageBuilder {
    return this.workflow.addStage(stageName);
  }

  complete(): WorkflowBuilder {
    return this.workflow;
  }
}

class WorkflowExecutionImpl implements WorkflowExecution {
  constructor(
    public invocations: ToolInvocationRecord[],
    private recorder: ToolInvocationRecorder
  ) {}

  getStageInvocations(stageName: string): ToolInvocationRecord[] {
    return this.invocations.filter(inv => inv.invocation.context?.stageName === stageName);
  }

  getToolInvocations(toolName: string): ToolInvocationRecord[] {
    return this.invocations.filter(inv => inv.invocation.toolName === toolName);
  }

  getFailedInvocations(): ToolInvocationRecord[] {
    return this.invocations.filter(inv => inv.execution?.status === 'failed');
  }

  getCompletedInvocations(): ToolInvocationRecord[] {
    return this.invocations.filter(inv => inv.execution?.status === 'completed');
  }

  getStats(): {
    totalInvocations: number;
    stageBreakdown: Record<string, number>;
    toolBreakdown: Record<string, number>;
    statusBreakdown: Record<string, number>;
  } {
    const stageBreakdown: Record<string, number> = {};
    const toolBreakdown: Record<string, number> = {};
    const statusBreakdown: Record<string, number> = {};

    for (const inv of this.invocations) {
      // Stage breakdown
      const stageName = inv.invocation.context?.stageName || 'unknown';
      stageBreakdown[stageName] = (stageBreakdown[stageName] || 0) + 1;

      // Tool breakdown
      const toolName = inv.invocation.toolName;
      toolBreakdown[toolName] = (toolBreakdown[toolName] || 0) + 1;

      // Status breakdown
      const status = inv.execution?.status || 'no-execution';
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    }

    return {
      totalInvocations: this.invocations.length,
      stageBreakdown,
      toolBreakdown,
      statusBreakdown,
    };
  }
}