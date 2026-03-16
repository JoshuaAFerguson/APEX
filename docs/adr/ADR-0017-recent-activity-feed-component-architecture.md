# ADR-0017: RecentActivityFeed Component Architecture

## Status
Proposed

## Date
2026-03-15

## Context

The APEX web-ui requires a RecentActivityFeed component to display real-time activity events in a scrollable, categorized list. This component will help users monitor system activity including task lifecycle, agent execution, tool usage, approval gates, permissions, and errors.

### Requirements

From the acceptance criteria:
1. **Location**: `web-ui/src/components/activity/RecentActivityFeed.tsx`
2. **Scrollable list** limited to 20 events maximum
3. **Display**: event type, timestamp, and relevant details
4. **Icons** for each event category: task, agent, tool, gate, permission, system, error (7 categories)
5. **Severity-based styling**: info, success, warning, error

### Existing Infrastructure

The codebase has mature infrastructure for activity events:

1. **`DashboardActivityEvent`** (`packages/web-ui/src/types/dashboard.ts`)
   - Complete type definition for activity events
   - Includes `category`, `severity`, `title`, `description`, `timestamp`, `taskId`
   - Helper functions: `getEventCategory()`, `getEventSeverity()`, `transformApexEvent()`

2. **`ActivityEventCategory`** type already defined:
   - `task`, `agent`, `tool`, `gate`, `permission`, `system`, `error`

3. **`ActivityEventSeverity`** type already defined:
   - `info`, `success`, `warning`, `error`

4. **`ActivityFeedFilters`** interface already defined:
   - Categories, severities, taskIds, unreadOnly, limit

5. **Existing Component Patterns**
   - `ActiveTasksPanel` - list with filtering, icons, scrollable
   - `LogViewer` - scrollable list with severity colors, auto-scroll
   - `TaskCard` - item display with icons and status styling
   - lucide-react for icons throughout

## Decision

### Component Architecture

Create a **RecentActivityFeed** component following established patterns:

```
packages/web-ui/src/
├── components/
│   └── activity/                          # NEW directory
│       ├── RecentActivityFeed.tsx         # Main component
│       ├── ActivityEventItem.tsx          # Individual event row
│       ├── ActivityCategoryIcon.tsx       # Icon component for categories
│       ├── index.ts                       # Exports
│       └── __tests__/
│           ├── RecentActivityFeed.test.tsx
│           ├── RecentActivityFeed.integration.test.tsx
│           └── ActivityEventItem.test.tsx
└── types/
    └── activity-feed.ts                   # Additional type definitions (extend dashboard.ts)
```

### Type Definitions

Extend existing types in a new file:

```typescript
// types/activity-feed.ts

import type {
  DashboardActivityEvent,
  ActivityEventCategory,
  ActivityEventSeverity,
  ActivityFeedFilters,
} from './dashboard'

/**
 * Props for RecentActivityFeed component
 */
export interface RecentActivityFeedProps {
  /** Array of activity events to display */
  events: DashboardActivityEvent[]

  /** Maximum number of events to show (default: 20) */
  maxEvents?: number

  /** Optional height constraint for scrollable area */
  maxHeight?: number | string

  /** Whether to show category filter tabs */
  showFilters?: boolean

  /** Initial filter configuration */
  initialFilters?: Partial<ActivityFeedFilters>

  /** Whether to auto-scroll to new events */
  autoScroll?: boolean

  /** Compact display mode */
  compact?: boolean

  /** Callback when an event is clicked */
  onEventClick?: (event: DashboardActivityEvent) => void

  /** Callback when event is marked as read */
  onMarkRead?: (eventId: string) => void

  /** Whether the feed is loading */
  loading?: boolean

  /** Optional className */
  className?: string

  /** Optional title override */
  title?: string
}

/**
 * Props for ActivityEventItem component
 */
export interface ActivityEventItemProps {
  /** The event to display */
  event: DashboardActivityEvent

  /** Compact display mode */
  compact?: boolean

  /** Callback when clicked */
  onClick?: () => void

  /** Whether to show the read indicator */
  showReadIndicator?: boolean
}

/**
 * Icon mapping for event categories
 */
export type CategoryIconMap = Record<ActivityEventCategory, React.ComponentType<{ className?: string }>>
```

