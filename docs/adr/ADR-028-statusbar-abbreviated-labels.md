# ADR-028: StatusBar Abbreviated Label System

## Status
Proposed

## Context

The StatusBar component needs an abbreviated label system to optimize space usage in narrow terminal widths. This builds on the existing responsive segment adaptation system documented in `ADR-responsive-statusbar.md`.

### Acceptance Criteria
1. Create abbreviated versions of segment labels (e.g., 'tokens:' -> 'tok:', 'cost:' -> '$', 'model:' -> 'mod:')
2. Segment interface extended with optional `abbreviatedLabel` property
3. `buildSegments` function updated to accept abbreviation mode parameter

### Current State

**StatusBar.tsx** already has:
- `Segment` interface (lines 170-178) with `label`, `value`, `minWidth`, colors
- `buildSegments` function (lines 180-458) that builds segments based on display mode and terminal width
- Display mode support (`compact`, `normal`, `verbose`)
- Basic width-based filtering via `useStdoutDimensions` hook

**Missing:**
- `abbreviatedLabel` property on Segment interface
- Abbreviation mode parameter for `buildSegments`
- Actual abbreviated label values defined

## Decision

### 1. Extend Segment Interface

Update the `Segment` interface to include an optional `abbreviatedLabel` property:

```typescript
interface Segment {
  icon?: string;
  iconColor?: string;
  label?: string;
  abbreviatedLabel?: string;  // NEW: Short form of label
  labelColor?: string;
  value: string;
  valueColor: string;
  minWidth: number;
}
```

### 2. Define Abbreviated Labels Mapping

Create a constant mapping of full labels to their abbreviated forms:

```typescript
const ABBREVIATED_LABELS: Record<string, string> = {
  'tokens:': 'tok:',
  'cost:': '$',
  'model:': 'mod:',
  'active:': 'act:',
  'idle:': 'idl:',
  'stage:': 'stg:',
  'session:': 'sess:',
  'total:': 'tot:',
  'api:': 'api:',  // Already short
  'web:': 'web:',  // Already short
};
```

### 3. Update buildSegments Function Signature

Add an `abbreviationMode` parameter to control when abbreviated labels are used:

```typescript
type AbbreviationMode = 'full' | 'abbreviated' | 'auto';

function buildSegments(
  props: StatusBarProps,
  elapsed: string,
  terminalWidth: number,
  abbreviationMode: AbbreviationMode = 'auto'
): { left: Segment[]; right: Segment[] }
```

**Mode Behaviors:**
- `'full'`: Always use full labels
- `'abbreviated'`: Always use abbreviated labels
- `'auto'`: Use abbreviated labels when terminal width < 80 (narrow mode)

### 4. Implementation Strategy

#### 4.1 Segment Creation with Both Labels

When creating segments, populate both `label` and `abbreviatedLabel`:

```typescript
// Example: tokens segment
right.push({
  label: 'tokens:',
  abbreviatedLabel: 'tok:',
  labelColor: 'gray',
  value: formatTokens(props.tokens.input, props.tokens.output),
  valueColor: 'cyan',
  minWidth: 14,
});

// Example: cost segment
right.push({
  label: 'cost:',
  abbreviatedLabel: '$',
  labelColor: 'gray',
  value: `$${props.cost.toFixed(4)}`,
  valueColor: 'green',
  minWidth: 12,
});
```

#### 4.2 Label Selection Logic

Add a helper function to select the appropriate label:

```typescript
function getEffectiveLabel(
  segment: Segment,
  abbreviationMode: AbbreviationMode,
  terminalWidth: number
): string | undefined {
  if (!segment.label) return undefined;

  const useAbbreviated =
    abbreviationMode === 'abbreviated' ||
    (abbreviationMode === 'auto' && terminalWidth < 80);

  if (useAbbreviated && segment.abbreviatedLabel) {
    return segment.abbreviatedLabel;
  }

  return segment.label;
}
```

#### 4.3 Updated Render Logic

Modify the StatusBar render to use effective labels:

```typescript
// In StatusBar component render:
{segments.right.map((seg, i) => {
  const effectiveLabel = getEffectiveLabel(seg, abbreviationMode, terminalWidth);
  return (
    <Text key={i}>
      {effectiveLabel && <Text color={seg.labelColor || 'gray'}>{effectiveLabel}</Text>}
      <Text color={seg.valueColor}>{seg.value}</Text>
    </Text>
  );
})}
```

### 5. Detailed Segment Definitions

All segments that should have abbreviated labels:

| Segment | Full Label | Abbreviated Label | Notes |
|---------|------------|-------------------|-------|
| Tokens | `tokens:` | `tok:` | Right side |
| Cost | `cost:` | `$` | Just symbol, value already has $ |
| Model | `model:` | `mod:` | Right side |
| Active Time | `active:` | `act:` | Verbose mode |
| Idle Time | `idle:` | `idl:` | Verbose mode |
| Stage Time | `stage:` | `stg:` | Verbose mode |
| Session Cost | `session:` | `sess:` | Verbose mode |
| Total Tokens | `total:` | `tot:` | Verbose mode |
| API URL | `api:` | `api:` | No change (already short) |
| Web URL | `web:` | `web:` | No change (already short) |

### 6. MinWidth Adjustments

Update `minWidth` calculations to account for abbreviated labels:

