/**
 * Tool Start Event Emission Tests
 *
 * Tests that verify all 12 supported tools emit tool:start events correctly.
 * These tests validate that the orchestrator properly emits tool:start events
 * for every tool execution.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MockOrchestrator,
  EventCapture,
  createTestOrchestrator,
  waitForEvents
} from '../tool-complete-events/shared/orchestrator-test-harness';
import {
  SUPPORTED_TOOLS,
  TOOL_CONFIGS,
  SupportedTool,
  createTestTaskId,
  createTestCallId
} from '../tool-complete-events/shared/tool-test-fixtures';
import { createToolStartEvent } from '../event-data-integrity/shared/mock-event-generators';

describe('Tool Start Event Emission', () => {
  let orchestrator: MockOrchestrator;
  let eventCapture: EventCapture;
  let taskId: string;

  beforeEach(() => {
    orchestrator = createTestOrchestrator();
    eventCapture = new EventCapture(orchestrator);
    taskId = createTestTaskId();
  });

  afterEach(() => {
    eventCapture.clear();
    orchestrator.reset();
  });

  describe('All Tools Emit Start Events', () => {
    it('should emit tool:start for all 12 supported tools', async () => {
      // Start capturing tool:start events
      eventCapture.startCapturing(['tool:start']);

      // Start execution for each tool
      const callIds: string[] = [];
      for (const tool of SUPPORTED_TOOLS) {
        const callId = orchestrator.startToolExecution(taskId, tool);
        callIds.push(callId);
      }

      // Wait a moment for events to be captured
      await new Promise(resolve => setTimeout(resolve, 10));

      // Get all captured tool:start events
      const startEvents = eventCapture.getEventsByType('tool:start');

      // Should have exactly 12 start events
      expect(startEvents).toHaveLength(12);

      // Verify each tool emitted a start event
      for (const tool of SUPPORTED_TOOLS) {
        const toolStartEvent = startEvents.find(event =>
          (event.data as any).toolName === tool
        );
        expect(toolStartEvent).toBeDefined();
        expect((toolStartEvent!.data as any).toolName).toBe(tool);
      }

      // Clean up active executions
      orchestrator.forceCompleteAllExecutions(taskId);
    });

    it('should emit tool:start before tool execution begins', async () => {
      const tool: SupportedTool = 'Read';
      let toolStartEmitted = false;
      let toolExecutionStarted = false;

      // Listen for tool:start
      orchestrator.on('tool:start', () => {
        toolStartEmitted = true;
        // Execution should not have started yet
        expect(toolExecutionStarted).toBe(false);
      });

      // Start tool execution
      const callId = orchestrator.startToolExecution(taskId, tool);
      toolExecutionStarted = true;

      // Verify start event was emitted before execution
      expect(toolStartEmitted).toBe(true);

      // Clean up
      orchestrator.completeToolExecution(taskId, callId);
    });

    it('should emit separate tool:start events for concurrent tools', async () => {
      const tools: SupportedTool[] = ['Read', 'Write', 'Edit', 'Bash'];

      // Start capturing events
      eventCapture.startCapturing(['tool:start']);

      // Start multiple tools concurrently
      const callIds = await Promise.all(
        tools.map(tool => orchestrator.startToolExecution(taskId, tool))
      );

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 10));

      const startEvents = eventCapture.getEventsByType('tool:start');

      // Should have separate events for each tool
      expect(startEvents).toHaveLength(4);

      // Each event should have unique callId
      const callIdSet = new Set(startEvents.map(event => (event.data as any).callId));
      expect(callIdSet.size).toBe(4);

      // Each event should have correct tool name
      const toolNames = startEvents.map(event => (event.data as any).toolName);
      expect(toolNames).toEqual(expect.arrayContaining(tools));

      // Clean up
      for (const callId of callIds) {
        orchestrator.completeToolExecution(taskId, callId);
      }
    });

    it('should include all required fields in tool:start event', async () => {
      const tool: SupportedTool = 'Read';

      eventCapture.startCapturing(['tool:start']);
      const callId = orchestrator.startToolExecution(taskId, tool);

      await new Promise(resolve => setTimeout(resolve, 10));

      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(1);

      const startEvent = startEvents[0].data as any;

      // Verify all required fields are present
      expect(startEvent).toHaveProperty('taskId');
      expect(startEvent).toHaveProperty('toolName');
      expect(startEvent).toHaveProperty('callId');
      expect(startEvent).toHaveProperty('input');
      expect(startEvent).toHaveProperty('timestamp');

      // Verify field types
      expect(typeof startEvent.taskId).toBe('string');
      expect(typeof startEvent.toolName).toBe('string');
      expect(typeof startEvent.callId).toBe('string');
      expect(typeof startEvent.input).toBe('object');
      expect(startEvent.timestamp).toBeInstanceOf(Date);

      // Verify field values
      expect(startEvent.taskId).toBe(taskId);
      expect(startEvent.toolName).toBe(tool);
      expect(startEvent.callId).toBe(callId);
      expect(startEvent.input).toEqual(TOOL_CONFIGS[tool].sampleInput);

      // Clean up
      orchestrator.completeToolExecution(taskId, callId);
    });

    it('should emit tool:start with correct tool name', async () => {
      const testTools: SupportedTool[] = ['Grep', 'Glob', 'WebFetch'];

      eventCapture.startCapturing(['tool:start']);

      const callIds: string[] = [];
      for (const tool of testTools) {
        const callId = orchestrator.startToolExecution(taskId, tool);
        callIds.push(callId);
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(3);

      // Verify each event has the correct tool name
      for (let i = 0; i < testTools.length; i++) {
        const expectedTool = testTools[i];
        const event = startEvents.find(e => (e.data as any).toolName === expectedTool);
        expect(event).toBeDefined();
        expect((event!.data as any).toolName).toBe(expectedTool);
      }

      // Clean up
      for (const callId of callIds) {
        orchestrator.completeToolExecution(taskId, callId);
      }
    });
  });

  describe('Event Timing', () => {
    it('should emit tool:start with current timestamp', async () => {
      const tool: SupportedTool = 'Write';
      const startTime = new Date();

      eventCapture.startCapturing(['tool:start']);
      const callId = orchestrator.startToolExecution(taskId, tool);

      const endTime = new Date();

      await new Promise(resolve => setTimeout(resolve, 10));

      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(1);

      const eventTimestamp = (startEvents[0].data as any).timestamp;
      expect(eventTimestamp).toBeInstanceOf(Date);

      // Timestamp should be within the execution window
      expect(eventTimestamp.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
      expect(eventTimestamp.getTime()).toBeLessThanOrEqual(endTime.getTime());

      // Clean up
      orchestrator.completeToolExecution(taskId, callId);
    });

    it('should emit tool:start immediately upon execution start', async () => {
      const tool: SupportedTool = 'Bash';
      let eventEmitted = false;
      let eventTimestamp: Date | null = null;

      orchestrator.on('tool:start', (event) => {
        eventEmitted = true;
        eventTimestamp = event.timestamp;
      });

      const executionStart = new Date();
      const callId = orchestrator.startToolExecution(taskId, tool);
      const executionAfter = new Date();

      // Event should be emitted immediately
      expect(eventEmitted).toBe(true);
      expect(eventTimestamp).not.toBeNull();

      // Timestamp should be very close to execution start
      const timeDiff = eventTimestamp!.getTime() - executionStart.getTime();
      expect(timeDiff).toBeLessThan(100); // Within 100ms

      // Clean up
      orchestrator.completeToolExecution(taskId, callId);
    });
  });

  describe('Event Integrity', () => {
    it('should emit tool:start with valid input matching tool config', async () => {
      const testCases: Array<{ tool: SupportedTool; expectedInput: any }> = [
        { tool: 'Read', expectedInput: TOOL_CONFIGS['Read'].sampleInput },
        { tool: 'Write', expectedInput: TOOL_CONFIGS['Write'].sampleInput },
        { tool: 'Edit', expectedInput: TOOL_CONFIGS['Edit'].sampleInput },
        { tool: 'Bash', expectedInput: TOOL_CONFIGS['Bash'].sampleInput },
      ];

      for (const { tool, expectedInput } of testCases) {
        // Reset orchestrator and event capture for each test case
        orchestrator.reset();
        eventCapture.clear();
        eventCapture.startCapturing(['tool:start']);

        const callId = orchestrator.startToolExecution(taskId, tool);

        await new Promise(resolve => setTimeout(resolve, 10));

        const startEvents = eventCapture.getEventsByType('tool:start');
        expect(startEvents).toHaveLength(1);

        const eventInput = (startEvents[0].data as any).input;
        expect(eventInput).toEqual(expectedInput);

        orchestrator.completeToolExecution(taskId, callId);
      }
    });

    it('should emit tool:start with unique callId for each execution', async () => {
      const tool: SupportedTool = 'TodoWrite';

      eventCapture.startCapturing(['tool:start']);

      // Start multiple executions of the same tool
      const callId1 = orchestrator.startToolExecution(taskId, tool);
      const callId2 = orchestrator.startToolExecution(taskId, tool);
      const callId3 = orchestrator.startToolExecution(taskId, tool);

      await new Promise(resolve => setTimeout(resolve, 10));

      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(3);

      // Extract callIds from events
      const eventCallIds = startEvents.map(event => (event.data as any).callId);

      // All callIds should be unique
      const uniqueCallIds = new Set(eventCallIds);
      expect(uniqueCallIds.size).toBe(3);

      // CallIds should match what orchestrator returned
      expect(eventCallIds).toContain(callId1);
      expect(eventCallIds).toContain(callId2);
      expect(eventCallIds).toContain(callId3);

      // Clean up
      orchestrator.completeToolExecution(taskId, callId1);
      orchestrator.completeToolExecution(taskId, callId2);
      orchestrator.completeToolExecution(taskId, callId3);
    });
  });

  describe('Error Scenarios', () => {
    it('should still emit tool:start even if tool execution will fail', async () => {
      const tool: SupportedTool = 'Read';

      eventCapture.startCapturing(['tool:start']);

      // Start tool that will fail
      const callId = orchestrator.startToolExecution(taskId, tool);

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should still emit start event
      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(1);

      const startEvent = startEvents[0].data as any;
      expect(startEvent.toolName).toBe(tool);
      expect(startEvent.taskId).toBe(taskId);
      expect(startEvent.callId).toBe(callId);

      // Now fail the tool
      orchestrator.failToolExecution(taskId, callId, 'Simulated failure');
    });
  });
});