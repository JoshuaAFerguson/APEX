# Architecture Decision Record: Bulk Task Operations

**Status**: Proposed
**Date**: 2024-01-XX
**Author**: Architecture Agent

## Context

The APEX web UI needs to support bulk operations on tasks, allowing users to select multiple tasks and perform actions (cancel, retry, delete) on them simultaneously. This feature improves UX when managing many tasks and reduces repetitive clicks.

### Current State

1. **TaskCard.tsx** - Individual task cards with single-task operations (cancel, retry, inject context)
2. **ActiveTasksPanel.tsx** - Displays filtered list of tasks with pagination
3. **ActiveTasksPanelRealtime.tsx** - Real-time WebSocket-connected version with live updates
4. **ApexApiClient** - Existing single-task API methods: `cancelTask()`, `retryTask()`
5. **Checkbox.tsx** - Existing checkbox component with indeterminate state support
6. **Dialog.tsx** - Existing dialog primitives for confirmation flows
7. **ApprovalConfirmationDialog.tsx** - Pattern for confirmation dialogs with loading states

## Decision

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ActiveTasksPanel(Realtime)                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                   BulkSelectionProvider                         │ │
│  │  (Context for selection state across task cards)                │ │
│  │                                                                  │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │                  BulkActionToolbar                          │ │ │
│  │  │  [Select All] [Cancel (3)] [Retry (2)] [Delete (3)]         │ │ │
│  │  │  Progress: ████████░░ 80%                                   │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │                                                                  │ │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐        │ │
│  │  │ [✓] TaskCard  │  │ [✓] TaskCard  │  │ [ ] TaskCard  │        │ │
│  │  │    Task #1    │  │    Task #2    │  │    Task #3    │        │ │
│  │  └───────────────┘  └───────────────┘  └───────────────┘        │ │
│  │                                                                  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                  BulkActionConfirmationDialog                        │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  "You are about to cancel 3 tasks"                              │ │
│  │  [List of affected tasks]                                       │ │
│  │  [ ] Don't ask again for this session                          │ │
│  │  [Cancel] [Confirm]                                             │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Structure

#### 1. New Components

```
packages/web-ui/src/components/tasks/
├── BulkSelectionContext.tsx      # React Context for selection state
├── BulkActionToolbar.tsx         # Toolbar with bulk action buttons
├── BulkOperationProgress.tsx     # Progress indicator for bulk ops
├── BulkActionConfirmationDialog.tsx  # Confirmation dialog
└── hooks/
    └── useBulkTaskOperations.ts  # Custom hook for bulk operations
```

#### 2. Modified Components

```
packages/web-ui/src/components/tasks/
├── TaskCard.tsx                  # Add checkbox, selection state props
├── ActiveTasksPanel.tsx          # Integrate BulkSelectionContext
└── ActiveTasksPanelRealtime.tsx  # Integrate BulkSelectionContext
```

### Key Design Decisions

#### D1: Selection State Management via React Context

**Decision**: Use React Context (`BulkSelectionContext`) to manage selection state across components.

**Rationale**:
- Avoids prop drilling through multiple component layers
- Allows any child component to access/modify selection state
- Enables toolbar to be placed anywhere in the component tree
- Keeps TaskCard component cleaner

**Interface**:
```typescript
interface BulkSelectionState {
  selectedTaskIds: Set<string>
  selectionMode: 'none' | 'some' | 'all'
  isSelectAllChecked: boolean
  isIndeterminate: boolean
}

interface BulkSelectionContextValue {
  state: BulkSelectionState
  toggleTaskSelection: (taskId: string) => void
  selectAll: (taskIds: string[]) => void
  deselectAll: () => void
  isSelected: (taskId: string) => boolean
  getSelectedTasks: () => string[]
  getSelectedCount: () => number
}
```

#### D2: Bulk Operations via Parallel API Calls with Progress Tracking

**Decision**: Execute bulk operations as parallel API calls with centralized progress tracking.

**Rationale**:
- No backend changes required (uses existing single-task endpoints)
- Allows individual task failures without blocking others
- Enables real-time progress updates
- Respects API rate limits via configurable concurrency

**Interface**:
```typescript
interface BulkOperationResult {
  taskId: string
  success: boolean
  error?: string
}

interface BulkOperationProgress {
  total: number
  completed: number
  failed: number
  inProgress: number
  results: BulkOperationResult[]
}

interface UseBulkTaskOperations {
  // State
  isOperating: boolean
  progress: BulkOperationProgress | null

  // Actions
  bulkCancel: (taskIds: string[]) => Promise<BulkOperationResult[]>
  bulkRetry: (taskIds: string[]) => Promise<BulkOperationResult[]>
  bulkDelete: (taskIds: string[]) => Promise<BulkOperationResult[]>

  // Control
  abort: () => void
  reset: () => void
}
```

#### D3: Confirmation Dialog for Destructive Actions

