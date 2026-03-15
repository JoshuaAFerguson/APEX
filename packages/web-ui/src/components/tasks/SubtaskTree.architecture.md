# Architecture Decision Record: SubtaskTree Component

## Status
**Proposed**

## Context
We need to create a `SubtaskTree` component for the web-ui package that displays subtasks in a hierarchical tree structure with:
1. Expand/collapse controls for nested subtasks
2. Task status badges for each node
3. Keyboard navigation support
4. Click-to-navigate to subtask detail pages

The CLI package already has a mature `SubtaskTree.tsx` component (339 lines) that we can reference for patterns, but the web-ui requires a different implementation using React (web) instead of Ink (terminal).

## Decision

### 1. Component Location
**Location**: `packages/web-ui/src/components/tasks/SubtaskTree.tsx`

This follows the existing pattern where task-related components (SubtaskList, TaskCard, TaskDependencyGraph, etc.) are placed in the `tasks/` directory.

### 2. Component Architecture

**Decision**: Create a standalone recursive component with the following structure:

```
SubtaskTree.tsx (main component)
├── SubtaskTreeProvider (context for state management)
├── SubtaskTreeNode (recursive node renderer)
├── SubtaskTreeNodeContent (node content with badge and description)
└── SubtaskTreeExpander (expand/collapse button)
```

**Rationale**:
- Recursive component pattern matches the hierarchical nature of subtasks
- Context-based state management for collapse/expand state and keyboard navigation
- Follows React composition patterns used throughout the web-ui codebase

### 3. Type Definitions

**Decision**: Define types inline in the component file (following existing patterns like TaskCard, SubtaskList)

```typescript
/**
 * Represents a node in the subtask tree hierarchy
 */
export interface SubtaskTreeNode {
  id: string;
  description: string;
  status: TaskStatus;
  children: SubtaskTreeNode[];
  // Optional metadata
  progress?: number;
  startedAt?: Date;
  estimatedDuration?: number;
}

/**
 * Props for the SubtaskTree component
 */
export interface SubtaskTreeProps {
  /** The task ID to load subtasks for */
  taskId: string;

  /** Pre-loaded subtask tree (optional - will fetch if not provided) */
  tree?: SubtaskTreeNode;

  /** Maximum depth to render (default: 10, 0 = unlimited) */
  maxDepth?: number;

  /** Whether nodes start collapsed (default: false) */
  defaultCollapsed?: boolean;

  /** Initial set of node IDs that should be collapsed */
  initialCollapsedIds?: Set<string>;

  /** Callback when collapse state changes */
  onToggleCollapse?: (nodeId: string, collapsed: boolean) => void;

  /** Callback when a subtask is clicked (default: navigates to task page) */
  onSubtaskClick?: (subtaskId: string) => void;

  /** Whether keyboard navigation is enabled (default: true) */
  enableKeyboardNav?: boolean;

  /** Optional CSS class for the container */
  className?: string;

  /** Loading state indicator */
  loading?: boolean;

  /** Error message to display */
  error?: string | null;
}
```

### 4. Data Flow Architecture

**Decision**: Support both pre-loaded trees and automatic fetching

```
┌─────────────────────────────────────────────────────────────────┐
│                       SubtaskTree                                │
├─────────────────────────────────────────────────────────────────┤
│  Props: { taskId, tree?, maxDepth, ... }                        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ State Management (useReducer)                               ││
│  │  - collapsedNodes: Set<string>                              ││
│  │  - focusedNodeId: string | null                             ││
│  │  - visibleNodes: SubtaskTreeNode[] (computed)               ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Data Fetching (if tree prop not provided)                   ││
│  │  - useSubtaskTree(taskId) custom hook                       ││
│  │  - Calls apiClient.getSubtasks(taskId)                      ││
│  │  - Transforms flat list to hierarchical tree                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Rendering (recursive)                                       ││
│  │  SubtaskTreeNode → SubtaskTreeNode → ...                    ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 5. Tree Building Algorithm

**Decision**: Transform flat Task[] array to hierarchical SubtaskTreeNode[]

```typescript
/**
 * Build tree from flat task array using parentTaskId relationships
 *
 * Algorithm:
 * 1. Create map of taskId -> task for O(1) lookups
 * 2. Identify root nodes (tasks with matching parentTaskId to current taskId)
 * 3. Recursively build children using subtaskIds array
 * 4. Sort children by creation date (oldest first)
 */
