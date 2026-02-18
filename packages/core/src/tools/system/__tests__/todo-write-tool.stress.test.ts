/**
 * @fileoverview Stress tests for TodoWriteTool
 *
 * These tests verify the robustness and performance of the TodoWriteTool under
 * extreme conditions including:
 * - Very large todo lists (1000+ items)
 * - High-frequency operations
 * - Memory pressure scenarios
 * - Concurrent access patterns
 * - Edge case combinations
 *
 * @module @apex/core/tools/system/__tests__/todo-write-tool.stress
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TodoWriteTool, type TodoStore } from '../todo-write-tool.js';
import type { TodoWriteInput, TodoWriteOutput, Todo, TodoItem, TodoStatus } from '../../../types.js';
import type { ToolExecutionContext } from '../../base-tool.js';

// ============================================================================
// Mock TodoStore for Stress Testing
// ============================================================================

class StressTestStore implements TodoStore {
  private todos: Map<string, Todo[]> = new Map();
  private operationCount = 0;
  private maxOperationsBeforeSlowdown = 1000;

  private getTaskKey(taskId: string | undefined): string {
    return taskId || '__global__';
  }

  async replaceTodos(taskId: string | undefined, items: TodoItem[]): Promise<Todo[]> {
    this.operationCount++;

    // Simulate slowdown after many operations to test performance
    if (this.operationCount > this.maxOperationsBeforeSlowdown) {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
    }

    const key = this.getTaskKey(taskId);
    const now = new Date();

    const todos: Todo[] = items.map((item, index) => ({
      id: `todo-${this.operationCount}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      content: item.content,
      status: item.status,
      activeForm: item.activeForm,
      taskId: taskId,
      orderIndex: index,
      createdAt: now,
      updatedAt: now,
      completedAt: item.status === 'completed' ? now : undefined,
    }));

    this.todos.set(key, todos);
    return todos;
  }

  async getTodos(taskId: string | undefined): Promise<Todo[]> {
    const key = this.getTaskKey(taskId);
    return this.todos.get(key) || [];
  }

  async getTodo(todoId: string): Promise<Todo | null> {
    for (const todoList of this.todos.values()) {
      const todo = todoList.find(t => t.id === todoId);
      if (todo) return todo;
    }
    return null;
  }

  async clearTodos(taskId: string | undefined): Promise<void> {
    const key = this.getTaskKey(taskId);
    this.todos.delete(key);
  }

  async updateTodoStatus(todoId: string, status: TodoStatus): Promise<Todo | null> {
    for (const todoList of this.todos.values()) {
      const todo = todoList.find(t => t.id === todoId);
      if (todo) {
        todo.status = status;
        todo.updatedAt = new Date();
        if (status === 'completed') {
          todo.completedAt = new Date();
        }
        return todo;
      }
    }
    return null;
  }

  getOperationCount(): number {
    return this.operationCount;
  }

  clear(): void {
    this.todos.clear();
    this.operationCount = 0;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a large number of todo items for stress testing
 */
function generateLargeTodoList(count: number): TodoItem[] {
  const statuses: TodoStatus[] = ['pending', 'in_progress', 'completed'];
  const todos: TodoItem[] = [];

  for (let i = 0; i < count; i++) {
    const status = statuses[i % 3];
    todos.push({
      content: `Stress test todo item #${i + 1} - ${'x'.repeat(Math.floor(Math.random() * 100) + 10)}`,
      status,
      activeForm: `Working on stress test todo item #${i + 1}`,
    });
  }

  return todos;
}

/**
 * Generate todo items with extreme content lengths
 */
function generateExtremeContentTodos(count: number): TodoItem[] {
  const todos: TodoItem[] = [];

  for (let i = 0; i < count; i++) {
    const contentLength = Math.floor(Math.random() * 10000) + 5000; // 5-15KB content
    const activeFormLength = Math.floor(Math.random() * 5000) + 2000; // 2-7KB active form

    todos.push({
      content: `Extreme content todo ${i}: ${'A'.repeat(contentLength)}`,
      status: 'pending',
      activeForm: `Working on extreme content: ${'B'.repeat(activeFormLength)}`,
    });
  }

  return todos;
}

// ============================================================================
// Stress Test Suite
// ============================================================================

