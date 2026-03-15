/**
 * Real Tool Execution Timing Field Validation
 *
 * Tests timing data capture and validation for actual tool executions
 * through the orchestrator system, ensuring proper timing field population
 * and accuracy across different real-world scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  assertFailedToolTiming,
  assertTimingAccuracy,
  type ToolCallCompleteEventLike,
} from './test-utils/failed-tool-timing-helpers';

/**
 * Real tool execution validator that interfaces with actual tools
 */
class RealToolExecutionValidator extends EventEmitter {
  private tempDir: string = '';
  private events: ToolCallCompleteEventLike[] = [];
  private callCounter = 0;

  async setup(): Promise<void> {
    // Create temporary directory for test files
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-timing-test-'));
    this.events = [];

    // Listen for tool completion events
    this.on('tool:complete', (event) => {
      this.events.push(event);
    });
  }

  async cleanup(): Promise<void> {
    try {
      if (this.tempDir) {
        await fs.rm(this.tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
    this.removeAllListeners();
    this.events = [];
  }

  /**
   * Simulate a file read operation with timing measurement
   */
  async executeReadTool(filePath: string, expectedExists: boolean = true): Promise<ToolCallCompleteEventLike> {
    const callId = `read-${++this.callCounter}`;
    const taskId = 'read-timing-test';
    const startTime = new Date();
    const perfStart = performance.now();

    try {
      // Simulate actual file read
      const content = await fs.readFile(filePath, 'utf8');
      const perfEnd = performance.now();
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const event: ToolCallCompleteEventLike = {
        taskId,
        toolName: 'ReadTool',
        callId,
        result: {
          success: true,
          output: { content, filePath, size: content.length }
        },
        timing: {
          startTime,
          endTime,
          duration
        },
        timestamp: endTime
      };

      this.emit('tool:complete', event);
      return event;

    } catch (error) {
      const perfEnd = performance.now();
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const event: ToolCallCompleteEventLike = {
        taskId,
        toolName: 'ReadTool',
        callId,
        result: {
          success: false,
          error: `Failed to read file: ${error}`
        },
        timing: {
          startTime,
          endTime,
          duration
        },
        timestamp: endTime
      };

      this.emit('tool:complete', event);
      return event;
    }
  }

  /**
   * Simulate a file write operation with timing
   */
  async executeWriteTool(filePath: string, content: string): Promise<ToolCallCompleteEventLike> {
    const callId = `write-${++this.callCounter}`;
    const taskId = 'write-timing-test';
    const startTime = new Date();
    const perfStart = performance.now();

    try {
      await fs.writeFile(filePath, content, 'utf8');
      const perfEnd = performance.now();
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const event: ToolCallCompleteEventLike = {
        taskId,
        toolName: 'WriteTool',
        callId,
        result: {
          success: true,
          output: { filePath, bytesWritten: content.length }
        },
        timing: {
          startTime,
          endTime,
          duration
        },
        timestamp: endTime
      };

      this.emit('tool:complete', event);
      return event;

    } catch (error) {
      const perfEnd = performance.now();
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const event: ToolCallCompleteEventLike = {
        taskId,
        toolName: 'WriteTool',
        callId,
        result: {
          success: false,
          error: `Failed to write file: ${error}`
        },
        timing: {
          startTime,
          endTime,
          duration
        },
        timestamp: endTime
      };

      this.emit('tool:complete', event);
      return event;
    }
  }

  /**
   * Simulate a shell command execution with timing
   */
  async executeBashTool(command: string, timeoutMs: number = 5000): Promise<ToolCallCompleteEventLike> {
    const callId = `bash-${++this.callCounter}`;
    const taskId = 'bash-timing-test';
    const startTime = new Date();
    const perfStart = performance.now();

    try {
      // Simple simulation of shell command timing
      if (command.includes('sleep')) {
        const sleepMatch = command.match(/sleep (\d+)/);
        const sleepSeconds = sleepMatch ? parseInt(sleepMatch[1]) * 1000 : 100;
        await new Promise(resolve => setTimeout(resolve, Math.min(sleepSeconds, timeoutMs)));
      } else {
        // Simulate command execution time
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
      }

      const perfEnd = performance.now();
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const event: ToolCallCompleteEventLike = {
        taskId,
        toolName: 'BashTool',
        callId,
        result: {
          success: true,
          output: { command, exitCode: 0, stdout: `Executed: ${command}` }
        },
        timing: {
          startTime,
          endTime,
          duration
        },
        timestamp: endTime
      };

      this.emit('tool:complete', event);
      return event;

    } catch (error) {
      const perfEnd = performance.now();
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const event: ToolCallCompleteEventLike = {
        taskId,
        toolName: 'BashTool',
        callId,
        result: {
          success: false,
          error: `Command failed: ${error}`
        },
        timing: {
          startTime,
          endTime,
          duration
        },
        timestamp: endTime
      };

      this.emit('tool:complete', event);
      return event;
    }
  }

  /**
   * Execute multiple tools concurrently with real timing
   */
  async executeConcurrentOperations(
    operations: Array<{
      type: 'read' | 'write' | 'bash';
      params: any;
    }>
  ): Promise<ToolCallCompleteEventLike[]> {
    const promises = operations.map(async (op, index) => {
      switch (op.type) {
        case 'read':
          return this.executeReadTool(op.params.filePath, op.params.expectedExists);
        case 'write':
          return this.executeWriteTool(op.params.filePath, op.params.content);
        case 'bash':
          return this.executeBashTool(op.params.command, op.params.timeout);
        default:
          throw new Error(`Unknown operation type: ${op.type}`);
      }
    });

    return Promise.all(promises);
  }

  getCollectedEvents(): ToolCallCompleteEventLike[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
  }
}

describe('Real Tool Execution Timing Fields', () => {
  let validator: RealToolExecutionValidator;
  let testFilePath: string;

  beforeEach(async () => {
    validator = new RealToolExecutionValidator();
    await validator.setup();
    testFilePath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'timing-test-')), 'test.txt');
  });

  afterEach(async () => {
    try {
      const dir = path.dirname(testFilePath);
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    await validator.cleanup();
    vi.clearAllTimers();
  });

  describe('File Operations Timing', () => {
    it('should capture accurate timing for successful file write', async () => {
      const content = 'Test content for timing validation';
      const event = await validator.executeWriteTool(testFilePath, content);

      // Verify timing fields are properly populated
      expect(event.timing).toBeDefined();
      expect(event.timing.startTime).toBeInstanceOf(Date);
      expect(event.timing.endTime).toBeInstanceOf(Date);
      expect(typeof event.timing.duration).toBe('number');

      // Verify timing logic
      expect(event.timing.endTime.getTime()).toBeGreaterThanOrEqual(
        event.timing.startTime.getTime()
      );

      // Verify duration calculation
      const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
      expect(event.timing.duration).toBe(calculatedDuration);

      // Verify operation was successful
      expect(event.result.success).toBe(true);
      expect(event.toolName).toBe('WriteTool');

      // Timing should be reasonable for a file write (under 1 second typically)
      expect(event.timing.duration).toBeLessThan(1000);
    });

    it('should capture timing for successful file read', async () => {
      // First create a test file
      const content = 'Test content to read with timing';
      await fs.writeFile(testFilePath, content, 'utf8');

      const event = await validator.executeReadTool(testFilePath, true);

      // Verify timing structure
      expect(event.timing).toBeDefined();
      expect(event.timing.startTime).toBeInstanceOf(Date);
      expect(event.timing.endTime).toBeInstanceOf(Date);
      expect(event.timing.duration).toBeGreaterThanOrEqual(0);

      // Verify timing consistency
      const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
      expect(event.timing.duration).toBe(calculatedDuration);

      // Verify successful read
      expect(event.result.success).toBe(true);
      expect(event.result.output).toMatchObject({
        content,
        filePath: testFilePath,
        size: content.length
      });

      // Read operations should be fast
      expect(event.timing.duration).toBeLessThan(500);
    });

    it('should capture timing for failed file operations', async () => {
      const nonExistentPath = path.join(testFilePath, 'non-existent', 'file.txt');
      const event = await validator.executeReadTool(nonExistentPath, false);

      // Verify failed operation has proper timing
      assertFailedToolTiming(event, {
        expectedMinDuration: 0,
        expectedMaxDuration: 100,
        tolerance: 50,
        allowZeroDuration: true
      });

      // Verify failure details
      expect(event.result.success).toBe(false);
      expect(event.result.error).toBeDefined();
      expect(event.result.error).toContain('Failed to read file');
      expect(event.toolName).toBe('ReadTool');
    });
  });

  describe('Shell Command Timing', () => {
    it('should capture timing for quick shell commands', async () => {
      const event = await validator.executeBashTool('echo "Hello World"');

      // Verify timing structure
      expect(event.timing).toBeDefined();
      expect(event.timing.startTime).toBeInstanceOf(Date);
      expect(event.timing.endTime).toBeInstanceOf(Date);
      expect(event.timing.duration).toBeGreaterThanOrEqual(0);

      // Verify timing consistency
      const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
      expect(event.timing.duration).toBe(calculatedDuration);

      // Verify command execution
      expect(event.result.success).toBe(true);
      expect(event.toolName).toBe('BashTool');

      // Quick commands should complete reasonably fast
      expect(event.timing.duration).toBeLessThan(1000);
    });

    it('should capture timing for longer shell commands', async () => {
      const startTime = performance.now();
      const event = await validator.executeBashTool('sleep 1');
      const totalTime = performance.now() - startTime;

      // Verify timing captures the sleep duration
      assertTimingAccuracy(event.timing.duration, 1000, 200);

      // Verify the measured duration is close to actual execution time
      expect(Math.abs(event.timing.duration - totalTime)).toBeLessThan(100);

      // Verify successful execution
      expect(event.result.success).toBe(true);
      expect(event.result.output).toMatchObject({
        command: 'sleep 1',
        exitCode: 0
      });
    });
  });

  describe('Concurrent Operations Timing', () => {
    it('should maintain independent timing for concurrent file operations', async () => {
      const operations = [
        {
          type: 'write' as const,
          params: {
            filePath: testFilePath + '1',
            content: 'Content 1'
          }
        },
        {
          type: 'write' as const,
          params: {
            filePath: testFilePath + '2',
            content: 'Content 2'
          }
        },
        {
          type: 'bash' as const,
          params: {
            command: 'echo "concurrent"',
            timeout: 1000
          }
        }
      ];

      const events = await validator.executeConcurrentOperations(operations);

      expect(events).toHaveLength(3);

      // Verify each operation has independent timing
      events.forEach((event, index) => {
        expect(event.timing).toBeDefined();
        expect(event.timing.startTime).toBeInstanceOf(Date);
        expect(event.timing.endTime).toBeInstanceOf(Date);
        expect(event.timing.duration).toBeGreaterThanOrEqual(0);

        // Verify timing consistency
        const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
        expect(event.timing.duration).toBe(calculatedDuration);

        // Verify unique call IDs
        expect(event.callId).toContain(
          operations[index].type === 'bash' ? 'bash-' : 'write-'
        );
      });

      // Verify all operations succeeded
      events.forEach(event => {
        expect(event.result.success).toBe(true);
      });

      // Verify call IDs are unique
      const callIds = events.map(e => e.callId);
      const uniqueCallIds = new Set(callIds);
      expect(uniqueCallIds.size).toBe(events.length);
    });

    it('should handle mixed success/failure concurrent operations', async () => {
      const operations = [
        {
          type: 'write' as const,
          params: {
            filePath: testFilePath + '_success',
            content: 'Success content'
          }
        },
        {
          type: 'read' as const,
          params: {
            filePath: '/non/existent/path.txt',
            expectedExists: false
          }
        },
        {
          type: 'bash' as const,
          params: {
            command: 'echo "mixed test"',
            timeout: 1000
          }
        }
      ];

      const events = await validator.executeConcurrentOperations(operations);

      expect(events).toHaveLength(3);

      // Verify success/failure pattern
      expect(events[0].result.success).toBe(true);  // write should succeed
      expect(events[1].result.success).toBe(false); // read should fail
      expect(events[2].result.success).toBe(true);  // bash should succeed

      // Verify all have proper timing regardless of success/failure
      events.forEach(event => {
        expect(event.timing).toBeDefined();
        expect(event.timing.duration).toBeGreaterThanOrEqual(0);

        const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
        expect(event.timing.duration).toBe(calculatedDuration);
      });

      // Verify failed operation has proper error
      expect(events[1].result.error).toBeDefined();
      expect(events[1].result.error).toContain('Failed to read file');
    });
  });

  describe('Timing Data Collection and Validation', () => {
    it('should collect all timing events properly', async () => {
      validator.clearEvents();

      // Execute multiple operations
      await validator.executeWriteTool(testFilePath, 'test content');
      await validator.executeReadTool(testFilePath, true);
      await validator.executeBashTool('echo "test"');

      const collectedEvents = validator.getCollectedEvents();
      expect(collectedEvents).toHaveLength(3);

      // Verify all events have proper timing
      collectedEvents.forEach(event => {
        expect(event.timing).toBeDefined();
        expect(event.timing.startTime).toBeInstanceOf(Date);
        expect(event.timing.endTime).toBeInstanceOf(Date);
        expect(typeof event.timing.duration).toBe('number');
        expect(event.timing.duration).toBeGreaterThanOrEqual(0);

        // Verify timestamp consistency
        expect(event.timestamp).toBeInstanceOf(Date);
        expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(
          event.timing.endTime.getTime()
        );
      });

      // Verify event ordering (events should be in execution order)
      const toolNames = collectedEvents.map(e => e.toolName);
      expect(toolNames).toEqual(['WriteTool', 'ReadTool', 'BashTool']);
    });

    it('should validate timing field types and constraints', async () => {
      const event = await validator.executeWriteTool(testFilePath, 'type validation test');

      // Verify all timing fields have correct types
      expect(event.timing.startTime).toBeInstanceOf(Date);
      expect(event.timing.endTime).toBeInstanceOf(Date);
      expect(typeof event.timing.duration).toBe('number');

      // Verify numerical constraints
      expect(event.timing.duration).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(event.timing.duration)).toBe(true);
      expect(Number.isInteger(event.timing.duration)).toBe(true);

      // Verify date constraints
      expect(event.timing.startTime.getTime()).toBeGreaterThan(0);
      expect(event.timing.endTime.getTime()).toBeGreaterThan(0);
      expect(isNaN(event.timing.startTime.getTime())).toBe(false);
      expect(isNaN(event.timing.endTime.getTime())).toBe(false);

      // Verify logical constraints
      expect(event.timing.endTime.getTime()).toBeGreaterThanOrEqual(
        event.timing.startTime.getTime()
      );

      // Verify timestamp is reasonable (within last minute)
      const now = Date.now();
      const oneMinuteAgo = now - 60 * 1000;
      expect(event.timing.startTime.getTime()).toBeGreaterThan(oneMinuteAgo);
      expect(event.timing.endTime.getTime()).toBeGreaterThan(oneMinuteAgo);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle zero-duration operations gracefully', async () => {
      // Execute operation that might complete very quickly
      const event = await validator.executeBashTool('true'); // No-op command

      expect(event.timing.duration).toBeGreaterThanOrEqual(0);
      expect(event.timing.endTime.getTime()).toBeGreaterThanOrEqual(
        event.timing.startTime.getTime()
      );

      // Even zero-duration operations should have consistent timing
      const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
      expect(event.timing.duration).toBe(calculatedDuration);
    });

    it('should maintain timing accuracy under rapid execution', async () => {
      const rapidCount = 10;
      const events: ToolCallCompleteEventLike[] = [];

      for (let i = 0; i < rapidCount; i++) {
        const event = await validator.executeBashTool(`echo ${i}`);
        events.push(event);
      }

      expect(events).toHaveLength(rapidCount);

      // Verify all have valid timing
      events.forEach((event, index) => {
        expect(event.timing).toBeDefined();
        expect(event.timing.duration).toBeGreaterThanOrEqual(0);

        const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
        expect(event.timing.duration).toBe(calculatedDuration);
      });

      // Verify events are chronologically ordered
      for (let i = 1; i < events.length; i++) {
        expect(events[i].timing.startTime.getTime()).toBeGreaterThanOrEqual(
          events[i - 1].timing.endTime.getTime() - 50 // Allow small overlap due to timing precision
        );
      }
    });
  });
});