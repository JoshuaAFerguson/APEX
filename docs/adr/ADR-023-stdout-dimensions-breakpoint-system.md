# ADR-023: useStdoutDimensions Hook Breakpoint System

## Status
Accepted

## Context

The APEX CLI provides a responsive terminal UI built with Ink (React for CLIs). To support responsive layouts, we need a hook that provides terminal dimensions with breakpoint helpers for different terminal widths.

### Current State
The `useStdoutDimensions` hook exists at `packages/cli/src/ui/hooks/useStdoutDimensions.ts` with:
- Terminal width/height detection via `ink-use-stdout-dimensions`
- A 3-tier breakpoint system: `narrow` (<60), `normal` (60-120), `wide` (≥120)
- Comprehensive test coverage

### Required State (Acceptance Criteria)
The hook needs a 4-tier breakpoint system with boolean helpers:
- `isNarrow`: <60 columns
- `isCompact`: 60-100 columns
- `isNormal`: 100-160 columns
- `isWide`: ≥160 columns

## Decision

We will **refactor** the existing `useStdoutDimensions` hook to implement a 4-tier breakpoint system with explicit boolean helpers, maintaining backward compatibility where possible.

### Technical Design

#### 1. Type Definitions

```typescript
// Updated breakpoint type
export type Breakpoint = 'narrow' | 'compact' | 'normal' | 'wide';

// New breakpoint helpers interface
export interface BreakpointHelpers {
  /** Terminal width < 60 columns */
  isNarrow: boolean;
  /** Terminal width >= 60 and < 100 columns */
  isCompact: boolean;
  /** Terminal width >= 100 and < 160 columns */
  isNormal: boolean;
  /** Terminal width >= 160 columns */
  isWide: boolean;
}

// Updated dimensions interface
export interface StdoutDimensions extends BreakpointHelpers {
  /** Terminal width in columns */
  width: number;
  /** Terminal height in rows */
  height: number;
  /** Responsive breakpoint classification */
  breakpoint: Breakpoint;
  /** Whether the terminal size is available (vs using fallbacks) */
  isAvailable: boolean;
}
```

#### 2. Breakpoint Thresholds

```typescript
// Default thresholds matching acceptance criteria
const DEFAULT_BREAKPOINTS = {
  narrow: 60,    // < 60 = narrow
  compact: 100,  // >= 60 and < 100 = compact
  normal: 160,   // >= 100 and < 160 = normal
  // >= 160 = wide
};

export interface UseStdoutDimensionsOptions {
  /** Custom fallback width (default: 80) */
  fallbackWidth?: number;
  /** Custom fallback height (default: 24) */
  fallbackHeight?: number;
  /** Custom breakpoint thresholds */
  breakpoints?: {
    /** Threshold for narrow/compact boundary (default: 60) */
    narrow?: number;
    /** Threshold for compact/normal boundary (default: 100) */
    compact?: number;
    /** Threshold for normal/wide boundary (default: 160) */
    normal?: number;
  };
}
```

#### 3. Implementation Strategy

```typescript
function getBreakpoint(
  width: number,
  breakpoints: { narrow: number; compact: number; normal: number }
): Breakpoint {
  if (width < breakpoints.narrow) return 'narrow';
  if (width < breakpoints.compact) return 'compact';
  if (width < breakpoints.normal) return 'normal';
  return 'wide';
}

function getBreakpointHelpers(
  width: number,
  breakpoints: { narrow: number; compact: number; normal: number }
): BreakpointHelpers {
  return {
    isNarrow: width < breakpoints.narrow,
    isCompact: width >= breakpoints.narrow && width < breakpoints.compact,
    isNormal: width >= breakpoints.compact && width < breakpoints.normal,
    isWide: width >= breakpoints.normal,
  };
}
```

#### 4. Hook Return Value

```typescript
export function useStdoutDimensions(
  options: UseStdoutDimensionsOptions = {}
): StdoutDimensions {
  // ... implementation

  return {
    width: finalWidth,
    height: finalHeight,
    breakpoint,
    isAvailable,
    // Spread breakpoint helpers
    ...breakpointHelpers,
  };
}
```

### Migration Considerations

1. **Breaking Change**: The `breakpoint` value will change from 3-tier to 4-tier system
   - Old: `'narrow' | 'normal' | 'wide'`
   - New: `'narrow' | 'compact' | 'normal' | 'wide'`

2. **Boundary Changes**:
   - Old `normal` (60-120) becomes split into `compact` (60-100) and `normal` (100-160)
   - Old `wide` (≥120) becomes `wide` (≥160)

3. **Deprecation Strategy**: Consider adding a `@deprecated` comment for any components using old breakpoints