**Decision**: Require confirmation for all destructive bulk actions (cancel, delete), optional for retry.

**Rationale**:
- Prevents accidental mass operations
- Shows clear impact (affected task count/list)
- Follows existing ApprovalConfirmationDialog pattern
- Includes "don't ask again" option for power users

**Operations requiring confirmation**:
| Operation | Requires Confirmation | Reversible |
|-----------|----------------------|------------|
| Cancel    | Yes (destructive)    | No         |
| Delete    | Yes (destructive)    | No         |
| Retry     | No (safe action)     | N/A        |

#### D4: Progressive Enhancement of TaskCard

**Decision**: Add optional selection capability to TaskCard without breaking existing usage.

**Rationale**:
- Maintains backward compatibility
- Selection checkbox only appears when BulkSelectionContext is provided
- Clean separation of concerns

**New TaskCard Props**:
```typescript
interface TaskCardProps {
  // ... existing props

  /** Whether bulk selection mode is enabled */
  selectable?: boolean
  /** Whether this task is currently selected */
  isSelected?: boolean
  /** Callback when selection state changes */
  onSelectionChange?: (taskId: string, selected: boolean) => void
}
```

#### D5: Smart Action Availability

**Decision**: Bulk action buttons should be intelligent about which tasks can receive which actions.

**Rationale**:
- Prevents user confusion
- Shows actionable count per operation
- Disables buttons when no valid targets exist

**Action Eligibility**:
```typescript
const canCancel = (task: Task) =>
  task.status === 'pending' ||
  task.status === 'queued' ||
  task.status === 'in-progress' ||
  task.status === 'planning'

const canRetry = (task: Task) =>
  task.status === 'failed' ||
  task.status === 'cancelled'

const canDelete = (task: Task) =>
  task.status === 'completed' ||
  task.status === 'failed' ||
  task.status === 'cancelled'
```

### Data Flow

```
User clicks checkbox on TaskCard
           │
           ▼
BulkSelectionContext.toggleTaskSelection(taskId)
           │
           ▼
selectedTaskIds Set updated
           │
           ▼
BulkActionToolbar re-renders with updated counts
           │
           ▼
User clicks "Cancel Selected (3)"
           │
           ▼
BulkActionConfirmationDialog opens
           │
           ▼
User confirms
           │
           ▼
useBulkTaskOperations.bulkCancel(selectedTaskIds)
           │
           ▼
Parallel API calls: apiClient.cancelTask(id) × 3
           │  │  │
           ▼  ▼  ▼
BulkOperationProgress updated in real-time
           │
           ▼
Operations complete → results displayed → selection cleared
```

### API Client Extensions

Add new batch helper methods to ApexApiClient:

```typescript
// packages/web-ui/src/lib/api-client.ts

class ApexApiClient {
  // ... existing methods

  /**
   * Cancel multiple tasks in parallel
   * @param taskIds - Array of task IDs to cancel
   * @param options - Configuration for parallel execution
   */
  async bulkCancelTasks(
    taskIds: string[],
    options?: BulkOperationOptions
  ): Promise<BulkOperationResult[]>

  /**
   * Retry multiple tasks in parallel
   */
  async bulkRetryTasks(
    taskIds: string[],
    options?: BulkOperationOptions
  ): Promise<BulkOperationResult[]>

  /**
   * Delete multiple tasks in parallel
   */
  async bulkDeleteTasks(
    taskIds: string[],
    options?: BulkOperationOptions
  ): Promise<BulkOperationResult[]>
}

interface BulkOperationOptions {
  /** Maximum concurrent API calls (default: 5) */
  concurrency?: number
  /** Callback for progress updates */
  onProgress?: (progress: BulkOperationProgress) => void
  /** AbortSignal for cancellation */
  signal?: AbortSignal
}
```

### Component Specifications

#### BulkActionToolbar

```typescript
interface BulkActionToolbarProps {
  /** Currently visible/filtered tasks (for select all) */
  visibleTaskIds: string[]
  /** All tasks for action eligibility calculation */
  tasks: Task[]
  /** Callbacks for bulk operations */
  onBulkCancel: (taskIds: string[]) => Promise<void>
  onBulkRetry: (taskIds: string[]) => Promise<void>
  onBulkDelete: (taskIds: string[]) => Promise<void>
  /** Current operation progress */
  progress?: BulkOperationProgress
  /** Whether any operation is in progress */
  isOperating?: boolean
  /** Compact mode for smaller viewports */
  compact?: boolean
}
```

**Visual States**:
1. **Hidden**: No tasks selected
2. **Active**: Tasks selected, shows action buttons with counts
3. **Operating**: Bulk operation in progress, shows progress bar
4. **Complete**: Operation finished, shows results summary

#### BulkOperationProgress Component

