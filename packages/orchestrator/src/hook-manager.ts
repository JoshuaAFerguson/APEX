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
} from '@apexcli/core';
import { TaskStore } from './store';

const execAsync = promisify(exec);

export interface HookManagerEvents {
  'hook:pre:start': (event: HookExecutionStartEvent) => void;
  'hook:pre:complete': (event: HookExecutionCompleteEvent) => void;
  'hook:post:start': (event: HookExecutionStartEvent) => void;
  'hook:post:complete': (event: HookExecutionCompleteEvent) => void;
}

export interface HookExecutionStartEvent {
  taskId: string;
  hookName: string;
  hookType: 'pre' | 'post';
  toolName: string;
  timestamp: Date;
}

export interface HookExecutionCompleteEvent {
  taskId: string;
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
}

/**
 * HookManager manages lifecycle hooks and tool hooks for the orchestrator
 */
export class HookManager extends EventEmitter<HookManagerEvents> {
  private lifecycleHooks: HookConfig[] = [];
  private toolHookConfig: ToolHookConfig = { pre: [], post: [], enabled: true, defaultTimeoutMs: 30000 };
  private projectPath: string;
  private store: TaskStore;

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
          result,
          timestamp: endTime,
        });

        // Handle hook results
        if (result && result.action === 'cancel') {
          await this.store.addLog(context.taskId, {
            level: 'info',
            message: `Pre-hook "${hook.name}" cancelled tool execution: ${result.reason || 'No reason provided'}`,
            metadata: { hook: hook.name, tool: context.toolName, action: 'cancel' },
          });

          return {
            success: true,
            cancelled: true,
            cancelReason: result.reason,
            cancelResult: result.cancelResult,
            metadata: result.metadata,
          };
        }

        if (result && result.action === 'modify' && result.modifiedArguments) {
          await this.store.addLog(context.taskId, {
            level: 'info',
            message: `Pre-hook "${hook.name}" modified tool arguments`,
            metadata: { hook: hook.name, tool: context.toolName, action: 'modify' },
          });

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

        await this.store.addLog(context.taskId, {
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
   * @returns Hook execution result
   */
  async executePostHooks(context: PostHookContext): Promise<HookExecutionResult> {
    if (!this.toolHookConfig.enabled) {
      return { success: true };
    }

    const applicableHooks = this.getApplicablePostHooks(context.toolName);

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
          result,
          timestamp: endTime,
        });

        await this.store.addLog(context.taskId, {
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

        await this.store.addLog(context.taskId, {
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

    return { success: true };
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
        await this.store.addLog(context.taskId, {
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