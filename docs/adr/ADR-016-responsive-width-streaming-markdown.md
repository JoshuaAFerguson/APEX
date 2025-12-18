# ADR-016: Responsive Width for StreamingText and MarkdownRenderer

## Status
In Progress (Partially Implemented)

## Context

The APEX CLI has components that display text and markdown content (`StreamingText`, `MarkdownRenderer`) which need to adapt to terminal width to prevent horizontal overflow.

### Current State Analysis (Updated)

**StreamingText.tsx** (`packages/cli/src/ui/components/StreamingText.tsx`):
- ✅ **ALREADY IMPLEMENTED** - Uses `useStdoutDimensions` hook
- ✅ Has `responsive?: boolean` prop (default: `true`)
- ✅ Calculates `effectiveWidth = explicitWidth ?? (responsive ? Math.max(40, terminalWidth - 2) : undefined)`
- ✅ Has `formatText()` function for line wrapping
- ✅ Contains sub-components: `StreamingText`, `StreamingResponse`, `TypewriterText`
- ✅ `StreamingResponse` also uses `useStdoutDimensions` with responsive width

**MarkdownRenderer.tsx** (`packages/cli/src/ui/components/MarkdownRenderer.tsx`):
- ❌ **NEEDS UPDATE** - Has `width = 80` hardcoded default
- ❌ Does NOT use `useStdoutDimensions` hook
- ❌ `SimpleMarkdownRenderer` also has `width = 80` hardcoded default
- Uses width for `<Box width={width}>` container

**useStdoutDimensions hook** (`packages/cli/src/ui/hooks/useStdoutDimensions.ts`):
- ✅ Already implemented and exported
- Provides: `width`, `height`, `breakpoint` ('narrow' | 'compact' | 'normal' | 'wide'), `isAvailable`
- Has configurable thresholds via options
- Includes boolean helpers: `isNarrow`, `isCompact`, `isNormal`, `isWide`

## Decision

### Architecture Approach: Internal Hook Integration

Integrate `useStdoutDimensions` **inside** the components rather than requiring consumers to pass width. This provides:

1. **Better DX**: Components automatically adapt without consumer changes
2. **Consistent behavior**: All instances of these components behave responsively
3. **Fallback safety**: Hook provides fallback values when terminal dimensions unavailable
4. **Backward compatibility**: Explicit `width` prop can still override automatic behavior

### Implementation Design

#### 1. StreamingText Component Changes

```typescript
// packages/cli/src/ui/components/StreamingText.tsx

import { useStdoutDimensions } from '../hooks/index.js';

export interface StreamingTextProps {
  text: string;
  speed?: number;
  isComplete?: boolean;
  showCursor?: boolean;
  onComplete?: () => void;
  width?: number;        // Optional override - when provided, uses this instead of auto
  maxLines?: number;
  responsive?: boolean;  // NEW: Enable/disable responsive behavior (default: true)
}

export function StreamingText({
  text,
  speed = 50,
  isComplete = false,
  showCursor = true,
  onComplete,
  width: explicitWidth,    // Renamed to indicate it's an override
  maxLines,
  responsive = true,
}: StreamingTextProps): React.ReactElement {
  // Get terminal dimensions from hook
  const { width: terminalWidth } = useStdoutDimensions();

  // Use explicit width if provided, otherwise use responsive terminal width
  // Subtract 2 for padding/margin safety
  const effectiveWidth = explicitWidth ?? (responsive ? Math.max(40, terminalWidth - 2) : undefined);

  // ... rest of implementation uses effectiveWidth
}
```

#### 2. MarkdownRenderer Component Changes

```typescript
// packages/cli/src/ui/components/MarkdownRenderer.tsx

import { useStdoutDimensions } from '../hooks/index.js';

export interface MarkdownRendererProps {
  content: string;
  width?: number;         // Optional override
  responsive?: boolean;   // NEW: Enable/disable responsive (default: true)
}

export function MarkdownRenderer({
  content,
  width: explicitWidth,
  responsive = true,
}: MarkdownRendererProps): React.ReactElement {
  const { width: terminalWidth } = useStdoutDimensions();

  // Use explicit width if provided, otherwise responsive width with padding
  const effectiveWidth = explicitWidth ?? (responsive ? Math.max(40, terminalWidth - 2) : 80);

  // ... rest uses effectiveWidth
}

export function SimpleMarkdownRenderer({
  content,
  width: explicitWidth,
  responsive = true,
}: MarkdownRendererProps): React.ReactElement {
  const { width: terminalWidth } = useStdoutDimensions();
  const effectiveWidth = explicitWidth ?? (responsive ? Math.max(40, terminalWidth - 2) : 80);

  // ... rest uses effectiveWidth
}
```

#### 3. StreamingResponse Sub-component

```typescript
export function StreamingResponse({
  content,
  agent,
  isStreaming = false,
  isComplete = false,
  onComplete,
  width: explicitWidth,
  responsive = true,  // NEW
}: StreamingResponseProps): React.ReactElement {
  const { width: terminalWidth } = useStdoutDimensions();
  const effectiveWidth = explicitWidth ?? (responsive ? Math.max(40, terminalWidth - 2) : 80);

  // Pass effectiveWidth to child StreamingText
}
```

### Width Calculation Strategy

```
Terminal Width → Hook → Component → Effective Width
       ↓
   [padding safety buffer of 2 chars]
       ↓
   [minimum width floor of 40 chars]
       ↓
   Effective Width for text wrapping
```

**Why 40 character minimum?**
- Prevents extremely narrow text that's unreadable
- Most content remains legible at 40+ columns
- Aligns with narrow breakpoint threshold (60) with some flexibility

