/**
 * Comprehensive tests for Execution Timeline types and utility functions
 * Tests type safety, interface structure, default values, utility functions, and edge cases
 */

import { describe, it, expect } from 'vitest'
import type {
  TimelineEventType,
  TimelineSegmentType,
  TimelineScale,
  TimelineOrientation,
  TimelineSize,
  TimelineZoomLevel,
  TimelineEvent,
  TimelineSegment,
  ExecutionTimeline,
  TimelineSegmentColorConfig,
  TimelineEventColorConfig,
  ExecutionTimelineConfig,
  ExecutionTimelineProps,
  ProcessedTimelineSegment,
  ProcessedTimelineEvent,
  TimelineSegmentTooltipData,
  TimelineEventTooltipData,
  ExecutionTimelineSummary,
  TimelineSizeConfig,
} from '../execution-timeline'
import {
  DEFAULT_TIMELINE_SEGMENT_COLORS,
  DEFAULT_TIMELINE_EVENT_COLORS,
  DEFAULT_EXECUTION_TIMELINE_CONFIG,
  DEFAULT_EXECUTION_TIMELINE_PROPS,
  TIMELINE_SIZE_CONFIGS,
  EMPTY_EXECUTION_TIMELINE,
  TIMELINE_EVENT_ICONS,
  TIMELINE_EVENT_LABELS,
  TIMELINE_SEGMENT_LABELS,
  TIMELINE_SEGMENT_STYLES,
  TIMELINE_EVENT_STYLES,
  calculateTimelineSummary,
  formatTimelineDuration,
  formatTimelineTimestamp,
  truncateSegmentLabel,
  getSegmentColor,
  getEventColor,
  determineTimeScale,
  sortSegmentsByTime,
  sortEventsByTime,
  filterSegmentsByTimeRange,
  filterEventsByTimeRange,
} from '../execution-timeline'

// ============================================================================
// Mock Data Factories
// ============================================================================

const createMockTimelineEvent = (overrides: Partial<TimelineEvent> = {}): TimelineEvent => ({
  id: 'event-1',
  type: 'start',
  timestamp: new Date('2024-01-01T10:00:00Z'),
  label: 'Test Event',
  ...overrides,
})

const createMockTimelineSegment = (overrides: Partial<TimelineSegment> = {}): TimelineSegment => ({
  id: 'segment-1',
  type: 'executing',
  startTime: new Date('2024-01-01T10:00:00Z'),
  endTime: new Date('2024-01-01T10:30:00Z'),
  label: 'Test Segment',
  ...overrides,
})

const createMockExecutionTimeline = (
  segments: TimelineSegment[] = [],
  events: TimelineEvent[] = [],
  overrides: Partial<ExecutionTimeline> = {}
): ExecutionTimeline => {
  const startTime = segments.length > 0
    ? new Date(Math.min(...segments.map(s => s.startTime.getTime())))
    : new Date()
  const endTime = segments.length > 0
    ? new Date(Math.max(...segments.map(s => (s.endTime || new Date()).getTime())))
    : new Date()

  return {
    id: 'timeline-1',
    title: 'Test Timeline',
    startTime,
    endTime,
    durationMs: endTime.getTime() - startTime.getTime(),
    segments,
    events,
    agentCount: new Set(segments.map(s => s.agentId).filter(Boolean)).size,
    taskCount: new Set(segments.map(s => s.taskId).filter(Boolean)).size,
    isActive: segments.some(s => s.isActive),
    lastUpdated: new Date(),
    ...overrides,
  }
}

// ============================================================================
// Interface Structure Tests
// ============================================================================

describe('TimelineEvent Interface', () => {
  it('should have all required fields with correct types', () => {
    const event = createMockTimelineEvent()

    expect(typeof event.id).toBe('string')
    expect(typeof event.type).toBe('string')
    expect(event.timestamp).toBeInstanceOf(Date)
    expect(typeof event.label).toBe('string')
  })

  it('should support optional fields', () => {
    const event = createMockTimelineEvent({
      description: 'Test description',
      taskId: 'task-123',
      agentId: 'agent-456',
      error: 'Test error',
      metadata: { key: 'value' },
    })

    expect(typeof event.description).toBe('string')
    expect(typeof event.taskId).toBe('string')
    expect(typeof event.agentId).toBe('string')
    expect(typeof event.error).toBe('string')
    expect(typeof event.metadata).toBe('object')
  })

  it('should work without optional fields', () => {
    const event = createMockTimelineEvent()

    expect(event.description).toBeUndefined()
    expect(event.taskId).toBeUndefined()
    expect(event.agentId).toBeUndefined()
    expect(event.error).toBeUndefined()
    expect(event.metadata).toBeUndefined()
  })

  it('should accept all valid event types', () => {
    const eventTypes: TimelineEventType[] = [
      'start', 'complete', 'error', 'warning',
      'checkpoint', 'user_action', 'stage_change', 'dependency_resolved'
    ]

    eventTypes.forEach(type => {
      const event = createMockTimelineEvent({ type })
      expect(event.type).toBe(type)
    })
  })
})

describe('TimelineSegment Interface', () => {
  it('should have all required fields with correct types', () => {
    const segment = createMockTimelineSegment()

    expect(typeof segment.id).toBe('string')
    expect(typeof segment.type).toBe('string')
    expect(segment.startTime).toBeInstanceOf(Date)
    expect(typeof segment.label).toBe('string')
  })

  it('should support optional fields', () => {
    const segment = createMockTimelineSegment({
      endTime: new Date(),
      description: 'Test description',
      progress: 75,
      taskId: 'task-123',
      agentId: 'agent-456',
      agentName: 'Test Agent',
      isActive: true,
      color: '#ff5733',
      metadata: { key: 'value' },
    })

    expect(segment.endTime).toBeInstanceOf(Date)
    expect(typeof segment.description).toBe('string')
    expect(typeof segment.progress).toBe('number')
    expect(typeof segment.taskId).toBe('string')
    expect(typeof segment.agentId).toBe('string')
    expect(typeof segment.agentName).toBe('string')
    expect(typeof segment.isActive).toBe('boolean')
    expect(typeof segment.color).toBe('string')
    expect(typeof segment.metadata).toBe('object')
  })

  it('should accept all valid segment types', () => {
    const segmentTypes: TimelineSegmentType[] = [
      'planning', 'executing', 'waiting', 'reviewing', 'paused', 'idle', 'error'
    ]

    segmentTypes.forEach(type => {
      const segment = createMockTimelineSegment({ type })
      expect(segment.type).toBe(type)
    })
  })

  it('should handle undefined endTime for ongoing segments', () => {
    const segment = createMockTimelineSegment({
      endTime: undefined,
      isActive: true,
    })

    expect(segment.endTime).toBeUndefined()
    expect(segment.isActive).toBe(true)
  })
})

