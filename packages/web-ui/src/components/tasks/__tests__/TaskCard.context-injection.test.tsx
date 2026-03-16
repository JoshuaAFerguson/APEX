import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TaskCard } from '../TaskCard'
import type { Task } from '@apexcli/core'

describe('TaskCard - Context Injection Button', () => {
  const mockOnInjectContext = vi.fn()
  const mockOnViewDetails = vi.fn()
  const mockOnCancel = vi.fn()
  const mockOnRetry = vi.fn()

  const baseTask: Task = {
    id: 'task-123-456-789',
    description: 'Test task for context injection',
    workflow: 'feature-development',
    autonomy: 'review-before-commit',
    status: 'in-progress',
    priority: 'normal',
    effort: 'medium',
    currentStage: 'implementation',
    projectPath: '/test/project',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T10:30:00Z').toISOString(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Button Visibility', () => {
    it('shows context injection button for in-progress tasks', () => {
      const task = { ...baseTask, status: 'in-progress' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.getByTitle('Inject context')
      expect(contextButton).toBeInTheDocument()
      expect(contextButton).toBeEnabled()
    })

    it('shows context injection button for planning tasks', () => {
      const task = { ...baseTask, status: 'planning' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.getByTitle('Inject context')
      expect(contextButton).toBeInTheDocument()
    })

    it('shows context injection button for pending tasks', () => {
      const task = { ...baseTask, status: 'pending' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.getByTitle('Inject context')
      expect(contextButton).toBeInTheDocument()
    })

    it('shows context injection button for queued tasks', () => {
      const task = { ...baseTask, status: 'queued' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.getByTitle('Inject context')
      expect(contextButton).toBeInTheDocument()
    })

    it('shows context injection button for waiting-approval tasks', () => {
      const task = { ...baseTask, status: 'waiting-approval' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.getByTitle('Inject context')
      expect(contextButton).toBeInTheDocument()
    })

    it('shows context injection button for paused tasks', () => {
      const task = { ...baseTask, status: 'paused' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.getByTitle('Inject context')
      expect(contextButton).toBeInTheDocument()
    })

    it('hides context injection button for completed tasks', () => {
      const task = { ...baseTask, status: 'completed' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.queryByTitle('Inject context')
      expect(contextButton).not.toBeInTheDocument()
    })

    it('hides context injection button for failed tasks', () => {
      const task = { ...baseTask, status: 'failed' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.queryByTitle('Inject context')
      expect(contextButton).not.toBeInTheDocument()
    })

    it('hides context injection button for cancelled tasks', () => {
      const task = { ...baseTask, status: 'cancelled' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.queryByTitle('Inject context')
      expect(contextButton).not.toBeInTheDocument()
    })

    it('hides context injection button when onInjectContext prop is not provided', () => {
      const task = { ...baseTask, status: 'in-progress' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          // Note: No onInjectContext prop provided
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.queryByTitle('Inject context')
      expect(contextButton).not.toBeInTheDocument()
    })

    it('shows action overlay only when hovering over card', () => {
      const task = { ...baseTask, status: 'in-progress' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)

      // Initially hidden
      let contextButton = screen.queryByTitle('Inject context')
      expect(contextButton).not.toBeInTheDocument()

      // Visible on hover
      fireEvent.mouseEnter(card)
      contextButton = screen.getByTitle('Inject context')
      expect(contextButton).toBeInTheDocument()

      // Hidden when not hovering
      fireEvent.mouseLeave(card)
      contextButton = screen.queryByTitle('Inject context')
      expect(contextButton).not.toBeInTheDocument()
    })

    it('positions context injection button correctly with other action buttons', () => {
      const task = { ...baseTask, status: 'in-progress' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
          onCancel={mockOnCancel}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.getByTitle('Inject context')
      const cancelButton = screen.getByTitle('Cancel task')

      expect(contextButton).toBeInTheDocument()
      expect(cancelButton).toBeInTheDocument()

      // Context injection button should appear before cancel button
      const actionOverlay = contextButton.closest('div')
      const buttons = actionOverlay?.querySelectorAll('button')
      expect(buttons?.[0]).toBe(contextButton)
      expect(buttons?.[1]).toBe(cancelButton)
    })
  })

  describe('Button Interactions', () => {
    it('calls onInjectContext with correct task ID when clicked', async () => {
      const user = userEvent.setup()
      const task = { ...baseTask, status: 'in-progress' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.getByTitle('Inject context')
      await user.click(contextButton)

      expect(mockOnInjectContext).toHaveBeenCalledWith(task.id)
      expect(mockOnInjectContext).toHaveBeenCalledTimes(1)
    })

    it('prevents event propagation when context button is clicked', async () => {
      const user = userEvent.setup()
      const task = { ...baseTask, status: 'in-progress' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.getByTitle('Inject context')
      await user.click(contextButton)

      // onViewDetails should not be called when clicking the context button
      expect(mockOnInjectContext).toHaveBeenCalledWith(task.id)
      expect(mockOnViewDetails).not.toHaveBeenCalled()
    })

    it('has correct visual styling when not hovered', () => {
      const task = { ...baseTask, status: 'in-progress' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.getByTitle('Inject context')

      // Check for base styling
      expect(contextButton).toHaveClass(
        'p-1.5',
        'rounded',
        'text-foreground-secondary'
      )

      // Check for hover styling classes
      expect(contextButton).toHaveClass(
        'hover:bg-apex-500/10',
        'hover:text-apex-500'
      )
    })

    it('shows MessageSquare icon in context button', () => {
      const task = { ...baseTask, status: 'in-progress' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.getByTitle('Inject context')
      const icon = contextButton.querySelector('svg')

      expect(icon).toBeInTheDocument()
      expect(icon).toHaveClass('w-4', 'h-4')
    })
  })

  describe('Loading States', () => {
    it('disables context button when isActionLoading is true', () => {
      const task = { ...baseTask, status: 'in-progress' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
          isActionLoading={true}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.getByTitle('Inject context')
      expect(contextButton).toBeDisabled()
      expect(contextButton).toHaveClass('disabled:opacity-50')
    })

    it('enables context button when isActionLoading is false', () => {
      const task = { ...baseTask, status: 'in-progress' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
          isActionLoading={false}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.getByTitle('Inject context')
      expect(contextButton).toBeEnabled()
    })

    it('does not call onInjectContext when button is disabled due to loading', async () => {
      const user = userEvent.setup()
      const task = { ...baseTask, status: 'in-progress' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
          isActionLoading={true}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.getByTitle('Inject context')
      await user.click(contextButton)

      expect(mockOnInjectContext).not.toHaveBeenCalled()
    })

    it('applies loading styles correctly', () => {
      const task = { ...baseTask, status: 'in-progress' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
          isActionLoading={true}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.getByTitle('Inject context')

      expect(contextButton).toHaveClass('disabled:opacity-50')
      expect(contextButton).toBeDisabled()
    })
  })

  describe('Compact Mode', () => {
    it('shows context injection button in compact mode', () => {
      const task = { ...baseTask, status: 'in-progress' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
          compact={true}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.getByTitle('Inject context')
      expect(contextButton).toBeInTheDocument()

      // Should have the same functionality in compact mode
      expect(contextButton).toBeEnabled()
    })

    it('maintains proper spacing in compact mode with multiple buttons', () => {
      const task = { ...baseTask, status: 'in-progress' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
          onCancel={mockOnCancel}
          compact={true}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.getByTitle('Inject context')
      const cancelButton = screen.getByTitle('Cancel task')

      expect(contextButton).toBeInTheDocument()
      expect(cancelButton).toBeInTheDocument()

      // Check that both buttons are in the action overlay with proper gap
      const actionOverlay = contextButton.closest('div')
      expect(actionOverlay).toHaveClass('gap-1')
    })
  })

  describe('Integration with Other Actions', () => {
    it('shows context injection button alongside cancel button', () => {
      const task = { ...baseTask, status: 'in-progress' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
          onCancel={mockOnCancel}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      expect(screen.getByTitle('Inject context')).toBeInTheDocument()
      expect(screen.getByTitle('Cancel task')).toBeInTheDocument()
    })

    it('shows context injection button alongside retry button for paused tasks', () => {
      const task = { ...baseTask, status: 'paused' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
          onRetry={mockOnRetry}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      expect(screen.getByTitle('Inject context')).toBeInTheDocument()
      // Note: Retry button typically not shown for paused tasks
      expect(screen.queryByTitle('Retry task')).not.toBeInTheDocument()
    })

    it('does not show context injection button when task only supports retry', () => {
      const task = { ...baseTask, status: 'failed' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
          onRetry={mockOnRetry}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      expect(screen.queryByTitle('Inject context')).not.toBeInTheDocument()
      expect(screen.getByTitle('Retry task')).toBeInTheDocument()
    })

    it('respects button order: context injection, cancel, retry', () => {
      const task = { ...baseTask, status: 'pending' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
          onCancel={mockOnCancel}
          onRetry={mockOnRetry}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.getByTitle('Inject context')
      const cancelButton = screen.getByTitle('Cancel task')

      // Context button should come before cancel button
      const actionOverlay = contextButton.closest('div')
      const buttons = actionOverlay?.querySelectorAll('button')

      expect(buttons?.[0]).toBe(contextButton)
      expect(buttons?.[1]).toBe(cancelButton)
    })
  })

  describe('Accessibility', () => {
    it('has proper title attribute for screen readers', () => {
      const task = { ...baseTask, status: 'in-progress' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.getByTitle('Inject context')
      expect(contextButton).toHaveAttribute('title', 'Inject context')
    })

    it('has proper role for button element', () => {
      const task = { ...baseTask, status: 'in-progress' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.getByTitle('Inject context')
      expect(contextButton).toHaveAttribute('type', 'button')
    })

    it('provides visual feedback on hover', () => {
      const task = { ...baseTask, status: 'in-progress' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.getByTitle('Inject context')

      // Check hover classes are present
      expect(contextButton.className).toMatch(/hover:bg-apex-500\/10/)
      expect(contextButton.className).toMatch(/hover:text-apex-500/)
    })

    it('is keyboard accessible', () => {
      const task = { ...baseTask, status: 'in-progress' as const }
      render(
        <TaskCard
          task={task}
          onViewDetails={mockOnViewDetails}
          onInjectContext={mockOnInjectContext}
        />
      )

      const card = screen.getByTestId(`task-card-${task.id}`)
      fireEvent.mouseEnter(card)

      const contextButton = screen.getByTitle('Inject context')

      // Button should be focusable
      expect(contextButton).not.toHaveAttribute('tabIndex', '-1')

      // Can be activated with keyboard
      fireEvent.keyDown(contextButton, { key: 'Enter' })
      expect(mockOnInjectContext).toHaveBeenCalledWith(task.id)
    })
  })
})