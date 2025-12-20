# ADR-035: DiffViewer Responsive Terminal Width Enhancement

## Status
Proposed

## Context

The DiffViewer component needs enhancement to fully meet the v0.3.0 responsive width acceptance criteria. Based on the planning stage analysis, the component **already has most responsive functionality implemented**, but requires refinements to align with specific thresholds and test coverage.

### Current Implementation State

**Already Implemented (verified from `DiffViewer.tsx`):**
- Uses `useStdoutDimensions` hook (line 5, line 63)
- Supports `'auto'` mode in addition to `'unified' | 'split' | 'inline'`
- Has `getEffectiveMode()` function for mode switching (lines 22-38)
- Has `responsive` prop defaulting to `true`
- Has `truncateDiffLine()` for content truncation (lines 43-46)
- Has fallback notification for forced unified mode (lines 145-149)

**Current Threshold:** 100 columns for split view (line 29, line 33)

### Acceptance Criteria Review

| Criterion | Current State | Gap |
|-----------|--------------|-----|
| Uses `useStdoutDimensions` hook | ✅ Implemented | None |
| Auto switches to unified in narrow terminals | ✅ Implemented at < 100 cols | **Needs change to < 120 cols** |
| Split view needs >120 cols | ❌ Currently uses 100 cols | **Threshold update required** |
| Adjusts line number column width based on terminal size | ❌ Fixed at 8 chars (unified) / 5 chars (split) | **Dynamic sizing needed** |
| Tests cover all breakpoints | ⚠️ Partial coverage | **Additional tests needed** |

## Decision

### 1. Update Split Mode Threshold from 100 to 120 Columns

**Rationale:**
- Acceptance criteria explicitly states "split view needs >120 cols"
- At 120 cols, each side gets `(120 - 4) / 2 = 58` columns
- This provides comfortable code viewing with ~55 chars for content after line numbers

**Implementation:**

```typescript
// packages/cli/src/ui/components/DiffViewer.tsx

function getEffectiveMode(
  requestedMode: 'unified' | 'split' | 'inline' | 'auto',
  width: number,
  breakpoint: Breakpoint
): 'unified' | 'split' | 'inline' {
  // UPDATED: Change threshold from 100 to 120
  const SPLIT_MODE_MIN_WIDTH = 120;

  if (requestedMode === 'auto') {
    return width < SPLIT_MODE_MIN_WIDTH ? 'unified' : 'split';
  }

  if (requestedMode === 'split' && width < SPLIT_MODE_MIN_WIDTH) {
    return 'unified';
  }

  return requestedMode;
}
```

### 2. Dynamic Line Number Column Width

**Current State:**
- Unified mode: Fixed 8 characters (line 172)
- Split mode: Fixed 5 characters (line 241)

**Problem:**
- Small files (< 100 lines) waste space with 3-digit padding
- Large files (> 999 lines) can overflow fixed width

**Solution: Calculate based on max line number**

```typescript
// Helper function to calculate line number width
function calculateLineNumberWidth(maxLineNumber: number): number {
  // Minimum 2 digits, accommodate the number + separator
  const digits = Math.max(2, maxLineNumber.toString().length);
  return digits + 1; // +1 for padding/separator
}

// In UnifiedDiffViewer
const maxLineNum = Math.max(
  ...hunks.flatMap(h => h.lines.map(l =>
    Math.max(l.oldLineNumber ?? 0, l.newLineNumber ?? 0)
  ))
);
const singleLineNumWidth = calculateLineNumberWidth(maxLineNum);
const lineNumberWidth = showLineNumbers ? singleLineNumWidth * 2 + 1 : 0; // Two columns + space

// In SplitDiffViewer
const lineNumberWidth = showLineNumbers ? singleLineNumWidth + 2 : 0; // " 123 |"
```

**Width Scaling by Terminal Size:**

| Terminal Width | Line Number Display | Rationale |
|----------------|---------------------|-----------|
| < 80 cols (narrow) | Compact (2-digit min) | Maximize content space |
| 80-120 cols (compact) | Standard (3-digit min) | Balanced |
| > 120 cols (normal/wide) | Full (dynamic based on line count) | Plenty of space |

### 3. Content Width Calculation Update

