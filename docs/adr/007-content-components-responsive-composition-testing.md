# ADR 007: Content Components Responsive Composition Testing Architecture

## Status
Accepted

## Context
APEX CLI uses four primary content components for rendering rich terminal output:
- **MarkdownRenderer** - Renders markdown content with headers, lists, code blocks, blockquotes
- **DiffViewer** - Displays file diffs in unified, split, or inline modes
- **SyntaxHighlighter** - Syntax-highlighted code with line numbers and wrapping
- **CodeBlock** - Wrapper around ink-syntax-highlight for simple code display

These components need to work correctly when composed together across various terminal widths. Terminal environments range from minimal 40-column terminals to modern wide 200+ column displays.

### Terminal Width Breakpoints
The system defines five breakpoint categories:
1. **narrow**: < 60 columns (minimum viable width ~40)
2. **compact**: 60-79 columns
3. **normal**: 80-119 columns (standard terminal)
4. **wide**: 120-179 columns (split view threshold)
5. **extra-wide**: >= 180 columns

### Requirements
1. Components must render without horizontal overflow at all breakpoints
2. Proper line wrapping must be applied to prevent content from being cut off
3. Content must remain readable - no truncation that breaks comprehension

## Decision

### 1. Test Architecture

We will implement integration tests in `/packages/cli/src/ui/components/__tests__/content-components-composition.integration.test.tsx` that verify:

#### A. Individual Component Width Behavior
Each component is tested independently at all 5 breakpoints to verify:
- Width attribute matches expected calculation
- No rendering errors occur
- Long content is handled appropriately

#### B. Component Composition Tests
Multiple components are rendered together at each breakpoint to verify:
- No layout conflicts or overflow
- Consistent width calculations
- Proper stacking in column layout

#### C. Line Wrapping Verification
- SyntaxHighlighter wrapping indicator appears when content exceeds width
- DiffViewer truncation with ellipsis for long lines
- Content remains readable after wrapping/truncation

#### D. Resize Simulation
- Components adapt correctly when terminal dimensions change
- DiffViewer mode switching at 120-column threshold

### 2. Width Calculation Strategy

Each component implements a consistent width calculation pattern:

```typescript
// General pattern used by all components
const effectiveWidth = explicitWidth ?? (responsive
  ? Math.max(minWidth, terminalWidth - 2)
  : defaultWidth);
```

| Component | Min Width | Default Width | Notes |
|-----------|-----------|---------------|-------|
| MarkdownRenderer | 40 | 80 | -2 margin for safety |
| SimpleMarkdownRenderer | 40 | 80 | Same as MarkdownRenderer |
| SyntaxHighlighter | 40 | 80 | Accounts for line numbers (6 chars) and borders (4 chars) |
| DiffViewer | 60 | 120 | Split mode requires 120+ columns |
| CodeBlock | N/A | N/A | Wrapper, inherits from SyntaxHighlight |

### 3. Test Data Strategy

#### Content Samples
- **Standard markdown**: Headers, lists, code blocks, blockquotes (~500 chars)
- **Long markdown**: Extended paragraphs and lists to test wrapping (~1000 chars)
- **Code samples**: Real-world TypeScript with imports, interfaces, functions (~1500 chars)
- **Long code line**: 150+ character single line to test wrapping
- **Diff samples**: Before/after code refactoring (~200 chars each)

#### Breakpoint Configurations
Pre-defined mock configurations for each breakpoint:

```typescript
const BREAKPOINT_CONFIGS = {
  narrow: { width: 45, breakpoint: 'narrow', isNarrow: true, ... },
  compact: { width: 70, breakpoint: 'compact', isCompact: true, ... },
  normal: { width: 100, breakpoint: 'normal', isNormal: true, ... },
  wide: { width: 150, breakpoint: 'wide', isWide: true, ... },
  extraWide: { width: 200, breakpoint: 'wide', isWide: true, ... },
};
```

### 4. Mock Strategy

#### Hook Mocking
```typescript
const mockUseStdoutDimensions = vi.fn();
vi.mock('../../hooks/index.js', () => ({
  useStdoutDimensions: () => mockUseStdoutDimensions(),
}));
```

#### Library Mocking
- **diff**: Mock `diffLines` and `diffChars` with controlled return values
- **marked**: Mock `parse` to return content directly for predictable testing
- **ink-syntax-highlight**: Mock to simple span element

### 5. Acceptance Criteria Tests

Dedicated test section verifying:

1. **Criterion 1**: All components render at all 5 widths without errors
2. **Criterion 2**: Line wrapping indicators appear when expected
3. **Criterion 3**: Essential content remains readable (not broken by truncation)

### 6. Performance Testing

Integration tests include performance validation:
- Large markdown (100 repeated sections): < 200ms
- Large code (1000 lines with maxLines=50): < 200ms
- Large diff (500 line changes): < 200ms

## Consequences

### Positive
1. **Comprehensive Coverage**: All component combinations tested at all breakpoints
2. **Regression Prevention**: Changes to width calculations immediately caught
3. **Documentation**: Test file serves as living documentation of expected behavior
4. **Performance Baseline**: Performance assertions prevent degradation

### Negative
1. **Test Maintenance**: Mock configurations must be updated if breakpoint definitions change
2. **Test Duration**: Running 5 breakpoints × 4 components × multiple scenarios adds time
3. **Mock Complexity**: Multiple library mocks require careful coordination

### Risks
1. **Mock Drift**: If component implementations change, mocks may become stale
2. **False Positives**: Overly strict width assertions may fail on minor refactors

## Implementation Plan

### Phase 1: Test Infrastructure (This ADR)
- Create test file with mock setup
- Implement breakpoint configuration objects
- Define test content samples

### Phase 2: Individual Component Tests
- Test each component at all 5 breakpoints
- Verify width attributes
- Test long content handling

### Phase 3: Composition Tests
- Test 2-component compositions
- Test 4-component composition
- Test resize scenarios

### Phase 4: Acceptance Verification
- Map tests to acceptance criteria
- Add performance benchmarks

## Alternatives Considered

### Visual Snapshot Testing
**Rejected**: Terminal output varies by environment, making snapshots unreliable.

### Property-Based Testing (QuickCheck style)
**Deferred**: Could be valuable for generating random widths/content combinations but adds complexity.

### Real Terminal Testing
**Rejected**: Requires actual terminal environment, not feasible in CI.

## Related Documents
- Component source: `packages/cli/src/ui/components/`
- Existing responsive tests: `responsive-integration.test.tsx`
- Hook implementation: `packages/cli/src/ui/hooks/useStdoutDimensions.ts`