```typescript
interface BulkOperationProgressProps {
  progress: BulkOperationProgress
  operationType: 'cancel' | 'retry' | 'delete'
  onClose?: () => void
  showDetails?: boolean
}
```

**Visual Elements**:
- Progress bar (completed / total)
- Status text: "Cancelling 3 of 5 tasks..."
- Success/failure counts
- Optional expandable error details

### Accessibility Considerations

1. **Keyboard Navigation**:
   - `Space` to toggle task selection
   - `Ctrl/Cmd + A` to select all visible tasks
   - `Escape` to deselect all
   - Tab navigation through toolbar buttons

2. **Screen Reader Support**:
   - Checkbox labels: "Select task [description truncated]"
   - Toolbar announcements: "3 tasks selected. Cancel, Retry, or Delete available"
   - Progress announcements: "Operation in progress. 2 of 5 tasks completed"

3. **Focus Management**:
   - After bulk operation completes, focus returns to first task or toolbar
   - Confirmation dialog traps focus

### Error Handling

1. **Partial Failures**:
   - Continue processing other tasks if one fails
   - Show summary of successes/failures at completion
   - Allow retry of failed items only

2. **Network Errors**:
   - Implement retry with exponential backoff (via existing exponential-backoff.ts)
   - Show clear error state with retry option

3. **Abort Handling**:
   - User can abort in-progress bulk operation
   - Already-completed operations are not rolled back
   - Clear visual indication of aborted state

### Testing Strategy

1. **Unit Tests** (`__tests__/BulkSelectionContext.test.tsx`):
   - Selection state management
   - Select all / deselect all
   - Action eligibility calculation

2. **Component Tests** (`__tests__/BulkActionToolbar.test.tsx`):
   - Button state based on selection
   - Progress display
   - Confirmation dialog interaction

3. **Integration Tests** (`__tests__/BulkTaskOperations.integration.test.tsx`):
   - End-to-end bulk operation flow
   - Error handling scenarios
   - WebSocket update integration

4. **Accessibility Tests**:
   - Keyboard navigation
   - Screen reader announcements
   - Focus management

### Performance Considerations

1. **Large Selection Handling**:
   - Virtualize task list for 100+ tasks
   - Limit concurrent API calls (default: 5)
   - Debounce selection state changes

2. **Memory Management**:
   - Use Set for selectedTaskIds (O(1) lookup)
   - Clear selection after operation completion
   - Avoid storing full Task objects in selection state

### File Structure Summary

```
packages/web-ui/src/
├── components/tasks/
│   ├── BulkSelectionContext.tsx       # NEW - Selection state context
│   ├── BulkActionToolbar.tsx          # NEW - Action toolbar
│   ├── BulkOperationProgress.tsx      # NEW - Progress indicator
│   ├── BulkActionConfirmationDialog.tsx # NEW - Confirmation dialog
│   ├── TaskCard.tsx                   # MODIFIED - Add selection props
│   ├── ActiveTasksPanel.tsx           # MODIFIED - Integrate bulk selection
│   ├── ActiveTasksPanelRealtime.tsx   # MODIFIED - Integrate bulk selection
│   └── __tests__/
│       ├── BulkSelectionContext.test.tsx    # NEW
│       ├── BulkActionToolbar.test.tsx       # NEW
│       ├── BulkOperationProgress.test.tsx   # NEW
│       └── BulkTaskOperations.integration.test.tsx # NEW
├── hooks/
│   └── useBulkTaskOperations.ts       # NEW - Bulk operation hook
├── lib/
│   └── api-client.ts                  # MODIFIED - Add bulk methods
└── types/
    └── bulk-operations.ts             # NEW - Type definitions
```

### Migration Path

1. **Phase 1**: Create selection context and hook (no UI changes)
2. **Phase 2**: Add bulk methods to API client
3. **Phase 3**: Create toolbar and confirmation dialog components
4. **Phase 4**: Integrate into ActiveTasksPanel (non-realtime)
5. **Phase 5**: Integrate into ActiveTasksPanelRealtime
6. **Phase 6**: Add progress indicator and error handling
7. **Phase 7**: Testing and accessibility audit

## Consequences

### Positive

- Significant UX improvement for managing multiple tasks
- Reusable selection context pattern for future features
- No backend changes required
- Follows existing patterns in the codebase

### Negative

- Increased component complexity
- Additional network calls (no batch API)
- Selection state needs synchronization with task list updates

### Risks

- Race conditions with real-time WebSocket updates during bulk operations
  - **Mitigation**: Lock selection during operation, refresh after completion

- API rate limiting with large bulk operations
  - **Mitigation**: Configurable concurrency limit, progress tracking

## References

- Existing patterns: `ApprovalConfirmationDialog.tsx`
- Existing components: `Checkbox.tsx`, `Dialog.tsx`, `Progress.tsx`
- API client: `api-client.ts`
- WebSocket integration: `useRealtimeUpdates.ts`