```typescript
// Calculate minWidth dynamically based on mode
function calculateMinWidth(
  segment: Segment,
  useAbbreviated: boolean
): number {
  const labelLength = useAbbreviated
    ? (segment.abbreviatedLabel?.length ?? segment.label?.length ?? 0)
    : (segment.label?.length ?? 0);

  const valueLength = segment.value.length;
  const iconLength = segment.icon ? segment.icon.length + 1 : 0;

  return labelLength + valueLength + iconLength;
}
```

### 7. Integration with Display Modes

The abbreviation system works alongside existing display modes:

| Display Mode | Abbreviation Mode |
|--------------|-------------------|
| `compact` | Always `abbreviated` (maximize space savings) |
| `normal` | `auto` (based on terminal width) |
| `verbose` | `full` (clarity is more important) |

```typescript
// In buildSegments:
const effectiveAbbreviationMode =
  props.displayMode === 'compact' ? 'abbreviated' :
  props.displayMode === 'verbose' ? 'full' :
  abbreviationMode;
```

## File Changes

| File | Change |
|------|--------|
| `packages/cli/src/ui/components/StatusBar.tsx` | Add `abbreviatedLabel` to interface, update `buildSegments`, add helper functions |
| `packages/cli/src/ui/components/__tests__/StatusBar.test.tsx` | Add tests for abbreviated labels |
| `packages/cli/src/ui/components/__tests__/StatusBar.abbreviated.test.tsx` | NEW: Comprehensive abbreviated label tests |

## Implementation Plan

### Phase 1: Interface & Types (Developer)
1. Add `abbreviatedLabel` to `Segment` interface
2. Add `AbbreviationMode` type
3. Add `ABBREVIATED_LABELS` constant

### Phase 2: Build Logic (Developer)
1. Update all segment creation to include `abbreviatedLabel`
2. Add `getEffectiveLabel` helper function
3. Update `buildSegments` signature with `abbreviationMode` parameter
4. Integrate abbreviation mode with display mode logic

### Phase 3: Render Updates (Developer)
1. Update StatusBar render to use effective labels
2. Update minWidth calculations

### Phase 4: Testing (Tester)
1. Unit tests for each abbreviated label
2. Integration tests for mode interactions
3. Visual verification at different terminal widths

## Testing Requirements

### Unit Tests

```typescript
describe('StatusBar - Abbreviated Labels', () => {
  describe('Segment interface', () => {
    it('accepts abbreviatedLabel as optional property');
  });

  describe('buildSegments with abbreviation mode', () => {
    it('uses full labels when mode is "full"');
    it('uses abbreviated labels when mode is "abbreviated"');
    it('uses abbreviated labels in auto mode when width < 80');
    it('uses full labels in auto mode when width >= 80');
  });

  describe('Label abbreviations', () => {
    it('abbreviates "tokens:" to "tok:"');
    it('abbreviates "cost:" to "$"');
    it('abbreviates "model:" to "mod:"');
    it('abbreviates "active:" to "act:"');
    it('abbreviates "idle:" to "idl:"');
    it('abbreviates "stage:" to "stg:"');
    it('abbreviates "session:" to "sess:"');
    it('abbreviates "total:" to "tot:"');
  });

  describe('Display mode integration', () => {
    it('uses abbreviated labels in compact mode');
    it('uses full labels in verbose mode');
    it('respects abbreviationMode in normal mode');
  });

  describe('MinWidth calculations', () => {
    it('calculates correct minWidth for full labels');
    it('calculates correct minWidth for abbreviated labels');
  });
});
```

### Visual Verification

Verify at these terminal widths:
- 60 columns (narrow): All labels abbreviated
- 80 columns (boundary): Labels switch to full
- 120 columns (wide): Full labels with all segments

## Consequences

### Positive
- More efficient use of horizontal space in narrow terminals
- Consistent abbreviation strategy across all segments
- Clean interface extension (backward compatible)
- Display mode integration provides sensible defaults

### Negative
- Slightly increased complexity in segment building
- More test coverage required
- Users need to learn abbreviations (though they're intuitive)

### Risks
- **Abbreviation clarity**: Some abbreviations might be confusing
  - Mitigation: Use common, intuitive abbreviations
  - Mitigation: Full labels shown on hover in future UI enhancement

- **Cost label special case**: `$` abbreviation for `cost:` but value already has `$`
  - Decision: When abbreviated, show just `$0.1234` (no `cost:` prefix)
  - When full, show `cost:$0.1234`

## Alternatives Considered

### 1. Icon-only Mode
Use icons instead of labels entirely (e.g., 💰 for cost, 🔤 for tokens)
- **Rejected**: Icons less readable in terminals, not all terminals support emoji well

### 2. Automatic Truncation
Automatically truncate labels based on width (e.g., `tokens:` -> `tok...`)
- **Rejected**: Inconsistent appearance, truncation is not as clean as defined abbreviations

### 3. Segment Priority Hiding
Hide low-priority segments instead of abbreviating
- **Rejected**: This is complementary (we already do this), abbreviation adds another level of space optimization

## Related Documents

- `ADR-responsive-statusbar.md` - Parent responsive design architecture
- `ADR-020-display-modes-compact-verbose.md` - Display mode system
- `packages/cli/src/ui/hooks/ADR-useStdoutDimensions.md` - Terminal width detection
