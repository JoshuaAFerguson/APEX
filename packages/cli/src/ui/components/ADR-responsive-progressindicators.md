# ADR: Responsive ProgressIndicators with Terminal Width Adaptation

## Status
Proposed

## Context

The `ProgressIndicators.tsx` component exports multiple progress-related components that need to be enhanced with responsive terminal width adaptation. This task addresses three specific acceptance criteria:

1. **ProgressBar width adapts to terminal** - Currently uses fixed `width` prop (default: 40)
2. **SpinnerWithText abbreviates text in narrow mode** - Requires new component or enhancement to LoadingSpinner
3. **Percentage indicators remain visible at all widths** - Must ensure percentage is never truncated

### Current State

**ProgressIndicators.tsx** contains these components:

| Component | Current Width Behavior | Needs Update |
|-----------|----------------------|--------------|
| `ProgressBar` | Fixed `width` prop (default: 40) | YES |
| `CircularProgress` | Fixed character width | NO (already compact) |
| `LoadingSpinner` | No text truncation | YES (add text abbreviation) |
| `StepProgress` | Fixed step width (6 chars) | YES (optional) |
| `TaskProgress` | Fixed progress bar width (50) | YES |
| `MultiTaskProgress` | Fixed progress bar width (60) | YES |

**useStdoutDimensions hook** available at `packages/cli/src/ui/hooks/useStdoutDimensions.ts`:
- Returns `{ width, height, breakpoint, isNarrow, isCompact, isNormal, isWide, isAvailable }`
- Breakpoints: `narrow` (<60), `compact` (60-99), `normal` (100-159), `wide` (>=160)

### Established Patterns
From StatusBar.tsx, TaskProgress.tsx, ActivityLog.tsx:
- Use `useStdoutDimensions` to get terminal dimensions
- Respect explicit props over auto-detected dimensions
- Use `useMemo` for responsive calculations
- Provide explicit width override for testing

## Decision

### 1. ProgressBar Responsive Enhancement

#### 1.1 New Props Interface

```typescript
export interface ProgressBarProps {
  progress: number; // 0-100
  width?: number;   // Explicit width (overrides auto)
  showPercentage?: boolean;
  label?: string;
  color?: string;
  backgroundColor?: string;
  animated?: boolean;
  // NEW: Responsive options
  responsive?: boolean;          // Enable auto-width (default: true)
  minWidth?: number;             // Minimum bar width (default: 10)
  maxWidth?: number;             // Maximum bar width (default: 80)
  reservedSpace?: number;        // Space for label + percentage (default: auto-calculated)
}
```

#### 1.2 Width Calculation Strategy

```typescript
const calculateProgressBarWidth = (
  terminalWidth: number,
  breakpoint: Breakpoint,
  options: {
    explicitWidth?: number;
    responsive: boolean;
    minWidth: number;
    maxWidth: number;
    reservedSpace: number;
    showPercentage: boolean;
    hasLabel: boolean;
  }
): number => {
  // Explicit width always wins
  if (options.explicitWidth !== undefined) {
    return options.explicitWidth;
  }

  // Non-responsive mode uses default
  if (!options.responsive) {
    return 40;
  }

  // Calculate available width
  let reserved = options.reservedSpace;
  if (reserved === 0) {
    // Auto-calculate reserved space
    reserved = 2; // Minimum padding
    if (options.showPercentage) {
      reserved += 5; // " 100%"
    }
    if (options.hasLabel) {
      // Label is on separate line in column layout, no reservation needed
      reserved += 0;
    }
  }

  const availableWidth = terminalWidth - reserved;

  // Breakpoint-aware sizing
  let targetWidth: number;
  switch (breakpoint) {
    case 'narrow':
      targetWidth = Math.floor(availableWidth * 0.9); // Use 90% in narrow
      break;
    case 'compact':
      targetWidth = Math.floor(availableWidth * 0.7); // Use 70% in compact
      break;
    case 'normal':
      targetWidth = Math.floor(availableWidth * 0.5); // Use 50% in normal
      break;
    case 'wide':
      targetWidth = Math.floor(availableWidth * 0.4); // Use 40% in wide (cap it)
      break;
  }

  // Apply constraints
  return Math.max(options.minWidth, Math.min(options.maxWidth, targetWidth));
};
```

