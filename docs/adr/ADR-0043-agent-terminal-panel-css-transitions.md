# ADR-0043: AgentTerminalPanel CSS Transitions Architecture

## Status
**Accepted**

## Context

The `AgentTerminalPanel` component requires smooth CSS transitions for panel state changes (minimized, normal, maximized). The current implementation has the `PANEL_HEIGHTS` and `PANEL_TRANSITIONS` constants defined but lacks complete integration for:

1. Smooth height transitions during state changes
2. Content fade animations (opacity transitions)
3. Chevron icon rotation animations
4. Protection against visual glitches during rapid state changes

### Current State Analysis

The `AgentTerminalPanel.tsx` already has these constants defined:

```typescript
const PANEL_HEIGHTS = {
  minimized: 'h-12',     // 48px - header only
  normal: maxHeight === 'none' ? 'h-80' : '', // 320px default
  maximized: 'h-full',   // Full container height
} as const

const PANEL_TRANSITIONS = {
  height: 'transition-[height] duration-300 ease-out',
  opacity: 'transition-opacity duration-200 ease-in-out',
  transform: 'transition-transform duration-200 ease-out',
} as const
```

### Acceptance Criteria Requirements

1. Height transitions use **300ms ease-out** timing
2. Content fades with **200ms ease-in-out**
3. Chevron icon rotates smoothly
4. No visual glitches during rapid state changes
5. Animation classes match ADR spec constants

## Decision

### 1. Animation Timing Specification

| Transition Type | Duration | Timing Function | Use Case |
|-----------------|----------|-----------------|----------|
| Height (Panel) | 300ms | ease-out | Panel collapse/expand |
| Opacity (Content) | 200ms | ease-in-out | Content fade in/out |
| Transform (Chevron) | 200ms | ease-out | Icon rotation |

**Rationale**:
- 300ms for height provides smooth, perceivable animation without feeling sluggish
- 200ms for opacity ensures content visibility changes don't lag behind height
- ease-out for height creates natural deceleration (fast start, slow end)
- ease-in-out for opacity provides symmetrical fade that feels balanced

### 2. CSS Transition Implementation Architecture

#### 2.1 Panel Container Transitions

```typescript
// Constants to be used consistently across the codebase
export const PANEL_HEIGHTS = {
  minimized: 'h-12',     // 48px - header only
  normal: 'h-80',        // 320px - default viewing height
  maximized: 'h-full',   // Full container height
} as const

export const PANEL_TRANSITIONS = {
  height: 'transition-[height] duration-300 ease-out',
  opacity: 'transition-opacity duration-200 ease-in-out',
  transform: 'transition-transform duration-200 ease-out',
  // Combined transition for elements needing multiple properties
  all: 'transition-all duration-300 ease-out',
} as const
```

#### 2.2 Content Visibility Animation Strategy

**Decision**: Use a CSS grid-based approach (matching existing `animate-collapse` pattern) for content areas.

```css
/* Panel content animation using CSS grid */
.panel-content-animate {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 300ms ease-out, opacity 200ms ease-in-out;
  opacity: 0;
}

.panel-content-animate[data-expanded="true"] {
  grid-template-rows: 1fr;
  opacity: 1;
}

.panel-content-inner {
  overflow: hidden;
}
```

**Alternative (Tailwind-only approach)**:
```typescript
// For minimized state
const contentClasses = cn(
  'overflow-hidden',
  PANEL_TRANSITIONS.opacity,
  effectivePanelState === 'minimized'
    ? 'opacity-0 h-0 invisible'
    : 'opacity-100 h-auto visible'
)
```

**Rationale for CSS Grid approach**:
- Avoids hard-coding heights, allowing natural content sizing
- Works with dynamic content that may change size
- Already established pattern in codebase (ThoughtDisplay component)
- Better performance than JavaScript-based height calculations

### 3. Chevron Icon Rotation

**Decision**: Apply `rotate-180` transformation for expanded state indication.

```tsx
// In AgentTerminalPanelControls or collapsible sections
<ChevronDown
  className={cn(
    'w-4 h-4',
    'transition-transform duration-200 ease-out', // PANEL_TRANSITIONS.transform
    isExpanded && 'rotate-180'
  )}
/>
```

For panels using directional chevrons (pointing right when collapsed):
```tsx
<ChevronRight
  className={cn(
    'w-4 h-4',
    'transition-transform duration-200 ease-out',
    isExpanded && 'rotate-90'
  )}
/>
```

### 4. Rapid State Change Protection

**Decision**: Implement debouncing and CSS `will-change` hints.

#### 4.1 CSS Performance Optimization

```typescript
// Add will-change for panels during active transitions
const panelClasses = cn(
  'flex flex-col overflow-hidden',
  PANEL_HEIGHTS[effectivePanelState],
  PANEL_TRANSITIONS.height,
  // Performance optimization for animations
  'will-change-[height,opacity]',
  // Remove will-change after animation completes (handled in JS)
)
```

#### 4.2 Debounce Handler Pattern

```typescript
import { useCallback, useRef } from 'react'

function useDebounceTransition(delay = 50) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastStateRef = useRef<string | null>(null)

  const debouncedTransition = useCallback((
    newState: PanelDisplayState,
    callback: (state: PanelDisplayState) => void
  ) => {
    // Clear any pending transition
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Skip if same state requested rapidly
    if (lastStateRef.current === newState) {
      return
    }

    timeoutRef.current = setTimeout(() => {
      lastStateRef.current = newState
      callback(newState)

      // Reset after animation completes
      setTimeout(() => {
        lastStateRef.current = null
      }, 300) // Match height transition duration
    }, delay)
  }, [delay])

  return debouncedTransition
}
```

