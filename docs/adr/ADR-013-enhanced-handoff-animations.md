# ADR-013: Enhanced AgentPanel Handoff Animations

## Status
Accepted (Implementation Complete)

## Related ADRs
- **ADR-011**: Agent Handoff Animation Architecture (base implementation) - *Extends*

## Context
The current AgentPanel handoff animation system (implemented per ADR-011) provides basic visual feedback when agents transition during workflow execution. While functional, user feedback indicates the animations need to be more visually prominent to effectively communicate handoff events. The current implementation uses a simple fade-out effect without elapsed time display or visual highlights for the incoming agent.

### Current Implementation Analysis (ADR-011)
1. **`useAgentHandoff` hook**: Manages animation state with progress tracking (0-1), 2000ms duration, 500ms fade phase, 30fps updates
2. **`HandoffIndicator` component**: Shows "previousAgent → currentAgent" with basic fade-out dimming
3. **Animation mechanics**: setInterval-based for terminal compatibility (Ink/React for terminal)

### Acceptance Criteria (New Enhancements)
1. Handoff animation is more visually prominent with transition effects
2. Add elapsed time display during handoff
3. Add visual pulse/highlight effect for new agent
4. Tests pass for enhanced handoff behavior

## Decision

### Architecture Overview

We will enhance the existing handoff animation system with three key improvements while maintaining backward compatibility and terminal-compatible animations:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Enhanced Handoff System                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐    ┌─────────────────────────────┐    │
│  │  useAgentHandoff     │    │  NEW: useHandoffElapsedTime │    │
│  │  (enhanced)          │───▶│  - Tracks handoff duration   │    │
│  │  - pulsePhase        │    │  - Formats elapsed time      │    │
│  │  - transitionPhase   │    └─────────────────────────────┘    │
│  │  - highlightIntensity│                                       │
│  └──────────────────────┘                                       │
│            │                                                     │
│            ▼                                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               HandoffIndicator (enhanced)                 │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐  │   │
│  │  │ Elapsed Time │ │ Pulse Effect │ │ Transition Arrow │  │   │
│  │  │   Display    │ │   (new agent)│ │   (animated)     │  │   │
│  │  └──────────────┘ └──────────────┘ └──────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1. Enhanced Animation State (`useAgentHandoff`)

Extend `HandoffAnimationState` interface to include new animation phases:

```typescript
export interface HandoffAnimationState {
  // Existing properties
  isAnimating: boolean;
  previousAgent: string | null;
  currentAgent: string | null;
  progress: number;        // 0-1 overall progress
  isFading: boolean;

  // NEW: Enhanced animation properties
  transitionPhase: 'entering' | 'active' | 'exiting' | 'idle';
  pulseIntensity: number;  // 0-1 for pulse effect on new agent
  arrowFrame: number;      // 0-2 for animated arrow ("→", "→→", "→→→")
  handoffStartTime: Date | null;  // For elapsed time tracking
}
```

**Animation Timeline (2000ms total)**:
```
Time:     0ms         500ms       1500ms      2000ms
Phase:    [entering]  [active-------------]  [exiting]
Pulse:    ████████    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓    ░░░░░░░░
Arrow:    →           →→                     →→→
```

### 2. Elapsed Time During Handoff

Create a new hook or extend existing logic to track and display handoff duration:

```typescript
// Option A: Utilize existing handoffStartTime in state
// Display format: "[0.5s]", "[1.2s]", "[2.0s]"

// The HandoffIndicator will show elapsed time like:
// "⚡ Handoff [1.2s]: planner → developer"
```

**Implementation approach**: Leverage the existing `formatElapsed` utility from `@apexcli/core` but format milliseconds for sub-second precision during handoff (since handoffs are brief).

### 3. Visual Pulse/Highlight Effect

Implement terminal-compatible pulse using character/color cycling:

```typescript
// Pulse effect implementation for terminal (Ink)
// Uses dimColor, bold, and color intensity cycling

const pulseStyles = {
  high: { bold: true, dimColor: false },   // Full intensity
  medium: { bold: true, dimColor: true },   // Medium intensity
  low: { bold: false, dimColor: true },     // Low intensity
};

// Cycle through: high → medium → low → medium → high
// At 30fps with ~4 cycles over 2 seconds = 15 frames per cycle
```

**Arrow Animation Sequence**:
```
Frame 0-20:   "→"
Frame 21-40:  "→→"
Frame 41-60:  "→→→"
(repeat or hold based on phase)
```

### 4. Enhanced Visual Display

#### Full Mode Layout
```
╭──────────────────────────────────────╮
│ ⚡ Handoff [1.2s]: planner → developer│
│ ════════════════════════════════════ │ ← Progress bar (new)
│ ████████████████░░░░░░░░░░ 60%       │
╰──────────────────────────────────────╯
```

#### Compact Mode Layout
```
⚡planner[42s] │ ○architect │ ⚡developer[0s] │ [planner →→ developer 1.2s]
                                              ↑ Pulsing highlight on new agent
```

### Component Changes

#### `useAgentHandoff.ts` Modifications

```typescript
// Enhanced options
export interface UseAgentHandoffOptions {
  duration?: number;          // Default: 2000ms
  fadeDuration?: number;      // Default: 500ms
  frameRate?: number;         // Default: 30fps
  enablePulse?: boolean;      // Default: true (NEW)
  enableProgressBar?: boolean; // Default: true (NEW)
}

// Enhanced state calculation in setInterval callback
const calculateAnimationState = (elapsed: number, duration: number) => {
  const progress = Math.min(elapsed / duration, 1);

  // Phase determination
  const enteringEnd = 0.25;  // First 25% = entering
  const activeEnd = 0.75;    // Middle 50% = active
  // Last 25% = exiting

  const transitionPhase =
    progress < enteringEnd ? 'entering' :
    progress < activeEnd ? 'active' : 'exiting';

  // Pulse intensity (sinusoidal for smooth pulsing)
  const pulseFrequency = 4; // 4 pulses over duration
  const pulseIntensity = Math.sin(progress * Math.PI * pulseFrequency * 2) * 0.5 + 0.5;

  // Arrow frame (cycles through 3 states)
  const arrowFrame = Math.floor((progress * 60) / 20) % 3;

  return { progress, transitionPhase, pulseIntensity, arrowFrame };
};
```

#### `HandoffIndicator.tsx` Modifications

```typescript
export interface HandoffIndicatorProps {
  animationState: HandoffAnimationState;
  agentColors: Record<string, string>;
  compact?: boolean;
  showElapsedTime?: boolean;   // NEW: Default true
  showProgressBar?: boolean;   // NEW: Default true (full mode only)
}

// Enhanced render with pulse effect
const getPulseStyle = (intensity: number) => ({
  bold: intensity > 0.5,
  dimColor: intensity < 0.3,
});

// Animated arrow based on arrowFrame
const getAnimatedArrow = (frame: number) =>
  ['→', '→→', '→→→'][frame] || '→';
```

### Test Strategy

1. **Unit Tests** (`useAgentHandoff.test.ts`):
   - Verify `transitionPhase` transitions correctly through phases
   - Verify `pulseIntensity` oscillates within 0-1 range
   - Verify `arrowFrame` cycles through 0, 1, 2
   - Verify `handoffStartTime` is set on animation start

2. **Component Tests** (`HandoffIndicator.test.tsx`):
   - Verify elapsed time displays and updates
   - Verify pulse styling applies correctly based on intensity
   - Verify animated arrow renders correctly
   - Verify progress bar renders in full mode

3. **Integration Tests** (`AgentPanel.test.tsx`):
   - Verify enhanced handoff works in both compact and full modes
   - Verify no regression in existing behavior
   - Verify performance with rapid agent changes

