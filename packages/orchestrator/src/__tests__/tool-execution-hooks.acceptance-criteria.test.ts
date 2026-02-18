import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApexOrchestrator } from '../index';
import {
  ToolStartHookContext,
  ToolCompleteHookContext,
  ToolErrorHookContext,
  generateTaskId,
} from '@apexcli/core';
import path from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

/**
 * Acceptance Criteria Verification Tests
 *
 * This test suite validates that the tool execution hooks implementation
 * meets all the acceptance criteria specified in the feature requirements:
 *
 * - New hook types: onToolStart, onToolComplete, onToolError
 * - Hooks receive tool name, input parameters, and execution context
 * - Hook registration API in ApexOrchestrator
 * - Events emitted via existing EventEmitter
 */
describe('Tool Execution Hooks - Acceptance Criteria', () => {
  let orchestrator: ApexOrchestrator;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), '.test-tool-hooks-acceptance');
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
    mkdirSync(tempDir, { recursive: true });

    orchestrator = new ApexOrchestrator({
      projectPath: tempDir,
    });

    await orchestrator.initialize();
  });

  afterEach(async () => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  describe('AC1: New hook types onToolStart, onToolComplete, onToolError', () => {
    it('should provide onToolStart method on ApexOrchestrator', () => {
      expect(typeof orchestrator.onToolStart).toBe('function');
      expect(orchestrator.onToolStart).toBeDefined();
    });

    it('should provide onToolComplete method on ApexOrchestrator', () => {
      expect(typeof orchestrator.onToolComplete).toBe('function');
      expect(orchestrator.onToolComplete).toBeDefined();
    });

    it('should provide onToolError method on ApexOrchestrator', () => {
      expect(typeof orchestrator.onToolError).toBe('function');
      expect(orchestrator.onToolError).toBeDefined();
    });

    it('should return unsubscribe functions for all hook types', () => {
      const unsubStart = orchestrator.onToolStart(() => {});
      const unsubComplete = orchestrator.onToolComplete(() => {});
      const unsubError = orchestrator.onToolError(() => {});

      expect(typeof unsubStart).toBe('function');
      expect(typeof unsubComplete).toBe('function');
      expect(typeof unsubError).toBe('function');

      // Clean up
      unsubStart();
      unsubComplete();
      unsubError();
    });
  });

  describe('AC2: Hooks receive tool name, input parameters, and execution context', () => {
    it('should provide tool name in onToolStart hook', () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hook);

      const expectedToolName = 'Read';
      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: expectedToolName,
        input: { filePath: 'test.txt' },
        callId: 'ac2-tool-name-test',
        timestamp: new Date(),
      });

      expect(hook).toHaveBeenCalledTimes(1);
      const context: ToolStartHookContext = hook.mock.calls[0][0];
      expect(context.toolName).toBe(expectedToolName);

      unsubscribe();
    });

    it('should provide input parameters in onToolStart hook', () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hook);

      const expectedInput = {
        filePath: 'test.txt',
        encoding: 'utf8',
        options: { recursive: true }
      };

      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: 'Read',
        input: expectedInput,
        callId: 'ac2-input-test',
        timestamp: new Date(),
      });

      const context: ToolStartHookContext = hook.mock.calls[0][0];
      expect(context.input).toEqual(expectedInput);

      unsubscribe();
    });

    it('should provide execution context (taskId, callId, timestamp) in onToolStart', () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hook);

      const expectedTaskId = generateTaskId();
      const expectedCallId = 'ac2-context-test';
      const expectedTimestamp = new Date();

      orchestrator.emit('tool:start', {
        taskId: expectedTaskId,
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        callId: expectedCallId,
        timestamp: expectedTimestamp,
      });

      const context: ToolStartHookContext = hook.mock.calls[0][0];
      expect(context.taskId).toBe(expectedTaskId);
      expect(context.callId).toBe(expectedCallId);
      expect(context.timestamp).toBe(expectedTimestamp);

      unsubscribe();
    });

    it('should provide agent and stage context when available', () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hook);

      // Mock tool execution with agent/stage context
      vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue({
        callId: 'ac2-agent-stage-test',
        toolName: 'Write',
        input: { filePath: 'output.txt', content: 'test' },
        startTime: new Date(),
        taskId: generateTaskId(),
        agentName: 'developer',
        stageName: 'implementation',
        status: 'in_progress' as const,
      });

      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: 'Write',
        input: { filePath: 'output.txt', content: 'test' },
        callId: 'ac2-agent-stage-test',
        timestamp: new Date(),
      });

      const context: ToolStartHookContext = hook.mock.calls[0][0];
      expect(context.agentName).toBe('developer');
      expect(context.stageName).toBe('implementation');

      unsubscribe();
    });

    it('should provide complete execution context in onToolComplete hook', () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolComplete(hook);

      const expectedResult = { success: true, output: 'file contents' };
      const expectedTiming = {
        startTime: new Date(),
        endTime: new Date(),
        duration: 150,
      };

      // Mock tool execution
      vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue({
        callId: 'ac2-complete-context-test',
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        startTime: expectedTiming.startTime,
        taskId: generateTaskId(),
        status: 'in_progress' as const,
      });

      orchestrator.emit('tool:complete', {
        taskId: generateTaskId(),
        toolName: 'Read',
        callId: 'ac2-complete-context-test',
        result: expectedResult,
        timing: expectedTiming,
        timestamp: new Date(),
      });

      const context: ToolCompleteHookContext = hook.mock.calls[0][0];
      expect(context.result).toEqual(expectedResult);
      expect(context.timing).toEqual(expectedTiming);

      unsubscribe();
    });

    it('should provide error context in onToolError hook', () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolError(hook);

      const expectedError = 'File not found';
      const expectedTiming = {
        startTime: new Date(),
        endTime: new Date(),
        duration: 25,
      };

      // Mock tool execution
      vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue({
        callId: 'ac2-error-context-test',
        toolName: 'Read',
        input: { filePath: 'nonexistent.txt' },
        startTime: expectedTiming.startTime,
        taskId: generateTaskId(),
        status: 'in_progress' as const,
      });

      orchestrator.emit('tool:complete', {
        taskId: generateTaskId(),
        toolName: 'Read',
        callId: 'ac2-error-context-test',
        result: { success: false, error: expectedError },
        timing: expectedTiming,
        timestamp: new Date(),
      });

      const context: ToolErrorHookContext = hook.mock.calls[0][0];
      expect(context.error).toBe(expectedError);
      expect(context.timing).toEqual(expectedTiming);

      unsubscribe();
    });
  });

  describe('AC3: Hook registration API in ApexOrchestrator', () => {
    it('should allow registering multiple hooks of the same type', () => {
      const hook1 = vi.fn();
      const hook2 = vi.fn();
      const hook3 = vi.fn();

      const unsub1 = orchestrator.onToolStart(hook1);
      const unsub2 = orchestrator.onToolStart(hook2);
      const unsub3 = orchestrator.onToolStart(hook3);

      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        callId: 'ac3-multiple-hooks-test',
        timestamp: new Date(),
      });

      // All hooks should be called
      expect(hook1).toHaveBeenCalledTimes(1);
      expect(hook2).toHaveBeenCalledTimes(1);
      expect(hook3).toHaveBeenCalledTimes(1);

      // Clean up
      unsub1();
      unsub2();
      unsub3();
    });

    it('should allow selective unregistration of hooks', () => {
      const hook1 = vi.fn();
      const hook2 = vi.fn();

      const unsub1 = orchestrator.onToolStart(hook1);
      const unsub2 = orchestrator.onToolStart(hook2);

      // Unregister first hook
      unsub1();

      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        callId: 'ac3-selective-unreg-test',
        timestamp: new Date(),
      });

      // Only second hook should be called
      expect(hook1).not.toHaveBeenCalled();
      expect(hook2).toHaveBeenCalledTimes(1);

      // Clean up
      unsub2();
    });

    it('should provide working registration API for all hook types', () => {
      const startHook = vi.fn();
      const completeHook = vi.fn();
      const errorHook = vi.fn();

      // Register hooks
      const unsubStart = orchestrator.onToolStart(startHook);
      const unsubComplete = orchestrator.onToolComplete(completeHook);
      const unsubError = orchestrator.onToolError(errorHook);

      // Mock tool execution
      vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue({
        callId: 'ac3-all-types-test',
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        startTime: new Date(),
        taskId: generateTaskId(),
        status: 'in_progress' as const,
      });

      const taskId = generateTaskId();
      const callId = 'ac3-all-types-test';

      // Emit start event
      orchestrator.emit('tool:start', {
        taskId,
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        callId,
        timestamp: new Date(),
      });

      // Emit successful complete event
      orchestrator.emit('tool:complete', {
        taskId,
        toolName: 'Read',
        callId,
        result: { success: true, output: 'success' },
        timing: { startTime: new Date(), endTime: new Date(), duration: 100 },
        timestamp: new Date(),
      });

      expect(startHook).toHaveBeenCalledTimes(1);
      expect(completeHook).toHaveBeenCalledTimes(1);
      expect(errorHook).not.toHaveBeenCalled();

      // Test error hook with another event
      const errorTaskId = generateTaskId();
      const errorCallId = 'ac3-error-test';

      orchestrator.emit('tool:start', {
        taskId: errorTaskId,
        toolName: 'Write',
        input: { filePath: 'readonly.txt', content: 'test' },
        callId: errorCallId,
        timestamp: new Date(),
      });

      orchestrator.emit('tool:complete', {
        taskId: errorTaskId,
        toolName: 'Write',
        callId: errorCallId,
        result: { success: false, error: 'Permission denied' },
        timing: { startTime: new Date(), endTime: new Date(), duration: 50 },
        timestamp: new Date(),
      });

      expect(startHook).toHaveBeenCalledTimes(2);
      expect(completeHook).toHaveBeenCalledTimes(1); // Still 1, error doesn't trigger complete
      expect(errorHook).toHaveBeenCalledTimes(1);

      // Clean up
      unsubStart();
      unsubComplete();
      unsubError();
    });
  });

  describe('AC4: Events emitted via existing EventEmitter', () => {
    it('should use existing EventEmitter infrastructure for tool:start events', () => {
      // Verify that orchestrator has EventEmitter methods
      expect(typeof orchestrator.on).toBe('function');
      expect(typeof orchestrator.emit).toBe('function');
      expect(typeof orchestrator.off).toBe('function');

      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hook);

      // The hook registration should use the existing EventEmitter
      // We can verify this by emitting the event directly
      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        callId: 'ac4-eventemitter-test',
        timestamp: new Date(),
      });

      expect(hook).toHaveBeenCalledTimes(1);
      unsubscribe();
    });

    it('should use existing EventEmitter infrastructure for tool:complete events', () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolComplete(hook);

      // Mock tool execution
      vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue({
        callId: 'ac4-complete-emit-test',
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        startTime: new Date(),
        taskId: generateTaskId(),
        status: 'in_progress' as const,
      });

      // Emit tool:complete event directly using existing EventEmitter
      orchestrator.emit('tool:complete', {
        taskId: generateTaskId(),
        toolName: 'Read',
        callId: 'ac4-complete-emit-test',
        result: { success: true, output: 'content' },
        timing: { startTime: new Date(), endTime: new Date(), duration: 100 },
        timestamp: new Date(),
      });

      expect(hook).toHaveBeenCalledTimes(1);
      unsubscribe();
    });

    it('should integrate seamlessly with existing event system', () => {
      // Test that hooks don't interfere with other event listeners
      const otherEventListener = vi.fn();
      orchestrator.on('tool:start', otherEventListener);

      const hookListener = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hookListener);

      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        callId: 'ac4-integration-test',
        timestamp: new Date(),
      });

      // Both listeners should be called
      expect(otherEventListener).toHaveBeenCalledTimes(1);
      expect(hookListener).toHaveBeenCalledTimes(1);

      // Clean up
      orchestrator.off('tool:start', otherEventListener);
      unsubscribe();
    });

    it('should properly clean up event listeners on unsubscribe', () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hook);

      // Emit event - should trigger hook
      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: 'Read',
        input: { filePath: 'test1.txt' },
        callId: 'ac4-cleanup-test-1',
        timestamp: new Date(),
      });

      expect(hook).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Emit another event - should NOT trigger hook
      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: 'Read',
        input: { filePath: 'test2.txt' },
        callId: 'ac4-cleanup-test-2',
        timestamp: new Date(),
      });

      // Hook should still only have been called once
      expect(hook).toHaveBeenCalledTimes(1);
    });
  });

  describe('Full Acceptance Criteria Integration Test', () => {
    it('should satisfy all acceptance criteria in a complete workflow', () => {
      // Track all hook invocations
      const hookInvocations: {
        type: string;
        toolName: string;
        taskId: string;
        callId: string;
        timestamp: Date;
        additionalData?: any;
      }[] = [];

      // Register all hook types
      const unsubStart = orchestrator.onToolStart((context) => {
        hookInvocations.push({
          type: 'start',
          toolName: context.toolName,
          taskId: context.taskId,
          callId: context.callId,
          timestamp: context.timestamp,
          additionalData: { input: context.input },
        });
      });

      const unsubComplete = orchestrator.onToolComplete((context) => {
        hookInvocations.push({
          type: 'complete',
          toolName: context.toolName,
          taskId: context.taskId,
          callId: context.callId,
          timestamp: context.timestamp,
          additionalData: { result: context.result, timing: context.timing },
        });
      });

      const unsubError = orchestrator.onToolError((context) => {
        hookInvocations.push({
          type: 'error',
          toolName: context.toolName,
          taskId: context.taskId,
          callId: context.callId,
          timestamp: context.timestamp,
          additionalData: { error: context.error, timing: context.timing },
        });
      });

      // Mock tool execution
      vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue({
        callId: 'ac-integration-test',
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        startTime: new Date(),
        taskId: generateTaskId(),
        agentName: 'tester',
        stageName: 'testing',
        status: 'in_progress' as const,
      });

      const taskId = generateTaskId();
      const callId = 'ac-integration-test';
      const toolName = 'Read';
      const input = { filePath: 'test.txt' };
      const timestamp = new Date();

      // Execute complete tool lifecycle
      // 1. Tool starts
      orchestrator.emit('tool:start', {
        taskId,
        toolName,
        input,
        callId,
        timestamp,
      });

      // 2. Tool completes successfully
      orchestrator.emit('tool:complete', {
        taskId,
        toolName,
        callId,
        result: { success: true, output: 'file content' },
        timing: { startTime: new Date(), endTime: new Date(), duration: 100 },
        timestamp: new Date(),
      });

      // Verify AC1: All hook types were triggered
      expect(hookInvocations).toHaveLength(2);
      expect(hookInvocations[0].type).toBe('start');
      expect(hookInvocations[1].type).toBe('complete');

      // Verify AC2: Hooks received tool name, input, and execution context
      const startInvocation = hookInvocations[0];
      expect(startInvocation.toolName).toBe(toolName);
      expect(startInvocation.taskId).toBe(taskId);
      expect(startInvocation.callId).toBe(callId);
      expect(startInvocation.additionalData.input).toEqual(input);

      const completeInvocation = hookInvocations[1];
      expect(completeInvocation.toolName).toBe(toolName);
      expect(completeInvocation.additionalData.result.success).toBe(true);
      expect(completeInvocation.additionalData.timing).toBeDefined();

      // Verify AC3: Hook registration API worked
      expect(typeof unsubStart).toBe('function');
      expect(typeof unsubComplete).toBe('function');
      expect(typeof unsubError).toBe('function');

      // Verify AC4: Events were emitted via existing EventEmitter
      // (This is implicitly verified by the fact that the hooks were called)

      // Test error scenario
      hookInvocations.length = 0; // Reset

      const errorTaskId = generateTaskId();
      const errorCallId = 'ac-integration-error-test';

      // Tool starts and fails
      orchestrator.emit('tool:start', {
        taskId: errorTaskId,
        toolName: 'Write',
        input: { filePath: 'readonly.txt', content: 'test' },
        callId: errorCallId,
        timestamp: new Date(),
      });

      orchestrator.emit('tool:complete', {
        taskId: errorTaskId,
        toolName: 'Write',
        callId: errorCallId,
        result: { success: false, error: 'Permission denied' },
        timing: { startTime: new Date(), endTime: new Date(), duration: 50 },
        timestamp: new Date(),
      });

      // Verify error workflow
      expect(hookInvocations).toHaveLength(2);
      expect(hookInvocations[0].type).toBe('start');
      expect(hookInvocations[1].type).toBe('error');
      expect(hookInvocations[1].additionalData.error).toBe('Permission denied');

      // Clean up
      unsubStart();
      unsubComplete();
      unsubError();
    });
  });
});