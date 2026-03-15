# ADR: Zero-Data State Handling for AgentUtilizationChart

## Status
Proposed

## Context
The `AgentUtilizationChart` component needs to gracefully handle edge cases where data is incomplete or empty. The acceptance criteria requires:
1. Empty agents array handling
2. Agents with zero tokens handling
3. Missing/undefined data fields handling
4. Consistent empty state messaging matching `TokenUsageChart` pattern

## Current Implementation Analysis

### AgentUtilizationChart
- **Empty agents**: Already shows `emptyMessage` when `processedAgents.length === 0`
- **Zero tokens**: Renders bars with 0 width but doesn't show empty state
- **Missing fields**: No explicit handling for undefined/null fields
- **Message style**: Uses "No agent utilization data available"

### TokenUsageChart (reference pattern)
- Shows "No usage data yet" when `!usage || totalTokens === 0`
- Centers the message with `text-center py-4 text-foreground-secondary`
- Uses `text-sm` for font sizing

### AgentUtilizationChartMini
- Shows "No data" when empty
- Uses same centering pattern as TokenUsageChart

## Decision

### 1. Enhanced Empty State Detection
Add a comprehensive check that considers:
- Empty agents array
- All agents having zero total tokens
- Undefined/null data object

```typescript
const hasNoData = useMemo(() => {
  if (!data) return true;
  if (!data.agents || data.agents.length === 0) return true;
  if (data.totalTokens === 0) return true;
  // All agents have zero tokens
  const hasAnyTokens = data.agents.some(agent =>
    (agent?.totalTokens ?? 0) > 0
  );
  return !hasAnyTokens;
}, [data]);
```

### 2. Defensive Data Processing
Add null/undefined guards in `useProcessedAgents`:
- Default to 0 for numeric fields
- Default to empty string for string fields
- Filter out malformed agent entries

### 3. Consistent Empty State Styling
Match `TokenUsageChart` pattern:
```typescript
if (hasNoData) {
  return (
    <div className={cn('text-center py-4 text-foreground-secondary', className)}>
      <p className="text-sm">{emptyMessage}</p>
    </div>
  );
}
```

### 4. Update Default Empty Message
For consistency with TokenUsageChart, update the default:
- Current: "No agent utilization data available"
- New: "No usage data yet"

However, since these are different components with different purposes, we may keep distinct messages. The architectural decision is to **keep the existing message** but ensure the **styling is consistent**.

### 5. Mini Component Updates
`AgentUtilizationChartMini` should apply the same comprehensive checks:
- Check for zero total tokens
- Guard against undefined fields

## Implementation Plan

### Phase 1: Type Safety (types file)
1. Create a helper type for safely accessing agent fields
2. Export validation utility functions

### Phase 2: Component Updates (AgentUtilizationChart.tsx)
1. Add `hasNoData` computed value with comprehensive checks
2. Update `useProcessedAgents` with defensive field access
3. Update empty state styling to match TokenUsageChart
4. Update Mini component with same pattern

### Phase 3: Test Coverage (test files)
1. Add tests for zero total tokens scenario
2. Add tests for missing/undefined fields
3. Add tests for mixed scenarios (some agents with data, some without)

## Files to Modify

1. `packages/web-ui/src/types/agent-utilization.ts`
   - Add `isValidAgentData()` utility function
   - Add `normalizeAgentData()` utility function

2. `packages/web-ui/src/components/charts/AgentUtilizationChart.tsx`
   - Update empty state detection logic
   - Add defensive data processing
   - Match TokenUsageChart empty state styling

3. `packages/web-ui/src/components/charts/__tests__/AgentUtilizationChart.edge-cases.test.tsx`
   - Add comprehensive zero-data state tests

## Consequences

### Positive
- Robust handling of all zero-data scenarios
- Consistent user experience across chart components
- Better error resilience
- Type-safe data access

### Negative
- Minor performance overhead from additional checks (negligible)
- Slightly more complex conditional rendering logic

## Technical Details

### Empty State Conditions (Priority Order)
1. `data` is undefined/null → Show empty state
2. `data.agents` is undefined/null/empty → Show empty state
3. `data.totalTokens === 0` → Show empty state
4. All agents have `totalTokens === 0` → Show empty state

### Defensive Field Access Pattern
```typescript
const safeAgent = {
  agentId: agent?.agentId ?? 'unknown',
  agentName: agent?.agentName ?? 'Unknown Agent',
  inputTokens: agent?.inputTokens ?? 0,
  outputTokens: agent?.outputTokens ?? 0,
  totalTokens: agent?.totalTokens ?? 0,
  estimatedCost: agent?.estimatedCost ?? 0,
  tokensPerSecond: agent?.tokensPerSecond ?? 0,
  duration: agent?.duration ?? 0,
  invocations: agent?.invocations ?? 0,
};
```

## References
- TokenUsageChart.tsx (lines 47-53) - Reference empty state pattern
- AgentUtilizationChart.tsx (lines 242-248) - Current implementation
- agent-utilization.ts - Type definitions
