/**
 * Comprehensive tests for Parallel Agent View types and utility functions
 * Tests type safety, default values, utility functions, and edge cases
 */

import { describe, it, expect } from 'vitest'
import type {
  AgentExecutionStatus,
  ParallelAgentViewLayout,
  AgentSortCriteria,
  AgentSortDirection,
  ParallelAgentViewSize,
  AgentExecution,
  AgentLane,
  ParallelAgentViewData,
  ParallelAgentViewColorConfig,
  ParallelAgentViewConfig,
  ParallelAgentViewProps,
  ProcessedAgentExecution,
  AgentExecutionTooltipData,
  ParallelExecutionSummary,
  ParallelAgentViewSizeConfig,
} from '../parallel-agent-view'
import {
  DEFAULT_PARALLEL_AGENT_VIEW_COLORS,
  DEFAULT_PARALLEL_AGENT_VIEW_CONFIG,
  DEFAULT_PARALLEL_AGENT_VIEW_PROPS,
  PARALLEL_AGENT_VIEW_SIZES,
  EMPTY_PARALLEL_AGENT_VIEW_DATA,
  AGENT_EXECUTION_STATUS_ICONS,
  AGENT_EXECUTION_STATUS_LABELS,
  AGENT_EXECUTION_STATUS_STYLES,
  calculateParallelExecutionSummary,
  formatElapsedTime,
  truncateAgentDescription,
  getStatusColor,
  sortAgentExecutions,
} from '../parallel-agent-view'

// ============================================================================
// Mock Data Factories
// ============================================================================

const createMockAgentExecution = (overrides: Partial<AgentExecution> = {}): AgentExecution => ({
  id: 'exec-1',
  agentId: 'agent-1',
  agentName: 'Test Agent',
  status: 'running',
  progress: 50,
  laneId: 'lane-1',
  ...overrides,
})

const createMockAgentLane = (overrides: Partial<AgentLane> = {}): AgentLane => ({
  id: 'lane-1',
  label: 'Test Lane',
  executions: [],
  ...overrides,
})

const createMockParallelAgentViewData = (
  lanes: AgentLane[] = [],
  overrides: Partial<ParallelAgentViewData> = {}
): ParallelAgentViewData => {
  const allExecutions = lanes.flatMap(lane => lane.executions)
  const runningExecs = allExecutions.filter(e => e.status === 'running')
  const completedExecs = allExecutions.filter(e => e.status === 'completed')
  const failedExecs = allExecutions.filter(e => e.status === 'failed')

  return {
    lanes,
    totalExecutions: allExecutions.length,
    runningCount: runningExecs.length,
    completedCount: completedExecs.length,
    failedCount: failedExecs.length,
    overallProgress: allExecutions.length > 0
      ? allExecutions.reduce((sum, e) => sum + e.progress, 0) / allExecutions.length
      : 0,
    totalTokensUsed: allExecutions.reduce((sum, e) => sum + (e.tokensUsed ?? 0), 0),
    totalEstimatedCost: allExecutions.reduce((sum, e) => sum + (e.estimatedCost ?? 0), 0),
    lastUpdated: new Date(),
    ...overrides,
  }
}

// ============================================================================
// Interface Structure Tests
// ============================================================================

describe('AgentExecution Interface', () => {
  it('should have all required fields with correct types', () => {
    const execution = createMockAgentExecution()

    expect(typeof execution.id).toBe('string')
    expect(typeof execution.agentId).toBe('string')
    expect(typeof execution.agentName).toBe('string')
    expect(typeof execution.status).toBe('string')
    expect(typeof execution.progress).toBe('number')
    expect(typeof execution.laneId).toBe('string')
  })

  it('should support optional fields', () => {
    const execution = createMockAgentExecution({
      stage: 'implementing',
      startedAt: new Date(),
      completedAt: new Date(),
      durationMs: 5000,
      error: 'Test error',
      tokensUsed: 1000,
      estimatedCost: 0.05,
      taskId: 'task-123',
      taskDescription: 'Test task',
      metadata: { key: 'value' },
    })

    expect(typeof execution.stage).toBe('string')
    expect(execution.startedAt).toBeInstanceOf(Date)
    expect(execution.completedAt).toBeInstanceOf(Date)
    expect(typeof execution.durationMs).toBe('number')
    expect(typeof execution.error).toBe('string')
    expect(typeof execution.tokensUsed).toBe('number')
    expect(typeof execution.estimatedCost).toBe('number')
    expect(typeof execution.taskId).toBe('string')
    expect(typeof execution.taskDescription).toBe('string')
    expect(typeof execution.metadata).toBe('object')
  })

  it('should work without optional fields', () => {
    const execution = createMockAgentExecution()

    expect(execution.stage).toBeUndefined()
    expect(execution.startedAt).toBeUndefined()
    expect(execution.completedAt).toBeUndefined()
    expect(execution.durationMs).toBeUndefined()
    expect(execution.error).toBeUndefined()
    expect(execution.tokensUsed).toBeUndefined()
    expect(execution.estimatedCost).toBeUndefined()
    expect(execution.taskId).toBeUndefined()
    expect(execution.taskDescription).toBeUndefined()
    expect(execution.metadata).toBeUndefined()
  })

  it('should accept all valid status values', () => {
    const statuses: AgentExecutionStatus[] = [
      'idle', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled'
    ]

    statuses.forEach(status => {
      const execution = createMockAgentExecution({ status })
      expect(execution.status).toBe(status)
    })
  })
})

