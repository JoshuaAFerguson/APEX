# ADR: Responsive ActivityLog and ErrorDisplay Components

## Status
Proposed

## Context

The `ActivityLog` and `ErrorDisplay` components currently use hardcoded or prop-based widths rather than responding dynamically to terminal size changes. This task updates both components to:

1. Use the existing `useStdoutDimensions` hook for terminal-aware responsiveness
2. Implement intelligent truncation/wrapping for log entries and error messages in narrow terminals
3. Abbreviate timestamps in narrow mode to conserve horizontal space

### Current State

**ActivityLog.tsx** (lines 57-68):
- Accepts `width` and `height` props with defaults of 80 and 20
- Contains 3 sub-components: `ActivityLog`, `LogStream`, `CompactLog`
- `CompactLog` already has hardcoded truncation at 60 characters (line 331)
- Uses `formatTimestamp()` that always returns full `HH:MM:SS` format

**ErrorDisplay.tsx** (lines 27-37):
- Accepts `width` prop with default of 80
- Contains 3 sub-components: `ErrorDisplay`, `ErrorSummary`, `ValidationError`
- `ErrorSummary` truncates messages at 60 characters (line 292)
- Uses `toLocaleTimeString()` for timestamps

**useStdoutDimensions hook** (packages/cli/src/ui/hooks/useStdoutDimensions.ts):
- Returns `{ width, height, breakpoint, isAvailable }`
- Breakpoints: `'narrow'` (< 60), `'normal'` (60-119), `'wide'` (>= 120)
- Already exported from `packages/cli/src/ui/hooks/index.ts`

## Decision

### 1. Integration Pattern

Both components will optionally use `useStdoutDimensions` internally while maintaining backward compatibility with explicit `width` props:

```typescript
// Pattern for responsive integration
function ResponsiveComponent({ width: explicitWidth, ...props }) {
  const { width: terminalWidth, breakpoint } = useStdoutDimensions();
  const width = explicitWidth ?? terminalWidth;
  const isNarrow = breakpoint === 'narrow';

  // Use width and isNarrow for responsive rendering
}
```

### 2. Timestamp Abbreviation Strategy

| Breakpoint | Format | Example | Character Width |
|------------|--------|---------|-----------------|
| narrow     | `HH:MM` | `10:30` | 5 chars |
| normal/wide | `HH:MM:SS` | `10:30:45` | 8 chars |

Implementation:
```typescript
const formatTimestamp = (date: Date, abbreviated: boolean): string => {
  if (abbreviated) {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};
```

### 3. Message Truncation Strategy

Dynamic truncation based on available space:

```typescript
const calculateMessageMaxLength = (
  totalWidth: number,
  hasTimestamp: boolean,
  hasAgent: boolean,
  hasIcon: boolean,
  isNarrow: boolean
): number => {
  // Reserve space for UI elements
  let reserved = 4; // borders and padding
  if (hasIcon) reserved += 3; // icon + space
  if (hasTimestamp) reserved += isNarrow ? 8 : 12; // [HH:MM] or [HH:MM:SS] + brackets + space
  if (hasAgent) reserved += 12; // average agent name [developer]

  return Math.max(20, totalWidth - reserved);
};

const truncateMessage = (message: string, maxLength: number): string => {
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength - 3) + '...';
};
```

### 4. Component-Specific Changes

#### 4.1 ActivityLog Component

**Changes:**
1. Import `useStdoutDimensions` from hooks
2. Calculate effective width using `explicitWidth ?? terminalWidth`
3. Pass `isNarrow` (derived from breakpoint) to `formatTimestamp`
4. Calculate dynamic truncation length based on width
5. Update all sub-components: `ActivityLog`, `LogStream`, `CompactLog`

**Props changes:** None - maintain backward compatibility. Components will auto-detect terminal size when `width` prop is not provided.

