# ADR-017: Enhanced Handoff Visual Feedback

## Status
Proposed

## Related ADRs
- **ADR-011**: Agent Handoff Animation Architecture (base implementation) - *Extends*
- **ADR-013**: Enhanced AgentPanel Handoff Animations (current enhancements) - *Extends*

## Context

The current HandoffIndicator component (per ADR-011 and ADR-013) provides:
- Animated arrow progression (→ → →→ → →→→)
- Pulse/highlight effect for new agent (bold/dimColor cycling)
- Progress bar visualization (40 characters, █/░)
- Elapsed time display

### Acceptance Criteria (New Enhancements)
HandoffIndicator shows **richer visual feedback** during transitions:
1. **Arrow animation** - More prominent, smoother visual flow
2. **Agent icons** - Display agent-specific icons during transitions
3. **Smooth color transitions** - Gradient-like color fade effects

### Current Implementation Analysis

```typescript
// Current HandoffIndicator.tsx structure
export interface HandoffIndicatorProps {
  animationState: HandoffAnimationState;
  agentColors: Record<string, string>;
  compact?: boolean;
  showElapsedTime?: boolean;
  showProgressBar?: boolean;
}

// Current animation state from useAgentHandoff
export interface HandoffAnimationState {
  isAnimating: boolean;
  previousAgent: string | null;
  currentAgent: string | null;
  progress: number;        // 0-1
  isFading: boolean;
  transitionPhase: 'entering' | 'active' | 'exiting' | 'idle';
  pulseIntensity: number;  // 0-1
  arrowFrame: number;      // 0, 1, or 2
  handoffStartTime: Date | null;
}
```

## Decision

### Architecture Overview

Enhance the existing handoff animation system with three key visual improvements while maintaining terminal compatibility and backward compatibility:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   Enhanced Visual Feedback System                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────┐    ┌──────────────────────────────────────┐ │
│  │  useAgentHandoff       │    │  NEW: Enhanced Animation State       │ │
│  │  (extended)            │───▶│  - arrowStyle: 'basic' | 'animated'  │ │
│  │  - colorTransitionPhase│    │  - iconFrame: number (0-7)           │ │
│  │  - arrowAnimationFrame │    │  - colorIntensity: number (0-1)      │ │
│  └────────────────────────┘    └──────────────────────────────────────┘ │
│            │                                                             │
│            ▼                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │               HandoffIndicator (enhanced)                           │ │
│  │  ┌────────────────┐ ┌─────────────────┐ ┌───────────────────────┐  │ │
│  │  │ Agent Icons    │ │ Animated Arrow  │ │ Color Transition      │  │ │
│  │  │ (per agent)    │ │ (fluid motion)  │ │ (gradient-like fade)  │  │ │
│  │  └────────────────┘ └─────────────────┘ └───────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1. Enhanced Arrow Animation

#### Design Goals
- More fluid, motion-like arrow progression
- Smoother visual flow between frames
- Terminal-compatible character sequences

#### Arrow Frame Sequences

```typescript
// Current: 3-frame basic sequence
const basicArrows = ['→', '→→', '→→→'];

// New: 8-frame enhanced sequence for smoother animation
const enhancedArrows = [
  '·→',      // Frame 0: Subtle start
  '→·',      // Frame 1: Movement indication
  '→→',      // Frame 2: Building momentum
  '→→·',     // Frame 3: Continued flow
  '→→→',     // Frame 4: Peak animation
  '→→→·',    // Frame 5: Extended flow
  '⟶→→',     // Frame 6: Long arrow variant
  '⟹',       // Frame 7: Bold completion arrow
];

// Alternative sparkle variant for visual interest
const sparkleArrows = [
  '✦→',      // Sparkle start
  '→✦',      // Mid transition
  '→→✦',     // Building
  '✦→→→',    // Peak sparkle
  '→→→✦',    // Trailing sparkle
];
```

#### Implementation in `useAgentHandoff.ts`