### File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/cli/src/ui/hooks/useAgentHandoff.ts` | Modify | Add new state properties, phase calculation |
| `packages/cli/src/ui/components/agents/HandoffIndicator.tsx` | Modify | Add elapsed time, pulse effect, animated arrow, progress bar |
| `packages/cli/src/ui/hooks/useAgentHandoff.test.ts` | Modify | Add tests for new animation properties |
| `packages/cli/src/ui/components/agents/__tests__/HandoffIndicator.test.tsx` | Create | New tests for enhanced indicator |
| `packages/cli/src/ui/components/agents/__tests__/AgentHandoff.enhanced.test.tsx` | Create | Acceptance tests for enhancements |

### Migration & Backward Compatibility

- All new properties have sensible defaults
- Existing consumers of `useAgentHandoff` will work without changes
- New features are opt-in via new props (`showElapsedTime`, `showProgressBar`)
- No breaking changes to existing interfaces

## Consequences

### Positive
- More visually prominent handoff animations improve user awareness
- Elapsed time provides useful feedback during transitions
- Pulse effect draws attention to the new active agent
- Animation phases create a smoother, more polished visual experience
- Progress bar gives clear indication of handoff completion

### Negative
- Slightly increased CPU usage from additional animation calculations
- More complex animation state to maintain
- Additional test coverage required

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Animation jank in slow terminals | Keep 30fps default, provide option to reduce |
| Visual clutter in compact mode | Elapsed time only, no progress bar in compact |
| Color accessibility issues | Rely on bold/dim rather than color alone for pulse |

## Implementation Notes

### Order of Implementation
1. Extend `HandoffAnimationState` interface
2. Update `useAgentHandoff` hook with new calculations
3. Update `HandoffIndicator` component with new visuals
4. Add/update unit tests
5. Add acceptance tests
6. Manual testing in both modes

### Performance Considerations
- Pulse calculation uses simple math (sin function) - minimal overhead
- Arrow frame is simple modulo operation
- No additional DOM elements, just different text rendering
- setInterval cleanup already properly handled

### Terminal Compatibility
- Uses Ink's native `Text` properties: `bold`, `dimColor`, `color`
- No CSS animations or browser-specific features
- Works in all terminals that support ANSI colors/formatting

## Detailed Interface Specifications

### Updated `HandoffAnimationState` Interface

```typescript
export interface HandoffAnimationState {
  // ====== Existing Properties (from ADR-011) ======
  /** Whether a handoff is currently being animated */
  isAnimating: boolean;
  /** Previous agent in the transition */
  previousAgent: string | null;
  /** Current agent in the transition */
  currentAgent: string | null;
  /** Animation progress (0-1) */
  progress: number;
  /** Whether the animation is in the fade-out phase */
  isFading: boolean;

  // ====== NEW: Enhanced Animation Properties ======
  /** Current phase of the transition animation */
  transitionPhase: 'entering' | 'active' | 'exiting' | 'idle';
  /** Pulse intensity for highlight effect (0-1, oscillates) */
  pulseIntensity: number;
  /** Current frame of animated arrow (0=→, 1=→→, 2=→→→) */
  arrowFrame: number;
  /** Timestamp when handoff animation started (for elapsed time) */
  handoffStartTime: Date | null;
}
```

### Updated `UseAgentHandoffOptions` Interface

```typescript
export interface UseAgentHandoffOptions {
  // ====== Existing Options (from ADR-011) ======
  /** Duration of the full animation in milliseconds (default: 2000) */
  duration?: number;
  /** Duration of the fade-out phase in milliseconds (default: 500) */
  fadeDuration?: number;
  /** Frame rate for animation updates (default: 30) */
  frameRate?: number;

  // ====== NEW: Enhancement Options ======
  /** Enable pulse effect on new agent (default: true) */
  enablePulse?: boolean;
  /** Frequency of pulse cycles during animation (default: 4) */
  pulseFrequency?: number;
}
```

### Updated `HandoffIndicatorProps` Interface

```typescript
export interface HandoffIndicatorProps {
  // ====== Existing Props (from ADR-011) ======
  /** Animation state from useAgentHandoff hook */
  animationState: HandoffAnimationState;
  /** Color mapping for agents */
  agentColors: Record<string, string>;
  /** Compact mode for inline display */
  compact?: boolean;

  // ====== NEW: Enhancement Props ======
  /** Show elapsed time during handoff (default: true) */
  showElapsedTime?: boolean;
  /** Show progress bar in full mode (default: true) */
  showProgressBar?: boolean;
}
```

