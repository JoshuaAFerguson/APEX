/**
 * @fileoverview TodoWrite tool for structured task list management
 *
 * This module implements a TodoWrite tool that enables Claude agents to create
 * and manage structured task lists during coding sessions. The tool provides:
 * - Atomic todo list replacement for consistent state
 * - Status tracking (pending, in_progress, completed)
 * - SQLite persistence for session recovery
 * - Event emission for real-time UI updates
 *
 * @module @apex/core/tools/system/todo-write-tool
 */

import { BaseTool, type ToolExecutionContext } from '../base-tool.js';
import type {
  TodoWriteInput,
  TodoWriteOutput,
  TodoItem,
  Todo,
  TodoStatus,
} from '../../types.js';

/**
 * Interface for todo storage operations.
 * This interface allows for dependency injection and easy testing.
 */
export interface TodoStore {
  /**
   * Replace all todos for a task (atomic operation)
   * @param taskId - The task ID to associate todos with (undefined for global todos)
   * @param items - The new todo items to replace existing ones
   * @returns Promise resolving to the complete todo list with metadata
   */
  replaceTodos(taskId: string | undefined, items: TodoItem[]): Promise<Todo[]>;

  /**
   * Get all todos for a task
   * @param taskId - The task ID (undefined for global todos)
   * @returns Promise resolving to the todo list
   */
  getTodos(taskId: string | undefined): Promise<Todo[]>;

  /**
   * Get a single todo by ID
   * @param todoId - The todo ID
   * @returns Promise resolving to the todo or null if not found
   */
  getTodo(todoId: string): Promise<Todo | null>;

  /**
   * Clear all todos for a task
   * @param taskId - The task ID (undefined for global todos)
   * @returns Promise resolving when cleared
   */
  clearTodos(taskId: string | undefined): Promise<void>;

  /**
   * Update a single todo's status (for partial updates)
   * @param todoId - The todo ID
   * @param status - The new status
   * @returns Promise resolving to the updated todo or null if not found
   */
  updateTodoStatus(todoId: string, status: TodoStatus): Promise<Todo | null>;
}

/**
 * TodoWrite tool for managing structured task lists.
 *
 * This tool creates and manages a todo list for the current coding session,
 * enabling agents to track progress on complex multi-step tasks.
 *
 * Key behaviors:
 * - Replaces the entire todo list with each call (atomic update)
 * - Automatically generates IDs and timestamps
 * - Persists to SQLite for session recovery
 * - Emits events for real-time UI updates
 * - Validates todo list constraints (only one in_progress todo recommended)
 *
 * @example
 * ```typescript
 * const todoTool = new TodoWriteTool(store);
 * const result = await todoTool.execute({
 *   todos: [
 *     {
 *       content: "Implement user authentication",
 *       status: "in_progress",
 *       activeForm: "Implementing user authentication"
 *     },
 *     {
 *       content: "Write tests for authentication",
 *       status: "pending",
 *       activeForm: "Writing tests for authentication"
 *     }
 *   ]
 * }, { taskId: "task-123" });
 * ```
 */
export class TodoWriteTool extends BaseTool<TodoWriteInput, TodoWriteOutput> {
  private store?: TodoStore;

