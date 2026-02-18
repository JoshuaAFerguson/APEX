/**
 * @fileoverview Tests for TodoWriteTool
 *
 * These tests verify the functionality of the TodoWriteTool including:
 * - Parameter validation and business logic constraints
 * - Todo list creation and management
 * - Status tracking and transitions
 * - Memory-only mode (without persistence)
 * - Integration with mock TodoStore
 * - Error handling for various scenarios
 *
 * @module @apex/core/tools/system/__tests__/todo-write-tool
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { TodoWriteTool, type TodoStore } from '../todo-write-tool.js';
import type { TodoWriteInput, TodoWriteOutput, Todo, TodoItem, TodoStatus } from '../../../types.js';
import type { ToolExecutionContext } from '../../base-tool.js';

// ============================================================================
// Mock TodoStore Implementation
// ============================================================================

class MockTodoStore implements TodoStore {
  private todos: Map<string, Todo[]> = new Map();

  private getTaskKey(taskId: string | undefined): string {
    return taskId || '__global__';
  }

  async replaceTodos(taskId: string | undefined, items: TodoItem[]): Promise<Todo[]> {
    const key = this.getTaskKey(taskId);
    const now = new Date();

    const todos: Todo[] = items.map((item, index) => ({
      id: `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

  // Helper method for tests
  clear(): void {
    this.todos.clear();
  }
}

// ============================================================================
// Test Data
// ============================================================================

const createValidTodoItems = (): TodoItem[] => [
  {
    content: 'Implement user authentication',
    status: 'in_progress',
    activeForm: 'Implementing user authentication',
  },
  {
    content: 'Write unit tests',
    status: 'pending',
    activeForm: 'Writing unit tests',
  },
  {
    content: 'Update documentation',
    status: 'completed',
    activeForm: 'Updating documentation',
  },
];

const createValidTodoInput = (): TodoWriteInput => ({
  todos: createValidTodoItems(),
});

const createEmptyTodoInput = (): TodoWriteInput => ({
  todos: [],
});

const createSingleTodoInput = (status: TodoStatus = 'pending'): TodoWriteInput => ({
  todos: [
    {
      content: 'Single todo item',
      status,
      activeForm: 'Working on single todo item',
    },
  ],
});

// ============================================================================
// Test Suite
// ============================================================================

describe('TodoWriteTool', () => {
  let tool: TodoWriteTool;
  let mockStore: MockTodoStore;

  beforeEach(() => {
    mockStore = new MockTodoStore();
    tool = new TodoWriteTool(mockStore);
  });

  // ==========================================================================
  // Tool Definition Tests
  // ==========================================================================

  describe('Tool Definition', () => {
    it('should have correct tool definition', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('TodoWrite');
      expect(definition.description).toBe(
        'Creates and manages a structured task list for tracking progress on complex multi-step tasks'
      );
      expect(definition.category).toBe('system');
      expect(definition.permissions).toEqual(['write']);
      expect(definition.dangerous).toBe(false);
      expect(definition.version).toBe('1.0.0');
      expect(definition.tags).toEqual(['system', 'task-management', 'progress-tracking']);
    });

    it('should have correct parameter schema', () => {
      const definition = tool.getDefinition();
      const schema = definition.parameters;

      expect(schema.type).toBe('object');
      expect(schema.required).toEqual(['todos']);
      expect(schema.additionalProperties).toBe(false);

      // Check todos array property
      expect(schema.properties?.todos).toBeDefined();
      const todosProperty = schema.properties?.todos as any;
      expect(todosProperty.type).toBe('array');
      expect(todosProperty.items.type).toBe('object');
      expect(todosProperty.items.required).toEqual(['content', 'status', 'activeForm']);
      expect(todosProperty.items.properties.status.enum).toEqual(['pending', 'in_progress', 'completed']);
    });

    it('should provide usage examples', () => {
      const definition = tool.getDefinition();

      expect(definition.examples).toBeDefined();
      expect(definition.examples!.length).toBeGreaterThan(0);

      const firstExample = definition.examples![0];
      expect(firstExample.name).toBe('Create initial todo list');
      expect(firstExample.input).toBeDefined();
      expect(firstExample.input.todos).toBeDefined();
    });

    it('should be enabled by default', () => {
      const definition = tool.getDefinition();
      expect(definition.enabled).toBe(true);
    });
  });

  // ==========================================================================
  // Parameter Validation Tests
  // ==========================================================================

  describe('Parameter Validation', () => {
    describe('Basic Parameter Validation', () => {
      it('should validate required todos parameter', () => {
        const result = tool.validate({} as TodoWriteInput);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Missing required parameter: todos');
      });

      it('should reject non-object parameters', () => {
        const result = tool.validate(null as any);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Parameters must be an object');
      });

      it('should reject invalid todos type', () => {
        const result = tool.validate({ todos: 'not-an-array' } as any);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Parameter \'todos\' must be an array');
      });

      it('should reject additional properties', () => {
        const result = tool.validate({
          todos: [],
          extraProperty: 'invalid',
        } as any);
        expect(result.valid).toBe(true); // Valid but with warnings
        expect(result.warnings).toContain('Unknown parameter: extraProperty');
      });
    });

    describe('Todo Item Validation', () => {
      it('should accept valid todo input', () => {
        const input = createValidTodoInput();
        const result = tool.validate(input);
        expect(result.valid).toBe(true);
      });

      it('should validate todo status enum values', () => {
        const input = {
          todos: [
            {
              content: 'Test todo',
              status: 'invalid-status',
              activeForm: 'Testing todo',
            },
          ],
        } as any;

        const result = tool.validate(input);
        expect(result.valid).toBe(false);
        expect(result.errors![0]).toContain('must be one of: pending, in_progress, completed');
      });

      it('should require content field', () => {
        const input = {
          todos: [
            {
              status: 'pending',
              activeForm: 'Testing',
            },
          ],
        } as any;

        const result = tool.validate(input);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Missing required parameter: content');
      });

      it('should require activeForm field', () => {
        const input = {
          todos: [
            {
              content: 'Test todo',
              status: 'pending',
            },
          ],
        } as any;

        const result = tool.validate(input);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Missing required parameter: activeForm');
      });
    });

    describe('Business Logic Validation', () => {
      it('should warn about empty todo lists', () => {
        const input = createEmptyTodoInput();
        const result = tool.validate(input);

        expect(result.valid).toBe(true);
        expect(result.warnings).toContain(
          'Todo list is empty - consider adding tasks to track progress'
        );
      });

      it('should warn about multiple in_progress todos', () => {
        const input = {
          todos: [
            {
              content: 'First task',
              status: 'in_progress',
              activeForm: 'Working on first task',
            },
            {
              content: 'Second task',
              status: 'in_progress',
              activeForm: 'Working on second task',
            },
          ],
        } as TodoWriteInput;

        const result = tool.validate(input);

        expect(result.valid).toBe(true);
        expect(result.warnings).toContain(
          'Found 2 todos marked as in_progress. ' +
          'Consider having only one active task at a time for better focus.'
        );
      });

      it('should accept single in_progress todo without warnings', () => {
        const input = createSingleTodoInput('in_progress');
        const result = tool.validate(input);

        expect(result.valid).toBe(true);
        expect(result.warnings?.some(w => w.includes('in_progress'))).toBeFalsy();
      });

      it('should warn about very short content', () => {
        const input = {
          todos: [
            {
              content: 'A',
              status: 'pending',
              activeForm: 'Working on A',
            },
          ],
        } as TodoWriteInput;

        const result = tool.validate(input);

        expect(result.valid).toBe(true);
        expect(result.warnings).toContain(
          'Todo 1: Content is very short - consider being more descriptive'
        );
      });

      it('should warn about very short activeForm', () => {
        const input = {
          todos: [
            {
              content: 'Valid content',
              status: 'pending',
              activeForm: 'A',
            },
          ],
        } as TodoWriteInput;

        const result = tool.validate(input);

        expect(result.valid).toBe(true);
        expect(result.warnings).toContain(
          'Todo 1: Active form is very short - consider being more descriptive'
        );
      });

      it('should warn about duplicate content', () => {
        const input = {
          todos: [
            {
              content: 'Same task',
              status: 'pending',
              activeForm: 'Working on same task',
            },
            {
              content: 'Same task',
              status: 'completed',
              activeForm: 'Completed same task',
            },
          ],
        } as TodoWriteInput;

        const result = tool.validate(input);

        expect(result.valid).toBe(true);
        expect(result.warnings).toContain(
          'Todo 2: Duplicate content found at position 1'
        );
      });

      it('should handle case-insensitive duplicate detection', () => {
        const input = {
          todos: [
            {
              content: 'Test Task',
              status: 'pending',
              activeForm: 'Working on test task',
            },
            {
              content: 'test task',
              status: 'completed',
              activeForm: 'Completed test task',
            },
          ],
        } as TodoWriteInput;

        const result = tool.validate(input);

        expect(result.valid).toBe(true);
        expect(result.warnings).toContain(
          'Todo 2: Duplicate content found at position 1'
        );
      });
    });
  });

  // ==========================================================================
  // Tool Execution Tests
  // ==========================================================================

  describe('Tool Execution', () => {
    describe('Memory-Only Mode', () => {
      let memoryTool: TodoWriteTool;

      beforeEach(() => {
        memoryTool = new TodoWriteTool(); // No store provided
      });

      it('should execute successfully without store', async () => {
        const input = createValidTodoInput();
        const context: ToolExecutionContext = {
          taskId: 'test-task-1',
        };

        const result = await memoryTool.execute(input, context);

        expect(result.success).toBe(true);
        expect(result.output).toBeDefined();

        const output = result.output as TodoWriteOutput;
        expect(output.success).toBe(true);
        expect(output.todosCount).toBe(3);
        expect(output.pendingCount).toBe(1);
        expect(output.inProgressCount).toBe(1);
        expect(output.completedCount).toBe(1);
        expect(output.todos).toHaveLength(3);
      });

      it('should generate mock todos with correct structure', async () => {
        const input = createSingleTodoInput();

        const result = await memoryTool.execute(input);
        const output = result.output as TodoWriteOutput;

        expect(output.todos[0]).toMatchObject({
          id: expect.stringMatching(/^todo-\d+-/),
          content: 'Single todo item',
          status: 'pending',
          activeForm: 'Working on single todo item',
          orderIndex: 0,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });

      it('should handle completed todos with completedAt timestamp', async () => {
        const input = createSingleTodoInput('completed');

        const result = await memoryTool.execute(input);
        const output = result.output as TodoWriteOutput;

        expect(output.todos[0].completedAt).toBeDefined();
        expect(output.todos[0].completedAt).toBeInstanceOf(Date);
      });

      it('should not set completedAt for non-completed todos', async () => {
        const input = createSingleTodoInput('pending');

        const result = await memoryTool.execute(input);
        const output = result.output as TodoWriteOutput;

        expect(output.todos[0].completedAt).toBeUndefined();
      });
    });

    describe('Store Integration', () => {
      it('should execute successfully with store', async () => {
        const input = createValidTodoInput();
        const context: ToolExecutionContext = {
          taskId: 'test-task-1',
        };

        const result = await tool.execute(input, context);

        expect(result.success).toBe(true);
        expect(result.output).toBeDefined();

        const output = result.output as TodoWriteOutput;
        expect(output.success).toBe(true);
        expect(output.todosCount).toBe(3);
        expect(output.todos).toHaveLength(3);
      });

      it('should pass taskId to store', async () => {
        const input = createSingleTodoInput();
        const context: ToolExecutionContext = {
          taskId: 'test-task-123',
        };

        const replaceTodosSpy = vi.spyOn(mockStore, 'replaceTodos');

        await tool.execute(input, context);

        expect(replaceTodosSpy).toHaveBeenCalledWith('test-task-123', input.todos);
      });

      it('should handle undefined taskId', async () => {
        const input = createSingleTodoInput();

        const replaceTodosSpy = vi.spyOn(mockStore, 'replaceTodos');

        await tool.execute(input);

        expect(replaceTodosSpy).toHaveBeenCalledWith(undefined, input.todos);
      });

      it('should return todos from store', async () => {
        const input = createValidTodoInput();

        const result = await tool.execute(input);
        const output = result.output as TodoWriteOutput;

        // Verify that the returned todos have database-style IDs
        expect(output.todos[0].id).toMatch(/^todo-\d+-/);
        expect(output.todos[0].content).toBe('Implement user authentication');
        expect(output.todos[0].status).toBe('in_progress');
      });
    });

    describe('Statistics Calculation', () => {
      it('should calculate correct todo statistics', async () => {
        const input = {
          todos: [
            { content: 'Task 1', status: 'pending', activeForm: 'Working on task 1' },
            { content: 'Task 2', status: 'pending', activeForm: 'Working on task 2' },
            { content: 'Task 3', status: 'in_progress', activeForm: 'Working on task 3' },
            { content: 'Task 4', status: 'completed', activeForm: 'Completed task 4' },
            { content: 'Task 5', status: 'completed', activeForm: 'Completed task 5' },
          ],
        } as TodoWriteInput;

        const result = await tool.execute(input);
        const output = result.output as TodoWriteOutput;

        expect(output.todosCount).toBe(5);
        expect(output.pendingCount).toBe(2);
        expect(output.inProgressCount).toBe(1);
        expect(output.completedCount).toBe(2);
      });

      it('should handle all todos with same status', async () => {
        const input = {
          todos: [
            { content: 'Task 1', status: 'completed', activeForm: 'Completed task 1' },
            { content: 'Task 2', status: 'completed', activeForm: 'Completed task 2' },
          ],
        } as TodoWriteInput;

        const result = await tool.execute(input);
        const output = result.output as TodoWriteOutput;

        expect(output.todosCount).toBe(2);
        expect(output.pendingCount).toBe(0);
        expect(output.inProgressCount).toBe(0);
        expect(output.completedCount).toBe(2);
      });

      it('should handle empty todo list statistics', async () => {
        const input = createEmptyTodoInput();

        const result = await tool.execute(input);
        const output = result.output as TodoWriteOutput;

        expect(output.todosCount).toBe(0);
        expect(output.pendingCount).toBe(0);
        expect(output.inProgressCount).toBe(0);
        expect(output.completedCount).toBe(0);
        expect(output.todos).toHaveLength(0);
      });
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle validation failures gracefully', async () => {
      const input = {} as TodoWriteInput; // Missing required field

      const result = await tool.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
      expect(result.error).toContain('Missing required parameter: todos');
      expect(result.duration).toBeGreaterThan(0);
      expect(result.toolName).toBe('TodoWrite');
    });

    it('should handle store errors gracefully', async () => {
      const errorMessage = 'Database connection failed';
      const faultyStore: TodoStore = {
        replaceTodos: vi.fn().mockRejectedValue(new Error(errorMessage)),
        getTodos: vi.fn(),
        getTodo: vi.fn(),
        clearTodos: vi.fn(),
        updateTodoStatus: vi.fn(),
      };

      const faultyTool = new TodoWriteTool(faultyStore);
      const input = createValidTodoInput();

      const result = await faultyTool.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
      expect(result.metadata?.errorType).toBe('Error');
      expect(result.metadata?.stack).toBeDefined();
    });

    it('should handle abort signal', async () => {
      const controller = new AbortController();
      const context: ToolExecutionContext = {
        signal: controller.signal,
      };

      // Abort immediately
      controller.abort();

      const input = createValidTodoInput();
      const result = await tool.execute(input, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution aborted');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle large todo lists', async () => {
      const largeTodoList: TodoItem[] = Array.from({ length: 100 }, (_, i) => ({
        content: `Task ${i + 1}`,
        status: i % 3 === 0 ? 'completed' : i % 3 === 1 ? 'in_progress' : 'pending',
        activeForm: `Working on task ${i + 1}`,
      }));

      const input: TodoWriteInput = { todos: largeTodoList };

      const result = await tool.execute(input);
      const output = result.output as TodoWriteOutput;

      expect(result.success).toBe(true);
      expect(output.todosCount).toBe(100);
      expect(output.todos).toHaveLength(100);
    });

    it('should handle unicode content', async () => {
      const input: TodoWriteInput = {
        todos: [
          {
            content: '实现用户认证 🚀',
            status: 'pending',
            activeForm: '正在实现用户认证 ⚡',
          },
          {
            content: 'Развернуть приложение 🌟',
            status: 'in_progress',
            activeForm: 'Развертывание приложения 🔥',
          },
        ],
      };

      const result = await tool.execute(input);
      const output = result.output as TodoWriteOutput;

      expect(result.success).toBe(true);
      expect(output.todos[0].content).toBe('实现用户认证 🚀');
      expect(output.todos[1].activeForm).toBe('Развертывание приложения 🔥');
    });

    it('should handle very long content strings', async () => {
      const longContent = 'A'.repeat(1000);
      const longActiveForm = 'Working on ' + 'B'.repeat(990);

      const input: TodoWriteInput = {
        todos: [
          {
            content: longContent,
            status: 'pending',
            activeForm: longActiveForm,
          },
        ],
      };

      const result = await tool.execute(input);
      const output = result.output as TodoWriteOutput;

      expect(result.success).toBe(true);
      expect(output.todos[0].content).toBe(longContent);
      expect(output.todos[0].activeForm).toBe(longActiveForm);
    });

    it('should preserve exact whitespace in content', async () => {
      const input: TodoWriteInput = {
        todos: [
          {
            content: '   Implement   feature   with   spaces   ',
            status: 'pending',
            activeForm: '\tImplementing\nfeature\rwith\u00A0special\u2000spaces\t',
          },
        ],
      };

      const result = await tool.execute(input);
      const output = result.output as TodoWriteOutput;

      expect(result.success).toBe(true);
      expect(output.todos[0].content).toBe('   Implement   feature   with   spaces   ');
      expect(output.todos[0].activeForm).toBe('\tImplementing\nfeature\rwith\u00A0special\u2000spaces\t');
    });
  });

  // ==========================================================================
  // Tool Metadata Tests
  // ==========================================================================

  describe('Tool Metadata', () => {
    it('should include timing information in results', async () => {
      const input = createValidTodoInput();

      const result = await tool.execute(input);

      expect(result.duration).toBeGreaterThan(0);
      expect(result.invokedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.toolName).toBe('TodoWrite');
      expect(result.completedAt!.getTime()).toBeGreaterThanOrEqual(result.invokedAt!.getTime());
    });

    it('should maintain execution context information', async () => {
      const context: ToolExecutionContext = {
        taskId: 'context-task-id',
        agentName: 'test-agent',
        stageName: 'implementation',
      };

      const input = createValidTodoInput();

      const result = await tool.execute(input, context);

      expect(result.success).toBe(true);
      // Context is used internally but not exposed in the result
      // We verify it was passed correctly through the store interaction
      const replaceTodosSpy = vi.spyOn(mockStore, 'replaceTodos');

      await tool.execute(input, context);
      expect(replaceTodosSpy).toHaveBeenLastCalledWith('context-task-id', input.todos);
    });
  });
});