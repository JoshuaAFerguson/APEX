# ADR-020: TodoWrite Tool Architecture

## Status

Proposed

## Context

APEX needs a TodoWrite tool to provide structured task list management for Claude agents during coding sessions. This tool enables:
- Tracking progress on complex multi-step tasks
- Organizing and demonstrating thoroughness to users
- Showing real-time progress updates during task execution

The tool is referenced in Claude Code's system prompt but must be implemented within APEX's tool infrastructure to integrate with the orchestrator and persistence layer.

## Decision

### Overview

We will implement a TodoWrite tool following the established APEX tool patterns:

1. **Location**: `packages/core/src/tools/system/todo-write-tool.ts`
2. **Category**: `system` (as it's a system-level operation for task management)
3. **Persistence**: SQLite via a new `todos` table in TaskStore
4. **Integration**: Extends `BaseTool` and registers via `ToolRegistry`

### Architecture Components

#### 1. Types and Schemas (packages/core/src/types.ts)

```typescript
// Todo status enumeration
export const TodoStatusSchema = z.enum(['pending', 'in_progress', 'completed']);
export type TodoStatus = z.infer<typeof TodoStatusSchema>;

// Individual todo item
export const TodoItemSchema = z.object({
  /** Display content describing the task in imperative form (e.g., "Run tests") */
  content: z.string().min(1, 'Todo content is required'),
  /** Current status of the todo */
  status: TodoStatusSchema,
  /** Present continuous form for active display (e.g., "Running tests") */
  activeForm: z.string().min(1, 'Active form is required'),
});
export type TodoItem = z.infer<typeof TodoItemSchema>;

// Full todo with metadata (used internally)
export const TodoSchema = z.object({
  /** Unique identifier for this todo */
  id: z.string().min(1),
  /** Display content describing the task */
  content: z.string().min(1),
  /** Current status */
  status: TodoStatusSchema,
  /** Present continuous form for active display */
  activeForm: z.string().min(1),
  /** Associated task ID (if any) */
  taskId: z.string().optional(),
  /** Order/position in the list */
  orderIndex: z.number().int().min(0),
  /** When the todo was created */
  createdAt: z.date(),
  /** When the todo was last updated */
  updatedAt: z.date(),
  /** When the todo was completed (if completed) */
  completedAt: z.date().optional(),
});
export type Todo = z.infer<typeof TodoSchema>;

// TodoWrite tool input schema
export const TodoWriteInputSchema = z.object({
  /** The complete updated todo list */
  todos: z.array(TodoItemSchema),
});
export type TodoWriteInput = z.infer<typeof TodoWriteInputSchema>;
```

#### 2. TodoWrite Tool Implementation (packages/core/src/tools/system/todo-write-tool.ts)

```typescript
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
 */
export class TodoWriteTool extends BaseTool<TodoWriteInput, TodoWriteOutput> {
  private store?: TodoStore;  // Injected dependency

  constructor(store?: TodoStore) {
    super({
      name: 'TodoWrite',
      description: 'Creates and manages a structured task list for tracking progress',
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
                  description: 'Task description in imperative form'
                },
                status: {
                  type: 'string',
                  enum: ['pending', 'in_progress', 'completed'],
                  description: 'Current status of the todo'
                },
                activeForm: {
                  type: 'string',
                  description: 'Present continuous form for display'
                },
              },
              required: ['content', 'status', 'activeForm'],
            },
          },
        },
        required: ['todos'],
        additionalProperties: false,
      },
      version: '1.0.0',
      tags: ['system', 'task-management', 'progress-tracking'],
    });
    this.store = store;
  }

  protected async executeImpl(
    params: TodoWriteInput,
    context?: ToolExecutionContext
  ): Promise<TodoWriteOutput> {
    // Get task ID from context (if available)
    const taskId = context?.taskId;

    // Replace entire todo list atomically
    const todos = await this.store.replaceTodos(taskId, params.todos);

    return {
      success: true,
      todosCount: todos.length,
      pendingCount: todos.filter(t => t.status === 'pending').length,
      inProgressCount: todos.filter(t => t.status === 'in_progress').length,
      completedCount: todos.filter(t => t.status === 'completed').length,
      todos,
    };
  }
}
```

#### 3. Database Schema (packages/orchestrator/src/store.ts)

Add a new `todos` table to TaskStore:

```sql
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL,
  active_form TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX IF NOT EXISTS idx_todos_task_id ON todos(task_id);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_order ON todos(task_id, order_index);
```

#### 4. TodoStore Interface

Add to TaskStore or create a separate TodoStore class:

```typescript
interface TodoStore {
  // Replace all todos for a task (atomic operation)
  replaceTodos(taskId: string | undefined, items: TodoItem[]): Promise<Todo[]>;

  // Get all todos for a task
  getTodos(taskId: string | undefined): Promise<Todo[]>;

  // Get a single todo by ID
  getTodo(todoId: string): Promise<Todo | null>;

  // Clear all todos for a task
  clearTodos(taskId: string | undefined): Promise<void>;

  // Update a single todo's status (for partial updates)
  updateTodoStatus(todoId: string, status: TodoStatus): Promise<Todo | null>;
}
```

#### 5. Directory Structure

```
packages/core/src/tools/
├── system/                       # New directory for system tools
│   ├── index.ts                  # Module exports
│   ├── register.ts               # Registration utilities
│   ├── todo-write-tool.ts        # TodoWrite implementation
│   └── __tests__/
│       ├── todo-write-tool.test.ts
│       └── todo-write-tool.integration.test.ts
└── index.ts                      # Add system tools export
```

### State Transitions

Valid state transitions for todos:
```
pending → in_progress
pending → completed (for skipped/cancelled items)
in_progress → completed
in_progress → pending (for reverting)
completed → pending (for re-doing)
```

The tool enforces:
- Only ONE todo should be `in_progress` at a time (warning, not error)
- All other todos should be `pending` or `completed`

### Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Claude Agent   │────►│  TodoWrite Tool  │────►│   TodoStore     │
│  (via SDK)      │     │  (validation +   │     │   (SQLite)      │
│                 │     │   execution)     │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Event Emitter   │
                        │  (real-time UI)  │
                        └──────────────────┘
```

### Integration Points

1. **AgentToolSchema Update**: Add 'TodoWrite' to the AgentToolSchema enum
2. **Tool Registry**: Register via `registerSystemTools()` function
3. **CLI Display**: Subscribe to todo events for progress visualization
4. **API Streaming**: Include todo updates in WebSocket event stream

### Events Emitted

```typescript
// New event types in ApexEventType
| 'todo:updated'      // Full list was replaced
| 'todo:cleared'      // List was cleared

// Event payload
interface TodoUpdatedEvent {
  type: 'todo:updated';
  taskId: string;
  timestamp: Date;
  data: {
    todos: Todo[];
    pendingCount: number;
    inProgressCount: number;
    completedCount: number;
  };
}
```

## Consequences

### Positive

1. **Consistent Pattern**: Follows existing tool implementation patterns (BaseTool, ToolRegistry)
2. **Persistence**: SQLite storage enables session recovery and cross-restart continuity
3. **Real-time Updates**: Event emission enables live progress display in CLI/UI
4. **Type Safety**: Full Zod validation ensures data integrity
5. **Testability**: Dependency injection of store enables easy unit testing

### Negative

1. **Database Migration**: Requires adding new table to existing databases
2. **Event System**: Adds new event types that consumers must handle
3. **Complexity**: Adds another tool category (system) to maintain

### Neutral

1. **Atomic Updates**: Tool replaces entire list (no partial updates through tool)
2. **Task Association**: Todos are optionally linked to tasks

## Implementation Plan

### Phase 1: Core Implementation
1. Add types to `packages/core/src/types.ts`
2. Create `packages/core/src/tools/system/` directory structure
3. Implement `TodoWriteTool` class
4. Add unit tests for validation and execution logic

### Phase 2: Database Integration
1. Add `todos` table to TaskStore
2. Implement CRUD methods in TaskStore
3. Add migration for existing databases
4. Add integration tests with SQLite

### Phase 3: Registration & Export
1. Create `register.ts` with registration utilities
2. Update `packages/core/src/tools/index.ts` exports
3. Add 'TodoWrite' to AgentToolSchema
4. Add registration tests

### Phase 4: Event Integration
1. Add new event types to ApexEventType
2. Emit events from TodoWriteTool
3. Update CLI to display todo progress
4. Update API WebSocket streaming

## File Changes Summary

### New Files
- `packages/core/src/tools/system/todo-write-tool.ts`
- `packages/core/src/tools/system/index.ts`
- `packages/core/src/tools/system/register.ts`
- `packages/core/src/tools/system/__tests__/todo-write-tool.test.ts`
- `packages/core/src/tools/system/__tests__/todo-write-tool.integration.test.ts`

### Modified Files
- `packages/core/src/types.ts` - Add Todo types and schemas
- `packages/core/src/tools/index.ts` - Export system tools
- `packages/orchestrator/src/store.ts` - Add todos table and methods
- `packages/core/src/types.ts` - Add 'TodoWrite' to AgentToolSchema
- `packages/core/src/types.ts` - Add todo event types

## Testing Requirements

1. **Unit Tests** (todo-write-tool.test.ts)
   - Validation: empty todos, invalid status, missing fields
   - Status transitions: all valid/invalid combinations
   - Multiple todos with status constraints
   - Parameter validation edge cases

2. **Integration Tests** (todo-write-tool.integration.test.ts)
   - Database persistence and retrieval
   - Atomic replacement behavior
   - Task association
   - Event emission verification

3. **Acceptance Tests**
   - End-to-end workflow with orchestrator
   - CLI progress display
   - Session recovery after restart

## References

- ADR-014: BaseTool Abstract Class (base-tool.ts)
- ADR-015: ToolRegistry Singleton (tool-registry.ts)
- Claude Code TodoWrite specification (system prompt)
- Existing tool implementations (ReadTool, BashTool, etc.)
