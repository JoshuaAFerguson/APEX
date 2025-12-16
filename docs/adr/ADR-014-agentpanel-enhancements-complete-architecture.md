# ADR-014: AgentPanel Enhancements - Complete Architecture

## Status
Accepted (Implementation Complete)

## Date
2024-12-13

## Related ADRs
- **ADR-011**: Agent Handoff Animation Architecture (base implementation)
- **ADR-012**: AgentPanel Parallel Execution Props Architecture
- **ADR-013**: Enhanced AgentPanel Handoff Animations

## Context

The APEX v0.3.0 roadmap specified AgentPanel enhancements for:
1. **Handoff animations** - Visual transitions when agents change
2. **Parallel execution view** - Display agents working simultaneously

This ADR documents the complete technical architecture of these features, which have been fully implemented.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              AgentPanel Enhancement System                               │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                            Orchestrator Layer                                    │   │
│  │  ┌──────────────────────┐    ┌──────────────────────┐                          │   │
│  │  │   ApexOrchestrator   │    │     Event Emitter     │                          │   │
│  │  │   - runWorkflow()    │───▶│  - stage:parallel-started                        │   │
│  │  │   - stage execution  │    │  - stage:parallel-completed                      │   │
│  │  └──────────────────────┘    │  - agent:transition                              │   │
│  │                               └──────────────────────┘                          │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                              │
│                                          ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              REPL Event Handlers                                 │   │
│  │  orchestrator.on('stage:parallel-started', (taskId, stages, agents) => {        │   │
│  │    updateState({ parallelAgents: [...], showParallelPanel: true });             │   │
│  │  });                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                              │
│                                          ▼ Props                                        │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              AgentPanel Component                                │   │
│  │  Props: agents, currentAgent, compact, showParallel, parallelAgents             │   │
│  │                                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐│   │
│  │  │                        useAgentHandoff(currentAgent)                        ││   │
│  │  │  Returns: HandoffAnimationState                                             ││   │
│  │  │    - isAnimating, previousAgent, currentAgent, progress                     ││   │
│  │  │    - transitionPhase, pulseIntensity, arrowFrame                            ││   │
│  │  │    - handoffStartTime, isFading                                             ││   │
│  │  └─────────────────────────────────────────────────────────────────────────────┘│   │
│  │                                          │                                       │   │
│  │                                          ▼                                       │   │
│  │  ┌──────────────────────────────┐  ┌─────────────────────────────────────┐      │   │
│  │  │     HandoffIndicator         │  │        ParallelSection              │      │   │
│  │  │  - Animated arrows (→→→)     │  │  - ⟂ Parallel Execution header      │      │   │
│  │  │  - Pulse effects             │  │  - Cyan styling                     │      │   │
│  │  │  - Elapsed time [1.2s]       │  │  - Individual agent rows            │      │   │
│  │  │  - Progress bar              │  │  - Progress bars                    │      │   │
│  │  └──────────────────────────────┘  │  - Elapsed time tracking            │      │   │
│  │                                    └─────────────────────────────────────┘      │   │
│  │                                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐│   │
│  │  │                           AgentRow (per agent)                              ││   │
│  │  │  - Status icons (⚡ active, ○ waiting, ✓ completed, · idle, ⟂ parallel)     ││   │
│  │  │  - Color coding by agent name                                               ││   │
│  │  │  - Stage information                                                        ││   │
│  │  │  - Progress bar (when applicable)                                           ││   │
│  │  │  - Elapsed time tracking                                                    ││   │
│  │  └─────────────────────────────────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## Component Specifications

### 1. AgentInfo Type

```typescript
export interface AgentInfo {
  name: string;
  status: 'active' | 'waiting' | 'completed' | 'idle' | 'parallel';
  stage?: string;
  progress?: number; // 0-100
  startedAt?: Date; // When the agent started working
}
```

### 2. AgentPanelProps Interface

