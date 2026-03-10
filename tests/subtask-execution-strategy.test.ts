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

describe('Subtask Execution Strategy Tests', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-strategy-test-'));

    await initializeApex(testDir, {
      projectName: 'strategy-test-project',
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

  describe('Sequential Strategy Implementation', () => {
    it('should set sequential strategy correctly', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Sequential parent task',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Sequential task 1' },
        { description: 'Sequential task 2' },
        { description: 'Sequential task 3' },
      ], 'sequential');

      const updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskStrategy).toBe('sequential');
      expect(subtasks).toHaveLength(3);
    });

    it('should use sequential as default strategy', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Default strategy parent',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Default task 1' },
        { description: 'Default task 2' },
      ]);

      const updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskStrategy).toBe('sequential');
    });

    it('should maintain strategy across subtask operations', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Strategy persistence test',
      });

      await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Persistence task 1' },
      ], 'sequential');

      // Check that strategy persists after other operations
      const subtasks = await orchestrator.getSubtasks(parentTask.id);
      expect(subtasks).toHaveLength(1);

      const updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskStrategy).toBe('sequential');
    });
  });

  describe('Parallel Strategy Implementation', () => {
    it('should set parallel strategy correctly', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parallel parent task',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Parallel task 1' },
        { description: 'Parallel task 2' },
        { description: 'Parallel task 3' },
        { description: 'Parallel task 4' },
      ], 'parallel');

      const updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskStrategy).toBe('parallel');
      expect(subtasks).toHaveLength(4);

      // All subtasks should be created without dependencies by default
      for (const subtask of subtasks) {
        expect(subtask.parentTaskId).toBe(parentTask.id);
        expect(subtask.dependsOn || []).toEqual([]);
      }
    });

    it('should handle parallel execution with mixed completion states', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Mixed completion parallel parent',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Fast parallel task' },
        { description: 'Slow parallel task' },
        { description: 'Failed parallel task' },
      ], 'parallel');

      // Simulate different completion states
      await (orchestrator as any).store.updateTask(subtasks[0].id, { status: 'completed' });
      await (orchestrator as any).store.updateTask(subtasks[1].id, { status: 'in-progress' });
      await (orchestrator as any).store.updateTask(subtasks[2].id, { status: 'failed' });

      const status = await orchestrator.getSubtaskStatus(parentTask.id);
      expect(status.total).toBe(3);
      expect(status.completed).toBe(1);
      expect(status.inProgress).toBe(1);
      expect(status.failed).toBe(1);

      // Parent should not be complete yet due to in-progress and failed tasks
      const aggregateResult = await (orchestrator as any).aggregateSubtaskResults(parentTask.id);
      expect(aggregateResult).toBe(false);
    });

    it('should support large numbers of parallel subtasks', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Large parallel batch parent',
      });

      const subtaskCount = 20;
      const subtaskDefinitions = Array.from({ length: subtaskCount }, (_, i) => ({
        description: `Parallel batch task ${i + 1}`,
      }));

      const subtasks = await orchestrator.decomposeTask(
        parentTask.id,
        subtaskDefinitions,
        'parallel'
      );

      expect(subtasks).toHaveLength(subtaskCount);

      const updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskStrategy).toBe('parallel');
      expect(updatedParent?.subtaskIds).toHaveLength(subtaskCount);
    });
  });

  describe('Dependency-Based Strategy Implementation', () => {
    it('should set dependency-based strategy correctly', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Dependency-based parent task',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Foundation task' },
        {
          description: 'Dependent task',
          dependsOn: ['Foundation task']
        },
        {
          description: 'Final task',
          dependsOn: ['Dependent task']
        },
      ], 'dependency-based');

      const updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskStrategy).toBe('dependency-based');
      expect(subtasks).toHaveLength(3);
    });

    it('should resolve dependencies correctly in dependency-based strategy', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Dependency resolution test',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Setup Database' },
        { description: 'Create User Model', dependsOn: ['Setup Database'] },
        { description: 'Create User Controller', dependsOn: ['Create User Model'] },
        {
          description: 'Integration Test',
          dependsOn: ['Create User Controller', 'Setup Database']
        },
      ], 'dependency-based');

      expect(subtasks).toHaveLength(4);

      // Find specific tasks
      const setupTask = subtasks.find(t => t.description === 'Setup Database');
      const modelTask = subtasks.find(t => t.description === 'Create User Model');
      const controllerTask = subtasks.find(t => t.description === 'Create User Controller');
      const testTask = subtasks.find(t => t.description === 'Integration Test');

      // Verify dependency relationships
      const updatedModelTask = await orchestrator.getTask(modelTask!.id);
      expect(updatedModelTask?.dependsOn).toContain(setupTask!.id);

      const updatedControllerTask = await orchestrator.getTask(controllerTask!.id);
      expect(updatedControllerTask?.dependsOn).toContain(modelTask!.id);

      const updatedTestTask = await orchestrator.getTask(testTask!.id);
      expect(updatedTestTask?.dependsOn).toContain(controllerTask!.id);
      expect(updatedTestTask?.dependsOn).toContain(setupTask!.id);
    });

    it('should handle complex dependency graphs', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Complex dependency graph',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Task A' },
        { description: 'Task B' },
        { description: 'Task C', dependsOn: ['Task A'] },
        { description: 'Task D', dependsOn: ['Task B'] },
        { description: 'Task E', dependsOn: ['Task C', 'Task D'] },
        { description: 'Task F', dependsOn: ['Task A', 'Task B', 'Task E'] },
      ], 'dependency-based');

      expect(subtasks).toHaveLength(6);

      // Verify the most complex dependency (Task F)
      const taskF = subtasks.find(t => t.description === 'Task F');
      const taskA = subtasks.find(t => t.description === 'Task A');
      const taskB = subtasks.find(t => t.description === 'Task B');
      const taskE = subtasks.find(t => t.description === 'Task E');

      const updatedTaskF = await orchestrator.getTask(taskF!.id);
      expect(updatedTaskF?.dependsOn).toContain(taskA!.id);
      expect(updatedTaskF?.dependsOn).toContain(taskB!.id);
      expect(updatedTaskF?.dependsOn).toContain(taskE!.id);
    });

    it('should handle missing dependencies gracefully', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Missing dependencies test',
      });

      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Valid task' },
        {
          description: 'Task with missing dep',
          dependsOn: ['Non-existent task', 'Valid task']
        },
      ], 'dependency-based');

      expect(subtasks).toHaveLength(2);

      const validTask = subtasks.find(t => t.description === 'Valid task');
      const dependentTask = subtasks.find(t => t.description === 'Task with missing dep');

      const updatedDependentTask = await orchestrator.getTask(dependentTask!.id);

      // Should only include valid dependencies
      expect(updatedDependentTask?.dependsOn).toContain(validTask!.id);
      expect(updatedDependentTask?.dependsOn).toHaveLength(1);
    });
  });

  describe('Strategy Inheritance and Nested Tasks', () => {
    it('should allow subtasks to have different strategies than parent', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Sequential parent',
      });

      // Create subtasks with sequential strategy
      const level1Subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Level 1 Task A' },
        { description: 'Level 1 Task B' },
      ], 'sequential');

      // Create sub-subtasks with parallel strategy
      const level2Subtasks = await orchestrator.decomposeTask(level1Subtasks[0].id, [
        { description: 'Level 2 Task A1' },
        { description: 'Level 2 Task A2' },
        { description: 'Level 2 Task A3' },
      ], 'parallel');

      // Verify different strategies
      const updatedParent = await orchestrator.getTask(parentTask.id);
      const updatedLevel1 = await orchestrator.getTask(level1Subtasks[0].id);

      expect(updatedParent?.subtaskStrategy).toBe('sequential');
      expect(updatedLevel1?.subtaskStrategy).toBe('parallel');
      expect(level2Subtasks).toHaveLength(3);
    });

    it('should handle strategy changes on existing decomposed tasks', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Strategy change test',
      });

      // Initial decomposition with sequential
      await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Initial task' },
      ], 'sequential');

      let updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskStrategy).toBe('sequential');

      // Attempt second decomposition should be prevented
      const secondDecomposition = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Second task' },
      ], 'parallel');

      expect(secondDecomposition).toEqual([]);

      // Strategy should remain the same
      updatedParent = await orchestrator.getTask(parentTask.id);
      expect(updatedParent?.subtaskStrategy).toBe('sequential');
    });
  });

  describe('Strategy Performance and Scalability', () => {
    it('should handle mixed strategy types efficiently', async () => {
      const testTasks = [];

      // Create multiple parent tasks with different strategies
      for (const strategy of ['sequential', 'parallel', 'dependency-based'] as const) {
        const parentTask = await orchestrator.createTask({
          description: `${strategy} performance test`,
        });

        const subtaskDefinitions = Array.from({ length: 10 }, (_, i) => ({
          description: `${strategy} task ${i + 1}`,
          ...(strategy === 'dependency-based' && i > 0
            ? { dependsOn: [`${strategy} task ${i}`] }
            : {}),
        }));

        const subtasks = await orchestrator.decomposeTask(
          parentTask.id,
          subtaskDefinitions,
          strategy
        );

        testTasks.push({ parentTask, subtasks, strategy });
      }

      // Verify all strategies were applied correctly
      for (const { parentTask, subtasks, strategy } of testTasks) {
        expect(subtasks).toHaveLength(10);

        const updatedParent = await orchestrator.getTask(parentTask.id);
        expect(updatedParent?.subtaskStrategy).toBe(strategy);
      }
    });

    it('should maintain performance with large dependency chains', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Large dependency chain test',
      });

      const chainLength = 50;
      const subtaskDefinitions = Array.from({ length: chainLength }, (_, i) => ({
        description: `Chain task ${i + 1}`,
        ...(i > 0 ? { dependsOn: [`Chain task ${i}`] } : {}),
      }));

      const startTime = Date.now();

      const subtasks = await orchestrator.decomposeTask(
        parentTask.id,
        subtaskDefinitions,
        'dependency-based'
      );

      const executionTime = Date.now() - startTime;

      expect(subtasks).toHaveLength(chainLength);
      expect(executionTime).toBeLessThan(5000); // Should complete in under 5 seconds

      // Verify the chain is properly formed
      const lastTask = subtasks[chainLength - 1];
      const updatedLastTask = await orchestrator.getTask(lastTask.id);

      expect(updatedLastTask?.dependsOn).toHaveLength(1);
    });
  });
});