# ADR: StatusBar Display Mode Architecture Fix

## Status
Proposed

## Context
The StatusBar component has 18 failing tests across 7 test files due to inconsistencies between the component implementation and test expectations regarding display modes (compact, normal, verbose).

### Key Issues Identified:
1. **Compact mode includes session timer** - Tests expect compact mode to show ONLY: connection, gitBranch, cost
2. **Verbose mode still applies trimming** - Verbose mode should bypass ALL responsive filtering
3. **Session name truncation conflicts** - Tests expect full session names in verbose/wide modes
4. **Label abbreviation inconsistencies** - Some tests expect `active:` but see `act:`

## Decision

### 1. Compact Mode Filter (High Impact - 9 test fixes)

**Current behavior (incorrect):**
```typescript
function filterByDisplayMode(segments, displayMode) {
  if (displayMode === 'compact') {
    return segments.filter(s =>
      s.id === 'connection' ||
      s.id === 'gitBranch' ||
      s.id === 'cost' ||
      s.id === 'sessionTimer'  // BUG: Timer should NOT be in compact mode
    );
  }
}
```

**Fixed behavior:**
```typescript
function filterByDisplayMode(segments, displayMode) {
  if (displayMode === 'compact') {
    return segments.filter(s =>
      s.id === 'connection' ||
      s.id === 'gitBranch' ||
      s.id === 'cost'
      // sessionTimer REMOVED - compact mode excludes timer per tests
    );
  }
}
```

### 2. Verbose Mode Bypass (High Impact - 5 test fixes)

**Current behavior (incorrect):**
- Verbose mode skips tier filtering but still runs `trimToFit`
- Session names still get truncated even in verbose mode

**Fixed behavior:**
- Verbose mode should:
  1. Skip tier filtering (already done)
  2. Skip `trimToFit` entirely (already done but needs verification)
  3. Skip session name truncation

**Session name truncation fix:**
```typescript
// In createSegmentConfigs:
if (props.sessionName) {
  // Only truncate in non-verbose modes
  const truncatedSessionName = props.displayMode !== 'verbose' && props.sessionName.length > 15
    ? props.sessionName.slice(0, 12) + '...'
    : props.sessionName;
  // ...
}
```

### 3. Abbreviation Mode Fix (Medium Impact - 4 test fixes)

**Current behavior:**
- Verbose mode uses abbreviated labels in narrow terminals
- Tests expect full labels like `active:` not `act:`

**Fixed behavior:**
```typescript
function applyAbbreviations(segments, tier, displayMode) {
  const useAbbrev = tier === 'narrow' && displayMode !== 'verbose';
  // Verbose mode always uses full labels
  // ...
}
```

## Implementation Plan

### Files to Modify:
1. `packages/cli/src/ui/components/StatusBar.tsx`

### Changes:

#### Change 1: Remove sessionTimer from compact mode filter
Location: `filterByDisplayMode()` function, ~line 701-706
```typescript
// Remove s.id === 'sessionTimer' from the compact mode filter
```

#### Change 2: Preserve full session names in verbose mode
Location: `createSegmentConfigs()` function, ~line 400-401
```typescript
// Conditional truncation based on displayMode
const truncatedSessionName = props.displayMode !== 'verbose' && props.sessionName.length > 15
  ? props.sessionName.slice(0, 12) + '...'
  : props.sessionName;
```

#### Change 3: Skip abbreviation in verbose mode
Location: `applyAbbreviations()` function, ~line 744-757
```typescript
// Update useAbbrev logic to respect verbose mode
const useAbbrev = tier === 'narrow' && displayMode !== 'verbose';
```

## Test Impact Analysis

After fixes, expected test results:
- `StatusBar.compact-mode.test.tsx`: 4 failures → 0 failures
- `StatusBar.display-modes.test.tsx`: 2 failures → 0 failures
- `StatusBar.buildSegments.test.tsx`: 1 failure → 0 failures
- `StatusBar.useStdoutDimensions-integration.test.tsx`: 7 failures → 0 failures
- `StatusBar.hook-compatibility.test.tsx`: 2 failures → 0 failures
- `StatusBar.timer.test.tsx`: 1 failure → 0 failures
- `StatusBar.timer.edge-cases.test.tsx`: 1 failure → 0 failures

**Total: 18 failures → 0 failures**

## Consequences

### Positive:
- Clear separation between display modes
- Consistent behavior across all terminal widths
- Tests accurately reflect user expectations

### Negative:
- Compact mode loses timer visibility (intentional per requirements)
- Verbose mode may overflow in very narrow terminals (acceptable trade-off)

## Verification

Run tests after implementation:
```bash
npm test -- StatusBar
```

Expected result: All 18+ StatusBar test files pass with 0 failures.
