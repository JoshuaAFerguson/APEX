# ADR-020: SubtaskTree Collapse/Expand and Progress Indicators

## Status
Proposed

## Context

The `SubtaskTree` component (located at `packages/cli/src/ui/components/agents/SubtaskTree.tsx`) currently renders a hierarchical tree of subtasks with basic status icons and depth limiting. However, it lacks several key interactive and informational features:

1. **Collapse/Expand**: The `collapsed` prop exists in the interface but is not implemented
2. **Keyboard Navigation**: No keyboard support for interacting with tree nodes
3. **Progress Indicators**: No visual progress percentage for in-progress tasks
4. **Elapsed Time**: No real-time elapsed time tracking for active subtasks
5. **Collapsed Summary**: When collapsed, no indication of hidden children count

### Current Implementation Analysis

```typescript
// Current SubtaskNode interface - minimal
export interface SubtaskNode {
  id: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  children?: SubtaskNode[];
}

// Current SubtaskTreeProps - collapsed prop unused
export interface SubtaskTreeProps {
  task: SubtaskNode;
  maxDepth?: number;
  collapsed?: boolean;  // NOT IMPLEMENTED
}
```

## Decision

We will enhance the SubtaskTree component with:

### 1. Extended Data Model

```typescript
export interface SubtaskNode {
  id: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  children?: SubtaskNode[];
  // New fields for progress/timing
  progress?: number;          // 0-100 percentage (optional)
  startedAt?: Date;           // When the subtask started (for elapsed time)
  estimatedDuration?: number; // Estimated duration in ms (for progress estimation)
}

export interface SubtaskTreeProps {
  task: SubtaskNode;
  maxDepth?: number;
  defaultCollapsed?: boolean;          // Initial collapsed state for all nodes
  initialCollapsedIds?: Set<string>;   // Specific nodes to start collapsed
  onToggleCollapse?: (nodeId: string, collapsed: boolean) => void;
  showProgress?: boolean;              // Show progress indicators (default: true)
  showElapsedTime?: boolean;           // Show elapsed time (default: true)
  interactive?: boolean;               // Enable keyboard/click interaction (default: true)
  focusedNodeId?: string;              // Externally controlled focus
  onFocusChange?: (nodeId: string | null) => void;
}
```

### 2. State Management Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       SubtaskTree                                │
├─────────────────────────────────────────────────────────────────┤
│  State:                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ collapsedNodes   │  │ focusedNodeId    │  │ flatNodeList  │  │
│  │ Set<string>      │  │ string | null    │  │ SubtaskNode[] │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Hooks:                                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ useInput() - Ink keyboard handling                        │   │
│  │ useElapsedTime() - Real-time elapsed time (existing hook) │   │
│  │ useMemo() - Flattened node list for keyboard navigation   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Component Hierarchy

```
SubtaskTree (root)
├── useInput() handler for keyboard events
├── useMemo() for flattened visible node list
│
└── SubtaskNodeRow (recursive)
    ├── Collapse/Expand Indicator (▶/▼)
    ├── Status Icon ([○], [●], [✓], [✗])
    ├── Description Text
    ├── Progress Bar (if in-progress + progress data)
    ├── Elapsed Time (if in-progress + startedAt)
    └── Children Count Badge (if collapsed + has children)
```

### 4. Keyboard Navigation Scheme

| Key | Action |
|-----|--------|
| `↑` / `k` | Move focus to previous visible node |
| `↓` / `j` | Move focus to next visible node |
| `Space` | Toggle collapse/expand of focused node |
| `Enter` | Toggle collapse/expand of focused node |
| `←` / `h` | Collapse current node (or move to parent if already collapsed) |
| `→` / `l` | Expand current node (or move to first child if already expanded) |
| `Home` | Move focus to first node |
| `End` | Move focus to last visible node |

### 5. Visual Design

#### Expanded Node with Children
```
[●] Implement authentication           45% ⏱ 2m 30s
├── [✓] Create user model
├── [●] Implement login endpoint       ████████░░ 80%  ⏱ 1m 15s
│   ├── [✓] Validate credentials
│   └── [○] Generate JWT token
└── [○] Add password encryption
```

#### Collapsed Node
```
▶ [●] Implement authentication (3)     45% ⏱ 2m 30s
```

#### Focused Node (highlighted)
```
▶ [●] ⟨Implement authentication⟩ (3)   45% ⏱ 2m 30s
     ^^ Focus indicator (inverse colors or underline)
```

### 6. Implementation Approach

