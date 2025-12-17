# ADR: Responsive StatusBar Segment Adaptation

## Status
Proposed

## Context

The `StatusBar` component needs enhanced responsive terminal width adaptation to intelligently show/hide and abbreviate segments based on available space. The task requirements are:

### Acceptance Criteria
1. StatusBar uses `useStdoutDimensions` hook (**already implemented**)
2. Segments intelligently adapt to narrow (<80), normal (80-120), and wide (>120) terminals
3. Abbreviated labels shown in narrow mode
4. No overflow/truncation
5. Existing tests updated and pass

### Current State

**StatusBar.tsx** (packages/cli/src/ui/components/StatusBar.tsx):
- Already imports and uses `useStdoutDimensions` hook (lines 3, 92-96)
- Uses **deprecated** options: `narrowThreshold: 80, wideThreshold: 120`
- Has a basic `buildSegments()` function that filters segments based on width
- Current filtering only removes lower-priority left segments when content exceeds width
- **No abbreviated labels** - segments show full labels or are completely hidden
- **No intelligent adaptation** - just binary show/hide based on width

**useStdoutDimensions hook** (packages/cli/src/ui/hooks/useStdoutDimensions.ts):
- Returns `{ width, height, breakpoint, isAvailable, isNarrow, isCompact, isNormal, isWide }`
- Default breakpoints: narrow (<60), compact (60-100), normal (100-160), wide (>=160)
- Supports custom breakpoints via `breakpoints` option
- Deprecated: `narrowThreshold` and `wideThreshold` options

### Problem Analysis

1. **Breakpoint Mismatch**: Acceptance criteria uses 80/120 thresholds, but StatusBar uses deprecated API with 80/120 which maps to a 3-tier system
2. **No Abbreviation Strategy**: Labels like "tokens:", "cost:", "model:" don't have short forms
3. **Poor Segment Prioritization**: Current logic only removes from left side, doesn't consider importance
4. **Width Calculation Issues**: `minWidth` values may not reflect actual rendered width
5. **No Progressive Enhancement**: Jumps from full display to hidden, no intermediate states

## Decision

### 1. Breakpoint Configuration (Task-Specific)

Use custom breakpoints matching the acceptance criteria thresholds:

```typescript
const { width: terminalWidth, breakpoint, isNarrow } = useStdoutDimensions({
  breakpoints: {
    narrow: 80,   // < 80 = narrow
    compact: 120, // 80-119 = compact (effectively "normal" for this task)
    normal: 160,  // >= 120 = normal/wide (merged for this task)
  },
});

// Map to task terminology
// narrow: < 80 cols (abbreviated mode)
// normal: 80-119 cols (standard mode)
// wide: >= 120 cols (extended mode)
const displayTier = terminalWidth < 80 ? 'narrow' : terminalWidth < 120 ? 'normal' : 'wide';
```

### 2. Segment Priority System

Define explicit priority tiers for segments to enable intelligent adaptation:

```typescript
type SegmentPriority = 'critical' | 'high' | 'medium' | 'low';

interface ResponsiveSegment {
  id: string;
  priority: SegmentPriority;
  fullLabel: string;
  abbreviatedLabel: string;
  value: string;
  valueColor: string;
  labelColor?: string;
  icon?: string;
  iconColor?: string;
  minWidthFull: number;    // Minimum width with full label
  minWidthAbbrev: number;  // Minimum width with abbreviated label
}
```

**Priority Assignments:**

| Priority | Left Side Segments | Right Side Segments |
|----------|-------------------|---------------------|
| critical | Connection status | Elapsed timer |
| high | Git branch, Agent | Cost, Model |
| medium | Workflow stage, Session name | Tokens |
| low | Subtask progress, API URL, Web URL | Session cost, Preview/Verbose indicators |

### 3. Abbreviated Labels Strategy

Define short forms for all labels used in segments:

| Full Label | Abbreviated | Context |
|------------|-------------|---------|
| `tokens:` | `tk:` | Right side |
| `cost:` | `$` | Right side (just show value) |
| `model:` | `m:` | Right side |
| `api:` | `→` | Left side (arrow indicates API) |
| `web:` | `↗` | Left side (arrow indicates web) |
| `active:` | `a:` | Verbose mode |
| `idle:` | `i:` | Verbose mode |
| `stage:` | `s:` | Verbose mode |
| `session:` | `sess:` | Verbose mode |
| `total:` | `∑:` | Verbose mode |

**Icons in narrow mode:**
- Keep all icons - they're already compact
- Remove text labels where icon alone is sufficient (e.g., ⚡ for agent, 📋 for subtasks)

### 4. Three-Tier Responsive Strategy

