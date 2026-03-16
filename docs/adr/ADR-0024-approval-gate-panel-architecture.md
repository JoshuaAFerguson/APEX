# ADR-0024: ApprovalGatePanel Component Architecture

## Status
**Accepted**

## Context

The APEX system requires a comprehensive ApprovalGatePanel component to manage workflow approval gates. This component needs to:

1. Display pending approval gates prominently with approve/reject actions
2. Show resolved gates in a collapsible history section
3. Integrate with WebSocket for real-time updates
4. Handle loading, error, and empty states gracefully
5. Provide filter and sort options
6. Support responsive design with dark mode

Existing infrastructure includes:
- `GatePanel.tsx` - Basic gate approval component for single task
- `useWebSocketConnection.ts` - WebSocket health monitoring hook
- `ApexWebSocketClient` - Full WebSocket client with reconnection
- Core types: `Gate`, `GateStatus`, `ApprovalState`, `ApprovalRequiredEventData`
- Pre-defined types in `approval-gate-panel.ts` and `approval-gate-panel-constants.ts`

## Decision

### Component Architecture

```
ApprovalGatePanel (Main Container)
├── ApprovalGatePanelHeader
│   ├── Title with pending count badge
│   ├── Filter dropdown (status, priority, task)
│   ├── Sort dropdown (date, priority, task name)
│   └── WebSocket connection indicator
├── PendingGatesSection
│   ├── Empty state (when no pending gates)
│   └── ApprovalGateItem (for each pending gate)
│       ├── Gate header (name, type badge, priority indicator)
│       ├── Gate details (task info, description, timeout countdown)
│       ├── Resource impact indicator
│       ├── Diff preview (collapsible, when available)
│       └── Action buttons (Approve/Reject with optional comment)
├── HistorySection (Collapsible)
│   ├── Section header with expand/collapse toggle
│   └── ApprovalGateHistoryItem (for each resolved gate)
│       ├── Gate header with status badge
│       ├── Resolution details (approver, timestamp, comment)
│       └── Resolution time indicator
└── ConfirmationDialog (Modal)
    ├── Action confirmation message
    ├── Comment input field
    └── Confirm/Cancel buttons
```

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ApprovalGatePanel                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              useApprovalGateWebSocket Hook              │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │ wsClient    │  │ Event        │  │ State        │   │   │
│  │  │ connection  │──│ handlers     │──│ management   │   │   │
│  │  └─────────────┘  └──────────────┘  └──────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌───────────────────────────┼─────────────────────────────┐   │
│  │                           ▼                              │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │              Component State                     │    │   │
│  │  │  - pendingGates: PendingApprovalGate[]          │    │   │
│  │  │  - resolvedGates: ResolvedApprovalGate[]        │    │   │
│  │  │  - filterState: FilterState                      │    │   │
│  │  │  - sortState: SortState                          │    │   │
│  │  │  - confirmationState: ConfirmationState          │    │   │
│  │  │  - connectionStatus: ConnectionStatus            │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌───────────────────────────┼─────────────────────────────┐   │
│  │                           ▼                              │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐    │   │
│  │  │ Pending     │  │ History      │  │ Confirmation │    │   │
│  │  │ Section     │  │ Section      │  │ Dialog       │    │   │
│  │  └─────────────┘  └──────────────┘  └──────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Hook Design: useApprovalGateWebSocket

```typescript
interface UseApprovalGateWebSocketOptions {
  taskId?: string;                    // Filter by specific task
  autoConnect?: boolean;              // Auto-connect on mount (default: true)
  reconnectOnError?: boolean;         // Auto-reconnect on errors (default: true)
  initialPendingGates?: PendingApprovalGate[];
  initialResolvedGates?: ResolvedApprovalGate[];
}

interface UseApprovalGateWebSocketReturn {
  // State
  pendingGates: PendingApprovalGate[];
  resolvedGates: ResolvedApprovalGate[];
  isConnected: boolean;
  connectionStatus: WebSocketConnectionStatus;
  isLoading: boolean;
  error: Error | null;

  // Actions
  approveGate: (gateId: string, comment?: string) => Promise<void>;
  rejectGate: (gateId: string, comment: string) => Promise<void>;
  refresh: () => Promise<void>;
  connect: () => void;
  disconnect: () => void;

  // Event handlers
  onGateReceived: (handler: (gate: PendingApprovalGate) => void) => void;
  onGateResolved: (handler: (gate: ResolvedApprovalGate) => void) => void;
}
```

### WebSocket Event Handling

The hook subscribes to these WebSocket events:
- `gate:required` / `approval-required` - New pending gate
- `gate:approved` - Gate was approved
- `gate:rejected` - Gate was rejected
- `gate:timeout` - Gate timed out
- `gate:skipped` - Gate was skipped
- `approval-resolved` - Generic resolution event

### Filter & Sort Implementation

```typescript
interface FilterState {
  status: 'all' | 'pending' | 'approved' | 'rejected' | 'timeout' | 'skipped';
  taskId: string | null;
  gateType: PendingApprovalGate['gateType'] | null;
  resourceImpact: PendingApprovalGate['resourceImpact'] | null;
  searchQuery: string;
}

interface SortState {
  field: 'requiredAt' | 'priority' | 'taskId' | 'name';
  direction: 'asc' | 'desc';
}

// Pending gates are always sorted by priority (critical first), then by time
// History gates default to most recent first
```

