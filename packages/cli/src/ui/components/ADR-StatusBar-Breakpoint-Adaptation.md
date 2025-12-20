# ADR: StatusBar Breakpoint-Based Segment Adaptation

## Status
Proposed

## Context

The StatusBar component needs intelligent breakpoint-based segment adaptation to ensure optimal display across different terminal widths. The acceptance criteria requires:

- **Narrow (<80)**: Shows minimal segments with abbreviated labels
- **Normal (80-120)**: Shows most segments with full labels
- **Wide (>120)**: Shows all segments with full labels
- No overflow or truncation at any width
- Progressive segment hiding follows priority order

### Current Implementation Analysis

The StatusBar currently has:
1. A `useStdoutDimensions` hook with custom breakpoints (narrow: 80, compact: 100, normal: 120)
2. A `Segment` interface with `abbreviatedLabel` property
3. An `AbbreviationMode` system ('full' | 'abbreviated' | 'auto')
4. Width-based filtering in `buildSegments()` (removes left-side segments when space insufficient)
5. Display modes: 'compact', 'normal', 'verbose'

### Current Gaps

1. **No direct breakpoint-segment mapping**: The `breakpoint` enum from `useStdoutDimensions` is not used in segment building logic
2. **Rigid abbreviation threshold**: Hardcoded 80-column boundary for auto mode (line 74)
3. **Limited right-side filtering**: Right-side segments are not filtered, only left-side
4. **No segment priority system**: No explicit priority ordering for progressive hiding
5. **No overflow prevention**: No mechanism to guarantee no overflow at any width

## Decision

### 1. Segment Priority System

Define explicit priority tiers for all segments. Lower priority segments are hidden first when space is constrained.

```typescript
// Segment priority levels (1 = highest, 5 = lowest)
export enum SegmentPriority {
  CRITICAL = 1,   // Always shown: connection status
  ESSENTIAL = 2,  // Almost always shown: timer, cost
  IMPORTANT = 3,  // Show in normal+: git branch, agent, tokens, model
  SECONDARY = 4,  // Show in wide: workflow stage, progress, session name
  OPTIONAL = 5,   // Show only in wide: URLs, indicators, verbose timing
}

interface SegmentWithPriority extends Segment {
  priority: SegmentPriority;
  side: 'left' | 'right';
}
```

### 2. Breakpoint-Based Segment Visibility Configuration

Create a configuration object that maps breakpoints to visibility rules:

```typescript
interface BreakpointConfig {
  maxPriority: SegmentPriority;  // Hide segments with priority > maxPriority
  useAbbreviatedLabels: boolean;
  maxLeftSegments: number;       // Soft limit on left-side segments
  maxRightSegments: number;      // Soft limit on right-side segments
}

const BREAKPOINT_CONFIGS: Record<Breakpoint, BreakpointConfig> = {
  narrow: {    // < 80 columns
    maxPriority: SegmentPriority.ESSENTIAL,
    useAbbreviatedLabels: true,
    maxLeftSegments: 3,
    maxRightSegments: 2,
  },
  compact: {   // 80-99 columns (maps to "normal" in acceptance criteria)
    maxPriority: SegmentPriority.IMPORTANT,
    useAbbreviatedLabels: false,
    maxLeftSegments: 5,
    maxRightSegments: 4,
  },
  normal: {    // 100-119 columns
    maxPriority: SegmentPriority.SECONDARY,
    useAbbreviatedLabels: false,
    maxLeftSegments: 7,
    maxRightSegments: 6,
  },
  wide: {      // >= 120 columns
    maxPriority: SegmentPriority.OPTIONAL,
    useAbbreviatedLabels: false,
    maxLeftSegments: Infinity,
    maxRightSegments: Infinity,
  },
};
```

### 3. Segment Priority Assignments

| Segment | Side | Priority | Narrow | Normal | Wide |
|---------|------|----------|--------|--------|------|
| Connection status | left | CRITICAL (1) | ✓ | ✓ | ✓ |
| Session timer | right | ESSENTIAL (2) | ✓ | ✓ | ✓ |
| Cost | right | ESSENTIAL (2) | ✓ | ✓ | ✓ |
| Git branch | left | IMPORTANT (3) | ✗ | ✓ | ✓ |
| Agent | left | IMPORTANT (3) | ✗ | ✓ | ✓ |
| Tokens | right | IMPORTANT (3) | ✗ | ✓ | ✓ |
| Model | right | IMPORTANT (3) | ✗ | ✓ | ✓ |
| Workflow stage | left | SECONDARY (4) | ✗ | ✗ | ✓ |
| Subtask progress | left | SECONDARY (4) | ✗ | ✗ | ✓ |
| Session name | left | SECONDARY (4) | ✗ | ✗ | ✓ |
| API URL | left | OPTIONAL (5) | ✗ | ✗ | ✓ |
| Web URL | left | OPTIONAL (5) | ✗ | ✗ | ✓ |
| Preview indicator | right | OPTIONAL (5) | ✗ | ✗ | ✓ |
| Thoughts indicator | right | OPTIONAL (5) | ✗ | ✗ | ✓ |
| Verbose timing | right | OPTIONAL (5) | ✗ | ✗ | ✓ |
| Verbose indicator | right | OPTIONAL (5) | ✗ | ✗ | ✓ |

