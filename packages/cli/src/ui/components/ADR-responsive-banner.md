# ADR: Responsive Banner Component

## Status
Proposed

## Context

The Banner component displays APEX branding with ASCII art on CLI startup. The current implementation has a fixed layout that can overflow or look poor on narrow terminals. We need to add responsive behavior that adapts the display based on terminal width.

### Current Implementation

**Banner.tsx** displays:
1. ASCII art logo (~35 characters wide, 6 lines tall)
2. Tagline: "Autonomous Product Engineering eXecutor"
3. Version number
4. Initialization status with project path

**Problem**: On terminals narrower than ~40 columns:
- ASCII art may wrap awkwardly or overflow
- Long project paths extend beyond terminal width
- No graceful degradation for narrow displays

### Available Infrastructure

The `useStdoutDimensions` hook provides:
- Real-time terminal dimensions (width, height)
- Breakpoint classification (narrow, compact, normal, wide)
- Boolean helpers (isNarrow, isCompact, isNormal, isWide)

This pattern is already used successfully in StatusBar, TaskProgress, and other components.

## Decision

### 1. Three-Tier Display System

We will implement three display modes based on terminal width:

| Mode | Width | Content |
|------|-------|---------|
| **Full** | >= 60 cols | Full ASCII art + full tagline |
| **Compact** | 40-59 cols | Simple text box + abbreviated tagline |
| **Text-Only** | < 40 cols | Single-line minimal branding |

**Rationale for thresholds:**
- 60 columns: ASCII art is ~35 chars; 60 provides comfortable margins
- 40 columns: Minimum for readable compact box display
- Below 40: Only text-based display is practical

### 2. Display Mode Selection

```typescript
const BANNER_BREAKPOINTS = {
  FULL_ART_MIN: 60,
  COMPACT_MIN: 40,
} as const;

type BannerDisplayMode = 'full' | 'compact' | 'text-only';

function getDisplayMode(width: number): BannerDisplayMode {
  if (width >= BANNER_BREAKPOINTS.FULL_ART_MIN) return 'full';
  if (width >= BANNER_BREAKPOINTS.COMPACT_MIN) return 'compact';
  return 'text-only';
}
```

### 3. Visual Design Per Mode

#### Full Mode (>= 60 columns)
```
   █████╗ ██████╗ ███████╗██╗  ██╗
  ██╔══██╗██╔══██╗██╔════╝╚██╗██╔╝
  ███████║██████╔╝█████╗   ╚███╔╝
  ██╔══██║██╔═══╝ ██╔══╝   ██╔██╗
  ██║  ██║██║     ███████╗██╔╝ ██╗
  ╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝
  Autonomous Product Engineering eXecutor
  v0.1.0

  ✓ Initialized in /path/to/project
```

#### Compact Mode (40-59 columns)
```
┌─────────────────┐
│    ◆ APEX ◆    │
└─────────────────┘
AI Development Platform
v0.1.0

✓ .../project
```

#### Text-Only Mode (< 40 columns)
```
◆ APEX v0.1.0
✓ Initialized
```

### 4. Path Truncation Strategy

For long project paths in narrow modes:

```typescript
function truncatePath(path: string, maxLen: number): string {
  if (path.length <= maxLen) return path;

  const parts = path.split('/');
  // Try to keep meaningful tail: .../parent/project
  let result = '.../' + parts.slice(-2).join('/');

  if (result.length > maxLen) {
    // Fall back to simple truncation
    result = '...' + path.slice(-(maxLen - 3));
  }

  return result;
}
```

### 5. Component Structure

```typescript
function Banner({ version, projectPath, initialized }: BannerProps) {
  const { width } = useStdoutDimensions();
  const displayMode = getDisplayMode(width);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <BannerArt mode={displayMode} />
      <Tagline mode={displayMode} />
      <VersionLine version={version} mode={displayMode} />
      <StatusLine
        initialized={initialized}
        projectPath={projectPath}
        mode={displayMode}
      />
    </Box>
  );
}
```

### 6. Why These Thresholds?

**60 columns for full ASCII art:**
- ASCII art is ~35 characters wide
- Leading spaces add ~2 characters
- Tagline is ~42 characters
- 60 columns provides comfortable display

**40 columns for compact mode:**
- Compact box is ~19 characters wide
- Version info needs ~10-15 characters
- 40 columns allows readable layout

**Below 40 columns:**
- Very narrow terminals (mobile, split screens)
- Only essential info: brand name + version
- Single-line format prevents awkward wrapping

### 7. Consistency with Codebase Patterns

This design follows established patterns:
- Uses `useStdoutDimensions` hook (same as StatusBar, TaskProgress)
- Three-tier responsive system (similar to StatusBar's narrow/normal/wide)
- Graceful degradation approach (critical info always visible)

## Alternatives Considered

### 1. Scaling ASCII Art
**Rejected**: ASCII art doesn't scale - it either fits or doesn't. Creating multiple sizes of ASCII art would be maintenance-heavy.

### 2. Horizontal Scrolling
**Rejected**: Terminal scrolling is poor UX and would require external library.

### 3. Single Breakpoint (show/hide ASCII)
**Rejected**: Leaves gap between "no art" and "fits perfectly" - compact mode provides better intermediate state.

### 4. Using Hook's Default Breakpoints Directly
**Rejected**: Hook's breakpoints (60/100/160) are general-purpose. Banner needs specific thresholds based on its content width.

## Consequences

### Positive
- No visual overflow at any terminal width
- Graceful degradation maintains brand identity
- Consistent with responsive patterns used elsewhere
- Simple implementation with clear breakpoints
- All essential information (version, status) always visible

### Negative
- Three variants to maintain (ASCII art, compact box, text)
- Additional test coverage required
- Slightly more complex component

### Neutral
- No changes to props interface (backward compatible)
- No performance impact (hook already optimized)

## Testing Requirements

1. **Display mode selection** at each breakpoint boundary
2. **No overflow** verification at minimum widths for each mode
3. **Content completeness** - version and status visible in all modes
4. **Path truncation** works correctly
5. **Edge cases** - very narrow (<20) and very wide (>200) terminals

## Implementation Notes

- Import `useStdoutDimensions` from `../hooks/useStdoutDimensions.js`
- Create test file: `__tests__/Banner.responsive.test.tsx`
- Maintain current visual appearance for standard terminals (80+ cols)

## Related

- `ADR-responsive-statusbar.md` - Similar responsive patterns
- `ADR-useStdoutDimensions.md` - Hook architecture
- `TECHNICAL-DESIGN-responsive-banner.md` - Implementation details
