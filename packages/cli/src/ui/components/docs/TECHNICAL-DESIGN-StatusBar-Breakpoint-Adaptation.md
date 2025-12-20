# Technical Design: StatusBar Breakpoint-Based Segment Adaptation

## Status
**Stage**: architecture
**Date**: 2025-01-XX
**Author**: Architect Agent

---

## Executive Summary

This document provides the technical design for completing the intelligent breakpoint-based segment adaptation logic in the StatusBar component. **The core architecture is already implemented** - this design focuses on refinements needed to fully meet the acceptance criteria.

---

## Acceptance Criteria Analysis

| Criteria | Current State | Required Changes |
|----------|--------------|------------------|
| Narrow (<80) shows minimal segments with abbreviated labels | ✅ Implemented | Minor refinement |
| Normal (80-120) shows most segments with full labels | ⚠️ Boundary issue | Fix upper bound (80-120 inclusive) |
| Wide (>120) shows all segments | ⚠️ Boundary issue | Fix threshold (>120, not >=120) |
| No overflow or truncation at any width | ⚠️ Partial | Enhance `trimToFit()` guarantees |
| Progressive segment hiding follows priority order | ✅ Implemented | Verify priority order in trimToFit |

---

## Current Architecture Review

### Existing Components (StatusBar.tsx)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        StatusBar Component                          │
├─────────────────────────────────────────────────────────────────────┤
│  useStdoutDimensions() → { width, breakpoint }                      │
│                ↓                                                    │
│  displayTier = computeDisplayTier(terminalWidth)                    │
│                ↓                                                    │
│  buildSegments(props, elapsed, terminalWidth, displayTier)          │
│       │                                                             │
│       ├── Pass 1: createSegmentConfigs() → ResponsiveSegment[]      │
│       ├── Pass 2: filterByDisplayMode() → filter by compact/verbose │
│       ├── Pass 3: filterByTier() → filter by priority threshold     │
│       ├── Pass 4: applyAbbreviations() → { left[], right[] }        │
│       └── Pass 5: trimToFit() → final width constraint              │
│                ↓                                                    │
│  Render: <Box justifyContent="space-between">                       │
│            <Box>{left.map(...)}</Box>                               │
│            <Box>{right.map(...)}</Box>                              │
│          </Box>                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Current Priority Assignments (Already Implemented)

| Segment | Priority | Side | Notes |
|---------|----------|------|-------|
| Connection status | `critical` | left | Always shown (●/○) |
| Session timer | `critical` | right | Always shown (MM:SS) |
| Git branch | `high` | left | Truncated in narrow |
| Agent | `high` | left | - |
| Cost | `high` | right | No label in narrow |
| Model | `high` | right | Abbreviated label in narrow |
| Workflow stage | `medium` | left | Hidden in narrow |
| Subtask progress | `medium` | left | Hidden in narrow |
| Tokens | `medium` | right | Hidden in narrow |
| Active/Idle/Stage time | `medium` | right | Verbose mode only |
| Session name | `low` | left | Hidden in narrow/normal |
| API URL | `low` | left | Hidden in narrow/normal |
| Web URL | `low` | left | Hidden in narrow/normal |
| Preview indicator | `low` | right | Hidden in narrow/normal |
| Thoughts indicator | `low` | right | Hidden in narrow/normal |
| Verbose indicator | `low` | right | Hidden in narrow/normal |

### Current Priority-to-Tier Mapping

```typescript
const PRIORITY_BY_TIER: Record<DisplayTier, SegmentPriority[]> = {
  narrow: ['critical', 'high'],           // < 80 cols
  normal: ['critical', 'high', 'medium'], // 80-119 cols
  wide: ['critical', 'high', 'medium', 'low'], // >= 120 cols
};
```

---

## Required Changes

### 1. Fix Display Tier Boundary Calculation

**Current (Lines 157-159)**:
```typescript
const displayTier: DisplayTier = terminalWidth < 80 ? 'narrow' :
                                terminalWidth < 120 ? 'normal' : 'wide';
```

**Issue**: The acceptance criteria specifies:
- Narrow: `< 80`
- Normal: `80-120` (inclusive of 120)
- Wide: `> 120`

