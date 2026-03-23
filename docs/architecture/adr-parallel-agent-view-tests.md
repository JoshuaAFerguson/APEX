# ADR: ParallelAgentView Test Enhancement Architecture

## Status
**Proposed** - Architecture stage for implementing comprehensive tests for ParallelAgentView

## Context
The `ParallelAgentView.test.tsx` file requires additional tests for:
1. Real-time data display (summary statistics, lastUpdated, average progress)
2. Config options (showProgress, showElapsedTime, showTokenUsage, showCost, showStages)
3. Accessibility tests (testId propagation, semantic structure)

### Current State Analysis
The existing test file (`packages/web-ui/src/components/agents/__tests__/ParallelAgentView.test.tsx`) contains:
- **1437 lines** of existing tests covering:
  - Basic Rendering (4 tests)
  - Loading State (4 tests)
  - Error State (4 tests)
  - Empty State (5 tests)
  - Callback Handling (6 tests)
  - Layout and Sorting Controls (4 tests)
  - Footer and Last Updated (2 tests - partial coverage)
  - Configuration (2 tests - basic only)
  - Layout Mode: Lanes (6 tests)
  - Layout Mode: Grid (5 tests)
  - Layout Mode: Timeline (4 tests)
  - Layout Mode: Compact (5 tests)
  - Sorting and Filtering (14 tests)
  - Layout Switching Behavior (8 tests)

### Gaps Identified
From the acceptance criteria, we need to add:

1. **Summary Statistics Display Tests** (Partially exists, needs expansion)
   - Total badge (✅ exists: "2 total")
   - Active badge (✅ exists: "2 active")
   - Completed badge (✅ exists: "3 completed")
   - Failed badge (✅ exists: "1 failed")
   - Need: dedicated describe block consolidating statistics tests

2. **lastUpdated Display Tests** (Partially exists)
   - ✅ Basic test exists in "Footer and Last Updated"
   - Need: Format verification, timestamp updates, edge cases

3. **Average Progress Display Tests** (Partially exists)
   - ✅ Basic test exists in "Footer and Last Updated"
   - Need: Edge cases, zero agents, all completed

4. **Config Options Tests** (NEW - not covered)
   - `showProgress` - verify progress bars rendered/hidden
   - `showElapsedTime` - verify elapsed time rendered/hidden
   - `showTokenUsage` - verify token count rendered/hidden
   - `showCost` - verify cost display rendered/hidden
   - `showStages` - verify stage labels rendered/hidden

5. **Accessibility Tests** (NEW - not covered)
   - testId propagation to children
   - Semantic structure (roles, labels)
   - ARIA attributes
   - Keyboard navigation

## Decision

### Test Structure Architecture

We will add **two new describe blocks** to the existing test file:

```
describe('ParallelAgentView', () => {
  ... existing tests ...

  // NEW: Consolidate and expand real-time data display tests
  describe('Real-time Data Display', () => {
    describe('Summary Statistics', () => {
      // Total badge display
      // Active count badge
      // Completed count badge
      // Failed count badge
      // Zero count edge cases
      // Dynamic updates via rerender
    })

    describe('Last Updated Display', () => {
      // Timestamp formatting
      // Updates when data changes
      // Null/undefined handling
    })

    describe('Average Progress Display', () => {
      // Calculation accuracy
      // Edge cases (0%, 100%, no running agents)
      // Display formatting
    })
  })

  // NEW: Config options comprehensive tests
  describe('Config Options', () => {
    describe('showProgress', () => {
      // Enabled shows progress bars
      // Disabled hides progress bars
      // Only affects running executions
    })

    describe('showElapsedTime', () => {
      // Enabled shows clock icon + time
      // Disabled hides elapsed time
    })

    describe('showTokenUsage', () => {
      // Enabled shows token count with Zap icon
      // Disabled hides token usage
    })

    describe('showCost', () => {
      // Enabled shows cost with DollarSign icon
      // Disabled hides cost display
    })

    describe('showStages', () => {
      // Enabled shows stage labels
      // Disabled hides stage badges
    })
  })

  // NEW: Accessibility tests
  describe('Accessibility', () => {
    describe('testId Propagation', () => {
      // Main container receives testId
      // Lane components receive testId prefix
      // Nested elements accessible via testId queries
    })

    describe('Semantic Structure', () => {
      // Proper heading levels
      // Button roles for interactive elements
      // Region/status roles where applicable
    })

    describe('Keyboard Navigation', () => {
      // Tab order for buttons
      // Layout toggle keyboard accessibility
      // Sort buttons keyboard accessible
    })

    describe('Screen Reader Support', () => {
      // Status badges have accessible text
      // Loading state announcements
      // Error state announcements
    })
  })
})
```

### Implementation Details

#### 1. Test Data Factories (Existing - Extend)
The existing factories need minor extensions:
```typescript
// Already exists - use as-is
const createMockExecution = (overrides: Partial<AgentExecution> = {}): AgentExecution
const createMockLane = (overrides: Partial<AgentLaneType> = {}): AgentLaneType
const createMockParallelAgentData = (overrides: Partial<ParallelAgentViewData> = {}): ParallelAgentViewData
```