### Backward Compatibility Options

**Option A (Recommended): Update options API**
```typescript
export interface UseStdoutDimensionsOptions {
  fallbackWidth?: number;
  fallbackHeight?: number;
  // New unified breakpoints configuration
  breakpoints?: {
    narrow?: number;   // default: 60
    compact?: number;  // default: 100
    normal?: number;   // default: 160
  };
  // DEPRECATED: Old-style thresholds (for backward compatibility)
  /** @deprecated Use breakpoints.narrow instead */
  narrowThreshold?: number;
  /** @deprecated Use breakpoints.normal instead */
  wideThreshold?: number;
}
```

**Option B: Breaking change with clear migration path**
- Document migration guide
- Update all components in same PR
- No backward compatibility layer

### Usage Examples

```tsx
// Basic usage with boolean helpers
function ResponsivePanel() {
  const { width, isNarrow, isCompact, isNormal, isWide } = useStdoutDimensions();

  if (isNarrow) {
    return <MinimalView />;
  }
  if (isCompact) {
    return <CompactView width={width} />;
  }
  if (isNormal) {
    return <StandardView width={width} />;
  }
  return <FullView width={width} showExtras />;
}

// Using breakpoint enum
function AdaptiveComponent() {
  const { breakpoint, width } = useStdoutDimensions();

  switch (breakpoint) {
    case 'narrow': return <Narrow />;
    case 'compact': return <Compact />;
    case 'normal': return <Normal />;
    case 'wide': return <Wide />;
  }
}

// Custom thresholds
function CustomComponent() {
  const dims = useStdoutDimensions({
    breakpoints: {
      narrow: 50,
      compact: 80,
      normal: 140,
    }
  });
}
```

## Consequences

### Positive
- Clear, intuitive boolean helpers (`isNarrow`, `isCompact`, etc.)
- More granular breakpoint system (4 tiers vs 3)
- Matches industry-standard responsive breakpoint patterns
- Maintains backward compatibility with `breakpoint` enum
- Self-documenting API through explicit boolean properties

### Negative
- Breaking change for existing consumers using old breakpoint values
- Slightly larger return object (4 additional boolean properties)
- Tests need to be updated to reflect new breakpoint boundaries

### Risks
- Existing components relying on `breakpoint === 'normal'` may behave differently
- Migration effort for any existing responsive components

## Implementation Plan

1. **Phase 1**: Update type definitions and interfaces
2. **Phase 2**: Implement new breakpoint logic with helpers
3. **Phase 3**: Update unit tests for new breakpoint boundaries
4. **Phase 4**: Update any existing components using the hook
5. **Phase 5**: Verify exports from hooks index

## Files to Modify

### Core Implementation

| File | Changes |
|------|---------|
| `packages/cli/src/ui/hooks/useStdoutDimensions.ts` | Update implementation with 4-tier breakpoints + boolean helpers |
| `packages/cli/src/ui/hooks/index.ts` | Add `BreakpointHelpers` type export |

### Test Files

| File | Changes |
|------|---------|
| `packages/cli/src/ui/hooks/__tests__/useStdoutDimensions.test.ts` | Update breakpoint tests for new boundaries |
| `packages/cli/src/ui/hooks/__tests__/useStdoutDimensions.coverage.test.ts` | Update coverage tests |
| `packages/cli/src/ui/hooks/__tests__/useStdoutDimensions.performance.test.ts` | Update performance tests |

### Components Using the Hook (Migration Review Needed)

| File | Current Usage | Migration Notes |
|------|---------------|-----------------|
| `StatusBar.tsx` | Uses `breakpoint` with custom thresholds (`narrowThreshold: 80, wideThreshold: 120`) | **Low impact** - custom thresholds override defaults |
| `ActivityLog.tsx` | Uses `breakpoint === 'narrow'` check | **Medium impact** - logic will continue to work (narrow threshold unchanged at 60) |
| `StreamingText.tsx` | Only uses `width`, no breakpoint logic | **No impact** |

### Migration Strategy

1. **StatusBar.tsx**: Uses custom thresholds, so default changes won't affect it. May want to migrate to new 4-tier system in future.
2. **ActivityLog.tsx**: Uses `breakpoint === 'narrow'` which maps directly to `isNarrow`. Migration path: replace with `isNarrow` boolean for cleaner code.
3. **StreamingText.tsx**: No changes needed - only uses `width` property.

## Related Decisions
- ADR-002: Ink-based CLI Architecture (if exists)
- ADR-003: Responsive Design System (if exists)

## References
- Ink useStdoutDimensions: https://github.com/vadimdemedes/ink/blob/master/readme.md
- ink-use-stdout-dimensions package
- React Hooks best practices
