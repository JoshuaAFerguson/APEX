/**
 * @fileoverview Registration utilities for system tools
 *
 * This module provides functions to register system tools with the ToolRegistry.
 * System tools handle platform-level operations like task management and
 * progress tracking.
 *
 * @module @apex/core/tools/system/register
 */

import { ToolRegistry } from '../tool-registry.js';
import { TodoWriteTool, type TodoStore } from './todo-write-tool.js';

/**
 * Register all system tools with the tool registry.
 *
 * This function registers all available system tools including:
 * - TodoWrite: Structured task list management
 *
 * @param registry - Optional ToolRegistry instance. If not provided, uses the global instance.
 * @param todoStore - Optional TodoStore implementation for persistence
 *
 * @example
 * ```typescript
 * import { registerSystemTools } from '@apex/core/tools/system';
 * import { TaskStore } from '@apex/orchestrator';
 *
 * const taskStore = new TaskStore('/path/to/project');
 * await taskStore.initialize();
 *
 * registerSystemTools(undefined, taskStore);
 * ```
 */
export function registerSystemTools(
  registry?: ToolRegistry,
  todoStore?: TodoStore
): void {
  registerTodoWriteTool(registry, todoStore);
}

/**
 * Register the TodoWrite tool with the tool registry.
 *
 * @param registry - Optional ToolRegistry instance. If not provided, uses the global instance.
 * @param todoStore - Optional TodoStore implementation for persistence
 *
 * @example
 * ```typescript
 * import { registerTodoWriteTool } from '@apex/core/tools/system';
 * import { TaskStore } from '@apex/orchestrator';
 *
 * const taskStore = new TaskStore('/path/to/project');
 * await taskStore.initialize();
 *
 * registerTodoWriteTool(undefined, taskStore);
 * ```
 */
export function registerTodoWriteTool(
  registry?: ToolRegistry,
  todoStore?: TodoStore
): void {
  const targetRegistry = registry ?? ToolRegistry.getInstance();
  const tool = createTodoWriteTool(todoStore);
  targetRegistry.register(tool);
}

/**
 * Create a TodoWrite tool instance.
 *
 * This factory function creates a TodoWriteTool with optional persistence.
 * If no todoStore is provided, the tool operates in memory-only mode.
 *
 * @param todoStore - Optional TodoStore implementation for persistence
 * @returns A new TodoWriteTool instance
 *
 * @example
 * ```typescript
 * import { createTodoWriteTool } from '@apex/core/tools/system';
 * import { TaskStore } from '@apex/orchestrator';
 *
 * // Create with persistence
 * const taskStore = new TaskStore('/path/to/project');
 * await taskStore.initialize();
 * const todoTool = createTodoWriteTool(taskStore);
 *
 * // Create without persistence (memory-only)
 * const memoryTodoTool = createTodoWriteTool();
 *
 * // Execute the tool
 * const result = await todoTool.execute({
 *   todos: [
 *     {
 *       content: "Implement feature",
 *       status: "in_progress",
 *       activeForm: "Implementing feature"
 *     }
 *   ]
 * });
 * ```
 */
export function createTodoWriteTool(todoStore?: TodoStore): TodoWriteTool {
  return new TodoWriteTool(todoStore);
}