#### 1.3 Percentage Visibility Guarantee

**Critical Requirement**: Percentage must ALWAYS be visible when `showPercentage=true`.

```typescript
// In ProgressBar render:
const percentageText = ` ${Math.round(clampedProgress)}%`;
const percentageWidth = percentageText.length; // 4-5 chars (" 0%" to " 100%")

// Ensure bar width leaves room for percentage
const effectiveBarWidth = showPercentage
  ? Math.min(barWidth, terminalWidth - percentageWidth - 1)
  : barWidth;

// Render: bar is rendered first, percentage always fits
return (
  <Box flexDirection="column">
    {label && <Text>{truncatedLabel}</Text>}
    <Box>
      <Text color={color}>{filled}</Text>
      <Text color={backgroundColor}>{empty}</Text>
      {showPercentage && (
        <Text color="gray">{percentageText}</Text>
      )}
    </Box>
  </Box>
);
```

### 2. SpinnerWithText Component (New)

Create a new component that wraps `LoadingSpinner` with text abbreviation support:

#### 2.1 Interface

```typescript
export interface SpinnerWithTextProps {
  type?: 'dots' | 'line' | 'pipe' | 'star' | 'flip' | 'hamburger' | 'growVertical';
  text: string;
  color?: string;
  textColor?: string;
  // Responsive options
  responsive?: boolean;          // Enable responsive text (default: true)
  abbreviatedText?: string;      // Explicit abbreviation for narrow mode
  maxTextLength?: number;        // Max text length before truncation
  minTextLength?: number;        // Minimum text length (default: 10)
}
```

#### 2.2 Text Abbreviation Strategy

```typescript
const calculateTextConfig = (
  terminalWidth: number,
  breakpoint: Breakpoint,
  text: string,
  options: {
    responsive: boolean;
    abbreviatedText?: string;
    maxTextLength?: number;
    minTextLength: number;
  }
): { displayText: string; truncated: boolean } => {
  if (!options.responsive) {
    return { displayText: text, truncated: false };
  }

  // Spinner takes ~2 chars, plus space
  const reservedForSpinner = 3;
  const availableForText = terminalWidth - reservedForSpinner;

  // In narrow mode, use abbreviation if provided
  if (breakpoint === 'narrow' && options.abbreviatedText) {
    return { displayText: options.abbreviatedText, truncated: true };
  }

  // Calculate max text length based on breakpoint
  const maxLength = options.maxTextLength ?? (
    breakpoint === 'narrow' ? Math.min(20, availableForText) :
    breakpoint === 'compact' ? Math.min(40, availableForText) :
    Math.min(60, availableForText)
  );

  if (text.length <= maxLength) {
    return { displayText: text, truncated: false };
  }

  // Truncate with ellipsis
  const truncatedLength = Math.max(options.minTextLength, maxLength - 3);
  return {
    displayText: text.slice(0, truncatedLength) + '...',
    truncated: true,
  };
};
```

#### 2.3 Abbreviation Examples

| Full Text | Abbreviation | Narrow Display |
|-----------|--------------|----------------|
| "Installing dependencies..." | "Installing..." | "Installing..." |
| "Building production bundle" | "Building..." | "Building..." |
| "Running type checks" | "Type checking" | "Type checking" |

### 3. LoadingSpinner Enhancement

Update existing `LoadingSpinner` with optional text truncation:

```typescript
export interface LoadingSpinnerProps {
  type?: 'dots' | 'line' | 'pipe' | 'star' | 'flip' | 'hamburger' | 'growVertical';
  text?: string;
  color?: string;
  // NEW: Responsive options
  responsive?: boolean;          // Enable responsive text (default: false for backward compat)
  maxTextLength?: number;        // Max text length before truncation
}
```

### 4. TaskProgress and MultiTaskProgress Updates

Both components use internal `ProgressBar`. Update to pass responsive configuration:

```typescript
// In TaskProgress component
const { width, breakpoint } = useStdoutDimensions();

// Calculate progress bar width based on container
const progressBarWidth = useMemo(() => {
  if (breakpoint === 'narrow') return Math.max(15, width - 20);
  if (breakpoint === 'compact') return Math.max(25, width - 30);
  return Math.min(50, width - 40);
}, [width, breakpoint]);

// In render
<ProgressBar
  progress={progress}
  width={progressBarWidth}
  showPercentage={true}  // Always show percentage
  animated={true}
/>
```