describe('TodoWriteTool Stress Tests', () => {
  let tool: TodoWriteTool;
  let stressStore: StressTestStore;

  beforeEach(() => {
    stressStore = new StressTestStore();
    tool = new TodoWriteTool(stressStore);
  });

  // ==========================================================================
  // Large Data Volume Tests
  // ==========================================================================

  describe('Large Data Volume', () => {
    it('should handle 1000 todo items efficiently', async () => {
      const largeTodoList = generateLargeTodoList(1000);
      const input: TodoWriteInput = { todos: largeTodoList };

      const startTime = performance.now();
      const result = await tool.execute(input, { taskId: 'large-test' });
      const endTime = performance.now();

      expect(result.success).toBe(true);
      const output = result.output as TodoWriteOutput;
      expect(output.todosCount).toBe(1000);
      expect(output.todos).toHaveLength(1000);

      // Should complete within reasonable time (5 seconds for 1000 items)
      expect(endTime - startTime).toBeLessThan(5000);
    }, 10000); // 10 second timeout

    it('should handle 5000 todo items for stress testing', async () => {
      const massiveTodoList = generateLargeTodoList(5000);
      const input: TodoWriteInput = { todos: massiveTodoList };

      const startTime = performance.now();
      const result = await tool.execute(input, { taskId: 'massive-test' });
      const endTime = performance.now();

      expect(result.success).toBe(true);
      const output = result.output as TodoWriteOutput;
      expect(output.todosCount).toBe(5000);

      // Should complete within reasonable time (20 seconds for 5000 items)
      expect(endTime - startTime).toBeLessThan(20000);
    }, 30000); // 30 second timeout

    it('should handle extremely long content strings', async () => {
      const extremeTodos = generateExtremeContentTodos(50);
      const input: TodoWriteInput = { todos: extremeTodos };

      const result = await tool.execute(input, { taskId: 'extreme-content-test' });

      expect(result.success).toBe(true);
      const output = result.output as TodoWriteOutput;
      expect(output.todosCount).toBe(50);

      // Verify that long content is preserved
      const storedTodos = await stressStore.getTodos('extreme-content-test');
      expect(storedTodos[0].content.length).toBeGreaterThan(5000);
      expect(storedTodos[0].activeForm.length).toBeGreaterThan(2000);
    });
  });

  // ==========================================================================
  // High-Frequency Operation Tests
  // ==========================================================================

  describe('High-Frequency Operations', () => {
    it('should handle rapid consecutive updates', async () => {
      const updates = 100;
      const promises: Promise<any>[] = [];

      const startTime = performance.now();

      // Fire 100 rapid updates with different data
      for (let i = 0; i < updates; i++) {
        const input: TodoWriteInput = {
          todos: [
            {
              content: `Rapid update ${i}`,
              status: i % 2 === 0 ? 'pending' : 'completed',
              activeForm: `Working on rapid update ${i}`,
            },
          ],
        };
        promises.push(tool.execute(input, { taskId: `rapid-${i}` }));
      }

      const results = await Promise.all(promises);
      const endTime = performance.now();

      // All operations should succeed
      for (const result of results) {
        expect(result.success).toBe(true);
      }

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should handle alternating large and small updates', async () => {
      const iterations = 20;
      let totalTime = 0;

      for (let i = 0; i < iterations; i++) {
        const isLarge = i % 2 === 0;
        const todos = isLarge
          ? generateLargeTodoList(500)
          : [{ content: `Small update ${i}`, status: 'pending' as const, activeForm: 'Working' }];

        const startTime = performance.now();
        const result = await tool.execute(
          { todos },
          { taskId: `alternating-${i}` }
        );
        const endTime = performance.now();

        totalTime += endTime - startTime;

        expect(result.success).toBe(true);
        const output = result.output as TodoWriteOutput;
        expect(output.todosCount).toBe(isLarge ? 500 : 1);
      }

      // Average time per operation should be reasonable
      const averageTime = totalTime / iterations;
      expect(averageTime).toBeLessThan(1000); // Less than 1 second average
    });
  });

  // ==========================================================================
  // Memory Pressure Tests
  // ==========================================================================

  describe('Memory Pressure', () => {
    it('should handle memory-intensive operations without leaks', async () => {
      const iterations = 50;
      const memorySnapshots: number[] = [];

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        const largeTodos = generateLargeTodoList(200);
        const input: TodoWriteInput = { todos: largeTodos };

        await tool.execute(input, { taskId: `memory-test-${i}` });

        // Take memory snapshot every 10 iterations
        if (i % 10 === 0) {
          if (global.gc) {
            global.gc();
          }
          memorySnapshots.push(process.memoryUsage().heapUsed);
        }
      }

      if (global.gc) {
        global.gc();
      }
      const finalMemory = process.memoryUsage().heapUsed;

      // Memory should not grow significantly (less than 100MB increase)
      const memoryIncrease = finalMemory - initialMemory;
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB

      // Memory snapshots should not show continuous growth
      if (memorySnapshots.length > 2) {
        const firstSnapshot = memorySnapshots[0];
        const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
        const snapshotIncrease = lastSnapshot - firstSnapshot;
        expect(snapshotIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
      }
    });

    it('should handle deeply nested validation scenarios', async () => {
      // Create todos with complex nested validation scenarios
      const complexTodos: TodoItem[] = [];

      for (let i = 0; i < 1000; i++) {
        const content = JSON.stringify({
          nested: {
            data: {
              level: i,
              metadata: 'x'.repeat(100),
              tags: Array.from({ length: 20 }, (_, j) => `tag-${j}`),
            },
          },
        });

        complexTodos.push({
          content,
          status: 'pending',
          activeForm: `Processing complex todo ${i}`,
        });
      }

      const result = await tool.execute(
        { todos: complexTodos },
        { taskId: 'complex-validation-test' }
      );

      expect(result.success).toBe(true);
      const output = result.output as TodoWriteOutput;
      expect(output.todosCount).toBe(1000);
    });
  });

  // ==========================================================================
  // Error Condition Stress Tests
  // ==========================================================================

  describe('Error Condition Stress', () => {
    it('should handle validation errors gracefully under load', async () => {
      const invalidInputs = Array.from({ length: 100 }, (_, i) => ({
        todos: [
          {
            content: '', // Invalid: empty content
            status: 'invalid-status' as any,
            activeForm: 'Working',
          },
        ],
      }));

      const promises = invalidInputs.map(input =>
        tool.execute(input, { taskId: `invalid-${Math.random()}` })
      );

      const results = await Promise.all(promises);

      // All should fail validation gracefully
      for (const result of results) {
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('should handle store errors under concurrent load', async () => {
      const faultyStore: TodoStore = {
        replaceTodos: vi.fn().mockImplementation(async () => {
          // Randomly fail to simulate database issues
          if (Math.random() < 0.3) {
            throw new Error('Simulated database failure');
          }
          return [];
        }),
        getTodos: vi.fn(),
        getTodo: vi.fn(),
        clearTodos: vi.fn(),
        updateTodoStatus: vi.fn(),
      };

      const faultyTool = new TodoWriteTool(faultyStore);
      const promises: Promise<any>[] = [];

      // Fire many concurrent operations with faulty store
      for (let i = 0; i < 100; i++) {
        const input: TodoWriteInput = {
          todos: [{ content: `Test ${i}`, status: 'pending', activeForm: 'Working' }],
        };
        promises.push(faultyTool.execute(input, { taskId: `faulty-${i}` }));
      }

      const results = await Promise.all(promises);

      // Some should succeed, some should fail, but all should be handled gracefully
      let successCount = 0;
      let failureCount = 0;

      for (const result of results) {
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
          expect(result.error).toContain('Simulated database failure');
        }
      }

      expect(successCount + failureCount).toBe(100);
      expect(failureCount).toBeGreaterThan(0); // Some operations should have failed
    });
  });

  // ==========================================================================
  // Boundary Condition Stress Tests
  // ==========================================================================

  describe('Boundary Condition Stress', () => {
    it('should handle maximum allowed content sizes', async () => {
      const maxContentSize = 1024 * 1024; // 1MB content
      const largeContent = 'A'.repeat(maxContentSize);
      const largeActiveForm = 'B'.repeat(maxContentSize);

      const input: TodoWriteInput = {
        todos: [
          {
            content: largeContent,
            status: 'pending',
            activeForm: largeActiveForm,
          },
        ],
      };

      const result = await tool.execute(input, { taskId: 'max-size-test' });

      expect(result.success).toBe(true);
      const output = result.output as TodoWriteOutput;
      expect(output.todos[0].content).toBe(largeContent);
      expect(output.todos[0].activeForm).toBe(largeActiveForm);
    });

    it('should handle rapid status transitions on large lists', async () => {
      const todoCount = 1000;
      let currentTodos = generateLargeTodoList(todoCount);

      // Perform multiple rapid status transitions
      for (let transition = 0; transition < 5; transition++) {
        // Update all statuses in a pattern
        currentTodos = currentTodos.map((todo, index) => ({
          ...todo,
          status: (['pending', 'in_progress', 'completed'] as const)[
            (index + transition) % 3
          ],
        }));

        const result = await tool.execute(
          { todos: currentTodos },
          { taskId: 'rapid-transitions' }
        );

        expect(result.success).toBe(true);
        const output = result.output as TodoWriteOutput;
        expect(output.todosCount).toBe(todoCount);
      }
    });

    it('should handle unicode stress with large datasets', async () => {
      const unicodePatterns = [
        '🚀💻🔥⚡🌟', // Emojis
        '中文测试内容', // Chinese
        'Тест на русском', // Russian
        '🔴🟠🟡🟢🔵🟣', // Color emojis
        'نص تجريبي', // Arabic
      ];

      const largeTodos: TodoItem[] = [];

      for (let i = 0; i < 500; i++) {
        const pattern = unicodePatterns[i % unicodePatterns.length];
        largeTodos.push({
          content: `${pattern} Todo ${i} ${pattern.repeat(10)}`,
          status: 'pending',
          activeForm: `${pattern} Working on ${i} ${pattern.repeat(5)}`,
        });
      }

      const result = await tool.execute(
        { todos: largeTodos },
        { taskId: 'unicode-stress' }
      );

      expect(result.success).toBe(true);
      const output = result.output as TodoWriteOutput;
      expect(output.todosCount).toBe(500);

      // Verify unicode preservation
      const storedTodos = await stressStore.getTodos('unicode-stress');
      expect(storedTodos[0].content).toContain('🚀💻🔥⚡🌟');
    });
  });
});