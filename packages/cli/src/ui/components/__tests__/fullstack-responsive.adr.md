# ADR: Full-Stack Responsive Integration Test Design

## Status
Proposed

## Context
The APEX CLI has 5 responsive UI components that need to be tested together in a realistic App-like layout:
1. **StatusBar** - Displays connection status, git branch, tokens, cost, model info
2. **Banner** - Shows APEX branding, version, project path
3. **AgentPanel** - Shows agent workflow status with progress bars
4. **Content Components** (ActivityLog, TaskProgress, ResponseStream)
5. **ErrorDisplay** - Shows errors with stack traces and suggestions

Each component has responsive behavior that adapts to terminal width breakpoints:
- **narrow**: < 60 columns
- **compact**: 60-99 columns
- **normal**: 100-159 columns
- **wide**: >= 160 columns

## Decision

### Test File Location
```
packages/cli/src/ui/components/__tests__/fullstack-responsive.integration.test.tsx
```

### Test Architecture

#### 1. Composed Layout Wrapper
Create a `FullStackLayout` test component that mimics the App.tsx structure:

```tsx
interface FullStackLayoutProps {
  width: TerminalWidth;
  error?: Error | null;
  // Component-specific props
  statusBarProps: StatusBarProps;
  bannerProps: BannerProps;
  agentPanelProps: AgentPanelProps;
  activityLogProps: ActivityLogProps;
  taskProgressProps: TaskProgressProps;
}

function FullStackLayout(props: FullStackLayoutProps) {
  return (
    <Box flexDirection="column" width={props.width}>
      <Banner {...props.bannerProps} />
      <Box flexDirection="row">
        <Box flexDirection="column" flexGrow={1}>
          <AgentPanel {...props.agentPanelProps} />
          <ActivityLog {...props.activityLogProps} />
          <TaskProgress {...props.taskProgressProps} />
        </Box>
      </Box>
      {props.error && <ErrorDisplay error={props.error} />}
      <StatusBar {...props.statusBarProps} />
    </Box>
  );
}
```

#### 2. Terminal Width Test Matrix
Test at all 5 standard widths with corresponding heights:

| Width | Height | Breakpoint | Test Focus |
|-------|--------|------------|------------|
| 40    | 24     | narrow     | Minimal info, abbreviations, no borders |
| 60    | 24     | compact    | Compact layout, limited parallel display |
| 80    | 24     | compact    | Standard terminal, medium priority segments |
| 120   | 30     | normal     | Full layout, progress bars, stage info |
| 160   | 40     | wide       | All segments, detailed parallel view |

#### 3. Test Categories

##### Category A: Static Composition Tests
Verify all components render together without overflow:
- Each breakpoint width
- Mixed component states (active/idle agents, errors present)
- Long content scenarios (long git branches, session names)

##### Category B: No Overflow/Truncation Verification
Assert content stays within bounds:
- Total rendered width <= terminal width
- No horizontal scrolling indicators
- Proper ellipsis truncation on long strings

##### Category C: Dynamic Resize Scenario
Simulate terminal resize during render:
1. Start at width 80
2. Resize to 40 (narrow)
3. Verify all components adapt
4. Resize to 160 (wide)
5. Verify all components expand appropriately

#### 4. Assertion Helpers

```typescript
// Reuse from responsive-layout-foundation.integration.test.tsx
export function expectNoOverflow(element: HTMLElement, maxWidth: number): void;
export function expectTruncated(element: HTMLElement, originalText: string): void;
export function expectNotTruncated(element: HTMLElement, originalText: string): void;

// New helper for composed layouts
export function expectLayoutIntegrity(container: HTMLElement, width: number): void {
  // Check no element exceeds container width
  // Verify critical content is visible
  // Check responsive breakpoint-specific behavior
}
```

### Test Scenarios