describe('ExecutionTimeline Interface', () => {
  it('should have all required fields with correct types', () => {
    const timeline = createMockExecutionTimeline()

    expect(typeof timeline.id).toBe('string')
    expect(typeof timeline.title).toBe('string')
    expect(timeline.startTime).toBeInstanceOf(Date)
    expect(typeof timeline.durationMs).toBe('number')
    expect(Array.isArray(timeline.segments)).toBe(true)
    expect(Array.isArray(timeline.events)).toBe(true)
    expect(typeof timeline.agentCount).toBe('number')
    expect(typeof timeline.taskCount).toBe('number')
    expect(typeof timeline.isActive).toBe('boolean')
    expect(timeline.lastUpdated).toBeInstanceOf(Date)
  })

  it('should support optional fields', () => {
    const timeline = createMockExecutionTimeline([], [], {
      description: 'Test description',
      endTime: new Date(),
      projectId: 'project-123',
      metadata: { key: 'value' },
    })

    expect(typeof timeline.description).toBe('string')
    expect(timeline.endTime).toBeInstanceOf(Date)
    expect(typeof timeline.projectId).toBe('string')
    expect(typeof timeline.metadata).toBe('object')
  })

  it('should calculate counts correctly from segments', () => {
    const segments = [
      createMockTimelineSegment({ id: 's1', agentId: 'agent-1', taskId: 'task-1' }),
      createMockTimelineSegment({ id: 's2', agentId: 'agent-1', taskId: 'task-2' }),
      createMockTimelineSegment({ id: 's3', agentId: 'agent-2', taskId: 'task-2' }),
    ]

    const timeline = createMockExecutionTimeline(segments)

    expect(timeline.agentCount).toBe(2)
    expect(timeline.taskCount).toBe(2)
  })
})

describe('ExecutionTimelineConfig Interface', () => {
  it('should have all fields with correct types', () => {
    const config: ExecutionTimelineConfig = { ...DEFAULT_EXECUTION_TIMELINE_CONFIG }

    expect(typeof config.scale).toBe('string')
    expect(typeof config.orientation).toBe('string')
    expect(typeof config.size).toBe('string')
    expect(typeof config.zoomLevel).toBe('string')
    expect(typeof config.showEvents).toBe('boolean')
    expect(typeof config.showLabels).toBe('boolean')
    expect(typeof config.showTimeAxis).toBe('boolean')
    expect(typeof config.showTooltips).toBe('boolean')
    expect(typeof config.showGrid).toBe('boolean')
    expect(typeof config.showDurations).toBe('boolean')
    expect(typeof config.animated).toBe('boolean')
    expect(typeof config.interactive).toBe('boolean')
    expect(typeof config.refreshIntervalMs).toBe('number')
    expect(typeof config.minSegmentWidth).toBe('number')
  })

  it('should support optional color configurations', () => {
    const config: ExecutionTimelineConfig = {
      ...DEFAULT_EXECUTION_TIMELINE_CONFIG,
      segmentColors: {
        executing: '#custom-executing',
        error: '#custom-error',
      },
      eventColors: {
        start: '#custom-start',
        complete: '#custom-complete',
      },
    }

    expect(config.segmentColors).toBeDefined()
    expect(config.segmentColors!.executing).toBe('#custom-executing')
    expect(config.eventColors).toBeDefined()
    expect(config.eventColors!.start).toBe('#custom-start')
  })
})

describe('ExecutionTimelineProps Interface', () => {
  it('should accept minimal props with just data', () => {
    const minimalProps: ExecutionTimelineProps = {
      data: EMPTY_EXECUTION_TIMELINE,
    }

    expect(minimalProps.data).toBeDefined()
    expect(minimalProps.config).toBeUndefined()
  })

  it('should accept all optional props', () => {
    const fullProps: ExecutionTimelineProps = {
      data: EMPTY_EXECUTION_TIMELINE,
      config: { scale: 'minutes' },
      onSegmentClick: (segment) => console.log(segment),
      onSegmentHover: (segment) => console.log(segment),
      onEventClick: (event) => console.log(event),
      onEventHover: (event) => console.log(event),
      onZoomChange: (level) => console.log(level),
      onTimeRangeSelect: (start, end) => console.log(start, end),
      loading: true,
      error: 'Test error',
      className: 'custom-class',
      emptyMessage: 'Custom empty message',
      height: 300,
      width: '800px',
      testId: 'test-timeline',
    }

    expect(fullProps.data).toBeDefined()
    expect(fullProps.config!.scale).toBe('minutes')
    expect(typeof fullProps.onSegmentClick).toBe('function')
    expect(typeof fullProps.onSegmentHover).toBe('function')
    expect(typeof fullProps.onEventClick).toBe('function')
    expect(typeof fullProps.onEventHover).toBe('function')
    expect(typeof fullProps.onZoomChange).toBe('function')
    expect(typeof fullProps.onTimeRangeSelect).toBe('function')
    expect(fullProps.loading).toBe(true)
    expect(fullProps.error).toBe('Test error')
    expect(fullProps.className).toBe('custom-class')
    expect(fullProps.emptyMessage).toBe('Custom empty message')
    expect(fullProps.height).toBe(300)
    expect(fullProps.width).toBe('800px')
    expect(fullProps.testId).toBe('test-timeline')
  })
})

// ============================================================================
// Type Union Tests
// ============================================================================

describe('Type Unions', () => {
  describe('TimelineEventType', () => {
    it('should accept all valid event type values', () => {
      const eventTypes: TimelineEventType[] = [
        'start', 'complete', 'error', 'warning',
        'checkpoint', 'user_action', 'stage_change', 'dependency_resolved'
      ]
      eventTypes.forEach(type => {
        expect(typeof type).toBe('string')
      })
    })
  })

  describe('TimelineSegmentType', () => {
    it('should accept all valid segment type values', () => {
      const segmentTypes: TimelineSegmentType[] = [
        'planning', 'executing', 'waiting', 'reviewing', 'paused', 'idle', 'error'
      ]
      segmentTypes.forEach(type => {
        expect(typeof type).toBe('string')
      })
    })
  })

  describe('TimelineScale', () => {
    it('should accept all valid scale values', () => {
      const scales: TimelineScale[] = ['seconds', 'minutes', 'hours', 'auto']
      scales.forEach(scale => {
        expect(typeof scale).toBe('string')
      })
    })
  })

  describe('TimelineOrientation', () => {
    it('should accept all valid orientation values', () => {
      const orientations: TimelineOrientation[] = ['horizontal', 'vertical']
      orientations.forEach(orientation => {
        expect(typeof orientation).toBe('string')
      })
    })
  })

  describe('TimelineSize', () => {
    it('should accept all valid size values', () => {
      const sizes: TimelineSize[] = ['sm', 'md', 'lg']
      sizes.forEach(size => {
        expect(typeof size).toBe('string')
      })
    })
  })

  describe('TimelineZoomLevel', () => {
    it('should accept all valid zoom level values', () => {
      const levels: TimelineZoomLevel[] = ['fit', '50%', '100%', '150%', '200%']
      levels.forEach(level => {
        expect(typeof level).toBe('string')
      })
    })
  })
})

