# ADR-0013: Task Inspection Commands (apex inspect)

## Status
Proposed

## Date
2024-12-26

## Context

The task requires implementing comprehensive task inspection commands via `apex inspect`. Users need to inspect completed and in-progress tasks to understand:

1. What work was accomplished
2. What files were modified
3. The execution timeline
4. Generated documentation

### Acceptance Criteria

- `apex inspect <taskId>` shows comprehensive task results
- `apex inspect <taskId> --files` lists modified files
- `apex inspect <taskId> --file <path>` shows specific file content
- `apex inspect <taskId> --timeline` shows execution timeline
- `apex inspect <taskId> --docs` shows generated documentation

### Current State Analysis

The existing infrastructure already provides most of the needed data:

1. **TaskInspection Interface** (`InteractionManager.inspectTask()`):
   - Task status, current stage
   - Progress tracking (stages completed, remaining)
   - File changes (created, modified, branches)
   - Usage metrics (tokens, cost, duration)
   - Errors and warnings

2. **TaskStore** provides:
   - Complete task data via `getTask()`
   - Logs via `getLogs()` with filtering options
   - Iteration history via `getIterationHistory()`
   - Artifacts (files, diffs, reports, logs)

3. **ApexOrchestrator** exposes:
   - `getTask()`, `getIterationDiff()`, `getIterationHistory()`
   - Task lifecycle management

4. **CLI Patterns** from `/iterate` command:
   - Argument parsing with flags
   - Colored output with chalk
   - Error handling patterns
   - Task validation patterns

## Decision

We will implement a new `/inspect` CLI command that provides comprehensive task inspection capabilities through multiple sub-commands/flags.

### Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                        CLI Layer                                │
│                                                                  │
│  /inspect <taskId> [options]                                    │
│     │                                                            │
│     ├── (default)    → Show comprehensive summary               │
│     ├── --files      → List all modified files                  │
│     ├── --file <p>   → Show specific file content               │
│     ├── --timeline   → Show execution timeline                  │
│     ├── --docs       → Show generated documentation             │
│     ├── --logs       → Show task logs (with filters)            │
│     ├── --usage      → Show detailed usage/cost breakdown       │
│     └── --json       → Output in JSON format for scripting      │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                     Orchestrator Layer                          │
│                                                                  │
│  ApexOrchestrator                                               │
│     │                                                            │
│     ├── getTask(taskId)           → Full task data              │
│     ├── inspectTask(taskId)       → TaskInspection summary      │
│     ├── getTaskLogs(taskId, opts) → Filtered logs               │
│     ├── getIterationHistory()     → Iteration entries           │
│     └── [NEW] getTaskArtifacts()  → Task artifacts (files/docs) │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                       Store Layer                               │
│                                                                  │
│  TaskStore                                                       │
│     │                                                            │
│     ├── getTask()              → Task with logs, artifacts      │
│     ├── getLogs()              → Logs with level/limit filters  │
│     └── getTaskArtifacts()     → Artifacts by type              │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

### Command Specification

#### 1. Default View: `apex inspect <taskId>`

Displays a comprehensive summary of the task:

```
📋 Task Inspection: abc123

🔖 Status: completed ✅
📝 Description: Implement user authentication
📊 Workflow: feature → Stage: review (5/5 completed)

📈 Progress:
  ✅ planning (planner)
  ✅ architecture (architect)
  ✅ implementation (developer)
  ✅ testing (tester)
  ✅ review (reviewer)

📁 Files Changed:
  + 3 created, M 5 modified, - 0 removed
  Branch: apex/abc123-user-auth

💰 Usage:
  Tokens: 125,430 | Cost: $2.45 | Duration: 45m 23s

🔄 Iterations: 2
  Last feedback: "Add password strength validation"

⚠️  Warnings: 1 | ❌ Errors: 0

Use --files, --timeline, --docs, --logs for more details
```

#### 2. File Listing: `apex inspect <taskId> --files`

Lists all files created/modified by the task:

```
📁 Files Modified by Task abc123

Created (3):
  + src/auth/login.ts
  + src/auth/register.ts
  + src/auth/types.ts

Modified (5):
  M src/routes/index.ts
  M src/middleware/auth.ts
  M package.json
  M src/config.ts
  M README.md

Branch: apex/abc123-user-auth
```

#### 3. File Content: `apex inspect <taskId> --file <path>`

Shows the content of a specific file from the task's artifacts:

```
📄 File: src/auth/login.ts (from task abc123)

────────────────────────────────────────
 1 │ import { User } from './types';
 2 │ import { validatePassword } from './validation';
 3 │
 4 │ export async function login(email: string, password: string): Promise<User> {
 5 │   // Implementation...
 6 │ }
────────────────────────────────────────

Note: This shows the artifact content stored in the task.
Use 'git show apex/abc123-user-auth:src/auth/login.ts' for current branch content.
```

