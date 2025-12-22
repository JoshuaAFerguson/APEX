# ADR: useStdoutDimensions Hook Architecture

## Status
Accepted (Revised)

## Revision History
- **v1**: Initial design (wrapped `ink-use-stdout-dimensions`)
- **v2**: Current design (direct `process.stdout` access with polling) - addresses testing issues

## Context
The APEX CLI needs a React hook for terminal width/height detection to enable responsive UI components. Components like `StatusBar`, `DiffViewer`, `MarkdownRenderer`, and others currently either hardcode widths or use `useStdout` directly.

### Requirements (from acceptance criteria):
1. ✅ Hook exists at `packages/cli/src/ui/hooks/useStdoutDimensions.ts`
2. ⚠️ Exports width/height values - **Currently uses `columns/rows`**
3. ⚠️ Provides responsive breakpoints (narrow/normal/wide) - **Currently has 4 breakpoints**
4. ✅ Handles resize events (via polling)
5. ✅ Includes fallback defaults (80x24)
6. ✅ Unit tests exist and pass

## Decision

### 1. Hook Architecture (Current Implementation)

The hook provides terminal dimensions with responsive breakpoint helpers:

```typescript
// packages/cli/src/ui/hooks/useStdoutDimensions.ts

export interface TerminalDimensions {
  /** Terminal width in columns */
  columns: number;
  /** Terminal height in rows */
  rows: number;
}

export interface BreakpointHelpers {
  /** True if width < 60 columns (very narrow terminals) */
  isNarrow: boolean;
  /** True if width is 60-100 columns (compact terminals) */
  isCompact: boolean;
  /** True if width is 100-160 columns (normal terminals) */
  isNormal: boolean;
  /** True if width >= 160 columns (wide terminals) */
  isWide: boolean;
}

export interface UseStdoutDimensionsReturn extends TerminalDimensions, BreakpointHelpers {}

export interface UseStdoutDimensionsOptions {
  /** How often to check for dimension changes in milliseconds (default: 100ms) */
  updateInterval?: number;
}

export function useStdoutDimensions(
  options?: UseStdoutDimensionsOptions
): UseStdoutDimensionsReturn;
```

### 2. Breakpoint Thresholds (4-tier system)

| Breakpoint | Width Range | Boolean Helper | Use Case |
|------------|-------------|----------------|----------|
| narrow     | < 60 cols   | `isNarrow`     | Minimal UI, essential info only |
| compact    | 60-99 cols  | `isCompact`    | Reduced layout, standard 80-col |
| normal     | 100-159 cols| `isNormal`     | Full layout, expanded features |
| wide       | >= 160 cols | `isWide`       | Extra space, side-by-side views |

**Note**: While acceptance criteria requested 3 breakpoints (narrow/normal/wide), the current 4-tier system provides finer control. For simple usage, use `isNarrow` for compact layouts and `isWide` for expanded layouts - `isCompact` and `isNormal` can be treated as "normal" range.

### 3. Implementation Strategy

#### Direct Process Access (Current):
```
useStdoutDimensions (our hook)
    └── process.stdout.columns/rows (direct access)
    └── setTimeout polling (resize detection)
```

**Why polling instead of event-based?**
1. **Testability**: Easier to mock `process.stdout` values and advance timers
2. **Simplicity**: No need to manage event listener attachment/cleanup across different environments
3. **Reliability**: Works in all environments including where resize events may not fire

### 4. REQUIRED CHANGES (For Acceptance Criteria Compliance)

To fully meet acceptance criteria, the developer agent should update:

#### Option A: Add `width`/`height` aliases (recommended - non-breaking)
```typescript
export interface UseStdoutDimensionsReturn extends TerminalDimensions, BreakpointHelpers {
  /** Alias for columns - matches acceptance criteria naming */
  width: number;
  /** Alias for rows - matches acceptance criteria naming */
  height: number;
}
```

