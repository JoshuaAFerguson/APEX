# ADR-0012: useBudgetStatus Hook Design

## Status
Proposed

## Context

The APEX CLI needs a React hook to display real-time budget status information in the UI. This hook must:

1. Subscribe to `usage:updated` WebSocket events from the orchestrator
2. Return budget data, connection status, loading state, error state, and a refresh function
3. Follow established patterns from `useOrchestratorEvents` and `useToolEventLogger`

### Existing Patterns Analysis

The codebase uses two distinct patterns for real-time data hooks:

**Pattern A: Orchestrator-based (CLI hooks)**
- `useOrchestratorEvents` - subscribes to orchestrator events via `.on()/.off()` pattern
- `useToolEventLogger` - same pattern, focused on tool events
- Uses `ApexOrchestrator` instance passed as option
- Manages state with `useState` and cleanup with `useEffect` return

**Pattern B: WebSocket Client-based (Web UI hooks)**
- `useRealtimeUpdates` - uses `ApexWebSocketClient` for connection
- Manages connection state (`connecting`, `connected`, `disconnected`, etc.)
- Includes health check and reconnection logic
- More appropriate for standalone dashboard components

### Requirements from Acceptance Criteria

```typescript
interface UseBudgetStatusReturn {
  budgetStatus: BudgetStatus | null;  // Current budget data
  connectionStatus: ConnectionStatus; // WebSocket connection state
  isLoading: boolean;                 // Loading indicator
  error: string | null;               // Error message
  refresh: () => Promise<void>;       // Manual refresh function
}
```

## Decision

Implement `useBudgetStatus` following **Pattern A** (orchestrator-based) since:

1. It will be used in the CLI context alongside other orchestrator hooks
2. The `usage:updated` event is already emitted by the orchestrator (as seen in `useOrchestratorEvents`)
3. Consistency with existing CLI hooks (`useOrchestratorEvents`, `useToolEventLogger`)
4. The types already exist in `packages/cli/src/types/budget-status.ts`

### Architecture Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                         useBudgetStatus Hook                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │ UseBudgetStatus │    │  BudgetStatus    │    │ Connection    │  │
│  │   Options       │───▶│    State         │───▶│   Status      │  │
│  │                 │    │                  │    │               │  │
│  │ - orchestrator  │    │ - budgetStatus   │    │ - connected   │  │
│  │ - initialLimit  │    │ - isLoading      │    │ - connecting  │  │
│  │ - warning/crit  │    │ - error          │    │ - disconnected│  │
│  │ - refreshInt.   │    │ - isEnabled      │    │ - error       │  │
│  └─────────────────┘    └──────────────────┘    └───────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     Event Handlers                           │   │
│  │                                                              │   │
│  │  ┌──────────────────┐                                       │   │
│  │  │ usage:updated    │──▶ Calculate budget status            │   │
│  │  │ handler          │    Update percentUsed                 │   │
│  │  │                  │    Determine status level             │   │
│  │  └──────────────────┘    (ok/warning/critical/exceeded)     │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     Return Value                             │   │
│  │                                                              │   │
│  │  - budgetStatus: BudgetStatus | null                        │   │
│  │  - connectionStatus: ConnectionStatus                        │   │
│  │  - isLoading: boolean                                       │   │
│  │  - error: string | null                                     │   │
│  │  - refresh: () => Promise<void>                             │   │
│  │  - resetSpend: () => Promise<void>                          │   │
│  │  - setBudgetLimit: (limit: number) => Promise<void>         │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Type Definitions (already exist in budget-status.ts)

The existing types in `packages/cli/src/types/budget-status.ts` are well-designed:

```typescript
// BudgetStatusLevel: 'ok' | 'warning' | 'critical' | 'exceeded'
// BudgetStatus: currentSpend, budgetLimit, percentUsed, status, lastUpdated
// BudgetStatusState: budgetStatus, isLoading, error, isEnabled
// UseBudgetStatusReturn: extends BudgetStatusState + refresh, resetSpend, setBudgetLimit
// UseBudgetStatusOptions: initialLimit, warningThreshold, criticalThreshold, refreshInterval, enabled
```

### New Type Addition

Add `ConnectionStatus` type to budget-status.ts:

```typescript
/**
 * Connection status for WebSocket/orchestrator connection
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting' | 'error';
```

### Implementation Strategy

