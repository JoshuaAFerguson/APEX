# Architecture Decision Record: TaskDependencyGraph Component

## Status
**Accepted**

## Context
We need to create a `TaskDependencyGraph` component that renders task relationships using React Flow. The component should:
1. Render nodes for each task with edges showing dependencies
2. Handle empty state gracefully
3. Enable clicking a node to navigate to that task's detail page

## Decision

### 1. Component Location
**Location**: `packages/web-ui/src/components/tasks/TaskDependencyGraph.tsx`

This follows the existing pattern where task-related components (SubtaskList, LogViewer, GatePanel, etc.) are placed in the `tasks/` directory.

### 2. Reuse Existing DependencyGraph
**Decision**: Compose on top of the existing `DependencyGraph` component from `packages/web-ui/src/components/graphs/DependencyGraph.tsx`

**Rationale**:
- The `DependencyGraph` component already provides React Flow integration with proper styling
- It supports `onNodeClick` callback for handling node interactions
- It already uses the `DependencyNodeStatus` type which maps well to task statuses
- Reusing it follows DRY principles and maintains consistency

### 3. Type Definitions
**Decision**: Create a new type file `packages/web-ui/src/types/task-dependency-graph.ts`

**Types to define**:
```typescript
// Props for the TaskDependencyGraph component
interface TaskDependencyGraphProps {
  tasks: Task[];                    // Array of tasks to visualize
  onTaskClick?: (taskId: string) => void;  // Optional callback for node clicks
  className?: string;               // Optional CSS class
  emptyStateMessage?: string;       // Custom empty state message
}

// Internal type for task node data extending DependencyNodeData
interface TaskNodeData extends DependencyNodeData {
  taskId: string;
  taskStatus: TaskStatus;
  parentTaskId?: string;
  subtaskIds?: string[];
}
```

### 4. Data Transformation Logic
**Decision**: Create a utility function to transform Task[] into DependencyNode[] and DependencyEdge[]

**Location**: Inside the component file or as a separate utility if reusable

**Algorithm**:
```
1. For each task:
   - Create a DependencyNode with:
     - id: task.id
     - position: computed using simple grid/hierarchical layout
     - data: { label: task.description (truncated), status: mapTaskStatus, taskId, ... }

2. For dependency edges:
   - Use task.dependsOn[] to create edges from dependency to current task
   - Use task.parentTaskId for parent-child relationships
   - Use task.subtaskIds[] for parent-to-subtask relationships
```

### 5. Status Mapping
**Decision**: Map TaskStatus to DependencyNodeStatus

```typescript
const STATUS_MAP: Record<TaskStatus, DependencyNodeStatus> = {
  'pending': 'pending',
  'queued': 'pending',
  'running': 'active',
  'paused': 'warning',
  'completed': 'completed',
  'failed': 'error',
  'cancelled': 'default',
  'trashed': 'default',
  'archived': 'completed',
}
```

### 6. Empty State Handling
**Decision**: Display a friendly empty state when no tasks are provided

The component should render a centered message with an icon when:
- `tasks` array is empty
- `tasks` array is undefined/null

### 7. Node Layout Strategy
**Decision**: Use a simple hierarchical layout algorithm

**Approach**:
- Parent tasks at top, subtasks below
- Tasks with dependencies positioned after their dependencies
- Use consistent spacing (nodeSpacing: 200, rankSpacing: 100)

For MVP, use a simple grid-based layout. Future enhancement could use dagre for automatic layout.

### 8. Navigation
**Decision**: Use Next.js `useRouter` for navigation on node click

```typescript
const router = useRouter();

const handleNodeClick = (node: DependencyNode) => {
  const taskId = (node.data as TaskNodeData).taskId;
  router.push(`/tasks/${taskId}`);
};
```

Alternative: Accept an optional `onTaskClick` prop for flexibility, defaulting to router navigation.

### 9. Edge Styling
**Decision**: Different edge styles for different relationships

```typescript
- dependsOn edges: solid line, animated when target task is 'active'
- parentTaskId edges: dashed line (parent-child relationship)
- Same type coloring using DEPENDENCY_COLORS['task']
```

## File Structure

```
packages/web-ui/src/
├── components/
│   └── tasks/
│       ├── TaskDependencyGraph.tsx          # Main component
│       └── __tests__/
│           └── TaskDependencyGraph.test.tsx # Unit tests
└── types/
    └── task-dependency-graph.ts             # Type definitions
```

## API Design

### TaskDependencyGraph Props
```typescript
interface TaskDependencyGraphProps {
  /** Array of tasks to visualize in the graph */
  tasks: Task[];

  /** Optional callback when a task node is clicked. If not provided, navigates to task detail page */
  onTaskClick?: (taskId: string) => void;

  /** Optional CSS class for the container */
  className?: string;

  /** Whether the graph is interactive (draggable/zoomable) */
  interactive?: boolean;

  /** Custom message for empty state */
  emptyStateMessage?: string;

  /** Height of the graph container */
  height?: string | number;
}
```

### Usage Example
```tsx
// Basic usage - auto-navigation on click
<TaskDependencyGraph tasks={tasks} />

// Custom click handler
<TaskDependencyGraph
  tasks={tasks}
  onTaskClick={(taskId) => console.log('Clicked:', taskId)}
/>

// With styling
<TaskDependencyGraph
  tasks={tasks}
  className="my-4"
  height={500}
/>
```

## Consequences

### Positive
- Reuses existing React Flow infrastructure
- Consistent styling with other graph visualizations
- Type-safe with full TypeScript support
- Flexible API allows customization
- Follows established patterns in the codebase

### Negative
- Layout algorithm is simple; may not handle complex dependency graphs optimally
- Initial implementation uses static positioning; dynamic layout is a future enhancement

### Risks
- React Flow performance with large task graphs (mitigated by fitView and zoom controls)
- Edge cases with circular dependencies (should be prevented at task creation, but handle gracefully)

## Implementation Notes

1. The component should be a client component ('use client') since it uses React Flow
2. Follow the existing testing patterns from DependencyGraph tests
3. Export from `packages/web-ui/src/components/tasks/index.ts`
4. Consider memoization for the transformation functions

## Related Decisions
- Uses existing `DependencyGraph` component (ADR implicit in v0.6.0)
- Follows task component patterns established in SubtaskList
- Integrates with existing type system from @apexcli/core
