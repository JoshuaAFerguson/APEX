# ADR: Responsive StreamingText and MarkdownRenderer Components

## Status
Proposed

## Context

The `StreamingText` and `MarkdownRenderer` components need to be updated for responsive terminal width adaptation. Based on the planning analysis:

### Current State

**StreamingText.tsx** - ✅ **Already Implemented**
- Already imports `useStdoutDimensions` from hooks (line 3)
- Has `responsive?: boolean` prop (default: true) (lines 13, 27, 118, 131)
- Has `width: explicitWidth` pattern (lines 25, 130)
- Calculates `effectiveWidth` correctly: `explicitWidth ?? (responsive ? Math.max(40, terminalWidth - 2) : undefined)` (lines 34, 138)
- Both `StreamingText` and `StreamingResponse` components are updated
- Has `formatText()` function for line wrapping (lines 73-91)
- Box width is set to `effectiveWidth` (line 98)

**MarkdownRenderer.tsx** - ❌ **Needs Update**
- Does NOT use `useStdoutDimensions` hook
- Has hardcoded default `width = 80` (lines 7, 16, 54)
- Both `MarkdownRenderer` and `SimpleMarkdownRenderer` use static width
- No responsive behavior based on terminal size

### Acceptance Criteria
1. ✅ StreamingText uses `useStdoutDimensions` - **Already Done**
2. ❌ MarkdownRenderer uses `useStdoutDimensions` - **Needs Implementation**
3. ✅ Text wrapping adapts to terminal width in StreamingText - **Already Done**
4. ❌ Text wrapping adapts to terminal width in MarkdownRenderer - **Needs Implementation**
5. No horizontal overflow in narrow terminals

## Decision

### 1. StreamingText - No Changes Required

The `StreamingText` component already fully implements responsive behavior:

```typescript
// Current implementation (already correct)
import { useStdoutDimensions } from '../hooks/index.js';

export function StreamingText({
  width: explicitWidth,
  responsive = true,
}: StreamingTextProps): React.ReactElement {
  const { width: terminalWidth } = useStdoutDimensions();

  // Use explicit width if provided, otherwise use responsive terminal width
  // Subtract 2 for padding/margin safety
  const effectiveWidth = explicitWidth ?? (responsive ? Math.max(40, terminalWidth - 2) : undefined);

  // ... rest of component uses effectiveWidth
}
```

Key features already implemented:
- `responsive` prop (default: true) for opt-out capability
- Explicit `width` prop takes precedence over auto-detection
- Minimum width of 40 to prevent excessive wrapping
- Safety margin of 2 characters for padding/borders

### 2. MarkdownRenderer - Integration Required

Update `MarkdownRenderer` and `SimpleMarkdownRenderer` to follow the established responsive pattern from `StreamingText`:

#### 2.1 Props Interface Update

```typescript
export interface MarkdownRendererProps {
  content: string;
  width?: number;           // Explicit width override (existing prop)
  responsive?: boolean;     // NEW: Enable responsive behavior (default: true)
}
```

#### 2.2 MarkdownRenderer Component Update

```typescript
import { useStdoutDimensions } from '../hooks/index.js';

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

  useEffect(() => {
    const processMarkdown = async () => {
      try {
        const result = await marked.parse(content, { async: true });
        // Strip HTML tags for terminal output
        const stripped = result
          .replace(/<[^>]*>/g, '')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"');
        setProcessed(stripped);
      } catch {
        setProcessed(content);
      }
    };
    processMarkdown();
  }, [content]);

  return (
    <Box flexDirection="column" width={effectiveWidth}>
      <Text wrap="wrap">{processed}</Text>
    </Box>
  );
}
```

#### 2.3 SimpleMarkdownRenderer Component Update

```typescript
export function SimpleMarkdownRenderer({
  content,
  width: explicitWidth,
  responsive = true,
}: MarkdownRendererProps): React.ReactElement {
  // Get terminal dimensions from hook
  const { width: terminalWidth } = useStdoutDimensions();

  // Use explicit width if provided, otherwise use responsive terminal width
  // Subtract 2 for padding/margin safety
  const effectiveWidth = explicitWidth ?? (responsive ? Math.max(40, terminalWidth - 2) : 80);

  const lines = content.split('\n');

  return (
    <Box flexDirection="column" width={effectiveWidth}>
      {lines.map((line, index) => {
        // ... existing line processing logic unchanged
      })}
    </Box>
  );
}
```

### 3. Text Wrapping Enhancement

Add the `wrap="wrap"` prop to Text components to enable proper word-wrapping in Ink:

```typescript
// In MarkdownRenderer
<Text wrap="wrap">{processed}</Text>

// In SimpleMarkdownRenderer for long lines
<Text wrap="wrap">{formatInlineText(line)}</Text>
```

