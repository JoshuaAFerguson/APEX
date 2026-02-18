import {
  ToolInvocationRecorder,
  globalRecorder,
  ToolInvocationQueryOptions,
  ToolInvocationRecord,
} from '../tool-invocation-recorder.js';
import { ToolInvocation, ToolExecution } from '@apexcli/core';

describe('ToolInvocationRecorder', () => {
  let recorder: ToolInvocationRecorder;

  beforeEach(() => {
    recorder = new ToolInvocationRecorder();
    // Also clear the global recorder for clean tests
    globalRecorder.clear();
  });

  afterEach(() => {
    recorder.clear();
    globalRecorder.clear();
  });

  describe('recordInvocation', () => {
    it('should record a tool invocation with timestamp', () => {
      const invocation: ToolInvocation = {
        toolName: 'Read',
        parameters: { file_path: '/test.txt' },
        context: { taskId: 'task-1', agentName: 'developer' },
      };

      const before = new Date();
      const record = recorder.recordInvocation(invocation);
      const after = new Date();

      expect(record.invocation).toEqual(invocation);
      expect(record.recordedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(record.recordedAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(record.execution).toBeUndefined();
    });

    it('should record multiple invocations', () => {
      const invocation1: ToolInvocation = {
        toolName: 'Read',
        parameters: { file_path: '/test1.txt' },
      };

      const invocation2: ToolInvocation = {
        toolName: 'Write',
        parameters: { file_path: '/test2.txt', content: 'test' },
      };

      recorder.recordInvocation(invocation1);
      recorder.recordInvocation(invocation2);

      expect(recorder.getInvocationCount()).toBe(2);
      const allInvocations = recorder.getAllInvocations();
      expect(allInvocations).toHaveLength(2);
      expect(allInvocations[0].invocation.toolName).toBe('Read');
      expect(allInvocations[1].invocation.toolName).toBe('Write');
    });
  });

  describe('recordExecution', () => {
    it('should update invocation with execution details using requestId', () => {
      const invocation: ToolInvocation = {
        toolName: 'Read',
        parameters: { file_path: '/test.txt' },
        requestId: 'req-123',
      };

      const execution: ToolExecution = {
        callId: 'call-123',
        toolName: 'Read',
        input: { file_path: '/test.txt' },
        startTime: new Date(),
        status: 'completed',
        result: { success: true, output: 'file content' },
      };

      recorder.recordInvocation(invocation);
      const updated = recorder.recordExecution('req-123', execution);

      expect(updated).toBe(true);
      const record = recorder.getLatestInvocation();
      expect(record?.execution).toEqual(execution);
    });

    it('should return false when requestId not found', () => {
      const execution: ToolExecution = {
        callId: 'call-123',
        toolName: 'Read',
        input: { file_path: '/test.txt' },
        startTime: new Date(),
        status: 'completed',
      };

      const updated = recorder.recordExecution('non-existent', execution);
      expect(updated).toBe(false);
    });
  });

  describe('recordExecutionByCallId', () => {
    it('should update invocation with execution using callId', () => {
      const invocation: ToolInvocation = {
        toolName: 'Read',
        parameters: { file_path: '/test.txt' },
        context: { taskId: 'task-1', agentName: 'developer' },
      };

      const execution: ToolExecution = {
        callId: 'call-123',
        toolName: 'Read',
        input: { file_path: '/test.txt' },
        taskId: 'task-1',
        agentName: 'developer',
        startTime: new Date(),
        status: 'completed',
      };

      recorder.recordInvocation(invocation);
      const updated = recorder.recordExecutionByCallId('call-123', execution);

      expect(updated).toBe(true);
      const record = recorder.getLatestInvocation();
      expect(record?.execution).toEqual(execution);
    });

    it('should match invocation by context when callId not found', () => {
      const invocation: ToolInvocation = {
        toolName: 'Read',
        parameters: { file_path: '/test.txt' },
        context: { taskId: 'task-1', agentName: 'developer', stageName: 'implementation' },
      };

      const execution: ToolExecution = {
        callId: 'call-456',
        toolName: 'Read',
        input: { file_path: '/test.txt' },
        taskId: 'task-1',
        agentName: 'developer',
        stageName: 'implementation',
        startTime: new Date(),
        status: 'completed',
      };

      recorder.recordInvocation(invocation);
      const updated = recorder.recordExecutionByCallId('different-call-id', execution);

      expect(updated).toBe(true);
      const record = recorder.getLatestInvocation();
      expect(record?.execution).toEqual(execution);
    });
  });

  describe('queryInvocations', () => {
    beforeEach(() => {
      // Setup test data
      const invocations: ToolInvocation[] = [
        {
          toolName: 'Read',
          parameters: { file_path: '/test1.txt' },
          context: { taskId: 'task-1', agentName: 'developer', stageName: 'implementation' },
        },
        {
          toolName: 'Write',
          parameters: { file_path: '/test2.txt', content: 'test' },
          context: { taskId: 'task-1', agentName: 'developer', stageName: 'implementation' },
        },
        {
          toolName: 'Read',
          parameters: { file_path: '/test3.txt' },
          context: { taskId: 'task-2', agentName: 'reviewer', stageName: 'review' },
        },
        {
          toolName: 'Bash',
          parameters: { command: 'ls' },
          context: { taskId: 'task-2', agentName: 'developer', stageName: 'testing' },
        },
      ];

      invocations.forEach(inv => recorder.recordInvocation(inv));
    });

    it('should return all invocations when no filters applied', () => {
      const results = recorder.queryInvocations();
      expect(results).toHaveLength(4);
    });

    it('should filter by tool name', () => {
      const results = recorder.queryInvocations({ toolName: 'Read' });
      expect(results).toHaveLength(2);
      expect(results.every(r => r.invocation.toolName === 'Read')).toBe(true);
    });

    it('should filter by task ID', () => {
      const results = recorder.queryInvocations({ taskId: 'task-1' });
      expect(results).toHaveLength(2);
      expect(results.every(r => r.invocation.context?.taskId === 'task-1')).toBe(true);
    });

    it('should filter by agent name', () => {
      const results = recorder.queryInvocations({ agentName: 'developer' });
      expect(results).toHaveLength(3);
      expect(results.every(r => r.invocation.context?.agentName === 'developer')).toBe(true);
    });

    it('should filter by stage name', () => {
      const results = recorder.queryInvocations({ stageName: 'implementation' });
      expect(results).toHaveLength(2);
      expect(results.every(r => r.invocation.context?.stageName === 'implementation')).toBe(true);
    });

    it('should filter by parameters', () => {
      const results = recorder.queryInvocations({
        parameters: { file_path: '/test1.txt' },
      });
      expect(results).toHaveLength(1);
      expect(results[0].invocation.parameters.file_path).toBe('/test1.txt');
    });

    it('should filter by multiple criteria', () => {
      const results = recorder.queryInvocations({
        toolName: 'Read',
        taskId: 'task-1',
        agentName: 'developer',
      });
      expect(results).toHaveLength(1);
      expect(results[0].invocation.toolName).toBe('Read');
      expect(results[0].invocation.context?.taskId).toBe('task-1');
    });

    it('should apply limit to results', () => {
      const results = recorder.queryInvocations({ limit: 2 });
      expect(results).toHaveLength(2);
    });

    it('should filter by time range', async () => {
      const startTime = new Date();

      // Wait a bit and add another invocation
      await new Promise(resolve => setTimeout(resolve, 10));

      recorder.recordInvocation({
        toolName: 'Edit',
        parameters: { file_path: '/test.txt', old_string: 'old', new_string: 'new' },
      });

      const results = recorder.queryInvocations({ startTime });
      expect(results).toHaveLength(1);
      expect(results[0].invocation.toolName).toBe('Edit');
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      const invocations: ToolInvocation[] = [
        { toolName: 'Read', parameters: { file_path: '/test1.txt' }, requestId: 'req-1' },
        { toolName: 'Read', parameters: { file_path: '/test2.txt' }, requestId: 'req-2' },
        { toolName: 'Write', parameters: { file_path: '/test3.txt' }, requestId: 'req-3' },
      ];

      const executions: ToolExecution[] = [
        {
          callId: 'call-1',
          toolName: 'Read',
          input: { file_path: '/test1.txt' },
          startTime: new Date(),
          status: 'completed',
          duration: 100,
        },
        {
          callId: 'call-2',
          toolName: 'Read',
          input: { file_path: '/test2.txt' },
          startTime: new Date(),
          status: 'failed',
          error: 'File not found',
        },
        {
          callId: 'call-3',
          toolName: 'Write',
          input: { file_path: '/test3.txt' },
          startTime: new Date(),
          status: 'running',
        },
      ];

      invocations.forEach(inv => recorder.recordInvocation(inv));
      executions.forEach((exec, index) => {
        recorder.recordExecution(`req-${index + 1}`, exec);
      });
    });

    it('should provide accurate statistics', () => {
      const stats = recorder.getStats();

      expect(stats.totalInvocations).toBe(3);
      expect(stats.successfulExecutions).toBe(1);
      expect(stats.failedExecutions).toBe(1);
      expect(stats.runningExecutions).toBe(1);
      expect(stats.topTools).toEqual([
        { toolName: 'Read', count: 2 },
        { toolName: 'Write', count: 1 },
      ]);
      expect(stats.averageDuration).toBe(100);
    });
  });

  describe('convenience methods', () => {
    beforeEach(() => {
      recorder.recordInvocation({
        toolName: 'Read',
        parameters: { file_path: '/test1.txt' },
      });
      recorder.recordInvocation({
        toolName: 'Write',
        parameters: { file_path: '/test2.txt', content: 'test' },
      });
    });

    it('getInvocationsForTool should return invocations for specific tool', () => {
      const results = recorder.getInvocationsForTool('Read');
      expect(results).toHaveLength(1);
      expect(results[0].invocation.toolName).toBe('Read');
    });

    it('getInvocationsWithParameters should return invocations with matching parameters', () => {
      const results = recorder.getInvocationsWithParameters({
        file_path: '/test1.txt',
      });
      expect(results).toHaveLength(1);
      expect(results[0].invocation.parameters.file_path).toBe('/test1.txt');
    });

    it('hasInvocations should return true when invocations exist', () => {
      expect(recorder.hasInvocations()).toBe(true);
    });

    it('getInvocationCount should return correct count', () => {
      expect(recorder.getInvocationCount()).toBe(2);
    });

    it('getLatestInvocation should return most recent invocation', () => {
      const latest = recorder.getLatestInvocation();
      expect(latest?.invocation.toolName).toBe('Write');
    });

    it('getAllInvocations should return defensive copy', () => {
      const allInvocations = recorder.getAllInvocations();
      expect(allInvocations).toHaveLength(2);

      // Modifying returned array should not affect internal state
      allInvocations.pop();
      expect(recorder.getInvocationCount()).toBe(2);
    });
  });

  describe('clear and reset', () => {
    beforeEach(() => {
      recorder.recordInvocation({
        toolName: 'Read',
        parameters: { file_path: '/test.txt' },
      });
    });

    it('clear should remove all invocations', () => {
      expect(recorder.hasInvocations()).toBe(true);
      recorder.clear();
      expect(recorder.hasInvocations()).toBe(false);
      expect(recorder.getInvocationCount()).toBe(0);
    });

    it('reset should remove all invocations', () => {
      expect(recorder.hasInvocations()).toBe(true);
      recorder.reset();
      expect(recorder.hasInvocations()).toBe(false);
      expect(recorder.getInvocationCount()).toBe(0);
    });
  });

  describe('time range filtering', () => {
    it('should filter invocations by time range accurately', async () => {
      const startTime = new Date();

      recorder.recordInvocation({
        toolName: 'Read',
        parameters: { file_path: '/early.txt' },
      });

      // Wait and record middle invocation
      await new Promise(resolve => setTimeout(resolve, 10));
      const middleTime = new Date();

      recorder.recordInvocation({
        toolName: 'Write',
        parameters: { file_path: '/middle.txt' },
      });

      // Wait and record late invocation
      await new Promise(resolve => setTimeout(resolve, 10));
      const endTime = new Date();

      recorder.recordInvocation({
        toolName: 'Edit',
        parameters: { file_path: '/late.txt' },
      });

      // Test various time range filters
      const allResults = recorder.getInvocationsInTimeRange(startTime, new Date());
      expect(allResults).toHaveLength(3);

      const middleResults = recorder.getInvocationsInTimeRange(middleTime, endTime);
      expect(middleResults).toHaveLength(1);
      expect(middleResults[0].invocation.toolName).toBe('Write');
    });
  });

  describe('parameter matching', () => {
    beforeEach(() => {
      recorder.recordInvocation({
        toolName: 'Read',
        parameters: {
          file_path: '/test.txt',
          encoding: 'utf8',
          metadata: { type: 'config' },
        },
      });

      recorder.recordInvocation({
        toolName: 'Write',
        parameters: {
          file_path: '/output.txt',
          content: 'test content',
          metadata: { type: 'data' },
        },
      });
    });

    it('should match exact parameter values', () => {
      const results = recorder.queryInvocations({
        parameters: { encoding: 'utf8' },
      });
      expect(results).toHaveLength(1);
      expect(results[0].invocation.toolName).toBe('Read');
    });

    it('should match nested object parameters', () => {
      const results = recorder.queryInvocations({
        parameters: { metadata: { type: 'config' } },
      });
      expect(results).toHaveLength(1);
      expect(results[0].invocation.toolName).toBe('Read');
    });

    it('should match multiple parameters', () => {
      const results = recorder.queryInvocations({
        parameters: {
          file_path: '/test.txt',
          encoding: 'utf8',
        },
      });
      expect(results).toHaveLength(1);
    });

    it('should not match when parameters do not match exactly', () => {
      const results = recorder.queryInvocations({
        parameters: { encoding: 'ascii' },
      });
      expect(results).toHaveLength(0);
    });
  });

  describe('globalRecorder', () => {
    it('should be a singleton instance', () => {
      expect(globalRecorder).toBeInstanceOf(ToolInvocationRecorder);
    });

    it('should work independently of other recorders', () => {
      const localRecorder = new ToolInvocationRecorder();

      globalRecorder.recordInvocation({
        toolName: 'Read',
        parameters: { file_path: '/global.txt' },
      });

      localRecorder.recordInvocation({
        toolName: 'Write',
        parameters: { file_path: '/local.txt' },
      });

      expect(globalRecorder.getInvocationCount()).toBe(1);
      expect(localRecorder.getInvocationCount()).toBe(1);

      expect(globalRecorder.getAllInvocations()[0].invocation.toolName).toBe('Read');
      expect(localRecorder.getAllInvocations()[0].invocation.toolName).toBe('Write');
    });
  });

  describe('edge cases', () => {
    it('should handle empty query results', () => {
      const results = recorder.queryInvocations({ toolName: 'NonExistent' });
      expect(results).toEqual([]);
    });

    it('should handle getLatestInvocation when no invocations exist', () => {
      const latest = recorder.getLatestInvocation();
      expect(latest).toBeUndefined();
    });

    it('should handle stats when no invocations exist', () => {
      const stats = recorder.getStats();
      expect(stats.totalInvocations).toBe(0);
      expect(stats.topTools).toEqual([]);
      expect(stats.averageDuration).toBeUndefined();
    });

    it('should handle execution status filtering when no executions recorded', () => {
      recorder.recordInvocation({
        toolName: 'Read',
        parameters: { file_path: '/test.txt' },
      });

      const completedResults = recorder.queryInvocations({ status: 'completed' });
      expect(completedResults).toEqual([]);
    });

    it('should handle invalid parameter matching gracefully', () => {
      recorder.recordInvocation({
        toolName: 'Read',
        parameters: { file_path: '/test.txt' },
      });

      const results = recorder.queryInvocations({
        parameters: { nonExistentParam: 'value' },
      });
      expect(results).toEqual([]);
    });
  });
});