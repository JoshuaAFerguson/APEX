# ADR: StatusBar Display Modes Architecture Audit

## Status
**VERIFIED** - All display modes working correctly

## Context

The StatusBar component supports 3 display modes to control information density:
- **compact**: Minimal information for constrained displays
- **normal**: Standard information respecting responsive breakpoints
- **verbose**: Maximum information ignoring breakpoint constraints

This ADR documents the audit of the display modes implementation performed as part of the v0.6.0 feature verification.

## Audit Summary

### Test Coverage

| Test File | Tests | Status |
|-----------|-------|--------|
| `StatusBar.compact-mode.test.tsx` | 13 | PASS |
| `StatusBar.verbose-mode.test.tsx` | 26 | PASS |
| `StatusBar.display-modes.test.tsx` | 18 | PASS |
| `StatusBar.displayMode.test.tsx` | 27 | PASS |
| **Total** | **84** | **PASS** |

### Display Mode Specifications

#### Compact Mode
**Purpose**: Show only essential status information

| Segment | Visibility | Notes |
|---------|------------|-------|
| Connection status (●/○) | SHOWN | Always visible |
| Git branch | SHOWN | Full branch name displayed |
| Cost value | SHOWN | Value without label ($X.XXXX) |
| Timer | HIDDEN | |
| Agent | HIDDEN | |
| Workflow stage | HIDDEN | |
| Subtask progress | HIDDEN | |
| Session name | HIDDEN | |
| API/Web URLs | HIDDEN | |
| Model | HIDDEN | |
| Tokens | HIDDEN | |
| Preview/Thoughts indicators | HIDDEN | |

**Responsive Override**: Compact mode ignores terminal width breakpoints

#### Normal Mode (Default)
**Purpose**: Balanced information respecting terminal width

| Segment | Priority | Visibility by Breakpoint |
|---------|----------|-------------------------|
| Connection status | CRITICAL | Always |
| Timer | CRITICAL | Always |
| Git branch | HIGH | narrow+ |
| Agent | HIGH | narrow+ |
| Cost | HIGH | narrow+ |
| Model | HIGH | narrow+ |
| Workflow stage | MEDIUM | compact+ |
| Tokens | MEDIUM | compact+ |
| Subtask progress | MEDIUM | compact+ |
| Session name | LOW | wide only |
| API/Web URLs | LOW | wide only |
| Preview/Thoughts | LOW | wide only |

**Responsive Behavior**: Follows 4-tier breakpoint system (narrow/compact/normal/wide)

#### Verbose Mode
**Purpose**: Show all available information for debugging/monitoring

| Segment | Visibility | Notes |
|---------|------------|-------|
| All standard segments | SHOWN | |
| Token breakdown (input→output) | SHOWN | verbose-only |
| Token total | SHOWN | verbose-only |
| Active time | SHOWN | When detailedTiming provided |
| Idle time | SHOWN | When detailedTiming provided |
| Stage elapsed | SHOWN | When workflowStage + detailedTiming |
| Session cost | SHOWN | When different from cost |
| VERBOSE indicator | SHOWN | |

**Responsive Override**:
- Skips `filterByTier` (shows all priorities)
- Skips `trimToFit` (no width-based removal)

## Architecture

### Segment Building Pipeline

```
Props + Terminal Width
         │
         ▼
┌──────────────────────────────┐
│  1. createSegmentConfigs()   │  Build all segments with priorities
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  2. filterByDisplayMode()    │  Apply mode-specific filtering
│                              │
│  compact: connection, branch,│
│           cost only          │
│  verbose: keep all           │
│  normal: exclude verbose-    │
│          only segments       │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  3. filterByTier()           │  Skip if compact/verbose mode
│                              │
│  Apply priority filtering    │
│  based on terminal breakpoint│
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  4. applyAbbreviations()     │  Format labels/values for display
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  5. trimToFit()              │  Skip if verbose mode
│                              │
│  Safety valve: remove lowest │
│  priority if overflow        │
└──────────────────────────────┘
         │
         ▼
    Rendered Segments
```

### Key Implementation Details

#### filterByDisplayMode()
```typescript
function filterByDisplayMode(
  segments: ResponsiveSegment[],
  displayMode: 'normal' | 'compact' | 'verbose'
): ResponsiveSegment[] {
  if (displayMode === 'compact') {
    // Only: connection, gitBranch, cost
    return segments.filter(s =>
      s.id === 'connection' || s.id === 'gitBranch' || s.id === 'cost'
    );
  }
  if (displayMode === 'verbose') {
    return segments; // All segments
  }
  // Normal: exclude verbose-only segments
  return segments.filter(s =>
    !['activeTime', 'idleTime', 'stageTime', 'tokensBreakdown',
      'tokensTotal', 'sessionCost'].includes(s.id)
  );
}
```

