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

describe('Subtask Decomposition Acceptance Criteria Tests', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-acceptance-test-'));

    await initializeApex(testDir, {
      projectName: 'acceptance-test-project',
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

  describe('Acceptance Criteria 1: subtaskIds and parentTaskId fields exist', () => {
    it('should ensure parent task has subtaskIds array field', async () => {
      // Create parent task
      const parentTask = await orchestrator.createTask({
        description: 'Parent task for field validation',
      });

      // Verify subtaskIds field exists and is empty initially
      expect(parentTask.subtaskIds).toBeDefined();
      expect(Array.isArray(parentTask.subtaskIds)).toBe(true);
      expect(parentTask.subtaskIds).toEqual([]);
    });

    it('should ensure subtask has parentTaskId field', async () => {
      // Create parent task
      const parentTask = await orchestrator.createTask({
        description: 'Parent task for field validation',
      });

      // Create subtasks
      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Subtask with parent ID' }
      ]);

      // Verify parentTaskId field exists and is correctly set
      expect(subtasks[0].parentTaskId).toBeDefined();
      expect(subtasks[0].parentTaskId).toBe(parentTask.id);
    });

    it('should maintain field consistency during subtask creation', async () => {
      // Create parent task
      const parentTask = await orchestrator.createTask({
        description: 'Parent task for consistency validation',
      });

      // Create subtasks
      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Consistency subtask 1' },
        { description: 'Consistency subtask 2' },
        { description: 'Consistency subtask 3' }
      ]);

      // Verify parent's subtaskIds are updated
      const updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskIds).toHaveLength(3);
      expect(updatedParent?.subtaskIds).toEqual(subtasks.map(s => s.id));

      // Verify each subtask has correct parentTaskId
      for (const subtask of subtasks) {
        expect(subtask.parentTaskId).toBe(parentTask.id);

        // Also verify by fetching from store
        const storedSubtask = await orchestrator.getTask(subtask.id);
        expect(storedSubtask?.parentTaskId).toBe(parentTask.id);
      }
    });

    it('should handle field validation for non-parent tasks', async () => {
      // Create regular task (not parent, not subtask)
      const regularTask = await orchestrator.createTask({
        description: 'Regular standalone task',
      });

      // Verify fields for non-parent task
      expect(regularTask.subtaskIds).toEqual([]);
      expect(regularTask.parentTaskId).toBeUndefined();
    });
  });

  describe('Acceptance Criteria 2: subtask creation flow works', () => {
    it('should successfully create subtasks via decomposition', async () => {
      // Create parent task
      const parentTask = await orchestrator.createTask({
        description: 'Parent for creation flow test',
      });

      // Define subtasks
      const subtaskDefinitions = [
        { description: 'First subtask', acceptanceCriteria: 'Should complete task 1' },
        { description: 'Second subtask', priority: 'high' as const },
        { description: 'Third subtask', effort: 'small' as const }
      ];

      // Create subtasks
      const subtasks = await orchestrator.decomposeTask(parentTask.id, subtaskDefinitions);

      // Verify subtasks were created
      expect(subtasks).toHaveLength(3);
      expect(subtasks[0].description).toBe('First subtask');
      expect(subtasks[0].acceptanceCriteria).toBe('Should complete task 1');
      expect(subtasks[1].priority).toBe('high');
      expect(subtasks[2].effort).toBe('small');

      // Verify each subtask can be retrieved from store
      for (const subtask of subtasks) {
        const stored = await orchestrator.getTask(subtask.id);
        expect(stored).toBeDefined();
        expect(stored?.description).toBe(subtask.description);
        expect(stored?.parentTaskId).toBe(parentTask.id);
      }
    });

    it('should emit correct events during subtask creation', async () => {
      // Set up event listeners
      const subtaskCreatedEvents: Array<{ subtask: any; parentId: string }> = [];
      const taskDecomposedEvents: Array<{ task: any; subtaskIds: string[] }> = [];

      orchestrator.on('subtask:created', (subtask, parentId) => {
        subtaskCreatedEvents.push({ subtask, parentId });
      });

      orchestrator.on('task:decomposed', (task, subtaskIds) => {
        taskDecomposedEvents.push({ task, subtaskIds });
      });

      // Create parent task
      const parentTask = await orchestrator.createTask({
        description: 'Parent for event testing',
      });

      // Create subtasks
      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Event test subtask 1' },
        { description: 'Event test subtask 2' }
      ]);

      // Verify events were emitted
      expect(subtaskCreatedEvents).toHaveLength(2);
      expect(taskDecomposedEvents).toHaveLength(1);

      // Verify event data
      expect(subtaskCreatedEvents[0].parentId).toBe(parentTask.id);
      expect(subtaskCreatedEvents[1].parentId).toBe(parentTask.id);
      expect(taskDecomposedEvents[0].subtaskIds).toEqual(subtasks.map(s => s.id));
    });

    it('should prevent duplicate subtask creation', async () => {
      // Create parent task
      const parentTask = await orchestrator.createTask({
        description: 'Parent for duplicate prevention test',
      });

      // First decomposition
      const firstSubtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'First decomposition subtask' }
      ]);

      expect(firstSubtasks).toHaveLength(1);

      // Second decomposition attempt should be prevented
      const secondSubtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Second decomposition subtask' }
      ]);

      expect(secondSubtasks).toEqual([]); // Should return empty array

      // Verify parent only has the first subtask
      const updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskIds).toHaveLength(1);
      expect(updatedParent?.subtaskIds).toEqual([firstSubtasks[0].id]);
    });

    it('should handle inheritance from parent task correctly', async () => {
      // Create parent with specific properties
      const parentTask = await orchestrator.createTask({
        description: 'Parent with properties for inheritance test',
        workflow: 'comprehensive',
        priority: 'high' as const,
        effort: 'large' as const,
        autonomy: 'review-all' as const
      });

      // Create subtasks
      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Inheritance test subtask' }
      ]);

      const subtask = subtasks[0];

      // Verify inheritance
      expect(subtask.workflow).toBe(parentTask.workflow);
      expect(subtask.priority).toBe(parentTask.priority);
      expect(subtask.effort).toBe(parentTask.effort);
      expect(subtask.autonomy).toBe(parentTask.autonomy);
      expect(subtask.projectPath).toBe(parentTask.projectPath);
    });
  });

  describe('Acceptance Criteria 3: parent waits for subtask completion', () => {
    it('should keep parent in-progress while subtasks are pending', async () => {
      // Create parent task
      const parentTask = await orchestrator.createTask({
        description: 'Parent for waiting test',
      });

      // Set parent to in-progress
      await (orchestrator as any).updateTaskStatus(parentTask.id, 'in-progress');

      // Create subtasks
      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Waiting test subtask 1' },
        { description: 'Waiting test subtask 2' }
      ]);

      // Verify parent is still in-progress
      let currentParent = await orchestrator.getTask(parentTask.id);
      expect(currentParent?.status).toBe('in-progress');

      // Complete first subtask
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

      // Parent should still be in-progress (one subtask still pending)
      currentParent = await orchestrator.getTask(parentTask.id);
      expect(currentParent?.status).toBe('in-progress');

      // Complete second subtask
      await (orchestrator as any).updateTaskStatus(subtasks[1].id, 'completed');
      await (orchestrator as any).store.updateTask(subtasks[1].id, {
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.01,
          totalCostCents: 1,
          executionTimeMs: 1000,
        }
      });

      // Now parent should be completed
      currentParent = await orchestrator.getTask(parentTask.id);
      expect(currentParent?.status).toBe('completed');
    });

    it('should not complete parent if any subtask fails', async () => {
      // Create parent task
      const parentTask = await orchestrator.createTask({
        description: 'Parent for failure handling test',
      });

      // Set parent to in-progress
      await (orchestrator as any).updateTaskStatus(parentTask.id, 'in-progress');

      // Create subtasks
      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Success subtask' },
        { description: 'Failure subtask' }
      ]);

      // Complete first subtask successfully
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

      // Fail second subtask
      await (orchestrator as any).updateTaskStatus(subtasks[1].id, 'failed');

      // Parent should not be completed due to failed subtask
      const currentParent = await orchestrator.getTask(parentTask.id);
      expect(currentParent?.status).toBe('in-progress');
    });

    it('should properly aggregate subtask results before completion', async () => {
      // Create parent task
      const parentTask = await orchestrator.createTask({
        description: 'Parent for aggregation test',
      });

      // Create subtasks
      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Aggregation subtask 1' },
        { description: 'Aggregation subtask 2' },
        { description: 'Aggregation subtask 3' }
      ]);

      // Test aggregation with all pending
      let aggregationResult = await (orchestrator as any).aggregateSubtaskResults(parentTask.id);
      expect(aggregationResult).toBe(false);

      // Complete first two subtasks
      for (let i = 0; i < 2; i++) {
        await (orchestrator as any).updateTaskStatus(subtasks[i].id, 'completed');
        await (orchestrator as any).store.updateTask(subtasks[i].id, {
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            estimatedCost: 0.01,
            totalCostCents: 1,
            executionTimeMs: 1000,
          }
        });
      }

      // Aggregation should still return false (one pending)
      aggregationResult = await (orchestrator as any).aggregateSubtaskResults(parentTask.id);
      expect(aggregationResult).toBe(false);

      // Complete last subtask
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

      // Now aggregation should return true (all complete)
      aggregationResult = await (orchestrator as any).aggregateSubtaskResults(parentTask.id);
      expect(aggregationResult).toBe(true);
    });

    it('should handle concurrent subtask completion correctly', async () => {
      // Create parent task
      const parentTask = await orchestrator.createTask({
        description: 'Parent for concurrent completion test',
      });

      // Set parent to in-progress
      await (orchestrator as any).updateTaskStatus(parentTask.id, 'in-progress');

      // Create subtasks
      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Concurrent subtask 1' },
        { description: 'Concurrent subtask 2' },
        { description: 'Concurrent subtask 3' }
      ]);

      // Complete all subtasks concurrently
      const completionPromises = subtasks.map(async (subtask, index) => {
        // Add slight delay to simulate real concurrent operations
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50));

        await (orchestrator as any).updateTaskStatus(subtask.id, 'completed');
        await (orchestrator as any).store.updateTask(subtask.id, {
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            estimatedCost: 0.01,
            totalCostCents: 1,
            executionTimeMs: 1000,
          }
        });
      });

      await Promise.all(completionPromises);

      // Verify parent is completed
      const currentParent = await orchestrator.getTask(parentTask.id);
      expect(currentParent?.status).toBe('completed');
    });
  });

  describe('Acceptance Criteria 4: subtaskStrategy (sequential/parallel) support', () => {
    it('should support sequential strategy', async () => {
      // Create parent task
      const parentTask = await orchestrator.createTask({
        description: 'Parent for sequential strategy test',
      });

      // Create subtasks with sequential strategy
      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Sequential subtask 1' },
        { description: 'Sequential subtask 2' },
        { description: 'Sequential subtask 3' }
      ], 'sequential');

      // Verify strategy was set
      const updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskStrategy).toBe('sequential');

      // Verify subtasks were created
      expect(subtasks).toHaveLength(3);
    });

    it('should support parallel strategy', async () => {
      // Create parent task
      const parentTask = await orchestrator.createTask({
        description: 'Parent for parallel strategy test',
      });

      // Create subtasks with parallel strategy
      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Parallel subtask 1' },
        { description: 'Parallel subtask 2' },
        { description: 'Parallel subtask 3' }
      ], 'parallel');

      // Verify strategy was set
      const updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskStrategy).toBe('parallel');

      // Verify subtasks were created
      expect(subtasks).toHaveLength(3);
    });

    it('should support dependency-based strategy', async () => {
      // Create parent task
      const parentTask = await orchestrator.createTask({
        description: 'Parent for dependency-based strategy test',
      });

      // Create subtasks with dependency-based strategy
      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Foundation task' },
        { description: 'Dependent task', dependsOn: ['Foundation task'] },
        { description: 'Final task', dependsOn: ['Dependent task'] }
      ], 'dependency-based');

      // Verify strategy was set
      const updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskStrategy).toBe('dependency-based');

      // Verify subtasks were created with dependencies
      expect(subtasks).toHaveLength(3);

      // Check dependency resolution
      const dependentTask = subtasks.find(t => t.description === 'Dependent task');
      const foundationTask = subtasks.find(t => t.description === 'Foundation task');

      const storedDependentTask = await orchestrator.getTask(dependentTask!.id);
      expect(storedDependentTask?.dependsOn).toContain(foundationTask!.id);
    });

    it('should default to sequential strategy when none specified', async () => {
      // Create parent task
      const parentTask = await orchestrator.createTask({
        description: 'Parent for default strategy test',
      });

      // Create subtasks without specifying strategy
      await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Default strategy subtask' }
      ]);

      // Verify default strategy was applied
      const updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskStrategy).toBe('sequential');
    });

    it('should maintain strategy during subtask execution', async () => {
      // Create parent task
      const parentTask = await orchestrator.createTask({
        description: 'Parent for strategy persistence test',
      });

      // Create subtasks with parallel strategy
      await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Persistence test subtask 1' },
        { description: 'Persistence test subtask 2' }
      ], 'parallel');

      // Verify strategy persists
      let updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskStrategy).toBe('parallel');

      // Get subtasks and verify strategy is maintained
      const subtasks = await orchestrator.getSubtasks(parentTask.id);
      expect(subtasks).toHaveLength(2);

      updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskStrategy).toBe('parallel');
    });
  });

  describe('Integration Tests: All Acceptance Criteria Together', () => {
    it('should satisfy all acceptance criteria in a complete workflow', async () => {
      // Create parent task
      const parentTask = await orchestrator.createTask({
        description: 'Complete workflow integration test',
        priority: 'high',
        effort: 'large'
      });

      // 1. Verify fields exist (Criteria 1)
      expect(parentTask.subtaskIds).toBeDefined();
      expect(Array.isArray(parentTask.subtaskIds)).toBe(true);
      expect(parentTask.subtaskIds).toEqual([]);

      // 2. Create subtasks with strategy (Criteria 2 & 4)
      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Integration subtask 1', acceptanceCriteria: 'Complete setup' },
        { description: 'Integration subtask 2', acceptanceCriteria: 'Execute main logic' },
        { description: 'Integration subtask 3', acceptanceCriteria: 'Cleanup and verify' }
      ], 'parallel');

      // Verify subtask creation worked (Criteria 2)
      expect(subtasks).toHaveLength(3);
      for (const subtask of subtasks) {
        expect(subtask.parentTaskId).toBe(parentTask.id);
      }

      // Verify strategy was applied (Criteria 4)
      const updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskStrategy).toBe('parallel');
      expect(updatedParent?.subtaskIds).toHaveLength(3);

      // 3. Set parent to in-progress and test completion logic (Criteria 3)
      await (orchestrator as any).updateTaskStatus(parentTask.id, 'in-progress');

      // Parent should remain in-progress while subtasks are pending
      let currentParent = await orchestrator.getTask(parentTask.id);
      expect(currentParent?.status).toBe('in-progress');

      // Complete all subtasks
      for (const subtask of subtasks) {
        await (orchestrator as any).updateTaskStatus(subtask.id, 'completed');
        await (orchestrator as any).store.updateTask(subtask.id, {
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            estimatedCost: 0.01,
            totalCostCents: 1,
            executionTimeMs: 1000,
          }
        });
      }

      // Parent should now be completed (Criteria 3)
      currentParent = await orchestrator.getTask(parentTask.id);
      expect(currentParent?.status).toBe('completed');

      // Verify all fields and relationships are maintained
      expect(currentParent?.subtaskIds).toEqual(subtasks.map(s => s.id));
      expect(currentParent?.subtaskStrategy).toBe('parallel');

      for (const subtask of subtasks) {
        const storedSubtask = await orchestrator.getTask(subtask.id);
        expect(storedSubtask?.parentTaskId).toBe(parentTask.id);
        expect(storedSubtask?.status).toBe('completed');
      }
    });
  });
});