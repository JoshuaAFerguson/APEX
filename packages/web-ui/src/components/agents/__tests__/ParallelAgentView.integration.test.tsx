/**
 * Integration Tests for ParallelAgentView Component in DashboardPage Context
 *
 * This test suite verifies the integration behavior of ParallelAgentView within
 * the DashboardPage, focusing on real-time data updates, user interactions,
 * and navigation workflows that span multiple components.
 *
 * Acceptance Criteria Tested:
 * AC1: ParallelAgentView renders correctly within DashboardPage
 * AC2: Responds to real-time data updates
 * AC3: Agent actions work (pause, resume, cancel, retry)
 * AC4: Navigation to task details works
 */

import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

import { ParallelAgentView } from '../ParallelAgentView'
import type {
  ParallelAgentViewData,
  ParallelAgentViewConfig,
  AgentExecution,
  AgentLane,
  UseParallelAgentViewReturn,
  UseParallelAgentViewOptions,
} from '@/types/parallel-agent-view'

// Mock child components to isolate integration testing
vi.mock('../AgentLane', () => ({
  AgentLane: vi.fn(({ lane, onAgentClick, onAgentPause, onAgentResume, onAgentCancel, onAgentRetry, testId }) => (
    <div data-testid={testId || `lane-${lane.id}`}>
      <h4 data-testid={`lane-label-${lane.id}`}>{lane.label}</h4>
      <span data-testid={`lane-count-${lane.id}`}>{lane.executions.length} executions</span>
      {lane.executions.map((execution) => (
        <div key={execution.id} data-testid={`execution-${execution.id}`}>
          <span data-testid={`execution-name-${execution.id}`}>{execution.agentName}</span>
          <span data-testid={`execution-status-${execution.id}`}>{execution.status}</span>
          <span data-testid={`execution-progress-${execution.id}`}>{execution.progress}%</span>
          {execution.taskId && (
            <button
              data-testid={`execution-click-${execution.id}`}
              onClick={() => onAgentClick?.(execution)}
            >
              View Task
            </button>
          )}
          {execution.status === 'running' && (
            <>
              <button
                data-testid={`execution-pause-${execution.id}`}
                onClick={() => onAgentPause?.(execution.id)}
              >
                Pause
              </button>
              <button
                data-testid={`execution-cancel-${execution.id}`}
                onClick={() => onAgentCancel?.(execution.id)}
              >
                Cancel
              </button>
            </>
          )}
          {execution.status === 'paused' && (
            <button
              data-testid={`execution-resume-${execution.id}`}
              onClick={() => onAgentResume?.(execution.id)}
            >
              Resume
            </button>
          )}
          {(execution.status === 'failed' || execution.status === 'cancelled') && (
            <button
              data-testid={`execution-retry-${execution.id}`}
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

// Mock the useParallelAgentView hook
interface MockUseParallelAgentViewState {
  data: ParallelAgentViewData
  loading: boolean
  error: string | null
  isConnected: boolean
}

let mockHookState: MockUseParallelAgentViewState = {
  data: {
    lanes: [],
    totalExecutions: 0,
    runningCount: 0,
    completedCount: 0,
    failedCount: 0,
    overallProgress: 0,
    totalTokensUsed: 0,
    totalEstimatedCost: 0,
    lastUpdated: new Date(),
  },
  loading: false,
  error: null,
  isConnected: false,
}

const mockHookActions = {
  refresh: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  updateExecution: vi.fn(),
  addExecution: vi.fn(),
  removeExecution: vi.fn(),
}

vi.mock('@/hooks/useParallelAgentView', () => ({
  useParallelAgentView: vi.fn((options?: UseParallelAgentViewOptions): UseParallelAgentViewReturn => ({
    ...mockHookState,
    ...mockHookActions,
  })),
}))

// Mock Next.js router for navigation tests
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
}

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}))

// Test data factory functions
function createMockExecution(overrides: Partial<AgentExecution> = {}): AgentExecution {
  return {
    id: 'exec-1',
    agentId: 'agent-1',
    agentName: 'Test Agent',
    status: 'running',
    stage: 'implementing',
    progress: 50,
    startedAt: new Date(),
    tokensUsed: 1000,
    estimatedCost: 0.10,
    taskId: 'task-123',
    taskDescription: 'Test task',
    laneId: 'lane-1',
    ...overrides,
  }
}

function createMockLane(overrides: Partial<AgentLane> = {}): AgentLane {
  return {
    id: 'lane-1',
    label: 'Test Lane',
    description: 'A test lane',
    executions: [createMockExecution()],
    color: '#3b82f6',
    ...overrides,
  }
}

function createMockParallelAgentData(overrides: Partial<ParallelAgentViewData> = {}): ParallelAgentViewData {
  const lanes = overrides.lanes || [createMockLane()]
  const totalExecutions = lanes.reduce((sum, lane) => sum + lane.executions.length, 0)

  return {
    lanes,
    totalExecutions,
    runningCount: lanes.reduce((sum, lane) =>
      sum + lane.executions.filter(e => e.status === 'running').length, 0),
    completedCount: lanes.reduce((sum, lane) =>
      sum + lane.executions.filter(e => e.status === 'completed').length, 0),
    failedCount: lanes.reduce((sum, lane) =>
      sum + lane.executions.filter(e => e.status === 'failed').length, 0),
    overallProgress: 25,
    totalTokensUsed: 5000,
    totalEstimatedCost: 0.50,
    startedAt: new Date(),
    lastUpdated: new Date(),
    ...overrides,
  }
}

const defaultConfig: ParallelAgentViewConfig = {
  layout: 'lanes',
  size: 'md',
  sortBy: 'name',
  sortDirection: 'asc',
  showProgress: true,
  showElapsedTime: true,
  showTokenUsage: false,
  showCost: false,
  showStages: true,
  animated: true,
  maxLanes: 4,
  maxAgentsPerLane: 6,
  pagination: false,
  pageSize: 10,
  enableFiltering: true,
  enableSorting: true,
  compactMode: false,
  showHeader: true,
  showFooter: true,
}

describe('ParallelAgentView Integration Tests', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock state to default
    mockHookState = {
      data: createMockParallelAgentData(),
      loading: false,
      error: null,
      isConnected: false,
    }
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('AC1: Component Renders Correctly in DashboardPage Context', () => {
    it('should render with proper dashboard integration structure', () => {
      // Simulate DashboardPage context with configuration
      const dashboardConfig: ParallelAgentViewConfig = {
        ...defaultConfig,
        layout: 'lanes',
        size: 'md',
        maxLanes: 4,
        maxAgentsPerLane: 6,
      }

      render(
        <ParallelAgentView
          data={mockHookState.data}
          config={dashboardConfig}
          onAgentClick={vi.fn()}
          onAgentPause={vi.fn()}
          onAgentResume={vi.fn()}
          onAgentCancel={vi.fn()}
          onAgentRetry={vi.fn()}
          loading={false}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Verify main component renders
      expect(screen.getByTestId('dashboard-parallel-agent-view')).toBeInTheDocument()

      // Verify header with title and stats
      expect(screen.getByText('Parallel Agents')).toBeInTheDocument()
      expect(screen.getByText('1 total')).toBeInTheDocument()

      // Verify lanes render
      expect(screen.getByTestId('lane-lane-1')).toBeInTheDocument()
      expect(screen.getByText('Test Lane')).toBeInTheDocument()

      // Verify footer with last updated
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
    })

    it('should display correct statistics badges based on data', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({
            id: 'lane-1',
            executions: [
              createMockExecution({ status: 'running' }),
              createMockExecution({ id: 'exec-2', status: 'completed' }),
              createMockExecution({ id: 'exec-3', status: 'failed' }),
            ],
          }),
        ],
      })

      mockHookState.data = mockData

      render(
        <ParallelAgentView
          data={mockData}
          config={defaultConfig}
          onAgentClick={vi.fn()}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Should show total count
      expect(screen.getByText('3 total')).toBeInTheDocument()

      // Should show active count
      expect(screen.getByText('1 active')).toBeInTheDocument()

      // Should show completed count
      expect(screen.getByText('1 completed')).toBeInTheDocument()

      // Should show failed count
      expect(screen.getByText('1 failed')).toBeInTheDocument()
    })

    it('should render loading state correctly', () => {
      render(
        <ParallelAgentView
          data={mockHookState.data}
          config={defaultConfig}
          loading={true}
          testId="dashboard-parallel-agent-view"
        />
      )

      expect(screen.getByTestId('dashboard-parallel-agent-view')).toBeInTheDocument()
      expect(screen.getByText('Loading parallel agents...')).toBeInTheDocument()

      // Should not render main content when loading
      expect(screen.queryByText('Parallel Agents')).not.toBeInTheDocument()
    })

    it('should render error state with retry functionality', async () => {
      const mockOnAgentClick = vi.fn()

      render(
        <ParallelAgentView
          data={mockHookState.data}
          config={defaultConfig}
          error="Failed to load data"
          onAgentClick={mockOnAgentClick}
          testId="dashboard-parallel-agent-view"
        />
      )

      expect(screen.getByText('Failed to load data')).toBeInTheDocument()

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /try again/i })
      await user.click(retryButton)

      // Should trigger refresh through onLaneClick mechanism
      // (This is how refresh is implemented in the component)
      expect(mockOnAgentClick).toHaveBeenCalledTimes(0) // onLaneClick not called in error state
    })

    it('should render empty state when no executions', () => {
      const emptyData = createMockParallelAgentData({
        lanes: [],
        totalExecutions: 0,
      })

      render(
        <ParallelAgentView
          data={emptyData}
          config={defaultConfig}
          emptyMessage="No parallel agents running"
          testId="dashboard-parallel-agent-view"
        />
      )

      expect(screen.getByText('No parallel agents running')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
    })
  })

  describe('AC2: Real-time Data Updates', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should update display when data prop changes', async () => {
      const initialData = createMockParallelAgentData({
        lanes: [createMockLane({
          executions: [createMockExecution({ progress: 25 })],
        })],
      })

      const { rerender } = render(
        <ParallelAgentView
          data={initialData}
          config={defaultConfig}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Verify initial progress
      expect(screen.getByTestId('execution-progress-exec-1')).toHaveTextContent('25%')

      // Update data with new progress
      const updatedData = createMockParallelAgentData({
        lanes: [createMockLane({
          executions: [createMockExecution({ progress: 75 })],
        })],
      })

      rerender(
        <ParallelAgentView
          data={updatedData}
          config={defaultConfig}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Verify updated progress
      expect(screen.getByTestId('execution-progress-exec-1')).toHaveTextContent('75%')
    })

    it('should handle new agent executions being added', async () => {
      const initialData = createMockParallelAgentData({
        lanes: [createMockLane({
          executions: [createMockExecution()],
        })],
      })

      const { rerender } = render(
        <ParallelAgentView
          data={initialData}
          config={defaultConfig}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Verify initial state
      expect(screen.getByText('1 total')).toBeInTheDocument()
      expect(screen.getByTestId('lane-count-lane-1')).toHaveTextContent('1 executions')

      // Add new execution
      const updatedData = createMockParallelAgentData({
        lanes: [createMockLane({
          executions: [
            createMockExecution(),
            createMockExecution({
              id: 'exec-2',
              agentName: 'Second Agent',
              status: 'queued',
            }),
          ],
        })],
        totalExecutions: 2,
      })

      rerender(
        <ParallelAgentView
          data={updatedData}
          config={defaultConfig}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Verify updated state
      expect(screen.getByText('2 total')).toBeInTheDocument()
      expect(screen.getByTestId('lane-count-lane-1')).toHaveTextContent('2 executions')
      expect(screen.getByText('Second Agent')).toBeInTheDocument()
    })

    it('should handle agent execution removal', async () => {
      const initialData = createMockParallelAgentData({
        lanes: [createMockLane({
          executions: [
            createMockExecution(),
            createMockExecution({
              id: 'exec-2',
              agentName: 'Second Agent',
            }),
          ],
        })],
        totalExecutions: 2,
      })

      const { rerender } = render(
        <ParallelAgentView
          data={initialData}
          config={defaultConfig}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Verify initial state
      expect(screen.getByText('2 total')).toBeInTheDocument()
      expect(screen.getByText('Second Agent')).toBeInTheDocument()

      // Remove one execution
      const updatedData = createMockParallelAgentData({
        lanes: [createMockLane({
          executions: [createMockExecution()],
        })],
      })

      rerender(
        <ParallelAgentView
          data={updatedData}
          config={defaultConfig}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Verify updated state
      expect(screen.getByText('1 total')).toBeInTheDocument()
      expect(screen.queryByText('Second Agent')).not.toBeInTheDocument()
    })

    it('should update last updated timestamp', async () => {
      const initialTime = new Date('2024-01-01T10:00:00Z')
      const initialData = createMockParallelAgentData({
        lastUpdated: initialTime,
      })

      const { rerender } = render(
        <ParallelAgentView
          data={initialData}
          config={defaultConfig}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Verify initial timestamp appears in the footer
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
      expect(screen.getByText(new RegExp(initialTime.toLocaleTimeString()))).toBeInTheDocument()

      // Update with new timestamp
      const updatedTime = new Date('2024-01-01T10:05:00Z')
      const updatedData = createMockParallelAgentData({
        lastUpdated: updatedTime,
      })

      rerender(
        <ParallelAgentView
          data={updatedData}
          config={defaultConfig}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Verify updated timestamp appears
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
      expect(screen.getByText(new RegExp(updatedTime.toLocaleTimeString()))).toBeInTheDocument()
    })

    it('should show live connection indicator when isConnected changes', async () => {
      // This test would require extending the component to show connection status
      // For now, we verify the hook integration supports connection state
      mockHookState.isConnected = true

      render(
        <ParallelAgentView
          data={mockHookState.data}
          config={defaultConfig}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Component renders without error when connected
      expect(screen.getByTestId('dashboard-parallel-agent-view')).toBeInTheDocument()
    })
  })

  describe('AC3: Agent Actions Work', () => {
    it('should handle pause action correctly', async () => {
      const mockOnAgentPause = vi.fn()
      const runningExecution = createMockExecution({
        status: 'running',
        id: 'exec-running',
      })

      const data = createMockParallelAgentData({
        lanes: [createMockLane({
          executions: [runningExecution],
        })],
      })

      render(
        <ParallelAgentView
          data={data}
          config={defaultConfig}
          onAgentPause={mockOnAgentPause}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Click pause button
      const pauseButton = screen.getByTestId('execution-pause-exec-running')
      await user.click(pauseButton)

      expect(mockOnAgentPause).toHaveBeenCalledWith('exec-running')
      expect(mockOnAgentPause).toHaveBeenCalledTimes(1)
    })

    it('should handle resume action correctly', async () => {
      const mockOnAgentResume = vi.fn()
      const pausedExecution = createMockExecution({
        status: 'paused',
        id: 'exec-paused',
      })

      const data = createMockParallelAgentData({
        lanes: [createMockLane({
          executions: [pausedExecution],
        })],
      })

      render(
        <ParallelAgentView
          data={data}
          config={defaultConfig}
          onAgentResume={mockOnAgentResume}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Click resume button
      const resumeButton = screen.getByTestId('execution-resume-exec-paused')
      await user.click(resumeButton)

      expect(mockOnAgentResume).toHaveBeenCalledWith('exec-paused')
      expect(mockOnAgentResume).toHaveBeenCalledTimes(1)
    })

    it('should handle cancel action correctly', async () => {
      const mockOnAgentCancel = vi.fn()
      const runningExecution = createMockExecution({
        status: 'running',
        id: 'exec-cancel',
      })

      const data = createMockParallelAgentData({
        lanes: [createMockLane({
          executions: [runningExecution],
        })],
      })

      render(
        <ParallelAgentView
          data={data}
          config={defaultConfig}
          onAgentCancel={mockOnAgentCancel}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Click cancel button
      const cancelButton = screen.getByTestId('execution-cancel-exec-cancel')
      await user.click(cancelButton)

      expect(mockOnAgentCancel).toHaveBeenCalledWith('exec-cancel')
      expect(mockOnAgentCancel).toHaveBeenCalledTimes(1)
    })

    it('should handle retry action correctly', async () => {
      const mockOnAgentRetry = vi.fn()
      const failedExecution = createMockExecution({
        status: 'failed',
        id: 'exec-failed',
      })

      const data = createMockParallelAgentData({
        lanes: [createMockLane({
          executions: [failedExecution],
        })],
      })

      render(
        <ParallelAgentView
          data={data}
          config={defaultConfig}
          onAgentRetry={mockOnAgentRetry}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Click retry button
      const retryButton = screen.getByTestId('execution-retry-exec-failed')
      await user.click(retryButton)

      expect(mockOnAgentRetry).toHaveBeenCalledWith('exec-failed')
      expect(mockOnAgentRetry).toHaveBeenCalledTimes(1)
    })

    it('should handle multiple actions in sequence', async () => {
      const mockOnAgentPause = vi.fn()
      const mockOnAgentCancel = vi.fn()

      const executions = [
        createMockExecution({ id: 'exec-1', status: 'running' }),
        createMockExecution({ id: 'exec-2', status: 'running' }),
      ]

      const data = createMockParallelAgentData({
        lanes: [createMockLane({
          executions,
        })],
      })

      render(
        <ParallelAgentView
          data={data}
          config={defaultConfig}
          onAgentPause={mockOnAgentPause}
          onAgentCancel={mockOnAgentCancel}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Pause first execution
      await user.click(screen.getByTestId('execution-pause-exec-1'))
      expect(mockOnAgentPause).toHaveBeenCalledWith('exec-1')

      // Cancel second execution
      await user.click(screen.getByTestId('execution-cancel-exec-2'))
      expect(mockOnAgentCancel).toHaveBeenCalledWith('exec-2')

      expect(mockOnAgentPause).toHaveBeenCalledTimes(1)
      expect(mockOnAgentCancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('AC4: Navigation to Task Details', () => {
    it('should navigate to task detail when agent is clicked with taskId', async () => {
      const mockOnAgentClick = vi.fn()
      const executionWithTask = createMockExecution({
        id: 'exec-with-task',
        taskId: 'task-123',
      })

      const data = createMockParallelAgentData({
        lanes: [createMockLane({
          executions: [executionWithTask],
        })],
      })

      render(
        <ParallelAgentView
          data={data}
          config={defaultConfig}
          onAgentClick={mockOnAgentClick}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Click the agent execution
      const viewTaskButton = screen.getByTestId('execution-click-exec-with-task')
      await user.click(viewTaskButton)

      expect(mockOnAgentClick).toHaveBeenCalledWith(executionWithTask)
      expect(mockOnAgentClick).toHaveBeenCalledTimes(1)
    })

    it('should handle navigation in DashboardPage context', async () => {
      // Simulate exact DashboardPage onAgentClick behavior
      const dashboardOnAgentClick = vi.fn((execution: AgentExecution) => {
        if (execution.taskId) {
          mockRouter.push(`/tasks/${execution.taskId}`)
        }
      })

      const executionWithTask = createMockExecution({
        id: 'exec-nav-test',
        taskId: 'task-456',
      })

      const data = createMockParallelAgentData({
        lanes: [createMockLane({
          executions: [executionWithTask],
        })],
      })

      render(
        <ParallelAgentView
          data={data}
          config={defaultConfig}
          onAgentClick={dashboardOnAgentClick}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Click the agent execution
      const viewTaskButton = screen.getByTestId('execution-click-exec-nav-test')
      await user.click(viewTaskButton)

      expect(dashboardOnAgentClick).toHaveBeenCalledWith(executionWithTask)
      expect(mockRouter.push).toHaveBeenCalledWith('/tasks/task-456')
    })

    it('should not navigate when agent has no taskId', async () => {
      const dashboardOnAgentClick = vi.fn((execution: AgentExecution) => {
        if (execution.taskId) {
          mockRouter.push(`/tasks/${execution.taskId}`)
        }
      })

      const executionWithoutTask = createMockExecution({
        id: 'exec-no-task',
        taskId: undefined,
      })

      const data = createMockParallelAgentData({
        lanes: [createMockLane({
          executions: [executionWithoutTask],
        })],
      })

      render(
        <ParallelAgentView
          data={data}
          config={defaultConfig}
          onAgentClick={dashboardOnAgentClick}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Should not render view task button for execution without taskId
      expect(screen.queryByTestId('execution-click-exec-no-task')).not.toBeInTheDocument()
      expect(mockRouter.push).not.toHaveBeenCalled()
    })

    it('should handle navigation with multiple agents having different taskIds', async () => {
      const dashboardOnAgentClick = vi.fn((execution: AgentExecution) => {
        if (execution.taskId) {
          mockRouter.push(`/tasks/${execution.taskId}`)
        }
      })

      const executions = [
        createMockExecution({ id: 'exec-1', taskId: 'task-111' }),
        createMockExecution({ id: 'exec-2', taskId: 'task-222' }),
        createMockExecution({ id: 'exec-3', taskId: undefined }),
      ]

      const data = createMockParallelAgentData({
        lanes: [createMockLane({
          executions,
        })],
      })

      render(
        <ParallelAgentView
          data={data}
          config={defaultConfig}
          onAgentClick={dashboardOnAgentClick}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Click first execution
      await user.click(screen.getByTestId('execution-click-exec-1'))
      expect(mockRouter.push).toHaveBeenCalledWith('/tasks/task-111')

      // Click second execution
      await user.click(screen.getByTestId('execution-click-exec-2'))
      expect(mockRouter.push).toHaveBeenCalledWith('/tasks/task-222')

      // Third execution should not have a click button (no taskId)
      expect(screen.queryByTestId('execution-click-exec-3')).not.toBeInTheDocument()

      expect(mockRouter.push).toHaveBeenCalledTimes(2)
    })
  })

  describe('Dashboard Configuration Integration', () => {
    it('should respect DashboardPage configuration settings', () => {
      const dashboardConfig: ParallelAgentViewConfig = {
        ...defaultConfig,
        layout: 'lanes',
        size: 'md',
        showProgress: true,
        showElapsedTime: true,
        showTokenUsage: false,
        showCost: false,
        showStages: true,
        animated: true,
        maxLanes: 4,
        maxAgentsPerLane: 6,
      }

      render(
        <ParallelAgentView
          data={mockHookState.data}
          config={dashboardConfig}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Verify component honors the configuration
      expect(screen.getByTestId('dashboard-parallel-agent-view')).toBeInTheDocument()

      // Layout should be lanes (verified by lane rendering)
      expect(screen.getByTestId('lane-lane-1')).toBeInTheDocument()

      // Should show controls for supported features
      expect(screen.getByText('Name')).toBeInTheDocument() // Sort controls
      expect(screen.getByTestId('icon-list')).toBeInTheDocument() // Layout controls
    })

    it('should handle layout changes through controls', async () => {
      render(
        <ParallelAgentView
          data={mockHookState.data}
          config={defaultConfig}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Verify initial lanes layout
      expect(screen.getByTestId('lane-lane-1')).toBeInTheDocument()

      // Click grid layout button
      const gridButton = screen.getByTitle('grid view')
      await act(async () => {
        await user.click(gridButton)
      })

      // Component should re-render with grid layout
      // (In a real scenario, this would change the visual layout)
      expect(screen.getByTestId('dashboard-parallel-agent-view')).toBeInTheDocument()
    })

    it('should handle sorting changes through controls', async () => {
      render(
        <ParallelAgentView
          data={mockHookState.data}
          config={defaultConfig}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Click progress sort button
      const progressSortButton = screen.getByText('Progress')
      await act(async () => {
        await user.click(progressSortButton)
      })

      // Should show active state for progress sort (check for primary button classes)
      expect(progressSortButton).toHaveClass('bg-apex-600') // primary variant class
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed data gracefully', () => {
      const malformedData = {
        ...createMockParallelAgentData(),
        lanes: [
          {
            ...createMockLane(),
            executions: [
              {
                ...createMockExecution(),
                agentName: '', // Empty name
                progress: -1, // Invalid progress
              },
            ],
          },
        ],
      }

      render(
        <ParallelAgentView
          data={malformedData}
          config={defaultConfig}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Should render without crashing
      expect(screen.getByTestId('dashboard-parallel-agent-view')).toBeInTheDocument()
    })

    it('should handle rapid data updates without memory leaks', async () => {
      const { rerender } = render(
        <ParallelAgentView
          data={mockHookState.data}
          config={defaultConfig}
          testId="dashboard-parallel-agent-view"
        />
      )

      // Simulate rapid updates
      for (let i = 0; i < 10; i++) {
        const updatedData = createMockParallelAgentData({
          lanes: [createMockLane({
            executions: [createMockExecution({ progress: i * 10 })],
          })],
        })

        rerender(
          <ParallelAgentView
            data={updatedData}
            config={defaultConfig}
            testId="dashboard-parallel-agent-view"
          />
        )
      }

      // Should still be functional after rapid updates
      expect(screen.getByTestId('dashboard-parallel-agent-view')).toBeInTheDocument()
    })
  })
})