# ADR-032: Responsive Width for DiffViewer and SyntaxHighlighter

## Status
Proposed

## Context

The APEX CLI has two components (`DiffViewer` and `SyntaxHighlighter`) that display code and diff content. These components currently have fixed default widths and don't adapt to terminal size, causing horizontal overflow in narrow terminals and suboptimal space utilization in wide terminals.

### Acceptance Criteria
1. DiffViewer switches to unified view in narrow terminals (<100 cols), side-by-side in wide terminals
2. SyntaxHighlighter respects terminal width for line wrapping
3. No horizontal scrolling needed

### Current State Analysis

**DiffViewer.tsx** (`packages/cli/src/ui/components/DiffViewer.tsx`):
- Has `width` prop with default of 120
- Has `mode` prop: `'unified' | 'split' | 'inline'`
- Does NOT use `useStdoutDimensions` hook
- SplitDiffViewer calculates `halfWidth = Math.floor((width! - 4) / 2)`
- No automatic mode switching based on terminal width

**SyntaxHighlighter.tsx** (`packages/cli/src/ui/components/SyntaxHighlighter.tsx`):
- Has `width` prop with default of 80
- Does NOT use `useStdoutDimensions` hook
- No line wrapping for long code lines
- Contains two variants: `SyntaxHighlighter` and `SimpleSyntaxHighlighter`

**useStdoutDimensions hook** (already available):
- Provides: `width`, `height`, `breakpoint`, boolean helpers (`isNarrow`, `isCompact`, `isNormal`, `isWide`)
- Default breakpoints: narrow (<60), compact (60-99), normal (100-159), wide (>=160)
- Has configurable thresholds via options

### Established Responsive Patterns in Codebase

From analysis of existing components (StreamingText, MarkdownRenderer, StatusBar, ActivityLog, TaskProgress):

```typescript
// Common pattern:
const { width: terminalWidth, breakpoint, isNarrow, isCompact } = useStdoutDimensions();
const effectiveWidth = explicitWidth ?? (responsive ? Math.max(40, terminalWidth - 2) : defaultWidth);
```

## Decision

### Architecture Overview

```
Terminal Width
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│                  useStdoutDimensions Hook                    │
│  { width, height, breakpoint, isNarrow, isCompact, ... }    │
└─────────────────────────────────────────────────────────────┘
      │
      ├───────────────────────┬───────────────────────┐
      ▼                       ▼                       ▼
┌───────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  DiffViewer   │    │ SyntaxHighlighter│    │ Other Components│
│               │    │                 │    │                 │
│ Auto-selects  │    │ Dynamic width   │    │ (Already done)  │
│ mode based on │    │ with line       │    │                 │
│ terminal width│    │ wrapping        │    │                 │
└───────────────┘    └─────────────────┘    └─────────────────┘
```

### 1. DiffViewer Responsive Design

#### Mode Selection Strategy

| Terminal Width | Breakpoint | Recommended Mode | Rationale |
|---------------|------------|------------------|-----------|
| < 60          | narrow     | unified          | Too narrow for split; single column only |
| 60-99         | compact    | unified          | Split would be cramped (<48 cols per side) |
| 100-159       | normal     | split (default)  | Each side gets ~48-77 columns |
| >= 160        | wide       | split            | Plenty of room for side-by-side |

**Threshold Analysis for Split Mode:**
- Split mode divides: `halfWidth = (width - 4) / 2` (4 chars for divider/borders)
- For readable code, each side needs at least ~45-50 columns
- At 100 cols: halfWidth = 48 (acceptable minimum)
- Below 100 cols: halfWidth < 48 (too cramped for code)

#### Auto Mode Calculation

```typescript
// Calculate effective mode based on terminal width
function getEffectiveMode(
  requestedMode: 'unified' | 'split' | 'inline' | 'auto',
  width: number,
  breakpoint: Breakpoint
): 'unified' | 'split' | 'inline' {
  // If explicit mode requested (not 'auto'), use it
  if (requestedMode !== 'auto') {
    // But warn/fallback if split requested in narrow terminal
    if (requestedMode === 'split' && width < 100) {
      return 'unified'; // Force unified in narrow terminals
    }
    return requestedMode;
  }

  // Auto mode: select based on width
  if (width < 100) {
    return 'unified';
  }
  return 'split';
}
```

#### Props Interface Update

```typescript
export interface DiffViewerProps {
  oldContent: string;
  newContent: string;
  filename?: string;
  mode?: 'unified' | 'split' | 'inline' | 'auto';  // Add 'auto' option
  context?: number;
  showLineNumbers?: boolean;
  width?: number;              // Optional explicit override
  maxLines?: number;
  responsive?: boolean;        // NEW: Enable responsive behavior (default: true)
}
```