// ============================================================================
// Default Values and Constants Tests
// ============================================================================

describe('Default Values and Constants', () => {
  describe('DEFAULT_TIMELINE_SEGMENT_COLORS', () => {
    it('should have colors for all segment types', () => {
      const segmentTypes: TimelineSegmentType[] = [
        'planning', 'executing', 'waiting', 'reviewing', 'paused', 'idle', 'error'
      ]

      segmentTypes.forEach(type => {
        expect(DEFAULT_TIMELINE_SEGMENT_COLORS).toHaveProperty(type)
        expect(typeof DEFAULT_TIMELINE_SEGMENT_COLORS[type]).toBe('string')
      })
    })

    it('should have valid CSS color values', () => {
      Object.values(DEFAULT_TIMELINE_SEGMENT_COLORS).forEach(color => {
        expect(typeof color).toBe('string')
        expect(color.length).toBeGreaterThan(0)
      })
    })
  })

  describe('DEFAULT_TIMELINE_EVENT_COLORS', () => {
    it('should have colors for all event types', () => {
      const eventTypes: TimelineEventType[] = [
        'start', 'complete', 'error', 'warning',
        'checkpoint', 'user_action', 'stage_change', 'dependency_resolved'
      ]

      eventTypes.forEach(type => {
        expect(DEFAULT_TIMELINE_EVENT_COLORS).toHaveProperty(type)
        expect(typeof DEFAULT_TIMELINE_EVENT_COLORS[type]).toBe('string')
      })
    })

    it('should have valid CSS color values', () => {
      Object.values(DEFAULT_TIMELINE_EVENT_COLORS).forEach(color => {
        expect(typeof color).toBe('string')
        expect(color.length).toBeGreaterThan(0)
      })
    })
  })

  describe('DEFAULT_EXECUTION_TIMELINE_CONFIG', () => {
    it('should have sensible default values', () => {
      expect(DEFAULT_EXECUTION_TIMELINE_CONFIG.scale).toBe('auto')
      expect(DEFAULT_EXECUTION_TIMELINE_CONFIG.orientation).toBe('horizontal')
      expect(DEFAULT_EXECUTION_TIMELINE_CONFIG.size).toBe('md')
      expect(DEFAULT_EXECUTION_TIMELINE_CONFIG.zoomLevel).toBe('100%')
      expect(DEFAULT_EXECUTION_TIMELINE_CONFIG.showEvents).toBe(true)
      expect(DEFAULT_EXECUTION_TIMELINE_CONFIG.showLabels).toBe(true)
      expect(DEFAULT_EXECUTION_TIMELINE_CONFIG.showTimeAxis).toBe(true)
      expect(DEFAULT_EXECUTION_TIMELINE_CONFIG.showTooltips).toBe(true)
      expect(DEFAULT_EXECUTION_TIMELINE_CONFIG.showGrid).toBe(true)
      expect(DEFAULT_EXECUTION_TIMELINE_CONFIG.showDurations).toBe(true)
      expect(DEFAULT_EXECUTION_TIMELINE_CONFIG.animated).toBe(true)
      expect(DEFAULT_EXECUTION_TIMELINE_CONFIG.interactive).toBe(true)
      expect(DEFAULT_EXECUTION_TIMELINE_CONFIG.refreshIntervalMs).toBe(1000)
      expect(DEFAULT_EXECUTION_TIMELINE_CONFIG.minSegmentWidth).toBe(20)
    })

    it('should have all required keys', () => {
      const expectedKeys = [
        'scale', 'orientation', 'size', 'zoomLevel', 'showEvents', 'showLabels',
        'showTimeAxis', 'showTooltips', 'showGrid', 'showDurations', 'animated',
        'interactive', 'refreshIntervalMs', 'minSegmentWidth'
      ]

      expectedKeys.forEach(key => {
        expect(DEFAULT_EXECUTION_TIMELINE_CONFIG).toHaveProperty(key)
      })
    })
  })

  describe('DEFAULT_EXECUTION_TIMELINE_PROPS', () => {
    it('should have sensible default values', () => {
      expect(DEFAULT_EXECUTION_TIMELINE_PROPS.loading).toBe(false)
      expect(DEFAULT_EXECUTION_TIMELINE_PROPS.emptyMessage).toBe('No execution timeline data available')
      expect(DEFAULT_EXECUTION_TIMELINE_PROPS.height).toBe(200)
      expect(DEFAULT_EXECUTION_TIMELINE_PROPS.width).toBe('100%')
    })
  })

  describe('TIMELINE_SIZE_CONFIGS', () => {
    it('should have all size variants', () => {
      expect(TIMELINE_SIZE_CONFIGS).toHaveProperty('sm')
      expect(TIMELINE_SIZE_CONFIGS).toHaveProperty('md')
      expect(TIMELINE_SIZE_CONFIGS).toHaveProperty('lg')
    })

    it('should have increasing dimensions from sm to lg', () => {
      const { sm, md, lg } = TIMELINE_SIZE_CONFIGS

      expect(sm.trackHeight).toBeLessThan(md.trackHeight)
      expect(md.trackHeight).toBeLessThan(lg.trackHeight)

      expect(sm.eventMarkerSize).toBeLessThan(md.eventMarkerSize)
      expect(md.eventMarkerSize).toBeLessThan(lg.eventMarkerSize)

      expect(sm.labelFontSize).toBeLessThan(md.labelFontSize)
      expect(md.labelFontSize).toBeLessThan(lg.labelFontSize)

      expect(sm.timeAxisHeight).toBeLessThan(md.timeAxisHeight)
      expect(md.timeAxisHeight).toBeLessThan(lg.timeAxisHeight)
    })

    it('should have all required size properties', () => {
      Object.values(TIMELINE_SIZE_CONFIGS).forEach(size => {
        expect(size).toHaveProperty('trackHeight')
        expect(size).toHaveProperty('eventMarkerSize')
        expect(size).toHaveProperty('labelFontSize')
        expect(size).toHaveProperty('timeAxisHeight')
        expect(size).toHaveProperty('trackPadding')
        expect(size).toHaveProperty('minSegmentWidth')

        expect(typeof size.trackHeight).toBe('number')
        expect(typeof size.eventMarkerSize).toBe('number')
        expect(typeof size.labelFontSize).toBe('number')
        expect(typeof size.timeAxisHeight).toBe('number')
        expect(typeof size.trackPadding).toBe('number')
        expect(typeof size.minSegmentWidth).toBe('number')
      })
    })
  })

  describe('EMPTY_EXECUTION_TIMELINE', () => {
    it('should have empty/zero values for all fields', () => {
      expect(EMPTY_EXECUTION_TIMELINE.id).toBe('')
      expect(EMPTY_EXECUTION_TIMELINE.title).toBe('')
      expect(EMPTY_EXECUTION_TIMELINE.durationMs).toBe(0)
      expect(EMPTY_EXECUTION_TIMELINE.segments).toEqual([])
      expect(EMPTY_EXECUTION_TIMELINE.events).toEqual([])
      expect(EMPTY_EXECUTION_TIMELINE.agentCount).toBe(0)
      expect(EMPTY_EXECUTION_TIMELINE.taskCount).toBe(0)
      expect(EMPTY_EXECUTION_TIMELINE.isActive).toBe(false)
      expect(EMPTY_EXECUTION_TIMELINE.startTime).toBeInstanceOf(Date)
      expect(EMPTY_EXECUTION_TIMELINE.lastUpdated).toBeInstanceOf(Date)
    })
  })

  describe('TIMELINE_EVENT_ICONS', () => {
    it('should have icons for all event types', () => {
      const eventTypes: TimelineEventType[] = [
        'start', 'complete', 'error', 'warning',
        'checkpoint', 'user_action', 'stage_change', 'dependency_resolved'
      ]

      eventTypes.forEach(type => {
        expect(TIMELINE_EVENT_ICONS).toHaveProperty(type)
        expect(typeof TIMELINE_EVENT_ICONS[type]).toBe('string')
        expect(TIMELINE_EVENT_ICONS[type].length).toBeGreaterThan(0)
      })
    })
  })

  describe('TIMELINE_EVENT_LABELS', () => {
    it('should have labels for all event types', () => {
      const eventTypes: TimelineEventType[] = [
        'start', 'complete', 'error', 'warning',
        'checkpoint', 'user_action', 'stage_change', 'dependency_resolved'
      ]

      eventTypes.forEach(type => {
        expect(TIMELINE_EVENT_LABELS).toHaveProperty(type)
        expect(typeof TIMELINE_EVENT_LABELS[type]).toBe('string')
        expect(TIMELINE_EVENT_LABELS[type].length).toBeGreaterThan(0)
      })
    })

    it('should have expected label values', () => {
      expect(TIMELINE_EVENT_LABELS.start).toBe('Started')
      expect(TIMELINE_EVENT_LABELS.complete).toBe('Completed')
      expect(TIMELINE_EVENT_LABELS.error).toBe('Error')
      expect(TIMELINE_EVENT_LABELS.warning).toBe('Warning')
      expect(TIMELINE_EVENT_LABELS.checkpoint).toBe('Checkpoint')
      expect(TIMELINE_EVENT_LABELS.user_action).toBe('User Action')
      expect(TIMELINE_EVENT_LABELS.stage_change).toBe('Stage Change')
      expect(TIMELINE_EVENT_LABELS.dependency_resolved).toBe('Dependency Resolved')
    })
  })

  describe('TIMELINE_SEGMENT_LABELS', () => {
    it('should have labels for all segment types', () => {
      const segmentTypes: TimelineSegmentType[] = [
        'planning', 'executing', 'waiting', 'reviewing', 'paused', 'idle', 'error'
      ]

      segmentTypes.forEach(type => {
        expect(TIMELINE_SEGMENT_LABELS).toHaveProperty(type)
        expect(typeof TIMELINE_SEGMENT_LABELS[type]).toBe('string')
        expect(TIMELINE_SEGMENT_LABELS[type].length).toBeGreaterThan(0)
      })
    })

    it('should have expected label values', () => {
      expect(TIMELINE_SEGMENT_LABELS.planning).toBe('Planning')
      expect(TIMELINE_SEGMENT_LABELS.executing).toBe('Executing')
      expect(TIMELINE_SEGMENT_LABELS.waiting).toBe('Waiting')
      expect(TIMELINE_SEGMENT_LABELS.reviewing).toBe('Reviewing')
      expect(TIMELINE_SEGMENT_LABELS.paused).toBe('Paused')
      expect(TIMELINE_SEGMENT_LABELS.idle).toBe('Idle')
      expect(TIMELINE_SEGMENT_LABELS.error).toBe('Error')
    })
  })

  describe('TIMELINE_SEGMENT_STYLES', () => {
    it('should have style configurations for all segment types', () => {
      const segmentTypes: TimelineSegmentType[] = [
        'planning', 'executing', 'waiting', 'reviewing', 'paused', 'idle', 'error'
      ]

      segmentTypes.forEach(type => {
        expect(TIMELINE_SEGMENT_STYLES).toHaveProperty(type)

        const styles = TIMELINE_SEGMENT_STYLES[type]
        expect(styles).toHaveProperty('bg')
        expect(styles).toHaveProperty('text')
        expect(styles).toHaveProperty('border')
        expect(styles).toHaveProperty('hoverBg')

        Object.values(styles).forEach(styleValue => {
          expect(typeof styleValue).toBe('string')
          expect(styleValue.length).toBeGreaterThan(0)
        })
      })
    })

    it('should follow consistent naming patterns', () => {
      Object.values(TIMELINE_SEGMENT_STYLES).forEach(styles => {
        expect(styles.bg).toMatch(/^bg-/)
        expect(styles.text).toMatch(/^text-/)
        expect(styles.border).toMatch(/^border-/)
        expect(styles.hoverBg).toMatch(/^hover:bg-/)
      })
    })
  })

  describe('TIMELINE_EVENT_STYLES', () => {
    it('should have style configurations for all event types', () => {
      const eventTypes: TimelineEventType[] = [
        'start', 'complete', 'error', 'warning',
        'checkpoint', 'user_action', 'stage_change', 'dependency_resolved'
      ]

      eventTypes.forEach(type => {
        expect(TIMELINE_EVENT_STYLES).toHaveProperty(type)

        const styles = TIMELINE_EVENT_STYLES[type]
        expect(styles).toHaveProperty('bg')
        expect(styles).toHaveProperty('text')
        expect(styles).toHaveProperty('border')
        expect(styles).toHaveProperty('ring')

        Object.values(styles).forEach(styleValue => {
          expect(typeof styleValue).toBe('string')
          expect(styleValue.length).toBeGreaterThan(0)
        })
      })
    })

    it('should follow consistent naming patterns', () => {
      Object.values(TIMELINE_EVENT_STYLES).forEach(styles => {
        expect(styles.bg).toMatch(/^bg-/)
        expect(styles.text).toMatch(/^text-/)
        expect(styles.border).toMatch(/^border-/)
        expect(styles.ring).toMatch(/^ring-/)
      })
    })

    it('should have consistent color schemes for event types', () => {
      // Complete should use green colors
      expect(TIMELINE_EVENT_STYLES.complete.bg).toContain('green')

      // Error should use red colors
      expect(TIMELINE_EVENT_STYLES.error.bg).toContain('red')

      // Warning should use yellow colors
      expect(TIMELINE_EVENT_STYLES.warning.bg).toContain('yellow')
    })
  })
})