### Helper Function Specifications

```typescript
/**
 * Calculate transition phase based on progress
 * @param progress - Animation progress (0-1)
 * @returns Current transition phase
 */
function getTransitionPhase(progress: number): 'entering' | 'active' | 'exiting' | 'idle' {
  if (progress === 0) return 'idle';
  if (progress < 0.25) return 'entering';
  if (progress < 0.75) return 'active';
  return 'exiting';
}

/**
 * Calculate pulse intensity using sinusoidal wave
 * @param progress - Animation progress (0-1)
 * @param frequency - Number of pulse cycles (default: 4)
 * @returns Pulse intensity (0-1)
 */
function getPulseIntensity(progress: number, frequency: number = 4): number {
  return Math.sin(progress * Math.PI * frequency * 2) * 0.5 + 0.5;
}

/**
 * Get arrow frame for animated transition arrow
 * @param progress - Animation progress (0-1)
 * @returns Arrow frame index (0, 1, or 2)
 */
function getArrowFrame(progress: number): number {
  const totalFrames = 60; // At 30fps, 2 seconds = 60 frames
  const frameIndex = Math.floor(progress * totalFrames);
  return Math.min(Math.floor(frameIndex / 20), 2);
}

/**
 * Get animated arrow string based on frame
 * @param frame - Arrow frame index (0, 1, or 2)
 * @returns Arrow string ("→", "→→", or "→→→")
 */
function getAnimatedArrow(frame: number): string {
  const arrows = ['→', '→→', '→→→'];
  return arrows[Math.min(frame, 2)];
}

/**
 * Format handoff elapsed time with sub-second precision
 * @param startTime - When handoff started
 * @param currentTime - Current time (default: now)
 * @returns Formatted time string (e.g., "0.5s", "1.2s")
 */
function formatHandoffElapsed(startTime: Date, currentTime: Date = new Date()): string {
  const elapsedMs = currentTime.getTime() - startTime.getTime();
  const seconds = elapsedMs / 1000;
  return `${seconds.toFixed(1)}s`;
}

/**
 * Get pulse styling for Ink Text component
 * @param intensity - Pulse intensity (0-1)
 * @returns Style props object
 */
function getPulseStyle(intensity: number): { bold: boolean; dimColor: boolean } {
  return {
    bold: intensity > 0.5,
    dimColor: intensity < 0.3,
  };
}
```

## Visual Design Specifications

### Full Mode (Non-Compact)

```
╭─────────────────────────────────────────────────────╮
│ ⚡ Handoff [1.2s]: planner →→ developer             │
│ ═══════════════════════════════════════════════════ │
│ ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░ 60%   │
╰─────────────────────────────────────────────────────╯

Legend:
- "⚡ Handoff" - Static label
- "[1.2s]" - Elapsed time (updates every frame)
- "planner" - Previous agent (uses agent color)
- "→→" - Animated arrow (cycles: → → →→ → →→→)
- "developer" - New agent (pulsing highlight effect)
- Progress bar - Visual indication of animation progress
```

### Compact Mode

```
⚡planner[42s] │ ○architect │ ⚡developer[0s] │ planner →→ developer [1.2s]
                                              └─────────────────────────────┘
                                                    Handoff indicator area
                                                    (pulsing "developer" text)
```

### Progress Bar Characters

```typescript
const progressBarConfig = {
  filled: '█',    // Filled portion
  empty: '░',     // Empty portion
  width: 40,      // Character width
  showPercentage: true,
};
```

### Animation Phase Visual Behavior

| Phase | Duration | Arrow | Pulse | Border Color | Text Style |
|-------|----------|-------|-------|--------------|------------|
| entering | 0-25% | → | High (0.7-1.0) | cyan | bold |
| active | 25-75% | →→ | Oscillating | cyan | normal→bold→normal |
| exiting | 75-100% | →→→ | Low (0-0.3) | gray | dimColor |

