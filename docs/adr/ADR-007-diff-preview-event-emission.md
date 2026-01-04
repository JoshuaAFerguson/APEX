# ADR-007: Diff Preview and Event Emission in Orchestrator

## Status
**Proposed** - Architecture Design Phase

## Date
2026-01-03

## Context

When agents modify files through file-modifying tools (Write, Edit, MultiEdit, NotebookEdit), users need the ability to preview changes before they are applied. This provides:
1. Safety - Users can review destructive operations
2. Transparency - Users understand what changes are being made
3. Control - Users can approve or reject individual file modifications

The `diffPreview` configuration option already exists in `ApexConfig.ui.diffPreview` (defaults to `true`), but no implementation currently pauses tool execution to show diffs and wait for confirmation.

## Decision

Implement diff generation and `diff:preview` event emission in the orchestrator's PreToolUse hook system, with a confirmation-based pause mechanism.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Claude Agent SDK                             │
│                                                                  │
│  ┌─────────────┐     ┌─────────────────┐     ┌─────────────┐   │
│  │ Tool Input  │ ──▶ │  PreToolUse     │ ──▶ │ Tool Exec   │   │
│  │ (Write/Edit)│     │  Hooks          │     │             │   │
│  └─────────────┘     └────────┬────────┘     └─────────────┘   │
│                               │                                  │
└───────────────────────────────┼──────────────────────────────────┘
                                │
                   ┌────────────▼────────────┐
                   │ DiffPreviewHook         │
                   │ - Check diffPreview cfg │
                   │ - Generate unified diff │
                   │ - Emit diff:preview evt │
                   │ - Wait for confirmation │
                   └────────────┬────────────┘
                                │
                   ┌────────────▼────────────┐
                   │ ApexOrchestrator        │
                   │ EventEmitter            │
                   │ - Receives events       │
                   │ - Forwards to CLI/API   │
                   └────────────┬────────────┘
                                │
                   ┌────────────▼────────────┐
                   │ CLI / API Consumer      │
                   │ - Displays diff         │
                   │ - Sends confirmation    │
                   └─────────────────────────┘
```

### Component Design

#### 1. New Event Type: `diff:preview`

Add to `OrchestratorEvents` interface in `packages/orchestrator/src/index.ts`:

```typescript
export interface DiffPreviewEventData {
  /** Task ID */
  taskId: string;
  /** Unique identifier for this diff preview request */
  previewId: string;
  /** Tool that will perform the modification */
  toolName: 'Write' | 'Edit' | 'MultiEdit' | 'NotebookEdit';
  /** Tool use call ID from Claude SDK */
  callId: string;
  /** Absolute path to the file being modified */
  filePath: string;
  /** Content before modification (empty string for new files) */
  beforeContent: string;
  /** Intended content after modification */
  afterContent: string;
  /** Unified diff format string */
  unifiedDiff: string;
  /** Whether this is a new file creation */
  isNewFile: boolean;
  /** Stats about the change */
  stats: {
    linesAdded: number;
    linesRemoved: number;
    netChange: number;
  };
  /** Timestamp of the preview request */
  timestamp: Date;
  /** Timeout in milliseconds for confirmation (from config) */
  confirmationTimeout: number;
  /** Current agent name */
  agentName?: string;
  /** Current stage name */
  stageName?: string;
}

// Add to OrchestratorEvents:
'diff:preview': (event: DiffPreviewEventData) => void;
'diff:confirmed': (event: { previewId: string; confirmed: boolean; confirmedBy: string }) => void;
```

#### 2. DiffPreviewController Class

New file: `packages/orchestrator/src/diff-preview-controller.ts`

```typescript
import { EventEmitter } from 'eventemitter3';

export interface DiffPreviewControllerEvents {
  'preview:requested': (data: DiffPreviewEventData) => void;
  'preview:confirmed': (previewId: string, confirmed: boolean) => void;
  'preview:timeout': (previewId: string) => void;
}

export interface DiffPreviewControllerOptions {
  timeout: number;           // Default timeout in ms (from config.ui.previewTimeout)
  autoConfirm?: boolean;     // For testing or CI environments
  parentEmitter?: EventEmitter;
}

export class DiffPreviewController extends EventEmitter<DiffPreviewControllerEvents> {
  private pendingPreviews: Map<string, {
    resolve: (confirmed: boolean) => void;
    reject: (error: Error) => void;
    timeoutHandle: NodeJS.Timeout;
  }> = new Map();

