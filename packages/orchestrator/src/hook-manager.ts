import { EventEmitter } from 'eventemitter3';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import {
  HookConfig,
  ToolHookConfig,
  ToolHookDefinition,
  PreHookContext,
  PostHookContext,
  PreHookResult,
  PostHookResult,
  PreHookAction,
  BehaviorMode,
  BehaviorEventData,
} from '@apexcli/core';
import { TaskStore } from './store.js';

const execAsync = promisify(exec);

// Type guards for hook results
function isPreHookResult(result: PreHookResult | PostHookResult | null | undefined): result is PreHookResult {
  return result != null && 'action' in result;
}

function isPostHookResult(result: PreHookResult | PostHookResult | null | undefined): result is PostHookResult {
  return result != null && !('action' in result);
}

/**
 * Events emitted by the HookManager during hook execution lifecycle.
 *
 * @interface HookManagerEvents
 * @example
 * ```typescript
 * const hookManager = new HookManager(projectPath, store);
 *
 * hookManager.on('hook:pre:start', (event) => {
 *   console.log(`Pre-hook ${event.hookName} starting for ${event.toolName}`);
 * });
 *
 * hookManager.on('hook:behavior:triggered', (event) => {
 *   console.log(`Behavior mode ${event.behaviorMode} triggered: ${event.reason}`);
 * });
 * ```
 */
export interface HookManagerEvents {
  'hook:pre:start': (event: HookExecutionStartEvent) => void;
  'hook:pre:complete': (event: HookExecutionCompleteEvent) => void;
  'hook:post:start': (event: HookExecutionStartEvent) => void;
  'hook:post:complete': (event: HookExecutionCompleteEvent) => void;
  'hook:behavior:triggered': (event: BehaviorEventData) => void;
}

/**
 * Event data emitted when a hook execution begins.
 *
 * @interface HookExecutionStartEvent
 * @example
 * ```typescript
 * hookManager.on('hook:pre:start', (event: HookExecutionStartEvent) => {
 *   console.log(`Hook ${event.hookName} starting for task ${event.taskId}`);
 * });
 * ```
 */
export interface HookExecutionStartEvent {
  taskId?: string;
  hookName: string;
  hookType: 'pre' | 'post';
  toolName: string;
  timestamp: Date;
}

/**
 * Event data emitted when a hook execution completes.
 *
 * @interface HookExecutionCompleteEvent
 * @example
 * ```typescript
 * hookManager.on('hook:post:complete', (event: HookExecutionCompleteEvent) => {
 *   if (event.success) {
 *     console.log(`Hook completed in ${event.duration}ms`);
 *   } else {
 *     console.error(`Hook failed: ${event.error}`);
 *   }
 * });
 * ```
 */
export interface HookExecutionCompleteEvent {
  taskId?: string;
  hookName: string;
  hookType: 'pre' | 'post';
  toolName: string;
  duration: number;
  success: boolean;
  result?: PreHookResult | PostHookResult;
  error?: string;
  timestamp: Date;
}

export interface HookExecutionResult {
  success: boolean;
  modifiedArgs?: Record<string, unknown>;
  cancelled?: boolean;
  cancelReason?: string;
  cancelResult?: any;
  metadata?: Record<string, unknown>;
  behaviorMode?: BehaviorMode;
  modifiedResult?: any;
  blocked?: boolean;
}

/**
 * Manages lifecycle hooks and tool hooks for the orchestrator.
 *
 * The HookManager provides a flexible hook system for intercepting and modifying
 * tool executions through pre and post-hooks. It supports behavior modes for
 * security enforcement, content redaction, and custom processing workflows.
 *
 * @example
 * ```typescript
 * const hookManager = new HookManager(projectPath, store, lifecycleHooks, toolHookConfig);
 *
 * // Execute pre-hooks before tool execution
 * const preResult = await hookManager.executePreHooks({
 *   toolName: 'bash',
 *   taskId: 'task-123',
 *   arguments: { command: 'ls -la' }
 * });
 *
 * if (preResult.cancelled) {
 *   console.log('Tool execution cancelled by hook');
 *   return;
 * }
 * ```
 */
export class HookManager extends EventEmitter<HookManagerEvents> {
  private lifecycleHooks: HookConfig[] = [];
  private toolHookConfig: ToolHookConfig = { pre: [], post: [], enabled: true, defaultTimeoutMs: 30000 };
  private projectPath: string;
  private store: TaskStore;
  private async addLogIfTask(
    taskId: string | undefined,
    log: Parameters<TaskStore['addLog']>[1]
  ): Promise<void> {
    if (!taskId) {
      return;
    }

    await this.store.addLog(taskId, log);
  }