#### Narrow Mode (< 80 cols)
- Show only critical and high priority segments
- Use abbreviated labels
- Icons with minimal/no text where possible
- Compress values (e.g., `1.5k` instead of full breakdown)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ● main ⚡dev ▶impl               00:00 tk:1.5k $0.12 m:opus               │
└────────────────────────────────────────────────────────────────────────────┘
```

#### Normal Mode (80-119 cols)
- Show critical, high, and medium priority segments
- Use full labels
- Standard formatting

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ● main ⚡developer ▶implementation 📋[3/5]              00:00 tokens:1.5k cost:$0.1234 model:opus │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Wide Mode (>= 120 cols)
- Show all segments
- Full labels with extended details
- Session name, API/Web URLs visible

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ● main ⚡developer ▶implementation 📋[3/5] 💾Session api:4000 web:3000       00:00 tokens:1.5k cost:$0.1234 model:opus          │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5. Updated buildSegments Architecture

```typescript
interface SegmentConfig {
  // Segment definition
  id: string;
  side: 'left' | 'right';
  priority: SegmentPriority;

  // Display options
  icon?: string;
  iconColor?: string;
  fullLabel?: string;
  abbreviatedLabel?: string;
  labelColor?: string;
  value: string;
  valueColor: string;

  // Width calculations
  getMinWidth(abbreviated: boolean): number;

  // Conditions
  shouldShow: boolean;
  narrowModeConfig?: {
    hideLabel?: boolean;
    hideValue?: boolean;
    compressValue?: (value: string) => string;
  };
}

type DisplayTier = 'narrow' | 'normal' | 'wide';

function buildSegments(
  props: StatusBarProps,
  elapsed: string,
  terminalWidth: number,
  displayTier: DisplayTier
): { left: Segment[]; right: Segment[] } {
  // 1. Build all potential segments with their configs
  const allSegments = buildAllSegments(props, elapsed);

  // 2. Filter by display mode (compact/normal/verbose)
  const modeFiltered = filterByDisplayMode(allSegments, props.displayMode);

  // 3. Apply responsive tier filtering
  const tierFiltered = filterByTier(modeFiltered, displayTier);

  // 4. Apply abbreviations if needed
  const formatted = applyAbbreviations(tierFiltered, displayTier);

  // 5. Final width-based trimming (fallback safety)
  return trimToFit(formatted, terminalWidth);
}
```

### 6. Implementation Details

#### 6.1 Segment Definition Factory

```typescript
const createSegmentConfigs = (
  props: StatusBarProps,
  elapsed: string
): SegmentConfig[] => {
  const segments: SegmentConfig[] = [];

  // Connection status - CRITICAL, always shown
  segments.push({
    id: 'connection',
    side: 'left',
    priority: 'critical',
    icon: props.isConnected !== false ? '●' : '○',
    iconColor: props.isConnected !== false ? 'green' : 'red',
    value: '',
    valueColor: 'white',
    getMinWidth: () => 2,
    shouldShow: true,
  });

  // Git branch - HIGH priority
  if (props.gitBranch) {
    segments.push({
      id: 'gitBranch',
      side: 'left',
      priority: 'high',
      icon: '',
      iconColor: 'cyan',
      value: props.gitBranch,
      valueColor: 'yellow',
      getMinWidth: (abbrev) => abbrev
        ? Math.min(props.gitBranch.length, 12) + 2
        : props.gitBranch.length + 3,
      shouldShow: true,
      narrowModeConfig: {
        compressValue: (v) => v.length > 12 ? v.slice(0, 9) + '...' : v,
      },
    });
  }

  // ... more segments defined similarly

  return segments;
};
```

#### 6.2 Priority-Based Filtering

```typescript
const PRIORITY_BY_TIER: Record<DisplayTier, SegmentPriority[]> = {
  narrow: ['critical', 'high'],
  normal: ['critical', 'high', 'medium'],
  wide: ['critical', 'high', 'medium', 'low'],
};

const filterByTier = (
  segments: SegmentConfig[],
  tier: DisplayTier
): SegmentConfig[] => {
  const allowedPriorities = PRIORITY_BY_TIER[tier];
  return segments.filter(s => allowedPriorities.includes(s.priority));
};
```

#### 6.3 Abbreviation Application

```typescript
const LABEL_ABBREVIATIONS: Record<string, string> = {
  'tokens:': 'tk:',
  'cost:': '$',
  'model:': 'm:',
  'active:': 'a:',
  'idle:': 'i:',
  'stage:': 's:',
  'session:': 'sess:',
  'total:': '∑:',
};

