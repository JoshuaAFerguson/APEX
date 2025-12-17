# ADR: Responsive TaskProgress Component with Terminal Width Adaptation

## Status
Proposed

## Context

The `TaskProgress` component needs to be enhanced with responsive terminal width adaptation. Currently, it uses a `DisplayMode` prop (`compact`, `normal`, `verbose`) for layout changes but has hardcoded truncation values (60 for normal, 40 for compact). It does not respond to actual terminal dimensions.

### Acceptance Criteria
1. TaskProgress uses `useStdoutDimensions` hook
2. Shows compact layout in narrow terminals (< 60 cols)
3. Shows full layout in normal/wide terminals
4. Truncates description dynamically based on available width
5. Tests cover all breakpoints

### Current State

**TaskProgress.tsx** (packages/cli/src/ui/components/TaskProgress.tsx):
- Accepts `displayMode` prop ('normal' | 'compact' | 'verbose')
- Has `truncateDescription(desc, max)` with hardcoded defaults:
  - 60 characters in normal/verbose mode
  - 40 characters in compact mode
- Does NOT use `useStdoutDimensions` hook
- Has separate rendering paths for compact vs normal/verbose modes

**useStdoutDimensions hook** (packages/cli/src/ui/hooks/useStdoutDimensions.ts):
- Returns `{ width, height, breakpoint, isAvailable }`
- Breakpoints: `'narrow'` (< 60), `'normal'` (60-119), `'wide'` (>= 120)
- Configurable thresholds via options
- Already exported from hooks index

**Established Patterns** (from StatusBar.tsx, ActivityLog.tsx):
- Use `useStdoutDimensions` to get terminal dimensions
- Respect explicit props over auto-detected dimensions
- Calculate available space dynamically
- Use breakpoint for layout decisions

## Decision

### 1. Integration Strategy

The TaskProgress component will integrate `useStdoutDimensions` to enable responsive behavior based on actual terminal width, while maintaining backward compatibility with the existing `displayMode` prop.

**Key Design Principle**: Terminal width affects content density and truncation lengths; `displayMode` affects layout structure and information visibility. These are orthogonal concerns that work together:

| displayMode | Layout Structure | Info Shown |
|-------------|------------------|------------|
| compact | Single line, minimal UI | Essential only |
| normal | Multi-line with borders | Standard info |
| verbose | Full detail view | All available info |

| Breakpoint | Truncation | Width Response |
|------------|------------|----------------|
| narrow (<60) | Aggressive | Minimal spacing |
| normal (60-119) | Standard | Normal spacing |
| wide (>=120) | Generous | Extended content |

### 2. Auto-Compact Behavior

When terminal width falls below 60 columns (narrow breakpoint), the component should automatically switch to compact layout regardless of the `displayMode` prop. This ensures usability in constrained terminals:

```typescript
// Effective display mode calculation
const effectiveDisplayMode = useMemo(() => {
  if (breakpoint === 'narrow' && displayMode !== 'verbose') {
    return 'compact'; // Force compact in narrow terminals (unless verbose)
  }
  return displayMode;
}, [breakpoint, displayMode]);
```

**Rationale**: In very narrow terminals, the normal layout would cause severe overflow issues. However, if the user explicitly requests verbose mode, they likely need the detailed information and can scroll horizontally.

### 3. Dynamic Description Truncation

Calculate the maximum description length based on available terminal width and other displayed elements:

```typescript
interface TruncationConfig {
  descriptionMaxLength: number;
  taskIdLength: number;
}

const calculateTruncationConfig = (
  width: number,
  breakpoint: Breakpoint,
  effectiveDisplayMode: DisplayMode,
  hasTokens: boolean,
  hasCost: boolean,
  hasAgent: boolean
): TruncationConfig => {
  // Compact mode: single line with status, taskId, description, optional metrics
  if (effectiveDisplayMode === 'compact') {
    let reserved = 4;  // status icon + space
    reserved += 10;    // status text (max ~12 chars like "in-progress")
    reserved += 10;    // task ID (8 chars + space)
    if (hasAgent) reserved += 15;    // agent with icon "⚡developer"
    if (hasTokens) reserved += 10;   // "2.3ktk"
    if (hasCost) reserved += 10;     // "$0.0000"
    reserved += 6;     // gaps between elements

    return {
      descriptionMaxLength: Math.max(15, width - reserved),
      taskIdLength: 8,
    };
  }

  // Normal/Verbose mode: multi-line layout
  // Description is on its own line with left margin
  const descriptionLineWidth = width - 6; // borders + padding + margin

  return {
    descriptionMaxLength: breakpoint === 'wide'
      ? Math.min(120, descriptionLineWidth)  // Cap at 120 for readability
      : breakpoint === 'narrow'
        ? Math.max(30, descriptionLineWidth)
        : Math.max(50, descriptionLineWidth),
    taskIdLength: breakpoint === 'narrow' ? 8 : 12,
  };
};
```

