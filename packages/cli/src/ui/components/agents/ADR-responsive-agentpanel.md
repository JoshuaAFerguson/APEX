# ADR: Responsive AgentPanel Layout with useStdoutDimensions

## Status
Proposed

## Context

The `AgentPanel` component needs to be enhanced with responsive layout capabilities using the `useStdoutDimensions` hook. This follows the established pattern used by other components in the codebase (StatusBar, TaskProgress, ActivityLog).

### Acceptance Criteria (from task)
1. AgentPanel.tsx: Uses `useStdoutDimensions` hook
2. Automatically switches between compact/detailed mode based on terminal width
3. Narrow terminals show abbreviated agent info
4. Wide terminals show full agent details
5. No visual overflow at any width
6. Unit tests for responsive behavior

### Current State Analysis

**AgentPanel.tsx** (packages/cli/src/ui/components/agents/AgentPanel.tsx):
- Does **NOT** use `useStdoutDimensions` hook
- Has manual `compact` prop for display switching
- Has `displayMode` prop (`'normal' | 'compact' | 'verbose'`)
- Contains three display modes:
  - **Compact mode**: Single-line display with status icons and elapsed times
  - **Normal mode**: Multi-row with border, progress bars
  - **Verbose mode**: Uses `VerboseAgentRow` with debug info (tokens, turns, tool calls)
- **Key sub-components**:
  - `AgentRow` - Standard agent row display
  - `VerboseAgentRow` - Debug info display
  - `ParallelSection` - Parallel execution display
  - `ParallelExecutionView` - Detailed parallel view
  - `HandoffIndicator` - Agent transition animations
  - `AgentThoughts` - Extended thinking display

**useStdoutDimensions hook** (already exists):
```typescript
interface StdoutDimensions {
  width: number;
  height: number;
  breakpoint: 'narrow' | 'compact' | 'normal' | 'wide';
  isAvailable: boolean;
  isNarrow: boolean;   // < 60 cols
  isCompact: boolean;  // 60-100 cols
  isNormal: boolean;   // 100-160 cols
  isWide: boolean;     // >= 160 cols
}
```

### Reference Implementations

The codebase has established responsive patterns in:

1. **StatusBar.tsx**: Uses priority-based segment filtering and label abbreviation
2. **TaskProgress.tsx**: Auto-switches to compact mode in narrow terminals, adjusts description truncation
3. **ActivityLog.tsx**: Responsive message truncation, timestamp abbreviation

## Decision

### 1. Hook Integration

Add `useStdoutDimensions` hook to AgentPanel to enable automatic responsive switching:

```typescript
import { useStdoutDimensions } from '../../hooks/index.js';

export function AgentPanel({
  agents,
  currentAgent,
  compact = false,
  displayMode = 'normal',
  // ... other props
}: AgentPanelProps): React.ReactElement {
  const { width, breakpoint, isNarrow, isCompact } = useStdoutDimensions();

  // Automatic compact mode detection
  const effectiveDisplayMode = useMemo(() => {
    // If explicitly set to compact or verbose, respect that
    if (compact || displayMode === 'compact') return 'compact';
    if (displayMode === 'verbose') return 'verbose';

    // Auto-switch based on terminal width
    if (isNarrow) return 'compact';
    if (isCompact && agents.length > 3) return 'compact'; // Many agents in medium terminal

    return 'normal';
  }, [compact, displayMode, isNarrow, isCompact, agents.length]);

  // ... rest of component
}
```

### 2. Four-Tier Responsive Strategy

#### Tier 1: Narrow (< 60 cols) - COMPACT MODE
**Behavior**: Force compact single-line display
- Single line per agent: `⚡dev[12s] | ○test | ○review`
- Abbreviated agent names if needed
- No progress bars
- Minimal elapsed time display
- Hide parallel execution details

**Example output (50 cols):**
```
⚡dev[12s]|○test|○rev|○arch
```

