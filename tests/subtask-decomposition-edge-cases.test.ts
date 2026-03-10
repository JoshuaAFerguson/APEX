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

describe('Subtask Decomposition Edge Cases and Workflow Tests', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-edge-case-test-'));

    await initializeApex(testDir, {
      projectName: 'edge-case-test-project',
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

  describe('Subtask Creation Edge Cases', () => {
    it('should handle empty subtask definitions array', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent with no subtasks',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, []);

      expect(subtasks).toEqual([]);

      const updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskIds).toEqual([]);
    });

    it('should throw error for non-existent parent task', async () => {
      await expect(
        orchestrator.decomposeTask('non-existent-id', [
          { description: 'Test subtask' }
        ])
      ).rejects.toThrow('Parent task not found: non-existent-id');
    });

    it('should handle subtask creation with all optional fields', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent task',
        priority: 'high' as const,
        effort: 'large' as const
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        {
          description: 'Complete subtask with all fields',
          acceptanceCriteria: 'Should complete with all criteria met',
          priority: 'high',
          effort: 'small',
          dependsOn: []
        }
      ]);

      expect(subtasks).toHaveLength(1);
      const subtask = subtasks[0];
      expect(subtask.description).toBe('Complete subtask with all fields');
      expect(subtask.acceptanceCriteria).toBe('Should complete with all criteria met');
      expect(subtask.priority).toBe('high');
      expect(subtask.effort).toBe('small');
      expect(subtask.parentTaskId).toBe(parentTask.id);
    });

    it('should handle concurrent decomposition attempts', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Concurrent decomposition parent',
      });

      // Attempt concurrent decompositions
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
        }
      }

      expect(successCount).toBe(1); // Only one decomposition should succeed
      expect(emptyCount).toBe(2); // Others should return empty arrays

      // Verify final state
      const finalParent = await orchestrator.getTask(parentTask.id);
      expect(finalParent?.subtaskIds).toHaveLength(1);
    });
  });

  describe('Subtask Execution Flow Edge Cases', () => {
    it('should handle mixed subtask statuses during parent completion', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent with mixed subtask statuses',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Completed subtask' },
        { description: 'Failed subtask' },
        { description: 'Cancelled subtask' },
        { description: 'Pending subtask' },
      ]);

      // Set various statuses
      await (orchestrator as any).store.updateTask(subtasks[0].id, { status: 'completed' });
      await (orchestrator as any).store.updateTask(subtasks[1].id, { status: 'failed' });
      await (orchestrator as any).store.updateTask(subtasks[2].id, { status: 'cancelled' });
      // subtasks[3] remains pending

      const status = await orchestrator.getSubtaskStatus(parentTask.id);
      expect(status.total).toBe(4);
      expect(status.completed).toBe(1);
      expect(status.failed).toBe(1);
      expect(status.pending).toBe(1);
      expect(status.inProgress).toBe(0);

      // Parent should not complete due to mixed statuses
      const aggregateResult = await (orchestrator as any).aggregateSubtaskResults(parentTask.id);
      expect(aggregateResult).toBe(false);
    });

    it('should properly handle subtask execution with no dependencies', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent for no-dependency test',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Independent subtask 1' },
        { description: 'Independent subtask 2' },
        { description: 'Independent subtask 3' },
      ], 'parallel');

      // All subtasks should have no dependencies
      for (const subtask of subtasks) {
        expect(subtask.dependsOn || []).toEqual([]);
      }

      // Test execution flow
      const hasSubtasks = await orchestrator.hasSubtasks(parentTask.id);
      expect(hasSubtasks).toBe(true);

      const retrievedSubtasks = await orchestrator.getSubtasks(parentTask.id);
      expect(retrievedSubtasks).toHaveLength(3);
    });

    it('should handle subtask pause and resume correctly', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent for pause/resume test',
      });

      await (orchestrator as any).updateTaskStatus(parentTask.id, 'in-progress');

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Pausable subtask 1' },
        { description: 'Pausable subtask 2' },
      ]);

      // Start one subtask
      await (orchestrator as any).updateTaskStatus(subtasks[0].id, 'in-progress');

      // Pause the subtask
      await orchestrator.pauseTask(subtasks[0].id, 'Manual pause for testing');

      // Check that parent is also paused
      let currentParent = await orchestrator.getTask(parentTask.id);
      expect(currentParent?.status).toBe('paused');

      // Resume the subtask
      await orchestrator.resumeTask(subtasks[0].id);

      // Check that parent can also resume
      currentParent = await orchestrator.getTask(parentTask.id);
      expect(['in-progress', 'paused']).toContain(currentParent?.status);
    });
  });

  describe('Subtask Helper Methods Edge Cases', () => {
    it('should return empty array for getSubtasks with non-existent parent', async () => {
      const result = await orchestrator.getSubtasks('non-existent-id');
      expect(result).toEqual([]);
    });

    it('should return null for getParentTask with non-existent subtask', async () => {
      const result = await orchestrator.getParentTask('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return false for isSubtask with non-existent task', async () => {
      const result = await orchestrator.isSubtask('non-existent-id');
      expect(result).toBe(false);
    });

    it('should return false for hasSubtasks with non-existent task', async () => {
      const result = await orchestrator.hasSubtasks('non-existent-id');
      expect(result).toBe(false);
    });

    it('should handle orphaned subtask IDs gracefully', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent for orphan test',
      });

      // Create a valid subtask first
      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Valid subtask' }
      ]);

      // Manually add non-existent subtask ID to parent (simulate corruption)
      const currentSubtaskIds = subtasks.map(s => s.id);
      await (orchestrator as any).store.updateTask(parentTask.id, {
        subtaskIds: [...currentSubtaskIds, 'non-existent-subtask-id'],
      });

      // getSubtasks should filter out non-existent subtasks
      const retrievedSubtasks = await orchestrator.getSubtasks(parentTask.id);
      expect(retrievedSubtasks).toHaveLength(1);
      expect(retrievedSubtasks[0].id).toBe(subtasks[0].id);
    });

    it('should handle getSubtaskStatus with mixed subtask states', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent for status test',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Completed subtask' },
        { description: 'Failed subtask' },
        { description: 'Pending subtask' },
        { description: 'In-progress subtask' },
        { description: 'Cancelled subtask' },
      ]);

      // Set various statuses
      await (orchestrator as any).store.updateTask(subtasks[0].id, { status: 'completed' });
      await (orchestrator as any).store.updateTask(subtasks[1].id, { status: 'failed' });
      await (orchestrator as any).store.updateTask(subtasks[2].id, { status: 'pending' });
      await (orchestrator as any).store.updateTask(subtasks[3].id, { status: 'in-progress' });
      await (orchestrator as any).store.updateTask(subtasks[4].id, { status: 'cancelled' });

      const status = await orchestrator.getSubtaskStatus(parentTask.id);

      expect(status.total).toBe(5);
      expect(status.completed).toBe(1);
      expect(status.failed).toBe(1);
      expect(status.pending).toBe(1);
      expect(status.inProgress).toBe(1);
      // Note: cancelled tasks are not tracked in the status summary
    });
  });

  describe('Multi-Level Hierarchy Edge Cases', () => {
    it('should handle deep nesting and maintain integrity', async () => {
      // Create a 4-level hierarchy
      const rootTask = await orchestrator.createTask({
        description: 'Root task for deep nesting',
      });

      const level1Tasks = await orchestrator.decomposeTask(rootTask.id, [
        { description: 'Level 1 Task' }
      ]);

      const level2Tasks = await orchestrator.decomposeTask(level1Tasks[0].id, [
        { description: 'Level 2 Task' }
      ]);

      const level3Tasks = await orchestrator.decomposeTask(level2Tasks[0].id, [
        { description: 'Level 3 Task' }
      ]);

      // Verify hierarchy integrity
      expect(await orchestrator.isSubtask(rootTask.id)).toBe(false);
      expect(await orchestrator.hasSubtasks(rootTask.id)).toBe(true);

      expect(await orchestrator.isSubtask(level1Tasks[0].id)).toBe(true);
      expect(await orchestrator.hasSubtasks(level1Tasks[0].id)).toBe(true);

      expect(await orchestrator.isSubtask(level2Tasks[0].id)).toBe(true);
      expect(await orchestrator.hasSubtasks(level2Tasks[0].id)).toBe(true);

      expect(await orchestrator.isSubtask(level3Tasks[0].id)).toBe(true);
      expect(await orchestrator.hasSubtasks(level3Tasks[0].id)).toBe(false);

      // Walk up the hierarchy
      let currentParent = await orchestrator.getParentTask(level3Tasks[0].id);
      expect(currentParent?.id).toBe(level2Tasks[0].id);

      currentParent = await orchestrator.getParentTask(level2Tasks[0].id);
      expect(currentParent?.id).toBe(level1Tasks[0].id);

      currentParent = await orchestrator.getParentTask(level1Tasks[0].id);
      expect(currentParent?.id).toBe(rootTask.id);

      currentParent = await orchestrator.getParentTask(rootTask.id);
      expect(currentParent).toBeNull();
    });

    it('should handle cascading completion through multiple levels', async () => {
      // Create 3-level hierarchy
      const rootTask = await orchestrator.createTask({
        description: 'Root for cascading completion',
      });

      const level1Tasks = await orchestrator.decomposeTask(rootTask.id, [
        { description: 'Level 1 Task A' },
        { description: 'Level 1 Task B' },
      ]);

      const level2Tasks = await orchestrator.decomposeTask(level1Tasks[0].id, [
        { description: 'Level 2 Task A1' },
        { description: 'Level 2 Task A2' },
      ]);

      // Complete all leaf tasks
      await (orchestrator as any).store.updateTask(level1Tasks[1].id, {
        status: 'completed',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.01, totalCostCents: 1, executionTimeMs: 1000 }
      });
      await (orchestrator as any).store.updateTask(level2Tasks[0].id, {
        status: 'completed',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.01, totalCostCents: 1, executionTimeMs: 1000 }
      });
      await (orchestrator as any).store.updateTask(level2Tasks[1].id, {
        status: 'completed',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.01, totalCostCents: 1, executionTimeMs: 1000 }
      });

      // Level 1 Task A should now be completable
      const level1AResult = await (orchestrator as any).aggregateSubtaskResults(level1Tasks[0].id);
      expect(level1AResult).toBe(true);

      // Manually complete Level 1 Task A
      await (orchestrator as any).store.updateTask(level1Tasks[0].id, {
        status: 'completed',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.01, totalCostCents: 1, executionTimeMs: 1000 }
      });

      // Root task should now be completable
      const rootResult = await (orchestrator as any).aggregateSubtaskResults(rootTask.id);
      expect(rootResult).toBe(true);
    });
  });

  describe('Resource and Performance Edge Cases', () => {
    it('should handle large numbers of subtasks efficiently', async () => {
      const startTime = Date.now();

      const parentTask = await orchestrator.createTask({
        description: 'Parent with many subtasks',
      });

      const subtaskCount = 100;
      const subtaskDefinitions = Array.from({ length: subtaskCount }, (_, i) => ({
        description: `Bulk subtask ${i + 1}`,
      }));

      const subtasks = await orchestrator.decomposeTask(parentTask.id, subtaskDefinitions);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(subtasks).toHaveLength(subtaskCount);
      expect(executionTime).toBeLessThan(5000); // Should complete in under 5 seconds

      const updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskIds).toHaveLength(subtaskCount);
    });

    it('should handle resource aggregation with missing usage data', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent for resource aggregation test',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Subtask with usage' },
        { description: 'Subtask without usage' },
      ]);

      // Add usage data to only one subtask
      await (orchestrator as any).store.updateTask(subtasks[0].id, {
        status: 'completed',
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 0.15,
          totalCostCents: 15,
          executionTimeMs: 5000,
        },
      });

      // Complete second subtask without usage data
      await (orchestrator as any).store.updateTask(subtasks[1].id, {
        status: 'completed',
        // No usage data
      });

      // Aggregation should handle missing usage data gracefully
      const aggregated = await (orchestrator as any).aggregateSubtaskResults(parentTask.id);
      expect(typeof aggregated).toBe('boolean');
      expect(aggregated).toBe(true); // Both subtasks are complete
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle database errors gracefully during decomposition', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent for error handling test',
      });

      // Create a spy to simulate database failure
      const originalGetTask = orchestrator.store.getTask;
      vi.spyOn(orchestrator.store, 'getTask').mockImplementation(async (taskId: string) => {
        if (taskId === parentTask.id) {
          throw new Error('Simulated database error');
        }
        return originalGetTask.call(orchestrator.store, taskId);
      });

      await expect(
        orchestrator.decomposeTask(parentTask.id, [{ description: 'Test subtask' }])
      ).rejects.toThrow('Simulated database error');

      // Restore original method
      vi.restoreAllMocks();
    });

    it('should handle invalid strategy gracefully', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent for invalid strategy test',
      });

      // TypeScript should prevent this, but test runtime handling
      const subtasks = await orchestrator.decomposeTask(
        parentTask.id,
        [{ description: 'Strategy test subtask' }],
        'invalid-strategy' as any
      );

      expect(subtasks).toHaveLength(1);

      // Verify the task was created despite invalid strategy
      const updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskStrategy).toBe('invalid-strategy');
    });
  });
});