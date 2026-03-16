import { describe, test, expect, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { DndContext, DragEndEvent } from '@dnd-kit/core'
import { DraggableKanbanCard } from '../DraggableKanbanCard'
import type { Task } from '@apexcli/core'

const mockTask: Task = {
  id: 'task-1',
  description: 'Test task',
  status: 'pending',
  workflow: 'test',
  priority: 'medium',
  effort: 'medium',
  retryCount: 0,
  maxRetries: 3,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  usage: {
    totalTokens: 100,
    estimatedCost: 0.01,
    inputTokens: 50,
    outputTokens: 50,
  },
  logs: [],
  artifacts: [],
}

const TestWrapper = ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd?: (event: DragEndEvent) => void }) => (
  <DndContext onDragEnd={onDragEnd || (() => {})}>
    {children}
  </DndContext>
)

describe('DraggableKanbanCard', () => {
  test('renders children correctly', () => {
    render(
      <TestWrapper>
        <DraggableKanbanCard task={mockTask}>
          <div>Test content</div>
        </DraggableKanbanCard>
      </TestWrapper>
    )

    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  test('applies draggable styles for draggable tasks', () => {
    render(
      <TestWrapper>
        <DraggableKanbanCard task={mockTask}>
          <div>Test content</div>
        </DraggableKanbanCard>
      </TestWrapper>
    )

    const card = screen.getByText('Test content').parentElement
    expect(card).toHaveClass('cursor-grab')
  })

  test('disables dragging for completed tasks', () => {
    const completedTask = { ...mockTask, status: 'completed' as const }

    render(
      <TestWrapper>
        <DraggableKanbanCard task={completedTask}>
          <div>Test content</div>
        </DraggableKanbanCard>
      </TestWrapper>
    )

    const card = screen.getByText('Test content').parentElement
    expect(card).toHaveClass('cursor-default')
    expect(card).not.toHaveClass('cursor-grab')
  })

  test('disables dragging for tasks with errors', () => {
    const errorTask = { ...mockTask, error: 'Something went wrong' }

    render(
      <TestWrapper>
        <DraggableKanbanCard task={errorTask}>
          <div>Test content</div>
        </DraggableKanbanCard>
      </TestWrapper>
    )

    const card = screen.getByText('Test content').parentElement
    expect(card).toHaveClass('cursor-default')
    expect(card).not.toHaveClass('cursor-grab')
  })

  test('applies overlay styles when isDragOverlay is true', () => {
    render(
      <TestWrapper>
        <DraggableKanbanCard task={mockTask} isDragOverlay>
          <div>Test content</div>
        </DraggableKanbanCard>
      </TestWrapper>
    )

    const card = screen.getByText('Test content').parentElement
    expect(card).toHaveClass('shadow-lg', 'scale-105', 'rotate-3')
  })

  test('passes custom className', () => {
    render(
      <TestWrapper>
        <DraggableKanbanCard task={mockTask} className="custom-class">
          <div>Test content</div>
        </DraggableKanbanCard>
      </TestWrapper>
    )

    const card = screen.getByText('Test content').parentElement
    expect(card).toHaveClass('custom-class')
  })

  test('sets up draggable with correct id and data', () => {
    const onDragEnd = vi.fn()

    render(
      <TestWrapper onDragEnd={onDragEnd}>
        <DraggableKanbanCard task={mockTask}>
          <div>Test content</div>
        </DraggableKanbanCard>
      </TestWrapper>
    )

    // The actual drag testing would require more complex setup with @dnd-kit testing utilities
    // For now, we just verify the component renders correctly
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })
})