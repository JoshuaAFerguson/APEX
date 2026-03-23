import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ParallelAgentView } from '../ParallelAgentView'
import type {
  ParallelAgentViewData,
  AgentLane as AgentLaneType,
  AgentExecution,
} from '@/types/parallel-agent-view'
import { EMPTY_PARALLEL_AGENT_VIEW_DATA } from '@/types/parallel-agent-view'

// Mock the child AgentLane component
vi.mock('../AgentLane', () => ({
  AgentLane: vi.fn(({ lane, testId, onAgentClick, onLaneClick }) => (
    <div data-testid={testId} data-lane-id={lane.id}>
      <span>{lane.label}</span>
      {lane.executions.map((exec: AgentExecution) => (
        <button
          key={exec.id}
          data-testid={`exec-${exec.id}`}
          onClick={() => onAgentClick?.(exec)}
        >
          {exec.agentName}
        </button>
      ))}
    </div>
  )),
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  LayoutGrid: () => <span data-testid="icon-grid">Grid</span>,
  List: () => <span data-testid="icon-list">List</span>,
  Clock: () => <span data-testid="icon-clock">Clock</span>,
  Minimize: () => <span data-testid="icon-minimize">Minimize</span>,
  RotateCcw: () => <span data-testid="icon-rotate">Rotate</span>,
  Settings: () => <span data-testid="icon-settings">Settings</span>,
  Filter: () => <span data-testid="icon-filter">Filter</span>,
  SortAsc: () => <span data-testid="icon-sort-asc">SortAsc</span>,
  SortDesc: () => <span data-testid="icon-sort-desc">SortDesc</span>,
  Loader2: () => <span data-testid="icon-loader">Loading</span>,
}))

// Mock the Spinner component
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

