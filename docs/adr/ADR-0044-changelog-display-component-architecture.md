# ADR-0044: Automated Changelog Display Component Architecture

## Status
Proposed

## Date
2026-03-23

## Context

The APEX web-ui requires an Automated Changelog Display component to show auto-generated changelogs from completed tasks. This component will help users track changes made during task execution, similar to a git commit history view, with filtering capabilities and expandable diff previews.

### Requirements

From the acceptance criteria:
1. **Changelog component** shows git-style commit list from tasks
2. **Filterable by date/workflow** - enable users to narrow down changelog entries
3. **Expandable entries with diff preview** - show detailed changes when expanded

### Existing Infrastructure

The codebase has mature infrastructure that can be leveraged:

1. **`Task` type** (`packages/core/src/types.ts`)
   - Contains `artifacts: TaskArtifact[]` which includes file changes
   - Contains `logs: TaskLog[]` with execution history
   - Contains `completedAt`, `workflow`, `description` fields
   - Contains `branchName`, `prUrl` for git integration

2. **`DiffViewer` component** (`packages/web-ui/src/components/diff/`)
   - Complete diff viewer with syntax highlighting
   - Supports unified, split, and inline view modes
   - Already handles parsing and rendering diffs
   - Collapsible hunks support

3. **`RecentActivityFeed`** component pattern
   - Scrollable list with filtering
   - Category icons and severity styling
   - Real-time updates via WebSocket

4. **`ApexApiClient`** (`packages/web-ui/src/lib/api-client.ts`)
   - Task listing with filtering by status/workflow
   - Pagination support for large datasets

5. **Existing UI Components**
   - `Card`, `Badge`, `Button`, `Spinner` - core UI primitives
   - `ActivityEventItem` - pattern for list items with icons
   - lucide-react icons throughout

## Decision

### Component Architecture

Create a **ChangelogDisplay** component system following established patterns:

```
packages/web-ui/src/
├── components/
│   └── changelog/                          # NEW directory
│       ├── ChangelogDisplay.tsx            # Main component
│       ├── ChangelogEntry.tsx              # Individual entry (git commit style)
│       ├── ChangelogFilters.tsx            # Date/workflow filter controls
│       ├── ChangelogDiffPreview.tsx        # Expandable diff section
│       ├── ChangelogHeader.tsx             # Summary header with stats
│       ├── index.ts                        # Exports
│       └── __tests__/
│           ├── ChangelogDisplay.test.tsx
│           ├── ChangelogDisplay.integration.test.tsx
│           ├── ChangelogEntry.test.tsx
│           └── ChangelogFilters.test.tsx
├── hooks/
│   └── useChangelog.ts                     # Data fetching and state management
└── types/
    └── changelog.ts                        # Type definitions
```

### Type Definitions