### Component Design

#### 1. Category Icons (Using lucide-react)

```typescript
import {
  CheckSquare,    // task
  Bot,            // agent
  Wrench,         // tool
  ShieldCheck,    // gate (approval)
  Lock,           // permission
  Settings,       // system
  AlertTriangle,  // error
} from 'lucide-react'

const CATEGORY_ICONS: CategoryIconMap = {
  task: CheckSquare,
  agent: Bot,
  tool: Wrench,
  gate: ShieldCheck,
  permission: Lock,
  system: Settings,
  error: AlertTriangle,
}
```

#### 2. Severity Styling (Matching existing Badge patterns)

```typescript
const SEVERITY_STYLES = {
  info: {
    bg: 'bg-apex-950/50',
    text: 'text-apex-400',
    border: 'border-apex-900',
    icon: 'text-apex-500',
    dot: 'bg-apex-500',
  },
  success: {
    bg: 'bg-green-950/50',
    text: 'text-green-400',
    border: 'border-green-900',
    icon: 'text-green-500',
    dot: 'bg-green-500',
  },
  warning: {
    bg: 'bg-yellow-950/50',
    text: 'text-yellow-400',
    border: 'border-yellow-900',
    icon: 'text-yellow-500',
    dot: 'bg-yellow-500',
  },
  error: {
    bg: 'bg-red-950/50',
    text: 'text-red-400',
    border: 'border-red-900',
    icon: 'text-red-500',
    dot: 'bg-red-500',
  },
} as const
```

#### 3. Component Structure

```
RecentActivityFeed
├── Card (wrapper)
│   ├── CardHeader
│   │   ├── Title with icon
│   │   ├── Event count badge
│   │   └── Filter tabs (optional)
│   └── CardContent
│       └── Scrollable container (max 20 events)
│           └── ActivityEventItem[] (mapped)
│               ├── Category icon
│               ├── Event title
│               ├── Timestamp
│               ├── Description (truncated)
│               └── Severity indicator (border/dot)
```

#### 4. ActivityEventItem Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ [Icon] Task Created                               3m ago    [●] │
│        Created development task for user authentication        │
│        Task: abc123...                                          │
└─────────────────────────────────────────────────────────────────┘
```

For compact mode:
```
┌─────────────────────────────────────────────────────────────────┐
│ [Icon] Task Created                               3m ago    [●] │
└─────────────────────────────────────────────────────────────────┘
```

### Filter Tabs Design

Following `ActiveTasksPanel` pattern:

```typescript
const categoryFilters: Array<{
  type: ActivityEventCategory | 'all'
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { type: 'all', label: 'All', icon: List },
  { type: 'task', label: 'Tasks', icon: CheckSquare },
  { type: 'agent', label: 'Agents', icon: Bot },
  { type: 'tool', label: 'Tools', icon: Wrench },
  { type: 'gate', label: 'Gates', icon: ShieldCheck },
  { type: 'permission', label: 'Permissions', icon: Lock },
  { type: 'error', label: 'Errors', icon: AlertTriangle },
]
```

### Scrolling Behavior

Following `LogViewer` pattern:
1. Auto-scroll to new events when `autoScroll` is enabled
2. Pause auto-scroll when user manually scrolls up
3. Show "New events" button when new events arrive while scrolled up
4. Limit display to `maxEvents` (default: 20) for performance

### Empty State

```typescript
<div className="flex flex-col items-center justify-center py-8 text-foreground-secondary">
  <Activity className="w-8 h-8 mb-2 opacity-50" />
  <p className="text-sm">No recent activity</p>
  <p className="text-xs mt-1">Events will appear here as they occur</p>