#### Option B: Add `breakpoint` enum (optional - for simplicity)
```typescript
export type Breakpoint = 'narrow' | 'normal' | 'wide';

// Map 4-tier to 3-tier:
// narrow -> 'narrow'
// compact -> 'normal'
// normal -> 'normal'
// wide -> 'wide'
```

### 5. Integration with Existing Code

The hook **MUST** be exported from the hooks barrel file:
```typescript
// packages/cli/src/ui/hooks/index.ts
export {
  useStdoutDimensions,
  type UseStdoutDimensionsReturn,
  type UseStdoutDimensionsOptions,
  type TerminalDimensions,
  type BreakpointHelpers,
} from './useStdoutDimensions.js';
```

### 6. Test Strategy (Implemented)

Current test coverage includes:
1. ✅ Returns default dimensions when stdout unavailable
2. ✅ Returns correct dimensions from mocked terminal
3. ✅ Calculates breakpoint correctly for each threshold
4. ✅ Handles dimension changes via polling
5. ✅ Cleanup on unmount (clearTimeout)
6. ✅ Edge cases: very small/large dimensions, zero interval

## Rationale

### Why direct process.stdout access instead of ink-use-stdout-dimensions?
1. **Simpler testing**: Mocking `process.stdout` is straightforward
2. **No external dependency complexity**: Avoids CommonJS/ESM interop issues
3. **Full control**: Can customize polling behavior and fallbacks
4. **Lighter**: One less dependency in the hot path

### Why 4 breakpoints instead of 3?
1. **Finer granularity**: 80-col (compact) vs 120-col (normal) have different layouts
2. **Future-proof**: More tiers allow progressive enhancement
3. **Backwards compatible**: Can always reduce by combining tiers

### Why polling instead of resize events?
1. **Testing simplicity**: `vi.advanceTimersByTime()` works seamlessly
2. **Environment compatibility**: Works in headless/CI environments
3. **100ms default**: Responsive enough for UI, minimal overhead

## Consequences

### Positive
- Consistent responsive behavior across all CLI components
- Centralized breakpoint logic (single source of truth)
- Easy to test with timer mocks
- No external dependency for core functionality

### Negative
- Slight CPU overhead from polling (negligible at 100ms)
- 4 breakpoints may be overkill for simple use cases

### Neutral
- Follows existing hook patterns in the codebase
- Similar to `useElapsedTime` in implementation approach

## Developer Action Items

1. **Add exports to `index.ts`** - Currently missing!
2. **Add `width`/`height` aliases** - For acceptance criteria compliance
3. **Run tests** - Verify all pass: `npm test --workspace=@apexcli/cli`
4. **Consider adding `breakpoint` property** - For simplified 3-tier usage

## Example Usage

```typescript
// In a component
import { useStdoutDimensions } from '../hooks/index.js';

function ResponsivePanel() {
  const { columns, rows, isNarrow, isWide } = useStdoutDimensions();

  if (isNarrow) {
    return <CompactView width={columns} />;
  }

  return <FullView width={columns} showExtras={isWide} />;
}

// Simplified 3-tier usage
function SimpleResponsive() {
  const { columns, isNarrow, isWide } = useStdoutDimensions();

  // narrow = isNarrow
  // normal = !isNarrow && !isWide
  // wide = isWide
  const breakpoint = isNarrow ? 'narrow' : isWide ? 'wide' : 'normal';

  return <Layout breakpoint={breakpoint} width={columns} />;
}
```

## Migration Path for Existing Components

Components currently using `useStdout` directly can migrate:

```typescript
// Before (StatusBar.tsx)
const { stdout } = useStdout();
const terminalWidth = stdout?.columns || 120;

// After
const { columns, isNarrow, isWide } = useStdoutDimensions();
// columns provides the width, breakpoints for responsive decisions
```

Priority components for migration:
1. `StatusBar.tsx` - Already has responsive logic
2. `DiffViewer.tsx` - Uses width for side-by-side
3. `MarkdownRenderer.tsx` - Uses width for wrapping
