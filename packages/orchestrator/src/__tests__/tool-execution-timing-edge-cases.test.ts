import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator, ToolCallStartEvent, ToolCallCompleteEvent } from '../index';
import { ToolExecution } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

// Mock child_process for git/gh commands
vi.mock('child_process', () => ({
  exec: vi.fn((cmd: string, opts: unknown, callback?: unknown) => {
    if (typeof opts === 'function') {
      callback = opts;
    }
    const cb = callback as (error: Error | null, result?: { stdout: string }) => void;
    cb(null, { stdout: '' });
  }),
}));

describe('Tool Execution Timing Edge Cases', () => {
  let orchestrator: ApexOrchestrator;
  let tmpDir: string;
  const mockedQuery = vi.mocked(query);

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-timing-edge-test-'));
    orchestrator = new ApexOrchestrator({
      projectPath: tmpDir,
    });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    orchestrator.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('Near-Zero Duration Tool Calls', () => {
    it('should handle tool calls with very short execution times', async () => {
      const toolCompleteEvents: ToolCallCompleteEvent[] = [];

      orchestrator.on('tool:complete', (event) => {
        toolCompleteEvents.push(event);
      });

      mockedQuery.mockImplementation(async function* () {
        yield {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'instant_call',
              name: 'InstantTool',
              input: { immediate: true }
            }
          ]
        };

        // No delay - immediate completion
        yield {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'instant_call',
              content: 'Immediate result',
              is_error: false
            }
          ]
        };

        yield {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Instant tool completed'
            }
          ]
        };
      });

      const task = await orchestrator.createTask('Test instant tool', {
        description: 'Test near-zero duration timing'
      });

      await orchestrator.runTask(task.id);

      expect(toolCompleteEvents).toHaveLength(1);
      const event = toolCompleteEvents[0];

      // Should still have valid timing even for instant tools
      expect(event.timing.duration).toBeGreaterThanOrEqual(0);
      expect(event.timing.startTime).toBeInstanceOf(Date);
      expect(event.timing.endTime).toBeInstanceOf(Date);
      expect(event.timing.endTime.getTime()).toBeGreaterThanOrEqual(event.timing.startTime.getTime());
    });
  });

  describe('Timing Precision and Accuracy', () => {
    it('should maintain timing accuracy across different delay ranges', async () => {
      const delays = [1, 10, 50, 100, 200]; // Different delay ranges in ms
      const timingResults: Array<{ expected: number; actual: number; tolerance: number }> = [];

      for (const delay of delays) {
        const toolCompleteEvents: ToolCallCompleteEvent[] = [];

        orchestrator.on('tool:complete', (event) => {
          toolCompleteEvents.push(event);
        });

        mockedQuery.mockImplementation(async function* () {
          yield {
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: `precision_test_${delay}`,
                name: 'PrecisionTool',
                input: { delay }
              }
            ]
          };

          await new Promise(resolve => setTimeout(resolve, delay));

          yield {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: `precision_test_${delay}`,
                content: `Delayed result after ${delay}ms`,
                is_error: false
              }
            ]
          };

          yield {
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'Precision test completed'
              }
            ]
          };
        });

        const task = await orchestrator.createTask(`Test ${delay}ms precision`, {
          description: `Test timing precision for ${delay}ms delay`
        });

        await orchestrator.runTask(task.id);

        if (toolCompleteEvents.length > 0) {
          const actual = toolCompleteEvents[0].timing.duration;
          const tolerance = Math.abs(actual - delay);
          timingResults.push({ expected: delay, actual, tolerance });
        }

        // Clear events for next iteration
        orchestrator.removeAllListeners('tool:complete');
      }

      // Verify all measurements are within acceptable tolerance
      timingResults.forEach(({ expected, actual, tolerance }) => {
        expect(tolerance).toBeLessThanOrEqual(50); // ±50ms tolerance as per acceptance criteria
        expect(actual).toBeGreaterThanOrEqual(expected - 50);
        expect(actual).toBeLessThanOrEqual(expected + 100); // Allow extra buffer for CI environments
      });
    });
  });

  describe('Memory Management', () => {
    it('should properly clean up completed tool executions', async () => {
      // Test that active tool execution tracking doesn't leak memory
      expect(orchestrator.getActiveToolExecutionCount()).toBe(0);

      mockedQuery.mockImplementation(async function* () {
        yield {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'memory_test_1',
              name: 'MemoryTool',
              input: { data: 'test' }
            }
          ]
        };

        yield {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'memory_test_1',
              content: 'Memory test result',
              is_error: false
            }
          ]
        };

        yield {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Memory test completed'
            }
          ]
        };
      });

      const task = await orchestrator.createTask('Test memory cleanup', {
        description: 'Test tool execution memory management'
      });

      await orchestrator.runTask(task.id);

      // After completion, active executions should be cleaned up
      expect(orchestrator.getActiveToolExecutionCount()).toBe(0);
      expect(orchestrator.getActiveToolExecutions()).toEqual([]);
    });
  });

  describe('Concurrent Tool Execution Limits', () => {
    it('should handle rapid sequential tool executions without timing conflicts', async () => {
      const toolEvents: Array<{ type: 'start' | 'complete'; callId: string; timestamp: Date }> = [];

      orchestrator.on('tool:start', (event) => {
        toolEvents.push({ type: 'start', callId: event.callId, timestamp: new Date() });
      });

      orchestrator.on('tool:complete', (event) => {
        toolEvents.push({ type: 'complete', callId: event.callId, timestamp: event.timing.endTime });
      });

      mockedQuery.mockImplementation(async function* () {
        // Rapid sequence of tool calls
        for (let i = 0; i < 5; i++) {
          yield {
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: `rapid_${i}`,
                name: 'RapidTool',
                input: { sequence: i }
              }
            ]
          };

          // Very short delay
          await new Promise(resolve => setTimeout(resolve, 10));

          yield {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: `rapid_${i}`,
                content: `Rapid result ${i}`,
                is_error: false
              }
            ]
          };
        }

        yield {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'All rapid tools completed'
            }
          ]
        };
      });

      const task = await orchestrator.createTask('Test rapid execution', {
        description: 'Test rapid sequential tool execution timing'
      });

      await orchestrator.runTask(task.id);

      // Verify all events were captured
      expect(toolEvents.filter(e => e.type === 'start')).toHaveLength(5);
      expect(toolEvents.filter(e => e.type === 'complete')).toHaveLength(5);

      // Verify timing consistency - start events should precede complete events for same callId
      const callIds = ['rapid_0', 'rapid_1', 'rapid_2', 'rapid_3', 'rapid_4'];
      callIds.forEach(callId => {
        const startEvent = toolEvents.find(e => e.type === 'start' && e.callId === callId);
        const completeEvent = toolEvents.find(e => e.type === 'complete' && e.callId === callId);

        expect(startEvent).toBeDefined();
        expect(completeEvent).toBeDefined();
        expect(completeEvent!.timestamp.getTime()).toBeGreaterThanOrEqual(startEvent!.timestamp.getTime());
      });
    });
  });

  describe('Tool Execution State Consistency', () => {
    it('should maintain consistent state during overlapping tool executions', async () => {
      let maxConcurrent = 0;
      let currentActive = 0;

      orchestrator.on('tool:start', () => {
        currentActive++;
        maxConcurrent = Math.max(maxConcurrent, currentActive);
      });

      orchestrator.on('tool:complete', () => {
        currentActive--;
      });

      mockedQuery.mockImplementation(async function* () {
        // Start multiple overlapping tools
        yield {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'overlap_1',
              name: 'OverlapTool',
              input: { duration: 100 }
            },
            {
              type: 'tool_use',
              id: 'overlap_2',
              name: 'OverlapTool',
              input: { duration: 150 }
            },
            {
              type: 'tool_use',
              id: 'overlap_3',
              name: 'OverlapTool',
              input: { duration: 75 }
            }
          ]
        };

        // Complete tools in different order than started
        await new Promise(resolve => setTimeout(resolve, 75));
        yield {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'overlap_3',
              content: 'Third tool done first',
              is_error: false
            }
          ]
        };

        await new Promise(resolve => setTimeout(resolve, 25));
        yield {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'overlap_1',
              content: 'First tool done second',
              is_error: false
            }
          ]
        };

        await new Promise(resolve => setTimeout(resolve, 50));
        yield {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'overlap_2',
              content: 'Second tool done last',
              is_error: false
            }
          ]
        };

        yield {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'All overlapping tools completed'
            }
          ]
        };
      });

      const task = await orchestrator.createTask('Test overlapping execution', {
        description: 'Test overlapping tool execution state management'
      });

      await orchestrator.runTask(task.id);

      // Verify state consistency
      expect(maxConcurrent).toBe(3); // Should have tracked 3 concurrent executions
      expect(currentActive).toBe(0); // Should be back to 0 after all complete
      expect(orchestrator.getActiveToolExecutionCount()).toBe(0);
    });
  });

  describe('Error Conditions', () => {
    it('should handle tool execution errors without affecting timing infrastructure', async () => {
      const errorEvents: ToolCallCompleteEvent[] = [];

      orchestrator.on('tool:complete', (event) => {
        errorEvents.push(event);
      });

      mockedQuery.mockImplementation(async function* () {
        yield {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'error_timing_test',
              name: 'ErrorTool',
              input: { shouldFail: true }
            }
          ]
        };

        await new Promise(resolve => setTimeout(resolve, 100));

        yield {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'error_timing_test',
              content: 'Simulated tool error',
              is_error: true
            }
          ]
        };

        yield {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Handling error gracefully'
            }
          ]
        };
      });

      const task = await orchestrator.createTask('Test error timing', {
        description: 'Test timing infrastructure with tool errors'
      });

      await orchestrator.runTask(task.id);

      expect(errorEvents).toHaveLength(1);
      const errorEvent = errorEvents[0];

      // Even failed tools should have valid timing
      expect(errorEvent.result.success).toBe(false);
      expect(errorEvent.timing.duration).toBeGreaterThanOrEqual(90); // Should be around 100ms ±10ms
      expect(errorEvent.timing.duration).toBeLessThanOrEqual(150);
      expect(errorEvent.timing.startTime).toBeInstanceOf(Date);
      expect(errorEvent.timing.endTime).toBeInstanceOf(Date);

      // Infrastructure should be clean after error
      expect(orchestrator.getActiveToolExecutionCount()).toBe(0);
    });
  });
});