**Required Change**:
```typescript
const displayTier: DisplayTier = terminalWidth < 80 ? 'narrow' :
                                terminalWidth <= 120 ? 'normal' : 'wide';
```

**Impact**: Width 120 changes from `wide` to `normal` tier.

### 2. Enhance Width Constraint Enforcement

The current `trimToFit()` function (Lines 751-793) has a potential gap:

**Current Issue**:
- Removes segments based on array position (end of each side)
- Does not strictly follow priority order during removal
- May not guarantee no visual overflow

**Required Enhancement**:

```typescript
function trimToFit(
  segments: { left: Segment[]; right: Segment[] },
  terminalWidth: number
): { left: Segment[]; right: Segment[] } {
  // Calculate actual content width (not minWidth)
  const calculateActualWidth = (segs: Segment[]) =>
    segs.reduce((sum, s) => {
      const iconWidth = s.icon ? 2 : 0;
      const labelWidth = s.label ? s.label.length : 0;
      const valueWidth = s.value.length;
      return sum + iconWidth + labelWidth + valueWidth + 1; // +1 for gap
    }, 0);

  const padding = 6; // Box border (2) + paddingX (2 each side)
  const centerGap = 2; // Gap between left and right sections

  let leftSegs = [...segments.left];
  let rightSegs = [...segments.right];

  // Sort remaining segments by priority (lowest first for removal)
  // Keep tracking which side each segment is on
  const getAllWithMeta = () => [
    ...leftSegs.map((s, i) => ({ seg: s, side: 'left' as const, index: i, priority: getPriority(s) })),
    ...rightSegs.map((s, i) => ({ seg: s, side: 'right' as const, index: i, priority: getPriority(s) })),
  ].sort((a, b) => b.priority - a.priority); // Lowest priority first (higher number = lower priority)

  // Iteratively remove lowest priority segment until fits
  while (true) {
    const leftWidth = calculateActualWidth(leftSegs);
    const rightWidth = calculateActualWidth(rightSegs);
    const totalWidth = leftWidth + rightWidth + padding + centerGap;

    if (totalWidth <= terminalWidth) break;
    if (leftSegs.length + rightSegs.length <= 2) break; // Keep at least connection + timer

    // Find and remove lowest priority segment
    const candidates = getAllWithMeta().filter(m =>
      // Don't remove critical segments
      m.priority !== 1 && // critical = 1 in numeric form
      (m.side === 'left' ? leftSegs.length > 1 : rightSegs.length > 1)
    );

    if (candidates.length === 0) break;

    const toRemove = candidates[0]; // Lowest priority
    if (toRemove.side === 'left') {
      leftSegs = leftSegs.filter((_, i) => i !== toRemove.index);
    } else {
      rightSegs = rightSegs.filter((_, i) => i !== toRemove.index);
    }
  }

  return { left: leftSegs, right: rightSegs };
}

// Helper to get numeric priority from segment
function getPriority(seg: Segment): number {
  // Map string priority to number (if available from ResponsiveSegment)
  // Or use position-based heuristic
  return (seg as any).priority ?? 3; // Default to medium
}
```

### 3. Preserve Priority in Final Segments

**Issue**: After `applyAbbreviations()`, the `Segment` interface loses the `priority` field from `ResponsiveSegment`.

**Solution**: Extend the base `Segment` interface or pass priority through to `trimToFit`:

```typescript
interface Segment {
  icon?: string;
  iconColor?: string;
  label?: string;
  abbreviatedLabel?: string;
  labelColor?: string;
  value: string;
  valueColor: string;
  minWidth: number;
  priority?: SegmentPriority; // Add optional priority for trimToFit
}
```

Update `applyAbbreviations()` to preserve priority:

```typescript
function applyAbbreviations(
  segments: ResponsiveSegment[],
  tier: DisplayTier
): { left: Segment[]; right: Segment[] } {
  // ... existing logic ...

  const segment: Segment = {
    // ... existing properties ...
    priority: config.priority, // Preserve priority for trimToFit
  };

  // ... rest of function ...
}
```

