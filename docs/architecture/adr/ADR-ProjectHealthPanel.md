# ADR: ProjectHealthPanel Component Architecture

## Status
Accepted

## Context
The APEX system requires a ProjectHealthPanel component to display project health status with visual indicators (healthy/warning/critical), showing metrics like success rate, average duration, and system health. This component needs to:

1. Display health status with visual indicators
2. Show key metrics: success rate, average duration, system health
3. Work with both mock data and real API data via WebSocket
4. Follow existing component patterns in the codebase

## Decision

### Component Location
Place the component in `packages/web-ui/src/components/dashboard/ProjectHealthPanel.tsx` following the established component organization pattern.

### Architecture Approach

#### 1. Component Hierarchy
```
ProjectHealthPanel (main container)
├── HealthStatusIndicator (visual status badge with icon)
├── MetricsGrid (grid layout for metric cards)
│   ├── SuccessRateCard
│   ├── AverageDurationCard
│   └── SystemHealthCard
└── ConnectionStatus (optional - shows real-time connection state)
```

#### 2. Type Definitions
Create a dedicated types file at `packages/web-ui/src/types/project-health.ts`:

```typescript
/**
 * Health status levels matching the existing core types
 */
export type ProjectHealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

/**
 * Props for ProjectHealthPanel component
 */
export interface ProjectHealthPanelProps {
  /** Health metrics data (can be real API or mock) */
  metrics?: ProjectHealthMetrics;
  /** Current health status override */
  status?: ProjectHealthStatus;
  /** Whether to show loading state */
  isLoading?: boolean;
  /** Error state for display */
  error?: Error | null;
  /** Time range for metrics */
  timeRange?: '1h' | '6h' | '24h' | '7d';
  /** Whether to auto-refresh metrics */
  autoRefresh?: boolean;
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
  /** Custom className for styling */
  className?: string;
  /** Callback when status changes */
  onStatusChange?: (status: ProjectHealthStatus) => void;
}

/**
 * Project health metrics data structure
 * Aligned with existing DashboardHealthMetrics from dashboard.ts
 */
export interface ProjectHealthMetrics {
  /** Overall project health status */
  status: ProjectHealthStatus;
  /** Success rate percentage (0-100) */
  successRate: number;
  /** Average task duration in milliseconds */
  averageDurationMs: number;
  /** System health percentage (0-100) */
  systemHealth: number;
  /** Optional detailed breakdown */
  details?: {
    /** Number of active tasks */
    activeTasks: number;
    /** Number of completed tasks */
    completedTasks: number;
    /** Number of failed tasks */
    failedTasks: number;
    /** Connection latency in ms */
    latencyMs: number;
    /** Last updated timestamp */
    lastUpdated: Date;
  };
}
```

#### 3. Integration with Existing Systems

The component integrates with:
- **`useRealtimeUpdates` hook**: For real-time health data via WebSocket
- **`DashboardHealthMetrics` type**: Existing type from `types/dashboard.ts`
- **UI primitives**: Card, Badge from `components/ui/`
- **Utility functions**: `cn()`, `formatDate()`, `getRelativeTime()` from `lib/utils`

#### 4. Visual Design Decisions

**Status Indicators:**
- `healthy`: Green background, checkmark icon
- `warning`: Yellow/amber background, warning icon
- `critical`: Red background, error icon
- `unknown`: Gray background, question mark icon

**Color Classes (matching existing Badge component):**
```typescript
const statusStyles = {
  healthy: 'bg-green-950/50 text-green-400 border-green-900',
  warning: 'bg-yellow-950/50 text-yellow-400 border-yellow-900',
  critical: 'bg-red-950/50 text-red-400 border-red-900',
  unknown: 'bg-background-tertiary text-foreground-secondary border-border-secondary',
};
```

**Threshold Configuration:**
```typescript
export interface HealthThresholds {
  /** Success rate below this triggers warning (default: 90) */
  successRateWarning: number;
  /** Success rate below this triggers critical (default: 70) */
  successRateCritical: number;
  /** System health below this triggers warning (default: 85) */
  systemHealthWarning: number;
  /** System health below this triggers critical (default: 60) */
  systemHealthCritical: number;
  /** Average duration above this triggers warning in ms (default: 5000) */
  durationWarning: number;
  /** Average duration above this triggers critical in ms (default: 15000) */
  durationCritical: number;
}

export const DEFAULT_HEALTH_THRESHOLDS: HealthThresholds = {
  successRateWarning: 90,
  successRateCritical: 70,
  systemHealthWarning: 85,
  systemHealthCritical: 60,
  durationWarning: 5000,
  durationCritical: 15000,
};
```

#### 5. Accessibility Requirements
- Proper ARIA labels for status indicators
- `role="status"` for live health status updates
- `aria-live="polite"` for metric updates
- Color-blind friendly: use icons in addition to colors
- Keyboard navigable metric cards

#### 6. Responsive Design
- Mobile: Stack metrics vertically
- Tablet: 2-column grid for metrics
- Desktop: 3-column grid for metrics

### File Structure

```
packages/web-ui/src/
├── components/
│   └── dashboard/
│       ├── index.ts                           # Exports
│       ├── ProjectHealthPanel.tsx             # Main component
│       ├── HealthStatusIndicator.tsx          # Status badge with icon
│       ├── MetricCard.tsx                     # Reusable metric display card
│       └── __tests__/
│           ├── ProjectHealthPanel.test.tsx    # Unit tests
│           └── ProjectHealthPanel.integration.test.tsx
└── types/
    └── project-health.ts                      # Type definitions
```

## Consequences

### Positive
- Follows established patterns in the codebase
- Reuses existing UI primitives (Card, Badge)
- Integrates with existing real-time update infrastructure
- Supports both mock and real data for testing
- Accessible and responsive design

### Negative
- Additional components to maintain
- May need future refactoring if health metrics structure changes

### Risks
- WebSocket connection failures need graceful degradation
- Large metric values need proper formatting

## Implementation Notes

1. **Phase 1**: Create type definitions and component skeleton
2. **Phase 2**: Implement static rendering with mock data
3. **Phase 3**: Integrate with `useRealtimeUpdates` hook
4. **Phase 4**: Add comprehensive tests
5. **Phase 5**: Add responsive and accessibility polish

## Related
- `packages/core/src/health-metrics.ts` - Core health metrics system
- `packages/web-ui/src/types/dashboard.ts` - Dashboard type definitions
- `packages/web-ui/src/lib/useRealtimeUpdates.ts` - Real-time updates hook
- `packages/web-ui/src/components/ui/BudgetGauge.tsx` - Similar visual gauge component
