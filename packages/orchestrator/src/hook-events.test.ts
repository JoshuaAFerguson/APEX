import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { HookManager, type HookExecutionStartEvent, type HookExecutionCompleteEvent } from './hook-manager';
import { TaskStore } from './store';
import {
  ToolHookConfig,
  ToolHookDefinition,
  PreHookContext,
  PostHookContext,
  PreHookResult,
} from '@apexcli/core';

// Mock dependencies
vi.mock('child_process');
vi.mock('fs');
vi.mock('util');

const mockExecAsync = vi.fn();
vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecAsync),
}));

const mockFs = vi.mocked(require('fs'));

describe('HookManager Event Emission', () => {
  let hookManager: HookManager;
  let mockStore: ReturnType<typeof vi.mocked<TaskStore>>;
  let projectPath: string;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStore = {
      addLog: vi.fn(),
    } as unknown as ReturnType<typeof vi.mocked<TaskStore>>;

    projectPath = '/test/project';

    // Mock fs functions
    mockFs.existsSync = vi.fn().mockReturnValue(true);
    mockFs.writeFileSync = vi.fn();
    mockFs.unlinkSync = vi.fn();
    mockFs.mkdirSync = vi.fn();

    // Default successful execution
    mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });
  });

  describe('pre-hook events', () => {
    it('should emit hook:pre:start event before executing pre-hook', async () => {
      const hook: ToolHookDefinition = {
        name: 'test-pre-hook',
        type: 'pre',
        handlerPath: '/hooks/test.js',
        tools: [],
        enabled: true,
      };

      const toolHookConfig: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], toolHookConfig);

      const startEvents: HookExecutionStartEvent[] = [];
      hookManager.on('hook:pre:start', (event) => {
        startEvents.push(event);
      });

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'ls -la' },
        taskId: 'task-123',
        agentName: 'developer',
        stageName: 'implementation',
        invocationId: 'inv-456',
        timestamp: new Date('2023-12-01T10:00:00Z'),
      };

      await hookManager.executePreHooks(context);

      expect(startEvents).toHaveLength(1);
      expect(startEvents[0]).toMatchObject({
        taskId: 'task-123',
        hookName: 'test-pre-hook',
        hookType: 'pre',
        toolName: 'bash',
      });
      expect(startEvents[0].timestamp).toBeInstanceOf(Date);
    });

    it('should emit hook:pre:complete event after successful pre-hook execution', async () => {
      const hook: ToolHookDefinition = {
        name: 'success-hook',
        type: 'pre',
        handlerPath: '/hooks/success.js',
        tools: [],
        enabled: true,
      };

      const toolHookConfig: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], toolHookConfig);

      const completeEvents: HookExecutionCompleteEvent[] = [];
      hookManager.on('hook:pre:complete', (event) => {
        completeEvents.push(event);
      });

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'ls -la' },
        taskId: 'task-123',
        agentName: 'developer',
        stageName: 'implementation',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      await hookManager.executePreHooks(context);

      expect(completeEvents).toHaveLength(1);
      expect(completeEvents[0]).toMatchObject({
        taskId: 'task-123',
        hookName: 'success-hook',
        hookType: 'pre',
        toolName: 'bash',
        success: true,
      });
      expect(completeEvents[0].duration).toBeGreaterThanOrEqual(0);
      expect(completeEvents[0].timestamp).toBeInstanceOf(Date);
      expect(completeEvents[0].error).toBeUndefined();
    });

    it('should emit hook:pre:complete event with result when hook returns data', async () => {
      const hook: ToolHookDefinition = {
        name: 'result-hook',
        type: 'pre',
        handlerPath: '/hooks/result.js',
        tools: [],
        enabled: true,
      };

      const toolHookConfig: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], toolHookConfig);

      const hookResult: PreHookResult = {
        action: 'modify',
        modifiedArguments: { command: 'ls -la --color=always' },
        metadata: { modified: true },
      };

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(hookResult),
        stderr: '',
      });

      const completeEvents: HookExecutionCompleteEvent[] = [];
      hookManager.on('hook:pre:complete', (event) => {
        completeEvents.push(event);
      });

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'ls -la' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      await hookManager.executePreHooks(context);

      expect(completeEvents).toHaveLength(1);
      expect(completeEvents[0]).toMatchObject({
        taskId: 'task-123',
        hookName: 'result-hook',
        hookType: 'pre',
        toolName: 'bash',
        success: true,
        result: hookResult,
      });
    });

    it('should emit hook:pre:complete event with error when hook fails', async () => {
      const hook: ToolHookDefinition = {
        name: 'failing-hook',
        type: 'pre',
        handlerPath: '/hooks/fail.js',
        tools: [],
        enabled: true,
      };

      const toolHookConfig: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], toolHookConfig);

      mockExecAsync.mockRejectedValue(new Error('Hook execution failed'));

      const completeEvents: HookExecutionCompleteEvent[] = [];
      hookManager.on('hook:pre:complete', (event) => {
        completeEvents.push(event);
      });

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'ls -la' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      await hookManager.executePreHooks(context);

      expect(completeEvents).toHaveLength(1);
      expect(completeEvents[0]).toMatchObject({
        taskId: 'task-123',
        hookName: 'failing-hook',
        hookType: 'pre',
        toolName: 'bash',
        success: false,
        error: 'Hook execution failed',
      });
      expect(completeEvents[0].result).toBeUndefined();
    });

    it('should emit events for multiple pre-hooks in correct order', async () => {
      const hook1: ToolHookDefinition = {
        name: 'first-hook',
        type: 'pre',
        handlerPath: '/hooks/first.js',
        tools: [],
        priority: 100,
        enabled: true,
      };

      const hook2: ToolHookDefinition = {
        name: 'second-hook',
        type: 'pre',
        handlerPath: '/hooks/second.js',
        tools: [],
        priority: 200,
        enabled: true,
      };

      const toolHookConfig: ToolHookConfig = {
        pre: [hook1, hook2],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], toolHookConfig);

      const events: Array<{ type: string; hookName: string; timestamp: Date }> = [];

      hookManager.on('hook:pre:start', (event) => {
        events.push({ type: 'start', hookName: event.hookName, timestamp: event.timestamp });
      });

      hookManager.on('hook:pre:complete', (event) => {
        events.push({ type: 'complete', hookName: event.hookName, timestamp: event.timestamp });
      });

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'ls -la' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      await hookManager.executePreHooks(context);

      expect(events).toHaveLength(4);
      // High priority hook (hook2) should execute first
      expect(events[0]).toMatchObject({ type: 'start', hookName: 'second-hook' });
      expect(events[1]).toMatchObject({ type: 'complete', hookName: 'second-hook' });
      expect(events[2]).toMatchObject({ type: 'start', hookName: 'first-hook' });
      expect(events[3]).toMatchObject({ type: 'complete', hookName: 'first-hook' });

      // Verify timestamps are in chronological order
      expect(events[1].timestamp.getTime()).toBeGreaterThanOrEqual(events[0].timestamp.getTime());
      expect(events[2].timestamp.getTime()).toBeGreaterThanOrEqual(events[1].timestamp.getTime());
      expect(events[3].timestamp.getTime()).toBeGreaterThanOrEqual(events[2].timestamp.getTime());
    });
  });

  describe('post-hook events', () => {
    it('should emit hook:post:start event before executing post-hook', async () => {
      const hook: ToolHookDefinition = {
        name: 'test-post-hook',
        type: 'post',
        handlerPath: '/hooks/post.js',
        tools: [],
        enabled: true,
      };

      const toolHookConfig: ToolHookConfig = {
        pre: [],
        post: [hook],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], toolHookConfig);

      const startEvents: HookExecutionStartEvent[] = [];
      hookManager.on('hook:post:start', (event) => {
        startEvents.push(event);
      });

      const context: PostHookContext = {
        toolName: 'bash',
        arguments: { command: 'ls -la' },
        taskId: 'task-456',
        agentName: 'developer',
        stageName: 'implementation',
        invocationId: 'inv-789',
        timestamp: new Date(),
        result: {
          success: true,
          output: 'file1.txt\nfile2.txt',
          duration: 1000,
        },
      };

      await hookManager.executePostHooks(context);

      expect(startEvents).toHaveLength(1);
      expect(startEvents[0]).toMatchObject({
        taskId: 'task-456',
        hookName: 'test-post-hook',
        hookType: 'post',
        toolName: 'bash',
      });
    });

    it('should emit hook:post:complete event after successful post-hook execution', async () => {
      const hook: ToolHookDefinition = {
        name: 'success-post-hook',
        type: 'post',
        handlerPath: '/hooks/post-success.js',
        tools: [],
        enabled: true,
      };

      const toolHookConfig: ToolHookConfig = {
        pre: [],
        post: [hook],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], toolHookConfig);

      const completeEvents: HookExecutionCompleteEvent[] = [];
      hookManager.on('hook:post:complete', (event) => {
        completeEvents.push(event);
      });

      const context: PostHookContext = {
        toolName: 'git',
        arguments: { command: 'status' },
        taskId: 'task-456',
        invocationId: 'inv-789',
        timestamp: new Date(),
        result: {
          success: true,
          output: 'nothing to commit',
          duration: 500,
        },
      };

      await hookManager.executePostHooks(context);

      expect(completeEvents).toHaveLength(1);
      expect(completeEvents[0]).toMatchObject({
        taskId: 'task-456',
        hookName: 'success-post-hook',
        hookType: 'post',
        toolName: 'git',
        success: true,
      });
    });

    it('should emit hook:post:complete event with error when post-hook fails', async () => {
      const hook: ToolHookDefinition = {
        name: 'failing-post-hook',
        type: 'post',
        handlerPath: '/hooks/post-fail.js',
        tools: [],
        enabled: true,
      };

      const toolHookConfig: ToolHookConfig = {
        pre: [],
        post: [hook],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], toolHookConfig);

      mockExecAsync.mockRejectedValue(new Error('Post-hook error'));

      const completeEvents: HookExecutionCompleteEvent[] = [];
      hookManager.on('hook:post:complete', (event) => {
        completeEvents.push(event);
      });

      const context: PostHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-456',
        invocationId: 'inv-789',
        timestamp: new Date(),
        result: {
          success: false,
          error: 'Command failed',
          duration: 1200,
        },
      };

      await hookManager.executePostHooks(context);

      expect(completeEvents).toHaveLength(1);
      expect(completeEvents[0]).toMatchObject({
        taskId: 'task-456',
        hookName: 'failing-post-hook',
        hookType: 'post',
        toolName: 'bash',
        success: false,
        error: 'Post-hook error',
      });
    });
  });

  describe('event timing and duration calculation', () => {
    it('should calculate accurate duration between start and complete events', async () => {
      const hook: ToolHookDefinition = {
        name: 'timed-hook',
        type: 'pre',
        handlerPath: '/hooks/timed.js',
        tools: [],
        enabled: true,
      };

      const toolHookConfig: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], toolHookConfig);

      // Mock execution with delay
      mockExecAsync.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({ stdout: '', stderr: '' });
          }, 100); // 100ms delay
        });
      });

      let startTime: Date;
      let completeTime: Date;
      let duration: number;

      hookManager.on('hook:pre:start', (event) => {
        startTime = event.timestamp;
      });

      hookManager.on('hook:pre:complete', (event) => {
        completeTime = event.timestamp;
        duration = event.duration;
      });

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'sleep 0.1' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      await hookManager.executePreHooks(context);

      expect(duration).toBeGreaterThanOrEqual(90); // Allow some variance
      expect(duration).toBeLessThan(200); // But not too much
      expect(completeTime!.getTime() - startTime!.getTime()).toBeGreaterThanOrEqual(90);
    });

    it('should emit events with correct timestamps even when hooks fail', async () => {
      const hook: ToolHookDefinition = {
        name: 'timing-fail-hook',
        type: 'pre',
        handlerPath: '/hooks/timing-fail.js',
        tools: [],
        enabled: true,
      };

      const toolHookConfig: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], toolHookConfig);

      // Mock execution that fails after delay
      mockExecAsync.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Delayed failure'));
          }, 50);
        });
      });

      let startEvent: HookExecutionStartEvent;
      let completeEvent: HookExecutionCompleteEvent;

      hookManager.on('hook:pre:start', (event) => {
        startEvent = event;
      });

      hookManager.on('hook:pre:complete', (event) => {
        completeEvent = event;
      });

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'fail' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      await hookManager.executePreHooks(context);

      expect(startEvent!).toBeDefined();
      expect(completeEvent!).toBeDefined();
      expect(completeEvent!.success).toBe(false);
      expect(completeEvent!.duration).toBeGreaterThanOrEqual(40);
      expect(completeEvent!.timestamp.getTime()).toBeGreaterThan(startEvent!.timestamp.getTime());
    });
  });

  describe('event listener management', () => {
    it('should support multiple event listeners', async () => {
      const hook: ToolHookDefinition = {
        name: 'multi-listener-hook',
        type: 'pre',
        handlerPath: '/hooks/multi.js',
        tools: [],
        enabled: true,
      };

      const toolHookConfig: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], toolHookConfig);

      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      hookManager.on('hook:pre:start', listener1);
      hookManager.on('hook:pre:start', listener2);
      hookManager.on('hook:pre:complete', listener3);

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      await hookManager.executePreHooks(context);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);

      expect(listener1).toHaveBeenCalledWith(expect.objectContaining({
        hookName: 'multi-listener-hook',
        hookType: 'pre',
      }));

      expect(listener2).toHaveBeenCalledWith(expect.objectContaining({
        hookName: 'multi-listener-hook',
        hookType: 'pre',
      }));

      expect(listener3).toHaveBeenCalledWith(expect.objectContaining({
        hookName: 'multi-listener-hook',
        hookType: 'pre',
        success: true,
      }));
    });

    it('should handle event listener removal correctly', async () => {
      const hook: ToolHookDefinition = {
        name: 'removable-listener-hook',
        type: 'pre',
        handlerPath: '/hooks/removable.js',
        tools: [],
        enabled: true,
      };

      const toolHookConfig: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], toolHookConfig);

      const listener1 = jest.fn();
      const listener2 = jest.fn();

      hookManager.on('hook:pre:start', listener1);
      hookManager.on('hook:pre:start', listener2);

      // Remove one listener
      hookManager.off('hook:pre:start', listener1);

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      await hookManager.executePreHooks(context);

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in event listeners gracefully', async () => {
      const hook: ToolHookDefinition = {
        name: 'error-listener-hook',
        type: 'pre',
        handlerPath: '/hooks/error-listener.js',
        tools: [],
        enabled: true,
      };

      const toolHookConfig: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], toolHookConfig);

      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = jest.fn();

      hookManager.on('hook:pre:start', errorListener);
      hookManager.on('hook:pre:start', goodListener);

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      // Hook execution should still complete despite listener error
      await expect(hookManager.executePreHooks(context)).resolves.not.toThrow();

      expect(errorListener).toHaveBeenCalledTimes(1);
      expect(goodListener).toHaveBeenCalledTimes(1);
    });
  });
});