function buildSubtaskTree(
  tasks: Task[],
  rootTaskId: string
): SubtaskTreeNode | null {
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  function buildNode(taskId: string): SubtaskTreeNode | null {
    const task = taskMap.get(taskId);
    if (!task) return null;

    return {
      id: task.id,
      description: task.description,
      status: task.status,
      children: (task.subtaskIds || [])
        .map(buildNode)
        .filter((n): n is SubtaskTreeNode => n !== null)
        .sort((a, b) => /* by creation date */),
      progress: task.progress,
      startedAt: task.startedAt,
    };
  }

  return buildNode(rootTaskId);
}
```

### 6. Keyboard Navigation

**Decision**: Implement vim-style keyboard navigation (matching CLI component)

| Key | Action |
|-----|--------|
| `↑` or `k` | Move to previous visible node |
| `↓` or `j` | Move to next visible node |
| `←` or `h` | Collapse current node OR move to parent |
| `→` or `l` | Expand current node OR move to first child |
| `Enter` or `Space` | Toggle collapse/expand OR navigate to task |
| `g` | Jump to first node |
| `G` (Shift+g) | Jump to last node |

**Implementation**: Use `useEffect` with `keydown` event listener, scoped to component focus.

```typescript
function useKeyboardNavigation(
  visibleNodes: SubtaskTreeNode[],
  focusedId: string | null,
  collapsedNodes: Set<string>,
  onFocusChange: (id: string | null) => void,
  onToggle: (id: string) => void,
  onNavigate: (id: string) => void,
  enabled: boolean
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // ... handle keys
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visibleNodes, focusedId, collapsedNodes, enabled]);
}
```

### 7. Visual Design

**Decision**: Use existing UI components (Badge, cn utility) with tree-specific styling

```
Tree Structure Visual:
┌────────────────────────────────────────────────────────┐
│ ▼ [Badge] Parent Task Description                      │
│   ├─ ▼ [Badge] Child Task 1                           │
│   │    └─ [Badge] Grandchild Task                     │
│   ├─ ▶ [Badge] Child Task 2 (collapsed, 3 subtasks)   │
│   └─ [Badge] Child Task 3                             │
└────────────────────────────────────────────────────────┘

Node States:
- Default: Standard text color
- Focused: Blue highlight background (keyboard nav)
- Hovered: Subtle background change
- Collapsed: Shows subtask count indicator
```

**CSS Classes** (using Tailwind):
```typescript
const nodeClasses = cn(
  // Base styles
  'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer',
  'transition-colors duration-150',
  // Interactive states
  'hover:bg-background-secondary',
  // Focus state (keyboard nav)
  isFocused && 'bg-apex-950/50 ring-1 ring-apex-500',
);
```

### 8. Tree Line Characters

**Decision**: Use Unicode box-drawing characters for visual hierarchy

```typescript
const TREE_CHARS = {
  vertical: '│',      // Continuing vertical line
  branch: '├─',       // Branch with sibling below
  lastBranch: '└─',   // Last branch (no sibling below)
  empty: '  ',        // Empty space for alignment
};
```

### 9. Expand/Collapse Controls

**Decision**: Chevron icons from lucide-react (consistent with existing components)

```typescript
import { ChevronRight, ChevronDown } from 'lucide-react';

const ExpanderIcon = isCollapsed ? ChevronRight : ChevronDown;
```

### 10. Navigation on Click

**Decision**: Use Next.js `useRouter` with configurable callback

```typescript
const router = useRouter();

const handleNodeClick = useCallback((nodeId: string) => {
  if (onSubtaskClick) {
    onSubtaskClick(nodeId);
  } else {
    router.push(`/tasks/${nodeId}`);
  }
}, [onSubtaskClick, router]);
```

### 11. Performance Considerations

**Decision**: Implement memoization and virtualization hooks

1. **Memoize node components**: Use `React.memo` for `SubtaskTreeNode`
2. **Memoize computed values**: `useMemo` for `visibleNodes` calculation
3. **Debounce keyboard navigation**: Prevent rapid key repeat issues
4. **Prepare for virtualization**: Design allows future addition of virtualization for large trees

```typescript
// Memoized visible nodes computation
const visibleNodes = useMemo(() => {
  return flattenVisibleNodes(tree, collapsedNodes, maxDepth);
}, [tree, collapsedNodes, maxDepth]);

// Memoized node component
const MemoizedNode = React.memo(SubtaskTreeNode, (prev, next) => {
  return (
    prev.node.id === next.node.id &&
    prev.node.status === next.node.status &&
    prev.isFocused === next.isFocused &&
    prev.isCollapsed === next.isCollapsed
  );
});
```

### 12. Accessibility (a11y)

**Decision**: Full ARIA tree widget implementation

```typescript
// Container
<div
  role="tree"
  aria-label="Subtask tree"
  aria-activedescendant={focusedNodeId || undefined}
  tabIndex={0}
