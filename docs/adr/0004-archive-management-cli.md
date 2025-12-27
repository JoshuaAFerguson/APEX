# ADR-0004: Archive Management CLI Commands

## Status
Accepted

## Context
APEX already has the archive functionality implemented at the orchestrator and store layers:
- `TaskStore.archiveTask()` - Archives a completed task (sets `archivedAt` timestamp)
- `TaskStore.unarchiveTask()` - Restores an archived task (clears `archivedAt` timestamp)
- `TaskStore.listArchived()` - Lists all archived tasks
- `ApexOrchestrator.archiveTask()`, `listArchivedTasks()`, `unarchiveTask()` - Wrappers with event emission

However, there are no CLI commands exposing these capabilities to users.

## Decision

### Architecture Overview

We will add CLI commands following the established patterns in the codebase:

```
/archive <taskId>          - Archive a completed task
/archive list              - List all archived tasks
/unarchive <taskId>        - Restore a task from archive
/status [--include-archived] - Include archived tasks in status output
```

### Command Structure

#### 1. Archive Command
```typescript
{
  name: 'archive',
  aliases: ['ar'],
  description: 'Archive completed tasks or list archived tasks',
  usage: '/archive <task_id> | /archive list',
  handler: async (ctx, args) => { /* ... */ }
}
```

The command uses a subcommand pattern (similar to `/daemon start|stop|status`):
- `/archive <taskId>` - Default behavior archives a task
- `/archive list` - Lists all archived tasks

#### 2. Unarchive Command
```typescript
{
  name: 'unarchive',
  aliases: [],
  description: 'Restore a task from archive',
  usage: '/unarchive <task_id>',
  handler: async (ctx, args) => { /* ... */ }
}
```

#### 3. Status Command Enhancement
Add `--include-archived` flag to the existing `/status` command.

### Data Flow

```
CLI Command → ApexOrchestrator → TaskStore → SQLite
     ↓              ↓                ↓
  Console      Event Emit      archived_at column
```

### Implementation Details

#### 1. Archive Command Handler
```typescript
handler: async (ctx, args) => {
  if (!ctx.initialized || !ctx.orchestrator) {
    console.log(chalk.red('APEX not initialized. Run /init first.'));
    return;
  }

  const action = args[0]?.toLowerCase();

  // Handle subcommand: /archive list
  if (action === 'list') {
    const archivedTasks = await ctx.orchestrator.listArchivedTasks();
    // Display logic...
    return;
  }

  // Default: archive a task
  const taskId = args[0];
  if (!taskId) {
    console.log(chalk.red('Usage: /archive <task_id> | /archive list'));
    return;
  }

  // Find task (partial ID support)
  // Call orchestrator.archiveTask()
  // Display result
}
```

#### 2. Status Command Enhancement

Modify the existing status command to:
1. Check for `--include-archived` flag
2. Pass `includeArchived: true` to `listTasks()` when flag is present
3. Display archived indicator for archived tasks

```typescript
// In status handler
const includeArchived = args.includes('--include-archived');
const filteredArgs = args.filter(arg => arg !== '--include-archived' && arg !== '--check-docs');

// When listing tasks
const tasks = await ctx.orchestrator.listTasks({
  limit: 10,
  includeArchived
});
```

### Interface Changes

#### ApexOrchestrator.listTasks()
Current signature:
```typescript
async listTasks(options?: { status?: TaskStatus; limit?: number }): Promise<Task[]>
```

Updated signature:
```typescript
async listTasks(options?: {
  status?: TaskStatus;
  limit?: number;
  includeArchived?: boolean;
}): Promise<Task[]>
```

### Error Messages

| Scenario | Error Message |
|----------|---------------|
| Task not found | `Task not found: <taskId>` |
| Task not completed (archive) | `Cannot archive task <taskId>: only completed tasks can be archived (current status: <status>)` |
| Task not archived (unarchive) | `Task <taskId> is not archived` |
| APEX not initialized | `APEX not initialized. Run /init first.` |

### Display Format

#### Archive List Display
```
📦 Archived Tasks (3)

  apex-abc123def4 ✓ completed  $0.0312  Implement user authentication
    Archived: 2024-01-15 10:30 AM

  apex-xyz789ghi0 ✓ completed  $0.0156  Add logout button
    Archived: 2024-01-14 3:45 PM
```

#### Status with Archived Tasks
```
Recent Tasks:

  apex-abc123def4 ✓ completed   $0.0312  Implement user auth [ARCHIVED]
  apex-xyz789ghi0 ⏳ in-progress $0.0100  Fix bug in login
```

## Consequences

### Positive
- Users can now manage archived tasks from CLI
- Consistent with existing command patterns
- Utilizes already-implemented orchestrator/store functionality
- Non-breaking change to existing commands

### Negative
- Adds two new commands to learn
- Status output slightly more complex with archived indicator

### Neutral
- No database schema changes required (archived_at column already exists)
- No new dependencies required

## Implementation Checklist

1. [ ] Add `/archive` command to CLI commands array
2. [ ] Add `/unarchive` command to CLI commands array
3. [ ] Modify `/status` command to support `--include-archived` flag
4. [ ] Update `ApexOrchestrator.listTasks()` to pass `includeArchived` option
5. [ ] Add helper function for archived task display formatting
6. [ ] Verify build passes
7. [ ] Verify tests pass

## Files to Modify

1. `packages/cli/src/index.ts` - Add archive/unarchive commands, modify status
2. `packages/orchestrator/src/index.ts` - Update listTasks signature to pass includeArchived

## References

- Existing store methods: `packages/orchestrator/src/store.ts` lines 875-912
- Existing orchestrator methods: `packages/orchestrator/src/index.ts` lines 2989-3023
- Command pattern examples: `/daemon`, `/service`, `/idle` commands
