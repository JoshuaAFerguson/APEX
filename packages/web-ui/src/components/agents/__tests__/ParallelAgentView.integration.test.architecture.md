# Technical Design: ParallelAgentView Integration Tests

## ADR-0001: Integration Test Architecture for ParallelAgentView within DashboardPage

**Status**: Approved
**Date**: 2025-01-16
**Authors**: Architect Agent

## Context

The `ParallelAgentView` component is used within the `DashboardPage` (packages/web-ui/src/app/page.tsx) to display parallel agent executions in a kanban-style interface. The acceptance criteria require integration tests verifying:

1. **Rendering verification** - ParallelAgentView renders correctly within DashboardPage
2. **Real-time data updates** - Responds to real-time data updates from `useParallelAgentView` hook
3. **Agent actions work** - Pause, resume, cancel, retry actions function correctly
4. **Navigation to task detail** - Clicking on agents navigates to `/tasks/{taskId}`

## Analysis of Existing Code

### Component Structure
```
DashboardPage (page.tsx)
  └── ParallelAgentView
        └── AgentLane (multiple)
              └── AgentExecutionCard (multiple)
```

### Key Dependencies
1. **useParallelAgentView hook** - Provides `data`, `loading`, `error`, `isConnected`, `refresh`, `updateExecution`, `addExecution`, `removeExecution`
2. **useRouter** - Next.js router for navigation
3. **AgentLane** - Child component displaying individual lanes
4. **AgentExecutionCard** - Child component for individual agent cards

### Existing Test Patterns
- Unit tests exist for `AgentLane` (`packages/web-ui/src/components/agents/__tests__/AgentLane.test.tsx`)
- Integration test pattern established in `page.integration.test.tsx` with WebSocket coordination
- Mock strategy pattern established in `RecentActivityFeed.integration.test.tsx`

## Technical Design

### Test File Location
```
packages/web-ui/src/components/agents/__tests__/ParallelAgentView.integration.test.tsx
```

### Test Structure

```typescript
/**
 * Integration Tests for ParallelAgentView Component
 *
 * Tests the integration of ParallelAgentView within DashboardPage context,
 * including real-time data updates, agent actions, and navigation.
 *
 * Acceptance Criteria Coverage:
 * - AC1: ParallelAgentView renders correctly within DashboardPage
 * - AC2: Responds to real-time data updates
 * - AC3: Agent actions (pause, resume, cancel, retry) work
 * - AC4: Navigation to task detail works
 */
describe('ParallelAgentView Integration Tests', () => {
  describe('AC1: Rendering within Dashboard Context', () => {
    // Verify component renders with correct data
    // Test loading state
    // Test error state
    // Test empty state
  })

  describe('AC2: Real-time Data Updates', () => {
    // Test data refresh on prop changes
    // Test progress update flow
    // Test new agent addition
    // Test agent removal
    // Test live connection indicator
  })

  describe('AC3: Agent Actions', () => {
    // Test pause action callback
    // Test resume action callback
    // Test cancel action callback
    // Test retry action callback
  })

  describe('AC4: Navigation to Task Details', () => {
    // Test click navigation with taskId
    // Test no navigation when taskId is missing
  })
})
```

### Mock Strategy

#### 1. Import React (Required - see test setup notes)
```typescript
import React from 'react'  // CRITICAL: Must import React for JSX
```

#### 2. Mock useParallelAgentView Hook
```typescript
vi.mock('@/hooks/useParallelAgentView', () => ({
  useParallelAgentView: vi.fn()
}))

const createMockParallelAgentViewReturn = (overrides = {}) => ({
  data: createMockParallelAgentData(),
  loading: false,
  error: null,
  isConnected: true,
  refresh: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  updateExecution: vi.fn(),
  addExecution: vi.fn(),
  removeExecution: vi.fn(),
  ...overrides
})
```

#### 3. Mock Next.js Router
```typescript
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush })
}))
```

