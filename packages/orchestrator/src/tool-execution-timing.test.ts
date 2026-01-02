import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator, ToolCallStartEvent, ToolCallCompleteEvent } from './index';
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

describe('Tool Execution Timing Infrastructure', () => {
  let orchestrator: ApexOrchestrator;
  let tmpDir: string;
  const mockedQuery = vi.mocked(query);

  beforeEach(async () => {
    // Create a temporary directory for each test
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-timing-test-'));

    orchestrator = new ApexOrchestrator({
      projectPath: tmpDir,
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up
    orchestrator.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('ToolExecution Type', () => {
    it('should create valid ToolExecution objects', () => {
      const startTime = new Date();
      const toolExecution: ToolExecution = {
        callId: 'test-call-123',
        toolName: 'TestTool',
        input: { param1: 'value1' },
        taskId: 'task-456',
        agentName: 'TestAgent',
        stageName: 'test-stage',
        startTime,
        status: 'running',
      };

      expect(toolExecution).toBeDefined();
      expect(toolExecution.callId).toBe('test-call-123');
      expect(toolExecution.toolName).toBe('TestTool');
      expect(toolExecution.startTime).toBe(startTime);
      expect(toolExecution.status).toBe('running');
    });

    it('should support completed ToolExecution with timing data', () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 1000); // 1 second later
      const duration = endTime.getTime() - startTime.getTime();

      const completedExecution: ToolExecution = {
        callId: 'test-call-123',
        toolName: 'TestTool',
        input: { param1: 'value1' },
        startTime,
        endTime,
        duration,
        status: 'completed',
        result: {
          success: true,
          output: 'Tool executed successfully',
        },
      };

      expect(completedExecution.duration).toBe(1000);
      expect(completedExecution.status).toBe('completed');
      expect(completedExecution.result?.success).toBe(true);
    });
  });

  describe('Orchestrator Tool Execution Tracking', () => {
    it('should initialize with empty tool execution tracking', () => {
      expect(orchestrator.getActiveToolExecutionCount()).toBe(0);
      expect(orchestrator.getActiveToolExecutions()).toEqual([]);
    });

    it('should track tool execution during agent query', async () => {
      const toolStartEvents: ToolCallStartEvent[] = [];
      const toolCompleteEvents: ToolCallCompleteEvent[] = [];

      // Set up event listeners
      orchestrator.on('tool:start', (event) => {
        toolStartEvents.push(event);
      });

      orchestrator.on('tool:complete', (event) => {
        toolCompleteEvents.push(event);
      });

      // Mock the SDK query to simulate tool usage
      mockedQuery.mockImplementation(async function* () {
        // Simulate agent message with tool use
        yield {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'call_123',
              name: 'TestTool',
              input: { param: 'value' }
            }
          ]
        };

        // Small delay to make timing meaningful
        await new Promise(resolve => setTimeout(resolve, 100));

        // Simulate tool result
        yield {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'call_123',
              content: 'Tool executed successfully',
              is_error: false
            }
          ]
        };

        // Final assistant message
        yield {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Task completed successfully'
            }
          ]
        };
      });

      // Create a test task
      const task = await orchestrator.createTask('Test task with tool usage', {
        description: 'Test tool timing functionality'
      });

      // Run the task
      await orchestrator.runTask(task.id);

      // Verify tool events were emitted
      expect(toolStartEvents).toHaveLength(1);
      expect(toolCompleteEvents).toHaveLength(1);

      const startEvent = toolStartEvents[0];
      const completeEvent = toolCompleteEvents[0];

      expect(startEvent.callId).toBe('call_123');
      expect(startEvent.toolName).toBe('TestTool');
      expect(completeEvent.callId).toBe('call_123');
      expect(completeEvent.toolName).toBe('TestTool');
      expect(completeEvent.timing.duration).toBeGreaterThan(0);
      expect(completeEvent.timing.endTime.getTime() - completeEvent.timing.startTime.getTime())
        .toBeCloseTo(completeEvent.timing.duration, 50); // Allow 50ms tolerance
    });

    it('should track active tool executions during query', async () => {
      let activeExecutionsDuringTool: ToolExecution[] = [];

      // Set up event listener to capture active executions during tool usage
      orchestrator.on('tool:start', () => {
        activeExecutionsDuringTool = orchestrator.getActiveToolExecutions();
      });

      // Mock the SDK query
      mockedQuery.mockImplementation(async function* () {
        yield {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'call_456',
              name: 'AsyncTool',
              input: { timeout: 200 }
            }
          ]
        };

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 50));

        yield {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'call_456',
              content: { result: 'success' },
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
              text: 'Async tool completed'
            }
          ]
        };
      });

      const task = await orchestrator.createTask('Test active tracking', {
        description: 'Test active tool execution tracking'
      });

      await orchestrator.runTask(task.id);

      // Verify active executions were tracked
      expect(activeExecutionsDuringTool).toHaveLength(1);
      expect(activeExecutionsDuringTool[0].callId).toBe('call_456');
      expect(activeExecutionsDuringTool[0].toolName).toBe('AsyncTool');
      expect(activeExecutionsDuringTool[0].status).toBe('running');

      // Verify cleanup after completion
      expect(orchestrator.getActiveToolExecutionCount()).toBe(0);
    });

    it('should handle multiple concurrent tool executions', async () => {
      const toolEvents: Array<{ type: 'start' | 'complete'; callId: string; timing?: any }> = [];

      orchestrator.on('tool:start', (event) => {
        toolEvents.push({ type: 'start', callId: event.callId });
      });

      orchestrator.on('tool:complete', (event) => {
        toolEvents.push({ type: 'complete', callId: event.callId, timing: event.timing });
      });

      mockedQuery.mockImplementation(async function* () {
        // Start multiple tools
        yield {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'call_1',
              name: 'Tool1',
              input: {}
            },
            {
              type: 'tool_use',
              id: 'call_2',
              name: 'Tool2',
              input: {}
            }
          ]
        };

        // Complete first tool
        yield {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'call_1',
              content: 'Tool1 result',
              is_error: false
            }
          ]
        };

        // Complete second tool
        yield {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'call_2',
              content: 'Tool2 result',
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
              text: 'All tools completed'
            }
          ]
        };
      });

      const task = await orchestrator.createTask('Test concurrent tools', {
        description: 'Test multiple concurrent tool execution tracking'
      });

      await orchestrator.runTask(task.id);

      // Verify all events were tracked
      expect(toolEvents).toHaveLength(4); // 2 starts + 2 completes
      expect(toolEvents.filter(e => e.type === 'start')).toHaveLength(2);
      expect(toolEvents.filter(e => e.type === 'complete')).toHaveLength(2);

      // Verify timing data for completed tools
      const completeEvents = toolEvents.filter(e => e.type === 'complete');
      completeEvents.forEach(event => {
        expect(event.timing).toBeDefined();
        expect(event.timing.duration).toBeGreaterThanOrEqual(0);
        expect(event.timing.startTime).toBeInstanceOf(Date);
        expect(event.timing.endTime).toBeInstanceOf(Date);
      });
    });

    it('should handle tool execution errors with timing', async () => {
      let errorToolEvent: ToolCallCompleteEvent | null = null;

      orchestrator.on('tool:complete', (event) => {
        errorToolEvent = event;
      });

      mockedQuery.mockImplementation(async function* () {
        yield {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'error_call',
              name: 'ErrorTool',
              input: { trigger: 'error' }
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
              tool_use_id: 'error_call',
              content: 'Tool execution failed',
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
              text: 'Handling tool error'
            }
          ]
        };
      });

      const task = await orchestrator.createTask('Test error timing', {
        description: 'Test tool execution error timing'
      });

      await orchestrator.runTask(task.id);

      expect(errorToolEvent).toBeTruthy();
      expect(errorToolEvent!.result.success).toBe(false);
      expect(errorToolEvent!.result.error).toBe('Tool execution failed');
      expect(errorToolEvent!.timing.duration).toBeGreaterThan(0);
    });

    it('should verify timing accuracy within tolerance', async () => {
      const EXPECTED_DELAY = 100; // 100ms
      const TOLERANCE = 50; // ±50ms tolerance
      let measuredTiming: { duration: number; calculated: number } | null = null;

      orchestrator.on('tool:complete', (event) => {
        const calculated = event.timing.endTime.getTime() - event.timing.startTime.getTime();
        measuredTiming = {
          duration: event.timing.duration,
          calculated
        };
      });

      mockedQuery.mockImplementation(async function* () {
        yield {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'timing_test',
              name: 'TimingTool',
              input: { delay: EXPECTED_DELAY }
            }
          ]
        };

        // Precise delay for testing
        await new Promise(resolve => setTimeout(resolve, EXPECTED_DELAY));

        yield {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'timing_test',
              content: 'Delayed execution complete',
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
              text: 'Timing test complete'
            }
          ]
        };
      });

      const task = await orchestrator.createTask('Test timing accuracy', {
        description: 'Test tool execution timing accuracy'
      });

      await orchestrator.runTask(task.id);

      expect(measuredTiming).toBeTruthy();
      expect(measuredTiming!.duration).toBeCloseTo(EXPECTED_DELAY, TOLERANCE);
      expect(measuredTiming!.duration).toBe(measuredTiming!.calculated);
      expect(measuredTiming!.duration).toBeGreaterThanOrEqual(EXPECTED_DELAY - TOLERANCE);
      expect(measuredTiming!.duration).toBeLessThanOrEqual(EXPECTED_DELAY + TOLERANCE * 2); // Allow extra buffer for CI
    });
  });

  describe('Utility Methods', () => {
    it('should provide correct tool execution information via utility methods', async () => {
      expect(orchestrator.getActiveToolExecutionCount()).toBe(0);
      expect(orchestrator.isToolExecutionActive('nonexistent')).toBe(false);
      expect(orchestrator.getToolExecution('nonexistent')).toBeUndefined();
    });
  });
});