  /**
   * Creates a new TodoWrite tool instance.
   *
   * @param store - Optional TodoStore implementation for persistence.
   *                If not provided, the tool will operate in memory-only mode.
   */
  constructor(store?: TodoStore) {
    super({
      name: 'TodoWrite',
      description: 'Creates and manages a structured task list for tracking progress on complex multi-step tasks',
      category: 'system',
      permissions: ['write'],
      dangerous: false,
      parameters: {
        type: 'object',
        properties: {
          todos: {
            type: 'array',
            description: 'The complete updated todo list',
            items: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description: 'Task description in imperative form (e.g., "Run tests")',
                  minLength: 1,
                },
                status: {
                  type: 'string',
                  enum: ['pending', 'in_progress', 'completed'],
                  description: 'Current status of the todo item',
                },
                activeForm: {
                  type: 'string',
                  description: 'Present continuous form for active display (e.g., "Running tests")',
                  minLength: 1,
                },
              },
              required: ['content', 'status', 'activeForm'],
              additionalProperties: false,
            },
          },
        },
        required: ['todos'],
        additionalProperties: false,
      },
      version: '1.0.0',
      tags: ['system', 'task-management', 'progress-tracking'],
      examples: [
        {
          name: 'Create initial todo list',
          description: 'Create a new todo list for a feature implementation',
          input: {
            todos: [
              {
                content: 'Design the API endpoints',
                status: 'in_progress',
                activeForm: 'Designing the API endpoints',
              },
              {
                content: 'Implement database schema',
                status: 'pending',
                activeForm: 'Implementing database schema',
              },
              {
                content: 'Write unit tests',
                status: 'pending',
                activeForm: 'Writing unit tests',
              },
            ],
          },
        },
        {
          name: 'Update progress',
          description: 'Update the todo list to reflect current progress',
          input: {
            todos: [
              {
                content: 'Design the API endpoints',
                status: 'completed',
                activeForm: 'Designing the API endpoints',
              },
              {
                content: 'Implement database schema',
                status: 'in_progress',
                activeForm: 'Implementing database schema',
              },
              {
                content: 'Write unit tests',
                status: 'pending',
                activeForm: 'Writing unit tests',
              },
            ],
          },
        },
      ],
    });

    this.store = store;
  }

  /**
   * Validates todo list parameters with additional business logic constraints.
   *
   * Beyond basic parameter validation, this method checks:
   * - Todo list is not empty (warning, not error)
   * - Only one todo should be in_progress (warning, not error)
   * - Content and activeForm are meaningful strings
   *
   * @param params - The TodoWrite parameters
   * @param context - Optional execution context
   * @returns Validation result with any errors or warnings
   */
  validate(
    params: TodoWriteInput,
    context?: ToolExecutionContext
  ): { valid: boolean; errors?: string[]; warnings?: string[] } {
    // First run base validation
    const baseValidation = super.validate(params, context);
    if (!baseValidation.valid) {
      return baseValidation;
    }

    const warnings: string[] = [...(baseValidation.warnings || [])];
    const errors: string[] = [];

    // Business logic validation
    const { todos } = params;

    // Warn if todo list is empty
    if (todos.length === 0) {
      warnings.push('Todo list is empty - consider adding tasks to track progress');
    }

    // Check for multiple in_progress todos (warning, not error)
    const inProgressTodos = todos.filter(todo => todo.status === 'in_progress');
    if (inProgressTodos.length > 1) {
      warnings.push(
        `Found ${inProgressTodos.length} todos marked as in_progress. ` +
        'Consider having only one active task at a time for better focus.'
      );
    }

    // Validate individual todos
    todos.forEach((todo, index) => {
      // Check content is meaningful
      if (todo.content.trim().length < 3) {
        warnings.push(`Todo ${index + 1}: Content is very short - consider being more descriptive`);
      }

      // Check activeForm is meaningful
      if (todo.activeForm.trim().length < 3) {
        warnings.push(`Todo ${index + 1}: Active form is very short - consider being more descriptive`);
      }

      // Check for duplicate content
      const duplicateIndex = todos.findIndex((other, otherIndex) =>
        otherIndex !== index && other.content.trim().toLowerCase() === todo.content.trim().toLowerCase()
      );
      if (duplicateIndex !== -1) {
        warnings.push(`Todo ${index + 1}: Duplicate content found at position ${duplicateIndex + 1}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Executes the TodoWrite operation.
   *
   * This method:
   * 1. Gets the task ID from context (if available)
   * 2. Atomically replaces the entire todo list in storage
   * 3. Returns summary statistics about the updated list
   * 4. Emits events for real-time UI updates (if store supports events)
   *
   * @param params - The validated TodoWrite parameters
   * @param context - Execution context containing task information
   * @returns Promise resolving to TodoWrite output with statistics
   */
  protected async executeImpl(
    params: TodoWriteInput,
    context?: ToolExecutionContext
  ): Promise<TodoWriteOutput> {
    const { todos } = params;
    const taskId = context?.taskId;

    // If no store is available, operate in memory-only mode
    if (!this.store) {
      // Create mock Todo objects for response
      const mockTodos: Todo[] = todos.map((item, index) => ({
        id: `todo-${Date.now()}-${index}`,
        content: item.content,
        status: item.status,
        activeForm: item.activeForm,
        taskId,
        orderIndex: index,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: item.status === 'completed' ? new Date() : undefined,
      }));

      return this.createOutput(mockTodos);
    }

    // Replace todos atomically in the store
    const updatedTodos = await this.store.replaceTodos(taskId, todos);

    return this.createOutput(updatedTodos);
  }

  /**
   * Creates the output object with statistics from the todo list.
   *
   * @param todos - The complete todo list
   * @returns TodoWrite output with counts and statistics
   */
  private createOutput(todos: Todo[]): TodoWriteOutput {
    const pendingCount = todos.filter(t => t.status === 'pending').length;
    const inProgressCount = todos.filter(t => t.status === 'in_progress').length;
    const completedCount = todos.filter(t => t.status === 'completed').length;

    return {
      success: true,
      todosCount: todos.length,
      pendingCount,
      inProgressCount,
      completedCount,
      todos,
    };
  }
}