#### Tier 2: Compact (60-100 cols) - AUTO-COMPACT
**Behavior**: Compact mode with slightly more space
- Full agent names allowed
- Vertical separators with spacing
- Show parallel indicator but not details
- Progress percentages inline (no bars)

**Example output (80 cols):**
```
⚡developer[42s] │ ○tester │ ○reviewer │ ⟂arch,dev
```

#### Tier 3: Normal (100-160 cols) - STANDARD MODE
**Behavior**: Full bordered display with progress bars
- Bordered panel with title
- Multi-row agent display
- Progress bars (width: 30)
- Stage info shown
- Parallel section visible

**Example output:**
```
╭─────────────────────────────────────────────────────────────╮
│ Active Agents                                                │
│ ⚡ developer (implementation) [42s]                         │
│   ████████████████░░░░░░░░░░░░░░ 65%                        │
│ ○ tester                                                     │
│ ⟂ Parallel Execution                                        │
│   ⟂ architect (design) [12s]                                │
╰─────────────────────────────────────────────────────────────╯
```

#### Tier 4: Wide (>= 160 cols) - EXPANDED MODE
**Behavior**: Full display with enhanced details
- Larger progress bars (width: 40)
- Additional metadata columns
- Token counts inline in normal mode
- Wider spacing for readability

### 3. Responsive Configuration Object

```typescript
interface ResponsiveAgentConfig {
  // Display settings
  useCompactLayout: boolean;
  showBorder: boolean;
  showTitle: boolean;

  // Agent row settings
  agentNameMaxLength: number;
  showStage: boolean;
  showElapsedTime: boolean;

  // Progress bar settings
  showProgressBars: boolean;
  progressBarWidth: number;

  // Parallel execution settings
  showParallelSection: boolean;
  showParallelDetails: boolean;

  // Thoughts display
  showThoughtsPreview: boolean;
  thoughtsMaxLength: number;
}

const getResponsiveConfig = (
  width: number,
  breakpoint: Breakpoint,
  agentCount: number
): ResponsiveAgentConfig => {
  // Narrow: absolute minimum
  if (breakpoint === 'narrow') {
    return {
      useCompactLayout: true,
      showBorder: false,
      showTitle: false,
      agentNameMaxLength: 8,
      showStage: false,
      showElapsedTime: true,
      showProgressBars: false,
      progressBarWidth: 0,
      showParallelSection: false,
      showParallelDetails: false,
      showThoughtsPreview: false,
      thoughtsMaxLength: 0,
    };
  }

  // Compact: condensed with some details
  if (breakpoint === 'compact' || (breakpoint === 'normal' && agentCount > 5)) {
    return {
      useCompactLayout: true,
      showBorder: false,
      showTitle: false,
      agentNameMaxLength: 12,
      showStage: false,
      showElapsedTime: true,
      showProgressBars: false,
      progressBarWidth: 0,
      showParallelSection: true,
      showParallelDetails: false,
      showThoughtsPreview: false,
      thoughtsMaxLength: 0,
    };
  }

  // Normal: standard display
  if (breakpoint === 'normal') {
    return {
      useCompactLayout: false,
      showBorder: true,
      showTitle: true,
      agentNameMaxLength: 16,
      showStage: true,
      showElapsedTime: true,
      showProgressBars: true,
      progressBarWidth: 30,
      showParallelSection: true,
      showParallelDetails: true,
      showThoughtsPreview: true,
      thoughtsMaxLength: 80,
    };
  }

  // Wide: full expanded display
  return {
    useCompactLayout: false,
    showBorder: true,
    showTitle: true,
    agentNameMaxLength: 24,
    showStage: true,
    showElapsedTime: true,
    showProgressBars: true,
    progressBarWidth: 40,
    showParallelSection: true,
    showParallelDetails: true,
    showThoughtsPreview: true,
    thoughtsMaxLength: 150,
  };
};
```

### 4. Updated Component Architecture