  constructor(
    projectPath: string,
    store: TaskStore,
    lifecycleHooks: HookConfig[] = [],
    toolHookConfig: ToolHookConfig = { pre: [], post: [], enabled: true, defaultTimeoutMs: 30000 }
  ) {
    super();
    this.projectPath = projectPath;
    this.store = store;
    this.lifecycleHooks = lifecycleHooks;
    this.toolHookConfig = toolHookConfig;
  }

  /**
   * Execute pre-hooks before tool execution
   * @param context Pre-hook context with tool and execution information
   * @returns Hook execution result with potential modifications
   */
  async executePreHooks(context: PreHookContext): Promise<HookExecutionResult> {
    if (!this.toolHookConfig.enabled) {
      return { success: true };
    }

    const applicableHooks = this.getApplicablePreHooks(context.toolName);

    for (const hook of applicableHooks) {
      const startTime = new Date();

      // Emit hook start event
      this.emit('hook:pre:start', {
        taskId: context.taskId,
        hookName: hook.name,
        hookType: 'pre',
        toolName: context.toolName,
        timestamp: startTime,
      });

      try {
        const result = await this.executeHook(hook, context, 'pre');
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        // Emit hook complete event
        this.emit('hook:pre:complete', {
          taskId: context.taskId,
          hookName: hook.name,
          hookType: 'pre',
          toolName: context.toolName,
          duration,
          success: true,
          result: result ?? undefined,
          timestamp: endTime,
        });

        // Handle hook results - use type guard for PreHookResult
        if (isPreHookResult(result) && result.action === 'cancel') {
          if (context.taskId) {
            await this.addLogIfTask(context.taskId, {
              level: 'info',
              message: `Pre-hook "${hook.name}" cancelled tool execution: ${result.reason || 'No reason provided'}`,
              metadata: { hook: hook.name, tool: context.toolName, action: 'cancel' },
            });
          }

          return {
            success: true,
            cancelled: true,
            cancelReason: result.reason,
            cancelResult: result.cancelResult,
            metadata: result.metadata,
          };
        }

        if (isPreHookResult(result) && result.action === 'modify' && result.modifiedArguments) {
          if (context.taskId) {
            await this.addLogIfTask(context.taskId, {
              level: 'info',
              message: `Pre-hook "${hook.name}" modified tool arguments`,
              metadata: { hook: hook.name, tool: context.toolName, action: 'modify' },
            });
          }

          return {
            success: true,
            modifiedArgs: result.modifiedArguments,
            metadata: result.metadata,
          };
        }

      } catch (error) {
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Emit hook complete event with error
        this.emit('hook:pre:complete', {
          taskId: context.taskId,
          hookName: hook.name,
          hookType: 'pre',
          toolName: context.toolName,
          duration,
          success: false,
          error: errorMessage,
          timestamp: endTime,
        });

        await this.addLogIfTask(context.taskId, {
          level: 'error',
          message: `Pre-hook "${hook.name}" failed: ${errorMessage}`,
          metadata: { hook: hook.name, tool: context.toolName, error: errorMessage },
        });

        // Fail execution if hook requires it
        const failOnError = hook.failOnError ?? true; // Default to true for pre-hooks
        if (failOnError) {
          return {
            success: false,
            cancelled: true,
            cancelReason: `Pre-hook failed: ${errorMessage}`,
          };
        }
      }
    }

    return { success: true };
  }

  /**
   * Execute post-hooks after tool execution
   * @param context Post-hook context with tool and result information
   * @returns Hook execution result with behavior mode handling
   */
  async executePostHooks(context: PostHookContext): Promise<HookExecutionResult> {
    if (!this.toolHookConfig.enabled) {
      return { success: true };
    }

    const applicableHooks = this.getApplicablePostHooks(context.toolName);
    let finalResult: HookExecutionResult = { success: true };

    for (const hook of applicableHooks) {
      const startTime = new Date();

      // Emit hook start event
      this.emit('hook:post:start', {
        taskId: context.taskId,
        hookName: hook.name,
        hookType: 'post',
        toolName: context.toolName,
        timestamp: startTime,
      });

      try {
        const result = await this.executeHook(hook, context, 'post');
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        // Emit hook complete event
        this.emit('hook:post:complete', {
          taskId: context.taskId,
          hookName: hook.name,
          hookType: 'post',
          toolName: context.toolName,
          duration,
          success: true,
          result: result ?? undefined,
          timestamp: endTime,
        });

        // Handle behavior modes if specified in the hook result
        if (isPostHookResult(result) && result.behaviorMode) {
          const behaviorHandlingResult = await this.handleBehaviorMode(
            result.behaviorMode,
            context,
            hook,
            result.behaviorReason || 'Hook triggered behavior mode',
            result.modifiedResult || context.result
          );

          // Merge behavior handling results
          finalResult = {
            ...finalResult,
            ...behaviorHandlingResult,
          };

          // If behavior is blocking, short-circuit and return immediately
          if (behaviorHandlingResult.blocked) {
            return finalResult;
          }
        }

        await this.addLogIfTask(context.taskId, {
          level: 'debug',
          message: `Post-hook "${hook.name}" executed successfully`,
          metadata: { hook: hook.name, tool: context.toolName },
        });

      } catch (error) {
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Emit hook complete event with error
        this.emit('hook:post:complete', {
          taskId: context.taskId,
          hookName: hook.name,
          hookType: 'post',
          toolName: context.toolName,
          duration,
          success: false,
          error: errorMessage,
          timestamp: endTime,
        });

        await this.addLogIfTask(context.taskId, {
          level: 'error',
          message: `Post-hook "${hook.name}" failed: ${errorMessage}`,
          metadata: { hook: hook.name, tool: context.toolName, error: errorMessage },
        });

        // Post-hooks typically don't fail the operation by default
        const failOnError = hook.failOnError ?? false; // Default to false for post-hooks
        if (failOnError) {
          return { success: false };
        }
      }
    }

    return finalResult;
  }