describe('AgentLane Interface', () => {
  it('should have all required fields with correct types', () => {
    const lane = createMockAgentLane()

    expect(typeof lane.id).toBe('string')
    expect(typeof lane.label).toBe('string')
    expect(Array.isArray(lane.executions)).toBe(true)
  })

  it('should support optional fields', () => {
    const lane = createMockAgentLane({
      description: 'Test lane description',
      color: '#ff5733',
      priority: 1,
      collapsed: true,
      maxConcurrent: 3,
      metadata: { key: 'value' },
    })

    expect(typeof lane.description).toBe('string')
    expect(typeof lane.color).toBe('string')
    expect(typeof lane.priority).toBe('number')
    expect(typeof lane.collapsed).toBe('boolean')
    expect(typeof lane.maxConcurrent).toBe('number')
    expect(typeof lane.metadata).toBe('object')
  })

  it('should support executions array', () => {
    const lane = createMockAgentLane({
      executions: [
        createMockAgentExecution({ id: 'exec-1', agentName: 'Agent 1' }),
        createMockAgentExecution({ id: 'exec-2', agentName: 'Agent 2' }),
      ],
    })

    expect(lane.executions).toHaveLength(2)
    expect(lane.executions[0].agentName).toBe('Agent 1')
    expect(lane.executions[1].agentName).toBe('Agent 2')
  })
})

describe('ParallelAgentViewData Interface', () => {
  it('should have all required fields with correct types', () => {
    const data = createMockParallelAgentViewData([])

    expect(Array.isArray(data.lanes)).toBe(true)
    expect(typeof data.totalExecutions).toBe('number')
    expect(typeof data.runningCount).toBe('number')
    expect(typeof data.completedCount).toBe('number')
    expect(typeof data.failedCount).toBe('number')
    expect(typeof data.overallProgress).toBe('number')
    expect(typeof data.totalTokensUsed).toBe('number')
    expect(typeof data.totalEstimatedCost).toBe('number')
    expect(data.lastUpdated).toBeInstanceOf(Date)
  })

  it('should calculate totals correctly from lanes', () => {
    const lanes = [
      createMockAgentLane({
        id: 'lane-1',
        executions: [
          createMockAgentExecution({ id: 'exec-1', status: 'running', progress: 50, tokensUsed: 100 }),
          createMockAgentExecution({ id: 'exec-2', status: 'completed', progress: 100, tokensUsed: 200 }),
        ],
      }),
      createMockAgentLane({
        id: 'lane-2',
        executions: [
          createMockAgentExecution({ id: 'exec-3', status: 'failed', progress: 30, tokensUsed: 50 }),
        ],
      }),
    ]

    const data = createMockParallelAgentViewData(lanes)

    expect(data.totalExecutions).toBe(3)
    expect(data.runningCount).toBe(1)
    expect(data.completedCount).toBe(1)
    expect(data.failedCount).toBe(1)
    expect(data.totalTokensUsed).toBe(350)
  })

  it('should support optional startedAt', () => {
    const data = createMockParallelAgentViewData([], {
      startedAt: new Date('2024-01-01'),
    })

    expect(data.startedAt).toBeInstanceOf(Date)
  })
})

describe('ParallelAgentViewConfig Interface', () => {
  it('should have all fields with correct types', () => {
    const config: ParallelAgentViewConfig = { ...DEFAULT_PARALLEL_AGENT_VIEW_CONFIG }

    expect(typeof config.layout).toBe('string')
    expect(typeof config.size).toBe('string')
    expect(typeof config.sortBy).toBe('string')
    expect(typeof config.sortDirection).toBe('string')
    expect(typeof config.maxLanes).toBe('number')
    expect(typeof config.maxAgentsPerLane).toBe('number')
    expect(typeof config.showProgress).toBe('boolean')
    expect(typeof config.showElapsedTime).toBe('boolean')
    expect(typeof config.showTokenUsage).toBe('boolean')
    expect(typeof config.showCost).toBe('boolean')
    expect(typeof config.showStages).toBe('boolean')
    expect(typeof config.animated).toBe('boolean')
    expect(typeof config.refreshIntervalMs).toBe('number')
  })

  it('should support optional colors configuration', () => {
    const config: ParallelAgentViewConfig = {
      ...DEFAULT_PARALLEL_AGENT_VIEW_CONFIG,
      colors: {
        running: '#00ff00',
        completed: '#0000ff',
      },
    }

    expect(config.colors).toBeDefined()
    expect(config.colors!.running).toBe('#00ff00')
    expect(config.colors!.completed).toBe('#0000ff')
  })
})

describe('ParallelAgentViewProps Interface', () => {
  it('should accept minimal props with just data', () => {
    const minimalProps: ParallelAgentViewProps = {
      data: EMPTY_PARALLEL_AGENT_VIEW_DATA,
    }

    expect(minimalProps.data).toBeDefined()
    expect(minimalProps.config).toBeUndefined()
  })

  it('should accept all optional props', () => {
    const fullProps: ParallelAgentViewProps = {
      data: EMPTY_PARALLEL_AGENT_VIEW_DATA,
      config: { layout: 'grid' },
      onAgentClick: (execution) => console.log(execution),
      onAgentHover: (execution) => console.log(execution),
      onLaneClick: (lane) => console.log(lane),
      onLaneToggle: (laneId, collapsed) => console.log(laneId, collapsed),
      onAgentPause: (executionId) => console.log(executionId),
      onAgentResume: (executionId) => console.log(executionId),
      onAgentCancel: (executionId) => console.log(executionId),
      onAgentRetry: (executionId) => console.log(executionId),
      loading: true,
      error: 'Test error',
      className: 'custom-class',
      emptyMessage: 'Custom empty message',
      testId: 'test-parallel-view',
    }

    expect(fullProps.data).toBeDefined()
    expect(fullProps.config!.layout).toBe('grid')
    expect(typeof fullProps.onAgentClick).toBe('function')
    expect(typeof fullProps.onAgentHover).toBe('function')
    expect(typeof fullProps.onLaneClick).toBe('function')
    expect(typeof fullProps.onLaneToggle).toBe('function')
    expect(typeof fullProps.onAgentPause).toBe('function')
    expect(typeof fullProps.onAgentResume).toBe('function')
    expect(typeof fullProps.onAgentCancel).toBe('function')
    expect(typeof fullProps.onAgentRetry).toBe('function')
    expect(fullProps.loading).toBe(true)
    expect(fullProps.error).toBe('Test error')
    expect(fullProps.className).toBe('custom-class')
    expect(fullProps.emptyMessage).toBe('Custom empty message')
    expect(fullProps.testId).toBe('test-parallel-view')
  })
})

// ============================================================================
// Type Union Tests
// ============================================================================