  private timeout: number;
  private autoConfirm: boolean;
  private parentEmitter?: EventEmitter;

  constructor(options: DiffPreviewControllerOptions) {
    super();
    this.timeout = options.timeout;
    this.autoConfirm = options.autoConfirm ?? false;
    this.parentEmitter = options.parentEmitter;
  }

  /**
   * Request confirmation for a diff preview.
   * Returns a Promise that resolves to true (confirmed) or false (denied).
   */
  async requestConfirmation(previewData: DiffPreviewEventData): Promise<boolean> {
    if (this.autoConfirm) {
      return true;
    }

    // Emit to parent (orchestrator) for forwarding to CLI/API
    this.emit('preview:requested', previewData);
    this.parentEmitter?.emit('diff:preview', previewData);

    return new Promise<boolean>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingPreviews.delete(previewData.previewId);
        this.emit('preview:timeout', previewData.previewId);
        // On timeout, default to DENY for safety
        resolve(false);
      }, previewData.confirmationTimeout);

      this.pendingPreviews.set(previewData.previewId, {
        resolve,
        reject,
        timeoutHandle,
      });
    });
  }

  /**
   * Confirm or deny a pending diff preview.
   */
  confirm(previewId: string, confirmed: boolean, confirmedBy: string = 'user'): void {
    const pending = this.pendingPreviews.get(previewId);
    if (pending) {
      clearTimeout(pending.timeoutHandle);
      this.pendingPreviews.delete(previewId);
      this.emit('preview:confirmed', previewId, confirmed);
      this.parentEmitter?.emit('diff:confirmed', { previewId, confirmed, confirmedBy });
      pending.resolve(confirmed);
    }
  }

  /**
   * Cancel all pending previews (e.g., on task cancellation).
   */
  cancelAll(): void {
    for (const [previewId, pending] of this.pendingPreviews) {
      clearTimeout(pending.timeoutHandle);
      pending.resolve(false);
    }
    this.pendingPreviews.clear();
  }

  dispose(): void {
    this.cancelAll();
    this.removeAllListeners();
  }
}
```

#### 3. Unified Diff Generator Utility

New file: `packages/core/src/unified-diff.ts`

```typescript
export interface UnifiedDiffOptions {
  contextLines?: number;     // Number of context lines (default: 3)
  header?: boolean;          // Include file header (default: true)
  filePath?: string;         // File path for header
  timestamps?: boolean;      // Include timestamps in header
}

export interface DiffStats {
  linesAdded: number;
  linesRemoved: number;
  netChange: number;
}

export interface UnifiedDiffResult {
  diff: string;
  stats: DiffStats;
}

/**
 * Generate a unified diff between two strings.
 * Uses a simple line-based comparison algorithm.
 */
export function generateUnifiedDiff(
  beforeContent: string,
  afterContent: string,
  options: UnifiedDiffOptions = {}
): UnifiedDiffResult {
  const contextLines = options.contextLines ?? 3;
  const includeHeader = options.header ?? true;
  const filePath = options.filePath ?? 'file';

  const beforeLines = beforeContent.split('\n');
  const afterLines = afterContent.split('\n');

  // Build diff using LCS-based algorithm
  const diffLines = computeDiff(beforeLines, afterLines);

  // Calculate stats
  let linesAdded = 0;
  let linesRemoved = 0;
  for (const line of diffLines) {
    if (line.type === 'added') linesAdded++;
    if (line.type === 'removed') linesRemoved++;
  }

  // Generate unified format
  const hunks = createHunks(diffLines, contextLines);
  const unifiedLines: string[] = [];

  if (includeHeader) {
    unifiedLines.push(`--- a/${filePath}`);
    unifiedLines.push(`+++ b/${filePath}`);
  }

  for (const hunk of hunks) {
    unifiedLines.push(hunk.header);
    for (const line of hunk.lines) {
      unifiedLines.push(line);
    }
  }

  return {
    diff: unifiedLines.join('\n'),
    stats: {
      linesAdded,
      linesRemoved,
      netChange: linesAdded - linesRemoved,
    },
  };
}

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

interface Hunk {
  header: string;
  lines: string[];
}

