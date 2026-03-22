# ADR-0030: ExecutionTimeline Component Architecture

## Status
Accepted

## Context
We need to implement an `ExecutionTimeline` component that displays task execution stages as a horizontal timeline with timing and status information. The component should:
- Render a horizontal timeline of task execution stages
- Show name, duration, and status for each stage
- Highlight the current active stage with animation
- Display checkmarks for completed stages
- Show error icons for failed stages

This component will be used in the web-ui package for visualizing agent execution history over time. The types are already defined in `packages/web-ui/src/types/execution-timeline.ts`.

## Decision

### Component Location
Place the component at `packages/web-ui/src/components/timeline/ExecutionTimeline.tsx` in a new timeline module.

### Technology Choices

#### CSS Flexbox-Based Horizontal Layout
Use Flexbox for the horizontal timeline layout with relative positioning for connectors:
- **Pro**: Simple and performant layout
- **Pro**: Easy responsive behavior
- **Pro**: No external dependencies
- **Pro**: Works well with existing Tailwind patterns

#### Alternative Considered: SVG-Based Timeline
Rejected due to:
- Overly complex for a primarily linear layout
- Harder to style stage boxes with text
- Less flexible for responsive design

#### Alternative Considered: CSS Grid with absolute positioning
Rejected due to:
- More complex positioning calculations
- Harder to maintain consistent spacing
- Less natural flow for variable-width items

### Component Architecture

```
ExecutionTimeline (Main Container)
├── TimelineStageList (Flex container for stages)
│   ├── TimelineStage (Individual stage item)
│   │   ├── TimelineStageIcon (Status icon: checkmark, spinner, error)
│   │   ├── TimelineStageLabel (Stage name)
│   │   └── TimelineStageDuration (Formatted duration)
│   └── TimelineConnector (Connecting line between stages)
└── TimelineLoadingState / TimelineEmptyState (Conditional states)
```

### Props Interface (Using Existing Types)

The component will use the existing `ExecutionTimelineProps` from `@/types/execution-timeline`:

```typescript
interface ExecutionTimelineProps {
  data: ExecutionTimeline
  config?: Partial<ExecutionTimelineConfig>
  onSegmentClick?: (segment: TimelineSegment) => void
  onSegmentHover?: (segment: TimelineSegment | null) => void
  onEventClick?: (event: TimelineEvent) => void
  onEventHover?: (event: TimelineEvent | null) => void
  onZoomChange?: (zoomLevel: TimelineZoomLevel) => void
  onTimeRangeSelect?: (startTime: Date, endTime: Date) => void
  loading?: boolean
  error?: string | null
  className?: string
  emptyMessage?: string
  height?: number | string
  width?: number | string
  testId?: string
}
```

### Visual Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐      │
│   │    ✓    │─────│    ✓    │─────│  ⟳  *  │─────│    ○    │      │
│   │Planning │     │Executing│     │Reviewing│     │ Deploy  │      │
│   │   5m    │     │  12m    │     │   --    │     │   --    │      │
│   └─────────┘     └─────────┘     └─────────┘     └─────────┘      │
│                                                                     │
│   Legend: ✓ = Complete   ⟳ = In Progress (animated)                │
│           ✗ = Error      ○ = Pending                               │
└─────────────────────────────────────────────────────────────────────┘
                                 * = Pulsing animation