### 4. Consistency with StreamingText Pattern

| Aspect | StreamingText | MarkdownRenderer (proposed) |
|--------|--------------|----------------------------|
| Hook | `useStdoutDimensions` | `useStdoutDimensions` |
| Width prop | `width?: number` | `width?: number` |
| Responsive prop | `responsive?: boolean` (default: true) | `responsive?: boolean` (default: true) |
| Minimum width | 40 | 40 |
| Safety margin | 2 | 2 |
| Fallback | undefined (no width constraint) | 80 (matches current default) |

### 5. Testing Strategy

Create/update test file `__tests__/MarkdownRenderer.responsive.test.tsx`:

```typescript
describe('MarkdownRenderer - Responsive Behavior', () => {
  describe('useStdoutDimensions integration', () => {
    it('should use terminal width when no explicit width provided');
    it('should respect explicit width prop over terminal width');
    it('should use responsive=false to disable auto-detection');
  });

  describe('Narrow terminal handling', () => {
    it('should wrap long lines in narrow terminals');
    it('should maintain minimum width of 40');
    it('should not cause horizontal overflow');
  });

  describe('SimpleMarkdownRenderer responsive behavior', () => {
    it('should use terminal width when no explicit width provided');
    it('should wrap formatted text appropriately');
  });
});
```

Mock strategy:
```typescript
vi.mock('../../hooks/index.js', () => ({
  useStdoutDimensions: vi.fn(() => ({
    width: 50,
    height: 24,
    breakpoint: 'narrow' as const,
    isAvailable: true,
    isNarrow: true,
    isCompact: false,
    isNormal: false,
    isWide: false,
  })),
}));
```

## Implementation Plan

### Phase 1: MarkdownRenderer Update (Priority: High)
1. Import `useStdoutDimensions` hook
2. Add `responsive` prop to `MarkdownRendererProps` interface
3. Update `MarkdownRenderer` component with responsive logic
4. Update `SimpleMarkdownRenderer` component with responsive logic
5. Add `wrap="wrap"` to Text components

### Phase 2: Testing (Priority: High)
1. Create `MarkdownRenderer.responsive.test.tsx`
2. Test responsive behavior with mocked terminal widths
3. Test explicit width override
4. Test `responsive=false` opt-out
5. Test narrow terminal scenarios

### Phase 3: Documentation
1. Update JSDoc comments
2. Add usage examples

## File Changes

```
packages/cli/src/ui/components/
├── StreamingText.tsx              # NO CHANGES - already implemented
├── MarkdownRenderer.tsx           # UPDATE - add useStdoutDimensions integration
├── ADR-responsive-streamingtext-markdownrenderer.md  # NEW - this document
└── __tests__/
    ├── StreamingText.test.tsx     # OPTIONAL - add responsive tests
    └── MarkdownRenderer.test.tsx  # UPDATE - add responsive behavior tests
```

## Consequences

### Positive
- Both components adapt to terminal width automatically
- Consistent responsive pattern across components
- Backward compatible - explicit width props still work
- No horizontal overflow in narrow terminals
- Follows established patterns (StatusBar, ActivityLog, StreamingText)

### Negative
- Minor increase in component complexity for MarkdownRenderer
- Tests require mocking useStdoutDimensions

### Neutral
- StreamingText already implemented correctly, no changes needed
- Follows SOLID principles - single responsibility for width detection

## API Examples

```tsx
// Auto-responsive (recommended)
<MarkdownRenderer content="# Hello World" />
<StreamingText text="Response..." />

// Explicit width (backward compatible)
<MarkdownRenderer content="# Hello" width={60} />
<StreamingText text="Response..." width={80} />

// Disable responsive behavior (fixed width 80)
<MarkdownRenderer content="# Hello" responsive={false} />
<StreamingText text="Response..." responsive={false} />
```

### Behavior Matrix

| Terminal Width | responsive | Explicit Width | Effective Width |
|----------------|------------|----------------|-----------------|
| 50 (narrow)    | true       | none           | 48 (50-2)       |
| 50 (narrow)    | true       | 60             | 60              |
| 50 (narrow)    | false      | none           | 80 (default)    |
| 120 (wide)     | true       | none           | 118 (120-2)     |
| 30 (very narrow)| true      | none           | 40 (minimum)    |

## Dependencies

- `useStdoutDimensions` hook (already exists at `packages/cli/src/ui/hooks/useStdoutDimensions.ts`)
- No new external dependencies required

## Related Documents

- `ADR-useStdoutDimensions.md` - Hook architecture and usage
- `ADR-responsive-taskprogress.md` - Similar responsive pattern
- `ADR-responsive-activitylog-errordisplay.md` - Similar responsive pattern