function computeDiff(before: string[], after: string[]): DiffLine[] {
  // Implement Myers diff algorithm or simpler LCS-based approach
  // For now, use a simple sequential comparison
  const result: DiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;

  let i = 0;
  let j = 0;

  while (i < before.length || j < after.length) {
    if (i >= before.length) {
      // Remaining lines in 'after' are additions
      result.push({ type: 'added', content: after[j], newLineNum: newLine++ });
      j++;
    } else if (j >= after.length) {
      // Remaining lines in 'before' are deletions
      result.push({ type: 'removed', content: before[i], oldLineNum: oldLine++ });
      i++;
    } else if (before[i] === after[j]) {
      // Lines match
      result.push({ type: 'unchanged', content: before[i], oldLineNum: oldLine++, newLineNum: newLine++ });
      i++;
      j++;
    } else {
      // Lines differ - try to find next matching line
      // Simple approach: output removed then added
      result.push({ type: 'removed', content: before[i], oldLineNum: oldLine++ });
      i++;
      // Check if next before line matches current after
      if (i < before.length && before[i] === after[j]) {
        // The removed line was an isolated deletion
        continue;
      }
      result.push({ type: 'added', content: after[j], newLineNum: newLine++ });
      j++;
    }
  }

  return result;
}

function createHunks(diffLines: DiffLine[], contextLines: number): Hunk[] {
  // Group changes into hunks with context
  const hunks: Hunk[] = [];
  const changeIndices: number[] = [];

  // Find all changed line indices
  diffLines.forEach((line, idx) => {
    if (line.type !== 'unchanged') {
      changeIndices.push(idx);
    }
  });

  if (changeIndices.length === 0) {
    return [];
  }

  // Group nearby changes into hunks
  let hunkStart = Math.max(0, changeIndices[0] - contextLines);
  let hunkEnd = Math.min(diffLines.length - 1, changeIndices[0] + contextLines);

  for (let i = 1; i < changeIndices.length; i++) {
    const newStart = Math.max(0, changeIndices[i] - contextLines);
    if (newStart <= hunkEnd + 1) {
      // Merge with current hunk
      hunkEnd = Math.min(diffLines.length - 1, changeIndices[i] + contextLines);
    } else {
      // Start new hunk
      hunks.push(createHunk(diffLines, hunkStart, hunkEnd));
      hunkStart = newStart;
      hunkEnd = Math.min(diffLines.length - 1, changeIndices[i] + contextLines);
    }
  }

  hunks.push(createHunk(diffLines, hunkStart, hunkEnd));

  return hunks;
}

function createHunk(diffLines: DiffLine[], start: number, end: number): Hunk {
  const lines: string[] = [];
  let oldStart = 0;
  let newStart = 0;
  let oldCount = 0;
  let newCount = 0;

  for (let i = start; i <= end; i++) {
    const line = diffLines[i];
    if (i === start) {
      oldStart = line.oldLineNum ?? 1;
      newStart = line.newLineNum ?? 1;
    }

    if (line.type === 'unchanged') {
      lines.push(` ${line.content}`);
      oldCount++;
      newCount++;
    } else if (line.type === 'removed') {
      lines.push(`-${line.content}`);
      oldCount++;
    } else if (line.type === 'added') {
      lines.push(`+${line.content}`);
      newCount++;
    }
  }

  const header = `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`;

  return { header, lines };
}
```

#### 4. PreToolUse Hook Integration

Modify `packages/orchestrator/src/hooks.ts`:

```typescript
// Add new imports and context fields
export interface HookContext {
  // ... existing fields ...
  diffPreviewEnabled?: boolean;
  diffPreviewController?: DiffPreviewController;
  confirmationTimeout?: number;
}