describe('Type Unions', () => {
  describe('AgentExecutionStatus', () => {
    it('should accept all valid status values', () => {
      const statuses: AgentExecutionStatus[] = [
        'idle', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled'
      ]
      statuses.forEach(status => {
        expect(typeof status).toBe('string')
      })
    })
  })

  describe('ParallelAgentViewLayout', () => {
    it('should accept all valid layout values', () => {
      const layouts: ParallelAgentViewLayout[] = ['lanes', 'grid', 'timeline', 'compact']
      layouts.forEach(layout => {
        expect(typeof layout).toBe('string')
      })
    })
  })

  describe('AgentSortCriteria', () => {
    it('should accept all valid sort criteria values', () => {
      const criteria: AgentSortCriteria[] = ['name', 'status', 'progress', 'startTime', 'duration']
      criteria.forEach(c => {
        expect(typeof c).toBe('string')
      })
    })
  })

  describe('AgentSortDirection', () => {
    it('should accept all valid sort direction values', () => {
      const directions: AgentSortDirection[] = ['asc', 'desc']
      directions.forEach(direction => {
        expect(typeof direction).toBe('string')
      })
    })
  })

  describe('ParallelAgentViewSize', () => {
    it('should accept all valid size values', () => {
      const sizes: ParallelAgentViewSize[] = ['sm', 'md', 'lg']
      sizes.forEach(size => {
        expect(typeof size).toBe('string')
      })
    })
  })
})

// ============================================================================
// Default Values and Constants Tests
// ============================================================================