### 5. StepProgress Responsive Enhancement (Optional)

Adjust step name truncation based on terminal width:

```typescript
const getStepNameMaxLength = (
  terminalWidth: number,
  breakpoint: Breakpoint,
  stepCount: number,
  orientation: 'horizontal' | 'vertical'
): number => {
  if (orientation === 'vertical') {
    // Vertical has full width per step
    return Math.max(15, terminalWidth - 10);
  }

  // Horizontal divides width among steps
  const perStepWidth = Math.floor((terminalWidth - stepCount * 3) / stepCount);
  return Math.max(4, perStepWidth);
};
```

### 6. Component Architecture

```typescript
// ProgressBar with responsive support
export function ProgressBar({
  progress,
  width: explicitWidth,
  showPercentage = true,
  label,
  color = 'cyan',
  backgroundColor = 'gray',
  animated = false,
  responsive = true,
  minWidth = 10,
  maxWidth = 80,
  reservedSpace = 0,
}: ProgressBarProps): React.ReactElement {
  // 1. Get terminal dimensions
  const { width: terminalWidth, breakpoint } = useStdoutDimensions();

  // 2. Calculate effective width
  const barWidth = useMemo(() =>
    calculateProgressBarWidth(terminalWidth, breakpoint, {
      explicitWidth,
      responsive,
      minWidth,
      maxWidth,
      reservedSpace,
      showPercentage,
      hasLabel: !!label,
    }),
    [terminalWidth, breakpoint, explicitWidth, responsive, minWidth, maxWidth, reservedSpace, showPercentage, label]
  );

  // 3. Animation state (existing logic)
  const [animatedProgress, setAnimatedProgress] = useState(0);
  // ... existing animation effect ...

  // 4. Calculate bar characters
  const clampedProgress = Math.max(0, Math.min(100, animatedProgress));
  const filledWidth = Math.floor((clampedProgress / 100) * barWidth);
  const emptyWidth = barWidth - filledWidth;

  const filled = '\u2588'.repeat(filledWidth);  // █
  const empty = '\u2591'.repeat(emptyWidth);    // ░

  // 5. Render with guaranteed percentage visibility
  return (
    <Box flexDirection="column">
      {label && <Text>{label}</Text>}
      <Box>
        <Text color={color}>{filled}</Text>
        <Text color={backgroundColor}>{empty}</Text>
        {showPercentage && (
          <Text color="gray"> {Math.round(clampedProgress)}%</Text>
        )}
      </Box>
    </Box>
  );
}
```

### 7. Breakpoint Behavior Matrix

#### ProgressBar

| Breakpoint | Default Width | Width Range | Notes |
|------------|---------------|-------------|-------|
| narrow (<60) | 90% of available | 10-52 | Maximum usage of narrow space |
| compact (60-99) | 70% of available | 10-65 | Balanced with other content |
| normal (100-159) | 50% of available | 10-75 | Leave room for labels |
| wide (>=160) | 40% of available | 10-80 | Cap at 80 for readability |

#### SpinnerWithText

| Breakpoint | Text Behavior | Max Length |
|------------|---------------|------------|
| narrow | Use abbreviation or truncate | 15-20 chars |
| compact | Light truncation | 30-40 chars |
| normal | Full text or truncate long | 50-60 chars |
| wide | Full text | 60+ chars |

### 8. File Structure

```
packages/cli/src/ui/components/
├── ProgressIndicators.tsx              # UPDATE with responsive support
├── ADR-responsive-progressindicators.md # This document
└── __tests__/
    ├── ProgressIndicators.test.tsx     # Existing tests
    └── ProgressIndicators.responsive.test.tsx  # NEW: Responsive tests
```

### 9. Testing Strategy

