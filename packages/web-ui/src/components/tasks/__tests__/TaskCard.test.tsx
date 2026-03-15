import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TaskCard } from '../TaskCard'
import type { Task } from '@apexcli/core'

const mockTask: Task = {
  id: 'task-123-456-789',
  description: 'Implement user authentication feature',
  workflow: 'api-development',
  autonomy: 'medium',
  status: 'in-progress',
  priority: 'high',
  effort: 'medium',
  currentStage: 'implementation',
  projectPath: '/project/path',
  retryCount: 0,
  maxRetries: 3,
  resumeAttempts: 0,
  createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
  updatedAt: new Date('2024-01-01T10:30:00Z').toISOString(),
  subtaskIds: ['subtask-1', 'subtask-2'],
}

const mockCompletedTask: Task = {
  ...mockTask,
  id: 'completed-task',
  status: 'completed',
  currentStage: undefined,
}

const mockFailedTask: Task = {
  ...mockTask,
  id: 'failed-task',
  status: 'failed',
  error: 'Authentication service is unavailable',
  currentStage: undefined,
}

describe('TaskCard', () => {
  it('renders task information correctly', () => {
    render(<TaskCard task={mockTask} />)

    expect(screen.getByText('Implement user authentication feature')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('api-development')).toBeInTheDocument()
    expect(screen.getByText('implementation')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // subtask count
  })

  it('displays truncated task ID', () => {
    render(<TaskCard task={mockTask} />)
    expect(screen.getByText('task-123...')).toBeInTheDocument()
  })

  it('shows spinner for running tasks', () => {
    render(<TaskCard task={mockTask} />)
    // Spinner should be present for in-progress tasks
    const spinnerContainer = screen.getByRole('status', { hidden: true })
    expect(spinnerContainer).toBeInTheDocument()
  })

  it('shows progress indicator for running tasks', () => {
    render(<TaskCard task={mockTask} />)
    const progressContainer = screen.getByRole('generic')
    // Should find the progress indicator container
    expect(progressContainer).toBeInTheDocument()
  })

  it('displays error message for failed tasks', () => {
    render(<TaskCard task={mockFailedTask} />)
    expect(screen.getByText(/Authentication service is unavailable/)).toBeInTheDocument()
  })

  it('calls onViewDetails when clicked', () => {
    const onViewDetails = vi.fn()
    render(<TaskCard task={mockTask} onViewDetails={onViewDetails} />)

    fireEvent.click(screen.getByRole('generic'))
    expect(onViewDetails).toHaveBeenCalledWith('task-123-456-789')
  })

  it('renders in compact mode', () => {
    render(<TaskCard task={mockTask} compact />)

    // Should still render the task but with smaller styling
    expect(screen.getByText('Implement user authentication feature')).toBeInTheDocument()
    expect(screen.getByText('task-12...')).toBeInTheDocument() // shorter ID in compact mode
  })

  it('hides progress when showProgress is false', () => {
    render(<TaskCard task={mockTask} showProgress={false} />)

    // Progress indicator should not be present
    const progressElements = screen.queryAllByRole('generic')
    const hasProgressIndicator = progressElements.some(el =>
      el.className.includes('bg-apex-500') || el.className.includes('animate-pulse')
    )
    expect(hasProgressIndicator).toBe(false)
  })

  it('shows elapsed time for running tasks', () => {
    // Mock current time to be 1 hour after creation
    const mockDate = new Date('2024-01-01T11:00:00Z')
    vi.setSystemTime(mockDate)

    render(<TaskCard task={mockTask} />)

    // Should show running time
    expect(screen.getByText('1h')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('shows creation time for completed tasks', () => {
    const mockDate = new Date('2024-01-01T12:00:00Z')
    vi.setSystemTime(mockDate)

    render(<TaskCard task={mockCompletedTask} />)

    // Should show "ago" time for completed tasks
    expect(screen.getByText('2h ago')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('applies correct border color based on task status', () => {
    const { rerender } = render(<TaskCard task={mockTask} />)
    let cardElement = screen.getByRole('generic')
    expect(cardElement).toHaveClass('border-l-apex-500')

    rerender(<TaskCard task={mockCompletedTask} />)
    cardElement = screen.getByRole('generic')
    expect(cardElement).toHaveClass('border-l-green-500')

    rerender(<TaskCard task={mockFailedTask} />)
    cardElement = screen.getByRole('generic')
    expect(cardElement).toHaveClass('border-l-red-500')
  })
})