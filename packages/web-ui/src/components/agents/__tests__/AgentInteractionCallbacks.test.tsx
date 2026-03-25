/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ParallelAgentView } from '../ParallelAgentView'
import type {
  ParallelAgentViewData,
  AgentExecution,
  AgentLane as AgentLaneType
} from '@/types/parallel-agent-view'

// Mock child components to isolate callback testing
vi.mock('../AgentLane', () => ({
  AgentLane: vi.fn(({
    lane,
    onAgentClick,
    onAgentPause,
    onAgentResume,
    onAgentCancel,
    onAgentRetry,
    onLaneClick,
    onLaneToggle,
    testId
  }) => (
    <div data-testid={testId || `lane-${lane.id}`}>
      <div data-testid={`lane-header-${lane.id}`}>
        <button
          data-testid={`lane-click-${lane.id}`}
          onClick={() => onLaneClick?.(lane)}
        >
          {lane.label}
        </button>
        <button
          data-testid={`lane-toggle-${lane.id}`}
          onClick={() => onLaneToggle?.(lane.id, !lane.collapsed)}
        >
          {lane.collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      {lane.executions.map((execution) => (
        <div key={execution.id} data-testid={`execution-card-${execution.id}`}>
          <button
            data-testid={`agent-click-${execution.id}`}
            onClick={() => onAgentClick?.(execution)}
          >
            {execution.agentName}
          </button>
          {execution.status === 'running' && (
            <>
              <button
                data-testid={`agent-pause-${execution.id}`}
                onClick={() => onAgentPause?.(execution.id)}
              >
                Pause
              </button>
              <button
                data-testid={`agent-cancel-${execution.id}`}
                onClick={() => onAgentCancel?.(execution.id)}
              >
                Cancel
              </button>
            </>
          )}
          {execution.status === 'paused' && (
            <button
              data-testid={`agent-resume-${execution.id}`}
              onClick={() => onAgentResume?.(execution.id)}
            >
              Resume
            </button>
          )}
          {(execution.status === 'failed' || execution.status === 'cancelled') && (
            <button
              data-testid={`agent-retry-${execution.id}`}
              onClick={() => onAgentRetry?.(execution.id)}
            >
              Retry
            </button>
          )}
        </div>
      ))}
    </div>
  )),
}))

// Mock icons
vi.mock('lucide-react', () => ({
  LayoutGrid: () => <span data-testid="icon-grid">Grid</span>,
  List: () => <span data-testid="icon-list">List</span>,
  Clock: () => <span data-testid="icon-clock">Clock</span>,
  Minimize: () => <span data-testid="icon-minimize">Minimize</span>,
  RotateCcw: () => <span data-testid="icon-refresh">Refresh</span>,
  Settings: () => <span data-testid="icon-settings">Settings</span>,
  Filter: () => <span data-testid="icon-filter">Filter</span>,
  SortAsc: () => <span data-testid="icon-sort-asc">↑</span>,
  SortDesc: () => <span data-testid="icon-sort-desc">↓</span>,
  Loader2: () => <span data-testid="icon-loader">Loading</span>,
}))

// Mock Spinner component
vi.mock('@/components/ui/Spinner', () => ({
  Spinner: ({ className }: { className?: string }) => (
    <div data-testid="spinner" className={className} role="status" aria-label="Loading">
      Loading spinner
    </div>
  ),
}))

// Test data factory functions
const createMockExecution = (overrides: Partial<AgentExecution> = {}): AgentExecution => ({
  id: `exec-${Math.random().toString(36).substr(2, 9)}`,
  agentId: 'agent-1',
  agentName: 'Developer Agent',
  status: 'running',
  stage: 'implementing',
  progress: 65,
  startedAt: new Date('2024-01-01T10:00:00Z'),
  laneId: 'development',
  taskId: 'task-123',
  taskDescription: 'Implement feature',
  tokensUsed: 12500,
  estimatedCost: 0.25,
  ...overrides,
})

const createMockLane = (overrides: Partial<AgentLaneType> = {}): AgentLaneType => ({
  id: 'development',
  label: 'Development',
  description: 'Development tasks',
  executions: [createMockExecution()],
  color: '#3b82f6',
  priority: 1,
  collapsed: false,
  maxConcurrent: 5,
  ...overrides,
})

const createMockParallelAgentData = (
  overrides: Partial<ParallelAgentViewData> = {}
): ParallelAgentViewData => ({
  lanes: [
    createMockLane({ id: 'development', label: 'Development' }),
    createMockLane({
      id: 'testing',
      label: 'Testing',
      executions: [
        createMockExecution({
          id: 'exec-test-1',
          agentName: 'Test Agent',
          status: 'completed',
          laneId: 'testing',
        }),
      ],
    }),
  ],
  totalExecutions: 2,
  runningCount: 1,
  completedCount: 1,
  failedCount: 0,
  overallProgress: 65,
  totalTokensUsed: 12500,
  totalEstimatedCost: 0.25,
  lastUpdated: new Date('2024-01-01T10:30:00Z'),
  ...overrides,
})

describe('Agent Interaction Callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('onAgentClick Callback', () => {
    it('calls onAgentClick with correct execution parameter when agent card is clicked', () => {
      const mockOnAgentClick = vi.fn()
      const testExecution = createMockExecution({
        id: 'test-exec-1',
        agentName: 'Test Agent',
        status: 'running'
      })

      const mockData = createMockParallelAgentData({
        lanes: [createMockLane({ executions: [testExecution] })]
      })

      render(<ParallelAgentView data={mockData} onAgentClick={mockOnAgentClick} />)

      const agentButton = screen.getByTestId('agent-click-test-exec-1')
      fireEvent.click(agentButton)

      expect(mockOnAgentClick).toHaveBeenCalledTimes(1)
      expect(mockOnAgentClick).toHaveBeenCalledWith(testExecution)
    })

    it('calls onAgentClick with correct parameters for multiple agents', () => {
      const mockOnAgentClick = vi.fn()
      const execution1 = createMockExecution({ id: 'exec-1', agentName: 'Agent 1' })
      const execution2 = createMockExecution({ id: 'exec-2', agentName: 'Agent 2' })

      const mockData = createMockParallelAgentData({
        lanes: [createMockLane({ executions: [execution1, execution2] })]
      })

      render(<ParallelAgentView data={mockData} onAgentClick={mockOnAgentClick} />)

      // Click first agent
      fireEvent.click(screen.getByTestId('agent-click-exec-1'))
      expect(mockOnAgentClick).toHaveBeenCalledWith(execution1)

      // Click second agent
      fireEvent.click(screen.getByTestId('agent-click-exec-2'))
      expect(mockOnAgentClick).toHaveBeenCalledWith(execution2)

      expect(mockOnAgentClick).toHaveBeenCalledTimes(2)
    })

    it('does not call onAgentClick when callback is not provided', () => {
      const testExecution = createMockExecution({ id: 'test-exec-1' })
      const mockData = createMockParallelAgentData({
        lanes: [createMockLane({ executions: [testExecution] })]
      })

      render(<ParallelAgentView data={mockData} />)

      const agentButton = screen.getByTestId('agent-click-test-exec-1')

      // Should not throw error when callback is undefined
      expect(() => fireEvent.click(agentButton)).not.toThrow()
    })
  })

  describe('onAgentPause Callback', () => {
    it('calls onAgentPause with correct execution ID when pause button is clicked', () => {
      const mockOnAgentPause = vi.fn()
      const runningExecution = createMockExecution({
        id: 'running-exec',
        status: 'running'
      })

      const mockData = createMockParallelAgentData({
        lanes: [createMockLane({ executions: [runningExecution] })]
      })

      render(<ParallelAgentView data={mockData} onAgentPause={mockOnAgentPause} />)

      const pauseButton = screen.getByTestId('agent-pause-running-exec')
      fireEvent.click(pauseButton)

      expect(mockOnAgentPause).toHaveBeenCalledTimes(1)
      expect(mockOnAgentPause).toHaveBeenCalledWith('running-exec')
    })

    it('calls onAgentPause for multiple running agents with correct IDs', () => {
      const mockOnAgentPause = vi.fn()
      const execution1 = createMockExecution({ id: 'exec-1', status: 'running' })
      const execution2 = createMockExecution({ id: 'exec-2', status: 'running' })

      const mockData = createMockParallelAgentData({
        lanes: [createMockLane({ executions: [execution1, execution2] })]
      })

      render(<ParallelAgentView data={mockData} onAgentPause={mockOnAgentPause} />)

      // Pause first agent
      fireEvent.click(screen.getByTestId('agent-pause-exec-1'))
      expect(mockOnAgentPause).toHaveBeenCalledWith('exec-1')

      // Pause second agent
      fireEvent.click(screen.getByTestId('agent-pause-exec-2'))
      expect(mockOnAgentPause).toHaveBeenCalledWith('exec-2')

      expect(mockOnAgentPause).toHaveBeenCalledTimes(2)
    })

    it('only shows pause button for running executions', () => {
      const runningExecution = createMockExecution({ id: 'running', status: 'running' })
      const completedExecution = createMockExecution({ id: 'completed', status: 'completed' })

      const mockData = createMockParallelAgentData({
        lanes: [createMockLane({ executions: [runningExecution, completedExecution] })]
      })

      render(<ParallelAgentView data={mockData} onAgentPause={vi.fn()} />)

      // Running execution should have pause button
      expect(screen.getByTestId('agent-pause-running')).toBeInTheDocument()

      // Completed execution should not have pause button
      expect(screen.queryByTestId('agent-pause-completed')).not.toBeInTheDocument()
    })
  })

  describe('onAgentResume Callback', () => {
    it('calls onAgentResume with correct execution ID when resume button is clicked', () => {
      const mockOnAgentResume = vi.fn()
      const pausedExecution = createMockExecution({
        id: 'paused-exec',
        status: 'paused'
      })

      const mockData = createMockParallelAgentData({
        lanes: [createMockLane({ executions: [pausedExecution] })]
      })

      render(<ParallelAgentView data={mockData} onAgentResume={mockOnAgentResume} />)

      const resumeButton = screen.getByTestId('agent-resume-paused-exec')
      fireEvent.click(resumeButton)

      expect(mockOnAgentResume).toHaveBeenCalledTimes(1)
      expect(mockOnAgentResume).toHaveBeenCalledWith('paused-exec')
    })

    it('only shows resume button for paused executions', () => {
      const pausedExecution = createMockExecution({ id: 'paused', status: 'paused' })
      const runningExecution = createMockExecution({ id: 'running', status: 'running' })

      const mockData = createMockParallelAgentData({
        lanes: [createMockLane({ executions: [pausedExecution, runningExecution] })]
      })

      render(<ParallelAgentView data={mockData} onAgentResume={vi.fn()} />)

      // Paused execution should have resume button
      expect(screen.getByTestId('agent-resume-paused')).toBeInTheDocument()

      // Running execution should not have resume button
      expect(screen.queryByTestId('agent-resume-running')).not.toBeInTheDocument()
    })
  })

  describe('onAgentCancel Callback', () => {
    it('calls onAgentCancel with correct execution ID when cancel button is clicked', () => {
      const mockOnAgentCancel = vi.fn()
      const runningExecution = createMockExecution({
        id: 'running-exec',
        status: 'running'
      })

      const mockData = createMockParallelAgentData({
        lanes: [createMockLane({ executions: [runningExecution] })]
      })

      render(<ParallelAgentView data={mockData} onAgentCancel={mockOnAgentCancel} />)

      const cancelButton = screen.getByTestId('agent-cancel-running-exec')
      fireEvent.click(cancelButton)

      expect(mockOnAgentCancel).toHaveBeenCalledTimes(1)
      expect(mockOnAgentCancel).toHaveBeenCalledWith('running-exec')
    })

    it('only shows cancel button for running executions', () => {
      const runningExecution = createMockExecution({ id: 'running', status: 'running' })
      const completedExecution = createMockExecution({ id: 'completed', status: 'completed' })

      const mockData = createMockParallelAgentData({
        lanes: [createMockLane({ executions: [runningExecution, completedExecution] })]
      })

      render(<ParallelAgentView data={mockData} onAgentCancel={vi.fn()} />)

      // Running execution should have cancel button
      expect(screen.getByTestId('agent-cancel-running')).toBeInTheDocument()

      // Completed execution should not have cancel button
      expect(screen.queryByTestId('agent-cancel-completed')).not.toBeInTheDocument()
    })
  })

  describe('onAgentRetry Callback', () => {
    it('calls onAgentRetry with correct execution ID for failed execution', () => {
      const mockOnAgentRetry = vi.fn()
      const failedExecution = createMockExecution({
        id: 'failed-exec',
        status: 'failed'
      })

      const mockData = createMockParallelAgentData({
        lanes: [createMockLane({ executions: [failedExecution] })]
      })

      render(<ParallelAgentView data={mockData} onAgentRetry={mockOnAgentRetry} />)

      const retryButton = screen.getByTestId('agent-retry-failed-exec')
      fireEvent.click(retryButton)

      expect(mockOnAgentRetry).toHaveBeenCalledTimes(1)
      expect(mockOnAgentRetry).toHaveBeenCalledWith('failed-exec')
    })

    it('calls onAgentRetry with correct execution ID for cancelled execution', () => {
      const mockOnAgentRetry = vi.fn()
      const cancelledExecution = createMockExecution({
        id: 'cancelled-exec',
        status: 'cancelled'
      })

      const mockData = createMockParallelAgentData({
        lanes: [createMockLane({ executions: [cancelledExecution] })]
      })

      render(<ParallelAgentView data={mockData} onAgentRetry={mockOnAgentRetry} />)

      const retryButton = screen.getByTestId('agent-retry-cancelled-exec')
      fireEvent.click(retryButton)

      expect(mockOnAgentRetry).toHaveBeenCalledTimes(1)
      expect(mockOnAgentRetry).toHaveBeenCalledWith('cancelled-exec')
    })

    it('shows retry button for both failed and cancelled executions', () => {
      const failedExecution = createMockExecution({ id: 'failed', status: 'failed' })
      const cancelledExecution = createMockExecution({ id: 'cancelled', status: 'cancelled' })
      const runningExecution = createMockExecution({ id: 'running', status: 'running' })

      const mockData = createMockParallelAgentData({
        lanes: [createMockLane({
          executions: [failedExecution, cancelledExecution, runningExecution]
        })]
      })

      render(<ParallelAgentView data={mockData} onAgentRetry={vi.fn()} />)

      // Failed and cancelled executions should have retry buttons
      expect(screen.getByTestId('agent-retry-failed')).toBeInTheDocument()
      expect(screen.getByTestId('agent-retry-cancelled')).toBeInTheDocument()

      // Running execution should not have retry button
      expect(screen.queryByTestId('agent-retry-running')).not.toBeInTheDocument()
    })
  })

  describe('onLaneClick Callback', () => {
    it('calls onLaneClick with correct lane parameter when lane header is clicked', () => {
      const mockOnLaneClick = vi.fn()
      const testLane = createMockLane({
        id: 'test-lane',
        label: 'Test Lane',
        description: 'Test description'
      })

      const mockData = createMockParallelAgentData({
        lanes: [testLane]
      })

      render(<ParallelAgentView data={mockData} onLaneClick={mockOnLaneClick} />)

      const laneButton = screen.getByTestId('lane-click-test-lane')
      fireEvent.click(laneButton)

      expect(mockOnLaneClick).toHaveBeenCalledTimes(1)
      expect(mockOnLaneClick).toHaveBeenCalledWith(testLane)
    })

    it('calls onLaneClick with correct parameters for multiple lanes', () => {
      const mockOnLaneClick = vi.fn()
      const lane1 = createMockLane({ id: 'lane-1', label: 'Lane 1' })
      const lane2 = createMockLane({ id: 'lane-2', label: 'Lane 2' })

      const mockData = createMockParallelAgentData({
        lanes: [lane1, lane2]
      })

      render(<ParallelAgentView data={mockData} onLaneClick={mockOnLaneClick} />)

      // Click first lane
      fireEvent.click(screen.getByTestId('lane-click-lane-1'))
      expect(mockOnLaneClick).toHaveBeenCalledWith(lane1)

      // Click second lane
      fireEvent.click(screen.getByTestId('lane-click-lane-2'))
      expect(mockOnLaneClick).toHaveBeenCalledWith(lane2)

      expect(mockOnLaneClick).toHaveBeenCalledTimes(2)
    })
  })

  describe('onLaneToggle Callback', () => {
    it('calls onLaneToggle with correct lane ID and new collapsed state', () => {
      const mockOnLaneToggle = vi.fn()
      const testLane = createMockLane({
        id: 'test-lane',
        collapsed: false  // Initially expanded
      })

      const mockData = createMockParallelAgentData({
        lanes: [testLane]
      })

      render(<ParallelAgentView data={mockData} onLaneToggle={mockOnLaneToggle} />)

      const toggleButton = screen.getByTestId('lane-toggle-test-lane')
      fireEvent.click(toggleButton)

      expect(mockOnLaneToggle).toHaveBeenCalledTimes(1)
      expect(mockOnLaneToggle).toHaveBeenCalledWith('test-lane', true) // Should collapse (true)
    })

    it('calls onLaneToggle with correct parameters for collapsed lane', () => {
      const mockOnLaneToggle = vi.fn()
      const testLane = createMockLane({
        id: 'collapsed-lane',
        collapsed: true  // Initially collapsed
      })

      const mockData = createMockParallelAgentData({
        lanes: [testLane]
      })

      render(<ParallelAgentView data={mockData} onLaneToggle={mockOnLaneToggle} />)

      const toggleButton = screen.getByTestId('lane-toggle-collapsed-lane')
      fireEvent.click(toggleButton)

      expect(mockOnLaneToggle).toHaveBeenCalledTimes(1)
      expect(mockOnLaneToggle).toHaveBeenCalledWith('collapsed-lane', false) // Should expand (false)
    })

    it('calls onLaneToggle for multiple lanes with correct parameters', () => {
      const mockOnLaneToggle = vi.fn()
      const lane1 = createMockLane({ id: 'lane-1', collapsed: false })
      const lane2 = createMockLane({ id: 'lane-2', collapsed: true })

      const mockData = createMockParallelAgentData({
        lanes: [lane1, lane2]
      })

      render(<ParallelAgentView data={mockData} onLaneToggle={mockOnLaneToggle} />)

      // Toggle first lane (collapse)
      fireEvent.click(screen.getByTestId('lane-toggle-lane-1'))
      expect(mockOnLaneToggle).toHaveBeenCalledWith('lane-1', true)

      // Toggle second lane (expand)
      fireEvent.click(screen.getByTestId('lane-toggle-lane-2'))
      expect(mockOnLaneToggle).toHaveBeenCalledWith('lane-2', false)

      expect(mockOnLaneToggle).toHaveBeenCalledTimes(2)
    })
  })

  describe('Multiple Callbacks Integration', () => {
    it('handles all agent callbacks working together', () => {
      const mockCallbacks = {
        onAgentClick: vi.fn(),
        onAgentPause: vi.fn(),
        onAgentCancel: vi.fn(),
        onLaneClick: vi.fn(),
        onLaneToggle: vi.fn(),
      }

      const runningExecution = createMockExecution({
        id: 'multi-exec',
        status: 'running',
        agentName: 'Multi Test Agent'
      })

      const testLane = createMockLane({
        id: 'multi-lane',
        label: 'Multi Test Lane',
        executions: [runningExecution],
        collapsed: false
      })

      const mockData = createMockParallelAgentData({
        lanes: [testLane]
      })

      render(<ParallelAgentView data={mockData} {...mockCallbacks} />)

      // Test agent click
      fireEvent.click(screen.getByTestId('agent-click-multi-exec'))
      expect(mockCallbacks.onAgentClick).toHaveBeenCalledWith(runningExecution)

      // Test agent pause
      fireEvent.click(screen.getByTestId('agent-pause-multi-exec'))
      expect(mockCallbacks.onAgentPause).toHaveBeenCalledWith('multi-exec')

      // Test agent cancel
      fireEvent.click(screen.getByTestId('agent-cancel-multi-exec'))
      expect(mockCallbacks.onAgentCancel).toHaveBeenCalledWith('multi-exec')

      // Test lane click
      fireEvent.click(screen.getByTestId('lane-click-multi-lane'))
      expect(mockCallbacks.onLaneClick).toHaveBeenCalledWith(testLane)

      // Test lane toggle
      fireEvent.click(screen.getByTestId('lane-toggle-multi-lane'))
      expect(mockCallbacks.onLaneToggle).toHaveBeenCalledWith('multi-lane', true)

      // Verify all callbacks were called exactly once
      Object.values(mockCallbacks).forEach(callback => {
        expect(callback).toHaveBeenCalledTimes(1)
      })
    })

    it('handles callbacks gracefully when not provided', () => {
      const runningExecution = createMockExecution({ id: 'test-exec', status: 'running' })
      const testLane = createMockLane({ executions: [runningExecution] })
      const mockData = createMockParallelAgentData({ lanes: [testLane] })

      // Render without any callbacks
      render(<ParallelAgentView data={mockData} />)

      // All interactions should work without errors
      expect(() => {
        fireEvent.click(screen.getByTestId('agent-click-test-exec'))
        fireEvent.click(screen.getByTestId('agent-pause-test-exec'))
        fireEvent.click(screen.getByTestId('agent-cancel-test-exec'))
        fireEvent.click(screen.getByTestId('lane-click-development'))
        fireEvent.click(screen.getByTestId('lane-toggle-development'))
      }).not.toThrow()
    })
  })

  describe('Parameter Validation', () => {
    it('passes execution objects with all required properties to onAgentClick', () => {
      const mockOnAgentClick = vi.fn()
      const completeExecution = createMockExecution({
        id: 'complete-exec',
        agentId: 'agent-123',
        agentName: 'Complete Agent',
        status: 'running',
        stage: 'implementing',
        progress: 75,
        startedAt: new Date('2024-01-01T10:00:00Z'),
        laneId: 'development',
        taskId: 'task-456',
        taskDescription: 'Complete task',
        tokensUsed: 5000,
        estimatedCost: 0.10,
      })

      const mockData = createMockParallelAgentData({
        lanes: [createMockLane({ executions: [completeExecution] })]
      })

      render(<ParallelAgentView data={mockData} onAgentClick={mockOnAgentClick} />)

      fireEvent.click(screen.getByTestId('agent-click-complete-exec'))

      const callArgs = mockOnAgentClick.mock.calls[0][0]

      // Verify all required properties are present
      expect(callArgs).toMatchObject({
        id: 'complete-exec',
        agentId: 'agent-123',
        agentName: 'Complete Agent',
        status: 'running',
        stage: 'implementing',
        progress: 75,
        laneId: 'development',
        taskId: 'task-456',
        taskDescription: 'Complete task',
        tokensUsed: 5000,
        estimatedCost: 0.10,
      })
      expect(callArgs.startedAt).toBeInstanceOf(Date)
    })

    it('passes lane objects with all required properties to onLaneClick', () => {
      const mockOnLaneClick = vi.fn()
      const completeLane = createMockLane({
        id: 'complete-lane',
        label: 'Complete Lane',
        description: 'Complete description',
        color: '#ff0000',
        priority: 2,
        collapsed: false,
        maxConcurrent: 10,
        executions: [createMockExecution()] // Need at least one execution to render lane
      })

      const mockData = createMockParallelAgentData({
        lanes: [completeLane]
      })

      render(<ParallelAgentView data={mockData} onLaneClick={mockOnLaneClick} />)

      fireEvent.click(screen.getByTestId('lane-click-complete-lane'))

      const callArgs = mockOnLaneClick.mock.calls[0][0]

      // Verify all required properties are present
      expect(callArgs).toMatchObject({
        id: 'complete-lane',
        label: 'Complete Lane',
        description: 'Complete description',
        color: '#ff0000',
        priority: 2,
        collapsed: false,
        maxConcurrent: 10
      })
      // Verify executions array is present and has the expected structure
      expect(callArgs.executions).toBeInstanceOf(Array)
      expect(callArgs.executions).toHaveLength(1)
    })

    it('passes correct string parameters to action callbacks', () => {
      const mockCallbacks = {
        onAgentPause: vi.fn(),
        onAgentResume: vi.fn(),
        onAgentCancel: vi.fn(),
        onAgentRetry: vi.fn(),
        onLaneToggle: vi.fn(),
      }

      const executions = [
        createMockExecution({ id: 'exec-running', status: 'running' }),
        createMockExecution({ id: 'exec-paused', status: 'paused' }),
        createMockExecution({ id: 'exec-failed', status: 'failed' }),
      ]

      const testLane = createMockLane({
        id: 'param-test-lane',
        executions,
        collapsed: false
      })

      const mockData = createMockParallelAgentData({
        lanes: [testLane]
      })

      render(<ParallelAgentView data={mockData} {...mockCallbacks} />)

      // Test all action callbacks with string parameters
      fireEvent.click(screen.getByTestId('agent-pause-exec-running'))
      expect(mockCallbacks.onAgentPause).toHaveBeenCalledWith('exec-running')

      fireEvent.click(screen.getByTestId('agent-resume-exec-paused'))
      expect(mockCallbacks.onAgentResume).toHaveBeenCalledWith('exec-paused')

      fireEvent.click(screen.getByTestId('agent-cancel-exec-running'))
      expect(mockCallbacks.onAgentCancel).toHaveBeenCalledWith('exec-running')

      fireEvent.click(screen.getByTestId('agent-retry-exec-failed'))
      expect(mockCallbacks.onAgentRetry).toHaveBeenCalledWith('exec-failed')

      fireEvent.click(screen.getByTestId('lane-toggle-param-test-lane'))
      expect(mockCallbacks.onLaneToggle).toHaveBeenCalledWith('param-test-lane', true)

      // Verify all parameters are strings or booleans as expected
      expect(typeof mockCallbacks.onAgentPause.mock.calls[0][0]).toBe('string')
      expect(typeof mockCallbacks.onAgentResume.mock.calls[0][0]).toBe('string')
      expect(typeof mockCallbacks.onAgentCancel.mock.calls[0][0]).toBe('string')
      expect(typeof mockCallbacks.onAgentRetry.mock.calls[0][0]).toBe('string')
      expect(typeof mockCallbacks.onLaneToggle.mock.calls[0][0]).toBe('string')
      expect(typeof mockCallbacks.onLaneToggle.mock.calls[0][1]).toBe('boolean')
    })
  })
})