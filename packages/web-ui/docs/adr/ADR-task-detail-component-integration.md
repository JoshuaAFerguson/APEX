# Architecture Decision Record: Task Detail Page Component Integration

## Status
**Proposed**

## Context

The task detail page at `/tasks/[id]/page.tsx` needs to integrate two visualization components:
1. **TaskDependencyGraph** - Visualizes task relationships using React Flow
2. **SubtaskTree** - Displays subtasks in a hierarchical tree structure

Both components already exist in `packages/web-ui/src/components/tasks/` with comprehensive implementations, type definitions, and test coverage. The integration task involves:

1. Adding these components to the task detail page layout
2. Passing correct props from API data
3. Ensuring responsive layout across breakpoints

### Current State Analysis

**Task Detail Page (`/tasks/[id]/page.tsx`):**
- Uses a 3-column grid layout on `lg` screens (2-col main + 1-col sidebar)
- Already fetches subtask data via `apiClient.getSubtasks(taskId)`
- Has existing `SubtaskList` component at line 371
- Uses WebSocket streaming for real-time updates

**Available Components:**
- `TaskDependencyGraph` - Accepts `tasks: Task[]`, transforms to graph nodes/edges
- `SubtaskTree` - Accepts `taskId: string`, auto-fetches subtasks and builds tree

**API Endpoints:**
- `GET /tasks/{taskId}` - Returns full task data
- `GET /tasks/{taskId}/subtasks` - Returns `{ parentTaskId, subtasks: Task[], count }`
- Subtasks include `parentTaskId`, `subtaskIds[]`, and `dependsOn[]` for relationships

## Decision

### 1. Component Placement Strategy

**Decision**: Place components in the main content area (2-column span) with a tabbed interface for SubtaskList vs SubtaskTree, and TaskDependencyGraph in a collapsible section.

```
┌─────────────────────────────────────────────────────────────────┐
│ Header (Task Description, Status, Actions)                       │
├───────────────────────────────────────────────────────────┬─────┤
│ Main Content (lg:col-span-2)                              │ Side│
│ ┌───────────────────────────────────────────────────────┐ │ bar │
│ │ GatePanel (conditional)                               │ │     │
│ └───────────────────────────────────────────────────────┘ │     │
│ ┌───────────────────────────────────────────────────────┐ │     │
│ │ Subtasks Section                                      │ │     │
│ │ ┌─────────────┬──────────────┬────────────────────┐   │ │     │
│ │ │ List View   │ Tree View    │ Dependency Graph   │   │ │     │
│ │ └─────────────┴──────────────┴────────────────────┘   │ │     │
│ │ [SubtaskList | SubtaskTree | TaskDependencyGraph]     │ │     │
│ └───────────────────────────────────────────────────────┘ │     │
│ ┌───────────────────────────────────────────────────────┐ │     │
│ │ Live Logs                                             │ │     │
│ └───────────────────────────────────────────────────────┘ │     │
│ ┌───────────────────────────────────────────────────────┐ │     │
│ │ Acceptance Criteria                                   │ │     │
│ └───────────────────────────────────────────────────────┘ │     │
├───────────────────────────────────────────────────────────┴─────┤
│                            Sidebar                               │
│ - Token Usage, Task Details, Error Details                       │
└─────────────────────────────────────────────────────────────────┘
```

**Rationale**:
- Preserves existing responsive grid layout
- Provides user choice between flat list, hierarchical tree, and dependency graph views
- Keeps sidebar for metadata (token usage, task info, errors)
- Avoids visual clutter by using tabs/segmented control

### 2. View Mode State Management

**Decision**: Use local state with URL persistence for view mode preference

```typescript
type SubtaskViewMode = 'list' | 'tree' | 'graph'

const [viewMode, setViewMode] = useState<SubtaskViewMode>('list')
```

**Rationale**:
- Simple state management for MVP
- URL persistence (future enhancement) allows sharing specific views
- Defaults to 'list' for continuity with existing behavior

### 3. Data Flow Architecture

