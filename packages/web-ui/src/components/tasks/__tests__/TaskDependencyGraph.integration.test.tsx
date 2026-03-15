/**
 * Integration tests for TaskDependencyGraph component
 *
 * Tests real-world task scenarios, complex dependency relationships,
 * navigation flows, and performance with larger datasets.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import '@testing-library/jest-dom'
import { useRouter } from 'next/navigation'
import { createTask } from '@apexcli/core/factories'
import type { Task, TaskStatus } from '@apexcli/core'

// Mock Next.js router with more realistic behavior
const mockPush = vi.fn()
const mockRouter = {
  push: mockPush,
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => mockRouter),
}))

// Mock React Flow with integration-focused implementation
let mockNodesState: any[] = []
let mockEdgesState: any[] = []
let mockOnNodeClick: any
let mockOnEdgeClick: any

const mockReactFlowIntegration = vi.fn((props) => {
  mockNodesState = props.nodes || []
  mockEdgesState = props.edges || []
  mockOnNodeClick = props.onNodeClick
  mockOnEdgeClick = props.onEdgeClick

  return (
    <div
      data-testid="react-flow-integration"
      className={props.className}
      style={{ width: '100%', height: '400px' }}
    >
      <div data-testid="graph-nodes" data-count={mockNodesState.length}>
        {mockNodesState.map((node: any) => (
          <div
            key={node.id}
            data-testid={`graph-node-${node.id}`}
            data-node-id={node.id}
            data-task-id={node.data?.taskId}
            data-status={node.data?.status}
            data-type={node.data?.type}
            onClick={() => mockOnNodeClick?.(node)}
            style={{
              position: 'absolute',
              left: node.position.x,
              top: node.position.y,
              cursor: 'pointer',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              background: node.data?.status === 'active' ? '#3b82f6' : '#f1f5f9',
              color: node.data?.status === 'active' ? 'white' : 'black',
            }}
          >
            <div data-testid={`node-label-${node.id}`}>
              {node.data?.label || node.id}
            </div>
            {node.data?.taskStatus && (
              <div data-testid={`node-task-status-${node.id}`} className="text-sm">
                {node.data.taskStatus}
              </div>
            )}
          </div>
        ))}
      </div>
      <div data-testid="graph-edges" data-count={mockEdgesState.length}>
        {mockEdgesState.map((edge: any) => (
          <div
            key={edge.id}
            data-testid={`graph-edge-${edge.id}`}
            data-edge-id={edge.id}
            data-source={edge.source}
            data-target={edge.target}
            data-relationship={edge.data?.relationshipType}
            onClick={() => mockOnEdgeClick?.(edge)}
            style={{
              position: 'absolute',
              border: '1px solid #8b5cf6',
              height: '2px',
              cursor: 'pointer',
            }}
          >
            {edge.data?.label && (
              <span className="text-xs">{edge.data.label}</span>
            )}
          </div>
        ))}
      </div>
      {props.fitView && (
        <div data-testid="fit-view-enabled">Fit View Enabled</div>
      )}
      {props.interactive !== false && (
        <div data-testid="interactive-enabled">Interactive Mode</div>
      )}
    </div>
  )
})

vi.mock('@xyflow/react', () => ({
  ReactFlow: mockReactFlowIntegration,
  MiniMap: vi.fn(() => <div data-testid="minimap">MiniMap</div>),
  Controls: vi.fn(() => <div data-testid="controls">Controls</div>),
  Background: vi.fn(() => <div data-testid="background">Background</div>),
  useNodesState: vi.fn(() => [[], vi.fn(), vi.fn()]),
  useEdgesState: vi.fn(() => [[], vi.fn(), vi.fn()]),
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

// Mock the DependencyGraph component with realistic behavior
vi.mock('@/components/graphs/DependencyGraph', () => ({
  DependencyGraph: vi.fn(({ nodes, edges, onNodeClick, className, interactive, fitView }) => (
    <div
      data-testid="dependency-graph"
      data-nodes-count={nodes?.length || 0}
      data-edges-count={edges?.length || 0}
      className={className}
    >
      {mockReactFlowIntegration({
        nodes,
        edges,
        onNodeClick,
        className,
        interactive,
        fitView,
      })}
    </div>
  )),
}))

import { TaskDependencyGraph } from '../TaskDependencyGraph'

describe('TaskDependencyGraph Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNodesState = []
    mockEdgesState = []
    mockOnNodeClick = undefined
    mockOnEdgeClick = undefined
  })

  describe('Real-world Task Workflow Scenarios', () => {
    it('should render feature development workflow correctly', () => {
      const tasks: Task[] = [
        createTask({
          id: 'planning-task',
          description: 'Plan user authentication feature',
          status: 'completed',
          currentStage: 'planning',
        }),
        createTask({
          id: 'design-task',
          description: 'Design authentication UI components',
          status: 'completed',
          dependsOn: ['planning-task'],
          currentStage: 'design',
        }),
        createTask({
          id: 'backend-task',
          description: 'Implement authentication API',
          status: 'in-progress',
          dependsOn: ['design-task'],
          currentStage: 'implementation',
        }),
        createTask({
          id: 'frontend-task',
          description: 'Implement login form component',
          status: 'pending',
          dependsOn: ['design-task'],
          currentStage: 'queued',
        }),
        createTask({
          id: 'testing-task',
          description: 'Write comprehensive tests',
          status: 'pending',
          dependsOn: ['backend-task', 'frontend-task'],
          currentStage: 'queued',
        }),
      ]

      render(<TaskDependencyGraph tasks={tasks} />)

      // Verify all tasks are rendered
      expect(screen.getByTestId('dependency-graph')).toHaveAttribute('data-nodes-count', '5')

      // Check individual task nodes exist
      tasks.forEach(task => {
        expect(screen.getByTestId(`graph-node-${task.id}`)).toBeInTheDocument()
        expect(screen.getByTestId(`graph-node-${task.id}`)).toHaveAttribute('data-task-id', task.id)
      })

      // Verify dependency edges are created
      expect(screen.getByTestId('dependency-graph')).toHaveAttribute('data-edges-count', '4')

      // Check specific dependency relationships
      expect(screen.getByTestId('graph-edge-dep-planning-task-design-task')).toBeInTheDocument()
      expect(screen.getByTestId('graph-edge-dep-design-task-backend-task')).toBeInTheDocument()
      expect(screen.getByTestId('graph-edge-dep-design-task-frontend-task')).toBeInTheDocument()
      expect(screen.getByTestId('graph-edge-dep-backend-task-testing-task')).toBeInTheDocument()
    })

    it('should handle multi-level parent-child task hierarchies', () => {
      const tasks: Task[] = [
        // Parent task
        createTask({
          id: 'epic-auth',
          description: 'User Authentication System',
          status: 'in-progress',
          subtaskIds: ['feature-login', 'feature-register'],
        }),

        // Child tasks
        createTask({
          id: 'feature-login',
          description: 'Login Feature',
          status: 'in-progress',
          parentTaskId: 'epic-auth',
          subtaskIds: ['login-ui', 'login-api'],
        }),
        createTask({
          id: 'feature-register',
          description: 'Registration Feature',
          status: 'pending',
          parentTaskId: 'epic-auth',
          subtaskIds: ['register-ui', 'register-api'],
        }),

        // Grandchild tasks
        createTask({
          id: 'login-ui',
          description: 'Login Form Component',
          status: 'completed',
          parentTaskId: 'feature-login',
        }),
        createTask({
          id: 'login-api',
          description: 'Login API Endpoint',
          status: 'in-progress',
          parentTaskId: 'feature-login',
        }),
        createTask({
          id: 'register-ui',
          description: 'Registration Form Component',
          status: 'pending',
          parentTaskId: 'feature-register',
        }),
        createTask({
          id: 'register-api',
          description: 'Registration API Endpoint',
          status: 'pending',
          parentTaskId: 'feature-register',
        }),
      ]

      render(<TaskDependencyGraph tasks={tasks} />)

      // Verify all hierarchy levels are rendered
      expect(screen.getByTestId('dependency-graph')).toHaveAttribute('data-nodes-count', '7')

      // Check parent-child edges exist
      expect(screen.getByTestId('graph-edge-subtask-epic-auth-feature-login')).toBeInTheDocument()
      expect(screen.getByTestId('graph-edge-subtask-epic-auth-feature-register')).toBeInTheDocument()
      expect(screen.getByTestId('graph-edge-subtask-feature-login-login-ui')).toBeInTheDocument()
      expect(screen.getByTestId('graph-edge-subtask-feature-login-login-api')).toBeInTheDocument()
      expect(screen.getByTestId('graph-edge-subtask-feature-register-register-ui')).toBeInTheDocument()
      expect(screen.getByTestId('graph-edge-subtask-feature-register-register-api')).toBeInTheDocument()

      // Verify total edge count (6 parent-child relationships)
      expect(screen.getByTestId('dependency-graph')).toHaveAttribute('data-edges-count', '6')
    })

    it('should handle mixed dependency and hierarchy relationships', () => {
      const tasks: Task[] = [
        // Database setup task
        createTask({
          id: 'db-setup',
          description: 'Setup database schema',
          status: 'completed',
        }),

        // User model task depends on database
        createTask({
          id: 'user-model',
          description: 'Create user model',
          status: 'completed',
          dependsOn: ['db-setup'],
        }),

        // Authentication epic with subtasks
        createTask({
          id: 'auth-epic',
          description: 'Authentication System',
          status: 'in-progress',
          subtaskIds: ['auth-controller', 'auth-middleware'],
          dependsOn: ['user-model'], // Epic depends on user model
        }),

        // Auth subtasks
        createTask({
          id: 'auth-controller',
          description: 'Authentication Controller',
          status: 'in-progress',
          parentTaskId: 'auth-epic',
        }),
        createTask({
          id: 'auth-middleware',
          description: 'Authentication Middleware',
          status: 'pending',
          parentTaskId: 'auth-epic',
          dependsOn: ['auth-controller'], // Subtask depends on another subtask
        }),

        // Frontend task depends on auth epic
        createTask({
          id: 'frontend-auth',
          description: 'Frontend Authentication',
          status: 'pending',
          dependsOn: ['auth-epic'],
        }),
      ]

      render(<TaskDependencyGraph tasks={tasks} />)

      expect(screen.getByTestId('dependency-graph')).toHaveAttribute('data-nodes-count', '6')

      // Check dependency edges
      expect(screen.getByTestId('graph-edge-dep-db-setup-user-model')).toBeInTheDocument()
      expect(screen.getByTestId('graph-edge-dep-user-model-auth-epic')).toBeInTheDocument()
      expect(screen.getByTestId('graph-edge-dep-auth-controller-auth-middleware')).toBeInTheDocument()
      expect(screen.getByTestId('graph-edge-dep-auth-epic-frontend-auth')).toBeInTheDocument()

      // Check hierarchy edges
      expect(screen.getByTestId('graph-edge-subtask-auth-epic-auth-controller')).toBeInTheDocument()
      expect(screen.getByTestId('graph-edge-subtask-auth-epic-auth-middleware')).toBeInTheDocument()

      // Total: 4 dependency edges + 2 hierarchy edges = 6
      expect(screen.getByTestId('dependency-graph')).toHaveAttribute('data-edges-count', '6')
    })
  })

  describe('Navigation and Interaction Workflows', () => {
    it('should handle task navigation workflow', async () => {
      const tasks = [
        createTask({
          id: 'task-123',
          description: 'Implement user dashboard',
          status: 'in-progress',
        }),
      ]

      render(<TaskDependencyGraph tasks={tasks} />)

      const taskNode = screen.getByTestId('graph-node-task-123')
      expect(taskNode).toBeInTheDocument()

      fireEvent.click(taskNode)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/tasks/task-123')
      })
    })

    it('should support custom navigation handler', async () => {
      const mockCustomNavigation = vi.fn()
      const tasks = [
        createTask({
          id: 'task-456',
          description: 'Custom navigation test',
          status: 'pending',
        }),
      ]

      render(
        <TaskDependencyGraph
          tasks={tasks}
          onTaskClick={mockCustomNavigation}
        />
      )

      const taskNode = screen.getByTestId('graph-node-task-456')
      fireEvent.click(taskNode)

      await waitFor(() => {
        expect(mockCustomNavigation).toHaveBeenCalledWith('task-456')
        expect(mockPush).not.toHaveBeenCalled()
      })
    })

    it('should provide comprehensive task information on node hover', () => {
      const task = createTask({
        id: 'task-789',
        description: 'This is a very long task description that should be truncated in the graph but available in full detail when needed',
        status: 'planning',
      })

      render(<TaskDependencyGraph tasks={[task]} />)

      const taskNode = screen.getByTestId('graph-node-task-789')
      expect(taskNode).toHaveAttribute('data-task-id', 'task-789')
      expect(taskNode).toHaveAttribute('data-status', 'active') // planning maps to active

      // Check that the label is truncated
      const nodeLabel = screen.getByTestId('node-label-task-789')
      expect(nodeLabel.textContent).toContain('...')
      expect(nodeLabel.textContent!.length).toBeLessThan(task.description.length)
    })
  })

  describe('Status and Visual State Management', () => {
    it('should visually differentiate tasks by status', () => {
      const tasks: Task[] = [
        createTask({ id: 'pending', description: 'Pending task', status: 'pending' }),
        createTask({ id: 'active', description: 'Active task', status: 'in-progress' }),
        createTask({ id: 'completed', description: 'Completed task', status: 'completed' }),
        createTask({ id: 'failed', description: 'Failed task', status: 'failed' }),
      ]

      render(<TaskDependencyGraph tasks={tasks} />)

      // Check visual differentiation by status attribute
      expect(screen.getByTestId('graph-node-pending')).toHaveAttribute('data-status', 'pending')
      expect(screen.getByTestId('graph-node-active')).toHaveAttribute('data-status', 'active')
      expect(screen.getByTestId('graph-node-completed')).toHaveAttribute('data-status', 'completed')
      expect(screen.getByTestId('graph-node-failed')).toHaveAttribute('data-status', 'error')

      // Check that active tasks have different styling
      const activeNode = screen.getByTestId('graph-node-active')
      const completedNode = screen.getByTestId('graph-node-completed')

      expect(activeNode).toHaveStyle('background: #3b82f6; color: white')
      expect(completedNode).toHaveStyle('background: #f1f5f9; color: black')
    })

    it('should handle all supported task statuses correctly', () => {
      const allStatuses: TaskStatus[] = [
        'pending', 'queued', 'planning', 'in-progress',
        'awaiting-approval', 'paused', 'completed', 'failed', 'cancelled'
      ]

      const tasks = allStatuses.map((status, index) =>
        createTask({
          id: `task-${status}`,
          description: `Task with ${status} status`,
          status,
        })
      )

      render(<TaskDependencyGraph tasks={tasks} />)

      expect(screen.getByTestId('dependency-graph')).toHaveAttribute('data-nodes-count', '9')

      // Verify each status is properly mapped
      expect(screen.getByTestId('graph-node-task-pending')).toHaveAttribute('data-status', 'pending')
      expect(screen.getByTestId('graph-node-task-queued')).toHaveAttribute('data-status', 'pending')
      expect(screen.getByTestId('graph-node-task-planning')).toHaveAttribute('data-status', 'active')
      expect(screen.getByTestId('graph-node-task-in-progress')).toHaveAttribute('data-status', 'active')
      expect(screen.getByTestId('graph-node-task-awaiting-approval')).toHaveAttribute('data-status', 'warning')
      expect(screen.getByTestId('graph-node-task-paused')).toHaveAttribute('data-status', 'warning')
      expect(screen.getByTestId('graph-node-task-completed')).toHaveAttribute('data-status', 'completed')
      expect(screen.getByTestId('graph-node-task-failed')).toHaveAttribute('data-status', 'error')
      expect(screen.getByTestId('graph-node-task-cancelled')).toHaveAttribute('data-status', 'default')
    })
  })

  describe('Component Configuration and Props', () => {
    it('should handle custom height configurations', () => {
      const task = createTask({ id: 'test', description: 'Test task' })

      const { container: container1 } = render(
        <TaskDependencyGraph tasks={[task]} height={600} />
      )

      const { container: container2 } = render(
        <TaskDependencyGraph tasks={[task]} height="500px" />
      )

      const wrapper1 = container1.firstChild as HTMLElement
      const wrapper2 = container2.firstChild as HTMLElement

      expect(wrapper1).toHaveStyle('height: 600px')
      expect(wrapper2).toHaveStyle('height: 500px')
    })

    it('should pass interactive and fitView props correctly', () => {
      const task = createTask({ id: 'test', description: 'Test task' })

      const { rerender } = render(
        <TaskDependencyGraph
          tasks={[task]}
          interactive={false}
          fitView={false}
        />
      )

      expect(screen.queryByTestId('interactive-enabled')).not.toBeInTheDocument()
      expect(screen.queryByTestId('fit-view-enabled')).not.toBeInTheDocument()

      rerender(
        <TaskDependencyGraph
          tasks={[task]}
          interactive={true}
          fitView={true}
        />
      )

      expect(screen.getByTestId('interactive-enabled')).toBeInTheDocument()
      expect(screen.getByTestId('fit-view-enabled')).toBeInTheDocument()
    })

    it('should apply custom CSS classes', () => {
      const task = createTask({ id: 'test', description: 'Test task' })
      const { container } = render(
        <TaskDependencyGraph
          tasks={[task]}
          className="custom-graph-styling test-class"
        />
      )

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper).toHaveClass('custom-graph-styling', 'test-class')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should gracefully handle tasks with malformed dependency references', () => {
      const tasks = [
        createTask({
          id: 'task-1',
          description: 'Task with invalid dependencies',
          dependsOn: ['non-existent-1', 'non-existent-2'],
        }),
        createTask({
          id: 'task-2',
          description: 'Normal task',
        }),
      ]

      expect(() => {
        render(<TaskDependencyGraph tasks={tasks} />)
      }).not.toThrow()

      expect(screen.getByTestId('dependency-graph')).toHaveAttribute('data-nodes-count', '2')
      expect(screen.getByTestId('dependency-graph')).toHaveAttribute('data-edges-count', '0')
    })

    it('should handle orphaned subtasks gracefully', () => {
      const tasks = [
        createTask({
          id: 'orphaned-subtask',
          description: 'Subtask without parent',
          parentTaskId: 'missing-parent',
        }),
        createTask({
          id: 'normal-task',
          description: 'Normal task',
        }),
      ]

      expect(() => {
        render(<TaskDependencyGraph tasks={tasks} />)
      }).not.toThrow()

      expect(screen.getByTestId('dependency-graph')).toHaveAttribute('data-nodes-count', '2')
      expect(screen.getByTestId('dependency-graph')).toHaveAttribute('data-edges-count', '0')
    })

    it('should handle deeply nested task hierarchies', () => {
      // Create a 4-level deep hierarchy
      const tasks = [
        createTask({
          id: 'level-1',
          description: 'Level 1 - Epic',
          subtaskIds: ['level-2a', 'level-2b'],
        }),
        createTask({
          id: 'level-2a',
          description: 'Level 2A - Feature A',
          parentTaskId: 'level-1',
          subtaskIds: ['level-3a'],
        }),
        createTask({
          id: 'level-2b',
          description: 'Level 2B - Feature B',
          parentTaskId: 'level-1',
          subtaskIds: ['level-3b'],
        }),
        createTask({
          id: 'level-3a',
          description: 'Level 3A - Component A',
          parentTaskId: 'level-2a',
          subtaskIds: ['level-4a'],
        }),
        createTask({
          id: 'level-3b',
          description: 'Level 3B - Component B',
          parentTaskId: 'level-2b',
        }),
        createTask({
          id: 'level-4a',
          description: 'Level 4A - Task A',
          parentTaskId: 'level-3a',
        }),
      ]

      render(<TaskDependencyGraph tasks={tasks} />)

      expect(screen.getByTestId('dependency-graph')).toHaveAttribute('data-nodes-count', '6')

      // Check all parent-child relationships are created
      expect(screen.getByTestId('graph-edge-subtask-level-1-level-2a')).toBeInTheDocument()
      expect(screen.getByTestId('graph-edge-subtask-level-1-level-2b')).toBeInTheDocument()
      expect(screen.getByTestId('graph-edge-subtask-level-2a-level-3a')).toBeInTheDocument()
      expect(screen.getByTestId('graph-edge-subtask-level-2b-level-3b')).toBeInTheDocument()
      expect(screen.getByTestId('graph-edge-subtask-level-3a-level-4a')).toBeInTheDocument()

      // Total: 5 parent-child edges
      expect(screen.getByTestId('dependency-graph')).toHaveAttribute('data-edges-count', '5')
    })
  })

  describe('Empty State Scenarios', () => {
    it('should display appropriate empty state for different scenarios', () => {
      // Test with empty array
      const { rerender } = render(<TaskDependencyGraph tasks={[]} />)
      expect(screen.getByText('No tasks to display')).toBeInTheDocument()

      // Test with custom empty message
      rerender(
        <TaskDependencyGraph
          tasks={[]}
          emptyStateMessage="No workflow tasks available for this project"
        />
      )
      expect(screen.getByText('No workflow tasks available for this project')).toBeInTheDocument()
    })

    it('should maintain consistent empty state styling', () => {
      const { container } = render(
        <TaskDependencyGraph
          tasks={[]}
          height={500}
          className="custom-empty-state"
        />
      )

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper).toHaveClass('custom-empty-state')
      expect(wrapper).toHaveStyle('height: 500px')

      // Empty state should contain proper visual elements
      expect(screen.getByText('No tasks to display')).toBeInTheDocument()
    })
  })
})