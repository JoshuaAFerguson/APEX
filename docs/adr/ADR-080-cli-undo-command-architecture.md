# ADR-080: CLI Undo Command Architecture

## Status
Proposed

## Date
2025-01-04

## Context

APEX needs a CLI command (`apex undo`) that allows users to revert the last tool action(s) performed during task execution. The orchestrator already has comprehensive undo infrastructure:

### Existing Infrastructure (v0.5.0)

1. **Type Definitions** (`packages/core/src/types.ts`):
   - `ToolAction`: Tracks tool executions with undo capability (id, execution, modifiedFiles, beforeSnapshots, afterSnapshots, canUndo, wasUndone, sequenceNumber, actionGroup)
   - `FileSnapshot`: File state at a point in time (filePath, content, checksum, fileSize, lastModified, existed)
   - `UndoOperationResult`: Result of undo operations (success, actionId, restoredFiles, failedFiles, completedAt, error)
   - `ToolActionRetentionConfig`: Configuration for undo data retention

2. **Database Schema** (`packages/orchestrator/src/store.ts`):
   - `file_snapshots` table: Stores file content before/after modifications
   - `tool_actions` table: Records all tool executions with snapshot references
   - Indexes for efficient querying by task_id, sequence_number, can_undo, was_undone

3. **Orchestrator Methods** (`packages/orchestrator/src/index.ts`):
   - `undoLastAction(taskId)`: Undoes the most recent undoable action for a task
   - Events: `undo:start`, `undo:complete`, `undo:error`

4. **ToolActionStore** (`packages/orchestrator/src/store.ts`):
   - `getUndoableActions(taskId)`: Returns actions where can_undo=1 AND was_undone=0
   - `getToolActions(taskId, limit?, offset?)`: Retrieves all actions for a task
   - `undoAction(taskId, actionId)`: Undoes a specific action by ID

### Gap Analysis

The orchestrator has the core undo functionality, but the CLI lacks:
- A user-facing command to trigger undo operations
- Preview/dry-run capability to show what will be undone
- Support for undoing multiple actions (`--count` flag)
- Interactive selection from undoable actions (`--list` mode)
- Autonomy-aware confirmation dialogs

## Decision

### 1. Command Registration

Add new `undo` command to `packages/cli/src/index.ts`:

```typescript
{
  name: 'undo',
  aliases: ['u'],
  description: 'Undo the last tool action(s) for a task',
  usage: '/undo <task_id> [--count <n>] [--list] [--dry-run] [--yes]',
  handler: undoCommandHandler
}
```

### 2. Command Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--task-id`, `-t` | string | (required or last active task) | Task ID to undo actions from |
| `--count`, `-c` | number | 1 | Number of actions to undo |
| `--list`, `-l` | boolean | false | List undoable actions and allow selection |
| `--dry-run`, `-d` | boolean | false | Show what would be undone without making changes |
| `--yes`, `-y` | boolean | false | Skip confirmation prompt |
| `--action-id`, `-a` | string | - | Undo a specific action by ID |

### 3. Implementation Architecture

#### 3.1 Command Handler Structure

```typescript
// packages/cli/src/index.ts (within commands array)
{
  name: 'undo',
  aliases: ['u'],
  description: 'Undo the last tool action(s) for a task',
  usage: '/undo [task_id] [--count <n>] [--list] [--dry-run] [--yes] [--action-id <id>]',
  handler: async (ctx, args) => {
    // 1. Validate orchestrator initialized
    // 2. Parse arguments and flags
    // 3. Resolve task ID (explicit or last active)
    // 4. Get undoable actions from orchestrator
    // 5. Handle modes: list, dry-run, or execute
    // 6. Show confirmation dialog (unless --yes)
    // 7. Execute undo and display results
  }
}
```

#### 3.2 Mode Handling

**List Mode (`--list`)**:
```
Undoable actions for task abc123:

  #  | Action ID | Tool    | Files Modified | Time
-----|-----------|---------|----------------|------------------
  1  | act_xyz   | Write   | 2 files        | 2 minutes ago
  2  | act_abc   | Edit    | 1 file         | 5 minutes ago
  3  | act_def   | Bash    | 3 files        | 10 minutes ago

Select action(s) to undo: [1]
```

**Dry-Run Mode (`--dry-run`)**:
```
[DRY RUN] The following would be undone:

Action: act_xyz (Write)
Files to restore:
  - src/utils/helper.ts (restore from snapshot)
  - src/index.ts (restore from snapshot)

No changes have been made.
```

**Execute Mode (default)**:
```
Undoing last action for task abc123...

Action: act_xyz (Write)
  Restored: src/utils/helper.ts
  Restored: src/index.ts

Successfully undone 1 action(s).
```

#### 3.3 Confirmation Dialog Integration

Add `UNDO_ACTION` to the `DangerousOperation` enum:

```typescript
// packages/cli/src/utils/confirmation.ts
export enum DangerousOperation {
  // ... existing operations
  UNDO_ACTION = 'undo_action'
}

const OPERATION_CONFIGS: Record<DangerousOperation, OperationWarning> = {
  // ... existing configs
  [DangerousOperation.UNDO_ACTION]: {
    operation: DangerousOperation.UNDO_ACTION,
    title: 'Undo Tool Action',
    description: 'This will restore files to their previous state. Current changes will be lost.',
    consequenceLevel: 'medium',
    irreversible: false
  }
};
```

