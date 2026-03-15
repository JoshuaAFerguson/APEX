/**
 * Edge case tests for TaskDependencyGraph component
 *
 * Tests complex scenarios, boundary conditions, data validation,
 * and error recovery that might occur in production environments.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import '@testing-library/jest-dom'
import { useRouter } from 'next/navigation'
import { createTask } from '@apexcli/core/factories'
import type { Task } from '@apexcli/core'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
}))

// Mock React Flow with edge case testing focus
let mockNodes: any[] = []
let mockEdges: any[] = []

const mockReactFlow = vi.fn(({ nodes, edges, onNodeClick, ...props }) => {
  mockNodes = nodes || []
  mockEdges = edges || []

  return (
    <div data-testid="react-flow-edge-cases" {...props}>
      <div data-testid="nodes-container">
        {mockNodes.map((node: any) => (
          <div
            key={node.id}
            data-testid={`node-${node.id}`}
            data-position-x={node.position.x}
            data-position-y={node.position.y}
            data-node-type={node.data?.type}
            data-task-status={node.data?.taskStatus}
            data-parent-task={node.data?.parentTaskId}
            data-subtasks={JSON.stringify(node.data?.subtaskIds)}
            data-dependencies={JSON.stringify(node.data?.dependsOn)}
            onClick={() => onNodeClick?.(node)}
          >
            <span data-testid={`node-label-${node.id}`}>
              {node.data?.label || node.id}
            </span>
            {node.data?.truncatedDescription && (
              <div data-testid={`node-description-${node.id}`}>
                {node.data.truncatedDescription}
              </div>
            )}
            {node.data?.fullDescription && (
              <div data-testid={`node-full-description-${node.id}`} style={{ display: 'none' }}>
                {node.data.fullDescription}
              </div>
            )}
          </div>
        ))}
      </div>
      <div data-testid="edges-container">
        {mockEdges.map((edge: any) => (
          <div
            key={edge.id}
            data-testid={`edge-${edge.id}`}
            data-source={edge.source}
            data-target={edge.target}
            data-relationship={edge.data?.relationshipType}
            data-animated={edge.animated ? 'true' : 'false'}
            data-edge-type={edge.data?.type}
          >
            {edge.data?.label}
          </div>
        ))}
      </div>
    </div>
  )
})

vi.mock('@xyflow/react', () => ({
  ReactFlow: mockReactFlow,
  MiniMap: vi.fn(() => <div data-testid="minimap">MiniMap</div>),
  Controls: vi.fn(() => <div data-testid="controls">Controls</div>),
  Background: vi.fn(() => <div data-testid="background">Background</div>),
  useNodesState: vi.fn(() => [[], vi.fn(), vi.fn()]),
  useEdgesState: vi.fn(() => [[], vi.fn(), vi.fn()]),
  BackgroundVariant: { Dots: 'dots', Lines: 'lines', Cross: 'cross' },
}))

vi.mock('@xyflow/react/dist/style.css', () => ({}))

vi.mock('@/lib/utils', () => ({
  cn: vi.fn((...classes) => classes.filter(Boolean).join(' ')),
}))

vi.mock('@/components/graphs/DependencyGraph', () => ({
  DependencyGraph: vi.fn(({ nodes, edges, onNodeClick, ...props }) => (
    <div data-testid="dependency-graph-edge-cases" {...props}>
      {mockReactFlow({ nodes, edges, onNodeClick, ...props })}
    </div>
  )),
}))

import { TaskDependencyGraph } from '../TaskDependencyGraph'

describe('TaskDependencyGraph Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNodes = []
    mockEdges = []
  })

  describe('Circular Dependencies and Complex Cycles', () => {
    it('should handle simple circular dependencies without infinite loops', () => {
      const tasks: Task[] = [
        createTask({
          id: 'task-a',
          description: 'Task A depends on B',
          dependsOn: ['task-b'],
        }),
        createTask({
          id: 'task-b',
          description: 'Task B depends on C',
          dependsOn: ['task-c'],
        }),
        createTask({
          id: 'task-c',
          description: 'Task C depends on A (circular)',
          dependsOn: ['task-a'],
        }),
      ]

      expect(() => {
        render(<TaskDependencyGraph tasks={tasks} />)
      }).not.toThrow()

      // All nodes should be rendered
      expect(screen.getByTestId('node-task-a')).toBeInTheDocument()
      expect(screen.getByTestId('node-task-b')).toBeInTheDocument()
      expect(screen.getByTestId('node-task-c')).toBeInTheDocument()

      // All circular edges should be present
      expect(screen.getByTestId('edge-dep-task-b-task-a')).toBeInTheDocument()
      expect(screen.getByTestId('edge-dep-task-c-task-b')).toBeInTheDocument()
      expect(screen.getByTestId('edge-dep-task-a-task-c')).toBeInTheDocument()
    })

    it('should handle complex multi-level circular dependencies', () => {
      const tasks: Task[] = [
        createTask({
          id: 'ui-component',
          description: 'UI Component',
          dependsOn: ['data-service'],
        }),
        createTask({
          id: 'data-service',
          description: 'Data Service',
          dependsOn: ['api-client'],
        }),
        createTask({
          id: 'api-client',
          description: 'API Client',
          dependsOn: ['auth-service'],
        }),
        createTask({
          id: 'auth-service',
          description: 'Auth Service',
          dependsOn: ['user-model'],
        }),
        createTask({
          id: 'user-model',
          description: 'User Model',
          dependsOn: ['ui-component'], // Creates long circular chain
        }),
      ]

      render(<TaskDependencyGraph tasks={tasks} />)

      // Verify all tasks are rendered despite circular dependencies
      tasks.forEach(task => {
        expect(screen.getByTestId(`node-${task.id}`)).toBeInTheDocument()
      })

      // Check that all dependency edges exist
      expect(screen.getByTestId('edge-dep-data-service-ui-component')).toBeInTheDocument()
      expect(screen.getByTestId('edge-dep-api-client-data-service')).toBeInTheDocument()
      expect(screen.getByTestId('edge-dep-auth-service-api-client')).toBeInTheDocument()
      expect(screen.getByTestId('edge-dep-user-model-auth-service')).toBeInTheDocument()
      expect(screen.getByTestId('edge-dep-ui-component-user-model')).toBeInTheDocument()
    })

    it('should handle self-referencing tasks', () => {
      const task = createTask({
        id: 'recursive-task',
        description: 'Task that depends on itself',
        dependsOn: ['recursive-task'], // Self-reference
      })

      expect(() => {
        render(<TaskDependencyGraph tasks={[task]} />)
      }).not.toThrow()

      expect(screen.getByTestId('node-recursive-task')).toBeInTheDocument()
      expect(screen.getByTestId('edge-dep-recursive-task-recursive-task')).toBeInTheDocument()
    })
  })

  describe('Malformed and Invalid Data', () => {
    it('should handle tasks with undefined or null properties', () => {
      const malformedTasks = [
        {
          id: 'task-1',
          description: 'Normal task',
          status: 'pending' as const,
          dependsOn: undefined,
          subtaskIds: null,
          parentTaskId: undefined,
        },
        {
          id: 'task-2',
          description: undefined,
          status: 'in-progress' as const,
          dependsOn: [],
          subtaskIds: undefined,
          parentTaskId: null,
        },
      ] as Task[]

      expect(() => {
        render(<TaskDependencyGraph tasks={malformedTasks} />)
      }).not.toThrow()

      expect(screen.getByTestId('node-task-1')).toBeInTheDocument()
      expect(screen.getByTestId('node-task-2')).toBeInTheDocument()
    })

    it('should handle tasks with empty strings and invalid IDs', () => {
      const tasks = [
        createTask({
          id: '',
          description: 'Task with empty ID',
        }),
        createTask({
          id: '   ',
          description: 'Task with whitespace ID',
        }),
        createTask({
          id: 'normal-task',
          description: '',
        }),
      ]

      expect(() => {
        render(<TaskDependencyGraph tasks={tasks} />)
      }).not.toThrow()

      // Component should handle empty IDs gracefully
      expect(mockNodes).toHaveLength(3)
    })

    it('should handle extremely long descriptions and IDs', () => {
      const veryLongDescription = 'A'.repeat(1000)
      const veryLongId = 'task-' + 'x'.repeat(500)

      const task = createTask({
        id: veryLongId,
        description: veryLongDescription,
      })

      render(<TaskDependencyGraph tasks={[task]} />)

      const node = screen.getByTestId(`node-${veryLongId}`)
      expect(node).toBeInTheDocument()

      // Check that description is truncated
      const truncatedDesc = screen.getByTestId(`node-description-${veryLongId}`)
      expect(truncatedDesc.textContent!.length).toBeLessThan(veryLongDescription.length)
      expect(truncatedDesc.textContent).toMatch(/\.\.\./)

      // Check that full description is available
      const fullDesc = screen.getByTestId(`node-full-description-${veryLongId}`)
      expect(fullDesc.textContent).toBe(veryLongDescription)
    })

    it('should handle tasks with special characters in IDs and descriptions', () => {
      const specialTasks = [
        createTask({
          id: 'task-with-@#$%^&*()',
          description: 'Task with émojis 🚀 and spéciàl characters',
        }),
        createTask({
          id: 'task/with/slashes',
          description: 'Path-like task ID',
        }),
        createTask({
          id: 'task with spaces',
          description: 'Task ID with spaces',
        }),
      ]

      expect(() => {
        render(<TaskDependencyGraph tasks={specialTasks} />)
      }).not.toThrow()

      specialTasks.forEach(task => {
        expect(screen.getByTestId(`node-${task.id}`)).toBeInTheDocument()
      })
    })
  })

  describe('Extreme Scale and Performance Edge Cases', () => {
    it('should handle large numbers of independent tasks', () => {
      const largeTasks = Array.from({ length: 100 }, (_, i) =>
        createTask({
          id: `independent-task-${i}`,
          description: `Independent task number ${i}`,
        })
      )

      const startTime = performance.now()
      render(<TaskDependencyGraph tasks={largeTasks} />)
      const endTime = performance.now()

      // Should render quickly even with many tasks
      expect(endTime - startTime).toBeLessThan(200) // 200ms threshold
      expect(mockNodes).toHaveLength(100)
      expect(mockEdges).toHaveLength(0) // No dependencies
    })

    it('should handle tasks with massive dependency lists', () => {
      const baseTasks = Array.from({ length: 50 }, (_, i) =>
        createTask({
          id: `base-task-${i}`,
          description: `Base task ${i}`,
        })
      )

      const dependentTask = createTask({
        id: 'mega-dependent-task',
        description: 'Task that depends on everything',
        dependsOn: baseTasks.map(t => t.id),
      })

      const allTasks = [...baseTasks, dependentTask]

      render(<TaskDependencyGraph tasks={allTasks} />)

      expect(mockNodes).toHaveLength(51)
      expect(mockEdges).toHaveLength(50) // 50 dependency edges to the dependent task
    })

    it('should handle deeply nested task hierarchies', () => {
      // Create a 10-level deep hierarchy
      const deepTasks: Task[] = []
      let currentParentId: string | undefined = undefined

      for (let level = 0; level < 10; level++) {
        const taskId = `level-${level}-task`
        const task = createTask({
          id: taskId,
          description: `Task at level ${level}`,
          parentTaskId: currentParentId,
          subtaskIds: level < 9 ? [`level-${level + 1}-task`] : undefined,
        })
        deepTasks.push(task)
        currentParentId = taskId
      }

      render(<TaskDependencyGraph tasks={deepTasks} />)

      expect(mockNodes).toHaveLength(10)
      expect(mockEdges).toHaveLength(9) // 9 parent-child relationships

      // Check that all levels are positioned correctly
      deepTasks.forEach((task, index) => {
        const node = screen.getByTestId(`node-${task.id}`)
        expect(node).toBeInTheDocument()
        expect(node).toHaveAttribute('data-parent-task', task.parentTaskId || '')
      })
    })
  })

  describe('Dynamic State Changes and Updates', () => {
    it('should handle rapid task status changes', async () => {
      const task = createTask({
        id: 'status-changing-task',
        description: 'Task with changing status',
        status: 'pending',
      })

      const { rerender } = render(<TaskDependencyGraph tasks={[task]} />)

      expect(screen.getByTestId('node-status-changing-task')).toHaveAttribute(
        'data-task-status', 'pending'
      )

      // Rapidly change status
      const statuses = ['in-progress', 'paused', 'in-progress', 'completed', 'failed']
      for (const status of statuses) {
        rerender(
          <TaskDependencyGraph
            tasks={[{ ...task, status: status as any }]}
          />
        )

        await waitFor(() => {
          expect(screen.getByTestId('node-status-changing-task')).toHaveAttribute(
            'data-task-status', status
          )
        })
      }
    })

    it('should handle dynamic dependency modifications', () => {
      const baseTasks = [
        createTask({ id: 'task-a', description: 'Task A' }),
        createTask({ id: 'task-b', description: 'Task B' }),
        createTask({ id: 'task-c', description: 'Task C' }),
      ]

      // Start with no dependencies
      const { rerender } = render(<TaskDependencyGraph tasks={baseTasks} />)
      expect(mockEdges).toHaveLength(0)

      // Add dependency
      const tasksWithDep = [
        ...baseTasks.slice(0, -1),
        { ...baseTasks[2], dependsOn: ['task-a'] },
      ]
      rerender(<TaskDependencyGraph tasks={tasksWithDep} />)
      expect(mockEdges).toHaveLength(1)

      // Add more dependencies
      const tasksWithMoreDeps = [
        ...baseTasks.slice(0, -1),
        { ...baseTasks[2], dependsOn: ['task-a', 'task-b'] },
      ]
      rerender(<TaskDependencyGraph tasks={tasksWithMoreDeps} />)
      expect(mockEdges).toHaveLength(2)

      // Remove all dependencies
      rerender(<TaskDependencyGraph tasks={baseTasks} />)
      expect(mockEdges).toHaveLength(0)
    })

    it('should handle task addition and removal', () => {
      let tasks = [
        createTask({ id: 'permanent-task', description: 'Permanent task' }),
      ]

      const { rerender } = render(<TaskDependencyGraph tasks={tasks} />)
      expect(mockNodes).toHaveLength(1)

      // Add tasks
      tasks = [
        ...tasks,
        createTask({ id: 'new-task-1', description: 'New task 1' }),
        createTask({ id: 'new-task-2', description: 'New task 2' }),
      ]
      rerender(<TaskDependencyGraph tasks={tasks} />)
      expect(mockNodes).toHaveLength(3)

      // Remove a task
      tasks = tasks.filter(t => t.id !== 'new-task-1')
      rerender(<TaskDependencyGraph tasks={tasks} />)
      expect(mockNodes).toHaveLength(2)
      expect(screen.queryByTestId('node-new-task-1')).not.toBeInTheDocument()
      expect(screen.getByTestId('node-permanent-task')).toBeInTheDocument()
      expect(screen.getByTestId('node-new-task-2')).toBeInTheDocument()
    })
  })

  describe('Layout and Positioning Edge Cases', () => {
    it('should handle tasks that exceed maximum nodes per row', () => {
      // Create more tasks than the default maxNodesPerRow (4)
      const manyTasks = Array.from({ length: 10 }, (_, i) =>
        createTask({
          id: `row-task-${i}`,
          description: `Task ${i}`,
        })
      )

      render(<TaskDependencyGraph tasks={manyTasks} />)

      // Check that positions are calculated (not all at 0,0)
      const positions = manyTasks.map(task => {
        const node = screen.getByTestId(`node-${task.id}`)
        return {
          x: parseInt(node.getAttribute('data-position-x') || '0'),
          y: parseInt(node.getAttribute('data-position-y') || '0'),
        }
      })

      // Should have different Y positions for different rows
      const uniqueYPositions = [...new Set(positions.map(p => p.y))]
      expect(uniqueYPositions.length).toBeGreaterThan(1)
    })

    it('should handle subtask positioning with many siblings', () => {
      const parentTask = createTask({
        id: 'parent-many-children',
        description: 'Parent with many children',
        subtaskIds: Array.from({ length: 8 }, (_, i) => `child-${i}`),
      })

      const childTasks = Array.from({ length: 8 }, (_, i) =>
        createTask({
          id: `child-${i}`,
          description: `Child task ${i}`,
          parentTaskId: 'parent-many-children',
        })
      )

      render(<TaskDependencyGraph tasks={[parentTask, ...childTasks]} />)

      // All nodes should be positioned
      expect(mockNodes).toHaveLength(9)

      // Check that subtasks are positioned relative to parent
      const parentNode = screen.getByTestId('node-parent-many-children')
      const parentX = parseInt(parentNode.getAttribute('data-position-x') || '0')

      childTasks.forEach(child => {
        const childNode = screen.getByTestId(`node-${child.id}`)
        const childX = parseInt(childNode.getAttribute('data-position-x') || '0')
        // Children should be positioned near parent (within reasonable range)
        expect(Math.abs(childX - parentX)).toBeLessThan(500)
      })
    })
  })

  describe('Error Recovery and Fault Tolerance', () => {
    it('should recover gracefully from React Flow errors', () => {
      // Mock React Flow to throw an error once, then work normally
      let shouldThrow = true
      const originalConsoleError = console.error
      console.error = vi.fn() // Suppress error logs during test

      const ThrowingReactFlow = vi.fn(() => {
        if (shouldThrow) {
          shouldThrow = false
          throw new Error('Mock React Flow error')
        }
        return <div data-testid="react-flow-recovered">React Flow Recovered</div>
      })

      vi.mocked(mockReactFlow).mockImplementation(ThrowingReactFlow)

      const task = createTask({ id: 'recovery-test', description: 'Recovery test task' })

      // First render should handle the error gracefully
      expect(() => {
        render(<TaskDependencyGraph tasks={[task]} />)
      }).not.toThrow()

      console.error = originalConsoleError // Restore console.error
    })

    it('should handle navigation errors gracefully', async () => {
      const mockRouterWithError = {
        push: vi.fn(() => {
          throw new Error('Navigation error')
        }),
      }

      ;(useRouter as any).mockReturnValue(mockRouterWithError)

      const task = createTask({ id: 'nav-error-task', description: 'Navigation error task' })

      render(<TaskDependencyGraph tasks={[task]} />)

      const node = screen.getByTestId('node-nav-error-task')

      // Should not crash when navigation fails
      expect(() => {
        fireEvent.click(node)
      }).not.toThrow()
    })

    it('should handle missing or corrupted task data', () => {
      const corruptedTasks = [
        // Missing required fields
        { id: 'corrupt-1' } as Task,
        { description: 'No ID task' } as Task,
        // Partially corrupt
        {
          id: 'corrupt-2',
          description: 'Partially corrupt',
          status: 'invalid-status' as any,
          dependsOn: ['non-array-value'] as any,
        } as Task,
      ]

      expect(() => {
        render(<TaskDependencyGraph tasks={corruptedTasks} />)
      }).not.toThrow()

      // Should attempt to render what it can
      expect(mockNodes.length).toBeGreaterThan(0)
    })
  })
})