#### 4.1 Updated AgentPanel Props

```typescript
export interface AgentPanelProps {
  agents: AgentInfo[];
  currentAgent?: string;
  compact?: boolean;                    // Manual override to force compact
  showParallel?: boolean;
  parallelAgents?: AgentInfo[];
  useDetailedParallelView?: boolean;
  displayMode?: DisplayMode;
  showThoughts?: boolean;
  /** Optional explicit width (for testing or fixed-width containers) */
  width?: number;                       // NEW: Allow explicit width for testing
}
```

#### 4.2 Main Component Structure

```typescript
export function AgentPanel({
  agents,
  currentAgent,
  compact = false,
  showParallel = false,
  parallelAgents = [],
  useDetailedParallelView = false,
  displayMode = 'normal',
  showThoughts = false,
  width: explicitWidth,
}: AgentPanelProps): React.ReactElement {
  // Get responsive dimensions
  const { width: terminalWidth, breakpoint } = useStdoutDimensions();
  const width = explicitWidth ?? terminalWidth;

  // Get responsive configuration
  const config = useMemo(
    () => getResponsiveConfig(width, breakpoint, agents.length),
    [width, breakpoint, agents.length]
  );

  // Determine effective display mode
  const effectiveDisplayMode = useMemo(() => {
    if (displayMode === 'verbose') return 'verbose';
    if (compact || config.useCompactLayout) return 'compact';
    return 'normal';
  }, [displayMode, compact, config.useCompactLayout]);

  // Use handoff animation hook
  const handoffState = useAgentHandoff(currentAgent);

  // Render based on effective mode
  if (effectiveDisplayMode === 'compact') {
    return (
      <CompactAgentPanel
        agents={agents}
        currentAgent={currentAgent}
        config={config}
        handoffState={handoffState}
        showParallel={showParallel}
        parallelAgents={parallelAgents}
        width={width}
      />
    );
  }

  return (
    <DetailedAgentPanel
      agents={agents}
      currentAgent={currentAgent}
      config={config}
      handoffState={handoffState}
      showParallel={showParallel}
      parallelAgents={parallelAgents}
      useDetailedParallelView={useDetailedParallelView}
      displayMode={effectiveDisplayMode}
      showThoughts={showThoughts}
      width={width}
    />
  );
}
```

#### 4.3 Responsive Agent Row

```typescript
interface ResponsiveAgentRowProps {
  agent: AgentInfo;
  isActive: boolean;
  config: ResponsiveAgentConfig;
  displayMode: DisplayMode;
}

function ResponsiveAgentRow({
  agent,
  isActive,
  config,
  displayMode,
}: ResponsiveAgentRowProps): React.ReactElement {
  const color = agentColors[agent.name] || 'white';
  const finalColor = agent.status === 'parallel' ? 'cyan' : color;

  const shouldShowElapsed = config.showElapsedTime &&
    agent.status === 'active' && agent.startedAt;
  const elapsedTime = useElapsedTime(shouldShowElapsed ? agent.startedAt : null);

  const shouldShowProgressBar = config.showProgressBars &&
    (agent.status === 'active' || agent.status === 'parallel') &&
    agent.progress !== undefined && agent.progress > 0 && agent.progress < 100;

  // Truncate agent name if needed
  const displayName = agent.name.length > config.agentNameMaxLength
    ? agent.name.slice(0, config.agentNameMaxLength - 2) + '..'
    : agent.name;

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={isActive ? finalColor : 'gray'}>
          {statusIcons[agent.status]}{' '}
        </Text>
        <Text color={isActive ? finalColor : 'gray'} bold={isActive}>
          {displayName}
        </Text>
        {config.showStage && agent.stage && (
          <Text color="gray" dimColor>
            {' '}({agent.stage})
          </Text>
        )}
        {shouldShowElapsed && (
          <Text color="gray" dimColor>
            {' '}[{elapsedTime}]
          </Text>
        )}
      </Box>
      {shouldShowProgressBar && (
        <Box marginLeft={2} marginTop={1}>
          <ProgressBar
            progress={agent.progress!}
            width={config.progressBarWidth}
            showPercentage={true}
            color={finalColor}
            animated={false}
          />
        </Box>
      )}
    </Box>
  );
}
```

