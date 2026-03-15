# ADR-0015: ActiveTasksPanel Dashboard Integration

## Status
Accepted

## Date
2024-01-15

## Context

The dashboard page (`/packages/web-ui/src/app/page.tsx`) currently displays:
1. Stats cards showing task counts by status (pending, active, paused, completed, failed)
2. Total cost metric
3. A "Recent Activity" section showing the last 5 tasks with basic info

The existing `ActiveTasksPanel` component (`/packages/web-ui/src/components/tasks/ActiveTasksPanel.tsx`) provides rich functionality:
- Task filtering (all, active, completed, failed, paused)
- Task cards with progress indicators, elapsed time, and metadata
- Clickable task cards with `onViewDetails` callback
- Refresh functionality
- Compact and full display modes
- Sorted by most recently updated

### Requirements
1. Dashboard page must include ActiveTasksPanel in layout
2. Clicking "view details" must navigate to task detail page (`/tasks/{id}`)
3. Panel must be positioned appropriately in dashboard grid
4. Optional cancel/retry actions should work if exposed

## Decision

### 1. Integration Architecture

Replace the "Recent Activity" card with `ActiveTasksPanel` component, leveraging its existing rich functionality.

```
Dashboard Layout Structure:
┌─────────────────────────────────────────────────────────────────┐
│ Header: Dashboard Title + Refresh Button                        │
├───────┬───────┬───────┬───────┬───────┬───────────────────────┤
│Pending│Active │Paused │Compl. │Failed │ Total Cost            │
│ Card  │ Card  │ Card  │ Card  │ Card  │  Card                 │
├───────┴───────┴───────┴───────┴───────┴───────────────────────┤
│                                                                 │
│              ActiveTasksPanel (Full Width)                      │
│              - Filter tabs: All | Active | Completed | etc.     │
│              - Task cards with progress indicators              │
│              - Click-to-navigate functionality                  │
│              - Cancel/Retry action handlers                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Component Integration Pattern

```typescript
// In /packages/web-ui/src/app/page.tsx

import { useRouter } from 'next/navigation'
import { ActiveTasksPanel } from '@/components/tasks/ActiveTasksPanel'

