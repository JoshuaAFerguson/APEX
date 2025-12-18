# Technical Design: Responsive Banner Component

## Overview

This document describes the technical design for adding responsive layout to the Banner component to adapt display based on terminal width.

## Requirements Summary

### Acceptance Criteria
1. ✅ Uses `useStdoutDimensions` hook
2. ✅ Narrow terminals show simplified/smaller banner or text-only version
3. ✅ Wide terminals show full ASCII art
4. ✅ No visual overflow at any width
5. ✅ Unit tests for responsive behavior

## Current State Analysis

### Current Banner.tsx (50 lines)
```typescript
// ASCII art is ~35 characters wide per line:
   █████╗ ██████╗ ███████╗██╗  ██╗
  ██╔══██╗██╔══██╗██╔════╝╚██╗██╔╝
  ███████║██████╔╝█████╗   ╚███╔╝
  ██╔══██║██╔═══╝ ██╔══╝   ██╔██╗
  ██║  ██║██║     ███████╗██╔╝ ██╗
  ╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝
```

**ASCII Art Dimensions:**
- Width: ~35 columns (including leading spaces)
- Height: 6 lines
- Plus 2 additional text lines below

### useStdoutDimensions Hook
The hook provides:
- `width`, `height` - terminal dimensions
- `breakpoint` - 'narrow' | 'compact' | 'normal' | 'wide'
- Boolean helpers: `isNarrow`, `isCompact`, `isNormal`, `isWide`

**Default Breakpoints:**
- narrow: < 60 columns
- compact: 60-99 columns
- normal: 100-159 columns
- wide: >= 160 columns

## Technical Design

### 1. Display Tiers

Based on the ASCII art width (~35 chars) and adding text content, we define display tiers:

| Tier | Terminal Width | Display Mode |
|------|----------------|--------------|
| **Narrow** | < 40 columns | Text-only (minimal) |
| **Compact** | 40-59 columns | Small text logo |
| **Normal** | >= 60 columns | Full ASCII art |

**Rationale:**
- ASCII art needs ~35 cols minimum to display properly
- 40 cols provides minimal breathing room
- 60+ cols allows comfortable display with full decorations

### 2. Component Architecture

```typescript
interface BannerProps {
  version: string;
  projectPath?: string;
  initialized?: boolean;
}

// Internal display mode type
type BannerDisplayMode = 'text-only' | 'compact' | 'full';

function Banner({ version, projectPath, initialized }: BannerProps) {
  const { width, isNarrow } = useStdoutDimensions();

  // Determine display mode based on width
  const displayMode = getDisplayMode(width);

  return (
    <Box flexDirection="column" marginBottom={1}>
      {displayMode === 'full' && <FullBanner />}
      {displayMode === 'compact' && <CompactBanner />}
      {displayMode === 'text-only' && <TextOnlyBanner />}

      <VersionLine version={version} compact={displayMode === 'text-only'} />
      <StatusLine initialized={initialized} projectPath={projectPath} />
    </Box>
  );
}
```

### 3. Display Mode Variants

#### 3.1 Full ASCII Art (>= 60 columns)
Current banner display - no changes needed:
```
   █████╗ ██████╗ ███████╗██╗  ██╗
  ██╔══██╗██╔══██╗██╔════╝╚██╗██╔╝
  ███████║██████╔╝█████╗   ╚███╔╝
  ██╔══██║██╔═══╝ ██╔══╝   ██╔██╗
  ██║  ██║██║     ███████╗██╔╝ ██╗
  ╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝
  Autonomous Product Engineering eXecutor
  v0.1.0
```

#### 3.2 Compact Text Logo (40-59 columns)
A smaller, stylized text representation:
```
╔═══════════════════════════════════╗
║         ◆ A P E X ◆               ║
╚═══════════════════════════════════╝
Autonomous Product Engineering eXecutor
v0.1.0
```

Or simpler box format:
```
┌─────────────────┐
│   ◆ APEX ◆     │
└─────────────────┘
v0.1.0
```

