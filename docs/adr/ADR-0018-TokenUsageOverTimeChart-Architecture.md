# ADR-0018: TokenUsageOverTimeChart Component Architecture

## Status
Accepted

## Context

The APEX dashboard requires a time-series visualization component to display token usage patterns over time. This component must:

1. Display token usage (input vs output) over configurable time ranges (1h, 24h, 7d, 30d)
2. Use Recharts library (already a project dependency v2.15.0)
3. Be theme-aware (support light/dark modes)
4. Show legend for input/output token differentiation
5. Be responsive and accessible
6. Follow existing component patterns in the codebase

## Decision

### Component Architecture

We will implement `TokenUsageOverTimeChart` following the established patterns from `AgentUtilizationChart`:

```
packages/web-ui/src/components/charts/
├── TokenUsageOverTimeChart.tsx          # Main component
├── __tests__/
│   └── TokenUsageOverTimeChart.test.tsx # Unit tests
```

### Type Definitions

The types are already defined in `packages/web-ui/src/types/performance-metrics.ts`:

- `TokenUsageOverTimeData` - Data structure with time-series data points
- `TokenUsageDataPoint` - Individual data point with timestamp and token breakdown
- `TokenUsageOverTimeChartProps` - Component props interface
- `PerformanceMetricsTimeRange` - Time range enum ('1h' | '6h' | '24h' | '7d' | '30d')

### Component Structure

```typescript
// TokenUsageOverTimeChart.tsx
'use client'

import React, { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import {
  useChartTheme,
  getTooltipStyle,
  getGridStyle,
  getAxisStyle,
  compactNumberFormatter,
} from '@/lib/chart-utils'
import type {
  TokenUsageOverTimeChartProps,
  TokenUsageOverTimeData,
  TokenUsageDataPoint,
} from '@/types/performance-metrics'
```

### Design Decisions

#### 1. Chart Type Selection

**Decision**: Use Recharts `AreaChart` as the primary variant with option to use `LineChart`

**Rationale**:
- Area charts better visualize cumulative data like token usage
- Stacked areas clearly show input vs output proportions
- Existing `PerformanceChartVariant` type supports both 'area' and 'line' variants

#### 2. Data Transformation

**Decision**: Transform `TokenUsageDataPoint[]` into Recharts-compatible format

```typescript
interface ChartDataPoint {
  timestamp: number       // Unix timestamp for X-axis
  timeLabel: string       // Formatted time string for display
  inputTokens: number     // Y-axis value for input series
  outputTokens: number    // Y-axis value for output series
  totalTokens: number     // Combined value
  cost?: number           // Optional cost overlay
}
```

**Rationale**:
- Recharts requires flat object structures for data binding
- Pre-formatting timestamps improves render performance
- Separate input/output fields enable stacked visualization

#### 3. Theme Integration

**Decision**: Use existing `useChartTheme()` hook from `chart-utils.tsx`

**Rationale**:
- Already provides light/dark theme detection
- Includes categorical colors for multi-series charts
- Provides tooltip, grid, and axis styling utilities
- SSR-safe with `mounted` state handling

#### 4. Time Range Handling

**Decision**: Time range selection is external to component; component receives filtered data

**Rationale**:
- Separation of concerns (data fetching vs visualization)
- Consistent with `PerformanceMetricsPanelProps.onTimeRangeChange` pattern
- Parent components handle API calls for different time ranges
- Component can still format X-axis labels based on time range prop

#### 5. Responsive Design

**Decision**: Use Recharts `ResponsiveContainer` with configurable height

**Rationale**:
- Automatic width handling for all viewport sizes
- Fixed height prevents layout shift
- Existing `ChartContainer` wrapper provides accessibility wrapper

#### 6. Legend Design

**Decision**: Use Recharts built-in `Legend` component with custom styling

```typescript
<Legend
  verticalAlign="bottom"
  iconType="rect"
  wrapperStyle={{ paddingTop: 8 }}
  formatter={(value) => (
    <span className="text-xs text-foreground-secondary">{value}</span>
  )}
/>
```

**Rationale**:
- Consistent legend positioning across all chart components
- Custom formatter enables theme-aware text styling
- Bottom placement maximizes chart area

#### 7. Color Scheme

**Decision**: Use predefined token colors from `DEFAULT_PERFORMANCE_CHART_COLORS`

| Series | Light Theme | Dark Theme |
|--------|------------|------------|
| Input Tokens | `#0284c7` (apex-600) | `#0ea5e9` (apex-500) |
| Output Tokens | `#0369a1` (apex-700) | `#0369a1` (apex-700) |
| Cache Tokens | `#16a34a` (success) | `#22c55e` (success) |

**Rationale**:
- Consistent with existing token visualization colors in `TokenUsageChart` and `AgentUtilizationChart`
- Uses semantic color variables for theme compatibility
- Clear visual distinction between input and output

#### 8. Empty & Loading States

**Decision**: Follow AgentUtilizationChart patterns

