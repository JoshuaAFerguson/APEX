# ADR: Agent Handoff Animation Architecture

**Status**: Accepted (Implemented)
**Date**: 2024
**Context**: AgentPanel enhancement to display animated transitions when agents change

## Decision

Implement agent handoff animations using a **Custom Hook + Presentation Component** architecture pattern.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AgentPanel                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                    useAgentHandoff(currentAgent)                    ││
│  │                                                                     ││
│  │  ┌─────────────────┐    ┌──────────────────────────────────────┐   ││
│  │  │  Agent Change   │───▶│     HandoffAnimationState            │   ││
│  │  │  Detection      │    │  - isAnimating: boolean              │   ││
│  │  │  (useRef +      │    │  - previousAgent: string | null      │   ││
│  │  │   useEffect)    │    │  - currentAgent: string | null       │   ││
│  │  └─────────────────┘    │  - progress: number (0-1)            │   ││
│  │                         │  - isFading: boolean                 │   ││
│  │  ┌─────────────────┐    └──────────────────────────────────────┘   ││
│  │  │  setInterval    │                     │                         ││
│  │  │  Animation Loop │─────────────────────┘                         ││
│  │  │  (30fps default)│                                               ││
│  │  └─────────────────┘                                               ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                   │                                     │
│                                   ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                      HandoffIndicator                               ││
│  │                                                                     ││
│  │  Props:                                                             ││
│  │  - animationState: HandoffAnimationState                           ││
│  │  - agentColors: Record<string, string>                             ││
│  │  - compact?: boolean                                               ││
│  │                                                                     ││
│  │  Renders:                                                          ││
│  │  "previousAgent → currentAgent" with fade effect                   ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Structure

### 1. `useAgentHandoff` Hook (`packages/cli/src/ui/hooks/useAgentHandoff.ts`)

**Responsibility**: State management and animation timing logic

**Interface**:
```typescript
interface HandoffAnimationState {
  isAnimating: boolean;       // Animation active flag
  previousAgent: string | null;
  currentAgent: string | null;
  progress: number;           // 0-1 normalized progress
  isFading: boolean;          // Fade-out phase indicator
}

interface UseAgentHandoffOptions {
  duration?: number;     // Total animation (default: 2000ms)
  fadeDuration?: number; // Fade phase (default: 500ms)
  frameRate?: number;    // Updates per second (default: 30)
}
```

**Key Design Decisions**:
- Uses `useRef` to track previous agent value (avoids stale closure issues)
- Uses `setInterval` for animation (terminal-compatible, no RAF dependency)
- Configurable timing via options object
- Auto-cleanup on unmount and animation completion
- Only animates when both previous and current agents are defined and different

### 2. `HandoffIndicator` Component (`packages/cli/src/ui/components/agents/HandoffIndicator.tsx`)

**Responsibility**: Pure presentation of handoff animation state

**Features**:
- **Compact Mode**: Inline display (`" previousAgent → currentAgent"`) with left margin
- **Full Mode**: Bordered box with "⚡ Handoff:" label
- **Fade Effect**: Uses `dimColor` prop and gray coloring when `progress > 0.75`
- **Color Support**: Accepts `agentColors` mapping for consistent theming

### 3. `AgentPanel` Integration (`packages/cli/src/ui/components/agents/AgentPanel.tsx`)

**Integration Points**:
```typescript
// Hook usage
const handoffState = useAgentHandoff(currentAgent);

// Compact mode: HandoffIndicator after agent list
// Full mode: HandoffIndicator after header, before agent list
<HandoffIndicator
  animationState={handoffState}
  agentColors={agentColors}
  compact={compact}
/>
```

## Data Flow

```
currentAgent prop changes
         │
         ▼
┌─────────────────────────────┐
│  useAgentHandoff detects    │
│  agent transition via       │
│  previousAgentRef           │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  startHandoffAnimation()    │
│  - Clear existing interval  │
│  - Set initial state        │
│  - Start 30fps interval     │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Animation Loop             │
│  - Calculate elapsed time   │
│  - Update progress (0-1)    │
│  - Set isFading at 75%      │
│  - Complete at 100%         │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  HandoffIndicator renders   │
│  based on animationState    │
└─────────────────────────────┘
```

## Animation Timeline (Default 2000ms)

```
0ms                    1500ms           2000ms
│──────────────────────│────────────────│
│    Active Display    │   Fade Out     │
│  progress: 0 → 0.75  │ progress: 0.75→1│
│  isFading: false     │ isFading: true │
│  Full color          │ Dimmed/gray    │
```

## Acceptance Criteria Mapping

| Requirement | Implementation |
|-------------|----------------|
| Animated transition when currentAgent changes | `useAgentHandoff` hook detects changes via ref comparison |
| Visual indicator "previousAgent → currentAgent" | `HandoffIndicator` renders arrow notation |
| Fades after 2 seconds | `duration: 2000`, fade starts at `duration - fadeDuration` |
| Works in compact mode | `HandoffIndicator` accepts `compact` prop |
| Works in full panel mode | `HandoffIndicator` renders bordered box in full mode |

## Design Rationale

### Why Custom Hook + Presentation Component?

1. **Separation of Concerns**: Timing logic isolated from rendering
2. **Testability**: Hook can be tested independently with fake timers
3. **Reusability**: Hook could be used by other components
4. **Performance**: React can optimize pure presentation component

### Why setInterval over requestAnimationFrame?

1. **Terminal Compatibility**: Ink (React for terminal) doesn't have RAF
2. **Consistent with Codebase**: Other animations use setInterval pattern
3. **Configurable Frame Rate**: Easy to adjust for performance

### Why dimColor for Fading?

1. **Terminal Native**: Works reliably across terminal emulators
2. **Ink Support**: Built-in Ink Text component feature
3. **Graceful Degradation**: Falls back to gray color

## File Organization

```
packages/cli/src/ui/
├── hooks/
│   ├── index.ts                    # Exports useAgentHandoff
│   ├── useAgentHandoff.ts          # Hook implementation
│   └── __tests__/
│       ├── useAgentHandoff.test.ts
│       └── useAgentHandoff.performance.test.ts
└── components/
    └── agents/
        ├── index.ts                # Exports AgentPanel, HandoffIndicator
        ├── AgentPanel.tsx          # Integration point
        ├── HandoffIndicator.tsx    # Presentation component
        └── __tests__/
            ├── AgentPanel.test.tsx
            ├── AgentPanel.integration.test.tsx
            ├── HandoffIndicator.test.tsx
            └── HandoffIndicator.edge-cases.test.tsx
```

## Testing Strategy

1. **Unit Tests**: Hook behavior with fake timers
2. **Component Tests**: HandoffIndicator rendering states
3. **Integration Tests**: AgentPanel + hook interaction
4. **Edge Cases**: Rapid changes, interruptions, cleanup

## Consequences

### Positive
- Clean architecture following React best practices
- Comprehensive test coverage
- Configurable animation parameters
- Consistent with existing codebase patterns

### Neutral
- Adds ~200 lines of code across 3 files
- Requires understanding of hook lifecycle for maintenance

### Negative
- None identified - implementation is straightforward

## Related Files

- `packages/cli/src/ui/hooks/useAgentHandoff.ts`
- `packages/cli/src/ui/components/agents/HandoffIndicator.tsx`
- `packages/cli/src/ui/components/agents/AgentPanel.tsx`
