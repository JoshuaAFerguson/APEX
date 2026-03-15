/**
 * All Tools Start Events Integration Tests
 *
 * Integration tests that verify each of the 12 supported tools emits
 * tool:start events correctly when executed through the MockOrchestrator.
 * These tests use realistic tool configurations and validate event emission
 * for every supported tool.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MockOrchestrator,
  EventCapture,
  createTestOrchestrator
} from '../tool-complete-events/shared/orchestrator-test-harness';
import {
  SUPPORTED_TOOLS,
  TOOL_CONFIGS,
  SupportedTool,
  createTestTaskId
} from '../tool-complete-events/shared/tool-test-fixtures';

describe('All Tools Start Events - Integration Tests', () => {
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
    it('Read tool emits tool:start event', async () => {
      const tool: SupportedTool = 'Read';
      const expectedInput = TOOL_CONFIGS[tool].sampleInput;

      eventCapture.startCapturing(['tool:start']);
      const callId = orchestrator.startToolExecution(taskId, tool);

      await new Promise(resolve => setTimeout(resolve, 10));

      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(1);

      const event = startEvents[0].data as any;
      expect(event.taskId).toBe(taskId);
      expect(event.toolName).toBe('Read');
      expect(event.callId).toBe(callId);
      expect(event.input).toEqual(expectedInput);
      expect(event.timestamp).toBeInstanceOf(Date);

      orchestrator.completeToolExecution(taskId, callId);
    });

    it('Write tool emits tool:start event', async () => {
      const tool: SupportedTool = 'Write';
      const expectedInput = TOOL_CONFIGS[tool].sampleInput;

      eventCapture.startCapturing(['tool:start']);
      const callId = orchestrator.startToolExecution(taskId, tool);

      await new Promise(resolve => setTimeout(resolve, 10));

      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(1);

      const event = startEvents[0].data as any;
      expect(event.taskId).toBe(taskId);
      expect(event.toolName).toBe('Write');
      expect(event.callId).toBe(callId);
      expect(event.input).toEqual(expectedInput);
      expect(event.timestamp).toBeInstanceOf(Date);

      orchestrator.completeToolExecution(taskId, callId);
    });

    it('Edit tool emits tool:start event', async () => {
      const tool: SupportedTool = 'Edit';
      const expectedInput = TOOL_CONFIGS[tool].sampleInput;

      eventCapture.startCapturing(['tool:start']);
      const callId = orchestrator.startToolExecution(taskId, tool);

      await new Promise(resolve => setTimeout(resolve, 10));

      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(1);

      const event = startEvents[0].data as any;
      expect(event.taskId).toBe(taskId);
      expect(event.toolName).toBe('Edit');
      expect(event.callId).toBe(callId);
      expect(event.input).toEqual(expectedInput);
      expect(event.timestamp).toBeInstanceOf(Date);

      orchestrator.completeToolExecution(taskId, callId);
    });

    it('MultiEdit tool emits tool:start event', async () => {
      const tool: SupportedTool = 'MultiEdit';
      const expectedInput = TOOL_CONFIGS[tool].sampleInput;

      eventCapture.startCapturing(['tool:start']);
      const callId = orchestrator.startToolExecution(taskId, tool);

      await new Promise(resolve => setTimeout(resolve, 10));

      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(1);

      const event = startEvents[0].data as any;
      expect(event.taskId).toBe(taskId);
      expect(event.toolName).toBe('MultiEdit');
      expect(event.callId).toBe(callId);
      expect(event.input).toEqual(expectedInput);
      expect(event.timestamp).toBeInstanceOf(Date);

      // Verify complex input structure for MultiEdit
      expect(event.input.edits).toBeInstanceOf(Array);
      expect(event.input.edits).toHaveLength(2);

      orchestrator.completeToolExecution(taskId, callId);
    });

    it('NotebookEdit tool emits tool:start event', async () => {
      const tool: SupportedTool = 'NotebookEdit';
      const expectedInput = TOOL_CONFIGS[tool].sampleInput;

      eventCapture.startCapturing(['tool:start']);
      const callId = orchestrator.startToolExecution(taskId, tool);

      await new Promise(resolve => setTimeout(resolve, 10));

      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(1);

      const event = startEvents[0].data as any;
      expect(event.taskId).toBe(taskId);
      expect(event.toolName).toBe('NotebookEdit');
      expect(event.callId).toBe(callId);
      expect(event.input).toEqual(expectedInput);
      expect(event.timestamp).toBeInstanceOf(Date);

      // Verify notebook-specific input fields
      expect(event.input.notebook_path).toContain('.ipynb');
      expect(event.input.cell_type).toBeDefined();

      orchestrator.completeToolExecution(taskId, callId);
    });

    it('Bash tool emits tool:start event', async () => {
      const tool: SupportedTool = 'Bash';
      const expectedInput = TOOL_CONFIGS[tool].sampleInput;

      eventCapture.startCapturing(['tool:start']);
      const callId = orchestrator.startToolExecution(taskId, tool);

      await new Promise(resolve => setTimeout(resolve, 10));

      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(1);

      const event = startEvents[0].data as any;
      expect(event.taskId).toBe(taskId);
      expect(event.toolName).toBe('Bash');
      expect(event.callId).toBe(callId);
      expect(event.input).toEqual(expectedInput);
      expect(event.timestamp).toBeInstanceOf(Date);

      // Verify bash-specific input fields
      expect(event.input.command).toBeDefined();
      expect(typeof event.input.command).toBe('string');

      orchestrator.completeToolExecution(taskId, callId);
    });

    it('Grep tool emits tool:start event', async () => {
      const tool: SupportedTool = 'Grep';
      const expectedInput = TOOL_CONFIGS[tool].sampleInput;

      eventCapture.startCapturing(['tool:start']);
      const callId = orchestrator.startToolExecution(taskId, tool);

      await new Promise(resolve => setTimeout(resolve, 10));

      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(1);

      const event = startEvents[0].data as any;
      expect(event.taskId).toBe(taskId);
      expect(event.toolName).toBe('Grep');
      expect(event.callId).toBe(callId);
      expect(event.input).toEqual(expectedInput);
      expect(event.timestamp).toBeInstanceOf(Date);

      // Verify grep-specific input fields
      expect(event.input.pattern).toBeDefined();
      expect(event.input.path).toBeDefined();

      orchestrator.completeToolExecution(taskId, callId);
    });

    it('Glob tool emits tool:start event', async () => {
      const tool: SupportedTool = 'Glob';
      const expectedInput = TOOL_CONFIGS[tool].sampleInput;

      eventCapture.startCapturing(['tool:start']);
      const callId = orchestrator.startToolExecution(taskId, tool);

      await new Promise(resolve => setTimeout(resolve, 10));

      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(1);

      const event = startEvents[0].data as any;
      expect(event.taskId).toBe(taskId);
      expect(event.toolName).toBe('Glob');
      expect(event.callId).toBe(callId);
      expect(event.input).toEqual(expectedInput);
      expect(event.timestamp).toBeInstanceOf(Date);

      // Verify glob-specific input fields
      expect(event.input.pattern).toBeDefined();
      expect(event.input.pattern).toContain('*');

      orchestrator.completeToolExecution(taskId, callId);
    });

    it('WebFetch tool emits tool:start event', async () => {
      const tool: SupportedTool = 'WebFetch';
      const expectedInput = TOOL_CONFIGS[tool].sampleInput;

      eventCapture.startCapturing(['tool:start']);
      const callId = orchestrator.startToolExecution(taskId, tool);

      await new Promise(resolve => setTimeout(resolve, 10));

      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(1);

      const event = startEvents[0].data as any;
      expect(event.taskId).toBe(taskId);
      expect(event.toolName).toBe('WebFetch');
      expect(event.callId).toBe(callId);
      expect(event.input).toEqual(expectedInput);
      expect(event.timestamp).toBeInstanceOf(Date);

      // Verify web fetch-specific input fields
      expect(event.input.url).toBeDefined();
      expect(event.input.url).toContain('https://');
      expect(event.input.prompt).toBeDefined();

      orchestrator.completeToolExecution(taskId, callId);
    });

    it('WebSearch tool emits tool:start event', async () => {
      const tool: SupportedTool = 'WebSearch';
      const expectedInput = TOOL_CONFIGS[tool].sampleInput;

      eventCapture.startCapturing(['tool:start']);
      const callId = orchestrator.startToolExecution(taskId, tool);

      await new Promise(resolve => setTimeout(resolve, 10));

      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(1);

      const event = startEvents[0].data as any;
      expect(event.taskId).toBe(taskId);
      expect(event.toolName).toBe('WebSearch');
      expect(event.callId).toBe(callId);
      expect(event.input).toEqual(expectedInput);
      expect(event.timestamp).toBeInstanceOf(Date);

      // Verify web search-specific input fields
      expect(event.input.query).toBeDefined();
      expect(typeof event.input.query).toBe('string');

      orchestrator.completeToolExecution(taskId, callId);
    });

    it('TodoWrite tool emits tool:start event', async () => {
      const tool: SupportedTool = 'TodoWrite';
      const expectedInput = TOOL_CONFIGS[tool].sampleInput;

      eventCapture.startCapturing(['tool:start']);
      const callId = orchestrator.startToolExecution(taskId, tool);

      await new Promise(resolve => setTimeout(resolve, 10));

      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(1);

      const event = startEvents[0].data as any;
      expect(event.taskId).toBe(taskId);
      expect(event.toolName).toBe('TodoWrite');
      expect(event.callId).toBe(callId);
      expect(event.input).toEqual(expectedInput);
      expect(event.timestamp).toBeInstanceOf(Date);

      // Verify todo-specific input fields
      expect(event.input.todos).toBeInstanceOf(Array);
      expect(event.input.todos.length).toBeGreaterThan(0);
      expect(event.input.todos[0]).toHaveProperty('content');
      expect(event.input.todos[0]).toHaveProperty('status');
      expect(event.input.todos[0]).toHaveProperty('activeForm');

      orchestrator.completeToolExecution(taskId, callId);
    });

    it('Browser tool emits tool:start event', async () => {
      const tool: SupportedTool = 'Browser';
      const expectedInput = TOOL_CONFIGS[tool].sampleInput;

      eventCapture.startCapturing(['tool:start']);
      const callId = orchestrator.startToolExecution(taskId, tool);

      await new Promise(resolve => setTimeout(resolve, 10));

      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(1);

      const event = startEvents[0].data as any;
      expect(event.taskId).toBe(taskId);
      expect(event.toolName).toBe('Browser');
      expect(event.callId).toBe(callId);
      expect(event.input).toEqual(expectedInput);
      expect(event.timestamp).toBeInstanceOf(Date);

      // Verify browser-specific input fields
      expect(event.input.operation).toBeDefined();
      expect(event.input.params).toBeDefined();
      expect(typeof event.input.params).toBe('object');

      orchestrator.completeToolExecution(taskId, callId);
    });
  });

  describe('Comprehensive Tool Event Verification', () => {
    it('all 12 tools emit start events in sequence', async () => {
      eventCapture.startCapturing(['tool:start']);

      const callIds: string[] = [];

      // Start all tools in sequence
      for (const tool of SUPPORTED_TOOLS) {
        const callId = orchestrator.startToolExecution(taskId, tool);
        callIds.push(callId);

        // Small delay between starts to ensure ordering
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      // Wait for all events to be captured
      await new Promise(resolve => setTimeout(resolve, 20));

      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(12);

      // Verify each tool appears exactly once
      const toolNames = startEvents.map(event => (event.data as any).toolName);
      const uniqueToolNames = new Set(toolNames);

      expect(uniqueToolNames.size).toBe(12);
      for (const tool of SUPPORTED_TOOLS) {
        expect(toolNames).toContain(tool);
      }

      // Verify all callIds are unique
      const eventCallIds = startEvents.map(event => (event.data as any).callId);
      const uniqueCallIds = new Set(eventCallIds);
      expect(uniqueCallIds.size).toBe(12);

      // Verify all callIds match what we got from orchestrator
      for (const callId of callIds) {
        expect(eventCallIds).toContain(callId);
      }

      // Clean up
      for (const callId of callIds) {
        orchestrator.completeToolExecution(taskId, callId);
      }
    });

    it('all 12 tools emit start events concurrently', async () => {
      eventCapture.startCapturing(['tool:start']);

      // Start all tools simultaneously
      const callIds = await Promise.all(
        SUPPORTED_TOOLS.map(tool =>
          Promise.resolve(orchestrator.startToolExecution(taskId, tool))
        )
      );

      await new Promise(resolve => setTimeout(resolve, 20));

      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(12);

      // Verify event structure for each tool
      for (const event of startEvents) {
        const eventData = event.data as any;

        expect(eventData.taskId).toBe(taskId);
        expect(SUPPORTED_TOOLS).toContain(eventData.toolName);
        expect(callIds).toContain(eventData.callId);
        expect(typeof eventData.input).toBe('object');
        expect(eventData.timestamp).toBeInstanceOf(Date);
      }

      // Verify timing - all events should be very close in time
      const timestamps = startEvents.map(event => (event.data as any).timestamp.getTime());
      const minTime = Math.min(...timestamps);
      const maxTime = Math.max(...timestamps);
      const timeDifference = maxTime - minTime;

      // All events should be within 100ms of each other
      expect(timeDifference).toBeLessThan(100);

      // Clean up
      for (const callId of callIds) {
        orchestrator.completeToolExecution(taskId, callId);
      }
    });

    it('tool start events have consistent structure across all tools', async () => {
      eventCapture.startCapturing(['tool:start']);

      const callIds: string[] = [];
      for (const tool of SUPPORTED_TOOLS) {
        const callId = orchestrator.startToolExecution(taskId, tool);
        callIds.push(callId);
      }

      await new Promise(resolve => setTimeout(resolve, 20));

      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(12);

      // Verify consistent structure for all events
      for (const event of startEvents) {
        const eventData = event.data as any;

        // Required fields
        expect(eventData).toHaveProperty('taskId');
        expect(eventData).toHaveProperty('toolName');
        expect(eventData).toHaveProperty('callId');
        expect(eventData).toHaveProperty('input');
        expect(eventData).toHaveProperty('timestamp');

        // Field types
        expect(typeof eventData.taskId).toBe('string');
        expect(typeof eventData.toolName).toBe('string');
        expect(typeof eventData.callId).toBe('string');
        expect(typeof eventData.input).toBe('object');
        expect(eventData.timestamp).toBeInstanceOf(Date);

        // Field constraints
        expect(eventData.taskId).toBeTruthy();
        expect(eventData.toolName).toBeTruthy();
        expect(eventData.callId).toBeTruthy();
        expect(eventData.input).not.toBeNull();
      }

      // Clean up
      for (const callId of callIds) {
        orchestrator.completeToolExecution(taskId, callId);
      }
    });
  });

  describe('Tool Category Verification', () => {
    it('file tools emit start events correctly', async () => {
      const fileTools = SUPPORTED_TOOLS.filter(tool =>
        TOOL_CONFIGS[tool].category === 'file'
      );

      eventCapture.startCapturing(['tool:start']);

      const callIds: string[] = [];
      for (const tool of fileTools) {
        const callId = orchestrator.startToolExecution(taskId, tool);
        callIds.push(callId);
      }

      await new Promise(resolve => setTimeout(resolve, 20));

      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(fileTools.length);

      // Verify all are file tools
      for (const event of startEvents) {
        const toolName = (event.data as any).toolName;
        expect(fileTools).toContain(toolName);
        expect(TOOL_CONFIGS[toolName as SupportedTool].category).toBe('file');
      }

      // Clean up
      for (const callId of callIds) {
        orchestrator.completeToolExecution(taskId, callId);
      }
    });

    it('search tools emit start events correctly', async () => {
      const searchTools = SUPPORTED_TOOLS.filter(tool =>
        TOOL_CONFIGS[tool].category === 'search'
      );

      eventCapture.startCapturing(['tool:start']);

      const callIds: string[] = [];
      for (const tool of searchTools) {
        const callId = orchestrator.startToolExecution(taskId, tool);
        callIds.push(callId);
      }

      await new Promise(resolve => setTimeout(resolve, 20));

      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(searchTools.length);

      // Verify all are search tools
      for (const event of startEvents) {
        const toolName = (event.data as any).toolName;
        expect(searchTools).toContain(toolName);
        expect(TOOL_CONFIGS[toolName as SupportedTool].category).toBe('search');
      }

      // Clean up
      for (const callId of callIds) {
        orchestrator.completeToolExecution(taskId, callId);
      }
    });

    it('web tools emit start events correctly', async () => {
      const webTools = SUPPORTED_TOOLS.filter(tool =>
        TOOL_CONFIGS[tool].category === 'web'
      );

      eventCapture.startCapturing(['tool:start']);

      const callIds: string[] = [];
      for (const tool of webTools) {
        const callId = orchestrator.startToolExecution(taskId, tool);
        callIds.push(callId);
      }

      await new Promise(resolve => setTimeout(resolve, 20));

      const startEvents = eventCapture.getEventsByType('tool:start');
      expect(startEvents).toHaveLength(webTools.length);

      // Verify all are web tools
      for (const event of startEvents) {
        const toolName = (event.data as any).toolName;
        expect(webTools).toContain(toolName);
        expect(TOOL_CONFIGS[toolName as SupportedTool].category).toBe('web');
      }

      // Clean up
      for (const callId of callIds) {
        orchestrator.completeToolExecution(taskId, callId);
      }
    });
  });
});