**Decision**: Single data fetch with prop passing pattern

```
┌──────────────────────────────────────────────────────────────────┐
│                      TaskDetailPage                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ State:                                                       │ │
│  │   - task: Task                                               │ │
│  │   - subtasks: Task[] (fetched on mount)                      │ │
│  │   - viewMode: 'list' | 'tree' | 'graph'                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│         ┌────────────────────┼────────────────────┐              │
│         ▼                    ▼                    ▼              │
│  ┌────────────┐      ┌────────────┐      ┌────────────────────┐ │
│  │SubtaskList │      │SubtaskTree │      │TaskDependencyGraph │ │
│  │            │      │            │      │                    │ │
│  │taskId      │      │taskId      │      │tasks: [task,       │ │
│  │            │      │tree?       │      │        ...subtasks]│ │
│  └────────────┘      └────────────┘      └────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**Key decisions**:
1. `SubtaskList` continues to fetch its own data (existing behavior)
2. `SubtaskTree` receives `taskId` and fetches/builds tree internally
3. `TaskDependencyGraph` receives combined `[task, ...subtasks]` array

**Rationale**:
- Minimal changes to existing components
- Components remain independently usable
- Graph gets full dependency context (parent + subtasks)

### 4. TaskDependencyGraph Data Preparation

**Decision**: Combine parent task with subtasks for full dependency visualization

```typescript
// In TaskDetailPage
const graphTasks = useMemo(() => {
  if (!task) return []
  // Include the main task and all its subtasks for full graph
  return [task, ...subtasks]
}, [task, subtasks])

// Usage
<TaskDependencyGraph
  tasks={graphTasks}
  onTaskClick={(taskId) => router.push(`/tasks/${taskId}`)}
  height={400}
/>
```

**Rationale**:
- Shows complete relationship context
- Enables navigation to any task in the graph
- Uses existing graph transformation logic

### 5. Responsive Layout Implementation

**Decision**: Adaptive layout based on screen size

| Breakpoint | Layout |
|------------|--------|
| Mobile (< 768px) | Single column, tabs stack vertically, graph height reduced |
| Tablet (768px - 1024px) | 2-column grid, tabs horizontal, graph height 350px |
| Desktop (> 1024px) | 3-column grid (2+1), tabs horizontal, graph height 400px |

```typescript
// Example responsive classes
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div className="lg:col-span-2 space-y-6">
    {/* Subtasks section with view mode tabs */}
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h2>Subtasks</h2>
          <ViewModeSelector value={viewMode} onChange={setViewMode} />
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        {viewMode === 'list' && <SubtaskList ... />}
        {viewMode === 'tree' && <SubtaskTree ... />}
        {viewMode === 'graph' && <TaskDependencyGraph height="auto" className="min-h-[300px] lg:min-h-[400px]" />}
      </CardContent>
    </Card>
  </div>
</div>
```

### 6. View Mode Selector Component

**Decision**: Create a simple segmented control using existing UI patterns

```typescript
interface ViewModeSelectorProps {
  value: SubtaskViewMode
  onChange: (mode: SubtaskViewMode) => void
}

