# ADR-042: Agent Panel Visualization - Technical Design

## Status
Accepted (Documentation Complete)

## Date
2024-12-19

## Context

The APEX v0.3.0 documentation requires a comprehensive Agent Panel Visualization section in `docs/features/v030-features.md`. This ADR provides the technical architecture validation and design rationale for the agent panel visualization system, ensuring the documentation accurately reflects the implementation.

## Related ADRs
- **ADR-011**: Agent Handoff Animation Architecture
- **ADR-012**: AgentPanel Parallel Execution Props Architecture
- **ADR-013**: Enhanced AgentPanel Handoff Animations
- **ADR-014**: AgentPanel Enhancements Complete Architecture
- **ADR-020**: Display Modes (Compact/Verbose)
- **ADR-023**: AgentPanel Verbose Mode Architecture

## Architecture Overview

### Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           Agent Panel Visualization System                               │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                            Display Mode Determination                            │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                        │   │
│  │  │  compact prop │  │ displayMode   │  │  Breakpoint   │                        │   │
│  │  │   (boolean)   │──│    (enum)     │──│  (responsive) │───▶ Effective Mode     │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘                        │   │
│  │                                                                                  │   │
│  │  Priority: displayMode === 'verbose' > compact prop > responsive auto           │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                              │
│                    ┌─────────────────────┴─────────────────────┐                       │
│                    ▼                                           ▼                       │
│  ┌─────────────────────────────────────┐   ┌─────────────────────────────────────┐    │
│  │         CompactAgentPanel           │   │        DetailedAgentPanel           │    │
│  │  • Inline display                   │   │  • Full bordered sections           │    │
│  │  • Abbreviated names                │   │  • Progress bars                    │    │
│  │  • Minimal chrome                   │   │  • Stage information               │    │
│  └─────────────────────────────────────┘   │  • VerboseAgentRow (when verbose)   │    │
│                    │                       │  • AgentThoughts (when enabled)     │    │
│                    │                       └─────────────────────────────────────┘    │
│                    │                                           │                       │
│                    └───────────────┬───────────────────────────┘                       │
│                                    ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              Child Components                                    │   │
│  │                                                                                  │   │
│  │  ┌───────────────────────┐  ┌───────────────────────┐  ┌────────────────────┐   │   │
│  │  │   HandoffIndicator    │  │ ParallelExecutionView │  │    SubtaskTree     │   │   │
│  │  │   • Arrow animations  │  │ • Grid layout         │  │ • Hierarchical     │   │   │
│  │  │   • Color transitions │  │ • Agent cards         │  │ • Collapsible      │   │   │
│  │  │   • Progress bar      │  │ • Responsive columns  │  │ • Keyboard nav     │   │   │
│  │  └───────────────────────┘  └───────────────────────┘  └────────────────────┘   │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## Display Mode Architecture

### Mode Selection Logic

```typescript
// From AgentPanel.tsx - effective display mode calculation
const effectiveDisplayMode = useMemo(() => {
  // Verbose mode always respected (highest priority)
  if (displayMode === 'verbose') return 'verbose';

  // Explicit compact prop or displayMode
  if (compact || displayMode === 'compact') return 'compact';

  // Auto-compact based on responsive config
  if (config.useCompactLayout) return 'compact';

  return 'normal';
}, [displayMode, compact, config.useCompactLayout]);
```

### Responsive Configuration System

| Breakpoint | Width | Layout | Key Features |
|------------|-------|--------|--------------|
| **narrow** | < 60 | Compact | No borders, abbreviated names (6 chars), inline progress, no thoughts preview |
| **compact** | 60-79 | Compact | No borders, full names (10 chars), inline progress, max 3 parallel visible |
| **normal** | 80-119 | Full | Borders, progress bars (30 chars), stage info, thoughts preview (80 chars) |
| **wide** | 120+ | Full | Wide progress bars (40 chars), thoughts preview (150 chars), max 10 parallel visible |

### Agent Name Abbreviation Mapping

```typescript
const AGENT_ABBREVIATIONS = {
  planner: 'plan',
  architect: 'arch',
  developer: 'dev',
  reviewer: 'rev',
  tester: 'test',
  devops: 'ops',
};
```

## Handoff Animation Technical Design

### Animation State Machine