>
  {/* nodes */}
</div>

// Node
<div
  role="treeitem"
  aria-expanded={hasChildren ? !isCollapsed : undefined}
  aria-selected={isFocused}
  aria-level={depth + 1}
  aria-setsize={siblingCount}
  aria-posinset={positionInSet}
  id={`subtask-${node.id}`}
>
  {/* content */}
</div>
```

### 13. Status Badge Integration

**Decision**: Reuse existing Badge component with status prop

```typescript
import { Badge } from '@/components/ui/Badge';
import type { TaskStatus } from '@apexcli/core';

// Direct usage with status mapping
<Badge status={node.status} className="text-xs" />
```

The existing Badge component already handles:
- Status-to-variant mapping via `getStatusVariant()`
- Status-to-label formatting via `formatStatus()`
- Consistent styling with the design system

### 14. Loading and Error States

**Decision**: Consistent patterns with SubtaskList component

```typescript
// Loading state
if (loading) {
  return (
    <div className="flex items-center gap-2 py-4">
      <Spinner size="sm" />
      <span className="text-sm text-foreground-secondary">Loading subtasks...</span>
    </div>
  );
}

// Error state
if (error) {
  return (
    <div className="text-sm text-red-500 py-2">
      {error}
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

// Empty state
if (!tree || tree.children.length === 0) {
  return (
    <div className="text-sm text-foreground-secondary py-4 text-center">
      No subtasks found
    </div>
  );
}
```

## File Structure

```
packages/web-ui/src/
├── components/
│   └── tasks/
│       ├── SubtaskTree.tsx               # Main component
│       ├── SubtaskTree.architecture.md   # This ADR
│       └── __tests__/
│           ├── SubtaskTree.test.tsx      # Unit tests
│           └── SubtaskTree.integration.test.tsx
├── hooks/
│   └── useSubtaskTree.ts                 # Data fetching hook (optional)
└── lib/
    └── subtask-tree-utils.ts             # Tree building utilities (optional)
```

## API Design

### SubtaskTree Component

```typescript
import { SubtaskTree } from '@/components/tasks/SubtaskTree';

// Basic usage - auto-fetches and auto-navigates
<SubtaskTree taskId="task-123" />

// Pre-loaded tree data
<SubtaskTree taskId="task-123" tree={preloadedTree} />

// Custom click handler
<SubtaskTree
  taskId="task-123"
  onSubtaskClick={(id) => handleCustomNavigation(id)}
/>

// Controlled collapse state
<SubtaskTree
  taskId="task-123"
  initialCollapsedIds={new Set(['child-1', 'child-2'])}
  onToggleCollapse={(id, collapsed) => trackCollapseState(id, collapsed)}
/>

// Disabled keyboard navigation (for embedded views)
<SubtaskTree taskId="task-123" enableKeyboardNav={false} />

// Limited depth rendering
<SubtaskTree taskId="task-123" maxDepth={3} />
```

### Integration Points

1. **Task Detail Page** (`/tasks/[id]/page.tsx`):
   - Replace or enhance existing `SubtaskList` with `SubtaskTree`
   - Show hierarchical view when subtasks have nested children

2. **Dashboard**:
   - Optional tree view toggle for task lists
   - Collapsed by default for space efficiency

## Consequences

### Positive
- Hierarchical visualization matches mental model of subtasks
- Keyboard navigation improves accessibility and power-user efficiency
- Reuses existing UI components (Badge, Spinner, Button)
- Follows established patterns from CLI component
- Type-safe with full TypeScript support

### Negative
- More complex than flat list (SubtaskList)
- May require API enhancement to efficiently fetch full tree
- Keyboard navigation scope requires careful focus management

### Risks
- Performance with deeply nested trees (mitigated by maxDepth)
- Circular reference in subtask relationships (should be prevented at API level)
- Focus management conflicts with other keyboard shortcuts

## Implementation Notes

1. Use `'use client'` directive as component uses React hooks and DOM events
2. Follow existing testing patterns from SubtaskList and TaskDependencyGraph tests
3. Export from `packages/web-ui/src/components/tasks/index.ts`
4. Consider adding `data-testid` attributes for testing
5. Ensure proper cleanup of event listeners in `useEffect`

## Migration Path

1. Create SubtaskTree component alongside existing SubtaskList
2. Add tree view toggle to Task Detail page
3. Gradually replace SubtaskList in relevant contexts
4. Document usage differences for developers

## Related Decisions
- Builds on SubtaskList patterns for loading/error states
- Uses Badge component for status display
- Follows TaskDependencyGraph patterns for node interactions
- References CLI SubtaskTree for keyboard navigation patterns
