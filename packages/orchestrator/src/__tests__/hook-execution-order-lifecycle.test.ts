/**
 * Unit tests for hook execution order and lifecycle
 *
 * Tests cover:
 * - Hooks execute in correct order (pre/post)
 * - Hooks receive correct context
 * - Hook errors are handled properly
 * - Multiple hooks chain correctly
 * - Hook registration and deregistration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

import {
  HookManager,
  type HookExecutionStartEvent,
  type HookExecutionCompleteEvent,
} from '../hook-manager';
import { TaskStore } from '../store';
import {
  ToolHookConfig,
  ToolHookDefinition,
  PreHookContext,
  PostHookContext,
  PreHookResult,
  PostHookResult,
} from '@apexcli/core';

// Mock dependencies
vi.mock('child_process');
vi.mock('fs');
vi.mock('util');

const mockPromisify = vi.mocked(promisify);
const mockExecAsync = vi.fn();
const mockFs = vi.mocked(fs);

describe('Hook Execution Order and Lifecycle', () => {
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

  describe('Pre/Post Hook Execution Order', () => {
    it('should execute all pre-hooks before any post-hooks', async () => {
      const executionOrder: string[] = [];

      const preHook1: ToolHookDefinition = {
        name: 'pre-hook-1',
        type: 'pre',
        handlerPath: '/hooks/pre1.js',
        tools: [],
        priority: 100,
        enabled: true,
      };

      const preHook2: ToolHookDefinition = {
        name: 'pre-hook-2',
        type: 'pre',
        handlerPath: '/hooks/pre2.js',
        tools: [],
        priority: 50,
        enabled: true,
      };

      const postHook1: ToolHookDefinition = {
        name: 'post-hook-1',
        type: 'post',
        handlerPath: '/hooks/post1.js',
        tools: [],
        priority: 100,
        enabled: true,
      };

      const postHook2: ToolHookDefinition = {
        name: 'post-hook-2',
        type: 'post',
        handlerPath: '/hooks/post2.js',
        tools: [],
        priority: 50,
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [preHook1, preHook2],
        post: [postHook1, postHook2],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      hookManager.on('hook:pre:start', (event) => {
        executionOrder.push(`pre:${event.hookName}`);
      });
      hookManager.on('hook:post:start', (event) => {
        executionOrder.push(`post:${event.hookName}`);
      });

      const preContext: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      const postContext: PostHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
        result: { success: true, output: 'result' },
      };

      // Execute pre-hooks first
      await hookManager.executePreHooks(preContext);
      // Then execute post-hooks
      await hookManager.executePostHooks(postContext);

      // Verify all pre-hooks execute before any post-hooks
      expect(executionOrder).toEqual([
        'pre:pre-hook-1', // Higher priority first
        'pre:pre-hook-2',
        'post:post-hook-1', // Higher priority first
        'post:post-hook-2',
      ]);

      // Verify no post-hooks appeared before pre-hooks
      const firstPostIndex = executionOrder.findIndex((e) => e.startsWith('post:'));
      const lastPreIndex = executionOrder.reduce(
        (lastIdx, e, idx) => (e.startsWith('pre:') ? idx : lastIdx),
        -1
      );
      expect(lastPreIndex).toBeLessThan(firstPostIndex);
    });

    it('should execute pre-hooks in descending priority order', async () => {
      const executionOrder: string[] = [];

      const hooks: ToolHookDefinition[] = [
        { name: 'low-50', type: 'pre', handlerPath: '/h1.js', tools: [], priority: 50, enabled: true },
        { name: 'high-200', type: 'pre', handlerPath: '/h2.js', tools: [], priority: 200, enabled: true },
        { name: 'medium-100', type: 'pre', handlerPath: '/h3.js', tools: [], priority: 100, enabled: true },
        { name: 'very-low-10', type: 'pre', handlerPath: '/h4.js', tools: [], priority: 10, enabled: true },
      ];

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: hooks,
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      hookManager.on('hook:pre:start', (event) => {
        executionOrder.push(event.hookName);
      });

      await hookManager.executePreHooks({
        toolName: 'bash',
        arguments: {},
        taskId: 'task-1',
        invocationId: 'inv-1',
        timestamp: new Date(),
      });

      expect(executionOrder).toEqual(['high-200', 'medium-100', 'low-50', 'very-low-10']);
    });

    it('should execute post-hooks in descending priority order', async () => {
      const executionOrder: string[] = [];

      const hooks: ToolHookDefinition[] = [
        { name: 'low-25', type: 'post', handlerPath: '/h1.js', tools: [], priority: 25, enabled: true },
        { name: 'high-150', type: 'post', handlerPath: '/h2.js', tools: [], priority: 150, enabled: true },
        { name: 'medium-75', type: 'post', handlerPath: '/h3.js', tools: [], priority: 75, enabled: true },
      ];

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        post: hooks,
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      hookManager.on('hook:post:start', (event) => {
        executionOrder.push(event.hookName);
      });

      await hookManager.executePostHooks({
        toolName: 'bash',
        arguments: {},
        taskId: 'task-1',
        invocationId: 'inv-1',
        timestamp: new Date(),
        result: { success: true },
      });

      expect(executionOrder).toEqual(['high-150', 'medium-75', 'low-25']);
    });

    it('should use default priority (100) when not specified', async () => {
      const executionOrder: string[] = [];

      const hooks: ToolHookDefinition[] = [
        { name: 'default-priority', type: 'pre', handlerPath: '/h1.js', tools: [], enabled: true },
        { name: 'explicit-150', type: 'pre', handlerPath: '/h2.js', tools: [], priority: 150, enabled: true },
        { name: 'explicit-50', type: 'pre', handlerPath: '/h3.js', tools: [], priority: 50, enabled: true },
      ];

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: hooks,
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      hookManager.on('hook:pre:start', (event) => {
        executionOrder.push(event.hookName);
      });

      await hookManager.executePreHooks({
        toolName: 'bash',
        arguments: {},
        taskId: 'task-1',
        invocationId: 'inv-1',
        timestamp: new Date(),
      });

      // Default priority is 100, so order should be: 150, 100 (default), 50
      expect(executionOrder).toEqual(['explicit-150', 'default-priority', 'explicit-50']);
    });
  });

  describe('Hook Context Validation', () => {
    it('should pass correct pre-hook context with all required fields', async () => {
      const hook: ToolHookDefinition = {
        name: 'context-validator',
        type: 'pre',
        handlerPath: '/hooks/validate.js',
        tools: [],
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);

      let capturedContext: string | null = null;
      mockExecAsync.mockImplementation(async (cmd: string, options: any) => {
        // The context is written to a temp file, extract from writeFileSync mock
        return { stdout: '', stderr: '' };
      });

      const inputContext: PreHookContext = {
        toolName: 'Write',
        arguments: { file_path: '/test/file.ts', content: 'const x = 1;' },
        taskId: 'task-context-test',
        agentName: 'developer',
        stageName: 'implementation',
        invocationId: 'inv-context-test',
        timestamp: new Date('2024-01-15T10:00:00Z'),
      };

      await hookManager.executePreHooks(inputContext);

      // Verify context was written to temp file
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writeCall = (mockFs.writeFileSync as any).mock.calls[0];
      const writtenContext = JSON.parse(writeCall[1]);

      expect(writtenContext.toolName).toBe('Write');
      expect(writtenContext.arguments).toEqual({ file_path: '/test/file.ts', content: 'const x = 1;' });
      expect(writtenContext.taskId).toBe('task-context-test');
      expect(writtenContext.agentName).toBe('developer');
      expect(writtenContext.stageName).toBe('implementation');
      expect(writtenContext.invocationId).toBe('inv-context-test');
    });

    it('should pass correct post-hook context including result', async () => {
      const hook: ToolHookDefinition = {
        name: 'post-context-validator',
        type: 'post',
        handlerPath: '/hooks/post-validate.js',
        tools: [],
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        post: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const inputContext: PostHookContext = {
        toolName: 'Bash',
        arguments: { command: 'npm test' },
        taskId: 'task-post-context',
        agentName: 'tester',
        stageName: 'testing',
        invocationId: 'inv-post-context',
        timestamp: new Date('2024-01-15T11:00:00Z'),
        result: {
          success: true,
          output: 'All tests passed',
          exitCode: 0,
          duration: 5000,
        },
      };

      await hookManager.executePostHooks(inputContext);

      // Verify context was written to temp file with result
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writeCall = (mockFs.writeFileSync as any).mock.calls[0];
      const writtenContext = JSON.parse(writeCall[1]);

      expect(writtenContext.toolName).toBe('Bash');
      expect(writtenContext.taskId).toBe('task-post-context');
      expect(writtenContext.result).toEqual({
        success: true,
        output: 'All tests passed',
        exitCode: 0,
        duration: 5000,
      });
    });

    it('should emit start event with correct context fields', async () => {
      const hook: ToolHookDefinition = {
        name: 'event-context-hook',
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

      let capturedEvent: HookExecutionStartEvent | null = null;
      hookManager.on('hook:pre:start', (event) => {
        capturedEvent = event;
      });

      const timestamp = new Date();
      await hookManager.executePreHooks({
        toolName: 'Read',
        arguments: { file_path: '/test.txt' },
        taskId: 'task-event-context',
        invocationId: 'inv-event',
        timestamp,
      });

      expect(capturedEvent).not.toBeNull();
      expect(capturedEvent!.hookName).toBe('event-context-hook');
      expect(capturedEvent!.hookType).toBe('pre');
      expect(capturedEvent!.toolName).toBe('Read');
      expect(capturedEvent!.taskId).toBe('task-event-context');
      expect(capturedEvent!.timestamp).toBeInstanceOf(Date);
    });

    it('should emit complete event with result and duration', async () => {
      const hook: ToolHookDefinition = {
        name: 'complete-event-hook',
        type: 'pre',
        handlerPath: '/hooks/complete.js',
        tools: [],
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);

      const hookResult: PreHookResult = {
        action: 'continue',
        metadata: { processed: true },
      };
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(hookResult),
        stderr: '',
      });

      let capturedEvent: HookExecutionCompleteEvent | null = null;
      hookManager.on('hook:pre:complete', (event) => {
        capturedEvent = event;
      });

      await hookManager.executePreHooks({
        toolName: 'Grep',
        arguments: { pattern: 'test' },
        taskId: 'task-complete-event',
        invocationId: 'inv-complete',
        timestamp: new Date(),
      });

      expect(capturedEvent).not.toBeNull();
      expect(capturedEvent!.hookName).toBe('complete-event-hook');
      expect(capturedEvent!.hookType).toBe('pre');
      expect(capturedEvent!.toolName).toBe('Grep');
      expect(capturedEvent!.success).toBe(true);
      expect(capturedEvent!.duration).toBeGreaterThanOrEqual(0);
      expect(capturedEvent!.result).toEqual(hookResult);
      expect(capturedEvent!.error).toBeUndefined();
    });

    it('should pass optional fields only when provided', async () => {
      const hook: ToolHookDefinition = {
        name: 'optional-fields-hook',
        type: 'pre',
        handlerPath: '/hooks/optional.js',
        tools: [],
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      // Context without optional fields
      const minimalContext: PreHookContext = {
        toolName: 'Glob',
        arguments: { pattern: '*.ts' },
        taskId: 'task-minimal',
        invocationId: 'inv-minimal',
        timestamp: new Date(),
        // No agentName, stageName
      };

      await hookManager.executePreHooks(minimalContext);

      const writeCall = (mockFs.writeFileSync as any).mock.calls[0];
      const writtenContext = JSON.parse(writeCall[1]);

      expect(writtenContext.agentName).toBeUndefined();
      expect(writtenContext.stageName).toBeUndefined();
    });
  });

  describe('Hook Error Handling', () => {
    it('should propagate error message in complete event when hook throws', async () => {
      const hook: ToolHookDefinition = {
        name: 'throwing-hook',
        type: 'pre',
        handlerPath: '/hooks/throw.js',
        tools: [],
        enabled: true,
        failOnError: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockRejectedValue(new Error('Hook crashed unexpectedly'));

      let capturedEvent: HookExecutionCompleteEvent | null = null;
      hookManager.on('hook:pre:complete', (event) => {
        capturedEvent = event;
      });

      await hookManager.executePreHooks({
        toolName: 'bash',
        arguments: {},
        taskId: 'task-throw',
        invocationId: 'inv-throw',
        timestamp: new Date(),
      });

      expect(capturedEvent).not.toBeNull();
      expect(capturedEvent!.success).toBe(false);
      expect(capturedEvent!.error).toBe('Hook crashed unexpectedly');
    });

    it('should handle timeout errors gracefully', async () => {
      const hook: ToolHookDefinition = {
        name: 'timeout-hook',
        type: 'pre',
        handlerPath: '/hooks/timeout.js',
        tools: [],
        enabled: true,
        timeoutMs: 1000,
        failOnError: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);

      // Simulate timeout by rejecting with timeout error
      mockExecAsync.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Hook timeout: timeout-hook')), 10);
        });
      });

      const result = await hookManager.executePreHooks({
        toolName: 'bash',
        arguments: {},
        taskId: 'task-timeout',
        invocationId: 'inv-timeout',
        timestamp: new Date(),
      });

      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
      expect(result.cancelReason).toContain('timeout');
    });

    it('should continue with remaining hooks when failOnError is false', async () => {
      const executionOrder: string[] = [];

      const hooks: ToolHookDefinition[] = [
        {
          name: 'first-hook',
          type: 'pre',
          handlerPath: '/hooks/first.js',
          tools: [],
          priority: 200,
          enabled: true,
          failOnError: false,
        },
        {
          name: 'failing-hook',
          type: 'pre',
          handlerPath: '/hooks/fail.js',
          tools: [],
          priority: 150,
          enabled: true,
          failOnError: false,
        },
        {
          name: 'last-hook',
          type: 'pre',
          handlerPath: '/hooks/last.js',
          tools: [],
          priority: 100,
          enabled: true,
          failOnError: false,
        },
      ];

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: hooks,
      });

      mockFs.existsSync.mockReturnValue(true);

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // first-hook succeeds
        .mockRejectedValueOnce(new Error('Middle hook failed')) // failing-hook fails
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // last-hook succeeds

      hookManager.on('hook:pre:start', (event) => {
        executionOrder.push(`start:${event.hookName}`);
      });
      hookManager.on('hook:pre:complete', (event) => {
        executionOrder.push(`complete:${event.hookName}:${event.success}`);
      });

      const result = await hookManager.executePreHooks({
        toolName: 'bash',
        arguments: {},
        taskId: 'task-continue',
        invocationId: 'inv-continue',
        timestamp: new Date(),
      });

      expect(result.success).toBe(true);
      expect(executionOrder).toEqual([
        'start:first-hook',
        'complete:first-hook:true',
        'start:failing-hook',
        'complete:failing-hook:false',
        'start:last-hook',
        'complete:last-hook:true',
      ]);
    });

    it('should stop execution on first failure when failOnError is true', async () => {
      const executionOrder: string[] = [];

      const hooks: ToolHookDefinition[] = [
        {
          name: 'first-hook',
          type: 'pre',
          handlerPath: '/hooks/first.js',
          tools: [],
          priority: 200,
          enabled: true,
          failOnError: true,
        },
        {
          name: 'failing-hook',
          type: 'pre',
          handlerPath: '/hooks/fail.js',
          tools: [],
          priority: 150,
          enabled: true,
          failOnError: true,
        },
        {
          name: 'never-reached-hook',
          type: 'pre',
          handlerPath: '/hooks/never.js',
          tools: [],
          priority: 100,
          enabled: true,
          failOnError: true,
        },
      ];

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: hooks,
      });

      mockFs.existsSync.mockReturnValue(true);

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // first-hook succeeds
        .mockRejectedValueOnce(new Error('Hook failed critically')); // failing-hook fails

      hookManager.on('hook:pre:start', (event) => {
        executionOrder.push(event.hookName);
      });

      const result = await hookManager.executePreHooks({
        toolName: 'bash',
        arguments: {},
        taskId: 'task-stop',
        invocationId: 'inv-stop',
        timestamp: new Date(),
      });

      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
      // The third hook should never be executed
      expect(executionOrder).toEqual(['first-hook', 'failing-hook']);
      expect(executionOrder).not.toContain('never-reached-hook');
    });

    it('should log hook errors to the task store', async () => {
      const hook: ToolHookDefinition = {
        name: 'error-logging-hook',
        type: 'pre',
        handlerPath: '/hooks/error.js',
        tools: [],
        enabled: true,
        failOnError: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockRejectedValue(new Error('Database connection failed'));

      await hookManager.executePreHooks({
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-error-log',
        invocationId: 'inv-error',
        timestamp: new Date(),
      });

      expect(mockStore.addLog).toHaveBeenCalledWith('task-error-log', {
        level: 'error',
        message: 'Pre-hook "error-logging-hook" failed: Database connection failed',
        metadata: {
          hook: 'error-logging-hook',
          tool: 'bash',
          error: 'Database connection failed',
        },
      });
    });

    it('should handle non-Error objects thrown by hooks', async () => {
      const hook: ToolHookDefinition = {
        name: 'string-error-hook',
        type: 'pre',
        handlerPath: '/hooks/string-error.js',
        tools: [],
        enabled: true,
        failOnError: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockRejectedValue('String error message');

      const result = await hookManager.executePreHooks({
        toolName: 'bash',
        arguments: {},
        taskId: 'task-string-error',
        invocationId: 'inv-string',
        timestamp: new Date(),
      });

      expect(result.success).toBe(false);
      expect(result.cancelReason).toContain('String error message');
    });

    it('should handle missing handler file error', async () => {
      const hook: ToolHookDefinition = {
        name: 'missing-handler',
        type: 'pre',
        handlerPath: '/hooks/does-not-exist.js',
        tools: [],
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
      });

      mockFs.existsSync.mockReturnValue(false);

      const result = await hookManager.executePreHooks({
        toolName: 'bash',
        arguments: {},
        taskId: 'task-missing',
        invocationId: 'inv-missing',
        timestamp: new Date(),
      });

      expect(result.success).toBe(false);
      expect(result.cancelReason).toContain('Hook handler not found');
    });

    it('should handle malformed JSON response from hook', async () => {
      const hook: ToolHookDefinition = {
        name: 'malformed-json-hook',
        type: 'pre',
        handlerPath: '/hooks/malformed.js',
        tools: [],
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({
        stdout: '{ invalid json syntax }',
        stderr: '',
      });

      const result = await hookManager.executePreHooks({
        toolName: 'bash',
        arguments: {},
        taskId: 'task-malformed',
        invocationId: 'inv-malformed',
        timestamp: new Date(),
      });

      expect(result.success).toBe(false);
      expect(result.cancelReason).toContain('Invalid JSON response');
    });
  });

  describe('Multiple Hooks Chaining', () => {
    it('should pass through when first hook returns continue', async () => {
      const hooks: ToolHookDefinition[] = [
        {
          name: 'continue-hook',
          type: 'pre',
          handlerPath: '/hooks/continue.js',
          tools: [],
          priority: 200,
          enabled: true,
        },
        {
          name: 'second-hook',
          type: 'pre',
          handlerPath: '/hooks/second.js',
          tools: [],
          priority: 100,
          enabled: true,
        },
      ];

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: hooks,
      });

      mockFs.existsSync.mockReturnValue(true);

      const continueResult: PreHookResult = { action: 'continue' };
      mockExecAsync
        .mockResolvedValueOnce({ stdout: JSON.stringify(continueResult), stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const startEvents: string[] = [];
      hookManager.on('hook:pre:start', (e) => startEvents.push(e.hookName));

      const result = await hookManager.executePreHooks({
        toolName: 'bash',
        arguments: {},
        taskId: 'task-chain',
        invocationId: 'inv-chain',
        timestamp: new Date(),
      });

      expect(result.success).toBe(true);
      expect(startEvents).toHaveLength(2);
    });

    it('should stop chain when hook returns cancel', async () => {
      const hooks: ToolHookDefinition[] = [
        {
          name: 'cancelling-hook',
          type: 'pre',
          handlerPath: '/hooks/cancel.js',
          tools: [],
          priority: 200,
          enabled: true,
        },
        {
          name: 'never-executed',
          type: 'pre',
          handlerPath: '/hooks/never.js',
          tools: [],
          priority: 100,
          enabled: true,
        },
      ];

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: hooks,
      });

      mockFs.existsSync.mockReturnValue(true);

      const cancelResult: PreHookResult = {
        action: 'cancel',
        reason: 'Security policy violation',
        cancelResult: { blocked: true },
      };
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify(cancelResult),
        stderr: '',
      });

      const startEvents: string[] = [];
      hookManager.on('hook:pre:start', (e) => startEvents.push(e.hookName));

      const result = await hookManager.executePreHooks({
        toolName: 'bash',
        arguments: {},
        taskId: 'task-cancel-chain',
        invocationId: 'inv-cancel',
        timestamp: new Date(),
      });

      expect(result.success).toBe(true);
      expect(result.cancelled).toBe(true);
      expect(result.cancelReason).toBe('Security policy violation');
      expect(startEvents).toHaveLength(1);
      expect(startEvents).not.toContain('never-executed');
    });

    it('should stop chain when hook returns modify and apply modifications', async () => {
      const hooks: ToolHookDefinition[] = [
        {
          name: 'modifying-hook',
          type: 'pre',
          handlerPath: '/hooks/modify.js',
          tools: [],
          priority: 200,
          enabled: true,
        },
        {
          name: 'after-modify',
          type: 'pre',
          handlerPath: '/hooks/after.js',
          tools: [],
          priority: 100,
          enabled: true,
        },
      ];

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: hooks,
      });

      mockFs.existsSync.mockReturnValue(true);

      const modifyResult: PreHookResult = {
        action: 'modify',
        modifiedArguments: { command: 'ls -la --color' },
        metadata: { sanitized: true },
      };
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify(modifyResult),
        stderr: '',
      });

      const result = await hookManager.executePreHooks({
        toolName: 'bash',
        arguments: { command: 'ls' },
        taskId: 'task-modify-chain',
        invocationId: 'inv-modify',
        timestamp: new Date(),
      });

      expect(result.success).toBe(true);
      expect(result.modifiedArgs).toEqual({ command: 'ls -la --color' });
      expect(result.metadata).toEqual({ sanitized: true });
    });

    it('should chain multiple post-hooks with behavior mode handling', async () => {
      const hooks: ToolHookDefinition[] = [
        {
          name: 'warning-hook',
          type: 'post',
          handlerPath: '/hooks/warn.js',
          tools: [],
          priority: 200,
          enabled: true,
        },
        {
          name: 'logging-hook',
          type: 'post',
          handlerPath: '/hooks/log.js',
          tools: [],
          priority: 100,
          enabled: true,
        },
      ];

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        post: hooks,
      });

      mockFs.existsSync.mockReturnValue(true);

      const warnResult: PostHookResult = {
        behaviorMode: 'warn',
        behaviorReason: 'Potentially unsafe operation detected',
      };
      mockExecAsync
        .mockResolvedValueOnce({ stdout: JSON.stringify(warnResult), stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      let behaviorTriggered = false;
      hookManager.on('hook:behavior:triggered', (event) => {
        behaviorTriggered = true;
        expect(event.behaviorMode).toBe('warn');
      });

      const result = await hookManager.executePostHooks({
        toolName: 'bash',
        arguments: {},
        taskId: 'task-behavior-chain',
        invocationId: 'inv-behavior',
        timestamp: new Date(),
        result: { success: true },
      });

      expect(result.success).toBe(true);
      expect(result.behaviorMode).toBe('warn');
      expect(behaviorTriggered).toBe(true);
    });

    it('should block chain when post-hook returns block behavior', async () => {
      const hooks: ToolHookDefinition[] = [
        {
          name: 'blocking-hook',
          type: 'post',
          handlerPath: '/hooks/block.js',
          tools: [],
          priority: 200,
          enabled: true,
        },
        {
          name: 'never-executed',
          type: 'post',
          handlerPath: '/hooks/never.js',
          tools: [],
          priority: 100,
          enabled: true,
        },
      ];

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        post: hooks,
      });

      mockFs.existsSync.mockReturnValue(true);

      const blockResult: PostHookResult = {
        behaviorMode: 'block',
        behaviorReason: 'Sensitive data detected in output',
      };
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify(blockResult),
        stderr: '',
      });

      const startEvents: string[] = [];
      hookManager.on('hook:post:start', (e) => startEvents.push(e.hookName));

      const result = await hookManager.executePostHooks({
        toolName: 'bash',
        arguments: {},
        taskId: 'task-block-chain',
        invocationId: 'inv-block',
        timestamp: new Date(),
        result: { success: true, output: 'secret: password123' },
      });

      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.behaviorMode).toBe('block');
      expect(startEvents).toHaveLength(1);
    });
  });

  describe('Hook Registration and Deregistration', () => {
    it('should allow registering event listeners', () => {
      const listener = vi.fn();
      hookManager.on('hook:pre:start', listener);

      // Verify listener is registered
      expect(hookManager.listenerCount('hook:pre:start')).toBe(1);
    });

    it('should allow unregistering event listeners with off', () => {
      const listener = vi.fn();
      hookManager.on('hook:pre:start', listener);
      hookManager.off('hook:pre:start', listener);

      expect(hookManager.listenerCount('hook:pre:start')).toBe(0);
    });

    it('should allow unregistering with removeListener', () => {
      const listener = vi.fn();
      hookManager.on('hook:pre:complete', listener);
      hookManager.removeListener('hook:pre:complete', listener);

      expect(hookManager.listenerCount('hook:pre:complete')).toBe(0);
    });

    it('should support once() for single-fire listeners', async () => {
      const hook: ToolHookDefinition = {
        name: 'once-test-hook',
        type: 'pre',
        handlerPath: '/hooks/once.js',
        tools: [],
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const onceListener = vi.fn();
      hookManager.once('hook:pre:start', onceListener);

      // First execution
      await hookManager.executePreHooks({
        toolName: 'bash',
        arguments: {},
        taskId: 'task-once-1',
        invocationId: 'inv-once-1',
        timestamp: new Date(),
      });

      // Second execution
      await hookManager.executePreHooks({
        toolName: 'bash',
        arguments: {},
        taskId: 'task-once-2',
        invocationId: 'inv-once-2',
        timestamp: new Date(),
      });

      // Listener should only be called once
      expect(onceListener).toHaveBeenCalledTimes(1);
    });

    it('should allow registering multiple listeners for same event', async () => {
      const hook: ToolHookDefinition = {
        name: 'multi-listener-hook',
        type: 'pre',
        handlerPath: '/hooks/multi.js',
        tools: [],
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      hookManager.on('hook:pre:start', listener1);
      hookManager.on('hook:pre:start', listener2);
      hookManager.on('hook:pre:start', listener3);

      await hookManager.executePreHooks({
        toolName: 'bash',
        arguments: {},
        taskId: 'task-multi',
        invocationId: 'inv-multi',
        timestamp: new Date(),
      });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
    });

    it('should remove all listeners with removeAllListeners', () => {
      hookManager.on('hook:pre:start', vi.fn());
      hookManager.on('hook:pre:start', vi.fn());
      hookManager.on('hook:pre:complete', vi.fn());

      hookManager.removeAllListeners('hook:pre:start');

      expect(hookManager.listenerCount('hook:pre:start')).toBe(0);
      expect(hookManager.listenerCount('hook:pre:complete')).toBe(1);
    });

    it('should update hook configuration dynamically', async () => {
      const initialHook: ToolHookDefinition = {
        name: 'initial-hook',
        type: 'pre',
        handlerPath: '/hooks/initial.js',
        tools: [],
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [initialHook],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const events: string[] = [];
      hookManager.on('hook:pre:start', (e) => events.push(e.hookName));

      // Execute with initial config
      await hookManager.executePreHooks({
        toolName: 'bash',
        arguments: {},
        taskId: 'task-1',
        invocationId: 'inv-1',
        timestamp: new Date(),
      });

      expect(events).toEqual(['initial-hook']);

      // Update configuration
      const newHook: ToolHookDefinition = {
        name: 'new-hook',
        type: 'pre',
        handlerPath: '/hooks/new.js',
        tools: [],
        enabled: true,
      };

      hookManager.updateConfig([], {
        ...mockToolHookConfig,
        pre: [newHook],
      });

      // Execute with new config
      await hookManager.executePreHooks({
        toolName: 'bash',
        arguments: {},
        taskId: 'task-2',
        invocationId: 'inv-2',
        timestamp: new Date(),
      });

      expect(events).toEqual(['initial-hook', 'new-hook']);
    });

    it('should disable all hooks when config.enabled is set to false', async () => {
      const hook: ToolHookDefinition = {
        name: 'disabled-config-hook',
        type: 'pre',
        handlerPath: '/hooks/disabled.js',
        tools: [],
        enabled: true,
      };

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: [hook],
        enabled: false, // Globally disabled
      });

      const events: string[] = [];
      hookManager.on('hook:pre:start', (e) => events.push(e.hookName));

      const result = await hookManager.executePreHooks({
        toolName: 'bash',
        arguments: {},
        taskId: 'task-disabled',
        invocationId: 'inv-disabled',
        timestamp: new Date(),
      });

      expect(result).toEqual({ success: true });
      expect(events).toHaveLength(0);
    });

    it('should skip individual disabled hooks while running enabled ones', async () => {
      const hooks: ToolHookDefinition[] = [
        {
          name: 'enabled-hook',
          type: 'pre',
          handlerPath: '/hooks/enabled.js',
          tools: [],
          enabled: true,
        },
        {
          name: 'disabled-hook',
          type: 'pre',
          handlerPath: '/hooks/disabled.js',
          tools: [],
          enabled: false,
        },
        {
          name: 'another-enabled',
          type: 'pre',
          handlerPath: '/hooks/another.js',
          tools: [],
          enabled: true,
        },
      ];

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: hooks,
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const events: string[] = [];
      hookManager.on('hook:pre:start', (e) => events.push(e.hookName));

      await hookManager.executePreHooks({
        toolName: 'bash',
        arguments: {},
        taskId: 'task-mixed',
        invocationId: 'inv-mixed',
        timestamp: new Date(),
      });

      expect(events).toEqual(['enabled-hook', 'another-enabled']);
      expect(events).not.toContain('disabled-hook');
    });

    it('should filter hooks by tool name correctly', async () => {
      const hooks: ToolHookDefinition[] = [
        {
          name: 'bash-only',
          type: 'pre',
          handlerPath: '/hooks/bash.js',
          tools: ['bash'],
          enabled: true,
        },
        {
          name: 'write-only',
          type: 'pre',
          handlerPath: '/hooks/write.js',
          tools: ['Write'],
          enabled: true,
        },
        {
          name: 'universal',
          type: 'pre',
          handlerPath: '/hooks/universal.js',
          tools: [], // Empty means all tools
          enabled: true,
        },
      ];

      hookManager = new HookManager(projectPath, mockStore, [], {
        ...mockToolHookConfig,
        pre: hooks,
      });

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const bashEvents: string[] = [];
      hookManager.on('hook:pre:start', (e) => bashEvents.push(e.hookName));

      // Execute for bash tool
      await hookManager.executePreHooks({
        toolName: 'bash',
        arguments: {},
        taskId: 'task-bash',
        invocationId: 'inv-bash',
        timestamp: new Date(),
      });

      expect(bashEvents).toContain('bash-only');
      expect(bashEvents).toContain('universal');
      expect(bashEvents).not.toContain('write-only');

      // Clear and test Write tool
      bashEvents.length = 0;

      await hookManager.executePreHooks({
        toolName: 'Write',
        arguments: {},
        taskId: 'task-write',
        invocationId: 'inv-write',
        timestamp: new Date(),
      });

      expect(bashEvents).toContain('write-only');
      expect(bashEvents).toContain('universal');
      expect(bashEvents).not.toContain('bash-only');
    });
  });
});