**Current Calculation (Unified):**
```typescript
const lineNumberWidth = showLineNumbers ? 8 : 0;
const borderPadding = 2;
const contentWidth = width! - lineNumberWidth - borderPadding - 1;
```

**Updated Calculation:**
```typescript
function calculateContentWidth(
  totalWidth: number,
  lineNumberWidth: number,
  borderPadding: number,
  diffMarkerWidth: number,
  breakpoint: Breakpoint
): number {
  const overhead = lineNumberWidth + borderPadding + diffMarkerWidth;
  const contentWidth = totalWidth - overhead;

  // Ensure minimum content width based on breakpoint
  const minContent = breakpoint === 'narrow' ? 20 : breakpoint === 'compact' ? 30 : 40;
  return Math.max(minContent, contentWidth);
}
```

### 4. Enhanced Visual Feedback

**Update fallback message to reflect new threshold:**

```typescript
{forcedUnified && (
  <Text color="yellow" dimColor>
    {' '}(split view requires 120+ columns)
  </Text>
)}
```

### 5. Test Coverage Requirements

**Breakpoint-specific tests to add/update:**

```typescript
// packages/cli/src/ui/components/__tests__/DiffViewer.test.tsx

describe('Responsive Width Functionality', () => {
  describe('Threshold Boundary Tests', () => {
    it('uses unified mode at exactly 119 columns', () => {
      mockUseStdoutDimensions.mockReturnValue({ width: 119, ... });
      // Assert unified mode
    });

    it('uses split mode at exactly 120 columns', () => {
      mockUseStdoutDimensions.mockReturnValue({ width: 120, ... });
      // Assert split mode
    });

    it('uses split mode at 121 columns', () => {
      mockUseStdoutDimensions.mockReturnValue({ width: 121, ... });
      // Assert split mode
    });
  });

  describe('Line Number Width Adaptation', () => {
    it('uses compact line numbers in narrow terminals (<80 cols)', () => {
      // Test with 60 cols - expect 2-digit format
    });

    it('uses standard line numbers in compact terminals (80-119 cols)', () => {
      // Test with 100 cols - expect 3-digit format
    });

    it('uses dynamic line numbers in wide terminals (>=120 cols)', () => {
      // Test with 150 cols and 1000-line file - expect 4-digit format
    });
  });

  describe('All Breakpoint Coverage', () => {
    const breakpoints = [
      { width: 40, breakpoint: 'narrow', expectedMode: 'unified' },
      { width: 60, breakpoint: 'compact', expectedMode: 'unified' },
      { width: 100, breakpoint: 'normal', expectedMode: 'unified' },
      { width: 120, breakpoint: 'normal', expectedMode: 'split' },
      { width: 160, breakpoint: 'wide', expectedMode: 'split' },
      { width: 200, breakpoint: 'wide', expectedMode: 'split' },
    ];

    breakpoints.forEach(({ width, breakpoint, expectedMode }) => {
      it(`uses ${expectedMode} mode at ${width} columns (${breakpoint})`, () => {
        // Test implementation
      });
    });
  });
});
```

## Architecture Diagram