#### 2. Mock Strategy (Existing - Use)
The existing mocks are well-designed:
```typescript
// AgentLane mock - renders testable structure
vi.mock('../AgentLane', () => ({
  AgentLane: vi.fn(({ lane, testId, onAgentClick, onLaneClick }) => (
    <div data-testid={testId} data-lane-id={lane.id}>
      <span>{lane.label}</span>
      {lane.executions.map((exec: AgentExecution) => (
        <button key={exec.id} data-testid={`exec-${exec.id}`} onClick={() => onAgentClick?.(exec)}>
          {exec.agentName}
        </button>
      ))}
    </div>
  )),
}))
```

**IMPORTANT**: For config option tests, we need to **spy on AgentLane calls** to verify props are passed correctly:
```typescript
import { AgentLane } from '../AgentLane'

// In tests:
expect(vi.mocked(AgentLane)).toHaveBeenCalledWith(
  expect.objectContaining({
    showProgress: true,
    showElapsedTime: false,
    // ...
  }),
  expect.anything()
)
```

#### 3. Test Patterns to Use

**a) Summary Statistics Pattern:**
```typescript
it('displays total count badge with correct value', () => {
  const mockData = createMockParallelAgentData({
    totalExecutions: 5,
    lanes: [
      createMockLane({
        executions: Array.from({ length: 5 }, (_, i) =>
          createMockExecution({ id: `e${i}` })
        ),
      }),
    ],
  })
  render(<ParallelAgentView data={mockData} />)
  expect(screen.getByText('5 total')).toBeInTheDocument()
})
```

**b) Config Options Pattern:**
```typescript
it('passes showProgress config to AgentLane components', () => {
  const mockData = createMockParallelAgentData()
  render(
    <ParallelAgentView
      data={mockData}
      config={{ showProgress: true }}
    />
  )

  expect(vi.mocked(AgentLane)).toHaveBeenCalledWith(
    expect.objectContaining({
      showProgress: true,
    }),
    expect.anything()
  )
})
```

**c) Accessibility Pattern:**
```typescript
it('provides accessible button labels for layout controls', () => {
  const mockData = createMockParallelAgentData()
  render(<ParallelAgentView data={mockData} />)

  // Verify buttons have accessible names via title attributes
  expect(screen.getByTitle('lanes view')).toBeInTheDocument()
  expect(screen.getByTitle('grid view')).toBeInTheDocument()
})

it('propagates testId to child components', () => {
  const mockData = createMockParallelAgentData()
  render(<ParallelAgentView data={mockData} testId="pav" />)

  // Main container
  expect(screen.getByTestId('pav')).toBeInTheDocument()
  // Lane components (via mock)
  expect(screen.getByTestId('lane-development')).toBeInTheDocument()
})
```

### File Structure

Single file enhancement (no new files needed):
```
packages/web-ui/src/components/agents/__tests__/
└── ParallelAgentView.test.tsx  (existing - extend)
```

### Test Count Estimate

| Category | Subcategory | New Tests |
|----------|-------------|-----------|
| Real-time Data Display | Summary Statistics | 6 |
| Real-time Data Display | Last Updated | 4 |
| Real-time Data Display | Average Progress | 4 |
| Config Options | showProgress | 3 |
| Config Options | showElapsedTime | 2 |
| Config Options | showTokenUsage | 2 |
| Config Options | showCost | 2 |
| Config Options | showStages | 2 |
| Accessibility | testId Propagation | 3 |
| Accessibility | Semantic Structure | 4 |
| Accessibility | Keyboard Navigation | 3 |
| Accessibility | Screen Reader Support | 3 |
| **Total** | | **~38 new tests** |

## Technical Constraints

1. **Mock Boundary**: The `AgentLane` component is mocked, so we cannot directly test config options rendering in cards. Instead, we verify that:
   - Config props are passed correctly to `AgentLane`
   - The mock verifies props via `vi.mocked(AgentLane)`

2. **Grid Layout Testing**: In grid layout, config options affect inline card rendering (not mocked AgentLane). Tests can verify actual DOM for grid view.

3. **Accessibility Testing Scope**: Without axe-core, we focus on:
   - Semantic HTML structure
   - ARIA attributes presence
   - Keyboard accessibility via `fireEvent.keyDown`
   - Screen reader text via `.sr-only` or `aria-label`

## Consequences

### Positive
- Comprehensive coverage of acceptance criteria
- Tests follow existing patterns (maintainable)
- Clear test organization with describe blocks
- Uses existing test infrastructure (factories, mocks)

### Negative
- Mocking strategy limits deep integration testing
- Would benefit from additional integration tests for config options in future

### Mitigation
- For config options, add 1-2 tests using grid layout (no mock) to verify actual rendering
- Document the mock boundary clearly in test comments

## Implementation Order

1. **Real-time Data Display** (extend existing tests in Footer section)
2. **Config Options** (new describe block after Configuration)
3. **Accessibility** (new describe block at end)

## Dependencies

- Existing test file structure
- Existing mock implementations
- `@testing-library/react` for queries
- `vitest` for test framework

## References

- Existing test file: `packages/web-ui/src/components/agents/__tests__/ParallelAgentView.test.tsx`
- Component file: `packages/web-ui/src/components/agents/ParallelAgentView.tsx`
- Types file: `packages/web-ui/src/types/parallel-agent-view.ts`
- Accessibility test example: `packages/web-ui/src/components/dashboard/__tests__/ProjectHealthPanel.accessibility.test.tsx`
