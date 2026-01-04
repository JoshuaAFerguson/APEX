import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

import { HookManager, type HookExecutionStartEvent, type HookExecutionCompleteEvent } from './hook-manager';
import { TaskStore } from './store';
import {
  ToolHookConfig,
  ToolHookDefinition,
  PreHookContext,
  PostHookContext,
  PreHookResult,
  PostHookResult,
  PreHookAction
} from '@apexcli/core';

// Mock dependencies
vi.mock('child_process');
vi.mock('fs');
vi.mock('util');

const mockExec = vi.mocked(exec);
const mockPromisify = vi.mocked(promisify);
const mockExecAsync = vi.fn();
const mockFs = vi.mocked(fs);

describe('HookManager', () => {
  let hookManager: HookManager;
  let mockStore: ReturnType<typeof vi.mocked<TaskStore>>;
  let projectPath: string;
  let mockToolHookConfig: ToolHookConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock promisify to return our mock exec function
    mockPromisify.mockReturnValue(mockExecAsync);

    // Setup mock store
    mockStore = {
      addLog: vi.fn(),
    } as unknown as ReturnType<typeof vi.mocked<TaskStore>>;

    projectPath = '/test/project';
    mockToolHookConfig = {
      pre: [],
      post: [],
      enabled: true,
      defaultTimeoutMs: 30000,
    };

    hookManager = new HookManager(projectPath, mockStore, [], mockToolHookConfig);

    // Mock fs functions
    mockFs.existsSync = vi.fn();
    mockFs.writeFileSync = vi.fn();
    mockFs.unlinkSync = vi.fn();
    mockFs.mkdirSync = vi.fn();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const manager = new HookManager(projectPath, mockStore);

      expect(manager.getToolHookConfig()).toEqual({
        pre: [],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      });
      expect(manager.getLifecycleHooks()).toEqual([]);
    });

    it('should initialize with custom configuration', () => {
      const customToolHookConfig: ToolHookConfig = {
        pre: [{
          name: 'test-hook',
          type: 'pre',
          handlerPath: '/test/hook.js',
          tools: ['bash'],
          priority: 100,
          enabled: true,
        }],
        post: [],
        enabled: false,
        defaultTimeoutMs: 60000,
      };

      const manager = new HookManager(projectPath, mockStore, [], customToolHookConfig);

      expect(manager.getToolHookConfig()).toEqual(customToolHookConfig);
    });
  });

  describe('executePreHooks', () => {
    let preHookContext: PreHookContext;

    beforeEach(() => {
      preHookContext = {
        toolName: 'bash',
        arguments: { command: 'ls -la' },
        taskId: 'task-123',
        agentName: 'developer',
        stageName: 'implementation',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };
    });

    it('should return success when tool hooks are disabled', async () => {
      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        enabled: false,
      });

      const result = await hookManager.executePreHooks(preHookContext);

      expect(result).toEqual({ success: true });
    });

    it('should return success when no applicable hooks', async () => {
      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [{
          name: 'git-only-hook',
          type: 'pre',
          handlerPath: '/hooks/git.js',
          tools: ['git'], // Only applies to git tool
          enabled: true,
        }],
      });

      const result = await hookManager.executePreHooks(preHookContext);

      expect(result).toEqual({ success: true });
    });

    it('should execute applicable pre-hooks in priority order', async () => {
      const hook1: ToolHookDefinition = {
        name: 'low-priority',
        type: 'pre',
        handlerPath: '/hooks/low.js',
        tools: [], // Apply to all tools
        priority: 50,
        enabled: true,
      };

      const hook2: ToolHookDefinition = {
        name: 'high-priority',
        type: 'pre',
        handlerPath: '/hooks/high.js',
        tools: [], // Apply to all tools
        priority: 200,
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook1, hook2], // hook1 added first but lower priority
      });

      // Mock handler files exist
      mockFs.existsSync.mockReturnValue(true);

      // Mock successful execution with no output
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const events: HookExecutionStartEvent[] = [];
      hookManager.on('hook:pre:start', (event) => events.push(event));

      const result = await hookManager.executePreHooks(preHookContext);

      expect(result).toEqual({ success: true });
      expect(events).toHaveLength(2);
      // High priority hook should execute first
      expect(events[0].hookName).toBe('high-priority');
      expect(events[1].hookName).toBe('low-priority');
    });

    it('should handle hook cancellation', async () => {
      const hook: ToolHookDefinition = {
        name: 'cancel-hook',
        type: 'pre',
        handlerPath: '/hooks/cancel.js',
        tools: [],
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);

      const cancelResult: PreHookResult = {
        action: 'cancel',
        reason: 'Operation not allowed',
        cancelResult: { blocked: true },
        metadata: { source: 'security-check' },
      };

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(cancelResult),
        stderr: '',
      });

      const result = await hookManager.executePreHooks(preHookContext);

      expect(result).toEqual({
        success: true,
        cancelled: true,
        cancelReason: 'Operation not allowed',
        cancelResult: { blocked: true },
        metadata: { source: 'security-check' },
      });

      expect(mockStore.addLog).toHaveBeenCalledWith('task-123', {
        level: 'info',
        message: 'Pre-hook "cancel-hook" cancelled tool execution: Operation not allowed',
        metadata: { hook: 'cancel-hook', tool: 'bash', action: 'cancel' },
      });
    });

    it('should handle argument modification', async () => {
      const hook: ToolHookDefinition = {
        name: 'modify-hook',
        type: 'pre',
        handlerPath: '/hooks/modify.js',
        tools: [],
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);

      const modifyResult: PreHookResult = {
        action: 'modify',
        modifiedArguments: {
          command: 'ls -la --color=always',
          timeout: 5000,
        },
        metadata: { modified: true },
      };

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(modifyResult),
        stderr: '',
      });

      const result = await hookManager.executePreHooks(preHookContext);

      expect(result).toEqual({
        success: true,
        modifiedArgs: {
          command: 'ls -la --color=always',
          timeout: 5000,
        },
        metadata: { modified: true },
      });

      expect(mockStore.addLog).toHaveBeenCalledWith('task-123', {
        level: 'info',
        message: 'Pre-hook "modify-hook" modified tool arguments',
        metadata: { hook: 'modify-hook', tool: 'bash', action: 'modify' },
      });
    });

    it('should handle hook execution errors with failOnError=true', async () => {
      const hook: ToolHookDefinition = {
        name: 'failing-hook',
        type: 'pre',
        handlerPath: '/hooks/fail.js',
        tools: [],
        enabled: true,
        failOnError: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockRejectedValue(new Error('Hook execution failed'));

      const events: HookExecutionCompleteEvent[] = [];
      hookManager.on('hook:pre:complete', (event) => events.push(event));

      const result = await hookManager.executePreHooks(preHookContext);

      expect(result).toEqual({
        success: false,
        cancelled: true,
        cancelReason: 'Pre-hook failed: Hook execution failed',
      });

      expect(events).toHaveLength(1);
      expect(events[0].success).toBe(false);
      expect(events[0].error).toBe('Hook execution failed');

      expect(mockStore.addLog).toHaveBeenCalledWith('task-123', {
        level: 'error',
        message: 'Pre-hook "failing-hook" failed: Hook execution failed',
        metadata: { hook: 'failing-hook', tool: 'bash', error: 'Hook execution failed' },
      });
    });

    it('should continue execution when hook fails with failOnError=false', async () => {
      const hook: ToolHookDefinition = {
        name: 'failing-hook',
        type: 'pre',
        handlerPath: '/hooks/fail.js',
        tools: [],
        enabled: true,
        failOnError: false,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockRejectedValue(new Error('Hook execution failed'));

      const result = await hookManager.executePreHooks(preHookContext);

      expect(result).toEqual({ success: true });
    });

    it('should handle missing hook handler file', async () => {
      const hook: ToolHookDefinition = {
        name: 'missing-hook',
        type: 'pre',
        handlerPath: '/hooks/missing.js',
        tools: [],
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
      });

      mockFs.existsSync.mockReturnValue(false); // File doesn't exist

      const result = await hookManager.executePreHooks(preHookContext);

      expect(result).toEqual({
        success: false,
        cancelled: true,
        cancelReason: 'Pre-hook failed: Hook handler not found: /test/project/hooks/missing.js',
      });
    });

    it('should handle invalid JSON response from hook', async () => {
      const hook: ToolHookDefinition = {
        name: 'invalid-json-hook',
        type: 'pre',
        handlerPath: '/hooks/invalid.js',
        tools: [],
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({
        stdout: 'invalid json {',
        stderr: '',
      });

      const result = await hookManager.executePreHooks(preHookContext);

      expect(result).toEqual({
        success: false,
        cancelled: true,
        cancelReason: 'Pre-hook failed: Invalid JSON response from hook: invalid json {',
      });
    });

    it('should emit hook start and complete events', async () => {
      const hook: ToolHookDefinition = {
        name: 'event-hook',
        type: 'pre',
        handlerPath: '/hooks/event.js',
        tools: [],
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const startEvents: HookExecutionStartEvent[] = [];
      const completeEvents: HookExecutionCompleteEvent[] = [];

      hookManager.on('hook:pre:start', (event) => startEvents.push(event));
      hookManager.on('hook:pre:complete', (event) => completeEvents.push(event));

      await hookManager.executePreHooks(preHookContext);

      expect(startEvents).toHaveLength(1);
      expect(startEvents[0]).toMatchObject({
        taskId: 'task-123',
        hookName: 'event-hook',
        hookType: 'pre',
        toolName: 'bash',
      });

      expect(completeEvents).toHaveLength(1);
      expect(completeEvents[0]).toMatchObject({
        taskId: 'task-123',
        hookName: 'event-hook',
        hookType: 'pre',
        toolName: 'bash',
        success: true,
      });
      expect(completeEvents[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('should filter hooks by tool name', async () => {
      const bashHook: ToolHookDefinition = {
        name: 'bash-hook',
        type: 'pre',
        handlerPath: '/hooks/bash.js',
        tools: ['bash'],
        enabled: true,
      };

      const gitHook: ToolHookDefinition = {
        name: 'git-hook',
        type: 'pre',
        handlerPath: '/hooks/git.js',
        tools: ['git'],
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [bashHook, gitHook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const startEvents: HookExecutionStartEvent[] = [];
      hookManager.on('hook:pre:start', (event) => startEvents.push(event));

      await hookManager.executePreHooks(preHookContext);

      expect(startEvents).toHaveLength(1);
      expect(startEvents[0].hookName).toBe('bash-hook');
    });

    it('should skip disabled hooks', async () => {
      const enabledHook: ToolHookDefinition = {
        name: 'enabled-hook',
        type: 'pre',
        handlerPath: '/hooks/enabled.js',
        tools: [],
        enabled: true,
      };

      const disabledHook: ToolHookDefinition = {
        name: 'disabled-hook',
        type: 'pre',
        handlerPath: '/hooks/disabled.js',
        tools: [],
        enabled: false,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [enabledHook, disabledHook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const startEvents: HookExecutionStartEvent[] = [];
      hookManager.on('hook:pre:start', (event) => startEvents.push(event));

      await hookManager.executePreHooks(preHookContext);

      expect(startEvents).toHaveLength(1);
      expect(startEvents[0].hookName).toBe('enabled-hook');
    });
  });

  describe('executePostHooks', () => {
    let postHookContext: PostHookContext;

    beforeEach(() => {
      postHookContext = {
        toolName: 'bash',
        arguments: { command: 'ls -la' },
        taskId: 'task-123',
        agentName: 'developer',
        stageName: 'implementation',
        invocationId: 'inv-456',
        timestamp: new Date(),
        result: {
          success: true,
          output: 'file1.txt\nfile2.txt',
          duration: 1000,
        },
      };
    });

    it('should return success when tool hooks are disabled', async () => {
      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        enabled: false,
      });

      const result = await hookManager.executePostHooks(postHookContext);

      expect(result).toEqual({ success: true });
    });

    it('should execute applicable post-hooks', async () => {
      const hook: ToolHookDefinition = {
        name: 'post-hook',
        type: 'post',
        handlerPath: '/hooks/post.js',
        tools: [],
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        post: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const result = await hookManager.executePostHooks(postHookContext);

      expect(result).toEqual({ success: true });

      expect(mockStore.addLog).toHaveBeenCalledWith('task-123', {
        level: 'debug',
        message: 'Post-hook "post-hook" executed successfully',
        metadata: { hook: 'post-hook', tool: 'bash' },
      });
    });

    it('should handle post-hook errors with failOnError=true', async () => {
      const hook: ToolHookDefinition = {
        name: 'failing-post-hook',
        type: 'post',
        handlerPath: '/hooks/fail-post.js',
        tools: [],
        enabled: true,
        failOnError: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        post: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockRejectedValue(new Error('Post-hook failed'));

      const result = await hookManager.executePostHooks(postHookContext);

      expect(result).toEqual({ success: false });

      expect(mockStore.addLog).toHaveBeenCalledWith('task-123', {
        level: 'error',
        message: 'Post-hook "failing-post-hook" failed: Post-hook failed',
        metadata: { hook: 'failing-post-hook', tool: 'bash', error: 'Post-hook failed' },
      });
    });

    it('should continue execution when post-hook fails with failOnError=false', async () => {
      const hook: ToolHookDefinition = {
        name: 'failing-post-hook',
        type: 'post',
        handlerPath: '/hooks/fail-post.js',
        tools: [],
        enabled: true,
        failOnError: false,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        post: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockRejectedValue(new Error('Post-hook failed'));

      const result = await hookManager.executePostHooks(postHookContext);

      expect(result).toEqual({ success: true });
    });

    it('should emit post-hook start and complete events', async () => {
      const hook: ToolHookDefinition = {
        name: 'event-post-hook',
        type: 'post',
        handlerPath: '/hooks/post-event.js',
        tools: [],
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        post: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const startEvents: HookExecutionStartEvent[] = [];
      const completeEvents: HookExecutionCompleteEvent[] = [];

      hookManager.on('hook:post:start', (event) => startEvents.push(event));
      hookManager.on('hook:post:complete', (event) => completeEvents.push(event));

      await hookManager.executePostHooks(postHookContext);

      expect(startEvents).toHaveLength(1);
      expect(startEvents[0]).toMatchObject({
        taskId: 'task-123',
        hookName: 'event-post-hook',
        hookType: 'post',
        toolName: 'bash',
      });

      expect(completeEvents).toHaveLength(1);
      expect(completeEvents[0]).toMatchObject({
        taskId: 'task-123',
        hookName: 'event-post-hook',
        hookType: 'post',
        toolName: 'bash',
        success: true,
      });
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const newToolHookConfig: ToolHookConfig = {
        pre: [{
          name: 'new-hook',
          type: 'pre',
          handlerPath: '/new/hook.js',
          tools: [],
          enabled: true,
        }],
        post: [],
        enabled: false,
        defaultTimeoutMs: 60000,
      };

      hookManager.updateConfig([], newToolHookConfig);

      expect(hookManager.getToolHookConfig()).toEqual(newToolHookConfig);
    });

    it('should return deep copies of configuration', () => {
      const originalConfig = hookManager.getToolHookConfig();
      const config1 = hookManager.getToolHookConfig();
      const config2 = hookManager.getToolHookConfig();

      // Modify one copy
      config1.enabled = false;
      config1.pre.push({
        name: 'test',
        type: 'pre',
        handlerPath: '/test.js',
        tools: [],
        enabled: true,
      });

      // Other copies should be unaffected
      expect(config2.enabled).toBe(true);
      expect(config2.pre).toEqual([]);
      expect(hookManager.getToolHookConfig()).toEqual(originalConfig);
    });
  });

  describe('hook execution environment', () => {
    it('should set environment variables for hook execution', async () => {
      const hook: ToolHookDefinition = {
        name: 'env-hook',
        type: 'pre',
        handlerPath: '/hooks/env.js',
        tools: [],
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-123',
        agentName: 'developer',
        stageName: 'implementation',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      await hookManager.executePreHooks(context);

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          cwd: projectPath,
          timeout: 30000,
          env: expect.objectContaining({
            APEX_HOOK_TYPE: 'pre',
            APEX_HOOK_NAME: 'env-hook',
            APEX_PROJECT_PATH: projectPath,
            APEX_TASK_ID: 'task-123',
            APEX_TOOL_NAME: 'bash',
          }),
        })
      );
    });

    it('should use custom timeout from hook configuration', async () => {
      const hook: ToolHookDefinition = {
        name: 'timeout-hook',
        type: 'pre',
        handlerPath: '/hooks/timeout.js',
        tools: [],
        enabled: true,
        timeoutMs: 45000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      await hookManager.executePreHooks(context);

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          timeout: 45000,
        })
      );
    });

    it('should create and clean up temporary context files', async () => {
      const hook: ToolHookDefinition = {
        name: 'context-hook',
        type: 'pre',
        handlerPath: '/hooks/context.js',
        tools: [],
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      await hookManager.executePreHooks(context);

      // Should create temp directory
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.apex/tmp'),
        { recursive: true }
      );

      // Should write context file
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/.*\.apex\/tmp\/hook-context-.*\.json$/),
        JSON.stringify(context)
      );

      // Should clean up context file
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        expect.stringMatching(/.*\.apex\/tmp\/hook-context-.*\.json$/)
      );
    });

    it('should handle stderr output from hooks', async () => {
      const hook: ToolHookDefinition = {
        name: 'stderr-hook',
        type: 'pre',
        handlerPath: '/hooks/stderr.js',
        tools: [],
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({
        stdout: '',
        stderr: 'Warning: something happened'
      });

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      await hookManager.executePreHooks(context);

      expect(mockStore.addLog).toHaveBeenCalledWith('task-123', {
        level: 'warn',
        message: 'Hook "stderr-hook" stderr: Warning: something happened',
        metadata: { hook: 'stderr-hook', tool: 'bash' },
      });
    });
  });
});