#### Phase 1: Core State Management
1. Add `collapsedNodes: Set<string>` state to track collapsed node IDs
2. Add `focusedNodeId: string | null` state for keyboard navigation
3. Create `useMemo` hook to compute flat list of visible nodes (respecting collapsed state)

#### Phase 2: Collapse/Expand Logic
1. Add toggle function that updates `collapsedNodes` Set
2. Render collapse indicator (▶/▼) before status icon
3. Skip rendering children when parent is collapsed
4. Show children count badge when collapsed: `(N)`

#### Phase 3: Keyboard Navigation
1. Use Ink's `useInput` hook for keyboard handling
2. Implement up/down navigation through flat visible node list
3. Implement Space/Enter for toggle
4. Implement left/right for hierarchical navigation
5. Visual focus indicator (inverse colors or bracket highlighting)

#### Phase 4: Progress Indicators
1. Integrate existing `useElapsedTime` hook per in-progress node
2. Add compact progress bar using `ProgressBar` component pattern
3. Format: `████████░░ 80%` (10 chars wide)

#### Phase 5: Elapsed Time Display
1. Use `useElapsedTime(node.startedAt)` for each active node
2. Display format: `⏱ Xm Ys` or `⏱ Xs`
3. Only show for `in-progress` status nodes

### 7. Performance Considerations

#### Optimization Strategy
1. **Memoization**: Use `React.memo` for `SubtaskNodeRow` to prevent unnecessary re-renders
2. **Elapsed Time**: Use single interval at tree level, pass down formatted time
3. **Flat List Caching**: Recompute only when `task` or `collapsedNodes` changes
4. **Virtual Scrolling**: Not needed initially (trees typically < 100 nodes)

#### Elapsed Time Batching
Instead of N intervals for N in-progress nodes, use single interval:
```typescript
const [tick, setTick] = useState(0);
useEffect(() => {
  const interval = setInterval(() => setTick(t => t + 1), 1000);
  return () => clearInterval(interval);
}, []);

// Pass tick to force re-render, each node computes its own elapsed time
```

### 8. Accessibility Considerations

1. **Focus Management**: Clear visual focus indicator
2. **Screen Reader**: Status conveyed through icons + text alternatives
3. **Keyboard Only**: Full functionality without mouse
4. **Color Independence**: Status distinguishable by icon shape, not just color

### 9. Testing Strategy

#### Unit Tests
- Collapse/expand state management
- Keyboard navigation logic
- Progress calculation
- Elapsed time formatting

#### Integration Tests
- Full tree rendering with mixed states
- Keyboard interaction flows
- Deep nesting scenarios
- Dynamic updates during collapse

#### Visual Tests
- Focus indicator rendering
- Progress bar appearance
- Collapsed badge display

## Consequences

### Positive
- Users can manage complex task hierarchies more effectively
- Real-time progress visibility improves task monitoring
- Keyboard navigation enables efficient terminal-based interaction
- Elapsed time helps users gauge task duration

### Negative
- Increased component complexity
- Additional state to manage
- More test coverage required
- Slight performance overhead for real-time updates

### Risks
- Keyboard handling may conflict with parent component handlers
- Deep hierarchies may still require scrolling even when collapsed

## Alternatives Considered

### 1. Separate Collapse Control Component
- Rejected: Would break the cohesive tree visual
- Better to integrate collapse toggle into the tree itself

### 2. Virtual Scrolling for Large Trees
- Deferred: Not needed for typical task hierarchies (< 50 nodes)
- Can be added later if performance issues arise

### 3. External State Management (Redux/Zustand)
- Rejected: Component-local state is sufficient
- Tree collapse state is UI-only, doesn't need persistence

## Implementation Files

### Files to Modify
1. `packages/cli/src/ui/components/agents/SubtaskTree.tsx` - Main implementation
2. `packages/cli/src/ui/components/agents/__tests__/SubtaskTree.test.tsx` - Test updates

### Files to Reference
1. `packages/cli/src/ui/hooks/useElapsedTime.ts` - Existing elapsed time hook
2. `packages/cli/src/ui/components/ProgressIndicators.tsx` - Progress bar patterns
3. `packages/cli/src/ui/components/AdvancedInput.tsx` - Keyboard handling patterns

## References

- Ink useInput documentation: https://github.com/vadimdemedes/ink#useinputinputhandler-options
- Existing `useElapsedTime` hook at `packages/cli/src/ui/hooks/useElapsedTime.ts`
- Existing `ProgressBar` component at `packages/cli/src/ui/components/ProgressIndicators.tsx`
