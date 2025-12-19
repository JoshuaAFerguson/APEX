# Technical Design: ErrorDisplay Component Responsive Enhancement

## Status
Accepted

## Context

### Current State Analysis

The `ErrorDisplay.tsx` file has been **partially implemented** with responsive width adaptation:

**Already Implemented (✅):**
1. All three components (`ErrorDisplay`, `ErrorSummary`, `ValidationError`) use `useStdoutDimensions` hook
2. Message truncation based on terminal width
3. Timestamp abbreviation in narrow mode (ErrorSummary)
4. Context value truncation
5. Suggestion description truncation
6. Explicit width prop override support
7. Basic test coverage for responsive behavior

**Gaps Identified (❌):**
1. Stack traces are always shown as 10 lines regardless of terminal width/verbose mode
2. No integration with verbose mode for stack trace display
3. Suggestions don't adapt count/detail level based on width
4. No ADR documenting the full responsive behavior matrix

### Acceptance Criteria Review

| Criteria | Status | Notes |
|----------|--------|-------|
| Uses `useStdoutDimensions` hook instead of static width prop | ✅ DONE | Line 62-63 in ErrorDisplay |
| Truncates error messages and suggestions in narrow terminals | ✅ DONE | Lines 66-68, 217 |
| Shows full stack traces only in wide terminals with verbose mode | ❌ MISSING | Currently hardcoded to 10 lines |
| Tests cover all breakpoints | ⚠️ PARTIAL | Tests exist but need stack trace breakpoint coverage |

## Technical Design

### 1. Stack Trace Width/Verbose Mode Adaptation

The primary gap is stack trace display adaptation. Current behavior shows 10 lines regardless of context.

#### Proposed Responsive Stack Trace Behavior Matrix

| Breakpoint | Width | Verbose Mode OFF | Verbose Mode ON |
|------------|-------|------------------|-----------------|
| narrow     | <60   | 0 lines (hidden) | 3 lines (abbreviated) |
| compact    | 60-100| 0 lines (hidden) | 5 lines |
| normal     | 100-160| 5 lines | 10 lines |
| wide       | ≥160  | 8 lines | Full stack (all lines) |

#### Implementation Changes for ErrorDisplay

```typescript
// Add verbose prop to ErrorDisplayProps
export interface ErrorDisplayProps {
  error: Error | string;
  title?: string;
  suggestions?: ErrorSuggestion[];
  showStack?: boolean;
  verbose?: boolean;  // NEW: verbose mode flag
  showSuggestions?: boolean;
  context?: Record<string, unknown>;
  width?: number;
  onRetry?: () => void;
  onDismiss?: () => void;
}

// Calculate responsive stack trace configuration
const getStackTraceConfig = (
  breakpoint: Breakpoint,
  verbose: boolean
): { maxLines: number; shouldShow: boolean } => {
  const config = {
    narrow: { normal: 0, verbose: 3 },
    compact: { normal: 0, verbose: 5 },
    normal: { normal: 5, verbose: 10 },
    wide: { normal: 8, verbose: Infinity }, // Infinity = show all
  };

  const maxLines = verbose
    ? config[breakpoint].verbose
    : config[breakpoint].normal;

  return {
    maxLines,
    shouldShow: maxLines > 0,
  };
};
```

#### Stack Trace Rendering Update

```typescript
{/* Stack trace - responsive to width and verbose mode */}
{showStack && errorStack && stackConfig.shouldShow && (
  <Box flexDirection="column" marginBottom={1}>
    <Text color="gray" bold>
      Stack Trace{stackConfig.maxLines !== Infinity ? ` (${Math.min(stackLines.length, stackConfig.maxLines)} lines)` : ''}:
    </Text>
    <Box marginLeft={2} flexDirection="column">
      {stackLines
        .slice(0, stackConfig.maxLines === Infinity ? undefined : stackConfig.maxLines)
        .map((line, index) => (
          <Text key={index} color="gray" dimColor>
            {truncateStackLine(line, width - 4)} {/* Truncate wide lines */}
          </Text>
        ))}
      {stackLines.length > stackConfig.maxLines && stackConfig.maxLines !== Infinity && (
        <Text color="gray" dimColor italic>
          ... {stackLines.length - stackConfig.maxLines} more lines (use verbose mode to see full trace)
        </Text>
      )}
    </Box>
  </Box>
)}
```

### 2. Suggestion Adaptation

Suggestions should also adapt to terminal width:

| Breakpoint | Max Suggestions | Description Length |
|------------|-----------------|-------------------|
| narrow     | 2 | 25 chars |
| compact    | 3 | width - 16 |
| normal     | 5 | width - 16 |
| wide       | unlimited | full |

