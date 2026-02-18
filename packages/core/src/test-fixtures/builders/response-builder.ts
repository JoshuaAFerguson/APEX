/**
 * @fileoverview Response Builder Classes
 *
 * Fluent builders for creating complex response fixtures.
 * Follows the builder pattern established in MockResponseBuilder from claude-agent-sdk.ts
 */

import type { ToolResult, ToolExecution } from '../../types.js';
import type { FluentBuilder, ToolResponseOptions } from '../types.js';

/**
 * Builder class for creating ToolResult fixtures with fluent API
 */
export class ToolResponseBuilder implements FluentBuilder<ToolResult> {
  private response: Partial<ToolResult> = {
    success: true,
  };

  /**
   * Create a new ToolResponseBuilder instance
   */
  static create(): ToolResponseBuilder {
    return new ToolResponseBuilder();
  }

  /**
   * Set the success state of the tool result
   */
  withSuccess(success: boolean): this {
    this.response.success = success;
    return this;
  }

  /**
   * Set the tool output data
   */
  withOutput(output: unknown): this {
    this.response.output = output;
    return this;
  }

  /**
   * Set an error message (automatically sets success to false)
   */
  withError(error: string): this {
    this.response.error = error;
    this.response.success = false;
    return this;
  }

  /**
   * Set the execution duration in milliseconds
   */
  withDuration(duration: number): this {
    this.response.duration = duration;
    return this;
  }

  /**
   * Set the tool name that was executed
   */
  withToolName(toolName: string): this {
    this.response.toolName = toolName;
    return this;
  }

  /**
   * Set the invocation timestamp
   */
  withInvokedAt(timestamp: Date): this {
    this.response.invokedAt = timestamp;
    return this;
  }

  /**
   * Set the completion timestamp
   */
  withCompletedAt(timestamp: Date): this {
    this.response.completedAt = timestamp;
    return this;
  }

  /**
   * Set both invocation and completion timestamps with automatic duration calculation
   */
  withTimestamps(invokedAt: Date, completedAt: Date): this {
    this.response.invokedAt = invokedAt;
    this.response.completedAt = completedAt;
    this.response.duration = completedAt.getTime() - invokedAt.getTime();
    return this;
  }

  /**
   * Set metadata for the tool result
   */
  withMetadata(metadata: Record<string, unknown>): this {
    this.response.metadata = { ...this.response.metadata, ...metadata };
    return this;
  }

  /**
   * Add a single metadata key-value pair
   */
  addMetadata(key: string, value: unknown): this {
    if (!this.response.metadata) {
      this.response.metadata = {};
    }
    this.response.metadata[key] = value;
    return this;
  }

  /**
   * Configure the response to simulate a successful file read
   */
  asFileRead(content: string, path?: string): this {
    return this.withToolName('Read')
      .withSuccess(true)
      .withOutput({
        content,
        encoding: 'utf-8',
        size: content.length,
        ...(path && { path }),
      })
      .withDuration(Math.random() * 100 + 50);
  }

  /**
   * Configure the response to simulate a successful file write
   */
  asFileWrite(path: string, size?: number): this {
    return this.withToolName('Write')
      .withSuccess(true)
      .withOutput({
        written: true,
        path,
        size: size ?? 1024,
      })
      .withDuration(Math.random() * 200 + 100);
  }

  /**
   * Configure the response to simulate a successful bash command
   */
  asBashExecution(command: string, stdout: string, exitCode: number = 0): this {
    return this.withToolName('Bash')
      .withSuccess(exitCode === 0)
      .withOutput({
        stdout,
        stderr: '',
        exitCode,
        command,
      })
      .withDuration(Math.random() * 1000 + 200);
  }

  /**
   * Configure the response to simulate a glob pattern match
   */
  asGlobResult(pattern: string, matches: string[]): this {
    return this.withToolName('Glob')
      .withSuccess(true)
      .withOutput({
        matches,
        pattern,
        count: matches.length,
      })
      .withDuration(Math.random() * 300 + 100);
  }

  /**
   * Configure the response to simulate a grep search
   */
  asGrepResult(pattern: string, matches: Array<{file: string, line: number, content: string}>): this {
    return this.withToolName('Grep')
      .withSuccess(true)
      .withOutput({
        matches,
        pattern,
        totalMatches: matches.length,
      })
      .withDuration(Math.random() * 500 + 200);
  }

