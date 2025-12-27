/**
 * Integration tests for ApexOrchestrator.trashTask method
 * Tests the trashTask method in a more realistic scenario with actual task lifecycle
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { initializeApex } from '@apexcli/core';

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

describe('ApexOrchestrator.trashTask - Integration', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-integration-trash-'));

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'integration-test-project',
      language: 'typescript',
      framework: 'node',
    });

    // Create a simple workflow file
    const workflowContent = `
name: simple
description: Simple test workflow
stages:
  - name: test
    agent: tester
    description: Run tests
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'simple.yaml'),
      workflowContent
    );

    // Create a tester agent file
    const testerContent = `---
name: tester
description: Runs tests
tools: Read, Bash
model: haiku
---
You run tests.
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'tester.md'),
      testerContent
    );

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('should integrate trashTask with the full task lifecycle', async () => {
    // Create a task through the orchestrator
    const task = await orchestrator.createTask({
      description: 'Integration test task',
      workflow: 'simple',
      priority: 'normal',
    });

    expect(task.status).toBe('pending');
    expect(task.trashedAt).toBeUndefined();

    // Add some activity to the task
    await orchestrator.store.addLog(task.id, {
      level: 'info',
      message: 'Task started',
    });

    await orchestrator.store.addArtifact(task.id, {
      name: 'test-artifact.txt',
      type: 'file',
      content: 'test content',
    });

    // Now trash the task
    await orchestrator.trashTask(task.id);

    // Verify task is properly trashed
    const trashedTask = await orchestrator.store.getTask(task.id);
    expect(trashedTask).not.toBeNull();
    expect(trashedTask!.status).toBe('cancelled');
    expect(trashedTask!.trashedAt).toBeDefined();

    // Verify data integrity - logs and artifacts should still be accessible
    expect(trashedTask!.logs).toHaveLength(1);
    expect(trashedTask!.artifacts).toHaveLength(1);
    expect(trashedTask!.logs[0].message).toBe('Task started');
    expect(trashedTask!.artifacts[0].name).toBe('test-artifact.txt');

    // Verify task doesn't appear in normal listings
    const activeTasks = await orchestrator.listTasks();
    expect(activeTasks.map(t => t.id)).not.toContain(task.id);

    // But should appear in trash listing
    const trashedTasks = await orchestrator.store.listTrashed();
    expect(trashedTasks.map(t => t.id)).toContain(task.id);
  });

  it('should handle trashing tasks with different statuses', async () => {
    const tasks = await Promise.all([
      orchestrator.createTask({ description: 'Pending task', workflow: 'simple' }),
      orchestrator.createTask({ description: 'Running task', workflow: 'simple' }),
      orchestrator.createTask({ description: 'Completed task', workflow: 'simple' }),
    ]);

    // Set different statuses
    await orchestrator.store.updateTask(tasks[1].id, {
      status: 'in-progress',
      updatedAt: new Date(),
    });
    await orchestrator.store.updateTask(tasks[2].id, {
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
    });

    // Trash all tasks
    for (const task of tasks) {
      await orchestrator.trashTask(task.id);
    }

    // All should be trashed with cancelled status
    for (const task of tasks) {
      const trashedTask = await orchestrator.store.getTask(task.id);
      expect(trashedTask!.status).toBe('cancelled');
      expect(trashedTask!.trashedAt).toBeDefined();
    }
  });

  it('should maintain referential integrity when trashing tasks with dependencies', async () => {
    // Create parent and child tasks
    const parentTask = await orchestrator.createTask({
      description: 'Parent task',
      workflow: 'simple',
    });

    const childTask = await orchestrator.createTask({
      description: 'Child task',
      workflow: 'simple',
      dependsOn: [parentTask.id],
    });

    // Verify dependency relationship
    expect(childTask.dependsOn).toContain(parentTask.id);

    // Trash the parent task
    await orchestrator.trashTask(parentTask.id);

    // Child should still exist but dependency might be handled differently
    // (this depends on the specific business logic - some systems remove dependencies,
    // others keep them for audit trails)
    const existingChild = await orchestrator.store.getTask(childTask.id);
    expect(existingChild).not.toBeNull();
    expect(existingChild!.trashedAt).toBeUndefined();

    // Parent should be trashed
    const trashedParent = await orchestrator.store.getTask(parentTask.id);
    expect(trashedParent!.trashedAt).toBeDefined();
  });

  it('should work correctly with store filtering and lifecycle methods', async () => {
    // Create multiple tasks
    const normalTask = await orchestrator.createTask({
      description: 'Normal task',
      workflow: 'simple',
    });

    const taskToTrash = await orchestrator.createTask({
      description: 'Task to trash',
      workflow: 'simple',
    });

    const taskToComplete = await orchestrator.createTask({
      description: 'Task to complete',
      workflow: 'simple',
    });

    // Complete one task
    await orchestrator.store.updateTask(taskToComplete.id, {
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
    });

    // Trash another task
    await orchestrator.trashTask(taskToTrash.id);

    // Test various filtering scenarios
    const allActiveTasks = await orchestrator.listTasks();
    expect(allActiveTasks.map(t => t.id)).toContain(normalTask.id);
    expect(allActiveTasks.map(t => t.id)).toContain(taskToComplete.id);
    expect(allActiveTasks.map(t => t.id)).not.toContain(taskToTrash.id);

    const allTasksIncludingTrashed = await orchestrator.store.listTasks({
      includeTrashed: true
    });
    expect(allTasksIncludingTrashed.map(t => t.id)).toContain(normalTask.id);
    expect(allTasksIncludingTrashed.map(t => t.id)).toContain(taskToComplete.id);
    expect(allTasksIncludingTrashed.map(t => t.id)).toContain(taskToTrash.id);

    const onlyTrashedTasks = await orchestrator.store.listTrashed();
    expect(onlyTrashedTasks).toHaveLength(1);
    expect(onlyTrashedTasks[0].id).toBe(taskToTrash.id);
  });

  it('should emit events properly and allow event handlers to access task data', async () => {
    const task = await orchestrator.createTask({
      description: 'Task for event testing',
      workflow: 'simple',
      priority: 'high',
    });

    const eventData: any[] = [];

    // Set up event listeners
    orchestrator.on('task:trashed', (trashedTask) => {
      eventData.push({
        event: 'task:trashed',
        taskId: trashedTask.id,
        status: trashedTask.status,
        trashedAt: trashedTask.trashedAt,
        description: trashedTask.description,
        priority: trashedTask.priority,
      });
    });

    // Trash the task
    await orchestrator.trashTask(task.id);

    // Wait a bit for async events
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify event was emitted with correct data
    expect(eventData).toHaveLength(1);
    expect(eventData[0].event).toBe('task:trashed');
    expect(eventData[0].taskId).toBe(task.id);
    expect(eventData[0].status).toBe('cancelled');
    expect(eventData[0].trashedAt).toBeDefined();
    expect(eventData[0].description).toBe('Task for event testing');
    expect(eventData[0].priority).toBe('high');
  });
});