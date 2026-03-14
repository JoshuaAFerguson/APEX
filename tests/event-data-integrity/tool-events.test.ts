/**
 * Tool Event Data Integrity Tests
 *
 * Comprehensive tests for all tool-related event types to ensure
 * data integrity, timing accuracy, and proper state transitions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateTestId,
  validateJsonRoundTrip,
  validateRequiredFields,
  validateFieldTypes,
  EventSequenceValidator,
  CrossReferenceValidator,
  eventAssert,
} from './shared/event-test-utils';
import {
  createToolStartEvent,
  createToolProgressEvent,
  createToolCompleteEvent,
  ToolStartEventData,
  ToolProgressEventData,
  ToolCompleteEventData,
} from './shared/mock-event-generators';

describe('Tool Event Data Integrity', () => {
  describe('tool:start event', () => {
    it('should have all required fields', () => {
      const event = createToolStartEvent();

      const result = validateRequiredFields(event, [
        'taskId',
        'toolName',
        'callId',
        'input',
        'timestamp',
      ]);

      expect(result.isValid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it('should have correct field types', () => {
      const event = createToolStartEvent();

      const result = validateFieldTypes(event, {
        taskId: 'string',
        toolName: 'string',
        callId: 'string',
        input: 'object',
        timestamp: 'date',
      });

      expect(result.isValid).toBe(true);
      expect(result.typeErrors).toHaveLength(0);
    });

    it('should survive JSON round-trip serialization', () => {
      const event = createToolStartEvent();

      const result = validateJsonRoundTrip(event, ['timestamp']);

      expect(result.isValid).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    it('should validate callId format', () => {
      const event = createToolStartEvent();

      expect(event.callId).toMatch(/^call-/);
      expect(event.callId.length).toBeGreaterThan(5);
    });

    it('should validate common tool names', () => {
      const validTools = [
        'Read',
        'Write',
        'Edit',
        'Bash',
        'Grep',
        'Glob',
        'WebFetch',
        'WebSearch',
        'Browser',
      ];

      validTools.forEach(toolName => {
        const event = createToolStartEvent('task-1', toolName);
        expect(event.toolName).toBe(toolName);
      });
    });

    it('should handle complex input objects', () => {
      const complexInput = {
        file_path: '/src/components/Button.tsx',
        options: {
          encoding: 'utf-8',
          recursive: true,
          maxDepth: 3,
        },
        filters: ['*.ts', '*.tsx'],
        metadata: {
          requestedBy: 'developer',
          reason: 'code analysis',
        },
      };

      const event = createToolStartEvent('task-1', 'Read', { input: complexInput });

      const roundTrip = validateJsonRoundTrip(event, ['timestamp']);
      expect(roundTrip.isValid).toBe(true);
      expect(roundTrip.deserialized.input).toEqual(complexInput);
    });

    it('should handle empty input objects', () => {
      const event = createToolStartEvent('task-1', 'WebSearch', { input: {} });

      expect(event.input).toEqual({});
    });

    it('should handle input with special characters', () => {
      const event = createToolStartEvent('task-1', 'Bash', {
        input: {
          command: 'echo "Hello, World!" && ls -la /tmp | grep "test"',
        },
      });

      const roundTrip = validateJsonRoundTrip(event, ['timestamp']);
      expect(roundTrip.isValid).toBe(true);
    });
  });

  describe('tool:progress event', () => {
    it('should have all required fields', () => {
      const event = createToolProgressEvent();

      const result = validateRequiredFields(event, [
        'taskId',
        'toolName',
        'callId',
        'progress',
        'timestamp',
      ]);

      expect(result.isValid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it('should have correct field types', () => {
      const event = createToolProgressEvent();

      const result = validateFieldTypes(event, {
        taskId: 'string',
        toolName: 'string',
        callId: 'string',
        progress: 'object',
        timestamp: 'date',
      });

      expect(result.isValid).toBe(true);
      expect(result.typeErrors).toHaveLength(0);
    });

    it('should survive JSON round-trip serialization', () => {
      const event = createToolProgressEvent();

      const result = validateJsonRoundTrip(event, ['timestamp']);

      expect(result.isValid).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    it('should validate progress percentage range', () => {
      const event = createToolProgressEvent('task-1', 'WebFetch', 'call-1', {
        progress: { message: 'Downloading...', percentage: 75 },
      });

      expect(event.progress.percentage).toBeGreaterThanOrEqual(0);
      expect(event.progress.percentage).toBeLessThanOrEqual(100);
    });

    it('should handle progress without percentage', () => {
      const event = createToolProgressEvent('task-1', 'Bash', 'call-1', {
        progress: { message: 'Processing...' },
      });

      expect(event.progress.message).toBeTruthy();
      expect(event.progress.percentage).toBeUndefined();
    });

    it('should handle multiple progress updates', () => {
      const taskId = generateTestId('task');
      const callId = generateTestId('call');

      const progressStages = [
        { message: 'Starting...', percentage: 0 },
        { message: 'Downloading...', percentage: 25 },
        { message: 'Processing...', percentage: 50 },
        { message: 'Validating...', percentage: 75 },
        { message: 'Finalizing...', percentage: 99 },
      ];

      progressStages.forEach(progress => {
        const event = createToolProgressEvent(taskId, 'WebFetch', callId, { progress });

        expect(event.progress.message).toBe(progress.message);
        expect(event.progress.percentage).toBe(progress.percentage);
      });
    });
  });

  describe('tool:complete event', () => {
    it('should have all required fields', () => {
      const event = createToolCompleteEvent();

      const result = validateRequiredFields(event, [
        'taskId',
        'toolName',
        'callId',
        'result',
        'timing',
        'timestamp',
      ]);

      expect(result.isValid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it('should have correct field types', () => {
      const event = createToolCompleteEvent();

      const result = validateFieldTypes(event, {
        taskId: 'string',
        toolName: 'string',
        callId: 'string',
        result: 'object',
        timing: 'object',
        timestamp: 'date',
      });

      expect(result.isValid).toBe(true);
      expect(result.typeErrors).toHaveLength(0);
    });

    it('should survive JSON round-trip serialization', () => {
      const event = createToolCompleteEvent();

      const result = validateJsonRoundTrip(event, [
        'timestamp',
        'timing.startTime',
        'timing.endTime',
      ]);

      expect(result.isValid).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    it('should have consistent timing data', () => {
      const event = createToolCompleteEvent();

      expect(event.timing.endTime.getTime()).toBeGreaterThanOrEqual(event.timing.startTime.getTime());
      expect(event.timing.duration).toBeGreaterThanOrEqual(0);
      expect(event.timing.duration).toBe(
        event.timing.endTime.getTime() - event.timing.startTime.getTime()
      );
    });

    it('should handle successful result', () => {
      const event = createToolCompleteEvent('task-1', 'Read', 'call-1', {
        result: {
          success: true,
          output: { content: 'File content here...' },
        },
      });

      expect(event.result.success).toBe(true);
      expect(event.result.output).toBeDefined();
      expect(event.result.error).toBeUndefined();
    });

    it('should handle failed result', () => {
      const event = createToolCompleteEvent('task-1', 'Read', 'call-1', {
        result: {
          success: false,
          error: 'File not found: /nonexistent/file.ts',
        },
      });

      expect(event.result.success).toBe(false);
      expect(event.result.error).toBeTruthy();
    });

    it('should handle complex output objects', () => {
      const complexOutput = {
        files: [
          { path: '/src/a.ts', size: 1234 },
          { path: '/src/b.ts', size: 5678 },
        ],
        stats: {
          totalSize: 6912,
          fileCount: 2,
          processedAt: new Date().toISOString(),
        },
        metadata: {
          cacheHit: false,
          source: 'filesystem',
        },
      };

      const event = createToolCompleteEvent('task-1', 'Glob', 'call-1', {
        result: {
          success: true,
          output: complexOutput,
        },
      });

      const roundTrip = validateJsonRoundTrip(event, [
        'timestamp',
        'timing.startTime',
        'timing.endTime',
      ]);
      expect(roundTrip.isValid).toBe(true);
    });
  });

  describe('Tool Workflow Sequences', () => {
    let sequenceValidator: EventSequenceValidator;

    beforeEach(() => {
      sequenceValidator = new EventSequenceValidator([
        'tool:start',
        'tool:complete',
      ]);
    });

    it('should validate simple tool execution', () => {
      const taskId = generateTestId('task');
      const callId = generateTestId('call');

      sequenceValidator.addEvent('tool:start', createToolStartEvent(taskId, 'Read', { callId }));
      sequenceValidator.addEvent('tool:complete', createToolCompleteEvent(taskId, 'Read', callId));

      const result = sequenceValidator.validate();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate tool execution with progress', () => {
      const progressSequence = new EventSequenceValidator([
        'tool:start',
        'tool:progress',
        'tool:progress',
        'tool:complete',
      ]);

      const taskId = generateTestId('task');
      const callId = generateTestId('call');

      progressSequence.addEvent('tool:start', createToolStartEvent(taskId, 'WebFetch', { callId }));
      progressSequence.addEvent('tool:progress', createToolProgressEvent(taskId, 'WebFetch', callId, {
        progress: { message: 'Downloading...', percentage: 50 },
      }));
      progressSequence.addEvent('tool:progress', createToolProgressEvent(taskId, 'WebFetch', callId, {
        progress: { message: 'Almost done...', percentage: 90 },
      }));
      progressSequence.addEvent('tool:complete', createToolCompleteEvent(taskId, 'WebFetch', callId));

      const result = progressSequence.validate();

      expect(result.isValid).toBe(true);
    });

    it('should validate concurrent tool executions', () => {
      const taskId = generateTestId('task');
      const callId1 = generateTestId('call');
      const callId2 = generateTestId('call');

      const concurrentSequence = new EventSequenceValidator([
        'tool:start',
        'tool:start',
        'tool:complete',
        'tool:complete',
      ]);

      // Tool 1 starts
      concurrentSequence.addEvent('tool:start', createToolStartEvent(taskId, 'Read', { callId: callId1 }));
      // Tool 2 starts (concurrent)
      concurrentSequence.addEvent('tool:start', createToolStartEvent(taskId, 'Grep', { callId: callId2 }));
      // Tool 2 completes first
      concurrentSequence.addEvent('tool:complete', createToolCompleteEvent(taskId, 'Grep', callId2));
      // Tool 1 completes
      concurrentSequence.addEvent('tool:complete', createToolCompleteEvent(taskId, 'Read', callId1));

      const result = concurrentSequence.validate();

      expect(result.isValid).toBe(true);
    });
  });

  describe('Cross-Reference Integrity', () => {
    let crossRefValidator: CrossReferenceValidator;

    beforeEach(() => {
      crossRefValidator = new CrossReferenceValidator();
    });

    it('should maintain callId consistency across tool events', () => {
      const taskId = generateTestId('task');
      const callId = generateTestId('call');

      const startEvent = createToolStartEvent(taskId, 'Read', { callId });
      const progressEvent = createToolProgressEvent(taskId, 'Read', callId);
      const completeEvent = createToolCompleteEvent(taskId, 'Read', callId);

      crossRefValidator.registerReference('callId', startEvent.callId);
      crossRefValidator.registerReference('callId', progressEvent.callId);
      crossRefValidator.registerReference('callId', completeEvent.callId);

      const allRefs = crossRefValidator.getAllReferences();
      expect(allRefs.callId).toHaveLength(1);
      expect(allRefs.callId[0]).toBe(callId);
    });

    it('should maintain taskId consistency across tool events', () => {
      const taskId = generateTestId('task');
      const callId = generateTestId('call');

      const events = [
        createToolStartEvent(taskId, 'Read', { callId }),
        createToolProgressEvent(taskId, 'Read', callId),
        createToolCompleteEvent(taskId, 'Read', callId),
      ];

      events.forEach(event => {
        crossRefValidator.registerReference('taskId', event.taskId);
      });

      const allRefs = crossRefValidator.getAllReferences();
      expect(allRefs.taskId).toHaveLength(1);
      expect(allRefs.taskId[0]).toBe(taskId);
    });

    it('should maintain toolName consistency across tool events', () => {
      const taskId = generateTestId('task');
      const callId = generateTestId('call');
      const toolName = 'Read';

      const events = [
        createToolStartEvent(taskId, toolName, { callId }),
        createToolProgressEvent(taskId, toolName, callId),
        createToolCompleteEvent(taskId, toolName, callId),
      ];

      events.forEach(event => {
        crossRefValidator.registerReference('toolName', event.toolName);
      });

      const allRefs = crossRefValidator.getAllReferences();
      expect(allRefs.toolName).toHaveLength(1);
      expect(allRefs.toolName[0]).toBe(toolName);
    });
  });

  describe('Timing Edge Cases', () => {
    it('should handle instant execution (zero duration)', () => {
      const now = new Date();
      const event = createToolCompleteEvent('task-1', 'Read', 'call-1', {
        timing: {
          startTime: now,
          endTime: now,
          duration: 0,
        },
      });

      expect(event.timing.duration).toBe(0);
    });

    it('should handle long-running tools', () => {
      const startTime = new Date(Date.now() - 300000); // 5 minutes ago
      const endTime = new Date();
      const event = createToolCompleteEvent('task-1', 'Bash', 'call-1', {
        timing: {
          startTime,
          endTime,
          duration: endTime.getTime() - startTime.getTime(),
        },
      });

      expect(event.timing.duration).toBeGreaterThanOrEqual(300000);
    });

    it('should handle very fast execution', () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 1); // 1ms later
      const event = createToolCompleteEvent('task-1', 'Read', 'call-1', {
        timing: {
          startTime,
          endTime,
          duration: 1,
        },
      });

      expect(event.timing.duration).toBe(1);
    });
  });

  describe('Tool-specific Input Validation', () => {
    it('should validate Read tool input', () => {
      const event = createToolStartEvent('task-1', 'Read', {
        input: {
          file_path: '/src/index.ts',
          offset: 0,
          limit: 100,
        },
      });

      expect(event.input.file_path).toBeDefined();
    });

    it('should validate Write tool input', () => {
      const event = createToolStartEvent('task-1', 'Write', {
        input: {
          file_path: '/src/new-file.ts',
          content: 'export const hello = "world";',
        },
      });

      expect(event.input.file_path).toBeDefined();
      expect(event.input.content).toBeDefined();
    });

    it('should validate Bash tool input', () => {
      const event = createToolStartEvent('task-1', 'Bash', {
        input: {
          command: 'npm test',
          timeout: 60000,
          description: 'Running tests',
        },
      });

      expect(event.input.command).toBeDefined();
    });

    it('should validate WebFetch tool input', () => {
      const event = createToolStartEvent('task-1', 'WebFetch', {
        input: {
          url: 'https://example.com/api/data',
          prompt: 'Extract the main content',
        },
      });

      expect(event.input.url).toBeDefined();
      expect(event.input.prompt).toBeDefined();
    });

    it('should validate Grep tool input', () => {
      const event = createToolStartEvent('task-1', 'Grep', {
        input: {
          pattern: 'function\\s+\\w+',
          path: '/src',
          glob: '*.ts',
        },
      });

      expect(event.input.pattern).toBeDefined();
    });

    it('should validate Browser tool input', () => {
      const event = createToolStartEvent('task-1', 'Browser', {
        input: {
          operation: 'navigate',
          params: {
            url: 'https://example.com',
          },
        },
      });

      expect(event.input.operation).toBeDefined();
      expect(event.input.params).toBeDefined();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle tool execution errors with details', () => {
      const event = createToolCompleteEvent('task-1', 'Bash', 'call-1', {
        result: {
          success: false,
          error: 'Command failed with exit code 1',
          output: {
            exitCode: 1,
            stderr: 'npm ERR! Test failed',
          },
        },
      });

      expect(event.result.success).toBe(false);
      expect(event.result.error).toBeTruthy();
    });

    it('should handle timeout errors', () => {
      const event = createToolCompleteEvent('task-1', 'Bash', 'call-1', {
        result: {
          success: false,
          error: 'Tool execution timed out after 120000ms',
        },
        timing: {
          startTime: new Date(Date.now() - 120000),
          endTime: new Date(),
          duration: 120000,
        },
      });

      expect(event.result.success).toBe(false);
      expect(event.timing.duration).toBe(120000);
    });

    it('should handle permission denied errors', () => {
      const event = createToolCompleteEvent('task-1', 'Write', 'call-1', {
        result: {
          success: false,
          error: 'Permission denied: cannot write to /etc/passwd',
        },
      });

      expect(event.result.success).toBe(false);
      expect(event.result.error).toContain('Permission denied');
    });
  });
});
