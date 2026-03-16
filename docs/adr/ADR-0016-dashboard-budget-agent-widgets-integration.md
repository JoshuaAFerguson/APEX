# ADR-0016: Budget and Agent Utilization Dashboard Widgets Integration

## Status
Proposed

## Context
We need to integrate the existing `BudgetGauge` and `AgentUtilizationChart` widgets into the main dashboard page (`packages/web-ui/src/app/page.tsx`). The widgets should:

1. Display budget consumption with real-time data via WebSocket
2. Show agent utilization metrics with real-time updates
3. Follow existing dashboard styling patterns (Card-based layout)
4. Be responsive across different viewport sizes
5. Integrate seamlessly with existing dashboard components

### Existing Components Analysis

#### BudgetGauge (`packages/web-ui/src/components/ui/BudgetGauge.tsx`)
- **Status**: Fully implemented with SVG arc gauge visualization
- **Features**:
  - Color states: green (<75%), yellow (75-90%), red (>90%)
  - Configurable thresholds
  - Size variants (sm, md, lg)
  - Currency formatting
  - Accessibility support (ARIA attributes, screen reader text)
- **Mini variant**: `BudgetGaugeMini` for compact displays

#### AgentUtilizationChart (`packages/web-ui/src/components/charts/AgentUtilizationChart.tsx`)
- **Status**: Fully implemented with horizontal bar chart
- **Features**:
  - Per-agent token usage breakdown
  - Cost column display
  - Performance metrics (tokens/sec)
  - Sorting and filtering
  - Loading, error, and empty states
- **Mini variant**: `AgentUtilizationChartMini` for compact displays

#### Available Hooks
1. **`useAgentMetrics`** (`packages/web-ui/src/hooks/useAgentMetrics.ts`)
   - Real-time agent metrics via WebSocket
   - Returns: `metrics`, `connectionStatus`, `isLoading`, `error`, `refresh`
   - Subscribes to: `agent:*` and `usage:updated` events

2. **`useRealtimeUpdates`** (`packages/web-ui/src/lib/useRealtimeUpdates.ts`)
   - Comprehensive real-time updates for dashboard
   - Provides: health metrics, activity events, performance data
   - Includes token usage metrics suitable for budget display

3. **`useBudgetStatus`** (`packages/cli/src/ui/hooks/useBudgetStatus.ts`)
   - CLI-side hook for orchestrator integration
   - Needs web-ui equivalent using WebSocket client

## Decision

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Dashboard Page                           │
│  packages/web-ui/src/app/page.tsx                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Stats Grid (existing 6 cards: Pending, Active, etc.)    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────┬──────────────────────────────────┐   │
│  │  Budget Widget       │  Agent Utilization Widget         │   │
│  │  ┌────────────────┐ │  ┌────────────────────────────┐   │   │
│  │  │  BudgetGauge   │ │  │  AgentUtilizationChart     │   │   │
│  │  │  (circular)    │ │  │  (horizontal bars)          │   │   │
│  │  │                │ │  │                              │   │   │
│  │  │  $X / $Y       │ │  │  Agent1 ████████  45%       │   │   │
│  │  │    XX%         │ │  │  Agent2 ██████    30%       │   │   │
│  │  └────────────────┘ │  │  Agent3 ████      20%       │   │   │
│  │                      │  └────────────────────────────┘   │   │
│  │  useRealtimeUpdates  │  useAgentMetrics                   │   │
│  └──────────────────────┴──────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ActiveTasksPanelRealtime (existing)                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Component Structure

#### 1. New Wrapper Component: `BudgetWidget`
Create a Card-wrapped widget for the dashboard:

```typescript
// packages/web-ui/src/components/dashboard/BudgetWidget.tsx
'use client'

import React from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { BudgetGauge } from '@/components/ui/BudgetGauge'
import { Spinner } from '@/components/ui/Spinner'
import { useRealtimeUpdates } from '@/lib/useRealtimeUpdates'
import { cn } from '@/lib/utils'

export interface BudgetWidgetProps {
  /** Budget limit in USD (default from config or env) */
  budgetLimit?: number
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Custom class name */
  className?: string
  /** Callback when refresh is requested */
  onRefresh?: () => void
}

export function BudgetWidget({
  budgetLimit = 100, // Default, should come from config
  size = 'md',
  className,
  onRefresh,
}: BudgetWidgetProps)
```