// New hook function
async function diffPreviewHook(
  input: HookInput,
  toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  // Skip if diff preview is disabled
  if (!context.diffPreviewEnabled) {
    return {};
  }

  const toolName = getToolName(input);

  // Only handle file-modifying tools
  if (!FILE_MODIFYING_TOOLS.includes(toolName)) {
    return {};
  }

  const toolInput = getToolInput(input);
  const filePath = extractFilePath(toolInput, toolName);

  if (!filePath) {
    return {};
  }

  // Get current file content (before snapshot)
  const beforeContent = context.fileSnapshots?.get(filePath) ?? '';

  // Extract intended content from tool input
  let afterContent: string;
  if (toolName === 'Write') {
    afterContent = toolInput.content as string ?? '';
  } else if (toolName === 'Edit') {
    // For Edit, apply the edit to get intended result
    afterContent = applyEdit(beforeContent, toolInput);
  } else if (toolName === 'MultiEdit') {
    afterContent = applyMultiEdit(beforeContent, toolInput);
  } else {
    // NotebookEdit - handle separately
    return {};
  }

  // Generate unified diff
  const { diff, stats } = generateUnifiedDiff(beforeContent, afterContent, {
    filePath,
    contextLines: 3,
  });

  // Skip if no actual changes
  if (stats.linesAdded === 0 && stats.linesRemoved === 0) {
    return {};
  }

  // Create preview data
  const previewId = crypto.randomUUID();
  const previewData: DiffPreviewEventData = {
    taskId: context.taskId,
    previewId,
    toolName: toolName as DiffPreviewEventData['toolName'],
    callId: toolUseId ?? '',
    filePath,
    beforeContent,
    afterContent,
    unifiedDiff: diff,
    isNewFile: beforeContent === '',
    stats,
    timestamp: new Date(),
    confirmationTimeout: context.confirmationTimeout ?? 30000,
    agentName: context.currentAgent,
    stageName: context.currentStage,
  };

  // Request confirmation (blocks until confirmed/denied/timeout)
  const confirmed = await context.diffPreviewController?.requestConfirmation(previewData);

  if (!confirmed) {
    // User denied or timeout - block the tool execution
    await context.store.addLog(context.taskId, {
      level: 'info',
      message: `File modification denied by user: ${filePath}`,
      metadata: {
        tool: toolName,
        filePath,
        previewId,
        denied: true,
      },
    });

    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'User denied file modification after diff preview',
      },
    };
  }

  // User confirmed - allow tool to proceed
  await context.store.addLog(context.taskId, {
    level: 'info',
    message: `File modification confirmed by user: ${filePath}`,
    metadata: {
      tool: toolName,
      filePath,
      previewId,
      confirmed: true,
    },
  });

  return {};
}

// Add to createHooks():
export function createHooks(context: HookContext): HooksConfig {
  return {
    PreToolUse: [
      // ... existing hooks ...

      // Diff preview hook (runs after file snapshot capture)
      {
        matcher: FILE_MODIFYING_TOOLS,
        hooks: [createHookCallback(context, diffPreviewHook)],
        timeout: 60, // Allow up to 60 seconds for user confirmation
      },

      // ... remaining hooks ...
    ],
    // ... PostToolUse hooks ...
  };
}

// Helper functions for applying edits (to compute intended result)
function applyEdit(content: string, input: Record<string, unknown>): string {
  const oldString = input.old_string as string ?? '';
  const newString = input.new_string as string ?? '';
  const replaceAll = input.replace_all as boolean ?? false;

  if (replaceAll) {
    return content.split(oldString).join(newString);
  }
  return content.replace(oldString, newString);
}

function applyMultiEdit(content: string, input: Record<string, unknown>): string {
  const edits = input.edits as Array<{ old_string: string; new_string: string }> ?? [];
  let result = content;
  for (const edit of edits) {
    result = result.replace(edit.old_string, edit.new_string);
  }
  return result;
}
```

#### 5. Orchestrator Integration

Modify `packages/orchestrator/src/index.ts`:

```typescript
// Add to ApexOrchestrator class
private diffPreviewController?: DiffPreviewController;

async initialize(): Promise<void> {
  // ... existing initialization ...

  // Initialize diff preview controller if enabled
  if (this.effectiveConfig.ui.diffPreview) {
    this.diffPreviewController = new DiffPreviewController({
      timeout: this.effectiveConfig.ui.previewTimeout,
      autoConfirm: false, // Could be configurable for CI
      parentEmitter: this,
    });
  }
}

// Update hook context creation in executeTask/runStage:
private createHookContext(taskId: string): HookContext {
  return {
    taskId,
    store: this.store,
    permissionPresetManager: this.permissionPresetManager,
    eventEmitter: this,
    fileSnapshots: new Map(),
    toolActionStore: this.toolActionStore,
    toolStartTimes: new Map(),
    // NEW: diff preview context
    diffPreviewEnabled: this.effectiveConfig.ui.diffPreview,
    diffPreviewController: this.diffPreviewController,
    confirmationTimeout: this.effectiveConfig.ui.previewTimeout,
    currentAgent: undefined, // Set by stage executor
    currentStage: undefined, // Set by stage executor
  };
}

