# ADR-0012: Iteration History Tracking Enhancement

## Status
Proposed

## Date
2024-12-26

## Context

The task requires enhancing `InteractionManager.iterateTask()` to track iteration history and compute diffs between iterations. Currently:

1. **Current `iterateTask()` implementation** (lines 103-125 in `interaction-manager.ts`): Only emits an event with instructions but doesn't create or store iteration entries.

2. **Existing Infrastructure**:
   - `IterationEntry` and `IterationHistory` types are already defined in `@apexcli/core/types.ts`
   - `TaskStore` already has `addIterationEntry()` and `getIterationHistory()` methods implemented
   - `Task.iterationHistory` field exists and is populated when retrieving tasks
   - The `task_iterations` table exists in SQLite with proper schema

3. **Gap Analysis**:
   - `iterateTask()` doesn't capture before/after state
   - No `getIterationDiff()` method exists on `InteractionManager`
   - Iteration entries aren't created during the iteration flow

## Decision

We will enhance `InteractionManager` with the following architectural changes:

### 1. Enhanced `iterateTask()` Method

The method will be modified to:
1. Capture task state **before** iteration (snapshot of current stage, files, status)
2. Create an `IterationEntry` with the user feedback
3. Emit the iteration event to orchestrator for processing
4. After the orchestrator processes the iteration, capture **after** state
5. Compute diff summary and store the complete iteration entry

**Sequence Flow:**
```
User → iterateTask(taskId, instructions)
         │
         ├── 1. Get current task state (before snapshot)
         │
         ├── 2. Create initial IterationEntry with feedback
         │
         ├── 3. Emit 'task:iterate' event
         │
         ├── 4. (Orchestrator processes iteration asynchronously)
         │
         └── 5. Return iteration ID for tracking
```

### 2. New `getIterationDiff()` Method

A new method to compute differences between iterations:

```typescript
interface IterationDiff {
  iterationId: string;
  previousIterationId?: string;
  stageChange?: { from: string; to: string };
  filesChanged: {
    added: string[];
    modified: string[];
    removed: string[];
  };
  statusChange?: { from: TaskStatus; to: TaskStatus };
  tokenUsageDelta: number;
  costDelta: number;
  summary: string;
}

async getIterationDiff(
  taskId: string,
  iterationId?: string // If not provided, compare last two iterations
): Promise<IterationDiff>
```

### 3. Iteration State Capture

To enable before/after state tracking, we need:

```typescript
interface IterationSnapshot {
  timestamp: Date;
  stage?: string;
  status: TaskStatus;
  files: {
    created: string[];
    modified: string[];
  };
  usage: TaskUsage;
  artifactCount: number;
}
```

### 4. Enhanced IterationEntry (Extension)

Extend the existing `IterationEntry` type in `@apexcli/core` to include:

```typescript
interface IterationEntry {
  // Existing fields
  id: string;
  feedback: string;
  timestamp: Date;
  diffSummary?: string;
  stage?: string;
  modifiedFiles?: string[];
  agent?: string;

  // New fields for before/after tracking
  beforeState?: IterationSnapshot;
  afterState?: IterationSnapshot;
}
```

### 5. Data Storage

The existing `task_iterations` table schema already supports:
- `id`, `task_id`, `feedback`, `timestamp`, `diff_summary`, `stage`, `modified_files`, `agent`