#### 2. New Wrapper Component: `AgentUtilizationWidget`
Create a Card-wrapped widget for the dashboard:

```typescript
// packages/web-ui/src/components/dashboard/AgentUtilizationWidget.tsx
'use client'

import React, { useMemo } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { AgentUtilizationChart } from '@/components/charts/AgentUtilizationChart'
import { Spinner } from '@/components/ui/Spinner'
import { useAgentMetrics } from '@/hooks/useAgentMetrics'
import { cn } from '@/lib/utils'
import type { AgentUtilizationData } from '@/types/agent-utilization'

export interface AgentUtilizationWidgetProps {
  /** Maximum number of agents to display */
  maxAgents?: number
  /** Chart height */
  height?: number
  /** Custom class name */
  className?: string
  /** Callback when refresh is requested */
  onRefresh?: () => void
}

export function AgentUtilizationWidget({
  maxAgents = 5,
  height = 200,
  className,
  onRefresh,
}: AgentUtilizationWidgetProps)
```

### Data Flow

```
WebSocket Server
      │
      ▼
┌─────────────────────┐     ┌─────────────────────────────┐
│ ApexWebSocketClient │────▶│ useRealtimeUpdates          │
│ (singleton)         │     │ ├── state.performance       │
└─────────────────────┘     │ │   └── tokenUsage          │
                            │ │       ├── totalTokens     │
                            │ │       ├── estimatedCost   │
                            │ │       └── byAgent         │
                            │ └── state.health            │
                            └─────────────────────────────┘
                                        │
                                        ▼
                            ┌─────────────────────────────┐
                            │ BudgetWidget                │
                            │ ├── currentSpend            │
                            │ │   (from tokenUsage.cost)  │
                            │ └── budgetLimit             │
                            │     (from config/props)     │
                            └─────────────────────────────┘

┌─────────────────────┐
│ ApexWebSocketClient │────▶ useAgentMetrics
│ (shared instance)   │      ├── metrics.agents[]
└─────────────────────┘      │   ├── agentId
                             │   ├── inputTokens
                             │   ├── outputTokens
                             │   ├── totalTokens
                             │   └── estimatedCost
                             └── metrics.totalCost
                                        │
                                        ▼
                             ┌─────────────────────────────┐
                             │ AgentUtilizationWidget      │
                             │ └── Transform to            │
                             │     AgentUtilizationData    │
                             └─────────────────────────────┘
```

### Dashboard Page Layout

The dashboard grid should be modified to accommodate the new widgets:

```typescript
// packages/web-ui/src/app/page.tsx

// Current stats grid (6 columns on XL)
<div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
  {/* Existing 6 stat cards */}
</div>

// NEW: Widget row (2 columns)
<div className="mt-6 grid gap-6 md:grid-cols-2">
  <BudgetWidget budgetLimit={100} size="md" />
  <AgentUtilizationWidget maxAgents={5} height={200} />
</div>

// Existing tasks panel
<div className="mt-8">
  <ActiveTasksPanelRealtime ... />
</div>
```

### Type Transformations

The `useAgentMetrics` hook returns `AgentMetrics` which needs transformation to `AgentUtilizationData`:

```typescript
// Transform function in AgentUtilizationWidget
function transformMetricsToUtilizationData(
  metrics: AgentMetrics
): AgentUtilizationData {
  return {
    agents: metrics.agents.map(agent => ({
      agentId: agent.agentId,
      agentName: agent.agentName,
      inputTokens: agent.inputTokens,
      outputTokens: agent.outputTokens,
      totalTokens: agent.totalTokens,
      estimatedCost: agent.estimatedCost,
      tokensPerSecond: agent.tokensPerSecond,
      duration: agent.duration,
      invocations: agent.invocations,
      cacheTokens: agent.cacheTokens,
    })),
    totalInputTokens: metrics.agents.reduce((sum, a) => sum + a.inputTokens, 0),
    totalOutputTokens: metrics.agents.reduce((sum, a) => sum + a.outputTokens, 0),
    totalTokens: metrics.totalTokens,
    totalEstimatedCost: metrics.totalCost,
    totalDuration: metrics.agents.reduce((sum, a) => sum + a.duration, 0),
    avgTokensPerSecond: metrics.agents.length > 0
      ? metrics.agents.reduce((sum, a) => sum + a.tokensPerSecond, 0) / metrics.agents.length
      : 0,
    lastUpdated: metrics.lastUpdated,
  }
}
```

