# ADR-037: Responsive Layout Terminal Width Architecture

## Status
**Accepted** - Architecture Review (No Changes Required)

## Context

This ADR documents the existing responsive layout architecture for terminal width adaptation in the APEX CLI. The architecture stage was tasked with designing technical solutions for:

1. StatusBar segments adapting to terminal width
2. Components using `useStdoutDimensions` hook
3. Narrow terminals showing abbreviated content
4. Wide terminals showing full information
5. No visual overflow or truncation issues

## Decision

After comprehensive analysis, **the responsive layout system is already fully implemented** and meets all acceptance criteria. This ADR serves as documentation of the existing architecture.

## Architecture Overview

### Core Infrastructure

#### 1. `useStdoutDimensions` Hook
**Location**: `packages/cli/src/ui/hooks/useStdoutDimensions.ts`

The foundational hook provides terminal dimensions with a 4-tier breakpoint system:

```typescript
interface StdoutDimensions extends BreakpointHelpers {
  width: number;           // Terminal width in columns
  height: number;          // Terminal height in rows
  breakpoint: Breakpoint;  // 'narrow' | 'compact' | 'normal' | 'wide'
  isAvailable: boolean;    // Whether actual dimensions are available

  // Boolean helpers
  isNarrow: boolean;       // width < 60
  isCompact: boolean;      // width >= 60 && < 100
  isNormal: boolean;       // width >= 100 && < 160
  isWide: boolean;         // width >= 160
}
```

**Breakpoint Thresholds**:
| Breakpoint | Width Range | Use Case |
|------------|-------------|----------|
| `narrow`   | < 60        | Minimal display, abbreviated labels |
| `compact`  | 60-99       | Reduced but functional display |
| `normal`   | 100-159     | Standard display |
| `wide`     | >= 160      | Full display with extras |

**Key Features**:
- Resize event handling via stdout listeners
- Configurable fallback dimensions
- Customizable breakpoint thresholds
- Memoized calculations for performance

#### 2. StatusBar Responsive Architecture
**Location**: `packages/cli/src/ui/components/StatusBar.tsx`

Implements a **priority-based segment system** for width adaptation:

**Priority Tiers**:
- **CRITICAL**: Connection status, Session timer (always visible)
- **HIGH**: Git branch, Agent, Cost, Model
- **MEDIUM**: Workflow stage, Tokens, Subtask progress
- **LOW**: Session name, API URLs, Preview/Verbose indicators

**Display Tiers**:
| Tier | Width | Priorities Shown |
|------|-------|------------------|
| `narrow` | < 60 | CRITICAL + HIGH (abbreviated) |
| `normal` | 60-160 | CRITICAL + HIGH + MEDIUM |
| `wide` | > 160 | All priorities |

**Abbreviation System**:
```typescript
const LABEL_ABBREVIATIONS: Record<string, string> = {
  'tokens:': 'tk:',
  'cost:': '',        // Shows just $value
  'model:': 'm:',
  'active:': 'a:',
  'idle:': 'i:',
  'stage:': 's:',
  'session:': 'sess:',
  'total:': '∑:',
  'api:': '→',
  'web:': '↗',
};
```

**Key Algorithm**:
1. Build all potential segments with priority metadata
2. Filter by display mode (compact/normal/verbose)
3. Filter by display tier based on priority
4. Apply abbreviations for narrow terminals
5. Final width-based trimming as fallback safety

### Components Using Responsive Layout

All major CLI components integrate with `useStdoutDimensions`:

| Component | Responsive Features |
|-----------|---------------------|
| `StatusBar` | Priority-based segment visibility, abbreviated labels |
| `TaskProgress` | Auto-compact for narrow, truncation config by breakpoint |
| `ActivityLog` | Message truncation, timestamp abbreviation, icon hiding |
| `Banner` | Three display modes: full ASCII art, compact box, text-only |
| `ProgressBar` | Responsive width calculation with min/max constraints |
| `SpinnerWithText` | Text truncation with abbreviated alternatives |
| `ProgressIndicators` | Responsive width with reserved space calculation |
| `ErrorDisplay` | Responsive stack trace and message width |
| `PreviewPanel` | Responsive content width |
| `DiffViewer` | Responsive diff display |
| `SyntaxHighlighter` | Responsive code width |
| `MarkdownRenderer` | Responsive text wrapping |
| `StreamingText` | Responsive streaming output |
| `AgentPanel` | Responsive parallel execution view |
| `ParallelExecutionView` | Dynamic column calculation |