#### 4. Execution Timeline: `apex inspect <taskId> --timeline`

Shows the chronological execution of the task:

```
📅 Execution Timeline: Task abc123

2024-12-26 10:00:00 ──────────────────────────────────────
  📥 Task Created
     Description: Implement user authentication

2024-12-26 10:00:05 ──────────────────────────────────────
  🚀 Stage Started: planning (planner)

2024-12-26 10:05:23 ──────────────────────────────────────
  ✅ Stage Completed: planning
     Summary: Created implementation plan with 5 subtasks
     Duration: 5m 18s | Tokens: 15,420

2024-12-26 10:05:24 ──────────────────────────────────────
  🚀 Stage Started: architecture (architect)

... (continued for each stage)

2024-12-26 10:45:23 ──────────────────────────────────────
  🔄 Iteration #1
     Feedback: "Add password strength validation"
     Files Modified: src/auth/validation.ts

2024-12-26 10:48:15 ──────────────────────────────────────
  ✅ Task Completed
     Total Duration: 45m 23s
     Total Tokens: 125,430
     Estimated Cost: $2.45
```

#### 5. Documentation: `apex inspect <taskId> --docs`

Shows any documentation generated by the task:

```
📚 Generated Documentation: Task abc123

📄 ADR-0015: User Authentication Implementation
────────────────────────────────────────
## Status
Implemented

## Decision
Use JWT tokens with refresh token rotation...

────────────────────────────────────────

📄 API Documentation: /auth endpoints
────────────────────────────────────────
POST /auth/login
  Request: { email: string, password: string }
  Response: { token: string, refreshToken: string }
...

────────────────────────────────────────

No README changes detected.
```

#### 6. Logs View: `apex inspect <taskId> --logs [--level <level>] [--limit <n>]`

Shows task execution logs with filtering:

```
📋 Task Logs: abc123 (last 20 entries)

[2024-12-26 10:00:05] INFO  [planning] Started planning stage
[2024-12-26 10:00:12] INFO  [planning] Analyzing requirements...
[2024-12-26 10:02:30] WARN  [planning] Large task detected, may need decomposition
[2024-12-26 10:05:23] INFO  [planning] Stage completed successfully
...

Use --level error|warn|info|debug to filter
Use --limit <n> to show more entries
```

#### 7. Usage Details: `apex inspect <taskId> --usage`

Shows detailed token usage and cost breakdown:

```
💰 Usage Details: Task abc123

Token Breakdown:
  Input Tokens:   95,230 (76%)
  Output Tokens:  30,200 (24%)
  Total Tokens:   125,430

Cost Breakdown:
  Planning Stage:       $0.35 (12,500 tokens)
  Architecture Stage:   $0.45 (16,000 tokens)
  Implementation Stage: $1.20 (45,000 tokens)
  Testing Stage:        $0.30 (10,430 tokens)
  Review Stage:         $0.15 (5,500 tokens)
  Iterations (2):       $0.50 (36,000 tokens)
  ──────────────────────────────
  Total:                $2.45

Duration:
  Total: 45m 23s
  Planning:       5m 18s
  Architecture:   8m 45s
  Implementation: 20m 10s
  Testing:        7m 30s
  Review:         3m 40s
```

#### 8. JSON Output: `apex inspect <taskId> --json`

Outputs all inspection data as JSON for scripting/integration:

```json
{
  "taskId": "abc123",
  "status": "completed",
  "description": "Implement user authentication",
  "workflow": "feature",
  "currentStage": "review",
  "progress": {
    "stagesCompleted": ["planning", "architecture", "implementation", "testing", "review"],
    "currentStage": null,
    "remainingStages": []
  },
  "files": {
    "created": ["src/auth/login.ts", "src/auth/register.ts", "src/auth/types.ts"],
    "modified": ["src/routes/index.ts", "package.json"],
    "branches": ["apex/abc123-user-auth"]
  },
  "usage": {
    "inputTokens": 95230,
    "outputTokens": 30200,
    "totalTokens": 125430,
    "estimatedCost": 2.45,
    "durationMs": 2723000
  },
  "iterations": 2,
  "errors": [],
  "warnings": ["Large task detected, may need decomposition"],
  "completedAt": "2024-12-26T10:45:23.000Z"
}
```

### Implementation Details

#### New Types