#### 4.3 CSS-Only Glitch Prevention

```css
/* Prevent layout thrashing during rapid transitions */
.panel-transitioning {
  pointer-events: none;  /* Prevent interaction during animation */
  contain: layout style; /* CSS containment for performance */
}
```

### 5. Component Integration Points

#### 5.1 AgentTerminalPanel.tsx Updates

```typescript
// Panel container with full transition support
<div
  className={cn(
    'flex flex-col border border-gray-800 rounded-lg overflow-hidden',
    'bg-gray-950/90 backdrop-blur-sm',
    PANEL_HEIGHTS[effectivePanelState],
    PANEL_TRANSITIONS.height,
    PANEL_TRANSITIONS.opacity,
    effectivePanelState === 'maximized' && 'col-span-full z-10',
    className
  )}
  // ... rest of props
>
```

#### 5.2 Content Area with Fade Animation

```tsx
{/* Content section with fade animation */}
<div
  className={cn(
    'flex-1 overflow-hidden',
    PANEL_TRANSITIONS.opacity,
    effectivePanelState === 'minimized' ? 'opacity-0' : 'opacity-100'
  )}
  aria-hidden={effectivePanelState === 'minimized'}
>
  {/* Controls, Log viewport, etc. */}
</div>
```

### 6. Accessibility Considerations

**Decision**: Respect user motion preferences.

```css
/* Reduce animations for users who prefer reduced motion */
@media (prefers-reduced-motion: reduce) {
  .panel-content-animate,
  [class*="transition-"] {
    transition-duration: 0.01ms !important;
  }
}
```

In TypeScript:
```typescript
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const transitionClasses = prefersReducedMotion
  ? ''
  : PANEL_TRANSITIONS.height
```

### 7. File Structure and Exports

```
packages/web-ui/src/
├── components/agents/
│   ├── AgentTerminalPanel.tsx          # Main panel component
│   ├── AgentTerminalPanelHeader.tsx    # Header with controls
│   ├── AgentTerminalPanelControls.tsx  # Filter controls with chevron
│   └── constants.ts                     # Shared animation constants (NEW)
├── app/
│   └── globals.css                      # Panel animation CSS classes
└── types/
    └── agent-terminal-panel.ts          # Type definitions
```

**New constants.ts file**:
```typescript
// packages/web-ui/src/components/agents/constants.ts

/**
 * Panel height CSS classes for different display states
 * @see ADR-0043 for animation timing specifications
 */
export const PANEL_HEIGHTS = {
  minimized: 'h-12',     // 48px - header only
  normal: 'h-80',        // 320px - default viewing height
  maximized: 'h-full',   // Full container height
} as const

/**
 * CSS transition classes for smooth panel animations
 * @see ADR-0043 for timing rationale
 */
export const PANEL_TRANSITIONS = {
  /** Height transition: 300ms ease-out */
  height: 'transition-[height] duration-300 ease-out',
  /** Opacity transition: 200ms ease-in-out */
  opacity: 'transition-opacity duration-200 ease-in-out',
  /** Transform transition: 200ms ease-out (for chevrons/icons) */
  transform: 'transition-transform duration-200 ease-out',
} as const

export type PanelHeightState = keyof typeof PANEL_HEIGHTS
```

### 8. Testing Strategy

#### Unit Tests
- Verify transition classes are applied for each panel state
- Test that `will-change` is added/removed appropriately
- Verify reduced motion preferences are respected

#### Integration Tests
- State transitions complete without CSS errors
- Content visibility matches panel state
- Chevron rotation animates correctly

#### Visual Regression Tests
- Capture before/after screenshots of state changes
- Verify no layout shifts during transitions
- Test rapid toggle scenarios

## Consequences

### Positive

1. **Smooth UX**: 300ms/200ms timings provide perceivable but not sluggish animations
2. **Performance**: CSS transitions are hardware-accelerated
3. **Consistency**: Shared constants ensure uniform animation feel
4. **Accessibility**: Respects prefers-reduced-motion
5. **Maintainability**: Centralized constants make timing changes easy

### Negative

1. **CSS Complexity**: Grid-based height animation adds CSS classes
2. **Browser Support**: `will-change` has mixed support in older browsers
3. **Debugging**: CSS transitions can be harder to debug than JS animations

### Mitigations

1. **CSS Complexity**: Document patterns clearly, use established codebase patterns
2. **Browser Support**: Graceful degradation - transitions just won't animate in unsupported browsers
3. **Debugging**: Use Chrome DevTools' animation inspector; add transition events for logging if needed

## Implementation Plan

### Phase 1: Constants & CSS (This ADR)
1. Create `constants.ts` with `PANEL_HEIGHTS` and `PANEL_TRANSITIONS`
2. Add panel animation CSS classes to `globals.css`
3. Document usage patterns

### Phase 2: Component Updates (Subsequent Task)
1. Refactor `AgentTerminalPanel.tsx` to use shared constants
2. Add content fade animations
3. Ensure chevron rotations use `PANEL_TRANSITIONS.transform`

### Phase 3: Polish & Testing (Subsequent Task)
1. Add debounce protection for rapid state changes
2. Implement reduced motion support
3. Add visual regression tests

## References

- ADR-0032: AgentTerminalPanel Minimize/Maximize Functionality Architecture
- ADR-0015: AgentTerminalPanel Component Architecture
- Existing Pattern: `ThoughtDisplay.tsx` (animate-collapse)
- MDN: CSS Transitions, prefers-reduced-motion
- Tailwind CSS: Transition utilities