### Responsive Design

| Viewport | Budget Widget | Agent Utilization Widget |
|----------|--------------|-------------------------|
| Mobile (<640px) | Full width, BudgetGauge size="sm" | Full width, maxAgents=3 |
| Tablet (640-1024px) | 50% width, BudgetGauge size="md" | 50% width, maxAgents=4 |
| Desktop (>1024px) | 50% width, BudgetGauge size="md" | 50% width, maxAgents=5 |

### Error and Loading States

Both widgets should handle:
1. **Loading**: Show `Spinner` during initial data fetch
2. **Disconnected**: Show connection status with reconnection message
3. **Error**: Display error message with retry option
4. **No Data**: Show empty state with appropriate message

```typescript
// Widget loading state pattern
if (isLoading && !data) {
  return (
    <Card className={className}>
      <CardContent className="flex items-center justify-center py-8">
        <Spinner size="md" />
        <span className="ml-2 text-foreground-secondary">Loading...</span>
      </CardContent>
    </Card>
  )
}
```

### File Structure

```
packages/web-ui/src/
├── components/
│   ├── dashboard/
│   │   ├── index.ts                        # Add new exports
│   │   ├── BudgetWidget.tsx                # NEW
│   │   ├── AgentUtilizationWidget.tsx      # NEW
│   │   ├── ProjectHealthPanel.tsx          # Existing
│   │   ├── MetricCard.tsx                  # Existing
│   │   └── __tests__/
│   │       ├── BudgetWidget.test.tsx       # NEW
│   │       └── AgentUtilizationWidget.test.tsx # NEW
│   ├── ui/
│   │   └── BudgetGauge.tsx                 # Existing
│   └── charts/
│       └── AgentUtilizationChart.tsx       # Existing
├── hooks/
│   └── useAgentMetrics.ts                  # Existing
├── lib/
│   └── useRealtimeUpdates.ts               # Existing
└── app/
    └── page.tsx                            # Modify to add widgets
```

## Consequences

### Positive
- Leverages existing, well-tested components (BudgetGauge, AgentUtilizationChart)
- Reuses existing real-time hooks with WebSocket integration
- Consistent with existing dashboard patterns and styling
- Full accessibility support inherited from base components
- Responsive design for all viewport sizes
- Graceful degradation with loading/error states

### Negative
- Adds two new wrapper components (minimal overhead)
- Dashboard page will make additional WebSocket subscriptions
- Increased initial bundle size (minimal, components already exist)

### Risks
- WebSocket connection sharing between multiple hooks needs testing
- Budget limit configuration source needs to be determined (env var, API, props)
- Performance impact of real-time updates on low-end devices

## Implementation Plan

### Phase 1: Create Widget Components
1. Create `BudgetWidget.tsx` wrapper component
2. Create `AgentUtilizationWidget.tsx` wrapper component
3. Update `packages/web-ui/src/components/dashboard/index.ts` exports

### Phase 2: Dashboard Integration
1. Modify `packages/web-ui/src/app/page.tsx` to include widgets
2. Add responsive grid layout for widget row
3. Wire up WebSocket hooks

### Phase 3: Testing
1. Unit tests for new wrapper components
2. Integration tests for WebSocket data flow
3. Visual regression tests for responsive layouts
4. Accessibility testing

### Phase 4: Documentation
1. Update dashboard component documentation
2. Add usage examples

## Testing Strategy

### Unit Tests
- Test widget rendering with various prop combinations
- Test loading, error, and empty states
- Test data transformation functions

### Integration Tests
- Test WebSocket connection and data flow
- Test real-time updates
- Test reconnection behavior

### Visual Tests
- Test responsive layout breakpoints
- Test color states for budget thresholds
- Test animation and transitions

## Dependencies
- No new dependencies required
- Uses existing: `cn` utility, Tailwind CSS, existing components

## Future Extensions
- Budget alerts/notifications when approaching limit
- Historical trend sparklines
- Agent drill-down on click
- Configurable time ranges
- Budget limit configuration from API/settings
