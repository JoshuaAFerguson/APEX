# @apexcli/orchestrator

Task orchestration engine for APEX, built on the Claude Agent SDK.

## Overview

This package provides the core execution engine for APEX:

- **Task Orchestration** - Execute multi-stage workflows with specialized AI agents
- **Claude Agent SDK Integration** - Leverage Anthropic's agent SDK for AI interactions
- **SQLite Task Store** - Persistent storage for tasks, logs, and checkpoints
- **Event System** - Real-time events for task progress and status changes
- **Session Management** - Handle context limits with automatic summarization

## Installation

```bash
npm install @apexcli/orchestrator
```

## Usage

### Basic Orchestration

```typescript
import { ApexOrchestrator } from '@apexcli/orchestrator';

// Create orchestrator instance
const orchestrator = new ApexOrchestrator({
  projectPath: '/path/to/project'
});

// Listen for events
orchestrator.on('taskStarted', (event) => {
  console.log(`Task ${event.taskId} started`);
});

orchestrator.on('stageCompleted', (event) => {
  console.log(`Stage ${event.stageName} completed`);
});

// Execute a task
const task = await orchestrator.executeTask(
  'Add user authentication',
  'feature'  // workflow name
);
```

### Task Store

```typescript
import { TaskStore } from '@apexcli/orchestrator';

const store = new TaskStore('/path/to/project/.apex');

// Get all tasks
const tasks = store.getAllTasks();

// Get task by ID
const task = store.getTask('task_123');

// Get task logs
const logs = store.getLogs('task_123');

// Get task checkpoints
const checkpoints = store.getCheckpoints('task_123');
```

### Event Types

| Event | Description |
|-------|-------------|
| `taskQueued` | Task added to queue |
| `taskStarted` | Task execution began |
| `stageStarted` | Workflow stage began |
| `stageCompleted` | Workflow stage finished |
| `taskCompleted` | Task finished successfully |
| `taskFailed` | Task failed with error |
| `taskPaused` | Task paused (awaiting input) |
| `usageUpdated` | Token usage updated |

## Key Classes

### ApexOrchestrator

The main orchestration class that manages task execution:

```typescript
class ApexOrchestrator {
  constructor(options: OrchestratorOptions);

  // Execute a new task
  executeTask(description: string, workflow: string): Promise<Task>;

  // Resume a paused task
  resumeTask(taskId: string, input?: string): Promise<Task>;

  // Cancel a running task
  cancelTask(taskId: string): Promise<void>;

  // Get task status
  getTask(taskId: string): Task | null;
}
```

### TaskStore

SQLite-backed storage for task data:

```typescript
class TaskStore {
  constructor(apexDir: string);

  // Task operations
  createTask(task: Task): void;
  updateTask(taskId: string, updates: Partial<Task>): void;
  getTask(taskId: string): Task | null;
  getAllTasks(): Task[];

  // Logging
  addLog(taskId: string, log: TaskLog): void;
  getLogs(taskId: string): TaskLog[];

  // Checkpoints
  saveCheckpoint(taskId: string, checkpoint: TaskCheckpoint): void;
  getCheckpoints(taskId: string): TaskCheckpoint[];
}
```

## Related Packages

- [@apexcli/core](https://www.npmjs.com/package/@apexcli/core) - Core types and utilities
- [@apexcli/cli](https://www.npmjs.com/package/@apexcli/cli) - Command-line interface
- [@apexcli/api](https://www.npmjs.com/package/@apexcli/api) - REST API server

## License

MIT
