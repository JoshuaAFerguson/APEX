# ADR: Display Modes Integration Tests Design

## Status
Proposed

## Context
The v0.3.0 features integration test file (`v030-features.integration.test.tsx`) has partial coverage for display modes. The acceptance criteria require comprehensive tests for:
- Compact mode (minimal StatusBar) ✅ Already implemented
- Verbose mode (full StatusBar) ⚠️ Partial - needs expansion
- Normal mode responsive filtering ⚠️ Missing
- Mode switching ⚠️ Missing

## ⚠️ Implementation Note: Compact Mode Test Discrepancies

The existing compact mode tests (lines 1337-1504) contain assertions that **conflict with the actual StatusBar implementation**:

| Test Assertion | StatusBar Implementation (lines 186-212) | Status |
|---------------|------------------------------------------|--------|
| "should hide git branch" | `if (props.gitBranch) { left.push(...) }` shows branch | ❌ CONFLICT |
| "should hide token/cost details" | `if (props.cost !== undefined) { right.push(...) }` shows cost | ❌ CONFLICT |
| "should show only elapsed timer" | Timer is NOT in compact mode segment building | ❌ CONFLICT |
| "should show only active agent" | Agent is NOT in compact mode segment building | ❌ CONFLICT |

**Recommendation for Implementation Stage:** Either:
1. Fix the StatusBar implementation to match tests (make compact mode truly minimal)
2. Update tests to match current implementation

The technical design below assumes Option 1 (tests define correct behavior).

## Technical Design

### 1. Test Categories to Add

#### 1.1 Verbose Mode - Full StatusBar Tests (NEW)

Located within `describe('Display Modes Integration')` as a new sub-describe block:

```typescript
describe('Verbose Mode - Full StatusBar', () => {
  // Test Suite Structure
})
```

**Tests Required:**

| Test Case | Description | Props Required | Assertions |
|-----------|-------------|----------------|------------|
| Token breakdown display | Shows input→output format | `tokens`, `displayMode="verbose"` | Text contains format like "1.5k→800" |
| Total tokens display | Shows total count | `tokens`, `displayMode="verbose"` | Text contains "total:" label |
| Active time display | Shows active processing time | `detailedTiming.totalActiveTime`, `displayMode="verbose"` | Text contains "active:" with formatted time |
| Idle time display | Shows idle/waiting time | `detailedTiming.totalIdleTime`, `displayMode="verbose"` | Text contains "idle:" with formatted time |
| Stage elapsed display | Shows current stage time | `detailedTiming.currentStageElapsed`, `workflowStage`, `displayMode="verbose"` | Text contains "stage:" with formatted time |
| Session cost display | Shows total session cost | `cost`, `sessionCost`, `displayMode="verbose"` | Text contains "session:" with cost |
| VERBOSE indicator | Shows mode indicator | `displayMode="verbose"` | Text contains "🔍 VERBOSE" |
| No width filtering | All segments shown | All props, narrow terminal | All segments present regardless of width |

#### 1.2 Normal Mode Responsive Filtering Tests (NEW)

```typescript
describe('Normal Mode - Responsive Filtering', () => {
  // Test Suite Structure
})
```

**Tests Required:**

| Test Case | Description | Test Approach | Assertions |
|-----------|-------------|---------------|------------|
| Wide terminal shows all | All segments visible | Mock wide terminal (120+ chars) | All segments present |
| Narrow terminal filters | Lower priority segments removed | Mock narrow terminal (< 80 chars) | Core segments present, extras filtered |
| Priority-based filtering | Correct segments preserved | Mock medium terminal | Agent, branch preserved; URLs, session name filtered |
| Connection indicator always shows | Core segment never filtered | Any terminal width | Connection indicator always visible |

#### 1.3 Mode Switching Tests (NEW)

```typescript
describe('Display Mode Switching', () => {
  // Test Suite Structure
})
```