// ============================================================================
// Utility Functions Tests
// ============================================================================

describe('Utility Functions', () => {
  describe('calculateTimelineSummary', () => {
    it('should return empty summary for empty timeline', () => {
      const summary = calculateTimelineSummary(EMPTY_EXECUTION_TIMELINE)

      expect(summary.segmentCount).toBe(0)
      expect(summary.eventCount).toBe(0)
      expect(summary.totalDurationMs).toBe(0)
      expect(summary.activeTimeMs).toBe(0)
      expect(summary.idleTimeMs).toBe(0)
      expect(summary.efficiencyRatio).toBe(0)
      expect(summary.errorCount).toBe(0)
      expect(summary.averageSegmentDurationMs).toBe(0)
    })

    it('should correctly count segment types', () => {
      const segments: TimelineSegment[] = [
        createMockTimelineSegment({ id: '1', type: 'planning' }),
        createMockTimelineSegment({ id: '2', type: 'executing' }),
        createMockTimelineSegment({ id: '3', type: 'executing' }),
        createMockTimelineSegment({ id: '4', type: 'waiting' }),
        createMockTimelineSegment({ id: '5', type: 'error' }),
      ]

      const timeline = createMockExecutionTimeline(segments)
      const summary = calculateTimelineSummary(timeline)

      expect(summary.segmentTypeCounts.planning).toBe(1)
      expect(summary.segmentTypeCounts.executing).toBe(2)
      expect(summary.segmentTypeCounts.waiting).toBe(1)
      expect(summary.segmentTypeCounts.error).toBe(1)
      expect(summary.segmentCount).toBe(5)
    })

    it('should correctly count event types', () => {
      const events: TimelineEvent[] = [
        createMockTimelineEvent({ id: '1', type: 'start' }),
        createMockTimelineEvent({ id: '2', type: 'checkpoint' }),
        createMockTimelineEvent({ id: '3', type: 'checkpoint' }),
        createMockTimelineEvent({ id: '4', type: 'error' }),
        createMockTimelineEvent({ id: '5', type: 'complete' }),
      ]

      const timeline = createMockExecutionTimeline([], events)
      const summary = calculateTimelineSummary(timeline)

      expect(summary.eventTypeCounts.start).toBe(1)
      expect(summary.eventTypeCounts.checkpoint).toBe(2)
      expect(summary.eventTypeCounts.error).toBe(1)
      expect(summary.eventTypeCounts.complete).toBe(1)
      expect(summary.eventCount).toBe(5)
    })

    it('should calculate efficiency ratio correctly', () => {
      const segments: TimelineSegment[] = [
        createMockTimelineSegment({
          id: '1',
          type: 'executing',
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:30:00Z'),
        }),
        createMockTimelineSegment({
          id: '2',
          type: 'idle',
          startTime: new Date('2024-01-01T10:30:00Z'),
          endTime: new Date('2024-01-01T10:40:00Z'),
        }),
      ]

      const timeline = createMockExecutionTimeline(segments)
      const summary = calculateTimelineSummary(timeline)

      // 30 minutes executing, 10 minutes idle = 40 minutes total
      // Efficiency = 30/40 = 0.75
      expect(summary.efficiencyRatio).toBeCloseTo(0.75, 1)
    })

    it('should count errors from both segments and events', () => {
      const segments: TimelineSegment[] = [
        createMockTimelineSegment({ id: '1', type: 'error' }),
        createMockTimelineSegment({ id: '2', type: 'error' }),
      ]
      const events: TimelineEvent[] = [
        createMockTimelineEvent({ id: '1', type: 'error' }),
      ]

      const timeline = createMockExecutionTimeline(segments, events)
      const summary = calculateTimelineSummary(timeline)

      expect(summary.errorCount).toBe(3)
    })
  })

  describe('formatTimelineDuration', () => {
    it('should return "0s" for negative duration', () => {
      expect(formatTimelineDuration(-1000)).toBe('0s')
    })

    it('should format milliseconds for very short durations', () => {
      expect(formatTimelineDuration(500)).toBe('500ms')
    })

    it('should format seconds only for values under 1 minute', () => {
      expect(formatTimelineDuration(30000)).toBe('30s')
    })

    it('should format minutes and seconds for values under 1 hour', () => {
      expect(formatTimelineDuration(90000)).toBe('1m 30s')
    })

    it('should format hours and minutes for larger values', () => {
      expect(formatTimelineDuration(3660000)).toBe('1h 1m')
    })

    it('should handle exact minute boundaries', () => {
      expect(formatTimelineDuration(120000)).toBe('2m')
    })

    it('should handle exact hour boundaries', () => {
      expect(formatTimelineDuration(7200000)).toBe('2h')
    })

    it('should handle zero duration', () => {
      expect(formatTimelineDuration(0)).toBe('0ms')
    })
  })

  describe('formatTimelineTimestamp', () => {
    it('should return "N/A" for invalid date', () => {
      expect(formatTimelineTimestamp(new Date('invalid'))).toBe('N/A')
    })

    it('should format time without date by default', () => {
      const timestamp = new Date('2024-01-15T14:30:45Z')
      const result = formatTimelineTimestamp(timestamp)

      // Should contain time components
      expect(result).toMatch(/\d{2}:\d{2}:\d{2}/)
    })

    it('should include date when requested', () => {
      const timestamp = new Date('2024-01-15T14:30:45Z')
      const result = formatTimelineTimestamp(timestamp, true)

      // Should contain both date and time components
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(8)
    })
  })

  describe('truncateSegmentLabel', () => {
    it('should return "Segment" for undefined', () => {
      expect(truncateSegmentLabel(undefined)).toBe('Segment')
    })

    it('should return "Segment" for null', () => {
      expect(truncateSegmentLabel(null)).toBe('Segment')
    })

    it('should return "Segment" for empty string', () => {
      expect(truncateSegmentLabel('')).toBe('Segment')
    })

    it('should return original string if within limit', () => {
      expect(truncateSegmentLabel('Short label')).toBe('Short label')
    })

    it('should truncate long strings with ellipsis', () => {
      const longLabel = 'This is a very long segment label that exceeds the limit'
      const result = truncateSegmentLabel(longLabel)
      expect(result.length).toBeLessThanOrEqual(20)
      expect(result.endsWith('...')).toBe(true)
    })

    it('should respect custom maxLength', () => {
      const label = 'Short text'
      expect(truncateSegmentLabel(label, 5)).toBe('Sh...')
    })

    it('should handle exact limit length', () => {
      const label = 'a'.repeat(20)
      expect(truncateSegmentLabel(label)).toBe(label)
    })
  })

  describe('getSegmentColor', () => {
    it('should return default color for each segment type', () => {
      const segmentTypes: TimelineSegmentType[] = [
        'planning', 'executing', 'waiting', 'reviewing', 'paused', 'idle', 'error'
      ]

      segmentTypes.forEach(type => {
        const color = getSegmentColor(type)
        expect(typeof color).toBe('string')
        expect(color.length).toBeGreaterThan(0)
      })
    })

    it('should use custom colors when provided', () => {
      const customColors: Partial<TimelineSegmentColorConfig> = {
        executing: '#custom-executing',
        error: '#custom-error',
      }

      expect(getSegmentColor('executing', customColors)).toBe('#custom-executing')
      expect(getSegmentColor('error', customColors)).toBe('#custom-error')
    })

    it('should fall back to defaults for unspecified custom colors', () => {
      const customColors: Partial<TimelineSegmentColorConfig> = {
        executing: '#custom-executing',
      }

      expect(getSegmentColor('planning', customColors)).toBe(DEFAULT_TIMELINE_SEGMENT_COLORS.planning)
    })
  })

  describe('getEventColor', () => {
    it('should return default color for each event type', () => {
      const eventTypes: TimelineEventType[] = [
        'start', 'complete', 'error', 'warning',
        'checkpoint', 'user_action', 'stage_change', 'dependency_resolved'
      ]

      eventTypes.forEach(type => {
        const color = getEventColor(type)
        expect(typeof color).toBe('string')
        expect(color.length).toBeGreaterThan(0)
      })
    })

    it('should use custom colors when provided', () => {
      const customColors: Partial<TimelineEventColorConfig> = {
        start: '#custom-start',
        complete: '#custom-complete',
      }

      expect(getEventColor('start', customColors)).toBe('#custom-start')
      expect(getEventColor('complete', customColors)).toBe('#custom-complete')
    })
  })

  describe('determineTimeScale', () => {
    it('should return seconds for durations under 1 minute', () => {
      expect(determineTimeScale(30000)).toBe('seconds')
      expect(determineTimeScale(59999)).toBe('seconds')
    })

    it('should return minutes for durations under 1 hour', () => {
      expect(determineTimeScale(60000)).toBe('minutes')
      expect(determineTimeScale(3599999)).toBe('minutes')
    })

    it('should return hours for durations 1 hour or more', () => {
      expect(determineTimeScale(3600000)).toBe('hours')
      expect(determineTimeScale(7200000)).toBe('hours')
    })
  })

  describe('sortSegmentsByTime', () => {
    const segments: TimelineSegment[] = [
      createMockTimelineSegment({ id: '1', startTime: new Date('2024-01-01T12:00:00Z') }),
      createMockTimelineSegment({ id: '2', startTime: new Date('2024-01-01T10:00:00Z') }),
      createMockTimelineSegment({ id: '3', startTime: new Date('2024-01-01T11:00:00Z') }),
    ]

    it('should sort ascending by default', () => {
      const sorted = sortSegmentsByTime(segments)
      expect(sorted[0].id).toBe('2')
      expect(sorted[1].id).toBe('3')
      expect(sorted[2].id).toBe('1')
    })

    it('should sort descending when specified', () => {
      const sorted = sortSegmentsByTime(segments, 'desc')
      expect(sorted[0].id).toBe('1')
      expect(sorted[1].id).toBe('3')
      expect(sorted[2].id).toBe('2')
    })

    it('should not mutate the original array', () => {
      const original = [...segments]
      sortSegmentsByTime(segments)
      expect(segments).toEqual(original)
    })
  })

  describe('sortEventsByTime', () => {
    const events: TimelineEvent[] = [
      createMockTimelineEvent({ id: '1', timestamp: new Date('2024-01-01T12:00:00Z') }),
      createMockTimelineEvent({ id: '2', timestamp: new Date('2024-01-01T10:00:00Z') }),
      createMockTimelineEvent({ id: '3', timestamp: new Date('2024-01-01T11:00:00Z') }),
    ]

    it('should sort ascending by default', () => {
      const sorted = sortEventsByTime(events)
      expect(sorted[0].id).toBe('2')
      expect(sorted[1].id).toBe('3')
      expect(sorted[2].id).toBe('1')
    })

    it('should sort descending when specified', () => {
      const sorted = sortEventsByTime(events, 'desc')
      expect(sorted[0].id).toBe('1')
      expect(sorted[1].id).toBe('3')
      expect(sorted[2].id).toBe('2')
    })

    it('should not mutate the original array', () => {
      const original = [...events]
      sortEventsByTime(events)
      expect(events).toEqual(original)
    })
  })

  describe('filterSegmentsByTimeRange', () => {
    const segments: TimelineSegment[] = [
      createMockTimelineSegment({
        id: '1',
        startTime: new Date('2024-01-01T09:00:00Z'),
        endTime: new Date('2024-01-01T10:00:00Z'),
      }),
      createMockTimelineSegment({
        id: '2',
        startTime: new Date('2024-01-01T10:30:00Z'),
        endTime: new Date('2024-01-01T11:30:00Z'),
      }),
      createMockTimelineSegment({
        id: '3',
        startTime: new Date('2024-01-01T12:00:00Z'),
        endTime: new Date('2024-01-01T13:00:00Z'),
      }),
    ]

    it('should filter segments within the time range', () => {
      const start = new Date('2024-01-01T10:00:00Z')
      const end = new Date('2024-01-01T12:00:00Z')

      const filtered = filterSegmentsByTimeRange(segments, start, end)

      // Segment 1 ends at 10:00, segment 2 is within range, segment 3 starts at 12:00
      expect(filtered.length).toBe(3)
    })

    it('should exclude segments completely outside the range', () => {
      const start = new Date('2024-01-01T14:00:00Z')
      const end = new Date('2024-01-01T15:00:00Z')

      const filtered = filterSegmentsByTimeRange(segments, start, end)

      expect(filtered.length).toBe(0)
    })

    it('should include segments that overlap with the range', () => {
      const start = new Date('2024-01-01T09:30:00Z')
      const end = new Date('2024-01-01T09:45:00Z')

      const filtered = filterSegmentsByTimeRange(segments, start, end)

      expect(filtered.length).toBe(1)
      expect(filtered[0].id).toBe('1')
    })
  })

  describe('filterEventsByTimeRange', () => {
    const events: TimelineEvent[] = [
      createMockTimelineEvent({ id: '1', timestamp: new Date('2024-01-01T09:00:00Z') }),
      createMockTimelineEvent({ id: '2', timestamp: new Date('2024-01-01T10:30:00Z') }),
      createMockTimelineEvent({ id: '3', timestamp: new Date('2024-01-01T12:00:00Z') }),
    ]

    it('should filter events within the time range', () => {
      const start = new Date('2024-01-01T10:00:00Z')
      const end = new Date('2024-01-01T11:00:00Z')

      const filtered = filterEventsByTimeRange(events, start, end)

      expect(filtered.length).toBe(1)
      expect(filtered[0].id).toBe('2')
    })

    it('should include events exactly at range boundaries', () => {
      const start = new Date('2024-01-01T09:00:00Z')
      const end = new Date('2024-01-01T12:00:00Z')

      const filtered = filterEventsByTimeRange(events, start, end)

      expect(filtered.length).toBe(3)
    })

    it('should return empty array for range with no events', () => {
      const start = new Date('2024-01-01T14:00:00Z')
      const end = new Date('2024-01-01T15:00:00Z')

      const filtered = filterEventsByTimeRange(events, start, end)

      expect(filtered.length).toBe(0)
    })
  })
})

