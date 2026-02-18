# ADR-028: Snapshot Capture Integration with Tool Execution Tracking

## Status

Proposed

## Date

2025-01-03

## Context

APEX's hook system captures file snapshots in the PreToolUse hook for file-modifying tools (`Write`, `Edit`, `MultiEdit`, `NotebookEdit`). The snapshots are stored in `context.fileSnapshots` (a `Map<string, string>` in the `HookContext`). However, these snapshots are **not currently linked** to the ToolActionStore's `recordToolAction()` method, which is responsible for persisting tool actions with their before/after snapshots for undo functionality.

### Current State

1. **PreToolUse Hook (`hooks.ts`)**:
   - `captureFileSnapshot()` captures file content before modification
   - Stores content in `context.fileSnapshots.set(filePath, content)`
   - Works for FILE_MODIFYING_TOOLS = `['Write', 'Edit', 'MultiEdit', 'NotebookEdit']`
   - Handles non-existent files (new file creation) by storing empty string

2. **PostToolUse Hook (`hooks.ts`)**:
   - Currently only logs tool completion via `logToolResult()`
   - Does NOT capture after-snapshots or invoke ToolActionStore

3. **ToolActionStore (`store.ts`)**:
   - Has `recordToolAction(taskId, execution, modifiedFiles, beforeSnapshots, afterSnapshots, actionGroup)` method
   - Persists tool actions with FileSnapshot arrays
   - Supports undo via beforeSnapshots restoration

4. **ApexOrchestrator (`index.ts`)**:
   - Creates HookContext with `createHooks()` at line ~1918
   - Has access to `toolActionStore` (line ~426)
   - Does NOT currently pass ToolActionStore to hooks or invoke recordToolAction

### Gap Analysis

The **before snapshots** are captured in PreToolUse but:
- Not converted to proper `FileSnapshot` objects
- Not passed to ToolActionStore
- Not linked to the corresponding tool action

The **after snapshots** are:
- Not captured at all (no PostToolUse handler for file-modifying tools)

The **integration point** is missing:
- No connection between hook lifecycle and ToolActionStore.recordToolAction()

### Acceptance Criteria

> ApexOrchestrator uses ToolActionStore.recordToolAction() with captured snapshots when file-modifying tool completes. Before snapshots are linked to the tool action record.

## Decision

Extend the hook system to integrate snapshot capture with ToolActionStore by:

1. **Extending HookContext** with ToolActionStore reference
2. **Adding a PostToolUse handler** for file-modifying tools that:
   - Retrieves before-snapshots from context
   - Captures after-snapshots
   - Creates FileSnapshot objects with proper metadata
   - Invokes ToolActionStore.recordToolAction()
3. **Creating ToolExecution objects** from hook input data

### Architecture Design