```typescript
const getSuggestionConfig = (breakpoint: Breakpoint, width: number) => {
  const configs = {
    narrow: { maxSuggestions: 2, descLength: 25 },
    compact: { maxSuggestions: 3, descLength: Math.max(25, width - 16) },
    normal: { maxSuggestions: 5, descLength: Math.max(40, width - 16) },
    wide: { maxSuggestions: Infinity, descLength: Infinity },
  };
  return configs[breakpoint];
};
```

### 3. Error Message Handling

Error messages should wrap rather than truncate in most cases (already implemented correctly with `wrap="wrap"`).

For extremely narrow terminals (<40 chars), consider:
- Abbreviating "Suggestions:" to "Tips:"
- Hiding priority icons
- Single-line error display

### 4. Component Interface Updates

```typescript
// ErrorDisplay - add verbose prop
export interface ErrorDisplayProps {
  // ... existing props
  verbose?: boolean;  // Controls stack trace detail level
}

// ErrorSummary - already has timestamp abbreviation, no changes needed

// ValidationError - no changes needed (already responsive)
```

### 5. Test Coverage Requirements

Tests must cover all four breakpoints for each component:

```typescript
describe('ErrorDisplay stack trace behavior', () => {
  describe('narrow terminal (<60)', () => {
    it('should hide stack trace in non-verbose mode');
    it('should show 3 lines in verbose mode');
  });

  describe('compact terminal (60-100)', () => {
    it('should hide stack trace in non-verbose mode');
    it('should show 5 lines in verbose mode');
  });

  describe('normal terminal (100-160)', () => {
    it('should show 5 lines in non-verbose mode');
    it('should show 10 lines in verbose mode');
  });

  describe('wide terminal (≥160)', () => {
    it('should show 8 lines in non-verbose mode');
    it('should show full stack trace in verbose mode');
  });
});
```

## Implementation Plan

### Phase 1: Add Verbose Mode Support
1. Add `verbose` prop to `ErrorDisplayProps`
2. Implement `getStackTraceConfig` helper function
3. Update stack trace rendering logic
4. Add stack line truncation for wide lines

### Phase 2: Enhance Suggestion Adaptation
1. Implement `getSuggestionConfig` helper
2. Limit suggestions shown in narrow/compact modes
3. Add "more suggestions" indicator when truncated

### Phase 3: Test Coverage
1. Add stack trace breakpoint tests for all four breakpoints
2. Add verbose mode interaction tests
3. Add suggestion count adaptation tests
4. Verify existing tests still pass

### Phase 4: Documentation
1. Update ADR-029 with verbose mode details
2. Add inline JSDoc comments

## Files to Modify

| File | Changes |
|------|---------|
| `packages/cli/src/ui/components/ErrorDisplay.tsx` | Add verbose prop, stack trace config, suggestion config |
| `packages/cli/src/ui/components/__tests__/ErrorDisplay.test.tsx` | Add verbose mode tests |
| `packages/cli/src/ui/components/__tests__/ErrorDisplay.enhanced-responsive.test.tsx` | Add stack trace breakpoint tests |
| `docs/adr/ADR-029-errordisplay-responsive-width.md` | Update with verbose mode behavior |

## Architectural Decisions

### ADR: Stack Trace Visibility Based on Terminal Width

**Context**: Stack traces can be long and overwhelm narrow terminals.

**Decision**: Stack traces are hidden by default in narrow/compact terminals unless verbose mode is enabled.

**Rationale**:
- Narrow terminals prioritize actionable information (error message, suggestions)
- Stack traces are typically for debugging, not end-user error resolution
- Verbose mode provides explicit opt-in for detailed technical information

**Consequences**:
- Users in narrow terminals won't see stack traces by default
- Verbose flag must be passed for full debugging information
- Consistent with ActivityLog's verbose mode behavior

### ADR: Suggestion Count Limiting

**Context**: Auto-generated suggestions can accumulate (permission + network + timeout).

**Decision**: Limit displayed suggestions based on terminal width.

**Rationale**:
- Higher priority suggestions are shown first (already sorted)
- Narrow terminals have limited space for actionable content
- Users can access full suggestions in wider terminals

**Consequences**:
- Some suggestions may be hidden in narrow terminals
- Priority sorting ensures most important suggestions are visible

## Consistency with Other Components

This design follows patterns established in:
- `ActivityLog.tsx`: verbose mode, timestamp abbreviation, message truncation
- `StatusBar.tsx`: responsive breakpoint adaptation
- `StreamingText.tsx`: width-based content adaptation

## Rollback Plan

If issues arise:
1. Remove `verbose` prop usage (defaults to false)
2. Revert to static 10-line stack trace limit
3. Keep existing truncation logic (already working)

## Success Metrics

1. All acceptance criteria tests pass
2. No visual regressions in existing behavior
3. Stack traces display correctly at each breakpoint
4. Verbose mode integration works as expected