// ============================================================================
// Helper Types Tests
// ============================================================================

describe('Helper Types', () => {
  describe('ProcessedTimelineSegment', () => {
    it('should extend TimelineSegment with additional fields', () => {
      const processed: ProcessedTimelineSegment = {
        ...createMockTimelineSegment(),
        width: 100,
        offset: 50,
        calculatedDurationMs: 30000,
        durationDisplay: '30s',
        displayColor: '#ff5733',
        truncatedLabel: 'Test Seg...',
      }

      expect(typeof processed.width).toBe('number')
      expect(typeof processed.offset).toBe('number')
      expect(typeof processed.calculatedDurationMs).toBe('number')
      expect(typeof processed.durationDisplay).toBe('string')
      expect(typeof processed.displayColor).toBe('string')
      expect(typeof processed.truncatedLabel).toBe('string')

      // Should still have all original TimelineSegment fields
      expect(processed.id).toBeDefined()
      expect(processed.type).toBeDefined()
      expect(processed.startTime).toBeDefined()
    })
  })

  describe('ProcessedTimelineEvent', () => {
    it('should extend TimelineEvent with additional fields', () => {
      const processed: ProcessedTimelineEvent = {
        ...createMockTimelineEvent(),
        position: 100,
        displayColor: '#00ff00',
        icon: '▶',
        timestampDisplay: '10:00:00',
      }

      expect(typeof processed.position).toBe('number')
      expect(typeof processed.displayColor).toBe('string')
      expect(typeof processed.icon).toBe('string')
      expect(typeof processed.timestampDisplay).toBe('string')

      // Should still have all original TimelineEvent fields
      expect(processed.id).toBeDefined()
      expect(processed.type).toBeDefined()
      expect(processed.timestamp).toBeDefined()
    })
  })

  describe('TimelineSegmentTooltipData', () => {
    it('should have correct structure', () => {
      const tooltipData: TimelineSegmentTooltipData = {
        segment: createMockTimelineSegment(),
        position: { x: 100, y: 200 },
        visible: true,
      }

      expect(tooltipData.segment).toBeDefined()
      expect(tooltipData.position.x).toBe(100)
      expect(tooltipData.position.y).toBe(200)
      expect(tooltipData.visible).toBe(true)
    })
  })

  describe('TimelineEventTooltipData', () => {
    it('should have correct structure', () => {
      const tooltipData: TimelineEventTooltipData = {
        event: createMockTimelineEvent(),
        position: { x: 100, y: 200 },
        visible: true,
      }

      expect(tooltipData.event).toBeDefined()
      expect(tooltipData.position.x).toBe(100)
      expect(tooltipData.position.y).toBe(200)
      expect(tooltipData.visible).toBe(true)
    })
  })

  describe('ExecutionTimelineSummary', () => {
    it('should have correct structure', () => {
      const summary: ExecutionTimelineSummary = {
        segmentCount: 5,
        eventCount: 10,
        segmentTypeCounts: {
          planning: 1,
          executing: 2,
          waiting: 1,
          reviewing: 0,
          paused: 1,
          idle: 0,
          error: 0,
        },
        eventTypeCounts: {
          start: 1,
          complete: 2,
          error: 0,
          warning: 1,
          checkpoint: 3,
          user_action: 1,
          stage_change: 2,
          dependency_resolved: 0,
        },
        totalDurationMs: 60000,
        activeTimeMs: 50000,
        idleTimeMs: 10000,
        efficiencyRatio: 0.833,
        errorCount: 0,
        averageSegmentDurationMs: 12000,
      }

      expect(typeof summary.segmentCount).toBe('number')
      expect(typeof summary.eventCount).toBe('number')
      expect(typeof summary.segmentTypeCounts).toBe('object')
      expect(typeof summary.eventTypeCounts).toBe('object')
      expect(typeof summary.totalDurationMs).toBe('number')
      expect(typeof summary.activeTimeMs).toBe('number')
      expect(typeof summary.idleTimeMs).toBe('number')
      expect(typeof summary.efficiencyRatio).toBe('number')
      expect(typeof summary.errorCount).toBe('number')
      expect(typeof summary.averageSegmentDurationMs).toBe('number')
    })
  })
})

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Edge Cases', () => {
  describe('Zero and Negative Values', () => {
    it('should handle zero progress', () => {
      const segment = createMockTimelineSegment({ progress: 0 })
      expect(segment.progress).toBe(0)
    })

    it('should handle 100% progress', () => {
      const segment = createMockTimelineSegment({ progress: 100 })
      expect(segment.progress).toBe(100)
    })

    it('should handle zero duration', () => {
      const timeline = createMockExecutionTimeline([], [], { durationMs: 0 })
      expect(timeline.durationMs).toBe(0)
    })

    it('should handle fractional values', () => {
      const segment = createMockTimelineSegment({
        progress: 33.333,
      })

      expect(segment.progress).toBeCloseTo(33.333)
    })
  })

  describe('Empty Collections', () => {
    it('should handle empty segments array', () => {
      const timeline = createMockExecutionTimeline([])
      expect(timeline.segments).toEqual([])
      expect(timeline.agentCount).toBe(0)
    })

    it('should handle empty events array', () => {
      const timeline = createMockExecutionTimeline([], [])
      expect(timeline.events).toEqual([])
    })

    it('should handle single segment', () => {
      const segments = [createMockTimelineSegment()]
      const timeline = createMockExecutionTimeline(segments)

      expect(timeline.segments).toHaveLength(1)
    })

    it('should handle single event', () => {
      const events = [createMockTimelineEvent()]
      const timeline = createMockExecutionTimeline([], events)

      expect(timeline.events).toHaveLength(1)
    })
  })

  describe('String Handling', () => {
    it('should handle very long labels', () => {
      const longLabel = 'a'.repeat(1000)
      const segment = createMockTimelineSegment({ label: longLabel })

      expect(segment.label).toBe(longLabel)
      expect(segment.label.length).toBe(1000)
    })

    it('should handle empty labels', () => {
      const segment = createMockTimelineSegment({ label: '' })
      expect(segment.label).toBe('')
    })

    it('should handle special characters', () => {
      const specialLabel = 'Segment-123_v2.0 (Test) 🚀'
      const segment = createMockTimelineSegment({ label: specialLabel })

      expect(segment.label).toBe(specialLabel)
    })

    it('should handle unicode in descriptions', () => {
      const unicodeDesc = '你好世界 🌍 مرحبا بالعالم'
      const result = truncateSegmentLabel(unicodeDesc, 50)
      expect(typeof result).toBe('string')
    })
  })

  describe('Date Handling', () => {
    it('should handle various date formats', () => {
      const past = new Date('2023-01-01T00:00:00Z')
      const future = new Date('2025-12-31T23:59:59Z')

      const segment = createMockTimelineSegment({
        startTime: past,
        endTime: future,
      })

      expect(segment.startTime).toEqual(past)
      expect(segment.endTime).toEqual(future)
    })

    it('should handle invalid date scenarios gracefully', () => {
      const invalidDate = new Date('invalid')

      expect(isNaN(invalidDate.getTime())).toBe(true)
      expect(formatTimelineTimestamp(invalidDate)).toBe('N/A')
    })

    it('should handle ongoing segments without endTime', () => {
      const segment = createMockTimelineSegment({
        endTime: undefined,
        isActive: true,
      })

      expect(segment.endTime).toBeUndefined()
      expect(segment.isActive).toBe(true)
    })
  })

  describe('Metadata Handling', () => {
    it('should handle nested metadata objects', () => {
      const segment = createMockTimelineSegment({
        metadata: {
          level1: {
            level2: {
              level3: 'deep value',
            },
          },
          array: [1, 2, 3],
          mixed: { key: [{ nested: true }] },
        },
      })

      expect(segment.metadata).toBeDefined()
      expect((segment.metadata as Record<string, unknown>).level1).toBeDefined()
    })

    it('should handle null and undefined in metadata', () => {
      const segment = createMockTimelineSegment({
        metadata: {
          nullValue: null,
          undefinedValue: undefined,
        },
      })

      expect((segment.metadata as Record<string, unknown>).nullValue).toBeNull()
      expect((segment.metadata as Record<string, unknown>).undefinedValue).toBeUndefined()
    })
  })
})

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance Considerations', () => {
  it('should handle large segment collections efficiently', () => {
    const segments: TimelineSegment[] = []
    for (let i = 0; i < 1000; i++) {
      segments.push(createMockTimelineSegment({
        id: `segment-${i}`,
        type: i % 5 === 0 ? 'planning' : i % 3 === 0 ? 'waiting' : 'executing',
        startTime: new Date(Date.now() - (1000 - i) * 60000),
        endTime: new Date(Date.now() - (1000 - i - 1) * 60000),
      }))
    }

    const timeline = createMockExecutionTimeline(segments)

    const startTime = performance.now()
    const summary = calculateTimelineSummary(timeline)
    const endTime = performance.now()

    expect(summary.segmentCount).toBe(1000)
    expect(endTime - startTime).toBeLessThan(100)
  })

  it('should sort large collections efficiently', () => {
    const segments: TimelineSegment[] = Array.from({ length: 1000 }, (_, i) =>
      createMockTimelineSegment({
        id: `segment-${i}`,
        startTime: new Date(Date.now() - Math.floor(Math.random() * 1000000)),
      })
    )

    const startTime = performance.now()
    const sorted = sortSegmentsByTime(segments)
    const endTime = performance.now()

    expect(sorted).toHaveLength(1000)
    expect(endTime - startTime).toBeLessThan(100)

    // Verify sorted order
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].startTime.getTime()).toBeLessThanOrEqual(sorted[i].startTime.getTime())
    }
  })

  it('should format durations consistently', () => {
    const durations = Array.from({ length: 1000 }, () =>
      Math.floor(Math.random() * 7200000)
    )

    const startTime = performance.now()
    durations.forEach(duration => formatTimelineDuration(duration))
    const endTime = performance.now()

    expect(endTime - startTime).toBeLessThan(50)
  })

  it('should truncate labels efficiently', () => {
    const labels = Array.from({ length: 1000 }, () =>
      'a'.repeat(Math.floor(Math.random() * 100))
    )

    const startTime = performance.now()
    labels.forEach(label => truncateSegmentLabel(label))
    const endTime = performance.now()

    expect(endTime - startTime).toBeLessThan(50)
  })
})

