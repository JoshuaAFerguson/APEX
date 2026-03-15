import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator, ToolCallStartEvent, ToolCallCompleteEvent } from './index';
import { ToolExecution } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    query: vi.fn(),
  };
});

// Mock child_process for git/gh commands
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal();

  // Create promisifiable mock function (inline to avoid hoisting issues)
  const createMock = () => {
    const fn = function(...args: unknown[]) {
      const callback = args.find(arg => typeof arg === 'function') as
        ((error: Error | null, result?: { stdout: string; stderr: string }) => void) | undefined;
      if (callback) {
        process.nextTick(() => callback(null, { stdout: '', stderr: '' }));
      }
      return { stdout: '', stderr: '' };
    };
    (fn as Record<string, unknown>).__promisify__ = async () => ({ stdout: '', stderr: '' });
    return fn;
  };

  const mockExec = createMock();
  const mockExecFile = createMock();
  const mockSpawn = (..._args: unknown[]) => ({
    stdout: { on: () => {} },
    stderr: { on: () => {} },
    on: (event: string, cb: (code: number) => void) => {
      if (event === 'close') process.nextTick(() => cb(0));
    },
    kill: () => {},
  });

  return {
    ...actual,
    default: { ...actual, exec: mockExec, execFile: mockExecFile, spawn: mockSpawn },
    exec: mockExec,
    execFile: mockExecFile,
    spawn: mockSpawn,
  };
});

describe('Tool Execution Timing Infrastructure', () => {
  let orchestrator: ApexOrchestrator;
  let tmpDir: string;
  const mockedQuery = vi.mocked(query);

  beforeEach(async () => {
    // Create a temporary directory for each test
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-timing-test-'));

    // Create .apex directory and necessary workflow
    const apexDir = path.join(tmpDir, '.apex', 'workflows');
    await fs.mkdir(apexDir, { recursive: true });

    // Create a simple testing workflow for the tests
    const testingWorkflow = `name: testing
description: Simple testing workflow for tool timing tests
trigger:
  - manual

stages:
  - name: analysis
    agent: tester
    description: Analyze and test
    outputs:
      - results`;

    await fs.writeFile(path.join(apexDir, 'testing.yaml'), testingWorkflow);

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
      const task = await orchestrator.createTask({
        description: 'Test task with tool usage',
        workflow: 'testing'
      });

      // Run the task
      await orchestrator.executeTask(task.id);

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

      const task = await orchestrator.createTask({
        description: 'Test active tracking',
        workflow: 'testing'
      });

      await orchestrator.executeTask(task.id);

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

      const task = await orchestrator.createTask({
        description: 'Test concurrent tools',
        workflow: 'testing'
      });

      await orchestrator.executeTask(task.id);

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

      const task = await orchestrator.createTask({
        description: 'Test error timing',
        workflow: 'testing'
      });

      await orchestrator.executeTask(task.id);

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

      const task = await orchestrator.createTask({
        description: 'Test timing accuracy',
        workflow: 'testing'
      });

      await orchestrator.executeTask(task.id);

      expect(measuredTiming).toBeTruthy();
      expect(measuredTiming!.duration).toBeCloseTo(EXPECTED_DELAY, TOLERANCE);
      expect(measuredTiming!.duration).toBe(measuredTiming!.calculated);
      expect(measuredTiming!.duration).toBeGreaterThanOrEqual(EXPECTED_DELAY - TOLERANCE);
      expect(measuredTiming!.duration).toBeLessThanOrEqual(EXPECTED_DELAY + TOLERANCE * 2); // Allow extra buffer for CI
    });

    it('should include startTime field in tool:start event', async () => {
      let startEvent: ToolCallStartEvent | null = null;

      orchestrator.on('tool:start', (event) => {
        startEvent = event;
      });

      mockedQuery.mockImplementation(async function* () {
        yield {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'start_time_test',
              name: 'TestStartTimeTool',
              input: { param: 'value' }
            }
          ]
        };

        yield {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'start_time_test',
              content: 'Success',
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
              text: 'StartTime test complete'
            }
          ]
        };
      });

      const task = await orchestrator.createTask({
        description: 'Test startTime field',
        workflow: 'testing'
      });

      await orchestrator.executeTask(task.id);

      expect(startEvent).toBeTruthy();
      expect(startEvent!.startTime).toBeInstanceOf(Date);
      expect(startEvent!.timestamp).toBeInstanceOf(Date);
      // startTime should be the same as timestamp (they both represent when the tool started)
      expect(startEvent!.startTime.getTime()).toBe(startEvent!.timestamp.getTime());
    });

    it('should verify tool timing event sequence and data integrity', async () => {
      const events: Array<{ type: string; data: any; time: number }> = [];

      orchestrator.on('tool:start', (event) => {
        events.push({
          type: 'tool:start',
          data: {
            callId: event.callId,
            toolName: event.toolName,
            timestamp: event.timestamp,
            startTime: event.startTime,
          },
          time: Date.now()
        });
      });

      orchestrator.on('tool:complete', (event) => {
        events.push({
          type: 'tool:complete',
          data: {
            callId: event.callId,
            toolName: event.toolName,
            timing: event.timing,
          },
          time: Date.now()
        });
      });

      mockedQuery.mockImplementation(async function* () {
        yield {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'sequence_test',
              name: 'SequenceTool',
              input: { test: 'sequence' }
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
              tool_use_id: 'sequence_test',
              content: 'Sequence test result',
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
              text: 'Sequence test complete'
            }
          ]
        };
      });

      const task = await orchestrator.createTask({
        description: 'Test event sequence',
        workflow: 'testing'
      });

      await orchestrator.executeTask(task.id);

      // Verify event sequence
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('tool:start');
      expect(events[1].type).toBe('tool:complete');

      // Verify timing consistency
      const startEvent = events[0].data;
      const completeEvent = events[1].data;

      expect(startEvent.callId).toBe(completeEvent.callId);
      expect(startEvent.toolName).toBe(completeEvent.toolName);

      // Verify timing data structure in tool:complete
      expect(completeEvent.timing).toBeDefined();
      expect(completeEvent.timing.startTime).toBeInstanceOf(Date);
      expect(completeEvent.timing.endTime).toBeInstanceOf(Date);
      expect(typeof completeEvent.timing.duration).toBe('number');

      // Verify consistency between start event and complete event timing
      expect(startEvent.startTime.getTime()).toBe(completeEvent.timing.startTime.getTime());
      expect(completeEvent.timing.endTime.getTime()).toBeGreaterThan(completeEvent.timing.startTime.getTime());

      // Verify duration calculation
      const calculatedDuration = completeEvent.timing.endTime.getTime() - completeEvent.timing.startTime.getTime();
      expect(completeEvent.timing.duration).toBe(calculatedDuration);
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