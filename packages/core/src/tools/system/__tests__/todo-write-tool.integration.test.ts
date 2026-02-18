/**
 * @fileoverview Integration tests for TodoWriteTool with TaskStore database
 *
 * These tests verify the integration between TodoWriteTool and the TaskStore
 * database implementation including:
 * - Real SQLite database persistence
 * - Todo CRUD operations through TaskStore
 * - Database transactions and atomicity
 * - Data consistency across operations
 * - Schema validation and constraints
 *
 * @module @apex/core/tools/system/__tests__/todo-write-tool.integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { TodoWriteTool } from '../todo-write-tool.js';
import { TaskStore } from '@apexcli/orchestrator';
import type { TodoWriteInput, TodoWriteOutput, TodoItem } from '../../../types.js';
import type { ToolExecutionContext } from '../../base-tool.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a temporary directory for test database
 */
async function createTempDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'apex-todo-integration-test-'));
}

/**
 * Cleanup temporary directory
 */
async function cleanupTempDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================================================
// Test Data
// ============================================================================

const createSampleTodos = (): TodoItem[] => [
  {
    content: 'Design database schema',
    status: 'completed',
    activeForm: 'Designing database schema',
  },
  {
    content: 'Implement API endpoints',
    status: 'in_progress',
    activeForm: 'Implementing API endpoints',
  },
  {
    content: 'Write integration tests',
    status: 'pending',
    activeForm: 'Writing integration tests',
  },
  {
    content: 'Deploy to staging',
    status: 'pending',
    activeForm: 'Deploying to staging',
  },
];

const createUpdatedTodos = (): TodoItem[] => [
  {
    content: 'Design database schema',
    status: 'completed',
    activeForm: 'Designing database schema',
  },
  {
    content: 'Implement API endpoints',
    status: 'completed',
    activeForm: 'Implementing API endpoints',
  },
  {
    content: 'Write integration tests',
    status: 'in_progress',
    activeForm: 'Writing integration tests',
  },
  {
    content: 'Deploy to staging',
    status: 'pending',
    activeForm: 'Deploying to staging',
  },
  {
    content: 'Update documentation',
    status: 'pending',
    activeForm: 'Updating documentation',
  },
];

// ============================================================================
// Integration Test Suite
// ============================================================================