```typescript
// Loading state
if (loading) {
  return <SkeletonChart height={height} />
}

// Empty state
if (!data?.data || data.data.length === 0) {
  return <EmptyState message="No token usage data available" />
}
```

**Rationale**:
- Consistent UX across all chart components
- Skeleton provides perceived performance during load
- Clear messaging for empty states

#### 9. Accessibility

**Decision**: Implement ARIA roles and screen reader content

```typescript
<div
  role="img"
  aria-label={`Token usage over ${timeRange} showing ${totalTokens} total tokens`}
>
  {/* Chart */}
  <div className="sr-only">
    Summary: {formatTokenCount(totalInputTokens)} input tokens,
    {formatTokenCount(totalOutputTokens)} output tokens...
  </div>
</div>
```

**Rationale**:
- Charts are images to screen readers
- Hidden summary provides data context
- Follows WCAG 2.1 guidelines

#### 10. Mini Variant

**Decision**: Include `TokenUsageOverTimeChartMini` for dashboard cards

```typescript
export function TokenUsageOverTimeChartMini({
  data,
  height = 80,
  className,
}: MiniChartProps)
```

**Rationale**:
- Consistent with `AgentUtilizationChartMini` pattern
- Reduced height and simplified axes for card widgets
- No legend in mini variant to maximize chart area

### Props Interface

The props interface is already defined in `performance-metrics.ts`:

```typescript
interface TokenUsageOverTimeChartProps {
  data: TokenUsageOverTimeData
  variant?: PerformanceChartVariant      // 'area' | 'line' (default: 'area')
  height?: number                         // Chart height (default: 200)
  showLegend?: boolean                    // Show legend (default: true)
  showBreakdown?: boolean                 // Show input/output split (default: true)
  showCost?: boolean                      // Show cost overlay (default: false)
  animated?: boolean                      // Animate transitions (default: true)
  colors?: Partial<PerformanceChartColorScheme>
  className?: string
  onDataPointClick?: (point: TokenUsageDataPoint) => void
}
```

### Component State Management

**Decision**: Use `useMemo` for data transformation, no internal state

```typescript
const chartData = useMemo(() => {
  return data.data.map(point => ({
    timestamp: point.timestamp.getTime(),
    timeLabel: formatTimeLabel(point.timestamp, data.timeRange),
    inputTokens: point.breakdown.inputTokens,
    outputTokens: point.breakdown.outputTokens,
    totalTokens: point.totalTokens,
    cost: point.cost,
  }))
}, [data])
```

**Rationale**:
- Memoization prevents unnecessary re-transformations
- Chart state is derived from props (controlled component)
- Parent components manage time range selection state

### Time Label Formatting

**Decision**: Format based on time range granularity

| Time Range | Format | Example |
|-----------|--------|---------|
| 1h | 'HH:mm' | '14:30' |
| 6h | 'HH:mm' | '14:30' |
| 24h | 'HH:mm' | '14:30' |
| 7d | 'ddd' | 'Mon' |
| 30d | 'MMM d' | 'Mar 15' |

**Rationale**:
- Appropriate granularity for each time range
- Prevents overcrowded X-axis labels
- Consistent with time-series best practices

### File Structure

```
packages/web-ui/src/
├── components/charts/
│   ├── TokenUsageOverTimeChart.tsx
│   └── __tests__/
│       └── TokenUsageOverTimeChart.test.tsx
├── lib/
│   └── chart-utils.tsx  (existing - provides useChartTheme, formatters)
└── types/
    └── performance-metrics.ts  (existing - types already defined)
```

## Consequences

### Positive
- Consistent with existing chart patterns (AgentUtilizationChart)
- Leverages existing utilities (chart-utils.tsx, performance-metrics types)
- Theme-aware out of the box
- Responsive without additional configuration
- Accessible to screen readers

### Negative
- Bundle size impact from Recharts (already a dependency)
- Server-side rendering requires hydration handling (mitigated by existing patterns)

### Risks
- None identified - implementation follows proven patterns

## Implementation Checklist

- [ ] Create `TokenUsageOverTimeChart.tsx` component
- [ ] Implement data transformation with `useMemo`
- [ ] Use `ResponsiveContainer` for responsive sizing
- [ ] Integrate `useChartTheme()` for theme-aware colors
- [ ] Add X-axis time formatting based on time range
- [ ] Add Y-axis with compact number formatting
- [ ] Implement stacked area/line chart with input/output series
- [ ] Add legend with theme-aware styling
- [ ] Add tooltip with formatted values
- [ ] Implement loading skeleton state
- [ ] Implement empty state
- [ ] Add accessibility attributes
- [ ] Create `TokenUsageOverTimeChartMini` variant
- [ ] Write comprehensive unit tests
- [ ] Verify build passes
- [ ] Verify tests pass

## Related ADRs

- ADR-0007: Web UI Component Architecture
- ADR-0010: Chart Theming Strategy (chart-utils.tsx)
