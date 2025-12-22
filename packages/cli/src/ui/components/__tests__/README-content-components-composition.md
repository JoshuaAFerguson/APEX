# Content Components Responsive Composition Integration Tests

## Overview

This document describes the implementation of integration tests for content components responsive composition, as specified in ADR-007.

## Test File

**Location**: `packages/cli/src/ui/components/__tests__/content-components-composition.integration.test.tsx`

## Implementation Summary

### Components Tested
- **MarkdownRenderer**: Markdown content rendering with responsive width
- **SimpleMarkdownRenderer**: Simplified markdown rendering
- **DiffViewer**: File diff display with unified/split modes
- **SyntaxHighlighter**: Code syntax highlighting with line wrapping
- **CodeBlock**: Simple code block wrapper

### Terminal Width Breakpoints
1. **narrow**: 45 columns (< 60 threshold)
2. **compact**: 70 columns (60-79 range)
3. **normal**: 100 columns (80-119 range)
4. **wide**: 150 columns (120-179 range)
5. **extra-wide**: 200 columns (>= 180)

### Test Structure

#### 1. Individual Component Width Behavior
- Tests each component at all 5 breakpoints
- Verifies width attribute calculations
- Ensures minimum width enforcement
- Tests long content handling

#### 2. Component Composition Tests
- Tests 2-component combinations
- Tests all 4 components together
- Verifies consistent width calculations
- Tests at all breakpoints

#### 3. Line Wrapping and Truncation Verification
- SyntaxHighlighter wrapping indicators
- DiffViewer truncation with ellipsis
- Content readability preservation

#### 4. Terminal Resize Simulation
- Dynamic width adaptation
- DiffViewer mode switching at 120-column threshold

#### 5. Acceptance Criteria Verification
- **Criterion 1**: All components render at all 5 widths without errors
- **Criterion 2**: Line wrapping indicators appear when expected
- **Criterion 3**: Essential content remains readable

#### 6. Performance Testing
- Large markdown content (< 200ms)
- Large code with maxLines (< 200ms)
- Large diffs (< 200ms)
- Composition rendering (< 300ms)

#### 7. Edge Cases and Error Handling
- Empty content handling
- Malformed content recovery
- Extremely narrow widths
- Special characters and unicode
- Terminal dimensions unavailable

### Mock Strategy

#### Dependencies Mocked
- `marked`: Markdown parsing library
- `diff`: Diff calculation library
- `fast-diff`: Fast diff library
- `ink-syntax-highlight`: Syntax highlighting component
- `useStdoutDimensions`: Terminal dimensions hook

#### Breakpoint Configuration Objects
```typescript
const BREAKPOINT_CONFIGS = {
  narrow: { width: 45, breakpoint: 'narrow', isNarrow: true, ... },
  compact: { width: 70, breakpoint: 'compact', isCompact: true, ... },
  normal: { width: 100, breakpoint: 'normal', isNormal: true, ... },
  wide: { width: 150, breakpoint: 'wide', isWide: true, ... },
  extraWide: { width: 200, breakpoint: 'wide', isWide: true, ... },
};
```

### Test Content Samples

#### Standard Content
- Basic markdown with headers, lists, code blocks, blockquotes (~500 chars)
- TypeScript code with imports and interfaces (~1500 chars)
- Simple diff example

#### Long Content
- Extended markdown paragraphs for wrapping tests (~1000 chars)
- Very long single code line (150+ characters)
- Large content for performance tests (100+ sections)

### Width Calculation Verification

Each component follows a consistent pattern:
```typescript
const effectiveWidth = explicitWidth ?? (responsive
  ? Math.max(minWidth, terminalWidth - 2)
  : defaultWidth);
```

| Component | Min Width | Default Width | Notes |
|-----------|-----------|---------------|-------|
| MarkdownRenderer | 40 | 80 | -2 margin for safety |
| SyntaxHighlighter | 40 | 80 | Accounts for line numbers and borders |
| DiffViewer | 60 | 120 | Split mode requires 120+ columns |

### Key Test Behaviors Verified

1. **Width Attributes**: All components set correct width attributes based on calculations
2. **Mode Switching**: DiffViewer switches from unified to split at 120+ columns
3. **Line Wrapping**: SyntaxHighlighter shows "(X wrapped)" indicator in header
4. **Truncation**: DiffViewer shows "..." for truncated long lines
5. **Error Recovery**: All components handle empty/malformed content gracefully
6. **Performance**: Large content rendering stays under performance thresholds

### Acceptance Criteria Mapping

✅ **Components render without overflow at all 5 terminal widths**
- Individual component tests verify width calculations at each breakpoint
- Composition tests ensure no conflicts between components

✅ **Proper line wrapping is applied**
- SyntaxHighlighter wrapping indicator tests
- DiffViewer truncation with ellipsis tests

✅ **No horizontal truncation that breaks content readability**
- Essential content readability tests at narrow widths
- Code structure preservation tests
- Diff change identification tests

## Files Created

1. **Main Test File**: `packages/cli/src/ui/components/__tests__/content-components-composition.integration.test.tsx`
2. **Documentation**: This README file

## Test Execution

The tests can be run with:
```bash
npm test -- content-components-composition.integration.test.tsx
```

Or from the CLI package:
```bash
npm test --workspace=@apexcli/cli content-components-composition.integration.test.tsx
```

## Implementation Status

✅ **Complete** - All requirements from ADR-007 have been implemented:
- Mock setup and breakpoint configurations
- Individual component tests across all 5 breakpoints
- Component composition tests
- Acceptance criteria verification tests
- Performance testing for large content
- Edge case handling
- Comprehensive test coverage following ADR specifications