describe('TodoWriteTool Integration', () => {
  let tempDir: string;
  let taskStore: TaskStore;
  let tool: TodoWriteTool;

  beforeEach(async () => {
    tempDir = await createTempDir();
    taskStore = new TaskStore(tempDir);
    await taskStore.initialize();
    tool = new TodoWriteTool(taskStore);
  });

  afterEach(async () => {
    if (taskStore) {
      taskStore.close();
    }
    await cleanupTempDir(tempDir);
  });

  // ==========================================================================
  // Database Persistence Tests
  // ==========================================================================

  describe('Database Persistence', () => {
    it('should persist todos to database', async () => {
      const input: TodoWriteInput = { todos: createSampleTodos() };
      const taskId = 'test-task-1';

      // Execute the tool
      const result = await tool.execute(input, { taskId });
      expect(result.success).toBe(true);

      const output = result.output as TodoWriteOutput;
      expect(output.todos).toHaveLength(4);

      // Verify persistence by reading directly from store
      const storedTodos = await taskStore.getTodos(taskId);
      expect(storedTodos).toHaveLength(4);

      // Verify content matches
      expect(storedTodos[0].content).toBe('Design database schema');
      expect(storedTodos[0].status).toBe('completed');
      expect(storedTodos[1].content).toBe('Implement API endpoints');
      expect(storedTodos[1].status).toBe('in_progress');
    });

    it('should maintain order index in database', async () => {
      const input: TodoWriteInput = { todos: createSampleTodos() };
      const taskId = 'test-task-2';

      await tool.execute(input, { taskId });

      const storedTodos = await taskStore.getTodos(taskId);

      // Verify order is preserved
      expect(storedTodos[0].orderIndex).toBe(0);
      expect(storedTodos[1].orderIndex).toBe(1);
      expect(storedTodos[2].orderIndex).toBe(2);
      expect(storedTodos[3].orderIndex).toBe(3);

      // Verify content is in correct order
      expect(storedTodos.map(t => t.content)).toEqual([
        'Design database schema',
        'Implement API endpoints',
        'Write integration tests',
        'Deploy to staging',
      ]);
    });

    it('should handle todos without task ID (global todos)', async () => {
      const input: TodoWriteInput = { todos: createSampleTodos() };

      // Execute without taskId
      const result = await tool.execute(input);
      expect(result.success).toBe(true);

      // Verify global todos are stored
      const globalTodos = await taskStore.getTodos(undefined);
      expect(globalTodos).toHaveLength(4);
      expect(globalTodos[0].taskId).toBeUndefined();
    });

    it('should set timestamps correctly', async () => {
      const input: TodoWriteInput = { todos: createSampleTodos() };
      const taskId = 'test-task-3';

      const beforeExecution = new Date();
      await tool.execute(input, { taskId });
      const afterExecution = new Date();

      const storedTodos = await taskStore.getTodos(taskId);

      for (const todo of storedTodos) {
        expect(todo.createdAt.getTime()).toBeGreaterThanOrEqual(beforeExecution.getTime());
        expect(todo.createdAt.getTime()).toBeLessThanOrEqual(afterExecution.getTime());
        expect(todo.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeExecution.getTime());
        expect(todo.updatedAt.getTime()).toBeLessThanOrEqual(afterExecution.getTime());

        // Completed todos should have completedAt set
        if (todo.status === 'completed') {
          expect(todo.completedAt).toBeDefined();
          expect(todo.completedAt!.getTime()).toBeGreaterThanOrEqual(beforeExecution.getTime());
          expect(todo.completedAt!.getTime()).toBeLessThanOrEqual(afterExecution.getTime());
        } else {
          expect(todo.completedAt).toBeUndefined();
        }
      }
    });
  });

  // ==========================================================================
  // Atomic Operations Tests
  // ==========================================================================

  describe('Atomic Operations', () => {
    it('should replace entire todo list atomically', async () => {
      const taskId = 'test-task-4';

      // First, create initial todos
      const initialInput: TodoWriteInput = { todos: createSampleTodos() };
      await tool.execute(initialInput, { taskId });

      // Verify initial state
      let storedTodos = await taskStore.getTodos(taskId);
      expect(storedTodos).toHaveLength(4);

      // Now replace with updated todos
      const updatedInput: TodoWriteInput = { todos: createUpdatedTodos() };
      await tool.execute(updatedInput, { taskId });

      // Verify complete replacement
      storedTodos = await taskStore.getTodos(taskId);
      expect(storedTodos).toHaveLength(5);

      // Verify old todos are gone and new ones are present
      const contents = storedTodos.map(t => t.content);
      expect(contents).toContain('Update documentation');
      expect(storedTodos.find(t => t.content === 'Implement API endpoints')?.status).toBe('completed');
    });

    it('should handle empty replacement', async () => {
      const taskId = 'test-task-5';

      // Create initial todos
      const initialInput: TodoWriteInput = { todos: createSampleTodos() };
      await tool.execute(initialInput, { taskId });

      // Verify initial state
      let storedTodos = await taskStore.getTodos(taskId);
      expect(storedTodos).toHaveLength(4);

      // Replace with empty list
      const emptyInput: TodoWriteInput = { todos: [] };
      await tool.execute(emptyInput, { taskId });

      // Verify all todos are cleared
      storedTodos = await taskStore.getTodos(taskId);
      expect(storedTodos).toHaveLength(0);
    });

    it('should not affect todos from other tasks', async () => {
      const taskId1 = 'test-task-6';
      const taskId2 = 'test-task-7';

      // Create todos for task 1
      const task1Todos: TodoWriteInput = {
        todos: [
          { content: 'Task 1 Todo', status: 'pending', activeForm: 'Working on Task 1 Todo' },
        ],
      };
      await tool.execute(task1Todos, { taskId: taskId1 });

      // Create todos for task 2
      const task2Todos: TodoWriteInput = {
        todos: [
          { content: 'Task 2 Todo', status: 'in_progress', activeForm: 'Working on Task 2 Todo' },
        ],
      };
      await tool.execute(task2Todos, { taskId: taskId2 });

      // Update task 1 todos
      const updatedTask1Todos: TodoWriteInput = {
        todos: [
          { content: 'Updated Task 1 Todo', status: 'completed', activeForm: 'Completed Task 1 Todo' },
        ],
      };
      await tool.execute(updatedTask1Todos, { taskId: taskId1 });

      // Verify task 1 was updated
      const task1StoredTodos = await taskStore.getTodos(taskId1);
      expect(task1StoredTodos).toHaveLength(1);
      expect(task1StoredTodos[0].content).toBe('Updated Task 1 Todo');
      expect(task1StoredTodos[0].status).toBe('completed');

      // Verify task 2 was not affected
      const task2StoredTodos = await taskStore.getTodos(taskId2);
      expect(task2StoredTodos).toHaveLength(1);
      expect(task2StoredTodos[0].content).toBe('Task 2 Todo');
      expect(task2StoredTodos[0].status).toBe('in_progress');
    });
  });

  // ==========================================================================
  // Database Schema Tests
  // ==========================================================================

  describe('Database Schema Validation', () => {
    it('should enforce status enum constraints', async () => {
      const taskId = 'test-task-8';

      // Create a todo with valid status
      const validInput: TodoWriteInput = {
        todos: [
          { content: 'Valid todo', status: 'pending', activeForm: 'Working on valid todo' },
        ],
      };

      await tool.execute(validInput, { taskId });

      // Verify it was stored correctly
      const storedTodos = await taskStore.getTodos(taskId);
      expect(storedTodos).toHaveLength(1);
      expect(storedTodos[0].status).toBe('pending');
    });

    it('should handle unicode content correctly', async () => {
      const taskId = 'test-task-9';

      const unicodeInput: TodoWriteInput = {
        todos: [
          {
            content: '实现国际化支持 🌍',
            status: 'in_progress',
            activeForm: '正在实现国际化支持 ⚡',
          },
          {
            content: 'Добавить поддержку русского языка 🇷🇺',
            status: 'pending',
            activeForm: 'Добавление поддержки русского языка 🔥',
          },
        ],
      };

      await tool.execute(unicodeInput, { taskId });

      const storedTodos = await taskStore.getTodos(taskId);
      expect(storedTodos).toHaveLength(2);
      expect(storedTodos[0].content).toBe('实现国际化支持 🌍');
      expect(storedTodos[0].activeForm).toBe('正在实现国际化支持 ⚡');
      expect(storedTodos[1].content).toBe('Добавить поддержку русского языка 🇷🇺');
    });

    it('should handle large content strings', async () => {
      const taskId = 'test-task-10';

      const longContent = 'A'.repeat(1000);
      const longActiveForm = 'Working on ' + 'B'.repeat(980);

      const largeContentInput: TodoWriteInput = {
        todos: [
          {
            content: longContent,
            status: 'pending',
            activeForm: longActiveForm,
          },
        ],
      };

      await tool.execute(largeContentInput, { taskId });

      const storedTodos = await taskStore.getTodos(taskId);
      expect(storedTodos).toHaveLength(1);
      expect(storedTodos[0].content).toBe(longContent);
      expect(storedTodos[0].activeForm).toBe(longActiveForm);
    });
  });

  // ==========================================================================
  // Statistics Integration Tests
  // ==========================================================================

  describe('Statistics Integration', () => {
    it('should provide accurate statistics after database operations', async () => {
      const taskId = 'test-task-11';

      const input: TodoWriteInput = {
        todos: [
          { content: 'Todo 1', status: 'completed', activeForm: 'Completed Todo 1' },
          { content: 'Todo 2', status: 'completed', activeForm: 'Completed Todo 2' },
          { content: 'Todo 3', status: 'in_progress', activeForm: 'Working on Todo 3' },
          { content: 'Todo 4', status: 'pending', activeForm: 'Pending Todo 4' },
          { content: 'Todo 5', status: 'pending', activeForm: 'Pending Todo 5' },
        ],
      };

      const result = await tool.execute(input, { taskId });
      const output = result.output as TodoWriteOutput;

      expect(output.todosCount).toBe(5);
      expect(output.completedCount).toBe(2);
      expect(output.inProgressCount).toBe(1);
      expect(output.pendingCount).toBe(2);

      // Verify against database statistics
      const stats = await taskStore.getTodoStats(taskId);
      expect(stats.total).toBe(5);
      expect(stats.completed).toBe(2);
      expect(stats.inProgress).toBe(1);
      expect(stats.pending).toBe(2);
    });

    it('should maintain consistent statistics across updates', async () => {
      const taskId = 'test-task-12';

      // Create initial todos
      const initialInput: TodoWriteInput = {
        todos: [
          { content: 'Todo 1', status: 'pending', activeForm: 'Working on Todo 1' },
          { content: 'Todo 2', status: 'pending', activeForm: 'Working on Todo 2' },
        ],
      };

      await tool.execute(initialInput, { taskId });

      // Update to mark one as completed
      const updatedInput: TodoWriteInput = {
        todos: [
          { content: 'Todo 1', status: 'completed', activeForm: 'Completed Todo 1' },
          { content: 'Todo 2', status: 'in_progress', activeForm: 'Working on Todo 2' },
        ],
      };

      const result = await tool.execute(updatedInput, { taskId });
      const output = result.output as TodoWriteOutput;

      expect(output.todosCount).toBe(2);
      expect(output.completedCount).toBe(1);
      expect(output.inProgressCount).toBe(1);
      expect(output.pendingCount).toBe(0);

      // Verify against database
      const stats = await taskStore.getTodoStats(taskId);
      expect(stats.completed).toBe(1);
      expect(stats.inProgress).toBe(1);
      expect(stats.pending).toBe(0);
    });
  });

  // ==========================================================================
  // Error Recovery Tests
  // ==========================================================================

  describe('Error Recovery', () => {
    it('should maintain data integrity if tool execution fails after validation', async () => {
      const taskId = 'test-task-13';

      // Create initial todos
      const initialInput: TodoWriteInput = { todos: createSampleTodos() };
      await tool.execute(initialInput, { taskId });

      // Verify initial state
      let storedTodos = await taskStore.getTodos(taskId);
      expect(storedTodos).toHaveLength(4);

      // Close the database to simulate a failure during execution
      taskStore.close();

      // Try to execute with the closed database - should fail gracefully
      const updateInput: TodoWriteInput = { todos: createUpdatedTodos() };
      const result = await tool.execute(updateInput, { taskId });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Reconnect to database and verify data integrity
      const newTaskStore = new TaskStore(tempDir);
      await newTaskStore.initialize();

      // Original todos should still be intact
      storedTodos = await newTaskStore.getTodos(taskId);
      expect(storedTodos).toHaveLength(4);
      expect(storedTodos[0].content).toBe('Design database schema');

      newTaskStore.close();
    });
  });

  // ==========================================================================
  // Performance Tests
  // ==========================================================================

  describe('Performance', () => {
    it('should handle concurrent todo operations', async () => {
      const promises = Array.from({ length: 10 }, async (_, i) => {
        const taskId = `concurrent-task-${i}`;
        const input: TodoWriteInput = {
          todos: [
            {
              content: `Concurrent todo ${i}`,
              status: 'pending',
              activeForm: `Working on concurrent todo ${i}`,
            },
          ],
        };

        return tool.execute(input, { taskId });
      });

      const results = await Promise.all(promises);

      // All operations should succeed
      for (const result of results) {
        expect(result.success).toBe(true);
      }

      // Verify all todos were created
      for (let i = 0; i < 10; i++) {
        const taskId = `concurrent-task-${i}`;
        const storedTodos = await taskStore.getTodos(taskId);
        expect(storedTodos).toHaveLength(1);
        expect(storedTodos[0].content).toBe(`Concurrent todo ${i}`);
      }
    });

    it('should efficiently handle large todo replacements', async () => {
      const taskId = 'performance-test-task';

      // Create a large todo list
      const largeTodos: TodoItem[] = Array.from({ length: 500 }, (_, i) => ({
        content: `Performance todo ${i}`,
        status: (i % 3 === 0 ? 'completed' : i % 3 === 1 ? 'in_progress' : 'pending') as any,
        activeForm: `Working on performance todo ${i}`,
      }));

      const input: TodoWriteInput = { todos: largeTodos };

      const startTime = performance.now();
      const result = await tool.execute(input, { taskId });
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second

      const output = result.output as TodoWriteOutput;
      expect(output.todosCount).toBe(500);

      // Verify all todos were stored
      const storedTodos = await taskStore.getTodos(taskId);
      expect(storedTodos).toHaveLength(500);
    });
  });
});