describe('Default Values and Constants', () => {
  describe('DEFAULT_PARALLEL_AGENT_VIEW_COLORS', () => {
    it('should have all status colors defined', () => {
      expect(DEFAULT_PARALLEL_AGENT_VIEW_COLORS).toHaveProperty('idle')
      expect(DEFAULT_PARALLEL_AGENT_VIEW_COLORS).toHaveProperty('queued')
      expect(DEFAULT_PARALLEL_AGENT_VIEW_COLORS).toHaveProperty('running')
      expect(DEFAULT_PARALLEL_AGENT_VIEW_COLORS).toHaveProperty('paused')
      expect(DEFAULT_PARALLEL_AGENT_VIEW_COLORS).toHaveProperty('completed')
      expect(DEFAULT_PARALLEL_AGENT_VIEW_COLORS).toHaveProperty('failed')
      expect(DEFAULT_PARALLEL_AGENT_VIEW_COLORS).toHaveProperty('cancelled')
      expect(DEFAULT_PARALLEL_AGENT_VIEW_COLORS).toHaveProperty('laneColors')
    })

    it('should have valid CSS color values', () => {
      expect(typeof DEFAULT_PARALLEL_AGENT_VIEW_COLORS.idle).toBe('string')
      expect(typeof DEFAULT_PARALLEL_AGENT_VIEW_COLORS.running).toBe('string')
      expect(typeof DEFAULT_PARALLEL_AGENT_VIEW_COLORS.completed).toBe('string')
      expect(typeof DEFAULT_PARALLEL_AGENT_VIEW_COLORS.failed).toBe('string')
    })

    it('should have multiple lane colors available', () => {
      expect(Array.isArray(DEFAULT_PARALLEL_AGENT_VIEW_COLORS.laneColors)).toBe(true)
      expect(DEFAULT_PARALLEL_AGENT_VIEW_COLORS.laneColors.length).toBeGreaterThan(3)

      DEFAULT_PARALLEL_AGENT_VIEW_COLORS.laneColors.forEach(color => {
        expect(typeof color).toBe('string')
        expect(color.length).toBeGreaterThan(0)
      })
    })
  })

  describe('DEFAULT_PARALLEL_AGENT_VIEW_CONFIG', () => {
    it('should have sensible default values', () => {
      expect(DEFAULT_PARALLEL_AGENT_VIEW_CONFIG.layout).toBe('lanes')
      expect(DEFAULT_PARALLEL_AGENT_VIEW_CONFIG.size).toBe('md')
      expect(DEFAULT_PARALLEL_AGENT_VIEW_CONFIG.sortBy).toBe('startTime')
      expect(DEFAULT_PARALLEL_AGENT_VIEW_CONFIG.sortDirection).toBe('asc')
      expect(DEFAULT_PARALLEL_AGENT_VIEW_CONFIG.maxLanes).toBe(6)
      expect(DEFAULT_PARALLEL_AGENT_VIEW_CONFIG.maxAgentsPerLane).toBe(10)
      expect(DEFAULT_PARALLEL_AGENT_VIEW_CONFIG.showProgress).toBe(true)
      expect(DEFAULT_PARALLEL_AGENT_VIEW_CONFIG.showElapsedTime).toBe(true)
      expect(DEFAULT_PARALLEL_AGENT_VIEW_CONFIG.showTokenUsage).toBe(false)
      expect(DEFAULT_PARALLEL_AGENT_VIEW_CONFIG.showCost).toBe(false)
      expect(DEFAULT_PARALLEL_AGENT_VIEW_CONFIG.showStages).toBe(true)
      expect(DEFAULT_PARALLEL_AGENT_VIEW_CONFIG.animated).toBe(true)
      expect(DEFAULT_PARALLEL_AGENT_VIEW_CONFIG.refreshIntervalMs).toBe(1000)
    })

    it('should have all required keys', () => {
      const expectedKeys = [
        'layout', 'size', 'sortBy', 'sortDirection', 'maxLanes', 'maxAgentsPerLane',
        'showProgress', 'showElapsedTime', 'showTokenUsage', 'showCost', 'showStages',
        'animated', 'refreshIntervalMs'
      ]

      expectedKeys.forEach(key => {
        expect(DEFAULT_PARALLEL_AGENT_VIEW_CONFIG).toHaveProperty(key)
      })
    })
  })

  describe('DEFAULT_PARALLEL_AGENT_VIEW_PROPS', () => {
    it('should have sensible default values', () => {
      expect(DEFAULT_PARALLEL_AGENT_VIEW_PROPS.loading).toBe(false)
      expect(DEFAULT_PARALLEL_AGENT_VIEW_PROPS.emptyMessage).toBe('No parallel agents currently active')
    })
  })

  describe('PARALLEL_AGENT_VIEW_SIZES', () => {
    it('should have all size variants', () => {
      expect(PARALLEL_AGENT_VIEW_SIZES).toHaveProperty('sm')
      expect(PARALLEL_AGENT_VIEW_SIZES).toHaveProperty('md')
      expect(PARALLEL_AGENT_VIEW_SIZES).toHaveProperty('lg')
    })

    it('should have increasing dimensions from sm to lg', () => {
      const { sm, md, lg } = PARALLEL_AGENT_VIEW_SIZES

      expect(sm.cardWidth).toBeLessThan(md.cardWidth)
      expect(md.cardWidth).toBeLessThan(lg.cardWidth)

      expect(sm.cardHeight).toBeLessThan(md.cardHeight)
      expect(md.cardHeight).toBeLessThan(lg.cardHeight)

      expect(sm.laneHeaderHeight).toBeLessThan(md.laneHeaderHeight)
      expect(md.laneHeaderHeight).toBeLessThan(lg.laneHeaderHeight)

      expect(sm.fontSize).toBeLessThan(md.fontSize)
      expect(md.fontSize).toBeLessThan(lg.fontSize)
    })

    it('should have all required size properties', () => {
      Object.values(PARALLEL_AGENT_VIEW_SIZES).forEach(size => {
        expect(size).toHaveProperty('cardWidth')
        expect(size).toHaveProperty('cardHeight')
        expect(size).toHaveProperty('laneHeaderHeight')
        expect(size).toHaveProperty('cardSpacing')
        expect(size).toHaveProperty('laneSpacing')
        expect(size).toHaveProperty('fontSize')
        expect(size).toHaveProperty('progressBarHeight')

        expect(typeof size.cardWidth).toBe('number')
        expect(typeof size.cardHeight).toBe('number')
        expect(typeof size.laneHeaderHeight).toBe('number')
        expect(typeof size.cardSpacing).toBe('number')
        expect(typeof size.laneSpacing).toBe('number')
        expect(typeof size.fontSize).toBe('number')
        expect(typeof size.progressBarHeight).toBe('number')
      })
    })
  })

  describe('EMPTY_PARALLEL_AGENT_VIEW_DATA', () => {
    it('should have empty/zero values for all fields', () => {
      expect(EMPTY_PARALLEL_AGENT_VIEW_DATA.lanes).toEqual([])
      expect(EMPTY_PARALLEL_AGENT_VIEW_DATA.totalExecutions).toBe(0)
      expect(EMPTY_PARALLEL_AGENT_VIEW_DATA.runningCount).toBe(0)
      expect(EMPTY_PARALLEL_AGENT_VIEW_DATA.completedCount).toBe(0)
      expect(EMPTY_PARALLEL_AGENT_VIEW_DATA.failedCount).toBe(0)
      expect(EMPTY_PARALLEL_AGENT_VIEW_DATA.overallProgress).toBe(0)
      expect(EMPTY_PARALLEL_AGENT_VIEW_DATA.totalTokensUsed).toBe(0)
      expect(EMPTY_PARALLEL_AGENT_VIEW_DATA.totalEstimatedCost).toBe(0)
      expect(EMPTY_PARALLEL_AGENT_VIEW_DATA.lastUpdated).toBeInstanceOf(Date)
    })

    it('should not have startedAt defined', () => {
      expect(EMPTY_PARALLEL_AGENT_VIEW_DATA.startedAt).toBeUndefined()
    })
  })

  describe('AGENT_EXECUTION_STATUS_ICONS', () => {
    it('should have icons for all status values', () => {
      const statuses: AgentExecutionStatus[] = [
        'idle', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled'
      ]

      statuses.forEach(status => {
        expect(AGENT_EXECUTION_STATUS_ICONS).toHaveProperty(status)
        expect(typeof AGENT_EXECUTION_STATUS_ICONS[status]).toBe('string')
        expect(AGENT_EXECUTION_STATUS_ICONS[status].length).toBeGreaterThan(0)
      })
    })
  })

  describe('AGENT_EXECUTION_STATUS_LABELS', () => {
    it('should have labels for all status values', () => {
      const statuses: AgentExecutionStatus[] = [
        'idle', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled'
      ]

      statuses.forEach(status => {
        expect(AGENT_EXECUTION_STATUS_LABELS).toHaveProperty(status)
        expect(typeof AGENT_EXECUTION_STATUS_LABELS[status]).toBe('string')
        expect(AGENT_EXECUTION_STATUS_LABELS[status].length).toBeGreaterThan(0)
      })
    })

    it('should have expected label values', () => {
      expect(AGENT_EXECUTION_STATUS_LABELS.idle).toBe('Idle')
      expect(AGENT_EXECUTION_STATUS_LABELS.queued).toBe('Queued')
      expect(AGENT_EXECUTION_STATUS_LABELS.running).toBe('Running')
      expect(AGENT_EXECUTION_STATUS_LABELS.paused).toBe('Paused')
      expect(AGENT_EXECUTION_STATUS_LABELS.completed).toBe('Completed')
      expect(AGENT_EXECUTION_STATUS_LABELS.failed).toBe('Failed')
      expect(AGENT_EXECUTION_STATUS_LABELS.cancelled).toBe('Cancelled')
    })
  })

  describe('AGENT_EXECUTION_STATUS_STYLES', () => {
    it('should have style configurations for all status values', () => {
      const statuses: AgentExecutionStatus[] = [
        'idle', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled'
      ]

      statuses.forEach(status => {
        expect(AGENT_EXECUTION_STATUS_STYLES).toHaveProperty(status)

        const styles = AGENT_EXECUTION_STATUS_STYLES[status]
        expect(styles).toHaveProperty('bg')
        expect(styles).toHaveProperty('text')
        expect(styles).toHaveProperty('border')
        expect(styles).toHaveProperty('icon')
        expect(styles).toHaveProperty('dot')
        expect(styles).toHaveProperty('glow')

        Object.values(styles).forEach(styleValue => {
          expect(typeof styleValue).toBe('string')
          expect(styleValue.length).toBeGreaterThan(0)
        })
      })
    })

    it('should follow consistent naming patterns', () => {
      Object.values(AGENT_EXECUTION_STATUS_STYLES).forEach(styles => {
        expect(styles.bg).toMatch(/^bg-/)
        expect(styles.text).toMatch(/^text-/)
        expect(styles.border).toMatch(/^border-/)
        expect(styles.icon).toMatch(/^text-/)
        expect(styles.dot).toMatch(/^bg-/)
        expect(styles.glow).toMatch(/^shadow-/)
      })
    })

    it('should have consistent color schemes for status groups', () => {
      // Completed should use green colors
      expect(AGENT_EXECUTION_STATUS_STYLES.completed.text).toContain('green')
      expect(AGENT_EXECUTION_STATUS_STYLES.completed.icon).toContain('green')

      // Failed should use red colors
      expect(AGENT_EXECUTION_STATUS_STYLES.failed.text).toContain('red')
      expect(AGENT_EXECUTION_STATUS_STYLES.failed.icon).toContain('red')

      // Running should use apex colors
      expect(AGENT_EXECUTION_STATUS_STYLES.running.text).toContain('apex')
      expect(AGENT_EXECUTION_STATUS_STYLES.running.icon).toContain('apex')

      // Paused should use yellow colors
      expect(AGENT_EXECUTION_STATUS_STYLES.paused.text).toContain('yellow')
      expect(AGENT_EXECUTION_STATUS_STYLES.paused.icon).toContain('yellow')
    })
  })
})

