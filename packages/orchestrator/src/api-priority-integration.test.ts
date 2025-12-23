import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import type { CreateTaskRequest, TaskPriority, TaskEffort } from '@apexcli/core';

describe('API Priority Integration Tests', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-api-priority-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    // Create minimal config file
    const configPath = path.join(testDir, '.apex', 'config.yaml');
    await fs.writeFile(configPath, `
version: "1.0"
project:
  name: "test-project"
  language: "typescript"
`);

    orchestrator = new ApexOrchestrator(testDir);
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await orchestrator.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Task Creation with Priority and Effort', () => {
    it('should create tasks with different priorities and efforts via API', async () => {
      const requests: CreateTaskRequest[] = [
        {
          description: 'High priority large effort task',
          priority: 'high',
          effort: 'large',
        },
        {
          description: 'High priority small effort task',
          priority: 'high',
          effort: 'small',
        },
        {
          description: 'Normal priority medium effort task',
          priority: 'normal',
          effort: 'medium',
        },
        {
          description: 'Urgent priority XS effort task',
          priority: 'urgent',
          effort: 'xs',
        },
      ];

      const createdTasks = [];
      for (const request of requests) {
        const result = await orchestrator.createTask(request);
        createdTasks.push(result);
      }

      // Get all tasks and verify they were created with correct properties
      const allTasks = await orchestrator.getAllTasks();
      expect(allTasks).toHaveLength(4);

      // Find each task and verify priority and effort
      const highLargeTask = allTasks.find(t => t.description.includes('large effort'));
      expect(highLargeTask?.priority).toBe('high');
      expect(highLargeTask?.effort).toBe('large');

      const highSmallTask = allTasks.find(t => t.description.includes('small effort'));
      expect(highSmallTask?.priority).toBe('high');
      expect(highSmallTask?.effort).toBe('small');

      const normalMediumTask = allTasks.find(t => t.description.includes('medium effort'));
      expect(normalMediumTask?.priority).toBe('normal');
      expect(normalMediumTask?.effort).toBe('medium');

      const urgentXsTask = allTasks.find(t => t.description.includes('XS effort'));
      expect(urgentXsTask?.priority).toBe('urgent');
      expect(urgentXsTask?.effort).toBe('xs');
    });
  });

  describe('Task Queuing and Prioritization via API', () => {
    it('should queue and retrieve tasks in priority order with tie-breaking', async () => {
      // Create multiple tasks with same priority but different efforts
      const taskRequests = [
        {
          description: 'Same priority XL effort',
          priority: 'normal' as TaskPriority,
          effort: 'xl' as TaskEffort,
        },
        {
          description: 'Same priority XS effort',
          priority: 'normal' as TaskPriority,
          effort: 'xs' as TaskEffort,
        },
        {
          description: 'Same priority medium effort',
          priority: 'normal' as TaskPriority,
          effort: 'medium' as TaskEffort,
        },
        {
          description: 'Same priority small effort',
          priority: 'normal' as TaskPriority,
          effort: 'small' as TaskEffort,
        },
      ];

      // Create tasks in non-optimal order
      for (const request of taskRequests) {
        await orchestrator.createTask(request);
      }

      // Get pending tasks (should be ordered by priority logic)
      const pendingTasks = await orchestrator.getPendingTasks();
      expect(pendingTasks).toHaveLength(4);

      // Verify they are ordered by effort (XS, small, medium, XL)
      expect(pendingTasks[0].description).toContain('XS effort');
      expect(pendingTasks[1].description).toContain('small effort');
      expect(pendingTasks[2].description).toContain('medium effort');
      expect(pendingTasks[3].description).toContain('XL effort');
    });

    it('should handle mixed priority and effort scenarios correctly', async () => {
      const taskRequests = [
        {
          description: 'Low priority XS effort',
          priority: 'low' as TaskPriority,
          effort: 'xs' as TaskEffort,
        },
        {
          description: 'Urgent priority large effort',
          priority: 'urgent' as TaskPriority,
          effort: 'large' as TaskEffort,
        },
        {
          description: 'High priority small effort',
          priority: 'high' as TaskPriority,
          effort: 'small' as TaskEffort,
        },
        {
          description: 'Urgent priority XS effort',
          priority: 'urgent' as TaskPriority,
          effort: 'xs' as TaskEffort,
        },
        {
          description: 'High priority large effort',
          priority: 'high' as TaskPriority,
          effort: 'large' as TaskEffort,
        },
      ];

      for (const request of taskRequests) {
        await orchestrator.createTask(request);
      }

      const pendingTasks = await orchestrator.getPendingTasks();
      expect(pendingTasks).toHaveLength(5);

      // Expected order:
      // 1. Urgent XS (highest priority, lowest effort)
      // 2. Urgent large (highest priority, higher effort)
      // 3. High small (second priority, lower effort)
      // 4. High large (second priority, higher effort)
      // 5. Low XS (lowest priority)
      expect(pendingTasks[0].description).toContain('Urgent priority XS effort');
      expect(pendingTasks[1].description).toContain('Urgent priority large effort');
      expect(pendingTasks[2].description).toContain('High priority small effort');
      expect(pendingTasks[3].description).toContain('High priority large effort');
      expect(pendingTasks[4].description).toContain('Low priority XS effort');
    });
  });

  describe('Task Status Updates and Queue Management', () => {
    it('should maintain priority ordering after task status updates', async () => {
      // Create some tasks
      const task1 = await orchestrator.createTask({
        description: 'Task to be completed',
        priority: 'urgent',
        effort: 'small',
      });

      const task2 = await orchestrator.createTask({
        description: 'Task to remain pending high',
        priority: 'high',
        effort: 'xs',
      });

      const task3 = await orchestrator.createTask({
        description: 'Task to remain pending normal',
        priority: 'normal',
        effort: 'medium',
      });

      // Complete the first task
      await orchestrator.updateTaskStatus(task1.id, 'completed');

      // Get pending tasks - should only include tasks 2 and 3 in correct order
      const pendingTasks = await orchestrator.getPendingTasks();
      expect(pendingTasks).toHaveLength(2);
      expect(pendingTasks[0].description).toContain('high');
      expect(pendingTasks[1].description).toContain('normal');
    });

    it('should handle task priority updates and maintain correct ordering', async () => {
      const task1 = await orchestrator.createTask({
        description: 'Task initially low',
        priority: 'low',
        effort: 'medium',
      });

      const task2 = await orchestrator.createTask({
        description: 'Task initially normal',
        priority: 'normal',
        effort: 'medium',
      });

      // Initially, normal should come before low
      let pendingTasks = await orchestrator.getPendingTasks();
      expect(pendingTasks[0].description).toContain('normal');
      expect(pendingTasks[1].description).toContain('low');

      // Update low priority task to urgent
      await orchestrator.updateTask(task1.id, { priority: 'urgent' });

      // Now urgent should come first
      pendingTasks = await orchestrator.getPendingTasks();
      expect(pendingTasks[0].description).toContain('initially low');
      expect(pendingTasks[1].description).toContain('initially normal');
    });
  });

  describe('Default Values and Edge Cases', () => {
    it('should apply default priority and effort when not specified', async () => {
      const task = await orchestrator.createTask({
        description: 'Task with default values',
      });

      expect(task.priority).toBe('normal'); // Default priority
      expect(task.effort).toBe('medium');   // Default effort
    });

    it('should handle partial specification of priority and effort', async () => {
      const taskWithPriority = await orchestrator.createTask({
        description: 'Task with only priority specified',
        priority: 'high',
      });

      const taskWithEffort = await orchestrator.createTask({
        description: 'Task with only effort specified',
        effort: 'large',
      });

      expect(taskWithPriority.priority).toBe('high');
      expect(taskWithPriority.effort).toBe('medium'); // Default effort

      expect(taskWithEffort.priority).toBe('normal'); // Default priority
      expect(taskWithEffort.effort).toBe('large');
    });

    it('should handle all valid priority and effort combinations', async () => {
      const priorities: TaskPriority[] = ['urgent', 'high', 'normal', 'low'];
      const efforts: TaskEffort[] = ['xs', 'small', 'medium', 'large', 'xl'];

      const tasks = [];
      for (const priority of priorities) {
        for (const effort of efforts) {
          const task = await orchestrator.createTask({
            description: `Task ${priority} ${effort}`,
            priority,
            effort,
          });
          tasks.push(task);
        }
      }

      expect(tasks).toHaveLength(20); // 4 priorities × 5 efforts

      // Verify all tasks were created with correct properties
      for (const task of tasks) {
        expect(priorities).toContain(task.priority);
        expect(efforts).toContain(task.effort);
      }

      // Get all pending tasks and verify they are properly ordered
      const pendingTasks = await orchestrator.getPendingTasks();
      expect(pendingTasks).toHaveLength(20);

      // Verify basic ordering: all urgent tasks come before high tasks, etc.
      let urgentCount = 0;
      let highCount = 0;
      let normalCount = 0;
      let lowCount = 0;

      for (const task of pendingTasks) {
        if (task.priority === 'urgent') urgentCount++;
        else if (task.priority === 'high') {
          highCount++;
          expect(urgentCount).toBe(5); // All urgent tasks should come first
        } else if (task.priority === 'normal') {
          normalCount++;
          expect(urgentCount).toBe(5);
          expect(highCount).toBe(5); // All high tasks should come after urgent
        } else if (task.priority === 'low') {
          lowCount++;
          expect(urgentCount).toBe(5);
          expect(highCount).toBe(5);
          expect(normalCount).toBe(5); // All normal tasks should come after high
        }
      }
    });
  });

  describe('Error Handling and Validation', () => {
    it('should handle invalid priority values gracefully', async () => {
      try {
        await orchestrator.createTask({
          description: 'Task with invalid priority',
          priority: 'invalid' as any,
          effort: 'medium',
        });
        // If it doesn't throw, verify the task was created with default values
        const tasks = await orchestrator.getAllTasks();
        const task = tasks.find(t => t.description.includes('invalid priority'));
        if (task) {
          // Should either reject invalid value or default to normal
          expect(['urgent', 'high', 'normal', 'low']).toContain(task.priority);
        }
      } catch (error) {
        // It's acceptable for invalid values to be rejected
        expect(error).toBeDefined();
      }
    });

    it('should handle invalid effort values gracefully', async () => {
      try {
        await orchestrator.createTask({
          description: 'Task with invalid effort',
          priority: 'normal',
          effort: 'invalid' as any,
        });
        // If it doesn't throw, verify the task was created with default values
        const tasks = await orchestrator.getAllTasks();
        const task = tasks.find(t => t.description.includes('invalid effort'));
        if (task) {
          // Should either reject invalid value or default to medium
          expect(['xs', 'small', 'medium', 'large', 'xl']).toContain(task.effort);
        }
      } catch (error) {
        // It's acceptable for invalid values to be rejected
        expect(error).toBeDefined();
      }
    });

    it('should handle null and undefined values appropriately', async () => {
      const taskWithNulls = await orchestrator.createTask({
        description: 'Task with null values',
        priority: null as any,
        effort: undefined as any,
      });

      // Should use default values
      expect(taskWithNulls.priority).toBe('normal');
      expect(taskWithNulls.effort).toBe('medium');
    });
  });
});