```
┌──────────────────────────────────────────────────────────────────────┐
│                        ApexOrchestrator                               │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    executeStage()                               │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  createHooks(context)                                     │  │  │
│  │  │    - taskId, store, eventEmitter                          │  │  │
│  │  │    + toolActionStore (NEW)                                │  │  │
│  │  │    + currentAgent, currentStage (NEW)                     │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                           hooks.ts                                    │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │ HookContext (EXTENDED)                                           ││
│  │  - taskId: string                                                ││
│  │  - store: TaskStore                                              ││
│  │  - toolActionStore?: ToolActionStore   ◄─── NEW                  ││
│  │  - currentAgent?: string               ◄─── NEW                  ││
│  │  - currentStage?: string               ◄─── NEW                  ││
│  │  - fileSnapshots?: Map<string, string>                           ││
│  │  - toolStartTimes?: Map<string, Date>  ◄─── NEW (for duration)   ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │ PreToolUse Hook: captureFileSnapshot()                           ││
│  │  1. Extract filePath from tool_input                             ││
│  │  2. Read file content (or empty for new files)                   ││
│  │  3. Store in context.fileSnapshots.set(filePath, content)        ││
│  │  4. Record start time: context.toolStartTimes.set(toolUseId)     ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │ PostToolUse Hook: recordToolAction() ◄─── NEW                    ││
│  │  1. Check if FILE_MODIFYING_TOOL                                 ││
│  │  2. Extract filePath from tool_input                             ││
│  │  3. Get before-content from context.fileSnapshots                ││
│  │  4. Read current file content as after-snapshot                  ││
│  │  5. Create FileSnapshot objects (before + after)                 ││
│  │  6. Build ToolExecution from hook input                          ││
│  │  7. Call toolActionStore.recordToolAction()                      ││
│  │  8. Clear snapshot from context.fileSnapshots                    ││
│  └──────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    ToolActionStore.recordToolAction()                 │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │ Receives:                                                         ││
│  │  - taskId: string                                                ││
│  │  - execution: ToolExecution (callId, toolName, input, timing)    ││
│  │  - modifiedFiles: string[] (file paths)                          ││
│  │  - beforeSnapshots: FileSnapshot[]                               ││
│  │  - afterSnapshots: FileSnapshot[]                                ││
│  │                                                                   ││
│  │ Persists to:                                                      ││
│  │  - file_snapshots table (individual snapshots)                   ││
│  │  - tool_actions table (execution + snapshot IDs)                 ││
│  └──────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

### Data Flow Sequence

```
1. Claude Agent invokes file-modifying tool (e.g., Write)
                    │
                    ▼
2. PreToolUse Hook fires
   │ captureFileSnapshot():
   │   - Read current file content (before state)
   │   - Store in context.fileSnapshots Map
   │   - Record start time in context.toolStartTimes
                    │
                    ▼
3. Tool executes (handled by Claude Agent SDK)
                    │
                    ▼
4. PostToolUse Hook fires
   │ recordToolAction():
   │   - Retrieve before-content from context.fileSnapshots
   │   - Read file again for after-content
   │   - Create FileSnapshot objects with checksums
   │   - Build ToolExecution with timing data
   │   - Call toolActionStore.recordToolAction()
                    │
                    ▼
5. ToolActionStore persists action with snapshots
   │   - Store FileSnapshots in file_snapshots table
   │   - Store ToolAction in tool_actions table
   │   - Link snapshots via JSON ID arrays
```

### Interface Changes

#### 1. Extended HookContext (`hooks.ts`)

```typescript
export interface HookContext {
  // Existing fields
  taskId: string;
  store: TaskStore;
  permissionPresetManager?: PermissionPresetManager;
  onToolUse?: (tool: string, input: unknown) => void;
  eventEmitter?: {
    emit: (event: string, data: unknown) => void;
  };
  fileSnapshots?: Map<string, string>;

  // NEW fields for tool action tracking
  toolActionStore?: ToolActionStore;
  currentAgent?: string;
  currentStage?: string;
  toolStartTimes?: Map<string, Date>;  // toolUseId -> start time
}
```

#### 2. New PostToolUse Handler (`hooks.ts`)

```typescript
/**
 * Record completed file-modifying tool action with snapshots
 */
