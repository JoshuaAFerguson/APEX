# ADR: ActiveTasksPanel Component Architecture

## Status
Proposed

## Context
We need to implement an `ActiveTasksPanel` component that displays currently active tasks with real-time progress indicators, elapsed time tracking, status badges, and navigation support. This component will be used on the dashboard and potentially other views to give users immediate visibility into running tasks.

### Requirements
1. **ActiveTasksPanel** - Main container component
2. **TaskCard** - Sub-component for individual task display
3. **Task description display** - Show task info
4. **Status badge** - Using existing Badge component
5. **Progress indicator for running tasks** - Linear or circular progress
6. **Elapsed time** - Real-time elapsed time tracking
7. **Workflow info** - Display workflow name
8. **onViewDetails callback** - Navigation support
9. **Mock data rendering** - Component works with mock task data

## Decision

### Component Architecture

```
packages/web-ui/src/components/tasks/
├── ActiveTasksPanel.tsx    # Main panel component
├── TaskCard.tsx            # Individual task card (NEW)
├── ProgressIndicator.tsx   # Progress bar component (NEW)
├── index.ts                # Updated exports
```

### Design Principles

1. **Composition over Monolith**: Separate `TaskCard` into its own component for reusability and testability
2. **Reuse Existing Components**: Leverage `Badge`, `Card`, `Spinner` from `@/components/ui`
3. **Follow Established Patterns**: Mirror patterns from `KanbanBoard.tsx` and `SubtaskList.tsx`
4. **Client-Side Rendering**: Use `'use client'` directive for React hooks
5. **Real-time Updates**: Use `useElapsedTime` pattern with `formatElapsed` from `@apexcli/core`

### Type Definitions

```typescript
// ActiveTasksPanel.tsx
import type { Task, TaskStatus } from '@apexcli/core'

interface ActiveTasksPanelProps {
  /** Optional class name for styling */
  className?: string
  /** Maximum number of tasks to display (default: 5) */
  maxTasks?: number
  /** Callback when view details is clicked */
  onViewDetails?: (taskId: string) => void
  /** Whether to show loading state */
  loading?: boolean
  /** Optional tasks to display (for testing/mocking) */
  tasks?: Task[]
  /** Refresh interval in ms (default: 5000) */
  refreshInterval?: number
  /** Title for the panel (default: "Active Tasks") */
  title?: string
}

// TaskCard.tsx
interface TaskCardProps {
  /** The task to display */
  task: Task
  /** Callback when view details is clicked */
  onViewDetails?: (taskId: string) => void
  /** Whether this card is in a compact view */
  compact?: boolean
  /** Additional class name */
  className?: string
}

// ProgressIndicator.tsx
interface ProgressIndicatorProps {
  /** Progress value 0-100 */
  value: number
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Whether task is actively running (animates) */
  animated?: boolean
  /** Additional class name */
  className?: string
  /** Whether to show percentage text */
  showPercentage?: boolean
}
```

### Component Implementation Strategy

#### 1. ProgressIndicator Component
```typescript
// Linear progress bar with animation for running tasks
// Reuses styling patterns from BudgetGauge and SubtaskList
export function ProgressIndicator({
  value,
  size = 'md',
  animated = false,
  className,
  showPercentage = false
}: ProgressIndicatorProps) {
  // Size configurations
  const sizeConfig = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  }

  // Color based on completion
  const colorClass = value >= 100
    ? 'bg-green-500'
    : animated
      ? 'bg-apex-500'
      : 'bg-blue-500'

  return (
    <div className={cn('w-full', className)}>
      <div className={cn(
        'w-full bg-background-tertiary rounded-full overflow-hidden',
        sizeConfig[size]
      )}>
        <div
          className={cn(
            'h-full transition-all duration-300',
            colorClass,
            animated && 'animate-pulse'
          )}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      {showPercentage && (
        <span className="text-xs text-foreground-secondary mt-1">
          {Math.round(value)}%
        </span>
      )}
    </div>
  )
}
```

#### 2. TaskCard Component
```typescript
// Displays individual task information
// Uses elapsed time hook for real-time updates
export function TaskCard({ task, onViewDetails, compact = false, className }: TaskCardProps) {
  // Calculate elapsed time from task start
  const elapsedTime = useElapsedTime(
    task.status === 'in-progress' || task.status === 'planning'
      ? new Date(task.createdAt)
      : null
  )

  const isRunning = task.status === 'in-progress' || task.status === 'planning'

  // Calculate progress (based on currentStage if available)
  const progress = useMemo(() => {
    if (task.status === 'completed') return 100
    if (task.status === 'failed' || task.status === 'cancelled') return 0
    // Estimate based on typical workflow stages
    if (task.currentStage) {
      const stages = ['planning', 'implementation', 'testing', 'review']
      const index = stages.indexOf(task.currentStage.toLowerCase())
      return index >= 0 ? ((index + 1) / stages.length) * 100 : 50
    }
    return isRunning ? 25 : 0
  }, [task.status, task.currentStage, isRunning])

  return (
    <div className={cn(/* Card styling */)}>
      {/* Task description */}
      {/* Status badge */}
      {/* Progress indicator */}
      {/* Elapsed time */}
      {/* Workflow info */}
      {/* View details link/button */}
    </div>
  )
}
```

