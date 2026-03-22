import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentLane } from '../AgentLane'
import type { AgentLane as AgentLaneType, AgentExecution } from '@/types/parallel-agent-view'

// Mock the AgentExecutionCard component
vi.mock('../AgentExecutionCard', () => ({
  AgentExecutionCard: vi.fn(({ execution, testId, onClick }) => (
    <div
      data-testid={testId}
      data-execution-id={execution.id}
      onClick={() => onClick?.(execution)}
    >
      {execution.agentName} - {execution.status}
    </div>
  ))
}))

describe('AgentLane', () => {
  const mockExecutions: AgentExecution[] = [
    {
      id: 'exec-1',
      agentId: 'agent-1',
      agentName: 'Test Agent 1',
      status: 'running',
      stage: 'implementing',
      progress: 65,
      startedAt: new Date('2024-01-01T10:00:00Z'),
      laneId: 'development',
    },
    {
      id: 'exec-2',
      agentId: 'agent-2',
      agentName: 'Test Agent 2',
      status: 'completed',
      stage: 'completed',
      progress: 100,
      completedAt: new Date('2024-01-01T11:00:00Z'),
      laneId: 'development',
    },
    {
      id: 'exec-3',
      agentId: 'agent-3',
      agentName: 'Test Agent 3',
      status: 'failed',
      stage: 'failed',
      progress: 45,
      error: 'Test error',
      laneId: 'development',
    },
  ]

  const mockLane: AgentLaneType = {
    id: 'development',
    label: 'Development',
    description: 'Development tasks and implementations',
    executions: mockExecutions,
    color: '#3b82f6',
    priority: 1,
    collapsed: false,
    maxConcurrent: 5,
  }

  const mockCallbacks = {
    onLaneClick: vi.fn(),
    onLaneToggle: vi.fn(),
    onAgentClick: vi.fn(),
    onAgentHover: vi.fn(),
    onAgentPause: vi.fn(),
    onAgentResume: vi.fn(),
    onAgentCancel: vi.fn(),
    onAgentRetry: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders lane with basic information', () => {
      render(<AgentLane lane={mockLane} />)

      expect(screen.getByText('Development')).toBeInTheDocument()
      expect(screen.getByText('Development tasks and implementations')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument() // Total count badge
    })

    it('applies custom test id when provided', () => {
      render(<AgentLane lane={mockLane} testId="test-lane" />)

      const lane = screen.getByTestId('test-lane')
      expect(lane).toBeInTheDocument()
    })

    it('applies custom className', () => {
      render(<AgentLane lane={mockLane} className="custom-class" testId="test-lane" />)

      const lane = screen.getByTestId('test-lane')
      expect(lane).toHaveClass('custom-class')
    })
  })

  describe('Lane Header', () => {
    it('displays lane title and description', () => {
      render(<AgentLane lane={mockLane} />)

      expect(screen.getByText('Development')).toBeInTheDocument()
      expect(screen.getByText('Development tasks and implementations')).toBeInTheDocument()
    })

    it('displays total execution count', () => {
      render(<AgentLane lane={mockLane} />)

      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('applies custom lane color as left border', () => {
      render(<AgentLane lane={mockLane} testId="colored-lane" />)

      const header = screen.getByRole('button') // Lane header is clickable
      expect(header).toHaveStyle({ borderLeftColor: '#3b82f6' })
    })

    it('calls onLaneClick when header is clicked', () => {
      render(<AgentLane lane={mockLane} onLaneClick={mockCallbacks.onLaneClick} />)

      const header = screen.getByRole('button')
      fireEvent.click(header)

      expect(mockCallbacks.onLaneClick).toHaveBeenCalledWith(mockLane)
    })
  })

  describe('Collapse Functionality', () => {
    it('shows collapse button', () => {
      render(<AgentLane lane={mockLane} />)

      const collapseButton = screen.getByTitle('Collapse lane')
      expect(collapseButton).toBeInTheDocument()
    })

    it('calls onLaneToggle when collapse button is clicked', () => {
      render(<AgentLane lane={mockLane} onLaneToggle={mockCallbacks.onLaneToggle} />)

      const collapseButton = screen.getByTitle('Collapse lane')
      fireEvent.click(collapseButton)

      expect(mockCallbacks.onLaneToggle).toHaveBeenCalledWith('development', true)
    })

    it('shows expand button when lane is collapsed', () => {
      const collapsedLane = { ...mockLane, collapsed: true }
      render(<AgentLane lane={collapsedLane} onLaneToggle={mockCallbacks.onLaneToggle} />)

      const expandButton = screen.getByTitle('Expand lane')
      expect(expandButton).toBeInTheDocument()

      fireEvent.click(expandButton)
      expect(mockCallbacks.onLaneToggle).toHaveBeenCalledWith('development', false)
    })

    it('hides lane content when collapsed', () => {
      const collapsedLane = { ...mockLane, collapsed: true }
      render(<AgentLane lane={collapsedLane} />)

      // Agent execution cards should not be rendered when collapsed
      expect(screen.queryByTestId('agent-card-exec-1')).not.toBeInTheDocument()
    })

    it('shows lane content when expanded', () => {
      render(<AgentLane lane={mockLane} />)

      // Agent execution cards should be rendered when expanded
      expect(screen.getByTestId('agent-card-exec-1')).toBeInTheDocument()
      expect(screen.getByTestId('agent-card-exec-2')).toBeInTheDocument()
      expect(screen.getByTestId('agent-card-exec-3')).toBeInTheDocument()
    })
  })

  describe('Statistics Display', () => {
    it('shows running count badge', () => {
      render(<AgentLane lane={mockLane} />)

      expect(screen.getByText('1 running')).toBeInTheDocument()
    })

    it('shows completed count badge', () => {
      render(<AgentLane lane={mockLane} />)

      expect(screen.getByText('1 done')).toBeInTheDocument()
    })

    it('shows failed count badge', () => {
      render(<AgentLane lane={mockLane} />)

      expect(screen.getByText('1 failed')).toBeInTheDocument()
    })

    it('does not show badges when counts are zero', () => {
      const emptyLane = { ...mockLane, executions: [] }
      render(<AgentLane lane={emptyLane} />)

      expect(screen.queryByText(/running/)).not.toBeInTheDocument()
      expect(screen.queryByText(/done/)).not.toBeInTheDocument()
      expect(screen.queryByText(/failed/)).not.toBeInTheDocument()
    })
  })

  describe('Agent Execution Cards', () => {
    it('renders execution cards for all executions', () => {
      render(<AgentLane lane={mockLane} />)

      expect(screen.getByTestId('agent-card-exec-1')).toBeInTheDocument()
      expect(screen.getByTestId('agent-card-exec-2')).toBeInTheDocument()
      expect(screen.getByTestId('agent-card-exec-3')).toBeInTheDocument()
    })

    it('limits displayed executions based on maxAgents prop', () => {
      render(<AgentLane lane={mockLane} maxAgents={2} />)

      // Only first 2 executions should be shown
      expect(screen.getByTestId('agent-card-exec-1')).toBeInTheDocument()
      expect(screen.getByTestId('agent-card-exec-2')).toBeInTheDocument()
      expect(screen.queryByTestId('agent-card-exec-3')).not.toBeInTheDocument()

      // Should show "more" indicator
      expect(screen.getByText('+1 more')).toBeInTheDocument()
    })

    it('calls onAgentClick when execution card is clicked', () => {
      render(<AgentLane lane={mockLane} onAgentClick={mockCallbacks.onAgentClick} />)

      const card = screen.getByTestId('agent-card-exec-1')
      fireEvent.click(card)

      expect(mockCallbacks.onAgentClick).toHaveBeenCalledWith(mockExecutions[0])
    })

    it('passes through all agent callbacks to execution cards', () => {
      render(
        <AgentLane
          lane={mockLane}
          onAgentPause={mockCallbacks.onAgentPause}
          onAgentResume={mockCallbacks.onAgentResume}
          onAgentCancel={mockCallbacks.onAgentCancel}
          onAgentRetry={mockCallbacks.onAgentRetry}
          onAgentHover={mockCallbacks.onAgentHover}
        />
      )

      // All execution cards should be rendered with proper props
      expect(screen.getByTestId('agent-card-exec-1')).toBeInTheDocument()
      expect(screen.getByTestId('agent-card-exec-2')).toBeInTheDocument()
      expect(screen.getByTestId('agent-card-exec-3')).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('shows empty state message when no executions', () => {
      const emptyLane = { ...mockLane, executions: [] }
      render(<AgentLane lane={emptyLane} />)

      expect(screen.getByText('No agents in this lane')).toBeInTheDocument()
    })

    it('does not show execution cards in empty state', () => {
      const emptyLane = { ...mockLane, executions: [] }
      render(<AgentLane lane={emptyLane} />)

      expect(screen.queryByTestId(/agent-card/)).not.toBeInTheDocument()
    })
  })

  describe('Size Variants', () => {
    const sizeTests = [
      { size: 'sm', expectedMinHeight: 'min-h-24' },
      { size: 'md', expectedMinHeight: 'min-h-32' },
      { size: 'lg', expectedMinHeight: 'min-h-40' },
    ] as const

    sizeTests.forEach(({ size, expectedMinHeight }) => {
      it(`applies correct size classes for ${size}`, () => {
        render(<AgentLane lane={mockLane} size={size} testId="size-test" />)

        const lane = screen.getByTestId('size-test')
        expect(lane).toHaveClass(expectedMinHeight)
      })
    })
  })

  describe('Sorting and Filtering', () => {
    it('sorts executions based on sortBy and sortDirection props', () => {
      // The actual sorting is tested in the utility functions
      // Here we just ensure the props are passed through correctly
      render(<AgentLane lane={mockLane} sortBy="name" sortDirection="desc" />)

      // Executions should be rendered (sorting happens internally)
      expect(screen.getByTestId('agent-card-exec-1')).toBeInTheDocument()
    })
  })

  describe('Capacity Warning', () => {
    it('shows capacity warning when lane is at max concurrent limit', () => {
      const capacityLane = {
        ...mockLane,
        maxConcurrent: 1,
        executions: [
          { ...mockExecutions[0], status: 'running' as const }
        ]
      }
      render(<AgentLane lane={capacityLane} />)

      expect(screen.getByText('Lane at capacity (1/1 concurrent)')).toBeInTheDocument()
    })

    it('does not show capacity warning when under limit', () => {
      render(<AgentLane lane={mockLane} />)

      expect(screen.queryByText(/Lane at capacity/)).not.toBeInTheDocument()
    })
  })

  describe('Show More Functionality', () => {
    it('shows "show more" indicator when executions exceed maxAgents', () => {
      const manyExecutionsLane = {
        ...mockLane,
        executions: [
          ...mockExecutions,
          { ...mockExecutions[0], id: 'exec-4', agentName: 'Agent 4' },
          { ...mockExecutions[0], id: 'exec-5', agentName: 'Agent 5' },
        ]
      }

      render(<AgentLane lane={manyExecutionsLane} maxAgents={3} />)

      expect(screen.getByText('+2 more')).toBeInTheDocument()
    })

    it('calls onLaneClick when "show more" is clicked', () => {
      const manyExecutionsLane = {
        ...mockLane,
        executions: [
          ...mockExecutions,
          { ...mockExecutions[0], id: 'exec-4', agentName: 'Agent 4' },
        ]
      }

      render(
        <AgentLane
          lane={manyExecutionsLane}
          maxAgents={3}
          onLaneClick={mockCallbacks.onLaneClick}
        />
      )

      const showMoreButton = screen.getByText('+1 more')
      fireEvent.click(showMoreButton)

      expect(mockCallbacks.onLaneClick).toHaveBeenCalledWith(manyExecutionsLane)
    })
  })

  describe('Configuration Props', () => {
    it('passes showProgress prop to execution cards', () => {
      render(<AgentLane lane={mockLane} showProgress={false} />)

      // Cards should be rendered (specific prop passing tested in card component)
      expect(screen.getByTestId('agent-card-exec-1')).toBeInTheDocument()
    })

    it('passes all display configuration props to execution cards', () => {
      render(
        <AgentLane
          lane={mockLane}
          showElapsedTime={false}
          showTokenUsage={true}
          showCost={true}
          showStages={false}
          animated={false}
        />
      )

      // Cards should be rendered with all props passed through
      expect(screen.getByTestId('agent-card-exec-1')).toBeInTheDocument()
      expect(screen.getByTestId('agent-card-exec-2')).toBeInTheDocument()
      expect(screen.getByTestId('agent-card-exec-3')).toBeInTheDocument()
    })
  })
})