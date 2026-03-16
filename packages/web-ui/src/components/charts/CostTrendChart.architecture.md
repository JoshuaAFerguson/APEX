# Architecture Decision Record: CostTrendChart Component

## Status
**Proposed** - Pending Implementation

## Context
The APEX web-ui needs a CostTrendChart component to visualize cost data over time. This component is part of the performance metrics visualization suite alongside TokenUsageOverTimeChart and TaskCompletionRateChart.

## Decision

### Component Design

The CostTrendChart will follow the established patterns from existing chart components (TokenUsageOverTimeChart, TaskCompletionRateChart, AgentUtilizationChart) to ensure consistency across the codebase.

### Core Architecture

```
CostTrendChart/
├── CostTrendChart.tsx           # Main component + Mini variant
└── __tests__/
    ├── CostTrendChart.test.tsx              # Unit tests
    ├── CostTrendChart.accessibility.test.tsx # A11y tests
    ├── CostTrendChart.edge-cases.test.tsx   # Edge case tests
    └── CostTrendChart.integration.test.tsx  # Integration tests
```

### Component Interface

```typescript
// From existing types/performance-metrics.ts (CostTrendChartProps)
export interface CostTrendChartProps {
  data: CostTrendData
  variant?: PerformanceChartVariant  // 'area' | 'line' | 'bar' | etc.
  height?: number
  showLegend?: boolean
  showBudgetLimit?: boolean          // Show budget threshold line
  showProjection?: boolean           // Show projected cost overlay
  showBreakdown?: boolean            // Show cost breakdown by type
  showCumulative?: boolean           // Toggle cumulative vs. per-period view
  animated?: boolean
  colors?: Partial<PerformanceChartColorScheme>
  className?: string
  onDataPointClick?: (point: CostTrendDataPoint) => void
}
```

### Data Types (Already Defined in performance-metrics.ts)

```typescript
// CostBreakdown - cost by category
interface CostBreakdown {
  inputTokenCost: number
  outputTokenCost: number
  cacheCreationCost: number
  cacheReadCost: number
  otherCost: number
}

// CostTrendDataPoint - single time point
interface CostTrendDataPoint {
  timestamp: Date
  cost: number                 // Cost in this interval
  cumulativeCost: number       // Running total up to this point
  breakdown?: CostBreakdown
  projectedCost?: number
}

// CostTrendData - complete dataset
interface CostTrendData {
  data: CostTrendDataPoint[]
  totalCost: number
  avgCostPerHour: number
  avgCostPerTask: number
  peakHourlyCost: number
  breakdown: CostBreakdown
  budgetLimit?: number
  dailyBudgetLimit?: number
  budgetUtilization?: number
  projectedRemainingCost?: number
  projectedTotalCost?: number
  cacheSavings?: number
  timeRange: PerformanceMetricsTimeRange
  generatedAt: Date
  trend?: -1 | 0 | 1
  changePercent?: number
}
```

### Technical Design

#### 1. Component Structure
- **Main Component**: CostTrendChart - Full-featured chart with all options
- **Mini Component**: CostTrendChartMini - Compact sparkline version for dashboards

#### 2. Chart Implementation Using Recharts
```tsx
// Core Recharts components used:
import {
  AreaChart, Area,    // For gradient-filled cost visualization
  LineChart, Line,    // For trend lines and projections
  XAxis, YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,      // For budget limit threshold
  ResponsiveContainer
} from 'recharts'
```

#### 3. Key Features

**a. Dual View Toggle (Cumulative vs. Per-Period)**
```tsx
// Chart displays either:
// - showCumulative=true: Running total (cumulativeCost field)
// - showCumulative=false: Per-interval cost (cost field)
const dataKey = showCumulative ? 'cumulativeCost' : 'cost'
```

**b. Gradient Fill for AreaChart**
```tsx
<defs>
  <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stopColor={colors.primary} stopOpacity={0.8}/>
    <stop offset="95%" stopColor={colors.primary} stopOpacity={0.1}/>
  </linearGradient>
</defs>
<Area
  type="monotone"
  dataKey={dataKey}
  stroke={colors.primary}
  fill="url(#costGradient)"
  fillOpacity={1}
/>
```

**c. Budget Limit Line**
```tsx
{showBudgetLimit && data.budgetLimit && (
  <ReferenceLine
    y={data.budgetLimit}
    stroke={colors.warning}
    strokeDasharray="3 3"
    label={{ value: 'Budget Limit', fill: colors.warning }}
  />
)}
```

