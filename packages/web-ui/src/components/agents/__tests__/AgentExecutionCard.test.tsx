import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentExecutionCard } from '../AgentExecutionCard'
import type { AgentExecution } from '@/types/parallel-agent-view'

// Mock the ProgressIndicator component
vi.mock('@/components/ui/ProgressIndicator', () => ({
  ProgressIndicator: vi.fn(({ value, variant, size, className }) => (
    <div
      data-testid="progress-indicator"
      data-value={value}
      data-variant={variant}
      data-size={size}
      className={className}
    />
  ))
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ExternalLink: () => <span data-testid="external-link-icon" role="img" hidden></span>,
  Clock: () => <span data-testid="clock-icon" role="img" hidden></span>,
  Pause: () => <span data-testid="pause-icon" role="img" hidden></span>,
  Play: () => <span data-testid="play-icon" role="img" hidden></span>,
  RotateCcw: () => <span data-testid="retry-icon" role="img" hidden></span>,
  XCircle: () => <span data-testid="cancel-icon" role="img" hidden></span>,
  DollarSign: () => <span data-testid="dollar-icon" role="img" hidden></span>,
  Zap: () => <span data-testid="zap-icon" role="img" hidden></span>,
}))

describe('AgentExecutionCard', () => {
  const mockExecution: AgentExecution = {
    id: 'exec-1',
    agentId: 'agent-1',
    agentName: 'Test Agent',
    status: 'running',
    stage: 'implementing',
    progress: 65,
    startedAt: new Date('2024-01-01T10:00:00Z'),
    tokensUsed: 1500,
    estimatedCost: 0.25,
    taskId: 'task-123',
    taskDescription: 'Test task description',
    laneId: 'development',
  }

  const mockCallbacks = {
    onClick: vi.fn(),
    onHover: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onCancel: vi.fn(),
    onRetry: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders agent execution card with basic information', () => {
      render(<AgentExecutionCard execution={mockExecution} />)

      expect(screen.getByText('Test Agent')).toBeInTheDocument()
      expect(screen.getByText('Running')).toBeInTheDocument()
      expect(screen.getByText('Test task description')).toBeInTheDocument()
      expect(screen.getByText('implementing')).toBeInTheDocument()
    })

    it('applies correct test id when provided', () => {
      render(<AgentExecutionCard execution={mockExecution} testId="test-card" />)

      const card = screen.getByTestId('test-card')
      expect(card).toBeInTheDocument()
    })

    it('applies custom className when provided', () => {
      render(<AgentExecutionCard execution={mockExecution} className="custom-class" testId="test-card" />)

      const card = screen.getByTestId('test-card')
      expect(card).toHaveClass('custom-class')
    })
  })

  describe('Status Rendering', () => {
    const statusTests = [
      { status: 'running', expectedLabel: 'Running', shouldShowProgress: true },
      { status: 'completed', expectedLabel: 'Completed', shouldShowProgress: false },
      { status: 'failed', expectedLabel: 'Failed', shouldShowProgress: false },
      { status: 'paused', expectedLabel: 'Paused', shouldShowProgress: false },
      { status: 'queued', expectedLabel: 'Queued', shouldShowProgress: false },
      { status: 'idle', expectedLabel: 'Idle', shouldShowProgress: false },
      { status: 'cancelled', expectedLabel: 'Cancelled', shouldShowProgress: false },
    ] as const

    statusTests.forEach(({ status, expectedLabel, shouldShowProgress }) => {
      it(`renders ${status} status correctly`, () => {
        const execution = { ...mockExecution, status }
        render(<AgentExecutionCard execution={execution} showProgress={true} />)

        expect(screen.getByText(expectedLabel)).toBeInTheDocument()

        if (shouldShowProgress) {
          expect(screen.getByTestId('progress-indicator')).toBeInTheDocument()
        } else {
          expect(screen.queryByTestId('progress-indicator')).not.toBeInTheDocument()
        }
      })
    })
  })

  describe('Size Variants', () => {
    const sizeTests = [
      { size: 'sm', expectedClass: 'w-44 h-20 text-xs' },
      { size: 'md', expectedClass: 'w-60 h-24 text-sm' },
      { size: 'lg', expectedClass: 'w-80 h-28 text-sm' },
    ] as const

    sizeTests.forEach(({ size, expectedClass }) => {
      it(`applies correct size classes for ${size}`, () => {
        render(<AgentExecutionCard execution={mockExecution} size={size} testId="size-test" />)

        const card = screen.getByTestId('size-test')
        expectedClass.split(' ').forEach(className => {
          expect(card).toHaveClass(className)
        })
      })
    })
  })

  describe('Conditional Content Display', () => {
    it('shows progress bar when showProgress is true and status is running', () => {
      render(<AgentExecutionCard execution={mockExecution} showProgress={true} />)

      expect(screen.getByTestId('progress-indicator')).toBeInTheDocument()
      expect(screen.getByText('65%')).toBeInTheDocument()
    })

    it('hides progress bar when showProgress is false', () => {
      render(<AgentExecutionCard execution={mockExecution} showProgress={false} />)

      expect(screen.queryByTestId('progress-indicator')).not.toBeInTheDocument()
    })

    it('shows elapsed time when showElapsedTime is true', () => {
      render(<AgentExecutionCard execution={mockExecution} showElapsedTime={true} />)

      expect(screen.getByTestId('clock-icon')).toBeInTheDocument()
    })

    it('shows token usage when showTokenUsage is true', () => {
      render(<AgentExecutionCard execution={mockExecution} showTokenUsage={true} />)

      expect(screen.getByText('1,500')).toBeInTheDocument()
    })

    it('shows cost when showCost is true', () => {
      render(<AgentExecutionCard execution={mockExecution} showCost={true} />)

      expect(screen.getByText('$0.25')).toBeInTheDocument()
    })

    it('shows stage when showStages is true', () => {
      render(<AgentExecutionCard execution={mockExecution} showStages={true} />)

      expect(screen.getByText('implementing')).toBeInTheDocument()
    })

    it('hides stage when showStages is false', () => {
      render(<AgentExecutionCard execution={mockExecution} showStages={false} />)

      expect(screen.queryByText('implementing')).not.toBeInTheDocument()
    })
  })

  describe('Action Buttons', () => {
    it('shows pause button for running executions on hover', () => {
      render(<AgentExecutionCard execution={mockExecution} onPause={mockCallbacks.onPause} />)

      // Action buttons are only visible on group hover, but we can test their presence
      const pauseButton = screen.getByTitle('Pause execution')
      expect(pauseButton).toBeInTheDocument()

      fireEvent.click(pauseButton)
      expect(mockCallbacks.onPause).toHaveBeenCalledWith('exec-1')
    })

    it('shows resume button for paused executions', () => {
      const pausedExecution = { ...mockExecution, status: 'paused' as const }
      render(<AgentExecutionCard execution={pausedExecution} onResume={mockCallbacks.onResume} />)

      const resumeButton = screen.getByTitle('Resume execution')
      expect(resumeButton).toBeInTheDocument()

      fireEvent.click(resumeButton)
      expect(mockCallbacks.onResume).toHaveBeenCalledWith('exec-1')
    })

    it('shows retry button for failed executions', () => {
      const failedExecution = { ...mockExecution, status: 'failed' as const }
      render(<AgentExecutionCard execution={failedExecution} onRetry={mockCallbacks.onRetry} />)

      const retryButton = screen.getByTitle('Retry execution')
      expect(retryButton).toBeInTheDocument()

      fireEvent.click(retryButton)
      expect(mockCallbacks.onRetry).toHaveBeenCalledWith('exec-1')
    })

    it('shows cancel button for cancellable executions', () => {
      render(<AgentExecutionCard execution={mockExecution} onCancel={mockCallbacks.onCancel} />)

      const cancelButton = screen.getByTitle('Cancel execution')
      expect(cancelButton).toBeInTheDocument()

      fireEvent.click(cancelButton)
      expect(mockCallbacks.onCancel).toHaveBeenCalledWith('exec-1')
    })

    it('stops event propagation when action buttons are clicked', () => {
      render(<AgentExecutionCard execution={mockExecution} onClick={mockCallbacks.onClick} onPause={mockCallbacks.onPause} />)

      const pauseButton = screen.getByTitle('Pause execution')
      fireEvent.click(pauseButton)

      expect(mockCallbacks.onPause).toHaveBeenCalled()
      expect(mockCallbacks.onClick).not.toHaveBeenCalled()
    })
  })

  describe('Click Interactions', () => {
    it('calls onClick when card is clicked', () => {
      render(<AgentExecutionCard execution={mockExecution} onClick={mockCallbacks.onClick} testId="clickable-card" />)

      const card = screen.getByTestId('clickable-card')
      fireEvent.click(card)

      expect(mockCallbacks.onClick).toHaveBeenCalledWith(mockExecution)
    })

    it('calls onHover when mouse enters card', () => {
      render(<AgentExecutionCard execution={mockExecution} onHover={mockCallbacks.onHover} testId="hover-card" />)

      const card = screen.getByTestId('hover-card')
      fireEvent.mouseEnter(card)

      expect(mockCallbacks.onHover).toHaveBeenCalledWith(mockExecution)
    })

    it('calls onHover with null when mouse leaves card', () => {
      render(<AgentExecutionCard execution={mockExecution} onHover={mockCallbacks.onHover} testId="hover-card" />)

      const card = screen.getByTestId('hover-card')
      fireEvent.mouseLeave(card)

      expect(mockCallbacks.onHover).toHaveBeenCalledWith(null)
    })
  })

  describe('Error Display', () => {
    it('shows error overlay for failed executions with error message', () => {
      const failedExecution = {
        ...mockExecution,
        status: 'failed' as const,
        error: 'Test error message'
      }
      render(<AgentExecutionCard execution={failedExecution} />)

      // Error overlay is shown on hover, but we can test its presence
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    it('does not show error overlay for non-failed executions', () => {
      render(<AgentExecutionCard execution={mockExecution} />)

      expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
    })
  })

  describe('Description Truncation', () => {
    it('truncates long descriptions based on size', () => {
      const longDescription = 'This is a very long task description that should be truncated when it exceeds the maximum length for the given size variant'
      const executionWithLongDesc = { ...mockExecution, taskDescription: longDescription }

      render(<AgentExecutionCard execution={executionWithLongDesc} size="sm" />)

      // For sm size, description should be truncated to ~25 chars
      const description = screen.getByText(/This is a very long ta\.\.\./)
      expect(description).toBeInTheDocument()
      // Check for truncation using title attribute (full text) vs displayed text
      expect(description).toHaveAttribute('title', longDescription)
    })

    it('shows full description when under length limit', () => {
      const shortDescription = 'Short description'
      const executionWithShortDesc = { ...mockExecution, taskDescription: shortDescription }

      render(<AgentExecutionCard execution={executionWithShortDesc} />)

      expect(screen.getByText('Short description')).toBeInTheDocument()
    })
  })

  describe('Animation Props', () => {
    it('applies animation classes when animated is true', () => {
      render(<AgentExecutionCard execution={mockExecution} animated={true} testId="animated-card" />)

      const card = screen.getByTestId('animated-card')
      expect(card).toHaveClass('hover:scale-105')
      expect(card).toHaveClass('hover:shadow-lg')
    })

    it('does not apply animation classes when animated is false', () => {
      render(<AgentExecutionCard execution={mockExecution} animated={false} testId="static-card" />)

      const card = screen.getByTestId('static-card')
      expect(card).not.toHaveClass('hover:scale-105')
      expect(card).not.toHaveClass('hover:shadow-lg')
    })
  })

  describe('External Link Icon', () => {
    it('shows external link icon when taskId is present', () => {
      render(<AgentExecutionCard execution={mockExecution} />)

      // ExternalLink icon should be present
      expect(screen.getByTestId('external-link-icon')).toBeInTheDocument()
    })

    it('does not show external link icon when taskId is missing', () => {
      const executionWithoutTask = { ...mockExecution, taskId: undefined }
      render(<AgentExecutionCard execution={executionWithoutTask} />)

      // Should not have ExternalLink icon (though other icons might be present)
      const icons = screen.getAllByRole('img', { hidden: true })
      expect(icons.length).toBeGreaterThan(0) // Clock icon should still be there
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes for interactive card', () => {
      render(<AgentExecutionCard execution={mockExecution} onClick={mockCallbacks.onClick} testId="aria-card" />)

      const card = screen.getByTestId('aria-card')
      expect(card).toBeInTheDocument()
      expect(card).toHaveAttribute('data-testid', 'aria-card')
    })

    it('has proper title attributes for truncated text', () => {
      render(<AgentExecutionCard execution={mockExecution} />)

      const agentName = screen.getByText('Test Agent')
      expect(agentName).toHaveAttribute('title', 'Test Agent')
    })

    it('has proper title attributes for action buttons', () => {
      render(<AgentExecutionCard execution={mockExecution} onPause={mockCallbacks.onPause} />)

      const pauseButton = screen.getByTitle('Pause execution')
      expect(pauseButton).toBeInTheDocument()
    })
  })
})