async function recordFileModifyingToolAction(
  input: HookInput,
  toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  const toolName = getToolName(input);

  // Only process file-modifying tools
  if (!FILE_MODIFYING_TOOLS.includes(toolName)) {
    return {};
  }

  // Skip if no toolActionStore available
  if (!context.toolActionStore) {
    return {};
  }

  const toolInput = getToolInput(input);
  const filePath = extractFilePath(toolInput, toolName);

  if (!filePath) {
    return {};
  }

  try {
    // Get before-snapshot content from context
    const beforeContent = context.fileSnapshots?.get(filePath);

    // Capture after-snapshot
    let afterContent: string | null = null;
    let afterExists = true;
    try {
      afterContent = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        // File was deleted
        afterContent = '';
        afterExists = false;
      }
    }

    // Create FileSnapshot objects
    const now = new Date();
    const beforeSnapshot = createFileSnapshot(filePath, beforeContent ?? '', now, {
      isNewFile: beforeContent === '',
      capturedAt: 'before',
    });

    const afterSnapshot = createFileSnapshot(filePath, afterContent ?? '', now, {
      exists: afterExists,
      capturedAt: 'after',
    });

    // Build ToolExecution
    const startTime = context.toolStartTimes?.get(toolUseId ?? '') ?? now;
    const endTime = now;

    const execution: ToolExecution = {
      callId: toolUseId ?? crypto.randomUUID(),
      toolName,
      input: toolInput,
      taskId: context.taskId,
      agentName: context.currentAgent,
      stageName: context.currentStage,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      status: 'completed',
    };

    // Record the action
    await context.toolActionStore.recordToolAction(
      context.taskId,
      execution,
      [filePath],
      [beforeSnapshot],
      [afterSnapshot]
    );

    // Clean up context
    context.fileSnapshots?.delete(filePath);
    context.toolStartTimes?.delete(toolUseId ?? '');

    // Log success
    await context.store.addLog(context.taskId, {
      level: 'debug',
      message: `Tool action recorded: ${toolName} on ${filePath}`,
      metadata: {
        tool: toolName,
        filePath,
        actionId: execution.callId,
        hasBeforeSnapshot: !!beforeContent,
        hasAfterSnapshot: !!afterContent,
      },
    });

  } catch (error) {
    // Log error but don't fail the hook
    await context.store.addLog(context.taskId, {
      level: 'warn',
      message: `Failed to record tool action: ${String(error)}`,
      metadata: {
        tool: toolName,
        filePath,
        error: String(error),
      },
    });
  }

  return {};
}

/**
 * Helper to create FileSnapshot with proper structure
 */
function createFileSnapshot(
  filePath: string,
  content: string,
  timestamp: Date,
  metadata?: Record<string, unknown>
): FileSnapshot {
  return {
    id: crypto.randomUUID(),
    filePath,
    content,
    checksum: crypto.createHash('md5').update(content).digest('hex'),
    fileSize: Buffer.byteLength(content, 'utf8'),
    lastModified: timestamp,
    snapshotTime: timestamp,
    existed: content !== '' || metadata?.isNewFile !== true,
    metadata,
  };
}

/**
 * Helper to extract file path from different tool input formats
 */
function extractFilePath(toolInput: Record<string, unknown>, toolName: string): string | undefined {
  if (toolName === 'NotebookEdit') {
    return toolInput.notebook_path as string | undefined;
  }
  return (toolInput.file_path ?? toolInput.path) as string | undefined;
}
```

#### 3. Updated createHooks() Registration

```typescript
export function createHooks(context: HookContext): HooksConfig {
  return {
    PreToolUse: [
      // ... existing hooks ...

      // Capture file snapshots AND record start time
      {
        matcher: FILE_MODIFYING_TOOLS,
        hooks: [
          createHookCallback(context, captureFileSnapshot),
          createHookCallback(context, recordToolStartTime),  // NEW
        ],
        timeout: 5,
      },

      // ... remaining hooks ...
    ],
    PostToolUse: [
      // Record file-modifying tool actions with snapshots (NEW - runs first)
      {
        matcher: FILE_MODIFYING_TOOLS,
        hooks: [createHookCallback(context, recordFileModifyingToolAction)],
        timeout: 10,  // Allow time for file I/O and DB write
      },

      // Log results (existing)
      {
        hooks: [createHookCallback(context, logToolResult)],
        timeout: 1,
      },
    ],
  };
}

/**
 * Record tool start time for duration calculation
 */