We'll add two new columns:
- `before_state TEXT` - JSON serialized IterationSnapshot
- `after_state TEXT` - JSON serialized IterationSnapshot

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                       InteractionManager                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  iterateTask(taskId, instructions, context)                    │
│     │                                                          │
│     ├── captureSnapshot(taskId) → beforeState                 │
│     │                                                          │
│     ├── createIterationEntry(taskId, feedback, beforeState)   │
│     │                                                          │
│     ├── emit('task:iterate', taskId, { iterationId, ... })    │
│     │                                                          │
│     └── return iterationId                                     │
│                                                                │
│  completeIteration(taskId, iterationId)  ← Called by Runner   │
│     │                                                          │
│     ├── captureSnapshot(taskId) → afterState                  │
│     │                                                          │
│     ├── computeDiffSummary(beforeState, afterState)           │
│     │                                                          │
│     └── updateIterationEntry(iterationId, afterState, diff)   │
│                                                                │
│  getIterationDiff(taskId, iterationId?)                        │
│     │                                                          │
│     ├── getIterationHistory(taskId)                           │
│     │                                                          │
│     ├── findRelevantIterations(iterationId)                   │
│     │                                                          │
│     └── computeDiff(prevIteration, currentIteration)          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
         │                           │
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│    TaskStore    │         │ ApexOrchestrator│
│                 │         │                 │
│ addIterationEntry()       │ Listens to      │
│ getIterationHistory()     │ 'task:iterate'  │
│ updateIterationEntry()    │ events and      │
│ (new)            │        │ processes them  │
└─────────────────┘         └─────────────────┘
```

## Implementation Plan

### Phase 1: Core Type Extensions
1. Add `IterationSnapshot` interface to `@apexcli/core/types.ts`
2. Extend `IterationEntry` with `beforeState` and `afterState` fields
3. Add `IterationDiff` interface to `@apexcli/core/types.ts`

### Phase 2: Database Schema Update
1. Add migration in `TaskStore.runMigrations()` for new columns
2. Update `addIterationEntry()` to handle new fields
3. Add `updateIterationEntry()` method for after-state capture

### Phase 3: InteractionManager Enhancement
1. Add `captureSnapshot()` private method
2. Modify `iterateTask()` to capture before state and create entry
3. Add `completeIteration()` method for after-state capture
4. Implement `getIterationDiff()` method

### Phase 4: Integration
1. Update orchestrator to call `completeIteration()` after processing
2. Add events for iteration lifecycle: `iteration:started`, `iteration:completed`

## Files to Modify

1. **`packages/core/src/types.ts`**
   - Add `IterationSnapshot` interface
   - Add `IterationDiff` interface
   - Extend `IterationEntry` interface

2. **`packages/orchestrator/src/store.ts`**
   - Add migration for `before_state`, `after_state` columns
   - Add `updateIterationEntry()` method
   - Update `rowToIterationEntry()` to parse new fields

3. **`packages/orchestrator/src/interaction-manager.ts`**
   - Add `captureSnapshot()` private method
   - Modify `iterateTask()` to use snapshot capture
   - Add `completeIteration()` public method
   - Implement `getIterationDiff()` public method

4. **`packages/orchestrator/src/index.ts`** (minimal changes)
   - May need to call `completeIteration()` after iteration processing

## Acceptance Criteria Validation

| Criteria | How It's Met |
|----------|--------------|
| `iterateTask()` creates iteration entries with before/after state | Enhanced method captures snapshots and stores entries |
| New `getIterationDiff()` method computes differences | New method compares iteration states and returns diff |
| Iteration history stored in task metadata | Already working via `TaskStore.addIterationEntry()` and `Task.iterationHistory` |

## Risks and Mitigations

1. **Performance**: Snapshot capture adds overhead
   - Mitigation: Snapshots are lightweight (metadata only, not file contents)

2. **Async Processing**: Iteration might complete asynchronously
   - Mitigation: Use iteration ID for tracking, orchestrator calls `completeIteration()`

3. **Backward Compatibility**: New fields on existing types
   - Mitigation: All new fields are optional, existing data continues to work

## Alternatives Considered

1. **Store full file diffs in iteration entries**
   - Rejected: Too expensive in storage and compute
   - Decision: Store file paths and summary only

2. **Real-time diff computation without storage**
   - Rejected: Loses historical comparison capability
   - Decision: Store before/after snapshots for persistence

## Consequences

### Positive
- Full iteration history tracking with before/after states
- Ability to compare any two iterations
- Useful for debugging and understanding task evolution
- Foundation for iteration rollback feature (future)

### Negative
- Slightly increased storage per iteration
- Additional database columns and migration
- Orchestrator needs coordination for `completeIteration()`