```typescript
export interface AgentPanelProps {
  agents: AgentInfo[];          // Main agent list
  currentAgent?: string;        // Currently active agent (drives handoff)
  compact?: boolean;            // Layout mode toggle
  showParallel?: boolean;       // Whether to show parallel section
  parallelAgents?: AgentInfo[]; // Agents executing in parallel
}
```

### 3. HandoffAnimationState Interface

```typescript
export interface HandoffAnimationState {
  // Core animation state
  isAnimating: boolean;
  previousAgent: string | null;
  currentAgent: string | null;
  progress: number;           // 0-1 normalized progress
  isFading: boolean;          // Fade-out phase indicator

  // Enhanced animation properties
  transitionPhase: 'entering' | 'active' | 'exiting' | 'idle';
  pulseIntensity: number;     // 0-1 for pulse effect
  arrowFrame: number;         // 0-2 for animated arrow
  handoffStartTime: Date | null;
}
```

### 4. Status Icons Mapping

```typescript
const statusIcons: Record<AgentInfo['status'], string> = {
  active: '⚡',     // Lightning bolt - currently executing
  waiting: '○',    // Circle - queued/pending
  completed: '✓',  // Checkmark - finished
  idle: '·',       // Dot - not yet started
  parallel: '⟂',   // Perpendicular - parallel execution
};
```

### 5. Agent Color Mapping

```typescript
const agentColors: Record<string, string> = {
  planner: 'magenta',
  architect: 'blue',
  developer: 'green',
  reviewer: 'yellow',
  tester: 'cyan',
  devops: 'red',
};
// Parallel agents always use 'cyan'
```

## Handoff Animation System

### Animation Timeline (2000ms default)

```
Time:     0ms          500ms         1500ms        2000ms
Phase:    [entering]   [active---------------]     [exiting]
Progress: 0            0.25                        1.0
Arrow:    →            →→                          →→→
Pulse:    ████         ▓▓▓▓▓▓▓▓▓▓▓▓                ░░░░░░
Fade:     Off          Off                         On (75%+)
```

### Phase Calculations

```typescript
function getTransitionPhase(progress: number) {
  if (progress === 0) return 'idle';
  if (progress < 0.25) return 'entering';
  if (progress < 0.75) return 'active';
  return 'exiting';
}

function getPulseIntensity(progress: number, frequency: number = 4) {
  return Math.sin(progress * Math.PI * frequency * 2) * 0.5 + 0.5;
}

function getArrowFrame(progress: number) {
  const frameIndex = Math.floor(progress * 60);
  return Math.min(Math.floor(frameIndex / 20), 2);
}
```

### Visual Effects

| Effect | Implementation |
|--------|---------------|
| Animated Arrow | Cycles through →, →→, →→→ |
| Pulse Effect | `bold` when intensity > 0.5, `dimColor` when < 0.3 |
| Elapsed Time | Format: `[X.Xs]` with sub-second precision |
| Fade Out | `dimColor: true` + gray color after 75% progress |
| Progress Bar | `████░░░░` with percentage in full mode |

## Parallel Execution System

### Display Conditions

| showParallel | parallelAgents.length | Result |
|--------------|----------------------|--------|
| false        | any                  | Hidden |
| true         | 0                    | Hidden |
| true         | 1                    | Hidden |
| true         | 2+                   | Shown  |

### Full Mode Layout

```
╭────────────────────────────────────╮
│ Active Agents                       │
├────────────────────────────────────┤
│ ⚡ planner (planning)               │
│ · architect                         │
│ · developer                         │
│ · tester                           │
│                                    │
│ ⟂ Parallel Execution                │
│   ⟂ developer (implementation)      │
│     ████████████░░░░░░░░ 50%       │
│   ⟂ tester (testing)                │
│     ██████░░░░░░░░░░░░░░ 30%       │
╰────────────────────────────────────╯
```

### Compact Mode Layout

```
⚡planner[42s] │ ○architect │ ⟂developer,tester
```

## Event Flow

### Parallel Execution Start

```
1. Orchestrator: this.emit('stage:parallel-started', taskId, stageNames, agentNames)
2. REPL Handler: Convert agents to AgentInfo[] with 'parallel' status
3. State Update: { parallelAgents: [...], showParallelPanel: true }
4. AgentPanel: Receives props, renders ParallelSection
```

