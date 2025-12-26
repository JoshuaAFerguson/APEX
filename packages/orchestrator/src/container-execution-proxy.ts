/**
 * ContainerExecutionProxy - Routes command execution through container when configured
 *
 * This proxy transparently routes command execution either through containerManager.execCommand()
 * when a container workspace is active, or falls back to local execution for non-container workspaces.
 *
 * @module orchestrator/container-execution-proxy
 */

import { EventEmitter } from 'eventemitter3';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  ContainerManager,
  ExecCommandOptions,
  ExecCommandResult,
  ContainerRuntimeType,
} from '@apexcli/core';

const execAsync = promisify(exec);

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Execution context for command routing decisions
 */
export interface ExecutionContext {
  /** Task ID for tracking and logging */
  taskId: string;
  /** Container ID if container workspace is active */
  containerId?: string;
  /** Working directory for command execution */
  workingDir?: string;
  /** Container runtime type (docker/podman) */
  runtimeType?: ContainerRuntimeType;
  /** Whether container workspace is active */
  isContainerWorkspace: boolean;
}

/**
 * Options for command execution
 */
export interface CommandExecutionOptions {
  /** Timeout in milliseconds (default: 30000ms) */
  timeout?: number;
  /** Working directory override */
  workingDir?: string;
  /** Environment variables */
  environment?: Record<string, string>;
  /** User to run command as (container only) */
  user?: string;
}

/**
 * Result of command execution
 * Unified interface for both container and local execution
 */
export interface CommandExecutionResult {
  /** Whether command executed successfully */
  success: boolean;
  /** Standard output from command */
  stdout: string;
  /** Standard error from command */
  stderr: string;
  /** Exit code (0 = success) */
  exitCode: number;
  /** Error message if execution failed */
  error?: string;
  /** Full command that was executed */
  command?: string;
  /** Duration of execution in milliseconds */
  duration: number;
  /** Execution mode used */
  mode: 'container' | 'local';
}

/**
 * Events emitted by ContainerExecutionProxy
 */
export interface ContainerExecutionProxyEvents {
  /** Emitted when command execution starts */
  'execution:started': (event: ExecutionStartedEvent) => void;
  /** Emitted when command execution completes successfully */
  'execution:completed': (event: ExecutionCompletedEvent) => void;
  /** Emitted when command execution fails */
  'execution:failed': (event: ExecutionFailedEvent) => void;
  /** Emitted when a command is blocked by security policy */
  'command:blocked': (event: CommandBlockedEvent) => void;
}

/**
 * Event data for execution started
 */
export interface ExecutionStartedEvent {
  taskId: string;
  command: string;
  mode: 'container' | 'local';
  containerId?: string;
  workingDir?: string;
  timestamp: Date;
}

/**
 * Event data for execution completed
 */
export interface ExecutionCompletedEvent {
  taskId: string;
  command: string;
  mode: 'container' | 'local';
  containerId?: string;
  result: CommandExecutionResult;
  timestamp: Date;
}

/**
 * Event data for execution failed
 */
export interface ExecutionFailedEvent {
  taskId: string;
  command: string;
  mode: 'container' | 'local';
  containerId?: string;
  error: string;
  exitCode: number;
  timestamp: Date;
}

/**
 * Event data for command blocked
 */
export interface CommandBlockedEvent {
  taskId: string;
  command: string;
  reason: string;
  timestamp: Date;
}

// ============================================================================
// ContainerExecutionProxy Class
// ============================================================================

/**
 * ContainerExecutionProxy - Routes commands through container or local execution
 *
 * This class provides a unified interface for command execution that automatically
 * routes commands through the container runtime when a container workspace is active,
 * or falls back to local execution for non-container workspaces.
 *
 * @example
 * ```typescript
 * const proxy = new ContainerExecutionProxy(containerManager);
 *
 * // Set up context for container workspace
 * const context: ExecutionContext = {
 *   taskId: 'task-123',
 *   containerId: 'abc123',
 *   isContainerWorkspace: true,
 *   runtimeType: 'docker',
 * };
 *
 * // Execute command - routed through container
 * const result = await proxy.execute('npm install', context, { timeout: 60000 });
 * ```
 */
