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

describe('Subtask Decomposition Comprehensive Tests', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-subtask-comp-test-'));

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'test-project',
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

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty subtask definitions array', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent task with no subtasks',
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

    it('should handle subtask creation with missing optional fields', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent task',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Minimal subtask' }, // Only required field
      ]);

      expect(subtasks).toHaveLength(1);
      expect(subtasks[0].description).toBe('Minimal subtask');
      expect(subtasks[0].parentTaskId).toBe(parentTask.id);
      expect(subtasks[0].acceptanceCriteria).toBeUndefined();
    });

    it('should handle large numbers of subtasks', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent with many subtasks',
      });

      const subtaskDefinitions = Array.from({ length: 50 }, (_, i) => ({
        description: `Subtask ${i + 1}`,
      }));

      const subtasks = await orchestrator.decomposeTask(parentTask.id, subtaskDefinitions);

      expect(subtasks).toHaveLength(50);

      const updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskIds).toHaveLength(50);
    });

    it('should prevent duplicate decomposition of the same task', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent task',
      });

      // First decomposition
      const firstSubtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'First subtask' },
      ]);
      expect(firstSubtasks).toHaveLength(1);

      // Attempt second decomposition should return empty array
      const secondSubtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Second subtask' },
      ]);
      expect(secondSubtasks).toEqual([]);

      // Parent should still have only the first subtask
      const updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskIds).toHaveLength(1);
    });
  });

  describe('Helper Methods Comprehensive Testing', () => {
    let parentTask: any;
    let subtasks: any[];

    beforeEach(async () => {
      parentTask = await orchestrator.createTask({
        description: 'Test parent task',
      });

      subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Test subtask 1' },
        { description: 'Test subtask 2' },
        { description: 'Test subtask 3' },
      ]);
    });

    it('getSubtasks should return empty array for task with no subtasks', async () => {
      const taskWithoutSubtasks = await orchestrator.createTask({
        description: 'Task without subtasks',
      });

      const result = await orchestrator.getSubtasks(taskWithoutSubtasks.id);
      expect(result).toEqual([]);
    });

    it('getSubtasks should handle non-existent parent task', async () => {
      const result = await orchestrator.getSubtasks('non-existent-id');
      expect(result).toEqual([]);
    });

    it('getParentTask should return null for task without parent', async () => {
      const result = await orchestrator.getParentTask(parentTask.id);
      expect(result).toBeNull();
    });

    it('getParentTask should return null for non-existent task', async () => {
      const result = await orchestrator.getParentTask('non-existent-id');
      expect(result).toBeNull();
    });

    it('isSubtask should return false for non-existent task', async () => {
      const result = await orchestrator.isSubtask('non-existent-id');
      expect(result).toBe(false);
    });

    it('hasSubtasks should return false for non-existent task', async () => {
      const result = await orchestrator.hasSubtasks('non-existent-id');
      expect(result).toBe(false);
    });

    it('getSubtaskStatus should provide comprehensive status overview', async () => {
      const status = await orchestrator.getSubtaskStatus(parentTask.id);

      expect(status.total).toBe(3);
      expect(status.pending).toBe(3);
      expect(status.completed).toBe(0);
      expect(status.failed).toBe(0);
      expect(status.inProgress).toBe(0);
    });

    it('should handle orphaned subtask IDs gracefully', async () => {
      // Simulate a subtask that was deleted but ID remains in parent
      const corruptedParent = await orchestrator.createTask({
        description: 'Corrupted parent',
      });

      // Manually add a non-existent subtask ID (simulating data corruption)
      await (orchestrator as any).store.updateTask(corruptedParent.id, {
        subtaskIds: ['non-existent-subtask-id'],
      });

      const subtasks = await orchestrator.getSubtasks(corruptedParent.id);
      expect(subtasks).toEqual([]); // Should filter out non-existent subtasks
    });
  });

  describe('Subtask Strategy Implementation', () => {
    it('should correctly set and retrieve subtask strategy', async () => {
      const strategies: ('sequential' | 'parallel' | 'dependency-based')[] =
        ['sequential', 'parallel', 'dependency-based'];

      for (const strategy of strategies) {
        const parentTask = await orchestrator.createTask({
          description: `Parent with ${strategy} strategy`,
        });

        await orchestrator.decomposeTask(parentTask.id, [
          { description: `Task for ${strategy}` },
        ], strategy);

        const updatedParent = await orchestrator.getTask(parentTask.id);
        expect(updatedParent?.subtaskStrategy).toBe(strategy);
      }
    });

    it('should default to sequential strategy when none specified', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent with default strategy',
      });

      await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Default strategy task' },
      ]);

      const updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskStrategy).toBe('sequential');
    });
  });

  describe('Complex Dependency Scenarios', () => {
    it('should handle circular dependency prevention', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent with circular deps',
      });

      // Create subtasks with circular dependencies
      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        {
          description: 'Task A',
          dependsOn: ['Task B'] // Will depend on task created later
        },
        {
          description: 'Task B',
          dependsOn: ['Task A'] // Circular dependency
        },
      ]);

      expect(subtasks).toHaveLength(2);

      // Both tasks should be created despite circular dependency
      // (Implementation should handle this gracefully)
      const taskA = subtasks.find(t => t.description === 'Task A');
      const taskB = subtasks.find(t => t.description === 'Task B');

      expect(taskA).toBeDefined();
      expect(taskB).toBeDefined();
    });

    it('should handle complex multi-level dependencies', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent with complex deps',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Foundation Task' },
        {
          description: 'Build Task',
          dependsOn: ['Foundation Task']
        },
        {
          description: 'Test Task',
          dependsOn: ['Build Task']
        },
        {
          description: 'Deploy Task',
          dependsOn: ['Build Task', 'Test Task']
        },
      ]);

      expect(subtasks).toHaveLength(4);

      // Verify dependency resolution
      const deployTask = subtasks.find(t => t.description === 'Deploy Task');
      const updatedDeployTask = await orchestrator.getTask(deployTask!.id);

      // Should have dependencies on both Build and Test tasks
      expect(updatedDeployTask?.dependsOn).toHaveLength(2);
    });

    it('should handle missing dependency references gracefully', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent with missing deps',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        {
          description: 'Dependent Task',
          dependsOn: ['Non-existent Task']
        },
      ]);

      expect(subtasks).toHaveLength(1);

      // Task should be created despite missing dependency
      const dependentTask = await orchestrator.getTask(subtasks[0].id);
      expect(dependentTask?.dependsOn).toEqual([]); // Should filter out non-existent deps
    });
  });

  describe('Subtask Completion Logic', () => {
    it('should correctly aggregate completion status', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent for completion testing',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Completion test 1' },
        { description: 'Completion test 2' },
        { description: 'Completion test 3' },
      ]);

      // Initially all incomplete
      const initialStatus = await (orchestrator as any).aggregateSubtaskResults(parentTask.id);
      expect(initialStatus).toBe(false);

      // Mark some as complete (simulate by updating status)
      await (orchestrator as any).store.updateTask(subtasks[0].id, { status: 'completed' });
      await (orchestrator as any).store.updateTask(subtasks[1].id, { status: 'completed' });

      const partialStatus = await (orchestrator as any).aggregateSubtaskResults(parentTask.id);
      expect(partialStatus).toBe(false); // Still one pending

      // Mark last as complete
      await (orchestrator as any).store.updateTask(subtasks[2].id, { status: 'completed' });

      const finalStatus = await (orchestrator as any).aggregateSubtaskResults(parentTask.id);
      expect(finalStatus).toBe(true); // All complete
    });

    it('should handle mixed subtask completion statuses', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent with mixed subtask states',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Failed subtask' },
        { description: 'Completed subtask' },
        { description: 'Pending subtask' },
        { description: 'In-progress subtask' },
      ]);

      // Set various statuses
      await (orchestrator as any).store.updateTask(subtasks[0].id, { status: 'failed' });
      await (orchestrator as any).store.updateTask(subtasks[1].id, { status: 'completed' });
      await (orchestrator as any).store.updateTask(subtasks[2].id, { status: 'pending' });
      await (orchestrator as any).store.updateTask(subtasks[3].id, { status: 'in-progress' });

      const status = await orchestrator.getSubtaskStatus(parentTask.id);

      expect(status.total).toBe(4);
      expect(status.failed).toBe(1);
      expect(status.completed).toBe(1);
      expect(status.pending).toBe(1);
      expect(status.inProgress).toBe(1);
    });
  });

  describe('Nested Subtask Scenarios', () => {
    it('should support subtasks having their own subtasks', async () => {
      // Create parent task
      const parentTask = await orchestrator.createTask({
        description: 'Top-level parent',
      });

      // Create first level subtasks
      const level1Subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Level 1 Subtask A' },
        { description: 'Level 1 Subtask B' },
      ]);

      // Create second level subtasks under first subtask
      const level2Subtasks = await orchestrator.decomposeTask(level1Subtasks[0].id, [
        { description: 'Level 2 Subtask A1' },
        { description: 'Level 2 Subtask A2' },
      ]);

      // Verify hierarchy structure
      expect(level2Subtasks).toHaveLength(2);
      expect(level2Subtasks[0].parentTaskId).toBe(level1Subtasks[0].id);

      // Verify level 1 subtask now has its own subtasks
      const updatedLevel1 = await orchestrator.getTask(level1Subtasks[0].id);
      expect(updatedLevel1?.subtaskIds).toHaveLength(2);

      // Verify hierarchy queries
      expect(await orchestrator.isSubtask(level2Subtasks[0].id)).toBe(true);
      expect(await orchestrator.hasSubtasks(level1Subtasks[0].id)).toBe(true);

      const parent = await orchestrator.getParentTask(level2Subtasks[0].id);
      expect(parent?.id).toBe(level1Subtasks[0].id);
    });

    it('should handle deep nesting gracefully', async () => {
      let currentParentId = (await orchestrator.createTask({
        description: 'Root task',
      })).id;

      // Create 5 levels of nesting
      for (let level = 1; level <= 5; level++) {
        const subtasks = await orchestrator.decomposeTask(currentParentId, [
          { description: `Level ${level} task` }
        ]);
        currentParentId = subtasks[0].id;
      }

      // Verify the deepest task is correctly identified as a subtask
      expect(await orchestrator.isSubtask(currentParentId)).toBe(true);

      // Walk back up the hierarchy
      let current = await orchestrator.getTask(currentParentId);
      let levels = 0;

      while (current?.parentTaskId) {
        current = await orchestrator.getParentTask(current.id);
        levels++;
      }

      expect(levels).toBe(5); // Should traverse 5 levels up
    });
  });
});