#### 3.3 Text-Only (< 40 columns)
Minimal display for very narrow terminals:
```
◆ APEX v0.1.0
```
Or with wrapped initialization status:
```
◆ APEX v0.1.0
✓ Initialized
```

### 4. Width Calculation & Overflow Prevention

```typescript
// Breakpoint constants for Banner
const BANNER_BREAKPOINTS = {
  FULL_ART_MIN: 60,      // Show full ASCII art
  COMPACT_MIN: 40,       // Show compact text box
  // < 40: Text-only mode
} as const;

function getDisplayMode(width: number): BannerDisplayMode {
  if (width >= BANNER_BREAKPOINTS.FULL_ART_MIN) return 'full';
  if (width >= BANNER_BREAKPOINTS.COMPACT_MIN) return 'compact';
  return 'text-only';
}
```

### 5. Props Interface (No Changes)

The existing props interface remains unchanged:
```typescript
interface BannerProps {
  version: string;
  projectPath?: string;
  initialized?: boolean;
}
```

### 6. Implementation Strategy

#### 6.1 Banner Content Components

```typescript
// Full ASCII art banner (current)
const FullAsciiArt: React.FC = () => {
  const asciiArt = `
   █████╗ ██████╗ ███████╗██╗  ██╗
  ██╔══██╗██╔══██╗██╔════╝╚██╗██╔╝
  ███████║██████╔╝█████╗   ╚███╔╝
  ██╔══██║██╔═══╝ ██╔══╝   ██╔██╗
  ██║  ██║██║     ███████╗██╔╝ ██╗
  ╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝`;

  return <Text color="cyan">{asciiArt}</Text>;
};

// Compact text box
const CompactBanner: React.FC = () => (
  <Box flexDirection="column">
    <Text color="cyan">┌─────────────────┐</Text>
    <Text color="cyan">│   ◆ </Text>
    <Text color="cyan" bold>APEX</Text>
    <Text color="cyan"> ◆     │</Text>
    <Text color="cyan">└─────────────────┘</Text>
  </Box>
);

// Text-only minimal
const TextOnlyBanner: React.FC<{ version: string }> = ({ version }) => (
  <Text>
    <Text color="cyan" bold>◆ APEX</Text>
    <Text color="gray"> v{version}</Text>
  </Text>
);
```

#### 6.2 Responsive Tagline

```typescript
// Full tagline for wide terminals
const TAGLINE_FULL = "Autonomous Product Engineering eXecutor";

// Abbreviated for compact
const TAGLINE_COMPACT = "AI Development Platform";

// None for text-only (version included in banner line)
```

#### 6.3 Status Line Adaptation

```typescript
interface StatusLineProps {
  initialized: boolean;
  projectPath?: string;
  compact?: boolean;
}

const StatusLine: React.FC<StatusLineProps> = ({
  initialized,
  projectPath,
  compact = false
}) => {
  if (initialized && projectPath) {
    return compact ? (
      <Text>
        <Text color="green">✓ </Text>
        <Text color="cyan">{truncatePath(projectPath, 25)}</Text>
      </Text>
    ) : (
      <Box marginTop={1}>
        <Text color="green">✓ </Text>
        <Text>Initialized in </Text>
        <Text color="cyan">{projectPath}</Text>
      </Box>
    );
  }

  return compact ? (
    <Text color="yellow">! Run /init</Text>
  ) : (
    <Box marginTop={1}>
      <Text color="yellow">! </Text>
      <Text color="gray">Not initialized. Run </Text>
      <Text color="cyan">/init</Text>
      <Text color="gray"> to get started.</Text>
    </Box>
  );
};

// Helper to truncate long paths
function truncatePath(path: string, maxLen: number): string {
  if (path.length <= maxLen) return path;
  const parts = path.split('/');
  // Keep last few segments with ellipsis
  let result = '.../' + parts.slice(-2).join('/');
  if (result.length > maxLen) {
    result = '...' + path.slice(-(maxLen - 3));
  }
  return result;
}
```

### 7. File Structure

```
packages/cli/src/ui/components/
├── Banner.tsx                          # Updated with responsive logic
├── TECHNICAL-DESIGN-responsive-banner.md  # This document
├── ADR-responsive-banner.md            # Decision record (created by architect)
└── __tests__/
    └── Banner.responsive.test.tsx      # NEW: Comprehensive responsive tests
```