// Add method for external confirmation
confirmDiffPreview(previewId: string, confirmed: boolean, confirmedBy: string = 'user'): void {
  this.diffPreviewController?.confirm(previewId, confirmed, confirmedBy);
}
```

### Sequence Diagram

```
User         CLI            Orchestrator      DiffController       Hooks          Claude SDK
 │            │                  │                  │                 │                │
 │            │                  │──────────────────│─────────────────│──tool call────▶│
 │            │                  │                  │                 │◀──PreToolUse───│
 │            │                  │                  │◀──requestConf───│                │
 │            │◀──diff:preview───│◀─────emit───────│                  │                │
 │◀──display──│                  │                  │                  │                │
 │            │                  │                  │                  │                │
 │──confirm──▶│                  │                  │                  │                │
 │            │──confirmDiff────▶│                  │                  │                │
 │            │                  │──confirm────────▶│                  │                │
 │            │                  │                  │──resolve────────▶│                │
 │            │                  │                  │                  │──allow/deny──▶│
 │            │                  │                  │                  │                │──exec tool──▶
```

### Configuration

The feature uses existing configuration:

```yaml
# .apex/config.yaml
ui:
  diffPreview: true         # Enable/disable diff preview (default: true)
  previewTimeout: 30000     # Timeout in ms (default: 5000, increased to 30s for diffs)
```

### Edge Cases

1. **New file creation**: `beforeContent` is empty string, diff shows all lines as additions
2. **File deletion**: Not currently handled by these tools (Write creates/overwrites)
3. **Binary files**: Should skip diff preview (detect by file extension or content)
4. **Large files**: Consider limiting diff size or showing summary only
5. **Timeout**: Defaults to DENY for safety (user can re-run task)
6. **MultiEdit**: Apply all edits to compute final state before diff

### Error Handling

1. **Hook timeout**: If confirmation takes too long, deny the operation
2. **Controller disposal**: On task cancellation, cancel all pending previews
3. **Filesystem errors**: Log and skip diff preview if file cannot be read

## Consequences

### Positive
- Users have visibility into file changes before they're applied
- Safety mechanism prevents unintended modifications
- Consistent with existing approval gate pattern
- Integrates with existing DiffPreview CLI component

### Negative
- Adds latency to file operations when enabled
- Requires user interaction (not suitable for fully autonomous mode)
- Complexity in hook ordering and async flow

### Neutral
- Can be disabled via configuration for CI/CD pipelines
- Memory usage increases temporarily during preview (stores before/after content)

## Implementation Plan

### Phase 1: Core Types & Utilities (packages/core)
1. Add `DiffPreviewEventData` type to types.ts
2. Create `unified-diff.ts` utility
3. Export new types

### Phase 2: DiffPreviewController (packages/orchestrator)
1. Create `diff-preview-controller.ts`
2. Add `diff:preview` and `diff:confirmed` events to OrchestratorEvents
3. Unit tests for controller

### Phase 3: Hook Integration (packages/orchestrator)
1. Add diffPreviewHook to hooks.ts
2. Update HookContext interface
3. Integrate with createHooks()

### Phase 4: Orchestrator Integration (packages/orchestrator)
1. Initialize controller in ApexOrchestrator
2. Pass context to hooks
3. Add confirmDiffPreview method
4. Integration tests

### Phase 5: CLI Integration (packages/cli)
1. Listen for diff:preview events
2. Display diff using existing DiffPreview component
3. Handle user confirmation input
4. Send confirmation back to orchestrator

## Files to Create/Modify

### New Files
- `packages/core/src/unified-diff.ts`
- `packages/orchestrator/src/diff-preview-controller.ts`
- `packages/orchestrator/src/__tests__/diff-preview-controller.test.ts`
- `packages/core/src/__tests__/unified-diff.test.ts`

### Modified Files
- `packages/core/src/types.ts` - Add DiffPreviewEventData
- `packages/core/src/index.ts` - Export new types
- `packages/orchestrator/src/index.ts` - Add events, controller, integration
- `packages/orchestrator/src/hooks.ts` - Add diffPreviewHook, context fields

## References

- Existing `diffPreview` config: `packages/core/src/config.ts:554`
- DiffPreview component: `packages/cli/src/ui/components/tools/DiffPreview.tsx`
- ApprovalGateController (similar pattern): `packages/orchestrator/src/approval-gate-controller.ts`
- Hook system: `packages/orchestrator/src/hooks.ts`
- File snapshot capture: `packages/orchestrator/src/hooks.ts:451-529`