const applyAbbreviations = (
  segments: SegmentConfig[],
  tier: DisplayTier
): Segment[] => {
  const useAbbrev = tier === 'narrow';

  return segments.map(config => ({
    icon: config.icon,
    iconColor: config.iconColor,
    label: useAbbrev
      ? (config.abbreviatedLabel ?? config.fullLabel)
      : config.fullLabel,
    labelColor: config.labelColor,
    value: useAbbrev && config.narrowModeConfig?.compressValue
      ? config.narrowModeConfig.compressValue(config.value)
      : config.value,
    valueColor: config.valueColor,
    minWidth: config.getMinWidth(useAbbrev),
  }));
};
```

### 7. Testing Requirements

#### 7.1 New Test File: `StatusBar.responsive.test.tsx`

```typescript
describe('StatusBar - Responsive Segment Adaptation', () => {
  describe('Narrow terminals (< 80 cols)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions({ width: 60, breakpoint: 'narrow' });
    });

    it('shows only critical and high priority segments');
    it('uses abbreviated labels (tk: instead of tokens:)');
    it('truncates long git branch names');
    it('hides low priority segments (URLs, session name)');
    it('shows cost as just $ prefix without "cost:" label');
    it('does not overflow or truncate visually');
  });

  describe('Normal terminals (80-119 cols)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions({ width: 100, breakpoint: 'compact' });
    });

    it('shows medium priority segments');
    it('uses full labels');
    it('shows subtask progress');
    it('hides low priority segments');
  });

  describe('Wide terminals (>= 120 cols)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions({ width: 150, breakpoint: 'normal' });
    });

    it('shows all segments including low priority');
    it('shows session name');
    it('shows API and Web URLs');
    it('uses full labels with generous spacing');
  });

  describe('Display mode interactions', () => {
    it('compact mode overrides responsive in all tiers');
    it('verbose mode shows all info regardless of width');
    it('normal mode respects responsive tier');
  });

  describe('Edge cases', () => {
    it('handles very narrow terminals (< 40 cols)');
    it('handles very wide terminals (> 200 cols)');
    it('handles terminal resize events');
    it('handles missing optional segments gracefully');
  });
});
```

#### 7.2 Update Existing Tests

Update `StatusBar.test.tsx`:
1. Update mock to use new `useStdoutDimensions` return shape
2. Add tests for abbreviation behavior
3. Verify segment priority filtering works

### 8. File Structure

```
packages/cli/src/ui/components/
├── StatusBar.tsx                  # Update with responsive segment logic
├── ADR-responsive-statusbar.md    # This document
└── __tests__/
    ├── StatusBar.test.tsx         # Update existing tests
    └── StatusBar.responsive.test.tsx  # NEW: Comprehensive responsive tests
```

## Implementation Plan

### Phase 1: Refactor Segment Building (High Priority)
1. Define `SegmentConfig` interface with priority and abbreviation fields
2. Create `createSegmentConfigs()` factory function
3. Add `LABEL_ABBREVIATIONS` constant
4. Implement `filterByTier()` function

### Phase 2: Implement Three-Tier Responsive Logic (High Priority)
1. Update hook options to use new `breakpoints` API (remove deprecated options)
2. Calculate `displayTier` from width
3. Implement `applyAbbreviations()` function
4. Update `buildSegments()` to use new architecture

### Phase 3: Narrow Mode Optimizations (Medium Priority)
1. Implement value compression for narrow mode (git branch truncation)
2. Add cost label removal (show just "$0.12" not "cost:$0.12")
3. Implement token compression (just "1.5k" not full breakdown)

### Phase 4: Testing (High Priority)
1. Create `StatusBar.responsive.test.tsx` with all breakpoint tests
2. Update existing `StatusBar.test.tsx` mocks
3. Ensure all existing tests still pass
4. Add edge case tests

### Phase 5: Integration Verification (Medium Priority)
1. Manual testing in terminals of various widths
2. Verify no overflow/truncation at breakpoint boundaries
3. Test with real CLI usage

## Consequences

### Positive
- StatusBar intelligently adapts to all terminal widths
- No content overflow or truncation
- Abbreviated labels provide information density in narrow terminals
- Priority system ensures most important info always visible
- Follows established responsive patterns in codebase

### Negative
- Increased complexity in segment building logic
- More test coverage required
- May need iteration on abbreviation choices for clarity

### Neutral
- Backward compatible with existing displayMode prop
- Follows patterns from TaskProgress and ActivityLog responsive ADRs

## API Changes

**No breaking changes** - existing props work as before.

**Behavioral changes:**
- Segments now abbreviate in narrow terminals
- Low priority segments hidden in narrow/normal terminals
- More intelligent segment filtering based on width

## Dependencies

- `useStdoutDimensions` hook (exists, uses new breakpoints API)
- No new external dependencies

## Related Documents

- `ADR-useStdoutDimensions.md` - Hook architecture
- `ADR-responsive-taskprogress.md` - Similar responsive pattern
- `ADR-responsive-activitylog-errordisplay.md` - Similar responsive pattern