#### 4. Create Test Data Factory
```typescript
import type {
  ParallelAgentViewData,
  AgentLane,
  AgentExecution
} from '@/types/parallel-agent-view'
import { EMPTY_PARALLEL_AGENT_VIEW_DATA } from '@/types/parallel-agent-view'

const createMockExecution = (overrides: Partial<AgentExecution> = {}): AgentExecution => ({
  id: `exec-${Math.random().toString(36).substr(2, 9)}`,
  agentId: 'agent-1',
  agentName: 'Developer Agent',
  status: 'running',
  stage: 'implementing',
  progress: 65,
  startedAt: new Date('2024-01-01T10:00:00Z'),
  laneId: 'development',
  taskId: 'task-123',
  taskDescription: 'Implement feature',
  tokensUsed: 12500,
  estimatedCost: 0.25,
  ...overrides
})

const createMockLane = (overrides: Partial<AgentLane> = {}): AgentLane => ({
  id: 'development',
  label: 'Development',
  description: 'Development tasks',
  executions: [createMockExecution()],
  color: '#3b82f6',
  ...overrides
})

const createMockParallelAgentData = (overrides: Partial<ParallelAgentViewData> = {}): ParallelAgentViewData => ({
  lanes: [
    createMockLane({ id: 'development', label: 'Development' }),
    createMockLane({ id: 'testing', label: 'Testing', executions: [] })
  ],
  totalExecutions: 1,
  runningCount: 1,
  completedCount: 0,
  failedCount: 0,
  overallProgress: 65,
  totalTokensUsed: 12500,
  totalEstimatedCost: 0.25,
  lastUpdated: new Date('2024-01-01T10:30:00Z'),
  ...overrides
})
```

### Test Cases Detail

#### Test Suite 1: AC1 - Rendering within Dashboard Context

| Test Case | Description | Expected Outcome |
|-----------|-------------|------------------|
| `renders with correct data from hook` | Render with mock data, verify UI elements | Title, badges, execution count visible |
| `displays loading state` | Render with `loading: true` | Shows spinner and loading text |
| `displays error state` | Render with `error: 'Failed to load'` | Shows error message and retry button |
| `displays empty state` | Render with empty lanes | Shows empty message |
| `renders header statistics` | Render with mixed status executions | Shows correct active/completed/failed badges |

#### Test Suite 2: AC2 - Real-time Data Updates

| Test Case | Description | Expected Outcome |
|-----------|-------------|------------------|
| `updates display when new data arrives` | Rerender with updated runningCount | UI reflects new count |
| `reflects agent progress updates` | Rerender with updated progress | Progress bar updates |
| `handles new agent additions` | Rerender with additional execution | New agent card appears |
| `handles agent removal` | Rerender without execution | Agent card removed |
| `shows live connection indicator` | Render with `isConnected: true` | "Live" badge visible |
| `shows disconnected state` | Render with `isConnected: false` | No "Live" badge |

#### Test Suite 3: AC3 - Agent Actions

| Test Case | Description | Expected Outcome |
|-----------|-------------|------------------|
| `calls onAgentPause callback` | Click pause button on running agent | Callback called with execution ID |
| `calls onAgentResume callback` | Click resume button on paused agent | Callback called with execution ID |
| `calls onAgentCancel callback` | Click cancel button on agent | Callback called with execution ID |
| `calls onAgentRetry callback` | Click retry button on failed agent | Callback called with execution ID |

#### Test Suite 4: AC4 - Navigation to Task Details

| Test Case | Description | Expected Outcome |
|-----------|-------------|------------------|
| `navigates to task detail on click` | Click agent card with taskId | `router.push('/tasks/task-123')` called |
| `does not navigate when no taskId` | Click agent card without taskId | `router.push` not called |

### Integration with DashboardPage

The DashboardPage already integrates ParallelAgentView with the following configuration:

```typescript
// From page.tsx (lines 443-479)
<ParallelAgentView
  data={parallelAgentData}
  config={{
    layout: 'lanes',
    size: 'md',
    showProgress: true,
    showElapsedTime: true,
    showTokenUsage: false,
    showCost: false,
    showStages: true,
    animated: true,
    maxLanes: 4,
    maxAgentsPerLane: 6,
  }}
  onAgentClick={(execution) => {
    if (execution.taskId) {
      router.push(`/tasks/${execution.taskId}`)
    }
  }}
  onAgentPause={async (executionId) => { ... }}
  onAgentResume={async (executionId) => { ... }}
  onAgentCancel={async (executionId) => { ... }}
  onAgentRetry={async (executionId) => { ... }}
  loading={parallelLoading}
  error={parallelError}
  testId="dashboard-parallel-agent-view"
/>
```

### Test Wrapper Component