**d. Projection Overlay**
```tsx
{showProjection && (
  <Line
    type="monotone"
    dataKey="projectedCost"
    stroke={colors.secondary}
    strokeDasharray="5 5"
    dot={false}
    name="Projected"
  />
)}
```

#### 4. Theme Integration
- Uses existing `useChartTheme()` hook from `@/lib/chart-utils`
- Leverages `getTooltipStyle()`, `getGridStyle()`, `getAxisStyle()` utilities
- Theme-aware color selection (light/dark mode support)

#### 5. Responsive Design
- Uses `ResponsiveContainer` for fluid width
- Configurable height prop with sensible defaults
- Mini variant for compact dashboard cards

#### 6. Accessibility
- ARIA labels describing chart content
- Screen reader summary text (.sr-only)
- Keyboard navigation support via Recharts

#### 7. Time Label Formatting
```tsx
function formatTimeLabel(timestamp: Date, timeRange: PerformanceMetricsTimeRange): string {
  switch (timeRange) {
    case '1h':
    case '6h':
    case '24h':
      return timestamp.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    case '7d':
      return timestamp.toLocaleDateString('en-US', { weekday: 'short' })
    case '30d':
      return timestamp.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
  }
}
```

### Component Hierarchy

```
CostTrendChart
├── SkeletonChart (loading state)
├── EmptyState (no data)
└── Chart Container
    ├── SVG Defs (gradients)
    ├── ResponsiveContainer
    │   └── AreaChart/LineChart
    │       ├── CartesianGrid
    │       ├── XAxis
    │       ├── YAxis (currency formatted)
    │       ├── Tooltip (CostTrendTooltip)
    │       ├── Legend
    │       ├── Area/Line (cost data)
    │       ├── Line (projection, optional)
    │       ├── ReferenceLine (budget, optional)
    │       └── Area (breakdown, optional)
    └── Screen Reader Summary (.sr-only)
```

### Custom Tooltip Component

```tsx
function CostTrendTooltip({
  active,
  payload,
  label,
  showBreakdown = false,
}: TooltipProps) {
  // Displays:
  // - Time label
  // - Current interval cost
  // - Cumulative cost
  // - Cost breakdown (if enabled)
  // - Projected cost (if available)
  // - Budget utilization (if configured)
}
```

### State Management
- Component is stateless - receives data via props
- Parent manages time range selection and data fetching
- Uses `useMemo` for computed/transformed chart data

### Testing Strategy

1. **Unit Tests** - Component rendering, props handling
2. **Accessibility Tests** - ARIA compliance, screen reader support
3. **Edge Case Tests** - Zero data, large numbers, missing fields
4. **Integration Tests** - Theme switching, data updates

### Files to Create/Modify

**Create:**
- `packages/web-ui/src/components/charts/CostTrendChart.tsx`
- `packages/web-ui/src/components/charts/__tests__/CostTrendChart.test.tsx`
- `packages/web-ui/src/components/charts/__tests__/CostTrendChart.accessibility.test.tsx`
- `packages/web-ui/src/components/charts/__tests__/CostTrendChart.edge-cases.test.tsx`
- `packages/web-ui/src/components/charts/__tests__/CostTrendChart.integration.test.tsx`

**Modify (optional, if index export exists):**
- `packages/web-ui/src/components/charts/index.ts`

## Consequences

### Positive
- Consistent with existing chart component patterns
- Reuses established theme and utility infrastructure
- Types already defined in performance-metrics.ts
- Full accessibility support
- Responsive and theme-aware

### Negative
- Adds another chart component to maintain
- Recharts dependency (already present)

### Risks
- None identified - follows established patterns

## Implementation Notes

1. **Add `showCumulative` prop** to CostTrendChartProps if not already present
2. Use existing `formatCost()` function from `@/types/performance-metrics` or `@/lib/utils`
3. Follow exact patterns from TokenUsageOverTimeChart for consistency
4. Ensure gradient IDs are unique to avoid SVG conflicts

## Related Documents
- TokenUsageOverTimeChart.tsx - Reference implementation
- TaskCompletionRateChart.tsx - Reference for pie/bar variants
- performance-metrics.ts - Type definitions
- chart-utils.tsx - Theme utilities