  /**
   * Handle behavior mode processing
   * @param behaviorMode The behavior mode to apply
   * @param context Post-hook context
   * @param hook The hook that triggered the behavior
   * @param reason Reason for the behavior trigger
   * @param toolResult The original tool result
   * @returns Hook execution result with behavior applied
   */
  private async handleBehaviorMode(
    behaviorMode: BehaviorMode,
    context: PostHookContext,
    hook: ToolHookDefinition,
    reason: string,
    toolResult: any
  ): Promise<HookExecutionResult> {
    const eventData: BehaviorEventData = {
      behaviorMode,
      toolName: context.toolName,
      reason,
      originalOutput: toolResult,
      timestamp: new Date(),
      taskId: context.taskId,
      metadata: { hook: hook.name },
    };

    switch (behaviorMode) {
      case 'warn':
        // Emit event and pass through unchanged
        eventData.modifiedOutput = toolResult;
        this.emit('hook:behavior:triggered', eventData);

        await this.addLogIfTask(context.taskId, {
          level: 'warn',
          message: `Behavior mode 'warn' triggered by hook "${hook.name}": ${reason}`,
          metadata: {
            hook: hook.name,
            tool: context.toolName,
            behaviorMode: 'warn',
            reason
          },
        });

        return {
          success: true,
          behaviorMode: 'warn',
          modifiedResult: toolResult
        };

      case 'block':
        // Emit event and block output with error
        this.emit('hook:behavior:triggered', eventData);

        await this.addLogIfTask(context.taskId, {
          level: 'error',
          message: `Behavior mode 'block' triggered by hook "${hook.name}": ${reason}`,
          metadata: {
            hook: hook.name,
            tool: context.toolName,
            behaviorMode: 'block',
            reason
          },
        });

        return {
          success: false,
          blocked: true,
          behaviorMode: 'block',
          cancelReason: `Tool execution blocked: ${reason}`,
          cancelResult: {
            success: false,
            error: `Tool execution blocked by security hook: ${reason}`,
            output: null
          }
        };

      case 'redact':
        // Replace sensitive content with [REDACTED]
        const redactedOutput = this.redactSensitiveContent(toolResult);
        eventData.modifiedOutput = redactedOutput;
        this.emit('hook:behavior:triggered', eventData);

        await this.addLogIfTask(context.taskId, {
          level: 'info',
          message: `Behavior mode 'redact' triggered by hook "${hook.name}": ${reason}`,
          metadata: {
            hook: hook.name,
            tool: context.toolName,
            behaviorMode: 'redact',
            reason
          },
        });

        return {
          success: true,
          behaviorMode: 'redact',
          modifiedResult: redactedOutput
        };

      default:
        throw new Error(`Unknown behavior mode: ${behaviorMode}`);
    }
  }

  /**
   * Redact sensitive content from tool output
   * @param output The original output to redact
   * @returns Output with sensitive content replaced with [REDACTED]
   */
  private redactSensitiveContent(output: any): any {
    if (typeof output === 'string') {
      return this.redactSensitiveString(output);
    }

    if (Array.isArray(output)) {
      return output.map(item => this.redactSensitiveContent(item));
    }

    if (output && typeof output === 'object') {
      const redacted: any = {};
      for (const [key, value] of Object.entries(output)) {
        redacted[key] = this.redactSensitiveContent(value);
      }
      return redacted;
    }

    return output;
  }