export class ContainerExecutionProxy extends EventEmitter<ContainerExecutionProxyEvents> {
  private containerManager: ContainerManager;
  private defaultTimeout: number;

  /**
   * Create a new ContainerExecutionProxy
   *
   * @param containerManager - ContainerManager instance for container execution
   * @param options - Configuration options
   */
  constructor(
    containerManager: ContainerManager,
    options: {
      /** Default timeout for command execution in milliseconds (default: 30000) */
      defaultTimeout?: number;
    } = {}
  ) {
    super();
    this.containerManager = containerManager;
    this.defaultTimeout = options.defaultTimeout ?? 30000;
  }

  /**
   * Execute a command with automatic routing based on execution context
   *
   * When context.isContainerWorkspace is true and context.containerId is set,
   * the command is executed inside the container. Otherwise, it falls back
   * to local execution.
   *
   * @param command - Command string or array of command parts
   * @param context - Execution context for routing decisions
   * @param options - Execution options
   * @returns Promise resolving to execution result
   *
   * @example
   * ```typescript
   * // Container execution
   * const result = await proxy.execute('npm test', {
   *   taskId: 'task-123',
   *   containerId: 'abc123',
   *   isContainerWorkspace: true,
   *   runtimeType: 'docker',
   * });
   *
   * // Local execution (fallback)
   * const localResult = await proxy.execute('ls -la', {
   *   taskId: 'task-456',
   *   isContainerWorkspace: false,
   * });
   * ```
   */
  async execute(
    command: string | string[],
    context: ExecutionContext,
    options: CommandExecutionOptions = {}
  ): Promise<CommandExecutionResult> {
    const startTime = Date.now();
    const timeout = options.timeout ?? this.defaultTimeout;
    const commandStr = Array.isArray(command) ? command.join(' ') : command;
    const mode = this.determineExecutionMode(context);

    // Emit started event
    this.emit('execution:started', {
      taskId: context.taskId,
      command: commandStr,
      mode,
      containerId: context.containerId,
      workingDir: options.workingDir ?? context.workingDir,
      timestamp: new Date(),
    });

    try {
      let result: CommandExecutionResult;

      if (mode === 'container') {
        result = await this.executeInContainer(command, context, options, timeout, startTime);
      } else {
        result = await this.executeLocally(commandStr, options, timeout, startTime);
      }

      // Emit completed or failed event based on result
      if (result.success) {
        this.emit('execution:completed', {
          taskId: context.taskId,
          command: commandStr,
          mode,
          containerId: context.containerId,
          result,
          timestamp: new Date(),
        });
      } else {
        this.emit('execution:failed', {
          taskId: context.taskId,
          command: commandStr,
          mode,
          containerId: context.containerId,
          error: result.error ?? `Command failed with exit code ${result.exitCode}`,
          exitCode: result.exitCode,
          timestamp: new Date(),
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      const result: CommandExecutionResult = {
        success: false,
        stdout: '',
        stderr: '',
        exitCode: 1,
        error: errorMessage,
        command: commandStr,
        duration,
        mode,
      };

      this.emit('execution:failed', {
        taskId: context.taskId,
        command: commandStr,
        mode,
        containerId: context.containerId,
        error: errorMessage,
        exitCode: 1,
        timestamp: new Date(),
      });

      return result;
    }
  }

  /**
   * Determine execution mode based on context
   */
  private determineExecutionMode(context: ExecutionContext): 'container' | 'local' {
    if (context.isContainerWorkspace && context.containerId) {
      return 'container';
    }
    return 'local';
  }

  /**
   * Execute command inside container
   */
  private async executeInContainer(
    command: string | string[],
    context: ExecutionContext,
    options: CommandExecutionOptions,
    timeout: number,
    startTime: number
  ): Promise<CommandExecutionResult> {
    if (!context.containerId) {
      throw new Error('Container ID required for container execution');
    }

    const execOptions: ExecCommandOptions = {
      timeout,
      workingDir: options.workingDir ?? context.workingDir,
      environment: options.environment,
      user: options.user,
    };

    const result: ExecCommandResult = await this.containerManager.execCommand(
      context.containerId,
      command,
      execOptions,
      context.runtimeType
    );

    const duration = Date.now() - startTime;

    return {
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      error: result.error,
      command: result.command,
      duration,
      mode: 'container',
    };
  }

  /**
   * Execute command locally
   */
  private async executeLocally(
    command: string,
    options: CommandExecutionOptions,
    timeout: number,
    startTime: number
  ): Promise<CommandExecutionResult> {
    const execOptions: { timeout: number; cwd?: string; env?: NodeJS.ProcessEnv } = {
      timeout,
    };

    if (options.workingDir) {
      execOptions.cwd = options.workingDir;
    }

    if (options.environment) {
      execOptions.env = { ...process.env, ...options.environment };
    }

    try {
      const { stdout, stderr } = await execAsync(command, execOptions);
      const duration = Date.now() - startTime;

      return {
        success: true,
        stdout: stdout ?? '',
        stderr: stderr ?? '',
        exitCode: 0,
        command,
        duration,
        mode: 'local',
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const execError = error as { code?: number | string; stdout?: string; stderr?: string; message?: string };

      // Check for timeout
      if (execError.code === 'ETIMEDOUT') {
        return {
          success: false,
          stdout: '',
          stderr: '',
          exitCode: 124,
          error: `Command timed out after ${timeout}ms`,
          command,
          duration,
          mode: 'local',
        };
      }

      // Command execution error with exit code
      if (typeof execError.code === 'number') {
        return {
          success: false,
          stdout: execError.stdout ?? '',
          stderr: execError.stderr ?? '',
          exitCode: execError.code,
          command,
          duration,
          mode: 'local',
        };
      }

      // Generic error
      const errorMessage = execError.message ?? String(error);
      return {
        success: false,
        stdout: execError.stdout ?? '',
        stderr: execError.stderr ?? errorMessage,
        exitCode: 1,
        error: `Command execution failed: ${errorMessage}`,
        command,
        duration,
        mode: 'local',
      };
    }
  }

  /**
   * Execute multiple commands sequentially
   *
   * @param commands - Array of commands to execute
   * @param context - Execution context
   * @param options - Execution options applied to all commands
   * @returns Array of execution results
   */
  async executeSequential(
    commands: (string | string[])[],
    context: ExecutionContext,
    options: CommandExecutionOptions = {}
  ): Promise<CommandExecutionResult[]> {
    const results: CommandExecutionResult[] = [];

    for (const command of commands) {
      const result = await this.execute(command, context, options);
      results.push(result);

      // Stop on first failure
      if (!result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * Check if container execution is available for the given context
   *
   * @param context - Execution context to check
   * @returns true if container execution is available
   */
  isContainerExecutionAvailable(context: ExecutionContext): boolean {
    return context.isContainerWorkspace && !!context.containerId;
  }

  /**
   * Get the container manager instance
   *
   * @returns ContainerManager instance
   */
  getContainerManager(): ContainerManager {
    return this.containerManager;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a ContainerExecutionProxy instance
 *
 * @param containerManager - ContainerManager instance
 * @param options - Configuration options
 * @returns ContainerExecutionProxy instance
 */
export function createContainerExecutionProxy(
  containerManager: ContainerManager,
  options?: {
    defaultTimeout?: number;
  }
): ContainerExecutionProxy {
  return new ContainerExecutionProxy(containerManager, options);
}