```
Terminal Width Detection Flow
=============================

useStdoutDimensions()
        │
        ▼
┌───────────────────────────────────────────────────────┐
│                    DiffViewer                          │
│                                                        │
│  Props: { mode, responsive, width, showLineNumbers }   │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │           Width Calculation                       │ │
│  │  effectiveWidth = explicitWidth ??               │ │
│  │    (responsive ? max(60, terminalWidth-2) : 120) │ │
│  └──────────────────────────────────────────────────┘ │
│                       │                                │
│                       ▼                                │
│  ┌──────────────────────────────────────────────────┐ │
│  │           Mode Selection                          │ │
│  │  getEffectiveMode(mode, width, breakpoint)       │ │
│  │                                                   │ │
│  │  if mode == 'auto':                              │ │
│  │    return width < 120 ? 'unified' : 'split'      │ │
│  │  if mode == 'split' && width < 120:              │ │
│  │    return 'unified' (with warning)               │ │
│  └──────────────────────────────────────────────────┘ │
│                       │                                │
│        ┌──────────────┼──────────────┐                │
│        ▼              ▼              ▼                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ Unified  │  │  Split   │  │  Inline  │            │
│  │ Viewer   │  │  Viewer  │  │  Viewer  │            │
│  └──────────┘  └──────────┘  └──────────┘            │
│        │              │              │                │
│        ▼              ▼              ▼                │
│  ┌──────────────────────────────────────────────────┐ │
│  │         Dynamic Line Number Width                 │ │
│  │  calculateLineNumberWidth(maxLineNum, breakpoint)│ │
│  │                                                   │ │
│  │  narrow:  2-3 digits (compact display)           │ │
│  │  compact: 3 digits (standard)                    │ │
│  │  normal+: Dynamic based on file size             │ │
│  └──────────────────────────────────────────────────┘ │
│                       │                                │
│                       ▼                                │
│  ┌──────────────────────────────────────────────────┐ │
│  │         Content Width Calculation                 │ │
│  │  contentWidth = effectiveWidth                   │ │
│  │                 - lineNumberWidth                │ │
│  │                 - borderPadding                  │ │
│  │                 - diffMarker                     │ │
│  │                                                   │ │
│  │  Enforces minimum content width per breakpoint   │ │
│  └──────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

## File Changes Summary

### Primary Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/cli/src/ui/components/DiffViewer.tsx` | Modify | Update threshold 100→120, add dynamic line number sizing |
| `packages/cli/src/ui/components/__tests__/DiffViewer.test.tsx` | Modify | Update tests for new threshold, add breakpoint coverage |

### Detailed Changes

**DiffViewer.tsx:**
1. Line 29: Change `width < 100` to `width < 120`
2. Line 33: Change `width < 100` to `width < 120`
3. Line 147: Change message from "100+" to "120+"
4. Lines 134, 172, 241: Replace fixed line number widths with dynamic calculation
5. Add `calculateLineNumberWidth()` helper function
6. Add `calculateContentWidth()` helper function

**DiffViewer.test.tsx:**
1. Update "Mode Fallback Behavior" tests for 120 threshold
2. Add boundary tests at 119/120/121 columns
3. Add line number width adaptation tests
4. Ensure all four breakpoints (narrow/compact/normal/wide) are covered

## Consequences

### Positive
- More readable split view (58 chars per side at 120 cols vs 48 at 100 cols)
- Dynamic line numbers optimize space usage
- Comprehensive test coverage ensures reliability
- Aligns with acceptance criteria

### Negative
- Split view available in fewer terminal configurations (120+ vs 100+)
- Slightly increased complexity in width calculations

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing tests | Update test expectations before implementation |
| User complaints about split threshold | Document the rationale; users can use explicit `mode="split"` |
| Line number width edge cases | Ensure minimum/maximum bounds are enforced |

## Implementation Order

1. **Update threshold constant** (5 min)
   - Change 100 to 120 in `getEffectiveMode()`
   - Update fallback message

2. **Add helper functions** (15 min)
   - `calculateLineNumberWidth()`
   - `calculateContentWidth()`

3. **Update viewer components** (20 min)
   - UnifiedDiffViewer line number integration
   - SplitDiffViewer line number integration

4. **Update tests** (30 min)
   - Modify existing threshold tests
   - Add boundary tests (119/120/121)
   - Add line number width tests
   - Verify all breakpoint coverage

5. **Manual verification** (10 min)
   - Test in actual terminal at various sizes

## Technical Notes for Developer Stage

### Constants to Define

```typescript
// Consider extracting these as constants for easier maintenance
const SPLIT_MODE_MIN_WIDTH = 120;
const MIN_CONTENT_WIDTH = {
  narrow: 20,
  compact: 30,
  normal: 40,
  wide: 50,
} as const;
const LINE_NUMBER_MIN_DIGITS = 2;
```

### Edge Cases to Handle

1. **Empty diff**: No lines to calculate max line number from - use default
2. **Very large files**: Ensure line number width doesn't exceed reasonable bounds (e.g., 6 chars max)
3. **Terminal resize during render**: Hook handles this, but ensure calculations are stable

### Test Mock Pattern

```typescript
const createMockDimensions = (width: number) => ({
  width,
  height: 30,
  breakpoint: width < 60 ? 'narrow' : width < 100 ? 'compact' : width < 160 ? 'normal' : 'wide',
  isNarrow: width < 60,
  isCompact: width >= 60 && width < 100,
  isNormal: width >= 100 && width < 160,
  isWide: width >= 160,
  isAvailable: true,
});
```
