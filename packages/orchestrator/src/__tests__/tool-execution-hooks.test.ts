import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApexOrchestrator } from '../index';
import { TaskStore } from '../store';
import {
  ToolStartHookContext,
  ToolCompleteHookContext,
  ToolErrorHookContext,
  TaskStatus,
  generateTaskId,
} from '@apexcli/core';
import path from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

describe('Tool Execution Hooks', () => {
  let orchestrator: ApexOrchestrator;
  let tempDir: string;
  let store: TaskStore;

  beforeEach(async () => {
    // Create temp directory for tests
    tempDir = path.join(process.cwd(), '.test-tool-hooks');
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
    mkdirSync(tempDir, { recursive: true });

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({
      projectPath: tempDir,
    });

    await orchestrator.initialize();
    store = orchestrator.getStore();
  });

  afterEach(async () => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  describe('onToolStart', () => {
    it('should register hook and receive context when tool starts', async () => {
      const hookCallback = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hookCallback);

      // Create a tool start event
      const taskId = generateTaskId();
      const callId = 'test-call-1';
      const toolName = 'Read';
      const input = { filePath: '/test/file.txt' };
      const timestamp = new Date();

      // Emit tool:start event
      orchestrator.emit('tool:start', {
        taskId,
        toolName,
        input,
        callId,
        timestamp,
      });

      // Verify hook was called
      expect(hookCallback).toHaveBeenCalledTimes(1);

      const context: ToolStartHookContext = hookCallback.mock.calls[0][0];
      expect(context.toolName).toBe(toolName);
      expect(context.input).toEqual(input);
      expect(context.callId).toBe(callId);
      expect(context.taskId).toBe(taskId);
      expect(context.timestamp).toBe(timestamp);

      // Cleanup
      unsubscribe();
    });

    it('should include agent and stage info when available', async () => {
      const hookCallback = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hookCallback);

      const taskId = generateTaskId();
      const callId = 'test-call-2';

      // Mock an active tool execution with agent/stage info
      const toolExecution = {
        callId,
        toolName: 'Write',
        input: { filePath: '/test/file.ts' },
        startTime: new Date(),
        taskId,
        agentName: 'developer',
        stageName: 'implementation',
        status: 'in_progress' as const,
      };

      // Mock the getToolExecution method
      vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue(toolExecution);

      orchestrator.emit('tool:start', {
        taskId,
        toolName: 'Write',
        input: { filePath: '/test/file.ts' },
        callId,
        timestamp: new Date(),
      });

      const context: ToolStartHookContext = hookCallback.mock.calls[0][0];
      expect(context.agentName).toBe('developer');
      expect(context.stageName).toBe('implementation');

      unsubscribe();
    });

    it('should allow multiple hooks to be registered', async () => {
      const hook1 = vi.fn();
      const hook2 = vi.fn();

      const unsub1 = orchestrator.onToolStart(hook1);
      const unsub2 = orchestrator.onToolStart(hook2);

      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: 'Grep',
        input: { pattern: 'test' },
        callId: 'test-call-3',
        timestamp: new Date(),
      });

      expect(hook1).toHaveBeenCalledTimes(1);
      expect(hook2).toHaveBeenCalledTimes(1);

      unsub1();
      unsub2();
    });

    it('should unsubscribe hooks correctly', async () => {
      const hookCallback = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hookCallback);

      // Emit before unsubscribe
      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: 'Bash',
        input: { command: 'echo test' },
        callId: 'test-call-4',
        timestamp: new Date(),
      });

      expect(hookCallback).toHaveBeenCalledTimes(1);

      // Unsubscribe and emit again
      unsubscribe();
      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: 'Bash',
        input: { command: 'echo test2' },
        callId: 'test-call-5',
        timestamp: new Date(),
      });

      // Should still be called only once
      expect(hookCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('onToolComplete', () => {
    it('should register hook and receive context when tool completes successfully', async () => {
      const hookCallback = vi.fn();
      const unsubscribe = orchestrator.onToolComplete(hookCallback);

      const taskId = generateTaskId();
      const callId = 'test-call-6';
      const toolName = 'Read';
      const input = { filePath: '/test/file.txt' };
      const result = { success: true, output: 'file content' };
      const timing = { startTime: new Date(), endTime: new Date(), duration: 100 };
      const timestamp = new Date();

      // Mock active tool execution
      vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue({
        callId,
        toolName,
        input,
        startTime: timing.startTime,
        taskId,
        status: 'in_progress' as const,
      });

      // Emit successful tool:complete event
      orchestrator.emit('tool:complete', {
        taskId,
        toolName,
        callId,
        result,
        timing,
        timestamp,
      });

      expect(hookCallback).toHaveBeenCalledTimes(1);

      const context: ToolCompleteHookContext = hookCallback.mock.calls[0][0];
      expect(context.toolName).toBe(toolName);
      expect(context.input).toEqual(input);
      expect(context.callId).toBe(callId);
      expect(context.taskId).toBe(taskId);
      expect(context.timestamp).toBe(timestamp);
      expect(context.result).toEqual(result);
      expect(context.timing).toEqual(timing);

      unsubscribe();
    });

    it('should not trigger for failed tool executions', async () => {
      const hookCallback = vi.fn();
      const unsubscribe = orchestrator.onToolComplete(hookCallback);

      // Emit failed tool:complete event
      orchestrator.emit('tool:complete', {
        taskId: generateTaskId(),
        toolName: 'Write',
        callId: 'test-call-7',
        result: { success: false, error: 'Permission denied' },
        timing: { startTime: new Date(), endTime: new Date(), duration: 50 },
        timestamp: new Date(),
      });

      // Should not be called for failed execution
      expect(hookCallback).not.toHaveBeenCalled();

      unsubscribe();
    });
  });

  describe('onToolError', () => {
    it('should register hook and receive context when tool fails', async () => {
      const hookCallback = vi.fn();
      const unsubscribe = orchestrator.onToolError(hookCallback);

      const taskId = generateTaskId();
      const callId = 'test-call-8';
      const toolName = 'Write';
      const input = { filePath: '/restricted/file.txt' };
      const result = { success: false, error: 'Permission denied' };
      const timing = { startTime: new Date(), endTime: new Date(), duration: 25 };
      const timestamp = new Date();

      // Mock active tool execution
      vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue({
        callId,
        toolName,
        input,
        startTime: timing.startTime,
        taskId,
        status: 'in_progress' as const,
      });

      // Emit failed tool:complete event
      orchestrator.emit('tool:complete', {
        taskId,
        toolName,
        callId,
        result,
        timing,
        timestamp,
      });

      expect(hookCallback).toHaveBeenCalledTimes(1);

      const context: ToolErrorHookContext = hookCallback.mock.calls[0][0];
      expect(context.toolName).toBe(toolName);
      expect(context.input).toEqual(input);
      expect(context.callId).toBe(callId);
      expect(context.taskId).toBe(taskId);
      expect(context.timestamp).toBe(timestamp);
      expect(context.error).toBe('Permission denied');
      expect(context.timing).toEqual(timing);

      unsubscribe();
    });

    it('should not trigger for successful tool executions', async () => {
      const hookCallback = vi.fn();
      const unsubscribe = orchestrator.onToolError(hookCallback);

      // Emit successful tool:complete event
      orchestrator.emit('tool:complete', {
        taskId: generateTaskId(),
        toolName: 'Read',
        callId: 'test-call-9',
        result: { success: true, output: 'success' },
        timing: { startTime: new Date(), endTime: new Date(), duration: 100 },
        timestamp: new Date(),
      });

      // Should not be called for successful execution
      expect(hookCallback).not.toHaveBeenCalled();

      unsubscribe();
    });

    it('should handle missing error message gracefully', async () => {
      const hookCallback = vi.fn();
      const unsubscribe = orchestrator.onToolError(hookCallback);

      const taskId = generateTaskId();
      const callId = 'test-call-10';

      // Mock active tool execution
      vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue({
        callId,
        toolName: 'Bash',
        input: { command: 'invalid-command' },
        startTime: new Date(),
        taskId,
        status: 'in_progress' as const,
      });

      // Emit failed event without error message
      orchestrator.emit('tool:complete', {
        taskId,
        toolName: 'Bash',
        callId,
        result: { success: false },
        timing: { startTime: new Date(), endTime: new Date(), duration: 10 },
        timestamp: new Date(),
      });

      const context: ToolErrorHookContext = hookCallback.mock.calls[0][0];
      expect(context.error).toBe('Unknown error');

      unsubscribe();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete workflow: start -> complete', async () => {
      const startHook = vi.fn();
      const completeHook = vi.fn();
      const errorHook = vi.fn();

      const unsubStart = orchestrator.onToolStart(startHook);
      const unsubComplete = orchestrator.onToolComplete(completeHook);
      const unsubError = orchestrator.onToolError(errorHook);

      const taskId = generateTaskId();
      const callId = 'workflow-test-1';
      const toolName = 'Grep';
      const input = { pattern: 'function', path: '.' };

      // Mock tool execution
      vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue({
        callId,
        toolName,
        input,
        startTime: new Date(),
        taskId,
        status: 'in_progress' as const,
      });

      // Start event
      orchestrator.emit('tool:start', {
        taskId,
        toolName,
        input,
        callId,
        timestamp: new Date(),
      });

      // Complete event
      orchestrator.emit('tool:complete', {
        taskId,
        toolName,
        callId,
        result: { success: true, output: ['match1', 'match2'] },
        timing: { startTime: new Date(), endTime: new Date(), duration: 150 },
        timestamp: new Date(),
      });

      expect(startHook).toHaveBeenCalledTimes(1);
      expect(completeHook).toHaveBeenCalledTimes(1);
      expect(errorHook).not.toHaveBeenCalled();

      unsubStart();
      unsubComplete();
      unsubError();
    });

    it('should handle complete workflow: start -> error', async () => {
      const startHook = vi.fn();
      const completeHook = vi.fn();
      const errorHook = vi.fn();

      const unsubStart = orchestrator.onToolStart(startHook);
      const unsubComplete = orchestrator.onToolComplete(completeHook);
      const unsubError = orchestrator.onToolError(errorHook);

      const taskId = generateTaskId();
      const callId = 'workflow-test-2';
      const toolName = 'Bash';
      const input = { command: 'rm -rf /' };

      // Mock tool execution
      vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue({
        callId,
        toolName,
        input,
        startTime: new Date(),
        taskId,
        status: 'in_progress' as const,
      });

      // Start event
      orchestrator.emit('tool:start', {
        taskId,
        toolName,
        input,
        callId,
        timestamp: new Date(),
      });

      // Error event
      orchestrator.emit('tool:complete', {
        taskId,
        toolName,
        callId,
        result: { success: false, error: 'Dangerous operation blocked' },
        timing: { startTime: new Date(), endTime: new Date(), duration: 5 },
        timestamp: new Date(),
      });

      expect(startHook).toHaveBeenCalledTimes(1);
      expect(completeHook).not.toHaveBeenCalled();
      expect(errorHook).toHaveBeenCalledTimes(1);

      unsubStart();
      unsubComplete();
      unsubError();
    });
  });
});