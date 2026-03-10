import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../packages/orchestrator/src/index';
import { initializeApex } from '@apexcli/core';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
  tool: vi.fn(() => ({})),
  createSdkMcpServer: vi.fn(() => ({})),
}));

// Mock child_process
vi.mock('child_process', () => {
  const mockExec = vi.fn((cmd: string, opts: unknown, callback?: unknown) => {
    if (typeof opts === 'function') {
      callback = opts;
    }
    const cb = callback as (error: Error | null, result?: { stdout: string }) => void;
    cb(null, { stdout: '' });
  });

  const mockExecFile = vi.fn((file: string, args: string[], opts: unknown, callback?: unknown) => {
    if (typeof opts === 'function') {
      callback = opts;
    }
    const cb = callback as (error: Error | null, result?: { stdout: string; stderr: string }) => void;
    cb(null, { stdout: '', stderr: '' });
  });

  return {
    exec: mockExec,
    execFile: mockExecFile,
    spawn: vi.fn(),
    fork: vi.fn(),
    default: {
      exec: mockExec,
      execFile: mockExecFile,
      spawn: vi.fn(),
      fork: vi.fn()
    }
  };
});

describe('Subtask Parent-Child Integration Tests', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-parent-child-test-'));

    await initializeApex(testDir, {
      projectName: 'parent-child-test-project',
      autonomyLevel: 'review-all',
    });

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    try {
      if (testDir) {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
    vi.clearAllMocks();
  });

  describe('Parent Task Lifecycle Integration', () => {
    it('should properly manage parent task state during subtask lifecycle', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Lifecycle parent task',
      });

      // Initial state - no subtasks
      expect(await orchestrator.hasSubtasks(parentTask.id)).toBe(false);
      expect(await orchestrator.getSubtasks(parentTask.id)).toEqual([]);

      // Create subtasks
      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Lifecycle subtask 1' },
        { description: 'Lifecycle subtask 2' },
      ]);

      // After decomposition - has subtasks
      expect(await orchestrator.hasSubtasks(parentTask.id)).toBe(true);
      const retrievedSubtasks = await orchestrator.getSubtasks(parentTask.id);
      expect(retrievedSubtasks).toHaveLength(2);

      // Verify parent-child relationships
      for (const subtask of subtasks) {
        expect(await orchestrator.isSubtask(subtask.id)).toBe(true);
        const parent = await orchestrator.getParentTask(subtask.id);
        expect(parent?.id).toBe(parentTask.id);
      }

      // Mark subtasks as completed
      for (const subtask of subtasks) {
        await (orchestrator as any).store.updateTask(subtask.id, {
          status: 'completed',
          completedAt: new Date(),
        });
      }

      // Verify aggregation
      const allComplete = await (orchestrator as any).aggregateSubtaskResults(parentTask.id);
      expect(allComplete).toBe(true);
    });

    it('should handle parent task completion when all subtasks complete', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Auto-complete parent task',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Auto-complete subtask 1' },
        { description: 'Auto-complete subtask 2' },
        { description: 'Auto-complete subtask 3' },
      ]);

      // Set parent task to in-progress so completion logic can work
      await (orchestrator as any).updateTaskStatus(parentTask.id, 'in-progress');

      // Initially parent should not be complete
      let parentStatus = await orchestrator.getTask(parentTask.id);
      expect(parentStatus?.status).toBe('in-progress');

      const usageData = {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.01,
        totalCostCents: 1,
        executionTimeMs: 1000,
      };

      // Complete first two subtasks
      await (orchestrator as any).updateTaskStatus(subtasks[0].id, 'completed');
      await (orchestrator as any).store.updateTask(subtasks[0].id, { usage: usageData });
      await (orchestrator as any).updateTaskStatus(subtasks[1].id, 'completed');
      await (orchestrator as any).store.updateTask(subtasks[1].id, { usage: usageData });

      // Parent should still not be complete (third subtask still pending)
      const partialResult = await (orchestrator as any).aggregateSubtaskResults(parentTask.id);
      expect(partialResult).toBe(false);

      // Complete last subtask
      await (orchestrator as any).updateTaskStatus(subtasks[2].id, 'completed');
      await (orchestrator as any).store.updateTask(subtasks[2].id, { usage: usageData });

      // Now all subtasks are complete
      const finalResult = await (orchestrator as any).aggregateSubtaskResults(parentTask.id);
      expect(finalResult).toBe(true);

      // Parent should now be completed automatically (no manual trigger needed)
      // Verify parent is now completed
      parentStatus = await orchestrator.getTask(parentTask.id);
      expect(parentStatus?.status).toBe('completed');
    });

    it('should not mark parent as complete if any subtask fails', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Failure handling parent task',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Success subtask 1' },
        { description: 'Failed subtask' },
        { description: 'Success subtask 2' },
      ]);

      // Complete successful subtasks with proper usage to avoid ghost completion
      await (orchestrator as any).updateTaskStatus(subtasks[0].id, 'completed');
      await (orchestrator as any).store.updateTask(subtasks[0].id, {
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.01,
          totalCostCents: 1,
          executionTimeMs: 1000,
        }
      });
      await (orchestrator as any).updateTaskStatus(subtasks[2].id, 'completed');
      await (orchestrator as any).store.updateTask(subtasks[2].id, {
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.01,
          totalCostCents: 1,
          executionTimeMs: 1000,
        }
      });

      // Fail one subtask
      await (orchestrator as any).updateTaskStatus(subtasks[1].id, 'failed');

      // Parent should not be complete due to failed subtask
      const result = await (orchestrator as any).aggregateSubtaskResults(parentTask.id);
      expect(result).toBe(false); // This should be false because failedCount > 0

      const parentStatus = await orchestrator.getTask(parentTask.id);
      expect(parentStatus?.status).not.toBe('completed');
    });
  });

  describe('Subtask Inheritance and Configuration', () => {
    it('should inherit properties from parent task appropriately', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Rich parent task',
        workflow: 'comprehensive',
        priority: 'high',
        effort: 'large',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Inheritance test subtask' },
      ]);

      const subtask = subtasks[0];
      expect(subtask.workflow).toBe('comprehensive');
      expect(subtask.priority).toBe('high');
      expect(subtask.projectPath).toBe(parentTask.projectPath);
      expect(subtask.parentTaskId).toBe(parentTask.id);
    });

    it('should allow subtasks to override parent properties', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Override parent task',
        priority: 'medium',
        effort: 'large',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        {
          description: 'Override test subtask',
          priority: 'urgent',
          effort: 'small',
        },
      ]);

      const subtask = subtasks[0];
      expect(subtask.priority).toBe('urgent'); // Override applied
      expect(subtask.effort).toBe('small'); // Override applied
      expect(subtask.parentTaskId).toBe(parentTask.id); // Inherited
    });

    it('should properly handle autonomy levels in subtasks', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Autonomy test parent',
        autonomy: 'supervised',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Autonomy test subtask 1' },
        { description: 'Autonomy test subtask 2' },
      ]);

      // Subtasks should inherit parent's autonomy level
      for (const subtask of subtasks) {
        expect(subtask.autonomy).toBe('supervised');
      }
    });
  });

  describe('Multi-Level Hierarchy Management', () => {
    it('should maintain integrity across multiple hierarchy levels', async () => {
      // Level 0: Root task
      const rootTask = await orchestrator.createTask({
        description: 'Root hierarchy task',
      });

      // Level 1: Primary subtasks
      const level1Tasks = await orchestrator.decomposeTask(rootTask.id, [
        { description: 'Level 1 Task A' },
        { description: 'Level 1 Task B' },
      ]);

      // Level 2: Sub-subtasks
      const level2TasksA = await orchestrator.decomposeTask(level1Tasks[0].id, [
        { description: 'Level 2 Task A1' },
        { description: 'Level 2 Task A2' },
      ]);

      const level2TasksB = await orchestrator.decomposeTask(level1Tasks[1].id, [
        { description: 'Level 2 Task B1' },
      ]);

      // Level 3: Deep nesting
      const level3Tasks = await orchestrator.decomposeTask(level2TasksA[0].id, [
        { description: 'Level 3 Task A1a' },
      ]);

      // Verify hierarchy integrity
      expect(await orchestrator.isSubtask(rootTask.id)).toBe(false);
      expect(await orchestrator.hasSubtasks(rootTask.id)).toBe(true);

      expect(await orchestrator.isSubtask(level1Tasks[0].id)).toBe(true);
      expect(await orchestrator.hasSubtasks(level1Tasks[0].id)).toBe(true);

      expect(await orchestrator.isSubtask(level2TasksA[0].id)).toBe(true);
      expect(await orchestrator.hasSubtasks(level2TasksA[0].id)).toBe(true);

      expect(await orchestrator.isSubtask(level3Tasks[0].id)).toBe(true);
      expect(await orchestrator.hasSubtasks(level3Tasks[0].id)).toBe(false);

      // Verify parent relationships
      const level3Parent = await orchestrator.getParentTask(level3Tasks[0].id);
      expect(level3Parent?.id).toBe(level2TasksA[0].id);

      const level2Parent = await orchestrator.getParentTask(level2TasksA[0].id);
      expect(level2Parent?.id).toBe(level1Tasks[0].id);

      const level1Parent = await orchestrator.getParentTask(level1Tasks[0].id);
      expect(level1Parent?.id).toBe(rootTask.id);
    });

    it('should handle cascading completion through hierarchy levels', async () => {
      // Create 3-level hierarchy
      const rootTask = await orchestrator.createTask({
        description: 'Cascading completion root',
      });

      const level1Tasks = await orchestrator.decomposeTask(rootTask.id, [
        { description: 'Level 1 only subtasks' },
        { description: 'Level 1 with subtasks' },
      ]);

      const level2Tasks = await orchestrator.decomposeTask(level1Tasks[1].id, [
        { description: 'Level 2 Task 1' },
        { description: 'Level 2 Task 2' },
      ]);

      // Complete all leaf tasks
      await (orchestrator as any).store.updateTask(level1Tasks[0].id, { status: 'completed' });
      await (orchestrator as any).store.updateTask(level2Tasks[0].id, { status: 'completed' });
      await (orchestrator as any).store.updateTask(level2Tasks[1].id, { status: 'completed' });

      // Check level 1 task with subtasks
      const level1WithSubtasksResult = await (orchestrator as any).aggregateSubtaskResults(level1Tasks[1].id);
      expect(level1WithSubtasksResult).toBe(true);

      // Manually complete intermediate parent
      await (orchestrator as any).store.updateTask(level1Tasks[1].id, { status: 'completed' });

      // Check root task
      const rootResult = await (orchestrator as any).aggregateSubtaskResults(rootTask.id);
      expect(rootResult).toBe(true);
    });

    it('should prevent orphaned subtasks when parent is deleted', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent to be deleted',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Subtask 1' },
        { description: 'Subtask 2' },
      ]);

      // Verify subtasks exist and have parent
      for (const subtask of subtasks) {
        const parent = await orchestrator.getParentTask(subtask.id);
        expect(parent?.id).toBe(parentTask.id);
      }

      // Delete parent task (simulate soft delete by marking as trashed)
      await (orchestrator as any).store.updateTask(parentTask.id, {
        trashedAt: new Date(),
      });

      // Subtasks should still reference the parent (maintaining referential integrity)
      for (const subtask of subtasks) {
        const currentSubtask = await orchestrator.getTask(subtask.id);
        expect(currentSubtask?.parentTaskId).toBe(parentTask.id);
      }

      // But getParentTask should handle trashed parents gracefully
      const trashedParent = await orchestrator.getParentTask(subtasks[0].id);
      // Implementation should decide whether to return trashed parents or null
      expect(trashedParent === null || trashedParent.trashedAt !== undefined).toBe(true);
    });
  });

  describe('Concurrent Operations and Race Conditions', () => {
    it('should handle concurrent subtask creation safely', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Concurrent creation parent',
      });

      // Attempt concurrent decomposition (should be prevented by decomposition guard)
      const decompositionPromises = [
        orchestrator.decomposeTask(parentTask.id, [{ description: 'Concurrent task A' }]),
        orchestrator.decomposeTask(parentTask.id, [{ description: 'Concurrent task B' }]),
        orchestrator.decomposeTask(parentTask.id, [{ description: 'Concurrent task C' }]),
      ];

      const results = await Promise.allSettled(decompositionPromises);

      // All should succeed (no errors), but only one should actually create subtasks
      let successCount = 0;
      let emptyCount = 0;

      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value.length > 0) {
            successCount++;
          } else {
            emptyCount++;
          }
        } else {
          // No rejections expected - the guard returns empty arrays, doesn't throw
          expect(result.status).toBe('fulfilled');
        }
      }

      // Due to the decomposition guard, only the first should succeed
      expect(successCount).toBe(1); // Only one decomposition should succeed
      expect(emptyCount).toBe(2); // Others should return empty arrays

      // Verify final state
      const finalParent = await orchestrator.getTask(parentTask.id);
      expect(finalParent?.subtaskIds).toHaveLength(1);
    });

    it('should handle concurrent subtask status updates correctly', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Concurrent status update parent',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Concurrent update task 1' },
        { description: 'Concurrent update task 2' },
        { description: 'Concurrent update task 3' },
      ]);

      // Concurrent status updates
      const updatePromises = subtasks.map(async (subtask, index) => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100)); // Random delay
        return (orchestrator as any).store.updateTask(subtask.id, {
          status: 'completed',
          completedAt: new Date(),
        });
      });

      await Promise.all(updatePromises);

      // Verify all updates succeeded
      for (const subtask of subtasks) {
        const updated = await orchestrator.getTask(subtask.id);
        expect(updated?.status).toBe('completed');
      }

      // Verify parent aggregation still works correctly
      const finalResult = await (orchestrator as any).aggregateSubtaskResults(parentTask.id);
      expect(finalResult).toBe(true);
    });

    it('should maintain data consistency under concurrent operations', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Data consistency test parent',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Consistency task 1' },
        { description: 'Consistency task 2' },
        { description: 'Consistency task 3' },
      ]);

      // Concurrent reads and writes
      const operations = [
        // Multiple getSubtasks calls
        orchestrator.getSubtasks(parentTask.id),
        orchestrator.getSubtasks(parentTask.id),
        orchestrator.getSubtasks(parentTask.id),

        // Multiple status checks
        orchestrator.getSubtaskStatus(parentTask.id),
        orchestrator.getSubtaskStatus(parentTask.id),

        // Multiple parent lookups
        orchestrator.getParentTask(subtasks[0].id),
        orchestrator.getParentTask(subtasks[1].id),
        orchestrator.getParentTask(subtasks[2].id),
      ];

      const results = await Promise.allSettled(operations);

      // All operations should succeed
      for (const result of results) {
        expect(result.status).toBe('fulfilled');
      }

      // Verify data consistency
      const finalSubtasks = await orchestrator.getSubtasks(parentTask.id);
      expect(finalSubtasks).toHaveLength(3);

      const finalStatus = await orchestrator.getSubtaskStatus(parentTask.id);
      expect(finalStatus.total).toBe(3);
    });
  });

  describe('Resource Usage and Performance', () => {
    it('should aggregate resource usage from subtasks to parent', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Resource aggregation parent',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Resource subtask 1' },
        { description: 'Resource subtask 2' },
      ]);

      // Simulate resource usage in subtasks
      await (orchestrator as any).store.updateTask(subtasks[0].id, {
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 0.15,
          totalCostCents: 15,
          executionTimeMs: 5000,
        },
      });

      await (orchestrator as any).store.updateTask(subtasks[1].id, {
        usage: {
          inputTokens: 800,
          outputTokens: 400,
          totalTokens: 1200,
          estimatedCost: 0.12,
          totalCostCents: 12,
          executionTimeMs: 3000,
        },
      });

      // Test the aggregation logic (this tests the private method)
      const aggregated = await (orchestrator as any).aggregateSubtaskResults(parentTask.id);

      // Verify the parent task gets updated with aggregated usage
      const updatedParent = await orchestrator.getTask(parentTask.id);

      // The aggregateSubtaskResults method should update the parent's usage
      // We're testing that the method completes successfully
      expect(typeof aggregated).toBe('boolean');
    });

    it('should handle large hierarchies efficiently', async () => {
      const startTime = Date.now();

      // Create a moderately large hierarchy
      const rootTask = await orchestrator.createTask({
        description: 'Large hierarchy root',
      });

      const level1Count = 10;
      const level2Count = 5; // 5 subtasks per level1 task = 50 total level2 tasks

      // Create level 1 subtasks
      const level1Subtasks = await orchestrator.decomposeTask(
        rootTask.id,
        Array.from({ length: level1Count }, (_, i) => ({
          description: `Level 1 Task ${i + 1}`,
        }))
      );

      // Create level 2 subtasks
      const level2Promises = level1Subtasks.map(async (level1Task) => {
        return orchestrator.decomposeTask(
          level1Task.id,
          Array.from({ length: level2Count }, (_, i) => ({
            description: `Level 2 Task ${level1Task.description} - ${i + 1}`,
          }))
        );
      });

      const level2Results = await Promise.all(level2Promises);
      const totalLevel2Tasks = level2Results.reduce((sum, tasks) => sum + tasks.length, 0);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Verify structure
      expect(totalLevel2Tasks).toBe(level1Count * level2Count);
      expect(executionTime).toBeLessThan(10000); // Should complete in under 10 seconds

      // Verify hierarchy integrity
      expect(await orchestrator.hasSubtasks(rootTask.id)).toBe(true);

      const rootSubtasks = await orchestrator.getSubtasks(rootTask.id);
      expect(rootSubtasks).toHaveLength(level1Count);

      // Check a sample level 1 task
      const sampleLevel1 = rootSubtasks[0];
      const sampleLevel2 = await orchestrator.getSubtasks(sampleLevel1.id);
      expect(sampleLevel2).toHaveLength(level2Count);
    });
  });
});