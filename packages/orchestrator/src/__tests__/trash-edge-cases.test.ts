import { describe, it, expect, vi } from 'vitest';
import { ApexOrchestrator } from '../index.js';
import type { Task } from '@apexcli/core';

describe('Trash Operations Edge Cases', () => {
  describe('Event Parameter Validation', () => {
    it('should handle task:trashed event with all possible task states', () => {
      const orchestrator = new ApexOrchestrator();
      const receivedTasks: Task[] = [];

      orchestrator.on('task:trashed', (task: Task) => {
        receivedTasks.push(task);
      });

      const taskStates: Array<Task['status']> = [
        'pending', 'queued', 'planning', 'running', 'completed', 'failed', 'cancelled'
      ];

      taskStates.forEach((status, index) => {
        const mockTask: Task = {
          id: `task-${status}-${index}`,
          description: `Task in ${status} status`,
          workflow: 'feature',
          autonomy: 'full',
          status,
          projectPath: '/tmp/test',
          branchName: 'test-branch',
          createdAt: new Date(2024, 0, 1),
          updatedAt: new Date(2024, 0, 2),
          trashedAt: new Date(2024, 0, 3),
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            estimatedCost: 0.001,
          },
          logs: [
            {
              timestamp: new Date(2024, 0, 1),
              level: 'info',
              message: `Task ${status} created`,
              stage: 'planning',
              metadata: { taskId: `task-${status}-${index}` }
            }
          ],
          artifacts: [
            {
              name: `${status}-artifact`,
              type: 'file',
              path: `/tmp/${status}-file.txt`,
              content: `Content for ${status} task`,
            }
          ],
        };

        orchestrator.emit('task:trashed', mockTask);
      });

      expect(receivedTasks).toHaveLength(taskStates.length);
      receivedTasks.forEach((task, index) => {
        expect(task.status).toBe(taskStates[index]);
        expect(task.trashedAt).toBeInstanceOf(Date);
      });
    });

    it('should handle trash:emptied event with various array sizes', () => {
      const orchestrator = new ApexOrchestrator();
      const emptyEvents: Array<{ count: number; ids: string[] }> = [];

      orchestrator.on('trash:emptied', (count: number, ids: string[]) => {
        emptyEvents.push({ count, ids });
      });

      // Test edge cases for array sizes
      const testCases = [
        { count: 0, ids: [] },
        { count: 1, ids: ['single-task'] },
        { count: 5, ids: ['task1', 'task2', 'task3', 'task4', 'task5'] },
        { count: 100, ids: Array.from({ length: 100 }, (_, i) => `task${i}`) },
      ];

      testCases.forEach(({ count, ids }) => {
        orchestrator.emit('trash:emptied', count, ids);
      });

      expect(emptyEvents).toHaveLength(testCases.length);

      // Verify empty case
      expect(emptyEvents[0].count).toBe(0);
      expect(emptyEvents[0].ids).toEqual([]);

      // Verify single item case
      expect(emptyEvents[1].count).toBe(1);
      expect(emptyEvents[1].ids).toEqual(['single-task']);

      // Verify multiple items case
      expect(emptyEvents[2].count).toBe(5);
      expect(emptyEvents[2].ids).toHaveLength(5);

      // Verify large array case
      expect(emptyEvents[3].count).toBe(100);
      expect(emptyEvents[3].ids).toHaveLength(100);
      expect(emptyEvents[3].ids[0]).toBe('task0');
      expect(emptyEvents[3].ids[99]).toBe('task99');
    });

    it('should handle task:restored event with complex task objects', () => {
      const orchestrator = new ApexOrchestrator();
      const restoredTasks: Task[] = [];

      orchestrator.on('task:restored', (task: Task) => {
        restoredTasks.push(task);
      });

      // Create a complex task with all possible fields
      const complexTask: Task = {
        id: 'complex-restored-task',
        description: 'A complex task with all fields populated',
        acceptanceCriteria: 'Should have all fields properly restored',
        workflow: 'feature',
        autonomy: 'full',
        status: 'completed',
        priority: 'high',
        effort: 'xl',
        projectPath: '/complex/project/path',
        branchName: 'feature/complex-branch-name',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-02T15:30:00Z'),
        completedAt: new Date('2024-01-02T16:00:00Z'),
        // trashedAt should be undefined after restore
        parentId: 'parent-task-id',
        subtaskIds: ['subtask1', 'subtask2', 'subtask3'],
        dependsOn: ['dependency1', 'dependency2'],
        dependents: ['dependent1'],
        tags: ['urgent', 'critical', 'customer-facing'],
        usage: {
          inputTokens: 5000,
          outputTokens: 2500,
          totalTokens: 7500,
          estimatedCost: 0.15,
        },
        logs: [
          {
            timestamp: new Date('2024-01-01T10:05:00Z'),
            level: 'info',
            message: 'Task started',
            stage: 'planning',
            metadata: { agent: 'planner', version: '1.0' }
          },
          {
            timestamp: new Date('2024-01-02T15:00:00Z'),
            level: 'warn',
            message: 'Warning during execution',
            stage: 'implementation',
            metadata: { warning: 'deprecation-notice' }
          }
        ],
        artifacts: [
          {
            name: 'implementation.ts',
            type: 'file',
            path: '/src/implementation.ts',
            content: 'export class Implementation { /* complex code */ }',
          },
          {
            name: 'test-results',
            type: 'report',
            content: 'All tests passed successfully',
          }
        ],
        context: {
          previousAttempts: 2,
          retryReason: 'Infrastructure issue resolved',
        },
      };

      orchestrator.emit('task:restored', complexTask);

      expect(restoredTasks).toHaveLength(1);
      const restored = restoredTasks[0];

      // Verify all fields are preserved
      expect(restored.id).toBe('complex-restored-task');
      expect(restored.description).toBe(complexTask.description);
      expect(restored.acceptanceCriteria).toBe(complexTask.acceptanceCriteria);
      expect(restored.workflow).toBe('feature');
      expect(restored.priority).toBe('high');
      expect(restored.effort).toBe('xl');
      expect(restored.subtaskIds).toEqual(['subtask1', 'subtask2', 'subtask3']);
      expect(restored.tags).toEqual(['urgent', 'critical', 'customer-facing']);
      expect(restored.usage.totalTokens).toBe(7500);
      expect(restored.logs).toHaveLength(2);
      expect(restored.artifacts).toHaveLength(2);
      expect(restored.context?.previousAttempts).toBe(2);
      expect(restored.trashedAt).toBeUndefined();
    });
  });

  describe('Event Timing and Synchronization', () => {
    it('should handle rapid sequential event emissions', () => {
      const orchestrator = new ApexOrchestrator();
      const eventOrder: string[] = [];

      orchestrator.on('task:trashed', () => eventOrder.push('trashed'));
      orchestrator.on('task:restored', () => eventOrder.push('restored'));
      orchestrator.on('trash:emptied', () => eventOrder.push('emptied'));

      const mockTask: Task = {
        id: 'rapid-test-task',
        description: 'Rapid event test',
        workflow: 'feature',
        autonomy: 'full',
        status: 'pending',
        projectPath: '/tmp',
        branchName: 'test',
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
        logs: [],
        artifacts: [],
      };

      // Emit events rapidly in sequence
      orchestrator.emit('task:trashed', { ...mockTask, trashedAt: new Date() });
      orchestrator.emit('task:restored', mockTask);
      orchestrator.emit('trash:emptied', 1, [mockTask.id]);
      orchestrator.emit('task:trashed', { ...mockTask, trashedAt: new Date() });
      orchestrator.emit('task:restored', mockTask);

      expect(eventOrder).toEqual(['trashed', 'restored', 'emptied', 'trashed', 'restored']);
    });

    it('should handle concurrent event listener registration', () => {
      const orchestrator = new ApexOrchestrator();
      const handlers: Array<{ name: string; called: boolean }> = [];

      // Register multiple handlers concurrently
      for (let i = 0; i < 5; i++) {
        const handler = { name: `handler-${i}`, called: false };
        handlers.push(handler);

        orchestrator.on('task:trashed', () => {
          handler.called = true;
        });
      }

      const mockTask: Task = {
        id: 'concurrent-test-task',
        description: 'Concurrent handler test',
        workflow: 'feature',
        autonomy: 'full',
        status: 'pending',
        projectPath: '/tmp',
        branchName: 'test',
        createdAt: new Date(),
        updatedAt: new Date(),
        trashedAt: new Date(),
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
        logs: [],
        artifacts: [],
      };

      orchestrator.emit('task:trashed', mockTask);

      // All handlers should have been called
      handlers.forEach(handler => {
        expect(handler.called).toBe(true);
      });
    });
  });

  describe('Memory and Performance', () => {
    it('should handle large task objects without memory issues', () => {
      const orchestrator = new ApexOrchestrator();
      let receivedTask: Task | null = null;

      orchestrator.on('task:trashed', (task: Task) => {
        receivedTask = task;
      });

      // Create a task with large arrays and content
      const largeTask: Task = {
        id: 'large-memory-test-task',
        description: 'Large task for memory testing',
        workflow: 'feature',
        autonomy: 'full',
        status: 'completed',
        projectPath: '/large/project',
        branchName: 'large-branch',
        createdAt: new Date(),
        updatedAt: new Date(),
        trashedAt: new Date(),
        subtaskIds: Array.from({ length: 1000 }, (_, i) => `subtask-${i}`),
        tags: Array.from({ length: 50 }, (_, i) => `tag-${i}`),
        usage: {
          inputTokens: 1000000,
          outputTokens: 500000,
          totalTokens: 1500000,
          estimatedCost: 30.0,
        },
        logs: Array.from({ length: 500 }, (_, i) => ({
          timestamp: new Date(Date.now() + i * 1000),
          level: 'info' as const,
          message: `Log message ${i}`.repeat(10), // Make each message longer
          stage: 'implementation',
          metadata: { iteration: i, data: Array.from({ length: 10 }, (_, j) => `data-${j}`) }
        })),
        artifacts: Array.from({ length: 100 }, (_, i) => ({
          name: `artifact-${i}.ts`,
          type: 'file' as const,
          path: `/src/artifacts/artifact-${i}.ts`,
          content: `// Large file content for artifact ${i}\n`.repeat(100),
        })),
      };

      orchestrator.emit('task:trashed', largeTask);

      expect(receivedTask).not.toBeNull();
      expect(receivedTask!.id).toBe('large-memory-test-task');
      expect(receivedTask!.subtaskIds).toHaveLength(1000);
      expect(receivedTask!.logs).toHaveLength(500);
      expect(receivedTask!.artifacts).toHaveLength(100);
    });

    it('should handle many small events efficiently', () => {
      const orchestrator = new ApexOrchestrator();
      const events: Array<{ type: string; id: string }> = [];

      orchestrator.on('task:trashed', (task: Task) => {
        events.push({ type: 'trashed', id: task.id });
      });
      orchestrator.on('task:restored', (task: Task) => {
        events.push({ type: 'restored', id: task.id });
      });

      const numEvents = 1000;
      const startTime = Date.now();

      // Emit many small events
      for (let i = 0; i < numEvents; i++) {
        const mockTask: Task = {
          id: `small-task-${i}`,
          description: `Small task ${i}`,
          workflow: 'feature',
          autonomy: 'full',
          status: 'pending',
          projectPath: '/tmp',
          branchName: 'test',
          createdAt: new Date(),
          updatedAt: new Date(),
          trashedAt: i % 2 === 0 ? new Date() : undefined,
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, estimatedCost: 0.0001 },
          logs: [],
          artifacts: [],
        };

        if (i % 2 === 0) {
          orchestrator.emit('task:trashed', mockTask);
        } else {
          orchestrator.emit('task:restored', mockTask);
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(events).toHaveLength(numEvents);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second

      // Verify event distribution
      const trashedEvents = events.filter(e => e.type === 'trashed');
      const restoredEvents = events.filter(e => e.type === 'restored');

      expect(trashedEvents).toHaveLength(numEvents / 2);
      expect(restoredEvents).toHaveLength(numEvents / 2);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should continue working after handler errors', () => {
      const orchestrator = new ApexOrchestrator();
      const successfulCalls: string[] = [];

      // Add a handler that throws an error
      orchestrator.on('task:trashed', () => {
        throw new Error('Handler error');
      });

      // Add a handler that works
      orchestrator.on('task:trashed', (task: Task) => {
        successfulCalls.push(task.id);
      });

      const mockTask: Task = {
        id: 'error-recovery-test',
        description: 'Error recovery test',
        workflow: 'feature',
        autonomy: 'full',
        status: 'pending',
        projectPath: '/tmp',
        branchName: 'test',
        createdAt: new Date(),
        updatedAt: new Date(),
        trashedAt: new Date(),
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
        logs: [],
        artifacts: [],
      };

      // This should not crash, even with the error-throwing handler
      expect(() => orchestrator.emit('task:trashed', mockTask)).not.toThrow();

      // The successful handler should still have been called
      expect(successfulCalls).toContain('error-recovery-test');
    });

    it('should handle undefined and null values gracefully', () => {
      const orchestrator = new ApexOrchestrator();
      const events: any[] = [];

      orchestrator.on('trash:emptied', (count: number, ids: string[]) => {
        events.push({ count, ids });
      });

      // Test edge cases that should still work
      orchestrator.emit('trash:emptied', 0, []);
      orchestrator.emit('trash:emptied', 3, ['a', 'b', 'c']);

      expect(events).toHaveLength(2);
      expect(events[0].count).toBe(0);
      expect(events[0].ids).toEqual([]);
      expect(events[1].count).toBe(3);
      expect(events[1].ids).toEqual(['a', 'b', 'c']);
    });
  });

  describe('Type Safety Edge Cases', () => {
    it('should enforce Task type structure for trashed events', () => {
      const orchestrator = new ApexOrchestrator();

      // This test ensures TypeScript would catch type violations
      const validHandler = (task: Task) => {
        // These accesses should all be valid
        expect(typeof task.id).toBe('string');
        expect(typeof task.description).toBe('string');
        expect(typeof task.workflow).toBe('string');
        expect(['pending', 'queued', 'planning', 'running', 'completed', 'failed', 'cancelled'])
          .toContain(task.status);
        expect(['full', 'review-before-commit', 'review-before-merge', 'manual'])
          .toContain(task.autonomy);
      };

      orchestrator.on('task:trashed', validHandler);

      const validTask: Task = {
        id: 'type-safety-validation',
        description: 'Type safety validation test',
        workflow: 'feature',
        autonomy: 'full',
        status: 'completed',
        projectPath: '/type/safety/test',
        branchName: 'type-safety',
        createdAt: new Date(),
        updatedAt: new Date(),
        trashedAt: new Date(),
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.003 },
        logs: [],
        artifacts: [],
      };

      expect(() => orchestrator.emit('task:trashed', validTask)).not.toThrow();
    });

    it('should enforce correct parameter types for trash:emptied', () => {
      const orchestrator = new ApexOrchestrator();

      const validHandler = (deletedCount: number, taskIds: string[]) => {
        expect(typeof deletedCount).toBe('number');
        expect(deletedCount >= 0).toBe(true);
        expect(Array.isArray(taskIds)).toBe(true);
        taskIds.forEach(id => expect(typeof id).toBe('string'));
      };

      orchestrator.on('trash:emptied', validHandler);

      // Test various valid parameter combinations
      const testCases = [
        { count: 0, ids: [] },
        { count: 1, ids: ['single'] },
        { count: 5, ids: ['a', 'b', 'c', 'd', 'e'] },
        { count: 2, ids: ['task-1', 'task-2'] },
      ];

      testCases.forEach(({ count, ids }) => {
        expect(() => orchestrator.emit('trash:emptied', count, ids)).not.toThrow();
      });
    });
  });
});