### 8. Testing Strategy

#### 8.1 Test Cases for Banner.responsive.test.tsx

```typescript
describe('Banner - Responsive Layout', () => {
  describe('Display Mode Selection', () => {
    it('shows full ASCII art at width >= 60', () => {
      mockUseStdoutDimensions({ width: 80 });
      // Verify ASCII art characters present
    });

    it('shows compact text box at width 40-59', () => {
      mockUseStdoutDimensions({ width: 50 });
      // Verify compact box present, no ASCII art
    });

    it('shows text-only at width < 40', () => {
      mockUseStdoutDimensions({ width: 30 });
      // Verify minimal text output
    });
  });

  describe('Breakpoint Boundaries', () => {
    it('transitions from compact to full at exactly 60 columns', () => {
      // Test 59 vs 60
    });

    it('transitions from text-only to compact at exactly 40 columns', () => {
      // Test 39 vs 40
    });
  });

  describe('No Overflow', () => {
    it('full ASCII art fits within 60 column width', () => {
      // Verify no line exceeds 60 chars
    });

    it('compact banner fits within 40 column width', () => {
      // Verify no line exceeds 40 chars
    });

    it('text-only fits within 30 column width', () => {
      // Verify minimal output
    });
  });

  describe('Content Completeness', () => {
    it('shows version in all modes', () => {
      // Test each mode shows version
    });

    it('shows initialization status in all modes', () => {
      // Test initialized/not initialized in each mode
    });

    it('shows project path when initialized (truncated if needed)', () => {
      // Test path display and truncation
    });
  });

  describe('Edge Cases', () => {
    it('handles very narrow terminals (< 20 columns)', () => {
      mockUseStdoutDimensions({ width: 15 });
      // Should not crash, show minimal output
    });

    it('handles very wide terminals (> 200 columns)', () => {
      mockUseStdoutDimensions({ width: 250 });
      // Should show full ASCII art
    });

    it('handles missing projectPath gracefully', () => {
      // No crash, appropriate message
    });

    it('handles very long projectPath', () => {
      // Path truncation works correctly
    });
  });
});
```

#### 8.2 Mock Setup

```typescript
// Mock hook for testing
jest.mock('../hooks/useStdoutDimensions', () => ({
  useStdoutDimensions: jest.fn(),
}));

const mockUseStdoutDimensions = (dims: Partial<StdoutDimensions>) => {
  const width = dims.width ?? 80;
  (useStdoutDimensions as jest.Mock).mockReturnValue({
    width,
    height: dims.height ?? 24,
    breakpoint: width < 60 ? 'narrow' : width < 100 ? 'compact' : 'normal',
    isNarrow: width < 60,
    isCompact: width >= 60 && width < 100,
    isNormal: width >= 100 && width < 160,
    isWide: width >= 160,
    isAvailable: true,
    ...dims,
  });
};
```

### 9. Implementation Order

1. **Update Banner.tsx**
   - Add `useStdoutDimensions` import
   - Define display mode constants and helper
   - Create sub-components for each display mode
   - Update main component to conditionally render

2. **Create ADR-responsive-banner.md**
   - Document architectural decisions

3. **Create Banner.responsive.test.tsx**
   - Implement all test cases
   - Ensure comprehensive coverage

4. **Update existing Banner tests** (if any)
   - Add hook mocking
   - Verify backward compatibility

## Dependencies

- `useStdoutDimensions` from `../hooks/useStdoutDimensions.js`
- No new external dependencies

## Performance Considerations

- Display mode calculation is O(1) - simple numeric comparison
- No re-renders on terminal resize unless dimensions actually change (handled by hook)
- Sub-components are pure - no side effects

## Accessibility

- ASCII art has no semantic meaning; text-only mode is more accessible
- All important information (version, status) is rendered as actual text
- Color is supplementary, not required for understanding

## Backward Compatibility

- No breaking changes to props interface
- Same output on standard terminals (80+ columns)
- Graceful degradation on narrow terminals