function ViewModeSelector({ value, onChange }: ViewModeSelectorProps) {
  return (
    <div className="flex border border-border rounded-lg overflow-hidden">
      <button
        className={cn(
          'px-3 py-1.5 text-sm transition-colors',
          value === 'list' ? 'bg-apex-500 text-white' : 'hover:bg-background-secondary'
        )}
        onClick={() => onChange('list')}
      >
        <ListIcon className="w-4 h-4 mr-1" />
        List
      </button>
      <button
        className={cn(
          'px-3 py-1.5 text-sm transition-colors border-l border-border',
          value === 'tree' ? 'bg-apex-500 text-white' : 'hover:bg-background-secondary'
        )}
        onClick={() => onChange('tree')}
      >
        <TreeIcon className="w-4 h-4 mr-1" />
        Tree
      </button>
      <button
        className={cn(
          'px-3 py-1.5 text-sm transition-colors border-l border-border',
          value === 'graph' ? 'bg-apex-500 text-white' : 'hover:bg-background-secondary'
        )}
        onClick={() => onChange('graph')}
      >
        <NetworkIcon className="w-4 h-4 mr-1" />
        Graph
      </button>
    </div>
  )
}
```

### 7. Empty State Handling

**Decision**: Unified empty state handling in parent component

```typescript
// Only show subtasks section if there are subtasks
{hasSubtasks && (
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <h2>Subtasks ({subtasks.length})</h2>
        <ViewModeSelector ... />
      </div>
    </CardHeader>
    <CardContent>
      {/* Render appropriate view */}
    </CardContent>
  </Card>
)}
```

**Rationale**:
- Consistent with existing `{hasSubtasks && <SubtaskList ... />}` pattern
- Individual components still handle their own empty states as fallback

### 8. Props Contract

**SubtaskTree Props** (from existing component):
```typescript
interface SubtaskTreeProps {
  taskId: string;              // Required - task to load subtasks for
  tree?: SubtaskTreeNode;      // Optional - pre-loaded tree data
  maxDepth?: number;           // Default: 10
  defaultCollapsed?: boolean;  // Default: false
  enableKeyboardNav?: boolean; // Default: true
  className?: string;
  onSubtaskClick?: (id: string) => void;
}
```

**TaskDependencyGraph Props** (from existing component):
```typescript
interface TaskDependencyGraphProps {
  tasks: Task[];                         // Required - tasks to visualize
  onTaskClick?: (taskId: string) => void;
  className?: string;
  interactive?: boolean;                 // Default: true
  emptyStateMessage?: string;
  height?: string | number;              // Default: 400
  showMiniMap?: boolean;                 // Default: true
  showControls?: boolean;                // Default: true
  fitView?: boolean;                     // Default: true
}
```

### 9. Implementation Steps

1. **Add state for view mode and subtasks** in TaskDetailPage
2. **Fetch subtasks on mount** (modify existing `loadTask` function)
3. **Create ViewModeSelector** inline component
4. **Replace SubtaskList section** with tabbed view
5. **Pass correct props** to each component
6. **Add responsive styles** for mobile/tablet breakpoints
7. **Test all view modes** with various task structures

## Consequences

### Positive
- Provides multiple visualization options for different use cases
- Reuses existing, tested components
- Maintains responsive design patterns
- Follows existing codebase conventions
- Minimal changes to existing component APIs

### Negative
- Slightly increased bundle size for task detail page
- Additional state management complexity
- Graph view may be less useful for tasks without dependencies

### Risks
- **Performance**: Large dependency graphs may impact rendering
  - Mitigation: TaskDependencyGraph already implements fitView and zoom controls
- **Mobile UX**: Graph interactions difficult on small screens
  - Mitigation: Reduce graph height, hide on smallest breakpoints if needed
- **Data freshness**: Multiple components may show stale data
  - Mitigation: Use shared state, refresh all on WebSocket events

## Implementation Checklist

- [ ] Add `viewMode` state to TaskDetailPage
- [ ] Store fetched subtasks in component state
- [ ] Create ViewModeSelector component
- [ ] Replace SubtaskList with view-mode-aware section
- [ ] Integrate SubtaskTree with `taskId` prop
- [ ] Integrate TaskDependencyGraph with combined tasks array
- [ ] Add responsive styling
- [ ] Update tests for new functionality
- [ ] Manual testing across breakpoints

## Related Decisions

- Uses existing `TaskDependencyGraph` implementation (see `TaskDependencyGraph.architecture.md`)
- Uses existing `SubtaskTree` implementation (see `SubtaskTree.architecture.md`)
- Follows existing Card/CardHeader/CardContent patterns
- Consistent with web-ui component export patterns

## Test Coverage Requirements

1. **Unit tests**: ViewModeSelector state changes
2. **Integration tests**: Component rendering in each view mode
3. **E2E tests**: Navigation between views, task clicks
4. **Visual regression**: Layout at different breakpoints
