/**
 * @fileoverview Simple validation test for tool call event types and interfaces
 *
 * This test validates that the new tool call event interfaces are properly defined
 * and can be used without compilation errors.
 */

import { describe, it, expect } from 'vitest';
import type { ToolCallStartEvent, ToolCallCompleteEvent, ToolCallProgressEvent } from '../index';

describe('Tool Call Event Types Validation', () => {
  it('should validate ToolCallStartEvent interface', () => {
    const startEvent: ToolCallStartEvent = {
      taskId: 'test-task-123',
      toolName: 'Read',
      input: { file_path: '/test/file.txt', limit: 100 },
      timestamp: new Date(),
      callId: 'call-abc-123',
    };

    expect(startEvent.taskId).toBe('test-task-123');
    expect(startEvent.toolName).toBe('Read');
    expect(startEvent.input).toEqual({ file_path: '/test/file.txt', limit: 100 });
    expect(startEvent.timestamp).toBeInstanceOf(Date);
    expect(startEvent.callId).toBe('call-abc-123');
  });

  it('should validate ToolCallCompleteEvent interface', () => {
    const completeEvent: ToolCallCompleteEvent = {
      taskId: 'test-task-456',
      toolName: 'Write',
      callId: 'call-def-456',
      result: {
        success: true,
        output: 'File written successfully',
        error: undefined,
      },
      timing: {
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:00:01Z'),
        duration: 1000,
      },
      timestamp: new Date(),
    };

    expect(completeEvent.taskId).toBe('test-task-456');
    expect(completeEvent.toolName).toBe('Write');
    expect(completeEvent.callId).toBe('call-def-456');
    expect(completeEvent.result.success).toBe(true);
    expect(completeEvent.result.output).toBe('File written successfully');
    expect(completeEvent.result.error).toBeUndefined();
    expect(completeEvent.timing.duration).toBe(1000);
    expect(completeEvent.timestamp).toBeInstanceOf(Date);
  });

  it('should validate ToolCallCompleteEvent with error result', () => {
    const errorEvent: ToolCallCompleteEvent = {
      taskId: 'test-task-789',
      toolName: 'Bash',
      callId: 'call-ghi-789',
      result: {
        success: false,
        output: undefined,
        error: 'Command failed with exit code 1',
      },
      timing: {
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:00:02Z'),
        duration: 2000,
      },
      timestamp: new Date(),
    };

    expect(errorEvent.result.success).toBe(false);
    expect(errorEvent.result.error).toBe('Command failed with exit code 1');
    expect(errorEvent.result.output).toBeUndefined();
  });

  it('should validate ToolCallProgressEvent interface', () => {
    const progressEvent: ToolCallProgressEvent = {
      taskId: 'test-task-progress',
      toolName: 'LongRunningTool',
      callId: 'call-progress-123',
      progress: {
        message: 'Processing large dataset...',
        percentage: 75,
      },
      timestamp: new Date(),
    };

    expect(progressEvent.taskId).toBe('test-task-progress');
    expect(progressEvent.toolName).toBe('LongRunningTool');
    expect(progressEvent.callId).toBe('call-progress-123');
    expect(progressEvent.progress.message).toBe('Processing large dataset...');
    expect(progressEvent.progress.percentage).toBe(75);
    expect(progressEvent.timestamp).toBeInstanceOf(Date);
  });

  it('should validate ToolCallProgressEvent without percentage', () => {
    const indeterminateProgress: ToolCallProgressEvent = {
      taskId: 'test-task-indeterminate',
      toolName: 'SearchTool',
      callId: 'call-search-456',
      progress: {
        message: 'Searching through files...',
        // No percentage for indeterminate progress
      },
      timestamp: new Date(),
    };

    expect(indeterminateProgress.progress.message).toBe('Searching through files...');
    expect(indeterminateProgress.progress.percentage).toBeUndefined();
  });

  it('should validate event structure consistency', () => {
    // All events should share common fields
    const startEvent: ToolCallStartEvent = {
      taskId: 'common-task',
      toolName: 'CommonTool',
      callId: 'common-call',
      timestamp: new Date(),
      input: {},
    };

    const completeEvent: ToolCallCompleteEvent = {
      taskId: 'common-task',
      toolName: 'CommonTool',
      callId: 'common-call',
      timestamp: new Date(),
      result: { success: true },
      timing: {
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
      },
    };

    const progressEvent: ToolCallProgressEvent = {
      taskId: 'common-task',
      toolName: 'CommonTool',
      callId: 'common-call',
      timestamp: new Date(),
      progress: { message: 'Working...' },
    };

    // All events should have the same core identifying fields
    expect(startEvent.taskId).toBe(completeEvent.taskId);
    expect(startEvent.toolName).toBe(completeEvent.toolName);
    expect(startEvent.callId).toBe(completeEvent.callId);

    expect(progressEvent.taskId).toBe(completeEvent.taskId);
    expect(progressEvent.toolName).toBe(completeEvent.toolName);
    expect(progressEvent.callId).toBe(completeEvent.callId);
  });
});