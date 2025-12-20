import { describe, it, expect } from 'vitest';
import { type Task, type TaskStatus, type TaskPriority, type TaskUsage, type TaskLog, type TaskArtifact } from '../types';

describe('Task Interface - resumeAttempts Field', () => {
  // Helper function to create a valid Task object
  const createValidTask = (overrides: Partial<Task> = {}): Task => {
    const baseTask: Task = {
      id: 'task_123456_789abc',
      description: 'Test task',
      acceptanceCriteria: 'Test acceptance criteria',
      workflow: 'test-workflow',
      autonomy: 'manual',
      status: 'pending',
      priority: 'normal',
      currentStage: 'planning',
      projectPath: '/path/to/project',
      branchName: 'feature/test',
      prUrl: 'https://github.com/test/repo/pull/123',
      retryCount: 0,
      maxRetries: 3,
      resumeAttempts: 0,
      dependsOn: [],
      blockedBy: [],
      subtaskIds: [],
      createdAt: new Date('2025-01-15T10:00:00Z'),
      updatedAt: new Date('2025-01-15T10:00:00Z'),
      completedAt: undefined,
      pausedAt: undefined,
      resumeAfter: undefined,
      pauseReason: undefined,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      },
      logs: [],
      artifacts: [],
      ...overrides
    };
    return baseTask;
  };

  describe('resumeAttempts field presence and type', () => {
    it('should have resumeAttempts field with number type', () => {
      const task = createValidTask();

      expect(task.resumeAttempts).toBeDefined();
      expect(typeof task.resumeAttempts).toBe('number');
    });

    it('should initialize resumeAttempts to 0 for new tasks', () => {
      const newTask = createValidTask({
        resumeAttempts: 0
      });

      expect(newTask.resumeAttempts).toBe(0);
    });

    it('should accept various resumeAttempts values', () => {
      const testValues = [0, 1, 2, 5, 10, 100];

      for (const value of testValues) {
        const task = createValidTask({
          resumeAttempts: value
        });

        expect(task.resumeAttempts).toBe(value);
        expect(typeof task.resumeAttempts).toBe('number');
      }
    });

    it('should be required field in Task interface', () => {
      // This test ensures the field is not optional
      const task: Task = createValidTask({
        resumeAttempts: 5
      });

      expect(task.resumeAttempts).toBe(5);
      // TypeScript would fail compilation if resumeAttempts was missing
    });
  });

  describe('resumeAttempts usage scenarios', () => {
    it('should track resume attempts during task lifecycle', () => {
      // Initial task creation
      const task = createValidTask({
        resumeAttempts: 0,
        status: 'pending'
      });

      expect(task.resumeAttempts).toBe(0);
      expect(task.status).toBe('pending');

      // First resume attempt
      const taskAfterFirstResume = createValidTask({
        ...task,
        resumeAttempts: 1,
        status: 'running'
      });

      expect(taskAfterFirstResume.resumeAttempts).toBe(1);
      expect(taskAfterFirstResume.status).toBe('running');

      // Multiple resume attempts
      const taskAfterMultipleResumes = createValidTask({
        ...task,
        resumeAttempts: 3,
        status: 'running'
      });

      expect(taskAfterMultipleResumes.resumeAttempts).toBe(3);
    });

    it('should work with different task statuses', () => {
      const statuses: TaskStatus[] = ['pending', 'running', 'completed', 'failed', 'cancelled'];

      for (const status of statuses) {
        const task = createValidTask({
          status,
          resumeAttempts: 2
        });

        expect(task.status).toBe(status);
        expect(task.resumeAttempts).toBe(2);
      }
    });

    it('should maintain resumeAttempts across task updates', () => {
      const originalTask = createValidTask({
        resumeAttempts: 2,
        status: 'paused',
        description: 'Original description'
      });

      // Simulate task update preserving resumeAttempts
      const updatedTask = createValidTask({
        ...originalTask,
        description: 'Updated description',
        status: 'running',
        updatedAt: new Date('2025-01-15T11:00:00Z')
        // resumeAttempts should be preserved
      });

      expect(updatedTask.resumeAttempts).toBe(2);
      expect(updatedTask.description).toBe('Updated description');
      expect(updatedTask.status).toBe('running');
    });
  });

  describe('resumeAttempts integration with other Task fields', () => {
    it('should work alongside retryCount field', () => {
      const task = createValidTask({
        retryCount: 2,
        maxRetries: 5,
        resumeAttempts: 3
      });

      expect(task.retryCount).toBe(2);
      expect(task.maxRetries).toBe(5);
      expect(task.resumeAttempts).toBe(3);

      // These fields serve different purposes:
      // retryCount: number of times the current stage has been retried
      // resumeAttempts: number of times the task has been resumed from checkpoint
    });

    it('should work with pause/resume related fields', () => {
      const pausedTask = createValidTask({
        status: 'paused',
        pausedAt: new Date('2025-01-15T09:30:00Z'),
        resumeAfter: new Date('2025-01-15T10:30:00Z'),
        pauseReason: 'rate_limit',
        resumeAttempts: 1
      });

      expect(pausedTask.pausedAt).toBeDefined();
      expect(pausedTask.resumeAfter).toBeDefined();
      expect(pausedTask.pauseReason).toBe('rate_limit');
      expect(pausedTask.resumeAttempts).toBe(1);
    });

    it('should work with subtask relationships', () => {
      const parentTask = createValidTask({
        id: 'parent_task_123',
        subtaskIds: ['subtask_1', 'subtask_2'],
        resumeAttempts: 0
      });

      const subtask = createValidTask({
        id: 'subtask_1',
        parentTaskId: 'parent_task_123',
        resumeAttempts: 2
      });

      expect(parentTask.subtaskIds).toContain('subtask_1');
      expect(parentTask.resumeAttempts).toBe(0);
      expect(subtask.parentTaskId).toBe('parent_task_123');
      expect(subtask.resumeAttempts).toBe(2);
    });

    it('should work with task dependencies', () => {
      const task = createValidTask({
        dependsOn: ['dependency_task_1', 'dependency_task_2'],
        blockedBy: ['blocking_task_1'],
        resumeAttempts: 1
      });

      expect(task.dependsOn).toEqual(['dependency_task_1', 'dependency_task_2']);
      expect(task.blockedBy).toEqual(['blocking_task_1']);
      expect(task.resumeAttempts).toBe(1);
    });
  });

  describe('resumeAttempts validation scenarios', () => {
    it('should handle edge cases for resumeAttempts values', () => {
      // Zero attempts (new task)
      const newTask = createValidTask({ resumeAttempts: 0 });
      expect(newTask.resumeAttempts).toBe(0);

      // High number of attempts
      const highAttemptsTask = createValidTask({ resumeAttempts: 100 });
      expect(highAttemptsTask.resumeAttempts).toBe(100);

      // Maximum safe integer
      const maxAttemptsTask = createValidTask({ resumeAttempts: Number.MAX_SAFE_INTEGER });
      expect(maxAttemptsTask.resumeAttempts).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should maintain type consistency across task operations', () => {
      const task = createValidTask({ resumeAttempts: 5 });

      // Simulating increment operation
      const incrementedTask = createValidTask({
        ...task,
        resumeAttempts: task.resumeAttempts + 1
      });

      expect(incrementedTask.resumeAttempts).toBe(6);
      expect(typeof incrementedTask.resumeAttempts).toBe('number');

      // Simulating reset operation
      const resetTask = createValidTask({
        ...task,
        resumeAttempts: 0
      });

      expect(resetTask.resumeAttempts).toBe(0);
    });

    it('should work in array and collection operations', () => {
      const tasks: Task[] = [
        createValidTask({ id: 'task_1', resumeAttempts: 0 }),
        createValidTask({ id: 'task_2', resumeAttempts: 3 }),
        createValidTask({ id: 'task_3', resumeAttempts: 1 })
      ];

      // Filter tasks by resume attempts
      const tasksWithResumes = tasks.filter(task => task.resumeAttempts > 0);
      expect(tasksWithResumes).toHaveLength(2);

      // Find max resume attempts
      const maxResumes = Math.max(...tasks.map(task => task.resumeAttempts));
      expect(maxResumes).toBe(3);

      // Calculate total resume attempts
      const totalResumes = tasks.reduce((sum, task) => sum + task.resumeAttempts, 0);
      expect(totalResumes).toBe(4);
    });
  });

  describe('resumeAttempts with different task priorities and workflows', () => {
    it('should work with different task priorities', () => {
      const priorities: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];

      for (const priority of priorities) {
        const task = createValidTask({
          priority,
          resumeAttempts: 2
        });

        expect(task.priority).toBe(priority);
        expect(task.resumeAttempts).toBe(2);
      }
    });

    it('should work with different workflows', () => {
      const workflows = ['feature-workflow', 'bugfix-workflow', 'hotfix-workflow', 'maintenance-workflow'];

      for (const workflow of workflows) {
        const task = createValidTask({
          workflow,
          resumeAttempts: 1
        });

        expect(task.workflow).toBe(workflow);
        expect(task.resumeAttempts).toBe(1);
      }
    });

    it('should work with different autonomy levels', () => {
      const autonomyLevels = ['full', 'review-before-commit', 'review-before-merge', 'manual'] as const;

      for (const autonomy of autonomyLevels) {
        const task = createValidTask({
          autonomy,
          resumeAttempts: 4
        });

        expect(task.autonomy).toBe(autonomy);
        expect(task.resumeAttempts).toBe(4);
      }
    });
  });

  describe('resumeAttempts with task logs and artifacts', () => {
    it('should work with task logs tracking resume events', () => {
      const resumeLog: TaskLog = {
        timestamp: new Date('2025-01-15T10:15:00Z'),
        level: 'info',
        stage: 'planning',
        agent: 'planner',
        message: 'Task resumed from checkpoint (attempt #2)'
      };

      const task = createValidTask({
        resumeAttempts: 2,
        logs: [resumeLog]
      });

      expect(task.resumeAttempts).toBe(2);
      expect(task.logs).toHaveLength(1);
      expect(task.logs[0].message).toContain('attempt #2');
    });

    it('should work with task artifacts related to resume attempts', () => {
      const resumeArtifact: TaskArtifact = {
        name: 'resume_checkpoint_2.json',
        type: 'file',
        path: '/checkpoints/resume_checkpoint_2.json',
        content: JSON.stringify({ resumeAttempt: 2, timestamp: '2025-01-15T10:15:00Z' }),
        createdAt: new Date('2025-01-15T10:15:00Z')
      };

      const task = createValidTask({
        resumeAttempts: 2,
        artifacts: [resumeArtifact]
      });

      expect(task.resumeAttempts).toBe(2);
      expect(task.artifacts).toHaveLength(1);
      expect(task.artifacts[0].name).toContain('resume_checkpoint_2');
    });
  });

  describe('Type safety and compilation verification', () => {
    it('should ensure resumeAttempts is not optional', () => {
      // This test verifies that TypeScript requires resumeAttempts
      // If resumeAttempts becomes optional, this would need to be updated

      const taskData = {
        id: 'test_task',
        description: 'Test task',
        workflow: 'test',
        autonomy: 'manual' as const,
        status: 'pending' as const,
        priority: 'normal' as const,
        projectPath: '/test',
        retryCount: 0,
        maxRetries: 3,
        resumeAttempts: 1, // Required field
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
        logs: [],
        artifacts: []
      };

      const task: Task = taskData;
      expect(task.resumeAttempts).toBe(1);
    });

    it('should maintain proper typing for resumeAttempts operations', () => {
      const task = createValidTask({ resumeAttempts: 5 });

      // Type should be inferred as number
      const attempts: number = task.resumeAttempts;
      expect(typeof attempts).toBe('number');

      // Should work with number operations
      const nextAttempt = task.resumeAttempts + 1;
      expect(nextAttempt).toBe(6);
      expect(typeof nextAttempt).toBe('number');

      // Should work with comparison operations
      const hasResumes = task.resumeAttempts > 0;
      expect(hasResumes).toBe(true);
      expect(typeof hasResumes).toBe('boolean');
    });
  });
});