```typescript
// packages/cli/src/ui/hooks/useBudgetStatus.ts

export function useBudgetStatus(options: UseBudgetStatusOptions = {}): UseBudgetStatusReturn {
  const {
    orchestrator,
    initialLimit = 100,
    warningThreshold = 80,
    criticalThreshold = 95,
    refreshInterval = 0,
    enabled = true,
  } = options;

  // State management
  const [state, setState] = useState<BudgetStatusState>({...});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  // Accumulated cost tracking ref (to avoid re-renders)
  const accumulatedCostRef = useRef<number>(0);
  const budgetLimitRef = useRef<number>(initialLimit);

  // Calculate status level based on thresholds
  const calculateStatusLevel = useCallback((percentUsed: number): BudgetStatusLevel => {
    if (percentUsed >= 100) return 'exceeded';
    if (percentUsed >= criticalThreshold) return 'critical';
    if (percentUsed >= warningThreshold) return 'warning';
    return 'ok';
  }, [warningThreshold, criticalThreshold]);

  // Handle usage:updated events
  const handleUsageUpdated = useCallback((
    taskId: string,
    usage: { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCost: number }
  ) => {
    // Accumulate cost
    accumulatedCostRef.current += usage.estimatedCost;

    // Calculate new budget status
    const percentUsed = (accumulatedCostRef.current / budgetLimitRef.current) * 100;
    const status = calculateStatusLevel(percentUsed);

    setState(prev => ({
      ...prev,
      budgetStatus: {
        currentSpend: accumulatedCostRef.current,
        budgetLimit: budgetLimitRef.current,
        percentUsed,
        status,
        lastUpdated: new Date(),
      },
      isLoading: false,
    }));
  }, [calculateStatusLevel]);

  // Subscribe to orchestrator events
  useEffect(() => {
    if (!orchestrator || !enabled) {
      setConnectionStatus('disconnected');
      return;
    }

    setConnectionStatus('connecting');

    // Register event handler
    orchestrator.on('usage:updated', handleUsageUpdated);
    setConnectionStatus('connected');

    return () => {
      orchestrator.off('usage:updated', handleUsageUpdated);
      setConnectionStatus('disconnected');
    };
  }, [orchestrator, enabled, handleUsageUpdated]);

  // Refresh function
  const refresh = useCallback(async () => {
    // Trigger a state update with current values
    setState(prev => ({
      ...prev,
      budgetStatus: prev.budgetStatus ? {
        ...prev.budgetStatus,
        lastUpdated: new Date(),
      } : null,
    }));
  }, []);

  // Reset spend function
  const resetSpend = useCallback(async () => {
    accumulatedCostRef.current = 0;
    setState(prev => ({
      ...prev,
      budgetStatus: prev.budgetStatus ? {
        ...prev.budgetStatus,
        currentSpend: 0,
        percentUsed: 0,
        status: 'ok',
        lastUpdated: new Date(),
      } : {
        currentSpend: 0,
        budgetLimit: budgetLimitRef.current,
        percentUsed: 0,
        status: 'ok',
        lastUpdated: new Date(),
      },
    }));
  }, []);

  // Set budget limit function
  const setBudgetLimit = useCallback(async (limit: number) => {
    budgetLimitRef.current = limit;
    const percentUsed = (accumulatedCostRef.current / limit) * 100;
    const status = calculateStatusLevel(percentUsed);

    setState(prev => ({
      ...prev,
      budgetStatus: prev.budgetStatus ? {
        ...prev.budgetStatus,
        budgetLimit: limit,
        percentUsed,
        status,
        lastUpdated: new Date(),
      } : null,
    }));
  }, [calculateStatusLevel]);

  return {
    ...state,
    connectionStatus,
    refresh,
    resetSpend,
    setBudgetLimit,
  };
}
```

## Key Design Decisions

### 1. Orchestrator Event Subscription Pattern
Following `useOrchestratorEvents` for consistency. The hook subscribes to the `usage:updated` event which already includes `estimatedCost` data.

### 2. Cost Accumulation Strategy
Using a ref (`accumulatedCostRef`) to track total cost across multiple events, avoiding unnecessary re-renders while accumulating costs.

### 3. Threshold-based Status Levels
The status level is calculated dynamically based on configurable thresholds:
- `ok`: < warningThreshold (default 80%)
- `warning`: >= warningThreshold && < criticalThreshold
- `critical`: >= criticalThreshold && < 100%
- `exceeded`: >= 100%

### 4. Connection Status Tracking
Simple connection status derived from orchestrator presence and event handler registration.

### 5. Separation of Concerns
- State management isolated in hook
- Types in separate file (already exists)
- Export via index.ts

## File Structure

```
packages/cli/src/
├── types/
│   └── budget-status.ts          # (existing) Add ConnectionStatus
├── ui/
│   └── hooks/
│       ├── useBudgetStatus.ts    # NEW: Hook implementation
│       ├── index.ts              # UPDATE: Add export
│       └── __tests__/
│           └── useBudgetStatus.test.ts  # NEW: Unit tests
```

## Consequences

### Positive
- Consistent with existing CLI hook patterns
- Leverages existing type definitions
- Simple, focused implementation
- Real-time updates via existing `usage:updated` events
- Configurable thresholds for flexibility

### Negative
- Requires orchestrator instance to be passed in
- No persistent storage of budget data (session-only)
- Cost accumulation resets on unmount

### Risks
- Event listener cleanup must be thorough to prevent memory leaks
- Connection status may not reflect actual WebSocket state (it's orchestrator-level)

## Testing Strategy

1. **Unit Tests**
   - Hook initialization with default options
   - Usage event handling and cost accumulation
   - Status level calculations at threshold boundaries
   - Cleanup on unmount

2. **Integration Tests**
   - Hook behavior with mock orchestrator
   - Multiple usage events accumulation
   - Threshold transitions (ok -> warning -> critical -> exceeded)

## Implementation Notes

1. Update `budget-status.ts` to add `ConnectionStatus` type
2. Create `useBudgetStatus.ts` following the pattern above
3. Update `hooks/index.ts` to export the new hook
4. Create comprehensive tests following `useToolEventLogger.test.ts` patterns

## References

- `packages/cli/src/ui/hooks/useOrchestratorEvents.ts` - Main pattern reference
- `packages/cli/src/ui/hooks/useToolEventLogger.ts` - Simpler pattern example
- `packages/cli/src/types/budget-status.ts` - Existing type definitions
- `packages/web-ui/src/lib/useRealtimeUpdates.ts` - Alternative pattern (web-ui)