### 4. Adaptive Width Calculation Algorithm

Implement a two-pass algorithm to ensure no overflow:

```typescript
function buildAdaptiveSegments(
  props: StatusBarProps,
  elapsed: string,
  terminalWidth: number,
  breakpoint: Breakpoint
): { left: Segment[]; right: Segment[] } {
  const config = BREAKPOINT_CONFIGS[breakpoint];
  const useAbbreviated = config.useAbbreviatedLabels;

  // Pass 1: Generate all segments with priorities
  const allSegments = generateAllSegments(props, elapsed, useAbbreviated);

  // Pass 2: Filter by priority threshold
  const filteredSegments = allSegments.filter(
    seg => seg.priority <= config.maxPriority
  );

  // Pass 3: Calculate actual widths and apply hard limits
  const { left, right } = allocateSegments(filteredSegments, terminalWidth);

  // Pass 4: Progressive removal if still over width
  return enforceWidthConstraint(left, right, terminalWidth, useAbbreviated);
}

function enforceWidthConstraint(
  left: Segment[],
  right: Segment[],
  maxWidth: number,
  useAbbreviated: boolean
): { left: Segment[]; right: Segment[] } {
  const padding = 6; // Border and spacing
  const gap = 2;     // Gap between segments

  // Calculate total width
  const calculateTotal = (segs: Segment[]) =>
    segs.reduce((sum, s) => sum + calculateMinWidth(s, useAbbreviated) + gap, 0);

  let leftSegs = [...left];
  let rightSegs = [...right];

  // Remove lowest priority segments until fits
  while (calculateTotal(leftSegs) + calculateTotal(rightSegs) + padding > maxWidth) {
    // Find and remove lowest priority segment
    const allPrioritized = [
      ...leftSegs.map(s => ({ seg: s, side: 'left' as const })),
      ...rightSegs.map(s => ({ seg: s, side: 'right' as const })),
    ].sort((a, b) => (b.seg as any).priority - (a.seg as any).priority);

    if (allPrioritized.length === 0) break;

    const toRemove = allPrioritized[0];
    if (toRemove.side === 'left') {
      leftSegs = leftSegs.filter(s => s !== toRemove.seg);
    } else {
      rightSegs = rightSegs.filter(s => s !== toRemove.seg);
    }
  }

  return { left: leftSegs, right: rightSegs };
}
```

### 5. Updated Segment Interface

Extend the existing interface to include priority:

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
  priority: SegmentPriority;  // NEW: Required priority level
}
```

### 6. Interaction with Display Modes

The display mode (compact/normal/verbose) should interact with breakpoint adaptation:

| Display Mode | Breakpoint Behavior |
|--------------|---------------------|
| `compact` | Force `narrow` config regardless of actual width |
| `normal` | Use breakpoint-based config |
| `verbose` | Show all segments regardless of breakpoint (may overflow) |

```typescript
function getEffectiveBreakpointConfig(
  breakpoint: Breakpoint,
  displayMode: 'compact' | 'normal' | 'verbose'
): BreakpointConfig {
  if (displayMode === 'compact') {
    return BREAKPOINT_CONFIGS.narrow;
  }
  if (displayMode === 'verbose') {
    return {
      maxPriority: SegmentPriority.OPTIONAL,
      useAbbreviatedLabels: false,
      maxLeftSegments: Infinity,
      maxRightSegments: Infinity,
    };
  }
  return BREAKPOINT_CONFIGS[breakpoint];
}
```

### 7. Acceptance Criteria Mapping

Mapping our 4-tier breakpoint system to the 3-tier acceptance criteria:

| Acceptance Criteria | Our Breakpoints | Terminal Width |
|---------------------|-----------------|----------------|
| Narrow | `narrow` | < 80 |
| Normal | `compact` + `normal` | 80-120 |
| Wide | `wide` | > 120 |

The current `useStdoutDimensions` configuration in StatusBar already aligns with this:
```typescript
breakpoints: {
  narrow: 80,    // < 80 = narrow (AC: narrow)
  compact: 100,  // 80-99 = compact (AC: normal)
  normal: 120,   // 100-119 = normal (AC: normal)
},               // >= 120 = wide (AC: wide)
```

## Technical Design

### File Changes Required

#### 1. `packages/cli/src/ui/components/StatusBar.tsx`

**New Exports:**
- `SegmentPriority` enum
- `BreakpointConfig` interface
- `BREAKPOINT_CONFIGS` constant
- `buildAdaptiveSegments()` function (replaces `buildSegments()`)

**Modified Functions:**
- `buildSegments()` → `buildAdaptiveSegments()` with priority-based filtering
- Add priority property to all segment definitions
- Update `StatusBar` component to pass breakpoint to segment builder

**Key Implementation Details:**

```typescript
// 1. Add priority to each segment during generation
if (props.gitBranch) {
  left.push({
    icon: '',
    iconColor: 'cyan',
    value: props.gitBranch,
    valueColor: 'yellow',
    minWidth: props.gitBranch.length + 3,
    priority: SegmentPriority.IMPORTANT,  // NEW
  });
}

