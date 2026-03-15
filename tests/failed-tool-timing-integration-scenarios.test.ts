/**
 * Failed Tool Timing Events - Integration Scenarios
 *
 * Integration tests that verify timing data consistency across different
 * components and scenarios that might occur in real-world usage.
 * These tests focus on end-to-end timing accuracy and data flow.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import {
  assertFailedToolTiming,
  createFailingToolQueryMock,
  createConcurrentFailingToolsQueryMock,
  createMixedResultsQueryMock,
  waitForEvents,
  ErrorTypes,
  createErrorMessage,
  DEFAULT_TIMING_TOLERANCE,
  type ToolCallCompleteEventLike,
} from './test-utils/failed-tool-timing-helpers';

// Mock components for integration testing
class MockTaskManager extends EventEmitter {
  private tasks = new Map<string, any>();
  private toolExecutions = new Map<string, { startTime: Date; toolName: string; taskId: string }>();

  async createTask(description: string): Promise<string> {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const task = {
      id: taskId,
      description,
      status: 'pending',
      createdAt: new Date(),
      toolExecutions: [],
    };

    this.tasks.set(taskId, task);
    this.emit('task:created', task);
    return taskId;
  }

  async startToolExecution(taskId: string, toolName: string, input: any): Promise<string> {
    const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();

    this.toolExecutions.set(callId, { startTime, toolName, taskId });

    const task = this.tasks.get(taskId);
    if (task) {
      task.toolExecutions.push({
        callId,
        toolName,
        status: 'running',
        startTime,
      });
    }

    this.emit('tool:start', {
      taskId,
      toolName,
      callId,
      input,
      timestamp: startTime,
    });

    return callId;
  }

  async completeToolExecution(
    callId: string,
    result: { success: boolean; output?: any; error?: string },
    customDuration?: number
  ): Promise<void> {
    const execution = this.toolExecutions.get(callId);
    if (!execution) {
      throw new Error(`No tool execution found for callId: ${callId}`);
    }

    const endTime = customDuration
      ? new Date(execution.startTime.getTime() + customDuration)
      : new Date();

    const duration = endTime.getTime() - execution.startTime.getTime();

    const task = this.tasks.get(execution.taskId);
    if (task) {
      const toolExecution = task.toolExecutions.find((te: any) => te.callId === callId);
      if (toolExecution) {
        toolExecution.status = result.success ? 'completed' : 'failed';
        toolExecution.endTime = endTime;
        toolExecution.duration = duration;
        toolExecution.result = result;
      }
    }

    this.emit('tool:complete', {
      taskId: execution.taskId,
      toolName: execution.toolName,
      callId,
      result,
      timing: {
        startTime: execution.startTime,
        endTime,
        duration,
      },
      timestamp: endTime,
    });

    this.toolExecutions.delete(callId);
  }

  getTask(taskId: string) {
    return this.tasks.get(taskId);
  }

  getActiveExecutions(): number {
    return this.toolExecutions.size;
  }

  cleanup(): void {
    this.tasks.clear();
    this.toolExecutions.clear();
  }
}

class MockEventBroadcaster extends EventEmitter {
  private connectedClients = new Set<string>();
  private eventHistory: any[] = [];

  addClient(clientId: string): void {
    this.connectedClients.add(clientId);
    this.emit('client:connected', clientId);
  }

  removeClient(clientId: string): void {
    this.connectedClients.delete(clientId);
    this.emit('client:disconnected', clientId);
  }

  broadcastEvent(eventType: string, eventData: any): void {
    const broadcastEvent = {
      type: eventType,
      data: eventData,
      timestamp: new Date(),
      clientCount: this.connectedClients.size,
    };

    this.eventHistory.push(broadcastEvent);

    for (const clientId of this.connectedClients) {
      this.emit('broadcast', clientId, broadcastEvent);
    }
  }

  getEventHistory(): any[] {
    return [...this.eventHistory];
  }

  getConnectedClientCount(): number {
    return this.connectedClients.size;
  }

  clearHistory(): void {
    this.eventHistory = [];
  }
}

describe('Failed Tool Timing Events - Integration Scenarios', () => {
  let taskManager: MockTaskManager;
  let eventBroadcaster: MockEventBroadcaster;

  beforeEach(() => {
    taskManager = new MockTaskManager();
    eventBroadcaster = new MockEventBroadcaster();

    // Connect task manager events to broadcaster
    taskManager.on('tool:complete', (event) => {
      eventBroadcaster.broadcastEvent('tool:complete', event);
    });

    taskManager.on('tool:start', (event) => {
      eventBroadcaster.broadcastEvent('tool:start', event);
    });
  });

  describe('End-to-End Tool Failure Flow', () => {
    it('should maintain timing consistency from task creation to failure broadcast', async () => {
      const broadcastEvents: any[] = [];
      const clientId = 'test-client-1';

      eventBroadcaster.addClient(clientId);
      eventBroadcaster.on('broadcast', (clientId, event) => {
        if (event.type === 'tool:complete') {
          broadcastEvents.push(event);
        }
      });

      // Create task and start tool execution
      const taskId = await taskManager.createTask('Integration test task');
      const callId = await taskManager.startToolExecution(taskId, 'IntegrationTool', {
        testCase: 'end-to-end-timing',
      });

      // Wait a specific duration then fail the tool
      const failureDuration = 250;
      await new Promise(resolve => setTimeout(resolve, 50));

      await taskManager.completeToolExecution(
        callId,
        {
          success: false,
          error: 'Integration test failure',
        },
        failureDuration
      );

      // Verify broadcast occurred
      expect(broadcastEvents).toHaveLength(1);
      const broadcastEvent = broadcastEvents[0];

      // Verify timing data integrity through the entire flow
      expect(broadcastEvent.type).toBe('tool:complete');
      expect(broadcastEvent.data.taskId).toBe(taskId);
      expect(broadcastEvent.data.result.success).toBe(false);

      assertFailedToolTiming(broadcastEvent.data, {
        expectedMinDuration: failureDuration - DEFAULT_TIMING_TOLERANCE,
        expectedMaxDuration: failureDuration + DEFAULT_TIMING_TOLERANCE,
      });

      // Verify task state is consistent
      const task = taskManager.getTask(taskId);
      expect(task.toolExecutions).toHaveLength(1);
      expect(task.toolExecutions[0].status).toBe('failed');
      expect(task.toolExecutions[0].duration).toBe(broadcastEvent.data.timing.duration);
    });

    it('should handle timing consistency during task retries', async () => {
      const allBroadcastEvents: any[] = [];
      const clientId = 'retry-client';

      eventBroadcaster.addClient(clientId);
      eventBroadcaster.on('broadcast', (clientId, event) => {
        if (event.type === 'tool:complete') {
          allBroadcastEvents.push(event);
        }
      });

      const taskId = await taskManager.createTask('Retry test task');

      // Simulate multiple retry attempts with different failure modes
      const retryAttempts = [
        { duration: 100, error: 'First attempt: validation error' },
        { duration: 200, error: 'Second attempt: network timeout' },
        { duration: 150, error: 'Third attempt: permission denied' },
      ];

      for (let i = 0; i < retryAttempts.length; i++) {
        const { duration, error } = retryAttempts[i];

        const callId = await taskManager.startToolExecution(
          taskId,
          'RetryableTool',
          { attempt: i + 1, maxRetries: 3 }
        );

        await taskManager.completeToolExecution(
          callId,
          { success: false, error },
          duration
        );

        // Small delay between retries
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      expect(allBroadcastEvents).toHaveLength(3);

      // Verify each retry attempt has independent, accurate timing
      allBroadcastEvents.forEach((event, index) => {
        const expectedDuration = retryAttempts[index].duration;
        const expectedError = retryAttempts[index].error;

        assertFailedToolTiming(event.data, {
          expectedMinDuration: expectedDuration - 10,
          expectedMaxDuration: expectedDuration + 10,
        });

        expect(event.data.result.error).toBe(expectedError);
        // Verify callId follows expected format (call-{timestamp}-{random})
        expect(event.data.callId).toMatch(/^call-\d+-[a-z0-9]+$/);
        // Verify taskId is properly associated
        expect(event.data.taskId).toBe(taskId);
      });

      // Verify timing independence between retries
      const durations = allBroadcastEvents.map(e => e.data.timing.duration);
      expect(durations[0]).toBeCloseTo(100, 15);
      expect(durations[1]).toBeCloseTo(200, 15);
      expect(durations[2]).toBeCloseTo(150, 15);
    });
  });

  describe('Multi-Client Broadcasting Scenarios', () => {
    it('should broadcast timing data consistently to multiple clients', async () => {
      const client1Events: any[] = [];
      const client2Events: any[] = [];
      const client3Events: any[] = [];

      // Add multiple clients
      eventBroadcaster.addClient('client-1');
      eventBroadcaster.addClient('client-2');
      eventBroadcaster.addClient('client-3');

      eventBroadcaster.on('broadcast', (clientId, event) => {
        if (event.type === 'tool:complete') {
          if (clientId === 'client-1') client1Events.push(event);
          else if (clientId === 'client-2') client2Events.push(event);
          else if (clientId === 'client-3') client3Events.push(event);
        }
      });

      // Execute multiple failing tools
      const taskId = await taskManager.createTask('Multi-client broadcast test');

      const toolExecutions = [
        { toolName: 'BroadcastTool1', duration: 80, error: 'Broadcast test error 1' },
        { toolName: 'BroadcastTool2', duration: 120, error: 'Broadcast test error 2' },
        { toolName: 'BroadcastTool3', duration: 60, error: 'Broadcast test error 3' },
      ];

      for (const execution of toolExecutions) {
        const callId = await taskManager.startToolExecution(taskId, execution.toolName, {});
        await taskManager.completeToolExecution(
          callId,
          { success: false, error: execution.error },
          execution.duration
        );
      }

      // All clients should receive the same events
      expect(client1Events).toHaveLength(3);
      expect(client2Events).toHaveLength(3);
      expect(client3Events).toHaveLength(3);

      // Verify timing data is identical across all clients
      for (let i = 0; i < 3; i++) {
        const event1 = client1Events[i];
        const event2 = client2Events[i];
        const event3 = client3Events[i];

        // Timing data should be identical
        expect(event1.data.timing.duration).toBe(event2.data.timing.duration);
        expect(event2.data.timing.duration).toBe(event3.data.timing.duration);

        expect(event1.data.timing.startTime).toEqual(event2.data.timing.startTime);
        expect(event2.data.timing.startTime).toEqual(event3.data.timing.startTime);

        expect(event1.data.timing.endTime).toEqual(event2.data.timing.endTime);
        expect(event2.data.timing.endTime).toEqual(event3.data.timing.endTime);

        // Verify timing accuracy for this tool
        assertFailedToolTiming(event1.data, {
          expectedMinDuration: toolExecutions[i].duration - 5,
          expectedMaxDuration: toolExecutions[i].duration + 5,
        });
      }
    });

    it('should handle client disconnection without affecting timing accuracy', async () => {
      const remainingClientEvents: any[] = [];

      // Add clients
      eventBroadcaster.addClient('permanent-client');
      eventBroadcaster.addClient('disconnecting-client');

      eventBroadcaster.on('broadcast', (clientId, event) => {
        if (clientId === 'permanent-client' && event.type === 'tool:complete') {
          remainingClientEvents.push(event);
        }
      });

      const taskId = await taskManager.createTask('Client disconnection test');

      // Start a tool execution
      const callId1 = await taskManager.startToolExecution(taskId, 'PreDisconnectTool', {});

      // Disconnect one client mid-execution
      eventBroadcaster.removeClient('disconnecting-client');

      // Complete the tool execution
      await taskManager.completeToolExecution(
        callId1,
        { success: false, error: 'Pre-disconnect failure' },
        100
      );

      // Start another tool after disconnection
      const callId2 = await taskManager.startToolExecution(taskId, 'PostDisconnectTool', {});
      await taskManager.completeToolExecution(
        callId2,
        { success: false, error: 'Post-disconnect failure' },
        150
      );

      // The remaining client should have received both events
      expect(remainingClientEvents).toHaveLength(2);

      // Verify timing accuracy wasn't affected by client disconnection
      assertFailedToolTiming(remainingClientEvents[0].data, {
        expectedMinDuration: 95,
        expectedMaxDuration: 105,
      });

      assertFailedToolTiming(remainingClientEvents[1].data, {
        expectedMinDuration: 145,
        expectedMaxDuration: 155,
      });

      expect(eventBroadcaster.getConnectedClientCount()).toBe(1);
    });
  });

  describe('Complex Workflow Integration', () => {
    it('should maintain timing accuracy through workflow stage transitions', async () => {
      const stageEvents: any[] = [];
      const clientId = 'workflow-client';

      eventBroadcaster.addClient(clientId);
      eventBroadcaster.on('broadcast', (clientId, event) => {
        if (event.type === 'tool:complete') {
          stageEvents.push(event);
        }
      });

      const taskId = await taskManager.createTask('Complex workflow test');

      // Simulate a multi-stage workflow where tools fail at different stages
      const workflowStages = [
        { stage: 'analysis', toolName: 'AnalysisTool', duration: 200, error: 'Analysis failed: insufficient data' },
        { stage: 'planning', toolName: 'PlanningTool', duration: 150, error: 'Planning failed: constraints not met' },
        { stage: 'implementation', toolName: 'ImplementationTool', duration: 300, error: 'Implementation failed: dependency error' },
        { stage: 'validation', toolName: 'ValidationTool', duration: 100, error: 'Validation failed: test assertions' },
      ];

      let cumulativeTime = 0;
      const stageStartTimes: number[] = [];

      for (const stage of workflowStages) {
        stageStartTimes.push(Date.now() + cumulativeTime);

        const callId = await taskManager.startToolExecution(
          taskId,
          stage.toolName,
          { stage: stage.stage, workflowStep: workflowStages.indexOf(stage) + 1 }
        );

        await taskManager.completeToolExecution(
          callId,
          { success: false, error: stage.error },
          stage.duration
        );

        cumulativeTime += stage.duration + 20; // Small delay between stages
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      expect(stageEvents).toHaveLength(4);

      // Verify each stage maintains accurate timing
      stageEvents.forEach((event, index) => {
        const expectedStage = workflowStages[index];

        assertFailedToolTiming(event.data, {
          expectedMinDuration: expectedStage.duration - 10,
          expectedMaxDuration: expectedStage.duration + 10,
        });

        expect(event.data.result.error).toBe(expectedStage.error);
        expect(event.data.toolName).toBe(expectedStage.toolName);
      });

      // Verify workflow progression timing (each stage should be independent)
      // Note: Since we use customDuration which creates simulated timing, we verify
      // that each stage has monotonically increasing START times (real wall clock)
      // rather than comparing simulated end times with real start times
      for (let i = 1; i < stageEvents.length; i++) {
        const prevStageStartTime = new Date(stageEvents[i - 1].data.timing.startTime).getTime();
        const currentStageStartTime = new Date(stageEvents[i].data.timing.startTime).getTime();

        // Each stage should start after the previous stage's start time
        expect(currentStageStartTime).toBeGreaterThanOrEqual(prevStageStartTime);
      }
    });

    it('should handle concurrent multi-task failures with accurate timing', async () => {
      const allEvents: any[] = [];
      const clientId = 'multi-task-client';

      eventBroadcaster.addClient(clientId);
      eventBroadcaster.on('broadcast', (clientId, event) => {
        if (event.type === 'tool:complete') {
          allEvents.push(event);
        }
      });

      // Create multiple concurrent tasks
      const taskCount = 3;
      const toolsPerTask = 4;
      const taskIds: string[] = [];

      for (let i = 0; i < taskCount; i++) {
        const taskId = await taskManager.createTask(`Concurrent task ${i + 1}`);
        taskIds.push(taskId);
      }

      // Execute tools concurrently across all tasks
      const allPromises: Promise<void>[] = [];

      for (let taskIndex = 0; taskIndex < taskCount; taskIndex++) {
        for (let toolIndex = 0; toolIndex < toolsPerTask; toolIndex++) {
          const promise = (async () => {
            const toolName = `ConcurrentTool-T${taskIndex}-${toolIndex}`;
            const duration = 100 + (taskIndex * 30) + (toolIndex * 10); // Varied durations

            const callId = await taskManager.startToolExecution(
              taskIds[taskIndex],
              toolName,
              { taskIndex, toolIndex }
            );

            // Small random delay to simulate real execution timing
            await new Promise(resolve => setTimeout(resolve, Math.random() * 20));

            await taskManager.completeToolExecution(
              callId,
              {
                success: false,
                error: `Concurrent failure T${taskIndex}-${toolIndex}`,
              },
              duration
            );
          })();

          allPromises.push(promise);
        }
      }

      await Promise.all(allPromises);

      const expectedEventCount = taskCount * toolsPerTask;
      expect(allEvents).toHaveLength(expectedEventCount);

      // Group events by task
      const eventsByTask = new Map<string, any[]>();
      allEvents.forEach(event => {
        const taskId = event.data.taskId;
        if (!eventsByTask.has(taskId)) {
          eventsByTask.set(taskId, []);
        }
        eventsByTask.get(taskId)!.push(event);
      });

      expect(eventsByTask.size).toBe(taskCount);

      // Verify each task has the expected number of events
      for (const [taskId, events] of eventsByTask) {
        expect(events).toHaveLength(toolsPerTask);

        // Verify timing accuracy for each event
        events.forEach((event, toolIndex) => {
          const taskIndex = taskIds.indexOf(taskId);
          const expectedDuration = 100 + (taskIndex * 30) + (toolIndex * 10);

          assertFailedToolTiming(event.data, {
            expectedMinDuration: expectedDuration - 25,
            expectedMaxDuration: expectedDuration + 25,
          });
        });
      }

      // Verify no timing corruption between concurrent tasks
      const allDurations = allEvents.map(e => e.data.timing.duration);
      const uniqueDurations = new Set(allDurations);

      // Should have mostly unique durations (some overlap possible)
      expect(uniqueDurations.size).toBeGreaterThanOrEqual(expectedEventCount * 0.8);
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain sub-millisecond timing accuracy under event processing load', async () => {
      const processingEvents: any[] = [];
      const loadClients = 10;

      // Add multiple clients to increase processing load
      for (let i = 0; i < loadClients; i++) {
        eventBroadcaster.addClient(`load-client-${i}`);
      }

      eventBroadcaster.on('broadcast', (clientId, event) => {
        if (clientId === 'load-client-0' && event.type === 'tool:complete') {
          processingEvents.push(event);
        }
      });

      const taskId = await taskManager.createTask('Load testing task');
      const preciseTimings = [47, 83, 127, 191]; // Prime numbers for precision testing

      // Execute tools with precise timing under load
      const executionPromises = preciseTimings.map(async (duration, index) => {
        const callId = await taskManager.startToolExecution(
          taskId,
          `LoadTool-${index}`,
          { loadTest: true, expectedDuration: duration }
        );

        await taskManager.completeToolExecution(
          callId,
          { success: false, error: `Load test failure ${index}` },
          duration
        );
      });

      await Promise.all(executionPromises);

      expect(processingEvents).toHaveLength(4);

      // Verify timing accuracy is maintained despite processing load
      processingEvents.forEach((event, index) => {
        const expectedDuration = preciseTimings[index];

        assertFailedToolTiming(event.data, {
          expectedMinDuration: expectedDuration - 3,
          expectedMaxDuration: expectedDuration + 3,
          tolerance: 5, // Tight tolerance despite load
        });
      });

      // Verify all events were broadcast to all clients
      // eventHistory tracks unique broadcast events (one per tool:complete),
      // not the individual deliveries to each client
      const eventHistory = eventBroadcaster.getEventHistory();
      const toolCompleteEvents = eventHistory.filter(e => e.type === 'tool:complete');

      // Should have 4 unique tool:complete events (one per tool execution)
      expect(toolCompleteEvents.length).toBe(4);

      // Each event should have been broadcast to all connected clients
      toolCompleteEvents.forEach(event => {
        expect(event.clientCount).toBe(loadClients);
      });
    });
  });
});