// ============================================================================
// Utility Functions Tests
// ============================================================================

describe('Utility Functions', () => {
  describe('calculateParallelExecutionSummary', () => {
    it('should return empty summary for empty data', () => {
      const summary = calculateParallelExecutionSummary(EMPTY_PARALLEL_AGENT_VIEW_DATA)

      expect(summary.laneCount).toBe(0)
      expect(summary.executionCount).toBe(0)
      expect(summary.averageProgress).toBe(0)
      expect(summary.totalDurationMs).toBe(0)
      expect(summary.activeCount).toBe(0)
      expect(summary.successRate).toBe(0)
    })

    it('should correctly count status types', () => {
      const lanes = [
        createMockAgentLane({
          id: 'lane-1',
          executions: [
            createMockAgentExecution({ id: '1', status: 'idle' }),
            createMockAgentExecution({ id: '2', status: 'queued' }),
            createMockAgentExecution({ id: '3', status: 'running', progress: 50 }),
            createMockAgentExecution({ id: '4', status: 'running', progress: 70 }),
            createMockAgentExecution({ id: '5', status: 'paused' }),
            createMockAgentExecution({ id: '6', status: 'completed' }),
            createMockAgentExecution({ id: '7', status: 'completed' }),
            createMockAgentExecution({ id: '8', status: 'failed' }),
            createMockAgentExecution({ id: '9', status: 'cancelled' }),
          ],
        }),
      ]

      const data = createMockParallelAgentViewData(lanes)
      const summary = calculateParallelExecutionSummary(data)

      expect(summary.statusCounts.idle).toBe(1)
      expect(summary.statusCounts.queued).toBe(1)
      expect(summary.statusCounts.running).toBe(2)
      expect(summary.statusCounts.paused).toBe(1)
      expect(summary.statusCounts.completed).toBe(2)
      expect(summary.statusCounts.failed).toBe(1)
      expect(summary.statusCounts.cancelled).toBe(1)
      expect(summary.executionCount).toBe(9)
      expect(summary.laneCount).toBe(1)
    })

    it('should calculate average progress for running agents', () => {
      const lanes = [
        createMockAgentLane({
          id: 'lane-1',
          executions: [
            createMockAgentExecution({ id: '1', status: 'running', progress: 40 }),
            createMockAgentExecution({ id: '2', status: 'running', progress: 60 }),
            createMockAgentExecution({ id: '3', status: 'completed', progress: 100 }),
          ],
        }),
      ]

      const data = createMockParallelAgentViewData(lanes)
      const summary = calculateParallelExecutionSummary(data)

      expect(summary.averageProgress).toBe(50) // (40 + 60) / 2
    })

    it('should calculate success rate correctly', () => {
      const lanes = [
        createMockAgentLane({
          id: 'lane-1',
          executions: [
            createMockAgentExecution({ id: '1', status: 'completed' }),
            createMockAgentExecution({ id: '2', status: 'completed' }),
            createMockAgentExecution({ id: '3', status: 'completed' }),
            createMockAgentExecution({ id: '4', status: 'failed' }),
          ],
        }),
      ]

      const data = createMockParallelAgentViewData(lanes)
      const summary = calculateParallelExecutionSummary(data)

      expect(summary.successRate).toBe(0.75) // 3 / 4
    })

    it('should calculate total duration', () => {
      const lanes = [
        createMockAgentLane({
          id: 'lane-1',
          executions: [
            createMockAgentExecution({ id: '1', status: 'completed', durationMs: 1000 }),
            createMockAgentExecution({ id: '2', status: 'completed', durationMs: 2000 }),
            createMockAgentExecution({ id: '3', status: 'running' }),
          ],
        }),
      ]

      const data = createMockParallelAgentViewData(lanes)
      const summary = calculateParallelExecutionSummary(data)

      expect(summary.totalDurationMs).toBe(3000)
    })

    it('should count active agents (running + queued)', () => {
      const lanes = [
        createMockAgentLane({
          id: 'lane-1',
          executions: [
            createMockAgentExecution({ id: '1', status: 'running' }),
            createMockAgentExecution({ id: '2', status: 'running' }),
            createMockAgentExecution({ id: '3', status: 'queued' }),
            createMockAgentExecution({ id: '4', status: 'completed' }),
          ],
        }),
      ]

      const data = createMockParallelAgentViewData(lanes)
      const summary = calculateParallelExecutionSummary(data)

      expect(summary.activeCount).toBe(3)
    })
  })

  describe('formatElapsedTime', () => {
    it('should return "N/A" for undefined startedAt', () => {
      expect(formatElapsedTime(undefined)).toBe('N/A')
    })

    it('should return "0s" for negative elapsed time', () => {
      const futureDate = new Date(Date.now() + 10000)
      expect(formatElapsedTime(futureDate)).toBe('0s')
    })

    it('should format seconds only for values under 1 minute', () => {
      const startedAt = new Date(Date.now() - 30000) // 30 seconds ago
      expect(formatElapsedTime(startedAt)).toBe('30s')
    })

    it('should format minutes and seconds for values under 1 hour', () => {
      const startedAt = new Date(Date.now() - 90000) // 1 minute 30 seconds ago
      expect(formatElapsedTime(startedAt)).toBe('1m 30s')
    })

    it('should format hours and minutes for larger values', () => {
      const startedAt = new Date(Date.now() - 3660000) // 1 hour 1 minute ago
      expect(formatElapsedTime(startedAt)).toBe('1h 1m')
    })

    it('should use completedAt if provided', () => {
      const startedAt = new Date('2024-01-01T00:00:00Z')
      const completedAt = new Date('2024-01-01T00:01:30Z')
      expect(formatElapsedTime(startedAt, completedAt)).toBe('1m 30s')
    })

    it('should handle exact minute boundaries', () => {
      const startedAt = new Date('2024-01-01T00:00:00Z')
      const completedAt = new Date('2024-01-01T00:02:00Z')
      expect(formatElapsedTime(startedAt, completedAt)).toBe('2m')
    })

    it('should handle exact hour boundaries', () => {
      const startedAt = new Date('2024-01-01T00:00:00Z')
      const completedAt = new Date('2024-01-01T02:00:00Z')
      expect(formatElapsedTime(startedAt, completedAt)).toBe('2h')
    })
  })

  describe('truncateAgentDescription', () => {
    it('should return "No description" for undefined', () => {
      expect(truncateAgentDescription(undefined)).toBe('No description')
    })

    it('should return "No description" for null', () => {
      expect(truncateAgentDescription(null)).toBe('No description')
    })

    it('should return "No description" for empty string', () => {
      // Empty string is falsy, so it returns default
      expect(truncateAgentDescription('')).toBe('No description')
    })

    it('should return original string if within limit', () => {
      expect(truncateAgentDescription('Short description')).toBe('Short description')
    })

    it('should truncate long strings with ellipsis', () => {
      const longDescription = 'This is a very long description that exceeds the default limit'
      const result = truncateAgentDescription(longDescription)
      expect(result.length).toBeLessThanOrEqual(40)
      expect(result.endsWith('...')).toBe(true)
    })

    it('should respect custom maxLength', () => {
      const description = 'Short text'
      expect(truncateAgentDescription(description, 5)).toBe('Sh...')
    })

    it('should handle exact limit length', () => {
      const description = 'a'.repeat(40)
      expect(truncateAgentDescription(description)).toBe(description)
    })
  })

  describe('getStatusColor', () => {
    it('should return default color for each status', () => {
      const statuses: AgentExecutionStatus[] = [
        'idle', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled'
      ]

      statuses.forEach(status => {
        const color = getStatusColor(status)
        expect(typeof color).toBe('string')
        expect(color.length).toBeGreaterThan(0)
      })
    })

    it('should use custom colors when provided', () => {
      const customColors: Partial<ParallelAgentViewColorConfig> = {
        running: '#custom-running',
        completed: '#custom-completed',
      }

      expect(getStatusColor('running', customColors)).toBe('#custom-running')
      expect(getStatusColor('completed', customColors)).toBe('#custom-completed')
    })

    it('should fall back to defaults for unspecified custom colors', () => {
      const customColors: Partial<ParallelAgentViewColorConfig> = {
        running: '#custom-running',
      }

      expect(getStatusColor('completed', customColors)).toBe(DEFAULT_PARALLEL_AGENT_VIEW_COLORS.completed)
    })
  })

  describe('sortAgentExecutions', () => {
    const baseExecutions: AgentExecution[] = [
      createMockAgentExecution({ id: '1', agentName: 'Charlie', status: 'running', progress: 30, startedAt: new Date('2024-01-01T10:00:00Z'), durationMs: 5000 }),
      createMockAgentExecution({ id: '2', agentName: 'Alice', status: 'completed', progress: 100, startedAt: new Date('2024-01-01T09:00:00Z'), durationMs: 10000 }),
      createMockAgentExecution({ id: '3', agentName: 'Bob', status: 'queued', progress: 0, startedAt: new Date('2024-01-01T11:00:00Z'), durationMs: 2000 }),
    ]

    it('should sort by name ascending', () => {
      const sorted = sortAgentExecutions(baseExecutions, 'name', 'asc')
      expect(sorted[0].agentName).toBe('Alice')
      expect(sorted[1].agentName).toBe('Bob')
      expect(sorted[2].agentName).toBe('Charlie')
    })

    it('should sort by name descending', () => {
      const sorted = sortAgentExecutions(baseExecutions, 'name', 'desc')
      expect(sorted[0].agentName).toBe('Charlie')
      expect(sorted[1].agentName).toBe('Bob')
      expect(sorted[2].agentName).toBe('Alice')
    })

    it('should sort by status', () => {
      const sorted = sortAgentExecutions(baseExecutions, 'status', 'asc')
      // Order: running, queued, completed (based on statusOrder array)
      expect(sorted[0].status).toBe('running')
      expect(sorted[1].status).toBe('queued')
      expect(sorted[2].status).toBe('completed')
    })

    it('should sort by progress ascending', () => {
      const sorted = sortAgentExecutions(baseExecutions, 'progress', 'asc')
      expect(sorted[0].progress).toBe(0)
      expect(sorted[1].progress).toBe(30)
      expect(sorted[2].progress).toBe(100)
    })

    it('should sort by progress descending', () => {
      const sorted = sortAgentExecutions(baseExecutions, 'progress', 'desc')
      expect(sorted[0].progress).toBe(100)
      expect(sorted[1].progress).toBe(30)
      expect(sorted[2].progress).toBe(0)
    })

    it('should sort by startTime ascending', () => {
      const sorted = sortAgentExecutions(baseExecutions, 'startTime', 'asc')
      expect(sorted[0].id).toBe('2') // 09:00
      expect(sorted[1].id).toBe('1') // 10:00
      expect(sorted[2].id).toBe('3') // 11:00
    })

    it('should sort by startTime descending', () => {
      const sorted = sortAgentExecutions(baseExecutions, 'startTime', 'desc')
      expect(sorted[0].id).toBe('3') // 11:00
      expect(sorted[1].id).toBe('1') // 10:00
      expect(sorted[2].id).toBe('2') // 09:00
    })

    it('should sort by duration ascending', () => {
      const sorted = sortAgentExecutions(baseExecutions, 'duration', 'asc')
      expect(sorted[0].durationMs).toBe(2000)
      expect(sorted[1].durationMs).toBe(5000)
      expect(sorted[2].durationMs).toBe(10000)
    })

    it('should not mutate the original array', () => {
      const original = [...baseExecutions]
      sortAgentExecutions(baseExecutions, 'name', 'asc')
      expect(baseExecutions).toEqual(original)
    })

    it('should handle executions without startedAt', () => {
      const executions: AgentExecution[] = [
        createMockAgentExecution({ id: '1', startedAt: new Date('2024-01-01') }),
        createMockAgentExecution({ id: '2' }),
        createMockAgentExecution({ id: '3', startedAt: new Date('2024-01-02') }),
      ]

      const sorted = sortAgentExecutions(executions, 'startTime', 'asc')
      expect(sorted[0].id).toBe('1')
      expect(sorted[1].id).toBe('3')
      expect(sorted[2].id).toBe('2') // undefined goes to end in ascending
    })

    it('should handle executions without duration', () => {
      const executions: AgentExecution[] = [
        createMockAgentExecution({ id: '1', durationMs: 5000 }),
        createMockAgentExecution({ id: '2' }),
        createMockAgentExecution({ id: '3', durationMs: 1000 }),
      ]

      const sorted = sortAgentExecutions(executions, 'duration', 'asc')
      expect(sorted[0].id).toBe('2') // undefined = 0
      expect(sorted[1].id).toBe('3')
      expect(sorted[2].id).toBe('1')
    })
  })
})