```typescript
// Extended animation state
export interface HandoffAnimationState {
  // ... existing properties ...

  // NEW: Enhanced arrow animation
  arrowAnimationFrame: number;  // 0-7 for smoother animation (vs 0-2)
  arrowStyle: 'basic' | 'enhanced' | 'sparkle';
}

// Enhanced frame calculation
function getEnhancedArrowFrame(progress: number, style: ArrowStyle): number {
  const frameCount = style === 'basic' ? 3 : 8;
  const totalFrames = 60; // At 30fps, 2 seconds = 60 frames
  const frameIndex = Math.floor(progress * totalFrames);

  if (style === 'basic') {
    return Math.min(Math.floor(frameIndex / 20), 2);
  }

  // Enhanced: More granular frame distribution
  // Frames distributed across animation with easing
  const easedProgress = easeInOutCubic(progress);
  return Math.min(Math.floor(easedProgress * frameCount), frameCount - 1);
}

function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
```

### 2. Agent Icons System

#### Design Goals
- Display recognizable icons for each agent type
- Icons should be terminal-compatible (Unicode/emoji)
- Visual differentiation between source and target agents

#### Agent Icon Mapping

```typescript
// Agent icon definitions (terminal-compatible)
export const AGENT_ICONS: Record<string, string> = {
  planner: '📋',     // Planning/clipboard
  architect: '🏗️',   // Building/architecture
  developer: '💻',   // Computer/coding
  tester: '🧪',      // Test tube/testing
  reviewer: '👁️',    // Eye/review
  devops: '⚙️',      // Gear/operations
  default: '🤖',     // Robot for unknown agents
};

// Fallback for terminals without emoji support
export const AGENT_ICONS_ASCII: Record<string, string> = {
  planner: '[P]',
  architect: '[A]',
  developer: '[D]',
  tester: '[T]',
  reviewer: '[R]',
  devops: '[O]',
  default: '[?]',
};
```

#### Icon Animation During Transition

```typescript
// Icon transition states
type IconTransitionState = 'source' | 'moving' | 'target';

// Visual representation:
// Source phase:   [📋] → [💻]    (source icon prominent)
// Moving phase:   📋 ⟶ 💻       (both icons, arrow between)
// Target phase:   [📋] → [💻]    (target icon prominent, source dimmed)

interface IconAnimationConfig {
  showSourceIcon: boolean;
  showTargetIcon: boolean;
  sourceOpacity: 'full' | 'dim';  // Maps to bold/dimColor
  targetOpacity: 'full' | 'dim';
  iconFrame: number;  // For icon-specific animations
}

function getIconAnimationConfig(progress: number): IconAnimationConfig {
  if (progress < 0.25) {
    return {
      showSourceIcon: true,
      showTargetIcon: true,
      sourceOpacity: 'full',
      targetOpacity: 'dim',
      iconFrame: 0,
    };
  } else if (progress < 0.75) {
    return {
      showSourceIcon: true,
      showTargetIcon: true,
      sourceOpacity: 'full',
      targetOpacity: 'full',
      iconFrame: Math.floor((progress - 0.25) * 8),
    };
  } else {
    return {
      showSourceIcon: true,
      showTargetIcon: true,
      sourceOpacity: 'dim',
      targetOpacity: 'full',
      iconFrame: 7,
    };
  }
}
```

### 3. Smooth Color Transitions

#### Design Goals
- Gradient-like color fade between agent colors
- Terminal-compatible implementation using intensity stepping
- Smooth visual transition without jarring color changes

#### Color Transition Implementation

```typescript
// Terminal-compatible color intensity levels
// Using Ink's color and dimColor props for "gradient" effect

export interface ColorTransitionState {
  sourceColor: string;
  targetColor: string;
  sourceIntensity: 'bright' | 'normal' | 'dim' | 'faded';
  targetIntensity: 'bright' | 'normal' | 'dim' | 'faded';
}

// Intensity to Ink props mapping
const intensityToProps = {
  bright: { bold: true, dimColor: false },
  normal: { bold: false, dimColor: false },
  dim: { bold: false, dimColor: true },
  faded: { bold: false, dimColor: true, color: 'gray' },
};

// Calculate color transition based on progress
function getColorTransitionState(
  progress: number,
  sourceColor: string,
  targetColor: string
): ColorTransitionState {
  // Phase 1 (0-30%): Source bright, target faded
  if (progress < 0.3) {
    return {
      sourceColor,
      targetColor,
      sourceIntensity: 'bright',
      targetIntensity: 'faded',
    };
  }
  // Phase 2 (30-50%): Source normal, target dim
  if (progress < 0.5) {
    return {
      sourceColor,
      targetColor,
      sourceIntensity: 'normal',
      targetIntensity: 'dim',
    };
  }
  // Phase 3 (50-70%): Source dim, target normal
  if (progress < 0.7) {
    return {
      sourceColor,
      targetColor,
      sourceIntensity: 'dim',
      targetIntensity: 'normal',
    };
  }
  // Phase 4 (70-100%): Source faded, target bright
  return {
    sourceColor,
    targetColor,
    sourceIntensity: 'faded',
    targetIntensity: 'bright',
  };
}
```