// 2. Update StatusBar to use breakpoint
const { width: terminalWidth, breakpoint } = useStdoutDimensions({...});

const segments = buildAdaptiveSegments({
  ...props
}, elapsed, terminalWidth, breakpoint);

// 3. Add width constraint enforcement
function enforceWidthConstraint(...) {
  // Iteratively remove lowest priority until fits
}
```

#### 2. `packages/cli/src/ui/components/__tests__/StatusBar.breakpoint-adaptation.test.tsx` (New)

New test file specifically for breakpoint adaptation:
- Tests for narrow breakpoint showing minimal segments
- Tests for normal breakpoint showing most segments
- Tests for wide breakpoint showing all segments
- Tests for no overflow at boundary widths (79, 80, 119, 120)
- Tests for progressive hiding based on priority
- Tests for interaction with display modes

### Interface Contract

```typescript
// Public API remains unchanged
export function StatusBar(props: StatusBarProps): React.ReactElement;

// Internal types (exported for testing)
export enum SegmentPriority {
  CRITICAL = 1,
  ESSENTIAL = 2,
  IMPORTANT = 3,
  SECONDARY = 4,
  OPTIONAL = 5,
}

export interface BreakpointConfig {
  maxPriority: SegmentPriority;
  useAbbreviatedLabels: boolean;
  maxLeftSegments: number;
  maxRightSegments: number;
}

export const BREAKPOINT_CONFIGS: Record<Breakpoint, BreakpointConfig>;
```

## Consequences

### Positive
- Clear, predictable segment visibility based on terminal width
- No overflow or truncation at any supported width
- Configurable priority system allows easy adjustment
- Maintains backward compatibility with existing display modes
- Testable behavior with explicit breakpoint configurations

### Negative
- Slightly more complex segment generation logic
- May need tuning of priority assignments based on user feedback
- Verbose mode intentionally ignores constraints (may overflow)

### Neutral
- Follows existing patterns in the codebase
- Consistent with `useStdoutDimensions` hook design
- Priority system can be extended for future segments

## Implementation Notes for Developer Agent

1. **Start with tests**: Write breakpoint adaptation tests first to establish expected behavior
2. **Add SegmentPriority enum**: Define at top of StatusBar.tsx
3. **Add priority to existing segments**: Update all segment definitions in `buildSegments()`
4. **Implement priority filtering**: Add `filterByPriority()` helper function
5. **Implement width enforcement**: Add `enforceWidthConstraint()` helper function
6. **Update component**: Pass `breakpoint` to segment builder
7. **Test boundary conditions**: Verify behavior at 79, 80, 119, 120 columns

## Alternatives Considered

### Alternative 1: CSS-like Media Query System
Define segment visibility using CSS-like media queries. Rejected because it adds unnecessary complexity and doesn't align with React/Ink patterns.

### Alternative 2: Dynamic Width Calculation Only
Use only runtime width calculation without predefined breakpoint configurations. Rejected because it's harder to test and doesn't provide predictable behavior.

### Alternative 3: Segment Importance Score
Use a floating-point importance score instead of discrete priority levels. Rejected because discrete levels are easier to reason about and configure.

## References

- [useStdoutDimensions ADR](/packages/cli/src/ui/hooks/ADR-useStdoutDimensions.md)
- [StatusBar tests](/packages/cli/src/ui/components/__tests__/StatusBar.*.test.tsx)
- [Ink responsive design patterns](https://github.com/vadimdemedes/ink)