// ============================================================================
// Immutability Tests
// ============================================================================

describe('Immutability', () => {
  it('should not modify original objects when creating copies', () => {
    const original = createMockTimelineSegment()
    const cloned = { ...original }
    const modified = { ...original, type: 'error' as const }

    expect(original.type).toBe('executing')
    expect(cloned.type).toBe('executing')
    expect(modified.type).toBe('error')
  })

  it('sortSegmentsByTime should not mutate the original array', () => {
    const segments = [
      createMockTimelineSegment({ id: '1', startTime: new Date('2024-01-01T12:00:00Z') }),
      createMockTimelineSegment({ id: '2', startTime: new Date('2024-01-01T10:00:00Z') }),
      createMockTimelineSegment({ id: '3', startTime: new Date('2024-01-01T11:00:00Z') }),
    ]
    const originalOrder = segments.map(s => s.id)

    sortSegmentsByTime(segments)

    expect(segments.map(s => s.id)).toEqual(originalOrder)
  })

  it('sortEventsByTime should not mutate the original array', () => {
    const events = [
      createMockTimelineEvent({ id: '1', timestamp: new Date('2024-01-01T12:00:00Z') }),
      createMockTimelineEvent({ id: '2', timestamp: new Date('2024-01-01T10:00:00Z') }),
    ]
    const originalOrder = events.map(e => e.id)

    sortEventsByTime(events)

    expect(events.map(e => e.id)).toEqual(originalOrder)
  })

  it('should return new object from calculateTimelineSummary', () => {
    const timeline = createMockExecutionTimeline([
      createMockTimelineSegment(),
    ])

    const summary1 = calculateTimelineSummary(timeline)
    const summary2 = calculateTimelineSummary(timeline)

    expect(summary1).not.toBe(summary2)
    expect(summary1).toEqual(summary2)
  })

  it('filterSegmentsByTimeRange should not mutate the original array', () => {
    const segments = [
      createMockTimelineSegment({ id: '1' }),
      createMockTimelineSegment({ id: '2' }),
    ]
    const originalLength = segments.length

    filterSegmentsByTimeRange(segments, new Date('2024-01-01'), new Date('2024-12-31'))

    expect(segments.length).toBe(originalLength)
  })

  it('filterEventsByTimeRange should not mutate the original array', () => {
    const events = [
      createMockTimelineEvent({ id: '1' }),
      createMockTimelineEvent({ id: '2' }),
    ]
    const originalLength = events.length

    filterEventsByTimeRange(events, new Date('2024-01-01'), new Date('2024-12-31'))

    expect(events.length).toBe(originalLength)
  })
})
