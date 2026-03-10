import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
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

  const mockSpawn = vi.fn();
  const mockFork = vi.fn();

  return {
    exec: mockExec,
    execFile: mockExecFile,
    spawn: mockSpawn,
    fork: mockFork,
    default: {
      exec: mockExec,
      execFile: mockExecFile,
      spawn: mockSpawn,
      fork: mockFork
    }
  };
});

describe('Subtask Implementation Verification', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-subtask-test-'));

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

  describe('Acceptance Criteria Verification', () => {
    it('1. subtaskIds and parentTaskId fields exist', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent task for verification',
      });

      // Verify initial state
      expect(parentTask.subtaskIds).toBeDefined();
      expect(parentTask.subtaskIds).toEqual([]);
      expect(parentTask.parentTaskId).toBeUndefined();
    });

    it('2. Subtask creation flow works', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Build authentication system',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Create user model' },
        { description: 'Implement login endpoint' },
      ]);

      // Verify subtasks were created
      expect(subtasks).toHaveLength(2);
      expect(subtasks[0].description).toBe('Create user model');
      expect(subtasks[0].parentTaskId).toBe(parentTask.id);
      expect(subtasks[1].description).toBe('Implement login endpoint');
      expect(subtasks[1].parentTaskId).toBe(parentTask.id);

      // Verify parent was updated
      const updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskIds).toHaveLength(2);
      expect(updatedParent?.subtaskIds).toContain(subtasks[0].id);
      expect(updatedParent?.subtaskIds).toContain(subtasks[1].id);
    });

    it('3. Parent waits for subtask completion', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent task that waits',
      });

      await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Subtask 1' },
        { description: 'Subtask 2' },
      ]);

      // Test aggregateSubtaskResults method
      const allComplete = await (orchestrator as any).aggregateSubtaskResults(parentTask.id);
      expect(typeof allComplete).toBe('boolean');
      expect(allComplete).toBe(false); // Subtasks are pending, so should return false
    });

    it('4. subtaskStrategy (sequential/parallel) is supported', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent with strategy',
      });

      // Test sequential strategy (default)
      await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Sequential task 1' },
        { description: 'Sequential task 2' },
      ], 'sequential');

      const updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskStrategy).toBe('sequential');

      // Test with parallel strategy
      const parentTask2 = await orchestrator.createTask({
        description: 'Parent with parallel strategy',
      });

      await orchestrator.decomposeTask(parentTask2.id, [
        { description: 'Parallel task 1' },
        { description: 'Parallel task 2' },
      ], 'parallel');

      const updatedParent2 = await orchestrator.getTask(parentTask2.id);
      expect(updatedParent2?.subtaskStrategy).toBe('parallel');

      // Test with dependency-based strategy
      const parentTask3 = await orchestrator.createTask({
        description: 'Parent with dependency-based strategy',
      });

      await orchestrator.decomposeTask(parentTask3.id, [
        { description: 'Dependency task 1' },
        { description: 'Dependency task 2' },
      ], 'dependency-based');

      const updatedParent3 = await orchestrator.getTask(parentTask3.id);
      expect(updatedParent3?.subtaskStrategy).toBe('dependency-based');
    });

    it('5. Helper methods work correctly', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent task for helper methods',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Helper test subtask' },
      ]);

      // Test getSubtasks
      const retrievedSubtasks = await orchestrator.getSubtasks(parentTask.id);
      expect(retrievedSubtasks).toHaveLength(1);
      expect(retrievedSubtasks[0].id).toBe(subtasks[0].id);

      // Test getParentTask
      const retrievedParent = await orchestrator.getParentTask(subtasks[0].id);
      expect(retrievedParent?.id).toBe(parentTask.id);

      // Test isSubtask
      expect(await orchestrator.isSubtask(parentTask.id)).toBe(false);
      expect(await orchestrator.isSubtask(subtasks[0].id)).toBe(true);

      // Test hasSubtasks
      expect(await orchestrator.hasSubtasks(parentTask.id)).toBe(true);
      expect(await orchestrator.hasSubtasks(subtasks[0].id)).toBe(false);
    });

    it('6. Dependency resolution works', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent with dependencies',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Base task' },
        {
          description: 'Dependent task',
          dependsOn: ['Base task'] // Reference by description
        },
      ]);

      // Verify dependency was resolved
      const dependentTask = subtasks.find(t => t.description === 'Dependent task');
      const baseTask = subtasks.find(t => t.description === 'Base task');

      expect(dependentTask).toBeDefined();
      expect(baseTask).toBeDefined();

      // Re-fetch to get updated dependency info
      const updatedDependentTask = await orchestrator.getTask(dependentTask!.id);
      expect(updatedDependentTask?.dependsOn).toContain(baseTask!.id);
      expect(updatedDependentTask?.blockedBy).toContain(baseTask!.id);
    });
  });
});