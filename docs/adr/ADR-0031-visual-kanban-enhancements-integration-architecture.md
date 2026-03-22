# ADR-0031: Visual Kanban Enhancements Integration Architecture

## Status
Accepted

## Date
2026-03-20

## Context

We need to integrate three Visual Kanban enhancement features into the existing APEX web-ui:

1. **Context Injection Button** - Already implemented on KanbanBoard cards
2. **ParallelAgentView** - New component needed (types exist, component does not)
3. **ExecutionTimeline** - Component exists but not integrated into task pages

### Acceptance Criteria
- Context injection button appears on KanbanBoard cards ✓ (DONE)
- ParallelAgentView integrated into dashboard or dedicated route
- ExecutionTimeline integrated into task detail page
- Unit and integration tests pass for all three features

### Current State Analysis

#### KanbanBoard with Context Injection (COMPLETE)
**Location:** `/packages/web-ui/src/components/tasks/KanbanBoard.tsx`
- Context injection button already integrated into `KanbanCard` component
- Uses `ContextInjectionModal` for injection workflow
- Available for actionable task states (running, pending, planning, waiting-approval, paused)
- Tests exist in `ContextInjectionModal.test.tsx`

#### ExecutionTimeline (EXISTS - NOT INTEGRATED)
**Location:** `/packages/web-ui/src/components/tasks/ExecutionTimeline.tsx`
- Fully implemented with `forwardRef` pattern
- Supports stages, timing display, animations
- Tests exist in `ExecutionTimeline.test.tsx` and `ExecutionTimeline.integration.test.tsx`
- NOT currently used in any page - only exported from index

#### ParallelAgentView (TYPES ONLY - NO COMPONENT)
**Types Location:** `/packages/web-ui/src/types/parallel-agent-view.ts`
- Comprehensive type definitions (1007 lines)
- Supports lane-based layout with multiple agents
- Has utility functions defined
- NO React component implementation exists

## Decision

### 1. ExecutionTimeline Integration

#### Integration Point: Task Detail Page
**File:** `/packages/web-ui/src/app/tasks/[id]/page.tsx`

**Placement:** Add ExecutionTimeline in the main content area (left column) after the Approval Gate Panel and before Task Dependencies Graph.

**Architecture:**

```typescript
// In task detail page, add after GatePanel and before TaskDependencyGraph
{/* Execution Timeline */}
{task.executionStages && task.executionStages.length > 0 && (
  <Card>
    <CardHeader>
      <h2 className="text-lg font-semibold">Execution Timeline</h2>
    </CardHeader>
    <CardContent>
      <ExecutionTimeline
        stages={task.executionStages}
        currentStageId={task.currentStage}
        showTiming={true}
        animated={isRunning}
        onStageClick={(stageId) => {
          // Optional: scroll to logs for that stage or filter logs
        }}
      />
    </CardContent>
  </Card>
)}
```

**Data Transformation:**
Create a utility function to transform task stage data to ExecutionTimeline stages:

```typescript
// In /lib/utils.ts or new /lib/execution-timeline-utils.ts
export function transformTaskToExecutionStages(task: Task): ExecutionStage[] {
  // Map task workflow stages to ExecutionStage interface
  const stages: ExecutionStage[] = [
    { id: 'pending', name: 'Pending', status: 'pending' },
    { id: 'planning', name: 'Planning', status: 'pending' },
    { id: 'executing', name: 'Executing', status: 'pending' },
    { id: 'reviewing', name: 'Reviewing', status: 'pending' },
    { id: 'completed', name: 'Completed', status: 'pending' },
  ]

  // Update statuses based on task state
  // ... transformation logic

  return stages
}
```

### 2. ParallelAgentView Component Implementation

#### Component Location
**Path:** `/packages/web-ui/src/components/agents/ParallelAgentView.tsx`

#### Architecture Pattern
Follow existing component patterns from KanbanBoard:

```
ParallelAgentView (Main Container)
├── AgentLaneHeader (Lane title, collapse toggle, stats)
├── AgentLaneBody (Scrollable agent executions list)
│   └── AgentExecutionCard (Individual agent card)
│       ├── Status indicator (with animation)
│       ├── Progress bar
│       ├── Agent info (name, task, stage)
│       ├── Metrics (tokens, cost, duration)
│       └── Action buttons (pause, resume, cancel)
├── ViewControls (Layout switcher, sort, filters)
└── SummaryBar (Total counts, overall progress)
```

#### Integration Point Options

**Option A: Dashboard Panel (Recommended)**
Add to dashboard as a new row or alongside existing Active Tasks Panel:

```typescript
// In /app/page.tsx dashboard
<Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold">Parallel Agent Execution</h2>
      <Badge variant="apex">{parallelData.runningCount} active</Badge>
    </div>
  </CardHeader>
  <CardContent>
    <ParallelAgentView
      data={parallelAgentData}
      config={{ layout: 'lanes', size: 'md', showProgress: true }}
      onAgentClick={handleAgentClick}
      onAgentPause={handleAgentPause}
      onAgentResume={handleAgentResume}
      onAgentCancel={handleAgentCancel}
    />
  </CardContent>
</Card>
```

**Option B: Dedicated Route**
Create `/app/agents/parallel/page.tsx` for full-screen view with more controls.

**Recommendation:** Start with Option A (Dashboard), then add Option B as enhancement.

#### State Management
Use custom hook for data fetching and real-time updates:

```typescript
// /hooks/useParallelAgentView.ts
export function useParallelAgentView(options: {
  autoRefresh?: boolean
  refreshInterval?: number
}) {
  const [data, setData] = useState<ParallelAgentViewData>(EMPTY_PARALLEL_AGENT_VIEW_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch from API or WebSocket
  // Transform to ParallelAgentViewData format
  // Return { data, loading, error, refresh }
}
```

