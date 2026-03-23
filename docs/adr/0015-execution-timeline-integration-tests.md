# ADR-0015: ExecutionTimeline Integration Test Architecture

## Status
**Accepted** - Architecture Stage

## Context

The ExecutionTimeline component is used in the task detail page (`/tasks/[id]/page.tsx`) to visualize task execution stages. While comprehensive unit tests exist (`ExecutionTimeline.test.tsx`) and edge case tests (`ExecutionTimeline.edge-cases.test.tsx`), the existing integration tests (`ExecutionTimeline.integration.test.tsx`) need enhancement to fully cover the acceptance criteria:

1. Renders with task data transformation
2. Shows correct stages for different task types
3. Animates for running tasks
4. Stage clicks work correctly
5. Timing displays correctly

## Decision

### Test Architecture Design

#### 1. Test File Structure

The integration tests will be organized in the existing file:
```
packages/web-ui/src/components/tasks/__tests__/ExecutionTimeline.integration.test.tsx
```

#### 2. Test Categories Required

Based on the acceptance criteria and existing gaps, the integration tests need these categories:

##### A. Task Data Transformation Integration
Tests the integration between raw Task objects and the ExecutionTimeline component:
- Transform developer workflow tasks to correct stages
- Transform researcher workflow tasks to correct stages
- Transform reviewer workflow tasks to correct stages
- Transform orchestrator workflow tasks to correct stages
- Handle custom/unknown workflow types with default stages
- Handle tasks with explicit `executionStages` from API

##### B. Stage Rendering Verification
Verify correct stages display for different task states:
- Pending/Queued tasks show initial stage as running
- In-progress tasks show correct current stage
- Completed tasks show all stages as completed
- Failed tasks show failed stage indicator
- Cancelled tasks show skipped stages
- Paused tasks show paused indicator

##### C. Animation Integration
Test animation behavior with running tasks:
- Running tasks trigger `animate-pulse` class
- Completed tasks do not animate
- Failed tasks do not animate
- Animation toggles correctly when `animated` prop changes
- Progress bar animates for running tasks

##### D. Stage Click Handler Integration
Test click interactions in realistic scenarios:
- Click handlers receive correct stage IDs
- Keyboard navigation (Enter/Space) works
- Multiple clicks track correctly
- Click handler integrates with task navigation
- Accessibility attributes present when clickable

##### E. Timing Display Integration
Test timing calculations and display:
- Completed stages show duration (format: Xs, Xm, Xm Xs, Xh Xm)
- Running stages show elapsed time
- Time updates correctly (using fake timers)
- Large durations format correctly
- Edge cases: negative durations, missing start times

#### 3. Mock Strategy

```typescript
// Mock the utility functions to control transformation
vi.mock('@/lib/execution-timeline-utils', async () => {
  const actual = await vi.importActual('@/lib/execution-timeline-utils')
  return {
    ...actual,
    // Allow real transformations but enable spying
  }
})

// Mock getElapsedTime from utils for controlled timing tests
vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual('@/lib/utils')
  return {
    ...actual,
    getElapsedTime: vi.fn().mockReturnValue('5m'),
  }
})
```

#### 4. Test Data Factories

Create comprehensive task factories that mirror real API responses:

```typescript
// Factory for creating realistic task objects
const createTaskWithWorkflow = (
  workflow: 'developer' | 'researcher' | 'reviewer' | 'orchestrator',
  status: TaskStatus,
  overrides?: Partial<Task>
): Task => ({
  id: `task-${workflow}-${status}`,
  description: `Test ${workflow} task`,
  status,
  workflow,
  autonomy: 'medium',
  priority: 'medium',
  effort: 'medium',
  projectPath: '/test',
  retryCount: 0,
  maxRetries: 3,
  resumeAttempts: 0,
  createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
  updatedAt: new Date('2024-01-01T10:00:00Z').toISOString(),
  currentStage: getDefaultStage(workflow, status),
  ...overrides,
})
```

#### 5. Test Organization Pattern

Follow the established pattern from `SubtaskTree.integration.test.tsx`:

```typescript
describe('ExecutionTimeline Task Detail Integration', () => {
  describe('Task Data Transformation', () => {
    // Tests for transformTaskToExecutionStages integration
  })

  describe('Workflow-Specific Stage Rendering', () => {
    // Tests for different workflow types
  })

  describe('Running Task Animation', () => {
    // Tests for animation behaviors
  })

  describe('Stage Interaction', () => {
    // Tests for click handlers and keyboard navigation
  })

  describe('Timing Display', () => {
    // Tests for duration and elapsed time display
  })

  describe('Task Detail Page Integration', () => {
    // Tests simulating real page usage
  })
})
```

#### 6. Key Test Scenarios

##### Scenario 1: Developer Workflow Task Transformation
```typescript
it('transforms developer task to planning → implementing → testing → reviewing stages', async () => {
  const task = createTaskWithWorkflow('developer', 'in-progress', {
    currentStage: 'implementing',
    createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
  })

  const stages = transformTaskToExecutionStages(task)

  render(
    <ExecutionTimeline
      stages={stages}
      currentStageId={getCurrentStageId(task)}
      animated={true}
      showTiming={true}
    />
  )

  expect(screen.getByText('Planning')).toBeInTheDocument()
  expect(screen.getByText('Implementing')).toBeInTheDocument()
  expect(screen.getByText('Testing')).toBeInTheDocument()
  expect(screen.getByText('Reviewing')).toBeInTheDocument()
})
```