```typescript
// types/changelog.ts

import type { Task, TaskArtifact, TaskLog } from '@apexcli/core'

/**
 * Represents a single changelog entry derived from a completed task
 */
export interface ChangelogEntry {
  /** Unique entry ID (task ID) */
  id: string

  /** Short summary/title of the change (from task description) */
  title: string

  /** Detailed description of changes */
  description?: string

  /** When the change was completed */
  timestamp: Date

  /** Workflow that produced this change */
  workflow: string

  /** Task status when changelog was generated */
  status: 'completed' | 'failed' | 'cancelled'

  /** Git-related information */
  git?: {
    branchName?: string
    prUrl?: string
    commitHash?: string
  }

  /** File changes with diffs */
  changes: ChangelogFileChange[]

  /** Statistics about the change */
  stats: {
    filesModified: number
    linesAdded: number
    linesRemoved: number
  }

  /** Original task for reference */
  taskId: string
}

/**
 * Represents a file change within a changelog entry
 */
export interface ChangelogFileChange {
  /** File path */
  path: string

  /** Type of change */
  type: 'added' | 'modified' | 'deleted' | 'renamed'

  /** Original path (for renames) */
  originalPath?: string

  /** Unified diff content */
  diff?: string

  /** Lines added/removed in this file */
  stats: {
    additions: number
    deletions: number
  }
}

/**
 * Filter options for changelog display
 */
export interface ChangelogFilters {
  /** Start date for filtering */
  startDate?: Date

  /** End date for filtering */
  endDate?: Date

  /** Workflow names to include */
  workflows?: string[]

  /** Search query for title/description */
  search?: string

  /** Status filter */
  status?: ('completed' | 'failed' | 'cancelled')[]

  /** Limit results */
  limit?: number

  /** Offset for pagination */
  offset?: number
}

/**
 * Props for ChangelogDisplay component
 */
export interface ChangelogDisplayProps {
  /** Pre-loaded entries (if not using hook) */
  entries?: ChangelogEntry[]

  /** Whether to fetch entries automatically */
  autoFetch?: boolean

  /** Initial filter configuration */
  initialFilters?: Partial<ChangelogFilters>

  /** Whether to show filter controls */
  showFilters?: boolean

  /** Whether to enable expandable diffs */
  showDiffPreview?: boolean

  /** Maximum height before scrolling */
  maxHeight?: number | string

  /** Callback when entry is clicked */
  onEntryClick?: (entry: ChangelogEntry) => void

  /** Loading state */
  loading?: boolean

  /** Custom className */
  className?: string

  /** Component title */
  title?: string

  /** Empty state message */
  emptyMessage?: string
}

/**
 * Props for ChangelogEntry component
 */
export interface ChangelogEntryProps {
  /** The entry to display */
  entry: ChangelogEntry

  /** Whether diff preview is expanded */
  isExpanded?: boolean

  /** Toggle expansion callback */
  onToggleExpand?: () => void

  /** Whether to show diff preview toggle */
  showDiffToggle?: boolean

  /** Click handler */
  onClick?: () => void

  /** Compact mode */
  compact?: boolean

  /** Custom className */
  className?: string
}

/**
 * Props for ChangelogFilters component
 */
export interface ChangelogFiltersProps {
  /** Current filter values */
  filters: ChangelogFilters

  /** Filter change handler */
  onFiltersChange: (filters: ChangelogFilters) => void

  /** Available workflows for filter dropdown */
  availableWorkflows?: string[]

  /** Compact mode */
  compact?: boolean

  /** Custom className */
  className?: string
}
```

### Data Model Transformation

Transform tasks to changelog entries:

```typescript
/**
 * Transform a completed Task into a ChangelogEntry
 */
export function taskToChangelogEntry(task: Task): ChangelogEntry {
  // Extract file changes from task artifacts
  const changes: ChangelogFileChange[] = task.artifacts
    .filter(artifact => artifact.type === 'file')
    .map(artifact => ({
      path: artifact.path,
      type: determineChangeType(artifact),
      diff: artifact.content,
      stats: {
        additions: countAdditions(artifact.content),
        deletions: countDeletions(artifact.content),
      },
    }))

  // Calculate aggregate stats
  const stats = {
    filesModified: changes.length,
    linesAdded: changes.reduce((sum, c) => sum + c.stats.additions, 0),
    linesRemoved: changes.reduce((sum, c) => sum + c.stats.deletions, 0),
  }

  return {
    id: task.id,
    title: truncate(task.description, 80),
    description: task.description,
    timestamp: task.completedAt || task.updatedAt,
    workflow: task.workflow,
    status: task.status as 'completed' | 'failed' | 'cancelled',
    git: {
      branchName: task.branchName,
      prUrl: task.prUrl,
    },
    changes,
    stats,
    taskId: task.id,
  }
}
```

### Component Design

