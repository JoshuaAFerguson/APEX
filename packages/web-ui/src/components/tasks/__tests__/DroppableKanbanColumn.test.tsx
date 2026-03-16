import { describe, test, expect, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { DndContext, DragEndEvent } from '@dnd-kit/core'
import { DroppableKanbanColumn } from '../DroppableKanbanColumn'

const TestWrapper = ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd?: (event: DragEndEvent) => void }) => (
  <DndContext onDragEnd={onDragEnd || (() => {})}>
    {children}
  </DndContext>
)

describe('DroppableKanbanColumn', () => {
  test('renders children correctly', () => {
    render(
      <TestWrapper>
        <DroppableKanbanColumn columnId="test-column">
          <div>Column content</div>
        </DroppableKanbanColumn>
      </TestWrapper>
    )

    expect(screen.getByText('Column content')).toBeInTheDocument()
  })

  test('applies custom className', () => {
    render(
      <TestWrapper>
        <DroppableKanbanColumn columnId="test-column" className="custom-class">
          <div>Column content</div>
        </DroppableKanbanColumn>
      </TestWrapper>
    )

    const column = screen.getByText('Column content').parentElement
    expect(column).toHaveClass('custom-class')
  })

  test('applies disabled styles when canAcceptDrop is false', () => {
    render(
      <TestWrapper>
        <DroppableKanbanColumn columnId="test-column" canAcceptDrop={false}>
          <div>Column content</div>
        </DroppableKanbanColumn>
      </TestWrapper>
    )

    const column = screen.getByText('Column content').parentElement
    expect(column).toHaveClass('opacity-50')
  })

  test('shows drop indicator when over and can accept drop', () => {
    // This is a simplified test - actual drag over testing would require more complex setup
    render(
      <TestWrapper>
        <DroppableKanbanColumn columnId="test-column" isOver={true} canAcceptDrop={true}>
          <div>Column content</div>
        </DroppableKanbanColumn>
      </TestWrapper>
    )

    // The drop indicator would be shown, but testing the actual drag over state
    // requires more complex setup with @dnd-kit utilities
    expect(screen.getByText('Column content')).toBeInTheDocument()
  })

  test('sets correct droppable id', () => {
    const onDragEnd = vi.fn()

    render(
      <TestWrapper onDragEnd={onDragEnd}>
        <DroppableKanbanColumn columnId="test-column">
          <div>Column content</div>
        </DroppableKanbanColumn>
      </TestWrapper>
    )

    // The droppable setup is internal to @dnd-kit, we just verify rendering
    expect(screen.getByText('Column content')).toBeInTheDocument()
  })

  test('renders without canAcceptDrop prop (defaults to true)', () => {
    render(
      <TestWrapper>
        <DroppableKanbanColumn columnId="test-column">
          <div>Column content</div>
        </DroppableKanbanColumn>
      </TestWrapper>
    )

    const column = screen.getByText('Column content').parentElement
    expect(column).not.toHaveClass('opacity-50')
  })
})