### State Management Strategy

Using React hooks with reducers for complex state:

1. **Gate State**: `useReducer` with actions for add, update, remove gates
2. **Confirmation State**: Existing `confirmationReducer` from types
3. **Filter/Sort State**: `useState` with memoized filtered/sorted results
4. **Connection State**: Derived from `useWebSocketConnection` hook

### Component Composition

```typescript
// Main component file structure
packages/web-ui/src/components/approval/
├── ApprovalGatePanel.tsx              // Main container component
├── ApprovalGatePanelHeader.tsx        // Header with filters/sort
├── ApprovalGateItem.tsx               // Individual pending gate card
├── ApprovalGateHistoryItem.tsx        // Individual history item
├── ApprovalConfirmationDialog.tsx     // Confirmation modal
├── ApprovalDiffPreview.tsx            // Diff preview component
├── hooks/
│   ├── useApprovalGateWebSocket.ts    // WebSocket integration hook
│   ├── useApprovalGateFilter.ts       // Filter logic hook
│   └── useApprovalGateActions.ts      // Action handlers hook
├── __tests__/
│   ├── ApprovalGatePanel.test.tsx
│   ├── ApprovalGatePanel.integration.test.tsx
│   └── useApprovalGateWebSocket.test.tsx
└── index.ts                           // Public exports
```

### Styling Architecture

Following existing patterns:
- Tailwind CSS with dark mode support via `dark:` variants
- Consistent color scheme from `GATE_STATUS_STYLES` constants
- Responsive breakpoints: `sm:`, `md:`, `lg:`
- Animation classes from `ANIMATION_CLASSES` constants
- Size variants from `SIZE_VARIANTS` constants

### Loading/Error/Empty States

```typescript
// Loading state
{isLoading && <LoadingSkeleton />}

// Error state with retry
{error && (
  <ErrorBanner
    message={error.message}
    onRetry={refresh}
    onDismiss={dismissError}
  />
)}

// Empty state for pending
{pendingGates.length === 0 && !isLoading && (
  <EmptyState
    icon={<CheckCircle />}
    title="No Pending Approvals"
    description="All gates have been resolved. New gates will appear here."
  />
)}

// Empty state for history
{resolvedGates.length === 0 && (
  <EmptyState
    icon={<History />}
    title="No History"
    description="Resolved gates will appear here."
  />
)}
```

### Responsive Design Specifications

```
Mobile (< 640px):
- Single column layout
- Stacked action buttons
- Collapsed diff preview by default
- Compact gate items
- Simplified filters (dropdown menu)

Tablet (640px - 1024px):
- Two-column layout for gate items
- Inline action buttons
- Filter bar visible

Desktop (> 1024px):
- Full layout with sidebar potential
- Expanded diff preview
- Full filter/sort options
- History section expanded by default
```

### Accessibility Requirements

1. **Keyboard Navigation**
   - Tab through gates and actions
   - Enter/Space to activate buttons
   - Escape to close dialogs
   - Arrow keys for list navigation

2. **Screen Reader Support**
   - ARIA labels from `ARIA_LABELS` constants
   - Live regions for new gates
   - Status announcements on actions

3. **Focus Management**
   - Focus trap in confirmation dialog
   - Focus return after dialog close
   - Focus indicators visible

### Performance Optimizations

1. **Memoization**
   - `useMemo` for filtered/sorted lists
   - `useCallback` for event handlers
   - `React.memo` for list items

2. **Virtualization**
   - Consider `react-window` for large history lists
   - Initial render limited to `maxHistoryItems`

3. **Debouncing**
   - Search input debounced (300ms)
   - Comment input debounced (300ms)

### API Integration

Uses existing `apiClient` methods:
- `approveGate(taskId, gateName, request)`
- `rejectGate(taskId, gateName, request)`
- `listTasks({ status: 'awaiting-approval' })` for initial fetch

## Consequences

### Positive
- Reuses existing WebSocket infrastructure and types
- Consistent with existing component patterns
- Comprehensive real-time updates
- Full accessibility support
- Responsive and themeable

### Negative
- Adds complexity with WebSocket event handling
- Requires careful state synchronization
- Additional bundle size for new components

### Risks
- WebSocket reconnection during critical approvals
- Potential race conditions between API calls and WebSocket events
- State drift if server and client fall out of sync

### Mitigations
- Optimistic UI updates with rollback on failure
- Event deduplication by gate ID
- Periodic refresh as fallback
- Connection status clearly visible to users

## Implementation Plan

1. **Phase 1: Core Hook** - `useApprovalGateWebSocket`
2. **Phase 2: Basic Panel** - Main container with pending list
3. **Phase 3: History Section** - Collapsible resolved gates
4. **Phase 4: Filter/Sort** - Full filter and sort functionality
5. **Phase 5: Diff Preview** - Inline diff display
6. **Phase 6: Polish** - Animations, accessibility, performance

## Related Decisions

- ADR-0002: WebSocket Connection Indicator Architecture
- ADR-0003: Active Tasks Panel Realtime Updates
- Existing types: `approval-gate-panel.ts`, `approval-gate-panel-constants.ts`