// ============================================================================
// Helper Types Tests
// ============================================================================

describe('Helper Types', () => {
  describe('ProcessedAgentExecution', () => {
    it('should extend AgentExecution with additional fields', () => {
      const processed: ProcessedAgentExecution = {
        ...createMockAgentExecution(),
        elapsedTimeDisplay: '1m 30s',
        progressDisplay: '50%',
        color: '#00ff00',
        truncatedDescription: 'Test task...',
        statusIcon: '⚡',
      }

      expect(typeof processed.elapsedTimeDisplay).toBe('string')
      expect(typeof processed.progressDisplay).toBe('string')
      expect(typeof processed.color).toBe('string')
      expect(typeof processed.truncatedDescription).toBe('string')
      expect(typeof processed.statusIcon).toBe('string')

      // Should still have all original AgentExecution fields
      expect(processed.id).toBeDefined()
      expect(processed.agentId).toBeDefined()
      expect(processed.agentName).toBeDefined()
    })
  })

  describe('AgentExecutionTooltipData', () => {
    it('should have correct structure', () => {
      const tooltipData: AgentExecutionTooltipData = {
        execution: createMockAgentExecution(),
        position: { x: 100, y: 200 },
        visible: true,
      }

      expect(tooltipData.execution).toBeDefined()
      expect(tooltipData.position.x).toBe(100)
      expect(tooltipData.position.y).toBe(200)
      expect(tooltipData.visible).toBe(true)
    })
  })

  describe('ParallelExecutionSummary', () => {
    it('should have correct structure', () => {
      const summary: ParallelExecutionSummary = {
        laneCount: 3,
        executionCount: 10,
        statusCounts: {
          idle: 1,
          queued: 2,
          running: 3,
          paused: 0,
          completed: 3,
          failed: 1,
          cancelled: 0,
        },
        averageProgress: 65.5,
        totalDurationMs: 50000,
        activeCount: 5,
        successRate: 0.75,
      }

      expect(typeof summary.laneCount).toBe('number')
      expect(typeof summary.executionCount).toBe('number')
      expect(typeof summary.statusCounts).toBe('object')
      expect(typeof summary.averageProgress).toBe('number')
      expect(typeof summary.totalDurationMs).toBe('number')
      expect(typeof summary.activeCount).toBe('number')
      expect(typeof summary.successRate).toBe('number')
    })
  })
})

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Edge Cases', () => {
  describe('Zero and Negative Values', () => {
    it('should handle zero progress', () => {
      const execution = createMockAgentExecution({ progress: 0 })
      expect(execution.progress).toBe(0)
    })

    it('should handle 100% progress', () => {
      const execution = createMockAgentExecution({ progress: 100 })
      expect(execution.progress).toBe(100)
    })

    it('should handle zero token usage', () => {
      const execution = createMockAgentExecution({ tokensUsed: 0 })
      expect(execution.tokensUsed).toBe(0)
    })

    it('should handle very large token counts', () => {
      const execution = createMockAgentExecution({ tokensUsed: Number.MAX_SAFE_INTEGER })
      expect(execution.tokensUsed).toBe(Number.MAX_SAFE_INTEGER)
    })

    it('should handle fractional values', () => {
      const execution = createMockAgentExecution({
        progress: 33.333,
        estimatedCost: 0.00001,
      })

      expect(execution.progress).toBeCloseTo(33.333)
      expect(execution.estimatedCost).toBeCloseTo(0.00001)
    })
  })

  describe('Empty Collections', () => {
    it('should handle empty lanes array', () => {
      const data = createMockParallelAgentViewData([])
      expect(data.lanes).toEqual([])
      expect(data.totalExecutions).toBe(0)
    })

    it('should handle lane with empty executions', () => {
      const lane = createMockAgentLane({ executions: [] })
      expect(lane.executions).toHaveLength(0)
    })

    it('should handle single lane with single execution', () => {
      const lanes = [
        createMockAgentLane({
          executions: [createMockAgentExecution()],
        }),
      ]
      const data = createMockParallelAgentViewData(lanes)

      expect(data.lanes).toHaveLength(1)
      expect(data.totalExecutions).toBe(1)
    })
  })

  describe('String Handling', () => {
    it('should handle very long agent names', () => {
      const longName = 'a'.repeat(1000)
      const execution = createMockAgentExecution({ agentName: longName })

      expect(execution.agentName).toBe(longName)
      expect(execution.agentName.length).toBe(1000)
    })

    it('should handle empty agent names', () => {
      const execution = createMockAgentExecution({ agentName: '' })
      expect(execution.agentName).toBe('')
    })

    it('should handle special characters', () => {
      const specialName = 'Agent-123_v2.0 (Test) 🤖'
      const execution = createMockAgentExecution({ agentName: specialName })

      expect(execution.agentName).toBe(specialName)
    })

    it('should handle unicode in descriptions', () => {
      const unicodeDesc = '你好世界 🌍 مرحبا بالعالم'
      const result = truncateAgentDescription(unicodeDesc)
      expect(typeof result).toBe('string')
    })
  })

  describe('Date Handling', () => {
    it('should handle various date formats', () => {
      const now = new Date()
      const past = new Date('2023-01-01T00:00:00Z')
      const future = new Date('2025-12-31T23:59:59Z')

      const execution = createMockAgentExecution({
        startedAt: past,
        completedAt: future,
      })

      expect(execution.startedAt).toEqual(past)
      expect(execution.completedAt).toEqual(future)
    })

    it('should handle invalid date scenarios gracefully', () => {
      const invalidDate = new Date('invalid')
      const execution = createMockAgentExecution({
        startedAt: invalidDate,
      })

      expect(isNaN(execution.startedAt!.getTime())).toBe(true)
    })
  })

  describe('Metadata Handling', () => {
    it('should handle nested metadata objects', () => {
      const execution = createMockAgentExecution({
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

      expect(execution.metadata).toBeDefined()
      expect((execution.metadata as Record<string, unknown>).level1).toBeDefined()
    })

    it('should handle null and undefined in metadata', () => {
      const execution = createMockAgentExecution({
        metadata: {
          nullValue: null,
          undefinedValue: undefined,
        },
      })

      expect((execution.metadata as Record<string, unknown>).nullValue).toBeNull()
      expect((execution.metadata as Record<string, unknown>).undefinedValue).toBeUndefined()
    })
  })
})

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance Considerations', () => {
  it('should handle large execution collections efficiently', () => {
    const executions: AgentExecution[] = []
    for (let i = 0; i < 1000; i++) {
      executions.push(createMockAgentExecution({
        id: `exec-${i}`,
        agentName: `Agent ${i}`,
        status: i % 5 === 0 ? 'completed' : i % 3 === 0 ? 'failed' : 'running',
        progress: Math.floor(Math.random() * 100),
        durationMs: Math.floor(Math.random() * 10000),
      }))
    }

    const lanes = [createMockAgentLane({ executions })]
    const data = createMockParallelAgentViewData(lanes)

    const startTime = performance.now()
    const summary = calculateParallelExecutionSummary(data)
    const endTime = performance.now()

    expect(summary.executionCount).toBe(1000)
    expect(endTime - startTime).toBeLessThan(100)
  })

  it('should sort large collections efficiently', () => {
    const executions: AgentExecution[] = Array.from({ length: 1000 }, (_, i) =>
      createMockAgentExecution({
        id: `exec-${i}`,
        agentName: `Agent ${i}`,
        progress: Math.floor(Math.random() * 100),
        startedAt: new Date(Date.now() - Math.floor(Math.random() * 1000000)),
      })
    )

    const startTime = performance.now()
    const sorted = sortAgentExecutions(executions, 'progress', 'desc')
    const endTime = performance.now()

    expect(sorted).toHaveLength(1000)
    expect(endTime - startTime).toBeLessThan(100)

    // Verify sorted order
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].progress).toBeGreaterThanOrEqual(sorted[i].progress)
    }
  })

  it('should format elapsed time consistently', () => {
    const testDates = Array.from({ length: 1000 }, (_, i) =>
      new Date(Date.now() - i * 1000)
    )

    const startTime = performance.now()
    testDates.forEach(date => formatElapsedTime(date))
    const endTime = performance.now()

    expect(endTime - startTime).toBeLessThan(50)
  })

  it('should truncate descriptions efficiently', () => {
    const descriptions = Array.from({ length: 1000 }, () =>
      'a'.repeat(Math.floor(Math.random() * 200))
    )

    const startTime = performance.now()
    descriptions.forEach(desc => truncateAgentDescription(desc))
    const endTime = performance.now()

    expect(endTime - startTime).toBeLessThan(50)
  })
})