</div>
```

### Data Flow

```
WebSocket Events → useRealtimeUpdates hook
                          ↓
                transformApexEvent()
                          ↓
                DashboardActivityEvent[]
                          ↓
              RecentActivityFeed (props.events)
                          ↓
              Filter by category/severity
                          ↓
              Slice to maxEvents (20)
                          ↓
              ActivityEventItem[] (render)
```

## Implementation Plan

### Phase 1: Directory and Types
1. Create `components/activity/` directory
2. Create `types/activity-feed.ts` with prop interfaces
3. Update `types/index.ts` to export new types

### Phase 2: Icon and Styling Utilities
1. Create `ActivityCategoryIcon.tsx` with category-to-icon mapping
2. Define `SEVERITY_STYLES` constant

### Phase 3: ActivityEventItem Component
1. Implement single event row component
2. Include category icon, title, timestamp, description
3. Apply severity-based border/background styling
4. Support compact mode

### Phase 4: RecentActivityFeed Component
1. Implement main component with Card wrapper
2. Add category filter tabs (optional)
3. Implement scrollable container with 20-event limit
4. Add auto-scroll behavior
5. Add loading and empty states

### Phase 5: Testing
1. Unit tests for ActivityEventItem
2. Unit tests for RecentActivityFeed (filtering, limiting, display)
3. Integration tests with mock events
4. Edge case tests (empty, max events, rapid updates)

### Phase 6: Exports and Integration
1. Create `components/activity/index.ts`
2. Consider adding to component exports if needed by other modules

## File Structure Summary

```
packages/web-ui/src/
├── components/
│   └── activity/
│       ├── RecentActivityFeed.tsx      # Main component (~150-200 lines)
│       ├── ActivityEventItem.tsx       # Item component (~80-100 lines)
│       ├── ActivityCategoryIcon.tsx    # Icon helper (~30-40 lines)
│       ├── index.ts                    # Exports
│       └── __tests__/
│           ├── RecentActivityFeed.test.tsx
│           ├── RecentActivityFeed.integration.test.tsx
│           └── ActivityEventItem.test.tsx
└── types/
    ├── activity-feed.ts                # New type definitions
    └── index.ts                        # Updated exports
```

## Consequences

### Positive
- Leverages existing `DashboardActivityEvent` types and helper functions
- Consistent with established component patterns (ActiveTasksPanel, LogViewer)
- Reuses existing severity/status styling patterns
- Provides clear categorization with recognizable icons
- Scrollable with event limit for performance
- Supports filtering for focused monitoring

### Negative
- Adds a new component directory
- Filter tabs may add complexity for simple use cases

### Risks
- Large volumes of events may require debouncing or virtualization (mitigated by 20-event limit)
- Category icons must be intuitive - may need user testing

## Accessibility Considerations

- Use `role="log"` or `role="feed"` for the scrollable container
- Include `aria-live="polite"` for new event announcements
- Ensure icons have `aria-hidden="true"` with text labels
- Support keyboard navigation through events
- Provide sufficient color contrast for severity indicators

## Dependencies

- lucide-react (already used throughout)
- Existing UI components: Card, Badge, Button
- Existing utilities: cn(), getRelativeTime()
- Existing types: DashboardActivityEvent, ActivityEventCategory, ActivityEventSeverity

## References

- Existing analyzed files:
  - `packages/web-ui/src/types/dashboard.ts`
  - `packages/web-ui/src/components/tasks/ActiveTasksPanel.tsx`
  - `packages/web-ui/src/components/tasks/LogViewer.tsx`
  - `packages/web-ui/src/components/tasks/TaskCard.tsx`
  - `packages/web-ui/src/components/ui/Badge.tsx`
  - `packages/web-ui/src/lib/utils.ts`
