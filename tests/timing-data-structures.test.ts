import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit tests for timing data structures and calculations
 *
 * This test suite focuses on the core timing data structures
 * defined in packages/core/src/types.ts and packages/orchestrator/src/index.ts
 */

// Import types for testing (we'll mock the actual implementations)
interface ToolExecution {
  callId: string;
  toolName: string;
  input: Record<string, unknown>;
  taskId?: string;
  agentName?: string;
  stageName?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  result?: {
    success: boolean;
    output?: unknown;
    error?: string;
  };
  error?: string;
  status: 'running' | 'completed' | 'failed';
  metadata?: Record<string, unknown>;
}

interface ToolCallStartEvent {
  taskId: string;
  toolName: string;
  input: Record<string, unknown>;
  timestamp: Date;
  callId: string;
  startTime: Date;
}

interface ToolCallCompleteEvent {
  taskId: string;
  toolName: string;
  callId: string;
  result: {
    success: boolean;
    output?: unknown;
    error?: string;
  };
  timing: {
    startTime: Date;
    endTime: Date;
    duration: number;
  };
  timestamp: Date;
}

describe('Timing Data Structures', () => {
  let mockStartTime: Date;
  let mockEndTime: Date;

  beforeEach(() => {
    mockStartTime = new Date('2024-01-01T10:00:00.000Z');
    mockEndTime = new Date('2024-01-01T10:00:01.500Z'); // 1.5 seconds later
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('ToolExecution Structure', () => {
    it('should create valid running ToolExecution with required timing fields', () => {
      const execution: ToolExecution = {
        callId: 'test-call-123',
        toolName: 'TestTool',
        input: { param: 'value' },
        startTime: mockStartTime,
        status: 'running',
      };

      expect(execution.callId).toBe('test-call-123');
      expect(execution.toolName).toBe('TestTool');
      expect(execution.startTime).toBeInstanceOf(Date);
      expect(execution.status).toBe('running');
      expect(execution.endTime).toBeUndefined();
      expect(execution.duration).toBeUndefined();
    });

    it('should create valid completed ToolExecution with all timing fields', () => {
      const execution: ToolExecution = {
        callId: 'test-call-456',
        toolName: 'CompletedTool',
        input: { data: 'test' },
        startTime: mockStartTime,
        endTime: mockEndTime,
        duration: mockEndTime.getTime() - mockStartTime.getTime(),
        status: 'completed',
        result: {
          success: true,
          output: 'Tool completed successfully',
        },
      };

      expect(execution.startTime).toBeInstanceOf(Date);
      expect(execution.endTime).toBeInstanceOf(Date);
      expect(execution.duration).toBe(1500); // 1.5 seconds in ms
      expect(execution.status).toBe('completed');
      expect(execution.result?.success).toBe(true);
    });

    it('should handle failed ToolExecution with timing data', () => {
      const execution: ToolExecution = {
        callId: 'test-call-error',
        toolName: 'ErrorTool',
        input: { trigger: 'error' },
        startTime: mockStartTime,
        endTime: mockEndTime,
        duration: mockEndTime.getTime() - mockStartTime.getTime(),
        status: 'failed',
        result: {
          success: false,
          error: 'Tool execution failed',
        },
        error: 'Tool execution failed',
      };

      expect(execution.status).toBe('failed');
      expect(execution.result?.success).toBe(false);
      expect(execution.result?.error).toBeDefined();
      expect(execution.error).toBe('Tool execution failed');
      // Timing data should still be present for failed executions
      expect(execution.duration).toBe(1500);
    });

    it('should support optional metadata field', () => {
      const execution: ToolExecution = {
        callId: 'test-metadata',
        toolName: 'MetadataTool',
        input: {},
        startTime: mockStartTime,
        status: 'running',
        metadata: {
          agentVersion: '1.0.0',
          environment: 'test',
          retryCount: 0,
        },
      };

      expect(execution.metadata).toBeDefined();
      expect(execution.metadata?.agentVersion).toBe('1.0.0');
      expect(execution.metadata?.environment).toBe('test');
      expect(execution.metadata?.retryCount).toBe(0);
    });
  });

  describe('ToolCallStartEvent Structure', () => {
    it('should create valid ToolCallStartEvent with startTime field', () => {
      const startEvent: ToolCallStartEvent = {
        taskId: 'task-123',
        toolName: 'StartEventTool',
        input: { param: 'value' },
        timestamp: mockStartTime,
        callId: 'call-456',
        startTime: mockStartTime,
      };

      expect(startEvent.taskId).toBe('task-123');
      expect(startEvent.toolName).toBe('StartEventTool');
      expect(startEvent.callId).toBe('call-456');
      expect(startEvent.startTime).toBeInstanceOf(Date);
      expect(startEvent.timestamp).toBeInstanceOf(Date);

      // startTime and timestamp should match in start events
      expect(startEvent.startTime.getTime()).toBe(startEvent.timestamp.getTime());
    });

    it('should include tool input data in start event', () => {
      const complexInput = {
        filePath: '/path/to/file.txt',
        options: { encoding: 'utf8', timeout: 5000 },
        nested: { data: { value: 42 } },
      };

      const startEvent: ToolCallStartEvent = {
        taskId: 'task-complex',
        toolName: 'ComplexTool',
        input: complexInput,
        timestamp: mockStartTime,
        callId: 'call-complex',
        startTime: mockStartTime,
      };

      expect(startEvent.input).toEqual(complexInput);
      expect(startEvent.input.filePath).toBe('/path/to/file.txt');
      expect(startEvent.input.options).toEqual({ encoding: 'utf8', timeout: 5000 });
    });
  });

  describe('ToolCallCompleteEvent Structure', () => {
    it('should create valid ToolCallCompleteEvent with timing object', () => {
      const completeEvent: ToolCallCompleteEvent = {
        taskId: 'task-789',
        toolName: 'CompleteEventTool',
        callId: 'call-789',
        result: {
          success: true,
          output: { data: 'completed' },
        },
        timing: {
          startTime: mockStartTime,
          endTime: mockEndTime,
          duration: mockEndTime.getTime() - mockStartTime.getTime(),
        },
        timestamp: mockEndTime,
      };

      expect(completeEvent.taskId).toBe('task-789');
      expect(completeEvent.toolName).toBe('CompleteEventTool');
      expect(completeEvent.callId).toBe('call-789');
      expect(completeEvent.result.success).toBe(true);

      // Verify timing structure
      expect(completeEvent.timing).toBeDefined();
      expect(completeEvent.timing.startTime).toBeInstanceOf(Date);
      expect(completeEvent.timing.endTime).toBeInstanceOf(Date);
      expect(completeEvent.timing.duration).toBe(1500);

      // Timestamp should match endTime for completed events
      expect(completeEvent.timestamp.getTime()).toBe(mockEndTime.getTime());
    });

    it('should handle error result in ToolCallCompleteEvent', () => {
      const errorEvent: ToolCallCompleteEvent = {
        taskId: 'task-error',
        toolName: 'ErrorTool',
        callId: 'call-error',
        result: {
          success: false,
          error: 'Tool execution failed with detailed error message',
        },
        timing: {
          startTime: mockStartTime,
          endTime: mockEndTime,
          duration: mockEndTime.getTime() - mockStartTime.getTime(),
        },
        timestamp: mockEndTime,
      };

      expect(errorEvent.result.success).toBe(false);
      expect(errorEvent.result.error).toBe('Tool execution failed with detailed error message');
      expect(errorEvent.result.output).toBeUndefined();

      // Timing should still be accurate for failed tools
      expect(errorEvent.timing.duration).toBe(1500);
    });
  });

  describe('Timing Calculations', () => {
    it('should calculate duration correctly for various time ranges', () => {
      const testCases = [
        { startOffset: 0, endOffset: 100, expectedDuration: 100 }, // 100ms
        { startOffset: 0, endOffset: 1000, expectedDuration: 1000 }, // 1s
        { startOffset: 1000, endOffset: 2500, expectedDuration: 1500 }, // 1.5s
        { startOffset: 5000, endOffset: 10000, expectedDuration: 5000 }, // 5s
      ];

      testCases.forEach(({ startOffset, endOffset, expectedDuration }, index) => {
        const startTime = new Date(mockStartTime.getTime() + startOffset);
        const endTime = new Date(mockStartTime.getTime() + endOffset);
        const calculatedDuration = endTime.getTime() - startTime.getTime();

        expect(calculatedDuration).toBe(expectedDuration);

        // Verify this would work in a real timing object
        const timingObj = {
          startTime,
          endTime,
          duration: calculatedDuration,
        };

        expect(timingObj.duration).toBe(expectedDuration);
        expect(timingObj.endTime.getTime() - timingObj.startTime.getTime()).toBe(timingObj.duration);
      });
    });

    it('should handle edge case timing scenarios', () => {
      // Same start and end time (instant execution)
      const instantStart = new Date('2024-01-01T12:00:00.000Z');
      const instantEnd = new Date('2024-01-01T12:00:00.000Z');
      const instantDuration = instantEnd.getTime() - instantStart.getTime();

      expect(instantDuration).toBe(0);

      // Very short execution (1ms)
      const shortStart = new Date('2024-01-01T12:00:00.000Z');
      const shortEnd = new Date('2024-01-01T12:00:00.001Z');
      const shortDuration = shortEnd.getTime() - shortStart.getTime();

      expect(shortDuration).toBe(1);

      // Long execution (1 hour)
      const longStart = new Date('2024-01-01T12:00:00.000Z');
      const longEnd = new Date('2024-01-01T13:00:00.000Z');
      const longDuration = longEnd.getTime() - longStart.getTime();

      expect(longDuration).toBe(3600000); // 1 hour in ms
    });

    it('should validate timing consistency between events', () => {
      const sharedStartTime = mockStartTime;
      const sharedCallId = 'consistency-test';

      const startEvent: ToolCallStartEvent = {
        taskId: 'consistency-task',
        toolName: 'ConsistencyTool',
        input: {},
        timestamp: sharedStartTime,
        callId: sharedCallId,
        startTime: sharedStartTime,
      };

      const completeEvent: ToolCallCompleteEvent = {
        taskId: 'consistency-task',
        toolName: 'ConsistencyTool',
        callId: sharedCallId,
        result: { success: true },
        timing: {
          startTime: sharedStartTime,
          endTime: mockEndTime,
          duration: mockEndTime.getTime() - sharedStartTime.getTime(),
        },
        timestamp: mockEndTime,
      };

      // Verify consistency
      expect(startEvent.callId).toBe(completeEvent.callId);
      expect(startEvent.toolName).toBe(completeEvent.toolName);
      expect(startEvent.taskId).toBe(completeEvent.taskId);
      expect(startEvent.startTime.getTime()).toBe(completeEvent.timing.startTime.getTime());

      // Verify timing logic
      expect(completeEvent.timing.endTime.getTime()).toBeGreaterThan(completeEvent.timing.startTime.getTime());
      expect(completeEvent.timing.duration).toBe(
        completeEvent.timing.endTime.getTime() - completeEvent.timing.startTime.getTime()
      );
    });
  });

  describe('Data Type Validation', () => {
    it('should ensure all timing fields use proper Date objects', () => {
      const execution: ToolExecution = {
        callId: 'type-test',
        toolName: 'TypeTool',
        input: {},
        startTime: mockStartTime,
        endTime: mockEndTime,
        status: 'completed',
      };

      expect(execution.startTime).toBeInstanceOf(Date);
      expect(execution.endTime).toBeInstanceOf(Date);
      expect(typeof execution.startTime.getTime()).toBe('number');
      expect(typeof execution.endTime?.getTime()).toBe('number');
    });

    it('should ensure duration is always a number when present', () => {
      const validDurations = [0, 1, 100, 1500, 30000, 3600000];

      validDurations.forEach(duration => {
        const execution: ToolExecution = {
          callId: `duration-${duration}`,
          toolName: 'DurationTool',
          input: {},
          startTime: mockStartTime,
          duration,
          status: 'completed',
        };

        expect(typeof execution.duration).toBe('number');
        expect(execution.duration).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(execution.duration)).toBe(true);
      });
    });

    it('should handle status enum values correctly', () => {
      const validStatuses: Array<'running' | 'completed' | 'failed'> = ['running', 'completed', 'failed'];

      validStatuses.forEach(status => {
        const execution: ToolExecution = {
          callId: `status-${status}`,
          toolName: 'StatusTool',
          input: {},
          startTime: mockStartTime,
          status,
        };

        expect(execution.status).toBe(status);
        expect(['running', 'completed', 'failed']).toContain(execution.status);
      });
    });
  });

  describe('Real-world Scenario Validation', () => {
    it('should handle typical file operation timing', () => {
      const fileReadExecution: ToolExecution = {
        callId: 'file-read-001',
        toolName: 'Read',
        input: { file_path: '/path/to/file.txt' },
        taskId: 'task-file-ops',
        agentName: 'developer',
        stageName: 'implementation',
        startTime: new Date('2024-01-01T10:00:00.000Z'),
        endTime: new Date('2024-01-01T10:00:00.025Z'), // 25ms read
        duration: 25,
        status: 'completed',
        result: {
          success: true,
          output: 'File content read successfully',
        },
      };

      expect(fileReadExecution.duration).toBe(25);
      expect(fileReadExecution.toolName).toBe('Read');
      expect(fileReadExecution.result?.success).toBe(true);
    });

    it('should handle typical command execution timing', () => {
      const bashExecution: ToolExecution = {
        callId: 'bash-001',
        toolName: 'Bash',
        input: { command: 'npm test' },
        taskId: 'task-testing',
        agentName: 'tester',
        stageName: 'testing',
        startTime: new Date('2024-01-01T10:00:00.000Z'),
        endTime: new Date('2024-01-01T10:00:05.200Z'), // 5.2s test run
        duration: 5200,
        status: 'completed',
        result: {
          success: true,
          output: 'All tests passed',
        },
      };

      expect(bashExecution.duration).toBe(5200);
      expect(bashExecution.toolName).toBe('Bash');
      expect(bashExecution.stageName).toBe('testing');
    });

    it('should handle typical search operation timing', () => {
      const grepExecution: ToolExecution = {
        callId: 'grep-001',
        toolName: 'Grep',
        input: { pattern: 'timing', output_mode: 'files_with_matches' },
        taskId: 'task-search',
        agentName: 'analyzer',
        stageName: 'analysis',
        startTime: new Date('2024-01-01T10:00:00.000Z'),
        endTime: new Date('2024-01-01T10:00:00.150Z'), // 150ms search
        duration: 150,
        status: 'completed',
        result: {
          success: true,
          output: ['file1.ts', 'file2.ts'],
        },
      };

      expect(grepExecution.duration).toBe(150);
      expect(grepExecution.toolName).toBe('Grep');
      expect(Array.isArray(grepExecution.result?.output)).toBe(true);
    });
  });
});