```
                    ┌────────────────┐
                    │    idle        │
                    │  (no handoff)  │
                    └───────┬────────┘
                            │ currentAgent changes
                            ▼
                    ┌────────────────┐
                    │   entering     │
                    │  (0-25% prog)  │
                    └───────┬────────┘
                            │ 25% progress
                            ▼
                    ┌────────────────┐
                    │    active      │
                    │  (25-75% prog) │
                    └───────┬────────┘
                            │ 75% progress
                            ▼
                    ┌────────────────┐
                    │   exiting      │ ──▶ Fade begins (dimColor: true)
                    │  (75-100% prog)│
                    └───────┬────────┘
                            │ 100% progress
                            ▼
                    ┌────────────────┐
                    │    idle        │ ──▶ Animation complete, state reset
                    └────────────────┘
```

### Arrow Animation Styles

| Style | Frame Sequence | Use Case |
|-------|----------------|----------|
| **basic** | `→`, `→→`, `→→→` | ASCII-compatible terminals |
| **enhanced** | `·→`, `→·`, `→→`, `→→·`, `→→→`, `→→→·`, `⟶→→`, `⟹` | Default smooth animation |
| **sparkle** | `✦→`, `→✦`, `→→✦`, `✦→→→`, `→→→✦`, `✦⟶→→`, `→⟶✦`, `⟹✦` | High-visibility mode |

### Color Transition Phases

| Progress | Source Agent | Arrow | Target Agent | Border Color |
|----------|--------------|-------|--------------|--------------|
| 0-30% | Bright (bold) | Dim | Faded (gray) | Gray |
| 30-50% | Normal | Normal | Dim | White |
| 50-70% | Dim | Normal | Normal | Target color |
| 70-100% | Faded (gray, dimColor) | Bright | Bright (bold) | Fading |

### HandoffIndicator Props Interface

```typescript
interface HandoffIndicatorProps {
  animationState: HandoffAnimationState;  // From useAgentHandoff hook
  agentColors: Record<string, string>;    // Color mapping
  compact?: boolean;                      // Inline display mode
  showElapsedTime?: boolean;              // Show handoff duration
  showProgressBar?: boolean;              // Progress bar (full mode only)
  showAgentIcons?: boolean;               // Emoji icons (default: true)
  agentIcons?: Record<string, string>;    // Custom icon mapping
  arrowStyle?: 'basic' | 'enhanced' | 'sparkle';
  enableColorTransition?: boolean;        // Smooth color transitions
  forceAsciiIcons?: boolean;              // Force ASCII-only
}
```

## Parallel Execution View Technical Design

### Column Calculation Algorithm

```typescript
function calculateMaxColumns(
  width: number,
  isNarrow: boolean,
  isCompact: boolean,
  isNormal: boolean,
  isWide: boolean,
  compact: boolean
): number {
  // Narrow: always 1 column (prevent overflow)
  if (isNarrow) return 1;

  // Compact: 2 columns unless compact mode
  if (isCompact) return compact ? 1 : 2;

  // Normal/Wide: calculate based on card width
  const cardWidth = compact ? 20 : 28;
  return Math.max(1, Math.floor(width / cardWidth));
}
```

### Card Layout Specifications

| Terminal Width | Card Width | Columns | Card Features |
|----------------|------------|---------|---------------|
| < 60 (narrow) | N/A | 1 (stacked) | Vertical stack, minimal info |
| 60-79 (compact) | ~20 chars | 2-3 | Border, name, stage, runtime |
| 80-119 (normal) | ~28 chars | 2-4 | Full card with progress bar |
| 120+ (wide) | ~28 chars | 4-6 | Full detail, more agents visible |

### ParallelAgent Interface

```typescript
interface ParallelAgent {
  name: string;
  status: 'parallel' | 'active' | 'completed' | 'waiting' | 'idle';
  stage?: string;
  progress?: number;  // 0-100
  startedAt?: Date;
}
```

## SubtaskTree Technical Design

### Node Structure

```typescript
interface SubtaskNode {
  id: string;                    // Unique identifier
  description: string;           // Task description
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  children?: SubtaskNode[];      // Nested subtasks
  progress?: number;             // 0-100 percentage
  startedAt?: Date;              // For elapsed time
  estimatedDuration?: number;    // Estimated ms
}
```

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `↑` / `k` | Move focus up |
| `↓` / `j` | Move focus down |
| `←` / `h` | Collapse or move to parent |
| `→` / `l` | Expand or move to first child |
| `Space` / `Enter` | Toggle collapse/expand |
| `g` | Move to first node |
| `G` | Move to last node |