### 5. Compact Mode Abbreviations

For narrow terminals, agent names can be abbreviated:

| Full Name | Abbreviated (8 chars) | Abbreviated (4 chars) |
|-----------|----------------------|----------------------|
| planner | planner | plan |
| architect | architec | arch |
| developer | developer | dev |
| reviewer | reviewer | rev |
| tester | tester | test |
| devops | devops | ops |

### 6. Width Calculation Helpers

```typescript
/**
 * Calculate compact line width to prevent overflow
 */
function calculateCompactLineWidth(
  agents: AgentInfo[],
  config: ResponsiveAgentConfig
): number {
  // Each agent: icon(2) + name(config.agentNameMaxLength) + elapsed[5] + separator(3)
  const perAgent = 2 + config.agentNameMaxLength + 5 + 3;
  return agents.length * perAgent;
}

/**
 * Determine if we need to abbreviate names further
 */
function shouldAbbreviateNames(
  agents: AgentInfo[],
  availableWidth: number,
  config: ResponsiveAgentConfig
): boolean {
  return calculateCompactLineWidth(agents, config) > availableWidth;
}
```

### 7. Testing Strategy

#### 7.1 New Test File: `AgentPanel.responsive.test.tsx`

```typescript
describe('AgentPanel - Responsive Layout', () => {
  describe('useStdoutDimensions integration', () => {
    it('uses useStdoutDimensions hook to get terminal width');
    it('respects explicit width prop for testing');
    it('handles missing dimensions gracefully with fallbacks');
  });

  describe('Narrow terminals (< 60 cols)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions({ width: 50, breakpoint: 'narrow' });
    });

    it('automatically switches to compact mode');
    it('shows abbreviated agent info');
    it('hides progress bars');
    it('hides parallel section details');
    it('does not overflow terminal width');
    it('abbreviates agent names when necessary');
  });

  describe('Compact terminals (60-100 cols)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions({ width: 80, breakpoint: 'compact' });
    });

    it('uses compact layout with full agent names');
    it('shows parallel indicator without details');
    it('displays elapsed time inline');
  });

  describe('Normal terminals (100-160 cols)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions({ width: 120, breakpoint: 'normal' });
    });

    it('shows bordered panel with title');
    it('displays progress bars with standard width');
    it('shows stage information');
    it('shows parallel section with details');
    it('shows thoughts preview when enabled');
  });

  describe('Wide terminals (>= 160 cols)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions({ width: 180, breakpoint: 'wide' });
    });

    it('shows full agent details');
    it('uses wider progress bars');
    it('shows extended thoughts');
    it('has generous spacing');
  });

  describe('Display mode interactions', () => {
    it('compact prop overrides responsive auto-switching');
    it('verbose mode shows debug info regardless of width');
    it('displayMode compact is respected over auto-switching');
  });

  describe('No overflow at any width', () => {
    it.each([40, 50, 60, 80, 100, 120, 160, 200])(
      'renders without overflow at width %d',
      (width) => {
        // Render and verify no line exceeds width
      }
    );

    it('handles many agents in narrow terminal');
    it('truncates long agent names appropriately');
    it('abbreviates parallel agent list when needed');
  });

  describe('Edge cases', () => {
    it('handles single agent');
    it('handles 10+ agents');
    it('handles parallel agents with narrow terminal');
    it('handles terminal resize');
    it('handles undefined dimensions');
  });
});
```

#### 7.2 Mock Setup Helper