### 3. Testing Strategy

#### Test Organization
Follow existing patterns from ContextInjectionModal and ExecutionTimeline tests:

```
packages/web-ui/src/components/
├── tasks/__tests__/
│   ├── ExecutionTimeline.test.tsx          # EXISTS
│   ├── ExecutionTimeline.integration.test.tsx # EXISTS
│   └── ContextInjectionModal.test.tsx      # EXISTS
├── agents/__tests__/
│   ├── ParallelAgentView.test.tsx          # NEW
│   ├── ParallelAgentView.integration.test.tsx # NEW
│   └── ParallelAgentView.accessibility.test.tsx # NEW
└── pages/__tests__/
    └── TaskDetailPage.integration.test.tsx # NEW - for timeline integration
```

#### Test Categories

**Unit Tests (*.test.tsx)**
- Component rendering with various props
- Status icon rendering
- Progress bar states
- Callback invocations
- Loading/error/empty states
- Layout variants (lanes, grid, timeline, compact)

**Integration Tests (*.integration.test.tsx)**
- Real-time data flow
- API integration mocking
- Multi-component interactions
- Dashboard integration
- Task detail page integration

**Edge Cases**
- Empty lane lists
- Single agent
- Many agents (>100)
- All agents in same status
- Mixed statuses
- Missing optional data

### 4. API Data Requirements

#### For ExecutionTimeline Integration
The Task API response should include execution stages. If not currently available:

```typescript
// Expected in Task API response
interface TaskWithStages extends Task {
  executionStages?: Array<{
    id: string
    name: string
    status: 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'skipped'
    startedAt?: Date
    completedAt?: Date
    duration?: number
  }>
}
```

**Fallback:** If API doesn't provide stages, derive them from task status and workflow:
- Use `task.currentStage` for current stage identification
- Infer completed stages from task status progression
- Use timestamps from task for duration calculation

#### For ParallelAgentView
New API endpoint or WebSocket subscription needed:

```typescript
// GET /api/agents/parallel or WebSocket channel
interface ParallelAgentApiResponse {
  lanes: AgentLane[]
  stats: {
    total: number
    running: number
    completed: number
    failed: number
  }
}
```

### 5. File Structure

```
packages/web-ui/src/
├── app/
│   ├── tasks/[id]/page.tsx              # MODIFY - add ExecutionTimeline
│   ├── page.tsx                         # MODIFY - add ParallelAgentView
│   └── agents/
│       └── parallel/page.tsx            # NEW - dedicated route (optional)
├── components/
│   ├── tasks/
│   │   ├── ExecutionTimeline.tsx        # EXISTS - no changes needed
│   │   └── __tests__/
│   │       ├── ExecutionTimeline.test.tsx        # EXISTS
│   │       └── ExecutionTimeline.integration.test.tsx # EXISTS
│   └── agents/
│       ├── ParallelAgentView.tsx        # NEW
│       ├── AgentLane.tsx                # NEW - sub-component
│       ├── AgentExecutionCard.tsx       # NEW - sub-component
│       ├── index.ts                     # MODIFY - add exports
│       └── __tests__/
│           ├── ParallelAgentView.test.tsx        # NEW
│           ├── ParallelAgentView.integration.test.tsx # NEW
│           └── AgentExecutionCard.test.tsx       # NEW
├── hooks/
│   └── useParallelAgentView.ts          # NEW
├── lib/
│   └── execution-timeline-utils.ts      # NEW (optional - for data transformation)
└── types/
    └── parallel-agent-view.ts           # EXISTS - comprehensive types
```

### 6. Component Dependencies

```
ParallelAgentView
├── Uses: @/types/parallel-agent-view (all types)
├── Uses: @/components/ui/Badge, Button, Card, Spinner
├── Uses: @/lib/utils (cn, formatCost, formatTime)
├── Uses: lucide-react icons
└── New hook: useParallelAgentView

ExecutionTimeline (Task Detail Integration)
├── Uses: @/components/tasks/ExecutionTimeline
├── Uses: @/components/ui/Card
└── Data: task.executionStages or derived from task state
```

## Implementation Order

### Phase 1: ExecutionTimeline Integration (Low Risk)
1. Update task detail page to conditionally render ExecutionTimeline
2. Add data transformation utility if needed
3. Add integration tests for task detail page

### Phase 2: ParallelAgentView Component (Medium Risk)
1. Create ParallelAgentView component using existing types
2. Create sub-components (AgentLane, AgentExecutionCard)
3. Add unit tests for all components
4. Create useParallelAgentView hook

### Phase 3: Dashboard Integration (Low Risk)
1. Integrate ParallelAgentView into dashboard
2. Add real-time updates via WebSocket
3. Add integration tests

### Phase 4: Verification (Critical)
1. Run full test suite: `npm run test`
2. Run build: `npm run build`
3. Manual verification in browser

## Consequences

### Positive
- Leverages existing, well-tested components (ExecutionTimeline)
- Uses comprehensive type definitions (parallel-agent-view.ts)
- Follows established patterns (KanbanBoard, ContextInjectionModal)
- Minimal changes to existing code
- Clean separation of concerns

### Negative
- ParallelAgentView requires new API endpoint or WebSocket channel
- May need backend changes for execution stages data
- Additional test maintenance

### Risks
- API data availability for execution stages
- Performance with many parallel agents
- WebSocket connection management for real-time updates

## References
- ADR-0030: ExecutionTimeline Component Architecture
- ADR-0021: Kanban Drag and Drop Architecture
- ADR-0011: Kanban Context Injection Button
- Existing tests: ContextInjectionModal.test.tsx, ExecutionTimeline.test.tsx