### Design Patterns

#### Pattern 1: Explicit Width Override
All responsive components support explicit `width` prop for testing or fixed-width containers:

```typescript
interface ComponentProps {
  width?: number;  // Optional override
  responsive?: boolean;  // Enable/disable responsive (default: true)
}

// Implementation
const { width: terminalWidth } = useStdoutDimensions();
const effectiveWidth = explicitWidth ?? terminalWidth;
```

#### Pattern 2: Breakpoint-Based Rendering
Components use boolean helpers for conditional rendering:

```tsx
const { isNarrow, isCompact, breakpoint } = useStdoutDimensions();

if (isNarrow) {
  return <MinimalView />;
}
if (isCompact) {
  return <CompactView />;
}
return <FullView />;
```

#### Pattern 3: Calculated Truncation
Components calculate max lengths based on available space:

```typescript
const calculateMessageMaxLength = (
  totalWidth: number,
  hasTimestamp: boolean,
  hasAgent: boolean,
  isNarrow: boolean
): number => {
  let reserved = 4; // borders and padding
  if (hasTimestamp) reserved += isNarrow ? 8 : 12;
  if (hasAgent) reserved += 12;
  return Math.max(20, totalWidth - reserved);
};
```

#### Pattern 4: Display Mode Integration
Responsive behavior integrates with display modes (compact/normal/verbose):

```typescript
// Auto-compact for narrow terminals
const effectiveDisplayMode = useMemo(() => {
  if (breakpoint === 'narrow' && displayMode !== 'verbose') {
    return 'compact';
  }
  return displayMode;
}, [breakpoint, displayMode]);
```

### Data Flow

```
Terminal Resize Event
        ↓
stdout.on('resize')
        ↓
useStdoutDimensions (recalculates)
        ↓
Component re-render with new dimensions
        ↓
Responsive calculations (memoized)
        ↓
Appropriate display tier rendered
```

## Consequences

### Positive
- Comprehensive 4-tier breakpoint system covers all terminal sizes
- Priority-based segment hiding ensures most important info is always visible
- Consistent responsive API across all components
- Explicit override capability for testing and fixed layouts
- Performance optimized with memoization
- Integration with display modes for user control

### Negative
- Some complexity in maintaining priority assignments
- Resize events can cause brief layout shifts
- Abbreviations may not be immediately recognizable to new users

### Risks
- None identified - system is stable and well-tested

## Verification of Acceptance Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| StatusBar segments adapt to terminal width | ✅ Complete | Priority-based filtering in `buildSegments()` |
| Components use `useStdoutDimensions` hook | ✅ Complete | 15+ components verified |
| Narrow terminals show abbreviated content | ✅ Complete | `LABEL_ABBREVIATIONS` and `narrowModeConfig` |
| Wide terminals show full information | ✅ Complete | `PRIORITY_BY_TIER.wide` includes all priorities |
| No visual overflow or truncation issues | ✅ Complete | `trimToFit()` and calculated max lengths |

## Test Coverage

Extensive test coverage exists:
- `useStdoutDimensions.test.ts` - Hook functionality
- `StatusBar.responsive.test.tsx` - StatusBar adaptation
- `StatusBar.priority-breakpoints.test.tsx` - Priority system
- `StatusBar.abbreviated.test.tsx` - Abbreviation behavior
- `TaskProgress.responsive.test.tsx` - TaskProgress adaptation
- `ActivityLog.responsive-width.test.tsx` - ActivityLog adaptation
- `Banner.responsive.test.tsx` - Banner display modes
- `ProgressIndicators.responsive-edge-cases.test.tsx` - Edge cases
- Multiple integration tests in `__tests__/` directories

## Related ADRs

- ADR-023: useStdoutDimensions Hook Breakpoint System
- ADR-028: StatusBar Abbreviated Labels
- ADR-020: Display Modes (Compact/Verbose)
- ADR-016: Responsive Width for StreamingText/MarkdownRenderer
- ADR-029: ErrorDisplay Responsive Width
- ADR-032: Responsive DiffViewer/SyntaxHighlighter
- ADR-033: PreviewPanel Responsive Width Adaptation

## Conclusion

The responsive layout system for terminal width adaptation is **architecturally complete**. No new design work is required. The implementation follows established patterns, integrates consistently across all CLI components, and has comprehensive test coverage.

**Recommendation**: Proceed to testing stage to verify behavior rather than implement new features.