#### 3.4 Orchestrator API Extensions

Add new methods to `ApexOrchestrator`:

```typescript
// packages/orchestrator/src/index.ts

/**
 * Get preview of what undoing an action would do
 */
async getUndoPreview(taskId: string, actionId?: string): Promise<UndoPreview> {
  const actions = await this.toolActionStore.getUndoableActions(taskId);
  const action = actionId
    ? actions.find(a => a.id === actionId)
    : actions[0];

  if (!action) throw new Error('No undoable action found');

  return {
    actionId: action.id,
    toolName: action.execution.toolName,
    filesAffected: action.beforeSnapshots.map(s => ({
      path: s.filePath,
      operation: s.existed ? 'restore' : 'delete',
      currentSize: fs.existsSync(s.filePath) ? fs.statSync(s.filePath).size : 0,
      snapshotSize: s.fileSize
    })),
    timestamp: action.execution.startTime
  };
}

/**
 * Undo multiple actions in sequence
 */
async undoMultipleActions(taskId: string, count: number): Promise<UndoOperationResult[]> {
  const results: UndoOperationResult[] = [];
  for (let i = 0; i < count; i++) {
    const result = await this.undoLastAction(taskId);
    results.push(result);
    if (!result.success) break; // Stop on first failure
  }
  return results;
}

/**
 * Undo a specific action by ID
 */
async undoSpecificAction(taskId: string, actionId: string): Promise<UndoOperationResult> {
  // Validate action belongs to task and is undoable
  // Perform undo similar to undoLastAction
}
```

### 4. New Type Definitions

```typescript
// packages/core/src/types.ts

/**
 * Preview information for an undo operation
 */
export interface UndoPreview {
  actionId: string;
  toolName: string;
  filesAffected: {
    path: string;
    operation: 'restore' | 'delete';
    currentSize: number;
    snapshotSize: number;
  }[];
  timestamp: Date;
}
```

### 5. Display Formatting

Use consistent chalk colors:
- **Green**: Success indicators, restored files
- **Yellow**: Warnings, partial success
- **Red**: Errors, failed restorations
- **Cyan**: Headers, action details
- **Gray**: Metadata, timestamps

### 6. Error Handling

| Scenario | Error Message | Exit Code |
|----------|--------------|-----------|
| No orchestrator | "APEX not initialized. Run /init first." | 1 |
| Task not found | "Task not found: {taskId}" | 1 |
| No undoable actions | "No undoable actions found for task {taskId}" | 0 |
| Action not found | "Action {actionId} not found or not undoable" | 1 |
| File restore failed | "Failed to restore {path}: {error}" | 1 (partial) |
| Permission denied | "Permission denied: {path}" | 1 |

### 7. Data Flow

```
User: /undo abc123 --count 2
  │
  ├─► Parse arguments
  │
  ├─► ctx.orchestrator.getTask(taskId)
  │     └─► Validate task exists
  │
  ├─► ctx.orchestrator.toolActionStore.getUndoableActions(taskId)
  │     └─► Return actions where can_undo=1 AND was_undone=0
  │
  ├─► Display preview of actions to undo
  │
  ├─► requestConfirmation(DangerousOperation.UNDO_ACTION, autonomyLevel)
  │     └─► Check autonomy config, show dialog if needed
  │
  ├─► ctx.orchestrator.undoMultipleActions(taskId, 2)
  │     │
  │     ├─► Emit 'undo:start' event
  │     ├─► For each action:
  │     │     ├─► Read beforeSnapshots
  │     │     ├─► Restore file content / delete created files
  │     │     ├─► Update database (was_undone=1, undone_at)
  │     │     └─► Optionally remove snapshots
  │     └─► Emit 'undo:complete' or 'undo:error'
  │
  └─► Display results
```

## Consequences

### Positive
- Users can easily revert accidental changes from tool actions
- Preview mode prevents accidental undos
- Multi-action undo enables batch reversions
- Follows existing CLI patterns for consistency
- Integrates with autonomy system for appropriate confirmations

### Negative
- Additional complexity in orchestrator API
- Storage overhead for file snapshots (mitigated by retention config)
- Potential for undo chains (undoing an undo) not yet supported

### Neutral
- Requires documentation updates
- May need UI integration for web interface

## Implementation Plan

### Phase 1: Core Command (Developer Stage)
1. Add `UNDO_ACTION` to `DangerousOperation` enum
2. Add `UndoPreview` type to core types
3. Add `getUndoPreview()` method to orchestrator
4. Implement basic undo command handler with single-action support
5. Add confirmation dialog integration

### Phase 2: Extended Features (Developer Stage)
1. Add `--count` flag support with `undoMultipleActions()`
2. Add `--list` mode with interactive selection
3. Add `--dry-run` mode with preview display
4. Add `--action-id` for specific action undo

### Phase 3: Testing (Tester Stage)
1. Unit tests for command parsing
2. Integration tests for undo operations
3. E2E tests for CLI flow
4. Edge case testing (permissions, missing files, concurrent access)

## Related ADRs
- ADR-018: Dangerous Operation Detector
- ADR-060: Tool System Permissions Architecture

## References
- Existing undo tests: `packages/orchestrator/src/__tests__/comprehensive-undo-*.test.ts`
- Confirmation utilities: `packages/cli/src/utils/confirmation.ts`
- Orchestrator undo implementation: `packages/orchestrator/src/index.ts` (lines 3216-3344)