```typescript
/**
 * Test wrapper that provides dashboard-like context for ParallelAgentView
 * Mimics the integration from DashboardPage
 */
const ParallelAgentViewWrapper: React.FC<{
  onAgentClick?: (execution: AgentExecution) => void;
  onAgentPause?: (executionId: string) => void;
  onAgentResume?: (executionId: string) => void;
  onAgentCancel?: (executionId: string) => void;
  onAgentRetry?: (executionId: string) => void;
}> = ({
  onAgentClick,
  onAgentPause = vi.fn(),
  onAgentResume = vi.fn(),
  onAgentCancel = vi.fn(),
  onAgentRetry = vi.fn(),
}) => {
  const {
    data: parallelAgentData,
    loading: parallelLoading,
    error: parallelError,
    isConnected: parallelConnected,
  } = mockUseParallelAgentView()

  const router = useRouter()

  const handleAgentClick = onAgentClick || ((execution: AgentExecution) => {
    if (execution.taskId) {
      router.push(`/tasks/${execution.taskId}`)
    }
  })

  return (
    <ParallelAgentView
      data={parallelAgentData}
      config={{
        layout: 'lanes',
        size: 'md',
        showProgress: true,
        showElapsedTime: true,
        showTokenUsage: false,
        showCost: false,
        showStages: true,
        animated: true,
        maxLanes: 4,
        maxAgentsPerLane: 6,
      }}
      onAgentClick={handleAgentClick}
      onAgentPause={onAgentPause}
      onAgentResume={onAgentResume}
      onAgentCancel={onAgentCancel}
      onAgentRetry={onAgentRetry}
      loading={parallelLoading}
      error={parallelError}
      testId="dashboard-parallel-agent-view"
    />
  )
}
```

## Implementation Plan

### Phase 1: Test Infrastructure
1. Create integration test file with proper imports (React import is critical)
2. Set up mock configuration for hooks
3. Create test data factories

### Phase 2: Core Integration Tests (AC1, AC2)
1. Implement rendering verification tests
2. Implement real-time data update tests

### Phase 3: Action and Navigation Tests (AC3, AC4)
1. Implement agent action callback tests
2. Implement navigation tests

## Dependencies

### External Libraries
- `vitest` - Test framework
- `@testing-library/react` - Component testing
- `@testing-library/user-event` - User interaction simulation
- `@testing-library/jest-dom/vitest` - DOM assertions

### Internal Dependencies
- `@/components/agents/ParallelAgentView`
- `@/hooks/useParallelAgentView`
- `@/types/parallel-agent-view`
- `@/lib/utils`

## Critical Implementation Notes

1. **React Import**: Always import React explicitly in test files: `import React from 'react'`
2. **Mock Child Components**: Mock `AgentLane` and `AgentExecutionCard` to isolate integration tests
3. **Fake Timers**: Use `vi.useFakeTimers()` for testing auto-refresh behavior
4. **waitFor/act**: Use React Testing Library's `waitFor` and `act` for async state updates
5. **userEvent**: Prefer `@testing-library/user-event` over `fireEvent` for realistic interactions

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| AgentExecutionCard mock complexity | Use shallow mock that emits click events |
| Real-time update timing | Use fake timers (`vi.useFakeTimers`) |
| Router mock conflicts with setup.ts | Clear mocks in `beforeEach`, override specific methods |
| Test flakiness from async operations | Use `waitFor`/`act` appropriately |
| React not defined errors | Explicitly import React in test file |

## Success Criteria

1. All tests pass (`npm run test`)
2. Build succeeds (`npm run build`)
3. All acceptance criteria verified:
   - ✅ AC1: ParallelAgentView renders correctly within DashboardPage
   - ✅ AC2: Responds to real-time data updates
   - ✅ AC3: Agent actions (pause, resume, cancel, retry) work
   - ✅ AC4: Navigation to task detail works

## File Deliverables

| File | Purpose |
|------|---------|
| `ParallelAgentView.integration.test.tsx` | Main integration test file |

## References

- Existing test patterns: `packages/web-ui/src/app/__tests__/page.integration.test.tsx`
- Component: `packages/web-ui/src/components/agents/ParallelAgentView.tsx`
- Hook: `packages/web-ui/src/hooks/useParallelAgentView.ts`
- Types: `packages/web-ui/src/types/parallel-agent-view.ts`
- Working test example: `packages/web-ui/src/components/activity/__tests__/RecentActivityFeed.integration.test.tsx`
