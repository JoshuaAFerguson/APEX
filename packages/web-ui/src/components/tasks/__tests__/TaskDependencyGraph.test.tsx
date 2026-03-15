/**
 * Unit tests for TaskDependencyGraph component
 *
 * Tests the component's ability to:
 * - Render task nodes with proper styling based on status
 * - Create edges for task dependencies and subtask relationships
 * - Handle empty states gracefully
 * - Navigate to task detail pages on node click
 * - Transform Task objects to graph elements correctly
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import '@testing-library/jest-dom'
import { useRouter } from 'next/navigation'
import { createTask } from '@apexcli/core/factories'
import type { Task } from '@apexcli/core'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

// Mock React Flow with factory function
vi.mock('@xyflow/react', () => ({
  ReactFlow: vi.fn().mockImplementation(() => (
    <div data-testid="react-flow-mock">React Flow Mock</div>
  )),
  MiniMap: vi.fn().mockImplementation(() => <div data-testid="minimap-mock">MiniMap Mock</div>),
  Controls: vi.fn().mockImplementation(() => <div data-testid="controls-mock">Controls Mock</div>),
  Background: vi.fn().mockImplementation(() => <div data-testid="background-mock">Background Mock</div>),
  useNodesState: vi.fn().mockImplementation(() => [
    [],
    vi.fn(),
    vi.fn()
  ]),
  useEdgesState: vi.fn().mockImplementation(() => [
    [],
    vi.fn(),
    vi.fn()
  ]),
  BackgroundVariant: {
    Dots: 'dots',
    Lines: 'lines',
    Cross: 'cross',
  },
}))

// Mock CSS imports
vi.mock('@xyflow/react/dist/style.css', () => ({}))

// Mock utils
vi.mock('@/lib/utils', () => ({
  cn: vi.fn((...classes) => classes.filter(Boolean).join(' ')),
}))

// Mock the DependencyGraph component
vi.mock('@/components/graphs/DependencyGraph', () => ({
  DependencyGraph: vi.fn(({ nodes, edges, onNodeClick, className }) => (
    <div
      data-testid="dependency-graph-mock"
      data-nodes-count={nodes?.length || 0}
      data-edges-count={edges?.length || 0}
      className={className}
    >
      <div data-testid="nodes">
        {nodes?.map((node: any) => (
          <button
            key={node.id}
            data-testid={`node-${node.id}`}
            onClick={() => onNodeClick?.(node)}
            data-task-id={node.data.taskId}
            data-status={node.data.status}
          >
            {node.data.label}
          </button>
        ))}
      </div>
      <div data-testid="edges">
        {edges?.map((edge: any) => (
          <div key={edge.id} data-testid={`edge-${edge.id}`}>
{edge.source} → {edge.target}
          </div>
        ))}
      </div>
    </div>
  )),
}))

import { TaskDependencyGraph } from '../TaskDependencyGraph'

describe('TaskDependencyGraph', () => {
  const mockPush = vi.fn()
  const mockRouter = { push: mockPush }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as any).mockReturnValue(mockRouter)
  })

  describe('Empty State', () => {
    it('renders empty state when no tasks provided', () => {
      render(<TaskDependencyGraph tasks={[]} />)

      expect(screen.getByRole('heading', { name: 'No tasks to display' })).toBeInTheDocument()
    })

    it('renders empty state when tasks is undefined', () => {
      render(<TaskDependencyGraph tasks={undefined as any} />)

      expect(screen.getByRole('heading', { name: 'No tasks to display' })).toBeInTheDocument()
    })

    it('renders custom empty state message', () => {
      const customMessage = 'No workflow tasks available'
      render(
        <TaskDependencyGraph
          tasks={[]}
          emptyStateMessage={customMessage}
        />
      )

      expect(screen.getByText(customMessage)).toBeInTheDocument()
    })

    it('applies custom height to empty state container', () => {
      const { container } = render(
        <TaskDependencyGraph
          tasks={[]}
          height={600}
        />
      )

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper).toHaveStyle('height: 600px')
    })
  })

  describe('Single Task', () => {
    it('renders a single task node', () => {
      const task = createTask({
        id: 'task-1',
        description: 'Implement user authentication',
        status: 'in-progress'
      })

      render(<TaskDependencyGraph tasks={[task]} />)

      expect(screen.getByTestId('dependency-graph-mock')).toBeInTheDocument()
      expect(screen.getByTestId('dependency-graph-mock')).toHaveAttribute('data-nodes-count', '1')
      expect(screen.getByTestId('dependency-graph-mock')).toHaveAttribute('data-edges-count', '0')

      const nodeButton = screen.getByTestId('node-task-1')
      expect(nodeButton).toHaveAttribute('data-task-id', 'task-1')
      expect(nodeButton).toHaveAttribute('data-status', 'active')
    })

    it('truncates long task descriptions', () => {
      const longDescription = 'This is a very long task description that should be truncated when displayed in the graph to prevent the nodes from becoming too wide'
      const task = createTask({
        id: 'task-1',
        description: longDescription,
        status: 'pending'
      })

      render(<TaskDependencyGraph tasks={[task]} />)

      const nodeButton = screen.getByTestId('node-task-1')
      // The text should be truncated (not contain the full description)
      expect(nodeButton.textContent?.length).toBeLessThan(longDescription.length)
      expect(nodeButton.textContent).toMatch(/\.\.\./)
    })
  })

  describe('Task Dependencies', () => {
    it('creates edges for dependsOn relationships', () => {
      const taskA = createTask({
        id: 'task-a',
        description: 'Setup database',
        status: 'completed'
      })

      const taskB = createTask({
        id: 'task-b',
        description: 'Create user model',
        status: 'in-progress',
        dependsOn: ['task-a']
      })

      render(<TaskDependencyGraph tasks={[taskA, taskB]} />)

      expect(screen.getByTestId('dependency-graph-mock')).toHaveAttribute('data-edges-count', '1')
      expect(screen.getByTestId('edge-dep-task-a-task-b')).toBeInTheDocument()
      expect(screen.getByTestId('edge-dep-task-a-task-b')).toHaveTextContent('task-a → task-b')
    })

    it('creates edges for parent-child relationships', () => {
      const parentTask = createTask({
        id: 'parent-task',
        description: 'Implement authentication system',
        status: 'in-progress',
        subtaskIds: ['subtask-1', 'subtask-2']
      })

      const subtask1 = createTask({
        id: 'subtask-1',
        description: 'Create login form',
        status: 'completed',
        parentTaskId: 'parent-task'
      })

      const subtask2 = createTask({
        id: 'subtask-2',
        description: 'Add password validation',
        status: 'pending',
        parentTaskId: 'parent-task'
      })

      render(<TaskDependencyGraph tasks={[parentTask, subtask1, subtask2]} />)

      expect(screen.getByTestId('dependency-graph-mock')).toHaveAttribute('data-edges-count', '2')
      expect(screen.getByTestId('edge-subtask-parent-task-subtask-1')).toBeInTheDocument()
      expect(screen.getByTestId('edge-subtask-parent-task-subtask-2')).toBeInTheDocument()
    })

    it('handles complex dependency chain', () => {
      const taskA = createTask({ id: 'task-a', description: 'Setup', status: 'completed' })
      const taskB = createTask({ id: 'task-b', description: 'Models', status: 'completed', dependsOn: ['task-a'] })
      const taskC = createTask({ id: 'task-c', description: 'Controllers', status: 'in-progress', dependsOn: ['task-b'] })
      const taskD = createTask({ id: 'task-d', description: 'Tests', status: 'pending', dependsOn: ['task-c'] })

      render(<TaskDependencyGraph tasks={[taskA, taskB, taskC, taskD]} />)

      expect(screen.getByTestId('dependency-graph-mock')).toHaveAttribute('data-nodes-count', '4')
      expect(screen.getByTestId('dependency-graph-mock')).toHaveAttribute('data-edges-count', '3')

      // Check all dependency edges exist
      expect(screen.getByTestId('edge-dep-task-a-task-b')).toBeInTheDocument()
      expect(screen.getByTestId('edge-dep-task-b-task-c')).toBeInTheDocument()
      expect(screen.getByTestId('edge-dep-task-c-task-d')).toBeInTheDocument()
    })
  })

  describe('Status Mapping', () => {
    it('maps task statuses to correct node statuses', () => {
      const tasks = [
        createTask({ id: 'pending-task', status: 'pending' }),
        createTask({ id: 'active-task', status: 'in-progress' }),
        createTask({ id: 'completed-task', status: 'completed' }),
        createTask({ id: 'failed-task', status: 'failed' }),
        createTask({ id: 'planning-task', status: 'planning' }),
      ]

      render(<TaskDependencyGraph tasks={tasks} />)

      expect(screen.getByTestId('node-pending-task')).toHaveAttribute('data-status', 'pending')
      expect(screen.getByTestId('node-active-task')).toHaveAttribute('data-status', 'active')
      expect(screen.getByTestId('node-completed-task')).toHaveAttribute('data-status', 'completed')
      expect(screen.getByTestId('node-failed-task')).toHaveAttribute('data-status', 'error')
      expect(screen.getByTestId('node-planning-task')).toHaveAttribute('data-status', 'active')
    })
  })

  describe('Navigation', () => {
    it('navigates to task detail page on node click by default', () => {
      const task = createTask({
        id: 'task-123',
        description: 'Test task',
        status: 'pending'
      })

      render(<TaskDependencyGraph tasks={[task]} />)

      const nodeButton = screen.getByTestId('node-task-123')
      fireEvent.click(nodeButton)

      expect(mockPush).toHaveBeenCalledWith('/tasks/task-123')
    })

    it('calls custom onTaskClick handler when provided', () => {
      const mockOnTaskClick = vi.fn()
      const task = createTask({
        id: 'task-456',
        description: 'Test task',
        status: 'pending'
      })

      render(
        <TaskDependencyGraph
          tasks={[task]}
          onTaskClick={mockOnTaskClick}
        />
      )

      const nodeButton = screen.getByTestId('node-task-456')
      fireEvent.click(nodeButton)

      expect(mockOnTaskClick).toHaveBeenCalledWith('task-456')
      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('Component Props', () => {
    it('passes className to container', () => {
      const task = createTask({ id: 'task-1', description: 'Test' })
      const { container } = render(
        <TaskDependencyGraph
          tasks={[task]}
          className="custom-class"
        />
      )

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper).toHaveClass('custom-class')
    })

    it('applies custom height', () => {
      const task = createTask({ id: 'task-1', description: 'Test' })
      const { container } = render(
        <TaskDependencyGraph
          tasks={[task]}
          height="500px"
        />
      )

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper).toHaveStyle('height: 500px')
    })

    it('passes interactive prop to DependencyGraph', () => {
      const task = createTask({ id: 'task-1', description: 'Test' })
      render(
        <TaskDependencyGraph
          tasks={[task]}
          interactive={false}
        />
      )

      expect(screen.getByTestId('dependency-graph-mock')).toBeInTheDocument()
    })

    it('passes fitView prop to DependencyGraph', () => {
      const task = createTask({ id: 'task-1', description: 'Test' })
      render(
        <TaskDependencyGraph
          tasks={[task]}
          fitView={false}
        />
      )

      expect(screen.getByTestId('dependency-graph-mock')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles missing dependency references gracefully', () => {
      const task = createTask({
        id: 'task-1',
        description: 'Test task',
        dependsOn: ['missing-task-id'] // This task doesn't exist in the array
      })

      expect(() => {
        render(<TaskDependencyGraph tasks={[task]} />)
      }).not.toThrow()

      // Should only render the one task, no edges
      expect(screen.getByTestId('dependency-graph-mock')).toHaveAttribute('data-nodes-count', '1')
      expect(screen.getByTestId('dependency-graph-mock')).toHaveAttribute('data-edges-count', '0')
    })

    it('handles missing parent task references gracefully', () => {
      const subtask = createTask({
        id: 'subtask-1',
        description: 'Orphaned subtask',
        parentTaskId: 'missing-parent-id' // Parent doesn't exist in array
      })

      expect(() => {
        render(<TaskDependencyGraph tasks={[subtask]} />)
      }).not.toThrow()

      expect(screen.getByTestId('dependency-graph-mock')).toHaveAttribute('data-nodes-count', '1')
      expect(screen.getByTestId('dependency-graph-mock')).toHaveAttribute('data-edges-count', '0')
    })

    it('handles tasks with circular dependencies', () => {
      const taskA = createTask({
        id: 'task-a',
        description: 'Task A',
        dependsOn: ['task-b']
      })

      const taskB = createTask({
        id: 'task-b',
        description: 'Task B',
        dependsOn: ['task-a'] // Circular dependency
      })

      expect(() => {
        render(<TaskDependencyGraph tasks={[taskA, taskB]} />)
      }).not.toThrow()

      expect(screen.getByTestId('dependency-graph-mock')).toHaveAttribute('data-nodes-count', '2')
      expect(screen.getByTestId('dependency-graph-mock')).toHaveAttribute('data-edges-count', '2')
    })
  })
})