```typescript
describe('ProgressIndicators - Responsive Behavior', () => {
  describe('ProgressBar', () => {
    describe('Breakpoint: narrow (<60 cols)', () => {
      it('should use 90% of available width');
      it('should respect minWidth constraint');
      it('should always show percentage when showPercentage=true');
      it('should not truncate percentage display');
    });

    describe('Breakpoint: normal (100-159 cols)', () => {
      it('should use 50% of available width');
      it('should cap at maxWidth');
    });

    describe('Explicit width override', () => {
      it('should use explicit width prop over auto-calculation');
      it('should ignore responsive settings when width is explicit');
    });

    describe('responsive=false', () => {
      it('should use default width of 40');
    });
  });

  describe('SpinnerWithText', () => {
    describe('Narrow terminal', () => {
      it('should use abbreviatedText when provided');
      it('should truncate long text with ellipsis');
      it('should not truncate below minTextLength');
    });

    describe('Wide terminal', () => {
      it('should show full text');
    });
  });

  describe('LoadingSpinner', () => {
    it('should maintain backward compatibility with responsive=false');
    it('should truncate text when responsive=true');
  });

  describe('TaskProgress', () => {
    it('should pass responsive width to inner ProgressBar');
    it('should always display percentage');
  });

  describe('MultiTaskProgress', () => {
    it('should adapt overall progress bar width');
  });
});
```

**Mock Strategy:**
```typescript
vi.mock('../../hooks/useStdoutDimensions', () => ({
  useStdoutDimensions: vi.fn(() => ({
    width: 50,
    height: 24,
    breakpoint: 'narrow' as const,
    isNarrow: true,
    isCompact: false,
    isNormal: false,
    isWide: false,
    isAvailable: true,
  })),
}));
```

## Implementation Plan

### Phase 1: ProgressBar Enhancement (Priority: High)
1. Add responsive props to `ProgressBarProps`
2. Import `useStdoutDimensions` hook
3. Implement `calculateProgressBarWidth` function
4. Ensure percentage visibility is guaranteed
5. Update render logic with calculated width

### Phase 2: SpinnerWithText Component (Priority: High)
1. Define `SpinnerWithTextProps` interface
2. Implement `calculateTextConfig` function
3. Create `SpinnerWithText` component
4. Export from `ProgressIndicators.tsx`

### Phase 3: LoadingSpinner Enhancement (Priority: Medium)
1. Add optional responsive props (backward compatible)
2. Implement text truncation when `responsive=true`

### Phase 4: Container Components (Priority: Medium)
1. Update `TaskProgress` to use responsive ProgressBar
2. Update `MultiTaskProgress` to use responsive ProgressBar
3. Optional: Update `StepProgress` with responsive step names

### Phase 5: Testing (Priority: High)
1. Create `ProgressIndicators.responsive.test.tsx`
2. Test all breakpoints for each component
3. Test percentage visibility guarantee
4. Test explicit width overrides
5. Test backward compatibility

## Consequences

### Positive
- Progress bars automatically adapt to terminal width
- Better UX in narrow terminals (no overflow)
- Percentage always visible (critical acceptance criteria)
- SpinnerWithText provides meaningful abbreviations
- Backward compatible - explicit width still works
- Consistent with established patterns

### Negative
- Slightly increased complexity
- New props may require documentation updates
- Tests require mocking `useStdoutDimensions`

### Neutral
- New `SpinnerWithText` component adds to API surface
- Follows established responsive patterns in codebase

## API Examples

```tsx
// Auto-responsive ProgressBar (recommended)
<ProgressBar
  progress={75}
  showPercentage={true}
/>

// Explicit width (testing or fixed containers)
<ProgressBar
  progress={75}
  width={40}
  showPercentage={true}
/>

// Non-responsive (backward compatible)
<ProgressBar
  progress={75}
  responsive={false}
/>

// SpinnerWithText with abbreviation
<SpinnerWithText
  text="Installing dependencies..."
  abbreviatedText="Installing..."
/>

// SpinnerWithText without abbreviation (auto-truncate)
<SpinnerWithText
  text="Building production bundle for deployment"
  maxTextLength={30}
/>

// LoadingSpinner with responsive text
<LoadingSpinner
  text="Processing data files"
  responsive={true}
/>
```

## Dependencies

- `useStdoutDimensions` hook (exists at `packages/cli/src/ui/hooks/useStdoutDimensions.ts`)
- No new external dependencies required

## Related Documents

- `ADR-responsive-taskprogress.md` - Related responsive pattern for TaskProgress
- `ADR-responsive-statusbar.md` - Similar responsive segmentation patterns
- `ADR-responsive-activitylog-errordisplay.md` - Text truncation patterns