  /**
   * Configure the response to simulate a web fetch
   */
  asWebFetch(url: string, content: string, statusCode: number = 200): this {
    return this.withToolName('WebFetch')
      .withSuccess(statusCode < 400)
      .withOutput({
        content,
        statusCode,
        url,
        contentType: 'text/html',
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'content-length': content.length.toString(),
        },
      })
      .withDuration(Math.random() * 2000 + 500);
  }

  /**
   * Clone the current builder state
   */
  clone(): this {
    const cloned = new ToolResponseBuilder() as this;
    cloned.response = { ...this.response };
    if (this.response.metadata) {
      cloned.response.metadata = { ...this.response.metadata };
    }
    return cloned;
  }

  /**
   * Reset the builder to default state
   */
  reset(): this {
    this.response = { success: true };
    return this;
  }

  /**
   * Build the final ToolResult object
   */
  build(): ToolResult {
    const now = new Date();
    const duration = this.response.duration ?? Math.floor(Math.random() * 1000) + 100;

    return {
      success: true,
      invokedAt: new Date(now.getTime() - duration),
      completedAt: now,
      duration,
      ...this.response,
    };
  }
}

/**
 * Builder class for creating ToolExecution fixtures
 */
export class ToolExecutionBuilder implements FluentBuilder<ToolExecution> {
  private execution: Partial<ToolExecution> = {
    status: 'completed',
  };

  /**
   * Create a new ToolExecutionBuilder instance
   */
  static create(): ToolExecutionBuilder {
    return new ToolExecutionBuilder();
  }

  /**
   * Set the call ID
   */
  withCallId(callId: string): this {
    this.execution.callId = callId;
    return this;
  }

  /**
   * Set the tool name
   */
  withToolName(toolName: string): this {
    this.execution.toolName = toolName;
    return this;
  }

  /**
   * Set the input parameters
   */
  withInput(input: Record<string, unknown>): this {
    this.execution.input = { ...this.execution.input, ...input };
    return this;
  }

  /**
   * Add a single input parameter
   */
  addInput(key: string, value: unknown): this {
    if (!this.execution.input) {
      this.execution.input = {};
    }
    this.execution.input[key] = value;
    return this;
  }

  /**
   * Set the task ID
   */
  withTaskId(taskId: string): this {
    this.execution.taskId = taskId;
    return this;
  }

  /**
   * Set the agent name
   */
  withAgentName(agentName: string): this {
    this.execution.agentName = agentName;
    return this;
  }

  /**
   * Set the stage name
   */
  withStageName(stageName: string): this {
    this.execution.stageName = stageName;
    return this;
  }

  /**
   * Set the start time
   */
  withStartTime(startTime: Date): this {
    this.execution.startTime = startTime;
    return this;
  }

  /**
   * Set the end time
   */
  withEndTime(endTime: Date): this {
    this.execution.endTime = endTime;
    if (this.execution.startTime) {
      this.execution.duration = endTime.getTime() - this.execution.startTime.getTime();
    }
    return this;
  }

  /**
   * Set the execution status
   */
  withStatus(status: 'running' | 'completed' | 'failed'): this {
    this.execution.status = status;
    return this;
  }

  /**
   * Set the execution result
   */
  withResult(success: boolean, output?: unknown, error?: string): this {
    this.execution.result = {
      success,
      ...(output !== undefined && { output }),
      ...(error && { error }),
    };
    return this;
  }

  /**
   * Set a successful result
   */
  withSuccessResult(output: unknown): this {
    return this.withResult(true, output);
  }

  /**
   * Set a failed result
   */
  withFailureResult(error: string): this {
    this.execution.error = error;
    return this.withResult(false, undefined, error).withStatus('failed');
  }

  /**
   * Set the execution as running (no end time or result)
   */
  asRunning(): this {
    this.execution.status = 'running';
    this.execution.endTime = undefined;
    this.execution.duration = undefined;
    this.execution.result = undefined;
    return this;
  }

  /**
   * Set metadata for the execution
   */
  withMetadata(metadata: Record<string, unknown>): this {
    this.execution.metadata = { ...this.execution.metadata, ...metadata };
    return this;
  }

  /**
   * Add a single metadata key-value pair
   */
  addMetadata(key: string, value: unknown): this {
    if (!this.execution.metadata) {
      this.execution.metadata = {};
    }
    this.execution.metadata[key] = value;
    return this;
  }

