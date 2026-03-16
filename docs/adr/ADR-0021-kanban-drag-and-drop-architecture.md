# ADR-0021: Kanban Board Drag-and-Drop Architecture

## Status
Proposed

## Context

The existing `KanbanBoard.tsx` component displays tasks in six columns (Pending, Planning, In Progress, Waiting Approval, Completed, Failed/Cancelled). Currently, users must manually update task status via API calls or CLI commands. We need to add drag-and-drop functionality so users can visually move tasks between columns to change their status.

### Requirements (from Acceptance Criteria)
1. Tasks can be dragged between columns
2. Status updates via API on drop
3. Optimistic UI updates
4. Undo capability on failed updates

### Current Component Analysis
- `KanbanBoard.tsx`: 354 lines, manages column data fetching and display
- `KanbanColumn`: Renders individual columns with collapsible header
- `KanbanCard`: Renders individual task cards with Link wrapper
- API: `apiClient.updateTaskStatus(taskId, { status })` available

## Decision

### Library Selection: @dnd-kit

**Chosen: @dnd-kit/core + @dnd-kit/sortable**

| Criteria | @dnd-kit | react-beautiful-dnd | HTML5 DnD |
|----------|----------|---------------------|-----------|
| Bundle Size | ~8KB gzipped | ~31KB gzipped | 0KB |
| Maintenance | Active (2024+) | Deprecated (Atlassian) | Native |
| Touch Support | Excellent | Good | Poor |
| Accessibility | Built-in a11y | Built-in a11y | Manual |
| Animation | Smooth, configurable | Good | Manual |
| TypeScript | First-class | Good | N/A |
| React 18 | Full support | Issues reported | Full |

**Rationale:**
1. `react-beautiful-dnd` is deprecated by Atlassian (announced 2024)
2. `@dnd-kit` has smaller bundle, better TypeScript support, and active maintenance
3. Native HTML5 drag-and-drop lacks touch support and accessibility features
4. `@dnd-kit`'s modular architecture allows importing only needed features

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         KanbanBoard                                  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    DndContext (Provider)                       │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │              DragOverlay (Floating preview)              │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │                                                               │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │  │
│  │  │ Droppable│  │ Droppable│  │ Droppable│  │ Droppable│     │  │
│  │  │ Column   │  │ Column   │  │ Column   │  │ Column   │     │  │
│  │  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │     │  │
│  │  │ │Drag- │ │  │ │Drag- │ │  │ │Drag- │ │  │ │Drag- │ │     │  │
│  │  │ │gable │ │  │ │gable │ │  │ │gable │ │  │ │gable │ │     │  │
│  │  │ │Card  │ │  │ │Card  │ │  │ │Card  │ │  │ │Card  │ │     │  │
│  │  │ └──────┘ │  │ └──────┘ │  │ └──────┘ │  │ └──────┘ │     │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                     useKanbanDragDrop Hook                     │  │
│  │  - Optimistic state management                                │  │
│  │  - API call orchestration                                     │  │
│  │  - Undo/rollback logic                                        │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Structure

```
packages/web-ui/src/
├── components/tasks/
│   ├── KanbanBoard.tsx          # Updated: Add DndContext wrapper
│   ├── DraggableKanbanCard.tsx  # New: Draggable card wrapper
│   ├── DroppableKanbanColumn.tsx # New: Droppable column wrapper
│   └── __tests__/
│       ├── KanbanBoard.dnd.test.tsx      # Drag-and-drop tests
│       └── useKanbanDragDrop.test.tsx    # Hook tests
├── hooks/
│   ├── useKanbanDragDrop.ts     # New: DnD state management hook
│   └── index.ts                 # Updated: Export new hook
```

### Hook Interface: useKanbanDragDrop

```typescript
interface DragDropState {
  activeId: string | null;           // Currently dragging task ID
  overId: string | null;             // Column being hovered
  pendingUpdates: Map<string, PendingUpdate>; // Optimistic updates in flight
}

interface PendingUpdate {
  taskId: string;
  previousStatus: TaskStatus;
  newStatus: TaskStatus;
  timestamp: number;
  rollback: () => void;
}

interface UseKanbanDragDropOptions {
  onMoveTask: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onMoveSuccess?: (taskId: string) => void;
  onMoveError?: (taskId: string, error: Error) => void;
  undoTimeoutMs?: number;  // Default: 5000ms
}

interface UseKanbanDragDropReturn {
  // State
  activeId: string | null;
  isDragging: boolean;
  pendingUpdates: Map<string, PendingUpdate>;

  // Handlers for DndContext
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;

  // Actions
  undoMove: (taskId: string) => Promise<void>;

  // Optimistic state helpers
  getOptimisticStatus: (task: Task) => TaskStatus;
  isTaskPending: (taskId: string) => boolean;
}
```

### Optimistic Update Flow

