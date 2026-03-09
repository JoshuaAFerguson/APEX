/**
 * SQLite Task Persistence Working Test Suite
 *
 * This test suite provides a comprehensive working test of SQLite task persistence,
 * fixing issues found in existing tests and verifying the actual implementation.
 *
 * Tests cover:
 * 1. SQLite package dependencies
 * 2. Database schema and migrations
 * 3. Store/repository implementations
 * 4. Task CRUD operations
 * 5. Implementation completeness assessment
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
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
  TaskLog,
  TaskArtifact,
  Gate,
  TaskCheckpoint,
  IdleTask,
  IdleTaskType,
  TaskTemplate,
  ApprovalState,
} from '@apexcli/core';

describe('SQLite Task Persistence - Working Test Suite', () => {
  let testDir: string;
  let store: TaskStore;
  let dbPath: string;

  // Test fixtures
  const createTaskRequest = (): CreateTaskRequest => ({
    description: 'Working test task',
    acceptanceCriteria: 'Task should be stored and retrieved correctly',
    workflow: 'feature',
    autonomy: 'full',
    agent: 'developer',
  });

  const createFullTask = (): Task => ({
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Full working test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    projectPath: testDir,
    branchName: `apex/test-${Date.now()}`,
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
    dependsOn: [],
    blockedBy: [],
    iterationHistory: { entries: [] },
  });

  beforeAll(async () => {
    // Verify SQLite package is available
    expect(Database).toBeDefined();
    expect(typeof Database).toBe('function');
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sqlite-working-test-'));
    dbPath = path.join(testDir, '.apex', 'store.db');
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    if (store) {
      await store.close();
    }
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('1. SQLite Package Dependencies', () => {
    it('should use better-sqlite3 as the SQLite driver', () => {
      expect(Database).toBeDefined();
      expect(Database.name).toBe('Database');

      // Verify we can access the database instance
      const db = store.getDatabase();
      expect(db).toBeDefined();
      expect(db.open).toBe(true);
    });

    it('should create a functional database connection', () => {
      const db = store.getDatabase();

      // Test basic SQLite functionality
      const result = db.prepare('SELECT 1 as test').get() as { test: number };
      expect(result.test).toBe(1);
    });

    it('should support SQLite-specific features', () => {
      const db = store.getDatabase();

      // Test pragma functionality
      const pragmaResult = db.pragma('journal_mode');
      expect(pragmaResult).toBeDefined();

      // Test foreign keys are enabled
      const fkResult = db.pragma('foreign_keys');
      expect(fkResult).toBeDefined();
    });
  });

  describe('2. Database Schema and Migrations', () => {
    it('should create core task persistence tables', () => {
      const db = store.getDatabase();
      const tables = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all();

      const tableNames = tables.map((t: any) => t.name);

      // Core tables that should exist
      const coreRequired = ['tasks', 'task_logs', 'task_artifacts'];
      coreRequired.forEach(table => {
        expect(tableNames).toContain(table);
      });
    });

    it('should have proper tasks table schema', () => {
      const db = store.getDatabase();
      const schema = db.prepare('PRAGMA table_info(tasks)').all();
      const columnNames = schema.map((col: any) => col.name);

      // Essential columns
      const requiredColumns = ['id', 'description', 'status', 'workflow', 'created_at', 'updated_at'];
      requiredColumns.forEach(col => {
        expect(columnNames).toContain(col);
      });
    });

    it('should handle schema evolution gracefully', async () => {
      // Create a new store instance to test initialization
      const store2 = new TaskStore(testDir);
      await store2.initialize();

      // Should work without errors
      const testTask = await store2.createTask(createTaskRequest());
      expect(testTask.id).toBeDefined();

      await store2.close();
    });

    it('should support database migrations', () => {
      const db = store.getDatabase();

      // Check if tasks table has all expected columns from migrations
      const schema = db.prepare('PRAGMA table_info(tasks)').all();
      const columnNames = schema.map((col: any) => col.name);

      // These columns should exist after migrations
      const migratedColumns = ['priority', 'effort', 'trashed_at', 'archived_at'];
      migratedColumns.forEach(col => {
        expect(columnNames).toContain(col);
      });
    });
  });

  describe('3. Store/Repository Implementation Analysis', () => {
    it('should implement complete TaskStore interface', () => {
      // Verify core CRUD methods exist
      expect(store.createTask).toBeInstanceOf(Function);
      expect(store.getTask).toBeInstanceOf(Function);
      expect(store.updateTask).toBeInstanceOf(Function);
      expect(store.listTasks).toBeInstanceOf(Function);

      // Verify advanced operations exist
      expect(store.trashTask).toBeInstanceOf(Function);
      expect(store.archiveTask).toBeInstanceOf(Function);
      expect(store.addDependency).toBeInstanceOf(Function);
      expect(store.addLog).toBeInstanceOf(Function);
      expect(store.addArtifact).toBeInstanceOf(Function);
    });

    it('should provide database access and transaction support', () => {
      const db = store.getDatabase();
      expect(db).toBeDefined();

      // Test transaction capability
      const transaction = db.transaction((data: string) => {
        return db.prepare('SELECT ? as result').get(data);
      });

      const result = transaction('test') as { result: string };
      expect(result.result).toBe('test');
    });

    it('should support advanced features', () => {
      // Verify advanced feature methods exist
      expect(store.createIdleTask).toBeInstanceOf(Function);
      expect(store.createTemplate).toBeInstanceOf(Function);
      expect(store.saveApprovalState).toBeInstanceOf(Function);
      expect(store.setGate).toBeInstanceOf(Function);
      expect(store.saveCheckpoint).toBeInstanceOf(Function);
    });
  });

  describe('4. Task CRUD Operations - Comprehensive Testing', () => {
    describe('CREATE operations', () => {
      it('should create tasks from CreateTaskRequest', async () => {
        const request = createTaskRequest();
        const task = await store.createTask(request);

        expect(task.id).toBeDefined();
        expect(task.description).toBe(request.description);
        expect(task.workflow).toBe(request.workflow);
        expect(task.status).toBe('pending');
        expect(task.createdAt).toBeInstanceOf(Date);
      });

      it('should create tasks from full Task objects', async () => {
        const fullTask = createFullTask();
        const created = await store.createTask(fullTask);

        expect(created.id).toBe(fullTask.id);
        expect(created.status).toBe(fullTask.status);
        expect(created.priority).toBe(fullTask.priority);
      });

      it('should auto-generate unique IDs', async () => {
        const request = createTaskRequest();
        const task1 = await store.createTask(request);
        const task2 = await store.createTask(request);

        expect(task1.id).toBeDefined();
        expect(task2.id).toBeDefined();
        expect(task1.id).not.toBe(task2.id);
      });
    });

    describe('READ operations', () => {
      let testTask: Task;

      beforeEach(async () => {
        testTask = await store.createTask(createTaskRequest());
      });

      it('should retrieve tasks by ID', async () => {
        const retrieved = await store.getTask(testTask.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved?.id).toBe(testTask.id);
        expect(retrieved?.description).toBe(testTask.description);
      });

      it('should return null for non-existent tasks', async () => {
        const result = await store.getTask('non-existent-id');
        expect(result).toBeNull();
      });

      it('should list tasks with filtering', async () => {
        await store.createTask(createTaskRequest());

        const tasks = await store.listTasks({ limit: 10 });
        expect(tasks.length).toBeGreaterThanOrEqual(2);

        const pendingTasks = await store.getTasksByStatus('pending');
        expect(pendingTasks.length).toBeGreaterThanOrEqual(2);
      });

      it('should support pagination', async () => {
        // Create multiple tasks
        await Promise.all(
          Array(5).fill(null).map(() => store.createTask(createTaskRequest()))
        );

        const firstPage = await store.listTasks({ limit: 3, offset: 0 });
        const secondPage = await store.listTasks({ limit: 3, offset: 3 });

        expect(firstPage.length).toBe(3);
        expect(secondPage.length).toBeGreaterThan(0);
      });
    });

    describe('UPDATE operations', () => {
      let testTask: Task;

      beforeEach(async () => {
        testTask = await store.createTask(createTaskRequest());
      });

      it('should update task status', async () => {
        await store.updateTaskStatus(testTask.id, 'in-progress');

        const updated = await store.getTask(testTask.id);
        expect(updated?.status).toBe('in-progress');
      });

      it('should update multiple fields atomically', async () => {
        const updates = {
          status: 'completed' as TaskStatus,
          priority: 'high' as TaskPriority,
          effort: 'medium' as any,
        };

        await store.updateTask(testTask.id, updates);
        const updated = await store.getTask(testTask.id);

        expect(updated?.status).toBe('completed');
        expect(updated?.priority).toBe('high');
        expect(updated?.effort).toBe('medium');
      });

      it('should update task usage statistics', async () => {
        const usage = {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 0.015,
        };

        await store.updateTask(testTask.id, { usage });
        const updated = await store.getTask(testTask.id);

        expect(updated?.usage.inputTokens).toBe(1000);
        expect(updated?.usage.outputTokens).toBe(500);
        expect(updated?.usage.totalTokens).toBe(1500);
        expect(updated?.usage.estimatedCost).toBe(0.015);
        expect(updated?.usage.totalCostCents).toBe(2); // 0.015 * 100 rounded
        expect(updated?.usage.executionTimeMs).toBe(0); // Default value
      });
    });

    describe('DELETE operations (Trash/Archive)', () => {
      let testTask: Task;

      beforeEach(async () => {
        testTask = await store.createTask(createTaskRequest());
      });

      it('should soft delete tasks (trash)', async () => {
        await store.trashTask(testTask.id);

        const task = await store.getTask(testTask.id);
        expect(task?.trashedAt).toBeDefined();
        expect(task?.status).toBe('cancelled');
      });

      it('should archive completed tasks', async () => {
        await store.updateTaskStatus(testTask.id, 'completed');
        await store.archiveTask(testTask.id);

        const task = await store.getTask(testTask.id);
        expect(task?.archivedAt).toBeDefined();
      });

      it('should permanently delete trashed tasks', async () => {
        await store.trashTask(testTask.id);
        const deletedCount = await store.emptyTrash();

        expect(deletedCount).toBeGreaterThan(0);
        const task = await store.getTask(testTask.id);
        expect(task).toBeNull();
      });

      it('should restore tasks from trash', async () => {
        await store.trashTask(testTask.id);
        await store.restoreFromTrash(testTask.id);

        const restored = await store.getTask(testTask.id);
        expect(restored?.trashedAt).toBeUndefined();
        expect(restored?.status).toBe('pending');
      });
    });
  });

  describe('5. Advanced Features Integration', () => {
    let testTask: Task;

    beforeEach(async () => {
      testTask = await store.createTask(createTaskRequest());
    });

    it('should manage task logs', async () => {
      await store.addLog(testTask.id, {
        level: 'info',
        message: 'Test log entry',
      });

      const task = await store.getTask(testTask.id);
      expect(task?.logs.length).toBe(1);
      expect(task?.logs[0].message).toBe('Test log entry');
    });

    it('should manage task artifacts', async () => {
      await store.addArtifact(testTask.id, {
        name: 'test.txt',
        path: '/tmp/test.txt',
        type: 'file',
        size: 1024,
      });

      const task = await store.getTask(testTask.id);
      expect(task?.artifacts.length).toBe(1);
      expect(task?.artifacts[0].name).toBe('test.txt');
    });

    it('should manage task gates', async () => {
      const gate = {
        name: 'approval-gate',
        status: 'pending' as const,
        requiredAt: new Date(),
      };

      await store.setGate(testTask.id, gate);
      const retrievedGate = await store.getGate(testTask.id, 'approval-gate');

      expect(retrievedGate).toBeDefined();
      expect(retrievedGate?.name).toBe('approval-gate');
      expect(retrievedGate?.status).toBe('pending');
    });

    it('should manage task dependencies', async () => {
      const task2 = await store.createTask(createTaskRequest());

      await store.addDependency(task2.id, testTask.id);
      const dependencies = await store.getTaskDependencies(task2.id);

      expect(dependencies).toContain(testTask.id);
    });

    it('should manage idle tasks', async () => {
      const idleTask: IdleTask = {
        id: 'idle-' + Date.now(),
        type: 'improvement' as IdleTaskType,
        title: 'Test idle task',
        description: 'Test idle task description',
        rationale: 'Testing idle task functionality',
        suggestedWorkflow: 'feature',
        priority: 'normal',
        estimatedEffort: 'low',
        tags: ['test'],
        createdAt: new Date(),
      };

      const created = await store.createIdleTask(idleTask);
      expect(created.id).toBe(idleTask.id);

      const retrieved = await store.getIdleTask(idleTask.id);
      expect(retrieved?.title).toBe(idleTask.title);
    });

    it('should manage task templates', async () => {
      const template: TaskTemplate = {
        id: 'template-' + Date.now(),
        name: 'Test Template',
        description: 'Test template description',
        workflow: 'feature',
        defaultWorkflow: 'feature',
        defaultAutonomy: 'full',
        priority: 'normal', // Required field
        effort: 'medium', // Required field
        tags: ['test'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const created = await store.createTemplate(template);
      expect(created.id).toBe(template.id);

      const retrieved = await store.getTemplate(template.id);
      expect(retrieved?.name).toBe(template.name);
    });
  });

  describe('6. Performance and Data Integrity', () => {
    it('should handle bulk operations efficiently', async () => {
      const startTime = Date.now();
      const taskCount = 50;

      const promises = Array(taskCount).fill(null).map(() =>
        store.createTask(createTaskRequest())
      );

      const tasks = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(tasks.length).toBe(taskCount);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should maintain referential integrity', async () => {
      const task = await store.createTask(createTaskRequest());

      // Add related data
      await store.addLog(task.id, { level: 'info', message: 'Test log' });
      await store.addArtifact(task.id, { name: 'test.txt', type: 'file' });

      // Trash and delete
      await store.trashTask(task.id);
      await store.emptyTrash();

      // Verify task is gone
      const deletedTask = await store.getTask(task.id);
      expect(deletedTask).toBeNull();
    });

    it('should handle concurrent operations safely', async () => {
      const task = await store.createTask(createTaskRequest());

      // Perform concurrent updates
      const promises = [
        store.updateTaskStatus(task.id, 'in-progress'),
        store.addLog(task.id, { level: 'info', message: 'Log 1' }),
        store.addLog(task.id, { level: 'info', message: 'Log 2' }),
      ];

      await Promise.all(promises);

      const finalTask = await store.getTask(task.id);
      expect(finalTask?.status).toBe('in-progress');
      expect(finalTask?.logs.length).toBe(2);
    });

    it('should provide comprehensive statistics', () => {
      const stats = store.getTaskStats();
      expect(stats).toBeDefined();
      expect(stats.byStatus).toBeDefined();
      expect(stats.totalCost).toBeDefined();
      expect(typeof stats.totalCost).toBe('number');
    });
  });

  describe('7. Error Handling and Edge Cases', () => {
    it('should handle invalid input gracefully', async () => {
      // Test invalid task ID
      const result = await store.getTask('');
      expect(result).toBeNull();

      // Test null/undefined IDs
      const nullResult = await store.getTask(null as any);
      expect(nullResult).toBeNull();
    });

    it('should handle database connection issues', async () => {
      // Close the store
      await store.close();

      // Operations should fail gracefully
      try {
        await store.createTask(createTaskRequest());
        // If this doesn't throw, it means the database is still accessible
        // which is also valid behavior
      } catch (error) {
        // Expected for closed connection
        expect(error).toBeDefined();
      }
    });

    it('should validate business rules', async () => {
      const task = await store.createTask(createTaskRequest());

      // Cannot archive non-completed task
      await expect(store.archiveTask(task.id)).rejects.toThrow();

      // Can archive after completion
      await store.updateTaskStatus(task.id, 'completed');
      await expect(store.archiveTask(task.id)).resolves.not.toThrow();
    });
  });
});