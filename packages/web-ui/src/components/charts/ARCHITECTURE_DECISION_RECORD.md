# ADR-001: AgentUtilizationChart Component Architecture

## Status
Proposed

## Date
2025-03-15

## Context
We need to implement an `AgentUtilizationChart` component that displays per-agent token usage, cost breakdown, and efficiency metrics in a horizontal bar chart format. The component must integrate with the existing web-ui architecture and follow established patterns.

## Decision

### Component Structure

```
packages/web-ui/src/components/charts/
├── AgentUtilizationChart.tsx      # Main component file
├── __tests__/
│   └── AgentUtilizationChart.test.tsx  # Component tests
└── ARCHITECTURE_DECISION_RECORD.md     # This document
```

### Core Architecture

The component follows the established patterns from `TokenUsageChart.tsx` and `BudgetGauge.tsx`:

1. **'use client' Directive**: Required for Next.js client-side rendering
2. **TypeScript**: Full type safety using existing types from `@/types/agent-utilization`
3. **Styling**: Tailwind CSS with `cn()` utility for class composition
4. **State Management**: React hooks (`useMemo`) for computed values

### Component Design

#### Main Component: `AgentUtilizationChart`

```typescript
interface AgentUtilizationChartProps {
  data: AgentUtilizationData          // From types/agent-utilization.ts
  variant?: AgentUtilizationChartVariant
  metric?: AgentUtilizationMetric
  sortBy?: AgentUtilizationMetric
  sortDirection?: AgentUtilizationSortDirection
  maxAgents?: number                  // Default: 8
  height?: number                     // Default: 240
  showLegend?: boolean               // Default: true
  showTokenBreakdown?: boolean       // Default: true
  showCost?: boolean                 // Default: true
  showPerformance?: boolean          // Default: false
  animated?: boolean                 // Default: true
  colors?: Partial<AgentUtilizationColorConfig>
  className?: string
  onAgentClick?: (agent: AgentUtilization) => void
  onAgentHover?: (agent: AgentUtilization | null) => void
  loading?: boolean
  error?: string | null
  emptyMessage?: string
}
```

#### Mini Variant: `AgentUtilizationChartMini`

Compact version for cards and dashboard widgets.

```typescript
interface AgentUtilizationChartMiniProps {
  data: AgentUtilizationData
  maxAgents?: number                  // Default: 3
  className?: string
}
```

### Visual Design

#### Horizontal Bar Chart Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│ Agent Name     │ Token Bar (Input ████████ Output ████)  │ Cost │ Eff │
├─────────────────────────────────────────────────────────────────────┤
│ Planner        │ ██████████████████████████████████████  │ $0.12│ 15/s│
│ Architect      │ ████████████████████████████            │ $0.08│ 12/s│
│ Coder          │ █████████████████████████████████████████ │ $0.15│ 18/s│
│ Reviewer       │ ████████████                            │ $0.03│ 8/s │
│ Other (3)      │ █████████                               │ $0.05│ 10/s│
└─────────────────────────────────────────────────────────────────────┘
  Legend: [■ Input Tokens] [■ Output Tokens]
```

#### Color Scheme

Following the apex design system:
- Input tokens: `bg-apex-500` (#0ea5e9)
- Output tokens: `bg-apex-700` (#0369a1)
- Cost warning: `bg-yellow-500`
- Performance indicator: `bg-green-500`

### Data Flow

```
AgentUtilizationData (props)
         │
         ▼
   ┌──────────────┐
   │  useAgentData │  ← Custom hook for processing
   │    (useMemo)  │
   └──────────────┘
         │
         ▼
┌────────────────────┐
│ ProcessedAgentData │  ← Sorted, grouped, color-assigned
│     (Array)        │
└────────────────────┘
         │
         ▼
    ┌──────────┐
    │  Render  │
    └──────────┘
```

### Implementation Details

#### 1. Data Processing Logic

```typescript
function useProcessedAgents(
  data: AgentUtilizationData,
  options: {
    sortBy: AgentUtilizationMetric
    sortDirection: AgentUtilizationSortDirection
    maxAgents: number
    colors: AgentUtilizationColorConfig
  }
): ProcessedAgentData[] {
  return useMemo(() => {
    // 1. Calculate totals for percentages
    // 2. Sort agents by metric
    // 3. Take top N, group rest as "Other"
    // 4. Assign colors from config
    // 5. Calculate display names (truncate if needed)
    // 6. Return ProcessedAgentData[]
  }, [data, options])
}
```

#### 2. Bar Chart Rendering

Each agent row consists of:
- **Label Column**: Agent name (120px width, truncated with ellipsis)
- **Bar Column**: Stacked horizontal bar (flex-1)
  - Input tokens segment (bg-apex-500)
  - Output tokens segment (bg-apex-700)
- **Cost Column**: Formatted currency (80px, right-aligned)
- **Efficiency Column**: tokens/second (60px, right-aligned)

#### 3. Responsive Behavior

- **Desktop (≥768px)**: Full layout with all columns
- **Tablet (640-767px)**: Hide efficiency column
- **Mobile (<640px)**: Hide cost column, compact bars

### Accessibility

Following patterns from `BudgetGauge.tsx`:

1. **ARIA Labels**: Each bar has `aria-label` describing the agent and values
2. **Role**: Container has `role="img"` with descriptive label
3. **Color Contrast**: Meets WCAG 2.1 AA for all text
4. **Keyboard Navigation**: Interactive elements are focusable
5. **Screen Reader**: Hidden summary text provides data overview

### State Handling

| State | Rendering |
|-------|-----------|
| Loading | Skeleton bars with animate-pulse |
| Error | Error message in red with icon |
| Empty | Empty state message centered |
| Data | Full chart rendering |

### Performance Considerations

1. **Memoization**: All computed values wrapped in `useMemo`
2. **Animation**: CSS transitions only (no JS animation loops)
3. **Max Agents**: Default limit of 8 prevents excessive DOM nodes
4. **Lazy Rendering**: Consider virtualization for 50+ agents (future)

### Testing Strategy

Following patterns from `BudgetGauge.test.tsx`:

1. **Rendering Tests**: Basic props, variants, edge cases
2. **Data Processing Tests**: Sorting, grouping, calculations
3. **Accessibility Tests**: ARIA attributes, roles, labels
4. **Integration Tests**: Loading states, error handling
5. **Visual Regression**: Screenshot comparison (optional)

## Consequences

### Positive
- Consistent with existing chart patterns (`TokenUsageChart`)
- Full type safety with existing types
- Responsive and accessible by default
- Both full and mini variants available

### Negative
- No external charting library (custom implementation)
- Limited to bar chart visualization (other variants may need separate implementation)

### Risks
- Complex "Other" grouping logic may have edge cases
- Performance with many agents (>50) untested

## Implementation Checklist

- [ ] Create AgentUtilizationChart.tsx component
- [ ] Implement useProcessedAgents hook
- [ ] Add responsive breakpoints
- [ ] Create AgentUtilizationChartMini variant
- [ ] Write comprehensive tests
- [ ] Verify build passes
- [ ] Verify tests pass

## References

- Existing patterns: `TokenUsageChart.tsx`, `BudgetGauge.tsx`
- Type definitions: `types/agent-utilization.ts`
- Design system: `tailwind.config.js` (apex color palette)
- Utility functions: `lib/utils.ts` (cn, formatCost)