##### Scenario 2: Animation for Running Task
```typescript
it('applies animation to running stage indicator', async () => {
  const runningStages = [
    { id: 'planning', name: 'Planning', status: 'completed' },
    { id: 'implementing', name: 'Implementing', status: 'running' },
    { id: 'testing', name: 'Testing', status: 'pending' },
  ]

  const { container } = render(
    <ExecutionTimeline
      stages={runningStages}
      currentStageId="implementing"
      animated={true}
    />
  )

  const animatedElements = container.querySelectorAll('.animate-pulse')
  expect(animatedElements.length).toBeGreaterThan(0)
})
```

##### Scenario 3: Stage Click with Task Context
```typescript
it('stage click integrates with task navigation pattern', async () => {
  const onStageClick = vi.fn()
  const stages = transformTaskToExecutionStages(testTask)

  render(
    <ExecutionTimeline
      stages={stages}
      currentStageId="implementing"
      onStageClick={onStageClick}
    />
  )

  await userEvent.click(screen.getByText('Planning'))

  expect(onStageClick).toHaveBeenCalledWith('planning')
  // Could verify integration with log scrolling or stage details
})
```

##### Scenario 4: Timing Display Integration
```typescript
it('displays elapsed time for running stages using real transformation', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-01-01T10:15:00Z'))

  const task = createTaskWithWorkflow('developer', 'in-progress', {
    currentStage: 'implementing',
    createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
  })

  const stages = transformTaskToExecutionStages(task)

  render(
    <ExecutionTimeline
      stages={stages}
      currentStageId="implementing"
      showTiming={true}
    />
  )

  // Should show elapsed time for running stage
  expect(screen.getByText(/15m|15 min/)).toBeInTheDocument()

  vi.useRealTimers()
})
```

#### 7. Integration Points

The tests should verify integration with:

1. **`transformTaskToExecutionStages()`** - Core transformation function
2. **`getCurrentStageId()`** - Current stage detection
3. **`shouldShowExecutionTimeline()`** - Visibility logic
4. **`getElapsedTime()`** - Time formatting
5. **Task status → stage status mapping**

#### 8. Accessibility Integration

Tests should verify accessibility in integration context:
- Button roles present when clickable
- Tab indices correct
- Keyboard navigation works
- Screen reader labels exist

## Consequences

### Positive
- Comprehensive coverage of acceptance criteria
- Tests transformation logic with real data
- Verifies animation and timing in realistic scenarios
- Follows established project patterns

### Negative
- More complex test setup required
- May need to update tests when transformation logic changes

### Neutral
- Adds to existing test file rather than creating new
- Uses same mock patterns as other integration tests

## Implementation Notes

1. Use `vi.useFakeTimers()` for all timing-related tests
2. Mock `@/lib/utils.getElapsedTime` for controlled timing output
3. Test both the transformation utilities and component rendering together
4. Follow the test organization pattern from `SubtaskTree.integration.test.tsx`
5. All tests must pass with `npx vitest run` in packages/web-ui

## Test Count Estimation

Based on the acceptance criteria, approximately 15-20 new test cases will be added:
- Task Data Transformation: 6 tests
- Workflow Stage Rendering: 4 tests
- Running Task Animation: 3 tests
- Stage Interaction: 3 tests
- Timing Display: 4 tests

## Gap Analysis

### Current Test Coverage
- `ExecutionTimeline.test.tsx`: 31 unit tests (rendering, icons, timing, interactions)
- `ExecutionTimeline.integration.test.tsx`: 11 integration tests (workflow, performance, accessibility)
- `ExecutionTimeline.edge-cases.test.tsx`: 25 edge case tests (error handling, performance)
- `src/types/__tests__/execution-timeline.test.ts`: 117 type and utility tests

### Missing Test Coverage (to be addressed)
- `src/lib/__tests__/execution-timeline-utils.test.ts`: **Does not exist**
  - Unit tests for `transformTaskToExecutionStages()`
  - Unit tests for `getCurrentStageId()`
  - Unit tests for `shouldShowExecutionTimeline()`
  - These functions are critical for task detail page integration

### Recommendation
The implementation stage should either:
1. Add unit tests for `execution-timeline-utils.ts` in a new file, OR
2. Include these utility function tests within the enhanced integration test file

Option 2 is recommended as it aligns with the integration testing approach and validates the full data flow from Task → Stages → Rendered Timeline.

## Related Files

| File | Purpose |
|------|---------|
| `ExecutionTimeline.tsx` | Main component |
| `execution-timeline-utils.ts` | Task → Stage transformation |
| `execution-timeline.ts` (types) | Type definitions |
| `page.tsx` (task detail) | Consumer of component |
| `utils.ts` | Timing utilities (`getElapsedTime`)
