# ADR-002: ApprovalGateItem Component Architecture

## Status
Accepted

## Context
The ApprovalGateItem component displays individual approval gates with status information, description, diff preview toggle, and action buttons (approve/reject). The component is part of the approval gate management system in the APEX web UI.

### Current State Analysis
After analyzing the codebase, the `ApprovalGateItem` component **already exists** with a comprehensive implementation that satisfies most acceptance criteria:

**Existing Implementation (`ApprovalGateItem.tsx`):**
- ✅ Gate info rendering (name, description, status, timestamp via `timeoutAt`/`timeoutInfo`)
- ✅ Collapsible diff preview section (uses `ApprovalDiffPreview` component)
- ✅ Approve/reject buttons with loading states
- ✅ Pending state support (primary use case)
- ✅ Compact mode support
- ✅ Comment input with character counter
- ✅ Error display
- ✅ Accessibility (ARIA labels, keyboard support)

**Issues Identified:**
1. **Type Mismatch**: Core `Gate` interface lacks `id` field, but components rely on it
2. **Test Failures**: 34 failing tests due to missing React import in test setup
3. **Confirmation Dialog Integration**: The confirmation dialog is triggered at the panel level, not component level

## Decision

### 1. Type System Fix
Add `id` field to `PendingApprovalGate` and `ResolvedApprovalGate` interfaces:

```typescript
// packages/web-ui/src/types/approval-gate-panel.ts
export interface PendingApprovalGate extends Gate {
  /** Unique identifier for the gate (required for UI operations) */
  id: string;
  // ... existing fields
}

export interface ResolvedApprovalGate extends Gate {
  /** Unique identifier for the gate (required for UI operations) */
  id: string;
  // ... existing fields
}
```

### 2. Component Architecture (Existing - Documented)

```
ApprovalGatePanel (Parent)
├── ApprovalGatePanelHeader (Filter/Search)
├── ApprovalGateItem[] (Pending Gates)
│   ├── Card (Container)
│   ├── Gate Info (Name, Task ID, Badges)
│   ├── Description
│   ├── Timeout Countdown
│   ├── Expandable Section
│   │   ├── Additional Details
│   │   ├── ApprovalDiffPreview (Collapsible)
│   │   ├── Error Display
│   │   └── Comment Input
│   └── Action Buttons (Approve/Reject)
├── ApprovalGateHistoryItem[] (Resolved Gates)
└── ApprovalConfirmationDialog (Modal)
```

### 3. Data Flow

```
User Action → ApprovalGateItem
    ↓
onApprove/onReject callbacks
    ↓
ApprovalGatePanel (handles confirmation if required)
    ↓
useApprovalGateWebSocket hook (API call)
    ↓
WebSocket event updates state
```

### 4. State Management

**Component-Level State (ApprovalGateItem):**
- `showComment`: boolean - Toggle comment input visibility
- `comment`: string - Comment text for actions
- `internalExpanded`: boolean - Controlled/uncontrolled expand state

**Parent-Level State (ApprovalGatePanel):**
- Pending/Resolved gates arrays
- Confirmation dialog state (via reducer)
- Filter/sort state
- Loading/error states

### 5. Props Interface

```typescript
interface ApprovalGateItemProps {
  gate: PendingApprovalGate;          // Gate data
  isExpanded?: boolean;               // Controlled expand state
  isLoading?: boolean;                // Loading state
  loadingAction?: 'approve' | 'reject' | null;  // Which action is loading
  error?: string | null;              // Error message
  onApprove?: (comment?: string) => void | Promise<void>;
  onReject?: (comment?: string) => void | Promise<void>;
  onToggleExpand?: () => void;
  onViewDiff?: () => void;
  readOnly?: boolean;                 // Disable actions
  showDiffPreview?: boolean;          // Show diff preview section
  diffViewMode?: DiffViewMode;        // Diff display mode
  compact?: boolean;                  // Compact layout
  className?: string;                 // Custom styling
}
```

### 6. Test Strategy

Tests should verify:
1. **Rendering**: Gate info, badges, description display
2. **Interactions**: Button clicks, expand/collapse, comment input
3. **States**: Loading, error, compact, readOnly
4. **Accessibility**: ARIA labels, keyboard navigation
5. **Edge Cases**: Missing data, long descriptions, timeouts

## Consequences

### Positive
- Comprehensive existing implementation minimizes new development
- Well-defined interfaces and constants
- Good separation of concerns between component and hook
- Consistent styling via constants

### Negative
- Type mismatch requires fix in type definitions
- Test failures need React import fix
- Some test expectations don't match current implementation

### Neutral
- Confirmation dialog handled at panel level (design choice)
- Real-time updates via WebSocket (existing pattern)

## Implementation Notes

### Files Requiring Changes

1. **Type Fix**: `packages/web-ui/src/types/approval-gate-panel.ts`
   - Add `id` field to gate interfaces

2. **Test Fix**: `packages/web-ui/src/components/approval/__tests__/ApprovalGateItem.test.tsx`
   - Fix React import issue
   - Update test expectations to match implementation

3. **Build Fix**: Ensure all TypeScript errors are resolved

### Test Coverage Requirements

- Unit tests for all component interactions
- Integration tests for approval flow
- Accessibility tests for keyboard navigation

## References

- Existing component: `packages/web-ui/src/components/approval/ApprovalGateItem.tsx`
- Types: `packages/web-ui/src/types/approval-gate-panel.ts`
- Constants: `packages/web-ui/src/types/approval-gate-panel-constants.ts`
- Parent component: `packages/web-ui/src/components/approval/ApprovalGatePanel.tsx`