```typescript
// packages/core/src/types.ts

/**
 * Extended task inspection data for comprehensive task analysis
 */
export interface ExtendedTaskInspection extends TaskInspection {
  /** Task description */
  description: string;
  /** Acceptance criteria if defined */
  acceptanceCriteria?: string;
  /** Workflow name */
  workflow: string;
  /** Branch name if created */
  branchName?: string;
  /** PR URL if created */
  prUrl?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Completion timestamp */
  completedAt?: Date;
  /** Number of iterations performed */
  iterationCount: number;
  /** Last iteration feedback */
  lastIterationFeedback?: string;
  /** All task artifacts */
  artifacts: TaskArtifact[];
}

/**
 * Timeline entry for task execution history
 */
export interface TimelineEntry {
  /** Timestamp of the event */
  timestamp: Date;
  /** Type of event */
  type: 'task-created' | 'stage-started' | 'stage-completed' | 'iteration' | 'task-completed' | 'task-failed' | 'error' | 'warning';
  /** Stage name if applicable */
  stage?: string;
  /** Agent name if applicable */
  agent?: string;
  /** Event description */
  description: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Complete task timeline for execution history visualization
 */
export interface TaskTimeline {
  taskId: string;
  entries: TimelineEntry[];
  totalDuration: number; // milliseconds
}
```

#### InteractionManager Extensions

```typescript
// packages/orchestrator/src/interaction-manager.ts

/**
 * Get extended task inspection with full details
 */
async getExtendedInspection(taskId: string): Promise<ExtendedTaskInspection> {
  const task = await this.store.getTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  const basicInspection = await this.inspectTask(taskId);
  const iterationHistory = task.iterationHistory || { entries: [], totalIterations: 0 };

  return {
    ...basicInspection,
    description: task.description,
    acceptanceCriteria: task.acceptanceCriteria,
    workflow: task.workflow,
    branchName: task.branchName,
    prUrl: task.prUrl,
    createdAt: task.createdAt,
    completedAt: task.completedAt,
    iterationCount: iterationHistory.totalIterations,
    lastIterationFeedback: iterationHistory.entries.length > 0
      ? iterationHistory.entries[iterationHistory.entries.length - 1].feedback
      : undefined,
    artifacts: task.artifacts,
  };
}

/**
 * Build execution timeline from task logs
 */
async getTaskTimeline(taskId: string): Promise<TaskTimeline> {
  const task = await this.store.getTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  const entries: TimelineEntry[] = [];

  // Task creation
  entries.push({
    timestamp: task.createdAt,
    type: 'task-created',
    description: `Task created: ${task.description}`,
  });

  // Process logs for stage transitions and events
  for (const log of task.logs) {
    const entry = this.logToTimelineEntry(log);
    if (entry) {
      entries.push(entry);
    }
  }

  // Add iterations
  if (task.iterationHistory) {
    for (const iteration of task.iterationHistory.entries) {
      entries.push({
        timestamp: iteration.timestamp,
        type: 'iteration',
        stage: iteration.stage,
        description: `Iteration: "${iteration.feedback}"`,
        metadata: {
          iterationId: iteration.id,
          modifiedFiles: iteration.modifiedFiles,
          diffSummary: iteration.diffSummary,
        },
      });
    }
  }

  // Task completion
  if (task.completedAt) {
    entries.push({
      timestamp: task.completedAt,
      type: task.status === 'completed' ? 'task-completed' : 'task-failed',
      description: `Task ${task.status}`,
    });
  }

  // Sort by timestamp
  entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const totalDuration = task.completedAt
    ? task.completedAt.getTime() - task.createdAt.getTime()
    : Date.now() - task.createdAt.getTime();

  return {
    taskId,
    entries,
    totalDuration,
  };
}

/**
 * Get documentation artifacts from task
 */
async getTaskDocumentation(taskId: string): Promise<TaskArtifact[]> {
  const task = await this.store.getTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  // Filter artifacts that are documentation-related
  return task.artifacts.filter(artifact =>
    artifact.type === 'report' ||
    artifact.name.toLowerCase().includes('doc') ||
    artifact.name.toLowerCase().includes('readme') ||
    artifact.name.toLowerCase().includes('adr') ||
    artifact.name.toLowerCase().includes('api') ||
    (artifact.path && (
      artifact.path.endsWith('.md') ||
      artifact.path.includes('/docs/')
    ))
  );
}

/**
 * Get specific file artifact by path
 */
async getTaskArtifactByPath(taskId: string, filePath: string): Promise<TaskArtifact | null> {
  const task = await this.store.getTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  // Find artifact matching the path
  return task.artifacts.find(artifact =>
    artifact.path === filePath ||
    artifact.path?.endsWith(filePath) ||
    artifact.name === filePath
  ) || null;
}
```

#### ApexOrchestrator Extensions