**Why 2 character padding?**
- Accounts for Box borders and padding in parent components
- Prevents text from touching terminal edges
- Provides visual breathing room

### Breakpoint-Aware Behavior (Optional Enhancement)

For more sophisticated adaptation, components could adjust behavior based on breakpoint:

```typescript
const { width: terminalWidth, breakpoint } = useStdoutDimensions();

// In narrow terminals, could:
// - Disable certain formatting
// - Show abbreviated content
// - Use single-line mode

const effectiveWidth = explicitWidth ?? (responsive
  ? Math.max(40, terminalWidth - (breakpoint === 'narrow' ? 1 : 2))
  : 80
);
```

### Props Interface Summary

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | `number \| undefined` | undefined | Override auto width |
| `responsive` | `boolean` | `true` | Enable responsive sizing |

### Import Structure

Components should import from the hooks barrel export:

```typescript
import { useStdoutDimensions } from '../hooks/index.js';
```

## Rationale

### Why Internal Hook vs. External Width Prop?

**Option A (Chosen): Internal Hook**
- ✅ Zero changes required for consumers
- ✅ Consistent behavior across all component uses
- ✅ Automatic resize handling
- ✅ Opt-out via `responsive={false}` or explicit `width`

**Option B (Rejected): Require Consumers to Pass Width**
- ❌ Every consumer needs to use the hook
- ❌ Easy to forget, leading to inconsistent behavior
- ❌ More boilerplate code
- ❌ Existing code doesn't get responsive behavior

### Why Keep Optional Width Override?

1. **Testing**: Tests can provide fixed width for deterministic output
2. **Specific layouts**: Some UIs may need exact width control
3. **Backward compatibility**: Existing code with explicit width continues to work

### Why Add Responsive Flag?

1. **Opt-out mechanism**: Performance-critical paths can disable hook
2. **Explicit control**: Consumers can choose static vs. dynamic behavior
3. **Testing simplicity**: `responsive={false}` for predictable test output

## Consequences

### Positive
- Both components automatically adapt to terminal width
- No horizontal overflow in narrow terminals
- Zero breaking changes to existing API
- Consistent responsive behavior across the CLI

### Negative
- Slight performance overhead from hook in each component instance
- Potential layout shifts when terminal resizes during streaming

### Neutral
- Follows established pattern in `useStdoutDimensions.example.tsx`
- Similar to how other responsive components use the hook

## Implementation Checklist

1. [x] Update `StreamingText.tsx`:
   - [x] Add `useStdoutDimensions` import
   - [x] Add `responsive` prop with default `true`
   - [x] Rename `width` to `explicitWidth` internally
   - [x] Calculate `effectiveWidth` using hook when no explicit width
   - [x] Update `StreamingResponse` similarly

2. [ ] Update `MarkdownRenderer.tsx`:
   - [ ] Add `useStdoutDimensions` import
   - [ ] Add `responsive` prop with default `true`
   - [ ] Rename `width` to `explicitWidth` internally
   - [ ] Calculate `effectiveWidth` using hook when no explicit width
   - [ ] Apply to both `MarkdownRenderer` and `SimpleMarkdownRenderer`

3. [ ] Update tests:
   - [ ] Add tests for responsive behavior (MarkdownRenderer)
   - [ ] Test explicit width override
   - [ ] Test responsive={false} disables hook
   - [ ] Test narrow terminal handling

4. [ ] Verify no horizontal overflow in narrow terminals

## Remaining Work for Developer Stage

The developer stage needs to implement the following changes for `MarkdownRenderer.tsx`:

### Changes Required

```typescript
// packages/cli/src/ui/components/MarkdownRenderer.tsx

// 1. Add import at top of file
import { useStdoutDimensions } from '../hooks/index.js';

// 2. Update interface
export interface MarkdownRendererProps {
  content: string;
  width?: number;           // Optional explicit width override
  responsive?: boolean;     // Enable/disable responsive behavior (default: true)
}

// 3. Update MarkdownRenderer function signature and add hook
export function MarkdownRenderer({
  content,
  width: explicitWidth,
  responsive = true,
}: MarkdownRendererProps): React.ReactElement {
  // Get terminal dimensions from hook
  const { width: terminalWidth } = useStdoutDimensions();

  // Use explicit width if provided, otherwise use responsive terminal width
  // Subtract 2 for padding/margin safety
  const effectiveWidth = explicitWidth ?? (responsive ? Math.max(40, terminalWidth - 2) : 80);

  const [processed, setProcessed] = useState<string>(content);
  // ... rest of implementation using effectiveWidth instead of width
}

// 4. Update SimpleMarkdownRenderer similarly
export function SimpleMarkdownRenderer({
  content,
  width: explicitWidth,
  responsive = true,
}: MarkdownRendererProps): React.ReactElement {
  const { width: terminalWidth } = useStdoutDimensions();
  const effectiveWidth = explicitWidth ?? (responsive ? Math.max(40, terminalWidth - 2) : 80);

  // ... rest of implementation using effectiveWidth
}
```

### Test Updates Required

Update `packages/cli/src/ui/components/__tests__/MarkdownRenderer.test.tsx`:

1. Add mock for `useStdoutDimensions` hook
2. Add tests for responsive width behavior
3. Add tests for explicit width override
4. Add tests for `responsive={false}` behavior

## Related Documents

- `packages/cli/src/ui/hooks/useStdoutDimensions.ts` - Hook implementation
- `packages/cli/src/ui/components/StreamingText.tsx` - Reference implementation pattern
- `packages/cli/src/ui/components/ActivityLog.tsx` - Another responsive component example