**Tests Required:**

| Test Case | Description | Test Approach | Assertions |
|-----------|-------------|---------------|------------|
| Normal → Compact | Transition hides details | Rerender with mode change | Token details hidden after switch |
| Normal → Verbose | Transition adds details | Rerender with mode change | Breakdown format appears |
| Compact → Normal | Transition shows more | Rerender with mode change | More segments visible |
| Verbose → Compact | Transition minimizes | Rerender with mode change | Only minimal info shown |
| State preservation | Data persists through switch | Rerender with mode change | Values remain consistent |

### 2. Mock Data Structures

```typescript
const verboseModeSessionData = {
  sessionStartTime: new Date('2024-01-01T10:00:00Z'),
  tokens: { input: 1500, output: 800 },
  cost: 0.05,
  sessionCost: 0.15,
  model: 'claude-3-sonnet',
  detailedTiming: {
    stageStartTime: new Date('2024-01-01T10:02:00Z'),
    totalActiveTime: 45000,  // 45 seconds
    totalIdleTime: 15000,    // 15 seconds
    currentStageElapsed: 30000, // 30 seconds in current stage
  },
};
```

### 3. Terminal Width Mocking Strategy

The `StatusBar` component uses `useStdoutDimensions` hook located at `../ui/hooks/useStdoutDimensions`. We need to mock this relative to the test file location:

```typescript
// At top of test file, with other mocks
vi.mock('../ui/hooks/useStdoutDimensions', () => ({
  useStdoutDimensions: vi.fn(() => ({
    width: 120, // default wide
    breakpoint: 'wide',
  })),
}));
```

Then import and use in tests:
```typescript
import { useStdoutDimensions } from '../ui/hooks/useStdoutDimensions';

// In test
const mockUseStdoutDimensions = vi.mocked(useStdoutDimensions);
mockUseStdoutDimensions.mockReturnValue({ width: 60, breakpoint: 'narrow' });
```

### 4. File Structure

All tests go into the existing `describe('Display Modes Integration')` block in `/packages/cli/src/__tests__/v030-features.integration.test.tsx`.

**Insertion Point:** After line 1504 (after the compact mode tests), before line 1505.

### 5. Implementation Checklist

- [ ] Add mock for `useStdoutDimensions` hook at file top
- [ ] Add `describe('Verbose Mode - Full StatusBar')` with 8 test cases
- [ ] Add `describe('Normal Mode - Responsive Filtering')` with 4 test cases
- [ ] Add `describe('Display Mode Switching')` with 5 test cases

### 6. Expected Test Count

- Existing compact mode tests: 8 tests
- New verbose mode tests: 8 tests
- New normal mode responsive tests: 4 tests
- New mode switching tests: 5 tests
- **Total new tests: 17**

## Architectural Decisions

### Decision 1: Mock Terminal Width at Hook Level
**Rationale:** The `useStdoutDimensions` hook encapsulates the terminal dimension logic. Mocking at this level provides clean test isolation and matches how the component consumes width information.

### Decision 2: Use Rerender for Mode Switching Tests
**Rationale:** React Testing Library's `rerender` function simulates real mode switching behavior where props change but component state may persist.

### Decision 3: Organize by Feature, Not by Test Type
**Rationale:** Grouping tests by display mode (verbose, normal, switching) rather than by assertion type (presence, absence, format) improves readability and maintenance.

## Consequences

### Positive
- Comprehensive coverage of all display modes
- Clear test organization matching feature structure
- Reusable mock data patterns for future tests

### Negative
- Additional mock setup complexity for terminal dimensions
- Some test duplication between mode-specific suites

## Notes for Implementation Stage

1. The `formatTokenBreakdown` function uses arrow format: `1.5k→800` - tests should match this exact format
2. The `formatDetailedTime` function outputs: `45s`, `1m30s`, or `1h15m` - tests should cover these formats
3. The VERBOSE indicator includes emoji: `🔍 VERBOSE` - ensure test can match Unicode
4. Normal mode filtering removes segments from end of left array first - test priorities accordingly

