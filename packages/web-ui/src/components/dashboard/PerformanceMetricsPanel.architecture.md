# Architecture Decision Record: PerformanceMetricsPanel Component

## Status
**Proposed** - Ready for implementation

## Context

The APEX dashboard requires a comprehensive PerformanceMetricsPanel that consolidates three performance visualization charts:
1. **TokenUsageOverTimeChart** - Displays token consumption patterns
2. **TaskCompletionRateChart** - Shows task success/failure rates
3. **CostTrendChart** - Visualizes cost trends and budget utilization

This component must provide:
- Unified time range selection that controls all charts
- Loading and empty states with appropriate feedback
- Responsive grid layout (1-col mobile, 2-col tablet, 3-col desktop)
- Consistent Card-based layout following ProjectHealthPanel patterns

## Decision

### Component Architecture

```
PerformanceMetricsPanel (Container)
├── Card (Wrapper)
│   ├── CardHeader
│   │   ├── Title
│   │   └── TimeRangeSelector (Select component)
│   ├── CardContent
│   │   ├── LoadingState (conditional)
│   │   ├── EmptyState (conditional)
│   │   └── ChartGrid (responsive)
│   │       ├── TokenUsageOverTimeChart
│   │       ├── TaskCompletionRateChart
│   │       └── CostTrendChart
│   └── CardFooter (optional - timestamp/refresh)
```

### File Structure

```
packages/web-ui/src/
├── components/dashboard/
│   ├── PerformanceMetricsPanel.tsx          # Main component
│   ├── PerformanceMetricsPanel.architecture.md # This ADR
│   └── __tests__/
│       └── PerformanceMetricsPanel.test.tsx # Unit tests
└── types/
    └── performance-metrics.ts               # Types (already exists)
```

### Interface Design

```typescript
// Already defined in performance-metrics.ts
interface PerformanceMetricsPanelProps {
  data?: AggregatedPerformanceMetrics
  timeRange?: PerformanceMetricsTimeRange      // '1h' | '6h' | '24h' | '7d' | '30d'
  onTimeRangeChange?: (range: PerformanceMetricsTimeRange) => void
  showTimeRangeSelector?: boolean
  showTokenUsage?: boolean
  showTaskCompletion?: boolean
  showCostTrend?: boolean
  showSummaryCards?: boolean
  chartVariant?: PerformanceChartVariant       // 'line' | 'area' | 'bar' etc.
  chartSize?: 'sm' | 'md' | 'lg'
  colors?: Partial<PerformanceChartColorScheme>
  animated?: boolean
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
  autoRefresh?: boolean
  autoRefreshInterval?: number
  className?: string
  emptyMessage?: string
}
```

### Key Design Decisions

#### 1. State Management Pattern
- **Decision**: Controlled component pattern with optional internal state fallback
- **Rationale**: Allows both controlled usage (parent manages timeRange) and uncontrolled usage (internal state)
- **Implementation**:
  ```typescript
  const [internalTimeRange, setInternalTimeRange] = useState<PerformanceMetricsTimeRange>(
    timeRange ?? DEFAULT_PERFORMANCE_TIME_RANGE
  )
  const effectiveTimeRange = timeRange ?? internalTimeRange
  ```

#### 2. Responsive Grid Layout
- **Decision**: CSS Grid with Tailwind responsive breakpoints
- **Rationale**: Native browser layout, performant, maintainable
- **Implementation**:
  ```css
  grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4
  ```
- **Breakpoints**:
  - Mobile (<768px): 1 column
  - Tablet (768px-1023px): 2 columns
  - Desktop (≥1024px): 3 columns

#### 3. Loading State
- **Decision**: Skeleton placeholder matching chart dimensions
- **Rationale**: Maintains layout stability, follows ProjectHealthPanel pattern
- **Implementation**:
  ```tsx
  <Card className="animate-pulse">
    <CardContent>
      <div className="flex items-center justify-center py-8">
        <Spinner size="lg" />
        <span className="ml-3 text-foreground-secondary">Loading performance metrics...</span>
      </div>
    </CardContent>
  </Card>
  ```

#### 4. Empty State
- **Decision**: Centered message with optional action button
- **Rationale**: Clear user feedback, consistent with existing components
- **Implementation**:
  ```tsx
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <EmptyIcon className="w-12 h-12 text-foreground-secondary mb-4" />
    <p className="text-foreground-secondary">{emptyMessage}</p>
  </div>
  ```

#### 5. Time Range Selector
- **Decision**: Reuse existing Select component from ui/Select.tsx
- **Rationale**: Consistency with existing UI components, accessibility built-in
- **Options**: Defined in TIME_RANGE_CONFIGS (1h, 6h, 24h, 7d, 30d)