#### 3. ActiveTasksPanel Component
```typescript
// Main panel that fetches and displays active tasks
export function ActiveTasksPanel({
  className,
  maxTasks = 5,
  onViewDetails,
  loading: externalLoading,
  tasks: externalTasks,
  refreshInterval = 5000,
  title = 'Active Tasks'
}: ActiveTasksPanelProps) {
  const [tasks, setTasks] = useState<Task[]>(externalTasks || [])
  const [loading, setLoading] = useState(externalLoading ?? !externalTasks)

  // Fetch active tasks (in-progress, planning, waiting-approval)
  const fetchActiveTasks = useCallback(async () => {
    if (externalTasks) return // Skip if using external tasks

    const activeStatuses: TaskStatus[] = ['in-progress', 'planning', 'waiting-approval']
    // Fetch tasks with these statuses
    // ...
  }, [externalTasks])

  // Auto-refresh for real-time updates
  useEffect(() => {
    fetchActiveTasks()
    const interval = setInterval(fetchActiveTasks, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchActiveTasks, refreshInterval])

  // Render panel with task cards
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2>{title}</h2>
          <Badge>{tasks.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <LoadingState /> : <TaskList tasks={tasks} />}
      </CardContent>
    </Card>
  )
}
```

### File Structure

```
packages/web-ui/src/
├── components/
│   ├── tasks/
│   │   ├── ActiveTasksPanel.tsx     # NEW: Main panel component
│   │   ├── TaskCard.tsx             # NEW: Task card component
│   │   ├── ProgressIndicator.tsx    # NEW: Progress bar component
│   │   ├── index.ts                 # MODIFIED: Add exports
│   │   └── ...existing files
│   └── ui/
│       └── ...existing components (Badge, Card, Spinner, etc.)
├── lib/
│   ├── utils.ts                     # MODIFIED: Add formatElapsedTime if needed
│   └── api-client.ts                # Existing API client
└── hooks/
    └── useElapsedTime.ts            # NEW: Elapsed time hook (or reuse from CLI)
```

### Utility Functions

The `@apexcli/core` package already provides:
- `formatElapsed(startTime: Date, currentTime?: Date): string` - Format elapsed time
- `formatDuration(ms: number): string` - Format duration from milliseconds

For web-ui, we need to create a React hook:
```typescript
// packages/web-ui/src/hooks/useElapsedTime.ts
import { useState, useEffect } from 'react'
import { formatElapsed } from '@apexcli/core'

export function useElapsedTime(
  startTime: Date | null | undefined,
  updateInterval: number = 1000
): string {
  const [elapsedTime, setElapsedTime] = useState<string>('0s')

  useEffect(() => {
    if (!startTime) {
      setElapsedTime('0s')
      return
    }

    const updateElapsedTime = () => {
      setElapsedTime(formatElapsed(startTime, new Date()))
    }

    updateElapsedTime()
    const interval = setInterval(updateElapsedTime, updateInterval)
    return () => clearInterval(interval)
  }, [startTime, updateInterval])

  return elapsedTime
}
```

### Active Task Statuses

Tasks are considered "active" when they have one of these statuses:
- `in-progress` - Currently executing
- `planning` - In planning phase
- `waiting-approval` - Waiting for user approval
- `paused` - Temporarily paused (rate limited)

### Integration Points

1. **Dashboard Page** (`/app/page.tsx`) - Add ActiveTasksPanel to show active tasks
2. **Tasks Page** (`/app/tasks/page.tsx`) - Optional integration
3. **API Client** - Use existing `listTasks` with status filter

### Testing Strategy

1. **Unit Tests**: Test each component in isolation
2. **Mock Data**: Provide mock task data for component testing
3. **Storybook**: Visual testing with different states

## Consequences

### Positive
- Clean separation of concerns with dedicated sub-components
- Reuses existing UI components and patterns
- Real-time elapsed time tracking with efficient interval management
- Flexible API supports both API-fetched and mock data
- TypeScript types provide strong compile-time checks

### Negative
- Additional components to maintain
- Real-time updates require careful interval management to avoid memory leaks

### Risks & Mitigations
- **Performance**: Limit displayed tasks with `maxTasks` prop
- **Memory Leaks**: Properly cleanup intervals in useEffect
- **API Calls**: Use reasonable refresh interval (5s default)

## Implementation Notes

### Dependencies
- `@apexcli/core` - for `formatElapsed`, `TaskStatus`, `Task` types
- `lucide-react` - for icons (Clock, Activity, GitBranch, etc.)
- Existing UI components from `@/components/ui`

### Styling
- Use existing Tailwind classes and design system
- Follow color conventions from existing components
- Use `cn()` utility for conditional class merging

### Accessibility
- Use semantic HTML elements
- Include ARIA labels for progress indicators
- Ensure keyboard navigation works

## Related Documents
- Existing: `KanbanBoard.tsx`, `SubtaskList.tsx`, `Badge.tsx`, `BudgetGauge.tsx`
- Core Types: `packages/core/src/types.ts` (Task, TaskStatus)
- Utils: `packages/core/src/utils.ts` (formatElapsed, formatDuration)
