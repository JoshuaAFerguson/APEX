# Test Architecture for Budget and Agent Utilization Widgets

## Overview

This document describes the test architecture for `BudgetWidget` and `AgentUtilizationWidget` dashboard components, designed to ensure comprehensive coverage of widget rendering, data formatting, threshold color changes, real-time update handling, error states, and zero-data scenarios.

## Component Analysis

### BudgetWidget
- **Location**: `packages/web-ui/src/components/dashboard/BudgetWidget.tsx`
- **Dependencies**:
  - `useRealtimeUpdates` hook for WebSocket real-time data
  - `BudgetGauge` component for visualization
  - `Card`, `Button`, `Spinner` UI components
- **Key Features**:
  - Real-time cost tracking via WebSocket
  - Threshold-based warning/danger states (75%/90% default)
  - Connection status indicator
  - Manual refresh capability
  - Loading/error states

### AgentUtilizationWidget
- **Location**: `packages/web-ui/src/components/dashboard/AgentUtilizationWidget.tsx`
- **Dependencies**:
  - `useAgentMetrics` hook for WebSocket real-time agent data
  - `AgentUtilizationChart` component for visualization
  - `Card`, `Button`, `Spinner` UI components
- **Key Features**:
  - Real-time agent metrics via WebSocket
  - Per-agent token usage, cost, and performance display
  - Summary statistics (active agents, top agent)
  - Connection status indicator
  - Manual refresh capability
  - Loading/error states

## Test Architecture

### 1. Test File Structure

```
packages/web-ui/src/components/dashboard/__tests__/
├── BudgetWidget.test.tsx              # Unit tests
├── BudgetWidget.integration.test.tsx  # Integration tests
├── BudgetWidget.edge-cases.test.tsx   # Edge case tests
├── AgentUtilizationWidget.test.tsx              # Unit tests
├── AgentUtilizationWidget.integration.test.tsx  # Integration tests
├── AgentUtilizationWidget.edge-cases.test.tsx   # Edge case tests
└── __mocks__/
    ├── useRealtimeUpdates.ts          # Mock for BudgetWidget hook
    └── useAgentMetrics.ts             # Mock for AgentUtilizationWidget hook
```

### 2. Mock Strategy

#### 2.1 Hook Mocks
Both widgets depend on WebSocket hooks that need to be mocked for unit testing:

```typescript
// Mock for useRealtimeUpdates
export const createMockRealtimeUpdates = (overrides?: Partial<ReturnType<typeof useRealtimeUpdates>>) => ({
  state: {
    connectionState: 'connected' as const,
    isConnected: true,
    performance: {
      tokenUsage: { estimatedCost: 500 }
    },
    lastUpdate: new Date(),
    error: null,
    events: [],
    health: null,
  },
  connect: vi.fn(),
  disconnect: vi.fn(),
  checkHealth: vi.fn().mockResolvedValue(undefined),
  ...overrides,
})

// Mock for useAgentMetrics
export const createMockAgentMetrics = (overrides?: Partial<ReturnType<typeof useAgentMetrics>>) => ({
  metrics: {
    agents: [],
    totalTokens: 0,
    totalCost: 0,
    lastUpdated: new Date(),
  },
  connectionStatus: 'connected' as const,
  isLoading: false,
  error: null,
  refresh: vi.fn().mockResolvedValue(undefined),
  ...overrides,
})
```

#### 2.2 Factory Functions
Create test data factories for consistent mock data:

```typescript
// Budget widget factories
export const createBudgetWidgetProps = (overrides?: Partial<BudgetWidgetProps>) => ({
  budgetLimit: 1000,
  size: 'md' as const,
  ...overrides,
})

// Agent utilization factories
export const createAgentUtilizationData = (overrides?: Partial<AgentUtilizationData>) => ({
  agents: [createMockAgent('agent-1', 'Planner', 5000, 0.25)],
  totalInputTokens: 3000,
  totalOutputTokens: 2000,
  totalTokens: 5000,
  totalEstimatedCost: 0.25,
  totalDuration: 5000,
  avgTokensPerSecond: 15,
  lastUpdated: new Date(),
  ...overrides,
})
```

### 3. Test Categories

#### 3.1 Unit Tests (`.test.tsx`)
Focus on component isolation with mocked dependencies.

**BudgetWidget Unit Tests:**
- Widget rendering with different props
- Threshold color changes (safe/warning/danger)
- Status message display
- Connection status indicator variations
- Refresh button functionality
- Loading state display
- Error state display
- Custom threshold support

**AgentUtilizationWidget Unit Tests:**
- Widget rendering with agent data
- Summary statistics calculation
- Agent list display with token counts
- Cost display formatting
- Connection status indicator
- Refresh button functionality
- Loading state display
- Error state display
- Agent click handlers

#### 3.2 Integration Tests (`.integration.test.tsx`)
Test component behavior with simulated hook responses.

**BudgetWidget Integration Tests:**
- Real-time data update flow
- Connection state transitions
- Refresh action triggering data reload
- Error recovery patterns
- Auto-refresh interval behavior

**AgentUtilizationWidget Integration Tests:**
- Real-time agent metrics updates
- Agent data transformation
- Multiple agent aggregation
- Connection state handling
- Refresh with data reload