#### Scenario 1: Full Composition at All 5 Widths
```typescript
describe('Full-stack composition at all terminal widths', () => {
  const widths: TerminalWidth[] = [40, 60, 80, 120, 160];

  widths.forEach(width => {
    it(`renders all components without overflow at ${width} columns`, () => {
      // Render FullStackLayout with standard props
      // Assert no overflow
      // Verify critical elements visible
      // Check breakpoint-specific adaptations
    });
  });
});
```

#### Scenario 2: Component Interaction Verification
```typescript
describe('Cross-component consistency', () => {
  it('all components use same terminal width from hook', () => {
    // Verify useStdoutDimensions called by each component
    // Confirm consistent breakpoint classification
  });

  it('components do not interfere with each other layout', () => {
    // Banner doesn't affect StatusBar width calculation
    // AgentPanel progress bars fit within bounds
  });
});
```

#### Scenario 3: Dynamic Resize
```typescript
describe('Dynamic terminal resize', () => {
  it('adapts from narrow to wide terminal', () => {
    const { setWidth, rerender } = renderResponsive(<FullStackLayout {...props} />, { width: 40 });

    // Verify narrow layout
    expect(screen.queryByText('█████╗')).not.toBeInTheDocument(); // No ASCII art

    // Resize to wide
    setWidth(160);

    // Verify wide layout
    expect(screen.getByText('█████╗')).toBeInTheDocument(); // ASCII art visible
    expect(screen.getByText(/test-session/)).toBeInTheDocument(); // Low priority segments
  });

  it('maintains layout integrity during rapid resize', () => {
    // Simulate multiple rapid resizes
    // Verify no layout breakage
  });
});
```

#### Scenario 4: Error State Composition
```typescript
describe('Error display in composed layout', () => {
  it('ErrorDisplay integrates correctly at all widths', () => {
    const error = new Error('Test error with a very long message...');
    error.stack = 'at Component (/path/to/file.ts:100:20)...';

    widths.forEach(width => {
      // Render with error
      // Verify error message truncation at narrow
      // Verify stack trace visibility based on breakpoint
      // Confirm suggestions display properly
    });
  });
});
```

### Implementation Dependencies

1. **Existing Utilities**:
   - `responsive-layout-foundation.integration.test.tsx` - mockTerminalWidth, TERMINAL_CONFIGS
   - `test-utils.tsx` - ThemeProvider, mockTheme
   - Component mocks (ink, ink-spinner)

2. **Component Imports**:
   ```typescript
   import { StatusBar } from '../StatusBar.js';
   import { Banner } from '../Banner.js';
   import { AgentPanel } from '../agents/AgentPanel.js';
   import { ActivityLog } from '../ActivityLog.js';
   import { TaskProgress } from '../TaskProgress.js';
   import { ErrorDisplay } from '../ErrorDisplay.js';
   ```

3. **Mock Setup**:
   - useStdoutDimensions hook (all components use this)
   - useAgentHandoff hook (AgentPanel uses this)
   - useElapsedTime hook (multiple components use this)

### Acceptance Criteria Mapping

| Criterion | Test Coverage |
|-----------|---------------|
| Renders all 5 components together | Scenario 1 |
| Tests at 5 terminal widths (40, 60, 80, 120, 160) | All scenarios parameterized by width |
| No overflow/truncation across composed UI | Category B assertions |
| Dynamic resize scenario | Scenario 3 |

## Consequences

### Positive
- Comprehensive integration testing of responsive behavior
- Catches cross-component layout issues
- Validates real-world App-like composition
- Reuses existing test infrastructure

### Negative
- Test file will be moderately large (~400-600 lines)
- May need to mock additional hooks for full coverage
- Performance sensitive due to multiple rerenders

### Risks
- Component API changes may require test updates
- Mock accuracy vs actual Ink rendering behavior

## Related Decisions
- Follows patterns from `cross-component-responsive.integration.test.tsx`
- Uses utilities from `responsive-layout-foundation.integration.test.tsx`
- Aligns with existing component test patterns in `__tests__` directories