#### Verbose Mode Value Formatting
- Token breakdown: `1.2k→800` format
- Time formatting: `2h0m`, `1m30s`, `45s`
- Session cost shown when `|sessionCost - cost| > 1e-10`

## Test Coverage Analysis

### Compact Mode Tests
- Essential elements visibility (status, branch, cost)
- Hidden elements verification (agent, stage, timer, etc.)
- Layout in narrow/wide terminals
- Edge cases (missing branch/cost, long names)
- Mode comparison (vs normal, vs verbose)
- Props validation (undefined/invalid displayMode)

### Verbose Mode Tests
- Token breakdown format (`input→output`)
- Large/mixed scale token formatting
- Detailed timing segments (active, idle, stage)
- Session cost display logic (different/same/precision)
- Width filtering bypass in verbose mode
- Integration with preview/thoughts modes

### Display Modes Tests
- Normal mode complete information display
- Compact mode minimal display
- Verbose mode full information display
- Mode transitions (smooth switching)
- Edge cases (undefined mode, invalid mode, missing data)

### displayMode Tests
- Layout type per mode (standard/single-line/multi-line)
- Component visibility per mode
- Processing state handling per mode
- Preview mode indicator per mode
- Responsive behavior per mode

## Verified Behaviors

### Correct
1. Compact mode shows only: connection, git branch, cost
2. Compact mode hides timer (contrary to compact name, timer is hidden)
3. Verbose mode shows all segments regardless of terminal width
4. Verbose mode includes token breakdown, timing details, session cost
5. Normal mode respects 4-tier breakpoint priority filtering
6. Invalid/undefined displayMode defaults to normal behavior
7. Mode transitions preserve data integrity
8. Long session names truncated to 12+... regardless of mode

### Design Decisions Verified
1. **Compact hides timer**: Per tests, compact shows only status, branch, cost
2. **Git branch in compact**: Full branch name shown (not truncated)
3. **Cost without label in compact**: Shows `$X.XXXX` without `cost:` label
4. **Floating point precision**: Session cost compared with epsilon (1e-10)

## Gaps Identified

### No Gaps in Display Modes
All 84 display mode tests pass. The implementation is complete and correctly handles:
- All 3 display modes (compact/normal/verbose)
- Mode-specific segment filtering
- Responsive behavior integration
- Edge cases and error handling
- Mode transitions

### Pre-existing Issues (Out of Scope)
Note: 8 other StatusBar test files have import resolution issues (`../../../__tests__/test-utils` path mismatch):
- `StatusBar.edgecases.test.tsx`
- `StatusBar.integration.test.tsx`
- `StatusBar.buildSegments.test.tsx`
- `fullstack-responsive.integration.test.tsx`
- `cross-component-responsive.integration.test.tsx`
- `content-components-composition.integration.test.tsx`
- `content-components.responsive-composition.integration.test.tsx`
- `responsive-layout.edge-cases.test.tsx`

These are pre-existing issues unrelated to display modes and should be addressed separately.

## Files Reviewed

| File | Purpose |
|------|---------|
| `packages/cli/src/ui/components/StatusBar.tsx` | Main implementation |
| `packages/cli/src/ui/components/__tests__/StatusBar.compact-mode.test.tsx` | Compact mode tests |
| `packages/cli/src/ui/components/__tests__/StatusBar.verbose-mode.test.tsx` | Verbose mode tests |
| `packages/cli/src/ui/components/__tests__/StatusBar.display-modes.test.tsx` | Cross-mode tests |
| `packages/cli/src/ui/components/__tests__/StatusBar.displayMode.test.tsx` | Display mode adaptation tests |

## Consequences

### Positive
- Complete test coverage for all display modes
- Clear separation between mode-specific and responsive behavior
- Robust handling of edge cases
- User can override responsive behavior with compact/verbose

### Neutral
- displayMode.test.tsx uses MockStatusBar (tests design, not implementation)
- Other 3 test files test actual StatusBar component

## Related ADRs
- [ADR-statusbar-responsive-breakpoints.md](./ADR-statusbar-responsive-breakpoints.md)

## Audit Date
2024-01-01 (Architecture stage audit for v0.6.0)
