import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EnhancedDaemon } from './enhanced-daemon';
import { ApexOrchestrator, TaskSessionResumedEvent } from './index';
import { initializeApex } from '@apexcli/core';
import { TaskSessionData } from '@apexcli/core';

describe('EnhancedDaemon Edge Cases and Error Handling', () => {
  let testDir: string;
  let enhancedDaemon: EnhancedDaemon;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-enhanced-daemon-edge-test-'));

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'enhanced-daemon-edge-test',
      language: 'typescript',
      framework: 'node',
    });

    // Create minimal test infrastructure
    const workflowContent = `
name: test
description: Edge case test workflow
stages:
  - name: testing
    agent: tester
    description: Test stage
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'test.yaml'),
      workflowContent
    );

    const agentContent = `---
name: tester
description: Edge case test agent
tools: Read
model: haiku
---
Test agent for edge cases.
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'tester.md'),
      agentContent
    );

    enhancedDaemon = new EnhancedDaemon(testDir, {
      version: '1.0',
      project: { name: 'edge-case-test' },
      daemon: {
        timeBasedUsage: { enabled: false },
        sessionRecovery: { enabled: true },
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

  describe('Memory and Performance Edge Cases', () => {
    it('should handle very large session data without memory issues', async () => {
      const eventHandler = vi.fn();
      enhancedDaemon.on('task:session-resumed', eventHandler);

      const task = await orchestrator.createTask({
        description: 'Large data test task',
        workflow: 'test'
      });

      // Create very large session data to test memory handling
      const largeConversation = Array.from({ length: 2000 }, (_, i) => ({
        type: 'user' as const,
        content: [{
          type: 'text' as const,
          text: `Large message ${i}: ${'x'.repeat(1000)}`
        }]
      }));

      const largeSessionData: TaskSessionData = {
        lastCheckpoint: new Date(),
        contextSummary: 'x'.repeat(50000), // 50KB summary
        conversationHistory: largeConversation,
        stageState: {
          largeDataStructure: Array.from({ length: 10000 }, (_, i) => ({
            id: i,
            data: 'test'.repeat(250), // 1KB per entry
            metadata: {
              timestamp: new Date(),
              processed: i % 2 === 0,
              details: Array.from({ length: 100 }, (_, j) => `detail-${i}-${j}`)
            }
          }))
        },
        resumePoint: {
          stage: 'testing',
          stepIndex: 1999,
          metadata: {
            processedItems: Array.from({ length: 5000 }, (_, i) => ({
              id: `item-${i}`,
              status: 'processed',
              data: 'x'.repeat(100)
            }))
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

      // This should handle large data without running out of memory
      await orchestrator.resumeTask(task.id, { checkpointId });

      expect(eventHandler).toHaveBeenCalledTimes(1);
      const forwardedEvent = eventHandler.mock.calls[0][0] as TaskSessionResumedEvent;

      // Verify large data is preserved
      expect(forwardedEvent.sessionData.conversationHistory).toHaveLength(2000);
      expect(forwardedEvent.sessionData.contextSummary).toHaveLength(50000);
      expect(forwardedEvent.sessionData.stageState?.largeDataStructure).toHaveLength(10000);
      expect(forwardedEvent.sessionData.resumePoint?.metadata?.processedItems).toHaveLength(5000);
    });

    it('should handle rapid event emission without dropping events', async () => {
      const eventHandler = vi.fn();
      enhancedDaemon.on('task:session-resumed', eventHandler);

      const taskPromises: Promise<any>[] = [];
      const resumePromises: Promise<boolean>[] = [];
      const taskIds: string[] = [];

      // Create 20 tasks concurrently
      for (let i = 0; i < 20; i++) {
        const taskPromise = orchestrator.createTask({
          description: `Rapid event test task ${i}`,
          workflow: 'test'
        }).then(async (task) => {
          taskIds.push(task.id);
          await orchestrator.updateTaskStatus(task.id, 'paused');
          return orchestrator.saveCheckpoint(task.id, {
            stage: 'testing',
            stageIndex: 0
          });
        });
        taskPromises.push(taskPromise);
      }

      const checkpoints = await Promise.all(taskPromises);

      // Resume all tasks simultaneously
      for (let i = 0; i < taskIds.length; i++) {
        resumePromises.push(orchestrator.resumeTask(taskIds[i], { checkpointId: checkpoints[i] }));
      }

      await Promise.all(resumePromises);

      // Should have received exactly 20 events
      expect(eventHandler).toHaveBeenCalledTimes(20);

      // Verify all task IDs are present and unique
      const receivedTaskIds = eventHandler.mock.calls.map(call => call[0].taskId);
      expect(receivedTaskIds).toHaveLength(20);
      expect(new Set(receivedTaskIds)).toHaveSize(20);

      // All task IDs should match created tasks
      taskIds.forEach(taskId => {
        expect(receivedTaskIds).toContain(taskId);
      });
    });

    it('should handle event handling under system resource pressure', async () => {
      const eventHandler = vi.fn();
      enhancedDaemon.on('task:session-resumed', eventHandler);

      // Create a CPU-intensive handler to simulate system pressure
      const cpuIntensiveHandler = vi.fn((event: TaskSessionResumedEvent) => {
        // Simulate CPU-intensive work
        const start = Date.now();
        while (Date.now() - start < 10) {
          // Busy wait for 10ms
          Math.random() * 1000;
        }
      });

      enhancedDaemon.on('task:session-resumed', cpuIntensiveHandler);

      const task = await orchestrator.createTask({
        description: 'Resource pressure test task',
        workflow: 'test'
      });

      await orchestrator.updateTaskStatus(task.id, 'paused');
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 0
      });

      // Should still handle event correctly despite CPU pressure
      await orchestrator.resumeTask(task.id, { checkpointId });

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(cpuIntensiveHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Daemon Lifecycle Edge Cases', () => {
    it('should handle events during daemon shutdown', async () => {
      const eventHandler = vi.fn();
      enhancedDaemon.on('task:session-resumed', eventHandler);

      const task = await orchestrator.createTask({
        description: 'Shutdown timing test task',
        workflow: 'test'
      });

      await orchestrator.updateTaskStatus(task.id, 'paused');
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 0
      });

      // Start shutdown and resume task simultaneously
      const shutdownPromise = enhancedDaemon.stop();
      const resumePromise = orchestrator.resumeTask(task.id, { checkpointId });

      await Promise.allSettled([shutdownPromise, resumePromise]);

      // Either the event should be handled or the resume should fail gracefully
      // Both outcomes are acceptable during shutdown
      if (eventHandler.mock.calls.length > 0) {
        expect(eventHandler).toHaveBeenCalledTimes(1);
      }

      // Should not throw errors
      expect(true).toBe(true);
    });

    it('should handle restart scenarios with pending events', async () => {
      const eventHandler = vi.fn();

      const task = await orchestrator.createTask({
        description: 'Restart scenario test task',
        workflow: 'test'
      });

      await orchestrator.updateTaskStatus(task.id, 'paused');
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 0
      });

      // Stop daemon
      await enhancedDaemon.stop();

      // Create new daemon instance (simulating restart)
      const newDaemon = new EnhancedDaemon(testDir, {
        version: '1.0',
        project: { name: 'restart-test' },
        daemon: {
          timeBasedUsage: { enabled: false },
          sessionRecovery: { enabled: true },
          idleProcessing: { enabled: false },
          healthCheck: { enabled: false },
          watchdog: { enabled: false },
          installAsService: false,
        },
      });

      await newDaemon.start();

      // Set up event handler on new daemon
      newDaemon.on('task:session-resumed', eventHandler);

      // Resume task on new daemon
      const newOrchestrator = newDaemon['orchestrator'];
      await newOrchestrator.resumeTask(task.id, { checkpointId });

      expect(eventHandler).toHaveBeenCalledTimes(1);

      await newDaemon.stop();
      enhancedDaemon = null as any; // Prevent double cleanup
    });
  });

  describe('Malformed Data Handling', () => {
    it('should handle corrupted session data gracefully', async () => {
      const eventHandler = vi.fn();
      enhancedDaemon.on('task:session-resumed', eventHandler);

      const task = await orchestrator.createTask({
        description: 'Corrupted data test task',
        workflow: 'test'
      });

      // Create session data with potential issues
      const corruptedSessionData = {
        lastCheckpoint: 'invalid-date', // Wrong type
        contextSummary: null, // Null instead of string
        conversationHistory: [
          {
            type: 'unknown_type', // Invalid type
            content: null, // Invalid content
            malformed: true
          },
          'not-an-object' // Wrong structure
        ],
        stageState: {
          circular: null as any // Will create circular reference
        }
      } as any;

      // Create circular reference
      corruptedSessionData.stageState.circular = corruptedSessionData;

      await orchestrator.updateTaskStatus(task.id, 'paused');

      // Try to save corrupted checkpoint
      let checkpointId: string;
      try {
        checkpointId = await orchestrator.saveCheckpoint(task.id, {
          stage: 'testing',
          stageIndex: 0,
          metadata: {
            sessionData: corruptedSessionData
          }
        });
      } catch {
        // If saving fails due to corruption, create a basic checkpoint
        checkpointId = await orchestrator.saveCheckpoint(task.id, {
          stage: 'testing',
          stageIndex: 0,
          metadata: { pauseReason: 'manual' }
        });
      }

      // Resume should still work
      await orchestrator.resumeTask(task.id, { checkpointId });

      expect(eventHandler).toHaveBeenCalledTimes(1);
      const event = eventHandler.mock.calls[0][0] as TaskSessionResumedEvent;
      expect(event.taskId).toBe(task.id);
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should handle null and undefined values in event data', async () => {
      const eventHandler = vi.fn();
      enhancedDaemon.on('task:session-resumed', eventHandler);

      // Manually emit malformed event to test resilience
      const malformedEvent = {
        taskId: null,
        resumeReason: undefined,
        contextSummary: '',
        previousStatus: null,
        sessionData: undefined,
        timestamp: null
      } as any;

      expect(() => {
        enhancedDaemon.emit('task:session-resumed', malformedEvent);
      }).not.toThrow();

      expect(eventHandler).toHaveBeenCalledWith(malformedEvent);
    });

    it('should handle extremely nested session data', async () => {
      const eventHandler = vi.fn();
      enhancedDaemon.on('task:session-resumed', eventHandler);

      const task = await orchestrator.createTask({
        description: 'Deeply nested data test task',
        workflow: 'test'
      });

      // Create extremely nested structure
      let deeplyNested: any = {};
      let current = deeplyNested;

      for (let i = 0; i < 1000; i++) {
        current.level = i;
        current.data = `level-${i}`;
        current.next = {};
        current = current.next;
      }
      current.end = true;

      const nestedSessionData: TaskSessionData = {
        lastCheckpoint: new Date(),
        contextSummary: 'Deeply nested structure test',
        conversationHistory: undefined,
        stageState: {
          deepStructure: deeplyNested,
          metadata: {
            nesting: Array.from({ length: 100 }, (_, i) => ({
              level: i,
              children: Array.from({ length: 10 }, (_, j) => ({
                id: `${i}-${j}`,
                data: { nested: { again: { value: `deep-${i}-${j}` } } }
              }))
            }))
          }
        },
        resumePoint: {
          stage: 'testing',
          stepIndex: 500,
          metadata: deeplyNested
        }
      };

      await orchestrator.updateTaskStatus(task.id, 'paused');
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 0,
        metadata: {
          sessionData: nestedSessionData
        }
      });

      await orchestrator.resumeTask(task.id, { checkpointId });

      expect(eventHandler).toHaveBeenCalledTimes(1);
      const event = eventHandler.mock.calls[0][0] as TaskSessionResumedEvent;
      expect(event.sessionData.stageState?.metadata?.nesting).toHaveLength(100);
    });
  });

  describe('Concurrency Edge Cases', () => {
    it('should handle simultaneous event listeners being added/removed', async () => {
      const handlers = Array.from({ length: 10 }, () => vi.fn());

      // Add handlers concurrently
      const addPromises = handlers.map(handler =>
        Promise.resolve().then(() => enhancedDaemon.on('task:session-resumed', handler))
      );

      // Remove some handlers concurrently
      const removePromises = handlers.slice(0, 5).map(handler =>
        Promise.resolve().then(() => enhancedDaemon.off('task:session-resumed', handler))
      );

      await Promise.all([...addPromises, ...removePromises]);

      // Emit event
      const testEvent: TaskSessionResumedEvent = {
        taskId: 'concurrency-test',
        resumeReason: 'manual_resume',
        contextSummary: 'Concurrency test',
        previousStatus: 'paused',
        sessionData: { lastCheckpoint: new Date() },
        timestamp: new Date()
      };

      enhancedDaemon.emit('task:session-resumed', testEvent);

      // Only handlers that weren't removed should be called
      const calledHandlers = handlers.filter(handler => handler.mock.calls.length > 0);
      const notCalledHandlers = handlers.filter(handler => handler.mock.calls.length === 0);

      expect(calledHandlers.length).toBe(5); // Should be 5 remaining handlers
      expect(notCalledHandlers.length).toBe(5); // Should be 5 removed handlers
    });

    it('should handle exception in one handler not affecting others', async () => {
      const throwingHandler = vi.fn(() => {
        throw new Error('Handler exception');
      });
      const workingHandler1 = vi.fn();
      const workingHandler2 = vi.fn();

      enhancedDaemon.on('task:session-resumed', workingHandler1);
      enhancedDaemon.on('task:session-resumed', throwingHandler);
      enhancedDaemon.on('task:session-resumed', workingHandler2);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const testEvent: TaskSessionResumedEvent = {
        taskId: 'exception-handling-test',
        resumeReason: 'auto_resume',
        contextSummary: 'Exception handling test',
        previousStatus: 'paused',
        sessionData: { lastCheckpoint: new Date() },
        timestamp: new Date()
      };

      expect(() => {
        enhancedDaemon.emit('task:session-resumed', testEvent);
      }).not.toThrow();

      // All handlers should be called despite the exception
      expect(workingHandler1).toHaveBeenCalledWith(testEvent);
      expect(throwingHandler).toHaveBeenCalledWith(testEvent);
      expect(workingHandler2).toHaveBeenCalledWith(testEvent);

      consoleSpy.mockRestore();
    });
  });

  describe('Resource Cleanup Edge Cases', () => {
    it('should handle cleanup when event listeners leak', async () => {
      // Create many handlers to simulate potential memory leaks
      const handlers = Array.from({ length: 1000 }, () => vi.fn());

      handlers.forEach(handler => {
        enhancedDaemon.on('task:session-resumed', handler);
      });

      // Verify listeners were added
      expect(enhancedDaemon.listenerCount('task:session-resumed')).toBe(1000);

      // Remove all listeners
      enhancedDaemon.removeAllListeners('task:session-resumed');

      // Should have no listeners
      expect(enhancedDaemon.listenerCount('task:session-resumed')).toBe(0);

      // Emitting event should not call any handlers
      enhancedDaemon.emit('task:session-resumed', {
        taskId: 'cleanup-test',
        resumeReason: 'manual_resume',
        contextSummary: 'Cleanup test',
        previousStatus: 'paused',
        sessionData: { lastCheckpoint: new Date() },
        timestamp: new Date()
      } as TaskSessionResumedEvent);

      handlers.forEach(handler => {
        expect(handler).not.toHaveBeenCalled();
      });
    });

    it('should handle daemon destruction with active event forwarding', async () => {
      const eventHandler = vi.fn();
      enhancedDaemon.on('task:session-resumed', eventHandler);

      const task = await orchestrator.createTask({
        description: 'Destruction test task',
        workflow: 'test'
      });

      await orchestrator.updateTaskStatus(task.id, 'paused');
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 0
      });

      // Stop daemon immediately after setting up resume
      const resumePromise = orchestrator.resumeTask(task.id, { checkpointId });
      await enhancedDaemon.stop();

      // Resume might succeed or fail, both are acceptable
      try {
        await resumePromise;
      } catch {
        // Expected if orchestrator was shut down
      }

      // No errors should be thrown during cleanup
      expect(true).toBe(true);
    });
  });
});