```
User Drags Card      Optimistic Update     API Call         Resolution
     │                     │                  │                 │
     ▼                     │                  │                 │
┌─────────┐               │                  │                 │
│ dragEnd │               │                  │                 │
└────┬────┘               │                  │                 │
     │                    ▼                  │                 │
     │           ┌────────────────┐          │                 │
     │           │ Move task in   │          │                 │
     │           │ local state    │          │                 │
     │           │ (optimistic)   │          │                 │
     │           └───────┬────────┘          │                 │
     │                   │                   ▼                 │
     │                   │          ┌────────────────┐         │
     │                   │          │ POST /tasks/   │         │
     │                   │          │ {id}/status    │         │
     │                   │          └───────┬────────┘         │
     │                   │                  │                  │
     │                   │                  ├─── Success ──────┤
     │                   │                  │         │        ▼
     │                   │                  │         │  ┌───────────┐
     │                   │                  │         │  │ Clear     │
     │                   │                  │         │  │ pending   │
     │                   │                  │         │  │ state     │
     │                   │                  │         │  └───────────┘
     │                   │                  │         │
     │                   │                  └─── Error ────────┤
     │                   │                            │        ▼
     │                   │                            │  ┌───────────┐
     │                   │                            │  │ Rollback  │
     │                   │                            │  │ + Toast   │
     │                   │                            │  │ + Undo    │
     │                   │                            │  └───────────┘
```

### Status Transition Rules

Not all status transitions are valid. The drag-and-drop system must enforce these rules:

```typescript
const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  'pending': ['cancelled'],                          // User can cancel pending
  'queued': ['cancelled'],                           // User can cancel queued
  'planning': ['cancelled'],                         // User can cancel planning
  'in-progress': ['paused', 'cancelled'],            // User can pause/cancel running
  'waiting-approval': ['in-progress', 'cancelled'],  // Approve (move forward) or cancel
  'awaiting-approval': ['in-progress', 'cancelled'], // Same as waiting-approval
  'paused': ['in-progress', 'cancelled'],            // Resume or cancel
  'completed': [],                                   // Terminal state - no changes
  'failed': ['pending'],                             // Retry = move back to pending
  'cancelled': ['pending'],                          // Retry = move back to pending
};

// Columns that accept drops (excludes terminal/auto-managed states)
const DROPPABLE_COLUMNS = ['pending', 'cancelled', 'paused'];
```

**Important**: Some transitions require API calls beyond status updates:
- `failed` → `pending`: Must call `retryTask()` API
- `cancelled` → `pending`: Must call `retryTask()` API
- `paused` → `in-progress`: Must call `resumeTask()` API

### Visual Feedback During Drag

```typescript
interface DragFeedback {
  // Card being dragged
  activeCard: {
    scale: 1.02,
    shadow: 'lg',
    opacity: 0.9,
    rotation: '2deg',
    cursor: 'grabbing',
  };

  // Valid drop target column
  validTarget: {
    borderColor: 'border-apex-500',
    backgroundColor: 'bg-apex-500/10',
    ringWidth: '2px',
  };

  // Invalid drop target column
  invalidTarget: {
    borderColor: 'border-red-500/50',
    backgroundColor: 'bg-red-500/5',
    cursor: 'not-allowed',
  };

  // Original card position (placeholder)
  placeholder: {
    opacity: 0.3,
    borderStyle: 'dashed',
    borderColor: 'border-border',
  };
}
```

### Undo Capability Implementation

```typescript
interface UndoToast {
  id: string;
  message: string;           // e.g., "Moved task to Completed"
  taskId: string;
  previousStatus: TaskStatus;
  duration: 5000;            // Auto-dismiss after 5s
  actions: [{
    label: 'Undo',
    onClick: () => undoMove(taskId),
  }];
}

// Toast component integration
function showUndoToast(update: PendingUpdate) {
  toast({
    id: `undo-${update.taskId}`,
    title: 'Task moved',
    description: `Status changed to ${formatStatus(update.newStatus)}`,
    action: (
      <Button variant="outline" size="sm" onClick={() => undoMove(update.taskId)}>
        Undo
      </Button>
    ),
    duration: 5000,
  });
}
```

### Error Handling

```typescript
interface ErrorHandling {
  // API failure
  onApiError: (taskId: string, error: ApiError) => {
    // 1. Rollback optimistic update
    rollbackTask(taskId);

    // 2. Show error toast with retry
    toast.error(`Failed to update task: ${error.message}`, {
      action: {
        label: 'Retry',
        onClick: () => retryMove(taskId),
      },
    });
  };

  // Network timeout
  onTimeout: (taskId: string) => {
    // Keep optimistic state, show warning
    toast.warning('Connection slow - update may be delayed');
  };

  // Invalid transition
  onInvalidTransition: (from: TaskStatus, to: TaskStatus) => {
    // Prevent drop, show informative message
    toast.info(`Cannot move ${formatStatus(from)} tasks to ${formatStatus(to)}`);
  };
}
```