// ============================================================================
// Immutability Tests
// ============================================================================

describe('Immutability', () => {
  it('should not modify original objects when creating copies', () => {
    const original = createMockAgentExecution()
    const cloned = { ...original }
    const modified = { ...original, status: 'completed' as const }

    expect(original.status).toBe('running')
    expect(cloned.status).toBe('running')
    expect(modified.status).toBe('completed')
  })

  it('sortAgentExecutions should not mutate the original array', () => {
    const executions = [
      createMockAgentExecution({ id: '1', progress: 50 }),
      createMockAgentExecution({ id: '2', progress: 25 }),
      createMockAgentExecution({ id: '3', progress: 75 }),
    ]
    const originalOrder = executions.map(e => e.id)

    sortAgentExecutions(executions, 'progress', 'asc')

    expect(executions.map(e => e.id)).toEqual(originalOrder)
  })

  it('should return new object from calculateParallelExecutionSummary', () => {
    const data = createMockParallelAgentViewData([
      createMockAgentLane({
        executions: [createMockAgentExecution()],
      }),
    ])

    const summary1 = calculateParallelExecutionSummary(data)
    const summary2 = calculateParallelExecutionSummary(data)

    expect(summary1).not.toBe(summary2)
    expect(summary1).toEqual(summary2)
  })
})
