# ADR-0001: Budget Gauge Component Architecture

## Status
Accepted

## Context
We need to implement a BudgetGauge component that displays current spend vs budget limit using a circular/arc gauge visualization. The component should support:
- Visual arc gauge showing spend percentage
- Color states: green (<75%), yellow (75-90%), red (>90%)
- Dollar amounts and percentage display
- Configurable thresholds

This component will be used in the web-ui package dashboard to visualize budget consumption.

## Decision

### Component Location
Place the component at `packages/web-ui/src/components/charts/BudgetGauge.tsx` alongside the existing `TokenUsageChart.tsx`.

### Technology Choices

#### SVG-Based Arc Rendering
Use native SVG with `path` elements and `stroke-dasharray` for the arc gauge:
- **Pro**: Zero external dependencies, small bundle size
- **Pro**: Full control over styling and animations
- **Pro**: Consistent with existing codebase patterns (no charting libraries used)
- **Con**: More complex SVG path calculations

#### Alternative Considered: Canvas API
Rejected due to:
- Harder to style with Tailwind CSS
- Accessibility challenges (no DOM elements)
- Inconsistent with existing component patterns

#### Alternative Considered: Charting Library (recharts, victory)
Rejected due to:
- Large bundle size impact
- Over-engineered for a single gauge component
- No charting libraries currently in use

### Props Interface

```typescript
export interface BudgetGaugeProps extends HTMLAttributes<HTMLDivElement> {
  /** Current spend amount in dollars */
  currentSpend: number
  /** Budget limit in dollars */
  budgetLimit: number
  /** Threshold percentages for color states */
  thresholds?: {
    warning: number  // Default: 75
    danger: number   // Default: 90
  }
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Show dollar amounts */
  showAmounts?: boolean
  /** Show percentage */
  showPercentage?: boolean
  /** Animation duration in ms (0 to disable) */
  animationDuration?: number
}
```

### Visual Design

```
          ╭──────────────╮
         ╱                ╲
        ╱   ┌──────────┐   ╲
       │    │  $750.00 │    │  ← Current spend (center)
       │    │   75%    │    │  ← Percentage below
       │    │ /$1,000  │    │  ← Budget limit
        ╲   └──────────┘   ╱
         ╲                ╱
          ╰──────────────╯
             ▲
             │ Arc fills from left to right
             │ Color changes based on percentage
```

### SVG Arc Implementation

```typescript
// Arc geometry constants
const RADIUS = 45           // Viewbox is 100x100, centered at 50,50
const STROKE_WIDTH = 8      // Arc thickness
const START_ANGLE = 135     // Degrees from 12 o'clock (left bottom)
const END_ANGLE = 405       // Degrees (right bottom, 270 degree arc)
const ARC_LENGTH = 270      // Total arc degrees

// Path calculation using SVG arc commands
// M = Move to start point
// A = Arc to end point
```

### Color State Logic

```typescript
type GaugeState = 'success' | 'warning' | 'danger'

function getGaugeState(
  percentage: number,
  thresholds: { warning: number; danger: number }
): GaugeState {
  if (percentage >= thresholds.danger) return 'danger'
  if (percentage >= thresholds.warning) return 'warning'
  return 'success'
}

const stateColors = {
  success: {
    stroke: 'stroke-green-500',
    text: 'text-green-500',
  },
  warning: {
    stroke: 'stroke-yellow-500',
    text: 'text-yellow-500',
  },
  danger: {
    stroke: 'stroke-red-500',
    text: 'text-red-500',
  },
}
```

### Size Variants

| Size | SVG Dimensions | Font Sizes |
|------|----------------|------------|
| sm   | 80x80px        | text-sm, text-xs |
| md   | 120x120px      | text-lg, text-sm |
| lg   | 160x160px      | text-2xl, text-base |

### Accessibility

- Use `role="progressbar"` on the container
- Set `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Set `aria-label` with descriptive text
- Support keyboard focus with visible focus ring

### Animation

- Use CSS transitions on `stroke-dashoffset` for smooth arc fill
- Configurable duration (default 750ms, 0 to disable)
- Use `prefers-reduced-motion` media query to respect user preferences

### File Structure

```
packages/web-ui/src/components/charts/
├── TokenUsageChart.tsx       # Existing
├── BudgetGauge.tsx           # New component
├── index.ts                  # New barrel export
└── __tests__/
    └── BudgetGauge.test.tsx  # Unit tests
```

### Component Composition

```tsx
// Main export
export function BudgetGauge(props: BudgetGaugeProps): JSX.Element

// Optional: Mini version for compact displays (like TokenUsageMini)
export function BudgetGaugeMini(props: BudgetGaugeMiniProps): JSX.Element
```

## Consequences

### Positive
- Zero additional dependencies
- Small bundle footprint
- Consistent with existing codebase patterns
- Full accessibility support
- Configurable thresholds for different use cases
- Smooth animations with motion preference respect

### Negative
- More complex SVG math than using a library
- May need additional work for complex gauge variations
- No built-in tooltip support (could add later)

### Risks
- SVG arc calculations must be tested across browsers
- Animation performance on lower-end devices

## Implementation Notes

### Testing Strategy
1. Unit tests with Vitest + React Testing Library
2. Test color state transitions at boundary values (74%, 75%, 76%, 89%, 90%, 91%)
3. Test accessibility attributes
4. Test edge cases (0%, 100%, >100%)
5. Snapshot tests for SVG output

### Dependencies
- No new dependencies required
- Uses existing: `cn` utility, Tailwind CSS

### Future Extensions
- Tooltip showing detailed breakdown
- Click handler for drill-down
- Multiple arcs for budget categories
- Sparkline history indicator
