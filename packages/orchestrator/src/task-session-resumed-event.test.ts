import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator, TaskSessionResumedEvent, OrchestratorEvents } from './index';
import { initializeApex } from '@apexcli/core';
import { TaskStatus, TaskSessionData } from '@apexcli/core';

describe('TaskSessionResumedEvent', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-session-resumed-test-'));

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'session-resumed-test',
      language: 'typescript',
      framework: 'node',
    });

    // Create a minimal test workflow
    const workflowContent = `
name: test
description: Test workflow for session resumed events
stages:
  - name: testing
    agent: tester
    description: Test stage
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'test.yaml'),
      workflowContent
    );

    // Create test agent
    const agentContent = `---
name: tester
description: Test agent
tools: Read
model: haiku
---
Test agent for session resumed events.
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'tester.md'),
      agentContent
    );

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  describe('TaskSessionResumedEvent interface', () => {
    it('should have all required fields', () => {
      const now = new Date();
      const sessionData: TaskSessionData = {
        lastCheckpoint: now,
        contextSummary: 'Test context',
        conversationHistory: [],
        stageState: {},
        resumePoint: {
          stage: 'testing',
          stepIndex: 0,
          metadata: {}
        }
      };

      const event: TaskSessionResumedEvent = {
        taskId: 'task_123',
        resumeReason: 'checkpoint_restore',
        contextSummary: 'Task was working on implementing feature X',
        previousStatus: 'paused',
        sessionData,
        timestamp: now
      };

      // Test that all required fields are present
      expect(event.taskId).toBe('task_123');
      expect(event.resumeReason).toBe('checkpoint_restore');
      expect(event.contextSummary).toBe('Task was working on implementing feature X');
      expect(event.previousStatus).toBe('paused');
      expect(event.sessionData).toBe(sessionData);
      expect(event.timestamp).toBe(now);
    });

    it('should support all valid resume reasons', () => {
      const validReasons = [
        'checkpoint_restore',
        'manual_resume',
        'auto_resume',
        'capacity_restored',
        'budget_reset',
        'mode_switch'
      ];

      validReasons.forEach(reason => {
        const event: TaskSessionResumedEvent = {
          taskId: 'task_test',
          resumeReason: reason,
          contextSummary: 'Test context',
          previousStatus: 'paused',
          sessionData: {
            lastCheckpoint: new Date(),
            contextSummary: 'Test',
            conversationHistory: [],
            stageState: {}
          },
          timestamp: new Date()
        };

        expect(event.resumeReason).toBe(reason);
      });
    });

    it('should support all valid previous statuses', () => {
      const validStatuses: TaskStatus[] = [
        'paused',
        'failed',
        'waiting-approval',
        'planning',
        'in-progress'
      ];

      validStatuses.forEach(status => {
        const event: TaskSessionResumedEvent = {
          taskId: 'task_test',
          resumeReason: 'manual_resume',
          contextSummary: 'Test context',
          previousStatus: status,
          sessionData: {
            lastCheckpoint: new Date(),
            contextSummary: 'Test',
            conversationHistory: [],
            stageState: {}
          },
          timestamp: new Date()
        };

        expect(event.previousStatus).toBe(status);
      });
    });

    it('should include comprehensive session data', () => {
      const now = new Date();
      const conversationHistory = [
        {
          type: 'user' as const,
          content: [{
            type: 'text' as const,
            text: 'Start implementing the feature'
          }]
        },
        {
          type: 'assistant' as const,
          content: [{
            type: 'text' as const,
            text: 'I will implement the feature step by step'
          }]
        }
      ];

      const sessionData: TaskSessionData = {
        lastCheckpoint: now,
        contextSummary: 'Working on feature implementation in planning stage',
        conversationHistory,
        stageState: {
          currentFile: 'src/feature.ts',
          linesProcessed: 45,
          errors: []
        },
        resumePoint: {
          stage: 'implementation',
          stepIndex: 2,
          metadata: {
            filesModified: ['src/feature.ts', 'src/types.ts'],
            testsCreated: ['tests/feature.test.ts']
          }
        }
      };

      const event: TaskSessionResumedEvent = {
        taskId: 'task_complex',
        resumeReason: 'checkpoint_restore',
        contextSummary: 'Task was implementing authentication feature when paused due to session limit',
        previousStatus: 'paused',
        sessionData,
        timestamp: now
      };

      expect(event.sessionData.lastCheckpoint).toBe(now);
      expect(event.sessionData.contextSummary).toBe('Working on feature implementation in planning stage');
      expect(event.sessionData.conversationHistory).toHaveLength(2);
      expect(event.sessionData.stageState?.currentFile).toBe('src/feature.ts');
      expect(event.sessionData.resumePoint?.stage).toBe('implementation');
      expect(event.sessionData.resumePoint?.stepIndex).toBe(2);
      expect(event.sessionData.resumePoint?.metadata?.filesModified).toHaveLength(2);
    });
  });

  describe('OrchestratorEvents type', () => {
    it('should include task:session-resumed event in type definition', () => {
      // Test that the type definition includes the new event
      const mockHandler = vi.fn();

      // This should type-check correctly if the event is properly defined
      orchestrator.on('task:session-resumed', mockHandler);

      // Test that the handler can receive the correct event type
      const event: TaskSessionResumedEvent = {
        taskId: 'task_123',
        resumeReason: 'auto_resume',
        contextSummary: 'Test context',
        previousStatus: 'paused',
        sessionData: {
          lastCheckpoint: new Date(),
          contextSummary: 'Test',
          conversationHistory: [],
          stageState: {}
        },
        timestamp: new Date()
      };

      // This should compile without type errors
      orchestrator.emit('task:session-resumed', event);

      expect(mockHandler).toHaveBeenCalledWith(event);
    });

    it('should maintain compatibility with existing event types', () => {
      // Test that other events still work
      const taskCreatedHandler = vi.fn();
      const usageHandler = vi.fn();

      orchestrator.on('task:created', taskCreatedHandler);
      orchestrator.on('usage:updated', usageHandler);

      // These should still work without issues
      expect(() => {
        orchestrator.off('task:created', taskCreatedHandler);
        orchestrator.off('usage:updated', usageHandler);
      }).not.toThrow();
    });
  });

  describe('ApexEventType union', () => {
    it('should include task:session-resumed in the ApexEventType union', () => {
      // Test that the event type is included in the union
      const eventType: import('@apexcli/core').ApexEventType = 'task:session-resumed';
      expect(eventType).toBe('task:session-resumed');
    });

    it('should maintain all existing event types', () => {
      const existingEventTypes: import('@apexcli/core').ApexEventType[] = [
        'task:created',
        'task:started',
        'task:stage-changed',
        'task:completed',
        'task:failed',
        'task:paused',
        'task:session-resumed', // Our new event
        'task:decomposed',
        'subtask:created',
        'subtask:completed',
        'subtask:failed',
        'agent:message',
        'agent:thinking',
        'agent:tool-use',
        'agent:tool-result',
        'gate:required',
        'gate:approved',
        'gate:rejected',
        'usage:updated',
        'log:entry'
      ];

      // This should compile without errors if all types are valid
      existingEventTypes.forEach(eventType => {
        expect(typeof eventType).toBe('string');
      });
    });
  });

  describe('Event emission scenarios', () => {
    it('should emit task:session-resumed event when resuming a paused task', async () => {
      // Create a task
      const task = await orchestrator.createTask({
        description: 'Test task for session resume',
        workflow: 'test'
      });

      // Manually pause the task and set session data
      await orchestrator.updateTaskStatus(task.id, 'paused', undefined, 'session_limit');

      // Save a checkpoint to simulate paused state
      const sessionData: TaskSessionData = {
        lastCheckpoint: new Date(),
        contextSummary: 'Task paused during testing stage',
        conversationHistory: [
          {
            type: 'user',
            content: [{
              type: 'text',
              text: 'Implement the test feature'
            }]
          }
        ],
        stageState: { testsPassed: 3, testsFailed: 1 },
        resumePoint: {
          stage: 'testing',
          stepIndex: 1,
          metadata: { currentTest: 'user-auth.test.ts' }
        }
      };

      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 0,
        conversationState: sessionData.conversationHistory,
        metadata: {
          sessionData,
          pauseReason: 'session_limit'
        }
      });

      // Set up event listener
      const sessionResumedHandler = vi.fn();
      orchestrator.on('task:session-resumed', sessionResumedHandler);

      // Resume the task
      const resumed = await orchestrator.resumeTask(task.id, {
        checkpointId,
        resumeReason: 'manual_resume'
      });

      expect(resumed).toBe(true);
      expect(sessionResumedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: task.id,
          resumeReason: 'manual_resume',
          previousStatus: 'paused',
          contextSummary: expect.any(String),
          sessionData: expect.objectContaining({
            lastCheckpoint: expect.any(Date),
            contextSummary: expect.any(String)
          }),
          timestamp: expect.any(Date)
        })
      );
    });

    it('should emit event with correct contextSummary for different scenarios', async () => {
      const testCases = [
        {
          pauseReason: 'session_limit',
          expectedContextPart: 'session limit'
        },
        {
          pauseReason: 'budget_exceeded',
          expectedContextPart: 'budget'
        },
        {
          pauseReason: 'manual',
          expectedContextPart: 'manually paused'
        }
      ];

      for (const testCase of testCases) {
        const task = await orchestrator.createTask({
          description: `Test task for ${testCase.pauseReason}`,
          workflow: 'test'
        });

        // Pause with specific reason
        await orchestrator.updateTaskStatus(task.id, 'paused', undefined, testCase.pauseReason);

        // Save checkpoint
        const checkpointId = await orchestrator.saveCheckpoint(task.id, {
          stage: 'testing',
          stageIndex: 0,
          metadata: { pauseReason: testCase.pauseReason }
        });

        const sessionResumedHandler = vi.fn();
        orchestrator.on('task:session-resumed', sessionResumedHandler);

        await orchestrator.resumeTask(task.id, { checkpointId });

        expect(sessionResumedHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            taskId: task.id,
            contextSummary: expect.stringContaining(testCase.expectedContextPart)
          })
        );

        orchestrator.off('task:session-resumed', sessionResumedHandler);
      }
    });

    it('should include accurate sessionData in the event', async () => {
      const task = await orchestrator.createTask({
        description: 'Task with rich session data',
        workflow: 'test'
      });

      const originalConversation = [
        {
          type: 'user' as const,
          content: [{ type: 'text' as const, text: 'Start the test implementation' }]
        },
        {
          type: 'assistant' as const,
          content: [{
            type: 'tool_use' as const,
            toolName: 'Read',
            toolInput: { file_path: 'src/test.ts' }
          }]
        },
        {
          type: 'user' as const,
          content: [{
            type: 'tool_result' as const,
            toolResult: 'const test = () => { /* implementation */ }'
          }]
        }
      ];

      const sessionData: TaskSessionData = {
        lastCheckpoint: new Date('2024-01-15T10:30:00Z'),
        contextSummary: 'Task was reading test file and planning implementation',
        conversationHistory: originalConversation,
        stageState: {
          filesRead: ['src/test.ts'],
          currentLine: 42,
          modifications: []
        },
        resumePoint: {
          stage: 'testing',
          stepIndex: 3,
          metadata: {
            operation: 'file_analysis',
            nextStep: 'write_tests'
          }
        }
      };

      await orchestrator.updateTaskStatus(task.id, 'paused', undefined, 'session_limit');

      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 3,
        conversationState: originalConversation,
        metadata: {
          sessionData,
          pauseReason: 'session_limit'
        }
      });

      const sessionResumedHandler = vi.fn();
      orchestrator.on('task:session-resumed', sessionResumedHandler);

      await orchestrator.resumeTask(task.id, { checkpointId });

      const emittedEvent = sessionResumedHandler.mock.calls[0][0] as TaskSessionResumedEvent;

      expect(emittedEvent.sessionData.lastCheckpoint).toEqual(new Date('2024-01-15T10:30:00Z'));
      expect(emittedEvent.sessionData.contextSummary).toBe('Task was reading test file and planning implementation');
      expect(emittedEvent.sessionData.conversationHistory).toHaveLength(3);
      expect(emittedEvent.sessionData.stageState?.filesRead).toEqual(['src/test.ts']);
      expect(emittedEvent.sessionData.resumePoint?.stage).toBe('testing');
      expect(emittedEvent.sessionData.resumePoint?.stepIndex).toBe(3);
      expect(emittedEvent.sessionData.resumePoint?.metadata?.operation).toBe('file_analysis');
    });

    it('should handle edge cases gracefully', async () => {
      const task = await orchestrator.createTask({
        description: 'Edge case task',
        workflow: 'test'
      });

      // Test with minimal session data
      const minimalSessionData: TaskSessionData = {
        lastCheckpoint: new Date(),
        contextSummary: undefined,
        conversationHistory: undefined,
        stageState: undefined,
        resumePoint: undefined
      };

      await orchestrator.updateTaskStatus(task.id, 'paused');

      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 0,
        metadata: {
          sessionData: minimalSessionData,
          pauseReason: 'manual'
        }
      });

      const sessionResumedHandler = vi.fn();
      orchestrator.on('task:session-resumed', sessionResumedHandler);

      await orchestrator.resumeTask(task.id, { checkpointId });

      expect(sessionResumedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: task.id,
          sessionData: expect.objectContaining({
            lastCheckpoint: expect.any(Date)
          }),
          contextSummary: expect.any(String) // Should generate a fallback
        })
      );
    });

    it('should not emit event when resuming fails', async () => {
      const sessionResumedHandler = vi.fn();
      orchestrator.on('task:session-resumed', sessionResumedHandler);

      // Try to resume non-existent task
      await expect(orchestrator.resumeTask('non-existent-task')).rejects.toThrow();

      expect(sessionResumedHandler).not.toHaveBeenCalled();
    });

    it('should emit event only once per successful resume', async () => {
      const task = await orchestrator.createTask({
        description: 'Single emission test',
        workflow: 'test'
      });

      await orchestrator.updateTaskStatus(task.id, 'paused');
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 0,
        metadata: { pauseReason: 'manual' }
      });

      const sessionResumedHandler = vi.fn();
      orchestrator.on('task:session-resumed', sessionResumedHandler);

      // Resume once
      await orchestrator.resumeTask(task.id, { checkpointId });

      // Verify single emission
      expect(sessionResumedHandler).toHaveBeenCalledTimes(1);

      // Try to resume again (should fail since task is no longer paused)
      const secondResume = await orchestrator.resumeTask(task.id, { checkpointId });
      expect(secondResume).toBe(false);

      // Still only one emission
      expect(sessionResumedHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integration with existing event system', () => {
    it('should work alongside other task events', async () => {
      const task = await orchestrator.createTask({
        description: 'Integration test task',
        workflow: 'test'
      });

      // Set up handlers for multiple events
      const taskCreatedHandler = vi.fn();
      const taskStartedHandler = vi.fn();
      const sessionResumedHandler = vi.fn();
      const usageUpdatedHandler = vi.fn();

      orchestrator.on('task:created', taskCreatedHandler);
      orchestrator.on('task:started', taskStartedHandler);
      orchestrator.on('task:session-resumed', sessionResumedHandler);
      orchestrator.on('usage:updated', usageUpdatedHandler);

      // Pause and resume task
      await orchestrator.updateTaskStatus(task.id, 'paused');
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 0
      });

      await orchestrator.resumeTask(task.id, { checkpointId });

      // Verify that our new event works alongside existing ones
      expect(taskCreatedHandler).toHaveBeenCalled(); // From createTask
      expect(sessionResumedHandler).toHaveBeenCalledTimes(1);

      // Test event isolation - handlers shouldn't cross-trigger
      const sessionResumedEvent = sessionResumedHandler.mock.calls[0][0];
      expect(sessionResumedEvent.taskId).toBe(task.id);
      expect(sessionResumedEvent.resumeReason).toBeDefined();
    });

    it('should maintain event order and timing', async () => {
      const task = await orchestrator.createTask({
        description: 'Event timing test',
        workflow: 'test'
      });

      const allEvents: { type: string; timestamp: Date; data: any }[] = [];

      // Capture all events with timestamps
      orchestrator.on('task:session-resumed', (event) => {
        allEvents.push({ type: 'task:session-resumed', timestamp: new Date(), data: event });
      });

      await orchestrator.updateTaskStatus(task.id, 'paused');
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 0
      });

      const resumeStartTime = new Date();
      await orchestrator.resumeTask(task.id, { checkpointId });
      const resumeEndTime = new Date();

      // Verify event timing
      expect(allEvents).toHaveLength(1);
      const sessionEvent = allEvents.find(e => e.type === 'task:session-resumed');
      expect(sessionEvent).toBeDefined();
      expect(sessionEvent!.timestamp.getTime()).toBeGreaterThanOrEqual(resumeStartTime.getTime());
      expect(sessionEvent!.timestamp.getTime()).toBeLessThanOrEqual(resumeEndTime.getTime());
    });
  });

  describe('Error handling and validation', () => {
    it('should handle malformed session data gracefully', async () => {
      const task = await orchestrator.createTask({
        description: 'Malformed data test',
        workflow: 'test'
      });

      await orchestrator.updateTaskStatus(task.id, 'paused');

      // Create checkpoint with potentially problematic data
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 0,
        metadata: {
          sessionData: {
            // Missing required lastCheckpoint field
            contextSummary: 'Test context',
            conversationHistory: [
              // Malformed conversation entry
              { type: 'unknown', content: null } as any
            ]
          }
        }
      });

      const sessionResumedHandler = vi.fn();
      orchestrator.on('task:session-resumed', sessionResumedHandler);

      // Should not throw, but should handle gracefully
      await orchestrator.resumeTask(task.id, { checkpointId });

      expect(sessionResumedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: task.id,
          sessionData: expect.any(Object)
        })
      );
    });

    it('should validate event data types', async () => {
      const task = await orchestrator.createTask({
        description: 'Type validation test',
        workflow: 'test'
      });

      await orchestrator.updateTaskStatus(task.id, 'paused');
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 0
      });

      const sessionResumedHandler = vi.fn();
      orchestrator.on('task:session-resumed', sessionResumedHandler);

      await orchestrator.resumeTask(task.id, { checkpointId });

      const emittedEvent = sessionResumedHandler.mock.calls[0][0];

      // Validate all required fields are correct types
      expect(typeof emittedEvent.taskId).toBe('string');
      expect(typeof emittedEvent.resumeReason).toBe('string');
      expect(typeof emittedEvent.contextSummary).toBe('string');
      expect(typeof emittedEvent.previousStatus).toBe('string');
      expect(typeof emittedEvent.sessionData).toBe('object');
      expect(emittedEvent.timestamp).toBeInstanceOf(Date);
    });

    it('should handle very large session data', async () => {
      const task = await orchestrator.createTask({
        description: 'Large data test',
        workflow: 'test'
      });

      // Create large conversation history
      const largeConversation = Array.from({ length: 1000 }, (_, i) => ({
        type: 'user' as const,
        content: [{
          type: 'text' as const,
          text: `Message ${i}: ${'x'.repeat(1000)}`
        }]
      }));

      const largeSessionData: TaskSessionData = {
        lastCheckpoint: new Date(),
        contextSummary: 'x'.repeat(10000), // Very long summary
        conversationHistory: largeConversation,
        stageState: {
          largeArray: Array.from({ length: 5000 }, (_, i) => ({ id: i, data: 'test'.repeat(100) }))
        },
        resumePoint: {
          stage: 'testing',
          stepIndex: 999,
          metadata: {
            processedItems: Array.from({ length: 2000 }, (_, i) => `item-${i}`)
          }
        }
      };

      await orchestrator.updateTaskStatus(task.id, 'paused');
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 0,
        conversationState: largeConversation,
        metadata: {
          sessionData: largeSessionData
        }
      });

      const sessionResumedHandler = vi.fn();
      orchestrator.on('task:session-resumed', sessionResumedHandler);

      // Should handle large data without issues
      await orchestrator.resumeTask(task.id, { checkpointId });

      expect(sessionResumedHandler).toHaveBeenCalledTimes(1);
      const emittedEvent = sessionResumedHandler.mock.calls[0][0];

      expect(emittedEvent.sessionData.conversationHistory).toHaveLength(1000);
      expect(emittedEvent.sessionData.contextSummary).toHaveLength(10000);
      expect(emittedEvent.sessionData.stageState?.largeArray).toHaveLength(5000);
    });
  });
});