  /**
   * Redact sensitive patterns from a string
   * @param text The text to redact
   * @returns Text with sensitive patterns replaced with [REDACTED]
   */
  private redactSensitiveString(text: string): string {
    const sensitivePatterns = [
      // API keys, tokens, secrets
      /\b[A-Za-z0-9_-]{20,}\b/g, // Generic tokens
      /(?:api[_-]?key|token|secret|password|pwd|auth)[=:\s]+[A-Za-z0-9_-]+/gi,
      // Credit card numbers
      /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      // Email addresses (optional - might be too aggressive)
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      // Phone numbers
      /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
      // SSH private keys
      /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
      // AWS credentials
      /(?:AKIA|ASIA)[A-Z0-9]{16}/g,
      // Generic secrets in environment variable format
      /([A-Z_]+(?:SECRET|TOKEN|KEY|PASSWORD)[A-Z_]*)\s*=\s*([^\s\n]+)/gi,
    ];

    let redacted = text;
    for (const pattern of sensitivePatterns) {
      redacted = redacted.replace(pattern, '[REDACTED]');
    }

    return redacted;
  }

  /**
   * Get applicable pre-hooks for a tool
   */
  private getApplicablePreHooks(toolName: string): ToolHookDefinition[] {
    return this.toolHookConfig.pre
      .filter(hook => hook.enabled !== false)
      .filter(hook => hook.tools.length === 0 || hook.tools.includes(toolName))
      .sort((a, b) => (b.priority ?? 100) - (a.priority ?? 100));
  }

  /**
   * Get applicable post-hooks for a tool
   */
  private getApplicablePostHooks(toolName: string): ToolHookDefinition[] {
    return this.toolHookConfig.post
      .filter(hook => hook.enabled !== false)
      .filter(hook => hook.tools.length === 0 || hook.tools.includes(toolName))
      .sort((a, b) => (b.priority ?? 100) - (a.priority ?? 100));
  }

  /**
   * Execute a single hook
   */
  private async executeHook(
    hook: ToolHookDefinition,
    context: PreHookContext | PostHookContext,
    type: 'pre' | 'post'
  ): Promise<PreHookResult | PostHookResult | null> {
    const timeout = hook.timeoutMs ?? this.toolHookConfig.defaultTimeoutMs ?? 30000;
    const handlerPath = path.resolve(this.projectPath, hook.handlerPath);

    // Check if handler file exists
    if (!fs.existsSync(handlerPath)) {
      throw new Error(`Hook handler not found: ${handlerPath}`);
    }

    // Prepare context data for the hook script
    const contextData = JSON.stringify(context);
    const tempContextFile = path.join(this.projectPath, '.apex', 'tmp', `hook-context-${Date.now()}.json`);

    // Ensure temp directory exists
    const tempDir = path.dirname(tempContextFile);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
      // Write context to temporary file
      fs.writeFileSync(tempContextFile, contextData);

      // Execute hook script with timeout
      const { stdout, stderr } = await Promise.race([
        execAsync(`"${handlerPath}" "${tempContextFile}"`, {
          cwd: this.projectPath,
          timeout,
          env: {
            ...process.env,
            APEX_HOOK_TYPE: type,
            APEX_HOOK_NAME: hook.name,
            APEX_PROJECT_PATH: this.projectPath,
            APEX_TASK_ID: context.taskId,
            APEX_TOOL_NAME: context.toolName,
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Hook timeout: ${hook.name}`)), timeout)
        ),
      ]);

      // Parse result from stdout
      if (stdout.trim()) {
        try {
          const result = JSON.parse(stdout.trim());
          return result as PreHookResult | PostHookResult;
        } catch (parseError) {
          throw new Error(`Invalid JSON response from hook: ${stdout}`);
        }
      }

      // Log stderr if present
      if (stderr.trim()) {
        await this.addLogIfTask(context.taskId, {
          level: 'warn',
          message: `Hook "${hook.name}" stderr: ${stderr}`,
          metadata: { hook: hook.name, tool: context.toolName },
        });
      }

      return null;

    } finally {
      // Clean up temporary file
      try {
        if (fs.existsSync(tempContextFile)) {
          fs.unlinkSync(tempContextFile);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Update hook configuration
   */
  updateConfig(lifecycleHooks: HookConfig[], toolHookConfig: ToolHookConfig): void {
    this.lifecycleHooks = lifecycleHooks;
    this.toolHookConfig = toolHookConfig;
  }

  /**
   * Get current tool hook configuration
   */
  getToolHookConfig(): ToolHookConfig {
    return { ...this.toolHookConfig };
  }

  /**
   * Get current lifecycle hooks
   */
  getLifecycleHooks(): HookConfig[] {
    return [...this.lifecycleHooks];
  }
}