```typescript
// packages/cli/src/ui/components/agents/__tests__/test-helpers.ts

export function mockUseStdoutDimensions(dimensions: Partial<StdoutDimensions>) {
  const defaults: StdoutDimensions = {
    width: 120,
    height: 40,
    breakpoint: 'normal',
    isAvailable: true,
    isNarrow: false,
    isCompact: false,
    isNormal: true,
    isWide: false,
  };

  jest.mock('../../hooks/index.js', () => ({
    ...jest.requireActual('../../hooks/index.js'),
    useStdoutDimensions: () => ({ ...defaults, ...dimensions }),
  }));
}

export function createMockAgents(count: number, currentIndex = 0): AgentInfo[] {
  const names = ['planner', 'architect', 'developer', 'tester', 'reviewer', 'devops'];
  return Array.from({ length: count }, (_, i) => ({
    name: names[i % names.length],
    status: i === currentIndex ? 'active' : 'idle',
    stage: i === currentIndex ? 'implementation' : undefined,
    progress: i === currentIndex ? 65 : undefined,
    startedAt: i === currentIndex ? new Date() : undefined,
  }));
}
```

### 8. Implementation Plan

#### Phase 1: Hook Integration (1-2 hours)
1. Import `useStdoutDimensions` hook
2. Add `width` prop for testing
3. Create `getResponsiveConfig` function
4. Calculate `effectiveDisplayMode` based on width

#### Phase 2: Compact Mode Enhancement (2-3 hours)
1. Create `CompactAgentPanel` sub-component
2. Implement agent name abbreviation
3. Add overflow prevention logic
4. Test at various narrow widths

#### Phase 3: Responsive AgentRow (2-3 hours)
1. Create `ResponsiveAgentRow` component
2. Add configurable progress bar widths
3. Implement stage visibility control
4. Add thoughts preview truncation

#### Phase 4: Test Suite (3-4 hours)
1. Create `AgentPanel.responsive.test.tsx`
2. Add mock helpers
3. Test all breakpoints
4. Add overflow prevention tests
5. Update existing tests if needed

#### Phase 5: Integration & Polish (1-2 hours)
1. Manual testing in various terminal sizes
2. Verify no overflow at edge cases
3. Ensure backward compatibility
4. Update documentation

### 9. File Structure

```
packages/cli/src/ui/components/agents/
├── AgentPanel.tsx                      # UPDATE: Add responsive logic
├── ADR-responsive-agentpanel.md        # NEW: This document
├── VerboseAgentRow.tsx                 # No changes needed
├── HandoffIndicator.tsx                # No changes needed
├── ParallelExecutionView.tsx           # No changes needed
└── __tests__/
    ├── AgentPanel.test.tsx             # UPDATE: Add mock dimensions
    └── AgentPanel.responsive.test.tsx  # NEW: Comprehensive responsive tests
```

## Consequences

### Positive
- AgentPanel adapts intelligently to all terminal widths
- No visual overflow or truncation at any size
- Follows established responsive patterns in codebase
- Backward compatible with existing props
- Improved UX in narrow terminals (like split panes)

### Negative
- Increased component complexity
- Additional test coverage required
- May need fine-tuning of breakpoint thresholds

### Neutral
- Consistent with StatusBar, TaskProgress, ActivityLog patterns
- Uses existing `useStdoutDimensions` hook

## API Changes

**No breaking changes** - existing props work as before.

**New optional prop:**
- `width?: number` - Explicit width override for testing

**Behavioral changes:**
- Component auto-switches to compact mode in narrow terminals
- Agent names abbreviated when necessary
- Progress bars hidden in narrow mode
- Parallel section condensed in compact mode

## Dependencies

- `useStdoutDimensions` hook (exists in codebase)
- No new external dependencies

## Related Documents

- `ADR-responsive-statusbar.md` - Similar responsive pattern
- `ADR-responsive-taskprogress.md` - Similar responsive pattern
- `ADR-responsive-activitylog-errordisplay.md` - Similar responsive pattern
- `ADR-useStdoutDimensions.md` - Hook documentation