#### 3.3 Edge Case Tests (`.edge-cases.test.tsx`)
Test boundary conditions and unusual scenarios.

**Both Widgets:**
- Zero-data scenarios (no agents, $0 spend)
- Extreme values (MAX_SAFE_INTEGER, very small decimals)
- NaN/Infinity handling
- Negative value handling
- Null/undefined data fields
- Rapid state changes
- Concurrent refresh requests
- Component unmount during async operations
- Invalid date handling
- Large dataset performance

### 4. Test Patterns

#### 4.1 Rendering Test Pattern
```typescript
describe('BudgetWidget - Rendering', () => {
  it('renders with required props', () => {
    vi.mocked(useRealtimeUpdates).mockReturnValue(createMockRealtimeUpdates())

    render(<BudgetWidget budgetLimit={1000} />)

    expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
})
```

#### 4.2 Threshold Color Test Pattern
```typescript
describe('BudgetWidget - Threshold Colors', () => {
  it.each([
    { spend: 500, expected: 'Within budget', color: 'green' },
    { spend: 800, expected: 'Approaching limit', color: 'yellow' },
    { spend: 950, expected: 'Over budget', color: 'red' },
  ])('displays $expected status for $spend spend', ({ spend, expected }) => {
    vi.mocked(useRealtimeUpdates).mockReturnValue(
      createMockRealtimeUpdates({
        state: { performance: { tokenUsage: { estimatedCost: spend } } }
      })
    )

    render(<BudgetWidget budgetLimit={1000} />)

    expect(screen.getByText(expected)).toBeInTheDocument()
  })
})
```

#### 4.3 Real-time Update Test Pattern
```typescript
describe('BudgetWidget - Real-time Updates', () => {
  it('updates display when performance data changes', async () => {
    const { rerender } = render(<BudgetWidget budgetLimit={1000} />)

    // Simulate real-time update
    vi.mocked(useRealtimeUpdates).mockReturnValue(
      createMockRealtimeUpdates({
        state: { performance: { tokenUsage: { estimatedCost: 800 } } }
      })
    )

    rerender(<BudgetWidget budgetLimit={1000} />)

    expect(screen.getByText('Approaching limit')).toBeInTheDocument()
  })
})
```

#### 4.4 Error State Test Pattern
```typescript
describe('BudgetWidget - Error States', () => {
  it('displays error state with message', () => {
    vi.mocked(useRealtimeUpdates).mockReturnValue(
      createMockRealtimeUpdates({
        state: {
          connectionState: 'error',
          error: new Error('Connection failed')
        }
      })
    )

    render(<BudgetWidget budgetLimit={1000} />)

    expect(screen.getByText('Unable to load budget data')).toBeInTheDocument()
    expect(screen.getByText('Connection failed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
  })
})
```

### 5. Coverage Requirements

Per acceptance criteria, tests must cover:

| Category | Description | Test Files |
|----------|-------------|------------|
| Widget Rendering | Basic render, props, sizes | `.test.tsx` |
| Data Formatting | Currency, percentage, numbers | `.test.tsx` |
| Threshold Colors | Safe/warning/danger states | `.test.tsx` |
| Real-time Updates | WebSocket data handling | `.integration.test.tsx` |
| Error States | Connection errors, retry | `.test.tsx`, `.edge-cases.test.tsx` |
| Zero-data Scenarios | Empty/null data handling | `.edge-cases.test.tsx` |

### 6. Dependencies

**Required Test Dependencies:**
- `vitest` - Test runner
- `@testing-library/react` - Component testing
- `@testing-library/jest-dom` - DOM assertions
- `@testing-library/user-event` - User interaction simulation

### 7. Mock Dependencies

The following modules need mocking:

```typescript
// In test files
vi.mock('@/lib/useRealtimeUpdates')
vi.mock('@/hooks/useAgentMetrics')
```

### 8. Test Execution

```bash
# Run all widget tests
npm test -- BudgetWidget
npm test -- AgentUtilizationWidget

# Run specific test category
npm test -- BudgetWidget.test
npm test -- BudgetWidget.integration.test
npm test -- BudgetWidget.edge-cases.test

# Run with coverage
npm test -- --coverage BudgetWidget AgentUtilizationWidget
```

## Implementation Notes

1. **Follow existing patterns**: Mirror `ProjectHealthPanel` test structure
2. **Use factory functions**: Create reusable mock data generators
3. **Test isolation**: Each test should be independent
4. **Accessibility testing**: Include ARIA attribute verification
5. **Performance considerations**: Avoid excessive re-renders in tests
6. **Clear assertions**: Use descriptive expect statements

## ADR: Testing Real-time WebSocket Components

**Context**: Both widgets depend on WebSocket hooks for real-time updates.

**Decision**: Mock the hooks at the module level rather than simulating WebSocket connections.

**Rationale**:
- Unit tests should focus on component behavior, not WebSocket implementation
- Hook mocking provides deterministic test results
- Integration tests can simulate state transitions without actual WebSocket connections
- Reduces test flakiness and execution time

**Consequences**:
- Separate E2E tests needed for actual WebSocket behavior
- Mock factories must be kept in sync with hook interfaces