async function recordToolStartTime(
  input: HookInput,
  toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  if (!toolUseId) return {};

  if (!context.toolStartTimes) {
    context.toolStartTimes = new Map();
  }

  context.toolStartTimes.set(toolUseId, new Date());
  return {};
}
```

#### 4. ApexOrchestrator Integration (`index.ts`)

Update `executeStage()` to pass ToolActionStore to hooks:

```typescript
// In executeStage() around line ~1918
const hooks = createHooks({
  taskId: task.id,
  store: this.store,
  toolActionStore: this.toolActionStore,  // NEW
  currentAgent: agent.name,                // NEW
  currentStage: stage.name,                // NEW
  permissionPresetManager: this.permissionPresetManager,
  onToolUse: (tool, input) => {
    this.emit('agent:tool-use', task.id, tool, input);
  },
  eventEmitter: this.events,
});
```

### Error Handling Strategy

1. **PreToolUse failures**: Log warning but allow tool to proceed (fail-open)
2. **PostToolUse failures**: Log warning but don't affect tool result
3. **ToolActionStore errors**: Caught and logged, don't crash task execution
4. **File I/O errors**: Handle gracefully (deleted files, permission issues)

### Performance Considerations

1. **Snapshot size**: File content stored in memory briefly
2. **Database writes**: Async but blocking within hook (10s timeout)
3. **Checksum calculation**: MD5 is fast for typical source files
4. **Map cleanup**: Snapshots removed after recording to prevent memory leak

### Edge Cases

| Scenario | Handling |
|----------|----------|
| New file creation | beforeSnapshot has empty content, `existed: false` |
| File deletion | afterSnapshot has empty content, `existed: false` |
| Tool fails mid-execution | PostToolUse may not fire (SDK behavior) |
| Very large files | No size limit (trusts SDK to limit file access) |
| Binary files | Stored as-is (may cause encoding issues) |
| Concurrent modifications | Each hook invocation is independent |
| toolUseId undefined | Generate UUID for callId |

## Consequences

### Positive

- **Complete audit trail**: Every file modification tracked with before/after state
- **Reliable undo**: Snapshots properly linked to tool actions
- **Minimal changes**: Extends existing hook system
- **Non-breaking**: New fields are optional in HookContext

### Negative

- **Memory overhead**: File content held in context during tool execution
- **Hook complexity**: PostToolUse now does more work
- **Coupling**: Hooks now depend on ToolActionStore (optional)

### Risks

- **Performance impact**: File reads in hooks add latency (mitigated by async)
- **Data consistency**: Snapshot capture and recording are separate operations (mitigated by atomic DB transaction in recordToolAction)

## Implementation Plan

### Phase 1: Core Integration
1. Extend HookContext interface with new fields
2. Implement `recordToolStartTime()` PreToolUse handler
3. Implement `recordFileModifyingToolAction()` PostToolUse handler
4. Update `createHooks()` registration

### Phase 2: Orchestrator Integration
1. Update ApexOrchestrator.executeStage() to pass new context fields
2. Add integration tests

### Phase 3: Testing
1. Unit tests for new hook handlers
2. Integration tests for full flow
3. Edge case tests (new files, deleted files, large files)

## Files to Modify

1. `packages/orchestrator/src/hooks.ts`
   - Extend HookContext interface
   - Add recordToolStartTime() handler
   - Add recordFileModifyingToolAction() handler
   - Update createHooks() registration

2. `packages/orchestrator/src/index.ts`
   - Update createHooks() call in executeStage()
   - Pass toolActionStore, currentAgent, currentStage

3. `packages/orchestrator/src/hooks.test.ts`
   - Add tests for new handlers
   - Test snapshot capture -> recordToolAction flow

## References

- ADR-027: TaskStore Snapshot Persistence Extension
- Existing hooks.ts implementation (captureFileSnapshot, logToolResult)
- ToolActionStore.recordToolAction() method in store.ts (lines 3310-3381)
- FileSnapshot type in @apex/core/types.ts (lines 592-616)
- ToolExecution type in @apex/core/types.ts (lines 529-561)