### 4. Subtask Display Limits (Responsive)

Adjust the number of visible subtasks based on terminal height and display mode:

```typescript
const getSubtaskLimit = (
  height: number,
  displayMode: DisplayMode,
  breakpoint: Breakpoint
): number => {
  if (displayMode === 'verbose') {
    // Verbose: show more, but cap based on height
    return Math.max(3, Math.min(15, Math.floor(height / 3)));
  }

  if (displayMode === 'compact' || breakpoint === 'narrow') {
    return 0; // No subtasks in compact/narrow mode
  }

  // Normal mode
  return Math.max(2, Math.min(5, Math.floor(height / 4)));
};
```

### 5. Props Interface Update

Maintain backward compatibility while allowing explicit width override:

```typescript
export interface TaskProgressProps {
  taskId: string;
  description: string;
  status: string;
  workflow?: string;
  currentStage?: string;
  agent?: string;
  subtasks?: SubtaskInfo[];
  tokens?: { input: number; output: number };
  cost?: number;
  displayMode?: DisplayMode;
  // NEW: Optional explicit width (for testing or fixed-width containers)
  width?: number;
}
```

### 6. Component Architecture

```typescript
export function TaskProgress({
  taskId,
  description,
  status,
  workflow,
  currentStage,
  agent,
  subtasks,
  tokens,
  cost,
  displayMode = 'normal',
  width: explicitWidth,
}: TaskProgressProps): React.ReactElement {
  // 1. Get terminal dimensions
  const {
    width: terminalWidth,
    height: terminalHeight,
    breakpoint
  } = useStdoutDimensions();

  // 2. Use explicit width if provided, otherwise use terminal width
  const width = explicitWidth ?? terminalWidth;

  // 3. Calculate effective display mode (auto-compact for narrow)
  const effectiveDisplayMode = useMemo(() => {
    if (breakpoint === 'narrow' && displayMode !== 'verbose') {
      return 'compact';
    }
    return displayMode;
  }, [breakpoint, displayMode]);

  // 4. Calculate truncation config
  const truncationConfig = useMemo(() =>
    calculateTruncationConfig(
      width,
      breakpoint,
      effectiveDisplayMode,
      !!tokens,
      cost !== undefined,
      !!agent
    ),
    [width, breakpoint, effectiveDisplayMode, tokens, cost, agent]
  );

  // 5. Calculate subtask limit
  const subtaskLimit = useMemo(() =>
    getSubtaskLimit(terminalHeight, effectiveDisplayMode, breakpoint),
    [terminalHeight, effectiveDisplayMode, breakpoint]
  );

  // 6. Render based on effective display mode
  // ... existing render logic with dynamic truncation
}
```

### 7. Responsive Width for Box Container (Normal/Verbose Mode)

In normal/verbose mode, the outer Box should adapt to terminal width:

```typescript
// Normal and verbose mode: full display
return (
  <Box
    flexDirection="column"
    borderStyle="round"
    borderColor="gray"
    paddingX={1}
    paddingY={0}
    width={Math.min(width, 120)} // Cap at 120 for readability
  >
    {/* ... content ... */}
  </Box>
);
```

### 8. File Structure

```
packages/cli/src/ui/components/
├── TaskProgress.tsx              # Update with useStdoutDimensions
├── ADR-responsive-taskprogress.md # This document
└── __tests__/
    ├── TaskProgress.compact-mode.test.tsx      # Existing
    └── TaskProgress.responsive.test.tsx        # NEW: Responsive tests
```

### 9. Testing Strategy

Create a new test file `TaskProgress.responsive.test.tsx` covering:

