# Technical Design: Responsive Width for StreamingText and MarkdownRenderer

## Status
**Stage**: Architecture
**Author**: architect agent
**Date**: 2024

## Executive Summary

This document provides the technical design for implementing responsive terminal width in `StreamingText` and `MarkdownRenderer` components. The implementation leverages the existing `useStdoutDimensions` hook and follows the architecture specified in ADR-016.

## Current State Analysis

### StreamingText.tsx
**Location**: `packages/cli/src/ui/components/StreamingText.tsx`

**Current Implementation**:
- ✅ Already imports `useStdoutDimensions` from `../hooks/index.js`
- ✅ Has `responsive?: boolean` prop (default: `true`)
- ✅ Calculates `effectiveWidth` correctly with fallback logic
- ❌ **BUG**: Line 98 uses `width` instead of `effectiveWidth` in `<Box width={width}>`
- The `StreamingText` component is 90% implemented, just needs the bug fix

**Sub-components requiring updates**:
1. `StreamingResponse` (lines 123-184):
   - Uses hardcoded `width = 80` default
   - Does NOT use `useStdoutDimensions` hook
   - Passes `width` directly to child `StreamingText`
   - Needs responsive prop and hook integration

2. `TypewriterText` (lines 198-237):
   - Does not have width-related props
   - Renders inline `<Text>` only (no Box container)
   - **No changes required** - not affected by terminal width

### MarkdownRenderer.tsx
**Location**: `packages/cli/src/ui/components/MarkdownRenderer.tsx`

**Current Implementation**:
- ❌ Uses hardcoded `width = 80` in both components
- ❌ Does NOT import `useStdoutDimensions`
- ❌ No `responsive` prop

**Components requiring updates**:
1. `MarkdownRenderer` (lines 14-46):
   - Uses `width = 80` default
   - Applies width to `<Box width={width}>`

2. `SimpleMarkdownRenderer` (lines 51-134):
   - Uses `width = 80` default
   - Applies width to `<Box width={width}>`

### useStdoutDimensions Hook
**Location**: `packages/cli/src/ui/hooks/useStdoutDimensions.ts`

**Available Interface**:
```typescript
interface StdoutDimensions {
  width: number;       // Terminal width in columns
  height: number;      // Terminal height in rows
  breakpoint: 'narrow' | 'normal' | 'wide';
  isAvailable: boolean; // Whether terminal size is available
}
```

**Breakpoint Thresholds** (defaults):
- `narrow`: width < 60
- `normal`: 60 <= width < 120
- `wide`: width >= 120
- `fallbackWidth`: 80 (when terminal dimensions unavailable)

## Technical Design

### Design Principles

1. **Internal Hook Integration**: Components use `useStdoutDimensions` internally for automatic responsiveness
2. **Backward Compatibility**: Explicit `width` prop overrides automatic behavior
3. **Opt-out Mechanism**: `responsive={false}` disables hook-based sizing
4. **Consistent Behavior**: All text-wrapping components follow the same pattern

### Width Calculation Formula

```typescript
const effectiveWidth = explicitWidth ?? (responsive
  ? Math.max(40, terminalWidth - 2)
  : 80);
```

**Rationale**:
- `explicitWidth ?? ...`: Explicit width takes precedence (backward compatibility)
- `Math.max(40, ...)`: Minimum 40 columns prevents unreadable text
- `terminalWidth - 2`: 2-character padding prevents edge-touching
- Fallback `80`: Standard terminal width when responsive disabled

### Component Changes

#### 1. StreamingText.tsx - Bug Fix

**File**: `packages/cli/src/ui/components/StreamingText.tsx`
**Change**: Line 98

```diff
  return (
-   <Box flexDirection="column" width={width}>
+   <Box flexDirection="column" width={effectiveWidth}>
      {displayLines.map((line, index) => (
```

**Impact**: Minimal - fixes bug where calculated `effectiveWidth` is not applied to Box

#### 2. StreamingText.tsx - StreamingResponse Update

**File**: `packages/cli/src/ui/components/StreamingText.tsx`
**Lines**: 111-184

**Interface Change**:
```typescript
export interface StreamingResponseProps {
  content: string;
  agent?: string;
  isStreaming?: boolean;
  isComplete?: boolean;
  onComplete?: () => void;
  width?: number;          // Optional override (existing)
  responsive?: boolean;    // NEW: Enable/disable responsive (default: true)
}
```

**Implementation**:
```typescript
export function StreamingResponse({
  content,
  agent,
  isStreaming = false,
  isComplete = false,
  onComplete,
  width: explicitWidth,   // Renamed from width
  responsive = true,      // NEW default
}: StreamingResponseProps): React.ReactElement {
  // Add hook integration
  const { width: terminalWidth } = useStdoutDimensions();

  // Calculate effective width
  const effectiveWidth = explicitWidth ?? (responsive
    ? Math.max(40, terminalWidth - 2)
    : 80);

  // ... rest of component uses effectiveWidth

  // Pass to StreamingText:
  <StreamingText
    text={displayContent}
    isComplete={isComplete}
    onComplete={onComplete}
    width={effectiveWidth}  // Pass calculated width
    showCursor={isStreaming && !isComplete}
    responsive={false}      // Disable nested responsive (already calculated)
  />
}
```