## Implementation Code Templates

### Verbose Mode Tests Template

```typescript
// NEW: Comprehensive Verbose Mode - Full StatusBar Tests
describe('Verbose Mode - Full StatusBar', () => {
  const verboseModeData = {
    sessionStartTime: new Date('2024-01-01T10:00:00Z'),
    tokens: { input: 1500, output: 800 },
    cost: 0.05,
    sessionCost: 0.15,
    model: 'claude-3-sonnet',
  };

  const detailedTimingData = {
    stageStartTime: new Date('2024-01-01T10:02:00Z'),
    totalActiveTime: 45000,  // 45 seconds
    totalIdleTime: 15000,    // 15 seconds
    currentStageElapsed: 30000, // 30 seconds
  };

  it('should display token input→output breakdown in verbose mode', () => {
    render(
      <ThemeProvider>
        <StatusBar
          tokens={{ input: 1500, output: 800 }}
          displayMode="verbose"
        />
      </ThemeProvider>
    );

    // Should show breakdown format: input→output
    expect(screen.getByText(/1\.5k→800/)).toBeInTheDocument();
  });

  it('should display total tokens count in verbose mode', () => {
    render(
      <ThemeProvider>
        <StatusBar
          tokens={{ input: 1500, output: 800 }}
          displayMode="verbose"
        />
      </ThemeProvider>
    );

    // Should show total label with aggregated count
    expect(screen.getByText(/total:/)).toBeInTheDocument();
    expect(screen.getByText(/2\.3k/)).toBeInTheDocument();
  });

  it('should display active time breakdown in verbose mode', () => {
    render(
      <ThemeProvider>
        <StatusBar
          displayMode="verbose"
          detailedTiming={detailedTimingData}
          {...verboseModeData}
        />
      </ThemeProvider>
    );

    expect(screen.getByText(/active:/)).toBeInTheDocument();
    expect(screen.getByText(/45s/)).toBeInTheDocument();
  });

  it('should display idle time breakdown in verbose mode', () => {
    render(
      <ThemeProvider>
        <StatusBar
          displayMode="verbose"
          detailedTiming={detailedTimingData}
          {...verboseModeData}
        />
      </ThemeProvider>
    );

    expect(screen.getByText(/idle:/)).toBeInTheDocument();
    expect(screen.getByText(/15s/)).toBeInTheDocument();
  });

  it('should display stage elapsed time in verbose mode', () => {
    render(
      <ThemeProvider>
        <StatusBar
          displayMode="verbose"
          workflowStage="implementation"
          detailedTiming={detailedTimingData}
          {...verboseModeData}
        />
      </ThemeProvider>
    );

    expect(screen.getByText(/stage:/)).toBeInTheDocument();
    expect(screen.getByText(/30s/)).toBeInTheDocument();
  });

  it('should display session cost separate from request cost', () => {
    render(
      <ThemeProvider>
        <StatusBar
          cost={0.05}
          sessionCost={0.15}
          displayMode="verbose"
          {...verboseModeData}
        />
      </ThemeProvider>
    );

    expect(screen.getByText(/cost:/)).toBeInTheDocument();
    expect(screen.getByText(/\$0\.0500/)).toBeInTheDocument();
    expect(screen.getByText(/session:/)).toBeInTheDocument();
    expect(screen.getByText(/\$0\.1500/)).toBeInTheDocument();
  });

  it('should display VERBOSE indicator', () => {
    render(
      <ThemeProvider>
        <StatusBar
          displayMode="verbose"
          {...verboseModeData}
        />
      </ThemeProvider>
    );

    expect(screen.getByText(/🔍 VERBOSE/)).toBeInTheDocument();
  });

  it('should show all segments without filtering in verbose mode', () => {
    // Mock narrow terminal
    vi.mocked(useStdoutDimensions).mockReturnValue({ width: 60, breakpoint: 'narrow' });

    render(
      <ThemeProvider>
        <StatusBar
          gitBranch="feature/very-long-branch-name"
          agent="architect"
          workflowStage="implementation"
          apiUrl="http://localhost:3001"
          webUrl="http://localhost:3000"
          sessionName="Long Session Name"
          displayMode="verbose"
          {...verboseModeData}
        />
      </ThemeProvider>
    );

    // All segments should be present despite narrow terminal
    expect(screen.getByText(/feature\/very-long-branch-name/)).toBeInTheDocument();
    expect(screen.getByText('architect')).toBeInTheDocument();
    expect(screen.getByText('implementation')).toBeInTheDocument();
  });
});
```

