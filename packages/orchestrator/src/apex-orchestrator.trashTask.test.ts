/**
 * Unit tests for ApexOrchestrator.trashTask method
 * Tests for task validation, trash operation, and event emission
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { initializeApex } from '@apexcli/core';
import type { Task, TaskStatus } from '@apexcli/core';

// Mock the claude-agent-sdk to prevent actual API calls
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn().mockResolvedValue({
    content: [{ text: 'Mock response' }],
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
  }),
}));

// Mock child_process for git/gh commands
vi.mock('child_process', () => ({
  exec: vi.fn((cmd: string, opts: unknown, callback?: unknown) => {
    if (typeof opts === 'function') {
      callback = opts;
    }
    const cb = callback as (error: Error | null, result?: { stdout: string }) => void;
    cb(null, { stdout: '' });
  }),
}));

describe('ApexOrchestrator.trashTask', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-trash-test-'));

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'test-project',
      language: 'typescript',
      framework: 'node',
    });

    // Create a minimal workflow file
    const workflowContent = `
name: feature
description: Test feature workflow
stages:
  - name: implementation
    agent: developer
    description: Implement the feature
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'feature.yaml'),
      workflowContent
    );

    // Create a minimal agent file
    const developerContent = `---
name: developer
description: Implements code changes
tools: Read, Write, Edit
model: sonnet
---
You are a developer agent.
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'developer.md'),
      developerContent
    );

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('successful trash operations', () => {
    it('should trash a pending task successfully', async () => {
      // Create a task
      const task = await orchestrator.createTask({
        description: 'Test task to trash',
      });

      expect(task.status).toBe('pending');
      expect(task.trashedAt).toBeUndefined();

      // Set up event listener to verify event emission
      const eventPromise = new Promise<Task>((resolve) => {
        orchestrator.once('task:trashed', resolve);
      });

      // Trash the task
      await orchestrator.trashTask(task.id);

      // Verify event was emitted with correct data
      const emittedTask = await eventPromise;
      expect(emittedTask.id).toBe(task.id);
      expect(emittedTask.status).toBe('cancelled');
      expect(emittedTask.trashedAt).toBeDefined();

      // Verify task is trashed in store
      const trashedTask = await orchestrator.store.getTask(task.id);
      expect(trashedTask).not.toBeNull();
      expect(trashedTask!.status).toBe('cancelled');
      expect(trashedTask!.trashedAt).toBeDefined();
      expect(trashedTask!.trashedAt).toBeInstanceOf(Date);
      expect(trashedTask!.updatedAt).toBeDefined();
    });

    it('should trash a completed task successfully', async () => {
      // Create and complete a task
      const task = await orchestrator.createTask({
        description: 'Completed task to trash',
      });

      // Update task to completed status
      await orchestrator.store.updateTask(task.id, {
        status: 'completed',
        updatedAt: new Date(),
      });

      // Trash the completed task
      await orchestrator.trashTask(task.id);

      // Verify task is trashed
      const trashedTask = await orchestrator.store.getTask(task.id);
      expect(trashedTask!.status).toBe('cancelled');
      expect(trashedTask!.trashedAt).toBeDefined();
    });

    it('should trash an in-progress task successfully', async () => {
      // Create a task and set it to in-progress
      const task = await orchestrator.createTask({
        description: 'In-progress task to trash',
      });

      await orchestrator.store.updateTask(task.id, {
        status: 'in-progress',
        updatedAt: new Date(),
      });

      // Trash the in-progress task
      await orchestrator.trashTask(task.id);

      // Verify task is trashed
      const trashedTask = await orchestrator.store.getTask(task.id);
      expect(trashedTask!.status).toBe('cancelled');
      expect(trashedTask!.trashedAt).toBeDefined();
    });

    it('should update the task timestamp when trashed', async () => {
      const task = await orchestrator.createTask({
        description: 'Task to check timestamp update',
      });

      const originalUpdatedAt = task.updatedAt;

      // Add small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await orchestrator.trashTask(task.id);

      const trashedTask = await orchestrator.store.getTask(task.id);
      expect(trashedTask!.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('error handling', () => {
    it('should throw error when task does not exist', async () => {
      const nonExistentTaskId = 'non-existent-task-id';

      await expect(orchestrator.trashTask(nonExistentTaskId)).rejects.toThrow(
        `Task with ID ${nonExistentTaskId} not found`
      );
    });

    it('should throw error when task is already trashed', async () => {
      // Create and trash a task
      const task = await orchestrator.createTask({
        description: 'Task to double trash',
      });

      await orchestrator.trashTask(task.id);

      // Try to trash it again
      await expect(orchestrator.trashTask(task.id)).rejects.toThrow(
        `Task with ID ${task.id} is already in trash`
      );
    });

    it('should throw error when task ID is empty string', async () => {
      await expect(orchestrator.trashTask('')).rejects.toThrow(
        'Task with ID  not found'
      );
    });

    it('should throw error when task ID is null or undefined', async () => {
      // TypeScript prevents these at compile time, but test runtime behavior
      await expect(orchestrator.trashTask(null as any)).rejects.toThrow();
      await expect(orchestrator.trashTask(undefined as any)).rejects.toThrow();
    });

    it('should not emit event when task does not exist', async () => {
      const eventSpy = vi.fn();
      orchestrator.on('task:trashed', eventSpy);

      try {
        await orchestrator.trashTask('non-existent-task');
      } catch {
        // Expected to throw
      }

      expect(eventSpy).not.toHaveBeenCalled();
    });

    it('should not emit event when task is already trashed', async () => {
      const task = await orchestrator.createTask({
        description: 'Task for event test',
      });

      await orchestrator.trashTask(task.id);

      const eventSpy = vi.fn();
      orchestrator.on('task:trashed', eventSpy);

      try {
        await orchestrator.trashTask(task.id);
      } catch {
        // Expected to throw
      }

      expect(eventSpy).not.toHaveBeenCalled();
    });
  });

  describe('integration with TaskStore', () => {
    it('should delegate to store.trashTask method', async () => {
      const task = await orchestrator.createTask({
        description: 'Task for store integration test',
      });

      // Spy on the store method
      const trashTaskSpy = vi.spyOn(orchestrator.store, 'trashTask');

      await orchestrator.trashTask(task.id);

      expect(trashTaskSpy).toHaveBeenCalledWith(task.id);
      expect(trashTaskSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle store errors gracefully', async () => {
      const task = await orchestrator.createTask({
        description: 'Task for error handling test',
      });

      // Mock store to throw error
      vi.spyOn(orchestrator.store, 'trashTask').mockRejectedValueOnce(
        new Error('Database error')
      );

      await expect(orchestrator.trashTask(task.id)).rejects.toThrow('Database error');
    });

    it('should maintain data consistency with store', async () => {
      const task = await orchestrator.createTask({
        description: 'Task for consistency test',
      });

      // Add some logs and artifacts before trashing
      await orchestrator.store.addLog(task.id, {
        level: 'info',
        message: 'Test log entry',
      });

      await orchestrator.store.addArtifact(task.id, {
        name: 'test.txt',
        type: 'file',
        content: 'test content',
      });

      await orchestrator.trashTask(task.id);

      // Verify task and related data are still accessible but task is marked as trashed
      const trashedTask = await orchestrator.store.getTask(task.id);
      expect(trashedTask).not.toBeNull();
      expect(trashedTask!.logs).toHaveLength(1);
      expect(trashedTask!.artifacts).toHaveLength(1);
      expect(trashedTask!.trashedAt).toBeDefined();
    });
  });

  describe('event emission', () => {
    it('should emit task:trashed event with complete task data', async () => {
      const task = await orchestrator.createTask({
        description: 'Task for event data test',
        priority: 'high',
        effort: 'large',
      });

      let emittedTask: Task | null = null;
      orchestrator.once('task:trashed', (task) => {
        emittedTask = task;
      });

      await orchestrator.trashTask(task.id);

      expect(emittedTask).not.toBeNull();
      expect(emittedTask!.id).toBe(task.id);
      expect(emittedTask!.description).toBe('Task for event data test');
      expect(emittedTask!.priority).toBe('high');
      expect(emittedTask!.effort).toBe('large');
      expect(emittedTask!.status).toBe('cancelled');
      expect(emittedTask!.trashedAt).toBeDefined();
    });

    it('should emit events for multiple tasks trashed separately', async () => {
      const task1 = await orchestrator.createTask({
        description: 'First task',
      });
      const task2 = await orchestrator.createTask({
        description: 'Second task',
      });

      const emittedTasks: Task[] = [];
      orchestrator.on('task:trashed', (task) => {
        emittedTasks.push(task);
      });

      await orchestrator.trashTask(task1.id);
      await orchestrator.trashTask(task2.id);

      expect(emittedTasks).toHaveLength(2);
      expect(emittedTasks.map(t => t.id)).toContain(task1.id);
      expect(emittedTasks.map(t => t.id)).toContain(task2.id);
    });
  });

  describe('method behavior and validation', () => {
    it('should auto-initialize orchestrator if not already initialized', async () => {
      // Create new orchestrator without initializing
      const freshOrchestrator = new ApexOrchestrator({ projectPath: testDir });

      const task = await freshOrchestrator.createTask({
        description: 'Task for auto-init test',
      });

      // trashTask should work without explicit initialization
      await freshOrchestrator.trashTask(task.id);

      const trashedTask = await freshOrchestrator.store.getTask(task.id);
      expect(trashedTask!.trashedAt).toBeDefined();
    });

    it('should handle concurrent trash operations safely', async () => {
      const tasks = await Promise.all([
        orchestrator.createTask({ description: 'Concurrent task 1' }),
        orchestrator.createTask({ description: 'Concurrent task 2' }),
        orchestrator.createTask({ description: 'Concurrent task 3' }),
      ]);

      const trashPromises = tasks.map(task => orchestrator.trashTask(task.id));

      // All should complete successfully
      await Promise.all(trashPromises);

      // Verify all tasks are trashed
      for (const task of tasks) {
        const trashedTask = await orchestrator.store.getTask(task.id);
        expect(trashedTask!.trashedAt).toBeDefined();
      }
    });

    it('should validate task ID format and handle edge cases', async () => {
      const task = await orchestrator.createTask({
        description: 'Task with regular ID',
      });

      // Should work with normal task ID
      await orchestrator.trashTask(task.id);

      // Test various invalid IDs
      const invalidIds = ['', '   ', '\n', '\t'];

      for (const invalidId of invalidIds) {
        await expect(orchestrator.trashTask(invalidId)).rejects.toThrow();
      }
    });
  });

  describe('integration with task lifecycle', () => {
    it('should work correctly with tasks that have dependencies', async () => {
      const parentTask = await orchestrator.createTask({
        description: 'Parent task',
      });

      const childTask = await orchestrator.createTask({
        description: 'Child task',
        dependsOn: [parentTask.id],
      });

      // Should be able to trash parent task
      await orchestrator.trashTask(parentTask.id);

      const trashedParent = await orchestrator.store.getTask(parentTask.id);
      expect(trashedParent!.trashedAt).toBeDefined();

      // Child task should still exist
      const stillExistingChild = await orchestrator.store.getTask(childTask.id);
      expect(stillExistingChild!.trashedAt).toBeUndefined();
    });

    it('should preserve task history and metadata when trashed', async () => {
      const task = await orchestrator.createTask({
        description: 'Task with metadata',
        priority: 'urgent',
        effort: 'large',
        acceptanceCriteria: 'Must pass all tests',
      });

      // Add some execution metadata
      await orchestrator.store.updateTask(task.id, {
        retryCount: 2,
        resumeAttempts: 1,
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 0.02,
        },
      });

      await orchestrator.trashTask(task.id);

      const trashedTask = await orchestrator.store.getTask(task.id);
      expect(trashedTask!.description).toBe('Task with metadata');
      expect(trashedTask!.priority).toBe('urgent');
      expect(trashedTask!.effort).toBe('large');
      expect(trashedTask!.acceptanceCriteria).toBe('Must pass all tests');
      expect(trashedTask!.retryCount).toBe(2);
      expect(trashedTask!.resumeAttempts).toBe(1);
      expect(trashedTask!.usage.totalTokens).toBe(1500);
    });
  });
});