**New internal utility:**
```typescript
interface ResponsiveConfig {
  messageMaxLength: number;
  abbreviateTimestamp: boolean;
  showIcons: boolean;
}

const getResponsiveConfig = (
  width: number,
  breakpoint: Breakpoint,
  options: { hasTimestamp: boolean; hasAgent: boolean; hasIcon: boolean }
): ResponsiveConfig => {
  const isNarrow = breakpoint === 'narrow';
  return {
    messageMaxLength: calculateMessageMaxLength(width, options.hasTimestamp, options.hasAgent, options.hasIcon, isNarrow),
    abbreviateTimestamp: isNarrow,
    showIcons: !isNarrow || width >= 40, // Hide icons only in extremely narrow terminals
  };
};
```

#### 4.2 ErrorDisplay Component

**Changes:**
1. Import `useStdoutDimensions` from hooks
2. Use responsive width for Box container
3. Implement responsive message wrapping for error messages
4. Abbreviate timestamps in `ErrorSummary` when narrow
5. Truncate suggestion descriptions in narrow mode

**ErrorSummary specific:**
- Use dynamic truncation length based on width
- Abbreviate timestamps: `[HH:MM]` in narrow, `[HH:MM:SS]` in normal/wide

**ValidationError:** No changes needed (already compact)

### 5. File Structure

```
packages/cli/src/ui/components/
├── ActivityLog.tsx          # Add useStdoutDimensions, responsive formatting
├── ErrorDisplay.tsx         # Add useStdoutDimensions, responsive formatting
└── __tests__/
    ├── ActivityLog.test.tsx # Add responsive behavior tests
    └── ErrorDisplay.test.tsx # Add responsive behavior tests
```

### 6. Testing Strategy

Add new test cases for responsive behavior:

```typescript
// Mock for useStdoutDimensions
vi.mock('../../hooks/useStdoutDimensions', () => ({
  useStdoutDimensions: vi.fn(() => ({
    width: 50,
    height: 24,
    breakpoint: 'narrow',
    isAvailable: true,
  })),
}));

// Test cases:
// 1. Timestamps abbreviated in narrow mode
// 2. Messages truncated appropriately for width
// 3. Explicit width prop overrides terminal width
// 4. Wide mode shows full content
```

## Implementation Plan

### Phase 1: Utility Functions
1. Create shared responsive utilities (can be in a new file or inline)
2. Implement `formatTimestamp(date, abbreviated)`
3. Implement `calculateMessageMaxLength()` and `truncateMessage()`

### Phase 2: ActivityLog Updates
1. Add `useStdoutDimensions` import
2. Update `ActivityLog` component with responsive logic
3. Update `LogStream` component with responsive logic
4. Update `CompactLog` component (already has truncation, just make it dynamic)
5. Add tests for responsive behavior

### Phase 3: ErrorDisplay Updates
1. Add `useStdoutDimensions` import
2. Update `ErrorDisplay` component with responsive width
3. Update `ErrorSummary` component with responsive timestamps and truncation
4. Add tests for responsive behavior

## Consequences

### Positive
- Components automatically adapt to terminal width
- Better UX in narrow terminals (no content overflow)
- Backward compatible - explicit width props still work
- Consistent responsive behavior across components
- Leverages existing, well-tested `useStdoutDimensions` hook

### Negative
- Slight increase in component complexity
- Tests need to mock `useStdoutDimensions`
- Minor bundle size increase from hook integration

### Neutral
- Follows established patterns from hook examples
- Aligns with existing breakpoint definitions

## API Examples

```tsx
// Auto-responsive (recommended)
<ActivityLog entries={entries} />
<ErrorDisplay error={error} />

// Explicit width (backward compatible)
<ActivityLog entries={entries} width={100} />
<ErrorDisplay error={error} width={80} />

// In narrow terminal (< 60 cols):
// - Timestamps show as [10:30] instead of [10:30:45]
// - Messages truncated to fit available space
// - All content visible without horizontal overflow
```

## Dependencies

- `useStdoutDimensions` hook (already exists at `packages/cli/src/ui/hooks/useStdoutDimensions.ts`)
- No new external dependencies required