#### 1. ChangelogDisplay Layout (Git-style)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 📜 Changelog                                     [Filter ▼] [🔍 Search] │
│─────────────────────────────────────────────────────────────────────────│
│ Date range: [Last 7 days ▼]    Workflow: [All ▼]                        │
│─────────────────────────────────────────────────────────────────────────│
│                                                                          │
│ ● feat(auth): Add user authentication system                    2h ago  │
│   │ workflow: feature-development  ✓ completed                          │
│   │ +145 -23 across 5 files                      [📄 Show changes ▼]    │
│   │                                                                      │
│   ├── src/auth/AuthProvider.tsx    +89 -0                               │
│   ├── src/auth/useAuth.ts          +34 -0                               │
│   ├── src/api/auth-client.ts       +22 -23                              │
│   └── ...                                                                │
│                                                                          │
│ ● fix(api): Handle rate limit errors gracefully                 5h ago  │
│   │ workflow: bug-fix  ✓ completed                                       │
│   │ +12 -5 across 2 files                        [📄 Show changes ▼]    │
│                                                                          │
│ ● refactor(core): Extract utility functions                     1d ago  │
│   │ workflow: refactoring  ✓ completed                                   │
│   │ +78 -156 across 8 files                      [📄 Show changes ▼]    │
│                                                                          │
│─────────────────────────────────────────────────────────────────────────│
│ Showing 3 of 42 changes                              [Load more...]      │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 2. Expanded Entry with Diff Preview

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ● feat(auth): Add user authentication system                    2h ago  │
│   │ workflow: feature-development  ✓ completed                          │
│   │ +145 -23 across 5 files                      [📄 Hide changes ▲]    │
│   │                                                                      │
│   ├─────────────────────────────────────────────────────────────────────│
│   │ 📄 src/auth/AuthProvider.tsx                           +89 -0       │
│   │┌───────────────────────────────────────────────────────────────────┐│
│   ││ @@ -0,0 +1,89 @@                                                  ││
│   ││+import React, { createContext, useContext, useState } from 'react'││
│   ││+                                                                   ││
│   ││+export interface AuthContextValue {                                ││
│   ││+  user: User | null                                                ││
│   ││+  login: (credentials: Credentials) => Promise<void>              ││
│   ││...                                                                 ││
│   │└───────────────────────────────────────────────────────────────────┘│
│   │                                                                      │
│   ├─────────────────────────────────────────────────────────────────────│
│   │ 📄 src/auth/useAuth.ts                                 +34 -0       │
│   │ [Collapsed - click to expand]                                        │
│   │                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 3. Filter Controls

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 📅 Date Range        │ 🔄 Workflow           │ 📊 Status               │
│ ┌─────────────────┐  │ ┌─────────────────┐   │ ☑ Completed             │
│ │ Last 7 days   ▼ │  │ │ All workflows ▼ │   │ ☑ Failed                │
│ └─────────────────┘  │ └─────────────────┘   │ ☐ Cancelled             │
│                      │                        │                          │
│ Custom: [From] - [To]│ ☐ feature-development │                          │
│                      │ ☐ bug-fix             │                          │
│                      │ ☐ refactoring         │                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Hook Design

```typescript
// hooks/useChangelog.ts

export interface UseChangelogOptions {
  /** Initial filters */
  initialFilters?: ChangelogFilters

  /** Auto-fetch on mount */
  autoFetch?: boolean

  /** Refresh interval in ms (0 = disabled) */
  refreshInterval?: number

  /** Items per page for pagination */
  pageSize?: number
}

export interface UseChangelogReturn {
  /** Changelog entries */
  entries: ChangelogEntry[]

  /** Loading state */
  isLoading: boolean

  /** Error state */
  error: Error | null

  /** Current filters */
  filters: ChangelogFilters

  /** Update filters */
  setFilters: (filters: ChangelogFilters) => void

  /** Fetch next page */
  fetchMore: () => Promise<void>

  /** Has more entries to load */
  hasMore: boolean

  /** Total count */
  total: number

  /** Refresh entries */
  refresh: () => Promise<void>

  /** Available workflows for filtering */
  availableWorkflows: string[]
}

export function useChangelog(options?: UseChangelogOptions): UseChangelogReturn
```

### API Integration

Add API method to `ApexApiClient`:

```typescript
/**
 * Get changelog entries from completed tasks
 */
async getChangelog(filters?: ChangelogFilters): Promise<{
  entries: ChangelogEntry[]
  total: number
  hasMore: boolean
}> {
  // Fetch completed tasks
  const tasks = await this.listTasks({
    status: filters?.status?.join(',') || 'completed',
    workflow: filters?.workflows?.[0],
    limit: filters?.limit,
    offset: filters?.offset,
  })

  // Transform to changelog entries
  const entries = tasks.tasks
    .filter(t => t.status === 'completed' || t.status === 'failed')
    .map(taskToChangelogEntry)

  return {
    entries,
    total: tasks.total,
    hasMore: tasks.offset + tasks.count < tasks.total,
  }
}
```

### Integration with DiffViewer

Reuse existing `DiffViewer` for diff preview:

```tsx
// ChangelogDiffPreview.tsx
import { DiffViewer } from '../diff'

export function ChangelogDiffPreview({ change }: { change: ChangelogFileChange }) {
  return (
    <DiffViewer
      diff={change.diff || ''}
      filePath={change.path}
      mode="unified"
      showModeSelector={false}
      showLineNumbers={true}
      highlighting={true}
      maxHeight={300}
      collapsible={true}
      defaultCollapsed={false}
    />
  )
}
```

### Styling Approach

Follow existing patterns with severity-based styling:

```typescript
const STATUS_STYLES = {
  completed: {
    icon: CheckCircle,
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    badge: 'bg-green-500/20 text-green-400',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    badge: 'bg-red-500/20 text-red-400',
  },
  cancelled: {
    icon: MinusCircle,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    badge: 'bg-yellow-500/20 text-yellow-400',
  },
} as const
```

### Empty State

```tsx
<div className="flex flex-col items-center justify-center py-12 text-foreground-secondary">
  <FileText className="w-12 h-12 mb-4 opacity-50" />
  <h3 className="text-lg font-medium mb-2">No changelog entries</h3>
  <p className="text-sm text-center max-w-md">
    Changelog entries will appear here when tasks are completed.
    Try running a task or adjusting your filters.
  </p>
</div>
```

## Implementation Plan

### Phase 1: Types and Data Model
1. Create `types/changelog.ts` with type definitions
2. Implement `taskToChangelogEntry` transformation
3. Add helper functions for stats calculation

### Phase 2: API Integration
1. Add `getChangelog` method to `ApexApiClient`
2. Create `useChangelog` hook for data management
3. Implement filtering logic

### Phase 3: ChangelogEntry Component
1. Create git-style entry display
2. Add status icons and badges
3. Implement expansion toggle
4. Style with existing patterns

### Phase 4: ChangelogFilters Component
1. Create date range picker
2. Add workflow multi-select
3. Add status checkboxes
4. Connect to parent state

### Phase 5: ChangelogDisplay Main Component
1. Assemble child components
2. Add pagination/load more
3. Implement scrollable container
4. Add empty and loading states

### Phase 6: Diff Preview Integration
1. Create `ChangelogDiffPreview` wrapper
2. Integrate existing `DiffViewer`
3. Add file list with collapse/expand

### Phase 7: Testing
1. Unit tests for all components
2. Integration tests with mock data
3. Edge case tests (empty, large lists)
4. Filter behavior tests

## Consequences

### Positive
- Reuses existing `DiffViewer` for rich diff display
- Follows established component patterns
- Leverages existing task data model
- Provides familiar git-style interface
- Supports filtering for focused review
- Expandable entries for detailed inspection

### Negative
- Requires new API endpoint or method
- May need pagination for large changelogs
- Diff content storage could increase data size

### Risks
- Large diffs may impact performance (mitigated by lazy loading and collapse)
- Task artifacts may not always include diff data
- Date filtering requires proper timestamp indexing

## Accessibility Considerations

- Use semantic HTML with proper heading hierarchy
- Support keyboard navigation for expand/collapse
- Provide `aria-expanded` states for collapsible sections
- Ensure color contrast for status indicators
- Include text alternatives for icons

## Dependencies

- lucide-react (already used)
- Existing `DiffViewer` component
- `ApexApiClient` for data fetching
- Existing UI components: Card, Badge, Button, Select

## File Structure Summary

```
packages/web-ui/src/
├── components/
│   └── changelog/
│       ├── ChangelogDisplay.tsx      # Main component (~200-250 lines)
│       ├── ChangelogEntry.tsx        # Entry component (~120-150 lines)
│       ├── ChangelogFilters.tsx      # Filter controls (~100-120 lines)
│       ├── ChangelogDiffPreview.tsx  # Diff wrapper (~50-70 lines)
│       ├── ChangelogHeader.tsx       # Header with stats (~60-80 lines)
│       ├── constants.ts              # Styling constants
│       ├── index.ts                  # Exports
│       └── __tests__/
│           ├── ChangelogDisplay.test.tsx
│           ├── ChangelogDisplay.integration.test.tsx
│           ├── ChangelogEntry.test.tsx
│           ├── ChangelogFilters.test.tsx
│           └── test-utils.ts
├── hooks/
│   └── useChangelog.ts               # Data hook (~150-180 lines)
└── types/
    ├── changelog.ts                  # Type definitions (~100 lines)
    └── index.ts                      # Updated exports
```

## References

- Existing analyzed files:
  - `packages/core/src/types.ts` - Task interface
  - `packages/web-ui/src/types/dashboard.ts` - Activity event patterns
  - `packages/web-ui/src/components/diff/DiffViewer.tsx` - Diff display
  - `packages/web-ui/src/components/activity/RecentActivityFeed.tsx` - List patterns
  - `packages/web-ui/src/lib/api-client.ts` - API patterns
  - `docs/adr/ADR-0017-recent-activity-feed-component-architecture.md` - Similar component ADR