### Visual Indicators

| Element | Symbol | Color |
|---------|--------|-------|
| Pending | `○` | Gray |
| In Progress | `●` | Blue |
| Completed | `✓` | Green |
| Failed | `✗` | Red |
| Expanded | `▼` | Cyan |
| Collapsed | `▶` | Cyan |
| Branch | `├──` / `└──` | Gray |
| Continuation | `│` | Gray |

## Integration Points

### Orchestrator Events

```typescript
// Events consumed by AgentPanel system
'agent:start'       // Agent begins execution
'agent:progress'    // Agent progress update
'agent:complete'    // Agent finishes execution
'agent:handoff'     // Control passes between agents
'parallel:start'    // Parallel execution begins
'parallel:update'   // Parallel agent progress
'parallel:complete' // Parallel execution ends
'subtask:create'    // New subtask created
'subtask:update'    // Subtask status change
'subtask:complete'  // Subtask finished
```

### Hook Integration

```typescript
// Primary hooks used by AgentPanel
useAgentHandoff(currentAgent)     // Handoff animation state
useElapsedTime(startedAt, interval)  // Real-time elapsed time
useStdoutDimensions()             // Terminal size and breakpoints
useOrchestratorEvents(orchestrator)  // Event-to-state bridge
```

## Configuration Schema

```yaml
# .apex/config.yaml agent panel configuration
ui:
  agentPanel:
    defaultMode: auto          # auto, compact, normal, verbose
    showProgressBars: true
    showElapsedTime: true
    showAgentIcons: true

    handoff:
      arrowStyle: enhanced     # basic, enhanced, sparkle
      showProgressBar: true
      enableColorTransition: true
      animationDuration: 2000  # ms

    parallel:
      maxColumnsOverride: null # null for auto, or explicit
      compactCards: false
      showStageInfo: true

    subtaskTree:
      maxDepth: 3
      defaultCollapsed: false
      showProgress: true
      showElapsedTime: true
      interactive: true

    breakpoints:
      narrow: 60
      compact: 80
      normal: 120
```

## Documentation Validation

The documentation in `docs/features/v030-features.md` Section 4 accurately reflects:

1. **AgentPanel Modes**: Full, Compact, Verbose with correct breakpoint behaviors
2. **Handoff Animations**: All three arrow styles with accurate frame sequences
3. **Parallel Execution View**: Correct grid layouts and responsive column calculation
4. **SubtaskTree**: Accurate status icons, keyboard navigation, and collapse behavior
5. **Component APIs**: Correct TypeScript interfaces matching implementation
6. **Configuration**: Valid YAML schema for `.apex/config.yaml`

## Consequences

### Positive
- Comprehensive documentation enables developer self-service
- Visual examples clarify component behavior
- Configuration options documented for customization
- Integration with orchestrator events clearly specified

### Negative
- Large documentation section requires maintenance
- Multiple animation styles increase complexity

### Neutral
- Documentation serves as living specification
- May require updates as features evolve

## Summary

The Agent Panel Visualization system provides:

- **Three Display Modes**: Full (bordered, detailed), Compact (inline, minimal), Verbose (debug info)
- **Handoff Animations**: Three arrow styles with color transitions and progress feedback
- **Parallel Execution View**: Responsive grid with automatic column calculation
- **SubtaskTree**: Interactive, collapsible hierarchical task visualization
- **Complete Configuration**: YAML-based customization of all visual behaviors

The documentation in `docs/features/v030-features.md` Section 4 has been validated against the implementation and accurately represents the technical architecture.

## References

- [AgentPanel.tsx](/packages/cli/src/ui/components/agents/AgentPanel.tsx)
- [HandoffIndicator.tsx](/packages/cli/src/ui/components/agents/HandoffIndicator.tsx)
- [ParallelExecutionView.tsx](/packages/cli/src/ui/components/agents/ParallelExecutionView.tsx)
- [SubtaskTree.tsx](/packages/cli/src/ui/components/agents/SubtaskTree.tsx)
- [v030-features.md](/docs/features/v030-features.md)
