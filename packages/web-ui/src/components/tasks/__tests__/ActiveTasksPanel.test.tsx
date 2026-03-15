import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ActiveTasksPanel } from '../ActiveTasksPanel'
import type { Task } from '@apexcli/core'

const mockTasks: Task[] = [
  {
    id: 'task-1',
    description: 'Running task 1',
    workflow: 'development',
    autonomy: 'medium',
    status: 'in-progress',
    priority: 'high',
    effort: 'medium',
    currentStage: 'implementation',
    projectPath: '/project',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T10:30:00Z').toISOString(),
  },
  {
    id: 'task-2',
    description: 'Completed task 2',
    workflow: 'testing',
    autonomy: 'medium',
    status: 'completed',
    priority: 'medium',
    effort: 'small',
    projectPath: '/project',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date('2024-01-01T09:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T09:30:00Z').toISOString(),
  },
  {
    id: 'task-3',
    description: 'Failed task 3',
    workflow: 'deployment',
    autonomy: 'high',
    status: 'failed',
    priority: 'low',
    effort: 'large',
    error: 'Deployment failed',
    projectPath: '/project',
    retryCount: 1,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date('2024-01-01T08:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T08:15:00Z').toISOString(),
  },
  {
    id: 'task-4',
    description: 'Paused task 4',
    workflow: 'review',
    autonomy: 'low',
    status: 'paused',
    priority: 'medium',
    effort: 'medium',
    projectPath: '/project',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date('2024-01-01T07:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T07:30:00Z').toISOString(),
  },
]

describe('ActiveTasksPanel', () => {
  it('renders with tasks and shows default active filter', () => {
    render(<ActiveTasksPanel tasks={mockTasks} />)

    expect(screen.getByText('Active Tasks')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument() // total task count badge

    // Should show active task by default
    expect(screen.getByText('Running task 1')).toBeInTheDocument()

    // Active filter should be selected
    const activeButton = screen.getByRole('button', { name: /active/i })
    expect(activeButton).toHaveClass('bg-apex-500/20')
  })

  it('filters tasks correctly', async () => {
    render(<ActiveTasksPanel tasks={mockTasks} />)

    // Initially showing active tasks (1 task)
    expect(screen.getByText('Running task 1')).toBeInTheDocument()
    expect(screen.queryByText('Completed task 2')).not.toBeInTheDocument()

    // Switch to completed filter
    fireEvent.click(screen.getByRole('button', { name: /completed/i }))
    await waitFor(() => {
      expect(screen.getByText('Completed task 2')).toBeInTheDocument()
      expect(screen.queryByText('Running task 1')).not.toBeInTheDocument()
    })

    // Switch to failed filter
    fireEvent.click(screen.getByRole('button', { name: /failed/i }))
    await waitFor(() => {
      expect(screen.getByText('Failed task 3')).toBeInTheDocument()
      expect(screen.queryByText('Completed task 2')).not.toBeInTheDocument()
    })

    // Switch to paused filter
    fireEvent.click(screen.getByRole('button', { name: /paused/i }))
    await waitFor(() => {
      expect(screen.getByText('Paused task 4')).toBeInTheDocument()
      expect(screen.queryByText('Failed task 3')).not.toBeInTheDocument()
    })

    // Switch to all filter
    fireEvent.click(screen.getByRole('button', { name: /^all/i }))
    await waitFor(() => {
      expect(screen.getByText('Running task 1')).toBeInTheDocument()
      expect(screen.getByText('Completed task 2')).toBeInTheDocument()
      expect(screen.getByText('Failed task 3')).toBeInTheDocument()
      expect(screen.getByText('Paused task 4')).toBeInTheDocument()
    })
  })

  it('shows task counts in filter buttons', () => {
    render(<ActiveTasksPanel tasks={mockTasks} />)

    // Check that filter buttons show correct counts
    expect(screen.getByRole('button', { name: /all.*4/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /active.*1/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /completed.*1/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /failed.*1/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /paused.*1/i })).toBeInTheDocument()
  })

  it('calls onViewDetails when task card is clicked', () => {
    const onViewDetails = vi.fn()
    render(<ActiveTasksPanel tasks={mockTasks} onViewDetails={onViewDetails} />)

    // Click on the active task
    fireEvent.click(screen.getByText('Running task 1'))
    expect(onViewDetails).toHaveBeenCalledWith('task-1')
  })

  it('calls onRefresh when refresh button is clicked', () => {
    const onRefresh = vi.fn()
    render(<ActiveTasksPanel tasks={mockTasks} onRefresh={onRefresh} />)

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
    expect(onRefresh).toHaveBeenCalled()
  })

  it('shows loading state', () => {
    render(<ActiveTasksPanel tasks={[]} loading />)

    expect(screen.getByText('Loading tasks...')).toBeInTheDocument()
  })

  it('shows empty state when no tasks match filter', () => {
    render(<ActiveTasksPanel tasks={[]} />)

    expect(screen.getByText('No active tasks')).toBeInTheDocument()
    expect(screen.getByText('View all tasks')).toBeInTheDocument()
  })

  it('shows empty state message for specific filters', () => {
    const tasksWithoutCompleted = mockTasks.filter(t => t.status !== 'completed')
    render(<ActiveTasksPanel tasks={tasksWithoutCompleted} />)

    // Switch to completed filter
    fireEvent.click(screen.getByRole('button', { name: /completed/i }))
    expect(screen.getByText('No completed tasks')).toBeInTheDocument()
  })

  it('respects maxTasks limit', () => {
    const manyTasks = Array.from({ length: 15 }, (_, i) => ({
      ...mockTasks[0],
      id: `task-${i}`,
      description: `Task ${i}`,
      updatedAt: new Date(`2024-01-01T${10 + i}:00:00Z`).toISOString(),
    }))

    render(<ActiveTasksPanel tasks={manyTasks} maxTasks={5} />)

    // Should show "Showing X most recent tasks" message
    expect(screen.getByText('Showing 5 most recent tasks')).toBeInTheDocument()
  })

  it('renders in compact mode', () => {
    render(<ActiveTasksPanel tasks={mockTasks} compact />)

    expect(screen.getByText('Active Tasks')).toBeInTheDocument()
    // Component should render but with smaller styling
    expect(screen.getByText('Running task 1')).toBeInTheDocument()
  })

  it('handles defaultShowActiveOnly prop', () => {
    render(<ActiveTasksPanel tasks={mockTasks} defaultShowActiveOnly={false} />)

    // Should show all tasks by default
    expect(screen.getByText('Running task 1')).toBeInTheDocument()
    expect(screen.getByText('Completed task 2')).toBeInTheDocument()
    expect(screen.getByText('Failed task 3')).toBeInTheDocument()
    expect(screen.getByText('Paused task 4')).toBeInTheDocument()

    // All filter should be selected
    const allButton = screen.getByRole('button', { name: /^all/i })
    expect(allButton).toHaveClass('bg-apex-500/20')
  })

  it('sorts tasks by most recently updated', () => {
    render(<ActiveTasksPanel tasks={mockTasks} defaultShowActiveOnly={false} />)

    const taskCards = screen.getAllByText(/task \d|Running|Completed|Failed|Paused/)
    const taskTitles = taskCards
      .filter(el => el.textContent?.includes('task'))
      .map(el => el.textContent)

    // Should be sorted by updatedAt (most recent first)
    // task-1 (10:30), task-2 (09:30), task-4 (07:30), task-3 (08:15)
    expect(taskTitles[0]).toContain('Running task 1') // 10:30
    expect(taskTitles[1]).toContain('Completed task 2') // 09:30
  })
})