**Key Point**: When `StreamingResponse` calculates `effectiveWidth`, it should pass it to `StreamingText` with `responsive={false}` to avoid double-calculation of padding.

#### 3. MarkdownRenderer.tsx - Full Update

**File**: `packages/cli/src/ui/components/MarkdownRenderer.tsx`

**Import Addition** (top of file):
```typescript
import { useStdoutDimensions } from '../hooks/index.js';
```

**Interface Change**:
```typescript
export interface MarkdownRendererProps {
  content: string;
  width?: number;          // Optional override
  responsive?: boolean;    // NEW: Enable/disable responsive (default: true)
}
```

**MarkdownRenderer Implementation**:
```typescript
export function MarkdownRenderer({
  content,
  width: explicitWidth,
  responsive = true,
}: MarkdownRendererProps): React.ReactElement {
  const { width: terminalWidth } = useStdoutDimensions();

  const effectiveWidth = explicitWidth ?? (responsive
    ? Math.max(40, terminalWidth - 2)
    : 80);

  // ... existing logic, use effectiveWidth in Box
  return (
    <Box flexDirection="column" width={effectiveWidth}>
      <Text>{processed}</Text>
    </Box>
  );
}
```

**SimpleMarkdownRenderer Implementation**:
```typescript
export function SimpleMarkdownRenderer({
  content,
  width: explicitWidth,
  responsive = true,
}: MarkdownRendererProps): React.ReactElement {
  const { width: terminalWidth } = useStdoutDimensions();

  const effectiveWidth = explicitWidth ?? (responsive
    ? Math.max(40, terminalWidth - 2)
    : 80);

  // ... existing logic, use effectiveWidth in Box
  return (
    <Box flexDirection="column" width={effectiveWidth}>
      {/* existing line rendering */}
    </Box>
  );
}
```

### Type Export Additions

**File**: `packages/cli/src/ui/components/index.ts`

No changes required - types are already exported. The props interfaces are updated in place.

### Test Updates Required

**File**: `packages/cli/src/ui/components/__tests__/StreamingText.test.tsx`

Add tests for:
```typescript
describe('StreamingText responsive behavior', () => {
  it('uses terminal width when responsive=true');
  it('uses explicit width when provided');
  it('uses fallback 80 when responsive=false');
  it('respects minimum width of 40');
});

describe('StreamingResponse responsive behavior', () => {
  it('uses terminal width when responsive=true');
  it('passes calculated width to StreamingText');
});
```

**File**: `packages/cli/src/ui/components/__tests__/MarkdownRenderer.test.tsx`

Add tests for:
```typescript
describe('MarkdownRenderer responsive behavior', () => {
  it('uses terminal width when responsive=true');
  it('uses explicit width when provided');
  it('uses fallback 80 when responsive=false');
  it('respects minimum width of 40');
});

describe('SimpleMarkdownRenderer responsive behavior', () => {
  // Same tests as MarkdownRenderer
});
```

**Mock Setup**:
```typescript
vi.mock('../hooks/index.js', () => ({
  useStdoutDimensions: vi.fn(() => ({
    width: 100,
    height: 24,
    breakpoint: 'normal',
    isAvailable: true,
  })),
}));
```

## File Change Summary

| File | Changes | Lines Affected |
|------|---------|----------------|
| `StreamingText.tsx` | Bug fix + StreamingResponse update | ~20 lines |
| `MarkdownRenderer.tsx` | Add hook + responsive prop to both components | ~15 lines |
| `StreamingText.test.tsx` | Add responsive behavior tests | ~40 lines |
| `MarkdownRenderer.test.tsx` | Add responsive behavior tests | ~40 lines |

## Verification Criteria

### Acceptance Criteria Mapping

| Criterion | Verification |
|-----------|--------------|
| StreamingText uses useStdoutDimensions | Hook imported and called in component |
| MarkdownRenderer uses useStdoutDimensions | Hook imported and called in both components |
| Text wrapping adapts to terminal width | effectiveWidth calculation uses terminalWidth |
| No horizontal overflow in narrow terminals | Min width 40, padding of 2 chars |

### Manual Testing

1. Run CLI in 60-column terminal → verify text wraps correctly
2. Run CLI in 120-column terminal → verify text uses full width
3. Resize terminal during output → verify text reflows
4. Pass explicit `width={50}` → verify override works
5. Pass `responsive={false}` → verify fallback to 80

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Layout shifts during terminal resize | Acceptable UX trade-off for responsiveness |
| Performance overhead from hook | Hook is memoized, minimal re-renders |
| Breaking existing tests | Tests can use `responsive={false}` or mock hook |

## Dependencies

- `ink-use-stdout-dimensions` (existing dependency)
- `useStdoutDimensions` hook (already implemented)

## Implementation Order

1. **MarkdownRenderer.tsx** - Add hook + responsive prop (both components)
2. **StreamingText.tsx** - Fix bug + update StreamingResponse
3. **Tests** - Update both test files with responsive behavior tests
4. **Verification** - Manual testing in narrow/wide terminals

## Notes for Implementation Stage

1. The bug in `StreamingText.tsx` line 98 is the highest priority fix
2. `TypewriterText` component does NOT need changes (no Box container)
3. When updating `StreamingResponse`, disable nested responsive in `StreamingText` to avoid double-padding
4. Existing tests should continue to pass as the API is backward compatible
5. Consider adding a storybook or visual test for narrow terminal rendering