  /**
   * Configure as a file read execution
   */
  asFileReadExecution(filePath: string, success: boolean = true): this {
    return this.withToolName('Read')
      .addInput('file_path', filePath)
      .withResult(success, success ? { content: 'File content' } : undefined, success ? undefined : 'File not found');
  }

  /**
   * Configure as a bash execution
   */
  asBashExecution(command: string, exitCode: number = 0): this {
    const success = exitCode === 0;
    return this.withToolName('Bash')
      .addInput('command', command)
      .withResult(success, { exitCode, stdout: success ? 'Command executed' : '', stderr: success ? '' : 'Command failed' });
  }

  /**
   * Clone the current builder state
   */
  clone(): this {
    const cloned = new ToolExecutionBuilder() as this;
    cloned.execution = { ...this.execution };
    if (this.execution.input) {
      cloned.execution.input = { ...this.execution.input };
    }
    if (this.execution.result) {
      cloned.execution.result = { ...this.execution.result };
    }
    if (this.execution.metadata) {
      cloned.execution.metadata = { ...this.execution.metadata };
    }
    return cloned;
  }

  /**
   * Reset the builder to default state
   */
  reset(): this {
    this.execution = { status: 'completed' };
    return this;
  }

  /**
   * Build the final ToolExecution object
   */
  build(): ToolExecution {
    const now = new Date();
    const duration = Math.floor(Math.random() * 1000) + 100;
    const callId = this.execution.callId ?? `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      callId,
      toolName: 'TestTool',
      input: {},
      taskId: `task-${Date.now()}`,
      agentName: 'test-agent',
      stageName: 'test-stage',
      startTime: new Date(now.getTime() - duration),
      endTime: now,
      duration,
      status: 'completed',
      result: { success: true, output: 'Test output' },
      ...this.execution,
    };
  }
}

/**
 * Convenience factory methods for common response patterns
 */
export const ResponseBuilders = {
  /** Create a successful tool response */
  success: (toolName: string, output: unknown) =>
    ToolResponseBuilder.create().withToolName(toolName).withOutput(output),

  /** Create a failed tool response */
  failure: (toolName: string, error: string) =>
    ToolResponseBuilder.create().withToolName(toolName).withError(error),

  /** Create a file read response */
  fileRead: (content: string, path?: string) =>
    ToolResponseBuilder.create().asFileRead(content, path),

  /** Create a file write response */
  fileWrite: (path: string, size?: number) =>
    ToolResponseBuilder.create().asFileWrite(path, size),

  /** Create a bash execution response */
  bash: (command: string, stdout: string, exitCode?: number) =>
    ToolResponseBuilder.create().asBashExecution(command, stdout, exitCode),

  /** Create a glob result response */
  glob: (pattern: string, matches: string[]) =>
    ToolResponseBuilder.create().asGlobResult(pattern, matches),

  /** Create a grep result response */
  grep: (pattern: string, matches: Array<{file: string, line: number, content: string}>) =>
    ToolResponseBuilder.create().asGrepResult(pattern, matches),

  /** Create a web fetch response */
  webFetch: (url: string, content: string, statusCode?: number) =>
    ToolResponseBuilder.create().asWebFetch(url, content, statusCode),
} as const;

/**
 * Convenience factory methods for tool executions
 */
export const ExecutionBuilders = {
  /** Create a completed execution */
  completed: (toolName: string, input: Record<string, unknown>, output: unknown) =>
    ToolExecutionBuilder.create()
      .withToolName(toolName)
      .withInput(input)
      .withSuccessResult(output),

  /** Create a failed execution */
  failed: (toolName: string, input: Record<string, unknown>, error: string) =>
    ToolExecutionBuilder.create()
      .withToolName(toolName)
      .withInput(input)
      .withFailureResult(error),

  /** Create a running execution */
  running: (toolName: string, input: Record<string, unknown>) =>
    ToolExecutionBuilder.create()
      .withToolName(toolName)
      .withInput(input)
      .asRunning(),

  /** Create a file read execution */
  fileRead: (filePath: string, success?: boolean) =>
    ToolExecutionBuilder.create().asFileReadExecution(filePath, success),

  /** Create a bash execution */
  bash: (command: string, exitCode?: number) =>
    ToolExecutionBuilder.create().asBashExecution(command, exitCode),
} as const;