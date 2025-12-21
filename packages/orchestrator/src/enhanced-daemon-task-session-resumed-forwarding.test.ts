import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EnhancedDaemon } from './enhanced-daemon';
import { ApexOrchestrator, TaskSessionResumedEvent } from './index';
import { initializeApex } from '@apexcli/core';
import { TaskStatus, TaskSessionData } from '@apexcli/core';

describe('EnhancedDaemon task:session-resumed Event Forwarding', () => {
  let testDir: string;
  let enhancedDaemon: EnhancedDaemon;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-enhanced-daemon-session-test-'));

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'enhanced-daemon-session-test',
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
description: Test agent for event forwarding
tools: Read
model: haiku
---
Test agent for task session resumed event forwarding.
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'tester.md'),
      agentContent
    );

    enhancedDaemon = new EnhancedDaemon(testDir, {
      version: '1.0',
      project: { name: 'enhanced-daemon-test' },
      daemon: {
        timeBasedUsage: { enabled: false },
        sessionRecovery: { enabled: true, autoResume: true },
        idleProcessing: { enabled: false },
        healthCheck: { enabled: false },
        watchdog: { enabled: false },
        installAsService: false,
      },
      limits: {
        maxTokensPerTask: 500000,
        maxCostPerTask: 10.0,
        maxConcurrentTasks: 3,
        dailyBudget: 100.0,
      },
    });

    // Get the orchestrator reference
    orchestrator = enhancedDaemon['orchestrator'];
    await enhancedDaemon.start();
  });

  afterEach(async () => {
    if (enhancedDaemon) {
      await enhancedDaemon.stop();
    }
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  describe('Event Forwarding Integration', () => {
    it('should forward task:session-resumed event from orchestrator to EnhancedDaemon listeners', async () => {
      const eventHandler = vi.fn();
      enhancedDaemon.on('task:session-resumed', eventHandler);

      // Create a test task to resume
      const task = await orchestrator.createTask({
        description: 'Test task for session resume forwarding',
        workflow: 'test'
      });

      // Pause the task and create checkpoint data
      await orchestrator.updateTaskStatus(task.id, 'paused', undefined, 'session_limit');

      const sessionData: TaskSessionData = {
        lastCheckpoint: new Date(),
        contextSummary: 'Task was implementing feature when session limit reached',
        conversationHistory: [
          {
            type: 'user',
            content: [{
              type: 'text',
              text: 'Start implementing the feature'
            }]
          }
        ],
        stageState: { progress: 0.3, currentFile: 'src/feature.ts' },
        resumePoint: {
          stage: 'testing',
          stepIndex: 2,
          metadata: { operation: 'implementation' }
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

      // Resume the task - this should trigger the event
      await orchestrator.resumeTask(task.id, {
        checkpointId,
        resumeReason: 'manual_resume'
      });

      // Verify the event was forwarded correctly
      expect(eventHandler).toHaveBeenCalledTimes(1);

      const forwardedEvent = eventHandler.mock.calls[0][0] as TaskSessionResumedEvent;
      expect(forwardedEvent).toEqual(
        expect.objectContaining({
          taskId: task.id,
          resumeReason: 'manual_resume',
          previousStatus: 'paused',
          contextSummary: expect.stringContaining('session limit'),
          sessionData: expect.objectContaining({
            lastCheckpoint: expect.any(Date),
            contextSummary: sessionData.contextSummary,
            conversationHistory: sessionData.conversationHistory,
            stageState: sessionData.stageState,
            resumePoint: sessionData.resumePoint
          }),
          timestamp: expect.any(Date)
        })
      );
    });

    it('should forward multiple task:session-resumed events correctly', async () => {
      const eventHandler = vi.fn();
      enhancedDaemon.on('task:session-resumed', eventHandler);

      // Create multiple tasks
      const task1 = await orchestrator.createTask({
        description: 'First test task',
        workflow: 'test'
      });

      const task2 = await orchestrator.createTask({
        description: 'Second test task',
        workflow: 'test'
      });

      // Pause both tasks
      await orchestrator.updateTaskStatus(task1.id, 'paused', undefined, 'manual');
      await orchestrator.updateTaskStatus(task2.id, 'paused', undefined, 'budget_exceeded');

      // Create checkpoints
      const checkpoint1 = await orchestrator.saveCheckpoint(task1.id, {
        stage: 'testing',
        stageIndex: 0,
        metadata: { pauseReason: 'manual' }
      });

      const checkpoint2 = await orchestrator.saveCheckpoint(task2.id, {
        stage: 'testing',
        stageIndex: 0,
        metadata: { pauseReason: 'budget_exceeded' }
      });

      // Resume both tasks
      await orchestrator.resumeTask(task1.id, { checkpointId: checkpoint1 });
      await orchestrator.resumeTask(task2.id, { checkpointId: checkpoint2 });

      // Should have received two events
      expect(eventHandler).toHaveBeenCalledTimes(2);

      // Check first event
      const firstEvent = eventHandler.mock.calls[0][0] as TaskSessionResumedEvent;
      expect(firstEvent.taskId).toBe(task1.id);
      expect(firstEvent.contextSummary).toContain('manually paused');

      // Check second event
      const secondEvent = eventHandler.mock.calls[1][0] as TaskSessionResumedEvent;
      expect(secondEvent.taskId).toBe(task2.id);
      expect(secondEvent.contextSummary).toContain('budget');
    });

    it('should maintain event integrity during forwarding', async () => {
      const eventHandler = vi.fn();
      enhancedDaemon.on('task:session-resumed', eventHandler);

      // Create task with rich session data
      const task = await orchestrator.createTask({
        description: 'Task with comprehensive session data',
        workflow: 'test'
      });

      const complexSessionData: TaskSessionData = {
        lastCheckpoint: new Date('2024-01-15T10:30:00Z'),
        contextSummary: 'Task was analyzing dependencies and preparing test suite',
        conversationHistory: [
          {
            type: 'user',
            content: [{ type: 'text', text: 'Analyze project dependencies' }]
          },
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Read',
              toolInput: { file_path: 'package.json' }
            }]
          },
          {
            type: 'user',
            content: [{
              type: 'tool_result',
              toolResult: '{"dependencies": {"react": "^18.0.0"}}'
            }]
          }
        ],
        stageState: {
          analyzedFiles: ['package.json', 'tsconfig.json'],
          dependencyCount: 15,
          vulnerabilities: [],
          progress: 0.65
        },
        resumePoint: {
          stage: 'testing',
          stepIndex: 4,
          metadata: {
            nextAction: 'dependency_vulnerability_scan',
            completedChecks: ['syntax', 'imports', 'types'],
            pendingChecks: ['security', 'performance']
          }
        }
      };

      await orchestrator.updateTaskStatus(task.id, 'paused', undefined, 'capacity_limit');

      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 4,
        conversationState: complexSessionData.conversationHistory,
        metadata: {
          sessionData: complexSessionData,
          pauseReason: 'capacity_limit'
        }
      });

      // Resume task
      await orchestrator.resumeTask(task.id, {
        checkpointId,
        resumeReason: 'capacity_restored'
      });

      expect(eventHandler).toHaveBeenCalledTimes(1);

      const forwardedEvent = eventHandler.mock.calls[0][0] as TaskSessionResumedEvent;

      // Verify all data is preserved during forwarding
      expect(forwardedEvent.sessionData.lastCheckpoint).toEqual(new Date('2024-01-15T10:30:00Z'));
      expect(forwardedEvent.sessionData.contextSummary).toBe('Task was analyzing dependencies and preparing test suite');
      expect(forwardedEvent.sessionData.conversationHistory).toHaveLength(3);
      expect(forwardedEvent.sessionData.stageState?.analyzedFiles).toEqual(['package.json', 'tsconfig.json']);
      expect(forwardedEvent.sessionData.stageState?.progress).toBe(0.65);
      expect(forwardedEvent.sessionData.resumePoint?.stepIndex).toBe(4);
      expect(forwardedEvent.sessionData.resumePoint?.metadata?.nextAction).toBe('dependency_vulnerability_scan');
      expect(forwardedEvent.sessionData.resumePoint?.metadata?.completedChecks).toHaveLength(3);
    });
  });

  describe('Event Handler Registration', () => {
    it('should allow multiple listeners for task:session-resumed event', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      enhancedDaemon.on('task:session-resumed', handler1);
      enhancedDaemon.on('task:session-resumed', handler2);
      enhancedDaemon.on('task:session-resumed', handler3);

      // Trigger an event
      const task = await orchestrator.createTask({
        description: 'Multi-listener test task',
        workflow: 'test'
      });

      await orchestrator.updateTaskStatus(task.id, 'paused');
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 0
      });

      await orchestrator.resumeTask(task.id, { checkpointId });

      // All handlers should be called
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);

      // All should receive the same event
      const event1 = handler1.mock.calls[0][0];
      const event2 = handler2.mock.calls[0][0];
      const event3 = handler3.mock.calls[0][0];

      expect(event1).toEqual(event2);
      expect(event2).toEqual(event3);
    });

    it('should support event handler removal', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      enhancedDaemon.on('task:session-resumed', handler1);
      enhancedDaemon.on('task:session-resumed', handler2);

      // Remove handler1
      enhancedDaemon.off('task:session-resumed', handler1);

      // Trigger an event
      const task = await orchestrator.createTask({
        description: 'Handler removal test task',
        workflow: 'test'
      });

      await orchestrator.updateTaskStatus(task.id, 'paused');
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 0
      });

      await orchestrator.resumeTask(task.id, { checkpointId });

      // Only handler2 should be called
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integration with Other EnhancedDaemon Events', () => {
    it('should work alongside other daemon events', async () => {
      const sessionResumedHandler = vi.fn();
      const daemonStartedHandler = vi.fn();
      const daemonStoppedHandler = vi.fn();

      enhancedDaemon.on('task:session-resumed', sessionResumedHandler);
      enhancedDaemon.on('daemon:started', daemonStartedHandler);
      enhancedDaemon.on('daemon:stopped', daemonStoppedHandler);

      // daemonStartedHandler should already be called from beforeEach setup
      expect(daemonStartedHandler).toHaveBeenCalled();

      // Trigger session resumed event
      const task = await orchestrator.createTask({
        description: 'Multi-event test task',
        workflow: 'test'
      });

      await orchestrator.updateTaskStatus(task.id, 'paused');
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 0
      });

      await orchestrator.resumeTask(task.id, { checkpointId });

      expect(sessionResumedHandler).toHaveBeenCalledTimes(1);

      // Stop daemon to trigger stopped event
      await enhancedDaemon.stop();
      expect(daemonStoppedHandler).toHaveBeenCalled();

      // Events should remain independent
      expect(sessionResumedHandler).toHaveBeenCalledTimes(1); // Still only once
    });

    it('should maintain event isolation - handlers should not cross-trigger', async () => {
      const sessionResumedHandler = vi.fn();
      const capacityRestoredHandler = vi.fn();
      const tasksAutoResumedHandler = vi.fn();

      enhancedDaemon.on('task:session-resumed', sessionResumedHandler);
      enhancedDaemon.on('capacity:restored', capacityRestoredHandler);
      enhancedDaemon.on('tasks:auto-resumed', tasksAutoResumedHandler);

      // Trigger only session resumed
      const task = await orchestrator.createTask({
        description: 'Event isolation test task',
        workflow: 'test'
      });

      await orchestrator.updateTaskStatus(task.id, 'paused');
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 0
      });

      await orchestrator.resumeTask(task.id, { checkpointId });

      // Only the session resumed handler should be triggered
      expect(sessionResumedHandler).toHaveBeenCalledTimes(1);
      expect(capacityRestoredHandler).not.toHaveBeenCalled();
      expect(tasksAutoResumedHandler).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle event forwarding when handler throws error', async () => {
      const throwingHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const safeHandler = vi.fn();

      enhancedDaemon.on('task:session-resumed', throwingHandler);
      enhancedDaemon.on('task:session-resumed', safeHandler);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Trigger event
      const task = await orchestrator.createTask({
        description: 'Error handling test task',
        workflow: 'test'
      });

      await orchestrator.updateTaskStatus(task.id, 'paused');
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 0
      });

      await orchestrator.resumeTask(task.id, { checkpointId });

      // Both handlers should be called despite the error
      expect(throwingHandler).toHaveBeenCalledTimes(1);
      expect(safeHandler).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });

    it('should handle event forwarding with minimal session data', async () => {
      const eventHandler = vi.fn();
      enhancedDaemon.on('task:session-resumed', eventHandler);

      const task = await orchestrator.createTask({
        description: 'Minimal data test task',
        workflow: 'test'
      });

      // Create checkpoint with minimal session data
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

      await orchestrator.resumeTask(task.id, { checkpointId });

      expect(eventHandler).toHaveBeenCalledTimes(1);

      const forwardedEvent = eventHandler.mock.calls[0][0] as TaskSessionResumedEvent;
      expect(forwardedEvent.taskId).toBe(task.id);
      expect(forwardedEvent.sessionData.lastCheckpoint).toBeInstanceOf(Date);
      // Should generate a fallback contextSummary
      expect(typeof forwardedEvent.contextSummary).toBe('string');
      expect(forwardedEvent.contextSummary.length).toBeGreaterThan(0);
    });

    it('should not forward events when orchestrator event fails', async () => {
      const eventHandler = vi.fn();
      enhancedDaemon.on('task:session-resumed', eventHandler);

      // Try to resume non-existent task - should not emit event
      await expect(orchestrator.resumeTask('non-existent-task')).rejects.toThrow();

      expect(eventHandler).not.toHaveBeenCalled();
    });

    it('should handle rapid successive task resumes', async () => {
      const eventHandler = vi.fn();
      enhancedDaemon.on('task:session-resumed', eventHandler);

      // Create multiple tasks and resume them in quick succession
      const tasks = [];
      const checkpoints = [];

      for (let i = 0; i < 5; i++) {
        const task = await orchestrator.createTask({
          description: `Rapid resume test task ${i}`,
          workflow: 'test'
        });
        tasks.push(task);

        await orchestrator.updateTaskStatus(task.id, 'paused');
        const checkpoint = await orchestrator.saveCheckpoint(task.id, {
          stage: 'testing',
          stageIndex: 0
        });
        checkpoints.push(checkpoint);
      }

      // Resume all tasks rapidly
      const resumePromises = tasks.map((task, i) =>
        orchestrator.resumeTask(task.id, { checkpointId: checkpoints[i] })
      );

      await Promise.all(resumePromises);

      // Should have received exactly 5 events
      expect(eventHandler).toHaveBeenCalledTimes(5);

      // Each event should have correct task ID
      const taskIds = eventHandler.mock.calls.map(call => call[0].taskId);
      expect(taskIds).toHaveLength(5);
      expect(new Set(taskIds)).toHaveSize(5); // All unique
    });
  });

  describe('Event Timing and Order', () => {
    it('should emit events in correct order for sequential task resumes', async () => {
      const eventLog: Array<{ type: string; taskId: string; timestamp: number }> = [];

      enhancedDaemon.on('task:session-resumed', (event) => {
        eventLog.push({
          type: 'task:session-resumed',
          taskId: event.taskId,
          timestamp: Date.now()
        });
      });

      // Create and resume tasks sequentially
      for (let i = 0; i < 3; i++) {
        const task = await orchestrator.createTask({
          description: `Sequential test task ${i}`,
          workflow: 'test'
        });

        await orchestrator.updateTaskStatus(task.id, 'paused');
        const checkpoint = await orchestrator.saveCheckpoint(task.id, {
          stage: 'testing',
          stageIndex: 0
        });

        await orchestrator.resumeTask(task.id, { checkpointId: checkpoint });

        // Small delay to ensure timing separation
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      expect(eventLog).toHaveLength(3);

      // Events should be in chronological order
      for (let i = 1; i < eventLog.length; i++) {
        expect(eventLog[i].timestamp).toBeGreaterThanOrEqual(eventLog[i - 1].timestamp);
      }
    });

    it('should maintain event timestamps accuracy', async () => {
      const eventHandler = vi.fn();
      enhancedDaemon.on('task:session-resumed', eventHandler);

      const task = await orchestrator.createTask({
        description: 'Timestamp accuracy test task',
        workflow: 'test'
      });

      await orchestrator.updateTaskStatus(task.id, 'paused');
      const checkpoint = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 0
      });

      const beforeResume = Date.now();
      await orchestrator.resumeTask(task.id, { checkpointId: checkpoint });
      const afterResume = Date.now();

      expect(eventHandler).toHaveBeenCalledTimes(1);

      const event = eventHandler.mock.calls[0][0] as TaskSessionResumedEvent;
      const eventTimestamp = event.timestamp.getTime();

      // Event timestamp should be within the resume operation timeframe
      expect(eventTimestamp).toBeGreaterThanOrEqual(beforeResume);
      expect(eventTimestamp).toBeLessThanOrEqual(afterResume);
    });
  });
});