```

### Stage Status Icons

| Status | Icon | Style |
|--------|------|-------|
| Completed | Checkmark (✓) | Green background, white icon |
| In Progress | Spinner | Apex blue background, animated pulse |
| Failed/Error | X mark (✗) | Red background, white icon |
| Pending | Empty circle (○) | Gray/muted background |
| Paused | Pause icon | Yellow/warning background |

### Color Mapping (from existing TIMELINE_SEGMENT_STYLES)

```typescript
const STAGE_STATUS_STYLES = {
  completed: {
    icon: 'text-white',
    bg: 'bg-green-500',
    border: 'border-green-600',
    connector: 'bg-green-500',
  },
  active: {
    icon: 'text-white',
    bg: 'bg-apex-500',
    border: 'border-apex-600',
    connector: 'bg-apex-500',
    animation: 'animate-pulse ring-2 ring-apex-500/30',
  },
  error: {
    icon: 'text-white',
    bg: 'bg-red-500',
    border: 'border-red-600',
    connector: 'bg-red-500/50',
  },
  pending: {
    icon: 'text-foreground-secondary',
    bg: 'bg-background-tertiary',
    border: 'border-border',
    connector: 'bg-border',
  },
}
```

### Size Variants (using TIMELINE_SIZE_CONFIGS)

| Size | Icon Size | Label Font | Duration Font | Connector Width |
|------|-----------|------------|---------------|-----------------|
| sm   | 24px      | text-xs    | text-xs       | 2px             |
| md   | 32px      | text-sm    | text-xs       | 3px             |
| lg   | 48px      | text-base  | text-sm       | 4px             |

### Animation Strategy

1. **Active Stage Highlight**: Use `animate-pulse` from Tailwind with custom ring for glow effect
2. **Connector Progress**: CSS gradient transition for partial completion visualization
3. **State Transitions**: `transition-all duration-300` for smooth state changes
4. **Reduced Motion**: Respect `prefers-reduced-motion` media query

```typescript
const activeAnimation = cn(
  'animate-pulse',
  'ring-2 ring-apex-500/30',
  'motion-reduce:animate-none motion-reduce:ring-0'
)
```

### Component Implementation Structure

```typescript
// Main component
export function ExecutionTimeline({
  data,
  config = {},
  onSegmentClick,
  onSegmentHover,
  loading,
  error,
  className,
  emptyMessage,
  height,
  width,
  testId,
}: ExecutionTimelineProps) {
  // Merge with default config
  const mergedConfig = { ...DEFAULT_EXECUTION_TIMELINE_CONFIG, ...config }

  // Process segments for rendering
  const processedSegments = useProcessedSegments(data.segments, mergedConfig)

  // Handle loading state
  if (loading) return <TimelineLoadingState />

  // Handle error state
  if (error) return <TimelineErrorState error={error} />

  // Handle empty state
  if (data.segments.length === 0) {
    return <TimelineEmptyState message={emptyMessage} />
  }

  return (
    <div className={cn('relative', className)} style={{ height, width }}>
      <div className="flex items-center gap-2 overflow-x-auto">
        {processedSegments.map((segment, index) => (
          <React.Fragment key={segment.id}>
            <TimelineStage
              segment={segment}
              config={mergedConfig}
              onClick={() => onSegmentClick?.(segment)}
              onHover={(isHovered) => onSegmentHover?.(isHovered ? segment : null)}
            />
            {index < processedSegments.length - 1 && (
              <TimelineConnector
                fromStatus={segment.type}
                toStatus={processedSegments[index + 1].type}
                size={mergedConfig.size}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
```

### Sub-Components

#### TimelineStage

```typescript
interface TimelineStageProps {
  segment: ProcessedTimelineSegment
  config: ExecutionTimelineConfig
  onClick?: () => void
  onHover?: (isHovered: boolean) => void
}

function TimelineStage({ segment, config, onClick, onHover }: TimelineStageProps) {
  const isActive = segment.isActive
  const statusStyles = getStageStatusStyles(segment.type, isActive)
  const sizeConfig = TIMELINE_SIZE_CONFIGS[config.size]

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1 cursor-pointer',
        config.interactive && 'hover:scale-105 transition-transform'
      )}
      onClick={onClick}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      {/* Status Icon */}
      <div className={cn(
        'rounded-full flex items-center justify-center',
        statusStyles.bg,
        statusStyles.border,
        isActive && statusStyles.animation,
        `w-${sizeConfig.eventMarkerSize} h-${sizeConfig.eventMarkerSize}`
      )}>
        <StageIcon status={segment.type} isActive={isActive} />
      </div>

      {/* Stage Label */}
      {config.showLabels && (
        <span className={cn('font-medium', `text-[${sizeConfig.labelFontSize}px]`)}>
          {segment.truncatedLabel}
        </span>
      )}

      {/* Duration */}
      {config.showDurations && (
        <span className="text-foreground-secondary text-xs">
          {segment.durationDisplay}
        </span>
      )}
    </div>
  )
}
```

#### TimelineConnector

```typescript
interface TimelineConnectorProps {
  fromStatus: TimelineSegmentType
  toStatus: TimelineSegmentType
  size: TimelineSize
}

function TimelineConnector({ fromStatus, toStatus, size }: TimelineConnectorProps) {
  const connectorWidth = size === 'sm' ? 'h-0.5' : size === 'md' ? 'h-1' : 'h-1.5'
  const isFromCompleted = fromStatus === 'executing' && !['pending', 'idle'].includes(toStatus)

  return (
    <div className={cn(
      'flex-1 min-w-[40px]',
      connectorWidth,
      isFromCompleted ? 'bg-green-500' : 'bg-border'
    )} />
  )
}
```

#### StageIcon

```typescript
function StageIcon({ status, isActive }: { status: TimelineSegmentType, isActive?: boolean }) {
  if (isActive || status === 'executing') {
    return <Loader2 className="w-4 h-4 animate-spin text-white" />
  }

  switch (status) {
    case 'reviewing':
      return <Check className="w-4 h-4 text-white" />
    case 'error':
      return <X className="w-4 h-4 text-white" />
    case 'paused':
      return <Pause className="w-4 h-4 text-white" />
    case 'waiting':
      return <Clock className="w-4 h-4 text-foreground-secondary" />
    default:
      return <Circle className="w-4 h-4 text-foreground-secondary" />
  }
}
```

### Custom Hook: useProcessedSegments

```typescript
function useProcessedSegments(
  segments: TimelineSegment[],
  config: ExecutionTimelineConfig
): ProcessedTimelineSegment[] {
  return useMemo(() => {
    const sorted = sortSegmentsByTime(segments)

    return sorted.map(segment => {
      const durationMs = segment.endTime
        ? segment.endTime.getTime() - segment.startTime.getTime()
        : Date.now() - segment.startTime.getTime()

      return {
        ...segment,
        width: Math.max(config.minSegmentWidth, durationMs / 1000), // Simplified
        offset: 0, // Calculated relative to container
        calculatedDurationMs: durationMs,
        durationDisplay: formatTimelineDuration(durationMs),
        displayColor: getSegmentColor(segment.type, config.segmentColors),
        truncatedLabel: truncateSegmentLabel(segment.label),
      }
    })
  }, [segments, config])
}
```

### Accessibility

- Use `role="progressbar"` on the timeline container
- Set `aria-valuemin="0"`, `aria-valuemax` to total stages
- Set `aria-valuenow` to number of completed stages
- Set `aria-label` describing timeline progress
- Support keyboard navigation with arrow keys
- Each stage should be focusable with clear focus indicators
- Use semantic markup with appropriate ARIA labels

### File Structure

```
packages/web-ui/src/components/timeline/
├── ExecutionTimeline.tsx      # Main component
├── TimelineStage.tsx          # Individual stage component
├── TimelineConnector.tsx      # Connecting line component
├── TimelineEmptyState.tsx     # Empty state display
├── TimelineLoadingState.tsx   # Loading state display
├── hooks/
│   └── useProcessedSegments.ts # Segment processing hook
├── index.ts                   # Barrel exports
└── __tests__/
    ├── ExecutionTimeline.test.tsx        # Unit tests
    ├── ExecutionTimeline.integration.test.tsx # Integration tests
    └── ExecutionTimeline.accessibility.test.tsx # A11y tests
```

### Testing Strategy

1. **Unit Tests (Vitest + React Testing Library)**
   - Render with various segment configurations
   - Test status icon rendering for each segment type
   - Test active state animation classes
   - Test click and hover handlers
   - Test empty, loading, and error states
   - Test size variants

2. **Accessibility Tests**
   - ARIA attributes presence
   - Keyboard navigation
   - Screen reader compatibility

3. **Edge Cases**
   - Single segment timeline
   - Many segments (overflow/scroll behavior)
   - All segments completed
   - All segments pending
   - Mixed status segments
   - Ongoing segment without end time

## Consequences

### Positive
- Uses existing type definitions from `execution-timeline.ts`
- Consistent with existing component patterns (TaskCard, ProgressIndicator)
- No external dependencies
- Small bundle footprint
- Full accessibility support
- Smooth animations with motion preference respect
- Reusable sub-components

### Negative
- Need to create new `timeline` component directory
- Some visual complexity with connectors and animations
- May need scroll handling for many stages

### Risks
- Animation performance on many segments
- Horizontal overflow handling on mobile
- Connector styling between different status states

## Implementation Notes

### Dependencies
- No new dependencies required
- Uses existing: `cn` utility, Tailwind CSS, lucide-react icons
- Leverages existing types from `execution-timeline.ts`

### Integration Points
- Can be used in task detail pages
- Can be embedded in KanbanBoard for task preview
- Works with real-time WebSocket updates through parent components

### Future Extensions
- Vertical timeline orientation (already in config)
- Zoom controls for long timelines
- Event markers on timeline
- Time axis display
- Tooltips with detailed segment info