### Agent Handoff

```
1. currentAgent prop changes from "planner" to "developer"
2. useAgentHandoff detects change via useRef comparison
3. startHandoffAnimation() begins 2-second animation
4. setInterval updates state at 30fps
5. HandoffIndicator renders animation
6. Animation completes, state resets
```

## File Structure

```
packages/cli/src/ui/
├── hooks/
│   ├── useAgentHandoff.ts          # Animation state management
│   ├── useElapsedTime.ts           # Time tracking hook
│   └── useOrchestratorEvents.ts    # Event-to-props bridge
│
└── components/agents/
    ├── AgentPanel.tsx              # Main component
    ├── HandoffIndicator.tsx        # Animation visualization
    └── index.ts                    # Exports
```

## Test Coverage

### Test Files (280+ test cases total)

| File | Purpose | Tests |
|------|---------|-------|
| `useAgentHandoff.test.ts` | Hook unit tests | 45 |
| `useAgentHandoff.enhanced.test.ts` | Enhanced features | 25 |
| `useAgentHandoff.performance.test.ts` | Performance tests | 12 |
| `HandoffIndicator.test.tsx` | Component tests | 35 |
| `HandoffIndicator.enhanced.test.tsx` | Enhanced features | 22 |
| `AgentPanel.test.tsx` | Core functionality | 65 |
| `AgentPanel.parallel-*.test.tsx` | Parallel features | 100+ |
| `AgentPanel.enhanced-handoff.test.tsx` | Handoff integration | 25 |

### Coverage Summary

- **Hook (useAgentHandoff)**: 100% branch coverage
- **HandoffIndicator**: 100% branch coverage
- **AgentPanel**: 100% branch coverage
- **ParallelSection**: 100% branch coverage

## Performance Considerations

1. **Animation Loop**: setInterval at 30fps (33ms intervals)
2. **Cleanup**: Proper interval cleanup on unmount and animation completion
3. **Render Optimization**: Animation state updates only during active animations
4. **Memory**: No memory leaks from orphaned timers

## Terminal Compatibility

All animations use Ink-native features:
- `Text` component properties: `bold`, `dimColor`, `color`
- Unicode characters: ⚡, ○, ✓, ·, ⟂, →, █, ░
- No CSS or browser-specific features
- Works in all terminals supporting ANSI colors

## Consequences

### Positive
- Clean separation between animation logic (hook) and presentation (components)
- Prop-based state flow following React patterns
- Comprehensive test coverage ensures reliability
- Terminal-compatible animation approach
- Extensible architecture for future enhancements

### Negative
- Animation adds CPU overhead during transitions
- Complex state management requires understanding of hook lifecycle

### Neutral
- ~500 lines of code across implementation files
- Additional test maintenance burden (280+ test cases)

## Summary

The AgentPanel enhancement implementation is **complete and production-ready**:

✅ **Handoff Animations**
- Animated arrows (→ → →→ → →→→)
- Pulse effects with sinusoidal intensity
- Elapsed time display with sub-second precision
- Progress bar in full mode
- Fade-out effect at 75%+ progress

✅ **Parallel Execution View**
- New `parallelAgents` and `showParallel` props
- `'parallel'` status with ⟂ icon and cyan styling
- Full mode dedicated section
- Compact mode inline display
- Progress tracking per parallel agent

✅ **Integration**
- Orchestrator events properly wired
- REPL handlers transform events to props
- Both compact and full modes supported
- Comprehensive test coverage

## References

- [AgentPanel.tsx](/packages/cli/src/ui/components/agents/AgentPanel.tsx)
- [HandoffIndicator.tsx](/packages/cli/src/ui/components/agents/HandoffIndicator.tsx)
- [useAgentHandoff.ts](/packages/cli/src/ui/hooks/useAgentHandoff.ts)
- [ROADMAP.md](/ROADMAP.md) - v0.3.0 specifications