```typescript
describe('TaskProgress - Responsive Behavior', () => {
  describe('Breakpoint: narrow (<60 cols)', () => {
    it('should auto-switch to compact layout when displayMode=normal');
    it('should stay verbose when displayMode=verbose even in narrow');
    it('should truncate description aggressively (15-30 chars)');
    it('should show 8-char task ID');
    it('should hide subtasks');
  });

  describe('Breakpoint: normal (60-119 cols)', () => {
    it('should use normal layout when displayMode=normal');
    it('should truncate description to available width');
    it('should show 12-char task ID');
    it('should show limited subtasks');
  });

  describe('Breakpoint: wide (>=120 cols)', () => {
    it('should use full layout with generous truncation');
    it('should show more subtasks in verbose mode');
    it('should cap description at 120 chars for readability');
  });

  describe('Explicit width override', () => {
    it('should use explicit width prop over terminal width');
    it('should calculate truncation based on explicit width');
  });

  describe('Dynamic content adaptation', () => {
    it('should recalculate on terminal resize');
    it('should adjust description truncation when metrics present');
    it('should adjust description truncation when no metrics');
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
    isAvailable: true,
  })),
}));

// Change breakpoint in tests:
const mockHook = useStdoutDimensions as Mock;
mockHook.mockReturnValue({
  width: 120,
  height: 30,
  breakpoint: 'wide' as const,
  isAvailable: true,
});
```

## Implementation Plan

### Phase 1: Core Integration (Priority: High)
1. Import `useStdoutDimensions` hook
2. Add `width` optional prop
3. Implement `effectiveDisplayMode` calculation (auto-compact for narrow)
4. Update `truncateDescription` to use calculated max length

### Phase 2: Dynamic Truncation (Priority: High)
1. Implement `calculateTruncationConfig` function
2. Update compact mode rendering with dynamic truncation
3. Update normal/verbose mode description truncation
4. Add responsive task ID truncation (8 vs 12 chars)

### Phase 3: Layout Enhancements (Priority: Medium)
1. Add responsive Box width in normal/verbose mode
2. Implement `getSubtaskLimit` for responsive subtask display
3. Adjust spacing/margins based on breakpoint

### Phase 4: Testing (Priority: High)
1. Create `TaskProgress.responsive.test.tsx`
2. Test all three breakpoints (narrow, normal, wide)
3. Test explicit width override
4. Test auto-compact behavior
5. Test edge cases (very narrow, very wide, missing props)

## Consequences

### Positive
- Component automatically adapts to terminal width
- Better UX in narrow terminals (no content overflow)
- Backward compatible - existing displayMode prop still works
- Consistent with established patterns (StatusBar, ActivityLog)
- Dynamic truncation provides optimal information density

### Negative
- Slightly increased complexity with useMemo calculations
- Tests require mocking useStdoutDimensions
- Minor performance overhead from resize detection

### Neutral
- Auto-compact behavior might surprise users (but prevents broken UI)
- Follows established responsive patterns in the codebase

## API Examples

```tsx
// Auto-responsive (recommended)
<TaskProgress
  taskId="task-abc123"
  description="Implement new feature for user management"
  status="in-progress"
/>

// With explicit display mode (still adapts to width for truncation)
<TaskProgress
  taskId="task-abc123"
  description="Implement new feature for user management"
  status="in-progress"
  displayMode="verbose"
/>

// Explicit width override (for testing or fixed containers)
<TaskProgress
  taskId="task-abc123"
  description="Implement new feature for user management"
  status="in-progress"
  width={80}
/>
```

### Behavior Matrix

| Terminal Width | displayMode | Effective Mode | Description Max | Subtasks Shown |
|----------------|-------------|----------------|-----------------|----------------|
| 50 (narrow)    | normal      | compact        | ~25 chars       | 0              |
| 50 (narrow)    | verbose     | verbose        | ~40 chars       | 3              |
| 80 (normal)    | normal      | normal         | ~70 chars       | 3-5            |
| 80 (normal)    | compact     | compact        | ~40 chars       | 0              |
| 120+ (wide)    | normal      | normal         | ~100 chars      | 5              |
| 120+ (wide)    | verbose     | verbose        | ~100 chars      | 10+            |

## Dependencies

- `useStdoutDimensions` hook (already exists at `packages/cli/src/ui/hooks/useStdoutDimensions.ts`)
- No new external dependencies required

## Related Documents

- `ADR-useStdoutDimensions.md` - Hook architecture and usage
- `ADR-responsive-activitylog-errordisplay.md` - Similar responsive pattern