#### Border Color Animation

```typescript
// Animated border color for full mode
function getBorderColor(progress: number, targetColor: string): string {
  // Start with neutral, transition to target agent color
  if (progress < 0.3) return 'gray';
  if (progress < 0.6) return 'white';
  if (progress < 0.85) return targetColor;
  return 'gray'; // Fade back to neutral
}
```

### Enhanced Component Interfaces

#### Updated `HandoffAnimationState`

```typescript
export interface HandoffAnimationState {
  // ====== Existing Properties ======
  isAnimating: boolean;
  previousAgent: string | null;
  currentAgent: string | null;
  progress: number;
  isFading: boolean;
  transitionPhase: 'entering' | 'active' | 'exiting' | 'idle';
  pulseIntensity: number;
  arrowFrame: number;
  handoffStartTime: Date | null;

  // ====== NEW: Enhanced Visual Properties ======
  /** Enhanced arrow animation frame (0-7) */
  arrowAnimationFrame: number;
  /** Icon animation frame for agent icons */
  iconFrame: number;
  /** Color intensity for gradient-like transitions (0-1) */
  colorIntensity: number;
  /** Current color transition phase */
  colorPhase: 'source-bright' | 'transitioning' | 'target-bright';
}
```

#### Updated `UseAgentHandoffOptions`

```typescript
export interface UseAgentHandoffOptions {
  // ====== Existing Options ======
  duration?: number;
  fadeDuration?: number;
  frameRate?: number;
  enablePulse?: boolean;
  pulseFrequency?: number;

  // ====== NEW: Enhanced Visual Options ======
  /** Arrow animation style */
  arrowStyle?: 'basic' | 'enhanced' | 'sparkle';
  /** Enable agent icons during handoff */
  enableIcons?: boolean;
  /** Enable smooth color transitions */
  enableColorTransition?: boolean;
  /** Use ASCII icons instead of emoji (for terminal compatibility) */
  useAsciiIcons?: boolean;
}
```

#### Updated `HandoffIndicatorProps`

```typescript
export interface HandoffIndicatorProps {
  // ====== Existing Props ======
  animationState: HandoffAnimationState;
  agentColors: Record<string, string>;
  compact?: boolean;
  showElapsedTime?: boolean;
  showProgressBar?: boolean;

  // ====== NEW: Enhanced Visual Props ======
  /** Show agent icons during transition */
  showAgentIcons?: boolean;
  /** Custom agent icons mapping */
  agentIcons?: Record<string, string>;
  /** Arrow animation style override */
  arrowStyle?: 'basic' | 'enhanced' | 'sparkle';
  /** Enable smooth color transitions */
  enableColorTransition?: boolean;
}
```

### Visual Design Specifications

#### Full Mode Enhanced Layout

```
╭─────────────────────────────────────────────────────────────────────╮
│ ⚡ Handoff [1.2s]                                                    │
│                                                                      │
│ 📋 planner  ✦→→→✦  💻 developer                                     │
│ [dim]              [bright/pulsing]                                  │
│                                                                      │
│ ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░ 50%                   │
╰─────────────────────────────────────────────────────────────────────╯

Legend:
- Agent icons displayed before agent names
- Enhanced arrow with sparkle effect
- Source agent dims as transition progresses
- Target agent brightens with pulse effect
- Border color transitions from gray → target color → gray
```

#### Compact Mode Enhanced Layout