### Accessibility (a11y)

@dnd-kit provides built-in accessibility, but we need to configure it:

```typescript
const announcements: Announcements = {
  onDragStart({ active }) {
    return `Picked up task: ${getTaskDescription(active.id)}`;
  },
  onDragOver({ active, over }) {
    if (over) {
      return `Task is over ${getColumnName(over.id)} column`;
    }
    return 'Task is no longer over a droppable column';
  },
  onDragEnd({ active, over }) {
    if (over) {
      return `Task dropped in ${getColumnName(over.id)} column. Status updated.`;
    }
    return 'Task dropped. No changes made.';
  },
  onDragCancel() {
    return 'Drag cancelled. Task returned to original position.';
  },
};

// Keyboard shortcuts
const keyboardInstructions = `
  Press Space or Enter to start dragging.
  Use arrow keys to move between columns.
  Press Space or Enter to drop.
  Press Escape to cancel.
`;
```

### Performance Considerations

1. **DragOverlay**: Use `DragOverlay` to render dragging card outside DOM hierarchy, preventing expensive re-renders of entire column

2. **Memoization**:
   ```typescript
   const DraggableCard = memo(DraggableKanbanCard, (prev, next) => {
     return prev.task.id === next.task.id &&
            prev.task.status === next.task.status &&
            prev.isDragging === next.isDragging;
   });
   ```

3. **Collision Detection**: Use `closestCenter` algorithm for simple column-based layout

4. **Sensors**:
   ```typescript
   const sensors = useSensors(
     useSensor(PointerSensor, {
       activationConstraint: {
         distance: 8, // Prevent accidental drags
       },
     }),
     useSensor(KeyboardSensor, {
       coordinateGetter: sortableKeyboardCoordinates,
     }),
   );
   ```

### Card Link Handling

The existing `KanbanCard` wraps content in a `Link` component. We need to:

1. Prevent navigation during drag
2. Allow normal click behavior when not dragging

```typescript
function DraggableKanbanCard({ task, ...props }) {
  const { isDragging, listeners, attributes } = useDraggable({ id: task.id });

  return (
    <div {...listeners} {...attributes}>
      <Link
        href={`/tasks/${task.id}`}
        onClick={(e) => {
          if (isDragging) {
            e.preventDefault();
          }
        }}
        draggable={false} // Prevent native drag on link
      >
        <KanbanCardContent task={task} />
      </Link>
    </div>
  );
}
```

### File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `package.json` | Modified | Add @dnd-kit/core, @dnd-kit/sortable |
| `KanbanBoard.tsx` | Modified | Wrap with DndContext, use hook |
| `DraggableKanbanCard.tsx` | New | Draggable wrapper for KanbanCard |
| `DroppableKanbanColumn.tsx` | New | Droppable wrapper for KanbanColumn |
| `useKanbanDragDrop.ts` | New | DnD state management hook |
| `hooks/index.ts` | Modified | Export useKanbanDragDrop |
| Test files | New | Unit and integration tests |

## Consequences

### Positive
- Intuitive task management via drag-and-drop
- Optimistic updates provide responsive UX
- Undo capability prevents accidents
- Full accessibility support
- Touch device support
- Small bundle size addition (~8KB gzipped)
- Active library maintenance

### Negative
- New dependency (@dnd-kit)
- Increased component complexity
- Need to handle edge cases (network failures, concurrent edits)
- Status transition rules must be kept in sync with backend

### Risks
- Race conditions with real-time WebSocket updates
- Potential for inconsistent state if multiple users edit same task
- Performance impact with many tasks (mitigated by virtualization if needed)

## Implementation Notes

### Phase 1: Core Drag-and-Drop (MVP)
1. Install @dnd-kit packages
2. Create `useKanbanDragDrop` hook with optimistic updates
3. Create `DraggableKanbanCard` and `DroppableKanbanColumn`
4. Integrate into `KanbanBoard`
5. Add basic error handling

### Phase 2: Polish
1. Add undo toast capability
2. Implement status transition validation
3. Add visual feedback animations
4. Accessibility announcements

### Phase 3: Testing
1. Unit tests for hook
2. Integration tests for drag operations
3. E2E tests with Playwright

### Dependencies
- @dnd-kit/core: ^6.x
- @dnd-kit/sortable: ^8.x
- @dnd-kit/utilities: ^3.x

### Testing Strategy
1. Unit tests for `useKanbanDragDrop` hook
2. Component tests for drag interactions
3. Integration tests for API calls
4. E2E tests for full drag-drop flow
5. Accessibility tests (keyboard navigation, screen reader)

## References
- [@dnd-kit Documentation](https://docs.dndkit.com/)
- [Existing KanbanBoard.tsx](../../packages/web-ui/src/components/tasks/KanbanBoard.tsx)
- [API Client](../../packages/web-ui/src/lib/api-client.ts)
