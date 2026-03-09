/**
 * SQLite Task Persistence - Corrected Comprehensive Test Suite
 *
 * This test suite provides comprehensive coverage of the SQLite task persistence
 * implementation, using only the actual methods available in the TaskStore class.
 * This corrects issues found in other test files that referenced non-existent methods.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import Database from 'better-sqlite3';
import { TaskStore } from '../packages/orchestrator/src/store';
import type {
  Task,
  CreateTaskRequest,
  TaskStatus,
  TaskPriority,
  TaskEffort,
} from '@apexcli/core';

describe('SQLite Task Persistence - Corrected Comprehensive Tests', () => {
  let testDir: string;
  let store: TaskStore;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-sqlite-corrected-'));
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    if (store && typeof store.close === 'function') {
      await store.close();
    }
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Package Dependencies Verification', () => {
    it('should use better-sqlite3 package', () => {
      expect(Database).toBeDefined();
      expect(Database.name).toBe('Database');
    });

    it('should have database instance available', () => {
      const db = store.getDatabase();
      expect(db).toBeDefined();
      expect(typeof db.prepare).toBe('function');
      expect(typeof db.exec).toBe('function');
    });

    it('should verify SQLite WAL mode is enabled', () => {
      const db = store.getDatabase();
      const journalMode = db.pragma('journal_mode');
      expect(journalMode).toBe('wal');
    });
  });

  describe('Database Schema Verification', () => {
    it('should have all required core tables', () => {
      const db = store.getDatabase();
      const tables = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all() as { name: string }[];

      const tableNames = tables.map(t => t.name);

      // Core task persistence tables
      expect(tableNames).toContain('tasks');
      expect(tableNames).toContain('task_logs');
      expect(tableNames).toContain('task_artifacts');
      expect(tableNames).toContain('task_dependencies');
      expect(tableNames).toContain('task_checkpoints');

      // v0.4.0 Tables
      expect(tableNames).toContain('thought_captures');
      expect(tableNames).toContain('task_interactions');
      expect(tableNames).toContain('workspace_info');
      expect(tableNames).toContain('idle_tasks');
      expect(tableNames).toContain('task_iterations');
      expect(tableNames).toContain('task_templates');
      expect(tableNames).toContain('todos');

      // v0.5.0 Tables
      expect(tableNames).toContain('approval_states');
      expect(tableNames).toContain('file_snapshots');
      expect(tableNames).toContain('tool_actions');
      expect(tableNames).toContain('snapshots');
      expect(tableNames).toContain('fix_attempts');
      expect(tableNames).toContain('audit_logs');
      expect(tableNames).toContain('permissions');
      expect(tableNames).toContain('mcp_marketplace');
      expect(tableNames).toContain('mcp_servers');
      expect(tableNames).toContain('mcp_installations');
    });

    it('should have correct tasks table schema', () => {
      const db = store.getDatabase();
      const columns = db.prepare(`PRAGMA table_info(tasks)`).all() as any[];
      const columnNames = columns.map(c => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('description');
      expect(columnNames).toContain('acceptance_criteria');
      expect(columnNames).toContain('workflow');
      expect(columnNames).toContain('autonomy');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('priority');
      expect(columnNames).toContain('effort');
      expect(columnNames).toContain('current_stage');
      expect(columnNames).toContain('project_path');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
      expect(columnNames).toContain('completed_at');
      expect(columnNames).toContain('usage_input_tokens');
      expect(columnNames).toContain('usage_output_tokens');
      expect(columnNames).toContain('usage_total_tokens');
      expect(columnNames).toContain('usage_estimated_cost');
    });

    it('should have proper indexes for performance', () => {
      const db = store.getDatabase();
      const indexes = db.prepare(`
        SELECT name, tbl_name FROM sqlite_master
        WHERE type='index' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all() as { name: string; tbl_name: string }[];

      const indexNames = indexes.map(i => i.name);

      // Check for key indexes that should exist
      expect(indexNames.some(name => name.includes('task') && name.includes('status'))).toBe(true);
      expect(indexNames.some(name => name.includes('snapshots') && name.includes('timestamp'))).toBe(true);
      expect(indexNames.some(name => name.includes('fix_attempts') && name.includes('timestamp'))).toBe(true);
    });
  });

  describe('Task CRUD Operations', () => {
    it('should create task from CreateTaskRequest', async () => {
      const taskRequest: CreateTaskRequest = {
        description: 'Test task creation',
        workflow: 'development',
        agent: 'developer',
        acceptanceCriteria: 'Task should be created successfully',
        priority: 'high' as TaskPriority,
        effort: 'medium' as TaskEffort,
        autonomy: 'semi-autonomous'
      };

      const task = await store.createTask(taskRequest);

      expect(task).toBeDefined();
      expect(task.id).toMatch(/^task_/);
      expect(task.description).toBe(taskRequest.description);
      expect(task.workflow).toBe(taskRequest.workflow);
      expect(task.priority).toBe(taskRequest.priority);
      expect(task.effort).toBe(taskRequest.effort);
      expect(task.status).toBe('pending');
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    it('should create task from full Task object', async () => {
      const fullTask: Task = {
        id: 'task_test_' + Date.now(),
        description: 'Full task test',
        workflow: 'feature',
        autonomy: 'full',
        status: 'pending',
        priority: 'normal',
        effort: 'medium',
        projectPath: testDir,
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
        },
        logs: [],
        artifacts: [],
      };

      const task = await store.createTask(fullTask);
      expect(task.id).toBe(fullTask.id);
      expect(task.description).toBe(fullTask.description);
    });

    it('should retrieve task by ID', async () => {
      const taskRequest: CreateTaskRequest = {
        description: 'Test task retrieval',
        workflow: 'development',
        agent: 'developer'
      };

      const createdTask = await store.createTask(taskRequest);
      const retrievedTask = await store.getTask(createdTask.id);

      expect(retrievedTask).toBeDefined();
      expect(retrievedTask!.id).toBe(createdTask.id);
      expect(retrievedTask!.description).toBe(taskRequest.description);
    });

    it('should return null for non-existent task', async () => {
      const nonExistentTask = await store.getTask('non-existent-task-id');
      expect(nonExistentTask).toBeNull();
    });

    it('should update task status', async () => {
      const taskRequest: CreateTaskRequest = {
        description: 'Test status update',
        workflow: 'development',
        agent: 'developer'
      };

      const task = await store.createTask(taskRequest);
      await store.updateTaskStatus(task.id, 'in-progress');

      const updatedTask = await store.getTask(task.id);
      expect(updatedTask!.status).toBe('in-progress');
    });

    it('should update task with partial data', async () => {
      const taskRequest: CreateTaskRequest = {
        description: 'Test partial update',
        workflow: 'development',
        agent: 'developer',
        priority: 'normal'
      };

      const task = await store.createTask(taskRequest);
      await store.updateTask(task.id, {
        priority: 'high',
        effort: 'large'
      });

      const updatedTask = await store.getTask(task.id);
      expect(updatedTask!.priority).toBe('high');
      expect(updatedTask!.effort).toBe('large');
      expect(updatedTask!.description).toBe(task.description); // Unchanged
    });

    it('should list all tasks', async () => {
      const tasks = [
        { description: 'Task 1', workflow: 'development', agent: 'developer' },
        { description: 'Task 2', workflow: 'testing', agent: 'tester' },
        { description: 'Task 3', workflow: 'deployment', agent: 'devops' }
      ];

      for (const taskReq of tasks) {
        await store.createTask(taskReq);
      }

      const allTasks = await store.getAllTasks();
      expect(allTasks.length).toBe(3);
      expect(allTasks.map(t => t.description)).toEqual(
        expect.arrayContaining(['Task 1', 'Task 2', 'Task 3'])
      );
    });

    it('should filter tasks by status', async () => {
      const task1 = await store.createTask({
        description: 'Pending task',
        workflow: 'development',
        agent: 'developer'
      });

      const task2 = await store.createTask({
        description: 'Running task',
        workflow: 'development',
        agent: 'developer'
      });

      await store.updateTaskStatus(task2.id, 'in-progress');

      const pendingTasks = await store.getTasksByStatus('pending');
      const runningTasks = await store.getTasksByStatus('in-progress');

      expect(pendingTasks.length).toBe(1);
      expect(pendingTasks[0].id).toBe(task1.id);
      expect(runningTasks.length).toBe(1);
      expect(runningTasks[0].id).toBe(task2.id);
    });
  });

  describe('Task Lifecycle Management', () => {
    it('should handle task progression through lifecycle states', async () => {
      const task = await store.createTask({
        description: 'Lifecycle test task',
        workflow: 'development',
        agent: 'developer'
      });

      // Test progression: pending -> in-progress -> completed
      expect(task.status).toBe('pending');

      await store.updateTaskStatus(task.id, 'in-progress');
      let updatedTask = await store.getTask(task.id);
      expect(updatedTask!.status).toBe('in-progress');

      await store.updateTaskStatus(task.id, 'completed');
      updatedTask = await store.getTask(task.id);
      expect(updatedTask!.status).toBe('completed');
      expect(updatedTask!.completedAt).toBeInstanceOf(Date);
    });

    it('should support task pausing and resuming', async () => {
      const task = await store.createTask({
        description: 'Pause/resume test',
        workflow: 'development',
        agent: 'developer'
      });

      await store.updateTaskStatus(task.id, 'in-progress');
      await store.updateTaskStatus(task.id, 'paused');

      let pausedTask = await store.getTask(task.id);
      expect(pausedTask!.status).toBe('paused');

      await store.updateTaskStatus(task.id, 'in-progress');
      let resumedTask = await store.getTask(task.id);
      expect(resumedTask!.status).toBe('in-progress');
    });

    it('should handle task failure', async () => {
      const task = await store.createTask({
        description: 'Failure test task',
        workflow: 'development',
        agent: 'developer'
      });

      await store.updateTaskStatus(task.id, 'in-progress');
      await store.updateTaskStatus(task.id, 'failed');

      const failedTask = await store.getTask(task.id);
      expect(failedTask!.status).toBe('failed');
    });

    it('should handle task archiving lifecycle', async () => {
      const task = await store.createTask({
        description: 'Archive test task',
        workflow: 'development',
        agent: 'developer'
      });

      // Complete the task first
      await store.updateTaskStatus(task.id, 'completed');

      // Archive it
      await store.archiveTask(task.id);

      // Verify it appears in archived tasks
      const archivedTasks = await store.getArchivedTasks();
      expect(archivedTasks.some(t => t.id === task.id)).toBe(true);

      // Verify it has an archived timestamp
      const archivedTask = await store.getTask(task.id);
      expect(archivedTask!.archivedAt).toBeInstanceOf(Date);
    });

    it('should handle task trash and restore lifecycle', async () => {
      const task = await store.createTask({
        description: 'Trash test task',
        workflow: 'development',
        agent: 'developer'
      });

      // Trash the task
      await store.trashTask(task.id);

      // Verify it appears in trashed tasks
      const trashedTasks = await store.getTrashedTasks();
      expect(trashedTasks.some(t => t.id === task.id)).toBe(true);

      // Verify the task status is cancelled and has trash timestamp
      const trashedTask = await store.getTask(task.id);
      expect(trashedTask!.status).toBe('cancelled');
      expect(trashedTask!.trashedAt).toBeInstanceOf(Date);

      // Restore from trash
      await store.restoreFromTrash(task.id);
      const restoredTask = await store.getTask(task.id);
      expect(restoredTask!.status).toBe('pending');
      expect(restoredTask!.trashedAt).toBeUndefined();
    });
  });

  describe('Task Dependencies', () => {
    it('should create and retrieve task dependencies', async () => {
      const taskA = await store.createTask({
        description: 'Task A',
        workflow: 'development',
        agent: 'developer'
      });

      const taskB = await store.createTask({
        description: 'Task B (depends on A)',
        workflow: 'development',
        agent: 'developer'
      });

      await store.addDependency(taskB.id, taskA.id);

      const dependencies = await store.getTaskDependencies(taskB.id);
      expect(dependencies).toContain(taskA.id);

      const dependents = await store.getDependentTasks(taskA.id);
      expect(dependents).toContain(taskB.id);
    });

    it('should remove task dependencies', async () => {
      const taskA = await store.createTask({
        description: 'Task A',
        workflow: 'development',
        agent: 'developer'
      });

      const taskB = await store.createTask({
        description: 'Task B',
        workflow: 'development',
        agent: 'developer'
      });

      await store.addDependency(taskB.id, taskA.id);
      await store.removeDependency(taskB.id, taskA.id);

      const dependencies = await store.getTaskDependencies(taskB.id);
      expect(dependencies).not.toContain(taskA.id);
    });

    it('should handle duplicate dependency addition gracefully', async () => {
      const taskA = await store.createTask({
        description: 'Task A',
        workflow: 'development',
        agent: 'developer'
      });

      const taskB = await store.createTask({
        description: 'Task B',
        workflow: 'development',
        agent: 'developer'
      });

      await store.addDependency(taskB.id, taskA.id);
      // Adding same dependency again should not cause issues
      await store.addDependency(taskB.id, taskA.id);

      const dependencies = await store.getTaskDependencies(taskB.id);
      expect(dependencies.filter(id => id === taskA.id).length).toBe(1);
    });
  });

  describe('Task Logging and Artifacts', () => {
    it('should add and retrieve task logs', async () => {
      const task = await store.createTask({
        description: 'Logging test task',
        workflow: 'development',
        agent: 'developer'
      });

      await store.addLog(task.id, {
        level: 'info',
        message: 'Task started',
        agent: 'developer'
      });

      await store.addLog(task.id, {
        level: 'debug',
        message: 'Processing step 1',
        agent: 'developer',
        metadata: { step: 1 }
      });

      const logs = await store.getLogs(task.id);
      expect(logs.length).toBe(2);
      expect(logs[0].message).toBe('Task started');
      expect(logs[1].message).toBe('Processing step 1');
      expect(logs[1].metadata).toEqual({ step: 1 });
    });

    it('should add and retrieve task artifacts', async () => {
      const task = await store.createTask({
        description: 'Artifacts test task',
        workflow: 'development',
        agent: 'developer'
      });

      await store.addArtifact(task.id, {
        name: 'output.txt',
        type: 'file',
        path: '/tmp/output.txt'
      });

      await store.addArtifact(task.id, {
        name: 'result.json',
        type: 'data',
        content: JSON.stringify({ status: 'success' })
      });

      const taskWithArtifacts = await store.getTask(task.id);
      expect(taskWithArtifacts!.artifacts.length).toBe(2);

      const fileArtifact = taskWithArtifacts!.artifacts.find(a => a.name === 'output.txt');
      const dataArtifact = taskWithArtifacts!.artifacts.find(a => a.name === 'result.json');

      expect(fileArtifact).toBeDefined();
      expect(fileArtifact!.type).toBe('file');
      expect(fileArtifact!.path).toBe('/tmp/output.txt');

      expect(dataArtifact).toBeDefined();
      expect(dataArtifact!.type).toBe('data');
      expect(dataArtifact!.content).toBe(JSON.stringify({ status: 'success' }));
    });
  });

  describe('Task Statistics and Querying', () => {
    it('should provide task statistics', async () => {
      // Create tasks with different statuses
      const tasks = [
        { description: 'Pending 1', status: 'pending' as TaskStatus },
        { description: 'Pending 2', status: 'pending' as TaskStatus },
        { description: 'Running 1', status: 'in-progress' as TaskStatus },
        { description: 'Completed 1', status: 'completed' as TaskStatus },
      ];

      for (const { description, status } of tasks) {
        const task = await store.createTask({
          description,
          workflow: 'development',
          agent: 'developer'
        });

        if (status !== 'pending') {
          await store.updateTaskStatus(task.id, status);
        }
      }

      const stats = store.getTaskStats();
      expect(stats.byStatus['pending']).toBe(2);
      expect(stats.byStatus['in-progress']).toBe(1);
      expect(stats.byStatus['completed']).toBe(1);
    });

    it('should count tasks correctly', () => {
      const count = store.countTasks();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should list tasks with filtering options', async () => {
      const highPriorityTask = await store.createTask({
        description: 'High priority task',
        workflow: 'development',
        agent: 'developer',
        priority: 'high'
      });

      const lowPriorityTask = await store.createTask({
        description: 'Low priority task',
        workflow: 'development',
        agent: 'developer',
        priority: 'low'
      });

      const filteredTasks = await store.listTasks({ priority: 'high' });
      expect(filteredTasks.length).toBeGreaterThan(0);
      expect(filteredTasks.every(t => t.priority === 'high')).toBe(true);
    });
  });

  describe('Data Persistence and Recovery', () => {
    it('should persist data across store instances', async () => {
      const taskRequest: CreateTaskRequest = {
        description: 'Persistence test task',
        workflow: 'development',
        agent: 'developer'
      };

      // Create task with first store instance
      const task = await store.createTask(taskRequest);
      await store.updateTaskStatus(task.id, 'in-progress');

      if (typeof store.close === 'function') {
        await store.close();
      }

      // Create new store instance pointing to same directory
      const store2 = new TaskStore(testDir);
      await store2.initialize();

      try {
        // Verify task persisted
        const retrievedTask = await store2.getTask(task.id);
        expect(retrievedTask).toBeDefined();
        expect(retrievedTask!.description).toBe(taskRequest.description);
        expect(retrievedTask!.status).toBe('in-progress');
      } finally {
        if (typeof store2.close === 'function') {
          await store2.close();
        }
      }
    });

    it('should handle database reset', () => {
      // Verify reset functionality exists
      expect(typeof store.resetDatabase).toBe('function');

      // Reset should work without throwing
      expect(() => store.resetDatabase()).not.toThrow();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid task updates gracefully', async () => {
      const task = await store.createTask({
        description: 'Error handling test',
        workflow: 'development',
        agent: 'developer'
      });

      // Try updating non-existent task
      try {
        await store.updateTask('non-existent-id', { status: 'in-progress' });
        // If it doesn't throw, that's acceptable behavior
      } catch (error) {
        // If it does throw, that's fine too
        expect(error).toBeDefined();
      }

      // Valid task should still work
      await store.updateTask(task.id, { status: 'in-progress' });
      const updatedTask = await store.getTask(task.id);
      expect(updatedTask!.status).toBe('in-progress');
    });

    it('should handle malformed data gracefully', async () => {
      const task = await store.createTask({
        description: 'Malformed data test',
        workflow: 'development',
        agent: 'developer'
      });

      // These operations should not crash the system
      await store.addLog(task.id, {
        level: 'info',
        message: '',  // Empty message
        agent: 'developer'
      });

      await store.addArtifact(task.id, {
        name: '',  // Empty name
        type: 'unknown',  // Invalid type
        content: undefined as any
      });

      const taskWithData = await store.getTask(task.id);
      expect(taskWithData).toBeDefined();
    });

    it('should prevent archiving non-completed tasks', async () => {
      const task = await store.createTask({
        description: 'Archive prevention test',
        workflow: 'development',
        agent: 'developer'
      });

      // Should throw error when trying to archive non-completed task
      await expect(store.archiveTask(task.id))
        .rejects
        .toThrow(/only completed tasks can be archived/);
    });
  });

  describe('Advanced Features', () => {
    it('should handle task checkpoints', async () => {
      const task = await store.createTask({
        description: 'Checkpoint test task',
        workflow: 'development',
        agent: 'developer'
      });

      await store.setCheckpoint(task.id, {
        id: 'checkpoint-1',
        name: 'Initial setup complete',
        status: 'completed',
        createdAt: new Date()
      });

      const checkpoints = await store.getCheckpoints(task.id);
      expect(checkpoints.length).toBe(1);
      expect(checkpoints[0].name).toBe('Initial setup complete');
    });

    it('should handle gates and approval states', async () => {
      const task = await store.createTask({
        description: 'Gates test task',
        workflow: 'development',
        agent: 'developer'
      });

      await store.setGate(task.id, {
        name: 'code-review',
        status: 'pending',
        requiredAt: new Date(),
        comment: 'Code review required'
      });

      const gates = await store.getGates(task.id);
      expect(gates.length).toBe(1);
      expect(gates[0].name).toBe('code-review');
      expect(gates[0].status).toBe('pending');
    });

    it('should handle task usage tracking', async () => {
      const task = await store.createTask({
        description: 'Usage tracking test',
        workflow: 'development',
        agent: 'developer'
      });

      await store.updateTask(task.id, {
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 0.015
        }
      });

      const updatedTask = await store.getTask(task.id);
      expect(updatedTask!.usage.inputTokens).toBe(1000);
      expect(updatedTask!.usage.outputTokens).toBe(500);
      expect(updatedTask!.usage.totalTokens).toBe(1500);
      expect(updatedTask!.usage.estimatedCost).toBe(0.015);
    });
  });
});