```typescript
// packages/orchestrator/src/index.ts

/**
 * Get extended task inspection data
 */
async getExtendedInspection(taskId: string): Promise<ExtendedTaskInspection> {
  return this.interactionManager.getExtendedInspection(taskId);
}

/**
 * Get task execution timeline
 */
async getTaskTimeline(taskId: string): Promise<TaskTimeline> {
  return this.interactionManager.getTaskTimeline(taskId);
}

/**
 * Get task documentation artifacts
 */
async getTaskDocumentation(taskId: string): Promise<TaskArtifact[]> {
  return this.interactionManager.getTaskDocumentation(taskId);
}

/**
 * Get specific file artifact
 */
async getTaskArtifactByPath(taskId: string, filePath: string): Promise<TaskArtifact | null> {
  return this.interactionManager.getTaskArtifactByPath(taskId, filePath);
}
```

#### CLI Command Implementation

```typescript
// packages/cli/src/index.ts

{
  name: 'inspect',
  aliases: ['i'],
  description: 'Inspect task details and results',
  usage: '/inspect <task-id> [--files] [--file <path>] [--timeline] [--docs] [--logs] [--usage] [--json]',
  handler: async (ctx, args) => {
    if (!ctx.orchestrator) {
      console.log(chalk.red('❌ Orchestrator not available'));
      return;
    }

    if (args.length < 1) {
      printInspectUsage();
      return;
    }

    const taskId = args[0];
    const flags = parseFlags(args.slice(1));

    try {
      // Handle different flags
      if (flags.json) {
        await handleJsonOutput(ctx.orchestrator, taskId);
      } else if (flags.files) {
        await handleFilesView(ctx.orchestrator, taskId);
      } else if (flags.file) {
        await handleFileContent(ctx.orchestrator, taskId, flags.file);
      } else if (flags.timeline) {
        await handleTimelineView(ctx.orchestrator, taskId);
      } else if (flags.docs) {
        await handleDocsView(ctx.orchestrator, taskId);
      } else if (flags.logs) {
        await handleLogsView(ctx.orchestrator, taskId, flags);
      } else if (flags.usage) {
        await handleUsageView(ctx.orchestrator, taskId);
      } else {
        await handleDefaultView(ctx.orchestrator, taskId);
      }
    } catch (error) {
      console.log(chalk.red(`❌ Failed to inspect task: ${error}`));
    }
  },
}
```

### File Changes Required

1. **`packages/core/src/types.ts`**
   - Add `ExtendedTaskInspection` interface
   - Add `TimelineEntry` interface
   - Add `TaskTimeline` interface
   - Export new types

2. **`packages/orchestrator/src/interaction-manager.ts`**
   - Add `getExtendedInspection()` method
   - Add `getTaskTimeline()` method
   - Add `getTaskDocumentation()` method
   - Add `getTaskArtifactByPath()` method
   - Add private helper `logToTimelineEntry()`

3. **`packages/orchestrator/src/index.ts`**
   - Add orchestrator methods delegating to InteractionManager

4. **`packages/cli/src/index.ts`**
   - Add `/inspect` command with all subcommands
   - Add helper functions for output formatting
   - Add flag parsing utility

5. **`packages/cli/src/handlers/inspect-handlers.ts`** (NEW)
   - Create dedicated handler file for inspect command logic
   - Implement each view handler function
   - Implement output formatting utilities

### Testing Strategy

1. **Unit Tests** (`packages/orchestrator/src/__tests__/`)
   - `interaction-manager.inspect.test.ts`
   - Test each new method with mocked TaskStore

2. **Integration Tests** (`packages/cli/src/__tests__/`)
   - `inspect-command.test.ts`
   - Test CLI command with all flags
   - Test error handling

3. **Test Coverage**
   - Task not found scenarios
   - Empty files/docs/artifacts
   - Various task statuses
   - JSON output format validation

## Consequences

### Positive
- Comprehensive task introspection capability
- Multiple output formats for different use cases
- JSON output enables scripting and automation
- Consistent with existing CLI patterns
- Leverages existing infrastructure

### Negative
- Additional methods in InteractionManager
- New CLI command adds complexity
- Timeline generation requires log parsing

## Implementation Order

1. **Phase 1: Core Types** (30 min)
   - Add new interfaces to `@apexcli/core`

2. **Phase 2: InteractionManager** (1 hour)
   - Implement new methods
   - Add unit tests

3. **Phase 3: Orchestrator Integration** (30 min)
   - Add delegating methods

4. **Phase 4: CLI Command** (2 hours)
   - Implement `/inspect` command
   - Add all subcommands
   - Implement formatters
   - Add integration tests

5. **Phase 5: Testing & Refinement** (1 hour)
   - Full test coverage
   - Error handling
   - Documentation

## Notes for Implementation Stage

1. Use the existing `/iterate` command as a pattern reference
2. The `TaskInspection` interface already provides most data
3. Task artifacts contain the file content (when captured)
4. Logs contain stage transition events for timeline
5. Consider adding `--verbose` flag for extended output