### 2. SyntaxHighlighter Responsive Design

#### Line Wrapping Strategy

For code display, we need to handle long lines gracefully:

```typescript
function wrapCodeLine(line: string, maxWidth: number): string[] {
  if (line.length <= maxWidth) return [line];

  const wrappedLines: string[] = [];
  let remaining = line;

  while (remaining.length > maxWidth) {
    // Try to break at a sensible point (space, operator, comma)
    let breakPoint = maxWidth;
    const breakChars = [' ', ',', '.', '(', ')', '{', '}', '[', ']', ';', '+', '-', '*', '/'];

    for (let i = maxWidth; i > maxWidth - 20 && i > 0; i--) {
      if (breakChars.includes(remaining[i])) {
        breakPoint = i + 1;
        break;
      }
    }

    wrappedLines.push(remaining.substring(0, breakPoint));
    remaining = '  ' + remaining.substring(breakPoint); // Indent continuation
  }

  if (remaining.length > 0) {
    wrappedLines.push(remaining);
  }

  return wrappedLines;
}
```

#### Width Calculation

```typescript
// Account for line numbers and borders
// Line numbers: "123 │" = 5 chars
// Box borders: 2 chars (left padding)
// Safety margin: 2 chars
const lineNumberWidth = showLineNumbers ? 6 : 0;
const borderOverhead = 4; // paddingX={1} = 2 + border = 2
const codeWidth = effectiveWidth - lineNumberWidth - borderOverhead;
```

#### Props Interface Update

```typescript
export interface SyntaxHighlighterProps {
  code: string;
  language?: string;
  theme?: 'dark' | 'light';
  showLineNumbers?: boolean;
  width?: number;              // Optional explicit override
  maxLines?: number;
  responsive?: boolean;        // NEW: Enable responsive behavior (default: true)
  wrapLines?: boolean;         // NEW: Enable line wrapping (default: true when responsive)
}
```

### 3. Implementation Architecture

#### DiffViewer Changes

```typescript
// packages/cli/src/ui/components/DiffViewer.tsx

import { useStdoutDimensions, Breakpoint } from '../hooks/index.js';

export interface DiffViewerProps {
  oldContent: string;
  newContent: string;
  filename?: string;
  mode?: 'unified' | 'split' | 'inline' | 'auto';
  context?: number;
  showLineNumbers?: boolean;
  width?: number;
  maxLines?: number;
  responsive?: boolean;
}

export function DiffViewer({
  oldContent,
  newContent,
  filename,
  mode = 'auto',  // Change default from 'unified' to 'auto'
  context = 3,
  showLineNumbers = true,
  width: explicitWidth,
  maxLines,
  responsive = true,
}: DiffViewerProps): React.ReactElement {
  // Get terminal dimensions
  const { width: terminalWidth, breakpoint } = useStdoutDimensions();

  // Calculate effective width
  const effectiveWidth = explicitWidth ?? (responsive
    ? Math.max(60, terminalWidth - 2)
    : 120);

  // Determine effective mode
  const effectiveMode = getEffectiveMode(mode, effectiveWidth, breakpoint);

  switch (effectiveMode) {
    case 'split':
      return <SplitDiffViewer ... width={effectiveWidth} />;
    case 'inline':
      return <InlineDiffViewer ... width={effectiveWidth} />;
    default:
      return <UnifiedDiffViewer ... width={effectiveWidth} />;
  }
}

// Helper function
function getEffectiveMode(
  requestedMode: 'unified' | 'split' | 'inline' | 'auto',
  width: number,
  breakpoint: Breakpoint
): 'unified' | 'split' | 'inline' {
  if (requestedMode === 'auto') {
    // Auto mode: unified for narrow, split for wide
    return width < 100 ? 'unified' : 'split';
  }

  // If split requested but terminal too narrow, fallback to unified
  if (requestedMode === 'split' && width < 100) {
    return 'unified';
  }

  return requestedMode;
}
```

#### SyntaxHighlighter Changes