```
⚡planner[42s] │ ○architect │ 📋 planner ✦→→ 💻 developer [1.2s]
                            └──────────────────────────────────────┘
                                     Handoff indicator with icons
```

### Animation Timeline (2000ms)

```
Time:     0ms        400ms       800ms      1200ms      1600ms      2000ms
          │───────────│───────────│──────────│───────────│───────────│

Arrow:    ·→         →·          →→→        ⟶→→        →→→✦       ⟹

Icons:    📋[B]💻[F]  📋[B]💻[D]  📋[N]💻[N] 📋[D]💻[N]  📋[F]💻[B]  📋[F]💻[B]

Color:    Source     Source      Both       Target      Target      Target
          bright     normal      visible    normal      bright      bright

Phase:    entering   entering    active     active      exiting     complete

Legend: [B]=bright, [N]=normal, [D]=dim, [F]=faded
```

### File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/cli/src/ui/hooks/useAgentHandoff.ts` | Modify | Add new animation state properties, frame calculations |
| `packages/cli/src/ui/components/agents/HandoffIndicator.tsx` | Modify | Add icons, enhanced arrows, color transitions |
| `packages/cli/src/ui/components/agents/agentIcons.ts` | Create | Agent icon mappings and utilities |
| `packages/cli/src/ui/hooks/__tests__/useAgentHandoff.enhanced.test.ts` | Create | Tests for new animation properties |
| `packages/cli/src/ui/components/agents/__tests__/HandoffIndicator.visual-feedback.test.tsx` | Create | Tests for enhanced visuals |

### Test Strategy

#### Unit Tests for `useAgentHandoff`

```typescript
describe('useAgentHandoff - Enhanced Visual Properties', () => {
  describe('arrowAnimationFrame', () => {
    it('should cycle through 8 frames for enhanced style');
    it('should use easing for smooth progression');
    it('should fall back to 3 frames for basic style');
  });

  describe('iconFrame', () => {
    it('should track icon animation frame');
    it('should coordinate with color phase');
  });

  describe('colorIntensity', () => {
    it('should transition from 0 to 1 during animation');
    it('should be usable for gradient-like effects');
  });

  describe('colorPhase', () => {
    it('should be source-bright in entering phase');
    it('should be transitioning in active phase');
    it('should be target-bright in exiting phase');
  });
});
```

#### Component Tests for `HandoffIndicator`

```typescript
describe('HandoffIndicator - Enhanced Visual Feedback', () => {
  describe('agent icons', () => {
    it('should display source agent icon');
    it('should display target agent icon');
    it('should use fallback icon for unknown agents');
    it('should support ASCII icons for compatibility');
    it('should respect showAgentIcons prop');
  });

  describe('enhanced arrow animation', () => {
    it('should render correct arrow for each frame');
    it('should support sparkle arrow style');
    it('should support enhanced arrow style');
    it('should fall back to basic style');
  });

  describe('color transitions', () => {
    it('should dim source agent during transition');
    it('should brighten target agent during transition');
    it('should animate border color in full mode');
    it('should apply intensity-based styling');
  });
});
```

#### Acceptance Tests

```typescript
describe('Enhanced Handoff Visual Feedback - Acceptance', () => {
  it('AC1: Arrow animation shows richer visual feedback', async () => {
    // Verify enhanced arrow frames render correctly
    // Verify smooth progression through frames
    // Verify sparkle/enhanced variants work
  });

  it('AC2: Agent icons display during transitions', async () => {
    // Verify icons appear for both source and target agents
    // Verify icons coordinate with text colors
    // Verify fallback icons work for unknown agents
  });

  it('AC3: Smooth color transitions occur', async () => {
    // Verify source agent dims during transition
    // Verify target agent brightens during transition
    // Verify no jarring color changes
  });

  it('AC4: Tests pass for enhanced animation states', async () => {
    // Verify all new state properties are tested
    // Verify backward compatibility maintained
  });
});
```

### Backward Compatibility

All new properties and features have sensible defaults:

```typescript
// Default options preserve existing behavior
const defaultOptions: UseAgentHandoffOptions = {
  // Existing defaults
  duration: 2000,
  fadeDuration: 500,
  frameRate: 30,
  enablePulse: true,
  pulseFrequency: 4,

  // New defaults - enhanced features enabled by default
  arrowStyle: 'enhanced',
  enableIcons: true,
  enableColorTransition: true,
  useAsciiIcons: false,
};

// Props default to show enhanced features
const defaultProps: Partial<HandoffIndicatorProps> = {
  showAgentIcons: true,
  arrowStyle: 'enhanced',
  enableColorTransition: true,
};
```

Consumers can opt-out of new features:
```typescript
<HandoffIndicator
  animationState={state}
  agentColors={colors}
  showAgentIcons={false}        // Disable icons
  arrowStyle="basic"            // Use original 3-frame arrows
  enableColorTransition={false} // Disable color transitions
/>
```

### Performance Considerations

1. **Arrow Frame Calculation**: Simple math operations (easing function is lightweight)
2. **Icon Rendering**: Static lookup, no computation
3. **Color Transitions**: Map lookups to style objects, no complex calculations
4. **Memory**: Minimal additional state (3 numbers, 1 string)
5. **No Additional DOM Elements**: Just different text/style props

### Terminal Compatibility

All features use terminal-compatible mechanisms:
- **Icons**: Unicode/emoji with ASCII fallback
- **Colors**: Standard Ink `color`, `bold`, `dimColor` props
- **Arrows**: Unicode arrow characters (widely supported)
- **Animation**: setInterval-based (no RAF dependency)

## Consequences

### Positive
- Richer, more engaging visual feedback during handoffs
- Agent icons provide immediate visual identification
- Smoother color transitions create polished UX
- Enhanced arrows add visual interest without complexity
- Fully backward compatible

### Negative
- Slightly larger state object
- More props to potentially configure
- Emoji icons may not render in all terminals (ASCII fallback mitigates)

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Emoji icons not supported in terminal | ASCII fallback icons, `useAsciiIcons` option |
| Animation too busy/distracting | `arrowStyle="basic"` option to simplify |
| Color transitions not visible in some terminals | Falls back to bold/dim which work universally |
| Performance with rapid handoffs | Debounce already in place, minimal state overhead |

## Implementation Order

1. **Phase 1**: Enhanced Arrow Animation
   - Add `arrowAnimationFrame` to state
   - Add arrow style options
   - Add easing function
   - Update arrow rendering

2. **Phase 2**: Agent Icons
   - Create `agentIcons.ts` module
   - Add icon mapping to HandoffIndicator
   - Add ASCII fallback
   - Add icon animation coordination

3. **Phase 3**: Color Transitions
   - Add `colorIntensity` and `colorPhase` to state
   - Update text styling based on phase
   - Add border color animation

4. **Phase 4**: Testing & Documentation
   - Unit tests for all new state properties
   - Component tests for visual features
   - Acceptance tests for ACs
   - Update CLAUDE.md if needed

## Summary for Next Stages

### Developer Stage Inputs

1. **Files to Modify**:
   - `packages/cli/src/ui/hooks/useAgentHandoff.ts` - Add enhanced state properties
   - `packages/cli/src/ui/components/agents/HandoffIndicator.tsx` - Add visual enhancements

2. **Files to Create**:
   - `packages/cli/src/ui/components/agents/agentIcons.ts` - Icon mappings
   - `packages/cli/src/ui/components/agents/__tests__/HandoffIndicator.visual-feedback.test.tsx`

3. **Key Implementation Points**:
   - Extend `HandoffAnimationState` with new properties
   - Add easing function for smooth arrow progression
   - Implement icon rendering with fallbacks
   - Implement color transition phases
   - Maintain backward compatibility with defaults

### Tester Stage Inputs

1. **Test Coverage Requirements**:
   - Unit tests for all new state properties
   - Component tests for all visual features
   - Integration tests in both compact and full modes
   - Edge case tests for unknown agents, disabled features

2. **Manual Testing Checklist**:
   - [ ] Enhanced arrows are visibly smoother
   - [ ] Agent icons display correctly
   - [ ] Color transitions are noticeable but not jarring
   - [ ] Compact mode works correctly
   - [ ] Full mode works correctly
   - [ ] ASCII fallback works when enabled
   - [ ] No regression in existing behavior