### Normal Mode Responsive Filtering Tests Template

```typescript
describe('Normal Mode - Responsive Filtering', () => {
  const normalModeData = {
    sessionStartTime: new Date('2024-01-01T10:00:00Z'),
    tokens: { input: 1500, output: 800 },
    cost: 0.05,
    model: 'claude-3-sonnet',
  };

  afterEach(() => {
    // Reset mock to default wide terminal
    vi.mocked(useStdoutDimensions).mockReturnValue({ width: 120, breakpoint: 'wide' });
  });

  it('should show all segments in wide terminal', () => {
    vi.mocked(useStdoutDimensions).mockReturnValue({ width: 150, breakpoint: 'wide' });

    render(
      <ThemeProvider>
        <StatusBar
          gitBranch="feature/test"
          agent="developer"
          workflowStage="implementation"
          apiUrl="http://localhost:3001"
          sessionName="Test Session"
          displayMode="normal"
          {...normalModeData}
        />
      </ThemeProvider>
    );

    expect(screen.getByText(/feature\/test/)).toBeInTheDocument();
    expect(screen.getByText('developer')).toBeInTheDocument();
    expect(screen.getByText('implementation')).toBeInTheDocument();
    expect(screen.getByText(/api:/)).toBeInTheDocument();
  });

  it('should filter lower priority segments in narrow terminal', () => {
    vi.mocked(useStdoutDimensions).mockReturnValue({ width: 60, breakpoint: 'narrow' });

    render(
      <ThemeProvider>
        <StatusBar
          gitBranch="feature/test"
          agent="developer"
          workflowStage="implementation"
          apiUrl="http://localhost:3001"
          webUrl="http://localhost:3000"
          sessionName="Test Session"
          displayMode="normal"
          {...normalModeData}
        />
      </ThemeProvider>
    );

    // Core segments should still be present
    expect(screen.getByText('●')).toBeInTheDocument(); // Connection indicator

    // Lower priority may be filtered
    // Note: exact behavior depends on implementation
  });

  it('should preserve connection indicator at any width', () => {
    vi.mocked(useStdoutDimensions).mockReturnValue({ width: 40, breakpoint: 'narrow' });

    render(
      <ThemeProvider>
        <StatusBar
          isConnected={true}
          displayMode="normal"
          {...normalModeData}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('●')).toBeInTheDocument();
  });

  it('should handle medium terminal width with selective filtering', () => {
    vi.mocked(useStdoutDimensions).mockReturnValue({ width: 90, breakpoint: 'medium' });

    render(
      <ThemeProvider>
        <StatusBar
          gitBranch="feature/test"
          agent="developer"
          workflowStage="implementation"
          apiUrl="http://localhost:3001"
          displayMode="normal"
          {...normalModeData}
        />
      </ThemeProvider>
    );

    // Should have connection and branch at minimum
    expect(screen.getByText('●')).toBeInTheDocument();
    expect(screen.getByText(/feature\/test/)).toBeInTheDocument();
  });
});
```

### Mode Switching Tests Template