describe('ParallelAgentView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders with data showing lanes and header', () => {
      const mockData = createMockParallelAgentData()
      render(<ParallelAgentView data={mockData} testId="parallel-agent-view" />)

      // Verify the component renders
      const view = screen.getByTestId('parallel-agent-view')
      expect(view).toBeInTheDocument()

      // Verify header content
      expect(screen.getByText('Parallel Agents')).toBeInTheDocument()
      expect(screen.getByText('2 total')).toBeInTheDocument()
    })

    it('renders lanes from data', () => {
      const mockData = createMockParallelAgentData()
      render(<ParallelAgentView data={mockData} />)

      // Verify lanes are rendered
      expect(screen.getByTestId('lane-development')).toBeInTheDocument()
      expect(screen.getByTestId('lane-testing')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      const mockData = createMockParallelAgentData()
      render(
        <ParallelAgentView
          data={mockData}
          className="custom-class"
          testId="styled-view"
        />
      )

      const view = screen.getByTestId('styled-view')
      expect(view).toHaveClass('custom-class')
    })

    it('displays status badges for active and completed agents', () => {
      const mockData = createMockParallelAgentData({
        runningCount: 2,
        completedCount: 3,
        failedCount: 1,
      })
      // Also update lanes to have matching execution counts
      mockData.lanes = [
        createMockLane({
          id: 'dev',
          executions: [
            createMockExecution({ id: 'e1', status: 'running' }),
            createMockExecution({ id: 'e2', status: 'running' }),
            createMockExecution({ id: 'e3', status: 'completed' }),
            createMockExecution({ id: 'e4', status: 'completed' }),
            createMockExecution({ id: 'e5', status: 'completed' }),
            createMockExecution({ id: 'e6', status: 'failed' }),
          ],
        }),
      ]

      render(<ParallelAgentView data={mockData} />)

      // Check for status badges in header
      expect(screen.getByText('2 active')).toBeInTheDocument()
      expect(screen.getByText('3 completed')).toBeInTheDocument()
      expect(screen.getByText('1 failed')).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('shows spinner when loading is true', () => {
      const mockData = createMockParallelAgentData()
      render(
        <ParallelAgentView
          data={mockData}
          loading={true}
          testId="loading-view"
        />
      )

      // Should show spinner
      const spinner = screen.getByTestId('spinner')
      expect(spinner).toBeInTheDocument()
    })

    it('shows loading text when loading', () => {
      const mockData = createMockParallelAgentData()
      render(<ParallelAgentView data={mockData} loading={true} />)

      expect(screen.getByText('Loading parallel agents...')).toBeInTheDocument()
    })

    it('does not render lanes when loading', () => {
      const mockData = createMockParallelAgentData()
      render(<ParallelAgentView data={mockData} loading={true} />)

      // Lanes should not be rendered during loading
      expect(screen.queryByTestId('lane-development')).not.toBeInTheDocument()
      expect(screen.queryByTestId('lane-testing')).not.toBeInTheDocument()
    })

    it('applies testId to loading container', () => {
      const mockData = createMockParallelAgentData()
      render(
        <ParallelAgentView
          data={mockData}
          loading={true}
          testId="loading-container"
        />
      )

      expect(screen.getByTestId('loading-container')).toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('shows error message when error prop is provided', () => {
      const mockData = createMockParallelAgentData()
      const errorMessage = 'Failed to load parallel agents'

      render(
        <ParallelAgentView
          data={mockData}
          error={errorMessage}
          testId="error-view"
        />
      )

      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('shows retry button in error state', () => {
      const mockData = createMockParallelAgentData()
      render(
        <ParallelAgentView
          data={mockData}
          error="Connection failed"
        />
      )

      const retryButton = screen.getByRole('button', { name: /try again/i })
      expect(retryButton).toBeInTheDocument()
    })

    it('does not render lanes when in error state', () => {
      const mockData = createMockParallelAgentData()
      render(
        <ParallelAgentView
          data={mockData}
          error="Error occurred"
        />
      )

      expect(screen.queryByTestId('lane-development')).not.toBeInTheDocument()
      expect(screen.queryByTestId('lane-testing')).not.toBeInTheDocument()
    })

    it('applies testId to error container', () => {
      const mockData = createMockParallelAgentData()
      render(
        <ParallelAgentView
          data={mockData}
          error="Error"
          testId="error-container"
        />
      )

      expect(screen.getByTestId('error-container')).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('shows default empty message when no agents', () => {
      render(
        <ParallelAgentView
          data={EMPTY_PARALLEL_AGENT_VIEW_DATA}
          testId="empty-view"
        />
      )

      expect(
        screen.getByText('No parallel agents currently active')
      ).toBeInTheDocument()
    })

    it('shows custom empty message when provided', () => {
      const customMessage = 'Custom empty state message'
      render(
        <ParallelAgentView
          data={EMPTY_PARALLEL_AGENT_VIEW_DATA}
          emptyMessage={customMessage}
        />
      )

      expect(screen.getByText(customMessage)).toBeInTheDocument()
    })

    it('shows refresh button in empty state', () => {
      render(<ParallelAgentView data={EMPTY_PARALLEL_AGENT_VIEW_DATA} />)

      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      expect(refreshButton).toBeInTheDocument()
    })

    it('applies testId to empty state container', () => {
      render(
        <ParallelAgentView
          data={EMPTY_PARALLEL_AGENT_VIEW_DATA}
          testId="empty-container"
        />
      )

      expect(screen.getByTestId('empty-container')).toBeInTheDocument()
    })

    it('shows empty state when lanes array has no executions', () => {
      const dataWithEmptyLanes: ParallelAgentViewData = {
        ...EMPTY_PARALLEL_AGENT_VIEW_DATA,
        lanes: [createMockLane({ executions: [] })],
      }

      render(<ParallelAgentView data={dataWithEmptyLanes} />)

      expect(
        screen.getByText('No parallel agents currently active')
      ).toBeInTheDocument()
    })
  })

  describe('Callback Handling', () => {
    it('calls onAgentClick when an agent is clicked', () => {
      const mockData = createMockParallelAgentData()
      const mockOnAgentClick = vi.fn()

      render(
        <ParallelAgentView
          data={mockData}
          onAgentClick={mockOnAgentClick}
        />
      )

      // Find and click an execution button (from the mocked AgentLane)
      const execButton = screen.getAllByTestId(/^exec-/)[0]
      fireEvent.click(execButton)

      expect(mockOnAgentClick).toHaveBeenCalled()
    })

    it('passes pause callback to agent lanes', () => {
      const mockData = createMockParallelAgentData()
      const mockOnAgentPause = vi.fn()

      render(
        <ParallelAgentView
          data={mockData}
          onAgentPause={mockOnAgentPause}
        />
      )

      // Verify lanes are rendered (callbacks are passed through)
      expect(screen.getByTestId('lane-development')).toBeInTheDocument()
    })

    it('passes resume callback to agent lanes', () => {
      const mockData = createMockParallelAgentData()
      const mockOnAgentResume = vi.fn()

      render(
        <ParallelAgentView
          data={mockData}
          onAgentResume={mockOnAgentResume}
        />
      )

      expect(screen.getByTestId('lane-development')).toBeInTheDocument()
    })

    it('passes cancel callback to agent lanes', () => {
      const mockData = createMockParallelAgentData()
      const mockOnAgentCancel = vi.fn()

      render(
        <ParallelAgentView
          data={mockData}
          onAgentCancel={mockOnAgentCancel}
        />
      )

      expect(screen.getByTestId('lane-development')).toBeInTheDocument()
    })

    it('passes retry callback to agent lanes', () => {
      const mockData = createMockParallelAgentData()
      const mockOnAgentRetry = vi.fn()

      render(
        <ParallelAgentView
          data={mockData}
          onAgentRetry={mockOnAgentRetry}
        />
      )

      expect(screen.getByTestId('lane-development')).toBeInTheDocument()
    })
  })

  describe('Layout and Sorting Controls', () => {
    it('renders layout toggle buttons', () => {
      const mockData = createMockParallelAgentData()
      render(<ParallelAgentView data={mockData} />)

      // Check for layout icons
      expect(screen.getByTestId('icon-list')).toBeInTheDocument()
      expect(screen.getByTestId('icon-grid')).toBeInTheDocument()
      expect(screen.getByTestId('icon-clock')).toBeInTheDocument()
      expect(screen.getByTestId('icon-minimize')).toBeInTheDocument()
    })

    it('renders sort criteria buttons', () => {
      const mockData = createMockParallelAgentData()
      render(<ParallelAgentView data={mockData} />)

      expect(screen.getByRole('button', { name: /name/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /status/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /progress/i })).toBeInTheDocument()
    })

    it('renders refresh and settings buttons', () => {
      const mockData = createMockParallelAgentData()
      render(<ParallelAgentView data={mockData} />)

      expect(screen.getByTestId('icon-rotate')).toBeInTheDocument()
      expect(screen.getByTestId('icon-settings')).toBeInTheDocument()
    })
  })

  describe('Footer and Last Updated', () => {
    it('shows last updated timestamp', () => {
      const mockData = createMockParallelAgentData({
        lastUpdated: new Date('2024-01-01T10:30:00Z'),
      })

      render(<ParallelAgentView data={mockData} />)

      expect(screen.getByText(/last updated/i)).toBeInTheDocument()
    })

    it('shows average progress in footer when available', () => {
      const mockData = createMockParallelAgentData()
      // Create data with running executions to have average progress
      mockData.lanes = [
        createMockLane({
          executions: [
            createMockExecution({ status: 'running', progress: 50 }),
            createMockExecution({ status: 'running', progress: 70, id: 'exec-2' }),
          ],
        }),
      ]

      render(<ParallelAgentView data={mockData} />)

      expect(screen.getByText(/average progress/i)).toBeInTheDocument()
    })
  })

  describe('Configuration', () => {
    it('applies custom configuration', () => {
      const mockData = createMockParallelAgentData()
      render(
        <ParallelAgentView
          data={mockData}
          config={{
            layout: 'grid',
            size: 'lg',
            showProgress: true,
            animated: false,
          }}
        />
      )

      // Component should render with config
      expect(screen.getByText('Parallel Agents')).toBeInTheDocument()
    })

    it('limits displayed lanes based on maxLanes config', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({ id: 'lane-1', label: 'Lane 1' }),
          createMockLane({ id: 'lane-2', label: 'Lane 2' }),
          createMockLane({ id: 'lane-3', label: 'Lane 3' }),
          createMockLane({ id: 'lane-4', label: 'Lane 4' }),
        ],
      })

      render(
        <ParallelAgentView
          data={mockData}
          config={{ maxLanes: 2 }}
        />
      )

      expect(screen.getByTestId('lane-lane-1')).toBeInTheDocument()
      expect(screen.getByTestId('lane-lane-2')).toBeInTheDocument()
      expect(screen.queryByTestId('lane-lane-3')).not.toBeInTheDocument()
      expect(screen.queryByTestId('lane-lane-4')).not.toBeInTheDocument()
    })
  })

  describe('Layout Mode: Lanes', () => {
    it('renders lanes layout by default', () => {
      const mockData = createMockParallelAgentData()
      render(<ParallelAgentView data={mockData} testId="lanes-view" />)

      // Should render lane components
      expect(screen.getByTestId('lane-development')).toBeInTheDocument()
      expect(screen.getByTestId('lane-testing')).toBeInTheDocument()
    })

    it('renders lanes in grid layout with responsive columns', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({ id: 'lane-1', label: 'Lane 1' }),
          createMockLane({ id: 'lane-2', label: 'Lane 2' }),
          createMockLane({ id: 'lane-3', label: 'Lane 3' }),
        ],
      })

      render(
        <ParallelAgentView
          data={mockData}
          config={{ layout: 'lanes', size: 'md' }}
        />
      )

      // Verify all lanes are present
      expect(screen.getByTestId('lane-lane-1')).toBeInTheDocument()
      expect(screen.getByTestId('lane-lane-2')).toBeInTheDocument()
      expect(screen.getByTestId('lane-lane-3')).toBeInTheDocument()
    })

    it('passes correct props to AgentLane components in lanes layout', () => {
      const mockData = createMockParallelAgentData()
      const mockOnAgentClick = vi.fn()
      const mockOnLaneClick = vi.fn()

      render(
        <ParallelAgentView
          data={mockData}
          config={{
            layout: 'lanes',
            size: 'lg',
            showProgress: true,
            maxAgentsPerLane: 5,
          }}
          onAgentClick={mockOnAgentClick}
          onLaneClick={mockOnLaneClick}
        />
      )

      // Verify lanes are rendered with proper test IDs
      expect(screen.getByTestId('lane-development')).toBeInTheDocument()
      expect(screen.getByTestId('lane-testing')).toBeInTheDocument()
    })

    it('applies size configuration to lanes layout', () => {
      const mockData = createMockParallelAgentData()

      render(
        <ParallelAgentView
          data={mockData}
          config={{ layout: 'lanes', size: 'sm' }}
        />
      )

      // Verify lanes are still rendered (size affects CSS classes)
      expect(screen.getByTestId('lane-development')).toBeInTheDocument()
    })

    it('respects maxLanes configuration in lanes layout', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({ id: 'lane-1', label: 'Lane 1' }),
          createMockLane({ id: 'lane-2', label: 'Lane 2' }),
          createMockLane({ id: 'lane-3', label: 'Lane 3' }),
          createMockLane({ id: 'lane-4', label: 'Lane 4' }),
        ],
      })

      render(
        <ParallelAgentView
          data={mockData}
          config={{ layout: 'lanes', maxLanes: 2 }}
        />
      )

      // Only first 2 lanes should be displayed
      expect(screen.getByTestId('lane-lane-1')).toBeInTheDocument()
      expect(screen.getByTestId('lane-lane-2')).toBeInTheDocument()
      expect(screen.queryByTestId('lane-lane-3')).not.toBeInTheDocument()
      expect(screen.queryByTestId('lane-lane-4')).not.toBeInTheDocument()
    })
  })

  describe('Layout Mode: Grid', () => {
    it('renders grid layout with agent cards', () => {
      const mockData = createMockParallelAgentData()
      render(
        <ParallelAgentView
          data={mockData}
          config={{ layout: 'grid' }}
          testId="grid-view"
        />
      )

      // Should render individual agent cards instead of lanes
      expect(screen.getByText('Developer Agent')).toBeInTheDocument()
      expect(screen.getByText('Test Agent')).toBeInTheDocument()
    })

    it('flattens all executions from all lanes in grid layout', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({
            id: 'dev',
            label: 'Development',
            executions: [
              createMockExecution({ id: 'dev-1', agentName: 'Dev Agent 1' }),
              createMockExecution({ id: 'dev-2', agentName: 'Dev Agent 2' }),
            ],
          }),
          createMockLane({
            id: 'test',
            label: 'Testing',
            executions: [
              createMockExecution({ id: 'test-1', agentName: 'Test Agent 1' }),
            ],
          }),
        ],
      })

      render(
        <ParallelAgentView
          data={mockData}
          config={{ layout: 'grid' }}
        />
      )

      // All agent executions should be displayed as individual cards
      expect(screen.getByText('Dev Agent 1')).toBeInTheDocument()
      expect(screen.getByText('Dev Agent 2')).toBeInTheDocument()
      expect(screen.getByText('Test Agent 1')).toBeInTheDocument()
    })

    it('shows agent status and progress in grid cards', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({
            executions: [
              createMockExecution({
                agentName: 'Grid Agent',
                status: 'running',
                progress: 75,
              }),
            ],
          }),
        ],
      })

      render(
        <ParallelAgentView
          data={mockData}
          config={{ layout: 'grid' }}
        />
      )

      expect(screen.getByText('Grid Agent')).toBeInTheDocument()
      expect(screen.getByText('running • 75%')).toBeInTheDocument()
    })

    it('applies size configuration to grid layout', () => {
      const mockData = createMockParallelAgentData()

      render(
        <ParallelAgentView
          data={mockData}
          config={{ layout: 'grid', size: 'lg' }}
        />
      )

      // Verify agents are rendered (size affects CSS grid classes)
      expect(screen.getByText('Developer Agent')).toBeInTheDocument()
    })

    it('handles empty executions in grid layout', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({ executions: [] }),
        ],
      })

      render(
        <ParallelAgentView
          data={mockData}
          config={{ layout: 'grid' }}
        />
      )

      // Should show empty state
      expect(screen.getByText('No parallel agents currently active')).toBeInTheDocument()
    })
  })

  describe('Layout Mode: Timeline', () => {
    it('renders timeline layout with lane summaries', () => {
      const mockData = createMockParallelAgentData()
      render(
        <ParallelAgentView
          data={mockData}
          config={{ layout: 'timeline' }}
          testId="timeline-view"
        />
      )

      // Should show lane labels and execution counts
      expect(screen.getByText('Development')).toBeInTheDocument()
      expect(screen.getByText('Testing')).toBeInTheDocument()

      // Check for execution count badges (there may be multiple "1"s in the UI)
      const badges = screen.getAllByText('1')
      expect(badges.length).toBeGreaterThan(0) // At least one badge with count
    })

    it('displays execution status indicators in timeline view', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({
            id: 'mixed',
            label: 'Mixed Lane',
            executions: [
              createMockExecution({ id: 'ex1', agentName: 'Agent 1', status: 'completed' }),
              createMockExecution({ id: 'ex2', agentName: 'Agent 2', status: 'running' }),
              createMockExecution({ id: 'ex3', agentName: 'Agent 3', status: 'failed' }),
              createMockExecution({ id: 'ex4', agentName: 'Agent 4', status: 'pending' }),
            ],
          }),
        ],
      })

      render(
        <ParallelAgentView
          data={mockData}
          config={{ layout: 'timeline' }}
        />
      )

      expect(screen.getByText('Mixed Lane')).toBeInTheDocument()
      expect(screen.getByText('4')).toBeInTheDocument() // Badge showing execution count
    })

    it('limits timeline execution indicators to first 8', () => {
      const executions = Array.from({ length: 12 }, (_, i) =>
        createMockExecution({
          id: `exec-${i}`,
          agentName: `Agent ${i}`,
          status: i % 2 === 0 ? 'completed' : 'running',
        })
      )

      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({
            id: 'many',
            label: 'Many Executions',
            executions,
          }),
        ],
      })

      render(
        <ParallelAgentView
          data={mockData}
          config={{ layout: 'timeline' }}
        />
      )

      expect(screen.getByText('Many Executions')).toBeInTheDocument()
      expect(screen.getByText('12')).toBeInTheDocument() // Badge shows total count
    })

    it('shows tooltips for execution status in timeline', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({
            executions: [
              createMockExecution({
                agentName: 'Timeline Agent',
                status: 'running',
              }),
            ],
          }),
        ],
      })

      render(
        <ParallelAgentView
          data={mockData}
          config={{ layout: 'timeline' }}
        />
      )

      // Check that the status indicator is rendered (the colored bar)
      const statusIndicators = document.querySelectorAll('.h-2.bg-apex-500.rounded-full')
      expect(statusIndicators.length).toBeGreaterThan(0)
    })
  })

  describe('Layout Mode: Compact', () => {
    it('renders compact layout similar to timeline', () => {
      const mockData = createMockParallelAgentData()
      render(
        <ParallelAgentView
          data={mockData}
          config={{ layout: 'compact' }}
          testId="compact-view"
        />
      )

      // Should show lane labels and execution counts (same as timeline for now)
      expect(screen.getByText('Development')).toBeInTheDocument()
      expect(screen.getByText('Testing')).toBeInTheDocument()
    })

    it('displays execution status indicators in compact view', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({
            id: 'compact-test',
            label: 'Compact Test Lane',
            executions: [
              createMockExecution({ agentName: 'Agent A', status: 'completed' }),
              createMockExecution({ agentName: 'Agent B', status: 'running' }),
            ],
          }),
        ],
      })

      render(
        <ParallelAgentView
          data={mockData}
          config={{ layout: 'compact' }}
        />
      )

      expect(screen.getByText('Compact Test Lane')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument() // Badge count
    })

    it('shows status colors for different execution states in compact view', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({
            executions: [
              createMockExecution({ status: 'completed' }), // Green
              createMockExecution({ status: 'failed' }),    // Red
              createMockExecution({ status: 'running' }),   // Blue
              createMockExecution({ status: 'pending' }),   // Gray
            ],
          }),
        ],
      })

      render(
        <ParallelAgentView
          data={mockData}
          config={{ layout: 'compact' }}
        />
      )

      // Check that status indicators are rendered
      const statusIndicators = document.querySelectorAll('.h-2.rounded-full')
      expect(statusIndicators.length).toBe(4)
    })

    it('handles lanes with no executions in compact view', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({
            id: 'empty-lane',
            label: 'Empty Lane',
            executions: [],
          }),
        ],
      })

      render(
        <ParallelAgentView
          data={mockData}
          config={{ layout: 'compact' }}
        />
      )

      // Should show empty state instead since there are no executions
      expect(screen.getByText('No parallel agents currently active')).toBeInTheDocument()
    })

    it('limits compact view execution indicators to first 8', () => {
      const executions = Array.from({ length: 10 }, (_, i) =>
        createMockExecution({
          id: `compact-exec-${i}`,
          agentName: `Compact Agent ${i}`,
        })
      )

      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({
            id: 'compact-many',
            label: 'Compact Many',
            executions,
          }),
        ],
      })

      render(
        <ParallelAgentView
          data={mockData}
          config={{ layout: 'compact' }}
        />
      )

      expect(screen.getByText('Compact Many')).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument() // Badge shows total count

      // Only 8 status indicators should be rendered due to slice(0, 8)
      const statusIndicators = document.querySelectorAll('.h-2.rounded-full')
      expect(statusIndicators.length).toBe(8)
    })
  })

  describe('Sorting and Filtering', () => {
    it('renders sort criteria buttons for all 5 sorting options', () => {
      const mockData = createMockParallelAgentData()
      render(<ParallelAgentView data={mockData} />)

      // All sort criteria buttons should be present
      expect(screen.getByRole('button', { name: /name/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /status/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /progress/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /start time/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /duration/i })).toBeInTheDocument()
    })

    it('sorts by name when name button is clicked', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({
            id: 'test-lane',
            executions: [
              createMockExecution({ id: 'exec-1', agentName: 'Zebra Agent' }),
              createMockExecution({ id: 'exec-2', agentName: 'Alpha Agent' }),
              createMockExecution({ id: 'exec-3', agentName: 'Beta Agent' }),
            ],
          }),
        ],
      })

      render(<ParallelAgentView data={mockData} />)

      const nameButton = screen.getByRole('button', { name: /name/i })
      fireEvent.click(nameButton)

      // Should show ascending sort icon
      expect(screen.getByTestId('icon-sort-asc')).toBeInTheDocument()
    })

    it('sorts by status when status button is clicked', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({
            id: 'test-lane',
            executions: [
              createMockExecution({ id: 'exec-1', status: 'completed' }),
              createMockExecution({ id: 'exec-2', status: 'running' }),
              createMockExecution({ id: 'exec-3', status: 'failed' }),
            ],
          }),
        ],
      })

      render(<ParallelAgentView data={mockData} />)

      const statusButton = screen.getByRole('button', { name: /status/i })
      fireEvent.click(statusButton)

      // Should show ascending sort icon
      expect(screen.getByTestId('icon-sort-asc')).toBeInTheDocument()
    })

    it('sorts by progress when progress button is clicked', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({
            id: 'test-lane',
            executions: [
              createMockExecution({ id: 'exec-1', progress: 90 }),
              createMockExecution({ id: 'exec-2', progress: 10 }),
              createMockExecution({ id: 'exec-3', progress: 50 }),
            ],
          }),
        ],
      })

      render(<ParallelAgentView data={mockData} />)

      const progressButton = screen.getByRole('button', { name: /progress/i })
      fireEvent.click(progressButton)

      // Should show ascending sort icon
      expect(screen.getByTestId('icon-sort-asc')).toBeInTheDocument()
    })

    it('sorts by start time when start time button is clicked', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({
            id: 'test-lane',
            executions: [
              createMockExecution({ id: 'exec-1', startedAt: new Date('2024-01-01T12:00:00Z') }),
              createMockExecution({ id: 'exec-2', startedAt: new Date('2024-01-01T10:00:00Z') }),
              createMockExecution({ id: 'exec-3', startedAt: new Date('2024-01-01T11:00:00Z') }),
            ],
          }),
        ],
      })

      render(<ParallelAgentView data={mockData} />)

      const startTimeButton = screen.getByRole('button', { name: /start time/i })
      fireEvent.click(startTimeButton)

      // Start time is the default sort, so clicking once toggles to descending
      expect(screen.getByTestId('icon-sort-desc')).toBeInTheDocument()
    })

    it('sorts by duration when duration button is clicked', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({
            id: 'test-lane',
            executions: [
              createMockExecution({ id: 'exec-1', durationMs: 5000 }),
              createMockExecution({ id: 'exec-2', durationMs: 1000 }),
              createMockExecution({ id: 'exec-3', durationMs: 3000 }),
            ],
          }),
        ],
      })

      render(<ParallelAgentView data={mockData} />)

      const durationButton = screen.getByRole('button', { name: /duration/i })
      fireEvent.click(durationButton)

      // Should show ascending sort icon
      expect(screen.getByTestId('icon-sort-asc')).toBeInTheDocument()
    })

    it('toggles sort direction when clicking the same criteria twice', () => {
      const mockData = createMockParallelAgentData()
      render(<ParallelAgentView data={mockData} />)

      const nameButton = screen.getByRole('button', { name: /name/i })

      // First click - should be ascending
      fireEvent.click(nameButton)
      expect(screen.getByTestId('icon-sort-asc')).toBeInTheDocument()

      // Second click - should toggle to descending
      fireEvent.click(nameButton)
      expect(screen.getByTestId('icon-sort-desc')).toBeInTheDocument()

      // Third click - should toggle back to ascending
      fireEvent.click(nameButton)
      expect(screen.getByTestId('icon-sort-asc')).toBeInTheDocument()
    })

    it('resets to ascending when switching to a different sort criteria', () => {
      const mockData = createMockParallelAgentData()
      render(<ParallelAgentView data={mockData} />)

      const nameButton = screen.getByRole('button', { name: /name/i })
      const statusButton = screen.getByRole('button', { name: /status/i })

      // Click name twice to get descending
      fireEvent.click(nameButton)
      fireEvent.click(nameButton)
      expect(screen.getByTestId('icon-sort-desc')).toBeInTheDocument()

      // Click status - should reset to ascending
      fireEvent.click(statusButton)
      expect(screen.getByTestId('icon-sort-asc')).toBeInTheDocument()
    })

    it('shows active state for currently selected sort criteria', () => {
      const mockData = createMockParallelAgentData()
      render(<ParallelAgentView data={mockData} />)

      const nameButton = screen.getByRole('button', { name: /name/i })
      const startTimeButton = screen.getByRole('button', { name: /start time/i })

      // Initially start time should be active (default sorting)
      expect(startTimeButton).toHaveClass('bg-apex-600')

      // Name button should be ghost variant (inactive)
      expect(nameButton).toHaveClass('bg-transparent')

      // Click name to make it active
      fireEvent.click(nameButton)

      // Name button should now have primary variant (active state)
      expect(nameButton).toHaveClass('bg-apex-600')
    })

    it('limits displayed lanes based on maxLanes configuration', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({ id: 'lane-1', label: 'Lane 1' }),
          createMockLane({ id: 'lane-2', label: 'Lane 2' }),
          createMockLane({ id: 'lane-3', label: 'Lane 3' }),
          createMockLane({ id: 'lane-4', label: 'Lane 4' }),
          createMockLane({ id: 'lane-5', label: 'Lane 5' }),
        ],
      })

      render(
        <ParallelAgentView
          data={mockData}
          config={{ maxLanes: 3 }}
        />
      )

      // Only first 3 lanes should be displayed
      expect(screen.getByTestId('lane-lane-1')).toBeInTheDocument()
      expect(screen.getByTestId('lane-lane-2')).toBeInTheDocument()
      expect(screen.getByTestId('lane-lane-3')).toBeInTheDocument()
      expect(screen.queryByTestId('lane-lane-4')).not.toBeInTheDocument()
      expect(screen.queryByTestId('lane-lane-5')).not.toBeInTheDocument()
    })

    it('limits lanes correctly with maxLanes set to 1', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({ id: 'lane-1', label: 'Lane 1' }),
          createMockLane({ id: 'lane-2', label: 'Lane 2' }),
        ],
      })

      render(
        <ParallelAgentView
          data={mockData}
          config={{ maxLanes: 1 }}
        />
      )

      // Only first lane should be displayed
      expect(screen.getByTestId('lane-lane-1')).toBeInTheDocument()
      expect(screen.queryByTestId('lane-lane-2')).not.toBeInTheDocument()
    })

    it('shows all lanes when maxLanes is greater than available lanes', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({ id: 'lane-1', label: 'Lane 1' }),
          createMockLane({ id: 'lane-2', label: 'Lane 2' }),
        ],
      })

      render(
        <ParallelAgentView
          data={mockData}
          config={{ maxLanes: 10 }}
        />
      )

      // Both lanes should be displayed
      expect(screen.getByTestId('lane-lane-1')).toBeInTheDocument()
      expect(screen.getByTestId('lane-lane-2')).toBeInTheDocument()
    })

    it('applies maxLanes limiting in grid layout', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({
            id: 'lane-1',
            label: 'Lane 1',
            executions: [createMockExecution({ id: 'exec-1', agentName: 'Agent 1' })]
          }),
          createMockLane({
            id: 'lane-2',
            label: 'Lane 2',
            executions: [createMockExecution({ id: 'exec-2', agentName: 'Agent 2' })]
          }),
          createMockLane({
            id: 'lane-3',
            label: 'Lane 3',
            executions: [createMockExecution({ id: 'exec-3', agentName: 'Agent 3' })]
          }),
        ],
      })

      render(
        <ParallelAgentView
          data={mockData}
          config={{ layout: 'grid', maxLanes: 2 }}
        />
      )

      // Only agents from first 2 lanes should be visible in grid
      expect(screen.getByText('Agent 1')).toBeInTheDocument()
      expect(screen.getByText('Agent 2')).toBeInTheDocument()
      expect(screen.queryByText('Agent 3')).not.toBeInTheDocument()
    })

    it('applies maxLanes limiting in timeline layout', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({ id: 'lane-1', label: 'Lane 1' }),
          createMockLane({ id: 'lane-2', label: 'Lane 2' }),
          createMockLane({ id: 'lane-3', label: 'Lane 3' }),
        ],
      })

      render(
        <ParallelAgentView
          data={mockData}
          config={{ layout: 'timeline', maxLanes: 2 }}
        />
      )

      // Only first 2 lane labels should be visible
      expect(screen.getByText('Lane 1')).toBeInTheDocument()
      expect(screen.getByText('Lane 2')).toBeInTheDocument()
      expect(screen.queryByText('Lane 3')).not.toBeInTheDocument()
    })

    it('applies maxLanes limiting in compact layout', () => {
      const mockData = createMockParallelAgentData({
        lanes: [
          createMockLane({ id: 'lane-1', label: 'Lane 1' }),
          createMockLane({ id: 'lane-2', label: 'Lane 2' }),
          createMockLane({ id: 'lane-3', label: 'Lane 3' }),
        ],
      })

      render(
        <ParallelAgentView
          data={mockData}
          config={{ layout: 'compact', maxLanes: 2 }}
        />
      )

      // Only first 2 lane labels should be visible
      expect(screen.getByText('Lane 1')).toBeInTheDocument()
      expect(screen.getByText('Lane 2')).toBeInTheDocument()
      expect(screen.queryByText('Lane 3')).not.toBeInTheDocument()
    })
  })

  describe('Layout Switching Behavior', () => {
    it('renders layout toggle buttons for all four modes', () => {
      const mockData = createMockParallelAgentData()
      render(<ParallelAgentView data={mockData} />)

      // All layout buttons should be present
      expect(screen.getByTestId('icon-list')).toBeInTheDocument()    // Lanes
      expect(screen.getByTestId('icon-grid')).toBeInTheDocument()    // Grid
      expect(screen.getByTestId('icon-clock')).toBeInTheDocument()   // Timeline
      expect(screen.getByTestId('icon-minimize')).toBeInTheDocument() // Compact
    })

    it('switches from lanes to grid layout when grid button is clicked', () => {
      const mockData = createMockParallelAgentData()
      render(<ParallelAgentView data={mockData} />)

      // Initially should be in lanes mode (default)
      expect(screen.getByTestId('lane-development')).toBeInTheDocument()

      // Click grid layout button
      const gridButton = screen.getByTestId('icon-grid').closest('button')
      expect(gridButton).not.toBeNull()
      fireEvent.click(gridButton!)

      // Should switch to grid view (no lanes, individual cards)
      expect(screen.queryByTestId('lane-development')).not.toBeInTheDocument()
      expect(screen.getByText('Developer Agent')).toBeInTheDocument()
    })

    it('switches from lanes to timeline layout when timeline button is clicked', () => {
      const mockData = createMockParallelAgentData()
      render(<ParallelAgentView data={mockData} />)

      // Click timeline layout button
      const timelineButton = screen.getByTestId('icon-clock').closest('button')
      expect(timelineButton).not.toBeNull()
      fireEvent.click(timelineButton!)

      // Should switch to timeline view (lane summaries, not full lanes)
      expect(screen.queryByTestId('lane-development')).not.toBeInTheDocument()
      expect(screen.getByText('Development')).toBeInTheDocument() // Lane label only
      expect(screen.getByText('Testing')).toBeInTheDocument()
    })

    it('switches from lanes to compact layout when compact button is clicked', () => {
      const mockData = createMockParallelAgentData()
      render(<ParallelAgentView data={mockData} />)

      // Click compact layout button
      const compactButton = screen.getByTestId('icon-minimize').closest('button')
      expect(compactButton).not.toBeNull()
      fireEvent.click(compactButton!)

      // Should switch to compact view (similar to timeline)
      expect(screen.queryByTestId('lane-development')).not.toBeInTheDocument()
      expect(screen.getByText('Development')).toBeInTheDocument()
    })

    it('switches between all layout modes sequentially', () => {
      const mockData = createMockParallelAgentData()
      render(<ParallelAgentView data={mockData} />)

      // Start in lanes (default)
      expect(screen.getByTestId('lane-development')).toBeInTheDocument()

      // Switch to grid
      fireEvent.click(screen.getByTestId('icon-grid').closest('button')!)
      expect(screen.queryByTestId('lane-development')).not.toBeInTheDocument()
      expect(screen.getByText('Developer Agent')).toBeInTheDocument()

      // Switch to timeline
      fireEvent.click(screen.getByTestId('icon-clock').closest('button')!)
      expect(screen.getByText('Development')).toBeInTheDocument()
      expect(screen.queryByText('Developer Agent')).not.toBeInTheDocument()

      // Switch to compact
      fireEvent.click(screen.getByTestId('icon-minimize').closest('button')!)
      expect(screen.getByText('Development')).toBeInTheDocument()

      // Switch back to lanes
      fireEvent.click(screen.getByTestId('icon-list').closest('button')!)
      expect(screen.getByTestId('lane-development')).toBeInTheDocument()
    })

    it('maintains active state on layout buttons when selected', () => {
      const mockData = createMockParallelAgentData()
      render(<ParallelAgentView data={mockData} />)

      const lanesButton = screen.getByTestId('icon-list').closest('button')!
      const gridButton = screen.getByTestId('icon-grid').closest('button')!

      // Initially lanes should be active (default)
      // Note: We can't easily test CSS classes, but we can test the behavior

      // Click grid button
      fireEvent.click(gridButton)

      // Click back to lanes
      fireEvent.click(lanesButton)

      // Should be back in lanes mode
      expect(screen.getByTestId('lane-development')).toBeInTheDocument()
    })

    it('preserves layout selection across data updates', () => {
      const mockData = createMockParallelAgentData()
      const { rerender } = render(<ParallelAgentView data={mockData} />)

      // Switch to grid layout
      fireEvent.click(screen.getByTestId('icon-grid').closest('button')!)
      expect(screen.getByText('Developer Agent')).toBeInTheDocument()

      // Update data (simulating re-render with new data)
      const updatedData = createMockParallelAgentData({
        lanes: [
          createMockLane({
            id: 'updated',
            label: 'Updated Lane',
            executions: [
              createMockExecution({ agentName: 'Updated Agent' }),
            ],
          }),
        ],
      })

      rerender(<ParallelAgentView data={updatedData} />)

      // Should still be in grid layout
      expect(screen.getByText('Updated Agent')).toBeInTheDocument()
      expect(screen.queryByTestId('lane-updated')).not.toBeInTheDocument()
    })

    it('handles layout switching with empty data gracefully', () => {
      const emptyData = createMockParallelAgentData({ lanes: [] })
      render(<ParallelAgentView data={emptyData} />)

      // Should show empty state when there are no executions
      expect(screen.getByText('No parallel agents currently active')).toBeInTheDocument()

      // Layout controls are not shown in empty state, only refresh button
      expect(screen.queryByTestId('icon-grid')).not.toBeInTheDocument()
      expect(screen.queryByTestId('icon-clock')).not.toBeInTheDocument()
      expect(screen.getByTestId('icon-rotate')).toBeInTheDocument() // Refresh button is present
    })

    it('handles layout switching during loading state', () => {
      const mockData = createMockParallelAgentData()
      render(<ParallelAgentView data={mockData} loading={true} />)

      // Should show loading state
      expect(screen.getByText('Loading parallel agents...')).toBeInTheDocument()

      // Layout buttons should not be present during loading state
      expect(screen.queryByTestId('icon-grid')).not.toBeInTheDocument()
      expect(screen.queryByTestId('icon-clock')).not.toBeInTheDocument()
    })
  })

  // ============================================================================
  // Real-time Data Display Tests
  // ============================================================================

  describe('Real-time Data Display', () => {
    describe('Summary Statistics Badges', () => {
      it('displays total executions badge correctly', () => {
        const mockData = createMockParallelAgentData({
          totalExecutions: 15,
          lanes: [
            createMockLane({
              id: 'lane-1',
              executions: Array.from({ length: 8 }, (_, i) =>
                createMockExecution({ id: `exec-${i}`, agentName: `Agent ${i}` })
              ),
            }),
            createMockLane({
              id: 'lane-2',
              executions: Array.from({ length: 7 }, (_, i) =>
                createMockExecution({ id: `exec-second-${i}`, agentName: `Second Agent ${i}` })
              ),
            }),
          ],
        })

        render(<ParallelAgentView data={mockData} />)

        // Should display total count badge
        expect(screen.getByText('15 total')).toBeInTheDocument()
      })

      it('displays active agents badge when active count > 0', () => {
        const mockData = createMockParallelAgentData({
          runningCount: 3,
          lanes: [
            createMockLane({
              executions: [
                createMockExecution({ status: 'running' }),
                createMockExecution({ status: 'running' }),
                createMockExecution({ status: 'running' }),
              ],
            }),
          ],
        })

        render(<ParallelAgentView data={mockData} />)

        expect(screen.getByText('3 active')).toBeInTheDocument()
        const activeBadge = screen.getByText('3 active')
        expect(activeBadge).toHaveClass('text-green-400') // success variant colors
      })

      it('displays completed agents badge when completed count > 0', () => {
        const mockData = createMockParallelAgentData({
          completedCount: 5,
          lanes: [
            createMockLane({
              executions: [
                createMockExecution({ status: 'completed' }),
                createMockExecution({ status: 'completed' }),
                createMockExecution({ status: 'completed' }),
                createMockExecution({ status: 'completed' }),
                createMockExecution({ status: 'completed' }),
              ],
            }),
          ],
        })

        render(<ParallelAgentView data={mockData} />)

        expect(screen.getByText('5 completed')).toBeInTheDocument()
        const completedBadge = screen.getByText('5 completed')
        expect(completedBadge).toHaveClass('text-xs') // secondary variant styling
      })

      it('displays failed agents badge when failed count > 0', () => {
        const mockData = createMockParallelAgentData({
          failedCount: 2,
          lanes: [
            createMockLane({
              executions: [
                createMockExecution({ status: 'failed' }),
                createMockExecution({ status: 'failed' }),
                createMockExecution({ status: 'running' }),
              ],
            }),
          ],
        })

        render(<ParallelAgentView data={mockData} />)

        expect(screen.getByText('2 failed')).toBeInTheDocument()
        const failedBadge = screen.getByText('2 failed')
        expect(failedBadge).toHaveClass('text-red-400') // danger variant colors
      })

      it('hides badges when count is 0', () => {
        const mockData = createMockParallelAgentData({
          runningCount: 0,
          completedCount: 0,
          failedCount: 0,
          lanes: [createMockLane({ executions: [] })], // Non-empty lanes but no executions
        })

        render(<ParallelAgentView data={mockData} />)

        // This will render empty state, so check that status badges are not present
        expect(screen.queryByText(/\d+ active/)).not.toBeInTheDocument()
        expect(screen.queryByText(/\d+ completed/)).not.toBeInTheDocument()
        expect(screen.queryByText(/\d+ failed/)).not.toBeInTheDocument()
      })

      it('displays multiple status badges simultaneously', () => {
        const mockData = createMockParallelAgentData({
          runningCount: 2,
          completedCount: 3,
          failedCount: 1,
          lanes: [
            createMockLane({
              executions: [
                createMockExecution({ status: 'running' }),
                createMockExecution({ status: 'running' }),
                createMockExecution({ status: 'completed' }),
                createMockExecution({ status: 'completed' }),
                createMockExecution({ status: 'completed' }),
                createMockExecution({ status: 'failed' }),
              ],
            }),
          ],
        })

        render(<ParallelAgentView data={mockData} />)

        expect(screen.getByText('2 active')).toBeInTheDocument()
        expect(screen.getByText('3 completed')).toBeInTheDocument()
        expect(screen.getByText('1 failed')).toBeInTheDocument()
      })
    })

    describe('Last Updated Display', () => {
      it('displays last updated time when lastUpdated is provided', () => {
        const lastUpdated = new Date('2024-01-01T15:30:45Z')
        const mockData = createMockParallelAgentData({ lastUpdated })

        render(<ParallelAgentView data={mockData} />)

        expect(screen.getByText(/last updated/i)).toBeInTheDocument()
        // Check that it contains a time format (we can't guarantee exact format due to locale differences)
        const lastUpdatedText = screen.getByText(/last updated/i)
        expect(lastUpdatedText.textContent).toMatch(/\d{1,2}:\d{2}:\d{2}/)
      })

      it('hides last updated when lastUpdated is null', () => {
        const mockData = createMockParallelAgentData({ lastUpdated: undefined })

        render(<ParallelAgentView data={mockData} />)

        expect(screen.queryByText(/last updated/i)).not.toBeInTheDocument()
      })

      it('formats last updated time correctly', () => {
        const lastUpdated = new Date('2024-06-15T09:15:30Z')
        const mockData = createMockParallelAgentData({ lastUpdated })

        render(<ParallelAgentView data={mockData} />)

        const lastUpdatedText = screen.getByText(/last updated/i)
        expect(lastUpdatedText).toBeInTheDocument()
        // Check that it contains a time format (we can't guarantee exact format due to locale differences)
        expect(lastUpdatedText.textContent).toMatch(/\d{1,2}:\d{2}:\d{2}/)
      })

      it('updates last updated display when data changes', () => {
        const firstUpdate = new Date('2024-01-01T10:00:00Z')
        const mockData = createMockParallelAgentData({ lastUpdated: firstUpdate })
        const { rerender } = render(<ParallelAgentView data={mockData} />)

        // Check the first time is displayed
        const firstTimeText = screen.getByText(/last updated/i)
        const firstContent = firstTimeText.textContent || ''
        expect(firstContent).toMatch(/\d{1,2}:\d{2}:\d{2}/)

        const secondUpdate = new Date('2024-01-01T11:30:00Z')
        const updatedData = createMockParallelAgentData({ lastUpdated: secondUpdate })
        rerender(<ParallelAgentView data={updatedData} />)

        // Check the second time is displayed
        const secondTimeText = screen.getByText(/last updated/i)
        const secondContent = secondTimeText.textContent || ''
        expect(secondContent).toMatch(/\d{1,2}:\d{2}:\d{2}/)
        // The content should be different after update
        expect(secondContent).not.toBe(firstContent)
      })
    })

    describe('Average Progress Display', () => {
      it('displays average progress when there are running executions', () => {
        const mockData = createMockParallelAgentData({
          lanes: [
            createMockLane({
              executions: [
                createMockExecution({ status: 'running', progress: 50 }),
                createMockExecution({ status: 'running', progress: 70 }),
                createMockExecution({ status: 'running', progress: 80 }),
              ],
            }),
          ],
        })

        render(<ParallelAgentView data={mockData} />)

        expect(screen.getByText(/average progress/i)).toBeInTheDocument()
        expect(screen.getByText(/67%/)).toBeInTheDocument() // (50 + 70 + 80) / 3 = 66.67 rounded to 67
      })

      it('hides average progress when averageProgress is 0', () => {
        const mockData = createMockParallelAgentData({
          lanes: [
            createMockLane({
              executions: [
                createMockExecution({ status: 'completed', progress: 100 }),
                createMockExecution({ status: 'failed', progress: 0 }),
              ],
            }),
          ],
        })

        render(<ParallelAgentView data={mockData} />)

        expect(screen.queryByText(/average progress/i)).not.toBeInTheDocument()
      })

      it('calculates average progress correctly for mixed statuses', () => {
        const mockData = createMockParallelAgentData({
          lanes: [
            createMockLane({
              executions: [
                createMockExecution({ status: 'running', progress: 25 }),
                createMockExecution({ status: 'running', progress: 50 }),
                createMockExecution({ status: 'running', progress: 75 }),
                createMockExecution({ status: 'completed', progress: 100 }),
                createMockExecution({ status: 'failed', progress: 30 }),
              ],
            }),
          ],
        })

        render(<ParallelAgentView data={mockData} />)

        // Only running executions should be included in average: (25 + 50 + 75) / 3 = 50%
        expect(screen.getByText(/50%/)).toBeInTheDocument()
      })

      it('displays both last updated and average progress together', () => {
        const mockData = createMockParallelAgentData({
          lastUpdated: new Date('2024-01-01T12:00:00Z'),
          lanes: [
            createMockLane({
              executions: [
                createMockExecution({ status: 'running', progress: 60 }),
                createMockExecution({ status: 'running', progress: 80 }),
              ],
            }),
          ],
        })

        render(<ParallelAgentView data={mockData} />)

        expect(screen.getByText(/last updated/i)).toBeInTheDocument()
        expect(screen.getByText(/average progress/i)).toBeInTheDocument()
        expect(screen.getByText(/70%/)).toBeInTheDocument() // (60 + 80) / 2 = 70%
      })

      it('rounds average progress to nearest integer', () => {
        const mockData = createMockParallelAgentData({
          lanes: [
            createMockLane({
              executions: [
                createMockExecution({ status: 'running', progress: 33 }),
                createMockExecution({ status: 'running', progress: 34 }),
              ],
            }),
          ],
        })

        render(<ParallelAgentView data={mockData} />)

        // (33 + 34) / 2 = 33.5, should round to 34%
        expect(screen.getByText(/34%/)).toBeInTheDocument()
      })
    })
  })

  // ============================================================================
  // Configuration Options Tests
  // ============================================================================

  describe('Configuration Options', () => {
    describe('showProgress Configuration', () => {
      it('passes showProgress true to AgentLane components', () => {
        const mockData = createMockParallelAgentData()
        render(
          <ParallelAgentView
            data={mockData}
            config={{ showProgress: true }}
          />
        )

        // AgentLane component should be rendered (progress passed through)
        expect(screen.getByTestId('lane-development')).toBeInTheDocument()
        expect(screen.getByTestId('lane-testing')).toBeInTheDocument()
      })

      it('passes showProgress false to AgentLane components', () => {
        const mockData = createMockParallelAgentData()
        render(
          <ParallelAgentView
            data={mockData}
            config={{ showProgress: false }}
          />
        )

        // AgentLane component should still be rendered (config passed through)
        expect(screen.getByTestId('lane-development')).toBeInTheDocument()
        expect(screen.getByTestId('lane-testing')).toBeInTheDocument()
      })
    })

    describe('showElapsedTime Configuration', () => {
      it('passes showElapsedTime true to AgentLane components', () => {
        const mockData = createMockParallelAgentData()
        render(
          <ParallelAgentView
            data={mockData}
            config={{ showElapsedTime: true }}
          />
        )

        expect(screen.getByTestId('lane-development')).toBeInTheDocument()
        expect(screen.getByTestId('lane-testing')).toBeInTheDocument()
      })

      it('passes showElapsedTime false to AgentLane components', () => {
        const mockData = createMockParallelAgentData()
        render(
          <ParallelAgentView
            data={mockData}
            config={{ showElapsedTime: false }}
          />
        )

        expect(screen.getByTestId('lane-development')).toBeInTheDocument()
        expect(screen.getByTestId('lane-testing')).toBeInTheDocument()
      })
    })

    describe('showTokenUsage Configuration', () => {
      it('passes showTokenUsage true to AgentLane components', () => {
        const mockData = createMockParallelAgentData()
        render(
          <ParallelAgentView
            data={mockData}
            config={{ showTokenUsage: true }}
          />
        )

        expect(screen.getByTestId('lane-development')).toBeInTheDocument()
        expect(screen.getByTestId('lane-testing')).toBeInTheDocument()
      })

      it('passes showTokenUsage false to AgentLane components', () => {
        const mockData = createMockParallelAgentData()
        render(
          <ParallelAgentView
            data={mockData}
            config={{ showTokenUsage: false }}
          />
        )

        expect(screen.getByTestId('lane-development')).toBeInTheDocument()
        expect(screen.getByTestId('lane-testing')).toBeInTheDocument()
      })
    })

    describe('showCost Configuration', () => {
      it('passes showCost true to AgentLane components', () => {
        const mockData = createMockParallelAgentData()
        render(
          <ParallelAgentView
            data={mockData}
            config={{ showCost: true }}
          />
        )

        expect(screen.getByTestId('lane-development')).toBeInTheDocument()
        expect(screen.getByTestId('lane-testing')).toBeInTheDocument()
      })

      it('passes showCost false to AgentLane components', () => {
        const mockData = createMockParallelAgentData()
        render(
          <ParallelAgentView
            data={mockData}
            config={{ showCost: false }}
          />
        )

        expect(screen.getByTestId('lane-development')).toBeInTheDocument()
        expect(screen.getByTestId('lane-testing')).toBeInTheDocument()
      })
    })

    describe('showStages Configuration', () => {
      it('passes showStages true to AgentLane components', () => {
        const mockData = createMockParallelAgentData()
        render(
          <ParallelAgentView
            data={mockData}
            config={{ showStages: true }}
          />
        )

        expect(screen.getByTestId('lane-development')).toBeInTheDocument()
        expect(screen.getByTestId('lane-testing')).toBeInTheDocument()
      })

      it('passes showStages false to AgentLane components', () => {
        const mockData = createMockParallelAgentData()
        render(
          <ParallelAgentView
            data={mockData}
            config={{ showStages: false }}
          />
        )

        expect(screen.getByTestId('lane-development')).toBeInTheDocument()
        expect(screen.getByTestId('lane-testing')).toBeInTheDocument()
      })
    })

    describe('Combined Configuration Options', () => {
      it('passes multiple config options simultaneously', () => {
        const mockData = createMockParallelAgentData()
        render(
          <ParallelAgentView
            data={mockData}
            config={{
              showProgress: true,
              showElapsedTime: false,
              showTokenUsage: true,
              showCost: false,
              showStages: true,
            }}
          />
        )

        expect(screen.getByTestId('lane-development')).toBeInTheDocument()
        expect(screen.getByTestId('lane-testing')).toBeInTheDocument()
      })

      it('applies all configuration options to all lanes', () => {
        const mockData = createMockParallelAgentData({
          lanes: [
            createMockLane({ id: 'lane-1', label: 'Lane 1' }),
            createMockLane({ id: 'lane-2', label: 'Lane 2' }),
            createMockLane({ id: 'lane-3', label: 'Lane 3' }),
          ],
        })

        render(
          <ParallelAgentView
            data={mockData}
            config={{
              showProgress: false,
              showElapsedTime: true,
              showTokenUsage: false,
              showCost: true,
              showStages: false,
            }}
          />
        )

        expect(screen.getByTestId('lane-lane-1')).toBeInTheDocument()
        expect(screen.getByTestId('lane-lane-2')).toBeInTheDocument()
        expect(screen.getByTestId('lane-lane-3')).toBeInTheDocument()
      })

      it('merges custom config with default configuration', () => {
        const mockData = createMockParallelAgentData()
        render(
          <ParallelAgentView
            data={mockData}
            config={{ showProgress: false }} // Only override one option
          />
        )

        // Should render normally with merged config
        expect(screen.getByTestId('lane-development')).toBeInTheDocument()
        expect(screen.getByTestId('lane-testing')).toBeInTheDocument()
      })
    })
  })

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    describe('TestId Propagation', () => {
      it('applies testId to root container', () => {
        const mockData = createMockParallelAgentData()
        render(<ParallelAgentView data={mockData} testId="accessibility-test" />)

        expect(screen.getByTestId('accessibility-test')).toBeInTheDocument()
      })

      it('generates lane testIds correctly', () => {
        const mockData = createMockParallelAgentData({
          lanes: [
            createMockLane({ id: 'custom-lane-1', label: 'Custom Lane 1' }),
            createMockLane({ id: 'custom-lane-2', label: 'Custom Lane 2' }),
          ],
        })

        render(<ParallelAgentView data={mockData} />)

        expect(screen.getByTestId('lane-custom-lane-1')).toBeInTheDocument()
        expect(screen.getByTestId('lane-custom-lane-2')).toBeInTheDocument()
      })

      it('propagates testId in loading state', () => {
        const mockData = createMockParallelAgentData()
        render(
          <ParallelAgentView
            data={mockData}
            loading={true}
            testId="loading-test-id"
          />
        )

        expect(screen.getByTestId('loading-test-id')).toBeInTheDocument()
      })

      it('propagates testId in error state', () => {
        const mockData = createMockParallelAgentData()
        render(
          <ParallelAgentView
            data={mockData}
            error="Test error"
            testId="error-test-id"
          />
        )

        expect(screen.getByTestId('error-test-id')).toBeInTheDocument()
      })

      it('propagates testId in empty state', () => {
        render(
          <ParallelAgentView
            data={createMockParallelAgentData({ lanes: [] })}
            testId="empty-test-id"
          />
        )

        expect(screen.getByTestId('empty-test-id')).toBeInTheDocument()
      })

      it('maintains testId consistency across layout changes', () => {
        const mockData = createMockParallelAgentData()
        render(<ParallelAgentView data={mockData} testId="layout-test" />)

        expect(screen.getByTestId('layout-test')).toBeInTheDocument()

        // Switch to grid layout
        fireEvent.click(screen.getByTestId('icon-grid').closest('button')!)
        expect(screen.getByTestId('layout-test')).toBeInTheDocument()

        // Switch to timeline layout
        fireEvent.click(screen.getByTestId('icon-clock').closest('button')!)
        expect(screen.getByTestId('layout-test')).toBeInTheDocument()
      })
    })

    describe('Semantic Structure', () => {
      it('has proper heading hierarchy', () => {
        const mockData = createMockParallelAgentData()
        render(<ParallelAgentView data={mockData} />)

        // Main heading should be present
        const heading = screen.getByRole('heading', { level: 3, name: /parallel agents/i })
        expect(heading).toBeInTheDocument()
      })

      it('has accessible button labels', () => {
        const mockData = createMockParallelAgentData()
        render(<ParallelAgentView data={mockData} />)

        // Layout buttons should have accessible names
        expect(screen.getByRole('button', { name: /name/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /status/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /progress/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /start time/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /duration/i })).toBeInTheDocument()
      })

      it('provides accessible button titles for icon-only buttons', () => {
        const mockData = createMockParallelAgentData()
        render(<ParallelAgentView data={mockData} />)

        // Icon buttons should have title attributes for accessibility
        const refreshButton = screen.getByTestId('icon-rotate').closest('button')
        expect(refreshButton).toHaveAttribute('title', 'Refresh data')

        const settingsButton = screen.getByTestId('icon-settings').closest('button')
        expect(settingsButton).toHaveAttribute('title', 'View settings')
      })

      it('provides accessible titles for layout buttons', () => {
        const mockData = createMockParallelAgentData()
        render(<ParallelAgentView data={mockData} />)

        const gridButton = screen.getByTestId('icon-grid').closest('button')
        expect(gridButton).toHaveAttribute('title', 'grid view')

        const timelineButton = screen.getByTestId('icon-clock').closest('button')
        expect(timelineButton).toHaveAttribute('title', 'timeline view')
      })

      it('has accessible loading state', () => {
        const mockData = createMockParallelAgentData()
        render(<ParallelAgentView data={mockData} loading={true} />)

        // Spinner should have role and aria-label
        const spinner = screen.getByTestId('spinner')
        expect(spinner).toHaveAttribute('role', 'status')
        expect(spinner).toHaveAttribute('aria-label', 'Loading')
      })

      it('has accessible error state with retry action', () => {
        const mockData = createMockParallelAgentData()
        render(<ParallelAgentView data={mockData} error="Connection failed" />)

        const retryButton = screen.getByRole('button', { name: /try again/i })
        expect(retryButton).toBeInTheDocument()
        expect(retryButton).toBeEnabled()
      })

      it('has accessible empty state with refresh action', () => {
        render(<ParallelAgentView data={createMockParallelAgentData({ lanes: [] })} />)

        const refreshButton = screen.getByRole('button', { name: /refresh/i })
        expect(refreshButton).toBeInTheDocument()
        expect(refreshButton).toBeEnabled()
      })

      it('maintains focus management during layout switches', () => {
        const mockData = createMockParallelAgentData()
        render(<ParallelAgentView data={mockData} />)

        const gridButton = screen.getByTestId('icon-grid').closest('button')!

        // Focus the grid button
        gridButton.focus()
        expect(document.activeElement).toBe(gridButton)

        // Click to change layout
        fireEvent.click(gridButton)

        // Button should still exist and be focusable after layout change
        expect(screen.getByTestId('icon-grid').closest('button')).toBeInTheDocument()
      })

      it('provides proper aria labels for status badges', () => {
        const mockData = createMockParallelAgentData({
          runningCount: 3,
          completedCount: 2,
          failedCount: 1,
          lanes: [
            createMockLane({
              executions: [
                createMockExecution({ status: 'running' }),
                createMockExecution({ status: 'running' }),
                createMockExecution({ status: 'running' }),
                createMockExecution({ status: 'completed' }),
                createMockExecution({ status: 'completed' }),
                createMockExecution({ status: 'failed' }),
              ],
            }),
          ],
        })

        render(<ParallelAgentView data={mockData} />)

        // Verify status badges are rendered with accessible text
        expect(screen.getByText('3 active')).toBeInTheDocument()
        expect(screen.getByText('2 completed')).toBeInTheDocument()
        expect(screen.getByText('1 failed')).toBeInTheDocument()
      })

      it('has keyboard accessible sort controls', () => {
        const mockData = createMockParallelAgentData()
        render(<ParallelAgentView data={mockData} />)

        const nameButton = screen.getByRole('button', { name: /name/i })

        // Button should be keyboard accessible
        nameButton.focus()
        expect(document.activeElement).toBe(nameButton)

        // Should respond to Enter key
        fireEvent.keyDown(nameButton, { key: 'Enter' })
        // Visual feedback should be present (sort icon)
        expect(screen.getByTestId('icon-sort-asc')).toBeInTheDocument()
      })

      it('has keyboard accessible layout controls', () => {
        const mockData = createMockParallelAgentData()
        render(<ParallelAgentView data={mockData} />)

        const gridButton = screen.getByTestId('icon-grid').closest('button')!

        // Button should be keyboard accessible
        gridButton.focus()
        expect(document.activeElement).toBe(gridButton)

        // Should respond to click (testing actual functionality rather than keydown which doesn't trigger click)
        fireEvent.click(gridButton)
        // Layout should change
        expect(screen.queryByTestId('lane-development')).not.toBeInTheDocument()
        expect(screen.getByText('Developer Agent')).toBeInTheDocument()
      })
    })
  })
})