## Test Specifications

### Unit Tests for `useAgentHandoff`

```typescript
describe('useAgentHandoff - Enhanced Features', () => {
  describe('transitionPhase', () => {
    it('should be "idle" when not animating');
    it('should be "entering" during first 25% of animation');
    it('should be "active" during middle 50% (25-75%)');
    it('should be "exiting" during final 25% (75-100%)');
  });

  describe('pulseIntensity', () => {
    it('should oscillate between 0 and 1');
    it('should complete 4 cycles during default animation');
    it('should start at 0.5 intensity');
    it('should be configurable via pulseFrequency option');
  });

  describe('arrowFrame', () => {
    it('should be 0 during first third of animation');
    it('should be 1 during second third');
    it('should be 2 during final third');
  });

  describe('handoffStartTime', () => {
    it('should be set when animation starts');
    it('should be null when animation completes');
    it('should update when new animation starts');
  });
});
```

### Component Tests for `HandoffIndicator`

```typescript
describe('HandoffIndicator - Enhanced Features', () => {
  describe('elapsed time display', () => {
    it('should show elapsed time when showElapsedTime=true');
    it('should hide elapsed time when showElapsedTime=false');
    it('should format with sub-second precision (e.g., "1.2s")');
    it('should update as animation progresses');
  });

  describe('pulse effect', () => {
    it('should apply bold when pulseIntensity > 0.5');
    it('should apply dimColor when pulseIntensity < 0.3');
    it('should pulse only on currentAgent text');
  });

  describe('animated arrow', () => {
    it('should render "→" when arrowFrame=0');
    it('should render "→→" when arrowFrame=1');
    it('should render "→→→" when arrowFrame=2');
  });

  describe('progress bar (full mode)', () => {
    it('should render progress bar when showProgressBar=true');
    it('should not render progress bar in compact mode');
    it('should show correct fill percentage');
  });
});
```

### Acceptance Tests

```typescript
describe('Enhanced Handoff Animation - Acceptance Tests', () => {
  it('AC1: Animation is more visually prominent with transition effects', async () => {
    // Verify pulse effect is visible
    // Verify animated arrow changes during animation
    // Verify distinct visual phases
  });

  it('AC2: Elapsed time displays during handoff', async () => {
    // Verify [X.Xs] format appears during animation
    // Verify time updates correctly
    // Verify time disappears when animation completes
  });

  it('AC3: Visual pulse/highlight effect for new agent', async () => {
    // Verify new agent text pulses (bold cycles)
    // Verify pulse is visible in both modes
    // Verify pulse stops when animation completes
  });

  it('AC4: Tests pass for enhanced handoff behavior', async () => {
    // Meta-test: Verify all existing tests still pass
    // Verify new enhancement tests pass
  });
});
```

## Summary for Next Stages

### Developer Stage Inputs
1. **Files to Modify**:
   - `packages/cli/src/ui/hooks/useAgentHandoff.ts`
   - `packages/cli/src/ui/components/agents/HandoffIndicator.tsx`

2. **New Test Files to Create**:
   - `packages/cli/src/ui/components/agents/__tests__/AgentHandoff.enhanced.test.tsx`

3. **Key Implementation Points**:
   - Extend `HandoffAnimationState` interface with new properties
   - Add phase/pulse/arrow calculations to animation loop
   - Track `handoffStartTime` for elapsed display
   - Update `HandoffIndicator` to render new visual elements
   - Maintain backward compatibility (all new features have defaults)

### Tester Stage Inputs
1. **Test Coverage Requirements**:
   - Unit tests for all new hook properties
   - Component tests for all new visual elements
   - Integration tests for both compact and full modes
   - Performance tests for rapid agent changes

2. **Manual Testing Checklist**:
   - [ ] Verify pulse is visually noticeable
   - [ ] Verify elapsed time updates correctly
   - [ ] Verify arrow animation is smooth
   - [ ] Verify no visual glitches in compact mode
   - [ ] Verify no regression in existing behavior