export default function DashboardPage() {
  const router = useRouter()

  // ... existing state ...
  const [tasks, setTasks] = useState<Task[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Navigation handler for view details
  const handleViewDetails = (taskId: string) => {
    router.push(`/tasks/${taskId}`)
  }

  // Cancel handler (optional action)
  const handleCancel = async (taskId: string) => {
    try {
      setActionLoading(`cancel-${taskId}`)
      await apiClient.cancelTask(taskId)
      await loadDashboard()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel task')
    } finally {
      setActionLoading(null)
    }
  }

  // Retry handler (optional action)
  const handleRetry = async (taskId: string) => {
    try {
      setActionLoading(`retry-${taskId}`)
      await apiClient.retryTask(taskId)
      await loadDashboard()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry task')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    // ... existing stat cards ...

    <div className="mt-8">
      <ActiveTasksPanel
        tasks={tasks}
        onViewDetails={handleViewDetails}
        onRefresh={loadDashboard}
        loading={loading}
        defaultShowActiveOnly={false}  // Show all by default on dashboard
        maxTasks={10}
        compact={false}
      />
    </div>
  )
}
```

### 3. TaskCard Enhancement for Action Handlers

The existing `TaskCard` component needs enhancement to expose cancel/retry actions. We'll use a wrapper pattern or extend the props:

**Option A: Wrapper in ActiveTasksPanel (Recommended)**
Keep TaskCard pure and add action handlers at the panel level through composition.

**Option B: Extend TaskCard props**
Add optional `onCancel` and `onRetry` callbacks to TaskCard.

**Decision**: Option A - Keep TaskCard focused on display, add actions at the panel/page level through a thin wrapper or overlay.

### 4. Data Flow Architecture

```
┌─────────────────────┐
│   DashboardPage     │
│   (page.tsx)        │
├─────────────────────┤
│ State:              │
│ - tasks: Task[]     │
│ - loading: boolean  │
│ - error: string     │
│ - actionLoading     │
├─────────────────────┤
│ Actions:            │
│ - loadDashboard()   │
│ - handleViewDetails │
│ - handleCancel      │
│ - handleRetry       │
└─────────┬───────────┘
          │ props
          ▼
┌─────────────────────┐
│  ActiveTasksPanel   │
│  (component)        │
├─────────────────────┤
│ Props:              │
│ - tasks             │
│ - onViewDetails     │
│ - onRefresh         │
│ - loading           │
│ - onCancel?         │
│ - onRetry?          │
└─────────┬───────────┘
          │ maps tasks
          ▼
┌─────────────────────┐
│     TaskCard        │
│   (per task)        │
├─────────────────────┤
│ - onClick →         │
│   onViewDetails     │
│ - Cancel/Retry via  │
│   action overlay    │
└─────────────────────┘
```

### 5. API Requirements

The existing `apiClient` already provides:
- `listTasks({ limit })` - Fetch tasks with pagination
- `getTaskStats()` - Get task counts by status
- `cancelTask(taskId)` - Cancel a task
- `retryTask(taskId)` - Retry a failed task

No new API endpoints required.

### 6. Extended ActiveTasksPanel Interface

```typescript
export interface ActiveTasksPanelProps {
  /** Array of tasks to display */
  tasks: Task[]
  /** Callback when user wants to view task details */
  onViewDetails?: (taskId: string) => void
  /** Callback to refresh tasks */
  onRefresh?: () => void
  /** Whether the panel is loading */
  loading?: boolean
  /** Whether to show only active tasks by default */
  defaultShowActiveOnly?: boolean
  /** Maximum number of tasks to display */
  maxTasks?: number
  /** Whether to show the panel in compact mode */
  compact?: boolean

  // NEW: Optional action handlers
  /** Callback to cancel a task */
  onCancel?: (taskId: string) => Promise<void>
  /** Callback to retry a task */
  onRetry?: (taskId: string) => Promise<void>
  /** ID of task currently being acted upon (for loading state) */
  actionLoadingTaskId?: string | null
}
```

### 7. TaskCard Action Overlay Pattern

For cancel/retry actions, add a hover-revealed action bar to TaskCard:

```tsx
// Inside TaskCard component
{(onCancel || onRetry) && (
  <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
    {canCancel && onCancel && (
      <button
        onClick={(e) => { e.stopPropagation(); onCancel(task.id); }}
        className="p-1.5 rounded hover:bg-red-500/10 text-foreground-secondary hover:text-red-500"
        title="Cancel task"
        disabled={isActionLoading}
      >
        <XCircle className="w-4 h-4" />
      </button>
    )}
    {canRetry && onRetry && (
      <button
        onClick={(e) => { e.stopPropagation(); onRetry(task.id); }}
        className="p-1.5 rounded hover:bg-green-500/10 text-foreground-secondary hover:text-green-500"
        title="Retry task"
        disabled={isActionLoading}
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    )}
  </div>
)}
```

## Implementation Plan

### Phase 1: Dashboard Integration (Core)
1. Update `DashboardPage` to import `ActiveTasksPanel`
2. Fetch full task list (not just recent 5) for the panel
3. Wire up `onViewDetails` handler with router navigation
4. Wire up `onRefresh` handler to existing `loadDashboard` function
5. Replace "Recent Activity" card with `ActiveTasksPanel`

### Phase 2: Action Handlers (Optional Enhancement)
1. Extend `ActiveTasksPanelProps` with `onCancel`, `onRetry`, `actionLoadingTaskId`
2. Extend `TaskCardProps` with same callbacks
3. Add action buttons to `TaskCard` component
4. Implement action handlers in `DashboardPage`

### Files to Modify
1. `/packages/web-ui/src/app/page.tsx` - Dashboard page integration
2. `/packages/web-ui/src/components/tasks/ActiveTasksPanel.tsx` - Add action props
3. `/packages/web-ui/src/components/tasks/TaskCard.tsx` - Add action buttons
4. `/packages/web-ui/src/components/tasks/__tests__/ActiveTasksPanel.test.tsx` - Update tests
5. `/packages/web-ui/src/components/tasks/__tests__/TaskCard.test.tsx` - Update tests

## Consequences

### Positive
- Reuses existing, well-tested `ActiveTasksPanel` component
- Provides consistent task filtering/viewing across the application
- Navigation follows Next.js patterns with `useRouter`
- Action handlers follow existing patterns from tasks page
- Clean separation of concerns (display vs actions)

### Negative
- Slightly larger initial dashboard load (fetching more task data)
- Added complexity in TaskCard for optional action buttons

### Mitigations
- Use `maxTasks` prop to limit displayed tasks
- Action buttons are optional and only rendered when handlers provided
- Consider lazy-loading or pagination for large task lists

## Related
- ADR-0014: WebSocket Real-time Updates (for future real-time task updates)
- `/packages/web-ui/src/app/tasks/page.tsx` - Reference implementation for task actions
- `/packages/web-ui/src/app/tasks/[id]/page.tsx` - Task detail page (navigation target)