#### 6. Chart Integration Pattern
- **Decision**: Pass data slice with updated timeRange to each chart
- **Rationale**: Charts already handle their own empty/loading states internally
- **Data Flow**:
  ```typescript
  // Parent passes AggregatedPerformanceMetrics
  // Panel distributes to child charts
  <TokenUsageOverTimeChart data={data.tokenUsage} />
  <TaskCompletionRateChart data={data.taskCompletion} />
  <CostTrendChart data={data.costTrend} />
  ```

#### 7. Error Handling
- **Decision**: Error state with retry button, red-themed Card
- **Rationale**: Matches ProjectHealthPanel error state pattern
- **Implementation**: Display error.message with optional onRefresh callback

### Component Dependencies

```typescript
// Internal dependencies
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { TokenUsageOverTimeChart } from '@/components/charts/TokenUsageOverTimeChart'
import { TaskCompletionRateChart } from '@/components/charts/TaskCompletionRateChart'
import { CostTrendChart } from '@/components/charts/CostTrendChart'
import { cn } from '@/lib/utils'

// Types
import type {
  PerformanceMetricsPanelProps,
  PerformanceMetricsTimeRange,
  AggregatedPerformanceMetrics,
} from '@/types/performance-metrics'
```

### Accessibility Considerations

1. **ARIA Attributes**:
   - `role="region"` on Card with `aria-label="Performance Metrics Panel"`
   - Time range selector has proper `aria-label`
   - Loading state has `aria-live="polite"` for screen reader announcements

2. **Keyboard Navigation**:
   - Time range selector inherits Select component keyboard support
   - Tab navigation through interactive elements

3. **Color Contrast**:
   - Use theme-aware colors from existing chart components
   - Status indicators follow STATUS_STYLES from project-health.ts

### Testing Strategy

1. **Unit Tests**:
   - Renders all three charts when data provided
   - Shows loading state when loading=true
   - Shows empty state when no data
   - Time range selector changes timeRange prop
   - Responsive grid classes applied correctly

2. **Integration Tests**:
   - Time range change triggers onTimeRangeChange callback
   - Data updates propagate to child charts
   - Error state displays correctly

3. **Accessibility Tests**:
   - ARIA attributes present
   - Keyboard navigation works

### Performance Considerations

1. **Memoization**: Use useMemo for derived data, useCallback for handlers
2. **Chart Lazy Loading**: Consider dynamic imports for chart components if bundle size is concern
3. **Re-render Prevention**: Memo child chart wrappers if needed

## Implementation Notes

### Phase 1: Core Implementation
1. Create PerformanceMetricsPanel.tsx with basic structure
2. Implement loading/empty states
3. Add time range selector with Select component
4. Integrate three chart components
5. Apply responsive grid layout

### Phase 2: Testing
1. Write comprehensive unit tests
2. Add integration tests for time range changes
3. Add accessibility tests

### Phase 3: Documentation
1. Add JSDoc comments
2. Export from dashboard/index.ts
3. Update type exports if needed

## Alternatives Considered

### Alternative 1: Tabs Instead of Grid
- **Pros**: Less visual complexity, works better on very small screens
- **Cons**: Users can't see all metrics at once, requires more clicks
- **Decision**: Rejected - Dashboard overview needs simultaneous visibility

### Alternative 2: Custom Time Range Dropdown
- **Pros**: Could be more compact or feature-rich
- **Cons**: Duplicates existing Select component functionality
- **Decision**: Rejected - Reuse Select for consistency

### Alternative 3: Each Chart Has Own Time Selector
- **Pros**: More granular control per metric
- **Cons**: Poor UX, inconsistent dashboard view
- **Decision**: Rejected - Unified time range is better UX

## Consequences

### Positive
- Consistent with existing ProjectHealthPanel patterns
- Reuses established UI components (Card, Select, Spinner)
- Responsive design supports all device sizes
- Clear loading/empty states improve user experience
- Type-safe through existing TypeScript interfaces

### Negative
- Additional component to maintain
- Three chart renders may impact performance on low-end devices
- Requires aggregated data from parent - parent must handle data fetching

### Risks
- Chart library (Recharts) bundle size impact
- Complex responsive behavior may need adjustment based on user feedback

## References

- ProjectHealthPanel.tsx - Reference implementation for Card layout pattern
- performance-metrics.ts - Type definitions and constants
- TokenUsageOverTimeChart.tsx - Chart implementation example
- Select.tsx - Time range selector component