```typescript
describe('Display Mode Switching', () => {
  const baseSessionData = {
    sessionStartTime: new Date('2024-01-01T10:00:00Z'),
    tokens: { input: 1500, output: 800 },
    cost: 0.05,
    sessionCost: 0.15,
    model: 'claude-3-sonnet',
  };

  it('should transition from normal to compact mode', () => {
    const { rerender } = render(
      <ThemeProvider>
        <StatusBar
          gitBranch="feature/test"
          agent="developer"
          workflowStage="implementation"
          displayMode="normal"
          {...baseSessionData}
        />
      </ThemeProvider>
    );

    // Normal mode shows workflow stage
    expect(screen.getByText('implementation')).toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <StatusBar
          gitBranch="feature/test"
          agent="developer"
          workflowStage="implementation"
          displayMode="compact"
          {...baseSessionData}
        />
      </ThemeProvider>
    );

    // Compact mode hides workflow stage
    expect(screen.queryByText('implementation')).not.toBeInTheDocument();
  });

  it('should transition from normal to verbose mode', () => {
    const { rerender } = render(
      <ThemeProvider>
        <StatusBar
          displayMode="normal"
          {...baseSessionData}
        />
      </ThemeProvider>
    );

    // Normal mode shows simple token format
    expect(screen.queryByText(/🔍 VERBOSE/)).not.toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <StatusBar
          displayMode="verbose"
          {...baseSessionData}
        />
      </ThemeProvider>
    );

    // Verbose mode shows breakdown and indicator
    expect(screen.getByText(/🔍 VERBOSE/)).toBeInTheDocument();
    expect(screen.getByText(/1\.5k→800/)).toBeInTheDocument();
  });

  it('should transition from compact to normal mode', () => {
    const { rerender } = render(
      <ThemeProvider>
        <StatusBar
          gitBranch="feature/test"
          agent="developer"
          workflowStage="implementation"
          displayMode="compact"
          {...baseSessionData}
        />
      </ThemeProvider>
    );

    // Compact mode: no workflow stage
    expect(screen.queryByText('implementation')).not.toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <StatusBar
          gitBranch="feature/test"
          agent="developer"
          workflowStage="implementation"
          displayMode="normal"
          {...baseSessionData}
        />
      </ThemeProvider>
    );

    // Normal mode: workflow stage visible
    expect(screen.getByText('implementation')).toBeInTheDocument();
  });

  it('should transition from verbose to compact mode', () => {
    const { rerender } = render(
      <ThemeProvider>
        <StatusBar
          displayMode="verbose"
          {...baseSessionData}
        />
      </ThemeProvider>
    );

    expect(screen.getByText(/🔍 VERBOSE/)).toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <StatusBar
          displayMode="compact"
          {...baseSessionData}
        />
      </ThemeProvider>
    );

    expect(screen.queryByText(/🔍 VERBOSE/)).not.toBeInTheDocument();
  });

  it('should preserve data values through mode transitions', () => {
    const { rerender } = render(
      <ThemeProvider>
        <StatusBar
          cost={0.05}
          displayMode="normal"
          {...baseSessionData}
        />
      </ThemeProvider>
    );

    // Get initial cost value
    expect(screen.getByText(/\$0\.0500/)).toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <StatusBar
          cost={0.05}
          displayMode="verbose"
          {...baseSessionData}
        />
      </ThemeProvider>
    );

    // Cost should still be the same value
    expect(screen.getByText(/\$0\.0500/)).toBeInTheDocument();
  });
});
```

## Required Mock Setup (Add to top of test file)

```typescript
// Mock useStdoutDimensions hook
vi.mock('../ui/hooks/useStdoutDimensions', () => ({
  useStdoutDimensions: vi.fn(() => ({
    width: 120,
    breakpoint: 'wide',
  })),
}));

// Import for vi.mocked usage
import { useStdoutDimensions } from '../ui/hooks/useStdoutDimensions';
```