```typescript
// packages/cli/src/ui/components/SyntaxHighlighter.tsx

import { useStdoutDimensions } from '../hooks/index.js';

export interface SyntaxHighlighterProps {
  code: string;
  language?: string;
  theme?: 'dark' | 'light';
  showLineNumbers?: boolean;
  width?: number;
  maxLines?: number;
  responsive?: boolean;
  wrapLines?: boolean;
}

export function SyntaxHighlighter({
  code,
  language = 'typescript',
  showLineNumbers = true,
  width: explicitWidth,
  maxLines,
  responsive = true,
  wrapLines,
}: SyntaxHighlighterProps): React.ReactElement {
  const { width: terminalWidth } = useStdoutDimensions();

  // Calculate effective width
  const effectiveWidth = explicitWidth ?? (responsive
    ? Math.max(40, terminalWidth - 2)
    : 80);

  // Determine if line wrapping is enabled
  const shouldWrap = wrapLines ?? responsive;

  // Calculate available width for code content
  const lineNumberWidth = showLineNumbers ? 6 : 0;
  const borderPadding = 4;
  const codeWidth = effectiveWidth - lineNumberWidth - borderPadding;

  // Process lines with optional wrapping
  const processedLines = shouldWrap
    ? lines.flatMap(line => wrapCodeLine(line, codeWidth))
    : lines;

  // ... render with effectiveWidth
}
```

### 4. Content Truncation in Narrow Terminals

For DiffViewer content lines that exceed available width:

```typescript
function truncateDiffLine(content: string, maxWidth: number): string {
  if (content.length <= maxWidth) return content;
  return content.substring(0, maxWidth - 3) + '...';
}
```

### 5. Visual Indicators

When mode is auto-selected or content is truncated, provide visual feedback:

```typescript
// In UnifiedDiffViewer header when forced from split
{forcedUnified && (
  <Text color="yellow" dimColor>
    (split view requires 100+ columns)
  </Text>
)}
```

## File Changes Summary

### DiffViewer.tsx
1. Import `useStdoutDimensions` hook
2. Add `responsive?: boolean` prop (default: true)
3. Change `mode` default from `'unified'` to `'auto'`
4. Add `'auto'` to mode type union
5. Add `getEffectiveMode()` helper function
6. Calculate `effectiveWidth` using hook
7. Pass `effectiveWidth` to sub-viewers
8. Add line truncation for overflow prevention

### SyntaxHighlighter.tsx
1. Import `useStdoutDimensions` hook
2. Add `responsive?: boolean` prop (default: true)
3. Add `wrapLines?: boolean` prop (default: uses responsive)
4. Calculate `effectiveWidth` using hook
5. Implement `wrapCodeLine()` helper for smart line wrapping
6. Apply to both `SyntaxHighlighter` and `SimpleSyntaxHighlighter`

### Test Files to Create/Update
1. `DiffViewer.responsive.test.tsx` - Mode selection, width adaptation
2. `SyntaxHighlighter.responsive.test.tsx` - Line wrapping, width behavior

## Rationale

### Why Auto Mode for DiffViewer?

**Chosen**: Default to `'auto'` mode
- Better UX: Automatically provides best view for terminal size
- Backward compatible: Explicit mode still works
- Follows "sensible defaults" principle

**Alternative Rejected**: Keep `'unified'` default
- Forces users to manually specify mode
- No adaptation to different terminal sizes

### Why 100 Columns as Split Threshold?

- Matches `compact` breakpoint boundary (60-99 = compact, 100+ = normal)
- At 100 cols, each side gets ~48 columns (acceptable for code)
- Below 100, split becomes cramped and hard to read
- Industry standard: Most code style guides recommend 80-120 char lines

### Why Line Wrapping for SyntaxHighlighter?

**Chosen**: Smart line wrapping at sensible breakpoints
- Prevents horizontal scroll
- Maintains code readability
- Continuation lines indented for visual clarity

**Alternative Considered**: Truncation with ellipsis
- Loses information
- Users can't see full content

## Consequences

### Positive
- No horizontal scrolling in narrow terminals
- Optimal space usage in wide terminals
- Automatic mode selection reduces user configuration
- Consistent with other responsive components in codebase
- Backward compatible with explicit width/mode

### Negative
- Additional complexity in mode calculation
- Potential layout shifts on terminal resize
- Line wrapping can make some code harder to read (mitigated by smart breaks)

### Neutral
- Follows established hook pattern
- Test mocking pattern already established

## Test Plan

### DiffViewer Tests
1. Auto mode selects unified < 100 cols
2. Auto mode selects split >= 100 cols
3. Explicit mode overrides auto behavior
4. Split mode forced to unified in narrow terminals
5. Responsive=false uses default width
6. Explicit width overrides responsive

### SyntaxHighlighter Tests
1. Line wrapping at terminal width
2. Long lines wrap at sensible breakpoints
3. Continuation lines indented
4. Responsive=false uses default width
5. WrapLines=false disables wrapping

## Implementation Order

1. **DiffViewer first** (higher complexity, acceptance criteria critical)
   - Add hook integration
   - Implement auto mode
   - Update sub-viewers

2. **SyntaxHighlighter second**
   - Add hook integration
   - Implement line wrapping
   - Apply to both variants

3. **Tests last**
   - Create responsive test files
   - Mock hook following established pattern