---

## Segment Display Matrix (Reference)

This table shows expected segment visibility at different widths:

| Width | Tier | Connection | Timer | Branch | Agent | Cost | Model | Stage | Progress | Tokens | URLs | Indicators |
|-------|------|------------|-------|--------|-------|------|-------|-------|----------|--------|------|------------|
| 40 | narrow | ✓ | ✓ | ✓* | ✓ | ✓* | ✓* | ✗ | ✗ | ✗ | ✗ | ✗ |
| 60 | narrow | ✓ | ✓ | ✓* | ✓ | ✓* | ✓* | ✗ | ✗ | ✗ | ✗ | ✗ |
| 79 | narrow | ✓ | ✓ | ✓* | ✓ | ✓* | ✓* | ✗ | ✗ | ✗ | ✗ | ✗ |
| 80 | normal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| 100 | normal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| 120 | normal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| 121 | wide | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 150 | wide | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

`*` = abbreviated label/value

---

## Implementation Plan

### Phase 1: Core Logic Fixes (Developer Stage)

1. **Update display tier calculation** (1 line change)
   - File: `StatusBar.tsx` line 158
   - Change `< 120` to `<= 120`

2. **Preserve priority through pipeline**
   - Add `priority?: SegmentPriority` to `Segment` interface
   - Update `applyAbbreviations()` to preserve priority

3. **Enhance `trimToFit()` with priority-aware removal**
   - Implement priority-based removal order
   - Add actual width calculation (vs minWidth)

### Phase 2: Test Updates (Tester Stage)

1. **Update boundary tests** in `StatusBar.responsive.test.tsx`
   - Test at width 120 (should be `normal`, not `wide`)
   - Test at width 121 (should be `wide`)

2. **Add overflow prevention tests**
   - Test with all segments at various widths
   - Verify no visual truncation occurs

3. **Add priority removal order tests**
   - Verify low priority removed before medium
   - Verify critical segments never removed

---

## Files to Modify

| File | Changes |
|------|---------|
| `packages/cli/src/ui/components/StatusBar.tsx` | Fix boundary, enhance trimToFit, preserve priority |
| `packages/cli/src/ui/components/__tests__/StatusBar.responsive.test.tsx` | Update boundary tests |

---

## Acceptance Criteria Verification

After implementation, verify:

- [ ] At width 79: Only critical + high priority segments visible, abbreviated labels
- [ ] At width 80: Medium priority segments appear, full labels
- [ ] At width 120: Still normal tier (medium priority max)
- [ ] At width 121: Wide tier, all segments including low priority
- [ ] At width 40: No overflow, critical segments preserved
- [ ] Verbose mode: Overrides responsive filtering (may overflow intentionally)
- [ ] Compact mode: Forces minimal segments regardless of width

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Boundary change breaks existing behavior at 120 cols | Low | Tests cover this transition |
| trimToFit performance with many segments | Very Low | Typical max is ~15 segments |
| Priority preservation adds complexity | Low | Optional field, backwards compatible |

---

## Appendix: Type Definitions

```typescript
// Existing types (already in StatusBar.tsx)
type SegmentPriority = 'critical' | 'high' | 'medium' | 'low';
type DisplayTier = 'narrow' | 'normal' | 'wide';

// Priority numeric mapping for sorting
const PRIORITY_ORDER: Record<SegmentPriority, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

// Updated Segment interface
interface Segment {
  icon?: string;
  iconColor?: string;
  label?: string;
  abbreviatedLabel?: string;
  labelColor?: string;
  value: string;
  valueColor: string;
  minWidth: number;
  priority?: SegmentPriority; // Added for trimToFit
}
```

---

## Conclusion

The StatusBar breakpoint-based segment adaptation is **~90% complete**. The remaining work involves:

1. A single-line boundary fix (`< 120` → `<= 120`)
2. Preserving priority through the segment pipeline
3. Enhancing `trimToFit()` for stricter overflow prevention
4. Updating tests to reflect corrected boundaries

The existing architecture is sound and well-tested. These refinements will bring the implementation into full compliance with the acceptance criteria.
